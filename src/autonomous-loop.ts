// ─── Autonomous Task Loop ──────────────────────────────────────────────────────
// Runs continuously from server startup. No human task submission.
//
// Every SCOUT_INTERVAL_MS  → DuBois (Scout) scans repos for bugs/violations
// Every PRODUCT_INTERVAL_MS → Lokken (Product) reads issues for features/roadmap
//
// Both agents feed into a shared priority queue.
// Bug tasks (DuBois) are dispatched before feature tasks (Lokken).
// Spike tasks always run before their corresponding feature tasks.

import { mkdirSync, writeFileSync, readFileSync, existsSync } from "fs"
import { join } from "path"
import { homedir } from "os"
import { runScout, getWatchedRepos, type ScoutResult } from "./agents/scout.js"
import { runProductCycle, loadBacklog, saveBacklog, type ProductCycleResult } from "./agents/product.js"
import { runPipeline, isPipelineRunning } from "./pipeline.js"
import { emit } from "./transcript.js"
import type { Task, BacklogItem, TaskType } from "./types.js"

// ─── Config ───────────────────────────────────────────────────────────────────

const SCOUT_INTERVAL_MS   = parseInt(process.env["SCOUT_INTERVAL_MS"]   ?? "") || 5  * 60 * 1000
const PRODUCT_INTERVAL_MS = parseInt(process.env["PRODUCT_INTERVAL_MS"] ?? "") || 15 * 60 * 1000

// ─── Persistence ──────────────────────────────────────────────────────────────

const STATE_DIR  = join(homedir(), ".astrophage")
const SEEN_PATH  = join(STATE_DIR, "seen-issues.json")
const QUEUE_PATH = join(STATE_DIR, "task-queue.json")
mkdirSync(STATE_DIR, { recursive: true })

function loadSeenKeys(): Set<string> {
  try { return new Set(JSON.parse(readFileSync(SEEN_PATH, "utf8")) as string[]) }
  catch { return new Set() }
}
function saveSeenKeys(s: Set<string>): void {
  writeFileSync(SEEN_PATH, JSON.stringify([...s], null, 2))
}
function loadQueue(): Task[] {
  try { return JSON.parse(readFileSync(QUEUE_PATH, "utf8")) as Task[] }
  catch { return [] }
}
function saveQueue(q: Task[]): void {
  writeFileSync(QUEUE_PATH, JSON.stringify(q, null, 2))
}

// ─── In-memory state ──────────────────────────────────────────────────────────

let _seenKeys:       Set<string>       = loadSeenKeys()
let _queue:          Task[]            = loadQueue()
let _backlog:        BacklogItem[]     = loadBacklog()
let _scoutRunning    = false
let _productRunning  = false
let _loopStarted     = false
let _nextScoutAt:    Date | null       = null
let _nextProductAt:  Date | null       = null
let _lastScoutResult:   ScoutResult | null        = null
let _lastProductResult: ProductCycleResult | null = null

// ─── Status API ───────────────────────────────────────────────────────────────

export interface LoopStatus {
  running: boolean
  scoutRunning: boolean
  productRunning: boolean
  watchedRepos: string[]
  queue: Array<{ id: string; title: string; type: TaskType | undefined; repo: string }>
  seenKeyCount: number
  backlogSize: number
  nextScoutAt: string | null
  nextProductAt: string | null
  lastScoutAt: string | null
  lastProductAt: string | null
  lastScoutDecisions: Array<{
    source: string; ref: string; actionable: boolean; reason: string; taskTitle?: string
  }>
  lastBacklogItems: Array<{
    id: string; title: string; type: TaskType; priority: string; dispatched: boolean
  }>
}

