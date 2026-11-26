// THE ORC FLEET of Tides of the Archipelago: detailed fantasy-modern ships with crews you can see on deck. Exports
// orcShipSvg, orcCraftSvg, orcCraft, ORC_SCHEMES and the craft lists; used by seaPictures.js and seaExtras.js.
// The Rukka rules, drawn as rusty scrap dreadnoughts: wide riveted hulls of mismatched plates, a great toothed iron jaw for a ram, spikes along the sides, crooked
// smokestacks belching black smoke, shacks and scrap on deck, mobs of orc boyz with goblins at the guns (the figure pictures in seaFigures.js).
// Weapons from the real profile in src/data/ships.js (dice strengths drawn at their average):
// battery -> crude cannons along the sides or on the bow, goblin crews heavybangers -> huge banded mega-cannons
// lance -> zap guns: iron prongs crackling green torpedo -> under the hull, painted warheads out ahead
// bays -> sky diver catapults, a goblin with wings on each bombardment -> a giant rock thrower catapult
// grabbers -> a great iron claw on the bow
import { shipById, sizeOf } from '../data/ships.js'
import { FIG, f, artRng, man, block } from './seaShips.js'
import { FIGURES } from './seaFigures.js'

export const ORC_SCHEMES = [
  { id: 'rust', name: 'Rust and hazard', text: 'Rusty iron plates, yellow and black hazard stripes', plates: ['#7a4a2a', '#8a5a30', '#6a3e24', '#5e4a3a', '#7e6448'], deck: '#8a6a48', deckLine: '#5e4630', trim: '#e0b030', trim2: '#1a1a1a', metal: '#4a4440', metalLight: '#8a8278', teeth: '#e8e0c8', jaw: '#7a2a1a', smoke: '#2a2622' },
  { id: 'red', name: 'Red paint', text: 'Plates slapped with red paint, white teeth, black trim', plates: ['#9a2a1e', '#b0321e', '#7e2418', '#8a3a2a', '#a8402a'], deck: '#7e6248', deckLine: '#54402e', trim: '#f0e8d8', trim2: '#1a1a1a', metal: '#3a3634', metalLight: '#7a7470', teeth: '#f4f0e4', jaw: '#1a1a1a', smoke: '#2a2622' },
  { id: 'black', name: 'Black iron', text: 'Black iron, checked trim, bone teeth', plates: ['#2e2c2a', '#3a3734', '#26241f', '#44403a', '#33302c'], deck: '#6e645a', deckLine: '#4a423a', trim: '#d8d0c0', trim2: '#1a1a1a', metal: '#5a5650', metalLight: '#9a948a', teeth: '#e8dcc0', jaw: '#8a1a1a', smoke: '#1a1816' },
  { id: 'scrap', name: 'Scrap', text: 'Every plate a different colour, patched and rusting', plates: ['#7a4a2a', '#3a5a6a', '#8a7a3a', '#5a3a5a', '#4a6a3a', '#9a3a2a'], deck: '#8a6a48', deckLine: '#5e4630', trim: '#d0c040', trim2: '#2a2a2a', metal: '#4a4440', metalLight: '#8a8278', teeth: '#e8e0c8', jaw: '#3a5a6a', smoke: '#2a2622' }
]
const BOYZ = ['orc-orc-boy', 'orc-orc-boy-shield', 'orc-orc-boy-spear', 'orc-orc-boy', 'orc-orc-archer', 'orc-orc-bully']
const GITS = ['orc-goblin', 'orc-goblin-crew', 'orc-hood-goblin']
// a mob of boyz, drawn a quarter bigger than men (orcs are big)
function mob (names, cx, cy, cols, rows, rnd) {
  let h = ''
  const gap = FIG * 0.95
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) h += man(names[Math.floor(rnd() * names.length)], cx + (c - (cols - 1) / 2) * gap + (rnd() - 0.5) * 2, cy + (r - (rows - 1) / 2) * gap + (rnd() - 0.5) * 2, (rnd() - 0.5) * 24, 1.25)
  return h
}

// a dice strength at its average: 'D6+6' -> 9.5, '2D6' -> 7, 'special' -> 2
export function avgStr (s) {
  if (typeof s === 'number') return s
  const m = String(s).match(/^(\d*)D(\d)([+-]\d+)?$/)
  if (!m) return 2
  return (+(m[1] || 1)) * (+m[2] + 1) / 2 + (+(m[3] || 0))
}

