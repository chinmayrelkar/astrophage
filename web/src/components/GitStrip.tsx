import React from "react"
import type { AgentEvent } from "../hooks/useAgentStream"

interface Props {
  events: AgentEvent[]
}

export function GitStrip({ events }: Props) {
  const gitEvents = events.filter((e) => e.agent === "git" && e.type === "git_action")
  const last = gitEvents[gitEvents.length - 1]

  if (!last) {
    return (
      <div
        style={{
          background: "var(--bg-panel)",
          border: "1px solid var(--bg-border)",
          borderRadius: "4px",
          padding: "8px 16px",
          display: "flex",
          alignItems: "center",
          gap: "16px",
          flexShrink: 0,
        }}
      >
        <span style={{ color: "var(--text-dim)", fontSize: "10px", letterSpacing: "0.1em" }}>
          GIT
        </span>
        <span style={{ color: "var(--text-dim)", fontSize: "11px" }}>no activity yet</span>
      </div>
    )
  }

  return (
    <div
      style={{
        background: "var(--bg-panel)",
        border: "1px solid var(--bg-border)",
        borderLeft: "2px solid var(--agent-git)",
        borderRadius: "4px",
        padding: "8px 16px",
        display: "flex",
        alignItems: "center",
        gap: "16px",
        flexShrink: 0,
      }}
    >
      <span style={{ color: "var(--agent-git)", fontSize: "10px", letterSpacing: "0.1em", fontWeight: 700 }}>
        GIT
      </span>
      {gitEvents.map((e, i) => (
        <span
          key={i}
          style={{
            fontSize: "11px",
            color: i === gitEvents.length - 1 ? "var(--text-primary)" : "var(--text-dim)",
          }}
        >
          {e.content}
          {i < gitEvents.length - 1 && (
            <span style={{ color: "var(--text-dim)", margin: "0 8px" }}>›</span>
          )}
        </span>
      ))}
    </div>
  )
}
