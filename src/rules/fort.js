// The Bastion class star fort and the Concord Host Keep: a base of four quadrants round a central basilica.
// Exports makeFort, placeFort, setupForts, fortFront, fortBoardings, fortCritical, quadrantDown, catastrophicFort,
// fullyDocked, dockUpkeep, fortBlastClear and many small helpers; used by damage.js, shooting, ordnance, movement,
// the turn, the end phase, fleet.js, scenarios.js and the battle page (game.js reaches it through `late` hooks).
//
// HOW IT IS BUILT. Each quadrant is an ordinary game ship (profile.fort is set; 12 hits, 4 shields, 4 turrets), standing as a large base
// (r 3 cm) with its centre 3 x sqrt 2 = 4.24 cm from the fort's centre along north, east, south or west, so that the four bases touch their
// neighbours back to back. The base size is the game's own choice. A quadrant's facing is
// outward, so its "Quadrant" fire arc is the 90 degree front arc. Everything about one quadrant (own hits, shields, Blast
// Markers, orders, criticals, turrets, ramming, Hit-and-Run) then comes from the ordinary rules; this file adds what is different:
// aiming at the fort (fortFront), rotation, the Basilica weapons, the fort critical and catastrophic tables, destruction into an
// asteroid field, one Blast Marker clear for the whole fort, no boarding but by a derelict.
import { d6, d3, rollDice, sum } from './dice.js'
import { dist, along, angleTo, norm } from './geometry.js'
import { firstTouch, touchesBase } from './terrain.js'
import { late as gameLate, say, addShip, shipByUid, isBraced, orderOf, baseR, onTable, offerBrace, placeBlastCluster, diceText as fmt } from './game.js'

export const QUADRANTS = ['north', 'east', 'south', 'west']
const DIRS = [270, 0, 90, 180]   // table y grows downward (rules/geometry.js), so "north" is 270 degrees
const OFFSET = 3 * Math.SQRT2

export const isFort = s => !!s?.fort
export const fortOf = (game, s) => game.forts?.[s?.fort?.id] ?? null
export const quadrantsOf = (game, s) => fortOf(game, s)?.uids.map(u => shipByUid(game, u)) ?? []
/** The fort's other quadrants still standing. */
export const standing = (game, s) => quadrantsOf(game, s).filter(q => q.state === 'active')

/** Turn a leader ship whose profile has `fort: true` into a fort: three more quadrants are added beside it (none on the table until placed). */
export function makeFort (game, leader) {
  game.forts ??= {}
  const f = { id: leader.uid, side: leader.side, uids: [leader.uid], rot: 0, rotates: false, rotateDir: 1, siloLoaded: true, basilicaLost: false, rerolls: 0, placed: false }
  game.forts[f.id] = f
  leader.fort = { id: f.id, q: 0 }
  leader.name = `${leader.profile.name} (${QUADRANTS[0]} quadrant)`
  for (let k = 1; k < 4; k++) {
    const s = addShip(game, leader.side, leader.id, { name: `${leader.profile.name} (${QUADRANTS[k]} quadrant)` })
    s.fort = { id: f.id, q: k }
    s.profile = leader.profile
    s.leadership = leader.leadership; s.upgrades = (leader.upgrades ?? []).filter(u => !['deepflesh', 'honour'].includes(u)); s.commander = null
    f.uids.push(s.uid)
  }
  return f
}
/** Put the whole fort down with its centre at p, turned by `rot` degrees. Quadrants are then fixed in place (speed 0). */
export function placeFort (game, leader, p, rot = 0) {
  const f = fortOf(game, leader)
  f.centre = { ...p }; f.rot = rot; f.placed = true
  layOut(game, f)
}
function layOut (game, f) {
  f.uids.forEach((u, k) => { const s = shipByUid(game, u); s.facing = norm(DIRS[k] + f.rot) < 0 ? norm(DIRS[k] + f.rot) + 360 : norm(DIRS[k] + f.rot); s.pos = along(f.centre, s.facing, OFFSET) })
}

