// Scenario One: Cruiser Duel, the first battle to learn the rules with.
// Exports checkForces, createCruiserClash, placeProblem, placeShip, allPlaced, victoryPoints, ZONES, zoneOf and MAX_POINTS;
// used by the battle page, the computer player, scenarios.js and fleet.js.
// Forces: 1 to 4 cruisers each, the same number on both sides, each worth no more than 185 points.
// No celestial phenomena. Roll Resolve before setting up. One player rolls a D6: 1-3 sets up in zone A,
// 4-6 in zone B. Both roll: the lowest sets up a cruiser first, then they alternate. Ships face the opposite long edge.
// Both roll a D6: the highest chooses to go first or second. Eight turns each, or until one fleet is destroyed.
// Victory: 1 point per damage point inflicted; +1 per crippled enemy ship, or +3 per destroyed one instead.
import { shipById } from '../data/ships.js'
import { d6 } from './dice.js'
import { createGame, addShip, rollLeadership, say, isCrippled, isHulk } from './game.js'
import { ensureSunward } from './effects.js'
import { applyPhage } from './phage.js'

// Deployment zones (the game's own choice):
// zone A is the 30 cm along the top long edge, zone B the 30 cm along the bottom one.
export const ZONES = { A: { y0: 0, y1: 30, facing: 90 }, B: { y0: 90, y1: 120, facing: -90 } }
/** A set-up zone on this game's table: 30 cm deep along each long edge, so on a bigger table (the sea, game.js SEA_TABLE) zone B moves down with the edge. */
export const zoneOf = (game, letter) => letter === 'A' ? ZONES.A : { ...ZONES.B, y0: game.table.h - 30, y1: game.table.h }
export const MAX_POINTS = 185

/** Is this a legal Cruiser Duel force? Returns null, or the reason it isn't. */
export function checkForces (lists) {
  const [a, b] = lists
  if (a.ships.length < 1 || a.ships.length > 4) return 'each fleet has between one and four cruisers'
  if (a.ships.length !== b.ships.length) return 'both sides have the same number of cruisers'
  for (const l of lists) for (const id of l.ships) {
    const p = shipById(id)
    if (!p || p.fleet !== l.fleet) return `${id} is not in the ${l.fleet} fleet list`
    // The Phage may field a queen ship plus three cruisers in place of four cruisers; no refits or escorts, so only the ships are checked
    if (l.fleet === 'phage' && p.hive) {
      if (l.ships.filter(x => shipById(x)?.hive).length > 1) return 'the Phage may use one queen ship and three cruisers'
      if (l.ships.length !== 4) return 'a queen ship takes the place of one of four cruisers: one queen ship and three cruisers'
      continue
    }
    if (p.type !== 'cruiser') return `${p.name} is not a cruiser`
    if (p.points > MAX_POINTS) return `${p.name} costs ${p.points} points; each cruiser is worth no more than ${MAX_POINTS}`
  }
  return null
}

/**
 * Set up a Cruiser Duel: lists = two { name, fleet, ships: [ids] }. Rolls Resolve, which zone each side takes,
 * and who places first. The players then place ships with placeShip, alternating, and the winner of the first-turn
 * roll (game.firstChooser) picks who starts (startBattle in turn.js).
 */
export function createCruiserClash ({ lists, seed = 1, decide }) {
  const bad = checkForces(lists)
  if (bad) throw new Error(bad)
  const game = createGame({ fleets: lists.map(l => ({ name: l.name, fleet: l.fleet })), seed, rounds: 8, decide })
  game.scenario = 'cruiserClash'
  lists.forEach((l, side) => l.ships.forEach(id => addShip(game, side, id)))
  for (const s of game.ships) if (game.sides[s.side].fleet !== 'phage') rollLeadership(game, s)
  // The Phage have no Resolve roll; a queen ship in this scenario is no higher than Resolve 8, Brace For Impact tests on 7 and navigation on 10 (the defaults)
  for (const side of [0, 1]) if (game.sides[side].fleet === 'phage') {
    applyPhage(game, side, game.ships.filter(s => s.side === side))
    for (const h of game.ships.filter(s => s.side === side && s.profile.hive && s.leadership > 8)) { h.leadership = 8; say(game, `${h.name}: in a Cruiser Duel a queen ship is no higher than Resolve 8`) }
  }
  ensureSunward(game)   // The Athanatoi need a sunward edge even here, where there are no phenomena
  const z = d6(game.rng)
  game.zones = z <= 3 ? ['A', 'B'] : ['B', 'A']
  say(game, `${lists[0].name} rolls ${z} for set-up: zone ${game.zones[0]}; ${lists[1].name} takes zone ${game.zones[1]}`)
  let a, b
  do { a = d6(game.rng); b = d6(game.rng) } while (a === b)
  game.placing = a < b ? 0 : 1
  say(game, `Set-up order: ${lists[0].name} ${a}, ${lists[1].name} ${b} — ${lists[game.placing].name} places a cruiser first`)
  do { a = d6(game.rng); b = d6(game.rng) } while (a === b)
  game.firstChooser = a > b ? 0 : 1
  say(game, `First-turn roll: ${lists[0].name} ${a}, ${lists[1].name} ${b} — ${lists[game.firstChooser].name} chooses who goes first`)
  return game
}

/** Place the next ship for the side whose go it is, inside its zone, facing the opposite long edge. */
/** Why this ship can't go there, or null. Asks only: the green shadow reads it as the mouse moves. */
export function placeProblem (game, uid, pos) {
  const s = game.ships.find(x => x.uid === uid)
  const zone = zoneOf(game, game.zones[s.side])
  if (game.phase !== 'setup') return 'the battle has started'
  if (s.side !== game.placing) return `it is ${game.sides[game.placing].name}'s turn to place a ship`
  if (s.pos) return `${s.name} is already placed`
  if (pos.x < 0 || pos.x > game.table.w || pos.y < zone.y0 || pos.y > zone.y1) return `${s.name} must be placed in zone ${game.zones[s.side]}`
  return null
}
export function placeShip (game, uid, pos) {
  const s = game.ships.find(x => x.uid === uid)
  const zone = zoneOf(game, game.zones[s.side])
  const no = placeProblem(game, uid, pos)
  if (no) return { ok: false, reason: no }
  s.pos = { ...pos }; s.facing = zone.facing
  const other = 1 - s.side
  game.placing = game.ships.some(x => x.side === other && !x.pos) ? other : s.side
  return { ok: true }
}
export const allPlaced = game => game.ships.every(s => s.pos)

/** Victory points scored by `side`. */
export function victoryPoints (game, side) {
  let vp = 0
  for (const s of game.ships) {
    if (s.side === side) continue
    vp += Math.min(s.damage, s.profile.hits)
    const destroyed = s.state === 'destroyed' || isHulk(s) || s.state === 'gone'
    vp += destroyed ? 3 : isCrippled(s) ? 1 : 0
  }
  return vp
}
