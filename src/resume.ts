// Local CLI — resume the autonomous loop.
// Clears the paused flag in loop-state.json; the running server polls every
// ~5s and resumes Scout/Product cycles plus queue dispatch.

import { saveLoopControlState, LOOP_STATE_PATH } from "./loop-state.js"

saveLoopControlState({
  paused: false,
  pausedAt: null,
  pauseReason: null,
})

console.log(`[RESUME] Autonomous loop resumed`)
console.log(`[RESUME] State file: ${LOOP_STATE_PATH}`)
console.log(`[RESUME] The running server will fire Scout/Product on next tick.`)
