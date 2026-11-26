// Tests for the Concord fleet's own rules. Fixed dice so the arithmetic shows.
// Run by `npm test` (node:test); exports nothing.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { scriptedRng } from './dice.js'
import { createGame, addShip, rollLeadership, rollSquadronLeadership, formSquadron } from './game.js'
import { hitAndRun, boardingAction, endPhase } from './endPhase.js'
import { fireShip } from './shooting.js'
import { launchCraft, launchable, moveWave, craftAttack, launchTorpedoes, ordnancePhase } from './ordnance.js'
import { checkFleet, createFleetBattle, fleetPoints } from './fleet.js'
import { listFleetPoints } from './listCheck.js'

const dice = (g, f) => { g.rng = scriptedRng([...f, ...Array(80).fill(1)]) }
const said = (g, re) => g.log.some(l => re.test(l.text))
function duel (a = 'con-lance-cruiser', b = 'lantern', gap = 20) {
  const g = createGame({ fleets: [{ name: 'C', fleet: 'concord' }, { name: 'I', fleet: 'freemen' }] })
  const s = addShip(g, 0, a), t = addShip(g, 1, b)
  s.leadership = 9; t.leadership = 8
  s.pos = { x: 40, y: 60 }; s.facing = 0; t.pos = { x: 40 + gap, y: 60 }; t.facing = 180
  g.round = 1; g.active = 0; g.first = 0; g.phase = 'shooting'
  return { g, s, t }
}

test('Concord Resolve table: 1-2 Ld 8, 3-4 Ld 9, 5-6 Ld 10', () => {
  const { g, s } = duel()
  for (const [r, ld] of [[1, 8], [2, 8], [3, 9], [4, 9], [5, 10], [6, 10]]) { dice(g, [r]); assert.equal(rollLeadership(g, s), ld) }
  const e1 = addShip(g, 0, 'con-dirk'), e2 = addShip(g, 0, 'con-dirk')
  const q = formSquadron(g, [e1.uid, e2.uid], 'Q'); dice(g, [6]); rollSquadronLeadership(g, q); assert.equal(e1.leadership, 10)
  // the Freemen are unchanged
  const i = addShip(g, 1, 'rimward'); dice(g, [6]); assert.equal(rollLeadership(g, i), 9)
})

test('Concord add +2 in a boarding action, attacking or defending', () => {
  const { g, s, t } = duel()
  dice(g, [3, 3]); boardingAction(g, s, t)
  assert.ok(said(g, /\+2 \(Concord\)/))
})

test('Hit-and-Run: Concord +1 so a natural 1 still scores, 2 to 7', () => {
  const { g, s, t } = duel()
  dice(g, [1]); assert.equal(hitAndRun(g, t, s), true)
  assert.ok(said(g, /1 \+1 \(Concord\) = 2/))
  dice(g, [1]); assert.equal(hitAndRun(g, t, { name: 'Freeman', fleet: 'freemen' }), false, 'others fail on a 1')
  // an escort needs 4+ normally, 3+ for Concord
  const e = addShip(g, 1, 'sword'); e.leadership = 8; e.pos = { x: 70, y: 60 }
  dice(g, [2]); assert.equal(hitAndRun(g, e, s), false)
  dice(g, [3]); assert.equal(hitAndRun(g, e, s), true)
})

test('Hit-and-Run against a Concord ship deducts 1: 3+ against capital ships, 5+ against escorts', () => {
  const { g, s, t } = duel('con-battle-barge')
  const by = { name: 'Freeman', fleet: 'freemen' }
  dice(g, [2]); assert.equal(hitAndRun(g, s, by), false)
  dice(g, [3]); assert.equal(hitAndRun(g, s, by), true)
  const e = addShip(g, 0, 'con-dirk'); e.leadership = 9; e.pos = { x: 10, y: 10 }
  dice(g, [4]); assert.equal(hitAndRun(g, e, by), false)
  dice(g, [5]); assert.equal(hitAndRun(g, e, by), true)
})

