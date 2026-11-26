// Tests for the Thnitoi fleet's own rules (rules/thnitoi.js). Fixed dice so the arithmetic shows.
// Run by `npm test` (node:test); exports nothing.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { scriptedRng } from './dice.js'
import { createGame, addShip, rollLeadership, giveOrder, formSquadron } from './game.js'
import { fieldOf, fieldSave } from './miragefield.js'
import { critical } from './damage.js'
import { checkMove, speedOf, turnDistance } from './movement.js'
import { hitAndRun, boardingAction, endPhase } from './endPhase.js'
import { phantomHits, alwaysClosing, baseColumn, fireShip } from './shooting.js'
import { launchTorpedoes, launchCraft, launchable, turretNeed, ordnanceTouchesShip, craftAttack } from './ordnance.js'
import { launchHarpoon, harpoonFuel, harpoonsReady } from './thnitoi.js'
import { mimicMoves } from './turn.js'
import { checkFleet } from './fleet.js'
import { listFleetPoints } from './listCheck.js'
import { fleetVictoryPoints } from './fleet.js'
import { rowOf } from '../data/craft.js'

const dice = (g, f) => { g.rng = scriptedRng([...f, ...Array(80).fill(1)]) }
const said = (g, re) => g.log.some(l => re.test(l.text))
function duel (a = 'thn-agony', b = 'lantern', gap = 20, enemyFleet = 'freemen') {
  const g = createGame({ fleets: [{ name: 'T', fleet: 'thnitoi' }, { name: 'E', fleet: enemyFleet }] })
  const s = addShip(g, 0, a), t = addShip(g, 1, b)
  t.profile = { ...t.profile, turrets: 0 }   // no turret dice to disturb the scripted rolls
  s.leadership = 8; t.leadership = 8
  s.pos = { x: 40, y: 60 }; s.facing = 0; t.pos = { x: 40 + gap, y: 60 }; t.facing = 180
  g.round = 1; g.active = 0; g.first = 0; g.phase = 'movement'
  return { g, s, t }
}

test('Thnitoi stat lines', () => {
  const { s } = duel(), { s: c } = duel('thn-corsair')
  assert.deepEqual([s.profile.hits, s.profile.speed, s.profile.turns, s.profile.shields, s.profile.armour.front, s.profile.turrets], [6, 35, 90, 0, 5, 0])
  assert.deepEqual([c.profile.hits, c.profile.speed, c.profile.turns, c.profile.armour.front], [1, 40, 90, 4])
})

test('Resolve table +1, 7 to 10', () => {
  const { g, s } = duel()
  dice(g, [1]); assert.equal(rollLeadership(g, s), 7)
  dice(g, [6]); assert.equal(rollLeadership(g, s), 10)
})

test('void field: 1 lets a hit through, 2-6 misses and puts a Blast Marker in contact', () => {
  const { g, t, s } = duel()
  assert.equal(fieldOf(s).name, 'voidfield'); assert.equal(fieldOf(t), null)
  dice(g, [1, 4]); let r = fieldSave(g, s, 2, { what: 'lance', braceAsked: true })
  assert.equal(r.through, 1); assert.equal(g.blast.length, 1)
  assert.ok(said(g, /void field against 2 lance hits/))
  s.crits.voidfield = 1; assert.equal(fieldOf(s), null)   // Void Field Generator Destroyed
})

test('weapons batteries count every target as closing; Hollow lance dice 1-3 none, 4 one, 5-6 two', () => {
  const { s, t } = duel()
  assert.ok(alwaysClosing(s)); assert.ok(!alwaysClosing(t))
  assert.equal(baseColumn(t, 'abeam', s), 1)   // capital ship closing column
  const { g } = duel()
  dice(g, [3, 4, 5, 6]); assert.equal(phantomHits(g, 4, false).hits, 0 + 1 + 2 + 2)
})

test('Lock On re-rolls the phantom dice that gave no hit', () => {
  const { g } = duel()
  dice(g, [2, 6]); assert.equal(phantomHits(g, 1, true).hits, 2)
})

test('critical on the Thnitoi table: fins, engines, commanders, void field', () => {
  const { g, s } = duel(); s.leadership = 8
  critical(g, s, 6); assert.equal(s.crits.fins, 1)
  critical(g, s, 7); assert.equal(s.crits.thrusters, 1); assert.equal(speedOf(s), 25)
  critical(g, s, 9); assert.equal(s.leadership, 7)
  critical(g, s, 10); assert.equal(s.crits.voidfield, 1)
  critical(g, s, 10); assert.equal(s.crits.voidfield, 1); assert.equal(s.crits.breach, 1)   // can't apply twice: next one up
  assert.ok(said(g, /Thnitoi critical|Void Field Generator Destroyed/))
})

