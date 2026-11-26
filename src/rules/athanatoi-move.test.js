// Tests for how the Athanatoi move (solar sails, rules/sail.js) and their Resolve. Fixed dice so the arithmetic shows.
// Run by `npm test` (node:test); exports nothing.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { scriptedRng } from './dice.js'
import { createGame, addShip, giveOrder, rollLeadership, rollSquadronLeadership, formSquadron } from './game.js'
import { moveShip, checkMove, sailOptions, sailMove, secondMoveProblem, sunBands } from './movement.js'
import { sunwardArcs } from './sail.js'
import { shipById } from '../data/ships.js'
import { NEW_FLEET_SHIPS } from '../data/fleets.js'
import { createCruiserClash } from './cruiserClash.js'
import { createFleetBattle } from './fleet.js'
import { ensureSunward } from './effects.js'
import { baseColumn } from './shooting.js'
import { nextPhase } from './turn.js'

// side 0 Athanatoi with an Asphodel (10/20/30) at (90,60) facing right; sunward edge `edge`
function sky (id = 'ath-asphodel', edge = 'top', phase = 'movement') {
  const game = createGame({ fleets: [{ name: 'Athanatoi', fleet: 'athanatoi' }, { name: 'Freemen', fleet: 'freemen' }] })
  const s = addShip(game, 0, id), t = addShip(game, 1, 'lantern')
  s.leadership = 8; t.leadership = 8
  s.pos = { x: 90, y: 60 }; s.facing = 0; t.pos = { x: 150, y: 100 }; t.facing = 180
  game.round = 1; game.active = 0; game.first = 0; game.phase = phase
  game.effects = { zone: 'none', sunward: edge, flares: 0, bursts: 0 }
  return { game, s, t }
}
const dice = (game, faces) => { game.rng = scriptedRng(faces) }

test('every Athanatoi ship has its three printed speeds and speed is the highest', () => {
  const ath = NEW_FLEET_SHIPS.filter(s => s.fleet === 'athanatoi')
  assert.ok(ath.length >= 20)
  for (const s of ath) {
    assert.ok(s.sail, s.id)
    assert.equal(s.speed, Math.max(s.sail.sunFront, s.sail.sunRear, s.sail.sunSide), s.id)
    assert.equal(typeof s.turns, 'number')
    assert.equal(s.sunSail, undefined)
  }
  assert.deepEqual(shipById('ath-asphodel').sail, { sunFront: 10, sunRear: 20, sunSide: 30 })
  assert.deepEqual(shipById('ath-eos').sail, { sunFront: 15, sunRear: 20, sunSide: 30 })
  assert.deepEqual(shipById('ath-thalassa').sail, { sunFront: 10, sunRear: 20, sunSide: 25 })
  assert.deepEqual(shipById('ath-wyrmship-lance-torpedo').sail, { sunFront: 10, sunRear: 20, sunSide: 25 })
  assert.equal(shipById('lantern').sail, undefined)
})

test('Athanatoi Resolve is the table +1, 7 to 10, for a ship and for a squadron', () => {
  const { game, s } = sky()
  for (const [r, ld] of [[1, 7], [2, 8], [3, 8], [4, 9], [5, 9], [6, 10]]) { dice(game, [r]); assert.equal(rollLeadership(game, s), ld) }
  const a = addShip(game, 0, 'ath-asphodel'), b = addShip(game, 0, 'ath-asphodel')
  const q = formSquadron(game, [a.uid, b.uid], 'sq')
  dice(game, [6]); rollSquadronLeadership(game, q)
  assert.equal(a.leadership, 10); assert.equal(b.leadership, 10)
  const l = addShip(game, 1, 'lantern'); dice(game, [6]); assert.equal(rollLeadership(game, l), 9, 'others unchanged')
})

