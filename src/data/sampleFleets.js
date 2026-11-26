// Ready-made sample fleets, in the set-up page's form (data/listForm.js), for a quick computer-against-computer battle (battle.html?go)
// and the computer opponent's tests. Exports SAMPLE_POINTS, SAMPLE_FLEETS and sampleFleet(fleet),
// which returns a fresh copy. Each is legal at 1000 points by its own fleet list (checked in rules/computer.test.js with rules/fleet.js checkFleet).
// At sea the Concord has no fleet, so the sea battle is the Human fleet (the Freemen's rules) against the Orc fleet (the Rukka's).
// Concord, Doctrine list: a host barge with the Fleet Prime (needed over 750), two lance cruisers, a squadron of five escorts
// Rukka, Big Ruck: a Bully Boy (one battleship for two cruisas), a Bovver ship with the Gaffer, two Bash cruisas, five escorts
// Freemen / Human fleet: Lantern, Rimward, Cannonade, Tribune, an Admiral on the Cannonade, five escorts
const esc = (id, squad) => ({ id, squad })
export const SAMPLE_POINTS = 1000
export const SAMPLE_FLEETS = {
  concord: { fleet: 'concord', list: 'doctrine', cmd: 'master', rerolls: 0, marks: [], squads: ['e1'],
    ships: [{ id: 'con-battle-barge', squad: null, flag: true, picks: [] }, { id: 'con-lance-cruiser', squad: null, picks: [0, 1] }, { id: 'con-lance-cruiser', squad: null, picks: [0, 0] },
      esc('con-dirk', 'e1'), esc('con-dirk', 'e1'), esc('con-dirk', 'e1'), esc('con-tracker', 'e1')] },
  rukka: { fleet: 'rukka', list: 'bigruck', cmd: '', rerolls: 0, marks: [], squads: ['e1', 'e2'],
    ships: [{ id: 'rukka-bullyboy', squad: null, picks: [] }, { id: 'rukka-terror', squad: null, up: ['gaffer'], picks: [] }, { id: 'rukka-bash-cruisa', squad: null, picks: [] }, { id: 'rukka-bash-cruisa', squad: null, picks: [1] },
      esc('rukka-ravager', 'e1'), esc('rukka-ravager', 'e1'), esc('rukka-ravager', 'e1'), esc('rukka-savage', 'e2'), esc('rukka-savage', 'e2')] },
  freemen: { fleet: 'freemen', cmd: 'fleet-admiral', rerolls: 0, marks: [], squads: ['e1'],
    ships: [{ id: 'cannonade', squad: null, flag: true }, { id: 'lantern', squad: null }, { id: 'rimward', squad: null }, { id: 'tribune', squad: null },
      esc('sword', 'e1'), esc('sword', 'e1'), esc('wildfire', 'e1'), esc('wildfire', 'e1'), esc('adder', 'e1')] },
}
export const sampleFleet = fleet => SAMPLE_FLEETS[fleet] ? JSON.parse(JSON.stringify(SAMPLE_FLEETS[fleet])) : null
