// The Phage ship classes: five classes whose weapons are bought slot by slot, the ship id that carries a loadout, and the stat lines.
// Exports PHAGE_CLASSES, slotsOf, phageJoin/phageSplit (the id codec), phageProfile, phageBases and setPhageLooks; used by data/fleets.js,
// data/ships.js, data/phageLists.js, data/fleetLists.js and view/blueprint.js.
//
// A ship in a Phage fleet is a class plus its weapon choices. The choices are the ship's id: `pha-hive_py_ba_bp_no_no` = prow burning acid, thorax launch bays,
// then three port/starboard sets (searbile, none, none). Port/starboard sets are sorted so one loadout has one id. A bare class id is the first choice of every slot.
// phageProfile(id) builds the profile for any such id (and caches it), so the engine, the builder and the drawing (view/blueprint.js) all read the same ship.
// The drawing is the matching drawn sample from PHAGE_FLEET (data/concordShips.js) when one has the same guns, else the class's nearest sample with the guns drawn from the profile.
const W = (loc, kind, range, str, arc) => ({ loc, kind, range, str, arc })
const LFR = ['left', 'front', 'right']
const F = ['front']

// choice: code, name, points, weapons.
const ch = (code, name, points, weapons = []) => ({ code, name, points, weapons })
const NONE = ch('no', 'none', 0)
const pair = (kind, range, str, loc2 = 'port', loc3 = 'starboard') => [W(loc2, kind, range, str, ['left']), W(loc3, kind, range, str, ['right'])]
const bays = n => [W('port', 'bays', 20, n, []), W('starboard', 'bays', 20, n, [])]

