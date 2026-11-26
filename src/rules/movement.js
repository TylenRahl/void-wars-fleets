// The Manoeuvre Phase: straight moves and turns, the minimum move, special orders, Blast Markers on
// the way, ramming, declaring boarding, running into torpedoes, and disengaging; at sea also running aground
// and collisions. Main exports: checkMove (what a move may be), moveShip (make it), trace, speedOf, turnDistance,
// resolveRam, disengage, runAground and the sea boarding helpers. Used by turn.js, sail.js, ordnance.js, phage.js,
// endPhase.js, computer.js and the battle screen.
//
// A move is a list of legs: { fwd: cm } goes straight ahead, { turn: degrees } turns on the spot (positive =
// clockwise / to starboard). Example: [{ fwd: 10 }, { turn: -45 }, { fwd: 8 }].
import { armourFrom, frontArmour } from './armour.js'
import { rollDice, sum, d6, d3, count } from './dice.js'
import { along, dist, firstContact, lerp, arcsContaining } from './geometry.js'
import { isReactive } from './hull.js'
import { say, isGhost, ignoresClouds, diceText as fmt, baseR, isEscort, isCrippled, orderOf, shipByUid, blastTouching, shieldsLeft,
  BLAST_R, shieldsOf, leadershipTest, enemiesOf, offerBrace, remainingHits, isBraced, hasMark, squadronOf, aheadFullDice, aheadFullSpec, isHulk } from './game.js'
import { damageShip } from './damage.js'
import { ordnanceTouchesShip, craftAttack, followCap } from './ordnance.js'
import { clouds, ofKind, firstTouch, touchesBase, wellsAt, wellTurn, shapeGap } from './terrain.js'
import { offLowTable, leaveLowTable } from './lowOrbit.js'
import { mineAttack } from './defences.js'
import { hitWithShields } from './damage.js'
import { isSailor, sailFromLegs, sailCheck } from './sail.js'
import { cloudCheck } from './effects.js'
import { ramSave } from './miragefield.js'
import { boardingSave } from './endPhase.js'
import { hasUp, hiveNear, isPhageShip, placeBlastCluster, placeBlastOnShip, leadershipOf, sporesOf } from './game.js'
import { beginInstinct, instinctReasons, contactAttack, hasContactWeapons, grappleLimit, carryPartner, refreshGrapples, controlled, grapplePartner } from './phage.js'
import { raceRule } from '../data/raceRules.js'
import { late as fortLate, dockContacts } from './fort.js'
import { firstHullHit, firstShoreHit, hullOf, hullOverlap, shoreOverlap, hullsAround, seaStandProblem } from './seaHull.js'   // Tides of the Archipelago: at sea a ship takes up its whole hull
const nav = ship => raceRule(ship.profile.fleet).navLd ? { ld: raceRule(ship.profile.fleet).navLd } : {}   // The Phage navigate on a default Resolve of 10
export { isSailor, sailBands, sunBands, sailOptions, sailMove, secondMoveProblem, ordnanceMoved } from './sail.js'

const EPS = 1e-6
// A battleship must move 15 cm before turning, a cruiser 10 cm, an escort may turn at any point.
export const turnDistance = s => isEscort(s) || raceRule(s.profile.fleet).noMinMove ? 0 : Math.max(0, (s.profile.type === 'battleship' ? 15 : 10) - (hasUp(s, 'vents') ? 5 : 0))   // More Discharge Vents, 5 cm less before turning
const isHulkShip = s => s.id === 'spacehulk' || !!s.profile?.hulk   // the derelict and the Rukka hulks: 10 cm straight, 45 degrees every second move

/** The ship's speed this phase before Blast Markers: crippled -5 cm, Thrusters Damaged -10 cm once. */
export function speedOf (ship) {
  if (ship.profile.lump) return 10   // Crippled or Blast Markers do not reduce a Lump's speed
  if (isHulkShip(ship)) return 10   // Exactly 10 cm, not reduced by blast markers or damage
  return Math.max(0, ship.profile.speed - (isCrippled(ship) ? 5 : 0) - (ship.crits.thrusters ? 10 : 0) - (ship.crits.leech ? 10 : 0) - (ship.crits.driveSlow ? 5 : 0) + (hasUp(ship, 'solar') ? 5 : 0) + (hasUp(ship, 'evil') || hasUp(ship, 'big') ? 5 : 0))   // Boy Racers and Big Boostas +5 cm: Drive Damaged, -5 cm: Solar Vanes +5 cm
}

/** Lay out the legs from the ship's position: the straight segments, the turns, and the final pose. */
export function trace (ship, legs) {
  let p = { ...ship.pos }, f = ship.facing, total = 0, sinceTurn = 0
  const segs = [], turns = []
  for (const leg of legs) {
    if (leg.fwd != null) {
      if (leg.fwd < 0) throw new Error('ships only move forward')
      const q = along(p, f, leg.fwd)
      segs.push({ a: p, b: q, from: total, len: leg.fwd, facing: f })
      p = q; total += leg.fwd; sinceTurn += leg.fwd
    } else if (leg.turn != null) {
      // a gravity well's free turn doesn't count as the ship's turn and needs no distance first
      turns.push({ angle: leg.turn, after: sinceTurn, at: total, gravity: !!leg.gravity, pos: p, facing: f })
      f += leg.turn
      if (!leg.gravity) sinceTurn = 0
    }
  }
  return { segs, turns, end: p, facing: f, total }
}

/** The first point on the path where the ship's base touches a Blast Marker, as a distance along it, or null. */
export function firstBlastContact (game, ship, path) {
  if (blastTouching(game, ship).length) return 0   // Moving away from markers it touches counts
  let best = null
  for (const s of path.segs) for (const m of game.blast) {
    const t = firstContact(s.a, s.b, baseR(ship), m, BLAST_R)
    if (t != null) { const d = s.from + t * s.len; if (best == null || d < best) best = d }
  }
  for (const s of path.segs) for (const c of (ignoresClouds(game, ship) ? [] : clouds(game))) {   // a gas/dust cloud is a Blast Marker in all respects
    const t = firstTouch(c.shape, s.a, s.b, baseR(ship))
    if (t != null) { const d = s.from + t; if (best == null || d < best) best = d }
  }
  // Flying through spores counts as a Blast Marker (once a move); the spores are taken to be the base of an enemy Phage ship with brood cysts
  for (const sp of game.ships ?? []) if (sp !== ship && sp.side !== ship.side && sp.state === 'active' && sp.pos && sporesOf(sp) > 0) for (const sg of path.segs) {
    const t = firstContact(sg.a, sg.b, baseR(ship), sp.pos, baseR(sp))
    if (t != null) { const d = sg.from + t * sg.len; if (best == null || d < best) best = d }
  }
  return best
}