test('Athanatoi orders: no All Ahead Full, no Burn Retros, no Come To New Heading, so no ramming', () => {
  const { game, s } = sky()
  for (const k of ['aheadFull', 'burnRetros', 'newHeading']) assert.equal(giveOrder(game, s, k).ok, false, k)
  assert.equal(giveOrder(game, s, 'aheadFull', { ram: 2 }).ok, false)
  dice(game, [1, 1]); assert.ok(giveOrder(game, s, 'lockOn').ok)
})

test('which arc the sunward edge is in decides the speed; on a line the player chooses', () => {
  assert.deepEqual(sunwardArcs('top', 270), ['front'])
  assert.deepEqual(sunwardArcs('top', 90), ['rear'])
  assert.deepEqual(sunwardArcs('top', 0), ['side'])
  assert.deepEqual(sunwardArcs('top', 180), ['side'])
  assert.deepEqual(sunwardArcs('top', 315).sort(), ['front', 'side'])
  assert.deepEqual(sunwardArcs('top', 45).sort(), ['rear', 'side'])
  const { game, s } = sky('ath-asphodel', 'top')
  // an Asphodel turned so the sun is on its left goes 30 (its side speed); facing right with the sun at the top is on its left
  const o = sailOptions(game, s, 0, { dist: 30 })
  assert.equal(o.arc, 'side'); assert.equal(o.max, 30); assert.ok(o.ok)
  assert.equal(sailOptions(game, s, 270).max, 10)   // sun dead ahead, the slowest
  assert.equal(sailOptions(game, s, 90).max, 20)    // sun astern
  const line = sailOptions(game, s, 315)
  assert.deepEqual(line.options.map(x => x.cm).sort(), [10, 30]); assert.equal(line.max, 30, 'defaults to the faster')
  assert.equal(sailOptions(game, s, 315, { arc: 'front' }).max, 10)
  assert.equal(sailOptions(game, s, 0, { arc: 'front' }).ok, false)
})

test('turn to any facing first, no minimum, straight line; the facing is kept', () => {
  const { game, s } = sky()
  const r = moveShip(game, s, [{ turn: 180 }, { fwd: 20 }])   // turned to face left, sun still on its right: side, 30
  assert.ok(r.ok, r.reason)
  assert.equal(Math.round(s.pos.x), 70); assert.equal(Math.round(s.pos.y), 60); assert.equal(Math.round(s.facing), 180)
  assert.equal(s.moved, 20)
  const u = sky().s, g = sky().game
  assert.ok(moveShip(g, u, []).ok, 'a move of nothing is allowed: no minimum')
  const v = sky(), w = moveShip(v.game, v.s, [{ turn: 90 }, { fwd: 10 }, { turn: 30 }, { fwd: 5 }])
  assert.equal(w.ok, false, 'no turn after it has started moving')
  const x = sky(), y = moveShip(x.game, x.s, [{ fwd: 31 }])
  assert.equal(y.ok, false); assert.match(y.reason, /at most 30/)
  assert.equal(x.s.pos.x, 90, 'a refused move changes nothing')
})

test('the speed comes from the facing AFTER the turn', () => {
  const { game, s } = sky()
  assert.equal(moveShip(game, s, [{ turn: -90 }, { fwd: 11 }]).ok, false, 'facing the sun: 10')
  assert.ok(moveShip(game, s, [{ turn: -90 }, { fwd: 10 }]).ok)
  assert.equal(Math.round(s.pos.y), 50)
})

test('crippled -5 and Mainsail Scarred -5 come off the chosen speed', () => {
  const { game, s } = sky('ath-helios')   // 15/20/30, 4 hits
  assert.equal(sailOptions(game, s, 0).max, 30)
  s.crits.mainsailScarred = 1; assert.equal(sailOptions(game, s, 0).max, 25)
  s.damage = 2; assert.equal(sailOptions(game, s, 0).max, 20)
  assert.equal(sailOptions(game, s, 270).max, 5)
  s.crits.thrusters = 1; assert.equal(sailOptions(game, s, 270).max, 0, 'never below nothing')
})

