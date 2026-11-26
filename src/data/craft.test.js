// Tests for data/craft.js: the attack craft rows agree with the drawn craft in concordShips.js and the Freemen/Dominion ORDNANCE list in ships.js.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CRAFT_ROWS, craftRows, hasLiveCraft } from './craft.js'
import { ORDNANCE } from './ships.js'
import { ATHANATOI_CRAFT, CONCORD_CRAFT, RUKKA_CRAFT, THNITOI_CRAFT, PHAGE_CRAFT, ISOS_CRAFT } from './concordShips.js'
import { NEW_FLEET_SHIPS } from './fleets.js'

test('the Freemen and Dominion rows agree with ORDNANCE in ships.js', () => {
  for (const o of ORDNANCE.filter(o => ['fighter', 'bomber', 'assault boat'].includes(o.kind))) {
    const r = CRAFT_ROWS.find(x => x.id === o.id)
    assert.ok(r, o.id); assert.equal(r.fleet, o.fleet); assert.equal(r.kind, o.kind); assert.equal(r.speed, o.speed)
  }
})
test('every row\'s id is a drawn craft id of its fleet, with the same speed', () => {
  const drawn = { athanatoi: ATHANATOI_CRAFT, concord: CONCORD_CRAFT, rukka: RUKKA_CRAFT, thnitoi: THNITOI_CRAFT, phage: PHAGE_CRAFT, isos: ISOS_CRAFT }
  for (const r of CRAFT_ROWS.filter(r => drawn[r.fleet])) {
    const d = drawn[r.fleet].find(x => x.id === r.id)
    assert.ok(d, `${r.id} is not drawn`); assert.equal(d.speed, r.speed, r.id)
  }
})
test('only the Athanatoi (of the new fleets) have live craft, so only their bays are live', () => {
  assert.ok(hasLiveCraft('athanatoi'))
  assert.ok(hasLiveCraft('concord'))
  assert.ok(hasLiveCraft('isos'))
  assert.ok(hasLiveCraft('phage'))
  assert.ok(hasLiveCraft('rukka'))
  assert.ok(hasLiveCraft('thnitoi'))
  for (const f of ['katharos']) assert.ok(!hasLiveCraft(f), f)
  const live = fleet => NEW_FLEET_SHIPS.filter(s => s.fleet === fleet).flatMap(s => s.weapons).filter(w => w.book === 'bays' || w.kind === 'bays')
  assert.ok(live('athanatoi').length && live('athanatoi').every(w => w.kind === 'bays'))
  assert.deepEqual(craftRows('athanatoi').map(r => [r.kind, r.speed]), [['fighter', 30], ['bomber', 20], ['assault boat', 25], ['torpedo bomber', 20]])
})
