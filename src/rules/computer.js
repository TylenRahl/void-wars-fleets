// THE COMPUTER PLAYER.
// Pure: it reads the game and returns ONE action at a time; applyAction makes it with the same engine calls the page's buttons use, so
// every roll is the engine's and is logged as for a player. It never draws from the dice itself, so a seeded game replays exactly.
// Exports nextAction, applyAction, candidateMoves, playOut, agroundHeading and COMPUTER_DECIDE; the battle page drives it.
// Its choices are fixed rules of thumb, not rules of the game (the rules leave every choice to the player):
// set-up capital ships in the middle of the zone, escort squadrons on the wings (Fleet Engagement)
// first turn the side that chooses goes first
// orders Reload Ordnance when tubes or bays are empty; All Ahead Full when nothing can be reached this turn; Come to New Heading
// when the target is behind; Lock On when the best move needs no turn and guns bear
// movement tries straight moves and turns at the earliest and latest point, keeps the move whose end puts the most guns on an enemy,
// closes to its fleet's liked range, keeps off the table edge, Blast Markers, asteroid fields and (at sea) shores and hulls
// boarding the Rukka board an enemy their move ends touching (at sea, in reach)
// shooting each gun at the nearest enemy it can reach (no Resolve Test); sunburst cannon at the nearest enemy 30-150 cm ahead
// ordnance torpedoes at an enemy up to 60 cm off in a tube arc, aimed where it will be; bays launch fighters and bombers when enemies are
// within 90 cm; bombers and assault boats fly at the nearest enemy ship, fighters at enemy ordnance in reach, else guard a ship
// brace when the ship is down to a third of its hits or two, whichever is more
import { active, enemiesOf, isCrippled, isEscort, remainingHits, squadronOf, mates, shipByUid, baseR, giveOrder, ORDERS, noNewHeading } from './game.js'
import { checkMove, moveShip, turnDistance, pathBlocked, offTable, canBoardFrom, speedOf, afterAgroundProblem } from './movement.js'
import { fireShip, fireSunburst, canTarget, weaponStrength, weaponWorks, weaponArcs, isLance, isRolled, GUN_KINDS, mayFire } from './shooting.js'
import { rollBays, bayRollDue, launchTorpedoes, launchCraft, moveWave, inTubeArc, baysOf, fleetCraftRoom, launchable, waveSpeed, hasFighter, canAttackShip } from './ordnance.js'
import { along, angleTo, dist, arcsContaining } from './geometry.js'
import { ofKind, touchesBase, lineOfFire, inAsteroids } from './terrain.js'
import { nextToPlace, placeFleetShip, fleetPlaceProblem } from './fleet.js'
import { zoneOf } from './cruiserClash.js'
import { seaStandProblem } from './seaHull.js'
import { startBattle, nextPhase } from './turn.js'
import { isSailor } from './sail.js'

const LIKED_RANGE = { rukka: 15 }   // the Rukka close in (their bangers are short-ranged and they board); everyone else 80 % of their longest gun
const TORPEDO_REACH = 60, BAY_REACH = 90

// ---------------- the computer's own records, per side, turn and phase (plain data: battle.js snapshots the game) ----------------
function memo (game) {
  const key = `${game.round}:${game.active}:${game.phase}`
  if (game.cpu?.key !== key) game.cpu = { key, done: {} }
  return game.cpu.done
}
const done = (game, what) => !!memo(game)[what]
const mark = (game, what) => { memo(game)[what] = true }

