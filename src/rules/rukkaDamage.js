// Damage rules for the Rukka craft that are not ordinary ships: the Rukka hulk's own critical table, its catastrophic
// results, and the Lump (damage instead of criticals, breaking up into Blast Markers).
// Exports hulkCritical, lumpCritical, lumpBreaksUp and hulkBreaksUp; damage.js calls them when a Rukka hulk or Lump is hit.
import { rollDice, sum, d6 } from './dice.js'
import { addMod } from './dicestr.js'
import { say, diceText as fmt, placeBlastCluster, onTable, leadershipTest, baseR } from './game.js'
import { arcsContaining, dist } from './geometry.js'

const LOC_OF_ARC = { front: 'prow', left: 'port', right: 'starboard', rear: 'aft' }
// the effects in table order: a result that cannot apply right now moves up to the next entry along
const EFFECTS = ['lance', 'shield', 'turret', 'bay', 'torpedo', 'battery', 'thruster']

/** The Rukka hulk's critical table. `rolls` (tests) may give the d6 faces; otherwise the game's dice are used. Returns the text. */
export function hulkCritical (game, ship, rolls = []) {
  const next = () => rolls.length ? rolls.shift() : rollDice(game.rng, 1)[0]
  if ((ship.upgrades ?? []).includes('mad')) {   // Mad Spannerz let the hulk ignore a critical hit on a D6 of 6
    const m = next()
    if (m === 6) { say(game, `${ship.name}: Mad Spannerz rolled ${m} — the critical hit is ignored`); return 'ignored' }
    say(game, `${ship.name}: Mad Spannerz rolled ${m}, needed 6 to ignore the critical`)
  }
  const main = next()
  let idx
  if (main <= 2) { const s = next(); idx = s <= 2 ? 0 : s <= 4 ? 1 : 2 }
  else if (main <= 4) { const s = next(); idx = s <= 2 ? 3 : s <= 4 ? 4 : 5 }
  else idx = 6
  const arc = ship.lastHitFrom ? (arcsContaining(ship.pos, ship.facing, ship.lastHitFrom)[0] ?? 'front') : 'front'
  const loc = LOC_OF_ARC[arc]
  const p = { ...ship.profile, weapons: ship.profile.weapons.map(w => ({ ...w })) }
  const apply = e => {
    if (e === 'lance') { const w = p.weapons.find(w => w.kind === 'lance' && w.str > 0); if (!w) return null; w.str--; return '-1 dorsal lance' }
    if (e === 'shield') { if (p.shields <= 0) return null; p.shields--; return '-1 shield' }
    if (e === 'turret') { if (p.turrets <= 0) return null; p.turrets--; return '-1 turret strength' }   // the table entry is read as -1 turret strength
    if (e === 'bay') { const w = p.weapons.find(w => w.kind === 'bays' && w.loc === loc && loc !== 'prow' && loc !== 'aft'); if (!w) return null; w.str = addMod(w.str, -1); return `-1 launch bay (${w.loc})` }
    if (e === 'torpedo') { const w = p.weapons.find(w => w.kind === 'torpedo' && w.loc === loc && loc !== 'aft'); if (!w) return null; w.str = addMod(w.str, -1); return `-1 torpedo strength (${w.loc})` }
    if (e === 'battery') { const w = p.weapons.find(w => w.kind === 'battery' && w.loc === loc); if (!w) return null; w.str = addMod(w.str, -2); return `-2 weapons battery firepower (${w.loc})` }
    ship.crits.hulkThrust = (ship.crits.hulkThrust ?? 0) + 1
    return `thruster assemblies hit (${ship.crits.hulkThrust}): it must roll higher than this on a D6 to turn`
  }
  let text = null
  for (let i = idx; i < EFFECTS.length && !text; i++) text = apply(EFFECTS[i])
  ship.profile = p
  say(game, `${ship.name}: Rukka hulk critical table rolled ${main} — ${text}`)
  return text
}

/** A Lump takes +1 damage for each critical hit instead of rolling on the table. `damage` is damage.js damageShip. */
export function lumpCritical (game, ship, damage) {
  say(game, `${ship.name}: a Lump takes one more point of damage for a critical hit`)
  damage(game, ship, 1, { what: 'a critical hit on a Lump', noCrits: true })
}

/** A Lump reduced to 0 damage breaks up and is replaced by 4 Blast Markers (no Catastrophic Damage roll). */
export function lumpBreaksUp (game, ship) {
  ship.state = 'destroyed'
  say(game, `${ship.name} breaks up and is replaced by 4 Blast Markers`)
  placeBlastCluster(game, ship.pos, 4)
}

/** A Rukka hulk's plasma drive overload tears it into an asteroid field D3x5 cm wide and long, no damage to other ships; an aether drive implosion leaves an aether rift that affects the ships caught in it at once. */
export function hulkBreaksUp (game, ship, aether) {
  ship.state = 'destroyed'
  game.terrain ??= []
  if (!aether) {
    const side = Math.ceil(d6(game.rng) / 2) * 5
    game.terrain.push({ id: game.nextId++, kind: 'asteroids', shape: { t: 'circ', x: ship.pos.x, y: ship.pos.y, r: side / 2 } })   // a circle of the same width stands for the square (shapes are circles and ellipses)
    say(game, `${ship.name}: plasma drive overload — it is torn apart into an asteroid field ${side} cm across, and no ship nearby is damaged`)
    return
  }
  const r = baseR(ship)
  game.terrain.push({ id: game.nextId++, kind: 'rift', shape: { t: 'circ', x: ship.pos.x, y: ship.pos.y, r } })
  say(game, `${ship.name}: aether drive implosion — the hulk is hurled into the Aether and an aether rift is left where it was`)
  for (const o of onTable(game)) {
    if (o === ship || dist(o.pos, ship.pos) > r + baseR(o)) continue
    const t = leadershipTest(game, o, { dice: 3, why: 'caught in the new aether rift' })
    if (!t.pass) { o.state = 'lost'; say(game, `${o.name} is lost in the aether!`) }
  }
}
