// The Katharos stat lines. Exports KATHAROS_PROFILES, which data/fleets.js lays over the drawn ships in concordShips.js (KATHAROS_FLEET), whose
// hull rows only carry placeholder speed, armour and turrets. `reactive` + `save` is the reactive hull: the Shields column holds a save, not
// shields, so `shields` is 0. Every ship has armour 6+.
const SPECIAL_ALL = [
  'Reactive hull: a save against every point of damage; 2+ and armour 4+ on Brace for Impact!.',
  'Immune to damage, Resolve and movement modifiers from solar flares, radiation, gas clouds and Blast Markers.',
  'Null-mass drive: D6 x 10 cm on All Ahead Full, a turn for every 20 cm travelled.',
  'May fade out (disengage automatically) at the end of its Manoeuvre Phase.',
]
const CAP = ['Own critical hits table; repairs on 4+.']
const base = (save, speed, turns, turrets) => ({ shields: 0, save, reactive: true, speed, turns, turrets, armour: { front: 6, other: 6 } })
export const KATHAROS_PROFILES = {
  'kat-barrow': { ...base(4, 20, 45, 4), special: [...CAP, ...SPECIAL_ALL] },
  'kat-barrow-ossuary': { ...base(4, 20, 45, 4), special: ['Ossuary: Resolve 10.', ...CAP, ...SPECIAL_ALL] },
  'kat-sickle': { ...base(5, 30, 45, 3), special: [...CAP, ...SPECIAL_ALL] },
  'kat-pall': { ...base(5, 30, 45, 1), special: ['Uncrippled: never activates orbital mines and gives the enemy no Command check bonus for being on special orders.',
    'While any Pall is uncrippled, the fleet adds a further +1 to its Command checks whenever an enemy ship is on special orders.', ...CAP, ...SPECIAL_ALL] },
  'kat-vigil': { ...base(6, 40, 90, 1), special: ['Portal cannot target anything with more than 6 hits remaining.', ...SPECIAL_ALL] },
  'kat-knell': { ...base(6, 50, 90, 1), special: SPECIAL_ALL },
}
