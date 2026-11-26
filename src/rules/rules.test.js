// VOID WARS: Fleets rules engine: each test checks one core rule (rules/core/*.md) with fixed dice
// (scriptedRng hands out the faces given, in order) so the arithmetic is visible.
// Run by `npm test` (node:test); exports nothing.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { scriptedRng, createRng } from './dice.js'
import { arcsContaining } from './geometry.js'
import { ramTestDice, createGame, addShip, giveOrder, shieldsLeft, blastTouching, isCrippled, leadershipOf, weaponHalvings, baseR } from './game.js'
import { GUNNERY, gunneryDice, disciplines, baseColumn, fireShip, nearestEnemy, fireSunburst } from './shooting.js'
import { checkMove, moveShip, speedOf, disengage, ramReach } from './movement.js'
import { damageShip, critical } from './damage.js'
import { launchTorpedoes, ordnancePhase } from './ordnance.js'
import { boardingAction, endPhase } from './endPhase.js'
import { startBattle, nextPhase } from './turn.js'
import { createCruiserClash, checkForces, placeShip, allPlaced, victoryPoints } from './cruiserClash.js'

// a two-ship battle on an empty table, already in `phase` of side 0's turn 1
function duel (a = 'lantern', b = 'malice', { phase = 'shooting', at = { x: 50, y: 60 }, bAt = { x: 80, y: 60 }, aFacing = 0, bFacing = 180 } = {}) {
  const game = createGame({ fleets: [{ name: 'Freemen', fleet: 'freemen' }, { name: 'Dominion', fleet: 'dominion' }] })
  const s = addShip(game, 0, a), t = addShip(game, 1, b)
  s.leadership = 8; t.leadership = 8
  s.pos = at; s.facing = aFacing; t.pos = bAt; t.facing = bFacing
  game.round = 1; game.active = 0; game.first = 0; game.phase = phase
  return { game, s, t }
}
const dice = (game, faces) => { game.rng = scriptedRng(faces); return game.rng }

test('gunnery table: the worked example — firepower 10 at a closing cruiser is 7 dice, within 15 cm 9, over 30 cm 5', () => {
  assert.equal(gunneryDice(10, 1), 7)
  assert.equal(gunneryDice(10, 0), 9)
  assert.equal(gunneryDice(10, 2), 5)
  assert.equal(GUNNERY.length, 21)
  assert.equal(gunneryDice(32, 1), gunneryDice(20, 1) + gunneryDice(12, 1), 'over 20: look up 20 and the rest')
})

test('fire arcs are four 90° quarters; a point on the line is in both', () => {
  const o = { x: 0, y: 0 }
  assert.deepEqual(arcsContaining(o, 0, { x: 10, y: 0 }), ['front'])
  assert.deepEqual(arcsContaining(o, 0, { x: 0, y: 10 }), ['right'], 'facing +x, +y is clockwise: starboard')
  assert.deepEqual(arcsContaining(o, 0, { x: 0, y: -10 }), ['left'])
  assert.deepEqual(arcsContaining(o, 0, { x: -10, y: 0 }), ['rear'])
  assert.deepEqual(arcsContaining(o, 0, { x: 10, y: 10 }).sort(), ['front', 'right'])
})

test('target discipline: the quarter of the target the firer is in', () => {
  const { s, t } = duel()
  assert.deepEqual(disciplines(s, t), ['closing'], 'the Malice faces the Lantern')
  t.facing = 90
  assert.deepEqual(disciplines(s, t), ['abeam'])
  t.moved = 3
  assert.equal(baseColumn(t, 'abeam'), 0, 'moved under 5 cm: shot at as a Defence')
})

test('lances hit on 4+ whatever the armour, and shields take the first hits, each leaving a Blast Marker', () => {
  const { game, s, t } = duel('lantern', 'malice', { bAt: { x: 50, y: 85 }, bFacing: 180 })   // the Malice is off the Lantern's starboard side
  // Lantern starboard lances, strength 2: rolls 4 and 6 = 2 hits; the Malice has 2 shields -> both absorbed
  dice(game, [4, 6])
  const r = fireShip(game, s, [{ weapon: 1, target: t.uid }])
  assert.ok(r.ok, game.log.at(-1).text)
  assert.equal(t.damage, 0)
  assert.equal(blastTouching(game, t).length, 2)
  assert.equal(shieldsLeft(game, t), 0, 'shields down while the markers touch it')
})

