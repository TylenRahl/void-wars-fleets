// WHICH ARMOUR VALUE A SHOT MEETS: the front, the sides or the rear of a ship, with the Isos deflector and the Explorer's weaker rear.
// One place, read by shooting, torpedoes, bombers, mines and rams, so the three never disagree.
// Exports frontArmour, armourAt, armourFrom and lowestArmour.
// profile.armour = { front, other, rear? }: only the Explorer has a separate rear value (5+, rear 4+); every other ship uses `other` there.
// profile.deflector: `armour.front` holds the value with the deflector working (6). The deflector sits on the prow, so a prow
// weapons critical knocks it out until repaired: while crits.prow is set the front counts as `armour.other`.
// This is armour, not a shield.
import { arcsContaining } from './geometry.js'
import { reactiveArmour } from './hull.js'   // a braced Katharos hull drops to armour 4+

/** The armour on the front of this ship now. */
export const frontArmour = ship => reactiveArmour(ship, ship.profile.deflector && ship.crits?.prow ? ship.profile.armour.other : ship.profile.armour.front)
/** The armour for an discipline of the TARGET: 'closing' (front), 'away' (rear) or 'abeam' (the sides), the names the gunnery table uses. */
export function armourAt (ship, discipline) {
  const a = ship.profile.armour
  return discipline === 'closing' ? frontArmour(ship) : reactiveArmour(ship, discipline === 'away' ? (a.rear ?? a.other) : a.other)
}
/** The armour a hit from the point `from` meets (a torpedo, a mine, a ram): the front if the point is in the front arc, else the rear if it is only in the rear arc, else the sides. */
export function armourFrom (ship, from) {
  const arcs = arcsContaining(ship.pos, ship.facing, from)
  return armourAt(ship, arcs.includes('front') ? 'closing' : arcs.includes('rear') && !arcs.includes('left') && !arcs.includes('right') ? 'away' : 'abeam')
}
/** The weakest armour on the ship, which bombers attack against. */
export const lowestArmour = ship => Math.min(frontArmour(ship), reactiveArmour(ship, ship.profile.armour.other), reactiveArmour(ship, ship.profile.armour.rear ?? Infinity))
