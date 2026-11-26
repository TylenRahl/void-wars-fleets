// THE OTHER SEA PIECES: transports, the Orc lump, hulks and fort quarters (a fort has a quay a ship can dock at).
// Exports extraArt(id, opts) and EXTRA_IDS; used by seaPictures.js.
// transport / transport-dominion / transport-athanatoi merchant ships: a cargo steamer, a black cargo hulk, an elf sail barge
// rukka-lump the Orc lump: a rock island fortified with scrap, guns and a torpedo launcher, a jetty for the boats
// rukka-hulk / spacehulk a hulk: a floating island of wrecked ships fused together, guns all over it, a harbour inlet
// fort quadrants the star fort in the battle is four quarters: each a bastion of the sea star fort, with its own quay
// Each returns { vb, inner, L } in drawing units (the bow or the outward point up), as the ship drawings do.
import { FIG, f, artRng, man, turret, gyro, launchPad, lanceGun, runeCircle, crate, LOOK, HUMAN_SCHEMES, setRunes, runeColours } from './seaShips.js'
import { ELF_SCHEMES } from './seaElves.js'
import { DOMINION_SCHEMES } from './seaDominion.js'
import { ORC_SCHEMES } from './seaOrcs.js'
import { FIGURES } from './seaFigures.js'

const out = (inner, w, h, L) => ({ vb: { x: -w / 2, y: -h * 0.1, w, h }, inner, L })
const hullD = (L, w) => `M0 0 C${f(w * 0.55)} ${f(L * 0.08)} ${f(w / 2)} ${f(L * 0.25)} ${f(w / 2)} ${f(L * 0.45)} L${f(w / 2)} ${f(L * 0.9)} Q${f(w / 2)} ${f(L)} ${f(w * 0.3)} ${f(L)} L${f(-w * 0.3)} ${f(L)} Q${f(-w / 2)} ${f(L)} ${f(-w / 2)} ${f(L * 0.9)} L${f(-w / 2)} ${f(L * 0.45)} C${f(-w / 2)} ${f(L * 0.25)} ${f(-w * 0.55)} ${f(L * 0.08)} 0 0Z`
const cargo = (x, y, w, h, col) => `<rect x="${f(x - w / 2)}" y="${f(y - h / 2)}" width="${f(w)}" height="${f(h)}" fill="${col}" stroke="#1a1a1a" stroke-width="0.5"/>${[0.25, 0.5, 0.75].map(k => `<rect x="${f(x - w / 2 + w * k - 0.2)}" y="${f(y - h / 2)}" width="0.4" height="${f(h)}" fill="#000" opacity=".3"/>`).join('')}`

