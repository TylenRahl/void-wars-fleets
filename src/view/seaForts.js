// SEA FORTS: the fortresses and defences of Tides of the Archipelago. Exports fortSvg and SEA_FORTS; used by
// seaPictures.js. Every space station, platform and fort of VOID WARS: Fleets becomes something that stands in the sea, drawn in
// the Human fleet's runic style and colour scheme, with its real weapons (src/rules/defences.js, the Bastion in ships.js):
// bastion a star fort on a reef: four bastions of guns, rail guns on the walls, gyrocopter pads, a central keep
// with its own guns and torpedo slipways, a teleport circle on the keep
// obsidian an ancient fortress of black stone rising from the sea, glowing runes, guns all round
// spacestation a round sea fort on piles; orbitaldock a dockyard with a ship on the slip and cranes
// laserplatform / torpedolauncher / weaponsplatform gun platforms on stilts
// lasersilo / missilesilo / airbase batteries and an airstrip on rock islets
// monitor / systemship / fireship a low monitor, a patrol boat, a burning fire ship
// orbitalmine / minefield floating sea mines
// Drawing units as seaShips.js (a soldier is FIG long); fortSvg(id, { scheme }) returns { vb, inner, svg }.
import { HUMAN_SCHEMES, FIG, f, artRng, LOOK, man, turret, lanceGun, gyro, launchPad, glyph, runeCircle, crate, setRunes, runeColours } from './seaShips.js'

export const SEA_FORTS = [
  { id: 'bastion-freemen', name: 'Star fort', was: 'Bastion star fort' },
  { id: 'obsidian', name: 'Obsidian keep', was: 'Obsidian Monolith' },
  { id: 'spacestation', name: 'Sea fort', was: 'Space station' },
  { id: 'orbitaldock', name: 'Dockyard', was: 'Orbital dock' },
  { id: 'weaponsplatform', name: 'Gun platform', was: 'Orbital weapons platform' },
  { id: 'laserplatform', name: 'Rail gun platform', was: 'Orbital defence laser platform' },
  { id: 'torpedolauncher', name: 'Torpedo platform', was: 'Orbital torpedo launcher' },
  { id: 'lasersilo', name: 'Rail gun battery', was: 'Defence laser silo' },
  { id: 'missilesilo', name: 'Torpedo battery', was: 'Missile silo' },
  { id: 'airbase', name: 'Island airstrip', was: 'Air base' },
  { id: 'monitor', name: 'Monitor', was: 'Defence monitor' },
  { id: 'systemship', name: 'Patrol boat', was: 'System ship' },
  { id: 'fireship', name: 'Fire ship', was: 'Fire ship' },
  { id: 'orbitalmine', name: 'Sea mine', was: 'Orbital mine' },
  { id: 'minefield', name: 'Minefield', was: 'Minefield' }
]

const STONE = { top: '#80868c', light: '#9ca2a8', dark: '#3e4348', joint: '#5e6368' }
const men = ['human-handgunner', 'human-crossbowman', 'human-halberdier', 'human-spearman']

