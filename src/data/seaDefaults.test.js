// Tests for data/seaDefaults.js and the default sea islands: each default sea fleet is legal by its own fleet list inside 500 points, and the islands (rules/terrain.js)
// are point-symmetric and leave the set-up zones clear.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SEA_DEFAULT_FLEETS, SEA_DEFAULT_POINTS, seaDefaultFleet } from './seaDefaults.js'
import { SEA_FLEETS } from '../skin.js'
import { checkFleet, fleetPoints } from '../rules/fleet.js'
import { hasLists, resolveShipId } from './fleetLists.js'
import { SEA_DEFAULT_ISLANDS, seaDefaultBattlezone, shapeGap, rollBattlezone } from '../rules/terrain.js'
import { createRng } from '../rules/dice.js'
import { SEA_TABLE } from '../rules/game.js'

// the set-up page's form to the list checkFleet takes, as battle.js fleetList does for these fleets
function asList (f) {
  const flagged = f.ships.findIndex(x => x.flag)
  const list = { fleet: f.fleet, ships: f.ships.map(x => x.id), commander: f.cmd || null, rerolls: f.rerolls ?? 0, marks: f.marks ?? [], lords: [],
    escortSquadrons: f.squads.map(q => f.ships.map((x, i) => x.squad === q ? i : -1).filter(i => i >= 0)), capitalSquadrons: [] }
  if (hasLists(f.fleet)) {
    list.list = f.list
    list.ships = f.ships.map(x => resolveShipId(f.fleet, x.id, x.picks))
    if (flagged >= 0) list.commanderOn = flagged
    list.picks = f.ships.map(x => x.picks ?? [])
    list.upgrades = Object.fromEntries(f.ships.map((x, i) => [i, x.up ?? []]).filter(([, u]) => u.length))
  } else if (f.fleet === 'freemen') list.commanderOn = Math.max(0, flagged)
  return list
}

test('every sea race has a default fleet, legal by its fleet list and inside 500 points', () => {
  for (const fleet of SEA_FLEETS) {
    const d = seaDefaultFleet(fleet)
    assert.ok(d, `${fleet} has a default fleet`)
    const list = asList(d)
    assert.deepEqual(checkFleet(list, SEA_DEFAULT_POINTS), [], `${SEA_DEFAULT_FLEETS[fleet].name}: ${fleetPoints(list)} points`)
    assert.ok(fleetPoints(list) >= 450, `${fleet} uses most of the points (${fleetPoints(list)})`)
  }
})

test('a default fleet is handed out as a copy', () => {
  const a = seaDefaultFleet('freemen'); a.ships.pop()
  assert.equal(seaDefaultFleet('freemen').ships.length, 6)
})

test('the default islands: the same for both sides, clear of the set-up zones, on the sea table, wide channels', () => {
  const { w: W, h: H } = SEA_TABLE
  const key = s => [s.t, s.r ?? 0, s.rx ?? 0, s.ry ?? 0, s.rot ?? 0].join()
  const ext = s => s.r ?? Math.max(s.rx, s.ry)
  for (const s of SEA_DEFAULT_ISLANDS) {
    assert.ok(SEA_DEFAULT_ISLANDS.some(o => key(o) === key(s) && Math.abs(o.x - (W - s.x)) < 1e-9 && Math.abs(o.y - (H - s.y)) < 1e-9), `mirror of ${JSON.stringify(s)}`)
    assert.ok(s.x - ext(s) >= 0 && s.x + ext(s) <= W, 'on the table')
    for (const o of SEA_DEFAULT_ISLANDS) if (o !== s) assert.ok(Math.hypot(o.x - s.x, o.y - s.y) - ext(o) - ext(s) >= 40, 'at least 40 cm of water between islands')
  }
  assert.ok(SEA_DEFAULT_ISLANDS.length <= 5, 'few islands')
  // no island reaches into zone A (y < 30) or zone B (the last 30 cm) anywhere along the table
  for (let x = 0; x <= W; x += 1) for (const y of [30, H - 30]) assert.ok(SEA_DEFAULT_ISLANDS.every(s => shapeGap(s, { x, y }) > 0), `the zone edge at ${x},${y} is open water`)
  const z = seaDefaultBattlezone()
  assert.equal(z.terrain.length, SEA_DEFAULT_ISLANDS.length)
  assert.ok(z.terrain.every(t => t.kind === 'island'))
  z.terrain[0].shape.x = 0
  assert.equal(SEA_DEFAULT_ISLANDS[0].x, 135, 'the layout is copied, not shared')
})

test('rolled islands on the sea table: the same six areas as in space, 25 cm of water between islands', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const z = rollBattlezone(createRng(seed), { sea: true, w: SEA_TABLE.w, h: SEA_TABLE.h })
    assert.equal(z.log.filter(l => /^Area /.test(l) && /rolled \d(,|;)/.test(l)).length, 6, z.log.join(' | '))
    // a field island (an ellipse) is only put down with 25 cm of water to every island already there (terrain.js free)
    const r = t => t.shape.r ?? Math.max(t.shape.rx, t.shape.ry)
    for (const a of z.terrain) if (a.shape.t === 'ell') for (const b of z.terrain) if (b.id < a.id && b.kind === 'island')
      assert.ok(Math.hypot(a.shape.x - b.shape.x, a.shape.y - b.shape.y) - r(a) - r(b) > 25, `seed ${seed}: island ${a.id} too close to ${b.id}`)
  }
})