// ---------------- transports ----------------
function transport (id, scheme) {
  const L = 160, w = 46, rnd = artRng(id + scheme)
  let h = `<path d="${hullD(L, w)}" fill="#0a1a26" opacity=".35" transform="translate(3 4)"/>`
  if (id === 'transport-athanatoi') {
    const S = ELF_SCHEMES.find(x => x.id === scheme) ?? ELF_SCHEMES[0]
    h += `<path d="${hullD(L, w * 0.85)}" fill="${S.hullDark}"/><path d="${hullD(L, w * 0.85)}" fill="${S.deck}" transform="translate(0 3) scale(.88)"/>`
    for (let k = 0; k < 6; k++) h += cargo((k % 2 ? 1 : -1) * w * 0.17, L * 0.3 + Math.floor(k / 2) * 22, 14, 16, ['#5a8a6a', '#c8b48a', '#3a6a8a'][k % 3])
    for (const y of [L * 0.32, L * 0.62]) h += `<g transform="translate(0 ${y}) rotate(-18)"><path d="M${-w * 1.1} 4 Q0 ${-w * 0.45} ${w * 1.1} 4 Q0 2 ${-w * 1.1} 4Z" fill="${S.sail}" stroke="${S.sailDark}" stroke-width="0.6"/><rect x="${-w * 1.1}" y="-0.7" width="${w * 2.2}" height="1.4" fill="${S.hullDark}"/></g>`
    h += man('elf-shoreguard', 0, L * 0.85, 0, 0.9) + man('elf-crew', -w * 0.2, L * 0.15, 0, 0.85)
  } else if (id === 'transport-dominion') {
    const S = DOMINION_SCHEMES.find(x => x.id === scheme) ?? DOMINION_SCHEMES[0]
    h += `<path d="${hullD(L, w)}" fill="${S.side}" stroke="${S.trim}" stroke-width="0.8"/><path d="${hullD(L, w)}" fill="${S.deck}" transform="translate(0 4) scale(.86)"/>`
    for (let k = 0; k < 6; k++) h += cargo((k % 2 ? 1 : -1) * w * 0.2, L * 0.25 + Math.floor(k / 2) * 24, 16, 18, ['#4a3a30', '#3a3436', '#5a2a1a'][k % 3])
    for (let y = L * 0.2; y < L * 0.9; y += 12) h += `<path d="M${-w / 2} ${y} l-5 2 l5 2Z" fill="${S.metalLight}"/><path d="M${w / 2} ${y} l5 2 l-5 2Z" fill="${S.metalLight}"/>`
    h += `<rect x="-9" y="${L * 0.84}" width="18" height="12" fill="${S.keep}" stroke="${S.trim}" stroke-width="0.6"/><circle cx="0" cy="${L * 0.78}" r="5" fill="#1e1a1a" stroke="${S.trim}"/><circle cx="0" cy="${L * 0.78}" r="3" fill="${S.glow}" opacity=".7"/>` + man('dom-marauder', 0, L * 0.9, 0, 0.9)
  } else {
    const SCH = HUMAN_SCHEMES.find(x => x.id === scheme) ?? HUMAN_SCHEMES[0], C = { ...LOOK.runic, ...SCH.look }
    h += `<path d="${hullD(L, w)}" fill="${C.side}"/><path d="${hullD(L, w)}" fill="${C.deck}" transform="translate(0 3) scale(.9)"/>`
    for (let k = 0; k < 6; k++) h += cargo((k % 2 ? 1 : -1) * w * 0.2, L * 0.22 + Math.floor(k / 2) * 24, 16, 18, ['#8a5a32', '#3a5a6a', '#6a6a3a'][k % 3])
    h += `<rect x="-2" y="${L * 0.2}" width="4" height="${L * 0.5}" fill="#c9a24a"/><rect x="-14" y="${L * 0.44}" width="28" height="3" fill="#c9a24a"/>`
    h += `<rect x="-11" y="${L * 0.84}" width="22" height="11" rx="1.5" fill="${C.super}" stroke="${C.superDark}" stroke-width="0.6"/><circle cx="0" cy="${L * 0.78}" r="4.5" fill="${C.funnel}" stroke="${C.trim}" stroke-width="0.8"/>` + man('human-captain-bsb', 0, L * 0.89, 0, 0.85) + man('human-engineer', -w * 0.25, L * 0.12, 0, 0.85)
  }
  return out(h, L * 1.0, L * 1.2, L)
}

// ---------------- the Orc lump ----------------
function lump (scheme) {
  const S = ORC_SCHEMES.find(x => x.id === scheme) ?? ORC_SCHEMES[0], rnd = artRng('lump' + scheme), R = 90
  const pts = Array.from({ length: 18 }, (_, i) => { const a = i / 18 * Math.PI * 2, d = R * (0.8 + rnd() * 0.25); return `${f(Math.cos(a) * d)},${f(Math.sin(a) * d * 0.9 + R)}` })
  let h = `<circle cx="0" cy="${R}" r="${R * 1.25}" fill="#49c1c9" opacity=".3"/><circle cx="0" cy="${R}" r="${R * 1.05}" fill="none" stroke="#e8fbff" stroke-width="1.2" stroke-dasharray="4 3" opacity=".6"><animate attributeName="stroke-dashoffset" values="0;14" dur="5s" repeatCount="indefinite"/></circle>`
  h += `<polygon points="${pts.join(' ')}" fill="#6a645a" stroke="#3a3530" stroke-width="1.5"/><polygon points="${pts.join(' ')}" fill="#8a8274" opacity=".5" transform="translate(-6 -8) scale(.9) translate(0 ${R * 0.1})"/>`
  for (let k = 0; k < 14; k++) { const x = (rnd() - 0.5) * R * 1.1, y = R + (rnd() - 0.5) * R; h += `<rect x="${f(x)}" y="${f(y)}" width="${f(8 + rnd() * 10)}" height="${f(6 + rnd() * 8)}" fill="${S.plates[k % S.plates.length]}" stroke="#1e1a16" stroke-width="0.5" transform="rotate(${f((rnd() - 0.5) * 30)} ${f(x)} ${f(y)})"/>` }
  // the guns of the lump (heavy guns, a battery, a torpedo launcher), the boss's shack, boyz, and a jetty for the boats
  for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2 + 0.4; h += turret({ metal: S.metal, metalLight: S.metalLight, trim: S.trim }, Math.cos(a) * R * 0.6, R + Math.sin(a) * R * 0.55, 10, a * 180 / Math.PI + 90, 2, 2.4) }
  h += `<rect x="-10" y="${R - 30}" width="20" height="26" fill="#2a2622" stroke="${S.trim}" stroke-width="0.8"/>${[0, 1, 2].map(i => `<circle cx="${-6 + i * 6}" cy="${R - 28}" r="2.4" fill="#1a1a1a"/>`).join('')}`
  h += `<rect x="-16" y="${R - 4}" width="32" height="20" fill="#8a8478" stroke="#3a3630" stroke-width="0.6"/>` + man('orc-bigboss-bsb', 0, R + 6, 0, 1.3)
  for (let k = 0; k < 8; k++) { const a = rnd() * Math.PI * 2, d = R * (0.3 + rnd() * 0.3); h += man(['orc-orc-boy', 'orc-orc-boy-shield', 'orc-goblin'][k % 3], Math.cos(a) * d, R + Math.sin(a) * d, rnd() * 360, 1.1) }
  let piles = ''
  for (let i = 0; i <= 4; i++) piles += `<circle cx="-4" cy="${f(R * 1.85 + i * 9)}" r="1.2" fill="#3a2a1a"/><circle cx="4" cy="${f(R * 1.85 + i * 9)}" r="1.2" fill="#3a2a1a"/>`
  h += `${piles}<rect x="-4" y="${R * 1.8}" width="8" height="40" fill="#6a4a2a" stroke="#2a1a0a" stroke-width="0.6"/>`
  return out(h, R * 2.8, R * 3.4, R * 2)
}

