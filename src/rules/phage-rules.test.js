// Tests for the Phage fleet's own rules (rules/phage.js, phageDamage.js). Fixed dice so the arithmetic shows.
// Run by `npm test` (node:test); exports nothing.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { scriptedRng } from './dice.js'
import { createGame, addShip, formSquadron, shieldsOf, turretsOf, shieldsLeft, giveOrder, weaponHalvings, isCrippled, leadershipOf } from './game.js'
import { shipById } from '../data/ships.js'
import { splitShipId, resolveShipId } from '../data/fleetLists.js'
import { hitAndRun, boardingAction, endPhase } from './endPhase.js'
import { fireShip } from './shooting.js'
import { launchCraft, launchTorpedoes, fleetCraftRoom, craftAttack, launchMines, baysOf, ordnanceTouchesShip, moveWave, ordnancePhase } from './ordnance.js'
import { mineAttack } from './defences.js'
import { baseColumn } from './shooting.js'
import { armourFrom } from './armour.js'
import { psychicScream, leadershipTest } from './game.js'
import { checkFleet, createFleetBattle, fleetPoints, placeFleetShip, nextToPlace } from './fleet.js'
import { damageShip, critical, catastrophic, hitWithShields } from './damage.js'
import { checkMove, moveShip, disengage } from './movement.js'
import { scent, instinct, beginInstinct, contactNow, contactAttack, phageScreened } from './phage.js'
import { blueprint } from '../view/blueprint.js'

const dice = (g, f) => { g.rng = scriptedRng([...f, ...Array(200).fill(1)]) }
const said = (g, re) => g.log.some(l => re.test(l.text))
function duel (a = 'pha-cruiser_py_fe_no_no', b = 'lantern', gap = 20, bf = 'freemen') {
  const g = createGame({ fleets: [{ name: 'P', fleet: 'phage' }, { name: 'I', fleet: bf }] })
  const s = addShip(g, 0, a), t = addShip(g, 1, b)
  s.leadership = 7; t.leadership = 8
  s.pos = { x: 40, y: 60 }; s.facing = 0; t.pos = { x: 40 + gap, y: 60 }; t.facing = 180
  g.round = 1; g.active = 0; g.first = 0; g.phase = 'shooting'
  return { g, s, t }
}

test('ship ids carry the loadout: port/starboard sets sort, a bare class is the first choices', () => {
  assert.equal(resolveShipId('phage', 'pha-hive', [0, 2, 1, 0, 3]), 'pha-hive_py_ba_ba_py_no')
  assert.deepEqual(splitShipId('phage', 'pha-hive_py_ba_bp_no_no'), { cls: 'pha-hive', picks: [0, 2, 2, 0, 0] })
  const p = shipById('pha-hive_fc_bp_py_bp_no')
  assert.equal(p.hits, 10); assert.equal(p.speed, 15); assert.equal(p.spores, 4); assert.equal(p.points, 200)
  assert.deepEqual(p.weapons.map(w => w.kind), ['feeder', 'claws', 'bioplasma', 'pyro', 'pyro', 'bioplasma', 'bioplasma'])
  assert.equal(shipById('pha-gulper').armour.front, 6); assert.equal(shipById('pha-vanguard').spores, 1)
  // a loadout is drawn: the matching sample's rib and core, with the weapons from the profile
  assert.ok(blueprint('pha-hive_py_ba_py_no_no', 'cage').mounts.length > 0)
})

test('mound fleet list: points of the slots, six drones per queen ship, two cruisers per queen ship', () => {
  const list = { fleet: 'phage', list: 'hive', ships: ['pha-hive_py_ba_py_no_no', 'pha-cruiser_py_cl_no_no', ...Array(6).fill('pha-drone_py')], escortSquadrons: [[2, 3, 4, 5, 6, 7]], commander: null }
  // 200 + 30 + 20 + 15; 80 + 20 + 5; 6 x (10 + 10)
  assert.equal(fleetPoints(list), 200 + 30 + 20 + 15 + 80 + 20 + 5 + 120)
  assert.deepEqual(checkFleet(list, 2000), [])
  assert.ok(checkFleet({ ...list, ships: list.ships.slice(0, 7), escortSquadrons: [[2, 3, 4, 5, 6]] }, 2000).some(w => /six picket drones/.test(w)))
  assert.ok(checkFleet({ ...list, ships: [...list.ships, 'pha-cruiser', 'pha-cruiser'] }, 2000).some(w => /two cruisers/.test(w)))
  assert.ok(checkFleet({ ...list, ships: [...list.ships.slice(0, 2), 'pha-drone_py'], escortSquadrons: [[2]] }, 2000).some(w => /six picket drones/.test(w)))
  assert.ok(checkFleet({ ...list, capitalSquadrons: [[0, 1]] }, 2000).some(w => /may not deploy in squadrons/.test(w)))
  // up to 10% of the drones may be fire ships
  assert.ok(checkFleet({ ...list, ships: [...list.ships.slice(0, 7), 'pha-drone_fs'] }, 2000).some(w => /fire ships/.test(w)))
  // Hunger Influence: one per queen ship; Imperatives one per two queen ships (one for a single queen ship)
  assert.ok(checkFleet({ ...list, upgrades: { 0: ['influence', 'imperative'] } }, 2000).every(w => !/Imperative|Influence/.test(w)))
  assert.ok(checkFleet({ ...list, upgrades: { 1: ['influence'] } }, 2000).length > 0)
  assert.equal(fleetPoints({ ...list, upgrades: { 0: ['influence', 'imperative'] } }) - fleetPoints(list), 70)
})

