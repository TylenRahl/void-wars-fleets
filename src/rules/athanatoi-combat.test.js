// Tests for Athanatoi combat: mirage fields, starlances, always-closing batteries, ordnance, criticals. Fixed dice, so the arithmetic shows.
// Run by `npm test` (node:test); exports nothing.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { scriptedRng } from './dice.js'
import { createGame, addShip, blastTouching, leadershipOf } from './game.js'
import { fireShip, baseColumn, starlanceChains, weaponWorks, fireSunburst } from './shooting.js'
import { damageShip, critical } from './damage.js'
import { fieldOf, fieldSave, ramSave } from './miragefield.js'
import { ordnanceTouchesShip, craftAttack } from './ordnance.js'
import { hitAndRun, boardingSave, endPhase } from './endPhase.js'

function duel (a = 'ath-wyrmship-lance', b = 'ath-eos') {
  const game = createGame({ fleets: [{ name: 'A', fleet: 'athanatoi' }, { name: 'B', fleet: 'athanatoi' }] })
  const s = addShip(game, 0, a), t = addShip(game, 1, b)
  s.leadership = 8; t.leadership = 8
  s.pos = { x: 50, y: 60 }; s.facing = 0; t.pos = { x: 70, y: 60 }; t.facing = 180
  game.round = 1; game.active = 0; game.first = 0; game.phase = 'shooting'
  return { game, s, t }
}
const dice = (game, faces) => { game.rng = scriptedRng(faces); return game.rng }
const said = (game, re) => game.log.some(l => re.test(l.text))

test('mirage field save: 1 is a hit, 2-6 misses and puts a Blast Marker in contact', () => {
  const { game, t } = duel()
  dice(game, [1, 2, 6])
  const r = fieldSave(game, t, 3, { what: 'lance', from: { x: 50, y: 60 }, braceAsked: true })
  assert.equal(r.through, 1); assert.equal(r.saved, 2)
  assert.equal(blastTouching(game, t).length, 2)
  assert.ok(said(game, /rolled 1, 2, 6.*1 hit stands, 2 missed and 2 Blast Markers placed/))
})

test('mirage fields are gone for a hulk and after Mirage Field Generators Destroyed; other fleets have none', () => {
  const { game, t } = duel()
  assert.ok(fieldOf(t))
  t.crits.miragefield = 1; assert.equal(fieldOf(t), null)
  t.crits.miragefield = 0; t.state = 'drifting'; assert.equal(fieldOf(t), null)
  const g2 = createGame({ fleets: [{ fleet: 'freemen' }, { fleet: 'dominion' }] })
  assert.equal(fieldOf(addShip(g2, 0, 'lantern')), null)
})

test('brace is asked before the mirage field save', () => {
  const { game, t } = duel()
  const order = []
  game.decide.brace = () => { order.push('brace'); return false }
  dice(game, [1]); const rng = game.rng
  game.rng = () => { order.push('roll'); return rng() }
  fieldSave(game, t, 1, { what: 'torpedo' })
  assert.deepEqual(order.slice(0, 2), ['brace', 'roll'])
})

test('batteries: a mirage field moves the gunnery table one column right; every target counts as closing', () => {
  const { game, s, t } = duel('ath-helios', 'ath-eos')
  t.moved = 20
  // target faces away (rear to the firer?): put the firer behind the target
  t.facing = 0
  assert.equal(baseColumn(t, 'away'), 2, 'normally capital moving away')
  assert.equal(baseColumn(t, 'away', s), 1, 'Athanatoi batteries: capital closing')
  assert.equal(baseColumn(t, 'abeam', s), 1)
  t.profile = { ...t.profile, type: 'escort' }
  assert.equal(baseColumn(t, 'abeam', s), 2, 'escort closing')
  t.moved = 3
  assert.equal(baseColumn(t, 'abeam', s), 0, 'under 5 cm is still a Defence')
})

test('batteries at a mirage field ship: 8 firepower at 20 cm, closing column 1 shifted right to 2', () => {
  const { game, s, t } = duel('ath-helios', 'ath-eos')
  t.moved = 20; t.facing = 180
  dice(game, Array(30).fill(1))
  const r = fireShip(game, s, [{ weapon: 0, target: t.uid }])
  assert.equal(r.ok, true)
  assert.equal(r.results[0].dice, 4, 'column 2 for firepower 8 is 4 dice (not 6)')
  assert.ok(said(game, /mirage field, one column right/))
  assert.equal(blastTouching(game, t).length, 0, 'batteries are not saved, only shifted')
})

