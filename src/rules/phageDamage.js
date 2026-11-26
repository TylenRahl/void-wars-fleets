// THE PHAGE'S OWN CRITICAL HITS AND CATASTROPHIC DAMAGE TABLES. Phage ships never roll on the standard tables:
// damage.js calls phageCritical and phageCatastrophic instead. Exports PHAGE_CRITS (the 2D6 critical table),
// phageCritical and phageCatastrophic.
import { rollDice, sum, d6, d3, count } from './dice.js'
import { dist } from './geometry.js'
import { say, diceText as fmt, onTable, offerBrace, placeBlastCluster, placeBlastOnShip, shieldsLeft, baseR, ORDERS } from './game.js'
import { damageShip, hitWithShields, tableCritical } from './damage.js'
import { gunneryDice, disciplines, baseColumn } from './shooting.js'
import { armourAt } from './armour.js'
import { fieldShift } from './miragefield.js'

// Keys: sporesHurt / sporesGone (read by game.js sporesOf), starboard / port / prow / thorax (weaponWorks), vents (no turns: movement.js), fire (Heavy wound, repaired as a
// fire is), scent (phage.js), breach / bulkhead as the standard table's extra damage.
export const PHAGE_CRITS = {
  2: { key: 'sporesHurt', extra: 0, text: 'Brood cysts injured — the brood cysts can\'t be used until repaired' },
  3: { key: 'starboard', extra: 0, text: 'Starboard armament wounded — starboard weapons can\'t be used until repaired' },
  4: { key: 'port', extra: 0, text: 'Port armament wounded — port weapons can\'t be used until repaired' },
  5: { key: 'prow', extra: 0, text: 'Prow armament wounded — prow weapons can\'t be used until repaired' },
  6: { key: 'thorax', extra: 1, text: 'Thorax armament wounded — thorax weapons can\'t be used until repaired, +1 damage' },
  7: { key: 'fire', extra: 0, text: 'Heavy wound! — repair it in the End Phase or take 1 extra damage, and it keeps bleeding' },
  8: { key: 'vents', extra: 1, text: 'Discharge vents wounded — no turns until repaired, +1 damage' },
  9: { key: 'scent', extra: 0, text: 'Scent severed — it can\'t be given orders by the Hunger until repaired' },
  10: { key: 'sporesGone', extra: 0, text: 'Brood cysts ruptured — the brood cysts are lost, can\'t be repaired' },
  11: { key: 'breach', extra: 'D3', text: 'Severe wound — +D3 damage' },
  12: { key: 'haemorrhage', extra: 'D6', text: 'Massive haemorrhage — +D6 damage, and a Strength 1 searbile attack on another target within 2D6 cm' },
}
const hasWeaponsAt = (ship, loc) => ship.profile.weapons.some(w => w.loc === loc)

/** One critical hit on a Phage ship: 2D6 on the table, or `roll` (a Hit-and-Run's D6). A result that can't apply becomes the next one up. */
export function phageCritical (game, ship, roll) {
  tableCritical(game, ship, roll, {
    table: PHAGE_CRITS, name: 'Phage critical hits table', nextPage: '',
    skip: (c, ship) => (['starboard', 'port', 'prow', 'thorax'].includes(c.key) && !hasWeaponsAt(ship, c.key))
      || (c.key === 'sporesHurt' && (!ship.profile.spores || ship.crits.sporesHurt || ship.crits.sporesGone))
      || (c.key === 'sporesGone' && (!ship.profile.spores || ship.crits.sporesGone))
      || (c.key === 'scent' && ship.crits.scent),
    counts: c => c.key !== 'haemorrhage' && c.key !== 'breach',
    finish: (c, ship, game) => { if (c.key === 'haemorrhage' && ship.state === 'active') haemorrhage(game, ship) },
  })
}

