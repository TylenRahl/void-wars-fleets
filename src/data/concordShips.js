// Drawn ship profiles for the seven newer fleets (Concord, Rukka, Athanatoi, Thnitoi, Phage, Katharos, Isos), plus each fleet's attack craft
// and torpedo counters (*_CRAFT). Exports the per-fleet ship lists (DYAD_FLEET, SHOE_FLEET, ATHANATOI_FLEET, THNITOI_FLEET, PHAGE_FLEET,
// KATHAROS_FLEET, ISOS_FLEET) and the building blocks the drawings use. view/blueprint.js draws from them; data/fleets.js turns the lists
// into playable profiles (with katharosProfiles.js, isosProfiles.js and rukkaProfiles.js filling in what the drawings leave out).
// These are not in SHIPS (data/ships.js), which holds only the Freemen and Dominion. The number after the points in the row builders
// is a reference number with no game effect.
//
// The Concord's three base ships, which the rest of the fleet builds on.
const W = (loc, kind, range, str, arc, extra = {}) => ({ loc, kind, range, str, arc, ...extra })
const LFR = ['left', 'front', 'right']

export const CONCORD_SHIPS = [
  { id: 'con-battle-barge', fleet: 'concord', name: 'Host barge', role: 'battleship', points: 425,
    type: 'battleship', hits: 12, speed: 20, turns: 45, shields: 3, armour: { front: 6, other: 6 }, turrets: 3,
    weapons: [W('port', 'battery', 45, 12, ['left']), W('starboard', 'battery', 45, 12, ['right']),
      W('prow', 'bays', 20, 3, []), W('prow', 'torpedo', 30, 6, ['front']), W('dorsal', 'bombardment', 30, 8, LFR)],
    special: ['No Come to New Heading orders for a host barge.'] },
  { id: 'con-lance-cruiser', fleet: 'concord', name: 'Lance cruiser', role: 'cruiser', points: 145,
    type: 'cruiser', hits: 6, speed: 25, turns: 90, shields: 1, armour: { front: 6, other: 6 }, turrets: 2,
    weapons: [W('port', 'battery', 30, 4, ['left']), W('starboard', 'battery', 30, 4, ['right']),
      W('prow', 'bays', 20, 2, []), W('prow', 'bombardment', 30, 3, LFR)] },
  { id: 'con-dirk', fleet: 'concord', name: 'Dirk frigate', role: 'escort', points: 45,
    type: 'escort', hits: 1, speed: 30, turns: 90, shields: 1, armour: { front: 5, other: 5 }, turrets: 2,
    weapons: [W('prow', 'battery', 30, 4, LFR)] },
]

// The rest of the Concord fleet, drawn on the Dyad hull. Courier escorts are Freemen escorts on loan to the Concord,
// drawn here as Dyad hulls in Concord colours, and priced from the Concord's list. `refit`s are the lance cruiser's weapon swaps, each
// its own picture because the guns change. The Venerable hulls aren't here: they are Freemen and Dominion ships rebuilt.
const refit = (id, name, weapons) => ({ ...CONCORD_SHIPS[1], id: 'con-lance-cruiser-' + id, name, refit: true, weapons })
const sides = CONCORD_SHIPS[1].weapons.slice(0, 2)
export const CONCORD_MORE = [
  { id: 'con-writ-oforder', fleet: 'concord', name: 'Writ of Order', role: 'battleship', points: 450,
    type: 'battleship', hits: 12, speed: 20, turns: 45, shields: 4, armour: { front: 6, other: 6 }, turrets: 4,
    weapons: [W('port', 'bombardment', 30, 8, ['left']), W('starboard', 'bombardment', 30, 8, ['right']), W('dorsal', 'bombardment', 30, 8, LFR),
      W('prow', 'bays', 20, 2, []), W('prow', 'torpedo', 30, 6, ['front'])],
    special: ['No Come to New Heading orders for the Writ of Order.'] },
  refit('torpedo', 'Lance cruiser, torpedoes', [...sides, W('prow', 'torpedo', 30, 6, ['front']), W('prow', 'bombardment', 30, 3, LFR)]),
  refit('bombard', 'Lance cruiser, second cannon', [...sides, W('prow', 'bombardment', 30, 5, ['front']), W('prow', 'bombardment', 30, 3, LFR)]),
  refit('lance', 'Lance cruiser, lance', [...sides, W('prow', 'bays', 20, 2, []), W('prow', 'lance', 30, 1, LFR)]),
  { id: 'con-flare', fleet: 'concord', name: 'Flare class frigate', role: 'escort', points: 50,
    type: 'escort', hits: 1, speed: 35, turns: 90, shields: 1, armour: { front: 5, other: 5 }, turrets: 1,
    weapons: [W('prow', 'lance', 30, 1, LFR), W('prow', 'battery', 30, 2, LFR)] },
  { id: 'con-tracker', fleet: 'concord', name: 'Tracker class destroyer', role: 'escort', points: 40,
    type: 'escort', hits: 1, speed: 35, turns: 90, shields: 1, armour: { front: 5, other: 5 }, turrets: 1,
    weapons: [W('prow', 'torpedo', 30, 2, ['front']), W('prow', 'battery', 30, 1, LFR)] },
  { id: 'con-rsv-wildfire', fleet: 'concord', name: 'Courier escort, Wildfire', role: 'escort', points: 45,
    type: 'escort', hits: 1, speed: 25, turns: 90, shields: 1, armour: { front: 5, other: 5 }, turrets: 2,
    weapons: [W('prow', 'lance', 30, 1, ['front']), W('prow', 'battery', 30, 2, LFR)] },
  { id: 'con-rsv-cutlass', fleet: 'concord', name: 'Courier escort, Cutlass', role: 'escort', points: 40,
    type: 'escort', hits: 1, speed: 25, turns: 90, shields: 1, armour: { front: 5, other: 5 }, turrets: 2,
    weapons: [W('prow', 'battery', 30, 4, LFR)] },
  { id: 'con-rsv-adder', fleet: 'concord', name: 'Courier escort, Adder', role: 'escort', points: 35,
    type: 'escort', hits: 1, speed: 30, turns: 90, shields: 1, armour: { front: 4, other: 4 }, turrets: 1,
    weapons: [W('prow', 'torpedo', 30, 2, ['front']), W('prow', 'battery', 30, 1, LFR)] },
  { id: 'con-rsv-sabre', fleet: 'concord', name: 'Courier escort, Sabre', role: 'escort', points: 40,
    type: 'escort', hits: 1, speed: 25, turns: 90, shields: 1, armour: { front: 5, other: 5 }, turrets: 1,
    weapons: [W('prow', 'battery', 30, 3, LFR), W('prow', 'torpedo', 30, 1, ['front'])] },
  // per quadrant: 12 hits, 4 shields, 4 turrets. size is the drawing's, not a rule.
  { id: 'con-hostkeep', fleet: 'concord', name: 'Host Keep', role: 'fortress', points: 1000, size: 4,
    type: 'defence', hits: 12, speed: 0, turns: 0, shields: 4, armour: { front: 6, other: 6 }, turrets: 4, fort: true, fixedLd: 10, teleportExtras: true,
    // loc is the part a critical hit on the fort table damages (rules/fort.js): main, lances, bays; 'quadrant' arc = the 90 degree arc facing outward
    weapons: [W('main', 'battery', 60, 18, ['front']), W('lances', 'lance', 45, 3, ['front']), W('bays', 'bays', 20, 3, []),
      W('basilica', 'battery', 60, 8, 'all'), W('basilica', 'torpedo', 30, 9, 'all')],
    special: ['Base Resolve 10.', 'Uses the Bastion class star fort rules except where its own rules differ.'] },
]
// the Concord fleet in display order, and the Concord's attack craft and torpedoes
const by = id => [...CONCORD_SHIPS, ...CONCORD_MORE].find(s => s.id === id)
export const DYAD_FLEET = ['con-battle-barge', 'con-writ-oforder', 'con-lance-cruiser', 'con-lance-cruiser-torpedo', 'con-lance-cruiser-bombard', 'con-lance-cruiser-lance',
  'con-flare', 'con-dirk', 'con-tracker', 'con-rsv-wildfire', 'con-rsv-cutlass', 'con-rsv-adder', 'con-rsv-sabre', 'con-hostkeep'].map(by)
