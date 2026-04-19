import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { AGENTS } from "./space/agents"
import { StarfieldBackground } from "./space/StarfieldBackground"

// ─── Animated orbit diagram ───────────────────────────────────────────────────
function OrbitDiagram() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    let animId: number
    let t = 0
    const W = canvas.width
    const H = canvas.height
    const cx = W / 2
    const cy = H / 2

    function draw() {
      if (!ctx) return
      ctx.clearRect(0, 0, W, H)
      t += 0.008

      // subtle nebula behind center
      const nebula = ctx.createRadialGradient(cx, cy, 0, cx, cy, 160)
      nebula.addColorStop(0, "rgba(80,40,200,0.12)")
      nebula.addColorStop(0.5, "rgba(30,10,80,0.06)")
      nebula.addColorStop(1, "rgba(0,0,0,0)")
      ctx.beginPath()
      ctx.arc(cx, cy, 160, 0, Math.PI * 2)
      ctx.fillStyle = nebula
      ctx.fill()

      // orbit rings
      for (const agent of AGENTS) {
        const r = agent.orbitRadius * 0.46
        ctx.beginPath()
        ctx.arc(cx, cy, r, 0, Math.PI * 2)
        ctx.strokeStyle = "rgba(255,255,255,0.05)"
        ctx.lineWidth = 1
        ctx.setLineDash([2, 6])
        ctx.stroke()
        ctx.setLineDash([])
      }

      // task star
      const pulse = 1 + Math.sin(t * 2) * 0.08
      const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, 32 * pulse)
      grd.addColorStop(0, "rgba(255,230,80,1)")
      grd.addColorStop(0.35, "rgba(255,150,20,0.6)")
      grd.addColorStop(1, "rgba(255,80,0,0)")
      ctx.beginPath()
      ctx.arc(cx, cy, 32 * pulse, 0, Math.PI * 2)
      ctx.fillStyle = grd
      ctx.fill()

      ctx.fillStyle = "rgba(255,230,80,0.9)"
      ctx.font = "bold 8px monospace"
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.fillText("TASK", cx, cy)

      // laser beams between adjacent active ships (subtle)
      const positions: { x: number; y: number; color: string }[] = []
      for (const agent of AGENTS) {
        const angle = agent.orbitPhase + t * agent.orbitSpeed
        const r = agent.orbitRadius * 0.46
        positions.push({
          x: cx + Math.cos(angle) * r,
          y: cy + Math.sin(angle) * r,
          color: agent.color,
        })
      }

      // draw one animated laser from ship[0] to ship[1] cycling
      const beamIdx = Math.floor((t * 0.4) % AGENTS.length)
      const next = (beamIdx + 1) % AGENTS.length
      const a = positions[beamIdx]
      const b = positions[next]
      const beamAlpha = 0.18 + Math.sin(t * 6) * 0.08
      const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y)
      grad.addColorStop(0, a.color + "00")
      grad.addColorStop(0.5, a.color + Math.round(beamAlpha * 255).toString(16).padStart(2, "0"))
      grad.addColorStop(1, b.color + "00")
      ctx.beginPath()
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)
      ctx.strokeStyle = grad
      ctx.lineWidth = 1.5
      ctx.stroke()

      // ships
      for (let i = 0; i < AGENTS.length; i++) {
        const agent = AGENTS[i]
        const { x, y } = positions[i]

        // glow
        const glow = ctx.createRadialGradient(x, y, 0, x, y, 18)
        glow.addColorStop(0, agent.color + "55")
        glow.addColorStop(1, agent.color + "00")
        ctx.beginPath()
        ctx.arc(x, y, 18, 0, Math.PI * 2)
        ctx.fillStyle = glow
        ctx.fill()

        // dot
        ctx.beginPath()
        ctx.arc(x, y, 4.5, 0, Math.PI * 2)
        ctx.fillStyle = agent.color
        ctx.fill()

        // label
        ctx.fillStyle = agent.color + "cc"
        ctx.font = "bold 7px monospace"
        ctx.textAlign = "center"
        ctx.textBaseline = "top"
        ctx.fillText(agent.name.toUpperCase(), x, y + 7)
      }

      animId = requestAnimationFrame(draw)
    }

    draw()
    return () => cancelAnimationFrame(animId)
  }, [])

  return (
    <canvas
      ref={canvasRef}
      width={480}
      height={480}
      style={{ display: "block", width: "100%", maxWidth: "480px" }}
    />
  )
}

