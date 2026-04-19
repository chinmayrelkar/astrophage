import { useState, useEffect } from "react"
import { apiUrl } from "../api"

interface QueuedTask {
  id: string
  title: string
  type: string | undefined
  repo: string
}

interface ScoutDecision {
  source: string
  ref: string
  actionable: boolean
  reason: string
  taskTitle?: string
}

interface BacklogItem {
  id: string
  title: string
  type: string
  priority: string
  dispatched: boolean
}

interface LoopStatus {
  running: boolean
  scoutRunning: boolean
  productRunning: boolean
  watchedRepos: string[]
  queue: QueuedTask[]
  seenKeyCount: number
  backlogSize: number
  nextScoutAt: string | null
  nextProductAt: string | null
  lastScoutAt: string | null
  lastProductAt: string | null
  lastScoutDecisions: ScoutDecision[]
  lastBacklogItems: BacklogItem[]
}

interface Props {
  onClose: () => void
}

const PRIORITY_COLOR: Record<string, string> = {
  critical: "#f87171",
  high: "#fbbf24",
  medium: "#60a5fa",
  low: "rgba(255,255,255,0.3)",
}

const TYPE_COLOR: Record<string, string> = {
  bug: "#f87171",
  feature: "#a78bfa",
  spike: "#60a5fa",
  undefined: "rgba(255,255,255,0.3)",
}

