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

Do the following steps IN ORDER. Run each bash command and show the output.

STEP 1 — Explore the repo at ${task.repo.localPath} to find the bug. Read relevant files.

STEP 2 — Edit the file(s) to fix the bug.

STEP 3 — Create a branch and commit:
\`\`\`
cd ${task.repo.localPath}
git checkout ${task.repo.defaultBranch}
git pull
git checkout -b fix/<short-slug-describing-fix>
git add -A
git commit -m "fix: <one line summary>"
\`\`\`

STEP 4 — Push and open a PR. Run this exact command and show the full output:
\`\`\`
cd ${task.repo.localPath}
git push origin <your-branch>
gh pr create --title "fix: <title>" --body "<describe the bug and your fix>" 2>&1
\`\`\`

STEP 5 — The \`gh pr create\` command prints the PR URL as the last line of output.
Copy that URL exactly and output it on its own line in this exact format:
NEW_PR_URL: https://github.com/chinmayrelkar/bawarchi/pull/<NUMBER>

The number must be from the PR you JUST created in this session, not any previous PR.`

  const result = await promptAndWait(oc, {
    sessionID,
    parts: [{ type: "text", text: prompt }],
  })

  // Extract PR URL — must be the NEW_PR_URL marker, not any other URL in the text
  const prUrlMatch = result.text.match(/NEW_PR_URL:\s*(https:\/\/github\.com\/\S+\/pull\/(\d+))/)
  const prUrl = prUrlMatch?.[1]?.trim()
  const prNumber = prUrlMatch?.[2] ? parseInt(prUrlMatch[2]) : 0

  if (!prUrl || prNumber === 0) {
    throw new Error(`[CODER] Could not extract NEW_PR_URL from response:\n${result.text.slice(0, 400)}`)
  }

  // Extract branch name from the response
  const branchMatch = result.text.match(/git\s+(?:push\s+origin\s+|checkout\s+-b\s+)(fix\/[\w-]+)/)
  const branch = branchMatch?.[1] ?? `fix/round-${round}`

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

  const prompt = `The reviewer has requested changes on your PR. Update it.

PR URL: ${pr.url}
PR number: ${pr.number}
Branch: ${pr.branch}
Repo: ${task.repo.localPath}

Run these steps:
\`\`\`
cd ${task.repo.localPath}
git checkout ${pr.branch}
gh pr view ${pr.number} --comments
\`\`\`

Read every review comment carefully. Then:
1. Edit the relevant files to address ALL concerns
2. Commit: git add -A && git commit -m "fix: address review feedback round ${round}"
3. Force-push: git push origin ${pr.branch} --force-with-lease

Do NOT open a new PR. Do NOT change the branch name. Update PR #${pr.number} only.`

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
