// Tests for Athanatoi attack craft. Fixed dice, so the arithmetic shows.
// Run by `npm test` (node:test); exports nothing.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { scriptedRng } from './dice.js'
import { createGame, addShip } from './game.js'
import { launchCraft, moveWave, ordnancePhase, launchable, convertTorpedoBombers, expireTorpedoes, launchMines, fleetCraftRoom } from './ordnance.js'
import { nextPhase } from './turn.js'
import { critical } from './damage.js'

function duel (a = 'ath-wyrmship', opts) {
  const game = createGame({ fleets: [{ name: 'A', fleet: 'athanatoi' }, { name: 'B', fleet: 'freemen' }] })
  const s = addShip(game, 0, a, opts), t = addShip(game, 1, 'steward')
  s.leadership = 8; t.leadership = 8
  s.pos = { x: 40, y: 60 }; s.facing = 0; t.pos = { x: 55, y: 60 }; t.facing = 180
  game.round = 1; game.active = 0; game.first = 0; game.phase = 'shooting'
  return { game, s, t }
}
const dice = (game, faces) => { game.rng = scriptedRng(faces) }
const said = (game, re) => game.log.some(l => re.test(l.text))
const wave = game => game.ordnance.find(o => o.kind === 'wave')

test('a Wyrmship launches Nightjar fighters and Eagle bombers, but Vampires only with the flag', () => {
  const { game, s } = duel()
  assert.deepEqual(launchable(game, s), ['fighter', 'bomber'])
  assert.equal(launchCraft(game, s, { 'assault boat': 1 }).ok, false)
  assert.equal(launchCraft(game, s, { 'torpedo bomber': 1 }).ok, false)
  const f = duel('ath-wyrmship', { vampires: true, torpedoBombers: true })
  assert.deepEqual(launchable(f.game, f.s), ['fighter', 'bomber', 'assault boat', 'torpedo bomber'])
  assert.ok(launchCraft(f.game, f.s, { 'assault boat': 1, fighter: 1 }).ok)
  assert.equal(wave(f.game).markers.join(), 'fighter,assault boat')
})
test('the Flame of Helion carries Vampires without a flag', () => {
  const { game, s } = duel('ath-flame')
  assert.ok(launchable(game, s).includes('assault boat'))
})
test('wave speed is the slowest craft: Vampires 25, bombers 20, fighters 30', async () => {
  const { game, s } = duel('ath-flame')
  const { waveSpeed } = await import('./ordnance.js')
  launchCraft(game, s, { fighter: 1, 'assault boat': 1 }); assert.equal(waveSpeed(wave(game)), 25)
})
test('a damaged keel armament stops the Athanatoi launching', () => {
  const { game, s } = duel()
  s.crits.keel = 1
  assert.equal(launchCraft(game, s, { fighter: 1 }).ok, false)
})
test('bombers re-roll when the player says so and the second stands', () => {
  const { game, s, t } = duel()
  let asked = null
  game.decide.rerollAttacks = (g, ship, info) => { asked = info; return true }
  launchCraft(game, s, { bomber: 1 }); game.phase = 'ordnance'; ordnancePhase(game)
  // Steward 3 turrets? turrets fire at 6 only: rolls 1,1,1 (all miss, needed 6). Bomber rolls 1: worth 0 against an average above 0, so re-rolled to 6.
  const tur = t.profile.turrets
  dice(game, [...Array(tur).fill(1), 1, 6, ...Array(Math.max(0, 6 - tur)).fill(5), ...Array(8).fill(1)])
  moveWave(game, wave(game).id, t.pos)
  assert.ok(said(game, /rolled 1 re-rolled to 6/))
  assert.ok(said(game, new RegExp(`= ${6 - tur} attacks`)))
  assert.equal(asked.roll, 1)
})
test('headless, nobody re-rolls: the engine never decides for the player', () => {
  const { game, s, t } = duel()
  launchCraft(game, s, { bomber: 1 }); game.phase = 'ordnance'; ordnancePhase(game)
  const tur = t.profile.turrets
  dice(game, [...Array(tur).fill(1), 1, 6, ...Array(8).fill(1)])
  moveWave(game, wave(game).id, t.pos)
  assert.ok(!said(game, /re-rolled/))
})
test('bombers keep a good roll', () => {
  const { game, s, t } = duel()
  launchCraft(game, s, { bomber: 1 }); game.phase = 'ordnance'; ordnancePhase(game)
  const tur = t.profile.turrets
  dice(game, [...Array(tur).fill(1), 6, ...Array(8).fill(1)])
  moveWave(game, wave(game).id, t.pos)
  assert.ok(said(game, /rolled 6, minus/))
})
test('Freemen bombers do not re-roll', () => {
  const g = createGame({ fleets: [{ name: 'A', fleet: 'freemen' }, { name: 'B', fleet: 'athanatoi' }] })
  const d = addShip(g, 0, 'steward'), e = addShip(g, 1, 'ath-eos'); d.leadership = 8; e.leadership = 8
  d.pos = { x: 40, y: 60 }; e.pos = { x: 60, y: 60 }; g.round = 1; g.active = 0; g.first = 0; g.phase = 'shooting'
  launchCraft(g, d, { bomber: 1 }); g.phase = 'ordnance'; ordnancePhase(g)
  dice(g, [1, ...Array(10).fill(1)])
  moveWave(g, wave(g).id, e.pos)
  assert.ok(!said(g, /re-rolled/))
})

