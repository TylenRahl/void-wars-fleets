// Planetary defences in battle: buying them with the points a scenario gives
// (Surprise Attack, Planetary Assault, Worldbreak: D6x10 points per 500 points of the defender's
// fleet, or part), placing them, and the rules of their own: orbital mines, minefields, fire ships, lost orbits and
// Blast Markers clearing from stationary defences. The profiles are src/data/defences.js.
// Exports rollDefenceBudget, canBuy, buyDefence, guardOrbital, placeDefence, moveMines, minefieldDetection,
// detonateFireShip and the rest; used by scenarios.js, turn.js, movement.js, ordnance.js and the battle page's set-up.
import { rollTurrets } from './tracking.js'
import { armourFrom } from './armour.js'
import { d6, d3, rollDice, sum, count } from './dice.js'
import { dist, along, angleTo, arcsContaining } from './geometry.js'
import { squadronOf, say, addShip, shipByUid, baseR, active, onTable, offerBrace, isEscort, blastTouching, BLAST_R, placeBlastCluster } from './game.js'
import { hitWithShields, critical } from './damage.js'
import { wellsAt, PLANET_D } from './terrain.js'
import { DEFENCES, isosOrbital } from '../data/defences.js'
import { fortBlastClear } from './fort.js'
import { LOW } from './lowOrbit.js'
import { fieldSave } from './miragefield.js'
import { isPall, isCrippled, turretsOf } from './game.js'

const EPS = 1e-6
export const MINE_R = 1.25
export { DEFENCES }
export const LEADERSHIP = 7   // No Resolve roll, a nominal 7

/** D6x10 points for every 500 points (or part) of the defender's fleet. */
export function rollDefenceBudget (game) {
  const pts = game.sides[game.defender].points, n = Math.max(1, Math.ceil(pts / 500))
  const rolls = rollDice(game.rng, n), budget = sum(rolls) * 10
  game.defenceBudget = { points: budget, spent: 0, bought: [] }
  say(game, `Planetary defences: ${n} × D6×10 points for ${pts} points of fleet (rolled ${rolls.join(', ')}) = ${budget} points`)
  return budget
}
/** What the defender may still buy (ground units only with a low orbit table; the list's 0-X limits). */
export function canBuy (game, id, cost) {
  const d = DEFENCES.find(x => x.id === id), b = game.defenceBudget
  if (!d || !b) return 'no such defence'
  // The Isos spend their planetary defence points on orbitals only, and nobody else may buy Isos orbitals
  const isos = game.sides[game.defender].fleet === 'isos'
  if (d.race === 'rukka' && game.sides[game.defender].fleet !== 'rukka') return 'only the Rukka can take Lumps as defences'
  if (d.race === 'isos' && !isos) return 'only the Isos have these'
  if (isos && d.race !== 'isos') return 'the Isos may buy only their own orbitals'
  if (b.spent + (cost ?? d.points) > b.points) return `only ${b.points - b.spent} points left`
  if (d.role === 'ground' && !game.lowOrbit) return 'ground defences go on a low orbit table'
  if (d.max != null && b.bought.filter(x => x === id).length >= d.max) return `0-${d.max} in a force`
  return null
}
export function buyDefence (game, id, { modules } = {}) {
  const orb = id === 'isos-orbital-core' ? isosOrbital(modules ?? []) : null   // The core plus up to four modules
  if (id === 'isos-orbital-core' && !orb) return { ok: false, reason: 'an orbital is one core plus at most four other modules' }
  const no = canBuy(game, id, orb?.points)
  if (no) return { ok: false, reason: no }
  const d = orb ?? DEFENCES.find(x => x.id === id), b = game.defenceBudget
  b.spent += d.points; b.bought.push(id)
  const s = addShip(game, game.defender, id, { name: `${d.name} ${b.bought.filter(x => x === id).length}` })
  if (orb) s.profile = orb
  s.leadership = LEADERSHIP
  say(game, `${game.sides[game.defender].name} buy ${d.article ?? 'a'} ${d.name} (${d.points} points); ${b.points - b.spent} left`)
  return { ok: true, uid: s.uid }
}
/**
 * Tethers and Wardens set to guard an Orbital (City, Waystation) have Resolve 7 and may not join squadrons with other escorts.
 * A Tether or Warden of the fleet takes a free gravitic hook of an Isos orbital; a hook that carries Wardens carries only Wardens.
 */
