import type { OpencodeClient } from "@opencode-ai/sdk/v2"
import { getClient, promptAndWait } from "../client.js"
import type { Patch, ReviewVerdict } from "../types.js"
import { agentTurn, emit } from "../transcript.js"
import { constitutionPrompt } from "../constitution.js"

// ─── Reviewer Agent ───────────────────────────────────────────────────────────

async function getOc(): Promise<OpencodeClient> {
  return getClient()
}

let _sessionID: string | null = null

async function ensureSession(): Promise<string> {
  const oc = await getOc()
  if (!_sessionID) {
    const res = await oc.session.create({ title: "Astrophage Reviewer" })
    _sessionID = res.data!.id

    await promptAndWait(oc, {
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

  const result = await promptAndWait(oc, {
    sessionID,
    parts: [{ type: "text", text: prompt }],
    format: {
      type: "json_schema",
      schema: {
        type: "object",
        properties: {
          decision: { type: "string", enum: ["accept", "reject"] },
          reason: { type: "string", description: "Clear explanation of the verdict" },
          violatedRule: { type: "string", description: "Exact rule text if rejecting" },
          nonNegotiable: { type: "boolean", description: "Whether the violated rule is non-negotiable" },
        },
        required: ["decision", "reason", "nonNegotiable"],
      },
    },
  })

  const verdict = parseVerdict(result, round)

  const label = verdict.decision === "accept"
    ? `ACCEPT — ${verdict.reason}`
    : `REJECT${verdict.nonNegotiable ? " [NON-NEGOTIABLE]" : ""} — ${verdict.reason}`

  agentTurn("reviewer", `Verdict: ${verdict.decision.toUpperCase()}`, label, round)
  emit("reviewer", "verdict", JSON.stringify(verdict), round)
  return verdict
}

function parseVerdict(result: { text: string; structured: unknown }, round: number): ReviewVerdict {
  // Prefer structured output
  if (result.structured && typeof result.structured === "object") {
    const s = result.structured as Record<string, unknown>
    return {
      decision: (s["decision"] as "accept" | "reject") ?? "reject",
      reason: (s["reason"] as string) ?? "No reason provided",
      violatedRule: s["violatedRule"] as string | undefined,
      nonNegotiable: (s["nonNegotiable"] as boolean) ?? false,
      round,
    }
  }

  // Fallback: extract JSON from anywhere in the text (model may wrap in markdown)
  const text = result.text.trim()
  // Try raw parse first
  const candidates = [
    text,
    // Extract from ```json ... ``` block
    text.match(/```(?:json)?\s*([\s\S]+?)```/)?.[1]?.trim() ?? "",
    // Extract first {...} block
    text.match(/(\{[\s\S]+\})/)?.[1]?.trim() ?? "",
  ]
  for (const candidate of candidates) {
    if (!candidate) continue
    try {
      const parsed = JSON.parse(candidate)
      if (parsed.decision) {
        return {
          decision: parsed.decision ?? "reject",
          reason: parsed.reason ?? "No reason provided",
          violatedRule: parsed.violatedRule,
          nonNegotiable: parsed.nonNegotiable ?? false,
          round,
        }
      }
    } catch { /* try next */ }
  }

  return {
    decision: "reject",
    reason: `Could not parse reviewer response: ${text.slice(0, 200)}`,
    nonNegotiable: false,
    round,
  }
}

export async function closeReviewerSession() {
  const oc = await getOc()
  if (_sessionID) {
    await oc.session.delete({ sessionID: _sessionID })
    _sessionID = null
  }
}