// ---------------- the hulks: wrecked ships fused into a floating island ----------------
function hulk (id, scheme) {
  const orc = id === 'rukka-hulk', rnd = artRng(id + scheme), L = 360
  const S = orc ? (ORC_SCHEMES.find(x => x.id === scheme) ?? ORC_SCHEMES[0]) : (DOMINION_SCHEMES.find(x => x.id === scheme) ?? DOMINION_SCHEMES[0])
  const plates = orc ? S.plates : [S.side, S.plate, S.keep, '#3a3436', '#2a2626']
  let h = `<ellipse cx="0" cy="${L * 0.5}" rx="${L * 0.42}" ry="${L * 0.52}" fill="#0a1a26" opacity=".35"/>`
  // eight wrecks of different shapes, jammed together at odd angles
  for (let k = 0; k < 9; k++) {
    const a = rnd() * 360, x = (rnd() - 0.5) * L * 0.5, y = L * (0.15 + rnd() * 0.7), len = L * (0.3 + rnd() * 0.25), w = len * (0.18 + rnd() * 0.1)
    h += `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(a)})"><path d="${hullD(len, w)}" transform="translate(0 ${f(-len / 2)})" fill="${plates[k % plates.length]}" stroke="#111" stroke-width="1"/>`
    for (let p = 0; p < 4; p++) h += `<rect x="${f((rnd() - 0.5) * w * 0.7)}" y="${f(-len / 2 + len * (0.2 + p * 0.18))}" width="${f(w * 0.3)}" height="${f(len * 0.1)}" fill="${plates[(k + p + 1) % plates.length]}" opacity=".8"/>`
    h += `<path d="M${f(-w * 0.2)} ${f(-len * 0.1)} l${f(w * 0.15)} ${f(len * 0.08)} l${f(w * 0.12)} ${f(-len * 0.06)}" stroke="#000" stroke-width="1.4" fill="none" opacity=".5"/></g>`
  }
  // guns sprouting all over it, fires burning, a harbour inlet on one side with a jetty
  const C = { metal: orc ? S.metal : S.metal, metalLight: S.metalLight, trim: S.trim }
  for (let k = 0; k < 10; k++) { const x = (rnd() - 0.5) * L * 0.55, y = L * (0.15 + rnd() * 0.7); h += turret(C, x, y, 9, rnd() * 360, 2, 2.4) }
  for (let k = 0; k < 5; k++) { const x = (rnd() - 0.5) * L * 0.5, y = L * (0.2 + rnd() * 0.6); h += `<circle cx="${f(x)}" cy="${f(y)}" r="5" fill="#ff7a1a" opacity=".8"><animate attributeName="r" values="4;6.5;4" dur="${(0.7 + rnd()).toFixed(2)}s" repeatCount="indefinite"/></circle><circle cx="${f(x + 6)}" cy="${f(y + 4)}" r="8" fill="#1a1816" opacity=".4"/>` }
  h += `<path d="M${f(L * 0.28)} ${f(L * 0.42)} Q${f(L * 0.12)} ${f(L * 0.5)} ${f(L * 0.28)} ${f(L * 0.58)}" fill="#1a5a78" stroke="#111" stroke-width="2" opacity=".85"/><rect x="${f(L * 0.16)}" y="${f(L * 0.49)}" width="${f(L * 0.16)}" height="6" fill="#6a4a2a" stroke="#2a1a0a" stroke-width="0.6"/>`
  for (let k = 0; k < 10; k++) { const x = (rnd() - 0.5) * L * 0.5, y = L * (0.2 + rnd() * 0.6); h += man(orc ? ['orc-orc-boy', 'orc-goblin', 'orc-orc-boy-shield'][k % 3] : ['dom-marauder', 'dom-warrior', 'dom-spawn'][k % 3], x, y, rnd() * 360, orc ? 1.2 : 0.9) }
  return out(h, L * 1.0, L * 1.2, L)
}

