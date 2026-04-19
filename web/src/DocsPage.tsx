// ─── Astrophage — Docs ────────────────────────────────────────────────────────
// Technical reference. Every claim in this document is checked against the
// source file it cites. Where reality differs from the marketing copy, reality
// wins.

import { useEffect, useState } from "react"
import { AGENTS } from "./space/agents"
import { StarfieldBackground } from "./space/StarfieldBackground"
import {
  NavBar, Footer,
  Eyebrow, Pill, Card, CodeBlock, Code, FadeIn,
  color, space, type, baseStyle, container,
  useIsNarrow,
} from "./components/brand"

// ─── Nav sections ─────────────────────────────────────────────────────────────

const NAV_ITEMS: Array<{ id: string; label: string }> = [
  { id: "overview",       label: "Overview" },
  { id: "quickstart",     label: "Quickstart" },
  { id: "crew",           label: "The Crew" },
  { id: "autonomous",     label: "Autonomous Loop" },
  { id: "pipeline",       label: "Pipeline" },
  { id: "constitution",   label: "Constitution" },
  { id: "observability",  label: "Observability" },
  { id: "killswitch",     label: "Kill Switch" },
  { id: "evals",          label: "Evaluation" },
  { id: "space-ui",       label: "Space UI" },
  { id: "architecture",   label: "Architecture" },
  { id: "tech",           label: "Tech Stack" },
  { id: "honest",         label: "Honest Limits" },
]

// ─── Architecture — file inventory ────────────────────────────────────────────
// Verified 2026-04-19 against /home/ubuntu/Astrophage. Every path exists.

const ARCH_FILES: Array<{ path: string; desc: string }> = [
  // Core
  { path: "src/main.ts",                desc: "Entry point — starts the HTTP server and boots the autonomous loop" },
  { path: "src/server.ts",              desc: "Hono HTTP + SSE, run persistence, observability summary endpoint" },
  { path: "src/client.ts",              desc: "OpenCode SDK client — probes TUI (4096) then prior server (4097), spawns on ephemeral port as fallback" },
  { path: "src/pipeline.ts",            desc: "PM → Architect → loop(Coder → Tester → Reviewer) → merge, with dynamic maxRounds" },
  { path: "src/autonomous-loop.ts",     desc: "Scout + Product schedulers, queue dispatch, pause/resume gate" },
  { path: "src/loop-state.ts",          desc: "Filesystem-only pause/resume flag (loaded on every tick)" },
  { path: "src/pause.ts",               desc: "CLI — `npm run pause [reason]`" },
  { path: "src/resume.ts",              desc: "CLI — `npm run resume`" },
  { path: "src/constitution.ts",        desc: "Source of Rocky's rules. Compiled into the reviewer prompt at boot." },
  { path: "src/transcript.ts",          desc: "Singleton event emitter → SSE stream" },
  { path: "src/token-tracker.ts",       desc: "Per-turn input/output token accounting at Sonnet rates ($3/M in, $15/M out)" },
  { path: "src/trace.ts",               desc: "Span-based trace tree — nested call graph per run" },
  { path: "src/run-memory.ts",          desc: "Cross-run memory — last 5 outcomes per repo inform the next PM plan" },
  { path: "src/eval-store.ts",          desc: "Eval history persisted across runs for regression detection" },
  { path: "src/types.ts",               desc: "Shared types: Task, BacklogItem, PMPlan, FileContract, …" },
  // Agents
  { path: "src/agents/scout.ts",        desc: "DuBois — scans GitHub issues AND greps the codebase for violations" },
  { path: "src/agents/product.ts",      desc: "Lokken — backlog, roadmap, features and spike tasks; writes ROADMAP.md" },
  { path: "src/agents/pm.ts",           desc: "Stratt — reads run-memory, sets maxRounds 1..5, emits focus areas + risk flags" },
  { path: "src/agents/architect.ts",    desc: "Ilyukhina — file contracts and test hints, no edits" },
  { path: "src/agents/coder.ts",        desc: "Ryland Grace — `gh pr create`, iterates on comments with `--force-with-lease`" },
  { path: "src/agents/tester.ts",       desc: "Yao — writes *_test.go files, runs `go test ./...`, parses output (Go-only)" },
  { path: "src/agents/reviewer.ts",     desc: "Rocky — enforces the constitution; non-neg → terminate, negotiable → iterate" },
  // Evals + CI
  { path: "evals/eval-set.json",        desc: "12 named test cases" },
  { path: "evals/run-evals.ts",         desc: "CI runner — exits 1 on any failure" },
  { path: ".github/workflows/evals.yml",desc: "GitHub Actions — runs evals on every push and PR" },
  // Web
  { path: "web/src/LandingPage.tsx",            desc: "Public landing page" },
  { path: "web/src/DocsPage.tsx",               desc: "This page" },
  { path: "web/src/App.tsx",                    desc: "Mission Control — live space canvas" },
  { path: "web/src/pages/ObservabilityPage.tsx",desc: "Cross-run stats, cost-by-agent, run history, paused-state banner" },
  { path: "web/src/pages/RunPage.tsx",          desc: "Per-run detail — Events tab + Trace tab" },
  { path: "web/src/components/brand/",          desc: "Shared primitives for Landing + Docs (tokens, Section, Card, Button, …)" },
]

