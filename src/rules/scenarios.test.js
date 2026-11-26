// Tests for the scenarios (rules/scenarios.js): each one sets up and plays a few turns, and the special rules that decide them.
// Run by `npm test` (node:test); exports nothing.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { scriptedRng } from './dice.js'
import { createScenario, nextScenarioPlace, placeScenarioShip, entryFor, enterShip, goOnAlert, landTroops, placeContact,
  setConvoyEntry, assignContact, placeMarker, markerSide, scenarioVP, checkScenarioList, SCENARIOS, facingLocked, facingFor, scenarioPlaceProblem } from './scenarios.js'
import { startBattle, nextPhase } from './turn.js'
import { enterLowOrbit, LOW } from './lowOrbit.js'
import { doneBuying, buyDefence } from './defences.js'
import { moveShip } from './movement.js'
import { shipByUid } from './game.js'

const imp = (extra = {}) => ({ name: 'Freemen Navy', fleet: 'freemen', ships: ['lantern', 'rimward', 'sword', 'sword'], escortSquadrons: [[2, 3]], commander: null, ...extra })
const chs = (extra = {}) => ({ name: 'Dominion', fleet: 'dominion', ships: ['malice', 'bloodshed', 'profaner', 'profaner'], escortSquadrons: [[2, 3]], commander: 'harrowadmiral-8', ...extra })

// place every ship that starts on the table by trying spots until the scenario accepts one
function placeAll (g) {
  for (let n = 0; n < 60; n++) {
    const s = nextScenarioPlace(g)
    if (!s) break
    let done = false
    for (let x = 2; x < 180 && !done; x += 4) for (let y = 2; y < 120 && !done; y += 4) done = placeScenarioShip(g, s.uid, { x, y }).ok
    assert.ok(done, `${s.name} found nowhere to go in ${g.sc.name}`)
  }
}
function playTurns (g, n) {
  startBattle(g, g.firstFixed ?? g.firstChooser ?? 0)
  for (let i = 0; i < n * 4 && !g.over; i++) {
    if (g.phase === 'movement') for (const s of g.ships.filter(s => s.side === g.active && s.state === 'reserve')) { const e = entryFor(g, s); if (e.segs) enterShip(g, s.uid, e.segs[0].a) }
    nextPhase(g)
  }
}

test('The Lure: the pursued in the centre, pursuers over 60 cm behind, reinforcements from the edge ahead', () => {
  const pursued = imp({ ships: ['lantern', 'rimward', 'sword', 'sword'], escortSquadrons: [[2, 3]], tags: { 1: 'reinforcement', 2: 'reinforcement', 3: 'reinforcement' } })
  const g = createScenario({ id: 'bait', lists: [pursued, chs({ ships: ['malice', 'bloodshed'], escortSquadrons: [] })], attacker: 1, seed: 3 })
  placeAll(g)
  const lantern = g.ships.find(s => s.id === 'lantern')
  assert.deepEqual(lantern.pos, { x: 90, y: 60 })
  assert.ok(g.ships.filter(s => s.side === 1).every(s => s.pos.x < 90 && Math.hypot(s.pos.x - 90, s.pos.y - 60) > 60))
  assert.equal(g.firstFixed, 0, 'the fleeing ship goes first')
  startBattle(g, 0)
  const rimward = g.ships.find(s => s.id === 'rimward')
  assert.ok(entryFor(g, rimward).segs.every(sg => sg.edge === 'right'), 'turn 1: the edge ahead only')
  assert.ok(enterShip(g, rimward.uid, { x: 170, y: 50 }).ok)
  assert.deepEqual(rimward.pos, { x: 180, y: 50 }); assert.equal(rimward.facing, 180)
  assert.ok(moveShip(g, rimward, [{ fwd: 10 }]).ok)
})

test('The Corsairs: half the points; defenders 30 cm from the edges, 20 cm apart, one facing; -1 Resolve for D6 turns', () => {
  assert.ok(SCENARIOS.corsairs.limits(1000)[0] === 500)
  const g = createScenario({ id: 'corsairs', lists: [imp(), chs({ ships: ['malice', 'profaner', 'profaner'], escortSquadrons: [[1, 2]] })], attacker: 1, limit: 1000, seed: 4 })
  placeAll(g)
  const d = g.ships.filter(s => s.side === 0)
  assert.ok(d.every(s => Math.min(s.pos.x, s.pos.y, 180 - s.pos.x, 120 - s.pos.y) >= 30))
  assert.equal(new Set(d.map(s => s.facing)).size, 1)
  assert.ok(g.ships.filter(s => s.side === 1).every(s => s.state === 'reserve'))
  assert.ok(g.alertTurns >= 1 && g.hooks.ldMod(g, d[0]).mod === -1)
  playTurns(g, 3)
})

