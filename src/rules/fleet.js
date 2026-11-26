// Fleet battles: Scenario Ten, Fleet Engagement, fleets picked to equal points from the two
// Rimward Reach lists (Freemen and Dominion) or any of the other fleet lists, standard victory points.
// Exports COMMANDERS, checkFleet, fleetPoints, createFleetBattle, placeFleetShip, fleetPlaceProblem, nextToPlace,
// fleetVictoryPoints and the commander tables; used by scenarios.js, the computer player and the battle page.
//
// Capital ship squadrons: declared before the battle in the list's capitalSquadrons.
import { FLEET_NAME } from './names.js'
import { shipById } from '../data/ships.js'
import { d6 } from './dice.js'
import { raceRule } from '../data/raceRules.js'
import { createGame, addShip, rollLeadership, rollSquadronLeadership, formSquadron, say, isCrippled, isHulk, squadronOf, mates, shipByUid } from './game.js'
import { zoneOf } from './cruiserClash.js'
import { setupForts, fortListProblem } from './fort.js'
import { ensureSunward } from './effects.js'
import { hasLists, listDef } from '../data/fleetLists.js'
import { listFleetPoints, checkListFleet, applyListFleet } from './listCheck.js'
import { katharosLoss } from './katharos.js'

// The commanders, their Resolve and points
export const COMMANDERS = {
  freemen: [{ id: 'fleet-admiral', name: 'Fleet-Admiral', ld: 8, points: 50 }, { id: 'admiral', name: 'Admiral', ld: 9, points: 100 }, { id: 'solar-admiral', name: 'High Admiral', ld: 10, points: 150 }],
  dominion: [{ id: 'harrowadmiral-8', name: 'Harrow Admiral', ld: 8, points: 50 }, { id: 'harrowadmiral-9', name: 'Harrow Admiral', ld: 9, points: 100 }],
  // the other seven fleets take their commanders from their own fleet lists (data/fleetLists.js), not this table
  concord: [], rukka: [], athanatoi: [], thnitoi: [], phage: [], katharos: [], isos: [],
}
export const DOMINION_LORD = { name: 'Harrow Lord', ld: 8, points: 50 }   // a Harrow Lord: Resolve 8, 50 points
// An Admiral has one re-roll in his cost; extra ones are bought: one 25, two 75, three 150
export const EXTRA_REROLLS = [0, 25, 75, 150]
// The Warden Protocols. A Harrow Admiral up to four, no Mark twice; a Harrow Lord up to one.
export const MARKS = {
  rapture: { name: 'Rapture Protocol', points: 25, text: 'enemy ships within 15 cm are -2 Resolve' },
  wrath: { name: 'Wrath Protocol', points: 20, text: 'doubles its boarding value (a Harrow Admiral also +1 to boarding critical rolls)' },
  cipher: { name: 'Cipher Protocol', points: 30, text: 'one more re-roll' },
  endurance: { name: 'Endurance Protocol', points: 35, text: '+1 damage point, may not be boarded' },
}
/** A list's Harrow Lords as { on: ship index, mark }; a bare index is a Lord without a Mark. */
export const lordsOf = list => (list.lords ?? []).map(l => typeof l === 'number' ? { on: l, mark: null } : l)

/** The points of a fleet: ships, commander, re-rolls bought, Harrow Lords and the Marks. */
export function fleetPoints (list) {
  if (hasLists(list.fleet)) return listFleetPoints(list)   // a fleet whose lists are data (data/fleetLists.js)
  const c = COMMANDERS[list.fleet].find(x => x.id === list.commander)
  const marks = (list.marks ?? []).reduce((a, m) => a + (MARKS[m]?.points ?? 0), 0)
  const lords = lordsOf(list).reduce((a, l) => a + DOMINION_LORD.points + (l.mark ? MARKS[l.mark]?.points ?? 0 : 0), 0)
  return list.ships.reduce((a, id) => a + shipById(id).points, 0) + (c?.points ?? 0) + (EXTRA_REROLLS[list.rerolls ?? 0] ?? 0) + marks + lords
}
/** The ship index the commander goes on: Dominion, the most expensive ship; Freemen, the one chosen. */
export function flagshipIndex (list) {
  if (hasLists(list.fleet)) return list.commanderOn ?? 0
  const ps = list.ships.map(shipById)
  if (list.fleet === 'dominion') return ps.reduce((best, p, i) => p.points > ps[best].points ? i : best, 0)
  return list.commanderOn ?? 0
}