export const CONCORD_CRAFT = [
  { id: 'con-dropwing', fleet: 'concord', name: 'Dropwing gunship', kind: 'dropwing', speed: 20 },
  { id: 'con-annihilator', fleet: 'concord', name: 'Dropwing Breaker', kind: 'dropwing breaker', speed: 20 },
  { id: 'con-torpedo', fleet: 'concord', name: 'Torpedo salvo', kind: 'torpedo', speed: 30 },
  { id: 'con-boarding-torpedo', fleet: 'concord', name: 'Boarding torpedo', kind: 'boarding torpedo', speed: 30 },
]

// The Rukka's three base ships, which the rest of the fleet builds on.
export const RUKKA_SHIPS = [
  { id: 'rukka-bullyboy', fleet: 'rukka', name: 'Bully Boy battleship', role: 'battleship', points: 270,
    type: 'battleship', hits: 12, speed: 20, turns: 45, shields: 2, armour: { front: 6, other: 5 }, turrets: 3,
    weapons: [W('prow', 'battery', 45, 'D6+6', ['front']), W('prow', 'heavybangers', 15, 6, ['front']), W('dorsal', 'bays', 25, 'D3+1', []),
      W('port', 'heavybangers', 15, 6, ['left']), W('starboard', 'heavybangers', 15, 6, ['right']),
      W('port', 'battery', 30, 'D6+2', ['left']), W('starboard', 'battery', 30, 'D6+2', ['right'])] },
  { id: 'rukka-bash-cruisa', fleet: 'rukka', name: 'Bash cruisa', role: 'cruiser', points: 155,
    type: 'cruiser', hits: 10, speed: 20, turns: 45, shields: 1, armour: { front: 6, other: 5, rear: 4 }, turrets: 1,
    weapons: [W('port', 'heavybangers', 15, 4, ['left']), W('starboard', 'heavybangers', 15, 4, ['right']),
      W('port', 'battery', 30, 'D6', ['left']), W('starboard', 'battery', 30, 'D6', ['right']),
      W('prow', 'heavybangers', 15, 6, ['front']), W('prow', 'battery', 45, 'D6+2', ['front'])] },
  { id: 'rukka-ravager', fleet: 'rukka', name: 'Rattler attack ship', role: 'escort', points: 40,
    type: 'escort', hits: 1, speed: 20, turns: 45, shields: 1, armour: { front: 6, other: 4 }, turrets: 2,
    weapons: [W('prow', 'battery', 30, 2, ['front']), W('prow', 'torpedo', 30, 'D6', ['front'])] },
]

