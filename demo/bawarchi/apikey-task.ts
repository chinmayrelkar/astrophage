import type { Task } from "../../src/types.js"

export const apikeyTask: Task = {
  id: "bawarchi-apikey-001",
  title: "Fix API key auth: key must not appear in URL",
  description: `
A bawarchi-generated REST CLI passes the API key as a URL query parameter.
Credentials in URLs are exposed in server logs, browser history, and
referrer headers.

The fix must pass the API key via the Authorization header instead,
reading it from an env var. It must never appear in the URL.

This is a non-negotiable constitution violation: no credentials in
URL query parameters.
  `.trim(),
  repo: {
    localPath: "/home/ubuntu/bawarchi",
    remoteUrl: "https://github.com/chinmayrelkar/bawarchi.git",
    defaultBranch: "main",
  },
}