/**
 * What this move is allowed: { min, max, turns, needFull, reasons[] } and whether `legs` keep to it ({ ok }).
 * At least half speed unless Burn Retros; if it can't make half speed it moves as far as it can.
 * The orders' speed and turn limits. -5 cm when moving through Blast Markers (once).
 * On All Ahead Full, a Blast Marker met in the last 5 cm stops the ship where it touches.
 */
export function checkMove (game, ship, legs, { noInstinct = false } = {}) {
  if (isSailor(ship)) return sailCheck(game, ship, legs)   // Sailing replaces the normal movement rules
  const path = trace(ship, legs)
  const order = orderOf(ship) === 'brace' ? ship.order.was?.kind ?? null : orderOf(ship)
  const reasons = []
  let speed = speedOf(ship)
  const bmAt = isHulkShip(ship) || ship.profile.lump || isReactive(ship) ? null : firstBlastContact(game, ship, path)   // A reactive hull is immune to Movement modifiers from blast markers and clouds
  const slowed = bmAt != null
  let max = speed + (order === 'aheadFull' ? ship.order.extra ?? ship.order.was?.extra ?? 0 : 0)
  const full = max
  if (slowed) max = Math.max(0, max - 5)
  let min = order === 'burnRetros' || (raceRule(ship.profile.fleet).noMinMove && !isEscort(ship)) ? 0 : speedOf(ship) / 2   // Thnitoi cruisers have no minimum move
  let turnsAllowed = { aheadFull: 0, lockOn: 0, newHeading: 2, burnRetros: 1 }[order] ?? 1
  if (order === 'burnRetros') max = Math.min(max, speedOf(ship) / 2)
  if (order === 'aheadFull') {
    // must move the full distance; a Blast Marker met within the last 5 cm stops it at the marker
    min = max
    if (slowed && bmAt >= full - 5 - EPS) { min = max = bmAt }
  }
  // Derelict: always exactly 10 cm straight ahead, then a turn of up to 45° at most every second
  // Manoeuvre Phase (none if it turned in its last one)
  if (isHulkShip(ship)) { min = max = 10; turnsAllowed = ship.hulkTurned === game.round - 1 ? 0 : 1 }
  if (ship.thrustRoll && ship.thrustRoll.round === game.round && !ship.thrustRoll.pass) turnsAllowed = 0   // Thruster assemblies hit, the turn roll failed
  if (ship.profile.lump) { min = max = 10; turnsAllowed = 0 }   // A Lump always goes exactly 10 cm straight ahead and never turns
  // A ship in a gravity well may hold high orbit and not move (then it is shot at as a Defence)
  const orbit = !isHulkShip(ship) && wellsAt(game, ship.pos).length > 0 && order !== 'aheadFull'
  if (orbit) min = 0
  if (dockContacts(game, ship).length) min = 0   // Touching a friendly Bastion lets a ship stop, as in a gravity well
  if (ship.lowOrbit && !isHulkShip(ship)) min = 0   // Ships in low orbit don't have to move
  // Null-Mass Drive, a turn for every 20 cm travelled (and no turn in the first 20 cm)
  if (order === 'aheadFull' && isReactive(ship)) turnsAllowed = Math.floor(max / 20 + EPS)
  if (ship.crits.engine || ship.crits.driveFixed || ship.crits.vents) turnsAllowed = 0   // The Phage's discharge vents wounded, no turns
  // In a Massive Claws grip, a ship the same class or smaller cannot move; a larger one moves at half rate
  const grip = isPhageShip(ship) || ship.grapple != null ? grappleLimit(game, ship) : null
  if (grip?.stuck) { min = max = 0 } else if (grip?.half) { max = max / 2; min = min / 2 }   // Engine Room Damaged: Drive Damaged, may not change facing
  if (min > max) min = max                  // can't make half speed: move as far as it can
  if (path.total > max + EPS) reasons.push(`it can move at most ${max} cm${slowed ? ' (5 cm less for moving through Blast Markers)' : ''}`)
  if (path.total < min - EPS) reasons.push(order === 'aheadFull' ? `on All Ahead Full it must move exactly ${min} cm` : `it must move at least ${min} cm (half speed)`)
  const own = path.turns.filter(t => !t.gravity)
  path.turns.filter(t => t.gravity).forEach((t, i, g) => {
    // Only at the start or the end of the move, inside a well, towards the planet, no more than 45°
    // and no more than it takes to face the planet
    const first = path.turns[0] === t && t.at < EPS, last = path.turns.at(-1) === t && t.at > path.total - EPS
    if (!first && !last) return reasons.push('a gravity well\'s free turn comes only at the start or the end of the move')
    const w = wellTurn(game, t.pos, t.facing)
    if (!w) return reasons.push('there is no gravity well to turn in there')
    if (Math.sign(t.angle) !== w.sign || Math.abs(t.angle) > w.max + 0.5) reasons.push(`the free turn must be towards the ${w.planet.hulk ? 'derelict' : w.planet.moon ? 'moon' : 'planet'}, at most ${Math.round(w.max)}° (${w.planet.hulk ? '' : ''})`)
  })
  if (own.length > turnsAllowed) reasons.push(turnsAllowed === 0 ? `it can't turn this move${ship.crits.engine ? ' (Engine Room Damaged)' : ship.crits.driveFixed ? ' (Drive Damaged)' : isHulkShip(ship) ? ' (a derelict turns only every second Manoeuvre Phase)' : ` on ${order} orders`}` : `it can make at most ${turnsAllowed} turn${turnsAllowed > 1 ? 's' : ''}`)
  const need = ship.lowOrbit ? 0 : turnDistance(ship)   // No distance before turning in low orbit
  own.forEach((t, i) => {
    if (isHulkShip(ship)) {
      if (Math.abs(t.angle) > 45 + EPS) reasons.push('a derelict turns at most 45°')
      if (t.at < 10 - EPS) reasons.push('a derelict turns only at the end of its 10 cm')
      return
    }
    const maxTurn = ship.crits.fins ? Math.min(45, ship.profile.turns) : ship.profile.turns   // Turning Fins Dented, 45° at most
    if (Math.abs(t.angle) > maxTurn + EPS) reasons.push(`a turn of ${Math.abs(t.angle)}° is more than its ${maxTurn}° (${ship.crits.fins ? '' : ''})`)
    const free = order === 'burnRetros' && i === 0   // Burn Retros may turn without moving first
    if (order === 'aheadFull' && isReactive(ship)) { if (t.at < 20 * (i + 1) - EPS) reasons.push(`the Null-Mass Drive allows a turn for every 20 cm travelled: turn ${i + 1} comes after ${20 * (i + 1)} cm, not ${t.at}`); return }
    if (!free && t.after < need - EPS) reasons.push(`it must move ${need} cm before turning, it has moved ${t.after} cm`)
  })
  if (!noInstinct) reasons.push(...instinctReasons(game, ship, { path }))
  return { ok: reasons.length === 0, reasons, min, max, turns: turnsAllowed, path, slowed, bmAt, orbit, well: wellTurn(game, ship.pos, ship.facing) }
}

