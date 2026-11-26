// Celestial phenomena: their shapes on the table, what touches them, what they block, and
// rolling a battlezone onto the table (rules/core/10-celestial-phenomena.md), and the fixed default islands at sea.
// Used across the engine (movement, shooting, ordnance, damage, scenarios, computer) and by battle.js to draw the table.
//
// A phenomenon: { id, kind, shape, ... }
// kind 'cloud' gas/dust cloud: the same as a single Blast Marker in all respects
// kind 'asteroids' asteroid field: blocks fire, detonates torpedoes, Resolve to cross
// kind 'rift' aether rift: blocks fire, detonates torpedoes, 3D6 Resolve to enter
// kind 'island' TIDES OF THE ARCHIPELAGO (the sea skin): an island blocks fire like a planet, destroys
// torpedoes, and a ship that sails into it runs aground (movement.js runAground)
// kind 'planet' planet or moon: a template that blocks fire unless a ship's stem is on it, destroys torpedoes
// and hulks, and has a gravity well; { size: 'small' | 'medium' | 'large', moon }
// shape { t: 'ell', x, y, rx, ry, rot } or { t: 'ring', x, y, r0, r1 } or { t: 'circ', x, y, r }
import { rollDice, sum, d6, d3 } from './dice.js'
import { dist, along, angleTo, norm } from './geometry.js'

const EPS = 1e-6
// Gravity wells reach this far from the template's edge; moons count as small planets.
export const WELL = { small: 10, medium: 15, large: 30 }
// Small up to 15 cm across, medium 16-25, large 26-50; moons up to 5 cm. The sizes used:
export const PLANET_D = { small: 12, medium: 20, large: 40, moon: 4 }

/** How far point p is inside a shape: <= 0 inside (negative = depth), > 0 outside (roughly the distance out). */
export function shapeGap (shape, p) {
  if (shape.t === 'circ') return dist(shape, p) - shape.r
  if (shape.t === 'ring') { const d = dist(shape, p); return d < shape.r0 ? shape.r0 - d : d - shape.r1 }
  // an ellipse: work in its own frame; the gap is scaled by the smaller radius, close enough near the edge
  const c = Math.cos(-shape.rot * Math.PI / 180), s = Math.sin(-shape.rot * Math.PI / 180)
  const dx = p.x - shape.x, dy = p.y - shape.y, u = dx * c - dy * s, v = dx * s + dy * c
  const k = Math.hypot(u / shape.rx, v / shape.ry)
  return (k - 1) * Math.min(shape.rx, shape.ry)
}
export const inside = (shape, p) => shapeGap(shape, p) <= EPS
/** Does a base of radius r at p touch the shape? (a phenomenon affects a ship as soon as it touches its base.) */
export const touchesBase = (shape, p, r) => shapeGap(shape, p) <= r + EPS

/** Points every `step` cm along a-b (both ends included). */
function samples (a, b, step = 0.4) {
  const n = Math.max(1, Math.ceil(dist(a, b) / step)), out = []
  for (let i = 0; i <= n; i++) out.push({ x: a.x + (b.x - a.x) * i / n, y: a.y + (b.y - a.y) * i / n })
  return out
}
/** The first distance along a-b at which a base of radius r touches the shape, or null. */
export function firstTouch (shape, a, b, r) {
  const pts = samples(a, b), L = dist(a, b)
  for (let i = 0; i < pts.length; i++) if (touchesBase(shape, pts[i], r)) return L * i / Math.max(1, pts.length - 1)
  return null
}
/** Does the straight line a-b pass through the shape (not just touch the ends)? */
export const lineCrosses = (shape, a, b) => samples(a, b).some(p => inside(shape, p))

export const phenomena = game => game.terrain ?? []
export const ofKind = (game, kind) => phenomena(game).filter(t => t.kind === kind)
export const clouds = game => ofKind(game, 'cloud')
/** Gas/dust clouds touching a ship's base: each counts as one Blast Marker in contact. */
export const cloudsTouching = (game, ship, baseR) => clouds(game).filter(c => touchesBase(c.shape, ship.pos, baseR))
export const inAsteroids = (game, p) => ofKind(game, 'asteroids').some(t => inside(t.shape, p))
export const onPlanet = (game, p) => ofKind(game, 'planet').find(t => inside(t.shape, p)) ?? null

