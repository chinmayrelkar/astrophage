import type { OpencodeClient } from "@opencode-ai/sdk/v2"
import { getClient, promptAndWait, registerSession, unregisterSession } from "../client.js"
import type { Task, Patch, RepoContext, ReviewVerdict, TestResult } from "../types.js"
import { agentTurn, emit } from "../transcript.js"

// ─── Coder Agent (Ryland Grace) ───────────────────────────────────────────────
// Explores the repo, fixes the bug, opens a PR, iterates based on PR review comments.

async function getOc(): Promise<OpencodeClient> {
  return getClient()
}

let _sessionID: string | null = null

async function ensureSession(repo: RepoContext): Promise<string> {
  const oc = await getOc()
  if (!_sessionID) {
    const res = await oc.session.create({
      title: "Astrophage Coder — Ryland Grace",
      permission: [
        { permission: "read",               pattern: "*", action: "allow" },
        { permission: "edit",               pattern: "*", action: "allow" },
        { permission: "bash",               pattern: "*", action: "allow" },
        { permission: "glob",               pattern: "*", action: "allow" },
        { permission: "grep",               pattern: "*", action: "allow" },
        { permission: "list",               pattern: "*", action: "allow" },
        { permission: "external_directory", pattern: "*", action: "allow" },
      ],
    })
    _sessionID = res.data!.id
    registerSession(_sessionID, "coder")

    await promptAndWait(oc, {
      sessionID: _sessionID,
      noReply: true,
      parts: [{
        type: "text",
        text: `You are Ryland Grace, the Coder agent in the Astrophage agent company.
You are aboard the Hail Mary. Your job is to fix bugs and ship PRs.

## Repo
- Remote: ${repo.remoteUrl}
- Local path: ${repo.localPath}
- Default branch: ${repo.defaultBranch}

You have full access: read, edit files, run bash, git, gh CLI.

## Rules
- Explore the repo yourself. Do not ask for file locations.
- Never hardcode secrets or credentials.
- If auth env var is missing, exit with a clear error — never proceed silently.
- Keep changes minimal.
- When opening a PR, always use the gh CLI.`,
      }],
    })
  }
  return _sessionID
}

// ─── Round 1: explore, fix, open PR ──────────────────────────────────────────

export interface PRInfo {
  url: string
  number: number
  branch: string
  patch: Patch
}

export async function proposeAndOpenPR(task: Task, round: number): Promise<PRInfo> {
  const oc = await getOc()
  const sessionID = await ensureSession(task.repo)

  emit("coder", "turn_start", "Exploring repo, fixing bug, opening PR", round)
  emit("coder", "git_action", `Branch created, committing fix...`, round)
  console.log(`\n[CODER] Starting round ${round} — will explore, fix, and open PR`)

  const prompt = `Here is your task:

## ${task.title}

${task.description}

Do the following in order:
1. Explore the repo at ${task.repo.localPath} to find the bug
2. Edit the relevant file(s) to fix it
3. Create a branch: git checkout -b fix/<short-slug>
4. Commit: git add -A && git commit -m "fix: <summary>"
5. Push: git push origin <branch>
6. Open a PR with gh:
   gh pr create --title "fix: <title>" --body "<explain the bug and your fix>"

After opening the PR, output ONLY this on the last line:
PR_URL: https://github.com/...`

  const result = await promptAndWait(oc, {
    sessionID,
    parts: [{ type: "text", text: prompt }],
  })

  const prUrlMatch = result.text.match(/PR_URL:\s*(https:\/\/github\.com\/\S+)/)
  const prUrl = prUrlMatch?.[1]?.trim()
  if (!prUrl) throw new Error(`[CODER] Could not extract PR URL from response:\n${result.text.slice(0, 300)}`)

  const prNumberMatch = prUrl.match(/\/pull\/(\d+)/)
  const prNumber = prNumberMatch ? parseInt(prNumberMatch[1]) : 0
  const branchMatch = result.text.match(/git(?:\s+push\s+origin\s+|.*checkout\s+-b\s+)(\S+)/)
  const branch = branchMatch?.[1] ?? "fix/unknown"

  // Extract patch from text for reviewer context
  const patch = parseCoderResponse(result.text, "unknown")
  patch.explanation = result.text.slice(0, 400)

  agentTurn("coder", `PR opened: ${prUrl}`, `Branch: ${branch}`, round)
  emit("coder", "git_action", `Branch created, committing fix...`, round)
  emit("coder", "git_action", `PR opened: ${prUrl}`, round)

  return { url: prUrl, number: prNumber, branch, patch }
}

// ─── Subsequent rounds: read PR review comments, update, force-push ───────────

export async function iterateOnPRFeedback(
  task: Task,
  pr: PRInfo,
  round: number,
): Promise<void> {
  const oc = await getOc()
  const sessionID = await ensureSession(task.repo)

  emit("coder", "turn_start", `Reading PR review comments and updating fix (round ${round})`, round)
  emit("coder", "git_action", `Reading review comments...`, round)
  console.log(`\n[CODER] Iterating on PR feedback — round ${round}`)

  const prompt = `The reviewer has posted review comments on your PR.

PR: ${pr.url}
Branch: ${pr.branch}

Do the following:
1. Read the PR review comments: gh pr view ${pr.number} --comments
2. Read the PR review: gh pr reviews ${pr.number}
3. Address ALL the reviewer's concerns by editing the relevant files
4. Commit the changes: git add -A && git commit -m "fix: address review feedback"
5. Force-push to update the PR: git push origin ${pr.branch} --force-with-lease

Do not open a new PR — update the existing one.`

  await promptAndWait(oc, {
    sessionID,
    parts: [{ type: "text", text: prompt }],
  })

  agentTurn("coder", `PR updated (round ${round})`, `Force-pushed to ${pr.branch}`, round)
  emit("coder", "git_action", `Force-pushing update to PR...`, round)
  emit("coder", "git_action", `PR updated: ${pr.url}`, round)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseCoderResponse(raw: string, fallbackFile: string): Patch {
  const explanationMatch = raw.match(/EXPLANATION:\s*(.+?)(?=FILE:|$)/s)
  const fileMatch = raw.match(/FILE:\s*(.+?)(?=\n|$)/)
  const proposedMatch = raw.match(/PROPOSED:\s*```go\s*([\s\S]+?)```/)
  const originalMatch = raw.match(/ORIGINAL:\s*```go\s*([\s\S]+?)```/)

  return {
    file: fileMatch?.[1]?.trim() ?? fallbackFile,
    originalCode: originalMatch?.[1]?.trim() ?? "",
    proposedCode: proposedMatch?.[1]?.trim() ?? raw,
    explanation: explanationMatch?.[1]?.trim() ?? "No explanation provided",
  }
}

export async function closeCoderSession() {
  const oc = await getOc()
  if (_sessionID) {
    unregisterSession(_sessionID)
    await oc.session.delete({ sessionID: _sessionID }).catch(() => {})
    _sessionID = null
  }
}

export async function resetCoderSession() {
  await closeCoderSession()
}
