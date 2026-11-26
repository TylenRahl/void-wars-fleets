// SEA SHIPS: Tides of the Archipelago, the sea skin: the Human fleet's ships, plus the drawing helpers every other sea
// file imports (FIG, f, man, turret, lanceGun, runeCircle and the rest). Exports seaShipSvg, HUMAN_STYLES, HUMAN_SCHEMES
// and the lance choices; used by seaPictures.js and the other sea*.js files. The fantasy-modern Human ships come in
// several styles (the game uses 'runic'), among them:
// ironclad steel and brass steamers: funnels, turrets, lightning cannons
// galleon a steam galleon: wooden decks, masts and sails, a funnel, cannon along the sides
// dreadnought a modern-looking battleship: grey steel, big turrets, a stepped bridge tower
// Every ship is built from its real weapons (src/data/ships.js): one mount per weapon, on the side, the spine or the bow
// it fires from, so the picture agrees with the rules. Soldiers on deck are the figure pictures in seaFigures.js.
//
// Drawing units: the bow points UP at y = 0, the stern at y = L; x = 0 is the keel, port is x < 0. A soldier is FIG units
// long, so a bigger ship carries more men. seaShipSvg(id, style) returns the whole <svg> text and its size.
import { shipById, sizeOf } from '../data/ships.js'
import { FIGURES } from './seaFigures.js'

export const HUMAN_STYLES = [
  // brass and runic: steel destroyers with glowing runes; the runic one also has rune circles on deck, glyphs round the mast
  // and a shimmering ward round the hull
  { id: 'brass', name: 'Brass storm destroyer', text: 'A steel destroyer fused with ornate brass and carved wood, glowing runes along the bow only, twin turrets in etched bronze, tattered banners streaming from the mast' },
  { id: 'runic', name: 'Runic destroyer', text: 'Sleek dark steel covered in runes that pulse blue-white, rune circles on the deck, sigils on the turrets, stone obelisks on the bow, glyphs circling the mast, a shimmering ward round the hull' },
  { id: 'ironclad', name: 'Ironclad', text: 'Steel and brass steamers: funnels, round gun turrets, lightning cannons that crackle blue' },
  { id: 'galleon', name: 'Steam galleon', text: 'Wooden decks, masts and sails, one tall funnel, cannon run out along the sides' },
  { id: 'dreadnought', name: 'Dreadnought', text: 'Dark steel on a teak deck, armoured gun boxes along the sides, a stepped bridge tower and a tripod mast' }
]
const FIG = 13         // a soldier's length in drawing units (drawn big enough to read)
const f = n => +(+n).toFixed(2)

function artRng (seed) {
  let h = 2166136261
  for (const c of String(seed)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) }
  let a = h >>> 0
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}

// ---------------- colours per style ----------------
const LOOK = {
  brass: { side: '#2c3238', deck: '#9a6a40', deckLine: '#6e4626', deckLight: '#b5844f', trim: '#d9b04c', trimDark: '#8a6420', metal: '#8c5a2b', metalLight: '#e8b468', funnel: '#2a2e33', band: '#d9b04c', super: '#6a3f22', superDark: '#4a2a14', glass: '#ffd890', hullTone: '#3a4048' },
  runic: { side: '#161c24', deck: '#38424e', deckLine: '#2a323c', deckLight: '#4c5866', trim: '#6c7c8e', trimDark: '#2a323c', metal: '#3a4552', metalLight: '#8696a8', funnel: '#222a33', band: '#8fdcff', super: '#4a5664', superDark: '#323c48', glass: '#9fe8ff', hullTone: '#262e38' },
  ironclad: { side: '#2b3036', deck: '#6e747b', deckLine: '#5a6066', deckLight: '#868c93', trim: '#c9a24a', trimDark: '#7e6226', metal: '#4a5058', metalLight: '#9aa2ab', funnel: '#2d2f33', band: '#c9a24a', super: '#d8d2c0', superDark: '#9c9580', glass: '#7fc8e8', hullTone: '#3c4249' },
  galleon: { side: '#4a2c17', deck: '#a27448', deckLine: '#7f5631', deckLight: '#b88a5a', trim: '#d6b25a', trimDark: '#7e6226', metal: '#3a3a3a', metalLight: '#8a8a8a', funnel: '#2a2420', band: '#b02a22', super: '#7a3d22', superDark: '#4a2414', glass: '#f6d27a', hullTone: '#5c381e', sail: '#efe6cf', sailDark: '#c9bd9c' },
  dreadnought: { side: '#33393f', deck: '#c4ad84', deckLine: '#a88f66', deckLight: '#d8c49c', trim: '#d4af55', trimDark: '#7e6226', metal: '#59626c', metalLight: '#b4bcc4', funnel: '#3a4048', band: '#d4af55', super: '#9aa2aa', superDark: '#6a727a', glass: '#9fd8f0', hullTone: '#4a525a' }
}

// ---------------- pieces ----------------
// a soldier facing the bow (the sprites face up), centred at x, y, turned by rot
function man (name, x, y, rot = 0, k = 1) {
  const s = FIGURES[name] ?? FIGURES['human-handgunner']
  const scale = FIG * k / Math.max(s.w, s.h) * (Math.max(s.w, s.h) / 56)   // the sprites share one pixel size: 56 px is about one man
  const w = s.w * scale, h = s.h * scale
  return `<image href="${s.href}" x="${f(x - w / 2)}" y="${f(y - h / 2)}" width="${f(w)}" height="${f(h)}" transform="rotate(${f(rot)} ${f(x)} ${f(y)})" style="image-rendering:pixelated"/>`
}
// a row of men along a line, facing `rot`
function rowOf (names, x0, y0, x1, y1, n, rot, rnd) {
  let h = ''
  for (let i = 0; i < n; i++) { const t = n === 1 ? 0.5 : i / (n - 1); h += man(names[Math.floor(rnd() * names.length)], x0 + (x1 - x0) * t + (rnd() - 0.5) * 1.2, y0 + (y1 - y0) * t + (rnd() - 0.5) * 1.2, rot + (rnd() - 0.5) * 14) }
  return h
}
// a block of men, rows x cols, centred
function block (names, cx, cy, cols, rows, rot, rnd, gap = FIG * 0.62) {
  let h = ''
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) h += man(names[Math.floor(rnd() * names.length)], cx + (c - (cols - 1) / 2) * gap + (rnd() - 0.5), cy + (r - (rows - 1) / 2) * gap * 1.1 + (rnd() - 0.5), rot + (rnd() - 0.5) * 10)
  return h
}

// a round gun turret at (x, y) whose barrels point at angle a (degrees, 0 = up, -90 = port), n barrels
function turret (C, x, y, r, a, n = 2, len = 2.2) {
  let b = ''
  const bw = r * (n >= 3 ? 0.2 : 0.26)
  for (let i = 0; i < n; i++) {
    const ox = (i - (n - 1) / 2) * bw * 1.7
    b += `<rect x="${f(ox - bw / 2)}" y="${f(-r * len)}" width="${f(bw)}" height="${f(r * len)}" fill="${C.metal}" stroke="#15171a" stroke-width="${f(r * 0.06)}"/><rect x="${f(ox - bw * 0.62)}" y="${f(-r * len)}" width="${f(bw * 1.24)}" height="${f(r * 0.28)}" fill="#15171a"/>`
  }
  return `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(a)})">${b}<ellipse cx="${f(r * 0.12)}" cy="${f(r * 0.18)}" rx="${f(r * 1.08)}" ry="${f(r * 1.0)}" fill="#000" opacity=".3"/>
    <path d="M${f(-r)} ${f(r * 0.55)} L${f(-r)} ${f(-r * 0.25)} Q0 ${f(-r * 1.25)} ${f(r)} ${f(-r * 0.25)} L${f(r)} ${f(r * 0.55)} Q0 ${f(r * 1.05)} ${f(-r)} ${f(r * 0.55)}Z" fill="${C.metal}" stroke="#15171a" stroke-width="${f(r * 0.08)}"/>
    <path d="M${f(-r * 0.75)} ${f(r * 0.35)} L${f(-r * 0.75)} ${f(-r * 0.15)} Q0 ${f(-r * 0.95)} ${f(r * 0.75)} ${f(-r * 0.15)} L${f(r * 0.75)} ${f(r * 0.35)}Z" fill="${C.metalLight}" opacity=".45"/>
    <rect x="${f(-r * 0.95)}" y="${f(r * 0.25)}" width="${f(r * 1.9)}" height="${f(r * 0.16)}" fill="${C.trim}"/><circle cx="${f(r * 0.4)}" cy="${f(r * 0.05)}" r="${f(r * 0.17)}" fill="#15171a"/></g>`
}
// a lightning cannon: a copper coil drum and a long brass barrel ending in a crackling blue globe; points at angle a
function lightning (C, x, y, r, a, len = 3) {
  let coils = ''
  for (let i = 0; i < 4; i++) coils += `<circle r="${f(r * (0.92 - i * 0.18))}" fill="none" stroke="${i % 2 ? '#b8682e' : '#d98a40'}" stroke-width="${f(r * 0.1)}"/>`
  const tip = -r * len
  return `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(a)})"><circle cx="${f(r * 0.15)}" cy="${f(r * 0.2)}" r="${f(r * 1.05)}" fill="#000" opacity=".3"/>
    <rect x="${f(-r * 0.2)}" y="${f(tip)}" width="${f(r * 0.4)}" height="${f(-tip)}" fill="${C.trim}" stroke="${C.trimDark}" stroke-width="${f(r * 0.06)}"/>
    ${[0.35, 0.55, 0.75].map(k => `<rect x="${f(-r * 0.3)}" y="${f(tip * k)}" width="${f(r * 0.6)}" height="${f(r * 0.14)}" fill="${C.trimDark}"/>`).join('')}
    <circle r="${f(r)}" fill="#3a2a1e"/>${coils}<circle r="${f(r * 0.25)}" fill="#8fe0ff"/>
    <circle cy="${f(tip)}" r="${f(r * 0.42)}" fill="#bff0ff"><animate attributeName="r" values="${f(r * 0.36)};${f(r * 0.5)};${f(r * 0.36)}" dur=".9s" repeatCount="indefinite"/></circle>
    <circle cy="${f(tip)}" r="${f(r * 0.75)}" fill="#6fd0ff" opacity=".35"><animate attributeName="opacity" values=".15;.5;.15" dur=".6s" repeatCount="indefinite"/></circle>
    <path d="M0 ${f(tip)} l${f(r * 0.5)} ${f(-r * 0.4)} l${f(-r * 0.3)} ${f(-r * 0.2)} l${f(r * 0.45)} ${f(-r * 0.45)}" stroke="#e6faff" stroke-width="${f(r * 0.08)}" fill="none"><animate attributeName="opacity" values="1;0;0;1;0" dur="1.3s" repeatCount="indefinite"/></path></g>`
}
// ---- the runes (the Runic destroyer) ----
const GLYPHS = ['M0 0V1M0 .2L.5 0M0 .45L.5 .25', 'M0 1V0L.5 .3V1', 'M0 0V1M0 .25L.45 .5L0 .75', 'M.25 0V1M.25 .3L0 .1M.25 .3L.5 .1', 'M0 0L.5 1M.5 0L0 1',
  'M0 0V1M.5 0V1M0 .3L.5 .6', 'M.25 0V1M0 .35L.5 .65', 'M0 0V1L.5 .7M0 .3L.5 0', 'M0 .5L.25 0L.5 .5L.25 1Z', 'M0 0V1M0 0L.5 .3L0 .55', 'M0 1V0L.25 .3L.5 0V1', 'M0 1L.25 0L.5 1M.1 .6H.4']
