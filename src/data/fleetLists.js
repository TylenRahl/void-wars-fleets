// Fleet lists as data for every fleet except the Freemen and Dominion. Exports CLASSES (per-class choices), FLEET_LISTS, and helpers such as
// hasLists, listsOf, listDef, resolveShipId and splitShipId. One table per fleet says which lists it has, which ships each list takes, who
// may command, what a ship may carry, which weapon it chooses, and the limits. rules/listCheck.js reads it for checkFleet, fleetPoints and
// createFleetBattle; battle.js reads it for the fleet builder; data/listForm.js and data/fleets.js use the id helpers. The Freemen's and
// Dominion's lists are coded in rules/fleet.js (COMMANDERS, MARKS, Lords).
//
// SHAPE (add a fleet by adding a key to FLEET_LISTS and its classes to CLASSES):
// CLASSES[fleet][classId] what one ship class lets its player choose, whichever list it is in:
// options: [{ slot, label, choices: [{ name, points, suffix, swap }] }]
// A weapon choice (for example, one prow weapon from a set). `suffix` names the ship drawn for that choice: the chosen suffixes, in slot order,
// added to the class id give the ship id (ath-wyrmship + '-lance' + '-torpedo'), so the picture already drawn in concordShips.js is reused and the
// mounts match. `swap: [{ at, w }]` is for a fleet whose choices have no drawing of their own: it replaces weapon number `at` of the profile
// with `w` merged over it, same list position, so a drawn mount stays valid (rules/listCheck.js applyPicks).
// rules: { noBoard, boardedPlus, harPlus, ... } flags the engine reads off the ship (data/fleets.js puts them on the profile).
// builtIn: upgrade ids the class always has (the Flame of Helion's Discipline Warrior crew).
// FLEET_LISTS[fleet].lists[] one entry per fleet list:
// id, name, page, ships: { classId: [tags] } (a class with the tag 'reserve' is a reserve ship: needs a commander with `hero`)
// commanders: { requiredOver, options: [{ id, name, mode: 'set' | 'plus', ld | plus + cap, points | fn(ctx), free, prices: [extra re-rolls' cumulative cost],
// hero, includes: [upgrade ids], on: selector, check(ctx) }] }
// upgrades: [{ id, name, points | perBay, on: selector, needs, excludes, noWeapon, notOn, max, page, text }] per-ship extras (Huntseers, Discipline hosts, Soulship)
// limits: [{ of: selector, max | min | per: { of: selector, n } | perPoints, text, page }] or { check(ctx) -> [reasons] } for the odd ones
// attackRating(ctx)
// A selector is a tag ('cruiser'), 'capital' or 'escort', an array of tags that must all match, { cls: [ids] }, or a function of the ship entry.
// ctx (rules/listCheck.js context): { list, def, ents[{ i, id, cls, tags, role, capital, ups[] }], n(sel), cmd, cmdOn, points, upCount(id) }.

/** Weapon choices and per-ship rules by class. */
import { ISOS_CLASSES, ISOS_LISTS } from './isosLists.js'
import { PHAGE_OPTIONS, PHAGE_LISTS } from './phageLists.js'
import { RUKKA_CLASSES, RUKKA_LISTS } from './rukkaLists.js'
import { phageJoin, phageSplit } from './phageShips.js'
import { THNITOI_CLASSES, THNITOI_LISTS } from './thnitoiLists.js'

