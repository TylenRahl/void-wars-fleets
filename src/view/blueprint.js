// SHIP BLUEPRINTS — one top-down drawing per ship, built from its weapons in src/data/ships.js, that BOTH art
// styles draw from:
// - the SVG style renders the parts as vectors (src/view/svgShips.js)
// - the sprite style shows the same parts as pixel art (the PNGs in public/space/sprites/)
// so a ship's sprite and its SVG always agree on where its guns, lances, launch bays and torpedo tubes are.
//
// Hull designs and colours:
//
// - DESIGNS: three hull designs for the Freemen and Dominion ships — Cathedral, Blade, Fortress. The weapons drawn are the same in all three.
// - FLEET_DESIGN: the one hull each of the other fleets is drawn in.
// - SCHEMES: colour schemes per fleet. The prow has its own colour roles (prow, prowLight, prowDark), so a scheme
// can paint the main body one colour and the pointed prow another.
// - more detail: hull plating, rows of lit windows, trim lines, prow armour bands, engine bells, bridge windows.
//
// Coordinates are drawing units, NOT game centimetres: x = 0 is the keel, y = 0 is the prow tip, y grows towards
// the stern. The prow points UP; the game will rotate the picture to the ship's facing.
// A part is { s: 'poly', pts: [[x, y], ...] } | { s: 'rect', x, y, w, h } | { s: 'circ', cx, cy, r }, plus `f`, a
// colour ROLE looked up in the palette — never a colour, so both styles share the schemes.
// Pure data: no DOM, no Pixi, runs in node.
import { SHIPS, ORDNANCE, sizeOf, shipById } from '../data/ships.js'
import { phageProfile } from '../data/phageShips.js'
import { CONCORD_SHIPS, CONCORD_MORE, CONCORD_CRAFT, RUKKA_SHIPS, RUKKA_MORE, RUKKA_CRAFT, ATHANATOI_SHIPS, ATHANATOI_MORE, ATHANATOI_FLEET, ATHANATOI_CRAFT, RACE_SHIPS, THNITOI_FLEET, THNITOI_CRAFT, KATHAROS_FLEET, PHAGE_FLEET, PHAGE_CRAFT, ISOS_FLEET, ISOS_CRAFT } from '../data/concordShips.js'

// ---------------- colours ----------------
const BASE = {
  freemen: {
    hull: '#8b94a4', hullLight: '#b9c1cd', hullDark: '#4d5462', panel: '#7a8394',
    prow: '#c9a24a', prowLight: '#e8d08a', prowDark: '#7e6226',
    trim: '#c9a24a', trimDark: '#7e6226', deck: '#353a45', port: '#ffd27a', window: '#fff1b8',
    barrel: '#d2d6dc', gunMid: '#7a5c36', gunDark: '#2a1f16',   // bronze gun mounts
    glow: '#6fcfff', glowCore: '#eafaff', metal: '#69707d', bay: '#121418', accent: '#e2c46a',
    rock: '#6b5d4f', rockLight: '#8f8070', rockDark: '#3d342c', outline: '#101217',
  },
  dominion: {
    hull: '#7c2b2b', hullLight: '#aa463d', hullDark: '#3f1517', panel: '#6a2424',
    prow: '#4a1a1c', prowLight: '#7c2b2b', prowDark: '#260c0e',
    trim: '#b08a3e', trimDark: '#6a4f1e', deck: '#28181a', port: '#ff9a4a', window: '#ffd08a',
    barrel: '#c8c6ca', gunMid: '#74532e', gunDark: '#261a12',
    glow: '#ff6a32', glowCore: '#ffe2b4', metal: '#4b4249', bay: '#100809', accent: '#e0c878',
    rock: '#6b5d4f', rockLight: '#8f8070', rockDark: '#3a302a', outline: '#0e0707',
  },
  // the Concord's grey steel and pale face, as on its Void Wars logo; its light the line down the Binding
  concord: {
    hull: '#8fa6bc', hullLight: '#b4c6d6', hullDark: '#3a4656', panel: '#7c93aa',
    prow: '#c9d5e1', prowLight: '#e6edf3', prowDark: '#6f8296',
    trim: '#c9d5e1', trimDark: '#5c6d80', deck: '#2c3644', port: '#a8d4ff', window: '#e2f2ff',
    barrel: '#d2d8df', gunMid: '#4d5b6c', gunDark: '#1e252e',
    glow: '#78b4ff', glowCore: '#eaf5ff', metal: '#5e6c7c', bay: '#0e1218', accent: '#e6edf3',
    rock: '#6b5d4f', rockLight: '#8f8070', rockDark: '#3d342c', outline: '#10151c',
  },
  // bone, a green spirit stone, gold, as on their Void Wars logo; the prow colours are the sails of woven light, green like the stone
  athanatoi: {
    hull: '#e3dac2', hullLight: '#f4eddc', hullDark: '#7d7560', panel: '#cfc5aa',
    prow: '#2fae7f', prowLight: '#7fe6bc', prowDark: '#14503c',
    trim: '#d8c07a', trimDark: '#7a6a3a', deck: '#14241e', port: '#7fe6bc', window: '#e0fff0',
    barrel: '#e8e0cc', gunMid: '#a89a70', gunDark: '#14241e',
    glow: '#2fae7f', glowCore: '#e0fff0', metal: '#8a8468', bay: '#0a120f', accent: '#bfeedd',
    rock: '#6b5d4f', rockLight: '#8f8070', rockDark: '#3d342c', outline: '#10140f',
  },
  // the Thnitoi, Phage, Isos and Katharos, each in its Void Wars logo's colours; the prow colours are the race's accent
  thnitoi: { hull: '#2a2436', hullLight: '#4a3f5e', hullDark: '#120e1a', panel: '#362c48', prow: '#8e3fc0', prowLight: '#c98af0', prowDark: '#4a1f68', trim: '#c98af0', trimDark: '#5e3a80', deck: '#0f0b14', port: '#e0b0ff', window: '#f0d8ff',
    barrel: '#b8aec8', gunMid: '#4a3f5e', gunDark: '#0f0b14', glow: '#a855e0', glowCore: '#f0d8ff', metal: '#8a8098', bay: '#07050a', accent: '#c98af0', rock: '#6b5d4f', rockLight: '#8f8070', rockDark: '#3d342c', outline: '#07050a' },
  phage: { hull: '#e3d1a6', hullLight: '#f4e8c8', hullDark: '#4a2a4c', panel: '#c8b488', prow: '#7a3a7a', prowLight: '#b05ab0', prowDark: '#3a163a', trim: '#b05ab0', trimDark: '#5a2a5a', deck: '#26102a', port: '#e0a0e0', window: '#f4d0f4',
    barrel: '#e3d1a6', gunMid: '#7a3a7a', gunDark: '#26102a', glow: '#c060c8', glowCore: '#f8d8f8', metal: '#a8947a', bay: '#1a0a1c', accent: '#b05ab0', rock: '#6b5d4f', rockLight: '#8f8070', rockDark: '#3d342c', outline: '#14081a' },
  isos: { hull: '#c4b183', hullLight: '#efe4c4', hullDark: '#26303a', panel: '#b0a074', prow: '#6a8aa8', prowLight: '#9cb8d0', prowDark: '#3a5068', trim: '#efe4c4', trimDark: '#6a8aa8', deck: '#26303a', port: '#cfe4f4', window: '#eaf6ff',
    barrel: '#e0d8c0', gunMid: '#6a8aa8', gunDark: '#26303a', glow: '#8ac0e8', glowCore: '#eaf6ff', metal: '#7a7a6e', bay: '#141a20', accent: '#efe4c4', rock: '#6b5d4f', rockLight: '#8f8070', rockDark: '#3d342c', outline: '#10161c' },
  katharos: { hull: '#4a5652', hullLight: '#6e7c76', hullDark: '#0e1210', panel: '#3a4642', prow: '#39f08a', prowLight: '#bfe8d0', prowDark: '#14503a', trim: '#6e7c76', trimDark: '#26302c', deck: '#0e1210', port: '#39f08a', window: '#bfe8d0',
    barrel: '#8a9892', gunMid: '#3a4642', gunDark: '#0e1210', glow: '#39f08a', glowCore: '#d8ffe8', metal: '#5e6c66', bay: '#060a08', accent: '#bfe8d0', rock: '#6b5d4f', rockLight: '#8f8070', rockDark: '#3d342c', outline: '#060a08' },
  // the Old Ships' pale ivory and old gold, under each Firm's colours (prow and accent are the Firm's)
  rukka: {
    hull: '#c9bfa6', hullLight: '#e4dcc6', hullDark: '#6e6552', panel: '#b3a88d',
    prow: '#b02a22', prowLight: '#d8564a', prowDark: '#5e1612',
    trim: '#c9a24a', trimDark: '#7a6228', deck: '#2c2820', port: '#ffb040', window: '#ffe4a8',
    barrel: '#b8b6ae', gunMid: '#5c5a54', gunDark: '#23221f',
    glow: '#ff9a3a', glowCore: '#ffe9c8', metal: '#6d6a62', bay: '#100e0c', accent: '#f2eee6',
    rock: '#6b5d4f', rockLight: '#8f8070', rockDark: '#3d342c', outline: '#14110d',
  },
}
// a body colour gives hull + its light, dark and plating tones; a prow colour gives the three prow tones
const body = (hull, hullLight, hullDark, panel) => ({ hull, hullLight, hullDark, panel })
const prowC = (prow, prowLight, prowDark) => ({ prow, prowLight, prowDark })
const trimC = (trim, trimDark) => ({ trim, trimDark })
const GREEN = body('#3f7a46', '#6aa86c', '#20402a', '#356a3c')
const WHITE_PROW = prowC('#e6e8e2', '#ffffff', '#9aa09a')

export const SCHEMES = {
  freemen: [
    { id: 'grey-gold', name: 'Grey and gold' },
    { id: 'green-white', name: 'Green, white prow', ...GREEN, ...WHITE_PROW, ...trimC('#d9d4c0', '#8a8670') },
    { id: 'blue-gold', name: 'Navy blue and gold', ...body('#2f4a7a', '#5272a8', '#18263f', '#2a4170') },
    { id: 'blue-white', name: 'Bright blue, white prow', ...body('#2f6fb8', '#5a98dc', '#173a66', '#2a63a6'), ...WHITE_PROW, ...trimC('#e2c46a', '#8a6f2a') },
    { id: 'bone-red', name: 'Bone, red prow', ...body('#cfc6ad', '#ece6d2', '#857c66', '#bdb398'), ...prowC('#a8322b', '#d0564a', '#5e1a16'), ...trimC('#a8322b', '#5e1a16') },
  ],
  dominion: [   // the first scheme is the default: Freemen grey and gold, Dominion black and gold
    { id: 'black-gold', name: 'Black and gold', ...body('#2c2d33', '#4a4c55', '#141418', '#24252a'), ...prowC('#c9a24a', '#e8d08a', '#7e6226'), ...trimC('#c9a24a', '#7e6226') },
    { id: 'blood-brass', name: 'Blood red and brass' },
    { id: 'green-white', name: 'Green, white prow', ...GREEN, ...WHITE_PROW, ...trimC('#b08a3e', '#6a4f1e') },
    { id: 'blue-bronze', name: 'Blue and bronze', ...body('#25508a', '#4a78b8', '#112848', '#20467c'), ...prowC('#b07a3a', '#d8a868', '#5e3e18'), ...trimC('#c08a40', '#6a4818') },
    { id: 'plague-bone', name: 'Plague green and bone', ...body('#6f7a3a', '#97a25a', '#3a401c', '#626c32'), ...prowC('#d8cfa8', '#f2ead0', '#8a8264'), ...trimC('#8a6a2a', '#4e3a14') },
    { id: 'purple-pink', name: 'Purple, pink prow', ...body('#5e3470', '#8a58a0', '#2e173a', '#532d63'), ...prowC('#e090c0', '#f8c4e2', '#904a78'), ...trimC('#d8b8e8', '#7a5a8a') },
  ],
  concord: [   // grey first, blue as a choice, as Void Wars' Concord
    { id: 'concord-grey', name: 'Concord grey' },
    { id: 'concord-blue', name: 'Concord blue', ...body('#2f5a9e', '#5a86c8', '#16294c', '#2a5090'), ...prowC('#dfe6ee', '#ffffff', '#8a97a8') },
  ],
  athanatoi: [{ id: 'bone-green', name: 'Bone and green' }],
  thnitoi: [{ id: 'thnitoi-violet', name: 'Black and violet' }], phage: [{ id: 'phage-bone', name: 'Bone and purple' }],
  isos: [{ id: 'isos-sand', name: 'Sand and blue' }],
  katharos: [{ id: 'katharos-green', name: 'Dark metal and green' }],
  rukka: [   // one for each Firm: prow is its first colour, accent its second
    { id: 'firm-terrace', name: 'The Terrace Lot' },
    { id: 'firm-razor', name: 'The Razor Mob', ...prowC('#26262c', '#4a4a52', '#101014'), accent: '#d8b04a' },
    { id: 'firm-scoota', name: 'The Scoota Lot', ...prowC('#4f6a3a', '#7d9a5c', '#2a3a1e'), accent: '#e8e4d0' },
    { id: 'firm-leatherz', name: 'The Leatherz', ...prowC('#2c2622', '#50463e', '#141110'), accent: '#c8ccd2' },
    { id: 'firm-navvies', name: 'The Navvies', ...prowC('#d8a81c', '#f0cc5a', '#7a5c0e'), accent: '#1e1e20' },
    { id: 'firm-wide', name: 'The Wide Boyz', ...prowC('#6a3a8e', '#9464b8', '#361c4a'), accent: '#58c0a8' },
    { id: 'firm-cup', name: 'The Cup Final', ...prowC('#2a54a8', '#5c84d0', '#142a58'), accent: '#ffffff' },
    { id: 'firm-pasty', name: 'The Pasty Moon', ...prowC('#c8842e', '#e8b060', '#6e4414'), accent: '#f0dca0' },
  ],
}
export const DESIGNS = [
  { id: 'cathedral', name: 'Cathedral' },   // armoured ram prow, tall stepped spire, buttresses down the spine
  { id: 'blade', name: 'Blade' },           // long narrow needle prow, slim hull, low bridge, swept fins
  { id: 'fortress', name: 'Fortress' },     // wide blocky hull, stepped prow, raised keep and twin towers
]
export const DEFAULT_DESIGN = 'cathedral'
// the hull design each of the other fleets is drawn in
export const FLEET_DESIGN = { concord: 'dyad', rukka: 'shoe', athanatoi: 'trophy', thnitoi: 'hollow', phage: 'cage', katharos: 'phase', isos: 'ring-cross' }
// (an attack craft or torpedo is not a ship: its own row names its fleet, so a Concord Dropwing is drawn from the Concord's
// folder, not the default design's)
const craftFleet = id => [CONCORD_CRAFT, RUKKA_CRAFT, ATHANATOI_CRAFT, THNITOI_CRAFT, PHAGE_CRAFT, ISOS_CRAFT].flat().find(o => o.id === id)?.fleet
export const designOf = id => FLEET_DESIGN[shipById(id)?.fleet ?? craftFleet(id)] ?? DEFAULT_DESIGN
export const defaultScheme = fleet => SCHEMES[fleet][0].id

/** The colours for a fleet in one scheme: role -> '#rrggbb'. */
export function palette(fleet, scheme) {
  const s = SCHEMES[fleet].find(x => x.id === scheme) ?? SCHEMES[fleet][0]
  const { id, name, ...colours } = s
  return { ...BASE[fleet], ...colours }
}
// roles that are light sources: never outlined, drawn with a halo in the SVG style
export const GLOW_ROLES = ['glow', 'glowCore', 'port', 'window']

// ---- deterministic variation per ship (art only; the game's dice use the seeded source, not this) ----
function hash(str) { let h = 2166136261; for (const c of str) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) } return h >>> 0 }
function rng(seed) { let a = hash(seed); return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }

// ---- part makers ----
const poly = (f, pts) => ({ s: 'poly', f, pts })
const rect = (f, x, y, w, h) => ({ s: 'rect', f, x, y, w, h })
const circ = (f, cx, cy, r) => ({ s: 'circ', f, cx, cy, r })
const mirror = p => p.s === 'poly' ? { ...p, pts: p.pts.map(([x, y]) => [-x, y]).reverse() }
  : p.s === 'rect' ? { ...p, x: -p.x - p.w } : { ...p, cx: -p.cx }
const both = parts => [...parts, ...parts.map(p => p.m ? { ...mirror(p), m: p.m + "'" } : mirror(p))]   // drawn on the port (left, x < 0) side, mirrored to starboard
// A gun that can turn: its parts carry a key, and a 'mark' records the pivot through
// every reach, forward and mirror. blueprint turns them into bp.mounts and takes the marks out.
// key 'P|i|k': gun k of port weapon i (the mirror is the same gun of starboard weapon i); 'W|i|k': gun k of ship.weapons[i]
const tag = (parts, key, px, py, rest) => [...parts.map(p => ({ ...p, m: key })), { ...circ('mark', px, py, 0), m: key, rest }]
const at = (ship, loc) => ship.weapons.filter(w => w.loc === loc)
// turn parts drawn pointing out to port (x decreasing, mount at the origin) to point forward (y decreasing), placed at (px, py)
const forward = (parts, px, py) => parts.map(p => p.s === 'rect' ? { ...p, x: px - (p.y + p.h), y: py + p.x, w: p.h, h: p.w }
  : p.s === 'circ' ? { ...p, cx: px - p.cy, cy: py + p.cx } : { ...p, pts: p.pts.map(([x, y]) => [px - y, py + x]) })

// THE LANCE VERSIONS.
// Broadside lances only; every version keeps one lance per point of strength, pointing out over the side.
export const LANCES = [
  { id: 'turret', name: 'Turret' },        // a round turret, one long banded barrel, the lit lens at its tip
  { id: 'twin', name: 'Twin' },            // a square mount with two thin parallel barrels and two lenses
  { id: 'emplacement', name: 'Emplacement' }, // a long armoured housing, a short thick barrel, a big glowing lens
  { id: 'array', name: 'Focusing array' }, // a barrel ending in three prongs round a glowing crystal
]
export const DEFAULT_LANCE = 'array'   // // one lance at mount centre x0 (the barrel reaches outward, x decreasing), centred on y; step = room along the hull
function lanceGun(version, x0, py, step, dw, dominion) {
  const trim = dominion ? 'trimDark' : 'trim'
  const r = Math.min(step * 0.36, dw * 0.55), bw = Math.max(r * 0.42, dw * 0.2)
  if (version === 'twin') {
    const out = [rect('gunDark', x0 - r * 1.05, py - r * 1.05, r * 2.1, r * 2.1), rect('gunMid', x0 - r * 0.8, py - r * 0.8, r * 1.6, r * 1.6), rect(trim, x0 - r * 0.8, py - r * 0.8, r * 1.6, r * 0.25)]
    const tw = Math.max(bw * 0.6, dw * 0.13)
    for (const off of [-r * 0.45, r * 0.45]) out.push(rect('gunDark', x0 - r - dw * 2.3, py + off - tw / 2, dw * 2.3, tw), rect('barrel', x0 - r - dw * 2.25, py + off - tw * 0.28, dw * 2.2, tw * 0.45),
      rect('gunDark', x0 - r - dw * 1.2, py + off - tw * 0.8, dw * 0.14, tw * 1.6), circ('glowCore', x0 - r - dw * 2.3, py + off, tw * 0.45))
    out.push(circ('gunDark', x0, py, r * 0.32))
    return out
  }
  if (version === 'emplacement') {
    const hh = Math.min(step * 0.8, dw * 1.2), tb = Math.max(bw * 1.5, dw * 0.32)
    return [rect('gunDark', x0 - dw * 1.5, py - hh / 2, dw * 1.9, hh), rect('gunMid', x0 - dw * 1.4, py - hh * 0.38, dw * 1.7, hh * 0.76), rect(trim, x0 - dw * 1.5, py - hh / 2, dw * 0.16, hh),
      rect('gunDark', x0 - dw * 0.4, py - hh * 0.38, dw * 0.1, hh * 0.76), rect('gunDark', x0 + dw * 0.0, py - hh * 0.38, dw * 0.1, hh * 0.76),
      rect('gunDark', x0 - dw * 2.5, py - tb / 2, dw * 1.0, tb), rect('barrel', x0 - dw * 2.45, py - tb * 0.3, dw * 0.95, tb * 0.4),
      circ('gunDark', x0 - dw * 2.55, py, tb * 0.75), circ('glow', x0 - dw * 2.55, py, tb * 0.5), circ('glowCore', x0 - dw * 2.55, py, tb * 0.25)]
  }
  if (version === 'array') {
    const tip = x0 - dw * 2.3, pr = Math.max(bw * 0.4, dw * 0.12), sp = Math.max(r * 0.75, dw * 0.35)
    return [circ('gunDark', x0, py, r * 1.05), circ(trim, x0, py, r * 0.85), circ('gunMid', x0, py, r * 0.55),
      rect('gunDark', tip + dw * 0.6, py - bw / 2, x0 - tip - dw * 0.6, bw), rect('barrel', tip + dw * 0.6, py - bw * 0.3, x0 - tip - dw * 0.6, bw * 0.4),
      rect('gunDark', tip + dw * 0.5, py - sp - pr, dw * 0.22, sp * 2 + pr * 2),                                  // the cross-bar the prongs hang from
      rect('gunDark', tip, py - sp - pr / 2, dw * 0.7, pr), rect('gunDark', tip, py + sp - pr / 2, dw * 0.7, pr), rect('gunDark', tip - dw * 0.15, py - pr / 2, dw * 0.85, pr),
      poly('glow', [[tip + dw * 0.1, py], [tip + dw * 0.32, py - sp * 0.55], [tip + dw * 0.54, py], [tip + dw * 0.32, py + sp * 0.55]]), circ('glowCore', tip + dw * 0.32, py, pr * 0.6)]
  }
  // turret
  return [rect('gunDark', x0 - dw * 2.5, py - bw / 2, dw * 2.5, bw), rect('barrel', x0 - dw * 2.45, py - bw * 0.32, dw * 2.4, bw * 0.4),
    rect('gunMid', x0 - dw * 2.45, py + bw * 0.08, dw * 2.4, bw * 0.22),
    rect('gunDark', x0 - dw * 1.2, py - bw * 0.85, dw * 0.18, bw * 1.7), rect('gunDark', x0 - dw * 2.0, py - bw * 0.75, dw * 0.14, bw * 1.5),
    rect('gunDark', x0 - dw * 2.75, py - bw * 0.8, dw * 0.3, bw * 1.6), circ('glowCore', x0 - dw * 2.62, py, bw * 0.3),
    circ('gunDark', x0, py, r * 1.12), circ(trim, x0, py, r), circ('gunMid', x0, py, r * 0.72), circ('gunDark', x0, py, r * 0.3)]
}

