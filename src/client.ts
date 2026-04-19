import { createOpencodeClient, createOpencodeServer } from "@opencode-ai/sdk/v2"
import type { OpencodeClient } from "@opencode-ai/sdk/v2"
import type { AgentName } from "./types.js"
import { emit } from "./transcript.js"
import { startTurn, endTurn, recordDelta, type TurnStats } from "./token-tracker.js"

// ─── Model ────────────────────────────────────────────────────────────────────
export const MODEL = { providerID: "opencode", modelID: "claude-sonnet-4-6" }

// ─── Directory ────────────────────────────────────────────────────────────────
// All agent sessions use this as their working directory.
// Set once per pipeline run via setWorkingDirectory() before agents start.
let DIR = "/home/ubuntu/bawarchi"

/** Set the working directory for all subsequent OpenCode sessions. */
export function setWorkingDirectory(path: string) {
  DIR = path
  // Force re-creation of the client with the new directory on next getClient() call
  if (_client) {
    _client = null
  }
}

// ─── Shared OpenCode client ───────────────────────────────────────────────────
//
// The OpenCode TUI at port 4096 IS the API server — it routes requests to
// per-directory worker instances via the x-opencode-directory header.
// The v2 SDK's createOpencodeClient handles that header via the `directory` option.
//
// We probe by creating a session and immediately deleting it — if it returns
// a valid session ID the server is live and routing correctly.
// Only fall back to spawning a new server if the TUI is not available.

let _client: OpencodeClient | null = null
let _serverClose: (() => void) | null = null

// ─── Session registry ─────────────────────────────────────────────────────────
// Maps OpenCode sessionID → AgentName so the event loop can attribute tokens.

const _sessionRegistry = new Map<string, AgentName>()

export function registerSession(sessionID: string, agent: AgentName): void {
  _sessionRegistry.set(sessionID, agent)
}

export function unregisterSession(sessionID: string): void {
  _sessionRegistry.delete(sessionID)
}

// ─── Background event subscription loop ──────────────────────────────────────
// Subscribes to the OpenCode global event stream and forwards token deltas to
// the Astrophage transcript. Runs as a fire-and-forget background coroutine.

let _eventLoopStarted = false

function startEventLoop(client: OpencodeClient): void {
  if (_eventLoopStarted) return
  _eventLoopStarted = true

  void (async () => {
    while (true) {
      try {
        const { stream } = await client.event.subscribe()
        for await (const event of stream) {
          if (event.type !== "message.part.delta") continue
          const props = event.properties
          const agentName = _sessionRegistry.get(props.sessionID)
          if (!agentName) continue
          // Only forward text field deltas (not tool input etc.)
          if (props.field !== "text") continue
          recordDelta(props.sessionID, props.delta)
          emit(agentName, "token", props.delta, 0)
        }
      } catch (err) {
        console.error("[ASTROPHAGE] Event stream error, reconnecting in 2s:", err)
        await sleep(2_000)
      }
    }
  })()
}

async function probeServer(baseUrl: string): Promise<boolean> {
  try {
    const client = createOpencodeClient({ baseUrl, directory: DIR })
    const res = await client.session.create({ title: "astrophage-probe" })
    const id = res.data?.id
    if (!id) return false
    // Clean up immediately
    await client.session.delete({ sessionID: id }).catch(() => {})
    return true
  } catch {
    return false
  }
}

// Candidate ports to probe before spawning a fresh server.
//  - 4096: opencode TUI default
//  - 4097: Astrophage's own default spawn port — may still be live from a
//    previous run when the parent crashed without closing it. Reuse over spawn.
const PROBE_PORTS = [4096, 4097]

