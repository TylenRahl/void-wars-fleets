// REACTIVE HULLS of the Katharos fleet, kept as small pure helpers with no imports, so damage.js, armour.js, game.js,
// movement.js, effects.js, endPhase.js, firms.js and katharos.js can all ask the same question.
// Exports isReactive, saveNeeded, reactiveArmour, repairNeeded and hasOssuary.
// A profile with `reactive: true` has a `save` (the number in its Shields column).
//
// Reactive hulls ignore the Damage, Resolve and Movement penalties of solar flares, radiation, gas clouds and Blast
// Markers. The ships are Armour 6 and save each hit: 6+ for Raiders, 5+ for Harvesters and Sickles, 4+ for Cryptships
// (the Pall's profile has 5+). This save takes the place of the brace save and is handled the same way. A Katharos ship
// on Brace for Impact saves on 2+ instead, but loses its stealth and drops to Armour 4+.
export const isReactive = ship => !!ship?.profile?.reactive
const isBracedNow = ship => ship?.order?.kind === 'brace'
/** The D6 a point of damage must reach to be saved: 4+ braced, or for a reactive hull its printed save, 2+ when braced. null = no save. */
export function saveNeeded (ship) {
  if (isReactive(ship)) return isBracedNow(ship) ? 2 : ship.profile.save
  return isBracedNow(ship) || ship?.profile?.braceAlways ? 4 : null   // A Gulper counts as always braced when it takes damage, a 4+ save against each hit
}
/** The armour a braced reactive hull drops to, or the printed value. */
export const reactiveArmour = (ship, printed) => isReactive(ship) && isBracedNow(ship) ? Math.min(printed, 4) : printed
/** Critical repairs: 4+ on a reactive hull (every Katharos repair roll), else 6. */
export const repairNeeded = ship => isReactive(ship) ? 4 : 6
/** True if this ship carries an Ossuary (the Barrow cryptship, +50 points), which also gives it Resolve 10. */
export const hasOssuary = ship => ship?.profile?.weapons?.some(w => (w.book ?? w.kind) === 'ossuary') ?? false