/** Massive haemorrhage: a Strength 1 searbile attack on one other ship within 2D6 cm, which mirage fields cannot stop. The game picks the nearest other ship. */
function haemorrhage (game, ship) {
  const rd = rollDice(game.rng, 2), reach = sum(rd)
  const t = onTable(game).filter(o => o !== ship && o.state === 'active' && dist(o.pos, ship.pos) <= reach).sort((a, b) => dist(a.pos, ship.pos) - dist(b.pos, ship.pos))[0]
  if (!t) return say(game, `${ship.name}'s ichor sprays 2D6 = ${reach} cm (rolled ${fmt(rd)}): nothing is in reach`)
  offerBrace(game, t, { by: ship, what: 'ichor', key: `ichor-${ship.uid}-${game.round}` })
  const d = d6(game.rng)
  say(game, `${ship.name}'s ichor sprays ${reach} cm (2D6 rolled ${fmt(rd)}) at ${t.name}: a Strength 1 searbile attack, rolled ${d}, needed 4+: ${d >= 4 ? 'hit' : 'miss'}; shields and mirage fields don't stop it`)
  if (d >= 4) damageShip(game, t, 1, { what: 'the ichor' })
}

/** The Phage Catastrophic Damage table. `roll` forces the 2D6 result (All Is Lost). */
export function phageCatastrophic (game, ship, force) {
  const two = force == null ? rollDice(game.rng, 2) : [force], r = force ?? sum(two), hits = ship.profile.hits
  const pre = `${ship.name}: Phage Catastrophic Damage table, 2D6 rolled ${fmt(two)}${force == null ? ` = ${r}` : ' (forced)'} — `
  if (r <= 9) {
    const throes = r >= 8
    if (throes && ship.state === 'blazing') { say(game, pre + 'death throes again'); return }
    const first = ship.state === 'active'
    ship.state = throes ? 'blazing' : 'drifting'
    ship.order = null
    say(game, pre + (throes ? 'Death throes: the wreck moves 4D6 cm forward each Manoeuvre Phase, leaves a Blast marker, and rolls on this table again after each move' : 'Drifting carcass: the wreck moves 4D6 cm forward each Manoeuvre Phase and leaves a Blast marker after each move'))
    if (first) placeBlastOnShip(game, ship, null)
    return
  }
  game.onFx?.({ kind: 'explode', to: { ...ship.pos }, big: true })
  const plasma = r === 12, markers = plasma ? hits : Math.floor(hits / 2)
  ship.state = 'destroyed'
  const rd = rollDice(game.rng, 3), reach = sum(rd)
  say(game, pre + (plasma ? `Searbile detonation: ${markers} Blast markers, and a searbile attack of Strength ${Math.floor(hits / 2)} on every ship within 3D6 = ${reach} cm (rolled ${fmt(rd)}); shields and mirage fields don't work` : `Biological eruption: ${markers} Blast markers, and a burning acid attack of firepower ${hits} on every ship within 3D6 = ${reach} cm (rolled ${fmt(rd)})`) + '')
  placeBlastCluster(game, ship.pos, markers)
  for (const other of onTable(game)) {
    if (other === ship || dist(other.pos, ship.pos) > reach) continue
    offerBrace(game, other, { by: ship, what: 'explosion', key: `explosion-${ship.uid}` })
    if (plasma) {
      const str = Math.floor(hits / 2), dice = rollDice(game.rng, str), n = count(dice, 4)
      say(game, `${other.name} caught in the searbile: Strength ${str} rolled ${fmt(dice)}, needed 4+: ${n} hit${n === 1 ? '' : 's'}`)
      damageShip(game, other, n, { what: 'the searbile detonation' })
    } else {
      // a burning acid attack read as a battery shot at the target's side facing the wreck: the Gunnery table column for its class and discipline, then armour
      const asp = disciplines({ pos: ship.pos }, other)[0], col = Math.max(0, Math.min(4, baseColumn(other, asp) + fieldShift(other))), dice = rollDice(game.rng, gunneryDice(hits, col)), need = armourAt(other, asp), n = count(dice, need)
      say(game, `${other.name} caught in the acid: firepower ${hits}, ${dice.length} dice rolled ${fmt(dice)}, needed ${need}+: ${n} hit${n === 1 ? '' : 's'}`)
      hitWithShields(game, other, n, ship.pos, 'the biological eruption', { pyro: true })
    }
  }
}
export { shieldsLeft, baseR, ORDERS }
