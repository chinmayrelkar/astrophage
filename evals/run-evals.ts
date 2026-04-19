/**
 * run-evals.ts — Astrophage eval runner (CI-style)
 *
 * Loads evals/eval-set.json, exercises real agent parsing logic
 * (parseVerdict, parseTestResult) and pipeline convergence logic,
 * then:
 *   - Prints a structured report to stdout
 *   - Writes results to evals/results/latest.json
 *   - Appends the run to ~/.astrophage/eval-history.json via eval-store
 *   - Reports regressions vs the previous run
 *   - Exits with code 1 if any case failed (CI-style)
 *
 * NOTE: The parse functions are inlined here so the runner has zero agent
 * dependencies — the full agent stack requires @opencode-ai/sdk and a running
 * OpenCode daemon. Keeping the runner self-contained makes it fast and
 * deterministic (suitable for CI). The logic is 1-to-1 identical to the
 * implementations in src/agents/reviewer.ts and src/agents/tester.ts.
 */

import { readFileSync, mkdirSync, writeFileSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

// History / regression tracking (no agent deps)
import {
  buildRunRecord,
  compareWithPrevious,
  appendEvalRun,
  type EvalCaseResult,
} from "../src/eval-store.js"

// ─── Paths ────────────────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url))
const EVAL_SET_PATH = join(__dirname, "eval-set.json")
const RESULTS_DIR = join(__dirname, "results")
const LATEST_PATH = join(RESULTS_DIR, "latest.json")

// ─── Eval-set types (mirrors eval-set.json shape) ────────────────────────────

interface ReviewerInput {
  agentOutput: string
  round: number
}

interface TesterInput {
  agentOutput: string
  round: number
}

interface PipelineRoundInput {
  number: number
  testPassed: boolean
  verdictDecision: "accept" | "reject" | null
  verdictNonNegotiable: boolean
}

interface PipelineConvergenceInput {
  rounds: PipelineRoundInput[]
  maxRounds: number
}

interface EvalCase {
  id: string
  category: "reviewer-parsing" | "tester-parsing" | "pipeline-convergence"
  description: string
  input: ReviewerInput | TesterInput | PipelineConvergenceInput
  expectedOutcome: Record<string, unknown>
  passCriteria: string
}

interface EvalSet {
  name: string
  description: string
  version: string
  cases: EvalCase[]
}

// ─── Inlined types (matching src/types.ts) ────────────────────────────────────

interface ReviewVerdict {
  decision: "accept" | "reject"
  reason: string
  violatedRule?: string
  nonNegotiable?: boolean
  round: number
}

interface TestResult {
  passed: boolean
  output: string
  failures: string[]
  round: number
}

// ─── Inlined parseVerdict (identical to src/agents/reviewer.ts) ──────────────
// Kept in sync — if reviewer.ts changes its parsing logic, update here too.

function parseVerdict(text: string, round: number): ReviewVerdict {
  const candidates = [
    text.trim(),
    text.match(/```(?:json)?\s*([\s\S]+?)```/)?.[1]?.trim() ?? "",
    text.match(/(\{[\s\S]*"decision"[\s\S]*\})/)?.[1]?.trim() ?? "",
    // Last {...} block in the text
    [...text.matchAll(/\{[\s\S]*?\}/g)].pop()?.[0] ?? "",
  ]

  for (const c of candidates) {
    if (!c) continue
    try {
      const p = JSON.parse(c)
      if (p.decision === "accept" || p.decision === "reject") {
        return {
          decision: p.decision,
          reason: p.reason ?? "No reason provided",
          violatedRule: p.violatedRule,
          nonNegotiable: p.nonNegotiable ?? false,
          round,
        }
      }
    } catch { /* try next */ }
  }

  return {
    decision: "reject",
    reason: `Could not parse reviewer response: ${text.slice(0, 200)}`,
    nonNegotiable: false,
    round,
  }
}

// ─── Inlined parseTestResult (identical to src/agents/tester.ts) ─────────────
// Kept in sync — if tester.ts changes its parsing logic, update here too.

function parseTestResult(text: string, round: number): TestResult {
  const upper = text.toUpperCase()

  // Treat "no test files" / "no Go files" as passed — nothing to test
  const noTests = /no test files|no go files|\[no test files\]/i.test(text)
  if (noTests && !upper.includes("--- FAIL") && !upper.includes("\nFAIL\t") && !upper.includes("\nFAIL ")) {
    return { passed: true, output: text, failures: [], round }
  }

  // Extract failure lines — lines starting with "--- FAIL" or "FAIL\t"
  const failureLines = text
    .split("\n")
    .filter((line) => /^--- FAIL|^FAIL[\t ]/.test(line.trim()))
    .map((line) => line.trim())

  // Check for explicit FAIL signal
  const hasFail = upper.includes("--- FAIL") ||
    /\nFAIL[\t ]/.test(text) ||
    /\nFAIL\n/.test(text) ||
    /\bFAIL\b/.test(text.split("\n").slice(-5).join("\n"))

  // Check for explicit PASS signal
  const hasPass = upper.includes("--- PASS") ||
    /\bok\b/.test(text.toLowerCase()) ||
    /\bPASS\b/.test(text.split("\n").slice(-5).join("\n"))

  if (hasFail && !hasPass) {
    return {
      passed: false,
      output: text,
      failures: failureLines.length > 0 ? failureLines : ["Tests failed — see output"],
      round,
    }
  }

  if (hasFail) {
    return {
      passed: false,
      output: text,
      failures: failureLines.length > 0 ? failureLines : ["Tests failed — see output"],
      round,
    }
  }

  return { passed: true, output: text, failures: [], round }
}

// ─── Category runners ─────────────────────────────────────────────────────────

function runReviewerParsingCase(evalCase: EvalCase): { passed: boolean; detail: string } {
  const input = evalCase.input as ReviewerInput
  const expected = evalCase.expectedOutcome

  const verdict = parseVerdict(input.agentOutput, input.round)

  const checks: string[] = []
  let passed = true

  if ("decision" in expected) {
    const ok = verdict.decision === expected.decision
    checks.push(`decision: got "${verdict.decision}", want "${expected.decision}" → ${ok ? "OK" : "FAIL"}`)
    if (!ok) passed = false
  }

  if ("nonNegotiable" in expected) {
    const ok = verdict.nonNegotiable === expected.nonNegotiable
    checks.push(`nonNegotiable: got ${verdict.nonNegotiable}, want ${expected.nonNegotiable} → ${ok ? "OK" : "FAIL"}`)
    if (!ok) passed = false
  }

  if ("violatedRuleContains" in expected && typeof expected.violatedRuleContains === "string") {
    const rule = verdict.violatedRule ?? ""
    const ok = rule.toLowerCase().includes((expected.violatedRuleContains as string).toLowerCase())
    checks.push(`violatedRule contains "${expected.violatedRuleContains}": "${rule}" → ${ok ? "OK" : "FAIL"}`)
    if (!ok) passed = false
  }

  if ("reasonContains" in expected && typeof expected.reasonContains === "string") {
    const ok = verdict.reason.startsWith(expected.reasonContains as string)
    checks.push(`reason starts with "${expected.reasonContains}": "${verdict.reason.slice(0, 80)}" → ${ok ? "OK" : "FAIL"}`)
    if (!ok) passed = false
  }

  return { passed, detail: checks.join(" | ") }
}

function runTesterParsingCase(evalCase: EvalCase): { passed: boolean; detail: string } {
  const input = evalCase.input as TesterInput
  const expected = evalCase.expectedOutcome

  const result = parseTestResult(input.agentOutput, input.round)

  const checks: string[] = []
  let passed = true

  if ("passed" in expected) {
    const ok = result.passed === expected.passed
    checks.push(`passed: got ${result.passed}, want ${expected.passed} → ${ok ? "OK" : "FAIL"}`)
    if (!ok) passed = false
  }

  if ("failures" in expected && Array.isArray(expected.failures)) {
    const ok = result.failures.length === (expected.failures as unknown[]).length
    checks.push(`failures.length: got ${result.failures.length}, want ${(expected.failures as unknown[]).length} → ${ok ? "OK" : "FAIL"}`)
    if (!ok) passed = false
  }

  if ("failuresNonEmpty" in expected && expected.failuresNonEmpty === true) {
    const ok = result.failures.length > 0
    checks.push(`failures non-empty: ${result.failures.length} failure(s) → ${ok ? "OK" : "FAIL"}`)
    if (!ok) passed = false
  }

  return { passed, detail: checks.join(" | ") }
}

/**
 * Simulate the pipeline convergence logic from src/pipeline.ts without
 * actually calling any agents — purely exercising the state machine.
 */
function runPipelineConvergenceCase(evalCase: EvalCase): { passed: boolean; detail: string } {
  const input = evalCase.input as PipelineConvergenceInput
  const expected = evalCase.expectedOutcome

  const MAX_ROUNDS = input.maxRounds
  let finalStatus: "merged" | "unresolved" = "unresolved"
  let roundsConsumed = 0

  for (const round of input.rounds) {
    roundsConsumed = round.number

    if (!round.testPassed) {
      if (round.number === MAX_ROUNDS) {
        finalStatus = "unresolved"
        break
      }
      continue
    }

    if (round.verdictDecision === "accept") {
      finalStatus = "merged"
      break
    }

    if (round.verdictDecision === "reject" && round.verdictNonNegotiable) {
      finalStatus = "unresolved"
      break
    }

    // Negotiable reject — continue to next round
    if (round.number === MAX_ROUNDS) {
      finalStatus = "unresolved"
      break
    }
  }

  const checks: string[] = []
  let passed = true

  if ("finalStatus" in expected) {
    const ok = finalStatus === expected.finalStatus
    checks.push(`finalStatus: got "${finalStatus}", want "${expected.finalStatus}" → ${ok ? "OK" : "FAIL"}`)
    if (!ok) passed = false
  }

  if ("roundsConsumed" in expected) {
    const ok = roundsConsumed === expected.roundsConsumed
    checks.push(`roundsConsumed: got ${roundsConsumed}, want ${expected.roundsConsumed} → ${ok ? "OK" : "FAIL"}`)
    if (!ok) passed = false
  }

  return { passed, detail: checks.join(" | ") }
}

// ─── Main runner ──────────────────────────────────────────────────────────────

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════════╗")
  console.log("║  ASTROPHAGE EVAL RUNNER                                          ║")
  console.log("╚══════════════════════════════════════════════════════════════════╝\n")

  // Load eval set
  const evalSet: EvalSet = JSON.parse(readFileSync(EVAL_SET_PATH, "utf8"))
  console.log(`Eval set   : ${evalSet.name} (v${evalSet.version})`)
  console.log(`Cases      : ${evalSet.cases.length}`)
  console.log(`Description: ${evalSet.description}\n`)
  console.log("─".repeat(70))

  const results: EvalCaseResult[] = []

  for (const evalCase of evalSet.cases) {
    const t0 = Date.now()
    let outcome: { passed: boolean; detail: string }

    try {
      switch (evalCase.category) {
        case "reviewer-parsing":
          outcome = runReviewerParsingCase(evalCase)
          break
        case "tester-parsing":
          outcome = runTesterParsingCase(evalCase)
          break
        case "pipeline-convergence":
          outcome = runPipelineConvergenceCase(evalCase)
          break
        default:
          outcome = { passed: false, detail: `Unknown category: ${(evalCase as EvalCase).category}` }
      }
    } catch (err) {
      outcome = { passed: false, detail: `EXCEPTION: ${String(err)}` }
    }

    const durationMs = Date.now() - t0
    const icon = outcome.passed ? "PASS" : "FAIL"
    const prefix = outcome.passed ? "✓" : "✗"

    console.log(`${prefix} [${icon}] ${evalCase.id}`)
    console.log(`       ${evalCase.description}`)
    console.log(`       ${outcome.detail}`)
    console.log(`       criteria: ${evalCase.passCriteria}  (${durationMs}ms)`)
    console.log()

    results.push({
      id: evalCase.id,
      category: evalCase.category,
      description: evalCase.description,
      passed: outcome.passed,
      detail: outcome.detail,
      durationMs,
    })
  }

  // ─── Build run record ─────────────────────────────────────────────────────

  const record = buildRunRecord(results)

  // ─── Regression check (compare BEFORE appending) ──────────────────────────

  const regression = compareWithPrevious(record)

  // ─── Append to history ────────────────────────────────────────────────────

  appendEvalRun(record)

  // ─── Write latest.json ────────────────────────────────────────────────────

  mkdirSync(RESULTS_DIR, { recursive: true })
  const latestPayload = { ...record, regression }
  writeFileSync(LATEST_PATH, JSON.stringify(latestPayload, null, 2))

  // ─── Print summary ────────────────────────────────────────────────────────

  console.log("═".repeat(70))
  console.log("SUMMARY")
  console.log("═".repeat(70))
  console.log(`  Ref        : ${record.ref}`)
  console.log(`  Run at     : ${record.runAt}`)
  console.log(`  Total      : ${record.total}`)
  console.log(`  Passed     : ${record.passed}`)
  console.log(`  Failed     : ${record.failed}`)
  console.log(`  Pass rate  : ${(record.passRate * 100).toFixed(1)}%`)

  if (record.failed > 0) {
    console.log("\n  FAILED CASES:")
    for (const c of results.filter((r) => !r.passed)) {
      console.log(`    ✗ ${c.id}`)
      console.log(`      ${c.detail}`)
    }
  }

  if (regression.regressions.length > 0) {
    console.log("\n  REGRESSIONS (were passing, now failing):")
    for (const id of regression.regressions) {
      console.log(`    !! ${id}`)
    }
  }

  if (regression.improvements.length > 0) {
    console.log("\n  IMPROVEMENTS (were failing, now passing):")
    for (const id of regression.improvements) {
      console.log(`    ++ ${id}`)
    }
  }

  if (regression.newCases.length > 0) {
    console.log("\n  NEW CASES (not in previous run):")
    for (const id of regression.newCases) {
      console.log(`    ~~ ${id}`)
    }
  }

  console.log(`\n  Results written to  : ${LATEST_PATH}`)
  console.log(`  History appended to : ~/.astrophage/eval-history.json`)
  console.log("═".repeat(70))

  // ─── CI exit code ─────────────────────────────────────────────────────────

  if (record.failed > 0 || regression.hasRegressions) {
    const reason = record.failed > 0
      ? `${record.failed} eval case(s) failed`
      : `${regression.regressions.length} regression(s) detected`
    console.error(`\n[EVAL] FAILED — ${reason}`)
    process.exit(1)
  }

  console.log("\n[EVAL] All cases passed.")
  process.exit(0)
}

main().catch((err) => {
  console.error("[EVAL] Fatal error:", err)
  process.exit(1)
})
