// VOID WARS: Fleets ship profiles. SHIPS holds the Freemen (Rimward Reach Fleet List) and Dominion (Dominion Incursion Fleet List)
// ships and their transports; ORDNANCE their attack craft and torpedo counters. ALL_SHIPS adds the seven newer fleets (data/fleets.js)
// and the Bastion forts (data/forts.js). Also exports shipById, shipsOf and sizeOf. Read by almost everything: the rules engine,
// the fleet builder, the board view and the ship art.
//
// Units: VOID WARS: Fleets measures in CENTIMETRES (speed and range below are cm). The engine works in cm and
// never learns what a pixel is.
//
// Weapon fields:
// loc 'port' | 'starboard' | 'prow' | 'dorsal' | 'aft' — where it is mounted (also where it is drawn)
// kind 'battery' (weapons battery) | 'lance' | 'torpedo' | 'sunburst' (sunburst cannon) | 'bays' (launch bays)
// range cm (torpedoes: their speed; sunburst cannon: max, with minRange); str firepower / strength / squadrons
// arc any of 'left' 'front' 'right' 'rear', or 'all' (all around)
// armour: { front, other } — "6+ front / 5+" is { front: 6, other: 5 }; a single "5+" is the same on every side.

const W = (loc, kind, range, str, arc, extra = {}) => ({ loc, kind, range, str, arc, ...extra })
const LFR = ['left', 'front', 'right']

// Attack craft and torpedoes per fleet (Freemen, then Dominion); speeds match the launch-bay lines of the ship profiles
// (e.g. Sovereign, Dominion host barge, Derelict).
export const ORDNANCE = [
  { id: 'fre-fury', fleet: 'freemen', name: 'Merlin interceptor', kind: 'fighter', speed: 30 },
  { id: 'fre-longwing', fleet: 'freemen', name: 'Longwing bomber', kind: 'bomber', speed: 20 },
  { id: 'fre-shark', fleet: 'freemen', name: 'Pike assault boat', kind: 'assault boat', speed: 30 },
  { id: 'fre-torpedo', fleet: 'freemen', name: 'Torpedo salvo', kind: 'torpedo', speed: 30 },
  { id: 'dom-carrion', fleet: 'dominion', name: 'Carrion fighter', kind: 'fighter', speed: 30 },
  { id: 'dom-pyrewing', fleet: 'dominion', name: 'Pyrewing bomber', kind: 'bomber', speed: 20 },
  { id: 'dom-gravehook', fleet: 'dominion', name: 'Gravehook assault craft', kind: 'assault boat', speed: 30 },
  { id: 'dom-torpedo', fleet: 'dominion', name: 'Torpedo salvo', kind: 'torpedo', speed: 30 },
  { id: 'dom-boarding-torpedo', fleet: 'dominion', name: 'Boarding torpedo', kind: 'boarding torpedo', speed: 30 },
]

