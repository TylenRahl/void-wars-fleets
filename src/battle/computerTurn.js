// THE COMPUTER AT THE TABLE: runs rules/computer.js one action at a time through the page's own act, so the log, the dice, the
// gliding ships and the shots show exactly as when a player presses the buttons. It waits for every animation to finish and for any
// question put to the other (human) player, and pauses between actions so they can be followed.
// Exports createComputer and computerSides; used by battle.js.
// URL: ?computer=a | b | both (or the set-up page's "Computer plays"); &pause=ms between actions (default 900).
import { nextAction, applyAction } from '../rules/computer.js'

/**
 * opts: sides [0|1...]; getGame; run(fn, action) makes the action through battle.js act; next presses the phase button;
 * busy is true while anything is still animating or a question is on screen; pause ms; onOver.
 */
export function createComputer ({ sides, getGame, run, next, busy, pause = 900, onOver = () => {} }) {
  let timer = null, stopped = false, over = false
  const later = ms => { if (!stopped) timer = setTimeout(step, ms) }
  const wait = { move: 1, fire: 1.4, sunburst: 1.4, torpedo: 1, craft: 1, wave: 0.8, order: 0.8, place: 0.35, first: 1, skip: 0 }
  function step () {
    timer = null
    const g = getGame()
    if (!g) return later(400)
    if (g.over) { if (!over) { over = true; onOver(g) } return }
    if (busy()) return later(120)
    const order = g.phase === 'setup' ? [g.placing ?? g.firstChooser, 1 - (g.placing ?? g.firstChooser)] : g.phase === 'ordnance' ? [g.active, 1 - g.active] : [g.active]
    for (const side of order) {
      if (!sides.includes(side)) { if (g.phase === 'setup' && g.ships.some(x => !x.pos)) break; continue }   // set-up goes in turns: a human placing holds the computer
      const a = nextAction(g, side)
      if (a) { run(() => applyAction(g, a), a); return later(pause * (wait[a.kind] ?? 1)) }
    }
    // nothing left to do: the computer ends its own phases (the human presses Next in theirs)
    // (in the Ordnance Phase the other player's waves move after the active player's: a human's unmoved waves hold it until they press Next)
    const humanWaves = g.phase === 'ordnance' && g.ordnance.some(o => o.kind === 'wave' && !o.moved && !sides.includes(o.side))
    if (g.phase !== 'setup' && sides.includes(g.active) && !humanWaves) { next(); return later(pause) }
    later(300)
  }
  return {
    start () { stopped = false; if (!timer) later(pause) },
    stop () { stopped = true; clearTimeout(timer); timer = null },
    sides,
  }
}

/** ?computer=a|b|both -> the sides it plays. */
export const computerSides = v => v === 'both' ? [0, 1] : v === 'a' ? [0] : v === 'b' ? [1] : []
