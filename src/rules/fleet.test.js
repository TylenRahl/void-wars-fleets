// Tests for fleet battles and squadrons (rules/fleet.js).
// Run by `npm test` (node:test); exports nothing.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { scriptedRng } from './dice.js'
import { checkFleet, fleetPoints, createFleetBattle, placeFleetShip, nextToPlace, fleetVictoryPoints } from './fleet.js'
import { giveOrder, mates, shieldsLeft } from './game.js'
import { fireShip } from './shooting.js'

const imp = { name: 'Freemen', fleet: 'freemen', ships: ['lantern', 'rimward', 'sword', 'sword', 'adder'], escortSquadrons: [[2, 3, 4]], commander: null }
const chs = { name: 'Dominion', fleet: 'dominion', ships: ['malice', 'bloodshed', 'profaner', 'profaner'], escortSquadrons: [[2, 3]], commander: 'harrowadmiral-8' }

test('fleet lists: points, escorts in squadrons of 2-6, battleships one per three cruisers, Dominion needs a Harrow Admiral', () => {
  assert.equal(fleetPoints(imp), 180 + 180 + 35 + 35 + 30)
  assert.deepEqual(checkFleet(imp, 500), [])
  assert.ok(checkFleet({ ...imp, escortSquadrons: [] }, 500).some(w => /squadron/.test(w)))
  assert.ok(checkFleet({ ...imp, ships: ['sovereign', 'lantern'], escortSquadrons: [] }, 1000).some(w => /battleship/.test(w)))
  assert.ok(checkFleet({ ...chs, commander: null }, 1000).some(w => /Harrow Admiral/.test(w)))
  assert.ok(checkFleet(imp, 400).some(w => /over the 400/.test(w)))
})

function battle () {
  const g = createFleetBattle({ lists: [imp, chs], limit: 1000, seed: 5 })
  while (g.ships.some(s => !s.pos)) { const s = nextToPlace(g); placeFleetShip(g, s.uid, { x: 20 + g.ships.indexOf(s) * 12, y: g.zones[s.side] === 'A' ? 20 : 100 }) }
  return g
}

test('escort squadrons share one Resolve roll; the Harrow Admiral commands the most expensive ship', () => {
  const g = battle()
  const swords = g.ships.filter(s => s.side === 0 && s.profile.type === 'escort')
  assert.equal(new Set(swords.map(s => s.leadership)).size, 1)
  assert.equal(g.ships.find(s => s.commander === 'Harrow Admiral').id, 'bloodshed')
})

test('a squadron deploys whole before the other side places again', () => {
  const g = createFleetBattle({ lists: [imp, chs], limit: 1000, seed: 5 })
  const first = g.placing, sq = g.squadrons.find(q => q.side === first)
  placeFleetShip(g, sq.uids[0], { x: 30, y: g.zones[first] === 'A' ? 10 : 110 })
  assert.equal(g.placing, first, 'the same side keeps placing')
  assert.equal(nextToPlace(g).uid, sq.uids[1])
})

test('a squadron takes one Command check and every ship goes on the order', () => {
  const g = battle()
  g.phase = 'movement'; g.active = 0; g.round = 1
  const sword = g.ships.find(s => s.id === 'sword')
  g.rng = scriptedRng([1, 1])
  assert.ok(giveOrder(g, sword, 'lockOn').ok)
  assert.ok(mates(g, sword).every(s => s.order?.kind === 'lockOn'))
})

test('fire at a squadron goes to the nearest ship until it is destroyed, then the next', () => {
  const g = battle()
  g.phase = 'shooting'; g.active = 1; g.round = 1
  const malice = g.ships.find(s => s.id === 'malice'), swords = g.ships.filter(s => s.side === 0 && s.profile.type === 'escort')
  malice.pos = { x: 60, y: 60 }; malice.facing = 90
  swords.forEach((s, i) => { s.pos = { x: 60, y: 75 + i * 4 }; s.facing = 0 })
  g.ships.filter(s => s.side === 0 && s.profile.type !== 'escort').forEach(s => { s.pos = { x: 170, y: 110 } })
  // Malice prow lances, strength 2 at the nearest Sword: 4 and 5 hit; the first takes its shield, the second destroys it
  g.rng = scriptedRng([4, 5, 1])
  assert.ok(fireShip(g, malice, [{ weapon: 2, target: swords[0].uid }]).ok, g.log.at(-1).text)
  assert.equal(swords[0].state, 'destroyed')
  assert.equal(shieldsLeft(g, swords[1]), 1)
})

test('victory points: destroyed ships their points, crippled capital ships 25%, escorts only for a whole squadron', () => {
  const g = battle()
  const lantern = g.ships.find(s => s.id === 'lantern'), sw = g.ships.filter(s => s.side === 0 && s.profile.type === 'escort')
  lantern.damage = 4
  sw[0].state = 'destroyed'
  assert.equal(fleetVictoryPoints(g, 1), 45)
  sw.forEach(s => { s.state = 'destroyed' })
  assert.equal(fleetVictoryPoints(g, 1), 45 + 100)
})
