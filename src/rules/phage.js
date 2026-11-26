// THE PHAGE FLEET'S OWN RULES: Synaptic control, Lost Scent, shooting priority, searbile, feeder tentacles, massive claws and
// the grapple, All Is Lost, the fleet's hive-mind set-up. Spores, criticals and the catastrophic table are in game.js and phageDamage.js; the Gulper's save is hull.js.
// Everything here is a pure rule: it reads and changes the game state and writes every roll to the log.
// Exports isPhage, the targeting helpers (highlighted, phageTargets, phageScreened), bioplasmaFire, the scent and instinct rules,
// the contact and grapple rules, allIsLost, applyPhage and deployOrdnance; used by shooting.js, movement.js, turn.js, endPhase.js,
// listCheck.js, cruiserClash.js and the battle screen.
import { rollDice, count, d6 } from './dice.js'
import { dist, arcsContaining, along, firstContact } from './geometry.js'
import { say, diceText as fmt, active, enemiesOf, shipByUid, mates, baseR, isEscort, isCapital, isBraced, isCrippled, isHulk, leadershipOf, leadershipTest, commandModifiers, offerBrace,
  hiveNear, squadronOf, aheadFullDice, ORDERS, hasUp } from './game.js'
import { damageShip, catastrophic } from './damage.js'
import { fieldSave } from './miragefield.js'
import { hitAndRun } from './endPhase.js'
import { weaponWorks, canReach } from './shooting.js'
import { checkMove, turnDistance, speedOf } from './movement.js'
import { ofKind, firstTouch, shapeGap } from './terrain.js'
import { raceRule } from '../data/raceRules.js'

export const isPhage = s => s?.profile?.fleet === 'phage'
const EPS = 1e-6
const SIZE = { escort: 0, cruiser: 1, battleship: 2, defence: 3 }   // size classes compared exactly as for ramming

// ======================================== SHOOTING ========================================
const vanguards = (game, side) => active(game).filter(v => v.side === side && v.profile.vanguard)
/** True if `pos` is within 15 cm of a friendly Forerunner drone other than the firer: any Phage ship may then shoot at it, no Resolve Test needed. */
export const highlighted = (game, firer, pos) => vanguards(game, firer.side).some(v => v !== firer && dist(v.pos, pos) <= 15 + EPS)
/**
 * Phage ships always shoot at the nearest enemy ship, with no Resolve Test to pick another, unless a Forerunner drone highlights a different
 * enemy. Ordnance is never a target, except markers a Vanguard highlights (it marks every enemy, ordnance included, within 15 cm of itself).
 * A shot at anything else goes to the nearest enemy that weapon can reach (the rules leave a refused shot open, so the game redirects it).
 */
export function phageTargets (game, plan, strays) {
  const out = []
  for (const s of plan) {
    if (!isPhage(s.by)) { out.push(s); continue }
    if (typeof s.target === 'object') {
      const o = game.ordnance.find(x => x.id === s.target.ordnance)
      if (o && highlighted(game, s.by, o.pos)) out.push(s)
      else say(game, `${s.by.name}: Phage ships ignore ordnance unless a Forerunner drone highlights it, so that shot is not fired`)
      continue
    }
    const t = shipByUid(game, s.target)
    if (strays(s) && !(t && highlighted(game, s.by, t.pos))) {
      const n = enemiesOf(game, s.by).filter(e => canReach(s.by, s.by.profile.weapons[s.weapon], e.pos)).sort((a, b) => dist(a.pos, s.by.pos) - dist(b.pos, s.by.pos))[0]
      say(game, `${s.by.name} must fire at the nearest enemy${n ? `, ${n.name}` : ''}: no Resolve Test may be taken to pick another`)
      if (n) out.push({ ...s, target: n.uid })
    } else out.push(s)
  }
  return out
}
/** Is `target` a queen ship with a squadron of only Picket drones in base contact with it and between it and `firer`? ("in between": the squadron's ship stands on the line from firer to queen ship.) */
export function phageScreened (game, firer, target) {
  if (!target?.profile?.hive || !target.pos) return false
  return game.squadrons.some(q => {
    const ships = q.uids.map(u => shipByUid(game, u)).filter(x => x?.state === 'active' && x.pos)
    if (!ships.length || !ships.every(x => x.profile.drone) || ships[0].side !== target.side) return false
    return ships.some(x => dist(x.pos, target.pos) <= baseR(x) + baseR(target) + EPS && segNear(firer.pos, target.pos, x.pos, baseR(x)))
  })
}
const segNear = (a, b, p, r) => { const dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy || 1, k = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / L2)); return Math.hypot(a.x + dx * k - p.x, a.y + dy * k - p.y) <= r }

