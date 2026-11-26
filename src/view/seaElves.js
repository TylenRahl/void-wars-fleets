// THE ELF FLEET of Tides of the Archipelago. Exports elfShipSvg, elfCraftSvg, ELF_SCHEMES and ELF_CRAFT; used by
// seaPictures.js and seaExtras.js. The Athanatoi rules, drawn as sleek ivory sailing ships with the crystal, ballista
// and mirror weapons: long leaf-shaped hulls (the big ones with outrigger floats), at least three great
// leaf sails each, a gold eagle at the prow, elf shore guard and archers on deck (the figure pictures in seaFigures.js).
// Weapons, from the real profile in src/data/ships.js:
// prow battery -> storm ballistas on the foredeck, pointing ahead keel battery -> storm ballistas along both sides
// prow starlance -> sun mirrors on the foredeck keel starlance / lance -> rune crystals
// launch bays -> griffins on perches torpedoes -> under the hull, warheads out ahead
import { shipById, sizeOf } from '../data/ships.js'
import { FIG, f, artRng, man, lanceGun, glyph } from './seaShips.js'
import { FIGURES } from './seaFigures.js'

export const ELF_SCHEMES = [
  { id: 'jade', name: 'Ivory and jade', text: 'Ivory hulls, jade-green sails, gold', hull: '#ece4d0', hullDark: '#b8ae94', deck: '#d8ccb0', deckLine: '#bfb294', trim: '#d4af55', sail: '#3fae86', sailLight: '#9fe8c8', sailDark: '#1f6a50', vein: '#f2d27a', metal: '#c9b48a', metalLight: '#f4ecd8' },
  { id: 'sapphire', name: 'White and sapphire', text: 'White hulls, deep blue sails, silver', hull: '#f2f2ee', hullDark: '#b4b8bc', deck: '#dcdcd6', deckLine: '#c0c2c0', trim: '#c8d0d8', sail: '#2f5aa8', sailLight: '#8fb4f0', sailDark: '#1a3468', vein: '#e8f0ff', metal: '#a8b0b8', metalLight: '#f0f4f8' },
  { id: 'dusk', name: 'Dusk', text: 'Dark wood hulls, violet sails, silver', hull: '#4a3a34', hullDark: '#2a201c', deck: '#6a564c', deckLine: '#54443c', trim: '#c8c8d8', sail: '#6a3a9a', sailLight: '#b88ae0', sailDark: '#3a1a5a', vein: '#e8d8ff', metal: '#8a8a9a', metalLight: '#d8d8e8' }
]
const ELF_MEN = ['elf-shoreguard', 'elf-shoreguard', 'elf-shoreguard-ranged-shield', 'elf-archer', 'elf-flameguard']

