// Tests for celestial phenomena (rules/terrain.js): each test sets one phenomenon by hand and checks its rule with fixed dice.
// Run by `npm test` (node:test); exports nothing.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { scriptedRng, createRng } from './dice.js'
import { createGame, addShip, shieldsLeft, commandModifiers } from './game.js'
import { checkMove, moveShip } from './movement.js'
import { fireShip, canTarget } from './shooting.js'
import { launchTorpedoes, ordnancePhase } from './ordnance.js'
import { lineOfFire, rollBattlezone, wellsAt, WELL } from './terrain.js'

function setup (terrain, { a = { x: 40, y: 60 }, b = { x: 70, y: 60 }, aFacing = 0, bFacing = 180, phase = 'shooting' } = {}) {
  const game = createGame({ fleets: [{ name: 'Freemen', fleet: 'freemen' }, { name: 'Dominion', fleet: 'dominion' }] })
  game.terrain = terrain
  const s = addShip(game, 0, 'lantern'), t = addShip(game, 1, 'malice')
  s.leadership = 8; t.leadership = 8; s.pos = a; s.facing = aFacing; t.pos = b; t.facing = bFacing
  game.round = 1; game.active = 0; game.first = 0; game.phase = phase
  return { game, s, t }
}
const cloud = (x, y, rx = 6, ry = 3) => ({ id: 1, kind: 'cloud', shape: { t: 'ell', x, y, rx, ry, rot: 0 } })
const field = (x, y, rx = 5, ry = 5) => ({ id: 2, kind: 'asteroids', shape: { t: 'ell', x, y, rx, ry, rot: 0 } })

test('a gas/dust cloud is a single Blast Marker in all respects: shields -1, under fire -1, slows a move by 5 cm', () => {
  const { game, s } = setup([cloud(41, 60)])
  assert.equal(shieldsLeft(game, s), 1)
  assert.equal(commandModifiers(game, s).under, -1)
  const far = setup([cloud(52, 60)]); far.game.phase = 'movement'
  assert.equal(checkMove(far.game, far.s, [{ fwd: 20 }]).max, 15, 'moving through it costs 5 cm')
})

test('asteroid fields and aether rifts block the line of fire; no shooting into or out of a field', () => {
  assert.match(lineOfFire({ terrain: [field(55, 60)] }, { x: 40, y: 60 }, { x: 70, y: 60 }), /asteroid field blocks/)
  assert.match(lineOfFire({ terrain: [field(40, 60)] }, { x: 40, y: 60 }, { x: 70, y: 60 }), /into or out of/)
  assert.equal(lineOfFire({ terrain: [field(45, 60, 10, 5)] }, { x: 40, y: 60 }, { x: 48, y: 60 }), null, 'both inside, within 10 cm')
  assert.match(lineOfFire({ terrain: [{ kind: 'rift', shape: { t: 'ell', x: 55, y: 60, rx: 2, ry: 6, rot: 0 } }] }, { x: 40, y: 60 }, { x: 70, y: 60 }), /aether rift/)
})

test('a planet blocks the line of fire unless a ship\'s stem is on it', () => {
  const planet = { kind: 'planet', size: 'small', shape: { t: 'circ', x: 55, y: 60, r: 6 } }
  assert.match(lineOfFire({ terrain: [planet] }, { x: 40, y: 60 }, { x: 70, y: 60 }), /planet blocks/)
  assert.equal(lineOfFire({ terrain: [planet] }, { x: 52, y: 60 }, { x: 70, y: 60 }), null)
  const { game, s, t } = setup([planet], { b: { x: 70, y: 60 } })
  assert.equal(canTarget(game, s, s.profile.weapons[0], t.pos), false)
})

test('crossing an asteroid field takes a Resolve Test; failed, D6 damage with shields but no Blast Markers, 5 cm slower', () => {
  const { game, s } = setup([field(50, 60, 3, 3)], { phase: 'movement' })
  game.rng = scriptedRng([6, 6, 4, 1, 1])   // test 12 fails; D6 = 4 hits: 2 on shields, 2 damage, two critical rolls of 1
  assert.ok(moveShip(game, s, [{ fwd: 20 }]).ok)
  assert.equal(s.damage, 2)
  assert.equal(game.blast.length, 0)
  assert.ok(Math.abs(s.pos.x - 55) < 0.01, 'slowed 5 cm')
})

test('torpedoes that strike an asteroid field detonate', () => {
  const { game, s } = setup([field(55, 60, 2, 4)], { b: { x: 70, y: 90 } })
  launchTorpedoes(game, s, 0)
  game.phase = 'ordnance'
  ordnancePhase(game)
  assert.equal(game.ordnance.length, 0)
  assert.ok(game.log.some(l => /detonates/.test(l.text)))
})

test('gravity wells: a free turn towards the planet at the start or end of the move, and high orbit', () => {
  const planet = { kind: 'planet', size: 'medium', shape: { t: 'circ', x: 40, y: 80, r: 10 } }
  const { game, s } = setup([planet], { a: { x: 40, y: 60 }, phase: 'movement' })
  assert.equal(wellsAt(game, s.pos).length, 1, `within ${WELL.medium} cm of the edge`)
  // the planet is below (+y): turning towards it is clockwise, up to 45°
  assert.ok(checkMove(game, s, [{ turn: 45, gravity: true }, { fwd: 20 }]).ok)
  assert.ok(!checkMove(game, s, [{ turn: -45, gravity: true }, { fwd: 20 }]).ok, 'away from the planet')
  assert.ok(checkMove(game, s, []).ok, 'high orbit: it need not move')
  s.order = { kind: 'lockOn' }
  assert.ok(checkMove(game, s, [{ turn: 30, gravity: true }, { fwd: 10 }]).ok, 'even on Lock On, which forbids turns')
})

test('a rolled battlezone: 60 cm areas, phenomena on 4+, at most one planet, standard sizes', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const z = rollBattlezone(createRng(seed))
    assert.ok(z.terrain.filter(t => t.kind === 'planet' && !t.moon).length <= 1)
    for (const t of z.terrain) {
      if (t.kind === 'asteroids') assert.ok([5, 10, 15].includes(t.size[0]) && [5, 10, 15].includes(t.size[1]))
      if (t.kind === 'cloud' && !t.ring) assert.ok(t.size[1] % 2 === 0 && t.size[1] <= 12 && t.size[0] % 5 === 0 && t.size[0] <= 30)
    }
    assert.ok(z.log.length >= 8)
  }
})
