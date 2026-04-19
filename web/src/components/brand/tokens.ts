// ─── Brand tokens ─────────────────────────────────────────────────────────────
// Single source of truth for the refined terminal/space aesthetic used by the
// public-facing pages (Landing + Docs). Strict monospace; dark background;
// green-cyan accent for "system live"; yellow for caution/negotiable;
// red for non-negotiable / paused.

export const color = {
  // Base
  bg:        "#04040f",
  bgAlt:     "#07071a",
  hairline:  "rgba(255,255,255,0.06)",
  surface:   "rgba(255,255,255,0.02)",
  surface2:  "rgba(255,255,255,0.035)",

  // Text
  text:      "#e2e8f0",
  textDim:   "rgba(255,255,255,0.55)",
  textMute:  "rgba(255,255,255,0.38)",
  textFaint: "rgba(255,255,255,0.22)",
  textGhost: "rgba(255,255,255,0.12)",

  // Accents
  accent:      "#00ff87",  // live / success / CTA
  accent2:     "#00c8ff",  // info / gradient pair
  warn:        "#fbbf24",  // negotiable / caution
  danger:      "#ef4444",  // non-negotiable / paused
  lavender:    "#a78bfa",  // PM
  rose:        "#f472b6",  // tester
  sky:         "#60a5fa",  // architect
  teal:        "#34d399",  // scout
  orange:      "#fb923c",  // product
} as const

export const space = {
  xs:  "6px",
  sm:  "10px",
  md:  "16px",
  lg:  "24px",
  xl:  "40px",
  xxl: "64px",
  xxxl: "96px",
  section: "140px",
} as const

export const type = {
  mono: "'JetBrains Mono', 'Fira Code', ui-monospace, SFMono-Regular, Menlo, monospace",
  // Display sizes use clamp for fluid responsive scaling
  display1: "clamp(40px, 6.2vw, 76px)",
  display2: "clamp(28px, 4vw, 48px)",
  display3: "clamp(20px, 2.4vw, 30px)",
  body:     "clamp(13px, 1.15vw, 15px)",
  bodyLg:   "clamp(14px, 1.35vw, 17px)",
  small:    "12px",
  tiny:     "10px",
  eyebrow:  "9px",
} as const

export const radius = {
  sm: "4px",
  md: "6px",
  lg: "10px",
  xl: "14px",
} as const

export const shadow = {
  glow:     "0 0 40px rgba(0,255,135,0.28)",
  glowLg:   "0 0 80px rgba(0,255,135,0.4)",
  soft:     "0 2px 24px rgba(0,0,0,0.35)",
  danger:   "0 0 24px rgba(239,68,68,0.35)",
} as const

// ─── Breakpoints ──────────────────────────────────────────────────────────────
// Pages consume these via `useMedia` or inline styles with `@media` via
// a small helper. Keep the values in one place so Landing + Docs agree.

export const breakpoint = {
  lg: 1180,
  md: 960,
  sm: 640,
  xs: 440,
} as const

export const container = {
  narrow: "720px",
  base:   "1000px",
  wide:   "1180px",
} as const

// ─── Common style fragments ──────────────────────────────────────────────────

export const baseStyle = {
  root: {
    background: color.bg,
    color: color.text,
    fontFamily: type.mono,
    minHeight: "100vh",
    overflowX: "hidden" as const,
    lineHeight: 1.5,
  },
  container: {
    maxWidth: container.wide,
    margin: "0 auto",
    padding: `0 clamp(20px, 5vw, 40px)`,
  },
  hairline: { borderTop: `1px solid ${color.hairline}` },
  link: {
    color: color.accent,
    textDecoration: "none",
    transition: "color 0.15s",
  } as const,
} as const