export function getLoopStatus(): LoopStatus {
  return {
    running: _loopStarted,
    scoutRunning: _scoutRunning,
    productRunning: _productRunning,
    watchedRepos: getWatchedRepos().map((r) => r.remoteUrl),
    queue: _queue.map((t) => ({
      id: t.id,
      title: t.title,
      type: t.type,
      repo: t.repo.remoteUrl.replace(/.*github\.com\//, "").replace(/\.git$/, ""),
    })),
    seenKeyCount: _seenKeys.size,
    backlogSize: _backlog.length,
    nextScoutAt:   _nextScoutAt?.toISOString()   ?? null,
    nextProductAt: _nextProductAt?.toISOString() ?? null,
    lastScoutAt:   _lastScoutResult?.scannedAt   ?? null,
    lastProductAt: _lastProductResult?.scannedAt ?? null,
    lastScoutDecisions: (_lastScoutResult?.decisions ?? []).map((d) => ({
      source: d.source, ref: d.ref, actionable: d.actionable,
      reason: d.reason, taskTitle: d.task?.title,
    })),
    lastBacklogItems: _backlog.map((i) => ({
      id: i.id, title: i.title, type: i.type,
      priority: i.priority, dispatched: !!i.dispatchedAt,
    })),
  }
}

// ─── Scout cycle (DuBois) ─────────────────────────────────────────────────────

async function scoutCycle(): Promise<void> {
  if (_scoutRunning) return
  _scoutRunning = true
  try {
    console.log("\n[LOOP] Scout cycle starting (DuBois)...")
    const result = await runScout(_seenKeys)
    _lastScoutResult = result

    // Mark all evaluated issues as seen
    for (const d of result.decisions) {
      _seenKeys.add(d.ref)
    }
    saveSeenKeys(_seenKeys)

    // Enqueue new bug tasks (priority: prepend ahead of feature tasks)
    const queuedIds = new Set(_queue.map((t) => t.id))
    const newBugTasks = result.actionableTasks.filter((t) => !queuedIds.has(t.id))
    if (newBugTasks.length > 0) {
      // Bug fixes go to the front of the queue (before feature work)
      _queue.unshift(...newBugTasks)
      saveQueue(_queue)
      console.log(`[LOOP] DuBois queued ${newBugTasks.length} bug task(s)`)
    }
  } catch (err) {
    console.error("[LOOP] Scout cycle failed:", err)
  } finally {
    _scoutRunning = false
  }
}

// ─── Product cycle (Lokken) ───────────────────────────────────────────────────

async function productCycle(): Promise<void> {
  if (_productRunning) return
  _productRunning = true
  try {
    console.log("\n[LOOP] Product cycle starting (Lokken)...")

    const repos = getWatchedRepos()
    const allNewTasks: Task[] = []

    for (const repo of repos) {
      try {
        const result = await runProductCycle(repo, _backlog, _seenKeys)
        _lastProductResult = result

        // Merge new backlog items and persist
        const existingIds = new Set(_backlog.map((i) => i.id))
        const newItems = result.newBacklogItems.filter((i) => !existingIds.has(i.id))
        _backlog = [..._backlog, ...newItems]
        saveBacklog(_backlog)

        // Mark product issue refs as seen
        for (const item of result.newBacklogItems) {
          for (const ref of item.sourceRefs) {
            _seenKeys.add(`product:${ref}`)
          }
        }
        saveSeenKeys(_seenKeys)

        allNewTasks.push(...result.tasksQueued)
      } catch (err) {
        console.error(`[LOOP] Product cycle failed for ${repo.remoteUrl}: ${err}`)
      }
    }

    // Enqueue feature/spike tasks at the back (after bug fixes)
    const queuedIds = new Set(_queue.map((t) => t.id))
    const newFeatureTasks = allNewTasks.filter((t) => !queuedIds.has(t.id))
    if (newFeatureTasks.length > 0) {
      _queue.push(...newFeatureTasks)
      saveQueue(_queue)
      console.log(`[LOOP] Lokken queued ${newFeatureTasks.length} feature/spike task(s)`)
    }
  } catch (err) {
    console.error("[LOOP] Product cycle failed:", err)
  } finally {
    _productRunning = false
  }
}

// ─── Dispatch ─────────────────────────────────────────────────────────────────

async function dispatchNext(): Promise<void> {
  if (isPipelineRunning() || _queue.length === 0) return
  const task = _queue.shift()!
  saveQueue(_queue)
  const label = task.type ? `[${task.type.toUpperCase()}]` : ""
  console.log(`\n[LOOP] Dispatching ${label} ${task.title}`)
  emit("scout", "git_action", `Dispatching: ${task.title}`, 0)
  try {
    await runPipeline(task)
  } catch (err) {
    console.error(`[LOOP] Pipeline failed for "${task.title}":`, err)
    emit("scout", "convergence", `Pipeline error for "${task.title}": ${err}`, 0)
  }
}

// ─── Tick ─────────────────────────────────────────────────────────────────────

let _lastScoutTick   = 0
let _lastProductTick = 0

async function tick(): Promise<void> {
  const now = Date.now()

  // Dispatch any queued work (non-blocking check)
  await dispatchNext()

  // Scout runs every SCOUT_INTERVAL_MS
  if (now - _lastScoutTick >= SCOUT_INTERVAL_MS) {
    _lastScoutTick = now
    _nextScoutAt = new Date(now + SCOUT_INTERVAL_MS)
    void scoutCycle()
  }

  // Product runs every PRODUCT_INTERVAL_MS
  if (now - _lastProductTick >= PRODUCT_INTERVAL_MS) {
    _lastProductTick = now
    _nextProductAt = new Date(now + PRODUCT_INTERVAL_MS)
    void productCycle()
  }
}

// ─── Start ────────────────────────────────────────────────────────────────────

export function startAutonomousLoop(): void {
  if (_loopStarted) return
  _loopStarted = true

  console.log(`\n${"═".repeat(60)}`)
  console.log(`  ASTROPHAGE — Autonomous loop starting`)
  console.log(`  Scout interval  : ${SCOUT_INTERVAL_MS / 1000}s (DuBois — bugs + violations)`)
  console.log(`  Product interval: ${PRODUCT_INTERVAL_MS / 1000}s (Lokken — features + roadmap)`)
  console.log(`  Queue on disk   : ${_queue.length} task(s)`)
  console.log(`  Backlog         : ${_backlog.length} item(s)`)
  console.log(`  Seen keys       : ${_seenKeys.size}`)
  console.log(`${"═".repeat(60)}\n`)

  // Kick both cycles immediately on start, then tick every 30s
  _lastScoutTick   = 0
  _lastProductTick = 0
  void tick()
  setInterval(() => void tick(), 30_000)
}
