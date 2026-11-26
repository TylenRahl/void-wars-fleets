// The turn sequence: Movement, Shooting, Ordnance, End, then the other player's turn.
// Exports startBattle, nextPhase, checkOver, mimicMoves and the PHASES / PHASE_NAMES tables; battle.js drives the
// game through nextPhase, and computer.js uses it to play the computer's side.
import { say, active, onTable, isHulk } from './game.js'
import { derelictWreck } from './damage.js'
import { moveShip, checkMove, runPath } from './movement.js'
import { harpoonFuel, setDisguise, mimicWorks } from './thnitoi.js'
import { hasUp } from './game.js'
import { ordnancePhase, expireTorpedoes, autoMoveMissiles } from './ordnance.js'
import { endPhase } from './endPhase.js'
import { beginInstinct, deployOrdnance } from './phage.js'
import { startOfTurnEffects } from './effects.js'
import { rotateForts } from './fort.js'
import { lowOrbitPull } from './lowOrbit.js'
import { fallingDefences, clearDefenceBlast } from './defences.js'
import { scenarioTurnStart, scenarioTurnEnd, scenarioOver, scenarioResult } from './scenarios.js'

export const PHASES = ['movement', 'shooting', 'ordnance', 'end']
export const PHASE_NAMES = { setup: 'Set-up', movement: 'Manoeuvre', shooting: 'Fire', ordnance: 'Ordnance', end: 'End', over: 'Battle over' }

/** Start the battle: `first` takes the first turn (both roll a D6, the highest chooses). */
export function startBattle (game, first) {
  game.first = first; game.active = first; game.round = 1
  say(game, `${game.sides[first].name} takes the first turn`)
  deployOrdnance(game)
  mimicMoves(game)   // False-flag engines, one normal move after deployment, before either side has taken a turn
  beginMovement(game)
}

// The player removes last turn's special order markers, except Brace for Impact! (kept until the end
// of the ship's next turn); hulks drift.
function beginMovement (game) {
  game.phase = 'movement'
  if (game.active === game.first) startOfTurnEffects(game)   // flares and radiation bursts, each game turn
  rotateForts(game)           // a rotating fort turns 45 degrees
  lowOrbitPull(game)          // ships in low orbit are pulled towards the planet, each player's turn
  fallingDefences(game)       // defences that have lost their orbit fall towards the planet
  game.ordersFailed[game.active] = false
  for (const s of game.ships) {
    if (s.side !== game.active) continue
    s.movedThisPhase = false; s.fired = false; s.sunburstFired = false
    if (s.order && !(s.order.kind === 'brace' && s.order.until >= game.round)) s.order = null
    if (s.braceFailedKey) s.braceFailedKey = null
  }
  for (const s of onTable(game)) if (s.side === game.active && isHulk(s)) derelictWreck(game, s)
  harpoonFuel(game)   // At the start of the Thnitoi player's turn the Harpoons go home, out of fuel
  say(game, `Turn ${game.round}, ${game.sides[game.active].name}: Manoeuvre Phase`)
  if (game.sc) { scenarioTurnStart(game); checkOver(game) }
}

/**
 * False-flag engines: a Thnitoi ship with them gets one normal move after deployment, before either side's first turn. The player chooses the
 * move through game.decide.mimicMove(game, ship) -> legs (as for moveShip) or null; headless it stays put. No special orders. One normal move: the same limits as any move, a cruiser
 * with no minimum. Afterwards the ship is disguised if every enemy is more than 30 cm off.
 */
export function mimicMoves (game) {
  for (const s of game.ships.filter(x => x.pos && x.state === 'active' && hasUp(x, 'mimic'))) {
    if (!mimicWorks(game, s)) { say(game, `${s.name}'s false-flag engines have no effect against this fleet`); continue }
    const legs = game.decide.mimicMove?.(game, s)
    if (legs?.length) {
      const c = checkMove(game, s, legs)
      if (!c.ok) say(game, `${s.name} can't make that mimic move: ${c.reasons.join('; ')}`)
      else { runPath(game, s, c, {}); s.movedThisPhase = false; s.moved = null; say(game, `${s.name} makes its free mimic move`) }
    }
    setDisguise(game, s)
  }
}

/**
 * Finish the current phase and go to the next. Leaving the Manoeuvre Phase, every ship that hasn't moved goes straight
 * ahead its minimum distance (ships must move at least half speed). opts go to the End Phase (teleport attacks).
 */
export function nextPhase (game, opts = {}) {
  if (game.over) return
  if (game.phase === 'movement') {
    for (const s of active(game)) {
      if (s.side !== game.active || s.movedThisPhase || s.lockedWith || s.standby || s.profile.speed === 0) continue
      if (s.profile.fleet === 'phage') beginInstinct(game, s)   // A ship the Hunger did not move follows Lost Scent
      const r = moveShip(game, s, [{ fwd: minimumMove(s) }])
      if (!r.ok) say(game, `${s.name} could not make its minimum move`)
    }
    game.hooks?.endMovement?.(game)   // the Convoy's turned-over Contacts deploy now
    game.phase = 'shooting'
    say(game, 'Fire Phase')
  } else if (game.phase === 'shooting') {
    game.phase = 'ordnance'
    say(game, 'Ordnance Phase')
    ordnancePhase(game)
  } else if (game.phase === 'ordnance') {
    autoMoveMissiles(game)  // unsteered Isos missiles fly on 20 cm
    expireTorpedoes(game)   // torpedo bomber salvoes run out of fuel
    game.phase = 'end'
    say(game, 'End Phase')
    endPhase(game, opts)
    clearDefenceBlast(game)   // after everything else in the End Phase
    afterTurn(game)
  }
}
function minimumMove (s) { return checkMove({ blast: [], table: { w: 1e9, h: 1e9 } }, s, []).min }

function afterTurn (game) {
  if (game.sc) scenarioTurnEnd(game)
  if (checkOver(game)) return
  const second = 1 - game.first
  if (game.active === second) {
    if (game.round >= game.rounds) {
      game.over = true; game.phase = 'over'; say(game, `The battle ends after ${game.rounds} turns`)
      if (game.sc) game.result = scenarioResult(game, `the last of the ${game.rounds} turns is over`)
      return
    }
    game.round++
  }
  game.active = 1 - game.active
  beginMovement(game)
}

/** The battle ends when a side has no ships left under power on the table (as in the Cruiser Duel scenario). */
export function checkOver (game) {
  if (game.over) return true
  if (game.sc) {   // a scenario decides its own end (scenarios.js; reserves off the table still count as fighting)
    if (!scenarioOver(game)) return false
    game.over = true; game.phase = 'over'
    say(game, `The battle is over: ${game.result.why}. ${game.result.title}. ${game.result.text ?? ''}`)
    return true
  }
  for (const side of [0, 1]) {
    if (!active(game).some(s => s.side === side)) {
      game.over = true; game.phase = 'over'
      say(game, `${game.sides[side].name} has no ships left fighting: the battle is over`)
      return true
    }
  }
  return false
}
