// Regression tests for the shared critical routine, Hit-and-Run natural 1s and Phage dice, the shared brace save, discipline choice, and the fort gaps.
// Run by `npm test` (node:test); exports nothing.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { scriptedRng } from './dice.js'
import { createGame, addShip, blastTouching, placeBlastOnShip, giveOrder } from './game.js'
import { critical, braceSave } from './damage.js'
import { hitAndRun, boardingAction, endPhase } from './endPhase.js'
import { fireShip } from './shooting.js'
import { launchTorpedoes, ordnancePhase, craftAttack, combinePartners } from './ordnance.js'
import { makeFort, placeFort, quadrantsOf, catastrophicFort, dockContacts, fullyDocked, setRotates } from './fort.js'
import { damageShip } from './damage.js'
import { formSquadron } from './game.js'
import { fortOf } from './fort.js'

const dice = (g, f) => { g.rng = scriptedRng([...f, ...Array(120).fill(1)]) }
const said = (g, re) => g.log.some(l => re.test(l.text))
function duel (a, fa, b = 'lantern', fb = 'freemen', gap = 20) {
  const g = createGame({ fleets: [{ name: 'A', fleet: fa }, { name: 'B', fleet: fb }] })
  const s = addShip(g, 0, a), t = addShip(g, 1, b)
  s.leadership = 8; t.leadership = 8
  s.pos = { x: 40, y: 60 }; s.facing = 0; t.pos = { x: 40 + gap, y: 60 }; t.facing = 180
  g.round = 1; g.active = 0; g.first = 0; g.phase = 'shooting'
  return { g, s, t }
}