// ---------------- what a ship's guns are worth from a spot ----------------
const avgStr = s => { const m = String(s).match(/^(\d*)D(\d+)(?:\+(\d+))?$/i); return m ? (+m[1] || 1) * (+m[2] + 1) / 2 + (+m[3] || 0) : +s || 0 }
const strOf = (ship, w) => isRolled(w) ? avgStr(w.str) : weaponStrength(ship, w)
const guns = ship => ship.profile.weapons.map((w, i) => ({ w, i })).filter(({ w }) => GUN_KINDS.includes(w.kind) && weaponWorks(ship, w))
const worth = e => (isCrippled(e) ? 1.4 : 1) * (isEscort(e) ? 0.7 : 1)
const bears = (pos, facing, w, p) => dist(pos, p) <= w.range && arcsContaining(pos, facing, p).some(a => weaponArcs(w).includes(a))
const longest = ship => Math.max(0, ...guns(ship).map(({ w }) => w.range))
function likedRange (game, ship) { return LIKED_RANGE[game.sides[ship.side].fleet] ?? Math.max(15, 0.8 * (longest(ship) || 30)) }

function fireFrom (game, ship, pos, facing) {
  let best = 0, total = 0
  for (const e of enemiesOf(game, ship)) {
    let s = 0
    for (const { w } of guns(ship)) if (bears(pos, facing, w, e.pos)) s += strOf(ship, w) * (isLance(w) ? 1.6 : 1)
    for (const w of ship.profile.weapons) {
      if (w.kind === 'torpedo' && ship.loaded.torpedo && dist(pos, e.pos) <= TORPEDO_REACH - 15 && inTubeArc({ facing }, w, angleTo(pos, e.pos))) s += avgStr(w.str) * 0.6
      if (w.kind === 'sunburst' && dist(pos, e.pos) >= 33 && dist(pos, e.pos) <= 150 && arcsContaining(pos, facing, e.pos).includes('front')) s += 3
    }
    s *= worth(e); total += s; if (s > best) best = s
  }
  return best + 0.25 * (total - best)
}
const nearest = (game, ship, from = ship.pos) => enemiesOf(game, ship).reduce((a, e) => !a || dist(from, e.pos) < dist(from, a.pos) ? e : a, null)

// how good it is to end a move at pos/facing
function scoreEnd (game, ship, c) {
  const pos = c.path.end, facing = c.path.facing, W = game.table.w, H = game.table.h
  if (offTable(game, pos)) return -1e6
  let s = fireFrom(game, ship, pos, facing)
  const t = nearest(game, ship, pos)
  if (t) s -= 0.1 * Math.abs(dist(pos, t.pos) - likedRange(game, ship))
  const edge = Math.min(pos.x, pos.y, W - pos.x, H - pos.y)
  if (edge < 20) s -= (20 - edge) * 0.5
  if (offTable(game, along(pos, facing, 20))) s -= 5   // pointing at the edge
  s -= 2 * game.blast.filter(m => dist(m, pos) <= baseR(ship) + 2).length
  for (const kind of ['asteroids', 'asteroid']) for (const a of ofKind(game, kind)) if (touchesBase(a.shape, pos, baseR(ship) + 1)) s -= 8
  if (pathBlocked(game, ship, c.path.segs, facing)) s -= 50   // at sea: it would run aground or collide (Tides of the Archipelago)
  const q = squadronOf(game, ship)
  if (q && !q.capital) {   // escorts keep together
    const others = q.uids.map(u => shipByUid(game, u)).filter(x => x !== ship && x.state === 'active' && x.pos)
    if (others.length) { const cx = others.reduce((a, x) => a + x.pos.x, 0) / others.length, cy = others.reduce((a, x) => a + x.pos.y, 0) / others.length; s -= 0.15 * Math.max(0, Math.hypot(pos.x - cx, pos.y - cy) - 10) }
  }
  return s
}

