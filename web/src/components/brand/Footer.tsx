import { useNavigate } from "react-router-dom"
import { color, space, type } from "./tokens"

const REPO_URL = "https://github.com/chinmayrelkar/astrophage"

export function Footer() {
  const navigate = useNavigate()

  return (
    <footer style={{
      position: "relative",
      zIndex: 1,
      borderTop: `1px solid ${color.hairline}`,
      padding: `${space.lg} clamp(20px, 5vw, 32px)`,
      display: "flex",
      flexWrap: "wrap",
      gap: space.md,
      alignItems: "center",
      justifyContent: "space-between",
      fontSize: "9px",
      color: color.textGhost,
      letterSpacing: "0.14em",
    }}>
      <div>ASTROPHAGE · AGENT COMPANY · PROJECT HAIL MARY</div>
      <div style={{ display: "flex", gap: "clamp(12px, 2vw, 20px)", flexWrap: "wrap" }}>
        <button
          onClick={() => navigate("/docs")}
          style={{ background: "none", border: "none", cursor: "pointer", fontSize: "9px", color: color.textGhost, letterSpacing: "0.14em", fontFamily: "inherit" }}
        >DOCS</button>
        <button
          onClick={() => navigate("/observability")}
          style={{ background: "none", border: "none", cursor: "pointer", fontSize: "9px", color: color.textGhost, letterSpacing: "0.14em", fontFamily: "inherit" }}
        >OBSERVABILITY</button>
        <a href={REPO_URL} target="_blank" rel="noreferrer" style={{ color: color.textGhost, textDecoration: "none" }}>GITHUB</a>
        <a href="https://en.wikipedia.org/wiki/Project_Hail_Mary" target="_blank" rel="noreferrer" style={{ color: color.textGhost, textDecoration: "none" }}>THE NOVEL</a>
        <a href="https://opencode.ai" target="_blank" rel="noreferrer" style={{ color: color.textGhost, textDecoration: "none" }}>OPENCODE</a>
      </div>
    </footer>
  )
}

// suppressed unused warning for type import
void type
