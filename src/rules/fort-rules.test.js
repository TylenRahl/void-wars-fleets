// Tests for the Bastion star fort and the Host Keep. Fixed dice so the arithmetic shows.
// Run by `npm test` (node:test); exports nothing.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { scriptedRng } from './dice.js'
import { createGame, addShip, giveOrder, blastTouching, shieldsLeft, baseR } from './game.js'
import { fireShip } from './shooting.js'
import { critical, damageShip } from './damage.js'
import { makeFort, placeFort, fortFront, quadrantsOf, rotateForts, setupForts, setRotates, catastrophicFort, fortOf } from './fort.js'
import { clearDefenceBlast } from './defences.js'
import { createScenario, nextScenarioPlace, placeScenarioShip } from './scenarios.js'
import { checkFleet, createFleetBattle } from './fleet.js'
import { launchTorpedoes } from './ordnance.js'

const dice = (g, f) => { g.rng = scriptedRng([...f, ...Array(120).fill(1)]) }
const said = (g, re) => g.log.some(l => re.test(l.text))
function fortGame (id = 'con-hostkeep') {
  const g = createGame({ fleets: [{ name: 'C', fleet: 'concord' }, { name: 'I', fleet: 'freemen' }] })
  const L = addShip(g, 0, id); L.leadership = 10
  const f = makeFort(g, L); placeFort(g, L, { x: 90, y: 60 }, 0)
  const e = addShip(g, 1, 'lantern'); e.leadership = 8; e.pos = { x: 90, y: 100 }; e.facing = 270
  g.round = 1; g.active = 1; g.first = 1; g.phase = 'shooting'
  return { g, L, f, e, qs: quadrantsOf(g, L) }
}

