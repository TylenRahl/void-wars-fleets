// Tests for attack craft (launching, moving, attacking), with fixed dice.
// Run by `npm test` (node:test); exports nothing.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { scriptedRng } from './dice.js'
import { createGame, addShip } from './game.js'
import { launchCraft, moveWave, ordnancePhase, fleetCraftRoom, launchTorpedoes } from './ordnance.js'

function duel () {
  const game = createGame({ fleets: [{ name: 'Freemen', fleet: 'freemen' }, { name: 'Dominion', fleet: 'dominion' }] })
  const d = addShip(game, 0, 'steward'), m = addShip(game, 1, 'malice')
  d.leadership = 8; m.leadership = 8
  d.pos = { x: 40, y: 60 }; d.facing = 0; m.pos = { x: 60, y: 60 }; m.facing = 180
  game.round = 1; game.active = 0; game.first = 0; game.phase = 'shooting'
  return { game, d, m }
}

test('launching: no more squadrons than the bays, and the fleet\'s craft in play never exceed its bays', () => {
  const { game, d } = duel()
  assert.equal(launchCraft(game, d, { bomber: 5 }).ok, false, 'the Steward has 4 bays')
  assert.ok(launchCraft(game, d, { bomber: 2, fighter: 2 }).ok)
  assert.equal(fleetCraftRoom(game, 0), 0)
  assert.equal(launchCraft(game, d, { bomber: 1 }).ok, false, 'bays empty until Reload Ordnance')
})

test('bombers: turrets fire first, fighters shot down first; each bomber D6 minus turrets attacks, +1 per fighter', () => {
  const { game, d, m } = duel()
  launchCraft(game, d, { bomber: 2, fighter: 2 })
  game.phase = 'ordnance'; ordnancePhase(game)
  // Malice turrets 2: rolls 4, 1 -> one fighter down. Bombers roll 5, 6 -> 3 + 4 = 7, +2 fighters (no more than the
  // 2 bombers) = 9 attacks against armour 5: 5,5,5,1,1,1,1,1,1 -> 3 hits; then 3 critical rolls of 1
  game.rng = scriptedRng([4, 1, 5, 6, 5, 5, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1])
  const w = game.ordnance.find(o => o.kind === 'wave')
  assert.ok(moveWave(game, w.id, m.pos).ok)
  assert.equal(m.damage, 3)
  assert.equal(game.ordnance.length, 0, 'the wave is gone after its attack')
})

test('fighters intercept torpedoes: both are removed', () => {
  const { game, d, m } = duel()
  const rep = addShip(game, 1, 'loathing'); rep.leadership = 8; rep.pos = { x: 70, y: 60 }; rep.facing = 180; m.pos = { x: 60, y: 90 }
  game.active = 1
  assert.ok(launchTorpedoes(game, rep, 180).ok)
  game.active = 0
  launchCraft(game, d, { fighter: 1 })
  game.ordnance.find(o => o.kind === 'wave').pos = { x: 50, y: 60 }   // out between the ships, in the salvo's path
  game.phase = 'ordnance'; ordnancePhase(game)
  assert.ok(!game.ordnance.some(o => o.kind === 'torpedo'), 'the salvo ran into the fighter on its way')
  assert.ok(!game.ordnance.some(o => o.kind === 'wave'))
})

test('the player whose turn it is moves ordnance first', () => {
  const { game, d, m } = duel()
  launchCraft(game, d, { fighter: 1 })
  game.active = 1; game.phase = 'shooting'; m.profile = { ...m.profile, weapons: [...m.profile.weapons, { loc: 'port', kind: 'bays', range: 30, str: 1, arc: [] }] }
  launchCraft(game, m, { fighter: 1 })
  game.phase = 'ordnance'; ordnancePhase(game)
  const mine = game.ordnance.find(o => o.side === 0)
  assert.equal(moveWave(game, mine.id, { x: 40, y: 20 }).ok, false)
})
