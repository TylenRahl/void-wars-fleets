// Guns that turn (src/battle/guns.js) and the mounts they read from the blueprint (src/view/blueprint.js).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { arcLimits, clampBearing, aim, stepGuns, release, turning, layersOf, onTable } from './guns.js'
import { blueprint } from '../view/blueprint.js'
import { SHIPS, shipById } from '../data/ships.js'

const ship = (id, uid = 1) => ({ uid, id, profile: shipById(id) })

test('every turning gun belongs to a weapon that can turn, and sits on the side it is mounted', () => {
  for (const s of SHIPS) {
    const bp = blueprint(s.id)
    if (s.id !== 'spacehulk' && s.weapons.some(w => ['battery', 'lance'].includes(w.kind)) && s.id !== 'transport' && s.id !== 'transport-dominion') assert.ok(bp.mounts.length > 0 || s.type === 'escort', `${s.id} has guns`)
    for (const m of bp.mounts) {
      const w = s.weapons[m.weapon]
      assert.ok(w && ['battery', 'lance'].includes(w.kind), `${s.id} mount ${m.layer} is ${w?.kind}`)
      if (w.loc === 'port') assert.ok(m.x < 0, `${s.id} port gun on the left`)
      if (w.loc === 'starboard') assert.ok(m.x > 0, `${s.id} starboard gun on the right`)
      assert.ok(m.tx >= bp.box.x - 1 && m.tx <= bp.box.x + bp.box.w + 1 && m.ty >= bp.box.y - 1 && m.ty <= bp.box.y + bp.box.h + 1, `${s.id} tip inside the picture`)
      const lim = arcLimits(w)
      assert.ok(!lim || (m.rest >= lim.lo && m.rest <= lim.hi), `${s.id} ${w.loc} ${w.kind} rests inside its arc: ${m.rest}`)
      assert.ok(bp.parts.some(p => p.l === m.layer), `${s.id} gun ${m.layer} has parts`)
    }
    assert.ok(!bp.parts.some(p => p.f === 'mark' || 'm' in p))
  }
})

test('a gun stays inside its fire arc, never going through the back of it', () => {
  assert.deepEqual(arcLimits({ arc: ['left'] }), { lo: -135, hi: -45 })
  assert.deepEqual(arcLimits({ arc: ['left', 'front', 'right'] }), { lo: -135, hi: 135 })
  assert.equal(arcLimits({ arc: 'all' }), null)
  assert.equal(clampBearing(-80, { lo: -135, hi: -45 }), -80)
  assert.equal(clampBearing(10, { lo: -135, hi: -45 }), -45)
  assert.equal(clampBearing(170, { lo: -135, hi: -45 }), -135)
  assert.equal(clampBearing(-170, { lo: -135, hi: 135 }), -135)
})

test('a broadside aims at its target, waits for the turn, fires from its tip, then swings back', () => {
  const lantern = ship('lantern'), port = lantern.profile.weapons.findIndex(w => w.loc === 'port' && w.kind === 'battery')
  const drawn = { x: 50, y: 50, f: -90 }   // pointing up the table, so port is to the left
  const r = aim(lantern, port, drawn, { x: 20, y: 30 }, 'svg')
  assert.ok(r.ms > 0, 'it has to turn'); assert.ok(r.tips.length >= 2)
  assert.ok(r.tips.every(t => t.x < 50), 'tips on the port side')
  assert.ok(turning())
  const moved = layersOf(lantern, 'svg').guns.filter(g => g.turn !== 0).length
  assert.equal(moved, 0, 'not yet stepped')
  stepGuns(5)
  const g = layersOf(lantern, 'svg').guns.find(x => x.turn !== 0)
  assert.ok(g, 'turned'); assert.ok(g.turn > 0 && g.turn < 45, `towards the bow side, ${g.turn}`)
  release(); stepGuns(5); stepGuns(0.01)
  assert.equal(turning(), false)
})

test('onTable: the picture\'s top is the ship\'s bow', () => {
  const fr = { cx: 0, cy: 0, scale: 1 }
  const bow = onTable(fr, { x: 10, y: 10 }, 0, 0, -5), star = onTable(fr, { x: 10, y: 10 }, 0, 3, 0)
  assert.ok(Math.abs(bow.x - 15) < 1e-9 && Math.abs(bow.y - 10) < 1e-9)
  assert.ok(Math.abs(star.y - 13) < 1e-9, 'facing +x, starboard is +y')
})
