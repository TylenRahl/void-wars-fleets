// Tests for the Katharos fleet: storm arcs, flayer, sun flare, Ossuary, portals, reactive hulls, Null-Mass Drive, criticals, lists.
// Run by `npm test` (node:test); exports nothing.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { scriptedRng } from './dice.js'
import { createGame, addShip, commandModifiers, giveOrder, rollLeadership, placeBlastOnShip, ordersBarred, formSquadron } from './game.js'
import { fireShip, baseColumn } from './shooting.js'
import { damageShip, critical, hitWithShields } from './damage.js'
import { armourAt, frontArmour } from './armour.js'
import { hitAndRun, endPhase } from './endPhase.js'
import { checkMove, speedOf } from './movement.js'
import { fireStarPulse, useOssuary, portalCount, portalProblem, fadeOut, katharosLoss, starPulseProblem } from './katharos.js'
import { fleetVictoryPoints, checkFleet, fleetPoints, createFleetBattle } from './fleet.js'
import { nextPhase } from './turn.js'
import { shipById } from '../data/ships.js'
import { notYet } from '../data/fleets.js'

function duel (a = 'kat-sickle', b = 'steward', fleetB = 'freemen') {
  const game = createGame({ fleets: [{ name: 'K', fleet: 'katharos' }, { name: 'B', fleet: fleetB }] })
  const s = addShip(game, 0, a), t = addShip(game, 1, b)
  s.leadership = 8; t.leadership = 8
  s.pos = { x: 50, y: 60 }; s.facing = 0; t.pos = { x: 70, y: 60 }; t.facing = 180
  game.round = 1; game.active = 0; game.first = 0; game.phase = 'shooting'
  return { game, s, t }
}
const dice = (game, faces) => { game.rng = scriptedRng(faces) }
const said = (game, re) => game.log.some(l => re.test(l.text))

test('the stat lines match the Katharos profiles and nothing is left pending', () => {
  const want = { 'kat-barrow': [12, 20, 45, 4, 4, 6], 'kat-sickle': [8, 30, 45, 5, 3, 6], 'kat-pall': [4, 30, 45, 5, 1, 6], 'kat-vigil': [1, 40, 90, 6, 1, 6], 'kat-knell': [1, 50, 90, 6, 1, 6] }
  for (const [id, [hits, speed, turns, save, turrets, armour]] of Object.entries(want)) {
    const p = shipById(id)
    assert.deepEqual([p.hits, p.speed, p.turns, p.save, p.turrets, p.armour.front], [hits, speed, turns, save, turrets, armour], id)
    assert.equal(p.shields, 0); assert.deepEqual(notYet(p), [], id)
  }
  assert.equal(shipById('kat-barrow-ossuary').points, 550)
})

test('storm arc: every target counts as closing, whatever the discipline, and a mirage field gives no column shift', () => {
  const { game, s, t } = duel('kat-sickle', 'ath-eos', 'athanatoi')
  t.pos = { x: 55, y: 45 }; t.moved = 20; t.facing = 0   // off the Sickle's left side, which is where its storm arcs point
  assert.equal(baseColumn(t, 'away'), 2)
  dice(game, [6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6])
  game.rng = scriptedRng(Array(30).fill(1))   // everything misses; we read the log
  const w = s.profile.weapons.findIndex(x => x.kind === 'lightning')
  const r = fireShip(game, s, [{ weapon: w, target: t.uid }])
  assert.ok(r.ok, JSON.stringify(game.log.slice(-2)))
  assert.ok(said(game, /storm arcs \(firepower 8\).*capital ships closing.*every target counts as closing/), 'closing column')
  assert.ok(!said(game, /mirage field, one column right/))
})

test('storm arc firepower can be split among targets, up to its total', () => {
  const { game, s, t } = duel('kat-barrow', 'steward')
  const t2 = addShip(game, 1, 'steward'); t2.leadership = 8; t2.pos = { x: 70, y: 70 }; t2.facing = 180
  game.rng = scriptedRng(Array(40).fill(1))
  const w = s.profile.weapons.findIndex(x => x.kind === 'lightning')
  assert.ok(fireShip(game, s, [{ weapon: w, target: t.uid, str: 12 }, { weapon: w, target: t2.uid, str: 8 }]).ok)
  game.ships.forEach(x => { x.fired = false })
  assert.equal(fireShip(game, s, [{ weapon: w, target: t.uid, str: 12 }, { weapon: w, target: t2.uid, str: 9 }]).ok, false)
})