/** Every move worth trying for this ship now, checked legal, with its score; best first. */
export function candidateMoves (game, ship) {
  const lim = checkMove(game, ship, [])
  const need = ship.lowOrbit ? 0 : turnDistance(ship), T = ship.profile.turns || 0
  const ds = [...new Set([lim.min, (lim.min + lim.max) / 2, lim.max].map(d => Math.round(d * 10) / 10))].filter(d => d >= 0)
  const angles = T ? [...new Set([T, -T, T >= 90 ? 45 : null, T >= 90 ? -45 : null].filter(a => a != null))] : []
  const legs = []
  for (const d of ds) {
    legs.push(d > 0 ? [{ fwd: d }] : [])
    if (lim.turns >= 1) for (const a of angles) for (const at of [...new Set([need, d])]) if (at <= d + 1e-6) legs.push([{ fwd: at }, { turn: a }, { fwd: d - at }].filter(l => l.fwd !== 0))
    if (lim.turns >= 2) for (const a of angles) if (2 * need <= d) legs.push([{ fwd: need }, { turn: a }, { fwd: need }, { turn: a }, { fwd: d - 2 * need }].filter(l => l.fwd !== 0))
  }
  const out = []
  for (const l of legs) {
    const c = checkMove(game, ship, l)
    if (c.ok) out.push({ legs: l, c, score: scoreEnd(game, ship, c) })
  }
  return out.sort((a, b) => b.score - a.score)
}

// ---------------- one action at a time ----------------
/** The next thing the computer playing `side` does now, or null when it has nothing left this phase (then the page presses Next). */
export function nextAction (game, side) {
  if (game.over) return null
  if (game.phase === 'setup') return deployAction(game, side)
  if (game.phase === 'ordnance') return waveAction(game, side)
  if (side !== game.active) return null
  if (game.phase === 'movement') return moveAction(game, side)
  if (game.phase === 'shooting') return shootAction(game, side)
  return null
}

function deployAction (game, side) {
  if (game.ships.every(s => s.pos)) return game.firstChooser === side ? { kind: 'first', side, first: side } : null   // whoever placed last
  if (game.placing == null) return null
  const s = nextToPlace(game)
  if (!s || s.side !== side) return null
  const zone = zoneOf(game, game.zones[side]), y = (zone.y0 + zone.y1) / 2, W = game.table.w
  const mine = game.ships.filter(x => x.side === side)
  const caps = mine.filter(x => !isEscort(x)), sq = game.squadrons.filter(q => q.side === side && !q.capital)
  let x
  if (!isEscort(s)) { const k = caps.indexOf(s); x = W / 2 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 24 }
  else { const qi = sq.findIndex(q => q.uids.includes(s.uid)), q = sq[qi], j = q ? q.uids.indexOf(s.uid) : 0; x = (qi % 2 ? W - 30 : 30) + (qi % 2 ? -1 : 1) * j * 6 }
  for (let tries = 0; tries < 60; tries++) {
    const p = { x: Math.min(W - 5, Math.max(5, x + (tries % 2 ? 1 : -1) * Math.ceil(tries / 2) * 4)), y }
    if (fleetPlaceProblem(game, s.uid, p)) continue
    if (game.sea && seaStandProblem(game, s, p, zone.facing)) continue
    if (game.ships.some(o => o !== s && o.pos && dist(o.pos, p) < baseR(o) + baseR(s) + 1)) continue
    return { kind: 'place', side, uid: s.uid, pos: p }
  }
  return { kind: 'place', side, uid: s.uid, pos: { x: Math.min(W - 5, Math.max(5, x)), y } }
}

// the order this ship (or its squadron) should try, or null
function chooseOrder (game, ship) {
  if (ship.order || game.ordersFailed[ship.side] || isSailor(ship) || ship.lockedWith) return null
  if (mates(game, ship).some(x => x.movedThisPhase)) return null
  const has = k => ship.profile.weapons.some(w => w.kind === k)
  if ((has('torpedo') && !ship.loaded.torpedo) || (baysOf(ship) > 0 && !ship.loaded.bays)) return 'reload'
  const t = nearest(game, ship)
  if (!t) return null
  const lim = checkMove(game, ship, [])
  const best = candidateMoves(game, ship)[0]
  const fires = best && fireFrom(game, ship, best.c.path.end, best.c.path.facing) > 0
  const behind = Math.abs(((angleTo(ship.pos, t.pos) - ship.facing) % 360 + 540) % 360 - 180) > 120
  if (behind && lim.turns >= 1 && ship.profile.turns && !noNewHeading(ship)) return 'newHeading'
  const ahead = along(ship.pos, ship.facing, speedOf(ship) + 15)
  if (!fires && dist(ship.pos, t.pos) > lim.max + longest(ship) && !offTable(game, ahead) && Math.min(ahead.x, ahead.y, game.table.w - ahead.x, game.table.h - ahead.y) > 10) return 'aheadFull'
  if (fires && best.legs.every(l => l.turn == null) && guns(ship).length && game.sides[ship.side].fleet !== 'rukka') return 'lockOn'
  return null
}

