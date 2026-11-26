// THE BOARD ART for the space skin: several tables (over a city, over mountains, floating islands, kinds of space) and the
// pieces on them (asteroids, planets, clouds, rifts). Exports TABLES, CATALOGUE, tableScene, piece and partsBox;
// used by boardSvg.js and battle.js.
//
// One recipe per table and per piece, in CENTIMETRES on the table (the table is 180 x 120 cm),
// read by both styles: src/view/boardSvg.js draws it as SVG, and the pixel-art PNGs in public/space/ show the same recipe.
// So the two styles agree on where every island, ridge and asteroid is.
//
// Parts (all positions in cm, colours '#rrggbb', a = opacity 0-1, blur = softness in cm):
// { s: 'bg', stops: [[0..1, colour], ...], dir: 'v' | 'h' } a gradient over the whole picture
// { s: 'circ', x, y, r, f, a, blur } a disc (soft when blurred: nebulae, glows, clouds)
// { s: 'ell', x, y, rx, ry, rot, f, a, blur, stroke } an ellipse, filled or (stroke = width) outlined
// { s: 'poly', pts: [[x, y], ...], f, a, blur } a filled shape
// { s: 'line', pts: [[x, y], ...], w, f, a, blur } a line of width w
// { s: 'clip', x, y, r, parts: [...] } parts drawn only inside a circle (a planet's bands)
// { s: 'polys', list: [[[x, y], ...], ...], f, a } many filled shapes of one colour (a city's buildings)
// { s: 'dots', pts: [[x, y], ...], r, f, a } many small discs of one colour (city lights)
// { s: 'relief', strokes: [circ / line parts], ramp: [[h, colour], ...], depth, soften, light }
// a lit landscape: the strokes' opacity is HEIGHT (stacked like paint); the height is coloured by the ramp
// (0 valley .. 1 summit) and shaded by a light from the top left;
// soften blurs the height a little, light (cm) blurs it more for the shading only, so 8-bit steps don't show
//
// Sizes of the celestial phenomena follow the rules (rules/core/10-celestial-phenomena.md); the art is not a rule, the pieces' outlines are.
// Deterministic per name (an art-only hash, not the game's dice: src/rules/dice.js is the one random source
// for anything that affects play).
export const TABLE_W = 180, TABLE_H = 120

function hash (str) { let h = 2166136261; for (const c of str) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) } return h >>> 0 }
function rng (seed) { let a = hash(String(seed)); return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }
const between = (r, a, b) => a + r() * (b - a)
const pick = (r, list) => list[Math.floor(r() * list.length)]
const lerpC = (c1, c2, t) => { const p = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16)); const a = p(c1), b = p(c2); return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, '0')).join('') }

// a lumpy closed outline round (cx, cy): n points, radius rx/ry, roughness k
function blob (r, cx, cy, rx, ry, n = 14, k = 0.3, rot = 0) {
  const pts = []
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2, m = 1 - k / 2 + r() * k
    const x = Math.cos(a) * rx * m, y = Math.sin(a) * ry * m
    pts.push([cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)])
  }
  return pts
}
// points along part of an ellipse (angles in radians, rot in degrees): the near half of a ring is drawn as this line
function ellArc (x, y, rx, ry, rot, a0, a1, n = 40) {
  const c = Math.cos(rot * Math.PI / 180), s = Math.sin(rot * Math.PI / 180), pts = []
  for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n, u = Math.cos(a) * rx, v = Math.sin(a) * ry; pts.push([x + u * c - v * s, y + u * s + v * c]) }
  return pts
}
function starfield (r, n, { w = TABLE_W, h = TABLE_H, tint = ['#ffffff', '#cfe0ff', '#fff2d0', '#ffd8c8'], bright = 0.04 } = {}) {
  const out = []
  for (let i = 0; i < n; i++) {
    const x = r() * w, y = r() * h, big = r() < bright, f = pick(r, tint)
    if (big) out.push({ s: 'circ', x, y, r: between(r, 0.6, 1.4), f, a: 0.25, blur: 0.6 })
    out.push({ s: 'circ', x, y, r: big ? between(r, 0.18, 0.3) : between(r, 0.06, 0.16), f, a: big ? 1 : between(r, 0.35, 0.9) })
  }
  return out
}

// streamlines of a flow field (x, y) -> [vx, vy] across the table: each a soft glowing line and a bright thin core
function streamlines (r, field, { n, steps, step, cols, w, a, glow, glowBlur = 1.2 }) {
  const out = []
  for (let i = 0; i < n; i++) {
    let x = between(r, -10, 190), y = between(r, -10, 130); const pts = [[x, y]]
    for (let k = 0; k < steps; k++) { const [vx, vy] = field(x, y), m = Math.hypot(vx, vy) || 1; x += vx / m * step; y += vy / m * step; pts.push([x, y]) }
    const f = pick(r, cols), width = between(r, w[0], w[1]), alpha = between(r, a[0], a[1])
    if (glow) out.push({ s: 'line', pts, w: width * 2.5, f, a: alpha * 0.6, blur: glowBlur })
    out.push({ s: 'line', pts, w: width * 0.35, f: lerpC(f, '#ffffff', 0.35), a: Math.min(1, alpha * 2) })
  }
  return out
}

// ======================================== THE TABLES ========================================
export const TABLES = [
  { id: 'deep-space', name: 'Deep space', kind: 'space', text: 'Black void, a dense starfield and a distant galaxy' },
  { id: 'nebula', name: 'Nebula', kind: 'space', text: 'Purple and teal gas clouds lit by young stars' },
  { id: 'gas-giant', name: 'Gas giant orbit', kind: 'space', text: 'The banded edge of a gas giant and its rings' },
  { id: 'sunward', name: 'Sunward', kind: 'space', text: 'The flare region beside a burning star' },
  { id: 'aether-storm', name: 'Aether storm', kind: 'space', text: 'Turbulent aether currents spinning round several eyes' },
  { id: 'green-fluid', name: 'Green fluidic space', kind: 'space', text: 'Slow currents of green light round broad eddies' },
  { id: 'hive-city', name: 'Over a hive city', kind: 'orbit', text: 'Low orbit over the night side of a hive world', planet: 'spire' },
  { id: 'mountains', name: 'Over mountains', kind: 'orbit', text: 'Low orbit over snow-capped ranges and cloud' },
  { id: 'floating-islands', name: 'Floating islands', kind: 'orbit', text: 'Rock islands adrift above a sea of cloud', planet: 'island' },
]