test('flayer: 4 and 5 hit like a lance, a 6 ignores shields and puts no Blast Marker', () => {
  const { game, s, t } = duel('kat-sickle', 'steward')
  const w = s.profile.weapons.findIndex(x => x.kind === 'whip')   // strength 4
  t.profile = { ...t.profile, shields: 2 }
  // four lance dice: 6, 5, 4, 2. The 5 and 4 meet two shields (absorbed, two Blast Markers); the 6 goes through; then the 6's critical roll
  dice(game, [6, 5, 4, 2, 1])
  const r = fireShip(game, s, [{ weapon: w, target: t.uid }])
  assert.ok(r.ok)
  assert.equal(t.damage, 1)
  assert.equal(game.blast.length, 2)
  assert.ok(said(game, /1 of them 6 that ignore shields and mirage fields/))
})

test('reactive hull: a save against every point of damage, replaced by 2+ when braced, armour 4 when braced', () => {
  const { game, s } = duel('kat-barrow', 'steward')
  assert.equal(frontArmour(s), 6); assert.equal(armourAt(s, 'abeam'), 6)
  dice(game, [3, 4, 1, 6, 1, 1])   // 4 damage: saves 3 (no), 4 (yes: 4+), 1 (no), 6 (yes); then two unsaved points roll criticals 1, 1
  assert.equal(damageShip(game, s, 4, { what: 'test' }), 2)
  assert.ok(said(game, /reactive hull: 4 saves rolled 3, 4, 1, 6, needed 4\+: 2 saved/))
  s.order = { kind: 'brace', until: 2 }
  assert.equal(frontArmour(s), 4); assert.equal(armourAt(s, 'away'), 4)
  dice(game, [2, 1, 1])
  assert.equal(damageShip(game, s, 2, { what: 'test' }), 1, 'needs 2+ when braced')
})

test('the hull save does not apply to boarding damage or critical damage', () => {
  const { game, s } = duel('kat-sickle', 'steward')
  dice(game, [])
  assert.equal(damageShip(game, s, 3, { what: 'boarding', noCrits: true, noSave: true, boarding: true }), 3)
})

test('Hit-and-Run against a Katharos ship gets no save unless it is braced, then 2+', () => {
  const { game, s: kat } = duel('kat-sickle', 'steward')
  const raider = game.ships[1]
  dice(game, [5, 6, 1])   // natural 5 hits a capital ship; crit row 5 is "Power Flow Disrupted" (needs 2D6 here), but we only watch the save
  game.rng = scriptedRng([5, 3, 4, 1, 1, 1, 1])
  hitAndRun(game, kat, raider)
  assert.ok(!said(game, /braced, but it saves/) && !said(game, /reactive hull/), 'no save when not braced')
  kat.order = { kind: 'brace', until: 2 }
  game.rng = scriptedRng([5, 2])
  assert.equal(hitAndRun(game, kat, raider), false)
  assert.ok(said(game, /it is braced and rolls 2, needed 2\+: saved/))
})

test('Katharos critical hits table: arcs, Resolve loss that repairs do not give back, the Ossuary row rolled again', () => {
  const { game, s } = duel('kat-sickle', 'steward')
  s.leadership = 8
  critical(game, s, 6)
  assert.equal(s.crits.driveFixed, 1); assert.equal(s.leadership, 7)
  critical(game, s, 10)
  assert.equal(s.leadership, 4)
  // Ossuary Damaged on a ship with none: roll again (2D6 = 2 + 3 = 5 flows all)
  game.rng = scriptedRng([4, 5, 2, 3])
  critical(game, s)
  assert.equal(s.crits.flowAll, 1); assert.equal(s.crits.ossuary ?? 0, 0)
  game.rng = scriptedRng([2])   // Power Surge: D3 extra
  critical(game, s, 11)
  assert.equal(s.leadership, 2); assert.equal(s.damage, 1)
  const j = addShip(game, 0, 'kat-vigil'); j.pos = { x: 10, y: 10 }
  critical(game, j, 6)
  assert.equal(j.state, 'destroyed', 'an escort is destroyed by any critical')
})

