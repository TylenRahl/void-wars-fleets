// Fleet fields: the Athanatoi mirage fields. Written once, as a table of fields and one save, so the Thnitoi void
// fields are just another entry. Exports FIELDS, fieldOf, fieldShift, fieldSave and ramSave, used by shooting.js,
// ordnance.js, movement.js, defences.js, firms.js, phage.js, phageDamage.js, endPhase.js and the battle screen.
//
// What a mirage field does:
// - against the gunnery table (weapons batteries): one column shift to the right, on top of the range and Blast Marker
// shifts (the caller adds it: shooting.js shiftColumn, using fieldShift);
// - against everything else (lances and every other strength-based weapon, sunburst cannon, ordnance hits, Hit-and-Run,
// ramming, boarding): the attack is rolled as normal and then the Athanatoi player rolls a D6 per attack that
// would hit: a 1 is a hit, 2-6 is a miss and a Blast Marker is placed in contact with the ship (fieldSave below);
// - NOT against moving through Blast Markers, area effects, exploding ships, celestial phenomena, Aether Drive
// implosions: those never call fieldSave;
// - brace is decided BEFORE the save; a braced ship's 4+ saves then work on the hits that got through,
// not on those the mirage field absorbed.
// Hulks have no mirage fields. A Mirage Field Generators Destroyed critical removes them for good.
import { rollDice } from './dice.js'
import { say, diceText as fmt, isHulk, offerBrace, placeBlastOnShip } from './game.js'

/**
 * The fields by fleet. `through(roll)`: does this roll let the hit through? `lostBy`: the critical hit key that removes it.
 * `shift`: columns to the right on the gunnery table.
 */
export const FIELDS = {
  // Void fields work exactly like mirage fields; only the name and the critical that removes them differ
  thnitoi: { name: 'voidfield', shift: 1, through: r => r === 1, rule: '1 lets the hit through, 2-6 is a miss and a Blast Marker', lostBy: 'voidfield' },
  athanatoi: { name: 'miragefield', shift: 1, through: r => r === 1, rule: '1 lets the hit through, 2-6 is a miss and a Blast Marker', lostBy: 'miragefield' },
}

/** The field this ship has now, or null (a hulk has none; a destroyed generator is gone for good). */
export function fieldOf (ship) {
  const f = FIELDS[ship?.profile?.fleet]
  return f && !isHulk(ship) && !ship.crits?.[f.lostBy] ? f : null
}
/** Columns the field moves a gunnery table attack to the right. */
export const fieldShift = ship => fieldOf(ship)?.shift ?? 0

/**
 * The save, once per attack that would hit (once per successful lance hit, per ordnance hit, per Hit-and-Run
 * attack, per sunburst cannon shell hit, per ramming or boarding attempt). `n` attacks are rolled together.
 * opts: what (for the log), from (where the attack came from: the Blast Marker goes on that side),
 * by (the attacker, for the brace prompt), key (one brace question per attack), braceAsked (the caller has already
 * offered Brace for Impact! for this attack, so don't ask again).
 * Returns { through, saved, dice, field }: `through` is how many attacks still hit; a ship with no field gets all of them
 * through and rolls nothing.
 */
export function fieldSave (game, ship, n, { what = 'the attack', from = null, by = null, key = null, braceAsked = false } = {}) {
  const field = n > 0 ? fieldOf(ship) : null
  if (!field) return { through: n, saved: 0, dice: [], field: null }
  // Brace is decided before the mirage field save is rolled
  if (!braceAsked) offerBrace(game, ship, { by, what, key: key ?? `field-${ship.uid}-${game.round}-${what}` })
  let dice = rollDice(game.rng, n)
  // A Duskhunter in base contact with attack craft may re-roll a failed mirage field save, the second roll standing; only against attack craft
  // (the callers name the attack, so a bomber, assault boat or fighter attack counts, a torpedo does not)
  if (ship.profile.rules?.craftReroll && /bomber|assault|fighter|attack craft|raider|vampire/i.test(what)) {
    const first = dice
    dice = dice.map(r => field.through(r) ? rollDice(game.rng, 1)[0] : r)
    if (dice.some((r, i) => r !== first[i]) || first.some(field.through)) say(game, `${ship.name} (Duskhunter) re-rolls its failed mirage field saves against attack craft: ${fmt(first)} becomes ${fmt(dice)}; the second roll stands`)
  }
  const through = dice.filter(field.through).length, saved = n - through
  for (let i = 0; i < saved; i++) placeBlastOnShip(game, ship, from)
  // the board's field picture (src/battle/fx.js): looks only, nothing here reads it back; a drawing error must never touch the rules
  try { game.onFx?.({ kind: 'field', to: ship, from: from ? { x: from.x, y: from.y } : null, saved, through }) } catch { /* drawing only */ }
  say(game, `${ship.name}'s ${({ miragefield: 'mirage field', voidfield: 'void field' })[field.name] ?? field.name} against ${n} ${what} hit${n > 1 ? 's' : ''}: rolled ${fmt(dice)} (${field.rule}): ${through} hit${through === 1 ? '' : 's'} stand${through === 1 ? 's' : ''}, ${saved} missed${saved ? ` and ${saved} Blast Marker${saved > 1 ? 's' : ''} placed in contact` : ''}`)
  return { through, saved, dice, field }
}

/**
 * A mirage field saves ONCE against a ramming attempt, not against the damage that follows a failed save. Reading
 *: a saved ram fails whole -- neither ship rolls for damage -- and a Blast Marker is placed in contact.
 * movement.js resolveRam calls this right after the target's Brace for Impact! was offered (braceAsked), and stops if it returns false.
 */
export function ramSave (game, rammer, target, { braceAsked = true } = {}) {
  const r = fieldSave(game, target, 1, { what: 'ramming', from: rammer.pos, by: rammer, key: `ram-${rammer.uid}-${game.round}`, braceAsked })
  if (r.through) return true
  say(game, `${rammer.name}'s ram on ${target.name} fails: the mirage field turned it aside, no damage to either ship`)
  return false
}
