import { useEffect, useRef, useCallback } from "react"
import { AGENTS } from "./agents"
import type { AgentState, CommBeam, TaskInfo } from "./useSpaceState"
import type { AgentName } from "../hooks/useAgentStream"

interface Props {
  agents: Record<AgentName, AgentState>
  beams: CommBeam[]
  currentRound: number
  task: TaskInfo | null
  onShipClick: (name: AgentName) => void
}

// Pre-generate stars once
const STARS = Array.from({ length: 200 }, () => ({
  x: Math.random(),
  y: Math.random(),
  r: Math.random() * 1.5 + 0.3,
  twinkle: Math.random() * Math.PI * 2,
  speed: Math.random() * 0.8 + 0.2,
}))

export function SpaceCanvas({ agents, beams, currentRound, task, onShipClick }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const timeRef = useRef(0)
  // Store ship positions for beam drawing
  const shipPositionsRef = useRef<Record<string, { x: number; y: number }>>({})

  const draw = useCallback((ts: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    timeRef.current = ts

    const W = canvas.width
    const H = canvas.height
    const cx = W / 2
    const cy = H / 2

    // ── Background ──
    ctx.fillStyle = "#050510"
    ctx.fillRect(0, 0, W, H)

    // ── Stars ──
    for (const star of STARS) {
      const twinkle = 0.5 + 0.5 * Math.sin(ts * 0.001 * star.speed + star.twinkle)
      ctx.beginPath()
      ctx.arc(star.x * W, star.y * H, star.r, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(255,255,255,${0.3 + twinkle * 0.7})`
      ctx.fill()
    }

    // ── Nebula glow in background ──
    const nebula = ctx.createRadialGradient(cx * 0.6, cy * 0.4, 0, cx * 0.6, cy * 0.4, W * 0.4)
    nebula.addColorStop(0, "rgba(60,0,80,0.15)")
    nebula.addColorStop(1, "rgba(0,0,0,0)")
    ctx.fillStyle = nebula
    ctx.fillRect(0, 0, W, H)

    // ── Orbit rings (faint) ──
    for (const agent of AGENTS) {
      ctx.beginPath()
      ctx.arc(cx, cy, agent.orbitRadius, 0, Math.PI * 2)
      ctx.strokeStyle = "rgba(255,255,255,0.04)"
      ctx.lineWidth = 1
      ctx.stroke()
    }

    // ── Task star (center) ──
    const starPulse = 1 + 0.08 * Math.sin(ts * 0.002)
    const starR = 28 * starPulse
    const starGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, starR * 3)
    if (task) {
      starGlow.addColorStop(0, "rgba(255,220,80,0.9)")
      starGlow.addColorStop(0.3, "rgba(255,160,20,0.4)")
      starGlow.addColorStop(1, "rgba(0,0,0,0)")
    } else {
      starGlow.addColorStop(0, "rgba(80,80,120,0.6)")
      starGlow.addColorStop(1, "rgba(0,0,0,0)")
    }
    ctx.beginPath()
    ctx.arc(cx, cy, starR * 3, 0, Math.PI * 2)
    ctx.fillStyle = starGlow
    ctx.fill()

    ctx.beginPath()
    ctx.arc(cx, cy, starR, 0, Math.PI * 2)
    ctx.fillStyle = task ? "#ffdc50" : "#404060"
    ctx.fill()

    // Task label
    if (task) {
      ctx.font = "bold 11px 'JetBrains Mono', monospace"
      ctx.fillStyle = "rgba(255,255,255,0.9)"
      ctx.textAlign = "center"
      const label = task.title.length > 30 ? task.title.slice(0, 28) + "…" : task.title
      ctx.fillText(label, cx, cy + starR + 16)
      ctx.font = "9px 'JetBrains Mono', monospace"
      ctx.fillStyle = "rgba(255,255,255,0.4)"
      ctx.fillText(`Round ${currentRound}`, cx, cy + starR + 28)
    } else {
      ctx.font = "10px 'JetBrains Mono', monospace"
      ctx.fillStyle = "rgba(255,255,255,0.3)"
      ctx.textAlign = "center"
      ctx.fillText("awaiting task", cx, cy + starR + 16)
    }

    // ── Ships ──
    const positions: Record<string, { x: number; y: number }> = {}

    for (const agent of AGENTS) {
      const state = agents[agent.name]
      const angle = agent.orbitPhase + (ts * 0.001) * agent.orbitSpeed
      const sx = cx + Math.cos(angle) * agent.orbitRadius
      const sy = cy + Math.sin(angle) * agent.orbitRadius
      positions[agent.name] = { x: sx, y: sy }

      const isActive = state?.status === "thinking"
      const isBlocked = state?.status === "blocked"
      const isDone = state?.status === "done"

      // Ship glow
      const glowR = isActive ? 45 + 8 * Math.sin(ts * 0.004) : isDone ? 35 : 25
      const glowAlpha = isActive ? 0.5 : isDone ? 0.25 : 0.1
      const glowColor = isBlocked ? "#f87171" : agent.color
      const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, glowR)
      glow.addColorStop(0, hexToRgba(glowColor, glowAlpha))
      glow.addColorStop(1, "rgba(0,0,0,0)")
      ctx.beginPath()
      ctx.arc(sx, sy, glowR, 0, Math.PI * 2)
      ctx.fillStyle = glow
      ctx.fill()

      // Ship body
      const bodyR = isActive ? 14 + 2 * Math.sin(ts * 0.005) : 12
      ctx.beginPath()
      ctx.arc(sx, sy, bodyR, 0, Math.PI * 2)
      ctx.fillStyle = isBlocked ? "#f87171" : agent.color
      ctx.globalAlpha = isActive ? 1 : isDone ? 0.85 : 0.45
      ctx.fill()
      ctx.globalAlpha = 1

      // Ring for thinking
      if (isActive) {
        const ringAlpha = 0.3 + 0.3 * Math.sin(ts * 0.006)
        ctx.beginPath()
        ctx.arc(sx, sy, bodyR + 6, 0, Math.PI * 2)
        ctx.strokeStyle = hexToRgba(agent.color, ringAlpha)
        ctx.lineWidth = 2
        ctx.stroke()
      }

      // Emoji
      ctx.font = `${isActive ? 14 : 12}px serif`
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.globalAlpha = isActive ? 1 : 0.6
      ctx.fillText(agent.emoji, sx, sy)
      ctx.globalAlpha = 1

      // Character name
      ctx.font = `bold ${isActive ? 10 : 9}px 'JetBrains Mono', monospace`
      ctx.fillStyle = isBlocked ? "#f87171" : isActive ? agent.color : "rgba(255,255,255,0.5)"
      ctx.textBaseline = "alphabetic"
      ctx.fillText(agent.character, sx, sy + bodyR + 14)

      // Ship name (smaller, dimmer)
      ctx.font = "8px 'JetBrains Mono', monospace"
      ctx.fillStyle = "rgba(255,255,255,0.25)"
      ctx.fillText(agent.ship, sx, sy + bodyR + 24)

      // Role description (dimmer still, only when active or done)
      if (isActive || isDone) {
        ctx.font = "7px 'JetBrains Mono', monospace"
        ctx.fillStyle = isActive
          ? hexToRgba(agent.color, 0.45)
          : "rgba(255,255,255,0.15)"
        const desc = agent.description.length > 36
          ? agent.description.slice(0, 34) + "…"
          : agent.description
        ctx.fillText(desc, sx, sy + bodyR + 35)
      }

      // Last message bubble
      if (state?.lastMessage && isActive) {
        const msg = state.lastMessage.slice(0, 40)
        const bubbleW = Math.min(ctx.measureText(msg).width + 12, 160)
        const bubbleX = sx + 20
        const bubbleY = sy - 30

        ctx.fillStyle = "rgba(0,0,0,0.75)"
        ctx.beginPath()
        ctx.roundRect(bubbleX, bubbleY - 10, bubbleW, 18, 4)
        ctx.fill()

        ctx.font = "8px 'JetBrains Mono', monospace"
        ctx.fillStyle = hexToRgba(agent.color, 0.9)
        ctx.textAlign = "left"
        ctx.fillText(msg + (state.lastMessage.length > 40 ? "…" : ""), bubbleX + 6, bubbleY + 3)
        ctx.textAlign = "center"
      }
    }

    shipPositionsRef.current = positions

    // ── Laser beams ──
    for (const beam of beams) {
      const fromPos = beam.from === "orchestrator"
        ? { x: cx, y: cy }
        : positions[beam.from]
      const toPos = beam.to === "all" || beam.to === "orchestrator"
        ? { x: cx, y: cy }
        : positions[beam.to]

      if (!fromPos || !toPos) continue

      const age = (Date.now() - beam.timestamp) / 4000
      const alpha = Math.max(0, 1 - age)
      const beamColor = beam.type === "verdict"
        ? (beam.message.startsWith("ACCEPT") ? "#00ff87" : "#f87171")
        : beam.type === "convergence"
        ? "#a78bfa"
        : "#60a5fa"

      // Beam line
      ctx.beginPath()
      ctx.moveTo(fromPos.x, fromPos.y)
      ctx.lineTo(toPos.x, toPos.y)
      const grad = ctx.createLinearGradient(fromPos.x, fromPos.y, toPos.x, toPos.y)
      grad.addColorStop(0, hexToRgba(beamColor, alpha * 0.8))
      grad.addColorStop(0.5, hexToRgba(beamColor, alpha * 0.3))
      grad.addColorStop(1, hexToRgba(beamColor, alpha * 0.8))
      ctx.strokeStyle = grad
      ctx.lineWidth = 1.5
      ctx.stroke()

      // Travelling dot
      const t = ((Date.now() * 0.001) % 1)
      const dotX = fromPos.x + (toPos.x - fromPos.x) * t
      const dotY = fromPos.y + (toPos.y - fromPos.y) * t
      ctx.beginPath()
      ctx.arc(dotX, dotY, 3, 0, Math.PI * 2)
      ctx.fillStyle = hexToRgba(beamColor, alpha)
      ctx.fill()

      // Message label at midpoint
      const midX = (fromPos.x + toPos.x) / 2
      const midY = (fromPos.y + toPos.y) / 2
      const msg = beam.message.slice(0, 35)
      ctx.font = "8px 'JetBrains Mono', monospace"
      ctx.fillStyle = hexToRgba(beamColor, alpha * 0.9)
      ctx.textAlign = "center"
      ctx.fillText(msg, midX, midY - 6)
    }

    animRef.current = requestAnimationFrame(draw)
  }, [agents, beams, currentRound, task])

  // Resize handler
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const resize = () => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    return () => ro.disconnect()
  }, [])

  // Animation loop
  useEffect(() => {
    animRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(animRef.current)
  }, [draw])

  // Click to select ship
  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const positions = shipPositionsRef.current
    for (const agent of AGENTS) {
      const pos = positions[agent.name]
      if (!pos) continue
      const dx = mx - pos.x
      const dy = my - pos.y
      if (Math.sqrt(dx * dx + dy * dy) < 20) {
        onShipClick(agent.name)
        return
      }
    }
  }, [onShipClick])

  return (
    <canvas
      ref={canvasRef}
      onClick={handleClick}
      style={{ width: "100%", height: "100%", cursor: "crosshair", display: "block" }}
    />
  )
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}