/**
 * Searbile works as a lance: one D6 per point of Strength, a hit on 4+ whatever the armour. It passes through shields and turrets cannot shoot
 * it down, but mirage fields and reactive hull saves still apply. Lock On re-rolls the misses as for any lance. entries: [{ by, str }].
 */
export function bioplasmaFire (game, target, entries, lockOn) {
  const str = entries.reduce((a, e) => a + e.str, 0), dice = rollDice(game.rng, str)
  let hits = count(dice, 4), text = `rolled ${fmt(dice)}, needed 4+`
  if (lockOn && hits < str) { const re = rollDice(game.rng, str - hits); hits += count(re, 4); text += `; Lock On re-rolls the misses: ${fmt(re)}` }
  say(game, `${[...new Set(entries.map(e => e.by.name))].join(' and ')} fire searbile (strength ${str}) at ${target.name}: ${text}: ${hits} hit${hits === 1 ? '' : 's'}, shields ignored`)
  game.onFx?.({ kind: 'lance', from: [...new Set(entries.map(e => e.by))], to: target, hits, side: entries[0].by.side, shots: [] })
  const through = fieldSave(game, target, hits, { what: 'searbile', from: entries[0].by.pos, by: entries[0].by, braceAsked: true }).through
  return { hits, damage: damageShip(game, target, through, { what: 'searbile' }) }
}

// ======================================== SYNAPTIC CONTROL ========================================
const listOf = (game, side) => game.sides[side].list
/** The queen ships that may still try synaptic control over `target` this turn: within 45 cm of it (nearest ship of a squadron), not failed already. */
export function scentHives (game, target) {
  const near = mates(game, target)
  return active(game).filter(h => h.side === target.side && h.profile.hive && h.scentFailedRound !== game.round &&
    near.some(m => dist(h.pos, m.pos) <= raceRule('phage').scent + EPS))
}
/**
 * Each queen ship may take a Command check to override Lost Scent, for itself or for a ship or squadron within 45 cm. On a pass the Phage player
 * controls that ship or squadron and may give it special orders with no second check. A failure ends that hive
 * ship's attempts for the turn; another queen ship may still try, also for a ship that failed. A Vanguard fleet's squadron tests its own Resolve instead.
 */
export function scent (game, targetUid, hiveUid = null) {
  const t = shipByUid(game, targetUid), refuse = r => ({ ok: false, reason: say(game, `Synaptic control of ${t?.name ?? 'that ship'}: ${r}`) })
  if (!t || !isPhage(t) || t.state !== 'active') return refuse('not a Phage ship')
  if (game.phase !== 'movement' || t.side !== game.active) return refuse('only in your own Manoeuvre Phase')
  if (mates(game, t).some(m => m.movedThisPhase)) return refuse('it has moved already')
  if (t.control?.round === game.round) return { ok: true, already: true }
  if (t.crits.scent) return refuse('its scent is severed: the Hunger cannot override its instinct')
  const lead = listOf(game, t.side) === 'vanguard'
  if (lead) {
    const q = mates(game, t), ld = Math.min(10, q.length)
    if (q.some(m => m.vanguardTried === game.round)) return refuse('this squadron has tried already')
    for (const m of q) m.vanguardTried = game.round
    const test = leadershipTest(game, t, { ld, command: true, modifier: commandModifiers(game, t).total, why: `Lost Scent override by ${t.name}'s squadron (Resolve ${ld}, the ships left in it)` })
    return take(game, t, test.pass, null)
  }
  const options = scentHives(game, t), hive = hiveUid != null ? options.find(h => h.uid === hiveUid) : options[0]
  if (!hive) return refuse('no queen ship within 45 cm is able to try')
  const m = commandModifiers(game, hive)
  const test = leadershipTest(game, hive, { command: true, modifier: m.total, why: `Synaptic control by ${hive.name} over ${t.name}${m.under ? ', under fire -1' : ''}${m.contacts ? ', enemy contacts +1' : ''}` })
  if (!test.pass) hive.scentFailedRound = game.round
  return take(game, t, test.pass, hive)
}
function take (game, t, pass, hive) {
  if (!pass) { say(game, `${hive ? hive.name + ' fails' : 'The override fails'}: ${t.name} acts on Lost Scent${hive ? ', and that queen ship can try no more this turn' : ''}`); return { ok: true, pass: false } }
  for (const m of mates(game, t)) { m.control = { round: game.round, by: hive?.uid ?? null }; m.instinct = null }
  say(game, `${t.name} is under the Hunger's control this turn: it may take any special order without a second Command check`)
  return { ok: true, pass: true }
}
export const controlled = (game, s) => s.control?.round === game.round

