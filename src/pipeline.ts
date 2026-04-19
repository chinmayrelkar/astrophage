/**
 * Pipeline runner — PM-driven PR flow:
 *
 * 0. PM (Stratt) analyses the task and produces a dynamic plan
 *    (maxRounds, focusAreas, riskFlags, acceptanceCriteria)
 * 1. Architect (Ilyukhina) derives file contracts and test hints from the plan
 * 2. Coder explores repo, fixes bug, opens PR — guided by PM focusAreas
 * 3. Tester writes & runs tests — guided by PM acceptanceCriteria + Architect testHints
 * 4. Reviewer reads PR diff on GitHub, posts review, returns verdict
 *    — guided by PM riskFlags
 * 5. If rejected → coder reads PR comments, updates code, force-pushes → loop
 * 6. If accepted → reviewer approves + merges PR
 * 7. Exit when accepted or plan.maxRounds hit (not a hardcoded constant)
 */

import { planTask, closePMSession, resetPMSession } from "./agents/pm.js"
import { deriveContracts, closeArchitectSession, resetArchitectSession } from "./agents/architect.js"
import { proposeAndOpenPR, iterateOnPRFeedback, closeCoderSession, resetCoderSession } from "./agents/coder.js"
import type { PRInfo } from "./agents/coder.js"
import { reviewPR, approveAndMergePR, closeReviewerSession, resetReviewerSession } from "./agents/reviewer.js"
import { runTests, closeTesterSession, resetTesterSession } from "./agents/tester.js"
import { roundStart, emit, transcript } from "./transcript.js"
import { startRun, finishRun, setCurrentTask } from "./server.js"
import { closeServer } from "./client.js"
import { startSpan, endSpan } from "./trace.js"
import { clearTokenStats } from "./token-tracker.js"
import type { Task, PipelineResult, PMPlan, Spec } from "./types.js"

// Fallback cap — PM plan.maxRounds always takes precedence when available
const DEFAULT_MAX_ROUNDS = 3

let _running = false

export function isPipelineRunning(): boolean {
  return _running
}

export async function runPipeline(task: Task): Promise<PipelineResult> {
  if (_running) throw new Error("A pipeline is already running")
  _running = true

  // Fresh sessions for every run
  await resetPMSession()
  await resetArchitectSession()
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

  // ── Phase 0: PM planning ──────────────────────────────────────────────────
  let plan: PMPlan | null = null
  let spec: Spec | null = null
  let maxRounds = DEFAULT_MAX_ROUNDS

  try {
    emit("pm", "turn_start", `Planning task: ${task.title}`, 0)
    plan = await planTask(task)
    maxRounds = plan.maxRounds
    emit("pm", "convergence", `Plan ready — maxRounds=${maxRounds}`, 0)
    console.log(`\n[PIPELINE] PM plan: maxRounds=${maxRounds}`)
  } catch (err) {
    console.warn(`[PIPELINE] PM agent failed — falling back to default plan: ${err}`)
    emit("orchestrator", "convergence", `PM agent failed, using default plan: ${err}`, 0)
  }

  // ── Phase 1: Architect contracts ──────────────────────────────────────────
  if (plan) {
    try {
      emit("architect", "turn_start", `Deriving contracts for: ${task.title}`, 0)
      spec = await deriveContracts(task, plan)
      emit("architect", "convergence", `Contracts ready — ${spec.fileContracts.length} file(s)`, 0)
    } catch (err) {
      console.warn(`[PIPELINE] Architect agent failed — proceeding without contracts: ${err}`)
      emit("orchestrator", "convergence", `Architect agent failed: ${err}`, 0)
    }
  }

  // Assemble context objects to inject into per-agent prompts
  const coderCtx = {
    focusAreas: plan?.focusAreas,
    acceptanceCriteria: spec?.acceptanceCriteria ?? plan?.subtasks.map((s) => s.acceptanceCriteria),
  }
  const reviewerCtx = {
    riskFlags: plan?.riskFlags,
  }
  const testerCtx = {
    acceptanceCriteria: spec?.acceptanceCriteria ?? plan?.subtasks.map((s) => s.acceptanceCriteria),
    testHints: spec?.testHints,
  }

  try {
    for (let round = 1; round <= maxRounds; round++) {
      roundStart(round)

      // ── Coder ──────────────────────────────────────────────────────────────
      const coderSpanId = startSpan(runId, "coder", round,
        round === 1 ? "Explore, fix, open PR" : `Iterate on PR feedback (round ${round})`,
        rootSpanId,
      )
      if (round === 1) {
        // First round: explore, fix, open PR — with PM focus areas injected
        pr = await proposeAndOpenPR(task, round, coderCtx)
        endSpan(runId, coderSpanId)
        console.log(`\n[PIPELINE] PR opened: ${pr.url}`)
      } else {
        // Subsequent rounds: read review comments, update, force-push
        await iterateOnPRFeedback(task, pr!, round)
        endSpan(runId, coderSpanId)
      }

      // ── Tester ────────────────────────────────────────────────────────────
      // Pass acceptance criteria + architect test hints to the tester
      const testerSpanId = startSpan(runId, "tester", round,
        `Run tests for PR #${pr!.number}`, rootSpanId,
      )
      const testResult = await runTests(pr!, task.repo, round, testerCtx)
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

        if (round === maxRounds) {
          emit("orchestrator", "convergence", `[UNRESOLVED] Max rounds (${maxRounds}) reached`, round)
          console.log(`\n  [UNRESOLVED] Max rounds reached`)
        }
        continue
      }

      // ── Reviewer ──────────────────────────────────────────────────────────
      // Pass PM risk flags to the reviewer for extra scrutiny
      const reviewerSpanId = startSpan(runId, "reviewer", round,
        `Review PR #${pr!.number}`, rootSpanId,
      )
      const verdict = await reviewPR(pr!, task.repo, round, reviewerCtx)
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
        console.log(`  Closing PR ${pr!.url}`)
        finalStatus = "unresolved"
        break
      }

      // Negotiable rejection — log and loop
      console.log(`  [REJECT] ${verdict.reason}`)
      emit("orchestrator", "convergence", `REJECTED (round ${round}): ${verdict.reason}`, round)
      console.log("═".repeat(70))

      if (round === maxRounds) {
        emit("orchestrator", "convergence", `[UNRESOLVED] Max rounds (${maxRounds}) reached`, round)
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
    await closePMSession()
    await closeArchitectSession()
    await closeCoderSession()
    await closeTesterSession()
    await closeReviewerSession()
    closeServer()
  }
}