function meeting (aKinds, bKinds) {
  const game = createGame({ fleets: [{ name: 'A', fleet: 'athanatoi' }, { name: 'B', fleet: 'freemen' }] })
  game.round = 1; game.active = 0; game.first = 0; game.phase = 'ordnance'
  const mk = (side, markers, x, fleet) => game.ordnance.push({ id: game.nextId++, kind: 'wave', side, from: null, pos: { x, y: 60 }, markers, r: 1.1 * Math.sqrt(markers.length), moved: false, fleet })
  mk(0, aKinds, 40, 'athanatoi'); mk(1, bKinds, 50, 'freemen')
  return game
}
test('a resilient Nightjar that meets an enemy fighter saves on a 4+, stops there, and the enemy fighter goes', () => {
  const game = meeting(['fighter'], ['fighter'])
  dice(game, [4, 1])   // enemy Fury has no save; the Nightjar rolls 4
  const [a] = game.ordnance
  moveWave(game, a.id, { x: 50, y: 60 })
  assert.equal(game.ordnance.length, 1)
  assert.equal(game.ordnance[0].side, 0)
  assert.ok(game.ordnance[0].moved)
  assert.equal(moveWave(game, game.ordnance[0].id, { x: 60, y: 60 }).ok, false)
})
test('a Nightjar that fails its save is removed with the enemy fighter', () => {
  const game = meeting(['fighter'], ['fighter'])
  dice(game, [3])
  moveWave(game, game.ordnance[0].id, { x: 50, y: 60 })
  assert.equal(game.ordnance.length, 0)
})
test('a saved marker splits from its wave and the rest go on', () => {
  const game = meeting(['fighter', 'fighter'], ['fighter'])
  dice(game, [6])
  const a = game.ordnance[0]
  moveWave(game, a.id, { x: 60, y: 60 })
  const mine = game.ordnance.filter(o => o.side === 0)
  assert.equal(mine.length, 2)
  const stopped = mine.find(o => o.spentKey), goes = mine.find(o => !o.spentKey)
  assert.ok(stopped && goes)
  assert.equal(goes.pos.x, 60, 'the rest of the wave moved its full distance')
  assert.ok(stopped.pos.x > 40 && stopped.pos.x <= 50, 'the saved one stopped where it met the enemy')
})
test('a resilient fighter met a second time in the same phase is removed with its attacker', () => {
  const game = meeting(['fighter'], ['fighter', 'fighter'])
  dice(game, [5])   // first meeting: saves; second: no roll
  moveWave(game, game.ordnance[0].id, { x: 50, y: 60 })
  assert.equal(game.ordnance.length, 0, 'the Nightjar and both Furies are gone')
})
test('a fighter that saves against a torpedo stays; the torpedo goes', () => {
  const game = meeting(['fighter'], ['fighter'])
  game.ordnance.pop()
  game.ordnance.push({ id: game.nextId++, kind: 'torpedo', side: 1, from: null, str: 3, speed: 30, pos: { x: 50, y: 60 }, facing: 180, r: 1.25, fresh: false, attacked: {}, fleet: 'freemen' })
  dice(game, [4])
  moveWave(game, game.ordnance[0].id, { x: 50, y: 60 })
  assert.deepEqual(game.ordnance.map(o => o.kind), ['wave'])
})

