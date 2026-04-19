import { oauthTask } from "./bawarchi/oauth-task.js"
import { apikeyTask } from "./bawarchi/apikey-task.js"
import type { Task } from "../src/types.js"

export const TASKS: Record<string, Task> = {
  oauth: oauthTask,
  apikey: apikeyTask,
}

export function listTasks(): void {
  console.log("\nAvailable tasks:")
  for (const [key, task] of Object.entries(TASKS)) {
    console.log(`  ${key.padEnd(12)} ${task.title}`)
  }
  console.log()
}
