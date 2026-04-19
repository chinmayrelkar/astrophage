import { createOpencodeClient, createOpencodeServer } from "@opencode-ai/sdk/v2"
import type { OpencodeClient } from "@opencode-ai/sdk/v2"

// ─── Shared OpenCode client ───────────────────────────────────────────────────
//
// If a server is already running (e.g. the opencode TUI session that launched
// this process), connect to it directly. Otherwise start a fresh server.

const DEFAULT_URL = "http://127.0.0.1:4096"

async function probe(url: string): Promise<boolean> {
  try {
    const res = await fetch(`${url}/v2/app`, { signal: AbortSignal.timeout(1500) })
    return res.ok || res.status === 401
  } catch {
    return false
  }
}

let _client: OpencodeClient | null = null
let _serverClose: (() => void) | null = null

export async function getClient(): Promise<OpencodeClient> {
  if (_client) return _client

  const dir = process.cwd()

  // 1. Check if the TUI injected a server URL
  const envURL = process.env["OPENCODE_SERVER_URL"]
  if (envURL) {
    console.log(`[ASTROPHAGE] Connecting to existing OpenCode server at ${envURL} (dir: ${dir})`)
    _client = createOpencodeClient({ baseUrl: envURL, directory: dir })
    return _client
  }

  // 2. Probe the default port
  if (await probe(DEFAULT_URL)) {
    console.log(`[ASTROPHAGE] Connecting to existing OpenCode server at ${DEFAULT_URL} (dir: ${dir})`)
    _client = createOpencodeClient({ baseUrl: DEFAULT_URL, directory: dir })
    return _client
  }

  // 3. Spawn a new server
  console.log(`[ASTROPHAGE] No existing server found — starting OpenCode server...`)
  const server = await createOpencodeServer({ hostname: "127.0.0.1" })
  _serverClose = server.close
  console.log(`[ASTROPHAGE] OpenCode server started at ${server.url}`)
  _client = createOpencodeClient({ baseUrl: server.url, directory: dir })
  return _client
}

export function closeServer() {
  _serverClose?.()
  _serverClose = null
  _client = null
}

// ─── promptAndWait ────────────────────────────────────────────────────────────
//
// The v2 SDK session.prompt() returns {} immediately — the model response
// streams asynchronously via SSE events.
//
// This helper:
//   1. Opens the global SSE event stream
//   2. Fires prompt (async fire-and-forget)
//   3. Waits for session.idle (completion) or session.error
//   4. Fetches the final message list and returns the last assistant message parts

export interface PromptParams {
  sessionID: string
  parts: Array<{ type: "text"; text: string }>
  format?: {
    type: "json_schema"
    schema: Record<string, unknown>
  }
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
  // noReply = system injection only, no model response needed
  if (params.noReply) {
    await client.session.prompt({
      sessionID: params.sessionID,
      noReply: true,
      parts: params.parts,
    })
    return { text: "", structured: null }
  }

  // Subscribe to events before sending — avoids a race where idle fires
  // before we start listening
  const eventsResult = await client.event.subscribe()
  const { stream } = eventsResult

  if (!stream) throw new Error("[ASTROPHAGE] Could not open event stream")

  // Fire the prompt (returns {} immediately)
  await client.session.prompt({
    sessionID: params.sessionID,
    parts: params.parts,
    ...(params.format ? { format: params.format } : {}),
  })

  // Drain the async generator until session.idle or session.error for OUR session
  process.stdout.write(`  [waiting for model`)
  let dots = 0
  for await (const event of stream) {
    const e = event as { type?: string; properties?: Record<string, unknown> }
    if (!e?.type) continue

    // Progress indicator
    if (dots % 5 === 0) process.stdout.write(".")
    dots++

    if (e.type === "session.idle") {
      const props = e.properties ?? {}
      if (props["sessionID"] === params.sessionID) {
        process.stdout.write("]\n")
        break
      }
    }

    if (e.type === "session.error") {
      const props = e.properties ?? {}
      if (props["sessionID"] === params.sessionID) {
        process.stdout.write("]\n")
        const err = props["error"] as { message?: string } | undefined
        throw new Error(`Session error: ${err?.message ?? JSON.stringify(props)}`)
      }
    }
  }

  // Fetch the last assistant message
  const msgs = await client.session.messages({
    sessionID: params.sessionID,
    limit: 5,
  })

  const messages = msgs.data ?? []
  // Last assistant message
  const last = [...messages].reverse().find(
    (m: { info: { role: string }; parts: unknown[] }) => m.info.role === "assistant",
  )

  if (!last) return { text: "", structured: null }

  const textParts = (last.parts as Array<{ type: string; text?: string }>)
    .filter((p) => p.type === "text")
    .map((p) => p.text ?? "")
    .join("")

  // Structured output lives on the message info
  const structured =
    (last.info as Record<string, unknown>)["structured"] ?? null

  return { text: textParts, structured }
}
