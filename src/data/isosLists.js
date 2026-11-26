// The Isos fleet lists: Sky Flock (Merchant Fleet) and Flock Guard (Commerce Protection Fleet). Exports ISOS_CLASSES and ISOS_LISTS, which
// data/fleetLists.js merges with the other fleets' tables. Allies, subjects and mercenaries are left out.
// Every configuration of a class is its own ship id (a Hero in the Outring or the Prism configuration are two entries in the picker), so the "weapon choice" is
// the choice of ship; nothing here needs a drawing swap.
import { shipById } from './ships.js'

const ps = id => shipById(id)?.points ?? 0
// tags: the class names; 'escort' / 'capital' come from the ship itself
const T = (...tags) => tags
const KVATTRA = {
  'isos-explorer': T('explorer', 'battleship'), 'isos-explorer-spire': T('explorer', 'battleship'),
  'isos-hero': T('hero', 'cruiser', 'outring'), 'isos-hero-prism': T('hero', 'cruiser'),
  'isos-merchant': T('merchant', 'cruiser'), 'isos-merchant-hearth': T('merchant', 'cruiser'),
  'isos-messenger': T('messenger', 'escort'), 'isos-defender': T('defender', 'escort'), 'isos-warden': T('warden', 'escort', 'hooked'), 'isos-tether': T('tether', 'escort', 'hooked'),
}
const KVESH = {
  ...KVATTRA,
  'isos-lattice': T('lattice', 'battleship'),
  'isos-protector': T('protector', 'prism', 'cruiser'), 'isos-protector-ember': T('protector', 'ember', 'cruiser'),
  'isos-emissary-hearth': T('emissary', 'cruiser'), 'isos-emissary-spire': T('emissary', 'cruiser'), 'isos-emissary-nexus': T('emissary', 'cruiser'),
  'isos-facet': T('facet', 'escort'),
}

// ---- gravitic hooks: capacity limits Tethers and Wardens ----
const hookCap = (ctx, kind) => ctx.ents.reduce((a, e) => a + (e.p?.hooks?.takes.includes(kind) ? e.p.hooks.capacity : 0), 0)
const hookLimit = {
  check: ctx => {
    const tethers = ctx.n('tether'), wardens = ctx.n('warden'), why = []
    if (tethers > hookCap(ctx, 'tether')) why.push(`${tethers} Tethers but the fleet's gravitic hooks carry only ${hookCap(ctx, 'tether')}: Explorers and Waygate Merchants (the Lattice's and Emissaries' hooks are for Wardens only)`)
    if (tethers + wardens > hookCap(ctx, 'warden')) why.push(`${tethers + wardens} Tethers and Wardens but the fleet's gravitic hooks carry only ${hookCap(ctx, 'warden')}`)
    // Each escort may be assigned its parent (list.hooks = { escort index: carrier index }); a ship with Wardens carries only Wardens
    const hooks = ctx.list.hooks ?? {}, load = new Map()
    for (const [ei, ci] of Object.entries(hooks)) {
      const e = ctx.ents[+ei], c = ctx.ents[+ci], kind = e?.p?.hooked
      if (!kind) { why.push('only Tethers and Wardens hang on gravitic hooks'); continue }
      if (!c?.p?.hooks?.takes.includes(kind)) { why.push(`${c?.p?.name ?? 'that ship'} has no gravitic hook for a ${kind === 'tether' ? 'Tether' : 'Warden'}`); continue }
      load.set(+ci, [...(load.get(+ci) ?? []), kind])
    }
    for (const [ci, kinds] of load) {
      const c = ctx.ents[ci]
      if (kinds.length > c.p.hooks.capacity) why.push(`${c.p.name} has only ${c.p.hooks.capacity} gravitic hook${c.p.hooks.capacity > 1 ? 's' : ''}`)
      if (kinds.includes('warden') && kinds.some(k => k !== 'warden')) why.push(`${c.p.name} carries Wardens, so it may carry only Wardens`)
    }
    return why
  },
}
// ---- squadrons ----
const squadronRules = {
  check: ctx => {
    const why = []
    for (const q of ctx.list.escortSquadrons ?? []) {
      const tags = q.map(i => ctx.ents[i]?.tags ?? [])
      const has = t => tags.some(x => x.includes(t)), all = t => tags.every(x => x.includes(t))
      if (has('tether') && !all('tether')) why.push('Tethers can only squadron with other Tethers')
      if (has('defender') && has('tether')) why.push('Defenders may not be combined with Tethers')
      if (has('warden') && tags.some(x => !x.includes('warden') && !x.includes('facet'))) why.push('Wardens may squadron only with Facets and other Wardens')
      if (has('facet') && has('tether')) why.push('Facets may not squadron with Tethers')
    }
    return why
  },
}
// Up to one Messenger per 500 points (read as per FULL 500)
const messengerLimit = { of: 'messenger', max: ctx => Math.floor(ctx.points / 500), text: 'up to one Messenger per 500 points' }

