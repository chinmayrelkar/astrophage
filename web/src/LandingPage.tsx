import { useEffect, useRef, useState } from "react"
import { AGENTS } from "./space/agents"
import { StarfieldBackground } from "./space/StarfieldBackground"

interface Props {
  onEnter: () => void
}

const PIPELINE = [
  { role: "PM", name: "Stratt", emoji: "🛸", desc: "Decomposes the task, assigns agents" },
  { role: "Architect", name: "Ilyukhina", emoji: "📐", desc: "Designs interfaces & file contracts" },
  { role: "Coder", name: "Ryland Grace", emoji: "🚀", desc: "Implements the fix" },
  { role: "Tester", name: "Yao", emoji: "🔬", desc: "Writes & runs tests, reports truth" },
  { role: "Reviewer", name: "Rocky", emoji: "🪨", desc: "Reviews against the constitution" },
  { role: "Git", name: "DuBois", emoji: "📦", desc: "Branch → commit → PR → merge" },
]

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
  { layer: "Model", tech: "claude-sonnet-4-6" },
  { layer: "Web UI", tech: "Vite · React · Canvas 2D" },
  { layer: "Git Operations", tech: "gh CLI" },
  { layer: "Target Repo", tech: "chinmayrelkar/bawarchi" },
]

function useVisible(ref: React.RefObject<Element | null>) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true) },
      { threshold: 0.12 },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return visible
}

function FadeIn({ children, delay = 0, style = {} }: { children: React.ReactNode; delay?: number; style?: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null)
  const visible = useVisible(ref)
  return (
    <div
      ref={ref}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(28px)",
        transition: `opacity 0.7s ease ${delay}ms, transform 0.7s ease ${delay}ms`,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

// ─── Animated orbit diagram ────────────────────────────────────────────────────
function OrbitDiagram() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    let animId: number
    let t = 0

    const center = { x: canvas.width / 2, y: canvas.height / 2 }

    function draw() {
      if (!ctx || !canvas) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      t += 0.008

      // Task star glow
      const grd = ctx.createRadialGradient(center.x, center.y, 0, center.x, center.y, 38)
      grd.addColorStop(0, "rgba(255,220,80,0.95)")
      grd.addColorStop(0.4, "rgba(255,160,30,0.5)")
      grd.addColorStop(1, "rgba(255,100,0,0)")
      ctx.beginPath()
      ctx.arc(center.x, center.y, 38, 0, Math.PI * 2)
      ctx.fillStyle = grd
      ctx.fill()

      // Task label
      ctx.fillStyle = "rgba(255,220,80,1)"
      ctx.font = "bold 9px monospace"
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.fillText("TASK", center.x, center.y)

      for (const agent of AGENTS) {
        const angle = agent.orbitPhase + t * agent.orbitSpeed
        const r = agent.orbitRadius * 0.45 // scale down
        const x = center.x + Math.cos(angle) * r
        const y = center.y + Math.sin(angle) * r

        // Orbit ring (faint)
        ctx.beginPath()
        ctx.arc(center.x, center.y, r, 0, Math.PI * 2)
        ctx.strokeStyle = "rgba(255,255,255,0.04)"
        ctx.lineWidth = 1
        ctx.stroke()

        // Ship glow
        const glow = ctx.createRadialGradient(x, y, 0, x, y, 14)
        glow.addColorStop(0, agent.color + "cc")
        glow.addColorStop(1, agent.color + "00")
        ctx.beginPath()
        ctx.arc(x, y, 14, 0, Math.PI * 2)
        ctx.fillStyle = glow
        ctx.fill()

        // Ship dot
        ctx.beginPath()
        ctx.arc(x, y, 5, 0, Math.PI * 2)
        ctx.fillStyle = agent.color
        ctx.fill()

        // Label
        ctx.fillStyle = agent.color
        ctx.font = "bold 7px monospace"
        ctx.textAlign = "center"
        ctx.textBaseline = "top"
        ctx.fillText(agent.name.toUpperCase(), x, y + 8)
      }

      animId = requestAnimationFrame(draw)
    }

    draw()
    return () => cancelAnimationFrame(animId)
  }, [])

  return (
    <canvas
      ref={canvasRef}
      width={440}
      height={440}
      style={{ display: "block", maxWidth: "100%", margin: "0 auto" }}
    />
  )
}

