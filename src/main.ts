/**
 * Astrophage server
 *
 * Starts the HTTP + SSE server and waits for tasks via POST /task.
 * Submit tasks from the web UI or CLI:
 *
 *   # Start server
 *   npx tsx src/main.ts
 *
 *   # Submit a task (in another terminal)
 *   npx tsx src/submit.ts oauth
 *   npx tsx src/submit.ts apikey
 *   npx tsx src/submit.ts --list
 */

import { startServer } from "./server.js"

async function main() {
  console.log("\n" + "█".repeat(70))
  console.log("  ASTROPHAGE")
  console.log("  Agent company — awaiting tasks")
  console.log("█".repeat(70) + "\n")

  await startServer(3001)

  console.log("[ASTROPHAGE] Ready. Submit tasks via:")
  console.log("  POST http://127.0.0.1:3001/task  (JSON body: Task)")
  console.log("  npx tsx src/submit.ts <taskkey>")
  console.log("  Web UI → New Task button\n")
}

main()
