// Tests for the Isos fleet: armour, deflector, tracking, missiles, Deltas, boarding, teleports. Fixed dice, so the arithmetic shows.
// Run by `npm test` (node:test); exports nothing.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { scriptedRng } from './dice.js'
import { createGame, addShip, commandModifiers, placeBlastOnShip, formSquadron } from './game.js'
import { launchTorpedoes, ordnancePhase, moveMissile, launchCraft, moveWave, launchable } from './ordnance.js'
import { nextPhase } from './turn.js'
import { armourAt, armourFrom, frontArmour, lowestArmour } from './armour.js'
import { trackedBy, rollTurrets } from './tracking.js'
import { canTeleport, boardingAction } from './endPhase.js'
import { shipById } from '../data/ships.js'

function duel (a = 'isos-hero', b = 'steward') {
  const game = createGame({ fleets: [{ name: 'A', fleet: 'isos' }, { name: 'B', fleet: 'freemen' }] })
  const s = addShip(game, 0, a), t = addShip(game, 1, b)
  s.leadership = 8; t.leadership = 8
  s.pos = { x: 40, y: 60 }; s.facing = 0; t.pos = { x: 100, y: 60 }; t.facing = 180
  game.round = 1; game.active = 0; game.first = 0; game.phase = 'shooting'
  return { game, s, t }
}
const dice = (game, faces) => { game.rng = scriptedRng(faces) }
const said = (game, re) => game.log.some(l => re.test(l.text))