// half width of the scrap hull at y: a blunt jaw, wide straight sides, a square stern, with a wobble where plates stick out
function halfAt (L, hw, y, wob) {
  const t = y / L
  const base = t < 0.16 ? hw * (0.55 + 0.45 * Math.sin(t / 0.16 * Math.PI / 2)) : t < 0.92 ? hw : hw * (1 - (t - 0.92) * 1.2)
  return base * (1 + (wob ? 0.03 * Math.sin(y * 0.37) + 0.02 * Math.sin(y * 1.1) : 0))
}
function hullPath (L, hw, grow = 0, top = 0, wob = true) {
  const pts = []
  for (let i = 0; i <= 60; i++) { const y = top + (L - top) * i / 60; pts.push([halfAt(L, hw, y, wob) + grow, y]) }
  const right = pts.map(([x, y]) => `${f(x)} ${f(y)}`), left = pts.slice().reverse().map(([x, y]) => `${f(-x)} ${f(y)}`)
  return `M${f(-hw * 0.55 - grow)} ${f(top)} L${f(hw * 0.55 + grow)} ${f(top)} L${right.join(' L')} L${left.join(' L')}Z`
}
// a crude cannon pointing at angle a (0 = up): an iron barrel on a timber block, a band or two, sometimes crooked
function gun (S, x, y, r, a, rnd, heavy = false, firing = false) {
  const len = r * (heavy ? 3.2 : 2.6), bw = r * (heavy ? 0.62 : 0.42), kink = (rnd() - 0.5) * (heavy ? 2 : 6)
  return `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(a + kink)})"><rect x="${f(-r * 0.95 + 1)}" y="${f(-r * 0.7 + 1.5)}" width="${f(r * 1.9)}" height="${f(r * 1.5)}" fill="#000" opacity=".3"/>
    <rect x="${f(-bw / 2)}" y="${f(-len)}" width="${f(bw)}" height="${f(len)}" fill="${S.metal}" stroke="#111" stroke-width="${f(r * 0.06)}"/>
    <rect x="${f(-bw * 0.7)}" y="${f(-len)}" width="${f(bw * 1.4)}" height="${f(r * (heavy ? 0.45 : 0.3))}" fill="#1a1a1a"/>${heavy ? `<rect x="${f(-bw * 0.75)}" y="${f(-len + r * 0.6)}" width="${f(bw * 1.5)}" height="${f(r * 0.22)}" fill="${S.jaw}"/><rect x="${f(-bw * 0.75)}" y="${f(-len * 0.45)}" width="${f(bw * 1.5)}" height="${f(r * 0.22)}" fill="${S.trim}"/>` : `<rect x="${f(-bw * 0.6)}" y="${f(-len * 0.5)}" width="${f(bw * 1.2)}" height="${f(r * 0.16)}" fill="${S.metalLight}"/>`}
    <rect x="${f(-r * 0.9)}" y="${f(-r * 0.6)}" width="${f(r * 1.8)}" height="${f(r * 1.3)}" rx="${f(r * 0.15)}" fill="${heavy ? S.metal : '#6a4a2a'}" stroke="#1a1208" stroke-width="${f(r * 0.08)}"/>
    ${[[-0.7, -0.45], [0.7, -0.45], [-0.7, 0.55], [0.7, 0.55]].map(([px, py]) => `<circle cx="${f(px * r)}" cy="${f(py * r)}" r="${f(r * 0.08)}" fill="#c8b890"/>`).join('')}
    ${heavy ? `<circle r="${f(r * 0.4)}" fill="${S.trim}"/><circle r="${f(r * 0.2)}" fill="#1a1a1a"/>` : ''}${firing ? fireball(len, r, heavy, rnd) : ''}</g>`
}
// FIREBALLS: only while firing, a ball of fire bursts from
// the muzzle and flies out, trailing flame and black smoke, again and again
function fireball (len, r, heavy, rnd) {
  const k = heavy ? 1.5 : 1, dur = (heavy ? 1.3 : 1.0) + rnd() * 0.3, d = (rnd() * dur).toFixed(2), far = -len - r * 9 * k
  const anim = (attr, vals) => `<animate attributeName="${attr}" values="${vals}" dur="${dur.toFixed(2)}s" begin="-${d}s" repeatCount="indefinite"/>`
  return `<g><circle cx="0" cy="${f(-len)}" r="${f(r * 0.5 * k)}" fill="#ffe070">${anim('r', `${f(r * 0.9 * k)};${f(r * 0.3 * k)};0`)}${anim('opacity', '1;.6;0')}</circle>
    <circle cx="0" cy="${f(-len)}" r="${f(r * 0.8 * k)}" fill="#2a2420" opacity=".5">${anim('cy', `${f(-len)};${f(-len - r * 3 * k)}`)}${anim('r', `${f(r * 0.4 * k)};${f(r * 1.6 * k)}`)}${anim('opacity', '.55;0')}</circle>
    <circle cx="0" cy="${f(-len)}" r="${f(r * 0.6 * k)}" fill="#ff5a10">${anim('cy', `${f(-len)};${f(far)}`)}${anim('r', `${f(r * 0.45 * k)};${f(r * 0.75 * k)}`)}${anim('opacity', '1;1;.9;0')}</circle>
    <circle cx="0" cy="${f(-len)}" r="${f(r * 0.35 * k)}" fill="#ffd040">${anim('cy', `${f(-len)};${f(far)}`)}${anim('r', `${f(r * 0.25 * k)};${f(r * 0.45 * k)}`)}${anim('opacity', '1;1;.9;0')}</circle>
    <path d="M0 ${f(-len)} l${f(-r * 0.35 * k)} ${f(r * 1.6 * k)} l${f(r * 0.7 * k)} 0Z" fill="#ff8a20" opacity=".8"><animateTransform attributeName="transform" type="translate" values="0 0;0 ${f(far + len)}" dur="${dur.toFixed(2)}s" begin="-${d}s" repeatCount="indefinite"/>${anim('opacity', '.9;.6;0')}</path></g>`
}
// a zap gun: a coil drum, two iron prongs, green lightning between them (only while firing); pointing at angle a
function zap (S, x, y, r, a, firing = false) {
  const tip = -r * 2.8
  return `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(a)})"><circle cx="1" cy="1.5" r="${f(r * 1.05)}" fill="#000" opacity=".3"/>
    <path d="M${f(-r * 0.35)} ${f(-r * 0.4)} L${f(-r * 0.45)} ${f(tip)} M${f(r * 0.35)} ${f(-r * 0.4)} L${f(r * 0.45)} ${f(tip)}" stroke="${S.metal}" stroke-width="${f(r * 0.22)}" stroke-linecap="round"/>
    <circle r="${f(r)}" fill="#3a3a30" stroke="#111" stroke-width="${f(r * 0.08)}"/><circle r="${f(r * 0.7)}" fill="none" stroke="#b8682e" stroke-width="${f(r * 0.18)}"/><circle r="${f(r * 0.32)}" fill="#7fe85a"/>
    ${[-0.45, 0.45].map(sx => `<circle cx="${f(sx * r)}" cy="${f(tip)}" r="${f(r * 0.18)}" fill="#7fe85a"/>`).join('')}
    ${firing ? `<path d="M${f(-r * 0.45)} ${f(tip)} l${f(r * 0.3)} ${f(r * 0.25)} l${f(r * 0.2)} ${f(-r * 0.3)} l${f(r * 0.4)} ${f(r * 0.3)}" stroke="#d8ffc0" stroke-width="${f(r * 0.1)}" fill="none"><animate attributeName="opacity" values="1;0;1;0" dur=".4s" repeatCount="indefinite"/></path>` : ''}</g>`
}
// a smokestack, crooked, with a ring of rivets and black smoke rolling aft
function stack (S, x, y, r, rnd) {
  const d = (rnd() * 3).toFixed(2)
  let smoke = ''
  for (let i = 0; i < 3; i++) smoke += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${S.smoke}" opacity="0"><animate attributeName="cy" values="${f(y)};${f(y + r * 9)}" dur="3.4s" begin="-${(+d + i * 1.1).toFixed(2)}s" repeatCount="indefinite"/><animate attributeName="r" values="${f(r * 0.7)};${f(r * 2.8)}" dur="3.4s" begin="-${(+d + i * 1.1).toFixed(2)}s" repeatCount="indefinite"/><animate attributeName="opacity" values=".75;0" dur="3.4s" begin="-${(+d + i * 1.1).toFixed(2)}s" repeatCount="indefinite"/><animate attributeName="cx" values="${f(x)};${f(x + r * 2)}" dur="3.4s" begin="-${(+d + i * 1.1).toFixed(2)}s" repeatCount="indefinite"/></circle>`
  let rivets = ''
  for (let i = 0; i < 8; i++) { const t = i / 8 * Math.PI * 2; rivets += `<circle cx="${f(x + Math.cos(t) * r * 0.82)}" cy="${f(y + Math.sin(t) * r * 0.82)}" r="${f(r * 0.07)}" fill="#c8b890"/>` }
  return `<path d="M${f(x - r * 0.6)} ${f(y)} Q${f(x - r * 1.8)} ${f(y + r * 5)} ${f(x + r)} ${f(y + r * 9)} Q${f(x + r * 2.6)} ${f(y + r * 5)} ${f(x + r * 0.6)} ${f(y)}Z" fill="${S.smoke}" opacity=".35"/>
    <ellipse cx="${f(x + r * 0.35)}" cy="${f(y + r * 0.5)}" rx="${f(r * 1.1)}" ry="${f(r * 1.1)}" fill="#000" opacity=".3"/><circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${S.metal}" stroke="#111" stroke-width="${f(r * 0.1)}"/>${rivets}
    <circle cx="${f(x)}" cy="${f(y)}" r="${f(r * 0.6)}" fill="#0c0a08"/><circle cx="${f(x)}" cy="${f(y)}" r="${f(r * 0.4)}" fill="#ff7a1a" opacity=".35"/>${smoke}`
}
// a scrap shack with a corrugated roof
function shack (S, x, y, w, h, rot) {
  let ribs = ''
  for (let i = 1; i < 6; i++) ribs += `<rect x="${f(-w / 2 + w * i / 6 - 0.2)}" y="${f(-h / 2)}" width="0.4" height="${f(h)}" fill="#000" opacity=".25"/>`
  return `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(rot)})"><rect x="${f(-w / 2 + 1.5)}" y="${f(-h / 2 + 2)}" width="${f(w)}" height="${f(h)}" fill="#000" opacity=".3"/><rect x="${f(-w / 2)}" y="${f(-h / 2)}" width="${f(w)}" height="${f(h)}" fill="#8a8478" stroke="#3a3630" stroke-width="0.5"/>${ribs}<rect x="${f(-w / 2)}" y="${f(-h / 2)}" width="${f(w * 0.35)}" height="${f(h)}" fill="#7a4a2a" opacity=".5"/></g>`
}
const barrel = (x, y, s) => `<circle cx="${f(x)}" cy="${f(y)}" r="${f(s)}" fill="#6a4a2a" stroke="#2a1a0a" stroke-width="${f(s * 0.15)}"/><circle cx="${f(x)}" cy="${f(y)}" r="${f(s * 0.62)}" fill="none" stroke="#4a4440" stroke-width="${f(s * 0.12)}"/>`
// THE ORC ATTACK CRAFT: several looks for the buzzas (fighters) and droppers (bombers), each drawn at size s pointing up
export const ORC_CRAFT = [
  { id: 'skydiver', name: 'Sky divers', role: 'buzza', text: 'Goblins with bat wings, flung off a ramp, steering into the target' },
  { id: 'rokkit', name: 'Rokkit gits', role: 'buzza', text: 'A goblin clinging to a big rocket, flame and smoke out the back' },
  { id: 'biplane', name: 'Scrap kites', role: 'buzza or dropper', text: 'Patched scrap biplanes, a spinning propeller, an orc pilot, a bomb under each wing' },
  { id: 'balloon', name: 'Bomb balloons', role: 'dropper', text: 'A patched balloon with a basket of goblins dropping bombs' },
  { id: 'wyvern', name: 'Wyvern riders', role: 'dropper', text: 'An orc on a wyvern, big and slow, the bomber' },
  { id: 'beast', name: 'Hopper Beast hoppers', role: 'buzza', text: 'Goblins on bouncing hopperbeasts, hopping across the waves' }
]
export function orcCraft (kind, x, y, s, rot = 0, S = ORC_SCHEMES[0]) {
  const img = (name, k = 1) => { const c = FIGURES[name], h = s * k, w = c.w / c.h * h; return `<image href="${c.href}" x="${f(-w / 2)}" y="${f(-h / 2)}" width="${f(w)}" height="${f(h)}" style="image-rendering:pixelated"/>` }
  let h = ''
  if (kind === 'skydiver') {   // a goblin with patched bat wings (drawn here: the figure picture still has its catapult)
    const wing = sx => `<path d="M${f(sx * s * 0.08)} ${f(-s * 0.05)} Q${f(sx * s * 0.3)} ${f(-s * 0.32)} ${f(sx * s * 0.55)} ${f(-s * 0.18)} L${f(sx * s * 0.48)} ${f(s * 0.02)} L${f(sx * s * 0.38)} ${f(-s * 0.04)} L${f(sx * s * 0.3)} ${f(s * 0.1)} L${f(sx * s * 0.2)} ${f(s * 0.02)} L${f(sx * s * 0.1)} ${f(s * 0.12)}Z" fill="#d4b884" stroke="#3a2a1a" stroke-width="${f(s * 0.015)}"/><path d="M${f(sx * s * 0.08)} ${f(-s * 0.05)} L${f(sx * s * 0.48)} ${f(s * 0.02)} M${f(sx * s * 0.12)} ${f(-s * 0.08)} L${f(sx * s * 0.3)} ${f(s * 0.1)}" stroke="#5a3a1a" stroke-width="${f(s * 0.012)}"/>`
    h = wing(-1) + wing(1) + img('orc-hood-goblin', 0.4)
  }
  else if (kind === 'wyvern') h = img('orc-wyvern-rider', 1.1)
  else if (kind === 'beast') h = img('orc-beast-hopper', 0.6) + `<ellipse cy="${f(s * 0.32)}" rx="${f(s * 0.28)}" ry="${f(s * 0.08)}" fill="#e8f8ff" opacity=".35"><animate attributeName="rx" values="${f(s * 0.1)};${f(s * 0.35)}" dur=".8s" repeatCount="indefinite"/><animate attributeName="opacity" values=".5;0" dur=".8s" repeatCount="indefinite"/></ellipse>`
  else if (kind === 'rokkit') {
    h = `<path d="M${f(-s * 0.1)} ${f(s * 0.42)} L0 ${f(s * 0.9)} L${f(s * 0.1)} ${f(s * 0.42)}Z" fill="#ff8a1a"><animate attributeName="d" values="M${f(-s * 0.1)} ${f(s * 0.42)} L0 ${f(s * 0.9)} L${f(s * 0.1)} ${f(s * 0.42)}Z;M${f(-s * 0.1)} ${f(s * 0.42)} L0 ${f(s * 0.75)} L${f(s * 0.1)} ${f(s * 0.42)}Z;M${f(-s * 0.1)} ${f(s * 0.42)} L0 ${f(s * 0.9)} L${f(s * 0.1)} ${f(s * 0.42)}Z" dur=".25s" repeatCount="indefinite"/></path><circle cy="${f(s * 0.5)}" r="${f(s * 0.07)}" fill="#ffe070"/>
      <rect x="${f(-s * 0.09)}" y="${f(-s * 0.45)}" width="${f(s * 0.18)}" height="${f(s * 0.9)}" rx="${f(s * 0.05)}" fill="${S.metal}" stroke="#111" stroke-width="${f(s * 0.02)}"/><path d="M${f(-s * 0.09)} ${f(-s * 0.45)} Q0 ${f(-s * 0.65)} ${f(s * 0.09)} ${f(-s * 0.45)}Z" fill="${S.jaw === '#1a1a1a' ? '#b0321e' : S.jaw}"/>
      ${[-1, 1].map(sx => `<path d="M${f(sx * s * 0.09)} ${f(s * 0.2)} L${f(sx * s * 0.25)} ${f(s * 0.45)} L${f(sx * s * 0.09)} ${f(s * 0.42)}Z" fill="${S.trim}" stroke="#111" stroke-width="${f(s * 0.015)}"/>`).join('')}<g transform="translate(0 ${f(-s * 0.05)})">${img('orc-goblin', 0.38)}</g>`
  } else if (kind === 'biplane') {
    const wing = (y, w) => `<rect x="${f(-w / 2)}" y="${f(y)}" width="${f(w)}" height="${f(s * 0.16)}" rx="${f(s * 0.04)}" fill="${S.plates[1]}" stroke="#1e1a16" stroke-width="${f(s * 0.02)}"/>${[-0.35, 0, 0.35].map(k => `<rect x="${f(k * w - s * 0.06)}" y="${f(y + s * 0.02)}" width="${f(s * 0.12)}" height="${f(s * 0.12)}" fill="${S.plates[2]}"/>`).join('')}`
    h = `<rect x="${f(-s * 0.08)}" y="${f(-s * 0.35)}" width="${f(s * 0.16)}" height="${f(s * 0.8)}" rx="${f(s * 0.05)}" fill="${S.plates[0]}" stroke="#111" stroke-width="${f(s * 0.02)}"/>${wing(-s * 0.12, s * 1.0)}${wing(s * 0.3, s * 0.42)}
      ${[-0.32, 0.32].map(k => `<circle cx="${f(k * s)}" cy="${f(s * 0.1)}" r="${f(s * 0.06)}" fill="#222"/>`).join('')}<g transform="translate(0 ${f(s * 0.05)})">${img('orc-orc-boy', 0.3)}</g>
      <ellipse cy="${f(-s * 0.38)}" rx="${f(s * 0.32)}" ry="${f(s * 0.05)}" fill="#cfd6dd" opacity=".35"/><rect x="${f(-s * 0.3)}" y="${f(-s * 0.4)}" width="${f(s * 0.6)}" height="${f(s * 0.03)}" fill="#3a2a1a"><animateTransform attributeName="transform" type="scale" values="1 1;-1 1;1 1" dur=".2s" additive="sum" repeatCount="indefinite"/></rect>`
  } else if (kind === 'balloon') {
    let patches = ''
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; patches += `<rect x="${f(Math.cos(a) * s * 0.22 - s * 0.07)}" y="${f(Math.sin(a) * s * 0.22 - s * 0.06)}" width="${f(s * 0.14)}" height="${f(s * 0.12)}" fill="${S.plates[(i + 1) % S.plates.length]}" stroke="#2a1a0a" stroke-width="${f(s * 0.01)}"/>` }
    h = `<ellipse cx="${f(s * 0.12)}" cy="${f(s * 0.2)}" rx="${f(s * 0.42)}" ry="${f(s * 0.42)}" fill="#000" opacity=".2"/><circle r="${f(s * 0.42)}" fill="#c8a060" stroke="#3a2a1a" stroke-width="${f(s * 0.02)}"/>${patches}
      ${[0, 1, 2, 3, 4, 5, 6, 7].map(i => `<path d="M0 ${f(-s * 0.42)} Q${f(Math.cos(i / 8 * Math.PI * 2) * s * 0.5)} 0 0 ${f(s * 0.42)}" fill="none" stroke="#3a2a1a" stroke-width="${f(s * 0.01)}" opacity=".5" transform="rotate(${i * 22.5})"/>`).join('')}
      <circle r="${f(s * 0.1)}" fill="#6a4a2a" stroke="#2a1a0a" stroke-width="${f(s * 0.015)}"/>${img('orc-goblin', 0.2)}<circle cx="${f(s * 0.15)}" cy="${f(s * 0.55)}" r="${f(s * 0.05)}" fill="#1a1a1a"><animate attributeName="r" values="${f(s * 0.06)};${f(s * 0.02)}" dur="1.2s" repeatCount="indefinite"/></circle>`
  }
  return `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(rot)})">${h}</g>`
}
// a launch ramp for the attack craft (the launch bays): a timber ramp out over the side with a craft on it
function ramp (S, x, y, w, l, kind, rot) {
  return `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(rot)})"><rect x="${f(-w / 2 + 1)}" y="${f(-l / 2 + 1.5)}" width="${f(w)}" height="${f(l)}" fill="#000" opacity=".3"/><rect x="${f(-w / 2)}" y="${f(-l / 2)}" width="${f(w)}" height="${f(l)}" fill="#6a4a2a" stroke="#2a1a0a" stroke-width="0.6"/>${Array.from({ length: 5 }, (_, i) => `<rect x="${f(-w / 2)}" y="${f(-l / 2 + l * (i + 0.5) / 5)}" width="${f(w)}" height="0.5" fill="#3a2a1a"/>`).join('')}<rect x="${f(-w * 0.08)}" y="${f(-l / 2)}" width="${f(w * 0.16)}" height="${f(l)}" fill="${S.metal}"/>${orcCraft(kind, 0, 0, Math.min(w, l) * 0.95, 0, S)}</g>`
}
// THE TELEPORT CATAPULT: the Orcs teleport by throwing boyz across. A giant catapult at the back of a capital ship (capital ships teleport), boyz waiting round it, one on
// the arm ready to go
function teleportCatapult (S, x, y, s, rnd) {
  const lob = FIGURES['orc-rock-thrower'], lh = s, lw = lob.w / lob.h * lh
  let h = `<image href="${lob.href}" x="${f(x - lw / 2)}" y="${f(y - lh / 2)}" width="${f(lw)}" height="${f(lh)}" transform="rotate(180 ${f(x)} ${f(y)})" style="image-rendering:pixelated"/>`
  h += man('orc-orc-boy', x, y - lh * 0.3, 180, 1.0)   // on the arm, ready to be thrown
  const spots = [[-0.62, -0.25], [0.62, -0.2], [-0.66, 0.15], [0.64, 0.22], [-0.3, 0.5], [0.32, 0.52]]
  for (const [dx, dy] of spots) h += man(BOYZ[Math.floor(rnd() * BOYZ.length)], x + dx * lw * 1.1, y + dy * lh, (rnd() - 0.5) * 40, 1.15)
  return h
}
// a sky diver catapult: a timber frame and arm, a winged goblin on it, ready to be flung
function diverCatapult (S, x, y, s, rot) {
  const lob = FIGURES['orc-rock-thrower'], dd = FIGURES['orc-sky-diver']
  const lh = s, lw = lob.w / lob.h * lh, dw = s * 0.5, dh = dd.h / dd.w * dw
  return `<g transform="rotate(${f(rot)} ${f(x)} ${f(y)})"><image href="${lob.href}" x="${f(x - lw / 2)}" y="${f(y - lh / 2)}" width="${f(lw)}" height="${f(lh)}" style="image-rendering:pixelated"/><image href="${dd.href}" x="${f(x - dw / 2)}" y="${f(y + lh * 0.18 - dh / 2)}" width="${f(dw)}" height="${f(dh)}" style="image-rendering:pixelated"/></g>`
}
// the iron jaw on the bow: a red mouth, two rows of iron teeth, eyes
function jaw (S, L, hw) {
  const y0 = L * 0.02, y1 = L * 0.15, w = hw * 0.62
  let teeth = ''
  for (let i = 0; i < 7; i++) { const t = i / 6, x = -w + 2 * w * t, yy = y0 + (y1 - y0) * 0.35 + Math.abs(t - 0.5) * (y1 - y0) * 0.5; teeth += `<path d="M${f(x - w * 0.12)} ${f(yy)} L${f(x)} ${f(yy + w * 0.32)} L${f(x + w * 0.12)} ${f(yy)}Z" fill="${S.teeth}" stroke="#3a3428" stroke-width="0.4"/>` }
  return `<path d="M${f(-w)} ${f(y1)} Q${f(-w)} ${f(y0)} 0 ${f(y0 - 4)} Q${f(w)} ${f(y0)} ${f(w)} ${f(y1)} Q0 ${f(y1 - 4)} ${f(-w)} ${f(y1)}Z" fill="${S.jaw}" stroke="#111" stroke-width="0.8"/>${teeth}
    ${[-1, 1].map(sx => `<circle cx="${f(sx * w * 0.6)}" cy="${f(y1 + 5)}" r="3.2" fill="#ffe040" stroke="#111" stroke-width="0.6"/><circle cx="${f(sx * w * 0.6)}" cy="${f(y1 + 5)}" r="1.3" fill="#c01010"/>`).join('')}
    <path d="M${f(-w * 0.15)} ${f(y0 - 3)} L0 ${f(y0 - 12)} L${f(w * 0.15)} ${f(y0 - 3)}Z" fill="${S.metalLight}" stroke="#111" stroke-width="0.5"/>`
}
// THE BOW OPTIONS
export const ORC_BOWS = [
  //
  { id: 'dome', name: 'Red D and point', text: 'The red D-shaped bow plate and its iron point, without the teeth and eyes, riveted round the edge' },
  { id: 'ram', name: 'Iron ram', text: 'A long riveted iron spike, banded, for punching through hulls' },
  { id: 'plough', name: 'Plough blade', text: 'A great curved bulldozer blade across the bow, bolted and dented' },
  { id: 'saw', name: 'Big saw', text: 'A huge circular saw blade on an arm, spinning' },
  { id: 'drill', name: 'Drill', text: 'A giant ribbed drill cone turning on the bow' },
  { id: 'spikes', name: 'Spike cluster', text: 'A thicket of iron spikes and girders welded on the bow' },
  { id: 'jaw', name: 'Jaw (as before)', text: 'The red jaw with teeth and eyes' }
]
function bowPiece (kind, S, L, hw, rnd) {
  const y0 = L * 0.02, w = hw * 0.6
  if (kind === 'dome') {
    const y1 = L * 0.15, wd = hw * 0.62
    let rivets = ''
    for (let i = 1; i < 12; i++) { const t = i / 12, a = Math.PI * (1 - t); rivets += `<circle cx="${f(Math.cos(a) * wd * 0.86)}" cy="${f(y1 - Math.sin(a) * (y1 - y0 + 3) * 0.86)}" r="0.8" fill="#c8b890"/>` }
    return `<path d="M${f(-wd)} ${f(y1)} Q${f(-wd)} ${f(y0)} 0 ${f(y0 - 4)} Q${f(wd)} ${f(y0)} ${f(wd)} ${f(y1)} Q0 ${f(y1 - 4)} ${f(-wd)} ${f(y1)}Z" fill="${S.jaw}" stroke="#111" stroke-width="0.8"/>
      <path d="M${f(-wd * 0.8)} ${f(y1 - 2)} Q${f(-wd * 0.75)} ${f(y0 + 3)} 0 ${f(y0)} Q${f(wd * 0.75)} ${f(y0 + 3)} ${f(wd * 0.8)} ${f(y1 - 2)}" fill="none" stroke="#ffffff" stroke-width="1.2" opacity=".15"/>${rivets}
      <path d="M${f(-wd * 0.15)} ${f(y0 - 3)} L0 ${f(y0 - 12)} L${f(wd * 0.15)} ${f(y0 - 3)}Z" fill="${S.metalLight}" stroke="#111" stroke-width="0.5"/>`
  }
  if (kind === 'ram') {
    let bands = ''
    for (let i = 0; i < 4; i++) { const y = y0 - w * 0.1 + i * w * 0.35; bands += `<rect x="${f(-w * (0.28 + i * 0.06))}" y="${f(y)}" width="${f(w * (0.56 + i * 0.12))}" height="${f(w * 0.08)}" fill="${S.trim}" stroke="#111" stroke-width="0.4"/>` }
    return `<path d="M0 ${f(y0 - w * 1.4)} L${f(w * 0.5)} ${f(y0 + w * 1.3)} L${f(-w * 0.5)} ${f(y0 + w * 1.3)}Z" fill="${S.metal}" stroke="#111" stroke-width="0.9"/><path d="M0 ${f(y0 - w * 1.4)} L${f(w * 0.12)} ${f(y0 + w * 1.3)} L${f(-w * 0.08)} ${f(y0 + w * 1.3)}Z" fill="${S.metalLight}" opacity=".6"/>${bands}${[0.2, 0.6, 1.0].map(k => `<circle cx="${f(-w * 0.22)}" cy="${f(y0 + w * k)}" r="0.7" fill="#c8b890"/><circle cx="${f(w * 0.22)}" cy="${f(y0 + w * k)}" r="0.7" fill="#c8b890"/>`).join('')}`
  }
  if (kind === 'plough') {
    let dents = ''
    for (let i = 0; i < 6; i++) dents += `<circle cx="${f(-w * 0.9 + rnd() * w * 1.8)}" cy="${f(y0 + rnd() * w * 0.3)}" r="${f(1 + rnd() * 1.4)}" fill="#000" opacity=".25"/>`
    return `<path d="M${f(-w * 1.25)} ${f(y0 + w * 0.6)} Q0 ${f(y0 - w * 0.75)} ${f(w * 1.25)} ${f(y0 + w * 0.6)} L${f(w * 1.1)} ${f(y0 + w * 0.85)} Q0 ${f(y0 - w * 0.35)} ${f(-w * 1.1)} ${f(y0 + w * 0.85)}Z" fill="${S.trim}" stroke="#111" stroke-width="0.9"/>
      <path d="M${f(-w * 1.25)} ${f(y0 + w * 0.6)} Q0 ${f(y0 - w * 0.75)} ${f(w * 1.25)} ${f(y0 + w * 0.6)}" fill="none" stroke="${S.metalLight}" stroke-width="1.6"/>${dents}
      ${[-0.6, 0, 0.6].map(k => `<rect x="${f(k * w - 1.6)}" y="${f(y0 + w * 0.3)}" width="3.2" height="${f(w * 0.9)}" fill="${S.metal}" stroke="#111" stroke-width="0.4"/>`).join('')}`
  }
  if (kind === 'saw') {
    const R = w * 0.9, cy = y0 - w * 0.1
    let teeth = ''
    for (let i = 0; i < 20; i++) { const a = i / 20 * Math.PI * 2, a2 = a + 0.2; teeth += `L${f(Math.cos(a) * R * 1.12)} ${f(Math.sin(a) * R * 1.12)} L${f(Math.cos(a2) * R)} ${f(Math.sin(a2) * R)} ` }
    return `<rect x="${f(-w * 0.18)}" y="${f(cy)}" width="${f(w * 0.36)}" height="${f(w * 1.4)}" fill="${S.metal}" stroke="#111" stroke-width="0.6"/>
      <g transform="translate(0 ${f(cy)})"><g><path d="M${f(R)} 0 ${teeth}Z" fill="${S.metalLight}" stroke="#111" stroke-width="0.6"/><circle r="${f(R * 0.7)}" fill="${S.metal}"/>${[0, 1, 2].map(i => `<rect x="${f(-R * 0.65)}" y="-0.6" width="${f(R * 1.3)}" height="1.2" fill="#2a2622" transform="rotate(${i * 60})"/>`).join('')}<animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="1.2s" repeatCount="indefinite"/></g><circle r="${f(R * 0.22)}" fill="${S.trim}" stroke="#111" stroke-width="0.6"/></g>`
  }
  if (kind === 'drill') {
    let ribs = ''
    for (let i = 0; i < 6; i++) { const y = y0 - w * 1.2 + i * w * 0.38; ribs += `<path d="M${f(-w * 0.1 - i * w * 0.08)} ${f(y)} L${f(w * 0.1 + i * w * 0.08)} ${f(y + w * 0.22)}" stroke="#2a2622" stroke-width="1.2"><animate attributeName="opacity" values="1;.3;1" dur=".5s" begin="-${(i * 0.08).toFixed(2)}s" repeatCount="indefinite"/></path>` }
    return `<path d="M0 ${f(y0 - w * 1.6)} L${f(w * 0.55)} ${f(y0 + w * 0.9)} L${f(-w * 0.55)} ${f(y0 + w * 0.9)}Z" fill="${S.metalLight}" stroke="#111" stroke-width="0.9"/>${ribs}<rect x="${f(-w * 0.7)}" y="${f(y0 + w * 0.8)}" width="${f(w * 1.4)}" height="${f(w * 0.35)}" rx="2" fill="${S.trim}" stroke="#111" stroke-width="0.6"/>`
  }
  if (kind === 'spikes') {
    let h = `<path d="M${f(-w)} ${f(y0 + w * 0.8)} L${f(-w * 0.6)} ${f(y0)} L${f(w * 0.6)} ${f(y0)} L${f(w)} ${f(y0 + w * 0.8)}Z" fill="${S.metal}" stroke="#111" stroke-width="0.7"/>`
    for (let i = 0; i < 9; i++) { const x = (i - 4) / 4 * w * 0.85, l = w * (0.7 + rnd() * 0.8) * (1 - Math.abs(i - 4) * 0.08), a = (i - 4) * 7 + (rnd() - 0.5) * 10; h += `<path d="M${f(x - 1.6)} ${f(y0 + 2)} L${f(x)} ${f(y0 - l)} L${f(x + 1.6)} ${f(y0 + 2)}Z" fill="${S.metalLight}" stroke="#111" stroke-width="0.4" transform="rotate(${f(a)} ${f(x)} ${f(y0)})"/>` }
    h += `<rect x="${f(-w * 0.9)}" y="${f(y0 + w * 0.15)}" width="${f(w * 1.8)}" height="2.4" fill="${S.trim}" transform="rotate(-8 0 ${f(y0)})"/>`
    return h
  }
  return jaw(S, L, hw)
}
// the great iron claw (grabbers)
function grabber (S, L, hw) {
  const y = L * 0.02
  return [-1, 1].map(sx => `<path d="M${f(sx * hw * 0.25)} ${f(y + 6)} Q${f(sx * hw * 0.95)} ${f(y - 4)} ${f(sx * hw * 0.35)} ${f(y - 22)} L${f(sx * hw * 0.2)} ${f(y - 16)} Q${f(sx * hw * 0.55)} ${f(y - 4)} ${f(sx * hw * 0.1)} ${f(y + 4)}Z" fill="${S.metal}" stroke="#111" stroke-width="0.8"/><path d="M${f(sx * hw * 0.35)} ${f(y - 22)} L${f(sx * hw * 0.28)} ${f(y - 28)} L${f(sx * hw * 0.22)} ${f(y - 17)}Z" fill="${S.metalLight}"/>`).join('') + `<circle cx="0" cy="${f(y + 6)}" r="${f(hw * 0.14)}" fill="${S.trim}" stroke="#111" stroke-width="0.6"/>`
}
// a crude banner on a pole, checked
function banner (S, x, y, s, rnd) {
  return `<circle cx="${f(x)}" cy="${f(y)}" r="${f(s * 0.12)}" fill="#3a2a1a"/><g><path d="M${f(x)} ${f(y)} l${f(s * 0.4)} ${f(s * 0.1)} l${f(-s * 0.05)} ${f(s * 0.9)} l${f(-s * 0.12)} ${f(-s * 0.12)} l${f(-s * 0.1)} ${f(s * 0.16)} l${f(-s * 0.13)} ${f(-s * 0.1)}Z" fill="${S.trim}" stroke="#111" stroke-width="0.4"/>
    <rect x="${f(x + s * 0.05)}" y="${f(y + s * 0.2)}" width="${f(s * 0.12)}" height="${f(s * 0.12)}" fill="${S.trim2}"/><rect x="${f(x + s * 0.17)}" y="${f(y + s * 0.32)}" width="${f(s * 0.12)}" height="${f(s * 0.12)}" fill="${S.trim2}"/><rect x="${f(x + s * 0.05)}" y="${f(y + s * 0.44)}" width="${f(s * 0.12)}" height="${f(s * 0.12)}" fill="${S.trim2}"/>
    <animateTransform attributeName="transform" type="skewX" values="0;5;0;-4;0" dur="${(2 + rnd()).toFixed(1)}s" repeatCount="indefinite"/></g>`
}

