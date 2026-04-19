import { useEffect, useState } from "react"

interface RepoContext {
  localPath: string
  remoteUrl: string
  defaultBranch: string
  openPRs?: Array<{ number: number; url: string; title: string; branch: string }>
}

interface TaskInfo {
  id: string
  title: string
  description: string
  repo: RepoContext
}

export function TaskStrip() {
  const [task, setTask] = useState<TaskInfo | null>(null)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch("/task")
        if (res.ok) {
          const data = await res.json()
          if (data) setTask(data)
        }
      } catch { /* server not up yet */ }
    }
    poll()
    const interval = setInterval(poll, 3000)
    return () => clearInterval(interval)
  }, [])

  if (!task) {
    return (
      <div style={{
        padding: "6px 16px",
        borderBottom: "1px solid var(--bg-border)",
        fontSize: "10px",
        color: "var(--text-dim)",
        flexShrink: 0,
      }}>
        no task running
      </div>
    )
  }

  const repoName = task.repo.remoteUrl.replace(/.*github\.com\//, "").replace(/\.git$/, "")

  return (
    <div style={{
      borderBottom: "1px solid var(--bg-border)",
      flexShrink: 0,
      background: "var(--bg-panel)",
    }}>
      {/* Main row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          padding: "6px 16px",
          cursor: "pointer",
        }}
        onClick={() => setExpanded(v => !v)}
      >
        <span style={{ fontSize: "10px", color: "var(--text-dim)", letterSpacing: "0.08em", flexShrink: 0 }}>
          TASK
        </span>
        <span style={{ fontSize: "12px", color: "var(--text-primary)", fontWeight: 700, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {task.title}
        </span>
        <a
          href={task.repo.remoteUrl.replace(/\.git$/, "")}
          target="_blank"
          rel="noreferrer"
          onClick={e => e.stopPropagation()}
          style={{ fontSize: "10px", color: "var(--accent-blue)", textDecoration: "none", flexShrink: 0 }}
        >
          {repoName}
        </a>
        <span style={{ fontSize: "10px", color: "var(--text-dim)", flexShrink: 0 }}>
          {expanded ? "▲" : "▼"}
        </span>
      </div>

      {/* Expanded description */}
      {expanded && (
        <div style={{
          padding: "0 16px 10px 16px",
          fontSize: "11px",
          color: "var(--text-secondary)",
          lineHeight: 1.6,
          borderTop: "1px solid var(--bg-border)",
          paddingTop: "8px",
        }}>
          <div style={{ marginBottom: "6px" }}>{task.description}</div>
          <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
            <span style={{ color: "var(--text-dim)" }}>
              branch: <span style={{ color: "var(--text-secondary)" }}>{task.repo.defaultBranch}</span>
            </span>
            <span style={{ color: "var(--text-dim)" }}>
              id: <span style={{ color: "var(--text-secondary)" }}>{task.id}</span>
            </span>
            {task.repo.openPRs?.map(pr => (
              <a key={pr.number} href={pr.url} target="_blank" rel="noreferrer"
                style={{ color: "var(--accent-blue)", textDecoration: "none", fontSize: "10px" }}>
                PR #{pr.number}: {pr.title}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