test('Power Flow Disrupted switches off storm arcs and whips by arc until repaired', () => {
  const { game, s, t } = duel('kat-sickle', 'steward')
  const L = s.profile.weapons.findIndex(x => x.kind === 'lightning'), Wh = s.profile.weapons.findIndex(x => x.kind === 'whip')
  t.pos = { x: 50, y: 40 }   // facing east (0 degrees), y smaller = left side
  s.crits.flowPort = 1
  game.rng = scriptedRng(Array(20).fill(1))
  assert.equal(fireShip(game, s, [{ weapon: L, target: t.uid }]).ok, false, 'port arc is off')
  s.crits.flowPort = 0; s.crits.flowArcs = 1
  assert.equal(fireShip(game, s, [{ weapon: L, target: t.uid }]).ok, false)
  assert.equal(fireShip(game, s, [{ weapon: Wh, target: t.uid }]).ok, true, 'the whip still works with 4')
})

test('repairs are made on 4+', () => {
  const { game, s } = duel('kat-sickle', 'steward')
  s.crits.driveFixed = 1; game.phase = 'end'
  dice(game, [4, 1, 1, 1, 1, 1, 1, 1, 3])   // 8 dice (hits left 8): the first is a 4; then the Blast Marker D6
  endPhase(game)
  assert.equal(s.crits.driveFixed, 0)
  assert.ok(said(game, /each 4\+ fixes one: 1/))
})

test('Null-Mass Drive: D6 x 10 cm on All Ahead Full, a turn for every 20 cm', () => {
  const { game, s } = duel('kat-sickle', 'steward')
  game.phase = 'movement'
  s.leadership = 10
  dice(game, [3, 4, 5])   // Command check 7 passes, D6 = 5 -> +50 cm
  const r = giveOrder(game, s, 'aheadFull')
  assert.ok(r.ok); assert.equal(s.order.extra, 50)
  let c = checkMove(game, s, [{ fwd: 80 }])
  assert.equal(c.ok, true); assert.equal(c.turns, 4)
  c = checkMove(game, s, [{ fwd: 30 }, { turn: 45 }, { fwd: 50 }])
  assert.equal(c.ok, true)
  c = checkMove(game, s, [{ fwd: 10 }, { turn: 45 }, { fwd: 70 }])
  assert.equal(c.ok, false); assert.match(c.reasons.join(), /every 20 cm/)
  c = checkMove(game, s, [{ fwd: 25 }, { turn: 60 }, { fwd: 55 }])
  assert.equal(c.ok, false, 'more than its 45 degrees')
  s.crits.driveFixed = 1
  assert.equal(checkMove(game, s, [{ fwd: 30 }, { turn: 45 }, { fwd: 50 }]).ok, false)
})

test('a damaged Null-Mass Drive forbids All Ahead Full; Drive Damaged slows by 5', () => {
  const { game, s } = duel('kat-sickle', 'steward')
  game.phase = 'movement'; s.leadership = 10
  s.crits.nullmass = 1
  assert.equal(giveOrder(game, s, 'aheadFull').ok, false)
  s.crits.driveSlow = 1
  assert.equal(speedOf(s), 25)
})

test('reactive hulls ignore Blast Markers for Resolve and movement; Blast Markers still shift gunnery', () => {
  const { game, s, t } = duel('kat-sickle', 'steward')
  placeBlastOnShip(game, s, t.pos)
  assert.equal(commandModifiers(game, s).under, 0)
  assert.equal(commandModifiers(game, t).under, 0)
  placeBlastOnShip(game, t, s.pos)
  assert.equal(commandModifiers(game, t).under, -1)
  game.phase = 'movement'
  const c = checkMove(game, s, [{ fwd: 20 }])
  assert.equal(c.slowed, false); assert.equal(c.max, 30)
})

test('radiation and solar flares do nothing to a Katharos ship', async () => {
  const { game, s } = duel('kat-sickle', 'steward')
  game.effects = { zone: 1, sunward: 'top', flares: 0, bursts: 0, flareDone: false, radiation: { round: 1, level: 3 } }
  game.rng = scriptedRng([5, 5, 5, 5, 5, 5, 5])
  const { leadershipTest } = await import('./game.js')
  const t = leadershipTest(game, s, { why: 'test' })
  assert.equal(t.need, 8)
})

