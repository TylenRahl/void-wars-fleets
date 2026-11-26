// THE DOMINION FLEET of Tides of the Archipelago, whose lances are lasers. Exports dominionShipSvg, dominionCraftSvg,
// DOMINION_SCHEMES, CREWS and DOMINION_CRAFT; used by seaPictures.js and seaExtras.js.
// The Dominion rules, drawn as blackened steel and bronze warships: a blade-sharp bow,
// stepped armoured flanks with bronze spikes and hooks, a spired keep with burning windows, furnace stacks glowing red, two
// tattered dark sails, red runes in the deck seams; Dominion warriors, marauders, a sorcerer and a lord on deck (seaFigures.js).
// Weapons from the real profile in src/data/ships.js; guns still until firing:
// lances -> lasers: the red line laser on the sides, the heavy red line laser on the spine and bow
// batteries -> spiked bronze gun turrets along the sides; on the bow, doomcannons
// launch bays-> dragons on their perches torpedoes -> under the hull, red warheads out ahead
import { shipById, sizeOf } from '../data/ships.js'
import { FIG, f, artRng, man, turret, lanceGun, glyph } from './seaShips.js'
import { FIGURES } from './seaFigures.js'

export const DOMINION_SCHEMES = [
  { id: 'blood', name: 'Black and blood', text: 'Blackened steel, bronze, crimson sails, red runes', side: '#141214', deck: '#2e2a2c', deckLine: '#1e1b1c', plate: '#3a3436', trim: '#b07a3a', trimDark: '#5a3a1a', metal: '#4a3a30', metalLight: '#a87a4a', sail: '#6a1414', sailDark: '#2a0808', glow: '#ff3a1a', rune: '#ffb090', keep: '#242022' },
  { id: 'bone', name: 'Bone and red', text: 'Bone-white plates, dark bronze, red sails and runes', side: '#4a4238', deck: '#cfc4ac', deckLine: '#ada28a', plate: '#bdb298', trim: '#7a4a2a', trimDark: '#3a2010', metal: '#5a4a3a', metalLight: '#a8885a', sail: '#8a1a1a', sailDark: '#3a0a0a', glow: '#ff2a1a', rune: '#ffd0b0', keep: '#8a8070' },
  { id: 'plague', name: 'Verdigris', text: 'Green-stained bronze, rotting wood, sickly green glow', side: '#1e2620', deck: '#4a4a36', deckLine: '#34342a', plate: '#3e4a3a', trim: '#5a8a6a', trimDark: '#2a4a3a', metal: '#3e5a4a', metalLight: '#7ab08a', sail: '#3a4a1e', sailDark: '#1a220c', glow: '#9aff3a', rune: '#e0ffb0', keep: '#2a3226' },
  { id: 'gilded', name: 'Black and gold', text: 'Polished black, gold trim, purple sails, pink-violet glow', side: '#0e0c12', deck: '#26222e', deckLine: '#18151e', plate: '#302a3a', trim: '#d4af55', trimDark: '#7a5a20', metal: '#3a2e4a', metalLight: '#c8a0e0', sail: '#4a1a6a', sailDark: '#1e0a2e', glow: '#ff4ad8', rune: '#ffc8f4', keep: '#1a1620' }
]
// WHO RUNS THE SHIP: a ship with a mark is crewed by that power's daemons with a herald in command;
// a ship with none by Dominion warriors under a lord; the knights stand on the teleport circle. The mark is the rules' own (s.marks: wrath, endurance, rapture, cipher).
export const CREWS = {
  //
  none: { name: 'No mark: Dominion warriors', men: ['dom-warrior', 'dom-warrior-shield', 'dom-warrior-halberd', 'dom-warrior-great'], captain: 'dom-lord', standard: 'dom-warrior-standard', k: 0.85 },
  wrath: { name: 'Wrath Protocol: bloodletters and hounds', men: ['fiend-wrath', 'fiend-wrath', 'fiend-wrath-hound'], captain: 'fiend-wrath-herald', standard: 'fiend-wrath', k: 0.95 },
  endurance: { name: 'Endurance Protocol: plaguebearers and mites', men: ['fiend-endurance', 'fiend-endurance', 'fiend-endurance-mites'], captain: 'fiend-endurance-herald', standard: 'fiend-endurance-mites', k: 0.95 },
  rapture: { name: 'Rapture Protocol: daemonettes and fiends', men: ['fiend-rapture', 'fiend-rapture', 'fiend-rapture-fiend'], captain: 'fiend-rapture-herald', standard: 'fiend-rapture', k: 0.85 },
  cipher: { name: 'Cipher Protocol: horrors and flamers', men: ['fiend-cipher', 'fiend-cipher-blue', 'fiend-cipher-flamer'], captain: 'fiend-cipher-herald', standard: 'fiend-cipher', k: 0.95 }
}

