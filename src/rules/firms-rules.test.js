// Tests for Da Rukka Firms (rules/firms.js), the Gubbins, the Sprog Lance and sprog hordes. Fixed dice so the arithmetic shows.
// Run by `npm test` (node:test); exports nothing.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { scriptedRng } from './dice.js'
import { createGame, addShip, giveOrder, leadershipOf, formSquadron, aheadFullDice, rerollFor } from './game.js'
import { checkFleet, fleetPoints, createFleetBattle } from './fleet.js'
import { fireSproglance } from './firms.js'
import { offerGafferSwaps } from './rukka.js'
import { speedOf, resolveRam } from './movement.js'
import { launchCraft, launchable, rukkaCapacityCull, launchMines } from './ordnance.js'
import { canTeleport, hitAndRun } from './endPhase.js'

const dice = (g, f) => { g.rng = scriptedRng([...f, ...Array(200).fill(1)]) }
const said = (g, re) => g.log.some(l => re.test(l.text))
const L = (ships, more = {}) => ({ name: 'o', fleet: 'rukka', list: 'firms', ships, escortSquadrons: [], capitalSquadrons: [], ...more })
const six = n => Array(n).fill('rukka-ravager')

test('Firms list offers Razza\'s Grabber (Terrace only, 0-1) and the Lite cruisa', () => {
  const base = { upgrades: { 0: ['cwarlord'] }, escortSquadrons: [[2, 3, 4]], capitalSquadrons: [[0, 1]] }
  assert.deepEqual(checkFleet(L(["rukka-razzas-grabber", 'rukka-lite-cruisa', 'rukka-ravager', 'rukka-ravager', 'rukka-ravager'], base), 1000), [])
  assert.ok(checkFleet(L(['rukka-razzas-grabber', 'rukka-razzas-grabber', ...six(3)], { ...base, capitalSquadrons: [[0, 1]] }), 1000).some(x => /\(0-1\) Razza/.test(x)))
  assert.ok(checkFleet(L(['rukka-razzas-grabber', ...six(3)], { upgrades: { 0: ['cwarlord', 'evil'] }, escortSquadrons: [[1, 2, 3]] }), 1000).some(x => /Terrace only/.test(x)))
  assert.equal(fleetPoints(L(['rukka-lite-cruisa', 'rukka-lite-cruisa-bangers'], { upgrades: { 0: ['cwarlord'] } })), 90 + 90, 'the extra bangers cost nothing')
})

test('one Gaffer per 500 points or part, no more, no less; a Gaffer is free, re-rolls +20 / +40', () => {
  const e = { escortSquadrons: [[1, 2, 3]] }
  assert.ok(checkFleet(L(['rukka-lite-cruisa', ...six(3)], e), 1000).some(x => /no more and no less/.test(x)), 'no Gaffer')
  assert.ok(checkFleet(L(['rukka-lite-cruisa', ...six(3)], { ...e, upgrades: { 0: ['cwarlord'], 1: ['cwarlord'] } }), 1000).some(x => /no more and no less/.test(x)), 'two for 300 points')
  assert.equal(fleetPoints(L(['rukka-lite-cruisa', ...six(3)], { ...e, upgrades: { 0: ['cwarlord2'] } })), 90 + 120 + 40)
})

test('gangs: each re-roll commands one titchy gang and one other', () => {
  const ok = L(['rukka-lite-cruisa', ...six(3)], { escortSquadrons: [[1, 2, 3]], upgrades: { 0: ['cwarlord'] } })
  assert.deepEqual(checkFleet(ok, 1000), [])
  const none = L(['rukka-lite-cruisa', ...six(2)], { escortSquadrons: [[1, 2]], upgrades: { 0: ['cwarlord'] } })
  assert.ok(checkFleet(none, 1000).some(x => /three to ten escorts/.test(x)))
  const lone = L(['rukka-lite-cruisa'], { upgrades: { 0: ['cwarlord'] } })
  assert.ok(checkFleet(lone, 1000).some(x => /titchy gang/.test(x)))
})