let RUNE = '#e4f8ff', GLOW = '#4fc8ff'   // the runes' colour and their glow: set per colour scheme by seaShipSvg
// one rune, h tall, centred at x, y; pulse: seconds into a 3 s glow, so a row of them lights up like a wave
function glyph (i, x, y, h, rot = 0, pulse = null, col = RUNE) {
  const anim = pulse == null ? '' : `<animate attributeName="opacity" values=".3;1;.3" dur="3s" begin="-${pulse.toFixed(2)}s" repeatCount="indefinite"/>`
  return `<path d="${GLYPHS[i % GLYPHS.length]}" transform="translate(${f(x)} ${f(y)}) rotate(${f(rot)}) scale(${f(h)}) translate(-.25 -.5)" fill="none" stroke="${col}" stroke-width="${f(0.2)}" stroke-linecap="round" stroke-linejoin="round" vector-effect="none">${anim}</path>`
}
// a rune circle etched in the deck: two rings, runes between them, a star inside, turning slowly
function runeCircle (x, y, r, seed, dur = 40) {
  let g = `<circle r="${f(r)}" fill="none" stroke="${RUNE}" stroke-width="0.35"/><circle r="${f(r * 0.74)}" fill="none" stroke="${RUNE}" stroke-width="0.25"/>`
  const n = Math.max(6, Math.round(r * 1.1))
  for (let i = 0; i < n; i++) { const a = i / n * 360, rr = r * 0.87; g += glyph(seed + i, Math.cos(a * Math.PI / 180) * rr, Math.sin(a * Math.PI / 180) * rr, r * 0.18, a + 90) }
  const star = [0, 1, 2, 3, 4].map(i => { const a = (i * 144 - 90) * Math.PI / 180; return `${f(Math.cos(a) * r * 0.7)} ${f(Math.sin(a) * r * 0.7)}` })
  g += `<path d="M${star.join(' L')}Z" fill="none" stroke="${RUNE}" stroke-width="0.25" opacity=".8"/><circle r="${f(r * 0.12)}" fill="${RUNE}" opacity=".7"/>`
  return `<g transform="translate(${f(x)} ${f(y)})" opacity=".85"><g>${g}<animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="${dur}s" repeatCount="indefinite"/></g><animate attributeName="opacity" values=".55;1;.55" dur="4s" repeatCount="indefinite"/></g>`
}
// a spiralling sigil on a turret roof, crackling now and then
function sigil (x, y, r, k) {
  let sp = 'M0 0'
  for (let i = 1; i <= 24; i++) { const a = i * 0.55, rr = r * 0.62 * i / 24; sp += ` L${f(Math.cos(a) * rr)} ${f(Math.sin(a) * rr)}` }
  return `<g transform="translate(${f(x)} ${f(y)})"><path d="${sp}" fill="none" stroke="${RUNE}" stroke-width="${f(r * 0.07)}" stroke-linecap="round"><animate attributeName="opacity" values=".45;1;.45" dur="2.4s" begin="-${(k * 0.37).toFixed(2)}s" repeatCount="indefinite"/></path>
    <circle r="${f(r * 0.8)}" fill="none" stroke="${RUNE}" stroke-width="${f(r * 0.04)}" stroke-dasharray="${f(r * 0.2)} ${f(r * 0.12)}" opacity=".7"/>
    <path d="M${f(r * 0.6)} ${f(-r * 0.2)} l${f(r * 0.35)} ${f(-r * 0.25)} l${f(-r * 0.15)} ${f(-r * 0.12)} l${f(r * 0.3)} ${f(-r * 0.3)}" stroke="#ffffff" stroke-width="${f(r * 0.06)}" fill="none" opacity="0"><animate attributeName="opacity" values="0;0;1;0;0;0;1;0" dur="${(1.6 + k * 0.3).toFixed(1)}s" repeatCount="indefinite"/></path></g>`
}
// a rune-carved stone obelisk seen from above: a square shaft, the pyramid of its tip, a glowing rune on each face
function obelisk (x, y, s, seed) {
  return `<g transform="translate(${f(x)} ${f(y)})"><rect x="${f(-s * 0.4)}" y="${f(-s * 0.2)}" width="${f(s * 1.2)}" height="${f(s * 1.2)}" fill="#000" opacity=".35"/>
    <rect x="${f(-s / 2)}" y="${f(-s / 2)}" width="${f(s)}" height="${f(s)}" fill="#7d7a72" stroke="#3a3833" stroke-width="${f(s * 0.06)}"/>
    <path d="M${f(-s / 2)} ${f(-s / 2)} L0 0 L${f(s / 2)} ${f(-s / 2)}Z" fill="#9a968c"/><path d="M${f(-s / 2)} ${f(-s / 2)} L0 0 L${f(-s / 2)} ${f(s / 2)}Z" fill="#8a867d"/><path d="M${f(s / 2)} ${f(s / 2)} L0 0 L${f(-s / 2)} ${f(s / 2)}Z" fill="#5e5b54"/>
    ${glyph(seed, -s * 0.28, 0, s * 0.32, 90, seed * 0.3)}${glyph(seed + 1, s * 0.28, 0, s * 0.32, -90, seed * 0.3 + 0.5)}${glyph(seed + 2, 0, -s * 0.28, s * 0.32, 0, seed * 0.3 + 1)}<circle r="${f(s * 0.1)}" fill="${RUNE}"><animate attributeName="r" values="${f(s * 0.08)};${f(s * 0.16)};${f(s * 0.08)}" dur="2s" repeatCount="indefinite"/></circle></g>`
}
// glyphs floating round a mast, orbiting
function orbit (x, y, r, n, seed) {
  let g = ''
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; g += glyph(seed + i * 3, Math.cos(a) * r, Math.sin(a) * r, r * 0.32, 0, i * 0.4) }
  return `<g transform="translate(${f(x)} ${f(y)})"><circle r="${f(r)}" fill="none" stroke="${RUNE}" stroke-width="0.15" stroke-dasharray="0.6 1.4" opacity=".4"/><g>${g}<animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="12s" repeatCount="indefinite"/></g></g>`
}

// ---- the brass storm destroyer ----
// etched bronze plating on a turret roof: engraved bands and a ring of rivets, turned with the turret
function etched (x, y, r, a) {
  let riv = ''
  for (let i = 0; i < 10; i++) { const t = i / 10 * Math.PI * 2; riv += `<circle cx="${f(Math.cos(t) * r * 0.82)}" cy="${f(Math.sin(t) * r * 0.82 * 0.9 + r * 0.05)}" r="${f(r * 0.05)}" fill="#f2cf7e"/>` }
  return `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(a)})"><path d="M${f(-r * 0.7)} ${f(r * 0.1)} Q0 ${f(-r * 0.7)} ${f(r * 0.7)} ${f(r * 0.1)}" fill="none" stroke="#5a3414" stroke-width="${f(r * 0.06)}"/>
    <path d="M${f(-r * 0.5)} ${f(r * 0.05)} Q0 ${f(-r * 0.45)} ${f(r * 0.5)} ${f(r * 0.05)}" fill="none" stroke="#f2cf7e" stroke-width="${f(r * 0.04)}" opacity=".8"/>
    <path d="M${f(-r * 0.3)} ${f(-r * 0.05)} q${f(r * 0.15)} ${f(-r * 0.2)} ${f(r * 0.3)} 0 t${f(r * 0.3)} 0" fill="none" stroke="#5a3414" stroke-width="${f(r * 0.04)}"/>${riv}</g>`
}
// brass scrollwork along the deck edge: a running wave of curls
function scroll (x0, y0, y1, side) {
  let d = `M${f(x0)} ${f(y0)}`
  for (let y = y0; y < y1 - 3; y += 3) d += ` q${f(side * 1.4)} 0.75 0 1.5 q${f(-side * 1.4)} 0.75 0 1.5`
  let curls = ''
  for (let y = y0 + 1.5; y < y1 - 3; y += 6) curls += `<circle cx="${f(x0 + side * 0.9)}" cy="${f(y)}" r="0.45" fill="none" stroke="#e8c060" stroke-width="0.25"/>`
  return `<path d="${d}" fill="none" stroke="#e8c060" stroke-width="0.32"/>${curls}`
}
// tattered banners streaming aft from a mast yard, flapping
function banners (x, y, w, len, rnd) {
  let h = `<rect x="${f(x - w)}" y="${f(y - 0.5)}" width="${f(w * 2)}" height="1" fill="#3a2a1a"/><circle cx="${f(x)}" cy="${f(y)}" r="${f(w * 0.18)}" fill="#d9b04c" stroke="#5a3a14" stroke-width="0.3"/>`
  for (const sx of [-1, 1]) {
    const bx = x + sx * w * 0.62, bw = w * 0.42, l = len * (0.85 + rnd() * 0.3)
    const rag = [0, 1, 2, 3, 4].map(i => `${f(bx - bw / 2 + bw * i / 4)} ${f(y + l - (i % 2 ? l * 0.12 : 0) - rnd() * l * 0.08)}`).reverse().join(' L')
    h += `<path d="M${f(bx - bw / 2)} ${f(y)} L${f(bx + bw / 2)} ${f(y)} L${rag}Z" fill="${sx < 0 ? '#9a2a22' : '#c8a040'}" stroke="#3a1a10" stroke-width="0.25" opacity=".95">
      <animateTransform attributeName="transform" type="skewX" values="0;${sx * 6};0;${-sx * 4};0" dur="${(2.2 + rnd()).toFixed(1)}s" repeatCount="indefinite"/></path>
      <path d="M${f(bx)} ${f(y + 1)} L${f(bx)} ${f(y + l * 0.7)}" stroke="${sx < 0 ? '#e0b050' : '#7a2018'}" stroke-width="${f(bw * 0.12)}"/>`
  }
  return h
}