export async function getClient(): Promise<OpencodeClient> {
  if (_client) return _client

  // 1. OPENCODE_SERVER_URL injected by the TUI when running inside opencode
  const envURL = process.env["OPENCODE_SERVER_URL"]
  if (envURL) {
    console.log(`[ASTROPHAGE] Using OPENCODE_SERVER_URL: ${envURL}`)
    _client = createOpencodeClient({ baseUrl: envURL, directory: DIR })
    startEventLoop(_client)
    return _client
  }

  // 2. Probe every candidate port for a live, working OpenCode server.
  //    Only loopback binds count — if the TUI is bound to a non-loopback IP
  //    (e.g. Tailscale only), probeServer will correctly fail here.
  for (const port of PROBE_PORTS) {
    const url = `http://127.0.0.1:${port}`
    if (await probeServer(url)) {
      console.log(`[ASTROPHAGE] Reusing existing OpenCode server at ${url}`)
      _client = createOpencodeClient({ baseUrl: url, directory: DIR })
      startEventLoop(_client)
      return _client
    }
  }

  // 3. Spawn a dedicated server. Try 4097 first for discoverability, then fall
  //    back to an ephemeral port if it's already bound (stale process, other
  //    service, etc.) so we don't wedge the autonomous loop.
  const spawnPorts = [4097, 0] // 0 = OS-assigned ephemeral
  let lastErr: unknown = null
  for (const port of spawnPorts) {
    try {
      console.log(`[ASTROPHAGE] No existing server found — spawning on ${port === 0 ? "ephemeral port" : `port ${port}`}...`)
      const server = await createOpencodeServer({ hostname: "127.0.0.1", port })
      _serverClose = server.close
      console.log(`[ASTROPHAGE] OpenCode server ready at ${server.url}`)
      _client = createOpencodeClient({ baseUrl: server.url, directory: DIR })
      startEventLoop(_client)
      return _client
    } catch (err) {
      lastErr = err
      const msg = String(err)
      // If the port collides, try the next candidate; otherwise bail immediately.
      if (!/EADDRINUSE|Failed to start server|address already in use/i.test(msg)) break
      console.warn(`[ASTROPHAGE] Spawn on port ${port} failed (${msg.split("\n")[0]}); trying next...`)
    }
  }
  throw new Error(`[ASTROPHAGE] Could not acquire an OpenCode server: ${String(lastErr)}`)
}

export function closeServer() {
  // Only close if we spawned it — don't shut down the user's TUI
  _serverClose?.()
  _serverClose = null
  _client = null
  _eventLoopStarted = false
}

// ─── promptAndWait ────────────────────────────────────────────────────────────
// Fires session.prompt then polls session.messages until the new assistant
// message appears. Polling avoids the SSE race where session.idle fires before
// the stream consumer connects.

export interface PromptParams {
  sessionID: string
  parts: Array<{ type: "text"; text: string }>
  format?: { type: "json_schema"; schema: Record<string, unknown> }
  noReply?: boolean
  /** Round number, used for token tracking */
  round?: number
}

export interface PromptResult {
  text: string
  structured: unknown
  turnStats: TurnStats | null
}

export async function promptAndWait(
  client: OpencodeClient,
  params: PromptParams,
): Promise<PromptResult> {
  if (params.noReply) {
    await client.session.prompt({
      sessionID: params.sessionID,
      noReply: true,
      parts: params.parts,
    })
    return { text: "", structured: null, turnStats: null }
  }

  // Start tracking this turn
  const agentName = _sessionRegistry.get(params.sessionID) ?? "orchestrator"
  const round = params.round ?? 0
  const inputText = params.parts.map((p) => p.text).join("\n")
  startTurn(params.sessionID, agentName, round)

  // Count messages before so we know when a new one arrives
  const before = await client.session.messages({ sessionID: params.sessionID, limit: 20 })
  const beforeCount = (before.data ?? []).length

  // Fire prompt
  await client.session.prompt({
    sessionID: params.sessionID,
    parts: params.parts,
    model: MODEL,
    ...(params.format ? { format: params.format } : {}),
  })

  // Poll until a completed assistant message appears
  process.stdout.write(`  [waiting for model`)
  const POLL_MS = 500
  const TIMEOUT_MS = 180_000
  const start = Date.now()

  while (Date.now() - start < TIMEOUT_MS) {
    await sleep(POLL_MS)
    process.stdout.write(".")

    const res = await client.session.messages({ sessionID: params.sessionID, limit: 20 })
    const messages = res.data ?? []

    if (messages.length > beforeCount) {
      // Find the last assistant message that has a step-finish (i.e. model is done)
      const last = [...messages].reverse().find(
        (m: { info: { role: string }; parts: unknown[] }) => {
          if (m.info.role !== "assistant") return false
          const parts = m.parts as Array<{ type: string; text?: string; reason?: string }>
          return parts.some((p) => p.type === "step-finish" && p.reason === "stop")
        },
      )
      if (last) {
        process.stdout.write("]\n")
        const textParts = (last.parts as Array<{ type: string; text?: string }>)
          .filter((p) => p.type === "text")
          .map((p) => p.text ?? "")
          .join("")
        const structured = (last.info as Record<string, unknown>)["structured"] ?? null

        // End turn tracking — capture stats to wire into trace spans
        const turnStats = endTurn(params.sessionID, inputText)

        return { text: textParts, structured, turnStats }
      }
    }
  }

  process.stdout.write("]\n")
  endTurn(params.sessionID, inputText)
  throw new Error(`[ASTROPHAGE] Timeout waiting for model response after ${TIMEOUT_MS}ms`)
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}