test('a bombardment cannon hits on 4+ whatever the armour and scores criticals on 4+', () => {
  const { g, s, t } = duel('con-lance-cruiser', 'lantern', 20)
  t.profile = { ...t.profile, shields: 0 }
  const w = s.profile.weapons.findIndex(x => x.kind === 'bombardment')
  assert.ok(w >= 0)
  const f = [...Array(40).fill(4)]; dice(g, f)
  const r = fireShip(g, s, [{ weapon: w, target: t.uid }])
  assert.equal(r.ok, true)
  assert.ok(r.results[0].hits > 0, 'a 4 hits armour 6 and 5')
  assert.ok(said(g, /bombardment cannon \(firepower/))
  assert.ok(said(g, /bombardment cannon/), 'a 4 is a critical')
  // a weapons battery on 4s misses armour 5+
  const { g: g2, s: s2, t: t2 } = duel('con-lance-cruiser', 'lantern', 20)
  t2.pos = { x: 40, y: 80 }; dice(g2, f); const b = s2.profile.weapons.findIndex(x => x.kind === 'battery' && x.arc.includes('right'))
  const r2 = fireShip(g2, s2, [{ weapon: b, target: t2.uid }]); assert.equal(r2.results[0].hits, 0)
})

test('a bombardment cannon removes ordnance on 4+, not 6 ( "even vs ordnance")', () => {
  const { g, s } = duel('con-battle-barge')
  g.ordnance.push({ id: g.nextId++, kind: 'torpedo', side: 1, str: 3, speed: 30, pos: { x: 60, y: 60 }, facing: 180, r: 1.25, fresh: false, attacked: {}, fleet: 'freemen' })
  const w = s.profile.weapons.findIndex(x => x.kind === 'bombardment')
  dice(g, [4, 4, 4, 4, 4, 4]); fireShip(g, s, [{ weapon: w, target: { ordnance: g.ordnance[0].id } }])
  assert.equal(g.ordnance.length, 0)
})

test('launch bays carry Dropwings; Annihilators only when the Crusade list gives the flag', () => {
  const { g, s } = duel()
  assert.deepEqual(launchable(g, s), ['dropwing'])
  s.annihilators = true
  assert.deepEqual(launchable(g, s), ['dropwing', 'dropwing breaker'])
  assert.equal(launchCraft(g, s, { dropwing: 2 }).ok, true)
  assert.equal(g.ordnance[0].markers.join(), 'dropwing,dropwing')
  // the Ordnance wave moves at the slowest, 20 cm
})

function meet (mine, theirs, shipAt) {
  const { g, s, t } = duel()
  g.phase = 'ordnance'
  const mk = (side, markers, x, fleet) => g.ordnance.push({ id: g.nextId++, kind: 'wave', side, from: null, pos: { x, y: 60 }, markers, r: 1.1 * Math.sqrt(markers.length), moved: false, fleet })
  mk(0, mine, 40, 'concord'); mk(1, theirs, 50, 'freemen')
  if (shipAt) t.pos = { x: shipAt, y: 60 }
  return { g, s, t }
}

test('a Dropwing that meets an enemy fighter removes it and saves on 4+, then stops', () => {
  const { g } = meet(['dropwing'], ['fighter'])
  dice(g, [4]); moveWave(g, g.ordnance[0].id, { x: 60, y: 60 })
  assert.equal(g.ordnance.length, 1); assert.equal(g.ordnance[0].side, 0); assert.ok(g.ordnance[0].moved)
  const m = meet(['dropwing'], ['fighter']); dice(m.g, [3]); moveWave(m.g, m.g.ordnance[0].id, { x: 60, y: 60 })
  assert.equal(m.g.ordnance.length, 0)
})

test('a Dropwing that saves against the ship\'s CAP fighters is in base contact, so it still attacks as an assault boat, +1 to Hit-and-Run', () => {
  const { g, s, t } = duel(); g.phase = 'ordnance'
  const mk = (side, markers, pos, fleet, extra = {}) => g.ordnance.push({ id: g.nextId++, kind: 'wave', side, from: null, pos: { ...pos }, markers, r: 1.1 * Math.sqrt(markers.length), moved: false, fleet, ...extra })
  mk(1, ['fighter'], t.pos, 'freemen', { cap: t.uid }); mk(0, ['dropwing', 'dropwing'], s.pos, 'concord')
  const tur = t.profile.turrets
  dice(g, [4, ...Array(tur).fill(1), 6, ...Array(tur).fill(1), 6])
  moveWave(g, g.ordnance.find(o => o.side === 0 && !o.spentKey).id, t.pos)
  assert.equal(g.log.filter(l => /6 \+1 \(Concord\) = 7/.test(l.text)).length, 2, 'the Dropwing that stayed and the one that went in')
  assert.equal(g.ordnance.filter(o => o.side === 0).length, 0)
})

function annihilate (n, { forgo = 0, turretRolls }) {
  const { g, t } = duel('con-lance-cruiser', 'lantern')
  g.phase = 'ordnance'; g.decide.annihilatorForgo = () => forgo
  const w = { id: g.nextId++, kind: 'wave', side: 0, from: null, pos: { ...t.pos }, markers: Array(n).fill('dropwing breaker'), r: 2, moved: true, fleet: 'concord' }
  g.ordnance.push(w)
  return { g, t, w, run: faces => { dice(g, faces); craftAttack(g, w, t) } }
}
test('Annihilators: each survivor makes D6 minus turrets attacks and gets +1', () => {
  const a = annihilate(3, {}), tur = a.t.profile.turrets
  a.run([...Array(tur).fill(1), 4, 3, 6])
  const sum = [4, 3, 6].reduce((x, r) => x + Math.max(0, r - tur), 0) + 3
  assert.ok(said(a.g, new RegExp(`= ${sum} attacks`)), a.g.log.map(l => l.text).join('\n'))
})
test('Annihilators that forgo their runs add +1 each, up to the turrets and the surviving attackers', () => {
  const a = annihilate(3, { forgo: 1 }), tur = a.t.profile.turrets
  a.run([...Array(tur).fill(1), 4, 3])
  const sum = [4, 3].reduce((x, r) => x + Math.max(0, r - tur), 0) + 2 + Math.min(1, tur, 2)
  assert.ok(said(a.g, new RegExp(`= ${sum} attacks`)))
  assert.ok(said(a.g, /forwent their runs/))
})

test('boarding torpedoes: only fleets that have them, Hit-and-Run instead of damage, +1, friends ignored', () => {
  const { g, s, t } = duel('con-battle-barge', 'lantern', 25)
  const friend = addShip(g, 0, 'con-dirk'); friend.leadership = 9; friend.pos = { x: 52, y: 60 }; friend.facing = 0
  assert.equal(launchTorpedoes(g, s, 0, { boarding: true }).ok, true)
  assert.equal(g.ordnance[0].boarding, true)
  g.phase = 'ordnance'
  const tur = t.profile.turrets
  dice(g, [...Array(tur).fill(1), 6, 6, 6, 1, 1, 1, 6, 6, 6])
  ordnancePhase(g)
  assert.ok(!said(g, /hits .*Dirk/), 'a friendly ship is not attacked')
  assert.ok(said(g, /Hit-and-Run on .* by a boarding torpedo/))
  assert.equal(t.damage, 0, 'a hit makes a Hit-and-Run attack, not a point of damage')
  const o = duel(); assert.equal(launchTorpedoes(o.g, addShip(o.g, 1, 'rimward'), 0, { boarding: true }).ok, false)
})
test('a boarding torpedo may turn 45 degrees at the start of each Ordnance Phase after the one it was launched in', () => {
  const { g, s } = duel('con-battle-barge', 'lantern', 100)
  launchTorpedoes(g, s, 0, { boarding: true }); g.phase = 'ordnance'
  let asked = 0; g.decide.steerTorpedo = () => { asked++; return 45 }
  dice(g, []); ordnancePhase(g)
  assert.equal(asked, 0, 'not in the phase it was launched')
  ordnancePhase(g)
  assert.equal(asked, 1); assert.equal(g.ordnance[0].facing, 45)
})

test('Deepflesh Dyads and a Prime Guard are extra teleport attacks, two dice', () => {
  const { g, s, t } = duel('con-lance-cruiser', 'sword', 8)
  t.leadership = 8; t.crits.shields = 1
  g.active = 0; g.phase = 'end'
  s.upgrades = ['deepflesh', 'honour']
  g.decide.honourDie = (_g, _s, d) => 1
  dice(g, [5, 6])
  endPhase(g, { teleports: [[s.uid, t.uid, 'deepflesh']] })
  assert.ok(said(g, /Deepflesh boarding party teleports across: two dice rolled 5 and 6/))
  const { g: h, s: hs, t: ht } = duel('con-lance-cruiser', 'sword', 8)
  ht.crits.shields = 1; h.phase = 'end'; hs.upgrades = ['honour']; h.decide.honourDie = () => 1
  dice(h, [2, 6]); endPhase(h, { teleports: [[hs.uid, ht.uid, 'honour']] })
  assert.ok(said(h, /uses the second/))
  const { g: n, s: ns, t: nt } = duel('con-lance-cruiser', 'sword', 8)
  nt.crits.shields = 1; n.phase = 'end'
  dice(n, []); endPhase(n, { teleports: [[ns.uid, nt.uid, 'honour']] })
  assert.ok(said(n, /no Prime Guard/))
})

// ---------------- the lists ----------------
const L = (extra) => ({ name: 'C', fleet: 'concord', list: 'doctrine', escortSquadrons: [], capitalSquadrons: [], commander: null, ...extra })
test('Doctrine list: host barges one per 1,000 points or part, the Master on a barge, Deepflesh Dyads on the Master', () => {
  assert.deepEqual(checkFleet(L({ ships: ['con-battle-barge'] }), 1000), [])
  assert.ok(checkFleet(L({ ships: ['con-battle-barge', 'con-battle-barge'], commander: 'master' }), 2000).some(w => /host barges/.test(w)), '850 points allows one')
  const ok = L({ ships: ['con-lance-cruiser', 'con-battle-barge', 'con-lance-cruiser', 'con-lance-cruiser', 'con-lance-cruiser', 'con-lance-cruiser', 'con-lance-cruiser'], commander: 'master', commanderOn: 1, upgrades: { 1: ['deepflesh'] } })
  assert.deepEqual(checkFleet(ok, 2000), [])
  assert.ok(checkFleet({ ...ok, commanderOn: 0 }, 2000).some(w => /Fleet Prime goes on a host barge/.test(w)))
  assert.ok(checkFleet({ ...ok, upgrades: { 0: ['deepflesh'] } }, 2000).some(w => /Deepflesh boarding party goes on the Fleet Prime/.test(w)))
  assert.equal(fleetPoints(ok), 425 + 145 * 6 + 50 + 50)
  assert.ok(checkFleet(L({ ships: ['con-lance-cruiser'], commander: null }), 2000).length === 0)
  assert.ok(checkFleet(L({ ships: ['con-battle-barge', 'con-lance-cruiser', 'con-lance-cruiser', 'con-lance-cruiser'] }), 2000).some(w => /fleet commander/.test(w)), 'over 750 needs the Master')
})
test('Lance cruiser variants: prices, and as many basic as all the variants combined', () => {
  const l = L({ ships: ['con-lance-cruiser', 'con-lance-cruiser'], picks: [[0, 1], [1, 0]], upgrades: { 0: ['shield'] } })
  assert.equal(fleetPoints(l), 145 * 2 + 20 + 15)
  assert.ok(checkFleet(l, 2000).some(w => /basic weapons/.test(w)), 'two variants, none basic')
  assert.deepEqual(checkFleet({ ...l, ships: ['con-lance-cruiser', 'con-lance-cruiser'], picks: [[0, 0], [2, 1]] }, 2000), [])
})
test('Crusade has the Prime Guard and Annihilators, Doctrine does not; Sabre is Dominion only', () => {
  const ships = ['con-battle-barge']
  assert.ok(checkFleet(L({ ships, upgrades: { 0: ['honour'] } }), 2000).some(w => /honour/.test(w)))
  assert.deepEqual(checkFleet(L({ ships, list: 'crusade', upgrades: { 0: ['honour'] } }), 2000), [])
  assert.ok(checkFleet(L({ ships: ['con-battle-barge', 'con-rsv-sabre', 'con-rsv-sabre'], escortSquadrons: [[1, 2]] }), 2000).length > 0)
  assert.deepEqual(checkFleet(L({ ships: ['con-battle-barge', 'con-rsv-sabre', 'con-rsv-sabre'], list: 'dominion', escortSquadrons: [[1, 2]] }), 2000), [])
  const g = createFleetBattle({ lists: [L({ ships, list: 'crusade', upgrades: { 0: ['honour'] } }), { name: 'I', fleet: 'freemen', ships: ['lantern'], escortSquadrons: [], commander: null }], limit: 2000, seed: 2 })
  assert.equal(g.ships[0].annihilators, true); assert.deepEqual(launchable(g, g.ships[0]), ['dropwing', 'dropwing breaker'])
  assert.equal(g.sides[0].attackRating, 3)
})
test('a lance cruiser built with its choices has the swapped weapons and the extra shield', () => {
  const g = createFleetBattle({ lists: [L({ ships: ['con-lance-cruiser', 'con-lance-cruiser'], picks: [[0, 0], [1, 1]], upgrades: { 1: ['shield'] } }), { name: 'I', fleet: 'freemen', ships: ['lantern'], escortSquadrons: [], commander: null }], limit: 2000, seed: 2 })
  const sc = g.ships[1]
  assert.deepEqual(sc.profile.weapons.map(w => w.kind), ['battery', 'battery', 'torpedo', 'lance'])
  assert.equal(sc.profile.shields, 2); assert.equal(g.ships[0].profile.shields, 1)
})
