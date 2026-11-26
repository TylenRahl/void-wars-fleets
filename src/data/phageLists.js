// The Phage fleet lists (Mound Fleet List and Vanguard Fleet List). Exports PHAGE_OPTIONS (the builder's slot selects), ORDNANCE_PRICES,
// ordnanceCost, PHAGE_LISTS and phagePicks, which data/fleetLists.js merges with the other fleets' tables.
// Weapon choices are the slots of data/phageShips.js (a ship's id carries them); this file has the lists, the upgrades and the limits.
// There is no fleet commander: the Hunger Influence re-rolls and Imperatives are upgrades on queen ships.
import { PHAGE_CLASSES, slotsOf, phageSplit } from './phageShips.js'

export const PHAGE_OPTIONS = Object.fromEntries(Object.keys(PHAGE_CLASSES).map(cls => [cls, {
  codec: 'phage',
  // the builder's selects: one per slot; `min` slots always have a choice, port/starboard sets may be "none"
  options: slotsOf(cls).map(s => ({ slot: s.slot, label: s.label, choices: s.choices.map(c => ({ name: c.name, points: c.points, suffix: '' })) })),
}]))

const HIVE_TAGS = { 'pha-hive': ['hive', 'capital', 'battleship'], 'pha-cruiser': ['cruiser', 'capital'], 'pha-gulper': ['gulper', 'escort'], 'pha-vanguard': ['vanguard', 'escort'], 'pha-drone': ['drone', 'escort'] }
const VANGUARD_TAGS = { 'pha-gulper': ['gulper', 'escort'], 'pha-vanguard': ['vanguard', 'escort'] }

// With at least one queen ship, a fleet may spend up to 10% of its points on ordnance markers: Strength 4 boarding torpedo marker 12, assault boat marker 8, fighter marker 7
export const ORDNANCE_PRICES = { tb: 12, boat: 8, fighter: 7 }
export const ordnanceCost = list => Object.entries(ORDNANCE_PRICES).reduce((a, [k, p]) => a + p * Math.max(0, +(list.ordnance?.[k] ?? 0) || 0), 0)

const isFire = e => !!e.p?.fireShip
const hives = ctx => ctx.n('hive')

// Evolution of the Hunger. Campaign refits, which one-off games use only by agreement: offered here as ordinary extras, with their usual limits.
// `kind` groups the ones that may be taken more than once (brood cysts, carapace) as one kind for the "different refits" limit.
const REF = (id, name, points, on, text, more = {}) => ({ id, name, points, on, text, refit: true, ...more })
const notEscort = e => e.capital
const UPS = [
  { id: 'ld9', name: 'Resolve 9', points: 40, on: 'hive', set: { ld: 9 }, text: 'a queen ship of Resolve 9 instead of 8' },
  { id: 'influence', name: 'Hunger Influence re-roll', points: 30, on: 'hive', text: 'a fleet re-roll for Command checks and Resolve Tests; at most one per queen ship' },
  { id: 'imperative', name: 'Hunger Imperative', points: 40, on: 'hive', text: 'a Command check or Resolve Test passed automatically, chosen before the dice; one per two queen ships (one if there is a queen ship)' },
  REF('solar', 'Solar Vanes', 15, () => true, '+5 cm speed'),
  REF('adrenaline', 'Adrenaline Sacs', 10, () => true, '+1D6 on All Ahead Full'),
  REF('scream', 'Mind Scream', 20, 'hive', 'enemies within 15 cm are -2 Resolve', { }),
  REF('vents', 'More Discharge Vents', 15, notEscort, 'distance before turning reduced by 5 cm'),
  REF('spore', 'Extra Brood Cyst', 10, e => e.cls !== 'pha-gulper', '+1 brood cyst (a second can be taken)', { add: { spores: 1 }, kind: 'spore' }),
  REF('spore2', 'Second Extra Brood Cyst', 10, e => e.cls !== 'pha-gulper', '+1 more brood cyst', { add: { spores: 1 }, kind: 'spore', needs: 'spore' }),
  ...[1, 2, 3, 4].map(n => REF('carapace' + n, n === 1 ? 'Reinforced Carapace' : `Reinforced Carapace ${n}`, 10, e => e.cls === 'pha-hive' || (e.cls === 'pha-cruiser' && n <= 3), '+1 hit (queen ship up to four, cruiser up to three)', { add: { hits: 1 }, kind: 'carapace', needs: n > 1 ? 'carapace' + (n - 1) : undefined })),
  REF('mucous', 'Mucous Membrane', 20, () => true, 'bombers and assault boats -1 on their attack roll; torpedoes need +1 to hit, at most 6+'),
  REF('healing', 'Accelerated Healing', 10, notEscort, '+2 repair dice, added after halving'),
  REF('drone-link', 'Drone Link', 20, () => true, 'within 15 cm of a Vanguard, burning acid batteries get a left shift on the Gunnery table'),
  REF('tenacity', 'Tenacity', 20, () => true, 'burning acid and searbile unaffected by All Ahead Full, Burn Retros, Come to New Heading'),
  REF('mines', 'Great Spore Mines', 0, e => e.capital && e.bays > 0, 'all launch bays launch great spore mines instead of craft', { perBay: 10, needs: 'bays' }),
]
const KIND = id => UPS.find(u => u.id === id)?.kind ?? id
const refitIds = new Set(UPS.filter(u => u.refit).map(u => u.id))