// half width of the leaf hull at y: a long fine bow, widest just aft of the middle, drawn in to a swallowtail stern
function halfAt (L, hw, y) {
  const t = y / L
  return t < 0.5 ? hw * Math.pow(Math.sin(t / 0.5 * Math.PI / 2), 0.9) : t < 0.88 ? hw * (1 - (t - 0.5) * 0.35) : hw * 0.867 * (1 - (t - 0.88) * 4)
}
function hullPath (L, hw, grow = 0, top = 0) {
  const pts = []
  for (let i = 0; i <= 48; i++) { const y = top + (L - top) * i / 48; pts.push([Math.max(0, halfAt(L, hw, y) + grow), y]) }
  const right = pts.map(([x, y]) => `${f(x)} ${f(y)}`), left = pts.slice().reverse().map(([x, y]) => `${f(-x)} ${f(y)}`)
  return `M0 ${f(top - grow)} L${right.join(' L')} L${f(-hw * 0.3)} ${f(L - hw * 0.25)} L${left.join(' L')}Z`
}
// a great leaf sail seen from above: mast, a long curved leaf across the ship angled to the wind, veins of gold, woven strands
function sail (S, x, y, w, ang, k) {
  const h = w * 0.2
  let strands = ''
  for (let i = 1; i < 6; i++) { const t = i / 6 - 0.5; strands += `<path d="M${f(t * w)} ${f(-h * (1 - 4 * t * t) * 0.9)} Q${f(t * w * 1.04)} 0 ${f(t * w)} ${f(h * 0.35 * (1 - 4 * t * t))}" stroke="${S.sailLight}" stroke-width="0.35" fill="none" opacity=".6"/>` }
  return `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(ang)})"><path d="M${f(-w / 2)} ${f(h * 0.4)} Q0 ${f(-h * 1.2)} ${f(w / 2)} ${f(h * 0.4)} Q0 ${f(h * 0.2)} ${f(-w / 2)} ${f(h * 0.4)}Z" fill="#000" opacity=".25" transform="translate(3 5)"/>
    <g><path d="M${f(-w / 2)} ${f(h * 0.4)} Q0 ${f(-h * 1.2)} ${f(w / 2)} ${f(h * 0.4)} Q0 ${f(h * 0.2)} ${f(-w / 2)} ${f(h * 0.4)}Z" fill="${S.sail}" stroke="${S.sailDark}" stroke-width="0.6"/>
    <path d="M${f(-w * 0.42)} ${f(h * 0.3)} Q0 ${f(-h * 0.85)} ${f(w * 0.42)} ${f(h * 0.3)}" fill="none" stroke="${S.sailLight}" stroke-width="${f(h * 0.12)}" opacity=".45"/>${strands}
    <path d="M${f(-w * 0.45)} ${f(h * 0.36)} Q0 ${f(-h * 0.2)} ${f(w * 0.45)} ${f(h * 0.36)}" fill="none" stroke="${S.vein}" stroke-width="0.6"/><path d="M0 ${f(-h * 0.4)} L0 ${f(h * 0.3)}" stroke="${S.vein}" stroke-width="0.5"/>
    <animateTransform attributeName="transform" type="scale" values="1 1;1 1.07;1 1" dur="${(3.6 + k * 0.4).toFixed(1)}s" repeatCount="indefinite"/></g>
    <rect x="${f(-w / 2)}" y="-0.7" width="${f(w)}" height="1.4" fill="${S.hullDark}"/><circle r="${f(Math.max(1.4, w * 0.035))}" fill="${S.trim}" stroke="#5a4a20" stroke-width="0.4"/></g>`
}
// a griffin on its perch (the launch bays; it was a great eagle)
function eagle (x, y, s, rot) {
  const e = FIGURES['human-griffon-rider'], w = s, h = e.h / e.w * w   // griffins for the launch bays
  return `<circle cx="${f(x)}" cy="${f(y)}" r="${f(s * 0.28)}" fill="#8a6a3a" stroke="#d4af55" stroke-width="0.6"/><image href="${e.href}" x="${f(x - w / 2)}" y="${f(y - h / 2)}" width="${f(w)}" height="${f(h)}" transform="rotate(${f(rot)} ${f(x)} ${f(y)})" style="image-rendering:pixelated"/>`
}
// the gold eagle figurehead at the prow
function figurehead (S, y, s) {
  return `<path d="M0 ${f(y - s * 1.2)} C${f(s * 0.35)} ${f(y - s)} ${f(s * 0.3)} ${f(y - s * 0.3)} ${f(s * 0.9)} ${f(y + s * 0.2)} L${f(s * 0.2)} ${f(y + s * 0.1)} L0 ${f(y + s * 0.4)} L${f(-s * 0.2)} ${f(y + s * 0.1)} L${f(-s * 0.9)} ${f(y + s * 0.2)} C${f(-s * 0.3)} ${f(y - s * 0.3)} ${f(-s * 0.35)} ${f(y - s)} 0 ${f(y - s * 1.2)}Z" fill="${S.trim}" stroke="#5a4a20" stroke-width="0.5"/><circle cx="0" cy="${f(y - s * 0.8)}" r="${f(s * 0.08)}" fill="#1a1a1a"/>`
}