test('vanguard list: squadrons of six to twelve, no queen ships', () => {
  const six = Array(6).fill('pha-vanguard_py')
  const v = { fleet: 'phage', list: 'vanguard', ships: six, escortSquadrons: [[0, 1, 2, 3, 4, 5]], commander: null }
  assert.deepEqual(checkFleet(v, 1000), [])
  assert.ok(checkFleet({ ...v, escortSquadrons: [[0, 1, 2]], ships: six.slice(0, 3) }, 1000).some(w => /6 to 12/.test(w)))
  assert.ok(checkFleet({ ...v, ships: ['pha-hive', ...six] }, 1000).length)
})

test('spores are shields: absorb a hit, leave a Blast Marker, and are not halved when crippled', () => {
  const { g, s, t } = duel('pha-cruiser_py_fe_no_no', 'lantern', 20)
  assert.equal(shieldsOf(s), 2); assert.equal(turretsOf(s), 2)
  s.damage = 3; assert.ok(isCrippled(s)); assert.equal(shieldsOf(s), 2); assert.equal(turretsOf(s), 2)
  s.damage = 0
  const before = g.blast.length
  hitWithShields(g, s, 3, t.pos, 'test')
  assert.equal(g.blast.length, before + 2, 'a Blast Marker for each spore that absorbed a hit')
  assert.ok(said(g, /shields absorb/))
  s.crits.sporesGone = 1; assert.equal(shieldsOf(s), 0)
})

test('searbile hits on 4+ whatever the armour, ignores shields and leaves no Blast Marker', () => {
  const { g, s, t } = duel('pha-cruiser_py_cl_bp_no', 'pha-gulper_bp', 10, 'phage')
  const bi = s.profile.weapons.findIndex(w => w.kind === 'bioplasma' && w.loc === 'port')
  assert.ok(bi >= 0)
  t.side = 1; t.pos = { x: 40, y: 50 }; t.facing = 0   // off the port side
  t.state = 'active'; s.leadership = 7
  dice(g, [4, 3])
  const r = fireShip(g, s, [{ weapon: bi, target: t.uid }])
  assert.equal(r.ok, true)
  assert.ok(said(g, /searbile \(strength 2\)/)); assert.ok(!said(g, /shields absorb/))
})

test('burning acid: a critical hit also scores a Fire critical, which is a Phage ship\'s Heavy wound', () => {
  const { g, s, t } = duel('pha-cruiser_py_cl_no_no', 'lantern', 20)
  dice(g, [6, 6, 8].map(x => Math.min(6, x)))   // critical roll 6, then the extra Fire critical needs no roll
  damageShip(g, t, 1, { what: 'test', pyro: true })
  assert.ok(said(g, /additional Fire critical/))
  assert.ok(t.crits.fire >= 1)
})

test('Gulper: a 4+ save against every hit even when not braced', () => {
  const { g, s } = duel('pha-gulper_py', 'lantern', 20)
  dice(g, [5]); damageShip(g, s, 1, { what: 'test' })
  assert.equal(s.damage, 0); assert.ok(said(g, /1 saved/))
})

test('Phage criticals: own table, prow wounded needs prow weapons, else the next one up', () => {
  const { g, s } = duel('pha-cruiser_bt_fe_no_no', 'lantern', 20)
  critical(g, s, 5)   // prow wounded: it has a prow torpedo, so it applies
  assert.equal(s.crits.prow, 1)
  const k = addShip(g, 0, 'pha-cruiser_cl_fe_no_no')
  critical(g, k, 3)   // starboard: no starboard weapons, so port (4) no, prow (5) yes
  assert.equal(k.crits.prow, 1); assert.ok(said(g, /becomes the next one up/))
  critical(g, k, 2); assert.equal(k.crits.sporesHurt, 1); assert.equal(shieldsOf(k), 0)
  critical(g, k, 9); assert.equal(k.crits.scent, 1)
})