export function guardOrbital (game, escortUid, orbitalUid) {
  const e = shipByUid(game, escortUid), o = shipByUid(game, orbitalUid), no = reason => ({ ok: false, reason: say(game, `Can't guard: ${reason}`) })
  if (!e || !o || e.side !== o.side) return no('not the same fleet')
  const kind = e.profile.hooked
  if (!kind) return no('only Tethers and Wardens ride gravitic hooks')
  const cap = o.profile.hooks
  if (!cap || !cap.takes.includes(kind)) return no(`${o.name} has no gravitic hook for ${kind === 'tether' ? 'a Tether' : 'a Warden'}`)
  const guards = game.ships.filter(x => x.guard === o.uid && x !== e)
  if (guards.length >= cap.capacity) return no(`${o.name}'s hooks are full`)
  if (guards.some(x => x.profile.hooked !== kind && (x.profile.hooked === 'warden' || kind === 'warden'))) return no('a hook that carries Wardens carries only Wardens')
  const q = squadronOf(game, e)
  if (q) { q.uids = q.uids.filter(u => u !== e.uid); if (q.uids.length < 2) game.squadrons = game.squadrons.filter(x => x !== q) }   // cannot squadron with other escorts
  e.guard = o.uid; e.parent = o.uid; e.leadership = 7
  say(game, `${e.name} is assigned to guard ${o.name}: base Resolve 7, no squadron with other escorts`)
  return { ok: true }
}
export function sellDefence (game, uid) {
  const s = shipByUid(game, uid), b = game.defenceBudget
  if (!s || s.profile.fleet !== 'defence' || s.pos) return { ok: false }
  game.ships = game.ships.filter(x => x !== s)
  b.spent -= s.profile.points; b.bought.splice(b.bought.indexOf(s.id), 1)
  return { ok: true }
}
export function doneBuying (game) {
  game.setupStep = 'place'
  say(game, `${game.sides[game.defender].name} spend ${game.defenceBudget.spent} of ${game.defenceBudget.points} points on planetary defences`)
}

// ---------------- placing them ----------------
const planetsAndMoons = game => (game.terrain ?? []).filter(t => t.kind === 'planet')
/** Where may this defence go? A reason, or null. High orbit: inside a planet's or moon's gravity well, off the planet,
 * 30 cm from aether rifts, not overlapping another stationary defence. Ground: anywhere along the planet edge of the low
 * orbit table (placeDefence snaps it there). Minefield: an edge within 15 cm of a planet, moon or asteroid field. */
