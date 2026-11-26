// Attack craft as data the engine reads. Exports CRAFT_ROWS and the lookups craftRows, rowOf, actsAs, hasLiveCraft and craftSpeed,
// used by rules/ordnance.js (waves and interception), rules/scenarios.js, data/fleets.js (which launch bays are live)
// and battle.js (the launch panel).
//
// One row per kind of attack craft a fleet launches. A wave's markers (rules/ordnance.js) are the row's `kind` strings, and the wave's `fleet` picks which fleet's rows
// they are looked up in, so two fleets can both have a 'fighter' with different speeds and rules. The rows say what a craft DOES; the engine never tests a fleet name.
//
// id the drawn picture's id, equal to the id in the fleet's *_CRAFT list in concordShips.js (so the pictures work)
// kind the marker string in a wave, and the word on the launch panel
// speed cm per Ordnance Phase
// acts what it does in rules terms: 'fighter', 'bomber', 'boat' (an assault boat). A craft that works as both lists two
// (Rukka buzza, Dropwing). The slowest marker sets the wave's speed.
// resilient a 4+ save once per Ordnance Phase when it meets other ordnance. 'fighters' = only against enemy fighters (Isos Delta).
// rerollAttacks the squadron rolls the dice that set its number of bomber attacks again, and the second roll stands (Athanatoi Phoenix and Eagle)
// torpedoOnly a torpedo bomber: counts as a bomber for interception, makes no bomber attack of its own, and may be swapped for a
// Strength 2 torpedo salvo (rules/ordnance.js convertTorpedoBombers) that moves `salvoSpeed` cm, the speed of the fleet's own tubes,
// and then follows the normal torpedo rules (for the Athanatoi, their own torpedo rules)
// needs a ship flag the carrier must have to launch it: 'vampires', 'torpedoBombers'. The flag is read from the ship, then its
// profile (rules/ordnance.js launchable), so the fleet builder only has to set it.
// annihilator a Dropwing Breaker: its attack runs add +1 attack each, and markers may forgo their runs to suppress turrets
// live true = the engine uses the row today. A fleet with no live row keeps its launch bays pending (data/fleets.js), and its Convoy clusters fly as another fleet's.
//
// To bring a fleet in: set `live: true` on its rows, and nothing else needs to change.
const BASE_ACTS = { fighter: ['fighter'], bomber: ['bomber'], 'assault boat': ['boat'] }

// The Freemen's and the Dominion's craft (ships.js ORDNANCE). Written out here, not imported: ships.js imports fleets.js, which imports this file.
// data/craft.test.js checks they still agree with ORDNANCE.
const old = (fleet, pre, names, page) => [['fighter', 30, names[0]], ['bomber', 20, names[1]], ['assault boat', 30, names[2]]].map(([kind, speed, id]) => ({ id: pre + id, fleet, name: '', kind, speed, page, acts: BASE_ACTS[kind], live: true }))
const OLD = [...old('freemen', 'fre-', ['fury', 'longwing', 'shark'], 53), ...old('dominion', 'dom-', ['carrion', 'pyrewing', 'gravehook'], 286)]

const ATHANATOI = [
  // Speeds 30, 20 and 25 cm. Duskwing and Nightjar share their rules, as do Phoenix and Eagle, so one row and one picture each.
  { id: 'ath-nightjar', fleet: 'athanatoi', name: 'Nightjar or Duskwing fighter', kind: 'fighter', speed: 30, acts: ['fighter'], resilient: true, live: true },
  { id: 'ath-aetos', fleet: 'athanatoi', name: 'Aetos or Halcyon bomber', kind: 'bomber', speed: 20, acts: ['bomber'], rerollAttacks: true, live: true },
  // Lamia raiders act as assault boats on the ships whose special rules allow them, at the cost given there.
  { id: 'ath-lamia', fleet: 'athanatoi', name: 'Lamia raider', kind: 'assault boat', speed: 25, acts: ['boat'], needs: 'vampires', live: true },
  // Torpedo bombers: 20 cm, bombers for interception; an Athanatoi carrier pays +15 per launch bay for them.
  { id: 'ath-torpedo-bomber', fleet: 'athanatoi', name: 'Torpedo bomber', kind: 'torpedo bomber', speed: 20, acts: ['bomber'], torpedoOnly: true, needs: 'torpedoBombers', salvoSpeed: 30, live: true },
]

// The Concord. A Dropwing is a fighter and an assault boat in one, 20 cm, resilient; an
// Annihilator is a fighter and a bomber in one, 20 cm, resilient, with its own turret-suppression bonus, in the Crusade list only: the list sets the
// ship flag `annihilators` that `needs` names.
const CONCORD = [
  { id: 'con-dropwing', fleet: 'concord', name: 'Dropwing gunship', kind: 'dropwing', speed: 20, acts: ['fighter', 'boat'], resilient: true, live: true },
  { id: 'con-annihilator', fleet: 'concord', name: 'Dropwing Breaker', kind: 'dropwing breaker', speed: 20, acts: ['fighter', 'bomber'], resilient: true, annihilator: true, needs: 'annihilators', live: true },
]