test('catastrophic damage: drifting carcass, death throes, biological eruption, searbile detonation', () => {
  let { g, s, t } = duel('pha-cruiser_py_cl_no_no', 'lantern', 10)
  dice(g, [3, 2]); catastrophic(g, s)
  assert.equal(s.state, 'drifting')
  ;({ g, s, t } = duel('pha-cruiser_py_cl_no_no', 'lantern', 10))
  dice(g, [4, 4]); catastrophic(g, s)
  assert.equal(s.state, 'blazing')
  ;({ g, s, t } = duel('pha-cruiser_py_cl_no_no', 'lantern', 10))
  dice(g, [5, 5, 1, 1, 1]); catastrophic(g, s)
  assert.equal(s.state, 'destroyed'); assert.ok(said(g, /Biological eruption: 3 Blast markers/))
  ;({ g, s, t } = duel('pha-cruiser_py_cl_no_no', 'lantern', 10))
  dice(g, [6, 6, 1, 1, 1, 4, 4, 4]); catastrophic(g, s)
  assert.ok(said(g, /Searbile detonation: 6 Blast markers/))
})

test('boarding: Phage count double and keep the best of two dice; no Blast Marker bonus for the target', () => {
  const { g, s, t } = duel('pha-cruiser_py_cl_no_no', 'lantern', 3)
  s.damage = 0
  dice(g, [2, 5, 3])
  boardingAction(g, s, t)
  assert.ok(said(g, /keeps the highest: 2, 5/))
  assert.ok(said(g, /boarding value 12 against/), 'six hits doubled')
})

test('Hit-and-Run: +1 for the Phage, lowest of two dice against them', () => {
  const { g, s, t } = duel('pha-cruiser_py_cl_no_no', 'lantern', 10)
  dice(g, [1]); assert.equal(hitAndRun(g, t, s), true, 'a natural 1 +1 = 2 still scores')   // (Phage attacker; target is not Phage)
  dice(g, [6, 2, 5]); hitAndRun(g, s, t)
  assert.ok(said(g, /two dice, 6 and 2, the lowest is taken/))
})

test('launch bays: fighters and assault boats only, twice the launch limit, none when crippled', () => {
  const { g, s } = duel('pha-hive_py_ba_py_no_no', 'lantern', 80)
  g.sides[0].fleet = 'phage'
  assert.equal(fleetCraftRoom(g, 0), 4)   // the thorax's 2 bays, doubled
  assert.equal(launchCraft(g, s, { fighter: 1 }).ok, true)
  s.loaded.bays = true; s.damage = 5
  assert.equal(launchCraft(g, s, { fighter: 1 }).ok, false)
  assert.ok(said(g, /crippled bio-ship may no longer launch/))
})

test('boarding torpedoes: always boarding, each tube launched separately', () => {
  const { g, s } = duel('pha-cruiser_bt_bt_no_no', 'lantern', 40)
  assert.equal(launchTorpedoes(g, s, 0, { weapon: 0 }).ok, true)
  assert.ok(g.ordnance.every(o => o.boarding))
  assert.equal(launchTorpedoes(g, s, 0, { weapon: 0 }).ok, false)
  assert.equal(launchTorpedoes(g, s, 0, { weapon: 1 }).ok, true)
  assert.equal(s.loaded.torpedo, false)
})

test('Brace For Impact tests on the nearest queen ship within 45 cm, or 7; other orders need synaptic control', () => {
  const g = createGame({ fleets: [{ name: 'P', fleet: 'phage' }, { name: 'I', fleet: 'freemen' }] })
  const hive = addShip(g, 0, 'pha-hive'), c = addShip(g, 0, 'pha-cruiser'), far = addShip(g, 0, 'pha-cruiser')
  hive.leadership = 8; c.leadership = 7; far.leadership = 7
  hive.pos = { x: 30, y: 60 }; c.pos = { x: 50, y: 60 }; far.pos = { x: 150, y: 60 }
  for (const x of [hive, c, far]) x.facing = 0
  g.round = 1; g.active = 0; g.first = 0; g.phase = 'movement'
  dice(g, [4, 4]); assert.equal(giveOrder(g, c, 'brace').ok, true); assert.ok(said(g, /needed 8 or less/))
  dice(g, [3, 3]); assert.equal(giveOrder(g, far, 'brace').ok, true); assert.ok(said(g, /needed 7 or less/))
  assert.equal(giveOrder(g, c, 'lockOn').ok, false)   // no synaptic control: instinct
})