test('weapons battery: dice from the gunnery table, hits on the armour, shields then damage, then critical rolls', () => {
  const { game, s, t } = duel('lantern', 'malice', { bAt: { x: 50, y: 85 }, bFacing: 0 })
  // Lantern starboard battery firepower 6 at the Malice abeam (capital abeam = column 3), 25 cm away, no shifts: 2 dice
  // rolls 5, 6 against armour 5 = 2 hits; 2 shields absorb both
  dice(game, [5, 6])
  fireShip(game, s, [{ weapon: 3, target: t.uid }])
  assert.match(game.log.find(l => /weapons batter/.test(l.text)).text, /2 dice rolled 5, 6, needed 5\+: 2 hits/)
  assert.equal(t.damage, 0)
})

test('target priority: firing past the nearest enemy needs a Resolve Test', () => {
  const { game, s, t } = duel('lantern', 'malice', { bAt: { x: 50, y: 80 } })
  const far = addShip(game, 1, 'bloodshed'); far.leadership = 8; far.pos = { x: 50, y: 88 }; far.facing = 0
  assert.equal(nearestEnemy(game, s), t)
  // test 2D6 = 6 + 6 = 12 fails: the shot goes to the Malice instead; then the lance dice
  dice(game, [6, 6, 1, 1])
  fireShip(game, s, [{ weapon: 1, target: far.uid }])
  assert.ok(game.log.some(l => /must fire at the nearest enemy/.test(l.text)))
})

test('movement: half speed minimum, cruisers move 10 cm before a 45° turn, orders limit turns', () => {
  const { game, s } = duel('lantern', 'malice', { phase: 'movement' })
  assert.equal(speedOf(s), 20)
  assert.ok(!checkMove(game, s, [{ fwd: 9 }]).ok, 'less than half of 20 cm')
  assert.ok(!checkMove(game, s, [{ fwd: 5 }, { turn: 45 }, { fwd: 10 }]).ok, 'turned before 10 cm')
  assert.ok(!checkMove(game, s, [{ fwd: 10 }, { turn: 90 }]).ok, 'a 90° turn on a 45° ship')
  assert.ok(checkMove(game, s, [{ fwd: 10 }, { turn: 45 }, { fwd: 10 }]).ok)
  assert.ok(!checkMove(game, s, [{ fwd: 10 }, { turn: 45 }, { fwd: 10 }, { turn: 45 }]).ok, 'one turn without Come to New Heading')
})

test('All Ahead Full: +4D6 cm, the full distance, no turns', () => {
  const { game, s } = duel('lantern', 'malice', { phase: 'movement' })
  dice(game, [3, 3, 1, 2, 3, 4])   // Command check 6 passes Resolve 8; extra 1+2+3+4 = 10 cm
  assert.ok(giveOrder(game, s, 'aheadFull').ok)
  assert.equal(checkMove(game, s, [{ fwd: 30 }]).ok, true)
  assert.equal(checkMove(game, s, [{ fwd: 25 }]).ok, false)
  assert.equal(checkMove(game, s, [{ fwd: 10 }, { turn: 45 }, { fwd: 20 }]).ok, false)
})

test('a failed Command check stops all further special orders that turn', () => {
  const { game, s } = duel('lantern', 'malice', { phase: 'movement' })
  const s2 = addShip(game, 0, 'rimward'); s2.leadership = 8; s2.pos = { x: 20, y: 20 }
  dice(game, [6, 6])
  assert.equal(giveOrder(game, s, 'lockOn').ok, false)
  assert.equal(giveOrder(game, s2, 'lockOn').ok, false)
  assert.match(game.log.at(-1).text, /already failed/)
})

test('Blast Markers on the path cost 5 cm', () => {
  const { game, s } = duel('lantern', 'malice', { phase: 'movement' })
  game.blast.push({ id: 99, x: 60, y: 60 })
  const c = checkMove(game, s, [{ fwd: 20 }])
  assert.equal(c.slowed, true)
  assert.equal(c.max, 15)
})

test('crippled at half damage: weapons and shields halved, speed -5 cm', () => {
  const { game, s } = duel()
  dice(game, [1, 1, 1, 1])
  damageShip(game, s, 4)
  assert.ok(isCrippled(s))
  assert.equal(weaponHalvings(s), 1)
  assert.equal(speedOf(s), 15)
  assert.equal(shieldsLeft(game, s), 1)
})

