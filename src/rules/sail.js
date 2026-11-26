// How the Athanatoi move: solar sails. Pure rules, no pixels; every distance is in cm. Used by movement.js (which routes
// an Athanatoi ship here) and computer.js.
//
// Athanatoi ships do not use the normal movement rules. In short:
// - a ship turns first, to face ANY direction, and then goes straight; it keeps that facing until its next move;
// - its speed is one of its three printed speeds (front/rear/side) by which fire arc of the ship the sunward table edge
// lies in AFTER the turn; there is no minimum move, from zero up to that speed;
// - it moves in its Manoeuvre Phase and again in the Ordnance Phase of its OWN turn, after the ordnance has moved;
// - Lock On: no turn in either of the two moves; no All Ahead Full, Burn Retros, Come To New Heading, ramming.
//
// The engine API for the view is at the bottom: sailBands, sailOptions, sailMove, secondMoveProblem (and moveShip/checkMove
// in movement.js, which route an Athanatoi ship here, so the old straight-move code still works for it).
import { d6 } from './dice.js'
import { norm } from './geometry.js'
import { say, orderOf, isCrippled } from './game.js'
import { SUN_DIR, ensureSunward, cloudCheck } from './effects.js'
import { clouds, firstTouch, touchesBase } from './terrain.js'
import { baseR } from './game.js'
import { damageShip } from './damage.js'
import { wellTurn } from './terrain.js'
import { trace, firstBlastContact, runPath, refusal, lowOrbitProblem } from './movement.js'

const EPS = 1e-4
const round1 = x => Math.round(x * 10) / 10

/** Does this ship sail by the sun? Only the Athanatoi's ships have a `sail` triple (data/fleets.js). */
export const isSailor = ship => !!ship.profile?.sail

// The four critical hits of the Athanatoi table that touch movement. The critical table may set one of these
// as a ship flag or as a crits key; both are read.
export const sailCrit = (ship, key) => !!(ship.crits?.[key] || ship[key])

const KEY = { front: 'sunFront', rear: 'sunRear', side: 'sunSide' }

/**
 * Which of the ship's fire arcs the sunward edge lies in when the ship points `heading`: the shortest line from
 * the ship's stem to the sunward edge is perpendicular to the edge, so only the heading matters, not the position. The arc
 * quarters: front within 45 degrees of the line, rear beyond 135, side between. Exactly on a boundary it is in
 * both arcs and the Athanatoi player picks one: two arcs are returned.
 */
export function sunwardArcs (edge, heading) {
  const a = Math.abs(norm(SUN_DIR[edge] - heading))   // 0..180 between the heading and the direction of the sunward edge
  if (a < 45 - EPS) return ['front']
  if (a <= 45 + EPS) return ['front', 'side']
  if (a < 135 - EPS) return ['side']
  if (a <= 135 + EPS) return ['side', 'rear']
  return ['rear']
}

/**
 * What takes cm off every one of the ship's speeds. Crippled -5 cm, Thrusters Damaged -10 cm, and
 * Mainsail Scarred, -5 cm on each of its speeds. Crippled still applies, because any normal rule the Athanatoi
 * rules do not change still holds for them.
 */
export function sailPenalties (ship) {
  const out = []
  if (isCrippled(ship)) out.push({ why: 'crippled', cm: 5 })
  if (ship.crits?.thrusters) out.push({ why: 'Thrusters Damaged', cm: 10 })
  if (sailCrit(ship, 'mainsailScarred')) out.push({ why: 'Mainsail Scarred', cm: 5 })
  return out
}

/** The three speeds of a ship now, after damage, before Blast Markers: [{ arc, printed, cm }]. */
export function sailBands (ship) {
  const lose = sailPenalties(ship).reduce((a, p) => a + p.cm, 0)
  return Object.keys(KEY).map(arc => ({ arc, printed: ship.profile.sail[KEY[arc]], cm: Math.max(0, ship.profile.sail[KEY[arc]] - lose) }))
}

/** The view's help for aiming: the sunward edge, its direction, and the heading range that gives each speed. */
export function sunBands (game, ship) {
  const edge = game.effects?.sunward ?? null
  if (!edge) return { edge: null, sunDir: null, bands: sailBands(ship) }
  const sunDir = SUN_DIR[edge]
  // the headings that give each speed: front within 45 degrees of the sunward direction, rear within 45 of the opposite, side between
  return { edge, sunDir, bands: sailBands(ship).map(b => ({ ...b,
    ranges: b.arc === 'front' ? [[sunDir - 45, sunDir + 45]] : b.arc === 'rear' ? [[sunDir + 135, sunDir + 225]] : [[sunDir + 45, sunDir + 135], [sunDir - 135, sunDir - 45]] })) }
}

