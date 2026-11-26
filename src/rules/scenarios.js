// The scenarios: The Lure, The Corsairs, Surprise Attack, Running the Cordon, Convoy, Planetary Assault,
// Rising Engagement and Worldbreak. (Cruiser Duel is cruiserClash.js; Fleet Engagement is fleet.js.)
// Exports SCENARIOS, createScenario, the list check, set-up placement, reserves, the per-scenario actions and the turn
// hooks and scoring; battle.js builds and runs a scenario battle with it and turn.js calls its hooks.
//
// One side is the attacker and one the defender (the scenario says which is which; the players say who is who). The
// battle is built as a fleet battle (fleet.js) and then set up the scenario's way: where each side deploys, ships held
// off the table to come on later (state 'reserve', with the edges they may enter from), the scenario's special rules
// (hooks the turn sequence calls), and how it is won. The set-up maps are pictures; where a scenario gives
// distances in words they are used, and where they don't the engine makes a fixed, documented choice.
import { d6, d3, rollDice, sum } from './dice.js'
import { dist, along, angleTo, norm } from './geometry.js'
import { say, addShip, rollLeadership, rollSquadronLeadership, formSquadron, shipByUid, squadronOf, active, baseR, isEscort,
  isCrippled, leadershipTest, mates, isHulk } from './game.js'
import { createFleetBattle, fleetPoints, fleetVictoryPoints } from './fleet.js'
import { sporesOf } from './game.js'
import { rollBattlezone } from './terrain.js'
import { applyBattlezone } from './effects.js'
import { addLowOrbit, inLowOrbit, fromPlanetEdge, LOW } from './lowOrbit.js'
import { TORPEDO_R } from './ordnance.js'
import { craftRows, hasLiveCraft } from '../data/craft.js'
import { shipById, shipsOf } from '../data/ships.js'
import { raceRule } from '../data/raceRules.js'
import { fortListProblem, placeFort } from './fort.js'
import { rollDefenceBudget, defenceReason, placeDefence } from './defences.js'

const EPS = 1e-6
const W = 180, H = 120
const EDGES = {
  top: { a: { x: 0, y: 0 }, b: { x: W, y: 0 }, inward: 90 },
  bottom: { a: { x: 0, y: H }, b: { x: W, y: H }, inward: 270 },
  left: { a: { x: 0, y: 0 }, b: { x: 0, y: H }, inward: 0 },
  right: { a: { x: W, y: 0 }, b: { x: W, y: H }, inward: 180 },
}
const seg = (edge, from, to) => { const e = EDGES[edge]; const L = e.a.x === e.b.x ? H : W; const t0 = Math.max(0, from) / L, t1 = Math.min(L, to) / L; return { edge, inward: e.inward, a: lerpP(e.a, e.b, t0), b: lerpP(e.a, e.b, t1) } }
const whole = edge => seg(edge, 0, 1e9)
const lerpP = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
const fromEdges = p => Math.min(p.x, p.y, W - p.x, H - p.y)
const CENTRE = { x: W / 2, y: H / 2 }

// ---------------- the list of scenarios ----------------
// limits(limit, opts): the points each role may spend; roles: what the two sides are called; tags: what the players
// mark ships as in the fleet builder (per role); first: who takes the first turn.
// the transport each fleet brings: the Dominion's, the Athanatoi's (-1 on the Athanatoi Resolve table), else the Freemen's
const transportId = fleet => fleet === 'dominion' ? 'transport-dominion' : fleet === 'athanatoi' ? 'transport-athanatoi' : fleet === 'isos' ? 'isos-transport' : 'transport'   // the Isos' Courier
export const SCENARIOS = {
  bait: { name: 'The Lure', roles: ['Pursuers', 'Pursued'], first: 'defender', rounds: Infinity, zones: [5, 6],
    limits: () => [500, 750], tags: { defender: ['reinforcement'] },
    text: 'A lone ship flees from pursuers into a trap. Pursuers 500 points; the pursued one ship or squadron of up to 250 points, with up to 500 points of reinforcements coming on from the edge ahead.' },
  corsairs: { name: 'The Corsairs', roles: ['Corsairs', 'Defenders'], first: 'attacker', rounds: 8,
    limits: limit => [Math.floor(limit / 2), limit],
    text: 'A small raiding force falls on a fleet at rest. The attackers have half the points and come on from any edge; the defenders are -1 Resolve for the first D6 turns. Eight turns.' },
  surprise: { name: 'Surprise Attack', roles: ['Attackers', 'Defenders'], first: 'attacker', rounds: Infinity,
    limits: limit => [limit, limit], tags: { defender: ['alert'] }, planet: true, zones: [3, 4],
    text: 'A pre-emptive strike on a fleet in dock. Equal points; a planet in the middle. D3 defending ships or squadrons are on alert, the rest on standby by the planet until they pass a Resolve Test. Planetary defences are not in the game.' },
  blockade: { name: 'Running the Cordon', roles: ['Blockade runners', 'Blockaders'], first: 'roll', rounds: 6, zones: [5, 6],
    limits: limit => [Math.floor(limit / 2), limit],
    text: 'A small force tries to break through a blockade. The runners have half the points and score the points of any ship they get off the blockaders\' table edge. Six turns.' },
  convoy: { name: 'Convoy', roles: ['Raiders', 'Convoy'], first: 'defender', rounds: Infinity,
    limits: (limit, o) => [0, 100 * Math.floor(Math.max(2, o.transports ?? 4) / 2)], generatedAttacker: true, zones: [5, 6],
    text: 'Transports run a gauntlet of hidden ships, deadfall torpedoes and attack craft. Up to 100 points of escorts per two transports. The attackers are rolled randomly (D3 rolls, +1 per two transports) and hidden under Contact markers.' },
  assault: { name: 'Planetary Assault', roles: ['Attackers', 'Defenders'], first: 'roll', rounds: Infinity,
    limits: limit => [limit, limit], tags: { defender: ['standby'] }, planet: true, lowOrbit: true, zones: [3, 4],
    text: 'The attackers fight down to low orbit to land troops: 1 assault point a turn for each capital ship within 30 cm of the planet edge, 2 for each transport. Two free transports per 500 points. Ten assault points ends it. Planetary defences are not in the game.' },
  escalating: { name: 'Rising Engagement', roles: ['Fleet', 'Fleet'], first: 'roll', rounds: Infinity, symmetric: true,
    limits: limit => [limit, limit], tags: { attacker: ['division'], defender: ['division'] },
    text: 'Each fleet is split into five divisions; one starts on the table and the rest arrive from the edges as the battle goes on.' },
  worldbreak: { name: 'Worldbreak', roles: ['Worldbreakers', 'Defenders'], first: 'roll', rounds: Infinity,
    limits: limit => [limit, limit], tags: { attacker: ['worldbreaker'], defender: ['patrol'] }, planet: true, lowOrbit: true, zones: [3, 4],
    text: 'Worldbreaker ships (one per 1,000 points, prow weapons given up) must reach low orbit and roll 4+ to destroy the planet. The defenders have a ship or squadron on patrol per 500 points, arriving as the battle goes on. Planetary defences are not in the game.' },
}

// ---------------- units: a squadron or a lone ship ----------------
const unitsOf = (game, side, filter = () => true) => {
  const seen = new Set(), out = []
  for (const s of game.ships) {
    if (s.side !== side || seen.has(s.uid) || s.fort || !filter(s)) continue   // a fort is placed on its own
    const q = squadronOf(game, s), ships = q ? q.uids.map(u => shipByUid(game, u)) : [s]
    ships.forEach(x => seen.add(x.uid)); out.push(ships)
  }
  return out
}
const slowest = ships => Math.min(...ships.map(s => s.profile.speed))
// The score to arrive by the slowest ship's speed: up to 20 cm 5+, 25 cm 4+, 30 cm or more 3+
export const arrivalNeed = speed => speed >= 30 ? 3 : speed > 20 ? 4 : 5
const reserve = (ships, entry) => { for (const s of ships) { s.state = 'reserve'; s.pos = null; s.entry = entry } }

