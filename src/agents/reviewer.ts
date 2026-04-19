import type { OpencodeClient } from "@opencode-ai/sdk/v2"
import { getClient, promptAndWait } from "../client.js"
import type { Patch, RepoContext, ReviewVerdict } from "../types.js"
import { agentTurn, emit } from "../transcript.js"
import { constitutionPrompt } from "../constitution.js"

// ─── Reviewer Agent ───────────────────────────────────────────────────────────

async function getOc(): Promise<OpencodeClient> {
  return getClient()
}

let _sessionID: string | null = null

async function ensureSession(repo: RepoContext): Promise<string> {
  const oc = await getOc()
  if (!_sessionID) {
    // Deny all tools — reviewer only needs to read the patch text and output JSON.
    // Without this the model uses file-reading tools and never emits text output.
    const res = await oc.session.create({
      title: "Astrophage Reviewer",
      permission: [{ permission: "*", pattern: "*", action: "deny" }],
    })
    _sessionID = res.data!.id

    await promptAndWait(oc, {
      sessionID: _sessionID,
      noReply: true,
      parts: [{
        type: "text",
        text: `You are the Reviewer agent in the Astrophage agent company.

## Your task
Review code patches proposed by the Coder agent for this repository:
- Remote: ${repo.remoteUrl}
- Default branch: ${repo.defaultBranch}
${repo.openPRs?.length ? `- Open PRs: ${repo.openPRs.map(pr => `#${pr.number} ${pr.url} "${pr.title}"`).join(", ")}` : ""}

IMPORTANT: Do NOT use any tools. Do NOT read any files. The patch will be provided in full.
Just read the patch text and respond with JSON.

${constitutionPrompt()}

## Output format
Respond with a JSON object in EXACTLY this format — no other text, no markdown fences:
{
  "decision": "accept" | "reject",
  "reason": "<clear explanation>",
  "violatedRule": "<exact rule text if reject, else omit>",
  "nonNegotiable": true | false
}`,
      }],
    })
  }
  return _sessionID
}

export async function reviewPatch(patch: Patch, repo: RepoContext, round: number): Promise<ReviewVerdict> {
  const oc = await getOc()
  const sessionID = await ensureSession(repo)

  emit("reviewer", "turn_start", `Reviewing patch (round ${round})`, round)
  console.log(`\n[REVIEWER] Reviewing proposed fix for ${patch.file}`)

  const prompt = `Review this proposed code patch.

Repo: ${repo.remoteUrl}
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
    await oc.session.delete({ sessionID: _sessionID }).catch(() => {})
    _sessionID = null
  }
}

/** Reset before a new pipeline run — ensures a fresh session with clean context */
export async function resetReviewerSession() {
  await closeReviewerSession()
}