// ======================================== LOST SCENT ========================================
const PHENOMENA = ['asteroids', 'rift', 'cloud']
const hitsPhenomena = (game, ship, a, b) => [...PHENOMENA.flatMap(k => ofKind(game, k)), ...(game.terrain ?? []).filter(t => t.minefield)].some(t => firstTouch(t.shape, a, b, baseR(ship)) != null)
/** The first Lost Scent condition that is true for this ship, top to bottom. Pure: no dice. */
export function instinct (game, ship, { skipContact = false } = {}) {
  const speed = speedOf(ship), enemies = enemiesOf(game, ship).filter(e => e.pos)
  if (hitsPhenomena(game, ship, ship.pos, along(ship.pos, ship.facing, speed))) return { cond: 1, order: 'burnRetros', text: 'normal movement would take it into dangerous celestial phenomena: Burn Retros, and a turn must be made away from them' }
  const near = enemies.sort((a, b) => dist(a.pos, ship.pos) - dist(b.pos, ship.pos))[0]
  const front = near && arcsContaining(ship.pos, ship.facing, near.pos).includes('front')
  const d = near ? dist(near.pos, ship.pos) : Infinity
  if (front && d < 15 && !skipContact) return { cond: 2, order: null, enemy: near.uid, text: `${near.name} is in the front arc and under 15 cm away: it must move into contact and board if possible` }
  if (front && d > 90) return { cond: 3, order: 'aheadFull', text: `${near.name} is in the front arc and over 90 cm away: All Ahead Full (+2D6 cm instead of +4D6)` }
  if (isEscort(ship) && near && arcsContaining(ship.pos, ship.facing, near.pos).includes('rear')) return { cond: 4, order: 'newHeading', text: `${near.name} is in its rear arc: Come to New Heading` }
  if (front && ship.profile.weapons.some(w => w.kind === 'bioplasma' && weaponWorks(ship, w) && canReach(ship, w, near.pos))) return { cond: 5, order: 'lockOn', text: `${near.name} is in the front arc and in reach of its searbile: Lock On` }
  if ((ship.profile.weapons.some(w => w.kind === 'bays') && !ship.loaded.bays) || (ship.profile.weapons.some(w => w.kind === 'bio-torpedo') && !ship.loaded.torpedo)) return { cond: 6, order: 'reload', text: 'its ordnance needs reloading: Reload Ordnance' }
  const planet = ofKind(game, 'planet')[0], hive = ship.profile.drone ? hiveNear(game, ship, 1e9) : null
  const goal = hive ? { pos: hive.pos, r: baseR(hive), name: hive.name } : planet ? { pos: planet.shape, r: planet.shape.r, name: planet.moon ? 'the moon' : 'the planet' } : null
  return { cond: 7, order: null, goal, text: goal ? `nothing else applies: no special order, and it must end its move closer to ${goal.name} if it can` : 'nothing else applies: no special order, half speed straight ahead' }
}

