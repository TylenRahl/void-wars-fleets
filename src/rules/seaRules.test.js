// THE SEA HOUSE RULES (Tides of the Archipelago), only when game.sea:
// - a ship that sails into another collides: damage by size, the mover worse off; it stops, is pushed 1 cm clear and may be turned;
// - boarding reaches 15 cm, base edge to base edge, in the boarder's port or starboard arc, instead of base contact.
// In space (no game.sea) ships pass over and under each other and board only by touching.
// Run by `npm test` (node:test); exports nothing.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { scriptedRng } from './dice.js'
import { createGame, addShip, baseR } from './game.js'
import { moveShip, turnAfterAground, AGROUND_CLEAR, collisionDice, boardReach, canBoardFrom, SEA_BOARD_RANGE } from './movement.js'
import { endPhase } from './endPhase.js'
import { hullOf, hullOverlap } from './seaHull.js'

function setup ({ sea = true, mine = 'mars', theirs = 'malice', a = { x: 40, y: 60 }, b = { x: 60, y: 60 }, bFacing = 90, rng = Array(40).fill(1) } = {}) {
  const game = createGame({ fleets: [{ name: 'Human fleet', fleet: 'freemen' }, { name: 'Dominion fleet', fleet: 'dominion' }] })
  if (sea) game.sea = true
  const s = addShip(game, 0, mine), t = addShip(game, 1, theirs)
  s.leadership = 8; t.leadership = 8; s.pos = a; s.facing = 0; t.pos = b; t.facing = bFacing
  game.round = 1; game.active = 0; game.first = 0; game.phase = 'movement'
  game.rng = scriptedRng(rng)
  return { game, s, t }
}
// at sea the gap is between the hulls, not the bases (rules/seaHull.js)
const gap = (s, t) => -hullOverlap(hullOf(s), hullOf(t))

test('collision dice: the smaller mover takes D6+2 and gives 1; same size D6 and D3; the bigger D3 and D6', () => {
  const ship = type => ({ profile: { type } })
  assert.deepEqual(collisionDice(ship('escort'), ship('cruiser')), { mine: 'D6+2', theirs: '1' })
  assert.deepEqual(collisionDice(ship('cruiser'), ship('cruiser')), { mine: 'D6', theirs: 'D3' })
  assert.deepEqual(collisionDice(ship('battleship'), ship('cruiser')), { mine: 'D3', theirs: 'D6' })
})

test('at sea, sailing into a ship: stops, both take hits, pushed 1 cm clear facing the same way, may turn once', () => {
  const { game, s, t } = setup({ rng: [4, 5, ...Array(30).fill(1)] })   // mover D6 = 4, the other D3 = ceil(5/2) = 3
  const r = moveShip(game, s, [{ fwd: 20 }])
  assert.ok(r.ok && r.collided, 'the move reports the collision')
  assert.ok(game.log.some(l => /collides with/.test(l.text) && /D6 rolled 4/.test(l.text) && /D3 rolled 3/.test(l.text)), 'the log shows both rolls')
  assert.equal(s.damage, 2, '4 hits, 2 on the shields')
  assert.equal(t.damage, 1, '3 hits, 2 on the shields')
  assert.ok(gap(s, t) >= AGROUND_CLEAR - 0.11 && gap(s, t) < AGROUND_CLEAR + 0.2, `about ${AGROUND_CLEAR} cm clear (${gap(s, t)})`)
  assert.equal(s.facing, 0)
  assert.ok(s.movedThisPhase)
  assert.ok(turnAfterAground(game, s, 270).ok)
  assert.equal(turnAfterAground(game, s, 0).ok, false, 'once only')
})

test('at sea, after a collision and a turn it sails away without crashing again', () => {
  const { game, s, t } = setup()
  moveShip(game, s, [{ fwd: 20 }])
  turnAfterAground(game, s, 270)
  game.round = 2; s.moved = 0; s.movedThisPhase = false
  const hits = s.damage
  assert.ok(!moveShip(game, s, [{ fwd: 15 }]).collided)
  assert.equal(s.damage, hits)
  void t
})