const SCENES = {
  'deep-space' (r) {
    const out = [{ s: 'bg', dir: 'v', stops: [[0, '#05060d'], [0.6, '#080b18'], [1, '#0b0f22']] }]
    // a distant spiral galaxy: a tilted haze with a bright core
    const gx = between(r, 40, 140), gy = between(r, 30, 90), rot = between(r, -0.8, 0.8)
    for (let i = 0; i < 26; i++) {
      const t = i / 26, a = t * Math.PI * 3, d = 2 + t * 16
      for (const sgn of [1, -1]) out.push({ s: 'circ', x: gx + Math.cos(a * sgn + rot) * d * 1.6, y: gy + Math.sin(a * sgn + rot) * d * 0.6, r: 2.4 + t * 2, f: lerpC('#c8b8ff', '#5a6cc0', t), a: 0.07, blur: 2.2 })
    }
    out.push({ s: 'circ', x: gx, y: gy, r: 3, f: '#fff0d8', a: 0.5, blur: 2 }, { s: 'circ', x: gx, y: gy, r: 0.8, f: '#ffffff', a: 0.9, blur: 0.4 })
    out.push(...starfield(r, 1400))
    return out
  },
  nebula (r) {
    const out = [{ s: 'bg', dir: 'h', stops: [[0, '#07040f'], [1, '#040a12']] }]
    const cols = ['#9a3fd0', '#d04a9a', '#2aa8b8', '#4a5fe0', '#e06a4a', '#3ac08a']
    // four long filaments of gas across the table, each shading from one colour to another, with bright knots
    for (let k = 0; k < 4; k++) {
      let x = between(r, -15, 30), y = between(r, 10, 110), dx = between(r, 2.2, 3.6), dy = between(r, -1.5, 1.5)
      const c1 = pick(r, cols), c2 = pick(r, cols.filter(c => c !== c1))
      for (let i = 0; i < 75; i++) {
        const t = i / 75
        out.push({ s: 'circ', x, y, r: between(r, 6, 15), f: lerpC(c1, c2, t), a: between(r, 0.08, 0.17), blur: between(r, 3, 6) })
        if (r() < 0.08) out.push({ s: 'circ', x: x + between(r, -4, 4), y: y + between(r, -4, 4), r: between(r, 2, 4), f: lerpC(lerpC(c1, c2, t), '#ffffff', 0.5), a: 0.25, blur: 2 })
        x += dx; y += dy + between(r, -2, 2); dy += between(r, -0.4, 0.4)
      }
    }
    // dark dust lanes over the glow
    for (let i = 0; i < 18; i++) out.push({ s: 'circ', x: between(r, 0, 180), y: between(r, 0, 120), r: between(r, 4, 10), f: '#020205', a: 0.35, blur: 4 })
    // young stars lighting it
    for (let i = 0; i < 6; i++) { const x = between(r, 10, 170), y = between(r, 10, 110); out.push({ s: 'circ', x, y, r: 5, f: '#a8d8ff', a: 0.18, blur: 4 }, { s: 'circ', x, y, r: 0.35, f: '#ffffff', a: 1 }) }
    out.push(...starfield(r, 900, { bright: 0.03 }))
    return out
  },
  'gas-giant' (r) {
    const out = [{ s: 'bg', dir: 'v', stops: [[0, '#04050a'], [1, '#0a0810']] }, ...starfield(r, 900)]
    const cx = 205, cy = 150, R = 120
    // the rings, behind and in front of the planet: thin tilted ellipses
    const rings = (front) => [0, 1, 2, 3].map(i => ({ s: 'ell', x: cx, y: cy, rx: R * (1.35 + i * 0.09), ry: R * (0.3 + i * 0.02), rot: -22, f: ['#d8c098', '#b89870', '#e8d8b8', '#9a8060'][i], a: front ? 0.55 : 0.3, stroke: 2.2 - i * 0.4 }))
    out.push(...rings(false))
    out.push({ s: 'circ', x: cx, y: cy, r: R + 3, f: '#e8a868', a: 0.25, blur: 3 })   // atmosphere glow
    const bands = []
    for (let y = cy - R, i = 0; y < cy + R; i++) {
      const h = between(r, 3, 9)
      bands.push({ s: 'poly', pts: [[cx - R, y], [cx + R, y + between(r, -2, 2)], [cx + R, y + h], [cx - R, y + h]], f: pick(r, ['#c8783a', '#e0a868', '#a85a2a', '#f0d0a0', '#8a4a28', '#d89050']), a: 1 })
      y += h
    }
    for (let i = 0; i < 40; i++) bands.push({ s: 'ell', x: between(r, cx - R, cx), y: between(r, cy - R, cy), rx: between(r, 3, 12), ry: between(r, 0.6, 1.6), rot: between(r, -6, 6), f: pick(r, ['#f8e0b8', '#7a3a1a', '#c86a30']), a: 0.5, blur: 0.8 })
    bands.push({ s: 'ell', x: cx - 70, y: cy - 60, rx: 9, ry: 5, rot: -8, f: '#a83a20', a: 0.85, blur: 0.5 }, { s: 'ell', x: cx - 70, y: cy - 60, rx: 5, ry: 2.6, rot: -8, f: '#e86a40', a: 0.8, blur: 0.4 })   // a great storm
    // the night side: dark from the lower right
    bands.push({ s: 'circ', x: cx + 40, y: cy + 40, r: R * 1.05, f: '#05030a', a: 0.75, blur: 25 })
    out.push({ s: 'clip', x: cx, y: cy, r: R, parts: bands })
    out.push(...rings(true).map(p => ({ s: 'line', pts: ellArc(p.x, p.y, p.rx, p.ry, p.rot, 0, Math.PI), w: p.stroke, f: p.f, a: 0.6 })))
    return out
  },
  sunward (r) {
    const out = [{ s: 'bg', dir: 'h', stops: [[0, '#3a1206'], [0.25, '#1a0806'], [1, '#06040a']] }]
    // the star off the left edge: layered glow
    for (const [rad, c, a] of [[110, '#ff6a1a', 0.25], [75, '#ff9a3a', 0.35], [52, '#ffd070', 0.55], [44, '#fff2c0', 0.9]]) out.push({ s: 'circ', x: -30, y: 60, r: rad, f: c, a, blur: rad * 0.25 })
    out.push({ s: 'circ', x: -30, y: 60, r: 40, f: '#ffffff', a: 1, blur: 3 })
    // flares: arcs of plasma leaping off the limb
    for (let i = 0; i < 9; i++) {
      const a0 = between(r, -1.1, 1.1), len = between(r, 0.25, 0.7), out1 = between(r, 8, 28), pts = []
      for (let k = 0; k <= 12; k++) { const t = k / 12, a = a0 + (t - 0.5) * len, d = 40 + Math.sin(t * Math.PI) * out1; pts.push([-30 + Math.cos(a) * d, 60 + Math.sin(a) * d]) }
      out.push({ s: 'line', pts, w: between(r, 0.8, 2.2), f: '#ffb040', a: 0.5, blur: 1 }, { s: 'line', pts, w: 0.4, f: '#fff0b0', a: 0.8 })
    }
    // the solar wind: streaks blowing outward
    for (let i = 0; i < 140; i++) { const y = between(r, 0, 120), x = between(r, 15, 180), l = between(r, 3, 12); out.push({ s: 'line', pts: [[x, y], [x + l, y + (y - 60) * 0.02 * l / 10]], w: 0.12, f: '#ffc890', a: between(r, 0.08, 0.3) * (1 - x / 220) }) }
    out.push(...starfield(r, 500, { bright: 0.02 }).map(p => p.x < 60 ? { ...p, a: p.a * 0.2 } : p))
    return out
  },
  'aether-storm' (r) {
    // turbulent currents round several eyes that spin against each other, glowing; dark rents; aether lightning
    const out = [{ s: 'bg', dir: 'v', stops: [[0, '#0c0412'], [0.5, '#16061a'], [1, '#0a0310']] }]
    const eyes = Array.from({ length: 5 }, (_, i) => ({ x: between(r, 20, 160), y: between(r, 15, 105), s: (i % 2 ? -1 : 1) * between(r, 50, 110), c: between(r, 4, 9) }))
    const field = (x, y) => { let vx = 6, vy = 1; for (const e of eyes) { const dx = x - e.x, dy = y - e.y, d2 = dx * dx + dy * dy + e.c * e.c; vx += -dy * e.s / d2 * 3; vy += dx * e.s / d2 * 3 } return [vx, vy] }
    const cols = ['#d0306a', '#8a2ad0', '#ff5aa8', '#5a1a9a', '#30c8d0', '#ff8a3a']
    out.push(...streamlines(r, field, { n: 260, steps: 34, step: 1.1, cols, w: [0.6, 2.4], a: [0.12, 0.3], glow: true }))
    for (const e of eyes) out.push({ s: 'circ', x: e.x, y: e.y, r: e.c * 1.6, f: '#ff80d0', a: 0.35, blur: e.c * 0.6 }, { s: 'circ', x: e.x, y: e.y, r: e.c * 0.55, f: '#050008', a: 0.95, blur: 0.6 })
    for (let i = 0; i < 12; i++) {
      let x = between(r, 0, 180), y = between(r, 0, 120); const pts = [[x, y]], a0 = r() * Math.PI * 2
      for (let k = 0; k < 10; k++) { const a = a0 + between(r, -0.9, 0.9), l = between(r, 2, 6); x += Math.cos(a) * l; y += Math.sin(a) * l; pts.push([x, y]) }
      out.push({ s: 'line', pts, w: 1.4, f: '#e090ff', a: 0.45, blur: 0.9 }, { s: 'line', pts, w: 0.25, f: '#ffffff', a: 0.95 })
    }
    out.push(...starfield(r, 350, { tint: ['#ffd0f0', '#d0ffe8', '#ffffff'], bright: 0.02 }))
    return out
  },
  'green-fluid' (r) {
    // — slow laminar currents of green light round a few
    // broad eddies, bright where they bunch together, with bubbles of brighter gas drifting in them
    const out = [{ s: 'bg', dir: 'h', stops: [[0, '#021208'], [0.5, '#04180e'], [1, '#020c0a']] }]
    const eddies = Array.from({ length: 3 }, (_, i) => ({ x: 30 + i * 60 + between(r, -10, 10), y: between(r, 30, 90), s: (i % 2 ? -1 : 1) * between(r, 160, 260), c: between(r, 14, 22) }))
    const field = (x, y) => { let vx = 4, vy = Math.sin(x / 30) * 1.5; for (const e of eddies) { const dx = x - e.x, dy = y - e.y, d2 = dx * dx + dy * dy + e.c * e.c; vx += -dy * e.s / d2; vy += dx * e.s / d2 } return [vx, vy] }
    out.push(...streamlines(r, field, { n: 220, steps: 60, step: 1.4, cols: ['#2ad06a', '#7aff9a', '#18a878', '#b8ff50', '#30e0c0', '#0a7a4a'], w: [0.8, 3.2], a: [0.1, 0.24], glow: true, glowBlur: 2 }))
    for (let i = 0; i < 70; i++) { const x = between(r, 0, 180), y = between(r, 0, 120), rr = between(r, 0.3, 1.4); out.push({ s: 'ell', x, y, rx: rr, ry: rr, rot: 0, f: '#b0ffc8', a: 0.5, stroke: 0.12 }, { s: 'circ', x: x - rr * 0.3, y: y - rr * 0.3, r: rr * 0.25, f: '#ffffff', a: 0.6 }) }
    out.push(...starfield(r, 300, { tint: ['#d0ffe0', '#ffffff', '#e8ffb0'], bright: 0.02 }))
    return out
  },
  'hive-city' (r) {
    // Districts in turned
    // street grids; each lot is one of many kinds of building, seen from far above: blocks, L and cross shapes,
    // courtyards, domes, towers with long shadows, tanks and pipes in the industrial quarters, landing pads,
    // cathedrals. Shapes of one colour are gathered into one part so tens of thousands stay quick to draw.
    const out = [{ s: 'bg', dir: 'v', stops: [[0, '#08080b'], [1, '#0c0b0e']] }]
    const shades = ['#34363e', '#3e4048', '#484a50', '#2c2e34', '#4e4a44', '#3a3832']
    const groups = new Map(), lights = [], warm = [], shadow = []
    const put = (f, pts) => { if (!groups.has(f)) groups.set(f, []); groups.get(f).push(pts) }
    // districts tile the whole table on a jittered grid, so the city runs edge to edge
    const spots = []
    for (let gx = 0; gx < 7; gx++) for (let gy = 0; gy < 5; gy++) spots.push([gx * 29 + between(r, -6, 6), gy * 29 + between(r, -6, 6)])
    for (const [cx, cy] of spots) {
      const rot = between(r, -0.6, 0.6), size = between(r, 17, 21)
      const kind = pick(r, ['hab', 'hab', 'hab', 'industry', 'noble', 'port'])
      const c = Math.cos(rot), sn = Math.sin(rot), P = (u, v) => [cx + u * c - v * sn, cy + u * sn + v * c]
      const rect = (u, v, w, h) => [P(u, v), P(u + w, v), P(u + w, v + h), P(u, v + h)]
      const cell = kind === 'noble' ? 1.25 : 1.0
      for (let u = -size; u < size; u += cell) for (let v = -size * 0.85; v < size * 0.85; v += cell) {
        if (Math.hypot(u / size, v / (size * 0.85)) > 1 + between(r, -0.15, 0.1) || r() < 0.06) continue
        const f = pick(r, shades), w = cell * between(r, 0.55, 0.85), h = cell * between(r, 0.55, 0.85)
        const t = r()
        if (kind === 'industry' && t < 0.35) { const [x, y] = P(u + cell / 2, v + cell / 2); put('#3a3632', blob(r, x, y, cell * 0.36, cell * 0.36, 8, 0.05)); put('#24221f', blob(r, x, y, cell * 0.2, cell * 0.2, 8, 0.05)) }
        else if (kind === 'industry' && t < 0.5) { const [x1, y1] = P(u, v + cell / 2), [x2, y2] = P(u + cell, v + cell / 2); out.push({ s: 'line', pts: [[x1, y1], [x2, y2]], w: 0.08, f: '#5a4a3a', a: 0.9 }) }
        else if (kind === 'port' && t < 0.12) { const [x, y] = P(u + cell / 2, v + cell / 2); put('#3a3e46', blob(r, x, y, cell * 0.45, cell * 0.45, 10, 0.02)); warm.push([x, y]) }
        else if (t < 0.12) { put(f, rect(u, v, w, h)); put('#141418', rect(u + w * 0.3, v + h * 0.3, w * 0.4, h * 0.4)) }   // courtyard
        else if (t < 0.22) { put(f, rect(u, v, w, h * 0.35)); put(f, rect(u, v, w * 0.35, h)) }                              // L shape
        else if (t < 0.28) { put(f, rect(u + w * 0.33, v, w * 0.34, h)); put(f, rect(u, v + h * 0.33, w, h * 0.34)) }       // cross
        else if (t < 0.36) { const [x, y] = P(u + w / 2, v + h / 2); put('#3a3a40', blob(r, x, y, w * 0.45, w * 0.45, 10, 0.02)); put('#4a4a52', blob(r, x - w * 0.1, y - w * 0.1, w * 0.22, w * 0.22, 8, 0.02)) }   // dome
        else if (t < 0.46) { const [x, y] = P(u + w / 2, v + h / 2), s2 = w * 0.25; shadow.push([[x, y - s2], [x + s2, y], [x + s2 + 1.6, y + 1.2], [x + 1.6, y + 1.2 - s2]]); put('#4a4848', [[x - s2, y - s2], [x + s2, y - s2], [x + s2, y + s2], [x - s2, y + s2]]); lights.push([x, y]) }   // tower and its long shadow
        else put(f, rect(u, v, w, h))
        if (r() < 0.45) lights.push(P(u + w * r(), v + h * r()))
      }
      if (kind === 'noble') {   // a cathedral: a great cross with a spire at the crossing
        const L = size * 0.3, W = size * 0.07
        put('#6a6258', rect(-L, -W / 2, 2 * L, W)); put('#6a6258', rect(-W / 2, -L * 0.6, W, L * 1.2)); const [x, y] = P(0, 0); warm.push([x, y])
      }
    }
    out.push({ s: 'polys', list: shadow, f: '#060608', a: 0.55 })
    for (const [f, list] of groups) out.push({ s: 'polys', list, f, a: 1 })
    // the great avenues and transit lines, lit
    for (let i = 0; i < 10; i++) {
      let x = between(r, 0, 180), y = between(r, 0, 120), a = between(r, 0, Math.PI * 2); const pts = [[x, y]]
      for (let k = 0; k < 16; k++) { a += between(r, -0.25, 0.25); x += Math.cos(a) * 8; y += Math.sin(a) * 8; pts.push([x, y]) }
      out.push({ s: 'line', pts, w: 1, f: '#ff9a3a', a: 0.2, blur: 0.6 }, { s: 'line', pts, w: 0.18, f: '#ffd890', a: 0.85 })
    }
    out.push({ s: 'dots', pts: lights, r: 0.08, f: '#ffe09a', a: 1 }, { s: 'dots', pts: warm, r: 0.2, f: '#ffb050', a: 1 })
    // smog, high cloud, then the long blue haze of distance
    for (let i = 0; i < 14; i++) out.push({ s: 'circ', x: between(r, 0, 180), y: between(r, 0, 120), r: between(r, 6, 16), f: pick(r, ['#5a5040', '#3a3a3a']), a: 0.16, blur: 5 })
    for (let i = 0; i < 12; i++) out.push({ s: 'ell', x: between(r, 0, 180), y: between(r, 0, 120), rx: between(r, 8, 20), ry: between(r, 2, 5), rot: 20, f: '#c8ccd8', a: 0.16, blur: 2.5 })
    out.push({ s: 'bg', dir: 'v', stops: [[0, '#2a4a8a'], [1, '#1a2a5a']], a: 0.1 })
    return out
  },
  mountains (r) {
    // (the drawn peaks). Redone as relief: a height map lit from the top left,
    // coloured valley green to bare rock to snow, as a satellite picture of a range looks.
    const strokes = []
    for (let i = 0; i < 160; i++) strokes.push({ s: 'circ', x: between(r, -5, 185), y: between(r, -5, 125), r: between(r, 3, 9), a: 0.05, blur: 3 })   // rolling foothills
    for (let k = 0; k < 4; k++) {
      const y0 = 15 + k * 30 + between(r, -5, 5)
      let x = between(r, -15, 5), y = y0, a = between(r, -0.3, 0.3), mass = between(r, 0.8, 1.2)
      while (x < 195) {
        a += between(r, -0.3, 0.3) + (y0 - y) * 0.02; a = Math.max(-0.7, Math.min(0.7, a))
        x += Math.cos(a) * 2.5; y += Math.sin(a) * 2.5; mass = Math.max(0.5, Math.min(1.4, mass + between(r, -0.12, 0.12)))
        strokes.push({ s: 'circ', x, y, r: between(r, 3, 5) * mass, a: 0.15, blur: 2.4 })                       // the massif
        strokes.push({ s: 'circ', x: x + between(r, -1.5, 1.5), y: y + between(r, -1.5, 1.5), r: between(r, 0.6, 1.4) * mass, a: 0.22, blur: 0.5 })   // peaks
        // spurs either side, each branching again, running down to the valleys: the fine relief that reads as mountains
        for (const sgn of [1, -1]) {
          if (r() < 0.25) continue
          let sa = a + sgn * between(r, 1.1, 1.7), sx = x, sy = y, w = between(r, 0.9, 1.5) * mass
          for (let j = 0; j < 3; j++) {
            const l = between(r, 1.8, 3.2) * mass, nx = sx + Math.cos(sa) * l, ny = sy + Math.sin(sa) * l
            strokes.push({ s: 'line', pts: [[sx, sy], [nx, ny]], w, a: 0.13, blur: 0.45 })
            if (r() < 0.6) { const ba = sa + (r() < 0.5 ? 1 : -1) * between(r, 0.6, 1.1), bl = l * 0.8; strokes.push({ s: 'line', pts: [[nx, ny], [nx + Math.cos(ba) * bl, ny + Math.sin(ba) * bl]], w: w * 0.6, a: 0.1, blur: 0.35 }) }
            sx = nx; sy = ny; w *= 0.75; sa += between(r, -0.35, 0.35)
          }
        }
      }
    }
    const out = [{ s: 'relief', strokes, depth: 4.5, soften: 0.1, light: 0.3, ramp: [[0, '#3a4a2c'], [0.15, '#4e5634'], [0.3, '#6a6048'], [0.45, '#857a66'], [0.53, '#a09a90'], [0.58, '#e2e6ec'], [1, '#ffffff']] }]
    for (let i = 0; i < 4; i++) {   // rivers in the valleys
      let x = between(r, 0, 180), y = -2; const pts = [[x, y]]
      while (y < 122) { y += 4; x += between(r, -3, 3); pts.push([x, y]) }
      out.push({ s: 'line', pts, w: 0.45, f: '#5a8aa8', a: 0.55 })
    }
    for (let i = 0; i < 8; i++) {   // cloud: clusters of puffs, and their shadows
      const x = between(r, 0, 180), y = between(r, 0, 120), puffs = []
      for (let k = 0; k < 9; k++) puffs.push([x + between(r, -10, 10), y + between(r, -4, 4), between(r, 2.5, 5)])
      for (const [px, py, pr] of puffs) out.push({ s: 'circ', x: px + 5, y: py + 5, r: pr, f: '#14140e', a: 0.16, blur: 2 })
      for (const [px, py, pr] of puffs) out.push({ s: 'circ', x: px, y: py, r: pr, f: '#f4f6fa', a: 0.45, blur: 1.4 })
    }
    out.push({ s: 'bg', dir: 'v', stops: [[0, '#4a6aa8'], [1, '#2a3a6a']], a: 0.12 })
    return out
  },
  'floating-islands' (r) {
    const out = [{ s: 'bg', dir: 'v', stops: [[0, '#1a3a6a'], [0.5, '#2a5a8a'], [1, '#3a7aa0']] }]
    // the sea of cloud far below
    for (let i = 0; i < 70; i++) out.push({ s: 'circ', x: between(r, -10, 190), y: between(r, -10, 130), r: between(r, 6, 15), f: pick(r, ['#dfe8f2', '#c4d4e6', '#eef4fa']), a: between(r, 0.2, 0.45), blur: 3.5 })
    // islands: a green top, a dark rock underside showing to the lower right, waterfalls, trees, a shadow on the cloud
    const islands = []
    for (let tries = 0; islands.length < 9 && tries < 200; tries++) {
      const x = between(r, 14, 166), y = between(r, 14, 104), s = between(r, 6, 13)
      if (islands.some(o => Math.hypot(o.x - x, o.y - y) < o.s + s + 8)) continue
      islands.push({ x, y, s })
    }
    for (const { x, y, s } of islands) {
      const top = blob(r, x, y, s, s * 0.8, 16, 0.35)
      out.push({ s: 'poly', pts: top.map(([px, py]) => [px + s * 0.9, py + s * 1.1]), f: '#24425a', a: 0.35, blur: 2 })                // its shadow on the cloud
      out.push({ s: 'poly', pts: top.map(([px, py]) => [x + (px - x) * 0.6 + s * 0.35, y + (py - y) * 0.6 + s * 0.9]), f: '#3a2c24', a: 1 },
        { s: 'poly', pts: top.map(([px, py]) => [px + (px - x) * 0.1 + s * 0.25, py + (py - y) * 0.2 + s * 0.45]), f: '#4a3a30', a: 1 },   // the rock underside
        { s: 'poly', pts: top.map(([px, py]) => [px + s * 0.12, py + s * 0.22]), f: '#6a5240', a: 1 })
      out.push({ s: 'poly', pts: top, f: '#4a8a3a', a: 1 }, { s: 'poly', pts: blob(r, x - s * 0.15, y - s * 0.15, s * 0.7, s * 0.55, 12, 0.3), f: '#68a84a', a: 1 })
      for (let i = 0; i < s * 1.6; i++) { const a = r() * Math.PI * 2, d = r() * s * 0.7; out.push({ s: 'circ', x: x + Math.cos(a) * d, y: y + Math.sin(a) * d * 0.8, r: between(r, 0.5, 1.1), f: pick(r, ['#2e5a26', '#3a6a2e', '#24481e']), a: 1 }) }
      if (r() < 0.7) {   // a river running to the edge and a waterfall off it
        const a = between(r, 0, Math.PI / 2), ex = x + Math.cos(a) * s * 0.85, ey = y + Math.sin(a) * s * 0.7
        out.push({ s: 'line', pts: [[x, y], [ex, ey]], w: 0.35, f: '#7ab8e8', a: 0.9 }, { s: 'line', pts: [[ex, ey], [ex + 1.5, ey + s * 0.9]], w: 0.6, f: '#f0f8ff', a: 0.8, blur: 0.3 }, { s: 'circ', x: ex + 1.6, y: ey + s * 0.95, r: 1.2, f: '#ffffff', a: 0.5, blur: 0.8 })
      }
    }
    // high wisps passing over
    for (let i = 0; i < 10; i++) out.push({ s: 'ell', x: between(r, 0, 180), y: between(r, 0, 120), rx: between(r, 10, 22), ry: between(r, 1.5, 3), rot: -10, f: '#ffffff', a: 0.25, blur: 1.8 })
    return out
  },
}

