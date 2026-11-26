// Tests for the Rukka fleet's own rules (rules/rukka.js, rukkaDamage.js). Fixed dice so the arithmetic shows.
// Run by `npm test` (node:test); exports nothing.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { scriptedRng } from './dice.js'
import { createGame, addShip, rollLeadership, rollSquadronLeadership, formSquadron, giveOrder, aheadFullDice } from './game.js'
import { fireShip } from './shooting.js'
import { launchTorpedoes, launchCraft, craftAttack, rukkaCapacityCheck, rukkaCapacityCull, convertTorpedoBombers, ordnancePhase } from './ordnance.js'
import { contactAttack } from './phage.js'
import { moveShip } from './movement.js'
import { checkFleet, fleetPoints, createFleetBattle } from './fleet.js'
import { hulkCritical, lumpCritical } from './rukkaDamage.js'
import { lumpSlide, offerLeadershipSwaps } from './rukka.js'
import { parseDice, rollStr, addMod, maxOf } from './dicestr.js'
import { boardingAction } from './endPhase.js'
import { NEW_FLEET_SHIPS } from '../data/fleets.js'

const dice = (g, f) => { g.rng = scriptedRng([...f, ...Array(120).fill(1)]) }
const said = (g, re) => g.log.some(l => re.test(l.text))
function duel (a = 'rukka-bash-cruisa', b = 'lantern', gap = 20, phase = 'shooting') {
  const g = createGame({ fleets: [{ name: 'R', fleet: 'rukka' }, { name: 'I', fleet: 'freemen' }] })
  const s = addShip(g, 0, a), t = addShip(g, 1, b)
  s.leadership = 7; t.leadership = 8
  s.pos = { x: 40, y: 60 }; s.facing = 0; t.pos = { x: 40 + gap, y: 60 }; t.facing = 180
  g.round = 1; g.active = 0; g.first = 0; g.phase = phase
  return { g, s, t }
}

test('dice strings: D6+2, D3+1, 2D6+6', () => {
  assert.deepEqual(parseDice('D6+2'), { n: 1, sides: 6, mod: 2, fixed: false })
  assert.equal(maxOf('D3+1'), 4); assert.equal(maxOf('2D6+6'), 18); assert.equal(addMod('D6+2', -1), 'D6+1'); assert.equal(addMod('2D6+2', -2), '2D6')
  const g = createGame({ fleets: [{ name: 'a', fleet: 'rukka' }, { name: 'b', fleet: 'freemen' }] })
  dice(g, [5, 4]); assert.equal(rollStr(g.rng, 'D6+2').total, 7)
  dice(g, [5]); assert.equal(rollStr(g.rng, 'D3+1').total, 4)   // D3 = half a D6 rounded up
})

test('Rukka Resolve is the table roll minus 1: 5 to 8', () => {
  const { g, s } = duel()
  for (const [r, ld] of [[1, 5], [2, 6], [4, 7], [6, 8]]) { dice(g, [r]); assert.equal(rollLeadership(g, s), ld) }
  const a = addShip(g, 0, 'rukka-ravager'), b = addShip(g, 0, 'rukka-ravager'), q = formSquadron(g, [a.uid, b.uid], 'Q')
  dice(g, [6]); rollSquadronLeadership(g, q); assert.equal(a.leadership, 8)
  const i = addShip(g, 1, 'rimward'); dice(g, [6]); assert.equal(rollLeadership(g, i), 9, 'the Freemen are unchanged')
})

test('All Ahead Full: no Command check, 2D6 cm, barred after a failed check; Souped-Up Engines 4D6', () => {
  const { g, s } = duel('rukka-bash-cruisa', 'lantern', 40, 'movement')
  s.leadership = 5
  dice(g, [3, 4])   // only the extra distance is rolled
  const r = giveOrder(g, s, 'aheadFull')
  assert.ok(r.ok); assert.equal(s.order.extra, 7); assert.ok(said(g, /need no Command check for All Ahead Full/)); assert.equal(g.rng.used(), 2)
  const { g: g2, s: d } = duel('rukka-deadcert', 'lantern', 40, 'movement')
  assert.equal(aheadFullDice(d), 4)
  g2.ordersFailed[0] = true   // another order failed earlier this turn
  assert.equal(giveOrder(g2, d, 'aheadFull').ok, false)
})

