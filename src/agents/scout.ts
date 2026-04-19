import type { OpencodeClient } from "@opencode-ai/sdk/v2"
import { getClient, promptAndWait, registerSession, unregisterSession } from "../client.js"
import type { Task, RepoContext } from "../types.js"
import { emit } from "../transcript.js"
import { readFileSync, existsSync } from "fs"
import { join } from "path"
import { homedir } from "os"

// ─── Scout Agent (DuBois) ─────────────────────────────────────────────────────
// DuBois runs two scan passes per cycle:
//
//  Pass A — GitHub Issues: lists open issues, decides which are autonomously fixable
//  Pass B — Code scan: reads the codebase directly for constitution violations,
//            security anti-patterns, hardcoded secrets, FIXME/TODO markers
//
// Both passes produce ScoutDecision items. They are merged, deduplicated, and
// fed into the autonomous pipeline. DuBois never edits code — observe and report.

async function getOc(): Promise<OpencodeClient> {
  return getClient()
}

let _sessionID: string | null = null

const WATCHED_REPOS_PATH = join(homedir(), ".astrophage", "watched-repos.json")

const DEFAULT_REPOS: RepoContext[] = [
  {
    remoteUrl: "https://github.com/chinmayrelkar/bawarchi.git",
    localPath: "/home/ubuntu/bawarchi",
    defaultBranch: "main",
  },
]

function loadWatchedRepos(): RepoContext[] {
  try {
    if (existsSync(WATCHED_REPOS_PATH)) {
      return JSON.parse(readFileSync(WATCHED_REPOS_PATH, "utf8")) as RepoContext[]
    }
  } catch {
    console.warn("[SCOUT] Failed to load watched-repos.json, using defaults")
  }
  return [...DEFAULT_REPOS]
}

const WATCHED_REPOS: RepoContext[] = loadWatchedRepos()