export function elfShipSvg (id, { scheme = 'jade' } = {}) {
  const ship = shipById(id)
  if (!ship) throw new Error(`elfShipSvg: no ship called ${id}`)
  const S = ELF_SCHEMES.find(x => x.id === scheme) ?? ELF_SCHEMES[0], rnd = artRng(id + scheme)
  const C = { trim: S.trim, trimDark: '#7a6a3a', metal: S.metal, metalLight: S.metalLight, deck: S.deck, deckLine: S.deckLine, side: S.hullDark, rail: S.metal }
  const escort = ship.type === 'escort', big = ship.role === 'battleship', light = ship.hits <= 4
  const L = 100 * sizeOf(ship) * 1.3 * 1.25, hw = L * (escort ? 0.12 : 0.085)
  const W = k => ship.weapons.filter(w => w.loc === k)
  const prow = W('prow'), keel = W('keel')
  const outriggers = !escort && !light
  let under = '', deck = '', top = '', fwd = '', torps = ''
  const uid = `${id}-${scheme}`

  // outrigger floats on curved struts (the big ships), under the main hull
  if (outriggers) for (const sx of [-1, 1]) {
    const ox = sx * hw * 2.3, oy0 = L * 0.3, oy1 = L * 0.82
    under += `<path d="M${f(ox)} ${f(oy0)} Q${f(ox + sx * hw * 0.35)} ${f((oy0 + oy1) / 2)} ${f(ox)} ${f(oy1)} Q${f(ox - sx * hw * 0.35)} ${f((oy0 + oy1) / 2)} ${f(ox)} ${f(oy0)}Z" fill="${S.hull}" stroke="${S.trim}" stroke-width="0.6"/>`
    for (const y of [L * 0.42, L * 0.7]) under += `<path d="M${f(sx * hw * 0.8)} ${f(y)} Q${f(sx * hw * 1.6)} ${f(y - hw * 0.3)} ${f(ox)} ${f(y)}" stroke="${S.trim}" stroke-width="${f(hw * 0.12)}" fill="none"/><path d="M${f(sx * hw * 0.8)} ${f(y)} Q${f(sx * hw * 1.6)} ${f(y - hw * 0.3)} ${f(ox)} ${f(y)}" stroke="${S.hull}" stroke-width="${f(hw * 0.06)}" fill="none"/>`
  }
  // the hull: shadow, sides, deck of pale wood, gold inlay lines
  under += `<path d="${hullPath(L, hw, 1.6)}" fill="#0a1a26" opacity=".35" transform="translate(3 4)"/><path d="${hullPath(L, hw, 1.2)}" fill="${S.hullDark}"/><path d="${hullPath(L, hw, -0.6, 2)}" fill="${S.deck}"/>`
  let planks = ''
  for (let x = -hw; x < hw; x += 2.4) planks += `<rect x="${f(x)}" y="0" width="0.2" height="${f(L)}" fill="${S.deckLine}"/>`
  under += `<defs><clipPath id="ed-${uid}"><path d="${hullPath(L, hw, -0.6, 2)}"/></clipPath></defs><g clip-path="url(#ed-${uid})">${planks}</g>`
  under += `<path d="${hullPath(L, hw, -0.4, 1.5)}" fill="none" stroke="${S.trim}" stroke-width="0.8"/><path d="${hullPath(L, hw, -3, 8)}" fill="none" stroke="${S.trim}" stroke-width="0.4" stroke-dasharray="6 2 1 2" opacity=".8"/>`
  fwd += figurehead(S, L * 0.04, hw * (escort ? 0.7 : 0.55))

  // torpedoes under the hull, warheads out ahead of the bow (as the Human fleet)
  for (const w of [...prow, ...keel].filter(w => w.kind === 'torpedo')) {
    const n = Math.max(2, Math.min(4, Math.ceil(w.str / 2))), T = hw * (escort ? 1.4 : 1.3), tw = T * 0.15
    const edgeY = x => { let lo = 0, hi = L * 0.5; for (let it = 0; it < 30; it++) { const m = (lo + hi) / 2; if (halfAt(L, hw, m) < x) lo = m; else hi = m } return lo }
    for (let k = 0; k < n; k++) { const tx = (k - (n - 1) / 2) * tw * 1.5, ty = edgeY(Math.abs(tx) + tw * 0.7) - T * 0.5; torps += `<rect x="${f(tx - tw / 2)}" y="${f(ty)}" width="${f(tw)}" height="${f(T)}" rx="${f(tw / 2)}" fill="#e8e0cc" stroke="#6a5a30" stroke-width="${f(tw * 0.08)}"/><path d="M${f(tx - tw / 2)} ${f(ty + tw * 0.6)} Q${f(tx)} ${f(ty - tw * 0.8)} ${f(tx + tw / 2)} ${f(ty + tw * 0.6)}Z" fill="${S.sail}"/><rect x="${f(tx - tw / 2)}" y="${f(ty + tw)}" width="${f(tw)}" height="${f(tw * 0.3)}" fill="${S.trim}"/>` }
  }
  under = torps + under

  // the foredeck weapons, all pointing ahead
  const fy0 = L * (escort ? 0.24 : 0.18)
  let fy = fy0
  for (const w of prow) {
    if (w.kind === 'battery') {
      const n = Math.max(2, Math.min(escort ? 2 : 4, Math.ceil(w.str / 4))), rows = n > 2 ? 2 : 1, per = Math.ceil(n / rows)
      for (let r = 0; r < rows; r++) for (let k = 0; k < per; k++) {
        const y = fy + r * hw * 0.9, x = (k - (per - 1) / 2) * Math.min(hw * 0.9, halfAt(L, hw, y) * 2 / per)
        fwd += lanceGun('ballista', C, x, y + hw * 0.3, hw * (escort ? 0.3 : 0.24), 0, 2.4)
      }
      fy += rows * hw * 0.9 + hw * 0.2
    } else if (w.kind === 'starlance' || w.kind === 'lance') {
      const mirror = w.kind === 'starlance' && !escort
      const n = prow.filter(p => p.kind === w.kind).length > 1 && mirror ? 1 : 1
      for (let k = 0; k < n; k++) fwd += mirror ? lanceGun('mirror', C, 0, fy + hw * 0.6, hw * 0.42, 0, 2.2) : lanceGun('crystal', C, 0, fy + hw * 0.5, hw * (escort ? 0.36 : 0.3), 0, 2.6)
      fy += hw * (mirror ? 1.3 : 1.1)
    }
  }
  // keel weapons: ballistas along both sides, crystals down the middle, eagles on their perches
  const ky0 = L * 0.42, ky1 = L * 0.86
  const kb = keel.filter(w => w.kind === 'battery'), kp = keel.filter(w => w.kind === 'starlance' || w.kind === 'lance'), kbays = keel.filter(w => w.kind === 'bays')
  for (const w of kb) {
    const n = Math.max(2, Math.min(4, Math.ceil(w.str / 4)))
    for (let k = 0; k < n; k++) { const y = ky0 + (k + 0.5) * (ky1 - ky0) * 0.6 / n; const x = halfAt(L, hw, y); for (const sx of [-1, 1]) fwd += lanceGun('ballista', C, sx * (x - hw * 0.25), y, hw * 0.24, sx * 90, 2.2) }
  }
  kp.forEach((w, i) => { fwd += lanceGun('crystal', C, 0, L * 0.36 + i * hw * 1.2, hw * 0.28, 0, 2.4) })
  for (const w of kbays) {
    const n = Math.min(4, w.str), s = Math.min(hw * 1.5, FIG * 3)
    for (let k = 0; k < n; k++) { const sx = k % 2 ? 1 : -1, y = L * 0.62 + Math.floor(k / 2) * s * 0.75; const x = sx * (outriggers ? hw * 2.3 : halfAt(L, hw, y) + s * 0.25); top += eagle(x, y, s, sx * 20 + (rnd() - 0.5) * 20) }
  }

  // the sails: at least three, more on the big ships, all angled to the same wind
  const nSail = big ? 5 : escort ? 3 : light ? 3 : ship.hits >= 8 ? 5 : 4
  const sy0 = Math.max(L * (escort ? 0.38 : 0.3), fy + hw * 0.5), sy1 = L * 0.86
  for (let k = 0; k < nSail; k++) {
    const y = sy0 + (sy1 - sy0) * (nSail === 1 ? 0.5 : k / (nSail - 1)), w = hw * (outriggers ? 4.6 : escort ? 3.2 : 3.8) * (1 - Math.abs(k - (nSail - 1) / 2) * 0.08)
    top += sail(S, 0, y, w, -18, k)
  }
  // the crew: shore guard along the rails, archers, a mage at the bow, the prince at the stern with a standard bearer
  for (let y = L * 0.3; y < L * 0.86; y += FIG * 1.5) for (const sx of [-1, 1]) { const x = halfAt(L, hw, y); if (x > FIG * 0.8) deck += man(ELF_MEN[Math.floor(rnd() * ELF_MEN.length)], sx * (x - FIG * 0.5), y, sx * 90 + (rnd() - 0.5) * 20, 0.82) }
  deck += man('elf-mage', 0, fy + hw * 0.4, 0, 0.9)
  top += man('elf-prince', 0, L * 0.92, 0, 0.9) + man('elf-shoreguard-standard', hw * 0.35, L * 0.9, 0, 0.85)
  // a ring of glowing runes on the stern deck, in the sail's colour
  deck += `<g opacity=".8">${Array.from({ length: 8 }, (_, i) => { const a = i / 8 * Math.PI * 2; return glyph(i * 3 + 1, Math.cos(a) * hw * 0.42, L * 0.9 + Math.sin(a) * hw * 0.42, hw * 0.14, i * 45 + 90, i * 0.3, S.sailLight) }).join('')}</g>`

  const padX = Math.max(hw * (outriggers ? 3.4 : 2.4), FIG * 3), padY = FIG * 3
  const vb = { x: -padX, y: -padY, w: padX * 2, h: L + padY * 1.6 }
  const body = under + deck + fwd + top
  return { L, hw, vb, inner: body, svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f(vb.x)} ${f(vb.y)} ${f(vb.w)} ${f(vb.h)}">${body}</svg>` }
}

