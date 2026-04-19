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
import { runTests, closeTesterSession, resetTesterSession } from "./agents/tester.js"
import { roundStart, emit, transcript } from "./transcript.js"
import { startRun, finishRun, setCurrentTask } from "./server.js"
import { closeServer } from "./client.js"
import { startSpan, endSpan } from "./trace.js"
import { clearTokenStats } from "./token-tracker.js"
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
  await resetTesterSession()

  setCurrentTask({ id: task.id, title: task.title, description: task.description, repo: task.repo })
  const run = startRun(task.id, task.title)
  const runId = run.id

  // Clear any leftover token stats from previous runs
  clearTokenStats()

  // Root trace span: orchestrator
  const rootSpanId = startSpan(runId, "orchestrator", 0, `Pipeline: ${task.title}`)

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
      const coderSpanId = startSpan(runId, "coder", round,
        round === 1 ? "Explore, fix, open PR" : `Iterate on PR feedback (round ${round})`,
        rootSpanId,
      )
      if (round === 1) {
        // First round: explore, fix, open PR
        pr = await proposeAndOpenPR(task, round)
        endSpan(runId, coderSpanId)
        console.log(`\n[PIPELINE] PR opened: ${pr.url}`)
      } else {
        // Subsequent rounds: read review comments, update, force-push
        await iterateOnPRFeedback(task, pr!, round)
        endSpan(runId, coderSpanId)
      }

      // ── Tester ───────────────────────────────────────────────────────────
      const testerSpanId = startSpan(runId, "tester", round,
        `Run tests for PR #${pr!.number}`, rootSpanId,
      )
      const testResult = await runTests(pr!, task.repo, round)
      endSpan(runId, testerSpanId)

      if (!testResult.passed) {
        const failSummary = testResult.failures.slice(0, 3).join("; ") || "see output"
        emit("orchestrator", "convergence", `TESTS FAILED round ${round}: ${failSummary}`, round)
        console.log("\n" + "═".repeat(70))
        console.log(`  [ROUND ${round}] Tests FAILED — coder will iterate`)
        console.log(`  Failures: ${failSummary}`)
        console.log("═".repeat(70))

        rounds.push({
          number: round,
          patch: pr!.patch,
          testResult,
          verdict: { decision: "reject", reason: `Tests failed: ${failSummary}`, nonNegotiable: false, round },
        })

        if (round === MAX_ROUNDS) {
          emit("orchestrator", "convergence", `[UNRESOLVED] Max rounds (${MAX_ROUNDS}) reached`, round)
          console.log(`\n  [UNRESOLVED] Max rounds reached`)
        }
        continue
      }

      // ── Reviewer ─────────────────────────────────────────────────────────
      const reviewerSpanId = startSpan(runId, "reviewer", round,
        `Review PR #${pr!.number}`, rootSpanId,
      )
      const verdict = await reviewPR(pr!, task.repo, round)
      endSpan(runId, reviewerSpanId)

      rounds.push({
        number: round,
        patch: pr!.patch,
        testResult,
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
    endSpan(runId, rootSpanId)
    finishRun(finalStatus, pr?.url)
    await closeCoderSession()
    await closeTesterSession()
    await closeReviewerSession()
    closeServer()
  }
}