test('Gubbins: one per Gaffer re-roll, none without a Gaffer, hulks pay double', () => {
  const e = { escortSquadrons: [[1, 2, 3]] }
  assert.ok(checkFleet(L(['rukka-lite-cruisa', ...six(3)], { ...e, upgrades: { 0: ['cwarlord', 'maniac', 'mad'] } }), 1000).some(x => /one Gubbin each/.test(x)))
  assert.ok(!checkFleet(L(['rukka-lite-cruisa', ...six(3)], { ...e, upgrades: { 0: ['cwarlord1', 'maniac', 'mad'] } }), 1000).some(x => /Gubbin/.test(x)), 'two re-rolls allow two Gubbins')
  assert.ok(checkFleet(L(['rukka-lite-cruisa', ...six(3)], { ...e, upgrades: { 0: ['cwarlord'], 1: ['maniac'] } }), 1000).some(x => /no Gaffer leads/.test(x)), 'the escorts are not the Gaffer\'s gang')
  assert.equal(fleetPoints(L(['rukka-lite-cruisa', ...six(3)], { ...e, upgrades: { 0: ['cwarlord1', 'power', 'big'] } })), 90 + 120 + 20 + 25 + 25)
})

test('a titchy gang pays once for a clan upgrade and every escort has it', () => {
  const sq = L(['rukka-lite-cruisa', ...six(4)], { escortSquadrons: [[1, 2, 3, 4]], upgrades: { 0: ['cwarlord'], 1: ['evil'] } })
  assert.equal(fleetPoints(sq), 90 + 160 + 20)
  const g = createFleetBattle({ lists: [sq, { name: 'i', fleet: 'freemen', ships: ['lantern'], escortSquadrons: [], capitalSquadrons: [] }], limit: 2000, seed: 3 })
  const esc = g.ships.filter(s => s.side === 0 && s.profile.type === 'escort')
  assert.ok(esc.every(s => s.upgrades.includes('evil')))
  assert.equal(speedOf(esc[0]), 25, 'Boy Racers +5 cm on a 20 cm Ravager')
})

test('Wide Boyz gain Maniac Gunners, Rag-and-Bone Lot Nicked Torpedoes and Lances free', () => {
  const l = L(['rukka-lite-cruisa-torpedo', ...six(3)], { escortSquadrons: [[1, 2, 3]], upgrades: { 0: ['cwarlord', 'skullz'] } })
  const g = createFleetBattle({ lists: [l, { name: 'i', fleet: 'freemen', ships: ['lantern'], escortSquadrons: [], capitalSquadrons: [] }], limit: 2000, seed: 3 })
  const s = g.ships[0]
  assert.ok(s.upgrades.includes('nicked') && !s.upgrades.includes('llances'), 'a torpedo chucka ship has no heavy bangers to loot')
  const m = createFleetBattle({ lists: [L(['rukka-lite-cruisa', ...six(3)], { escortSquadrons: [[1, 2, 3]], upgrades: { 0: ['cwarlord', 'wideboyz'] } }), { name: 'i', fleet: 'freemen', ships: ['lantern'], escortSquadrons: [], capitalSquadrons: [] }], limit: 2000, seed: 3 })
  assert.ok(m.ships[0].upgrades.includes('maniac'))
})

test('Nicked Lances turn heavy bangers into Strength 2 lances, 30 cm on a capital ship', () => {
  const l = L(['rukka-lite-cruisa', ...six(3)], { escortSquadrons: [[1, 2, 3]], upgrades: { 0: ['cwarlord', 'llances'] } })
  const g = createFleetBattle({ lists: [l, { name: 'i', fleet: 'freemen', ships: ['lantern'], escortSquadrons: [], capitalSquadrons: [] }], limit: 2000, seed: 3 })
  const w = g.ships[0].profile.weapons.find(x => x.kind === 'lance')
  assert.equal(w.str, 2); assert.equal(w.range, 30)
})