// THE ELF FLEET'S ATTACK CRAFT AND TORPEDOES:
// ath-nightjar Nightjar or Duskwing fighter -> a griffin and rider, wings spread
// ath-aetos Aetos or Halcyon bomber -> a griffin carrying a glowing crystal bomb in its claws, with an escort
// ath-lamia Lamia raider (assault boat) -> a sleek white sail skiff full of shore guard
// ath-torpedo-bomber Torpedo bomber -> a griffin carrying a torpedo slung beneath it
// ath-torpedo Torpedo salvo -> ivory torpedoes with coloured noses running under the water, foam behind
export const ELF_CRAFT = [
  { id: 'ath-nightjar', name: 'Nightjar or Duskwing fighter', text: 'A griffin and its rider, wings spread' },
  { id: 'ath-aetos', name: 'Aetos or Halcyon bomber', text: 'A griffin carrying a glowing crystal bomb in its claws' },
  { id: 'ath-lamia', name: 'Lamia raider', text: 'The assault boat: a sleek white sail skiff full of shore guard' },
  { id: 'ath-torpedo-bomber', name: 'Torpedo bomber', text: 'A griffin carrying a torpedo slung beneath it' },
  { id: 'ath-torpedo', name: 'Torpedo salvo', text: 'Ivory torpedoes running just under the water, foam trails behind' }
]
const griffin = (x, y, s, rot = 0) => { const g = FIGURES['human-griffon-rider'], h = s, w = g.w / g.h * h; return `<image href="${g.href}" x="${f(x - w / 2)}" y="${f(y - h / 2)}" width="${f(w)}" height="${f(h)}" transform="rotate(${f(rot)} ${f(x)} ${f(y)})" style="image-rendering:pixelated"/>` }
const elfTorpedo = (S, x, y, T, tw, alpha = 1) => `<rect x="${f(x - tw / 2)}" y="${f(y - T / 2)}" width="${f(tw)}" height="${f(T)}" rx="${f(tw / 2)}" fill="#ece4d0" stroke="#6a5a30" stroke-width="${f(tw * 0.08)}" opacity="${alpha}"/><path d="M${f(x - tw / 2)} ${f(y - T / 2 + tw * 0.6)} Q${f(x)} ${f(y - T / 2 - tw * 0.8)} ${f(x + tw / 2)} ${f(y - T / 2 + tw * 0.6)}Z" fill="${S.sail}"/><rect x="${f(x - tw / 2)}" y="${f(y - T / 2 + tw)}" width="${f(tw)}" height="${f(tw * 0.3)}" fill="${S.trim}"/>`
export function elfCraftSvg (id, { scheme = 'jade', n = 3 } = {}) {
  const S = ELF_SCHEMES.find(x => x.id === scheme) ?? ELF_SCHEMES[0]
  let inner = '', R = 42
  if (id === 'ath-nightjar') inner = `<ellipse cx="6" cy="8" rx="24" ry="20" fill="#000" opacity=".2"/>` + griffin(0, 0, 60)
  else if (id === 'ath-aetos') {
    inner = `<ellipse cx="6" cy="8" rx="24" ry="20" fill="#000" opacity=".2"/>` + griffin(0, -4, 60)
    inner += `<g transform="translate(0 26)"><circle r="9" fill="${S.sailLight}" opacity=".35"><animate attributeName="r" values="7;11;7" dur="1.8s" repeatCount="indefinite"/></circle><path d="M0 -8 L5 -2 L5 4 L0 9 L-5 4 L-5 -2Z" fill="${S.sailLight}" stroke="#ffffff" stroke-width="0.6"/><path d="M0 -8 L1.6 -2 L1.6 4 L0 8Z" fill="#ffffff" opacity=".6"/></g>`
  } else if (id === 'ath-torpedo-bomber') inner = `<ellipse cx="6" cy="8" rx="24" ry="20" fill="#000" opacity=".2"/>` + elfTorpedo(S, 0, -2, 72, 7) + griffin(0, 0, 56)
  else if (id === 'ath-lamia') {
    R = 60
    const L = 76, w = 18, hull = `M0 ${f(-L / 2)} C${f(w * 0.6)} ${f(-L * 0.3)} ${f(w / 2)} 0 ${f(w * 0.45)} ${f(L * 0.3)} L${f(w * 0.2)} ${f(L / 2)} L${f(-w * 0.2)} ${f(L / 2)} L${f(-w * 0.45)} ${f(L * 0.3)} C${f(-w / 2)} 0 ${f(-w * 0.6)} ${f(-L * 0.3)} 0 ${f(-L / 2)}Z`
    inner = `<path d="M${f(-w * 0.2)} ${f(L * 0.48)} L${f(-w * 0.8)} ${f(L * 1.05)} L${f(w * 0.8)} ${f(L * 1.05)} L${f(w * 0.2)} ${f(L * 0.48)}Z" fill="#eafaff" opacity=".18"/><path d="${hull}" fill="#000" opacity=".3" transform="translate(2 3)"/><path d="${hull}" fill="${S.hullDark}"/><path d="${hull}" fill="${S.deck}" transform="scale(.86)"/><path d="${hull}" fill="none" stroke="${S.trim}" stroke-width="0.7" transform="scale(.86)"/>`
    inner += `<path d="M0 ${f(-L * 0.47)} C${f(w * 0.15)} ${f(-L * 0.44)} ${f(w * 0.12)} ${f(-L * 0.4)} 0 ${f(-L * 0.36)} C${f(-w * 0.12)} ${f(-L * 0.4)} ${f(-w * 0.15)} ${f(-L * 0.44)} 0 ${f(-L * 0.47)}Z" fill="${S.trim}"/>`
    for (let r = 0; r < 3; r++) for (const c of [-1, 1]) inner += man(r === 0 ? 'elf-shoreguard-standard' : 'elf-shoreguard', c * w * 0.18, -L * 0.18 + r * FIG * 0.55, 0, 0.6)
    inner += man('elf-prince', 0, L * 0.3, 0, 0.62)
    inner += sail(S, 0, -L * 0.02, w * 3.2, -18, 0) + sail(S, 0, L * 0.18, w * 2.8, -18, 1)
  } else if (id === 'ath-torpedo') {
    R = 45
    const T = 30, tw = 4.4
    for (let k = 0; k < n; k++) {
      const x = (k - (n - 1) / 2) * tw * 2.1, y = Math.abs(k - (n - 1) / 2) * 3
      inner += `<path d="M${f(x - tw * 0.4)} ${f(y + T * 0.45)} L${f(x - tw * 1.1)} ${f(y + T * 1.6)} L${f(x + tw * 1.1)} ${f(y + T * 1.6)} L${f(x + tw * 0.4)} ${f(y + T * 0.45)}Z" fill="#eafaff" opacity=".22"/>`
      for (let b = 0; b < 3; b++) inner += `<circle cx="${f(x)}" cy="${f(y + T * 0.5)}" r="0.9" fill="#ffffff" opacity="0"><animate attributeName="cy" values="${f(y + T * 0.5)};${f(y + T * 1.5)}" dur="1.2s" begin="-${(b * 0.4).toFixed(1)}s" repeatCount="indefinite"/><animate attributeName="opacity" values=".8;0" dur="1.2s" begin="-${(b * 0.4).toFixed(1)}s" repeatCount="indefinite"/></circle>`
      inner += elfTorpedo(S, x, y, T, tw, 0.9) + `<path d="M${f(x - tw * 0.6)} ${f(y - T / 2)} Q${f(x)} ${f(y - T / 2 - 3)} ${f(x + tw * 0.6)} ${f(y - T / 2)}" fill="none" stroke="#ffffff" stroke-width="0.8" opacity=".7"/>`
    }
  } else throw new Error(`elfCraftSvg: no craft called ${id}`)
  const vb = { x: -R, y: -R, w: R * 2, h: R * 2 }
  return { vb, inner, svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f(vb.x)} ${f(vb.y)} ${f(vb.w)} ${f(vb.h)}">${inner}</svg>` }
}