const TECH_STACK = [
  { layer: "Orchestrator",     tech: "TypeScript · tsx · Hono" },
  { layer: "Agent sessions",   tech: "OpenCode SDK v2" },
  { layer: "Model",            tech: "opencode/claude-sonnet-4-6 ($3/M in, $15/M out)" },
  { layer: "Web UI",           tech: "Vite · React · Canvas 2D" },
  { layer: "Git + GitHub ops", tech: "gh CLI" },
  { layer: "CI",               tech: "GitHub Actions (eval regression gate)" },
]

// ─── Layout pieces ────────────────────────────────────────────────────────────

function SectionBlock({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <section id={id} style={{ marginBottom: space.xxxl, scrollMarginTop: "90px" }}>
      <div style={{
        fontSize: "9px",
        letterSpacing: "0.22em",
        color: color.textMute,
        marginBottom: space.md,
        paddingBottom: "12px",
        borderBottom: `1px solid ${color.hairline}`,
        fontWeight: 800,
        textTransform: "uppercase",
      }}>
        {label}
      </div>
      <div style={{ fontSize: "13.5px", color: color.textDim, lineHeight: 1.85 }}>
        {children}
      </div>
    </section>
  )
}

function P({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <p style={{ margin: `0 0 ${space.md}`, ...style }}>{children}</p>
}

function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "clamp(160px, 22%, 220px) 1fr",
      gap: space.md,
      padding: "10px 0",
      borderBottom: `1px solid ${color.hairline}`,
      alignItems: "start",
    }}>
      <div style={{ fontSize: "10px", letterSpacing: "0.15em", color: color.textMute, textTransform: "uppercase" }}>{k}</div>
      <div style={{ fontSize: "13px", color: color.textDim, lineHeight: 1.75 }}>{v}</div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function DocsPage() {
  const isNarrow = useIsNarrow()
  const [active, setActive] = useState<string>("overview")

  // Observe which section is in view for the side-nav highlight
  useEffect(() => {
    const els = NAV_ITEMS
      .map((n) => document.getElementById(n.id))
      .filter((el): el is HTMLElement => el !== null)

    const obs = new IntersectionObserver((entries) => {
      // pick the entry nearest the top that is currently intersecting
      const visible = entries.filter((e) => e.isIntersecting)
      if (visible.length > 0) {
        const top = visible.reduce((best, e) =>
          e.boundingClientRect.top < best.boundingClientRect.top ? e : best
        )
        setActive(top.target.id)
      }
    }, { rootMargin: "-80px 0px -65% 0px", threshold: [0, 0.15, 0.5] })

    els.forEach((el) => obs.observe(el))
    return () => obs.disconnect()
  }, [])

  return (
    <div style={baseStyle.root}>
      <StarfieldBackground />
      <NavBar />

      <div style={{
        position: "relative",
        zIndex: 1,
        maxWidth: container.wide,
        margin: "0 auto",
        padding: `120px clamp(20px, 5vw, 40px) ${space.xxxl}`,
        display: "grid",
        gridTemplateColumns: isNarrow ? "1fr" : "220px 1fr",
        gap: "clamp(24px, 4vw, 56px)",
      }}>
        {/* ── Sticky side nav ── */}
        {!isNarrow && (
          <aside style={{
            position: "sticky",
            top: "90px",
            alignSelf: "start",
            height: "calc(100vh - 110px)",
            overflowY: "auto",
            paddingRight: space.sm,
          }}>
            <div style={{ fontSize: "9px", letterSpacing: "0.22em", color: color.textMute, marginBottom: space.md, textTransform: "uppercase", fontWeight: 800 }}>
              Contents
            </div>
            <nav style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              {NAV_ITEMS.map((n) => (
                <a
                  key={n.id}
                  href={`#${n.id}`}
                  onClick={(e) => {
                    e.preventDefault()
                    document.getElementById(n.id)?.scrollIntoView({ behavior: "smooth", block: "start" })
                  }}
                  style={{
                    fontSize: "11px",
                    letterSpacing: "0.04em",
                    color: active === n.id ? color.accent : color.textMute,
                    padding: "6px 10px",
                    borderLeft: `2px solid ${active === n.id ? color.accent : "transparent"}`,
                    textDecoration: "none",
                    transition: "color 0.2s, border-color 0.2s",
                  }}
                >
                  {n.label}
                </a>
              ))}
            </nav>
            <div style={{ marginTop: space.xl, fontSize: "9px", color: color.textGhost, letterSpacing: "0.14em", lineHeight: 1.7 }}>
              Every claim on this page was verified against the source on 2026-04-19.
            </div>
          </aside>
        )}

        {/* ── Main content ── */}
        <main style={{ minWidth: 0 }}>
          {/* Title */}
          <FadeIn>
            <Eyebrow style={{ marginBottom: space.md }}>Technical Reference</Eyebrow>
            <h1 style={{
              fontSize: "clamp(32px, 5vw, 52px)",
              fontWeight: 900,
              letterSpacing: "-0.01em",
              color: "white",
              lineHeight: 1.1,
              margin: 0,
              marginBottom: space.md,
            }}>
              Astrophage · Docs
            </h1>
            <p style={{
              fontSize: type.bodyLg,
              color: color.textMute,
              lineHeight: 1.75,
              marginBottom: space.xxl,
              maxWidth: "620px",
            }}>
              How a fully autonomous seven-agent company is wired up. What every station does,
              where it lives in the source, and what it actually can't do today.
            </p>
          </FadeIn>

          {/* ── Overview ── */}
          <SectionBlock id="overview" label="Overview">
            <P>
              Astrophage is a closed-loop software engineering company. Seven AI agents operate
              against a watched GitHub repository: two of them continuously hunt for work, one
              plans, one designs, one codes, one tests, one reviews. The pipeline is serialised
              — one task at a time — and every transition emits a live event over SSE.
            </P>
            <P>
              No human submits tasks. The{" "}
              <Code>/task</Code> HTTP endpoint explicitly returns{" "}
              <Code>403</Code> with <em>"Manual task submission is disabled."</em>{" "}
              The only way to stop the system is a filesystem flag on the host — covered in the
              Kill Switch section.
            </P>
          </SectionBlock>

          {/* ── Quickstart ── */}
          <SectionBlock id="quickstart" label="Quickstart">
            <P>
              <strong>Requirements:</strong> Node.js 22+, an <a href="https://opencode.ai" target="_blank" rel="noreferrer" style={{ color: color.accent, textDecoration: "none" }}>OpenCode</a> install,
              a clone of the target repo, and <Code>gh</Code> authenticated.
            </P>
            <CodeBlock label="install">
{`npm install
cd web && npm install && cd ..`}
            </CodeBlock>
            <CodeBlock label="run — terminal 1 (backend + autonomous loop)">
{`npm run dev            # tsx watch src/main.ts
# → HTTP at http://127.0.0.1:3001
# → SSE  at http://127.0.0.1:3001/events`}
            </CodeBlock>
            <CodeBlock label="run — terminal 2 (web UI)">
{`cd web && npm run dev
# → http://localhost:5173`}
            </CodeBlock>
            <CodeBlock label="configure watched repos">
{`# ~/.astrophage/watched-repos.json
[
  {
    "remoteUrl": "https://github.com/your-org/your-repo.git",
    "localPath": "/absolute/path/to/local/clone",
    "defaultBranch": "main"
  }
]`}
            </CodeBlock>
          </SectionBlock>

          {/* ── The crew ── */}
          <SectionBlock id="crew" label="The Crew">
            <P>
              Seven roles, each with a character name from Project Hail Mary, a ship, a single
              mandate, and its own isolated OpenCode SDK session with scoped permissions.
            </P>
            <div style={{
              display: "grid",
              gridTemplateColumns: isNarrow ? "1fr" : "repeat(auto-fit, minmax(260px, 1fr))",
              gap: space.md,
              marginTop: space.md,
            }}>
              {AGENTS.map((a) => (
                <Card key={a.name} accent={a.color}>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "4px" }}>
                    <div style={{ fontSize: "11px", fontWeight: 800, color: a.color, letterSpacing: "0.16em" }}>{a.role}</div>
                    <div style={{ fontSize: "9px", color: color.textFaint, letterSpacing: "0.08em" }}>{a.ship.toUpperCase()}</div>
                  </div>
                  <div style={{ fontSize: "15px", fontWeight: 800, color: "white", marginBottom: "6px" }}>{a.character}</div>
                  <div style={{ fontSize: "12.5px", color: color.textDim, lineHeight: 1.65 }}>{a.description}</div>
                </Card>
              ))}
            </div>
          </SectionBlock>

          {/* ── Autonomous loop ── */}
          <SectionBlock id="autonomous" label="Autonomous Loop">
            <P>
              The loop runs inside the server process. On boot, <Code>startAutonomousLoop()</Code>{" "}
              kicks immediately and then ticks every 30 s. On each tick:
            </P>
            <ul style={{ paddingLeft: "20px", margin: `0 0 ${space.md}`, color: color.textDim }}>
              <li>If the paused flag is set, the tick returns early.</li>
              <li>Otherwise, <Code>dispatchNext()</Code> pops the next task off the queue (if the pipeline is idle).</li>
              <li>If <Code>SCOUT_INTERVAL_MS</Code> has elapsed, Scout runs.</li>
              <li>If <Code>PRODUCT_INTERVAL_MS</Code> has elapsed, Product runs.</li>
            </ul>
            <div style={{ marginTop: space.md }}>
              <KV k="Scout interval"   v={<>Default <Code>5 min</Code>. Override with <Code>SCOUT_INTERVAL_MS</Code>.</>} />
              <KV k="Product interval" v={<>Default <Code>15 min</Code>. Override with <Code>PRODUCT_INTERVAL_MS</Code>.</>} />
              <KV k="Priority"         v="Bug tasks (Scout) prepend the queue. Feature/spike tasks (Product) append. Spikes run before their follow-up features." />
              <KV k="Serialisation"    v={<>Only one pipeline runs at a time. <Code>isPipelineRunning()</Code> gates dispatch.</>} />
              <KV k="Persistence"      v={<>Queue, backlog, seen issues, control state, run history, and cross-run memory all live under <Code>~/.astrophage/</Code>.</>} />
              <KV k="Recovery"         v={<>Runs left in <Code>status: "running"</Code> at shutdown are reclassified to <Code>unresolved</Code> on boot. Event NDJSON sidecars are merged back into the run record.</>} />
            </div>
          </SectionBlock>

          {/* ── Pipeline ── */}
          <SectionBlock id="pipeline" label="Pipeline">
            <P>
              For each dispatched task:
            </P>
            <CodeBlock>
{`PM (Stratt)        ─ plan: { maxRounds, focusAreas, riskFlags }, reads run-memory
Architect (Ilyukhina) ─ fileContracts[] + testHints[]
┌──────────── round N ────────────┐
│ Coder (Ryland Grace)  ─ implement, open PR or force-push update
│ Tester (Yao)          ─ go test ./... → pass | fail
│   if fail → next round
│ Reviewer (Rocky)      ─ verdict: accept | reject { nonNegotiable }
│   accept        → merge PR, done
│   nonNegotiable → terminate, status: unresolved
│   reject        → next round
└──────────────────────────────────┘
max rounds hit → status: unresolved`}
            </CodeBlock>
            <div>
              <KV k="maxRounds" v={<>Dynamic. PM emits an integer between 1 and 5 based on complexity (simple ≈ 2, moderate ≈ 3, complex ≈ 5). A fallback of <Code>3</Code> applies only if planning fails.</>} />
              <KV k="Convergence" v={<>Tests must pass AND reviewer must accept for the pipeline to end in <Pill tone="accent">merged</Pill>.</>} />
              <KV k="Termination" v={<>A non-negotiable verdict ends the pipeline immediately, no further rounds.</>} />
              <KV k="Trace" v={<>Every PM, Architect, Coder, Tester, Reviewer invocation is a span in the run's trace tree, annotated with duration and estimated cost.</>} />
            </div>
          </SectionBlock>

          {/* ── Constitution ── */}
          <SectionBlock id="constitution" label="Reviewer Constitution">
            <P>
              The reviewer operates against a compiled constitution, not a prompt you can tweak
              per-run. Source: <Code>src/constitution.ts</Code>. Five non-negotiable rules and
              five negotiable ones.
            </P>
            <div style={{
              display: "grid",
              gridTemplateColumns: isNarrow ? "1fr" : "1fr 1fr",
              gap: space.md,
              marginTop: space.md,
            }}>
              <Card style={{ background: "rgba(239,68,68,0.05)", borderColor: `${color.danger}33` }}>
                <Pill tone="danger">Non-Negotiable · Instant Block</Pill>
                <div style={{ marginTop: space.md }}>
                  {[
                    "No hardcoded secrets, API keys, or client_ids in source code",
                    "No credentials or tokens passed via URL query parameters",
                    "Authentication must never silently succeed — if auth env var is missing, exit with a clear error",
                    "No plaintext HTTP for token exchange or credential submission",
                    "Token refresh logic must be present for OAuth flows",
                  ].map((r, i) => (
                    <div key={i} style={{ display: "flex", gap: "10px", marginBottom: "12px", fontSize: "12.5px", color: color.textDim, lineHeight: 1.6 }}>
                      <span style={{ color: color.danger, fontWeight: 700, flexShrink: 0 }}>✕</span>
                      {r}
                    </div>
                  ))}
                </div>
              </Card>
              <Card style={{ background: "rgba(251,191,36,0.04)", borderColor: `${color.warn}33` }}>
                <Pill tone="warn">Negotiable · Push Back</Pill>
                <div style={{ marginTop: space.md }}>
                  {[
                    "Environment variable naming convention (MY_APP__TOKEN vs MY_APP_TOKEN)",
                    "Error message wording and verbosity",
                    "Fallback behavior when optional config is missing",
                    "Code style and formatting preferences",
                    "Log level choices",
                  ].map((r, i) => (
                    <div key={i} style={{ display: "flex", gap: "10px", marginBottom: "12px", fontSize: "12.5px", color: color.textDim, lineHeight: 1.6 }}>
                      <span style={{ color: color.warn, fontWeight: 700, flexShrink: 0 }}>~</span>
                      {r}
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </SectionBlock>

          {/* ── Observability ── */}
          <SectionBlock id="observability" label="Observability">
            <P>
              Two surfaces, both fed by the same event stream:
            </P>
            <div>
              <KV k="Live SSE" v={<>
                <Code>GET /events</Code> pushes every agent event as it happens — turn starts, token
                deltas, git actions, convergence markers.
              </>} />
              <KV k="Per-run page" v={<>
                <Code>/run/:id</Code> with two tabs: <strong>Events</strong> (chronological)
                and <strong>Trace</strong> (call graph). Every span carries duration and estimated cost.
              </>} />
              <KV k="Observability page" v={<>
                <Code>/observability</Code> — cross-run stats, cost-by-agent table, run history,
                live loop status, paused-state banner. Data is served from a single
                <Code>/observability/summary</Code> endpoint with a 60 s cache that is invalidated
                on run start, run finish, startup recovery, and every 10 events during a run.
              </>} />
              <KV k="Cost accounting" v={<>
                Token tracker records input and output tokens per turn per agent. Billed at
                Sonnet rates: <Code>$3/M in</Code>, <Code>$15/M out</Code>. The observability
                summary currently approximates total cost using a single rate per token —
                slightly overstates cost; noted for correction.
              </>} />
              <KV k="Persistence" v={<>
                Each run is a JSON record plus an incremental NDJSON sidecar for events.
                On restart the sidecar is merged back, no events lost.
              </>} />
            </div>
          </SectionBlock>

          {/* ── Kill switch ── */}
          <SectionBlock id="killswitch" label="Kill Switch">
            <P>
              The public HTTP API and web UI have no way to stop the autonomous loop.
              This is intentional: the web UI is published on a Tailscale hostname for
              demo purposes, and no visitor should be able to pause the company.
            </P>
            <P>
              The only control surface is a JSON file on the host:
            </P>
            <CodeBlock label="~/.astrophage/loop-state.json">
{`{
  "paused": true,
  "pausedAt": "2026-04-19T12:28:13.591Z",
  "pauseReason": "maintenance"
}`}
            </CodeBlock>
            <P>
              The running loop polls this file at most every 5 s and short-circuits <Code>tick()</Code>
              when <Code>paused: true</Code>. No new Scout/Product cycles, no queue dispatch.
              An in-flight pipeline finishes naturally.
            </P>
            <CodeBlock label="control — on the host">
{`npm run pause                    # pause with no reason
npm run pause -- "maintenance"   # pause with a note
npm run resume                   # clear the flag`}
            </CodeBlock>
            <P>
              The paused state is reflected read-only via <Code>GET /autonomous/status</Code>{" "}
              and rendered as a red banner on the Observability page. It cannot be written from
              HTTP.
            </P>
          </SectionBlock>

          {/* ── Evals ── */}
          <SectionBlock id="evals" label="Evaluation">
            <P>
              <Code>evals/eval-set.json</Code> — 12 named cases, three categories:
            </P>
            <div>
              <KV k="reviewer-parsing (5)" v="Verdict extraction: accept, reject, non-negotiable, fenced JSON, garbage fallback." />
              <KV k="tester-parsing (3)"   v="Test output parsing: pass, fail, no-test-files." />
              <KV k="pipeline-convergence (4)" v="End-to-end: accept round 1, non-neg block, max rounds, test-fail-then-pass." />
            </div>
            <CodeBlock>
{`npm run eval    # runs all 12, exits 1 on any failure or regression`}
            </CodeBlock>
            <P>
              CI: <Code>.github/workflows/evals.yml</Code> runs the suite on every push and pull request.
              Configure branch protection on <Code>master</Code> to require this check if you want it to
              gate merges.
            </P>
            <P>
              Regression history is appended to <Code>~/.astrophage/eval-history.json</Code> and
              surfaced via <Code>GET /evals/latest</Code>.
            </P>
          </SectionBlock>

          {/* ── Space UI ── */}
          <SectionBlock id="space-ui" label="Space UI">
            <P>
              Mission Control is a live 2D space canvas. Everything on it is driven by the SSE stream.
            </P>
            <div>
              <KV k="Task Star" v="The currently-running task glows at the center of the canvas and pulses." />
              <KV k="Ships"     v="7 agents orbit at different radii. A ship brightens when its agent is speaking, pulses while thinking, goes dim when idle." />
              <KV k="Lasers"    v="Animated beams connect ships during agent-to-agent communication. Color blends from sender to receiver." />
              <KV k="Mission Log" v="Right-side panel. Chronological event feed, filterable by agent. Click a ship to scope the log to that agent." />
              <KV k="Autonomous Panel" v="Modal showing Scout/Product last-seen status, upcoming schedule, queue depth, backlog preview." />
              <KV k="Task History strip" v="Bottom rail of recent runs. Click one to open its Run Page." />
            </div>
          </SectionBlock>

          {/* ── Architecture ── */}
          <SectionBlock id="architecture" label="Architecture">
            <P>
              Every path below exists in the repo and was inspected. The description is what the
              file actually does, not what we wish it did.
            </P>
            <div style={{
              border: `1px solid ${color.hairline}`,
              borderRadius: "8px",
              overflow: "hidden",
              background: "rgba(0,0,0,0.2)",
            }}>
              {ARCH_FILES.map((f, i) => (
                <div
                  key={f.path}
                  style={{
                    display: "grid",
                    gridTemplateColumns: isNarrow ? "1fr" : "minmax(220px, 35%) 1fr",
                    gap: space.md,
                    padding: "10px 16px",
                    borderBottom: i === ARCH_FILES.length - 1 ? "none" : `1px solid ${color.hairline}`,
                    alignItems: "start",
                  }}
                >
                  <div style={{
                    fontSize: "12px",
                    color: color.accent,
                    fontWeight: 600,
                    letterSpacing: "0.01em",
                    wordBreak: "break-all",
                  }}>
                    {f.path}
                  </div>
                  <div style={{ fontSize: "12.5px", color: color.textDim, lineHeight: 1.7 }}>
                    {f.desc}
                  </div>
                </div>
              ))}
            </div>
          </SectionBlock>

          {/* ── Tech stack ── */}
          <SectionBlock id="tech" label="Tech Stack">
            <div>
              {TECH_STACK.map((t) => (
                <KV key={t.layer} k={t.layer} v={t.tech} />
              ))}
            </div>
          </SectionBlock>

          {/* ── Honest limits ── */}
          <SectionBlock id="honest" label="Honest Limits">
            <P>
              What the code does not do today:
            </P>
            <div>
              <KV k="Tester is Go-only" v={<>
                <Code>src/agents/tester.ts</Code> hardcodes <Code>go test ./...</Code>. Works because the first target
                repo is a Go codebase (Bawarchi). Generalising the tester is planned, not done.
              </>} />
              <KV k="Single process" v="Cache state, trace, token tracker, and the run registry are in-memory and per-process. No horizontal scaling, no multi-orchestrator coordination." />
              <KV k="Cost figures are estimates" v="Token counts are derived from emitted characters. Not accurate to the billing cent. Good enough for trend lines, not invoices." />
              <KV k="One pipeline at a time" v="By design. The constitution only makes sense if the reviewer sees one change at a time." />
              <KV k="Branch protection not bundled" v={<>The eval workflow runs and reports status. It does not automatically configure branch protection — that's a GitHub setting on your repo.</>} />
            </div>
            <P style={{ marginTop: space.md, color: color.textFaint, fontSize: "12px" }}>
              Everything on this page reflects the code as of the commit this build was made from.
              If you spot drift, the source is the source of truth — file a bug or, better, let DuBois find it.
            </P>
          </SectionBlock>
        </main>
      </div>

      <Footer />
    </div>
  )
}