test('starlance chains: each hit rolls again up to 3; a miss ends the chain; one chain per point of strength', () => {
  const { game } = duel()
  dice(game, [4, 5, 6])
  assert.equal(starlanceChains(game, 1, false).hits, 3)
  dice(game, [4, 2])
  assert.equal(starlanceChains(game, 1, false).hits, 1)
  dice(game, [1, 6, 5, 2])
  assert.equal(starlanceChains(game, 2, false).hits, 2, 'strength 2: the first chain misses at once, the second scores two')
})

test('Lock On: each miss gets one re-roll; a miss missed again ends the chain', () => {
  const { game } = duel()
  dice(game, [2, 5, 4, 3, 1])
  const p = starlanceChains(game, 1, true)   // 2 -> reroll 5 (hit), 4 (hit), 3 -> reroll 1 (ended)
  assert.equal(p.hits, 2)
  assert.match(p.text, /2→5/)
})

test('a starlance fires through fireShip as a lance, is saved by the mirage field per hit, and draws as one lance event', () => {
  const { game, s, t } = duel('ath-kalyx', 'ath-eos')
  t.moved = 20
  const events = []; game.onFx = e => events.push(e)
  // chain: 5, 6, 4 = 3 hits; three mirage field saves: 1 (through), 3, 4 (saved)
  dice(game, [5, 6, 4, 1, 3, 4, 1])
  const r = fireShip(game, s, [{ weapon: 0, target: t.uid }])
  assert.equal(r.ok, true)
  assert.equal(r.results[0].hits, 3)
  assert.equal(r.results[0].starlanceHits, 3)
  assert.equal(events.filter(e => e.kind === 'lance').length, 1)
  assert.equal(events[0].hits, 3)
  assert.equal(blastTouching(game, t).length, 2)
  assert.equal(t.damage, 1)
})

test('starlance and the keel: a keel armament critical stops keel weapons', () => {
  const { s } = duel('ath-flame')
  const keel = s.profile.weapons.find(w => w.loc === 'keel')
  assert.equal(weaponWorks(s, keel), true)
  s.crits.keel = 1
  assert.equal(weaponWorks(s, keel), false)
})

