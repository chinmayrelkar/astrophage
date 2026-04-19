/**
 * Submit a task to the running Astrophage server.
 *
 * Usage:
 *   npx tsx src/submit.ts --list
 *   npx tsx src/submit.ts oauth
 *   npx tsx src/submit.ts apikey
 */

import { TASKS, listTasks } from "../demo/index.js"

const SERVER = "http://127.0.0.1:3001"

const arg = process.argv[2]

if (!arg || arg === "--list" || arg === "-l") {
  listTasks()
  process.exit(arg ? 0 : 1)
}

const task = TASKS[arg]
if (!task) {
  console.error(`\nUnknown task: "${arg}"`)
  listTasks()
  process.exit(1)
}

// Check server is up
try {
  const health = await fetch(`${SERVER}/health`)
  if (!health.ok) throw new Error("unhealthy")
} catch {
  console.error(`\n[ERROR] Astrophage server not running at ${SERVER}`)
  console.error("  Start it first: npx tsx src/main.ts\n")
  process.exit(1)
}

// Check nothing is already running
const status = await fetch(`${SERVER}/status`).then((r) => r.json()) as { running: boolean }
if (status.running) {
  console.error("\n[ERROR] A pipeline is already running. Wait for it to finish.\n")
  process.exit(1)
}

// Submit
console.log(`\n[SUBMIT] Task: ${task.title}`)
const res = await fetch(`${SERVER}/task`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(task),
})

const body = await res.json() as { accepted?: boolean; error?: string }

if (res.status === 202) {
  console.log(`[SUBMIT] Accepted ✓ — pipeline running in background`)
  console.log(`[SUBMIT] Watch it at http://localhost:5173\n`)
} else {
  console.error(`[SUBMIT] Error ${res.status}: ${body.error}\n`)
  process.exit(1)
}
