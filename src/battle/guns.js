// GUNS THAT TURN: turrets (dorsal, broadside and prow) swing to face the target before firing, each kept inside its own
// fire arc. They turn at 2.5 radians a second, never the short way through the back of the arc; the shot waits for
// the turn and starts at the barrel's tip. Looks only: the rules have already rolled the shot.
// Exports aim, stepGuns, release, turning, layersOf and the arc helpers; used by battle.js.
//
// Bearings are degrees clockwise from dead ahead. A ship's picture is prow up: drawing x is to starboard, -y ahead.
import { blueprint, designOf } from '../view/blueprint.js'
import { sizeOf } from '../data/ships.js'

const TURN = 2.5 * 180 / Math.PI   // degrees a second
const ARC = { front: 0, right: 90, rear: 180, left: -90 }
const norm = a => ((a % 360) + 540) % 360 - 180
const SPRITE_PAD = 2.5 / 0.7       // the sprite pictures' margin: 2-3 pixels at 0.7 pixels a unit

/** The bearings a weapon may point at, { lo, hi }, or null all round (each arc a 90° quarter). */
export function arcLimits (w) {
  if (w.arc === 'all' || w.arc.length >= 4) return null
  const mids = w.arc.map(a => a === 'rear' && w.arc.includes('left') ? -180 : ARC[a])
  return { lo: Math.min(...mids) - 45, hi: Math.max(...mids) + 45 }
}
/** A bearing brought inside the limits, to whichever end is nearer. */
export function clampBearing (b, lim) {
  if (!lim) return b
  for (const v of [b, b + 360, b - 360]) if (v >= lim.lo && v <= lim.hi) return v
  const near = x => Math.abs(norm(b - x))
  return near(lim.lo) < near(lim.hi) ? lim.lo : lim.hi
}
/** How drawing units map onto the table: the picture is centred on the ship and fits a square `len` cm across. */
function frame (ship, style) {
  const bp = blueprint(ship.id, designOf(ship.id)), b = bp.box, pad = style === 'sprite' ? SPRITE_PAD : b.w * 0.06 + 2
  return { bp, cx: b.x + b.w / 2, cy: b.y + b.h / 2, scale: 3 * sizeOf(ship.profile) / Math.max(b.w + pad * 2, b.h + pad * 2) }
}
/** A drawing point on the table, for a ship drawn at p, facing f. */
export function onTable (fr, p, f, ux, uy) {
  const a = f * Math.PI / 180, ahead = -(uy - fr.cy) * fr.scale, right = (ux - fr.cx) * fr.scale
  return { x: p.x + Math.cos(a) * ahead - Math.sin(a) * right, y: p.y + Math.sin(a) * ahead + Math.cos(a) * right }
}

const aims = new Map()   // ship uid -> Map(layer -> { at, want, rest })
let holding = false

/** Turn every gun of this weapon on the target. Returns { ms: the turn, tips: where the barrels will end up, on the table }. */
export function aim (ship, weapon, drawn, target, style) {
  const fr = frame(ship, style), w = ship.profile.weapons[weapon]
  const guns = fr.bp.mounts.filter(m => m.weapon === weapon)
  if (!w || !guns.length) return { ms: 0, tips: [] }
  let state = aims.get(ship.uid)
  if (!state) aims.set(ship.uid, state = new Map())
  const lim = arcLimits(w), tips = []
  let ms = 0
  holding = true
  for (const m of guns) {
    const piv = onTable(fr, drawn, drawn.f, m.x, m.y)
    const bearing = norm(Math.atan2(target.y - piv.y, target.x - piv.x) * 180 / Math.PI - drawn.f)
    const want = clampBearing(bearing, lim), g = state.get(m.layer) ?? { at: m.rest, rest: m.rest, want: m.rest }
    g.want = want; state.set(m.layer, g)
    ms = Math.max(ms, Math.abs(lim ? want - g.at : norm(want - g.at)) / TURN * 1000)
    const d = (want - m.rest) * Math.PI / 180, dx = m.tx - m.x, dy = m.ty - m.y
    tips.push(onTable(fr, drawn, drawn.f, m.x + dx * Math.cos(d) - dy * Math.sin(d), m.y + dx * Math.sin(d) + dy * Math.cos(d)))
  }
  return { ms, tips }
}
/** After the shots: every gun swings back to rest. */
export function release () {
  if (!holding) return
  holding = false
  for (const state of aims.values()) for (const g of state.values()) g.want = g.rest
}
/** Step the turning guns by dt seconds. True while any gun is moving. */
export function stepGuns (dt) {
  let moving = false
  for (const [uid, state] of aims) {
    let done = true
    for (const g of state.values()) {
      const left = norm(g.want - g.at), go = TURN * dt
      if (Math.abs(left) <= go) g.at = g.want
      else { g.at += Math.sign(g.want - g.at || left) * go; moving = true }
      if (Math.abs(g.at - g.rest) > 0.01) done = false
    }
    if (done && !holding) aims.delete(uid)
  }
  return moving
}
export const turning = () => aims.size > 0
/** How far each gun of a ship is turned from rest, or null if all are at rest: [{ layer, turn, px, py }], the pivot in the picture. */
export function layersOf (ship, style) {
  const state = aims.get(ship.uid)
  if (!state) return null
  const fr = frame(ship, style)
  return { guns: fr.bp.mounts.map(m => ({ layer: m.layer, turn: (state.get(m.layer)?.at ?? m.rest) - m.rest, px: (m.x - fr.cx) * fr.scale, py: (m.y - fr.cy) * fr.scale })) }
}
