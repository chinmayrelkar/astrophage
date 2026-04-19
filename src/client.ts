import { createOpencodeClient, createOpencodeServer } from "@opencode-ai/sdk/v2"
import type { OpencodeClient } from "@opencode-ai/sdk/v2"

// ─── Model ────────────────────────────────────────────────────────────────────
export const MODEL = { providerID: "opencode", modelID: "claude-sonnet-4-6" }

// ─── Shared OpenCode client ───────────────────────────────────────────────────
// Points at the bawarchi repo so agents can read/edit its files directly.
//
// Reuses the existing OpenCode server if one is running and responding with
// JSON (i.e. it's the API server, not the TUI web app which returns HTML).
// Falls back to spawning a dedicated server on port 4097.

const DIR = "/home/ubuntu/bawarchi"

let _client: OpencodeClient | null = null
let _serverClose: (() => void) | null = null

async function probeApiServer(url: string): Promise<boolean> {
  try {
    const res = await fetch(`${url}/v2/app`, { signal: AbortSignal.timeout(1500) })
    const ct = res.headers.get("content-type") ?? ""
    return ct.includes("application/json")
  } catch {
    return false
  }
}

export async function getClient(): Promise<OpencodeClient> {
  if (_client) return _client

  // 1. Check env var set by opencode TUI
  const envURL = process.env["OPENCODE_SERVER_URL"]
  if (envURL && await probeApiServer(envURL)) {
    console.log(`[ASTROPHAGE] Reusing existing OpenCode server at ${envURL}`)
    _client = createOpencodeClient({ baseUrl: envURL, directory: DIR })
    return _client
  }

  // 2. Probe default port — but only accept if it responds with JSON
  const defaultURL = "http://127.0.0.1:4096"
  if (await probeApiServer(defaultURL)) {
    console.log(`[ASTROPHAGE] Reusing existing OpenCode server at ${defaultURL}`)
    _client = createOpencodeClient({ baseUrl: defaultURL, directory: DIR })
    return _client
  }

  // 3. Spawn dedicated server on 4097 (TUI is on 4096, won't conflict)
  console.log(`[ASTROPHAGE] Starting dedicated OpenCode server (dir: ${DIR})...`)
  const server = await createOpencodeServer({ hostname: "127.0.0.1", port: 4097 })
  _serverClose = server.close
  console.log(`[ASTROPHAGE] OpenCode server ready at ${server.url}`)
  _client = createOpencodeClient({ baseUrl: server.url, directory: DIR })
  return _client
}

export function closeServer() {
  _serverClose?.()
  _serverClose = null
  _client = null
}

// ─── promptAndWait ────────────────────────────────────────────────────────────
// Fires session.prompt then polls session.messages until the assistant message
// appears. Avoids SSE timing race where session.idle fires before the stream
// consumer is connected.

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

  // Get message count before prompt so we know when a new one appears
  const before = await client.session.messages({ sessionID: params.sessionID, limit: 20 })
  const beforeCount = (before.data ?? []).length

  // Fire the prompt
  await client.session.prompt({
    sessionID: params.sessionID,
    parts: params.parts,
    model: MODEL,
    ...(params.format ? { format: params.format } : {}),
  })

  // Poll until a new assistant message appears (completed = has text parts)
  process.stdout.write(`  [waiting for model`)
  const POLL_MS = 500
  const TIMEOUT_MS = 120_000
  const start = Date.now()

  while (Date.now() - start < TIMEOUT_MS) {
    await sleep(POLL_MS)
    process.stdout.write(".")

    const res = await client.session.messages({ sessionID: params.sessionID, limit: 20 })
    const messages = res.data ?? []

    if (messages.length > beforeCount) {
      // Find the last assistant message with text content
      const last = [...messages].reverse().find(
        (m: { info: { role: string }; parts: unknown[] }) => {
          if (m.info.role !== "assistant") return false
          const parts = m.parts as Array<{ type: string; text?: string }>
          return parts.some((p) => p.type === "text" && (p.text ?? "").length > 0)
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