// a casemate gun: an armoured box let into the hull side, one or two barrels out over the water (the dreadnought's side guns)
function casemate (C, x, y, r, n = 1) {
  let b = ''
  for (let i = 0; i < n; i++) { const oy = (i - (n - 1) / 2) * r * 0.55; b += `<rect x="${f(x - r * 2.1)}" y="${f(y + oy - r * 0.13)}" width="${f(r * 2.1)}" height="${f(r * 0.26)}" fill="${C.metal}" stroke="#15171a" stroke-width="${f(r * 0.05)}"/><rect x="${f(x - r * 2.2)}" y="${f(y + oy - r * 0.17)}" width="${f(r * 0.3)}" height="${f(r * 0.34)}" fill="#15171a"/>` }
  return `${b}<path d="M${f(x - r * 0.25)} ${f(y - r * 0.8)} L${f(x + r * 0.9)} ${f(y - r * 0.65)} L${f(x + r * 0.9)} ${f(y + r * 0.65)} L${f(x - r * 0.25)} ${f(y + r * 0.8)}Z" fill="${C.metal}" stroke="#15171a" stroke-width="${f(r * 0.07)}"/><rect x="${f(x + r * 0.1)}" y="${f(y - r * 0.55)}" width="${f(r * 0.12)}" height="${f(r * 1.1)}" fill="${C.trim}"/>`
}
// ---- LANCE OPTIONS ----
// A lance is one mount per point of strength, drawn pointing at angle a (0 = up) from (x, y); r is the mount's radius.
export const LANCE_KINDS = [
  { id: 'lightning', name: 'Lightning cannon', text: 'A copper coil drum, a brass barrel, a crackling blue globe at the tip (as now)' },
  { id: 'rail', name: 'Twin rail gun', text: 'Twin rails on an armoured mount, coils lighting up one after another down the rails' },
  { id: 'rail-heavy', name: 'Heavy rail gun', text: 'Two thick armoured rails, a big capacitor block behind, coils glowing in turn' },
  { id: 'rail-coil', name: 'Coil gun', text: 'One barrel wrapped in rings of coil that light up one after another, the slug flying out' },
  { id: 'rail-arc', name: 'Arc rail', text: 'Open twin rails with lightning arcing between them' },
  { id: 'rail-quad', name: 'Quad rail', text: 'Four rails in a square, a ring of capacitors on the mount' },
  { id: 'rail-rune', name: 'Rune rail', text: 'Twin rails carved with runes that glow as the shot runs down them' },
  { id: 'laser', name: 'Laser', text: 'A sleek armoured turret, a finned barrel and a big glowing red lens' },
  //
  { id: 'redline', name: 'Red line laser', text: 'Two grey armoured slabs side by side, a red line glowing down the gap between them, pulses running out to the muzzle' },
  { id: 'redline-wide', name: 'Red line laser, heavy', text: 'The same with broad grey slabs, a thicker red line and a red glow at the muzzle' },
  { id: 'crystal', name: 'Rune crystal', text: 'A long faceted crystal held in a brass cradle, pulsing with light, runes on the cradle' },
  { id: 'ballista', name: 'Storm ballista', text: 'A great brass crossbow loaded with a harpoon whose head glows with a rune' },
  { id: 'mirror', name: 'Sun mirror', text: 'A gold mirror dish focusing light onto a burning point in front of it' }
]
function lanceGun (kind, C, x, y, r, a, len = 3, firing = true) {
  const tip = -r * len, shadow = `<circle cx="${f(r * 0.15)}" cy="${f(r * 0.2)}" r="${f(r * 1.05)}" fill="#000" opacity=".3"/>`
  const g = inner => `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(a)})">${shadow}${inner}</g>`
  if (kind === 'rail-heavy' || kind === 'rail-coil' || kind === 'rail-arc' || kind === 'rail-quad' || kind === 'rail-rune') {
    const slug = (x0 = 0) => !firing ? '' : `<circle cx="${f(x0)}" cy="${f(tip)}" r="${f(r * 0.12)}" fill="#e6faff"><animate attributeName="cy" values="${f(-r * 0.6)};${f(tip)};${f(tip)}" dur="1.2s" repeatCount="indefinite"/><animate attributeName="opacity" values="1;1;0" dur="1.2s" repeatCount="indefinite"/></circle>`
    const lit = (i, n) => !firing ? '' : `<animate attributeName="opacity" values=".2;1;.2;.2" dur="1.2s" begin="${(i * 0.6 / n).toFixed(2)}s" repeatCount="indefinite"/>`
    const along = (i, n) => -r * 0.9 + (tip + r * 0.9) * (i + 0.5) / n
    if (kind === 'rail-heavy') {
      let coils = ''
      for (let i = 0; i < 4; i++) coils += `<rect x="${f(-r * 0.62)}" y="${f(along(i, 4) - r * 0.14)}" width="${f(r * 1.24)}" height="${f(r * 0.28)}" rx="${f(r * 0.06)}" fill="${GLOW}" opacity=".3">${lit(i, 4)}</rect>`
      return g(`<rect x="${f(-r * 0.5)}" y="${f(tip)}" width="${f(r * 0.3)}" height="${f(-tip)}" fill="${C.rail ?? '#2a3038'}" stroke="#111" stroke-width="${f(r * 0.05)}"/><rect x="${f(r * 0.2)}" y="${f(tip)}" width="${f(r * 0.3)}" height="${f(-tip)}" fill="${C.rail ?? '#2a3038'}" stroke="#111" stroke-width="${f(r * 0.05)}"/>
        <rect x="${f(-r * 0.2)}" y="${f(tip)}" width="${f(r * 0.4)}" height="${f(-tip)}" fill="#0c1218"/>${coils}${slug()}
        <rect x="${f(-r * 1.0)}" y="${f(-r * 0.8)}" width="${f(r * 2.0)}" height="${f(r * 1.9)}" rx="${f(r * 0.2)}" fill="${C.metal}" stroke="#111" stroke-width="${f(r * 0.08)}"/>
        ${[0, 1, 2].map(i => `<rect x="${f(-r * 0.75 + i * r * 0.55)}" y="${f(r * 0.35)}" width="${f(r * 0.4)}" height="${f(r * 0.55)}" rx="${f(r * 0.06)}" fill="#1a2028" stroke="${GLOW}" stroke-width="${f(r * 0.04)}"/>`).join('')}
        <rect x="${f(-r * 0.7)}" y="${f(-r * 0.55)}" width="${f(r * 1.4)}" height="${f(r * 0.7)}" fill="${C.metalLight}" opacity=".35"/>`)
    }
    if (kind === 'rail-coil') {
      let rings = ''
      for (let i = 0; i < 7; i++) rings += `<rect x="${f(-r * 0.3)}" y="${f(along(i, 7) - r * 0.09)}" width="${f(r * 0.6)}" height="${f(r * 0.18)}" rx="${f(r * 0.09)}" fill="#b8682e" stroke="#5a3010" stroke-width="${f(r * 0.03)}"/><rect x="${f(-r * 0.3)}" y="${f(along(i, 7) - r * 0.09)}" width="${f(r * 0.6)}" height="${f(r * 0.18)}" rx="${f(r * 0.09)}" fill="${GLOW}" opacity=".2">${lit(i, 7)}</rect>`
      return g(`<rect x="${f(-r * 0.15)}" y="${f(tip)}" width="${f(r * 0.3)}" height="${f(-tip)}" fill="#3a424c" stroke="#111" stroke-width="${f(r * 0.04)}"/>${rings}${slug()}
        <circle r="${f(r * 0.85)}" fill="${C.metal}" stroke="#111" stroke-width="${f(r * 0.07)}"/><circle r="${f(r * 0.55)}" fill="#b8682e"/><circle r="${f(r * 0.3)}" fill="${GLOW}" opacity=".7"/>`)
    }
    if (kind === 'rail-arc') {
      const zig = k => { let d = `M${f(-r * 0.25)} ${f(along(k, 5))}`; for (let i = 1; i <= 4; i++) d += ` L${f(-r * 0.25 + r * 0.5 * i / 4)} ${f(along(k, 5) + (i % 2 ? -r * 0.12 : r * 0.12))}`; return d }
      let arcs = ''
      for (let k = 0; k < 5; k++) arcs += `<path d="${zig(k)}" stroke="${RUNE}" stroke-width="${f(r * 0.05)}" fill="none" opacity="0"><animate attributeName="opacity" values="0;1;0;0;1;0" dur="${(0.7 + k * 0.13).toFixed(2)}s" repeatCount="indefinite"/></path>`
      return g(`<rect x="${f(-r * 0.36)}" y="${f(tip)}" width="${f(r * 0.12)}" height="${f(-tip)}" fill="#8a929a" stroke="#111" stroke-width="${f(r * 0.03)}"/><rect x="${f(r * 0.24)}" y="${f(tip)}" width="${f(r * 0.12)}" height="${f(-tip)}" fill="#8a929a" stroke="#111" stroke-width="${f(r * 0.03)}"/>
        ${[0.3, 0.6, 0.9].map(k => `<rect x="${f(-r * 0.4)}" y="${f(tip * k)}" width="${f(r * 0.8)}" height="${f(r * 0.08)}" fill="#2a3038"/>`).join('')}<rect x="${f(-r * 0.24)}" y="${f(tip)}" width="${f(r * 0.48)}" height="${f(-tip)}" fill="${GLOW}" opacity=".12"/>${arcs}${slug()}
        <circle r="${f(r * 0.85)}" fill="${C.metal}" stroke="#111" stroke-width="${f(r * 0.07)}"/><circle r="${f(r * 0.4)}" fill="${C.metalLight}" opacity=".5"/>`)
    }
    if (kind === 'rail-quad') {
      let rails = ''
      for (const xo of [-0.42, -0.16, 0.16, 0.42]) rails += `<rect x="${f(r * xo - r * 0.08)}" y="${f(tip)}" width="${f(r * 0.16)}" height="${f(-tip)}" fill="${C.rail ?? '#2a3038'}" stroke="#111" stroke-width="${f(r * 0.03)}"/>`
      let caps = ''
      for (let i = 0; i < 8; i++) { const t = i / 8 * Math.PI * 2; caps += `<circle cx="${f(Math.cos(t) * r * 0.68)}" cy="${f(Math.sin(t) * r * 0.68)}" r="${f(r * 0.14)}" fill="#1a2028" stroke="${GLOW}" stroke-width="${f(r * 0.04)}">${lit(i, 8).replace('opacity', 'stroke-opacity')}</circle>` }
      return g(`${rails}<rect x="${f(-r * 0.5)}" y="${f(tip * 0.98)}" width="${f(r)}" height="${f(r * 0.14)}" fill="#2a3038"/>${slug(-r * 0.29)}${slug(r * 0.29)}
        <circle r="${f(r * 0.95)}" fill="${C.metal}" stroke="#111" stroke-width="${f(r * 0.07)}"/>${caps}<circle r="${f(r * 0.35)}" fill="${C.metalLight}" opacity=".5"/>`)
    }
    // rail-rune
    let runes = ''
    for (let i = 0; i < 5; i++) runes += `<g opacity=".35">${lit(i, 5)}${glyph(i * 2 + 3, -r * 0.23, along(i, 5), r * 0.2, 0)}${glyph(i * 2 + 4, r * 0.23, along(i, 5), r * 0.2, 0)}</g>`
    return g(`<rect x="${f(-r * 0.36)}" y="${f(tip)}" width="${f(r * 0.24)}" height="${f(-tip)}" fill="${C.rail ?? '#2a3038'}" stroke="#111" stroke-width="${f(r * 0.04)}"/><rect x="${f(r * 0.12)}" y="${f(tip)}" width="${f(r * 0.24)}" height="${f(-tip)}" fill="${C.rail ?? '#2a3038'}" stroke="#111" stroke-width="${f(r * 0.04)}"/>
      <rect x="${f(-r * 0.12)}" y="${f(tip)}" width="${f(r * 0.24)}" height="${f(-tip)}" fill="#0c1218"/>${runes}${slug()}
      <rect x="${f(-r * 0.85)}" y="${f(-r * 0.75)}" width="${f(r * 1.7)}" height="${f(r * 1.6)}" rx="${f(r * 0.5)}" fill="${C.metal}" stroke="#111" stroke-width="${f(r * 0.07)}"/>${glyph(9, 0, r * 0.05, r * 0.7, 0, 0.5)}`)
  }
  if (kind === 'rail') {
    let coils = ''
    for (let i = 0; i < 5; i++) { const cy = -r * 0.9 + (tip + r * 0.9) * (i + 0.5) / 5; coils += `<rect x="${f(-r * 0.42)}" y="${f(cy - r * 0.1)}" width="${f(r * 0.84)}" height="${f(r * 0.2)}" rx="${f(r * 0.05)}" fill="${GLOW}" opacity=".3">${firing ? `<animate attributeName="opacity" values=".2;1;.2;.2" dur="1.2s" begin="${(i * 0.12).toFixed(2)}s" repeatCount="indefinite"/>` : ''}</rect>` }
    return g(`<rect x="${f(-r * 0.32)}" y="${f(tip)}" width="${f(r * 0.18)}" height="${f(-tip)}" fill="${C.rail ?? '#2a3038'}" stroke="#111" stroke-width="${f(r * 0.04)}"/><rect x="${f(r * 0.14)}" y="${f(tip)}" width="${f(r * 0.18)}" height="${f(-tip)}" fill="${C.rail ?? '#2a3038'}" stroke="#111" stroke-width="${f(r * 0.04)}"/>
      <rect x="${f(-r * 0.14)}" y="${f(tip)}" width="${f(r * 0.28)}" height="${f(-tip)}" fill="#0c1218"/>${coils}
      ${firing ? `<circle cy="${f(tip)}" r="${f(r * 0.12)}" fill="#e6faff"><animate attributeName="cy" values="${f(-r * 0.6)};${f(tip)};${f(tip)}" dur="1.2s" repeatCount="indefinite"/><animate attributeName="opacity" values="1;1;0" dur="1.2s" repeatCount="indefinite"/></circle>` : ''}
      <rect x="${f(-r * 0.85)}" y="${f(-r * 0.75)}" width="${f(r * 1.7)}" height="${f(r * 1.6)}" rx="${f(r * 0.3)}" fill="${C.metal}" stroke="#111" stroke-width="${f(r * 0.07)}"/><rect x="${f(-r * 0.6)}" y="${f(-r * 0.5)}" width="${f(r * 1.2)}" height="${f(r * 0.9)}" rx="${f(r * 0.15)}" fill="${C.metalLight}" opacity=".35"/>
      <rect x="${f(-r * 0.5)}" y="${f(r * 0.45)}" width="${f(r * 1.0)}" height="${f(r * 0.18)}" fill="#6fd8ff" opacity=".8"/>`)
  }
  if (kind === 'laser') {
    let fins = ''
    for (let i = 0; i < 5; i++) fins += `<rect x="${f(-r * 0.3)}" y="${f(-r * 1.0 + tip * 0.12 * i)}" width="${f(r * 0.6)}" height="${f(r * 0.08)}" fill="#1a1e24"/>`
    return g(`<path d="M${f(-r * 0.22)} ${f(-r * 0.6)} L${f(-r * 0.12)} ${f(tip + r * 0.3)} L${f(r * 0.12)} ${f(tip + r * 0.3)} L${f(r * 0.22)} ${f(-r * 0.6)}Z" fill="${C.metalLight}" stroke="#111" stroke-width="${f(r * 0.05)}"/>${fins}
      <circle cy="${f(tip + r * 0.2)}" r="${f(r * 0.24)}" fill="#3a0a0a" stroke="#111" stroke-width="${f(r * 0.04)}"/><circle cy="${f(tip + r * 0.2)}" r="${f(r * 0.17)}" fill="#ff3a3a">${firing ? '<animate attributeName="fill" values="#ff3a3a;#ffb0a0;#ff3a3a" dur="1.6s" repeatCount="indefinite"/>' : ''}</circle>
      <circle cy="${f(tip + r * 0.2)}" r="${f(r * 0.4)}" fill="#ff5a4a" opacity=".25">${firing ? '<animate attributeName="opacity" values=".1;.4;.1" dur="1.6s" repeatCount="indefinite"/>' : ''}</circle>
      <path d="M${f(-r * 0.9)} ${f(r * 0.5)} L${f(-r * 0.9)} ${f(-r * 0.2)} L${f(-r * 0.4)} ${f(-r * 0.85)} L${f(r * 0.4)} ${f(-r * 0.85)} L${f(r * 0.9)} ${f(-r * 0.2)} L${f(r * 0.9)} ${f(r * 0.5)} Q0 ${f(r * 0.9)} ${f(-r * 0.9)} ${f(r * 0.5)}Z" fill="${C.metal}" stroke="#111" stroke-width="${f(r * 0.07)}"/>
      <path d="M${f(-r * 0.55)} ${f(-r * 0.1)} L${f(-r * 0.3)} ${f(-r * 0.55)} L${f(r * 0.3)} ${f(-r * 0.55)} L${f(r * 0.55)} ${f(-r * 0.1)}Z" fill="${C.metalLight}" opacity=".4"/><rect x="${f(-r * 0.5)}" y="${f(r * 0.2)}" width="${f(r)}" height="${f(r * 0.12)}" fill="#ff5a4a" opacity=".7"/>`)
  }
  if (kind === 'redline' || kind === 'redline-wide') {
    const wide = kind === 'redline-wide', sw = r * (wide ? 0.42 : 0.3), gap = r * (wide ? 0.16 : 0.1), x0 = gap / 2
    const slab = sx => `<path d="M${f(sx * x0)} ${f(r * 0.2)} L${f(sx * (x0 + sw))} ${f(r * 0.2)} L${f(sx * (x0 + sw))} ${f(tip + r * 0.5)} L${f(sx * (x0 + sw * 0.4))} ${f(tip)} L${f(sx * x0)} ${f(tip)}Z" fill="#7d858e" stroke="#2a2e33" stroke-width="${f(r * 0.05)}"/>
      <rect x="${f(sx > 0 ? x0 + sw * 0.55 : -x0 - sw * 0.8)}" y="${f(tip * 0.85)}" width="${f(sw * 0.25)}" height="${f(-tip * 0.75)}" fill="#a4acb5"/>${[0.3, 0.55, 0.8].map(k => `<rect x="${f(sx > 0 ? x0 : -x0 - sw)}" y="${f(tip * k)}" width="${f(sw)}" height="${f(r * 0.06)}" fill="#3a3f45"/>`).join('')}`
    const pulse = i => !firing ? '' : `<rect x="${f(-gap * 0.5)}" y="${f(-r * 0.4)}" width="${f(gap)}" height="${f(r * 0.7)}" fill="#ffd0c8"><animate attributeName="y" values="${f(-r * 0.4)};${f(tip)}" dur="1.1s" begin="${(i * 0.37).toFixed(2)}s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;1;0" dur="1.1s" begin="${(i * 0.37).toFixed(2)}s" repeatCount="indefinite"/></rect>`
    return g(`<rect x="${f(-gap / 2)}" y="${f(tip)}" width="${f(gap)}" height="${f(-tip + r * 0.2)}" fill="#ff2a2a" opacity="${firing ? 1 : 0.55}">${firing ? '<animate attributeName="opacity" values=".65;1;.65" dur="1.1s" repeatCount="indefinite"/>' : ''}</rect>
      <rect x="${f(-gap * 1.6)}" y="${f(tip)}" width="${f(gap * 3.2)}" height="${f(-tip + r * 0.2)}" fill="#ff3a3a" opacity=".22"/>${pulse(0)}${pulse(1)}${pulse(2)}${slab(-1)}${slab(1)}
      ${wide && firing ? `<circle cy="${f(tip)}" r="${f(r * 0.32)}" fill="#ff4a3a" opacity=".35"><animate attributeName="opacity" values=".15;.55;.15" dur="1.1s" repeatCount="indefinite"/></circle>` : ''}
      <circle r="${f(r * 0.85)}" fill="${C.metal}" stroke="#111" stroke-width="${f(r * 0.07)}"/><circle r="${f(r * 0.6)}" fill="#5a636c"/><rect x="${f(-gap / 2)}" y="${f(-r * 0.6)}" width="${f(gap)}" height="${f(r * 0.9)}" fill="#ff2a2a"/>`)
  }
  if (kind === 'crystal') {
    const cl = -tip * 0.8, cw = r * 0.34
    return g(`<path d="M${f(-r * 0.75)} ${f(r * 0.4)} Q${f(-r * 0.95)} ${f(-r * 0.6)} ${f(-r * 0.35)} ${f(-r * 1.2)} M${f(r * 0.75)} ${f(r * 0.4)} Q${f(r * 0.95)} ${f(-r * 0.6)} ${f(r * 0.35)} ${f(-r * 1.2)}" stroke="${C.trim === '#6c7c8e' ? '#c9a24a' : C.trim}" stroke-width="${f(r * 0.16)}" fill="none" stroke-linecap="round"/>
      <circle r="${f(r * 0.8)}" fill="#3a2a1e" stroke="#c9a24a" stroke-width="${f(r * 0.1)}"/>
      <path d="M0 ${f(-cl)} L${f(cw)} ${f(-cl + cw * 1.4)} L${f(cw)} ${f(r * 0.1)} L0 ${f(r * 0.35)} L${f(-cw)} ${f(r * 0.1)} L${f(-cw)} ${f(-cl + cw * 1.4)}Z" fill="#9fe8ff" stroke="#e8fbff" stroke-width="${f(r * 0.05)}"><animate attributeName="fill" values="#7fd8ff;#d8f8ff;#7fd8ff" dur="2.2s" repeatCount="indefinite"/></path>
      <path d="M0 ${f(-cl)} L${f(cw * 0.35)} ${f(-cl + cw * 1.4)} L${f(cw * 0.35)} ${f(r * 0.1)} L0 ${f(r * 0.3)}Z" fill="#ffffff" opacity=".55"/>
      <circle cy="${f(-cl)}" r="${f(r * 0.5)}" fill="#bff0ff" opacity=".3"><animate attributeName="opacity" values=".1;.5;.1" dur="2.2s" repeatCount="indefinite"/></circle>
      ${glyph(1, -r * 0.55, r * 0.15, r * 0.35, 0, 0.3)}${glyph(6, r * 0.55, r * 0.15, r * 0.35, 0, 1.1)}`)
  }
  if (kind === 'ballista') {
    const arm = r * 1.5, by = -r * 0.5
    return g(`<path d="M${f(-arm)} ${f(by + r * 0.6)} Q${f(-arm * 0.5)} ${f(by - r * 0.35)} 0 ${f(by - r * 0.2)} Q${f(arm * 0.5)} ${f(by - r * 0.35)} ${f(arm)} ${f(by + r * 0.6)}" stroke="#b8862e" stroke-width="${f(r * 0.2)}" fill="none" stroke-linecap="round"/>
      <path d="M${f(-arm)} ${f(by + r * 0.6)} L0 ${f(r * 0.55)} L${f(arm)} ${f(by + r * 0.6)}" stroke="#e8e0c8" stroke-width="${f(r * 0.05)}" fill="none"/>
      <rect x="${f(-r * 0.2)}" y="${f(tip * 0.75)}" width="${f(r * 0.4)}" height="${f(-tip * 0.75 + r * 0.9)}" fill="#5a3a1a" stroke="#2a1a0a" stroke-width="${f(r * 0.05)}"/>
      <rect x="${f(-r * 0.05)}" y="${f(tip + r * 0.4)}" width="${f(r * 0.1)}" height="${f(-tip + r * 0.1)}" fill="#cfd4da"/>
      <path d="M0 ${f(tip)} L${f(r * 0.22)} ${f(tip + r * 0.5)} L0 ${f(tip + r * 0.38)} L${f(-r * 0.22)} ${f(tip + r * 0.5)}Z" fill="#dfe6ee" stroke="#6fd8ff" stroke-width="${f(r * 0.05)}"/>
      <circle cy="${f(tip + r * 0.3)}" r="${f(r * 0.32)}" fill="#6fd8ff" opacity=".3"><animate attributeName="opacity" values=".1;.5;.1" dur="1.8s" repeatCount="indefinite"/></circle>
      <circle r="${f(r * 0.35)}" fill="#3a2a1a" stroke="#c9a24a" stroke-width="${f(r * 0.08)}"/>`)
  }
  if (kind === 'mirror') {
    const fy = tip * 0.85
    let rings = ''
    for (let i = 0; i < 4; i++) rings += `<ellipse cy="${f(-r * 0.1)}" rx="${f(r * (1 - i * 0.22))}" ry="${f(r * (0.62 - i * 0.13))}" fill="none" stroke="#fff2b8" stroke-width="${f(r * 0.04)}" opacity=".6"/>`
    return g(`<line x1="0" y1="${f(-r * 0.1)}" x2="0" y2="${f(fy)}" stroke="#5a4a2a" stroke-width="${f(r * 0.08)}"/><line x1="${f(-r * 0.7)}" y1="${f(-r * 0.4)}" x2="0" y2="${f(fy)}" stroke="#5a4a2a" stroke-width="${f(r * 0.05)}"/><line x1="${f(r * 0.7)}" y1="${f(-r * 0.4)}" x2="0" y2="${f(fy)}" stroke="#5a4a2a" stroke-width="${f(r * 0.05)}"/>
      <ellipse cy="${f(-r * 0.1)}" rx="${f(r * 1.1)}" ry="${f(r * 0.7)}" fill="#d4a640" stroke="#6a4a14" stroke-width="${f(r * 0.08)}"/>${rings}
      <path d="M${f(-r * 0.9)} ${f(-r * 0.2)} L0 ${f(fy)} L${f(r * 0.9)} ${f(-r * 0.2)}Z" fill="#fff2b8" opacity=".14"><animate attributeName="opacity" values=".06;.22;.06" dur="1.4s" repeatCount="indefinite"/></path>
      <circle cy="${f(fy)}" r="${f(r * 0.22)}" fill="#fffbe0"><animate attributeName="r" values="${f(r * 0.18)};${f(r * 0.3)};${f(r * 0.18)}" dur="1s" repeatCount="indefinite"/></circle><circle cy="${f(fy)}" r="${f(r * 0.5)}" fill="#ffd060" opacity=".35"/>`)
  }
  return lightning(C, x, y, r, a, len)
}