export const CLASSES = {
  thnitoi: THNITOI_CLASSES,
  isos: ISOS_CLASSES,
  rukka: RUKKA_CLASSES,
  phage: PHAGE_OPTIONS,   // weapon slots; the ship id carries the choices (data/phageShips.js codec)
  katharos: {
    // One cryptship per fleet may add an Ossuary for +50 points. The Barrow with an Ossuary is drawn as its own ship (kat-barrow-ossuary, 550
    // points with the +50 in it), so the choice is a suffix and costs nothing on top of that profile.
    'kat-barrow': { options: [{ slot: 'ossuary', label: 'Ossuary (+50 points, one cryptship in the fleet)', choices: [{ name: 'no Ossuary', points: 0, suffix: '' }, { name: 'Ossuary (+50, in the ship\'s cost)', points: 0, suffix: '-ossuary' }] }] },
  },
  athanatoi: {
    // Each Wyrmship picks one prow weapon and one keel weapon, both included in its points
    'ath-wyrmship': {
      options: [
        { slot: 'prow', label: 'Prow weapon', choices: [{ name: 'weapons battery', points: 0, suffix: '' }, { name: 'starlance', points: 0, suffix: '-lance' }] },
        { slot: 'keel', label: 'Keel weapon', choices: [{ name: 'launch bays', points: 0, suffix: '', weapon: 'bays' }, { name: 'torpedoes', points: 0, suffix: '-torpedo' }] }],
    },
    // The same two choices for a Stillship
    'ath-stillship': {
      options: [
        { slot: 'prow', label: 'Prow weapon', choices: [{ name: 'weapons battery', points: 0, suffix: '' }, { name: 'starlance', points: 0, suffix: '-lance' }] },
        { slot: 'keel', label: 'Keel weapon', choices: [{ name: 'launch bays', points: 0, suffix: '', weapon: 'bays' }, { name: 'torpedoes', points: 0, suffix: '-torpedo' }] }],
    },
    // Each Duskhunter picks one prow weapon; a squadron may mix them
    'ath-duskhunter': {
      options: [{ slot: 'prow', label: 'Prow weapon', choices: [{ name: 'weapons battery', points: 0, suffix: '' }, { name: 'shadow lance', points: 0, suffix: '-lance' }] }],
      rules: { noBoard: 'Duskhunters cannot initiate boarding actions', boardedPlus: 'a ship that boards a Duskhunter gains +1', harPlus: 'Hit-and-Run attacks against a Duskhunter add +1', craftReroll: 'a Duskhunter re-rolls a failed mirage field save against attack craft in base contact' },
    },
    'ath-kalyx': { rules: { noBoard: 'A Kalyx cannot initiate boarding actions', boardedPlus: 'a ship that boards a Kalyx gains +1' } },
    // The Flame of Helion always carries Ilarion's own warband, which counts as a Discipline Warrior crew
    'ath-flame': { builtIn: ['discipline'] },
  },
  concord: {
    // Lance cruiser options. Free: launch bays become strength-6, 30 cm torpedo tubes (normal or boarding torpedoes), or a firepower-5,
    // 30 cm, front-arc bombardment cannon battery. +20 points: the prow bombardment cannon becomes a strength-1, 30 cm lance (left/front/right).
    // The drawn mounts follow the weapon's position, so the choices swap weapon 2 (the bays) and weapon 3 (the prow cannon) in place.
    'con-lance-cruiser': {
      options: [
        { slot: 'bays', label: 'Launch bays', choices: [{ name: 'launch bays', points: 0, suffix: '' },
          { name: 'torpedo tubes', points: 0, suffix: '', swap: [{ at: 2, w: { kind: 'torpedo', range: 30, str: 6, arc: ['front'] } }] },
          { name: 'bombardment cannon battery', points: 0, suffix: '', swap: [{ at: 2, w: { kind: 'bombardment', range: 30, str: 5, arc: ['front'] } }] }] },
        { slot: 'prow', label: 'Prow weapon', choices: [{ name: 'bombardment cannon', points: 0, suffix: '' },
          { name: 'lance', points: 20, suffix: '', swap: [{ at: 3, w: { kind: 'lance', range: 30, str: 1, arc: ['left', 'front', 'right'] } }] }] }],
    },
  },
}

// ---------------- the upgrades the Athanatoi's lists offer ----------------
const AT = 'athanatoi'
const UP = {
  // Free, any capital ship; not combined with a Huntseer or a Discipline Warrior crew; no launch bays
  soulship: { id: 'soulship', name: 'Soulship', points: 0, on: 'capital', excludes: ['huntseer', 'discipline', 'vampires', 'tbombers', 'mines'], noWeapon: 'bays', notOn: ['ath-flame'],
    text: 'critical hits only on a 6; Command check failures keep it to moving; no Disciplines, launch bays, boarding or Hit-and-Run; enemies boarding +1, Hit-and-Run against it +1; half repair dice' },
  // 0-3 Huntseers, +30 each, on a capital ship (the flagship if wished); one re-roll for itself, a capital ship in its squadron or an escort squadron within 15 cm
  huntseer: { id: 'huntseer', name: 'Huntseer', points: 30, on: 'capital', excludes: ['soulship'], fleetMax: 3, text: 'a re-roll for this ship, a capital ship in its squadron, or an escort squadron within 15 cm' },
  // +20 on any capital ship; +2 on a boarding roll, +1 on a Hit-and-Run roll
  discipline: { id: 'discipline', name: 'Discipline Host', points: 20, on: 'capital', excludes: ['soulship'], builtInCls: ['ath-flame'], text: '+2 in a boarding action, +1 on a Hit-and-Run roll' },
  // A Wyrmship with launch bays may add Lamia raiders, +10 points
  vampires: { id: 'vampires', name: 'Lamia raiders', points: 10, on: { cls: ['ath-wyrmship'] }, needs: 'bays', text: 'the bays may launch Lamia raiders (assault boats)' },
  // Torpedo bombers: +15 points per launch bay
  // Any cruiser with launch bays may carry orbital mines instead of attack craft, +5 points per bay strength
  mines: { id: 'mines', name: 'Orbital mines', perBay: 5, on: e => e.capital && e.role === 'cruiser', needs: 'bays', excludes: ['tbombers', 'vampires'], text: 'the bays launch orbital mines instead of attack craft' },
  tbombers: { id: 'tbombers', name: 'Torpedo bombers', perBay: 15, on: 'capital', needs: 'bays', text: 'the carrier may also launch torpedo bombers' },
}

