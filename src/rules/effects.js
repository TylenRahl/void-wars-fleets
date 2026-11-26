// Tabletop effects: fighting sunward, solar flares and radiation bursts. They come from the
// battlezone roll (terrain.js rollBattlezone): the sunward edge, and how many flares and bursts were generated.
// Exports applyBattlezone, firingSunward, startOfTurnEffects, solarFlare, ensureSunward, celestialCheck and cloudCheck;
// used by the turn sequence, shooting, movement and the scenarios.
import { d6 } from './dice.js'
import { say, onTable, shieldsOf, placeBlastOnShip, leadershipTest, isEscort } from './game.js'
import { damageShip, critical } from './damage.js'
import { norm, angleTo, along } from './geometry.js'
import { isReactive } from './hull.js'
import { late as fortLate } from './fort.js'

/** Put a rolled battlezone's terrain and effects into the game. */
export function applyBattlezone (game, z) {
  game.terrain = z.terrain
  game.effects = { zone: z.zone, sunward: z.sunward, flares: z.effects?.flares ?? 0, bursts: z.effects?.bursts ?? 0, flareDone: false, radiation: null }
  for (const line of z.log) game.log.push({ round: 0, side: 0, phase: 'setup', text: line })
}

// The direction of the sunward edge from any point: top is -y (the table's y runs down), so 270°.
export const SUN_DIR = { top: 270, bottom: 90, left: 180, right: 0 }
/** Fighting sunward matters only in the Flare Region, Mercurial Zone and Inner Biosphere (generators 1-3). */
export const sunwardMatters = game => !!game.effects && game.effects.zone <= 3
/** Is `target` in the quarter of the firer's bearing compass that faces the sunward edge? */
export function firingSunward (game, from, target) {
  if (!sunwardMatters(game)) return false
  return Math.abs(norm(angleTo(from, target) - SUN_DIR[game.effects.sunward])) <= 45
}

/** Radiation interference lowers every ship's Resolve for the rest of the turn. */
export const radiationNow = game => game.effects?.radiation?.round === game.round ? game.effects.radiation.level : 0

/**
 * At the start of each turn (the game turn, both players' —): a D6 per solar flare generated, a flare
 * on a 6, once a game; a D6 per radiation burst generated, a burst on 5-6, one a turn.
 */
export function startOfTurnEffects (game) {
  const e = game.effects
  if (!e) return
  if (e.flares && !e.flareDone) {
    const rolls = Array.from({ length: e.flares }, () => d6(game.rng))
    const hit = rolls.includes(6)
    say(game, `Solar flare: rolled ${rolls.join(', ')} — ${hit ? 'a flare erupts!' : 'nothing (a 6 is needed)'}`)
    if (hit) { e.flareDone = true; solarFlare(game) }
  }
  if (e.bursts) {
    const rolls = Array.from({ length: e.bursts }, () => d6(game.rng))
    if (rolls.some(r => r >= 5)) {
      const level = d6(game.rng)
      e.radiation = { round: game.round, level }
      say(game, `Radiation burst: rolled ${rolls.join(', ')} — a burst! Interference level ${level}: every ship is -${level} Resolve for the rest of this turn, and Fleet Commanders may use re-rolls only for Command checks on their own ship or squadron`)
    } else say(game, `Radiation burst: rolled ${rolls.join(', ')} — nothing (5 or 6 needed)`)
  }
}

