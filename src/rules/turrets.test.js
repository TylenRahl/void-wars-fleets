// Tests for massed turrets and combat air patrol.
// Run by `npm test` (node:test); exports nothing.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createGame, addShip } from './game.js'
import { launchCraft, moveWave, ordnancePhase, turretDice, releaseCap } from './ordnance.js'
import { moveShip } from './movement.js'

function duel () {
  const game = createGame({ fleets: [{ name: 'Freemen', fleet: 'freemen' }, { name: 'Dominion', fleet: 'dominion' }] })
  const d = addShip(game, 0, 'steward'), m = addShip(game, 1, 'malice')
  d.leadership = 8; m.leadership = 8
  d.pos = { x: 40, y: 60 }; d.facing = 0; m.pos = { x: 70, y: 60 }; m.facing = 180
  // give the Malice a launch bay so Dominion can fly bombers in these tests
  m.profile = { ...m.profile, weapons: [...m.profile.weapons, { loc: 'port', kind: 'bays', range: 30, str: 2, arc: [] }] }
  game.round = 1; game.active = 0; game.first = 0; game.phase = 'shooting'
  return { game, d, m }
}

test('massed turrets: +1 for each ship in base contact, at most three; crippled ships can\'t add theirs', () => {
  const { game, m } = duel()
  const friends = ['bloodshed', 'shambles', 'gallows', 'charnel'].map((id, i) => { const s = addShip(game, 1, id); s.leadership = 8; s.pos = { x: 70 + [3.2, -3.2, 0, 0][i], y: 60 + [0, 0, 3.2, -3.2][i] }; return s })
  assert.equal(turretDice(game, m, 'craft'), 2 + 3, 'four in contact, only three count')
  game.round = 2
  for (const f of friends) f.damage = f.profile.hits / 2
  assert.equal(turretDice(game, m, 'craft'), 2, 'crippled ships can\'t mass')
})

test('turrets fire at torpedoes or attack craft in a turn, not both; massing ships share the choice', () => {
  const { game, m } = duel()
  const c = addShip(game, 1, 'bloodshed'); c.leadership = 8; c.pos = { x: 73.2, y: 60 }
  assert.equal(turretDice(game, m, 'torpedo'), 3)
  assert.equal(turretDice(game, m, 'craft'), 0)
  assert.equal(turretDice(game, c, 'craft'), 0, 'the Bloodshed massed against torpedoes this turn too')
  game.active = 1
  assert.equal(turretDice(game, m, 'craft'), 3, 'a new turn, a new choice')
})

test('combat air patrol: fighters join a friendly ship, move with it, don\'t move again in their own Ordnance Phase, and screen it', () => {
  const { game, d, m } = duel()
  assert.ok(launchCraft(game, d, { fighter: 2 }).ok)
  game.phase = 'ordnance'; ordnancePhase(game)
  const cap = game.ordnance.find(o => o.kind === 'wave')
  assert.ok(moveWave(game, cap.id, d.pos, { cap: d.uid }).ok)
  assert.equal(cap.cap, d.uid)
  // the Dominion turn: a wave of two bombers flies at the Steward; the two fighters on CAP take both out before turrets
  game.active = 1; game.phase = 'shooting'; m.pos = { x: 55, y: 60 }   // bombers fly 20 cm
  assert.ok(launchCraft(game, m, { bomber: 2 }).ok)
  game.phase = 'ordnance'; ordnancePhase(game)
  const bombers = game.ordnance.find(o => o.side === 1)
  assert.ok(moveWave(game, bombers.id, d.pos).ok)
  assert.equal(d.damage, 0)
  assert.ok(!game.ordnance.includes(bombers), 'both bomber squadrons intercepted')
  assert.ok(!game.ordnance.includes(cap), 'and both fighters spent')
})

test('CAP moves with its ship; it may leave at the start of its Manoeuvre Phase', () => {
  const { game, d } = duel()
  launchCraft(game, d, { fighter: 1 })
  game.phase = 'ordnance'; ordnancePhase(game)
  const cap = game.ordnance.find(o => o.kind === 'wave')
  moveWave(game, cap.id, d.pos, { cap: d.uid })
  game.round = 2; game.phase = 'movement'
  assert.ok(moveShip(game, d, [{ fwd: 15 }]).ok)
  assert.deepEqual(cap.pos, d.pos)
  assert.equal(releaseCap(game, cap.id).ok, false, 'too late: the ship has moved')
  game.phase = 'ordnance'; ordnancePhase(game)
  assert.equal(moveWave(game, cap.id, { x: 80, y: 20 }).ok, false, 'no double move')
})

test('fighters that reach an enemy ship do nothing and stay in play', () => {
  const { game, d, m } = duel()
  launchCraft(game, d, { fighter: 1 })
  game.phase = 'ordnance'; ordnancePhase(game)
  const w = game.ordnance.find(o => o.kind === 'wave')
  assert.ok(moveWave(game, w.id, m.pos).ok)
  assert.ok(game.ordnance.includes(w))
  assert.equal(m.damage, 0)
})