// The rest of the Rukka fleet, drawn on the Shoe hull. Dice strengths stay as dice strings (rules/dicestr.js). `refit`s are the prow swaps
// that change a picture.
const E = (id, name, points, page, hits, speed, turns, armour, turrets, weapons, more = {}) => ({ id, fleet: 'rukka', name, role: 'escort', points, page, type: 'escort', hits, speed, turns, shields: 1, armour, turrets, weapons, ...more })
const side = (loc, arc) => (kind, range, str) => W(loc, kind, range, str, [arc])
const pair = (kind, range, str) => [side('port', 'left')(kind, range, str), side('starboard', 'right')(kind, range, str)]
const bb = (id, name, points, page, broadside, prow, more = {}) => ({ id, fleet: 'rukka', name, role: 'battleship', points, page, type: 'battleship', hits: 12, speed: 20, turns: 45, shields: 2,
  armour: { front: 6, other: 5 }, turrets: 3, weapons: [W('prow', 'battery', 45, 'D6+6', ['front']), ...prow, W('dorsal', 'bays', 25, 'D3+1', []), ...pair('heavybangers', 15, 6), ...pair('battery', 30, broadside)], ...more })
const cruisa = (id, name, points, page, hits, weapons, more = {}) => ({ id, fleet: 'rukka', name, role: 'cruiser', points, page, type: 'cruiser', hits, speed: 20, turns: 45, shields: 1, armour: { front: 6, other: 5, rear: 4 }, turrets: 1, weapons, ...more })
const killK = RUKKA_SHIPS[1]
const prowHeavy = (ship, id, name, str) => ({ ...ship, id: ship.id + '-' + id, name, refit: true, weapons: ship.weapons.map(w => w.loc === 'prow' && w.kind === 'heavybangers' ? W('prow', 'torpedo', 30, str, ['front']) : w) })
const terror = cruisa('rukka-terror', 'Bovver ship', 185, 380, 10, [...pair('battery', 30, 'D6'), ...pair('bays', 25, 2), W('prow', 'heavybangers', 15, 6, ['front']), W('prow', 'battery', 45, 'D6+2', ['front'])])
const lite = cruisa('rukka-lite-cruisa', 'Lite cruisa', 90, 383, 6, [...pair('battery', 30, 'D3+1'), W('prow', 'battery', 30, 2, ['front']), W('prow', 'heavybangers', 15, 4, ['front'])])
const grunt = E('rukka-grunt', 'Boarding barge', 30, 388, 1, 25, 45, { front: 6, other: 5 }, 2, [W('prow', 'battery', 30, 2, LFR)], { ramDice: 2 })
export const RUKKA_MORE = [
  { id: 'rukka-hulk', fleet: 'rukka', name: 'Hulk', role: 'derelict', points: 600, type: 'defence', hits: 40, speed: 10, turns: null, shields: 3, armour: { front: 4, other: 4 }, turrets: 6,
    weapons: [W('prow', 'battery', 45, '2D6+6', ['front']), W('prow', 'torpedo', 30, '2D6', ['front']), W('prow', 'heavybangers', 15, 8, ['front']), W('dorsal', 'lance', 60, 4, 'all'),
      ...pair('bays', 25, 'D6+2'), ...pair('battery', 45, '2D6+2'), ...pair('torpedo', 30, '2D6'), W('aft', 'battery', 45, '2D6+6', ['rear'])] },
  bb('rukka-bigdens-revenge', "Big Den's Revenge battleship", 310, 377, 'D6+2', [W('prow', 'torpedo', 30, 'D6+2', ['front']), ...pair('bays', 25, 2)]),
  bb('rukka-slammer', 'Slammer battleship', 295, 378, 'D6+6', [W('prow', 'lance', 45, 2, ['front'])]),
  bb('rukka-deadcert', 'Dead Cert battleship', 275, 376, 'D6+4', [W('prow', 'bombardment', 30, 6, ['front'])], { aheadFullDice: 4 }),
  { ...bb('rukka-hammer', 'Hammer class battlecruisa', 245, 374, 'D6+2', [W('prow', 'bombardment', 30, 6, ['front']), W('prow', 'torpedo', 30, 'D6+2', ['front'])]), role: 'battlecruiser', type: 'cruiser', hits: 10, turrets: 2 },
  cruisa('rukka-razzas-grabber', "Razza's Grabber assault cruisa", 210, 381, 10, [...pair('battery', 30, 'D6'), ...pair('bays', 30, 2), W('prow', 'battery', 45, 'D6+2', ['front']), W('prow', 'torpedo', 30, 'D6+2', ['front']), W('prow', 'grabbers', 0, 'special', ['front'])]),
  terror, prowHeavy(terror, 'torpedo', 'Bovver ship, torpedo chucka', 'D6+2'), prowHeavy(killK, 'torpedo', 'Bash cruisa, torpedo chucka', 'D6+2'), lite, prowHeavy(lite, 'torpedo', 'Lite cruisa, torpedo chucka', 'D6'),
  // For no change in cost the prow heavy bangers may become additional D6 bangers, D6+2 in total with the prow bangers
  { ...lite, id: 'rukka-lite-cruisa-bangers', name: 'Lite cruisa, extra bangers', refit: true, weapons: lite.weapons.filter(w => w.kind !== 'heavybangers').map(w => w.loc === 'prow' && w.kind === 'battery' ? { ...w, str: 'D6+2' } : w) },
  E('rukka-onslaught', 'Stampede attack ship', 35, 384, 1, 20, 45, { front: 6, other: 4 }, 1, [W('prow', 'battery', 30, 'D6', ['front'])]),
  grunt, { ...grunt, id: 'rukka-grunt-grabbers', name: 'Boarding barge, grabbers', refit: true, points: 35, weapons: [...grunt.weapons, W('prow', 'grabbers', 0, 'special', ['front'])] },
  E('rukka-savage', 'Bruiser gunship', 30, 385, 1, 25, 45, { front: 6, other: 4 }, 1, [W('prow', 'heavybangers', 15, 4, ['front'])]),
  E('rukka-brute', 'Bonker ram ship', 25, 387, 1, 25, 90, { front: 6, other: 4 }, 1, [W('prow', 'battery', 30, 2, LFR)], { ramDice: 4 }),
  { id: 'rukka-lump', fleet: 'rukka', name: 'Lump', role: 'lump', points: 80, size: 1.5, type: 'defence', hits: 8, speed: 10, turns: null, shields: 1, armour: { front: 5, other: 5 }, turrets: 1,
    weapons: [W('dorsal', 'heavybangers', 15, 4, 'all'), W('dorsal', 'battery', 45, 'D6+6', 'all'), W('dorsal', 'torpedo', 30, 'D6', 'all')] },
]
const rk = id => [...RUKKA_SHIPS, ...RUKKA_MORE].find(s => s.id === id)
export const SHOE_FLEET = ['rukka-hulk', 'rukka-bigdens-revenge', 'rukka-slammer', 'rukka-deadcert', 'rukka-bullyboy', 'rukka-hammer', 'rukka-razzas-grabber', 'rukka-terror', 'rukka-terror-torpedo', 'rukka-bash-cruisa', 'rukka-bash-cruisa-torpedo',
  'rukka-lite-cruisa', 'rukka-lite-cruisa-torpedo', 'rukka-lite-cruisa-bangers', 'rukka-ravager', 'rukka-onslaught', 'rukka-grunt', 'rukka-grunt-grabbers', 'rukka-savage', 'rukka-brute', 'rukka-lump'].map(rk)
