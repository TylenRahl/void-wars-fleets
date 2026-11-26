// Tests for Fleet Commander re-rolls and the Warden Protocols.
// Run by `npm test` (node:test); exports nothing.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { scriptedRng } from './dice.js'
import { checkFleet, fleetPoints, createFleetBattle, placeFleetShip, nextToPlace, fleetVictoryPoints } from './fleet.js'
import { giveOrder, leadershipOf, leadershipTest } from './game.js'
import { critical } from './damage.js'
import { boardingAction } from './endPhase.js'
import { moveShip } from './movement.js'

const imp = { name: 'Freemen', fleet: 'freemen', ships: ['lantern', 'rimward', 'sword', 'sword'], escortSquadrons: [[2, 3]], commander: 'admiral', commanderOn: 0, rerolls: 1 }
const chs = { name: 'Dominion', fleet: 'dominion', ships: ['bloodshed', 'malice', 'shambles', 'profaner', 'profaner'], escortSquadrons: [[3, 4]], commander: 'harrowadmiral-8', marks: ['rapture', 'wrath'], lords: [{ on: 1, mark: 'cipher' }, { on: 2, mark: 'endurance' }] }

function battle (decide = {}, lists = [imp, chs]) {
  const g = createFleetBattle({ lists, limit: 1500, seed: 3, decide })
  while (g.ships.some(s => !s.pos)) { const s = nextToPlace(g); placeFleetShip(g, s.uid, { x: 10 + g.ships.indexOf(s) * 14, y: g.zones[s.side] === 'A' ? 20 : 100 }) }
  g.phase = 'movement'; g.round = 1; g.active = 0
  return g
}
const ship = (g, id) => g.ships.find(s => s.id === id)

test('points and checks: extra re-rolls 25/75/150, Marks priced, no Mark twice, Lords not on the Harrow Admiral\'s ship', () => {
  assert.equal(fleetPoints(imp), 180 + 180 + 35 + 35 + 100 + 25)
  assert.equal(fleetPoints({ ...imp, rerolls: 3 }), 530 + 150)
  assert.deepEqual(checkFleet(imp, 1500), [])
  assert.ok(checkFleet({ ...imp, commander: null }, 1500).some(w => /Admiral/.test(w)))
  assert.equal(fleetPoints(chs), 180 + 170 + 165 + 30 + 30 + 50 + 25 + 20 + (50 + 30) + (50 + 35))
  assert.deepEqual(checkFleet(chs, 1500), [])
  assert.ok(checkFleet({ ...chs, marks: ['wrath', 'wrath'] }, 1500).some(w => /more than once/.test(w)))
  assert.ok(checkFleet({ ...chs, lords: [{ on: 0, mark: null }] }, 1500).some(w => /Harrow Admiral is on/.test(w)))
  assert.ok(checkFleet({ ...chs, lords: [{ on: 3, mark: null }] }, 1500).some(w => /capital ship/.test(w)))
  assert.ok(checkFleet({ ...chs, rerolls: 1 }, 1500).some(w => /Cipher/.test(w)))
})

test('a failed Command check may spend a Fleet Commander re-roll; the second roll stands, once per test', () => {
  let asked = 0
  const g = battle({ reroll: () => { asked++; return true } })
  const lantern = ship(g, 'lantern')
  assert.equal(g.rerolls[0].left, 2, 'the Admiral\'s one and the one bought')
  g.rng = scriptedRng([6, 6, 1, 1])
  assert.ok(giveOrder(g, lantern, 'lockOn').ok, g.log.at(-1).text)
  assert.equal(g.rerolls[0].left, 1)
  // fails twice: the re-roll is spent once and not again on the same test
  const rimward = ship(g, 'rimward')
  g.rng = scriptedRng([6, 6, 6, 6])
  assert.equal(giveOrder(g, rimward, 'lockOn').ok, false)
  assert.equal(g.rerolls[0].left, 0)
  assert.equal(asked, 2)
})

test('declining keeps the re-roll; Bridge Smashed on the flagship loses the rest', () => {
  const g = battle({ reroll: () => false })
  const lantern = ship(g, 'lantern')
  g.rng = scriptedRng([6, 6])
  assert.equal(leadershipTest(g, lantern, { why: 'test' }).pass, false)
  assert.equal(g.rerolls[0].left, 2)
  critical(g, ship(g, 'rimward'), 9)
  assert.equal(g.rerolls[0].left, 2, 'another ship\'s bridge is not the flagship')
  critical(g, lantern, 9)
  assert.equal(g.rerolls[0].left, 0)
})

