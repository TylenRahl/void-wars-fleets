// Tests for tabletop effects: solar flares, radiation bursts and other per-turn effects (rules/effects.js).
// Run by `npm test` (node:test); exports nothing.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { scriptedRng, createRng } from './dice.js'
import { createGame, addShip, leadershipTest, leadershipOf, giveOrder } from './game.js'
import { applyBattlezone, startOfTurnEffects, firingSunward } from './effects.js'
import { rollBattlezone, GENERATORS } from './terrain.js'

function setup (effects) {
  const game = createGame({ fleets: [{ name: 'Freemen', fleet: 'freemen' }, { name: 'Dominion', fleet: 'dominion' }] })
  const l = addShip(game, 0, 'lantern'), m = addShip(game, 1, 'malice')
  l.leadership = 8; m.leadership = 8
  l.pos = { x: 60, y: 60 }; l.facing = 0; m.pos = { x: 100, y: 60 }; m.facing = 180
  applyBattlezone(game, { zone: 1, sunward: 'right', terrain: [], log: [], effects })
  game.round = 1; game.active = 0; game.first = 0; game.phase = 'movement'
  return { game, l, m }
}

test('the generators match: the Flare Region is flare, flare, radiation, asteroids, clouds, planet', () => {
  assert.deepEqual(GENERATORS[1].t.slice(1, 4), ['flare', 'flare', 'radiation'])
  assert.deepEqual(GENERATORS[2].t.slice(1, 3), ['flare', 'radiation'])
  let flares = 0
  for (let seed = 1; seed < 60; seed++) flares += rollBattlezone(createRng(seed), { zone: 1 }).effects.flares
  assert.ok(flares > 0)
})

test('fighting sunward: only in zones 1-3, only towards the sunward edge', () => {
  const { game, l, m } = setup({ flares: 0, bursts: 0 })
  assert.ok(firingSunward(game, l.pos, m.pos), 'the Malice is to the right, the sunward edge')
  assert.ok(!firingSunward(game, m.pos, l.pos))
  game.effects.zone = 4
  assert.ok(!firingSunward(game, l.pos, m.pos), 'the primary biosphere: no effect')
})

test('a solar flare: a Blast Marker on every ship, once a game; ordnance removed on 4+', () => {
  const { game } = setup({ flares: 1, bursts: 0 })
  game.ordnance.push({ id: 99, kind: 'torpedo', side: 0, pos: { x: 10, y: 10 }, r: 1, str: 4 })
  game.rng = scriptedRng([6, 4])
  startOfTurnEffects(game)
  assert.equal(game.blast.length, 2)
  assert.equal(game.ordnance.length, 0)
  assert.ok(game.effects.flareDone)
  game.rng = scriptedRng([])
  startOfTurnEffects(game)   // no more rolls needed: it would throw on an empty script
})

test('a radiation burst: every ship -level Resolve this turn; fleet re-rolls only for Command checks on the flagship', () => {
  const { game, l } = setup({ flares: 0, bursts: 1 })
  game.rerolls[0] = { left: 2, flagship: 999 }
  game.decide.reroll = () => true
  game.rng = scriptedRng([5, 3])
  startOfTurnEffects(game)
  game.rng = scriptedRng([3, 3])
  const t = leadershipTest(game, l, { why: 'test' })
  assert.equal(t.need, leadershipOf(l) - 3)
  assert.equal(t.pass, false)
  assert.equal(game.rerolls[0].left, 2, 'not the flagship: no re-roll')
  game.round = 2
  game.rng = scriptedRng([3, 3])
  assert.equal(leadershipTest(game, l, { why: 'test' }).need, leadershipOf(l), 'the next turn it has passed')
})