/** Points each side may spend: [side 0, side 1]. */
export function scenarioLimits (id, limit, attacker, opts = {}) {
  const [a, d] = SCENARIOS[id].limits(limit, opts)
  return attacker === 0 ? [a, d] : [d, a]
}

/**
 * The scenario's own rules on a list beyond the fleet list's (reasons, empty when legal). role: 'attacker' | 'defender'.
 * list.tags: { shipIndex: tag } from the fleet builder.
 */
export function checkScenarioList (id, list, role, limit, opts = {}) {
  const why = [...fortListProblem(shipById, list, id, role)], ps = list.ships.map((x, i) => ({ i, p: x })), tags = list.tags ?? {}
  list = { ...list, escortSquadrons: [...(list.escortSquadrons ?? []), ...(list.capitalSquadrons ?? [])] }   // every squadron counts as one unit here
  const pts = i => fleetPoints({ ...list, ships: [list.ships[i]], commander: null, marks: [], lords: [], rerolls: 0 })
  // Isos defenders may take Waystations in any scenario, even one that normally allows no planetary defences; they cost fleet points
  if (opts.waystations?.length && role === 'defender') {
    if (list.fleet !== 'isos') why.push('only the Isos have Waystations, and only as defenders')
    for (const w of opts.waystations) if (!shipById(w)?.waystation) why.push(`${w} is not a Waystation`)
    const cost = opts.waystations.reduce((a, w) => a + (shipById(w)?.points ?? 0), 0)
    if (fleetPoints(list) + cost > limit) why.push(`${fleetPoints(list)} points of ships and ${cost} of Waystations is over ${limit}`)
  }
  if (id === 'bait' && role === 'defender') {
    const now = ps.filter(x => tags[x.i] !== 'reinforcement'), later = ps.filter(x => tags[x.i] === 'reinforcement')
    const sq = (list.escortSquadrons ?? []).filter(q => q.some(i => tags[i] !== 'reinforcement'))
    const units = now.filter(x => !(list.escortSquadrons ?? []).flat().includes(x.i)).length + sq.length
    if (units !== 1) why.push('the pursued begin as one ship or one squadron; mark the rest as reinforcements')
    if (now.reduce((a, x) => a + pts(x.i), 0) > 250) why.push('the pursued ship or squadron is worth up to 250 points')
    if (later.reduce((a, x) => a + pts(x.i), 0) > 500) why.push('up to 500 points of reinforcements')
  }
  if (id === 'convoy' && role === 'defender') {
    if (list.fleet === 'phage') why.push('Phage have no convoys, being a void-dwelling race: they attack a convoy, they do not run one')
    const pairs = Math.floor((opts.transports ?? 4) / 2)
    const units = (list.escortSquadrons ?? []).length + ps.filter(x => !(list.escortSquadrons ?? []).flat().includes(x.i)).length
    if (units > pairs) why.push(`at most one squadron or ship per pair of transports: ${pairs}`)
  }
  if (id === 'worldbreak' && role === 'attacker') {
    const n = ps.filter(x => tags[x.i] === 'worldbreaker')
    if (n.length < 1) why.push('mark at least one capital ship as a Worldbreaker')
    if (n.length > Math.ceil(fleetPoints(list) / 1000)) why.push('one Worldbreaker per 1,000 points or part')
    if (n.some(x => shipFor(x.p).type === 'escort')) why.push('a Worldbreaker is a capital ship')
  }
  if (id === 'worldbreak' && role === 'defender') {
    const sqs = list.escortSquadrons ?? [], units = new Set()
    ps.filter(x => tags[x.i] === 'patrol').forEach(x => { const q = sqs.findIndex(q => q.includes(x.i)); units.add(q >= 0 ? 'q' + q : 's' + x.i) })
    const need = Math.floor(fleetPoints(list) / 500)
    if (units.size !== need) why.push(`one capital ship or escort squadron on patrol for each 500 points: ${need}; ${units.size} marked`)
  }
  if (id === 'escalating') {
    const divs = new Set(ps.map(x => +(tags[x.i] ?? 0)).filter(Boolean))
    if (divs.size !== 5 || ps.some(x => !tags[x.i])) why.push('split the fleet into five divisions, every ship in one, none empty')
  }
  return why
}
const role0 = a => a ?? []
/** The Isos may swap up to half their transports for Il'fannor (Merchant) heavy transports, each counting as two. So m Merchants stand for 2m transports, 2m at most half of n. */
function merchants (game, side, n, opts) {
  const m = opts?.merchants ?? 0
  if (!m) return 0
  if (game.sides[side].fleet !== 'isos') throw new Error('only the Isos have Merchant heavy transports')
  if (2 * m > Math.floor(n / 2)) throw new Error(`at most half the ${n} transports may be Merchants, and each counts as two: ${Math.floor(n / 4)}`)
  return m
}
function addMerchants (game, side, m, roll = true) {
  const out = []
  for (let i = 0; i < m; i++) {
    const t = addShip(game, side, 'isos-merchant', { name: `Il'fannor ${i + 1}` })
    t.profile = { ...t.profile, role: 'transport', transportWeight: 2 }
    rollLeadership(game, t); out.push(t)
    say(game, `${t.name}: a Merchant heavy transport counts as two transports, with four assault points`)
  }
  return out
}
const shipFor = shipById

/**
 * Build a scenario battle. lists: [side 0, side 1] as fleet.js takes them (+ tags); attacker: side index; limit: the
 * agreed points; zone: a battlezone generator 1-6, 'roll', or 'none'; opts: { transports, transportSquadron }.
 */
export function createScenario ({ id, lists, attacker = 1, limit = 1000, seed = 1, decide, zone = 'none', opts = {} }) {
  // The Phage never attack in Worldbreak: the battle becomes a Planetary Assault
  const substituted = id === 'worldbreak' && lists[attacker]?.fleet === 'phage'
  if (substituted) id = 'assault'
  const sc = SCENARIOS[id]
  const lim = scenarioLimits(id, limit, attacker, opts)
  for (const side of [0, 1]) {
    const bad = checkScenarioList(id, lists[side], side === attacker ? 'attacker' : 'defender', lim[side], opts)
    if (bad.length) throw new Error(`${lists[side].name}: ${bad.join('; ')}`)
  }
  const ls = lists.map((l, side) => sc.generatedAttacker && side === attacker ? { ...l, ships: [], escortSquadrons: [], commander: null, marks: [], lords: [], generated: true } : l)
  const game = createFleetBattle({ lists: ls, limit: lim, seed, rounds: sc.rounds, decide, scenario: id })
  if (opts.sea) game.sea = true   // Tides of the Archipelago: the sea house rules apply (movement.js collide, boardReach)
  if (substituted) say(game, 'Phage never attack in a Worldbreak: Planetary Assault is played instead')
  game.attacker = attacker; game.defender = 1 - attacker; game.sc = { ...sc, id }
  game.hooks = {}
  game.sides.forEach((s, side) => { s.role = sc.symmetric ? sc.roles[0] : sc.roles[side === attacker ? 0 : 1] })
  say(game, `${sc.name}: ${game.sides[attacker].name} are the ${sc.roles[0].toLowerCase()}, ${game.sides[1 - attacker].name} the ${sc.roles[1].toLowerCase()}`)
  // tags from the fleet builder onto the ships (a squadron takes the tag of its first ship)
  lists.forEach((l, side) => {
    const mine = game.ships.filter(s => s.side === side)
    mine.forEach((s, i) => { s.tag = l.tags?.[i] ?? null })
    for (const q of game.squadrons.filter(q => q.side === side)) { const t = shipByUid(game, q.uids[0]).tag; for (const u of q.uids) shipByUid(game, u).tag = t }
  })
  // the battlezone: the scenario's planet first, then the phenomena if the players want them
  if (sc.planet) {
    const size = id === 'surprise' ? (limit <= 500 ? 'small' : limit <= 1500 ? 'medium' : 'large') : ['small', 'medium', 'medium', 'medium', 'medium', 'large'][d6(game.rng) - 1]
    const at = id === 'surprise' ? CENTRE : { x: W - 40, y: H / 2 }   // no more than 150 cm from a short edge
    const z = rollBattlezone(game.rng, { zone: zoneFor(game, sc, zone) ?? 4, fixedPlanet: { ...at, size, why: id === 'surprise' ? `${limit} points` : 'D6: 1 small, 2-5 medium, 6 large' }, areas: zone !== 'none', sea: !!opts.sea })
    applyBattlezone(game, z)
    game.planet = game.terrain.find(t => (t.kind === 'planet' && !t.moon) || (t.kind === 'island' && !t.islet))   // (at sea, the scenario's planet is a big island)
    if (sc.lowOrbit) { addLowOrbit(game, game.planet); say(game, 'A low orbit table is set out below the main table; its bottom edge is the planet') }
  } else if (zone !== 'none') applyBattlezone(game, rollBattlezone(game.rng, { zone: zoneFor(game, sc, zone), sea: !!opts.sea }))
  game.setupStep = 'place'
  SETUP[id](game, opts)
  for (const w of role0(opts.waystations)) { const s = addShip(game, game.defender, w); s.leadership = 7; say(game, `${game.sides[game.defender].name} set up a ${s.profile.name} (${s.profile.points} points); Tethers and Wardens may guard it`) }
  // The defender may buy planetary defences, D6x10 points per 500 points or part
  if (['surprise', 'assault', 'worldbreak'].includes(id) && opts.defences !== false) { rollDefenceBudget(game); game.setupStep = 'defences' }
  return game
}

