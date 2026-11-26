// The default sea fleets. Exports SEA_DEFAULT_POINTS, SEA_DEFAULT_FLEETS and seaDefaultFleet(fleet); read by battle.js's sea set-up page.
// One ready fleet per sea race, inside 500 points (the sea set-up page starts there), each legal by its own fleet list
// (checked in seaDefaults.test.js with rules/fleet.js checkFleet). Kept in the set-up page's own form (battle.js setup.fleets): ships in
// order, escorts sharing a squad id, `flag` the commander's ship, `up` a ship's upgrades. They head the Saved fleet list at sea and fill an
// empty side.
// Human fleet (freemen): a Lantern, a Rimward and four escorts; no Admiral needed under 750 points, 495 points
// Elf fleet (athanatoi): the Corsairs, an Eclipse, a Shadow and a Kalyx (the only escort, so alone); no commander under 750, 500 points
// Orc fleet (rukka): Big Ruck, a Bovver ship and a Bash cruisa, three escorts, a Gaffer on the Terror (needed from 500), 495 points
// Dominion fleet (dominion): a Malice and a Bloodshed, three escorts, under the Harrow Admiral the Dominion always has, 500 points
const esc = (id, squad) => ({ id, squad })
export const SEA_DEFAULT_POINTS = 500
export const SEA_DEFAULT_FLEETS = {
  freemen: { name: 'Default Human fleet', list: { fleet: 'freemen', cmd: '', rerolls: 0, marks: [], squads: ['d1'],
    ships: [{ id: 'lantern', squad: null }, { id: 'rimward', squad: null }, esc('sword', 'd1'), esc('sword', 'd1'), esc('sword', 'd1'), esc('adder', 'd1')] } },
  athanatoi: { name: 'Default Elf fleet', list: { fleet: 'athanatoi', list: 'corsair', cmd: '', rerolls: 0, marks: [], squads: ['d1'],
    ships: [{ id: 'ath-selene', squad: null, picks: [] }, { id: 'ath-veil', squad: null, picks: [] }, esc('ath-kalyx', 'd1')] } },
  rukka: { name: 'Default Orc fleet', list: { fleet: 'rukka', list: 'bigruck', cmd: '', rerolls: 0, marks: [], squads: ['d1'],
    ships: [{ id: 'rukka-terror', squad: null, up: ['gaffer'], picks: [] }, { id: 'rukka-bash-cruisa', squad: null, picks: [] },
      esc('rukka-ravager', 'd1'), esc('rukka-ravager', 'd1'), esc('rukka-onslaught', 'd1')] } },
  dominion: { name: 'Default Dominion fleet', list: { fleet: 'dominion', cmd: 'harrowadmiral-8', rerolls: 0, marks: [], squads: ['d1'],
    ships: [{ id: 'malice', squad: null }, { id: 'bloodshed', squad: null }, esc('profaner', 'd1'), esc('profaner', 'd1'), esc('faithless', 'd1')] } },
}
/** A fresh copy of a race's default fleet in the set-up page's form, or null. */
export const seaDefaultFleet = fleet => SEA_DEFAULT_FLEETS[fleet] ? JSON.parse(JSON.stringify(SEA_DEFAULT_FLEETS[fleet].list)) : null