export const PHAGE_CLASSES = {
  'pha-hive': { name: 'Queen ship', role: 'battleship', points: 200, type: 'battleship', hits: 10, speed: 15, turns: 45, armour: { front: 5, other: 5 }, spores: 4, hive: true, ld: 8,
    special: ['Only queen ships have a Resolve value: 8, or 9 for +40 points.', 'Cannot use Come to New Heading special orders.',
      'Any ship firing on a queen ship suffers -1 Ld to ignore closer targets if a squadron of only Picket drones touches the queen ship and lies between.'],
    slots: [
      { slot: 'prow', label: 'Prow weapon', choices: [ch('py', 'burning acid battery', 30, [W('prow', 'pyro', 45, 8, F)]), ch('fc', 'feeder tentacles & massive claws', 15, [W('prow', 'feeder', 0, 'special', F), W('prow', 'claws', 0, 'special', F)]),
        ch('bp', 'searbile spines', 20, [W('prow', 'bioplasma', 15, 4, LFR)]), ch('bt', 'boarding torpedoes', 25, [W('prow', 'bio-torpedo', 15, 8, F)])] },
      { slot: 'thorax', label: 'Thorax weapon', choices: [ch('py', 'burning acid battery', 30, [W('thorax', 'pyro', 45, 8, F)]), ch('bp', 'searbile discharge', 20, [W('thorax', 'bioplasma', 15, 4, LFR)]), ch('ba', 'launch bays', 20, [W('thorax', 'bays', 20, 2, [])])] },
      ...[1, 2, 3].map(n => ({ slot: 'side', side: true, label: `Port/starboard set ${n}`, choices: [NONE, ch('py', 'burning acid batteries', 15, pair('pyro', 30, 4)), ch('bp', 'searbile discharge', 20, pair('bioplasma', 15, 2)), ch('ba', 'launch bays', 20, bays(1))] })),
    ] },
  'pha-cruiser': { name: 'Cruiser', role: 'cruiser', points: 80, type: 'cruiser', hits: 6, speed: 20, turns: 45, armour: { front: 5, other: 5 }, spores: 2,
    special: ['Prow and thorax torpedoes fire as separate salvoes, never combined.'],
    slots: [
      { slot: 'prow', label: 'Prow weapon', choices: [ch('py', 'burning acid battery', 20, [W('prow', 'pyro', 30, 8, LFR)]), ch('fe', 'feeder tentacles', 10, [W('prow', 'feeder', 0, 'special', F)]), ch('cl', 'massive claws', 5, [W('prow', 'claws', 0, 'special', F)]), ch('bt', 'boarding torpedoes', 10, [W('prow', 'bio-torpedo', 15, 4, F)])] },
      { slot: 'thorax', label: 'Thorax weapon', choices: [ch('fe', 'feeder tentacles', 10, [W('thorax', 'feeder', 0, 'special', F)]), ch('cl', 'massive claws', 5, [W('thorax', 'claws', 0, 'special', F)]), ch('bt', 'boarding torpedoes', 10, [W('thorax', 'bio-torpedo', 15, 4, F)])] },
      ...[1, 2].map(n => ({ slot: 'side', side: true, label: `Port/starboard set ${n}`, choices: [NONE, ch('py', 'burning acid batteries', 15, pair('pyro', 30, 4)), ch('bp', 'searbile discharge', 20, pair('bioplasma', 15, 2))] })),
    ] },
  'pha-gulper': { name: 'Gulper', role: 'escort', points: 25, type: 'escort', hits: 1, speed: 25, turns: 90, armour: { front: 6, other: 6 }, spores: 0, size: 1.1, braceAlways: true, soloEscort: true,
    special: ['Counts as always on Brace For Impact when taking damage: a 4+ save against each hit, blast marker hits included; other special orders as normal.', 'No brood cysts; cannot take the extra brood cysts refit.'],
    slots: [{ slot: 'weapon', label: 'Weapon', choices: [ch('py', 'burning acid battery', 15, [W('prow', 'pyro', 30, 6, F)]), ch('fe', 'feeder tentacles', 5, [W('prow', 'feeder', 0, 'special', F)]), ch('cl', 'massive claws', 10, [W('prow', 'claws', 0, 'special', F)]),
      ch('bp', 'searbile discharge', 10, [W('prow', 'bioplasma', 15, 2, F)]), ch('bt', 'boarding torpedoes', 15, [W('prow', 'bio-torpedo', 15, 2, F)])] }] },
  'pha-vanguard': { name: 'Forerunner drone', role: 'escort', points: 20, type: 'escort', hits: 1, speed: 25, turns: 90, armour: { front: 5, other: 5 }, spores: 1, size: 0.8, vanguard: true, soloEscort: true,
    special: ['Other Phage ships may always target any enemy 15 cm or less from a Forerunner drone.'],
    slots: [{ slot: 'weapon', label: 'Weapon', choices: [ch('py', 'burning acid battery', 5, [W('prow', 'pyro', 30, 2, F)]), ch('fe', 'feeder tentacles', 5, [W('prow', 'feeder', 0, 'special', F)])] }] },
  'pha-drone': { name: 'Picket drone', role: 'escort', points: 10, type: 'escort', hits: 1, speed: 15, turns: 45, armour: { front: 5, other: 5 }, spores: 1, size: 0.9, drone: true, soloEscort: true,
    special: ['Lost Scent case 7 may send it towards the nearest queen ship instead of a planet.', 'A squadron made up only of Picket drones that touches a queen ship screens it (queen ship rules).'],
    slots: [{ slot: 'weapon', label: 'Weapon', choices: [ch('py', 'burning acid battery', 10, [W('prow', 'pyro', 30, 4, F)]), ch('fe', 'feeder tentacles', 5, [W('prow', 'feeder', 0, 'special', F)]), ch('bp', 'searbile discharge', 5, [W('prow', 'bioplasma', 15, 2, F)]),
      ch('fs', 'fire ship (up to 10% of the drones)', 0, [])] }] },
}

/** The slots of a class that are real choices, in the order picks go: [{ slot, label, choices }]. */
export const slotsOf = cls => PHAGE_CLASSES[cls]?.slots ?? []