// one broadside gun at hull-side x0 (its mount reaches outward, x decreasing), centred on y; g = the mount's height
function gun(x0, y, g, dw, twin, dominion) {
  const out = [rect('gunDark', x0 - dw * 1.05, y - g / 2, dw * 1.05, g), rect('gunMid', x0 - dw * 0.95, y - g * 0.38, dw * 0.85, g * 0.76),
    rect(dominion ? 'trimDark' : 'trim', x0 - dw * 0.62, y - g / 2, dw * 0.16, g)]
  const bw = Math.max(g * (twin ? 0.24 : 0.34), dw * 0.16)
  for (const off of twin ? [-g * 0.2, g * 0.2] : [0]) {
    const by = y + off, bx = x0 - dw * 1.05
    out.push(rect('gunDark', bx - dw * 1.55, by - bw / 2, dw * 1.55, bw), rect('barrel', bx - dw * 1.5, by - bw * 0.3, dw * 1.5, bw * 0.45),
      rect('gunDark', bx - dw * 0.7, by - bw * 0.75, dw * 0.14, bw * 1.5), rect('gunDark', bx - dw * 1.8, by - bw * 0.72, dw * 0.28, bw * 1.44))
  }
  return out
}

// ---------------- broadsides: one segment of hull side per port weapon, mirrored to starboard ----------------
// Lances and batteries are kept slim and short so a ship does not look crowded:
// Broadside guns and lances reach out over the side only REACH of their drawn length, measured from where they
// are mounted, and the hull they sit on is drawn HULL_GROWTH times bigger than the weapons are sized for (capital).
const REACH = 0.62
const reach = (parts, edge) => parts.map(p => p.s === 'rect' ? { ...p, x: edge + (p.x - edge) * REACH, w: p.w * REACH }
  : p.s === 'circ' ? { ...p, cx: edge + (p.cx - edge) * REACH } : { ...p, pts: p.pts.map(([x, y]) => [edge + (x - edge) * REACH, y]) })

function broadside(ship, L, h, y0, y1, dominion, lance, weaponL = L) {
  const side = at(ship, 'port')
  if (!side.length) return []
  const out = [], seg = (y1 - y0) / side.length
  const dw = weaponL * 0.07
  side.forEach((w, i) => {
    const a = y0 + i * seg + seg * 0.06, b = y0 + (i + 1) * seg - seg * 0.06, len = b - a
    if (w.kind === 'battery') {
      // broadside weapons drawn like heavy tank guns: a dark
      // mount block, a brass collar stripe, a long grey barrel with a dark ring band and a dark muzzle cap, pointing
      // out over the side. One gun per two points of firepower (2 to 6 guns); twin barrels at firepower 10 and up.
      out.push(rect('deck', -h - dw * 0.9, a, dw * 0.9, len), rect('gunMid', -h - dw * 0.9, a, dw * 0.12, len))
      for (let y = a + len * 0.04; y < b; y += dw * 0.45) out.push(circ('gunDark', -h - dw * 0.78, y, dw * 0.05))   // rivets
      const n = Math.max(2, Math.min(6, Math.ceil(w.str / 2))), step = len / n, g = Math.min(step * 0.56, dw * 0.9)
      const twin = w.str >= 10
      for (let k = 0; k < n; k++) out.push(...tag(reach(gun(-h - dw * 0.15, a + (k + 0.5) * step, g, dw, twin, dominion), -h - dw * 0.15), `P|${i}|${k}`, -h - dw * 0.65, a + (k + 0.5) * step))
    } else if (w.kind === 'lance') {
      // a lance turret per point of strength: a round turret with a brass ring, a long thin barrel in dark bands,
      // the lit focusing lens at its tip (the Guard lascannon, made big)
      out.push(rect('deck', -h - dw * 0.9, a, dw * 0.9, len), rect('gunMid', -h - dw * 0.9, a, dw * 0.12, len))
      const n = Math.min(w.str, 4), step = len / n
      for (let k = 0; k < n; k++) out.push(...tag(reach(lanceGun(lance, -h - dw * 0.55, a + (k + 0.5) * step, step * 0.8, dw, dominion), -h - dw * 0.55), `P|${i}|${k}`, -h - dw * 0.55, a + (k + 0.5) * step))
    } else if (w.kind === 'bays') {
      // launch bays: a hangar block with one dark launch mouth per squadron, landing lights at each mouth
      out.push(rect('hullDark', -h - dw * 1.25, a, dw * 1.25, len), rect(dominion ? 'trimDark' : 'trim', -h - dw * 1.3, a, dw * 0.15, len))
      const n = Math.min(w.str, 4)
      for (let k = 0; k < n; k++) {
        const py = a + (k + 0.5) * len / n, hh = len / n * 0.55
        out.push(rect('bay', -h - dw * 1.05, py - hh / 2, dw * 0.8, hh), rect('glow', -h - dw * 1.05, py - hh / 2, dw * 0.12, hh),
          circ('window', -h - dw * 0.15, py - hh / 2, dw * 0.06), circ('window', -h - dw * 0.15, py + hh / 2, dw * 0.06))
      }
    } else if (w.kind === 'torpedo') {
      out.push(rect('hullDark', -h - dw * 0.7, a, dw * 0.7, len))
      const n = Math.min(Math.ceil(w.str / 2), 4)
      for (let k = 0; k < n; k++) out.push(circ('bay', -h - dw * 0.4, a + (k + 0.5) * len / n, dw * 0.22))
    }
  })
  return both(out)
}

// dorsal weapons down the spine between y0 and y1. Lances are the ship's lance version on a turret ring, pointing forward, one behind the other.
function dorsal(ship, L, w, y0, y1, lance, dw, dominion) {
  const out = []
  for (const d of at(ship, 'dorsal')) {
    const n = Math.min(d.str, 4), step = (y1 - y0) / n
    for (let k = 0; k < n; k++) {
      const y = y0 + (k + 0.5) * step
      if (d.kind === 'lance') {
        const my = y0 + (k + 1) * step - dw * 0.5   // the turret sits at the back of its share of the spine, the lance reaches forward
        out.push(circ('gunDark', 0, my, dw * 0.62), circ(dominion ? 'trimDark' : 'trim', 0, my, dw * 0.5),
          ...tag(forward(reach(lanceGun(lance, 0, 0, w * 0.7, dw, dominion), 0), 0, my), `W|${ship.weapons.indexOf(d)}|${k}`, 0, my, 0))
      } else out.push(...tag([rect('metal', -w * 0.2, y - w * 0.07, w * 0.4, w * 0.14), rect('port', -w * 0.16, y - w * 0.025, w * 0.08, w * 0.05), rect('port', w * 0.08, y - w * 0.025, w * 0.08, w * 0.05)], `W|${ship.weapons.indexOf(d)}|${k}`, 0, y, 0))
    }
  }
  return out
}

// ---------------- forward weapons ----------------
// Prow weapons are the same gun-metal weapons as the broadsides, turned to point forward, on a deck across the hull
// just behind the prow; torpedoes in armoured launcher pods either side of the prow with their warheads showing; the
// sunburst cannon as one huge banded barrel down the spine with a muzzle brake past the prow tip.

// a bank of k torpedo tubes side by side, left edge x0, tube mouths at y0 (pointing forward), tw = one tube's width
function torpedoBank(x0, y0, k, tw, len, dominion) {
  const W = k * tw + tw * 0.4
  const out = [rect('gunDark', x0, y0, W, len), rect('gunMid', x0 + tw * 0.15, y0 + len * 0.4, W - tw * 0.3, len * 0.55),
    rect(dominion ? 'trimDark' : 'trim', x0, y0 + len * 0.62, W, len * 0.07), rect('gunDark', x0, y0 + len * 0.82, W, len * 0.05)]
  for (let i = 0; i < k; i++) {
    const cx = x0 + tw * 0.2 + (i + 0.5) * tw
    out.push(rect('bay', cx - tw * 0.38, y0, tw * 0.76, len * 0.36),                                           // the open tube
      rect('metal', cx - tw * 0.26, y0 - tw * 0.35, tw * 0.52, len * 0.3), rect('accent', cx - tw * 0.26, y0 - tw * 0.1, tw * 0.52, tw * 0.16),   // the torpedo, a band round it
      poly('trim', [[cx, y0 - tw * 1.2], [cx + tw * 0.26, y0 - tw * 0.35], [cx - tw * 0.26, y0 - tw * 0.35]]))  // its warhead
  }
  return out
}

// the sunburst cannon: a breech on the hull, a barrel the width of the spine, reinforcing bands, a slotted muzzle brake past the tip.
// capital draws it before the hull, so the hull and prow cover the breech and only the barrel and muzzle brake show, running out past the prow tip
function sunburstCannon(L, h, tipY, baseY) {
  const bw = h * 0.42, top = tipY - L * 0.14, out = []
  out.push(rect('gunDark', -h * 0.55, baseY - L * 0.02, h * 1.1, L * 0.13), rect('gunMid', -h * 0.45, baseY - L * 0.01, h * 0.9, L * 0.11),
    rect('trim', -h * 0.55, baseY + L * 0.035, h * 1.1, L * 0.012))
  for (let k = 0; k < 3; k++) out.push(rect('glow', -h * 0.33 + k * h * 0.24, baseY + L * 0.065, h * 0.18, L * 0.03))   // the breech's heat vents
  out.push(rect('gunDark', -bw / 2, top + L * 0.04, bw, baseY - top - L * 0.03), rect('barrel', -bw * 0.32, top + L * 0.04, bw * 0.4, baseY - top - L * 0.03),
    rect('gunMid', bw * 0.12, top + L * 0.04, bw * 0.2, baseY - top - L * 0.03))
  for (let y = top + L * 0.085; y < baseY - L * 0.025; y += L * 0.045) out.push(rect('gunDark', -bw * 0.68, y, bw * 1.36, L * 0.014), rect('trim', -bw * 0.68, y, bw * 1.36, L * 0.005))
  out.push(rect('gunDark', -bw * 0.95, top, bw * 1.9, L * 0.06), rect('gunMid', -bw * 0.85, top + L * 0.008, bw * 1.7, L * 0.044))
  for (const sx of [-1, 1]) out.push(rect('bay', sx * bw * 0.58 - bw * 0.14, top + L * 0.014, bw * 0.28, L * 0.032))
  out.push(circ('gunDark', 0, top, bw * 0.55), circ('glow', 0, top, bw * 0.36), circ('glowCore', 0, top, bw * 0.16))
  return out
}

// n forward-pointing guns or lances across a deck at y (the deck's back edge), spread over half-width span
function forwardDeck(n, span, y, dw, make) {
  const out = [], step = (span * 2) / n
  out.push(rect('deck', -span, y - dw * 0.9, span * 2, dw * 0.9), rect('gunMid', -span, y - dw * 0.12, span * 2, dw * 0.12))
  for (let k = 0; k < n; k++) out.push(...make(-span + (k + 0.5) * step, step))
  return out
}

// prow weapons of a capital ship: tipY = the prow tip, baseY = where the prow meets the hull, dw = the broadside weapon size
function prowWeapons(ship, L, h, tipY, baseY, lance, dw, dominion) {
  const out = [], deckY = baseY + L * 0.025
  for (const p of at(ship, 'prow')) {
    if (p.kind === 'sunburst') continue   // drawn under the hull by capital
    if (p.kind === 'torpedo') {
      const k = p.str >= 9 ? 3 : 2, tw = dw * 0.42, len = dw * 2.3
      out.push(...both(torpedoBank(-h * 1.12, deckY - len, k, tw, len, dominion)))
    } else if (p.kind === 'lance') {
      const n = Math.min(p.str, 4)
      const fw = dw * 1.15
      let k = 0
      out.push(...forwardDeck(n, h * 0.85, deckY, fw, (x, step) => tag(forward(lanceGun(lance, 0, 0, step * 0.9, fw, dominion), x, deckY - fw * 0.55), `W|${ship.weapons.indexOf(p)}|${k++}`, x, deckY - fw * 0.55, 0)))
    } else if (p.kind === 'battery') {
      const n = p.str >= 5 ? 3 : 2
      const fw = dw * 1.1
      let k = 0
      out.push(...forwardDeck(n, h * 0.85, deckY, fw, (x, step) => tag(forward(gun(0, 0, Math.min(step * 0.62, fw), fw, p.str >= 10, dominion), x, deckY - fw * 0.15), `W|${ship.weapons.indexOf(p)}|${k++}`, x, deckY - fw * 0.15 + fw * 0.5, 0)))
    } else if (p.kind === 'bays') {
      out.push(rect('bay', -h * 0.35, tipY + (baseY - tipY) * 0.2, h * 0.7, (baseY - tipY) * 0.3), rect('glow', -h * 0.35, tipY + (baseY - tipY) * 0.2, h * 0.7, h * 0.05))
    }
  }
  return out
}

function engines(L, h, y, n, dominion) {
  const out = [rect('hullDark', -h * 1.1, y, h * 2.2, L * 0.09), rect(dominion ? 'trimDark' : 'trim', -h * 1.1, y, h * 2.2, L * 0.01)]
  const nw = (h * 2) / n
  for (let i = 0; i < n; i++) {
    const x = -h + (i + 0.5) * nw
    out.push(rect('metal', x - nw * 0.42, y + L * 0.065, nw * 0.84, L * 0.035), rect('hullDark', x - nw * 0.42, y + L * 0.065, nw * 0.12, L * 0.035))
    out.push(rect('glow', x - nw * 0.32, y + L * 0.1, nw * 0.64, L * 0.04), rect('glowCore', x - nw * 0.16, y + L * 0.1, nw * 0.32, L * 0.025))
  }
  return out
}

// ---------------- prows: armoured, in the prow colours ----------------
function prow(design, dominion, L, h, end) {
  const out = []
  if (!dominion && design === 'cathedral') {
    out.push(poly('prow', [[0, 0], [h * 1.05, end], [-h * 1.05, end]]), poly('prowLight', [[0, L * 0.035], [h * 0.72, end - L * 0.01], [-h * 0.72, end - L * 0.01]]))
    const hw = y => h * 1.05 * y / end
    for (const t of [0.45, 0.72]) { const y1 = end * t, y2 = y1 + L * 0.012; out.push(poly('prowDark', [[-hw(y1), y1], [hw(y1), y1], [hw(y2), y2], [-hw(y2), y2]])) }
    out.push(rect('prowDark', -h * 0.035, L * 0.03, h * 0.07, end - L * 0.03))
  } else if (!dominion && design === 'blade') {
    out.push(poly('prow', [[0, 0], [h * 0.4, end * 0.55], [h * 1.05, end], [-h * 1.05, end], [-h * 0.4, end * 0.55]]),
      poly('prowLight', [[0, L * 0.03], [h * 0.22, end * 0.55], [h * 0.6, end - L * 0.01], [-h * 0.6, end - L * 0.01], [-h * 0.22, end * 0.55]]),
      rect('prowDark', -h * 0.03, L * 0.03, h * 0.06, end - L * 0.03))
  } else if (!dominion) {   // fortress: a stepped, blunt armoured prow
    out.push(rect('prow', -h * 0.55, L * 0.015, h * 1.1, end * 0.5), rect('prow', -h * 0.95, end * 0.45, h * 1.9, end * 0.56),
      rect('prowLight', -h * 0.42, L * 0.025, h * 0.84, end * 0.4), rect('prowLight', -h * 0.8, end * 0.52, h * 1.6, end * 0.4),
      rect('prowDark', -h * 0.95, end * 0.45, h * 1.9, L * 0.01), rect('prowDark', -h * 0.55, L * 0.015, h * 1.1, L * 0.008))
  } else if (design === 'cathedral') {   // Dominion: a forked, clawed prow
    out.push(poly('prow', [[-h * 1.0, end], [-h * 0.75, 0], [-h * 0.3, end * 0.6], [0, end * 0.35], [h * 0.3, end * 0.6], [h * 0.75, 0], [h * 1.0, end]]),
      poly('prowLight', [[-h * 0.75, L * 0.03], [-h * 0.5, end * 0.7], [-h * 0.85, end * 0.9]]), poly('prowLight', [[h * 0.75, L * 0.03], [h * 0.85, end * 0.9], [h * 0.5, end * 0.7]]),
      poly('trim', [[-h * 0.75, 0], [-h * 0.62, end * 0.45], [-h * 0.88, end * 0.5]]), poly('trim', [[h * 0.75, 0], [h * 0.88, end * 0.5], [h * 0.62, end * 0.45]]))
  } else if (design === 'blade') {   // Dominion: one long barbed spike
    out.push(poly('prow', [[0, 0], [h * 0.35, end * 0.5], [h * 1.05, end], [-h * 1.05, end], [-h * 0.35, end * 0.5]]),
      poly('prowLight', [[0, L * 0.03], [h * 0.18, end * 0.5], [h * 0.5, end * 0.95], [-h * 0.5, end * 0.95], [-h * 0.18, end * 0.5]]),
      ...both([poly('trim', [[-h * 0.3, end * 0.42], [-h * 0.75, end * 0.38], [-h * 0.45, end * 0.55]]), poly('trim', [[-h * 0.7, end * 0.78], [-h * 1.2, end * 0.72], [-h * 0.85, end * 0.92]])]))
  } else {   // Dominion fortress: a wide jaw with teeth
    const pts = [[-h * 1.0, end], [-h * 1.0, end * 0.3]]
    for (let i = 0; i <= 8; i++) pts.push([-h + i * h / 4, i % 2 ? end * 0.05 : end * 0.3])
    pts.push([h * 1.0, end])
    out.push(poly('prow', pts), rect('prowLight', -h * 0.8, end * 0.42, h * 1.6, end * 0.4), rect('prowDark', -h * 0.8, end * 0.62, h * 1.6, L * 0.01))
  }
  return out
}

// ---------------- the bridge ----------------
function bridge(design, dominion, L, h, by) {
  const out = []
  const tower = (cx, wd) => {
    out.push(rect('trimDark', cx - wd * 0.62, by, wd * 1.24, L * 0.16), rect(dominion ? 'hullLight' : 'trim', cx - wd * 0.48, by + L * 0.015, wd * 0.96, L * 0.12),
      rect('hullLight', cx - wd * 0.3, by + L * 0.03, wd * 0.6, L * 0.07), poly(dominion ? 'trim' : 'hullLight', [[cx - wd * 0.3, by + L * 0.03], [cx, by - L * 0.04], [cx + wd * 0.3, by + L * 0.03]]),
      rect('hullDark', cx - wd * 0.03, by - L * 0.02, wd * 0.06, L * 0.1))
    for (let k = 0; k < 4; k++) out.push(rect('window', cx - wd * 0.3 + k * wd * 0.17, by + L * 0.112, wd * 0.08, L * 0.012))
    for (let k = 0; k < 3; k++) out.push(rect('window', cx - wd * 0.2 + k * wd * 0.17, by + L * 0.135, wd * 0.07, L * 0.01))
    // pinnacles at the tower's corners
    for (const sx of [-1, 1]) out.push(poly('trim', [[cx + sx * wd * 0.62, by + L * 0.005], [cx + sx * wd * 0.52, by - L * 0.03], [cx + sx * wd * 0.42, by + L * 0.005]]))
    if (dominion) out.push(poly('trim', [[cx - wd * 0.48, by + L * 0.03], [cx - wd * 0.9, by - L * 0.05], [cx - wd * 0.45, by + L * 0.07]]), poly('trim', [[cx + wd * 0.48, by + L * 0.03], [cx + wd * 0.45, by + L * 0.07], [cx + wd * 0.9, by - L * 0.05]]))
  }
  if (design === 'cathedral') tower(0, h)
  else if (design === 'blade') {
    // a long, low command deck along the spine
    out.push(rect('trimDark', -h * 0.42, by - L * 0.08, h * 0.84, L * 0.24), rect(dominion ? 'hullLight' : 'trim', -h * 0.32, by - L * 0.07, h * 0.64, L * 0.22),
      poly('hullLight', [[-h * 0.32, by - L * 0.07], [0, by - L * 0.12], [h * 0.32, by - L * 0.07]]))
    for (let k = 0; k < 6; k++) out.push(rect('window', -h * 0.18, by - L * 0.04 + k * L * 0.03, h * 0.12, L * 0.01), rect('window', h * 0.06, by - L * 0.04 + k * L * 0.03, h * 0.12, L * 0.01))
  } else {   // fortress: a raised keep with two towers
    out.push(rect('hullDark', -h * 0.85, by - L * 0.1, h * 1.7, L * 0.28), rect('hullLight', -h * 0.78, by - L * 0.09, h * 1.56, L * 0.26))
    for (let k = 0; k < 6; k++) out.push(rect('trimDark', -h * 0.8 + k * h * 0.3, by - L * 0.1, h * 0.12, L * 0.012))
    tower(-h * 0.45, h * 0.55); tower(h * 0.45, h * 0.55)
  }
  return out
}

