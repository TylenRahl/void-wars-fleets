// SEA ART: Tides of the Archipelago, the sea skin: the moving sea, the islands, and the water round each ship.
// Everything here is SVG text in table cm, drawn by the battle page's board (battle.js renderBoard) and the sea
// start screen (battle/seaField.js) in place of the space table, the planets and the asteroid fields.
//
// seaTableSvg: the open sea, slowly rolling (SMIL, so it runs without the battle loop).
// islandSvg(t): one island over the rules' exact shape (terrain.js kind 'island'): shallows, surf, beach, jungle, rocks,
// palms, and a lighthouse or a fort on the big ones. The beach edge IS the edge the rules use for running aground.
// wakeSvg(P, F, len, moved, now): the water round one ship: hull foam, a bow wave, and a wake behind it, longer when it moved
// further. CSS animated; `now` keeps the animation in step when the board is redrawn.

// a small seeded random source for the drawing only (the rules' dice are never used for art)
function artRng (seed) {
  let a = (seed * 2654435761) >>> 0 || 1
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}
const f = n => +n.toFixed(2)

// the CSS for the moving water, put in the page once
let cssDone = false
export function seaCss () {
  if (cssDone || typeof document === 'undefined') return
  cssDone = true
  const st = document.createElement('style')
  st.textContent = `
  @keyframes sea-flow { to { stroke-dashoffset: -6; } }
  @keyframes sea-foam { 0%, 100% { opacity: .55; } 50% { opacity: .95; } }
  @keyframes sea-ring { 0% { transform: scale(.92); opacity: .7; } 100% { transform: scale(1.18); opacity: 0; } }
  .sea-flow { animation: sea-flow 1.1s linear infinite; }
  .sea-foam { animation: sea-foam 2.4s ease-in-out infinite; }
  .sea-ring { animation: sea-ring 2.8s ease-out infinite; transform-box: fill-box; transform-origin: center; }
  @keyframes sea-bob { 0%, 100% { transform: rotate(-1.3deg) scale(1); } 50% { transform: rotate(1.3deg) scale(1.025); } }
  @keyframes sea-bob-move { 0%, 100% { transform: rotate(-2.6deg) scale(1); } 50% { transform: rotate(2.6deg) scale(1.04); } }
  @keyframes sea-spray { 0% { opacity: .9; } 100% { opacity: .2; } }
  .sea-spray { animation: sea-spray .5s ease-in-out infinite alternate; }
  `
  document.head.appendChild(st)
}

// ---------------- the table ----------------
// `id` keeps each drawing's gradient and patterns its own: the start screen's sea stays in the page hidden under the battle,
// and the board must not pick up its (hidden, so blank) gradient
export function seaTableSvg (W = 180, H = 120, id = 'sea') {
  const r = artRng(11)
  let glints = ''
  for (let i = 0; i < 70; i++) {
    const x = r() * W, y = r() * H, w = 0.6 + r() * 1.6, d = (r() * 6).toFixed(1)
    glints += `<path d="M${f(x)} ${f(y)} q${f(w / 2)} -0.35 ${f(w)} 0" stroke="#d8f4ff" stroke-width="0.14" fill="none" stroke-linecap="round" opacity="0"><animate attributeName="opacity" values="0;.55;0" dur="6s" begin="-${d}s" repeatCount="indefinite"/></path>`
  }
  return `<defs>
    <radialGradient id="${id}-deep" cx="50%" cy="45%" r="75%"><stop offset="0" stop-color="#16698c"/><stop offset=".55" stop-color="#0f4f72"/><stop offset="1" stop-color="#08324d"/></radialGradient>
    <pattern id="${id}-swell" width="16" height="9" patternUnits="userSpaceOnUse">
      <path d="M0 4.5 q4 -1.6 8 0 t8 0" stroke="#8fd3ee" stroke-opacity=".16" stroke-width=".22" fill="none"/>
      <path d="M-4 9 q4 -1.4 8 0 t8 0 t8 0" stroke="#052a40" stroke-opacity=".35" stroke-width=".35" fill="none"/>
      <animateTransform attributeName="patternTransform" type="translate" from="0 0" to="16 0" dur="14s" repeatCount="indefinite"/>
    </pattern>
    <pattern id="${id}-chop" width="7" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(-12)">
      <path d="M0 2.5 q1.75 -.8 3.5 0 t3.5 0" stroke="#bfeaff" stroke-opacity=".09" stroke-width=".14" fill="none"/>
      <animateTransform attributeName="patternTransform" type="translate" additive="sum" from="0 0" to="-7 2" dur="9s" repeatCount="indefinite"/>
    </pattern>
  </defs>
  <rect x="0" y="0" width="${W}" height="${H}" fill="url(#${id}-deep)"/>
  <rect x="0" y="0" width="${W}" height="${H}" fill="url(#${id}-swell)"/>
  <rect x="0" y="0" width="${W}" height="${H}" fill="url(#${id}-chop)"/>
  <g>${glints}</g>`
}

