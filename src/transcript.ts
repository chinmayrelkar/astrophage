import type { AgentEvent, AgentName, AgentEventType } from "./types.js"

// ─── Transcript: collects all events and emits them to subscribers ────────────

type Subscriber = (event: AgentEvent) => void

class Transcript {
  private events: AgentEvent[] = []
  private subscribers: Set<Subscriber> = new Set()
  private currentRound = 0

  subscribe(fn: Subscriber): () => void {
    this.subscribers.add(fn)
    // Replay history to new subscriber
    for (const event of this.events) fn(event)
    return () => this.subscribers.delete(fn)
  }

  emit(
    agent: AgentName,
    type: AgentEventType,
    content: string,
    round?: number,
  ): AgentEvent {
    const event: AgentEvent = {
      agent,
      type,
      content,
      round: round ?? this.currentRound,
      timestamp: new Date().toISOString(),
    }
    this.events.push(event)
    for (const sub of this.subscribers) sub(event)
    return event
  }

  setRound(n: number) {
    this.currentRound = n
  }

  getAll(): AgentEvent[] {
    return [...this.events]
  }

  /** Pretty-print the transcript to stdout (terminal fallback) */
  print() {
    console.log("\n" + "═".repeat(70))
    console.log("  ASTROPHAGE TRANSCRIPT")
    console.log("═".repeat(70))
    for (const e of this.events) {
      const label = `[${e.agent.toUpperCase()}]`.padEnd(14)
      const round = e.round > 0 ? `round ${e.round} ` : ""
      const type = e.type !== "token" ? `(${e.type}) ` : ""
      if (e.type === "token") {
        // Tokens are printed inline — skip duplicate printing
        continue
      }
      console.log(`${label} ${round}${type}${e.content}`)
    }
    console.log("═".repeat(70) + "\n")
  }
}

// Singleton — shared across the process
export const transcript = new Transcript()

// ─── Convenience helpers ──────────────────────────────────────────────────────

export function emit(
  agent: AgentName,
  type: AgentEventType,
  content: string,
  round?: number,
) {
  return transcript.emit(agent, type, content, round)
}

export function roundStart(n: number) {
  transcript.setRound(n)
  transcript.emit("orchestrator", "round_start", `Round ${n} starting`, n)
  console.log(`\n${"─".repeat(70)}`)
  console.log(`  ROUND ${n}`)
  console.log("─".repeat(70))
}

export function agentTurn(agent: AgentName, label: string, content: string, round?: number) {
  transcript.emit(agent, "turn_start", label, round)
  console.log(`\n[${agent.toUpperCase()}] ${label}`)
  console.log(content)
  transcript.emit(agent, "turn_end", content, round)
}