// The battlezone: a generator the players chose, or rolled between the two the scenario names, if it names two
// (a D6: 1-3 the first zone, 4-6 the second).
function zoneFor (game, sc, zone) {
  if (zone !== 'roll' && zone !== 'none') return +zone
  if (zone === 'none') return undefined
  if (!sc.zones) return undefined
  const r = d6(game.rng), z = r <= 3 ? sc.zones[0] : sc.zones[1]
  say(game, `${sc.name} is fought in the ${['', 'Flare Region', 'Mercurial Zone', 'Inner Biosphere', 'Primary Biosphere', 'Outer Reaches', 'Deep Space'][z]}: D6 ${r}`)
  return z
}

// ---------------- per-scenario set-up ----------------
const SETUP = {
  bait (game) {
    const pursued = game.defender
    reserve(game.ships.filter(s => s.side === pursued && s.tag === 'reinforcement'), { kind: 'bait' })
    game.placingOrder = [pursued, game.attacker]
    say(game, 'The pursued are placed in the centre of the table facing a short edge (the right); the pursuers more than 60 cm behind them. Reinforcements come on from the right edge, any turn')
  },
  corsairs (game) {
    reserve(game.ships.filter(s => s.side === game.attacker), { kind: 'any edge' })
    game.placingOrder = [game.defender]
    const n = d6(game.rng); game.alertTurns = n
    say(game, `The defenders are caught at rest: -1 Resolve for the first ${n} turns (D6 rolled ${n})`)
    game.hooks.ldMod = (g, s) => s.side === g.defender && g.round <= g.alertTurns ? { mod: -1, why: 'reduced state of alert' } : null
    say(game, 'The defenders set up at least 30 cm from every edge, all facing the same edge, each ship or squadron at least 20 cm from the others. The attackers move on from any edge')
  },
  surprise (game) {
    reserve(game.ships.filter(s => s.side === game.attacker), { kind: 'any edge' })
    const n = d3(game.rng), units = unitsOf(game, game.defender)
    const tagged = units.filter(u => u[0].tag === 'alert'), alert = tagged.slice(0, n)
    if (tagged.length > n) say(game, `Only ${n} may be on alert; the first ${n} marked are`)
    for (const u of units) if (!alert.includes(u)) for (const s of u) s.standby = true
    say(game, `D3 rolled ${n}: up to ${n} ships or squadrons on full alert. On alert: ${alert.map(u => u[0].name).join(', ') || 'none'}; the rest are on standby`)
    game.placingOrder = [game.defender]
    say(game, 'Ships on alert set up anywhere at least 30 cm from an edge; ships on standby with a ship within 15 cm of the planet, abeam of its surface. The attackers move on from any edge')
  },
  blockade (game) {
    game.placingOrder = [game.defender, game.attacker]
    for (const u of unitsOf(game, game.defender)) {
      const r = d6(game.rng), third = r <= 2 ? 0 : r <= 4 ? 1 : 2
      for (const s of u) s.third = third
      say(game, `${u[0].name}${u.length > 1 ? ' and its squadron' : ''}: D6 ${r}, the ${['top', 'middle', 'bottom'][third]} third of the table`)
    }
    say(game, 'The blockaders set up in their thirds, not within 60 cm of the left edge, facing as they like; the runners within 15 cm of the left edge. Runners score the points of any ship that leaves by the right edge')
  },
  convoy (game, opts) {
    const def = game.defender, fleet = game.sides[def].fleet, n = Math.max(2, opts.transports ?? 4), pairs = Math.floor(n / 2)
    const mm = merchants(game, def, n, opts)
    const trans = [...Array.from({ length: n - 2 * mm }, (_, i) => addShip(game, def, transportId(fleet), { name: `Transport ${i + 1}` })), ...addMerchants(game, def, mm, false)]
    if (opts.transportSquadron) { const q = formSquadron(game, trans.map(t => t.uid), 'The convoy'); rollSquadronLeadership(game, q) } else trans.forEach(t => rollLeadership(game, t))
    reserve(game.ships.filter(s => s.side === def), { kind: 'convoy' })
    // the attackers, rolled: D3 rolls plus one per pair of transports
    const rolls = d3(game.rng) + pairs, table = [null, 'one cluster', 'two clusters', 'three clusters', 'escorts 100', 'escorts 150', 'capital 200']
    game.contacts = []
    const got = []
    for (let i = 0; i < rolls; i++) {
      const r = d6(game.rng); got.push(r)
      if (r <= 3) for (let k = 0; k < r; k++) game.contacts.push({ id: game.nextId++, kind: 'cluster', pos: null })
      else game.contacts.push({ id: game.nextId++, kind: r === 6 ? 'capital' : 'escorts', limit: [0, 0, 0, 0, 100, 150, 200][r], pos: null, ships: [] })
    }
    say(game, `The attackers: ${rolls} rolls (D3 + ${pairs} pairs of transports): ${got.map(r => `${r} ${table[r]}`).join('; ')}`)
    // A Contact no ship of the attackers' list can fill comes to nothing (the Thnitoi's cheapest capital ship is 210 points, the Contact 200)
    const list = shipsOf(game.sides[game.attacker].fleet).filter(p => p.role !== 'transport')
    for (const c of game.contacts.filter(c => c.kind !== 'cluster' && !list.some(p => (c.kind === 'capital') === (p.type !== 'escort') && p.points <= c.limit))) {
      game.contacts = game.contacts.filter(x => x !== c)
      say(game, `The attackers have no ship for a ${c.limit} point ${c.kind === 'capital' ? 'capital ship' : 'escort'} Contact, so it comes to nothing`)
    }
    game.setupStep = game.contacts.some(c => c.kind !== 'cluster') ? 'assign' : 'contacts'
    say(game, game.setupStep === 'assign' ? 'The attackers choose the ships under each squadron or capital ship Contact from their fleet list' : 'The attackers place their Contact markers')
    game.hooks.afterMove = convoyAfterMove
    game.hooks.endMovement = convoyEndMovement
  },
  assault (game, opts) {
    const att = game.attacker, fleet = game.sides[att].fleet
    const pts = game.sides[att].points, n = fleet === 'phage' ? 0 : 2 * Math.ceil(pts / 500)   // Phage mound fleets don't add extra transport ships
    const m = merchants(game, att, n, opts)
    for (let i = 0; i < n - 2 * m; i++) { const t = addShip(game, att, transportId(fleet), { name: `Transport ${i + 1}` }); rollLeadership(game, t) }
    addMerchants(game, att, m)
    say(game, n ? `The attackers take ${n} free transports (two per 500 points or part)` : 'The Phage bring no transports: each brood cyst on a ship within 30 cm of the planet scores an Assault Point')
    game.assaultPoints = 0
    for (const u of unitsOf(game, game.defender)) {
      if (u[0].tag === 'standby') { for (const s of u) s.highOrbit = true; continue }
      const r = d6(game.rng)
      for (const s of u) s.patrolBy = r <= 3 ? game.attacker : game.defender
      say(game, `${u[0].name}${u.length > 1 ? ' and its squadron' : ''} on patrol: D6 ${r} — ${r <= 3 ? 'the attacker' : 'the defender'} sets it up (the defender decides its facing)`)
    }
    game.placingOrder = [game.defender, game.attacker]
    say(game, 'Defenders on standby set up in high orbit, within the planet\'s gravity well; on patrol, anywhere not within 30 cm of an edge or inside celestial phenomena. The attackers set up within 15 cm of the left edge')
  },
  escalating (game) {
    game.divisions = [0, 1].map(side => { const d = {}; for (const s of game.ships.filter(x => x.side === side)) (d[s.tag] ??= []).push(s.uid); return d })
    game.markers = []
    for (const side of [0, 1]) {
      const keys = Object.keys(game.divisions[side]), k = keys[Math.floor(game.rng() * keys.length)]
      game.markers.push({ id: game.nextId++, side, div: k, pos: null, start: true })
      for (const [div, uids] of Object.entries(game.divisions[side])) if (div !== k) reserve(uids.map(u => shipByUid(game, u)), { kind: 'division', div })
      say(game, `${game.sides[side].name} draws division ${k} as its starting force`)
    }
    let a, b
    do { a = d6(game.rng); b = d6(game.rng) } while (a === b)
    game.markerFirst = a > b ? 0 : 1
    say(game, `Roll to place markers: ${game.sides[0].name} ${a}, ${game.sides[1].name} ${b} — ${game.sides[game.markerFirst].name} places first`)
    game.setupStep = 'markers'
    game.placingOrder = [game.markerFirst, 1 - game.markerFirst]
    game.hooks.turnEnd = escalatingTurnEnd
    game.hooks.turnStart = escalatingTurnStart
  },
  worldbreak (game) {
    for (const s of game.ships.filter(x => x.side === game.attacker && x.tag === 'worldbreaker')) {
      s.worldbreaker = true
      // A Concord host barge as Worldbreaker keeps its normal profile (prow weapons too) and needs only 3+
      const need = s.profile.role === 'battleship' ? raceRule(s.profile.fleet).worldbreakerNeed : null
      if (need) { s.worldbreakerNeed = need; say(game, `${s.name} is a host barge Worldbreaker: it keeps its weapons and rolls ${need}+ to exterminate the planet`); continue }
      s.profile = { ...s.profile, weapons: s.profile.weapons.filter(w => w.loc !== 'prow') }
      say(game, `${s.name} is a Worldbreaker: its prow armament is replaced by an Armageddon weapon`)
    }
    for (const u of unitsOf(game, game.defender, s => s.tag === 'patrol')) reserve(u, { kind: 'patrol' })
    game.placingOrder = [game.defender, game.attacker]
    game.hooks.turnStart = worldbreakTurnStart
    say(game, 'The defenders set up anywhere not within 30 cm of an edge, their patrols kept off the table; the attackers within 15 cm of the left edge, the one furthest from the planet')
  },
}

