/**
 * Pipeline runner — PR-driven flow:
 *
 * 1. Coder explores repo, fixes bug, opens PR
 * 2. Reviewer reads PR diff on GitHub, posts review comment, returns verdict
 * 3. If rejected → coder reads PR comments, updates code, force-pushes → loop
 * 4. If accepted → reviewer approves + merges PR
 * 5. Exit when accepted or max rounds hit
 */

import { proposeAndOpenPR, iterateOnPRFeedback, closeCoderSession, resetCoderSession } from "./agents/coder.js"
import type { PRInfo } from "./agents/coder.js"
import { reviewPR, approveAndMergePR, closeReviewerSession, resetReviewerSession } from "./agents/reviewer.js"
import { roundStart, emit, transcript } from "./transcript.js"
import { startRun, finishRun, setCurrentTask } from "./server.js"
import { closeServer } from "./client.js"
import type { Task, PipelineResult } from "./types.js"

const MAX_ROUNDS = 5

let _running = false

export function isPipelineRunning(): boolean {
  return _running
}

export async function runPipeline(task: Task): Promise<PipelineResult> {
  if (_running) throw new Error("A pipeline is already running")
  _running = true

  // Fresh sessions for every run
  await resetCoderSession()
  await resetReviewerSession()

  setCurrentTask({ id: task.id, title: task.title, description: task.description, repo: task.repo })
  startRun(task.id, task.title)

  console.log("\n" + "█".repeat(70))
  console.log("  ASTROPHAGE — Pipeline starting")
  console.log(`  Task: ${task.title}`)
  console.log("█".repeat(70) + "\n")

  let pr: PRInfo | null = null
  let finalStatus: "merged" | "unresolved" = "unresolved"
  const rounds: PipelineResult["rounds"] = []

  try {
    for (let round = 1; round <= MAX_ROUNDS; round++) {
      roundStart(round)

      // ── Coder ────────────────────────────────────────────────────────────
      if (round === 1) {
        // First round: explore, fix, open PR
        pr = await proposeAndOpenPR(task, round)
        console.log(`\n[PIPELINE] PR opened: ${pr.url}`)
      } else {
        // Subsequent rounds: read review comments, update, force-push
        await iterateOnPRFeedback(task, pr!, round)
      }

      // ── Reviewer ─────────────────────────────────────────────────────────
      const verdict = await reviewPR(pr!, task.repo, round)

      rounds.push({
        number: round,
        patch: pr!.patch,
        testResult: { passed: false, output: "skipped", failures: [], round },
        verdict,
      })

      console.log("\n" + "═".repeat(70))
      console.log(`  [ROUND ${round}] Reviewer: ${verdict.decision.toUpperCase()}`)

      if (verdict.decision === "accept") {
        // Reviewer approves and merges the PR
        await approveAndMergePR(pr!, task.repo)
        emit("orchestrator", "convergence", `MERGED — ${pr!.url}`, round)
        console.log(`  [MERGED] ${pr!.url}`)
        finalStatus = "merged"
        break
      }

      if (verdict.nonNegotiable) {
        emit("orchestrator", "convergence", `BLOCKED [NON-NEGOTIABLE]: ${verdict.reason}`, round)
        console.log(`  [BLOCKED] Non-negotiable rule violated: ${verdict.reason}`)
        // Close the PR
        console.log(`  Closing PR ${pr!.url}`)
        finalStatus = "unresolved"
        break
      }

      // Negotiable rejection — log and loop
      console.log(`  [REJECT] ${verdict.reason}`)
      emit("orchestrator", "convergence", `REJECTED (round ${round}): ${verdict.reason}`, round)
      console.log("═".repeat(70))

      if (round === MAX_ROUNDS) {
        emit("orchestrator", "convergence", `[UNRESOLVED] Max rounds (${MAX_ROUNDS}) reached`, round)
        console.log(`\n  [UNRESOLVED] Max rounds reached`)
      }
    }

    transcript.print()

    return {
      taskId: task.id,
      status: finalStatus,
      prUrl: pr?.url,
      rounds,
      transcript: transcript.getAll(),
    }
  } catch (err) {
    console.error("[ASTROPHAGE] Pipeline error:", err)
    emit("orchestrator", "convergence", `ERROR: ${String(err)}`, 0)
    finishRun("unresolved", undefined)
    throw err
  } finally {
    _running = false
    finishRun(finalStatus, pr?.url)
    await closeCoderSession()
    await closeReviewerSession()
    closeServer()
  }
}