// ---------------- reserve and ratio rules the Athanatoi share ----------------
const heroGate = {
  // Reserves from the other Athanatoi list need an Athanatoi Strategos (Ilarion stands in for the Hero)
  check: ctx => ctx.ents.some(e => e.tags.includes('reserve')) && !ctx.cmd?.hero ? ['reserve ships from the other Athanatoi list need an Athanatoi Strategos (or Prince Ilarion) to lead the fleet'] : [],
}
// A fleet with the Flame of Helion must be led by an Athanatoi Strategos, who must be aboard the Flame
const flameHero = {
  check: ctx => {
    const flame = ctx.ents.find(e => e.cls === 'ath-flame')
    if (!flame) return []
    if (!ctx.cmd?.hero) return ['the Flame of Helion needs an Athanatoi Strategos (or Prince Ilarion) to lead the fleet, aboard it']
    return ctx.cmdOn === flame.i ? [] : ['the Athanatoi Strategos (or Prince Ilarion) must be embarked aboard the Flame of Helion']
  },
}
// Skirmisher escorts and Duskhunters never share a squadron
const noMixedSquadrons = {
  check: ctx => (ctx.list.escortSquadrons ?? []).some(q => {
    const t = q.map(i => ctx.ents[i]?.tags ?? [])
    return t.some(x => x.includes('corsair')) && t.some(x => x.includes('duskhunter'))
  }) ? ['Skirmisher escorts and Duskhunters may not be in the same squadron'] : [],
}
// Ilarion goes on a Household Wyrmship with launch bays, or on the Flame, which he must be aboard if it is in the fleet
const ilarionHome = {
  check: ctx => {
    if (ctx.cmd?.id !== 'ilarion') return []
    const on = ctx.ents[ctx.cmdOn]
    const flame = ctx.ents.find(e => e.cls === 'ath-flame')
    if (!on) return ['Prince Ilarion must be assigned a ship']
    if (flame && on.cls !== 'ath-flame') return ['Prince Ilarion must be embarked aboard the Flame of Helion when it is in the fleet']
    if (on.cls !== 'ath-flame' && !(on.cls === 'ath-wyrmship' && on.bays)) return ['Prince Ilarion goes on a Wyrmship with launch bays, or on the Flame of Helion']
    return []
  },
}
const cmdUp = (id, name, ld, points, prices, more = {}) => ({ id, name, mode: 'set', ld, points, free: 0, prices, ...more })

// The Reaver Prince adds +2 to the ship's Resolve, to a maximum of 10; the Hero and Polemarch set their own
const PRINCE = { id: 'prince', name: 'Reaver Prince', mode: 'plus', plus: 2, cap: 10, points: 100, free: 0, prices: [0, 25, 50, 100] }
const HERO_CORSAIR = cmdUp('hero', 'Athanatoi Strategos', 10, 100, [0, 50, 75, 100], { hero: true })
const HERO_PENTHOS = cmdUp('hero', 'Athanatoi Strategos', 10, 100, [0, 50, 75, 100], { hero: true })
// Ilarion costs 150, or 125 aboard the Flame; one re-roll included, a second and third +25 each; his Resolve is not given, so Ld 10, the Hero he stands in for
const ILARION = { id: 'ilarion', name: 'Prince Ilarion', mode: 'set', ld: 10, points: ctx => (ctx.ents[ctx.cmdOn]?.cls === 'ath-flame' ? 125 : 150), pointsText: '150, or 125 aboard the Flame', free: 1, prices: [0, 25, 50], hero: true, includes: ['discipline', 'vampires'], attackRating: 4 }
const POLEMARCH = cmdUp('polemarch', 'Athanatoi Polemarch', 9, 75, [0, 25], { page: '' })
const BEARER = cmdUp('bearer', 'Penthos Bearer of the Flame', 10, 100, [0, 25], { page: '' })