const sceneCache = new Map()
/** The parts of a table's background, in cm over the 180 x 120 cm table. */
export function tableScene (id) {
  if (!SCENES[id]) throw new Error(`no table called ${id}`)
  if (!sceneCache.has(id)) sceneCache.set(id, SCENES[id](rng('table-' + id)))
  return sceneCache.get(id)
}

// ======================================== THE PIECES ========================================
// Each piece is drawn round (0, 0) in cm. Sizes from the rules:
// gas/dust cloud band D6x2 cm wide, D6x5 cm long; asteroid field D3x5 by D3x5 cm;
// aether rift D3x5 cm wide, D3x10 cm long; planets small up to 15 cm, medium 16-25, large 26-50 cm across
//; moons up to 5 cm across; a Blast Marker 2 cm ( "How the computer does it" 4);
// a torpedo marker no more than 2.5 cm wide; the sunburst cannon template 5 cm with a 1.2 cm hole.
export const PLANET_TYPES = ['rocky', 'ice', 'lava', 'ocean', 'hive', 'gas']

function asteroid (r, x, y, s) {
  const pts = blob(r, x, y, s, s * between(r, 0.6, 0.95), 9, 0.5, r() * 6)
  const out = [{ s: 'poly', pts, f: '#5a5048', a: 1 }, { s: 'poly', pts: pts.map(([px, py]) => [x + (px - x) * 0.7 - s * 0.15, y + (py - y) * 0.7 - s * 0.18]), f: '#7a6e62', a: 1 }]
  for (let i = 0; i < Math.round(s * 2); i++) { const a = r() * 6.28, d = r() * s * 0.5; out.push({ s: 'circ', x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, r: s * between(r, 0.08, 0.2), f: '#3e3630', a: 1 }) }
  return out
}

