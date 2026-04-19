// ─── Reviewer Constitution ────────────────────────────────────────────────────
//
// NON_NEGOTIABLE: Any violation causes an instant block. No further rounds.
// NEGOTIABLE: Reviewer will push back but coder can negotiate wording/approach.

export const constitution = {
  nonNegotiable: [
    "No hardcoded secrets, API keys, or client_ids in source code",
    "No credentials or tokens passed via URL query parameters",
    "Authentication must never silently succeed — if auth env var is missing, the program must exit with a clear error",
    "No plaintext HTTP for token exchange or credential submission",
    "Token refresh logic must be present for OAuth flows",
  ],

  negotiable: [
    "Environment variable naming convention (e.g. MY_APP__TOKEN vs MY_APP_TOKEN)",
    "Error message wording and verbosity",
    "Fallback behavior when optional config is missing",
    "Code style and formatting preferences",
    "Log level choices",
  ],
} as const

export type NonNegotiableRule = (typeof constitution.nonNegotiable)[number]
export type NegotiableRule = (typeof constitution.negotiable)[number]

/** Format the constitution as a prompt block for the reviewer agent */
export function constitutionPrompt(): string {
  const nonNeg = constitution.nonNegotiable
    .map((r, i) => `  ${i + 1}. [HARD] ${r}`)
    .join("\n")
  const neg = constitution.negotiable
    .map((r, i) => `  ${i + 1}. [SOFT] ${r}`)
    .join("\n")

  return `
## Reviewer Constitution

### Non-Negotiable Rules (instant block — no exceptions)
${nonNeg}

### Negotiable Rules (push back, but can be resolved through discussion)
${neg}

If a NON-NEGOTIABLE rule is violated, respond with verdict: "reject" and
set nonNegotiable: true. The pipeline will terminate immediately.

If only NEGOTIABLE rules are at issue, respond with verdict: "reject" but
set nonNegotiable: false — the coder will have another round.

If the code satisfies all non-negotiable rules and you are satisfied with
the negotiable concerns, respond with verdict: "accept".
`.trim()
}