function moveAction (game, side) {
  const ships = active(game).filter(s => s.side === side && !s.movedThisPhase && !s.lockedWith && !s.standby && s.profile.speed > 0 && !done(game, 'move' + s.uid) && !isSailor(s))
  // capital ships first, then each escort squadron ship by ship
  ships.sort((a, b) => (isEscort(a) - isEscort(b)) || a.uid - b.uid)
  const s = ships[0]
  if (!s) return null
  if (!done(game, 'order' + (squadronOf(game, s)?.name ?? s.uid))) {
    const kind = chooseOrder(game, s)
    if (kind) return { kind: 'order', side, uid: s.uid, order: kind }
  }
  const best = candidateMoves(game, s)[0]
  if (!best) return { kind: 'skip', side, uid: s.uid }
  let board = null
  if (game.sides[side].fleet === 'rukka') {
    const end = { ...s, pos: best.c.path.end, facing: best.c.path.facing }
    board = enemiesOf(game, s).find(e => canBoardFrom(game, end, e))?.uid ?? null
  }
  return { kind: 'move', side, uid: s.uid, legs: best.legs, board }
}

function shootAction (game, side) {
  const ships = active(game).filter(s => s.side === side && s.pos)
  for (const s of ships) {   // sunburst cannon first: it may fire as well as the ship's guns
    const w = s.profile.weapons.find(x => x.kind === 'sunburst')
    if (!w || s.sunburstFired || done(game, 'sunburst' + s.uid) || mayFire(game, s, { sunburst: true })) continue
    if ((s.order && ORDERS[s.order.kind].halves) || isCrippled(s) || s.grappled || !weaponWorks(s, w) || inAsteroids(game, s.pos)) continue   // fireSunburst's own refusals
    const e = enemiesOf(game, s).filter(e => dist(s.pos, e.pos) - 2.5 >= (w.minRange ?? 30) && dist(s.pos, e.pos) - 2.5 <= w.range && arcsContaining(s.pos, s.facing, e.pos).includes('front') && !lineOfFire(game, s.pos, e.pos)).sort((a, b) => dist(s.pos, a.pos) - dist(s.pos, b.pos))[0]
    if (e) return { kind: 'sunburst', side, uid: s.uid, at: { ...e.pos } }
  }
  for (const s of ships) {   // the guns, a squadron together
    if (s.fired || done(game, 'fire' + s.uid) || mayFire(game, s)) continue
    const shots = []
    for (const x of mates(game, s).filter(x => !mayFire(game, x))) for (const { w, i } of guns(x)) {
      const options = enemiesOf(game, x).filter(e => canTarget(game, x, w, e.pos)).sort((a, b) => dist(x.pos, a.pos) - dist(x.pos, b.pos))
      if (options.length) shots.push({ ship: x.uid, weapon: i, target: options[0].uid })
    }
    return { kind: 'fire', side, uid: s.uid, shots }
  }
  for (const s of ships) {   // torpedoes
    if (done(game, 'torp' + s.uid) || !s.loaded.torpedo || s.lockedWith || s.standby || s.noFireRound === game.round || s.lowOrbit || inAsteroids(game, s.pos)) continue   // launchTorpedoes' own refusals
    const i = s.profile.weapons.findIndex(w => w.kind === 'torpedo' && weaponWorks(s, w))
    if (i < 0) continue
    const w = s.profile.weapons[i]
    const e = enemiesOf(game, s).map(e => ({ e, aim: along(e.pos, e.facing, speedOf(e) * 0.5) })).filter(({ e, aim }) => dist(s.pos, e.pos) <= TORPEDO_REACH && inTubeArc(s, w, angleTo(s.pos, aim)))
      .sort((a, b) => (isEscort(a.e) - isEscort(b.e)) || dist(s.pos, a.e.pos) - dist(s.pos, b.e.pos))[0]
    if (e) return { kind: 'torpedo', side, uid: s.uid, weapon: i, heading: angleTo(s.pos, e.aim) }
    mark(game, 'torp' + s.uid)
  }
  for (const s of ships) {   // attack craft
    if (done(game, 'bays' + s.uid) || !s.loaded.bays || !baysOf(s) || s.crits.bays || s.mines || s.lockedWith || s.noFireRound === game.round) continue
    const n = Math.min(baysOf(s), fleetCraftRoom(game, side))
    const kinds = launchable(game, s)
    if (n < 1 || !kinds.length || !enemiesOf(game, s).some(e => dist(e.pos, s.pos) <= BAY_REACH)) { mark(game, 'bays' + s.uid); continue }
    const fighter = kinds.find(k => /fighter|buzza/.test(k)), bomber = kinds.find(k => /bomber|dropper/.test(k) && !/torpedo/.test(k)) ?? kinds.find(k => /boat|dropwing/.test(k))
    const mix = {}
    if (fighter && bomber && fighter !== bomber) { const f = Math.floor(n / 3); if (f) mix[fighter] = f; mix[bomber] = n - f } else mix[bomber ?? fighter ?? kinds[0]] = n
    return { kind: 'craft', side, uid: s.uid, mix }
  }
  return null
}

