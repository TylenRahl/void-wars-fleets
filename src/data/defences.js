// Planetary defences: stationary platforms, system defence vessels, ground silos, mines and the Isos and Rukka orbitals, usable when a
// scenario gives the defender points for them. Exports DEFENCES, isDefence, isStationary, ORBITAL_MODULES and isosOrbital, used by
// rules/defences.js and battle.js (the set-up page). The Bastion star fort (875 points, four quadrants) is in data/forts.js.
//
// Weapon `loc` on a stationary defence is the part its critical hits table damages: 'lances',
// 'main' (weapons batteries) or 'bays' (attack craft and torpedoes). Their weapons fire all round ('all').
// role: 'platform' (high orbit, stationary), 'mobile' (moves, an escort), 'ground' (low orbit table, front arc only),
// 'mine' (an orbital mine: an ordnance marker), 'minefield' (an area).
const W = (loc, kind, range, str, arc, extra = {}) => ({ loc, kind, range, str, arc, ...extra })
const LFR = ['left', 'front', 'right']
const stat = (hits, shields, armour, turrets) => ({ type: 'defence', hits, speed: 0, turns: 0, shields, armour: { front: armour, other: armour }, turrets })

export const DEFENCES = [
  { id: 'obsidian', size: 3.4, name: 'Obsidian Monolith', role: 'platform', points: 400, ...stat(16, 6, 5, 6), craft: ['fighter', 'bomber'],
    weapons: [W('main', 'battery', 60, 20, 'all'), W('lances', 'lance', 60, 4, 'all'), W('bays', 'bays', 30, 8, [])] },
  { id: 'spacestation', size: 2.6, name: 'Space station', role: 'platform', points: 150, ...stat(8, 2, 5, 4), craft: ['fighter', 'bomber'],
    weapons: [W('main', 'battery', 60, 12, 'all'), W('lances', 'lance', 30, 3, 'all'), W('bays', 'bays', 30, 4, [])] },
  { id: 'orbitaldock', size: 2.2, name: 'Orbital dock', role: 'platform', points: 90, ...stat(6, 2, 5, 3), craft: ['fighter', 'bomber'],
    weapons: [W('main', 'battery', 30, 4, 'all'), W('bays', 'bays', 30, 4, [])] },
  { id: 'laserplatform', size: 1.3, name: 'Orbital defence laser platform', role: 'platform', points: 30, ...stat(1, 1, 6, 2),
    weapons: [W('lances', 'lance', 30, 2, 'all')] },
  { id: 'torpedolauncher', size: 1.3, name: 'Orbital torpedo launcher', role: 'platform', points: 30, ...stat(1, 1, 6, 2),
    weapons: [W('bays', 'torpedo', 30, 6, 'all')] },
  { id: 'weaponsplatform', size: 1.3, name: 'Orbital weapons platform', role: 'platform', points: 30, ...stat(1, 1, 6, 2),
    weapons: [W('main', 'battery', 60, 6, 'all')] },
  { id: 'orbitalmine', name: 'Orbital mine', role: 'mine', points: 5, type: 'mine', hits: 1, speed: 10, turns: 0, shields: 0, armour: { front: 6, other: 6 }, turrets: 0, weapons: [] },
  { id: 'minefield', name: 'Minefield', role: 'minefield', points: 40, max: 2, type: 'minefield', hits: 1, speed: 0, turns: 0, shields: 0, armour: { front: 6, other: 6 }, turrets: 0, weapons: [] },
  { id: 'monitor', size: 1.2, name: 'Defence monitor', role: 'mobile', points: 60, type: 'escort', hits: 1, speed: 10, turns: 45, shields: 2, armour: { front: 6, other: 6 }, turrets: 2,
    weapons: [W('prow', 'battery', 30, 8, LFR), W('prow', 'lance', 30, 1, ['front'])] },
  { id: 'systemship', size: 1, name: 'System ship', role: 'mobile', points: 20, type: 'escort', hits: 1, speed: 15, turns: 45, shields: 1, armour: { front: 5, other: 5 }, turrets: 1,
    weapons: [W('prow', 'battery', 30, 3, LFR)] },
  { id: 'fireship', size: 1, name: 'Fire ship', role: 'mobile', points: 10, max: 6, type: 'escort', hits: 1, speed: 15, turns: 45, shields: 1, armour: { front: 5, other: 5 }, turrets: 1,
    weapons: [], special: ['Detonates in its Manoeuvre Phase: D3 Fire criticals on every ship within 3D6 cm; escorts and ordnance there are destroyed.'] },
  { id: 'airbase', size: 1.2, name: 'Air base', role: 'ground', points: 20, max: 4, type: 'ground', hits: 1, speed: 0, turns: 0, shields: 0, armour: { front: 6, other: 6 }, turrets: 2, craft: ['fighter', 'bomber'],
    weapons: [W('bays', 'bays', 30, 4, [])] },
  { id: 'lasersilo', size: 1, name: 'Defence laser silo', role: 'ground', points: 15, max: 8, type: 'ground', hits: 1, speed: 0, turns: 0, shields: 0, armour: { front: 6, other: 6 }, turrets: 0,
    weapons: [W('lances', 'lance', 60, 3, ['front'])] },
  { id: 'missilesilo', size: 1, name: 'Missile silo', role: 'ground', points: 5, max: 8, type: 'ground', hits: 1, speed: 0, turns: 0, shields: 0, armour: { front: 6, other: 6 }, turrets: 0,
    weapons: [W('bays', 'torpedo', 30, 6, ['front'])] },

  // ---- The Isos orbitals. `race` says who may buy them: the Isos may spend their planetary defence points ONLY on these, and nobody else
  // may buy them. They follow the High Orbit and Satellite defence rules, are halved in boarding value, and carry Tracking Systems (range 10 cm).
  { id: 'isos-orbital-city', race: 'isos', size: 2.4, name: 'Sky Caste Orbital City', role: 'platform', points: 150, halfBoarding: true, tracking: 10, ...stat(10, 3, 5, 4), craft: ['fighter', 'bomber'],
    hooks: { capacity: 2, takes: ['tether', 'warden'] }, weapons: [W('main', 'battery', 45, 12, 'all'), W('bays', 'bays', 25, 4, [])] },
  { id: 'isos-security-orbital', race: 'isos', size: 1.6, name: 'Security Orbital', role: 'platform', points: 50, halfBoarding: true, tracking: 10, ...stat(4, 1, 5, 4),
    weapons: [W('main', 'battery', 45, 4, 'all'), W('lances', 'lance', 30, 1, 'all')] },
  // An Orbital is a core module plus up to four others, played as a single model; built by isosOrbital below
  { id: 'isos-orbital-core', race: 'isos', size: 1.3, name: 'Isos Orbital (core module)', role: 'platform', points: 20, halfBoarding: true, ...stat(4, 1, 5, 2), weapons: [] },
  { id: 'isos-waystation-bays', race: 'isos', waystation: true, size: 1, name: 'Waystation (launch bay)', role: 'platform', points: 30, halfBoarding: true, tracking: 10, ...stat(4, 1, 5, 3), craft: ['fighter', 'bomber'], weapons: [W('bays', 'bays', 25, 1, [])] },
  { id: 'isos-waystation-hook', race: 'isos', waystation: true, size: 1, name: 'Waystation (gravitic hook)', role: 'platform', points: 25, halfBoarding: true, tracking: 10, ...stat(4, 1, 5, 3), hooks: { capacity: 1, takes: ['tether', 'warden'] }, weapons: [] },
  { id: 'isos-waystation-railgun', race: 'isos', waystation: true, size: 1, name: 'Waystation (railgun battery)', role: 'platform', points: 35, halfBoarding: true, tracking: 10, ...stat(4, 1, 5, 3), weapons: [W('main', 'battery', 45, 3, 'all')] },
  { id: 'isos-waystation-ion', race: 'isos', waystation: true, size: 1, name: 'Waystation (ion cannon)', role: 'platform', points: 35, halfBoarding: true, tracking: 10, ...stat(4, 1, 5, 3), weapons: [W('lances', 'lance', 30, 1, 'all')] },
  // ---- Rukka Lumps as planetary defences: bought with the defence points when the Rukka defend, and played under the planetary
  // defence rules (Resolve 7, Reload Ordnance and Brace only, stationary). Stats as the Lump; a Lump's critical hit is +1 damage and it breaks into 4 Blast Markers.
  { id: 'rukka-lump-defence', race: 'rukka', size: 1.5, name: 'Lump', role: 'platform', points: 80, lump: true, ...stat(8, 1, 5, 1),
    weapons: [W('main', 'heavybangers', 15, 4, 'all'), W('main', 'battery', 45, 'D6+6', 'all'), W('bays', 'torpedo', 30, 'D6', 'all')] },
].map(d => ({ ...d, fleet: 'defence' }))
export const isDefence = p => p?.fleet === 'defence'
export const isStationary = p => isDefence(p) && p.speed === 0