test('Surprise Attack: standby ships can\'t move or fire until a Resolve Test puts them on alert', () => {
  const g = createScenario({ id: 'surprise', lists: [imp({ tags: { 0: 'alert' } }), chs()], attacker: 1, limit: 1000, seed: 6 })
  assert.equal(g.setupStep, 'defences'); doneBuying(g)
  assert.equal(g.planet.size, 'medium', '1,000 points: a medium planet')
  placeAll(g)
  const rimward = g.ships.find(s => s.id === 'rimward')
  assert.ok(rimward.standby)
  startBattle(g, 1); nextPhase(g); nextPhase(g); nextPhase(g)   // the attackers' turn passes
  assert.equal(g.active, 0)
  assert.equal(moveShip(g, rimward, [{ fwd: 10 }]).ok, false)
  g.rng = scriptedRng([1, 1])
  assert.ok(goOnAlert(g, rimward.uid).pass)
  assert.ok(!rimward.standby)
})

test('Running the Cordon: thirds by D6, runners 15 cm from their edge; a runner off the far edge scores its points', () => {
  const g = createScenario({ id: 'blockade', lists: [imp(), chs({ ships: ['malice', 'profaner', 'profaner'], escortSquadrons: [[1, 2]] })], attacker: 1, limit: 1000, seed: 2 })
  placeAll(g)
  for (const s of g.ships.filter(s => s.side === 0)) assert.ok(s.pos.x >= 60 && s.pos.y >= s.third * 40 && s.pos.y <= s.third * 40 + 40)
  assert.ok(g.ships.filter(s => s.side === 1).every(s => s.pos.x <= 15))
  const malice = g.ships.find(s => s.id === 'malice')
  const before = scenarioVP(g, 1)
  malice.state = 'disengaged'; malice.exitEdge = 'right'
  assert.equal(scenarioVP(g, 1), before + 170)
  assert.equal(g.rounds, 6)
})

test('Convoy: rolled raiders under Contacts, the convoy enters from a short edge; transports through decide it', () => {
  const g = createScenario({ id: 'convoy', lists: [imp({ ships: ['sword', 'sword'], escortSquadrons: [[0, 1]] }), chs({ ships: [], escortSquadrons: [], commander: null })], attacker: 1, seed: 8, opts: { transports: 4 } })
  assert.equal(g.ships.filter(s => s.profile.role === 'transport').length, 4)
  for (const c of g.contacts.filter(c => c.kind !== 'cluster')) assert.ok(assignContact(g, c.id, c.kind === 'capital' ? ['malice'] : ['profaner', 'profaner']).ok)
  let k = 0
  while (g.setupStep === 'contacts') { placeContact(g, { x: 30 + (k % 5) * 30, y: 30 + Math.floor(k / 5) * 30 }); k++ }
  assert.ok(setConvoyEntry(g, { x: 0, y: 60 }).ok)
  playTurns(g, 3)
  assert.ok(g.ships.filter(s => s.side === 0).every(s => s.state !== 'reserve'), 'everything entered or was lost by turn 2')
})

test('Planetary Assault: free transports, low orbit, landing troops for assault points', () => {
  const g = createScenario({ id: 'assault', lists: [imp({ tags: { 1: 'standby' } }), chs()], attacker: 1, limit: 1000, seed: 5 })
  doneBuying(g)
  assert.equal(g.ships.filter(s => s.side === 1 && s.profile.role === 'transport').length, 2, '460 points: two per 500 points or part')
  assert.ok(g.lowOrbit)
  placeAll(g)
  const t = g.ships.find(s => s.side === 1 && s.profile.role === 'transport')
  startBattle(g, 1)
  t.pos = { x: g.planet.shape.x - g.planet.shape.r - 3, y: g.planet.shape.y }
  assert.ok(enterLowOrbit(g, t, 60).ok)
  assert.ok(t.pos.y > 1000)
  assert.ok(moveShip(g, t, [{ fwd: 0 }]).ok, 'no minimum move in low orbit')
  t.pos = { x: 60, y: LOW.y0 + LOW.h - 10 }
  nextPhase(g)
  assert.ok(landTroops(g, t.uid).ok)
  assert.equal(g.assaultPoints, 2)
})