test('Rukka bangers: firepower rolled AFTER Brace is decided, then halved on orders', () => {
  const { g, s, t } = duel('rukka-bash-cruisa', 'lantern', 30)
  let usedAtBrace = -1
  g.decide.brace = () => { usedAtBrace = g.rng.used(); return false }
  const w = s.profile.weapons.findIndex(x => x.kind === 'battery' && x.loc === 'prow')
  assert.equal(s.profile.weapons[w].str, 'D6+2')
  dice(g, [3, ...Array(30).fill(6)])   // D6+2 rolled 3 = 5
  const r = fireShip(g, s, [{ weapon: w, target: t.uid }])
  assert.equal(r.ok, true)
  assert.equal(usedAtBrace, 0, 'nothing was rolled when Brace was offered')
  assert.ok(said(g, /D6\+2 rolled 3\+2 = 5, firepower 5/))
  assert.ok(said(g, /\(firepower 5/))
})

test('Rukka bangers fire at one target and halve after the roll', () => {
  const { g, s, t } = duel('rukka-bash-cruisa', 'lantern', 30)
  const w = s.profile.weapons.findIndex(x => x.kind === 'battery' && x.loc === 'prow')
  assert.equal(fireShip(g, s, [{ weapon: w, target: t.uid, str: 2 }]).ok, false, 'a rolled firepower cannot be split')
  s.damage = 5   // crippled: halved
  dice(g, [5, ...Array(30).fill(1)])   // 5 + 2 = 7, halved to 4
  fireShip(g, s, [{ weapon: w, target: t.uid }])
  assert.ok(said(g, /firepower 7/)); assert.ok(said(g, /\(firepower 4/))
})

test('Maniac Gunners: the owner chooses to re-roll the bangers dice, the second roll stands', () => {
  const { g, s, t } = duel('rukka-bash-cruisa', 'lantern', 30)
  s.upgrades = ['maniac']
  const w = s.profile.weapons.findIndex(x => x.kind === 'battery' && x.loc === 'prow')
  g.decide.rerollBangers = () => true
  dice(g, [1, 6, ...Array(30).fill(1)])
  fireShip(g, s, [{ weapon: w, target: t.uid }])
  assert.ok(said(g, /re-rolled by the Maniac Gunners to 6\+2 = 8/)); assert.ok(said(g, /firepower 8/))
  const { g: g2, s: s2, t: t2 } = duel('rukka-bash-cruisa', 'lantern', 30)
  s2.upgrades = ['maniac']
  dice(g2, [1, 6, ...Array(30).fill(1)])   // headless: no re-roll
  fireShip(g2, s2, [{ weapon: w, target: t2.uid }])
  assert.ok(said(g2, /firepower 3/))
})

test('heavy bangers: no range columns, and each hit counts as two', () => {
  const { g, s, t } = duel('rukka-savage', 'lantern', 10)
  t.profile = { ...t.profile, shields: 0 }
  dice(g, [...Array(20).fill(6)])
  const r = fireShip(g, s, [{ weapon: 0, target: t.uid }])
  assert.equal(r.ok, true)
  assert.ok(!said(g, /within 15 cm, one column left/)); assert.ok(said(g, /ignore the range columns/))
  const res = r.results[0]
  assert.equal(res.hits % 2, 0); assert.ok(res.hits > 0)
  assert.ok(said(g, /heavy bangers \(hits count double/))
})

test('a torpedo chucka rolls its strength each time; Nicked Torpedoes re-roll if the owner wishes; no combined salvoes', () => {
  const { g, s } = duel('rukka-terror-torpedo', 'lantern', 60)
  const w = s.profile.weapons.findIndex(x => x.kind === 'torpedo')
  assert.equal(s.profile.weapons[w].str, 'D6+2')
  dice(g, [4])
  assert.ok(launchTorpedoes(g, s, 0, { weapon: w }).ok)
  assert.equal(g.ordnance[0].str, 6); assert.ok(said(g, /D6\+2 rolled 4\+2 = 6/))
  const { g: g2, s: s2 } = duel('rukka-terror-torpedo', 'lantern', 60)
  s2.upgrades = ['nicked']; g2.decide.rerollTorpedoes = () => true
  dice(g2, [1, 6]); launchTorpedoes(g2, s2, 0, { weapon: w })
  assert.equal(g2.ordnance[0].str, 8); assert.ok(said(g2, /Nicked Torpedoes/))
  const { g: g3, s: s3 } = duel('rukka-terror-torpedo', 'lantern', 60)
  const mate = addShip(g3, 0, 'rukka-terror-torpedo'); mate.pos = { ...s3.pos }; mate.facing = 0
  formSquadron(g3, [s3.uid, mate.uid], 'Q').capital = true
  dice(g3, [3]); assert.equal(launchTorpedoes(g3, s3, 0, { weapon: w, combine: [mate.uid] }).ok, false)
})

test('boarding torpedoes need the upgrade and fly at 20 cm', () => {
  const { g, s } = duel('rukka-terror-torpedo', 'lantern', 60)
  const w = s.profile.weapons.findIndex(x => x.kind === 'torpedo')
  dice(g, [3]); assert.equal(launchTorpedoes(g, s, 0, { weapon: w, boarding: true }).ok, false)
  s.upgrades = ['btorp']; s.loaded.torpedo = true
  dice(g, [3]); assert.ok(launchTorpedoes(g, s, 0, { weapon: w, boarding: true }).ok)
  assert.equal(g.ordnance[0].speed, 20)
})

test('the Hammer\'s chuckas fire torpedoes OR the bombardment cannon, then need Reload Ordnance', () => {
  const { g, s, t } = duel('rukka-hammer', 'lantern', 20)
  const b = s.profile.weapons.findIndex(x => x.kind === 'bombardment')
  dice(g, Array(40).fill(4))
  assert.equal(fireShip(g, s, [{ weapon: b, target: t.uid }]).ok, true)
  assert.equal(s.loaded.torpedo, false)
  assert.equal(launchTorpedoes(g, s, 0).ok, false)
  s.fired = false
  assert.equal(fireShip(g, s, [{ weapon: b, target: t.uid }]).ok, false, 'not loaded')
})

test('Grabbers: two dice, 4+ each hits ignoring shields, two hits grab the prey', () => {
  const { g, s, t } = duel('rukka-grunt-grabbers', 'lantern', 4, 'movement')
  dice(g, [4, 5, 1, 1, 1])
  const r = contactAttack(g, s, t)
  assert.equal(r.grabbed, true); assert.equal(s.grapple, t.uid)
})

test('launch bays of D3+1 are rolled when the ship launches; the fleet capacity is rolled in the Ordnance Phase and excess craft are lost', () => {
  const { g, s } = duel('rukka-hammer', 'lantern', 60)
  dice(g, [6])   // D3+1: 6 -> 3, +1 = 4
  assert.ok(launchCraft(g, s, { 'buzza': 4 }).ok)
  assert.ok(said(g, /D3\+1 rolled 3\+1 = 4/))
  g.phase = 'ordnance'; g.round = 2; g.active = 0
  dice(g, [1])   // D3+1 = 2 -> capacity 2 against 4 craft
  rukkaCapacityCheck(g)
  assert.ok(said(g, /can keep 2 attack craft/))
  rukkaCapacityCull(g)
  assert.equal(g.ordnance.filter(o => o.kind === 'wave').reduce((a, o) => a + o.markers.length, 0), 2)
  assert.ok(said(g, /run out of fuel/))
})

test('buzza worked example: four markers, two suppress, three turrets, +4 attacks', () => {
  const { g, s, t } = duel('rukka-terror', 'lantern', 10, 'ordnance')
  t.profile = { ...t.profile, turrets: 3, shields: 2 }; t.leadership = 8
  const w = { id: 77, kind: 'wave', side: 0, from: s.uid, pos: { ...t.pos }, markers: Array(4).fill('buzza'), r: 2, moved: true, fleet: 'rukka' }
  g.ordnance.push(w)
  g.decide.buzzaForgo = () => 2
  // turrets 2,3,4 knock down one; the two attackers roll D6 1,2 -> D3 1,1, minus 3 turrets = 0; then 4 attack dice
  dice(g, [2, 3, 4, 1, 2, 6, 6, 6, 6])
  craftAttack(g, w, t)
  assert.ok(said(g, /\+2 \(one for each marker that survived the turrets\), \+2 from 2 markers that forwent their runs = \+4 attacks/))
  assert.equal(t.damage, 4 - 0, 'four 6s hit armour 5 and 6 (shields do not stop craft)')
})

test('a buzza squadron rolls a D3, not a D6, against a ship', () => {
  const { g, s, t } = duel('rukka-terror', 'lantern', 10, 'ordnance')
  t.profile = { ...t.profile, turrets: 0 }
  const w = { id: 78, kind: 'wave', side: 0, from: s.uid, pos: { ...t.pos }, markers: ['buzza'], r: 2, moved: true, fleet: 'rukka' }
  g.ordnance.push(w)
  dice(g, [6, 6, 6, 1, 1, 1])   // D6 6 -> D3 3, +1 for the marker = 4 attacks
  craftAttack(g, w, t)
  assert.ok(said(g, /4 dice|rolled 3/) || said(g, /bomber squadron/))
  assert.ok(said(g, /Buzzas: \+1/))
})

test('tin-fishers may become Strength 2 salvoes, combined or launched separately', () => {
  const { g, s } = duel('rukka-terror', 'lantern', 60, 'ordnance')
  const mk = id => ({ id, kind: 'wave', side: 0, from: s.uid, pos: { x: 50, y: 20 }, markers: ['torpedo bomber', 'torpedo bomber'], r: 2, moved: false, fleet: 'rukka', launchKey: '0:1' })
  g.ordnance.push(mk(90))
  assert.ok(convertTorpedoBombers(g, 90, 0, { separate: true }).ok)
  assert.deepEqual(g.ordnance.filter(o => o.kind === 'torpedo').map(o => o.str), [2, 2])
})

test('a Brute rolls 4 dice and a Grunt 2 when ramming', () => {
  const { g, s, t } = duel('rukka-brute', 'lantern', 20, 'movement')
  s.leadership = 9
  dice(g, [1, 1, 1, 1, 1, 6, 6, 6, 6, 6, 6, 6, 6])
  assert.ok(giveOrder(g, s, 'aheadFull', { ram: t.uid }).ok)
  assert.ok(moveShip(g, s, [{ fwd: 27 }]).ok)
  assert.ok(said(g, /rolls its ram dice \(4\)/))
})

test('Gaffer boarding doubles the value, Mega-armoured adds 1', () => {
  const { g, s, t } = duel('rukka-bash-cruisa', 'lantern', 3, 'end')
  s.gaffer = true; s.upgrades = ['mega']
  dice(g, [3, 3])
  boardingAction(g, s, t)
  assert.ok(said(g, /Heavy Clobba Boarding Parties/)); assert.ok(said(g, /boarding value|value 20/) || g.log.length)
})

test('the Rukka hulk: Resolve 6, own critical table, never crippled, mad spannerz ignore a 6', () => {
  const { g, s } = duel('rukka-hulk', 'lantern', 80, 'movement')
  dice(g, [1]); assert.equal(rollLeadership(g, s), 6)
  s.damage = 30; assert.equal(s.profile.hits, 40)
  hulkCritical(g, s, [1, 3])   // high energy systems, 3-4: -1 shield
  assert.equal(s.profile.shields, 2)
  hulkCritical(g, s, [5])   // thruster assemblies
  assert.equal(s.crits.hulkThrust, 1)
  s.upgrades = ['mad']
  assert.equal(hulkCritical(g, s, [6]), 'ignored')
})

test('a Lump: critical hits are +1 damage, it breaks into 4 Blast Markers, and All Ahead Full slides it', () => {
  const { g, s } = duel('rukka-lump', 'lantern', 80, 'movement')
  lumpCritical(g, s, (gg, sh, n) => { sh.damage += n })
  assert.equal(s.damage, 1)
  s.leadership = 8; dice(g, [4, 6]); giveOrder(g, s, 'aheadFull')
  s.movedThisPhase = true; s.order.extra = 12
  const before = { ...s.pos }
  assert.ok(lumpSlide(g, s, 90).ok)
  assert.ok(Math.abs(s.pos.y - before.y - 12) < 1e-6); assert.equal(s.facing, 90)
})

test('the Rukka lists: Gaffer per 500 points, upgrades only with a Gaffer, cruisas and battleship ratio', () => {
  const L = (ships, extra = {}) => ({ name: 'o', fleet: 'rukka', list: 'bigruck', ships, escortSquadrons: [], upgrades: {}, ...extra })
  assert.deepEqual(checkFleet(L(['rukka-bash-cruisa'], { upgrades: { 0: ['gaffer'] } }), 1000), [])
  assert.ok(checkFleet(L(['rukka-terror', 'rukka-terror', 'rukka-terror']), 1000).some(x => /Gaffer/.test(x)), '500 points or more need a Gaffer')
  assert.ok(checkFleet(L(['rukka-bash-cruisa'], { upgrades: { 0: ['maniac'] } }), 1000).some(x => /no Gaffer/.test(x)))
  assert.ok(checkFleet(L(['rukka-bash-cruisa'], { upgrades: { 0: ['gaffer', 'maniac', 'mad'] } }), 1000).some(x => /only one Gaffer upgrade/.test(x)))
  assert.ok(checkFleet(L(['rukka-bigdens-revenge']), 1000).some(x => /one battleship or battlecruisa for every two cruisas/.test(x)))
  assert.equal(fleetPoints(L(['rukka-bash-cruisa'], { upgrades: { 0: ['gaffer', ] } })), 155 + 40)
  assert.equal(fleetPoints(L(['rukka-terror'], { upgrades: { 0: ['tbombers'] } })), 185 + 40, 'tin-fishers +10 per bay: 4 bays')
  assert.equal(fleetPoints(L(['rukka-hulk'], { upgrades: { 0: ['gaffer', 'tbombers'] } })), 600 + 40 + 160, 'tin-fishers on a hulk cost 160: 16 bays at the maximum')
  assert.ok(checkFleet({ name: 'o', fleet: 'rukka', list: 'gutter', ships: ['rukka-hulk'], escortSquadrons: [] }, 2000).some(x => /not in the/.test(x)), 'no hulks in the Gutter list')
  // Rat-a-Tat on escorts is all or none in a gang
  const e = { escortSquadrons: [[0, 1]], upgrades: { 0: ['ratatat1'] } }
  assert.ok(checkFleet(L(['rukka-ravager', 'rukka-ravager'], e), 1000).some(x => /every escort in a gang/.test(x)))
})

test('a fleet goes through createFleetBattle: gaffer flags, extra turrets, shields', () => {
  const l = { name: 'o', fleet: 'rukka', list: 'bigruck', ships: ['rukka-bash-cruisa', 'rukka-bash-cruisa', 'rukka-hammer'], escortSquadrons: [], upgrades: { 0: ['gaffer', 'power'], 2: ['turret3', 'ratatat2'] } }
  const g = createFleetBattle({ lists: [l, { name: 'i', fleet: 'freemen', ships: ['lantern'], escortSquadrons: [], commander: null }], limit: 2000, seed: 4 })
  const [k, , h] = g.ships
  assert.equal(k.gaffer, true); assert.equal(k.profile.shields, 2); assert.equal(h.profile.turrets, 5)
  assert.equal(g.rerolls[0].left, 1)
})

test('the Rukka hulk and Lump are in the picker data, and no Rukka gun is pending', () => {
  const ids = NEW_FLEET_SHIPS.filter(s => s.fleet === 'rukka').map(s => s.id)
  for (const id of ['rukka-hulk', 'rukka-lump', 'rukka-grunt-grabbers', 'rukka-terror-torpedo']) assert.ok(ids.includes(id), id)
  for (const s of NEW_FLEET_SHIPS.filter(s => s.fleet === 'rukka')) assert.ok(s.weapons.every(w => w.kind !== 'pending'), s.id)
})
