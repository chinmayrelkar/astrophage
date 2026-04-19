import type { Task } from "../../src/types.js"

export const apikeyTask: Task = {
  id: "bawarchi-apikey-001",
  title: "Fix API key auth: key must not appear in URL",
  description: `
A bawarchi-generated REST CLI passes the API key as a URL query parameter
(?api_key=...). This is a non-negotiable constitution violation: credentials
must never be passed via URL query parameters.

The fix must:
1. Remove the api_key query parameter from the URL
2. Pass the API key via the Authorization header instead (Bearer or custom scheme)
3. Read the key from an env var, never hardcode it

The reviewer will block this immediately in round 1 — no negotiation.
This contrasts with the OAuth task which runs multiple rounds.
  `.trim(),
  repo: {
    localPath: "/home/ubuntu/bawarchi",
    remoteUrl: "https://github.com/chinmayrelkar/bawarchi.git",
    defaultBranch: "main",
  },
  bugSeed: {
    file: "internal/generator/rest.go",
    startLine: 76,
    endLine: 82,
    description:
      "Generated REST CLI appends the API key as a URL query parameter " +
      "(?api_key=<value>). This exposes credentials in server logs, browser " +
      "history, and referrer headers. Non-negotiable rule violated: no credentials " +
      "in URL query parameters.",
    buggyCode: `\t// Add API key to URL
\tif apiKey := os.Getenv(authEnvVar); apiKey != "" {
\t\tif strings.Contains(baseURL, "?") {
\t\t\tbaseURL += "&api_key=" + apiKey
\t\t} else {
\t\t\tbaseURL += "?api_key=" + apiKey
\t\t}
\t}`,
  },
}