/**
 * Move `ship` along `legs` in its Manoeuvre Phase. opts.board: an enemy ship to board, which it must end touching
 *. Returns { ok, reason } — a refused move changes nothing.
 */
export function moveShip (game, ship, legs, opts = {}) {
  if (isSailor(ship)) return sailFromLegs(game, ship, legs, opts)   // The Athanatoi movement rules replace the normal ones
  const refuse = r => refusal(game, ship, r)
  if (game.phase !== 'movement' || ship.side !== game.active) return refuse('ships move in their own Manoeuvre Phase')
  if (ship.state !== 'active') return refuse('it is not under power')
  if (ship.movedThisPhase) return refuse('it has already moved this phase')
  if (ship.lockedWith) return refuse('it is locked in a boarding action')
  if (ship.profile.speed === 0) return refuse('it is a stationary defence and never moves')
  if (ship.standby) return refuse('it is on standby and may not move until it goes on alert')
  // A Thnitoi ship may take a Resolve check, once a turn, to ignore gas and dust clouds its move meets (the same check as the Athanatoi's)
  if (raceRule(ship.profile.fleet).celestialCheck && ship.cloudOk?.round !== game.round && clouds(game).length) {
    const probe = trace(ship, legs)
    if (clouds(game).some(cl => touchesBase(cl.shape, ship.pos, baseR(ship)) || probe.segs.some(sg => firstTouch(cl.shape, sg.a, sg.b, baseR(ship)) != null))) cloudCheck(game, ship)
  }
  // A Rukka hulk with thruster assembly criticals turns only if a D6 beats the number of those criticals; rolled
  // once a Manoeuvre Phase, the first time a move asks to turn (the preview in checkMove rolls nothing)
  if (ship.profile.hulk && ship.crits.hulkThrust && ship.thrustRoll?.round !== game.round && trace(ship, legs).turns.some(t => !t.gravity) && ship.hulkTurned !== game.round - 1) {
    const r = rollDice(game.rng, 1)[0]
    ship.thrustRoll = { round: game.round, pass: r > ship.crits.hulkThrust }
    say(game, `${ship.name}: thruster assemblies hit ${ship.crits.hulkThrust} time${ship.crits.hulkThrust === 1 ? '' : 's'}; turn roll ${r}, must be higher: ${ship.thrustRoll.pass ? 'it may turn' : 'it cannot turn this move'}`)
  }
  refreshGrapples(game)
  if (isPhageShip(ship)) beginInstinct(game, ship)   // Unless a queen ship took control of it, it follows Lost Scent
  const c = checkMove(game, ship, legs)
  if (!c.ok) return refuse(c.reasons.join('; '))
  if (isPhageShip(ship) && ship.instinct?.cond === 2 && !controlled(game, ship) && opts.board == null && ship.instinct.touch) opts = { ...opts, board: ship.instinct.enemy }   // It must initiate a boarding action if possible
  const bad = lowOrbitProblem(game, ship, c.path.end)
  if (bad) return refuse(bad)
  return runPath(game, ship, c, opts)
}
export const refusal = (game, ship, r) => ({ ok: false, reason: say(game, `${ship.name} can't make that move: ${r}`) })
/** Why a ship in low orbit can't end its move there, or null. */
export function lowOrbitProblem (game, ship, end) {
  if (!(ship.lowOrbit && offLowTable(end))) return null
  const edge = offLowTable(end)   // Landing, or leaving low orbit
  if (edge === 'planet' && !isEscort(ship)) return 'capital ships cannot land: it would crash on the planet'
  if (edge === 'other' && ship.lowEnteredRound === game.round) return 'a ship may not enter low orbit and leave it again in the same turn'
  return null
}

/**
 * Carry out a move that checkMove (or the Athanatoi's sailOptions) has passed: the contacts along the path, Blast Markers, the
 * table edge. opts.board: an enemy ship to board. opts.sail: an Athanatoi move, which does not set the Defence note itself.
 */
