import { createOpencodeClient, createOpencodeServer } from "@opencode-ai/sdk/v2"
import type { OpencodeClient } from "@opencode-ai/sdk/v2"
import type { AgentName } from "./types.js"
import { emit } from "./transcript.js"

// ─── Model ────────────────────────────────────────────────────────────────────
export const MODEL = { providerID: "opencode", modelID: "claude-sonnet-4-6" }

// ─── Directory ────────────────────────────────────────────────────────────────
// All agent sessions point at the bawarchi repo so the model can read its files.
const DIR = "/home/ubuntu/bawarchi"

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

  // 2. TUI default port — probe with an actual session create/delete
  const tuiURL = "http://127.0.0.1:4096"
  if (await probeServer(tuiURL)) {
    console.log(`[ASTROPHAGE] Reusing existing OpenCode server at ${tuiURL}`)
    _client = createOpencodeClient({ baseUrl: tuiURL, directory: DIR })
    startEventLoop(_client)
    return _client
  }

  // 3. Spawn a dedicated server (TUI not available)
  console.log(`[ASTROPHAGE] No existing server found — spawning on port 4097...`)
  const server = await createOpencodeServer({ hostname: "127.0.0.1", port: 4097 })
  _serverClose = server.close
  console.log(`[ASTROPHAGE] OpenCode server ready at ${server.url}`)
  _client = createOpencodeClient({ baseUrl: server.url, directory: DIR })
  startEventLoop(_client)
  return _client
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
}

export interface PromptResult {
  text: string
  structured: unknown
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
    return { text: "", structured: null }
  }

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
        return { text: textParts, structured }
      }
    }
  }

  process.stdout.write("]\n")
  throw new Error(`[ASTROPHAGE] Timeout waiting for model response after ${TIMEOUT_MS}ms`)
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}
