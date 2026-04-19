// ─── Brand primitives ─────────────────────────────────────────────────────────
// Small, stylistically-consistent building blocks shared by Landing + Docs.
// All styles are inline (matches the rest of the codebase) and read from
// tokens.ts so spacing, color, and type stay in sync everywhere.

import React, { useEffect, useRef, useState } from "react"
import { color, space, type, radius, container, baseStyle } from "./tokens"

// ─── Section ──────────────────────────────────────────────────────────────────

interface SectionProps {
  id?: string
  children: React.ReactNode
  /** Vertical padding. "tight" = 64px, "normal" = 96px, "loose" = 140px. */
  pad?: "tight" | "normal" | "loose"
  /** Max-width container preset. */
  width?: "narrow" | "base" | "wide"
  /** Optional hairline divider above the section. */
  divider?: boolean
  style?: React.CSSProperties
}

export function Section({ id, children, pad = "normal", width = "base", divider, style }: SectionProps) {
  const padY = pad === "tight" ? space.xxl : pad === "loose" ? space.section : space.xxxl
  return (
    <section
      id={id}
      style={{
        position: "relative",
        zIndex: 1,
        padding: `${padY} clamp(20px, 5vw, 40px)`,
        borderTop: divider ? `1px solid ${color.hairline}` : "none",
        ...style,
      }}
    >
      <div style={{ maxWidth: container[width], margin: "0 auto" }}>
        {children}
      </div>
    </section>
  )
}

// ─── Eyebrow (small labeled section header) ──────────────────────────────────

export function Eyebrow({ children, dot, dotColor = color.accent, style }: {
  children: React.ReactNode
  dot?: boolean
  dotColor?: string
  style?: React.CSSProperties
}) {
  return (
    <div style={{
      display: "inline-flex",
      alignItems: "center",
      gap: space.sm,
      fontSize: type.eyebrow,
      fontWeight: 700,
      letterSpacing: "0.22em",
      color: color.textMute,
      textTransform: "uppercase",
      ...style,
    }}>
      {dot && (
        <span style={{
          width: "6px",
          height: "6px",
          borderRadius: "50%",
          background: dotColor,
          boxShadow: `0 0 8px ${dotColor}`,
          display: "inline-block",
        }} />
      )}
      {children}
    </div>
  )
}

// ─── Pill ─────────────────────────────────────────────────────────────────────

export function Pill({ children, tone = "accent" }: {
  children: React.ReactNode
  tone?: "accent" | "warn" | "danger" | "neutral"
}) {
  const toneColor =
    tone === "warn"    ? color.warn :
    tone === "danger"  ? color.danger :
    tone === "neutral" ? color.textMute :
    color.accent
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: "6px",
      background: `${toneColor}11`,
      border: `1px solid ${toneColor}44`,
      color: toneColor,
      borderRadius: "100px",
      padding: "3px 10px",
      fontSize: "9px",
      fontWeight: 700,
      letterSpacing: "0.18em",
      textTransform: "uppercase",
    }}>
      {children}
    </span>
  )
}

// ─── Card ─────────────────────────────────────────────────────────────────────

export function Card({ children, accent, style, hoverLift }: {
  children: React.ReactNode
  accent?: string
  style?: React.CSSProperties
  hoverLift?: boolean
}) {
  const [hover, setHover] = useState(false)
  return (
    <div
      onMouseOver={() => hoverLift && setHover(true)}
      onMouseOut={() => hoverLift && setHover(false)}
      style={{
        background: color.surface,
        border: `1px solid ${accent ? `${accent}22` : color.hairline}`,
        borderRadius: radius.lg,
        padding: space.lg,
        transition: "transform 0.2s ease, border-color 0.2s ease, background 0.2s ease",
        transform: hoverLift && hover ? "translateY(-2px)" : "none",
        borderColor: hoverLift && hover && accent ? `${accent}55` : (accent ? `${accent}22` : color.hairline),
        ...style,
      }}
    >
      {children}
    </div>
  )
}

// ─── CodeBlock & inline Code ──────────────────────────────────────────────────

export function CodeBlock({ children, label }: { children: React.ReactNode; label?: string }) {
  return (
    <div style={{
      background: "rgba(0,0,0,0.45)",
      border: `1px solid ${color.hairline}`,
      borderRadius: radius.lg,
      overflow: "hidden",
      margin: `${space.md} 0`,
    }}>
      {label && (
        <div style={{
          padding: "8px 16px",
          borderBottom: `1px solid ${color.hairline}`,
          fontSize: "9px",
          color: color.textFaint,
          letterSpacing: "0.15em",
          textTransform: "uppercase",
        }}>{label}</div>
      )}
      <pre style={{
        margin: 0,
        padding: "18px 20px",
        fontSize: "12.5px",
        lineHeight: 1.75,
        color: "rgba(220,240,255,0.75)",
        overflowX: "auto",
        fontFamily: "inherit",
      }}>{children}</pre>
    </div>
  )
}

