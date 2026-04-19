// ─── Run Memory ───────────────────────────────────────────────────────────────
// Persists a lightweight summary of every pipeline run so the PM can learn from
// past outcomes. This gives agents cross-task memory: "we tried X on this repo
// before, it took 3 rounds, reviewer rejected it for Y."
//
// Stored at ~/.astrophage/run-memory.json

import { mkdirSync, writeFileSync, readFileSync } from "fs"
import { join } from "path"
import { homedir } from "os"

const STATE_DIR = join(homedir(), ".astrophage")
const MEMORY_PATH = join(STATE_DIR, "run-memory.json")
mkdirSync(STATE_DIR, { recursive: true })

export interface RunSummary {
  taskId: string
  taskTitle: string
  repoUrl: string
  status: string            // "merged" | "unresolved" | "blocked"
  rounds: number
  /** What the reviewer said on the final round (if any) */
  finalVerdict?: string
  /** Key lessons: what worked, what failed */
  lessons: string[]
  /** ISO timestamp */
  completedAt: string
}

function loadAll(): RunSummary[] {
  try {
    return JSON.parse(readFileSync(MEMORY_PATH, "utf8")) as RunSummary[]
  } catch {
    return []
  }
}

function saveAll(summaries: RunSummary[]): void {
  writeFileSync(MEMORY_PATH, JSON.stringify(summaries, null, 2))
}

/** Save a run summary after pipeline completes. */
export function saveRunSummary(summary: RunSummary): void {
  const all = loadAll()
  all.push(summary)
  // Keep last 100 to avoid unbounded growth
  if (all.length > 100) all.splice(0, all.length - 100)
  saveAll(all)
}

/** Get past run summaries for a specific repo. */
export function getPastRunsForRepo(repoUrl: string, limit = 10): RunSummary[] {
  const all = loadAll()
  return all
    .filter((r) => r.repoUrl === repoUrl)
    .slice(-limit)
}

/** Format past runs as a prompt block for the PM agent. */
export function formatRunMemoryForPM(repoUrl: string): string {
  const past = getPastRunsForRepo(repoUrl, 5)
  if (past.length === 0) return ""

  const lines = past.map((r) => {
    const lessons = r.lessons.length > 0 ? ` Lessons: ${r.lessons.join("; ")}` : ""
    return `- "${r.taskTitle}" → ${r.status} (${r.rounds} round${r.rounds !== 1 ? "s" : ""}).${r.finalVerdict ? ` Verdict: ${r.finalVerdict}.` : ""}${lessons}`
  })

  return `\n## Past runs on this repo (agent memory)
The pipeline has worked on this repo before. Learn from these outcomes:
${lines.join("\n")}
\nUse this context to avoid repeating mistakes and to calibrate maxRounds.`
}