test('Rising Engagement: five divisions, one starts round a marker, the rest arrive from the edges', () => {
  const divs = n => Object.fromEntries([...Array(n)].map((_, i) => [i, String(i + 1)]))
  const l0 = imp({ ships: ['lantern', 'rimward', 'intrepid', 'sword', 'sword', 'adder', 'adder'], escortSquadrons: [[3, 4], [5, 6]], tags: { 0: '1', 1: '2', 2: '3', 3: '4', 4: '4', 5: '5', 6: '5' } })
  const l1 = chs({ ships: ['malice', 'bloodshed', 'shambles', 'faithless', 'faithless', 'profaner', 'profaner'], escortSquadrons: [[3, 4], [5, 6]], tags: { 0: '1', 1: '2', 2: '3', 3: '4', 4: '4', 5: '5', 6: '5' } })
  assert.ok(checkScenarioList('escalating', { ...l0, tags: divs(3) }, 'attacker', 1500).length > 0)
  const g = createScenario({ id: 'escalating', lists: [l0, l1], attacker: 1, limit: 1500, seed: 11 })
  assert.ok(placeMarker(g, { x: 40, y: 60 }).ok)
  assert.equal(placeMarker(g, { x: 80, y: 60 }).ok, false, 'not within 60 cm of the enemy marker')
  assert.ok(placeMarker(g, { x: 140, y: 60 }).ok)
  assert.equal(markerSide(g), null)
  placeAll(g)
  playTurns(g, 4)
  assert.ok(g.markers.length > 2, 'more markers went on the edges in the End Phases')
})

test('Worldbreak: Worldbreakers lose their prow weapons; patrols wait off the table', () => {
  const g = createScenario({ id: 'worldbreak', lists: [imp({ ships: ['lantern', 'rimward', 'cannonade', 'tribune'], escortSquadrons: [], tags: { 1: 'patrol' } }), chs({ tags: { 0: 'worldbreaker' } })], attacker: 1, limit: 1000, seed: 9 })
  doneBuying(g)
  const malice = g.ships.find(s => s.id === 'malice')
  assert.ok(malice.worldbreaker && !malice.profile.weapons.some(w => w.loc === 'prow'))
  assert.equal(g.ships.find(s => s.id === 'rimward').state, 'reserve')
  placeAll(g)
  playTurns(g, 3)
})

test('placing: scenarios fix some facings and leaves others to the player; asking where a ship may go changes nothing', () => {
  const bait = createScenario({ id: 'bait', lists: [imp({ ships: ['lantern', 'rimward'], escortSquadrons: [], tags: { 1: 'reinforcement' } }), chs({ ships: ['malice'], escortSquadrons: [] })], attacker: 1, seed: 3 })
  const pursued = nextScenarioPlace(bait)
  assert.ok(/short edge/.test(facingLocked(bait, pursued)), 'the pursued face a short edge')
  const blk = createScenario({ id: 'blockade', lists: [imp(), chs({ ships: ['malice', 'profaner', 'profaner'], escortSquadrons: [[1, 2]] })], attacker: 1, limit: 1000, seed: 2 })
  const b = nextScenarioPlace(blk)
  assert.equal(facingLocked(blk, b), null)
  assert.equal(facingFor(blk, b, { x: 100, y: 60 }, 45), 45, 'the blockaders face as they like')
  assert.ok(/60 cm/.test(scenarioPlaceProblem(blk, b.uid, { x: 20, y: 60 })))
  assert.equal(b.pos, null)
  const r = createScenario({ id: 'corsairs', lists: [imp(), chs({ ships: ['malice', 'profaner', 'profaner'], escortSquadrons: [[1, 2]] })], attacker: 1, limit: 1000, seed: 4 })
  const first = nextScenarioPlace(r)
  assert.equal(facingLocked(r, first), null)
  assert.ok(placeScenarioShip(r, first.uid, { x: 60, y: 60 }, 45).ok)
  const second = nextScenarioPlace(r)
  assert.ok(/same edge/.test(facingLocked(r, second)), 'the rest follow the first')
  assert.equal(facingFor(r, second, { x: 100, y: 60 }, 200), 45)
})
