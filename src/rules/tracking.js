// Isos tracking systems. An Isos ship within range of a friendly ship or defence with tracking systems re-rolls its turret
// misses and ignores the column shift for batteries firing beyond 30 cm. The system works under every special order,
// Brace For Impact included (nothing here reads an order).
// profile.tracking = the range in cm (10; the Lattice's is 20), measured stem to stem like every "within N cm" in this
// engine. A tracking ship feeds itself too, and Isos defences count as Isos vessels.
// Exports trackedBy and rollTurrets; shooting.js, ordnance.js and defences.js use them.
import { rollDice, count } from './dice.js'
import { dist } from './geometry.js'
import { active, isPhageShip, blastTouching } from './game.js'

const isIsos = s => s.profile.fleet === 'isos' || s.profile.race === 'isos'
/** The ship that gives `ship` its tracking feed (an active friendly Isos ship or defence with tracking in range), or null. */
export function trackedBy (game, ship) {
  if (!isIsos(ship) || !ship.pos) return null
  return active(game).find(t => t.side === ship.side && t.profile.tracking && dist(t.pos, ship.pos) <= t.profile.tracking + 1e-6) ?? null
}
/** Roll `n` turret dice needing `need`+. A tracked ship re-rolls its misses once. Returns { dice, again, hits, text }. */
export function rollTurrets (game, ship, n, need) {
  // Phage: each Blast Marker touching the ship makes one spore cloud hit on 6+ rather than 4+ (no change for ordnance that already needs 6+)
  const six = isPhageShip(ship) && need < 6 ? Math.min(n, blastTouching(game, ship).length) : 0
  const dice = rollDice(game.rng, n)
  let hits = count(dice.slice(0, n - six), need) + count(dice.slice(n - six), 6), again = []
  const by = trackedBy(game, ship)
  if (by && n > hits) { again = rollDice(game.rng, n - hits); hits += count(again, need) }
  return { dice, again, hits, by, text: `rolled ${dice.join(', ')}${six ? ` (${six} spore${six > 1 ? 's' : ''} hit only on 6+ for the Blast markers in contact)` : ''}${again.length ? `; tracking (${by.name}) re-rolls the ${again.length} miss${again.length > 1 ? 'es' : ''}: ${again.join(', ')}` : ''}` }
}