function timeUntil(iso: string | null): string {
  if (!iso) return "—"
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return "now"
  const s = Math.round(diff / 1000)
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m ${s % 60}s`
}

function timeAgo(iso: string | null): string {
  if (!iso) return "never"
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.round(diff / 1000)
  if (s < 5) return "just now"
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  return `${Math.floor(s / 3600)}h ago`
}

export function AutonomousPanel({ onClose }: Props) {
  const [status, setStatus] = useState<LoopStatus | null>(null)
  const [tab, setTab] = useState<"queue" | "scout" | "backlog">("queue")

  useEffect(() => {
    const load = () => {
      fetch(apiUrl("/autonomous/status"))
        .then((r) => r.ok ? r.json() : null)
        .then((d) => d && setStatus(d as LoopStatus))
        .catch(() => null)
    }
    load()
    const interval = setInterval(load, 5000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "rgba(0,0,0,0.75)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: "#080814",
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: "8px",
        width: "560px",
        maxHeight: "85vh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        fontFamily: "var(--font-mono, monospace)",
      }}>

        {/* Header */}
        <div style={{
          padding: "14px 20px",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          display: "flex", alignItems: "center", gap: "12px",
        }}>
          <span style={{ fontWeight: 700, fontSize: "12px", letterSpacing: "0.1em", color: "rgba(255,220,80,0.9)" }}>
            AUTONOMOUS MODE
          </span>
          <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.25)" }}>
            human task submission disabled
          </span>
          <button onClick={onClose} style={{
            marginLeft: "auto", background: "none", border: "none",
            color: "rgba(255,255,255,0.3)", cursor: "pointer", fontSize: "18px", lineHeight: 1,
          }}>×</button>
        </div>

        {/* Agent status row */}
        {status && (
          <div style={{
            display: "flex", gap: "0",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
          }}>
            {/* DuBois */}
            <div style={{
              flex: 1, padding: "10px 16px",
              borderRight: "1px solid rgba(255,255,255,0.06)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                <span style={{ fontSize: "14px" }}>📦</span>
                <span style={{ fontSize: "10px", fontWeight: 700, color: "#34d399" }}>DuBois</span>
                <span style={{
                  fontSize: "8px", padding: "1px 5px",
                  background: status.scoutRunning ? "rgba(52,211,153,0.15)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${status.scoutRunning ? "rgba(52,211,153,0.4)" : "rgba(255,255,255,0.08)"}`,
                  borderRadius: "2px",
                  color: status.scoutRunning ? "#34d399" : "rgba(255,255,255,0.25)",
                  animation: status.scoutRunning ? "pulse 1.5s infinite" : "none",
                }}>
                  {status.scoutRunning ? "SCANNING" : "IDLE"}
                </span>
              </div>
              <div style={{ fontSize: "8px", color: "rgba(255,255,255,0.25)", lineHeight: 1.6 }}>
                <div>last scan: {timeAgo(status.lastScoutAt)}</div>
                <div>next scan: {timeUntil(status.nextScoutAt)}</div>
                <div>seen: {status.seenKeyCount} issues</div>
              </div>
            </div>
            {/* Lokken */}
            <div style={{ flex: 1, padding: "10px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                <span style={{ fontSize: "14px" }}>🔭</span>
                <span style={{ fontSize: "10px", fontWeight: 700, color: "#fb923c" }}>Lokken</span>
                <span style={{
                  fontSize: "8px", padding: "1px 5px",
                  background: status.productRunning ? "rgba(251,146,60,0.15)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${status.productRunning ? "rgba(251,146,60,0.4)" : "rgba(255,255,255,0.08)"}`,
                  borderRadius: "2px",
                  color: status.productRunning ? "#fb923c" : "rgba(255,255,255,0.25)",
                }}>
                  {status.productRunning ? "PLANNING" : "IDLE"}
                </span>
              </div>
              <div style={{ fontSize: "8px", color: "rgba(255,255,255,0.25)", lineHeight: 1.6 }}>
                <div>last cycle: {timeAgo(status.lastProductAt)}</div>
                <div>next cycle: {timeUntil(status.nextProductAt)}</div>
                <div>backlog: {status.backlogSize} item(s)</div>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.08)", flexShrink: 0 }}>
          {(["queue", "scout", "backlog"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1, padding: "8px",
              background: "none", border: "none",
              borderBottom: `2px solid ${tab === t ? "rgba(255,220,80,0.7)" : "transparent"}`,
              color: tab === t ? "rgba(255,220,80,0.9)" : "rgba(255,255,255,0.3)",
              cursor: "pointer", fontFamily: "inherit",
              fontSize: "9px", fontWeight: tab === t ? 700 : 400,
              letterSpacing: "0.08em",
            }}>
              {t === "queue"   ? `TASK QUEUE ${status ? `(${status.queue.length})` : ""}` :
               t === "scout"  ? "SCOUT FINDINGS" :
               `BACKLOG ${status ? `(${status.backlogSize})` : ""}`}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px" }}>
          {!status ? (
            <div style={{ color: "rgba(255,255,255,0.2)", fontSize: "11px", textAlign: "center", padding: "20px" }}>
              connecting to autonomous loop...
            </div>
          ) : tab === "queue" ? (
            status.queue.length === 0 ? (
              <div style={{ color: "rgba(255,255,255,0.2)", fontSize: "10px", textAlign: "center", padding: "20px" }}>
                Queue is empty — agents are scanning for work
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {status.queue.map((task, i) => (
                  <div key={task.id} style={{
                    padding: "10px 12px",
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    borderLeft: `3px solid ${TYPE_COLOR[task.type ?? "undefined"]}`,
                    borderRadius: "0 4px 4px 0",
                    display: "flex", alignItems: "flex-start", gap: "10px",
                  }}>
                    <span style={{
                      fontSize: "9px", color: "rgba(255,255,255,0.2)",
                      flexShrink: 0, marginTop: "1px", width: "16px",
                    }}>
                      {i + 1}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "10px", fontWeight: 700, color: "rgba(255,255,255,0.8)", marginBottom: "3px" }}>
                        {task.title}
                      </div>
                      <div style={{ display: "flex", gap: "8px" }}>
                        {task.type && (
                          <span style={{ fontSize: "8px", color: TYPE_COLOR[task.type], letterSpacing: "0.05em" }}>
                            {task.type.toUpperCase()}
                          </span>
                        )}
                        <span style={{ fontSize: "8px", color: "rgba(255,255,255,0.2)" }}>{task.repo}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : tab === "scout" ? (
            status.lastScoutDecisions.length === 0 ? (
              <div style={{ color: "rgba(255,255,255,0.2)", fontSize: "10px", textAlign: "center", padding: "20px" }}>
                {status.lastScoutAt ? "No issues found in last scan" : "No scan run yet — starting shortly"}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                {status.lastScoutDecisions.map((d) => (
                  <div key={d.ref} style={{
                    padding: "8px 12px",
                    background: "rgba(255,255,255,0.02)",
                    borderLeft: `2px solid ${d.actionable ? "#34d399" : "rgba(255,255,255,0.1)"}`,
                    borderRadius: "0 3px 3px 0",
                    opacity: d.actionable ? 1 : 0.5,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "2px" }}>
                      <span style={{ fontSize: "9px", color: d.actionable ? "#34d399" : "rgba(255,255,255,0.25)" }}>
                        {d.actionable ? "✓ ACTIONABLE" : "✗ SKIPPED"}
                      </span>
                      <span style={{ fontSize: "8px", color: "rgba(255,255,255,0.2)" }}>
                        {d.source === "github_issue" ? "issue" : "code"} · {d.ref.split(":").pop()}
                      </span>
                    </div>
                    {d.taskTitle && (
                      <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.7)", marginBottom: "2px" }}>
                        {d.taskTitle}
                      </div>
                    )}
                    <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", lineHeight: 1.4 }}>
                      {d.reason}
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            // Backlog tab
            status.lastBacklogItems.length === 0 ? (
              <div style={{ color: "rgba(255,255,255,0.2)", fontSize: "10px", textAlign: "center", padding: "20px" }}>
                {status.lastProductAt ? "No features in backlog yet" : "Product cycle not yet run"}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                {status.lastBacklogItems.map((item) => (
                  <div key={item.id} style={{
                    padding: "8px 12px",
                    background: "rgba(255,255,255,0.02)",
                    borderLeft: `2px solid ${PRIORITY_COLOR[item.priority] ?? "rgba(255,255,255,0.1)"}`,
                    borderRadius: "0 3px 3px 0",
                    opacity: item.dispatched ? 0.5 : 1,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "2px" }}>
                      <span style={{ fontSize: "9px", color: TYPE_COLOR[item.type] ?? "rgba(255,255,255,0.3)" }}>
                        {item.type.toUpperCase()}
                      </span>
                      <span style={{ fontSize: "8px", color: PRIORITY_COLOR[item.priority] ?? "rgba(255,255,255,0.2)" }}>
                        {item.priority}
                      </span>
                      {item.dispatched && (
                        <span style={{ fontSize: "8px", color: "rgba(255,255,255,0.2)", marginLeft: "auto" }}>
                          dispatched
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.75)" }}>
                      {item.title}
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: "10px 16px",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          display: "flex", alignItems: "center", gap: "8px",
        }}>
          <span style={{ fontSize: "8px", color: "rgba(255,255,255,0.15)", letterSpacing: "0.06em" }}>
            WATCHING: {status?.watchedRepos.map((r) => r.replace(/.*github\.com\//, "").replace(/\.git$/, "")).join(", ") ?? "…"}
          </span>
          {status?.running && (
            <span style={{
              marginLeft: "auto", fontSize: "8px", color: "#34d399",
              display: "flex", alignItems: "center", gap: "4px",
            }}>
              <span style={{
                width: "5px", height: "5px", borderRadius: "50%",
                background: "#34d399", display: "inline-block",
                boxShadow: "0 0 4px #34d399",
              }} />
              AUTONOMOUS
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