// a black cannon on a wooden carriage (the great cannon figure picture), pointing at angle a
function cannon (x, y, k, a) {
  const s = FIGURES['human-great-cannon'], h = FIG * 2.2 * k, w = s.w / s.h * h
  return `<image href="${s.href}" x="${f(x - w / 2)}" y="${f(y - h * 0.35)}" width="${f(w)}" height="${f(h)}" transform="rotate(${f(a)} ${f(x)} ${f(y)})" style="image-rendering:pixelated"/>`
}
// a funnel seen from above with smoke drifting aft
function funnel (C, x, y, r, rnd, ry = r) {
  const d = (rnd() * 3).toFixed(2)
  let smoke = ''
  for (let i = 0; i < 3; i++) smoke += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r * 0.7)}" fill="#55595e" opacity="0"><animate attributeName="cy" values="${f(y)};${f(y + r * 7)}" dur="3s" begin="-${(+d + i)}s" repeatCount="indefinite"/><animate attributeName="r" values="${f(r * 0.6)};${f(r * 2.2)}" dur="3s" begin="-${(+d + i)}s" repeatCount="indefinite"/><animate attributeName="opacity" values=".55;0" dur="3s" begin="-${(+d + i)}s" repeatCount="indefinite"/><animate attributeName="cx" values="${f(x)};${f(x + r * 1.5)}" dur="3s" begin="-${(+d + i)}s" repeatCount="indefinite"/></circle>`
  let grille = ''
  for (let i = -2; i <= 2; i++) grille += `<rect x="${f(x - r * 0.55)}" y="${f(y + i * ry * 0.2 - ry * 0.03)}" width="${f(r * 1.1)}" height="${f(ry * 0.06)}" fill="#3a3a3a"/>`
  return `<ellipse cx="${f(x + r * 0.35)}" cy="${f(y + r * 0.6)}" rx="${f(r * 1.1)}" ry="${f(ry * 1.15)}" fill="#000" opacity=".3"/>
    <path d="M${f(x - r * 0.5)} ${f(y)} Q${f(x - r * 1.4)} ${f(y + ry * 4)} ${f(x + r * 0.6)} ${f(y + ry * 7)} Q${f(x + r * 2)} ${f(y + ry * 4)} ${f(x + r * 0.5)} ${f(y)}Z" fill="#5a5e63" opacity=".28"/>
    <ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(r)}" ry="${f(ry)}" fill="${C.funnel}" stroke="#111" stroke-width="${f(r * 0.08)}"/><ellipse cx="${f(x - r * 0.15)}" cy="${f(y - ry * 0.15)}" rx="${f(r * 0.8)}" ry="${f(ry * 0.8)}" fill="#ffffff" opacity=".07"/>
    <ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(r * 0.86)}" ry="${f(ry * 0.86)}" fill="none" stroke="${C.band}" stroke-width="${f(r * 0.16)}"/><ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(r * 0.62)}" ry="${f(ry * 0.62)}" fill="#0c0c0c"/>
    <g clip-path="none">${grille}</g><ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(r * 0.62)}" ry="${f(ry * 0.62)}" fill="none" stroke="#777" stroke-width="${f(r * 0.06)}"/>${smoke}`
}
// torpedoes on a rack, warheads forward, with the tube mouths at the bow
function torpedoRack (C, x, y, n, len) {
  let h = ''
  const w = len * 0.16
  for (let i = 0; i < n; i++) {
    const tx = x + (i - (n - 1) / 2) * w * 1.5
    h += `<rect x="${f(tx - w / 2)}" y="${f(y)}" width="${f(w)}" height="${f(len)}" rx="${f(w / 2)}" fill="#3e4a52" stroke="#15171a" stroke-width="${f(w * 0.1)}"/><path d="M${f(tx - w / 2)} ${f(y + w * 0.6)} Q${f(tx)} ${f(y - w * 0.7)} ${f(tx + w / 2)} ${f(y + w * 0.6)}Z" fill="${C.trim}"/><rect x="${f(tx - w / 2)}" y="${f(y + len * 0.82)}" width="${f(w)}" height="${f(len * 0.08)}" fill="#b02a22"/>`
  }
  return `<rect x="${f(x - n * w * 0.85)}" y="${f(y - w * 0.4)}" width="${f(n * w * 1.7)}" height="${f(len + w * 0.8)}" fill="#000" opacity=".2"/>` + h
}
// a gyrocopter parked on deck: a little brass body and its rotor
// a gyrocopter seen from above (s = its rotor's radius): a brass teardrop body, the pilot in the open cockpit, a gun at the
// nose, an engine with its pusher propeller behind, a tail boom with fins, and the two-bladed rotor spinning over it all
function gyro (C, x, y, s, rnd) {
  const a = rnd() * 180, b = s * 0.3
  const pilot = FIGURES['human-engineer'], ph = s * 0.42, pw = pilot.w / pilot.h * ph
  return `<g transform="translate(${f(x)} ${f(y)})"><ellipse cx="${f(s * 0.15)}" cy="${f(s * 0.25)}" rx="${f(b * 1.1)}" ry="${f(s * 0.95)}" fill="#000" opacity=".3"/>
    <rect x="${f(-b * 0.12)}" y="${f(s * 0.2)}" width="${f(b * 0.24)}" height="${f(s * 0.72)}" fill="${C.trimDark === '#2a323c' ? '#7a5a22' : C.trimDark}"/>
    <path d="M${f(-b * 0.9)} ${f(s * 0.85)} L${f(b * 0.9)} ${f(s * 0.85)} L${f(b * 0.5)} ${f(s * 0.95)} L${f(-b * 0.5)} ${f(s * 0.95)}Z" fill="#b8862e" stroke="#5a3a10" stroke-width="${f(s * 0.02)}"/>
    <path d="M0 ${f(-s * 0.62)} C${f(b)} ${f(-s * 0.55)} ${f(b * 1.05)} ${f(s * 0.05)} ${f(b * 0.55)} ${f(s * 0.32)} L${f(-b * 0.55)} ${f(s * 0.32)} C${f(-b * 1.05)} ${f(s * 0.05)} ${f(-b)} ${f(-s * 0.55)} 0 ${f(-s * 0.62)}Z" fill="#d4a640" stroke="#6a4a14" stroke-width="${f(s * 0.03)}"/>
    <path d="M0 ${f(-s * 0.55)} C${f(b * 0.6)} ${f(-s * 0.5)} ${f(b * 0.7)} ${f(-s * 0.2)} ${f(b * 0.4)} ${f(-s * 0.1)} L${f(-b * 0.4)} ${f(-s * 0.1)} C${f(-b * 0.7)} ${f(-s * 0.2)} ${f(-b * 0.6)} ${f(-s * 0.5)} 0 ${f(-s * 0.55)}Z" fill="#f2d27a" opacity=".6"/>
    <rect x="${f(-b * 0.08)}" y="${f(-s * 0.95)}" width="${f(b * 0.16)}" height="${f(s * 0.38)}" fill="#2a2a2a"/><rect x="${f(-b * 0.13)}" y="${f(-s * 0.97)}" width="${f(b * 0.26)}" height="${f(s * 0.06)}" fill="#111"/>
    <ellipse cx="0" cy="${f(s * 0.02)}" rx="${f(b * 0.55)}" ry="${f(s * 0.17)}" fill="#3a2a1a"/>
    <image href="${pilot.href}" x="${f(-pw / 2)}" y="${f(-s * 0.08 - ph / 2)}" width="${f(pw)}" height="${f(ph)}" style="image-rendering:pixelated"/>
    <rect x="${f(-b * 0.45)}" y="${f(s * 0.24)}" width="${f(b * 0.9)}" height="${f(s * 0.18)}" rx="${f(s * 0.04)}" fill="#4a4a4a" stroke="#1a1a1a" stroke-width="${f(s * 0.02)}"/>
    <g transform="translate(0 ${f(s * 0.45)})"><g><rect x="${f(-b * 0.75)}" y="${f(-s * 0.025)}" width="${f(b * 1.5)}" height="${f(s * 0.05)}" fill="#3a2a1a"/><animateTransform attributeName="transform" type="scale" values="1 1;-1 1;1 1" dur=".25s" repeatCount="indefinite"/></g></g>
    <circle r="${f(s)}" fill="#cfd6dd" opacity=".08"/><circle r="${f(s)}" fill="none" stroke="#cfd6dd" stroke-width="${f(s * 0.02)}" opacity=".25"/>
    <g transform="rotate(${f(a)})"><g><path d="M${f(-s)} ${f(-s * 0.045)} L${f(s)} ${f(-s * 0.03)} L${f(s)} ${f(s * 0.03)} L${f(-s)} ${f(s * 0.045)}Z" fill="#2a2620"/><animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="1.4s" repeatCount="indefinite"/></g></g>
    <circle r="${f(s * 0.07)}" fill="#c9a24a" stroke="#3a2a10" stroke-width="${f(s * 0.02)}"/></g>`
}
// a launch pad out over the side for one gyrocopter: a dark steel platform, brass edging, a landing ring of glowing runes
function launchPad (C, x, y, w, h, runic) {
  let ring = `<circle cx="${f(x)}" cy="${f(y)}" r="${f(Math.min(w, h) * 0.42)}" fill="none" stroke="${runic ? RUNE : C.trim}" stroke-width="0.35" stroke-dasharray="1.2 0.8" opacity=".85"/>`
  if (runic) for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, r = Math.min(w, h) * 0.42; ring += glyph(i * 3 + 2, x + Math.cos(a) * r, y + Math.sin(a) * r, 1.6, i * 45 + 90, i * 0.3) }
  return `<rect x="${f(x - w / 2 + 1)}" y="${f(y - h / 2 + 1.4)}" width="${f(w)}" height="${f(h)}" fill="#000" opacity=".3"/><rect x="${f(x - w / 2)}" y="${f(y - h / 2)}" width="${f(w)}" height="${f(h)}" rx="1" fill="${C.side}" stroke="${C.trim === '#6c7c8e' ? '#c9a24a' : C.trim}" stroke-width="0.6"/>
    <rect x="${f(x - w / 2 + 1)}" y="${f(y - h / 2 + 1)}" width="${f(w - 2)}" height="${f(h - 2)}" rx="0.6" fill="${C.deck}"/>${ring}`
}
const lifeboat = (x, y, s) => `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(s * 0.32)}" ry="${f(s)}" fill="#e9e4d6" stroke="#6a5a40" stroke-width="${f(s * 0.08)}"/><ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(s * 0.2)}" ry="${f(s * 0.8)}" fill="#a07a50"/>`
const crate = (x, y, s) => `<rect x="${f(x - s / 2)}" y="${f(y - s / 2)}" width="${f(s)}" height="${f(s)}" fill="#a0783e" stroke="#5a4020" stroke-width="${f(s * 0.1)}"/><path d="M${f(x - s / 2)} ${f(y - s / 2)} L${f(x + s / 2)} ${f(y + s / 2)} M${f(x + s / 2)} ${f(y - s / 2)} L${f(x - s / 2)} ${f(y + s / 2)}" stroke="#5a4020" stroke-width="${f(s * 0.08)}"/>`
const hatch = (C, x, y, w, h) => { let g = ''; for (let i = 1; i < 3; i++) g += `<rect x="${f(x - w / 2 + w * i / 3 - 0.2)}" y="${f(y - h / 2)}" width="0.4" height="${f(h)}" fill="${C.deckLine}"/>`; return `<rect x="${f(x - w / 2)}" y="${f(y - h / 2)}" width="${f(w)}" height="${f(h)}" fill="${C.metal}" stroke="#1a1c1f" stroke-width="0.5"/><rect x="${f(x - w / 2 + 1)}" y="${f(y - h / 2 + 1)}" width="${f(w - 2)}" height="${f(h - 2)}" fill="${C.deckLight}" opacity=".35"/>${g}` }
const vent = (C, x, y, s, a) => `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(a)})"><ellipse cx="${f(s * 0.3)}" cy="${f(s * 0.4)}" rx="${f(s)}" ry="${f(s * 0.9)}" fill="#000" opacity=".25"/><circle r="${f(s)}" fill="${C.trim}" stroke="${C.trimDark}" stroke-width="${f(s * 0.12)}"/><ellipse cy="${f(-s * 0.25)}" rx="${f(s * 0.6)}" ry="${f(s * 0.45)}" fill="#1a1a1a"/></g>`
const coil = (x, y, s) => `<circle cx="${f(x)}" cy="${f(y)}" r="${f(s)}" fill="#c8b07a"/><circle cx="${f(x)}" cy="${f(y)}" r="${f(s * 0.66)}" fill="none" stroke="#8a7040" stroke-width="${f(s * 0.12)}"/><circle cx="${f(x)}" cy="${f(y)}" r="${f(s * 0.3)}" fill="#8a7040"/>`

