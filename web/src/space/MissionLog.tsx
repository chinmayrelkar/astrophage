import { useEffect, useRef } from "react"
import { AGENT_MAP } from "./agents"
import type { LogEntry, AgentState } from "./useSpaceState"
import type { AgentName } from "../hooks/useAgentStream"

interface Props {
  log: LogEntry[]
  agents: Record<AgentName, AgentState>
  selectedAgent: AgentName | null
  onClose: () => void
}

const TYPE_LABELS: Record<string, string> = {
  turn_start: "BEGIN",
  turn_end: "DONE",
  verdict: "VERDICT",
  test_result: "TEST",
  git_action: "GIT",
  round_start: "ROUND",
  convergence: "CONVERGE",
  token: "…",
}

export function MissionLog({ log, agents, selectedAgent, onClose }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [log.length])

  const filtered = selectedAgent
    ? log.filter((e) => e.agent === selectedAgent || e.type === "round_start" || e.type === "convergence")
    : log.filter((e) => e.type !== "token")

  const agentInfo = selectedAgent ? AGENT_MAP[selectedAgent] : null
  const agentState = selectedAgent ? agents[selectedAgent] : null

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: "100%",
      background: "rgba(5,5,20,0.95)",
      borderLeft: "1px solid rgba(255,255,255,0.08)",
    }}>
      {/* Header */}
      <div style={{
        padding: "12px 16px",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        display: "flex",
        alignItems: "center",
        gap: "10px",
        flexShrink: 0,
      }}>
        {agentInfo ? (
          <>
            <span style={{ fontSize: "20px" }}>{agentInfo.emoji}</span>
            <div>
              <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
                <span style={{ fontSize: "8px", fontWeight: 700, color: agentInfo.color, letterSpacing: "0.1em", opacity: 0.7 }}>
                  {agentInfo.role}
                </span>
                <span style={{ fontWeight: 700, fontSize: "12px", color: agentInfo.color }}>
                  {agentInfo.character}
                </span>
              </div>
              <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.35)" }}>
                {agentInfo.ship} · {agentInfo.description}
              </div>
            </div>
            {agentState?.lastVerdict && (
              <div style={{
                marginLeft: "auto",
                fontSize: "9px",
                color: agentState.lastVerdict.startsWith("ACCEPT") ? "#00ff87" : "#f87171",
                maxWidth: "120px",
                textAlign: "right",
                lineHeight: 1.3,
              }}>
                {agentState.lastVerdict}
              </div>
            )}
          </>
        ) : (
          <span style={{ fontWeight: 700, fontSize: "11px", letterSpacing: "0.1em", color: "rgba(255,255,255,0.7)" }}>
            MISSION LOG
          </span>
        )}
        <button
          onClick={onClose}
          style={{
            marginLeft: agentInfo ? "8px" : "auto",
            background: "none",
            border: "none",
            color: "rgba(255,255,255,0.3)",
            cursor: "pointer",
            fontSize: "16px",
            lineHeight: 1,
            padding: "0 2px",
            flexShrink: 0,
          }}
        >×</button>
      </div>

      {/* Log entries */}
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
        {filtered.length === 0 ? (
          <div style={{ padding: "20px 16px", color: "rgba(255,255,255,0.2)", fontSize: "10px" }}>
            no transmissions yet
          </div>
        ) : (
          filtered.map((entry) => {
            const char = entry.agent !== "orchestrator" ? AGENT_MAP[entry.agent as AgentName] : null
            const color = char?.color ?? "#a78bfa"
            const isVerdict = entry.type === "verdict"
            const isConverge = entry.type === "convergence"
            const isRound = entry.type === "round_start"

            if (isRound) {
              return (
                <div key={entry.id} style={{
                  padding: "4px 16px",
                  margin: "4px 0",
                  borderTop: "1px solid rgba(255,255,255,0.06)",
                  borderBottom: "1px solid rgba(255,255,255,0.06)",
                  fontSize: "9px",
                  color: "rgba(255,255,255,0.3)",
                  letterSpacing: "0.1em",
                  textAlign: "center",
                }}>
                  ── {entry.content} ──
                </div>
              )
            }

            let displayContent = entry.content
            if (isVerdict) {
              try {
                const v = JSON.parse(entry.content)
                displayContent = `${v.decision.toUpperCase()}${v.nonNegotiable ? " [HARD BLOCK]" : ""}: ${v.reason}`
              } catch { }
            }

            return (
              <div key={entry.id} style={{
                padding: "5px 16px",
                display: "flex",
                gap: "8px",
                alignItems: "flex-start",
                borderLeft: isConverge ? `2px solid ${color}` : "2px solid transparent",
                background: isConverge ? "rgba(167,139,250,0.05)" : "transparent",
              }}>
                {/* Agent emoji */}
                <span style={{ fontSize: "11px", flexShrink: 0, marginTop: "1px" }}>
                  {char?.emoji ?? "🌌"}
                </span>
                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", gap: "6px", alignItems: "center", marginBottom: "2px" }}>
                    {char?.role && (
                      <span style={{ fontSize: "7px", color, fontWeight: 700, letterSpacing: "0.08em", opacity: 0.6 }}>
                        {char.role}
                      </span>
                    )}
                    <span style={{ fontSize: "9px", color, fontWeight: 700 }}>
                      {char?.character ?? "MISSION CTRL"}
                    </span>
                    <span style={{
                      fontSize: "8px",
                      padding: "1px 4px",
                      background: "rgba(255,255,255,0.06)",
                      borderRadius: "2px",
                      color: "rgba(255,255,255,0.3)",
                      letterSpacing: "0.05em",
                    }}>
                      {TYPE_LABELS[entry.type] ?? entry.type.toUpperCase()}
                    </span>
                    {entry.round > 0 && (
                      <span style={{ fontSize: "8px", color: "rgba(255,255,255,0.2)" }}>
                        r{entry.round}
                      </span>
                    )}
                    <span style={{ marginLeft: "auto", fontSize: "8px", color: "rgba(255,255,255,0.15)" }}>
                      {new Date(entry.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </span>
                  </div>
                  <div style={{
                    fontSize: "10px",
                    color: isConverge
                      ? (displayContent.startsWith("ACCEPT") ? "#00ff87" : "#f87171")
                      : isVerdict
                      ? (displayContent.startsWith("ACCEPT") ? "#00ff87" : "#fbbf24")
                      : "rgba(255,255,255,0.55)",
                    lineHeight: 1.5,
                    wordBreak: "break-word",
                  }}>
                    {displayContent.slice(0, 300)}{displayContent.length > 300 ? "…" : ""}
                  </div>
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