// half width at y: a long blade bow, flanks that step out in armoured tiers, a notched stern
function halfAt (L, hw, y) {
  const t = y / L
  if (t < 0.34) return hw * 0.82 * (t / 0.34)
  if (t < 0.4) return hw * 0.82
  if (t < 0.44) return hw * (0.82 + (t - 0.4) / 0.04 * 0.18)
  if (t < 0.9) return hw
  return hw * (1 - (t - 0.9) * 2.4)
}
function hullPath (L, hw, grow = 0, top = 0) {
  const pts = []
  for (let i = 0; i <= 80; i++) { const y = top + (L - top) * i / 80; pts.push([Math.max(0, halfAt(L, hw, y) + grow), y]) }
  const right = pts.map(([x, y]) => `${f(x)} ${f(y)}`), left = pts.slice().reverse().map(([x, y]) => `${f(-x)} ${f(y)}`)
  // a notched stern: two points with a cut between
  return `M0 ${f(top - grow * 2)} L${right.join(' L')} L${f(hw * 0.25)} ${f(L - hw * 0.3)} L${f(-hw * 0.25)} ${f(L - hw * 0.3)} L${left.join(' L')}Z`
}
// a tattered sail seen from above: a long dark sheet on its yard, ragged trailing edge, a red rune
function tatteredSail (S, y, w, rnd, k) {
  const h = w * 0.22
  // the top edge bows forward on its yard; the trailing edge is torn into tatters, coming back from right to left
  let rag = ''
  for (let i = 10; i >= 0; i--) { const t = i / 10 - 0.5, depth = h * (0.5 + (i % 2 ? 0.35 : 0) + rnd() * 0.15) * (1 - 2.2 * t * t); rag += ` L${f(t * w * 0.92)} ${f(depth)}` }
  const d = `M${f(-w / 2)} 0 Q0 ${f(-h * 0.9)} ${f(w / 2)} 0${rag}Z`
  return `<g transform="translate(0 ${f(y)}) rotate(-10)"><path d="${d}" fill="#000" opacity=".3" transform="translate(3 5)"/><g><path d="${d}" fill="${S.sail}" stroke="${S.sailDark}" stroke-width="0.6" opacity=".93"/>
    <path d="M${f(-w * 0.42)} ${f(-h * 0.05)} Q0 ${f(-h * 0.7)} ${f(w * 0.42)} ${f(-h * 0.05)}" fill="none" stroke="${S.sailDark}" stroke-width="${f(h * 0.08)}" opacity=".6"/>
    <circle cx="0" cy="${f(h * 0.05)}" r="${f(h * 0.3)}" fill="none" stroke="${S.glow}" stroke-width="0.8" opacity=".85"/>${glyph(k * 3 + 2, 0, h * 0.05, h * 0.34, 0, k * 0.4, S.rune)}
    <animateTransform attributeName="transform" type="scale" values="1 1;1 1.06;1 1" dur="${(3.4 + k * 0.5).toFixed(1)}s" repeatCount="indefinite"/></g>
    <rect x="${f(-w / 2)}" y="-0.8" width="${f(w)}" height="1.6" fill="#1a1416"/><circle r="${f(Math.max(1.4, w * 0.03))}" fill="${S.trim}"/></g>`
}
// a furnace stack: dark iron, a bronze ring, the fire showing inside, sparks and smoke
function furnace (S, x, y, r, rnd) {
  const d = (rnd() * 3).toFixed(2)
  let smoke = ''
  for (let i = 0; i < 3; i++) smoke += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="#1a1616" opacity="0"><animate attributeName="cy" values="${f(y)};${f(y + r * 8)}" dur="3.2s" begin="-${(+d + i * 1.05).toFixed(2)}s" repeatCount="indefinite"/><animate attributeName="r" values="${f(r * 0.6)};${f(r * 2.4)}" dur="3.2s" begin="-${(+d + i * 1.05).toFixed(2)}s" repeatCount="indefinite"/><animate attributeName="opacity" values=".7;0" dur="3.2s" begin="-${(+d + i * 1.05).toFixed(2)}s" repeatCount="indefinite"/></circle>`
  return `<circle cx="${f(x + r * 0.3)}" cy="${f(y + r * 0.5)}" r="${f(r * 1.15)}" fill="#000" opacity=".35"/><path d="M${f(x)} ${f(y - r * 1.2)} L${f(x + r)} ${f(y - r * 0.5)} L${f(x + r)} ${f(y + r * 0.5)} L${f(x)} ${f(y + r * 1.2)} L${f(x - r)} ${f(y + r * 0.5)} L${f(x - r)} ${f(y - r * 0.5)}Z" fill="#1e1a1a" stroke="${S.trim}" stroke-width="${f(r * 0.12)}"/>
    <circle cx="${f(x)}" cy="${f(y)}" r="${f(r * 0.55)}" fill="#0a0606"/><circle cx="${f(x)}" cy="${f(y)}" r="${f(r * 0.42)}" fill="${S.glow}" opacity=".7"><animate attributeName="opacity" values=".45;.9;.45" dur="1.3s" repeatCount="indefinite"/></circle>${smoke}`
}
// the keep: a square tower with spires at its corners and burning windows, the lord on top
function keep (S, y, s) {
  let spires = ''
  for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) spires += `<path d="M${f(sx * s * 0.5)} ${f(y + sy * s * 0.5 - s * 0.22)} L${f(sx * s * 0.5 + s * 0.2)} ${f(y + sy * s * 0.5)} L${f(sx * s * 0.5)} ${f(y + sy * s * 0.5 + s * 0.22)} L${f(sx * s * 0.5 - s * 0.2)} ${f(y + sy * s * 0.5)}Z" fill="${S.metal}" stroke="${S.trim}" stroke-width="0.5"/><circle cx="${f(sx * s * 0.5)}" cy="${f(y + sy * s * 0.5)}" r="${f(s * 0.06)}" fill="${S.glow}"/>`
  let win = ''
  for (let i = 0; i < 4; i++) win += `<rect x="${f(-s * 0.32 + i * s * 0.2)}" y="${f(y - s * 0.42)}" width="${f(s * 0.06)}" height="${f(s * 0.1)}" fill="${S.glow}" opacity=".85"/>`
  return `<rect x="${f(-s * 0.55 + 2)}" y="${f(y - s * 0.5 + 3)}" width="${f(s * 1.1)}" height="${f(s)}" fill="#000" opacity=".35"/><rect x="${f(-s / 2)}" y="${f(y - s / 2)}" width="${f(s)}" height="${f(s)}" fill="${S.keep}" stroke="${S.trim}" stroke-width="0.8"/>
    <rect x="${f(-s * 0.36)}" y="${f(y - s * 0.36)}" width="${f(s * 0.72)}" height="${f(s * 0.72)}" fill="none" stroke="${S.trimDark}" stroke-width="0.6"/>${win}${spires}`
}
// THE TELEPORT CIRCLE at the stern, with a few knights on it, shown lit only when the ship can teleport: capital ships that are not crippled make teleport attacks, escorts never do). A bronze ring
// with hooked spikes, a ring of runes turning one way and a burning vortex the other, a column of light, Dominion knights on it.
function teleportCircle (S, x, y, r, glowF, rnd, active = true) {
  let spikes = '', arms = '', runes = ''
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; spikes += `<path d="M${f(Math.cos(a - 0.08) * r)} ${f(Math.sin(a - 0.08) * r)} L${f(Math.cos(a) * r * 1.22)} ${f(Math.sin(a) * r * 1.22)} L${f(Math.cos(a + 0.08) * r)} ${f(Math.sin(a + 0.08) * r)}Z" fill="${S.metalLight}" stroke="#111" stroke-width="0.4"/>` }
  for (let i = 0; i < 5; i++) { const a0 = i / 5 * 360; arms += `<path d="M0 0 Q${f(r * 0.45)} ${f(-r * 0.1)} ${f(r * 0.7)} ${f(r * 0.3)}" fill="none" stroke="${S.glow}" stroke-width="${f(r * 0.07)}" stroke-linecap="round" opacity=".8" transform="rotate(${a0})"/>` }
  for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; runes += glyph(i * 3 + 2, Math.cos(a) * r * 0.86, Math.sin(a) * r * 0.86, r * 0.13, a * 180 / Math.PI + 90, null, S.rune) }
  const spin = (dur, rev) => active ? `<animateTransform attributeName="transform" type="rotate" from="${rev ? 360 : 0}" to="${rev ? 0 : 360}" dur="${dur}s" repeatCount="indefinite"/>` : ''
  let h = `<g transform="translate(${f(x)} ${f(y)})"><circle r="${f(r * 1.25)}" fill="#000" opacity=".3"/>${spikes}<circle r="${f(r)}" fill="#120c0c" stroke="${S.trim}" stroke-width="${f(r * 0.06)}"/>
    <g filter="url(#${glowF})"><circle r="${f(r * 0.95)}" fill="none" stroke="${S.glow}" stroke-width="${f(r * 0.03)}"/><circle r="${f(r * 0.76)}" fill="none" stroke="${S.glow}" stroke-width="${f(r * 0.03)}"/><g>${runes}${spin(30, false)}</g><g>${arms}${spin(5, true)}</g></g>
    <circle r="${f(r * 0.7)}" fill="${S.glow}" opacity="${active ? 0.14 : 0.04}">${active ? '<animate attributeName="opacity" values=".06;.26;.06" dur="2.2s" repeatCount="indefinite"/>' : ''}</circle></g>`
  // a few knights standing on it, facing out, and one in the middle
  h += man('dom-knight-champion', x, y, 0, 0.7)
  for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2 + 0.5; h += man('dom-knight', x + Math.cos(a) * r * 0.58, y + Math.sin(a) * r * 0.58, a * 180 / Math.PI + 90, 0.58) }
  return h
}
// a dragon on its perch (the launch bays)
function dragon (S, x, y, s, rot, k) {
  const d = FIGURES[k % 2 ? 'dom-aetherfire-dragon' : 'dom-dominion-dragon'], h = s, w = d.w / d.h * h
  return `<circle cx="${f(x)}" cy="${f(y)}" r="${f(s * 0.32)}" fill="${S.metal}" stroke="${S.trim}" stroke-width="0.6"/><image href="${d.href}" x="${f(x - w / 2)}" y="${f(y - h / 2)}" width="${f(w)}" height="${f(h)}" transform="rotate(${f(rot)} ${f(x)} ${f(y)})" style="image-rendering:pixelated"/>`
}
// a doomcannon on the bow (a figure picture), pointing ahead
function doomcannon (x, y, s) {
  const c = FIGURES['dom-doomcannon'], h = s, w = c.w / c.h * h
  return `<image href="${c.href}" x="${f(x - w / 2)}" y="${f(y - h * 0.3)}" width="${f(w)}" height="${f(h)}" style="image-rendering:pixelated"/>`
}

export function dominionShipSvg (id, { scheme = 'blood', firing = false, mark = null, teleport = null } = {}) {
  const CREW = CREWS[mark] ?? CREWS.none, MEN = CREW.men
  const ship = shipById(id)
  if (!ship) throw new Error(`dominionShipSvg: no ship called ${id}`)
  const S = DOMINION_SCHEMES.find(x => x.id === scheme) ?? DOMINION_SCHEMES[0], rnd = artRng(id + scheme), uid = `${id}-${scheme}`
  const C = { side: S.side, deck: S.deck, deckLine: S.deckLine, trim: S.trim, trimDark: S.trimDark, metal: S.metal, metalLight: S.metalLight, rail: S.metal }
  const escort = ship.type === 'escort', big = ship.role === 'battleship' || ship.role === 'grand cruiser'
  const L = 100 * sizeOf(ship) * 1.3 * 1.25, hw = L * (escort ? 0.13 : 0.115)
  const W = k => ship.weapons.filter(w => w.loc === k)
  const side = W('port'), prow = W('prow'), dorsal = W('dorsal')
  let under = '', deck = '', top = '', fwd = '', port = '', torps = ''
  const glowF = `cg-${uid}`
  under += `<defs><filter id="${glowF}" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1" result="b"/><feFlood flood-color="${S.glow}"/><feComposite in2="b" operator="in" result="c"/><feMerge><feMergeNode in="c"/><feMergeNode in="c"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`

  // the hull: shadow, black sides, a deck of dark plates in tiers, bronze edging, red runes glowing in the seams
  under += `<path d="${hullPath(L, hw, 1.8)}" fill="#0a1a26" opacity=".35" transform="translate(3 4)"/><path d="${hullPath(L, hw, 1.3)}" fill="${S.side}"/><path d="${hullPath(L, hw, -0.8, 2)}" fill="${S.deck}"/>`
  let plates = ''
  for (let y = L * 0.06; y < L; y += 10) plates += `<rect x="${f(-hw)}" y="${f(y)}" width="${f(hw * 2)}" height="0.5" fill="${S.deckLine}"/>`
  for (const x of [-hw * 0.55, 0, hw * 0.55]) plates += `<rect x="${f(x - 0.25)}" y="0" width="0.5" height="${f(L)}" fill="${S.deckLine}"/>`
  for (let k = 0; k < Math.round(L / 25); k++) plates += `<rect x="${f((rnd() - 0.5) * hw * 1.4)}" y="${f(L * (0.1 + rnd() * 0.85))}" width="${f(6 + rnd() * 10)}" height="${f(5 + rnd() * 6)}" fill="${S.plate}" opacity=".7"/>`
  under += `<defs><clipPath id="cd-${uid}"><path d="${hullPath(L, hw, -0.8, 2)}"/></clipPath></defs><g clip-path="url(#cd-${uid})">${plates}</g>`
  under += `<path d="${hullPath(L, hw, -0.6, 1.5)}" fill="none" stroke="${S.trim}" stroke-width="0.9"/>`
  let seams = ''
  for (const sx of [-1, 1]) seams += `<path d="M${f(sx * 1.2)} ${f(L * 0.05)} L${f(sx * hw * 0.55)} ${f(L * 0.42)} L${f(sx * hw * 0.55)} ${f(L * 0.92)}" fill="none" stroke="${S.glow}" stroke-width="0.6" stroke-dasharray="5 3 1 3" opacity=".75"/>`
  for (let y = L * 0.46, i = 0; y < L * 0.9; y += 7, i++) seams += glyph(i * 5 + 1, -hw * 0.82, y, 3.2, 0, (y / L) * 3, S.rune) + glyph(i * 5 + 3, hw * 0.82, y, 3.2, 0, (y / L) * 3, S.rune)
  deck += `<g filter="url(#${glowF})">${seams}</g>`
  // bronze spikes and hooks along both sides, a blade at the bow
  for (let y = L * 0.3; y < L * 0.9; y += 9 + rnd() * 4) { const x = -halfAt(L, hw, y), l = 5 + rnd() * 5; port += `<path d="M${f(x)} ${f(y - 1.8)} Q${f(x - l * 0.7)} ${f(y - 1)} ${f(x - l)} ${f(y + 2.5)} L${f(x)} ${f(y + 1.8)}Z" fill="${S.metalLight}" stroke="#111" stroke-width="0.4"/>` }
  fwd += `<path d="M0 ${f(-hw * 0.7)} L${f(hw * 0.14)} ${f(L * 0.08)} L${f(-hw * 0.14)} ${f(L * 0.08)}Z" fill="${S.metalLight}" stroke="#111" stroke-width="0.6"/>`

  // torpedoes under the hull, red warheads out ahead of the blade
  for (const w of prow.filter(w => w.kind === 'torpedo')) {
    const n = Math.max(2, Math.min(5, Math.ceil(w.str / 2))), T = hw * 1.1, tw = T * 0.15
    const edgeY = x => { let lo = 0, hi = L * 0.45; for (let it = 0; it < 30; it++) { const m = (lo + hi) / 2; if (halfAt(L, hw, m) < x) lo = m; else hi = m } return lo }
    for (let k = 0; k < n; k++) { const tx = (k - (n - 1) / 2) * tw * 1.55, ty = edgeY(Math.abs(tx) + tw * 0.7) - T * 0.5; torps += `<rect x="${f(tx - tw / 2)}" y="${f(ty)}" width="${f(tw)}" height="${f(T)}" rx="${f(tw / 2)}" fill="${S.metal}" stroke="#111" stroke-width="${f(tw * 0.08)}"/><path d="M${f(tx - tw / 2)} ${f(ty + tw * 0.6)} Q${f(tx)} ${f(ty - tw * 0.8)} ${f(tx + tw / 2)} ${f(ty + tw * 0.6)}Z" fill="${S.glow}"/><rect x="${f(tx - tw / 2)}" y="${f(ty + tw)}" width="${f(tw)}" height="${f(tw * 0.3)}" fill="${S.trim}"/>` }
  }
  under = torps + under

  // side weapons: a share of the side each; spiked turrets, red line lasers, dragons
  const y0 = L * 0.44, y1 = L * 0.9, seg = (y1 - y0) / Math.max(1, side.length)
  side.forEach((w, i) => {
    const a = y0 + i * seg, b = a + seg
    if (w.kind === 'battery') {
      const n = Math.max(2, Math.min(6, Math.ceil(w.str / 2))), step = (b - a) / n
      for (let k = 0; k < n; k++) { const y = a + (k + 0.5) * step, x = -halfAt(L, hw, y), r = Math.min(step * 0.36, hw * 0.22); port += turret(C, x + r * 1.15, y, r, -90, w.str >= 10 ? 3 : 2, 2.1) + `<path d="M${f(x + r * 1.15)} ${f(y - r * 1.05)} l${f(-r * 0.2)} ${f(-r * 0.4)} l${f(r * 0.4)} 0Z" fill="${S.metalLight}"/>` }
    } else if (w.kind === 'lance') {
      const n = Math.min(w.str, 4), step = (b - a) / n
      for (let k = 0; k < n; k++) { const y = a + (k + 0.5) * step, x = -halfAt(L, hw, y), r = Math.min(step * 0.3, hw * 0.2); port += lanceGun('redline', C, x + r * 1.2, y, r, -90, 3.2, firing) + man(MEN[k % MEN.length], x + r * 2.8, y + r * 0.3, -90, CREW.k) }
    } else if (w.kind === 'bays') {
      const n = Math.min(w.str, 3), step = (b - a) / n
      for (let k = 0; k < n; k++) { const y = a + (k + 0.5) * step, x = -halfAt(L, hw, y); port += dragon(S, x - hw * 0.15, y, Math.min(step * 1.1, hw * 0.9), -90 + (rnd() - 0.5) * 20, k) }
    }
  })

  // the spine: lasers or turrets forward of the keep, the keep, furnace stacks, the sails
  const keepY = L * (escort ? 0.6 : 0.5)
  for (const d of dorsal) {
    const n = Math.min(4, d.str), dy0 = L * 0.24, dy1 = keepY - hw * 0.6, step = (dy1 - dy0) / n
    for (let k = 0; k < n; k++) { const y = dy0 + (k + 0.5) * step, r = Math.min(step * 0.34, hw * 0.3); top += d.kind === 'lance' ? lanceGun('redline-wide', C, 0, y, r, 0, 3, firing) : turret(C, 0, y, r, 0, 3, 2.3) }
  }
  top += keep(S, keepY, hw * (escort ? 0.8 : 0.7)) + man(CREW.captain, 0, keepY, 0, 1.05)
  const nF = escort ? 1 : 2
  for (let k = 0; k < nF; k++) top += furnace(S, (k - (nF - 1) / 2) * hw * 0.55, keepY + hw * 0.75, hw * 0.16, rnd)
  const nSail = escort ? 1 : 2
  for (let k = 0; k < nSail; k++) top += tatteredSail(S, keepY + hw * (1.15 + k * 0.95), hw * (escort ? 2.3 : 2.6), rnd, k)

  // bow weapons: doomcannons, heavy lasers, all pointing ahead
  let by = L * (escort ? 0.24 : 0.18)
  for (const w of prow) {
    if (w.kind === 'battery') { const n = escort ? 1 : w.str >= 6 ? 2 : 1; for (let k = 0; k < n; k++) fwd += doomcannon((k - (n - 1) / 2) * hw * 0.85, by, hw * (escort ? 0.9 : 0.75)); by += hw * 0.9 }
    else if (w.kind === 'lance') { const n = escort ? 1 : Math.min(2, Math.ceil(w.str / 2)); for (let k = 0; k < n; k++) fwd += lanceGun('redline-wide', C, (k - (n - 1) / 2) * hw * 0.6, by + hw * 0.4, hw * (escort ? 0.32 : 0.26), 0, 3.2, firing); by += hw * 0.9 }
    else if (w.kind === 'bays') { fwd += dragon(S, -hw * 0.35, by + hw * 0.3, hw * 0.8, 0, 0) + dragon(S, hw * 0.35, by + hw * 0.3, hw * 0.8, 0, 1); by += hw * 0.9 }
  }
  // the crew: warriors in ranks, marauders at the rails, a sorcerer at the bow, chosen round the keep, a spawn at the stern
  if (!escort) {
    for (let y = L * 0.48; y < L * 0.88; y += FIG * 1.6) { const x = halfAt(L, hw, y); deck += man(MEN[Math.floor(rnd() * MEN.length)], -(x - FIG * 0.7), y, -90 + (rnd() - 0.5) * 20, CREW.k) + man(MEN[Math.floor(rnd() * MEN.length)], x - FIG * 0.7, y, 90 + (rnd() - 0.5) * 20, CREW.k) }
    deck += man(MEN[0], -hw * 0.45, keepY - hw * 0.1, 0, CREW.k) + man(MEN[0], hw * 0.45, keepY - hw * 0.1, 0, CREW.k)
    // the teleport circle at the back: only on ships that can teleport (capital ships; in the battle, teleport: false when
    // crippled leaves it dark and still)
    top += teleportCircle(S, 0, L * 0.88, hw * 0.58, glowF, rnd, teleport !== false)
  } else deck += man(MEN[0], -hw * 0.3, L * 0.78, 0, CREW.k) + man(MEN[1], hw * 0.3, L * 0.78, 0, CREW.k)
  deck += man(mark ? CREW.captain : 'dom-sorcerer', 0, by + hw * 0.2, 0, 0.9)

  const padX = Math.max(hw * 1.8, FIG * 3), padY = FIG * 3
  const vb = { x: -hw - padX, y: -padY - hw * 0.4, w: (hw + padX) * 2, h: L + padY * 1.8 + hw * 0.4 }
  const body = under + deck + `${port}<g transform="scale(-1 1)">${port}</g>` + top + fwd
  return { L, hw, vb, inner: body, svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f(vb.x)} ${f(vb.y)} ${f(vb.w)} ${f(vb.h)}">${body}</svg>` }
}

