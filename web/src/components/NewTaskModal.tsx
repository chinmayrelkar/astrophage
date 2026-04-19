import { useState, useEffect } from "react"

interface TaskOption {
  key: string
  title: string
  description: string
}

interface Props {
  onClose: () => void
}

type Tab = "preset" | "custom"

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "4px",
  color: "rgba(255,255,255,0.85)",
  fontFamily: "inherit",
  fontSize: "11px",
  padding: "8px 10px",
  outline: "none",
  resize: "none",
}

const labelStyle: React.CSSProperties = {
  fontSize: "9px",
  letterSpacing: "0.08em",
  color: "rgba(255,255,255,0.3)",
  marginBottom: "4px",
  display: "block",
}

export function NewTaskModal({ onClose }: Props) {
  const [tab, setTab] = useState<Tab>("preset")

  // Preset tab state
  const [tasks, setTasks] = useState<TaskOption[]>([])
  const [selected, setSelected] = useState<string | null>(null)

  // Custom tab state
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [repoUrl, setRepoUrl] = useState("https://github.com/chinmayrelkar/bawarchi.git")
  const [localPath, setLocalPath] = useState("/home/ubuntu/bawarchi")
  const [branch, setBranch] = useState("main")

  // Shared state
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    fetch("/tasks")
      .then((r) => r.json())
      .then(setTasks)
      .catch(() => setError("Could not fetch available tasks"))
  }, [])

  async function submitPreset() {
    if (!selected) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch("/task/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: selected }),
      })
      const body = await res.json() as { error?: string }
      if (res.status === 202) { setSuccess(true); setTimeout(onClose, 1200) }
      else setError(body.error ?? "Unknown error")
    } catch { setError("Server unreachable") }
    finally { setSubmitting(false) }
  }

  async function submitCustom() {
    if (!title.trim() || !description.trim() || !repoUrl.trim()) {
      setError("Title, description and repo URL are required")
      return
    }
    setSubmitting(true)
    setError(null)
    const task = {
      id: `custom-${Date.now()}`,
      title: title.trim(),
      description: description.trim(),
      repo: {
        localPath: localPath.trim(),
        remoteUrl: repoUrl.trim(),
        defaultBranch: branch.trim() || "main",
      },
    }
    try {
      const res = await fetch("/task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(task),
      })
      const body = await res.json() as { error?: string }
      if (res.status === 202) { setSuccess(true); setTimeout(onClose, 1200) }
      else setError(body.error ?? "Unknown error")
    } catch { setError("Server unreachable") }
    finally { setSubmitting(false) }
  }

  const canSubmit = tab === "preset"
    ? !!selected && !submitting
    : !!title.trim() && !!description.trim() && !!repoUrl.trim() && !submitting

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
        width: "500px",
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
            NEW MISSION
          </span>
          <button onClick={onClose} style={{
            marginLeft: "auto", background: "none", border: "none",
            color: "rgba(255,255,255,0.3)", cursor: "pointer", fontSize: "18px", lineHeight: 1,
          }}>×</button>
        </div>

        {/* Tabs */}
        <div style={{
          display: "flex",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          flexShrink: 0,
        }}>
          {(["preset", "custom"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setError(null) }}
              style={{
                flex: 1,
                padding: "8px",
                background: "none",
                border: "none",
                borderBottom: `2px solid ${tab === t ? "rgba(255,220,80,0.7)" : "transparent"}`,
                color: tab === t ? "rgba(255,220,80,0.9)" : "rgba(255,255,255,0.3)",
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: "10px",
                fontWeight: tab === t ? 700 : 400,
                letterSpacing: "0.08em",
              }}
            >
              {t === "preset" ? "PRESET TASKS" : "CUSTOM TASK"}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "14px" }}>
          {tab === "preset" ? (
            <>
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
                  }}
                  onMouseEnter={(e) => { if (selected !== task.key) e.currentTarget.style.background = "rgba(255,255,255,0.03)" }}
                  onMouseLeave={(e) => { if (selected !== task.key) e.currentTarget.style.background = selected === task.key ? "rgba(255,220,80,0.05)" : "transparent" }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                    <span style={{
                      width: "7px", height: "7px", borderRadius: "50%", flexShrink: 0,
                      background: selected === task.key ? "rgba(255,220,80,0.9)" : "rgba(255,255,255,0.15)",
                    }} />
                    <span style={{ fontSize: "11px", fontWeight: 700, color: selected === task.key ? "rgba(255,220,80,0.9)" : "rgba(255,255,255,0.8)" }}>
                      {task.title}
                    </span>
                    <span style={{ marginLeft: "auto", fontSize: "9px", color: "rgba(255,255,255,0.2)" }}>
                      {task.key}
                    </span>
                  </div>
                  <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.35)", lineHeight: 1.5, paddingLeft: "15px" }}>
                    {task.description.split("\n")[0]}
                  </div>
                </div>
              ))}
            </>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={labelStyle}>TASK TITLE</label>
                <input
                  style={inputStyle}
                  placeholder="e.g. Fix TLS verification bypass in gRPC client"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div>
                <label style={labelStyle}>DESCRIPTION</label>
                <textarea
                  style={{ ...inputStyle, minHeight: "120px" }}
                  placeholder={`Describe the problem in plain English:\n- What is wrong?\n- What should happen instead?\n- Which security rule does this violate?\n\nThe agents will explore the repo and figure out the fix.`}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div>
                <label style={labelStyle}>REPO REMOTE URL</label>
                <input
                  style={inputStyle}
                  placeholder="https://github.com/owner/repo.git"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={labelStyle}>LOCAL PATH</label>
                  <input
                    style={inputStyle}
                    placeholder="/home/ubuntu/myrepo"
                    value={localPath}
                    onChange={(e) => setLocalPath(e.target.value)}
                  />
                </div>
                <div>
                  <label style={labelStyle}>DEFAULT BRANCH</label>
                  <input
                    style={inputStyle}
                    placeholder="main"
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                  />
                </div>
              </div>

              <div style={{
                padding: "10px 12px",
                background: "rgba(96,165,250,0.05)",
                border: "1px solid rgba(96,165,250,0.15)",
                borderRadius: "4px",
                fontSize: "9px",
                color: "rgba(96,165,250,0.6)",
                lineHeight: 1.6,
              }}>
                The repo must be cloned at the local path. Agents read files directly from disk.
                No file locations needed — Ryland Grace will explore the codebase.
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: "12px 16px",
          borderTop: "1px solid rgba(255,255,255,0.08)",
          display: "flex", alignItems: "center", gap: "12px",
        }}>
          {error && <span style={{ fontSize: "10px", color: "#f87171", flex: 1 }}>{error}</span>}
          {success && <span style={{ fontSize: "10px", color: "#00ff87", flex: 1 }}>Mission launched ✓</span>}
          {!error && !success && <span style={{ flex: 1 }} />}
          <button
            onClick={tab === "preset" ? submitPreset : submitCustom}
            disabled={!canSubmit}
            style={{
              background: canSubmit ? "rgba(255,220,80,0.15)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${canSubmit ? "rgba(255,220,80,0.4)" : "rgba(255,255,255,0.08)"}`,
              borderRadius: "4px",
              color: canSubmit ? "rgba(255,220,80,0.9)" : "rgba(255,255,255,0.2)",
              cursor: canSubmit ? "pointer" : "default",
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