// stern fins (every Dominion ship; the Freemen blade) and the hull body with its plating, windows, trim and spine detail
function fins(design, dominion, L, h) {
  if (!dominion && design !== 'blade') return []
  const fin = design === 'fortress'
    ? [[-h, L * 0.66], [-h * 1.9, L * 0.8], [-h * 1.9, L * 0.92], [-h, L * 0.84]]
    : design === 'blade' ? [[-h, L * 0.56], [-h * 2.6, L * 0.92], [-h * 2.3, L * 0.97], [-h, L * 0.82]]
    : [[-h, L * 0.6], [-h * 2.4, L * 0.86], [-h * 2.1, L * 0.92], [-h, L * 0.82]]
  const tip = fin[1]
  return both([poly('hullDark', fin), poly('panel', [[fin[0][0], fin[0][1] + L * 0.04], [tip[0] * 0.8, tip[1] - L * 0.01], [fin[2][0] * 0.85, fin[2][1] - L * 0.02], [fin[3][0], fin[3][1] - L * 0.02]]),
    poly(dominion ? 'trim' : 'prow', [tip, [tip[0] - h * 0.35, tip[1] + L * 0.09], fin[2]])])
}
function hullBody(design, dominion, L, h, prowEnd, sternY) {
  const parts = []
  parts.push(poly('hull', [[-h, prowEnd], [h, prowEnd], [h * 1.05, sternY + L * 0.02], [-h * 1.05, sternY + L * 0.02]]))
  // plating: alternate panels either side of the spine
  for (let y = prowEnd + L * 0.02, i = 0; y < sternY - L * 0.03; y += L * 0.065, i++) {
    parts.push(...both([rect('panel', -h * (i % 2 ? 0.95 : 0.7), y + L * 0.008, h * (i % 2 ? 0.55 : 0.4), L * 0.05)]))
    parts.push(rect('hullDark', -h, y, h * 2, L * 0.006))
  }
  // windows down both flanks
  for (let y = prowEnd + L * 0.03; y < sternY - L * 0.02; y += L * 0.028) parts.push(...both([rect('window', -h * 0.9, y, h * 0.06, L * 0.008)]))
  // trim lines along the hull edges
  parts.push(...both([rect(dominion ? 'trimDark' : 'trim', -h * 1.0, prowEnd, h * 0.05, sternY - prowEnd)]))
  // the spine, and the design's own spine detail
  parts.push(rect('hullDark', -h * 0.22, prowEnd, h * 0.44, sternY - prowEnd), rect('panel', -h * 0.12, prowEnd, h * 0.24, sternY - prowEnd))
  if (design === 'cathedral') for (let y = prowEnd + L * 0.08; y < L * 0.56; y += L * 0.09) parts.push(...both([poly('trim', [[-h * 0.22, y], [-h * 0.5, y + L * 0.035], [-h * 0.22, y + L * 0.02]])]))
  if (design === 'fortress') for (let y = prowEnd + L * 0.06; y < L * 0.5; y += L * 0.07) parts.push(...both([rect('hullLight', -h * 0.6, y, h * 0.25, L * 0.03), rect('window', -h * 0.55, y + L * 0.01, h * 0.15, L * 0.008)]))
  if (dominion) for (let y = prowEnd + L * 0.08; y < L * 0.7; y += L * 0.11) parts.push(...both([poly('trim', [[-h * 1.02, y], [-h * 1.5, y + L * 0.05], [-h * 1.02, y + L * 0.03]])]))
  return parts
}

// ---------------- capital ships ----------------
const HULL_GROWTH = 1.3   // see REACH above
function capital(ship, design, lance) {
  const dominion = ship.fleet === 'dominion', L0 = 100 * sizeOf(ship), L = L0 * HULL_GROWTH, r = rng(ship.id)
  const bb = ship.role === 'battleship'
  const wMul = { cathedral: 1, blade: 0.8, fortress: 1.28 }[design]
  const w = L * (bb ? 0.24 : ship.hits === 6 ? 0.19 : 0.22) * wMul, h = w / 2
  const prowEnd = L * ({ cathedral: 0.18, blade: 0.3, fortress: 0.15 }[design] + r() * 0.03), sternY = L * 0.84
  const parts = [...engines(L, h, sternY, bb ? 5 : ship.hits === 6 ? 2 : design === 'fortress' ? 5 : 4, dominion)]
  if (at(ship, 'prow').some(p => p.kind === 'sunburst')) parts.unshift(...sunburstCannon(L, h, L * 0.02, prowEnd))   // under everything
  parts.push(...fins(design, dominion, L, h), ...hullBody(design, dominion, L, h, prowEnd, sternY))
  parts.push(...broadside(ship, L, h, prowEnd + L * 0.04, L * 0.78, dominion, lance, L0))
  parts.push(...dorsal(ship, L, w, prowEnd + L * 0.06, L * 0.52, lance, L0 * 0.085, dominion))
  if (ship.id === 'sovereign') {
    // no armoured prow: a blunt sensor prow, whatever the design
    parts.push(poly('prow', [[-h, prowEnd], [-h * 0.75, L * 0.05], [h * 0.75, L * 0.05], [h, prowEnd]]), rect('deck', -h * 0.6, L * 0.07, h * 1.2, L * 0.06))
    for (let k = 0; k < 5; k++) parts.push(circ('glowCore', -h * 0.5 + k * h * 0.25, L * 0.1, h * 0.05))
  } else parts.push(...prow(design, dominion, L, h, prowEnd))
  parts.push(...prowWeapons(ship, L, h, dominion && design === 'cathedral' ? prowEnd * 0.3 : L * 0.02, prowEnd, lance, L0 * 0.07, dominion))
  const by = L * (0.62 + r() * 0.04)
  parts.push(...bridge(design, dominion, L, h, by))
  parts.push(...(dominion ? star(0, by - L * (design === 'blade' ? 0.18 : 0.13), h * 0.38) : aquila(0, by - L * (design === 'blade' ? 0.17 : 0.1), h * 0.55)))
  return parts
}

function star(cx, cy, R) {   // the eight-pointed star of Dominion
  const pts = []
  for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8 - Math.PI / 2, rr = i % 2 ? R * 0.38 : R; pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]) }
  return [poly('accent', pts), circ('hullDark', cx, cy, R * 0.22)]
}
function aquila(cx, cy, R) {   // a plain two-winged eagle mark
  return [poly('accent', [[cx, cy - R * 0.25], [cx + R, cy - R * 0.1], [cx + R * 0.5, cy + R * 0.12], [cx, cy + R * 0.05], [cx - R * 0.5, cy + R * 0.12], [cx - R, cy - R * 0.1]]),
    circ('trimDark', cx, cy - R * 0.08, R * 0.12)]
}

// ---------------- escorts ----------------
// Escorts are drawn so their weapons are obvious: an escort is a small capital ship in the same design (same prow, hull, fins, bridge and engines) built round its
// weapons, all pointing forward and drawn large for its size:
// a prow lance -> one big lance (the ship's lance version) down the spine, its tip past the prow
// prow torpedoes -> a launcher of two tubes on the prow, warheads showing
// a weapons battery -> Guard-style guns on sponsons either side (twin barrels from 4 firepower), a third on a
// spine turret when the firepower is odd
function escort(ship, design, lance) {
  const dominion = ship.fleet === 'dominion', L = 100 * sizeOf(ship) * HULL_GROWTH   // grown with the capital ships, so the fleet keeps its sizes
  const h = L * 0.14 * { cathedral: 1, blade: 0.82, fortress: 1.22 }[design], dw = L * 0.075
  const pe = L * { cathedral: 0.26, blade: 0.36, fortress: 0.22 }[design], sternY = L * 0.8
  const wpn = k => ship.weapons.find(w => w.kind === k)
  const bat = wpn('battery'), lan = wpn('lance'), tor = wpn('torpedo')
  const spineGun = bat && bat.str % 2 === 1
  const parts = [...engines(L, h * 0.85, sternY, design === 'fortress' ? 3 : 2, dominion), ...fins(design, dominion, L, h)]
  // sponsons: an armoured pod out beside the hull on a strut, its gun pointing forward past the prow
  const sy = L * 0.47, sx = -h - dw * 0.8, twin = bat && bat.str >= 4, g = dw * (twin ? 1.35 : 1.1), gw = dw * 1.2
  if (bat && bat.str >= 2) {
    parts.push(...both([rect('hullDark', -h - dw * 0.2, sy + dw * 0.5, dw * 0.5, dw * 0.9),                                   // the strut
      rect('hullDark', sx - g * 0.75, sy - dw * 0.15, g * 1.5, dw * 2.0), rect('hull', sx - g * 0.62, sy, g * 1.24, dw * 1.7),
      rect(dominion ? 'trimDark' : 'trim', sx - g * 0.75, sy + dw * 1.6, g * 1.5, dw * 0.2)]))
  }
  parts.push(...hullBody(design, dominion, L, h, pe, sternY))
  if (bat && bat.str >= 2) parts.push(...both(tag(forward(gun(0, 0, g, gw, twin, dominion), sx, sy + dw * 0.55), `W|${ship.weapons.indexOf(bat)}|0`, sx, sy + dw * 1.0, 0)))
  const by = L * 0.62
  parts.push(...bridge(design, dominion, L, h * 0.85, by))
  if (spineGun) {
    const ty = L * 0.5
    parts.push(circ('gunDark', 0, ty, dw * 0.85), circ(dominion ? 'trimDark' : 'trim', 0, ty, dw * 0.72), circ('gunMid', 0, ty, dw * 0.5),
      ...tag(forward(gun(0, 0, dw * 0.95, dw, false, dominion), 0, ty + dw * 0.45), `W|${ship.weapons.indexOf(bat)}|1`, 0, ty, 0))
  } else parts.push(...(dominion ? star(0, L * 0.53, h * 0.34) : aquila(0, L * 0.53, h * 0.5)))
  parts.push(...prow(design, dominion, L, h, pe))
  if (lan) {
    // the big lance: mounted where the prow meets the hull, reaching past the prow tip
    const big = dw * 1.7
    parts.push(rect('deck', -h * 0.45, pe - L * 0.01, h * 0.9, L * 0.07), ...tag(forward(lanceGun(lance, 0, 0, h * 1.5, big, dominion), 0, pe + L * 0.04), `W|${ship.weapons.indexOf(lan)}|0`, 0, pe + L * 0.04, 0))
  }
  if (tor) {
    const tw = dw * 0.6, len = dw * 2.3
    parts.push(...torpedoBank(-tw * 1.2, pe - len * 0.75, 2, tw, len, dominion))
  }
  return parts
}

// ---------------- the Dominion Derelict: a mass of rock and fused wrecks. One design. ----------------
function hulk(ship, lance) {
  const L = 100 * sizeOf(ship) * HULL_GROWTH, r = rng(ship.id), cy = L / 2, R = L * 0.36
  const pts = [], N = 30
  for (let i = 0; i < N; i++) { const a = i / N * Math.PI * 2, k = 0.72 + r() * 0.3; pts.push([Math.cos(a) * R * k * 0.95, cy + Math.sin(a) * R * k * 1.3]) }
  const parts = [...engines(L, R * 0.5, cy + R * 0.98, 3, true), poly('rock', pts)]
  parts.push(poly('rockLight', pts.map(([x, y]) => [x * 0.78 - R * 0.05, cy + (y - cy) * 0.78 - R * 0.05])))
  for (let i = 0; i < 14; i++) { const a = r() * Math.PI * 2, d = r() * R * 0.62; parts.push(circ('rockDark', Math.cos(a) * d, cy + Math.sin(a) * d * 1.2, R * (0.04 + r() * 0.08))) }
  for (let i = 0; i < 6; i++) {
    const x = (r() - 0.5) * R * 1.1, y = cy + (r() - 0.5) * R * 1.6, len = R * (0.35 + r() * 0.3), wd = len * 0.22, a = r() * Math.PI
    const c = Math.cos(a), s = Math.sin(a), q = (u, v) => [x + u * c - v * s, y + u * s + v * c]
    parts.push(poly(i % 2 ? 'hull' : 'hullDark', [q(-len / 2, -wd / 2), q(len / 2, -wd / 2), q(len / 2 + wd * 0.6, 0), q(len / 2, wd / 2), q(-len / 2, wd / 2)]))
    parts.push(poly('prow', [q(len / 2, -wd / 2), q(len / 2 + wd * 0.6, 0), q(len / 2, wd / 2)]))
    parts.push(poly('window', [q(-len * 0.3, -wd * 0.1), q(len * 0.3, -wd * 0.1), q(len * 0.3, wd * 0.1), q(-len * 0.3, wd * 0.1)]))
  }
  for (let i = 0; i < 16; i++) { const [x, y] = pts[(i * 2) % N]; parts.push(circ('port', x * 0.88, cy + (y - cy) * 0.88, R * 0.03)) }
  // its four dorsal lances, side by side on the rock, pointing forward, in the ship's lance version
  for (let k = 0; k < 4; k++) { const x = (k - 1.5) * R * 0.25, dw = R * 0.13
    parts.push(circ('gunDark', x, cy - R * 0.2, dw * 0.62), circ('trimDark', x, cy - R * 0.2, dw * 0.5), ...forward(reach(lanceGun(lance, 0, 0, R * 0.25, dw, true), 0), x, cy - R * 0.2)) }
  parts.push(...star(0, cy + R * 0.25, R * 0.22))
  return parts
}

// ---------------- ordnance counters (one design) ----------------
function ordnance(o) {
  const L = 30, h = L * 0.3
  switch (o.kind) {
    case 'fighter': return [poly('hull', [[0, 0], [h * 1.3, L * 0.8], [0, L * 0.65], [-h * 1.3, L * 0.8]]), poly('prow', [[0, 0], [h * 0.3, L * 0.3], [-h * 0.3, L * 0.3]]), poly('trim', [[0, L * 0.3], [h * 0.3, L * 0.55], [-h * 0.3, L * 0.55]]), rect('window', -h * 0.08, L * 0.32, h * 0.16, L * 0.08), rect('glow', -h * 0.2, L * 0.66, h * 0.4, L * 0.14)]
    case 'bomber': return [poly('hull', [[0, 0], [h * 0.6, L * 0.3], [h * 1.6, L * 0.6], [h * 1.4, L * 0.8], [-h * 1.4, L * 0.8], [-h * 1.6, L * 0.6], [-h * 0.6, L * 0.3]]), rect('hullDark', -h * 0.35, L * 0.2, h * 0.7, L * 0.6), poly('prow', [[0, 0], [h * 0.45, L * 0.22], [-h * 0.45, L * 0.22]]), rect('window', -h * 0.15, L * 0.24, h * 0.3, L * 0.06), rect('glow', -h * 0.9, L * 0.8, h * 0.4, L * 0.1), rect('glow', h * 0.5, L * 0.8, h * 0.4, L * 0.1)]
    case 'assault boat': return [poly('hull', [[0, 0], [h, L * 0.25], [h, L * 0.8], [-h, L * 0.8], [-h, L * 0.25]]), poly('prow', [[0, 0], [h, L * 0.25], [-h, L * 0.25]]), rect('bay', -h * 0.5, L * 0.35, h, L * 0.25), rect('glow', -h * 0.5, L * 0.8, h, L * 0.1)]
    // the Concord's gunships: a small Dyad, two hulls and a lit core. "Heavily armoured ... flexible weaponry ... a prickly proposition"; the Annihilator gives its transport space to one great cannon
    case 'dropwing': case 'dropwing breaker': {
      const big = o.kind !== 'dropwing', out = both([poly('hull', [[-h * 0.55, 0], [-h * 1.5, L * 0.82], [-h * 0.12, L * 0.82]]), poly('hullLight', [[-h * 0.55, L * 0.1], [-h * 0.8, L * 0.8], [-h * 0.12, L * 0.8]]), poly('prow', [[-h * 0.55, 0], [-h * 0.75, L * 0.2], [-h * 0.36, L * 0.2]]), rect('barrel', -h * 1.2, L * 0.34, h * 0.18, L * 0.3), rect('glow', -h * 0.9, L * 0.82, h * 0.5, L * 0.12)])
      out.push(rect('glow', -h * 0.07, L * 0.3, h * 0.14, L * 0.5), poly('hullDark', [[0, L * 0.26], [-h * 0.34, L * 0.5], [0, L * 0.74], [h * 0.34, L * 0.5]]), rect('window', -h * 0.12, L * 0.44, h * 0.24, L * 0.06))
      if (big) out.push(rect('gunDark', -h * 0.2, -L * 0.04, h * 0.4, L * 0.54), rect('barrel', -h * 0.08, -L * 0.04, h * 0.16, L * 0.5), rect('gunDark', -h * 0.28, -L * 0.08, h * 0.56, L * 0.06))
      return out
    }
    // the Rukka's craft: little horseshoes. Buzza, assault boat with its "piercing beak", tin-fisher carrying its torpedo
    case 'shoe fighter': case 'shoe boat': case 'shoe bomber': {
      const a = (R, d) => [-Math.sin(d * Math.PI / 180) * R * 0.86, L * 0.46 - Math.cos(d * Math.PI / 180) * R], arc = (R, x, y) => Array.from({ length: 13 }, (_, i) => a(R, x + (y - x) * i / 12))
      const out = both([poly('hull', [...arc(L * 0.42, 0, 140), ...arc(L * 0.2, 140, 0)]), poly('hullLight', [...arc(L * 0.32, 0, 140), ...arc(L * 0.22, 140, 0)]), poly('prow', [...arc(L * 0.42, 0, 42), ...arc(L * 0.2, 42, 0)]), rect('glow', -L * 0.34, L * 0.74, h * 0.7, L * 0.14)])
      if (o.kind === 'shoe boat') out.unshift(poly('prowDark', [[0, -L * 0.12], [-h * 0.8, L * 0.2], [h * 0.8, L * 0.2]]))
      if (o.kind === 'shoe bomber') out.push(rect('metal', -h * 0.26, L * 0.24, h * 0.52, L * 0.46), poly('trim', [[0, L * 0.14], [-h * 0.26, L * 0.24], [h * 0.26, L * 0.24]]))
      return out
    }
    // the Athanatoi's craft: little bone skulls, one burning eye, two threads of sail. The bomber is broader, the raider carries a beak, the torpedo bomber its torpedo
    case 'hunt fighter': case 'hunt bomber': case 'hunt raider': case 'hunt torpedo bomber': {
      const w = o.kind === 'hunt bomber' ? h * 1.15 : h * 0.8, skull = [[0, L * 0.04], [-w * 0.5, L * 0.2], [-w, L * 0.46], [-w * 0.74, L * 0.74], [0, L * 0.84]], out = both([poly('prow', [[-w * 0.5, L * 0.5], [-w * 1.9, L * 0.92], [-w * 1.5, L * 0.98], [-w * 0.4, L * 0.72]]), poly('hull', skull), poly('hullLight', skull.map(([x, y]) => [x * 0.5, y]))])
      out.push(circ('bay', w * 0.42, L * 0.42, h * 0.2), circ('glow', -w * 0.42, L * 0.42, h * 0.2), circ('glowCore', -w * 0.42, L * 0.42, h * 0.09), rect('hullDark', -0.5, L * 0.12, 1, L * 0.2))
      if (o.kind === 'hunt raider') out.unshift(poly('trim', [[0, -L * 0.14], [-h * 0.34, L * 0.12], [h * 0.34, L * 0.12]]))
      if (o.kind === 'hunt torpedo bomber') out.push(rect('metal', -h * 0.22, L * 0.5, h * 0.44, L * 0.42), poly('prow', [[0, L * 0.4], [-h * 0.22, L * 0.5], [h * 0.22, L * 0.5]]))
      return out
    }
    // the Thnitoi's craft: little dark knives; the bomber two, side by side, the assault boat a net-shaped barb, the Harpoon one long spike
    case 'knife fighter': case 'knife bomber': case 'knife boat': case 'knife torpedo bomber': case 'knife harpoon': {
      const w = o.kind === 'knife bomber' ? h * 1.2 : h * 0.7, out = both([poly('hull', [[0, 0], [-w, L * 0.84], [-w * 0.2, L * 0.7]]), poly('trim', [[0, 0], [-w, L * 0.84], [-w + 0.6, L * 0.84]]), rect('glow', -w * 0.6, L * 0.74, w * 0.3, L * 0.1)])
      out.push(rect('glow', -0.4, L * 0.1, 0.8, L * 0.6))
      if (o.kind === 'knife boat') out.push(...both([poly('prow', [[-w * 0.3, L * 0.34], [-w * 1.5, L * 0.3], [-w * 0.6, L * 0.5]])]))
      if (o.kind === 'knife harpoon') out.unshift(poly('barrel', [[0, -L * 0.3], [-h * 0.2, L * 0.2], [h * 0.2, L * 0.2]]))
      if (o.kind === 'knife torpedo bomber') out.push(rect('metal', -h * 0.2, L * 0.4, h * 0.4, L * 0.44))
      return out
    }
    // the Phage's craft: a tiny spine and ribs round a lit core; the assault brood adds claws, the torpedo is a pod, the mine a spiked ball
    case 'cage fighter': case 'cage boat': {
      const out = [circ('prow', 0, L * 0.46, h * 0.56), circ('glow', 0, L * 0.46, h * 0.28), rect('hull', -0.8, 0, 1.6, L * 0.9)]
      for (const y of [0.24, 0.44, 0.64]) out.push(...both([poly('hull', [[0, L * y], [-h * 1.2, L * (y + 0.06)], [-h * 1.2, L * (y + 0.12)], [0, L * (y + 0.06)]])]))
      if (o.kind === 'cage boat') out.push(...both([poly('barrel', [[-1, L * 0.2], [-h * 0.9, L * 0.04], [-h * 0.4, -L * 0.1], [-h * 0.5, L * 0.08]])]))
      return out
    }
    case 'cage torpedo': return [circ('prowDark', 0, L * 0.5, h), circ('prow', 0, L * 0.5, h * 0.8), circ('hull', 0, L * 0.34, h * 0.4), poly('hull', [[0, 0], [-h * 0.4, L * 0.3], [h * 0.4, L * 0.3]]), circ('glow', 0, L * 0.86, h * 0.34)]
    case 'cage mine': { const out = []; for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; out.push(poly('hull', [[Math.sin(a) * L * 0.5, L * 0.5 - Math.cos(a) * L * 0.5], [Math.sin(a + 0.5) * h, L * 0.5 - Math.cos(a + 0.5) * h], [Math.sin(a - 0.5) * h, L * 0.5 - Math.cos(a - 0.5) * h]])) } out.push(circ('prowDark', 0, L * 0.5, h * 1.1), circ('prow', 0, L * 0.5, h * 0.9), circ('glow', 0, L * 0.5, h * 0.4)); return out }
    // the Isos' craft: a little rounded square; the fighter small and plain, the Delta wider with a stripe
    case 'ring fighter': case 'ring bomber': { const w = o.kind === 'ring bomber' ? h * 1.5 : h, out = [softRect('hullDark', -w - 1, L * 0.14 - 1, w * 2 + 2, L * 0.62 + 2, w * 0.4), softRect('hull', -w, L * 0.14, w * 2, L * 0.62, w * 0.36), softRect('hullLight', -w * 0.7, L * 0.2, w * 1.2, L * 0.4, w * 0.24), rect('glow', -w * 0.6, L * 0.76, w * 0.4, L * 0.1), rect('glow', w * 0.2, L * 0.76, w * 0.4, L * 0.1)]; if (o.kind === 'ring bomber') out.push(rect('prow', -w * 0.8, L * 0.5, w * 1.6, L * 0.05)); return out }
    case 'torpedo': case 'boarding torpedo': {
      const big = o.kind === 'boarding torpedo', out = []
      for (const x of big ? [0] : [-h * 0.8, 0, h * 0.8]) out.push(rect('metal', x - h * (big ? 0.45 : 0.28), L * 0.15, h * (big ? 0.9 : 0.56), L * 0.6), poly('prow', [[x, 0], [x + h * (big ? 0.45 : 0.28), L * 0.15], [x - h * (big ? 0.45 : 0.28), L * 0.15]]), rect('glow', x - h * 0.2, L * 0.75, h * 0.4, L * 0.18))
      return out
    }
  }
  return []
}

