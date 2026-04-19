# Astrophage

A **fully autonomous agent company** — 7 specialized AI agents that scan repos for bugs and features, plan fixes, write code, test, review, and ship merged PRs with zero human intervention. Named after the microbe in *Project Hail Mary*.

---

## How It Works

No human submits tasks. Two autonomous agents — **Scout (DuBois)** and **Product (Lokken)** — continuously scan watched repos for work:

- **DuBois** scans GitHub Issues and reads the codebase directly for bugs, security violations, and constitution breaches
- **Lokken** reads issues and user feedback, builds a prioritized feature backlog, writes a `ROADMAP.md`, and queues feature/spike tasks

When they find actionable work, tasks are queued and dispatched automatically:

```
Scout (DuBois)  ─── bugs + code violations ──┐
                                              ├──► Task Queue ──► Pipeline
Product (Lokken) ─── features + spikes ───────┘

Pipeline:
  PM (Stratt) ─► Architect (Ilyukhina) ─► loop[ Coder → Tester → Reviewer ] ─► merge PR
```

Bug tasks are prioritized ahead of feature tasks. The convergence loop runs until tests pass AND the reviewer accepts, or max rounds (set dynamically by the PM) are hit.

---

## The Agents

| Role | Character | Ship | What they do |
|---|---|---|---|
| **SCOUT** | DuBois | Scout Probe | Scans GitHub issues + codebase for bugs and violations |
| **PRODUCT** | Lokken | Observatory | Reads feedback, builds backlog, writes roadmap, queues features |
| **PM** | Stratt | Command Station | Decomposes tasks, sets maxRounds, injects focus areas + risk flags |
| **ARCHITECT** | Ilyukhina | Blueprint Pod | Designs file contracts and interfaces before coding starts |
| **CODER** | Ryland Grace | Hail Mary | Implements fixes, opens PRs, iterates on review feedback |
| **TESTER** | Yao | Research Module | Writes tests, runs them, reports pass or fail |
| **REVIEWER** | Rocky | Eridian Vessel | Reviews PRs against the constitution. No compromise. |

Each agent has its own isolated [OpenCode SDK](https://opencode.ai) session with scoped permissions.

---

## Autonomous Mode

Human task submission is disabled. The system runs a continuous loop:

- **Scout** runs every 5 minutes (configurable via `SCOUT_INTERVAL_MS`)
- **Product** runs every 15 minutes (configurable via `PRODUCT_INTERVAL_MS`)
- Pipeline dispatches one task at a time from the queue
- Run history, events, and agent memory persist across restarts

The PM learns from past outcomes — if a fix was rejected before, it adjusts the plan for the next attempt.

---

## Observability

- **Live SSE stream** — every agent event streamed to the web UI in real time
- **Per-run detail pages** — Events tab + Trace tab with nested call graph
- **Token/cost tracking** — per-agent, per-turn, per-span cost breakdown at Sonnet rates
- **Trace tree** — who called whom, duration and cost per node (PM, Architect, Coder, Tester, Reviewer all instrumented)
- **Incremental persistence** — events written to disk as they arrive, runs survive restarts

---

## Evaluation

A named eval set (`evals/eval-set.json`) with 12 test cases covering:
- Reviewer verdict parsing (accept, reject, non-negotiable, fenced JSON, garbage fallback)
- Tester result parsing (pass, fail, no test files)
- Pipeline convergence logic (accept round 1, non-neg block, max rounds, test-fail-then-pass)

```bash
npm run eval    # exits 1 on any failure
```

CI gated via `.github/workflows/evals.yml` — blocks merge on failure.

---

## The Reviewer Constitution

Rocky enforces a hardcoded constitution with two tiers:

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

## The Space UI

A live 2D space canvas at `http://localhost:5173` (or your Tailscale hostname).

- **Task Star** — the current task glows at the center
- **Ships** — 7 agents orbit at different radii, glowing when active, with role labels
- **Laser beams** — animated beams between ships during communication
- **Mission Log** — chronological event feed, filterable by agent
- **Autonomous Panel** — live view of Scout/Product status, task queue, backlog
- **Run Pages** — per-run detail with Events + Trace tabs, cost breakdown, call graph

---

## Architecture

```
Astrophage/
├── src/
│   ├── main.ts              # Entry point — starts server + autonomous loop
│   ├── server.ts            # Hono HTTP + SSE + autonomous status endpoints
│   ├── client.ts            # OpenCode SDK client — dynamic working directory
│   ├── pipeline.ts          # PM → Architect → loop(Coder → Tester → Reviewer) → merge
│   ├── autonomous-loop.ts   # Continuous loop: Scout + Product → queue → dispatch
│   ├── transcript.ts        # Singleton event emitter → SSE
│   ├── token-tracker.ts     # Per-turn token/cost accounting
│   ├── trace.ts             # Span-based trace tree for the call graph
│   ├── run-memory.ts        # Cross-run memory — PM learns from past outcomes
│   ├── eval-store.ts        # Eval regression tracking
│   ├── types.ts             # Shared types
│   └── agents/
│       ├── scout.ts         # DuBois — scans issues + code for bugs
│       ├── product.ts       # Lokken — backlog, roadmap, features, spikes
│       ├── pm.ts            # Stratt — task planning
│       ├── architect.ts     # Ilyukhina — file contracts
│       ├── coder.ts         # Ryland Grace — implementation
│       ├── tester.ts        # Yao — tests
│       └── reviewer.ts      # Rocky — constitution enforcement
│
├── evals/
│   ├── eval-set.json        # Named eval set (12 cases)
│   └── run-evals.ts         # CI runner (exit 1 on failure)
│
├── web/
│   └── src/
│       ├── App.tsx
│       ├── LandingPage.tsx
│       ├── DocsPage.tsx
│       ├── space/           # Canvas, MissionLog, agents, useSpaceState
│       ├── pages/           # RunPage with Events + Trace tabs
│       └── components/      # AutonomousPanel, GitStrip
│
├── .github/
│   └── workflows/
│       └── evals.yml        # CI gate — blocks merge if evals fail
│
└── demo/
    └── bawarchi/            # Seeded auth bug tasks
```

---

## Running It

**Requirements:**
- Node.js 22+
- [OpenCode](https://opencode.ai) installed and running
- Target repo cloned locally (default: `bawarchi`)

**Install:**
```bash
npm install
cd web && npm install && cd ..
```

**Run the backend (Terminal 1):**
```bash
npx tsx src/main.ts
```

**Run the web UI (Terminal 2):**
```bash
cd web && npm run dev
```

The autonomous loop starts automatically on server boot. Open `http://localhost:5173` to watch.

**Configure watched repos:**

Create `~/.astrophage/watched-repos.json`:
```json
[
  {
    "remoteUrl": "https://github.com/your-org/your-repo.git",
    "localPath": "/path/to/local/clone",
    "defaultBranch": "main"
  }
]
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Orchestrator | TypeScript, `tsx`, [Hono](https://hono.dev) |
| Agent sessions | [OpenCode SDK v2](https://opencode.ai/docs/sdk) |
| Model | `opencode/claude-sonnet-4-6` |
| Web UI | Vite + React + Canvas 2D |
| Git operations | `gh` CLI |
| CI | GitHub Actions |

---

## Related

- [Bawarchi](https://github.com/chinmayrelkar/bawarchi) — the default watched repo
- [Project Hail Mary](https://en.wikipedia.org/wiki/Project_Hail_Mary) — the novel the characters come from
- [OpenCode](https://opencode.ai) — the AI coding agent powering each session