const corsairShips = {
  'ath-selene': ['cruiser', 'corsair', 'capital'], 'ath-veil': ['cruiser', 'corsair', 'capital'],
  'ath-asphodel': ['escort', 'corsair'], 'ath-oleander': ['escort', 'corsair'], 'ath-kalyx': ['escort', 'corsair'], 'ath-foxglove': ['escort', 'corsair'],
  // reserves from the Household list: one Flame, Wyrmship or Stillship per three cruisers; Duskhunters one per three escorts
  'ath-flame': ['reserve', 'household', 'dragon', 'capital'], 'ath-wyrmship': ['reserve', 'household', 'dragon', 'capital'], 'ath-stillship': ['reserve', 'household', 'wraith', 'capital'],
  'ath-duskhunter': ['reserve', 'household', 'escort', 'duskhunter'],
}
const exemptFlame = ctx => ctx.cmd?.id === 'ilarion' && ctx.ents[ctx.cmdOn]?.cls === 'ath-flame'   // The Flame with Ilarion is exempt from the reserve rules
const corsairLimits = [
  { of: ['corsair', 'cruiser'], max: 12, text: '0-12 cruisers' },
  { of: ['reserve', 'capital'], max: ctx => Math.floor(ctx.n(['corsair', 'cruiser']) / 3) + (exemptFlame(ctx) ? 1 : 0), text: 'Household Flame, Wyrmships and Stillships are taken one for every three cruisers' },
  { of: 'duskhunter', max: ctx => Math.floor(ctx.n(['corsair', 'escort']) / 3), text: 'Duskhunters are taken one for every three escorts' },
  heroGate, flameHero, noMixedSquadrons, ilarionHome,
]
const corsairCmd = (heroish = []) => ({ requiredOver: 750, label: 'Fleet commander', options: [PRINCE, HERO_CORSAIR, ILARION, ...heroish] })
const UPS_CORSAIR = [UP.tbombers, UP.vampires, UP.mines]

// 4 for a Corsair fleet with no Household vessels, 3 for any fleet with Household vessels, Ilarion's fleet 4
const athanatoiRating = ctx => ctx.cmd?.attackRating ?? (ctx.ents.some(e => e.tags.includes('household') || e.tags.includes('penthos')) ? 3 : 4)

