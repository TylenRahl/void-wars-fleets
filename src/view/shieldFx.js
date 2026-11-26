// SHIELDS, SEEN: how a shield (and a mirage or void field) looks when it stops a hit or fails. Each style is a pure function
// of progress k (0..1) returning SVG. Exports the style lists, colours and the pick functions; the board (battle/fx.js,
// battle.js) draws from here. Units are the caller's, centimetres on the board.
// s: { x, y, r bubble radius, a the angle the hit came FROM in radians, glow, core colours, b fixed random numbers 0..1 }.
// Looks only: `b` comes from the caller's own generator, never the game's dice.
// Each fleet's colour. A fleet not listed takes its side's colour, as it always has.
export const SHIELD_COLOURS = { freemen: { glow: '#6fb0ff', core: '#e8f4ff' }, dominion: { glow: '#ff6a5a', core: '#ffe6e0' }, athanatoi: { glow: '#3fe0a0', core: '#e0fff0' }, rukka: { glow: '#ffd23a', core: '#fff6cc' },
  // (a cyan-blue, apart from the Freemen's softer blue) and violet for the Thnitoi void fields
  isos: { glow: '#22c4ff', core: '#d8f6ff' }, thnitoi: { glow: '#b46bff', core: '#f0e2ff' } }
// A fleet listed here always shows this style; every other fleet shows the chosen one (battle.js, default 'burst').
export const FLEET_SHIELD_STYLE = { isos: 'hex', rukka: 'arcs' }
const BY_SIDE = ['freemen', 'dominion']
export const shieldColour = (fleet, side = 0) => SHIELD_COLOURS[fleet] ?? SHIELD_COLOURS[BY_SIDE[side]] ?? SHIELD_COLOURS.freemen
const out = k => 1 - (1 - k) * (1 - k)
const f = v => v.toFixed(2)
const ring = (s, r, w, c, a) => `<circle cx="${f(s.x)}" cy="${f(s.y)}" r="${f(r)}" fill="none" stroke="${c}" stroke-width="${f(w)}" stroke-opacity="${f(a)}"/>`
const disc = (x, y, r, c, a) => `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${c}" fill-opacity="${f(a)}"/>`
const polar = (s, a, r) => ({ x: s.x + Math.cos(a) * r, y: s.y + Math.sin(a) * r })
const hitAt = s => polar(s, s.a, s.r)
// an arc of the bubble: centre angle a, half-width w radians, at radius r
function arc (s, a, w, r, width, c, op) {
  const p = polar(s, a - w, r), q = polar(s, a + w, r)
  return `<path d="M${f(p.x)},${f(p.y)} A${f(r)},${f(r)} 0 ${w > Math.PI / 2 ? 1 : 0} 1 ${f(q.x)},${f(q.y)}" fill="none" stroke="${c}" stroke-width="${f(width)}" stroke-opacity="${f(op)}" stroke-linecap="round"/>`
}
function jag (s, from, to, n, wob, b, seed) {
  const pts = []
  for (let i = 0; i <= n; i++) {
    const t = i / n, w = i === 0 || i === n ? 0 : (b[(seed + i) % b.length] - 0.5) * wob
    pts.push(`${f(from.x + (to.x - from.x) * t - (to.y - from.y) * w * 0.1)},${f(from.y + (to.y - from.y) * t + (to.x - from.x) * w * 0.1)}`)
  }
  return pts.join(' ')
}