/** Before the game the owner decides whether the fort rotates; once decided it cannot change. */
export function setRotates (game, leader, yes) {
  const f = fortOf(game, leader)
  if (game.round > 0 || f.rotatesSet) return { ok: false, reason: 'the decision is made before the game and cannot be changed' }
  f.rotates = !!yes; f.rotatesSet = true
  say(game, `${leader.profile.name}: ${yes ? 'will rotate 45 degrees at the start of its owner\'s Manoeuvre Phase each turn, and so cannot be docked with' : 'will not rotate'}`)
  return { ok: true }
}
/** A rotating fort turns 45 degrees, once a game turn, at the start of its owner's Manoeuvre Phase, always the same way. Blast Markers stay where they are. */
export function rotateForts (game) {
  for (const f of Object.values(game.forts ?? {})) {
    if (!f.rotates || !f.placed || f.side !== game.active || f.rotatedRound === game.round) continue
    f.rotatedRound = game.round
    f.rot += 45 * f.rotateDir
    layOut(game, f)
    say(game, `${shipByUid(game, f.uids[0]).profile.name} rotates 45 degrees`)
  }
}

/** Which quadrant a shot hits: draw a line from the firer's stem to the fort's centre; it is the quadrant whose outward arc holds the firer. */
export function fortFront (game, target, from) {
  if (!target?.fort || !from) return target
  const f = fortOf(game, target)
  if (!f?.centre) return target
  const b = angleTo(f.centre, from)
  let best = null, bestD = 1e9
  for (const q of quadrantsOf(game, target)) { const d = Math.abs(norm(b - q.facing)); if (d < bestD - 1e-9) { best = q; bestD = d } }   // on a junction the first (north-most) is taken
  return best ?? target
}
// ---------------- boarding by the fort ----------------
/** Boarding by the fort: in its own End Phase the Bastion can board an enemy in base contact, and picks how
 * many of its quadrants take part. The quadrants in contact with the enemy take part first, then the others with the most hits left;
 * the boarding value is the hits left on those quadrants (the enemy adds its turrets), and any damage and criticals fall on the quadrant in contact
 * (only the quadrant actually boarded is affected). The choice is game.decide.fortBoard(game, leader, { enemy, contact, max, values }) -> a number of
 * quadrants 0..max (0 = no boarding); headless it is max. `boardingAction` and `boardingSave` come from endPhase.js (circular import). */
export function fortBoardings (game, boardingAction, boardingSave) {
  for (const f of Object.values(game.forts ?? {})) {
    if (f.side !== game.active || !f.placed) continue
    for (const e of game.ships) {
      if (e.state !== 'active' || e.side === f.side || e.fort || !e.pos || e.lockedWith) continue   // a locked pair fights on through the usual pairs
      const qs = f.uids.map(u => shipByUid(game, u)).filter(q => q.state === 'active' && !q.lockedWith)
      // at sea (Tides of the Archipelago house rule, movement.js boardReach: 15 cm) a fort boards from range, any way round (it has no port
      // or starboard); ships can't touch it there, they collide
      const reach = game.sea ? SEA_FORT_REACH : TOUCH
      const gapOf = q => dist(q.pos, e.pos) - baseR(q) - baseR(e)
      // in space every quadrant listed touches, so most hits left leads; at sea the nearest leads (it is the one boarded), then most hits
      const contact = qs.filter(q => gapOf(q) <= reach + 1e-6).sort((a, b) => (game.sea ? gapOf(a) - gapOf(b) : 0) || hitsLeft(b) - hitsLeft(a))
      if (!contact.length || e.state !== 'active') continue
      const order = [...contact, ...qs.filter(q => !contact.includes(q)).sort((a, b) => hitsLeft(b) - hitsLeft(a))]
      const values = order.map((_, k) => order.slice(0, k + 1).reduce((a, q) => a + hitsLeft(q), 0))
      const lead = contact[0], leader = shipByUid(game, f.uids[0])
      let n = game.decide.fortBoard?.(game, leader, { enemy: e, contact: lead, max: order.length, values }) ?? order.length
      n = Math.max(0, Math.min(order.length, Math.floor(Number(n)) || 0))
      if (!n) { say(game, `${leader.profile.name} does not board ${e.name}`); continue }
      if (e.marks?.includes('endurance')) { say(game, `${e.name} bears the Endurance Protocol and may not be boarded`); continue }
      if (!boardingSave(game, lead, e)) continue
      lead.fortBoardHits = values[n - 1]
      say(game, `${lead.name} boards ${e.name} with ${n} quadrant${n === 1 ? '' : 's'}: boarding value ${values[n - 1]} (hits left on ${order.slice(0, n).map(q => QUADRANTS[q.fort.q]).join(', ')})`)
      boardingAction(game, lead, e)
    }
  }
}
const hitsLeft = q => q.profile.hits - q.damage
const SEA_FORT_REACH = 15   // the same 15 cm as movement.js SEA_BOARD_RANGE (not imported: movement.js imports this file)