export function defenceReason (game, s, p) {
  const role = s.profile.role
  if (role === 'ground') return game.lowOrbit && p.y > LOW.y0 - 20 ? null : 'ground defences go along the planet\'s edge of the low orbit table'
  if (p.y > game.table.h || p.x < 0 || p.x > game.table.w || p.y < 0) return 'on the main table'
  if ((game.terrain ?? []).some(t => t.kind === 'rift' && dist(t.shape, p) < 30 + Math.max(t.shape.rx ?? 0, t.shape.ry ?? 0))) return 'no closer than 30 cm to an aether rift'
  if (role === 'minefield') {
    const near = (game.terrain ?? []).some(t => (t.kind === 'planet' || (t.kind === 'asteroids' && !t.minefield)) && dist(t.shape, p) - (t.shape.r ?? Math.max(t.shape.rx, t.shape.ry)) <= 15 + 7.5)
    return near ? null : 'with an edge within 15 cm of a planet, moon or asteroid field'
  }
  const inWell = wellsAt(game, p).some(w => w.kind === 'planet')
  if (s.profile.waystation && !game.planet) return null   // Waystations go in any scenario where the Isos defend, planet or not
  if (!inWell) return 'inside a planet\'s or moon\'s gravity well'
  if (planetsAndMoons(game).some(t => dist(t.shape, p) < t.shape.r + baseR(s))) return 'not on the planet itself'
  if (s.profile.speed === 0 && game.ships.some(x => x !== s && x.pos && x.profile.fleet === 'defence' && x.profile.speed === 0 && dist(x.pos, p) < baseR(x) + baseR(s) - EPS)) return 'stationary defences may touch but never overlap'
  return null
}
/** Put a bought defence down. Mines become ordnance markers; a minefield becomes an area like an asteroid field. */
export function placeDefence (game, s, p) {
  const role = s.profile.role
  if (role === 'ground') { s.pos = { x: Math.max(LOW.x0 + 2, Math.min(LOW.x0 + LOW.w - 2, p.x)), y: LOW.y0 + LOW.h - baseR(s) }; s.facing = 270; s.ground = true; return }
  if (role === 'mine') {
    game.ships = game.ships.filter(x => x !== s)
    game.ordnance.push({ id: game.nextId++, kind: 'mine', side: s.side, pos: { ...p }, r: MINE_R, purchased: true, attacked: {}, fleet: game.sides[s.side].fleet })
    say(game, 'An orbital mine is laid; every Ordnance Phase it closes 10 cm on the closest enemy ship')
    return
  }
  if (role === 'minefield') {
    const a = d3(game.rng) * 5, b = d3(game.rng) * 5
    game.ships = game.ships.filter(x => x !== s)
    game.terrain.push({ id: game.nextId++, kind: 'asteroids', minefield: { side: s.side, points: s.profile.points }, shape: { t: 'ell', x: p.x, y: p.y, rx: a / 2, ry: b / 2, rot: 0 }, size: [a, b] })
    say(game, `A minefield ${a} × ${b} cm (D3×5 each way): it blocks line of fire and is crossed like an asteroid field; enemies within 30 cm may set off mines`)
    return
  }
  s.pos = { ...p }; s.facing = s.profile.speed ? 0 : 270
  if (s.profile.lump) lumpFall(game, s)
}
/** Roll 2D6 once each Lump is set up: on a 12 it drops 2D6 cm towards the phenomenon it orbits, and is destroyed if that
 * brings it onto an asteroid field or the planet's edge. A Lump bought as a defence is placed inside a planet's or moon's gravity well, so that is what it falls to. */
export function lumpFall (game, s) {
  const r = rollDice(game.rng, 2), t = sum(r)
  if (t !== 12) { say(game, `${s.name} settles into its orbit (2D6 rolled ${r.join(', ')} = ${t}; only a 12 makes it fall)`); return }
  const pl = planetsAndMoons(game).sort((a, b) => dist(a.shape, s.pos) - dist(b.shape, s.pos))[0]
  if (!pl) return
  const f = rollDice(game.rng, 2), fall = sum(f), left = dist(s.pos, pl.shape) - pl.shape.r - baseR(s)
  if (fall >= left) { s.state = 'destroyed'; say(game, `${s.name} rolled 12: it falls ${fall} cm (2D6 ${f.join(', ')}) towards the ${pl.moon ? 'moon' : 'planet'}, ${Math.max(0, Math.round(left))} cm away, and is destroyed`); return }
  s.pos = along(s.pos, angleTo(s.pos, pl.shape), fall)
  say(game, `${s.name} rolled 12: it falls ${fall} cm (2D6 ${f.join(', ')}) towards the ${pl.moon ? 'moon' : 'planet'} without touching it`)
}