export function bounds(parts) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  const add = (x, y) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y) }
  for (const p of parts) {
    if (p.s === 'poly') p.pts.forEach(([x, y]) => add(x, y))
    else if (p.s === 'rect') { add(p.x, p.y); add(p.x + p.w, p.y + p.h) }
    else { add(p.cx - p.r, p.cy - p.r); add(p.cx + p.r, p.cy + p.r) }
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

// ---------------- THE CONCORD ----------------
// The same guns, decks, torpedo banks and engines as the Freemen and Dominion ships, on the Concord's own hull. From the lore: a line of light
// down the keel (the Binding, the Concord's emblem), and hulls in two halves (the Dyad).
// one band of a hull between two lengths
const bandOf = (pts, y0, y1) => {
  const clip = (ps, keep, cut) => ps.flatMap((p, i) => { const q = ps[(i + 1) % ps.length], a = keep(p), b = keep(q), r = []; if (a) r.push(p); if (a !== b) { const t = (cut - p[1]) / (q[1] - p[1]); r.push([p[0] + (q[0] - p[0]) * t, cut]) } return r })
  return clip(clip(pts, p => p[1] >= y0, y0), p => p[1] <= y1, y1)
}
// the Binding, the Concord's emblem: two half rings, a line of light between them, a lit core
function binding(cx, cy, R) {
  const arc = r => Array.from({ length: 9 }, (_, i) => { const a = -Math.PI / 2 + i * Math.PI / 8; return [Math.cos(a) * r, Math.sin(a) * r] })
  const half = [...arc(R).map(([x, y]) => [cx - R * 0.1 - x, cy + y]), ...arc(R * 0.68).reverse().map(([x, y]) => [cx - R * 0.1 - x, cy + y])]
  return [...both([poly('accent', half)]), rect('glow', cx - R * 0.06, cy - R * 1.08, R * 0.12, R * 2.16), circ('hullDark', cx, cy, R * 0.34), circ('glow', cx, cy, R * 0.23), circ('glowCore', cx, cy, R * 0.12)]
}
// a bombardment cannon: a great squat turret, two short thick barrels, pointing ahead
function bombard(ship, w, y, r, k) {
  const b = r * 0.34, key = `W|${ship.weapons.indexOf(w)}|${k}`
  return [circ('gunDark', 0, y, r * 1.12), circ('trim', 0, y, r * 0.96), ...tag([circ('gunMid', 0, y, r * 0.74),
    ...[-r * 0.36, r * 0.36].flatMap(x => [rect('gunDark', x - b / 2 - 0.5, y - r * 1.9, b + 1, r * 1.5), rect('barrel', x - b * 0.3, y - r * 1.85, b * 0.6, r * 1.35), rect('gunDark', x - b * 0.8, y - r * 2.05, b * 1.6, r * 0.34)]),
    circ('gunDark', 0, y, r * 0.3)], key, 0, y, 0)]
}
// port-side guns stepped down the slope: each on its own terrace, out at the hull's edge where it stands
function terraces (ship, hAt, y0, y1, dw, lance) {
  const side = at(ship, 'port'), out = [], seg = (y1 - y0) / Math.max(1, side.length)
  side.forEach((w, i) => {
    const a = y0 + i * seg, b = y0 + (i + 1) * seg
    if (w.kind === 'bays') return
    if (w.kind === 'bombardment') {   // the Writ of Order's broadsides: great turrets on the slope, two barrels out over the side
      const n = 3, step = (b - a) / n, r = dw * 0.62, bw = r * 0.3
      for (let k = 0; k < n; k++) {
        const y = a + (k + 0.5) * step, x = -hAt(y) + r * 0.5
        out.push(circ('gunDark', x, y, r * 1.12), circ('trim', x, y, r * 0.96), ...tag([circ('gunMid', x, y, r * 0.74),
          ...[-r * 0.34, r * 0.34].flatMap(o => [rect('gunDark', x - r * 1.85, y + o - bw * 0.7, r * 1.5, bw * 1.4), rect('barrel', x - r * 1.8, y + o - bw * 0.25, r * 1.4, bw * 0.5), rect('gunDark', x - r * 2, y + o - bw, r * 0.32, bw * 2)]),
          circ('gunDark', x, y, r * 0.3)], `P|${i}|${k}`, x, y))
      }
      return
    }
    const n = w.kind === 'lance' ? Math.min(w.str, 4) : Math.max(2, Math.min(6, Math.ceil(w.str / 2))), step = (b - a) / n, g = Math.min(step * 0.5, dw * 0.9), twin = w.str >= 10
    for (let k = 0; k < n; k++) {
      const y = a + (k + 0.5) * step, h = hAt(y), inset = Math.abs(h - hAt(y - step / 2)) + 1
      out.push(rect('deck', -h - dw * 0.42, y - g * 0.75, dw * 0.42 + inset, g * 1.5), rect('gunMid', -h - dw * 0.42, y - g * 0.75, dw * 0.08, g * 1.5), rect('trim', -h - dw * 0.42, y + g * 0.75, dw * 0.42 + inset, 1))
      if (w.kind === 'lance') out.push(...tag(reach(lanceGun(lance, -h - dw * 0.5, y, step * 0.8, dw, false), -h - dw * 0.5), `P|${i}|${k}`, -h - dw * 0.5, y))
      else out.push(...tag(reach(gun(-h - dw * 0.05, y, g, dw * 0.8, twin, false), -h - dw * 0.05), `P|${i}|${k}`, -h - dw * 0.4, y))
    }
  })
  return both(out)
}

// ---------------- THE DYAD: THE CONCORD'S HULL ----------------
// Two slim hulls side by side, joined at a core, a line of light between them. Launch bays sit in the hulls, each hull has its own engines,
// and each hull is two clean facets with seams. Every gun is the ship's real weapon.
const shift = (parts, dx, dy) => parts.map(p => p.s === 'rect' ? { ...p, x: p.x + dx, y: p.y + dy } : p.s === 'circ' ? { ...p, cx: p.cx + dx, cy: p.cy + dy } : { ...p, pts: p.pts.map(([x, y]) => [x + dx, y + dy]) })
// turned round the origin: a rect becomes a polygon, so any angle works
function spin (parts, deg) {
  const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), r = ([x, y]) => [x * c - y * s, x * s + y * c]
  return parts.map(p => { const q = { ...p }; if (p.s === 'circ') { [q.cx, q.cy] = r([p.cx, p.cy]); return q }
    const pts = p.s === 'rect' ? [[p.x, p.y], [p.x + p.w, p.y], [p.x + p.w, p.y + p.h], [p.x, p.y + p.h]] : p.pts; return { s: 'poly', f: p.f, pts: pts.map(r) } })
}
// one slim hull of a pair, port side, tip at y = 0: two long facets either side of a ridge, seams across them, armoured tip. seams in lengths.
function blade (L, H, stern, gap, tipX, prowEnd, seams) {
  const hull = [[-tipX, 0], [-H, stern], [-gap, stern]], rs = (H + gap) / 2
  const ridge = y => tipX + (rs - tipX) * y / stern, out = [poly('hull', hull), poly('panel', [[-tipX, 0], [-H, stern], [-rs, stern]]), poly('hullLight', [[-tipX, 0], [-rs, stern], [-gap, stern]])]
  for (const t of seams) out.push(poly('hullDark', bandOf(hull, L * t, L * t + Math.max(1.6, L * 0.007))))
  seams.forEach((t, i) => { const y0 = L * t + L * 0.02, y1 = (seams[i + 1] ?? stern / L - 0.03) * L - L * 0.012; if (y1 - y0 < L * 0.04) return
    const w = (y1 - y0) * 0.2, x = -ridge((y0 + y1) / 2); out.push(poly('hullDark', [[x, y0], [x - w, y1], [x + w, y1]]), poly('trimDark', [[x, y0 + (y1 - y0) * 0.4], [x - w * 0.5, y1 - 1], [x + w * 0.5, y1 - 1]])) })
  const edge = 2.4, sl = (H - tipX) / stern
  out.push(poly('trim', [[-tipX, 0], [-H, stern], [-H + edge, stern], [-tipX + edge * 0.5, edge * 0.5 / Math.max(0.2, sl) * 0.2]]), poly('trim', [[-tipX, 0], [-gap, stern], [-gap - 1.6, stern], [-tipX - 0.8, 1]]))
  for (let y = prowEnd + L * 0.03; y < stern - L * 0.06; y += L * 0.03) out.push(rect('window', -(tipX + (H - tipX) * y / stern) + 4.2, y, 1.8, 1.2))
  out.push(poly('hullDark', bandOf(hull, stern - L * 0.04, stern)))
  const tip = bandOf(hull, 0, prowEnd), mid = tipX + (rs - tipX) * prowEnd / stern
  out.push(poly('prow', tip), poly('prowLight', [[-tipX, L * 0.015], [-mid, prowEnd], [-(tipX + (gap - tipX) * prowEnd / stern), prowEnd]]), poly('trim', bandOf(hull, prowEnd, prowEnd + Math.max(1.4, L * 0.01))))
  return out
}
// a launch bay's mouth (all in the prow), the width of the hull it sits in, lit along its lip
const mouth = (x, y, w, h) => [rect('trimDark', x - w / 2 - 1, y - 1, w + 2, h + 2), rect('bay', x - w / 2, y, w, h), rect('glow', x - w / 2, y, w, 1.3)]

function dyad (ship, lance) {
  if (ship.role === 'fortress') return fortWhole(ship, lance)
  const esc = ship.type === 'escort', bb = ship.role === 'battleship', L0 = 100 * sizeOf(ship), L = L0 * HULL_GROWTH, dw = L0 * (esc ? 0.08 : 0.07)
  // courier escorts carry the same guns as the frigates (Sword as Dirk, Adder as Hunter), so they get a narrower hull, its two tips closer together, to tell them apart
  const rapid = ship.id.startsWith('con-rsv'), H = L * (rapid ? 0.25 : esc ? 0.3 : bb ? 0.24 : 0.27), stern = L * 0.86, gap = H * 0.12, tipX = H * (rapid ? 0.42 : 0.58), prowEnd = L * (esc ? 0.22 : 0.2)
  const outX = y => tipX + (H - tipX) * y / stern, inX = y => tipX + (gap - tipX) * y / stern, midX = y => (outX(y) + inX(y)) / 2, wide = y => outX(y) - inX(y), rs = (H + gap) / 2
  const parts = [], idx = w => ship.weapons.indexOf(w)
  const has = kind => ship.weapons.filter(w => w.loc === 'prow' && w.kind === kind)
  // each hull its own engines, a bar across the gap between them
  parts.push(...both(shift(engines(L, (H - gap) * 0.46, stern - L * 0.02, esc ? 1 : bb ? 3 : 2, false), -rs, 0)))
  // the gap: the light down the keel, starting at the first bridge and no further forward; the bridges that hold the two hulls together
  const fore = L * (esc ? 0.36 : 0.3)
  parts.push(rect('deck', -H * 0.1, fore, H * 0.2, stern - fore), rect('glow', -H * 0.05, fore, H * 0.1, stern - fore), rect('glowCore', -H * 0.022, fore, H * 0.044, stern - fore))
  for (const t of esc ? [0.36, 0.66] : [0.3, 0.5, 0.7]) parts.push(rect('hullDark', -H * 0.56, L * t, H * 1.12, L * 0.035), rect('trimDark', -H * 0.56, L * t + L * 0.012, H * 1.12, L * 0.008))
  parts.push(...both(blade(L, H, stern, gap, tipX, prowEnd, esc ? [0.46, 0.66] : [0.36, 0.5, 0.64])))
  // the core: the plate the two hulls meet at, carrying the great guns and the bridge
  const cw = H * (esc ? 0.3 : 0.27), cTop = L * (esc ? 0.38 : 0.3), cEnd = L * 0.84
  parts.push(poly('hullDark', [[0, cTop], [-cw, cTop + L * 0.1], [-cw, L * 0.68], [0, cEnd], [cw, L * 0.68], [cw, cTop + L * 0.1]]),
    poly('hull', [[0, cTop + 4], [-cw + 3, cTop + L * 0.1], [-cw + 3, L * 0.67], [0, cEnd - 5], [cw - 3, L * 0.67], [cw - 3, cTop + L * 0.1]]))
  // broadsides stepped down the outer slopes
  if (!esc) parts.push(...terraces(ship, outX, prowEnd + L * 0.1, stern - L * 0.05, dw, lance))
  // torpedoes: a bank in the nose of each hull, or one tube on the keel if the salvo is a single torpedo
  for (const w of has('torpedo')) {
    const tw = dw * (esc ? 0.5 : 0.42), len = dw * (esc ? 1.5 : 2.3), y = prowEnd + L * 0.02 - len * 0.2
    if (w.str < 2) parts.push(...torpedoBank(-tw * 0.7, cTop + L * 0.03, 1, tw, len, false))
    else { const k = esc ? 1 : 2, W = k * tw + tw * 0.4; parts.push(...both(torpedoBank(-midX(y + len * 0.5) - W / 2, y, k, tw, len, false))) }
  }
  // launch bays: one mouth to a squadron, a pair across the two hulls, an odd one on the first bridge
  for (const w of has('bays')) {
    const each = Math.floor(w.str / 2), y0 = L * 0.33, gapY = L * 0.05
    for (let k = 0; k < each; k++) { const y = y0 + k * gapY, m = wide(y) * 0.62; parts.push(...both(mouth(-midX(y), y, m, L * 0.024))) }
    if (w.str % 2) parts.push(...mouth(0, fore + L * 0.004, H * 0.34, L * 0.024))
  }
  // down the core: bombardment cannon, or a lance, one behind the other from the front of the core
  let y = L * (esc ? 0.5 : 0.41)
  const r = L0 * 0.055
  for (const w of ship.weapons.filter(w => w.kind === 'bombardment' && w.loc !== 'port' && w.loc !== 'starboard')) {
    const n = w.loc === 'dorsal' ? 2 : 1
    for (let k = 0; k < n; k++) { parts.push(...bombard(ship, w, y, r, k)); y += L * 0.115 }
  }
  for (const w of has('lance')) {
    const fw = dw * (esc ? 1.1 : 1.15), my = esc ? L * 0.56 : y + L * 0.03
    parts.push(circ('gunDark', 0, my, fw * 0.62), circ('trim', 0, my, fw * 0.5), ...tag(forward(reach(lanceGun(lance, 0, 0, H * 0.7, fw, false), 0), 0, my), `W|${idx(w)}|0`, 0, my, 0))
    y += L * 0.115
  }
  // an escort's guns face forward: a gun on each hull, twin at firepower 4, a single one on the keel at firepower 1
  if (esc) for (const w of has('battery')) {
    const g = dw * 1.05, gy = L * 0.58
    if (w.str < 2) parts.push(circ('gunDark', 0, gy, g * 0.62), ...tag(forward(gun(0, 0, g, g, false, false), 0, gy), `W|${idx(w)}|0`, 0, gy, 0))
    else parts.push(...both([rect('hullDark', -midX(gy) - g * 0.62, gy - dw * 0.1, g * 1.24, dw * 1.5), rect('trim', -midX(gy) - g * 0.62, gy + dw * 1.3, g * 1.24, dw * 0.2),
      ...tag(forward(gun(0, 0, g, g, w.str >= 4, false), -midX(gy), gy + dw * 0.5), `W|${idx(w)}|0`, -midX(gy), gy + dw * 0.9, 0)]))
  }
  // the Binding before the bridge, the bridge a stepped triangle at the tail of the core
  const by = L * (esc ? 0.72 : 0.74), bw = H * (esc ? 0.3 : 0.27)
  if (!esc) parts.push(...binding(0, L * 0.635, H * 0.15))
  parts.push(poly('hullDark', [[0, by - L * 0.1], [-bw, by + L * 0.09], [bw, by + L * 0.09]]), poly('hullLight', [[0, by - L * 0.07], [-bw * 0.74, by + L * 0.075], [bw * 0.74, by + L * 0.075]]), poly('trim', [[0, by - L * 0.03], [-bw * 0.44, by + L * 0.045], [bw * 0.44, by + L * 0.045]]))
  for (let k = 0; k < 4; k++) parts.push(rect('window', -bw * 0.36 + k * bw * 0.25, by + L * 0.055, bw * 0.14, L * 0.009))
  return parts
}