/**
 * The start of a Phage ship's (or squadron's) move when the Hunger has not taken it: read the flowchart, give it the order it names, and remember the limits on its move.
 * No Command check is needed for these orders. A braced ship keeps its Brace order but still obeys the movement limits. Idempotent for the turn.
 */
export function beginInstinct (game, ship) {
  if (!isPhage(ship) || ship.state !== 'active' || controlled(game, ship) || ship.instinct?.round === game.round) return ship.instinct ?? null
  const q = mates(game, ship), lead = q.find(m => !m.movedThisPhase) ?? ship
  const inst = { ...instinct(game, lead, { skipContact: !!game.decide.skipContact?.(game, lead) }), round: game.round }
  say(game, `${q.length > 1 ? 'The squadron' : ship.name} acts on Lost Scent, condition ${inst.cond}: ${inst.text}`)
  for (const m of q) {
    m.instinct = { ...inst }
    if (inst.order && !isBraced(m) && !m.order) setOrder(game, m, inst.order)
  }
  inst.touch = inst.cond === 2 ? touchPlan(game, lead, shipByUid(game, inst.enemy)) : null
  inst.canClose = inst.cond === 7 && inst.goal ? closerPossible(game, lead, inst.goal) : false
  for (const m of q) m.instinct = { ...inst }
  return inst
}
function setOrder (game, ship, kind) {
  ship.order = { kind, round: game.round, side: game.active }
  if (kind === 'aheadFull') {
    // Under instinct All Ahead Full adds +2D6 cm, not +4D6; Adrenaline Sacs add +1D6 either way
    const n = 2 + (hasUp(ship, 'adrenaline') ? 1 : 0), dice = rollDice(game.rng, n)
    ship.order.extra = dice.reduce((a, b) => a + b, 0)
    say(game, `${ship.name}: All Ahead Full on instinct, +${n}D6 cm rolled ${fmt(dice)} = +${ship.order.extra} cm`)
  }
  if (kind === 'reload') { ship.loaded.torpedo = true; ship.loaded.bays = true; ship.loaded.tubes = {}; say(game, `${ship.name}: ordnance reloaded`) }
}
const goalGap = (goal, p) => shapeGap ? Math.hypot(goal.pos.x - p.x, goal.pos.y - p.y) - goal.r : 0
function closerPossible (game, ship, goal) {
  const start = goalGap(goal, ship.pos), lim = checkMove(game, ship, [])
  for (let t = -ship.profile.turns; t <= ship.profile.turns; t += 15) for (let a = turnDistance(ship); a <= lim.max; a += 2.5) {
    const legs = t ? [{ fwd: a }, { turn: t }, { fwd: Math.max(lim.min - a, 0) }] : [{ fwd: Math.max(a, lim.min) }]
    const c = checkMove(game, ship, legs, { noInstinct: true })
    if (c.ok && goalGap(goal, c.path.end) < start - EPS) return true
  }
  return false
}
/** A legal move that ends touching `e`, as legs (straight, or a stretch, one turn and a run in), or null. The second instinct condition only asks for this when it is possible. */
export function touchPlan (game, ship, e) {
  if (!e) return null
  const R = baseR(ship) + baseR(e) - 0.3, ok = legs => { const c = checkMove(game, ship, legs, { noInstinct: true }); return c.ok && dist(c.path.end, e.pos) <= baseR(ship) + baseR(e) + EPS }
  const lim = checkMove(game, ship, [], { noInstinct: true })
  const ahead = dist(ship.pos, e.pos) * Math.cos((Math.atan2(e.pos.y - ship.pos.y, e.pos.x - ship.pos.x) * 180 / Math.PI - ship.facing) * Math.PI / 180)
  const straight = [{ fwd: Math.max(0, ahead - R * 0.9) }]
  if (ok(straight)) return straight
  if (lim.turns < 1) return null
  for (let a = turnDistance(ship); a <= lim.max + EPS; a += 1) {
    const A = along(ship.pos, ship.facing, a), ang = Math.atan2(e.pos.y - A.y, e.pos.x - A.x) * 180 / Math.PI, Q = { x: e.pos.x - Math.cos(ang * Math.PI / 180) * R, y: e.pos.y - Math.sin(ang * Math.PI / 180) * R }
    let t = ((Math.atan2(Q.y - A.y, Q.x - A.x) * 180 / Math.PI - ship.facing) % 360 + 540) % 360 - 180
    const legs = [{ fwd: a }, { turn: Math.round(t * 10) / 10 }, { fwd: dist(A, Q) }]
    if (ok(legs)) return legs
  }
  return null
}
/** The reasons Lost Scent refuses this move (movement.js checkMove adds them). */
export function instinctReasons (game, ship, c) {
  const i = ship.instinct
  if (!isPhage(ship) || !i || i.round !== game.round || controlled(game, ship) || ship.movedThisPhase) return []
  const why = [], p = c.path
  if (i.cond === 1 && p.segs.some(s => hitsPhenomena(game, ship, s.a, s.b))) why.push('Lost Scent 1: a turn must be made away from the celestial phenomena')
  if (i.cond === 2 && i.touch) { const e = shipByUid(game, i.enemy); if (!e || dist(p.end, e.pos) > baseR(ship) + baseR(e) + EPS) why.push(`Lost Scent 2: it must move into contact with ${e?.name}`) }
  if (i.cond === 7 && !ship.order) {
    if (i.goal) { if (i.canClose && goalGap(i.goal, p.end) >= goalGap(i.goal, ship.pos) - EPS) why.push(`Lost Scent 7: it must end its move closer to ${i.goal.name}`) }
    else if (p.turns.length || Math.abs(p.total - speedOf(ship) / 2) > 0.05) why.push(`Lost Scent 7: half speed (${speedOf(ship) / 2} cm) straight ahead`)
  }
  return why
}

