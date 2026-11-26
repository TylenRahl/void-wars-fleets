// THE HULL AT SEA (Tides of the Archipelago), only when game.sea: at sea the collision rules follow the ship pictures.
// Exports the hull shape (seaHullLength, the capsule), overlap tests and the first ship or island a move runs into;
// movement.js, computer.js and battle.js use it to stop moves and refuse placements.
//
// At sea a ship is drawn SEA_GROW (4) times its space length (view/seaPictures.js; battle.js shipLen = 3 cm a size class
// x 4), so a cruiser is 24 cm long while its base is 3.2 cm across. At sea ships bump into ships and islands with that drawn
// hull, not the base: a capsule (a rounded rectangle) along the ship's facing, SEA_CM_PER_SIZE cm per size class long and
// SEA_BEAM of its length wide, centred on the base. Everything else still measures from the base: ranges, arcs, boarding
// reach, ordnance contact.
//
// Defences and forts keep their base (they are drawn as forts, not hulls).
import { sizeOf } from '../data/ships.js'
import { dist, lerp, norm } from './geometry.js'
import { baseR, squadronOf, isHulk } from './game.js'
import { shapeGap, ofKind } from './terrain.js'

export const SEA_CM_PER_SIZE = 12   // 3 cm a size class (battle.js shipLen) x SEA_GROW 4 (view/seaPictures.js); keep the two agreeing
export const SEA_BEAM = 0.28        // hull width / length, measured off the sea pictures without oars and gun barrels
const STEP = 0.5                    // cm between the poses checked along a move
const TURN_STEP = 5                 // degrees between the poses checked while a ship turns on the spot
const EPS = 1e-6

const usesHull = s => !s.fort && s.profile?.type !== 'defence' && s.profile?.fleet !== 'defence'
/** The hull's length at sea in cm (the base's diameter for a defence or fort). */
export const seaHullLength = s => usesHull(s) ? SEA_CM_PER_SIZE * sizeOf(s.profile) : 2 * baseR(s)

/** The hull as a capsule { a, b, r }: the segment a-b (stern to bow) widened by r all round. */
export function hullOf (s, pos = s.pos, facing = s.facing) {
  if (!usesHull(s)) return { a: pos, b: pos, r: baseR(s) }
  const L = seaHullLength(s), r = L * SEA_BEAM / 2, h = L / 2 - r
  const c = Math.cos(facing * Math.PI / 180) * h, d = Math.sin(facing * Math.PI / 180) * h
  return { a: { x: pos.x - c, y: pos.y - d }, b: { x: pos.x + c, y: pos.y + d }, r }
}

// the shortest distance between the segments p1-q1 and p2-q2
function segSeg (p1, q1, p2, q2) {
  const d1 = { x: q1.x - p1.x, y: q1.y - p1.y }, d2 = { x: q2.x - p2.x, y: q2.y - p2.y }, r = { x: p1.x - p2.x, y: p1.y - p2.y }
  const a = d1.x * d1.x + d1.y * d1.y, e = d2.x * d2.x + d2.y * d2.y, f = d2.x * r.x + d2.y * r.y
  let s, t
  if (a < EPS && e < EPS) return dist(p1, p2)
  if (a < EPS) { s = 0; t = Math.max(0, Math.min(1, f / e)) }
  else {
    const c = d1.x * r.x + d1.y * r.y
    if (e < EPS) { t = 0; s = Math.max(0, Math.min(1, -c / a)) }
    else {
      const b = d1.x * d2.x + d1.y * d2.y, den = a * e - b * b
      s = den > EPS ? Math.max(0, Math.min(1, (b * f - c * e) / den)) : 0
      t = (b * s + f) / e
      if (t < 0) { t = 0; s = Math.max(0, Math.min(1, -c / a)) } else if (t > 1) { t = 1; s = Math.max(0, Math.min(1, (b - c) / a)) }
    }
  }
  return Math.hypot(p1.x + d1.x * s - p2.x - d2.x * t, p1.y + d1.y * s - p2.y - d2.y * t)
}
/** How far two hulls overlap, cm: > 0 overlapping, < 0 the gap between them. */
export const hullOverlap = (h, k) => h.r + k.r - segSeg(h.a, h.b, k.a, k.b)
/** How far a hull reaches into an island, cm: > 0 on the shore, < 0 the open water between them. */
export function shoreOverlap (h, shape) {
  const n = Math.max(1, Math.ceil(dist(h.a, h.b) / 1))
  let gap = Infinity
  for (let i = 0; i <= n; i++) gap = Math.min(gap, shapeGap(shape, lerp(h.a, h.b, i / n)))
  return h.r - gap
}
const reach = shape => shape.r ?? Math.max(shape.rx ?? 0, shape.ry ?? 0, shape.r1 ?? 0)

/** The other ships a ship at sea can hit: on the table, afloat or a drifting hulk, same table level; not its own squadron's
 * ships (they move together) unless `mates`. */
