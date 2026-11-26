// SEA PICTURES FOR THE BATTLE: the one place battle.js, fx.js and seaField.js get sea art. Turns a ship, a craft or a
// defence of the game into its Tides of the Archipelago picture: a data: URL the battle board draws in the same square box,
// pointing up, as the space art (battle.js pictureOf, waveSvg, the torpedo marker). Cached by everything that changes it.
// Human fleet (freemen) -> seaShips.js runic destroyers, seaCraft.js craft, seaForts.js forts and defences
// Elf fleet (athanatoi) -> seaElves.js
// Orc fleet (rukka) -> seaOrcs.js
// Dominion fleet (dominion) -> seaDominion.js (crew by mark, the teleport circle dark when the ship cannot teleport)
import { seaShipSvg, HUMAN_SCHEMES } from './seaShips.js'
import { elfShipSvg, elfCraftSvg, ELF_SCHEMES } from './seaElves.js'
import { orcShipSvg, orcCraftSvg, ORC_SCHEMES } from './seaOrcs.js'
import { dominionShipSvg, dominionCraftSvg, DOMINION_SCHEMES } from './seaDominion.js'
import { humanCraftSvg } from './seaCraft.js'
import { fortSvg, SEA_FORTS } from './seaForts.js'
import { extraArt, EXTRA_IDS } from './seaExtras.js'

// the colour schemes each sea fleet can be painted in (chosen per side at set-up)
export const SEA_SCHEMES = { freemen: HUMAN_SCHEMES, athanatoi: ELF_SCHEMES, rukka: ORC_SCHEMES, dominion: DOMINION_SCHEMES }
// how much bigger than the space ship a sea ship is drawn on the table: 4 times, so the crew on deck can be seen.
// Bases and rules unchanged.
export const SEA_GROW = 4
export const seaFleetDrawn = fleet => !!SEA_SCHEMES[fleet]

const url = svg => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
const cache = new Map()
// a drawing { vb, inner } re-framed as a square centred on (cx, cy) with side `side`, so the battle's square box fits it
function square (art, cx, cy, side) {
  return url(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${(cx - side / 2).toFixed(2)} ${(cy - side / 2).toFixed(2)} ${side.toFixed(2)} ${side.toFixed(2)}">${art.inner}</svg>`)
}

/** A ship's picture: { fleet, id, scheme, mark, teleport, firing }. null if the fleet has no sea drawing. */
export function seaShipPicture ({ fleet, id, scheme, mark = null, teleport = true, firing = false }) {
  const key = [fleet, id, scheme, mark, teleport, firing].join('|')
  if (cache.has(key)) return cache.get(key)
  let art = null
  try {
    if (EXTRA_IDS.includes(id)) art = extraArt(id, { scheme })   // transports, the lump, the hulks
    else if (fleet === 'freemen') art = seaShipSvg(id, 'runic', { scheme, firing })
    else if (fleet === 'athanatoi') art = elfShipSvg(id, { scheme })
    else if (fleet === 'rukka') art = orcShipSvg(id, { scheme, firing, teleport })
    else if (fleet === 'dominion') art = dominionShipSvg(id, { scheme, firing, mark, teleport })
  } catch { art = null }
  // the ship's length fills about nine tenths of the box, as the space pictures do
  const out = art ? square(art, 0, art.L / 2, art.L * 1.12) : null
  cache.set(key, out)
  return out
}

// THE CRAFT AND TORPEDO MARKERS: the game's craft row id (data/craft.js, ships.js ORDNANCE) to the sea drawing
const CRAFT = {
  freemen: { fighter: 'fre-fury', bomber: 'fre-longwing', 'assault boat': 'fre-shark', torpedo: 'fre-torpedo' },
  athanatoi: { fighter: 'ath-nightjar', bomber: 'ath-aetos', 'assault boat': 'ath-lamia', 'torpedo bomber': 'ath-torpedo-bomber', torpedo: 'ath-torpedo' },
  rukka: { 'buzza': 'rukka-buzza', fighter: 'rukka-buzza', bomber: 'rukka-buzza', 'assault boat': 'rukka-assault-boat', 'torpedo bomber': 'rukka-tin-fisher', torpedo: 'rukka-torpedo' },
  dominion: { fighter: 'dom-carrion', bomber: 'dom-pyrewing', 'assault boat': 'dom-gravehook', torpedo: 'dom-torpedo', 'boarding torpedo': 'dom-boarding-torpedo' }
}
const DRAWN_IDS = new Set(Object.values(CRAFT).flatMap(o => Object.values(o)))
/** An attack craft or torpedo marker: { fleet, id (the craft row's id), kind (its kind), scheme }. null if not drawn for the sea. */
export function seaCraftPicture ({ fleet, id, kind, scheme }) {
  const want = DRAWN_IDS.has(id) ? id : CRAFT[fleet]?.[kind] ?? null
  if (!want) return null
  const key = ['craft', fleet, want, scheme].join('|')
  if (cache.has(key)) return cache.get(key)
  let art = null
  try {
    if (want.startsWith('fre-')) art = humanCraftSvg(want, { scheme })
    else if (want.startsWith('ath-')) art = elfCraftSvg(want, { scheme })
    else if (want.startsWith('rukka-')) art = orcCraftSvg(want, { scheme })
    else if (want.startsWith('dom-')) art = dominionCraftSvg(want, { scheme })
  } catch { art = null }
  const out = art ? square(art, art.vb.x + art.vb.w / 2, art.vb.y + art.vb.h / 2, art.vb.w) : null
  cache.set(key, out)
  return out
}
/** The torpedo salvo marker for a fleet. */
export const seaTorpedoPicture = (fleet, scheme) => seaCraftPicture({ fleet, id: CRAFT[fleet]?.torpedo, kind: 'torpedo', scheme })

/** One quarter of the star fort (the battle draws the Bastion as four quadrants), with or without the keep. */
export function seaFortQuadrant (basilica, scheme = 'midnight') {
  const key = ['quad', basilica, scheme].join('|')
  if (!cache.has(key)) { const art = extraArt('quadrant', { scheme, basilica }); cache.set(key, square(art, 0, 0, art.vb.w)) }
  return cache.get(key)
}
/** A defence or fort (rules/defences.js ids, and the Bastion) as its sea fort, in the Human fleet's runic style and scheme. */
export function seaFortPicture (id, scheme = 'midnight') {
  if (EXTRA_IDS.includes(id)) return seaShipPicture({ fleet: 'rukka', id, scheme: SEA_SCHEMES.rukka[0].id })   // the Orc lump
  if (!SEA_FORTS.some(x => x.id === id)) return null
  const key = ['fort', id, scheme].join('|')
  if (!cache.has(key)) { const art = fortSvg(id, { scheme }); cache.set(key, square(art, 0, 0, art.vb.w * 0.92)) }
  return cache.get(key)
}