export const SHIELD_STYLES = [
  { id: 'hex', name: 'Hex energy skin', text: 'Six-sided plates light up from the hit and fade across the bubble.', ms: 700, draw (s, k) {
    const size = s.r * 0.26, w = size * Math.sqrt(3), h = size * 1.5, hit = hitAt(s), reach = s.r * 2.4 * out(k), fade = 1 - k
    let g = ''
    for (let row = -5; row <= 5; row++) for (let col = -5; col <= 5; col++) {
      const x = s.x + (col + (row % 2 ? 0.5 : 0)) * w, y = s.y + row * h, d0 = Math.hypot(x - s.x, y - s.y)
      if (d0 > s.r - size * 0.4) continue
      const d = Math.hypot(x - hit.x, y - hit.y), lit = Math.max(0, 1 - Math.abs(d - reach) / (s.r * 0.7)) * fade
      if (lit < 0.03) continue
      const pts = [...Array(6)].map((_, i) => { const a = Math.PI / 3 * i + Math.PI / 6; return `${f(x + Math.cos(a) * size * 0.92)},${f(y + Math.sin(a) * size * 0.92)}` }).join(' ')
      g += `<polygon points="${pts}" fill="${s.glow}" fill-opacity="${f(lit * 0.45)}" stroke="${s.core}" stroke-width="${f(size * 0.09)}" stroke-opacity="${f(lit)}"/>`
    }
    return ring(s, s.r, s.r * 0.03, s.glow, 0.5 * fade) + g + disc(hit.x, hit.y, s.r * 0.22 * (1 - k), s.core, fade)
  } },
  { id: 'ripple', name: 'Ripple', text: 'The shield rings like water from where it was struck.', ms: 750, draw (s, k) {
    const hit = hitAt(s), fade = 1 - k
    let g = disc(s.x, s.y, s.r, s.glow, 0.1 * fade)
    for (let i = 0; i < 3; i++) {
      const t = Math.max(0, k - i * 0.14), R = s.r * 2 * out(Math.min(1, t * 1.15))
      // the wave is a circle round the hit, drawn only where it lies on the bubble
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 24) {
        const p = polar(hit, a, R), q = polar(hit, a + Math.PI / 24, R)
        if (Math.hypot(p.x - s.x, p.y - s.y) > s.r || Math.hypot(q.x - s.x, q.y - s.y) > s.r) continue
        g += `<line x1="${f(p.x)}" y1="${f(p.y)}" x2="${f(q.x)}" y2="${f(q.y)}" stroke="${s.core}" stroke-width="${f(s.r * 0.05 * fade + 0.03)}" stroke-opacity="${f(fade * (1 - i * 0.25))}"/>`
      }
    }
    return g + ring(s, s.r, s.r * 0.04, s.glow, 0.7 * fade) + disc(hit.x, hit.y, s.r * 0.2 * (1 - k), s.core, fade)
  } },
  { id: 'flare', name: 'Bubble flare', text: 'The whole bubble flashes, brightest on the side that was hit.', ms: 550, draw (s, k) {
    const fade = 1 - k, e = out(k)
    return disc(s.x, s.y, s.r * (1 + 0.06 * e), s.glow, 0.28 * fade) + ring(s, s.r * (1 + 0.06 * e), s.r * 0.08 * fade + 0.02, s.core, fade) +
      arc(s, s.a, 0.9 * (1 - k * 0.4), s.r, s.r * 0.22 * fade, s.glow, 0.7 * fade) + arc(s, s.a, 0.55, s.r, s.r * 0.1 * fade, s.core, fade)
  } },
  { id: 'arcs', name: 'Arc lightning', text: 'Lightning crawls round the bubble from the hit.', ms: 650, draw (s, k) {
    const fade = 1 - k, flick = Math.floor(k * 12)
    let g = ring(s, s.r, s.r * 0.025, s.glow, 0.45 * fade)
    for (let i = 0; i < 6; i++) {
      const side = i % 2 ? 1 : -1, span = (0.5 + s.b[i] * 1.8) * out(k) * side, from = polar(s, s.a, s.r), to = polar(s, s.a + span, s.r * (0.92 + s.b[i + 6] * 0.12))
      const pts = jag(s, from, to, 6, 2.2, s.b, flick * 3 + i * 5)
      g += `<polyline points="${pts}" fill="none" stroke="${s.glow}" stroke-width="${f(s.r * 0.09)}" stroke-opacity="${f(0.5 * fade)}"/><polyline points="${pts}" fill="none" stroke="${s.core}" stroke-width="${f(s.r * 0.03)}" stroke-opacity="${f(fade)}"/>`
    }
    const hit = hitAt(s)
    return g + disc(hit.x, hit.y, s.r * 0.16 * (1 - k * 0.5), s.core, fade)
  } },
  { id: 'burst', name: 'Burst into a Blast Marker', text: 'The hit blows out in sparks that settle where the Blast Marker lands.', ms: 700, draw (s, k) {
    const hit = hitAt(s), e = out(k), fade = 1 - k, out1 = polar(s, s.a, s.r * (1 + 0.35 * e))
    let g = arc(s, s.a, 0.7, s.r, s.r * 0.09 * fade, s.glow, 0.8 * fade)
    for (let i = 0; i < 12; i++) {
      const a = s.a + (s.b[i] - 0.5) * 2.2, d = s.r * (0.25 + s.b[i + 12] * 0.9) * e, t = polar(hit, a, d), u = polar(hit, a, d * 0.7)
      g += `<line x1="${f(u.x)}" y1="${f(u.y)}" x2="${f(t.x)}" y2="${f(t.y)}" stroke="${i % 3 ? '#ffb060' : s.core}" stroke-width="${f(s.r * 0.035)}" stroke-opacity="${f(fade)}"/>`
    }
    return g + disc(out1.x, out1.y, s.r * (0.1 + 0.28 * e), '#ff8a28', 0.75 * fade) + disc(out1.x, out1.y, s.r * 0.14 * fade, '#fff0b0', 1)
  } },
  { id: 'void', name: 'Void plates', text: 'Curved plates of force step out to meet the hit and shudder back.', ms: 800, draw (s, k) {
    const fade = 1 - k
    let g = ''
    for (let i = 0; i < 3; i++) {
      const R = s.r * (0.82 + i * 0.13) + Math.sin(k * 18 + i) * s.r * 0.02 * fade, w = 0.75 - i * 0.16 + (s.b[i] - 0.5) * 0.1
      g += arc(s, s.a, w, R, s.r * 0.11, s.glow, (0.75 - i * 0.18) * fade) + arc(s, s.a, w * 0.95, R, s.r * 0.03, s.core, fade)
    }
    return g + ring(s, s.r, s.r * 0.02, s.glow, 0.35 * fade)
  } },
]
export const shieldStyle = id => SHIELD_STYLES.find(x => x.id === id) ?? SHIELD_STYLES[0]
/** The style a fleet's shields show: its own fixed one if it has one, else `chosen` (the style picked for the game). */
export const shieldStyleFor = (fleet, chosen) => shieldStyle(FLEET_SHIELD_STYLE[fleet] ?? chosen)

