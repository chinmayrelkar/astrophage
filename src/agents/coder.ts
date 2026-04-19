import { createOpencode } from "@opencode-ai/sdk/v2"
import type { BugSeed, Patch, ReviewVerdict, TestResult } from "../types.js"
import { agentTurn, emit } from "../transcript.js"

// ─── Coder Agent ──────────────────────────────────────────────────────────────
//
// Iteration 0: Given a pre-seeded bug, proposes a fix.
// Iteration 1+: Iterates based on test failures and reviewer feedback.

type OC = Awaited<ReturnType<typeof createOpencode>>

let _oc: OC | null = null

async function getOc(): Promise<OC> {
  if (!_oc) {
    _oc = await createOpencode({
      config: { model: "anthropic/claude-sonnet-4-5" },
    })
  }
  return _oc
}

let _sessionID: string | null = null

async function ensureSession(): Promise<string> {
  const oc = await getOc()
  if (!_sessionID) {
    const res = await oc.client.session.create({
      title: "Astrophage Coder",
    })
    _sessionID = res.data!.id

    // Inject system context once (noReply = no AI response)
    await oc.client.session.prompt({
      sessionID: _sessionID,
      noReply: true,
      parts: [
        {
          type: "text",
          text: `You are the Coder agent in the Astrophage agent company.
Your job is to fix bugs and implement code changes in the bawarchi Go codebase
located at /home/ubuntu/bawarchi.

Rules:
- Output ONLY the proposed code change (the fixed version of the relevant code block).
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

/** Parse coder response into a Patch */
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

/** Round 1: propose initial fix for a seeded bug */
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

  const result = await oc.client.session.prompt({
    sessionID,
    parts: [{ type: "text", text: prompt }],
  })

  const raw = extractText(result.data)
  const patch = parseCoderResponse(raw, bug)

  agentTurn(
    "coder",
    "Initial fix proposed",
    `${patch.explanation}\n\nProposed fix in ${patch.file}`,
    round,
  )
  return patch
}

/** Subsequent rounds: iterate based on reviewer feedback and/or test failures */
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

  let context =
    `Your previous proposed fix was:\n\`\`\`go\n${previousPatch.proposedCode}\n\`\`\`\n\n`

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

  const result = await oc.client.session.prompt({
    sessionID,
    parts: [{ type: "text", text: context }],
  })

  const raw = extractText(result.data)
  const patch = parseCoderResponse(raw, {
    file: previousPatch.file,
    startLine: 0,
    endLine: 0,
    description: "",
    buggyCode: previousPatch.originalCode,
  })

  agentTurn("coder", `Revised fix (round ${round})`, patch.explanation, round)
  return patch
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractText(data: any): string {
  if (!data) return ""
  // v2 SDK response: { info: AssistantMessage, parts: Part[] }
  const parts: any[] = data.parts ?? []
  return parts
    .filter((p) => p.type === "text")
    .map((p) => p.text ?? "")
    .join("")
}

export async function closeCoderSession() {
  if (_oc && _sessionID) {
    await _oc.client.session.delete({ sessionID: _sessionID })
    _sessionID = null
  }
  if (_oc) {
    _oc.server.close()
    _oc = null
  }
}