// ---------------- the hull ----------------
// half width at y (0 at the bow tip, widest from about a third of the way, a little narrower at the stern)
function halfAt (style, L, hw, y) {
  const t = y / L
  if (style === 'runic' || style === 'brass') return t < 0.4 ? hw * Math.pow(t / 0.4, 0.75) : t < 0.9 ? hw : hw * (1 - (t - 0.9) * 2.2)
  if (style === 'dreadnought') return t < 0.3 ? hw * Math.pow(t / 0.3, 0.6) : t < 0.88 ? hw : hw * (1 - (t - 0.88) * 1.6)
  if (style === 'galleon') return t < 0.3 ? hw * Math.pow(t / 0.3, 0.55) : t < 0.8 ? hw : hw * (1 - (t - 0.8) * 1.1)
  return t < 0.32 ? hw * Math.pow(t / 0.32, 0.62) : t < 0.86 ? hw : hw * (1 - (t - 0.86) * 1.4)
}
function hullPath (style, L, hw, grow = 0, top = 0) {
  const pts = []
  for (let i = 0; i <= 40; i++) { const y = top + (L - top) * i / 40; pts.push([halfAt(style, L, hw, y) + grow, y]) }
  const right = pts.map(([x, y]) => `${f(x)} ${f(y)}`), left = pts.slice().reverse().map(([x, y]) => `${f(-x)} ${f(y)}`)
  return `M${f(0)} ${f(top - grow)} L${right.join(' L')} L${left.join(' L')}Z`
}

