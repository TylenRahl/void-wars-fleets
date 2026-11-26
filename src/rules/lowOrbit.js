// Fighting in low orbit: a separate small table, one long edge of which is the planet. Used by the
// Planetary Assault and Worldbreak scenarios.
//
// The low orbit table lives in the same centimetres as the main table but far away from it (y from 1000), so no gun,
// torpedo, attack craft or Resolve effect can reach from one table to the other; the screen draws it below the main
// table. 120 x 45 cm (any size from 45-60 by 90-135 cm would also do); the planet edge is its bottom long edge.
// Exports LOW, PULL and the low orbit helpers (enterLowOrbit, lowOrbitPull, leaveLowTable, lowOrbitFires...), used by
// movement.js, shooting.js, ordnance.js, defences.js, turn.js, scenarios.js and the battle screen.
import { d6 } from './dice.js'
import { say, baseR, isEscort } from './game.js'
import { wellsAt } from './terrain.js'
import { dist, angleTo, along } from './geometry.js'

export const LOW = { x0: 0, y0: 1000, w: 120, h: 45 }
// At the start of each player's turn ships within 45 cm of the planet edge are pulled towards it
export const PULL = { small: 5, medium: 8, large: 10 }

export const inLowOrbit = s => !!s.lowOrbit
export const planetEdgeY = () => LOW.y0 + LOW.h
/** Set up a low orbit table for this planet (a terrain piece of kind 'planet'). */
export function addLowOrbit (game, planet) { game.lowOrbit = { ...LOW, planet: planet.id, size: planet.size } }
const planetOf = game => game.terrain.find(t => t.id === game.lowOrbit?.planet)

/** Off the edge of the table the ship is on? On the low orbit table, which edge: 'planet' or 'other'. */
export function offLowTable (p) {
  if (p.y > LOW.y0 + LOW.h) return 'planet'
  if (p.x < LOW.x0 || p.x > LOW.x0 + LOW.w || p.y < LOW.y0) return 'other'
  return null
}
export const onLowTable = p => p.y >= LOW.y0 - 100   // anything far down the y axis is on (or by) the low orbit table

/**
 * A ship within the planet's gravity well may enter low orbit at the start of its turn — before it moves —
 * placed on the low orbit table touching the edge furthest from the planet. x: where along that edge (cm from the left).
 */
export function enterLowOrbit (game, ship, x) {
  const refuse = r => ({ ok: false, reason: say(game, `${ship.name} can't enter low orbit: ${r}`) })
  const planet = planetOf(game)
  if (!planet) return refuse('there is no low orbit table in this battle')
  if (game.phase !== 'movement' || ship.side !== game.active || ship.movedThisPhase) return refuse('a ship enters low orbit at the start of its own turn, before it moves')
  if (ship.state !== 'active' || inLowOrbit(ship)) return refuse('it must be an active ship on the main table')
  if (ship.profile.speed === 0) return refuse('a stationary defence never moves')
  if (!wellsAt(game, ship.pos).some(w => w.id === planet.id)) return refuse('it must be within the planet\'s gravity well')
  if (ship.lowLeftRound === game.round) return refuse('it left low orbit this turn')
  const r = baseR(ship)
  ship.pos = { x: Math.max(LOW.x0 + r, Math.min(LOW.x0 + LOW.w - r, x ?? LOW.w / 2)), y: LOW.y0 + r }
  ship.lowOrbit = true; ship.lowEnteredRound = game.round; ship.orbiting = null
  say(game, `${ship.name} enters low orbit: it is placed on the low orbit table, touching the edge furthest from the planet`)
  return { ok: true }
}

/** At the start of each player's turn every ship in low orbit is pulled straight towards the planet;
 * pulled off the planet edge it is destroyed. */
export function lowOrbitPull (game) {
  if (!game.lowOrbit) return
  const d = PULL[game.lowOrbit.size] ?? 8
  for (const s of game.ships) {
    if (!inLowOrbit(s) || !s.pos || !['active', 'drifting', 'blazing'].includes(s.state)) continue
    s.pos = { x: s.pos.x, y: s.pos.y + d }
    if (offLowTable(s.pos) === 'planet') { s.state = 'destroyed'; s.lowOrbit = false; say(game, `${s.name} is dragged off the planet edge of the low orbit table and destroyed`) }
    else say(game, `${s.name} is pulled ${d} cm towards the planet by its gravity`)
  }
}

/**
 * A ship in low orbit ends its move off the low orbit table (movement.js asks). Off the planet edge: an escort or transport
 * has landed; a capital ship can't (the move is refused). Off another edge: it leaves low orbit and is placed on the main
 * table touching the planet — along the planet's side facing the table centre, as far round as it was along the edge
 *. Returns { refuse } or { done }.
 */
export function leaveLowTable (game, ship) {
  const edge = offLowTable(ship.pos)
  if (edge === 'planet') {
    if (!isEscort(ship)) return { refuse: 'capital ships cannot land: it would crash on the planet' }
    ship.state = 'landed'; ship.lowOrbit = false
    say(game, `${ship.name} moves off the planet edge and has landed`)
    return { done: true }
  }
  if (ship.lowEnteredRound === game.round) return { refuse: 'a ship may not enter low orbit and leave it again in the same turn' }
  const planet = planetOf(game), c = planet.shape
  const frac = Math.max(0, Math.min(1, (ship.pos.x - LOW.x0) / LOW.w))
  const towardCentre = angleTo(c, { x: game.table.w / 2, y: game.table.h / 2 })
  const a = towardCentre - 90 + frac * 180
  ship.pos = along(c, a, c.r + baseR(ship)); ship.facing = a
  ship.lowOrbit = false; ship.lowLeftRound = game.round
  say(game, `${ship.name} leaves low orbit and returns to the main table, its base touching the planet`)
  return { done: true }
}

/** In low orbit lances and sunburst cannon need a 4+ to fire. */
export function lowOrbitFires (game, ship, what) {
  if (!inLowOrbit(ship)) return true
  const r = d6(game.rng)
  say(game, `${ship.name} is in low orbit: its ${what} need${what.endsWith('s') ? '' : 's'} a 4+ to fire — rolled ${r}${r >= 4 ? '' : ', it can\'t fire'}`)
  return r >= 4
}

/** How far a ship in low orbit is from the planet edge. */
export const fromPlanetEdge = s => planetEdgeY() - s.pos.y
export { dist }
