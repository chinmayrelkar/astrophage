# Astrophage

## What It Is

An **agent company** with a **governing web UI**.

A TypeScript orchestration layer runs 5 specialized AI agents through a
convergence loop and ships code via Git. A purpose-built React/Vite web
admin panel is the primary demo surface — a dark ops dashboard where the
governor watches agents think in real time, inspects run history, and
configures the company before firing a task.

The Bawarchi auth bugs are the first task the company ships (demo story).

---

## System Layers

```
┌─────────────────────────────────────────────┐
│              Web UI (React/Vite)             │  ← primary demo surface
│  Live agent panels · History · Config        │
└──────────────────┬──────────────────────────┘
                   │ SSE stream
┌──────────────────▼──────────────────────────┐
│         Astrophage Orchestrator (Node/tsx)    │
│  HTTP server (Hono) + pipeline runner         │
├──────────────────────────────────────────────┤
│  PM · Architect · Coder · Reviewer · Tester  │  ← each: own OpenCode SDK session
│  Git agent (gh CLI → bawarchi main repo)      │
└──────────────────────────────────────────────┘
```

---

## Agent Roles

| Agent      | Responsibility                                                                 |
|------------|--------------------------------------------------------------------------------|
| PM         | Decomposes a task into subtasks with acceptance criteria and spec contracts     |
| Architect  | Designs file structure, interfaces, and constraints before coding begins        |
| Coder      | Implements code per spec, iterates on reviewer/tester feedback                 |
| Reviewer   | Reviews against a constitution (non-negotiable → instant block; negotiable → rounds) |
| Tester     | Writes tests from spec, runs `go test ./...` as real subprocess, reports pass/fail |
| Git        | Branch → patch → commit → open PR → merge (chinmayrelkar/bawarchi directly)   |

Each agent gets its own persistent OpenCode SDK session (clean context isolation).

---

## Convergence Model

```
spec (PM + Architect)
  └─► tests written (Tester)
        └─► code implemented (Coder)
              └─► tests run → PASS? ──No──► Coder patches → loop
                    │
                   Yes
                    └─► Reviewer reads code
                          └─► ACCEPT? ──No──► Coder patches → tests re-run → loop
                                │
                               Yes
                                └─► Git agent: commit → PR → merge
```

- Loop exits when: tests pass AND reviewer accepts
- Max rounds: configurable (default 5)
- Convergence failure: print full transcript `[UNRESOLVED]`, exit non-zero,
  web UI shows red final state

---

## SSE Event Schema

```typescript
type AgentEvent = {
  agent: "pm" | "architect" | "coder" | "reviewer" | "tester" | "git" | "orchestrator"
  type: "token" | "turn_start" | "turn_end" | "test_result" | "verdict" | "git_action" | "round_start" | "convergence"
  content: string       // token text, verdict JSON, test output, git action
  round: number
  timestamp: string
}
```

---

## Web UI — Layout

Single-page dark ops dashboard (primary demo surface):

```
┌──────────────────────────────────────────────────────────┐
│ ASTROPHAGE        [Configure]  [New Task]  [Run History] │
├────────────┬────────────┬────────────┬────────────┬──────┤
│ PM         │ ARCHITECT  │ CODER      │ REVIEWER   │TESTER│
│ ● thinking │ ○ idle     │ ● streaming│ ○ waiting  │ ● ✓ │
│ [token     │            │ [token     │            │      │
│  stream]   │            │  stream]   │            │      │
├────────────┴────────────┴────────────┴────────────┴──────┤
│ CONVERGENCE  Round 2/5  Tests: PASS  Reviewer: HOLD      │
│ ████████░░░░░░░░░░░░░░░░░░  40%                          │
├──────────────────────────────────────────────────────────┤
│ GIT  branch: fix/oauth-auth  PR #42: open  merge: ready  │
└──────────────────────────────────────────────────────────┘
```

**Configurable from UI:**
- Model per agent (dropdown)
- Constitution rules (non-negotiable / negotiable lists)
- Max convergence rounds (slider)
- Task input (text → kick off pipeline)

**Run History:** past runs with outcome (MERGED / UNRESOLVED), click to
inspect full transcript.

---

## File Structure

