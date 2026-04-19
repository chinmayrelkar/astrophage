import { useNavigate } from "react-router-dom"
import { AGENTS } from "./space/agents"

const CONSTITUTION_NON_NEG = [
  "No hardcoded secrets, API keys, or client IDs in source",
  "No credentials passed via URL query parameters",
  "Auth must never silently succeed — missing env var = hard error",
  "No plaintext HTTP for token exchange",
  "OAuth flows must include token refresh logic",
]

const CONSTITUTION_NEG = [
  "Env var naming conventions",
  "Error message wording",
  "Log level choices",
  "Code style preferences",
]

const TECH_STACK = [
  { layer: "Orchestrator", tech: "TypeScript · tsx · Hono" },
  { layer: "Agent Sessions", tech: "OpenCode SDK v2" },
  { layer: "Model", tech: "opencode/claude-sonnet-4-6" },
  { layer: "Web UI", tech: "Vite · React · Canvas 2D" },
  { layer: "Git Operations", tech: "gh CLI" },
  { layer: "CI", tech: "GitHub Actions (evals gate)" },
]

const ARCH_FILES = [
  { path: "src/main.ts", desc: "Entry point — starts server, autonomous loop boots on startup" },
  { path: "src/server.ts", desc: "Hono HTTP + SSE + autonomous status endpoints" },
  { path: "src/client.ts", desc: "OpenCode SDK client — dynamic working directory per task" },
  { path: "src/pipeline.ts", desc: "PM → Architect → loop(Coder → Tester → Reviewer) → merge" },
  { path: "src/autonomous-loop.ts", desc: "Continuous loop: Scout + Product → queue → dispatch" },
  { path: "src/transcript.ts", desc: "Singleton event emitter → SSE" },
  { path: "src/token-tracker.ts", desc: "Per-turn token/cost accounting at Sonnet rates" },
  { path: "src/trace.ts", desc: "Span-based trace tree — nested call graph per run" },
  { path: "src/run-memory.ts", desc: "Cross-run memory — PM learns from past outcomes" },
  { path: "src/eval-store.ts", desc: "Eval regression tracking across versions" },
  { path: "src/types.ts", desc: "Shared types: Task, BacklogItem, PMPlan, Roadmap…" },
  { path: "src/agents/scout.ts", desc: "DuBois — scans GitHub issues + codebase for bugs" },
  { path: "src/agents/product.ts", desc: "Lokken — backlog, roadmap, features, spikes" },
  { path: "src/agents/pm.ts", desc: "Stratt — task planning with cross-run memory" },
  { path: "src/agents/architect.ts", desc: "Ilyukhina — file contracts and test hints" },
  { path: "src/agents/coder.ts", desc: "Ryland Grace — implements fixes, opens PRs" },
  { path: "src/agents/tester.ts", desc: "Yao — writes and runs tests" },
  { path: "src/agents/reviewer.ts", desc: "Rocky — constitution enforcement" },
  { path: "evals/eval-set.json", desc: "Named eval set (12 test cases)" },
  { path: "evals/run-evals.ts", desc: "CI eval runner — exit 1 on failure" },
  { path: ".github/workflows/evals.yml", desc: "GitHub Actions CI gate for evals" },
]

function Section({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <section id={id} style={{ marginBottom: "72px" }}>
      <div style={{
        fontSize: "9px",
        letterSpacing: "0.22em",
        color: "rgba(255,255,255,0.2)",
        marginBottom: "20px",
        paddingBottom: "12px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        fontWeight: 700,
      }}>
        {label}
      </div>
      {children}
    </section>
  )
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code style={{
      background: "rgba(255,255,255,0.05)",
      border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: "3px",
      padding: "1px 6px",
      fontSize: "11px",
      color: "rgba(255,255,255,0.7)",
      fontFamily: "inherit",
    }}>
      {children}
    </code>
  )
}

