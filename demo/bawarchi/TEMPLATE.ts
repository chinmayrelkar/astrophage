/**
 * Task template — copy this file and fill in the blanks.
 *
 * 1. Copy:    cp demo/bawarchi/TEMPLATE.ts demo/bawarchi/my-task.ts
 * 2. Fill in the fields below.
 * 3. Register: add to demo/index.ts
 * 4. Run:     npx tsx src/main.ts mytask
 *
 * The agents will explore the repo themselves — do not hint at file locations.
 * Just describe the problem clearly in plain English.
 */

import type { Task } from "../../src/types.js"

export const myTask: Task = {
  id: "bawarchi-TODO-001",
  title: "Short title shown in the UI",
  description: `
Describe the problem in plain English:
- What is wrong?
- What should happen instead?
- Which security/correctness rule does this violate?

The coder agent will explore the repo to find and fix it.
  `.trim(),
  repo: {
    localPath: "/home/ubuntu/bawarchi",
    remoteUrl: "https://github.com/chinmayrelkar/bawarchi.git",
    defaultBranch: "main",
  },
}
