import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { apiUrl } from "../api"
import { AGENT_MAP } from "../space/agents"

interface AgentEvent {
  agent: string
  type: string
  content: string
  round: number
  timestamp: string
  tokenStats?: { inputTokens: number; outputTokens: number; estimatedCostUSD: number; durationMs: number }
}

interface RunRecord {
  id: string
  taskId: string
  taskTitle: string
  taskDescription: string
  repo: { remoteUrl: string; defaultBranch: string; localPath: string }
  startedAt: string
  finishedAt?: string
  status: "running" | "merged" | "unresolved" | "blocked"
  rounds: number
  prUrl?: string
  events: AgentEvent[]
}

interface TraceNode {
  id: string
  parentId: string | null
  runId: string
  agent: string
  round: number
  label: string
  startTime: string
  endTime?: string
  durationMs?: number
  tokenStats?: { inputTokens: number; outputTokens: number; estimatedCostUSD: number; durationMs: number }
  children: TraceNode[]
}

interface CostBreakdown {
  runId: string
  totalCostUSD: number
  totalInputTokens: number
  totalOutputTokens: number
  byAgent: Array<{
    agent: string
    turns: number
    inputTokens: number
    outputTokens: number
    estimatedCostUSD: number
    totalDurationMs: number
    avgDurationMs: number
  }>
}

// ─── Agent metadata helpers (single source of truth: agents.ts) ──────────────

const ORCHESTRATOR = { color: "#94a3b8", character: "Mission Control", emoji: "🌌", ship: "—", description: "Coordinates the full pipeline." }

function agentMeta(name: string) {
  return AGENT_MAP[name as keyof typeof AGENT_MAP] ?? ORCHESTRATOR
}

const STATUS_COLOR: Record<string, string> = {
  merged: "#00ff87",
  unresolved: "#f87171",
  blocked: "#f87171",
  running: "#fbbf24",
}

function elapsed(start: string, end?: string) {
  const ms = new Date(end ?? new Date()).getTime() - new Date(start).getTime()
  if (ms < 60000) return `${Math.round(ms / 1000)}s`
  return `${Math.round(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`
}

