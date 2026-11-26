// Tests for planetary defences (rules/defences.js).
// Run by `npm test` (node:test); exports nothing.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { scriptedRng } from './dice.js'
import { createGame, addShip, giveOrder } from './game.js'
import { critical } from './damage.js'
import { weaponWorks } from './shooting.js'
import { moveShip } from './movement.js'
import { createScenario } from './scenarios.js'
import { buyDefence, canBuy, doneBuying, defenceReason, placeDefence, moveMines, detonateFireShip, minefieldDetection, clearDefenceBlast, LEADERSHIP } from './defences.js'
import { fleetVictoryPoints } from './fleet.js'
import { canTeleport, endPhase } from './endPhase.js'
import { enterLowOrbit } from './lowOrbit.js'

function world () {
  const game = createGame({ fleets: [{ name: 'Freemen', fleet: 'freemen' }, { name: 'Dominion', fleet: 'dominion' }] })
  game.terrain = [{ id: 1, kind: 'planet', size: 'medium', shape: { t: 'circ', x: 90, y: 60, r: 10 } }]   // well 15 cm
  game.round = 1; game.active = 0; game.first = 0; game.phase = 'movement'
  const def = id => { const s = addShip(game, 0, id); s.leadership = LEADERSHIP; return s }
  return { game, def }
}

test('the budget: D6x10 per 500 points or part; ground defences need a low orbit table; 0-X limits', () => {
  const g = createScenario({ id: 'surprise', lists: [{ name: 'Freemen Navy', fleet: 'freemen', ships: ['lantern', 'rimward', 'cannonade'] }, { name: 'Dominion', fleet: 'dominion', ships: ['malice', 'bloodshed'], commander: 'harrowadmiral-8' }], attacker: 1, limit: 1000, seed: 2 })
  assert.equal(g.setupStep, 'defences')
  assert.ok(g.defenceBudget.points >= 20 && g.defenceBudget.points <= 120 && g.defenceBudget.points % 10 === 0, '550 points: two rolls')
  assert.ok(/low orbit/.test(canBuy(g, 'lasersilo')))
  g.defenceBudget.points = 100
  assert.ok(buyDefence(g, 'laserplatform').ok); assert.ok(buyDefence(g, 'weaponsplatform').ok)
  assert.ok(/points left/.test(canBuy(g, 'orbitaldock')))
  doneBuying(g)
  assert.equal(g.setupStep, 'place')
})

test('stationary defences: inside a gravity well, never move, Resolve 7, only Reload and Brace', () => {
  const { game, def } = world()
  const p = def('laserplatform')
  assert.ok(defenceReason(game, p, { x: 20, y: 20 }), 'outside the well')
  assert.equal(defenceReason(game, p, { x: 90, y: 47 }), null)
  placeDefence(game, p, { x: 90, y: 47 })
  assert.equal(moveShip(game, p, [{ fwd: 1 }]).ok, false)
  assert.equal(giveOrder(game, p, 'lockOn').ok, false)
  assert.equal(p.leadership, 7)
  game.lowOrbit = { planet: 1, size: 'medium' }
  assert.equal(enterLowOrbit(game, p, 60).ok, false, 'and never goes into low orbit')
})

test('the defences critical hits table: Main Armament Damaged silences the batteries', () => {
  const { game, def } = world()
  const dock = def('orbitaldock'); placeDefence(game, dock, { x: 90, y: 47 })
  critical(game, dock, 4)
  assert.equal(dock.crits.main, 1)
  assert.equal(weaponWorks(dock, dock.profile.weapons[0]), false)
  critical(game, dock, 2)   // no lances: the next one up, Main Armament again
  assert.equal(dock.crits.main, 2)
})

test('orbital mines home 10 cm on the nearest enemy ship and roll eight dice when they reach it', () => {
  const { game, def } = world()
  const m = def('orbitalmine'); placeDefence(game, m, { x: 90, y: 46 })
  const malice = addShip(game, 1, 'malice'); malice.leadership = 8; malice.pos = { x: 90, y: 30 }; malice.facing = 90
  const mine = game.ordnance.find(o => o.kind === 'mine')
  game.rng = scriptedRng([])
  moveMines(game)
  assert.ok(Math.abs(mine.pos.y - 36) < 1e-6, 'moved 10 cm')
  game.rng = scriptedRng([1, 1, 6, 6, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1])   // turrets miss; eight dice, armour 6 front: three 6s
  moveMines(game)
  assert.ok(!game.ordnance.includes(mine))
  assert.equal(malice.damage, 1, 'two shields, then one hit')
  assert.equal(fleetVictoryPoints(game, 1), 5, 'a bought mine is worth 5 points however it goes')
})

test('a fire ship detonates: D3 Fire criticals on every ship in 3D6 cm, escorts destroyed', () => {
  const { game, def } = world()
  const f = def('fireship'); f.pos = { x: 30, y: 30 }; f.facing = 0
  const ico = addShip(game, 1, 'profaner'); ico.leadership = 7; ico.pos = { x: 35, y: 30 }
  const malice = addShip(game, 1, 'malice'); malice.leadership = 8; malice.pos = { x: 38, y: 30 }
  game.rng = scriptedRng([4, 4, 4, 1, 2])   // 12 cm; the Profaner's D3; the Malice's D3 = 1
  assert.ok(detonateFireShip(game, f.uid).ok)
  assert.equal(f.state, 'expended')
  assert.equal(ico.state, 'destroyed')
  assert.equal(malice.crits.fire, 1)
})

test('a minefield releases a mine at enemies within 30 cm on 5+; Blast Markers clear off stations', () => {
  const { game, def } = world()
  const mf = def('minefield')
  assert.equal(defenceReason(game, mf, { x: 90, y: 40 }), null)
  game.rng = scriptedRng([2, 2])
  placeDefence(game, mf, { x: 90, y: 40 })
  const malice = addShip(game, 1, 'malice'); malice.leadership = 8; malice.pos = { x: 90, y: 20 }
  game.phase = 'ordnance'; game.rng = scriptedRng([5])
  minefieldDetection(game)
  assert.equal(game.ordnance.filter(o => o.kind === 'mine').length, 1)
  const st = def('weaponsplatform'); placeDefence(game, st, { x: 70, y: 60 })
  game.blast.push({ id: 90, x: 72, y: 60 }, { id: 91, x: 68, y: 60 })
  game.rng = scriptedRng([6])
  clearDefenceBlast(game)
  assert.equal(game.blast.length, 0)
})

test('teleports: one a turn; a defence with one damage point left can\'t', () => {
  const { game, def } = world()
  const dock = def('weaponsplatform'); dock.pos = { x: 40, y: 40 }
  const m = addShip(game, 1, 'profaner'); m.leadership = 7; m.pos = { x: 45, y: 40 }; m.crits.shields = 1
  assert.ok(/one damage point/.test(canTeleport(game, dock, m)))
  const l = addShip(game, 0, 'lantern'); l.leadership = 8; l.pos = { x: 50, y: 45 }; l.facing = 0
  game.phase = 'end'; game.rng = scriptedRng([5, 1, 1, 1, 1, 1, 1, 1])
  endPhase(game, { teleports: [[l.uid, m.uid], [l.uid, m.uid]] })
  assert.ok(game.log.some(x => /one teleport attack each turn/.test(x.text)))
})
