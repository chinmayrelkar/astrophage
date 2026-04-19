// ─── Token & Cost Tracker ──────────────────────────────────────────────────────
// Tracks token usage and estimated cost per agent turn.
// Claude Sonnet pricing: $3/M input tokens, $15/M output tokens
// Char-to-token estimate: ~4 chars per token

const INPUT_COST_PER_M = 3.0   // USD per million input tokens
const OUTPUT_COST_PER_M = 15.0  // USD per million output tokens
const CHARS_PER_TOKEN = 4

export interface TurnStats {
  sessionID: string
  agent: string
  round: number
  turnIndex: number
  inputTokens: number
  outputTokens: number
  estimatedCostUSD: number
  durationMs: number
  startTime: string
  endTime: string
}

// ─── In-memory store ──────────────────────────────────────────────────────────

// All completed turn stats
const _stats: TurnStats[] = []

// Active turn accumulator: sessionID → tracking state
interface ActiveTurn {
  sessionID: string
  agent: string
  round: number
  turnIndex: number
  outputCharCount: number
  startMs: number
  startTime: string
}

const _activeTurns = new Map<string, ActiveTurn>()

// Per-session turn counter (how many turns have been completed for this session)
const _turnCounters = new Map<string, number>()

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Start tracking a new agent turn.
 * Call this when a prompt is fired.
 */
export function startTurn(sessionID: string, agent: string, round: number): void {
  const prev = _turnCounters.get(sessionID) ?? 0
  const turnIndex = prev + 1
  _turnCounters.set(sessionID, turnIndex)

  _activeTurns.set(sessionID, {
    sessionID,
    agent,
    round,
    turnIndex,
    outputCharCount: 0,
    startMs: Date.now(),
    startTime: new Date().toISOString(),
  })
}

/**
 * Accumulate output characters from a token delta for a session.
 */
export function recordDelta(sessionID: string, deltaText: string): void {
  const active = _activeTurns.get(sessionID)
  if (!active) return
  active.outputCharCount += deltaText.length
}

/**
 * End tracking a turn and record stats.
 * @param sessionID  the OpenCode session
 * @param inputText  the full prompt text (used for input token estimate)
 */
export function endTurn(sessionID: string, inputText: string): TurnStats | null {
  const active = _activeTurns.get(sessionID)
  if (!active) return null

  _activeTurns.delete(sessionID)

  const endMs = Date.now()
  const durationMs = endMs - active.startMs

  const inputTokens = Math.ceil(inputText.length / CHARS_PER_TOKEN)
  const outputTokens = Math.ceil(active.outputCharCount / CHARS_PER_TOKEN)

  const estimatedCostUSD =
    (inputTokens / 1_000_000) * INPUT_COST_PER_M +
    (outputTokens / 1_000_000) * OUTPUT_COST_PER_M

  const stats: TurnStats = {
    sessionID,
    agent: active.agent,
    round: active.round,
    turnIndex: active.turnIndex,
    inputTokens,
    outputTokens,
    estimatedCostUSD,
    durationMs,
    startTime: active.startTime,
    endTime: new Date().toISOString(),
  }

  _stats.push(stats)
  return stats
}

// ─── Query helpers ────────────────────────────────────────────────────────────

export function getTokenStats(): TurnStats[] {
  return [..._stats]
}

export function getTotalCost(): number {
  return _stats.reduce((sum, s) => sum + s.estimatedCostUSD, 0)
}

export function getStatsByAgent(): Record<string, {
  inputTokens: number
  outputTokens: number
  estimatedCostUSD: number
  durationMs: number
  turns: number
}> {
  const byAgent: Record<string, {
    inputTokens: number
    outputTokens: number
    estimatedCostUSD: number
    durationMs: number
    turns: number
  }> = {}

  for (const s of _stats) {
    if (!byAgent[s.agent]) {
      byAgent[s.agent] = {
        inputTokens: 0,
        outputTokens: 0,
        estimatedCostUSD: 0,
        durationMs: 0,
        turns: 0,
      }
    }
    const a = byAgent[s.agent]!
    a.inputTokens += s.inputTokens
    a.outputTokens += s.outputTokens
    a.estimatedCostUSD += s.estimatedCostUSD
    a.durationMs += s.durationMs
    a.turns++
  }

  return byAgent
}

/** Clear all stats (used between pipeline runs) */
export function clearTokenStats(): void {
  _stats.length = 0
  _activeTurns.clear()
  _turnCounters.clear()
}
