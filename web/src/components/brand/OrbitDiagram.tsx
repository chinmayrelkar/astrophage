// Animated orbit diagram — extracted from the old LandingPage so both the
// hero section and any future docs visual can reuse the same canvas.

import { useEffect, useRef } from "react"
import { AGENTS } from "../../space/agents"

export function OrbitDiagram({ size = 480 }: { size?: number }) {
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
    const scale = W / 1000 // canvas orbit coords are in px at 480; scale uniformly

    function draw() {
      if (!ctx) return
      ctx.clearRect(0, 0, W, H)
      t += 0.008

      // subtle nebula behind center
      const nebulaR = 180 * scale
      const nebula = ctx.createRadialGradient(cx, cy, 0, cx, cy, nebulaR)
      nebula.addColorStop(0, "rgba(80,40,200,0.13)")
      nebula.addColorStop(0.5, "rgba(30,10,80,0.06)")
      nebula.addColorStop(1, "rgba(0,0,0,0)")
      ctx.beginPath()
      ctx.arc(cx, cy, nebulaR, 0, Math.PI * 2)
      ctx.fillStyle = nebula
      ctx.fill()

      // orbit rings
      for (const agent of AGENTS) {
        const r = agent.orbitRadius * 0.46 * scale * 2
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
      const starR = 32 * scale * 2 * pulse
      const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, starR)
      grd.addColorStop(0, "rgba(255,230,80,1)")
      grd.addColorStop(0.35, "rgba(255,150,20,0.6)")
      grd.addColorStop(1, "rgba(255,80,0,0)")
      ctx.beginPath()
      ctx.arc(cx, cy, starR, 0, Math.PI * 2)
      ctx.fillStyle = grd
      ctx.fill()

      ctx.fillStyle = "rgba(255,230,80,0.92)"
      ctx.font = `bold ${Math.round(9 * scale * 2)}px "JetBrains Mono", monospace`
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.fillText("TASK", cx, cy)

      // positions
      const positions: { x: number; y: number; color: string }[] = []
      for (const agent of AGENTS) {
        const angle = agent.orbitPhase + t * agent.orbitSpeed
        const r = agent.orbitRadius * 0.46 * scale * 2
        positions.push({
          x: cx + Math.cos(angle) * r,
          y: cy + Math.sin(angle) * r,
          color: agent.color,
        })
      }

      // cycling laser beam
      const beamIdx = Math.floor((t * 0.4) % AGENTS.length)
      const next = (beamIdx + 1) % AGENTS.length
      const a = positions[beamIdx]
      const b = positions[next]
      const beamAlpha = 0.2 + Math.sin(t * 6) * 0.08
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

        const glowR = 20 * scale * 2
        const glow = ctx.createRadialGradient(x, y, 0, x, y, glowR)
        glow.addColorStop(0, agent.color + "55")
        glow.addColorStop(1, agent.color + "00")
        ctx.beginPath()
        ctx.arc(x, y, glowR, 0, Math.PI * 2)
        ctx.fillStyle = glow
        ctx.fill()

        ctx.beginPath()
        ctx.arc(x, y, 4.5 * scale * 2, 0, Math.PI * 2)
        ctx.fillStyle = agent.color
        ctx.fill()

        ctx.fillStyle = agent.color + "cc"
        ctx.font = `bold ${Math.round(7 * scale * 2)}px "JetBrains Mono", monospace`
        ctx.textAlign = "center"
        ctx.textBaseline = "top"
        ctx.fillText(agent.name.toUpperCase(), x, y + 7 * scale * 2)
      }

      animId = requestAnimationFrame(draw)
    }

    draw()
    return () => cancelAnimationFrame(animId)
  }, [size])

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      style={{ display: "block", width: "100%", maxWidth: `${size}px`, height: "auto" }}
    />
  )
}