test('synaptic control: a passed Command check gives control and orders without a second check; a fail ends that queen ship', () => {
  const g = createGame({ fleets: [{ name: 'P', fleet: 'phage' }, { name: 'I', fleet: 'freemen' }] })
  const hive = addShip(g, 0, 'pha-hive'), hive2 = addShip(g, 0, 'pha-hive'), c = addShip(g, 0, 'pha-cruiser'), e = addShip(g, 1, 'lantern')
  hive.leadership = 8; hive2.leadership = 8; c.leadership = 7; e.leadership = 8
  hive.pos = { x: 30, y: 60 }; hive2.pos = { x: 40, y: 80 }; c.pos = { x: 50, y: 60 }; e.pos = { x: 150, y: 60 }; e.facing = 180
  for (const x of [hive, hive2, c]) x.facing = 0
  g.round = 1; g.active = 0; g.first = 0; g.phase = 'movement'
  dice(g, [6, 6, 1, 1]); const a = scent(g, c.uid, hive.uid)
  assert.equal(a.pass, false); assert.equal(hive.scentFailedRound, 1)
  assert.equal(scent(g, c.uid, hive.uid).ok, false, 'that queen ship is finished for the turn')
  const b = scent(g, c.uid, hive2.uid)   // dice 1,1 pass
  assert.equal(b.pass, true)
  dice(g, [1]); assert.equal(giveOrder(g, c, 'lockOn').ok, true); assert.ok(said(g, /needs no second Command check/))
  // a ship with its scent severed cannot be overridden
  const d = addShip(g, 0, 'pha-cruiser'); d.pos = { x: 55, y: 70 }; d.facing = 0; d.crits.scent = 1
  assert.equal(scent(g, d.uid, hive2.uid).ok, false)
})

test('Lost Scent: the first condition true, top to bottom', () => {
  const { g, s, t } = duel('pha-cruiser_py_cl_no_no', 'lantern', 100)
  assert.equal(instinct(g, s).cond, 3)   // enemy ahead, over 90 cm: All Ahead Full
  t.pos = { x: 40 + 10, y: 60 }; assert.equal(instinct(g, s).cond, 2)
  t.pos = { x: 40 + 40, y: 60 }; assert.equal(instinct(g, s).cond, 7)   // nothing in reach: half speed straight ahead
  t.pos = { x: 40 - 40, y: 60 }; const e = addShip(g, 0, 'pha-drone_py'); e.pos = { x: 40, y: 60 }; e.facing = 0
  assert.equal(instinct(g, e).cond, 4)   // escort, enemy behind: Come to New Heading
  g.terrain = [{ kind: 'asteroids', shape: { t: 'circ', x: 40 + 15, y: 60, r: 5 } }]
  assert.equal(instinct(g, s).cond, 1)
})

test('instinct limits the move: half speed straight ahead when nothing else applies', () => {
  const { g, s, t } = duel('pha-cruiser_py_cl_no_no', 'lantern', 40)
  g.phase = 'movement'
  beginInstinct(g, s)
  assert.equal(s.instinct.cond, 7)
  assert.equal(checkMove(g, s, [{ fwd: 10 }]).ok, true)
  assert.equal(checkMove(g, s, [{ fwd: 15 }]).ok, false)
  assert.equal(checkMove(g, s, [{ fwd: 5 }, { turn: 45 }, { fwd: 5 }]).ok, false)
})

test('shooting: the nearest enemy unless a Vanguard highlights another, no test allowed', () => {
  const g = createGame({ fleets: [{ name: 'P', fleet: 'phage' }, { name: 'I', fleet: 'freemen' }] })
  const s = addShip(g, 0, 'pha-cruiser_py_cl_no_no'), near = addShip(g, 1, 'lantern'), far = addShip(g, 1, 'lantern'), v = addShip(g, 0, 'pha-vanguard_py')
  s.leadership = 7; near.leadership = far.leadership = 8
  s.pos = { x: 40, y: 60 }; s.facing = 0; near.pos = { x: 60, y: 60 }; far.pos = { x: 60, y: 70 }; v.pos = { x: 62, y: 110 }; v.facing = 0
  g.round = 1; g.active = 0; g.first = 0; g.phase = 'shooting'
  dice(g, [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1])
  fireShip(g, s, [{ weapon: 0, target: far.uid }])
  assert.ok(said(g, /must fire at the nearest enemy/))
  // the Vanguard within 15 cm of the far ship highlights it
  g.phase = 'shooting'; s.fired = false; g.log.length = 0
  far.pos = { x: 60, y: 75 }; v.pos = { x: 62, y: 80 }
  fireShip(g, s, [{ weapon: 0, target: far.uid }])
  assert.ok(!said(g, /must fire at the nearest enemy/))
})

test('picket drones touching a queen ship and between it and the firer give -1 Resolve to ignore closer targets', () => {
  const g = createGame({ fleets: [{ name: 'P', fleet: 'phage' }, { name: 'I', fleet: 'freemen' }] })
  const h = addShip(g, 0, 'pha-hive'), d = addShip(g, 0, 'pha-drone_py'), e = addShip(g, 1, 'lantern')
  h.pos = { x: 100, y: 60 }; d.pos = { x: 100 - 3.2, y: 60 }; e.pos = { x: 40, y: 60 }
  formSquadron(g, [d.uid], 'drones')
  assert.equal(phageScreened(g, e, h), true)
  d.pos = { x: 100, y: 70 }; assert.equal(phageScreened(g, e, h), false)
})