// ---------------- placing ships ----------------
/** Who places now, and which ship (a squadron is placed whole). Null when every ship that starts on the table is down. */
export function nextScenarioPlace (game) {
  if (game.setupStep !== 'place') return null
  if (game.deploying) return shipByUid(game, game.deploying[0])
  for (const side of game.placingOrder) {
    const s = game.ships.find(x => x.side === side && !x.pos && x.state === 'active' && (!x.fort || x.fort.q === 0))
    if (s) { game.placing = side; return s }
  }
  return null
}
export const scenarioPlaced = game => game.setupStep === 'ready'

/** Where may this ship go? A reason, or null. */
function placeReason (game, s, p) {
  const id = game.sc.id, def = s.side === game.defender, inside = p.x > 0 && p.y > 0 && p.x < W && p.y < H
  if (!inside) return 'on the table'
  if (s.fort && game.planet && dist(p, game.planet.shape) < game.planet.shape.r + 7.3) return 'clear of the planet (the fort is about 14.5 cm across)'
  if (s.fort) return fromEdges(p) < 30 ? 'at least 30 cm from every table edge; a fort stands in place of the planet or guards it' : null
  if (id === 'bait') {
    if (def) return dist(p, CENTRE) <= 15 ? null : 'the pursued go in the centre of the table'
    const lead = game.ships.find(x => x.side === game.defender && x.pos)
    return p.x < (lead?.pos.x ?? 90) && dist(p, lead?.pos ?? CENTRE) > 60 ? null : 'the pursuers set up more than 60 cm behind the pursued'
  }
  if (id === 'corsairs') {
    if (fromEdges(p) < 30) return 'at least 30 cm from every table edge'
    const mine = new Set(mates(game, s).map(x => x.uid)); squadronOf(game, s)?.uids.forEach(u => mine.add(u))
    if (game.ships.some(x => x.pos && x.side === s.side && !mine.has(x.uid) && dist(x.pos, p) < 20)) return 'each ship or squadron at least 20 cm from the others'
    return null
  }
  if (id === 'surprise') {
    if (!s.standby) return fromEdges(p) < 30 ? 'ships on alert set up at least 30 cm from every edge' : null
    const pl = game.planet.shape, q = squadronOf(game, s), placed = q ? q.uids.map(u => shipByUid(game, u)).filter(x => x.pos) : []
    const near = dist(p, pl) - pl.r - baseR(s) <= 15 + EPS || placed.some(x => dist(x.pos, pl) - pl.r - baseR(x) <= 15 + EPS)
    if (dist(p, pl) < pl.r + baseR(s)) return 'not on the planet'
    return near || (q && placed.length < q.uids.length - 1) ? null : 'a ship on standby within 15 cm of the planet'
  }
  if (id === 'blockade') {
    if (!def) return p.x <= 15 ? null : 'the runners set up within 15 cm of the left edge'
    if (p.x < 60) return 'not within 60 cm of the runners\' (left) edge'
    const t = s.third, y0 = t * 40
    return p.y >= y0 && p.y <= y0 + 40 ? null : `in its rolled third of the table: y ${y0}-${y0 + 40} cm`
  }
  if (id === 'assault') {
    if (!def) return p.x <= 15 ? null : 'the attackers set up within 15 cm of the left edge, the one furthest from the planet'
    if (s.highOrbit) { const pl = game.planet; return dist(p, pl.shape) <= pl.shape.r + { small: 10, medium: 15, large: 30 }[pl.size] && dist(p, pl.shape) > pl.shape.r + baseR(s) ? null : 'on standby in high orbit, within the planet\'s gravity well' }
    if (fromEdges(p) < 30) return 'ships on patrol not within 30 cm of an edge'
    if (game.terrain.some(t => t.kind !== 'planet' && phenomenonAt(t, p))) return 'ships on patrol not inside celestial phenomena'
    return null
  }
  if (id === 'worldbreak') {
    if (!def) return p.x <= 15 ? null : 'the attackers set up within 15 cm of the left edge, the one furthest from the planet'
    return fromEdges(p) < 30 ? 'not within 30 cm of an edge' : null
  }
  if (id === 'escalating') {
    const m = game.markers.find(x => x.side === s.side && x.start)
    return m?.pos && dist(p, m.pos) <= 10 ? null : 'within 10 cm of your Contact marker'
  }
  return null
}
const phenomenonAt = (t, p) => t.shape.t === 'ell' ? (() => { const a = -t.shape.rot * Math.PI / 180, dx = p.x - t.shape.x, dy = p.y - t.shape.y, x = dx * Math.cos(a) - dy * Math.sin(a), y = dx * Math.sin(a) + dy * Math.cos(a); return (x / t.shape.rx) ** 2 + (y / t.shape.ry) ** 2 <= 1 })()
  : t.shape.t === 'ring' ? dist(p, t.shape) >= t.shape.r0 && dist(p, t.shape) <= t.shape.r1 : dist(p, t.shape) <= t.shape.r

