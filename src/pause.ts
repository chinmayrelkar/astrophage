// Local CLI — pause the autonomous loop.
// Runs on the host (not over HTTP). The server polls loop-state.json every
// ~5s and halts all Scout/Product cycles and queue dispatch while paused.
// In-flight pipeline runs complete naturally.
//
//   npm run pause                       # pause with no reason
//   npm run pause -- "maintenance"      # pause with a note

import { saveLoopControlState, LOOP_STATE_PATH } from "./loop-state.js"

const reason = process.argv.slice(2).join(" ").trim() || null

saveLoopControlState({
  paused: true,
  pausedAt: new Date().toISOString(),
  pauseReason: reason,
})

console.log(`[PAUSE] Autonomous loop paused${reason ? ` — ${reason}` : ""}`)
console.log(`[PAUSE] State file: ${LOOP_STATE_PATH}`)
console.log(`[PAUSE] The running server will halt new triggers within ~5s.`)
console.log(`[PAUSE] Resume with: npm run resume`)