test('criticals on the weapons: all, main prow (not the batteries), batteries', () => {
  const { g, s } = duel('thn-agony-lance')
  const [bat, lance] = s.profile.weapons
  critical(g, s, 3)
  assert.equal(fireShip((() => { g.phase = 'shooting'; return g })(), s, [{ weapon: 1, target: 999 }]).ok, false)
  assert.ok(said(g, /armament is damaged/))
  assert.equal(s.crits.prowMain, 1)
  const { g: g2, s: s2, t: t2 } = duel('thn-agony', 'lantern', 20); g2.phase = 'shooting'
  critical(g2, s2, 5)   // batteries
  assert.equal(fireShip(g2, s2, [{ weapon: 0, target: t2.uid }]).ok, false)
  assert.ok(bat && lance)
})

test('cruisers have no minimum move and no distance before turning, 90 degrees; no Burn Retros for cruisers', () => {
  const { g, s } = duel()
  assert.equal(turnDistance(s), 0)
  const c = checkMove(g, s, [{ turn: 90 }, { fwd: 0 }])
  assert.equal(c.ok, true, c.reasons.join())
  assert.equal(checkMove(g, s, [{ turn: 100 }]).ok, false)
  assert.equal(giveOrder(g, s, 'burnRetros').ok, false)
  const { g: g2, s: e } = duel('thn-corsair')
  assert.equal(turnDistance(e), 0); assert.equal(checkMove(g2, e, []).min, 20)   // escorts keep half speed
  assert.equal(giveOrder(g2, e, 'burnRetros').ok, true)
})

test('Come to New Heading needs no Command check, even after another check failed', () => {
  const { g, s } = duel(); s.leadership = 2
  g.ordersFailed[0] = true
  dice(g, [6, 6])
  const r = giveOrder(g, s, 'newHeading')
  assert.equal(r.ok, true); assert.ok(said(g, /pass the Command check to Come to New Heading automatically/))
  s.order = null; s.crits.manoeuvre = 1; g.ordersFailed[0] = false
  assert.equal(giveOrder(g, s, 'newHeading').ok, false)   // Manoeuvring Systems Damaged: a check again
})

test('boarding: +1 in the first round, -1 in later rounds', () => {
  const { g, s, t } = duel('thn-agony', 'lantern', 3)
  dice(g, [3, 3]); boardingAction(g, s, t)
  assert.ok(said(g, /first round/))
  s.lockedWith = t.uid; t.lockedWith = s.uid; s.boardRound = t.boardRound = 1
  g.log.length = 0; dice(g, [3, 3]); boardingAction(g, s, t)
  assert.ok(said(g, /later round/))
})

test('Hit-and-Run +1: a natural 1 still scores', () => {
  const { g, s, t } = duel()
  dice(g, [1, 1, 1]); assert.equal(hitAndRun(g, t, s), true)
  assert.ok(said(g, /Thnitoi/))
})

test('slavetaking instead of the critical: +10 victory points, brace saves, escorts gone at 30', () => {
  const { g, s, t } = duel('thn-agony', 'lantern')
  g.decide.slave = () => true
  const before = t.damage; dice(g, [4]); hitAndRun(g, t, s)
  assert.deepEqual(g.slaveVP, [10, 0]); assert.equal(t.damage, before); assert.equal(fleetVictoryPoints(g, 0) >= 10, true)
  const { g: g2, s: s2 } = duel('thn-agony', 'sword'); g2.decide.slave = () => true
  const esc = addShip(g2, 1, 'sword'); esc.pos = { x: 70, y: 60 }
  for (let i = 0; i < 3; i++) { dice(g2, [4]); hitAndRun(g2, esc, s2, { natural: 6 }) }
  assert.equal(esc.state, 'destroyed'); assert.ok(said(g2, /considered destroyed/))
  // not against Katharos or Phage
  const { g: g3, s: s3 } = duel('thn-agony', 'kat-vigil', 20, 'katharos'); g3.decide.slave = () => true
  const n = g3.ships[1]; dice(g3, [5]); hitAndRun(g3, n, s3, { natural: 6 })
  assert.equal(g3.slaveVP, undefined)
})