// ---------------- orbital mines ----------------
// the nearest enemy SHIP: stationary platforms and ground silos aren't ships; defence monitors and system ships are
const nearestEnemy = (game, side, p) => active(game).filter(s => s.side !== side && s.pos && !['defence', 'ground'].includes(s.profile.type) && !(isPall(s) && !isCrippled(s))).sort((a, b) => dist(a.pos, p) - dist(b.pos, p))[0]
/** Every Ordnance Phase each mine closes 10 cm on the closest enemy ship, and detonates when it touches that ship's base. */
export function moveMines (game, air) {   // air: { fighterAt, knockOut } from rules/ordnance.js, which this file can't import
  for (const m of game.ordnance.filter(o => o.kind === 'mine')) {
    if (!game.ordnance.includes(m)) continue
    const t = nearestEnemy(game, m.side, m.pos)
    if (!t) continue
    const d = dist(m.pos, t.pos), reach = baseR(t) + m.r
    if (d - reach <= 10 + EPS) { m.pos = along(m.pos, angleTo(m.pos, t.pos), Math.max(0, d - reach)); mineAttack(game, m, t); continue }
    // Blast Markers on the way: like other ordnance, a 6 and it is gone
    const to = along(m.pos, angleTo(m.pos, t.pos), 10)
    if (game.blast.some(b => segDist(m.pos, to, b) <= BLAST_R + m.r)) { const r = d6(game.rng); if (r === 6) { say(game, `An orbital mine crosses Blast Markers: rolled ${r}, it is lost`); lose(game, m); continue } }
    // fighters it meets: both removed
    const w = game.ordnance.find(o => o.kind === 'wave' && o.side !== m.side && air.fighterAt(o) >= 0 && segDist(m.pos, to, o.pos) <= o.r + m.r)
    if (w) { air.knockOut(game, w, air.fighterAt(w), null, to); if (!w.markers.length) game.ordnance = game.ordnance.filter(o => o !== w); lose(game, m); say(game, 'Fighters intercept an orbital mine: both are removed'); continue }
    m.pos = to
    say(game, `An orbital mine homes 10 cm on ${t.name}`)
  }
}
const segDist = (a, b, p) => { const dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy || 1, k = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / L2)); return dist(p, { x: a.x + dx * k, y: a.y + dy * k }) }
function lose (game, m) {
  game.ordnance = game.ordnance.filter(o => o !== m)
  if (m.purchased) { game.minesLost ??= [0, 0]; game.minesLost[m.side]++ }   // Bought mines count 5 VP however removed
}
/** Eight dice to hit (four if the turrets hit it), against armour on the side it comes from; shields count. */
export function mineAttack (game, m, ship) {
  offerBrace(game, ship, { by: m, what: 'an orbital mine', key: `mine-${m.id}` })
  const tur = ship.profile.spores ? turretsOf(ship) : ship.profile.turrets ? Math.max(0, ship.crits.reactors ? Math.ceil(ship.profile.turrets / 2) : ship.profile.turrets) : 0   // Spores are the Phage's turrets
  const tn = m.fleet === 'athanatoi' || m.fleet === 'thnitoi' ? 6 : 4   // Athanatoi orbital mines are hit by turrets on a 6 only
  const tt = rollTurrets(game, ship, tur, tn), td = tt.dice.concat(tt.again), hit = tt.hits > 0   // a tracked Isos ship re-rolls misses
  const n = hit ? 4 : 8, need = armourFrom(ship, m.pos)
  const dice = rollDice(game.rng, n), hits = count(dice, need)
  say(game, `An orbital mine detonates against ${ship.name}${tur ? `: turrets rolled ${td.join(', ')}${hit ? ', a hit — four dice instead of eight' : ', no hit'} (needed ${tn}+)` : ''}; ${n} dice rolled ${dice.join(', ')}, needed ${need}+: ${hits} hit${hits === 1 ? '' : 's'}, shields count`)
  lose(game, m)
  // A mirage field saves once against each ordnance hit, orbital mines included
  const through = fieldSave(game, ship, hits, { what: 'orbital mine', from: m.pos, by: m, braceAsked: true }).through
  if (m.fleet === 'phage') {   // A great spore mine turns its hits into the same number of Fire criticals
    say(game, `The great spore mine's ${through} hit${through === 1 ? '' : 's'} become Fire critical${through === 1 ? '' : 's'}`)
    for (let i = 0; i < through && ship.state === 'active'; i++) critical(game, ship, isEscort(ship) ? undefined : 7, { fire: true })
    return
  }
  hitWithShields(game, ship, through, m.pos, 'the orbital mine')
}

// ---------------- minefields ----------------
/** In its owner's Ordnance Phase a minefield detects, on 5+, every enemy ship up to 30 cm from its edge (+1 All Ahead Full,
 * -1 Burn Retros, -1 escorts, -1 Blast Markers on the field), and a mine is placed on the edge nearest it. */