export function orcShipSvg (id, { scheme = 'rust', firing = false, bow = 'dome', craft = 'skydiver', teleport = null } = {}) {
  const ship = shipById(id)
  if (!ship) throw new Error(`orcShipSvg: no ship called ${id}`)
  const S = ORC_SCHEMES.find(x => x.id === scheme) ?? ORC_SCHEMES[0], rnd = artRng(id + scheme), uid = `${id}-${scheme}`
  const escort = ship.type === 'escort', big = ship.role === 'battleship', light = ship.hits === 6
  const L = 100 * sizeOf(ship) * 1.3 * 1.25, hw = L * (escort ? 0.16 : 0.135)
  const W = k => ship.weapons.filter(w => w.loc === k)
  const side = W('port'), prow = W('prow'), dorsal = W('dorsal')
  let under = '', deck = '', top = '', fwd = '', port = '', torps = ''

  // the hull: shadow, dark side, a patchwork of riveted plates, a deck of planks and iron, hazard trim
  under += `<path d="${hullPath(L, hw, 2)}" fill="#0a1a26" opacity=".35" transform="translate(3 4)"/><path d="${hullPath(L, hw, 1.4)}" fill="#1e1a16"/>`
  let plates = ''
  for (let y = 2; y < L; y += 9 + rnd() * 6) for (let x = -hw; x < hw; x += 10 + rnd() * 8) {
    const w = 9 + rnd() * 9, h = 8 + rnd() * 7, c = S.plates[Math.floor(rnd() * S.plates.length)]
    plates += `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="${c}" stroke="#1e1a16" stroke-width="0.5"/><circle cx="${f(x + 1.4)}" cy="${f(y + 1.4)}" r="0.45" fill="#c8b890" opacity=".7"/><circle cx="${f(x + w - 1.4)}" cy="${f(y + 1.4)}" r="0.45" fill="#c8b890" opacity=".7"/>`
    if (rnd() < 0.18) plates += `<path d="M${f(x + w * 0.2)} ${f(y + h * 0.3)} q${f(w * 0.3)} ${f(h * 0.4)} ${f(w * 0.5)} ${f(h * 0.2)}" stroke="#a0582a" stroke-width="${f(h * 0.25)}" opacity=".5" fill="none"/>`
  }
  under += `<defs><clipPath id="oh-${uid}"><path d="${hullPath(L, hw, 0)}"/></clipPath><clipPath id="od-${uid}"><path d="${hullPath(L, hw * 0.68, 0, L * 0.12, false)}"/></clipPath></defs><g clip-path="url(#oh-${uid})">${plates}</g>`
  let dk = ''
  for (let x = -hw; x < hw; x += 3) dk += `<rect x="${f(x)}" y="0" width="0.3" height="${f(L)}" fill="${S.deckLine}"/>`
  for (let k = 0; k < Math.round(L / 30); k++) { const px = (rnd() - 0.5) * hw * 1.1, py = L * (0.15 + rnd() * 0.8), pw = 8 + rnd() * 12, ph = 6 + rnd() * 10; dk += `<rect x="${f(px)}" y="${f(py)}" width="${f(pw)}" height="${f(ph)}" fill="${S.plates[Math.floor(rnd() * S.plates.length)]}" stroke="#1e1a16" stroke-width="0.4" opacity=".9"/>` }
  under += `<path d="${hullPath(L, hw * 0.68, 0, L * 0.12, false)}" fill="${S.deck}"/><g clip-path="url(#od-${uid})">${dk}</g>`
  under += `<path d="${hullPath(L, hw * 0.68, 0, L * 0.12, false)}" fill="none" stroke="${S.trim}" stroke-width="1.6" stroke-dasharray="4 4"/><path d="${hullPath(L, hw * 0.68, 0, L * 0.12, false)}" fill="none" stroke="${S.trim2}" stroke-width="1.6" stroke-dasharray="4 4" stroke-dashoffset="4"/>`
  // spikes along both sides
  for (let y = L * 0.2; y < L * 0.9; y += 11 + rnd() * 5) for (const sx of [-1]) {   // (port only: the port side is mirrored to starboard)
 const x = sx * halfAt(L, hw, y, true); port += `<path d="M${f(x)} ${f(y - 2.2)} L${f(x + sx * (5 + rnd() * 4))} ${f(y + 1)} L${f(x)} ${f(y + 2.2)}Z" fill="${S.metalLight}" stroke="#111" stroke-width="0.4"/>` }
  fwd += ship.weapons.some(w => w.kind === 'grabbers') ? grabber(S, L, hw) + bowPiece(bow, S, L, hw * 0.8, rnd) : bowPiece(bow, S, L, hw, rnd)

  // torpedoes under the hull, painted warheads out ahead of the jaw
  for (const w of [...prow, ...side].filter(w => w.kind === 'torpedo').slice(0, 1)) {
    const n = Math.max(2, Math.min(5, Math.ceil(avgStr(w.str) / 2))), T = hw * 0.9, tw = T * 0.18
    for (let k = 0; k < n; k++) { const tx = (k - (n - 1) / 2) * tw * 1.55, ty = -T * 0.42 - Math.abs(tx) * 0.2; torps += `<rect x="${f(tx - tw / 2)}" y="${f(ty)}" width="${f(tw)}" height="${f(T)}" rx="${f(tw / 2)}" fill="#5a5048" stroke="#111" stroke-width="${f(tw * 0.08)}"/><path d="M${f(tx - tw / 2)} ${f(ty + tw * 0.6)} Q${f(tx)} ${f(ty - tw * 0.8)} ${f(tx + tw / 2)} ${f(ty + tw * 0.6)}Z" fill="${S.jaw === '#1a1a1a' ? '#b0321e' : S.jaw}"/><path d="M${f(tx - tw * 0.4)} ${f(ty + tw * 0.9)} l${f(tw * 0.2)} ${f(tw * 0.35)} l${f(tw * 0.2)} ${f(-tw * 0.35)} l${f(tw * 0.2)} ${f(tw * 0.35)} l${f(tw * 0.2)} ${f(-tw * 0.35)}" stroke="${S.teeth}" stroke-width="${f(tw * 0.12)}" fill="none"/>` }
  }
  under = torps + under

  // side weapons: a share of the side each, cannons or mega-cannons with goblin crews, sky diver catapults
  const y0 = L * 0.22, y1 = L * 0.9, sides = side.filter(w => w.kind !== 'torpedo'), seg = (y1 - y0) / Math.max(1, sides.length)
  sides.forEach((w, i) => {
    const a = y0 + i * seg, b = a + seg
    if (w.kind === 'battery' || w.kind === 'heavybangers') {
      const heavy = w.kind === 'heavybangers', n = Math.max(1, Math.min(heavy ? 3 : 5, Math.round(avgStr(w.str) / (heavy ? 2 : 1.6)))), step = (b - a) / n
      for (let k = 0; k < n; k++) {
        const y = a + (k + 0.5) * step, x = -halfAt(L, hw, y, true), r = Math.min(step * (heavy ? 0.4 : 0.32), hw * (heavy ? 0.26 : 0.18))
        port += gun(S, x + r * 1.1, y, r, -90, rnd, heavy, firing) + man(GITS[Math.floor(rnd() * GITS.length)], x + r * 2.6, y + r * 0.3, -90 + (rnd() - 0.5) * 30, 0.95)
      }
    } else if (w.kind === 'bays') {
      const n = Math.min(3, Math.max(1, Math.round(avgStr(w.str)))), step = (b - a) / n
      for (let k = 0; k < n; k++) { const y = a + (k + 0.5) * step, x = -halfAt(L, hw, y, true); port += ramp(S, x - hw * 0.05, y, Math.min(step * 0.85, hw * 0.6), hw * 0.75, craft, -90) }
    } else if (w.kind === 'lance') {
      const n = Math.min(4, avgStr(w.str)), step = (b - a) / n
      for (let k = 0; k < n; k++) { const y = a + (k + 0.5) * step; port += zap(S, -halfAt(L, hw, y, true) + hw * 0.22, y, Math.min(step * 0.3, hw * 0.2), -90, firing) }
    }
  })

  // the spine: smokestacks, the boss's bridge (a big shack with a banner), dorsal weapons, the mobs
  const bridgeY = L * (escort ? 0.6 : 0.5)
  const nStack = escort ? 1 : big ? 4 : light ? 2 : 3
  for (let k = 0; k < nStack; k++) top += stack(S, (k % 2 ? 1 : -1) * hw * 0.22 * (nStack > 1 ? 1 : 0), bridgeY + hw * 0.5 + k * hw * 0.42, hw * (escort ? 0.2 : 0.15), rnd)
  top += shack(S, 0, bridgeY - hw * 0.25, hw * 0.9, hw * 0.55, (rnd() - 0.5) * 6) + man('orc-bigboss-bsb', 0, bridgeY - hw * 0.25, 0, 1.4) + banner(S, hw * 0.4, bridgeY - hw * 0.5, hw * 0.5, rnd)
  for (const d of dorsal) {
    if (d.kind === 'bays') { const n = Math.min(2, Math.max(1, Math.round(avgStr(d.str) / 2))); for (let k = 0; k < n; k++) top += ramp(S, (k - (n - 1) / 2) * hw * 0.75, L * 0.62, hw * 0.5, hw * 0.65, craft, 0) }
    if (d.kind === 'lance') for (let k = 0; k < 2; k++) top += zap(S, (k - 0.5) * hw * 0.6, L * 0.3, hw * 0.18, 0, firing)
    if (d.kind === 'heavybangers') top += gun(S, 0, L * 0.3, hw * 0.24, 0, rnd, true, firing)
    if (d.kind === 'battery') top += gun(S, 0, L * 0.38, hw * 0.2, 0, rnd, false, firing)
  }

  // bow weapons, pointing ahead: cannons in a row, mega-cannons, zap guns, the giant rock thrower
  let by = L * (escort ? 0.24 : 0.2)
  for (const w of prow) {
    if (w.kind === 'battery' || w.kind === 'heavybangers') {
      const heavy = w.kind === 'heavybangers', n = Math.max(1, Math.min(escort ? 2 : heavy ? 2 : 4, Math.round(avgStr(w.str) / (heavy ? 3 : 2.5))))
      for (let k = 0; k < n; k++) fwd += gun(S, (k - (n - 1) / 2) * hw * (heavy ? 0.7 : 0.45), by + hw * 0.3, hw * (heavy ? 0.22 : 0.15), 0, rnd, heavy, firing)
      by += hw * (heavy ? 0.7 : 0.5)
    } else if (w.kind === 'lance') { for (let k = 0; k < 2; k++) fwd += zap(S, (k - 0.5) * hw * 0.6, by + hw * 0.3, hw * 0.2, 0, firing); by += hw * 0.6 }
    else if (w.kind === 'bombardment') {
      const lob = FIGURES['orc-rock-thrower'], lh = hw * 1.3, lw = lob.w / lob.h * lh
      top += `<image href="${lob.href}" x="${f(-lw / 2)}" y="${f(L * 0.3)}" width="${f(lw)}" height="${f(lh)}" style="image-rendering:pixelated"/>` + man('orc-goblin-crew', -lw * 0.6, L * 0.3 + lh * 0.6, 0, 0.8) + man('orc-goblin-crew', lw * 0.6, L * 0.3 + lh * 0.6, 0, 0.8)
    }
  }

  // the boyz: mobs on the open deck, sprogs in the scrap, barrels and shacks
  if (!escort) {
    deck += mob(BOYZ, 0, L * 0.7, Math.max(2, Math.round(hw / FIG * 0.9)), 2, rnd)
    deck += mob(['orc-big-orc', 'orc-orc-boy-shield'], -hw * 0.3, L * 0.42, 2, 2, rnd)
    for (let k = 0; k < 4; k++) deck += barrel(hw * (0.2 + rnd() * 0.4) * (k % 2 ? 1 : -1), L * (0.55 + rnd() * 0.3), FIG * 0.32)
    if (teleport !== false) top += teleportCatapult(S, 0, L * 0.87, hw * 0.75, rnd)
    deck += man('orc-sprogs', -hw * 0.6, L * 0.95, 0, 0.9)
  } else deck += man(BOYZ[0], -hw * 0.3, L * 0.78, 0, 1.15) + man(BOYZ[2], hw * 0.3, L * 0.78, 0, 1.15) + barrel(0, L * 0.88, FIG * 0.3)

  const padX = Math.max(hw * 1.7, FIG * 3), padY = FIG * 3
  const vb = { x: -hw - padX, y: -padY - hw * 0.5, w: (hw + padX) * 2, h: L + padY * 1.8 + hw * 0.5 }
  const body = under + deck + `${port}<g transform="scale(-1 1)">${port}</g>` + top + fwd
  return { L, hw, vb, inner: body, svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f(vb.x)} ${f(vb.y)} ${f(vb.w)} ${f(vb.h)}">${body}</svg>` }
}

