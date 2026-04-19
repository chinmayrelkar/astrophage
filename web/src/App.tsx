import { useState, useCallback } from "react"
import { useSpaceState } from "./space/useSpaceState"
import { SpaceCanvas } from "./space/SpaceCanvas"
import { MissionLog } from "./space/MissionLog"
import { TaskHistory } from "./space/TaskHistory"
import { AutonomousPanel } from "./components/AutonomousPanel"
import type { AgentName } from "./hooks/useAgentStream"

export default function App() {
  const [selectedAgent, setSelectedAgent] = useState<AgentName | null>(null)
  const [logOpen, setLogOpen] = useState(true)
  const [taskModalOpen, setTaskModalOpen] = useState(false)
  const [_selectedRun, setSelectedRun] = useState<string | null>(null)

  const { agents, beams, log, currentRound, connected, task, runs } = useSpaceState()

  const handleShipClick = useCallback((name: AgentName) => {
    setSelectedAgent((prev) => prev === name ? null : name)
    setLogOpen(true)
  }, [])

  const handleLogClose = useCallback(() => {
    setSelectedAgent(null)
    setLogOpen(false)
  }, [])

  return (
    <div style={{
      width: "100vw",
      height: "100vh",
      background: "#050510",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    }}>
      {/* Top bar */}
      <div style={{
        flexShrink: 0,
        padding: "8px 16px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        display: "flex",
        alignItems: "center",
        gap: "16px",
        background: "rgba(5,5,20,0.9)",
        zIndex: 10,
      }}>
        <span style={{ fontWeight: 700, fontSize: "14px", letterSpacing: "0.2em", color: "white" }}>
          ASTROPHAGE
        </span>
        <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.25)", letterSpacing: "0.1em" }}>
          PROJECT HAIL MARY · AGENT COMPANY
        </span>

        {task ? (
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginLeft: "8px" }}>
            <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.2)" }}>▶</span>
            <span style={{ fontSize: "11px", color: "rgba(255,220,80,0.9)", fontWeight: 700 }}>
              {task.title}
            </span>
            <a
              href={task.repo.remoteUrl.replace(/\.git$/, "")}
              target="_blank"
              rel="noreferrer"
              style={{ fontSize: "9px", color: "#60a5fa", textDecoration: "none" }}
            >
              {task.repo.remoteUrl.replace(/.*github\.com\//, "").replace(/\.git$/, "")}
            </a>
            {currentRound > 0 && (
              <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", padding: "1px 6px", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "3px" }}>
                round {currentRound}
              </span>
            )}
          </div>
        ) : (
          <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.2)", marginLeft: "8px" }}>
            awaiting mission
          </span>
        )}

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "10px" }}>
          {/* New Task button */}
          <button
            onClick={() => setTaskModalOpen(true)}
            style={{
              background: "rgba(255,220,80,0.1)",
              border: "1px solid rgba(255,220,80,0.3)",
              borderRadius: "3px",
              color: "rgba(255,220,80,0.85)",
              cursor: "pointer",
              fontSize: "9px",
              fontWeight: 700,
              letterSpacing: "0.08em",
              padding: "3px 12px",
              fontFamily: "inherit",
            }}
          >
            AUTONOMOUS ⚡
          </button>

          <button
            onClick={() => setLogOpen((v) => !v)}
            style={{
              background: logOpen ? "rgba(255,255,255,0.08)" : "none",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "3px",
              color: "rgba(255,255,255,0.5)",
              cursor: "pointer",
              fontSize: "9px",
              letterSpacing: "0.08em",
              padding: "3px 10px",
              fontFamily: "inherit",
            }}
          >
            {logOpen ? "HIDE LOG" : "SHOW LOG"}
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "9px", color: connected ? "#00ff87" : "#f87171" }}>
            <span style={{
              width: "6px", height: "6px", borderRadius: "50%",
              background: connected ? "#00ff87" : "#f87171",
              boxShadow: connected ? "0 0 6px #00ff87" : "none",
              animation: connected ? "pulse 2s infinite" : "none",
              display: "inline-block",
            }} />
            {connected ? "LIVE" : "OFFLINE"}
          </div>
        </div>
      </div>

      {/* Main area: canvas + log panel */}
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        <div style={{ flex: 1, position: "relative", minWidth: 0 }}>
          <SpaceCanvas
            agents={agents}
            beams={beams}
            currentRound={currentRound}
            task={task}
            onShipClick={handleShipClick}
          />
          {!logOpen && (
            <div style={{
              position: "absolute", bottom: "16px", left: "50%",
              transform: "translateX(-50%)",
              fontSize: "9px", color: "rgba(255,255,255,0.2)",
              letterSpacing: "0.08em", pointerEvents: "none",
            }}>
              click a ship to inspect · + NEW TASK to launch a mission
            </div>
          )}
        </div>

        {logOpen && (
          <div style={{ width: "340px", flexShrink: 0, borderLeft: "1px solid rgba(255,255,255,0.06)" }}>
            <MissionLog
              log={log}
              agents={agents}
              selectedAgent={selectedAgent}
              onClose={handleLogClose}
            />
          </div>
        )}
      </div>

      <TaskHistory runs={runs} onSelect={setSelectedRun} />

      {taskModalOpen && <AutonomousPanel onClose={() => setTaskModalOpen(false)} />}
    </div>
  )
}