export const RUKKA_CRAFT = [
  { id: 'rukka-buzza', fleet: 'rukka', name: 'Buzza', kind: 'shoe fighter', speed: 25 },
  { id: 'rukka-assault-boat', fleet: 'rukka', name: 'Assault boat', kind: 'shoe boat', speed: 30 },
  { id: 'rukka-tin-fisher', fleet: 'rukka', name: 'Tin-fisher', kind: 'shoe bomber', speed: 20 },
  { id: 'rukka-torpedo', fleet: 'rukka', name: 'Torpedo salvo', kind: 'torpedo', speed: 30 },
  { id: 'rukka-boarding-torpedo', fleet: 'rukka', name: 'Boarding torpedo', kind: 'boarding torpedo', speed: 20 },
]

// The Athanatoi's base ships. Starlances are their own weapon kind; `speed` is the highest of the three sail speeds (data/fleets.js SAIL).
export const ATHANATOI_SHIPS = [
  { id: 'ath-thalassa', fleet: 'athanatoi', name: 'Thalassa battleship', role: 'battleship', points: 380, type: 'battleship', hits: 10, speed: 25, turns: null, shields: 0, armour: { front: 4, other: 4 }, turrets: 0,
    weapons: [W('keel', 'bays', 30, 4, []), W('keel', 'battery', 45, 8, LFR), W('prow', 'starlance', 45, 2, ['left', 'front']), W('prow', 'starlance', 45, 2, ['front', 'right'])] },
  { id: 'ath-veil', fleet: 'athanatoi', name: 'Veil cruiser', role: 'cruiser', points: 210, type: 'cruiser', hits: 6, speed: 25, turns: null, shields: 0, armour: { front: 4, other: 4 }, turrets: 0, size: 2,
    weapons: [W('keel', 'torpedo', 30, 4, ['front']), W('prow', 'battery', 30, 12, ['front'])] },
  { id: 'ath-asphodel', fleet: 'athanatoi', name: 'Asphodel frigate', role: 'escort', points: 65, type: 'escort', hits: 1, speed: 30, turns: null, shields: 0, armour: { front: 4, other: 4 }, turrets: 0,
    weapons: [W('prow', 'starlance', 30, 1, ['front']), W('keel', 'torpedo', 30, 2, ['front']), W('prow', 'battery', 30, 1, ['front'])] },
]

// The Selene and the Eos, the cruisers that carry the sabre-tooth and crocodile skulls.
export const ATHANATOI_MORE = [
  { id: 'ath-selene', fleet: 'athanatoi', name: 'Selene cruiser', role: 'cruiser', points: 250, type: 'cruiser', hits: 6, speed: 25, turns: null, shields: 0, armour: { front: 4, other: 4 }, turrets: 0, size: 2,
    weapons: [W('keel', 'bays', 30, 4, []), W('prow', 'starlance', 30, 2, ['front'])] },
  { id: 'ath-eos', fleet: 'athanatoi', name: 'Eos light cruiser', role: 'cruiser', points: 140, type: 'cruiser', hits: 4, speed: 30, turns: null, shields: 0, armour: { front: 4, other: 4 }, turrets: 0, size: 1.6,
    weapons: [W('keel', 'torpedo', 30, 4, ['front']), W('prow', 'starlance', 30, 2, ['front'])] },
]
const [stalker, shadow, asphodel] = ATHANATOI_SHIPS

