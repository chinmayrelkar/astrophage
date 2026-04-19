import { useEffect, useState, useCallback, useRef } from "react"

// ─── Types (mirrored from orchestrator/src/types.ts) ─────────────────────────

export type AgentName =
  | "pm" | "architect" | "coder" | "reviewer" | "tester" | "git" | "orchestrator"

export type AgentEventType =
  | "token" | "turn_start" | "turn_end" | "test_result"
  | "verdict" | "git_action" | "round_start" | "convergence"

export interface AgentEvent {
  agent: AgentName
  type: AgentEventType
  content: string
  round: number
  timestamp: string
}

export type AgentStatus = "idle" | "thinking" | "done" | "blocked"

export interface AgentState {
  name: AgentName
  status: AgentStatus
  lines: string[]      // accumulated content lines
  lastVerdict?: string
  round: number
}

function agentColor(name: AgentName): string {
  const map: Record<AgentName, string> = {
    pm: "var(--agent-pm)",
    architect: "var(--agent-arch)",
    coder: "var(--agent-coder)",
    reviewer: "var(--agent-reviewer)",
    tester: "var(--agent-tester)",
    git: "var(--agent-git)",
    orchestrator: "var(--agent-orch)",
  }
  return map[name]
}

export { agentColor }

const AGENT_NAMES: AgentName[] = ["pm", "architect", "coder", "reviewer", "tester", "git"]

function initialState(): Record<AgentName, AgentState> {
  const state: Partial<Record<AgentName, AgentState>> = {}
  for (const name of [...AGENT_NAMES, "orchestrator" as AgentName]) {
    state[name] = { name, status: "idle", lines: [], round: 0 }
  }
  return state as Record<AgentName, AgentState>
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAgentStream() {
  const [agents, setAgents] = useState<Record<AgentName, AgentState>>(initialState)
  const [currentRound, setCurrentRound] = useState(0)
  const [events, setEvents] = useState<AgentEvent[]>([])
  const [connected, setConnected] = useState(false)

  // Stable updater — always uses functional setState so no stale closure on agents
  const updateAgent = useCallback((name: AgentName, update: Partial<AgentState>) => {
    setAgents((prev) => ({
      ...prev,
      [name]: { ...prev[name], ...update },
    }))
  }, [])

  // handleEvent never closes over agents state — all mutations go through
  // functional setState updaters that receive fresh prev state.
  const handleEvent = useCallback(
    (event: AgentEvent) => {
      setEvents((prev) => [...prev, event])

      const { agent, type, content, round } = event

      if (type === "round_start") {
        setCurrentRound(round)
        return
      }

      if (type === "turn_start") {
        updateAgent(agent, { status: "thinking", round })
        return
      }

      if (type === "turn_end") {
        // Single functional setState — appends content to existing lines
        setAgents((prev) => ({
          ...prev,
          [agent]: {
            ...prev[agent],
            status: "done",
            round,
            lines: [...prev[agent].lines, content],
          },
        }))
        return
      }

      if (type === "verdict") {
        try {
          const v = JSON.parse(content)
          const isBlock = v.nonNegotiable
          updateAgent(agent, {
            status: isBlock ? "blocked" : v.decision === "accept" ? "done" : "thinking",
            lastVerdict: `${v.decision.toUpperCase()}${v.nonNegotiable ? " [HARD]" : ""}: ${v.reason}`,
          })
        } catch {
          updateAgent(agent, { lastVerdict: content })
        }
        return
      }

      if (type === "convergence") {
        // Use functional setState to avoid stale closure on orchestrator lines
        setAgents((prev) => ({
          ...prev,
          orchestrator: {
            ...prev.orchestrator,
            status: content.startsWith("ACCEPT") ? "done" : "blocked",
            lines: [...prev.orchestrator.lines, content],
          },
        }))
        return
      }

      if (type === "token") {
        setAgents((prev) => ({
          ...prev,
          [agent]: {
            ...prev[agent],
            status: "thinking",
            round,
            lines: [...prev[agent].lines, content],
          },
        }))
      }
    },
    [updateAgent], // no longer depends on agents — all reads go through prev
  )

  // Stable ref to handleEvent so the EventSource listener is set up once
  // and always calls the latest version without recreating the source.
  const handleEventRef = useRef(handleEvent)
  handleEventRef.current = handleEvent

  useEffect(() => {
    const source = new EventSource("/events")

    source.addEventListener("ping", () => setConnected(true))
    source.addEventListener("agent_event", (e: MessageEvent) => {
      try {
        const event: AgentEvent = JSON.parse(e.data)
        handleEventRef.current(event)
      } catch {
        // ignore malformed events
      }
    })

    source.onerror = () => setConnected(false)
    source.onopen = () => setConnected(true)

    return () => source.close()
  }, []) // stable: EventSource created once, ref always points to latest handler

  return { agents, currentRound, events, connected }
}
