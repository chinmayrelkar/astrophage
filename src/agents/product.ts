import type { OpencodeClient } from "@opencode-ai/sdk/v2"
import { getClient, promptAndWait, registerSession, unregisterSession } from "../client.js"
import type { Task, RepoContext, BacklogItem, Roadmap, BacklogPriority, TaskType } from "../types.js"
import { emit } from "../transcript.js"
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "fs"
import { join } from "path"
import { homedir } from "os"

// ─── Product Agent (Lokken) ───────────────────────────────────────────────────
// Lokken is the Product agent aboard the Hail Mary. She reads GitHub issues,
// discussions, and user feedback to understand what the product needs. She:
//
//  1. Synthesizes a prioritized feature backlog
//  2. Identifies which features are feasible now vs need a spike first
//  3. Commits a living ROADMAP.md to the repo
//  4. Feeds ready features as Tasks into the pipeline
//  5. Feeds uncertain features as Spike tasks for the Architect to investigate
//
// Lokken has read access to the repo and can write one file: ROADMAP.md.
// She never touches source code.

async function getOc(): Promise<OpencodeClient> {
  return getClient()
}

let _sessionID: string | null = null

// ─── Persistence ──────────────────────────────────────────────────────────────

const STATE_DIR = join(homedir(), ".astrophage")
const BACKLOG_PATH = join(STATE_DIR, "backlog.json")
mkdirSync(STATE_DIR, { recursive: true })

export function loadBacklog(): BacklogItem[] {
  try {
    return JSON.parse(readFileSync(BACKLOG_PATH, "utf8")) as BacklogItem[]
  } catch {
    return []
  }
}

export function saveBacklog(backlog: BacklogItem[]): void {
  writeFileSync(BACKLOG_PATH, JSON.stringify(backlog, null, 2))
}

// ─── Session ──────────────────────────────────────────────────────────────────

async function ensureSession(repo: RepoContext): Promise<string> {
  const oc = await getOc()
  if (!_sessionID) {
    const res = await oc.session.create({
      title: "Astrophage Product — Lokken",
      permission: [
        { permission: "read",               pattern: "*", action: "allow" },
        { permission: "bash",               pattern: "*", action: "allow" },
        { permission: "glob",               pattern: "*", action: "allow" },
        { permission: "grep",               pattern: "*", action: "allow" },
        { permission: "list",               pattern: "*", action: "allow" },
        { permission: "external_directory", pattern: "*", action: "allow" },
        // Lokken can only write ROADMAP.md — no source code changes
        { permission: "edit", pattern: "**/ROADMAP.md", action: "allow" },
        { permission: "edit", pattern: "*",             action: "deny"  },
      ],
    })
    _sessionID = res.data!.id
    registerSession(_sessionID, "product")

    await promptAndWait(oc, {
      sessionID: _sessionID,
      noReply: true,
      parts: [{
        type: "text",
        text: `You are Lokken, the Product agent in the Astrophage agent company.
You are aboard the Hail Mary. Your job is to figure out what the product should do next.

## Your responsibilities
1. Read GitHub issues, discussions, and user feedback to understand what people want
2. Synthesize a prioritized feature backlog — ordered by impact and feasibility
3. Decide what to build next: features that are clear and ready, or spikes for uncertain ones
4. Commit a living ROADMAP.md to the repo summarizing themes and next steps
5. Feed ready features to the engineering pipeline as Tasks

## Task types you produce
- "feature": clear, scoped feature that the pipeline can implement directly
- "spike": feasibility is unknown — Architect investigates, then you re-evaluate
- Never produce bug fixes — that's DuBois's job

## Prioritization criteria
- critical: security or data integrity, blocks users
- high: core user workflow, many users affected
- medium: useful improvement, some users benefit
- low: nice-to-have, edge case

## Complexity scale (1–5)
1 = trivial (add a flag, rename a field)
2 = small (new endpoint, simple validation)
3 = moderate (new subsystem, cross-file changes)
4 = complex (architectural change, multiple components)
5 = very complex (needs spike first)

## Rules
- Be honest about feasibility. If you are not sure, create a spike.
- Roadmap themes should group related items into coherent narratives.
- Task descriptions must be complete enough for the Coder to implement without asking questions.
- You may only write ROADMAP.md — never touch source code.

## Repo
- Remote: ${repo.remoteUrl}
- Local path: ${repo.localPath}
- Default branch: ${repo.defaultBranch}`,
      }],
    })
  }
  return _sessionID
}