export function runPath (game, ship, c, opts = {}) {
  const start = ship.pos
  say(game, `${ship.name} moves ${round1(c.path.total)} cm${c.path.turns.length ? `, turning ${c.path.turns.map(t => `${t.angle}°`).join(' then ')}` : ''}${c.slowed ? ' through Blast Markers (-5 cm)' : ''}`)

  // things met along the way, in the order met: the ram target, enemy ordnance
  const events = []
  const ram = ship.order?.ram ?? ship.order?.was?.ram
  if (ram?.pass && !opts.sail) {   // the Athanatoi may not ram
    const t = shipByUid(game, ram.target)
    if (t && t.state === 'active' && game.sea) {   // at sea the ram strikes when the hulls meet (rules/seaHull.js)
      const h = firstHullHit(game, ship, c.path.segs, { endFacing: c.path.facing, only: [t] })
      if (h) events.push({ ...h, kind: 'ram', target: t })
    } else if (t && t.state === 'active') for (const s of c.path.segs) {
      const k = firstContact(s.a, s.b, baseR(ship), t.pos, baseR(t))
      if (k != null) { events.push({ at: s.from + k * s.len, kind: 'ram', target: t, seg: s, k }); break }
    }
  }
  for (const o of game.ordnance) for (const s of c.path.segs) {
    const k = firstContact(s.a, s.b, baseR(ship), o.pos, o.r)
    if (k != null) { events.push({ at: s.from + k * s.len, kind: 'ordnance', o, seg: s, k }); break }
  }
  // asteroid fields (one Resolve Test a move, however many it touches) and aether rifts
  const firstOf = kind => {
    let best = null
    for (const t of ofKind(game, kind)) for (const s of c.path.segs) {
      if (touchesBase(t.shape, s.a, baseR(ship)) && s.from === 0 && kind === 'asteroids') { best = best ?? { at: 0, seg: s, k: 0, t }; break }
      const d = firstTouch(t.shape, s.a, s.b, baseR(ship))
      if (d != null && (!best || s.from + d < best.at)) { best = { at: s.from + d, seg: s, k: s.len ? d / s.len : 0, t }; break }
    }
    return best
  }
  // Feeder tentacles and massive claws attack when the ship moves into contact with an enemy ship
  if (hasContactWeapons(ship)) for (const t of enemiesOf(game, ship)) for (const s of c.path.segs) {
    const k = firstContact(s.a, s.b, baseR(ship), t.pos, baseR(t))
    if (k != null) { events.push({ at: s.from + k * s.len, kind: 'contact', target: t, seg: s, k }); break }
  }
  const ast = firstOf('asteroids'), rift = firstOf('rift'), shore = firstShore(game, ship, c.path.segs, c.path.facing)
  if (shore) events.push({ ...shore, kind: 'aground' })
  const ramEvent = events.find(e => e.kind === 'ram')
  const hull = game.sea ? firstHullHit(game, ship, c.path.segs, { endFacing: c.path.facing, skip: ramEvent ? ramEvent.target.uid : null }) : null   // Tides of the Archipelago: ships at sea don't pass through each other
  if (hull) events.push({ ...hull, kind: 'collide' })
  if (ast) events.push({ ...ast, kind: 'asteroids' })
  if (rift) events.push({ ...rift, kind: 'rift' })
  events.sort((a, b) => a.at - b.at)
  let stopAt = null, shortBy = 0
  for (const e of events) {
    if (ship.state !== 'active') break
    ship.pos = e.pos ?? lerp(e.seg.a, e.seg.b, e.k); ship.facing = e.facing ?? e.seg.facing   // (at sea a hull stops at its last pose clear of what it hit)
    if (e.kind === 'contact') { const r = contactAttack(game, ship, e.target); if (r.grabbed && !grappleLimit(game, ship)?.half) { stopAt = e; break } }
    else if (e.kind === 'ram') { resolveRam(game, ship, e.target); if (game.sea && ship.state === 'active') { stopAt = e; pushClear(game, ship, e.target, ship.facing, e.at); break } }   // at sea the rammer stops, it can't sail on through
    else if (e.kind === 'collide') { stopAt = e; collide(game, ship, e.target, ship.facing, e.at); break }
    else if (e.kind === 'asteroids') shortBy = asteroidTest(game, ship) ? 0 : 5
    else if (e.kind === 'rift') { stopAt = e; enterRift(game, ship); break }
    else if (e.kind === 'aground') { stopAt = e; runAground(game, ship, e.t, e.at); break }
    else if (game.ordnance.includes(e.o)) {   // ordnance met on the way: mines attack, salvoes strike
      if (e.o.kind === 'mine') { if (e.o.side !== ship.side && !(ship.id === 'kat-pall' && !isCrippled(ship))) mineAttack(game, e.o, ship) }   // An uncrippled Pall never sets off orbital mines
      else if (e.o.kind !== 'wave') ordnanceTouchesShip(game, e.o, ship)
      else if (e.o.side !== ship.side) craftAttack(game, e.o, ship)
    }
  }
  if (ship.state === 'lost') return { ok: true, lost: true }
  if (ship.state !== 'active') return { ok: true, destroyed: true }
  if (stopAt) {
    ship.moved = stopAt.at; ship.movedThisPhase = true; followCap(game, ship)
    if (stopAt.kind === 'contact') { say(game, `${ship.name} is held in the grip and moves no further`); return { ok: true, grappled: true } }
    if (stopAt.kind === 'aground') return { ok: true, aground: true, island: stopAt.t.id }
    if (stopAt.kind === 'collide' || stopAt.kind === 'ram') return { ok: true, collided: true, with: stopAt.target.uid }
    return { ok: true, rift: true }
  }
  ship.pos = c.path.end; ship.facing = c.path.facing
  if (shortBy) {   // A ship hit by the asteroids is slowed 5 cm as if it had moved through Blast Markers
    const keep = Math.max(ast.at, c.path.total - shortBy)
    const seg = c.path.segs.find(s => keep <= s.from + s.len + EPS) ?? c.path.segs.at(-1)
    ship.pos = along(seg.a, seg.facing, keep - seg.from); ship.facing = seg.facing
    say(game, `${ship.name} is slowed 5 cm by the asteroid impacts`)
  }
  ship.moved = c.path.total; ship.movedThisPhase = true
  followCap(game, ship)
  if (ship.grapple != null) carryPartner(game, ship, start)   //
  // Ending a move on a ship with spores places a Blast marker in contact with the mover, away from the Phage
  for (const sp of game.ships) if (sp !== ship && isPhageShip(sp) && sp.state === 'active' && sp.pos && sp.profile.spores && !sp.crits.sporesHurt && !sp.crits.sporesGone && dist(sp.pos, ship.pos) <= baseR(sp) + baseR(ship) + EPS && ship.state === 'active') {
    placeBlastOnShip(game, ship, { x: 2 * ship.pos.x - sp.pos.x, y: 2 * ship.pos.y - sp.pos.y })
    say(game, `${ship.name} ends its move on ${sp.name}'s spores: a Blast marker is placed in contact with it`)
  }
  if (isHulkShip(ship)) hulkMoved(game, ship, start, c.path)
  else ship.orbiting = c.orbit && ship.moved < speedOf(ship) / 2 - EPS ? (wellsAt(game, ship.pos).find(w => w.hulk)?.hulk ?? null) : null   // holding orbit round a hulk // fighters on combat air patrol move with their ship
  // A ship with shields 0 moving through Blast Markers takes 1 damage on a 6, once a move
  if (c.slowed && shieldsOf(ship) === 0) {
    const r = d6(game.rng)
    say(game, `${ship.name} has no shields and moved through Blast Markers: rolled ${r}, damaged on a 6`)
    if (r === 6) damageShip(game, ship, 1, { what: 'Blast Markers' })
  }
  if (ship.state === 'active' && ship.lowOrbit && offLowTable(ship.pos)) { leaveLowTable(game, ship); followCap(game, ship); return { ok: true, left: true } }
  // A ship that moves off the table edge has disengaged
  if (ship.state === 'active' && !ship.lowOrbit && offTable(game, ship.pos)) {
    const p = ship.pos   // which edge (the Running the Cordon counts ships off the blockader's edge)
    ship.exitEdge = p.x > game.table.w ? 'right' : p.x < 0 ? 'left' : p.y < 0 ? 'top' : 'bottom'
    ship.state = 'disengaged'
    say(game, `${ship.name} moves off the table edge and has disengaged`)
    return { ok: true, disengaged: true }
  }
  if (opts.board != null) declareBoarding(game, ship, shipByUid(game, opts.board))
  game.hooks?.afterMove?.(game, ship)   // a scenario watching moves (the Convoy's Contacts)
  if (start && ship.moved < 5 && !opts.sail) say(game, `${ship.name} moved less than 5 cm, so it is shot at as a Defence`)
  return { ok: true }
}
const round1 = x => Math.round(x * 10) / 10

