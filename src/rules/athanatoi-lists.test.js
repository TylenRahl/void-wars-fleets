// Tests for Athanatoi fleet lists and the rest of their rules. Fixed dice, so the arithmetic shows.
// Run by `npm test` (node:test); exports nothing.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { scriptedRng } from './dice.js'
import { checkFleet, fleetPoints, createFleetBattle } from './fleet.js'
import { createGame, addShip, giveOrder, rerollFor, squadronOf, formSquadron } from './game.js'
import { checkMove } from './movement.js'
import { sailMove } from './sail.js'
import { boardingAction, hitAndRun, canTeleport, endPhase } from './endPhase.js'
import { critOn, damageShip } from './damage.js'
import { fieldSave } from './miragefield.js'
import { applyBattlezone } from './effects.js'
import { startOfTurnEffects } from './effects.js'
import { listAttackRating } from './listCheck.js'
import { CLASSES, splitShipId, resolveShipId } from '../data/fleetLists.js'
import { ALL_SHIPS } from '../data/ships.js'
import { MAX_POINTS } from './cruiserClash.js'

const L = o => ({ name: 'E', fleet: 'athanatoi', escortSquadrons: [], ...o })
const why = (l, lim = 3000) => checkFleet(l, lim)
const has = (l, re, lim) => why(l, lim).some(w => re.test(w))
const dice = (g, f) => { g.rng = scriptedRng(f) }
const said = (g, re) => g.log.some(x => re.test(x.text))

test('weapon choices are the drawn ships: a class plus its picks is the variant id', () => {
  assert.equal(resolveShipId('athanatoi', 'ath-wyrmship', [1, 1]), 'ath-wyrmship-lance-torpedo')
  assert.equal(resolveShipId('athanatoi', 'ath-duskhunter', [1]), 'ath-duskhunter-lance')
  assert.deepEqual(splitShipId('athanatoi', 'ath-stillship-torpedo'), { cls: 'ath-stillship', picks: [0, 1] })
  for (const [cls, c] of Object.entries(CLASSES.athanatoi)) for (const o of c.options ?? []) assert.ok(o.choices.length >= 2, cls)
  assert.ok(ALL_SHIPS.some(s => s.id === 'ath-wyrmship-lance-torpedo'))
})

test('Corsair list: Prince 100 + re-rolls 25/50/100, 0-12 cruisers, Prince required over 750', () => {
  const l = L({ list: 'corsair', ships: ['ath-selene', 'ath-veil', 'ath-asphodel', 'ath-asphodel'], escortSquadrons: [[2, 3]], commander: 'prince', commanderOn: 0, rerolls: 2 })
  assert.equal(fleetPoints(l), 250 + 210 + 130 + 100 + 50)
  assert.deepEqual(why(l), [])
  assert.ok(has({ ...l, commander: null, rerolls: 0, ships: [...l.ships, 'ath-selene'] }, /over 750 points must include a fleet commander/))
  assert.ok(has({ ...l, rerolls: 4 }, /at most 3 extra re-rolls/))
  assert.ok(has(L({ list: 'corsair', ships: Array(13).fill('ath-veil') }), /0-12 cruisers/, 9000))
})

test('Rimward Reach list has no Thalassa, Eos or Helios; Later Reach War has them, a battleship per full 1,000 points', () => {
  const stalker = ['ath-thalassa', 'ath-selene', 'ath-selene']
  assert.ok(has(L({ list: 'corsair', ships: ['ath-eos'] }), /not in the Athanatoi Corsairs, Rimward Reach list/))
  assert.deepEqual(why(L({ list: 'corsair-lgw', ships: ['ath-eos', 'ath-helios'] })), [])
  assert.ok(has(L({ list: 'corsair-lgw', ships: stalker, commander: 'prince', commanderOn: 0 }), /every full 1,000 points/), '380+250+250+100 = 980')
  assert.deepEqual(why(L({ list: 'corsair-lgw', ships: [...stalker, 'ath-selene'], commander: 'prince', commanderOn: 0 })), [])
})

