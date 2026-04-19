import type { OpencodeClient } from "@opencode-ai/sdk/v2"
import { getClient, promptAndWait } from "../client.js"
import type { BugSeed, Patch, RepoContext, ReviewVerdict, TestResult } from "../types.js"
import { agentTurn, emit } from "../transcript.js"

// ─── Coder Agent ──────────────────────────────────────────────────────────────

async function getOc(): Promise<OpencodeClient> {
  return getClient()
}

let _sessionID: string | null = null

async function ensureSession(repo: RepoContext): Promise<string> {
  const oc = await getOc()
  if (!_sessionID) {
    const res = await oc.session.create({ title: "Astrophage Coder" })
    _sessionID = res.data!.id

    await promptAndWait(oc, {
      sessionID: _sessionID,
      noReply: true,
      parts: [{
        type: "text",
        text: `You are the Coder agent in the Astrophage agent company.

## Your task
Fix bugs in the following Go repository:
- Local path: ${repo.localPath}
- Remote: ${repo.remoteUrl}
- Default branch: ${repo.defaultBranch}
${repo.openPRs?.length ? `- Open PRs: ${repo.openPRs.map(pr => `#${pr.number} ${pr.url} "${pr.title}"`).join(", ")}` : ""}

The codebase is available in your working directory. Use your tools to read files.

## Rules
- Always explain WHY the change fixes the bug.
- Never introduce hardcoded secrets, tokens, or credentials.
- If an auth env var is missing, the program must exit with a clear error — never silently proceed.
- Keep diffs minimal — change only what is necessary.

## Output format
Respond in EXACTLY this format, no other text:
EXPLANATION: <why this fixes the bug>
FILE: <relative path from repo root>
ORIGINAL:
\`\`\`go
<original buggy snippet>
\`\`\`
PROPOSED:
\`\`\`go
<fixed snippet>
\`\`\``,
      }],
    })
  }
  return _sessionID
}

function parseCoderResponse(raw: string, bug: BugSeed): Patch {
  const explanationMatch = raw.match(/EXPLANATION:\s*(.+?)(?=FILE:|$)/s)
  const fileMatch = raw.match(/FILE:\s*(.+?)(?=\n|$)/)
  const proposedMatch = raw.match(/PROPOSED:\s*```go\s*([\s\S]+?)```/)
  const originalMatch = raw.match(/ORIGINAL:\s*```go\s*([\s\S]+?)```/)

  return {
    file: fileMatch?.[1]?.trim() ?? bug.file,
    originalCode: originalMatch?.[1]?.trim() ?? bug.buggyCode,
    proposedCode: proposedMatch?.[1]?.trim() ?? raw,
    explanation: explanationMatch?.[1]?.trim() ?? "No explanation provided",
  }
}

export async function proposeInitialFix(bug: BugSeed, repo: RepoContext, round: number): Promise<Patch> {
  const oc = await getOc()
  const sessionID = await ensureSession(repo)

  emit("coder", "turn_start", "Proposing initial fix for seeded bug", round)
  console.log(`\n[CODER] Analyzing bug in ${bug.file}:${bug.startLine}-${bug.endLine}`)
  console.log(`        ${bug.description}`)

  const prompt = `Fix the following bug.

Repo: ${repo.remoteUrl}
Bug location: ${bug.file} lines ${bug.startLine}-${bug.endLine}
Bug description: ${bug.description}

Buggy code:
\`\`\`go
${bug.buggyCode}
\`\`\`

Read the file at ${bug.file} to understand the full context, then propose a minimal fix.
Follow the output format exactly.`

  const result = await promptAndWait(oc, {
    sessionID,
    parts: [{ type: "text", text: prompt }],
  })

  const patch = parseCoderResponse(result.text, bug)
  agentTurn("coder", "Initial fix proposed", `${patch.explanation}\n\nProposed fix in ${patch.file}`, round)
  return patch
}

export async function iterateFix(
  previousPatch: Patch,
  repo: RepoContext,
  verdict: ReviewVerdict | null,
  testResult: TestResult | null,
  round: number,
): Promise<Patch> {
  const oc = await getOc()
  const sessionID = await ensureSession(repo)

  emit("coder", "turn_start", `Iterating fix based on feedback (round ${round})`, round)
  console.log(`\n[CODER] Iterating fix — round ${round}`)

  let context = `Your previous proposed fix was:\n\`\`\`go\n${previousPatch.proposedCode}\n\`\`\`\n\n`

  if (testResult && !testResult.passed) {
    context += `Tests FAILED:\n${testResult.failures.join("\n")}\n\n`
  }

  if (verdict && verdict.decision === "reject") {
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

  const patch = parseCoderResponse(result.text, {
    file: previousPatch.file,
    startLine: 0,
    endLine: 0,
    description: "",
    buggyCode: previousPatch.originalCode,
  })

  agentTurn("coder", `Revised fix (round ${round})`, patch.explanation, round)
  return patch
}

export async function closeCoderSession() {
  const oc = await getOc()
  if (_sessionID) {
    await oc.session.delete({ sessionID: _sessionID })
    _sessionID = null
  }
}