test('torpedo bombers: not in the phase launched, then a Strength 2 salvo each, combined, gone at the end of the phase', () => {
  const { game, s, t } = duel('ath-wyrmship', { torpedoBombers: true })
  launchCraft(game, s, { 'torpedo bomber': 2 })
  game.phase = 'ordnance'
  assert.equal(convertTorpedoBombers(game, wave(game).id, 0).ok, false, 'launched this turn')
  dice(game, Array(30).fill(1))
  // next turn's ordnance phase
  game.round = 2
  const w = wave(game); w.pos = { x: 40, y: 60 }
  const r = convertTorpedoBombers(game, w.id, 0)
  assert.ok(r.ok); assert.equal(r.torpedo.str, 4); assert.equal(r.torpedo.speed, 30); assert.equal(r.torpedo.fleet, 'athanatoi')
  assert.ok(game.ordnance.includes(r.torpedo))
  expireTorpedoes(game)
  assert.ok(!game.ordnance.some(o => o.kind === 'torpedo'))
})
test('torpedo bombers count as bombers for interception and do nothing to a ship', () => {
  const { game, s, t } = duel('ath-wyrmship', { torpedoBombers: true })
  launchCraft(game, s, { 'torpedo bomber': 1 }); game.phase = 'ordnance'; ordnancePhase(game)
  moveWave(game, wave(game).id, t.pos)
  assert.ok(wave(game), 'still in play')
  assert.equal(t.damage, 0)
})
test('turrets hit Athanatoi craft on a 6 only, wherever the turrets are', () => {
  const { game, s, t } = duel()
  launchCraft(game, s, { bomber: 1 }); game.phase = 'ordnance'; ordnancePhase(game)
  const tur = t.profile.turrets
  dice(game, [...Array(tur).fill(5), 6, ...Array(8).fill(1)])
  moveWave(game, wave(game).id, t.pos)
  assert.ok(said(game, /needed 6\+ \(Athanatoi ordnance/))
  assert.ok(said(game, /0 squadrons shot down/))
})

test('orbital mines replace craft: one per bay strength from the stem, no craft, bays left out of the fleet limit', () => {
  const { game, s } = duel('ath-selene', { mines: true })
  assert.equal(launchCraft(game, s, { fighter: 1 }).ok, false)
  assert.equal(fleetCraftRoom(game, 0), 0)
  game.phase = 'movement'; s.movedThisPhase = true
  const r = launchMines(game, s)
  assert.ok(r.ok); assert.equal(r.launched, 4)
  const mines = game.ordnance.filter(o => o.kind === 'mine')
  assert.equal(mines.length, 4); assert.equal(mines[0].fleet, 'athanatoi'); assert.equal(mines[0].purchased, false)
  assert.equal(launchMines(game, s).ok, false, 'bays empty')
})
test('mines are not launched by a ship that has not moved, or by a battleship', () => {
  const a = duel('ath-selene', { mines: true }); a.game.phase = 'movement'
  assert.equal(launchMines(a.game, a.s).ok, false)
  const b = duel('ath-thalassa', { mines: true }); b.game.phase = 'movement'; b.s.movedThisPhase = true
  assert.equal(launchMines(b.game, b.s).ok, false)
})
test('an Athanatoi mine is hit by turrets on a 6 only', () => {
  const { game, s, t } = duel('ath-selene', { mines: true })
  game.phase = 'movement'; s.movedThisPhase = true; launchMines(game, s)
  t.pos = { x: 48, y: 60 }; game.phase = 'ordnance'; game.active = 0
  dice(game, Array(4).fill([5, 5, 5, ...Array(8).fill(1)]).flat())
  ordnancePhase(game)
  assert.ok(said(game, /no hit.*needed 6\+/))
})
test('a bays critical on a mine carrier detonates D3 mines', () => {
  const { game, s } = duel('ath-selene', { mines: true })
  // Athanatoi table 3 = keel armament damaged (the bays are on the keel); then D3 = 2
  dice(game, [4])
  critical(game, s, 3)
  assert.equal(s.damage, 2)
})
test('the End of the Ordnance Phase removes torpedo bomber salvoes through nextPhase', () => {
  const { game } = duel()
  game.phase = 'ordnance'
  game.ordnance.push({ id: 99, kind: 'torpedo', side: 0, str: 2, speed: 30, pos: { x: 0, y: 0 }, facing: 0, r: 1.25, attacked: {}, fleet: 'athanatoi', expires: `${game.round}:${game.active}:ordnance` })
  nextPhase(game)
  assert.equal(game.ordnance.length, 0)
})