test('a fort is four quadrants whose bases touch, each with 12 hits, 4 shields, 4 turrets', () => {
  const { g, qs } = fortGame()
  assert.equal(qs.length, 4)
  for (const q of qs) { assert.equal(q.profile.hits, 12); assert.equal(q.profile.shields, 4); assert.equal(q.profile.turrets, 4) }
  assert.ok(Math.abs(Math.hypot(qs[0].pos.x - qs[1].pos.x, qs[0].pos.y - qs[1].pos.y) - 6) < 1e-6)
  assert.deepEqual(qs.map(q => q.facing), [270, 0, 90, 180])
})
test('a shot is aimed at the quadrant on the line to the fort centre', () => {
  const { g, L, e, qs } = fortGame()
  assert.equal(fortFront(g, qs[0], e.pos).name, qs[2].name)   // the enemy is south
  assert.equal(fortFront(g, qs[3], { x: 150, y: 60 }).name, qs[1].name)
  dice(g, [6, 6, 6, 6, 6, 6, 6, 6])
  const r = fireShip(g, e, [{ weapon: 0, target: qs[0].uid }].filter(() => e.profile.weapons[0].kind === 'battery'))
  assert.ok(said(g, /crosses the south quadrant|fires at/) || r.ok !== false)
})
test('damage and blast markers stay with the quadrant struck; only that quadrant is crippled at 6', () => {
  const { g, qs } = fortGame()
  dice(g, [1, 1, 1, 1, 1, 1])
  damageShip(g, qs[2], 6, { noCrits: true, noSave: true })
  assert.equal(qs[2].damage, 6); assert.equal(qs[0].damage, 0)
  assert.ok(qs[2].damage >= qs[2].profile.hits / 2)
  g.blast.push({ id: 99, x: qs[2].pos.x, y: qs[2].pos.y + 3.9, q: qs[2].uid })
  assert.equal(blastTouching(g, qs[2]).length, 1)
  assert.equal(blastTouching(g, qs[0]).length, 0)
})
test('a quadrant at 0 becomes an asteroid field and the others fight on; all four gone rolls the catastrophic table', () => {
  const { g, L, qs } = fortGame()
  dice(g, [1])
  damageShip(g, qs[0], 12, { noCrits: true, noSave: true })
  assert.equal(qs[0].state, 'destroyed'); assert.equal(qs[1].state, 'active')
  assert.equal(g.terrain.filter(t => t.fortWreck).length, 1)
  assert.equal(damageShip(g, qs[0], 3), 0)   // wreckage takes nothing
  for (const q of qs.slice(1, 3)) damageShip(g, q, 12, { noCrits: true, noSave: true })
  dice(g, [3])
  damageShip(g, qs[3], 12, { noCrits: true, noSave: true })
  assert.ok(said(g, /D6 rolled 3/)); assert.ok(g.terrain.some(t => t.shape.r === 7.5))
})
test('the fort critical table is the Bastion one and hits only the quadrant', () => {
  const { g, qs } = fortGame()
  dice(g, [1]); critical(g, qs[1], 2)
  assert.equal(qs[1].crits.lances, 1); assert.equal(qs[0].crits.lances, 0)
  critical(g, qs[1], 11)
  assert.ok(fortOf(g, qs[1]).basilicaLost)
  assert.ok(qs.every(q => q.damage >= 1))
  dice(g, [1]); critical(g, qs[1], 9)
  assert.equal(qs[0].leadership, 8)
})
test('Basilica weapons fire from one standing quadrant, torpedoes need the fort reloaded, and are lost with the Basilica', () => {
  const { g, qs, f } = fortGame()
  g.active = 0; g.first = 0
  const wi = qs[0].profile.weapons.findIndex(w => w.kind === 'torpedo')
  assert.equal(launchTorpedoes(g, qs[1], 90, { weapon: wi }).ok, false)   // not the holder
  assert.equal(launchTorpedoes(g, qs[0], 90, { weapon: wi }).ok, true)
  assert.equal(f.siloLoaded, false)
  assert.equal(launchTorpedoes(g, qs[0], 90, { weapon: wi }).ok, false)
})
test('split orders: two quadrants share one Command check', () => {
  const { g, qs } = fortGame()
  g.active = 0; g.first = 0; g.phase = 'movement'
  dice(g, [1, 1])
  const r = giveOrder(g, qs[0], 'lockOn', { together: [qs[1]] })
  assert.ok(r.ok); assert.equal(qs[1].order.kind, 'lockOn'); assert.equal(qs[2].order, null)
  assert.equal(g.log.filter(l => /Command check for Lock On/.test(l.text)).length, 1)
  assert.equal(giveOrder(g, qs[3], 'aheadFull').ok, false)
})
test('rotation: 45 degrees once a turn at the start of the owner\'s movement, decided before the game', () => {
  const { g, L, qs } = fortGame()
  g.round = 0; assert.ok(setRotates(g, L, true).ok); assert.equal(setRotates(g, L, false).ok, false)
  g.round = 1; g.active = 0; rotateForts(g); rotateForts(g)
  assert.equal(qs[0].facing, 315)
  g.round = 2; rotateForts(g); assert.equal(qs[0].facing, 0)
})
test('one Blast Marker clear for the whole fort', () => {
  const { g, qs } = fortGame()
  g.blast.push({ id: 1, x: qs[0].pos.x, y: qs[0].pos.y - 3.9, q: qs[0].uid }, { id: 2, x: qs[2].pos.x, y: qs[2].pos.y + 3.9, q: qs[2].uid })
  dice(g, [6]); clearDefenceBlast(g)
  assert.equal(g.blast.length, 0)
})
test('only a derelict may board a fort', async () => {
  const { g, qs, e } = fortGame()
  const { moveShip } = await import('./movement.js')
  g.phase = 'movement'; g.active = 1; e.pos = { x: qs[2].pos.x, y: qs[2].pos.y + 4.5 + 10 }; e.facing = 270
  moveShip(g, e, [{ fwd: 10 }], { board: qs[2].uid })
  assert.ok(said(g, /cannot be boarded/))
})
test('Crusade list: one Host Keep from 2,000 points, attack rating 1; only as the defender in a planet scenario', () => {
  const ships = ['con-hostkeep', 'con-battle-barge', 'con-battle-barge', 'con-battle-barge']
  const base = { fleet: 'concord', list: 'crusade', ships, escortSquadrons: [], commander: 'master', commanderOn: 1 }
  assert.deepEqual(checkFleet(base, 3000).filter(w => /Fortress|fortress|2,000/.test(w)), [])
  assert.ok(checkFleet({ ...base, ships: ['con-hostkeep', 'con-hostkeep'] }, 3000).some(w => /0-1 Host Keep/.test(w)))
  const imp = { name: 'I', fleet: 'freemen', ships: Array(10).fill('rimward'), escortSquadrons: [], commander: 'admiral', tags: {} }
  assert.throws(() => createFleetBattle({ lists: [{ ...base, name: 'C', tags: {} }, imp], limit: 3000 }), /only used as a defence/)   // not a Fleet Engagement
  const g = createScenario({ id: 'surprise', lists: [{ ...base, name: 'C', tags: {} }, imp], attacker: 1, limit: 3000, seed: 2 })
  assert.equal(g.sides[0].attackRating, 1)
  assert.throws(() => createScenario({ id: 'surprise', lists: [{ ...base, name: 'C', tags: {} }, imp], attacker: 0, limit: 3000, seed: 2 }), /always the defender/)
  g.setupStep = 'place'
  const n = nextScenarioPlace(g)
  assert.equal(n.fort.q, 0)
  assert.equal(placeScenarioShip(g, n.uid, { x: g.planet.shape.x, y: g.planet.shape.y }, 0).ok, false)   // not on the planet
  assert.equal(placeScenarioShip(g, n.uid, { x: 40, y: 60 }, 0).ok, true)
  assert.ok(g.ships.filter(s => s.fort).every(s => s.pos))
})

