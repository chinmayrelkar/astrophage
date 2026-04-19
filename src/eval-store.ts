/**
 * eval-store.ts — Tracks eval results over time and detects regressions.
 *
 * Appends each run to ~/.astrophage/eval-history.json.
 * Compares the latest run against the previous one and surfaces regressions.
 */

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "fs"
import { join } from "path"
import { homedir } from "os"
import { execSync } from "child_process"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EvalCaseResult {
  id: string
  category: string
  description: string
  passed: boolean
  /** Human-readable explanation of why the case passed or failed */
  detail: string
  durationMs: number
}

export interface EvalRunRecord {
  /** ISO timestamp of when this run was executed */
  runAt: string
  /** Git branch / commit (if available) */
  ref: string
  /** Total eval cases executed */
  total: number
  /** How many passed */
  passed: number
  /** How many failed */
  failed: number
  /** Overall pass rate 0–1 */
  passRate: number
  /** Per-case results */
  cases: EvalCaseResult[]
}

export interface EvalRegressionReport {
  /** Cases that were passing before but are now failing */
  regressions: string[]
  /** Cases that were failing before but are now passing */
  improvements: string[]
  /** Cases only present in the latest run */
  newCases: string[]
  hasRegressions: boolean
}

// ─── Paths ────────────────────────────────────────────────────────────────────

const ASTROPHAGE_DIR = join(homedir(), ".astrophage")
const HISTORY_FILE = join(ASTROPHAGE_DIR, "eval-history.json")

function ensureDir() {
  mkdirSync(ASTROPHAGE_DIR, { recursive: true })
}

// ─── Load / save history ──────────────────────────────────────────────────────

function loadHistory(): EvalRunRecord[] {
  if (!existsSync(HISTORY_FILE)) return []
  try {
    const raw = readFileSync(HISTORY_FILE, "utf8")
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveHistory(history: EvalRunRecord[]) {
  ensureDir()
  writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2))
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Append a completed eval run to the persistent history file.
 * Returns the updated history.
 */
export function appendEvalRun(record: EvalRunRecord): EvalRunRecord[] {
  const history = loadHistory()
  history.push(record)
  saveHistory(history)
  return history
}

/**
 * Retrieve the full eval history (oldest → newest).
 */
export function getEvalHistory(): EvalRunRecord[] {
  return loadHistory()
}

/**
 * Return only the most recent eval run record, or null if no history exists.
 */
export function getLatestEvalRun(): EvalRunRecord | null {
  const history = loadHistory()
  return history.length > 0 ? history[history.length - 1] : null
}

/**
 * Compare the latest run against the previous run.
 * Returns a regression report — empty arrays if no previous run.
 *
 * NOTE: Call this BEFORE appending the latest run so that "previous" is the
 * last entry in history. The runner does this in the correct order.
 */
export function compareWithPrevious(latest: EvalRunRecord): EvalRegressionReport {
  const history = loadHistory()
  const previous = history.length > 0 ? history[history.length - 1] : null

  const report: EvalRegressionReport = {
    regressions: [],
    improvements: [],
    newCases: [],
    hasRegressions: false,
  }

  if (!previous) return report

  const prevById = new Map(previous.cases.map((c) => [c.id, c]))
  const latestById = new Map(latest.cases.map((c) => [c.id, c]))

  for (const [id, latestCase] of latestById) {
    const prevCase = prevById.get(id)
    if (!prevCase) {
      report.newCases.push(id)
      continue
    }
    if (prevCase.passed && !latestCase.passed) {
      report.regressions.push(id)
    } else if (!prevCase.passed && latestCase.passed) {
      report.improvements.push(id)
    }
  }

  report.hasRegressions = report.regressions.length > 0
  return report
}

/**
 * Build an EvalRunRecord from a list of case results.
 * Reads the current git ref if possible.
 */
export function buildRunRecord(cases: EvalCaseResult[]): EvalRunRecord {
  const passed = cases.filter((c) => c.passed).length
  const failed = cases.length - passed
  return {
    runAt: new Date().toISOString(),
    ref: resolveGitRef(),
    total: cases.length,
    passed,
    failed,
    passRate: cases.length > 0 ? passed / cases.length : 0,
    cases,
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolveGitRef(): string {
  try {
    const branch = execSync("git rev-parse --abbrev-ref HEAD 2>/dev/null", { encoding: "utf8" }).trim()
    const sha = execSync("git rev-parse --short HEAD 2>/dev/null", { encoding: "utf8" }).trim()
    return `${branch}@${sha}`
  } catch {
    return "unknown"
  }
}
