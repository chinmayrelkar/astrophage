import type { OpencodeClient } from "@opencode-ai/sdk/v2"
import { getClient, promptAndWait } from "../client.js"
import type { RepoContext, TestResult } from "../types.js"
import type { PRInfo } from "./coder.js"
import { agentTurn, emit } from "../transcript.js"

// ─── Tester Agent (Yao) ───────────────────────────────────────────────────────
// Looks at the PR diff, writes a Go test file that exercises the fixed behaviour,
// runs `go test ./...` in /home/ubuntu/bawarchi, and reports pass/fail.

const BAWARCHI_PATH = "/home/ubuntu/bawarchi"

async function getOc(): Promise<OpencodeClient> {
  return getClient()
}

let _sessionID: string | null = null

async function ensureSession(repo: RepoContext): Promise<string> {
  const oc = await getOc()
  if (!_sessionID) {
    const res = await oc.session.create({
      title: "Astrophage Tester — Yao",
      permission: [
        { permission: "read",               pattern: "*", action: "allow" },
        { permission: "edit",               pattern: "*", action: "allow" },
        { permission: "bash",               pattern: "*", action: "allow" },
        { permission: "glob",               pattern: "*", action: "allow" },
        { permission: "grep",               pattern: "*", action: "allow" },
        { permission: "list",               pattern: "*", action: "allow" },
        { permission: "external_directory", pattern: "*", action: "allow" },
      ],
    })
    _sessionID = res.data!.id

    await promptAndWait(oc, {
      sessionID: _sessionID,
      noReply: true,
      parts: [{
        type: "text",
        text: `You are Yao, the Tester agent in the Astrophage agent company.
Your job is to write and run Go tests in the bawarchi repository.

## Repo
- Remote: ${repo.remoteUrl}
- Local path: ${BAWARCHI_PATH}
- Default branch: ${repo.defaultBranch}

You have full access: read, edit files, run bash, git, gh CLI.

## Rules
- Always work in the directory: ${BAWARCHI_PATH}
- Look at the PR diff to understand what changed.
- Write a *_test.go file that tests the specific behaviour that was fixed or added.
- Run \`go test ./...\` in ${BAWARCHI_PATH} to verify the tests.
- If there are no Go files to test, that is acceptable — report PASS.
- Keep tests minimal and focused on the fix.
- Report PASS or FAIL clearly in your output.`,
      }],
    })
  }
  return _sessionID
}

// ─── Run tests for a PR ───────────────────────────────────────────────────────

export async function runTests(pr: PRInfo, repo: RepoContext, round: number): Promise<TestResult> {
  const oc = await getOc()
  const sessionID = await ensureSession(repo)

  emit("tester", "turn_start", `Writing and running tests for PR #${pr.number} (round ${round})`, round)
  console.log(`\n[TESTER] Running tests for PR #${pr.number} — round ${round}`)

  const prompt = `Look at PR #${pr.number} and write a Go test for the fixed behaviour.

PR: ${pr.url}
PR number: ${pr.number}

Steps:
1. Read the PR diff: gh pr diff ${pr.number}
2. Understand what code changed and what behaviour was fixed or added
3. In the directory ${BAWARCHI_PATH}, write a *_test.go file that:
   - Tests the specific behaviour that was fixed/added
   - Uses standard Go testing package
   - Has at least one test function that exercises the changed code
4. Run the tests: cd ${BAWARCHI_PATH} && go test ./...
5. Report the full output of \`go test ./...\`

If the package has no Go files or no testable code, simply run \`go test ./...\` and report the result.

End your response with one of:
- "PASS" if all tests passed (or there were no test failures)
- "FAIL" followed by the failure details if any tests failed`

  const result = await promptAndWait(oc, {
    sessionID,
    parts: [{ type: "text", text: prompt }],
  })

  const testResult = parseTestResult(result.text, round)

  const label = testResult.passed ? "Tests PASSED" : `Tests FAILED (${testResult.failures.length} failure(s))`
  agentTurn("tester", label, result.text.slice(0, 400), round)
  emit("tester", "test_result", JSON.stringify({ passed: testResult.passed, output: testResult.output }), round)

  console.log(`\n[TESTER] ${label}`)
  if (!testResult.passed) {
    for (const f of testResult.failures) {
      console.log(`  FAIL: ${f}`)
    }
  }

  return testResult
}

// ─── Parse go test output ─────────────────────────────────────────────────────

function parseTestResult(text: string, round: number): TestResult {
  const upper = text.toUpperCase()

  // Treat "no test files" / "no Go files" as passed — nothing to test
  const noTests = /no test files|no go files|\[no test files\]/i.test(text)
  if (noTests && !upper.includes("--- FAIL") && !upper.includes("\nFAIL\t") && !upper.includes("\nFAIL ")) {
    return {
      passed: true,
      output: text,
      failures: [],
      round,
    }
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
    // The agent ends with "FAIL" on its own line
    /\bFAIL\b/.test(text.split("\n").slice(-5).join("\n"))

  // Check for explicit PASS signal
  const hasPass = upper.includes("--- PASS") ||
    /\bok\b/.test(text.toLowerCase()) ||
    /\bPASS\b/.test(text.split("\n").slice(-5).join("\n"))

  // If explicit FAIL found, it fails
  if (hasFail && !hasPass) {
    return {
      passed: false,
      output: text,
      failures: failureLines.length > 0 ? failureLines : ["Tests failed — see output"],
      round,
    }
  }

  // If both signals present, FAIL wins
  if (hasFail) {
    return {
      passed: false,
      output: text,
      failures: failureLines.length > 0 ? failureLines : ["Tests failed — see output"],
      round,
    }
  }

  // Default to passed if no failure detected
  return {
    passed: true,
    output: text,
    failures: [],
    round,
  }
}

// ─── Session lifecycle ────────────────────────────────────────────────────────

export async function closeTesterSession() {
  const oc = await getOc()
  if (_sessionID) {
    await oc.session.delete({ sessionID: _sessionID }).catch(() => {})
    _sessionID = null
  }
}

export async function resetTesterSession() {
  await closeTesterSession()
}
