import { Hono } from "hono"
import { serve } from "@hono/node-server"
import { streamSSE } from "hono/streaming"
import { transcript } from "./transcript.js"
import type { AgentEvent } from "./types.js"

// ─── HTTP + SSE server ────────────────────────────────────────────────────────

const app = new Hono()

// CORS — allow the web UI (Vite dev server) to connect
app.use("*", async (c, next) => {
  await next()
  c.header("Access-Control-Allow-Origin", "*")
  c.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
  c.header("Access-Control-Allow-Headers", "Content-Type")
})

// Health check
app.get("/health", (c) => c.json({ status: "ok", service: "astrophage" }))

// SSE event stream — web UI subscribes here
app.get("/events", (c) => {
  return streamSSE(c, async (stream) => {
    // Send initial ping
    await stream.writeSSE({ data: JSON.stringify({ type: "connected" }), event: "ping" })

    const unsub = transcript.subscribe(async (event: AgentEvent) => {
      try {
        await stream.writeSSE({
          data: JSON.stringify(event),
          event: "agent_event",
        })
      } catch {
        // Client disconnected
      }
    })

    // Keep alive until client disconnects
    await new Promise<void>((resolve) => {
      stream.onAbort(() => {
        unsub()
        resolve()
      })
    })
  })
})

// Transcript history — for run history panel
app.get("/transcript", (c) => {
  return c.json(transcript.getAll())
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