// The whole Athanatoi fleet. Each exclusive weapon choice is its own picture. `animal` says which skull the drawing carries, spread by size.
const cruiser = (id, name, points, page, hits, armour, size, weapons, more = {}) => ({ id, fleet: 'athanatoi', name, role: 'cruiser', points, page, type: 'cruiser', hits, speed: 25, turns: null, shields: 0, armour: { front: armour, other: armour }, turrets: 0, size, weapons, ...more })
const frigate = (id, name, points, page, weapons, more = {}) => ({ id, fleet: 'athanatoi', name, role: 'escort', points, page, type: 'escort', hits: 1, speed: 30, turns: null, shields: 0, armour: { front: 4, other: 4 }, turrets: 0, weapons, ...more })
const prowOf = (kind, str) => W('prow', kind, 30, str, ['front']), keelOf = (n, str) => n === 'bays' ? W('keel', 'bays', 30, str, []) : W('keel', 'torpedo', 30, str, ['front'])
const variants = (id, name, points, page, guns, lance, bays, torps) => [[0, 0], [0, 1], [1, 0], [1, 1]].map(([a, b]) => cruiser(`${id}${a ? '-lance' : ''}${b ? '-torpedo' : ''}`, `${name}, ${a ? 'starlance' : 'gun battery'}, ${b ? 'torpedoes' : 'launch bays'}`, points, page, 6, 5, 2, [a ? prowOf('starlance', lance) : prowOf('battery', guns), b ? keelOf('t', torps) : keelOf('bays', bays)]))
export const ATHANATOI_FLEET = [
  { ...stalker, animal: 'stag2' },
  cruiser('ath-flame', 'Flame of Helion', 320, 329, 8, 5, 2.2, [W('keel', 'bays', 30, 4, []), W('prow', 'battery', 30, 16, ['front']), W('keel', 'starlance', 30, 1, ['left', 'front']), W('keel', 'starlance', 30, 1, ['front', 'right'])], { animal: 'sabre', thirdSail: true }),
  { ...ATHANATOI_MORE[0], animal: 'sabre' },
  ...variants('ath-wyrmship', 'Wyrmship', 260, 330, 14, 3, 4, 8).map(s => ({ ...s, animal: 'sabre' })),
  { ...shadow, animal: 'wolf' },
  ...variants('ath-stillship', 'Stillship', 160, 331, 8, 2, 2, 4).map(s => ({ ...s, animal: 'wolf' })),
  { ...ATHANATOI_MORE[1], animal: 'croc' },
  { id: 'ath-helios', fleet: 'athanatoi', name: 'Helios light cruiser', role: 'cruiser', points: 130, type: 'cruiser', hits: 4, speed: 30, turns: null, shields: 0, armour: { front: 4, other: 4 }, turrets: 0, size: 1.6, weapons: [prowOf('battery', 8)], animal: 'croc' },
  { ...asphodel, animal: 'hawk' },
  frigate('ath-oleander', 'Oleander frigate', 55, 326, [prowOf('battery', 5)], { animal: 'hawk' }),
  frigate('ath-kalyx', 'Kalyx destroyer', 40, 327, [prowOf('starlance', 1)], { animal: 'hawk' }),
  frigate('ath-foxglove', 'Foxglove destroyer', 40, 328, [keelOf('t', 2), prowOf('battery', 1)], { animal: 'hawk' }),
  frigate('ath-duskhunter', 'Duskhunter, gun battery', 40, 332, [prowOf('battery', 3)], { animal: 'hawk' }),
  frigate('ath-duskhunter-lance', 'Duskhunter, shadow lance', 40, 332, [prowOf('lance', 1)], { animal: 'hawk' }),
  frigate('transport-athanatoi', 'Transport', 0, 333, [W('prow', 'battery', 15, 1, ['front'])], { animal: 'hawk', role: 'transport', speed: 15 }),
  { id: 'ath-haven', fleet: 'athanatoi', name: 'Haven space station', role: 'platform', points: 200, size: 2.6, type: 'defence', hits: 8, speed: 0, turns: 0, shields: 0, armour: { front: 5, other: 5 }, turrets: 0,
    weapons: [W('main', 'battery', 60, 8, 'all'), W('bays', 'bays', 30, 5, []), W('lances', 'starlance', 45, 3, 'all')] },
]
// Nightjar and Duskwing share their rules, as do Eagle and Phoenix, so one picture each
export const ATHANATOI_CRAFT = [
  { id: 'ath-nightjar', fleet: 'athanatoi', name: 'Nightjar or Duskwing fighter', kind: 'hunt fighter', speed: 30 },
  { id: 'ath-aetos', fleet: 'athanatoi', name: 'Aetos or Halcyon bomber', kind: 'hunt bomber', speed: 20 },
  { id: 'ath-lamia', fleet: 'athanatoi', name: 'Lamia raider', kind: 'hunt raider', speed: 25 },
  { id: 'ath-torpedo-bomber', fleet: 'athanatoi', name: 'Torpedo bomber', kind: 'hunt torpedo bomber', speed: 20 },
  { id: 'ath-torpedo', fleet: 'athanatoi', name: 'Torpedo salvo', kind: 'torpedo', speed: 30 },
]

