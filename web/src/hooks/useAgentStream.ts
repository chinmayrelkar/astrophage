import { useEffect, useState, useCallback, useRef } from "react"
import { apiUrl } from "../api"

// ─── Types (mirrored from orchestrator/src/types.ts) ─────────────────────────

export type AgentName =
  | "pm" | "architect" | "coder" | "reviewer" | "tester" | "scout" | "product" | "orchestrator"

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
  lines: string[]
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
    scout: "var(--agent-git)",
    product: "var(--agent-pm)",
    orchestrator: "var(--agent-orch)",
  }
  return map[name]
}

export { agentColor }

const ALL_AGENTS: AgentName[] = ["pm", "architect", "coder", "reviewer", "tester", "scout", "product", "orchestrator"]

function initialState(): Record<AgentName, AgentState> {
  const state: Partial<Record<AgentName, AgentState>> = {}
  for (const name of ALL_AGENTS) {
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

  const handleEvent = useCallback((event: AgentEvent) => {
    setEvents((prev) => [...prev, event])

    const { agent, type, content, round } = event

    if (type === "round_start") {
      setCurrentRound(round)
      return
    }

    // turn_start: mark agent as thinking AND show the label as a line
    if (type === "turn_start") {
      setAgents((prev) => ({
        ...prev,
        [agent]: {
          ...prev[agent],
          status: "thinking",
          round,
          lines: content ? [...prev[agent].lines, `▶ ${content}`] : prev[agent].lines,
        },
      }))
      return
    }

    // turn_end: mark done and show the full content
    if (type === "turn_end") {
      setAgents((prev) => ({
        ...prev,
        [agent]: {
          ...prev[agent],
          status: "done",
          round,
          lines: content ? [...prev[agent].lines, content] : prev[agent].lines,
        },
      }))
      return
    }

    if (type === "verdict") {
      try {
        const v = JSON.parse(content)
        const isBlock = v.nonNegotiable
        setAgents((prev) => ({
          ...prev,
          [agent]: {
            ...prev[agent],
            status: isBlock ? "blocked" : v.decision === "accept" ? "done" : "thinking",
            lastVerdict: `${v.decision.toUpperCase()}${v.nonNegotiable ? " [HARD]" : ""}: ${v.reason}`,
          },
        }))
      } catch {
        setAgents((prev) => ({
          ...prev,
          [agent]: { ...prev[agent], lastVerdict: content },
        }))
      }
      return
    }

    if (type === "convergence") {
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

    if (type === "git_action") {
      setAgents((prev) => {
        const current = prev[agent]
        if (!current) return prev
        return {
          ...prev,
          [agent]: { ...current, status: "thinking", round, lines: [...current.lines, content] },
        }
      })
    }
  }, [])

  const handleEventRef = useRef(handleEvent)
  handleEventRef.current = handleEvent

  useEffect(() => {
    const source = new EventSource(apiUrl("/events"))

    // onopen fires before any messages — safe place to mark connected
    source.onopen = () => setConnected(true)
    source.onerror = () => setConnected(false)

    // ping is sent as the first SSE event — also mark connected here
    // in case onopen already fired and we missed it
    source.addEventListener("ping", () => setConnected(true))

    source.addEventListener("agent_event", (e: MessageEvent) => {
      try {
        const event: AgentEvent = JSON.parse(e.data)
        handleEventRef.current(event)
      } catch {
        // ignore malformed events
      }
    })

    return () => source.close()
  }, [])

  return { agents, currentRound, events, connected }
}