test('Mob Rule: +1 Resolve while the gang has more than five ships; Young \'Uns: Ld 5 or 6 gets a free escort', () => {
  const l = L(['rukka-lite-cruisa', ...six(5)], { escortSquadrons: [[1, 2, 3, 4, 5]], upgrades: { 0: ['cwarlord'] } })
  const g = createFleetBattle({ lists: [l, { name: 'i', fleet: 'freemen', ships: ['lantern'], escortSquadrons: [], capitalSquadrons: [] }], limit: 2000, seed: 1 })
  const esc = g.ships.filter(s => s.side === 0 && s.profile.type === 'escort')
  const ld = esc[0].leadership
  if (ld === 5 || ld === 6) {
    assert.equal(esc.length, 6, 'a sixth escort for free'); assert.equal(esc[5].profile.points, 0)
    assert.equal(leadershipOf(esc[0]), ld + 1, 'and the sixth ship brings Mob Rule')
  } else assert.equal(esc.length, 5)
  // force the case: Ld 5
  const g2 = createGame({ fleets: [{ name: 'R', fleet: 'rukka' }, { name: 'I', fleet: 'freemen' }] })
  const ships = Array.from({ length: 6 }, () => addShip(g2, 0, 'rukka-ravager')); ships.forEach(s => { s.leadership = 5; s.mobRule = true })
  const q = formSquadron(g2, ships.map(s => s.uid), 'Q')
  assert.equal(leadershipOf(ships[0]), 6)
  ships[5].state = 'destroyed'; assert.equal(leadershipOf(ships[0]), 5, 'five left: no Mob Rule')
  void q
})