/**
 * Why this ship's facing can't be chosen at set-up, or null if the player chooses it. The scenarios fix it for the pursued
 * (facing a short edge), the Corsairs' defenders after the first (all facing the same edge) and ships on
 * standby (abeam of the planet); silos always face out of the planet. Everywhere else (the blockaders, Planetary
 * Assault's defender) the player chooses.
 */
export function facingLocked (game, s) {
  const id = game.sc.id, def = s.side === game.defender
  if (s.profile.role === 'ground') return 'a silo faces out of the planet'
  if (id === 'bait' && def) return 'the pursued face a short edge, the right'
  if (id === 'corsairs' && def && game.ships.some(x => x.side === s.side && x.pos)) return 'the defenders all face the same edge as the first'
  if (id === 'surprise' && s.standby) return 'ships on standby lie abeam of the planet'
  return null
}
export const freeFacing = (game, s) => !facingLocked(game, s)
export function facingFor (game, s, p, chosen) {
  const id = game.sc.id
  if (id === 'corsairs' && s.side === game.defender) { const first = game.ships.find(x => x.side === s.side && x.pos); if (first) return first.facing }
  if (freeFacing(game, s) && chosen != null) return chosen
  if (id === 'bait') return 0
  if (id === 'surprise' && s.standby) return angleTo(p, game.planet.shape) + 90   // abeam of the planet's surface
  if (id === 'blockade') return s.side === game.defender ? 180 : 0
  if (['assault', 'worldbreak'].includes(id)) return s.side === game.attacker ? 0 : 180
  if (id === 'escalating') { const e = game.markers.find(m => m.side !== s.side && m.pos); return e ? angleTo(p, e.pos) : 0 }
  return s.side === game.attacker ? 0 : 180
}

/** Where a ship put down at p would really stand: the lone pursued goes in the centre, a silo on the planet's edge. */
export function placeSpot (game, s, p) {
  if (game.sc.id === 'bait' && s.side === game.defender && !squadronOf(game, s) && s.profile.fleet !== 'defence') return { ...CENTRE }
  if (s.profile.role === 'ground') return { x: Math.max(LOW.x0 + 2, Math.min(LOW.x0 + LOW.w - 2, p.x)), y: LOW.y0 + LOW.h - baseR(s) }
  return p
}
/** Why this ship can't go there, or null. Asks only: the green shadow reads it as the mouse moves. */
export function scenarioPlaceProblem (game, uid, p) {
  const s = shipByUid(game, uid)
  const no = s.profile.fleet === 'defence' ? defenceReason(game, s, p) : placeReason(game, s, placeSpot(game, s, p))
  return no ? `${s.name} must be placed ${no}` : null
}

/** Place a ship in set-up. facing: the player's choice where the scenario allows one. */
export function placeScenarioShip (game, uid, p, facing) {
  const s = shipByUid(game, uid)
  if (game.setupStep !== 'place') return { ok: false, reason: 'not placing ships now' }
  const next = nextScenarioPlace(game)
  if (!next || (next.uid !== uid && !(game.deploying ?? []).includes(uid) && next.side !== s.side)) return { ok: false, reason: `it is ${game.sides[game.placing].name}'s turn to set up` }
  if (s.pos || s.state !== 'active') return { ok: false, reason: `${s.name} isn't placed now` }
  if (game.deploying && !game.deploying.includes(uid)) return { ok: false, reason: 'finish setting up the squadron first' }
  if (s.profile.fleet === 'defence') {   // planetary defences have their own places
    const no = defenceReason(game, s, p)
    if (no) return { ok: false, reason: `${s.name} must be placed ${no}` }
    placeDefence(game, s, p)
    if (facing != null && s.pos && s.profile.role !== 'ground') s.facing = facing
    if (!nextScenarioPlace(game)) readyToStart(game)
    return { ok: true }
  }
  const no = placeReason(game, s, placeSpot(game, s, p))   // the lone pursued goes in the centre
  if (no) return { ok: false, reason: `${s.name} must be placed ${no}` }
  if (s.fort) { placeFort(game, s, p, facing ?? 0); say(game, `${s.profile.name} is set up; facing the player's choice turns the whole base`); if (!nextScenarioPlace(game)) readyToStart(game); return { ok: true } }
  p = placeSpot(game, s, p); s.facing = facingFor(game, s, p, facing); s.pos = { ...p }   // the facing first: Raiders reads who is already down
  const q = squadronOf(game, s), left = q ? q.uids.filter(u => !shipByUid(game, u).pos && shipByUid(game, u).state === 'active') : []
  game.deploying = left.length ? left : null
  if (!nextScenarioPlace(game)) readyToStart(game)
  return { ok: true }
}
function readyToStart (game) {
  game.setupStep = 'ready'
  const first = game.sc.first
  if (first === 'roll') {
    let a, b
    do { a = d6(game.rng); b = d6(game.rng) } while (a === b)
    game.firstChooser = a > b ? 0 : 1
    say(game, `First-turn roll: ${game.sides[0].name} ${a}, ${game.sides[1].name} ${b} — ${game.sides[game.firstChooser].name} chooses who goes first`)
  } else {
    game.firstFixed = first === 'attacker' ? game.attacker : game.defender
    say(game, `${game.sides[game.firstFixed].name} take the first turn`)
  }
}

// ---------------- coming on from the table edge ----------------
/** The edge stretches a reserve ship may come on from now, or a reason it can't. */
export function entryFor (game, s) {
  if (s.state !== 'reserve' || !s.entry) return { why: 'it is not waiting off the table' }
  if (game.phase !== 'movement' || s.side !== game.active) return { why: 'ships move on in their own Manoeuvre Phase' }
  const k = s.entry.kind
  if (k === 'any edge') return { segs: Object.keys(EDGES).map(whole) }
  if (k === 'bait') {   // The edge ahead; after turn 1 also up to 30 cm a turn along the long edges from it
    const along = 30 * (game.round - 1)
    return { segs: [whole('right'), ...(along > 0 ? [seg('top', W - along, W), seg('bottom', W - along, W)] : [])] }
  }
  if (k === 'convoy') {
    if (!game.convoyEntry) return { why: 'the convoy\'s entry point isn\'t set' }
    if (game.round > 2) return { why: 'too late: lost in the aether' }
    const e = game.convoyEntry
    return { segs: [seg(e.edge, e.y - 10, e.y + 10)] }
  }
  if (k === 'arrived') return { segs: s.entry.segs }
  return { why: k === 'patrol' ? 'patrols arrive on a roll at the start of the defender\'s turn' : 'its division hasn\'t arrived' }
}
const nearestOnSeg = (sg, p) => { const dx = sg.b.x - sg.a.x, dy = sg.b.y - sg.a.y, L2 = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((p.x - sg.a.x) * dx + (p.y - sg.a.y) * dy) / L2)); return { x: sg.a.x + dx * t, y: sg.a.y + dy * t } }
/** Bring a reserve ship onto the table at the edge point nearest p, facing straight in; it then moves as normal. */
export function enterShip (game, uid, p) {
  const s = shipByUid(game, uid), e = entryFor(game, s)
  if (e.why) return { ok: false, reason: say(game, `${s.name} can't move on: ${e.why}`) }
  let best = null
  for (const sg of e.segs) { const q = nearestOnSeg(sg, p); if (!best || dist(q, p) < dist(best.q, p)) best = { q, sg } }
  s.pos = best.q; s.facing = best.sg.inward; s.state = 'active'; s.movedThisPhase = false; s.enteredRound = game.round; s.entry = null
  say(game, `${s.name} moves on to the table from the ${best.sg.edge} edge; measure its move from the edge`)
  return { ok: true }
}