// ---------------- the Concord's lists ----------------
const MASTER = { id: 'master', name: 'Fleet Prime', mode: 'set', ld: 10, points: 50, free: 0, prices: [0, 25, 50, 75] }
const isBarge = e => e.tags.includes('barge')
const CUP = {
  // The Fleet Prime's ship may carry a Deepflesh boarding party, +50
  deepflesh: { id: 'deepflesh', name: 'Deepflesh boarding party', points: 50, on: 'capital', text: 'once a turn an extra teleport attack: two dice, both results apply, +1 each for Concord' },
  // Any host barge or lance cruiser in the Crusade fleet, +10 per ship
  honour: { id: 'honour', name: 'Prime Guard', points: 10, on: e => e.tags.includes('barge') || e.tags.includes('cruiser'), text: 'once a turn an extra teleport attack: roll two dice and use either, +1 for Concord' },
  // Any lance cruiser: one more shield for +15
  // The hostkeep's re-rolls, for its own Command checks (added to the Master's, for the whole fleet, if he is aboard)
  fr1: { id: 'fr1', name: 'One fortress re-roll', points: 25, on: { cls: ['con-hostkeep'] }, excludes: ['fr2', 'fr3'], text: 'one re-roll for the fort' },
  fr2: { id: 'fr2', name: 'Two fortress re-rolls', points: 50, on: { cls: ['con-hostkeep'] }, excludes: ['fr1', 'fr3'], text: 'two re-rolls for the fort' },
  fr3: { id: 'fr3', name: 'Three fortress re-rolls', points: 75, on: { cls: ['con-hostkeep'] }, excludes: ['fr1', 'fr2'], text: 'three re-rolls for the fort' },
  shield: { id: 'shield', name: 'Additional shield', points: 15, shields: 1, on: { cls: ['con-lance-cruiser'] }, text: 'one more shield' },
}
// Host barges: one per 1,000 points or part of 1,000, three at most. A Venerable host barge counts among them, and the fleet may have only one
const bargeLimits = (vMin) => [
  { of: 'barge', max: ctx => Math.min(3, Math.max(1, Math.ceil(ctx.points / 1000))), text: '0-3 host barges, one for every 1,000 points or part thereof' },
  { of: 'venerable', max: 1, text: 'a single Venerable host barge (it counts as one of the barges)' },
  { of: 'cruiser', max: 10, text: '0-10 cruisers' },
  ...(vMin ? [{ check: ctx => ctx.n('venerable') && ctx.points < 1000 ? ['a Venerable host barge needs a fleet of 1,000 points or more'] : [] }] : []),
  // As many basic lance cruisers as all the variants combined
  { check: ctx => {
    const sc = ctx.ents.filter(e => e.cls === 'con-lance-cruiser'), variant = sc.filter(e => (e.picks ?? []).some(p => p > 0)).length
    return variant > sc.length - variant ? [`at least as many lance cruisers must have their basic weapons as all the variants combined: ${sc.length - variant} basic, ${variant} variants`] : []
  } },
  // The Fleet Prime goes on a host barge in preference to a lance cruiser
  { check: ctx => {
    if (!ctx.cmd || ctx.n('barge') === 0) return []
    const on = ctx.ents[ctx.cmdOn]
    if (on && !isBarge(on) && !on.tags.includes('fortress')) return ['with host barges in the fleet the Fleet Prime goes on a host barge']
    return []
  } },
  // Deepflesh Dyads go on the Master's ship
  { check: ctx => ctx.upCount('deepflesh') > 1 || ctx.ents.some(e => e.ups.includes('deepflesh') && e.i !== ctx.cmdOn) ? ['a Deepflesh boarding party goes on the Fleet Prime\'s ship, one only'] : [] },
]
const CONCORD_ESCORTS = (...ids) => Object.fromEntries(ids.map(i => [i, ['escort']]))
const CONCORD_BASE = { 'con-battle-barge': ['barge', 'capital'], 'con-writ-oforder': ['barge', 'venerable', 'capital'], 'con-lance-cruiser': ['cruiser', 'capital'] }