export const sameFort = (a, b) => !!a?.fort && !!b?.fort && a.fort.id === b.fort.id

// ---------------- the Basilica ----------------
export const isBasilica = w => w.loc === 'basilica'
/** The quadrant that fires the Basilica's weapons: the first still standing (they sit in the middle, so they never go with a quadrant). */
export const basilicaHolder = (game, s) => standing(game, s)[0] ?? null
/** The Basilica weapons are under every quadrant's special orders at once: one quadrant bracing is enough to halve them. */
export const fortBraced = (game, s) => standing(game, s).some(isBraced)
export const fortLockedOn = (game, s) => standing(game, s).some(q => orderOf(q) === 'lockOn')
export const basilicaWorks = (game, s) => { const f = fortOf(game, s); return !!f && !f.basilicaLost && basilicaHolder(game, s) === s }

// ---------------- docking ----------------
const TOUCH = 0.3   // cm of slack on "in contact": bases are placed by hand
/** The standing quadrants of a fort on `ship`'s side whose base `ship`'s base touches ("Friendly ships in contact with the Bastion model"). */
export function dockContacts (game, ship) {
  if (!ship.pos || ship.fort || ship.state !== 'active') return []
  const out = []
  for (const f of Object.values(game.forts ?? {})) {
    if (f.side !== ship.side || !f.placed) continue
    if (f.rotates) continue   // Ships can never dock with a fort that rotates
    for (const u of f.uids) { const q = shipByUid(game, u); if (q.state === 'active' && dist(q.pos, ship.pos) <= baseR(q) + baseR(ship) + TOUCH) out.push(q) }
  }
  return out
}
/** A ship touching one of the four docking piers between quadrants may dock fully. A pier is the seam where two neighbouring quadrants' bases meet,
 * so a ship whose base touches two neighbouring quadrants at once is at a pier (the pier's size is the game's own choice). */
export function fullyDocked (game, ship) {
  const c = dockContacts(game, ship)
  return c.some(a => c.some(b => a !== b && (a.fort.q + 1) % 4 === b.fort.q))
}
/** End Phase of the ship's own turn: counts the turns a ship has stayed fully docked without bracing (reset by bracing or leaving), and reloads it after two. */
export function dockUpkeep (game) {
  for (const s of game.ships) {
    if (s.state !== 'active' || s.fort || s.side !== game.active) continue
    if (!s.pos || !fullyDocked(game, s)) { s.dockedTurns = 0; continue }
    s.dockedTurns = isBraced(s) ? 0 : (s.dockedTurns ?? 0) + 1
    if (s.dockedTurns >= 2) {
      s.loaded.torpedo = true; s.loaded.bays = true; s.loaded.tubes = {}; s.harpoonsOut = 0
      say(game, `${s.name}: docked for two full turns without bracing, its ordnance is reloaded automatically`)
    } else say(game, `${s.name} is fully docked at a docking pier: turn ${s.dockedTurns} of 2 for an automatic reload; +4 dice for damage control`)
  }
}
gameLate.fortContact = (game, ship) => dockContacts(game, ship).length > 0

// ---------------- special orders for pairs of quadrants ----------------
/** Quadrants that can be given one order with one Command check: the others named, as game.giveOrder's `together`. */
export function together (game, ship, uids) {
  return uids.map(u => shipByUid(game, u)).filter(q => q && q !== ship && sameFort(q, ship) && q.state === 'active')
}