test('feeder tentacles: 1-3 that many Hit-and-Run attacks, 4-6 a point of damage and a raid', () => {
  const { g, s, t } = duel('pha-cruiser_py_fe_no_no', 'lantern', 3.2)
  g.phase = 'movement'
  dice(g, [2, 6, 6, 6, 6])
  contactAttack(g, s, t)
  assert.ok(said(g, /2 Hit-and-Run attacks/))
  s.contactUsed = null
  assert.equal(contactNow(g, s.uid, t.uid).ok, true)
  assert.ok(said(g, /a point of damage and a Hit-and-Run raid/) || said(g, /Hit-and-Run attacks/))
})

test('massive claws: two hits grab the prey; the grip halves shooting, stops a smaller ship and ends in a death', () => {
  const { g, s, t } = duel('pha-cruiser_cl_cl_no_no', 'lantern', 3.2)
  g.phase = 'movement'
  dice(g, [4, 4, 4, 4, 1, 1, 1, 1, 1, 1])
  contactAttack(g, s, t)
  assert.equal(s.grapple, t.uid); assert.equal(t.grappled, true)
  assert.ok(weaponHalvings(t) >= 1 && weaponHalvings(s) >= 1)
  // the Lantern (a cruiser) and the cruiser are the same class: neither can move
  assert.equal(checkMove(g, t, [{ fwd: 10 }]).ok, false)
  // a larger ship moves at half rate
  const bs = addShip(g, 1, 'sovereign'); bs.pos = { x: 40, y: 80 }; bs.facing = 0; bs.leadership = 8
  s.grapple = bs.uid; bs.grapple = s.uid; s.grappled = bs.grappled = true
  assert.equal(checkMove(g, bs, [{ fwd: 6 }]).ok, true)
  assert.equal(checkMove(g, bs, [{ fwd: 9 }]).ok, false)
  // a gripped ship cannot disengage
  s.state = 'destroyed'
  assert.equal(weaponHalvings(bs) >= 0, true)
})

test('Mucous Membrane and Accelerated Healing, Solar Vanes', () => {
  const { g, s } = duel('pha-cruiser_py_cl_no_no', 'lantern', 20)
  s.upgrades = ['solar', 'vents']
  assert.equal(checkMove(g, s, []).max, 25)
})

test('the Phage list builds a game: queen ship Resolve 8, 9 for +40, Hunger re-rolls and Imperatives', () => {
  const l = { name: 'P', fleet: 'phage', list: 'hive', ships: ['pha-hive_py_ba_py_no_no', ...Array(6).fill('pha-drone_py')], escortSquadrons: [[1, 2, 3, 4, 5, 6]], commander: null, upgrades: { 0: ['ld9', 'influence', 'imperative'] } }
  const i = { name: 'I', fleet: 'freemen', ships: ['lantern'], escortSquadrons: [], commander: null }
  const g = createFleetBattle({ lists: [l, i], limit: 3000, seed: 4 })
  assert.equal(leadershipOf(g.ships[0]), 9)
  assert.equal(g.rerolls[0].left, 1); assert.equal(g.imperatives[0].left, 1)
  assert.equal(g.ships[1].leadership, 7)
  // no Resolve roll for the drones
  assert.ok(!g.log.some(x => /Resolve roll/.test(x.text) && /Picket drone/.test(x.text)))
})

test('a Hunger Imperative passes the Command check, chosen before the dice', () => {
  const l = { name: 'P', fleet: 'phage', list: 'hive', ships: ['pha-hive_py_ba_py_no_no', ...Array(6).fill('pha-drone_py')], escortSquadrons: [[1, 2, 3, 4, 5, 6]], commander: null, upgrades: { 0: ['imperative'] } }
  const i = { name: 'I', fleet: 'freemen', ships: ['lantern'], escortSquadrons: [], commander: null }
  const g = createFleetBattle({ lists: [l, i], limit: 3000, seed: 4 })
  const hive = g.ships[0], d = g.ships[1]
  hive.pos = { x: 30, y: 60 }; d.pos = { x: 40, y: 60 }; g.round = 1; g.active = 0; g.phase = 'movement'
  g.decide.imperative = () => true
  dice(g, [6, 6])
  assert.equal(scent(g, d.uid, hive.uid).pass, true)
  assert.ok(said(g, /Hunger Imperative is used/))
  assert.equal(g.imperatives[0].left, 0)
})

