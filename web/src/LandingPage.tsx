// ─── Astrophage — Landing ─────────────────────────────────────────────────────
// Portfolio showcase for a fully autonomous seven-agent software team.
// Every claim on this page has been verified against the source it describes.
// Aesthetic: refined terminal / space. Strict mono. Dark. Personal voice.

import { useNavigate } from "react-router-dom"
import { AGENTS } from "./space/agents"
import { StarfieldBackground } from "./space/StarfieldBackground"
import {
  NavBar, Footer, OrbitDiagram,
  Section, Eyebrow, Pill, Card, CodeBlock, Code, FadeIn, Button, H,
  color, space, type, baseStyle, gradientText,
  useIsNarrow,
} from "./components/brand"

// ─── Real mission record, pulled from this repo's actual run history ─────────
// Source of truth: ~/.astrophage/runs/*.json + run-memory.json on 2026-04-19.
// When citing work, we cite the work. No hypotheticals on this page.

const MERGED_MISSIONS = [
  {
    pr: 7,
    title: "Reject or warn on http:// spec sources; enforce HTTPS",
    oneLine: "Sealed a supply-chain hole: loading an OpenAPI spec over plain HTTP could inject backdoored client code. Now rejected at parse time.",
    rounds: 2,
  },
  {
    pr: 10,
    title: "Use encoding/json for gRPC body instead of string concatenation",
    oneLine: "The generator was shipping a bespoke JSON serializer that dropped non-string types. Replaced with the standard library. Merged clean.",
    rounds: 1,
  },
  {
    pr: 12,
    title: "Harden generated source + binary permissions to 0600 / 0700",
    oneLine: "Anything Bawarchi writes to disk now follows least-privilege. No world-readable credentials hiding in generated CLIs.",
    rounds: 2,
  },
] as const

const BLOCKED_MISSION = {
  title: "Remove hardcoded --plaintext flag from gRPC template",
  reason:
    "Even with TLS as the new default, the --plaintext escape hatch let callers exfiltrate bearer tokens in cleartext. Rocky refused the fix until the flag itself was removed or guarded at runtime. The coder closed the PR.",
} as const

// ─── Main ─────────────────────────────────────────────────────────────────────

