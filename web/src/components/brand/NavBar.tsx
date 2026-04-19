// Shared top nav for Landing and Docs. Sticky, glassy, monospace.

import { useNavigate, useLocation } from "react-router-dom"
import { color, space, type } from "./tokens"
import { useIsMobile } from "./useMedia"

const REPO_URL = "https://github.com/chinmayrelkar/astrophage"

interface NavLink {
  label: string
  to?: string
  href?: string
}

export function NavBar() {
  const navigate = useNavigate()
  const location = useLocation()
  const isMobile = useIsMobile()

  const links: NavLink[] = [
    { label: "DOCS",          to: "/docs" },
    { label: "OBSERVABILITY", to: "/observability" },
    { label: "GITHUB ↗",      href: REPO_URL },
  ]

  const visibleLinks = isMobile ? links.filter((l) => l.label === "DOCS" || l.label.startsWith("GITHUB")) : links

  return (
    <nav style={{
      position: "fixed",
      top: 0, left: 0, right: 0,
      zIndex: 100,
      display: "flex",
      alignItems: "center",
      padding: `12px clamp(16px, 5vw, 32px)`,
      background: "rgba(4,4,15,0.72)",
      backdropFilter: "blur(18px)",
      WebkitBackdropFilter: "blur(18px)",
      borderBottom: `1px solid ${color.hairline}`,
    }}>
      <button
        onClick={() => navigate("/")}
        style={{
          background: "none", border: "none", cursor: "pointer",
          fontFamily: "inherit", padding: 0,
          fontWeight: 900, fontSize: "13px", letterSpacing: "0.28em",
          color: "white",
        }}
        aria-label="Astrophage — home"
      >
        ASTROPHAGE
      </button>
      {location.pathname === "/docs" && (
        <span style={{ marginLeft: space.md, fontSize: type.eyebrow, color: color.textGhost, letterSpacing: "0.18em" }}>
          / DOCS
        </span>
      )}

      <div style={{ marginLeft: "auto", display: "flex", gap: "clamp(12px, 2.5vw, 22px)", alignItems: "center" }}>
        {visibleLinks.map((l) => {
          const common: React.CSSProperties = {
            background: "none", border: "none", cursor: "pointer",
            fontSize: type.tiny, color: color.textMute,
            letterSpacing: "0.12em", fontFamily: "inherit",
            textDecoration: "none", transition: "color 0.15s",
          }
          const onHover = (e: React.MouseEvent<HTMLElement>) => { e.currentTarget.style.color = "rgba(255,255,255,0.85)" }
          const onLeave = (e: React.MouseEvent<HTMLElement>) => { e.currentTarget.style.color = color.textMute }

          if (l.href) return (
            <a key={l.label} href={l.href} target="_blank" rel="noreferrer" style={common} onMouseOver={onHover} onMouseOut={onLeave}>{l.label}</a>
          )
          return (
            <button key={l.label} onClick={() => l.to && navigate(l.to)} style={common} onMouseOver={onHover} onMouseOut={onLeave}>{l.label}</button>
          )
        })}

        <button
          onClick={() => navigate("/app")}
          style={{
            background: "rgba(0,255,135,0.1)",
            border: `1px solid ${color.accent}55`,
            borderRadius: "4px",
            color: color.accent,
            cursor: "pointer",
            fontSize: type.tiny,
            letterSpacing: "0.12em",
            padding: "6px 14px",
            fontFamily: "inherit",
            fontWeight: 700,
            transition: "all 0.2s",
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = "rgba(0,255,135,0.2)"
            e.currentTarget.style.boxShadow = "0 0 24px rgba(0,255,135,0.3)"
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = "rgba(0,255,135,0.1)"
            e.currentTarget.style.boxShadow = "none"
          }}
        >
          LAUNCH →
        </button>
      </div>
    </nav>
  )
}
