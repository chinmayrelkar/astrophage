import type { OpencodeClient } from "@opencode-ai/sdk/v2"
import { getClient, promptAndWait } from "../client.js"
import type { Task, Patch, RepoContext, ReviewVerdict, TestResult } from "../types.js"
import { agentTurn, emit } from "../transcript.js"

// ─── Coder Agent ──────────────────────────────────────────────────────────────

async function getOc(): Promise<OpencodeClient> {
  return getClient()
}

let _sessionID: string | null = null

async function ensureSession(repo: RepoContext): Promise<string> {
  const oc = await getOc()
  if (!_sessionID) {
    const res = await oc.session.create({
      title: "Astrophage Coder — Ryland Grace",
      // Allow full read/write/bash access — coder needs to edit files, run git, open PRs
      permission: [
        { permission: "read",   pattern: "*", action: "allow" },
        { permission: "edit",   pattern: "*", action: "allow" },
        { permission: "bash",   pattern: "*", action: "allow" },
        { permission: "glob",   pattern: "*", action: "allow" },
        { permission: "grep",   pattern: "*", action: "allow" },
        { permission: "list",   pattern: "*", action: "allow" },
        { permission: "external_directory", pattern: "*", action: "allow" },
      ],
    })
    _sessionID = res.data!.id

    await promptAndWait(oc, {
      sessionID: _sessionID,
      noReply: true,
      parts: [{
        type: "text",
        text: `You are Ryland Grace, the Coder agent in the Astrophage agent company.
You are aboard the Hail Mary. Your job is to fix bugs in Go codebases and ship the fix as a PR.

## Repo
- Remote: ${repo.remoteUrl}
- Local: ${repo.localPath}
- Branch: ${repo.defaultBranch}
${repo.openPRs?.length ? `- Open PRs: ${repo.openPRs.map(pr => `#${pr.number} "${pr.title}" ${pr.url}`).join(", ")}` : ""}

The codebase is in your working directory. Use your tools freely — read files,
search, edit, run bash commands including git and gh.

## Rules
- Explore the repo to find the relevant code. Do not ask for file locations.
- Explain WHY your change fixes the problem.
- Never hardcode secrets, tokens, or credentials.
- If auth is required and the env var is missing, exit with a clear error — never proceed silently.
- Keep changes minimal.

## After your fix is approved by the reviewer, you will be asked to:
1. Create a branch: git checkout -b fix/<short-name>
2. Apply your edit to the file
3. Commit: git add <file> && git commit -m "<message>"
4. Push and open a PR: git push origin <branch> && gh pr create --title "..." --body "..."

## Output format for the initial fix proposal
Respond in EXACTLY this format, no other text:
EXPLANATION: <why this fixes the problem>
FILE: <relative path from repo root>
ORIGINAL:
\`\`\`go
<original code snippet you are replacing>
\`\`\`
PROPOSED:
\`\`\`go
<your fixed version>
\`\`\``,
      }],
    })
  }
  return _sessionID
}

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

export async function proposeInitialFix(task: Task, round: number): Promise<Patch> {
  const oc = await getOc()
  const sessionID = await ensureSession(task.repo)

  emit("coder", "turn_start", "Exploring repo and proposing fix", round)
  console.log(`\n[CODER] Reading task: ${task.title}`)

  const prompt = `Here is your task:

## ${task.title}

${task.description}

Explore the repo, find the relevant code, and propose a minimal fix.
Follow the output format exactly.`

  const result = await promptAndWait(oc, {
    sessionID,
    parts: [{ type: "text", text: prompt }],
  })

  const patch = parseCoderResponse(result.text, "unknown")
  agentTurn("coder", "Fix proposed", `${patch.explanation}\n\n→ ${patch.file}`, round)
  return patch
}

export async function iterateFix(
  task: Task,
  previousPatch: Patch,
  verdict: ReviewVerdict | null,
  testResult: TestResult | null,
  round: number,
): Promise<Patch> {
  const oc = await getOc()
  const sessionID = await ensureSession(task.repo)

  emit("coder", "turn_start", `Iterating fix (round ${round})`, round)
  console.log(`\n[CODER] Iterating — round ${round}`)

  let context = `Your previous fix for ${previousPatch.file}:\n\`\`\`go\n${previousPatch.proposedCode}\n\`\`\`\n\n`

  if (testResult && !testResult.passed) {
    context += `Tests FAILED:\n${testResult.failures.join("\n")}\n\n`
  }

  if (verdict?.decision === "reject") {
    context += `Reviewer rejected: ${verdict.reason}`
    if (verdict.nonNegotiable) {
      context += ` [NON-NEGOTIABLE: ${verdict.violatedRule}]`
    }
    context += "\n\n"
  }

  context += "Revise your fix. Follow the output format exactly."

  const result = await promptAndWait(oc, {
    sessionID,
    parts: [{ type: "text", text: context }],
  })

  const patch = parseCoderResponse(result.text, previousPatch.file)
  agentTurn("coder", `Revised fix (round ${round})`, patch.explanation, round)
  return patch
}

/** After reviewer accepts — branch, apply patch, commit, push, open PR */
export async function commitAndPR(task: Task, patch: Patch): Promise<string | null> {
  const oc = await getOc()
  const sessionID = await ensureSession(task.repo)

  emit("coder", "turn_start", "Branching, committing and opening PR", 0)
  console.log(`\n[CODER] Shipping fix to ${task.repo.remoteUrl}...`)

  const prompt = `The reviewer has accepted your fix. Now ship it.

Your approved fix:
FILE: ${patch.file}
ORIGINAL:
\`\`\`go
${patch.originalCode}
\`\`\`
PROPOSED:
\`\`\`go
${patch.proposedCode}
\`\`\`

Steps to execute RIGHT NOW using bash:
1. cd to the repo root (${task.repo.localPath})
2. Make sure you're on ${task.repo.defaultBranch}: git checkout ${task.repo.defaultBranch} && git pull
3. Create a branch: git checkout -b fix/<short-slug-from-task-title>
4. Apply your change to ${patch.file}
5. git add ${patch.file}
6. git commit -m "fix: <one line summary>"
7. git push origin <branch>
8. gh pr create --title "<title>" --body "<body describing the fix and why>"

After creating the PR, output ONLY the PR URL on a line by itself, like:
PR_URL: https://github.com/...`

  const result = await promptAndWait(oc, {
    sessionID,
    parts: [{ type: "text", text: prompt }],
  })

  const prMatch = result.text.match(/PR_URL:\s*(https:\/\/github\.com\/\S+)/)
  const prUrl = prMatch?.[1] ?? null

  agentTurn("coder", "PR opened", prUrl ? `PR: ${prUrl}` : "Could not extract PR URL", 0)
  emit("coder", "git_action", prUrl ? `PR opened: ${prUrl}` : "PR creation failed", 0)

  return prUrl
}

export async function closeCoderSession() {
  const oc = await getOc()
  if (_sessionID) {
    await oc.session.delete({ sessionID: _sessionID }).catch(() => {})
    _sessionID = null
  }
}

/** Reset before a new pipeline run — ensures a fresh session with clean context */
export async function resetCoderSession() {
  await closeCoderSession()
}