// ─── Typewriter that loops through lines ──────────────────────────────────────
function Typewriter({ lines }: { lines: string[] }) {
  const [display, setDisplay] = useState("")
  const [lineIdx, setLineIdx] = useState(0)
  const [charIdx, setCharIdx] = useState(0)
  const [deleting, setDeleting] = useState(false)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (paused) {
      const t = setTimeout(() => { setPaused(false); setDeleting(true) }, 2200)
      return () => clearTimeout(t)
    }
    const speed = deleting ? 18 : 38
    const t = setTimeout(() => {
      const line = lines[lineIdx]
      if (!deleting) {
        if (charIdx < line.length) {
          setDisplay(line.slice(0, charIdx + 1))
          setCharIdx(c => c + 1)
        } else {
          setPaused(true)
        }
      } else {
        if (charIdx > 0) {
          setDisplay(line.slice(0, charIdx - 1))
          setCharIdx(c => c - 1)
        } else {
          setDeleting(false)
          setLineIdx(i => (i + 1) % lines.length)
        }
      }
    }, speed)
    return () => clearTimeout(t)
  }, [charIdx, deleting, paused, lineIdx, lines])

  return (
    <span>
      {display}
      <span style={{ color: "#00ff87", animation: "blink 1s step-end infinite" }}>|</span>
    </span>
  )
}