// The Cleansing Fleet List (the Katharos' only list). No fleet commander (the fleet acts as one mind): the fleet as a whole gets one re-roll and may buy up to two more
// (one extra 25 pts, two extra 75 pts), so the list has `fleetRerolls` where other lists have `commanders` (rules/listCheck.js).
const KATHAROS_LIST = {
  id: 'harvest', name: 'Cleansing Fleet List', attackRating: () => 4,   // attack rating 4
  ships: { 'kat-barrow': ['tomb', 'capital'], 'kat-sickle': ['sickle', 'cruiser', 'capital'], 'kat-pall': ['pall', 'cruiser', 'capital'], 'kat-vigil': ['vigil', 'escort'], 'kat-knell': ['knell', 'escort'] },
  fleetRerolls: { free: 1, prices: [0, 25, 75], label: 'Fleet re-rolls' },
  limits: [
    { of: 'tomb', max: ctx => ctx.n('sickle'), text: 'up to one cryptship for every Sickle class harvest ship' },
    { of: 'sickle', max: 6, text: '0-6 Sickle class harvest ships' },
    { of: 'pall', max: 3, text: '0-3 Pall class light cruisers' },
    { of: 'vigil', max: 12, text: '0-12 Vigil class raiders' },
    { of: 'knell', max: 12, text: '0-12 Knell class raiders' },
    { check: ctx => ctx.ents.filter(e => e.id === 'kat-barrow-ossuary' || e.picks?.[0] === 1 && e.cls === 'kat-barrow').length > 1 ? ['a single cryptship may carry an Ossuary'] : [] },
  ],
}
export const FLEET_LISTS = {
  thnitoi: THNITOI_LISTS,
  isos: ISOS_LISTS,
  rukka: RUKKA_LISTS,
  phage: PHAGE_LISTS,
  katharos: { lists: [KATHAROS_LIST] },
  athanatoi: {
    lists: [
      { id: 'corsair', name: 'Athanatoi Corsairs, Rimward Reach', ships: corsairShips, commanders: corsairCmd(), upgrades: UPS_CORSAIR, limits: corsairLimits, attackRating: athanatoiRating,
        // The Rimward Reach list has no Thalassa, Eos or Helios; the Later Reach War list adds them
        note: 'Thalassa, Eos and Helios are in the Later Reach War list' },
      { id: 'corsair-lgw', name: 'Athanatoi Corsairs, Later Reach War',
        ships: { ...corsairShips, 'ath-thalassa': ['battleship', 'capital', 'stalker'], 'ath-eos': ['cruiser', 'corsair', 'capital'], 'ath-helios': ['cruiser', 'corsair', 'capital'] },
        commanders: corsairCmd(), upgrades: UPS_CORSAIR, attackRating: athanatoiRating,
        // One battleship for every full 1,000 points
        limits: [...corsairLimits, { of: 'stalker', max: ctx => Math.floor(ctx.points / 1000), text: 'one battleship for every full 1,000 points of the fleet (0-999 points: none)' }] },
      { id: 'penthos', name: 'House Penthos Fleet',
        ships: {
          'ath-flame': ['dragon', 'capital', 'penthos'], 'ath-wyrmship': ['dragon', 'capital', 'penthos'], 'ath-stillship': ['wraith', 'capital', 'penthos'], 'ath-duskhunter': ['escort', 'penthos', 'duskhunter'],
          // reserves from the Corsair list
          'ath-selene': ['reserve', 'corsair', 'cruiser', 'capital'], 'ath-veil': ['reserve', 'corsair', 'cruiser', 'capital'], 'ath-eos': ['reserve', 'corsair', 'cruiser', 'capital'], 'ath-helios': ['reserve', 'corsair', 'cruiser', 'capital'],
          'ath-asphodel': ['reserve', 'corsair', 'escort'], 'ath-oleander': ['reserve', 'corsair', 'escort'], 'ath-kalyx': ['reserve', 'corsair', 'escort'], 'ath-foxglove': ['reserve', 'corsair', 'escort'],
          'ath-thalassa': ['reserve', 'corsair', 'stalker', 'battleship', 'capital'],
        },
        commanders: { requiredOver: 750, label: 'Fleet commander', options: [POLEMARCH, BEARER, HERO_PENTHOS, ILARION] },
        upgrades: [UP.soulship, UP.huntseer, UP.discipline, UP.vampires, UP.tbombers, UP.mines], attackRating: athanatoiRating,
        limits: [
          // One Wyrmship per two Stillships; a Polemarch's flagship Wyrmship does not count. The Flame is listed with the Wyrmships, so it counts.
          { of: 'dragon', max: ctx => Math.floor(ctx.n('wraith') / 2) + (ctx.cmd?.id === 'polemarch' && ctx.ents[ctx.cmdOn]?.cls === 'ath-wyrmship' ? 1 : 0),
            text: 'one Wyrmship for every two Stillships (a Polemarch\'s own flagship Wyrmship is extra)' },
          { of: { cls: ['ath-flame'] }, max: 1, text: '(0-1) Flame of Helion' },
          // One Corsair cruiser or light cruiser per three Wyrmships and/or Stillships; escorts one per three Duskhunters; one Thalassa
          { of: ['reserve', 'cruiser'], max: ctx => Math.floor((ctx.n('dragon') + ctx.n('wraith')) / 3), text: 'Corsair cruisers and light cruisers are taken one for every three Wyrmships and/or Stillships' },
          { of: ['reserve', 'escort'], max: ctx => Math.floor(ctx.n('duskhunter') / 3), text: 'Skirmisher escorts are taken one for every three Duskhunters' },
          { check: ctx => {
            const n = ctx.n('stalker')
            if (!n) return []
            const why = []
            if (n > 1) why.push('up to one Thalassa')
            if (ctx.points < 1000) why.push('a Thalassa needs a fleet of at least 1,000 points')
            if (ctx.n(['reserve', 'cruiser']) < 3) why.push('a Thalassa needs at least three Corsair cruisers and/or light cruisers already in the fleet')
            return why
          } },
          { of: 'huntseer', max: 3, text: '0-3 Huntseers', byUpgrade: true },
          heroGate, flameHero, noMixedSquadrons, ilarionHome,
        ] },
    ],
  },
  concord: {
    lists: [
      { id: 'doctrine', name: 'Doctrine Fleet List',
        ships: { ...CONCORD_BASE, ...CONCORD_ESCORTS('con-flare', 'con-dirk', 'con-tracker', 'con-rsv-wildfire', 'con-rsv-cutlass', 'con-rsv-adder') },
        commanders: { requiredOver: 750, label: 'Fleet Prime', options: [MASTER] }, upgrades: [CUP.deepflesh, CUP.shield], limits: bargeLimits(false), attackRating: () => 3 },
      { id: 'crusade', name: 'Crusade Fleet List', annihilators: true,
        ships: { ...CONCORD_BASE, 'con-hostkeep': ['fortress', 'capital'], ...CONCORD_ESCORTS('con-flare', 'con-dirk', 'con-tracker') },
        commanders: { requiredOver: 750, label: 'Fleet Prime', options: [{ ...MASTER }] }, upgrades: [CUP.deepflesh, CUP.honour, CUP.shield, CUP.fr1, CUP.fr2, CUP.fr3],
        limits: [...bargeLimits(true), { of: 'fortress', max: 1, text: '0-1 Host Keep' },
          { check: ctx => ctx.n('fortress') && ctx.points < 2000 ? ['a fleet must be worth at least 2,000 points to include a Host Keep'] : [] }],
        // Attack rating 3, or 1 with a hostkeep
        attackRating: ctx => ctx.n('fortress') ? 1 : 3,
        note: 'The Host Keep is always the defender, in Surprise Attack, Planetary Assault or Worldbreak' },
      // The Freemen Navy, Artificers and merchant-captain reserves and the Concord Captain are left out, so the rating stays 3
      { id: 'dominion', name: 'Dominion Fleet List',
        ships: { ...CONCORD_BASE, ...CONCORD_ESCORTS('con-flare', 'con-dirk', 'con-tracker', 'con-rsv-wildfire', 'con-rsv-sabre', 'con-rsv-cutlass', 'con-rsv-adder') },
        commanders: { requiredOver: 750, label: 'Fleet Prime', options: [{ ...MASTER }] }, upgrades: [CUP.deepflesh, CUP.shield],
        limits: [...bargeLimits(true), { check: ctx => { const v = ctx.ents.find(e => e.tags.includes('venerable')); return v && ctx.cmd && ctx.cmdOn !== v.i ? ['with a Venerable host barge the Fleet Prime must be assigned to it'] : [] } }],
        attackRating: () => 3 },
    ],
  },
}

