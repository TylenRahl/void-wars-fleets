// The computer player (rules/computer.js): whole battles, both sides the computer, in space and at sea.
// Run by `npm test` (node:test); exports nothing.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createFleetBattle } from './fleet.js'
import { SEA_TABLE } from './game.js'
import { applyBattlezone } from './effects.js'
import { seaDefaultBattlezone, rollBattlezone } from './terrain.js'
import { playOut, nextAction, applyAction, candidateMoves, COMPUTER_DECIDE } from './computer.js'
import { listFromForm } from '../data/listForm.js'
import { SAMPLE_FLEETS, SAMPLE_POINTS } from '../data/sampleFleets.js'

function battle (a, b, seed, { sea = false } = {}) {
  const g = createFleetBattle({ seed, lists: [listFromForm(SAMPLE_FLEETS[a]), listFromForm(SAMPLE_FLEETS[b])], limit: SAMPLE_POINTS, rounds: 6, decide: COMPUTER_DECIDE })
  if (sea) { g.sea = true; g.table = { ...SEA_TABLE }; applyBattlezone(g, seaDefaultBattlezone()) }
  else applyBattlezone(g, rollBattlezone(g.rng, { w: g.table.w, h: g.table.h }))
  return g
}
const lines = g => g.log.map(l => l.text)

for (const [label, a, b, sea] of [['space, Concord v Rukka', 'concord', 'rukka', false], ['sea, Human fleet v Orc fleet', 'freemen', 'rukka', true]]) {
  test(`${label}: five seeded battles play to the end with no error`, () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const g = battle(a, b, seed, { sea })
      playOut(g)
      assert.ok(g.over, `seed ${seed} ended (round ${g.round}, phase ${g.phase})`)
      assert.ok(!lines(g).some(t => /^Error/.test(t)), `seed ${seed}: no engine error`)
      assert.ok(lines(g).some(t => /fires|hits/i.test(t)), `seed ${seed}: somebody fired`)
      assert.ok(g.ships.some(s => s.damage > 0), `seed ${seed}: some damage was done`)
    }
  })
}

test('the same seed plays the same battle', () => {
  const one = battle('concord', 'rukka', 7), two = battle('concord', 'rukka', 7)
  playOut(one); playOut(two)
  assert.deepEqual(lines(one), lines(two))
})

test('every move the computer makes is one checkMove allows', () => {
  const g = battle('concord', 'rukka', 3)
  let moves = 0
  while (!g.over && g.round < 4) {
    const a = nextAction(g, g.phase === 'setup' ? g.placing : g.active) ?? (g.phase === 'setup' || g.phase === 'ordnance' ? nextAction(g, 1 - (g.phase === 'setup' ? g.placing : g.active)) : null)
    if (!a) { playOutPhase(g); continue }
    if (a.kind === 'move') { const s = g.ships.find(x => x.uid === a.uid); assert.ok(candidateMoves(g, s).some(c => JSON.stringify(c.legs) === JSON.stringify(a.legs))); moves++ }
    const r = applyAction(g, a)
    if (a.kind === 'move') assert.ok(r.ok, r.reason)
  }
  assert.ok(moves > 10)
})
import { nextPhase } from './turn.js'
function playOutPhase (g) { nextPhase(g) }
