// The seven newer fleets as the game plays them. Exports NEW_FLEETS (fleet ids), NEW_FLEET_SHIPS (playable profiles, merged into data/ships.js)
// and notYet(profile) (the weapons a ship has with no rule yet, for the fleet picker and ship panel).
// The drawings and base profiles stay in concordShips.js; this file decides which of those ships can go on the table and which guns can fire.
//
// Every ship keeps its weapons in their drawn order, because a drawn gun names its weapon by position (bp.mounts in view/blueprint.js). A weapon
// the engine has no rule for yet stays in the list with kind 'pending' and `book` holding the real kind, so it is drawn but can't fire. Nothing
// here is a stand-in rule: a pending gun stays silent until its rule is written. Only the roles in SHIP_ROLES reach the table.
import { CLASSES, splitShipId } from './fleetLists.js'
import { hasLiveCraft } from './craft.js'
import { setPhageLooks, phageBases } from './phageShips.js'
import { rukkaOver } from './rukkaProfiles.js'
import { isDiceStr } from '../rules/dicestr.js'
import { ISOS_PROFILES } from './isosProfiles.js'
import { KATHAROS_PROFILES } from './katharosProfiles.js'
import { DYAD_FLEET, SHOE_FLEET, ATHANATOI_FLEET, THNITOI_FLEET, PHAGE_FLEET, KATHAROS_FLEET, ISOS_FLEET } from './concordShips.js'

// the weapon kinds the engine resolves today: weapons batteries, lances, the Athanatoi starlance and torpedoes with a fixed strength
const WORKS = ['battery', 'lance', 'starlance', 'torpedo', 'bombardment', 'missile', 'lightning', 'starpulse', 'whip', 'ossuary', 'portal', 'heavybangers', 'grabbers', 'phantom', 'harpoon']   // 'missile': Isos missiles
const SHIP_ROLES = ['battleship', 'battlecruiser', 'cruiser', 'escort', 'transport', 'derelict', 'lump', 'fortress']   // the Rukka's hulk and Lump; no other new fleet has them // the Athanatoi's transport comes with the Convoy; no picker lists it (battle.js eligible)
// launch bays work for a fleet once it has live attack craft rows (data/craft.js); until then they stay pending
const game = (w, fleet) => (WORKS.includes(w.kind) || (w.kind === 'bays' && hasLiveCraft(fleet))) && (typeof w.str === 'number' || isDiceStr(w.str) || (w.kind === 'grabbers' && w.str === 'special')) ? w : { ...w, kind: 'pending', book: w.kind }
// Athanatoi ships have three speeds: [sunward edge in the front arc, in the rear arc, in the left or right arc], e.g. "10/20/25 cm";
// `speed` stays the highest, the third. The fourth number in each row is a reference number sailOf ignores.
// Their Turns value is "Special" (they pivot to any heading before they move), kept as `turns: 0` so the old straight-move code in battle.js
// reads a number; every rule that turns a ship checks `sail` first (rules/sail.js), and nothing reads `turns` of a ship that has `sail`.
const SAIL = {
  'ath-thalassa': [10, 20, 25, 320], 'ath-selene': [10, 20, 25, 321], 'ath-veil': [10, 20, 25, 322], 'ath-eos': [15, 20, 30, 323], 'ath-helios': [15, 20, 30, 324],
  'ath-asphodel': [10, 20, 30, 325], 'ath-oleander': [10, 20, 30, 326], 'ath-kalyx': [15, 20, 30, 327], 'ath-foxglove': [15, 20, 30, 328], 'ath-flame': [10, 20, 25, 329],
  'ath-duskhunter': [15, 20, 30, 332], 'ath-duskhunter-lance': [15, 20, 30, 332], 'ath-wyrmship': [10, 20, 25, 330], 'ath-stillship': [10, 20, 25, 331], 'transport-athanatoi': [10, 10, 15, 333],
}
const sailOf = id => {
  const k = Object.keys(SAIL).find(x => id === x || id.startsWith(x + '-'))   // the Wyrmship and Stillship variants carry their class id as a prefix
  return k ? { sunFront: SAIL[k][0], sunRear: SAIL[k][1], sunSide: SAIL[k][2] } : undefined
}
// `rules` (data/fleetLists.js CLASSES): the flags the engine reads off a ship, such as a Kalyx's "cannot initiate boarding actions"
const rulesOf = s => CLASSES[s.fleet]?.[splitShipId(s.fleet, s.id).cls]?.rules
const isosBase = s => { const o = ISOS_PROFILES[s.id]; if (!o) return s; const { page, ...rest } = o; return { ...s, ...rest, noTeleport: true, ...(s.id === 'isos-transport' ? { role: 'transport' } : {}), weapons: s.weapons.map(w => w.kind === 'missile' ? { ...w, minSpeed: 20 } : w) } }
const katharosBase = s => { const o = KATHAROS_PROFILES[s.id]; return o ? { ...s, ...o } : s }
// The Thnitoi's speed, turns and defences (data/concordShips.js leaves them out). Agony: cruiser, 6 hits, 35 cm, 90 degrees, void field (no shields), armour 5+, 0 turrets.
// Corsair: escort, 1 hit, 40 cm, 90 degrees, void field, armour 4+, 0 turrets. (The Harpoon's strength is listed as "Special"; here it is the module count.)
const thnitoiBase = s => s.fleet !== 'thnitoi' ? s : { ...s, speed: s.role === 'escort' ? 40 : 35, turns: 90, shields: 0, turrets: 0, armour: { front: s.role === 'escort' ? 4 : 5, other: s.role === 'escort' ? 4 : 5 },
  special: [...(s.special ?? []), 'Void fields instead of shields.'] }
