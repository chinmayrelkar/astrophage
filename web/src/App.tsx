import React from "react"
import { useAgentStream } from "./hooks/useAgentStream"
import { AgentPanel } from "./components/AgentPanel"
import { ConvergenceBar } from "./components/ConvergenceBar"
import { GitStrip } from "./components/GitStrip"

const AGENT_LABELS: Record<string, string> = {
  pm: "PM",
  architect: "ARCHITECT",
  coder: "CODER",
  reviewer: "REVIEWER",
  tester: "TESTER",
  git: "GIT",
}

const PANEL_AGENTS = ["pm", "architect", "coder", "reviewer", "tester"] as const

export default function App() {
  const { agents, currentRound, events, connected } = useAgentStream()

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        padding: "12px",
        background: "var(--bg-base)",
        overflow: "hidden",
      }}
    >
      {/* Top bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "16px",
          flexShrink: 0,
          paddingBottom: "4px",
          borderBottom: "1px solid var(--bg-border)",
        }}
      >
        <span
          style={{
            fontWeight: 700,
            fontSize: "15px",
            letterSpacing: "0.15em",
            color: "var(--text-primary)",
          }}
        >
          ASTROPHAGE
        </span>
        <span
          style={{
            fontSize: "10px",
            color: "var(--text-dim)",
            letterSpacing: "0.08em",
          }}
        >
          agent company
        </span>
        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "10px",
            color: connected ? "var(--accent-green)" : "var(--accent-red)",
          }}
        >
          <span
            className={`status-dot ${connected ? "thinking" : "blocked"}`}
            style={
              connected
                ? { background: "var(--accent-green)", boxShadow: "0 0 8px var(--accent-green)" }
                : { background: "var(--accent-red)" }
            }
          />
          {connected ? "live" : "disconnected"}
        </div>
      </div>

      {/* Agent panels */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gap: "8px",
          flex: 1,
          minHeight: 0,
        }}
      >
        {PANEL_AGENTS.map((name) => (
          <AgentPanel
            key={name}
            agent={agents[name]}
            label={AGENT_LABELS[name]}
          />
        ))}
      </div>

      {/* Convergence bar */}
      <ConvergenceBar currentRound={currentRound} events={events} />

      {/* Git strip */}
      <GitStrip events={events} />
    </div>
  )
}
