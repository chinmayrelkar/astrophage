import { useState, useEffect, useCallback, useRef } from "react"
import type { AgentName } from "../hooks/useAgentStream"

// ─── Types ────────────────────────────────────────────────────────────────────

export type AgentStatus = "idle" | "thinking" | "done" | "blocked"

export interface AgentState {
  name: AgentName
  status: AgentStatus
  round: number
  lastMessage: string
  lastVerdict?: string
}

export interface CommBeam {
  id: string
  from: AgentName | "orchestrator"
  to: AgentName | "orchestrator" | "all"
  message: string
  round: number
  timestamp: number
  type: "proposal" | "verdict" | "test" | "status" | "convergence"
}

export interface LogEntry {
  id: string
  timestamp: string
  agent: AgentName | "orchestrator"
  type: string
  content: string
  round: number
}

export interface TaskInfo {
  id: string
  title: string
  description: string
  repo: { remoteUrl: string; defaultBranch: string; localPath: string }
}

export interface AgentEvent {
  agent: AgentName | "orchestrator"
  type: string
  content: string
  round: number
  timestamp: string
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

const ALL_AGENTS: AgentName[] = ["pm", "architect", "coder", "reviewer", "tester", "git"]

function initialAgents(): Record<AgentName, AgentState> {
  return Object.fromEntries(
    ALL_AGENTS.map((n) => [n, { name: n, status: "idle", round: 0, lastMessage: "" }]),
  ) as Record<AgentName, AgentState>
}

export function useSpaceState() {
  const [agents, setAgents] = useState<Record<AgentName, AgentState>>(initialAgents)
  const [beams, setBeams] = useState<CommBeam[]>([])
  const [log, setLog] = useState<LogEntry[]>([])
  const [currentRound, setCurrentRound] = useState(0)
  const [connected, setConnected] = useState(false)
  const [task, setTask] = useState<TaskInfo | null>(null)
  const [runs, setRuns] = useState<Array<{ id: string; taskId: string; taskTitle: string; status: "running" | "merged" | "unresolved" | "blocked"; rounds: number; startedAt: string; finishedAt?: string; prUrl?: string }>>([])


  const beamIdRef = useRef(0)
  const logIdRef = useRef(0)

  const addBeam = useCallback((beam: Omit<CommBeam, "id" | "timestamp">) => {
    const id = `beam_${beamIdRef.current++}`
    const b: CommBeam = { ...beam, id, timestamp: Date.now() }
    setBeams((prev) => [...prev.slice(-20), b]) // keep last 20 beams
    // Auto-expire after 4s
    setTimeout(() => setBeams((prev) => prev.filter((x) => x.id !== id)), 4000)
  }, [])

  const addLog = useCallback((entry: Omit<LogEntry, "id">) => {
    const id = `log_${logIdRef.current++}`
    setLog((prev) => [...prev, { ...entry, id }])
  }, [])

  const updateAgent = useCallback((name: AgentName, update: Partial<AgentState>) => {
    setAgents((prev) => ({ ...prev, [name]: { ...prev[name], ...update } }))
  }, [])

  const handleEvent = useCallback((event: AgentEvent) => {
    const { agent, type, content, round } = event

    addLog({
      timestamp: event.timestamp,
      agent: agent as AgentName,
      type,
      content,
      round,
    })

    if (type === "round_start") {
      setCurrentRound(round)
      return
    }

    if (agent === "orchestrator") {
      if (type === "convergence") {
        addBeam({
          from: "orchestrator",
          to: "all",
          message: content,
          round,
          type: "convergence",
        })
      }
      return
    }

    const agentName = agent as AgentName

    if (type === "turn_start") {
      updateAgent(agentName, { status: "thinking", round, lastMessage: content })
      return
    }

    if (type === "turn_end") {
      updateAgent(agentName, { status: "done", lastMessage: content })

      // Determine comm direction
      if (agentName === "coder") {
        addBeam({ from: "coder", to: "reviewer", message: content.slice(0, 120), round, type: "proposal" })
      } else if (agentName === "reviewer") {
        addBeam({ from: "reviewer", to: "coder", message: content.slice(0, 120), round, type: "verdict" })
      } else if (agentName === "tester") {
        addBeam({ from: "tester", to: "coder", message: content.slice(0, 120), round, type: "test" })
      }
      return
    }

    if (type === "verdict") {
      try {
        const v = JSON.parse(content)
        const isBlock = v.nonNegotiable
        updateAgent(agentName, {
          status: isBlock ? "blocked" : v.decision === "accept" ? "done" : "thinking",
          lastVerdict: `${v.decision.toUpperCase()}${v.nonNegotiable ? " [HARD]" : ""}: ${v.reason}`,
        })
        addBeam({
          from: "reviewer",
          to: "coder",
          message: `${v.decision.toUpperCase()}: ${v.reason}`,
          round,
          type: "verdict",
        })
      } catch {
        updateAgent(agentName, { lastVerdict: content })
      }
      return
    }

    if (type === "git_action") {
      updateAgent("git", { status: "thinking", round, lastMessage: content })
      addBeam({ from: "git", to: "orchestrator", message: content, round, type: "status" })
    }
  }, [addBeam, addLog, updateAgent])

  const handleEventRef = useRef(handleEvent)
  handleEventRef.current = handleEvent

  // SSE connection
  useEffect(() => {
    const source = new EventSource("/events")
    source.onopen = () => setConnected(true)
    source.onerror = () => setConnected(false)
    source.addEventListener("ping", () => setConnected(true))
    source.addEventListener("agent_event", (e: MessageEvent) => {
      try { handleEventRef.current(JSON.parse(e.data)) } catch { }
    })
    return () => source.close()
  }, [])

  // Poll task + runs
  useEffect(() => {
    const poll = async () => {
      try {
        const [tRes, rRes] = await Promise.all([fetch("/task"), fetch("/runs")])
        if (tRes.ok) { const d = await tRes.json(); if (d) setTask(d) }
        if (rRes.ok) setRuns(await rRes.json())
      } catch { }
    }
    poll()
    const iv = setInterval(poll, 3000)
    return () => clearInterval(iv)
  }, [])

  return { agents, beams, log, currentRound, connected, task, runs }
}