// Base ships of the Thnitoi, Phage, Isos and Katharos, which the fleets below build on. The Thnitoi have only two hull classes. The Phage
// queen ship, cruiser and Gulper are built from slots, so one fit each is here.
const ship = (fleet, id, name, role, points, page, hits, weapons, more = {}) => ({ id, fleet, name, role, points, page, type: role === 'battleship' ? 'battleship' : role === 'escort' ? 'escort' : 'cruiser', hits, speed: 20, turns: 45, shields: 0, armour: { front: 5, other: 5 }, turrets: 0, weapons, ...more })
const sidePair = (kind, range, str) => [W('port', kind, range, str, ['left']), W('starboard', kind, range, str, ['right'])]
export const RACE_SHIPS = {
  thnitoi: [
    ship('thnitoi', 'thn-agony', 'Agony cruiser', 'cruiser', 210, 352, 6, [W('prow', 'battery', 30, 12, ['front'])], { size: 2 }),
    ship('thnitoi', 'thn-agony-lance', 'Agony cruiser, hollow lance', 'cruiser', 230, 352, 6, [W('prow', 'battery', 30, 12, ['front']), W('prow', 'phantom', 30, 2, ['front'])], { size: 2 }),
    ship('thnitoi', 'thn-corsair', 'Skirmisher escort', 'escort', 50, 353, 1, [W('prow', 'battery', 30, 2, ['front']), W('prow', 'torpedo', 30, 2, ['front'])]),
  ],
  phage: [
    ship('phage', 'pha-hive', 'Queen ship', 'battleship', 265, 432, 10, [W('prow', 'pyro', 45, 8, ['front']), W('thorax', 'bays', 20, 2, []), ...sidePair('pyro', 30, 4)]),
    ship('phage', 'pha-cruiser', 'Cruiser', 'cruiser', 125, 434, 6, [W('prow', 'pyro', 30, 8, LFR), W('thorax', 'bio-torpedo', 15, 4, ['front']), ...sidePair('pyro', 30, 4)]),
    ship('phage', 'pha-gulper', 'Gulper', 'escort', 40, 435, 1, [W('prow', 'pyro', 30, 6, ['front'])]),
  ],
  isos: [
    ship('isos', 'isos-explorer', 'Explorer starship', 'battleship', 230, 458, 12, [W('prow', 'battery', 45, 6, LFR), ...sidePair('bays', 25, 4)]),
    ship('isos', 'isos-hero', 'Hero starship', 'cruiser', 180, 460, 8, [W('prow', 'battery', 45, 4, LFR), W('prow', 'missile', 40, 6, ['front']), ...sidePair('bays', 25, 1), W('port', 'lance', 30, 2, ['left', 'front']), W('starboard', 'lance', 30, 2, ['front', 'right'])]),
    ship('isos', 'isos-defender', 'Defender starship', 'escort', 45, 464, 1, [W('prow', 'battery', 30, 3, LFR), W('prow', 'missile', 40, 2, ['front'])]),
  ],
  katharos: [
    ship('katharos', 'kat-barrow', 'Barrow cryptship', 'battleship', 500, 405, 12, [W('dorsal', 'lightning', 30, 20, LFR), W('dorsal', 'starpulse', 20, 1, 'all'), W('dorsal', 'whip', 45, 6, LFR), W('dorsal', 'portal', 10, 3, 'all')]),
    ship('katharos', 'kat-sickle', 'Sickle harvest ship', 'cruiser', 275, 406, 8, [W('dorsal', 'lightning', 30, 8, ['left', 'right']), W('dorsal', 'starpulse', 20, 1, 'all'), W('dorsal', 'whip', 45, 4, LFR), W('dorsal', 'portal', 10, 2, LFR)]),
    ship('katharos', 'kat-vigil', 'Vigil raider', 'escort', 50, 408, 1, [W('prow', 'lightning', 30, 4, ['front']), W('prow', 'portal', 10, 1, 'all')]),
  ],
}

// The whole Thnitoi and Katharos fleets. Katharos ships shrink through the moon phases from the biggest down. Each weapon choice is its own picture.
const [agony, , corsair] = RACE_SHIPS.thnitoi
const agonyWith = (id, name, points, w) => ({ ...agony, id: 'thn-agony-' + id, name: 'Agony cruiser, ' + name, points, weapons: [agony.weapons[0], w] })
const corsairWith = (id, name, w) => ({ ...corsair, id: 'thn-corsair-' + id, name: 'Skirmisher escort, ' + name, weapons: [W('prow', 'battery', 30, 2, ['front']), w] })
export const THNITOI_FLEET = [
  { ...agony, weapons: [agony.weapons[0]] }, agonyWith('bays', 'launch bays', 250, W('bays', 'bays', 30, 4, [])), agonyWith('lance', 'hollow lance', 230, W('prow', 'phantom', 30, 2, ['front'])), agonyWith('torpedo', 'torpedoes', 230, W('prow', 'torpedo', 30, 4, ['front'])),
  agonyWith('harpoon', 'one Harpoon', 230, W('prow', 'harpoon', 30, 1, ['front'])), agonyWith('harpoons', 'two Harpoons', 250, W('prow', 'harpoon', 30, 2, ['front'])),
  corsairWith('guns', 'second battery', W('prow', 'battery', 30, 3, ['front'])), corsairWith('lance', 'hollow lance', W('prow', 'phantom', 30, 1, ['front'])), { ...corsair, name: 'Skirmisher escort, torpedoes' }, corsairWith('harpoon', 'Harpoon', W('prow', 'harpoon', 30, 1, [])),
  { id: 'thn-haven', fleet: 'thnitoi', name: 'Pirate base', role: 'platform', points: 200, size: 2.6, type: 'defence', hits: 8, speed: 0, turns: 0, shields: 0, armour: { front: 5, other: 5 }, turrets: 0,
    weapons: [W('main', 'battery', 60, 8, 'all'), W('bays', 'bays', 30, 5, []), W('lances', 'phantom', 45, 3, 'all')] },
]
export const THNITOI_CRAFT = [
  { id: 'thn-kite', fleet: 'thnitoi', name: 'Kite fighter', kind: 'knife fighter', speed: 30 }, { id: 'thn-thornwing', fleet: 'thnitoi', name: 'Thornwing bomber', kind: 'knife bomber', speed: 20 },
  { id: 'thn-manacle', fleet: 'thnitoi', name: 'Manacle assault boat', kind: 'knife boat', speed: 30 }, { id: 'thn-torpedo-bomber', fleet: 'thnitoi', name: 'Torpedo bomber', kind: 'knife torpedo bomber', speed: 20 },
  { id: 'thn-torpedo', fleet: 'thnitoi', name: 'Torpedo salvo', kind: 'torpedo', speed: 30 }, { id: 'thn-lamprey', fleet: 'thnitoi', name: 'Lamprey torpedo salvo', kind: 'boarding torpedo', speed: 30 },
  { id: 'thn-harpoon', fleet: 'thnitoi', name: 'Harpoon assault module', kind: 'knife harpoon', speed: 30 },
]
const [barrow, sickle, vigil] = RACE_SHIPS.katharos
export const KATHAROS_FLEET = [
  barrow, { ...barrow, id: 'kat-barrow-ossuary', name: 'Barrow cryptship with Ossuary', points: 550, weapons: [...barrow.weapons, W('dorsal', 'ossuary', 20, 1, 'all')] }, sickle,
  { id: 'kat-pall', fleet: 'katharos', name: 'Pall light cruiser', role: 'cruiser', points: 155, size: 1.6, type: 'cruiser', hits: 4, speed: 30, turns: 45, shields: 0, armour: { front: 6, other: 6 }, turrets: 1, weapons: [W('dorsal', 'lightning', 30, 10, LFR)] },
  vigil,
  { id: 'kat-knell', fleet: 'katharos', name: 'Knell raider', role: 'escort', points: 40, size: 0.85, type: 'escort', hits: 1, speed: 50, turns: 90, shields: 0, armour: { front: 6, other: 6 }, turrets: 1, weapons: [W('prow', 'lightning', 30, 3, ['front'])] },
]