test('All Is Lost: a boarded capital ship may self destruct on a passed Resolve Test', () => {
  const { g, s, t } = duel('pha-cruiser_py_cl_no_no', 'lantern', 3)
  g.decide.allIsLost = () => true
  t.boarding = null; s.boarding = t.uid; s.pos = { x: 40, y: 60 }
  g.phase = 'end'; g.active = 0
  dice(g, [1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1])
  endPhase(g)
  assert.ok(said(g, /destroys itself: rolled 2, plasma drive overload/))
  assert.equal(t.state, 'destroyed')
})

// ---------------- scenario branches ----------------
test('Cruiser Duel: a queen ship and three cruisers stand for four cruisers; the queen ship is Resolve 8 at most', async () => {
  const { checkForces, createCruiserClash } = await import('./cruiserClash.js')
  const ph = { name: 'P', fleet: 'phage', ships: ['pha-hive', 'pha-cruiser', 'pha-cruiser', 'pha-cruiser'] }
  const four = { name: 'I', fleet: 'freemen', ships: ['lantern', 'lantern', 'lantern', 'lantern'] }
  assert.equal(checkForces([ph, four]), null)
  assert.match(checkForces([{ ...ph, ships: ['pha-hive', 'pha-cruiser'] }, { ...four, ships: ['lantern', 'lantern'] }]), /one queen ship and three cruisers/)
  assert.match(checkForces([{ ...ph, ships: ['pha-hive', 'pha-hive', 'pha-cruiser', 'pha-cruiser'] }, four]), /one queen ship/)
  const g = createCruiserClash({ lists: [ph, four], seed: 2 })
  const hive = g.ships.find(s => s.profile.hive)
  assert.ok(hive.leadership <= 8); assert.equal(g.ships.find(s => s.id === 'pha-cruiser').leadership, 7, 'Brace For Impact defaults to 7')
})

test('Rising Engagement: the Phage player adds +1 to the arrival roll', async () => {
  const src = await import('node:fs').then(f => f.readFileSync(new URL('./scenarios.js', import.meta.url), 'utf8'))
  assert.match(src, /game\.sides\[side\]\.fleet === 'phage' \? 1 : 0/)
})

test('Worldbreak is never a Phage attack: Planetary Assault is played; no transports; an Assault Point per brood cyst', async () => {
  const { createScenario, landTroops } = await import('./scenarios.js')
  const { doneBuying } = await import('./defences.js')
  const { enterLowOrbit, LOW } = await import('./lowOrbit.js')
  const { nextPhase } = await import('./turn.js')
  const { startBattle } = await import('./turn.js')
  const ph = { name: 'P', fleet: 'phage', ships: ['pha-hive', 'pha-cruiser', ...Array(6).fill('pha-drone_py')], list: 'hive', escortSquadrons: [[2, 3, 4, 5, 6, 7]], capitalSquadrons: [], commander: null, tags: { 0: 'worldbreaker' } }
  const imp = { name: 'I', fleet: 'freemen', ships: ['lantern', 'rimward'], escortSquadrons: [], capitalSquadrons: [], commander: null, tags: { 0: 'standby', 1: 'standby' } }
  const g = createScenario({ id: 'worldbreak', lists: [imp, ph], attacker: 1, limit: 1000, seed: 5 })
  assert.equal(g.sc.id ?? g.scenario, 'assault'); assert.ok(g.log.some(l => /Phage never attack in a Worldbreak/.test(l.text)))
  assert.equal(g.ships.filter(s => s.profile.role === 'transport').length, 0, 'no transports')
  doneBuying(g)
  const c = g.ships.find(s => s.id === 'pha-cruiser')
  startBattle(g, 1)
  c.pos = { x: g.planet.shape.x - g.planet.shape.r - 3, y: g.planet.shape.y }
  assert.ok(enterLowOrbit(g, c, 60).ok)
  c.pos = { x: 60, y: LOW.y0 + LOW.h - 10 }
  nextPhase(g)
  const spores = c.profile.spores
  assert.ok(landTroops(g, c.uid).ok, g.log.slice(-2).map(l => l.text).join('|'))
  assert.equal(g.assaultPoints, spores)
})

test('Convoy: Phage cannot be the convoy', async () => {
  const { checkScenarioList } = await import('./scenarios.js')
  assert.ok(checkScenarioList('convoy', { name: 'P', fleet: 'phage', ships: ['pha-drone_py'], escortSquadrons: [] }, 'defender', 100, { transports: 4 }).some(x => /no convoys/.test(x)))
})

// ---------------- the six refits that had no test ----------------
test('Tenacity: All Ahead Full does not halve burning acid or searbile (nor do Burn Retros, Come to New Heading); Brace still halves', () => {
  const { s } = duel('pha-cruiser_py_cl_no_no', 'lantern', 20)
  for (const kind of ['aheadFull', 'burnRetros', 'newHeading']) {
    s.upgrades = []; s.order = { kind }
    assert.equal(weaponHalvings(s), 1, `${kind} halves without Tenacity`)
    s.upgrades = ['tenacity']
    assert.equal(weaponHalvings(s), 0, `${kind} does not halve with Tenacity`)
  }
  s.order = { kind: 'brace' }
  assert.equal(weaponHalvings(s), 1, 'Brace for Impact! is not on the list, so it still halves')
})

