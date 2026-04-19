import type { OpencodeClient } from "@opencode-ai/sdk/v2"
import { getClient, promptAndWait, registerSession, unregisterSession } from "../client.js"
import type { Task, RepoContext, PMPlan } from "../types.js"
import { agentTurn, emit } from "../transcript.js"

// ─── PM Agent (Stratt) ────────────────────────────────────────────────────────
// Stratt is the Project Manager aboard the Hail Mary. She receives the raw task,
// analyzes its complexity, and produces a structured execution plan: subtasks,
// focus areas for the coder, risk flags for the reviewer, and acceptance criteria
// for the tester. Her plan drives the dynamic pipeline.

async function getOc(): Promise<OpencodeClient> {
  return getClient()
}

let _sessionID: string | null = null

async function ensureSession(repo: RepoContext): Promise<string> {
  const oc = await getOc()
  if (!_sessionID) {
    const res = await oc.session.create({
      title: "Astrophage PM — Stratt",
      permission: [
        { permission: "read",               pattern: "*", action: "allow" },
        { permission: "bash",               pattern: "*", action: "allow" },
        { permission: "glob",               pattern: "*", action: "allow" },
        { permission: "grep",               pattern: "*", action: "allow" },
        { permission: "list",               pattern: "*", action: "allow" },
        { permission: "external_directory", pattern: "*", action: "allow" },
        // PM never edits source files — read-only access to understand the repo
        { permission: "edit",               pattern: "*", action: "deny"  },
      ],
    })
    _sessionID = res.data!.id
    registerSession(_sessionID, "pm")

    await promptAndWait(oc, {
      sessionID: _sessionID,
      noReply: true,
      parts: [{
        type: "text",
        text: `You are Stratt, the Project Manager agent in the Astrophage agent company.
You are aboard the Hail Mary. Your job is to analyze incoming tasks, break them
into clear subtasks, and produce a structured execution plan for the engineering team.

## Your crew
- Ryland Grace (Coder): fixes bugs, writes code, opens PRs
- Yao (Tester): writes and runs tests for the fix
- Rocky (Reviewer): reviews PRs against the constitution

## Repo
- Remote: ${repo.remoteUrl}
- Local path: ${repo.localPath}
- Default branch: ${repo.defaultBranch}

You have read-only access to the repo. You may read files and run bash to
understand the codebase, but you never edit source files yourself.

## Rules
- Be concise and precise. Engineering teams do not want vague plans.
- Identify the real risk in each task — security, data integrity, edge cases.
- Your plan directly controls how many rounds the pipeline will use (maxRounds).
  Do not inflate this: simple fixes = 2-3 rounds, complex changes = 4-5.
- Focus areas help the coder prioritize. Risk flags help the reviewer be thorough.
- Acceptance criteria must be testable and specific.`,
      }],
    })
  }
  return _sessionID
}

// ─── Produce a plan for a task ────────────────────────────────────────────────

