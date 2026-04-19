// ─── Agent identities ────────────────────────────────────────────────────────

export type AgentName =
  | "pm"
  | "architect"
  | "coder"
  | "reviewer"
  | "tester"
  | "scout"
  | "product"
  | "orchestrator"

// ─── Task types ───────────────────────────────────────────────────────────────

/** bug = fix existing code, feature = build new behaviour, spike = investigate feasibility */
export type TaskType = "bug" | "feature" | "spike"

// ─── SSE event emitted to the web UI ─────────────────────────────────────────

export type AgentEventType =
  | "token"
  | "turn_start"
  | "turn_end"
  | "test_result"
  | "verdict"
  | "git_action"
  | "round_start"
  | "convergence"

export interface TokenStats {
  inputTokens: number
  outputTokens: number
  estimatedCostUSD: number
  durationMs: number
}

export interface AgentEvent {
  agent: AgentName
  type: AgentEventType
  content: string
  round: number
  timestamp: string
  tokenStats?: TokenStats
}

// ─── Repo context passed to all agents ───────────────────────────────────────

export interface RepoContext {
  /** Absolute path to the repo on disk */
  localPath: string
  /** Remote URL (GitHub) */
  remoteUrl: string
  /** Default branch */
  defaultBranch: string
  /** Open PRs relevant to this task (populated by Git agent in later iterations) */
  openPRs?: PRRef[]
}

export interface PRRef {
  number: number
  url: string
  title: string
  branch: string
}

// ─── Task handed to the orchestrator ─────────────────────────────────────────

export interface Task {
  id: string
  title: string
  description: string
  /** The repo this task operates on */
  repo: RepoContext
  /** How this task was sourced */
  type?: TaskType
  /** Source reference (issue URL, backlog item id, etc.) */
  sourceRef?: string
}

// ─── Product backlog ──────────────────────────────────────────────────────────

export type BacklogPriority = "critical" | "high" | "medium" | "low"

export interface BacklogItem {
  id: string
  title: string
  description: string
  type: TaskType
  priority: BacklogPriority
  /** Source GitHub issue(s) or discussion URLs */
  sourceRefs: string[]
  /** Estimated complexity: 1 (trivial) – 5 (very complex) */
  complexity: number
  /** If spike: what question needs answering before building */
  spikeQuestion?: string
  /** If false, needs a spike before implementation */
  feasibilityKnown: boolean
  repo: RepoContext
  createdAt: string
  /** Set once a Task has been dispatched for this item */
  dispatchedAt?: string
  dispatchedTaskId?: string
}

export interface Roadmap {
  version: string
  generatedAt: string
  repo: RepoContext
  themes: Array<{
    name: string
    description: string
    items: string[]  // BacklogItem ids
  }>
  backlog: BacklogItem[]
}

// ─── PM plan produced by Stratt ──────────────────────────────────────────────

export interface PMSubtask {
  id: string
  description: string
  assignee: "coder" | "tester" | "reviewer"
  acceptanceCriteria: string
}

export interface PMPlan {
  subtasks: PMSubtask[]
  /** How many coder → tester → reviewer rounds to allow (overrides MAX_ROUNDS) */
  maxRounds: number
  /** What the coder should focus on (injected into coder prompt) */
  focusAreas: string[]
  /** What the reviewer should scrutinise (injected into reviewer prompt) */
  riskFlags: string[]
}

// ─── Spec produced by PM + Architect ─────────────────────────────────────────

export interface Spec {
  taskId: string
  acceptanceCriteria: string[]
  fileContracts: FileContract[]
  testHints: string[]
}

export interface FileContract {
  path: string
  description: string
  interface?: string  // Go/TS interface or function signature
}

// ─── Patch produced by the Coder ─────────────────────────────────────────────

export interface Patch {
  file: string
  originalCode: string
  proposedCode: string
  explanation: string
}

// ─── Reviewer verdict ────────────────────────────────────────────────────────

export type VerdictDecision = "accept" | "reject"

export interface ReviewVerdict {
  decision: VerdictDecision
  reason: string
  /** Which constitution rule was violated (if reject) */
  violatedRule?: string
  /** Is the violated rule non-negotiable? (instant block) */
  nonNegotiable?: boolean
  round: number
}

// ─── Tester output ───────────────────────────────────────────────────────────

export interface TestResult {
  passed: boolean
  output: string
  /** Parsed failures for coder to act on */
  failures: string[]
  round: number
}

// ─── Full round record ───────────────────────────────────────────────────────

export interface Round {
  number: number
  patch: Patch
  testResult: TestResult
  verdict: ReviewVerdict
}

// ─── Final pipeline outcome ───────────────────────────────────────────────────

export type PipelineStatus = "merged" | "unresolved" | "blocked"

export interface PipelineResult {
  taskId: string
  status: PipelineStatus
  rounds: Round[]
  prUrl?: string
  transcript: AgentEvent[]
}
