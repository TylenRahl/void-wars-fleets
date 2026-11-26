// Tests for capital ship squadrons (forming them, moving and firing together).
// Run by `npm test` (node:test); exports nothing.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { scriptedRng } from './dice.js'
import { checkFleet, createFleetBattle, placeFleetShip, nextToPlace, fleetVictoryPoints } from './fleet.js'
import { giveOrder, mates, squadronOf, leadershipOf } from './game.js'
import { fireShip } from './shooting.js'

const imp = { name: 'Freemen', fleet: 'freemen', ships: ['lantern', 'rimward', 'cannonade', 'tribune'], capitalSquadrons: [[0, 1]], commander: null }
const chs = { name: 'Dominion', fleet: 'dominion', ships: ['malice', 'bloodshed', 'shambles'], capitalSquadrons: [[0, 1, 2]], commander: 'harrowadmiral-8' }

test('fleet lists: cruisers 2-4 mixed, battleships or grand cruisers 2-3 and not mixed, no escorts', () => {
  assert.deepEqual(checkFleet(imp, 1000), [])
  assert.ok(checkFleet({ ...imp, capitalSquadrons: [[0]] }, 1000).some(w => /two to four/.test(w)))
  assert.ok(checkFleet({ ...imp, ships: ['lantern', 'rimward', 'cannonade', 'tribune', 'steward'], capitalSquadrons: [[0, 1, 2, 3, 4]] }, 2000).some(w => /two to four/.test(w)))
  assert.ok(checkFleet({ ...imp, ships: ['sovereign', 'lantern', 'rimward', 'tribune'], capitalSquadrons: [[0, 1]] }, 2000).some(w => /mixed/.test(w)))
  assert.ok(checkFleet({ ...imp, ships: ['lantern', 'sword', 'sword'], escortSquadrons: [[1, 2]], capitalSquadrons: [[0, 1]] }, 1000).some(w => /only one squadron|cruisers/.test(w)))
})

function battle () {
  const g = createFleetBattle({ lists: [imp, chs], limit: 1000, seed: 4 })
  while (g.ships.some(s => !s.pos)) { const s = nextToPlace(g); placeFleetShip(g, s.uid, { x: 20 + g.ships.indexOf(s) * 12, y: g.zones[s.side] === 'A' ? 20 : 100 }) }
  g.phase = 'movement'; g.active = 0; g.round = 1
  return g
}

test('each capital ship keeps its own Resolve; a Command check uses the best, and the order goes to all', () => {
  const g = battle()
  const [lantern, rimward] = g.ships.filter(s => s.side === 0).slice(0, 2)
  assert.ok(squadronOf(g, lantern)?.capital)
  lantern.leadership = 6; rimward.leadership = 9
  g.rng = scriptedRng([5, 4])   // 9: fails on the Lantern's 6, passes on the Rimward's 9
  assert.ok(giveOrder(g, lantern, 'lockOn').ok)
  assert.equal(rimward.order?.kind, 'lockOn')
  assert.ok(/Rimward/.test(g.log.findLast(l => /Command check/.test(l.text)).text))
})

test('victory points: a capital ship in a squadron scores on its own', () => {
  const g = battle()
  g.ships.find(s => s.id === 'lantern').state = 'destroyed'
  assert.equal(fleetVictoryPoints(g, 1), 180)
})

test('fire at a capital squadron hits the nearest ship it can reach first', () => {
  const g = battle()
  g.phase = 'shooting'; g.active = 1
  const malice = g.ships.find(s => s.id === 'malice'), [lantern, rimward] = g.ships.filter(s => s.side === 0).slice(0, 2)
  for (const s of g.ships.filter(s => s.side === 1 && s !== malice)) s.pos = { x: 170, y: 5 }
  malice.pos = { x: 60, y: 60 }; malice.facing = 90
  lantern.pos = { x: 60, y: 72 }; rimward.pos = { x: 60, y: 80 }
  g.ships.filter(s => s.side === 0).slice(2).forEach(s => { s.pos = { x: 170, y: 110 } })
  g.rng = scriptedRng([6, 6, ...Array(20).fill(1)])   // Malice prow lances, strength 2: two hits
  assert.ok(fireShip(g, malice, [{ weapon: malice.profile.weapons.findIndex(w => w.kind === 'lance' && w.loc === 'prow'), target: rimward.uid }]).ok)
  assert.ok(g.log.some(l => /^Lantern class cruiser: shields absorb/.test(l.text)), 'the nearer Lantern took the hits')
  assert.equal(rimward.damage, 0)
})
