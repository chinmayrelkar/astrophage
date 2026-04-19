import { Hono } from "hono"
import { serve } from "@hono/node-server"
import { streamSSE } from "hono/streaming"
import { transcript } from "./transcript.js"
import type { AgentEvent, PipelineStatus, RepoContext, Task } from "./types.js"

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
  startedAt: string
  finishedAt?: string
  status: PipelineStatus | "running"
  rounds: number
  events: AgentEvent[]
}

const runs: RunRecord[] = []
let _currentRun: RunRecord | null = null

export function startRun(taskId: string, taskTitle: string): RunRecord {
  const run: RunRecord = {
    id: `run_${Date.now()}`,
    taskId,
    taskTitle,
    startedAt: new Date().toISOString(),
    status: "running",
    rounds: 0,
    events: [],
  }
  _currentRun = run
  runs.push(run)

  // Attach to transcript — collect all events for this run
  transcript.subscribe((event) => {
    if (_currentRun === run) {
      run.events.push(event)
      if (event.type === "round_start") run.rounds = event.round
    }
  })

  return run
}

export function finishRun(status: PipelineStatus) {
  if (_currentRun) {
    _currentRun.status = status
    _currentRun.finishedAt = new Date().toISOString()
    _currentRun = null
  }
}

// ─── HTTP + SSE server ────────────────────────────────────────────────────────

const app = new Hono()

// CORS
app.use("*", async (c, next) => {
  await next()
  c.header("Access-Control-Allow-Origin", "*")
  c.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
  c.header("Access-Control-Allow-Headers", "Content-Type")
})

// Health
app.get("/health", (c) => c.json({ status: "ok", service: "astrophage" }))

// Current task
app.get("/task", (c) => {
  if (!_currentTask) return c.json(null)
  return c.json(_currentTask)
})

// SSE live stream
app.get("/events", (c) => {
  return streamSSE(c, async (stream) => {
    await stream.writeSSE({ data: JSON.stringify({ type: "connected" }), event: "ping" })

    const unsub = transcript.subscribe(async (event: AgentEvent) => {
      try {
        await stream.writeSSE({ data: JSON.stringify(event), event: "agent_event" })
      } catch { /* client disconnected */ }
    })

    await new Promise<void>((resolve) => {
      stream.onAbort(() => { unsub(); resolve() })
    })
  })
})

// Current transcript
app.get("/transcript", (c) => c.json(transcript.getAll()))

// All runs (summary — no events)
app.get("/runs", (c) => {
  return c.json(runs.map(({ events: _, ...r }) => r))
})

// Single run with full events
app.get("/runs/:id", (c) => {
  const run = runs.find((r) => r.id === c.req.param("id"))
  if (!run) return c.json({ error: "not found" }, 404)
  return c.json(run)
})

// Pipeline status
app.get("/status", (c) => {
  return c.json({
    running: _currentRun !== null,
    currentTask: _currentTask,
    currentRun: _currentRun ? { ...(_currentRun), events: undefined } : null,
  })
})

// List available tasks (from demo registry)
app.get("/tasks", async (c) => {
  const { TASKS } = await import("../demo/index.js")
  return c.json(
    Object.entries(TASKS).map(([key, task]) => ({
      key,
      id: task.id,
      title: task.title,
      description: task.description,
    })),
  )
})

// Submit a task by key (from demo registry)
app.post("/task/submit", async (c) => {
  const { isPipelineRunning, runPipeline } = await import("./pipeline.js")
  const { TASKS } = await import("../demo/index.js")

  if (isPipelineRunning()) {
    return c.json({ error: "A pipeline is already running" }, 409)
  }

  let key: string
  try {
    const body = await c.req.json<{ key: string }>()
    key = body.key
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400)
  }

  const task = TASKS[key]
  if (!task) {
    return c.json({ error: `Unknown task key: "${key}"` }, 404)
  }

  runPipeline(task).catch((err) => {
    console.error("[ASTROPHAGE] Background pipeline error:", err)
  })

  return c.json({ accepted: true, taskId: task.id }, 202)
})

// Submit a full task object async — pipeline runs in background
app.post("/task", async (c) => {
  const { isPipelineRunning, runPipeline } = await import("./pipeline.js")

  if (isPipelineRunning()) {
    return c.json({ error: "A pipeline is already running" }, 409)
  }

  let task: Task
  try {
    task = await c.req.json<Task>()
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400)
  }

  if (!task.id || !task.title || !task.description || !task.repo) {
    return c.json({ error: "Missing required fields: id, title, description, repo" }, 400)
  }

  // Fire and forget — pipeline runs in background
  runPipeline(task).catch((err) => {
    console.error("[ASTROPHAGE] Background pipeline error:", err)
  })

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