// Ships in a stationary orbit round the hulk move along with it; a ship breaking orbit must move before
// the hulk does (it gets no free move), so one of the hulk's own side still unmoved is carried and counts as having moved.
// The orbiting ships are carried the same distance; the hulk's 45° turn doesn't swing them round.
function hulkMoved (game, hulk, start, path) {
  if (path.turns.some(t => !t.gravity)) hulk.hulkTurned = game.round
  const dx = hulk.pos.x - start.x, dy = hulk.pos.y - start.y
  for (const s of game.ships) {
    if (s === hulk || s.orbiting !== hulk.uid || s.state !== 'active' || !s.pos) continue
    s.pos = { x: s.pos.x + dx, y: s.pos.y + dy }
    if (s.side === game.active && !s.movedThisPhase) { s.movedThisPhase = true; s.moved = 0 }
    followCap(game, s)
    say(game, `${s.name} is in orbit round ${hulk.name} and is carried along with it`)
  }
}

// A ship moving through or touching an asteroid field takes a Resolve Test on 2D6 (3D6 on All Ahead
// Full); escorts may re-roll; failed, D6 damage which shields block as normal but without Blast Markers.
// Squadrons: one test for the whole squadron in a turn, the first of its ships to touch the field takes it. A
// capital ship squadron that fails: each ship that touches the field takes D6 hits. An escort squadron re-rolls a failure
// for free; if it still fails, one D6 of hits is shared among the escorts that touch the field, in the order they move.
function asteroidTest (game, ship) {
  const aaf = orderOf(ship) === 'aheadFull' || ship.order?.was?.kind === 'aheadFull'
  const q = squadronOf(game, ship)
  let pass
  if (q && q.asteroids?.round === game.round && q.asteroids.side === game.active) {
    pass = q.asteroids.pass
    say(game, `${ship.name} touches the asteroid field: its squadron ${pass ? 'passed' : 'failed'} its test this turn`)
  } else {
    // an escort's own re-roll is its one re-roll of this test (no test re-rolled more than once)
    let t = leadershipTest(game, ship, { ...nav(ship), dice: aaf ? 3 : 2, why: `navigate the asteroid field${q ? ', for the whole squadron' : ''}`, reroll: !isEscort(ship) })
    if (!t.pass && isEscort(ship)) t = leadershipTest(game, ship, { ...nav(ship), dice: aaf ? 3 : 2, why: 'navigate the asteroid field — the escort\'s re-roll', reroll: false })
    pass = t.pass
    if (q) q.asteroids = { round: game.round, side: game.active, pass, pool: null }
  }
  if (pass) return true
  let n
  if (q && isEscort(ship)) {
    if (q.asteroids.pool == null) { q.asteroids.pool = d6(game.rng); say(game, `The squadron is struck by asteroids: D6 rolled ${q.asteroids.pool} hits, shared among the escorts that touch the field in the order they move`) }
    n = q.asteroids.pool
    if (!n) return false
  } else { n = d6(game.rng); say(game, `${ship.name} is struck by asteroids: D6 rolled ${n} hits`) }
  offerBrace(game, ship, { by: null, what: 'asteroids', key: `ast-${ship.uid}-${game.round}` })
  if (q && isEscort(ship)) {
    let used = 0
    while (used < n && ship.state === 'active') { hitWithShields(game, ship, 1, null, 'asteroid impacts', { noMarkers: true }); used++ }
    q.asteroids.pool = n - used
  } else hitWithShields(game, ship, n, null, 'asteroid impacts', { noMarkers: true })
  return false
}
// RUNNING AGROUND (Tides of the Archipelago, rules/core/12-tides-of-the-archipelago.md): a ship that sails into an island
// stops at the shore and takes D6 hits, no test; it is then moved clear and may turn any way so it does not strike again.
// The ship's whole hull counts, not its base (rules/seaHull.js), turns on the spot included: the ship stops at the last point clear of the shore. A ship already against the shore (it ran
// aground before) only strikes it again if the move takes it deeper.
const firstShore = (game, ship, segs, endFacing = null) => firstShoreHit(game, ship, segs, { endFacing })
// (exported for the tests and the battle screen) the ship takes D6 hits, is moved back clear of the shore, and faces away
// from the island; the player may then turn it any way with turnAfterAground before anything else happens
export const AGROUND_CLEAR = 1   // cm of open water left between the base and the shore
export function runAground (game, ship, island, at = null) {
  const n = d6(game.rng)
  say(game, `${ship.name} runs aground on an island${at != null ? ` after ${round1(at)} cm` : ''}: D6 rolled ${n} hits, and it stops at the shore (Tides of the Archipelago: a ship that sails into an island runs aground)`)
  offerBrace(game, ship, { by: null, what: 'running aground', key: `aground-${ship.uid}-${game.round}` })
  hitWithShields(game, ship, n, null, 'running aground', { noMarkers: true, noMarkersWhy: 'running aground, a Tides of the Archipelago house rule' })
  if (ship.state !== 'active') return
  // clear of the shore: it turns to face straight out from the island's centre, then goes that way until its whole hull
  // (rules/seaHull.js) is AGROUND_CLEAR cm off the shore and clear of every other ship, kept on the table
  const c = island.shape
  let a = Math.atan2(ship.pos.y - c.y, ship.pos.x - c.x)
  if (!Number.isFinite(a) || (ship.pos.x === c.x && ship.pos.y === c.y)) a = (ship.facing + 180) * Math.PI / 180
  ship.facing = ((a * 180 / Math.PI) % 360 + 360) % 360
  const onShore = () => shoreOverlap(hullOf(ship), c) > -AGROUND_CLEAR || hullsAround(game, ship).some(o => hullOverlap(hullOf(ship), hullOf(o)) > 0)
  for (let k = 0; k < 1500 && onShore(); k++) ship.pos = { x: Math.min(game.table.w - 0.5, Math.max(0.5, ship.pos.x + Math.cos(a) * 0.1)), y: Math.min(game.table.h - 0.5, Math.max(0.5, ship.pos.y + Math.sin(a) * 0.1)) }
  ship.aground = { round: game.round, island: island.id }
  say(game, `${ship.name} is pushed ${AGROUND_CLEAR} cm clear of the shore and faces away from the island; its player may turn it to face any way`)
}
// COLLISIONS AT SEA (Tides of the Archipelago): sailing into another ship, friend or foe, is an accidental ram. Both take
// damage weighted by relative size, the mover at a disadvantage since it did not mean to ram, and the mover is then set
// clear so it can sail on. Only when game.sea. The first point along the move where the mover's base touches another ship's base (its own squadron's ships
// move together, and are left out); a ship already touching only strikes again if the move takes it deeper.
// The whole hull counts, not the base (rules/seaHull.js firstHullHit): the mover stops at its last point clear.
// Sizes as the ram test's (game.js ramTestDice): escort, cruiser, battleship, defence.
const SIZE = { escort: 0, cruiser: 1, battleship: 2, defence: 3 }
/** At sea, would a path (checkMove's segs, then a last turn to endFacing) run into a ship or an island? For the battle screen's
 * boarding planner, so a Board pip never promises a move that ends in a collision or aground. Always false in space. */