test('critical hits: a 6 per damage point; a result that can\'t apply moves up; escorts are destroyed', () => {
  const { game, s } = duel()
  dice(game, [1, 1])   // critical table 2D6 = 2: Dorsal Armament, but the Lantern has no dorsal weapons -> Starboard
  critical(game, s)
  assert.equal(s.crits.dorsal, 0)
  assert.equal(s.crits.starboard, 1)
  const e = addShip(game, 1, 'sword'); e.pos = { x: 10, y: 10 }
  critical(game, e)
  assert.equal(e.state, 'destroyed')
})

test('Bridge Smashed: Resolve -3', () => {
  const { game, s } = duel()
  critical(game, s, 9)
  assert.equal(leadershipOf(s), 5)
})

test('torpedoes: launched in the front arc, move in the Ordnance Phase, turrets first, armour of the side hit, shields ignored', () => {
  const { game, s, t } = duel('lantern', 'malice', { bAt: { x: 75, y: 60 }, bFacing: 180 })
  assert.ok(launchTorpedoes(game, s, 0).ok)
  assert.equal(s.loaded.torpedo, false)
  assert.equal(launchTorpedoes(game, s, 0).ok, false, 'empty tubes until Reload Ordnance')
  game.phase = 'ordnance'
  // turrets: 2 dice, 4 and 1 -> 1 torpedo down, 5 left; then 5 dice against front armour 5: 5, 5, 1, 2, 6 -> 3 hits;
  // then 3 critical rolls of 1
  dice(game, [4, 1, 5, 5, 1, 2, 6, 1, 1, 1])
  ordnancePhase(game)
  assert.equal(t.damage, 3)
  assert.equal(game.ordnance[0]?.str ?? 0, 2)
})

