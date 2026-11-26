// The Thnitoi fleet list (Void Pirates Fleet List). Exports THNITOI_CLASSES (weapon options per class) and THNITOI_LISTS (the list, its
// commander, upgrades and limits), which data/fleetLists.js merges with the other fleets' tables. The Athanatoi Haven pirate base is in no
// list, so it is not fielded; Freemen transports are other races' ships and are not included.
//
// Weapon choices are each a drawn ship (the Agony's extras, the Corsair's second weapon), so a choice is a suffix on the class id and costs 0 here: the drawn ship's own points
// already carry the +20/+40 (concordShips.js: 230 and 250). The Agony's extras (1-2 Harpoon Assault Modules +20/+40, Launch Bays +40,
// Prow Torpedoes +20, Hollow Lance +20) are a pick of one, so they share one slot.

export const THNITOI_CLASSES = {
  'thn-agony': { options: [{ slot: 'extra', label: 'One of', choices: [
    { name: 'no extra weapon', points: 0, suffix: '' },
    { name: 'launch bays (+40)', points: 0, suffix: '-bays' },
    { name: 'prow hollow lance (+20)', points: 0, suffix: '-lance' },
    { name: 'prow torpedoes (+20)', points: 0, suffix: '-torpedo' },
    { name: '1 Harpoon assault module (+20)', points: 0, suffix: '-harpoon' },
    { name: '2 Harpoon assault modules (+40)', points: 0, suffix: '-harpoons' }] }] },
  // The Corsair picks one second prow weapon at no extra cost. The bare Corsair id is the drawn torpedo one.
  'thn-corsair': { options: [{ slot: 'extra', label: 'Second prow weapon', choices: [
    { name: 'prow torpedoes', points: 0, suffix: '' },
    { name: 'prow weapons battery (3)', points: 0, suffix: '-guns' },
    { name: 'prow hollow lance', points: 0, suffix: '-lance' },
    { name: 'Harpoon assault module', points: 0, suffix: '-harpoon' }] }] },
}

const hasTubes = e => !!e.p?.weapons.some(w => w.kind === 'torpedo')
const UPS = [
  // False-flag Engines +20 on an Agony, +5 on a Corsair
  { id: 'mimic', name: 'False-flag engines', points: e => e.capital ? 20 : 5, on: () => true, text: 'a free move after deployment; hidden in the first turn if over 30 cm from the enemy' },
  // Torpedo bombers +15 a launch bay strength point for Thnitoi vessels
  { id: 'tbombers', name: 'Torpedo bombers', perBay: 15, on: 'capital', needs: 'bays', excludes: ['mines'], text: 'the bays may also launch torpedo bombers' },
  // Orbital mines replace all other attack craft, +5 per bay strength, cruisers only; turrets hit them on a 6 (defences.js)
  { id: 'mines', name: 'Orbital mines', perBay: 5, on: e => e.capital && e.role === 'cruiser', needs: 'bays', excludes: ['tbombers'], text: 'the bays launch orbital mines instead of attack craft' },
  // A ship may begin the game with lamprey torpedoes already loaded, noted on its ship sheet, at no cost
  { id: 'leechstart', name: 'Lamprey torpedoes loaded at the start', points: 0, on: hasTubes, text: 'the tubes start with lamprey torpedoes' },
]
// The Dread Void Prince adds +2 to the ship's Resolve to a maximum of 10, 100 points, re-rolls one +25, two +50, three +100, none free
const VOIDPRINCE = { id: 'voidprince', name: 'Dread Void Prince', mode: 'plus', plus: 2, cap: 10, points: 100, free: 0, prices: [0, 25, 50, 100] }

export const THNITOI_LISTS = {
  lists: [{
    id: 'pirates', name: 'Void Pirates Fleet List', attackRating: () => 4,   // Thnitoi 4
    ships: { 'thn-agony': ['cruiser', 'capital'], 'thn-corsair': ['escort'] },
    commanders: { requiredOver: 750, label: 'Dread Void Prince', options: [VOIDPRINCE] },
    upgrades: UPS,
    limits: [
      { of: 'cruiser', max: 12, text: '0-12 cruisers' },
      // Three escorts or more for each capital ship
      { check: ctx => ctx.n('escort') < 3 * ctx.n('capital') ? [`needs three escorts per capital ship: ${ctx.n('capital')} capital ship${ctx.n('capital') === 1 ? '' : 's'} need ${3 * ctx.n('capital')}, there ${ctx.n('escort') === 1 ? 'is' : 'are'} ${ctx.n('escort')}`] : [] },
    ],
  }],
}