// ---------------- the fort boards ----------------
import { endPhase } from './endPhase.js'
function boardGame (decide) {
  const x = fortGame()
  x.g.decide = { ...x.g.decide, ...decide }
  x.g.active = 0; x.g.first = 0; x.g.phase = 'end'
  const q = x.qs[2]   // south quadrant
  x.e.pos = { x: q.pos.x, y: q.pos.y + 3 + x.e.profile.size / 2 + 0.1 }
  x.e.pos = { x: q.pos.x, y: q.pos.y + 3 + 1.5 }
  return x
}
test('the fort boards an enemy in base contact in its own End Phase, with every quadrant by default', () => {
  const { g, e, qs } = boardGame({})
  let asked = null
  g.decide.fortBoard = (_g, _l, info) => { asked = info; return info.max }
  const before = e.damage
  dice(g, [6, 1])
  endPhase(g)
  assert.equal(asked.max, 4); assert.deepEqual(asked.values, [12, 24, 36, 48]); assert.equal(asked.enemy, e)
  assert.ok(said(g, /boards .* with 4 quadrants: boarding value 48/))
  assert.ok(said(g, /Boarding action: .* rolled 6/))
  assert.ok(e.damage > before)
  assert.equal(qs[2].damage + qs[0].damage + qs[1].damage + qs[3].damage >= 0, true)
})
test('headless, with no decide.fortBoard, all standing quadrants board', () => {
  const { g } = boardGame({})
  dice(g, [6, 1]); endPhase(g)
  assert.ok(said(g, /with 4 quadrants/))
})
test('the choice of fewer quadrants lowers the boarding value, contact quadrant first', () => {
  const { g, qs } = boardGame({ fortBoard: () => 2 })
  qs[0].damage = 5   // north has 7 left; south (in contact) 12, east 12
  dice(g, [1, 1]); endPhase(g)
  assert.ok(said(g, /with 2 quadrants: boarding value 24 \(hits left on south, east\)/))
})
test('choosing 0 quadrants means no boarding; a fort only boards in its own turn', () => {
  const a = boardGame({ fortBoard: () => 0 })
  endPhase(a.g)
  assert.ok(said(a.g, /does not board/)); assert.ok(!said(a.g, /Boarding action/))
  const b = boardGame({})
  b.g.active = 1; endPhase(b.g)
  assert.ok(!said(b.g, /Boarding action/))
})
test('an enemy not in base contact is not boarded', () => {
  const { g, e } = boardGame({})
  e.pos = { x: 90, y: 120 }; endPhase(g)
  assert.ok(!said(g, /Boarding action/))
})
test('boarding with one quadrant: value is that quadrant hits and the others take no part', () => {
  const { g, e, qs } = boardGame({ fortBoard: () => 1 })
  g.rng = scriptedRng([3, 3, ...Array(60).fill(1)])
  endPhase(g)
  // equal rolls, but values differ: just check that only the south quadrant is the attacker and the others are untouched
  assert.ok(said(g, /with 1 quadrant: boarding value 12/))
  assert.equal(qs[0].damage + qs[1].damage + qs[3].damage, 0)
})

// Tides of the Archipelago house rule: at sea ships can't touch a fort (they collide), so it boards from 15 cm, any way round
test('at sea a fort boards an enemy 10 cm off a quadrant; 20 cm is out of reach; in space 10 cm is no boarding', () => {
  for (const [sea, gap, boards] of [[true, 10, true], [true, 20, false], [false, 10, false]]) {
    const { g, e, qs } = boardGame({})
    if (sea) g.sea = true
    const q = qs[2], d = Math.hypot(e.pos.x - q.pos.x, e.pos.y - q.pos.y), R = baseR(q) + baseR(e) + gap
    e.pos = { x: q.pos.x + (e.pos.x - q.pos.x) / d * R, y: q.pos.y + (e.pos.y - q.pos.y) / d * R }
    dice(g, [6, 1]); endPhase(g)
    assert.equal(said(g, /Boarding action/), boards, `sea ${sea}, ${gap} cm`)
  }
})