const refitLimits = {
  check: ctx => {
    const why = []
    for (const e of ctx.ents) {
      const kinds = new Set(e.ups.filter(id => refitIds.has(id)).map(KIND)), max = e.cls === 'pha-hive' ? 3 : e.cls === 'pha-cruiser' ? 2 : 1
      if (kinds.size > max) why.push(`${e.p?.name ?? e.id} has ${kinds.size} different refits, at most ${max}`)
      if (e.ups.includes('spore2') && !e.ups.includes('spore')) why.push('the second extra brood cyst needs the first')
      for (let n = 2; n <= 4; n++) if (e.ups.includes('carapace' + n) && !e.ups.includes('carapace' + (n - 1))) why.push('reinforced carapaces are taken in order')
    }
    return why
  },
}
const fireLimit = { check: ctx => { const d = ctx.n('drone'), f = ctx.ents.filter(isFire).length; return f > Math.floor(d / 10) ? [`up to 10% of the picket drones may be fire ships: ${f} of ${d}`] : [] } }
const noCapitalSquadrons = { check: ctx => (ctx.list.capitalSquadrons ?? []).length ? ['queen ships and cruisers are individuals and may not deploy in squadrons'] : [] }
const sqSize = (min, max, page) => ({ check: ctx => {
  const why = [], inSq = new Set((ctx.list.escortSquadrons ?? []).flat())
  for (const q of ctx.list.escortSquadrons ?? []) if (q.length < min || q.length > max) why.push(`escort squadrons are ${min} to ${max} ships, not ${q.length}`)
  if (ctx.ents.some(e => !e.capital && !inSq.has(e.i))) why.push(`every escort goes in a squadron of ${min} to ${max}`)
  return why
} })

export const PHAGE_LISTS = {
  lists: [
    { id: 'hive', name: 'Mound Fleet', ships: HIVE_TAGS, upgrades: UPS, squadrons: true, attackRating: () => 3, ordnanceShare: 0.1,
      limits: [
        { of: 'cruiser', max: ctx => 2 * hives(ctx), text: 'up to two cruisers for each queen ship' },
        // 6-12 escorts per queen ship; with none, only Gulper and Forerunner drones. At least six drones per queen ship, which may come on top of the 6-12.
        { check: ctx => {
          const H = hives(ctx), esc = ctx.n('escort'), drones = ctx.n('drone'), why = []
          if (H === 0 && drones) why.push('a fleet without queen ships may take only Gulper and Forerunner drones')
          if (H > 0) {
            if (drones < 6 * H) why.push(`at least six picket drones for every queen ship: ${drones} for ${H}`)
            if (esc - drones > 12 * H) why.push(`at most 12 escorts for each queen ship besides the drones: ${esc - drones} for ${H}`)
            if (esc < 6 * H) why.push(`at least 6 escorts for each queen ship`)
          }
          return why
        } },
        { of: 'influence', byUpgrade: true, max: ctx => hives(ctx), text: 'one Hunger Influence re-roll per queen ship' },
        { of: 'imperative', byUpgrade: true, max: ctx => hives(ctx) ? Math.max(1, Math.floor(hives(ctx) / 2)) : 0, text: 'one Hunger Imperative per two queen ships (one with any queen ship)' },
        { check: ctx => { const c = ordnanceCost(ctx.list); return c && !hives(ctx) ? ['ordnance markers need at least one queen ship'] : c > ctx.points * 0.1 + 1e-6 ? [`ordnance markers cost ${c}, more than 10% of the fleet's points`] : [] } },
        fireLimit, refitLimits, noCapitalSquadrons, sqSize(1, 12, ''),
      ],
      extraPoints: ordnanceCost, onApply: 'phage' },
    { id: 'vanguard', name: 'Vanguard Fleet', ships: VANGUARD_TAGS, upgrades: UPS.filter(u => refitIds.has(u.id) && !['scream', 'vents'].includes(u.id)), squadrons: true, attackRating: () => 3,
      limits: [refitLimits, noCapitalSquadrons, sqSize(6, 12, '')], onApply: 'phage' },
  ],
}
export const phagePicks = phageSplit