test('ramming: the rammer rolls its starting hits, the target half back, head-on all of them', () => {
  const { game, s, t } = duel('lantern', 'malice', { phase: 'movement', bAt: { x: 75, y: 60 } })
  // Command check 4 (pass), ram test on 2D6 (same size) 3, then +4D6 = 4 -> 24 cm; 8 rams dice; head on: 8 back
  dice(game, [2, 2, 1, 2, 1, 1, 1, 1, 6, 6, 6, 1, 1, 1, 1, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1])
  assert.ok(giveOrder(game, s, 'aheadFull', { ram: t.uid }).ok)
  const r = moveShip(game, s, [{ fwd: 24 }])
  assert.ok(r.ok, game.log.at(-1).text)
  assert.ok(game.log.some(l => /rams Malice/.test(l.text)))
  assert.ok(game.log.some(l => /hits back with 8 dice \(head on/.test(l.text)))
  assert.equal(t.damage, 3)
})

test('boarding: remaining hits against hits plus turrets, D6 plus modifiers, the loser takes the difference', () => {
  const { game, s, t } = duel()
  // Malice (Dominion +1) attacks the Lantern: values 8 vs 8+2; Malice rolls 6 +1 = 7, Lantern rolls 3 +1 (higher value) = 4
  dice(game, [6, 3, 6, 1, 1, 1, 1])
  game.active = 1
  boardingAction(game, t, s)
  assert.equal(s.damage, 3)
})

test('End Phase: D6 Blast Markers removed, never ones touching a ship', () => {
  const { game, s } = duel()
  game.phase = 'end'
  game.blast.push({ id: 1, x: s.pos.x + baseR(s) + 1, y: s.pos.y }, { id: 2, x: 120, y: 20 }, { id: 3, x: 130, y: 20 })
  dice(game, [6])
  endPhase(game)
  assert.deepEqual(game.blast.map(m => m.id), [1])
})

test('sunburst cannon: the template\'s edge 30-150 cm away in the front arc; a hit under the hole is D6 hits', () => {
  const { game, s, t } = duel('mars', 'malice', { bAt: { x: 110, y: 60 } })
  assert.equal(fireSunburst(game, s, { x: 70, y: 60 }).ok, false, 'too close')
  dice(game, [1, 4, 1, 1])   // scatter "hit"; D6 = 4 hits under the hole; shields take 2; 2 critical rolls of 1
  assert.ok(fireSunburst(game, s, t.pos).ok)
  assert.equal(blastTouching(game, t).length, 2)
  assert.equal(t.damage, 2)
})

test('Cruiser Duel forces: one to four cruisers each, equal numbers, 185 points or less', () => {
  assert.equal(checkForces([{ fleet: 'freemen', ships: ['lantern'] }, { fleet: 'dominion', ships: ['malice'] }]), null)
  assert.match(checkForces([{ fleet: 'freemen', ships: ['cannonade'] }, { fleet: 'dominion', ships: ['malice'] }]), /190 points/)
  assert.match(checkForces([{ fleet: 'freemen', ships: ['lantern', 'rimward'] }, { fleet: 'dominion', ships: ['malice'] }]), /same number/)
})

test('a whole seeded Cruiser Duel plays 8 turns by simple orders without breaking a rule, and replays identically', () => {
  const play = seed => {
    const g = createCruiserClash({ lists: [{ name: 'Freemen Navy', fleet: 'freemen', ships: ['lantern', 'rimward', 'tribune'] }, { name: 'Dominion', fleet: 'dominion', ships: ['malice', 'bloodshed', 'shambles'] }], seed, decide: { brace: (game, ship) => ship.damage >= 4 } })
    const xs = [40, 40]
    while (!allPlaced(g)) { const s = g.ships.find(x => x.side === g.placing && !x.pos); placeShip(g, s.uid, { x: (xs[s.side] += 30), y: g.zones[s.side] === 'A' ? 20 : 100 }) }
    startBattle(g, g.firstChooser)
    let guard = 0
    while (!g.over && guard++ < 200) {
      if (g.phase === 'movement') for (const s of g.ships.filter(x => x.side === g.active && x.state === 'active')) {
        const e = nearestEnemy(g, s)
        if (!e) break
        moveShip(g, s, [{ fwd: s.profile.speed / 2 }])
      }
      if (g.phase === 'shooting') for (const s of g.ships.filter(x => x.side === g.active && x.state === 'active')) {
        const shots = s.profile.weapons.map((w, i) => ({ w, i })).filter(({ w }) => ['battery', 'lance'].includes(w.kind))
          .map(({ w, i }) => { const e = g.ships.filter(x => x.side !== s.side && x.state === 'active').find(x => x.pos && Math.hypot(x.pos.x - s.pos.x, x.pos.y - s.pos.y) <= w.range); return e ? { weapon: i, target: e.uid } : null })
          .filter(Boolean)
        const ok = shots.filter(sh => { const w = s.profile.weapons[sh.weapon]; const t = g.ships.find(x => x.uid === sh.target); return t && Math.hypot(t.pos.x - s.pos.x, t.pos.y - s.pos.y) <= w.range && arcsContaining(s.pos, s.facing, t.pos).some(a => w.arc.includes(a)) })
        if (ok.length) fireShip(g, s, ok)
        if (s.loaded.torpedo && s.profile.weapons.some(w => w.kind === 'torpedo')) launchTorpedoes(g, s, s.facing)
      }
      nextPhase(g)
    }
    return { g, log: g.log.map(l => l.text) }
  }
  const a = play(11), b = play(11)
  assert.ok(a.g.over, 'the battle ends')
  assert.deepEqual(a.log, b.log, 'same seed, same battle')
  assert.ok(a.log.some(l => /weapons battery|lances/.test(l)), 'ships fired')
  assert.ok(Number.isInteger(victoryPoints(a.g, 0)) && Number.isInteger(victoryPoints(a.g, 1)))
})

test('ramming range: dead ahead only, within speed + the All Ahead Full dice', () => {
  const game = createGame({ fleets: [{ name: 'Freemen', fleet: 'freemen' }, { name: 'Dominion', fleet: 'dominion' }] })
  const l = addShip(game, 0, 'lantern'), m = addShip(game, 1, 'malice')
  l.pos = { x: 40, y: 60 }; l.facing = 0
  m.pos = { x: 60, y: 60 }
  assert.equal(ramReach(l, m).sure, true, '16.8 cm to contact: inside its speed of 20 + 4')
  m.pos = { x: 70, y: 60 }
  const far = ramReach(l, m)
  assert.equal(far.sure, false, '26.8 cm needs a good roll')
  assert.equal(far.dice, 4); assert.ok(Math.abs(far.need - 6.8) < 1e-6)
  m.pos = { x: 90, y: 60 }
  assert.equal(ramReach(l, m), null, 'beyond 20 + 4D6')
  m.pos = { x: 60, y: 66 }
  assert.equal(ramReach(l, m), null, 'off the line: All Ahead Full can\'t turn')
  m.pos = { x: 30, y: 60 }
  assert.equal(ramReach(l, m), null, 'behind it')
  assert.equal(ramTestDice(l, m), 2)
})
