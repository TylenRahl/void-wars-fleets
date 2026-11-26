// Tests for data/ships.js and the ship art: every Freemen and Dominion ship is present at its fleet-list price, has a whole profile,
// a sprite on disk for the picture the game loads, and an SVG drawing in every design, lance version and colour scheme.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { SHIPS, ORDNANCE, shipsOf } from './ships.js'
import { shipSvg } from '../view/svgShips.js'
import { blueprint, DESIGNS, SCHEMES, LANCES, DEFAULT_LANCE } from '../view/blueprint.js'
import { artFor } from '../view/shipArt.js'

const PUBLIC = fileURLToPath(new URL('../../public/', import.meta.url))

// prices from the two fleet lists: Rimward Reach Fleet List; Dominion Incursion
const LIST_PRICES = {
  freemen: { sovereign: 365, reckoning: 345, mars: 270, suzerain: 220, steward: 220, cannonade: 190, tribune: 185,
    rimward: 180, lantern: 180, intrepid: 110, wildfire: 40, sword: 35, adder: 30 },
  dominion: { spacehulk: 650, battlebarge: 410, sunderer: 400, harrower: 300, loathing: 230, lethe: 260, nyx: 230,
    charnel: 200, gallows: 190, ruin: 190, bloodshed: 180, pyre: 180, malice: 170, shambles: 165,
    apostate: 45, faithless: 40, profaner: 30 },
}

test('every ship of both fleet lists is present at the list price, and nothing else', () => {
  for (const [fleet, prices] of Object.entries(LIST_PRICES)) {
    assert.deepEqual(Object.fromEntries(shipsOf(fleet).filter(s => s.role !== 'transport' && s.role !== 'fortress').map(s => [s.id, s.points])), prices)   // transports are scenario pieces
  }
})

test('every ship has a complete profile', () => {
  for (const s of SHIPS) {
    for (const k of ['hits', 'speed', 'shields', 'turrets']) assert.ok(Number.isInteger(s[k]) && s[k] > 0, `${s.id} ${k}`)
    assert.ok(s.armour.front >= s.armour.other && s.armour.other >= 4, `${s.id} armour`)
    assert.ok(s.weapons.length > 0, `${s.id} weapons`)
    for (const w of s.weapons) assert.ok(w.range > 0 && w.str > 0, `${s.id} ${w.loc} ${w.kind}`)
  }
})

test('every ship and ordnance counter has the sprite the game loads, and an SVG drawing in every design, lance version and colour scheme', () => {
  for (const x of [...SHIPS, ...ORDNANCE]) assert.ok(existsSync(PUBLIC + artFor(x.id, 'sprite').src.slice(1)), `sprite missing for ${x.id}`)
  for (const x of [...SHIPS, ...ORDNANCE]) for (const d of DESIGNS) for (const l of LANCES) for (const sc of SCHEMES[x.fleet]) {
    const svg = shipSvg(x.id, { design: d.id, scheme: sc.id, lance: l.id })
    assert.match(svg, /^<svg[\s\S]*<\/svg>$/, `${x.id} svg`)
    assert.ok(blueprint(x.id, d.id).parts.length >= 3, `${x.id} blueprint`)
  }
})

test('the lance versions change every broadside, prow, dorsal and escort lance, and nothing else', () => {
  const same = id => JSON.stringify(blueprint(id, 'cathedral', 'turret').parts) === JSON.stringify(blueprint(id, 'cathedral', 'array').parts)
  assert.ok(!same('rimward') && !same('harrower'), 'Rimward and Harrower broadside lances change')
  assert.ok(!same('malice') && !same('wildfire') && !same('apostate'), 'prow lances and escort lances change')
  assert.ok(!same('reckoning') && !same('lethe') && !same('spacehulk'), 'dorsal lances change')
  assert.ok(same('cannonade') && same('sword') && same('profaner'), 'no lances, no change')
})

test('the focusing array is the default lance version', () => assert.equal(DEFAULT_LANCE, 'array'))

test('default colours: Freemen grey and gold, Dominion black and gold', () => {
  assert.equal(SCHEMES.freemen[0].id, 'grey-gold'); assert.equal(SCHEMES.dominion[0].id, 'black-gold')
})

test('both fleets have a blue colour scheme', () => {
  assert.ok(SCHEMES.freemen.some(s => s.id === 'blue-white') && SCHEMES.dominion.some(s => s.id === 'blue-bronze'))
})

test('escorts carry their weapons: sponson guns for a battery, a lance past the prow, a torpedo launcher', () => {
  const guns = id => blueprint(id).parts.filter(p => p.f === 'barrel').length
  assert.ok(guns('sword') > guns('adder'), 'four firepower draws more barrels than one')
  assert.ok(blueprint('wildfire').box.y < 0, 'the Wildfire lance reaches past its prow tip')
  assert.ok(blueprint('adder').parts.some(p => p.f === 'bay') && blueprint('faithless').parts.some(p => p.f === 'bay'), 'Adder and Faithless draw torpedo tubes')
})

test('the green and white scheme paints the body green and the prow white', () => {
  const svg = shipSvg('lantern', { scheme: 'green-white' })
  assert.match(svg, /#3f7a46/); assert.match(svg, /#e6e8e2/)
})

test('the drawing shows the weapons: a sunburst cannon ship has a barrel past its prow, a carrier its launch bays', () => {
  const mars = blueprint('mars'), rimward = blueprint('rimward', 'fortress')
  assert.ok(mars.box.y < 0 && rimward.box.y >= 0, 'sunburst cannon reaches past the prow tip')
  assert.ok(blueprint('steward').parts.some(p => p.f === 'bay'), 'Steward draws launch bays')
})