// ─── Section fade-in on scroll ────────────────────────────────────────────────
function FadeIn({ children, delay = 0, style = {} }: {
  children: React.ReactNode
  delay?: number
  style?: React.CSSProperties
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setVisible(true) },
      { threshold: 0.1 },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "none" : "translateY(32px)",
        transition: `opacity 0.8s ease ${delay}ms, transform 0.8s ease ${delay}ms`,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export function LandingPage() {
  const navigate = useNavigate()

  const headlines = [
    "We replaced the engineering team.",
    "Bug to merged PR. Zero humans.",
    "6 AI agents. 1 task. Ship it.",
  ]

  return (
    <div style={{
      minHeight: "100vh",
      background: "#04040f",
      color: "#e2e8f0",
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      overflowX: "hidden",
    }}>
      <StarfieldBackground />

      {/* ── NAV ── */}
      <nav style={{
        position: "fixed",
        inset: "0 0 auto 0",
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        padding: "12px 28px",
        background: "rgba(4,4,15,0.7)",
        backdropFilter: "blur(16px)",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
      }}>
        <span style={{ fontWeight: 900, fontSize: "13px", letterSpacing: "0.25em", color: "white" }}>
          ASTROPHAGE
        </span>
        <div style={{ marginLeft: "auto", display: "flex", gap: "20px", alignItems: "center" }}>
          <button
            onClick={() => navigate("/docs")}
            style={{
              background: "none", border: "none", cursor: "pointer",
              fontSize: "10px", color: "rgba(255,255,255,0.35)",
              letterSpacing: "0.1em", fontFamily: "inherit",
              transition: "color 0.2s",
            }}
            onMouseOver={e => (e.currentTarget.style.color = "rgba(255,255,255,0.75)")}
            onMouseOut={e => (e.currentTarget.style.color = "rgba(255,255,255,0.35)")}
          >
            DOCS
          </button>
          <a
            href="https://github.com/chinmayrelkar/astrophage"
            target="_blank" rel="noreferrer"
            style={{ fontSize: "10px", color: "rgba(255,255,255,0.35)", textDecoration: "none", letterSpacing: "0.1em", transition: "color 0.2s" }}
            onMouseOver={e => (e.currentTarget.style.color = "rgba(255,255,255,0.75)")}
            onMouseOut={e => (e.currentTarget.style.color = "rgba(255,255,255,0.35)")}
          >
            GITHUB ↗
          </a>
          <button
            onClick={() => navigate("/app")}
            style={{
              background: "rgba(0,255,135,0.1)",
              border: "1px solid rgba(0,255,135,0.35)",
              borderRadius: "4px",
              color: "#00ff87",
              cursor: "pointer",
              fontSize: "10px",
              letterSpacing: "0.1em",
              padding: "5px 14px",
              fontFamily: "inherit",
              transition: "all 0.2s",
            }}
            onMouseOver={e => {
              e.currentTarget.style.background = "rgba(0,255,135,0.2)"
              e.currentTarget.style.boxShadow = "0 0 20px rgba(0,255,135,0.2)"
            }}
            onMouseOut={e => {
              e.currentTarget.style.background = "rgba(0,255,135,0.1)"
              e.currentTarget.style.boxShadow = "none"
            }}
          >
            LAUNCH →
          </button>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={{
        position: "relative",
        zIndex: 1,
        minHeight: "100vh",
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        alignItems: "center",
        gap: "0",
        padding: "100px 6vw 60px",
        maxWidth: "1280px",
        margin: "0 auto",
      }}>
        {/* Left — copy */}
        <div>
          {/* Eyebrow */}
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            background: "rgba(0,255,135,0.06)",
            border: "1px solid rgba(0,255,135,0.18)",
            borderRadius: "100px",
            padding: "4px 14px 4px 8px",
            marginBottom: "36px",
          }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#00ff87", boxShadow: "0 0 8px #00ff87", display: "inline-block" }} />
            <span style={{ fontSize: "9px", letterSpacing: "0.2em", color: "#00ff87", fontWeight: 700 }}>
              INSPIRED BY PROJECT HAIL MARY
            </span>
          </div>

          {/* Headline */}
          <h1 style={{
            fontSize: "clamp(36px, 4.5vw, 64px)",
            fontWeight: 900,
            lineHeight: 1.08,
            letterSpacing: "-0.01em",
            color: "white",
            marginBottom: "28px",
          }}>
            An AI team that<br />
            <span style={{
              background: "linear-gradient(90deg, #00ff87, #00c8ff)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}>
              ships your code.
            </span>
          </h1>

          {/* Typewriter sub */}
          <div style={{
            fontSize: "clamp(13px, 1.4vw, 16px)",
            color: "rgba(255,255,255,0.38)",
            minHeight: "1.6em",
            marginBottom: "48px",
            letterSpacing: "0.02em",
          }}>
            <Typewriter lines={headlines} />
          </div>

          {/* CTA row */}
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <button
              onClick={() => navigate("/app")}
              style={{
                background: "linear-gradient(135deg, #00ff87, #00c8ff)",
                border: "none",
                borderRadius: "6px",
                color: "#04040f",
                cursor: "pointer",
                fontSize: "11px",
                fontWeight: 900,
                letterSpacing: "0.14em",
                padding: "14px 32px",
                fontFamily: "inherit",
                boxShadow: "0 0 40px rgba(0,255,135,0.3)",
                transition: "all 0.2s",
              }}
              onMouseOver={e => {
                e.currentTarget.style.boxShadow = "0 0 64px rgba(0,255,135,0.5)"
                e.currentTarget.style.transform = "translateY(-1px)"
              }}
              onMouseOut={e => {
                e.currentTarget.style.boxShadow = "0 0 40px rgba(0,255,135,0.3)"
                e.currentTarget.style.transform = "none"
              }}
            >
              OPEN MISSION CONTROL
            </button>
            <button
              onClick={() => navigate("/docs")}
              style={{
                background: "none",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "6px",
                color: "rgba(255,255,255,0.4)",
                cursor: "pointer",
                fontSize: "11px",
                letterSpacing: "0.1em",
                padding: "14px 24px",
                fontFamily: "inherit",
                transition: "all 0.2s",
              }}
              onMouseOver={e => {
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.25)"
                e.currentTarget.style.color = "rgba(255,255,255,0.8)"
              }}
              onMouseOut={e => {
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"
                e.currentTarget.style.color = "rgba(255,255,255,0.4)"
              }}
            >
              HOW IT WORKS →
            </button>
          </div>

          {/* Social proof line */}
          <div style={{
            marginTop: "48px",
            fontSize: "9px",
            color: "rgba(255,255,255,0.18)",
            letterSpacing: "0.12em",
            display: "flex",
            gap: "24px",
          }}>
            <span>6 SPECIALIZED AGENTS</span>
            <span style={{ color: "rgba(255,255,255,0.08)" }}>·</span>
            <span>AUTONOMOUS PIPELINE</span>
            <span style={{ color: "rgba(255,255,255,0.08)" }}>·</span>
            <span>OPENCODE SDK</span>
          </div>
        </div>

        {/* Right — orbit */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}>
          <OrbitDiagram />
        </div>
      </section>

      {/* ── THE HOOK ── */}
      <section style={{ position: "relative", zIndex: 1, padding: "100px 6vw" }}>
        <div style={{ maxWidth: "900px", margin: "0 auto" }}>
          <FadeIn>
            <blockquote style={{
              fontSize: "clamp(20px, 2.8vw, 36px)",
              fontWeight: 800,
              lineHeight: 1.4,
              color: "rgba(255,255,255,0.85)",
              borderLeft: "3px solid #00ff87",
              paddingLeft: "32px",
              margin: 0,
              letterSpacing: "-0.01em",
            }}>
              "Astrophage is a microbe that eats starlight.<br />
              <span style={{ color: "rgba(255,255,255,0.4)" }}>
                We named our AI engineering team after it.
              </span>"
            </blockquote>
            <div style={{ marginTop: "20px", paddingLeft: "35px", fontSize: "10px", color: "rgba(255,255,255,0.2)", letterSpacing: "0.15em" }}>
              — INSPIRED BY ANDY WEIR'S PROJECT HAIL MARY
            </div>
          </FadeIn>

          <FadeIn delay={150} style={{ marginTop: "64px" }}>
            <p style={{
              fontSize: "clamp(14px, 1.6vw, 18px)",
              color: "rgba(255,255,255,0.45)",
              lineHeight: 1.85,
              maxWidth: "680px",
            }}>
              Each agent is a character from the novel — Ryland Grace writes code, Rocky reviews
              it with no compromise, Stratt runs the mission. They orbit your task in a live 2D
              space UI and communicate via laser beams. Give them a bug. They ship a PR.
            </p>
          </FadeIn>
        </div>
      </section>

      {/* ── THE PIPELINE ── */}
      <section style={{ position: "relative", zIndex: 1, padding: "80px 6vw" }}>
        <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
          <FadeIn>
            <div style={{ fontSize: "9px", letterSpacing: "0.25em", color: "rgba(255,255,255,0.2)", marginBottom: "40px" }}>
              THE PIPELINE
            </div>
          </FadeIn>

          <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
            {[
              { agent: AGENTS.find(a => a.name === "pm")!, step: "01", action: "Decomposes the task into clear engineering specs" },
              { agent: AGENTS.find(a => a.name === "architect")!, step: "02", action: "Designs file contracts and interfaces before a single line is written" },
              { agent: AGENTS.find(a => a.name === "coder")!, step: "03", action: "Implements the fix, iterates on feedback" },
              { agent: AGENTS.find(a => a.name === "tester")!, step: "04", action: "Writes tests, runs them, reports truth — not opinion" },
              { agent: AGENTS.find(a => a.name === "reviewer")!, step: "05", action: "Reviews against a hardcoded constitution. No negotiation on security." },
              { agent: AGENTS.find(a => a.name === "scout")!, step: "06", action: "Branch → commit → PR → merge. Done." },
            ].map(({ agent, step, action }, i) => (
              <FadeIn key={agent!.name} delay={i * 60}>
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "24px",
                  padding: "20px 0",
                  borderBottom: "1px solid rgba(255,255,255,0.05)",
                  position: "relative",
                }}
                  onMouseOver={e => (e.currentTarget.style.background = "rgba(255,255,255,0.015)")}
                  onMouseOut={e => (e.currentTarget.style.background = "none")}
                >
                  {/* Step number */}
                  <div style={{
                    fontSize: "9px",
                    color: "rgba(255,255,255,0.12)",
                    letterSpacing: "0.1em",
                    width: "28px",
                    flexShrink: 0,
                  }}>
                    {step}
                  </div>

                  {/* Color bar */}
                  <div style={{
                    width: "3px",
                    height: "40px",
                    background: agent!.color,
                    borderRadius: "2px",
                    flexShrink: 0,
                    boxShadow: `0 0 12px ${agent!.color}66`,
                  }} />

                  {/* Agent */}
                  <div style={{ width: "180px", flexShrink: 0 }}>
                    <div style={{ fontSize: "10px", fontWeight: 700, color: agent!.color, letterSpacing: "0.1em" }}>
                      {agent!.name.toUpperCase()}
                    </div>
                    <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.25)", marginTop: "3px" }}>
                      {agent!.character} · {agent!.ship}
                    </div>
                  </div>

                  {/* Action */}
                  <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.5)", lineHeight: 1.5, flex: 1 }}>
                    {action}
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>

          <FadeIn delay={400}>
            <div style={{
              marginTop: "32px",
              padding: "16px 24px",
              background: "rgba(0,255,135,0.04)",
              border: "1px solid rgba(0,255,135,0.12)",
              borderRadius: "6px",
              fontSize: "11px",
              color: "rgba(255,255,255,0.35)",
              lineHeight: 1.7,
            }}>
              <span style={{ color: "#00ff87" }}>Convergence loop:</span>{" "}
              steps 03–05 repeat until tests pass <em>and</em> Rocky approves — or max rounds are hit and the pipeline exits with <code style={{ color: "rgba(255,255,255,0.5)", background: "rgba(255,255,255,0.05)", padding: "1px 5px", borderRadius: "3px" }}>[UNRESOLVED]</code>.
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── ROCKY'S RULE ── */}
      <section style={{ position: "relative", zIndex: 1, padding: "100px 6vw" }}>
        <div style={{ maxWidth: "900px", margin: "0 auto" }}>
          <FadeIn>
            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "2px",
              borderRadius: "12px",
              overflow: "hidden",
              border: "1px solid rgba(255,255,255,0.06)",
            }}>
              {/* Left */}
              <div style={{
                background: "rgba(239,68,68,0.06)",
                padding: "40px",
                borderRight: "1px solid rgba(255,255,255,0.04)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                  <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#ef4444", boxShadow: "0 0 12px #ef4444" }} />
                  <span style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.18em", color: "#ef4444" }}>NON-NEGOTIABLE</span>
                </div>
                <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.2)", letterSpacing: "0.06em", marginBottom: "28px" }}>
                  Rocky kills the PR. No rounds. No appeal.
                </div>
                {[
                  "Hardcoded secrets or API keys",
                  "Credentials in URL query params",
                  "Auth that silently succeeds on missing env vars",
                  "Plaintext HTTP for token exchange",
                  "OAuth without token refresh",
                ].map(r => (
                  <div key={r} style={{ display: "flex", gap: "10px", marginBottom: "14px", fontSize: "12px", color: "rgba(255,255,255,0.5)", lineHeight: 1.5 }}>
                    <span style={{ color: "#ef4444", flexShrink: 0, marginTop: "1px" }}>✕</span>
                    {r}
                  </div>
                ))}
              </div>

              {/* Right */}
              <div style={{ background: "rgba(251,191,36,0.04)", padding: "40px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                  <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#fbbf24", boxShadow: "0 0 12px #fbbf24" }} />
                  <span style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.18em", color: "#fbbf24" }}>NEGOTIABLE</span>
                </div>
                <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.2)", letterSpacing: "0.06em", marginBottom: "28px" }}>
                  Pushback. The coder iterates.
                </div>
                {[
                  "Env var naming conventions",
                  "Error message wording",
                  "Log level choices",
                  "Code style preferences",
                ].map(r => (
                  <div key={r} style={{ display: "flex", gap: "10px", marginBottom: "14px", fontSize: "12px", color: "rgba(255,255,255,0.5)", lineHeight: 1.5 }}>
                    <span style={{ color: "#fbbf24", flexShrink: 0, marginTop: "1px" }}>~</span>
                    {r}
                  </div>
                ))}

                <div style={{
                  marginTop: "32px",
                  padding: "14px 16px",
                  background: "rgba(255,255,255,0.03)",
                  borderRadius: "6px",
                  fontSize: "10px",
                  color: "rgba(255,255,255,0.3)",
                  lineHeight: 1.6,
                  fontStyle: "italic",
                }}>
                  "Rocky has rules, not opinions."
                </div>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── THE DEMO ── */}
      <section style={{ position: "relative", zIndex: 1, padding: "80px 6vw" }}>
        <div style={{ maxWidth: "900px", margin: "0 auto" }}>
          <FadeIn>
            <div style={{ fontSize: "9px", letterSpacing: "0.25em", color: "rgba(255,255,255,0.2)", marginBottom: "40px" }}>
              SAME CONSTITUTION · SAME COMPANY · TWO OUTCOMES
            </div>
          </FadeIn>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            {[
              {
                title: "OAuth Bug",
                color: "#a78bfa",
                badge: "3 ROUNDS → RESOLVED",
                badgeColor: "#00ff87",
                lines: [
                  { label: "Bug", text: "gRPC CLI silently skips auth when env var is missing" },
                  { label: "Rule", text: "Non-negotiable: auth must never silently succeed" },
                  { label: "Result", text: "Coder concedes on error message wording. Rocky accepts." },
                ],
              },
              {
                title: "API Key Bug",
                color: "#f472b6",
                badge: "ROUND 1 → INSTANT BLOCK",
                badgeColor: "#ef4444",
                lines: [
                  { label: "Bug", text: "API key appended as a URL query parameter" },
                  { label: "Rule", text: "Non-negotiable: credentials must never appear in URLs" },
                  { label: "Result", text: "Rocky kills the PR in round 1. No negotiation." },
                ],
              },
            ].map(demo => (
              <FadeIn key={demo.title}>
                <div style={{
                  background: "rgba(255,255,255,0.02)",
                  border: `1px solid ${demo.color}22`,
                  borderRadius: "10px",
                  padding: "28px",
                  height: "100%",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
                    <div style={{ fontSize: "13px", fontWeight: 700, color: demo.color }}>{demo.title}</div>
                    <div style={{
                      fontSize: "8px", fontWeight: 700, letterSpacing: "0.1em",
                      color: demo.badgeColor,
                      border: `1px solid ${demo.badgeColor}44`,
                      borderRadius: "3px",
                      padding: "3px 8px",
                    }}>
                      {demo.badge}
                    </div>
                  </div>
                  {demo.lines.map(l => (
                    <div key={l.label} style={{ marginBottom: "16px" }}>
                      <div style={{ fontSize: "8px", color: "rgba(255,255,255,0.18)", letterSpacing: "0.12em", marginBottom: "4px" }}>{l.label.toUpperCase()}</div>
                      <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)", lineHeight: 1.6 }}>{l.text}</div>
                    </div>
                  ))}
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section style={{ position: "relative", zIndex: 1, padding: "140px 6vw 120px", textAlign: "center" }}>
        <FadeIn>
          <div style={{
            display: "inline-block",
            fontSize: "9px",
            letterSpacing: "0.25em",
            color: "rgba(0,255,135,0.5)",
            marginBottom: "24px",
          }}>
            READY FOR LAUNCH
          </div>
          <h2 style={{
            fontSize: "clamp(32px, 5vw, 64px)",
            fontWeight: 900,
            color: "white",
            letterSpacing: "-0.01em",
            lineHeight: 1.1,
            marginBottom: "24px",
          }}>
            Watch the crew work.
          </h2>
          <p style={{
            fontSize: "15px",
            color: "rgba(255,255,255,0.3)",
            marginBottom: "48px",
            lineHeight: 1.8,
          }}>
            Ships orbit. Lasers fly. Code ships.
          </p>
          <button
            onClick={() => navigate("/app")}
            style={{
              background: "linear-gradient(135deg, #00ff87, #00c8ff)",
              border: "none",
              borderRadius: "8px",
              color: "#04040f",
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: 900,
              letterSpacing: "0.16em",
              padding: "20px 56px",
              fontFamily: "inherit",
              boxShadow: "0 0 60px rgba(0,255,135,0.35)",
              transition: "all 0.25s",
            }}
            onMouseOver={e => {
              e.currentTarget.style.boxShadow = "0 0 100px rgba(0,255,135,0.55)"
              e.currentTarget.style.transform = "translateY(-2px) scale(1.02)"
            }}
            onMouseOut={e => {
              e.currentTarget.style.boxShadow = "0 0 60px rgba(0,255,135,0.35)"
              e.currentTarget.style.transform = "none"
            }}
          >
            OPEN MISSION CONTROL →
          </button>
        </FadeIn>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{
        position: "relative",
        zIndex: 1,
        borderTop: "1px solid rgba(255,255,255,0.04)",
        padding: "24px 28px",
        display: "flex",
        flexWrap: "wrap",
        gap: "16px",
        alignItems: "center",
        justifyContent: "space-between",
        fontSize: "9px",
        color: "rgba(255,255,255,0.15)",
        letterSpacing: "0.1em",
      }}>
        <div>ASTROPHAGE · AGENT COMPANY · PROJECT HAIL MARY</div>
        <div style={{ display: "flex", gap: "20px" }}>
          <button onClick={() => navigate("/docs")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "9px", color: "rgba(255,255,255,0.15)", letterSpacing: "0.1em", fontFamily: "inherit" }}>DOCS</button>
          <a href="https://github.com/chinmayrelkar/astrophage" target="_blank" rel="noreferrer" style={{ color: "rgba(255,255,255,0.15)", textDecoration: "none" }}>GITHUB</a>
          <a href="https://en.wikipedia.org/wiki/Project_Hail_Mary" target="_blank" rel="noreferrer" style={{ color: "rgba(255,255,255,0.15)", textDecoration: "none" }}>THE NOVEL</a>
          <a href="https://opencode.ai" target="_blank" rel="noreferrer" style={{ color: "rgba(255,255,255,0.15)", textDecoration: "none" }}>OPENCODE</a>
        </div>
      </footer>
    </div>
  )
}