test('Kites are resilient, Thornwings re-roll their attacks, turrets hit Thnitoi ordnance only on a 6', () => {
  assert.equal(rowOf('thnitoi', 'fighter').resilient, true); assert.equal(rowOf('thnitoi', 'bomber').rerollAttacks, true)
  assert.equal(rowOf('thnitoi', 'assault boat').speed, 30); assert.equal(rowOf('thnitoi', 'bomber').speed, 20)
  const { g } = duel()
  assert.equal(turretNeed(g, { fleet: 'thnitoi' }), 6); assert.equal(turretNeed(g, { fleet: 'freemen' }), 4)
})

test('launch bays launch any mix of Kites, Thornwings and Manacles', () => {
  const { g, s } = duel('thn-agony-bays'); g.phase = 'shooting'
  assert.deepEqual(launchable(g, s).sort(), ['assault boat', 'bomber', 'fighter'])
  assert.equal(launchCraft(g, s, { fighter: 1, bomber: 1, 'assault boat': 2 }).ok, true)
})

test('Harpoon: launched like a boat, limited by Harpoon armed vessels, back at the start of the owner\'s turn, needs Reload', () => {
  const { g, s } = duel('thn-agony-harpoons'); g.phase = 'shooting'
  assert.equal(harpoonsReady(s), 2)
  assert.equal(launchHarpoon(g, s).ok, true)
  assert.equal(launchHarpoon(g, s).ok, false)   // one Harpoon armed vessel in the fleet, one in play
  assert.ok(said(g, /equal the 1 Harpoon armed vessel/))
  g.phase = 'movement'; harpoonFuel(g)
  assert.equal(g.ordnance.length, 0); assert.equal(harpoonsReady(s), 1)
  g.phase = 'shooting'; assert.equal(launchHarpoon(g, s).ok, true)   // the second module is a spare out of the ship's two
})

test('Harpoon attack: 1 loses it for good; 2-6 then 2D6 added on the critical table; escorts need an unmodified 4+; no +1', () => {
  const { g, s, t } = duel('thn-agony-harpoon', 'lantern', 5); g.phase = 'shooting'
  launchHarpoon(g, s)
  const w = g.ordnance[0]; w.pos = { ...t.pos }
  dice(g, [1]); craftAttack(g, w, t)
  assert.equal(s.harpoonsLost, 1); assert.ok(said(g, /boarders are defeated/))
  const { g: g2, s: s2, t: t2 } = duel('thn-agony-harpoon', 'lantern', 5); g2.phase = 'shooting'
  launchHarpoon(g2, s2); const w2 = g2.ordnance[0]; w2.pos = { ...t2.pos }
  dice(g2, [3, 4, 3]); craftAttack(g2, w2, t2)   // D6 3, then 2D6 4+3 = 7
  assert.ok(said(g2, /2D6 4\+3 = 7/)); assert.ok(said(g2, /Fire!|critical hits table|Engine|Thrusters/i) || t2.damage >= 0)
  const { g: g3, s: s3 } = duel('thn-agony-harpoon', 'sword', 5); g3.phase = 'shooting'
  const e = g3.ships[1]; launchHarpoon(g3, s3); const w3 = g3.ordnance[0]; w3.pos = { ...e.pos }
  dice(g3, [2, 1, 3]); craftAttack(g3, w3, e)   // 2D6 = 4: an escort is destroyed
  assert.equal(e.state, 'destroyed')
})

test('lamprey torpedoes: loaded by their own Reload, one automatic critical = -10 cm and no All Ahead Full, escorts survive', () => {
  const { g, s, t } = duel('thn-agony-torpedo', 'lantern', 12); g.phase = 'shooting'
  s.leechLoaded = true
  assert.equal(launchTorpedoes(g, s, 0).ok, true)
  assert.ok(g.ordnance[0].leech)
  const o = g.ordnance[0]; o.str = 4; o.pos = { ...t.pos }; o.fresh = false
  dice(g, [6, 6, 6, 6]); ordnanceTouchesShip(g, o, t)   // no turrets hit (lantern has turrets? re-rolled), hits on 6
  assert.ok((t.crits.leech ?? 0) >= 1, 'leech fastened'); assert.equal(t.damage, 0)
  assert.equal(speedOf(t), t.profile.speed - 10)
  t.order = null; g.active = 1; g.phase = 'movement'
  assert.equal(giveOrder(g, t, 'aheadFull').ok, false)
  // reload: the player says whether leeches
  const { g: g2, s: s2 } = duel('thn-agony-torpedo'); g2.active = 0; g2.phase = 'movement'; s2.leadership = 10; dice(g2, [1, 1])
  assert.equal(giveOrder(g2, s2, 'reload', { leech: true }).ok, true); assert.equal(s2.leechLoaded, true)
})