// ======================================== CONTACT WEAPONS ========================================
const working = (ship, kind) => !isCrippled(ship) ? ship.profile.weapons.filter(w => (w.kind === kind || (kind === 'claws' && w.kind === 'grabbers')) && weaponWorks(ship, w)) : []   // the Rukka' Grabbers grip the same way as massive claws
export const hasContactWeapons = ship => (isPhage(ship) || ship.profile.weapons.some(w => w.kind === 'grabbers')) && ['feeder', 'claws'].some(k => working(ship, k).length)
/** The partner of a grapple, or null (it ends when either ship is no longer on the table). */
export function grapplePartner (game, ship) {
  const p = ship.grapple != null ? shipByUid(game, ship.grapple) : null
  if (!p || p.state !== 'active' || ship.state !== 'active' || p.grapple !== ship.uid) { if (ship.grapple != null) { ship.grapple = null; ship.grappled = false }; return null }
  return p
}
/** Clear grapples whose ships are gone. */
export function refreshGrapples (game) { for (const s of game.ships) if (s.grapple != null) grapplePartner(game, s); for (const s of game.ships) s.grappled = s.grapple != null && !!grapplePartner(game, s) }
/**
 * When a Phage ship moves into contact with an enemy ship, feeder tentacles (once per turn: a D6, 1-3 that many Hit-and-Run attacks, 4-6 a point of damage and a
 * Hit-and-Run raid) and massive claws (two D6 per pair, 4+ hits ignoring shields but not mirage fields; two hits grab the prey) attack. Each weapon attacks one ship a turn; a crippled
 * ship's don't work; orders don't matter. `now` = made at the start of the move against a ship already touching.
 */