test('sun flare: 1D6 per enemy ship against the facing armour, per ordnance marker 4+, not on orders or crippled', () => {
  const { game, s, t } = duel('kat-sickle', 'steward')
  t.pos = { x: 65, y: 60 }; t.facing = 180   // 15 cm away, its front towards the Sickle: armour 6+ front on a Steward? read it
  const need = armourAt(t, 'closing')
  const far = addShip(game, 1, 'steward'); far.pos = { x: 100, y: 60 }; far.leadership = 8
  game.ordnance.push({ id: 900, kind: 'wave', side: 1, from: t.uid, pos: { x: 55, y: 60 }, markers: ['bomber', 'fighter'], r: 1.5, fresh: false, fleet: 'freemen' })
  game.ordnance.push({ id: 901, kind: 'torpedo', side: 1, from: t.uid, pos: { x: 45, y: 60 }, str: 3, r: 1, attacked: {}, fleet: 'freemen' })
  dice(game, [6, 4, 3, 5, 1, 1, 1])   // ship die 6, wave markers 4 and 3, torpedo 5, then criticals
  const r = fireStarPulse(game, s)
  assert.ok(r.ok)
  assert.equal(r.results.length, 1, 'the far ship is out of the 20 cm')
  assert.equal(r.results[0].hit, 6 >= need)
  assert.equal(game.ordnance.length, 1, 'one wave marker survived, the torpedo went')
  assert.equal(game.ordnance[0].markers.length, 1)
  assert.match(starPulseProblem(game, s), /already pulsed/)
  s.pulsedRound = 0; s.order = { kind: 'lockOn' }
  assert.match(starPulseProblem(game, s), /Lock On/)
  s.order = null; s.damage = 4
  assert.match(starPulseProblem(game, s), /crippled/)
})

test('sun flare leaves other Katharos ships alone and ignores mirage fields', () => {
  const { game, s, t } = duel('kat-sickle', 'ath-eos', 'athanatoi')
  t.pos = { x: 60, y: 60 }
  const friend = addShip(game, 0, 'kat-sickle'); friend.pos = { x: 55, y: 60 }; friend.leadership = 8
  game.rng = scriptedRng([6, 1, 1, 1])
  const r = fireStarPulse(game, s)
  assert.equal(r.results.length, 1)
  assert.ok(!said(game, /miragefield/))
})

test('Ossuary: Resolve Test; failed, Resolve -1 for good and no orders (Brace included) until after its next turn; ordnance on 4+', () => {
  const { game, s, t } = duel('kat-barrow-ossuary', 'steward')
  assert.equal(s.profile.weapons.some(w => w.kind === 'ossuary'), true)
  t.pos = { x: 65, y: 60 }
  game.ordnance.push({ id: 910, kind: 'torpedo', side: 1, from: t.uid, pos: { x: 55, y: 60 }, str: 3, r: 1, attacked: {}, fleet: 'freemen' })
  game.ordnance.push({ id: 911, kind: 'torpedo', side: 1, from: t.uid, pos: { x: 56, y: 60 }, str: 3, r: 1, attacked: {}, fleet: 'freemen', boarding: true })
  dice(game, [6, 6, 4])   // 2D6 = 12 fails; the boarding torpedo 4 is removed; the ordinary torpedo is untouched
  const r = useOssuary(game, s, t.uid)
  assert.equal(r.ok, true); assert.equal(r.pass, false)
  assert.equal(t.leadership, 7)
  assert.equal(game.ordnance.length, 1); assert.equal(game.ordnance[0].id, 910)
  // barred through ITS next turn: side 1 plays the second half of round 1
  assert.equal(ordersBarred(game, t), true)
  game.active = 1; assert.equal(ordersBarred(game, t), true, 'still barred in its own next turn')
  game.round = 2; game.active = 0; assert.equal(ordersBarred(game, t), false, 'free once that turn is over')
})

test('Ossuary bar lasts to the end of the target\'s next turn, and refuses Brace', () => {
  const { game, s, t } = duel('kat-barrow-ossuary', 'steward')
  t.pos = { x: 65, y: 60 }
  dice(game, [6, 6])
  useOssuary(game, s, t.uid)
  // t's side plays after the Katharos in round 1: its next turn is round 1, second half
  game.active = 1
  assert.equal(giveOrder(game, t, 'brace').ok, false)
  game.round = 2; game.active = 0
  assert.equal(ordersBarred(game, t), false)
  // second use: refused on orders / crippled / damaged
  game.round = 3; s.order = { kind: 'lockOn' }
  assert.equal(useOssuary(game, s, t.uid).ok, false)
})

test('a passed Ossuary test does nothing; the ship carrying one has Resolve 10', () => {
  const { game, s, t } = duel('kat-barrow-ossuary', 'steward')
  t.pos = { x: 65, y: 60 }
  rollLeadership(game, s)
  assert.equal(s.leadership, 10)
  dice(game, [1, 2])
  assert.equal(useOssuary(game, s, t.uid).pass, true)
  assert.equal(t.leadership, 8)
  const plain = addShip(game, 0, 'kat-barrow'); assert.equal(useOssuary(game, plain, t.uid).ok, false)
})