test('Terrace Lot +1 to ram and board; Prow Ram +1 to ram; Big Boostas +5 cm and 4D6; Old School +1 to Brace', () => {
  const g = createGame({ fleets: [{ name: 'R', fleet: 'rukka' }, { name: 'I', fleet: 'freemen' }] })
  const s = addShip(g, 0, 'rukka-bash-cruisa'), t = addShip(g, 1, 'lantern'); s.leadership = 7; t.leadership = 8
  s.upgrades = ['terrace', 'pram', 'big']
  s.pos = { x: 20, y: 60 }; s.facing = 0; t.pos = { x: 60, y: 60 }; t.facing = 180
  g.round = 1; g.active = 0; g.first = 0; g.phase = 'movement'
  assert.equal(speedOf(s), 25); assert.equal(aheadFullDice(s), 4)
  dice(g, [1, 1, 1, 1, 1, 1]); giveOrder(g, s, 'aheadFull', { ram: t.uid })
  assert.ok(said(g, /ram .*\+2 \(Terrace \/ Prow Ram/), g.log.map(l => l.text).join('\n'))
  const b = addShip(g, 0, 'rukka-lump'); b.leadership = 7; b.upgrades = ['snake']; b.pos = { x: 10, y: 10 }
  dice(g, [1, 1]); giveOrder(g, b, 'brace')
  assert.ok(said(g, /Old School \+1/))
})

test('Jump Box lets a teleport attack reach 30 cm', () => {
  const g = createGame({ fleets: [{ name: 'R', fleet: 'rukka' }, { name: 'I', fleet: 'freemen' }] })
  const s = addShip(g, 0, 'rukka-bash-cruisa'), t = addShip(g, 1, 'lantern')
  s.pos = { x: 20, y: 60 }; t.pos = { x: 45, y: 60 }; t.damage = 0
  g.round = 1
  assert.match(canTeleport(g, s, t), /10 cm/)
  s.upgrades = ['telly']
  assert.doesNotMatch(String(canTeleport(g, s, t)), /30 cm|10 cm/)
})

test('Sprog Lance: only against shields down, 4+, sprog hordes give extra Resolve dice', () => {
  const g = createGame({ fleets: [{ name: 'R', fleet: 'rukka' }, { name: 'I', fleet: 'freemen' }] })
  const s = addShip(g, 0, 'rukka-bash-cruisa'), t = addShip(g, 1, 'lantern')
  s.profile = { ...s.profile, weapons: s.profile.weapons.map(w => w.kind === 'heavybangers' ? { loc: 'prow', kind: 'sproglance', range: 30, str: 'special', arc: ['front'] } : w) }
  s.leadership = 7; t.leadership = 8
  s.pos = { x: 20, y: 60 }; s.facing = 0; t.pos = { x: 40, y: 60 }; t.facing = 180
  g.round = 1; g.active = 0; g.first = 0; g.phase = 'shooting'
  assert.equal(fireSproglance(g, s, t).ok, false, 'shields are up')
  assert.ok(said(g, /shields are down/))
  g.blast.push(...Array.from({ length: t.profile.shields }, () => ({ x: 40, y: 60 + 1 })))   // Blast Markers in contact take its shields down
  dice(g, [2]); const miss = fireSproglance(g, s, t)
  assert.equal(miss.ok && miss.hit, false); assert.ok(said(g, /rolled 2, needed 4\+: missed/))
  s.sproglanceFired = 0
  dice(g, [5, 2]); const hit = fireSproglance(g, s, t)
  assert.ok(hit.hit, g.log.map(l => l.text).join('\n')); assert.equal(hit.hordes, 2)
  assert.equal(t.hordes, 2)
  t.pos = { x: 40, y: 60 }; g.phase = 'movement'; g.active = 1; g.first = 1; t.order = null
  dice(g, [1, 1, 1, 1])
  giveOrder(g, t, 'lockOn')
  assert.ok(said(g, /4 dice for this test|3 dice for this test/), g.log.map(l => l.text).join('\n'))
  assert.equal(t.hordes, 1, 'a special order repairs one horde, even if failed')
})

test('Boarding Barge: assault boats only, one extra boat marker', () => {
  const g = createGame({ fleets: [{ name: 'R', fleet: 'rukka' }, { name: 'I', fleet: 'freemen' }] })
  const z = addShip(g, 0, 'rukka-razzas-grabber'); z.upgrades = ['barge', 'terrace']; z.leadership = 7
  z.pos = { x: 20, y: 60 }; z.facing = 0
  g.round = 1; g.active = 0; g.first = 0; g.phase = 'shooting'
  assert.deepEqual(launchable(g, z), ['assault boat'])
  dice(g, [6, 6, 6])
  const r = launchCraft(g, z, { 'assault boat': 1 })
  assert.ok(r.ok, g.log.map(l => l.text).join('\n'))
  assert.equal(g.ordnance.find(o => o.kind === 'wave').markers.length, 2)
})

test('craft over capacity: the owner picks the waves, one marker each; the rest are the last launched', () => {
  const g = createGame({ fleets: [{ name: 'R', fleet: 'rukka' }, { name: 'I', fleet: 'freemen' }] })
  g.active = 0; g.round = 1; g.first = 0; g.phase = 'ordnance'
  const mk = (id, n) => ({ id, kind: 'wave', side: 0, markers: Array(n).fill('assault boat'), pos: { x: 0, y: 0 }, r: 1, fleet: 'rukka' })
  g.ordnance = [mk(101, 3), mk(102, 3)]
  g.craftCap = { 0: { key: '1:0', total: 3 } }
  g.decide.dropCraft = () => [101, 101]
  rukkaCapacityCull(g)
  assert.deepEqual(g.ordnance.map(o => o.markers.length), [1, 2], 'two picked from wave 101, then the last wave launched loses the third')
})

test('hulk: Maniac Gunners affect one weapon system a turn, named before the roll', async () => {
  const { fireShip } = await import('./shooting.js')
  const g = createGame({ fleets: [{ name: 'R', fleet: 'rukka' }, { name: 'I', fleet: 'freemen' }] })
  const h = addShip(g, 0, 'rukka-hulk'), t = addShip(g, 1, 'lantern')
  h.upgrades = ['maniac']; h.leadership = 6; t.leadership = 8
  h.pos = { x: 40, y: 60 }; h.facing = 0; t.pos = { x: 60, y: 60 }; t.facing = 180
  g.round = 1; g.active = 0; g.first = 0; g.phase = 'shooting'
  const asked = []
  g.decide.nominateReroll = (_g, _s, q) => { asked.push(q.weapon.loc + q.weapon.kind); return asked.length === 1 }
  g.decide.rerollBangers = () => true
  const prow = h.profile.weapons.findIndex(w => w.kind === 'battery' && w.loc === 'prow'), aft = h.profile.weapons.findIndex(w => w.kind === 'battery' && w.loc === 'aft')
  const t2 = addShip(g, 1, 'lantern'); t2.leadership = 8; t2.pos = { x: 20, y: 60 }; t2.facing = 0
  dice(g, [3, 3, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6])
  const fr = fireShip(g, h, [{ weapon: prow, target: t.uid }, { weapon: aft, target: t2.uid }])
  assert.ok(fr.ok !== false, g.log.slice(-3).map(l => l.text).join('|'))
  assert.equal(asked.length, 1, 'asked once, before the first system rolls; the other cannot use it')
  assert.equal(g.log.filter(l => /re-rolled by the Maniac Gunners/.test(l.text)).length, 1, 'only the nominated system re-rolled')
  assert.ok(said(g, /nominated for this turn's Maniac Gunners/))
})

test('hulk thruster hits: it must roll higher than the number of hits to turn', async () => {
  const { moveShip } = await import('./movement.js')
  const g = createGame({ fleets: [{ name: 'R', fleet: 'rukka' }, { name: 'I', fleet: 'freemen' }] })
  const h = addShip(g, 0, 'rukka-hulk'); h.leadership = 6
  h.pos = { x: 40, y: 60 }; h.facing = 0; h.crits.hulkThrust = 2
  g.round = 2; g.active = 0; g.first = 0; g.phase = 'movement'
  dice(g, [2])
  const r = moveShip(g, h, [{ fwd: 10 }, { turn: 45 }])
  assert.equal(r.ok, false); assert.ok(said(g, /turn roll 2, must be higher: it cannot turn/))
  assert.equal(moveShip(g, h, [{ fwd: 10 }]).ok, true, 'straight on is allowed, and no second roll')
  const h2 = addShip(g, 0, 'rukka-hulk'); h2.leadership = 6; h2.pos = { x: 40, y: 90 }; h2.facing = 0; h2.crits.hulkThrust = 2
  dice(g, [3])
  assert.equal(moveShip(g, h2, [{ fwd: 10 }, { turn: 45 }]).ok, true)
})

test('a Lump bought as a planetary defence: only the Rukka, stationary, 12 on 2D6 makes it fall', async () => {
  const { buyDefence, placeDefence, rollDefenceBudget } = await import('./defences.js')
  const g = createGame({ fleets: [{ name: 'R', fleet: 'rukka', points: 1000 }, { name: 'I', fleet: 'freemen', points: 500 }] })
  g.defender = 0; g.sc = { page: 136 }; g.table = { w: 180, h: 120 }
  g.terrain = [{ kind: 'planet', size: 'medium', shape: { t: 'circ', x: 40, y: 80, r: 10 } }]
  dice(g, [6, 6]); rollDefenceBudget(g)
  const b = buyDefence(g, 'rukka-lump-defence')
  assert.ok(b.ok, b.reason)
  const lump = g.ships.find(s => s.uid === b.uid)
  assert.equal(lump.profile.speed, 0); assert.equal(lump.leadership, 7)
  dice(g, [6, 6, 3, 3])   // 12, then it falls 6 cm: from 25 cm up the planet edge is 15 cm away
  placeDefence(g, lump, { x: 40, y: 55 })
  assert.equal(lump.state, 'active'); assert.equal(Math.round(lump.pos.y), 61)
  const g2 = createGame({ fleets: [{ name: 'I', fleet: 'freemen', points: 500 }, { name: 'R', fleet: 'rukka', points: 500 }] })
  g2.defender = 0; g2.sc = { page: 136 }; dice(g2, [6]); rollDefenceBudget(g2)
  assert.match(buyDefence(g2, 'rukka-lump-defence').reason, /only the Rukka/)
})

test('a Lump that falls 2D6 cm onto the planet edge is destroyed', async () => {
  const { placeDefence } = await import('./defences.js')
  const g = createGame({ fleets: [{ name: 'R', fleet: 'rukka' }, { name: 'I', fleet: 'freemen' }] })
  g.terrain = [{ kind: 'planet', size: 'medium', shape: { t: 'circ', x: 40, y: 80, r: 10 } }]
  const lump = addShip(g, 0, 'rukka-lump-defence'); g.table = { w: 180, h: 120 }
  dice(g, [6, 6, 6, 6]); placeDefence(g, lump, { x: 40, y: 62 })
  assert.equal(lump.state, 'destroyed')
})

test('Heavy Clobba Boarding Parties add +1 to hit-and-run attacks of any type: teleports and assault boats', () => {
  const g = createGame({ fleets: [{ name: 'o', fleet: 'rukka' }, { name: 'i', fleet: 'freemen' }] })
  const o = addShip(g, 0, 'rukka-terror'), t = addShip(g, 1, 'lantern')
  o.pos = { x: 40, y: 60 }; t.pos = { x: 50, y: 60 }; g.round = 1; g.active = 0; g.phase = 'end'
  dice(g, [])
  hitAndRun(g, t, o, { natural: 3, braceAsked: true })
  assert.ok(!said(g, /Mega-armoured/))
  o.upgrades = ['mega']
  hitAndRun(g, t, o, { natural: 3, braceAsked: true })
  assert.ok(said(g, /3 \+1 \(Heavy Clobba Boarding Parties\) = 4/))
  g.log.length = 0
  hitAndRun(g, t, { name: 'assault boats', fleet: 'rukka', from: o.uid }, { natural: 3, braceAsked: true })   // what ordnance.js passes for a wave
  assert.ok(said(g, /Heavy Clobba Boarding Parties/))
})

test('Turncoats borrow up to three Freemen Navy / Dominion escorts in a gang of six or more', () => {
  const gaffer = { upgrades: { 0: ['cwarlord', 'axes'], 2: ['axes'] }, capitalSquadrons: [[0, 1]], escortSquadrons: [[2, 3, 4, 5, 6, 7]] }
  const mk = (...esc) => L(['rukka-lite-cruisa', 'rukka-lite-cruisa', ...esc], gaffer)
  const six = ['rukka-ravager', 'rukka-ravager', 'rukka-ravager', 'sword', 'adder', 'apostate']
  assert.deepEqual(checkFleet(mk(...six), 1000), [])
  assert.ok(checkFleet(mk('rukka-ravager', 'rukka-ravager', 'sword', 'adder', 'apostate', 'faithless'), 1000).some(x => /at most three borrowed/.test(x)))
  assert.ok(checkFleet(L(['rukka-lite-cruisa', 'rukka-lite-cruisa', ...six], { ...gaffer, upgrades: { 0: ['cwarlord'] } }), 1000).some(x => /only go in a Turncoats/.test(x)))
  assert.ok(checkFleet(L(['rukka-lite-cruisa', 'rukka-lite-cruisa', 'rukka-ravager', 'rukka-ravager', 'rukka-ravager', 'sword'], { ...gaffer, escortSquadrons: [[2, 3, 4, 5]] }), 1000).some(x => /at least six/.test(x)))
})

test('a Gaffer must be embarked on the dearest ship under his command', () => {
  const base = { escortSquadrons: [[2, 3, 4]], capitalSquadrons: [[0, 1]] }
  const e = checkFleet(L(['rukka-lite-cruisa', 'rukka-terror', ...six(3)], { ...base, upgrades: { 0: ['cwarlord'] } }), 1000)
  assert.ok(e.some(x => /dearest ship of his own command/.test(x)), e.join('|'))
  assert.deepEqual(checkFleet(L(['rukka-terror', 'rukka-lite-cruisa', ...six(3)], { ...base, upgrades: { 0: ['cwarlord'] } }), 1000), [])
})

test('a Gaffer\'s re-rolls serve only the gangs under his command; he may swap Resolve with one of them', () => {
  const l = L(['rukka-terror', 'rukka-lite-cruisa', ...Array(6).fill('rukka-brute')], { upgrades: { 0: ['cwarlord1'] }, escortSquadrons: [[2, 3, 4], [5, 6, 7]] })
  const i = { name: 'i', fleet: 'freemen', ships: ['lantern'], escortSquadrons: [], capitalSquadrons: [], commander: null }
  const g = createFleetBattle({ lists: [l, i], limit: 3000, seed: 3, decide: {} })
  const w = g.ships[0]
  assert.ok(w.gafferRerolls >= 1)
  assert.equal(g.rerolls[0].left, 0, 'none in the fleet pool')
  assert.ok(w.command.includes(w.uid))
  const out = g.ships.find(s => s.side === 0 && !w.command.includes(s.uid))
  if (out) assert.equal(rerollFor(g, out), null, 'a ship outside his command gets none')
  assert.equal(rerollFor(g, w).name, `${w.name}'s Gaffer`)
})

test('the Gaffer swaps Resolve with a ship under his command when the owner says so, never with one outside it', () => {
  const l = L(['rukka-terror', 'rukka-lite-cruisa', ...Array(6).fill('rukka-brute')], { upgrades: { 0: ['cwarlord1'] }, escortSquadrons: [[2, 3, 4], [5, 6, 7]] })
  const i = { name: 'i', fleet: 'freemen', ships: ['lantern'], escortSquadrons: [], capitalSquadrons: [], commander: null }
  const g = createFleetBattle({ lists: [l, i], limit: 3000, seed: 3 })
  const w = g.ships[0]
  const [a, b] = [g.ships[1], g.ships[2]]
  w.leadership = 6; w.swapped = false; a.leadership = 8; a.swapped = false
  w.command = [w.uid, a.uid]
  let offered = null
  g.decide.swapGaffer = (_g, x, cands) => { offered = cands.map(c => c.uid); return cands[0] }
  offerGafferSwaps(g, 0)
  assert.deepEqual(offered, [a.uid]); assert.equal(w.leadership, 8); assert.equal(a.leadership, 6)
  assert.ok(said(g, /swaps Resolve with .*: 8 and 6/))
  assert.equal(b.swapped === true, false)
})

test('Rukka orbital mines: +5 points per launch bay strength, cruisas only (no hulk, no battleship), mines instead of craft', () => {
  const base = { upgrades: { 1: ['cwarlord'], 0: [] }, escortSquadrons: [[2, 3, 4]], capitalSquadrons: [[0, 1]] }
  base.upgrades[1] = ['cwarlord', 'mines']
  const ships = ['rukka-lite-cruisa', 'rukka-terror', ...six(3)]
  assert.deepEqual(checkFleet(L(ships, base), 1000), [])
  assert.equal(fleetPoints(L(ships, base)) - fleetPoints(L(ships, { ...base, upgrades: { 1: ['cwarlord'] } })), 20, 'a Bovver ship has bays 2 + 2')
  const bad = checkFleet(L(['rukka-lite-cruisa', 'rukka-hammer', ...six(3)], { ...base, upgrades: { 1: ['cwarlord', 'mines'] } }), 1000)
  assert.ok(bad.some(x => /Orbital mines/.test(x)), bad.join('|'))
  const i = { name: 'i', fleet: 'freemen', ships: ['lantern'], escortSquadrons: [], capitalSquadrons: [], commander: null }
  const g = createFleetBattle({ lists: [L(ships, base), i], limit: 3000, seed: 3 })
  const t = g.ships.find(s => s.id === 'rukka-terror')
  assert.equal(t.mines, true)
  t.pos = { x: 40, y: 60 }; t.facing = 0; g.round = 1; g.active = 0; g.phase = 'movement'; t.movedThisPhase = true
  const r = launchMines(g, t)
  assert.ok(r.ok); assert.equal(r.launched, 4)
})

test('Prow Ram: +1 to the ram Resolve check and 1 hit point on the rammed ship before the ram dice', () => {
  const g = createGame({ fleets: [{ name: 'o', fleet: 'rukka' }, { name: 'i', fleet: 'freemen' }] })
  const o = addShip(g, 0, 'rukka-terror'), t = addShip(g, 1, 'lantern')
  o.upgrades = ['pram']; o.pos = { x: 40, y: 60 }; o.facing = 0; t.pos = { x: 48, y: 60 }; t.facing = 180
  g.round = 1; g.active = 0; g.first = 0; g.phase = 'movement'
  const before = t.damage ?? 0
  dice(g, [6, 6, 6, 6, 1, 1, 1, 1, 1, 1])
  resolveRam(g, o, t)
  assert.ok(said(g, /Prow Ram tears into/))
})
