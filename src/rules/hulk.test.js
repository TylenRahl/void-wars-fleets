// Tests for the Dominion Derelict.
// Run by `npm test` (node:test); exports nothing.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createGame, addShip, giveOrder, leadershipOf } from './game.js'
import { moveShip, checkMove } from './movement.js'
import { baysOf } from './ordnance.js'
import { checkFleet } from './fleet.js'
import { baseColumn } from './shooting.js'

function setup () {
  const game = createGame({ fleets: [{ name: 'Freemen', fleet: 'freemen' }, { name: 'Dominion', fleet: 'dominion' }] })
  const h = addShip(game, 1, 'spacehulk'), l = addShip(game, 0, 'lantern')
  h.leadership = 8; l.leadership = 8
  h.pos = { x: 90, y: 60 }; h.facing = 0; l.pos = { x: 40, y: 20 }; l.facing = 0
  game.round = 1; game.active = 1; game.first = 1; game.phase = 'movement'
  return { game, h, l }
}

test('a derelict moves exactly 10 cm straight, turning up to 45° at the end only every second Manoeuvre Phase', () => {
  const { game, h } = setup()
  assert.equal(checkMove(game, h, [{ fwd: 8 }]).ok, false)
  assert.equal(checkMove(game, h, [{ fwd: 12 }]).ok, false)
  assert.equal(checkMove(game, h, [{ fwd: 5 }, { turn: 45 }, { fwd: 5 }]).ok, false, 'the turn comes at the end')
  assert.equal(checkMove(game, h, [{ fwd: 10 }, { turn: 60 }]).ok, false)
  assert.ok(moveShip(game, h, [{ fwd: 10 }, { turn: 45 }]).ok)
  game.round = 2; h.movedThisPhase = false
  assert.equal(checkMove(game, h, [{ fwd: 10 }, { turn: 45 }]).ok, false, 'it turned last time')
  assert.ok(checkMove(game, h, [{ fwd: 10 }]).ok)
})

test('a derelict: -1 Resolve after everything, no Burn Retros or All Ahead Full, twice its bays, a Defence to shoot at', () => {
  const { game, h } = setup()
  h.leadership = 10
  assert.equal(leadershipOf(h), 9)
  assert.equal(giveOrder(game, h, 'burnRetros').ok, false)
  assert.equal(giveOrder(game, h, 'newHeading').ok, false)
  assert.equal(baysOf(h), 16)
  assert.equal(baseColumn(h, 'abeam'), 0)
  assert.deepEqual(checkFleet({ name: 'C', fleet: 'dominion', ships: ['spacehulk', 'malice', 'bloodshed', 'shambles'], commander: 'harrowadmiral-8' }, 1500), [])
  assert.ok(checkFleet({ name: 'C', fleet: 'dominion', ships: ['spacehulk', 'spacehulk'], commander: 'harrowadmiral-8' }, 3000).some(w => /0-1/.test(w)))
})

test('the hulk\'s own gravity well: a ship holding orbit within 5 cm of its base is carried along', () => {
  const { game, h, l } = setup()
  l.pos = { x: 90, y: 67 }; l.facing = 0   // 4 cm from the hulk's base edge (base radius 3 cm)
  game.active = 0
  assert.ok(checkMove(game, l, []).orbit)
  assert.ok(moveShip(game, l, []).ok)
  assert.equal(l.orbiting, h.uid)
  game.active = 1
  assert.ok(moveShip(game, h, [{ fwd: 10 }]).ok)
  assert.deepEqual(l.pos, { x: 100, y: 67 })
})
