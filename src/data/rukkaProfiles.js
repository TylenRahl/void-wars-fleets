// Rukka ship details the drawn profiles in concordShips.js do not carry. Exports RUKKA_EXTRA and rukkaOver(ship), which data/fleets.js applies.
// Covers special lines the engine reads (rules/game.js looks for "Come to New Heading" in `special`), Souped-Up Engines, ramming dice, base size
// and a hulk's fixed Resolve.
export const RUKKA_EXTRA = {
  'rukka-hulk': { fixedLd: 6, noAheadFullMove: true, hulk: true, special: ['No Come to New Heading or Burn Retros orders.'] },
  'rukka-bigdens-revenge': { special: ['Cannot use Come to New Heading special orders.'], swapLd: true },
  'rukka-slammer': { special: ['Cannot use Come to New Heading special orders.'], swapLd: true },
  'rukka-deadcert': { aheadFullDice: 4, special: ['Cannot use Come to New Heading special orders. Souped-Up Engines: 4D6 on All Ahead Full.'], swapLd: true },
  'rukka-bullyboy': { aheadFullDice: 4, special: ['Cannot use Come to New Heading special orders. Souped-Up Engines: 4D6 on All Ahead Full.'], swapLd: true },
  'rukka-hammer': { special: ['Cannot use Come to New Heading special orders.'], swapLd: true, chucka: true },
  'rukka-razzas-grabber': { special: ['Cannot use Come to New Heading special orders.'], base: 'large' },
  'rukka-grunt': { special: ['Cannot use Come to New Heading special orders.'], base: 'large', boardHits: 2 },   // Tractor field, 60 mm base, counts as 2 HP for boarding
  'rukka-grunt-grabbers': { special: ['Cannot use Come to New Heading special orders.'], base: 'large', boardHits: 2 },
  'rukka-brute': {},
  'rukka-lump': { lump: true, special: ['No Come to New Heading or Burn Retros orders.'], shieldsOk: true },   // ramDice 4 is on the drawn profile
}
/** Kinds of weapon the drawn Rukka profiles use whose `str` is dice or 'special'. */
export const rukkaOver = s => {
  const x = RUKKA_EXTRA[s.id]
  if (!x) return s
  // The Hammer's prow chuckas fire torpedoes or the bombardment cannon, one loaded state between them
  const weapons = x.chucka ? s.weapons.map(w => w.loc === 'prow' && (w.kind === 'torpedo' || w.kind === 'bombardment') ? { ...w, shared: 'chucka' } : w) : s.weapons
  return { ...s, ...x, weapons }
}