// The Rukka. A buzza is a fighter at 25 cm that attacks ships as a bomber, rolling a D3 not a D6 (`d3`), with +1 attack for each marker
// after turrets (`buzzaDropper`). An assault boat is 30 cm. A tin-fisher is 20 cm, no fighter, and may become a Strength 2 salvo that moves like a standard
// torpedo, 30 cm; the carrier needs the `torpedoBombers` flag (+10 per launch bay at its maximum).
const RUKKA = [
  { id: 'rukka-buzza', fleet: 'rukka', name: 'Buzza', kind: 'buzza', speed: 25, acts: ['fighter', 'bomber'], d3: true, buzzaDropper: true, live: true },
  { id: 'rukka-assault-boat', fleet: 'rukka', name: 'Assault boat', kind: 'assault boat', speed: 30, acts: ['boat'], live: true },
  { id: 'rukka-tin-fisher', fleet: 'rukka', name: 'Tin-fisher', kind: 'torpedo bomber', speed: 20, acts: ['bomber'], torpedoOnly: true, needs: 'torpedoBombers', salvoSpeed: 30, live: true },
]

// The Thnitoi: Kite fighters 30 cm and resilient; Thornwing bombers 20 cm that re-roll their number of attacks; Manacle assault boats 30 cm;
// torpedo bombers (+15 per bay for them) 20 cm. A Harpoon assault module launches and moves as an assault boat does, 30 cm, but from no
// launch bay: `harpoon` keeps it out of the bay panel and the launch limit (rules/thnitoi.js launchHarpoon), and its fighter save is the resilient 4+ once a phase.
const THNITOI = [
  { id: 'thn-kite', fleet: 'thnitoi', name: 'Kite fighter', kind: 'fighter', speed: 30, acts: ['fighter'], resilient: true, live: true },
  { id: 'thn-thornwing', fleet: 'thnitoi', name: 'Thornwing bomber', kind: 'bomber', speed: 20, acts: ['bomber'], rerollAttacks: true, live: true },
  { id: 'thn-manacle', fleet: 'thnitoi', name: 'Manacle assault boat', kind: 'assault boat', speed: 30, acts: ['boat'], live: true },
  { id: 'thn-torpedo-bomber', fleet: 'thnitoi', name: 'Torpedo bomber', kind: 'torpedo bomber', speed: 20, acts: ['bomber'], torpedoOnly: true, needs: 'torpedoBombers', salvoSpeed: 30, live: true },
  { id: 'thn-harpoon', fleet: 'thnitoi', name: 'Harpoon assault module', kind: 'harpoon', speed: 30, acts: ['harpoon'], resilient: true, harpoon: true, live: true },
]

// The Isos: Vertex Superiority Fighter 25 cm; Delta Missile Destroyer 20 cm, a resilient bomber whose 4+ save (once per Ordnance Phase)
// works only against enemy fighters, and which passes through all other ordnance. Never used to board.
const ISOS = [
  { id: 'isos-vertex', fleet: 'isos', name: 'Vertex fighter', kind: 'fighter', speed: 25, acts: ['fighter'], live: true },
  { id: 'isos-delta', fleet: 'isos', name: 'Delta missile destroyer', kind: 'bomber', speed: 20, acts: ['bomber'], resilient: 'fighters', live: true },
]

// The Phage: only fighters (20 cm) and assault boats (15 cm); no bombers. Their boarding torpedoes are torpedoes (rules/ordnance.js), 15 cm.
const PHAGE = [
  { id: 'pha-fighter', fleet: 'phage', name: 'Fighter brood', kind: 'fighter', speed: 20, acts: ['fighter'], live: true },
  { id: 'pha-assault-boat', fleet: 'phage', name: 'Assault brood', kind: 'assault boat', speed: 15, acts: ['boat'], live: true },
]

export const CRAFT_ROWS = [...OLD, ...ATHANATOI, ...CONCORD, ...RUKKA, ...ISOS, ...PHAGE, ...THNITOI]

export const craftRows = fleet => CRAFT_ROWS.filter(r => r.fleet === fleet)
export const rowOf = (fleet, kind) => CRAFT_ROWS.find(r => r.fleet === fleet && r.kind === kind)
/** Does this kind of craft do this job ('fighter' | 'bomber' | 'boat')? A kind with no row (never launched) does nothing. */
export const actsAs = (fleet, kind, job) => !!rowOf(fleet, kind)?.acts.includes(job)
/** Fleets whose launch bays work: any live row. The rest keep their bays pending (data/fleets.js). */
export const hasLiveCraft = fleet => CRAFT_ROWS.some(r => r.fleet === fleet && r.live)
export const craftSpeed = (fleet, kind) => rowOf(fleet, kind).speed