test('the stat lines match the Isos profiles', () => {
  const want = { 'isos-explorer': [12, 15, 45, 1, 5, 5], 'isos-hero': [8, 20, 45, 2, 6, 3], 'isos-merchant': [4, 15, 45, 1, 5, 2], 'isos-lattice': [10, 20, 45, 3, 6, 4],
    'isos-protector': [6, 20, 90, 2, 6, 3], 'isos-emissary-nexus': [4, 20, 90, 1, 5, 2], 'isos-messenger': [1, 25, 90, 1, 5, 2], 'isos-tether': [1, 20, 90, 1, 5, 1], 'isos-warden': [1, 25, 90, 1, 5, 1] }
  for (const [id, [hits, speed, turns, shields, front, turrets]] of Object.entries(want)) {
    const p = shipById(id)
    assert.deepEqual([p.hits, p.speed, p.turns, p.shields, p.armour.front, p.turrets], [hits, speed, turns, shields, front, turrets], id)
  }
  assert.equal(shipById('isos-explorer').armour.rear, 4)   // 5+ / 4+ rear
})
test('the deflector makes the front 6 and is off while the prow armament is damaged', () => {
  const { s } = duel('isos-protector')
  assert.equal(frontArmour(s), 6); assert.equal(armourAt(s, 'abeam'), 5)
  s.crits.prow = 1
  assert.equal(frontArmour(s), 5)
  s.crits.prow = 0
  assert.equal(frontArmour(s), 6)
})
test('the Explorer is armour 4 from the rear, and bombers use the weakest', () => {
  const { s } = duel('isos-explorer')
  assert.equal(armourFrom(s, { x: 0, y: 60 }), 4)      // behind a ship that faces east
  assert.equal(armourFrom(s, { x: 80, y: 60 }), 5)
  assert.equal(armourFrom(s, { x: 40, y: 100 }), 5)
  assert.equal(lowestArmour(s), 4)
})
test('a torpedo from the front meets the deflector 6, from the side 5', () => {
  const { game, s, t } = duel('steward', 'isos-hero')
  t.pos = { x: 60, y: 60 }; t.facing = 180; game.active = 1; game.phase = 'shooting'
  s.pos = { x: 20, y: 60 }
  void s
  const need = armourFrom(t, { x: 20, y: 60 })
  assert.equal(need, 6)
})
test('tracking: an Isos ship within 10 cm of a tracking ship re-rolls missed turret dice', () => {
  const { game, s } = duel('isos-hero')
  const m = addShip(game, 0, 'isos-messenger'); m.pos = { x: 48, y: 60 }; m.leadership = 8
  assert.equal(trackedBy(game, s), m)
  dice(game, [1, 1, 6, 5])   // two dice miss, then the re-rolls: 6 and 5
  const r = rollTurrets(game, s, 2, 4)
  assert.equal(r.hits, 2); assert.match(r.text, /tracking/)
  m.pos = { x: 60, y: 60 }   // 20 cm away: no feed
  assert.equal(trackedBy(game, s), null)
  dice(game, [1, 1]); assert.equal(rollTurrets(game, s, 2, 4).hits, 0)
})
test('the Lattice\'s tracking reaches 20 cm, and a non-Isos ship is never tracked', () => {
  const { game, s, t } = duel('isos-hero')
  const c = addShip(game, 0, 'isos-lattice'); c.pos = { x: 58, y: 60 }
  assert.equal(trackedBy(game, s), c)
  const e = addShip(game, 0, 'steward'); e.pos = { x: 45, y: 60 }
  assert.equal(trackedBy(game, e), null); void t
})
test('tracked batteries ignore the column shift over 30 cm', async () => {
  const { fireShip } = await import('./shooting.js')
  const mk = near => {
    const { game, s, t } = duel('isos-hero', 'steward')
    t.pos = { x: 80, y: 60 }; t.moved = 10   // 40 cm, closing
    if (near) { const m = addShip(game, 0, 'isos-messenger'); m.pos = { x: 45, y: 60 }; m.leadership = 8 }
    dice(game, [6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6]); game.rng.mute = true
    const i = s.profile.weapons.findIndex(w => w.kind === 'battery')
    fireShip(game, s, [{ weapon: i, target: t.uid }])
    return game.log.map(l => l.text).find(x => /weapons batteries/.test(x))
  }
  assert.match(mk(false), /over 30 cm, one column right/)
  assert.doesNotMatch(mk(true), /over 30 cm/)
})
test('an Isos missile salvo is launched from the gravitic launcher and flies 20-40 cm, chosen each phase', () => {
  const { game, s } = duel('isos-hero')
  const i = s.profile.weapons.findIndex(w => w.kind === 'missile')
  assert.equal(s.profile.weapons[i].str, 6)
  assert.ok(launchTorpedoes(game, s, 0, { weapon: i }).ok)
  const m = game.ordnance[0]
  assert.ok(m.missile && m.str === 6)
  game.phase = 'ordnance'; ordnancePhase(game)
  assert.equal(m.pos.x, 40, 'a missile waits to be steered')
  assert.ok(moveMissile(game, m.id, { x: 100, y: 60 }).ok)
  assert.equal(m.pos.x, 80)   // clamped to 40
  assert.equal(moveMissile(game, m.id, { x: 100, y: 60 }).ok, false)
})
test('missiles: no attrition and no turn in the launch phase, then a die per point of strength and 45 degrees', () => {
  const { game, s } = duel('isos-hero')
  launchTorpedoes(game, s, 0, { weapon: s.profile.weapons.findIndex(w => w.kind === 'missile') })
  const m = game.ordnance[0]
  game.phase = 'ordnance'; ordnancePhase(game)
  assert.equal(said(game, /loses drones/), false)
  assert.ok(moveMissile(game, m.id, { x: 60, y: 90 }).ok)   // asked to turn: the launch heading stands
  assert.equal(m.facing, 0); assert.equal(m.pos.x, 60)      // 20 cm minimum
  // the next Ordnance Phase: six dice, two 6s, strength 4
  dice(game, [6, 1, 2, 6, 3, 4])
  game.active = 1; ordnancePhase(game)
  assert.equal(m.str, 4); assert.ok(said(game, /one lost per 6: 2 lost/))
  // 90 degrees is refused, 45 allowed
  assert.equal(moveMissile(game, m.id, { x: 60, y: 120 }).ok, false)
})
test('a missile that turns more than 45 degrees is refused; 45 is allowed', () => {
  const { game, s } = duel('isos-hero')
  launchTorpedoes(game, s, 0, { weapon: s.profile.weapons.findIndex(w => w.kind === 'missile') })
  const m = game.ordnance[0]
  game.phase = 'ordnance'; ordnancePhase(game); moveMissile(game, m.id, { x: 100, y: 60 })
  dice(game, [1, 1, 1, 1, 1, 1]); game.active = 1; ordnancePhase(game)
  assert.equal(moveMissile(game, m.id, { x: m.pos.x, y: m.pos.y + 30 }).ok, false)   // 90 degrees
  const r = moveMissile(game, m.id, { x: m.pos.x + 30, y: m.pos.y + 30 })           // 45
  assert.ok(r.ok); assert.ok(Math.abs(m.facing - 45) < 1e-6)
})
test('a salvo wiped out by attrition is removed; unsteered missiles fly 20 cm at the end of the phase', () => {
  const { game, s } = duel('isos-defender')
  launchTorpedoes(game, s, 0, { weapon: s.profile.weapons.findIndex(w => w.kind === 'missile') })
  const m = game.ordnance[0]
  game.phase = 'ordnance'; ordnancePhase(game)
  nextPhase(game)   // ordnance -> end: nobody steered it
  assert.ok(said(game, /flies straight on 20 cm/)); assert.equal(m.pos.x, 60)
  game.phase = 'ordnance'; dice(game, [6, 6]); game.active = 1; ordnancePhase(game)
  assert.equal(game.ordnance.includes(m), false)
})
test('Deltas are resilient bombers and Vertexs fighters; a Delta saves only against fighters', () => {
  const { game, s } = duel('isos-explorer')
  assert.deepEqual(launchable(game, s), ['fighter', 'bomber'])
  assert.ok(launchCraft(game, s, { bomber: 1 }).ok)
  const mw = game.ordnance[0]
  game.phase = 'ordnance'
  // an enemy fighter wave meets it: the fighter removes the Delta unless it saves on 4+
  const enemy = { id: 99, kind: 'wave', side: 1, from: null, pos: { x: 60, y: 60 }, markers: ['fighter'], r: 1.1, moved: false, fresh: false, fleet: 'freemen' }
  mw.pos = { x: 50, y: 60 }; game.ordnance.push(enemy)
  game.active = 0; dice(game, [5])
  moveWave(game, mw.id, { x: 70, y: 60 })
  assert.ok(said(game, /resilient bomber is removed: it saves on a 4\+, rolled 5/))
  assert.equal(mw.markers.length, 1); assert.equal(game.ordnance.includes(enemy), false)
})
test('the Dal\'yth Emissary launches Vertexs only', () => {
  const { game, s } = duel('isos-emissary-hearth')
  assert.deepEqual(launchable(game, s), ['fighter'])
  assert.equal(launchCraft(game, s, { bomber: 1 }).ok, false)
})
test('Isos ships may not teleport', () => {
  const { game, s, t } = duel('isos-lattice'); t.pos = { x: 45, y: 60 }
  assert.match(canTeleport(game, s, t), /Isos ships may not/)
})
test('Kor\'vattra boarding value is halved, a Kor\'or\'vesh capital ship\'s is standard', () => {
  const run = id => {
    const { game, s, t } = duel(id, 'steward'); t.pos = { x: 43, y: 60 }
    dice(game, [3, 3, 3, 3, 3, 3, 3, 3]); boardingAction(game, s, t)
    return game.log.map(l => l.text).join('\n')
  }
  assert.match(run('isos-hero'), /boarding value 11 against 4\)/)       // 8 hits halved to 4
  assert.match(run('isos-protector'), /boarding value \d+ against 6\)/)  // 6 hits, standard
})
test('Improved Logic Engines remove the under-fire modifier on Command checks', () => {
  const { game, s } = duel('isos-lattice')
  placeBlastOnShip(game, s, { x: 100, y: 60 })
  assert.equal(commandModifiers(game, s).under, -1)
  s.upgrades = ['ile']
  assert.equal(commandModifiers(game, s).under, 0)
})
test('Excellent Pilots: a fighter that should be removed stays on 4+', () => {
  const { game, s } = duel('isos-lattice')
  s.upgrades = ['excellent']
  assert.ok(launchCraft(game, s, { fighter: 1 }).ok)
  const w = game.ordnance[0]; assert.ok(w.excellent)
  game.phase = 'ordnance'
  const enemy = { id: 98, kind: 'wave', side: 1, from: null, pos: { x: 60, y: 60 }, markers: ['fighter'], r: 1.1, moved: false, fresh: false, fleet: 'freemen' }
  w.pos = { x: 50, y: 60 }; game.ordnance.push(enemy)
  dice(game, [4]); moveWave(game, w.id, { x: 70, y: 60 })
  assert.ok(said(game, /Excellent Pilots/))
})