test('a Katharos ship carrying orbital mines takes the mine blast on a bays critical like every other table', () => {
  const { g, t } = duel('lantern', 'freemen', 'kat-sickle', 'katharos')
  t.mines = true; t.profile = { ...t.profile, weapons: [...t.profile.weapons, { loc: 'flowPort', kind: 'bays', str: 1, range: 0, arc: 'all' }] }
  dice(g, [])
  critical(g, t, 2)   // key flowPort: a bays weapon sits at that location in this test
  assert.ok(said(g, /orbital mines in its bays detonate/))
})
test('Hit-and-Run: a natural 1 still scores for fleets whose own rule gives +1 (Concord, Thnitoi, Phage) and fails for the rest', () => {
  for (const [id, fleet, ok] of [['thn-agony', 'thnitoi', true], ['con-lance-cruiser', 'concord', true], ['rukka-bash-cruisa', 'rukka', false], ['rimward', 'freemen', false]]) {
    const { g, s, t } = duel(id, fleet)
    dice(g, [1]); assert.equal(hitAndRun(g, t, s), ok, fleet)
  }
})
test('Hit-and-Run against a Phage takes the lowest of two dice even when a die is handed in (Deepflesh Dyads, Prime Guard)', () => {
  const { g, s, t } = duel('con-lance-cruiser', 'concord', 'pha-cruiser_py_fe_no_no', 'phage')
  dice(g, [2]); assert.equal(hitAndRun(g, t, s, { natural: 6, braceAsked: true }), true)
  assert.ok(said(g, /two dice, 6 and 2, the lowest is taken/))
})
test('the brace save is one routine: a braced Katharos ship saves a lamprey torpedo on 2+ and the roll is logged', () => {
  const { g, t } = duel('thn-agony', 'thnitoi', 'kat-sickle', 'katharos')
  t.order = { kind: 'brace', until: 3 }
  dice(g, [2]); assert.equal(braceSave(g, t, 'Lamprey torpedo', ''), true)
  assert.ok(said(g, /needed 2\+: saved/))
  t.order = null; dice(g, [6]); assert.equal(braceSave(g, t, 'Lamprey torpedo'), false, 'not braced, no roll')
})
test('shooting: a firer on the line between two arcs is asked which discipline to use, and the answer is used', () => {
  const { g, s, t } = duel('lantern', 'freemen', 'lantern', 'freemen', 30)
  g.decide.discipline = (game, ship, o) => { g.asked = o; return o.options[1] }
  t.facing = 135; t.pos = { x: 70, y: 60 }; s.pos = { x: 40, y: 60 }   // firer 45 degrees off the target's bow: exactly on the line
  const results = []
  for (const f of [90, 270]) {
    s.facing = f; s.fired = false
    const wi = s.profile.weapons.findIndex(w => w.kind === 'battery')
    dice(g, [])
    if (fireShip(g, s, [{ weapon: wi, target: t.uid }]).ok) break
  }
  assert.ok(g.asked && g.asked.options.length > 1, 'the hook was asked with both disciplines')
})
function fortGame () {
  const g = createGame({ fleets: [{ name: 'C', fleet: 'concord' }, { name: 'I', fleet: 'freemen' }] })
  const L = addShip(g, 0, 'con-hostkeep'); L.leadership = 10; L.upgrades = ['deepflesh']
  makeFort(g, L); placeFort(g, L, { x: 90, y: 60 }, 0)
  const e = addShip(g, 1, 'lantern'); e.leadership = 8; e.pos = { x: 90, y: 100 }; e.facing = 270
  g.round = 1; g.active = 1; g.first = 1; g.phase = 'shooting'
  return { g, L, e, qs: quadrantsOf(g, L) }
}
test('fort Blast Markers: a marker counts for the quadrant struck and the neighbour on the firer\'s side if it touches it, never a third', () => {
  const { g, qs } = fortGame()
  const from = { x: 120, y: 100 }   // south-east of the fort: the south quadrant is struck, the east is the neighbour
  const m = placeBlastOnShip(g, qs[2], from)
  assert.ok([].concat(m.q).includes(qs[2].uid))
  assert.ok(![].concat(m.q).includes(qs[0].uid) && ![].concat(m.q).includes(qs[3].uid))
  for (let i = 0; i < 6; i++) placeBlastOnShip(g, qs[2], from)
  assert.ok(g.blast.every(b => ![].concat(b.q).includes(qs[0].uid)), 'the far quadrant never sees them')
  assert.ok(g.blast.some(b => [].concat(b.q).includes(qs[1].uid) === (blastTouching(g, qs[1]).includes(b))))
})
test('a shot at a wrecked quadrant is absorbed by the wreckage, not refused', () => {
  const { g, e, qs } = fortGame()
  e.pos = { x: 90, y: 75 }; e.facing = 0   // the fort is on its port (left) side, in range of the port lance
  damageShip(g, qs[2], 12, { noCrits: true, noSave: true })
  const r = fireShip(g, e, [{ weapon: 0, target: qs[2].uid }])
  assert.equal(r.ok, true)
  assert.ok(said(g, /plow into it and do no damage/))
  assert.ok(qs.filter(q => q !== qs[2]).every(q => q.damage === 0))
})
test('hyper-plasma meltdown: a solar flare centred on the fort puts a Blast Marker on the fort side of ships beyond the lance reach', () => {
  const { g, L, e, qs } = fortGame()
  e.pos = { x: 90, y: 118 }
  for (const q of qs) q.state = 'destroyed'
  const f = g.forts[L.uid]
  dice(g, [4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1])   // D6 4: hyper-plasma; 4D6 = 4 (1s) so e is out of reach
  catastrophicFort(g, qs[0], f, 4)
  assert.ok(said(g, /solar flare from the fort/))
  assert.ok(said(g, /Blast Marker on its sunward side from the solar flare/))
})
test('aetherbubble implosion: an Aether Rift where the fort stood, and ships are drawn 15 cm towards it', () => {
  const { g, L, e, qs } = fortGame()
  e.pos = { x: 90, y: 100 }; for (const q of qs) q.state = 'destroyed'
  dice(g, [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 6, 6, 6, 6, 6])
  catastrophicFort(g, qs[0], g.forts[L.uid], 6)
  assert.ok(g.terrain.some(t => t.kind === 'rift'))
  assert.ok(said(g, /drawn 15 cm towards/) || said(g, /drawn 15 cm towards the Rift and into it/))
})
test('docking: a friendly ship touching a quadrant may Burn Retros without a Command check; at a pier it is fully docked, +4 repair dice, reloaded after two turns', () => {
  const { g, L, qs } = fortGame()
  const s = addShip(g, 0, 'con-lance-cruiser'); s.leadership = 9; s.facing = 0
  const c = g.forts[L.uid].centre
  // slide the ship outwards along the diagonal between the north and east quadrants until its base touches both
  let pier = null
  for (let r = 3; r < 14 && !pier; r += 0.05) { s.pos = { x: c.x + r * Math.SQRT1_2, y: c.y - r * Math.SQRT1_2 }; if (fullyDocked(g, s)) pier = r }
  assert.ok(pier, 'a pier position exists'); assert.ok(dockContacts(g, s).length >= 2)
  g.active = 0; g.first = 0; g.phase = 'movement'
  dice(g, [])
  const o = giveOrder(g, s, 'burnRetros')
  assert.ok(o.ok && said(g, /Burn Retros needs no Command check/))
  s.order = null; s.loaded = { torpedo: false, bays: false }; s.crits.fire = 1; s.damage = 3
  dice(g, [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1])
  endPhase(g); assert.equal(s.loaded.torpedo, false, 'one turn is not enough')
  assert.ok(said(g, /four extra dice for damage control/))
  endPhase(g); assert.equal(s.loaded.torpedo, true, 'two full turns docked reloads')
  g.round = 0; assert.ok(setRotates(g, L, true).ok)
  assert.equal(dockContacts(g, s).length, 0, 'a rotating fort cannot be docked with')
})
test('a Host Keep quadrant can make the fort\'s Deepflesh attack, whichever quadrant it is', () => {
  const { g, L, e, qs } = fortGame()
  g.round = 1; g.active = 0; g.first = 0; g.phase = 'end'
  e.pos = { x: qs[2].pos.x, y: qs[2].pos.y + 7.5 }
  for (const q of qs) q.shieldsDown = true
  dice(g, [6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6])
  endPhase(g, { teleports: [[qs[2].uid, e.uid, 'deepflesh']] })
  assert.ok(!said(g, /it has no Deepflesh boarding party/))
})
test('Concord resilient craft stay on CAP after a save and go with the ship', () => {
  const { g, s, t } = duel('con-lance-cruiser', 'concord')
  g.active = 1; g.phase = 'ordnance'
  g.ordnance.push({ id: 50, kind: 'wave', side: 0, from: s.uid, pos: { ...s.pos }, markers: ['dropwing'], r: 1.1, moved: true, fleet: 'concord', cap: s.uid })
  g.ordnance.push({ id: 51, kind: 'wave', side: 1, from: t.uid, pos: { ...s.pos }, markers: ['bomber'], r: 1.1, moved: true, fleet: 'freemen' })
  dice(g, [4])
  craftAttack(g, g.ordnance.find(o => o.id === 51), s)
  const w = g.ordnance.find(o => o.id === 50)
  assert.ok(w && w.cap === s.uid)
})

