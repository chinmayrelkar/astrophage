import { Hono } from "hono"
import { serve } from "@hono/node-server"
import { streamSSE } from "hono/streaming"
import { mkdirSync, writeFileSync, readFileSync, readdirSync } from "fs"
import { join } from "path"
import { homedir } from "os"
import { transcript } from "./transcript.js"
import { getTraceTree, getSpans } from "./trace.js"
import { getTokenStats, getTotalCost, getStatsByAgent } from "./token-tracker.js"
import type { AgentEvent, PipelineStatus, RepoContext, Task } from "./types.js"

// ─── Persistence ──────────────────────────────────────────────────────────────

const RUNS_DIR = join(homedir(), ".astrophage", "runs")
mkdirSync(RUNS_DIR, { recursive: true })

function persistRun(run: RunRecord) {
  try {
    writeFileSync(join(RUNS_DIR, `${run.id}.json`), JSON.stringify(run, null, 2))
  } catch (e) {
    console.error("[ASTROPHAGE] Failed to persist run:", e)
  }
}

function loadPersistedRuns(): RunRecord[] {
  try {
    return readdirSync(RUNS_DIR)
      .filter((f) => f.endsWith(".json"))
      .map((f) => JSON.parse(readFileSync(join(RUNS_DIR, f), "utf8")) as RunRecord)
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

  transcript.subscribe((event) => {
    if (_currentRun === run) {
      run.events.push(event)
      if (event.type === "round_start") run.rounds = event.round
    }
  })

  return run
}

export function finishRun(status: PipelineStatus, prUrl?: string) {
  if (_currentRun) {
    _currentRun.status = status
    _currentRun.finishedAt = new Date().toISOString()
    if (prUrl) _currentRun.prUrl = prUrl
    persistRun(_currentRun)
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

app.get("/tasks", async (c) => {
  const { TASKS } = await import("../demo/index.js")
  return c.json(
    Object.entries(TASKS).map(([key, task]) => ({
      key, id: task.id, title: task.title, description: task.description,
    })),
  )
})

app.post("/task/submit", async (c) => {
  const { isPipelineRunning, runPipeline } = await import("./pipeline.js")
  const { TASKS } = await import("../demo/index.js")
  if (isPipelineRunning()) return c.json({ error: "A pipeline is already running" }, 409)
  let key: string
  try { key = (await c.req.json<{ key: string }>()).key }
  catch { return c.json({ error: "Invalid JSON body" }, 400) }
  const task = TASKS[key]
  if (!task) return c.json({ error: `Unknown task key: "${key}"` }, 404)
  runPipeline(task).catch((err) => console.error("[ASTROPHAGE] Pipeline error:", err))
  return c.json({ accepted: true, taskId: task.id }, 202)
})

app.post("/task", async (c) => {
  const { isPipelineRunning, runPipeline } = await import("./pipeline.js")
  if (isPipelineRunning()) return c.json({ error: "A pipeline is already running" }, 409)
  let task: Task
  try { task = await c.req.json<Task>() }
  catch { return c.json({ error: "Invalid JSON body" }, 400) }
  if (!task.id || !task.title || !task.description || !task.repo)
    return c.json({ error: "Missing required fields: id, title, description, repo" }, 400)
  runPipeline(task).catch((err) => console.error("[ASTROPHAGE] Pipeline error:", err))
  return c.json({ accepted: true, taskId: task.id }, 202)
})

export function startServer(port = 3001): Promise<void> {
  return new Promise((resolve) => {
    serve({ fetch: app.fetch, port, hostname: "127.0.0.1" }, () => {
      console.log(`[ASTROPHAGE] Server running at http://127.0.0.1:${port}`)
      console.log(`[ASTROPHAGE] SSE stream at http://127.0.0.1:${port}/events`)
      resolve()
    })
  })
}