test('Drone Link: a Forerunner drone up to 15 cm away moves burning acid batteries one Gunnery column left', () => {
  const { g, s, t } = duel('pha-cruiser_py_cl_no_no', 'lantern', 20)
  s.upgrades = ['drone-link']
  const v = addShip(g, 0, 'pha-vanguard_py'); v.pos = { x: 40, y: 70 }; v.facing = 0
  t.moved = 10
  dice(g, [])
  fireShip(g, s, [{ weapon: 0, target: t.uid }])
  assert.equal(s.droneLinked, true, 'a Vanguard 10 cm away links it')
  assert.equal(baseColumn(t, 'closing', s), 0, 'closing is column 1, shifted left to 0')
  assert.equal(baseColumn(t, 'abeam', s), 2, 'abeam is column 3, shifted to 2')
  assert.equal(baseColumn(t, 'closing', { droneLinked: false }), 1)
  // out of range: no link
  v.pos = { x: 40, y: 80 }; s.fired = false; g.phase = 'shooting'
  fireShip(g, s, [{ weapon: 0, target: t.uid }])
  assert.equal(s.droneLinked, false, 'a Vanguard 20 cm away does not')
  // without the refit, never
  s.upgrades = []; v.pos = { x: 40, y: 70 }; s.fired = false; g.phase = 'shooting'
  fireShip(g, s, [{ weapon: 0, target: t.uid }])
  assert.equal(s.droneLinked, false)
})

test('Mind Scream: enemy ships within 15 cm are -2 Resolve, others are not', () => {
  const { g, s, t } = duel('pha-hive_py_ba_py_no_no', 'lantern', 10)
  t.leadership = 8
  s.upgrades = ['scream']
  assert.equal(psychicScream(g, t), 2)
  t.pos = { x: 40 + 20, y: 60 }
  assert.equal(psychicScream(g, t), 0, '20 cm away')
  t.pos = { x: 40 + 10, y: 60 }; s.upgrades = []
  assert.equal(psychicScream(g, t), 0, 'no refit')
  s.upgrades = ['scream']
  g.rng = scriptedRng([4, 3, ...Array(50).fill(1)])   // 7: passes Resolve 8, fails 8 - 2 = 6 (roll equal or under)
  const r = leadershipTest(g, t, { why: 'test' })
  assert.equal(r.pass, false, '7 fails once the Scream takes 2 off Resolve 8')
  assert.equal(r.need, 6)
  s.upgrades = []
  g.rng = scriptedRng([4, 3, ...Array(50).fill(1)])
  assert.equal(leadershipTest(g, t, { why: 'test' }).pass, true, 'the same roll passes without it')
})

test('Accelerated Healing: two extra repair dice after the Blast Marker halving, capital ships only', () => {
  const run = (ups, bm) => {
    const { g, s } = duel('pha-cruiser_py_cl_no_no', 'lantern', 60)
    s.upgrades = ups; s.hits = 3; s.crits.prow = 1
    if (bm) g.blast.push({ x: s.pos.x, y: s.pos.y })
    dice(g, [6, 6, 6, 6, 6, 6, 6, 6])
    endPhase(g)
    return g.log.find(l => /repairs: \d+ dice/.test(l.text))?.text
  }
  const plain = run([], false), healed = run(['healing'], false), halved = run(['healing'], true), halvedPlain = run([], true)
  const dicen = t => +/repairs: (\d+) dice/.exec(t)[1]
  assert.equal(dicen(healed), dicen(plain) + 2)
  assert.equal(dicen(halved), dicen(halvedPlain) + 2, 'added after halving, so the two are not themselves halved')
  assert.ok(dicen(halvedPlain) < dicen(plain))
})

