import { useState, useEffect } from "react"

interface TaskOption {
  key: string
  title: string
  description: string
}

interface Props {
  onClose: () => void
}

export function NewTaskModal({ onClose }: Props) {
  const [tasks, setTasks] = useState<TaskOption[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    fetch("/tasks")
      .then((r) => r.json())
      .then(setTasks)
      .catch(() => setError("Could not fetch available tasks"))
  }, [])

  async function submit() {
    if (!selected) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch("/task/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: selected }),
      })
      const body = await res.json()
      if (res.status === 202) {
        setSuccess(true)
        setTimeout(onClose, 1200)
      } else {
        setError(body.error ?? "Unknown error")
      }
    } catch {
      setError("Server unreachable")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: "rgba(0,0,0,0.7)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: "#0a0a18",
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: "8px",
        width: "480px",
        maxHeight: "80vh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        fontFamily: "var(--font-mono, monospace)",
      }}>
        {/* Header */}
        <div style={{
          padding: "16px 20px",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          display: "flex", alignItems: "center", gap: "12px",
        }}>
          <span style={{ fontWeight: 700, fontSize: "12px", letterSpacing: "0.1em", color: "rgba(255,220,80,0.9)" }}>
            NEW TASK
          </span>
          <button onClick={onClose} style={{
            marginLeft: "auto", background: "none", border: "none",
            color: "rgba(255,255,255,0.3)", cursor: "pointer", fontSize: "18px",
          }}>×</button>
        </div>

        {/* Task list */}
        <div style={{ flex: 1, overflowY: "auto", padding: "12px" }}>
          {tasks.length === 0 && !error && (
            <div style={{ padding: "20px", color: "rgba(255,255,255,0.2)", fontSize: "11px", textAlign: "center" }}>
              loading tasks...
            </div>
          )}
          {tasks.map((task) => (
            <div
              key={task.key}
              onClick={() => setSelected(task.key)}
              style={{
                padding: "12px 14px",
                marginBottom: "6px",
                borderRadius: "5px",
                border: `1px solid ${selected === task.key ? "rgba(255,220,80,0.5)" : "rgba(255,255,255,0.06)"}`,
                background: selected === task.key ? "rgba(255,220,80,0.05)" : "transparent",
                cursor: "pointer",
                transition: "all 0.1s",
              }}
              onMouseEnter={(e) => { if (selected !== task.key) e.currentTarget.style.background = "rgba(255,255,255,0.03)" }}
              onMouseLeave={(e) => { if (selected !== task.key) e.currentTarget.style.background = "transparent" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                <span style={{
                  width: "8px", height: "8px", borderRadius: "50%", flexShrink: 0,
                  background: selected === task.key ? "rgba(255,220,80,0.9)" : "rgba(255,255,255,0.15)",
                }} />
                <span style={{ fontSize: "11px", fontWeight: 700, color: selected === task.key ? "rgba(255,220,80,0.9)" : "rgba(255,255,255,0.8)" }}>
                  {task.title}
                </span>
                <span style={{ marginLeft: "auto", fontSize: "9px", color: "rgba(255,255,255,0.2)", letterSpacing: "0.05em" }}>
                  {task.key}
                </span>
              </div>
              <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)", lineHeight: 1.5, paddingLeft: "16px" }}>
                {task.description.split("\n")[0]}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{
          padding: "12px 16px",
          borderTop: "1px solid rgba(255,255,255,0.08)",
          display: "flex", alignItems: "center", gap: "12px",
        }}>
          {error && <span style={{ fontSize: "10px", color: "#f87171", flex: 1 }}>{error}</span>}
          {success && <span style={{ fontSize: "10px", color: "#00ff87", flex: 1 }}>Task submitted ✓</span>}
          {!error && !success && <span style={{ flex: 1 }} />}
          <button
            onClick={submit}
            disabled={!selected || submitting}
            style={{
              background: selected && !submitting ? "rgba(255,220,80,0.15)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${selected && !submitting ? "rgba(255,220,80,0.4)" : "rgba(255,255,255,0.08)"}`,
              borderRadius: "4px",
              color: selected && !submitting ? "rgba(255,220,80,0.9)" : "rgba(255,255,255,0.2)",
              cursor: selected && !submitting ? "pointer" : "default",
              fontFamily: "inherit",
              fontSize: "11px",
              fontWeight: 700,
              letterSpacing: "0.08em",
              padding: "6px 20px",
            }}
          >
            {submitting ? "LAUNCHING…" : "LAUNCH MISSION"}
          </button>
        </div>
      </div>
    </div>
  )
}
