import type { RunSummary, RunDetail } from "../hooks/useRunHistory"

interface Props {
  runs: RunSummary[]
  selected: RunDetail | null
  loadingDetail: boolean
  onSelect: (id: string) => void
  onClose: () => void
}

const STATUS_COLOR: Record<string, string> = {
  running: "var(--accent-amber)",
  merged: "var(--accent-green)",
  unresolved: "var(--accent-red)",
  blocked: "var(--accent-red)",
}

const STATUS_LABEL: Record<string, string> = {
  running: "RUNNING",
  merged: "MERGED",
  unresolved: "UNRESOLVED",
  blocked: "BLOCKED",
}

function elapsed(start: string, end?: string): string {
  const ms = new Date(end ?? new Date()).getTime() - new Date(start).getTime()
  if (ms < 60000) return `${Math.round(ms / 1000)}s`
  return `${Math.round(ms / 60000)}m`
}

export function RunHistory({ runs, selected, loadingDetail, onSelect, onClose }: Props) {
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        bottom: 0,
        width: "340px",
        background: "var(--bg-panel)",
        borderLeft: "1px solid var(--bg-border)",
        display: "flex",
        flexDirection: "column",
        zIndex: 100,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "12px 16px",
          borderBottom: "1px solid var(--bg-border)",
          flexShrink: 0,
        }}
      >
        <span style={{ fontWeight: 700, fontSize: "11px", letterSpacing: "0.1em", color: "var(--text-primary)" }}>
          RUN HISTORY
        </span>
        <button
          onClick={onClose}
          style={{
            marginLeft: "auto",
            background: "none",
            border: "none",
            color: "var(--text-dim)",
            cursor: "pointer",
            fontSize: "16px",
            lineHeight: 1,
            padding: "0 4px",
          }}
        >
          ×
        </button>
      </div>

      {/* Detail view */}
      {selected ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div
            style={{
              padding: "10px 16px",
              borderBottom: "1px solid var(--bg-border)",
              flexShrink: 0,
            }}
          >
            <button
              onClick={onClose}
              style={{
                background: "none",
                border: "none",
                color: "var(--accent-blue)",
                cursor: "pointer",
                fontSize: "11px",
                padding: 0,
                marginBottom: "6px",
              }}
            >
              ← back
            </button>
            <div style={{ fontSize: "12px", color: "var(--text-primary)", fontWeight: 700 }}>
              {selected.taskTitle}
            </div>
            <div style={{ fontSize: "10px", color: "var(--text-dim)", marginTop: "4px" }}>
              {selected.rounds} round{selected.rounds !== 1 ? "s" : ""} ·{" "}
              {elapsed(selected.startedAt, selected.finishedAt)} ·{" "}
              <span style={{ color: STATUS_COLOR[selected.status] }}>
                {STATUS_LABEL[selected.status]}
              </span>
            </div>
          </div>
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "10px 16px",
              fontSize: "10px",
              fontFamily: "var(--font-mono)",
              lineHeight: 1.6,
            }}
          >
            {selected.events
              .filter((e) => e.type !== "token")
              .map((e, i) => (
                <div key={i} style={{ marginBottom: "4px", display: "flex", gap: "8px" }}>
                  <span style={{ color: "var(--text-dim)", flexShrink: 0, width: "80px" }}>
                    [{e.agent.toUpperCase().slice(0, 6)}]
                  </span>
                  <span
                    style={{
                      color: e.type === "convergence"
                        ? e.content.startsWith("ACCEPT") ? "var(--accent-green)" : "var(--accent-red)"
                        : e.type === "verdict" ? "var(--accent-amber)"
                        : "var(--text-secondary)",
                      wordBreak: "break-word",
                    }}
                  >
                    {e.type === "verdict"
                      ? (() => {
                          try {
                            const v = JSON.parse(e.content)
                            return `${v.decision.toUpperCase()}: ${v.reason}`
                          } catch { return e.content }
                        })()
                      : e.content.slice(0, 200)}
                  </span>
                </div>
              ))}
          </div>
        </div>
      ) : (
        /* Run list */
        <div style={{ flex: 1, overflowY: "auto" }}>
          {runs.length === 0 ? (
            <div style={{ padding: "20px 16px", color: "var(--text-dim)", fontSize: "11px" }}>
              No runs yet. Start the orchestrator to begin.
            </div>
          ) : (
            [...runs].reverse().map((run) => (
              <div
                key={run.id}
                onClick={() => onSelect(run.id)}
                style={{
                  padding: "12px 16px",
                  borderBottom: "1px solid var(--bg-border)",
                  cursor: "pointer",
                  transition: "background 0.1s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-panel-hover)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                  <span
                    style={{
                      width: "6px",
                      height: "6px",
                      borderRadius: "50%",
                      background: STATUS_COLOR[run.status],
                      flexShrink: 0,
                      boxShadow: run.status === "running" ? `0 0 6px ${STATUS_COLOR[run.status]}` : "none",
                    }}
                  />
                  <span style={{ fontSize: "11px", color: "var(--text-primary)", fontWeight: 700 }}>
                    {STATUS_LABEL[run.status]}
                  </span>
                  <span style={{ marginLeft: "auto", fontSize: "10px", color: "var(--text-dim)" }}>
                    {elapsed(run.startedAt, run.finishedAt)}
                  </span>
                </div>
                <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginLeft: "14px" }}>
                  {run.taskTitle}
                </div>
                <div style={{ fontSize: "10px", color: "var(--text-dim)", marginLeft: "14px", marginTop: "2px" }}>
                  {run.rounds} round{run.rounds !== 1 ? "s" : ""} · {new Date(run.startedAt).toLocaleTimeString()}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {loadingDetail && (
        <div style={{ padding: "8px 16px", fontSize: "10px", color: "var(--text-dim)", flexShrink: 0 }}>
          loading...
        </div>
      )}
    </div>
  )
}