// THE ORC FLEET'S ATTACK CRAFT AND TORPEDOES. The rules have one
// craft that is both fighter and bomber (the buzza), so it is the scrap kite, the idea that suits both; any of the other
// ideas (ORC_CRAFT) can stand in for it.
// rukka-buzza -> a scrap kite: patched biplane, orc pilot, bombs under the wings
// rukka-assault-boat -> a rusty landing barge packed with boyz, an engine coughing smoke, a spiked ramp at the front
// rukka-tin-fisher -> a scrap kite hauling a torpedo under it on chains
// rukka-torpedo -> rusty torpedoes with hazard-striped noses running under the water, foam behind
export const ORC_CRAFT_PICS = [
  { id: 'rukka-buzza', name: 'Buzza', text: 'A scrap kite: patched biplane, orc pilot, bombs under the wings (any of the ideas above could be it)' },
  { id: 'rukka-assault-boat', name: 'Assault boat', text: 'A rusty landing barge packed with boyz, a smoking engine, a spiked ramp at the front' },
  { id: 'rukka-tin-fisher', name: 'Tin-fisher', text: 'A sky diver carrying a torpedo under him' },
  { id: 'rukka-torpedo', name: 'Torpedo salvo', text: 'Rusty torpedoes with a beast head on the front of each, running under the water' }
]
// a beast's head on the front of a torpedo
const beastNose = (x, y, s) => { const q = FIGURES['orc-cave-beast'], h = s, w = q.w / q.h * h; return `<image href="${q.href}" x="${f(x - w / 2)}" y="${f(y - h * 0.6)}" width="${f(w)}" height="${f(h)}" style="image-rendering:pixelated"/>` }
const orcTorpedo = (S, x, y, T, tw) => `<rect x="${f(x - tw / 2)}" y="${f(y - T / 2)}" width="${f(tw)}" height="${f(T)}" rx="${f(tw / 2)}" fill="#5a5048" stroke="#111" stroke-width="${f(tw * 0.08)}"/><path d="M${f(x - tw / 2)} ${f(y - T / 2 + tw * 0.6)} Q${f(x)} ${f(y - T / 2 - tw * 0.8)} ${f(x + tw / 2)} ${f(y - T / 2 + tw * 0.6)}Z" fill="${S.trim}"/><rect x="${f(x - tw / 2)}" y="${f(y - T / 2 + tw * 0.7)}" width="${f(tw)}" height="${f(tw * 0.25)}" fill="#1a1a1a"/><rect x="${f(x - tw / 2)}" y="${f(y - T / 2 + tw * 1.15)}" width="${f(tw)}" height="${f(tw * 0.25)}" fill="${S.trim}"/><rect x="${f(x - tw * 0.3)}" y="${f(y + T * 0.2)}" width="${f(tw * 0.6)}" height="${f(T * 0.12)}" fill="#a0582a" opacity=".6"/>`
export function orcCraftSvg (id, { scheme = 'rust', n = 3 } = {}) {
  const S = ORC_SCHEMES.find(x => x.id === scheme) ?? ORC_SCHEMES[0]
  let inner = '', R = 42
  if (id === 'rukka-buzza') inner = `<ellipse cx="6" cy="8" rx="26" ry="18" fill="#000" opacity=".2"/>` + orcCraft('biplane', 0, 0, 62, 0, S)
  //
  else if (id === 'rukka-tin-fisher') inner = `<ellipse cx="6" cy="8" rx="26" ry="14" fill="#000" opacity=".2"/>` + orcTorpedo(S, 0, 2, 58, 7) + beastNose(0, 2 - 29, 9) + orcCraft('skydiver', 0, -2, 64, 0, S)
  else if (id === 'rukka-assault-boat') {
    R = 60
    const L = 70, w = 26, hull = `M${f(-w * 0.4)} ${f(-L / 2)} L${f(w * 0.4)} ${f(-L / 2)} L${f(w / 2)} ${f(-L * 0.3)} L${f(w / 2)} ${f(L * 0.45)} L${f(w * 0.4)} ${f(L / 2)} L${f(-w * 0.4)} ${f(L / 2)} L${f(-w / 2)} ${f(L * 0.45)} L${f(-w / 2)} ${f(-L * 0.3)}Z`
    inner = `<path d="M${f(-w * 0.4)} ${f(L * 0.48)} L${f(-w * 0.9)} ${f(L * 1.1)} L${f(w * 0.9)} ${f(L * 1.1)} L${f(w * 0.4)} ${f(L * 0.48)}Z" fill="#eafaff" opacity=".18"/><path d="${hull}" fill="#000" opacity=".3" transform="translate(2 3)"/><path d="${hull}" fill="#1e1a16"/>`
    let plates = ''
    for (let y = -L / 2; y < L / 2; y += 8) for (let x = -w / 2; x < w / 2; x += 9) plates += `<rect x="${f(x)}" y="${f(y)}" width="9" height="8" fill="${S.plates[Math.abs(Math.round(x * 3 + y)) % S.plates.length]}" stroke="#1e1a16" stroke-width="0.4"/>`
    inner += `<defs><clipPath id="oab-${scheme}"><path d="${hull}" transform="scale(.94)"/></clipPath></defs><g clip-path="url(#oab-${scheme})">${plates}</g><path d="${hull}" fill="${S.deck}" transform="scale(.72)"/>`
    // the ramp at the front with its spikes, the engine at the back
    inner += `<rect x="${f(-w * 0.42)}" y="${f(-L / 2 - 6)}" width="${f(w * 0.84)}" height="9" fill="${S.metal}" stroke="#111" stroke-width="0.6"/>${[-0.3, -0.1, 0.1, 0.3].map(k => `<path d="M${f(k * w - 1.4)} ${f(-L / 2 - 6)} L${f(k * w)} ${f(-L / 2 - 11)} L${f(k * w + 1.4)} ${f(-L / 2 - 6)}Z" fill="${S.metalLight}" stroke="#111" stroke-width="0.3"/>`).join('')}`
    inner += `<rect x="-5" y="${f(L * 0.36)}" width="10" height="9" rx="1.5" fill="${S.metal}" stroke="#111" stroke-width="0.6"/><circle cx="0" cy="${f(L * 0.4)}" r="2.2" fill="#ff7a1a" opacity=".5"/>`
    for (let k = 0; k < 2; k++) inner += `<circle cx="0" cy="${f(L * 0.45)}" r="2" fill="${S.smoke}" opacity="0"><animate attributeName="cy" values="${f(L * 0.45)};${f(L * 0.8)}" dur="1.8s" begin="-${k * 0.9}s" repeatCount="indefinite"/><animate attributeName="r" values="2;6" dur="1.8s" begin="-${k * 0.9}s" repeatCount="indefinite"/><animate attributeName="opacity" values=".6;0" dur="1.8s" begin="-${k * 0.9}s" repeatCount="indefinite"/></circle>`
    for (let r = 0; r < 3; r++) for (let c = -1; c <= 1; c++) inner += man(BOYZ[(r * 3 + c + 3) % BOYZ.length], c * w * 0.22, -L * 0.24 + r * FIG * 0.75, (c * 9), 1.1)
    inner += man('orc-orc-bully', 0, L * 0.22, 0, 1.15)
  } else if (id === 'rukka-torpedo') {
    R = 45
    const T = 30, tw = 4.8
    for (let k = 0; k < n; k++) {
      const x = (k - (n - 1) / 2) * tw * 2.1, y = Math.abs(k - (n - 1) / 2) * 3 + (k % 2) * 2
      inner += `<path d="M${f(x - tw * 0.4)} ${f(y + T * 0.45)} L${f(x - tw * 1.1)} ${f(y + T * 1.6)} L${f(x + tw * 1.1)} ${f(y + T * 1.6)} L${f(x + tw * 0.4)} ${f(y + T * 0.45)}Z" fill="#eafaff" opacity=".22"/>`
      for (let b = 0; b < 3; b++) inner += `<circle cx="${f(x)}" cy="${f(y + T * 0.5)}" r="1" fill="#ffffff" opacity="0"><animate attributeName="cy" values="${f(y + T * 0.5)};${f(y + T * 1.5)}" dur="1.2s" begin="-${(b * 0.4).toFixed(1)}s" repeatCount="indefinite"/><animate attributeName="opacity" values=".8;0" dur="1.2s" begin="-${(b * 0.4).toFixed(1)}s" repeatCount="indefinite"/></circle>`
      inner += orcTorpedo(S, x, y, T, tw) + `<path d="M${f(x - tw * 0.9)} ${f(y - T / 2 - 1)} Q${f(x)} ${f(y - T / 2 - 5)} ${f(x + tw * 0.9)} ${f(y - T / 2 - 1)}" fill="none" stroke="#ffffff" stroke-width="0.8" opacity=".7"/>` + beastNose(x, y - T / 2, tw * 2)
    }
  } else throw new Error(`orcCraftSvg: no craft called ${id}`)
  const vb = { x: -R, y: -R, w: R * 2, h: R * 2 }
  return { vb, inner, svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f(vb.x)} ${f(vb.y)} ${f(vb.w)} ${f(vb.h)}">${inner}</svg>` }
}