const PIECES = {
  /** An asteroid field w x h cm: dust under a scatter of rocks, bigger in the middle. */
  asteroids ({ w = 10, h = 10, seed = 1 }) {
    const r = rng('ast' + seed + w + h), out = [{ s: 'ell', x: 0, y: 0, rx: w / 2 * 0.9, ry: h / 2 * 0.9, rot: 0, f: '#4a4034', a: 0.22, blur: Math.min(w, h) * 0.1 }]
    const n = Math.round(w * h / 3.5)
    for (let i = 0; i < n; i++) {
      const a = r() * 6.28, d = Math.sqrt(r()) * 0.95, x = Math.cos(a) * d * w / 2, y = Math.sin(a) * d * h / 2
      out.push(...asteroid(r, x, y, between(r, 0.25, 0.9) * (1.3 - d * 0.6)))
    }
    return out
  },
  /** One big asteroid, s cm across. */
  rock ({ s = 3, seed = 1 }) { return asteroid(rng('rock' + seed), 0, 0, s / 2) },
  /** A band of gas and dust w cm wide, l cm long, lying along x. */
  cloud ({ w = 6, l = 20, seed = 1, tint = 'dust' }) {
    const r = rng('cloud' + seed + w + l), out = []
    const cols = tint === 'gas' ? ['#8a6ab8', '#6a8ac8', '#a87ac0'] : ['#a89070', '#8a7a68', '#b8a080']
    for (let i = 0; i < l * 2; i++) { const x = between(r, -l / 2, l / 2), y = between(r, -w / 2, w / 2) * (1 - Math.abs(x) / l); out.push({ s: 'circ', x, y, r: between(r, w * 0.12, w * 0.35), f: pick(r, cols), a: 0.13, blur: w * 0.12 }) }
    for (let i = 0; i < l * 3; i++) out.push({ s: 'circ', x: between(r, -l / 2, l / 2), y: between(r, -w / 2, w / 2) * 0.8, r: 0.12, f: pick(r, cols), a: 0.6 })   // grains of dust
    return out
  },
  /** An aether rift w cm wide, l cm long: a jagged tear with the aether glaring through. */
  rift ({ w = 10, l = 20, seed = 1 }) {
    const r = rng('rift' + seed + w + l), top = [], bot = []
    for (let i = 0; i <= 12; i++) { const x = -l / 2 + i * l / 12, k = Math.sin(i / 12 * Math.PI); top.push([x, -w / 2 * k * between(r, 0.5, 1)]); bot.push([x, w / 2 * k * between(r, 0.5, 1)]) }
    const shape = [...top, ...bot.reverse()]
    return [{ s: 'poly', pts: shape, f: '#c060ff', a: 0.45, blur: w * 0.18 }, { s: 'poly', pts: shape.map(([x, y]) => [x * 0.95, y * 0.8]), f: '#f0d8ff', a: 0.9 },
      { s: 'poly', pts: shape.map(([x, y]) => [x * 0.88, y * 0.6]), f: '#3a0a5a', a: 1 },
      ...Array.from({ length: 14 }, () => ({ s: 'circ', x: between(r, -l * 0.35, l * 0.35), y: between(r, -w * 0.15, w * 0.15), r: between(r, w * 0.08, w * 0.2), f: pick(r, ['#ff40a0', '#40ffc0', '#a040ff']), a: 0.45, blur: w * 0.08 }))]
  },
  /** A planet d cm across, of one of PLANET_TYPES, with rings if asked (a large planet). */
  planet ({ d = 20, type = 'rocky', rings = false, seed = 1 }) {
    const r = rng('planet' + type + seed + d), R = d / 2, out = []
    const pal = { rocky: ['#8a6a4a', '#a88a5a', '#6a5038'], ice: ['#c8dcec', '#e8f2fa', '#9ab8d0'], lava: ['#3a1a14', '#5a2418', '#ff6a1a'],
      ocean: ['#1a4a8a', '#2a6aa8', '#4a8a3a'], hive: ['#2a2a30', '#3a3438', '#ffb050'], gas: ['#c8783a', '#e0b070', '#9a5228'] }[type]
    const ring = front => front ? { s: 'line', pts: ellArc(0, 0, R * 1.9, R * 0.5, -18, 0, Math.PI), w: R * 0.12, f: '#d8c8a0', a: 0.8 }
      : { s: 'ell', x: 0, y: 0, rx: R * 1.9, ry: R * 0.5, rot: -18, f: '#b8a880', a: 0.45, stroke: R * 0.12 }
    if (rings) out.push(ring(false))
    out.push({ s: 'circ', x: 0, y: 0, r: R * 1.025, f: pal[1], a: 0.4, blur: R * 0.02 })   // a thin lit atmosphere
    const body = [{ s: 'circ', x: 0, y: 0, r: R, f: pal[0], a: 1 }]
    if (type === 'gas') for (let y = -R; y < R;) { const h = between(r, R * 0.06, R * 0.16); body.push({ s: 'poly', pts: [[-R, y], [R, y], [R, y + h], [-R, y + h]], f: pick(r, pal), a: 0.9 }); y += h }
    else if (type === 'ocean') for (let i = 0; i < 6; i++) body.push({ s: 'poly', pts: blob(r, between(r, -R * 0.6, R * 0.6), between(r, -R * 0.6, R * 0.6), R * between(r, 0.15, 0.35), R * between(r, 0.1, 0.3), 12, 0.6), f: pick(r, ['#4a8a3a', '#7a8a4a', '#c8b078']), a: 1 })
    else for (let i = 0; i < R * 3; i++) body.push({ s: 'circ', x: between(r, -R, R), y: between(r, -R, R), r: R * between(r, 0.05, type === 'lava' ? 0.12 : 0.22), f: pick(r, type === 'lava' ? pal.slice(0, 2) : pal.slice(1)), a: 0.6, blur: R * 0.03 })
    if (type === 'lava') for (let i = 0; i < 14; i++) { let a = r() * 6.28; const pts = [[between(r, -R, R) * 0.8, between(r, -R, R) * 0.8]]; for (let k = 0; k < 6; k++) { a += between(r, -0.8, 0.8); pts.push([pts.at(-1)[0] + Math.cos(a) * R * 0.14, pts.at(-1)[1] + Math.sin(a) * R * 0.14]) } body.push({ s: 'line', pts, w: R * 0.05, f: '#ff6a1a', a: 0.6, blur: R * 0.03 }, { s: 'line', pts, w: R * 0.018, f: '#ffd060', a: 1 }) }
    if (type === 'hive') for (let i = 0; i < R * 14; i++) body.push({ s: 'circ', x: between(r, -R, R), y: between(r, -R, R), r: R * 0.012 + 0.04, f: pick(r, ['#ffcf6a', '#ffe8a8']), a: 0.9 })
    if (type === 'ocean' || type === 'ice' || type === 'rocky') for (let i = 0; i < 9; i++) body.push({ s: 'ell', x: between(r, -R, R), y: between(r, -R, R), rx: R * between(r, 0.2, 0.4), ry: R * 0.06, rot: between(r, -20, 20), f: '#ffffff', a: 0.45, blur: R * 0.03 })
    body.push({ s: 'circ', x: R * 0.45, y: R * 0.45, r: R * 1.15, f: '#020208', a: 0.8, blur: R * 0.35 })   // the night side
    body.push({ s: 'circ', x: -R * 0.35, y: -R * 0.35, r: R * 0.5, f: '#ffffff', a: 0.12, blur: R * 0.3 })  // the lit side
    out.push({ s: 'clip', x: 0, y: 0, r: R, parts: body })
    if (rings) out.push(ring(true))
    return out
  },
  /** A moon, d cm across (up to 5 cm). */
  moon ({ d = 4, seed = 1 }) {
    const r = rng('moon' + seed), R = d / 2, body = [{ s: 'circ', x: 0, y: 0, r: R, f: '#9a968e', a: 1 }]
    for (let i = 0; i < 9; i++) { const x = between(r, -R * 0.7, R * 0.7), y = between(r, -R * 0.7, R * 0.7), c = R * between(r, 0.08, 0.22); body.push({ s: 'circ', x, y, r: c, f: '#6a665e', a: 1 }, { s: 'circ', x: x - c * 0.25, y: y - c * 0.25, r: c * 0.7, f: '#b8b4aa', a: 0.6 }) }
    body.push({ s: 'circ', x: R * 0.45, y: R * 0.45, r: R * 1.15, f: '#020208', a: 0.8, blur: R * 0.35 })
    return [{ s: 'clip', x: 0, y: 0, r: R, parts: body }]
  },
  /** A floating island standing in for a planet (or an islet for a moon) on the Floating islands table, d cm across:
   * a grassy top with woods, lakes and a river, rock cliffs below, waterfalls off the edge, its shadow on the cloud. */
  island ({ d = 20, seed = 1 }) {
    const r = rng('island' + seed + d), R = d / 2, out = []
    const top = blob(r, 0, 0, R, R * 0.85, 22, 0.28)
    const sc = (k, dx, dy) => top.map(([x, y]) => [x * k + dx, y * k + dy])
    out.push({ s: 'poly', pts: sc(1, R * 0.5, R * 0.75), f: '#22405a', a: 0.4, blur: R * 0.12 })                  // shadow on the cloud below
    out.push({ s: 'poly', pts: sc(0.55, R * 0.3, R * 0.8), f: '#2e241e', a: 1 }, { s: 'poly', pts: sc(0.8, R * 0.18, R * 0.45), f: '#3e3028', a: 1 },
      { s: 'poly', pts: sc(0.98, R * 0.08, R * 0.2), f: '#5a4636', a: 1 })                                               // the rock tapering away beneath
    out.push({ s: 'poly', pts: top, f: '#4a8a3a', a: 1 }, { s: 'poly', pts: blob(r, -R * 0.15, -R * 0.15, R * 0.7, R * 0.55, 14, 0.3), f: '#68a84a', a: 1 })
    for (let i = 0; i < 3; i++) out.push({ s: 'poly', pts: blob(r, between(r, -R * 0.4, R * 0.4), between(r, -R * 0.4, R * 0.4), R * 0.12, R * 0.08, 10, 0.3), f: '#4a8ab8', a: 1 })   // lakes
    for (let i = 0; i < R * 6; i++) { const a = r() * 6.28, dd = Math.sqrt(r()) * R * 0.75; out.push({ s: 'circ', x: Math.cos(a) * dd, y: Math.sin(a) * dd * 0.85, r: between(r, 0.25, 0.6) * Math.max(0.6, R / 10), f: pick(r, ['#2e5a26', '#3a6a2e', '#24481e']), a: 1 }) }
    for (let i = 0; i < Math.max(1, Math.round(R / 4)); i++) {
      const a = between(r, -0.3, Math.PI / 2 + 0.3), ex = Math.cos(a) * R * 0.9, ey = Math.sin(a) * R * 0.78
      out.push({ s: 'line', pts: [[ex * 0.3, ey * 0.3], [ex * 0.65 + between(r, -1, 1), ey * 0.65], [ex, ey]], w: Math.max(0.2, R * 0.03), f: '#7ab8e8', a: 0.9 },
        { s: 'line', pts: [[ex, ey], [ex + R * 0.1, ey + R * 0.75]], w: Math.max(0.3, R * 0.05), f: '#f0f8ff', a: 0.85, blur: R * 0.01 }, { s: 'circ', x: ex + R * 0.1, y: ey + R * 0.8, r: R * 0.1, f: '#ffffff', a: 0.5, blur: R * 0.06 })
    }
    return out
  },
  /** A hive spire standing in for a planet (or a lesser spire for a moon) on the Over a hive city table, d cm across:
   * a mountain of a building seen from straight above — tiers stepping in to a lit crown, buttresses, landing
   * platforms, thousands of windows, and a long shadow. */
  spire ({ d = 20, seed = 1 }) {
    const r = rng('spire' + seed + d), R = d / 2, out = [], lights = []
    const oct = (k, rot = 0) => Array.from({ length: 8 }, (_, i) => { const a = i / 8 * Math.PI * 2 + Math.PI / 8 + rot; return [Math.cos(a) * R * k, Math.sin(a) * R * k] })
    out.push({ s: 'poly', pts: oct(1).map(([x, y]) => [x + R * 0.5, y + R * 0.5]), f: '#030305', a: 0.6, blur: R * 0.1 })   // its shadow
    out.push({ s: 'circ', x: 0, y: 0, r: R * 1.08, f: '#ff9a3a', a: 0.18, blur: R * 0.1 })                               // the glow of its lower levels
    const tiers = 6
    for (let t = 0; t < tiers; t++) {
      const k = 1 - t / tiers * 0.85, f = lerpC('#1e1e24', '#5a5650', t / tiers)
      out.push({ s: 'poly', pts: oct(k, t * 0.06), f, a: 1 }, { s: 'poly', pts: oct(k * 0.97, t * 0.06), f: lerpC(f, '#000000', 0.25), a: 0.6 })
      for (let i = 0; i < 8; i++) {   // buttresses down each face
        const a = i / 8 * Math.PI * 2 + t * 0.06
        if (t === 0 || r() < 0.5) out.push({ s: 'line', pts: [[Math.cos(a) * R * k * 0.95, Math.sin(a) * R * k * 0.95], [Math.cos(a) * R * (k - 0.85 / tiers) * 1.02, Math.sin(a) * R * (k - 0.85 / tiers) * 1.02]], w: R * 0.02, f: '#6a625a', a: 1 })
      }
      for (let i = 0; i < 7 * R * k; i++) { const a = r() * 6.28, dd = R * (k - between(r, 0.01, 0.85 / tiers)); lights.push([Math.cos(a) * dd, Math.sin(a) * dd]) }
      if (t % 2 === 1) { const a = r() * 6.28, dd = R * k * 0.92; out.push({ s: 'circ', x: Math.cos(a) * dd, y: Math.sin(a) * dd, r: R * 0.06, f: '#3a3e46', a: 1 }, { s: 'circ', x: Math.cos(a) * dd, y: Math.sin(a) * dd, r: R * 0.025, f: '#ffcf6a', a: 1 }) }   // a landing platform
    }
    out.push({ s: 'dots', pts: lights, r: Math.max(0.05, R * 0.006), f: '#ffd88a', a: 0.9 })
    out.push({ s: 'circ', x: 0, y: 0, r: R * 0.12, f: '#ffe0a0', a: 0.6, blur: R * 0.05 }, { s: 'poly', pts: oct(0.06), f: '#fff4d0', a: 1 })   // the lit crown
    return out
  },
  /** A Blast Marker, 2 cm: a burst of fire in smoke. */
  blast ({ seed = 1 }) {
    const r = rng('blast' + seed), out = [{ s: 'circ', x: 0, y: 0, r: 1, f: '#3a3030', a: 0.8, blur: 0.15 }]
    for (let i = 0; i < 7; i++) out.push({ s: 'circ', x: between(r, -0.45, 0.45), y: between(r, -0.45, 0.45), r: between(r, 0.25, 0.45), f: pick(r, ['#ff6a1a', '#ffb040', '#e04010']), a: 0.9 })
    out.push({ s: 'circ', x: 0, y: 0, r: 0.3, f: '#fff4c0', a: 1, blur: 0.08 })
    return out
  },
  /** A torpedo salvo marker, 2.5 cm wide, pointing up. */
  torpedoes ({ n = 3 }) {
    const out = [{ s: 'poly', pts: [[-1.25, -0.6], [1.25, -0.6], [1.25, 1.2], [-1.25, 1.2]], f: '#202a38', a: 0.65 }]
    for (let i = 0; i < n; i++) { const x = -0.8 + i * 0.8; out.push({ s: 'circ', x, y: 1.1, r: 0.25, f: '#6fcfff', a: 0.7, blur: 0.12 }, { s: 'poly', pts: [[x - 0.17, 1.0], [x + 0.17, 1.0], [x + 0.17, -0.1], [x - 0.17, -0.1]], f: '#9aa0aa', a: 1 }, { s: 'poly', pts: [[x - 0.17, -0.1], [x + 0.17, -0.1], [x, -0.55]], f: '#d8b050', a: 1 }) }
    return out
  },
  /** The sunburst cannon template: 5 cm across with a 1.2 cm hole. */
  sunburst () {
    return [{ s: 'circ', x: 0, y: 0, r: 2.5, f: '#6fcfff', a: 0.18 }, { s: 'ell', x: 0, y: 0, rx: 2.45, ry: 2.45, rot: 0, f: '#6fcfff', a: 0.9, stroke: 0.1 },
      { s: 'ell', x: 0, y: 0, rx: 0.6, ry: 0.6, rot: 0, f: '#eafaff', a: 1, stroke: 0.08 }, { s: 'circ', x: 0, y: 0, r: 0.6, f: '#eafaff', a: 0.25 }]
  },
}