/**
 * Is this a legal fleet for the limit? Returns a list of reasons (empty when legal).
 * list: { fleet, ships: [ids], escortSquadrons: [[index into ships, ...], ...], capitalSquadrons: [[index, ...], ...], commander,
 * commanderOn: index, lords: [index] }
 */
export function checkFleet (list, limit) {
  const why = [], ps = list.ships.map(shipById), n = role => ps.filter(p => p.role === role).length
  const pts = fleetPoints(list)
  if (pts > limit) why.push(`${pts} points is over the ${limit} limit (equal points)`)
  if (n('derelict') > 1 && list.fleet === 'dominion') why.push('0-1 Dominion Derelict')
  if (hasLists(list.fleet)) why.push(...checkListFleet(list))   // commander, upgrades, ratios and reserves from the fleet's table (rules/listCheck.js)
  if (['freemen', 'dominion'].includes(list.fleet) && n('cruiser') > 12) why.push('0-12 cruisers')
  if (list.fleet === 'freemen') {
    if (n('battleship') > Math.floor((n('cruiser') + n('battlecruiser')) / 3)) why.push('one battleship for every three cruisers or battlecruisers')
    if (n('battlecruiser') > Math.floor(n('cruiser') / 2)) why.push('one battlecruiser for every two cruisers')
    if (pts > 750 && !list.commander) why.push('a fleet over 750 points must include an Admiral')
  } else if (list.fleet === 'dominion') {
    const cr = n('cruiser') + n('heavy cruiser')
    if (n('battleship') > Math.floor(cr / 3)) why.push('one battleship for every three cruisers or heavy cruisers')
    if (n('grand cruiser') > Math.floor(cr / 3)) why.push('one grand cruiser for every three cruisers or heavy cruisers')
    if (n('heavy cruiser') > Math.floor(n('cruiser') / 2)) why.push('one heavy cruiser for every two cruisers')
    if (!list.commander && !list.generated) why.push('the Dominion must include a Harrow Admiral')
    const lords = lordsOf(list)
    if (lords.length > 3) why.push('0-3 Harrow Lords')
    const marks = list.marks ?? []
    if (marks.length > 4) why.push('a Harrow Admiral may have up to four Warden Protocols')
    if (new Set(marks).size < marks.length) why.push('no Warden Protocol may be taken more than once')
    if (marks.some(m => !MARKS[m]) || lords.some(l => l.mark && !MARKS[l.mark])) why.push('there is no such Warden Protocol')
    if (marks.length && !list.commander) why.push('the Warden Protocols go with the Harrow Admiral')
    const fi = flagshipIndex(list), on = new Set()
    for (const l of lords) {
      if (!ps[l.on]) { why.push('a Harrow Lord must be assigned a ship'); continue }
      if (ps[l.on].role === 'escort') why.push('a Harrow Lord goes on a capital ship')
      if (list.commander && l.on === fi) why.push(`the Harrow Admiral is on the ${ps[fi].name}, so a Harrow Lord can't be`)
      if (on.has(l.on)) why.push('one Harrow Lord to a ship')
      on.add(l.on)
    }
  }
  if (list.fleet === 'freemen' && (list.marks?.length || list.lords?.length)) why.push('Warden Protocols and Harrow Lords are Dominion only')
  if (list.rerolls && !hasLists(list.fleet)) {
    if (list.fleet === 'dominion') why.push('extra re-rolls are bought for a Freemen Admiral; the Dominion gains them through the Cipher Protocol')
    else if (list.fleet === 'freemen' && !list.commander) why.push('extra re-rolls are bought for an Admiral, so the fleet needs one')
    if (!(list.rerolls >= 0 && list.rerolls <= 3)) why.push('up to three extra re-rolls')
  }
  if (list.fleet === 'freemen' && list.commander && ps[list.commanderOn ?? 0]?.role === 'escort') why.push('the Admiral goes on a capital ship')
  // Escorts in squadrons of 2-6; one escort may go alone only if it is the fleet's only escort
  const escorts = ps.map((p, i) => p.role === 'escort' ? i : -1).filter(i => i >= 0)
  const inSq = new Set((list.escortSquadrons ?? []).flat())
  const solo = i => ps[i].soloEscort   // A Messenger, a parent's Tethers and Wardens may stand alone
  const ownSq = hasLists(list.fleet) && listDef(list.fleet, list.list)?.squadrons   // The Phage's lists have their own squadron rules (data/phageLists.js)
  if (!ownSq && escorts.some(i => !inSq.has(i) && !solo(i))) why.push('every escort must be in a squadron')
  for (const q of ownSq ? [] : list.escortSquadrons ?? []) {
    if (q.length > 6) why.push('escort squadrons have at most six ships')
    if (q.length < 2 && escorts.length > 1 && !q.every(solo)) why.push('escort squadrons have at least two ships unless it is the only escort')
  }
  // Cruisers, heavy cruisers and battlecruisers (mixed as you like) in squadrons of 2-4; battleships or grand
  // cruisers in squadrons of 2-3, not mixed together. Escorts, transports and the derelict can't be in one.
  const caps = list.capitalSquadrons ?? [], used = new Set([...(list.escortSquadrons ?? []).flat()])
  const CRUISERS = ['cruiser', 'heavy cruiser', 'battlecruiser']
  for (const q of caps) {
    const roles = q.map(i => ps[i]?.role)
    if (q.some(i => used.has(i))) why.push('a ship can be in only one squadron')
    q.forEach(i => used.add(i))
    if (roles.length && roles.every(r => r === 'lump')) { if (q.length < 2 || q.length > 4) why.push('a gang of Lumps has two to four Lumps, and no other vessels'); continue }
    if (roles.some(r => !r || !['cruiser', 'heavy cruiser', 'battlecruiser', 'battleship', 'grand cruiser'].includes(r))) { why.push('capital ship squadrons are of cruisers, heavy cruisers, battlecruisers, grand cruisers or battleships'); continue }
    if (roles.every(r => CRUISERS.includes(r))) { if (q.length < 2 || q.length > 4) why.push('a cruiser squadron has two to four ships') }
    else if (roles.every(r => r === 'battleship') || roles.every(r => r === 'grand cruiser')) { if (q.length < 2 || q.length > 3) why.push('a battleship or grand cruiser squadron has two or three ships') }
    else why.push('battleships, grand cruisers and cruisers can\'t be mixed in a squadron')
  }
  if (!ps.length && !list.generated) why.push('a fleet needs at least one ship')   // generated: the Convoy's attackers
  return why
}

