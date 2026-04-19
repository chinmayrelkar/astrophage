import { Hono } from "hono"
import { serve } from "@hono/node-server"
import { streamSSE } from "hono/streaming"
import { mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, appendFileSync, unlinkSync } from "fs"
import { join } from "path"
import { homedir } from "os"
import { transcript } from "./transcript.js"
import { getTraceTree, getSpans } from "./trace.js"
import { getTokenStats, getTotalCost, getStatsByAgent } from "./token-tracker.js"
import { startAutonomousLoop, getLoopStatus } from "./autonomous-loop.js"
import { loadBacklog } from "./agents/product.js"
import type { AgentEvent, PipelineStatus, RepoContext, Task } from "./types.js"

// ─── Persistence ──────────────────────────────────────────────────────────────

const RUNS_DIR = join(homedir(), ".astrophage", "runs")
mkdirSync(RUNS_DIR, { recursive: true })

function runPath(runId: string) {
  return join(RUNS_DIR, `${runId}.json`)
}

/** Write the full run record to disk (used at start and finish). */
function persistRun(run: RunRecord) {
  try {
    writeFileSync(runPath(run.id), JSON.stringify(run, null, 2))
  } catch (e) {
    console.error("[ASTROPHAGE] Failed to persist run:", e)
  }
}

/**
 * Append a single event to the run's on-disk event log incrementally.
 * We maintain a parallel `.events.ndjson` file — one JSON event per line —
 * so a crash loses no events. On load we merge it back into the run record.
 */
function appendEventToDisk(runId: string, event: AgentEvent) {
  try {
    appendFileSync(join(RUNS_DIR, `${runId}.events.ndjson`), JSON.stringify(event) + "\n")
  } catch { /* non-fatal */ }
}

function loadEventsFromDisk(runId: string): AgentEvent[] {
  try {
    const raw = readFileSync(join(RUNS_DIR, `${runId}.events.ndjson`), "utf8")
    return raw.trim().split("\n").filter(Boolean).map((l) => JSON.parse(l) as AgentEvent)
  } catch {
    return []
  }
}

function loadPersistedRuns(): RunRecord[] {
  try {
    const files = readdirSync(RUNS_DIR).filter((f) => f.endsWith(".json"))
    return files
      .map((f) => {
        try {
          const run = JSON.parse(readFileSync(join(RUNS_DIR, f), "utf8")) as RunRecord
          // Merge any incremental events written after the last full persist
          const diskEvents = loadEventsFromDisk(run.id)
          if (diskEvents.length > run.events.length) {
            run.events = diskEvents
          }
          // Mark any run that was still "running" at shutdown as unresolved
          if (run.status === "running") {
            run.status = "unresolved"
            run.finishedAt = run.finishedAt ?? new Date().toISOString()
            persistRun(run)
          }
          return run
        } catch {
          return null
        }
      })
      .filter((r): r is RunRecord => r !== null)
      .sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime())
  } catch {
    return []
  }
}

// ─── Current task info ────────────────────────────────────────────────────────

export interface TaskInfo {
  id: string
  title: string
  description: string
  repo: RepoContext
}

let _currentTask: TaskInfo | null = null

export function setCurrentTask(task: TaskInfo) {
  _currentTask = task
}

// ─── Run history ──────────────────────────────────────────────────────────────

export interface RunRecord {
  id: string
  taskId: string
  taskTitle: string
  taskDescription: string
  repo: RepoContext
  startedAt: string
  finishedAt?: string
  status: PipelineStatus | "running"
  rounds: number
  prUrl?: string
  events: AgentEvent[]
}

// Load persisted runs on startup
const runs: RunRecord[] = loadPersistedRuns()
let _currentRun: RunRecord | null = null

console.log(`[ASTROPHAGE] Loaded ${runs.length} persisted run(s) from ${RUNS_DIR}`)

