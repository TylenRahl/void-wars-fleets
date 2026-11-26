// The board's animation hook, game.onFx (src/battle/fx.js): every event it is sent can be built (drawing only).
// Run by `npm test` (node:test); exports nothing.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { scriptedRng } from './dice.js'
import { createGame, addShip } from './game.js'
import { fireShip, fireSunburst } from './shooting.js'

test('shooting sends lance, battery, shields and explosion events to game.onFx', () => {
  const game = createGame({ fleets: [{ name: 'Freemen', fleet: 'freemen' }, { name: 'Dominion', fleet: 'dominion' }] })
  const events = []
  game.onFx = e => events.push(e.kind)
  const m = addShip(game, 1, 'malice'), s = addShip(game, 0, 'sword'), l = addShip(game, 0, 'lantern')
  for (const x of [m, s, l]) x.leadership = 8
  m.pos = { x: 60, y: 60 }; m.facing = 90; s.pos = { x: 60, y: 70 }; s.facing = 0; l.pos = { x: 60, y: 90 }; l.facing = 0
  game.round = 1; game.active = 1; game.phase = 'shooting'
  game.rng = scriptedRng([4, 5, ...Array(30).fill(6)])
  assert.ok(fireShip(game, m, [{ weapon: m.profile.weapons.findIndex(w => w.kind === 'lance' && w.loc === 'prow'), target: s.uid }]).ok)
  assert.ok(events.includes('lance') && events.includes('shields') && events.includes('explode'), events.join(','))
})

test('the sunburst cannon sends its landing point', () => {
  const game = createGame({ fleets: [{ name: 'Freemen', fleet: 'freemen' }, { name: 'Dominion', fleet: 'dominion' }] })
  const got = []
  game.onFx = e => got.push(e)
  const d = addShip(game, 0, 'cannonade'); d.leadership = 8; d.pos = { x: 20, y: 60 }; d.facing = 0
  game.round = 1; game.active = 0; game.phase = 'shooting'
  fireSunburst(game, d, { x: 90, y: 60 })
  assert.equal(got[0]?.kind, 'sunburst')
})