export const pathBlocked = (game, ship, segs, endFacing = null) => !!game.sea && (segs?.length > 0 || endFacing != null) && !!(firstHullHit(game, ship, segs ?? [], { endFacing }) || firstShore(game, ship, segs ?? [], endFacing))
// back the way it came (facing: the way it was going) until its hull is AGROUND_CLEAR cm off the other's, no further back than it came
// (moved cm); if that is not enough (it started against the other) straight away from it instead, clear of every other ship and island
// too, kept on the table. Hulls, not bases (rules/seaHull.js).
function pushClear (game, ship, other, facing, moved = 0) {
  const gapTo = o => -hullOverlap(hullOf(ship), hullOf(o))
  const blocked = () => gapTo(other) < AGROUND_CLEAR || hullsAround(game, ship).some(o => o !== other && gapTo(o) < 0) || ofKind(game, 'island').some(t => shoreOverlap(hullOf(ship), t.shape) > 0)
  const step = a => { ship.pos = { x: Math.min(game.table.w - 0.5, Math.max(0.5, ship.pos.x + Math.cos(a) * 0.1)), y: Math.min(game.table.h - 0.5, Math.max(0.5, ship.pos.y + Math.sin(a) * 0.1)) } }
  const back = (facing + 180) * Math.PI / 180
  for (let k = 0; k < Math.ceil(moved / 0.1) && gapTo(other) < AGROUND_CLEAR; k++) step(back)
  let away = Math.atan2(ship.pos.y - other.pos.y, ship.pos.x - other.pos.x)
  if (!Number.isFinite(away) || (ship.pos.x === other.pos.x && ship.pos.y === other.pos.y)) away = back
  for (let k = 0; k < 1500 && blocked(); k++) step(away)
  ship.facing = facing
  ship.aground = { round: game.round, ship: other.uid }
  say(game, `${ship.name} is pushed ${AGROUND_CLEAR} cm clear of ${other.name}; its player may turn it to face any way`)
}
/** The damage of a collision at sea: by the ships' sizes, the mover always worse off (it was not a ram). Exported for the tests. */
export function collisionDice (mover, other) {
  const m = SIZE[mover.profile.type] ?? 1, o = SIZE[other.profile.type] ?? 1
  return m < o ? { mine: 'D6+2', theirs: '1' } : m === o ? { mine: 'D6', theirs: 'D3' } : { mine: 'D3', theirs: 'D6' }
}
function collide (game, ship, other, facing, moved) {
  const dice = collisionDice(ship, other), roll = t => t === 'D6+2' ? d6(game.rng) + 2 : t === 'D6' ? d6(game.rng) : t === 'D3' ? d3(game.rng) : +t
  const mine = roll(dice.mine), theirs = roll(dice.theirs)
  say(game, `${ship.name} collides with ${other.name}: ${dice.mine} rolled ${mine} hits on ${ship.name}, ${dice.theirs} ${dice.theirs === '1' ? 'hit' : `rolled ${theirs} hits`} on ${other.name} (Tides of the Archipelago: a ship that sails into another collides; the bigger ship suffers less, the one that moved more)`)
  game.onFx?.({ kind: 'collide', from: ship, to: other })   // the board's crash (battle/fx.js); drawing only
  offerBrace(game, ship, { by: null, what: 'the collision', key: `collide-${ship.uid}-${game.round}` })
  offerBrace(game, other, { by: ship, what: 'the collision', key: `collided-${other.uid}-${ship.uid}-${game.round}` })
  const why = { noMarkers: true, noMarkersWhy: 'a collision, a Tides of the Archipelago house rule' }
  hitWithShields(game, ship, mine, other.pos, `colliding with ${other.name}`, why)
  if (other.state === 'active' || isHulk(other)) hitWithShields(game, other, theirs, ship.pos, `${ship.name} colliding with it`, why)   // a hulk is hit too (damage.js hulkHit)
  if (ship.state === 'active') pushClear(game, ship, other, facing, moved)
}
/** At sea: why the ship can't be turned on the spot to that facing after running aground or a collision (its hull would swing
 * onto an island or another ship, rules/seaHull.js), or null. Keeping its heading is always allowed. */
