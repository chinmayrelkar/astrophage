import type { OpencodeClient } from "@opencode-ai/sdk/v2"
import { getClient, promptAndWait, registerSession, unregisterSession } from "../client.js"
import type { Task, RepoContext, PMPlan } from "../types.js"
import { agentTurn, emit } from "../transcript.js"
import { formatRunMemoryForPM } from "../run-memory.js"

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
understand the codebase, but you never edit source files yourself.`,
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

  // ── Step 1: Explore (free-form, tool use allowed) ──────────────────────────
  // Inject cross-run memory so PM can learn from past outcomes on this repo
  const memoryBlock = formatRunMemoryForPM(task.repo.remoteUrl)

  // Give the model room to use tools and think before being asked for JSON.
  const explorePrompt = `You have a new task to plan. First, explore the repo to understand what needs to change.

## Task
Title: ${task.title}

Description:
${task.description}

## Repo
- Local path: ${task.repo.localPath}
- Remote: ${task.repo.remoteUrl}
${memoryBlock}
Explore the repo now. Read the relevant files, identify which files need to change,
assess the complexity, and identify the security/correctness risks.
Think out loud — no output format required yet. Just explore and think.`

  await promptAndWait(oc, {
    sessionID,
    parts: [{ type: "text", text: explorePrompt }],
  })

  // ── Step 2: Produce structured plan JSON ───────────────────────────────────
  // Separate turn — model has already explored, now just output the plan.
  const planPrompt = `Good. Now produce the execution plan based on your exploration.

Output a JSON object. Rules:
- Be concise and precise.
- maxRounds: simple fixes = 2, moderate = 3, complex = 5. Be conservative.
- focusAreas: 2-5 items for the coder (what to prioritize / watch out for).
- riskFlags: 2-5 items for the reviewer (security, correctness, edge cases).
- acceptanceCriteria per subtask must be testable and specific.

Output ONLY the JSON object on its own, with no text before or after, no markdown fences:

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
}`

  const result = await promptAndWait(oc, {
    sessionID,
    parts: [{ type: "text", text: planPrompt }],
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
  // Extract all {...} blocks from the text and try each in order of length
  // (longest first — avoids matching tiny partial objects from tool narration)
  const jsonCandidates = extractJsonCandidates(text)

  for (const c of jsonCandidates) {
    try {
      const p = JSON.parse(c)
      if (!Array.isArray(p.subtasks) || p.subtasks.length === 0) continue

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

      console.log(`[PM — Stratt] Plan parsed successfully (${subtasks.length} subtasks)`)
      return { subtasks, maxRounds, focusAreas, riskFlags }
    } catch { /* try next */ }
  }

  // Fallback: default sensible plan
  console.warn("[PM — Stratt] Could not parse plan JSON — using default plan")
  console.warn(`[PM — Stratt] Raw response (first 600 chars): ${text.slice(0, 600)}`)
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

/**
 * Extract all {...} blocks from text, sorted longest-first.
 * This handles responses where the model outputs tool narration mixed with JSON.
 */
function extractJsonCandidates(text: string): string[] {
  const candidates: string[] = []

  // 1. Fenced code block (```json ... ``` or ``` ... ```)
  const fenceMatches = text.matchAll(/```(?:json)?\s*([\s\S]+?)```/g)
  for (const m of fenceMatches) {
    if (m[1]) candidates.push(m[1].trim())
  }

  // 2. Every top-level {...} block in the text (scan brace depth)
  let depth = 0
  let start = -1
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "{") {
      if (depth === 0) start = i
      depth++
    } else if (text[i] === "}") {
      depth--
      if (depth === 0 && start !== -1) {
        candidates.push(text.slice(start, i + 1))
        start = -1
      }
    }
  }

  // Sort longest first — the plan object is larger than any incidental {...} in tool output
  candidates.sort((a, b) => b.length - a.length)

  return candidates
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