export function contactAttack (game, ship, target, { now = false } = {}) {
  const used = (ship.contactUsed = ship.contactUsed?.round === game.round ? ship.contactUsed : { round: game.round })
  const out = { grabbed: false }
  if (target.state !== 'active' || target.side === ship.side) return out
  let braced = false
  const brace = () => { if (!braced) { braced = true; offerBrace(game, target, { by: ship, what: 'contact weapons', key: `contact-${ship.uid}-${game.round}` }) } }
  const claws = working(ship, 'claws'), feeders = working(ship, 'feeder')
  if (claws.length && used.claws == null) {
    used.claws = target.uid; brace()
    const dice = rollDice(game.rng, 2 * claws.length), hits = count(dice, 4)
    say(game, `${ship.name}'s massive claws seize ${target.name}: ${dice.length} dice rolled ${fmt(dice)}, needed 4+: ${hits} hit${hits === 1 ? '' : 's'}, shields ignored`)
    const through = fieldSave(game, target, hits, { what: 'massive claws', from: ship.pos, by: ship, braceAsked: true }).through
    if (through) damageShip(game, target, through, { what: 'massive claws' })
    if (hits >= 2 && ship.state === 'active' && target.state === 'active') {
      ship.grapple = target.uid; target.grapple = ship.uid; ship.grappled = target.grappled = true
      out.grabbed = true
      say(game, `${ship.name} has grabbed ${target.name} in its fearsome grip and will not let go until one of them is destroyed`)
    }
  }
  if (feeders.length && used.feeder == null && target.state === 'active') {
    used.feeder = target.uid; brace()
    const r = d6(game.rng)
    if (r <= 3) {
      say(game, `${ship.name}'s feeder tentacles: rolled ${r}, ${r} Hit-and-Run attack${r > 1 ? 's' : ''} on ${target.name}`)
      for (let i = 0; i < r && target.state === 'active'; i++) hitAndRun(game, target, ship, { braceAsked: true })
    } else {
      say(game, `${ship.name}'s feeder tentacles: rolled ${r}, a point of damage and a Hit-and-Run raid on ${target.name}`)
      if (fieldSave(game, target, 1, { what: 'feeder tentacles', from: ship.pos, by: ship, braceAsked: true }).through) damageShip(game, target, 1, { what: 'feeder tentacles' })
      if (target.state === 'active') hitAndRun(game, target, ship, { braceAsked: true })
    }
  }
  return out
}
/** At the start of its own move a Phage ship may attack a ship already touching it in place of its normal move, and then still complete its move. */
export function contactNow (game, shipUid, targetUid) {
  const ship = shipByUid(game, shipUid), target = shipByUid(game, targetUid)
  const refuse = r => ({ ok: false, reason: say(game, `${ship?.name ?? 'That ship'} can't attack with its contact weapons: ${r}`) })
  if (!ship || !target || !isPhage(ship)) return refuse('not a Phage ship')
  if (game.phase !== 'movement' || ship.side !== game.active || ship.movedThisPhase) return refuse('only at the start of its own move')
  if (!hasContactWeapons(ship)) return refuse('no working feeder tentacles or massive claws (a crippled ship\'s don\'t work)')
  if (dist(ship.pos, target.pos) > baseR(ship) + baseR(target) + EPS) return refuse('the target is not in base contact')
  contactAttack(game, ship, target, { now: true })
  return { ok: true }
}
/** In every End phase the claws roll again; if two attacks hit while already grappled, a third additional hit. */
export function grappleRound (game) {
  for (const s of active(game)) {
    if (s.side !== game.active || s.grapple == null || !working(s, 'claws').length) continue
    const t = grapplePartner(game, s)
    if (!t || !s.grappled) continue
    const dice = rollDice(game.rng, 2 * working(s, 'claws').length), hits = count(dice, 4)
    say(game, `${s.name}'s claws tear again at ${t.name}: ${fmt(dice)}, needed 4+: ${hits} hit${hits === 1 ? '' : 's'}${hits >= 2 ? ', and a third additional hit' : ''}`)
    const n = hits + (hits >= 2 ? 1 : 0), through = fieldSave(game, t, n, { what: 'massive claws', from: s.pos, by: s }).through
    if (through) damageShip(game, t, through, { what: 'massive claws' })
  }
}
/** movement while grappled: same class or smaller cannot move; a larger one moves at half rate and carries its prey. Returns { max factor } or null for free. */
export function grappleLimit (game, ship) {
  const p = grapplePartner(game, ship)
  if (!p) return null
  return SIZE[ship.profile.type] > SIZE[p.profile.type] ? { half: true, partner: p } : { stuck: true, partner: p }
}
/** The partner of a moving grappler is carried the same way. */
export function carryPartner (game, ship, from) {
  const p = grapplePartner(game, ship)
  if (!p) return
  p.pos = { x: p.pos.x + ship.pos.x - from.x, y: p.pos.y + ship.pos.y - from.y }
  say(game, `${p.name} is dragged along in the claws of ${ship.name}`)
}