export const ISOS_CLASSES = {}   // no class needs weapon options or per-class flags: each configuration is its own ship id

// Merchants of either configuration may buy 6 hits for +15: an Emissary may buy a deflector for +10: Improved Logic Engines +10 on Mesme's ship
const hull = { id: 'hull', name: 'Superior hull structure (6 hits)', points: 15, on: { cls: ['isos-merchant', 'isos-merchant-hearth'] }, set: { hits: 6 }, text: 'hits 4 to 6' }
const deflector = { id: 'deflector', name: 'Deflector', points: 10, on: { cls: ['isos-emissary-hearth', 'isos-emissary-spire', 'isos-emissary-nexus'] }, set: { deflector: true, 'armour.front': 6 }, text: 'prow armour 6+, disabled by a prow critical hit' }
const ile = { id: 'ile', name: 'Improved Logic Engines', points: 10, on: { cls: ['isos-lattice'] }, text: 'no Resolve effect from Blast Markers touching' }

const cmd = (id, name, ld, points, prices, more = {}) => ({ id, name, mode: 'set', ld, points, free: 1, prices, ...more })
// One re-roll included; a passenger dignitary may be carried for more re-rolls: one extra +25, two extra +75
const SECONDHELM = cmd('secondhelm', "Isos Second Helm", 8, 50, [0, 25, 75])
const FIRSTHELM = cmd('firsthelm', "Isos First Helm", 9, 80, [0, 25, 75])
// High Helm, Ld 9, 2 re-rolls, always with a dignitary aboard (so none bought), aboard the Lattice; his flagship's attack craft have Excellent Pilots
const MESME = cmd('mesme', "High Helm", 9, 110, [0], { free: 2, includes: ['excellent'],
  defaultOn: ents => ents.findIndex(e => e.cls === 'isos-lattice'),
  check: ctx => ctx.ents[ctx.cmdOn]?.cls === 'isos-lattice' ? [] : ["High Helm is embarked aboard a Lattice"] })

const common = [hookLimit, squadronRules, messengerLimit,
  { check: ctx => ctx.upCount('ile') && ctx.cmd?.id !== 'mesme' ? ["Improved Logic Engines are for High Helm's ship"] : ctx.ents.some(e => e.ups.includes('ile') && e.i !== ctx.cmdOn) ? ["Improved Logic Engines go on High Helm's own ship"] : [] }]
const attackRating = () => 2   // Isos attack rating

export const ISOS_LISTS = {
  lists: [
    { id: 'commerce', name: "Flock Guard, Commerce Protection Fleet", ships: KVESH,
      commanders: { requiredOver: 750, label: 'Fleet commander', options: [SECONDHELM, FIRSTHELM, MESME] },
      upgrades: [hull, deflector, ile], attackRating,
      limits: [...common,
        // Up to one Lattice per FULL 750 points of Isos vessels; a First Helm must lead a fleet with a Lattice
        { of: 'lattice', max: ctx => Math.floor(ctx.ents.reduce((a, e) => a + ps(e.id), 0) / 750), text: 'one Lattice per full 750 points of Isos vessels' },
        { check: ctx => ctx.n('lattice') && !['firsthelm', 'mesme'].includes(ctx.cmd?.id) ? ["a fleet with a Lattice is led by a First Helm"] : [] },
        // Up to one Hero for every other type of capital ship
        { of: 'hero', max: ctx => ctx.n(e => e.capital && !e.tags.includes('hero')), text: 'one Hero for every other capital ship' },
        // Prism Protectors must outnumber Ember ones
        { check: ctx => ctx.n('protector') && ctx.n('prism') <= ctx.n('ember') ? ["Prism Protectors must outnumber Ember ones"] : [] }] },
    { id: 'merchant', name: "Sky Flock, Merchant Fleet", ships: KVATTRA,
      commanders: { requiredOver: 750, label: 'Fleet commander', options: [SECONDHELM, FIRSTHELM] },
      upgrades: [hull], attackRating,
      limits: [...common,
        // Over 750 points the fleet must include at least one Explorer; up to one Hero for every Merchant or Explorer
        { check: ctx => ctx.points > 750 && !ctx.n('explorer') ? ['a fleet worth more than 750 points includes at least one Explorer'] : [] },
        { of: 'hero', max: ctx => ctx.n('merchant') + ctx.n('explorer'), text: 'one Hero for every Merchant or Explorer' }] },
  ],
}
