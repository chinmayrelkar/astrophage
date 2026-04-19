import type { Task } from "../../src/types.js"

export const oauthTask: Task = {
  id: "bawarchi-oauth-001",
  title: "Fix gRPC auth: silent skip must become hard error",
  description: `
The bawarchi-generated gRPC CLI silently skips authentication when the
auth env var is unset. When the env var is missing, the CLI should exit
with a clear error message naming the missing variable — not silently
proceed unauthenticated.

This is a non-negotiable constitution violation: authentication must
never silently succeed.
  `.trim(),
  repo: {
    localPath: "/home/ubuntu/bawarchi",
    remoteUrl: "https://github.com/chinmayrelkar/bawarchi.git",
    defaultBranch: "main",
  },
}