export const hasLists = fleet => !!FLEET_LISTS[fleet]
export const listsOf = fleet => FLEET_LISTS[fleet]?.lists ?? []
export const listDef = (fleet, id) => { const l = listsOf(fleet); return l.find(x => x.id === id) ?? l[0] ?? null }

// ---------------- ship ids: a class plus its weapon choices ----------------
/** The variants of a class: { id, picks: [choice index per slot] } for every combination, in the order the art was drawn (prow, then keel). */
export function variantsOf (fleet, cls) {
  const opts = CLASSES[fleet]?.[cls]?.options
  if (!opts || CLASSES[fleet][cls].codec) return [{ id: cls, picks: [] }]   // a Phage class has too many loadouts to list: see splitShipId
  let out = [{ id: cls, picks: [] }]
  for (const o of opts) out = out.flatMap(v => o.choices.map((c, k) => ({ id: v.id + c.suffix, picks: [...v.picks, k] })))
  return out
}
/** { cls, picks } for any ship id (a bare class id has picks all 0), or null if the fleet has no such class. */
export function splitShipId (fleet, id) {
  if (fleet === 'phage') return phageSplit(id) ?? { cls: id, picks: [] }   // data/phageShips.js: the id is the loadout
  for (const cls of Object.keys(CLASSES[fleet] ?? {})) {
    const v = variantsOf(fleet, cls).find(x => x.id === id)
    if (v) return { cls, picks: v.picks }
  }
  return { cls: id, picks: [] }
}
export const classOf = (fleet, id) => splitShipId(fleet, id).cls
/** The ship id a class and its chosen weapon indexes are drawn as. */
export function resolveShipId (fleet, cls, picks = []) {
  if (fleet === 'phage') return phageJoin(cls, picks)
  const opts = CLASSES[fleet]?.[cls]?.options
  if (!opts) return cls
  return cls + opts.map((o, i) => o.choices[picks[i] ?? 0]?.suffix ?? '').join('')
}
