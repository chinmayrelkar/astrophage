import React from "react"
import type { AgentEvent } from "../hooks/useAgentStream"

interface Props {
  currentRound: number
  maxRounds?: number
  events: AgentEvent[]
}

export function ConvergenceBar({ currentRound, maxRounds = 5, events }: Props) {
  const lastVerdict = [...events].reverse().find((e) => e.type === "verdict")
  const lastTest = [...events].reverse().find((e) => e.type === "test_result")
  const convergence = [...events].reverse().find((e) => e.type === "convergence")

  let verdictLabel = "—"
  let verdictColor = "var(--text-dim)"
  if (lastVerdict) {
    try {
      const v = JSON.parse(lastVerdict.content)
      verdictLabel = v.decision === "accept" ? "ACCEPT" : v.nonNegotiable ? "BLOCKED" : "REJECT"
      verdictColor =
        v.decision === "accept"
          ? "var(--accent-green)"
          : v.nonNegotiable
          ? "var(--accent-red)"
          : "var(--accent-amber)"
    } catch {
      verdictLabel = lastVerdict.content.slice(0, 20)
    }
  }

  let testLabel = "—"
  let testColor = "var(--text-dim)"
  if (lastTest) {
    try {
      const t = JSON.parse(lastTest.content)
      testLabel = t.passed ? "PASS" : "FAIL"
      testColor = t.passed ? "var(--accent-green)" : "var(--accent-red)"
    } catch {
      testLabel = "?"
    }
  }

  const progress = currentRound > 0 ? (currentRound / maxRounds) * 100 : 0
  const isResolved = convergence != null
  const resolvedLabel = convergence?.content ?? ""

  return (
    <div
      style={{
        background: "var(--bg-panel)",
        border: "1px solid var(--bg-border)",
        borderRadius: "4px",
        padding: "10px 16px",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        flexShrink: 0,
      }}
    >
      {/* Status row */}
      <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
        <span style={{ color: "var(--text-dim)", fontSize: "10px", letterSpacing: "0.1em" }}>
          CONVERGENCE
        </span>
        <span style={{ color: "var(--text-secondary)", fontSize: "11px" }}>
          Round{" "}
          <span style={{ color: "var(--text-primary)", fontWeight: 700 }}>
            {currentRound || "—"}
          </span>
          /{maxRounds}
        </span>
        <span style={{ fontSize: "11px" }}>
          Tests: <span style={{ color: testColor, fontWeight: 700 }}>{testLabel}</span>
        </span>
        <span style={{ fontSize: "11px" }}>
          Reviewer: <span style={{ color: verdictColor, fontWeight: 700 }}>{verdictLabel}</span>
        </span>
        {isResolved && (
          <span
            style={{
              marginLeft: "auto",
              fontSize: "11px",
              color: resolvedLabel.startsWith("ACCEPT") ? "var(--accent-green)" : "var(--accent-red)",
              fontWeight: 700,
            }}
          >
            {resolvedLabel.startsWith("ACCEPT") ? "✓ MERGED" : "✗ UNRESOLVED"}
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div
        style={{
          height: "3px",
          background: "var(--bg-border)",
          borderRadius: "2px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${progress}%`,
            background: isResolved
              ? resolvedLabel.startsWith("ACCEPT")
                ? "var(--accent-green)"
                : "var(--accent-red)"
              : "var(--accent-amber)",
            borderRadius: "2px",
            transition: "width 0.4s ease",
          }}
        />
      </div>
    </div>
  )
}
