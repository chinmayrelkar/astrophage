// ─── Project Hail Mary character definitions ──────────────────────────────────

import type { AgentName } from "../hooks/useAgentStream"

export interface AgentCharacter {
  name: AgentName
  /** Short role label shown as a prefix in all UI surfaces, e.g. "PM", "CODER" */
  role: string
  character: string
  ship: string
  emoji: string
  color: string
  orbitRadius: number   // px from center
  orbitSpeed: number    // radians per second
  orbitPhase: number    // starting angle in radians
  description: string
}

export const AGENTS: AgentCharacter[] = [
  {
    name: "coder",
    role: "CODER",
    character: "Ryland Grace",
    ship: "Hail Mary",
    emoji: "🚀",
    color: "#00ff87",
    orbitRadius: 180,
    orbitSpeed: 0.18,
    orbitPhase: 0,
    description: "Implements fixes, writes code, opens PRs, iterates on feedback.",
  },
  {
    name: "reviewer",
    role: "REVIEWER",
    character: "Rocky",
    ship: "Eridian Vessel",
    emoji: "🪨",
    color: "#fbbf24",
    orbitRadius: 240,
    orbitSpeed: 0.13,
    orbitPhase: Math.PI * 0.7,
    description: "Reviews PRs against the constitution. Approves or blocks. No compromise.",
  },
  {
    name: "pm",
    role: "PM",
    character: "Stratt",
    ship: "Command Station",
    emoji: "🛸",
    color: "#a78bfa",
    orbitRadius: 300,
    orbitSpeed: 0.09,
    orbitPhase: Math.PI * 1.3,
    description: "Decomposes tasks into a plan, sets maxRounds, injects focus areas and risk flags.",
  },
  {
    name: "tester",
    role: "TESTER",
    character: "Yao",
    ship: "Research Module",
    emoji: "🔬",
    color: "#f472b6",
    orbitRadius: 260,
    orbitSpeed: 0.11,
    orbitPhase: Math.PI * 1.9,
    description: "Writes Go tests for the fix, runs them, reports pass or fail.",
  },
  {
    name: "architect",
    role: "ARCHITECT",
    character: "Ilyukhina",
    ship: "Blueprint Pod",
    emoji: "📐",
    color: "#60a5fa",
    orbitRadius: 200,
    orbitSpeed: 0.15,
    orbitPhase: Math.PI * 0.4,
    description: "Designs file contracts and interfaces before the coder touches anything.",
  },
  {
    name: "scout",
    role: "SCOUT",
    character: "DuBois",
    ship: "Scout Probe",
    emoji: "🛰️",
    color: "#34d399",
    orbitRadius: 320,
    orbitSpeed: 0.07,
    orbitPhase: Math.PI * 1.1,
    description: "Scans GitHub issues and the codebase for bugs and violations to fix.",
  },
  {
    name: "product",
    role: "PRODUCT",
    character: "Lokken",
    ship: "Observatory",
    emoji: "🔭",
    color: "#fb923c",
    orbitRadius: 360,
    orbitSpeed: 0.05,
    orbitPhase: Math.PI * 0.2,
    description: "Reads user feedback, prioritises the backlog, writes the roadmap, queues features.",
  },
]

export const AGENT_MAP = Object.fromEntries(
  AGENTS.map((a) => [a.name, a]),
) as Record<AgentName, AgentCharacter>