export function LandingPage() {
  const navigate = useNavigate()
  const isNarrow = useIsNarrow()

  return (
    <div style={baseStyle.root}>
      <StarfieldBackground />
      <NavBar />

      {/* ═══ HERO ═══ */}
      <Section pad="loose" width="wide" style={{ paddingTop: "140px", minHeight: "100vh", display: "flex", alignItems: "center" }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: isNarrow ? "1fr" : "1.1fr 1fr",
          alignItems: "center",
          gap: isNarrow ? space.xxl : space.xxxl,
          width: "100%",
        }}>
          {/* Copy */}
          <div>
            <Eyebrow dot style={{ marginBottom: space.lg }}>
              Inspired by Project Hail Mary
            </Eyebrow>

            <H level={1} style={{ marginBottom: space.lg }}>
              Seven agents.<br />
              One star.<br />
              <span style={gradientText}>They ship the code.</span>
            </H>

            <p style={{
              fontSize: type.bodyLg,
              color: color.textDim,
              lineHeight: 1.75,
              maxWidth: "520px",
              marginBottom: space.xl,
            }}>
              Astrophage is an autonomous engineering company. It scans a repo for bugs,
              prioritises features, plans the fix, writes code, tests it, reviews against
              a hardcoded constitution, and opens a merged pull request.
              <br /><br />
              I don't push the button. The crew finds the work.
            </p>

            {/* CTA row */}
            <div style={{ display: "flex", gap: space.sm, flexWrap: "wrap", marginBottom: space.xl }}>
              <Button variant="primary" size="lg" onClick={() => navigate("/app")}>
                OPEN MISSION CONTROL
              </Button>
              <Button variant="ghost" size="lg" onClick={() => navigate("/docs")}>
                READ THE DOCS →
              </Button>
            </div>

            <div style={{
              fontSize: "9px",
              color: color.textFaint,
              letterSpacing: "0.15em",
              display: "flex",
              gap: "clamp(12px, 2vw, 24px)",
              flexWrap: "wrap",
            }}>
              <span>7 SPECIALIZED AGENTS</span>
              <span style={{ color: color.textGhost }}>·</span>
              <span>AUTONOMOUS LOOP</span>
              <span style={{ color: color.textGhost }}>·</span>
              <span>5 MERGED PRS · 1 HARD BLOCK</span>
            </div>
          </div>

          {/* Orbit diagram */}
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
          }}>
            <OrbitDiagram size={520} />
          </div>
        </div>
      </Section>

      {/* ═══ MANIFESTO ═══ */}
      <Section width="base" pad="loose">
        <FadeIn>
          <blockquote style={{
            fontSize: "clamp(22px, 3vw, 38px)",
            fontWeight: 700,
            lineHeight: 1.45,
            color: "rgba(255,255,255,0.9)",
            borderLeft: `3px solid ${color.accent}`,
            paddingLeft: "clamp(20px, 3vw, 32px)",
            margin: 0,
            letterSpacing: "-0.005em",
          }}>
            "Astrophage is a microbe that eats starlight.<br />
            <span style={{ color: color.textMute }}>
              I named an AI engineering team after it.
            </span>"
          </blockquote>
          <div style={{ marginTop: space.md, paddingLeft: "clamp(23px, 3vw, 35px)", fontSize: "10px", color: color.textFaint, letterSpacing: "0.18em" }}>
            — AFTER ANDY WEIR
          </div>
        </FadeIn>

        <FadeIn delay={160} style={{ marginTop: space.xxl }}>
          <p style={{
            fontSize: type.bodyLg,
            color: color.textMute,
            lineHeight: 1.9,
            maxWidth: "680px",
          }}>
            In <em>Project Hail Mary</em>, a crew of one drags humanity back from the brink because
            the right people at the right stations decide not to fail. Astrophage is that, for
            a codebase. Seven roles, each with a character, a ship, and one job. The loop is
            closed: the crew finds the bug, fixes the bug, tests the bug, argues about the bug,
            and ships the PR. No human submits tasks. I show up, check the mission log, and read
            what got merged.
          </p>
        </FadeIn>
      </Section>

      {/* ═══ THE CREW ═══ */}
      <Section id="crew" width="wide" pad="loose" divider>
        <FadeIn>
          <Eyebrow style={{ marginBottom: space.lg }}>The Crew · 7 Stations</Eyebrow>
          <H level={2} style={{ marginBottom: space.xl, maxWidth: "720px" }}>
            Every station has a name, a face, and a single responsibility.
          </H>
        </FadeIn>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: space.md,
        }}>
          {AGENTS.map((a, i) => (
            <FadeIn key={a.name} delay={i * 50}>
              <Card accent={a.color} hoverLift style={{ height: "100%", display: "flex", flexDirection: "column", gap: space.sm }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: space.sm }}>
                  <div style={{
                    fontSize: "11px",
                    fontWeight: 800,
                    color: a.color,
                    letterSpacing: "0.18em",
                  }}>
                    {a.role}
                  </div>
                  <div style={{ fontSize: "9px", color: color.textFaint, letterSpacing: "0.1em" }}>
                    {a.ship.toUpperCase()}
                  </div>
                </div>
                <div style={{ fontSize: "18px", fontWeight: 800, color: "white", letterSpacing: "-0.005em" }}>
                  {a.character}
                </div>
                <div style={{ fontSize: "12.5px", color: color.textDim, lineHeight: 1.7 }}>
                  {a.description}
                </div>
              </Card>
            </FadeIn>
          ))}
        </div>

        <FadeIn delay={320} style={{ marginTop: space.lg }}>
          <div style={{ fontSize: "11px", color: color.textFaint, lineHeight: 1.7, maxWidth: "780px" }}>
            <em>Note:</em> Yao writes Go tests today — the first target codebase is Go, so the
            tester is language-specific on purpose. Generalising beyond Go is a planned mission,
            not a current capability.
          </div>
        </FadeIn>
      </Section>

      {/* ═══ HOW A TASK FLOWS ═══ */}
      <Section id="pipeline" width="base" pad="loose" divider>
        <FadeIn>
          <Eyebrow style={{ marginBottom: space.lg }}>The Pipeline · Mission Profile</Eyebrow>
          <H level={2} style={{ marginBottom: space.lg, maxWidth: "720px" }}>
            What happens when DuBois spots a bug at 2am.
          </H>
          <p style={{
            fontSize: type.bodyLg,
            color: color.textMute,
            lineHeight: 1.8,
            maxWidth: "640px",
            marginBottom: space.xxl,
          }}>
            The loop dispatches one task at a time. Bug tasks jump ahead of feature work.
            Rounds continue until tests pass <em>and</em> Rocky approves — or a non-negotiable rule breaks,
            or we hit the max rounds Stratt set when planning.
          </p>
        </FadeIn>

        <div>
          {[
            { agent: AGENTS.find((x) => x.name === "scout")!,     step: "01", action: "Finds work. Scans open GitHub issues and greps the codebase for hardcoded secrets, insecure defaults, silent auth failures." },
            { agent: AGENTS.find((x) => x.name === "product")!,   step: "02", action: "Writes the roadmap. Builds a prioritised backlog from feedback + issues, publishes it as ROADMAP.md, queues features and spike tasks." },
            { agent: AGENTS.find((x) => x.name === "pm")!,        step: "03", action: "Plans the fix. Decomposes the task, sets maxRounds (2–5 based on complexity), injects focus areas + risk flags. Consults cross-run memory." },
            { agent: AGENTS.find((x) => x.name === "architect")!, step: "04", action: "Designs the contract. Produces file-level interfaces and test hints before the coder touches a key." },
            { agent: AGENTS.find((x) => x.name === "coder")!,     step: "05", action: "Writes it. Implements against the architect's contract, opens the PR via gh CLI, iterates on review feedback with force-push-with-lease." },
            { agent: AGENTS.find((x) => x.name === "tester")!,    step: "06", action: "Proves it. Writes a _test.go file, runs go test ./..., reports pass or fail with the actual output." },
            { agent: AGENTS.find((x) => x.name === "reviewer")!,  step: "07", action: "Ships it. Reviews against the constitution. Accept → merge. Negotiable reject → coder iterates. Non-negotiable → kill the PR, no appeals." },
          ].map(({ agent, step, action }, i) => (
            <FadeIn key={agent.name} delay={i * 50}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: isNarrow ? "32px 3px 1fr" : "36px 3px 180px 1fr",
                  columnGap: space.md,
                  rowGap: space.xs,
                  alignItems: "start",
                  padding: `${space.md} 0`,
                  borderBottom: `1px solid ${color.hairline}`,
                }}
              >
                <div style={{ fontSize: "9px", color: color.textGhost, letterSpacing: "0.1em", paddingTop: "3px" }}>
                  {step}
                </div>
                <div style={{
                  width: "3px",
                  height: isNarrow ? "100%" : "48px",
                  background: agent.color,
                  borderRadius: "2px",
                  boxShadow: `0 0 12px ${agent.color}77`,
                }} />
                {!isNarrow && (
                  <div>
                    <div style={{ fontSize: "11px", fontWeight: 800, color: agent.color, letterSpacing: "0.12em" }}>
                      {agent.role}
                    </div>
                    <div style={{ fontSize: "10px", color: color.textFaint, marginTop: "3px", letterSpacing: "0.04em" }}>
                      {agent.character} · {agent.ship}
                    </div>
                  </div>
                )}
                <div style={{ fontSize: "13.5px", color: color.textDim, lineHeight: 1.65 }}>
                  {isNarrow && (
                    <div style={{ fontSize: "10.5px", fontWeight: 800, color: agent.color, letterSpacing: "0.12em", marginBottom: "4px" }}>
                      {agent.role} · {agent.character}
                    </div>
                  )}
                  {action}
                </div>
              </div>
            </FadeIn>
          ))}
        </div>

        <FadeIn delay={400}>
          <div style={{
            marginTop: space.lg,
            padding: "16px 22px",
            background: "rgba(0,255,135,0.04)",
            border: `1px solid ${color.accent}22`,
            borderRadius: "8px",
            fontSize: "12px",
            color: color.textMute,
            lineHeight: 1.8,
          }}>
            <span style={{ color: color.accent, fontWeight: 700 }}>Autonomous.</span>{" "}
            Steps 01 – 02 run on a clock (Scout every 5 minutes, Product every 15).
            Steps 05 – 07 loop until convergence. No human approves anything.
          </div>
        </FadeIn>
      </Section>

      {/* ═══ ROCKY'S CONSTITUTION ═══ */}
      <Section id="constitution" width="base" pad="loose" divider>
        <FadeIn>
          <Eyebrow dot dotColor={color.warn} style={{ marginBottom: space.lg }}>
            The Constitution · Rocky's Rules
          </Eyebrow>
          <H level={2} style={{ marginBottom: space.lg, maxWidth: "760px" }}>
            Rocky has rules, not opinions.
          </H>
          <p style={{ fontSize: type.bodyLg, color: color.textMute, lineHeight: 1.8, maxWidth: "640px", marginBottom: space.xl }}>
            The reviewer operates against a constitution compiled into the source code.
            Five rules are non-negotiable — one violation ends the PR. Five are negotiable —
            the coder gets another round to push back.
          </p>
        </FadeIn>

        <div style={{
          display: "grid",
          gridTemplateColumns: isNarrow ? "1fr" : "1fr 1fr",
          gap: "2px",
          borderRadius: "12px",
          overflow: "hidden",
          border: `1px solid ${color.hairline}`,
        }}>
          <FadeIn>
            <div style={{
              background: "rgba(239,68,68,0.06)",
              padding: "clamp(24px, 3vw, 40px)",
              height: "100%",
            }}>
              <Pill tone="danger">Non-Negotiable · Instant Block</Pill>
              <div style={{ fontSize: "11px", color: color.textFaint, letterSpacing: "0.06em", marginTop: space.sm, marginBottom: space.lg, lineHeight: 1.7 }}>
                Rocky kills the PR. No rounds. No appeal.
              </div>
              {[
                "No hardcoded secrets, API keys, or client_ids in source code",
                "No credentials or tokens passed via URL query parameters",
                "Authentication must never silently succeed — missing env var = hard exit",
                "No plaintext HTTP for token exchange or credential submission",
                "Token refresh logic must be present for OAuth flows",
              ].map((r) => (
                <div key={r} style={{ display: "flex", gap: "12px", marginBottom: "14px", fontSize: "12.5px", color: color.textDim, lineHeight: 1.6 }}>
                  <span style={{ color: color.danger, flexShrink: 0, marginTop: "1px", fontWeight: 700 }}>✕</span>
                  {r}
                </div>
              ))}
            </div>
          </FadeIn>

          <FadeIn delay={120}>
            <div style={{
              background: "rgba(251,191,36,0.045)",
              padding: "clamp(24px, 3vw, 40px)",
              height: "100%",
            }}>
              <Pill tone="warn">Negotiable · Push Back</Pill>
              <div style={{ fontSize: "11px", color: color.textFaint, letterSpacing: "0.06em", marginTop: space.sm, marginBottom: space.lg, lineHeight: 1.7 }}>
                Reviewer flags it. Coder iterates. Consensus or max rounds.
              </div>
              {[
                "Environment variable naming convention",
                "Error message wording and verbosity",
                "Fallback behavior when optional config is missing",
                "Code style and formatting preferences",
                "Log level choices",
              ].map((r) => (
                <div key={r} style={{ display: "flex", gap: "12px", marginBottom: "14px", fontSize: "12.5px", color: color.textDim, lineHeight: 1.6 }}>
                  <span style={{ color: color.warn, flexShrink: 0, marginTop: "1px", fontWeight: 700 }}>~</span>
                  {r}
                </div>
              ))}
            </div>
          </FadeIn>
        </div>

        <FadeIn delay={280} style={{ marginTop: space.md }}>
          <div style={{ fontSize: "11px", color: color.textFaint, lineHeight: 1.7 }}>
            Source: <Code>src/constitution.ts</Code> — the reviewer prompt is generated from this list at boot.
          </div>
        </FadeIn>
      </Section>

      {/* ═══ SELECTED MISSIONS ═══ */}
      <Section id="missions" width="base" pad="loose" divider>
        <FadeIn>
          <Eyebrow style={{ marginBottom: space.lg }}>Selected Missions · Flight Record</Eyebrow>
          <H level={2} style={{ marginBottom: space.lg, maxWidth: "740px" }}>
            Three merges Rocky approved. One PR Rocky killed.
          </H>
          <p style={{ fontSize: type.bodyLg, color: color.textMute, lineHeight: 1.8, maxWidth: "640px", marginBottom: space.xl }}>
            These are real runs against{" "}
            <a href="https://github.com/chinmayrelkar/bawarchi" target="_blank" rel="noreferrer" style={{ color: color.accent, textDecoration: "none" }}>
              chinmayrelkar/bawarchi
            </a>
            . PR links below go to the actual diffs. The kill shot is from the run-memory store — Rocky's verdict, verbatim.
          </p>
        </FadeIn>

        <div style={{
          display: "grid",
          gridTemplateColumns: isNarrow ? "1fr" : "1fr 1fr 1fr",
          gap: space.md,
          marginBottom: space.lg,
        }}>
          {MERGED_MISSIONS.map((m, i) => (
            <FadeIn key={m.pr} delay={i * 80}>
              <Card accent={color.accent} hoverLift style={{ height: "100%", display: "flex", flexDirection: "column", gap: space.sm }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                  <Pill tone="accent">Merged · {m.rounds} round{m.rounds === 1 ? "" : "s"}</Pill>
                  <a
                    href={`https://github.com/chinmayrelkar/bawarchi/pull/${m.pr}`}
                    target="_blank" rel="noreferrer"
                    style={{ fontSize: "10px", color: color.accent, textDecoration: "none", letterSpacing: "0.08em", fontWeight: 700 }}
                  >
                    PR #{m.pr} ↗
                  </a>
                </div>
                <div style={{ fontSize: "14px", fontWeight: 800, color: "white", lineHeight: 1.35, letterSpacing: "-0.005em" }}>
                  {m.title}
                </div>
                <div style={{ fontSize: "12.5px", color: color.textDim, lineHeight: 1.65 }}>
                  {m.oneLine}
                </div>
              </Card>
            </FadeIn>
          ))}
        </div>

        <FadeIn delay={280}>
          <Card accent={color.danger} style={{ borderStyle: "solid" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", marginBottom: space.sm }}>
              <Pill tone="danger">Non-Negotiable · Round 1 Kill</Pill>
              <span style={{ fontSize: "10px", color: color.textFaint, letterSpacing: "0.08em" }}>
                Rule #4 · Plaintext credential submission
              </span>
            </div>
            <div style={{ fontSize: "14px", fontWeight: 800, color: "white", marginBottom: space.sm, lineHeight: 1.4 }}>
              {BLOCKED_MISSION.title}
            </div>
            <div style={{ fontSize: "12.5px", color: color.textDim, lineHeight: 1.7 }}>
              {BLOCKED_MISSION.reason}
            </div>
          </Card>
        </FadeIn>
      </Section>

      {/* ═══ UNDER THE HOOD ═══ */}
      <Section id="systems" width="base" pad="loose" divider>
        <FadeIn>
          <Eyebrow style={{ marginBottom: space.lg }}>Under the Hood</Eyebrow>
          <H level={2} style={{ marginBottom: space.lg, maxWidth: "740px" }}>
            A small, honest systems stack.
          </H>
        </FadeIn>

        <div style={{
          display: "grid",
          gridTemplateColumns: isNarrow ? "1fr" : "1fr 1fr",
          gap: space.md,
        }}>
          {[
            { label: "Autonomous loop",       body: "Scout fires every 5 min, Product every 15. One pipeline at a time. Bug tasks prepend, features append. All schedules are env-tunable." },
            { label: "Persistence",           body: "Runs, events, task queue, backlog, seen-issues, cross-run memory, eval history — all in ~/.astrophage. Crashes are recoverable; events are written incrementally as NDJSON." },
            { label: "Live telemetry",        body: "SSE stream of every agent token. Per-run page with Events + Trace tabs. Call graph with duration and estimated cost at each span." },
            { label: "Cross-run memory",      body: "Every finished run (merged, unresolved, blocked) writes lessons back. The next PM plan for the same repo reads the last five outcomes before estimating maxRounds." },
            { label: "Evaluation harness",    body: "12 named cases covering reviewer parsing, tester parsing, and pipeline convergence. CI workflow runs them on every push. Regressions block the PR." },
            { label: "Filesystem-only kill",  body: "The public UI and HTTP API cannot pause the loop. Only a local operator can — via npm run pause, which writes ~/.astrophage/loop-state.json. Designed for a public demo." },
          ].map((item, i) => (
            <FadeIn key={item.label} delay={i * 60}>
              <Card hoverLift style={{ height: "100%" }}>
                <div style={{ fontSize: "10px", fontWeight: 800, color: color.accent, letterSpacing: "0.18em", marginBottom: space.sm, textTransform: "uppercase" }}>
                  {item.label}
                </div>
                <div style={{ fontSize: "12.5px", color: color.textDim, lineHeight: 1.75 }}>
                  {item.body}
                </div>
              </Card>
            </FadeIn>
          ))}
        </div>

        <FadeIn delay={380}>
          <div style={{ marginTop: space.xl }}>
            <div style={{ fontSize: "10px", color: color.textFaint, letterSpacing: "0.18em", marginBottom: space.sm, textTransform: "uppercase" }}>
              Stack
            </div>
            <CodeBlock>
{`TypeScript · tsx · Hono                 — orchestrator
OpenCode SDK v2                         — agent sessions
opencode/claude-sonnet-4-6              — model (Sonnet rates: $3/M in, $15/M out)
Vite · React · Canvas 2D                — web UI
gh CLI                                  — git + GitHub ops
GitHub Actions                          — eval regression gate`}
            </CodeBlock>
          </div>
        </FadeIn>
      </Section>

      {/* ═══ FINAL CTA ═══ */}
      <Section pad="loose" width="base" divider>
        <FadeIn>
          <div style={{ textAlign: "center" }}>
            <Eyebrow dot style={{ marginBottom: space.lg }}>
              Ready for Launch
            </Eyebrow>
            <H level={2} style={{ marginBottom: space.lg, fontSize: "clamp(36px, 5vw, 60px)" }}>
              Watch the crew work.
            </H>
            <p style={{ fontSize: type.bodyLg, color: color.textMute, marginBottom: space.xl, lineHeight: 1.8 }}>
              Ships orbit. Lasers fly. Code ships.
            </p>
            <Button variant="primary" size="lg" onClick={() => navigate("/app")} style={{ padding: "20px 52px", fontSize: "13px" }}>
              OPEN MISSION CONTROL →
            </Button>
          </div>
        </FadeIn>
      </Section>

      <Footer />
    </div>
  )
}