// THE FORTS, in pieces: four quadrants round a central basilica, docking piers between them.
// fortPieces draws the quadrant that faces north (tip up) about the fort's centre at (0, 0), one pier (the arm 45 degrees clockwise of it) and the basilica, in
// drawing units where the fort's radius R is 6 cm on the table (rules/fort.js: the quadrant bases are 4.24 cm out and touch). The whole-fort picture turns the quadrant
// four times; the battle draws a quadrant on its own (fortQuadrant), so four quadrant pieces never stack as four whole fortresses.
const basilicaParts = (R, r0, dw) => {
  const plain = ps => ps.filter(p => p.f !== 'mark').map(({ m, ...p }) => p), out = []
  out.push(circ('hullDark', 0, 0, r0 * 1.08), circ('trim', 0, 0, r0 * 1.02), circ('hull', 0, 0, r0 * 0.96), circ('panel', 0, 0, r0 * 0.72), circ('trimDark', 0, 0, r0 * 0.64), circ('hullLight', 0, 0, r0 * 0.6))
  for (let k = 0; k < 8; k++) out.push(...spin(plain(forward(gun(0, 0, dw * 0.8, dw * 0.8, false, false), 0, -r0 * 0.74)), 22.5 + k * 45))
  for (let k = 0; k < 9; k++) { const a = k * 2 * Math.PI / 9; out.push(circ('trimDark', Math.sin(a) * r0 * 0.46, -Math.cos(a) * r0 * 0.46, r0 * 0.07), circ('bay', Math.sin(a) * r0 * 0.46, -Math.cos(a) * r0 * 0.46, r0 * 0.05)) }
  out.push(...binding(0, 0, r0 * 0.26))
  return out
}
const pierParts = (R, r0) => [rect('hullDark', -R * 0.03, -R * 0.92, R * 0.06, R * 0.92 - r0), rect('trim', -1, -R * 0.92, 2, R * 0.92 - r0), rect('hull', -R * 0.1, -R * 0.94, R * 0.2, R * 0.05), rect('window', -R * 0.08, -R * 0.92, R * 0.16, 2)]
function dyadFortPieces (ship, lance) {
  const L = 100 * sizeOf(ship) * HULL_GROWTH, R = L / 2, r0 = R * 0.34, Q = R - r0 + R * 0.06, H = Q * 0.46, stern = Q, gap = H * 0.1, tipX = H * 0.58, dw = R * 0.05
  const plain = ps => ps.filter(p => p.f !== 'mark').map(({ m, ...p }) => p), outX = y => tipX + (H - tipX) * y / stern
  const q = [], guns = { weapons: ship.weapons.filter(w => w.loc === 'quadrant' && w.kind !== 'bays').map(w => ({ ...w, loc: 'port' })) }
  q.push(rect('deck', -H * 0.1, Q * 0.3, H * 0.2, Q * 0.7), rect('glow', -H * 0.05, Q * 0.3, H * 0.1, Q * 0.7), rect('glowCore', -H * 0.022, Q * 0.3, H * 0.044, Q * 0.7))
  for (const t of [0.3, 0.6]) q.push(rect('hullDark', -H * 0.56, Q * t, H * 1.12, Q * 0.05), rect('trimDark', -H * 0.56, Q * t + Q * 0.018, H * 1.12, Q * 0.012))
  q.push(...both(blade(Q, H, stern, gap, tipX, Q * 0.2, [0.42, 0.62, 0.8])), ...plain(terraces(guns, outX, Q * 0.36, Q * 0.88, dw, lance)))
  for (let k = 0; k < 3; k++) q.push(...mouth(0, Q * (0.38 + k * 0.11), H * 0.22, Q * 0.05))
  return { R, r0, quad: shift(q, 0, -R - R * 0.06), pier: spin(pierParts(R, r0), 45), basilica: basilicaParts(R, r0, dw) }
}
// The Bastion class star fort: a blunt bastion for a quadrant (a stepped, armoured wedge with a gun terrace, a lance trench and its bay), the Dominion fort's studded with spikes.
function bastionFortPieces (ship) {
  const dominion = ship.fleet === 'dominion', L = 100 * sizeOf(ship) * HULL_GROWTH, R = L / 2, r0 = R * 0.34, dw = R * 0.05, T = -R - R * 0.06, B = -r0
  const left = [[0, 0], [-0.14, 0.1], [-0.3, 0.26], [-0.34, 0.5], [-0.24, 0.72]].map(([x, f]) => [x * R, T + f * R])
  const hullPts = [...left, ...left.slice(1).reverse().map(([x, y]) => [-x, y])]
  const q = [poly('hullDark', hullPts.map(([x, y]) => [x * 1.08, y])), poly('hull', hullPts)]
  q.push(poly('hullLight', [[0, T + R * 0.05], [-R * 0.26, T + R * 0.3], [-R * 0.04, T + R * 0.3]]), poly('panel', [[0, T + R * 0.05], [R * 0.26, T + R * 0.3], [R * 0.04, T + R * 0.3]]))
  q.push(poly('prow', [[0, T], [-R * 0.14, T + R * 0.1 - 1], [R * 0.14, T + R * 0.1 - 1]]), poly('prowLight', [[0, T + 3], [-R * 0.08, T + R * 0.1 - 2], [0, T + R * 0.1 - 2]]))
  for (let k = 0; k < 4; k++) q.push(rect('trimDark', -R * 0.3, T + R * (0.3 + k * 0.1), R * 0.6, R * 0.015), rect('window', -R * 0.26, T + R * (0.32 + k * 0.1), R * 0.1, R * 0.012), rect('window', R * 0.16, T + R * (0.32 + k * 0.1), R * 0.1, R * 0.012))
  q.push(rect('deck', -R * 0.035, T + R * 0.16, R * 0.07, R * 0.32), rect('glow', -R * 0.018, T + R * 0.16, R * 0.036, R * 0.32), rect('glowCore', -R * 0.007, T + R * 0.16, R * 0.014, R * 0.32))   // the lance trench
  for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) { const cx = sx * R * 0.2, cy = T + R * (0.3 + k * 0.1) + R * 0.03
    q.push(circ('gunDark', cx, cy, dw * 0.9), circ('gunMid', cx, cy, dw * 0.7), rect('barrel', cx - dw * 0.15, cy - dw * 1.9, dw * 0.3, dw * 1.7)) }
  q.push(...mouth(0, B - R * 0.12, R * 0.2, R * 0.04))
  if (dominion) for (let k = 0; k < 6; k++) { const y = T + R * (0.2 + k * 0.08); for (const sx of [-1, 1]) q.push(poly('prowDark', [[sx * R * (0.19 + k * 0.02), y], [sx * R * (0.3 + k * 0.012), y - R * 0.05], [sx * R * (0.29 + k * 0.012), y + R * 0.02]])) }
  return { R, r0, quad: q, pier: spin(pierParts(R, r0), 45), basilica: basilicaParts(R, r0, dw) }
}
const fortPieces = (ship, lance) => ship.fleet === 'concord' ? dyadFortPieces(ship, lance) : bastionFortPieces(ship)
/** The whole fort in one picture: the quadrant four times round the basilica. */
function fortWhole (ship, lance) {
  const P = fortPieces(ship, lance)
  return shift([0, 90, 180, 270].flatMap(a => [...spin(P.pier, a), ...spin(P.quad, a)]).concat(P.basilica), 0, P.R)
}
export const FORT_PICTURE_CM = 13.2   // the side of a quadrant's picture on the table: 2.2 R with R = 6 cm (a quadrant stands 4.24 cm out)
const fortCache = new Map()
/**
 * One quadrant of a fort, prow (outward) up, in a square picture centred on the quadrant's own base so the battle draws it exactly where the ship is, FORT_PICTURE_CM wide.
 * It carries the pier to its clockwise side, and the basilica when `basilica` is set (the quadrant that holds it, rules/fort.js basilicaHolder). No padding: the scale is fixed.
 */
export function fortQuadrant (id, { basilica = false } = {}) {
  const key = id + (basilica ? '+b' : '')
  if (fortCache.has(key)) return fortCache.get(key)
  const ship = shipById(id) ?? CONCORD_SHIPS.find(s => s.id === id)
  if (!ship?.fort) throw new Error(`fortQuadrant: ${id} is not a fort`)
  const P = fortPieces(ship, DEFAULT_LANCE), c = -P.R * 0.7067, h = P.R * 1.1
  const out = { id, fleet: ship.fleet, kind: 'ship', parts: [...P.pier, ...P.quad, ...(basilica ? P.basilica : [])], box: { x: -h, y: c - h, w: 2 * h, h: 2 * h }, mounts: [], exact: true }
  fortCache.set(key, out)
  return out
}
// a smooth line through the points (Catmull-Rom), kept on the port side
function smoothLine (pts, n = 6) {
  const out = []
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[i], c = pts[i + 1], d = pts[Math.min(pts.length - 1, i + 2)]
    for (let k = 0; k < n; k++) { const t = k / n, f = j => 0.5 * (2 * b[j] + (c[j] - a[j]) * t + (2 * a[j] - 5 * b[j] + 4 * c[j] - d[j]) * t * t + (3 * b[j] - a[j] - 3 * c[j] + d[j]) * t * t * t); out.push([Math.min(0, f(0)), f(1)]) }
  }
  out.push(pts.at(-1))
  return out
}
// a ring, or a part of one: angles in degrees clockwise from dead ahead
const arcPts = (cx, cy, R, a0, a1, n = 32) => Array.from({ length: n + 1 }, (_, i) => { const a = (a0 + (a1 - a0) * i / n) * Math.PI / 180; return [cx + Math.sin(a) * R, cy - Math.cos(a) * R] })
const hoop = (f, cx, cy, R, r, a0 = 0, a1 = 360) => poly(f, [...arcPts(cx, cy, R, a0, a1), ...arcPts(cx, cy, r, a1, a0)])
// ---------------- THE SHOE: THE RUKKA'S HULL ----------------
// A horseshoe, open behind: one of the Rukka's Old Ships bent into a shoe. Pale ribbed hull, gold lines, the Firm's colour on the
// armoured arch (6+ front), nail holes lit, engines on the two prongs. The Firm is a colour scheme, so any ship can fly any Firm's colours.
// what a dice strength averages, for how many guns to draw: D6+2 is 5.5, 2D6+6 is 13
const meanOf = str => { if (typeof str === 'number') return str; const m = /^(\d*)D(\d)(?:\+(\d+))?$/.exec(str); return m ? (+(m[1] || 1)) * (+m[2] + 1) / 2 + +(m[3] ?? 0) : 2 }

function shoe (ship, lance) {
  const esc = ship.type === 'escort', bb = ship.role === 'battleship' || ship.role === 'derelict', big = ship.role === 'derelict', lump = ship.role === 'lump', L0 = 100 * sizeOf(ship), L = L0 * HULL_GROWTH, dw = L0 * (esc ? 0.08 : big ? 0.05 : 0.065), r = rng(ship.id)
  const cy = L * 0.47, Rs = L * 0.34, ts = L * (esc ? 0.125 : 0.115), kx = 0.78, gapA = 40, to = 180 - gapA, R0 = Rs + ts, top = cy - R0, parts = [], idx = w => ship.weapons.indexOf(w)
  const P = (R, deg) => { const a = deg * Math.PI / 180; return [-Math.sin(a) * R * kx, cy - Math.cos(a) * R] }, arc = (R, a, b, n = 28) => Array.from({ length: n + 1 }, (_, i) => P(R, a + (b - a) * i / n))
  const band = (f, R1, R2, a, b) => poly(f, [...arc(R1, a, b), ...arc(R2, b, a)]), hAt = y => Math.sqrt(Math.max(0, 1 - ((y - cy) / R0) ** 2)) * R0 * kx
  const tipX = -P(Rs, to)[0], tipY = P(Rs, to)[1], wrap = list => lump ? list.map(p => ({ ...p, f: ({ hull: 'rock', panel: 'rockDark', hullLight: 'rockLight', prow: 'rockDark', prowLight: 'rock', prowDark: 'rockDark', trim: 'rockDark' })[p.f] ?? p.f })) : list
  // the hull, two bands either side of a ridge, gold lines both edges
  const hull = [band('hull', R0, Rs - ts, 0, to), band('panel', Rs + ts * 0.82, Rs + ts * 0.2, 0, to), band('hullLight', Rs + ts * 0.12, Rs - ts * 0.82, 0, to), band('trim', R0, R0 - 2, 0, to), band('trim', Rs - ts + 2, Rs - ts, 0, to)]
  // ribs across it, a nail hole in every other gap
  for (let a = 34, i = 0; a < to - 12; a += esc ? 15 : 9, i++) { const [x0, y0] = P(Rs - ts * 0.82, a), [x1, y1] = P(Rs + ts * 0.82, a); hull.push(poly(i % 3 === 2 ? 'trim' : 'hullDark', [[x0, y0], [x1, y1], [x1, y1 + 1.3], [x0, y0 + 1.3]])); if (i % 2 === 0) { const [nx, ny] = P(Rs + ts * 0.5, a + (esc ? 7.5 : 4.5)); hull.push(circ('window', nx, ny, Math.max(1, ts * 0.05))) } }
  // the armoured arch in the Firm's colour, a gold collar behind it
  hull.push(band('prow', R0, Rs - ts, 0, 30), band('prowLight', R0 - ts * 0.34, Rs - ts * 0.3, 0, 26), band('prowDark', R0, R0 - Math.max(2, ts * 0.1), 0, 30), band('trim', R0, Rs - ts, 30, 31.6))
  // the prongs end in round engine housings
  const pods = esc ? 1 : bb ? (ship.aheadFullDice ? 4 : 3) : ship.aheadFullDice ? 3 : 2
  parts.push(...both(shift(engines(L, ts * 0.74, 0, pods, false), -tipX, tipY + ts * 0.66)))
  hull.push(circ('hull', -tipX, tipY, ts * 0.98), circ('prow', -tipX, tipY, ts * 0.74), circ('prowLight', -tipX, tipY, ts * 0.42), circ('glow', -tipX, tipY, ts * 0.2), circ('glowCore', -tipX, tipY, ts * 0.09))
  parts.push(...wrap(both(hull)))
  // the Hulk and the Lump: lumps of rock grown round the shoe
  if (big || lump) for (let i = 0; i < (big ? 26 : 12); i++) { const a = 4 + r() * (to - 8), R = Rs + (r() * 2 - 1) * ts * (big ? 1 : 0.9), [x, y] = P(R, a), q = L * (0.018 + r() * (big ? 0.03 : 0.04)); parts.push(...both([circ('rockDark', x, y, q), circ('rock', x - q * 0.1, y - q * 0.1, q * 0.8), circ('rockLight', x - q * 0.3, y - q * 0.3, q * 0.34)])) }
  // broadsides round the outer curve: one gun to two firepower, a torpedo tube set, launch bays cut into the flank
  const side = at(ship, 'port'), most = esc ? 1 : big ? 5 : bb ? 4 : 3, count = w => Math.max(1, Math.min(most, Math.ceil(meanOf(w.str) / 2)))
  const slots = side.filter(w => w.kind !== 'bays').flatMap(w => Array.from({ length: count(w) }, (_, k) => [w, k])), y0 = cy - R0 * 0.52, y1 = cy + R0 * 0.62, step = (y1 - y0) / Math.max(1, slots.length)
  parts.push(...both(slots.flatMap(([w, k], i) => {
    const y = y0 + (i + 0.5) * step, h = hAt(y)
    if (w.kind === 'torpedo') { const m = step * 0.8, x = -h + 2; return [rect('gunDark', x - dw * 0.5, y - m / 2, dw * 1.2, m), ...[-0.25, 0.25].map(o => circ('bay', x - dw * 0.2, y + o * m, m * 0.18))] }
    const key = `P|${side.indexOf(w)}|${k}`, fat = w.kind === 'heavybangers', wd = fat ? dw * 0.62 : dw * 0.82, g = Math.min(step * (fat ? 0.72 : 0.5), dw * 1.1)
    return [rect('metal', -h - dw * 0.2, y - g * 0.8, dw * 0.2 + L * 0.03, g * 1.6), rect('trim', -h - dw * 0.2, y - g * 0.8, dw * 0.08, g * 1.6), ...tag(reach(gun(-h - dw * 0.1, y, g, wd, fat, false), -h - dw * 0.1), key, -h - dw * 0.4, y)]
  })))
  // forward weapons on the arch. The centre: torpedoes, a bombardment cannon, or grabbers. Beside it the bangers, the heavy bangers and lances further out. A Lump's are all-round turrets, drawn the same.
  const fw = ship.weapons.filter(w => w.loc === 'prow' || (lump && w.loc === 'dorsal')), pe = top + L * (esc ? 0.14 : 0.1), has = k => fw.find(w => w.kind === k)
  for (const w of fw.filter(w => w.kind === 'lance' || w.kind === 'battery' || w.kind === 'heavybangers')) {
    const fat = w.kind === 'heavybangers', g = dw * (fat ? 1 : 0.9), inner = w.kind === 'battery', x = hAt(pe) * (inner ? 0.34 : 0.72), b = esc ? 1.1 : 1
    if (esc && fw.filter(v => v.kind !== 'torpedo').length === 1 && w.str === 2) { parts.push(...tag(forward(gun(0, 0, g, dw, false, false), 0, pe), `W|${idx(w)}|0`, 0, pe + dw * 0.4, 0)); continue }
    if (w.kind === 'lance') parts.push(...both([circ('gunDark', -x, pe, dw * 0.62), circ('trim', -x, pe, dw * 0.5), ...tag(forward(reach(lanceGun(lance, 0, 0, L * 0.1, dw * 1.5, false), 0), -x, pe), `W|${idx(w)}|0`, -x, pe, 0)]))
    else parts.push(...both(tag(forward(gun(0, 0, g, dw * (fat ? 0.8 : 1.15) * b, true, false), -x, pe + dw * 0.1), `W|${idx(w)}|0`, -x, pe + dw * 0.5, 0)))
  }
  if (has('grabbers')) { const w = L * 0.07, k = [poly('metal', [[-w * 0.2, top + L * 0.06], [-w * 1.2, top - L * 0.02], [-w * 0.9, top - L * 0.09], [-w * 0.2, top - L * 0.12], [-w * 0.7, top - L * 0.05], [-w * 0.1, top + L * 0.0]]), poly('gunDark', [[-w * 0.2, top + L * 0.06], [-w * 1.2, top - L * 0.02], [-w * 0.1, top + L * 0.0]]), circ('trim', -w * 0.2, top + L * 0.05, w * 0.2)]; parts.push(...both(k)) }
  if (has('bombardment')) parts.push(...bombard(ship, has('bombardment'), top + L * 0.09, L0 * 0.04, 0))
  if (has('torpedo')) { const tw = dw * 0.55, len = dw * 1.9, k = bb ? 3 : 2, W = k * tw + tw * 0.4
    if (has('bombardment')) parts.push(...both(torpedoBank(-hAt(pe) * 0.72 - W / 2, pe - len * 0.7, k, tw, len, false)))   // the Hammer's chuckas, either side of the cannon
    else parts.push(...torpedoBank(-W / 2, pe - len * 0.7, k, tw, len, false)) }
  // a ram: the Brute's armoured beak with its rotary blades, the Grunt's piercing prow
  if (ship.ramDice) { const w = L * (ship.ramDice > 2 ? 0.24 : 0.17), tip = top - L * (ship.ramDice > 2 ? 0.2 : 0.13); parts.unshift(poly('prowDark', [[0, tip], [-w, top + L * 0.1], [w, top + L * 0.1]]), poly('prow', [[0, tip + L * 0.03], [-w * 0.74, top + L * 0.09], [w * 0.74, top + L * 0.09]]))
    if (ship.ramDice > 2) for (const f of [0.34, 0.68]) { const y = tip + (top + L * 0.1 - tip) * f, q = w * f; parts.push(...both([circ('metal', -q, y, L * 0.05), rect('gunDark', -q - L * 0.05, y - 1, L * 0.1, 2), rect('gunDark', -q - 1, y - L * 0.05, 2, L * 0.1)])) } }
  // dorsal launch bays: three mouths on the shoulders of the arch (the book's D3+1 averages 3)
  // Dark slits that follow the curve of the hull, a thin gold edge, in fixed places that can't collide. Dorsal bays: one long slit on each shoulder. Side bays: two short ones further down each flank.
  const slit = (a, b) => both([band('trim', Rs - ts * 0.04, Rs - ts * 0.5, a, b), band('deck', Rs - ts * 0.09, Rs - ts * 0.45, a + 0.5, b - 0.5), band('bay', Rs - ts * 0.15, Rs - ts * 0.39, a + 1.2, b - 1.2)])
  if (ship.weapons.some(w => w.loc === 'dorsal' && w.kind === 'bays')) parts.push(...slit(35, 56))
  if (side.some(w => w.kind === 'bays')) parts.push(...slit(62, 73), ...slit(76, 87))
  // the Hulk: four dorsal lances down the two prongs, its aft guns firing back from the prongs' inner faces
  if (big) { const l = ship.weapons.find(w => w.kind === 'lance'), a = ship.weapons.find(w => w.loc === 'aft')
    parts.push(...both([55, 88].flatMap((d, k) => { const [x, y] = P(Rs - ts * 0.5, d); return [circ('gunDark', x, y, dw * 0.62), circ('trim', x, y, dw * 0.5), ...tag(forward(reach(lanceGun(lance, 0, 0, L * 0.1, dw * 1.5, false), 0), x, y), `W|${idx(l)}|${k}`, x, y, 0)] })))
    parts.push(...both([0, 1].flatMap(k => { const y = tipY - ts * 0.4 + k * ts * 0.9, x = -tipX + ts + 2; return shift(spin(tag(forward(gun(0, 0, dw * 0.8, dw, true, false), 0, 0), `W|${idx(a)}|${k}`, 0, 0, 180), 180), x, y) }))) }
  // the old meditation hall under its dome, on the arch behind the prow guns
  const dome = L * (esc ? 0.05 : 0.045), dY = top + L * 0.185
  if (!lump) parts.push(circ('hullDark', 0, dY, dome), circ('trim', 0, dY, dome * 0.88), circ('deck', 0, dY, dome * 0.74), circ('prow', 0, dY, dome * 0.56), circ('port', 0, dY, dome * 0.3), circ('window', 0, dY, dome * 0.15))
  return parts
}