// rocks of a reef round a point, the surf breaking on them
function reef (cx, cy, R, rnd, n = 18) {
  let h = `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(R * 1.08)}" fill="#49c1c9" opacity=".35"/><circle cx="${f(cx)}" cy="${f(cy)}" r="${f(R * 1.0)}" fill="none" stroke="#e8fbff" stroke-width="1.4" stroke-dasharray="5 3" opacity=".6"><animate attributeName="stroke-dashoffset" values="0;16" dur="5s" repeatCount="indefinite"/><animate attributeName="opacity" values=".3;.8;.3" dur="3.4s" repeatCount="indefinite"/></circle>`
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2 + rnd() * 0.3, d = R * (0.86 + rnd() * 0.12), s = R * (0.06 + rnd() * 0.05)
    const pts = [0, 1, 2, 3, 4, 5].map(k => { const t = k / 6 * Math.PI * 2 + rnd() * 0.4; return `${f(cx + Math.cos(a) * d + Math.cos(t) * s)},${f(cy + Math.sin(a) * d + Math.sin(t) * s * 0.8)}` })
    h += `<polygon points="${pts.join(' ')}" fill="#6d6a64" stroke="#3f3c37" stroke-width=".6"/>`
  }
  return h
}
// a stone wall along a closed outline: the wall's face, its walkway, the joints, and a rune line glowing along it
function wall (pts, w, glowId) {
  const d = 'M' + pts.map(p => `${f(p[0])} ${f(p[1])}`).join(' L') + 'Z'
  return `<path d="${d}" fill="none" stroke="#000" stroke-opacity=".35" stroke-width="${f(w + 3)}" transform="translate(2 3)" stroke-linejoin="round"/>
    <path d="${d}" fill="none" stroke="${STONE.dark}" stroke-width="${f(w + 1.6)}" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${STONE.top}" stroke-width="${f(w)}" stroke-linejoin="round"/>
    <path d="${d}" fill="none" stroke="${STONE.joint}" stroke-width="${f(w)}" stroke-dasharray="0.5 6" stroke-linejoin="round"/>
    <path d="${d}" fill="none" stroke="${runeColours().glow}" stroke-width="0.6" stroke-dasharray="7 4 1 4" filter="url(#${glowId})" opacity=".85"><animate attributeName="stroke-dashoffset" values="0;-32" dur="6s" repeatCount="indefinite"/></path>`
}
// a platform on stilts: its legs in the water with foam, the plated deck, a brass rail
function platform (C, cx, cy, w, h) {
  let legs = ''
  for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) legs += `<circle cx="${f(cx + sx * w * 0.42)}" cy="${f(cy + sy * h * 0.42)}" r="${f(Math.min(w, h) * 0.09)}" fill="#e8f8ff" opacity=".35"><animate attributeName="r" values="${f(Math.min(w, h) * 0.07)};${f(Math.min(w, h) * 0.12)};${f(Math.min(w, h) * 0.07)}" dur="3s" repeatCount="indefinite"/></circle>`
  let plates = ''
  for (let y = cy - h / 2 + 8; y < cy + h / 2; y += 8) plates += `<rect x="${f(cx - w / 2)}" y="${f(y)}" width="${f(w)}" height="0.35" fill="${C.deckLine}"/>`
  return `${legs}<rect x="${f(cx - w / 2 + 2)}" y="${f(cy - h / 2 + 3)}" width="${f(w)}" height="${f(h)}" fill="#000" opacity=".35"/><rect x="${f(cx - w / 2)}" y="${f(cy - h / 2)}" width="${f(w)}" height="${f(h)}" rx="2" fill="${C.side}"/>
    <rect x="${f(cx - w / 2 + 1.4)}" y="${f(cy - h / 2 + 1.4)}" width="${f(w - 2.8)}" height="${f(h - 2.8)}" rx="1.4" fill="${C.deck}"/>${plates}<rect x="${f(cx - w / 2 + 1)}" y="${f(cy - h / 2 + 1)}" width="${f(w - 2)}" height="${f(h - 2)}" rx="1.6" fill="none" stroke="${C.trim}" stroke-width="0.6"/>`
}
// a rock islet: a ring of shallows, rocks, a little scrub
function islet (cx, cy, R, rnd) {
  const pts = []
  for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2, d = R * (0.85 + rnd() * 0.2); pts.push(`${f(cx + Math.cos(a) * d)},${f(cy + Math.sin(a) * d * 0.9)}`) }
  let scrub = ''
  for (let i = 0; i < 7; i++) { const a = rnd() * Math.PI * 2, d = R * (0.4 + rnd() * 0.4); scrub += `<circle cx="${f(cx + Math.cos(a) * d)}" cy="${f(cy + Math.sin(a) * d)}" r="${f(R * 0.08)}" fill="#4a7a34"/>` }
  return `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(R * 1.3)}" fill="#49c1c9" opacity=".35"/><circle cx="${f(cx)}" cy="${f(cy)}" r="${f(R * 1.08)}" fill="none" stroke="#e8fbff" stroke-width="1" stroke-dasharray="4 3" opacity=".6"><animate attributeName="stroke-dashoffset" values="0;14" dur="5s" repeatCount="indefinite"/></circle>
    <polygon points="${pts.join(' ')}" fill="#7a746a" stroke="#45403a" stroke-width="1"/><polygon points="${pts.join(' ')}" fill="#9a9284" opacity=".5" transform="translate(${f(-R * 0.08)} ${f(-R * 0.1)}) scale(.85) translate(${f(cx * 0.15 / 0.85)} ${f(cy * 0.15 / 0.85)})"/>${scrub}`
}
const flag = (x, y, s, col = '#b02a22') => `<line x1="${f(x)}" y1="${f(y)}" x2="${f(x)}" y2="${f(y - 0.01)}" stroke="#222"/><circle cx="${f(x)}" cy="${f(y)}" r="${f(s * 0.12)}" fill="#3a3a3a"/><path d="M${f(x)} ${f(y)} l${f(s)} ${f(s * 0.22)} l${f(-s)} ${f(s * 0.44)}Z" fill="${col}" stroke="#d9b04c" stroke-width="0.3"><animateTransform attributeName="transform" type="skewY" values="0;6;0;-4;0" dur="2.5s" repeatCount="indefinite"/></path>`
// torpedoes lying in their slipways, warheads out over the water, pointing at angle a from (x, y)
function slipway (C, x, y, a, n, len) {
  const tw = len * 0.16
  let h = ''
  for (let i = 0; i < n; i++) {
    const tx = (i - (n - 1) / 2) * tw * 1.7
    h += `<rect x="${f(tx - tw * 0.75)}" y="${f(-len * 0.1)}" width="${f(tw * 1.5)}" height="${f(len * 1.1)}" fill="#2a2e33"/><rect x="${f(tx - tw / 2)}" y="${f(-len * 0.35)}" width="${f(tw)}" height="${f(len)}" rx="${f(tw / 2)}" fill="#3e4a52" stroke="#15171a" stroke-width="${f(tw * 0.1)}"/><path d="M${f(tx - tw / 2)} ${f(-len * 0.35 + tw * 0.6)} Q${f(tx)} ${f(-len * 0.35 - tw * 0.7)} ${f(tx + tw / 2)} ${f(-len * 0.35 + tw * 0.6)}Z" fill="#d9b04c"/><rect x="${f(tx - tw / 2)}" y="${f(-len * 0.35 + tw)}" width="${f(tw)}" height="${f(tw * 0.35)}" fill="#b02a22"/>`
  }
  return `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(a)})">${h}</g>`
}
// PORTS: every fortress has
// somewhere to berth: a harbour between breakwaters, a quay with bollards, a lighthouse at the mouth, a boat tied up
function mooredBoat (C, x, y, rot, L) {
  const w = L * 0.28
  return `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(rot)})"><path d="M0 ${f(-L / 2)} C${f(w * 0.6)} ${f(-L * 0.3)} ${f(w / 2)} 0 ${f(w / 2)} ${f(L * 0.3)} L${f(w * 0.35)} ${f(L / 2)} L${f(-w * 0.35)} ${f(L / 2)} L${f(-w / 2)} ${f(L * 0.3)} C${f(-w / 2)} 0 ${f(-w * 0.6)} ${f(-L * 0.3)} 0 ${f(-L / 2)}Z" fill="${C.side}" stroke="#000" stroke-width="0.6"/>
    <path d="M0 ${f(-L / 2 + 2)} C${f(w * 0.5)} ${f(-L * 0.3)} ${f(w / 2 - 1.5)} 0 ${f(w / 2 - 1.5)} ${f(L * 0.3)} L${f(w * 0.3)} ${f(L / 2 - 1.5)} L${f(-w * 0.3)} ${f(L / 2 - 1.5)} L${f(-w / 2 + 1.5)} ${f(L * 0.3)} C${f(-w / 2 + 1.5)} 0 ${f(-w * 0.5)} ${f(-L * 0.3)} 0 ${f(-L / 2 + 2)}Z" fill="${C.deck}"/>
    <rect x="${f(-w * 0.25)}" y="${f(L * 0.05)}" width="${f(w * 0.5)}" height="${f(L * 0.16)}" rx="1" fill="${C.super}" stroke="${C.superDark}" stroke-width="0.4"/><circle cx="0" cy="${f(L * 0.3)}" r="${f(w * 0.12)}" fill="${C.funnel}" stroke="${C.trim}" stroke-width="0.5"/>
    ${turret(C, 0, -L * 0.2, w * 0.2, 0, 2, 2)}</g>`
}
const bollard = (x, y) => `<circle cx="${f(x)}" cy="${f(y)}" r="1.1" fill="#2a2a2a"/><circle cx="${f(x)}" cy="${f(y)}" r="0.55" fill="#6a6a6a"/>`
function lighthouseTower (x, y, s) {
  return `<g transform="translate(${f(x)} ${f(y)})"><path d="M0 0 L${f(s * 6)} ${f(-s * 1.1)} A${f(s * 6.1)} ${f(s * 6.1)} 0 0 1 ${f(s * 6)} ${f(s * 1.1)}Z" fill="#fff6c8" opacity=".25"><animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="7s" repeatCount="indefinite"/></path>
    <circle r="${f(s * 1.05)}" fill="#8a8170"/><circle r="${f(s * 0.95)}" fill="#f1ece0"/><circle r="${f(s * 0.7)}" fill="none" stroke="#c0392b" stroke-width="${f(s * 0.22)}"/><circle r="${f(s * 0.32)}" fill="#ffe680"><animate attributeName="fill" values="#ffe680;#fffbe8;#ffe680" dur="1.75s" repeatCount="indefinite"/></circle></g>`
}
// a harbour opening outward from (x, y) in direction rot (0 = up): two stone breakwater arms, a quay across the back with
// bollards and a crane, a boat moored at the quay, a lighthouse on the end of one arm
function harbour (C, x, y, rot, w, depth, glowId) {
  let h = `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(rot)})">`
  h += `<rect x="${f(-w / 2)}" y="${f(-depth)}" width="${f(w)}" height="${f(depth)}" fill="#1a5a78" opacity=".5"/>`
  for (const sx of [-1, 1]) {
    const arm = [[sx * w / 2, 0], [sx * w / 2, -depth], [sx * w * 0.3, -depth * 1.18]]
    h += `<polyline points="${arm.map(p => `${f(p[0])},${f(p[1])}`).join(' ')}" fill="none" stroke="#000" stroke-opacity=".3" stroke-width="7" transform="translate(1.5 2)" stroke-linejoin="round"/><polyline points="${arm.map(p => `${f(p[0])},${f(p[1])}`).join(' ')}" fill="none" stroke="${STONE.dark}" stroke-width="6.4" stroke-linejoin="round"/><polyline points="${arm.map(p => `${f(p[0])},${f(p[1])}`).join(' ')}" fill="none" stroke="${STONE.top}" stroke-width="5" stroke-linejoin="round"/>`
  }
  h += `<rect x="${f(-w / 2)}" y="-4" width="${f(w)}" height="7" fill="${STONE.top}" stroke="${STONE.dark}" stroke-width="1"/>`
  for (let i = 0; i < 5; i++) h += bollard(-w / 2 + w * (i + 0.5) / 5, -3.2)
  h += `<rect x="${f(w * 0.28)}" y="-3" width="2.4" height="${f(depth * 0.45)}" fill="#c9a24a" stroke="#6a5020" stroke-width="0.4" transform="rotate(180 ${f(w * 0.28 + 1.2)} -3)"/><rect x="${f(w * 0.2)}" y="-4.5" width="10" height="3" fill="#c9a24a" stroke="#6a5020" stroke-width="0.4"/>`
  h += mooredBoat(C, -w * 0.12, -depth * 0.48, 0, depth * 0.62)
  h += lighthouseTower(w * 0.3, -depth * 1.18, 2.2)
  h += `<path d="M${f(-w * 0.26)} ${f(-depth * 1.2)} L${f(w * 0.26)} ${f(-depth * 1.2)}" stroke="#e8fbff" stroke-width="0.8" stroke-dasharray="2 2" opacity=".6"><animate attributeName="stroke-dashoffset" values="0;8" dur="3s" repeatCount="indefinite"/></path>`
  for (let k = 0; k < 3; k++) h += man(men[k % men.length], -w * 0.35 + k * 6, 0.5, 180, 0.8)
  return h + '</g>'
}
// a jetty on piles running out from (x, y) in direction rot, a boat tied alongside
function jetty (C, x, y, rot, len) {
  let piles = ''
  for (let i = 0; i <= 4; i++) piles += `<circle cx="-3.6" cy="${f(-len * i / 4)}" r="1" fill="#3a2a1a"/><circle cx="3.6" cy="${f(-len * i / 4)}" r="1" fill="#3a2a1a"/>`
  return `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(rot)})"><rect x="-3.4" y="${f(-len)}" width="6.8" height="${f(len)}" fill="#000" opacity=".3" transform="translate(1.2 1.6)"/>${piles}<rect x="-3.4" y="${f(-len)}" width="6.8" height="${f(len)}" fill="#8a6a44" stroke="#4a3418" stroke-width="0.6"/>
    ${Array.from({ length: Math.floor(len / 2.4) }, (_, i) => `<rect x="-3.4" y="${f(-len + i * 2.4)}" width="6.8" height="0.4" fill="#4a3418"/>`).join('')}${bollard(-2.4, -len + 2)}${bollard(2.4, -len + 2)}
    ${mooredBoat(C, 10.5, -len * 0.55, 0, len * 0.8)}</g>`
}
const pad = (C, x, y, s, rnd) => launchPad(C, x, y, s, s, true) + gyro(C, x, y, s * 0.4, rnd)
const rail = (C, x, y, r, a) => lanceGun('rail-heavy', C, x, y, r, a, 3, false)
const ring = (n, R, a0 = 0) => Array.from({ length: n }, (_, i) => { const a = a0 + i / n * Math.PI * 2; return [Math.cos(a) * R, Math.sin(a) * R, a * 180 / Math.PI] })