// ---------------- the ship ----------------
// THE HUMAN FLEET'S FIVE COLOUR SCHEMES, one of them wooden: each changes the runic ship's steel, deck and trim, and the colour its runes glow.
export const HUMAN_SCHEMES = [
  { id: 'midnight', name: 'Midnight steel', text: 'Dark steel, blue-white runes (as before)', look: {}, rune: '#e4f8ff', glow: '#4fc8ff' },
  { id: 'oak', name: 'Oak and brass', text: 'Planked oak decks and dark timber sides, brass fittings, amber runes', look: { side: '#3e2414', deck: '#8a5a32', deckLine: '#5e3a1c', deckLight: '#a8784a', trim: '#d4aa4a', trimDark: '#7a5a20', metal: '#b8902e', metalLight: '#f2d688', rail: '#8a6a24', funnel: '#2a2018', super: '#6a3f22', superDark: '#4a2a14', glass: '#ffd890' }, rune: '#fff0c0', glow: '#ffae3a', planks: true },
  { id: 'ivory', name: 'Ivory and gold', text: 'Pale ivory steel, gold trim, golden runes', look: { side: '#8c8474', deck: '#d8d0bc', deckLine: '#bdb39c', deckLight: '#ece6d6', trim: '#c9a24a', trimDark: '#8a6a20', metal: '#a89e88', metalLight: '#f0e8d4', funnel: '#5a5244', super: '#efe8d8', superDark: '#bdb39c', glass: '#ffe9a0' }, rune: '#fff6d0', glow: '#e8b440' },
  { id: 'navy', name: 'Royal navy', text: 'Navy blue hull, grey deck, red trim, white runes', look: { side: '#13213e', deck: '#5a6470', deckLine: '#46505c', deckLight: '#727c88', trim: '#b02a2a', trimDark: '#5a1414', metal: '#2a3a5a', metalLight: '#7a8aaa', funnel: '#1a2440', super: '#e8e4dc', superDark: '#9a968e', glass: '#cfe8ff' }, rune: '#ffffff', glow: '#a8c8ff' },
  { id: 'storm', name: 'Storm grey', text: 'Light storm grey, teal runes, black trim', look: { side: '#4a525a', deck: '#9aa2a8', deckLine: '#82898f', deckLight: '#b4bbc0', trim: '#20262c', trimDark: '#101418', metal: '#6a737b', metalLight: '#c8d0d6', funnel: '#30363c', super: '#c4cbd0', superDark: '#8a9298', glass: '#9ff0e0' }, rune: '#d8fff4', glow: '#2ad4b4' }
]
// The lance each fleet draws: rail guns for the Humans, lasers for the Dominion fleet, and the rune crystal, storm
// ballista and sun mirror for the Elf fleet.
export const HUMAN_LANCE = 'rail'   // the twin rail gun; the heavy rail gun on the spine and the bow
export const HUMAN_HEAVY_LANCE = 'rail-heavy'
export const DOMINION_LANCES = ['laser', 'redline', 'redline-wide']
export const ELF_LANCES = ['crystal', 'ballista', 'mirror']
export function seaShipSvg (id, style = 'ironclad', { lance = style === 'runic' ? HUMAN_LANCE : 'lightning', heavy = style === 'runic' && lance === HUMAN_LANCE ? HUMAN_HEAVY_LANCE : null, scheme = 'midnight', firing = false } = {}) {
  const SCH = HUMAN_SCHEMES.find(x => x.id === scheme) ?? HUMAN_SCHEMES[0]
  if (style === 'runic') { RUNE = SCH.rune; GLOW = SCH.glow } else { RUNE = '#e4f8ff'; GLOW = '#4fc8ff' }
  // a ship at rest draws its rail guns still; firing: true animates them
  const lanceAt = (C, x, y, r, a, len, big = false) => lanceGun(big && heavy ? heavy : lance, C, x, y, r, a, len, firing)
  const ship = shipById(id)
  if (!ship) throw new Error(`seaShipSvg: no ship called ${id}`)
  const runic = style === 'runic', brass = style === 'brass', C = runic ? { ...LOOK.runic, ...SCH.look } : LOOK[style], rnd = artRng(id + style)
  const escort = ship.type === 'escort', light = ship.hits === 6
  const L = 100 * sizeOf(ship) * 1.3 * (style === 'runic' ? 1.25 : 1)   // the runic ships drawn bigger, room for detailed gyrocopters
  const hw = L * (escort ? 0.14 : light ? 0.11 : ship.role === 'battleship' ? 0.125 : 0.118) * (style === 'dreadnought' ? 1.04 : style === 'galleon' ? 1.12 : style === 'runic' || style === 'brass' ? 0.95 : 1)
  const side = ship.weapons.filter(w => w.loc === 'port'), prowW = ship.weapons.filter(w => w.loc === 'prow'), dorsalW = ship.weapons.filter(w => w.loc === 'dorsal')
  const bays = side.some(w => w.kind === 'bays')
  const mustered = ['human-handgunner', 'human-handgunner', 'human-crossbowman', 'human-halberdier', 'human-spearman']
  let under = '', deck = '', top = '', port = '', underTorps = ''

  // the hull: its dark side showing past the deck, the deck, its planks or plates, the brass rail
  under += `<path d="${hullPath(style, L, hw, 1.6)}" fill="#0a1a26" opacity=".35" transform="translate(2 3)"/>`
  under += `<path d="${hullPath(style, L, hw, 1.2)}" fill="${C.side}"/>`
  under += `<path d="${hullPath(style, L, hw, -0.6, 1.2)}" fill="${C.deck}"/>`
  const clip = `deck-${id}-${style}`
  let lines = ''
  if (style === 'galleon' || style === 'brass' || (runic && SCH.planks)) for (let x = -hw; x < hw; x += 2.6) lines += `<rect x="${f(x)}" y="0" width="0.22" height="${f(L)}" fill="${C.deckLine}"/>`
  if (!(style === 'galleon' || style === 'brass' || (runic && SCH.planks))) for (let y = L * 0.08; y < L; y += style === 'dreadnought' || style === 'runic' ? 9 : 12) lines += `<rect x="${f(-hw)}" y="${f(y)}" width="${f(hw * 2)}" height="0.35" fill="${C.deckLine}"/>`
  if (style !== 'galleon' && style !== 'brass' && !(runic && SCH.planks)) for (let x = -hw * 0.6; x <= hw * 0.6; x += hw * 0.6) lines += `<rect x="${f(x - 0.15)}" y="0" width="0.3" height="${f(L)}" fill="${C.deckLine}" opacity=".7"/>`
  under += `<defs><clipPath id="${clip}"><path d="${hullPath(style, L, hw, -0.6, 1.2)}"/></clipPath></defs><g clip-path="url(#${clip})">${lines}</g>`
  under += `<path d="${hullPath(style, L, hw, -0.4, 1)}" fill="none" stroke="${C.trim}" stroke-width="${f(style === 'galleon' ? 1.2 : 0.7)}"/>`
  if (style === 'galleon') under += `<path d="${hullPath(style, L, hw, -2.4, 4)}" fill="none" stroke="${C.trimDark}" stroke-width="0.4" opacity=".7"/>`

  // the bow: a brass ram, the anchors, a capstan
  under += `<path d="M0 ${f(-2)} L${f(hw * 0.12)} ${f(L * 0.04)} L${f(-hw * 0.12)} ${f(L * 0.04)}Z" fill="${C.trim}"/>`
  if (style !== 'runic') for (const s of [-1, 1]) under += `<circle cx="${f(s * halfAt(style, L, hw, L * 0.09) * 0.7)}" cy="${f(L * 0.09)}" r="${f(Math.max(1.2, hw * 0.06))}" fill="#222"/>`
  if (!escort) deck += `<circle cx="0" cy="${f(L * 0.12)}" r="${f(hw * 0.14)}" fill="${C.metal}" stroke="${C.trim}" stroke-width="0.6"/><circle cx="0" cy="${f(L * 0.12)}" r="${f(hw * 0.05)}" fill="${C.trim}"/>`

  // ---- the side weapons: a share of the side per port weapon, drawn on the port side and mirrored ----
  const y0 = L * (escort ? 0.4 : 0.26), y1 = L * (escort ? 0.8 : 0.86), seg = (y1 - y0) / Math.max(1, side.length)
  side.forEach((w, i) => {
    const a = y0 + i * seg, b = a + seg
    if (w.kind === 'battery') {
      const n = Math.max(2, Math.min(6, Math.ceil(w.str / 2))), step = (b - a) / n
      for (let k = 0; k < n; k++) {
        const y = a + (k + 0.5) * step, x = -halfAt(style, L, hw, y)
        if (style === 'galleon') { port += cannon(x + FIG * 0.6, y, 0.62, -90); port += man('human-artillery-crew', x + FIG * 1.5, y + FIG * 0.15, -90, 0.8) }
        else if (style === 'dreadnought') { const r = Math.min(step * 0.42, hw * 0.26); port += casemate(C, x + r * 0.5, y, r, w.str >= 10 ? 2 : 1) }
        else { const r = Math.min(step * 0.36, hw * 0.24); port += turret(C, x + r * 1.15, y, r, -90, brass ? 2 : w.str >= 10 ? 3 : 2, 2.0) + (brass ? etched(x + r * 1.15, y, r, -90) : '') }
        if (k > 0 && !escort && style !== 'galleon') port += man(rnd() < 0.5 ? 'human-handgunner' : 'human-crossbowman', x + FIG * 0.75, a + k * step, -90 + (rnd() - 0.5) * 20, 0.85)
      }
    } else if (w.kind === 'lance') {
      const n = Math.min(w.str, 4), step = (b - a) / n
      for (let k = 0; k < n; k++) {
        const y = a + (k + 0.5) * step, x = -halfAt(style, L, hw, y), r = Math.min(step * 0.3, hw * 0.2); port += lanceAt(C, x + r * 1.2, y, r, -90, 3.2)
        port += man('human-engineer', x + r * 2.9, y + r * 0.2, -90, 0.8)
      }
    } else if (w.kind === 'bays') {
      // a launch deck out over the side: a catapult rail and gyrocopters waiting, one per squadron
      const x = -halfAt(style, L, hw, (a + b) / 2), dw = hw * 0.5
      if (runic) {   // a pad out over the side for each gyrocopter, bigger now the ships are bigger
        const n = Math.min(w.str, 4), step = (b - a) / n, pw = Math.min(hw * 0.75, step * 0.95)
        for (let k = 0; k < n; k++) { const py = a + (k + 0.5) * step, px = x - pw * 0.18; port += launchPad(C, px, py, pw, step * 0.9, true) + gyro(C, px, py, Math.min(pw, step) * 0.4, rnd) }
        return
      }
      port += `<rect x="${f(x - dw * 0.35)}" y="${f(a + 1)}" width="${f(dw)}" height="${f(b - a - 2)}" fill="${C.deckLight}" stroke="${C.trim}" stroke-width="0.5"/><rect x="${f(x - dw * 0.25)}" y="${f(a + 2)}" width="${f(dw * 0.16)}" height="${f(b - a - 4)}" fill="#333"/>`
      const n = Math.min(w.str, 4)
      for (let k = 0; k < n; k++) port += gyro(C, x + dw * 0.25, a + (k + 0.5) * (b - a) / n, Math.min(hw * 0.2, (b - a) / n * 0.36), rnd)
    } else if (w.kind === 'torpedo') {
      const x = -halfAt(style, L, hw, (a + b) / 2)
      port += torpedoRack(C, x + hw * 0.3, a + 2, Math.min(3, Math.ceil(w.str / 2)), Math.min(b - a - 4, hw * 0.7))
    }
  })
  // the rail: stanchions along the steamers' edge
  if (style !== 'galleon') for (let y = L * 0.06; y < L * 0.97; y += 3.2) port += `<circle cx="${f(-halfAt(style, L, hw, y) + 1.1)}" cy="${f(y)}" r="0.42" fill="${C.trim}"/>`
  // lifeboats on the steamers' sides, aft
  if (!escort && style !== 'galleon') for (let k = 0; k < 2; k++) { const y = L * (0.8 + k * 0.06); port += lifeboat(-halfAt(style, L, hw, y) + hw * 0.5, y, hw * 0.12) }

  // ---- the spine: the bridge, the funnels or masts, dorsal weapons, the men ----
  const bridgeY = L * (escort ? 0.62 : style === 'dreadnought' || runic || brass ? 0.5 : 0.56)
  const nFun = style === 'galleon' ? 1 : escort ? 1 : runic || brass ? 2 : ship.role === 'battleship' ? 3 : light ? 1 : 2
  if (dorsalW.length) {
    const dy0 = L * (escort ? 0.3 : 0.24), dy1 = bridgeY - hw * 0.5
    for (const d of dorsalW) {
      const n = Math.min(d.str, 4), step = (dy1 - dy0) / n
      for (let k = 0; k < n; k++) { const y = dy0 + (k + 0.5) * step, r = Math.min(step * 0.34, hw * 0.34); top += d.kind === 'lance' ? lanceAt(C, 0, y, r, 0, 3, true) : turret(C, 0, y, r, 0, style === 'dreadnought' ? 3 : 2, 2.3) + (brass ? etched(0, y, r, 0) : '') }
    }
  } else if (!escort && !runic) deck += block(mustered, 0, L * 0.3, Math.max(2, Math.round(hw / FIG * 1.0)), Math.max(1, Math.round(L * 0.07 / FIG)), 0, rnd, FIG * 0.7)

  // the bridge
  if (style === 'dreadnought' || runic || brass) {
    for (let k = 0; k < 3; k++) { const s = 1 - k * 0.24; top += `<rect x="${f(-hw * 0.55 * s)}" y="${f(bridgeY - hw * 0.35 * s - k * 1.5)}" width="${f(hw * 1.1 * s)}" height="${f(hw * 0.8 * s)}" rx="1" fill="${k % 2 ? C.superDark : C.super}" stroke="#2a3038" stroke-width="0.4"/>` }
    top += `<rect x="${f(-hw * 0.35)}" y="${f(bridgeY - hw * 0.34)}" width="${f(hw * 0.7)}" height="${f(hw * 0.08)}" fill="${C.glass}"/><circle cx="0" cy="${f(bridgeY)}" r="${f(hw * 0.12)}" fill="${C.trim}"/>`
    top += man('human-captain-bsb', 0, bridgeY - hw * 0.05, 0, 0.9)
  } else if (style === 'galleon') {
    // the stern castle with its gold lanterns
    const sy = L * 0.82
    top += `<path d="M${f(-halfAt(style, L, hw, sy) * 0.92)} ${f(sy)} L${f(halfAt(style, L, hw, sy) * 0.92)} ${f(sy)} L${f(halfAt(style, L, hw, L * 0.98) * 0.9)} ${f(L * 0.985)} L${f(-halfAt(style, L, hw, L * 0.98) * 0.9)} ${f(L * 0.985)}Z" fill="${C.super}" stroke="${C.trim}" stroke-width="0.7"/>`
    for (const s of [-1, 1]) top += `<circle cx="${f(s * hw * 0.55)}" cy="${f(L * 0.97)}" r="${f(Math.max(1, hw * 0.07))}" fill="${C.glass}"><animate attributeName="opacity" values=".7;1;.7" dur="2.2s" repeatCount="indefinite"/></circle>`
    top += `<circle cx="0" cy="${f(L * 0.9)}" r="${f(hw * 0.14)}" fill="#5a3418" stroke="${C.trim}" stroke-width="0.5"/>`   // the wheel
    top += man('human-captain-bsb', 0, L * 0.86, 0, 0.95) + man('human-general', -hw * 0.35, L * 0.88, 10, 0.9)
  } else {
    top += `<rect x="${f(-hw * 0.5)}" y="${f(bridgeY - hw * 0.3)}" width="${f(hw)}" height="${f(hw * 0.6)}" rx="1.2" fill="${C.super}" stroke="${C.superDark}" stroke-width="0.6"/><rect x="${f(-hw * 0.42)}" y="${f(bridgeY - hw * 0.26)}" width="${f(hw * 0.84)}" height="${f(hw * 0.1)}" fill="${C.glass}"/>`
    top += man('human-captain-bsb', -hw * 0.15, bridgeY + hw * 0.05, 0, 0.85) + man('human-engineer', hw * 0.2, bridgeY + hw * 0.08, 20, 0.8)
  }
  // where the deck aft of the funnels begins (the rune circle and the men go there)
  const sailY = bridgeY + hw * (0.75 + (nFun - 1) * 0.85)
  // funnels behind the bridge
  for (let k = 0; k < nFun; k++) {
    const y = style === 'galleon' ? L * 0.6 : bridgeY + hw * 0.75 + k * hw * 0.85
    top += funnel(C, 0, y, hw * (style === 'dreadnought' ? 0.3 : runic || brass ? 0.2 : 0.26), rnd, hw * (style === 'dreadnought' ? 0.42 : runic || brass ? 0.36 : 0.3))
  }
  // the galleon's masts and sails, between the guns: square sails seen from above, filling with the wind
  if (style === 'galleon') {
    const masts = escort ? [0.36] : ship.role === 'battleship' ? [0.24, 0.44, 0.72] : [0.28, 0.46, 0.72]
    for (const m of masts) {
      const y = L * m, sw = hw * 2.5
      top += `<rect x="${f(-sw / 2)}" y="${f(y - 0.8)}" width="${f(sw)}" height="1.6" fill="#5a3418"/>`
      top += `<path d="M${f(-sw * 0.46)} ${f(y)} Q0 ${f(y - hw * 0.5)} ${f(sw * 0.46)} ${f(y)} L${f(sw * 0.42)} ${f(y + hw * 0.24)} Q0 ${f(y - hw * 0.18)} ${f(-sw * 0.42)} ${f(y + hw * 0.24)}Z" fill="${C.sail}" stroke="${C.sailDark}" stroke-width="0.5" opacity=".95">
        <animateTransform attributeName="transform" type="scale" values="1 1;1 1.06;1 1" dur="4s" repeatCount="indefinite" additive="sum"/></path>`
      top += `<path d="M${f(-sw * 0.2)} ${f(y - hw * 0.15)} L${f(sw * 0.2)} ${f(y - hw * 0.15)}" stroke="#b02a22" stroke-width="${f(hw * 0.07)}"/>`
      top += `<circle cx="0" cy="${f(y)}" r="${f(hw * 0.1)}" fill="#3a2010"/>`
    }
    // the flag at the stern
    top += `<path d="M0 ${f(L * 0.995)} l${f(hw * 0.5)} ${f(hw * 0.12)} l${f(-hw * 0.5)} ${f(hw * 0.24)}Z" fill="#b02a22" stroke="${C.trim}" stroke-width="0.3"><animateTransform attributeName="transform" type="skewY" values="0;6;0;-4;0" dur="2.5s" repeatCount="indefinite"/></path>`
  }
  // deck fittings: a hatch forward of the bridge, mushroom vents by the funnels
  if (style !== 'galleon') {
    if (!escort) deck += hatch(C, 0, bridgeY - hw * 0.75, hw * 0.55, hw * 0.35)
    for (const sx of [-1, 1]) top += vent(C, sx * hw * 0.42, bridgeY + hw * (escort ? 0.6 : 1.1), hw * 0.07, sx * 30)
  }
  if (style === 'dreadnought') {   // the tripod mast and its spotting top
    const my = bridgeY + hw * 0.15
    for (const [dx, dy] of [[-0.25, 0.3], [0.25, 0.3], [0, -0.3]]) top += `<line x1="0" y1="${f(my)}" x2="${f(dx * hw)}" y2="${f(my + dy * hw)}" stroke="#2a3038" stroke-width="${f(hw * 0.05)}"/>`
    top += `<circle cx="0" cy="${f(my)}" r="${f(hw * 0.16)}" fill="${C.superDark}" stroke="${C.trim}" stroke-width="0.5"/><rect x="${f(-hw * 0.4)}" y="${f(my - 0.4)}" width="${f(hw * 0.8)}" height="0.8" fill="#2a3038"/>`
  }
  if (escort) {   // a small crew: two at the bow gun, a lookout aft, a lifeboat on each side
    deck += man('human-handgunner', -hw * 0.4, L * 0.44, -20, 0.8) + man('human-handgunner', hw * 0.4, L * 0.44, 20, 0.8)
    if (style !== 'galleon') for (const sx of [-1, 1]) port += ''
    if (style !== 'galleon') { top += lifeboat(-hw * 0.62, L * 0.78, hw * 0.16) + lifeboat(hw * 0.62, L * 0.78, hw * 0.16) }
    deck += crate(0, L * 0.86, FIG * 0.5)
  }
  // the men amidships and aft
  if (!escort) {
    const aftY = style === 'galleon' ? L * 0.37 : runic ? sailY + hw * 0.9 : Math.max(L * 0.8, bridgeY + hw * (0.75 + (nFun - 1) * 0.85 + 0.5) + FIG * 1.1)
    const aftY2 = runic ? aftY + hw * 1.25 : aftY
    if (aftY2 < L * 0.93) deck += block(['human-halberdier', 'human-greatsword', 'human-spearman'], 0, aftY2, Math.max(2, Math.round(hw / FIG * 1.0)), 2, 0, rnd, FIG * 0.72)
    if (style !== 'galleon') deck += man('human-greatsword-standard', 0, L * 0.9, 180, 1)
    for (let k = 0; k < 3; k++) deck += crate(hw * (0.3 + rnd() * 0.3) * (k % 2 ? 1 : -1), L * (0.64 + rnd() * 0.12), FIG * 0.6)
    deck += coil(-hw * 0.5, L * 0.18, FIG * 0.35) + coil(hw * 0.5, L * 0.18, FIG * 0.35)
  } else deck += man('human-handgunner', -hw * 0.35, L * 0.72, 0, 0.9) + man('human-handgunner', hw * 0.35, L * 0.72, 0, 0.9)

  // ---- the bow weapons, on the centre line forward, all pointing ahead ----
  let fwd = ''
  const by = L * (escort ? 0.24 : 0.16)
  prowW.forEach((w, i) => {
    const off = prowW.length === 1 ? 0 : (i - (prowW.length - 1) / 2) * hw * 0.8, y = by + (escort ? 0 : i * 0.0)
    if (w.kind === 'torpedo' && runic) {
      //: the torpedoes lie
      // under the hull side by side, only their warheads and the front of their bodies showing ahead of the bow
      const n = Math.max(2, Math.min(5, Math.ceil(w.str / 2))), T = hw * (escort ? 1.2 : 1.0), tw = T * 0.16
      const edgeY = x => { let lo = 0, hi = L * 0.45; for (let it = 0; it < 30; it++) { const m = (lo + hi) / 2; if (halfAt(style, L, hw, m) < x) lo = m; else hi = m } return lo }
      let torps = ''
      for (let k = 0; k < n; k++) {
        const tx = (k - (n - 1) / 2) * tw * 1.55, ty = edgeY(Math.abs(tx) + tw * 0.7) - T * 0.5
        torps += `<rect x="${f(tx - tw / 2)}" y="${f(ty)}" width="${f(tw)}" height="${f(T)}" rx="${f(tw / 2)}" fill="#3e4a52" stroke="#15171a" stroke-width="${f(tw * 0.1)}"/><path d="M${f(tx - tw / 2)} ${f(ty + tw * 0.6)} Q${f(tx)} ${f(ty - tw * 0.7)} ${f(tx + tw / 2)} ${f(ty + tw * 0.6)}Z" fill="${C.trim === '#6c7c8e' ? '#c9a24a' : C.trim}"/><rect x="${f(tx - tw / 2)}" y="${f(ty + tw * 0.9)}" width="${f(tw)}" height="${f(tw * 0.35)}" fill="#b02a22"/>`
      }
      underTorps += torps
    } else if (w.kind === 'torpedo' && runic && false) {
      //: tube mouths in
      // both bows, dark with a glowing rune rim, one per two points of strength, split between the sides
      const n = Math.max(1, Math.min(3, Math.ceil(w.str / 4)))
      for (const sx of [-1, 1]) for (let k = 0; k < n; k++) {
        const ty = L * (escort ? 0.13 : 0.12) + k * hw * 0.32, tx = sx * (halfAt(style, L, hw, ty) - hw * 0.12), tr = hw * 0.085
        fwd += `<ellipse cx="${f(tx)}" cy="${f(ty)}" rx="${f(tr)}" ry="${f(tr * 1.6)}" fill="#05080c" stroke="#9fe0ff" stroke-width="0.35"><animate attributeName="stroke-opacity" values=".4;1;.4" dur="2.4s" begin="-${(k * 0.5).toFixed(1)}s" repeatCount="indefinite"/></ellipse>`
      }
    } else if (w.kind === 'torpedo') {
      for (const s of [-1, 1]) fwd += `<rect x="${f(s * hw * 0.3 - hw * 0.08)}" y="${f(L * 0.05)}" width="${f(hw * 0.16)}" height="${f(hw * 0.25)}" fill="#111"/>`
      fwd += torpedoRack(C, off, y + (escort ? 0 : L * 0.04), Math.min(escort ? 2 : 4, Math.ceil(w.str / 2)), Math.min(L * 0.12, hw * 1.0))
    } else if (w.kind === 'lance') fwd += lanceAt(C, off, y + hw * 0.4, hw * (escort ? 0.32 : 0.26), 0, 3.4, true)
    else if (w.kind === 'battery') fwd += style === 'galleon' ? cannon(off, y + hw * 0.2, escort ? 0.7 : 0.9, 0) : turret(C, off, y + hw * 0.4, hw * (escort ? 0.34 : 0.3), 0, brass ? 2 : w.str >= 4 ? 3 : 2, 2.4) + (brass ? etched(off, y + hw * 0.4, hw * (escort ? 0.34 : 0.3), 0) : '')
    else if (w.kind === 'sunburst' && runic) {
      //: one great shell
      // under the keel, its brass nose and banded body poking out well ahead of the bow
      const T = L * 0.32, tw = hw * 0.3, ty = -L * 0.07
      underTorps += `<rect x="${f(-tw / 2)}" y="${f(ty)}" width="${f(tw)}" height="${f(T)}" rx="${f(tw / 2)}" fill="#3e4a52" stroke="#15171a" stroke-width="${f(tw * 0.06)}"/>
        <path d="M${f(-tw / 2)} ${f(ty + tw * 0.75)} Q0 ${f(ty - tw * 0.8)} ${f(tw / 2)} ${f(ty + tw * 0.75)}Z" fill="#d9b04c" stroke="#7a5a1a" stroke-width="${f(tw * 0.05)}"/>
        <path d="M${f(-tw * 0.18)} ${f(ty + tw * 0.6)} Q0 ${f(ty - tw * 0.2)} ${f(tw * 0.18)} ${f(ty + tw * 0.6)}" fill="#f6e2a0" opacity=".7"/>
        ${[0.95, 1.25, 1.55].map(k => `<rect x="${f(-tw / 2)}" y="${f(ty + tw * k)}" width="${f(tw)}" height="${f(tw * 0.14)}" fill="${k === 1.25 ? '#b02a22' : '#d9b04c'}"/>`).join('')}
        ${[-1, 1].map(sx => `<path d="M${f(sx * tw / 2)} ${f(ty + tw * 1.9)} l${f(sx * tw * 0.35)} ${f(tw * 0.5)} l0 ${f(tw * 0.5)} l${f(-sx * tw * 0.35)} ${f(-tw * 0.2)}Z" fill="#59626c" stroke="#15171a" stroke-width="${f(tw * 0.04)}"/>`).join('')}`
    }
    else if (w.kind === 'sunburst') {
      fwd += `<rect x="${f(off - hw * 0.16)}" y="${f(-L * 0.03)}" width="${f(hw * 0.32)}" height="${f(L * 0.26)}" fill="${C.metal}" stroke="#111" stroke-width="0.6"/>${[0.02, 0.08, 0.14].map(k => `<rect x="${f(off - hw * 0.2)}" y="${f(L * k)}" width="${f(hw * 0.4)}" height="${f(L * 0.012)}" fill="${C.trim}"/>`).join('')}<circle cx="${f(off)}" cy="${f(-L * 0.03)}" r="${f(hw * 0.14)}" fill="#111"/>`
    }
  })

  if (runic) {
    const uid = `${id}-${style}`
    const glow = `<defs><filter id="rg-${uid}" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1.1" result="b"/><feFlood flood-color="${GLOW}"/><feComposite in2="b" operator="in" result="c"/><feMerge><feMergeNode in="c"/><feMergeNode in="c"/><feMergeNode in="c"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <radialGradient id="rw-${uid}"><stop offset="0" stop-color="${GLOW}" stop-opacity=".55"/><stop offset=".6" stop-color="${GLOW}" stop-opacity=".2"/><stop offset="1" stop-color="${GLOW}" stop-opacity="0"/></radialGradient></defs>`
    // the sea glowing under the hull with the runes' light
    under = glow + `<ellipse cx="0" cy="${f(L * 0.5)}" rx="${f(hw * 2.4)}" ry="${f(L * 0.62)}" fill="url(#rw-${uid})"><animate attributeName="opacity" values=".6;1;.6" dur="4s" repeatCount="indefinite"/></ellipse>` + under
    // runes down both sides of the deck, pulsing bow to stern; a second, fainter row on the hull side
    let strip = ''
    for (let y = L * 0.07, i = 0; y < L * 0.96; y += 5.2, i++) {
      const x = halfAt(style, L, hw, y)
      if (x < 4) continue
      strip += glyph(i * 5, -x + 2.8, y, 3.6, 0, (y / L) * 3) + glyph(i * 5 + 2, x - 2.8, y, 3.6, 0, (y / L) * 3)
    }
    for (const sx of [-1, 1]) strip += `<path d="M${f(sx * 1.5)} ${f(L * 0.05)} L${f(sx * halfAt(style, L, hw, L * 0.4) * 0.72)} ${f(L * 0.4)} L${f(sx * hw * 0.72)} ${f(L * 0.9)}" fill="none" stroke="${GLOW}" stroke-width="0.35" stroke-dasharray="6 3 1 3" opacity=".7"><animate attributeName="stroke-dashoffset" values="0;-26" dur="5s" repeatCount="indefinite"/></path>`
    // rune circles etched in open deck: fore of the bridge on big ships, aft on all
    let circles = ''
    // the rune circles are teleport circles: soldiers stand on each, ready to be sent across, in a column of light
    const onCircle = (cx, cy, r) => {
      let men = `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r * 0.95)}" fill="${RUNE}" opacity=".1"><animate attributeName="opacity" values=".04;.22;.04" dur="2.6s" repeatCount="indefinite"/></circle>`
      men += man('human-captain-bsb', cx, cy, 0, 0.85)
      const rings = [0.58]
      for (const k of rings) {
        const rr = r * k, n = Math.max(4, Math.min(8, Math.floor(2 * Math.PI * rr / (FIG * 1.15))))
        for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + k; men += man(mustered[Math.floor(rnd() * mustered.length)], cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, (rnd() - 0.5) * 16, 0.82) }
      }
      return men
    }
    let teleport = ''
    if (!escort && !dorsalW.length) { circles += runeCircle(0, L * 0.3, hw * 0.55, 3, 50); teleport += onCircle(0, L * 0.3, hw * 0.55) }
    const ay = Math.min(L * 0.92, sailY + hw * 0.9)
    circles += runeCircle(0, ay, hw * 0.52, 7, 36); teleport += onCircle(0, ay, hw * 0.52)
    deck = `<g filter="url(#rg-${uid})">${strip}${circles}</g>` + deck + teleport
    // obelisks on the bow, the glyphs round the mast, the ward round the hull
    // (no obelisks on the bow: they did not read as anything at this size)
    fwd += `<g filter="url(#rg-${uid})">${orbit(0, bridgeY + hw * 0.15, hw * 0.55, escort ? 4 : 6, 2)}</g>`
    fwd += `<path d="${hullPath(style, L, hw, 4.5, -3)}" fill="${GLOW}" fill-opacity=".1" stroke="${RUNE}" stroke-width="0.9" stroke-opacity=".7" stroke-dasharray="3 2" filter="url(#rg-${uid})"><animate attributeName="stroke-dashoffset" values="0;-25" dur="6s" repeatCount="indefinite"/><animate attributeName="stroke-opacity" values=".35;.9;.35" dur="3.2s" repeatCount="indefinite"/></path>`
    fwd += `<path d="${hullPath(style, L, hw, 6.5, -5)}" fill="none" stroke="${GLOW}" stroke-width="0.25" stroke-opacity=".25"><animate attributeName="stroke-opacity" values=".05;.35;.05" dur="3.2s" begin="-1.6s" repeatCount="indefinite"/></path>`
  }
  if (brass) {
    const uid = `${id}-${style}`
    const glow = `<defs><filter id="bg-${uid}" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1.2" result="b"/><feFlood flood-color="#ffb040"/><feComposite in2="b" operator="in" result="c"/><feMerge><feMergeNode in="c"/><feMergeNode in="c"/><feMergeNode in="c"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`
    // brass scrollwork down both deck edges, a band of carved dark wood inside it
    let trimmings = ''
    for (const sx of [-1, 1]) {
      const pts = []
      for (let y = L * 0.3; y <= L * 0.88; y += 4) pts.push(`${f(sx * (halfAt(style, L, hw, y) - 4.2))} ${f(y)}`)
      trimmings += `<polyline points="${pts.join(' ')}" fill="none" stroke="${C.superDark}" stroke-width="1.6" opacity=".8"/>`
      trimmings += scroll(sx * (hw - 2.2), L * 0.32, L * 0.88, sx)
    }
    deck = glow + trimmings + deck
    // glowing runic engravings along the bow only
    let bow = ''
    for (let y = L * 0.06, i = 0; y < L * 0.3; y += 4.4, i++) {
      const x = halfAt(style, L, hw, y)
      if (x < 3.5) continue
      bow += glyph(i * 3, -x + 2.6, y, 3.8, 0, (y / L) * 6, '#fff3c8') + glyph(i * 3 + 1, x - 2.6, y, 3.8, 0, (y / L) * 6, '#fff3c8')
    }
    fwd += `<g filter="url(#bg-${uid})">${bow}</g>`
    // the radar mast with its tattered banners, streaming aft
    top += banners(0, bridgeY + hw * 0.2, hw * 0.75, hw * 1.4, rnd)
    top += `<circle cx="0" cy="${f(bridgeY + hw * 0.2)}" r="${f(hw * 0.28)}" fill="none" stroke="#d9b04c" stroke-width="0.4" stroke-dasharray="1 1"><animateTransform attributeName="transform" type="rotate" from="0 0 ${f(bridgeY + hw * 0.2)}" to="360 0 ${f(bridgeY + hw * 0.2)}" dur="5s" repeatCount="indefinite"/></circle>`
  }
  const pad = Math.max(hw * 1.5, FIG * 2.5)
  const vb = { x: -hw - pad, y: -pad * 0.6, w: (hw + pad) * 2, h: L + pad * 1.4 }
  if (underTorps) { const k = under.indexOf(`<path d="${hullPath(style, L, hw, 1.2)}"`); under = k >= 0 ? under.slice(0, k) + underTorps + under.slice(k) : underTorps + under }
  const body = under + deck + `${port}<g transform="scale(-1 1)">${port}</g>` + top + fwd
  return { L, hw, vb, svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f(vb.x)} ${f(vb.y)} ${f(vb.w)} ${f(vb.h)}" width="${f(vb.w)}" height="${f(vb.h)}">${body}</svg>`, inner: body }
}

// ---- shared with the sea forts and the other fleets (seaForts.js, seaElves.js) ----
export { FIG, f, artRng, LOOK, man, block, turret, lanceGun, gyro, launchPad, glyph, runeCircle, funnel, crate, coil, hatch, vent, lifeboat, halfAt, hullPath }
export function setRunes (rune, glow) { RUNE = rune; GLOW = glow }
export const runeColours = () => ({ rune: RUNE, glow: GLOW })
