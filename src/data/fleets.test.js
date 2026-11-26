// Tests for data/fleets.js: the seven newer fleets have whole profiles, deploy against each other and fire, and only implemented weapons are live.
import { hasLiveCraft } from './craft.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ALL_SHIPS, SHIPS, shipById } from './ships.js'
import { NEW_FLEETS, NEW_FLEET_SHIPS, notYet } from './fleets.js'
import { blueprint, designOf } from '../view/blueprint.js'
import { checkFleet, createFleetBattle, nextToPlace, placeFleetShip } from '../rules/fleet.js'
import { canTarget, fireShip } from '../rules/shooting.js'
import { COMMANDERS } from '../rules/fleet.js'
import { createScenario } from '../rules/scenarios.js'
import { isDiceStr } from '../rules/dicestr.js'
import { FLEET_NAME } from '../rules/names.js'

test('every fleet has ships, a shown name and a commanders entry, and no ship id is used twice', () => {
  for (const f of NEW_FLEETS) {
    assert.ok(NEW_FLEET_SHIPS.some(s => s.fleet === f), f)
    assert.ok(FLEET_NAME[f], f)
    assert.ok(COMMANDERS[f], f)
  }
  assert.equal(new Set(ALL_SHIPS.map(s => s.id)).size, ALL_SHIPS.length)
  assert.equal(SHIPS.length + NEW_FLEET_SHIPS.length + 2, ALL_SHIPS.length)   // + the two Bastion star forts (data/forts.js)
})
test('every ship has a whole profile, and only rules the engine has are live', () => {
  for (const s of NEW_FLEET_SHIPS) {
    for (const k of ['hits', 'speed', 'turns', 'shields', 'turrets', 'points']) assert.equal(typeof s[k], 'number', `${s.id} ${k}`)
    assert.ok(s.armour.front && s.armour.other, s.id)
    for (const w of s.weapons) {
      if (w.kind === 'pending') { assert.ok(w.book, s.id); continue }
      assert.ok(['battery', 'lance', 'starlance', 'torpedo', 'bombardment', 'missile', 'lightning', 'starpulse', 'whip', 'ossuary', 'portal', 'pyro', 'bioplasma', 'feeder', 'claws', 'bio-torpedo', 'heavybangers', 'grabbers', 'phantom', 'harpoon', ...(hasLiveCraft(s.fleet) ? ['bays'] : [])].includes(w.kind), `${s.id} ${w.kind}`)   // bays once the fleet has live craft rows (data/craft.js)
      assert.ok(typeof w.str === 'number' || isDiceStr(w.str) || (w.str === 'special' && ['feeder', 'claws', 'grabbers'].includes(w.kind)), s.id)
      assert.ok(w.arc === 'all' || Array.isArray(w.arc), s.id)
    }
  }
})
test('a pending gun keeps its place in the list, so the drawn guns still name the right weapon', () => {
  for (const s of NEW_FLEET_SHIPS) {
    for (const m of blueprint(s.id, designOf(s.id)).mounts) assert.ok(m.weapon < s.weapons.length, s.id)
  }
  assert.deepEqual(NEW_FLEET_SHIPS.filter(s => s.fleet === 'rukka').flatMap(notYet), [], 'every Rukka gun is live')
  assert.ok(!notYet(shipById('ath-thalassa')).some(x => /sun/.test(x)), 'sailing by the sun is in (rules/sail.js)')
})
test('the new fleets go through the fleet builder without the Freemen or Dominion list rules', () => {
  assert.deepEqual(checkFleet({ fleet: 'concord', ships: ['con-lance-cruiser'], escortSquadrons: [], commander: null }, 1000), [])
})
test('any two fleets deploy, and a Concord battery fires across the table', () => {
  const pick = f => { if (f === 'thnitoi') return { name: f, fleet: f, ships: ['thn-agony', ...Array(3).fill('thn-corsair')], escortSquadrons: [[1, 2, 3]], commander: null }   // three escorts for every capital ship
    if (f === 'phage') return { name: f, fleet: f, ships: ['pha-hive', ...Array(6).fill('pha-drone')], escortSquadrons: [[1, 2, 3, 4, 5, 6]], commander: null }   // a queen ship needs six drones
    const s = NEW_FLEET_SHIPS.filter(x => x.fleet === f && x.role !== 'escort' && x.role !== 'transport').sort((a, b) => a.points - b.points)[0]; return { name: f, fleet: f, ships: [s.id], escortSquadrons: [], commander: null } }
  for (const a of NEW_FLEETS) for (const b of ['freemen', ...NEW_FLEETS]) {
    const g = createFleetBattle({ lists: [pick(a), b === 'freemen' ? { name: b, fleet: b, ships: ['lantern'], escortSquadrons: [], commander: null } : pick(b)], limit: 2000, seed: 3 })
    while (g.ships.some(s => !s.pos)) { const s = nextToPlace(g); placeFleetShip(g, s.uid, { x: 60, y: g.zones[s.side] === 'A' ? 20 : 100 }) }
    assert.equal(g.ships.length, (a === 'phage' ? 7 : a === 'thnitoi' ? 4 : 1) + (b === 'phage' ? 7 : b === 'thnitoi' ? 4 : 1))
  }
  const g = createFleetBattle({ lists: [pick('concord'), pick('isos')].map((l, i) => i ? l : { ...l, ships: ['con-lance-cruiser'] }), limit: 2000, seed: 3 })
  while (g.ships.some(s => !s.pos)) { const s = nextToPlace(g); placeFleetShip(g, s.uid, { x: 60, y: g.zones[s.side] === 'A' ? 20 : 100 }) }
  const [me, them] = g.ships
  me.pos = { x: 60, y: 60 }; me.facing = 0; them.pos = { x: 60, y: 80 }; g.active = me.side; g.phase = 'shooting'
  const weapon = me.profile.weapons.findIndex(w => w.kind === 'battery' && canTarget(g, me, w, them.pos))
  assert.ok(weapon >= 0)
  const r = fireShip(g, me, [{ by: me, weapon, target: them.uid }])
  assert.equal(r.ok, true)
})
test('a Convoy Contact the attackers cannot fill comes to nothing, so set-up never sticks', () => {
  const list = (fleet, ships) => ({ name: fleet, fleet, ships, escortSquadrons: [], commander: null })
  let seen = 0
  for (let seed = 1; seed <= 60; seed++) {
    const g = createScenario({ id: 'convoy', lists: [list('freemen', ['lantern']), list('thnitoi', [])], attacker: 1, limit: 1000, seed })
    seen += g.log.some(l => /comes to nothing/.test(l.text)) ? 1 : 0
    assert.ok(!g.contacts.some(c => c.kind === 'capital'), `seed ${seed}`)
  }
  assert.ok(seen > 0)
})