// The last shield falling: the bubble cracks and its pieces fall away.
export const COLLAPSE_MS = 900
export function drawCollapse (s, k) {
  const e = out(k), fade = 1 - k
  let g = k < 0.2 ? disc(s.x, s.y, s.r, s.core, 0.4 * (1 - k / 0.2)) : ''
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + s.b[i] * 0.3, R = s.r * (1 + (0.15 + s.b[i + 10] * 0.5) * e)
    g += arc(s, a + e * (s.b[i] - 0.5), 0.26 * (1 - k * 0.5), R, s.r * 0.07 * fade, s.glow, fade) + arc(s, a + e * (s.b[i] - 0.5), 0.14, R, s.r * 0.025, s.core, fade)
  }
  return g
}

// ---------------------------------------------------------------------------------------------------------------------------
// MIRAGE FIELDS AND VOID FIELDS, SEEN.
// A field is not a bubble: it hides where the ship is. Six styles to choose from (the game uses 'mirage' unless told otherwise).
// Each is a pure function of progress k (0..1) returning SVG, like the shields above, and may draw the ship's own picture.
// s: { x, y, r, a (angle the shot came FROM), b (random numbers), glow, core, href (the ship picture), size (its side, same units as x, y),
// rot (degrees the picture is turned, 0 = as drawn), key (unique per ship on screen, for ids), saved (true: 2-6, a miss) }.
// saved = 2-6: the shot misses, a Blast Marker is placed in contact. !saved = a 1: the field fails and the hit lands.
// The shot's beam and the Blast Marker are drawn by the board, not here.
// ---------------------------------------------------------------------------------------------------------------------------
const clamp = v => Math.max(0, Math.min(1, v))
const sm = (a, b, k) => clamp((k - a) / (b - a))
const lerp = (a, b, t) => a + (b - a) * t
const BAD = '#ff5a4a'
const dirOf = a => ({ x: Math.cos(a), y: Math.sin(a) })
const at = (s, v, m) => ({ x: s.x + v.x * m, y: s.y + v.y * m })
// the ship's picture, moved by (dx, dy), scaled, turned, with an optional filter id and clip id
function pic (s, o = {}) {
  const { dx = 0, dy = 0, op = 1, sc = 1, filter, clip, rot = 0 } = o
  const x = s.x + dx, y = s.y + dy, h = s.size * sc
  if (op <= 0.01) return ''
  return `<image href="${s.href}" x="${f(x - h / 2)}" y="${f(y - h / 2)}" width="${f(h)}" height="${f(h)}" transform="rotate(${f((s.rot ?? 0) + rot)} ${f(x)} ${f(y)})" opacity="${f(op)}"${filter ? ` filter="url(#${filter})"` : ''}${clip ? ` clip-path="url(#${clip})"` : ''} style="pointer-events:none"/>`
}
// a flat colour in the shape of the ship's picture
const tintDef = (id, colour, op = 1) => `<filter id="${id}" x="-15%" y="-15%" width="130%" height="130%"><feFlood flood-color="${colour}" flood-opacity="${op}"/><feComposite in2="SourceAlpha" operator="in"/></filter>`
// only the rim of the ship's shape, in a colour
const rimDef = (id, colour, w) => `<filter id="${id}" x="-25%" y="-25%" width="150%" height="150%"><feMorphology in="SourceAlpha" operator="dilate" radius="${f(w)}" result="d"/><feComposite in="d" in2="SourceAlpha" operator="out" result="rim"/><feFlood flood-color="${colour}"/><feComposite in2="rim" operator="in"/></filter>`
const line = (x1, y1, x2, y2, w, c, op) => `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="${c}" stroke-width="${f(w)}" stroke-opacity="${f(op)}" stroke-linecap="round"/>`
// something small going pop at (x, y), starting at k0
function pop (x, y, rad, k0, k, c, c2 = '#fff') {
  const t = sm(k0, k0 + 0.2, k)
  if (k < k0 || t >= 1) return ''
  return `<circle cx="${f(x)}" cy="${f(y)}" r="${f(rad * (0.3 + t))}" fill="none" stroke="${c}" stroke-width="${f(rad * 0.18 * (1 - t) + 0.02)}" stroke-opacity="${f(1 - t)}"/>` + disc(x, y, rad * 0.5 * (1 - t), c2, 1 - t)
}
// the field failing: the hit lands on the ship (a 1 is a hit)
function landed (s, k, k0) {
  if (k < k0) return ''
  const t = sm(k0, k0 + 0.3, k), fade = 1 - t
  if (fade <= 0) return ''
  let g = disc(s.x, s.y, s.r * (0.25 + 0.5 * t), '#ffb060', 0.55 * fade) + disc(s.x, s.y, s.r * 0.22 * fade, '#fff0c0', fade) + `<circle cx="${f(s.x)}" cy="${f(s.y)}" r="${f(s.r * (0.3 + 0.9 * t))}" fill="none" stroke="${BAD}" stroke-width="${f(s.r * 0.07 * fade)}" stroke-opacity="${f(fade)}"/>`
  for (let i = 0; i < 8; i++) { const a = s.b[i] * 6.28, d0 = s.r * (0.2 + 0.7 * t * (0.5 + s.b[i + 8])); g += line(s.x + Math.cos(a) * d0 * 0.7, s.y + Math.sin(a) * d0 * 0.7, s.x + Math.cos(a) * d0, s.y + Math.sin(a) * d0, s.r * 0.03, i % 2 ? '#ffb060' : BAD, fade) }
  return g
}
const HUES = ['#ff5a5a', '#ffb04a', '#ffee5a', '#5aff9a', '#5ac8ff', '#9a7aff', '#ff7ad8']
const id = (s, n) => `fld${s.key ?? 'x'}${n}`