// ---------------- damage ----------------
const FORT_CRITS = {
  2: { key: 'lances', extra: 0, text: 'Lances damaged — the quadrant\'s lance array may not fire until repaired' },
  4: { key: 'main', extra: 0, text: 'Main armament damaged — the quadrant\'s batteries fire at half strength until repaired' },
  5: { key: 'bays', extra: 0, text: 'Ordnance bays hit — the quadrant fires no ordnance until repaired' },
  6: { key: 'reactors', extra: 1, text: 'Reactors damaged — the quadrant\'s shields and turrets at half strength until repaired, +1 damage' },
  7: { key: 'fire', extra: 0, text: 'Fire! — 1 damage in the End Phase unless put out' },
  8: { key: 'breach', extra: 'D3', text: 'Hull breach — +D3 damage' },
  9: { key: 'command', extra: 0, text: 'Command tower struck — Resolve -2 for the whole fort, can\'t be repaired' },
  10: { key: 'shields', extra: 0, text: 'Shields collapse — the quadrant\'s shields are 0, can\'t be repaired' },
  11: { key: 'basilica', extra: 'D3', text: 'Basilica penetrated — every quadrant takes D3 damage and the Basilica weapons are lost' },
  12: { key: 'reactor', extra: 'D6', text: 'Reactor struck — every quadrant takes D6 more, and another critical on this quadrant' },
}
FORT_CRITS[3] = FORT_CRITS[2]
/** The Bastion critical hits table. A hit affects only the quadrant struck. `damage` is damage.js damageShip, passed in to avoid a circular import. */
export function fortCritical (game, ship, roll, { damage, run, depth = 0 } = {}) {
  const f = fortOf(game, ship)
  run(game, ship, roll, {
    table: FORT_CRITS, name: 'Bastion star fort critical hits table',
    // a result that cannot apply (no lances / bays; Shields already collapsed) is rolled up one, as
    skip: (c, ship) => ((c.key === 'lances' || c.key === 'bays' || c.key === 'main') && !ship.profile.weapons.some(w => w.loc === c.key)) || (c.key === 'shields' && ship.crits.shields),
    counts: (c, ship) => c.key in ship.crits,
    after: (c, ship) => { if (c.key === 'command') for (const q of quadrantsOf(game, ship)) { q.leadership -= 2 } },
    extraHook: (c, extra) => {
      if (c.key === 'basilica') {
        f.basilicaLost = true
        say(game, `${ship.name}: the Basilica weapons are lost; every quadrant takes ${extra} damage`)
        for (const q of standing(game, ship)) damage(game, q, extra, { what: 'the Basilica exploding', noCrits: true, noSave: true })
        return true
      }
      if (c.key === 'reactor') {
        say(game, `${ship.name}: all four quadrants take ${extra} damage from power surges`)
        for (const q of standing(game, ship)) damage(game, q, extra, { what: 'a reactor surge', noCrits: true, noSave: true })
        if (ship.state === 'active' && depth < 5) fortCritical(game, ship, null, { damage, run, depth: depth + 1 })   // then a further critical is rolled at once for the same quadrant
        return true
      }
      return false
    },
  })
}

/** A quadrant reduced to 0 becomes wreckage that counts as an asteroid field. When all four are gone, roll on the catastrophic table. */
export function quadrantDown (game, ship) {
  ship.state = 'destroyed'
  game.onFx?.({ kind: 'explode', to: { ...ship.pos } })
  say(game, `${ship.name} has no hits left: the quadrant is wreckage, treated as an asteroid field from now on; further hits on it do nothing`)
  game.terrain.push({ id: game.nextId++, kind: 'asteroids', fortWreck: ship.uid, shape: { t: 'circ', x: ship.pos.x, y: ship.pos.y, r: baseR(ship) }, size: [baseR(ship) * 2, baseR(ship) * 2] })
  const f = fortOf(game, ship)
  if (quadrantsOf(game, ship).every(q => q.state !== 'active')) catastrophicFort(game, ship, f)
}

