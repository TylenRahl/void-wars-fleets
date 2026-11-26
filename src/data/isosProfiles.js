// The Isos stat lines. Exports ISOS_PROFILES, which data/fleets.js lays over the drawn ships in concordShips.js ISOS_FLEET (a drawn gun names its
// weapon by position, so weapon order matters there). This file adds everything the drawings left at defaults: speed, turns, shields, armour,
// turrets and the Isos systems. The first argument of P is a reference number that fleets.js drops; it has no game effect.
// hooks gravitic hooks: capacity and what they take. They have no game effect in play; the builder uses them (rules/isosFleet.js)
// deflector armour.front already holds the value with the deflector working; it falls back to armour.other while the prow armament is damaged
// tracking Tracking Systems range in cm: 10, the Lattice 20
// halfBoarding Sky Flock vessels' and defences' boarding value is halved
// craft the kinds of craft its bays may launch (default: both)
const A = (front, other = front, rear) => ({ front, other, ...(rear ? { rear } : {}) })
const P = (page, hits, speed, turns, shields, armour, turrets, more = {}) => ({ page, hits, speed, turns, shields, armour, turrets, ...more })
const KV = { halfBoarding: true }   // Sky Flock
export const ISOS_PROFILES = {
  'isos-explorer': P(458, 12, 15, 45, 1, A(5, 5, 4), 5, { ...KV, hooks: { capacity: 3, takes: ['tether', 'warden'] } }),
  'isos-explorer-spire': P(458, 12, 15, 45, 1, A(5, 5, 4), 5, { ...KV, hooks: { capacity: 3, takes: ['tether', 'warden'] } }),
  'isos-hero': P(460, 8, 20, 45, 2, A(6, 5), 3, { ...KV, deflector: true }),
  'isos-hero-prism': P(460, 8, 20, 45, 2, A(6, 5), 3, { ...KV, deflector: true }),
  'isos-merchant': P(462, 4, 15, 45, 1, A(5), 2, { ...KV, hooks: { capacity: 2, takes: ['tether', 'warden'] } }),
  'isos-merchant-hearth': P(462, 4, 15, 45, 1, A(5), 2, KV),
  'isos-defender': P(464, 1, 20, 45, 1, A(5), 2, KV),
  'isos-messenger': P(465, 1, 25, 90, 1, A(5), 2, { ...KV, tracking: 10, soloEscort: true }),   // Not always deployed in squadrons
  'isos-tether': P(466, 1, 20, 90, 1, A(5), 1, { ...KV, hooked: 'tether', soloEscort: true }),   // Each parent's Tethers fight as a squadron, so one may stand alone
  'isos-lattice': P(468, 10, 20, 45, 3, A(6, 5), 4, { deflector: true, tracking: 20, hooks: { capacity: 3, takes: ['warden'] },
    special: ['No Come To New Heading orders for a Lattice.'] }),
  'isos-protector': P(470, 6, 20, 90, 2, A(6, 5), 3, { deflector: true }),
  'isos-protector-ember': P(470, 6, 20, 90, 2, A(6, 5), 3, { deflector: true }),
  // The Hearth Emissary's bays list Vertexs only (no Delta line), so they launch Vertexs only
  'isos-emissary-hearth': P(472, 4, 20, 90, 1, A(5), 2, { hooks: { capacity: 2, takes: ['warden'] }, craft: ['fighter'] }),
  'isos-emissary-spire': P(472, 4, 20, 90, 1, A(5), 2, { hooks: { capacity: 2, takes: ['warden'] } }),
  'isos-emissary-nexus': P(473, 4, 20, 90, 1, A(5), 2),   // this configuration has no hooks
  'isos-facet': P(474, 1, 25, 90, 1, A(5), 2),
  'isos-warden': P(475, 1, 25, 90, 1, A(5), 1, { hooked: 'warden', soloEscort: true }),   // An independent squadron in all respects
  'isos-transport': P(476, 1, 20, 45, 1, A(5), 1, { special: ['-1 modifier when determining base leadership; a full transport, two assault points.'] }),
}