const playable = list => list.map(thnitoiBase).map(isosBase).map(katharosBase).map(rukkaOver).filter(s => SHIP_ROLES.includes(s.role)).map(s => { const sail = s.fleet === 'athanatoi' ? sailOf(s.id) : undefined; const rules = rulesOf(s); return { ...s, turns: s.turns ?? 0, ...(sail ? { sail } : {}), ...(rules ? { rules } : {}), weapons: s.weapons.map(w => game(w, s.fleet)), ...(s.id === 'ath-flame' ? { vampires: true } : {}) } })   // The Flame of Helion carries Lamia raiders

export const NEW_FLEETS = ['concord', 'rukka', 'athanatoi', 'thnitoi', 'phage', 'katharos', 'isos']
setPhageLooks(PHAGE_FLEET)   // the drawn samples tell data/phageShips.js which rib and core a loadout is drawn with
// the Phage's classes come ready-made (every weapon live, data/phageShips.js); the drawn sample fits are art only
export const NEW_FLEET_SHIPS = [...[DYAD_FLEET, SHOE_FLEET, ATHANATOI_FLEET, THNITOI_FLEET, KATHAROS_FLEET, ISOS_FLEET].flatMap(playable), ...phageBases()]

const BOOK_NAME = { bays: 'launch bays', bombardment: 'bombardment cannon', heavybangers: 'heavy bangers', battery: 'bangers of rolled firepower', torpedo: 'torpedoes of rolled strength', starlance: 'starlances',
  missile: 'missiles', lightning: 'storm arcs', starpulse: 'sun flare', whip: 'storm lash', portal: 'portal', ossuary: 'ossuary', pyro: 'burningacid', bioplasma: 'searbile', feeder: 'feeder tentacles',
  claws: 'massive claws', 'bio-torpedo': 'bio-torpedoes', grabbers: 'grabbers', phantom: 'hollow lances', harpoon: 'harpoon' }
/** What on this ship has no rule yet, each once, for the fleet picker and the ship's panel. */
export const notYet = profile => [...new Set(profile.weapons.filter(w => w.kind === 'pending').map(w => BOOK_NAME[w.book] ?? w.book))]