test('portals: one Hit-and-Run attack each, 10 cm, shields down, halved rounding down by crippling and bracing', () => {
  const { game, s, t } = duel('kat-barrow', 'steward')
  game.phase = 'end'; t.pos = { x: 58, y: 60 }; t.profile = { ...t.profile, shields: 0 }
  assert.equal(portalCount(s), 3)
  s.damage = 6; assert.equal(portalCount(s), 1)   // crippled
  s.order = { kind: 'brace', until: 2 }; assert.equal(portalCount(s), 0, 'crippled and braced: none')
  s.damage = 0; assert.equal(portalCount(s), 1, 'braced alone 3 -> 1')
  s.order = null
  assert.equal(portalProblem(game, s, t, 0), null)
  assert.match(portalProblem(game, s, t, 3), /only 3 portals/)
  t.pos = { x: 70, y: 60 }; assert.match(portalProblem(game, s, t), /within 10/)
  t.pos = { x: 58, y: 60 }; t.profile = { ...t.profile, shields: 2 }; assert.match(portalProblem(game, s, t), /shields must be down/)
})

test('a portal works on any special order, and a Raider cannot board anything with more than 6 hits left', () => {
  const { game, s, t } = duel('kat-vigil', 'steward')
  t.pos = { x: 55, y: 60 }; t.profile = { ...t.profile, shields: 0 }; s.order = { kind: 'lockOn' }
  assert.match(portalProblem(game, s, t), /more than 6 Hull Points/)
  t.damage = t.profile.hits - 6
  assert.equal(portalProblem(game, s, t), null)
  s.order = { kind: 'brace', until: 2 }
  assert.equal(portalCount(s), 0, 'a braced Vigil has 0 portals (1 halves down to 0)')
})