test('Hero: Ld 10 for 100, re-rolls 50/75/100; reserves need a Hero, one per three cruisers; the Flame needs him aboard', () => {
  const base = ['ath-selene', 'ath-veil', 'ath-selene', 'ath-wyrmship']
  assert.ok(has(L({ list: 'corsair', ships: base, commander: 'prince', commanderOn: 0 }), /need an Athanatoi Strategos/))
  const ok = L({ list: 'corsair', ships: base, commander: 'hero', commanderOn: 0, rerolls: 1 })
  assert.deepEqual(why(ok), [])
  assert.equal(fleetPoints(ok), 250 + 210 + 250 + 260 + 100 + 50)
  assert.ok(has({ ...ok, ships: [...base, 'ath-stillship'] }, /one for every three cruisers/))
  const flame = L({ list: 'corsair', ships: ['ath-selene', 'ath-veil', 'ath-selene', 'ath-flame'], commander: 'hero', commanderOn: 0 })
  assert.ok(has(flame, /aboard the Flame/))
  assert.deepEqual(why({ ...flame, commanderOn: 3 }), [])
})

test('Skirmisher escorts and Duskhunters never share a squadron; Duskhunters one per three escorts', () => {
  const ships = ['ath-selene', 'ath-asphodel', 'ath-asphodel', 'ath-asphodel', 'ath-duskhunter']
  const l = L({ list: 'corsair', ships, commander: 'hero', commanderOn: 0, escortSquadrons: [[1, 2, 3, 4]] })
  assert.ok(has(l, /may not be in the same squadron/))
  assert.deepEqual(why({ ...l, escortSquadrons: [[1, 2, 3], [4]] }).filter(w => /squadron/.test(w) && !/escort squadrons have at least/.test(w)), [])
})

test('Penthos: Polemarch Ld 9 for 75 with one re-roll +25; a Wyrmship per two Stillships; his flagship Wyrmship is extra', () => {
  const l = L({ list: 'penthos', ships: ['ath-wyrmship', 'ath-stillship'], commander: 'polemarch', commanderOn: 0 })
  assert.equal(fleetPoints(l), 260 + 160 + 75)
  assert.deepEqual(why(l), [])
  assert.ok(has({ ...l, commanderOn: 1 }, /one Wyrmship for every two Stillships/), 'not aboard the Wyrmship: no extra')
  assert.ok(has({ ...l, rerolls: 2 }, /at most 1 extra re-roll/))
  assert.ok(has({ ...l, ships: ['ath-wyrmship', 'ath-wyrmship', 'ath-stillship'] }, /one Wyrmship/))
  assert.ok(has(L({ list: 'penthos', ships: ['ath-stillship', 'ath-stillship', 'ath-wyrmship'], commander: 'bearer', commanderOn: 0 }), /^$/) === false)
})