async function ensureSession(repo: RepoContext): Promise<string> {
  const oc = await getOc()
  if (!_sessionID) {
    const res = await oc.session.create({
      title: "Astrophage Scout — DuBois",
      permission: [
        { permission: "bash",               pattern: "*", action: "allow" },
        { permission: "read",               pattern: "*", action: "allow" },
        { permission: "glob",               pattern: "*", action: "allow" },
        { permission: "grep",               pattern: "*", action: "allow" },
        { permission: "list",               pattern: "*", action: "allow" },
        { permission: "external_directory", pattern: "*", action: "allow" },
        { permission: "edit",               pattern: "*", action: "deny" },
      ],
    })
    _sessionID = res.data!.id
    registerSession(_sessionID, "scout")

    await promptAndWait(oc, {
      sessionID: _sessionID,
      noReply: true,
      parts: [{
        type: "text",
        text: `You are DuBois, the Scout agent in the Astrophage agent company.
You are aboard the Hail Mary. Your job is to find engineering work — from two sources:

1. GitHub Issues on watched repos — bugs and security reports filed by humans
2. The codebase itself — violations you find by reading the code directly

## What makes something actionable
- A concrete, fixable bug or security flaw
- Can be resolved with a code change, no human decisions required
- Not already fixed or in-progress (no open PR addressing it)
- Testable: a test can verify the fix worked

## What is NOT actionable
- Feature requests or design discussions
- Infrastructure / deployment issues
- Issues already assigned or with an open PR
- Anything requiring external access or human approval

## Constitution — non-negotiable rules to scan for
- No hardcoded secrets, API keys, or credentials in source code
- No credentials in URL query parameters — use headers or env vars
- Authentication must never silently succeed when env var is missing — hard error
- No TLS verification disabled in production code
- No debug endpoints or backdoors left in production code

## Repo
- Remote: ${repo.remoteUrl}
- Local path: ${repo.localPath}
- Default branch: ${repo.defaultBranch}

You have read-only access. Never edit files.`,
      }],
    })
  }
  return _sessionID
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type ScoutSource = "github_issue" | "code_scan"

export interface ScoutDecision {
  source: ScoutSource
  /** Issue number for github_issue; unique slug for code_scan */
  ref: string
  /** Full URL for issues; file path for code_scan */
  url: string
  repo: RepoContext
  actionable: boolean
  reason: string
  task?: Task
}

export interface ScoutResult {
  scannedAt: string
  decisions: ScoutDecision[]
  actionableTasks: Task[]
}

// ─── Pass A: GitHub Issues scan ───────────────────────────────────────────────

async function scanGitHubIssues(
  repo: RepoContext,
  seenKeys: Set<string>,
): Promise<ScoutDecision[]> {
  const oc = await getOc()
  const sessionID = await ensureSession(repo)
  const repoSlug = toSlug(repo.remoteUrl)

  emit("scout", "turn_start", `[Pass A] GitHub issues: ${repoSlug}`, 0)
  console.log(`\n[SCOUT] Pass A — GitHub issues: ${repoSlug}`)

  // Step 1: fetch, read, and produce JSON in one shot
  const seenList = [...seenKeys].filter((k) => k.startsWith(`github_issue:${repoSlug}#`)).join(", ")
  const step1 = await promptAndWait(oc, {
    sessionID,
    parts: [{
      type: "text",
      text: `Fetch and read all open GitHub issues for ${repoSlug}.

Run:
gh issue list --repo ${repoSlug} --state open --json number,title,body,labels,assignees --limit 30

Then for each issue run:
gh issue view <number> --repo ${repoSlug} --comments

Already-seen issue IDs (skip): [${seenList || "none"}]

If there are no open issues, output an empty array: []

Otherwise output a JSON array of triage decisions:
[
  {
    "issueNumber": 42,
    "issueUrl": "https://github.com/${repoSlug}/issues/42",
    "actionable": true,
    "reason": "Clear security bug: API key in URL — straightforward code fix",
    "taskTitle": "Fix API key exposure in URL query parameter",
    "taskDescription": "Detailed description: what is wrong, what the fix looks like, which files."
  },
  {
    "issueNumber": 43,
    "issueUrl": "https://github.com/${repoSlug}/issues/43",
    "actionable": false,
    "reason": "Feature request — not autonomously fixable"
  }
]

Include every issue you read. Omit taskTitle/taskDescription for non-actionable ones.`,
    }],
  })

  let decisions = parseIssueDecisions(step1.text, repo, repoSlug)

  if (decisions.length === 0 && !step1.text.includes("[]") && !step1.text.toLowerCase().includes("no open issues")) {
    // Model didn't produce JSON — ask explicitly
    const step2 = await promptAndWait(oc, {
      sessionID,
      parts: [{
        type: "text",
        text: `Output ONLY the JSON array of your triage decisions (or [] if no issues):`,
      }],
    })
    decisions = parseIssueDecisions(step2.text, repo, repoSlug)
  }
  console.log(`[SCOUT] Pass A done: ${decisions.length} issues, ${decisions.filter(d => d.actionable).length} actionable`)
  return decisions
}

// ─── Pass B: Code scan ────────────────────────────────────────────────────────

async function scanCode(
  repo: RepoContext,
  seenKeys: Set<string>,
): Promise<ScoutDecision[]> {
  const oc = await getOc()
  const sessionID = await ensureSession(repo)
  const repoSlug = toSlug(repo.remoteUrl)

  emit("scout", "turn_start", `[Pass B] Code scan: ${repo.localPath}`, 0)
  console.log(`\n[SCOUT] Pass B — Code scan: ${repo.localPath}`)

  // Step 1: explore + produce JSON in one shot
  // (model often produces the JSON during exploration — capture it and try parsing immediately)
  const seenList = [...seenKeys].filter((k) => k.startsWith(`code_scan:${repoSlug}:`)).join(", ")
  const step1 = await promptAndWait(oc, {
    sessionID,
    parts: [{
      type: "text",
      text: `Now scan the codebase at ${repo.localPath} for bugs and constitution violations.

Look for:
1. Hardcoded secrets, API keys, tokens, passwords in source files
2. Credentials passed as URL query parameters instead of headers
3. Auth checks that silently pass when env var is missing (should hard-error)
4. TLS verification disabled (InsecureSkipVerify, tls.Config with InsecureSkipVerify: true, etc.)
5. TODO/FIXME comments that describe a known bug or security issue
6. Debug endpoints, backdoors, or test credentials left in production code
7. Any other clear violation of secure coding practices

Run these commands to explore:
ls ${repo.localPath}
find ${repo.localPath} -name "*.go" -o -name "*.ts" -o -name "*.js" -o -name "*.py" | head -40
grep -r "InsecureSkipVerify\\|password\\|secret\\|api_key\\|apikey\\|TODO\\|FIXME\\|hardcoded" ${repo.localPath} --include="*.go" -l
grep -r "InsecureSkipVerify\\|password\\|secret\\|api_key\\|apikey\\|TODO\\|FIXME\\|hardcoded" ${repo.localPath} --include="*.go" -n

Read the relevant source files in full to understand each issue in context.
Already-seen (skip): [${seenList || "none"}]

When you are done exploring, output your findings as a JSON array.
Use a short slug as the ref field.

[
  {
    "ref": "tls-skip-verify-grpc",
    "filePath": "internal/generator/grpc.go",
    "actionable": true,
    "reason": "InsecureSkipVerify hardcoded in template",
    "taskTitle": "Fix TLS verification bypass in gRPC template",
    "taskDescription": "Exact file, lines, what is wrong, what the correct fix looks like."
  }
]

Only flag clear violations. Be conservative.`,
    }],
  })

  // Try to parse from step 1 — if the model already produced valid JSON, use it directly
  let decisions = parseCodeDecisions(step1.text, repo, repoSlug)

  if (decisions.length === 0) {
    // Step 2: model didn't produce JSON in step 1 — ask explicitly
    const step2 = await promptAndWait(oc, {
      sessionID,
      parts: [{
        type: "text",
        text: `Now output ONLY the JSON array of your findings, nothing else:

[
  {
    "ref": "slug",
    "filePath": "path/to/file.go",
    "actionable": true,
    "reason": "...",
    "taskTitle": "...",
    "taskDescription": "..."
  }
]

If you found no violations, output an empty array: []`,
      }],
    })
    decisions = parseCodeDecisions(step2.text, repo, repoSlug)
  }
  console.log(`[SCOUT] Pass B done: ${decisions.length} findings, ${decisions.filter(d => d.actionable).length} actionable`)
  return decisions
}

// ─── Full scan: both passes ────────────────────────────────────────────────────

export async function runScout(seenKeys: Set<string>): Promise<ScoutResult> {
  emit("scout", "turn_start", `Scout scanning ${WATCHED_REPOS.length} repo(s) — GitHub issues + code`, 0)
  console.log(`\n[SCOUT — DuBois] Starting scan cycle (issues + code)`)

  const allDecisions: ScoutDecision[] = []

  for (const repo of WATCHED_REPOS) {
    const repoSlug = toSlug(repo.remoteUrl)
    try {
      // Run both passes sequentially on the same session (same context window)
      const issueDecisions = await scanGitHubIssues(repo, seenKeys)
      const codeDecisions  = await scanCode(repo, seenKeys)
      allDecisions.push(...issueDecisions, ...codeDecisions)
    } catch (err) {
      console.error(`[SCOUT] Failed to scan ${repoSlug}: ${err}`)
      emit("scout", "convergence", `Scan failed for ${repoSlug}: ${err}`, 0)
    }
  }

  const actionableTasks = allDecisions
    .filter((d) => d.actionable && d.task != null)
    .map((d) => d.task!)

  const summary = `Cycle complete — ${allDecisions.length} total findings, ${actionableTasks.length} task(s) queued`
  emit("scout", "turn_end", summary, 0)
  console.log(`[SCOUT — DuBois] ${summary}`)

  return { scannedAt: new Date().toISOString(), decisions: allDecisions, actionableTasks }
}

// ─── Parsers ──────────────────────────────────────────────────────────────────

function parseIssueDecisions(text: string, repo: RepoContext, repoSlug: string): ScoutDecision[] {
  const candidates = extractJsonArrayCandidates(text)
  for (const c of candidates) {
    try {
      const arr = JSON.parse(c)
      if (!Array.isArray(arr)) continue
      // Empty array = no issues — valid, return cleanly
      if (arr.length === 0) return []
      const decisions: ScoutDecision[] = []
      for (const item of arr) {
        if (typeof item.issueNumber !== "number") continue
        const num = item.issueNumber as number
        const url = String(item.issueUrl ?? `https://github.com/${repoSlug}/issues/${num}`)
        const actionable = Boolean(item.actionable)
        const ref = `github_issue:${repoSlug}#${num}`
        let task: Task | undefined
        if (actionable && item.taskTitle && item.taskDescription) {
          task = {
            id: `scout-${repoSlug.replace("/", "-")}-issue-${num}`,
            title: String(item.taskTitle),
            description: `[GitHub Issue #${num}](${url})\n\n${String(item.taskDescription)}`,
            repo,
          }
        }
        decisions.push({ source: "github_issue", ref, url, repo, actionable, reason: String(item.reason ?? ""), task })
      }
      // Return even if decisions is empty (items existed but none had issueNumber)
      return decisions
    } catch { /* try next */ }
  }
  // No parseable array found at all — warn only in this case
  console.warn(`[SCOUT] Could not parse issue decisions. Raw: ${text.slice(0, 300)}`)
  return []
}

function parseCodeDecisions(text: string, repo: RepoContext, repoSlug: string): ScoutDecision[] {
  const candidates = extractJsonArrayCandidates(text)
  for (const c of candidates) {
    try {
      const arr = JSON.parse(c)
      if (!Array.isArray(arr)) continue
      // Empty array = no violations found — valid
      if (arr.length === 0) return []
      const decisions: ScoutDecision[] = []
      for (const item of arr) {
        if (!item.ref) continue
        const ref = `code_scan:${repoSlug}:${String(item.ref)}`
        const filePath = String(item.filePath ?? "")
        const url = filePath
          ? `https://github.com/${repoSlug}/blob/${repo.defaultBranch}/${filePath}`
          : `https://github.com/${repoSlug}`
        const actionable = Boolean(item.actionable)
        let task: Task | undefined
        if (actionable && item.taskTitle && item.taskDescription) {
          task = {
            id: `scout-${repoSlug.replace("/", "-")}-code-${String(item.ref)}`,
            title: String(item.taskTitle),
            description: `[Code finding: ${item.ref}](${url})\n\nFile: \`${filePath}\`\n\n${String(item.taskDescription)}`,
            repo,
          }
        }
        decisions.push({ source: "code_scan", ref, url, repo, actionable, reason: String(item.reason ?? ""), task })
      }
      return decisions
    } catch { /* try next */ }
  }
  console.warn(`[SCOUT] Could not parse code decisions. Raw: ${text.slice(0, 300)}`)
  return []
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toSlug(remoteUrl: string): string {
  return remoteUrl.replace(/.*github\.com\//, "").replace(/\.git$/, "")
}

function extractJsonArrayCandidates(text: string): string[] {
  const candidates: string[] = []
  const fenceMatches = text.matchAll(/```(?:json)?\s*([\s\S]+?)```/g)
  for (const m of fenceMatches) {
    if (m[1]) candidates.push(m[1].trim())
  }
  let depth = 0
  let start = -1
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "[") {
      if (depth === 0) start = i
      depth++
    } else if (text[i] === "]") {
      depth--
      if (depth === 0 && start !== -1) {
        candidates.push(text.slice(start, i + 1))
        start = -1
      }
    }
  }
  candidates.sort((a, b) => b.length - a.length)
  return candidates
}

// ─── Watched repos management ─────────────────────────────────────────────────

export function addWatchedRepo(repo: RepoContext): void {
  if (!WATCHED_REPOS.some((r) => r.remoteUrl === repo.remoteUrl)) {
    WATCHED_REPOS.push(repo)
  }
}

export function getWatchedRepos(): RepoContext[] {
  return [...WATCHED_REPOS]
}

// ─── Session lifecycle ────────────────────────────────────────────────────────

export async function closeScoutSession(): Promise<void> {
  const oc = await getOc()
  if (_sessionID) {
    unregisterSession(_sessionID)
    await oc.session.delete({ sessionID: _sessionID }).catch(() => {})
    _sessionID = null
  }
}

export async function resetScoutSession(): Promise<void> {
  await closeScoutSession()
}
