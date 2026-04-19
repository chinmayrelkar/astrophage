import { createOpencode } from "@opencode-ai/sdk/v2"
import type { Patch, ReviewVerdict } from "../types.js"
import { agentTurn, emit } from "../transcript.js"
import { constitutionPrompt } from "../constitution.js"

// ─── Reviewer Agent ───────────────────────────────────────────────────────────
//
// Reviews a proposed patch against the constitution.
// Returns a structured ReviewVerdict via json_schema format.

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
      title: "Astrophage Reviewer",
    })
    _sessionID = res.data!.id

    // Inject constitution once as system context
    await oc.client.session.prompt({
      sessionID: _sessionID,
      noReply: true,
      parts: [
        {
          type: "text",
          text: `You are the Reviewer agent in the Astrophage agent company.
Your job is to review code patches proposed by the Coder agent.

${constitutionPrompt()}

When reviewing, respond with a JSON object in EXACTLY this format — no other text:
{
  "decision": "accept" | "reject",
  "reason": "<clear explanation>",
  "violatedRule": "<exact rule text if reject, else omit>",
  "nonNegotiable": true | false
}`,
        },
      ],
    })
  }
  return _sessionID
}

/** Review a patch. Returns a structured verdict. */
export async function reviewPatch(patch: Patch, round: number): Promise<ReviewVerdict> {
  const oc = await getOc()
  const sessionID = await ensureSession()

  emit("reviewer", "turn_start", `Reviewing patch (round ${round})`, round)
  console.log(`\n[REVIEWER] Reviewing proposed fix for ${patch.file}`)

  const prompt = `Review this proposed code patch.

File: ${patch.file}
Coder's explanation: ${patch.explanation}

Original code:
\`\`\`go
${patch.originalCode}
\`\`\`

Proposed fix:
\`\`\`go
${patch.proposedCode}
\`\`\`

Apply the constitution and return your verdict as JSON.`

  const result = await oc.client.session.prompt({
    sessionID,
    parts: [{ type: "text", text: prompt }],
    format: {
      type: "json_schema",
      schema: {
        type: "object",
        properties: {
          decision: { type: "string", enum: ["accept", "reject"] },
          reason: { type: "string", description: "Clear explanation of the verdict" },
          violatedRule: {
            type: "string",
            description: "Exact rule text if rejecting (omit if accepting)",
          },
          nonNegotiable: {
            type: "boolean",
            description: "Whether the violated rule is non-negotiable",
          },
        },
        required: ["decision", "reason", "nonNegotiable"],
      },
    },
  })

  const verdict = parseVerdict(result.data, round)

  const label =
    verdict.decision === "accept"
      ? `ACCEPT — ${verdict.reason}`
      : `REJECT${verdict.nonNegotiable ? " [NON-NEGOTIABLE]" : ""} — ${verdict.reason}`

  agentTurn("reviewer", `Verdict: ${verdict.decision.toUpperCase()}`, label, round)
  emit("reviewer", "verdict", JSON.stringify(verdict), round)

  return verdict
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseVerdict(data: any, round: number): ReviewVerdict {
  // v2 SDK: structured output lives at info.structured
  const structured = data?.info?.structured
  if (structured && typeof structured === "object") {
    return {
      decision: structured.decision ?? "reject",
      reason: structured.reason ?? "No reason provided",
      violatedRule: structured.violatedRule,
      nonNegotiable: structured.nonNegotiable ?? false,
      round,
    }
  }

  // Fallback: parse text parts as JSON
  const parts: any[] = data?.parts ?? []
  const raw = parts
    .filter((p) => p.type === "text")
    .map((p) => p.text ?? "")
    .join("")

  try {
    const parsed = JSON.parse(raw.trim())
    return {
      decision: parsed.decision ?? "reject",
      reason: parsed.reason ?? "No reason provided",
      violatedRule: parsed.violatedRule,
      nonNegotiable: parsed.nonNegotiable ?? false,
      round,
    }
  } catch {
    return {
      decision: "reject",
      reason: `Could not parse reviewer response: ${raw.slice(0, 200)}`,
      nonNegotiable: false,
      round,
    }
  }
}

export async function closeReviewerSession() {
  if (_oc && _sessionID) {
    await _oc.client.session.delete({ sessionID: _sessionID })
    _sessionID = null
  }
  if (_oc) {
    _oc.server.close()
    _oc = null
  }
}