const DRAW = {
  // THE STAR FORT (Bastion: main battery 12, lances 5, launch bays 4, the keep's battery 4 and torpedoes 9)
  'bastion-freemen' (C, rnd, g) {
    const R = 150
    let h = reef(0, 0, R * 1.05, rnd, 30)
    const star = []
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 - Math.PI / 2, r = i % 2 ? R * 0.58 : R * 0.92; star.push([Math.cos(a) * r, Math.sin(a) * r]) }
    h += `<path d="M${star.map(p => `${f(p[0])} ${f(p[1])}`).join(' L')}Z" fill="${C.deck}"/>`
    h += wall(star, 9, g)
    // the bastions: three gun turrets at each point (main battery 12)
    star.filter((_, i) => i % 2 === 0).forEach(([x, y], b) => {
      const a = Math.atan2(y, x)
      for (let k = -1; k <= 1; k++) { const t = a + k * 0.16, d = R * (0.74 - Math.abs(k) * 0.06); h += turret(C, Math.cos(t) * d, Math.sin(t) * d, 9, t * 180 / Math.PI + 90, 2, 2.2) }
      h += flag(x * 0.94, y * 0.94, 10)
    })
    // rail guns on the curtain walls (lances 5)
    star.filter((_, i) => i % 2 === 1).slice(0, 4).forEach(([x, y], k) => { const a = Math.atan2(y, x); h += rail(C, x * 0.98, y * 0.98, 7, a * 180 / Math.PI + 90) })
    h += rail(C, 0, -R * 0.44, 6, 0)
    // the courtyard: gyrocopter pads (bays 4), men at the walls
    for (const [x, y] of ring(4, R * 0.42, Math.PI / 4)) h += pad(C, x, y, 26, rnd)
    for (const [x, y, a] of ring(12, R * 0.5, 0.13)) h += man(men[Math.floor(rnd() * men.length)], x, y, a + 90, 0.9)
    // the keep: its own guns (battery 4), torpedo slipways (torpedoes 9), a teleport circle on its roof
    h += `<circle r="${f(R * 0.26)}" fill="${STONE.dark}"/><circle r="${f(R * 0.24)}" fill="${STONE.top}"/><circle r="${f(R * 0.2)}" fill="${C.deck}"/>`
    for (const [x, y, a] of ring(4, R * 0.23, Math.PI / 4)) h += turret(C, x, y, 6, a + 90, 2, 2)
    h += slipway(C, R * 0.2, R * 0.66, 160, 3, 22) + slipway(C, -R * 0.2, R * 0.66, -160, 3, 22) + slipway(C, 0, R * 0.62, 180, 3, 22)
    h += harbour(C, R * 0.6, -R * 0.6, 45, 92, 76, g)   // the harbour between the north and east bastions
    h += `<g filter="url(#${g})">${runeCircle(0, 0, R * 0.15, 5, 40)}</g>`
    h += man('human-captain-bsb', 0, 0, 0, 0.9)
    for (const [x, y] of ring(6, R * 0.09)) h += man(men[Math.floor(rnd() * 4)], x, y, 0, 0.8)
    return { h, r: R * 1.3 }
  },
  // THE OBSIDIAN KEEP (battery 20, lances 4, bays 8): black angular stone rising from the sea, glowing seams
  obsidian (C, rnd, g) {
    const R = 150, { glow } = runeColours()
    let h = `<circle r="${f(R * 1.1)}" fill="#0a1a26" opacity=".35"/>`
    const outer = ring(6, R).map(p => [p[0], p[1]]), inner = ring(6, R * 0.62, Math.PI / 6).map(p => [p[0], p[1]])
    h += `<path d="M${outer.map(p => `${f(p[0])} ${f(p[1])}`).join(' L')}Z" fill="#141518" stroke="#000" stroke-width="2"/>`
    for (let i = 0; i < 6; i++) { const a = outer[i], b = outer[(i + 1) % 6], c = inner[i]; h += `<path d="M${f(a[0])} ${f(a[1])} L${f(b[0])} ${f(b[1])} L${f(c[0])} ${f(c[1])}Z" fill="${i % 2 ? '#1e2024' : '#26282d'}" stroke="${glow}" stroke-width="0.7" stroke-opacity=".7" filter="url(#${g})"/>` }
    h += `<path d="M${inner.map(p => `${f(p[0])} ${f(p[1])}`).join(' L')}Z" fill="#101114" stroke="${glow}" stroke-width="1" filter="url(#${g})"><animate attributeName="stroke-opacity" values=".3;1;.3" dur="4s" repeatCount="indefinite"/></path>`
    for (const [x, y, a] of ring(10, R * 0.82, 0.3)) h += turret(C, x, y, 9, a + 90, 2, 2.2)
    for (const [x, y, a] of ring(4, R * 0.55, Math.PI / 4)) h += rail(C, x, y, 7, a + 90)
    for (const [x, y] of ring(8, R * 0.36, Math.PI / 8)) h += pad(C, x, y, 20, rnd)
    h += `<g filter="url(#${g})">${runeCircle(0, 0, R * 0.16, 9, 30)}${ring(12, R * 0.92).map(([x, y, a], i) => glyph(i * 3, x, y, 8, a + 90, i * 0.25)).join('')}</g>`
    h += harbour(C, 0, R * 0.86, 180, 92, 70, g)
    return { h, r: R * 1.4 }
  },
  // THE SEA FORT (battery 12, lances 3, bays 4): a round fortress on piles
  spacestation (C, rnd, g) {
    const R = 90
    let h = ''
    for (const [x, y] of ring(10, R * 0.95)) h += `<circle cx="${f(x)}" cy="${f(y)}" r="5" fill="#e8f8ff" opacity=".3"/>`
    h += `<circle cx="3" cy="4" r="${R}" fill="#000" opacity=".35"/><circle r="${R}" fill="${C.side}"/><circle r="${R - 3}" fill="${C.deck}"/>`
    for (let r = 20; r < R; r += 14) h += `<circle r="${r}" fill="none" stroke="${C.deckLine}" stroke-width="0.4"/>`
    h += wall(ring(24, R - 4).map(p => [p[0], p[1]]), 6, g)
    for (const [x, y, a] of ring(6, R * 0.78, 0.3)) h += turret(C, x, y, 9, a + 90, 2, 2.2)
    for (const [x, y, a] of ring(3, R * 0.55, 1.2)) h += rail(C, x, y, 7, a + 90)
    for (const [x, y] of ring(4, R * 0.42, Math.PI / 4)) h += pad(C, x, y, 22, rnd)
    h += `<g filter="url(#${g})">${runeCircle(0, 0, R * 0.2, 2, 40)}</g>` + man('human-captain-bsb', 0, 0, 0, 0.9) + flag(0, -R * 0.2, 10)
    h = jetty(C, 0, R * 0.95, 180, 46) + jetty(C, -R * 0.95, 0, -90, 40) + h
    return { h, r: R * 1.5 }
  },
  // THE DOCKYARD (battery 4, bays 4): piers, a ship on the slip half built, cranes
  orbitaldock (C, rnd, g) {
    const W = 200, H = 120
    let h = platform(C, 0, 0, W, H)
    h += `<rect x="${f(-W * 0.38)}" y="${f(-H * 0.32)}" width="${f(W * 0.62)}" height="${f(H * 0.36)}" fill="#1a2a36" stroke="${C.trim}" stroke-width="0.6"/>`
    h += `<path d="M${f(-W * 0.36)} ${f(-H * 0.14)} Q${f(-W * 0.3)} ${f(-H * 0.28)} ${f(-W * 0.1)} ${f(-H * 0.28)} L${f(W * 0.2)} ${f(-H * 0.28)} L${f(W * 0.2)} ${f(0)} L${f(-W * 0.1)} 0 Q${f(-W * 0.3)} 0 ${f(-W * 0.36)} ${f(-H * 0.14)}Z" fill="none" stroke="${C.metalLight}" stroke-width="1.2" stroke-dasharray="3 1.5"/>`
    for (let x = -W * 0.3; x < W * 0.2; x += 9) h += `<line x1="${f(x)}" y1="${f(-H * 0.27)}" x2="${f(x)}" y2="${f(-H * 0.01)}" stroke="${C.metal}" stroke-width="0.8"/>`
    for (const x of [-W * 0.25, W * 0.05]) h += `<rect x="${f(x - 2)}" y="${f(-H * 0.4)}" width="4" height="${f(H * 0.5)}" fill="#c9a24a" stroke="#6a5020" stroke-width="0.4"/><rect x="${f(x - 10)}" y="${f(-H * 0.42)}" width="20" height="4" fill="#c9a24a" stroke="#6a5020" stroke-width="0.4"/><line x1="${f(x + 8)}" y1="${f(-H * 0.4)}" x2="${f(x + 8)}" y2="${f(-H * 0.2)}" stroke="#333" stroke-width="0.4"/>`
    for (const [x, y] of [[W * 0.38, -H * 0.3], [W * 0.38, H * 0.3]]) h += turret(C, x, y, 9, 90, 2, 2.2)
    for (let k = 0; k < 4; k++) h += pad(C, -W * 0.33 + k * 30, H * 0.25, 24, rnd)
    for (let k = 0; k < 6; k++) h += crate(W * 0.25 + (k % 2) * 8, -H * 0.05 + Math.floor(k / 2) * 8, 6)
    for (let k = 0; k < 5; k++) h += man(k % 2 ? 'human-engineer' : 'human-handgunner', -W * 0.3 + k * 22, H * 0.06, 180, 0.85)
    h = jetty(C, -W * 0.3, -H / 2, 0, 34) + jetty(C, W * 0.15, -H / 2, 0, 34) + h + mooredBoat(C, -W * 0.08, -H * 0.15, 90, W * 0.4)
    return { h, r: W * 0.62 }
  },
  weaponsplatform (C, rnd) { let h = jetty(C, 0, 34, 180, 30) + platform(C, 0, 0, 70, 70); for (const [x, y] of [[-17, -14], [17, -14], [0, 16]]) h += turret(C, x, y, 10, 0, 2, 2.2); h += man('human-handgunner', -20, 22, 0, 0.85) + man('human-handgunner', 20, 22, 0, 0.85); return { h, r: 70 } },
  laserplatform (C, rnd) { let h = jetty(C, 0, 34, 180, 30) + platform(C, 0, 0, 70, 70); h += rail(C, -15, 10, 9, 0) + rail(C, 15, 10, 9, 0); h += man('human-engineer', 0, 24, 0, 0.85); return { h, r: 70 } },
  torpedolauncher (C, rnd) { let h = jetty(C, 0, 34, 180, 30) + platform(C, 0, 0, 70, 70); h += slipway(C, 0, -8, 0, 6, 30); h += man('human-engineer', -18, 24, 0, 0.85) + man('human-engineer', 18, 24, 0, 0.85); return { h, r: 70 } },
  lasersilo (C, rnd) { let h = jetty(C, 0, 44, 180, 30) + islet(0, 0, 50, rnd); h += `<circle r="22" fill="${STONE.dark}"/><circle r="19" fill="${STONE.top}"/>`; for (const [x, y, a] of ring(3, 9, 0.5)) h += rail(C, x, y, 6, a + 90); return { h, r: 80 } },
  missilesilo (C, rnd) { let h = jetty(C, 0, 44, 180, 30) + islet(0, 0, 50, rnd); h += `<rect x="-24" y="-16" width="48" height="34" rx="3" fill="${STONE.dark}"/><rect x="-22" y="-14" width="44" height="30" rx="2" fill="${STONE.top}"/>`; h += slipway(C, 0, -4, 0, 6, 26); return { h, r: 80 } },
  airbase (C, rnd) { let h = jetty(C, 0, 58, 180, 32) + islet(0, 0, 66, rnd); h += `<rect x="-58" y="-9" width="116" height="18" fill="#3a3f45"/>${Array.from({ length: 9 }, (_, i) => `<rect x="${-50 + i * 12}" y="-0.8" width="6" height="1.6" fill="#e8e0c8"/>`).join('')}`; for (let k = 0; k < 4; k++) h += pad(C, -36 + k * 24, 28, 20, rnd); h += flag(50, -20, 10); return { h, r: 95 } },
  // THE MONITOR (prow battery 8, prow lance 1): a low, wide gunboat with one great turret and a rail gun
  monitor (C, rnd) {
    const L = 150, W = 52
    let h = `<path d="M0 ${-L / 2} C${W * 0.5} ${-L * 0.35} ${W / 2} ${-L * 0.1} ${W / 2} ${L * 0.25} L${W * 0.4} ${L / 2} L${-W * 0.4} ${L / 2} L${-W / 2} ${L * 0.25} C${-W / 2} ${-L * 0.1} ${-W * 0.5} ${-L * 0.35} 0 ${-L / 2}Z" fill="${C.side}" stroke="#000" stroke-width="1"/>`
    h += `<path d="M0 ${-L / 2 + 4} C${W * 0.44} ${-L * 0.33} ${W / 2 - 3} ${-L * 0.1} ${W / 2 - 3} ${L * 0.25} L${W * 0.36} ${L / 2 - 3} L${-W * 0.36} ${L / 2 - 3} L${-W / 2 + 3} ${L * 0.25} C${-W / 2 + 3} ${-L * 0.1} ${-W * 0.44} ${-L * 0.33} 0 ${-L / 2 + 4}Z" fill="${C.deck}"/>`
    h += turret(C, 0, -L * 0.12, 17, 0, 3, 2.2) + rail(C, 0, L * 0.22, 9, 0) + man('human-captain-bsb', 0, L * 0.38, 0, 0.9) + man('human-handgunner', -14, L * 0.05, -20, 0.85) + man('human-handgunner', 14, L * 0.05, 20, 0.85)
    return { h, r: L * 0.6 }
  },
  systemship (C, rnd) {
    const L = 100, W = 30
    let h = `<path d="M0 ${-L / 2} C${W / 2} ${-L * 0.3} ${W / 2} 0 ${W / 2} ${L * 0.3} L${W * 0.35} ${L / 2} L${-W * 0.35} ${L / 2} L${-W / 2} ${L * 0.3} C${-W / 2} 0 ${-W / 2} ${-L * 0.3} 0 ${-L / 2}Z" fill="${C.side}" stroke="#000" stroke-width="1"/><path d="M0 ${-L / 2 + 3} C${W / 2 - 2} ${-L * 0.3} ${W / 2 - 2} 0 ${W / 2 - 2} ${L * 0.3} L${W * 0.33} ${L / 2 - 2} L${-W * 0.33} ${L / 2 - 2} L${-W / 2 + 2} ${L * 0.3} C${-W / 2 + 2} 0 ${-W / 2 + 2} ${-L * 0.3} 0 ${-L / 2 + 3}Z" fill="${C.deck}"/>`
    h += turret(C, 0, -L * 0.18, 9, 0, 3, 2.2) + `<rect x="-8" y="${L * 0.05}" width="16" height="12" rx="1" fill="${C.super}" stroke="${C.superDark}" stroke-width="0.5"/>` + man('human-captain-bsb', 0, L * 0.12, 0, 0.8) + man('human-handgunner', 0, L * 0.34, 180, 0.8)
    return { h, r: L * 0.6 }
  },
  fireship (C, rnd) {
    const L = 100, W = 30
    let h = `<path d="M0 ${-L / 2} C${W / 2} ${-L * 0.3} ${W / 2} 0 ${W / 2} ${L * 0.3} L${W * 0.35} ${L / 2} L${-W * 0.35} ${L / 2} L${-W / 2} ${L * 0.3} C${-W / 2} 0 ${-W / 2} ${-L * 0.3} 0 ${-L / 2}Z" fill="#3a2414" stroke="#000" stroke-width="1"/><path d="M0 ${-L / 2 + 3} C${W / 2 - 2} ${-L * 0.3} ${W / 2 - 2} 0 ${W / 2 - 2} ${L * 0.3} L${W * 0.33} ${L / 2 - 2} L${-W * 0.33} ${L / 2 - 2} L${-W / 2 + 2} ${L * 0.3} C${-W / 2 + 2} 0 ${-W / 2 + 2} ${-L * 0.3} 0 ${-L / 2 + 3}Z" fill="#6a4a2a"/>`
    for (let k = 0; k < 6; k++) h += `<rect x="${-10 + (k % 2) * 12}" y="${-L * 0.3 + Math.floor(k / 2) * 18}" width="9" height="12" fill="#5a3a1a" stroke="#2a1a0a" stroke-width="0.4"/>`
    for (let k = 0; k < 5; k++) { const x = (rnd() - 0.5) * W * 0.6, y = -L * 0.3 + k * L * 0.14, s = 6 + rnd() * 4; h += `<path d="M${f(x - s / 2)} ${f(y)} Q${f(x)} ${f(y - s * 1.6)} ${f(x + s / 2)} ${f(y)}Z" fill="#ff8a1a"><animate attributeName="d" values="M${f(x - s / 2)} ${f(y)} Q${f(x)} ${f(y - s * 1.6)} ${f(x + s / 2)} ${f(y)}Z;M${f(x - s / 2)} ${f(y)} Q${f(x + 2)} ${f(y - s * 2.1)} ${f(x + s / 2)} ${f(y)}Z;M${f(x - s / 2)} ${f(y)} Q${f(x)} ${f(y - s * 1.6)} ${f(x + s / 2)} ${f(y)}Z" dur="${(0.6 + rnd() * 0.5).toFixed(2)}s" repeatCount="indefinite"/></path><circle cx="${f(x)}" cy="${f(y - s * 0.4)}" r="${f(s * 0.3)}" fill="#ffe08a"/>` }
    h += `<ellipse cx="6" cy="${L * 0.55}" rx="10" ry="28" fill="#3a3a3a" opacity=".3"/>`
    return { h, r: L * 0.6 }
  },
  orbitalmine (C, rnd, g) { const { glow } = runeColours(); return { h: `<circle r="16" fill="#e8f8ff" opacity=".2"/>${Array.from({ length: 8 }, (_, i) => `<rect x="-1.4" y="-15" width="2.8" height="6" fill="#3a3f45" transform="rotate(${i * 45})"/>`).join('')}<circle r="10" fill="#2a2e33" stroke="#111" stroke-width="0.8"/><circle r="10" fill="none" stroke="${glow}" stroke-width="0.6" filter="url(#${g})"/><g filter="url(#${g})">${glyph(4, 0, 0, 8, 0, 0)}</g>`, r: 18 } },
  minefield (C, rnd, g) { let h = ''; for (let k = 0; k < 9; k++) { const x = (rnd() - 0.5) * 120, y = (rnd() - 0.5) * 80; h += `<g transform="translate(${f(x)} ${f(y)}) scale(.6)">${DRAW.orbitalmine(C, rnd, g).h}</g>` } return { h: `<ellipse rx="70" ry="48" fill="none" stroke="#b02a22" stroke-width="0.8" stroke-dasharray="4 3"/>` + h, r: 75 } }
}

export function fortSvg (id, { scheme = 'midnight' } = {}) {
  const SCH = HUMAN_SCHEMES.find(x => x.id === scheme) ?? HUMAN_SCHEMES[0]
  setRunes(SCH.rune, SCH.glow)
  const C = { ...LOOK.runic, ...SCH.look }, rnd = artRng(id + scheme), g = `fg-${id}-${scheme}`
  const draw = DRAW[id]
  if (!draw) throw new Error(`fortSvg: no sea fort for ${id}`)
  const { h, r } = draw(C, rnd, g)
  const defs = `<defs><filter id="${g}" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1.1" result="b"/><feFlood flood-color="${SCH.glow}"/><feComposite in2="b" operator="in" result="c"/><feMerge><feMergeNode in="c"/><feMergeNode in="c"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`
  const P = r + FIG
  const vb = { x: -P, y: -P, w: P * 2, h: P * 2 }
  return { vb, inner: defs + h, svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f(vb.x)} ${f(vb.y)} ${f(vb.w)} ${f(vb.h)}">${defs}${h}</svg>` }
}