test('a Blast Marker on the way takes 5 cm off, once, and the 6 test follows the move', () => {
  const { game, s } = sky()
  game.blast.push({ id: 90, x: 105, y: 60 }, { id: 91, x: 110, y: 60 })
  const o = sailOptions(game, s, 0, { dist: 30 })
  assert.equal(o.ok, false); assert.equal(o.max, 25)
  dice(game, [6, 6])
  const r = moveShip(game, s, [{ fwd: 25 }])
  assert.ok(r.ok, r.reason)
  assert.equal(s.damage, 1, 'no shields, 6 = 1 damage')
  assert.ok(game.log.some(l => /Blast Markers: rolled 6/.test(l.text)))
})

test('a marker that is clear of the path costs nothing; a ship that does not move is not slowed', () => {
  const { game, s } = sky()
  game.blast.push({ id: 90, x: 90, y: 80 })
  assert.equal(sailOptions(game, s, 0).max, 30)
  game.blast.push({ id: 91, x: 91, y: 60 })   // touching the base at the start
  assert.equal(sailOptions(game, s, 0).max, 25)
  assert.equal(sailOptions(game, s, 0, { dist: 0 }).slowed, false)
})

test('Lock On: no turn in either move', () => {
  const { game, s } = sky()
  dice(game, [1, 1]); giveOrder(game, s, 'lockOn')
  assert.equal(moveShip(game, s, [{ turn: 30 }, { fwd: 5 }]).ok, false)
  assert.ok(moveShip(game, s, [{ fwd: 5 }]).ok)
  game.phase = 'ordnance'
  assert.equal(sailOptions(game, s, 45).ok, false)
  assert.ok(sailOptions(game, s, 0, { dist: 5 }).ok)
})

test('Mast Lines Severed limits the turn to 90 degrees; Superstructure rolls on turns over 45', () => {
  const { game, s } = sky()
  s.crits.mastLines = 1
  assert.equal(sailOptions(game, s, 100).ok, false)
  assert.ok(sailOptions(game, s, -90).ok)
  s.crits.mastLines = 0; s.mastLines = true
  assert.equal(sailOptions(game, s, 180).ok, false, 'a ship flag works as well')
  s.mastLines = false
  s.superstructure = true
  dice(game, [1, 3])
  assert.ok(moveShip(game, s, [{ turn: 60 }, { fwd: 5 }]).ok)
  assert.equal(s.damage, 1, 'a 1 on the strain roll')
  const t = sky(); t.s.crits.superstructure = 1; dice(t.game, [1])
  assert.ok(moveShip(t.game, t.s, [{ turn: 45 }, { fwd: 5 }]).ok)
  assert.equal(t.s.damage, 0, '45 degrees is not over 45: no roll')
})

test('the second move: Ordnance Phase, own turn only, after the attack craft have moved, never when shredded', () => {
  const { game, s, t } = sky()
  assert.ok(moveShip(game, s, [{ fwd: 12 }]).ok)
  game.phase = 'ordnance'
  game.ordnance.push({ id: 5, kind: 'wave', side: 1, moved: false, pos: { x: 0, y: 0 }, markers: [], r: 1 })
  assert.match(secondMoveProblem(game, s), /attack craft must move first/)
  game.ordnance[0].moved = true
  assert.equal(secondMoveProblem(game, s), null)
  s.crits.mainsailShredded = 1
  assert.match(secondMoveProblem(game, s), /Shredded/)
  s.crits.mainsailShredded = 0
  const r = moveShip(game, s, [{ turn: 90 }, { fwd: 8 }])
  assert.ok(r.ok, r.reason)
  assert.equal(s.moved, 20, 'the 5 cm rule counts both moves')
  assert.match(secondMoveProblem(game, s), /already made/)
  game.active = 1; game.phase = 'ordnance'
  assert.match(secondMoveProblem(game, s), /enemy/)
  assert.equal(moveShip(game, s, [{ fwd: 1 }]).ok, false)
  assert.equal(t.side, 1)
})