export function startRun(taskId: string, taskTitle: string): RunRecord {
  const task = _currentTask
  const run: RunRecord = {
    id: `run_${Date.now()}`,
    taskId,
    taskTitle,
    taskDescription: task?.description ?? "",
    repo: task?.repo ?? { localPath: "", remoteUrl: "", defaultBranch: "main" },
    startedAt: new Date().toISOString(),
    status: "running",
    rounds: 0,
    events: [],
  }
  _currentRun = run
  runs.push(run)

  // Persist run record immediately so it survives a crash
  persistRun(run)

  transcript.subscribe((event) => {
    if (_currentRun !== run) return
    run.events.push(event)
    if (event.type === "round_start") run.rounds = event.round
    // Write every event to disk as it arrives — no data loss on restart
    appendEventToDisk(run.id, event)
    // Re-persist the full record every 10 events to keep status/rounds current
    if (run.events.length % 10 === 0) persistRun(run)
  })

  return run
}

export function finishRun(status: PipelineStatus, prUrl?: string) {
  if (_currentRun) {
    _currentRun.status = status
    _currentRun.finishedAt = new Date().toISOString()
    if (prUrl) _currentRun.prUrl = prUrl
    persistRun(_currentRun)
    // Remove the incremental sidecar — the full JSON is now the source of truth
    try { unlinkSync(join(RUNS_DIR, `${_currentRun.id}.events.ndjson`)) } catch { /* ok */ }
    _currentRun = null
  }
}

// ─── HTTP + SSE server ────────────────────────────────────────────────────────

const app = new Hono()

app.use("*", async (c, next) => {
  await next()
  c.header("Access-Control-Allow-Origin", "*")
  c.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
  c.header("Access-Control-Allow-Headers", "Content-Type")
})

app.get("/health", (c) => c.json({ status: "ok", service: "astrophage", runs: runs.length }))

app.get("/task", (c) => c.json(_currentTask ?? null))

// SSE live stream
app.get("/events", (c) => {
  return streamSSE(c, async (stream) => {
    await stream.writeSSE({ data: JSON.stringify({ type: "connected" }), event: "ping" })
    const unsub = transcript.subscribe(async (event: AgentEvent) => {
      try {
        await stream.writeSSE({ data: JSON.stringify(event), event: "agent_event" })
      } catch { /* disconnected */ }
    })
    await new Promise<void>((resolve) => {
      stream.onAbort(() => { unsub(); resolve() })
    })
  })
})

app.get("/transcript", (c) => c.json(transcript.getAll()))

// All runs — summary (no events payload)
app.get("/runs", (c) => {
  return c.json(
    [...runs]
      .reverse()
      .map(({ events: _, ...r }) => r),
  )
})

// Single run — full record with events
app.get("/runs/:id", (c) => {
  const run = runs.find((r) => r.id === c.req.param("id"))
  if (!run) return c.json({ error: "not found" }, 404)
  return c.json(run)
})

// Trace tree for a run — nested call graph
app.get("/runs/:id/trace", (c) => {
  const run = runs.find((r) => r.id === c.req.param("id"))
  if (!run) return c.json({ error: "not found" }, 404)
  const tree = getTraceTree(run.id)
  if (!tree) return c.json({ runId: run.id, tree: null, message: "No trace data available" })
  return c.json({ runId: run.id, tree })
})

// Per-agent cost/token breakdown for a run
app.get("/runs/:id/costs", (c) => {
  const run = runs.find((r) => r.id === c.req.param("id"))
  if (!run) return c.json({ error: "not found" }, 404)

  // Get all turn stats that belong to this run's agents/timeline
  // We filter by matching the run's startedAt..finishedAt window
  const allStats = getTokenStats()
  const runStart = new Date(run.startedAt).getTime()
  const runEnd = run.finishedAt ? new Date(run.finishedAt).getTime() : Date.now()

  const runStats = allStats.filter((s) => {
    const t = new Date(s.startTime).getTime()
    return t >= runStart && t <= runEnd
  })

  // Aggregate by agent
  const byAgent: Record<string, {
    agent: string
    turns: number
    inputTokens: number
    outputTokens: number
    estimatedCostUSD: number
    totalDurationMs: number
    avgDurationMs: number
  }> = {}

  for (const s of runStats) {
    if (!byAgent[s.agent]) {
      byAgent[s.agent] = {
        agent: s.agent,
        turns: 0,
        inputTokens: 0,
        outputTokens: 0,
        estimatedCostUSD: 0,
        totalDurationMs: 0,
        avgDurationMs: 0,
      }
    }
    const a = byAgent[s.agent]!
    a.turns++
    a.inputTokens += s.inputTokens
    a.outputTokens += s.outputTokens
    a.estimatedCostUSD += s.estimatedCostUSD
    a.totalDurationMs += s.durationMs
  }

  // Compute averages
  for (const a of Object.values(byAgent)) {
    a.avgDurationMs = a.turns > 0 ? Math.round(a.totalDurationMs / a.turns) : 0
  }

  const totalCost = runStats.reduce((sum, s) => sum + s.estimatedCostUSD, 0)
  const totalInputTokens = runStats.reduce((sum, s) => sum + s.inputTokens, 0)
  const totalOutputTokens = runStats.reduce((sum, s) => sum + s.outputTokens, 0)

  return c.json({
    runId: run.id,
    totalCostUSD: totalCost,
    totalInputTokens,
    totalOutputTokens,
    byAgent: Object.values(byAgent),
    turns: runStats,
  })
})