// ---------------- islands ----------------
// a wobbly closed outline round (0,0) for an ellipse rx x ry: k scales it, wob is how much it wanders, grow adds cm
function outline (rx, ry, rnd, { k = 1, wob = 0.05, grow = 0, n = 40, phase = [0, 0, 0] } = {}) {
  const pts = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    const w = 1 + wob * (Math.sin(a * 3 + phase[0]) * 0.5 + Math.sin(a * 5 + phase[1]) * 0.3 + Math.sin(a * 9 + phase[2]) * 0.2)
    pts.push([Math.cos(a) * (rx * k * w + grow), Math.sin(a) * (ry * k * w + grow)])
  }
  // a smooth path through the points (Catmull-Rom as cubic Béziers)
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n]
    d += ` C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`
  }
  return d + 'Z'
}

function palm (x, y, s, rnd) {
  const a0 = rnd() * 360
  let leaves = ''
  for (let i = 0; i < 6; i++) {
    const a = a0 + i * 60 + rnd() * 18
    leaves += `<ellipse cx="${f(s * 0.55)}" cy="0" rx="${f(s * 0.6)}" ry="${f(s * 0.17)}" transform="rotate(${f(a)})" fill="${i % 2 ? '#2f7d33' : '#3d9440'}"/>`
  }
  return `<g transform="translate(${f(x)} ${f(y)})"><ellipse cx="${f(s * 0.35)}" cy="${f(s * 0.45)}" rx="${f(s * 0.9)}" ry="${f(s * 0.55)}" fill="#0b2a12" opacity=".28"/>${leaves}<circle r="${f(s * 0.16)}" fill="#7a5a2a"/></g>`
}
function rock (x, y, s, rnd) {
  const n = 6, pts = []
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + rnd() * 0.5, r = s * (0.7 + rnd() * 0.4); pts.push(`${f(x + Math.cos(a) * r)},${f(y + Math.sin(a) * r * 0.8)}`) }
  return `<polygon points="${pts.join(' ')}" fill="#6d6a64" stroke="#3f3c37" stroke-width=".08"/><circle cx="${f(x - s * 0.2)}" cy="${f(y - s * 0.25)}" r="${f(s * 0.25)}" fill="#8f8b82" opacity=".7"/>`
}
// a lighthouse seen from above: its long shadow, a white tower ringed in red, a lamp, and a beam sweeping round
function lighthouse (x, y, s) {
  return `<g transform="translate(${f(x)} ${f(y)})"><path d="M0 0 L${f(s * 3.2)} ${f(s * 1.4)} L${f(s * 2.9)} ${f(s * 2.1)}Z" fill="#000" opacity=".22"/>
    <path d="M0 0 L${f(s * 7)} ${f(-s * 1.1)} A${f(s * 7.1)} ${f(s * 7.1)} 0 0 1 ${f(s * 7)} ${f(s * 1.1)}Z" fill="#fff6c8" opacity=".22"><animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="7s" repeatCount="indefinite"/></path>
    <circle r="${f(s * 1.05)}" fill="#8a8170"/><circle r="${f(s * .95)}" fill="#f1ece0"/><circle r="${f(s * .7)}" fill="none" stroke="#c0392b" stroke-width="${f(s * .22)}"/>
    <circle r="${f(s * .32)}" fill="#ffe680"><animate attributeName="fill" values="#ffe680;#fffbe8;#ffe680" dur="1.75s" repeatCount="indefinite"/></circle></g>`
}
function fort (x, y, s, rot) {
  const t = s * 0.45
  let towers = ''
  for (const [dx, dy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) towers += `<circle cx="${f(dx * s)}" cy="${f(dy * s)}" r="${f(t)}" fill="#a49a86" stroke="#5e5646" stroke-width=".1"/><circle cx="${f(dx * s)}" cy="${f(dy * s)}" r="${f(t * .55)}" fill="#7e3a2c"/>`
  return `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(rot)})"><rect x="${f(-s * 1.15 + .5)}" y="${f(-s * 1.15 + .6)}" width="${f(s * 2.3)}" height="${f(s * 2.3)}" fill="#000" opacity=".25"/>
    <rect x="${f(-s)}" y="${f(-s)}" width="${f(s * 2)}" height="${f(s * 2)}" fill="#b9ae98" stroke="#5e5646" stroke-width=".12"/><rect x="${f(-s * .55)}" y="${f(-s * .55)}" width="${f(s * 1.1)}" height="${f(s * 1.1)}" fill="#8d8270"/>
    ${towers}<rect x="${f(-s * .12)}" y="${f(-s * .9)}" width="${f(s * .1)}" height="${f(s * .7)}" fill="#3a2a1a"/><path d="M${f(-s * .02)} ${f(-s * .9)} l${f(s * .6)} ${f(s * .16)} l${f(-s * .6)} ${f(s * .16)}Z" fill="#c9a24a"/></g>`
}

// the island's beach line, as a path round (0,0) and the transform that puts it on the table
function coastOf (t) {
  const sh = t.shape, rnd = artRng(t.id * 7 + 3)
  const rx = sh.t === 'circ' ? sh.r : sh.rx, ry = sh.t === 'circ' ? sh.r : sh.ry, rot = sh.rot ?? 0
  const phase = [rnd() * 6, rnd() * 6, rnd() * 6]
  return { sh, rnd, rx, ry, rot, phase, d: outline(rx, ry, rnd, { wob: 0.04, phase }), at: `translate(${f(sh.x)} ${f(sh.y)}) rotate(${f(rot)})` }
}
// the water as a mask (white sea, black islands): the wakes are drawn through it so foam never lies on a beach
export function seaMaskSvg (terrain, W = 180, H = 120) {
  const isl = (terrain ?? []).filter(t => t.kind === 'island').map(coastOf)
  return `<defs><mask id="sea-water" maskUnits="userSpaceOnUse" x="-20" y="-20" width="${W + 40}" height="${H + 40}"><rect x="-20" y="-20" width="${W + 40}" height="${H + 40}" fill="#fff"/>${isl.map(c => `<path d="${c.d}" transform="${c.at}" fill="#000"/>`).join('')}</mask></defs>`
}

export function islandSvg (t) {
  const { sh, rnd, rx, ry, rot, phase, d: coast } = coastOf(t)
  const R = Math.min(rx, ry), big = R >= 7, tiny = R < 3
  let h = `<g transform="translate(${f(sh.x)} ${f(sh.y)}) rotate(${f(rot)})">`
  // shallows: two pale bands out to about 3 cm, then the surf on the beach, breaking and fading out
  h += `<path d="${outline(rx, ry, rnd, { wob: 0.08, grow: 3.2, phase })}" fill="#2a8fa8" opacity=".35"/>`
  h += `<path d="${outline(rx, ry, rnd, { wob: 0.06, grow: 1.6, phase })}" fill="#49c1c9" opacity=".45"/>`
  h += `<path d="${outline(rx, ry, rnd, { wob: 0.05, grow: 0.7, phase })}" fill="none" stroke="#e8fbff" stroke-width=".35" stroke-dasharray="1.4 .9" opacity=".7">
    <animate attributeName="stroke-dashoffset" values="0;4.6" dur="5s" repeatCount="indefinite"/><animate attributeName="opacity" values=".35;.85;.35" dur="3.4s" repeatCount="indefinite"/></path>`
  h += `<path d="${outline(rx, ry, rnd, { wob: 0.05, grow: 1.1, phase })}" fill="none" stroke="#ffffff" stroke-width=".2" opacity="0">
    <animate attributeName="opacity" values="0;.6;0" dur="3.4s" begin="1.7s" repeatCount="indefinite"/></path>`
  // the beach (the rules' edge), wet sand at the waterline
  h += `<path d="${coast}" fill="#e5d39b" stroke="#c4ad74" stroke-width=".3"/>`
  if (!tiny) {
    // grass and jungle inside the beach, darker clumps, a hill on the big ones
    const inner = outline(rx, ry, rnd, { k: 1, grow: -Math.min(1.6, R * 0.28), wob: 0.12, phase: phase.map(p => p + 1.3) })
    h += `<path d="${inner}" fill="#5c9a3e" stroke="#467e2f" stroke-width=".2"/>`
    const clumps = Math.round(rx * ry / 6)
    for (let i = 0; i < clumps; i++) {
      const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * 0.62
      const x = Math.cos(a) * rx * d, y = Math.sin(a) * ry * d, r0 = 0.8 + rnd() * Math.min(2.2, R * 0.25)
      h += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r0)}" fill="${rnd() < 0.5 ? '#3f7a2e' : '#4a8a34'}" opacity=".9"/>`
    }
    if (big) h += `<ellipse cx="${f(-rx * 0.08)}" cy="${f(-ry * 0.1)}" rx="${f(rx * 0.32)}" ry="${f(ry * 0.3)}" fill="#7b8f4a" opacity=".55"/><ellipse cx="${f(-rx * 0.12)}" cy="${f(-ry * 0.14)}" rx="${f(rx * 0.15)}" ry="${f(ry * 0.14)}" fill="#9a9a6a" opacity=".6"/>`
  }
  // rocks at the water's edge
  const nr = tiny ? 2 : 3 + Math.round(R * 0.5)
  for (let i = 0; i < nr; i++) { const a = rnd() * Math.PI * 2; h += rock(Math.cos(a) * rx * 0.92, Math.sin(a) * ry * 0.92, 0.35 + rnd() * 0.45, rnd) }
  // palms round the beach
  const np = tiny ? 1 : 3 + Math.round(R * 0.8)
  for (let i = 0; i < np; i++) { const a = rnd() * Math.PI * 2, d = tiny ? 0.2 : 0.7 + rnd() * 0.15; h += palm(Math.cos(a) * rx * d, Math.sin(a) * ry * d, tiny ? 0.8 : 0.9 + rnd() * 0.5, rnd) }
  // a fort on a big island, a lighthouse on a middling one
  if (big) h += fort(rx * 0.18, ry * 0.12, Math.min(2.4, R * 0.22), -rot + rnd() * 30)
  else if (!tiny) h += lighthouse(rx * 0.55, -ry * 0.35, 0.8)
  return h + '</g>'
}