// The whole Phage fleet. Every ship is built from slots, so these are sample fits with points
// added up from the slots (data/phageShips.js has the playable classes). rib and core are the drawing's: a cage shape and an organ for each ship, so no two look alike.
const p = (id, name, role, points, page, hits, rib, core, weapons, more = {}) => ship('phage', id, name, role, points, page, hits, weapons, { rib, core, ...more })
const pf = (kind, range, str, arc = ['front']) => W('prow', kind, range, str, arc), tx = (kind, range, str, arc = ['front']) => W('thorax', kind, range, str, arc), contact = (loc, kind) => W(loc, kind, 0, 'special', ['front'])
export const PHAGE_FLEET = [
  p('pha-hive-a', 'Queen ship, acid guns', 'battleship', 265, 432, 10, 'wings', 'eggs', [pf('pyro', 45, 8), tx('bays', 20, 2, []), ...sidePair('pyro', 30, 4)]),
  p('pha-hive-b', 'Queen ship, spines', 'battleship', 260, 432, 10, 'wings', 'eggs', [pf('bioplasma', 15, 4, LFR), tx('bioplasma', 15, 4, LFR), ...sidePair('bays', 20, 1)]),
  p('pha-hive-c', 'Queen ship, tentacles and claws', 'battleship', 265, 432, 10, 'wings', 'eggs', [contact('prow', 'feeder'), contact('prow', 'claws'), tx('pyro', 45, 8), ...sidePair('bioplasma', 15, 2)]),
  p('pha-hive-d', 'Queen ship, boarding torpedoes', 'battleship', 260, 432, 10, 'wings', 'eggs', [pf('bio-torpedo', 15, 8), tx('bays', 20, 2, []), ...sidePair('pyro', 30, 4)]),
  p('pha-cruiser-a', 'Cruiser, acid guns', 'cruiser', 125, 434, 6, 'barrel', 'lungs', [pf('pyro', 30, 8, LFR), tx('bio-torpedo', 15, 4), ...sidePair('pyro', 30, 4)]),
  p('pha-cruiser-b', 'Cruiser, claws and tentacles', 'cruiser', 115, 434, 6, 'hooks', 'eye', [contact('prow', 'claws'), contact('thorax', 'feeder'), ...sidePair('bioplasma', 15, 2)]),
  p('pha-cruiser-c', 'Cruiser, boarding torpedoes', 'cruiser', 110, 434, 6, 'fan', 'sac', [pf('bio-torpedo', 15, 4), contact('thorax', 'claws'), ...sidePair('pyro', 30, 4)]),
  p('pha-gulper-a', 'Gulper, acid guns', 'escort', 40, 435, 1, 'hooks', 'eye', [pf('pyro', 30, 6)], { size: 1.1 }),
  p('pha-gulper-b', 'Gulper, massive claws', 'escort', 35, 435, 1, 'claws', 'heart', [contact('prow', 'claws')], { size: 1.1 }),
  p('pha-gulper-c', 'Gulper, feeder tentacles', 'escort', 30, 435, 1, 'fan', 'gut', [contact('prow', 'feeder')], { size: 1.1 }),
  p('pha-gulper-d', 'Gulper, searbile', 'escort', 35, 435, 1, 'spears', 'brain', [pf('bioplasma', 15, 2)], { size: 1.1 }),
  p('pha-gulper-e', 'Gulper, boarding torpedoes', 'escort', 40, 435, 1, 'wings', 'eggs', [pf('bio-torpedo', 15, 2)], { size: 1.1 }),
  p('pha-vanguard-a', 'Forerunner drone, acid guns', 'escort', 25, 436, 1, 'wings', 'sac', [pf('pyro', 30, 2)], { size: 0.8 }),
  p('pha-vanguard-b', 'Forerunner drone, tentacles', 'escort', 25, 436, 1, 'spears', 'eye', [contact('prow', 'feeder')], { size: 0.8 }),
  p('pha-drone-a', 'Picket drone, acid guns', 'escort', 20, 437, 1, 'barrel', 'sac', [pf('pyro', 30, 4)], { size: 0.9 }),
  p('pha-drone-b', 'Picket drone, tentacles', 'escort', 15, 437, 1, 'barrel', 'lungs', [contact('prow', 'feeder')], { size: 0.9 }),
  p('pha-drone-c', 'Picket drone, searbile', 'escort', 15, 437, 1, 'barrel', 'heart', [pf('bioplasma', 15, 2)], { size: 0.9 }),
  p('pha-drone-d', 'Picket drone, fire ship', 'escort', 10, 437, 1, 'barrel', 'bomb', [], { size: 0.9 }),
]
export const PHAGE_CRAFT = [
  { id: 'pha-fighter', fleet: 'phage', name: 'Fighter brood', kind: 'cage fighter', speed: 20 }, { id: 'pha-assault-boat', fleet: 'phage', name: 'Assault brood', kind: 'cage boat', speed: 15 },
  { id: 'pha-boarding-torpedo', fleet: 'phage', name: 'Boarding torpedo', kind: 'cage torpedo', speed: 15 }, { id: 'pha-spore-mine', fleet: 'phage', name: 'Great spore mine', kind: 'cage mine', speed: 0 },
]