export const SHIPS = [
  // ---------------- FREEMEN NAVY — Rimward Reach Fleet List ----------------
  { id: 'sovereign', fleet: 'freemen', name: 'Sovereign class battleship', role: 'battleship', points: 365,
    type: 'battleship', hits: 12, speed: 15, turns: 45, shields: 4, armour: { front: 5, other: 5 }, turrets: 5,
    weapons: [W('port', 'battery', 60, 6, ['left']), W('starboard', 'battery', 60, 6, ['right']),
      W('port', 'bays', 30, 4, []), W('starboard', 'bays', 30, 4, []),
      W('dorsal', 'battery', 60, 5, LFR), W('prow', 'battery', 60, 5, LFR)],
    special: ['Cannot use Come to New Heading special orders.', 'No armoured prow: sensor probes give +1 Resolve.'] },
  { id: 'reckoning', fleet: 'freemen', name: 'Reckoning class battleship', role: 'battleship', points: 345,
    type: 'battleship', hits: 12, speed: 20, turns: 45, shields: 4, armour: { front: 6, other: 5 }, turrets: 4,
    weapons: [W('port', 'battery', 60, 12, ['left']), W('starboard', 'battery', 60, 12, ['right']),
      W('dorsal', 'lance', 60, 3, LFR), W('prow', 'torpedo', 30, 9, ['front'])],
    special: ['Cannot use Come to New Heading special orders.'] },
  { id: 'mars', fleet: 'freemen', name: 'Meridian class battlecruiser', role: 'battlecruiser', points: 270,
    type: 'cruiser', hits: 8, speed: 20, turns: 45, shields: 2, armour: { front: 6, other: 5 }, turrets: 2,
    weapons: [W('port', 'bays', 30, 2, []), W('starboard', 'bays', 30, 2, []),
      W('port', 'battery', 45, 6, ['left']), W('starboard', 'battery', 45, 6, ['right']),
      W('dorsal', 'lance', 60, 2, LFR), W('prow', 'sunburst', 150, 1, ['front'], { minRange: 30 })] },
  { id: 'suzerain', fleet: 'freemen', name: 'Suzerain class battlecruiser', role: 'battlecruiser', points: 220,
    type: 'cruiser', hits: 8, speed: 20, turns: 45, shields: 2, armour: { front: 6, other: 5 }, turrets: 2,
    weapons: [W('port', 'battery', 60, 8, ['left']), W('starboard', 'battery', 60, 8, ['right']),
      W('dorsal', 'lance', 60, 2, LFR), W('prow', 'torpedo', 30, 6, ['front'])] },
  { id: 'steward', fleet: 'freemen', name: 'Steward class cruiser', role: 'cruiser', points: 220,
    type: 'cruiser', hits: 8, speed: 20, turns: 45, shields: 2, armour: { front: 6, other: 5 }, turrets: 3,
    weapons: [W('port', 'bays', 30, 2, []), W('starboard', 'bays', 30, 2, []),
      W('port', 'battery', 30, 6, ['left']), W('starboard', 'battery', 30, 6, ['right']),
      W('prow', 'torpedo', 30, 6, ['front'])] },
  { id: 'cannonade', fleet: 'freemen', name: 'Cannonade class cruiser', role: 'cruiser', points: 190,
    type: 'cruiser', hits: 8, speed: 20, turns: 45, shields: 2, armour: { front: 6, other: 5 }, turrets: 2,
    weapons: [W('port', 'battery', 30, 12, ['left']), W('starboard', 'battery', 30, 12, ['right']),
      W('prow', 'sunburst', 150, 1, ['front'], { minRange: 30 })] },
  { id: 'tribune', fleet: 'freemen', name: 'Tribune class cruiser', role: 'cruiser', points: 185,
    type: 'cruiser', hits: 8, speed: 20, turns: 45, shields: 2, armour: { front: 6, other: 5 }, turrets: 2,
    weapons: [W('port', 'battery', 45, 4, ['left']), W('starboard', 'battery', 45, 4, ['right']),
      W('port', 'battery', 30, 6, ['left']), W('starboard', 'battery', 30, 6, ['right']),
      W('prow', 'torpedo', 30, 6, ['front'])] },
  { id: 'rimward', fleet: 'freemen', name: 'Rimward class cruiser', role: 'cruiser', points: 180,
    type: 'cruiser', hits: 8, speed: 20, turns: 45, shields: 2, armour: { front: 6, other: 5 }, turrets: 2,
    weapons: [W('port', 'lance', 30, 4, ['left']), W('starboard', 'lance', 30, 4, ['right']),
      W('prow', 'torpedo', 30, 6, ['front'])] },
  { id: 'lantern', fleet: 'freemen', name: 'Lantern class cruiser', role: 'cruiser', points: 180,
    type: 'cruiser', hits: 8, speed: 20, turns: 45, shields: 2, armour: { front: 6, other: 5 }, turrets: 2,
    weapons: [W('port', 'lance', 30, 2, ['left']), W('starboard', 'lance', 30, 2, ['right']),
      W('port', 'battery', 30, 6, ['left']), W('starboard', 'battery', 30, 6, ['right']),
      W('prow', 'torpedo', 30, 6, ['front'])] },
  { id: 'intrepid', fleet: 'freemen', name: 'Intrepid class light cruiser', role: 'cruiser', points: 110,
    type: 'cruiser', hits: 6, speed: 25, turns: 90, shields: 1, armour: { front: 5, other: 5 }, turrets: 1,
    weapons: [W('port', 'battery', 30, 4, ['left']), W('starboard', 'battery', 30, 4, ['right']),
      W('prow', 'lance', 30, 3, ['front'])],
    special: ['Better thrusters: +D6 cm on All Ahead Full.'] },
  { id: 'wildfire', fleet: 'freemen', name: 'Wildfire class frigate', role: 'escort', points: 40,
    type: 'escort', hits: 1, speed: 25, turns: 90, shields: 1, armour: { front: 5, other: 5 }, turrets: 2,
    weapons: [W('prow', 'lance', 30, 1, ['front']), W('prow', 'battery', 30, 2, LFR)] },
  { id: 'sword', fleet: 'freemen', name: 'Cutlass class frigate', role: 'escort', points: 35,
    type: 'escort', hits: 1, speed: 25, turns: 90, shields: 1, armour: { front: 5, other: 5 }, turrets: 2,
    weapons: [W('prow', 'battery', 30, 4, LFR)] },
  { id: 'adder', fleet: 'freemen', name: 'Adder class destroyer', role: 'escort', points: 30,
    type: 'escort', hits: 1, speed: 30, turns: 90, shields: 1, armour: { front: 4, other: 4 }, turrets: 1,
    weapons: [W('prow', 'torpedo', 30, 2, ['front']), W('prow', 'battery', 30, 1, LFR)] },

  // ---------------- TRANSPORTS — scenario pieces, not in either fleet list (points "Special") ----------------
  // The Convoy and Planetary Assault scenarios give them out. The Dominion list has no transport
  // profile, so a Dominion transport uses the same one.
  { id: 'transport', fleet: 'freemen', name: 'Transport', role: 'transport', points: 0,
    type: 'escort', hits: 1, speed: 15, turns: 45, shields: 1, armour: { front: 5, other: 5 }, turrets: 1,
    weapons: [W('dorsal', 'battery', 15, 2, LFR)],
    special: ['All Ahead Full adds only +3D6 cm.', 'Randomly rolled Resolve is one lower: 5 to 8.'] },
  { id: 'transport-dominion', fleet: 'dominion', name: 'Dominion transport', role: 'transport', points: 0,
    type: 'escort', hits: 1, speed: 15, turns: 45, shields: 1, armour: { front: 5, other: 5 }, turrets: 1,
    weapons: [W('dorsal', 'battery', 15, 2, LFR)],
    special: ['All Ahead Full adds only +3D6 cm.', 'Randomly rolled Resolve is one lower: 5 to 8.'] },

  // ---------------- DOMINION — Dominion Incursion Fleet List ----------------
  { id: 'spacehulk', fleet: 'dominion', name: 'Dominion Derelict', role: 'derelict', points: 650,
    type: 'defence', hits: 40, speed: 10, turns: null, shields: 3, armour: { front: 4, other: 4 }, turrets: 6,
    weapons: [W('port', 'battery', 45, 12, ['left']), W('starboard', 'battery', 45, 12, ['right']),
      W('port', 'bays', 30, 4, []), W('starboard', 'bays', 30, 4, []),
      W('port', 'torpedo', 30, 8, ['left']), W('starboard', 'torpedo', 30, 8, ['right']),
      W('dorsal', 'lance', 60, 4, 'all'), W('prow', 'battery', 45, 12, ['front']),
      W('prow', 'lance', 30, 4, ['front']), W('prow', 'torpedo', 30, 8, ['front']),
      W('aft', 'battery', 45, 12, ['rear'])],
    special: ['Moves exactly 10 cm straight ahead every turn; blast markers and damage never slow it.',
      'No Come to New Heading or Burn Retros orders.'] },
  { id: 'battlebarge', fleet: 'dominion', name: 'Dominion host barge', role: 'battleship', points: 410,
    type: 'battleship', hits: 12, speed: 20, turns: 45, shields: 4, armour: { front: 5, other: 5 }, turrets: 4,
    weapons: [W('port', 'battery', 60, 6, ['left']), W('starboard', 'battery', 60, 6, ['right']),
      W('dorsal', 'lance', 60, 3, LFR), W('port', 'bays', 30, 3, []), W('starboard', 'bays', 30, 3, []),
      W('prow', 'bays', 30, 2, []), W('prow', 'lance', 30, 4, ['front'])],
    special: ['Cannot use Come to New Heading special orders.'] },
  { id: 'sunderer', fleet: 'dominion', name: 'Sunderer class battleship', role: 'battleship', points: 400,
    type: 'battleship', hits: 12, speed: 20, turns: 45, shields: 4, armour: { front: 5, other: 5 }, turrets: 4,
    weapons: [W('port', 'bays', 30, 4, []), W('starboard', 'bays', 30, 4, []),
      W('port', 'battery', 60, 6, ['left']), W('starboard', 'battery', 60, 6, ['right']),
      W('dorsal', 'lance', 60, 3, LFR), W('prow', 'lance', 30, 4, ['front'])],
    special: ['No Come to New Heading orders.'] },
  { id: 'harrower', fleet: 'dominion', name: 'Harrower class battleship', role: 'battleship', points: 300,
    type: 'battleship', hits: 12, speed: 25, turns: 45, shields: 4, armour: { front: 5, other: 5 }, turrets: 4,
    weapons: [W('port', 'lance', 60, 4, ['left']), W('starboard', 'lance', 60, 4, ['right']),
      W('dorsal', 'battery', 60, 6, LFR), W('prow', 'torpedo', 30, 9, ['front'])],
    special: ['No Come to New Heading orders.'] },
  { id: 'loathing', fleet: 'dominion', name: 'Loathing class grand cruiser', role: 'grand cruiser', points: 230,
    type: 'grand cruiser', hits: 10, speed: 20, turns: 45, shields: 2, armour: { front: 5, other: 5 }, turrets: 3,
    weapons: [W('port', 'battery', 45, 14, ['left']), W('starboard', 'battery', 45, 14, ['right']),
      W('dorsal', 'lance', 30, 3, LFR), W('prow', 'torpedo', 30, 6, ['front'])] },
  { id: 'lethe', fleet: 'dominion', name: 'Lethe class heavy cruiser', role: 'heavy cruiser', points: 260,
    type: 'cruiser', hits: 8, speed: 25, turns: 45, shields: 2, armour: { front: 5, other: 5 }, turrets: 3,
    weapons: [W('port', 'bays', 30, 3, []), W('starboard', 'bays', 30, 3, []),
      W('dorsal', 'lance', 60, 2, LFR), W('prow', 'battery', 60, 6, LFR)] },
  { id: 'nyx', fleet: 'dominion', name: 'Nyx class heavy cruiser', role: 'heavy cruiser', points: 230,
    type: 'cruiser', hits: 8, speed: 25, turns: 45, shields: 2, armour: { front: 5, other: 5 }, turrets: 3,
    weapons: [W('port', 'bays', 30, 2, []), W('starboard', 'bays', 30, 2, []),
      W('port', 'battery', 45, 4, ['left']), W('starboard', 'battery', 45, 4, ['right']),
      W('dorsal', 'lance', 60, 2, LFR), W('prow', 'battery', 45, 6, LFR)] },
  { id: 'charnel', fleet: 'dominion', name: 'Charnel class heavy cruiser', role: 'heavy cruiser', points: 200,
    type: 'cruiser', hits: 8, speed: 25, turns: 45, shields: 2, armour: { front: 5, other: 5 }, turrets: 2,
    weapons: [W('port', 'battery', 45, 10, ['left']), W('starboard', 'battery', 45, 10, ['right']),
      W('dorsal', 'lance', 60, 2, LFR), W('prow', 'lance', 60, 2, ['front'])] },
  { id: 'gallows', fleet: 'dominion', name: 'Gallows class heavy cruiser', role: 'heavy cruiser', points: 190,
    type: 'cruiser', hits: 8, speed: 25, turns: 45, shields: 2, armour: { front: 5, other: 5 }, turrets: 3,
    weapons: [W('port', 'lance', 60, 2, ['left']), W('starboard', 'lance', 60, 2, ['right']),
      W('dorsal', 'lance', 45, 2, LFR), W('prow', 'battery', 45, 6, LFR)] },
  { id: 'ruin', fleet: 'dominion', name: 'Ruin class cruiser', role: 'cruiser', points: 190,
    type: 'cruiser', hits: 8, speed: 25, turns: 45, shields: 2, armour: { front: 5, other: 5 }, turrets: 3,
    weapons: [W('port', 'bays', 30, 2, []), W('starboard', 'bays', 30, 2, []),
      W('port', 'lance', 60, 2, ['left']), W('starboard', 'lance', 60, 2, ['right']),
      W('prow', 'battery', 30, 6, LFR)] },
  { id: 'bloodshed', fleet: 'dominion', name: 'Bloodshed class cruiser', role: 'cruiser', points: 180,
    type: 'cruiser', hits: 8, speed: 25, turns: 45, shields: 2, armour: { front: 5, other: 5 }, turrets: 2,
    weapons: [W('port', 'battery', 45, 6, ['left']), W('starboard', 'battery', 45, 6, ['right']),
      W('port', 'battery', 60, 4, ['left']), W('starboard', 'battery', 60, 4, ['right']),
      W('prow', 'battery', 60, 6, LFR)] },
  { id: 'pyre', fleet: 'dominion', name: 'Pyre class cruiser', role: 'cruiser', points: 180,
    type: 'cruiser', hits: 8, speed: 25, turns: 45, shields: 2, armour: { front: 5, other: 5 }, turrets: 2,
    weapons: [W('port', 'lance', 45, 2, ['left']), W('starboard', 'lance', 45, 2, ['right']),
      W('port', 'battery', 45, 4, ['left']), W('starboard', 'battery', 45, 4, ['right']),
      W('prow', 'battery', 60, 6, LFR)] },
  { id: 'malice', fleet: 'dominion', name: 'Malice class cruiser', role: 'cruiser', points: 170,
    type: 'cruiser', hits: 8, speed: 25, turns: 45, shields: 2, armour: { front: 5, other: 5 }, turrets: 2,
    weapons: [W('port', 'battery', 45, 10, ['left']), W('starboard', 'battery', 45, 10, ['right']),
      W('prow', 'lance', 60, 2, ['front'])] },
  { id: 'shambles', fleet: 'dominion', name: 'Shambles class cruiser', role: 'cruiser', points: 165,
    type: 'cruiser', hits: 8, speed: 30, turns: 45, shields: 2, armour: { front: 5, other: 5 }, turrets: 2,
    weapons: [W('port', 'lance', 30, 2, ['left']), W('starboard', 'lance', 30, 2, ['right']),
      W('port', 'battery', 30, 8, ['left']), W('starboard', 'battery', 30, 8, ['right']),
      W('prow', 'battery', 30, 6, LFR)],
    special: ['Better thrusters: +5D6 cm on All Ahead Full.'] },
  { id: 'apostate', fleet: 'dominion', name: 'Apostate class raider', role: 'escort', points: 45,
    type: 'escort', hits: 1, speed: 30, turns: 90, shields: 1, armour: { front: 5, other: 5 }, turrets: 2,
    weapons: [W('prow', 'battery', 45, 2, LFR), W('prow', 'lance', 30, 1, ['front'])],
    special: ['No column shift for firing over 30 cm.'] },
  { id: 'faithless', fleet: 'dominion', name: 'Faithless class raider', role: 'escort', points: 40,
    type: 'escort', hits: 1, speed: 30, turns: 90, shields: 1, armour: { front: 5, other: 5 }, turrets: 1,
    weapons: [W('prow', 'battery', 30, 2, LFR), W('prow', 'torpedo', 30, 2, ['front'])] },
  { id: 'profaner', fleet: 'dominion', name: 'Profaner class destroyer', role: 'escort', points: 30,
    type: 'escort', hits: 1, speed: 30, turns: 90, shields: 1, armour: { front: 4, other: 4 }, turrets: 1,
    weapons: [W('prow', 'battery', 30, 3, LFR)] },
]