// ---------------- Surprise Attack: standby and alert ----------------
/** A ship or squadron on standby tries to go on alert: a Resolve Test (not a Command check), in its own turn. */
export function goOnAlert (game, uid) {
  const s = shipByUid(game, uid)
  if (!s.standby) return { ok: false, reason: 'it is already on alert' }
  if (game.phase !== 'movement' || s.side !== game.active) return { ok: false, reason: say(game, 'a ship goes on alert in its own Manoeuvre Phase') }
  if (s.alertTried === game.round) return { ok: false, reason: say(game, `${s.name} has already tried this turn`) }
  const squad = mates(game, s)
  for (const x of squad) x.alertTried = game.round
  const leader = squad.reduce((a, b) => (b.leadership > a.leadership ? b : a), s)
  const t = leadershipTest(game, leader, { why: 'go on alert status' })
  if (t.pass) { for (const x of squad) { x.standby = false; x.alertRound = game.round } say(game, `${squad.length > 1 ? 'The squadron goes' : `${s.name} goes`} on alert: it may act from now on, but no special orders this turn`) }
  return { ok: true, pass: t.pass }
}

// ---------------- Planetary Assault: landing troops ----------------
/** Landing troops or bombarding: an attacking capital ship or transport no more than 30 cm from the planet's edge on the
 * low orbit table scores 1 assault point (a transport 2) and does nothing else that turn. Declared in its Fire Phase. */
export function landTroops (game, uid) {
  const s = shipByUid(game, uid)
  const no = game.sc?.id !== 'assault' ? 'only in a Planetary Assault' : s.side !== game.attacker ? 'only the attackers land troops'
    : game.phase !== 'shooting' || s.side !== game.active ? 'troops go down in your own Fire Phase' : !inLowOrbit(s) ? 'it must be in low orbit'
      : fromPlanetEdge(s) > 30 ? 'it must be within 30 cm of the planet edge' : isEscort(s) && s.profile.role !== 'transport' && s.profile.fleet !== 'phage' ? 'only capital ships and transports' : s.profile.fleet === 'phage' && !sporesOf(s) ? 'it has no brood cysts left to land'
        : s.fired || s.troopsRound === game.round || s.state !== 'active' ? 'it has already acted this turn' : null
  if (no) return { ok: false, reason: say(game, `${s.name} can't land troops: ${no}`) }
  // A Concord capital ship (drop pods) earns 2 Assault points a turn instead of 1
  // A Merchant heavy transport counts as two transports and has four assault points, halved if crippled
  const n = s.profile.transportWeight ? 2 * s.profile.transportWeight / (isCrippled(s) ? 2 : 1) : s.profile.role === 'transport' ? 2 : s.profile.fleet === 'phage' ? sporesOf(s) : (raceRule(s.profile.fleet).assaultPoints ?? 1)   // 1 Assault Point for each brood cyst
  s.troopsRound = game.round; s.fired = true; s.noFireRound = game.round
  game.assaultPoints += n
  say(game, `${s.name} ${n === 2 || s.profile.transportWeight ? 'sends its troops down' : 'bombards and lands troops'}: +${n} assault point${n > 1 ? 's' : ''}, ${game.assaultPoints} in all; it does nothing else this turn`)
  return { ok: true }
}

// ---------------- Convoy: Contacts ----------------
/** The attackers pick the ships under a squadron or capital ship Contact, from their own fleet list. */
export function assignContact (game, id, shipIds) {
  const c = game.contacts.find(x => x.id === id)
  const fleet = game.sides[game.attacker].fleet, ps = shipIds.map(shipFor)
  const why = !c || c.kind === 'cluster' ? 'no such Contact' : ps.some(p => !p || p.fleet !== fleet) ? 'ships from your own fleet list'
    : c.kind === 'capital' && (ps.length !== 1 || ps[0].type === 'escort') ? 'one capital ship' : c.kind === 'escorts' && (ps.some(p => p.type !== 'escort' || p.role === 'transport') || ps.length < 1 || ps.length > 6) ? 'a squadron of escorts (up to six)'
      : ps.reduce((a, p) => a + p.points, 0) > c.limit ? `worth up to ${c.limit} points` : null
  if (why) return { ok: false, reason: `That Contact must hold ${why}` }
  for (const u of c.ships) game.ships = game.ships.filter(s => s.uid !== u)
  const ships = shipIds.map(id => addShip(game, game.attacker, id))
  c.ships = ships.map(s => s.uid)
  if (ships.length > 1) rollSquadronLeadership(game, formSquadron(game, c.ships, `Raider squadron ${c.id}`)); else ships.forEach(s => rollLeadership(game, s))
  for (const s of ships) { s.state = 'reserve'; s.entry = { kind: 'contact' } }
  if (game.contacts.every(x => x.kind === 'cluster' || x.ships.length)) { game.setupStep = 'contacts'; say(game, 'The attackers place their Contact markers: at least 30 cm apart and 30 cm from every edge') }
  return { ok: true }
}
/** Place the next Contact marker. When all are down, the convoy rolls for its short edge. */
export function placeContact (game, p) {
  const c = game.contacts.find(x => !x.pos)
  if (game.setupStep !== 'contacts' || !c) return { ok: false, reason: 'no Contact to place' }
  if (fromEdges(p) < 30) return { ok: false, reason: 'Contacts go at least 30 cm from every edge' }
  const others = game.contacts.filter(x => x.pos)
  const room = !others.some(x => dist(x.pos, p) < 30)
  if (!room) {   // If they can't all fit, double them up on top of ones already placed
    const fits = [...Array(30)].some((_, i) => [...Array(20)].some((_, j) => { const q = { x: 30 + i * 4, y: 30 + j * 3 }; return fromEdges(q) >= 30 && !others.some(x => dist(x.pos, q) < 30) }))
    if (fits) return { ok: false, reason: 'Contacts at least 30 cm apart' }
    const under = others.reduce((a, b) => dist(b.pos, p) < dist(a.pos, p) ? b : a)
    c.pos = { ...under.pos }; say(game, 'No room left: the Contact is stacked on another')
  } else c.pos = { ...p }
  if (game.contacts.every(x => x.pos)) {
    const r = d6(game.rng), edge = r <= 3 ? 'left' : 'right'
    game.convoyEdge = edge; game.setupStep = 'entry'
    say(game, `The convoy rolls ${r}: it enters from the ${edge} short edge (1-3 left, 4-6 right). Click that edge to mark where — not within 45 cm of the long edges`)
  }
  return { ok: true }
}
/** The convoy marks where it will come on: on its short edge, not within 45 cm of a long edge. */
export function setConvoyEntry (game, p) {
  if (game.setupStep !== 'entry') return { ok: false, reason: 'not now' }
  const y = Math.max(45, Math.min(H - 45, p.y))
  game.convoyEntry = { edge: game.convoyEdge, y }
  say(game, `The convoy will move on at ${Math.round(y)} cm along the ${game.convoyEdge} edge`)
  game.setupStep = 'ready'; game.firstFixed = game.defender
  say(game, `${game.sides[game.defender].name} take the first turn; ships that haven't moved on by the end of their second turn are lost in the aether`)
  return { ok: true }
}
function convoyAfterMove (game, s) {
  if (s.side !== game.defender) return
  for (const c of game.contacts) if (!c.done && !c.triggered && c.pos && dist(c.pos, s.pos) <= 30 + EPS) { c.triggered = true; say(game, `${s.name} comes within 30 cm of a Contact: it is turned over`) }
}
function convoyEndMovement (game) {
  if (game.active === game.defender) for (const c of game.contacts.filter(c => c.triggered && !c.done)) revealContact(game, c)
}
/** The attackers turn over a Contact at the start of their Manoeuvre Phase: one, or two if a convoy ship is on special orders. */
export function activateContact (game, id) {
  const c = game.contacts.find(x => x.id === id && !x.done)
  const allowed = game.ships.some(s => s.side === game.defender && s.order) ? 2 : 1
  if (!c || game.phase !== 'movement' || game.active !== game.attacker) return { ok: false, reason: say(game, 'The attackers turn Contacts over at the start of their own Manoeuvre Phase') }
  if ((game.activatedRound?.round === game.round ? game.activatedRound.n : 0) >= allowed) return { ok: false, reason: say(game, `Only ${allowed} Contact${allowed > 1 ? 's' : ''} a turn (two if any convoy ship is on special orders)`) }
  if (game.ships.some(s => s.side === game.attacker && s.movedThisPhase)) return { ok: false, reason: say(game, 'only at the start of the Manoeuvre Phase, before any ship moves') }
  game.activatedRound = { round: game.round, n: (game.activatedRound?.round === game.round ? game.activatedRound.n : 0) + 1 }
  revealContact(game, c)
  return { ok: true }
}
const nearestConvoyShip = (game, p) => game.ships.filter(s => s.side === game.defender && s.pos && s.state === 'active').sort((a, b) => dist(a.pos, p) - dist(b.pos, p))[0]
function revealContact (game, c) {
  c.done = true
  const aim = nearestConvoyShip(game, c.pos), heading = aim ? angleTo(c.pos, aim.pos) : 0
  if (c.kind === 'cluster') {
    const deadfall = game.decide.contactKind ? game.decide.contactKind(game, c) === 'deadfall' : true
    if (deadfall) {
      const str = d6(game.rng) + 2, h = game.decide.deadfallHeading?.(game, c, heading) ?? heading
      game.ordnance.push({ id: game.nextId++, kind: 'torpedo', side: game.attacker, from: null, str, speed: 30, pos: { ...c.pos }, facing: h, r: TORPEDO_R, fresh: false, attacked: {} })
      say(game, `The Contact is a deadfall torpedo cluster: a strength ${str} salvo (D6+2), speed 30 cm, aimed at ${Math.round(norm(h))}°; it moves in the next Ordnance Phase`)
    } else {
      // a fleet with attack craft rows (data/craft.js) flies its own; one whose craft aren't in yet flies as the Dominion's
      const n = d3(game.rng) + 1, own = game.sides[game.attacker].fleet, fleet = hasLiveCraft(own) ? own : 'dominion'
      const kindsOf = job => craftRows(fleet).find(r => r.live && !r.needs && r.acts.includes(job) && r.acts.length === 1)?.kind
      const anyOf = job => craftRows(fleet).find(r => r.live && !r.needs && r.acts.includes(job))?.kind   // a fleet whose craft do both jobs in one (the Concord's Dropwing) flies those
      const fk = kindsOf('fighter') ?? anyOf('fighter') ?? 'fighter', bk = kindsOf('bomber') ?? anyOf('bomber') ?? anyOf('boat') ?? fk
      const mix = game.decide.clusterMix?.(game, c, n) ?? { [fk]: Math.floor(n / 2), [bk]: n - Math.floor(n / 2) }
      const markers = craftRows(fleet).filter(r => r.live && !r.needs).flatMap(r => Array(mix[r.kind] ?? 0).fill(r.kind))
      while (markers.length < n) markers.push(bk)   // a kind the fleet can't field in a cluster (Lamia raiders need a carrier) becomes a bomber
      game.ordnance.push({ id: game.nextId++, kind: 'wave', side: game.attacker, from: null, pos: { ...c.pos }, markers, r: Math.sqrt(markers.length) * 1.1, moved: false, fresh: true, fleet })
      say(game, `The Contact is an attack craft cluster: ${n} squadrons (D3+1): ${markers.join(', ')}; they move in the next Ordnance Phase`)
    }
    return
  }
  const ships = c.ships.map(u => shipByUid(game, u))
  ships.forEach((s, i) => {   // the first on the marker, the rest in formation no closer to the enemy
    s.state = 'active'; s.entry = null; s.facing = heading
    s.pos = i === 0 ? { ...c.pos } : along(c.pos, heading + 180 + (i % 2 ? 60 : -60), 4 * Math.ceil(i / 2))
  })
  say(game, `The Contact is ${ships.map(s => s.name).join(', ')}, set up on the marker facing the convoy`)
}