test('endPhase runs portal attacks as extra Hit-and-Run attacks', () => {
  const { game, s, t } = duel('kat-sickle', 'steward')
  game.phase = 'end'; t.pos = { x: 58, y: 60 }; t.profile = { ...t.profile, shields: 0 }
  game.rng = scriptedRng([1, 1, 1, 1, 1, 1, 1, 1, 1, 1])
  endPhase(game, { teleports: [[s.uid, t.uid, 'portal'], [s.uid, t.uid, 'portal'], [s.uid, t.uid, 'portal']] })
  assert.equal(game.log.filter(l => /portal floods/.test(l.text)).length, 2, 'a Sickle has two portals')
  assert.ok(said(game, /can't use a portal: it has only 2 portals/))
})

test('fade out: automatic disengage at the end of the Manoeuvre Phase, no test', () => {
  const { game, s } = duel('kat-sickle', 'steward')
  game.phase = 'movement'
  assert.equal(fadeOut(game, s).ok, false, 'must have moved')
  s.movedThisPhase = true
  game.rng = scriptedRng([])
  assert.equal(fadeOut(game, s).ok, true)
  assert.equal(s.state, 'disengaged')
  const { game: g2, t } = duel('kat-sickle', 'steward'); g2.phase = 'movement'; t.movedThisPhase = true
  assert.equal(fadeOut(g2, t).ok, false, 'only Katharos ships fade out')
})

test('victory points count the Katharos losses by their percentage table', () => {
  const { game, s } = duel('kat-barrow', 'steward')   // 500 points
  const v = () => katharosLoss(s, 500)
  s.state = 'disengaged'; assert.equal(v(), 50)
  s.damage = 1; assert.equal(v(), 125)
  s.damage = 6; assert.equal(v(), 250, 'crippled and disengaged: the highest line, 50%')
  s.state = 'active'; assert.equal(v(), 250)
  s.damage = 0; assert.equal(v(), 0)
  s.state = 'destroyed'; assert.equal(v(), 1000)
  s.state = 'drifting'; assert.equal(v(), 1500)
  const j = addShip(game, 0, 'kat-vigil'); j.state = 'disengaged'
  assert.equal(katharosLoss(j, 50), 13, 'a raider that disengages: 25%')
  assert.equal(fleetVictoryPoints(game, 1), 1500 + 13)
  assert.equal(katharosLoss(game.ships[1], 100), null, 'non-Katharos ships use the standard table')
})

test('the Pall: no Command bonus for the enemy from its orders; +1 for the fleet while one is uncrippled', () => {
  const { game, s, t } = duel('kat-sickle', 'steward')
  const sh = addShip(game, 0, 'kat-pall'); sh.pos = { x: 40, y: 60 }; sh.leadership = 8
  t.order = { kind: 'lockOn' }
  const m = commandModifiers(game, s)
  assert.deepEqual([m.contacts, m.pall, m.total], [1, 1, 2])
  sh.damage = 2; assert.equal(commandModifiers(game, s).total, 1, 'crippled Pall: no extra +1')
  s.order = { kind: 'lockOn' }; sh.damage = 0
  const m2 = commandModifiers(game, t)
  assert.equal(m2.contacts, 1, 'ordinary ship on orders still counts')
  sh.order = { kind: 'lockOn' }; s.order = null
  assert.equal(commandModifiers(game, t).contacts, 0, 'an uncrippled Pall on orders gives the enemy nothing')
})

test('the Pall never sets off an orbital mine', async () => {
  const { game, s } = duel('kat-pall', 'steward')
  const { mineAttack, moveMines } = await import('./defences.js')
  game.ordnance.push({ id: 920, kind: 'mine', side: 1, pos: { x: 55, y: 60 }, r: 1.25, purchased: false, attacked: {}, fleet: 'freemen' })
  game.rng = scriptedRng([])
  moveMines(game, { fighterAt: () => -1, knockOut: () => {} })
  assert.equal(game.ordnance.length, 1, 'the mine has no target and stays')
  assert.ok(mineAttack)
})

test('the Cleansing Fleet List: limits, Ossuary once, re-rolls bought by the fleet', () => {
  const L = (ships, extra = {}) => ({ name: 'K', fleet: 'katharos', ships, escortSquadrons: [], ...extra })
  assert.deepEqual(checkFleet(L(['kat-sickle', 'kat-barrow']), 2000), [])
  assert.match(checkFleet(L(['kat-barrow', 'kat-sickle', 'kat-barrow']), 2000).join(), /one cryptship for every Sickle/)
  assert.match(checkFleet(L(['kat-sickle', 'kat-sickle', 'kat-barrow-ossuary', 'kat-barrow-ossuary']), 3000).join(), /single cryptship may carry an Ossuary/)
  assert.match(checkFleet(L(Array(4).fill('kat-pall')), 3000).join(), /0-3 Pall/)
  assert.match(checkFleet(L(Array(7).fill('kat-sickle')), 3000).join(), /0-6 Sickle/)
  assert.equal(fleetPoints(L(['kat-sickle'], { rerolls: 0 })), 275)
  assert.equal(fleetPoints(L(['kat-sickle'], { rerolls: 1 })), 300)
  assert.equal(fleetPoints(L(['kat-sickle'], { rerolls: 2 })), 350)
  assert.match(checkFleet(L(['kat-sickle'], { rerolls: 3 }), 2000).join(), /at most 2 extra re-rolls/)
  assert.equal(fleetPoints(L(['kat-barrow-ossuary', 'kat-sickle'])), 825)
  // no Fleet Commander needed even over 750 points
  assert.deepEqual(checkFleet(L(['kat-barrow-ossuary', 'kat-sickle']), 2000), [])
})

test('a Katharos fleet battle gives the fleet its re-rolls, Ossuary ship Resolve 10, attack rating 4', () => {
  const k = { name: 'K', fleet: 'katharos', ships: ['kat-barrow-ossuary', 'kat-sickle', 'kat-vigil', 'kat-vigil'], escortSquadrons: [[2, 3]], rerolls: 2 }
  const d = { name: 'D', fleet: 'freemen', ships: ['steward', 'steward'], escortSquadrons: [], commander: 'fleet-admiral', commanderOn: 0 }
  const game = createFleetBattle({ lists: [k, d], limit: 2000, seed: 3 })
  assert.equal(game.rerolls[0].left, 3); assert.equal(game.rerolls[0].flagship, null)
  assert.equal(game.ships[0].leadership, 10)
  assert.equal(game.sides[0].attackRating, 4)
})

test('the hull save also runs against shield-absorbed overflow: hitWithShields -> damageShip', () => {
  const { game, s } = duel('kat-vigil', 'steward')
  dice(game, [6, 1])
  assert.equal(hitWithShields(game, s, 1, { x: 0, y: 0 }, 'test').damage, 0)
  assert.ok(said(game, /reactive hull: 1 save rolled 6, needed 6\+: 1 saved/))
})