import { DEFENCES } from './defences.js'
import { NEW_FLEET_SHIPS } from './fleets.js'
import { BASTION } from './forts.js'
import { phageProfile } from './phageShips.js'
// every ship the game can field: the Freemen and Dominion lists above, then the seven newer fleets (data/fleets.js) and the forts. SHIPS itself stays those two lists, for the sprites.
export const ALL_SHIPS = [...SHIPS, ...NEW_FLEET_SHIPS, ...BASTION]
export const shipById = id => ALL_SHIPS.find(s => s.id === id) ?? DEFENCES.find(d => d.id === id) ?? phageProfile(id)   // planetary defences too
export const shipsOf = fleet => ALL_SHIPS.filter(s => s.fleet === fleet)

// Drawing size class, for the pictures only (both styles): the length in drawing units, prow to stern.
// Not a rule — distances are measured from the stem of the ship's base to the stem of the target, not from the model.
export const SIZE = { escort: 1, transport: 1.2, cruiser: 2, 'heavy cruiser': 2.2, battlecruiser: 2.2, 'grand cruiser': 2.5,
  battleship: 3, 'derelict': 3.6 }
export const sizeOf = ship => ship.size ?? (ship.hits === 6 ? 1.6 : (SIZE[ship.role] ?? 2))   // a defence may give its own size // the Intrepid light cruiser: 6 hits