/** The Isos Orbital modules: a security module (+1 turret) of ONE kind, a manufacturing and research module (shields +1 to a maximum of 3, a tracking system),
 * a habitat module (+1 damage point). An Orbital is its core module (20 points) plus the others, at most four more. Returns the profile and its points. */
export const ORBITAL_MODULES = {
  bays: { name: 'Security: launch bays', points: 10, weapon: { loc: 'bays', kind: 'bays', range: 25, str: 1, arc: [] }, turrets: 1 },
  hook: { name: 'Security: gravitic hook', points: 5, hooks: 1, turrets: 1 },
  railgun: { name: 'Security: railgun battery', points: 15, weapon: { loc: 'main', kind: 'battery', range: 45, str: 3, arc: 'all' }, turrets: 1 },
  ion: { name: 'Security: ion cannon', points: 15, weapon: { loc: 'lances', kind: 'lance', range: 30, str: 1, arc: 'all' }, turrets: 1 },
  manufacturing: { name: 'Manufacturing and research', points: 10, shields: 1 },
  habitat: { name: 'Habitat', points: 5, hits: 1 },
}
export function isosOrbital (modules = []) {
  const core = DEFENCES.find(d => d.id === 'isos-orbital-core')
  if (modules.length > 4 || modules.some(m => !ORBITAL_MODULES[m])) return null
  const p = { ...core, armour: { ...core.armour }, weapons: [...core.weapons] }
  for (const m of modules) {
    const d = ORBITAL_MODULES[m]
    p.points += d.points; p.turrets += d.turrets ?? 0; p.hits += d.hits ?? 0
    if (d.shields) { p.shields = Math.min(3, p.shields + d.shields); p.tracking = 10 }
    if (d.weapon) { p.weapons.push({ ...d.weapon }); if (m === 'bays') p.craft = ['fighter', 'bomber'] }
    if (d.hooks) p.hooks = { capacity: (p.hooks?.capacity ?? 0) + d.hooks, takes: ['tether', 'warden'] }
  }
  p.name = modules.length ? `Isos Orbital (core + ${modules.length} module${modules.length > 1 ? 's' : ''})` : core.name
  return p
}
