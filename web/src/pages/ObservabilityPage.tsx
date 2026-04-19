import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { apiUrl } from "../api"
import { AGENT_MAP } from "../space/agents"

// ─── Types ────────────────────────────────────────────────────────────────────

interface RunSummary {
  id: string
  taskId: string
  taskTitle: string
  startedAt: string
  finishedAt?: string
  status: string
  rounds: number
  prUrl?: string
  estimatedCostUSD?: number
}

interface AgentCostRow {
  agent: string
  turns: number
  outputChars: number
  estimatedTokens: number
  estimatedCostUSD: number
}

interface ObsSummary {
  totalRuns: number
  mergedCount: number
  unresolvedCount: number
  runningCount: number
  completedRuns: number
  avgDurationMs: number
  totalCostUSD: number
  totalTokens: number
  agentCosts: AgentCostRow[]
  runs: RunSummary[]
  cachedAt: string
}

interface LoopStatus {
  running: boolean
  paused: boolean
  pausedAt: string | null
  pauseReason: string | null
  scoutRunning: boolean
  productRunning: boolean
  watchedRepos: string[]
  queue: Array<{ id: string; title: string; type?: string; repo: string }>
  seenKeyCount: number
  backlogSize: number
  nextScoutAt: string | null
  nextProductAt: string | null
  lastScoutAt: string | null
  lastProductAt: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ORCHESTRATOR_META = { role: "ORCHESTRATOR", color: "#94a3b8", character: "Mission Control", emoji: "🌌" }

function agentMeta(name: string) {
  const m = AGENT_MAP[name as keyof typeof AGENT_MAP]
  return m ?? ORCHESTRATOR_META
}

function fmtDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  const s = Math.round(ms / 1000)
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

function timeUntil(iso: string | null): string {
  if (!iso) return "—"
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return "now"
  const s = Math.round(diff / 1000)
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m ${s % 60}s`
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function ObservabilityPage() {
  const navigate = useNavigate()
  const [summary, setSummary] = useState<ObsSummary | null>(null)
  const [loop, setLoop] = useState<LoopStatus | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadSummary = () =>
      fetch(apiUrl("/observability/summary"))
        .then((r) => r.ok ? r.json() : null)
        .then((d) => { if (d) { setSummary(d as ObsSummary); setLoading(false) } })
        .catch(() => setLoading(false))

    const loadLoop = () =>
      fetch(apiUrl("/autonomous/status"))
        .then((r) => r.ok ? r.json() : null)
        .then((d) => d && setLoop(d as LoopStatus))
        .catch(() => null)

    loadSummary()
    loadLoop()
    // Summary is cached for 60s on the server — no need to hit faster than that
    const i1 = setInterval(loadSummary, 60_000)
    const i2 = setInterval(loadLoop, 5_000)
    return () => { clearInterval(i1); clearInterval(i2) }
  }, [])

  const s = summary
  const runs = s?.runs ?? []
  const agentCosts = s?.agentCosts ?? []
  const totalCost = s?.totalCostUSD ?? 0
  const totalTokens = s?.totalTokens ?? 0

  return (
    <div style={{
      minHeight: "100vh",
      background: "#04040f",
      color: "#e2e8f0",
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    }}>
      {/* Nav */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 100,
        display: "flex", alignItems: "center", padding: "12px 28px",
        background: "rgba(4,4,15,0.9)", backdropFilter: "blur(16px)",
        borderBottom: "1px solid rgba(255,255,255,0.05)", gap: "20px",
      }}>
        <button onClick={() => navigate("/")} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0 }}>
          <span style={{ fontWeight: 900, fontSize: "12px", letterSpacing: "0.25em", color: "rgba(255,255,255,0.5)" }}>ASTROPHAGE</span>
        </button>
        <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.15)", letterSpacing: "0.1em" }}>/ OBSERVABILITY</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: "12px", alignItems: "center" }}>
          {s?.cachedAt && (
            <span style={{ fontSize: "8px", color: "rgba(255,255,255,0.15)", letterSpacing: "0.08em" }}>
              cached {timeAgo(s.cachedAt)}
            </span>
          )}
          <button onClick={() => navigate("/app")} style={{
            background: "rgba(0,255,135,0.08)", border: "1px solid rgba(0,255,135,0.25)",
            borderRadius: "4px", color: "#00ff87", cursor: "pointer",
            fontSize: "9px", letterSpacing: "0.1em", padding: "4px 12px", fontFamily: "inherit",
          }}>MISSION CONTROL</button>
          <button onClick={() => navigate("/docs")} style={{
            background: "none", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "4px", color: "rgba(255,255,255,0.35)", cursor: "pointer",
            fontSize: "9px", letterSpacing: "0.1em", padding: "4px 12px", fontFamily: "inherit",
          }}>DOCS</button>
        </div>
      </nav>

      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "32px 28px 80px" }}>

        {/* ── Header ── */}
        <h1 style={{ fontSize: "22px", fontWeight: 900, letterSpacing: "0.06em", color: "white", marginBottom: "8px" }}>
          Observability
        </h1>
        <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.25)", marginBottom: "24px" }}>
          Cross-run metrics, cost breakdown, pipeline health, and autonomous loop status.
        </p>

        {/* ── Paused banner (read-only status indicator) ── */}
        {loop?.paused && (
          <div style={{
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.4)",
            borderRadius: "6px",
            padding: "12px 16px",
            marginBottom: "24px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}>
            <div style={{
              width: "8px", height: "8px", borderRadius: "50%",
              background: "#ef4444", boxShadow: "0 0 8px #ef4444",
            }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "11px", fontWeight: 700, color: "#ef4444", letterSpacing: "0.15em" }}>
                AUTONOMOUS LOOP PAUSED
              </div>
              <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.45)", marginTop: "3px" }}>
                {loop.pausedAt ? `since ${timeAgo(loop.pausedAt)}` : ""}
                {loop.pauseReason ? ` · ${loop.pauseReason}` : ""}
                {" · No new Scout/Product cycles or task dispatch. In-flight runs will complete."}
              </div>
            </div>
          </div>
        )}

        {/* ── Summary cards ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "12px", marginBottom: "40px" }}>
          {[
            {
              label: "TOTAL RUNS",
              value: String(s?.totalRuns ?? 0),
              sub: `${s?.mergedCount ?? 0} merged, ${s?.unresolvedCount ?? 0} unresolved${(s?.runningCount ?? 0) > 0 ? `, ${s!.runningCount} running` : ""}`,
            },
            {
              label: "TOTAL COST",
              value: `$${totalCost.toFixed(2)}`,
              sub: `~${totalTokens.toLocaleString()} output tokens`,
            },
            {
              label: "AVG DURATION",
              value: (s?.avgDurationMs ?? 0) > 0 ? fmtDuration(s!.avgDurationMs) : "—",
              sub: (s?.completedRuns ?? 0) > 0 ? `across ${s!.completedRuns} completed run${s!.completedRuns !== 1 ? "s" : ""}` : "no completed runs",
            },
            {
              label: "QUEUE DEPTH",
              value: String(loop?.queue.length ?? 0),
              sub: `${loop?.seenKeyCount ?? 0} issues seen`,
            },
            {
              label: "BACKLOG",
              value: String(loop?.backlogSize ?? 0),
              sub: loop?.lastProductAt ? `updated ${timeAgo(loop.lastProductAt)}` : "not yet scanned",
            },
          ].map((card) => (
            <div key={card.label} style={{
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: "8px", padding: "18px 16px",
            }}>
              <div style={{ fontSize: "8px", letterSpacing: "0.15em", color: "rgba(255,255,255,0.2)", marginBottom: "8px" }}>{card.label}</div>
              <div style={{ fontSize: "22px", fontWeight: 900, color: "white", marginBottom: "4px" }}>{card.value}</div>
              <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.2)" }}>{card.sub}</div>
            </div>
          ))}
        </div>

        {/* ── Autonomous loop status ── */}
        {loop && (
          <div style={{ marginBottom: "40px" }}>
            <div style={{ fontSize: "9px", letterSpacing: "0.2em", color: "rgba(255,255,255,0.2)", marginBottom: "14px", fontWeight: 700 }}>
              AUTONOMOUS LOOP
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              {/* Scout */}
              <div style={{
                background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: "8px", padding: "16px 20px",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                  <span style={{ fontSize: "16px" }}>🛰️</span>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "#34d399" }}>SCOUT DuBois</span>
                  <span style={{
                    fontSize: "8px", padding: "2px 6px", borderRadius: "3px", marginLeft: "auto",
                    background: loop.scoutRunning ? "rgba(52,211,153,0.15)" : "rgba(255,255,255,0.04)",
                    border: `1px solid ${loop.scoutRunning ? "rgba(52,211,153,0.4)" : "rgba(255,255,255,0.08)"}`,
                    color: loop.scoutRunning ? "#34d399" : "rgba(255,255,255,0.25)",
                  }}>{loop.scoutRunning ? "SCANNING" : "IDLE"}</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", fontSize: "9px", color: "rgba(255,255,255,0.3)" }}>
                  <div>Last scan: {timeAgo(loop.lastScoutAt)}</div>
                  <div>Next scan: {timeUntil(loop.nextScoutAt)}</div>
                  <div>Issues seen: {loop.seenKeyCount}</div>
                  <div>Repos: {loop.watchedRepos.length}</div>
                </div>
              </div>
              {/* Product */}
              <div style={{
                background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: "8px", padding: "16px 20px",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                  <span style={{ fontSize: "16px" }}>🔭</span>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "#fb923c" }}>PRODUCT Lokken</span>
                  <span style={{
                    fontSize: "8px", padding: "2px 6px", borderRadius: "3px", marginLeft: "auto",
                    background: loop.productRunning ? "rgba(251,146,60,0.15)" : "rgba(255,255,255,0.04)",
                    border: `1px solid ${loop.productRunning ? "rgba(251,146,60,0.4)" : "rgba(255,255,255,0.08)"}`,
                    color: loop.productRunning ? "#fb923c" : "rgba(255,255,255,0.25)",
                  }}>{loop.productRunning ? "PLANNING" : "IDLE"}</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", fontSize: "9px", color: "rgba(255,255,255,0.3)" }}>
                  <div>Last cycle: {timeAgo(loop.lastProductAt)}</div>
                  <div>Next cycle: {timeUntil(loop.nextProductAt)}</div>
                  <div>Backlog: {loop.backlogSize} items</div>
                  <div>Queue: {loop.queue.length} tasks</div>
                </div>
              </div>
            </div>

            {/* Queue */}
            {loop.queue.length > 0 && (
              <div style={{
                marginTop: "12px", background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.06)", borderRadius: "8px",
                padding: "14px 18px",
              }}>
                <div style={{ fontSize: "8px", letterSpacing: "0.12em", color: "rgba(255,255,255,0.2)", marginBottom: "10px" }}>
                  TASK QUEUE ({loop.queue.length})
                </div>
                {loop.queue.map((t, i) => (
                  <div key={t.id} style={{
                    display: "flex", alignItems: "center", gap: "10px",
                    padding: "6px 0", borderBottom: i < loop.queue.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                  }}>
                    <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.15)", width: "16px" }}>{i + 1}</span>
                    <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.6)", flex: 1 }}>{t.title}</span>
                    <span style={{ fontSize: "8px", color: "rgba(255,255,255,0.15)" }}>{t.repo}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Cost by agent ── */}
        <div style={{ marginBottom: "40px" }}>
          <div style={{ fontSize: "9px", letterSpacing: "0.2em", color: "rgba(255,255,255,0.2)", marginBottom: "14px", fontWeight: 700 }}>
            COST BY AGENT (ALL RUNS)
          </div>
          {agentCosts.length === 0 ? (
            <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.15)", padding: "20px 0" }}>No agent data yet</div>
          ) : (
            <div style={{
              background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: "8px", overflow: "hidden",
            }}>
              {/* Header */}
              <div style={{
                display: "grid", gridTemplateColumns: "200px 70px 100px 100px 80px",
                gap: "8px", padding: "10px 18px",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                fontSize: "8px", letterSpacing: "0.1em", color: "rgba(255,255,255,0.2)",
              }}>
                <div>AGENT</div><div>TURNS</div><div>OUTPUT TOKENS</div><div>COST (EST.)</div><div>% OF TOTAL</div>
              </div>
              {agentCosts.map((a) => {
                const meta = agentMeta(a.agent)
                const pct = totalCost > 0 ? (a.estimatedCostUSD / totalCost * 100) : 0
                return (
                  <div key={a.agent} style={{
                    display: "grid", gridTemplateColumns: "200px 70px 100px 100px 80px",
                    gap: "8px", padding: "10px 18px", alignItems: "center",
                    borderBottom: "1px solid rgba(255,255,255,0.04)",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "13px" }}>{meta.emoji}</span>
                      <div>
                        <div style={{ fontSize: "8px", color: meta.color, fontWeight: 700, letterSpacing: "0.08em", opacity: 0.7 }}>{meta.role}</div>
                        <div style={{ fontSize: "10px", color: meta.color, fontWeight: 700 }}>{meta.character}</div>
                      </div>
                    </div>
                    <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)" }}>{a.turns}</div>
                    <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)" }}>{a.estimatedTokens.toLocaleString()}</div>
                    <div style={{ fontSize: "11px", fontWeight: 700, color: "#fbbf24" }}>${a.estimatedCostUSD.toFixed(4)}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <div style={{
                        height: "4px", borderRadius: "2px", background: meta.color,
                        width: `${Math.max(2, pct)}%`, maxWidth: "60px",
                        boxShadow: `0 0 6px ${meta.color}44`,
                      }} />
                      <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)" }}>{pct.toFixed(0)}%</span>
                    </div>
                  </div>
                )
              })}
              {/* Total row */}
              <div style={{
                display: "grid", gridTemplateColumns: "200px 70px 100px 100px 80px",
                gap: "8px", padding: "12px 18px", alignItems: "center",
                background: "rgba(255,255,255,0.02)",
              }}>
                <div style={{ fontSize: "10px", fontWeight: 700, color: "rgba(255,255,255,0.5)" }}>TOTAL</div>
                <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)" }}>{agentCosts.reduce((s, a) => s + a.turns, 0)}</div>
                <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)" }}>{totalTokens.toLocaleString()}</div>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#fbbf24" }}>${totalCost.toFixed(4)}</div>
                <div />
              </div>
            </div>
          )}
        </div>

        {/* ── Run history ── */}
        <div>
          <div style={{ fontSize: "9px", letterSpacing: "0.2em", color: "rgba(255,255,255,0.2)", marginBottom: "14px", fontWeight: 700 }}>
            RUN HISTORY
          </div>
          {loading ? (
            <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.15)", padding: "20px 0" }}>Loading...</div>
          ) : runs.length === 0 ? (
            <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.15)", padding: "20px 0" }}>No runs yet — autonomous loop is scanning</div>
          ) : (
            <div style={{
              background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: "8px", overflow: "hidden",
            }}>
              {/* Header */}
              <div style={{
                display: "grid", gridTemplateColumns: "1fr 80px 60px 80px 90px 70px",
                gap: "8px", padding: "10px 18px",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                fontSize: "8px", letterSpacing: "0.1em", color: "rgba(255,255,255,0.2)",
              }}>
                <div>TASK</div><div>STATUS</div><div>ROUNDS</div><div>DURATION</div><div>COST (EST.)</div><div>PR</div>
              </div>
              {runs.map((run) => {
                const dur = (run.startedAt && run.finishedAt)
                  ? new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime()
                  : null

                const statusColor = run.status === "merged" ? "#00ff87"
                  : run.status === "running" ? "#60a5fa"
                  : "#f87171"

                return (
                  <div
                    key={run.id}
                    onClick={() => navigate(`/run/${run.id}`)}
                    style={{
                      display: "grid", gridTemplateColumns: "1fr 80px 60px 80px 90px 70px",
                      gap: "8px", padding: "12px 18px", alignItems: "center",
                      borderBottom: "1px solid rgba(255,255,255,0.04)",
                      cursor: "pointer", transition: "background 0.15s",
                    }}
                    onMouseOver={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
                    onMouseOut={(e) => (e.currentTarget.style.background = "none")}
                  >
                    <div>
                      <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.7)", fontWeight: 600, marginBottom: "2px" }}>
                        {run.taskTitle}
                      </div>
                      <div style={{ fontSize: "8px", color: "rgba(255,255,255,0.15)" }}>
                        {new Date(run.startedAt).toLocaleString()}
                      </div>
                    </div>
                    <div style={{
                      fontSize: "9px", fontWeight: 700, letterSpacing: "0.06em",
                      color: statusColor,
                    }}>
                      {run.status === "running" && (
                        <span style={{
                          display: "inline-block", width: "5px", height: "5px", borderRadius: "50%",
                          background: "#60a5fa", boxShadow: "0 0 6px #60a5fa",
                          marginRight: "5px", verticalAlign: "middle",
                        }} />
                      )}
                      {run.status.toUpperCase()}
                    </div>
                    <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)" }}>{run.rounds}</div>
                    <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.35)" }}>
                      {dur !== null ? fmtDuration(dur) : "—"}
                    </div>
                    <div style={{ fontSize: "10px", color: "#fbbf24" }}>
                      {(run.estimatedCostUSD ?? 0) > 0 ? `$${(run.estimatedCostUSD ?? 0).toFixed(4)}` : "—"}
                    </div>
                    <div style={{ fontSize: "10px" }}>
                      {run.prUrl ? (
                        <a
                          href={run.prUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          style={{ color: "#00ff87", textDecoration: "none", fontSize: "9px" }}
                        >
                          VIEW PR
                        </a>
                      ) : "—"}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