/**
 * Can a ship at `from` fire at `to`? No shooting into or out of an asteroid field; between ships both
 * inside a field, only within 10 cm. Asteroid fields and aether rifts block lines of fire; a planet blocks
 * them unless either ship's stem is on it. Returns null, or the reason it can't.
 */
export function lineOfFire (game, from, to) {
  const inA = inAsteroids(game, from), inB = inAsteroids(game, to)
  if (inA !== inB) return 'no shooting into or out of an asteroid field'
  if (inA && inB) return dist(from, to) <= 10 + EPS ? null : 'inside an asteroid field the range is no more than 10 cm'
  for (const t of phenomena(game)) {
    if (t.kind === 'asteroids' && lineCrosses(t.shape, from, to)) return 'an asteroid field blocks the line of fire'
    if (t.kind === 'rift' && lineCrosses(t.shape, from, to)) return 'an aether rift blocks the line of fire'
    if (t.kind === 'island' && lineCrosses(t.shape, from, to)) return 'an island blocks the line of fire (Tides of the Archipelago: islands block like planets)'
    if (t.kind === 'planet' && !inside(t.shape, from) && !inside(t.shape, to) && lineCrosses(t.shape, from, to)) return `a ${t.moon ? 'moon' : 'planet'} blocks the line of fire`
  }
  return null
}
/** A line of fire through a gas/dust cloud shifts gunnery as a Blast Marker does. */
export const cloudInTheWay = (game, a, b) => clouds(game).some(c => lineCrosses(c.shape, a, b))

/** The planets and moons whose gravity well holds point p. */
export function wellsAt (game, p) {
  const planets = ofKind(game, 'planet').filter(t => dist(t.shape, p) <= t.shape.r + WELL[t.moon ? 'small' : t.size] + EPS)
  // A Dominion Derelict has its own gravity well, 5 cm from the edge of its base, like a planet's
  const hulks = (game.ships ?? []).filter(s => (s.id === 'spacehulk' || s.profile?.hulk) && s.pos && ['active', 'drifting', 'blazing'].includes(s.state))
    .map(s => ({ kind: 'hulk-well', hulk: s.uid, name: s.name, shape: { x: s.pos.x, y: s.pos.y, r: 3.0 } }))
    .filter(h => dist(h.shape, p) > EPS && dist(h.shape, p) <= h.shape.r + 5 + EPS)
  return [...planets, ...hulks]
}
/**
 * The free turn a gravity well allows at p for a ship facing `facing`: towards the planet's centre,
 * no more than 45° and no more than it takes to face it. Returns { max, sign } (sign of the allowed turn) or null.
 */
export function wellTurn (game, p, facing) {
  let best = null
  for (const t of wellsAt(game, p)) {
    const need = norm(angleTo(p, t.shape) - facing)
    const max = Math.min(45, Math.abs(need))
    if (max > EPS && (!best || max > best.max)) best = { max, sign: Math.sign(need), planet: t }
  }
  return best
}

// ---------------- rolling a battlezone ----------------
// Each generator: D6 -> what is in an area. Solar flares and radiation bursts are tabletop
// EFFECTS: nothing is placed, they are counted and rolled for each turn (effects.js).
const GEN = {
  1: { name: 'Flare region', t: [null, 'flare', 'flare', 'radiation', 'asteroids', 'D3 clouds', 'planet:small/medium'] },
  2: { name: 'Mercurial zone', t: [null, 'flare', 'radiation', 'asteroids', 'D3 clouds', 'D3 clouds', 'planet:small/medium'] },
  3: { name: 'Inner biosphere', t: [null, 'flare or radiation', 'asteroids', 'D3 asteroids', 'D3 clouds', 'D3 clouds', 'planet:small/medium'] },
  4: { name: 'Primary biosphere', t: [null, 'asteroids', 'D3 asteroids', 'clouds', 'D3 clouds', 'planet:small/medium', 'planet:small/medium'] },
  5: { name: 'Outer reaches', t: [null, 'D3+1 asteroids', 'D3 asteroids', 'D3 clouds', 'clouds', 'planet:small/large', 'planet:small/large'] },
  6: { name: 'Deep space', t: [null, 'D3 asteroids', 'asteroids', 'D3 clouds', 'clouds', 'rift', 'planet:small'] },
}
export const GENERATORS = GEN