// ---------------- the water round a ship ----------------
// P the drawn centre, F the facing (degrees, 0 = to the right), len the picture's length in cm, moved the cm it moved this
// turn, now a clock in ms so the flowing foam does not jump back each time the board is redrawn
export function wakeSvg (P, F, len, moved = 0, now = 0, moving = false) {
  // No dashed lines, no bow spray and no pulsing ring: the start screen's wake astern,
  // the churned trail and its two arms, while it moves and, a little fainter, after it has moved. A ship yet to move: nothing.
  if (!moving && !(moved > 0)) return ''
  const L = len * 0.42                     // the hull reaches about this far from the centre
  const tail = len * (0.5 + Math.min(1.2, moved / 18))
  const k = moving ? 1 : 0.7
  // (local frame: x ahead, y to starboard)
  let h = `<g mask="url(#sea-water)" style="pointer-events:none"><g transform="translate(${f(P.x)} ${f(P.y)}) rotate(${f(F)})" opacity="${k}">`
  // the churned trail astern, tapering and fading
  h += `<path d="M${f(-L * 0.8)} ${f(-len * 0.12)} L${f(-L - tail * 1.6)} ${f(-len * 0.45)} L${f(-L - tail * 1.6)} ${f(len * 0.45)} L${f(-L * 0.8)} ${f(len * 0.12)}Z" fill="url(#sea-wake-grad)" opacity=".6"/>`
  // the two arms of the wake: thin, solid, fading out astern; they start amidships, nothing ahead of the hull
  for (const side of [-1, 1]) h += `<path d="M${f(L * 0.3)} ${f(side * len * 0.12)} Q${f(-L * 0.6)} ${f(side * len * 0.2)} ${f(-L - tail * 1.4)} ${f(side * len * 0.5)}" fill="none" stroke="url(#sea-wake-line)" stroke-width="${f(len * 0.012)}" stroke-linecap="round"/>`
  void now
  return h + '</g></g>'
}
// the wake's fade, put once in the board's defs
export const WAKE_DEFS = '<defs><linearGradient id="sea-wake-grad" x1="1" x2="0" y1="0" y2="0"><stop offset="0" stop-color="#ffffff" stop-opacity=".55"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></linearGradient><linearGradient id="sea-wake-line" gradientUnits="objectBoundingBox" x1="1" x2="0" y1="0" y2="0"><stop offset="0" stop-color="#eafaff" stop-opacity=".7"/><stop offset="1" stop-color="#eafaff" stop-opacity="0"/></linearGradient></defs>'