export const FIELD_STYLES = [
  { id: 'kaleido', name: 'Kaleidoscope', text: 'The prism colours as a field of little triangles. A miss: they light up along the shot, which passes straight through. On a 1 they flood over the ship, hide it, then break away as the hit lands.', ms: 1400, draw (s, k) {
    const R = s.r, u = dirOf(s.a), t = R * 0.2, h = t * Math.sqrt(3) / 2, n = Math.ceil(R * 1.1 / h), hitK = 0.3
    const from = at(s, u, R * 1.15), to = at(s, u, -R * 1.15)
    // where the shot's head is: a miss crosses the whole field, a hit stops at the ship
    const head = s.saved ? { x: lerp(from.x, to.x, sm(0.12, 0.62, k)), y: lerp(from.y, to.y, sm(0.12, 0.62, k)) } : { x: lerp(from.x, s.x, sm(0.12, hitK, k)), y: lerp(from.y, s.y, sm(0.12, hitK, k)) }
    const flood = s.saved ? 0 : out(sm(hitK, hitK + 0.18, k)), scatter = s.saved ? 0 : sm(0.66, 1, k)
    let g = ''
    for (let j = -n; j <= n; j++) for (let i = -2 * n; i <= 2 * n; i++) {
      const x0 = s.x + i * t / 2, y0 = s.y + j * h, d0 = Math.hypot(x0 - s.x, y0 - s.y)
      if (d0 > R * 1.05) continue
      const up = (i + j) % 2 === 0, ang = Math.atan2(y0 - s.y, x0 - s.x), seg = Math.floor(((ang + Math.PI) / (Math.PI / 3)))   // six mirrored wedges, as a kaleidoscope
      const sub = Math.round(d0 / t), hue = HUES[((seg % 2 ? 6 - (sub % 7) : sub % 7) + seg) % 7]
      let lit
      if (s.saved) {
        // like a shield ripple, but only where the shot crosses: the triangles near its path light and fade behind it
        const along = (x0 - from.x) * -u.x + (y0 - from.y) * -u.y, side = Math.abs((x0 - from.x) * -u.y - (y0 - from.y) * -u.x), done = Math.hypot(head.x - from.x, head.y - from.y)
        const near = Math.max(0, 1 - side / (R * 0.55)), behind = done - along
        lit = behind < 0 ? 0 : near * Math.max(0, 1 - behind / (R * 1.1)) * (1 - sm(0.7, 1, k))
      } else {
        // a 1: the triangles flood out from the hit and cover the ship, then break apart
        const reach = Math.hypot(x0 - head.x, y0 - head.y)
        lit = k < hitK ? 0 : clamp(flood * R * 2.4 / Math.max(reach, 0.01) - 0.4) * (1 - scatter)
      }
      if (lit < 0.03) continue
      const drift = scatter * R * (0.4 + s.b[(((i * 7 + j * 3) % 24) + 24) % 24]), dx = Math.cos(ang) * drift, dy = Math.sin(ang) * drift, spin = scatter * (s.b[(((i + j) % 24) + 24) % 24] - 0.5) * 220
      const c = { x: x0 + dx, y: y0 + dy }, q = up ? [[0, -h / 2], [-t / 2, h / 2], [t / 2, h / 2]] : [[0, h / 2], [-t / 2, -h / 2], [t / 2, -h / 2]]   // both point ways fill the same row, so the rows tile
      const pts = q.map(([a, b]) => `${f(c.x + a * 0.94)},${f(c.y + b * 0.94)}`).join(' ')
      g += `<polygon points="${pts}" transform="rotate(${f(spin)} ${f(c.x)} ${f(c.y)})" fill="${hue}" fill-opacity="${f(s.saved ? lit * 0.8 : lit * 0.96)}" stroke="#ffffff" stroke-width="${f(t * 0.04)}" stroke-opacity="${f(lit * 0.7)}"/>`
    }
    return g + (s.saved ? '' : landed(s, k, 0.7))
  } },
  { id: 'mirage', name: 'Mirage afterimages', text: 'Ghost copies of the ship drift out; the shot goes into one and it bursts. On a 1 they snap back onto the ship.', ms: 1300, draw (s, k) {
    const u = dirOf(s.a), p = { x: -u.y, y: u.x }, R = s.r, fid = id(s, 'm'), grow = out(sm(0, 0.22, k)), die = 1 - sm(0.8, 1, k)
    const spots = [{ x: p.x * -0.62 * R + u.x * 0.1 * R, y: p.y * -0.62 * R + u.y * 0.1 * R }, { x: p.x * 0.58 * R, y: p.y * 0.58 * R }, { x: -u.x * 0.55 * R + p.x * 0.12 * R, y: -u.y * 0.55 * R + p.y * 0.12 * R }]
    const T = Math.floor(s.b[0] * 2.99), hitK = 0.36
    let g = `<defs>${tintDef(fid, s.glow, 0.8)}</defs>`
    spots.forEach((o, i) => {
      let m = grow, wob = Math.sin(k * 26 + i * 2) * 0.04 * R
      if (s.saved) { if (i === T) m *= k < hitK ? 1 : Math.max(0, 1 - (k - hitK) / 0.06) } else m *= 1 - sm(hitK, hitK + 0.1, k)
      const back = s.saved ? 0 : sm(hitK - 0.1, hitK, k)   // on a 1 the ghosts rush back onto the ship
      const dx = o.x * (1 - back) + wob, dy = o.y * (1 - back)
      const op = 0.6 * m * die
      g += pic(s, { dx, dy, op }) + pic(s, { dx, dy, op: op * 0.7, filter: fid })
    })
    const aim = s.saved ? { x: s.x + spots[T].x, y: s.y + spots[T].y } : { x: s.x, y: s.y }
    if (s.saved) g += pop(aim.x, aim.y, R * 0.5, hitK, k, s.glow, s.core)
    if (s.saved) for (let i = 0; i < 10; i++) { const t = sm(hitK, hitK + 0.4, k), a = s.b[i] * 6.28; if (k > hitK && t < 1) g += disc(aim.x + Math.cos(a) * R * 0.6 * t * (0.4 + s.b[i + 10]), aim.y + Math.sin(a) * R * 0.6 * t * (0.4 + s.b[i + 10]), R * 0.05, s.core, 1 - t) }
    return g + (s.saved ? '' : landed(s, k, hitK))
  } },
  { id: 'prism', name: 'Prism shatter', text: 'The ship breaks into coloured light shards and the shot slips through the gap; they reform. On a 1 they barely part.', ms: 1300, draw (s, k) {
    const R = s.r, N = 7, u = dirOf(s.a), hitK = 0.34
    const apart = s.saved ? Math.sin(Math.PI * clamp((k - 0.12) / 0.7)) : 0.25 * Math.sin(Math.PI * sm(0.12, hitK + 0.05, k)) * (1 - sm(hitK, hitK + 0.1, k))
    let g = '<defs>'
    for (let i = 0; i < N; i++) {
      const a0 = (i / N) * 6.2832 + 0.4, a1 = ((i + 1) / N) * 6.2832 + 0.4, W = s.size
      const pts = [[s.x, s.y], [s.x + Math.cos(a0) * W, s.y + Math.sin(a0) * W], [s.x + Math.cos((a0 + a1) / 2) * W * 1.2, s.y + Math.sin((a0 + a1) / 2) * W * 1.2], [s.x + Math.cos(a1) * W, s.y + Math.sin(a1) * W]].map(q => `${f(q[0])},${f(q[1])}`).join(' ')
      g += `<clipPath id="${id(s, 'c' + i)}"><polygon points="${pts}"/></clipPath>` + tintDef(id(s, 'h' + i), HUES[i], 0.6)
    }
    g += '</defs>'
    for (let i = 0; i < N; i++) {
      const a = ((i + 0.5) / N) * 6.2832 + 0.4, d = apart * R * (0.5 + s.b[i] * 0.4), dx = Math.cos(a) * d, dy = Math.sin(a) * d, tw = apart * (s.b[i + 7] - 0.5) * 40
      // each shard is the ship's picture clipped to a wedge, moved out and turned a little, then washed with its own colour
      g += `<g transform="rotate(${f(tw)} ${f(s.x + dx)} ${f(s.y + dy)})">` + pic(s, { dx, dy, clip: id(s, 'c' + i) }) + pic(s, { dx, dy, clip: id(s, 'c' + i), filter: id(s, 'h' + i), op: Math.min(1, apart * 1.6) }) + '</g>'
      if (apart > 0.15) g += line(s.x + dx, s.y + dy, s.x + dx + Math.cos(a) * R * 0.5 * apart, s.y + dy + Math.sin(a) * R * 0.5 * apart, R * 0.025, HUES[i], apart * 0.8)
    }
    if (s.saved) { const far = at(s, u, -R * 2.1); g += pop(far.x, far.y, R * 0.3, 0.5, k, s.core) }
    return g + (s.saved ? '' : landed(s, k, hitK))
  } },
  { id: 'phase', name: 'Phase flicker', text: 'The ship flickers out of step with a colour-split glitch; the shot passes through empty space. On a 1 it locks solid and takes the hit.', ms: 1200, draw (s, k) {
    const R = s.r, u = dirOf(s.a), hitK = 0.36, step = Math.floor(k * 22), h = n => s.b[(step * 3 + n) % 24]
    const on = s.saved ? (k > 0.08 && k < 0.88) : (k > 0.08 && k < hitK), solid = !s.saved && k >= hitK
    let g = `<defs>${tintDef(id(s, 'c'), '#00e5ff', 0.85)}${tintDef(id(s, 'm'), '#ff2fd0', 0.85)}${tintDef(id(s, 'g'), s.glow, 0.7)}${tintDef(id(s, 'w'), '#ffffff', 1)}`
    const N = 9
    for (let i = 0; i < N; i++) g += `<clipPath id="${id(s, 's' + i)}"><rect x="${f(s.x - s.size)}" y="${f(s.y - s.size / 2 + (i / N) * s.size)}" width="${f(s.size * 2)}" height="${f(s.size / N + 0.01)}"/></clipPath>`
    g += '</defs>'
    const alive = on && (h(0) > 0.3 || step % 5 === 0)   // the ship is out of step on some frames
    if (alive) {
      const split = (0.1 + 0.1 * h(1)) * R
      g += pic(s, { dx: -split, op: 0.55, filter: id(s, 'c') }) + pic(s, { dx: split, op: 0.55, filter: id(s, 'm') })
      for (let i = 0; i < N; i++) if (h(i + 2) > 0.45) g += pic(s, { dx: (h(i + 5) - 0.5) * 0.7 * R, clip: id(s, 's' + i), op: 0.95 })
      g += pic(s, { op: 0.45, filter: id(s, 'g') })
    }
    if (solid) g += pic(s, { op: 0.9 * (1 - sm(hitK, hitK + 0.2, k)), filter: id(s, 'w') })
    if (s.saved) { const far = at(s, u, -R * 2.1); g += pop(far.x, far.y, R * 0.3, 0.56, k, s.glow, s.core) }
    return g + (s.saved ? '' : landed(s, k, hitK))
  } },
  { id: 'scan', name: 'Hologram scanlines', text: 'Scanlines sweep the ship and the picture slips sideways in bands. On a 1 the lines turn red and the picture tears.', ms: 1300, draw (s, k) {
    const R = s.r, u = dirOf(s.a), hitK = 0.4, N = 16, col = s.saved ? s.glow : (k > hitK - 0.05 ? BAD : s.glow)
    const env = Math.sin(Math.PI * clamp((k - 0.04) / 0.9)), sweep = (k * (s.saved ? 2 : 1.4)) % 1, step = Math.floor(k * 18)
    let g = `<defs>${tintDef(id(s, 'h'), col, 0.7)}`
    for (let i = 0; i < N; i++) g += `<clipPath id="${id(s, 'b' + i)}"><rect x="${f(s.x - s.size)}" y="${f(s.y - s.size / 2 + (i / N) * s.size)}" width="${f(s.size * 2)}" height="${f(s.size / N + 0.01)}"/></clipPath>`
    g += '</defs>'
    for (let i = 0; i < N; i++) {
      const y = (i + 0.5) / N, near = Math.max(0, 1 - Math.abs(y - sweep) / 0.28)   // bands near the sweep slip sideways
      const tear = !s.saved ? sm(hitK - 0.05, hitK + 0.05, k) * (1 - sm(hitK + 0.15, hitK + 0.3, k)) : 0
      const jit = ((s.b[(i + step) % 24] - 0.5) * 0.5 * near * env + (s.b[(i * 2 + 1) % 24] - 0.5) * 1.2 * tear) * R
      if (near > 0.05 || tear > 0) { g += pic(s, { dx: jit, clip: id(s, 'b' + i), op: 0.95 }) + pic(s, { dx: jit, clip: id(s, 'b' + i), op: 0.5 * Math.max(near * env, tear), filter: id(s, 'h') }) }
    }
    const step2 = s.size / 30
    for (let y = -s.size / 2; y < s.size / 2; y += step2) {
      const dy = y + s.size / 2, near = Math.max(0, 1 - Math.abs(dy / s.size - sweep) / 0.3), half = Math.sqrt(Math.max(0, R * R - y * y))
      if (half < 0.1) continue
      g += line(s.x - half, s.y + y, s.x + half, s.y + y, s.size * 0.006 + 0.02, col, (0.18 + 0.6 * near) * env)
    }
    const sy = s.y - s.size / 2 + sweep * s.size, half = Math.sqrt(Math.max(0, R * R - (sy - s.y) ** 2))
    g += line(s.x - half, sy, s.x + half, sy, R * 0.04, s.core, env * 0.9)
    const far = at(s, u, -R * 2.1)
    if (s.saved) g += pop(far.x, far.y, R * 0.3, 0.55, k, s.glow, s.core)
    return g + (s.saved ? '' : landed(s, k, hitK))
  } },
  { id: 'decoy', name: 'Decoy split', text: 'Two decoy ships slide out; the shot pops one and the other slides home. On a 1 both vanish and the real ship is hit.', ms: 1300, draw (s, k) {
    const R = s.r, u = dirOf(s.a), p = { x: -u.y, y: u.x }, hitK = 0.4, slide = out(sm(0.02, 0.26, k)), home = sm(hitK + 0.1, hitK + 0.4, k)
    const T = s.b[0] > 0.5 ? 1 : -1   // the decoy the shot takes
    let g = `<defs>${tintDef(id(s, 'd'), s.glow, 0.75)}</defs>`
    for (const sign of [-1, 1]) {
      const mine = sign === T
      let m = 1, off = sign * R * 0.78 * slide
      if (s.saved) { if (mine) m = k < hitK ? 1 : Math.max(0, 1 - (k - hitK) / 0.05); else off *= 1 - home; if (!mine) m = 1 - sm(0.85, 1, k) } else { m = 1 - sm(hitK - 0.02, hitK + 0.04, k) }
      const fl = 0.75 + 0.25 * Math.sin(k * 40 + sign)
      g += pic(s, { dx: p.x * off, dy: p.y * off, op: 0.8 * m * fl }) + pic(s, { dx: p.x * off, dy: p.y * off, op: 0.55 * m * fl, filter: id(s, 'd') })
    }
    const target = s.saved ? at(s, p, T * R * 0.78) : { x: s.x, y: s.y }
    if (s.saved) {
      g += pop(target.x, target.y, R * 0.55, hitK, k, s.glow, s.core)
      for (let i = 0; i < 12; i++) { const t = sm(hitK, hitK + 0.45, k), a = s.b[i] * 6.28, d = R * (0.2 + s.b[i + 12] * 0.7) * t; if (k > hitK && t < 1) g += disc(target.x + Math.cos(a) * d, target.y + Math.sin(a) * d, R * 0.045, s.core, 1 - t) }
    }
    return g + (s.saved ? '' : landed(s, k, hitK))
  } },
  { id: 'lens', name: 'Refraction ripple', text: 'The ship bends like glass, a rainbow rim running round it; the shot curves past. On a 1 the bend collapses and the rim flashes red.', ms: 1300, draw (s, k) {
    const R = s.r, u = dirOf(s.a), p = { x: -u.y, y: u.x }, hitK = 0.4
    const bend = s.saved ? Math.sin(Math.PI * clamp((k - 0.05) / 0.85)) : Math.sin(Math.PI * clamp((k - 0.05) / 0.4)) * (1 - sm(hitK, hitK + 0.08, k))
    const freq = 0.35 + 0.1 * Math.sin(k * 9), scale = bend * s.size * 0.22
    let g = `<defs><filter id="${id(s, 'w')}" x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="fractalNoise" baseFrequency="${f(freq / (s.size / 6.6) * 0.5)}" numOctaves="1" seed="${3 + Math.floor(k * 6)}" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="${f(scale)}" xChannelSelector="R" yChannelSelector="G"/></filter>`
    const rims = ['#ff4a4a', '#6aff6a', '#5a8aff']
    rims.forEach((c, i) => { g += rimDef(id(s, 'r' + i), s.saved ? c : BAD, R * 0.014) })
    g += '</defs>'
    // the bent picture lies over the real one; it shifts the outline, so the ship seems to swim
    g += pic(s, { filter: id(s, 'w'), op: Math.min(1, bend * 3) })
    // a rainbow fringe: the outline three times, each shifted a little in its own direction
    const fringe = (0.55 + 0.45 * bend) * (1 - sm(0.9, 1, k)) * (!s.saved ? 1 - sm(hitK + 0.1, hitK + 0.3, k) : 1), sh = bend * R * 0.06
    rims.forEach((c, i) => { const ang = i * 2.094 + k * 3; g += pic(s, { dx: Math.cos(ang) * sh, dy: Math.sin(ang) * sh, filter: id(s, 'r' + i), op: fringe }) })
    for (let i = 0; i < 2; i++) { const t = clamp((k - 0.08 - i * 0.1) / 0.55); if (t > 0 && t < 1) g += `<circle cx="${f(s.x)}" cy="${f(s.y)}" r="${f(R * (0.5 + 0.9 * out(t)))}" fill="none" stroke="${i ? s.core : s.glow}" stroke-width="${f(R * 0.04 * (1 - t) + 0.02)}" stroke-opacity="${f(0.7 * (1 - t))}"/>` }
    return g + (s.saved ? '' : landed(s, k, hitK))
  } },
]
export const fieldStyle = id => FIELD_STYLES.find(x => x.id === id) ?? FIELD_STYLES[0]
// Each fleet's own field look
export const FLEET_FIELD_STYLE = { athanatoi: 'kaleido', thnitoi: 'phase' }
export const fieldStyleFor = (fleet, chosen) => fieldStyle(FLEET_FIELD_STYLE[fleet] ?? chosen)