// Aggregate stats across all runs
app.get("/stats", (c) => {
  const allStats = getTokenStats()
  const totalCost = getTotalCost()
  const byAgent = getStatsByAgent()

  const completedRuns = runs.filter((r) => r.status !== "running")
  const totalRuns = runs.length
  const avgCostPerRun = completedRuns.length > 0
    ? totalCost / completedRuns.length
    : 0

  // Average duration per completed run (ms)
  const durationsMs = completedRuns
    .filter((r) => r.finishedAt)
    .map((r) => new Date(r.finishedAt!).getTime() - new Date(r.startedAt).getTime())
  const avgDurationMs = durationsMs.length > 0
    ? durationsMs.reduce((a, b) => a + b, 0) / durationsMs.length
    : 0

  return c.json({
    totalRuns,
    completedRuns: completedRuns.length,
    totalCostUSD: totalCost,
    avgCostPerRunUSD: avgCostPerRun,
    avgDurationMs,
    totalInputTokens: allStats.reduce((sum, s) => sum + s.inputTokens, 0),
    totalOutputTokens: allStats.reduce((sum, s) => sum + s.outputTokens, 0),
    totalTurns: allStats.length,
    byAgent,
  })
})

app.get("/status", (c) => c.json({
  running: _currentRun !== null,
  currentTask: _currentTask,
  currentRun: _currentRun ? { ..._currentRun, events: undefined } : null,
}))

// ─── Autonomous loop status ───────────────────────────────────────────────────

// Full loop status: queue, both agent states, last scan decisions
app.get("/autonomous/status", (c) => c.json(getLoopStatus()))

// Product backlog
app.get("/autonomous/backlog", (c) => c.json(loadBacklog()))

// Human task submission is disabled — all tasks come from DuBois and Lokken
app.post("/task", (c) => c.json({
  error: "Manual task submission is disabled. Tasks are sourced autonomously by DuBois (bugs) and Lokken (features).",
  autonomous: true,
}, 403))
app.post("/task/submit", (c) => c.json({
  error: "Manual task submission is disabled. Tasks are sourced autonomously by DuBois (bugs) and Lokken (features).",
  autonomous: true,
}, 403))

// ─── Eval results ─────────────────────────────────────────────────────────────

// Resolved relative to CWD (project root) — consistent whether run via tsx or compiled
const EVALS_LATEST_PATH = join(process.cwd(), "evals", "results", "latest.json")

app.get("/evals/latest", (c) => {
  if (!existsSync(EVALS_LATEST_PATH)) {
    return c.json({ error: "No eval results found. Run `npm run eval` first." }, 404)
  }
  try {
    const raw = readFileSync(EVALS_LATEST_PATH, "utf8")
    return c.json(JSON.parse(raw))
  } catch (err) {
    return c.json({ error: `Failed to read eval results: ${String(err)}` }, 500)
  }
})

export function startServer(port = 3001): Promise<void> {
  return new Promise((resolve) => {
    serve({ fetch: app.fetch, port, hostname: "127.0.0.1" }, () => {
      console.log(`[ASTROPHAGE] Server running at http://127.0.0.1:${port}`)
      console.log(`[ASTROPHAGE] SSE stream at http://127.0.0.1:${port}/events`)
      // Start autonomous loop — DuBois (bugs) + Lokken (features/roadmap)
      startAutonomousLoop()
      resolve()
    })
  })
}
