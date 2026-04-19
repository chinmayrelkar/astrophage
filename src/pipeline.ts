/**
 * Pipeline runner — executes one iteration-0 round for a given task.
 * Called by the server when a task is submitted via POST /task.
 * Can also be imported directly for CLI use.
 */

import { proposeInitialFix, closeCoderSession } from "./agents/coder.js"
import { reviewPatch, closeReviewerSession } from "./agents/reviewer.js"
import { roundStart, emit, transcript } from "./transcript.js"
import { startRun, finishRun, setCurrentTask } from "./server.js"
import { closeServer } from "./client.js"
import type { Task, Patch, PipelineResult } from "./types.js"

let _running = false

export function isPipelineRunning(): boolean {
  return _running
}

export async function runPipeline(task: Task): Promise<PipelineResult> {
  if (_running) throw new Error("A pipeline is already running")
  _running = true

  setCurrentTask({
    id: task.id,
    title: task.title,
    description: task.description,
    repo: task.repo,
  })
  startRun(task.id, task.title)

  console.log("\n" + "█".repeat(70))
  console.log("  ASTROPHAGE — Pipeline starting")
  console.log(`  Task: ${task.title}`)
  console.log("█".repeat(70) + "\n")

  try {
    const result = await runIteration0(task)
    finishRun(result.status)
    return result
  } catch (err) {
    console.error("[ASTROPHAGE] Pipeline error:", err)
    finishRun("unresolved")
    throw err
  } finally {
    _running = false
    await closeCoderSession()
    await closeReviewerSession()
    closeServer()
  }
}

async function runIteration0(task: Task): Promise<PipelineResult> {
  const round = 1
  roundStart(round)

  // Coder explores repo and proposes fix
  const patch: Patch = await proposeInitialFix(task, round)

  // Reviewer evaluates
  const verdict = await reviewPatch(patch, task.repo, round)

  // Print verdict
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