export function afterAgroundProblem (game, ship, facing) {
  if (!game.sea || Math.abs(((facing - ship.facing) % 360 + 540) % 360 - 180) < 1e-6) return null
  const no = seaStandProblem(game, ship, ship.pos, facing)
  return no && `it can't turn that way: ${no}`
}
/** After running aground this turn, the player turns the ship to face any way. Once only. */
export function turnAfterAground (game, ship, facing) {
  if (!ship.aground || ship.aground.round !== game.round || ship.aground.turned) return { ok: false, reason: 'it has not run aground this turn' }
  const no = afterAgroundProblem(game, ship, facing)
  if (no) return { ok: false, reason: no }
  ship.facing = ((facing % 360) + 360) % 360
  ship.aground.turned = true
  say(game, `${ship.name} is turned to face ${Math.round(ship.facing)}° after ${ship.aground.ship != null ? 'the collision' : 'running aground'}`)
  return { ok: true }
}
// Moving into an aether rift takes a Resolve Test on 3D6. Passed: it may be repositioned up to 2D6x10 cm
// from the rift, pointing any way (the computer carries it on along its heading); failed: lost.
function enterRift (game, ship) {
  const t = leadershipTest(game, ship, { ...nav(ship), dice: 3, why: 'navigate the aether rift' })
  if (!t.pass) { ship.state = 'lost'; say(game, `${ship.name} is lost in the aether!`); return }
  const rd = rollDice(game.rng, 2), d = sum(rd) * 10
  let p = along(ship.pos, ship.facing, d)
  p = { x: Math.max(2, Math.min(game.table.w - 2, p.x)), y: Math.max(2, Math.min(game.table.h - 2, p.y)) }
  say(game, `${ship.name} passes through the rift and is thrown ${d} cm (2D6 rolled ${fmt(rd)}, x10)`)
  ship.pos = p
}
fortLate.enterRift = enterRift   // a Bastion' aetherbubble implosion draws ships into its rift
export const offTable = (game, p) => p.x < 0 || p.y < 0 || p.x > game.table.w || p.y > game.table.h

// ---------------- ramming ----------------
/**
 * Could this ship ram that target this turn? All Ahead Full makes no turns, so only what lies dead ahead, its base
 * touching the ship's straight path, within speed + the most its dice can add. Returns null, or { cm: distance to contact,
 * sure: true if even the lowest roll gets there, need: the extra cm it must roll, dice: how many D6 it rolls }.
 */
export function ramReach (ship, target) {
  const a = ship.facing * Math.PI / 180, dx = target.pos.x - ship.pos.x, dy = target.pos.y - ship.pos.y
  const ahead = dx * Math.cos(a) + dy * Math.sin(a), off = Math.abs(-dx * Math.sin(a) + dy * Math.cos(a)), R = baseR(ship) + baseR(target)
  if (ahead <= 0 || off > R) return null
  const cm = Math.max(0, ahead - Math.sqrt(R * R - off * off)), speed = speedOf(ship), { dice, mult } = aheadFullSpec(ship)
  if (ship.crits.nullmass) return null   //
  if (cm > speed + dice * 6 * mult) return null
  return { cm, sure: cm <= speed + dice * mult, need: Math.max(0, cm - speed), dice, mult }
}

function armourFacing (target, fromPos) {
  return armourFrom(target, fromPos)
}
export function resolveRam (game, ship, target) {
  const key = `ram-${ship.uid}-${game.round}`
  offerBrace(game, target, { by: ship, what: 'ramming', key })
  say(game, `${ship.name} rams ${target.name}!`)
  if (!ramSave(game, ship, target)) return   // a mirage field can turn the whole ram aside
  // Prow Ram: +1 to the Resolve check to ram, and 1 hit point of damage on the target before the ram dice are rolled
  if (hasUp(ship, 'pram') && target.state === 'active') { say(game, `${ship.name}'s Prow Ram tears into ${target.name}: 1 hit point before the ram dice are rolled`); damageShip(game, target, 1, { what: `the Prow Ram of ${ship.name}` }) }
  if (target.state !== 'active') return
  const need = armourFacing(target, ship.pos)
  // The Brute rolls 4 dice and the Grunt 2 against a ship it rams (the Grunt's listed 2D6 taken as two dice, like the Brute's four); every other ship one per starting hit
  const nRam = ship.profile.ramDice ?? ship.profile.hits
  const mine = rollDice(game.rng, nRam), hits = count(mine, need)
  say(game, `${ship.name} rolls ${ship.profile.ramDice ? 'its ram dice' : 'one dice per starting hit'} (${nRam}): ${fmt(mine)}, needed ${need}+ against its armour: ${hits} damage; shields don't stop rams`)
  // The rammed ship rolls half its starting hits against the rammer's front armour, or all of them head-on
  const headOn = arcsContaining(target.pos, target.facing, ship.pos).includes('front') && arcsContaining(ship.pos, ship.facing, target.pos).includes('front')
  const back = headOn || target.profile.type === 'defence' ? target.profile.hits : Math.ceil(target.profile.hits / 2)
  const theirs = rollDice(game.rng, back), backHits = count(theirs, frontArmour(ship))
  say(game, `${target.name} hits back with ${back} dice${headOn ? ' (head on, all its starting hits)' : ' (half its starting hits)'}: ${fmt(theirs)}, needed ${frontArmour(ship)}+ against the rammer's front armour: ${backHits} damage`)
  if (isBraced(ship) === false) offerBrace(game, ship, { by: target, what: 'ramming', key })
  damageShip(game, target, hits, { what: `ramming by ${ship.name}` })
  damageShip(game, ship, backHits, { what: `ramming ${target.name}` })
}

