import { useNavigate } from "react-router-dom"

interface RunSummary {
  id: string
  taskId: string
  taskTitle: string
  startedAt: string
  finishedAt?: string
  status: "running" | "merged" | "unresolved" | "blocked"
  rounds: number
  prUrl?: string
}

interface Props {
  runs: RunSummary[]
  onSelect?: (id: string) => void
}

const STATUS_COLOR: Record<string, string> = {
  running: "#fbbf24",
  merged: "#00ff87",
  unresolved: "#f87171",
  blocked: "#f87171",
}

const STATUS_ICON: Record<string, string> = {
  running: "⟳",
  merged: "✓",
  unresolved: "✗",
  blocked: "⊘",
}

function elapsed(start: string, end?: string) {
  const ms = new Date(end ?? new Date()).getTime() - new Date(start).getTime()
  if (ms < 60000) return `${Math.round(ms / 1000)}s`
  return `${Math.round(ms / 60000)}m`
}

export function TaskHistory({ runs }: Props) {
  const navigate = useNavigate()
  if (runs.length === 0) return null

  return (
    <div style={{
      flexShrink: 0,
      borderTop: "1px solid rgba(255,255,255,0.06)",
      background: "rgba(5,5,20,0.9)",
      display: "flex",
      alignItems: "stretch",
      overflowX: "auto",
      padding: "0 12px",
      gap: "0",
    }}>
      <span style={{
        padding: "8px 12px 8px 0",
        fontSize: "9px",
        color: "rgba(255,255,255,0.2)",
        letterSpacing: "0.1em",
        flexShrink: 0,
        alignSelf: "center",
      }}>
        MISSION LOG
      </span>

      {runs.map((run) => (
        <div
          key={run.id}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "0 16px",
            borderLeft: "1px solid rgba(255,255,255,0.06)",
            cursor: "pointer",
            flexShrink: 0,
            transition: "background 0.15s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.04)" }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent" }}
        >
          <span style={{
            fontSize: "12px",
            color: STATUS_COLOR[run.status],
            fontWeight: run.status === "running" ? 700 : 400,
          }}>
            {STATUS_ICON[run.status]}
          </span>
          <div>
            {/* Title — navigates to run detail page */}
            <div
              onClick={() => navigate(`/run/${run.id}`)}
              style={{
                fontSize: "10px",
                color: "rgba(255,255,255,0.7)",
                maxWidth: "180px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                textDecoration: "underline",
                textDecorationColor: "rgba(255,255,255,0.2)",
              }}
            >
              {run.taskTitle}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "8px", color: "rgba(255,255,255,0.25)" }}>
                {run.rounds}r · {elapsed(run.startedAt, run.finishedAt)} · {new Date(run.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
              {/* PR link */}
              {run.prUrl && (
                <a
                  href={run.prUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  style={{ fontSize: "8px", color: "#00ff87", textDecoration: "none" }}
                >
                  PR →
                </a>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