/** The ordnance already in play must have moved before an Athanatoi ship's second move. */
export const ordnanceMoved = game => !game.ordnance.some(o => o.kind === 'wave' && !o.moved)

const sailedNow = (game, ship) => (ship.sailed && ship.sailed.round === game.round && ship.sailed.side === ship.side ? ship.sailed : null)

/**
 * Which move this would be, from the phase: 'first' in the Manoeuvre Phase, 'second' in the Ordnance Phase (after all
 * ordnance has moved). Null if neither.
 */
export const whichMove = game => game.phase === 'movement' ? 'first' : game.phase === 'ordnance' ? 'second' : null

/** Why this ship can't make its second move now, or null: own turn only, after ordnance, not with Mainsail Shredded, not after boarding. */
export function secondMoveProblem (game, ship) {
  if (game.phase !== 'ordnance') return 'the second move is made in the Ordnance Phase'
  if (ship.side !== game.active) return 'Athanatoi ships do not move in the Ordnance Phase of the enemy\'s turn'
  if (!ordnanceMoved(game)) return 'all attack craft must move first: the second move comes after any ordnance is moved'
  if (sailCrit(ship, 'mainsailShredded')) return 'Mainsail Shredded: it cannot move in the Ordnance Phase until repaired'
  const sd = sailedNow(game, ship)
  if (sd?.second) return 'it has already made its second move this turn'
  if (sd?.noSecond || ship.boarding) return 'it boarded in its Manoeuvre Phase, so it may not make its second movement'
  return null
}

/** Is the ship free to move at all now (the checks the other movement code makes)? A reason, or null. */
function standingProblem (game, ship, when) {
  if (!when) return 'ships move in their Manoeuvre Phase, and the Athanatoi again in their Ordnance Phase'
  if (when === 'first' && (game.phase !== 'movement' || ship.side !== game.active)) return 'ships move in their own Manoeuvre Phase'
  if (ship.state !== 'active') return 'it is not under power'
  if (ship.lockedWith) return 'it is locked in a boarding action'
  if (ship.standby) return 'it is on standby and may not move until it goes on alert'
  if (when === 'first' && ship.movedThisPhase) return 'it has already moved this phase'
  if (when === 'second') return secondMoveProblem(game, ship)
  return null
}

const lockedOn = ship => orderOf(ship) === 'lockOn' || (orderOf(ship) === 'brace' && ship.order.was?.kind === 'lockOn')

/**
 * Everything the rules say about turning to `heading` (degrees, 0 = +x, clockwise positive) and sailing straight on, for the
 * move that comes next (or opts.when). Reads only, rolls nothing, changes nothing. opts: { dist } a distance to test, { arc }
 * which arc to use when the sunward edge lies on a line between two (default the faster), { peek } do not roll a missing
 * sunward edge. Returns { ok, reasons[], when, heading, turn, edge, options[{arc, printed, cm}], arc, base, penalties[],
 * blastAt, slowed, max, min: 0, strain, path }:
 * base: the speed for the chosen arc after damage; max: the furthest it may go along this heading
 * (5 cm less if it meets a Blast Marker on the way); strain: the Superstructure roll its turn will cost.
 */