// ---------------- boarding is declared when the ships touch ----------------
export const touching = (a, b) => dist(a.pos, b.pos) <= baseR(a) + baseR(b) + EPS
// BOARDING AT SEA (Tides of the Archipelago): boarding is a short-ranged action, like a broadside, declared at the end of the
// move. Sea game only: the target within 15 cm, base edge to base edge, in the boarder's port or starboard arc (the guns'
// quarter arcs). Everything else about boarding follows the normal rules (rules/core/08-boarding-ramming-and-hit-and-run.md).
export const SEA_BOARD_RANGE = 15
export const boardReach = (a, b) => dist(a.pos, b.pos) - baseR(a) - baseR(b) <= SEA_BOARD_RANGE + EPS && arcsContaining(a.pos, a.facing, b.pos).some(x => x === 'left' || x === 'right')
/** May `a` board `b` from where it is: touching in space, in reach at sea. */
export const canBoardFrom = (game, a, b) => game.sea ? boardReach(a, b) : touching(a, b)
function declareBoarding (game, ship, target) {
  if (!target || target.side === ship.side || target.state === 'destroyed') { say(game, `${ship.name}: there is no enemy ship to board there`); return }
  if (!canBoardFrom(game, ship, target)) { say(game, game.sea ? `${target.name} is not within ${SEA_BOARD_RANGE} cm in ${ship.name}'s port or starboard arc, so it can't be boarded (Tides of the Archipelago)` : `${ship.name} is not touching ${target.name}, so it can't board it`); return }
  // Soulships (uncrewed), the Kalyx and the Duskhunter cannot start boarding actions
  if (isGhost(ship)) { say(game, `${ship.name} is a Soulship and may not initiate boarding actions`); return }
  if (ship.profile.rules?.noBoard) { say(game, `${ship.name} can't board: ${ship.profile.rules.noBoard}`); return }
  if (target.fort && !(ship.profile.hulk || ship.id === 'spacehulk')) { say(game, `${target.name} cannot be boarded: whole regiments would be needed, and only a derelict has the troops`); return }
  if (hasMark(target, 'endurance')) { say(game, `${target.name} bears the Endurance Protocol and may not be boarded`); return }
  // A Phage boarding places a Blast marker at the point where the two ships touch
  if (isPhageShip(ship)) { const a = Math.atan2(target.pos.y - ship.pos.y, target.pos.x - ship.pos.x) * 180 / Math.PI; placeBlastCluster(game, along(ship.pos, a, baseR(ship)), 1); say(game, `${ship.name} places a Blast marker where it touches ${target.name}`) }
  ship.boarding = target.uid
  boardingSave(game, ship, target)   // a mirage field saves as the boarding is declared
  if (ship.boarding == null) { ship.noFireRound = game.round; return }
  ship.noFireRound = game.round
  say(game, `${ship.name} will board ${target.name} in the End Phase, so it can't fire or launch ordnance this turn`)
}

// ---------------- disengaging ----------------
/**
 * At the end of its move, a ship may try to disengage: a Resolve Test, +1 per Blast Marker within 5 cm, -1 per
 * enemy ship or ordnance marker within 15 cm (celestial phenomena +3 aren't on the table yet). Passed: it leaves the
 * battle. Failed: no shooting, ordnance or special orders (except Brace) this turn.
 */
export function disengage (game, ship) {
  if (game.phase !== 'movement' || ship.side !== game.active || !ship.movedThisPhase || ship.state !== 'active') {
    return { ok: false, reason: say(game, `${ship.name} can only try to disengage at the end of its own move`) }
  }
  // A Phage ship needs two passes, synaptic control first and then a Resolve Test on its queen ship's Resolve; a ship held in claws cannot disengage
  let phageLd = {}
  if (isPhageShip(ship)) {
    if (grapplePartner(game, ship)) return { ok: false, reason: say(game, `${ship.name} is gripped by massive claws and cannot disengage`) }
    if (!controlled(game, ship)) return { ok: false, reason: say(game, `${ship.name} must first pass a synaptic control test to disengage`) }
    const h = hiveNear(game, ship, 1e9); phageLd = { ld: h ? leadershipOf(h) : raceRule('phage').defaultLd }
  }
  const bm = isReactive(ship) ? 0 : game.blast.filter(m => dist(m, ship.pos) <= 5 + EPS).length   // Immune to blast marker modifiers
  const near = enemiesOf(game, ship).filter(e => dist(e.pos, ship.pos) <= 15 + EPS).length +
    game.ordnance.filter(o => o.side !== ship.side && dist(o.pos, ship.pos) <= 15 + EPS).length
  const t = leadershipTest(game, ship, { ...phageLd, modifier: bm - near, why: `disengage (+${bm} for Blast Markers within 5 cm, -${near} for enemies within 15 cm)` })
  if (t.pass) { ship.state = 'disengaged'; game.onFx?.({ kind: 'wormhole', to: { ...ship.pos }, ship }); say(game, `${ship.name} disengages and leaves the battle`) }
  else { ship.disengageFailedRound = game.round; ship.noFireRound = game.round; say(game, `${ship.name} fails to disengage: no shooting, ordnance or special orders this turn`) }
  return { ok: true, pass: t.pass }
}

export { remainingHits }