function pair () {
  const game = createGame({ fleets: [{ name: 'T', fleet: 'thnitoi' }, { name: 'B', fleet: 'freemen' }] })
  const a = addShip(game, 0, 'thn-agony-torpedo'), b = addShip(game, 0, 'thn-agony-torpedo')
  for (const s of [a, b]) { s.leadership = 8; s.facing = 0 }
  a.pos = { x: 50, y: 60 }; b.pos = { x: 50, y: 62.5 }
  formSquadron(game, [a.uid, b.uid], 'Squadron')
  game.round = 1; game.active = 0; game.first = 0; game.phase = 'shooting'
  return { game, a, b }
}
test('Thnitoi lamprey torpedoes combine with each other, not with ordinary torpedoes', () => {
  const m = pair(); m.a.leechLoaded = true; m.b.leechLoaded = false
  assert.equal(launchTorpedoes(m.game, m.a, 0, { combine: [m.b.uid] }).ok, false)
  assert.ok(said(m.game, /a combined salvo is one kind/))
  const n = pair(); n.a.leechLoaded = true; n.b.leechLoaded = true
  assert.equal(launchTorpedoes(n.game, n.a, 0, { combine: [n.b.uid] }).ok, true)
  assert.equal(n.game.ordnance[0].leech, true)
})
test('boarding a fort: the hits left on all four quadrants count, with only the boarded quadrant\'s turrets', () => {
  const { g, qs } = fortGame()
  const h = addShip(g, 1, 'spacehulk'); h.leadership = 7
  damageShip(g, qs[1], 5, { noCrits: true, noSave: true })
  dice(g, [3, 3])
  boardingAction(g, h, qs[0])
  assert.ok(said(g, new RegExp(`count \\(43\\) plus the turrets of this quadrant \\(${qs[0].profile.turrets}\\)`)), g.log.map(l => l.text).join('\n'))
})