function fmtDuration(ms?: number): string {
  if (ms == null) return "—"
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`
}

function TraceNodeRow({ node, depth }: { node: TraceNode; depth: number }) {
  const meta = agentMeta(node.agent)
  const indent = depth * 24

  return (
    <div>
      <div style={{
        display: "flex", alignItems: "flex-start", gap: "10px",
        paddingLeft: `${indent}px`,
        paddingTop: "6px", paddingBottom: "6px",
        borderLeft: depth > 0 ? `1px dashed rgba(255,255,255,0.06)` : "none",
        marginLeft: depth > 0 ? `${indent - 1}px` : "0",
        paddingRight: "12px",
      }}>
        {depth > 0 && (
          <div style={{
            width: "12px", height: "1px",
            background: "rgba(255,255,255,0.06)",
            flexShrink: 0, marginTop: "9px",
          }} />
        )}
        <span style={{ fontSize: "13px", flexShrink: 0 }}>{meta.emoji}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "10px", color: meta.color, fontWeight: 700 }}>{meta.character}</span>
            {node.round > 0 && (
              <span style={{
                fontSize: "8px", padding: "1px 5px",
                background: "rgba(255,255,255,0.04)", borderRadius: "2px",
                color: "rgba(255,255,255,0.25)",
              }}>round {node.round}</span>
            )}
            <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.5)" }}>{node.label}</span>
            <div style={{ marginLeft: "auto", display: "flex", gap: "10px", flexShrink: 0 }}>
              <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.2)" }}>
                {fmtDuration(node.durationMs)}
              </span>
              {node.tokenStats && (
                <span style={{ fontSize: "9px", color: "#fbbf24" }}>
                  ${node.tokenStats.estimatedCostUSD.toFixed(4)}
                </span>
              )}
            </div>
          </div>
          <div style={{ fontSize: "8px", color: "rgba(255,255,255,0.2)", marginTop: "1px" }}>
            {meta.description}
          </div>
          {node.tokenStats && (
            <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.2)", marginTop: "2px", display: "flex", gap: "10px" }}>
              <span>{node.tokenStats.inputTokens.toLocaleString()} in</span>
              <span>{node.tokenStats.outputTokens.toLocaleString()} out</span>
            </div>
          )}
        </div>
      </div>
      {node.children.map((child) => (
        <TraceNodeRow key={child.id} node={child} depth={depth + 1} />
      ))}
    </div>
  )
}

type Tab = "events" | "trace"

export function RunPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [run, setRun] = useState<RunRecord | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedRound, setSelectedRound] = useState<number | "all">("all")
  const [activeTab, setActiveTab] = useState<Tab>("events")
  const [traceTree, setTraceTree] = useState<TraceNode | null>(null)
  const [costs, setCosts] = useState<CostBreakdown | null>(null)

  useEffect(() => {
    fetch(apiUrl(`/runs/${id}`))
      .then((r) => {
        if (!r.ok) throw new Error("Run not found")
        return r.json()
      })
      .then(setRun)
      .catch((e) => setError(e.message))
  }, [id])

  useEffect(() => {
    if (!id) return
    fetch(`/runs/${id}/trace`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => data?.tree ? setTraceTree(data.tree) : null)
      .catch(() => null)
    fetch(`/runs/${id}/costs`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => data ? setCosts(data) : null)
      .catch(() => null)
  }, [id])

  if (error) return (
    <div style={{ ...pageStyle, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", fontFamily: "var(--font-mono)" }}>
        <div style={{ fontSize: "48px", marginBottom: "16px" }}>🌌</div>
        <div style={{ fontSize: "14px" }}>{error}</div>
        <button onClick={() => navigate("/app")} style={backBtnStyle}>← back to mission control</button>
      </div>
    </div>
  )

  if (!run) return (
    <div style={{ ...pageStyle, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "rgba(255,255,255,0.2)", fontFamily: "var(--font-mono)", fontSize: "11px" }}>
        loading run...
      </div>
    </div>
  )

  const repoName = run.repo.remoteUrl.replace(/.*github\.com\//, "").replace(/\.git$/, "")
  const rounds = Array.from(new Set(run.events.map(e => e.round).filter(r => r > 0))).sort()

  const visibleEvents = run.events.filter(e => {
    if (e.type === "token") return false
    if (selectedRound === "all") return true
    return e.round === selectedRound || e.round === 0
  })

  // Group by round
  const roundGroups: Record<string, AgentEvent[]> = {}
  for (const event of visibleEvents) {
    const key = event.round > 0 ? `Round ${event.round}` : "Setup"
    if (!roundGroups[key]) roundGroups[key] = []
    roundGroups[key].push(event)
  }

  return (
    <div style={pageStyle}>
      {/* Top bar */}
      <div style={{
        flexShrink: 0, padding: "10px 24px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        display: "flex", alignItems: "center", gap: "16px",
        background: "rgba(5,5,20,0.95)",
      }}>
        <button onClick={() => navigate("/app")} style={backBtnStyle}>
          ← ASTROPHAGE
        </button>
        <span style={{ color: "rgba(255,255,255,0.15)", fontSize: "11px" }}>/</span>
        <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "11px", fontWeight: 700 }}>
          RUN
        </span>
        <span style={{ color: "rgba(255,255,255,0.2)", fontSize: "10px" }}>{run.id}</span>

        {/* Copy link */}
        <button
          onClick={() => navigator.clipboard.writeText(window.location.href)}
          style={{
            marginLeft: "auto", background: "none",
            border: "1px solid rgba(255,255,255,0.1)", borderRadius: "3px",
            color: "rgba(255,255,255,0.3)", cursor: "pointer",
            fontFamily: "inherit", fontSize: "9px", padding: "3px 10px",
            letterSpacing: "0.08em",
          }}
        >
          COPY LINK
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
        {/* Run header */}
        <div style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "8px",
          padding: "20px 24px",
          marginBottom: "20px",
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "16px", marginBottom: "12px" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "18px", fontWeight: 700, color: "white", marginBottom: "6px" }}>
                {run.taskTitle}
              </div>
              <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.45)", lineHeight: 1.6 }}>
                {run.taskDescription}
              </div>
            </div>
            <div style={{
              flexShrink: 0, textAlign: "right",
              fontSize: "11px", color: "rgba(255,255,255,0.4)",
            }}>
              <div style={{ color: STATUS_COLOR[run.status], fontWeight: 700, fontSize: "13px", marginBottom: "4px" }}>
                {run.status.toUpperCase()}
              </div>
              <div>{run.rounds} round{run.rounds !== 1 ? "s" : ""}</div>
              <div>{elapsed(run.startedAt, run.finishedAt)}</div>
              <div style={{ fontSize: "9px", marginTop: "4px", color: "rgba(255,255,255,0.2)" }}>
                {new Date(run.startedAt).toLocaleString()}
              </div>
            </div>
          </div>

          {/* Meta row */}
          <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "center" }}>
            <a
              href={run.repo.remoteUrl.replace(/\.git$/, "")}
              target="_blank" rel="noreferrer"
              style={{ fontSize: "10px", color: "#60a5fa", textDecoration: "none" }}
            >
              📁 {repoName}
            </a>
            <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.25)" }}>
              branch: {run.repo.defaultBranch}
            </span>
            {run.prUrl && (
              <a
                href={run.prUrl}
                target="_blank" rel="noreferrer"
                style={{
                  fontSize: "11px", color: "#00ff87",
                  textDecoration: "none", fontWeight: 700,
                  padding: "3px 10px",
                  border: "1px solid rgba(0,255,135,0.3)",
                  borderRadius: "4px",
                  background: "rgba(0,255,135,0.05)",
                }}
              >
                ✓ View PR on GitHub →
              </a>
            )}
          </div>
        </div>

        {/* Tab bar */}
        <div style={{ display: "flex", gap: "4px", marginBottom: "16px", borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: "0" }}>
          {(["events", "trace"] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={tabBtnStyle(activeTab === tab)}
            >
              {tab === "events" ? "EVENTS" : "TRACE"}
            </button>
          ))}
        </div>

        {/* ── EVENTS TAB ── */}
        {activeTab === "events" && (
          <>
            {/* Round filter */}
            {rounds.length > 1 && (
              <div style={{ display: "flex", gap: "6px", marginBottom: "16px", flexWrap: "wrap" }}>
                <button
                  onClick={() => setSelectedRound("all")}
                  style={filterBtnStyle(selectedRound === "all")}
                >ALL</button>
                {rounds.map(r => (
                  <button
                    key={r}
                    onClick={() => setSelectedRound(r)}
                    style={filterBtnStyle(selectedRound === r)}
                  >ROUND {r}</button>
                ))}
              </div>
            )}

            {/* Event groups */}
            {Object.entries(roundGroups).map(([groupName, events]) => (
              <div key={groupName} style={{ marginBottom: "24px" }}>
                <div style={{
                  fontSize: "9px", letterSpacing: "0.12em",
                  color: "rgba(255,255,255,0.2)",
                  marginBottom: "10px",
                  display: "flex", alignItems: "center", gap: "10px",
                }}>
                  <span>{groupName}</span>
                  <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.06)" }} />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {events.map((event) => {
                    const meta = agentMeta(event.agent)
                    const isVerdict = event.type === "verdict"
                    const isConverge = event.type === "convergence"
                    const isGit = event.type === "git_action"

                    let content = event.content
                    if (isVerdict) {
                      try {
                        const v = JSON.parse(content)
                        content = `${v.decision.toUpperCase()}${v.nonNegotiable ? " [NON-NEGOTIABLE]" : ""}: ${v.reason}`
                      } catch { /* use raw */ }
                    }

                    const accent = isConverge
                      ? (content.startsWith("MERGED") || content.startsWith("ACCEPTED") ? "#00ff87" : "#f87171")
                      : isVerdict
                      ? (content.startsWith("ACCEPT") ? "#00ff87" : "#fbbf24")
                      : isGit ? "#34d399"
                      : "rgba(255,255,255,0.6)"

                    return (
                      <div key={`${event.timestamp}-${event.type}`} style={{
                        display: "flex", gap: "12px", alignItems: "flex-start",
                        padding: "10px 14px",
                        background: isConverge ? "rgba(255,255,255,0.03)" : "transparent",
                        borderLeft: `2px solid ${isConverge || isGit ? accent : "rgba(255,255,255,0.05)"}`,
                        borderRadius: "0 4px 4px 0",
                      }}>
                        <span style={{ fontSize: "14px", flexShrink: 0, marginTop: "1px" }}>{meta.emoji}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "2px" }}>
                            <div>
                              <span style={{ fontSize: "10px", color: meta.color, fontWeight: 700 }}>{meta.character}</span>
                              <span style={{ fontSize: "8px", color: "rgba(255,255,255,0.2)", marginLeft: "6px" }}>{meta.description}</span>
                            </div>
                            <span style={{
                              fontSize: "8px", padding: "1px 5px",
                              background: "rgba(255,255,255,0.05)", borderRadius: "2px",
                              color: "rgba(255,255,255,0.25)", letterSpacing: "0.05em",
                              flexShrink: 0,
                            }}>
                              {event.type.replace("_", " ").toUpperCase()}
                            </span>
                            <span style={{ marginLeft: "auto", fontSize: "8px", color: "rgba(255,255,255,0.15)", flexShrink: 0 }}>
                              {new Date(event.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                          <div style={{
                            fontSize: "11px", color: accent,
                            lineHeight: 1.6, wordBreak: "break-word",
                            whiteSpace: "pre-wrap",
                          }}>
                            {content}
                          </div>
                          {event.tokenStats && (
                            <div style={{
                              marginTop: "4px", fontSize: "9px",
                              color: "rgba(255,255,255,0.2)",
                              display: "flex", gap: "10px",
                            }}>
                              <span>{event.tokenStats.inputTokens.toLocaleString()} in</span>
                              <span>{event.tokenStats.outputTokens.toLocaleString()} out</span>
                              <span>${event.tokenStats.estimatedCostUSD.toFixed(4)}</span>
                              <span>{Math.round(event.tokenStats.durationMs / 1000)}s</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </>
        )}

        {/* ── TRACE TAB ── */}
        {activeTab === "trace" && (
          <div>
            {/* Cost summary row */}
            {costs && (
              <div style={{
                display: "flex", gap: "24px", flexWrap: "wrap",
                padding: "12px 16px", marginBottom: "20px",
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: "6px",
              }}>
                <div>
                  <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", marginBottom: "4px", letterSpacing: "0.08em" }}>TOTAL COST</div>
                  <div style={{ fontSize: "16px", fontWeight: 700, color: "#fbbf24" }}>${costs.totalCostUSD.toFixed(4)}</div>
                </div>
                <div>
                  <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", marginBottom: "4px", letterSpacing: "0.08em" }}>INPUT TOKENS</div>
                  <div style={{ fontSize: "16px", fontWeight: 700, color: "rgba(255,255,255,0.7)" }}>{costs.totalInputTokens.toLocaleString()}</div>
                </div>
                <div>
                  <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", marginBottom: "4px", letterSpacing: "0.08em" }}>OUTPUT TOKENS</div>
                  <div style={{ fontSize: "16px", fontWeight: 700, color: "rgba(255,255,255,0.7)" }}>{costs.totalOutputTokens.toLocaleString()}</div>
                </div>
              </div>
            )}

            {/* Per-agent cost breakdown */}
            {costs && costs.byAgent.length > 0 && (
              <div style={{ marginBottom: "24px" }}>
                <div style={{
                  fontSize: "9px", letterSpacing: "0.12em",
                  color: "rgba(255,255,255,0.2)", marginBottom: "10px",
                  display: "flex", alignItems: "center", gap: "10px",
                }}>
                  <span>COST BY AGENT</span>
                  <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.06)" }} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  {costs.byAgent.map((a) => {
                    const meta = agentMeta(a.agent)
                    return (
                      <div key={a.agent} style={{
                        display: "flex", alignItems: "center", gap: "12px",
                        padding: "8px 12px",
                        background: "rgba(255,255,255,0.02)",
                        borderLeft: `2px solid ${meta.color}30`,
                        borderRadius: "0 4px 4px 0",
                      }}>
                        <span style={{ fontSize: "11px", flexShrink: 0 }}>{meta.emoji}</span>
                        <div style={{ flexShrink: 0, width: "140px" }}>
                          <div style={{ fontSize: "10px", color: meta.color, fontWeight: 700 }}>{meta.character}</div>
                          <div style={{ fontSize: "8px", color: "rgba(255,255,255,0.25)" }}>{meta.description}</div>
                        </div>
                        <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", width: "50px", flexShrink: 0 }}>{a.turns} turn{a.turns !== 1 ? "s" : ""}</span>
                        <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.4)" }}>{a.inputTokens.toLocaleString()} in / {a.outputTokens.toLocaleString()} out</span>
                        <span style={{ marginLeft: "auto", fontSize: "11px", fontWeight: 700, color: "#fbbf24" }}>${a.estimatedCostUSD.toFixed(4)}</span>
                        <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.2)" }}>{Math.round(a.totalDurationMs / 1000)}s total</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Trace tree */}
            <div style={{
              fontSize: "9px", letterSpacing: "0.12em",
              color: "rgba(255,255,255,0.2)", marginBottom: "10px",
              display: "flex", alignItems: "center", gap: "10px",
            }}>
              <span>CALL GRAPH</span>
              <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.06)" }} />
            </div>

            {traceTree ? (
              <TraceNodeRow node={traceTree} depth={0} />
            ) : (
              <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.2)", padding: "16px 0" }}>
                No trace data available for this run.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const pageStyle: React.CSSProperties = {
  width: "100vw", height: "100vh",
  background: "#050510",
  display: "flex", flexDirection: "column",
  overflow: "hidden",
  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
  color: "rgba(255,255,255,0.8)",
}

const backBtnStyle: React.CSSProperties = {
  background: "none", border: "none",
  color: "rgba(255,255,255,0.35)", cursor: "pointer",
  fontFamily: "inherit", fontSize: "10px",
  letterSpacing: "0.08em", padding: "0",
}

const filterBtnStyle = (active: boolean): React.CSSProperties => ({
  background: active ? "rgba(255,220,80,0.1)" : "none",
  border: `1px solid ${active ? "rgba(255,220,80,0.4)" : "rgba(255,255,255,0.1)"}`,
  borderRadius: "3px",
  color: active ? "rgba(255,220,80,0.9)" : "rgba(255,255,255,0.3)",
  cursor: "pointer",
  fontFamily: "inherit",
  fontSize: "9px",
  letterSpacing: "0.08em",
  padding: "3px 10px",
})

const tabBtnStyle = (active: boolean): React.CSSProperties => ({
  background: "none",
  border: "none",
  borderBottom: `2px solid ${active ? "rgba(255,220,80,0.7)" : "transparent"}`,
  color: active ? "rgba(255,220,80,0.9)" : "rgba(255,255,255,0.3)",
  cursor: "pointer",
  fontFamily: "inherit",
  fontSize: "10px",
  fontWeight: active ? 700 : 400,
  letterSpacing: "0.1em",
  padding: "6px 14px 8px",
  marginBottom: "-1px",
})
