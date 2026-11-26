// The rewind behind the in-game prompts: an action stopped by a question and run again rolls the same dice (src/battle/replay.js).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { snapshot, restore, createAsker, Ask } from './replay.js'
import { createGame, addShip, giveOrder } from '../rules/game.js'
import { fireShip } from '../rules/shooting.js'
import { endPhase } from '../rules/endPhase.js'
import { scriptedRng } from '../rules/dice.js'

function duel (seed, decide) {
  const game = createGame({ fleets: [{ name: 'Freemen', fleet: 'freemen' }, { name: 'Dominion', fleet: 'dominion' }], seed, decide })
  const m = addShip(game, 1, 'malice'), l = addShip(game, 0, 'lantern')
  m.leadership = 8; l.leadership = 8
  m.pos = { x: 60, y: 60 }; m.facing = 90; l.pos = { x: 60, y: 70 }; l.facing = 0
  game.round = 1; game.active = 1; game.first = 1; game.phase = 'shooting'
  return { game, m, l }
}
const shot = m => [{ weapon: m.profile.weapons.findIndex(w => w.kind === 'lance' && w.loc === 'prow'), target: 2 }]

test('a volley stopped by Brace and replayed with the answer ends exactly like one answered at once', () => {
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) for (const yes of [true, false]) {
    const plain = duel(seed, { brace: () => yes })
    fireShip(plain.game, plain.m, shot(plain.m))
    const asker = createAsker(), asked = [], d = duel(seed, { brace: (g, s, a) => asker.ask({ what: a.what }) })
    const snap = snapshot(d.game)
    for (;;) {
      asker.begin()
      try { fireShip(d.game, d.m, shot(d.m)); break } catch (e) {
        if (!(e instanceof Ask)) throw e
        asked.push(e.question.what); restore(d.game, snap); asker.answer(yes)
      }
    }
    assert.deepEqual(asked, ['shooting'])
    assert.deepEqual(d.game.log.map(l => l.text), plain.game.log.map(l => l.text), `seed ${seed}`)
    assert.equal(d.l.damage, plain.l.damage)
    assert.deepEqual(d.game.blast.length, plain.game.blast.length)
  }
})

test('restore puts the same ship objects back, with fields added during the action gone, and the dice rewound', () => {
  const { game, m, l } = duel(3, {})
  const snap = snapshot(game), first = game.rng()
  game.phase = 'movement'; m.fired = true; m.extra = 1; game.added = 2; game.log.push({ text: 'x' }); game.blast.push({ id: 9, x: 1, y: 1 })
  giveOrder(game, m, 'lockOn')
  restore(game, snap)
  assert.equal(game.ships[0], m); assert.equal(game.ships[1], l)
  assert.equal(m.fired, false); assert.equal('extra' in m, false); assert.equal('added' in game, false)
  assert.equal(game.phase, 'shooting'); assert.equal(game.blast.length, 0); assert.equal(m.order, null)
  assert.equal(game.rng(), first)
})

test('the player chooses what a 6 repairs, and the End Phase replays to that choice', () => {
  const asker = createAsker(), asked = []
  const d = duel(5, { repair: (g, ship, left) => { asked.push(left); return asker.ask({ left }) } })
  d.l.crits.port = 1; d.l.crits.engine = 1
  d.game.phase = 'end'; d.game.active = 0
  const faces = [6, 1, 1, 1, 1, 1, 1, 1, 3]
  d.game.rng = scriptedRng(faces)
  try { endPhase(d.game); assert.fail('it should ask') } catch (e) { assert.ok(e instanceof Ask) }
  assert.deepEqual(asked[0], ['port', 'engine'])
  d.l.crits.port = 1; d.game.rng = scriptedRng(faces); asker.begin(); asker.answer('engine'); asker.begin()
  endPhase(d.game)
  assert.equal(d.l.crits.engine, 0, 'the one chosen'); assert.equal(d.l.crits.port, 1, 'not the other')
})