function waveAction (game, side) {
  if (side !== game.active && game.ordnance.some(o => o.kind === 'wave' && o.side === game.active && !o.moved && !done(game, 'wave' + o.id))) return null   // the active player moves first
  const w = game.ordnance.find(o => o.kind === 'wave' && o.side === side && !o.moved && !done(game, 'wave' + o.id))
  if (!w) return null
  const sp = waveSpeed(w)
  const enemies = active(game).filter(s => s.side !== side && s.pos)
  if (canAttackShip(w) && enemies.length) {
    const e = enemies.reduce((a, b) => dist(w.pos, b.pos) < dist(w.pos, a.pos) ? b : a)
    return { kind: 'wave', side, id: w.id, dest: { ...e.pos } }
  }
  if (hasFighter(w)) {
    const o = game.ordnance.filter(o => o.side !== side && o.pos && dist(o.pos, w.pos) <= sp).sort((a, b) => dist(w.pos, a.pos) - dist(w.pos, b.pos))[0]
    if (o) return { kind: 'wave', side, id: w.id, dest: { ...o.pos } }
    const own = active(game).filter(s => s.side === side && s.pos && !isEscort(s)).sort((a, b) => dist(w.pos, a.pos) - dist(w.pos, b.pos))[0]
    if (own && w.markers.every(k => /fighter|buzza/.test(k))) return { kind: 'wave', side, id: w.id, dest: { ...own.pos }, cap: own.uid }
  }
  return { kind: 'skip', side, id: w.id, what: 'wave' + w.id }
}