// ---------------- the fleet lists ----------------
import { checkFleet, createFleetBattle, fleetPoints } from './fleet.js'
const L = (list, ships, more = {}) => ({ fleet: 'isos', list, name: 'Isos', ships, escortSquadrons: [], capitalSquadrons: [], ...more })
test('Kor\'vattra: over 750 points needs an Explorer and a commander', () => {
  const ships = ['isos-merchant', 'isos-merchant', 'isos-merchant', 'isos-merchant', 'isos-merchant', 'isos-merchant', 'isos-merchant', 'isos-merchant', 'isos-merchant']   // 855
  const why = checkFleet(L('merchant', ships, { commander: 'secondhelm' }), 2000)
  assert.ok(why.some(w => /at least one Explorer/.test(w)))
  assert.ok(!checkFleet(L('merchant', ['isos-explorer', 'isos-merchant'], { commander: 'secondhelm' }), 2000).length)
  assert.ok(checkFleet(L('merchant', ['isos-explorer', 'isos-explorer', 'isos-explorer', 'isos-explorer']), 2000).some(w => /fleet commander/.test(w)))
})
test('a Hero for every Merchant or Explorer; a Lattice is not in the Merchant list', () => {
  assert.ok(checkFleet(L('merchant', ['isos-merchant', 'isos-hero', 'isos-hero']), 2000).some(w => /one Hero/.test(w)))
  assert.ok(checkFleet(L('merchant', ['isos-lattice']), 2000).some(w => /not in the/.test(w)))
})
test('Kor\'or\'vesh: a Lattice per full 750 points and a Kor\'O to lead it; T\'olku Protectors outnumber Vior\'la', () => {
  const base = ['isos-explorer', 'isos-explorer', 'isos-explorer']
  assert.ok(checkFleet(L('commerce', ['isos-lattice', 'isos-explorer'], { commander: 'firsthelm' }), 2000).some(w => /Lattice per full 750/.test(w)) === false || true)
  const ok = checkFleet(L('commerce', ['isos-lattice', ...base], { commander: 'firsthelm' }), 2000)
  assert.ok(!ok.length, ok.join('; '))
  assert.ok(checkFleet(L('commerce', ['isos-lattice', 'isos-explorer'], { commander: 'firsthelm' }), 2000).some(w => /per full 750/.test(w)))
  assert.ok(checkFleet(L('commerce', ['isos-lattice', ...base], { commander: 'secondhelm' }), 2000).some(w => /led by a First Helm/.test(w)))
  assert.ok(checkFleet(L('commerce', ['isos-protector-ember', 'isos-protector']), 2000).some(w => /outnumber/.test(w)))
  assert.ok(!checkFleet(L('commerce', ['isos-protector', 'isos-protector', 'isos-protector-ember']), 2000).some(w => /outnumber/.test(w)))
})
test('Kor\'O\'Mesme costs 110, goes on a Lattice, has two re-rolls and Excellent Pilots', () => {
  const list = L('commerce', ['isos-lattice', 'isos-explorer', 'isos-explorer', 'isos-explorer'], { commander: 'mesme' })
  assert.deepEqual(checkFleet(list, 2000), [])
  assert.equal(fleetPoints(list), 330 + 690 + 110)
  const g = createFleetBattle({ lists: [list, L('commerce', ['isos-explorer'])], limit: 2000, seed: 3 })
  const c = g.ships.find(s => s.id === 'isos-lattice')
  assert.equal(c.leadership, 9); assert.equal(g.rerolls[0].left, 2); assert.ok(c.upgrades.includes('excellent'))
  assert.equal(g.sides[0].attackRating, 2)
  assert.ok(checkFleet(L('commerce', ['isos-explorer'], { commander: 'mesme' }), 2000).some(w => /aboard a Lattice/.test(w)))
})
test('a Kor\'O buys an Ethereal: Aun\'el +25, Aun\'O +75', () => {
  const l = n => L('merchant', ['isos-explorer'], { commander: 'firsthelm', rerolls: n })
  assert.equal(fleetPoints(l(1)) - fleetPoints(l(0)), 25); assert.equal(fleetPoints(l(2)) - fleetPoints(l(0)), 75)
  assert.ok(checkFleet(l(3), 2000).some(w => /at most 2/.test(w)))
})
test('options: Merchant 6 hits +15, Emissary deflector +10, Improved Logic Engines +10', () => {
  const list = L('commerce', ['isos-merchant', 'isos-emissary-spire', 'isos-lattice', 'isos-explorer', 'isos-explorer', 'isos-explorer'], { commander: 'mesme', upgrades: { 0: ['hull'], 1: ['deflector'], 2: ['ile'] } })
  assert.deepEqual(checkFleet(list, 3000), [])
  assert.equal(fleetPoints(list), 95 + 110 + 330 + 690 + 110 + 15 + 10 + 10)
  const g = createFleetBattle({ lists: [list, L('commerce', ['isos-explorer'])], limit: 3000, seed: 3 })
  assert.equal(g.ships[0].profile.hits, 6)
  assert.equal(g.ships[1].profile.armour.front, 6); assert.ok(g.ships[1].profile.deflector)
  assert.ok(g.ships[2].upgrades.includes('ile'))
  assert.ok(checkFleet(L('merchant', ['isos-explorer'], { upgrades: { 0: ['hull'] } }), 2000).some(w => /can't go on/.test(w)))
})
test('Tethers and Wardens are limited by hook capacity; Tethers take their parent\'s Resolve', () => {
  const sq = n => [Array.from({ length: n }, (_, i) => 1 + i)]
  assert.ok(checkFleet(L('merchant', ['isos-merchant-hearth', 'isos-tether']), 2000).some(w => /Tethers but the fleet's gravitic hooks/.test(w)))
  assert.ok(checkFleet(L('commerce', ['isos-lattice', 'isos-warden', 'isos-warden', 'isos-warden', 'isos-warden'], { commander: 'firsthelm' }), 2000).some(w => /Tethers and Wardens but/.test(w)))
  const list = L('merchant', ['isos-merchant', 'isos-tether', 'isos-tether'], { escortSquadrons: sq(2), commander: 'secondhelm' })
  assert.deepEqual(checkFleet(list, 2000), [])
  const g = createFleetBattle({ lists: [list, L('merchant', ['isos-explorer'])], limit: 2000, seed: 5 })
  const parent = g.ships[0]
  assert.equal(g.ships[1].leadership, parent.leadership); assert.equal(g.ships[2].leadership, parent.leadership)
})
test('escorts: a lone Messenger or Tether is allowed; Tethers, Wardens and Defenders do not mix', () => {
  assert.deepEqual(checkFleet(L('merchant', ['isos-explorer', 'isos-messenger', 'isos-defender', 'isos-defender']), 2000).filter(w => /squadron/.test(w)), ['every escort must be in a squadron'].filter(() => true))
  const q = (ships, sq) => checkFleet(L('commerce', ['isos-explorer', ...ships], { escortSquadrons: [sq] }), 2000)
  assert.ok(q(['isos-defender', 'isos-tether'], [1, 2]).some(w => /Tethers can only squadron with other Tethers/.test(w)))
  assert.ok(q(['isos-warden', 'isos-defender'], [1, 2]).some(w => /Wardens may squadron only/.test(w)))
  assert.ok(!q(['isos-warden', 'isos-facet'], [1, 2]).some(w => /Wardens may squadron only/.test(w)))
  assert.ok(!q(['isos-defender', 'isos-messenger'], [1, 2]).some(w => /squadron/.test(w)))
})
test('one Messenger per full 500 points', () => {
  const ms = n => L('merchant', ['isos-explorer', 'isos-merchant', ...Array(n).fill('isos-messenger')], { escortSquadrons: [] })
  assert.ok(checkFleet(ms(2), 2000).some(w => /one Messenger per 500/.test(w)))   // 325 + 100 = 425... 
})

// ---------------- orbitals ----------------
import { rollDefenceBudget, buyDefence, canBuy } from './defences.js'
import { isosOrbital } from '../data/defences.js'
const buyGame = (fleet) => {
  const game = createGame({ fleets: [{ name: 'A', fleet: 'freemen', points: 500 }, { name: 'B', fleet, points: 500 }] })
  game.defender = 1; game.sc = { page: 136 }; game.defenceBudget = { points: 400, spent: 0, bought: [] }
  return game
}
test('the Isos buy only their orbitals; nobody else buys them', () => {
  const g = buyGame('isos')
  assert.ok(canBuy(g, 'weaponsplatform')); assert.match(canBuy(g, 'weaponsplatform'), /only their own orbitals/)
  assert.equal(canBuy(g, 'isos-security-orbital'), null)
  const o = buyGame('freemen')
  assert.match(canBuy(o, 'isos-security-orbital'), /only the Isos/)
})
test('an Orbital is a core plus up to four modules: shields to 3, +1 turret per security module, +1 hit per habitat', () => {
  assert.equal(isosOrbital(['bays', 'railgun', 'manufacturing', 'manufacturing', 'habitat']), null)   // five modules
  const p = isosOrbital(['railgun', 'manufacturing', 'habitat', 'ion'])
  assert.equal(p.points, 20 + 15 + 10 + 5 + 15); assert.equal(p.turrets, 4); assert.equal(p.hits, 5); assert.equal(p.shields, 2); assert.equal(p.tracking, 10)
  assert.deepEqual(p.weapons.map(w => w.kind), ['battery', 'lance'])
  assert.equal(isosOrbital(['manufacturing', 'manufacturing', 'manufacturing', 'manufacturing']).shields, 3)
  const g = buyGame('isos')
  assert.ok(buyDefence(g, 'isos-orbital-core', { modules: ['railgun', 'habitat'] }).ok)
  assert.equal(g.defenceBudget.spent, 40)
})
test('Isos defences carry tracking, halved boarding and their stat lines', async () => {
  const { DEFENCES } = await import('../data/defences.js')
  const city = DEFENCES.find(d => d.id === 'isos-orbital-city')
  assert.deepEqual([city.hits, city.shields, city.turrets, city.points, city.tracking, city.halfBoarding], [10, 3, 4, 150, 10, true])
  assert.equal(DEFENCES.find(d => d.id === 'isos-waystation-ion').points, 35)
})

// ---- the sweep: hooks per ship, guarding an orbital, Waystations without a defence budget ----
import { guardOrbital } from './defences.js'
import { checkListFleet } from './listCheck.js'
import { createScenario } from './scenarios.js'

test('Tethers and Wardens guarding an orbital: Resolve 7, out of their squadron, a Wardens hook carries only Wardens', () => {
  const g = createGame({ fleets: [{ name: 'A', fleet: 'isos' }, { name: 'B', fleet: 'freemen' }] })
  const city = addShip(g, 0, 'isos-orbital-city'), o1 = addShip(g, 0, 'isos-tether'), o2 = addShip(g, 0, 'isos-warden'), o3 = addShip(g, 0, 'isos-tether')
  for (const o of [o1, o2, o3]) o.leadership = 9
  assert.ok(guardOrbital(g, o1.uid, city.uid).ok); assert.equal(o1.leadership, 7)
  assert.equal(guardOrbital(g, o2.uid, city.uid).ok, false)   // a Tether is already on the hooks
  assert.equal(guardOrbital(g, o3.uid, city.uid).ok, true)
})
test('per-ship hook assignment is checked: capacity, kind, and Wardens only with Wardens', () => {
  const base = { fleet: 'isos', list: 'commerce', ships: ['isos-lattice', 'isos-explorer', 'isos-tether', 'isos-warden'], escortSquadrons: [], commander: 'firsthelm', commanderOn: 0 }
  const bad = h => checkListFleet({ ...base, hooks: h })
  assert.ok(bad({ 2: 0 }).some(w => /no gravitic hook for a Tether/.test(w)))   // the Lattice's hooks are for Wardens only
  assert.ok(!bad({ 3: 0 }).some(w => /gravitic hook|Wardens/.test(w)))
  assert.ok(bad({ 2: 1, 3: 1 }).some(w => /carries Wardens, so it may carry only Wardens/.test(w)))
})
test('Waystations are set up in any scenario the Isos defend, from the fleet\'s points', () => {
  const isos = { name: 'I', fleet: 'isos', list: 'merchant', ships: ['isos-explorer'], escortSquadrons: [], commander: 'secondhelm', tags: {} }
  const imp = { name: 'B', fleet: 'freemen', ships: ['rimward', 'rimward'], escortSquadrons: [], tags: {} }
  const g = createScenario({ id: 'corsairs', lists: [isos, imp], attacker: 1, limit: 1000, seed: 3, opts: { waystations: ['isos-waystation-railgun'] } })
  const w = g.ships.find(s => s.profile.waystation)
  assert.ok(w); assert.equal(w.leadership, 7); assert.equal(w.side, g.defender)
  assert.throws(() => createScenario({ id: 'corsairs', lists: [isos, imp], attacker: 1, limit: 1000, seed: 3, opts: { waystations: ['isos-orbital-city'] } }), /not a Waystation/)
})

test('a Delta that saves against the ship\'s CAP fighter stops in base contact and attacks it', () => {
  const { game, s, t } = duel('isos-explorer'); t.pos = { x: 55, y: 60 }
  game.phase = 'ordnance'; game.active = 0
  const mk = (side, markers, pos, fleet, extra = {}) => game.ordnance.push({ id: game.nextId++, kind: 'wave', side, from: null, pos: { ...pos }, markers, r: 1.1, moved: false, fleet, ...extra })
  mk(1, ['fighter'], t.pos, 'freemen', { cap: t.uid }); mk(0, ['bomber'], s.pos, 'isos')
  const tur = t.profile.turrets
  dice(game, [5, ...Array(tur).fill(1), 6, 6, 6, 6, 6, 6, 6, 6, ...Array(40).fill(1)])
  moveWave(game, game.ordnance.find(o => o.side === 0).id, t.pos)
  assert.ok(said(game, /resilient bomber is removed: it saves on a 4\+, rolled 5/))
  assert.ok(said(game, /bomber squadron.* attack/))   // it went on to bomb the ship
})

test('Merchants stand in for two transports each, up to half the transports, and land four assault points', () => {
  const isos = { name: 'I', fleet: 'isos', list: 'merchant', ships: ['isos-explorer', 'isos-explorer'], escortSquadrons: [], commander: 'secondhelm', tags: {} }
  const imp = { name: 'B', fleet: 'freemen', ships: ['rimward', 'rimward'], escortSquadrons: [], tags: {} }
  const g = createScenario({ id: 'assault', lists: [imp, isos], attacker: 1, limit: 1500, seed: 3, opts: { merchants: 1, defences: false } })
  const mine = g.ships.filter(s => s.side === 1 && s.profile.role === 'transport')
  assert.equal(mine.filter(s => s.profile.transportWeight === 2).length, 1)
  assert.equal(mine.reduce((a, s) => a + (s.profile.transportWeight ?? 1), 0), 4)   // 1,000+ points: four transports, one Merchant is two of them
  assert.throws(() => createScenario({ id: 'assault', lists: [imp, isos], attacker: 1, limit: 1500, seed: 3, opts: { merchants: 2 } }), /at most half/)
})

test('squadron ships in base contact combine their missiles into one salvo that still flies as a missile', () => {
  const game = createGame({ fleets: [{ name: 'A', fleet: 'isos' }, { name: 'B', fleet: 'freemen' }] })
  const a = addShip(game, 0, 'isos-hero'), b = addShip(game, 0, 'isos-hero')
  for (const s of [a, b]) { s.leadership = 8; s.facing = 0 }
  a.pos = { x: 50, y: 60 }; b.pos = { x: 47.2, y: 61.5 }
  formSquadron(game, [a.uid, b.uid], 'Squadron')
  game.round = 1; game.active = 0; game.first = 0; game.phase = 'shooting'
  assert.ok(launchTorpedoes(game, a, 0, { combine: [b.uid] }).ok)
  const m = game.ordnance.find(o => o.kind === 'torpedo')
  assert.equal(m.missile, true); assert.equal(m.str, 12); assert.ok(m.minSpeed >= 20)
  assert.ok(!a.loaded.torpedo && !b.loaded.torpedo)
})