/** The Bastion catastrophic damage table, D6. `force` names the result (tests). */
export function catastrophicFort (game, ship, f, force) {
  const r = force ?? d6(game.rng), c = f.centre
  say(game, `${ship.profile.name}: all four quadrants are gone. Catastrophic damage table, D6 rolled ${r}`)
  const lanceShots = (n, reach, what) => {
    for (const o of onTable(game).filter(x => !x.fort && x.state === 'active' && dist(x.pos, c) <= reach)) {
      offerBrace(game, o, { by: ship, what, key: `fort-${f.id}-${what}` })
      const dice = rollDice(game.rng, n), hits = dice.filter(d => d >= 4).length
      say(game, `${o.name}: ${n} lance shots rolled ${fmt(dice)}, needed 4+: ${hits} hit${hits === 1 ? '' : 's'}`)
      late.hit?.(game, o, hits, c, what)
    }
  }
  if (r <= 2) { say(game, 'Wrecked: wreckage blocks line of fire across the fort; the quadrants stay as asteroid fields'); return }
  if (r === 3) {
    say(game, 'Structural collapse: a 15 cm diameter asteroid field is placed where the fort was')
    game.terrain.push({ id: game.nextId++, kind: 'asteroids', shape: { t: 'circ', x: c.x, y: c.y, r: 7.5 }, size: [15, 15] })
    return
  }
  const reach = sum(rollDice(game.rng, 4))
  if (r <= 5) {
    const bm = sum(rollDice(game.rng, 2))
    say(game, `Hyper-plasma meltdown: eight lance shots at each ship up to 4D6 = ${reach} cm away and ordnance in that radius removed; everything else takes a solar flare from the fort; ${bm} Blast Markers (2D6) are left`)
    const struck = onTable(game).filter(x => !x.fort && x.state === 'active' && dist(x.pos, c) <= reach)
    lanceShots(8, reach, 'the hyper-plasma meltdown')
    game.ordnance = game.ordnance.filter(o => dist(o.pos, c) > reach)
    late.flare?.(game, { centre: c, skip: struck })   // every other ship, defence and ordnance marker on the table takes a solar flare that starts at the fort
    placeBlastCluster(game, c, bm)
    return
  }
  say(game, `Aetherbubble implosion: four lance shots at every ship within 4D6 = ${reach} cm and ordnance there is removed; then an Aether Rift where the fort was, and everything on the table is drawn 15 cm towards it`)
  lanceShots(4, reach, 'the aetherbubble implosion')
  game.ordnance = game.ordnance.filter(o => dist(o.pos, c) > reach)
  // An aether rift is D3x5 cm wide and D3x10 cm long; it blocks line of fire, detonates torpedoes, destroys attack craft that move into it and takes a 3D6 Resolve Test of a ship
  const wd = d3(game.rng) * 5, len = d3(game.rng) * 10
  const rift = { id: game.nextId++, kind: 'rift', shape: { t: 'ell', x: c.x, y: c.y, rx: len / 2, ry: wd / 2, rot: 0 }, size: [len, wd] }
  game.terrain.push(rift)
  say(game, `The Aether Rift is ${wd} cm wide and ${len} cm long`)
  for (const o of [...game.ordnance]) {
    const to = pull(o.pos, c)
    if (firstTouch(rift.shape, o.pos, to, o.r ?? 0) != null || touchesBase(rift.shape, to, o.r ?? 0)) { game.ordnance = game.ordnance.filter(x => x !== o); say(game, `${o.kind === 'torpedo' ? 'A torpedo salvo' : 'Attack craft'} drawn into the Aether Rift ${o.kind === 'torpedo' ? 'detonate' : 'are destroyed'}`) } else o.pos = to
  }
  for (const s of onTable(game).filter(x => !x.fort)) {
    const to = pull(s.pos, c)
    if (firstTouch(rift.shape, s.pos, to, baseR(s)) != null || touchesBase(rift.shape, to, baseR(s))) {
      say(game, `${s.name} is drawn 15 cm towards the Rift and into it`)
      s.pos = to; late.enterRift?.(game, s)
    } else { s.pos = to; say(game, `${s.name} is drawn 15 cm towards the Aether Rift`) }
  }
}
const pull = (p, c) => { const d = dist(p, c); return d <= 15 ? { ...c } : along(p, angleTo(p, c), 15) }
/** damage.js registers its hitWithShields here (circular import). */
export const late = {}
gameLate.fort = fortOf
/** The quadrant beside `q` on the side the fire comes from (the neighbour nearest the line of fire), or null. */
gameLate.fortNeighbour = (game, q, from) => {
  const f = fortOf(game, q)
  if (!f?.centre || !from) return null
  const side = ((norm(angleTo(f.centre, from) - q.facing) + 540) % 360) - 180   // -180..180: which side of the quadrant's own axis the firer is on
  if (Math.abs(side) < 1e-9) return null
  const nb = shipByUid(game, f.uids[(q.fort.q + (side > 0 ? 1 : 3)) % 4])
  return nb && nb.state === 'active' ? nb : null
}   // game.js reads a quadrant's fort through this (re-rolls, Reload Ordnance)