/** Make the action with the engine. Returns the engine's answer ({ ok, reason }). A refused action is not tried again this phase. */
export function applyAction (game, a) {
  const s = a.uid != null ? shipByUid(game, a.uid) : null
  let r = { ok: true }
  switch (a.kind) {
    case 'place': {
      r = placeFleetShip(game, a.uid, a.pos)
      if (!r.ok) {   // anywhere along the middle of its zone that the engine takes, else it is left for the player
        const z = zoneOf(game, game.zones[a.side]), y = (z.y0 + z.y1) / 2
        for (let x = 5; x <= game.table.w - 5 && !r.ok; x += 5) if (!fleetPlaceProblem(game, a.uid, { x, y })) r = placeFleetShip(game, a.uid, { x, y })
      }
      break
    }
    case 'first': startBattle(game, a.first); break
    case 'order': mark(game, 'order' + (squadronOf(game, s)?.name ?? s.uid)); r = giveOrder(game, s, a.order) ?? { ok: true }; break
    case 'move': mark(game, 'move' + s.uid); r = moveShip(game, s, a.legs, a.board != null ? { board: a.board } : {}); break
    case 'skip': mark(game, a.what ?? 'move' + s?.uid); break
    case 'sunburst': mark(game, 'sunburst' + s.uid); r = fireSunburst(game, s, a.at) ?? { ok: true }; break
    case 'fire':
      for (const x of mates(game, s)) mark(game, 'fire' + x.uid)
      if (a.shots.length) r = fireShip(game, s, a.shots)
      else { for (const x of mates(game, s)) x.fired = true; game.log.push({ round: game.round, side: game.active, phase: game.phase, text: `${mates(game, s).length > 1 ? 'The squadron' : s.name} has nothing in reach and holds fire` }) }
      break
    case 'torpedo': mark(game, 'torp' + s.uid); r = launchTorpedoes(game, s, a.heading, { weapon: a.weapon }); break
    case 'craft': {   // the Rukka roll their bays as they launch: try again with what the roll allows, so no refusal is shown
      mark(game, 'bays' + s.uid)
      if (bayRollDue(game, s)) rollBays(game, s)   // the same roll launchCraft would make first
      const n = Object.values(a.mix).reduce((x, y) => x + y, 0), room = Math.min(baysOf(s), fleetCraftRoom(game, s.side))
      const mix = room < n ? shrink(a.mix, room) : a.mix
      r = Object.values(mix).some(v => v > 0) ? launchCraft(game, s, mix) : { ok: true }
      break
    }
    case 'wave': mark(game, 'wave' + a.id); r = moveWave(game, a.id, a.dest, a.cap != null ? { cap: a.cap } : {}); break
  }
  return r ?? { ok: true }
}

const shrink = (mix, n) => { const out = {}; for (const [k, v] of Object.entries(mix).reverse()) { const t = Math.min(v, n); if (t) out[k] = t; n -= t } return out }

// ---------------- the computer's answers to the engine's questions (game.decide) ----------------
export const COMPUTER_DECIDE = {
  brace: (game, ship) => !isEscort(ship) ? remainingHits(ship) <= Math.max(2, Math.ceil(ship.profile.hits / 3)) : false,
  reroll: () => true,
}

/** At sea, after running aground or a collision: the heading the ship may take that points nearest the closest enemy (rules/movement.js turnAfterAground). */
export function agroundHeading (game, ship) {
  const t = nearest(game, ship), want = t ? angleTo(ship.pos, t.pos) : ship.facing
  const off = h => Math.abs(((h - want) % 360 + 540) % 360 - 180)
  const ok = [0, 45, 90, 135, 180, 225, 270, 315].filter(h => !afterAgroundProblem(game, ship, h))
  return ok.length ? ok.reduce((a, b) => off(b) < off(a) ? b : a) : ship.facing
}

/** Play the whole battle headless, both sides the computer (tests). Returns the number of actions made. */
export function playOut (game, { maxSteps = 20000 } = {}) {
  let steps = 0
  while (!game.over && steps++ < maxSteps) {
    const a = nextAction(game, game.phase === 'setup' ? game.placing ?? game.firstChooser : game.active) ?? (game.phase === 'ordnance' || game.phase === 'setup' ? nextAction(game, 1 - (game.phase === 'setup' ? game.placing ?? game.firstChooser : game.active)) : null)
    if (a) { applyAction(game, a); continue }
    if (game.phase === 'setup') throw new Error('the computer could not finish set-up')
    nextPhase(game)
  }
  return steps
}