export function minefieldDetection (game) {
  for (const f of (game.terrain ?? []).filter(t => t.minefield && t.minefield.side === game.active)) {
    const R = Math.max(f.shape.rx, f.shape.ry), bm = game.blast.some(b => dist(b, f.shape) <= R + BLAST_R)
    for (const s of active(game).filter(s => s.side !== f.minefield.side && s.pos && !(isPall(s) && !isCrippled(s)) && dist(s.pos, f.shape) - R - baseR(s) <= 30)) {
      const o = s.order?.kind, mod = (o === 'aheadFull' ? 1 : 0) - (o === 'burnRetros' ? 1 : 0) - (isEscort(s) ? 1 : 0) - (bm ? 1 : 0)
      const r = d6(game.rng)
      say(game, `Minefield detection: ${s.name} rolled ${r}${mod ? ` ${mod > 0 ? '+' : ''}${mod}` : ''}, detected on 5+`)
      if (r + mod >= 5) {
        const at = along(f.shape, angleTo(f.shape, s.pos), R)
        game.ordnance.push({ id: game.nextId++, kind: 'mine', side: f.minefield.side, pos: at, r: MINE_R, purchased: false, attacked: {}, fleet: game.sides[f.minefield.side].fleet })
        say(game, 'A mine is released from the minefield\'s edge')
      }
    }
  }
}

// ---------------- fire ships ----------------
/** In its own Manoeuvre Phase: D3 Fire criticals on every ship within 3D6 cm (an escort is destroyed), ordnance there is
 * destroyed, and the fire ship is gone, leaving a Blast Marker. */
export function detonateFireShip (game, uid) {
  const s = shipByUid(game, uid)
  if (!s || (s.id !== 'fireship' && !s.profile.fireShip) || s.state !== 'active') return { ok: false, reason: 'no fire ship there' }
  if (game.phase !== 'movement' || s.side !== game.active) return { ok: false, reason: say(game, 'A fire ship is detonated in its own Manoeuvre Phase') }
  const rd = rollDice(game.rng, 3), reach = sum(rd)
  say(game, `${s.name} detonates! Everything within 3D6 cm (rolled ${rd.join(', ')} = ${reach} cm) is caught in the blast`)
  s.state = 'expended'
  placeBlastCluster(game, s.pos, 1)
  for (const t of onTable(game)) {
    if (t === s || t.state !== 'active' || dist(t.pos, s.pos) > reach) continue
    const n = d3(game.rng)
    say(game, `${t.name} is within the blast: ${n} Fire critical hit${n > 1 ? 's' : ''} (D3)`)
    for (let i = 0; i < n && t.state === 'active'; i++) critical(game, t, isEscort(t) ? undefined : 7, { fire: true })
  }
  const gone = game.ordnance.filter(o => dist(o.pos, s.pos) <= reach)
  if (gone.length) { game.ordnance = game.ordnance.filter(o => !gone.includes(o)); say(game, `${gone.length} ordnance marker${gone.length > 1 ? 's' : ''} destroyed in the blast`) }
  return { ok: true }
}

// ---------------- each turn ----------------
/** Orbit Lost — the defence falls D6 cm towards the planet in each of its Movement Phases; it is destroyed
 * if it reaches it. */
export function fallingDefences (game) {
  for (const s of game.ships.filter(s => s.side === game.active && s.state === 'active' && s.crits.orbit && s.pos)) {
    const pl = planetsAndMoons(game).sort((a, b) => dist(a.shape, s.pos) - dist(b.shape, s.pos))[0]
    if (!pl) continue
    const r = d6(game.rng), left = dist(s.pos, pl.shape) - pl.shape.r - baseR(s)
    if (r >= left) { s.state = 'destroyed'; say(game, `${s.name} has lost its orbit: it falls ${r} cm and burns up on the ${pl.moon ? 'moon' : 'planet'}`) }
    else { s.pos = along(s.pos, angleTo(s.pos, pl.shape), r); say(game, `${s.name} has lost its orbit and falls ${r} cm towards the ${pl.moon ? 'moon' : 'planet'}`) }
  }
}
/** In each End Phase, after everything else, D6 Blast Markers come off each stationary defence. */
export function clearDefenceBlast (game) {
  fortBlastClear(game, q => blastTouching(game, q).filter(b => game.blast.includes(b)))   // A fort clears D6 for the whole of it
  for (const s of game.ships.filter(s => s.profile.fleet === 'defence' && !s.fort && s.profile.speed === 0 && s.pos && s.state === 'active')) {
    const on = blastTouching(game, s).filter(b => game.blast.includes(b))
    if (!on.length) continue
    const r = d6(game.rng), off = on.slice(0, r)
    game.blast = game.blast.filter(b => !off.includes(b))
    say(game, `${s.name}: rolled ${r}, ${off.length} Blast Marker${off.length > 1 ? 's' : ''} cleared from the station`)
  }
}
export const PLANET_SIZES = PLANET_D
