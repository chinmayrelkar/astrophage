// ─── Agent identities ────────────────────────────────────────────────────────

export type AgentName =
  | "pm"
  | "architect"
  | "coder"
  | "reviewer"
  | "tester"
  | "git"
  | "orchestrator"

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