// ---- the id codec ----
const SEP = '_'
/** Class and picks (choice index per slot) -> the id. Side sets are sorted so one loadout has one id. */
export function phageJoin (cls, picks = []) {
  const slots = slotsOf(cls)
  if (!slots.length) return cls
  const codes = slots.map((s, i) => s.choices[picks[i] ?? 0]?.code ?? s.choices[0].code)
  const fixed = codes.filter((c, i) => !slots[i].side), sides = codes.filter((c, i) => slots[i].side).sort((a, b) => (a === 'no') - (b === 'no') || (a < b ? -1 : a > b ? 1 : 0))
  return [cls, ...fixed, ...sides].join(SEP)
}
/** An id -> { cls, picks } or null if it is not a Phage id. A bare class id is all first choices. */
export function phageSplit (id) {
  const [cls, ...codes] = String(id).split(SEP)
  const slots = slotsOf(cls)
  if (!slots.length) return null
  if (!codes.length) return { cls, picks: slots.map(() => 0) }
  const fixedN = slots.filter(s => !s.side).length
  if (codes.length !== slots.length) return null
  const picks = []
  let si = 0, sdi = fixedN
  for (let i = 0; i < slots.length; i++) {
    const code = codes[slots[i].side ? sdi++ : si++], k = slots[i].choices.findIndex(c => c.code === code)
    if (k < 0) return null
    picks.push(k)
  }
  return { cls, picks }
}

const cache = new Map()
/** The profile of a Phage id, or undefined. Rib and core for the drawing come from the nearest drawn sample (PHAGE_LOOKS, set by view-free code below). */
export function phageProfile (id) {
  if (cache.has(id)) return cache.get(id)
  const sp = phageSplit(id)
  if (!sp) return undefined
  const c = PHAGE_CLASSES[sp.cls], slots = slotsOf(sp.cls)
  const weapons = slots.flatMap((s, i) => s.choices[sp.picks[i] ?? 0].weapons.map(w => ({ ...w })))
  const fireShip = slots.some((s, i) => s.choices[sp.picks[i] ?? 0].code === 'fs')
  const kinds = weapons.map(w => w.loc[0] + w.kind).sort().join()
  const look = LOOKS[sp.cls]?.find(l => l.kinds === kinds) ?? LOOKS[sp.cls]?.find(l => l.prow === weapons.find(w => w.loc === 'prow')?.kind) ?? LOOKS[sp.cls]?.[0] ?? { rib: 'barrel', core: 'sac' }
  const { slots: _s, name, ld, ...rest } = c
  const p = { ...rest, id: phageJoin(sp.cls, sp.picks), fleet: 'phage', cls: sp.cls, name, shields: 0, turrets: 0, weapons, rib: look.rib, core: look.core, ...(fireShip ? { fireShip: true } : {}), ...(c.hive ? { ld } : {}) }
  cache.set(id, p)
  return p
}
/** The class profiles (each with its first choices) the fleet picker lists. */
export const phageBases = () => Object.keys(PHAGE_CLASSES).map(k => phageProfile(k))

// rib and core of the drawn samples in concordShips.js PHAGE_FLEET, keyed by what they carry: a ship with the same guns gets the same drawing
const LOOKS = {}
export function setPhageLooks (samples) {
  for (const k of Object.keys(LOOKS)) delete LOOKS[k]
  for (const s of samples) {
    const cls = s.id.replace(/-[a-e]$/, '').replace('pha-drone', 'pha-drone')
    const key = cls === 'pha-hive' || cls === 'pha-cruiser' || cls === 'pha-gulper' || cls === 'pha-vanguard' || cls === 'pha-drone' ? cls : null
    if (!key) continue
    ;(LOOKS[key] ??= []).push({ rib: s.rib, core: s.core, kinds: s.weapons.map(w => w.loc[0] + w.kind).sort().join(), prow: s.weapons.find(w => w.loc === 'prow')?.kind })
  }
  cache.clear()
}
