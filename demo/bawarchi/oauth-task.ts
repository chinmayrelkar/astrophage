/**
 * Demo Task: OAuth auth bug in bawarchi gRPC generator
 *
 * Pre-seeded task for Iteration 0 demo. The coder is handed this bug;
 * it does not discover it. The reviewer evaluates the proposed fix.
 */

import type { Task } from "../../src/types.js"

export const oauthTask: Task = {
  id: "bawarchi-oauth-001",
  title: "Fix gRPC auth: silent skip must become hard error",
  description: `
The bawarchi-generated gRPC CLI silently skips authentication when the
auth env var is unset. This violates the constitution: if auth is required,
missing credentials must produce a clear error and exit non-zero.

The fix must:
1. Read the auth env var
2. If unset or empty: print a clear error naming the missing variable, exit 1
3. If set: append it as a Bearer token to the grpcurl args

This is a NON-NEGOTIABLE constitution violation (auth must never silently succeed).
The reviewer should accept a fix that adds a hard error, and may negotiate
on error message wording only.
  `.trim(),
  bugSeed: {
    file: "internal/generator/grpc.go",
    startLine: 70,
    endLine: 72,
    description:
      "gRPC auth is optional and silent. If the auth env var is missing, the " +
      "generated CLI silently proceeds without authentication instead of " +
      "exiting with a clear error. This violates the non-negotiable constitution " +
      "rule: authentication must never silently succeed.",
    buggyCode: `\tif key := os.Getenv(authEnvVar); key != "" {
\t\targs = append(args, "-H", "Authorization: Bearer "+key)
\t}`,
  },
}
