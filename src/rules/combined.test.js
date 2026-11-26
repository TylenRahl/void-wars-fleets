// Tests for combined ordnance salvoes from squadrons in base contact (rules/ordnance.js).
// Run by `npm test` (node:test); exports nothing.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createGame, addShip, formSquadron } from './game.js'
import { launchTorpedoes, launchCraft, combinePartners } from './ordnance.js'

function setup () {
  const game = createGame({ fleets: [{ name: 'Freemen', fleet: 'freemen' }, { name: 'Dominion', fleet: 'dominion' }] })
  const a = addShip(game, 0, 'rimward'), b = addShip(game, 0, 'lantern'), c = addShip(game, 0, 'steward')
  for (const s of [a, b, c]) { s.leadership = 8; s.facing = 0 }
  a.pos = { x: 50, y: 60 }; b.pos = { x: 47.2, y: 61.5 }; c.pos = { x: 20, y: 20 }
  formSquadron(game, [a.uid, b.uid, c.uid], 'Cruiser squadron A')
  game.round = 1; game.active = 0; game.phase = 'shooting'
  return { game, a, b, c }
}

test('only squadron ships in base contact and loaded may combine', () => {
  const { game, a, b, c } = setup()
  assert.deepEqual(combinePartners(game, a, 'torpedo').map(s => s.uid), [b.uid])
  assert.equal(launchTorpedoes(game, a, 0, { combine: [c.uid] }).ok, false, 'the Steward is not in contact')
})

test('a combined salvo: the strengths added, from the stem of the ship furthest back, both tubes emptied', () => {
  const { game, a, b } = setup()
  assert.ok(launchTorpedoes(game, a, 0, { combine: [b.uid] }).ok)
  const t = game.ordnance.find(o => o.kind === 'torpedo')
  assert.equal(t.str, 6 + 6, 'Rimward 6 + Lantern 6')
  assert.deepEqual(t.pos, b.pos, 'the Lantern is further back along the heading')
  assert.ok(!a.loaded.torpedo && !b.loaded.torpedo)
})

test('carriers in base contact launch one wave together', () => {
  const { game, a, c } = setup()
  const d = addShip(game, 0, 'steward'); d.leadership = 8; d.pos = { x: 23.2, y: 20 }
  game.squadrons[0].uids.push(d.uid)
  assert.equal(launchCraft(game, c, { bomber: 5 }).ok, false, 'one Steward has 4 bays')
  assert.ok(launchCraft(game, c, { bomber: 5, fighter: 3 }, { combine: [d.uid] }).ok)
  assert.equal(game.ordnance.find(o => o.kind === 'wave').markers.length, 8)
  assert.ok(!c.loaded.bays && !d.loaded.bays)
})

test('torpedoes launch in any arc their tubes have: a derelict\'s port tubes to port', () => {
  const game = createGame({ fleets: [{ name: 'Freemen', fleet: 'freemen' }, { name: 'Dominion', fleet: 'dominion' }] })
  const h = addShip(game, 1, 'spacehulk'); h.leadership = 8; h.pos = { x: 90, y: 60 }; h.facing = 0
  game.round = 1; game.active = 1; game.phase = 'shooting'
  const port = h.profile.weapons.findIndex(w => w.kind === 'torpedo' && w.loc === 'port')
  assert.equal(launchTorpedoes(game, h, 0, { weapon: port }).ok, false, 'dead ahead is not in the port arc')
  assert.ok(launchTorpedoes(game, h, -90, { weapon: port }).ok)
})
