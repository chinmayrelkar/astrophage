import type { OpencodeClient } from "@opencode-ai/sdk/v2"
import { getClient, promptAndWait, registerSession, unregisterSession } from "../client.js"
import type { Task, RepoContext, PMPlan, FileContract, Spec } from "../types.js"
import { agentTurn, emit } from "../transcript.js"

// ─── Architect Agent (Ilyukhina) ──────────────────────────────────────────────
// Ilyukhina is the Architect agent. Given the PM's plan she inspects the repo
// and produces file contracts: which files will be touched, what interfaces they
// must honour, and test hints. This gives the Coder a clear map before coding.

async function getOc(): Promise<OpencodeClient> {
  return getClient()
}

let _sessionID: string | null = null

async function ensureSession(repo: RepoContext): Promise<string> {
  const oc = await getOc()
  if (!_sessionID) {
    const res = await oc.session.create({
      title: "Astrophage Architect — Ilyukhina",
      permission: [
        { permission: "read",               pattern: "*", action: "allow" },
        { permission: "bash",               pattern: "*", action: "allow" },
        { permission: "glob",               pattern: "*", action: "allow" },
        { permission: "grep",               pattern: "*", action: "allow" },
        { permission: "list",               pattern: "*", action: "allow" },
        { permission: "external_directory", pattern: "*", action: "allow" },
        // Architect never edits — she designs, the coder builds
        { permission: "edit",               pattern: "*", action: "deny"  },
      ],
    })
    _sessionID = res.data!.id
    registerSession(_sessionID, "architect")

    await promptAndWait(oc, {
      sessionID: _sessionID,
      noReply: true,
      parts: [{
        type: "text",
        text: `You are Ilyukhina, the Architect agent in the Astrophage agent company.
You are aboard the Hail Mary. Your job is to map out the structural changes
needed for a task: which files to touch, what interfaces to preserve, and
hints for the testing strategy.

## Your crew
- Stratt (PM): gives you the plan
- Ryland Grace (Coder): will implement your file contracts
- Yao (Tester): will use your test hints

## Repo
- Remote: ${repo.remoteUrl}
- Local path: ${repo.localPath}
- Default branch: ${repo.defaultBranch}

You have read-only access. You may read files and run bash (e.g. grep, find)
to understand the existing structure, but you never modify files.

## Rules
- Be precise. Name actual files relative to the repo root.
- Capture the interface (function signature, struct name, etc.) if it exists.
- Keep contracts minimal — only touch what is necessary.
- Test hints should point the Tester at specific functions or scenarios to cover.`,
      }],
    })
  }
  return _sessionID
}

// ─── Produce file contracts from a PM plan ────────────────────────────────────

export async function deriveContracts(task: Task, plan: PMPlan): Promise<Spec> {
  const oc = await getOc()
  const sessionID = await ensureSession(task.repo)

  emit("architect", "turn_start", `Deriving file contracts for: ${task.title}`, 0)
  console.log(`\n[ARCHITECT — Ilyukhina] Deriving contracts for: ${task.title}`)

  const subtaskList = plan.subtasks
    .map((s) => `  - [${s.assignee}] ${s.description} (criteria: ${s.acceptanceCriteria})`)
    .join("\n")

  const prompt = `You have been given a PM plan for the following task. Derive file contracts.

## Task
Title: ${task.title}

Description:
${task.description}

## PM Plan
Subtasks:
${subtaskList}

Focus areas: ${plan.focusAreas.join(", ")}
Risk flags:  ${plan.riskFlags.join(", ")}

## Repo
- Local path: ${task.repo.localPath}

## Instructions
1. Explore the repo at ${task.repo.localPath} to identify which files are affected.
2. For each affected file, describe what must change and capture the current interface.
3. Produce test hints: which functions/behaviours should the tester specifically cover?

## Output format
Output ONLY a raw JSON object (no markdown fences, no commentary before or after):

{
  "fileContracts": [
    {
      "path": "relative/path/to/file.go",
      "description": "What changes in this file and why",
      "interface": "func FunctionName(args) ReturnType"
    }
  ],
  "testHints": [
    "Test that FunctionName returns X when given Y",
    "Test edge case: empty input"
  ]
}

Include only files that actually need to change. testHints: 2-5 specific items.`

  const result = await promptAndWait(oc, {
    sessionID,
    parts: [{ type: "text", text: prompt }],
  })

  const { fileContracts, testHints } = parseContracts(result.text)

  const spec: Spec = {
    taskId: task.id,
    acceptanceCriteria: plan.subtasks.map((s) => s.acceptanceCriteria).filter(Boolean),
    fileContracts,
    testHints,
  }

  agentTurn(
    "architect",
    `Contracts ready — ${fileContracts.length} file(s), ${testHints.length} test hint(s)`,
    fileContracts.map((f) => `  ${f.path}: ${f.description}`).join("\n"),
    0,
  )
  emit("architect", "turn_end", JSON.stringify(spec), 0)

  console.log(`[ARCHITECT — Ilyukhina] File contracts:`)
  for (const fc of fileContracts) {
    console.log(`  ${fc.path}: ${fc.description}`)
  }
  console.log(`[ARCHITECT — Ilyukhina] Test hints:`)
  for (const th of testHints) {
    console.log(`  - ${th}`)
  }

  return spec
}

// ─── Parse and validate the LLM's JSON contracts ─────────────────────────────

function parseContracts(text: string): { fileContracts: FileContract[]; testHints: string[] } {
  const candidates = [
    text.trim(),
    text.match(/```(?:json)?\s*([\s\S]+?)```/)?.[1]?.trim() ?? "",
    text.match(/(\{[\s\S]*\})/)?.[1]?.trim() ?? "",
  ]

  for (const c of candidates) {
    if (!c) continue
    try {
      const p = JSON.parse(c)
      if (!Array.isArray(p.fileContracts) && !Array.isArray(p.testHints)) continue

      const fileContracts: FileContract[] = Array.isArray(p.fileContracts)
        ? p.fileContracts.map((f: Record<string, unknown>) => ({
            path: String(f["path"] ?? ""),
            description: String(f["description"] ?? ""),
            interface: f["interface"] ? String(f["interface"]) : undefined,
          }))
        : []

      const testHints: string[] = Array.isArray(p.testHints)
        ? p.testHints.map(String)
        : []

      return { fileContracts, testHints }
    } catch { /* try next */ }
  }

  // Fallback: no contracts derived
  console.warn("[ARCHITECT — Ilyukhina] Could not parse contracts JSON — returning empty contracts")
  return { fileContracts: [], testHints: [] }
}

// ─── Session lifecycle ────────────────────────────────────────────────────────

export async function closeArchitectSession() {
  const oc = await getOc()
  if (_sessionID) {
    unregisterSession(_sessionID)
    await oc.session.delete({ sessionID: _sessionID }).catch(() => {})
    _sessionID = null
  }
}

export async function resetArchitectSession() {
  await closeArchitectSession()
}