function CodeBlock({ children }: { children: React.ReactNode }) {
  return (
    <pre style={{
      background: "rgba(0,0,0,0.4)",
      border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: "8px",
      padding: "20px 24px",
      fontSize: "12px",
      lineHeight: 1.85,
      color: "rgba(255,255,255,0.55)",
      overflowX: "auto",
      fontFamily: "inherit",
    }}>
      {children}
    </pre>
  )
}

const NAV_ITEMS = [
  { id: "overview", label: "Overview" },
  { id: "agents", label: "The Agents" },
  { id: "autonomous", label: "Autonomous Mode" },
  { id: "pipeline", label: "Pipeline" },
  { id: "constitution", label: "Constitution" },
  { id: "observability", label: "Observability" },
  { id: "evals", label: "Evaluation" },
  { id: "space-ui", label: "Space UI" },
  { id: "architecture", label: "Architecture" },
  { id: "running", label: "Running It" },
  { id: "tech-stack", label: "Tech Stack" },
]

export function DocsPage() {
  const navigate = useNavigate()

  return (
    <div style={{
      minHeight: "100vh",
      background: "#04040f",
      color: "#e2e8f0",
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* Top nav */}
      <nav style={{
        position: "fixed",
        inset: "0 0 auto 0",
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        padding: "12px 28px",
        background: "rgba(4,4,15,0.9)",
        backdropFilter: "blur(16px)",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        gap: "20px",
      }}>
        <button
          onClick={() => navigate("/")}
          style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0 }}
        >
          <span style={{ fontWeight: 900, fontSize: "12px", letterSpacing: "0.25em", color: "rgba(255,255,255,0.5)" }}>
            ASTROPHAGE
          </span>
        </button>
        <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.15)", letterSpacing: "0.1em" }}>/ DOCS</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: "16px", alignItems: "center" }}>
          <button
            onClick={() => navigate("/app")}
            style={{
              background: "rgba(0,255,135,0.08)",
              border: "1px solid rgba(0,255,135,0.25)",
              borderRadius: "4px",
              color: "#00ff87",
              cursor: "pointer",
              fontSize: "9px",
              letterSpacing: "0.1em",
              padding: "4px 12px",
              fontFamily: "inherit",
            }}
          >
            LAUNCH UI →
          </button>
        </div>
      </nav>

      <div style={{ display: "flex", paddingTop: "48px", flex: 1, maxWidth: "1200px", margin: "0 auto", width: "100%" }}>
        {/* Sidebar */}
        <aside style={{
          width: "200px",
          flexShrink: 0,
          padding: "40px 0 40px 28px",
          position: "sticky",
          top: "48px",
          height: "calc(100vh - 48px)",
          overflowY: "auto",
        }}>
          <div style={{ fontSize: "8px", letterSpacing: "0.2em", color: "rgba(255,255,255,0.15)", marginBottom: "16px" }}>ON THIS PAGE</div>
          {NAV_ITEMS.map(item => (
            <a
              key={item.id}
              href={`#${item.id}`}
              style={{
                display: "block",
                fontSize: "11px",
                color: "rgba(255,255,255,0.3)",
                textDecoration: "none",
                padding: "5px 0",
                letterSpacing: "0.04em",
                transition: "color 0.2s",
              }}
              onMouseOver={e => (e.currentTarget.style.color = "rgba(255,255,255,0.8)")}
              onMouseOut={e => (e.currentTarget.style.color = "rgba(255,255,255,0.3)")}
            >
              {item.label}
            </a>
          ))}
        </aside>

        {/* Main content */}
        <main style={{ flex: 1, padding: "40px 48px 80px 48px", minWidth: 0 }}>
          <div style={{ marginBottom: "56px" }}>
            <h1 style={{ fontSize: "28px", fontWeight: 900, letterSpacing: "0.04em", color: "white", marginBottom: "12px" }}>
              Astrophage Docs
            </h1>
            <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.35)", lineHeight: 1.8, maxWidth: "580px" }}>
              A fully autonomous agent company — 7 AI agents that scan repos for bugs and features, plan fixes, write code, test, review, and ship merged PRs with zero human intervention. Named after the microbe in{" "}
              <a href="https://en.wikipedia.org/wiki/Project_Hail_Mary" target="_blank" rel="noreferrer" style={{ color: "#60a5fa", textDecoration: "none" }}>Project Hail Mary</a>.
            </p>
          </div>

          {/* ── OVERVIEW ── */}
          <Section id="overview" label="OVERVIEW">
            <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.45)", lineHeight: 1.85, marginBottom: "20px" }}>
              No human submits tasks. Two autonomous agents continuously scan watched repos for work. When they find bugs or features, tasks are queued and the pipeline runs automatically.
            </p>
            <CodeBlock>
{`Scout (DuBois)  ─── bugs + code violations ──┐
                                              ├──► Task Queue ──► Pipeline
Product (Lokken) ─── features + spikes ───────┘

Pipeline:
  PM (Stratt) ─► Architect (Ilyukhina) ─► loop[ Coder → Tester → Reviewer ] ─► merge PR`}
            </CodeBlock>
            <p style={{ marginTop: "16px", fontSize: "12px", color: "rgba(255,255,255,0.3)", lineHeight: 1.7 }}>
              <strong style={{ color: "rgba(255,255,255,0.5)" }}>Convergence:</strong>{" "}
              The loop ends when tests pass AND the reviewer accepts. Max rounds are set dynamically by the PM based on task complexity. The PM learns from past run outcomes.
            </p>
          </Section>

          {/* ── AGENTS ── */}
          <Section id="agents" label="THE AGENTS">
            <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
              {AGENTS.map(agent => (
                <div key={agent.name} style={{
                  display: "grid",
                  gridTemplateColumns: "32px 3px 160px 1fr",
                  gap: "16px",
                  alignItems: "center",
                  padding: "16px 0",
                  borderBottom: "1px solid rgba(255,255,255,0.04)",
                }}>
                  <div style={{ fontSize: "18px", textAlign: "center" }}>{agent.emoji}</div>
                  <div style={{ background: agent.color, height: "100%", minHeight: "36px", borderRadius: "2px", boxShadow: `0 0 8px ${agent.color}55` }} />
                  <div>
                    <div style={{ fontSize: "10px", fontWeight: 700, color: agent.color, letterSpacing: "0.1em" }}>
                      {agent.name.toUpperCase()}
                    </div>
                    <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.25)", marginTop: "3px" }}>
                      {agent.character}
                    </div>
                    <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.15)", marginTop: "1px" }}>
                      {agent.ship}
                    </div>
                  </div>
                  <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.45)", lineHeight: 1.6 }}>
                    {agent.description}
                  </div>
                </div>
              ))}
            </div>
            <p style={{ marginTop: "20px", fontSize: "11px", color: "rgba(255,255,255,0.25)", lineHeight: 1.7 }}>
              Each agent runs in its own isolated <a href="https://opencode.ai/docs/sdk" target="_blank" rel="noreferrer" style={{ color: "#60a5fa", textDecoration: "none" }}>OpenCode SDK</a> session.
            </p>
          </Section>

          {/* ── PIPELINE ── */}
          <Section id="pipeline" label="PIPELINE">
            <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.45)", lineHeight: 1.85, marginBottom: "24px" }}>
              The pipeline is fully sequential. Each agent receives the output of the previous as context. The convergence loop (steps 3–5) runs until a stable state is reached.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {[
                { step: "0", agent: "SCOUT", name: "DuBois", color: "#34d399", desc: "Autonomously scans GitHub issues and the codebase for bugs, security violations, and constitution breaches. Queues actionable tasks." },
                { step: "0", agent: "PRODUCT", name: "Lokken", color: "#fb923c", desc: "Reads issues and feedback, builds a prioritized feature backlog, writes ROADMAP.md, queues feature and spike tasks." },
                { step: "1", agent: "PM", name: "Stratt", color: "#a78bfa", desc: "Receives the task. Explores the repo, produces a plan: subtasks, maxRounds, focus areas for the coder, risk flags for the reviewer. Reads past run outcomes for the same repo." },
                { step: "2", agent: "ARCHITECT", name: "Ilyukhina", color: "#60a5fa", desc: "Reads the PM plan. Explores the repo, produces file contracts (which files to change, interfaces) and test hints." },
                { step: "3", agent: "CODER", name: "Ryland Grace", color: "#00ff87", desc: "Implements the fix guided by PM focus areas and Architect contracts. Opens a PR. On subsequent rounds reads review comments and iterates." },
                { step: "4", agent: "TESTER", name: "Yao", color: "#f472b6", desc: "Writes tests guided by PM acceptance criteria and Architect test hints. Runs them. Reports pass/fail with full output." },
                { step: "5", agent: "REVIEWER", name: "Rocky", color: "#fbbf24", desc: "Reviews the PR diff against the constitution, guided by PM risk flags. Approves and merges on pass. Non-negotiable violations terminate immediately." },
              ].map(s => (
                <div key={s.step} style={{
                  display: "grid",
                  gridTemplateColumns: "20px 80px 1fr",
                  gap: "16px",
                  alignItems: "start",
                  padding: "16px",
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.05)",
                  borderRadius: "6px",
                }}>
                  <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.15)", paddingTop: "2px" }}>{s.step}</div>
                  <div>
                    <div style={{ fontSize: "9px", fontWeight: 700, color: s.color, letterSpacing: "0.1em" }}>{s.agent}</div>
                    <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.2)", marginTop: "2px" }}>{s.name}</div>
                  </div>
                  <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.45)", lineHeight: 1.65 }}>{s.desc}</div>
                </div>
              ))}
            </div>
          </Section>

          {/* ── CONSTITUTION ── */}
          <Section id="constitution" label="REVIEWER CONSTITUTION">
            <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.45)", lineHeight: 1.85, marginBottom: "28px" }}>
              Rocky's rules are hardcoded in <Code>src/constitution.ts</Code>. Two tiers determine how violations are handled.
            </p>

            <div style={{ marginBottom: "32px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
                <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#ef4444", boxShadow: "0 0 8px #ef4444" }} />
                <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.15em", color: "#ef4444" }}>NON-NEGOTIABLE</span>
                <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.2)", marginLeft: "8px" }}>— instant block, no further rounds</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {CONSTITUTION_NON_NEG.map(rule => (
                  <div key={rule} style={{ display: "flex", gap: "10px", fontSize: "12px", color: "rgba(255,255,255,0.45)", lineHeight: 1.6, padding: "8px 12px", background: "rgba(239,68,68,0.04)", borderLeft: "2px solid rgba(239,68,68,0.3)", borderRadius: "0 4px 4px 0" }}>
                    <span style={{ color: "#ef4444", flexShrink: 0 }}>✕</span>
                    {rule}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
                <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#fbbf24", boxShadow: "0 0 8px #fbbf24" }} />
                <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.15em", color: "#fbbf24" }}>NEGOTIABLE</span>
                <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.2)", marginLeft: "8px" }}>— reviewer pushes back, coder can iterate</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {CONSTITUTION_NEG.map(rule => (
                  <div key={rule} style={{ display: "flex", gap: "10px", fontSize: "12px", color: "rgba(255,255,255,0.45)", lineHeight: 1.6, padding: "8px 12px", background: "rgba(251,191,36,0.04)", borderLeft: "2px solid rgba(251,191,36,0.25)", borderRadius: "0 4px 4px 0" }}>
                    <span style={{ color: "#fbbf24", flexShrink: 0 }}>~</span>
                    {rule}
                  </div>
                ))}
              </div>
            </div>
          </Section>

          {/* ── SPACE UI ── */}
          <Section id="space-ui" label="SPACE UI">
            <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.45)", lineHeight: 1.85, marginBottom: "24px" }}>
              A live 2D space canvas at <Code>http://localhost:5173/app</Code>. All events are streamed from the orchestrator via SSE.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {[
                { name: "Task Star", desc: "The current task glows at the center of the canvas." },
                { name: "Ships", desc: "Each agent orbits at a different radius and speed, glowing when active." },
                { name: "Laser Beams", desc: "Animated beams between ships when agents communicate, colour-coded by agent type." },
                { name: "Mission Log", desc: "Right panel — full chronological comms log. Click any ship to filter to that agent." },
                { name: "Task History", desc: "Bottom strip showing all past runs with status, elapsed time, and round count." },
              ].map(f => (
                <div key={f.name} style={{ display: "flex", gap: "14px", padding: "12px 16px", background: "rgba(255,255,255,0.02)", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <span style={{ color: "#60a5fa", flexShrink: 0, marginTop: "1px" }}>▸</span>
                  <div>
                    <span style={{ color: "rgba(255,255,255,0.7)", fontWeight: 700, fontSize: "12px" }}>{f.name}</span>
                    <span style={{ color: "rgba(255,255,255,0.35)", fontSize: "12px" }}>{" — "}{f.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          {/* ── AUTONOMOUS MODE ── */}
          <Section id="autonomous" label="AUTONOMOUS MODE">
            <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.45)", lineHeight: 1.85, marginBottom: "24px" }}>
              Human task submission is disabled. The system runs a continuous loop:
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "24px" }}>
              {[
                { name: "Scout cycle", desc: "DuBois scans every 5 min (SCOUT_INTERVAL_MS). Reads GitHub issues + greps the codebase for constitution violations." },
                { name: "Product cycle", desc: "Lokken runs every 15 min (PRODUCT_INTERVAL_MS). Builds a prioritized feature backlog and writes ROADMAP.md." },
                { name: "Task queue", desc: "Bug tasks (from Scout) are prepended; feature tasks (from Product) are appended. Pipeline dispatches one at a time." },
                { name: "Deduplication", desc: "Seen issues are tracked in ~/.astrophage/seen-issues.json. Same issue is never queued twice." },
                { name: "Cross-run memory", desc: "PM reads past run outcomes for the same repo from ~/.astrophage/run-memory.json to avoid repeating mistakes." },
                { name: "Crash recovery", desc: "Events are written to disk incrementally. Runs that were in-progress at shutdown are marked unresolved on restart." },
              ].map(f => (
                <div key={f.name} style={{ display: "flex", gap: "14px", padding: "12px 16px", background: "rgba(255,255,255,0.02)", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <span style={{ color: "#34d399", flexShrink: 0, marginTop: "1px" }}>▸</span>
                  <div>
                    <span style={{ color: "rgba(255,255,255,0.7)", fontWeight: 700, fontSize: "12px" }}>{f.name}</span>
                    <span style={{ color: "rgba(255,255,255,0.35)", fontSize: "12px" }}>{" — "}{f.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          {/* ── OBSERVABILITY ── */}
          <Section id="observability" label="OBSERVABILITY">
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {[
                { name: "Live SSE stream", desc: "Every agent event streamed to the web UI in real time via /events." },
                { name: "Per-run detail pages", desc: "Events tab (filterable by round) + Trace tab with nested call graph." },
                { name: "Token/cost tracking", desc: "Per-agent, per-turn cost breakdown at Claude Sonnet rates ($3/M in, $15/M out)." },
                { name: "Trace tree", desc: "All 5 pipeline agents (PM, Architect, Coder, Tester, Reviewer) have trace spans with cost per node." },
                { name: "Incremental persistence", desc: "Events written to .events.ndjson sidecar as they arrive. Full run JSON rewritten every 10 events." },
                { name: "Cost aggregation", desc: "GET /runs/:id/costs returns per-agent breakdown. GET /stats returns cross-run totals." },
              ].map(f => (
                <div key={f.name} style={{ display: "flex", gap: "14px", padding: "12px 16px", background: "rgba(255,255,255,0.02)", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <span style={{ color: "#60a5fa", flexShrink: 0, marginTop: "1px" }}>▸</span>
                  <div>
                    <span style={{ color: "rgba(255,255,255,0.7)", fontWeight: 700, fontSize: "12px" }}>{f.name}</span>
                    <span style={{ color: "rgba(255,255,255,0.35)", fontSize: "12px" }}>{" — "}{f.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          {/* ── EVALUATION ── */}
          <Section id="evals" label="EVALUATION">
            <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.45)", lineHeight: 1.85, marginBottom: "20px" }}>
              A named eval set with 12 test cases covering reviewer verdict parsing, tester result parsing, and pipeline convergence logic.
            </p>
            <CodeBlock>{"npm run eval    # exits 1 on any failure"}</CodeBlock>
            <p style={{ marginTop: "16px", fontSize: "12px", color: "rgba(255,255,255,0.3)", lineHeight: 1.7 }}>
              CI gated via <Code>.github/workflows/evals.yml</Code> — blocks merge on failure.
              Regression tracking via <Code>~/.astrophage/eval-history.json</Code> compares each run to the previous and reports regressions.
            </p>
          </Section>

          {/* ── ARCHITECTURE ── */}
          <Section id="architecture" label="ARCHITECTURE">
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              {ARCH_FILES.map(f => (
                <div key={f.path} style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: "16px", padding: "8px 12px", borderRadius: "4px" }}
                  onMouseOver={e => (e.currentTarget.style.background = "rgba(255,255,255,0.025)")}
                  onMouseOut={e => (e.currentTarget.style.background = "none")}
                >
                  <code style={{ fontSize: "11px", color: "#60a5fa" }}>{f.path}</code>
                  <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", lineHeight: 1.6 }}>{f.desc}</span>
                </div>
              ))}
            </div>
          </Section>

          {/* ── RUNNING IT ── */}
          <Section id="running" label="RUNNING IT">
            <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)", marginBottom: "8px", letterSpacing: "0.05em" }}>REQUIREMENTS</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "32px" }}>
              {["Node.js 20+", "OpenCode installed and in PATH", "A running OpenCode server (Astrophage spawns its own on port 4097)"].map(r => (
                <div key={r} style={{ display: "flex", gap: "10px", fontSize: "12px", color: "rgba(255,255,255,0.45)" }}>
                  <span style={{ color: "#00ff87" }}>✓</span> {r}
                </div>
              ))}
            </div>

            <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)", marginBottom: "8px", letterSpacing: "0.05em" }}>INSTALL</p>
            <CodeBlock>{"npm install\ncd web && npm install && cd .."}</CodeBlock>

            <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)", margin: "24px 0 8px", letterSpacing: "0.05em" }}>TERMINAL 1 — ORCHESTRATOR</p>
            <CodeBlock>{"npx tsx src/main.ts"}</CodeBlock>

            <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)", margin: "24px 0 8px", letterSpacing: "0.05em" }}>TERMINAL 2 — WEB UI</p>
            <CodeBlock>{"cd web && npm run dev"}</CodeBlock>

            <p style={{ marginTop: "20px", fontSize: "12px", color: "rgba(255,255,255,0.3)", lineHeight: 1.7 }}>
              Open <Code>http://localhost:5173</Code> — or your Tailscale hostname if port-forwarded.
            </p>
          </Section>

          {/* ── TECH STACK ── */}
          <Section id="tech-stack" label="TECH STACK">
            <div style={{ border: "1px solid rgba(255,255,255,0.06)", borderRadius: "8px", overflow: "hidden" }}>
              {TECH_STACK.map((row, i) => (
                <div key={row.layer} style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "14px 20px",
                  borderBottom: i < TECH_STACK.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                }}>
                  <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.25)", letterSpacing: "0.12em" }}>{row.layer.toUpperCase()}</div>
                  <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.55)", fontWeight: 600 }}>{row.tech}</div>
                </div>
              ))}
            </div>
          </Section>
        </main>
      </div>
    </div>
  )
}