/** The parts of one piece, drawn round (0, 0) in cm. kind: one of PIECE_KINDS; opts: its size and seed. */
export function piece (kind, opts = {}) {
  if (!PIECES[kind]) throw new Error(`no board piece called ${kind}`)
  return PIECES[kind](opts)
}
export const PIECE_KINDS = Object.keys(PIECES)

/** The bounding box of a list of parts, in cm (blur and outlines included). */
export function partsBox (parts) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  const add = (x, y, m = 0) => { x0 = Math.min(x0, x - m); y0 = Math.min(y0, y - m); x1 = Math.max(x1, x + m); y1 = Math.max(y1, y + m) }
  for (const p of parts) {
    const m = (p.blur ?? 0) * 2 + (p.w ?? 0) + (p.stroke ?? 0)
    if (p.s === 'circ') add(p.x, p.y, p.r + m)
    else if (p.s === 'ell') add(p.x, p.y, Math.max(p.rx, p.ry) + m)
    else if (p.s === 'clip') add(p.x, p.y, p.r)
    else if (p.s === 'polys') for (const l of p.list) for (const [x, y] of l) add(x, y)
    else if (p.s === 'dots') for (const [x, y] of p.pts) add(x, y, p.r)
    else if (p.s === 'relief') { add(0, 0); add(TABLE_W, TABLE_H) }
    else if (p.pts) for (const [x, y] of p.pts) add(x, y, m)
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

// The catalogue of pieces the sprite style draws ahead of time (the SVG style draws any size on demand).
// Sizes are the rules' dice steps: asteroid fields D3x5 cm each way, clouds D6x2 by D6x5, rifts D3x5 by D3x10.
export const CATALOGUE = [
  ...[[5, 5], [10, 5], [10, 10], [15, 10], [15, 15], [5, 15]].flatMap(([w, h]) => [1, 2].map(seed => ({ key: `asteroids-${w}x${h}-${seed}`, kind: 'asteroids', opts: { w, h, seed } }))),
  ...[2, 3, 4].map(seed => ({ key: `rock-${seed}`, kind: 'rock', opts: { s: 1.5 + seed, seed } })),
  ...[[4, 15], [6, 20], [8, 30], [12, 25]].flatMap(([w, l]) => ['dust', 'gas'].map(tint => ({ key: `cloud-${tint}-${w}x${l}`, kind: 'cloud', opts: { w, l, tint } }))),
  ...[[5, 10], [10, 20], [15, 30]].map(([w, l]) => ({ key: `rift-${w}x${l}`, kind: 'rift', opts: { w, l } })),
  ...PLANET_TYPES.flatMap(type => [[12, 'small'], [20, 'medium'], [40, 'large']].map(([d, size]) => ({ key: `planet-${type}-${size}`, kind: 'planet', opts: { d, type } }))),
  ...['gas', 'rocky'].map(type => ({ key: `planet-${type}-large-ringed`, kind: 'planet', opts: { d: 40, type, rings: true } })),
  ...[1, 2, 3].map(seed => ({ key: `moon-${seed}`, kind: 'moon', opts: { d: 3 + seed * 0.6, seed } })),
  // the themed stand-ins for planets and moons (TABLES[].planet): islands over the floating islands, hive spires over the city
  ...['island', 'spire'].flatMap(kind => [[12, 'small'], [20, 'medium'], [40, 'large']].map(([d, size]) => ({ key: `${kind}-${size}`, kind, opts: { d } }))),
  ...['island', 'spire'].flatMap(kind => [1, 2].map(seed => ({ key: `${kind}-moon-${seed}`, kind, opts: { d: 4 + seed * 0.5, seed: seed + 10 } }))),
  ...[1, 2, 3].map(seed => ({ key: `blast-${seed}`, kind: 'blast', opts: { seed } })),
  { key: 'torpedoes', kind: 'torpedoes', opts: {} },
  { key: 'sunburst', kind: 'sunburst', opts: {} },
]