// ---------------- THE ATHANATOI: THE TROPHY WALL ----------------
// Their logo is a deer skull with a spirit stone burning in one eye. Every
// ship: pale bone, that stone in the port eye and the other socket dark, sails of woven light, and pale crystal for the Stillness, the Athanatoi's slow death. Seen from above, prow up.
// half outlines (x in half-widths, y in lengths). eye: x, y, radius in lengths. nose: top, bottom, half-width. sails: root x, root y, tip x, tip y, width, in lengths.
const SKULLS = {
  sabre: { w: 0.24, out: [[0, 0.1], [-0.46, 0.09], [-0.6, 0.24], [-0.9, 0.4], [-1, 0.6], [-0.8, 0.82], [-0.4, 0.92], [0, 0.93]], eye: [-0.125, 0.4, 0.06], nose: [0.15, 0.31, 0.05], sails: [[-0.14, 0.7, -0.46, 1.02, 0.1]], fangs: true },
  wolf: { w: 0.2, out: [[0, 0], [-0.2, 0.02], [-0.25, 0.2], [-0.32, 0.36], [-0.78, 0.44], [-1, 0.58], [-0.9, 0.76], [-0.5, 0.9], [0, 0.93]], eye: [-0.09, 0.45, 0.055], nose: [0.05, 0.23, 0.03], sails: [[-0.1, 0.72, -0.4, 1.04, 0.09]], teeth: [0.02, 0.3], ears: true },
  hawk: { w: 0.19, out: [[0, -0.01], [-0.1, 0.05], [-0.3, 0.14], [-0.52, 0.25], [-0.96, 0.38], [-1, 0.58], [-0.76, 0.78], [-0.4, 0.9], [0, 0.93]], eye: [-0.1, 0.42, 0.075], nose: [0.17, 0.25, 0.022], sails: [[-0.13, 0.46, -0.7, 0.62, 0.15], [-0.12, 0.62, -0.5, 0.96, 0.12]] },
  croc: { w: 0.15, out: [[0, 0], [-0.34, 0.015], [-0.44, 0.1], [-0.36, 0.26], [-0.4, 0.42], [-0.52, 0.53], [-1, 0.62], [-0.96, 0.8], [-0.5, 0.92], [0, 0.93]], eye: [-0.08, 0.6, 0.042], nose: [0.03, 0.09, 0.022], sails: [[-0.1, 0.76, -0.38, 1.04, 0.08]], teeth: [0.02, 0.5] },
  // the stag, the biggest ship: a heavy skull, a thick beam each side, seven prongs to an antler, one pair of sails. lances: where the starlances sit, on the brow prongs
  stag2: { w: 0.2, out: [[0, 0], [-0.24, 0.05], [-0.34, 0.24], [-0.46, 0.38], [-0.96, 0.46], [-0.86, 0.6], [-1, 0.72], [-0.7, 0.86], [-0.3, 0.92], [0, 0.93]], eye: [-0.115, 0.47, 0.055], nose: [0.1, 0.27, 0.035], sails: [[-0.14, 0.72, -0.34, 1.04, 0.09]], prongs: true, lances: [[-0.19, 0.36], [-0.3, 0.34]] },
}
// Each Athanatoi ship is an animal's skull (sabre-tooth, wolf, crocodile; the stag is the biggest ship, the hawk a small one), one animal
// to a size, one pair of sails each. `animal` in data/concordShips.js says which; WALL_ANIMAL covers the ships that don't say.
const WALL_ANIMAL = { 'ath-thalassa': 'stag2', 'ath-selene': 'sabre', 'ath-veil': 'wolf', 'ath-eos': 'croc', 'ath-asphodel': 'hawk' }
// one sail of woven light, threads woven across, in the same green; x0, y0 is the root on the hull, x1, y1 its tip, w its half-width
function wallSail (x0, y0, x1, y1, w) {
  const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy), nx = -dy / len, ny = dx / len, at = (t, s) => [x0 + dx * t + nx * s, y0 + dy * t + ny * s], thin = (a, b, q) => { const ex = (b[0] - a[0]), ey = (b[1] - a[1]), n = Math.hypot(ex, ey) || 1, px = -ey / n * q, py = ex / n * q; return [[a[0] + px, a[1] + py], [b[0] + px, b[1] + py], [b[0] - px, b[1] - py], [a[0] - px, a[1] - py]] }
  const out = []
  const n = 5, strand = i => { const o = (i / (n - 1) - 0.5) * 2 * w * 1.1; return Array.from({ length: 11 }, (_, k) => { const t = k / 10; return at(t, o * Math.sqrt(t) + Math.sin(t * 9 + i) * w * 0.05) }) }
  for (let i = 0; i < n; i++) { const q = strand(i); out.push(...q.slice(0, -1).flatMap((p, k) => [poly(k % 3 === 2 ? 'prowLight' : 'prow', thin(p, q[k + 1], Math.max(1.1, w * 0.1 * (1 - k * 0.06))))])) ; out.push(circ('glowCore', q.at(-1)[0], q.at(-1)[1], Math.max(0.9, w * 0.06))) }
  for (const k of [3, 5, 7]) for (let i = 0; i < n - 1; i++) { out.push(poly(i % 2 ? 'prowLight' : 'trim', thin(strand(i)[k], strand(i + 1)[k], Math.max(0.6, w * 0.035)))) }
  out.unshift(circ('trim', x0, y0, Math.max(1.4, w * 0.12)))
  return out
}
// a pale crystal, growing out of the bone
const crystal = (x, y, h) => [poly('accent', [[x, y - h], [x + h * 0.4, y - h * 0.2], [x + h * 0.26, y + h * 0.3], [x - h * 0.3, y + h * 0.3], [x - h * 0.4, y - h * 0.2]]), poly('window', [[x, y - h * 0.8], [x + h * 0.15, y - h * 0.1], [x - h * 0.15, y - h * 0.1]])]

// THE HAVEN: a trophy wall in earnest, five skulls racked round a gold hub, one for each of its launch bays, strands of sail between them. Its guns are on the hub.
function haven (ship, lance) {
  const L = 100 * sizeOf(ship) * HULL_GROWTH, r0 = L * 0.15, plain = ps => ps.filter(p => p.f !== 'mark').map(({ m, ...p }) => p), head = hunter({ id: 'ath-haven-head', fleet: 'athanatoi', animal: 'wolf', type: 'cruiser', role: 'cruiser', size: 1.05, weapons: [] }, 'trophy', lance), H = 136 * 0.93
  const parts = [0, 72, 144, 216, 288].flatMap(a => spin(shift(head, 0, -r0 * 0.7 - H), a))
  parts.push(circ('hullDark', 0, 0, r0 * 1.1), circ('trim', 0, 0, r0), circ('hull', 0, 0, r0 * 0.92), circ('panel', 0, 0, r0 * 0.7), circ('trimDark', 0, 0, r0 * 0.62), circ('hullLight', 0, 0, r0 * 0.56))
  for (let k = 0; k < 4; k++) parts.push(...spin(plain(forward(gun(0, 0, 9, 9, false, false), 0, -r0 * 0.74)), 45 + k * 90))
  ;[0, 120, 240].forEach((a, k) => { const w = ship.weapons[2], x = Math.sin(a * Math.PI / 180) * r0 * 0.42, y = -Math.cos(a * Math.PI / 180) * r0 * 0.42; parts.push(circ('gunDark', x, y, 6), circ('trim', x, y, 4.8), ...tag(forward(reach(lanceGun(lance, 0, 0, 24, 10, false), 0), x, y), `W|${ship.weapons.indexOf(w)}|${k}`, x, y, a > 180 ? a - 360 : a)) })
  parts.push(circ('hullDark', 0, 0, r0 * 0.2), circ('glow', 0, 0, r0 * 0.15), circ('glowCore', 0, 0, r0 * 0.07))
  return shift(parts, 0, r0 * 0.7 + H)
}

function hunter (ship, lance) {
  const esc = ship.type === 'escort', L0 = 100 * sizeOf(ship), L = L0 * HULL_GROWTH, dw = L0 * (esc ? 0.08 : 0.06)
  if (ship.id === 'ath-haven') return haven(ship, lance)
  const kind = ship.animal ?? WALL_ANIMAL[ship.id], t = SKULLS[kind], parts = [], idx = w => ship.weapons.indexOf(w), H = L * (t?.w ?? 0.1) * (esc ? 1.2 : 1)
  let half, hAt = () => 0, lanceY = L * 0.3, gunY = L * 0.56, torpY = L * 0.2
  const lineAt = pts => y => pts.reduce((m, p, i) => { const q = pts[i + 1]; if (q && (p[1] - y) * (q[1] - y) <= 0 && p[1] !== q[1]) m = Math.max(m, -(p[0] + (q[0] - p[0]) * (y - p[1]) / (q[1] - p[1]))); return m }, 0)
  if (t) {
    half = smoothLine(t.out.map(([x, y]) => [x * H, y * L])); hAt = lineAt(half)
    { const [a, b, c, d, w] = kind === 'hawk' ? [-0.13, 0.5, -0.66, 0.74, 0.17] : t.sails[0]; parts.push(...both(wallSail(a * L, b * L, c * L, d * L, w * L * (esc ? 1.1 : 1)))); if (ship.thirdSail) parts.push(...wallSail(0, L * 0.9, 0, L * 1.26, w * L * 0.8)) }   // the Flame of Helion's three sails
    parts.push(...engines(L * 0.6, H * 0.34, L * 0.9, esc ? 2 : 3, false))
    if (t.prongs) {   // a thick curved beam, seven prongs off it, gold at the tips
      const beam = [[-0.12, 0.43], [-0.25, 0.345], [-0.37, 0.37], [-0.45, 0.5], [-0.47, 0.68], [-0.42, 0.84]], w = i => 0.034 - i * 0.004, up = beam.map(([x, y], i) => [(x - w(i)) * L, (y - w(i) * 0.4) * L]), dn = beam.map(([x, y], i) => [(x + w(i)) * L, (y + w(i) * 0.6) * L]).reverse()
      const prong = (x, y, x1, y1, b = 0.026) => { const a = Math.atan2(y1 - y, x1 - x), px = -Math.sin(a) * b, py = Math.cos(a) * b, gx = x + (x1 - x) * 0.7, gy = y + (y1 - y) * 0.7; return [poly('hull', [[(x + px) * L, (y + py) * L], [x1 * L, y1 * L], [(x - px) * L, (y - py) * L]]), poly('hullDark', [[x * L, y * L], [x1 * L, y1 * L], [(x - px * 0.5) * L, (y - py * 0.5) * L]]), poly('trim', [[(gx + px * 0.3) * L, (gy + py * 0.3) * L], [x1 * L, y1 * L], [(gx - px * 0.3) * L, (gy - py * 0.3) * L]])] }
      parts.push(...both([...prong(-0.19, 0.37, -0.23, 0.09, 0.03), ...prong(-0.3, 0.35, -0.38, 0.13, 0.03), ...prong(-0.37, 0.38, -0.53, 0.2), ...prong(-0.44, 0.48, -0.62, 0.36), ...prong(-0.46, 0.6, -0.65, 0.54), ...prong(-0.46, 0.72, -0.62, 0.74), ...prong(-0.42, 0.82, -0.53, 0.94), poly('hull', [...up, ...dn]), poly('panel', [...beam.map(([x, y]) => [(x - 0.008) * L, y * L]), ...beam.slice().reverse().map(([x, y]) => [(x + 0.012) * L, (y + 0.012) * L])])]))
    }
    if (t.ears) parts.push(...both([poly('hull', [[-H * 0.5, L * 0.52], [-H * 1.1, L * 0.3], [-H * 0.96, L * 0.54]])]))
    // the skull, its plates
    parts.push(...both([poly('hull', [...half, [0, half.at(-1)[1]]]), poly('panel', [...half.map(([x, y]) => [x * 0.82, y * 0.98 + L * 0.018]), [0, L * 0.92]]), poly('hullLight', [...half.map(([x, y]) => [x * 0.6, y * 0.96 + L * 0.03]), [0, L * 0.92]])]))
    { const line = half.filter(([, y]) => y < L * 0.9); parts.push(...both(line.slice(0, -1).map((p, i) => poly('trim', [p, line[i + 1], [line[i + 1][0] + 1.4, line[i + 1][1]], [p[0] + 1.4, p[1]]])))) }
    // the sutures: the crooked seams that cross a skull
    const yS = L * 0.64
    for (let i = 0, y = yS; i < 2; i++, y += L * 0.13) { const m = hAt(y) * 0.86, pts = Array.from({ length: 9 }, (_, k) => [-m + k * m / 4, y + (k % 2 ? L * 0.012 : -L * 0.012)]); parts.push(poly('hullDark', [...pts, ...pts.slice().reverse().map(([x, q]) => [x, q + 1.6])])) }
    parts.push(rect('hullDark', -1, L * 0.5, 2, L * 0.42))
    // the nose, two dark openings; the teeth down the jaw
    const [n0, n1, nw] = t.nose
    parts.push(...both([poly('hullDark', [[-1.4, n0 * L - 1], [-nw * L - 2, n1 * L + 1], [-1.4, n1 * L + 1]]), poly('bay', [[-2, n0 * L + 1], [-nw * L, n1 * L], [-2, n1 * L]])]))
    if (t.teeth) { const [a, b] = t.teeth; for (let y = a * L; y < b * L; y += L * (esc ? 0.05 : 0.032)) { const x = -hAt(y); parts.push(...both([poly('barrel', [[x + 0.4, y], [x - L * 0.018, y + L * 0.012], [x + 0.4, y + L * 0.026]])])) } }
    if (t.fangs) parts.unshift(...both([poly('hullDark', [[-H * 0.52, L * 0.16], [-H * 0.6, 0], [-H * 0.46, -L * 0.14], [-H * 0.32, L * 0.02], [-H * 0.24, L * 0.16]]), poly('barrel', [[-H * 0.5, L * 0.15], [-H * 0.55, 0], [-H * 0.46, -L * 0.12], [-H * 0.37, L * 0.02], [-H * 0.28, L * 0.15]])]))
    // the eyes: one socket dark, the other holding the burning spirit stone
    const [ex, ey, er] = t.eye, E = er * L
    parts.push(...both([circ('hullDark', ex * L, ey * L, E * 1.16), circ('bay', ex * L, ey * L, E)]), circ('glow', ex * L, ey * L, E * 0.74), circ('glowCore', ex * L, ey * L, E * 0.34))
    if (!esc) parts.push(...crystal(-H * 0.3, L * 0.8, L * 0.035), ...crystal(H * 0.5, L * 0.72, L * 0.028))
    lanceY = t.fangs ? L * 0.06 : L * 0.3; gunY = L * (t.prongs ? 0.64 : 0.58); torpY = L * 0.14
  }
  // the guns. Starlances fire forward: port and starboard by their arcs, on the skull either side of the nose
  const starlances = ship.weapons.filter(w => w.kind === 'starlance' || w.kind === 'lance'), fw = dw * 1.1, lx = Math.max(hAt(lanceY) * 0.56, L * 0.03)
  const lanceAt = (w, k, x, y) => [circ('gunDark', x, y, fw * 0.62), circ('trim', x, y, fw * 0.5), ...tag(forward(reach(lanceGun(lance, 0, 0, L * 0.09, fw, false), 0), x, y), `W|${idx(w)}|${k}`, x, y, 0)]
  if (starlances.length === 2) starlances.forEach((w, i) => { const s = i ? 1 : -1; for (let k = 0; k < w.str; k++) parts.push(...(t?.lances ? lanceAt(w, k, -s * t.lances[k][0] * L, t.lances[k][1] * L) : lanceAt(w, k, s * lx * (1 + k * 0.5), lanceY + k * L * 0.09))) })
  else for (const w of starlances) for (let k = 0; k < w.str; k++) parts.push(...lanceAt(w, k, w.str > 1 ? (2 * k / (w.str - 1) - 1) * lx : 0, lanceY))
  // batteries: pairs of forward guns set down the sides of the shape, a crocodile's along its jaw. A single gun sits on the keel.
  for (const w of ship.weapons.filter(w => w.kind === 'battery')) {
    const n = Math.min(esc ? 1 : 3, Math.ceil(w.str / 4)), g = dw * 0.95
    if (w.str < 3) { parts.push(...tag(forward(gun(0, 0, g, dw, false, false), 0, gunY), `W|${idx(w)}|0`, 0, gunY + dw * 0.4, 0)); continue }
    for (let k = 0; k < n; k++) { const y = (kind === 'croc' ? L * 0.2 : gunY) + k * L * (kind === 'croc' ? 0.11 : 0.09), x = -Math.max(hAt(y) * 0.72, L * 0.05); parts.push(...both(tag(forward(gun(0, 0, g, dw, w.str >= 8, false), x, y), `W|${idx(w)}|${k}`, x, y + dw * 0.4, 0))) }
  }
  // torpedoes down the nose; launch bays, two dark slits on each side of the cranium, four squadrons
  for (const w of ship.weapons.filter(w => w.kind === 'torpedo')) { const tw = dw * 0.5, len = dw * 1.8, k = w.str >= 4 ? 2 : 1; parts.push(...torpedoBank(-(k * tw + tw * 0.4) / 2, torpY, k, tw, len, false)) }
  for (const w of ship.weapons.filter(w => w.kind === 'bays')) { const n = Math.ceil(w.str / 2); for (let k = 0; k < n; k++) { const y = L * 0.74 + k * L * 0.05, x = -Math.max(hAt(y) * 0.5, L * 0.05); parts.push(...both(mouth(x, y, L * 0.07, L * 0.02))) } }
  return parts
}