test('at sea, a ship of its own squadron is no collision; another friendly ship is', () => {
  const { game, s } = setup({ b: { x: 90, y: 90 } })
  const f = addShip(game, 0, 'mars'); f.pos = { x: 60, y: 60 }; f.facing = 90
  assert.ok(moveShip(game, s, [{ fwd: 20 }]).collided, 'a friendly ship in the way is hit')
  const g2 = setup({ b: { x: 90, y: 90 } })
  const m = addShip(g2.game, 0, 'mars'); m.pos = { x: 60, y: 60 }; m.facing = 0
  g2.game.squadrons.push({ id: 1, side: 0, uids: [g2.s.uid, m.uid] })
  assert.ok(!moveShip(g2.game, g2.s, [{ fwd: 20 }]).collided, 'its squadron mate is not')
})

test('in space ships pass over each other', () => {
  const { game, s, t } = setup({ sea: false, b: { x: 52, y: 60 } })
  const r = moveShip(game, s, [{ fwd: 20 }])
  assert.ok(r.ok && !r.collided, JSON.stringify(r))
  assert.equal(s.damage, 0); assert.equal(t.damage, 0)
  assert.ok(s.pos.x > 59, 'it went on past')
})

test('boarding reach at sea: 15 cm in the port or starboard arc, not ahead, not beyond', () => {
  const { s, t } = setup()
  const edge = baseR(s) + baseR(t)
  t.pos = { x: 40, y: 60 + edge + SEA_BOARD_RANGE - 0.1 }; assert.ok(boardReach(s, t), 'starboard, just in reach')
  t.pos = { x: 40, y: 60 - edge - 10 }; assert.ok(boardReach(s, t), 'port')
  t.pos = { x: 40, y: 60 + edge + SEA_BOARD_RANGE + 1 }; assert.ok(!boardReach(s, t), '16 cm off')
  t.pos = { x: 40 + edge + 5, y: 60 }; assert.ok(!boardReach(s, t), 'dead ahead')
})

test('at sea a ship boards from range and the End Phase fights it; in space the same gap is no boarding', () => {
  for (const sea of [true, false]) {
    const { game, s, t } = setup({ sea, a: { x: 30, y: 60 } })
    t.pos = { x: 40, y: 60 + baseR(s) + baseR(t) + 8 }
    assert.ok(moveShip(game, s, [{ fwd: 10 }], { board: t.uid }).ok)
    assert.equal(canBoardFrom(game, s, t), sea)
    assert.equal(s.boarding != null, sea, sea ? 'declared at sea' : 'refused in space')
    game.phase = 'end'
    endPhase(game)
    assert.equal(game.log.some(l => /Boarding action/.test(l.text)), sea)
  }
})

test('at sea a drifting hulk in the way is a collision and is hit too', () => {
  const { game, s, t } = setup({ rng: [2, 2, ...Array(30).fill(1)] })
  t.state = 'drifting'
  assert.ok(moveShip(game, s, [{ fwd: 20 }]).collided)
  assert.ok(game.log.some(l => /colliding with it/.test(l.text) || /hulk/i.test(l.text)), 'the hulk takes its hit')
})

test('a ship starting 0.3 cm off another is pushed clear, not far behind where it began', () => {
  const { game, s, t } = setup()
  t.pos = { x: 60, y: 60 }; s.pos = { x: 40, y: 60 }
  s.pos = { x: 40 + gap(s, t) - 0.3, y: 60 }   // hulls 0.3 cm apart
  assert.ok(moveShip(game, s, [{ fwd: 10 }]).collided)
  assert.ok(gap(s, t) >= AGROUND_CLEAR - 0.11, 'clear of it')
  assert.ok(s.pos.x > 40 - 1.5, `not pushed far back (${s.pos.x})`)
})

test('boarding reach: a ship astern is not in a side arc', () => {
  const { s, t } = setup()
  t.pos = { x: 40 - baseR(s) - baseR(t) - 5, y: 60 }
  assert.ok(!boardReach(s, t))
})