/**
 * Roll celestial phenomena onto the table: 60 cm squares, each holding phenomena on a 4+, from one battlezone
 * generator (rolled, or `zone` 1-6), with the sizes, moons and rings of the phenomena chapter. At most one planet.
 * Bands lie along the sunward edge; which edge is sunward is a D6 roll. Returns { zone, sunward, terrain, log }.
 */
// SEA (Tides of the Archipelago): the same
// rolls and the same zones, but everything that would be put down becomes an island: an asteroid field or an aether rift
// is an island of that size, a planet a big island of the planet's size and its moons small islets; clouds, rings, solar
// flares and radiation bursts are not placed on the sea.
// Every island is SEA_ISLAND_GROW (2) times that size, so islands do not look small beside the sea ships (drawn 4 times
// their space length; rules/seaHull.js), and a big island is no more than SEA_ISLAND_MAX cm across.
export const SEA_ISLAND_GROW = 2, SEA_ISLAND_MAX = 60

// THE DEFAULT ISLANDS (Tides of the Archipelago): fewer islands with wide water between them, so the sea is easy to
// navigate. Not a rolled table: a fixed sea, the same every game, on the
// sea table (game.js SEA_TABLE, 270 x 180 cm), point-symmetric about its centre so neither side has the better water, all of it between
// the set-up zones (y 30-150). Five islands with channels of 40 cm and more between them.
export const SEA_DEFAULT_ISLANDS = [
  { t: 'circ', x: 135, y: 90, r: 14 },                  // the big island in the middle, 28 cm across
  { t: 'ell', x: 70, y: 65, rx: 12, ry: 7, rot: 20 },  { t: 'ell', x: 200, y: 115, rx: 12, ry: 7, rot: 20 },
  { t: 'circ', x: 205, y: 55, r: 6 },                  { t: 'circ', x: 65, y: 125, r: 6 },
]
/** The default islands as a battlezone (effects.js applyBattlezone takes it): generator 6, Deep Space, so no sunward rules. */
export function seaDefaultBattlezone () {
  const terrain = SEA_DEFAULT_ISLANDS.map((shape, i) => ({ id: i + 1, kind: 'island', shape: { ...shape }, ...(shape.t === 'circ' ? { size: shape.r >= 10 ? 'medium' : 'small', ...(shape.r < 5 ? { islet: true } : {}) } : { size: [shape.rx * 2, shape.ry * 2] }) }))
  return { zone: 6, sunward: 'top', effects: { flares: 0, bursts: 0 }, terrain,
    log: ['The default islands (Tides of the Archipelago): five islands, the same every game, laid out the same for both sides', 'Sunward edge: the top (it only matters in generators 1-3)'] }
}
export function rollBattlezone (rng, { zone, w = 180, h = 120, fixedPlanet = null, areas = true, sea = false } = {}) {
  const log = [], terrain = [], effects = { flares: 0, bursts: 0 }
  let id = 1
  const z = zone ?? d6(rng)
  log.push(`Battlezone: ${GEN[z].name} (${zone ? 'chosen' : `D6 rolled ${z}`})`)
  const sw = d6(rng), sunward = ['top', 'top', 'bottom', 'bottom', 'left', 'right'][sw - 1]
  const along0 = sunward === 'top' || sunward === 'bottom' ? 0 : 90   // bands run parallel to the sunward edge
  log.push(`Sunward edge: D6 rolled ${sw}, the ${sunward} edge (which number is which edge is the computer's choice)`)
  let planet = false
  // at sea islands keep 25 cm of open water between them, room for a battleship to pass
  const free = (x, y, r) => terrain.every(t => dist(t.shape, { x, y }) > r + (t.shape.r ?? Math.max(t.shape.rx ?? 0, t.shape.ry ?? 0, t.shape.r1 ?? 0)) + (sea ? 25 : 3))
  const spot = (x0, y0, r) => { for (let k = 0; k < 40; k++) { const x = x0 + 6 + rng() * (AREA - 12), y = y0 + 6 + rng() * (AREA - 12); if (free(x, y, r)) return { x, y } } return null }
  const place = (kind, x0, y0) => {
    if (sea && kind === 'cloud') { log.push('A gas/dust cloud: not placed on the sea'); return }
    if (sea) {   // an island the size the field or rift would have been
      const a0 = d3(rng) * 5, b0 = d3(rng) * (kind === 'rift' ? 10 : 5), a = a0 * SEA_ISLAND_GROW, b = b0 * SEA_ISLAND_GROW, p = spot(x0, y0, Math.max(a, b) / 2)
      if (p) { terrain.push({ id: id++, kind: 'island', shape: { t: 'ell', x: p.x, y: p.y, rx: b / 2, ry: a / 2, rot: along0 + Math.floor(rng() * 7) * 15 - 45 }, size: [b, a] }); log.push(`An island ${b} x ${a} cm (twice the ${b0} x ${a0} cm ${kind === 'rift' ? 'aether rift' : 'asteroid field'} it stands in for)`) }
      return
    }
    if (kind === 'asteroids') {   // D3x5 cm by D3x5 cm
      const a = d3(rng) * 5, b = d3(rng) * 5, p = spot(x0, y0, Math.max(a, b) / 2)
      if (p) { terrain.push({ id: id++, kind, shape: { t: 'ell', x: p.x, y: p.y, rx: b / 2, ry: a / 2, rot: along0 }, size: [b, a] }); log.push(`An asteroid field ${b} x ${a} cm`) }
    } else if (kind === 'cloud') {   // a band D6x2 cm wide, D6x5 cm long
      const wd = d6(rng) * 2, l = d6(rng) * 5, p = spot(x0, y0, l / 2)
      if (p) { terrain.push({ id: id++, kind, shape: { t: 'ell', x: p.x, y: p.y, rx: l / 2, ry: wd / 2, rot: along0 }, size: [l, wd] }); log.push(`A gas/dust cloud ${wd} cm wide, ${l} cm long`) }
    } else if (kind === 'rift') {   // D3x5 cm wide, D3x10 cm long
      const wd = d3(rng) * 5, l = d3(rng) * 10, p = spot(x0, y0, l / 2)
      if (p) { terrain.push({ id: id++, kind, shape: { t: 'ell', x: p.x, y: p.y, rx: l / 2, ry: wd / 2, rot: along0 }, size: [l, wd] }); log.push(`An aether rift ${wd} cm wide, ${l} cm long`) }
    }
  }
  function placePlanet (size, cx, cy, why) {
    const R = PLANET_D[size] / 2
    if (sea) {   // a big island the planet's size, its moons small islets 2D6x10 cm away; no rings, no gravity well
      const D = Math.min(SEA_ISLAND_MAX, PLANET_D[size] * SEA_ISLAND_GROW)
      terrain.push({ id: id++, kind: 'island', size, shape: { t: 'circ', x: cx, y: cy, r: D / 2 } })
      log.push(`A ${size} island, ${D} cm across (${why}; in place of a ${PLANET_D[size]} cm planet, ${D === SEA_ISLAND_MAX && PLANET_D[size] * SEA_ISLAND_GROW > D ? `held to ${SEA_ISLAND_MAX} cm` : 'twice its size'})`)
      const n = size === 'medium' ? d3(rng) - 1 : size === 'large' ? d6(rng) - 2 : 0
      for (let i = 0; i < n; i++) {
        const d = sum(rollDice(rng, 2)) * 10, a = rng() * 360, m = along({ x: cx, y: cy }, a, d)
        if (m.x < 3 || m.y < 3 || m.x > w - 3 || m.y > h - 3) { log.push(`An islet ${d} cm away falls off the table`); continue }
        terrain.push({ id: id++, kind: 'island', islet: true, size: 'small', shape: { t: 'circ', x: m.x, y: m.y, r: PLANET_D.moon * SEA_ISLAND_GROW / 2 } })
        log.push(`An islet, ${PLANET_D.moon * SEA_ISLAND_GROW} cm across, ${d} cm from the island (in place of a ${PLANET_D.moon} cm moon)`)
      }
      return
    }
    terrain.push({ id: id++, kind: 'planet', size, shape: { t: 'circ', x: cx, y: cy, r: R } })
    log.push(`A ${size} planet, ${PLANET_D[size]} cm across (${why}; gravity well ${WELL[size]} cm)`)
    // moons: medium D3-1, large D6-2, placed 2D6x10 cm away in a random direction
    const n = size === 'medium' ? d3(rng) - 1 : size === 'large' ? d6(rng) - 2 : 0
    for (let i = 0; i < n; i++) {
      const d = sum(rollDice(rng, 2)) * 10, a = rng() * 360, m = along({ x: cx, y: cy }, a, d)
      if (m.x < 3 || m.y < 3 || m.x > w - 3 || m.y > h - 3) { log.push(`A moon ${d} cm away falls off the table`); continue }
      terrain.push({ id: id++, kind: 'planet', size: 'small', moon: true, shape: { t: 'circ', x: m.x, y: m.y, r: PLANET_D.moon / 2 } })
      log.push(`A moon, ${PLANET_D.moon} cm across, ${d} cm from the planet`)
    }
    // rings: a large planet on 5-6 (the ringed-planet rule, not the generator's 4+): D3 rings,
    // 1-4 gas/dust, 5-6 asteroids, each D6 cm wide starting D6x5 cm from the edge
    if (size === 'large') {
      const rr = d6(rng)
      if (rr >= 5) {
        const k = d3(rng)
        for (let i = 0; i < k; i++) {
          const kind = d6(rng) <= 4 ? 'cloud' : 'asteroids', wd = d6(rng), from = d6(rng) * 5
          terrain.push({ id: id++, kind, ring: true, shape: { t: 'ring', x: cx, y: cy, r0: R + from, r1: R + from + wd } })
          log.push(`A ring of ${kind === 'cloud' ? 'gas and dust' : 'asteroids'} ${wd} cm wide, ${from} cm out`)
        }
      } else log.push(`Rings: rolled ${rr}, none (5+ needed)`)
    }
  }
  // a scenario's own planet (Surprise Attack, Planetary Assault, Worldbreak) goes down first, and
  // is then the only planet; `areas: false` places nothing else
  if (fixedPlanet) { planet = true; placePlanet(fixedPlanet.size, fixedPlanet.x, fixedPlanet.y, fixedPlanet.why ?? 'the scenario\'s planet') }
  // at sea on the bigger table (game.js SEA_TABLE) the areas are 90 cm, so the same six are rolled and the islands lie further apart;
  // in space 60 cm
  const AREA = sea && w > 180 ? 90 : 60
  if (areas) for (let gx = 0; gx < Math.ceil(w / AREA); gx++) for (let gy = 0; gy < Math.ceil(h / AREA); gy++) {
    const r = d6(rng)
    if (r < 4) { log.push(`Area ${gx + 1},${gy + 1}: rolled ${r}, empty (4+ needed)`); continue }
    let t = d6(rng), what = GEN[z].t[t]
    log.push(`Area ${gx + 1},${gy + 1}: rolled ${r}; generator D6 ${t}: ${what}`)
    if (what.startsWith('planet')) {
      if (planet) { log.push('Only one planet on the table: rolled again'); for (let k = 0; k < 5 && what.startsWith('planet'); k++) { t = d6(rng); what = GEN[z].t[t] } if (what.startsWith('planet')) continue }
    }
    const x0 = gx * AREA, y0 = gy * AREA
    if (what === 'flare or radiation') { const k = d6(rng); what = k <= 3 ? 'radiation' : 'flare'; log.push(`Rolled again: ${k}, a ${what === 'flare' ? 'solar flare' : 'radiation burst'} (radiation burst on 1-3, solar flare on 4-6)`) }
    if (sea && (what === 'flare' || what === 'radiation')) { log.push(`A ${what === 'flare' ? 'solar flare' : 'radiation burst'}: not on the sea`); continue }
    if (what === 'flare') { effects.flares++; log.push('A solar flare: a D6 each turn, a flare on a 6, once a game'); continue }
    if (what === 'radiation') { effects.bursts++; log.push('A radiation burst: a D6 each turn, a burst on 5-6'); continue }
    if (what.startsWith('planet')) {
      planet = true
      const [lo, hi] = what.split(':')[1].split('/'), roll = d6(rng)
      const size = hi === 'medium' ? (roll === 6 ? 'medium' : 'small') : hi === 'large' ? (roll >= 4 ? 'large' : 'small') : 'small'
      placePlanet(size, x0 + AREA / 2, y0 + AREA / 2, `D6 ${roll}`)
      continue
    }
    const m = what.match(/^(D3\+1 |D3 )?(asteroids|clouds|rift)$/)
    const n = !m[1] ? 1 : m[1] === 'D3 ' ? d3(rng) : d3(rng) + 1
    for (let i = 0; i < n; i++) place(m[2] === 'clouds' ? 'cloud' : m[2], x0, y0)
  }
  return { zone: z, sunward, terrain, log, effects, sea }
}
