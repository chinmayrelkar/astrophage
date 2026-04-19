// ─── Project Hail Mary character definitions ──────────────────────────────────

import type { AgentName } from "../hooks/useAgentStream"

export interface AgentCharacter {
  name: AgentName
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
    character: "Ryland Grace",
    ship: "Hail Mary",
    emoji: "🚀",
    color: "#00ff87",
    orbitRadius: 180,
    orbitSpeed: 0.18,
    orbitPhase: 0,
    description: "Astronaut-scientist. Implements fixes, writes code, iterates.",
  },
  {
    name: "reviewer",
    character: "Rocky",
    ship: "Eridian Vessel",
    emoji: "🪨",
    color: "#fbbf24",
    orbitRadius: 240,
    orbitSpeed: 0.13,
    orbitPhase: Math.PI * 0.7,
    description: "Alien engineer. Reviews code against the constitution. No compromise.",
  },
  {
    name: "pm",
    character: "Stratt",
    ship: "Command Station",
    emoji: "🛸",
    color: "#a78bfa",
    orbitRadius: 300,
    orbitSpeed: 0.09,
    orbitPhase: Math.PI * 1.3,
    description: "Mission director. Decomposes tasks, assigns work, drives convergence.",
  },
  {
    name: "tester",
    character: "Yao",
    ship: "Research Module",
    emoji: "🔬",
    color: "#f472b6",
    orbitRadius: 260,
    orbitSpeed: 0.11,
    orbitPhase: Math.PI * 1.9,
    description: "Crew specialist. Writes tests, runs them, reports truth.",
  },
  {
    name: "architect",
    character: "Ilyukhina",
    ship: "Blueprint Pod",
    emoji: "📐",
    color: "#60a5fa",
    orbitRadius: 200,
    orbitSpeed: 0.15,
    orbitPhase: Math.PI * 0.4,
    description: "Systems engineer. Designs interfaces and file contracts before coding starts.",
  },
  {
    name: "scout",
    character: "DuBois",
    ship: "Scout Probe",
    emoji: "🛰️",
    color: "#34d399",
    orbitRadius: 320,
    orbitSpeed: 0.07,
    orbitPhase: Math.PI * 1.1,
    description: "Scout. Finds bugs in code and GitHub issues, feeds the pipeline.",
  },
  {
    name: "product",
    character: "Lokken",
    ship: "Observatory",
    emoji: "🔭",
    color: "#fb923c",
    orbitRadius: 360,
    orbitSpeed: 0.05,
    orbitPhase: Math.PI * 0.2,
    description: "Product. Reads feedback, builds backlog, writes roadmap, queues features.",
  },
]

export const AGENT_MAP = Object.fromEntries(
  AGENTS.map((a) => [a.name, a]),
) as Record<AgentName, AgentCharacter>