test('Mucous Membrane: torpedoes need +1 to hit (at most 6+); bombers and assault boats -1 on their attack roll; guns unaffected', () => {
  const run = (ups) => {
    const { g, s, t } = duel('pha-cruiser_py_cl_no_no', 'lantern', 30)
    s.upgrades = ups; s.crits.sporesHurt = 1   // no brood cysts to shoot the salvo down
    g.phase = 'shooting'; g.active = 1
    assert.ok(launchTorpedoes(g, t, 180).ok)
    const o = g.ordnance[0]; o.str = 3; o.pos = { x: s.pos.x + 3, y: s.pos.y }
    const need = armourFrom(s, o.pos)
    dice(g, [need, need, need])
    ordnanceTouchesShip(g, o, s)
    return { need, text: g.log.map(l => l.text).join('\n') }
  }
  const a = run([]), b = run(['mucous'])
  assert.match(a.text, new RegExp(`needed ${a.need}\\+ against its armour: 3 hit`))
  assert.match(b.text, new RegExp(`needed ${Math.min(6, b.need + 1)}\\+ against its armour: 0 hit`))
  // never worse than 6+
  const { g, s, t } = duel('pha-cruiser_py_cl_no_no', 'lantern', 30)
  s.upgrades = ['mucous']; s.crits.sporesHurt = 1; g.phase = 'shooting'; g.active = 1
  launchTorpedoes(g, t, 180)
  const o = g.ordnance[0]; o.str = 1; o.pos = { x: s.pos.x + 3, y: s.pos.y }
  s.profile = { ...s.profile, armour: { front: 6, other: 6 } }
  dice(g, [6])
  ordnanceTouchesShip(g, o, s)
  assert.match(g.log.map(l => l.text).join('\n'), /needed 6\+ against its armour: 1 hit/)
})

test('Great Spore Mines: each launch bay launches one in the Ordnance Phase; hits become Fire criticals', () => {
  const { g, s, t } = duel('pha-hive_py_ba_py_no_no', 'lantern', 30)
  s.upgrades = ['mines']; s.mines = true
  assert.equal(launchCraft(g, s, { fighter: 1 }).ok, false, 'the bays carry mines, not craft')
  g.phase = 'movement'; s.movedThisPhase = true
  assert.equal(launchMines(g, s).ok, false, 'not in the Manoeuvre Phase')
  g.phase = 'ordnance'
  const r = launchMines(g, s)
  assert.ok(r.ok); assert.equal(r.launched, baysOf(s))
  const mines = g.ordnance.filter(o => o.kind === 'mine')
  assert.equal(mines.length, r.launched); assert.equal(mines[0].fleet, 'phage')
  assert.equal(launchMines(g, s).ok, false, 'bays empty until reloaded')
  // detonation: every hit through the armour is a Fire critical, not damage
  const m = mines[0]; m.pos = { x: t.pos.x - 3, y: t.pos.y }
  t.crits = t.crits ?? {}; const before = t.hits
  dice(g, [6, 6, 6, 6, 6, 6, 6, 6])
  mineAttack(g, m, t)
  assert.ok(said(g, /become Fire critical/))
  assert.equal(t.hits, before, 'no hits of damage from a great spore mine itself')
})

test('Planetary Assault: torpedo Strength and assault boat markers that reach the surface each score an Assault Point', () => {
  const planet = [{ id: 1, kind: 'planet', size: 'medium', shape: { t: 'circ', x: 55, y: 60, r: 8 } }]
  const { g, s } = duel('pha-hive_py_ba_py_no_no', 'lantern', 80)
  g.sides[0].fleet = 'phage'; g.sc = { id: 'assault' }; g.attacker = 0; g.assaultPoints = 0; g.terrain = planet
  assert.ok(launchCraft(g, s, { 'assault boat': 1 }).ok)   // launched in the Fire Phase
  const w = g.ordnance.find(o => o.kind === 'wave'), boats = w.markers.length
  g.phase = 'ordnance'
  moveWave(g, w.id, { x: 100, y: 60 })
  assert.equal(g.assaultPoints, boats, 'one per assault boat marker')
  assert.ok(said(g, /reach the surface: \d+ Assault Point/))
  // torpedoes: a point for each Strength point
  const t = duel('pha-cruiser_bt_bt_no_no', 'lantern', 80)
  Object.assign(t.g, { sc: { id: 'assault' }, attacker: 0, assaultPoints: 0, terrain: planet })
  assert.ok(launchTorpedoes(t.g, t.s, 0, { weapon: 0 }).ok)
  const o = t.g.ordnance[0], str = o.str
  t.g.phase = 'ordnance'; ordnancePhase(t.g)
  assert.equal(t.g.assaultPoints, str)
  assert.ok(said(t.g, /Phage torpedoes reach the surface/))
})

test('Planetary Assault: nothing scores outside the scenario or for the defender', () => {
  const { g, s } = duel('pha-hive_py_ba_py_no_no', 'lantern', 80)
  g.terrain = [{ id: 1, kind: 'planet', size: 'medium', shape: { t: 'circ', x: 55, y: 60, r: 8 } }]
  g.sides[0].fleet = 'phage'; g.assaultPoints = 0
  assert.ok(launchCraft(g, s, { 'assault boat': 1 }).ok)
  const w = g.ordnance.find(o => o.kind === 'wave'), n = w.markers.length
  g.phase = 'ordnance'
  moveWave(g, w.id, { x: 100, y: 60 })
  assert.equal(g.assaultPoints, 0); assert.equal(w.markers.length, n)
})