// Every ship on the table gets a Blast Marker on its sunward side; a ship without shields takes a hit
// and a critical on 4+; each ordnance marker is removed on 4+.
// `centre`: a flare centred on a point instead of the sunward edge (the Bastion's hyper-plasma meltdown, whose flare starts at the fort), the Blast Marker goes
// on the side facing that point and a sailing ship turns directly away from it; `skip`: ships the flare does not touch (the ones the lance shots already struck).
export function solarFlare (game, { centre = null, skip = [] } = {}) {
  const far = centre ? () => centre : { top: p => ({ x: p.x, y: -1000 }), bottom: p => ({ x: p.x, y: 1000 }), left: p => ({ x: -1000, y: p.y }), right: p => ({ x: 1000, y: p.y }) }[game.effects.sunward]
  for (const s of onTable(game)) {
    if (skip.includes(s)) continue
    if (s.profile.sail && celestialCheck(game, s, 'solar flare')) {
      // A sailing ship that passes is unharmed but is pushed 2D6 cm straight away from the sunward edge
      const dice = [d6(game.rng), d6(game.rng)], cm = dice[0] + dice[1]
      s.facing = centre ? (angleTo(centre, s.pos) + 360) % 360 : (SUN_DIR[game.effects.sunward] + 180) % 360
      s.pos = along(s.pos, s.facing, cm)
      say(game, `${s.name} turns directly away from the sun edge and moves 2D6 = ${dice.join(' + ')} = ${cm} cm`)
      if (s.pos.x < 0 || s.pos.x > game.table.w || s.pos.y < 0 || s.pos.y > game.table.h) { s.state = 'disengaged'; say(game, `${s.name} is carried off the table edge and has disengaged`) }
      continue
    }
    // A Thnitoi ship that passes the check ignores the flare (their rule has no turn away from the sun and no 2D6 move)
    if (s.profile.fleet === 'thnitoi' && celestialCheck(game, s, 'solar flare')) { say(game, `${s.name} ignores the solar flare`); continue }
    placeBlastOnShip(game, s, far(s.pos))
    say(game, `${s.name}: a Blast Marker on its sunward side from the solar flare`)
    if (isReactive(s)) { say(game, `${s.name}: a reactive hull is immune to the damage of solar flares`); continue }
    if (shieldsOf(s) === 0) {
      damageShip(game, s, 1, { what: 'the solar flare', noCrits: true, noSave: true })
      const r = d6(game.rng)
      say(game, `${s.name} has no shields: 1 hit from the flare, and rolled ${r} for critical damage (4+ needed)`)
      if (r >= 4 && s.state === 'active') critical(game, s)
    }
  }
  for (const o of [...game.ordnance]) {
    const r = d6(game.rng)
    if (r >= 4) { game.ordnance = game.ordnance.filter(x => x !== o); say(game, `The flare sweeps away ${o.kind === 'torpedo' ? 'a torpedo salvo' : 'an attack craft wave'}: rolled ${r}, removed on 4+`) }
    else say(game, `${o.kind === 'torpedo' ? 'A torpedo salvo' : 'An attack craft wave'} survives the flare: rolled ${r}`)
  }
}

/**
 * The Athanatoi sail by the sunward table edge, so every game with an Athanatoi fleet on either side needs
 * one, in every battlezone including Cruiser Duel and a table with no phenomena. If the game has
 * none yet, roll it on the same D6 as a battlezone's (terrain.js) with the game's own dice, and keep
 * the effects otherwise empty: no terrain, no flares or bursts, and `zone: 'none'`, so firing sunward doubles nothing
 * (sunward fire only matters in battlezone generators 1-3). A battlezone applied later replaces it. Returns the edge, or null if
 * no Athanatoi are in the game.
 */
export function ensureSunward (game) {
  if (game.effects?.sunward) return game.effects.sunward
  if (!game.sides.some(s => s.fleet === 'athanatoi') && !game.ships.some(s => s.profile.sail)) return null
  const sw = d6(game.rng), sunward = ['top', 'top', 'bottom', 'bottom', 'left', 'right'][sw - 1]
  game.effects = { zone: 'none', sunward, flares: 0, bursts: 0, flareDone: false, radiation: null, ...game.effects }
  game.effects.sunward = sunward
  say(game, `Sunward edge for the Athanatoi's sails: D6 rolled ${sw}, the ${sunward} edge (which number is which edge is the computer's choice)`)
  return sunward
}

/**
 * An Athanatoi ship may take a Resolve Test to shrug off a celestial phenomenon (gas clouds, solar flares and the like),
 * and an escort gets a free re-roll of it. A 2D6 Resolve Test; an escort that fails rolls once more without spending a Fleet Commander's
 * re-roll (the second roll stands). Not for asteroid fields (their test is the same as everyone's), explosions, sunburst cannon or radiation
 * bursts. Returns true if the ship ignores the phenomenon.
 */
export function celestialCheck (game, ship, what) {
  const dark = ship.profile.fleet === 'thnitoi'   // repeats the rule for the Thnitoi
  let t = leadershipTest(game, ship, { why: `ignore the ${what} (${dark ? 'Thnitoi' : 'Athanatoi'})`, page: dark ? '' : '', reroll: !isEscort(ship) })
  if (!t.pass && isEscort(ship)) t = leadershipTest(game, ship, { why: `ignore the ${what}: the escort's free re-roll`, reroll: false })
  return t.pass
}
/**
 * Gas and dust clouds are Blast Markers in all respects and a celestial phenomenon, so an Athanatoi ship takes the check once a game
 * turn when its move meets one. A pass means it ignores every cloud until the turn is over: blastTouching and the Blast Marker
 * slow-down skip them. Returns true if the ship is ignoring clouds.
 */
export function cloudsIgnored (game, ship) { return ship.cloudOk?.round === game.round && ship.cloudOk.pass }
export function cloudCheck (game, ship) {
  if (ship.cloudOk?.round === game.round) return ship.cloudOk.pass
  const pass = celestialCheck(game, ship, 'gas cloud')
  ship.cloudOk = { round: game.round, pass }
  return pass
}

fortLate.flare = solarFlare   // fort.js reaches the flare through here