export function sailOptions (game, ship, heading, opts = {}) {
  const reasons = []
  const when = opts.when ?? whichMove(game)
  const bad = opts.noStanding ? null : standingProblem(game, ship, when)
  if (bad) reasons.push(bad)
  const edge = game.effects?.sunward ?? (opts.peek ? null : ensureSunward(game))
  const bands = sailBands(ship)
  const arcs = edge ? sunwardArcs(edge, heading) : ['side']   // no sunward edge known: the highest speed, which is every ship's third (side)
  const options = arcs.map(a => bands.find(b => b.arc === a))
  let pick = options.reduce((a, b) => b.cm > a.cm ? b : a)
  if (opts.arc) {
    const chosen = options.find(o => o.arc === opts.arc)
    if (chosen) pick = chosen
    else reasons.push(`the sunward edge is not on the ${opts.arc} arc line at that heading`)
  }
  const turn = norm(heading - ship.facing)
  // Lock On: no turning in either of the two moves
  if (lockedOn(ship) && Math.abs(turn) > EPS) reasons.push('on Lock On it cannot turn in either of its two moves')
  // Mast Lines Severed: a turn of at most 90° before the move
  if (sailCrit(ship, 'mastLines') && Math.abs(turn) > 90 + EPS) reasons.push(`Mast Lines Severed: it may turn only up to 90° before it moves, not ${round1(Math.abs(turn))}°`)
  const strain = sailCrit(ship, 'superstructure') && Math.abs(turn) > 45 + EPS
  // the Blast Marker reduction: moving through any Blast Marker (or away from one in contact at the start of
  // the move) takes 5 cm off, once. Found along the straight line this heading gives, at the full speed.
  const probe = trace({ pos: ship.pos, facing: heading }, [{ fwd: pick.cm }])
  const blastAt = firstBlastContact(game, { ...ship, facing: heading }, probe)
  const cap = Math.max(0, pick.cm - 5)
  const slowedAt = d => d > EPS && blastAt != null && blastAt <= d + EPS   // a ship that does not move at all moves through nothing
  let max = blastAt == null || blastAt > pick.cm + EPS ? pick.cm : blastAt <= cap + EPS ? cap : Math.max(cap, Math.floor((blastAt - 1e-6) * 10) / 10)
  max = Math.max(0, max)
  const d = opts.dist ?? 0
  const slowed = slowedAt(d)
  if (opts.dist != null) {
    if (d < -EPS) reasons.push('ships only move forward')
    const limit = slowed ? cap : pick.cm
    if (d > limit + EPS) reasons.push(`at that heading it can sail at most ${round1(limit)} cm${slowed ? ' (5 cm less for moving through Blast Markers)' : ''}`)
  }
  const path = trace({ pos: ship.pos, facing: heading }, [{ fwd: Math.max(0, d) }])
  return { ok: reasons.length === 0, reasons, when, heading, turn, edge, arcs, options, arc: pick.arc, base: pick.cm, printed: pick.printed,
    penalties: sailPenalties(ship), blastAt, slowed, max, min: 0, strain, path }
}

/**
 * Turn to `heading` and sail `dist` cm straight ahead in this phase's move: the Manoeuvre Phase's first move, or the Ordnance
 * Phase's second. opts: { dist, arc, board, endTurn }:
 * arc choose the speed when the sunward edge lies exactly on a line between two arcs;
 * board an enemy ship to declare boarding on, first move only (boarding in the Manoeuvre Phase forfeits the second move);
 * endTurn a gravity well's free turn at the end of the move, degrees towards the planet.
 * Returns { ok, reason } and a refused move changes nothing; else { ok, when, heading, distance, ... } and what runPath reports
 * (lost, destroyed, disengaged, rift, left). Every roll is in game.log: the Superstructure strain, the contacts on the way, the
 * Blast Marker test at the end of the move.
 */