export function Code({ children }: { children: React.ReactNode }) {
  return (
    <code style={{
      background: "rgba(255,255,255,0.05)",
      border: `1px solid ${color.hairline}`,
      borderRadius: "3px",
      padding: "1px 6px",
      fontSize: "0.92em",
      color: "rgba(220,240,255,0.85)",
      fontFamily: "inherit",
    }}>{children}</code>
  )
}

// ─── FadeIn (IntersectionObserver scroll reveal) ─────────────────────────────

export function FadeIn({ children, delay = 0, style }: {
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
      { threshold: 0.12 },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return (
    <div ref={ref} style={{
      opacity: visible ? 1 : 0,
      transform: visible ? "none" : "translateY(24px)",
      transition: `opacity 0.7s ease ${delay}ms, transform 0.7s ease ${delay}ms`,
      ...style,
    }}>{children}</div>
  )
}

// ─── Button ───────────────────────────────────────────────────────────────────

export function Button({ children, variant = "ghost", onClick, href, style, size = "md" }: {
  children: React.ReactNode
  variant?: "primary" | "ghost" | "subtle"
  onClick?: () => void
  href?: string
  style?: React.CSSProperties
  size?: "sm" | "md" | "lg"
}) {
  const pad = size === "lg" ? "16px 36px" : size === "sm" ? "6px 14px" : "11px 22px"
  const fs  = size === "lg" ? "12px" : size === "sm" ? "10px" : "11px"

  const base: React.CSSProperties = {
    display: "inline-block",
    cursor: "pointer",
    fontSize: fs,
    fontWeight: 800,
    letterSpacing: "0.14em",
    padding: pad,
    borderRadius: radius.md,
    fontFamily: "inherit",
    textDecoration: "none",
    transition: "all 0.2s",
    lineHeight: 1,
    textAlign: "center",
  }

  const variantStyle: React.CSSProperties =
    variant === "primary"
      ? {
          background: "linear-gradient(135deg, #00ff87, #00c8ff)",
          border: "none",
          color: color.bg,
          boxShadow: "0 0 40px rgba(0,255,135,0.28)",
        }
      : variant === "subtle"
      ? {
          background: "rgba(0,255,135,0.08)",
          border: `1px solid ${color.accent}44`,
          color: color.accent,
        }
      : {
          background: "none",
          border: `1px solid ${color.hairline}`,
          color: color.textMute,
        }

  const Tag = (href ? "a" : "button") as any
  const extra = href ? { href, target: href.startsWith("http") ? "_blank" : undefined, rel: "noreferrer" } : { onClick }
  return (
    <Tag
      {...extra}
      style={{ ...base, ...variantStyle, ...style }}
      onMouseOver={(e: React.MouseEvent<HTMLElement>) => {
        if (variant === "primary") {
          e.currentTarget.style.boxShadow = "0 0 80px rgba(0,255,135,0.48)"
          e.currentTarget.style.transform = "translateY(-1px)"
        } else if (variant === "ghost") {
          e.currentTarget.style.borderColor = "rgba(255,255,255,0.25)"
          e.currentTarget.style.color = "rgba(255,255,255,0.85)"
        } else {
          e.currentTarget.style.background = "rgba(0,255,135,0.15)"
        }
      }}
      onMouseOut={(e: React.MouseEvent<HTMLElement>) => {
        if (variant === "primary") {
          e.currentTarget.style.boxShadow = "0 0 40px rgba(0,255,135,0.28)"
          e.currentTarget.style.transform = "none"
        } else if (variant === "ghost") {
          e.currentTarget.style.borderColor = color.hairline
          e.currentTarget.style.color = color.textMute
        } else {
          e.currentTarget.style.background = "rgba(0,255,135,0.08)"
        }
      }}
    >
      {children}
    </Tag>
  )
}

// ─── H (consistent heading) ──────────────────────────────────────────────────

export function H({ level, children, style }: {
  level: 1 | 2 | 3
  children: React.ReactNode
  style?: React.CSSProperties
}) {
  const Tag = `h${level}` as "h1" | "h2" | "h3"
  const base: React.CSSProperties =
    level === 1 ? { fontSize: type.display1, fontWeight: 900, lineHeight: 1.05, letterSpacing: "-0.015em", color: "white", margin: 0 }
    : level === 2 ? { fontSize: type.display2, fontWeight: 900, lineHeight: 1.12, letterSpacing: "-0.01em", color: "white", margin: 0 }
    :               { fontSize: type.display3, fontWeight: 800, lineHeight: 1.25, letterSpacing: "-0.005em", color: "white", margin: 0 }
  return <Tag style={{ ...base, ...style }}>{children}</Tag>
}

// Utility — gradient accent text
export const gradientText: React.CSSProperties = {
  background: `linear-gradient(90deg, ${color.accent}, ${color.accent2})`,
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
}

export { baseStyle }