// ─── Result types ─────────────────────────────────────────────────────────────

export interface ProductCycleResult {
  scannedAt: string
  newBacklogItems: BacklogItem[]
  updatedBacklogItems: BacklogItem[]
  roadmap: Roadmap
  tasksQueued: Task[]
}

// ─── Main cycle ───────────────────────────────────────────────────────────────

export async function runProductCycle(
  repo: RepoContext,
  existingBacklog: BacklogItem[],
  seenIssueKeys: Set<string>,
): Promise<ProductCycleResult> {
  const oc = await getOc()
  const sessionID = await ensureSession(repo)
  const repoSlug = repo.remoteUrl.replace(/.*github\.com\//, "").replace(/\.git$/, "")

  emit("product", "turn_start", `Product cycle — reading ${repoSlug}`, 0)
  console.log(`\n[PRODUCT — Lokken] Starting product cycle for ${repoSlug}`)

  // ── Step 1: Read GitHub issues and discussions ────────────────────────────
  await promptAndWait(oc, {
    sessionID,
    parts: [{
      type: "text",
      text: `Read all open GitHub issues and discussions for ${repoSlug} to understand what users and contributors want.

Run:
gh issue list --repo ${repoSlug} --state open --json number,title,body,labels,comments --limit 50
gh issue list --repo ${repoSlug} --state closed --json number,title,body,labels --limit 20

Also read the existing README and any docs:
cat ${repo.localPath}/README.md 2>/dev/null || echo "no README"
ls ${repo.localPath}/docs 2>/dev/null || echo "no docs dir"

Existing backlog items (already tracked, do not duplicate):
${existingBacklog.length > 0
  ? existingBacklog.map((i) => `  - [${i.id}] ${i.title} (${i.priority}, ${i.type})`).join("\n")
  : "  (empty — this is the first cycle)"}

Read everything. Think about:
- What are users asking for most?
- What themes emerge across multiple issues?
- What features would have the highest impact?
- What is unclear or risky enough to need a spike first?

No output format yet — just explore and think.`,
    }],
  })

  // ── Step 2: Produce structured backlog ────────────────────────────────────
  const backlogResult = await promptAndWait(oc, {
    sessionID,
    parts: [{
      type: "text",
      text: `Good. Now produce the updated feature backlog.

Only include NEW items not already in the existing backlog.
Already-seen issue keys to skip: [${[...seenIssueKeys].join(", ") || "none"}]

Output ONLY a JSON array, no text before or after, no markdown fences:

[
  {
    "id": "feat-auth-refresh-tokens",
    "title": "Add OAuth refresh token support",
    "description": "Full description for the coding agent: what to build, acceptance criteria, which files are likely involved.",
    "type": "feature",
    "priority": "high",
    "sourceRefs": ["https://github.com/${repoSlug}/issues/12", "https://github.com/${repoSlug}/issues/34"],
    "complexity": 3,
    "feasibilityKnown": true,
    "spikeQuestion": null
  },
  {
    "id": "spike-graphql-feasibility",
    "title": "Spike: can we add GraphQL without breaking REST?",
    "description": "Investigate whether GraphQL can coexist with the current REST layer. Produce a recommendation.",
    "type": "spike",
    "priority": "medium",
    "sourceRefs": ["https://github.com/${repoSlug}/issues/45"],
    "complexity": 2,
    "feasibilityKnown": false,
    "spikeQuestion": "Can GraphQL be added without breaking existing REST clients or requiring a full rewrite?"
  }
]

Priority must be one of: critical, high, medium, low
Type must be one of: feature, spike
complexity: 1–5
feasibilityKnown: true if you are confident this can be built directly, false if a spike is needed first`,
    }],
  })

  const newItems = parseBacklogItems(backlogResult.text, repo)
  console.log(`[PRODUCT — Lokken] ${newItems.length} new backlog item(s)`)

  // ── Step 3: Produce roadmap themes ───────────────────────────────────────
  const fullBacklog = [...existingBacklog, ...newItems]

  const roadmapResult = await promptAndWait(oc, {
    sessionID,
    parts: [{
      type: "text",
      text: `Now synthesize the full backlog into a roadmap with themes.

Full backlog:
${fullBacklog.map((i) => `  [${i.id}] ${i.title} — ${i.priority} ${i.type}, complexity ${i.complexity}`).join("\n")}

Group them into 2–5 themes that tell a coherent product story.
Each theme should have a name, a 1–2 sentence description, and list the item IDs that belong to it.

Output ONLY a JSON object, no text before or after, no markdown fences:

{
  "themes": [
    {
      "name": "Authentication & Security",
      "description": "Harden auth flows, fix credential handling, add token refresh.",
      "items": ["feat-auth-refresh-tokens", "feat-secure-headers"]
    }
  ]
}`,
    }],
  })

  const themes = parseThemes(roadmapResult.text)

  // ── Step 4: Write ROADMAP.md to the repo ─────────────────────────────────
  const roadmapMd = buildRoadmapMarkdown(fullBacklog, themes, repo)
  await promptAndWait(oc, {
    sessionID,
    parts: [{
      type: "text",
      text: `Write the following content to ${repo.localPath}/ROADMAP.md (create or overwrite):

${roadmapMd}

Use the edit or write tool to save it. Confirm when done.`,
    }],
  })

  // ── Step 5: Decide what to dispatch ──────────────────────────────────────
  // Ready features: feasibilityKnown=true, not yet dispatched
  // Spike tasks: feasibilityKnown=false, not yet dispatched
  const undispatched = newItems.filter((i) => !i.dispatchedAt)
  const tasksQueued: Task[] = []

  for (const item of undispatched) {
    const task = backlogItemToTask(item)
    tasksQueued.push(task)
    item.dispatchedAt = new Date().toISOString()
    item.dispatchedTaskId = task.id
    console.log(`[PRODUCT — Lokken] Queuing ${item.type}: ${item.title}`)
  }

  const roadmap: Roadmap = {
    version: new Date().toISOString().slice(0, 10),
    generatedAt: new Date().toISOString(),
    repo,
    themes,
    backlog: fullBacklog,
  }

  emit("product", "turn_end",
    `Product cycle done — ${newItems.length} new items, ${tasksQueued.length} task(s) queued`, 0)

  return {
    scannedAt: new Date().toISOString(),
    newBacklogItems: newItems,
    updatedBacklogItems: fullBacklog,
    roadmap,
    tasksQueued,
  }
}

// ─── Parsers ──────────────────────────────────────────────────────────────────

function parseBacklogItems(text: string, repo: RepoContext): BacklogItem[] {
  const candidates = extractJsonArrayCandidates(text)
  for (const c of candidates) {
    try {
      const arr = JSON.parse(c)
      if (!Array.isArray(arr) || arr.length === 0) continue
      const items: BacklogItem[] = []
      for (const item of arr) {
        if (!item.id || !item.title) continue
        const validPriorities: BacklogPriority[] = ["critical", "high", "medium", "low"]
        const validTypes: TaskType[] = ["feature", "spike"]
        items.push({
          id: String(item.id),
          title: String(item.title),
          description: String(item.description ?? ""),
          type: validTypes.includes(item.type) ? item.type as TaskType : "feature",
          priority: validPriorities.includes(item.priority) ? item.priority as BacklogPriority : "medium",
          sourceRefs: Array.isArray(item.sourceRefs) ? item.sourceRefs.map(String) : [],
          complexity: Math.min(5, Math.max(1, parseInt(String(item.complexity ?? 3)) || 3)),
          feasibilityKnown: Boolean(item.feasibilityKnown ?? true),
          spikeQuestion: item.spikeQuestion ? String(item.spikeQuestion) : undefined,
          repo,
          createdAt: new Date().toISOString(),
        })
      }
      if (items.length > 0) return items
    } catch { /* try next */ }
  }
  console.warn(`[PRODUCT — Lokken] Could not parse backlog. Raw: ${text.slice(0, 300)}`)
  return []
}

function parseThemes(text: string): Roadmap["themes"] {
  const candidates = extractJsonObjectCandidates(text)
  for (const c of candidates) {
    try {
      const obj = JSON.parse(c)
      if (!Array.isArray(obj.themes)) continue
      return obj.themes.map((t: Record<string, unknown>) => ({
        name: String(t["name"] ?? ""),
        description: String(t["description"] ?? ""),
        items: Array.isArray(t["items"]) ? (t["items"] as unknown[]).map(String) : [],
      }))
    } catch { /* try next */ }
  }
  return []
}

function backlogItemToTask(item: BacklogItem): Task {
  const prefix = item.type === "spike" ? "[SPIKE] " : ""
  return {
    id: `product-${item.id}-${Date.now()}`,
    title: `${prefix}${item.title}`,
    description: item.type === "spike"
      ? `This is a feasibility spike. Do not implement yet.\n\nQuestion to answer: ${item.spikeQuestion ?? item.title}\n\n${item.description}\n\nDeliver a written recommendation in the PR description: is this feasible? What is the suggested approach?`
      : item.description,
    repo: item.repo,
    type: item.type,
    sourceRef: item.sourceRefs[0],
  }
}

function buildRoadmapMarkdown(
  backlog: BacklogItem[],
  themes: Roadmap["themes"],
  repo: RepoContext,
): string {
  const repoSlug = repo.remoteUrl.replace(/.*github\.com\//, "").replace(/\.git$/, "")
  const now = new Date().toISOString().slice(0, 10)
  const lines: string[] = [
    `# Roadmap — ${repoSlug}`,
    ``,
    `> Auto-generated by Lokken (Astrophage Product Agent) on ${now}.`,
    `> Do not edit manually — this file is rewritten on each product cycle.`,
    ``,
    `## Themes`,
    ``,
  ]

  for (const theme of themes) {
    lines.push(`### ${theme.name}`)
    lines.push(``)
    lines.push(theme.description)
    lines.push(``)
    const themeItems = backlog.filter((i) => theme.items.includes(i.id))
    for (const item of themeItems) {
      const badge = item.type === "spike" ? "🔬 spike" : "✨ feature"
      const priority = item.priority === "critical" ? "🔴" : item.priority === "high" ? "🟠" : item.priority === "medium" ? "🟡" : "⚪"
      lines.push(`- ${priority} **${item.title}** (${badge}, complexity ${item.complexity})`)
      if (item.sourceRefs.length > 0) {
        lines.push(`  - Sources: ${item.sourceRefs.join(", ")}`)
      }
    }
    lines.push(``)
  }

  // Backlog table
  lines.push(`## Full Backlog`)
  lines.push(``)
  lines.push(`| Priority | Type | Title | Complexity | Status |`)
  lines.push(`|----------|------|-------|------------|--------|`)
  const sorted = [...backlog].sort((a, b) => {
    const order: Record<BacklogPriority, number> = { critical: 0, high: 1, medium: 2, low: 3 }
    return order[a.priority] - order[b.priority]
  })
  for (const item of sorted) {
    const status = item.dispatchedAt ? "⏳ dispatched" : "📋 queued"
    lines.push(`| ${item.priority} | ${item.type} | ${item.title} | ${item.complexity} | ${status} |`)
  }
  lines.push(``)

  return lines.join("\n")
}

// ─── JSON extraction helpers ──────────────────────────────────────────────────

function extractJsonArrayCandidates(text: string): string[] {
  const candidates: string[] = []
  for (const m of text.matchAll(/```(?:json)?\s*([\s\S]+?)```/g)) {
    if (m[1]) candidates.push(m[1].trim())
  }
  let depth = 0, start = -1
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "[") { if (depth === 0) start = i; depth++ }
    else if (text[i] === "]") { depth--; if (depth === 0 && start !== -1) { candidates.push(text.slice(start, i + 1)); start = -1 } }
  }
  return candidates.sort((a, b) => b.length - a.length)
}

function extractJsonObjectCandidates(text: string): string[] {
  const candidates: string[] = []
  for (const m of text.matchAll(/```(?:json)?\s*([\s\S]+?)```/g)) {
    if (m[1]) candidates.push(m[1].trim())
  }
  let depth = 0, start = -1
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "{") { if (depth === 0) start = i; depth++ }
    else if (text[i] === "}") { depth--; if (depth === 0 && start !== -1) { candidates.push(text.slice(start, i + 1)); start = -1 } }
  }
  return candidates.sort((a, b) => b.length - a.length)
}

// ─── Session lifecycle ────────────────────────────────────────────────────────

export async function closeProductSession(): Promise<void> {
  const oc = await getOc()
  if (_sessionID) {
    unregisterSession(_sessionID)
    await oc.session.delete({ sessionID: _sessionID }).catch(() => {})
    _sessionID = null
  }
}

export async function resetProductSession(): Promise<void> {
  await closeProductSession()
}