/** D6 Blast Markers are removed from the whole fort in the End Phase, not per quadrant. */
export function fortBlastClear (game, blastOn) {
  for (const f of Object.values(game.forts ?? {})) {
    const qs = f.uids.map(u => shipByUid(game, u)).filter(q => q.state === 'active')
    if (!qs.length) continue
    const on = [...new Set(qs.flatMap(q => blastOn(q)))]
    if (!on.length) continue
    const r = d6(game.rng), off = on.slice(0, r)
    game.blast = game.blast.filter(b => !off.includes(b))
    say(game, `${shipByUid(game, f.uids[0]).profile.name}: rolled ${r}, ${off.length} Blast Marker${off.length === 1 ? '' : 's'} cleared from the whole fort`)
  }
}

// ---------------- building them in a battle ----------------
/** The scenarios a fort may stand in, as an orbital defence or in place of a planet: Planetary Assault, Worldbreak and Surprise Attack (Hunter, Prey is not in the game). */
export const FORT_SCENARIOS = ['surprise', 'assault', 'worldbreak']
/** Reasons a fort can't be in this list: only the defender in a planet scenario. */
export function fortListProblem (profileOf, list, scenario, role) {
  const forts = list.ships.filter(id => profileOf(id)?.fort)
  if (!forts.length) return []
  if (!FORT_SCENARIOS.includes(scenario)) return ['a fort is only used as a defence or in place of a planet: Surprise Attack, Planetary Assault or Worldbreak, as the defender']
  if (role !== 'defender') return ['a fort is always the defender']
  if (forts.length > 1) return ['one fort only']
  return []
}
/** After the list's ships and commanders are made: turn each fort leader into four quadrants, with the re-rolls the fort has. */
export function setupForts (game) {
  for (const leader of game.ships.filter(s => s.profile.fort && !s.fort)) {
    const f = makeFort(game, leader), pool = game.rerolls[leader.side]
    const n = (leader.profile.fortRerolls ?? 0) + (['fr1', 'fr2', 'fr3'].map((id, k) => (leader.upgrades ?? []).includes(id) ? k + 1 : 0).reduce((a, b) => a + b, 0))
    if (n && pool.flagship === leader.uid) { pool.left += n; say(game, `${leader.profile.name}: ${n} re-roll${n > 1 ? 's' : ''} added to the commander's, usable by the whole fleet`) }
    else if (n) { f.rerolls = n; say(game, `${leader.profile.name}: ${n} re-roll${n > 1 ? 's' : ''} for the fort's own Command checks`) }
    for (const uid of f.uids.slice(1)) shipByUid(game, uid).leadership = leader.leadership
    if (leader.profile.teleportExtras) {   // Deepflesh boarding parties and a Prime Guard are in the price; one extra attack, once a turn, from the first quadrant
      leader.upgrades = [...new Set([...(leader.upgrades ?? []), 'deepflesh', 'honour'])]
    }
    say(game, `${leader.profile.name}: four quadrants of ${leader.profile.hits} hits, ${leader.profile.shields} shields and ${leader.profile.turrets} turrets each`)
  }
}