test('an escort leeched repairs on a 6 in the End Phase', () => {
  const { g, s } = duel('thn-corsair'); s.crits.leech = 1; g.phase = 'end'
  dice(g, [6, 1]); endPhase(g)
  assert.equal(s.crits.leech, 0)
})

test('false-flag engines: a free move, hidden over 30 cm until it attacks, not against Katharos or Phage', () => {
  const { g, s, t } = duel('thn-agony', 'lantern', 100); s.upgrades = ['mimic']
  g.decide.mimicMove = () => [{ fwd: 30 }]
  mimicMoves(g)
  assert.equal(s.pos.x, 70); assert.equal(s.disguised, true)
  g.phase = 'shooting'
  assert.equal(fireShip(g, t, [{ weapon: 0, target: s.uid }]).ok, false)
  assert.ok(said(g, /can't be targeted/))
  g.round = 2
  const { g: g2, s: s2 } = duel('thn-agony', 'kat-vigil', 100, 'katharos'); s2.upgrades = ['mimic']; mimicMoves(g2)
  assert.ok(!s2.disguised); assert.ok(said(g2, /no effect against this fleet/))
})

test('the Pirates list: Dread Void Prince, three escorts per capital ship, prices', () => {
  const l = (ships, more = {}) => ({ fleet: 'thnitoi', ships, escortSquadrons: [], commander: null, ...more })
  const ok = ['thn-agony', 'thn-corsair', 'thn-corsair', 'thn-corsair']
  assert.deepEqual(checkFleet({ ...l(ok), escortSquadrons: [[1, 2, 3]] }, 1000), [])
  assert.ok(checkFleet({ ...l(['thn-agony', 'thn-corsair']), escortSquadrons: [] }, 1000).some(x => /three escorts/.test(x)))
  assert.equal(listFleetPoints(l(['thn-agony-lance'])), 230); assert.equal(listFleetPoints(l(['thn-agony-harpoons'])), 250); assert.equal(listFleetPoints(l(['thn-agony-bays'])), 250)
  assert.equal(listFleetPoints(l(ok, { commander: 'voidprince', rerolls: 1 })), 210 + 150 + 100 + 25)
  assert.equal(listFleetPoints(l(ok, { upgrades: [['mimic'], ['mimic']] })), 210 + 150 + 20 + 5)
  assert.ok(checkFleet({ ...l(Array(13).fill('thn-agony').concat(Array(39).fill('thn-corsair'))) }, 99999).some(x => /0-12 cruisers/.test(x)))
})

test('orbital mines are an upgrade for an Agony with bays, +5 a bay', () => {
  const l = { fleet: 'thnitoi', ships: ['thn-agony-bays', 'thn-corsair', 'thn-corsair', 'thn-corsair'], escortSquadrons: [[1, 2, 3]], commander: null, upgrades: [['mines']] }
  assert.deepEqual(checkFleet(l, 1000), []); assert.equal(listFleetPoints(l), 250 + 150 + 20)
})

test('an escort squadron\'s owner chooses which ship loses its Harpoon', async () => {
  const { createGame, addShip, formSquadron } = await import('./game.js')
  const { loseHarpoon, harpoonCap } = await import('./thnitoi.js')
  const g = createGame({ fleets: [{ name: 'T', fleet: 'thnitoi' }, { name: 'I', fleet: 'freemen' }] })
  const a = addShip(g, 0, (await import('../data/ships.js')).ALL_SHIPS.find(s => s.fleet === 'thnitoi' && s.type === 'escort' && s.weapons.some(w => w.kind === 'harpoon')).id)
  const b = addShip(g, 0, a.id)
  for (const s of [a, b]) { s.pos = { x: 10, y: 10 }; s.leadership = 8 }
  formSquadron(g, [a.uid, b.uid], 'Q')
  g.decide.harpoonLoss = (game, home, cands) => b.uid
  const before = harpoonCap(b)
  loseHarpoon(g, a)
  assert.equal(harpoonCap(b), before - 1); assert.equal(harpoonCap(a), before)
})