// ======================================== ALL IS LOST ========================================
/** A capital ship being boarded by Phage may self destruct: a Resolve Test in the End phase, then D6: 1-3 plasma drive overload, 4-6 aether drive implosion. True = the ship is gone. */
export function allIsLost (game, victim, boarder) {
  if (!isPhage(boarder) || isPhage(victim) || !isCapital(victim) || victim.state !== 'active') return false
  if (!game.decide.allIsLost?.(game, victim, boarder)) return false
  const t = leadershipTest(game, victim, { why: 'All Is Lost: self destruct before the Phage take the ship' })
  if (!t.pass) { say(game, `${victim.name}'s crew fail to destroy their ship and must face their fate`); return false }
  const d = d6(game.rng)
  say(game, `${victim.name} destroys itself: rolled ${d}, ${d <= 3 ? 'plasma drive overload' : 'aether drive implosion'}`)
  catastrophic(game, victim, d <= 3 ? 10 : 12)
  return true
}

// ======================================== THE FLEET'S SET-UP ========================================
/** Called by listCheck.applyListFleet for a Phage list: queen ship Resolve, the Hunger's re-rolls and Imperatives. */
export function applyPhage (game, side, ships, list = null) {
  const hiveList = ships.filter(s => s.profile.hive)
  for (const s of ships) s.leadership = s.profile.hive ? s.profile.ld : raceRule('phage').defaultLd
  for (const h of hiveList) say(game, `${h.name}: Resolve ${h.profile.ld}`)
  const o = list?.ordnance
  if (o && (o.tb || o.boat || o.fighter)) game.pendingOrdnance = { ...(game.pendingOrdnance ?? {}), [side]: o }
  const influence = ships.filter(s => hasUp(s, 'influence')).length, imps = ships.filter(s => hasUp(s, 'imperative')).length
  if (influence) { game.rerolls[side] = { left: influence, flagship: hiveList[0]?.uid ?? null, name: 'Hunger Influence' }; say(game, `${game.sides[side].name}: ${influence} Hunger Influence re-roll${influence > 1 ? 's' : ''}`) }
  if (imps) { (game.imperatives ??= [null, null])[side] = { left: imps }; say(game, `${game.sides[side].name}: ${imps} Hunger Imperative${imps > 1 ? 's' : ''}: a Command check or Resolve Test passed automatically, chosen before the dice`) }
}
/** Bought ordnance markers deploy with the fleet, each counting as a squadron for deployment: here on the first queen ship's base when the battle starts. */
export function deployOrdnance (game) {
  for (const [side, o] of Object.entries(game.pendingOrdnance ?? {})) {
    const hive = game.ships.find(s => s.side === +side && s.profile.hive && s.pos); if (!hive) continue
    const markers = [...Array(o.fighter ?? 0).fill('fighter'), ...Array(o.boat ?? 0).fill('assault boat')]
    if (markers.length) game.ordnance.push({ id: game.nextId++, kind: 'wave', side: +side, from: hive.uid, pos: { ...hive.pos }, markers, r: Math.sqrt(markers.length) * 1.1, moved: false, fresh: false, fleet: 'phage' })
    for (let i = 0; i < (o.tb ?? 0); i++) game.ordnance.push({ id: game.nextId++, kind: 'torpedo', side: +side, from: hive.uid, str: 4, speed: 15, pos: { ...hive.pos }, facing: hive.facing, r: 1.25, fresh: true, attacked: {}, fleet: 'phage', boarding: true })
    say(game, `${game.sides[+side].name}: bought ordnance markers deploy on ${hive.name}`)
  }
  game.pendingOrdnance = {}
}
export { isHulk, squadronOf, leadershipOf, ORDERS, aheadFullDice }