export function sailMove (game, ship, heading, opts = {}) {
  const refuse = r => refusal(game, ship, r)
  const dist0 = opts.dist ?? 0
  // The Resolve check to ignore a gas or dust cloud, taken when the move meets one (once a turn). Taken only if the move is legal otherwise.
  if (ship.cloudOk?.round !== game.round && clouds(game).length && !sailOptions(game, ship, heading, { dist: dist0, arc: opts.arc, peek: true }).reasons.length) {
    const probe = trace({ pos: ship.pos, facing: heading }, [{ fwd: dist0 }])
    if (clouds(game).some(c => touchesBase(c.shape, ship.pos, baseR(ship)) || probe.segs.some(sg => firstTouch(c.shape, sg.a, sg.b, baseR(ship)) != null))) cloudCheck(game, ship)
  }
  const o = sailOptions(game, ship, heading, { dist: dist0, arc: opts.arc })
  if (!o.ok) return refuse(o.reasons.join('; '))
  const bad = lowOrbitProblem(game, ship, o.path.end)
  if (bad) return refuse(bad)
  if (opts.endTurn) {
    const w = wellTurn(game, o.path.end, heading)
    if (!w) return refuse('there is no gravity well to turn in there')
    if (Math.sign(opts.endTurn) !== w.sign || Math.abs(opts.endTurn) > w.max + 0.5) return refuse(`the free turn must be towards the planet, at most ${Math.round(w.max)}°`)
  }
  // Boarding is allowed in either move, but not once the ship has shot or launched ordnance this turn
  if (opts.board != null && o.when === 'second') {
    const launched = game.ordnance.some(w => w.side === ship.side && (w.from === ship.uid || w.fromAll?.includes(ship.uid)) && (w.fresh || w.launchKey === `${game.round}:${game.active}`))
    if (ship.fired || ship.sunburstFired || launched) return refuse('it has already shot or launched ordnance this turn, so it may not board')
  }
  const sd = sailedNow(game, ship) ?? (ship.sailed = { round: game.round, side: ship.side, first: null, second: null, noSecond: false })
  say(game, `${ship.name} ${o.when === 'first' ? 'first move' : 'second move, in the Ordnance Phase'}: turns ${Math.abs(o.turn) < EPS ? 'not at all' : `${round1(o.turn)}°`} to face ${round1(norm(heading))}°, sunward edge (${o.edge}) in its ${o.arcs.join('/')} arc${o.arcs.length > 1 ? `, on the line between two arcs, so it uses the ${o.arc} speed` : ''}: ${o.printed} cm${o.penalties.length ? ` less ${o.penalties.map(p => `${p.cm} for ${p.why}`).join(', ')} = ${o.base} cm` : ''}${o.slowed ? ', and 5 cm less for the Blast Markers on its way' : ''}`)
  ship.facing = heading   // It turns before it moves, and keeps that facing until the start of its next move
  let strain = null
  if (o.strain) {
    // Superstructure Damaged: a D6 for each turn over 45°, 1 extra damage on a 1
    const r = d6(game.rng)
    strain = { rolled: r, hit: r === 1 }
    say(game, `${ship.name}: Superstructure Damaged and a turn of ${round1(Math.abs(o.turn))}° (over 45°): rolled ${r}, 1 extra damage on a 1`)
    if (r === 1) damageShip(game, ship, 1, { what: 'the strain on its damaged superstructure', noCrits: true, noSave: true })   // damage from a critical never causes another and cannot be saved
    if (ship.state !== 'active') return { ok: true, destroyed: true, strain, when: o.when }
  }
  const c = { path: o.path, slowed: o.slowed, bmAt: o.blastAt, orbit: false }
  const r = runPath(game, ship, c, { sail: true, board: opts.board })
  const record = { heading, distance: ship.moved, arc: o.arc, turn: o.turn }
  if (o.when === 'first') { sd.first = record; sd.noSecond = opts.board != null && ship.boardSavedRound === game.round }   // Boarding in the Manoeuvre Phase forfeits the second move
  else { sd.second = record; ship.moved = (sd.first?.distance ?? 0) + (ship.moved ?? 0) }
  if (ship.state === 'active' && !r.rift && !r.disengaged && !r.left && !r.lost && opts.endTurn) {
    ship.facing += opts.endTurn
    say(game, `${ship.name} turns ${opts.endTurn}° towards the planet for free after its move`)
  }
  // Moving under 5 cm makes a ship a Defence target, Athanatoi included: the total of its two moves this turn
  // counts. The first move alone is shown until the second is made.
  if (ship.state === 'active' && ship.moved < 5 && (o.when === 'second' || sd.noSecond || sailCrit(ship, 'mainsailShredded'))) say(game, `${ship.name} moved ${round1(ship.moved)} cm in all this turn, under 5 cm, so it is shot at as a Defence`)
  return { ok: true, when: o.when, heading, turn: o.turn, arc: o.arc, base: o.base, distance: record.distance, total: ship.moved, strain, slowed: o.slowed, ...r }
}

// ---------------- the old shapes: legs, so moveShip and checkMove still serve an Athanatoi ship ----------------
/** [] | [{fwd}] | [{turn}] | [{turn},{fwd}] (+ a last gravity turn) -> { heading, dist, endTurn } or { problem }. */
function readLegs (ship, legs) {
  let i = 0, turn = 0, dist1 = 0, endTurn = 0
  if (legs[i]?.turn != null && !legs[i].gravity) turn = legs[i++].turn
  if (legs[i]?.fwd != null) dist1 = legs[i++].fwd
  if (legs[i]?.turn != null && legs[i].gravity) endTurn = legs[i++].turn
  if (i < legs.length) return { problem: 'an Athanatoi ship turns once, before it moves, and then sails straight ahead' }
  return { heading: ship.facing + turn, dist: dist1, endTurn: endTurn || undefined }
}

/** moveShip for an Athanatoi ship (movement.js routes here): its legs read as a turn then a straight run. */
export function sailFromLegs (game, ship, legs, opts = {}) {
  const l = readLegs(ship, legs)
  if (l.problem) return refusal(game, ship, l.problem)
  return sailMove(game, ship, l.heading, { dist: l.dist, endTurn: l.endTurn, board: opts.board, arc: opts.arc })
}

/** checkMove for an Athanatoi ship (movement.js routes here), in the shape the old straight-move code reads. */
export function sailCheck (game, ship, legs) {
  const l = readLegs(ship, legs)
  const heading = l.problem ? ship.facing : l.heading
  const o = sailOptions(game, ship, heading, { dist: l.problem ? undefined : l.dist, peek: true, noStanding: true })
  const reasons = l.problem ? [l.problem, ...o.reasons] : o.reasons
  return { ok: reasons.length === 0, reasons, min: 0, max: o.max, turns: 0, path: o.path, slowed: o.slowed, bmAt: o.blastAt, orbit: false, well: wellTurn(game, ship.pos, ship.facing), sail: o }
}
