import type { OpencodeClient } from "@opencode-ai/sdk/v2"
import { getClient, promptAndWait, registerSession, unregisterSession } from "../client.js"
import type { RepoContext, ReviewVerdict } from "../types.js"
import type { PRInfo } from "./coder.js"
import { agentTurn, emit } from "../transcript.js"
import { constitutionPrompt } from "../constitution.js"

// ─── Reviewer Agent (Rocky) ───────────────────────────────────────────────────
// Reviews the PR on GitHub. Posts review comments. Approves or requests changes.
// All feedback goes through the PR — not just in-memory.

async function getOc(): Promise<OpencodeClient> {
  return getClient()
}

let _sessionID: string | null = null

async function ensureSession(repo: RepoContext): Promise<string> {
  const oc = await getOc()
  if (!_sessionID) {
    // Deny file tools — reviewer reads the PR diff via gh CLI only.
    // bash is allowed so it can run gh commands.
    const res = await oc.session.create({
      title: "Astrophage Reviewer — Rocky",
      permission: [
        { permission: "bash",   pattern: "*", action: "allow" },
        { permission: "read",   pattern: "*", action: "deny"  },
        { permission: "edit",   pattern: "*", action: "deny"  },
        { permission: "glob",   pattern: "*", action: "deny"  },
        { permission: "grep",   pattern: "*", action: "deny"  },
        { permission: "list",   pattern: "*", action: "deny"  },
      ],
    })
    _sessionID = res.data!.id
    registerSession(_sessionID, "reviewer")

    await promptAndWait(oc, {
      sessionID: _sessionID,
      noReply: true,
      parts: [{
        type: "text",
        text: `You are Rocky, the Reviewer agent in the Astrophage agent company.
You are an Eridian engineer. Your job is to review PRs on GitHub using the gh CLI.

## Repo
- Remote: ${repo.remoteUrl}
- Default branch: ${repo.defaultBranch}

You have access to bash so you can run gh CLI commands.

${constitutionPrompt()}

## How you work
1. Read the PR diff and description using: gh pr view <number> --patch or gh pr diff <number>
2. Evaluate the change against the constitution
3. Post a review using: gh pr review <number> --approve OR gh pr review <number> --request-changes --body "..."
4. Then output your verdict as JSON (no markdown fences):
{"decision":"accept"|"reject","reason":"...","violatedRule":"...","nonNegotiable":true|false}

IMPORTANT: Always post a GitHub review comment BEFORE outputting the JSON verdict.
If rejecting, be specific — explain exactly what must change.`,
      }],
    })
  }
  return _sessionID
}

// ─── Review a PR — posts GitHub review, returns verdict ───────────────────────

export async function reviewPR(pr: PRInfo, repo: RepoContext, round: number): Promise<ReviewVerdict> {
  const oc = await getOc()
  const sessionID = await ensureSession(repo)

  emit("reviewer", "turn_start", `Reviewing PR #${pr.number} (round ${round})`, round)
  emit("reviewer", "git_action", `Reading PR diff #${pr.number}...`, round)
  console.log(`\n[REVIEWER] Reviewing PR #${pr.number}: ${pr.url}`)

  const prompt = `Review this PR and post your GitHub review.

PR URL: ${pr.url}
PR number: ${pr.number}
Repo: ${repo.remoteUrl}

Run these steps IN ORDER:

STEP 1 — Read the diff:
gh pr diff ${pr.number} --repo ${repo.remoteUrl.replace(/\.git$/, "")}

STEP 2 — Read the description:
gh pr view ${pr.number} --repo ${repo.remoteUrl.replace(/\.git$/, "")}

STEP 3 — Apply the constitution. Check every non-negotiable rule.

STEP 4 — Post your review (you MUST run one of these):
  If approving:   gh pr review ${pr.number} --approve --body "<your comment>"
  If requesting:  gh pr review ${pr.number} --request-changes --body "<exactly what must change>"

STEP 5 — Output your verdict as the LAST thing you write, as a raw JSON object (no fences):
{"decision":"accept"|"reject","reason":"...","violatedRule":"...","nonNegotiable":true|false}

IMPORTANT: Base your review ONLY on PR #${pr.number}. Do not reference any other PR.`

  const result = await promptAndWait(oc, {
    sessionID,
    parts: [{ type: "text", text: prompt }],
  })

  const verdict = parseVerdict(result.text, round)

  const label = verdict.decision === "accept"
    ? `ACCEPT — ${verdict.reason}`
    : `REJECT${verdict.nonNegotiable ? " [NON-NEGOTIABLE]" : ""} — ${verdict.reason}`

  agentTurn("reviewer", `Verdict: ${verdict.decision.toUpperCase()}`, label, round)
  emit("reviewer", "verdict", JSON.stringify(verdict), round)
  emit("reviewer", "git_action", `Posting GitHub review...`, round)
  emit("reviewer", "git_action", `PR review posted: ${pr.url}`, round)

  return verdict
}

// ─── Approve and merge the PR ─────────────────────────────────────────────────

export async function approveAndMergePR(pr: PRInfo, repo: RepoContext): Promise<void> {
  const oc = await getOc()
  const sessionID = await ensureSession(repo)

  emit("reviewer", "turn_start", `Merging PR #${pr.number}`, 0)
  console.log(`\n[REVIEWER] Merging PR: ${pr.url}`)

  await promptAndWait(oc, {
    sessionID,
    parts: [{
      type: "text",
      text: `Merge this approved PR using:
gh pr merge ${pr.number} --squash --delete-branch --yes`,
    }],
  })

  agentTurn("reviewer", "PR merged", pr.url, 0)
  emit("reviewer", "git_action", `PR merged: ${pr.url}`, 0)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseVerdict(text: string, round: number): ReviewVerdict {
  const candidates = [
    text.trim(),
    text.match(/```(?:json)?\s*([\s\S]+?)```/)?.[1]?.trim() ?? "",
    text.match(/(\{[\s\S]*"decision"[\s\S]*\})/)?.[1]?.trim() ?? "",
    // Last {...} block in the text
    [...text.matchAll(/\{[\s\S]*?\}/g)].pop()?.[0] ?? "",
  ]

  for (const c of candidates) {
    if (!c) continue
    try {
      const p = JSON.parse(c)
      if (p.decision === "accept" || p.decision === "reject") {
        return {
          decision: p.decision,
          reason: p.reason ?? "No reason provided",
          violatedRule: p.violatedRule,
          nonNegotiable: p.nonNegotiable ?? false,
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
    unregisterSession(_sessionID)
    await oc.session.delete({ sessionID: _sessionID }).catch(() => {})
    _sessionID = null
  }
}

export async function resetReviewerSession() {
  await closeReviewerSession()
}