test('a Harrow Lord\'s Cipher re-roll is for his own ship; the Harrow Admiral\'s fleet re-roll for anyone', () => {
  const g = battle({ reroll: () => true })
  g.active = 1
  const malice = ship(g, 'malice'), bloodshed = ship(g, 'bloodshed')
  assert.equal(g.rerolls[1].left, 1, 'Harrow Admiral: one; his Marks are Rapture and Wrath, no Cipher')
  assert.equal(malice.rerolls, 1)
  g.rng = scriptedRng([6, 6, 1, 1])
  leadershipTest(g, malice, { why: 'test' })
  assert.equal(malice.rerolls, 0, 'his own spent first')
  assert.equal(g.rerolls[1].left, 1)
  g.rng = scriptedRng([6, 6, 1, 1])
  leadershipTest(g, bloodshed, { why: 'test' })
  assert.equal(g.rerolls[1].left, 0)
})

test('Rapture Protocol: enemy ships within 15 cm are -2 Resolve', () => {
  const g = battle()
  const lantern = ship(g, 'lantern'), bloodshed = ship(g, 'bloodshed')
  lantern.pos = { x: 50, y: 50 }; bloodshed.pos = { x: 50, y: 64 }
  g.rng = scriptedRng([1, 1])
  assert.equal(leadershipTest(g, lantern, { why: 'test' }).need, Math.min(10, leadershipOf(lantern)) - 2)
  bloodshed.pos = { x: 50, y: 66 }
  g.rng = scriptedRng([1, 1])
  assert.equal(leadershipTest(g, lantern, { why: 'test' }).need, Math.min(10, leadershipOf(lantern)))
})

test('Endurance Protocol: one more damage point and it may not be boarded', () => {
  const g = battle()
  const sl = ship(g, 'shambles'), rimward = ship(g, 'rimward')
  assert.equal(sl.profile.hits, 9)
  assert.equal(ship(g, 'malice').profile.hits, 8, 'only the marked ship')
  sl.pos = { x: 100, y: 60 }; sl.facing = 0
  rimward.pos = { x: 100, y: 73 }; rimward.facing = 270
  moveShip(g, rimward, [{ fwd: 10 }], { board: sl.uid })
  assert.equal(rimward.boarding, null)
  assert.ok(g.log.some(l => /Endurance Protocol and may not be boarded/.test(l.text)))
})

test('Wrath Protocol doubles the boarding value; the Harrow Admiral adds +1 to his critical rolls', () => {
  const g = battle()
  const bloodshed = ship(g, 'bloodshed'), lantern = ship(g, 'lantern')
  // Bloodshed 8 hits x2 = 16 against Lantern 8 + 2 turrets = 10: +1 (higher). Bloodshed 6 +1 +1 Dominion = 8; Lantern 4 = 4.
  // Won by 4, Stormed: the Bloodshed scores a critical on the Lantern on 2+ (rolled 1, +1 = 2: it does), the Lantern on 6+.
  g.rng = scriptedRng([6, 4, 1, 3, 3, 1])
  const r = boardingAction(g, bloodshed, lantern)
  assert.equal(r.winner, bloodshed.uid)
  assert.ok(g.log.some(l => /boarding value 16 against 10/.test(l.text)))
  assert.ok(g.log.some(l => /Bloodshed.*against Lantern.*rolled 1 \+1.*critical hit/.test(l.text)), g.log.slice(-6).map(l => l.text).join('\n'))
})

test('victory points count the commander, his bought re-rolls and Marks with his ship', () => {
  const g = battle()
  ship(g, 'bloodshed').state = 'destroyed'
  assert.equal(fleetVictoryPoints(g, 0), 180 + 50 + 25 + 20)
  ship(g, 'lantern').state = 'destroyed'
  assert.equal(fleetVictoryPoints(g, 1), 180 + 100 + 25)
})

test('the boarded ship adds its turrets after the Wrath Protocol has doubled its hits', () => {
  const g = battle()
  const bloodshed = ship(g, 'bloodshed'), lantern = ship(g, 'lantern')
  g.rng = scriptedRng([1, 6, 3, 3, 1, 1, 1, 1, 1, 1])
  boardingAction(g, lantern, bloodshed)
  assert.ok(g.log.some(l => /boarding value 18 against 8/.test(l.text)), 'Bloodshed 8 x2 + 2 turrets; the Lantern its 8 hits')
})
