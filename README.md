# Astrophage

An **agent company** — a team of specialized AI agents that collaborates like a software engineering team to implement, review, test, and ship code autonomously. Named after the microbe in *Project Hail Mary*.

The agents are themed after the characters from the novel. They orbit a central task in a live 2D space UI and communicate via laser beams.

---

## What It Does

You give Astrophage a task (a bug, a feature, a security fix). The agent company takes it from description to merged pull request:

```
PM (Stratt)
  └─► Architect (Ilyukhina)  — designs interfaces and file contracts
        └─► Coder (Ryland Grace)  — implements the fix
              └─► Tester (Yao)  — writes and runs tests
                    └─► Reviewer (Rocky)  — reviews against the constitution
                          └─► PASS? ──No──► Coder iterates → loop
                                │
                               Yes
                                └─► Git (DuBois)  — branch → commit → PR → merge
```

**Convergence:** The loop ends when tests pass AND the reviewer accepts. If max rounds are hit, the pipeline exits with `[UNRESOLVED]` and a full transcript.

---

## The Agents

| Agent | Character | Ship | Role |
|---|---|---|---|
| Coder | Ryland Grace | *Hail Mary* | Implements fixes, iterates on feedback |
| Reviewer | Rocky | *Eridian Vessel* | Reviews code against the constitution — no compromise |
| PM | Stratt | *Command Station* | Decomposes tasks, assigns work |
| Tester | Yao | *Research Module* | Writes tests, runs `go test`, reports truth |
| Architect | Ilyukhina | *Blueprint Pod* | Designs file contracts before coding starts |
| Git | DuBois | *Supply Drone* | Branch, commit, PR, merge |

Each agent has its own isolated [OpenCode SDK](https://opencode.ai) session.

---

## The Reviewer Constitution

The Reviewer (Rocky) enforces a hardcoded constitution with two tiers:

**Non-Negotiable** — instant block, no further rounds:
- No hardcoded secrets, API keys, or client IDs in source
- No credentials passed via URL query parameters
- Auth must never silently succeed — missing env var = hard error
- No plaintext HTTP for token exchange
- OAuth flows must include token refresh logic

**Negotiable** — reviewer pushes back but coder can iterate:
- Env var naming conventions
- Error message wording
- Log level choices
- Code style preferences

---

## Demo: Bawarchi Auth Bugs

[Bawarchi](https://github.com/chinmayrelkar/bawarchi) is a Go CLI generator that reads OpenAPI/proto specs and produces compiled CLIs. It has two seeded auth bugs used to demonstrate the agent company:

**OAuth task** (`demo/bawarchi/oauth-task.ts`)
- Bug: gRPC CLI silently skips auth when env var is unset
- Constitution: non-negotiable violation — auth must never silently succeed
- Expected: 3-round negotiation, coder concedes on error message wording, reviewer accepts

**API key task** (`demo/bawarchi/apikey-task.ts`)
- Bug: API key appended as URL query parameter
- Constitution: non-negotiable violation — credentials must never appear in URLs
- Expected: reviewer kills it in round 1, no negotiation

Same constitution. Same company. Two tasks, two outcomes. The reviewer has rules, not opinions.

---

## The Space UI

A live 2D space canvas at `http://localhost:5173` (or your Tailscale hostname).

- **Task Star** — the current task glows at the center
- **Ships** — each agent orbits at a different radius and speed, glowing when active
- **Laser beams** — animated beams between ships when agents communicate, colour-coded by type
- **Mission Log** — right panel, full chronological comms log; click any ship to filter to that agent
- **Task History** — bottom strip showing all past runs with status, elapsed time, round count

---

## Architecture

```
Astrophage/
├── src/
│   ├── main.ts              # Entry point — seeds task, starts server, runs pipeline
│   ├── server.ts            # Hono HTTP + SSE /events — streams to web UI
│   ├── client.ts            # OpenCode SDK client — spawns dedicated server on port 4097
│   ├── orchestrator.ts      # Full pipeline: PM → Arch → Code↔Test↔Review → Git
│   ├── loop.ts              # Convergence loop with max-round enforcement
│   ├── transcript.ts        # Singleton event emitter → SSE
│   ├── constitution.ts      # Reviewer rules (non-negotiable + negotiable)
│   ├── types.ts             # Shared types: Task, RepoContext, Patch, ReviewVerdict…
│   └── agents/
│       ├── coder.ts         # Ryland Grace
│       ├── reviewer.ts      # Rocky
│       ├── pm.ts            # Stratt
│       ├── architect.ts     # Ilyukhina
│       ├── tester.ts        # Yao
│       └── git.ts           # DuBois
│
├── web/
│   └── src/
│       ├── App.tsx
│       ├── space/
│       │   ├── SpaceCanvas.tsx   # Canvas: starfield, ships, beams, task star
│       │   ├── MissionLog.tsx    # Comms log panel
│       │   ├── TaskHistory.tsx   # Bottom run history strip
│       │   ├── agents.ts         # Character definitions, colors, orbits
│       │   └── useSpaceState.ts  # SSE subscriber → space state
│       └── hooks/
│           └── useAgentStream.ts
│
└── demo/
    └── bawarchi/
        ├── oauth-task.ts
        └── apikey-task.ts
```

---

## Running It

**Requirements:**
- Node.js 20+
- [OpenCode](https://opencode.ai) installed and running (`opencode` in PATH)
- A running OpenCode server (the TUI counts — Astrophage spawns its own on port 4097)

**Install:**
```bash
npm install
cd web && npm install && cd ..
```

**Run the orchestrator (Terminal 1):**
```bash
npx tsx src/main.ts
```

**Run the web UI (Terminal 2):**
```bash
cd web && npm run dev
```

Open `http://localhost:5173` — or your Tailscale hostname if forwarded.

---

## Build Iterations

| Iteration | Status | What |
|---|---|---|
| **0** | ✓ Done | Skeleton — Coder + Reviewer, 1 round, SSE server, space UI |
| **1** | Planned | Tester agent + full convergence loop |
| **2** | Planned | PM + Architect agents |
| **3** | Planned | Git agent — full PR lifecycle |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Orchestrator | TypeScript, `tsx`, [Hono](https://hono.dev) |
| Agent sessions | [OpenCode SDK v2](https://opencode.ai/docs/sdk) |
| Model | `opencode/claude-sonnet-4-6` |
| Web UI | Vite + React + Canvas 2D |
| Git operations | `gh` CLI |
| Target repo | [chinmayrelkar/bawarchi](https://github.com/chinmayrelkar/bawarchi) |

---

## Related

- [plan.md](./plan.md) — full architecture plan
- [Bawarchi](https://github.com/chinmayrelkar/bawarchi) — the target repo the agents work on
- [Project Hail Mary](https://en.wikipedia.org/wiki/Project_Hail_Mary) — the novel the characters come from
- [OpenCode](https://opencode.ai) — the AI coding agent powering each session
