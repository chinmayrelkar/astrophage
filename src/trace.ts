// ─── Trace Tree ───────────────────────────────────────────────────────────────
// Tracks the call graph of agent turns: which agent spawned which, in what order.
// Each pipeline run has a root trace node; every agent turn is a child.

import type { TurnStats } from "./token-tracker.js"

export interface TraceNode {
  id: string
  parentId: string | null
  runId: string
  agent: string
  round: number
  label: string
  startTime: string
  endTime?: string
  durationMs?: number
  tokenStats?: Pick<TurnStats, "inputTokens" | "outputTokens" | "estimatedCostUSD" | "durationMs">
  children: TraceNode[]
}

// ─── Internal flat store ──────────────────────────────────────────────────────

interface SpanRecord {
  id: string
  parentId: string | null
  runId: string
  agent: string
  round: number
  label: string
  startTime: string
  startMs: number
  endTime?: string
  durationMs?: number
  tokenStats?: TraceNode["tokenStats"]
}

// runId → flat list of spans
const _spans = new Map<string, SpanRecord[]>()

let _spanCounter = 0

function nextId(): string {
  return `span_${Date.now()}_${++_spanCounter}`
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Start a new trace span.
 * @returns the new span id
 */
export function startSpan(
  runId: string,
  agent: string,
  round: number,
  label: string,
  parentId?: string,
): string {
  const id = nextId()

  if (!_spans.has(runId)) {
    _spans.set(runId, [])
  }

  _spans.get(runId)!.push({
    id,
    parentId: parentId ?? null,
    runId,
    agent,
    round,
    label,
    startTime: new Date().toISOString(),
    startMs: Date.now(),
  })

  return id
}

/**
 * End a trace span (marks completion, calculates duration).
 */
export function endSpan(
  runId: string,
  spanId: string,
  tokenStats?: TraceNode["tokenStats"],
): void {
  const spans = _spans.get(runId)
  if (!spans) return

  const span = spans.find((s) => s.id === spanId)
  if (!span) return

  const endMs = Date.now()
  span.endTime = new Date().toISOString()
  span.durationMs = endMs - span.startMs
  if (tokenStats) span.tokenStats = tokenStats
}

/**
 * Returns the full nested trace tree for a run.
 * The root node is the orchestrator span (parentId = null).
 */
export function getTraceTree(runId: string): TraceNode | null {
  const spans = _spans.get(runId)
  if (!spans || spans.length === 0) return null

  // Build a map of id → TraceNode
  const nodeMap = new Map<string, TraceNode>()
  for (const span of spans) {
    nodeMap.set(span.id, {
      id: span.id,
      parentId: span.parentId,
      runId: span.runId,
      agent: span.agent,
      round: span.round,
      label: span.label,
      startTime: span.startTime,
      endTime: span.endTime,
      durationMs: span.durationMs,
      tokenStats: span.tokenStats,
      children: [],
    })
  }

  // Wire children
  let root: TraceNode | null = null
  for (const node of nodeMap.values()) {
    if (node.parentId === null) {
      root = node
    } else {
      const parent = nodeMap.get(node.parentId)
      if (parent) {
        parent.children.push(node)
      }
    }
  }

  return root
}

/**
 * Returns all span records for a run as a flat list (useful for cost queries).
 */
export function getSpans(runId: string): SpanRecord[] {
  return [...(_spans.get(runId) ?? [])]
}

/** Clear trace data for a run (optional cleanup). */
export function clearTrace(runId: string): void {
  _spans.delete(runId)
}