// ─── Laser beam pipeline visualization ────────────────────────────────────────
function PipelineArrow() {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "rgba(255,255,255,0.2)",
      fontSize: "18px",
      margin: "0 4px",
      flexShrink: 0,
    }}>
      ──►
    </div>
  )
}

// ─── Main landing page ────────────────────────────────────────────────────────
export function LandingPage({ onEnter }: Props) {
  const [typed, setTyped] = useState("")
  const tagline = "An agent company — a team of specialized AI that ships code."

  useEffect(() => {
    let i = 0
    const id = setInterval(() => {
      i++
      setTyped(tagline.slice(0, i))
      if (i >= tagline.length) clearInterval(id)
    }, 28)
    return () => clearInterval(id)
  }, [])

  return (
    <div style={{
      minHeight: "100vh",
      background: "#050510",
      color: "#e2e8f0",
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      overflowX: "hidden",
      position: "relative",
    }}>
      <StarfieldBackground />

      {/* ── Nav ── */}
      <nav style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        padding: "14px 32px",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        background: "rgba(5,5,16,0.85)",
        backdropFilter: "blur(12px)",
        gap: "24px",
      }}>
        <span style={{ fontWeight: 800, fontSize: "15px", letterSpacing: "0.22em", color: "white" }}>
          ASTROPHAGE
        </span>
        <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.2)", letterSpacing: "0.12em" }}>
          PROJECT HAIL MARY · AGENT COMPANY
        </span>
        <div style={{ marginLeft: "auto", display: "flex", gap: "16px", alignItems: "center" }}>
          <a
            href="https://github.com/chinmayrelkar/bawarchi"
            target="_blank"
            rel="noreferrer"
            style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)", textDecoration: "none", letterSpacing: "0.08em" }}
          >
            TARGET REPO ↗
          </a>
          <a
            href="https://opencode.ai"
            target="_blank"
            rel="noreferrer"
            style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)", textDecoration: "none", letterSpacing: "0.08em" }}
          >
            OPENCODE ↗
          </a>
          <button
            onClick={onEnter}
            style={{
              background: "rgba(0,255,135,0.12)",
              border: "1px solid rgba(0,255,135,0.4)",
              borderRadius: "4px",
              color: "#00ff87",
              cursor: "pointer",
              fontSize: "10px",
              letterSpacing: "0.1em",
              padding: "5px 14px",
              fontFamily: "inherit",
              transition: "background 0.2s",
            }}
            onMouseOver={e => (e.currentTarget.style.background = "rgba(0,255,135,0.22)")}
            onMouseOut={e => (e.currentTarget.style.background = "rgba(0,255,135,0.12)")}
          >
            LAUNCH UI →
          </button>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={{
        position: "relative",
        zIndex: 1,
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "120px 24px 80px",
        textAlign: "center",
      }}>
        <div style={{
          fontSize: "10px",
          letterSpacing: "0.28em",
          color: "rgba(0,255,135,0.7)",
          marginBottom: "24px",
          fontWeight: 700,
        }}>
          NAMED AFTER THE MICROBE IN PROJECT HAIL MARY
        </div>

        <h1 style={{
          fontSize: "clamp(48px, 8vw, 92px)",
          fontWeight: 900,
          letterSpacing: "0.08em",
          lineHeight: 1,
          color: "white",
          marginBottom: "28px",
          textShadow: "0 0 80px rgba(100,120,255,0.3)",
        }}>
          ASTROPHAGE
        </h1>

        <div style={{
          fontSize: "clamp(13px, 1.6vw, 17px)",
          color: "rgba(255,255,255,0.55)",
          maxWidth: "560px",
          minHeight: "2.4em",
          lineHeight: 1.7,
          marginBottom: "48px",
        }}>
          {typed}
          <span style={{ animation: "blink 1s step-end infinite", color: "#00ff87" }}>|</span>
        </div>

        <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", justifyContent: "center" }}>
          <button
            onClick={onEnter}
            style={{
              background: "linear-gradient(135deg, rgba(0,255,135,0.18), rgba(0,200,255,0.12))",
              border: "1px solid rgba(0,255,135,0.5)",
              borderRadius: "6px",
              color: "#00ff87",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: 700,
              letterSpacing: "0.15em",
              padding: "14px 36px",
              fontFamily: "inherit",
              transition: "all 0.2s",
              boxShadow: "0 0 28px rgba(0,255,135,0.15)",
            }}
            onMouseOver={e => {
              e.currentTarget.style.boxShadow = "0 0 48px rgba(0,255,135,0.35)"
              e.currentTarget.style.background = "linear-gradient(135deg, rgba(0,255,135,0.28), rgba(0,200,255,0.2))"
            }}
            onMouseOut={e => {
              e.currentTarget.style.boxShadow = "0 0 28px rgba(0,255,135,0.15)"
              e.currentTarget.style.background = "linear-gradient(135deg, rgba(0,255,135,0.18), rgba(0,200,255,0.12))"
            }}
          >
            OPEN SPACE UI →
          </button>
          <a
            href="https://en.wikipedia.org/wiki/Project_Hail_Mary"
            target="_blank"
            rel="noreferrer"
            style={{
              background: "none",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: "6px",
              color: "rgba(255,255,255,0.45)",
              fontSize: "12px",
              letterSpacing: "0.12em",
              padding: "14px 28px",
              textDecoration: "none",
              transition: "border-color 0.2s, color 0.2s",
              display: "inline-block",
            }}
            onMouseOver={e => {
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.25)"
              e.currentTarget.style.color = "rgba(255,255,255,0.75)"
            }}
            onMouseOut={e => {
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"
              e.currentTarget.style.color = "rgba(255,255,255,0.45)"
            }}
          >
            READ THE NOVEL ↗
          </a>
        </div>

        {/* Scroll nudge */}
        <div style={{
          position: "absolute",
          bottom: "32px",
          left: "50%",
          transform: "translateX(-50%)",
          fontSize: "9px",
          color: "rgba(255,255,255,0.18)",
          letterSpacing: "0.15em",
          animation: "floatY 2.5s ease-in-out infinite",
        }}>
          ↓ SCROLL
        </div>
      </section>

      {/* ── What it does ── */}
      <section style={{ position: "relative", zIndex: 1, padding: "100px 24px" }}>
        <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
          <FadeIn>
            <div style={{
              fontSize: "9px",
              letterSpacing: "0.25em",
              color: "rgba(255,255,255,0.25)",
              marginBottom: "12px",
              textAlign: "center",
            }}>WHAT IT DOES</div>
            <h2 style={{
              fontSize: "clamp(26px, 4vw, 42px)",
              fontWeight: 800,
              textAlign: "center",
              marginBottom: "16px",
              letterSpacing: "0.06em",
              color: "white",
            }}>
              Bug to Merged PR — Autonomously
            </h2>
            <p style={{
              textAlign: "center",
              color: "rgba(255,255,255,0.4)",
              maxWidth: "560px",
              margin: "0 auto 64px",
              lineHeight: 1.8,
              fontSize: "13px",
            }}>
              Give Astrophage a task. The agent company takes it from description to merged pull request with no human in the loop.
            </p>
          </FadeIn>

          <FadeIn delay={100}>
            <div style={{
              display: "flex",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "8px",
              justifyContent: "center",
              marginBottom: "56px",
            }}>
              {PIPELINE.map((step, i) => (
                <div key={step.role} style={{ display: "flex", alignItems: "center" }}>
                  <div style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "8px",
                    padding: "14px 18px",
                    textAlign: "center",
                    minWidth: "110px",
                  }}>
                    <div style={{ fontSize: "20px", marginBottom: "6px" }}>{step.emoji}</div>
                    <div style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.12em", color: "rgba(255,255,255,0.75)", marginBottom: "4px" }}>{step.role}</div>
                    <div style={{ fontSize: "8px", color: "rgba(255,255,255,0.25)", letterSpacing: "0.05em" }}>{step.name}</div>
                  </div>
                  {i < PIPELINE.length - 1 && <PipelineArrow />}
                </div>
              ))}
            </div>
          </FadeIn>

          <FadeIn delay={200}>
            <div style={{
              background: "rgba(0,0,0,0.35)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: "10px",
              padding: "28px 32px",
              fontFamily: "monospace",
              fontSize: "12px",
              lineHeight: 1.9,
              color: "rgba(255,255,255,0.55)",
              maxWidth: "600px",
              margin: "0 auto",
            }}>
              <div style={{ color: "#a78bfa", marginBottom: "4px" }}>PM (Stratt)</div>
              <div style={{ paddingLeft: "16px" }}>└─► <span style={{ color: "#60a5fa" }}>Architect (Ilyukhina)</span> — designs interfaces</div>
              <div style={{ paddingLeft: "36px" }}>└─► <span style={{ color: "#00ff87" }}>Coder (Ryland Grace)</span> — implements the fix</div>
              <div style={{ paddingLeft: "56px" }}>└─► <span style={{ color: "#f472b6" }}>Tester (Yao)</span> — writes and runs tests</div>
              <div style={{ paddingLeft: "76px" }}>└─► <span style={{ color: "#fbbf24" }}>Reviewer (Rocky)</span> — reviews against constitution</div>
              <div style={{ paddingLeft: "96px" }}>└─► PASS? ──No──► Coder iterates → loop</div>
              <div style={{ paddingLeft: "116px" }}>│</div>
              <div style={{ paddingLeft: "116px" }}>Yes</div>
              <div style={{ paddingLeft: "116px" }}>└─► <span style={{ color: "#34d399" }}>Git (DuBois)</span> — branch → commit → PR → merge</div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── Space UI / Orbit diagram ── */}
      <section style={{ position: "relative", zIndex: 1, padding: "80px 24px" }}>
        <div style={{ maxWidth: "1000px", margin: "0 auto", display: "flex", flexWrap: "wrap", gap: "64px", alignItems: "center", justifyContent: "center" }}>
          <FadeIn style={{ flex: "1 1 320px", minWidth: "280px" }}>
            <div style={{ fontSize: "9px", letterSpacing: "0.25em", color: "rgba(0,200,255,0.6)", marginBottom: "12px" }}>SPACE UI</div>
            <h2 style={{ fontSize: "clamp(22px, 3vw, 34px)", fontWeight: 800, letterSpacing: "0.06em", color: "white", marginBottom: "20px" }}>
              Live 2D Space Canvas
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px", color: "rgba(255,255,255,0.45)", fontSize: "12px", lineHeight: 1.8 }}>
              {[
                ["Task Star", "The current task glows at the center"],
                ["Ships", "Each agent orbits at its own radius and speed, glowing when active"],
                ["Laser Beams", "Animated beams between ships when agents communicate, colour-coded by type"],
                ["Mission Log", "Right panel — full chronological comms log; click any ship to filter"],
                ["Task History", "Bottom strip showing all past runs with status, time, and round count"],
              ].map(([title, desc]) => (
                <div key={title} style={{ display: "flex", gap: "12px" }}>
                  <div style={{ color: "#60a5fa", flexShrink: 0, marginTop: "2px" }}>▸</div>
                  <div>
                    <span style={{ color: "rgba(255,255,255,0.8)", fontWeight: 700 }}>{title}</span>
                    {" — "}
                    {desc}
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={onEnter}
              style={{
                marginTop: "32px",
                background: "rgba(96,165,250,0.12)",
                border: "1px solid rgba(96,165,250,0.35)",
                borderRadius: "5px",
                color: "#60a5fa",
                cursor: "pointer",
                fontSize: "10px",
                fontWeight: 700,
                letterSpacing: "0.12em",
                padding: "10px 24px",
                fontFamily: "inherit",
                transition: "background 0.2s",
              }}
              onMouseOver={e => (e.currentTarget.style.background = "rgba(96,165,250,0.22)")}
              onMouseOut={e => (e.currentTarget.style.background = "rgba(96,165,250,0.12)")}
            >
              OPEN UI →
            </button>
          </FadeIn>

          <FadeIn delay={150} style={{ flex: "0 0 440px", minWidth: "280px" }}>
            <OrbitDiagram />
          </FadeIn>
        </div>
      </section>

      {/* ── Agents ── */}
      <section style={{ position: "relative", zIndex: 1, padding: "100px 24px" }}>
        <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
          <FadeIn>
            <div style={{ fontSize: "9px", letterSpacing: "0.25em", color: "rgba(255,255,255,0.25)", marginBottom: "12px", textAlign: "center" }}>THE CREW</div>
            <h2 style={{ fontSize: "clamp(24px, 3.5vw, 38px)", fontWeight: 800, textAlign: "center", letterSpacing: "0.06em", color: "white", marginBottom: "48px" }}>
              Characters from Project Hail Mary
            </h2>
          </FadeIn>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px" }}>
            {AGENTS.map((agent, i) => (
              <FadeIn key={agent.name} delay={i * 60}>
                <div style={{
                  background: "rgba(255,255,255,0.02)",
                  border: `1px solid ${agent.color}28`,
                  borderRadius: "10px",
                  padding: "24px",
                  transition: "border-color 0.2s, background 0.2s",
                  cursor: "default",
                }}
                  onMouseOver={e => {
                    (e.currentTarget as HTMLDivElement).style.borderColor = agent.color + "55"
                    ;(e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.04)"
                  }}
                  onMouseOut={e => {
                    (e.currentTarget as HTMLDivElement).style.borderColor = agent.color + "28"
                    ;(e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.02)"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px" }}>
                    <div style={{
                      width: "36px", height: "36px", borderRadius: "50%",
                      background: agent.color + "22",
                      border: `1px solid ${agent.color}55`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "18px",
                      flexShrink: 0,
                    }}>
                      {agent.emoji}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "11px", color: agent.color, letterSpacing: "0.1em" }}>
                        {agent.name.toUpperCase()}
                      </div>
                      <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", marginTop: "2px" }}>
                        {agent.character} · {agent.ship}
                      </div>
                    </div>
                  </div>
                  <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.45)", lineHeight: 1.7 }}>
                    {agent.description}
                  </p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── Constitution ── */}
      <section style={{ position: "relative", zIndex: 1, padding: "100px 24px" }}>
        <div style={{ maxWidth: "840px", margin: "0 auto" }}>
          <FadeIn>
            <div style={{ fontSize: "9px", letterSpacing: "0.25em", color: "rgba(251,191,36,0.7)", marginBottom: "12px", textAlign: "center" }}>ROCKY'S LAWS</div>
            <h2 style={{ fontSize: "clamp(24px, 3.5vw, 38px)", fontWeight: 800, textAlign: "center", letterSpacing: "0.06em", color: "white", marginBottom: "14px" }}>
              The Reviewer Constitution
            </h2>
            <p style={{ textAlign: "center", color: "rgba(255,255,255,0.35)", maxWidth: "500px", margin: "0 auto 56px", lineHeight: 1.8, fontSize: "12px" }}>
              Rocky has rules, not opinions. Two tiers: instant blocks and negotiable pushback.
            </p>
          </FadeIn>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "24px" }}>
            <FadeIn delay={80}>
              <div style={{
                background: "rgba(239,68,68,0.04)",
                border: "1px solid rgba(239,68,68,0.2)",
                borderRadius: "10px",
                padding: "28px",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
                  <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#ef4444", boxShadow: "0 0 10px #ef4444" }} />
                  <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.15em", color: "#ef4444" }}>NON-NEGOTIABLE</div>
                </div>
                <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", marginBottom: "16px", letterSpacing: "0.05em" }}>
                  INSTANT BLOCK — NO FURTHER ROUNDS
                </div>
                <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "12px" }}>
                  {CONSTITUTION_NON_NEG.map(rule => (
                    <li key={rule} style={{ display: "flex", gap: "10px", fontSize: "11px", color: "rgba(255,255,255,0.5)", lineHeight: 1.6 }}>
                      <span style={{ color: "#ef4444", flexShrink: 0 }}>✕</span>
                      {rule}
                    </li>
                  ))}
                </ul>
              </div>
            </FadeIn>

            <FadeIn delay={160}>
              <div style={{
                background: "rgba(251,191,36,0.04)",
                border: "1px solid rgba(251,191,36,0.2)",
                borderRadius: "10px",
                padding: "28px",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
                  <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#fbbf24", boxShadow: "0 0 10px #fbbf24" }} />
                  <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.15em", color: "#fbbf24" }}>NEGOTIABLE</div>
                </div>
                <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", marginBottom: "16px", letterSpacing: "0.05em" }}>
                  PUSHBACK — CODER CAN ITERATE
                </div>
                <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "12px" }}>
                  {CONSTITUTION_NEG.map(rule => (
                    <li key={rule} style={{ display: "flex", gap: "10px", fontSize: "11px", color: "rgba(255,255,255,0.5)", lineHeight: 1.6 }}>
                      <span style={{ color: "#fbbf24", flexShrink: 0 }}>~</span>
                      {rule}
                    </li>
                  ))}
                </ul>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ── Demo ── */}
      <section style={{ position: "relative", zIndex: 1, padding: "100px 24px" }}>
        <div style={{ maxWidth: "840px", margin: "0 auto" }}>
          <FadeIn>
            <div style={{ fontSize: "9px", letterSpacing: "0.25em", color: "rgba(255,255,255,0.25)", marginBottom: "12px", textAlign: "center" }}>DEMO</div>
            <h2 style={{ fontSize: "clamp(24px, 3.5vw, 38px)", fontWeight: 800, textAlign: "center", letterSpacing: "0.06em", color: "white", marginBottom: "14px" }}>
              Bawarchi Auth Bugs
            </h2>
            <p style={{ textAlign: "center", color: "rgba(255,255,255,0.35)", maxWidth: "520px", margin: "0 auto 56px", lineHeight: 1.8, fontSize: "12px" }}>
              Two seeded auth bugs in{" "}
              <a href="https://github.com/chinmayrelkar/bawarchi" target="_blank" rel="noreferrer" style={{ color: "#60a5fa", textDecoration: "none" }}>Bawarchi</a>
              {" "}— a Go CLI generator. Same constitution, same company. Two tasks, two outcomes.
            </p>
          </FadeIn>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "24px" }}>
            {[
              {
                file: "demo/bawarchi/oauth-task.ts",
                title: "OAuth Task",
                color: "#a78bfa",
                bug: "gRPC CLI silently skips auth when env var is unset",
                constitution: "Non-negotiable — auth must never silently succeed",
                outcome: "3-round negotiation. Coder concedes on error message wording. Reviewer accepts.",
                badge: "RESOLVED",
                badgeColor: "#00ff87",
              },
              {
                file: "demo/bawarchi/apikey-task.ts",
                title: "API Key Task",
                color: "#f472b6",
                bug: "API key appended as URL query parameter",
                constitution: "Non-negotiable — credentials must never appear in URLs",
                outcome: "Reviewer kills it in round 1. No negotiation.",
                badge: "INSTANT BLOCK",
                badgeColor: "#ef4444",
              },
            ].map((demo, i) => (
              <FadeIn key={demo.title} delay={i * 100}>
                <div style={{
                  background: "rgba(255,255,255,0.02)",
                  border: `1px solid ${demo.color}28`,
                  borderRadius: "10px",
                  padding: "28px",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
                    <div style={{ fontSize: "12px", fontWeight: 700, color: demo.color, letterSpacing: "0.08em" }}>{demo.title}</div>
                    <div style={{
                      fontSize: "8px",
                      fontWeight: 700,
                      letterSpacing: "0.1em",
                      color: demo.badgeColor,
                      border: `1px solid ${demo.badgeColor}55`,
                      borderRadius: "3px",
                      padding: "2px 7px",
                    }}>
                      {demo.badge}
                    </div>
                  </div>

                  <div style={{ fontSize: "8px", color: "rgba(255,255,255,0.2)", letterSpacing: "0.1em", marginBottom: "6px" }}>BUG</div>
                  <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.55)", lineHeight: 1.6, marginBottom: "16px" }}>{demo.bug}</p>

                  <div style={{ fontSize: "8px", color: "rgba(255,255,255,0.2)", letterSpacing: "0.1em", marginBottom: "6px" }}>CONSTITUTION</div>
                  <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.55)", lineHeight: 1.6, marginBottom: "16px" }}>{demo.constitution}</p>

                  <div style={{ fontSize: "8px", color: "rgba(255,255,255,0.2)", letterSpacing: "0.1em", marginBottom: "6px" }}>OUTCOME</div>
                  <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.55)", lineHeight: 1.6, marginBottom: "20px" }}>{demo.outcome}</p>

                  <div style={{
                    background: "rgba(0,0,0,0.3)",
                    borderRadius: "4px",
                    padding: "8px 12px",
                    fontSize: "9px",
                    color: "rgba(255,255,255,0.25)",
                    fontFamily: "monospace",
                  }}>
                    {demo.file}
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── Tech Stack ── */}
      <section style={{ position: "relative", zIndex: 1, padding: "100px 24px" }}>
        <div style={{ maxWidth: "700px", margin: "0 auto" }}>
          <FadeIn>
            <div style={{ fontSize: "9px", letterSpacing: "0.25em", color: "rgba(255,255,255,0.25)", marginBottom: "12px", textAlign: "center" }}>UNDER THE HOOD</div>
            <h2 style={{ fontSize: "clamp(24px, 3.5vw, 38px)", fontWeight: 800, textAlign: "center", letterSpacing: "0.06em", color: "white", marginBottom: "48px" }}>
              Tech Stack
            </h2>
          </FadeIn>

          <FadeIn delay={80}>
            <div style={{
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: "10px",
              overflow: "hidden",
            }}>
              {TECH_STACK.map((row, i) => (
                <div key={row.layer} style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "16px 24px",
                  borderBottom: i < TECH_STACK.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                }}>
                  <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em" }}>{row.layer.toUpperCase()}</div>
                  <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.6)", fontWeight: 600 }}>{row.tech}</div>
                </div>
              ))}
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── CTA Footer ── */}
      <section style={{ position: "relative", zIndex: 1, padding: "120px 24px", textAlign: "center" }}>
        <FadeIn>
          <div style={{ fontSize: "9px", letterSpacing: "0.25em", color: "rgba(0,255,135,0.5)", marginBottom: "16px" }}>READY FOR LAUNCH</div>
          <h2 style={{ fontSize: "clamp(28px, 5vw, 56px)", fontWeight: 900, letterSpacing: "0.08em", color: "white", marginBottom: "20px" }}>
            Watch the Company Work
          </h2>
          <p style={{ color: "rgba(255,255,255,0.35)", maxWidth: "420px", margin: "0 auto 40px", lineHeight: 1.8, fontSize: "13px" }}>
            Open the live space UI — ships orbit, lasers fly, agents converge.
          </p>
          <button
            onClick={onEnter}
            style={{
              background: "linear-gradient(135deg, rgba(0,255,135,0.2), rgba(0,200,255,0.14))",
              border: "1px solid rgba(0,255,135,0.5)",
              borderRadius: "8px",
              color: "#00ff87",
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: 800,
              letterSpacing: "0.18em",
              padding: "18px 48px",
              fontFamily: "inherit",
              boxShadow: "0 0 40px rgba(0,255,135,0.2)",
              transition: "all 0.2s",
            }}
            onMouseOver={e => {
              e.currentTarget.style.boxShadow = "0 0 70px rgba(0,255,135,0.4)"
              e.currentTarget.style.background = "linear-gradient(135deg, rgba(0,255,135,0.32), rgba(0,200,255,0.22))"
            }}
            onMouseOut={e => {
              e.currentTarget.style.boxShadow = "0 0 40px rgba(0,255,135,0.2)"
              e.currentTarget.style.background = "linear-gradient(135deg, rgba(0,255,135,0.2), rgba(0,200,255,0.14))"
            }}
          >
            OPEN SPACE UI →
          </button>
        </FadeIn>
      </section>

      {/* Footer */}
      <footer style={{
        position: "relative",
        zIndex: 1,
        borderTop: "1px solid rgba(255,255,255,0.05)",
        padding: "28px 32px",
        display: "flex",
        flexWrap: "wrap",
        gap: "16px",
        alignItems: "center",
        justifyContent: "space-between",
        fontSize: "9px",
        color: "rgba(255,255,255,0.18)",
        letterSpacing: "0.08em",
      }}>
        <div>ASTROPHAGE · PROJECT HAIL MARY · AGENT COMPANY</div>
        <div style={{ display: "flex", gap: "20px" }}>
          <a href="https://opencode.ai" target="_blank" rel="noreferrer" style={{ color: "rgba(255,255,255,0.18)", textDecoration: "none" }}>OPENCODE</a>
          <a href="https://github.com/chinmayrelkar/bawarchi" target="_blank" rel="noreferrer" style={{ color: "rgba(255,255,255,0.18)", textDecoration: "none" }}>BAWARCHI</a>
          <a href="https://en.wikipedia.org/wiki/Project_Hail_Mary" target="_blank" rel="noreferrer" style={{ color: "rgba(255,255,255,0.18)", textDecoration: "none" }}>THE NOVEL</a>
        </div>
      </footer>
    </div>
  )
}
