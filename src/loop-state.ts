// Loop control state — pause/resume flag persisted on the local filesystem.
// Isolated from the rest of the system so CLI entry points (pause.ts, resume.ts)
// can import this without triggering transitive loads of the server/pipeline.
//
// The only control surface is this file on disk. The public HTTP API and web UI
// have READ access only, via /autonomous/status → getLoopStatus().

import { mkdirSync, readFileSync, writeFileSync } from "fs"
import { join } from "path"
import { homedir } from "os"

const STATE_DIR = join(homedir(), ".astrophage")
mkdirSync(STATE_DIR, { recursive: true })

export const LOOP_STATE_PATH = join(STATE_DIR, "loop-state.json")

export interface LoopControlState {
  paused: boolean
  pausedAt: string | null
  pauseReason: string | null
}

export function loadLoopControlState(): LoopControlState {
  try {
    const raw = readFileSync(LOOP_STATE_PATH, "utf8")
    const parsed = JSON.parse(raw) as Partial<LoopControlState>
    return {
      paused: !!parsed.paused,
      pausedAt: parsed.pausedAt ?? null,
      pauseReason: parsed.pauseReason ?? null,
    }
  } catch {
    return { paused: false, pausedAt: null, pauseReason: null }
  }
}

export function saveLoopControlState(s: LoopControlState): void {
  writeFileSync(LOOP_STATE_PATH, JSON.stringify(s, null, 2))
}