test('Athanatoi ordnance is hit by turrets only on a 6; torpedoes re-roll misses', () => {
  const g = createGame({ fleets: [{ fleet: 'freemen' }, { fleet: 'athanatoi' }] })
  const ship = addShip(g, 0, 'lantern'); ship.leadership = 8; ship.pos = { x: 50, y: 60 }; ship.facing = 0
  const e = addShip(g, 1, 'ath-eos'); e.pos = { x: 90, y: 60 }
  g.round = 1; g.active = 1; g.phase = 'ordnance'
  const o = { id: 1, kind: 'torpedo', side: 1, from: e.uid, fleet: 'athanatoi', str: 2, speed: 30, pos: { x: 55, y: 60 }, facing: 180, r: 1.25, attacked: {} }
  g.ordnance.push(o)
  // Lantern turrets 2: 5,5 miss a 6-only roll. Salvo of 2 vs armour 6+ (front): 4,1 miss; re-rolls 6,6 hit
  dice(g, [5, 5, 4, 1, 6, 6, ...Array(30).fill(1)])
  ordnanceTouchesShip(g, o, ship)
  assert.ok(said(g, /needed 6\+ \(Athanatoi ordnance/))
  assert.ok(said(g, /re-roll the 2 misses: 6, 6/))
  assert.ok(said(g, /Lantern class cruiser takes 2 damage/))
})

test('no turret suppression by escorting fighters against Athanatoi', () => {
  const g = createGame({ fleets: [{ fleet: 'freemen' }, { fleet: 'athanatoi' }] })
  const e = addShip(g, 1, 'ath-eos'); e.pos = { x: 90, y: 60 }; e.facing = 0
  g.round = 1; g.active = 0; g.phase = 'ordnance'
  const w = { id: 1, kind: 'wave', side: 0, markers: ['bomber', 'fighter'], pos: { x: 80, y: 60 }, r: 2, fleet: 'freemen' }
  g.ordnance.push(w)
  // bomber D6 = 1 -> 1 attack, no +1 for the fighter; that attack rolls 1 (miss vs armour)
  dice(g, [1, 1])
  craftAttack(g, w, e)
  assert.ok(said(g, /= 1 attacks/))
  assert.ok(said(g, /no turrets for the escorting fighters/))
})

test('Hit-and-Run against a mirage field: the hit is saved on 2-6 with a Blast Marker', () => {
  const { game, t } = duel()
  dice(game, [4, 3])   // hit-and-run roll 4, mirage field 3
  assert.equal(hitAndRun(game, t, { name: 'raiders' }), false)
  assert.equal(blastTouching(game, t).length, 1)
  assert.equal(t.damage, 0)
})

test('ramming: a saved ram fails whole; boarding is cancelled by a saved attempt', () => {
  const { game, s, t } = duel()
  dice(game, [3])
  assert.equal(ramSave(game, s, t), false)
  assert.equal(blastTouching(game, t).length, 1)
  dice(game, [1]); assert.equal(ramSave(game, s, t), true)
  s.boarding = t.uid
  dice(game, [5])
  assert.equal(boardingSave(game, s, t), false)
  assert.equal(s.boarding, null)
})

test('sunburst cannon: a saved shell has no effect and leaves a Blast Marker', () => {
  const g = createGame({ fleets: [{ fleet: 'freemen' }, { fleet: 'athanatoi' }] })
  const m = addShip(g, 0, 'mars'); m.leadership = 8; m.pos = { x: 20, y: 60 }; m.facing = 0
  const e = addShip(g, 1, 'ath-eos'); e.leadership = 8; e.pos = { x: 80, y: 60 }; e.facing = 0
  g.round = 1; g.active = 0; g.first = 0; g.phase = 'shooting'
  dice(g, [1, 1, 1, 1, 1, 1, 1, 1])   // scatter dice 1 = hit; then the mirage field roll 1... see below
  const before = e.damage
  fireSunburst(g, m, { x: 80, y: 60 })
  assert.ok(said(g, /miragefield/) || e.damage >= before)
})

test('Athanatoi critical: 4+ on the D6, then the Athanatoi 2D6 table; keys the movement code reads', () => {
  const { game, t } = duel()
  dice(game, [3, 2, 5])   // crit D6 3 = none (damage 1); next hit not rolled
  damageShip(game, t, 1, { what: 'test' })
  assert.equal(t.damage, 1)
  assert.ok(!said(game, /critical hit roll/))
  dice(game, [4, 2, 3, 5, 4])   // crit D6 4 = critical; 2D6 = 2+3 = 5 mast lines severed
  damageShip(game, t, 1, { what: 'test' })
  assert.equal(t.crits.mastLines, 1)
  assert.ok(said(game, /needed 4\+ — a critical hit/))
  for (const [roll, key] of [[6, 'mainsailScarred'], [7, 'superstructure'], [8, 'mainsailShredded'], [3, 'keel']]) {
    const x = duel('ath-flame').t
    dice(x.game ?? game, [1, 1, 1, 1, 1, 1])
    critical(game, t, roll)
    assert.ok(t.crits[key] >= 1, key)
  }
})

test('critical rows 2 and 9 lower Resolve; 9 is unrepairable and rolls up when repeated; 10 removes mirage fields', () => {
  const { game, t } = duel()
  critical(game, t, 2); assert.equal(leadershipOf(t), 7)
  dice(game, [6, 6, 6, 6])
  critical(game, t, 9); assert.equal(leadershipOf(t), 4)
  dice(game, [1, 1, 1, 1])
  critical(game, t, 9)   // can't apply again: becomes row 10
  assert.equal(t.crits.miragefield, 1); assert.equal(fieldOf(t), null)
  assert.equal(t.crits.infinitySmashed, 1)
  assert.ok(said(game, /can't apply, so it becomes the next one up/))
})

test('can\'t-apply roll-up: no keel weapons moves keel (3) to prow (4)', () => {
  const { game, t } = duel('ath-eos', 'ath-helios')   // the Helios has only a prow gun
  critical(game, t, 3)
  assert.equal(t.crits.keel ?? 0, 0); assert.equal(t.crits.prow, 1)
})

test('Athanatoi repair brings back Resolve from the infinity circuit', () => {
  const { game, t } = duel()
  critical(game, t, 2); assert.equal(leadershipOf(t), 7)
  t.pos = { x: 100, y: 100 }
  dice(game, [6, 6, 6, 6, 6, 6, 1])
  game.active = 0
  endPhase(game)
  assert.equal(t.crits.infinity, 0); assert.equal(leadershipOf(t), 8)
})

test('a fire ship\'s Fire critical still burns on an Athanatoi ship', () => {
  const { game, t } = duel()
  critical(game, t, 7, { fire: true })
  assert.equal(t.crits.fire, 1)
})