test('the 5 cm Defence rule uses the total of the two moves', () => {
  const { game, s } = sky()
  moveShip(game, s, [{ fwd: 3 }]); game.phase = 'ordnance'
  moveShip(game, s, [{ fwd: 4 }])
  assert.equal(s.moved, 7)
  assert.notEqual(baseColumn(s, 'abeam'), 0)
  const u = sky(); moveShip(u.game, u.s, [{ fwd: 2 }]); u.game.phase = 'ordnance'; moveShip(u.game, u.s, [{ fwd: 2 }])
  assert.equal(baseColumn(u.s, 'abeam'), 0, '4 cm in all: a Defence')
})

test('a move that is not made leaves the ship in place; checkMove and nextPhase serve the Athanatoi', () => {
  const { game, s } = sky()
  const c = checkMove(game, s, [])
  assert.equal(c.min, 0); assert.equal(c.max, 30); assert.equal(c.turns, 0)
  nextPhase(game)
  assert.equal(s.pos.x, 90); assert.equal(s.movedThisPhase, true)
  const k = sky(); k.s.lockedWith = null
  assert.equal(checkMove(k.game, k.s, [{ fwd: 5 }, { turn: 10 }]).ok, false)
})

test('boarding in the Manoeuvre Phase forfeits the second move', () => {
  const { game, s, t } = sky()
  t.pos = { x: 100, y: 60 }
  assert.ok(moveShip(game, s, [{ fwd: 8 }], { board: t.uid }).ok)
  assert.equal(s.boarding, t.uid)
  game.phase = 'ordnance'
  assert.match(secondMoveProblem(game, s), /boarded/)
})

test('enemy ordnance on the path is met as for any ship', () => {
  const { game, s } = sky()
  game.ordnance.push({ id: 7, kind: 'torpedo', side: 1, pos: { x: 100, y: 60 }, r: 1, facing: 180, speed: 30, str: 1, attacked: {}, fresh: false })
  dice(game, [1, 1, 1, 1, 1, 1])
  const n = game.ordnance.length
  moveShip(game, s, [{ fwd: 20 }])
  assert.ok(game.log.some(l => /torpedo/i.test(l.text)) || game.ordnance.length < n)
})

test('a sunward edge is rolled in every game with Athanatoi, Cruiser Duel and zone none included, and logged', () => {
  const ath = { name: 'A', fleet: 'athanatoi', ships: ['ath-helios'], escortSquadrons: [], commander: null }
  const imp = { name: 'I', fleet: 'freemen', ships: ['lantern'], escortSquadrons: [], commander: null }
  const g = createCruiserClash({ lists: [ath, imp], seed: 4 })
  assert.ok(['top', 'bottom', 'left', 'right'].includes(g.effects.sunward))
  assert.equal(g.effects.zone, 'none')
  assert.ok(g.log.some(l => /Sunward edge for the Athanatoi/.test(l.text)))
  assert.deepEqual(g.terrain, [])
  const g2 = createCruiserClash({ lists: [ath, imp], seed: 4 })
  assert.equal(g2.effects.sunward, g.effects.sunward, 'seeded')
  const f = createFleetBattle({ lists: [ath, ath], limit: 500, seed: 2 })
  assert.ok(f.effects.sunward)
  const none = createCruiserClash({ lists: [imp, imp], seed: 4 })
  assert.equal(none.effects, undefined, 'Freemen and Dominion games are untouched')
  assert.equal(ensureSunward(none), null)
  assert.equal(sunBands(f, f.ships[0]).edge, f.effects.sunward)
})

test('a standard Freemen ship still moves as before', () => {
  const g = createGame({ fleets: [{ name: 'a', fleet: 'freemen' }, { name: 'b', fleet: 'dominion' }] })
  const s = addShip(g, 0, 'lantern'); s.pos = { x: 50, y: 60 }; s.facing = 0; s.leadership = 8
  g.round = 1; g.active = 0; g.phase = 'movement'
  assert.equal(moveShip(g, s, [{ fwd: 5 }]).ok, false, 'half speed minimum')
  assert.ok(moveShip(g, s, [{ fwd: 20 }]).ok)
})