// guns on any shape: hAt(y) is the half-width there. Broadsides between y0 and y1, forward weapons on a line at py, spread to px, launch bays at by.
function fit (ship, L0, L, { hAt, y0, y1, py, px, by, bx, bw }, lance) {
  const esc = ship.type === 'escort', dw = L0 * (esc ? 0.08 : 0.065), out = [], idx = w => ship.weapons.indexOf(w), side = at(ship, 'port'), count = w => Math.max(1, Math.min(esc ? 1 : 3, Math.ceil(meanOf(w.str) / 3)))
  const slots = side.filter(w => w.kind !== 'bays' && w.kind !== 'bioplasma').flatMap(w => Array.from({ length: count(w) }, (_, k) => [w, k])), step = (y1 - y0) / Math.max(1, slots.length)
  out.push(...both(slots.flatMap(([w, k], i) => {
    const y = y0 + (i + 0.5) * step, h = hAt(y), key = `P|${side.indexOf(w)}|${k}`, g = Math.min(step * 0.56, dw)
    if (w.kind === 'lance') return tag(reach(lanceGun(lance, -h - dw * 0.3, y, step * 0.8, dw, false), -h - dw * 0.3), key, -h - dw * 0.3, y)
    return [rect('gunMid', -h - dw * 0.15, y - g * 0.7, dw * 0.15 + 3, g * 1.4), ...tag(reach(gun(-h - dw * 0.1, y, g, dw * 0.8, false, false), -h - dw * 0.1), key, -h - dw * 0.4, y)]
  })))
  const fw = ship.weapons.filter(w => w.loc === 'prow'), g = dw * 0.9, pair = fw.some(w => ['lance', 'phantom'].includes(w.kind)) && fw.some(w => w.kind === 'battery' || w.kind === 'pyro')
  for (const w of fw) {
    if (w.kind === 'torpedo' || w.kind === 'missile') { const tw = dw * 0.5, len = dw * 1.8, k = meanOf(w.str) >= 4 ? 2 : 1; out.push(...torpedoBank(-(k * tw + tw * 0.4) / 2, py - len * 0.7, k, tw, len, false)) }
    else if (w.kind === 'lance' || w.kind === 'phantom') for (let k = 0; k < Math.min(2, w.str); k++) { const x = w.str > 1 ? (k ? 1 : -1) * px : 0, y = py + L * 0.06; out.push(circ('gunDark', x, y, dw * 0.62), circ('trim', x, y, dw * 0.5), ...tag(forward(reach(lanceGun(lance, 0, 0, L * 0.09, dw * 1.1, false), 0), x, y), `W|${idx(w)}|${k}`, x, y, 0)) }
    else if (w.kind === 'battery' || w.kind === 'pyro') { const x = px * (pair ? 0.5 : 1); if (w.str < 3) out.push(...tag(forward(gun(0, 0, g, dw, false, false), 0, py), `W|${idx(w)}|0`, 0, py + dw * 0.4, 0)); else out.push(...both(tag(forward(gun(0, 0, g, dw, w.str >= 8, false), -x, py), `W|${idx(w)}|0`, -x, py + dw * 0.4, 0))) }
  }
  if (ship.weapons.some(w => w.kind === 'bays')) for (const y of [by, by + L * 0.055]) out.push(...both(mouth(-(bx ?? Math.max(hAt(y) * 0.5, L * 0.04)), y, bw ?? Math.max(hAt(y) * 0.5, L * 0.05), L * 0.018)))
  return out
}
// THE THNITOI: long dark knives, violet along the ridge. A blade from tip (x, top) to its base at bot, half-width w.
function edge (x, top, bot, w) {
  const out = [poly('hull', [[x, top], [x - w, bot], [x, bot]]), poly('panel', [[x, top], [x + w, bot], [x, bot]]), poly('hullLight', [[x, top + (bot - top) * 0.12], [x - w * 0.5, bot], [x, bot]])]
  for (const k of [0.4, 0.55, 0.7, 0.85]) { const y = top + (bot - top) * k, h = w * k; out.push(poly('hullDark', [[x - h, y], [x + h, y + 1.2], [x + h, y + 2.4], [x - h, y + 1.2]])) }
  out.push(poly('trim', [[x, top], [x - w, bot], [x - w + 1.6, bot]]), poly('trim', [[x, top], [x + w, bot], [x + w - 1.6, bot]]), rect('glow', x - 0.8, top + (bot - top) * 0.08, 1.6, (bot - top) * 0.92), rect('glowCore', x - 0.3, top + (bot - top) * 0.08, 0.6, (bot - top) * 0.92))
  return out
}
function knife (ship, lance) {
  if (ship.id === 'thn-haven') return bladeRing(ship, lance)
  const esc = ship.type === 'escort', L0 = 100 * sizeOf(ship), L = L0 * HULL_GROWTH, H = L * (esc ? 0.15 : 0.095), bot = L * 0.9, name = esc ? 'shears' : 'fork', parts = [...engines(L * 0.7, H * 0.55, bot - L * 0.02, esc ? 2 : 3, false)]
  let hAt = y => H * y / bot
  if (name === 'shears') { const P = L * 0.72, one = deg => shift(spin(shift(edge(0, 0, bot, H * 0.8), 0, -P), deg), 0, P); parts.push(...one(-7), ...one(7), circ('hullDark', 0, P, H * 0.5), circ('trim', 0, P, H * 0.42), circ('glow', 0, P, H * 0.26), circ('glowCore', 0, P, H * 0.1)); hAt = y => Math.max(H * 0.5, H * 0.8 * y / bot + Math.tan(7 * Math.PI / 180) * Math.abs(y - P) * (y < P ? 1 : 0.2)) }
  else if (name === 'fork') { const side = deg => shift(spin(shift(edge(0, L * 0.4, bot, H * 0.62), 0, -bot), deg), 0, bot); parts.push(...side(-17), ...side(17), ...edge(0, 0, bot, H * 0.8), rect('hullDark', -H * 1.1, L * 0.8, H * 2.2, L * 0.03), rect('trim', -H * 1.1, L * 0.81, H * 2.2, 1.4)); hAt = y => H * 0.8 * y / bot + (y > L * 0.42 ? Math.tan(17 * Math.PI / 180) * (bot - y) + H * 0.1 : 0) }   // the prongs sit low on the hull and splay a little wider
  else parts.push(...edge(0, 0, bot, H))
  parts.push(...fit(ship, L0, L, { hAt, y0: L * 0.5, y1: L * 0.84, py: L * (esc ? 0.42 : 0.3), px: Math.max(H * 0.24, 3), by: L * (name === 'fork' ? 0.6 : 0.7) }, lance))
  // Harpoons, assault modules on the prow: a barbed spike, one or a pair
  for (const w of ship.weapons.filter(w => w.kind === 'harpoon')) for (let k = 0; k < w.str; k++) { const x = w.str > 1 ? (k ? 1 : -1) * H * 0.34 : 0, y = L * (esc ? 0.34 : 0.22), s = L * 0.13; parts.push(...tag([poly('barrel', [[x, y - s], [x - s * 0.13, y], [x + s * 0.13, y]]), poly('trim', [[x - s * 0.24, y - s * 0.34], [x, y - s * 0.56], [x + s * 0.24, y - s * 0.34], [x, y - s * 0.46]]), rect('gunDark', x - s * 0.14, y, s * 0.28, s * 0.3)], `W|${ship.weapons.indexOf(w)}|${k}`, x, y, 0)) }
  return parts
}
// THE PIRATE BASE, the Thnitoi's logo made a station: eight knives chasing round a hub, chains of light between them
function bladeRing (ship, lance) {
  const L = 100 * sizeOf(ship) * HULL_GROWTH, r0 = L * 0.13, B = L * 0.33, H = B * 0.2, plain = ps => ps.filter(p => p.f !== 'mark').map(({ m, ...p }) => p), parts = []
  for (let k = 0; k < 8; k++) parts.push(...spin(shift(spin(edge(0, 0, B, H), 18), 0, -r0 - B), k * 45))
  for (let k = 0; k < 8; k++) { const a = (k * 45 + 22.5) * Math.PI / 180; parts.push(poly('glow', [[Math.sin(a) * r0, -Math.cos(a) * r0], [Math.sin(a) * L * 0.38, -Math.cos(a) * L * 0.38], [Math.sin(a) * L * 0.38 + 1.4, -Math.cos(a) * L * 0.38 + 1.4], [Math.sin(a) * r0 + 1.4, -Math.cos(a) * r0 + 1.4]])) }
  parts.push(circ('hullDark', 0, 0, r0 * 1.14), circ('trim', 0, 0, r0 * 1.02), circ('hull', 0, 0, r0 * 0.94), circ('panel', 0, 0, r0 * 0.7), circ('prow', 0, 0, r0 * 0.5), circ('deck', 0, 0, r0 * 0.3), circ('glow', 0, 0, r0 * 0.16), circ('glowCore', 0, 0, r0 * 0.07))
  for (let k = 0; k < 4; k++) parts.push(...spin(plain(forward(gun(0, 0, 8, 8, false, false), 0, -r0 * 0.76)), 45 + k * 90))
  ;[0, 120, 240].forEach((a, k) => { const w = ship.weapons[2], x = Math.sin(a * Math.PI / 180) * r0 * 0.6, y = -Math.cos(a * Math.PI / 180) * r0 * 0.6; parts.push(circ('gunDark', x, y, 6), circ('trim', x, y, 4.6), ...tag(forward(reach(lanceGun(lance, 0, 0, 24, 10, false), 0), x, y), `W|${ship.weapons.indexOf(w)}|${k}`, x, y, a > 180 ? a - 360 : a)) })
  return shift(parts, 0, r0 + B + 8)
}
// a rectangle with rounded corners of radius r
const softRect = (f, x, y, w, h, r) => { const q = Math.min(r, w / 2, h / 2), c = (a, b, s) => Array.from({ length: 5 }, (_, i) => { const t = (s + i / 4) * Math.PI / 2; return [a + Math.cos(t) * q, b + Math.sin(t) * q] }); return poly(f, [...c(x + w - q, y + h - q, 0), ...c(x + q, y + h - q, 1), ...c(x + q, y + q, 2), ...c(x + w - q, y + q, 3)]) }
// THE KATHAROS: dark metal moons, no guns to be seen, only seams of green light and the nodes the lightning leaves from. "Thin flat crescents, clean seams".
function moon (ship) {
  const esc = ship.type === 'escort', bb = ship.role === 'battleship', L0 = 100 * sizeOf(ship), L = L0 * HULL_GROWTH, R = L * 0.44, cy = R, parts = []
  // the biggest ship is the eclipse, then the full moon, and so on down to the smallest: the fleet is the moon waning
  const name = ({ 'kat-barrow': 'eclipse', 'kat-barrow-ossuary': 'eclipse', 'kat-sickle': 'full', 'kat-pall': 'half', 'kat-vigil': 'crescent', 'kat-knell': 'sliver' })[ship.id]
  const seams = (cx, y, q, a = 0, b = 360) => { const out = [hoop('glow', cx, y, q * 0.8, q * 0.8 - Math.max(0.9, q * 0.012), a, b), hoop('trimDark', cx, y, q * 0.58, q * 0.57 - 1, a, b)]; for (let d = a; d < b; d += 30) { const s = Math.sin(d * Math.PI / 180), k = -Math.cos(d * Math.PI / 180); out.push(poly('hullDark', [[cx + s * q * 0.58, y + k * q * 0.58], [cx + s * q * 0.96, y + k * q * 0.96], [cx + s * q * 0.96 + 1, y + k * q * 0.96 + 1], [cx + s * q * 0.58 + 1, y + k * q * 0.58 + 1]])); for (const u of [0.66, 0.74]) out.push(rect('trim', cx + s * q * u, y + k * q * u, Math.max(1.4, q * 0.02), Math.max(1, q * 0.012))) } return out }
  const disc = (cx, y, q) => [circ('hullDark', cx, y, q), circ('hull', cx, y, q * 0.97), circ('panel', cx, y, q * 0.84), circ('hull', cx, y, q * 0.56), ...seams(cx, y, q), circ('hullDark', cx, y, q * 0.3), hoop('glow', cx, y, q * 0.26, q * 0.21), circ('glowCore', cx, y, q * 0.08)]
  const hullPoly = (pts, q) => [poly('hullDark', pts), poly('hull', pts.map(([x, y]) => [x * 0.97, y * 0.98 + q * 0.02]))]
  if (name === 'full') parts.push(...disc(0, cy, R))
  if (name === 'eclipse') parts.push(circ('prowDark', 0, cy, R), hoop('glow', 0, cy, R * 0.98, R * 0.9), hoop('glowCore', 0, cy, R * 0.94, R * 0.92), circ('deck', 0, cy, R * 0.88), hoop('hull', 0, cy, R * 0.84, R * 0.78), circ('bay', 0, cy, R * 0.6), hoop('trimDark', 0, cy, R * 0.4, R * 0.39))
  if (name === 'half') { const pts = arcPts(0, cy + R * 0.3, R, -90, 90); parts.push(...hullPoly(pts, R), poly('panel', arcPts(0, cy + R * 0.3, R * 0.84, -90, 90)), poly('hull', arcPts(0, cy + R * 0.3, R * 0.56, -90, 90)), ...seams(0, cy + R * 0.3, R, -90, 90), rect('glow', -R, cy + R * 0.3, R * 2, 1.6), rect('hullDark', -R * 0.98, cy + R * 0.3 + 1.6, R * 1.96, L * 0.03)) }
  if (name === 'crescent' || name === 'sliver') { const off = name === 'sliver' ? 0.24 : 0.5, sq = name === 'sliver' ? 0.94 : 0.86, o = arcPts(0, cy, R, -128, 128), i = arcPts(0, cy + R * off, R * 0.9, 128, -128).map(([x, y]) => [x * sq, y]), body = [...o, ...i]; parts.push(poly('hullDark', body), poly('hull', [...arcPts(0, cy, R * 0.97, -124, 124), ...arcPts(0, cy + R * off, R * 0.94, 124, -124).map(([x, y]) => [x * (sq - 0.02), y])]), poly('glow', [...arcPts(0, cy, R * 0.86, -112, 112), ...arcPts(0, cy, R * 0.84, 112, -112)])); for (let d = -110; d <= 110; d += 22) { const s = Math.sin(d * Math.PI / 180), k = -Math.cos(d * Math.PI / 180); parts.push(rect('trim', s * R * 0.76, cy + k * R * 0.76, Math.max(1.4, R * 0.022), Math.max(1, R * 0.014)), poly('hullDark', [[s * R * 0.72, cy + k * R * 0.72], [s * R * 0.96, cy + k * R * 0.96], [s * R * 0.96 + 1, cy + k * R * 0.96 + 1], [s * R * 0.72 + 1, cy + k * R * 0.72 + 1]])) } }
  // the weapons: nodes on the rim for the lightning, one spike ahead for the whip, an inner ring for the sun flare, dark mouths for the portals
  const w = kind => ship.weapons.find(v => v.kind === kind), keyed = (v, k, x, y, part) => tag(part, `W|${ship.weapons.indexOf(v)}|${k}`, x, y, 0), rimR = R * 0.9, rimY = cy
  const lit = w('lightning')
  if (lit) { const n = Math.min(esc ? 3 : 8, Math.ceil(lit.str / 3)); for (let k = 0; k < n; k++) { const d = n === 1 ? 0 : -75 + 150 * k / (n - 1), x = Math.sin(d * Math.PI / 180) * rimR, y = rimY + (name === 'half' ? R * 0.3 : 0) - Math.cos(d * Math.PI / 180) * rimR; parts.push(circ('gunDark', x, y, L * (esc ? 0.05 : 0.03)), ...keyed(lit, k, x, y, [circ('glow', x, y, L * (esc ? 0.034 : 0.02)), circ('glowCore', x, y, L * (esc ? 0.015 : 0.009)), rect('glow', x - 0.5, y - L * 0.05, 1, L * 0.05)])) } }
  const whip = w('whip')
  if (whip) { const y = rimY + (name === 'half' ? R * 0.3 : 0) - rimR * (name === 'crescent' ? 0.8 : 0.5); parts.push(...keyed(whip, 0, 0, y, [poly('prowDark', [[0, y - rimR * 0.6], [-L * 0.02, y], [L * 0.02, y]]), poly('glow', [[0, y - rimR * 0.56], [-L * 0.009, y], [L * 0.009, y]]), circ('glowCore', 0, y, L * 0.012)])) }
  if (w('ossuary')) parts.push(hoop('prowLight', 0, cy, R * 0.34, R * 0.3), hoop('trim', 0, cy, R * 0.24, R * 0.22), circ('glow', 0, cy, R * 0.12), circ('glowCore', 0, cy, R * 0.05))
  const portal = w('portal')
  if (portal) { const n = Math.min(3, portal.str); for (let k = 0; k < n; k++) { const x = n > 1 ? (2 * k / (n - 1) - 1) * R * 0.32 : 0, y = name === 'half' ? cy : rimY + R * (name === 'crescent' ? -0.74 : 0.36); parts.push(circ('trimDark', x, y, L * 0.024), circ('bay', x, y, L * 0.019), hoop('glow', x, y, L * 0.02, L * 0.016)) } }
  return parts
}