export const hullsAround = (game, ship, { mates = false } = {}) => {
  const q = squadronOf(game, ship)
  return game.ships.filter(o => o !== ship && o.pos && (o.state === 'active' || isHulk(o)) && !!o.lowOrbit === !!ship.lowOrbit && (mates || !(q && squadronOf(game, o) === q)))
}

/** Every pose the ship passes through on a move (checkMove's segs, then a last turn to endFacing): straight legs every STEP cm,
 * turns on the spot every TURN_STEP degrees. Each pose: { pos, facing, at (cm moved), seg, k }. The first is where it starts. */
export function posesAlong (ship, segs, endFacing = null) {
  const out = [{ pos: ship.pos, facing: ship.facing, at: 0, seg: segs[0] ?? null, k: 0 }]
  let f = ship.facing, p = ship.pos, at = 0, last = null
  const turn = (to, seg, k) => {
    const d = norm(to - f), n = Math.ceil(Math.abs(d) / TURN_STEP)
    for (let i = 1; i <= n; i++) out.push({ pos: p, facing: f + d * i / n, at, seg, k })
    f = to
  }
  for (const s of segs) {
    if (Math.abs(norm(s.facing - f)) > EPS) turn(s.facing, s, 0)
    const n = Math.max(1, Math.ceil(s.len / STEP))
    for (let i = 1; i <= n; i++) out.push({ pos: lerp(s.a, s.b, i / n), facing: s.facing, at: s.from + s.len * i / n, seg: s, k: i / n })
    p = s.b; at = s.from + s.len; last = s
  }
  if (endFacing != null && Math.abs(norm(endFacing - f)) > EPS) turn(endFacing, last, 1)
  return out
}

// the first pose along the way at which `depth(pose)` goes past contact: > 0, or, if it starts in contact, deeper than it started.
// Returns the last pose before that (where the ship stops), or null.
function firstDeeper (poses, depth) {
  const d0 = depth(poses[0]), limit = d0 > EPS ? d0 + 0.2 : EPS
  for (let i = 1; i < poses.length; i++) if (depth(poses[i]) > limit) return { stop: poses[i - 1], hit: poses[i] }
  return null
}
const result = (r, extra) => r && { at: r.stop.at, seg: r.stop.seg ?? r.hit.seg, k: r.stop.k, pos: r.stop.pos, facing: r.stop.facing, ...extra }

/** At sea: the first ship the move's hull runs into (or only those in `only`), or null. { at, seg, k, pos, facing, target }:
 * pos and facing are the last pose clear of it, where the ship stops. `skip` a uid left out (the ram target). */
export function firstHullHit (game, ship, segs, { endFacing = null, skip = null, only = null } = {}) {
  const poses = posesAlong(ship, segs, endFacing), L = seaHullLength(ship), moved = poses.at(-1).at
  let best = null
  for (const o of only ?? hullsAround(game, ship)) {
    if (o.uid === skip) continue
    if (dist(o.pos, ship.pos) > moved + (L + seaHullLength(o)) / 2 + 1) continue   // too far to reach
    const k = hullOf(o), r = firstDeeper(poses, P => hullOverlap(hullOf(ship, P.pos, P.facing), k))
    if (r && (!best || r.hit.at < best.hitAt || (r.hit.at === best.hitAt && poses.indexOf(r.hit) < best.i))) best = { ...result(r, { target: o }), hitAt: r.hit.at, i: poses.indexOf(r.hit) }
  }
  return best
}
/** At sea: the first island the move's hull runs onto, or null. { at, seg, k, pos, facing, t }. */
export function firstShoreHit (game, ship, segs, { endFacing = null } = {}) {
  const poses = posesAlong(ship, segs, endFacing), L = seaHullLength(ship), moved = poses.at(-1).at
  let best = null
  for (const t of ofKind(game, 'island')) {
    if (dist(t.shape, ship.pos) > moved + L / 2 + reach(t.shape) + 1) continue
    const r = firstDeeper(poses, P => shoreOverlap(hullOf(ship, P.pos, P.facing), t.shape))
    if (r && (!best || r.hit.at < best.hitAt || (r.hit.at === best.hitAt && poses.indexOf(r.hit) < best.i))) best = { ...result(r, { t }), hitAt: r.hit.at, i: poses.indexOf(r.hit) }
  }
  return best
}

/** At sea: why a ship can't stand at pos facing that way (another ship's hull or an island in the way), or null. Squadron
 * mates count here: nothing may be put down on top of another ship. `clear` cm of water wanted round it. */
export function seaStandProblem (game, ship, pos, facing, { clear = 0 } = {}) {
  const h = hullOf(ship, pos, facing)
  for (const t of ofKind(game, 'island')) if (shoreOverlap(h, t.shape) > -clear + EPS) return 'its hull would be on an island (Tides of the Archipelago: at sea a ship takes up its whole hull)'
  for (const o of hullsAround(game, ship, { mates: true })) if (hullOverlap(h, hullOf(o)) > -clear + EPS) return `its hull would overlap ${o.name} (Tides of the Archipelago: at sea a ship takes up its whole hull)`
  return null
}
