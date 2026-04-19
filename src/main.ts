/**
 * Astrophage — Iteration 0
 *
 * One round: coder proposes fix → reviewer accepts/rejects.
 * Transcript printed to terminal. SSE server streams events to web UI.
 *
 * Usage:
 *   npx tsx src/main.ts              # defaults to 'oauth' task
 *   npx tsx src/main.ts oauth        # OAuth gRPC auth bug
 *   npx tsx src/main.ts apikey       # API key in URL bug
 *   npx tsx src/main.ts --list       # list all available tasks
 */

import { startServer, startRun, finishRun, setCurrentTask } from "./server.js"
import { proposeInitialFix, closeCoderSession } from "./agents/coder.js"
import { reviewPatch, closeReviewerSession } from "./agents/reviewer.js"
import { roundStart, emit, transcript } from "./transcript.js"
import { closeServer } from "./client.js"
import { TASKS, listTasks } from "../demo/index.js"
import type { Task, PipelineResult } from "./types.js"

// ─── CLI argument parsing ─────────────────────────────────────────────────────

const arg = process.argv[2]

if (arg === "--list" || arg === "-l") {
  listTasks()
  process.exit(0)
}

const taskKey = arg ?? "oauth"
const task: Task | undefined = TASKS[taskKey]

if (!task) {
  console.error(`\nUnknown task: "${taskKey}"`)
  listTasks()
  process.exit(1)
}

// TypeScript can't narrow past process.exit — assert non-null from here
const activeTask = task as Task

// ─── Iteration 0 pipeline: one round ─────────────────────────────────────────

async function runIteration0(task: Task): Promise<PipelineResult> {
  const round = 1
  roundStart(round)

  if (!task.bugSeed) throw new Error("No bug seed for Iteration 0")

  // Step 1: Coder proposes fix
  const patch = await proposeInitialFix(task.bugSeed, task.repo, round)

  // Step 2: Reviewer evaluates
  const verdict = await reviewPatch(patch, task.repo, round)

  // Step 3: Print verdict
  console.log("\n" + "═".repeat(70))
  if (verdict.decision === "accept") {
    console.log("  [VERDICT] ACCEPTED")
    emit("orchestrator", "convergence", "ACCEPTED — patch approved by reviewer", round)
  } else {
    const tag = verdict.nonNegotiable ? "[NON-NEGOTIABLE BLOCK]" : "[REJECT — NEGOTIABLE]"
    console.log(`  [VERDICT] ${tag}`)
    console.log(`  Reason: ${verdict.reason}`)
    if (verdict.violatedRule) {
      console.log(`  Rule:   ${verdict.violatedRule}`)
    }
    emit(
      "orchestrator",
      "convergence",
      `REJECTED${verdict.nonNegotiable ? " [NON-NEGOTIABLE]" : ""}: ${verdict.reason}`,
      round,
    )
  }
  console.log("═".repeat(70))

  transcript.print()

  return {
    taskId: task.id,
    status: verdict.decision === "accept" ? "merged" : "unresolved",
    rounds: [
      {
        number: round,
        patch,
        testResult: { passed: false, output: "skipped in iteration 0", failures: [], round },
        verdict,
      },
    ],
    transcript: transcript.getAll(),
  }
}

// ─── Entry point ──────────────────────────────────────────────────────────────

async function main() {
  console.log("\n" + "█".repeat(70))
  console.log("  ASTROPHAGE — Iteration 0")
  console.log(`  Task [${taskKey}]: ${activeTask.title}`)
  console.log("█".repeat(70) + "\n")

  await startServer(3001)
  setCurrentTask({ id: activeTask.id, title: activeTask.title, description: activeTask.description, repo: activeTask.repo })
  startRun(activeTask.id, activeTask.title)

  try {
    const result = await runIteration0(activeTask)
    finishRun(result.status)
    process.exit(result.status === "merged" ? 0 : 1)
  } catch (err) {
    console.error("[ASTROPHAGE] Fatal error:", err)
    finishRun("unresolved")
    process.exit(1)
  } finally {
    await closeCoderSession()
    await closeReviewerSession()
    closeServer()
  }
}

main()