// ---------------- Rising Engagement ----------------
/** Set-up: place this side's starting Contact marker; then its division sets up within 10 cm of it. */
export function placeMarker (game, p) {
  if (game.setupStep !== 'markers') return { ok: false, reason: 'not now' }
  const side = game.placingOrder.find(sd => !game.markers.find(m => m.side === sd && m.start).pos)
  const m = game.markers.find(x => x.side === side && x.start)
  if (fromEdges(p) < 30) return { ok: false, reason: 'a Contact marker at least 30 cm from every edge' }
  const enemy = game.markers.find(x => x.side !== side && x.pos)
  if (enemy && dist(enemy.pos, p) < 60) return { ok: false, reason: 'at least 60 cm from the enemy marker' }
  m.pos = { ...p }; game.placing = side
  say(game, `${game.sides[side].name} places its Contact marker`)
  if (game.markers.filter(x => x.start).every(x => x.pos)) { game.setupStep = 'place'; say(game, 'Each side sets up its starting division within 10 cm of its marker') }
  return { ok: true }
}
export const markerSide = game => game.setupStep === 'markers' ? game.placingOrder.find(sd => !game.markers.find(m => m.side === sd && m.start).pos) : null
// End Phase of each player's turn: a random unplaced marker goes on a random table edge
function escalatingTurnEnd (game) {
  const side = game.active
  const left = Object.keys(game.divisions[side]).filter(k => !game.markers.some(m => m.side === side && m.div === k))
  if (!left.length) return
  const div = left[Math.floor(game.rng() * left.length)], r = d6(game.rng)
  const edge = ['top', 'bottom', 'left', 'right', 'top', 'bottom'][r - 1]   // 1 top, 2 bottom, 3 left, 4 right, 5-6 the long edges again
  const e = EDGES[edge], L = e.a.x === e.b.x ? H : W
  const enemies = game.ships.filter(s => s.side !== side && s.pos && s.state === 'active'), friends = game.ships.filter(s => s.side === side && s.pos && s.state === 'active')
  const pts = [...Array(Math.floor(L / 5) + 1)].map((_, i) => lerpP(e.a, e.b, i * 5 / L))
  let ok = pts.filter(q => !enemies.some(s => dist(s.pos, q) < 60))
  const nearEdge = friends.filter(s => dist(nearestOnSeg(e, s.pos), s.pos) <= 30)
  if (nearEdge.length) ok = ok.filter(q => nearEdge.some(s => dist(s.pos, q) <= 30))
  if (!ok.length) { say(game, `${game.sides[side].name}: no room on the ${edge} edge for a Contact marker this turn`); return }
  // the player would choose the spot; the computer takes the one nearest its own fleet
  const c = friends.length ? { x: sum(friends.map(s => s.pos.x)) / friends.length, y: sum(friends.map(s => s.pos.y)) / friends.length } : CENTRE
  const pos = ok.reduce((a, b) => dist(b, c) < dist(a, c) ? b : a)
  game.markers.push({ id: game.nextId++, side, div, pos, edge })
  say(game, `${game.sides[side].name}: division ${div}'s Contact marker goes on the ${edge} edge (D6 ${r})`)
}
// the start of a player's turn: each of its markers on an edge rolls to bring its division on
function escalatingTurnStart (game) {
  const side = game.active
  for (const m of game.markers.filter(m => m.side === side && m.edge && !m.arrived)) {
    const ships = game.divisions[side][m.div].map(u => shipByUid(game, u)).filter(s => s.state === 'reserve')
    if (!ships.length) { m.arrived = true; continue }
    const need = arrivalNeed(slowest(ships)), near = game.ships.some(s => s.side === side && s.pos && s.state === 'active' && dist(s.pos, m.pos) <= 30)
    const phage = game.sides[side].fleet === 'phage' ? 1 : 0   // The Phage player adds +1 to the roll for divisions to arrive
    const r = d6(game.rng), total = r + (near ? 2 : 0) + phage
    say(game, `Division ${m.div} (slowest ${slowest(ships)} cm): rolled ${r}${near ? ' +2 for friends within 30 cm' : ''}${phage ? ' +1 Phage' : ''} = ${total}, needed ${need}+ — ${total >= need ? 'it arrives: its ships move on within 10 cm of the marker' : 'not yet'}`)
    if (total >= need) {
      m.arrived = true
      const L = m.edge === 'left' || m.edge === 'right' ? m.pos.y : m.pos.x
      for (const s of ships) s.entry = { kind: 'arrived', segs: [seg(m.edge, L - 10, L + 10)] }
    }
  }
}