// ---------------- a quarter of the star fort: one bastion and its stretch of wall, with a quay ----------------
function quadrant (scheme, basilica) {
  const SCH = HUMAN_SCHEMES.find(x => x.id === scheme) ?? HUMAN_SCHEMES[0], C = { ...LOOK.runic, ...SCH.look }, rnd = artRng('quad' + scheme + basilica), S = 100
  setRunes(SCH.rune, SCH.glow)
  const stone = '#80868c', dark = '#3e4348'
  let h = `<path d="M0 ${-S * 0.48} L${S * 0.44} ${-S * 0.02} L${S * 0.3} ${S * 0.46} L${-S * 0.3} ${S * 0.46} L${-S * 0.44} ${-S * 0.02}Z" fill="#000" opacity=".3" transform="translate(2 3)"/>`
  h += `<path d="M0 ${-S * 0.48} L${S * 0.44} ${-S * 0.02} L${S * 0.3} ${S * 0.46} L${-S * 0.3} ${S * 0.46} L${-S * 0.44} ${-S * 0.02}Z" fill="${C.deck}" stroke="${dark}" stroke-width="7"/>`
  h += `<path d="M0 ${-S * 0.48} L${S * 0.44} ${-S * 0.02} L${S * 0.3} ${S * 0.46} L${-S * 0.3} ${S * 0.46} L${-S * 0.44} ${-S * 0.02}Z" fill="none" stroke="${stone}" stroke-width="5"/>`
  h += `<path d="M0 ${-S * 0.48} L${S * 0.44} ${-S * 0.02} L${S * 0.3} ${S * 0.46}" fill="none" stroke="${runeColours().glow}" stroke-width="0.7" stroke-dasharray="6 3 1 3" opacity=".8"/>`
  for (const [x, y, a] of [[0, -S * 0.3, 0], [-S * 0.22, -S * 0.08, -50], [S * 0.22, -S * 0.08, 50]]) h += turret(C, x, y, 7, a, 2, 2.2)
  h += lanceGun('rail-heavy', C, 0, S * 0.08, 6, 0, 3, false)
  // the quay along the inner side, a boat tied up
  h += `<rect x="${-S * 0.3}" y="${S * 0.44}" width="${S * 0.6}" height="6" fill="${stone}" stroke="${dark}" stroke-width="1"/>${[-0.2, 0, 0.2].map(k => `<circle cx="${S * k}" cy="${S * 0.47}" r="1.1" fill="#2a2a2a"/>`).join('')}`
  if (basilica) h += runeCircle(0, S * 0.26, S * 0.12, 3, 40) + man('human-captain-bsb', 0, S * 0.26, 0, 0.9)
  else h += launchPad(C, 0, S * 0.27, 22, 22, true) + gyro(C, 0, S * 0.27, 9, rnd)
  for (let k = 0; k < 4; k++) h += man(['human-handgunner', 'human-crossbowman', 'human-halberdier'][k % 3], (k - 1.5) * 9, S * 0.38, 180, 0.85)
  return { vb: { x: -S * 0.55, y: -S * 0.55, w: S * 1.1, h: S * 1.1 }, inner: h, L: S }
}

/** The drawing for one of these, or null. kind: 'ship' (transports, hulks, the lump) or 'quadrant'. */
export function extraArt (id, { scheme, basilica = false } = {}) {
  if (id === 'quadrant') return quadrant(scheme, basilica)
  if (id === 'transport' || id === 'transport-dominion' || id === 'transport-athanatoi') return transport(id, scheme)
  if (id === 'rukka-lump' || id === 'rukka-lump-defence') return lump(scheme)
  if (id === 'rukka-hulk' || id === 'spacehulk') return hulk(id, scheme)
  return null
}
export const EXTRA_IDS = ['transport', 'transport-dominion', 'transport-athanatoi', 'rukka-lump', 'rukka-lump-defence', 'rukka-hulk', 'spacehulk']