/**
 * Set up a Fleet Engagement. lists: two fleets as checkFleet takes them, plus `name`. Both fleets set up as in
 * Cruiser Duel, along opposite long edges. rounds: a turn limit if the players agree one, else the battle lasts until a fleet is
 * destroyed or has disengaged.
 */
export function createFleetBattle ({ lists, limit, seed = 1, rounds = Infinity, decide, scenario = null }) {
  // limit: one number for both, or [side 0, side 1] (the scenarios give the two sides different points)
  const lim = side => Array.isArray(limit) ? limit[side] : limit
  lists.forEach((l, side) => { const bad = [...checkFleet(l, lim(side)), ...fortListProblem(shipById, l, scenario, 'defender')]; if (bad.length) throw new Error(`${l.name}: ${bad.join('; ')}`) })
  const game = createGame({ fleets: lists.map(l => ({ name: l.name, fleet: l.fleet, points: fleetPoints(l) })), seed, rounds, decide })
  game.scenario = scenario ?? 'fleetEngagement'; game.limit = limit
  lists.forEach((l, side) => {
    const ships = l.ships.map(id => addShip(game, side, id))
    ;(l.escortSquadrons ?? []).forEach((q, k) => formSquadron(game, q.map(i => ships[i].uid), `${FLEET_NAME[l.fleet]} escort squadron ${k + 1}`))
    // Resolve: capital ships one by one, even in a squadron (it keeps its own; Command checks use the best);
    // escort squadrons once each
    const noRoll = raceRule(l.fleet).noLdRoll   // Only queen ships have a Resolve value, fixed by the list
    if (!noRoll) for (const s of ships) if (!squadronOf(game, s)) rollLeadership(game, s)
    if (!noRoll) for (const q of game.squadrons.filter(q => q.side === side)) rollSquadronLeadership(game, q)
    ;(l.capitalSquadrons ?? []).forEach((q, k) => {
      const sq = formSquadron(game, q.map(i => ships[i].uid), `${FLEET_NAME[l.fleet]} ${ships[q[0]].profile.role === 'battleship' ? 'battle' : ships[q[0]].profile.role === 'grand cruiser' ? 'grand cruiser' : 'cruiser'} squadron ${String.fromCharCode(65 + k)}`)
      sq.capital = true
      say(game, `${sq.name}: ${q.map(i => ships[i].name).join(', ')} — declared before the battle; each keeps its own Resolve`)
    })
    if (hasLists(l.fleet)) { applyListFleet(game, side, l, ships); return }   // the fleet's own commander, extras and limits (data/fleetLists.js)
    // the commander improves his ship's Resolve to his value — his supersedes the ship's, even if lower
    const c = COMMANDERS[l.fleet].find(x => x.id === l.commander)
    if (c) {
      const on = ships[flagshipIndex(l)]
      on.leadership = c.ld; on.commander = c.name
      on.marks = [...(l.marks ?? [])]
      // An Admiral's one re-roll plus those bought: a Harrow Admiral's one, plus one for the Cipher Protocol
      const n = 1 + (l.rerolls ?? 0) + (on.marks.includes('cipher') ? 1 : 0)
      game.rerolls[side] = { left: n, flagship: on.uid }
      on.commanderPoints = c.points + (EXTRA_REROLLS[l.rerolls ?? 0] ?? 0) + on.marks.reduce((a, m) => a + MARKS[m].points, 0)
      say(game, `${c.name} commands from ${on.name}: Resolve ${c.ld}, ${n} Fleet Commander re-roll${n === 1 ? '' : 's'}${on.marks.length ? ', ' + on.marks.map(m => MARKS[m].name).join(', ') : ''}`)
    }
    for (const lord of lordsOf(l)) {
      const s = ships[lord.on]
      s.leadership = DOMINION_LORD.ld; s.commander = DOMINION_LORD.name; s.marks = lord.mark ? [lord.mark] : []
      if (lord.mark === 'cipher') s.rerolls = 1   // for his own ship only
      s.commanderPoints = DOMINION_LORD.points + (lord.mark ? MARKS[lord.mark].points : 0)
      say(game, `A Harrow Lord commands ${s.name}: Resolve ${DOMINION_LORD.ld}${lord.mark ? `, ${MARKS[lord.mark].name}` : ''}`)
    }
    // The Endurance Protocol gives the ship a damage point (its own copy of the profile, so the class is unchanged)
    for (const s of ships) if (s.marks?.includes('endurance')) { s.profile = { ...s.profile, hits: s.profile.hits + 1 }; say(game, `${s.name}: Endurance Protocol, ${s.profile.hits} damage points`) }
  })
  setupForts(game)   // A fort becomes four quadrants
  ensureSunward(game)   // The Athanatoi need a sunward edge in every game
  if (scenario) return game   // a scenario sets up its own way (scenarios.js)
  const z = d6(game.rng)
  game.zones = z <= 3 ? ['A', 'B'] : ['B', 'A']
  say(game, `${lists[0].name} rolls ${z} for its set-up edge: zone ${game.zones[0]}`)
  let a, b
  do { a = d6(game.rng); b = d6(game.rng) } while (a === b)
  game.placing = a < b ? 0 : 1
  say(game, `Deployment roll: ${lists[0].name} ${a}, ${lists[1].name} ${b} — the lowest, ${lists[game.placing].name}, deploys a squadron or lone ship first`)
  do { a = d6(game.rng); b = d6(game.rng) } while (a === b)
  game.firstChooser = a > b ? 0 : 1
  say(game, `First-turn roll: ${lists[0].name} ${a}, ${lists[1].name} ${b} — ${lists[game.firstChooser].name} chooses who goes first`)
  return game
}