// THE DOMINION FLEET'S ATTACK CRAFT AND TORPEDOES:
// chs-carrion Carrion fighter -> a lean aetherfire dragon, wings swept
// chs-pyrewing Pyrewing bomber -> a great dragon carrying burning firebombs in its claws
// chs-gravehook Gravehook assault craft -> a bronze boarding boat with grappling claws at its bow, warriors aboard
// chs-torpedo Torpedo salvo -> dark bronze torpedoes with glowing noses under the water
// chs-boarding-torpedo Boarding torpedo -> one great torpedo with hooked claws round its nose and a hatch, warriors inside
export const DOMINION_CRAFT = [
  { id: 'dom-carrion', name: 'Carrion fighter', text: 'A lean dragon, wings swept, fast' },
  { id: 'dom-pyrewing', name: 'Pyrewing bomber', text: 'A great dragon carrying burning firebombs in its claws' },
  { id: 'dom-gravehook', name: 'Gravehook assault craft', text: 'A bronze boarding boat, a fan of spikes at the bow, warriors aboard' },
  { id: 'dom-torpedo', name: 'Torpedo salvo', text: 'Dark bronze torpedoes with glowing noses running under the water' },
  { id: 'dom-boarding-torpedo', name: 'Boarding torpedo', text: 'A long armoured torpedo, a crown of drill spikes on the nose, red slits glowing where the boarders wait, a churning screw' }
]
const dragonImg = (name, x, y, s) => { const d = FIGURES[name], h = s, w = d.w / d.h * h; return `<image href="${d.href}" x="${f(x - w / 2)}" y="${f(y - h / 2)}" width="${f(w)}" height="${f(h)}" style="image-rendering:pixelated"/>` }
const dominionTorpedo = (S, x, y, T, tw) => `<rect x="${f(x - tw / 2)}" y="${f(y - T / 2)}" width="${f(tw)}" height="${f(T)}" rx="${f(tw / 2)}" fill="${S.metal}" stroke="#111" stroke-width="${f(tw * 0.08)}"/><path d="M${f(x - tw / 2)} ${f(y - T / 2 + tw * 0.6)} Q${f(x)} ${f(y - T / 2 - tw * 0.8)} ${f(x + tw / 2)} ${f(y - T / 2 + tw * 0.6)}Z" fill="${S.glow}"/><rect x="${f(x - tw / 2)}" y="${f(y - T / 2 + tw)}" width="${f(tw)}" height="${f(tw * 0.3)}" fill="${S.trim}"/>`
const wakeOf = (x, y, T, tw) => `<path d="M${f(x - tw * 0.4)} ${f(y + T * 0.45)} L${f(x - tw * 1.1)} ${f(y + T * 1.6)} L${f(x + tw * 1.1)} ${f(y + T * 1.6)} L${f(x + tw * 0.4)} ${f(y + T * 0.45)}Z" fill="#eafaff" opacity=".22"/>` + [0, 1, 2].map(b => `<circle cx="${f(x)}" cy="${f(y + T * 0.5)}" r="1" fill="#ffffff" opacity="0"><animate attributeName="cy" values="${f(y + T * 0.5)};${f(y + T * 1.5)}" dur="1.2s" begin="-${(b * 0.4).toFixed(1)}s" repeatCount="indefinite"/><animate attributeName="opacity" values=".8;0" dur="1.2s" begin="-${(b * 0.4).toFixed(1)}s" repeatCount="indefinite"/></circle>`).join('')
export function dominionCraftSvg (id, { scheme = 'blood', n = 3 } = {}) {
  const S = DOMINION_SCHEMES.find(x => x.id === scheme) ?? DOMINION_SCHEMES[0]
  let inner = '', R = 42
  if (id === 'dom-carrion') inner = `<ellipse cx="6" cy="8" rx="22" ry="22" fill="#000" opacity=".2"/>` + dragonImg('dom-aetherfire-dragon', 0, 0, 58)
  else if (id === 'dom-pyrewing') {
    inner = `<ellipse cx="6" cy="8" rx="26" ry="24" fill="#000" opacity=".2"/>` + dragonImg('dom-dominion-dragon', 0, -2, 66)
    for (const sx of [-1, 1]) inner += `<g transform="translate(${sx * 9} 14)"><circle r="4.5" fill="#2a1a10" stroke="#111" stroke-width="0.5"/><circle r="3" fill="${S.glow}" opacity=".85"><animate attributeName="opacity" values=".5;1;.5" dur=".8s" repeatCount="indefinite"/></circle><path d="M-2 -4 Q0 -9 2 -4Z" fill="#ffb040"><animate attributeName="d" values="M-2 -4 Q0 -9 2 -4Z;M-2 -4 Q1 -11 2 -4Z;M-2 -4 Q0 -9 2 -4Z" dur=".5s" repeatCount="indefinite"/></path></g>`
  } else if (id === 'dom-gravehook') {
    R = 60
    const L = 64, w = 22, hull = `M0 ${f(-L / 2)} L${f(w * 0.45)} ${f(-L * 0.25)} L${f(w / 2)} ${f(L * 0.4)} L${f(w * 0.3)} ${f(L / 2)} L${f(-w * 0.3)} ${f(L / 2)} L${f(-w / 2)} ${f(L * 0.4)} L${f(-w * 0.45)} ${f(-L * 0.25)}Z`
    inner = `<path d="M${f(-w * 0.3)} ${f(L * 0.48)} L${f(-w * 0.9)} ${f(L * 1.1)} L${f(w * 0.9)} ${f(L * 1.1)} L${f(w * 0.3)} ${f(L * 0.48)}Z" fill="#eafaff" opacity=".18"/><path d="${hull}" fill="#000" opacity=".3" transform="translate(2 3)"/><path d="${hull}" fill="${S.side}" stroke="${S.trim}" stroke-width="0.7"/><path d="${hull}" fill="${S.deck}" transform="scale(.8)"/>`
    // the grappling claws at the bow, hooks down the sides, a glowing furnace aft
    //
    for (let i = -3; i <= 3; i++) { const a = i * 14, l = L * (0.26 - Math.abs(i) * 0.025); inner += `<path d="M-1.6 ${f(-L * 0.42)} L0 ${f(-L * 0.42 - l)} L1.6 ${f(-L * 0.42)}Z" fill="${S.metalLight}" stroke="#111" stroke-width="0.4" transform="rotate(${a} 0 ${f(-L * 0.38)})"/>` }
    for (let y = -L * 0.15; y < L * 0.4; y += 9) inner += `<path d="M${f(-w / 2)} ${f(y)} q${f(-4)} 1 ${f(-5)} 4 L${f(-w / 2)} ${f(y + 2)}Z" fill="${S.metalLight}"/><path d="M${f(w / 2)} ${f(y)} q4 1 5 4 L${f(w / 2)} ${f(y + 2)}Z" fill="${S.metalLight}"/>`
    inner += `<circle cx="0" cy="${f(L * 0.38)}" r="3.4" fill="#1e1a1a" stroke="${S.trim}" stroke-width="0.6"/><circle cx="0" cy="${f(L * 0.38)}" r="2" fill="${S.glow}" opacity=".8"/>`
    for (let r = 0; r < 3; r++) for (const c of [-1, 1]) inner += man(r === 0 ? 'dom-warrior-great' : 'dom-warrior-shield', c * w * 0.2, -L * 0.18 + r * FIG * 0.6, 0, 0.75)
    inner += man('dom-chosen', 0, L * 0.22, 0, 0.8)
  } else if (id === 'dom-boarding-torpedo') {
    //: a long armoured torpedo in segments, a crown of drill spikes on
    // the nose to bite into a hull, red slits glowing where the boarders wait inside, fins and a churning screw at the tail
    R = 52
    const T = 78, tw = 12, top = -T / 2
    inner = wakeOf(0, 0, T, tw)
    inner += `<rect x="${f(-tw / 2 + 1)}" y="${f(top + 2)}" width="${f(tw)}" height="${f(T)}" rx="${f(tw / 2)}" fill="#000" opacity=".3"/>`
    for (const sx of [-1, 1]) inner += `<path d="M${f(sx * tw * 0.45)} ${f(T * 0.3)} L${f(sx * tw * 1.05)} ${f(T * 0.44)} L${f(sx * tw * 1.0)} ${f(T * 0.52)} L${f(sx * tw * 0.45)} ${f(T * 0.46)}Z" fill="${S.metal}" stroke="#111" stroke-width="0.5"/>`
    inner += `<rect x="${f(-tw / 2)}" y="${f(top + tw * 0.4)}" width="${f(tw)}" height="${f(T - tw * 0.4)}" rx="${f(tw * 0.4)}" fill="${S.metal}" stroke="#111" stroke-width="0.7"/>`
    for (let k = 0; k < 5; k++) { const y = top + tw * 1.4 + k * T * 0.15; inner += `<rect x="${f(-tw / 2)}" y="${f(y)}" width="${f(tw)}" height="1.2" fill="${S.trim}"/><rect x="${f(-tw * 0.12)}" y="${f(y + 3)}" width="${f(tw * 0.24)}" height="${f(T * 0.06)}" rx="0.6" fill="${S.glow}" opacity=".85"><animate attributeName="opacity" values=".5;1;.5" dur="1.6s" begin="-${(k * 0.3).toFixed(1)}s" repeatCount="indefinite"/></rect>` }
    inner += `<path d="M${f(-tw / 2)} ${f(top + tw * 0.9)} Q0 ${f(top - tw * 0.3)} ${f(tw / 2)} ${f(top + tw * 0.9)}Z" fill="${S.metalLight}" stroke="#111" stroke-width="0.6"/>`
    for (let i = -3; i <= 3; i++) { const a = i * 20, l = tw * (0.85 - Math.abs(i) * 0.08); inner += `<path d="M-1.3 ${f(top + tw * 0.35)} L0 ${f(top + tw * 0.35 - l)} L1.3 ${f(top + tw * 0.35)}Z" fill="${S.metalLight}" stroke="#111" stroke-width="0.35" transform="rotate(${a} 0 ${f(top + tw * 0.6)})"/>` }
    inner += `<g transform="translate(0 ${f(T / 2 + 2)})"><g>${[0, 1, 2].map(b => `<path d="M0 0 C2 -1 4 1 4.5 3 C2 3 1 2 0 0Z" fill="${S.trim}" transform="rotate(${b * 120})"/>`).join('')}<animateTransform attributeName="transform" type="rotate" from="0" to="360" dur=".6s" repeatCount="indefinite"/></g><circle r="1.2" fill="${S.metal}"/></g>`
  } else if (id === 'dom-torpedo') {
    R = 45
    const T = 30, tw = 4.6
    for (let k = 0; k < n; k++) { const x = (k - (n - 1) / 2) * tw * 2.1, y = Math.abs(k - (n - 1) / 2) * 3; inner += wakeOf(x, y, T, tw) + dominionTorpedo(S, x, y, T, tw) + `<path d="M${f(x - tw * 0.6)} ${f(y - T / 2)} Q${f(x)} ${f(y - T / 2 - 3)} ${f(x + tw * 0.6)} ${f(y - T / 2)}" fill="none" stroke="#ffffff" stroke-width="0.8" opacity=".7"/>` }
  } else throw new Error(`dominionCraftSvg: no craft called ${id}`)
  const vb = { x: -R, y: -R, w: R * 2, h: R * 2 }
  return { vb, inner, svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f(vb.x)} ${f(vb.y)} ${f(vb.w)} ${f(vb.h)}">${inner}</svg>` }
}
