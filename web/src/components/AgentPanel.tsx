import React, { useEffect, useRef } from "react"
import type { AgentName, AgentState } from "../hooks/useAgentStream"
import { agentColor } from "../hooks/useAgentStream"

interface Props {
  agent: AgentState
  label: string
}

const STATUS_LABELS: Record<string, string> = {
  idle: "idle",
  thinking: "active",
  done: "done",
  blocked: "blocked",
}

export function AgentPanel({ agent, label }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const color = agentColor(agent.name as AgentName)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [agent.lines])

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        background: "var(--bg-panel)",
        border: "1px solid var(--bg-border)",
        borderTop: `2px solid ${color}`,
        borderRadius: "4px",
        overflow: "hidden",
        minHeight: 0,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "8px 12px",
          borderBottom: "1px solid var(--bg-border)",
          flexShrink: 0,
        }}
      >
        <span
          className={`status-dot ${agent.status}`}
          style={agent.status === "thinking" ? { background: color, boxShadow: `0 0 8px ${color}` } : {}}
        />
        <span style={{ color, fontWeight: 700, fontSize: "11px", letterSpacing: "0.08em" }}>
          {label}
        </span>
        <span
          style={{
            marginLeft: "auto",
            fontSize: "10px",
            color: "var(--text-dim)",
            letterSpacing: "0.05em",
          }}
        >
          {STATUS_LABELS[agent.status]}
          {agent.round > 0 ? ` · r${agent.round}` : ""}
        </span>
      </div>

      {/* Content stream */}
      <div
        ref={scrollRef}
        className="token-stream"
        style={{
          flex: 1,
          padding: "10px 12px",
          overflowY: "auto",
        }}
      >
        {agent.lines.length === 0 ? (
          <span style={{ color: "var(--text-dim)" }}>waiting...</span>
        ) : (
          agent.lines.map((line, i) => (
            <div key={i} style={{ marginBottom: "4px" }}>
              {line}
            </div>
          ))
        )}
      </div>

      {/* Verdict badge */}
      {agent.lastVerdict && (
        <div
          style={{
            padding: "6px 12px",
            borderTop: "1px solid var(--bg-border)",
            fontSize: "10px",
            color: agent.lastVerdict.startsWith("ACCEPT")
              ? "var(--accent-green)"
              : "var(--accent-red)",
            flexShrink: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={agent.lastVerdict}
        >
          {agent.lastVerdict}
        </div>
      )}
    </div>
  )
}
