import { useState } from "react"
import { useAgentStream } from "./hooks/useAgentStream"
import { useRunHistory } from "./hooks/useRunHistory"
import { AgentPanel } from "./components/AgentPanel"
import { ConvergenceBar } from "./components/ConvergenceBar"
import { GitStrip } from "./components/GitStrip"
import { RunHistory } from "./components/RunHistory"
import { TaskStrip } from "./components/TaskStrip"

const AGENT_LABELS: Record<string, string> = {
  pm: "PM",
  architect: "ARCHITECT",
  coder: "CODER",
  reviewer: "REVIEWER",
  tester: "TESTER",
}

const PANEL_AGENTS = ["pm", "architect", "coder", "reviewer", "tester"] as const

export default function App() {
  const { agents, currentRound, events, connected } = useAgentStream()
  const { runs, selected, loadingDetail, selectRun, clearSelected } = useRunHistory()
  const [showHistory, setShowHistory] = useState(false)

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
        // Shift left when history panel is open
        marginRight: showHistory ? "340px" : "0",
        transition: "margin-right 0.2s ease",
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
        <span style={{ fontWeight: 700, fontSize: "15px", letterSpacing: "0.15em", color: "var(--text-primary)" }}>
          ASTROPHAGE
        </span>
        <span style={{ fontSize: "10px", color: "var(--text-dim)", letterSpacing: "0.08em" }}>
          agent company
        </span>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "16px" }}>
          {/* Run history button */}
          <button
            onClick={() => setShowHistory((v) => !v)}
            style={{
              background: showHistory ? "var(--bg-border)" : "none",
              border: "1px solid var(--bg-border)",
              borderRadius: "3px",
              color: runs.length > 0 ? "var(--text-primary)" : "var(--text-dim)",
              cursor: "pointer",
              fontSize: "10px",
              letterSpacing: "0.08em",
              padding: "3px 10px",
              fontFamily: "var(--font-mono)",
            }}
          >
            HISTORY {runs.length > 0 ? `(${runs.length})` : ""}
          </button>

          {/* Connection status */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "10px", color: connected ? "var(--accent-green)" : "var(--accent-red)" }}>
            <span
              className={`status-dot ${connected ? "thinking" : "blocked"}`}
              style={connected ? { background: "var(--accent-green)", boxShadow: "0 0 8px var(--accent-green)" } : { background: "var(--accent-red)" }}
            />
            {connected ? "live" : "disconnected"}
          </div>
        </div>
      </div>

      {/* Task strip */}
      <TaskStrip />

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
          <AgentPanel key={name} agent={agents[name]} label={AGENT_LABELS[name]} />
        ))}
      </div>

      {/* Convergence bar */}
      <ConvergenceBar currentRound={currentRound} events={events} />

      {/* Git strip */}
      <GitStrip events={events} />

      {/* Run history sidebar */}
      {showHistory && (
        <RunHistory
          runs={runs}
          selected={selected}
          loadingDetail={loadingDetail}
          onSelect={selectRun}
          onClose={() => { clearSelected(); setShowHistory(false) }}
        />
      )}
    </div>
  )
}