// The whole Isos fleet. Each configuration keeps its class name plus its configuration name, because the
// guns differ. rings: biggest ships two, middle ships one, smallest none. size is the drawing's only.
const iso = (id, name, role, points, page, hits, size, weapons, more = {}) => ship('isos', id, name, role, points, page, hits, weapons, { size, ...more })
const fp = (kind, range, str, arc = LFR) => W('prow', kind, range, str, arc), slant = (kind, range, str) => [W('port', kind, range, str, ['left', 'front']), W('starboard', kind, range, str, ['front', 'right'])]
const missile = str => W('prow', 'missile', 40, str, ['front']), front = ['front']
const station = (id, name, points, page, hits, size, weapons, rings) => ({ ...iso(id, name, 'platform', points, page, hits, size, weapons), type: 'defence', speed: 0, turns: 0, rings })
export const ISOS_FLEET = [
  iso('isos-explorer', "Explorer, Outring", 'battleship', 230, 458, 12, 3, [fp('battery', 45, 6), ...sidePair('bays', 25, 4)]),
  iso('isos-explorer-spire', "Explorer, Spire", 'battleship', 230, 458, 12, 3, [fp('battery', 45, 6), missile(8), ...sidePair('bays', 25, 2)]),
  iso('isos-lattice', 'Lattice battleship', 'battleship', 330, 468, 10, 2.8, [...slant('battery', 45, 6), ...slant('lance', 45, 1), ...sidePair('bays', 25, 3), missile(8)]),
  iso('isos-hero', "Hero, Outring", 'cruiser', 180, 460, 8, 2, [fp('battery', 45, 4), missile(6), ...sidePair('bays', 25, 1), ...slant('lance', 30, 2)]),
  iso('isos-hero-prism', "Hero, Prism", 'cruiser', 180, 460, 8, 2, [fp('battery', 45, 4), missile(6), ...sidePair('bays', 25, 1), ...slant('battery', 45, 4)]),
  iso('isos-protector', "Protector, Prism", 'cruiser', 185, 470, 6, 1.9, [...slant('battery', 45, 2), fp('battery', 45, 6, front), ...slant('lance', 30, 1), fp('bays', 25, 1, []), missile(5)]),
  iso('isos-protector-ember', "Protector, Ember", 'cruiser', 185, 470, 6, 1.9, [...slant('battery', 45, 2), fp('battery', 45, 4, front), W('port', 'lance', 45, 1, front), W('starboard', 'lance', 45, 1, front), fp('bays', 25, 1, []), missile(5)]),
  iso('isos-merchant', "Merchant, Waygate", 'cruiser', 95, 462, 4, 1.6, [fp('battery', 45, 2), ...slant('battery', 45, 2)]),
  iso('isos-merchant-hearth', "Merchant, Hearth", 'cruiser', 95, 462, 4, 1.6, [fp('battery', 45, 2), ...slant('lance', 30, 1), ...slant('battery', 45, 2)]),
  iso('isos-emissary-hearth', "Emissary, Hearth", 'cruiser', 110, 472, 4, 1.6, [...slant('battery', 45, 4), fp('bays', 25, 2, [])]),
  iso('isos-emissary-spire', "Emissary, Spire", 'cruiser', 110, 472, 4, 1.6, [...slant('battery', 45, 4), missile(3)]),
  iso('isos-emissary-nexus', "Emissary, Nexus", 'cruiser', 110, 473, 4, 1.6, [...slant('battery', 45, 3), ...slant('lance', 30, 1), missile(3)]),
  iso('isos-defender', 'Defender', 'escort', 45, 464, 1, 1, [fp('battery', 30, 3), missile(2)]),
  iso('isos-facet', 'Facet', 'escort', 50, 474, 1, 1, [fp('battery', 45, 2), missile(2)]),
  iso('isos-messenger', 'Messenger', 'escort', 50, 465, 1, 1, [fp('battery', 30, 1)]),
  iso('isos-tether', 'Tether gunship', 'escort', 25, 466, 1, 0.8, [fp('battery', 30, 2), fp('lance', 30, 1, front)]),
  iso('isos-warden', 'Warden gunship', 'escort', 30, 475, 1, 0.8, [fp('battery', 30, 2, front), fp('lance', 30, 1)]),
  iso('isos-transport', 'Courier transport', 'escort', 0, 476, 1, 1, [fp('battery', 30, 2)]),
  station('isos-orbital-city', 'Orbital City', 150, 478, 10, 2.4, [fp('battery', 45, 12, 'all'), W('bays', 'bays', 25, 4, [])], 2),
  station('isos-security-orbital', 'Security Orbital', 50, 479, 4, 1.6, [fp('battery', 45, 4, 'all'), fp('lance', 30, 1, 'all')], 1),
  station('isos-orbital-core', 'Orbital, core module', 20, 480, 4, 1.3, [], 0),
  station('isos-waystation-bays', 'Waystation, launch bay', 30, 481, 4, 1, [W('bays', 'bays', 25, 1, [])], 0),
  station('isos-waystation-railgun', 'Waystation, railgun', 35, 481, 4, 1, [fp('battery', 45, 3, 'all')], 0),
]
export const ISOS_CRAFT = [
  { id: 'isos-vertex', fleet: 'isos', name: 'Vertex fighter', kind: 'ring fighter', speed: 25 }, { id: 'isos-delta', fleet: 'isos', name: 'Delta missile destroyer', kind: 'ring bomber', speed: 20 },
  { id: 'isos-missile', fleet: 'isos', name: 'Missile salvo', kind: 'torpedo', speed: 40 },
]
