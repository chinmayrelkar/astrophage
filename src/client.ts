import { createOpencodeClient, createOpencodeServer } from "@opencode-ai/sdk/v2"
import type { OpencodeClient } from "@opencode-ai/sdk/v2"

// ─── Shared OpenCode client ───────────────────────────────────────────────────
//
// If a server is already running (e.g. the opencode TUI session that launched
// this process), connect to it directly. Otherwise start a fresh server.
//
// Priority order for server URL:
//   1. OPENCODE_SERVER_URL env var (set by opencode TUI automatically)
//   2. Probe well-known default port 4096
//   3. Spawn a new server

const DEFAULT_URL = "http://127.0.0.1:4096"

async function probe(url: string): Promise<boolean> {
  try {
    const res = await fetch(`${url}/v2/app`, { signal: AbortSignal.timeout(1000) })
    return res.ok || res.status === 401
  } catch {
    return false
  }
}

let _client: OpencodeClient | null = null
let _serverClose: (() => void) | null = null

export async function getClient(): Promise<OpencodeClient> {
  if (_client) return _client

  // 1. Check if the TUI injected a server URL
  const envURL = process.env["OPENCODE_SERVER_URL"]
  if (envURL) {
    console.log(`[ASTROPHAGE] Connecting to existing OpenCode server at ${envURL}`)
    _client = createOpencodeClient({ baseUrl: envURL })
    return _client
  }

  // 2. Probe the default port
  if (await probe(DEFAULT_URL)) {
    console.log(`[ASTROPHAGE] Connecting to existing OpenCode server at ${DEFAULT_URL}`)
    _client = createOpencodeClient({ baseUrl: DEFAULT_URL })
    return _client
  }

  // 3. Spawn a new server
  console.log(`[ASTROPHAGE] No existing server found — starting OpenCode server...`)
  const server = await createOpencodeServer({ hostname: "127.0.0.1" })
  _serverClose = server.close
  console.log(`[ASTROPHAGE] OpenCode server started at ${server.url}`)
  _client = createOpencodeClient({ baseUrl: server.url })
  return _client
}

export function closeServer() {
  _serverClose?.()
  _serverClose = null
  _client = null
}
