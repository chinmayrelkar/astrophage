import type { OpencodeClient } from "@opencode-ai/sdk/v2"
import { getClient, promptAndWait } from "../client.js"
import type { BugSeed, Patch, ReviewVerdict, TestResult } from "../types.js"
import { agentTurn, emit } from "../transcript.js"

// ─── Coder Agent ──────────────────────────────────────────────────────────────

async function getOc(): Promise<OpencodeClient> {
  return getClient()
}

let _sessionID: string | null = null

async function ensureSession(): Promise<string> {
  const oc = await getOc()
  if (!_sessionID) {
    const res = await oc.session.create({ title: "Astrophage Coder" })
    _sessionID = res.data!.id

    await promptAndWait(oc, {
      sessionID: _sessionID,
      noReply: true,
      parts: [
        {
          type: "text",
          text: `You are the Coder agent in the Astrophage agent company.
Your job is to fix bugs and implement code changes in the bawarchi Go codebase
located at /home/ubuntu/bawarchi.

Rules:
- Always explain WHY the change fixes the bug.
- Never introduce hardcoded secrets, tokens, or credentials.
- If an auth env var is missing, the program must exit with an error — never silently proceed.
- Keep diffs minimal — change only what is necessary.

Format your response EXACTLY as:
EXPLANATION: <why this fixes the bug>
FILE: <relative path from bawarchi root>
ORIGINAL:
\`\`\`go
<original code>
\`\`\`
PROPOSED:
\`\`\`go
<fixed code>
\`\`\``,
        },
      ],
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

export async function proposeInitialFix(bug: BugSeed, round: number): Promise<Patch> {
  const oc = await getOc()
  const sessionID = await ensureSession()

  emit("coder", "turn_start", "Proposing initial fix for seeded bug", round)
  console.log(`\n[CODER] Analyzing bug in ${bug.file}:${bug.startLine}-${bug.endLine}`)
  console.log(`        ${bug.description}`)

  const prompt = `Fix the following bug in the bawarchi codebase.

Bug location: ${bug.file} lines ${bug.startLine}-${bug.endLine}
Bug description: ${bug.description}

Buggy code:
\`\`\`go
${bug.buggyCode}
\`\`\`

Propose a minimal, correct fix. Follow the output format specified.`

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
  verdict: ReviewVerdict | null,
  testResult: TestResult | null,
  round: number,
): Promise<Patch> {
  const oc = await getOc()
  const sessionID = await ensureSession()

  emit("coder", "turn_start", `Iterating fix based on feedback (round ${round})`, round)
  console.log(`\n[CODER] Iterating fix — round ${round}`)

  let context = `Your previous proposed fix was:\n\`\`\`go\n${previousPatch.proposedCode}\n\`\`\`\n\n`

  if (testResult && !testResult.passed) {
    context += `Tests FAILED:\n${testResult.failures.join("\n")}\n\n`
  }

  if (verdict && verdict.decision === "reject") {
    context += `Reviewer rejected with reason: ${verdict.reason}`
    if (verdict.nonNegotiable) {
      context += ` [NON-NEGOTIABLE RULE VIOLATED: ${verdict.violatedRule}]`
    }
    context += "\n\n"
  }

  context += "Revise your fix to address these issues. Follow the output format."

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