```
Astrophage/
├── plan.md
├── package.json              # workspace root
├── tsconfig.json
│
├── src/                      # Orchestrator (Node/tsx)
│   ├── main.ts               # entry: starts HTTP server + pipeline
│   ├── server.ts             # Hono HTTP + SSE /events endpoint
│   ├── orchestrator.ts       # PM → Arch → Code↔Test↔Review → Git
│   ├── loop.ts               # convergence loop, max-round enforcement
│   ├── transcript.ts         # structured event emitter → SSE
│   ├── constitution.ts       # reviewer rules object
│   ├── types.ts              # Task, Spec, Patch, ReviewVerdict, TestResult, AgentEvent
│   └── agents/
│       ├── pm.ts
│       ├── architect.ts
│       ├── coder.ts
│       ├── reviewer.ts
│       ├── tester.ts
│       └── git.ts
│
├── web/                      # React/Vite web UI
│   ├── package.json
│   ├── vite.config.ts
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── components/
│       │   ├── AgentPanel.tsx
│       │   ├── ConvergenceBar.tsx
│       │   ├── GitStrip.tsx
│       │   ├── ConfigModal.tsx
│       │   └── RunHistory.tsx
│       ├── hooks/
│       │   ├── useAgentStream.ts
│       │   └── useRunHistory.ts
│       └── styles/
│           └── theme.css
│
└── demo/
    └── bawarchi/
        ├── oauth-task.ts
        └── apikey-task.ts
```

---

## Key Technical Choices

| Concern            | Decision                                                              |
|--------------------|-----------------------------------------------------------------------|
| Orchestrator       | `tsx` (no compile), Node HTTP via **Hono**                            |
| SSE                | Native `text/event-stream` from Hono                                  |
| Web UI             | Vite + React + TypeScript, `EventSource` API                          |
| Styling            | Tailwind CSS + dark ops theme, monospace fonts                        |
| Agent sessions     | One `createOpencode()` per agent, persistent across rounds            |
| Test execution     | `child_process.spawn('go', ['test', './...'])` in bawarchi repo       |
| Git                | `gh` CLI via shell — commits to chinmayrelkar/bawarchi directly       |
| Reviewer output    | OpenCode SDK `json_schema` structured output for verdicts             |

---

## Build Iterations

### Iteration 0 — Skeleton + Coder↔Reviewer (1 round)
- `types.ts`, `transcript.ts`, `constitution.ts`
- `coder.ts` + `reviewer.ts` agents (each: own SDK session)
- Hard-coded seed: gRPC auth-optional bug (`generator/grpc.go:70-72`)
- One round: coder proposes fix → reviewer accepts/rejects → print transcript
- SSE server emits events; web UI shows two agent panels streaming

### Iteration 1 — Tester + Full Convergence Loop
- `tester.ts`: generates Go test, runs `go test ./...` in bawarchi repo
- `loop.ts`: test-driven convergence, max 5 rounds
- OAuth demo: 3-round negotiation, env var naming concession
- Convergence bar live in web UI

### Iteration 2 — PM + Architect + Config UI
- `pm.ts`: task → subtasks with acceptance criteria
- `architect.ts`: file-level contracts before coder starts
- All 5 agent panels in web UI; Configure modal works
- API key demo: instant block in round 1 (key in URL = non-negotiable)

### Iteration 3 — Git Agent + Run History
- `git.ts`: branch → patch → commit → PR → merge in bawarchi
- `orchestrator.ts`: full end-to-end pipeline
- Run history sidebar in web UI
- Web UI is the complete, polished demo surface

---

## Demo Story (3 min)

Web UI is primary. Show the agent company receiving the OAuth task,
watch each agent panel stream its thoughts live, see the convergence loop
negotiate (coder concedes on env var naming, reviewer holds on token refresh),
then the Git agent opens a real PR in bawarchi. Switch to the API key task —
same company, reviewer kills it in round 1. Same constitution. Different fights.
Audience sees the reviewer has rules, not opinions.

---

## NOT Building

- Any non-bawarchi targets (generic for now)
- Multiple coder agents in parallel (single coder per run)
- Dynamic constitution generation
- Test runner beyond `go test`
- Multi-spec parallelism
- Convergence tuning or research

## Bawarchi Repo

https://github.com/chinmayrelkar/bawarchi.git
Cloned at: /home/ubuntu/bawarchi

Key auth bug seeds:
- gRPC auth optional/silent: `internal/generator/grpc.go:70-72`
- gRPC always plaintext (no TLS): `internal/generator/grpc.go:67`
- Non-deterministic scheme selection: `internal/parser/openapi.go:107`