/** Place a ship; a squadron is deployed whole before the other side places again. */
/** Why this ship can't go there, or null. Asks only: the green shadow reads it as the mouse moves. */
export function fleetPlaceProblem (game, uid, pos) {
  const s = shipByUid(game, uid)
  const zone = zoneOf(game, game.zones[s.side])
  if (game.phase !== 'setup') return 'the battle has started'
  if (s.side !== game.placing) return `it is ${game.sides[game.placing].name}'s turn to deploy`
  if (s.pos) return `${s.name} is already placed`
  if (game.deploying && !game.deploying.includes(uid)) return 'finish deploying the squadron first'
  if (pos.x < 0 || pos.x > game.table.w || pos.y < zone.y0 || pos.y > zone.y1) return `${s.name} must be placed in zone ${game.zones[s.side]}`
  return null
}
export function placeFleetShip (game, uid, pos) {
  const s = shipByUid(game, uid)
  const zone = zoneOf(game, game.zones[s.side])
  const no = fleetPlaceProblem(game, uid, pos)
  if (no) return { ok: false, reason: no }
  s.pos = { ...pos }; s.facing = zone.facing
  const q = squadronOf(game, s)
  const left = q ? q.uids.filter(u => !shipByUid(game, u).pos) : []
  game.deploying = left.length ? left : null
  if (!left.length) { const other = 1 - s.side; game.placing = game.ships.some(x => x.side === other && !x.pos) ? other : s.side }
  return { ok: true }
}
/** The next ship the side to deploy should place: a member of the squadron being deployed, else any. */
export const nextToPlace = game => game.deploying ? shipByUid(game, game.deploying[0]) : game.ships.find(x => x.side === game.placing && !x.pos)

