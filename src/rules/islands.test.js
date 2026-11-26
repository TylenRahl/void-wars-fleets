// ISLANDS (Tides of the Archipelago, the sea skin): islands block the line of fire like planets, destroy
// torpedoes, wreck drifting hulks, and a ship that sails into one runs aground: it stops at the shore, takes D6 hits (no
// test), is pushed clear of the shore and may then be turned to face any way, so it does not crash again.
// Run by `npm test` (node:test); exports nothing.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { scriptedRng, createRng } from './dice.js'
import { createGame, addShip, baseR } from './game.js'
import { moveShip, turnAfterAground, AGROUND_CLEAR } from './movement.js'
import { launchTorpedoes, ordnancePhase } from './ordnance.js'
import { lineOfFire, rollBattlezone, shapeGap } from './terrain.js'
import { hullOf, shoreOverlap } from './seaHull.js'

function setup (terrain, { a = { x: 40, y: 60 }, b = { x: 70, y: 90 }, phase = 'movement' } = {}) {
  const game = createGame({ fleets: [{ name: 'Human fleet', fleet: 'freemen' }, { name: 'Orc fleet', fleet: 'dominion' }] })
  game.terrain = terrain
  const s = addShip(game, 0, 'lantern'), t = addShip(game, 1, 'malice')
  s.leadership = 8; t.leadership = 8; s.pos = a; s.facing = 0; t.pos = b; t.facing = 180
  game.round = 1; game.active = 0; game.first = 0; game.phase = phase
  return { game, s, t }
}
const island = (x, y, r = 4) => ({ id: 7, kind: 'island', shape: { t: 'circ', x, y, r } })

test('an island blocks the line of fire', () => {
  assert.match(lineOfFire({ terrain: [island(55, 60)] }, { x: 40, y: 60 }, { x: 70, y: 60 }), /island blocks/)
  assert.equal(lineOfFire({ terrain: [island(55, 80)] }, { x: 40, y: 60 }, { x: 70, y: 60 }), null)
})

test('sailing into an island: stops at the shore, D6 hits with no test, pushed clear and facing away', () => {
  const { game, s } = setup([island(55, 60)])
  game.rng = scriptedRng([3, 1, 1, 1, 1, 1, 1])   // D6 = 3 hits: 2 on the shields, 1 damage; the rest critical rolls of 1
  const r = moveShip(game, s, [{ fwd: 20 }])
  assert.ok(r.ok && r.aground, 'the move reports it ran aground')
  assert.equal(s.damage, 1)
  assert.ok(!game.log.some(l => /Resolve/.test(l.text) && /island/.test(l.text)), 'no test is taken')
  const gap = -shoreOverlap(hullOf(s), island(55, 60).shape)   // the whole hull counts at sea (rules/seaHull.js)
  assert.ok(gap >= AGROUND_CLEAR - 0.11 && gap < AGROUND_CLEAR + 0.2, `clear of the shore by about ${AGROUND_CLEAR} cm (${gap})`)
  assert.ok(s.pos.x < 55 - 4, 'it stopped on the near side')
  assert.ok(Math.abs(((s.facing + 360) % 360) - 180) < 1, 'it faces away from the island')
})

test('after running aground the player may turn it any way, once; then it sails away without crashing again', () => {
  const { game, s } = setup([island(55, 60)])
  game.rng = scriptedRng([1, 1, 1, 1])
  moveShip(game, s, [{ fwd: 20 }])
  assert.ok(turnAfterAground(game, s, 90).ok)
  assert.equal(s.facing, 90)
  assert.equal(turnAfterAground(game, s, 0).ok, false, 'once only')
  // next turn it moves off along the new heading: no second grounding
  game.round = 2; s.moved = 0; s.movedThisPhase = false
  const damage = s.damage
  const r = moveShip(game, s, [{ fwd: 15 }])
  assert.ok(r.ok && !r.aground)
  assert.equal(s.damage, damage)
})

test('a ship against the shore that steers back into the island runs aground again', () => {
  const { game, s } = setup([island(55, 60)])
  game.rng = scriptedRng([1, 1, 1, 1, 1, 1, 1, 1])
  moveShip(game, s, [{ fwd: 20 }])
  turnAfterAground(game, s, 0)   // turned to face the island again
  game.round = 2; s.moved = 0; s.movedThisPhase = false
  assert.ok(moveShip(game, s, [{ fwd: 10 }]).aground)
})

test('torpedoes that reach an island are destroyed', () => {
  const { game, s } = setup([island(55, 60, 3)], { phase: 'shooting' })
  launchTorpedoes(game, s, 0)
  game.phase = 'ordnance'
  ordnancePhase(game)
  assert.equal(game.ordnance.length, 0)
  assert.ok(game.log.some(l => /island and is destroyed/.test(l.text)))
})

test('the sea battlezone: only islands, from the same rolls; no clouds, rifts, planets, flares or gravity wells', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const z = rollBattlezone(createRng(seed), { sea: true })
    assert.ok(z.terrain.every(t => t.kind === 'island'), `seed ${seed}: ${z.terrain.map(t => t.kind)}`)
    assert.equal(z.effects.flares + z.effects.bursts, 0)
  }
  // the space table is untouched by the change
  const space = rollBattlezone(createRng(5)), again = rollBattlezone(createRng(5))
  assert.deepEqual(space.terrain, again.terrain)
  assert.ok(!space.terrain.some(t => t.kind === 'island'))
})