// the Phage's living parts: flesh in the Phage's purple, bone where it is hard, metal clamps and pipes where something built it.
const blob = (f, half) => poly(f, [...half, ...half.slice().reverse().map(([x, y]) => [-x, y])])
const tube = (f, pts, w) => { const out = []; for (let i = 0; i < pts.length - 1; i++) { const [a, b] = pts[i], [c, e] = pts[i + 1], n = Math.max(2, Math.ceil(Math.hypot(c - a, e - b) / (w * 0.8))); for (let k = 0; k <= n; k++) out.push(circ(f, a + (c - a) * k / n, b + (e - b) * k / n, w)) } return out }
const pipe = (pts, w) => [...tube('prowDark', pts, w), ...tube('prow', pts, w * 0.74), ...tube('prowLight', pts.map(([x, y]) => [x - w * 0.2, y - w * 0.2]), w * 0.3)]
const clamp = (x, y, w, t) => [rect('gunDark', x - w - 1, y - t - 1, w * 2 + 2, t * 2 + 2), rect('metal', x - w, y - t, w * 2, t * 2), circ('barrel', x - w * 0.8, y, Math.max(0.9, t * 0.4)), circ('barrel', x + w * 0.8, y, Math.max(0.9, t * 0.4))]
// THE PHAGE'S HULL: THE CAGE. A bone spine, a cage in one of six shapes, a living organ in it, metal braces where it was
// built. Each ship in concordShips.js names its rib and core; the organs are drawn to sit inside the cage.
const taper = (f, pts, w0, w1) => { const out = []; let n = 0; for (let i = 0; i < pts.length - 1; i++) { const [a, b] = pts[i], [c, e] = pts[i + 1], d = Math.max(2, Math.ceil(Math.hypot(c - a, e - b) / Math.max(1, w1))); n += d } let k = 0; for (let i = 0; i < pts.length - 1; i++) { const [a, b] = pts[i], [c, e] = pts[i + 1], d = Math.max(2, Math.ceil(Math.hypot(c - a, e - b) / Math.max(1, w1))); for (let q = 0; q < d; q++, k++) out.push(circ(f, a + (c - a) * q / d, b + (e - b) * q / d, w0 + (w1 - w0) * k / n)) } return out }
const bone = (pts, w) => [...taper('hullDark', pts, w * 1.4, w * 0.7), ...taper('hull', pts, w, w * 0.34), ...taper('hullLight', pts.map(([x, y]) => [x + 0.3, y - 0.3]), w * 0.4, w * 0.12)]
// one rib, port side, from the spine at height y, reach w (both in lengths): six ways of being a rib
const RIBS = {
  barrel: (y, w) => [[0, y], [-w * 0.7, y - 0.03], [-w, y + 0.05], [-w * 0.8, y + 0.15], [-w * 0.12, y + 0.17]],   // curves right round, nearly closing
  spears: (y, w) => [[0, y], [-w * 0.6, y + 0.03], [-w * 1.45, y + 0.1]],                                          // straight out, a point at the end
  claws: (y, w) => [[0, y], [-w * 0.6, y + 0.04], [-w * 1.02, y - 0.01], [-w * 1.06, y - 0.12], [-w * 0.86, y - 0.16]],   // reaching forward, hooked
  wings: (y, w) => [[0, y], [-w * 0.8, y + 0.02], [-w * 1.5, y + 0.14], [-w * 1.8, y + 0.32]],                      // long, swept right back
  hooks: (y, w) => [[0, y], [-w * 0.74, y + 0.01], [-w * 0.96, y + 0.1], [-w * 0.7, y + 0.15]],                     // short and bent, like a fish's
  fan: (y, w, i, n) => { const a = (34 + 118 * i / Math.max(1, n - 1)) * Math.PI / 180, q = 0.46; return [[0, 0.74], [-Math.sin(a) * q * 0.5, 0.74 - Math.cos(a) * q * 0.5], [-Math.sin(a + 0.1) * q, 0.74 - Math.cos(a + 0.1) * q]] },   // all from one root, spread like a hand
}
const RIB_SPREAD = { barrel: 0.3, spears: 0.25, claws: 0.28, wings: 0.21, hooks: 0.3, fan: 0.3 }
// the living core, at (0, cy), radius r
function livingCore (kind, cy, r, L) {
  const out = [circ('prowDark', 0, cy, r * 1.04)], fine = Math.max(0.9, L * 0.005)
  if (kind === 'heart') { const h = smoothLine([[0, -0.6], [-0.4, -1], [-1, -0.7], [-0.9, 0.05], [-0.4, 0.7], [0, 1.08]].map(([x, y]) => [x * r, cy + y * r])); return [...tube('prowDark', [[r * 0.26, cy - r * 0.5], [r * 0.34, cy - r * 1.26]], r * 0.17), ...tube('prow', [[-r * 0.28, cy - r * 0.5], [-r * 0.4, cy - r * 1.3]], r * 0.17), blob('prowDark', h), blob('prow', h.map(([x, y]) => [x * 0.88, cy + (y - cy) * 0.88])), blob('prowLight', h.map(([x, y]) => [x * 0.42, cy - r * 0.08 + (y - cy) * 0.5])), ...clamp(0, cy, r * 0.94, Math.max(1.2, r * 0.07))] }
  if (kind === 'brain') { out.length = 0; out.push(circ('prowDark', 0, cy, r), circ('prow', 0, cy, r * 0.92), rect('prowDark', -fine, cy - r, fine * 2, r * 2)); for (let i = 0; i < 4; i++) { const y = -0.66 + i * 0.44, pts = Array.from({ length: 5 }, (_, k) => [-0.1 - k * 0.19, y + (k % 2 ? 0.14 : -0.1)]).filter(([x, v]) => Math.hypot(x, v) < 0.88).map(([x, v]) => [x * r, cy + v * r]); if (pts.length > 1) out.push(...both([...tube('prowDark', pts, fine * 1.2), ...tube('prowLight', pts.map(([x, v]) => [x, v + fine * 2]), fine * 0.7)])) } out.push(hoop('metal', 0, cy, r * 1.08, r * 0.98, 60, 120), hoop('metal', 0, cy, r * 1.08, r * 0.98, 240, 300)); return out }
  if (kind === 'lungs') { out.length = 0; const l = smoothLine([[-0.1, -0.9], [-0.7, -0.8], [-1, 0], [-0.76, 0.96], [-0.2, 0.8], [-0.1, 0]].map(([x, y]) => [x * r, cy + y * r]), 4); out.push(...both([poly('prowDark', l), poly('prow', l.map(([x, y]) => [x * 0.86 - r * 0.03, cy + (y - cy) * 0.9])), poly('prowLight', l.map(([x, y]) => [x * 0.5 - r * 0.1, cy + (y - cy) * 0.6]))]), ...both(tube('glow', [[-r * 0.08, cy - r * 0.2], [-r * 0.5, cy], [-r * 0.5, cy + r * 0.5]], fine))); return out }
  if (kind === 'gut') { const a = r * 0.66, pts = [[-a, cy - r * 0.7], [a, cy - r * 0.7], [a, cy - r * 0.2], [-a, cy - r * 0.2], [-a, cy + r * 0.26], [a, cy + r * 0.26], [a, cy + r * 0.74], [-a * 0.2, cy + r * 0.74]]; out.length = 0; out.push(...pipe(pts, r * 0.2), ...clamp(a, cy - r * 0.45, r * 0.26, fine * 1.4), ...clamp(-a, cy + r * 0.03, r * 0.26, fine * 1.4)); return out }
  if (kind === 'eye') { out.length = 0; out.push(circ('prowDark', 0, cy, r), circ('hull', 0, cy, r * 0.94), circ('hullLight', -r * 0.1, cy - r * 0.1, r * 0.72), circ('prowDark', 0, cy, r * 0.56), circ('prow', 0, cy, r * 0.5), circ('prowLight', 0, cy, r * 0.32), circ('deck', 0, cy, r * 0.2), circ('glowCore', -r * 0.07, cy - r * 0.07, r * 0.06)); return out }
  if (kind === 'eggs') { out.length = 0; for (const [x, y, q] of [[0, -0.5, 0.44], [-0.56, -0.1, 0.4], [0.56, -0.1, 0.4], [-0.34, 0.54, 0.42], [0.34, 0.54, 0.42], [0, 0.04, 0.36]]) out.push(circ('prowDark', x * r, cy + y * r, q * r), circ('prow', x * r, cy + y * r, q * r * 0.84), circ('prowLight', x * r - q * r * 0.2, cy + y * r - q * r * 0.2, q * r * 0.38), circ('glowCore', x * r, cy + y * r, q * r * 0.12)); return out }
  if (kind === 'bomb') { out.length = 0; out.push(circ('prowDark', 0, cy, r * 1.2), circ('glow', 0, cy, r), circ('prowLight', 0, cy, r * 0.7), circ('glowCore', 0, cy, r * 0.36), ...clamp(0, cy - r * 0.5, r * 0.86, fine * 1.3), ...clamp(0, cy + r * 0.5, r * 0.86, fine * 1.3)); return out }
  // a sac: a smooth bag of veins and a lit knot
  const v = [[-0.7, 0.2], [-0.2, -0.6], [0.5, -0.3], [0.2, 0.6]]
  out.push(circ('prow', 0, cy, r * 0.9), circ('prowLight', -r * 0.2, cy - r * 0.2, r * 0.46), ...v.flatMap(([x, y]) => tube('prowDark', [[0, cy], [x * r, cy + y * r]], fine)), circ('glow', 0, cy, r * 0.28), circ('glowCore', 0, cy, r * 0.12))
  return out
}
function cage (ship, lance) {
  const esc = ship.type === 'escort', bb = ship.role === 'battleship', L0 = 100 * sizeOf(ship), L = L0 * HULL_GROWTH, style = ship.rib, make = RIBS[style], W0 = RIB_SPREAD[style], dw = L0 * (esc ? 0.08 : 0.065), parts = [], pts = [], idx = w => ship.weapons.indexOf(w)
  const n = esc ? 4 : bb ? 7 : 5, wid = esc ? 7 : 6, rw = Math.max(2.2, L * (bb ? 0.012 : 0.014)), ys = Array.from({ length: n }, (_, i) => 0.12 + i * 0.66 / (n - 1))
  const cy = L * (style === 'fan' ? 0.4 : 0.47), R = L * (esc ? 0.17 : 0.165) * (ship.core === 'bomb' ? 1.25 : 1)
  // the core under the ribs, the membrane behind it
  // the organs go under the ribcage so they look protected
  parts.push(circ('deck', 0, cy, R * 1.3), ...livingCore(ship.core, cy, R, L))
  for (let i = 0; i < n; i++) { const y = ys[i], w = W0 * (0.72 + 0.34 * Math.sin((y - 0.05) / 0.86 * Math.PI)), q = make(y, w, i, n).map(([a, b]) => [a * L, b * L]); pts.push(...q); parts.push(...both(bone(q, rw)))
    const tip = q.at(-1); if (style === 'spears') parts.push(...both([poly('trim', [[tip[0] - rw * 2.4, tip[1] + rw * 0.6], [tip[0] + rw, tip[1] - rw], [tip[0] + rw * 0.4, tip[1] + rw]])]))
    if (i % 2 === 0) { const m = q[Math.floor(q.length / 2)]; parts.push(...both(clamp(m[0], m[1], rw * 1.5, rw * 1.1))) }
    if (style === 'barrel' && i % 2 === 1) parts.push(rect('metal', tip[0], tip[1] - 1.4, -tip[0] * 2, 2.8)) }
  // the spine, jointed
  const sp = style === 'wings' ? [[0, 0.02], [0, 0.98]] : [[0, 0.03], [0, 0.94]]
  parts.push(...bone(sp.map(([a, b]) => [a * L, b * L]), Math.max(3, L * 0.019))); for (let y = 0.07; y < 0.92; y += 0.055) parts.push(rect('hullDark', -L * 0.016, y * L, L * 0.032, Math.max(1.2, L * 0.005)))
  // drive sacs at the root of the spine
  parts.push(...both([circ('prowDark', -L * 0.05, L * 0.95, L * 0.03), circ('glow', -L * 0.05, L * 0.95, L * 0.02), circ('glowCore', -L * 0.05, L * 0.95, L * 0.009)]))
  const hAt = y => { let m = L * 0.05; for (const [a, b] of pts) if (Math.abs(b - y) < L * 0.1) m = Math.max(m, -a); return m * 0.9 }
  // On a queen ship nothing is a gun. Acid fires from great bone spikes, the searbile from rows of small ones, feeders are long tendrils
  if (bb) {
    const spike = (x, y, deg, len, w, key) => { const a = deg * Math.PI / 180, tip = [x + Math.sin(a) * len, y - Math.cos(a) * len], nx = Math.cos(a) * w, ny = Math.sin(a) * w, body = [poly('hullDark', [[x - nx * 1.3, y - ny * 1.3], tip, [x + nx * 1.3, y + ny * 1.3]]), poly('hull', [[x - nx, y - ny], tip, [x + nx, y + ny]]), poly('prowLight', [[x + (tip[0] - x) * 0.6 - nx * 0.4, y + (tip[1] - y) * 0.6 - ny * 0.4], tip, [x + (tip[0] - x) * 0.6 + nx * 0.4, y + (tip[1] - y) * 0.6 + ny * 0.4]]), circ('prowDark', x, y, w * 1.2), circ('prow', x, y, w * 0.8)]; return key ? tag(body, key, x, y, deg) : body }
    const tendril = (x, y, dir, n, seed) => { const c = Array.from({ length: n }, (_, q) => [x + Math.sin(q * 0.9 + seed) * L * 0.03 + dir * q * L * 0.012, y - q * L * 0.045]); return [...taper('prowDark', c, L * 0.02, L * 0.005), ...taper('prow', c, L * 0.014, L * 0.003), ...taper('prowLight', c.map(([a, b]) => [a - 0.6, b]), L * 0.005, L * 0.001), circ('glow', c.at(-1)[0], c.at(-1)[1], L * 0.008)] }
    const side = at(ship, 'port')
    parts.push(...fit({ ...ship, weapons: ship.weapons.filter(w => w.kind === 'bays') }, L0, L, { hAt, y0: 0, y1: 1, py: 0, px: 0, by: cy + R * 1.16 }, lance))
    for (const w of ship.weapons) {
      const i = idx(w), key = k => `W|${i}|${k}`
      if (w.loc === 'prow' && w.kind === 'pyro') for (const [sx, k] of [[-1, 0], [1, 1]]) parts.push(...spike(sx * L * 0.05, L * 0.2, sx * 8, L * 0.26, L * 0.024, key(k)))
      if (w.loc === 'thorax' && w.kind === 'pyro') parts.push(...spike(0, cy - R * 1.1, 0, L * 0.3, L * 0.03, key(0)))
      if ((w.loc === 'prow' || w.loc === 'thorax') && w.kind === 'bioplasma') { const y = w.loc === 'prow' ? L * 0.13 : cy - R * 1.05; for (const d of [-44, -24, -8, 8, 24, 44]) parts.push(...spike(d * L * 0.0012, y, d, L * 0.13, L * 0.012)) }
      if (w.loc === 'port' && w.kind === 'pyro') parts.push(...both([0, 1, 2].flatMap(k => { const y = L * (0.42 + k * 0.16); return spike(-hAt(y) * 0.9, y, -82 + k * 16, L * 0.15, L * 0.018, `P|${side.indexOf(w)}|${k}`) })))
      if (w.loc === 'port' && w.kind === 'bioplasma') parts.push(...both([0, 1, 2, 3, 4].flatMap(k => { const y = L * (0.3 + k * 0.1); return spike(-hAt(y) * (0.7 + (k % 2) * 0.2), y, -70 + k * 6, L * 0.09, L * 0.01) })))
      if (w.kind === 'feeder') for (const [x, dir, n] of [[-0.09, -1, 8], [-0.04, -0.4, 10], [0.04, 0.4, 10], [0.09, 1, 8]]) parts.push(...tendril(x * L, L * 0.16, dir, n, x * 40))
      if (w.kind === 'claws') { const c = [[-L * 0.06, L * 0.16], [-L * 0.17, L * 0.07], [-L * 0.15, -L * 0.04], [-L * 0.03, -L * 0.1]]; parts.push(...both(bone(c, L * 0.02))) }
      if (w.kind === 'bio-torpedo') { for (const x of [-L * 0.1, -L * 0.04, L * 0.04, L * 0.1]) parts.push(circ('prowDark', x, L * 0.16, L * 0.034), circ('prow', x, L * 0.16, L * 0.027), circ('hull', x, L * 0.145, L * 0.012)); for (const [x, d] of [[-L * 0.12, -1], [L * 0.12, 1]]) parts.push(...tendril(x, L * 0.15, d, 6, x)) }
    }
    return parts
  }
  parts.push(...fit(ship, L0, L, { hAt, y0: L * 0.26, y1: L * 0.74, py: L * 0.1, px: L * 0.09, by: cy + R * 1.16 }, lance))
  // what fit doesn't draw: guns on the thorax, spines, tentacles, claws, torpedo pods
  for (const w of ship.weapons) {
    if (w.loc === 'thorax' && w.kind === 'pyro') { const y = cy - R * 1.3; parts.push(circ('gunDark', 0, y, dw * 0.7), ...tag(forward(gun(0, 0, dw, dw, true, false), 0, y), `W|${idx(w)}|0`, 0, y + dw * 0.4, 0)) }
    if (w.kind === 'bioplasma') { const side = w.loc === 'port' ? [-1] : w.loc === 'starboard' ? [] : [-1, 1], y = w.loc === 'thorax' ? cy : w.loc === 'prow' ? L * 0.12 : L * 0.6; for (const sg of [...side, ...(w.loc === 'port' ? [1] : [])]) for (let k = 0; k < 3; k++) { const a = sg * (20 + k * 34) * Math.PI / 180, q = L * 0.13, x0 = sg * L * 0.02 * (1 + k), y0 = y + k * L * 0.04; parts.push(poly('prowDark', [[x0 + Math.sin(a) * q, y0 - Math.cos(a) * q], [x0 - 2, y0], [x0 + 2, y0]]), poly('prowLight', [[x0 + Math.sin(a) * q * 0.9, y0 - Math.cos(a) * q * 0.9], [x0 - 0.8, y0], [x0 + 0.8, y0]])) } }
    if (w.kind === 'feeder') { const y = w.loc === 'thorax' ? L * 0.3 : L * 0.08; for (const sx of [-1, 1]) for (let t = 0; t < 2; t++) { const c = Array.from({ length: 7 }, (_, q) => [sx * (L * 0.03 + t * L * 0.05 + Math.sin(q + t) * L * 0.025), y - q * L * 0.03]); parts.push(...taper('prowDark', c, L * 0.015, L * 0.005), ...taper('prowLight', c, L * 0.008, L * 0.002)) } }
    if (w.kind === 'claws') { const y = w.loc === 'thorax' ? L * 0.34 : L * 0.1, c = [[-L * 0.05, y + L * 0.05], [-L * 0.13, y - L * 0.04], [-L * 0.11, y - L * 0.13], [-L * 0.02, y - L * 0.17]]; parts.push(...both(bone(c, L * 0.018))) }
    if (w.kind === 'bio-torpedo') { const y = w.loc === 'thorax' ? cy - R * 1.4 : L * 0.16; for (const x of [-L * 0.06, L * 0.06]) parts.push(circ('prowDark', x, y, L * 0.034), circ('prow', x, y, L * 0.027), circ('hull', x, y - L * 0.012, L * 0.012)) }
  }
  return parts
}

// ---------------- THE ISOS: CROSSED RINGS ----------------
// A plain rounded square, nothing inside it, and rings of little rounded squares circling it, each turned to face the centre. Sand and blue.
function ringSquare (ship, lance) {
  // the rings, smaller on smaller ships: the biggest ships have one upright and one flat, crossing; the middle ones one flat ring; the smallest none.
  // The far half of a ring passes behind the square, the near half across it.
  const esc = ship.type === 'escort', bb = ship.role === 'battleship', L0 = 100 * sizeOf(ship), L = L0 * HULL_GROWTH, cy = L * 0.5, S = L * 0.27, r = S * 0.34, long = S * 1.72, thin = long * 0.3, n = bb ? 22 : 18, q = L * 0.03, parts = []
  const up = (cx, near) => ({ cx, cy, rx: thin, ry: long, up: true, near }), flat = () => ({ cx: 0, cy, rx: long, ry: thin, up: false, near: 1 })
  const count = ship.rings ?? (esc ? 0 : bb ? 2 : 1), rings = count === 0 ? [] : count > 1 ? [up(0, -1), flat()] : [flat()]
  const onNear = (g, t) => g.up ? Math.sign(Math.sin(t)) === g.near : Math.cos(t) < 0
  const line = (g, near) => { const arc = k => Array.from({ length: 49 }, (_, i) => i * 2 * Math.PI / 48).filter(t => onNear(g, t) === near).map(t => [g.cx + Math.sin(t) * g.rx * k, g.cy - Math.cos(t) * g.ry * k]); return poly('prowDark', [...arc(1.012), ...arc(0.988).reverse()]) }
  const little = (g, x, y, k) => { const a = q * k, w = g.up ? a * 0.62 : a, h = g.up ? a : a * 0.62, m = Math.min(w, h); return [softRect('hullDark', x - w - 0.8, y - h - 0.8, w * 2 + 1.6, h * 2 + 1.6, m * 0.5), softRect('hull', x - w, y - h, w * 2, h * 2, m * 0.44), softRect('hullLight', x - w * 0.7, y - h * 0.7, w * 1.2, h * 1.2, m * 0.3), softRect('prow', x - w * 0.26, y - h * 0.26, w * 0.52, h * 0.52, m * 0.14)] }
  const half = (g, near) => { const out = [line(g, near)]; for (let i = 0; i < n; i++) { const t = (i + 0.5) * 2 * Math.PI / n; if (onNear(g, t) === near) out.push(...little(g, g.cx + Math.sin(t) * g.rx, g.cy - Math.cos(t) * g.ry, near ? 1.14 : 0.86)) } return out }
  for (const g of rings) parts.push(...half(g, false))
  if (ship.speed !== 0) parts.push(...engines(L * 0.6, S * 0.6, cy + S - L * 0.02, esc ? 2 : bb ? 4 : 3, false))
  parts.push(softRect('hullDark', -S - 1.6, cy - S - 1.6, S * 2 + 3.2, S * 2 + 3.2, r + 1.4), softRect('hull', -S, cy - S, S * 2, S * 2, r), softRect('panel', -S * 0.93, cy - S * 0.93, S * 1.86, S * 1.86, r * 0.9), softRect('hullLight', -S * 0.84, cy - S * 0.84, S * 1.62, S * 1.62, r * 0.8))
  parts.push(...fit(ship, L0, L, { hAt: () => S, y0: cy - S * 0.7, y1: cy + S * 0.7, py: cy - S * 0.56, px: S * 0.5, by: cy + S * 0.24 }, lance))
  for (const g of rings) parts.push(...half(g, true))
  return parts
}

const cache = new Map()
/** The blueprint of a ship or ordnance counter in one design and lance version: { id, design, lance, fleet, kind: 'ship' | 'ordnance', parts, box }. */
// the marks and keys into bp.mounts: { layer, weapon (index into ship.weapons), x, y pivot, tx, ty barrel tip, rest (bearing at rest,
// degrees clockwise from dead ahead) }. Each gun's parts get `l`, its layer.
function takeMounts(parts, ship) {
  const mounts = [], layerOf = new Map()
  for (const p of parts) {
    if (p.f !== 'mark') continue
    const [kind, idx] = p.m.replace("'", '').split('|'), mirrored = p.m.endsWith("'")
    const weapon = kind === 'W' ? +idx : ship.weapons.indexOf(ship.weapons.filter(w => w.loc === (mirrored ? 'starboard' : 'port'))[+idx])
    layerOf.set(p.m, mounts.length)
    mounts.push({ layer: mounts.length, weapon, x: p.cx, y: p.cy, tx: p.cx, ty: p.cy, rest: p.rest, side: p.cx < 0 ? -1 : 1 })
  }
  const verts = p => p.s === 'poly' ? p.pts : p.s === 'rect' ? [[p.x, p.y], [p.x + p.w, p.y], [p.x, p.y + p.h], [p.x + p.w, p.y + p.h]] : [[p.cx, p.cy]]
  const drawn = parts.filter(p => p.f !== 'mark').map(p => {
    if (!p.m) return p
    const { m, ...rest } = p, g = mounts[layerOf.get(m)]
    for (const [x, y] of verts(p)) if (Math.hypot(x - g.x, y - g.y) > Math.hypot(g.tx - g.x, g.ty - g.y)) { g.tx = x; g.ty = y }
    return { ...rest, l: g.layer }
  })
  for (const g of mounts) g.rest ??= Math.round(Math.atan2(g.tx - g.x, -(g.ty - g.y)) * 180 / Math.PI / 45) * 45
  return { drawn, mounts }
}

// the other fleets' hulls, one each (FLEET_DESIGN names them): a ship of one of these fleets is always drawn in its fleet's hull
const HULLS = { concord: dyad, rukka: shoe, athanatoi: hunter, thnitoi: knife, phage: cage, katharos: moon, isos: ringSquare }
export function blueprint(id, design = DEFAULT_DESIGN, lance = DEFAULT_LANCE) {
  if (!DESIGNS.some(d => d.id === design) && !Object.values(FLEET_DESIGN).includes(design)) throw new Error(`blueprint: no design called ${design}`)
  if (!LANCES.some(l => l.id === lance)) throw new Error(`blueprint: no lance version called ${lance}`)
  const key = id + '/' + design + '/' + lance
  if (cache.has(key)) return cache.get(key)
  const ship = SHIPS.find(s => s.id === id) ?? ISOS_FLEET.find(s => s.id === id) ?? CONCORD_SHIPS.find(s => s.id === id) ?? CONCORD_MORE.find(s => s.id === id) ?? RUKKA_SHIPS.find(s => s.id === id) ?? RUKKA_MORE.find(s => s.id === id) ?? ATHANATOI_SHIPS.find(s => s.id === id) ?? ATHANATOI_MORE.find(s => s.id === id) ?? ATHANATOI_FLEET.find(s => s.id === id) ?? Object.values(RACE_SHIPS).flat().find(s => s.id === id) ?? THNITOI_FLEET.find(s => s.id === id) ?? KATHAROS_FLEET.find(s => s.id === id) ?? PHAGE_FLEET.find(s => s.id === id) ?? ISOS_FLEET.find(s => s.id === id) ?? phageProfile(id), ord = !ship && (ORDNANCE.find(o => o.id === id) ?? CONCORD_CRAFT.find(o => o.id === id) ?? RUKKA_CRAFT.find(o => o.id === id) ?? ATHANATOI_CRAFT.find(o => o.id === id) ?? THNITOI_CRAFT.find(o => o.id === id) ?? PHAGE_CRAFT.find(o => o.id === id) ?? ISOS_CRAFT.find(o => o.id === id))
  if (!ship && !ord) throw new Error(`blueprint: no ship or ordnance called ${id}`)
  const parts = ship ? (HULLS[ship.fleet] ? HULLS[ship.fleet](ship, lance) : ship.id === 'spacehulk' ? hulk(ship, lance) : ship.type === 'escort' ? escort(ship, design, lance) : capital(ship, design, lance)) : ordnance(ord)
  const { drawn, mounts } = takeMounts(parts, ship)
  const bp = { id, design, lance, fleet: (ship || ord).fleet, kind: ship ? 'ship' : 'ordnance', parts: drawn, box: bounds(drawn), mounts }
  cache.set(key, bp)
  return bp
}