// ---------------- victory points ----------------
const pct = (pts, p) => Math.ceil(pts * p)
/**
 * Victory points `side` has scored: destroyed ships their points; crippled capital ships 25%; disengaged ships 25% if
 * crippled, else 10%; escorts only when their whole squadron is destroyed (crippled squadron: half its ships lost);
 * hulks 50% of their points if `side` holds the field (all enemies destroyed or disengaged and one ship of its own left).
 * The commanders' points, with their re-rolls and Marks, count with their ship.
 */
export function fleetVictoryPoints (game, side) {
  let vp = 0
  // The commander, his bought re-rolls and Marks count with his ship
  const value = s => (s.fort ? Math.ceil(s.profile.points / 4) : s.profile.points) + (s.commanderPoints ?? 0) + (s.upgradePoints ?? 0)
  const gone = s => s.state === 'destroyed' || s.state === 'gone' || s.state === 'lost' || isHulk(s)
  const enemies = game.ships.filter(s => s.side !== side)
  const counted = new Set()
  for (const s of enemies) {
    if (counted.has(s.uid)) continue
    const q = squadronOf(game, s)
    if (q && !q.capital) {   // an escort squadron scores as a whole; capital ships in a squadron each on their own
      const ships = q.uids.map(u => shipByUid(game, u)); ships.forEach(x => counted.add(x.uid))
      if (ships[0].profile.reactive) { vp += ships.reduce((a, x) => a + (x.state === 'disengaged' ? katharosLoss(x, value(x)) : gone(x) ? value(x) : 0), 0); continue }   // A raider that disengages counts 25%
      const pts = ships.reduce((a, x) => a + x.profile.points, 0), lost = ships.filter(gone).length
      if (lost === ships.length) vp += pts
      else if (ships.some(x => x.state === 'disengaged')) vp += pct(pts, lost >= Math.ceil(ships.length / 2) ? 0.25 : 0.10)
      continue
    }
    counted.add(s.uid)
    const nl = katharosLoss(s, value(s))   // The Katharos' own percentages
    if (nl != null) { vp += nl; continue }
    if (s.state === 'destroyed' || s.state === 'gone' || isHulk(s)) vp += value(s)
    else if (s.state === 'disengaged') vp += pct(value(s), isCrippled(s) ? 0.25 : 0.10)
    else if (isCrippled(s)) vp += pct(value(s), 0.25)
  }
  // Orbital mines bought on their own are worth 5 points each, however they were removed
  vp += 5 * (game.minesLost?.[1 - side] ?? 0)
  vp += game.slaveVP?.[side] ?? 0   // Slavetaking, +10 victory points a Hit-and-Run (+30 by Harpoon) for the Thnitoi
  // holding the field
  const fighting = x => x.pos && x.state === 'active'
  if (!game.ships.some(x => x.side !== side && fighting(x)) && game.ships.some(x => x.side === side && fighting(x))) {
    for (const h of game.ships.filter(x => isHulk(x) && !x.profile.reactive)) vp += pct(value(h), 0.5)   // a Katharos hulk already counts 300%
  }
  return vp
}