export async function planTask(task: Task): Promise<PMPlan> {
  const oc = await getOc()
  const sessionID = await ensureSession(task.repo)

  emit("pm", "turn_start", `Analyzing task: ${task.title}`, 0)
  console.log(`\n[PM — Stratt] Planning task: ${task.title}`)

  const prompt = `Analyze the following task and produce an execution plan.

## Task
Title: ${task.title}

Description:
${task.description}

## Repo
- Local path: ${task.repo.localPath}
- Remote: ${task.repo.remoteUrl}

## Instructions
1. Briefly explore the repo if needed to understand the affected code.
2. Assess complexity: is this a trivial fix, moderate change, or complex refactor?
3. Break the task into subtasks — each assigned to coder, tester, or reviewer.
4. Identify focus areas for the coder (what to prioritize / watch out for).
5. Identify risk flags for the reviewer (security, correctness, edge cases to scrutinize).
6. Write testable acceptance criteria for the tester.
7. Decide maxRounds: simple fixes = 2, moderate = 3, complex = 5. Be conservative.

## Output format
Output ONLY a raw JSON object (no markdown fences, no commentary before or after):

{
  "subtasks": [
    {
      "id": "1",
      "description": "...",
      "assignee": "coder",
      "acceptanceCriteria": "..."
    }
  ],
  "maxRounds": 3,
  "focusAreas": ["...", "..."],
  "riskFlags": ["...", "..."]
}

Assignee must be exactly one of: "coder", "tester", "reviewer".
maxRounds must be an integer between 1 and 5.
focusAreas: 2-5 items — what the coder should focus on.
riskFlags: 2-5 items — what the reviewer should scrutinize.`

  const result = await promptAndWait(oc, {
    sessionID,
    parts: [{ type: "text", text: prompt }],
  })

  const plan = parsePMPlan(result.text, task)

  agentTurn(
    "pm",
    `Plan ready — ${plan.subtasks.length} subtasks, maxRounds=${plan.maxRounds}`,
    `focusAreas: ${plan.focusAreas.join(", ")}\nriskFlags: ${plan.riskFlags.join(", ")}`,
    0,
  )
  emit("pm", "turn_end", JSON.stringify(plan), 0)

  console.log(`[PM — Stratt] Plan:`)
  console.log(`  maxRounds   : ${plan.maxRounds}`)
  console.log(`  subtasks    : ${plan.subtasks.length}`)
  console.log(`  focusAreas  : ${plan.focusAreas.join(" | ")}`)
  console.log(`  riskFlags   : ${plan.riskFlags.join(" | ")}`)

  return plan
}

// ─── Parse and validate the LLM's JSON plan ───────────────────────────────────

function parsePMPlan(text: string, task: Task): PMPlan {
  const candidates = [
    // Raw text (model outputs bare JSON)
    text.trim(),
    // Fenced code block
    text.match(/```(?:json)?\s*([\s\S]+?)```/)?.[1]?.trim() ?? "",
    // First {...} block
    text.match(/(\{[\s\S]*\})/)?.[1]?.trim() ?? "",
  ]

  for (const c of candidates) {
    if (!c) continue
    try {
      const p = JSON.parse(c)
      if (!Array.isArray(p.subtasks)) continue

      const subtasks = p.subtasks.map((s: Record<string, unknown>, i: number) => ({
        id: String(s["id"] ?? i + 1),
        description: String(s["description"] ?? ""),
        assignee: (["coder", "tester", "reviewer"].includes(String(s["assignee"]))
          ? s["assignee"]
          : "coder") as "coder" | "tester" | "reviewer",
        acceptanceCriteria: String(s["acceptanceCriteria"] ?? ""),
      }))

      const maxRounds = Math.min(5, Math.max(1, parseInt(String(p.maxRounds ?? 3)) || 3))
      const focusAreas = Array.isArray(p.focusAreas) ? p.focusAreas.map(String) : []
      const riskFlags = Array.isArray(p.riskFlags) ? p.riskFlags.map(String) : []

      return { subtasks, maxRounds, focusAreas, riskFlags }
    } catch { /* try next */ }
  }

  // Fallback: default sensible plan
  console.warn("[PM — Stratt] Could not parse plan JSON — using default plan")
  return {
    subtasks: [
      {
        id: "1",
        description: task.description,
        assignee: "coder",
        acceptanceCriteria: "The bug is fixed and all existing tests pass.",
      },
    ],
    maxRounds: 3,
    focusAreas: ["Fix the root cause", "Ensure no regressions"],
    riskFlags: ["Check for edge cases", "Verify error handling"],
  }
}

// ─── Session lifecycle ────────────────────────────────────────────────────────

export async function closePMSession() {
  const oc = await getOc()
  if (_sessionID) {
    unregisterSession(_sessionID)
    await oc.session.delete({ sessionID: _sessionID }).catch(() => {})
    _sessionID = null
  }
}

export async function resetPMSession() {
  await closePMSession()
}
