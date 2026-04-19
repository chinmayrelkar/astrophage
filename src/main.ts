/**
 * Astrophage — Iteration 0
 *
 * One round: coder proposes fix for seeded bug → reviewer accepts/rejects.
 * Raw transcript prints to terminal. SSE server streams events to web UI.
 *
 * Usage: npx tsx src/main.ts
 */

import { startServer, startRun, finishRun, setCurrentTask } from "./server.js"
import { proposeInitialFix, closeCoderSession } from "./agents/coder.js"
import { reviewPatch, closeReviewerSession } from "./agents/reviewer.js"
import { roundStart, emit, transcript } from "./transcript.js"
import { closeServer } from "./client.js"
import type { Task, BugSeed, PipelineResult } from "./types.js"

// ─── Seeded task (Iteration 0: hardcoded) ────────────────────────────────────

const oauthBug: BugSeed = {
  file: "internal/generator/grpc.go",
  startLine: 70,
  endLine: 72,
  description:
    "gRPC auth is optional and silent. If the auth env var is missing, the " +
    "generated CLI silently proceeds without authentication instead of " +
    "exiting with an error. This violates the constitution: auth must never " +
    "silently succeed.",
  buggyCode: `\tif key := os.Getenv(authEnvVar); key != "" {
\t\targs = append(args, "-H", "Authorization: Bearer "+key)
\t}`,
}

const task: Task = {
  id: "bawarchi-oauth-001",
  title: "Fix gRPC auth: silent skip must become hard error",
  description:
    "The bawarchi-generated gRPC CLI skips authentication silently when the " +
    "auth env var is unset. The fix must make this a hard error with a clear " +
    "message naming the missing env var.",
  repo: {
    localPath: "/home/ubuntu/bawarchi",
    remoteUrl: "https://github.com/chinmayrelkar/bawarchi.git",
    defaultBranch: "main",
  },
  bugSeed: oauthBug,
}

// ─── Iteration 0 pipeline: one round ─────────────────────────────────────────

async function runIteration0(): Promise<PipelineResult> {
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
  console.log("  Task: " + task.title)
  console.log("█".repeat(70) + "\n")

  // Start SSE server so web UI can connect
  await startServer(3001)
  setCurrentTask({ id: task.id, title: task.title, description: task.description, repo: task.repo })
  startRun(task.id, task.title)

  try {
    const result = await runIteration0()
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
