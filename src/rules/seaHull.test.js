// THE HULL AT SEA (Tides of the Archipelago): at sea a ship bumps into ships and islands with its drawn hull,
// not its base (rules/seaHull.js); islands are twice the size (terrain.js SEA_ISLAND_GROW).
// Run by `npm test` (node:test); exports nothing.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { scriptedRng, createRng } from './dice.js'
import { createGame, addShip, baseR } from './game.js'
import { moveShip, afterAgroundProblem, turnAfterAground } from './movement.js'
import { rollBattlezone } from './terrain.js'
import { hullOf, hullOverlap, seaHullLength, seaStandProblem, SEA_BEAM } from './seaHull.js'

function setup ({ a = { x: 40, y: 60 }, b = { x: 140, y: 100 }, bFacing = 0 } = {}) {
  const game = createGame({ fleets: [{ name: 'Human fleet', fleet: 'freemen' }, { name: 'Dominion fleet', fleet: 'dominion' }] })
  game.sea = true
  const s = addShip(game, 0, 'lantern'), t = addShip(game, 1, 'malice')
  s.leadership = 8; t.leadership = 8; s.pos = a; s.facing = 0; t.pos = b; t.facing = bFacing
  game.round = 1; game.active = 0; game.first = 0; game.phase = 'movement'
  game.rng = scriptedRng(Array(60).fill(1))
  return { game, s, t }
}
const island = (x, y, r) => ({ id: 7, kind: 'island', shape: { t: 'circ', x, y, r } })

test('a cruiser\'s hull at sea is 24 cm long and about a quarter of that wide, centred on its base', () => {
  const { s } = setup()
  assert.equal(seaHullLength(s), 24)
  const h = hullOf(s)
  assert.ok(Math.abs(h.r - 24 * SEA_BEAM / 2) < 1e-9)
  assert.ok(Math.abs((h.a.x + h.b.x) / 2 - 40) < 1e-9 && Math.abs(h.b.x - h.a.x - (24 - 2 * h.r)) < 1e-9, 'bow ahead, stern behind')
})

test('the hull runs aground on an island the base would have passed', () => {
  const { game, s } = setup()
  game.terrain = [island(60, 64.5, 2)]   // the base (1.6 cm) passes 0.9 cm clear; the hull (3.4 cm half-beam) does not
  assert.ok(64.5 - 60 - 2 > baseR(s))
  const r = moveShip(game, s, [{ fwd: 20 }])
  assert.ok(r.aground, JSON.stringify(r))
})

test('ships passing side by side collide by their hulls, though the bases are apart', () => {
  const { game, s, t } = setup({ b: { x: 60, y: 65 }, bFacing: 180 })   // 5 cm apart: bases clear (1.6 + 1.6), hulls not (3.4 + 3.4)
  const r = moveShip(game, s, [{ fwd: 20 }])
  assert.ok(r.collided, JSON.stringify(r))
  assert.ok(-hullOverlap(hullOf(s), hullOf(t)) >= 0.89, 'pushed clear of it')
})

test('the bow swinging round on a turn hits a ship beside it', () => {
  const { game, s } = setup({ b: { x: 50, y: 70 }, bFacing: 0 })   // abeam, 10 cm off: clear going straight
  const r = moveShip(game, s, [{ fwd: 10 }, { turn: 45 }])
  assert.ok(r.collided, JSON.stringify(r))
  assert.ok(Math.abs(s.facing) < 45, 'stopped before it had swung all the way')
})

test('set-up at sea: no ship put down with its hull over another ship or on an island; clear water is fine', () => {
  const { game, s, t } = setup({ b: { x: 60, y: 60 } })
  game.terrain = [island(100, 30, 10)]
  assert.match(seaStandProblem(game, s, { x: 45, y: 60 }, 0), /overlap Malice|overlap/)
  assert.match(seaStandProblem(game, s, { x: 100, y: 42 }, 0), /island/)
  assert.equal(seaStandProblem(game, s, { x: 30, y: 90 }, 0), null)
  void t
})

test('after a crash, a heading that would swing the hull onto another ship is refused', () => {
  const { game, s, t } = setup({ b: { x: 66, y: 60 }, bFacing: 90 })
  moveShip(game, s, [{ fwd: 20 }])
  assert.ok(s.aground)
  t.pos = { x: s.pos.x, y: s.pos.y + 9 }; t.facing = 0   // now lying alongside, 9 cm off
  assert.match(afterAgroundProblem(game, s, 90) ?? '', /overlap/)
  assert.equal(afterAgroundProblem(game, s, s.facing), null, 'keeping its heading is always allowed')
  assert.equal(turnAfterAground(game, s, 90).ok, false)
})

test('the islands at sea are twice the rolled size', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const z = rollBattlezone(createRng(seed), { sea: true })
    for (const t of z.terrain.filter(t => t.kind === 'island')) {
      if (t.islet) assert.equal(t.shape.r, 4)
      else if (t.shape.t === 'ell') assert.ok(t.size.every(n => n % 10 === 0), `field islands in 10 cm steps (${t.size})`)
      else assert.ok([24, 40, 60].includes(t.shape.r * 2), `planet island ${t.shape.r * 2} cm`)
    }
  }
})