// ---------------- Worldbreak ----------------
function worldbreakTurnStart (game) {
  // the Armageddon weapon, at the start of each game turn: 4+ for each Worldbreaker in low orbit
  if (game.active === game.first) for (const s of game.ships.filter(s => s.worldbreaker && s.state === 'active' && inLowOrbit(s) && fromPlanetEdge(s) <= 45)) {
    const r = d6(game.rng)
    const need = s.worldbreakerNeed ?? 4
    say(game, `${s.name} is within 45 cm of the planet edge: rolled ${r}, the Armageddon weapon fires on ${need}+ (${need === 3 ? '' : ''})`)
    if (r >= need) { game.planetDestroyed = true; say(game, 'The Armageddon weapon fires: a catastrophic event obliterates all life on the planet!'); return }
  }
  // patrols: when a defender's turn begins, each rolls to come on, at a random edge
  if (game.active !== game.defender) return
  for (const u of unitsOf(game, game.defender, s => s.state === 'reserve' && s.entry?.kind === 'patrol')) {
    const need = arrivalNeed(slowest(u)), r = d6(game.rng)
    if (r < need) { say(game, `${u[0].name}${u.length > 1 ? '\'s squadron' : ''} on patrol: rolled ${r}, needed ${need}+ — not yet`); continue }
    let e; do { e = d6(game.rng) } while (e > 4)
    const edge = ['top', 'bottom', 'left', 'right'][e - 1]
    for (const s of u) s.entry = { kind: 'arrived', segs: [whole(edge)] }
    say(game, `${u[0].name}${u.length > 1 ? '\'s squadron' : ''} on patrol: rolled ${r}, needed ${need}+ — it arrives on the ${edge} edge (D4 ${e})`)
  }
}

// ---------------- turn hooks the turn sequence calls ----------------
/** At the start of each player's turn (after the tabletop effects). */
export function scenarioTurnStart (game) { game.hooks?.turnStart?.(game) }
/** At the end of each player's turn. */
export function scenarioTurnEnd (game) {
  game.hooks?.turnEnd?.(game)
  // Convoy: ships not moved on by the end of the convoy's second turn are lost in the aether
  if (game.sc?.id === 'convoy' && game.active === game.defender && game.round >= 2) for (const s of game.ships.filter(s => s.side === game.defender && s.state === 'reserve')) { s.state = 'lost'; say(game, `${s.name} never arrived: lost in the aether`) }
}

// ---------------- the end, and who won ----------------
// a fleet is its ships: planetary defences don't keep a side in the battle
const fighting = (game, side) => game.ships.some(s => s.side === side && s.profile.fleet !== 'defence' && (s.state === 'active' || s.state === 'reserve'))
const transportsLeft = game => game.ships.filter(s => s.side === game.defender && s.profile.role === 'transport' && (s.state === 'active' || s.state === 'reserve'))
const throughConvoy = game => game.ships.filter(s => s.side === game.defender && s.profile.role === 'transport' && s.state === 'disengaged' && s.exitEdge === (game.convoyEdge === 'left' ? 'right' : 'left'))
/** Has the scenario ended? Sets game.result when it has. */
export function scenarioOver (game) {
  const id = game.sc.id, a = game.attacker, d = game.defender
  const gone = side => !fighting(game, side) && !(id === 'convoy' && side === a && game.contacts.some(c => !c.done))
  let end = null
  if (id === 'convoy') { if (!transportsLeft(game).length) end = 'the last transport has left the table or been destroyed' }
  else if (id === 'assault' && game.assaultPoints >= 10) end = 'the attackers have 10 assault points'
  else if (id === 'worldbreak' && game.planetDestroyed) end = 'the planet is destroyed'
  else if (id === 'worldbreak' && !game.ships.some(s => s.worldbreaker && s.state === 'active')) end = 'every Worldbreaker is destroyed'
  if (!end && id !== 'convoy') for (const side of [0, 1]) if (gone(side)) end = `${game.sides[side].name} have no ships left fighting`
  if (!end) return false
  game.result = scenarioResult(game, end)
  return true
}
/** Victory points in a scenario: standard, and the Running the Cordon's ships off the blockaders' edge. */
export function scenarioVP (game, side) {
  let vp = fleetVictoryPoints(game, side)
  if (game.sc?.id === 'blockade') {
    const runners = game.ships.filter(s => s.side === game.attacker && s.state === 'disengaged' && s.exitEdge === 'right')
    const worth = s => isCrippled(s) ? Math.ceil(s.profile.points / 4) : s.profile.points
    if (side === game.attacker) vp += runners.reduce((a, s) => a + worth(s), 0)
    else vp -= runners.reduce((a, s) => a + Math.ceil(s.profile.points * (isCrippled(s) ? 0.25 : 0.10)), 0)   // a ship that broke through gives no disengage points
  }
  return vp
}
export function scenarioResult (game, why = 'the battle is over') {
  const id = game.sc.id, A = game.sides[game.attacker].name, D = game.sides[game.defender].name
  const vp = [0, 1].map(s => scenarioVP(game, s))
  const byVP = () => vp[0] === vp[1] ? { title: 'A draw', winner: null } : { title: `${game.sides[vp[0] > vp[1] ? 0 : 1].name} win`, winner: vp[0] > vp[1] ? 0 : 1 }
  let r
  if (id === 'convoy') {
    const n = throughConvoy(game).length
    r = n === 0 ? { title: `${A} win`, text: 'No transport got through.' } : n === 1 ? { title: `${A}: a marginal win`, text: 'A single transport got through.' } : n === 2 ? { title: `${D}: a marginal win`, text: 'Two transports got through.' } : { title: `${D} win`, text: `${n} transports got through.` }
    r.text += ''
  } else if (id === 'assault') {
    const t = game.assaultPoints + Math.floor(vp[game.attacker] / 500) - Math.ceil(vp[game.defender] / 500)
    r = { title: t <= 1 ? `${D} win` : t <= 5 ? `${D}: a marginal win` : t <= 9 ? `${A}: a marginal win` : `${A} win`, text: `${game.assaultPoints} assault points, +${Math.floor(vp[game.attacker] / 500)} for the attackers' victory points, -${Math.ceil(vp[game.defender] / 500)} for the defenders' = ${t}` }
  } else if (id === 'worldbreak') {
    const fled = side => !game.ships.some(s => s.side === side && (s.state === 'active' || s.state === 'reserve')) && game.ships.some(s => s.side === side && s.state === 'disengaged')
    r = game.planetDestroyed ? { title: `${A} win`, text: 'The planet is destroyed.' } : !game.ships.some(s => s.worldbreaker && s.state === 'active') ? { title: `${D} win`, text: 'Every Worldbreaker is destroyed.' }
      : fled(game.attacker) ? { title: `${D} win`, text: 'The attackers disengaged.' } : fled(game.defender) ? { title: `${A} win`, text: 'The defenders disengaged.' } : { ...byVP(), text: '' }
  } else r = { ...byVP(), text: id === 'blockade' ? 'Victory points, with the runners\' ships off the blockaders\' edge.' : 'Victory points.' }
  return { ...r, why, vp }
}
export { isHulk, active, rollDice }