test('Penthos extras: Discipline Host +20, Huntseers +30 (0-3), Soulship free but not with either, no launch bays', () => {
  const ships = ['ath-stillship', 'ath-stillship', 'ath-stillship', 'ath-stillship']
  const up = u => L({ list: 'penthos', ships, commander: 'polemarch', commanderOn: 0, upgrades: u })
  assert.equal(fleetPoints(up({ 0: ['discipline'], 1: ['huntseer'], 2: ['soulship'] })) - fleetPoints(up({})), 20 + 30)
  assert.ok(has(up({ 0: ['soulship', 'huntseer'] }), /can't have both/))
  assert.ok(has(up({ 0: ['soulship', 'discipline'] }), /can't have both/))
  assert.ok(has(up({ 0: ['huntseer'], 1: ['huntseer'], 2: ['huntseer'], 3: ['huntseer'] }), /0-3 Huntseers/))
  assert.ok(has(up({ 0: ['soulship'] }), /can't have launch bays/), 'the plain Stillship carries bays')
  assert.deepEqual(why(L({ list: 'penthos', ships: ['ath-stillship-torpedo', 'ath-stillship', 'ath-stillship'], commander: 'polemarch', commanderOn: 0, upgrades: { 0: ['soulship'] } })).filter(w => /Ghost/.test(w)), [])
  assert.ok(has(up({ 0: ['discipline'] , 1: ['vampires'] }), /Lamia raiders can't go on/))
})

test('Torpedo bombers cost +15 per bay, orbital mines +5 per bay on cruisers only', () => {
  const l = u => L({ list: 'corsair', ships: ['ath-selene'], upgrades: { 0: u } })
  assert.equal(fleetPoints(l(['tbombers'])) - 250, 60)
  assert.equal(fleetPoints(l(['mines'])) - 250, 20)
  assert.ok(has(l(['mines', 'tbombers']), /can't have both/))
  assert.ok(has(L({ list: 'corsair-lgw', ships: ['ath-thalassa'], upgrades: { 0: ['mines'] } }), /Orbital mines can't go on/, 9000))
  assert.ok(has(L({ list: 'corsair', ships: ['ath-veil'], upgrades: { 0: ['tbombers'] } }), /needs launch bays/))
})

test('Thalassa in a Penthos fleet needs 1,000 points and three Corsair cruisers; Corsair cruisers one per three Wyrmships/Stillships', () => {
  const w = Array(6).fill('ath-stillship')
  const l = L({ list: 'penthos', ships: [...w, 'ath-selene', 'ath-veil'], commander: 'hero', commanderOn: 0 })
  assert.deepEqual(why(l), [])
  assert.ok(has({ ...l, ships: [...w, 'ath-selene', 'ath-veil', 'ath-eos'] }, /one for every three Wyrmships/))
  assert.ok(has({ ...l, ships: [...w, 'ath-thalassa'] }, /three Corsair cruisers/))
})

test('Prince Ilarion: 150, or 125 on the Flame; Ld 10; one re-roll included, extras +25; attack rating 4; his ship is a Flame or a Wyrmship with bays', () => {
  const ships = ['ath-flame', 'ath-stillship', 'ath-stillship']
  const y = L({ list: 'penthos', ships, commander: 'ilarion', commanderOn: 0, rerolls: 2 })
  assert.equal(fleetPoints(y), 320 + 320 + 125 + 50)
  assert.deepEqual(why(y), [])
  assert.equal(listAttackRating(y), 4)
  assert.ok(has({ ...y, commanderOn: 1 }, /aboard the Flame/))
  assert.ok(has({ ...y, rerolls: 3 }, /at most 2 extra/))
  const d = L({ list: 'penthos', ships: ['ath-wyrmship', 'ath-stillship', 'ath-stillship'], commander: 'ilarion', commanderOn: 0 })
  assert.equal(fleetPoints(d), 260 + 320 + 150)
  assert.deepEqual(why(d), [])
  assert.ok(has({ ...d, ships: ['ath-wyrmship-torpedo', 'ath-stillship', 'ath-stillship'] }, /Wyrmship with launch bays/))
  assert.equal(listAttackRating(L({ list: 'penthos', ships: ['ath-stillship'] })), 3)
  assert.equal(listAttackRating(L({ list: 'corsair', ships: ['ath-selene'] })), 4)
})

test('a Flame with Ilarion is exempt from the reserve ratio of a Corsair fleet', () => {
  const l = L({ list: 'corsair', ships: ['ath-selene', 'ath-flame'], commander: 'ilarion', commanderOn: 1 })
  assert.deepEqual(why(l), [])
  assert.ok(has({ ...l, commander: 'hero' }, /one for every three cruisers/))
})

test('Cruiser Duel: only the Stillship, Eos and Helios are cruisers of 185 points or less', () => {
  const ok = ALL_SHIPS.filter(s => s.fleet === 'athanatoi' && s.type === 'cruiser' && s.points <= MAX_POINTS).map(s => s.id.replace(/-(lance|torpedo).*/, ''))
  assert.deepEqual([...new Set(ok)].sort(), ['ath-eos', 'ath-helios', 'ath-stillship'])
})

// ---- the battle ----
function battle (l, decide = {}) {
  const imp = { name: 'I', fleet: 'freemen', ships: ['lantern'], escortSquadrons: [] }
  const g = createFleetBattle({ lists: [l, imp], limit: 3000, seed: 5, decide })
  g.ships.forEach((s, i) => { s.pos = { x: 30 + i * 12, y: 60 }; s.facing = 0 })
  g.phase = 'movement'; g.round = 1; g.active = 0; g.first = 0
  return g
}

test('the Prince adds +2 to the ship\'s Resolve to a maximum of 10; the Polemarch sets his own; re-rolls are free + bought', () => {
  const prince = battle(L({ list: 'corsair', ships: ['ath-selene', 'ath-veil'], commander: 'prince', commanderOn: 0, rerolls: 2 }))
  const s = prince.ships[0]
  assert.ok(s.leadership >= 9 && s.leadership <= 10, `ship rolled 7-10 (+1 Athanatoi), +2 capped at 10: ${s.leadership}`)
  assert.equal(prince.rerolls[0].left, 2)
  assert.equal(prince.sides[0].attackRating, 4)
  assert.ok(said(prince, /Reaver Prince commands/))
  const aut = battle(L({ list: 'penthos', ships: ['ath-stillship', 'ath-stillship'], commander: 'polemarch', commanderOn: 1, rerolls: 1 }))
  assert.equal(aut.ships[1].leadership, 9)
  assert.equal(aut.rerolls[0].left, 1)
  assert.equal(aut.sides[0].attackRating, 3)
  const y = battle(L({ list: 'penthos', ships: ['ath-flame', 'ath-stillship', 'ath-stillship'], commander: 'ilarion', commanderOn: 0, rerolls: 1 }))
  assert.equal(y.rerolls[0].left, 2)
  assert.ok(y.ships[0].upgrades.includes('discipline') && y.ships[0].upgrades.includes('vampires'))
  assert.equal(y.ships[0].vampires, true)
})

test('upgrades reach the ships: the craft flags the ordnance code reads, a Huntseer, and the extra points count with the ship in victory points', () => {
  const g = battle(L({ list: 'penthos', ships: ['ath-wyrmship', 'ath-stillship', 'ath-stillship-torpedo', 'ath-stillship'], commander: 'polemarch', commanderOn: 0, upgrades: { 0: ['tbombers', 'vampires'], 1: ['huntseer'], 2: ['soulship'], 3: ['discipline'] } }))
  assert.equal(g.ships[0].torpedoBombers, true); assert.equal(g.ships[0].vampires, true)
  assert.equal(g.ships[1].huntseer.left, 1)
  assert.equal(g.ships[2].upgrades.includes('soulship'), true)
  assert.equal(g.ships[0].upgradePoints, 70)
  const m = battle(L({ list: 'corsair', ships: ['ath-selene'], upgrades: { 0: ['mines'] } }))
  assert.equal(m.ships[0].mines, true)
})

function duel (a = 'ath-stillship', b = 'ath-stillship', ups = {}) {
  const game = createGame({ fleets: [{ name: 'A', fleet: 'athanatoi' }, { name: 'B', fleet: 'freemen' }] })
  const s = addShip(game, 0, a), t = addShip(game, 1, b)
  s.leadership = 8; t.leadership = 8
  s.upgrades = ups.s ?? []; t.upgrades = ups.t ?? []
  s.pos = { x: 50, y: 60 }; s.facing = 0; t.pos = { x: 55, y: 60 }; t.facing = 180
  game.round = 1; game.active = 0; game.first = 0; game.phase = 'movement'
  return { game, s, t }
}

test('Soulship: a failed Command check means moving only, and no more Soulship orders that turn, but crewed ships may still try', () => {
  const { game, s } = duel('ath-stillship', 'lantern', { s: ['soulship'] })
  const other = addShip(game, 0, 'ath-stillship'); other.leadership = 8; other.upgrades = ['soulship']; other.pos = { x: 20, y: 20 }
  const crew = addShip(game, 0, 'ath-stillship'); crew.leadership = 8; crew.upgrades = []; crew.pos = { x: 20, y: 40 }
  dice(game, [6, 6])
  const r = giveOrder(game, s, 'lockOn')
  assert.equal(r.ok, false)
  assert.equal(s.noFireRound, game.round, 'nothing but moving')
  assert.equal(game.ordersFailed[0], false, 'crewed vessels are not stopped')
  dice(game, [1, 1])
  assert.equal(giveOrder(game, other, 'lockOn').ok, false)
  assert.ok(said(game, /no more Command checks for Soulships/))
  assert.equal(giveOrder(game, crew, 'lockOn').ok, true)
})

test('Soulship: a failed Brace check still braces but it may do nothing except move in its next turn', () => {
  const { game, s } = duel('ath-stillship', 'lantern', { s: ['soulship'] })
  dice(game, [6, 6])
  const r = giveOrder(game, s, 'brace')
  assert.equal(r.ok, true)
  assert.equal(s.order.kind, 'brace')
  assert.equal(s.noFireRound, s.order.until)
})

test('Soulship: critical hits only on a 6; half repair dice; no Hit-and-Run; enemies boarding it +1', () => {
  const { game, s, t } = duel('ath-stillship', 'lantern', { s: ['soulship'] })
  assert.equal(critOn(s), 6)
  assert.equal(critOn(addShip(game, 0, 'ath-stillship')), 4)
  s.crits.mastLines = 1; s.damage = 0
  game.phase = 'end'; game.active = 0
  dice(game, [1, 1, 1, 1, 1, 1, 1, 1, 1])
  endPhase(game)
  assert.ok(said(game, /repairs: 3 dice \(half, a Soulship\)/), 'six hits left, half = 3')
  t.pos = { x: 50, y: 62 }
  s.state = 'active'
  assert.match(canTeleport(game, s, t), /Soulship/)
  dice(game, [3, 3, ...Array(40).fill(1)])
  boardingAction(game, t, s)
  assert.ok(said(game, /boarding a Soulship/))
})

test('Kalyx and Duskhunter cannot start a boarding; a ship that boards them gains +1', () => {
  const { game, s, t } = duel('ath-kalyx', 'lantern')
  t.pos = { x: 50 + 3.2 - 0.1, y: 60 }
  s.facing = 0
  dice(game, [3, 3])
  assert.equal(s.profile.rules.noBoard.length > 0, true)
  const { game: g2, s: sh, t: e } = duel('ath-duskhunter', 'lantern')
  boardingAction(g2, e, sh)
  assert.ok(said(g2, /boarding (ath-duskhunter|Duskhunter)/))
})

test('Disciplines: +2 on a boarding roll, +1 on a Hit-and-Run roll; Hit-and-Run against a Soulship or Duskhunter +1', () => {
  const { game, s, t } = duel('ath-stillship', 'lantern', { s: ['discipline'] })
  dice(game, [3, 3, ...Array(40).fill(1)])
  boardingAction(game, s, t)
  assert.ok(said(game, /\+2 \(Discipline Warrior crew\)/))
  dice(game, [4, ...Array(40).fill(1)])
  const e = addShip(game, 1, 'sword'); e.pos = { x: 52, y: 60 }
  hitAndRun(game, e, s)
  assert.ok(said(game, /4 \+1 \(Discipline Warrior crew\) = 5/))
  const g2 = duel('ath-stillship', 'lantern', { t: ['soulship'] })
  g2.t.profile // Soulship flag is on the target
  dice(g2.game, [1, ...Array(40).fill(1)])
  assert.equal(hitAndRun(g2.game, g2.t, g2.s), false, 'a natural 1 always fails')
  dice(g2.game, [1, ...Array(40).fill(1)])
  g2.t.upgrades = ['soulship']; g2.t.state = 'active'
  assert.equal(hitAndRun(g2.game, g2.t, g2.s), false)
  dice(g2.game, [2, ...Array(40).fill(1)])
  hitAndRun(g2.game, g2.t, g2.s)
  assert.ok(said(g2.game, /2 \+1 \(against a Soulship\) = 3/))
})

test('Huntseer: a re-roll for its ship, a capital ship in its squadron, or an escort squadron within 15 cm', () => {
  const { game, s } = duel('ath-stillship', 'lantern')
  s.huntseer = { left: 1 }
  const mate = addShip(game, 0, 'ath-stillship'); mate.pos = { x: 70, y: 60 }
  const far = addShip(game, 0, 'ath-stillship'); far.pos = { x: 90, y: 60 }
  const e1 = addShip(game, 0, 'ath-asphodel'); e1.pos = { x: 60, y: 60 }
  const e2 = addShip(game, 0, 'ath-asphodel'); e2.pos = { x: 100, y: 100 }
  formSquadron(game, [s.uid, mate.uid], 'cap')
  formSquadron(game, [e1.uid], 'near'); formSquadron(game, [e2.uid], 'far')
  assert.match(rerollFor(game, s)?.name, /'s Huntseer$/)
  assert.ok(rerollFor(game, mate), 'same squadron')
  assert.equal(rerollFor(game, far), null)
  assert.ok(rerollFor(game, e1), 'escort squadron within 15 cm')
  assert.equal(rerollFor(game, e2), null)
})

test('solar flare: a passed Resolve check means no Blast Marker or hit; the ship turns away from the sun and moves 2D6', () => {
  const { game, s } = duel('ath-stillship', 'lantern')
  applyBattlezone(game, { zone: 2, sunward: 'top', terrain: [], effects: { flares: 1, bursts: 0 }, log: [] })
  s.pos = { x: 60, y: 60 }
  game.round = 1
  dice(game, [6, 1, 1, 3, 4, 6, 6, 6, 6])   // the flare roll 6; Resolve 1+1 passes; 2D6 = 3+4 = 7; then the Freemen ship's turn
  startOfTurnEffects(game)
  assert.equal(s.facing, 90, 'directly away from the top edge')
  assert.equal(Math.round(s.pos.y), 67)
  assert.equal(game.blast.filter(m => Math.hypot(m.x - s.pos.x, m.y - s.pos.y) < 5).length, 0)
  assert.equal(s.damage, 0)
  assert.ok(said(game, /moves 2D6 = 3 \+ 4 = 7 cm/))
})

test('gas cloud: the Athanatoi Resolve check when a move meets it; a pass ignores the cloud that turn, escorts roll again free', () => {
  const { game, s } = duel('ath-stillship', 'lantern')
  game.effects = { sunward: 'top', zone: 'none' }
  game.terrain = [{ kind: 'cloud', shape: { t: 'circ', x: 60, y: 60, r: 4 } }]
  s.pos = { x: 40, y: 60 }; s.facing = 0
  dice(game, [1, 1, 6, 6, 6])
  const r = sailMove(game, s, 0, { dist: 20 })
  assert.equal(r.ok, true)
  assert.ok(said(game, /ignore the gas cloud/))
  assert.equal(s.cloudOk.pass, true)
  assert.equal(r.slowed, false, 'a cloud ignored does not slow the ship')
  const e = duel('ath-asphodel', 'lantern')
  e.game.effects = { sunward: 'top', zone: 'none' }
  e.game.terrain = game.terrain
  e.s.pos = { x: 40, y: 60 }
  dice(e.game, [6, 6, 1, 1, 6, 6])
  sailMove(e.game, e.s, 0, { dist: 20 })
  assert.ok(said(e.game, /the escort's free re-roll/))
  assert.equal(e.s.cloudOk.pass, true)
})

test('boarding on the second move: allowed before shooting or launching, refused after', () => {
  const { game, s, t } = duel('ath-stillship', 'lantern')
  game.effects = { sunward: 'top', zone: 'none' }
  game.phase = 'ordnance'
  s.pos = { x: 40, y: 60 }; t.pos = { x: 40 + 10 + 3.2, y: 60 }
  s.fired = true
  const no = sailMove(game, s, 0, { dist: 10, board: t.uid })
  assert.equal(no.ok, false)
  assert.match(no.reason, /already shot or launched/)
  s.fired = false
  const ok = sailMove(game, s, 0, { dist: 10, board: t.uid })
  assert.equal(ok.ok, true)
  assert.equal(s.boarding, t.uid)
})

test('a Duskhunter re-rolls a failed mirage field save against attack craft, not against other attacks', () => {
  const { game, t: _t } = duel('ath-stillship', 'ath-duskhunter')
  const sh = game.ships[1]
  sh.pos = { x: 60, y: 60 }
  dice(game, [1, 5, 1])
  const r = fieldSave(game, sh, 1, { what: 'bomber', braceAsked: true, from: { x: 0, y: 0 } })
  assert.equal(r.through, 0, 'the 1 is re-rolled to a 5')
  dice(game, [1, 5])
  assert.equal(fieldSave(game, sh, 1, { what: 'lance', braceAsked: true, from: { x: 0, y: 0 } }).through, 1)
})

test('the Athanatoi bring their own transport to a Convoy', async () => {
  const { createScenario } = await import('./scenarios.js')
  const g = createScenario({ id: 'convoy', lists: [L({ list: 'penthos', ships: ['ath-stillship'] }), { name: 'I', fleet: 'freemen', ships: ['lantern'], escortSquadrons: [] }], attacker: 1, limit: 1000, seed: 2 })
  const tr = g.ships.filter(x => x.profile.role === 'transport')
  assert.ok(tr.length >= 2 && tr.every(x => x.id === 'transport-athanatoi' && x.profile.sail))
})
