// The Rukka fleet lists: Gutter Cluster, Big Ruck and the Firms list. Exports RUKKA_CLASSES (weapon options per class), RUKKA_LISTS,
// FIRMS_LIST, BORROWED (the Freemen/Dominion escorts a Turncoats gang may take) and firmsCommands (which gangs each Gaffer commands).
// data/fleetLists.js merges the tables with the other fleets'; rules/firms.js and the fleet builder use firmsCommands.
import { maxOf } from '../rules/dicestr.js'

export const RUKKA_CLASSES = {
  // The prow heavy bangers may be swapped for a torpedo chucka at no cost; the drawn ship is class id + '-torpedo'
  'rukka-terror': { options: [{ slot: 'prow', label: 'Prow weapon', choices: [{ name: 'heavy bangers', points: 0, suffix: '' }, { name: 'torpedo chucka', points: 0, suffix: '-torpedo' }] }] },
  'rukka-bash-cruisa': { options: [{ slot: 'prow', label: 'Prow weapon', choices: [{ name: 'heavy bangers', points: 0, suffix: '' }, { name: 'torpedo chucka', points: 0, suffix: '-torpedo' }] }] },
  // The Lite cruisa's prow heavy bangers may become a torpedo chucka (Strength D6) or additional D6 bangers, for no change in cost
  'rukka-lite-cruisa': { options: [{ slot: 'prow', label: 'Prow weapon', choices: [{ name: 'heavy bangers', points: 0, suffix: '' }, { name: 'torpedo chucka', points: 0, suffix: '-torpedo' }, { name: 'additional D6 bangers', points: 0, suffix: '-bangers' }] }] },
  // Razza's Grabber is a Terrace Boarding Barge with boarding torpedoes and Grabbers included in its cost
  'rukka-razzas-grabber': { builtIn: ['terrace', 'barge', 'btorp', 'grabbers'] },
  // Grabbers +5 points for each vessel (the grabbers ship is drawn as rukka-grunt-grabbers, 35 points)
  'rukka-grunt': { options: [{ slot: 'grabbers', label: 'Grabbers (+5 points each)', choices: [{ name: 'no grabbers', points: 0, suffix: '' }, { name: 'grabbers (+5, in the ship\'s cost)', points: 0, suffix: '-grabbers' }] }] },
}

const isHulk = e => e.cls === 'rukka-hulk'
const hasTube = e => !!e.p?.weapons.some(w => w.kind === 'torpedo')
const PG = '366'
const GAFFER = (id, name, points, n) => ({ id, name, points, on: e => e.cls !== 'rukka-lump', excludes: ['gaffer', 'gaffer1', 'gaffer2'].filter(x => x !== id), gaffer: true, rerolls: n, page: PG, text: `commands this ship or gang; ${n} re-roll${n > 1 ? 's' : ''} for the fleet; doubles its boarding value (not on a hulk)` })
const GUB = (id, name, points, text, more = {}) => ({ id, name, points, on: e => e.cls !== 'rukka-lump', page: PG, text, gubbin: true, ...more })
const UPS = [
  GAFFER('gaffer', 'Rukka Gaffer', 40, 1), GAFFER('gaffer1', 'Rukka Gaffer, one extra re-roll', 60, 2), GAFFER('gaffer2', 'Rukka Gaffer, two extra re-rolls', 80, 3),
  GUB('maniac', 'Maniac Gunners', 35, 'may re-roll its bangers\' firepower dice'),
  GUB('mad', 'Mad Spannerz', 25, 're-roll the dice for damage control'),
  { ...GUB('power', 'Extra Power Fields', 25, 'shield value +1 (3 or more shields: 60 mm base)', { shields: 1 }), points: e => isHulk(e) ? 50 : 25 },   // +50 on a hulk
  GUB('mega', 'Heavy Clobba Boarding Parties', 15, '+1 modifier on boarding'),
  GUB('nicked', 'Nicked Torpedoes', 20, 'may re-roll its torpedo salvo strength dice', { on: e => e.cls !== 'rukka-lump' && hasTube(e) }),
  // Tin-fishers +10 per launch bay at the maximum (Bovver ship +40, hulk +160)
  // Orbital mines as for other fleets, +5 points per launch bay at its maximum strength; cruisers only, never a hulk, and the named battleships count as battleships
  { id: 'mines', name: 'Orbital mines', perBay: 5, on: e => e.capital && e.role === 'cruiser' && e.cls !== 'rukka-hulk', needs: 'bays', excludes: ['tbombers'], text: 'the bays launch orbital mines instead of attack craft (a launch bay counts at its maximum)' },
  { id: 'tbombers', name: 'Tin-fishers', perBay: 10, on: 'capital', needs: 'bays', excludes: ['mines'], text: 'the bays may also launch tin-fishers (20 cm; become Strength 2 salvoes)' },
  // Boarding torpedoes +5 on a capital ship with torpedoes, a hulk +15; speed 20 cm
  { id: 'btorp', name: 'Boarding torpedoes', points: e => isHulk(e) ? 15 : 5, on: e => e.capital && e.cls !== 'rukka-lump' && hasTube(e), text: 'boarding torpedoes, speed 20 cm, strength as the chucka' },
  { id: 'turret3', name: 'Third turret', points: 10, on: { cls: ['rukka-hammer'] }, add: { turrets: 1 }, text: 'turrets from two to three' },
  // Rat-a-Tat
  { id: 'ratatat2', name: 'Rat-a-Tat', points: 20, on: e => e.capital && e.cls !== 'rukka-lump', add: { turrets: 2 }, text: '+2 turrets' },
  { id: 'ratatat1', name: 'Rat-a-Tat (escort)', points: 5, on: 'escort', add: { turrets: 1 }, text: '+1 turret; every escort of the gang must take it' },
]

const CRUISAS = { 'rukka-terror': ['cruisa', 'capital'], 'rukka-bash-cruisa': ['cruisa', 'capital'] }
const ESCORTS = { 'rukka-ravager': ['escort'], 'rukka-onslaught': ['escort'], 'rukka-grunt': ['escort'], 'rukka-savage': ['escort'], 'rukka-brute': ['escort'] }
const common = [
  { of: 'cruisa', max: 6, text: 'up to six cruisas' },
  // One Gaffer per 500 points (up to 500: one; 500-1,000: two), and a fleet of 500 or more must have one
  { check: ctx => {
    const w = ctx.ents.filter(e => e.ups.some(u => ['gaffer', 'gaffer1', 'gaffer2'].includes(u))).length, why = []
    if (w > Math.max(1, Math.ceil(ctx.points / 500))) why.push(`at most one Gaffer per 500 points: ${w} is too many for ${ctx.points} points`)
    if (ctx.points >= 500 && !w) why.push('a fleet worth 500 points or more must include a Gaffer')
    return why
  } },
  // A Gaffer's ship may take one of these upgrades at most
  { check: ctx => ctx.ents.flatMap(e => {
    const g = e.ups.filter(u => UPS.find(x => x.id === u)?.gubbin), w = e.ups.some(u => ['gaffer', 'gaffer1', 'gaffer2'].includes(u)), n = e.p?.name ?? e.id
    return [...(g.length && !w ? [`${n} has Gaffer upgrades but no Gaffer`] : []), ...(g.length > 1 ? [`${n} may have only one Gaffer upgrade`] : [])]
  }) },
  // Every escort in a gang takes Rat-a-Tat, or none
  { check: ctx => (ctx.list.escortSquadrons ?? []).some(q => { const n = q.filter(i => ctx.ents[i]?.ups.includes('ratatat1')).length; return n > 0 && n < q.length }) ? ['Rat-a-Tat for escorts: every escort in a gang must take it, or none'] : [] },
]
const BIGRUCK_SHIPS = {
  ...CRUISAS, ...ESCORTS,
  'rukka-hulk': ['hulk', 'capital'], 'rukka-lump': ['lump', 'capital'],
  'rukka-hammer': ['big', 'capital'], 'rukka-bigdens-revenge': ['big', 'named', 'capital'], 'rukka-slammer': ['big', 'named', 'capital'], 'rukka-deadcert': ['big', 'named', 'capital'], 'rukka-bullyboy': ['big', 'named', 'capital'],
}

// ---------------- The Firms Fleet List ----------------
const CP = '', GP = '371', LP = '373'
const CWARLORD = (id, name, points, n) => ({ id, name, points, on: e => e.cls !== 'rukka-lump', excludes: ['cwarlord', 'cwarlord1', 'cwarlord2'].filter(x => x !== id), gaffer: true, noDouble: true, rerolls: n, page: LP,
  text: `commands this ship or gang; ${n} re-roll${n > 1 ? 's' : ''}; +2 on one boarding roll per game; one Gubbin per re-roll` })
const CWARLORDS = ['cwarlord', 'cwarlord1', 'cwarlord2']
// a Gubbin: hulks pay double, the ones that raise boarding value or speed are barred from them
const CG = (id, name, base, text, more = {}) => ({ id, name, points: e => isHulk(e) ? base * 2 : base, on: e => e.cls !== 'rukka-lump' && !(isHulk(e) && more.noHulk), page: GP, text, gubbin: true, firms: true, ...more })
const CLAN = (id, name, points, colour, text, more = {}) => ({ id, name: `${name} (${colour})`, points, on: e => e.cls !== 'rukka-lump' || id === 'snake', page: CP, text, clan: true, squadron: true, ...more })
const FIRMS_UPS = [
  CWARLORD('cwarlord', 'Rukka Gaffer', 0, 1), CWARLORD('cwarlord1', 'Rukka Gaffer, one extra re-roll', 20, 2), CWARLORD('cwarlord2', 'Rukka Gaffer, two extra re-rolls', 40, 3),
  // clans: every capital ship pays separately; a titchy gang pays once for the whole gang
  CLAN('evil', 'Boy Racers', 20, 'red', '+5 cm speed'),
  CLAN('wideboyz', 'Wide Boyz', 30, 'yellow', 'all ships gain Maniac Gunners', { grants: ['maniac'] }),
  CLAN('skullz', 'Rag-and-Bone Lot', 30, 'blue', 'nicked upgrades (torpedoes and/or lances) at no extra cost', { grants: ['nicked', 'llances'] }),
  CLAN('terrace', 'Terrace Lot', 20, 'black', '+1 on boarding actions and +1 Resolve to ram'),
  CLAN('axes', 'Turncoats', 0, 'green', 'free; up to three Freemen Navy / Dominion escorts may join a gang of six or more. (The Freemen Navy refit that comes with them is not implemented.)'),
  CLAN('snake', 'Old School', 0, 'brown', 'capital ships only hulks or Lumps; +1 to the Command check to Brace for Impact!'),
  // Gubbins, one per re-roll of the Gaffer; escort gangs pay once
  CG('big', 'Big Boostas', 25, '+5 cm speed; 4D6 on All Ahead Full', { squadron: true, noHulk: true }),
  { ...CG('power', 'Extra Power Fields', 25, 'shield value +1 (3 or more: 60 mm base)', { shields: 1 }), on: e => e.capital && e.cls !== 'rukka-lump' },
  CG('xturret', 'Extra Turrets', 20, '+2 turrets; an escort gang +1 each', { squadron: true, excludes: ['mturret'], add: { turrets: 2 }, on: e => e.capital && e.cls !== 'rukka-lump' }),
  CG('xturret1', 'Extra Turrets (escort)', 20, '+1 turret on every escort of the gang', { squadron: true, excludes: ['mturret'], add: { turrets: 1 }, on: 'escort' }),
  { ...CG('mturret', 'Maniac Turrets', 10, 'turret value replaced by D3 turrets (rolled once, when the battle is set up)', { excludes: ['xturret', 'xturret1'], maniacTurrets: true }), on: e => e.capital && e.cls !== 'rukka-lump' },
  CG('llances', 'Nicked Lances', 30, 'heavy bangers become Strength 2 lance batteries (15 cm escorts, 30 cm capital ships)', { squadron: true, needsHeavy: true }),
  CG('nicked', 'Nicked Torpedoes', 20, 'may re-roll its torpedo salvo strength dice', { squadron: true, needsTube: true }),
  { ...CG('mad', 'Mad Spannerz', 25, 're-roll the dice when repairing critical damage'), on: e => e.capital && e.cls !== 'rukka-lump' },
  CG('maniac', 'Maniac Gunners', 30, 'may re-roll its bangers\' firepower dice', { squadron: true }),
  { ...CG('mega', 'Heavy Clobba Boarding Parties', 15, '+1 on boarding actions and hit-and-run attacks of any type', { noHulk: true }), on: e => e.capital && e.cls !== 'rukka-lump' && !isHulk(e) },
  { ...CG('pram', 'Prow Ram', 10, '+1 Resolve to ram. (A second effect is not implemented.)'), on: e => e.capital && e.cls !== 'rukka-lump' },
  { ...CG('telly', 'Jump Box', 30, 'Hit-and-run teleport attacks can be made to 30 cm'), on: e => e.capital && e.cls !== 'rukka-lump' },
  // More Gubbins: any number of capital ships, no Gaffer needed
  { id: 'grabbers', name: 'Grabbers', points: e => e.capital ? 10 : 5, on: e => e.capital ? e.cls !== 'rukka-lump' && e.cls !== 'rukka-razzas-grabber' : e.cls === 'rukka-grunt', page: GP, firms: true, more: true, grabbers: true, text: 'Grabbers; a Grunt gang pays +5 per escort' },
  { id: 'sproglance', name: 'Sprog Lance', points: 0, on: e => e.capital && e.cls !== 'rukka-lump' && !!e.p?.weapons.some(w => w.loc === 'prow' && w.kind === 'heavybangers'), page: GP, firms: true, more: true, sproglance: true, text: 'a prow heavy bangers battery replaced by a Sprog Lance (30 cm, 4+, sprog hordes against ships with shields down)' },
  { id: 'barge', name: 'Boarding Barge', points: 0, on: e => e.capital && e.cls !== 'rukka-lump' && e.bays > 0 && !!e.p?.weapons.some(w => w.kind === 'torpedo'), page: GP, firms: true, more: true, grants: ['btorp'], text: 'free boarding torpedoes; assault boats only, +1 assault boat marker when it launches them' },
  // Ordnance. Tin-fishers +10 per launch bay, boarding torpedoes +5, orbital mines +5 per bay (the same rows as the other Rukka lists)
  ...UPS.filter(u => ['tbombers', 'btorp', 'mines'].includes(u.id)).map(u => ({ ...u, page: u.id === 'mines' ? u.page : '' })),
]
// Turncoats: a titchy gang of six or more escorts may include up to three Freemen Navy and/or Dominion escorts at their usual cost. These are those two fleets' escorts.
export const BORROWED = ['wildfire', 'sword', 'adder', 'apostate', 'faithless', 'profaner']
const FIRMS_SHIPS = {
  'rukka-razzas-grabber': ['cruisa', 'capital', 'razza'], 'rukka-terror': ['cruisa', 'capital'], 'rukka-bash-cruisa': ['cruisa', 'capital'], 'rukka-lite-cruisa': ['cruisa', 'capital'],
  ...ESCORTS, ...Object.fromEntries(BORROWED.map(c => [c, ['escort', 'borrowed']])), 'rukka-hulk': ['hulk', 'capital'], 'rukka-lump': ['lump', 'capital'],
  'rukka-hammer': ['big', 'capital'], 'rukka-bigdens-revenge': ['big', 'named', 'capital'], 'rukka-slammer': ['big', 'named', 'capital'], 'rukka-deadcert': ['big', 'named', 'capital'], 'rukka-bullyboy': ['big', 'named', 'capital'],
}
const hasGaffer = e => e.ups.some(u => CWARLORDS.includes(u))
const rerollsOf = e => e.ups.includes('cwarlord2') ? 3 : e.ups.includes('cwarlord1') ? 2 : e.ups.includes('cwarlord') ? 1 : 0
/** The gang a ship stands in: capital squadron, escort squadron, or alone. */
const gangOf = (ctx, e) => (ctx.list.capitalSquadrons ?? []).find(q => q.includes(e.i)) ?? (ctx.list.escortSquadrons ?? []).find(q => q.includes(e.i)) ?? [e.i]
/**
 * Each of a Gaffer's re-rolls (the free first one included) puts one titchy gang of three or more escorts and one other gang under his
 * command. The gangs under each Gaffer: `list.commands` = { gafferIndex: [index of one ship of each gang he commands] } if the builder set it, else filled in list order:
 * his own gang first, then the next unclaimed titchy and other gangs up to his need. A hulk's Gaffer commands the hulk alone. Returns Map(gaffer index -> ship indices).
 */
export function firmsCommands (ctx) {
  const esc = (ctx.list.escortSquadrons ?? []).filter(q => q.length), caps = [], seen = new Set()
  for (const q of ctx.list.capitalSquadrons ?? []) { q.forEach(i => seen.add(i)); caps.push(q) }
  for (const e of ctx.ents) if (e.capital && !seen.has(e.i) && !(ctx.list.capitalSquadrons ?? []).some(q => q.includes(e.i))) caps.push([e.i])
  const all = [...esc, ...caps], taken = new Set(), out = new Map()
  const gaffers = ctx.ents.filter(hasGaffer)
  const claim = (w, q) => { if (!q || q.some(i => taken.has(i))) return; q.forEach(i => taken.add(i)); out.get(w.i).push(...q) }
  for (const w of gaffers) out.set(w.i, [])
  for (const w of gaffers) {
    const explicit = ctx.list.commands?.[w.i]
    if (explicit) { for (const i of explicit) claim(w, all.find(q => q.includes(i))); continue }
    if (isHulk(w)) { claim(w, [w.i]); continue }
  }
  for (const w of gaffers) {
    if (ctx.list.commands?.[w.i] || isHulk(w)) continue
    claim(w, gangOf(ctx, w))
    const R = rerollsOf(w), mine = () => out.get(w.i)
    const count = isTid => all.filter(q => isTid === esc.includes(q) && mine().includes(q[0])).length
    for (const isTid of [true, false]) for (const q of all) if (count(isTid) < R && isTid === esc.includes(q) && !q.some(i => taken.has(i) || isHulk(ctx.ents[i]))) claim(w, q)
  }
  return out
}
const FIRMS_LIMITS = [
  // A Gaffer rides the dearest ship of his own command (not of the whole fleet), even when that ship is an escort
  { check: ctx => [...firmsCommands(ctx)].flatMap(([wi, idx]) => {
    const w = ctx.ents[wi], pts = i => ctx.ents[i].p?.points ?? 0, best = Math.max(0, ...idx.map(pts))
    return idx.length && !idx.includes(wi) ? [`${w.p?.name} must be in command of its own gang`] : idx.length && pts(wi) < best ? [`a Gaffer rides the dearest ship of his own command: ${w.p?.name} (${pts(wi)}) is not the dearest (${best})`] : []
  }) },
  // Exactly one Gaffer per 500 points or part of 500
  { check: ctx => { const w = ctx.ents.filter(hasGaffer).length, need = Math.max(1, Math.ceil(ctx.points / 500)); return w !== need ? [`one Gaffer for every 500 points or part, no more and no less: ${w} Gaffers for ${ctx.points} points needs ${need}`] : [] } },
  // A Gaffer's gang may be given up to one Gubbin per Command re-roll; each only once
  { check: ctx => ctx.ents.flatMap(e => {
    const g = e.ups.filter(u => FIRMS_UPS.find(x => x.id === u)?.gubbin), name = e.p?.name ?? e.id
    if (!g.length) return []
    const sq = gangOf(ctx, e), w = sq.map(i => ctx.ents[i]).find(hasGaffer)
    if (!w) return [`${name} has Gubbins but no Gaffer leads it`]
    return g.length > rerollsOf(w) ? [`${name} has ${g.length} Gubbins; its Gaffer has ${rerollsOf(w)} re-roll${rerollsOf(w) > 1 ? 's' : ''}, one Gubbin each`] : []
  }) },
  // Gangs for every re-roll: one titchy gang of three or more escorts and one other gang; a hulk's Gaffer leads the hulk alone
  { check: ctx => {
    const why = [], hulkW = ctx.ents.filter(e => isHulk(e) && hasGaffer(e)).length
    const R = ctx.ents.filter(e => hasGaffer(e) && !isHulk(e)).reduce((a, e) => a + rerollsOf(e), 0)
    const esc = (ctx.list.escortSquadrons ?? []).filter(q => q.length)
    const capSeen = new Set(), caps = []
    for (const q of ctx.list.capitalSquadrons ?? []) { q.forEach(i => capSeen.add(i)); caps.push(q) }
    for (const e of ctx.ents) if (e.capital && !isHulk(e) && !capSeen.has(e.i)) caps.push([e.i])
    const total = esc.length + caps.length
    if (esc.length < R) why.push(`each Gaffer re-roll needs a titchy gang of three or more escorts: ${R} re-rolls, ${esc.length} titchy gangs`)
    if (total !== 2 * R) why.push(`each Gaffer re-roll commands one titchy gang and one other gang: ${R} re-rolls is ${2 * R} gangs, the fleet has ${total}`)
    for (const q of esc) if (q.length < 3 || q.length > 10) why.push(`a titchy gang is three to ten escorts, not ${q.length}`)
    for (const q of caps) { const roles = q.map(i => ctx.ents[i].cls); if (q.length > 1 && roles.some(c => ctx.def.ships[c]?.includes('big') || ctx.def.ships[c]?.includes('hulk'))) why.push('battleships and battlecruisas are fielded alone'); else if (roles.every(c => ctx.def.ships[c]?.includes('lump'))) { if (q.length > 4) why.push('a Lump gang is one to four Lumps') } else if (q.length > 2) why.push('a cruisa gang is one or two cruisas') }
    // A Gaffer needs two cruisas for a Big 'Un, i.e. an extra re-roll; no more than one Big 'Un for every two cruisas
    const big = ctx.n('big'), kr = ctx.n('cruisa')
    if (big > Math.floor(kr / 2)) why.push(`one Big 'Un for every two cruisas: ${big} for ${kr} cruisas`)
    // A Derelict needs three Gaffers and 1,500 points; one Gaffer must be embarked on it
    const h = ctx.n('hulk')
    if (h > 1) why.push('one Derelict at most')
    if (h && ctx.ents.filter(hasGaffer).length < 3) why.push('a Derelict needs a fleet with at least three Gaffers')
    if (h && ctx.points < 1500) why.push('a Derelict needs a fleet of 1,500 points or more')
    if (h && !hulkW) why.push('a Gaffer must be embarked on the Derelict')
    return why
  } },
  ...['rukka-bigdens-revenge', 'rukka-slammer', 'rukka-deadcert', 'rukka-bullyboy'].map(c => ({ of: { cls: [c] }, max: 1, text: '(0-1) of each named battleship', page: LP })),
  { of: { cls: ['rukka-razzas-grabber'] }, max: 1, text: "(0-1) Razza's Grabber", page: LP },
  // Razza's Grabber is Terrace only (it carries the Terrace clan built in; the colours stay Terrace)
  { check: ctx => ctx.ents.filter(e => e.cls === 'rukka-razzas-grabber' && e.ups.some(u => ['evil', 'wideboyz', 'skullz', 'axes', 'snake'].includes(u))).map(() => "Razza's Grabber is Terrace only") },
  // Turncoats borrowed escorts: a Turncoats titchy gang of at least six escorts, no more than three of them Freemen Navy / Dominion, and no Rukka upgrades on those
  { check: ctx => {
    const why = [], seen = new Set()
    for (const e of ctx.ents.filter(x => BORROWED.includes(x.cls))) {
      const q = gangOf(ctx, e), key = q.join(',')
      if (e.ups.some(u => u !== 'axes')) why.push(`${e.p?.name} is borrowed and takes no Rukka upgrades`)
      if (seen.has(key)) continue
      seen.add(key)
      const mem = q.map(i => ctx.ents[i]), n = mem.filter(x => BORROWED.includes(x.cls)).length
      if (!mem.some(x => x.ups.includes('axes'))) why.push('borrowed Freemen Navy and Dominion escorts only go in a Turncoats gang')
      if (q.length < 6) why.push(`a Turncoats gang needs at least six escorts to borrow any: ${q.length}`)
      if (n > 3) why.push(`at most three borrowed escorts in a gang: ${n}`)
    }
    return why
  } },
  // A Gaffer and his gangs are one clan; Old School capital ships are hulks or Lumps only
  { check: ctx => ctx.ents.filter(e => e.ups.includes('snake') && e.capital && !isHulk(e) && e.cls !== 'rukka-lump').map(e => `Old School capital ship gangs are space hulks or Lumps only: ${e.p?.name} is not`) },
  { check: ctx => ctx.ents.filter(e => e.ups.filter(u => ['evil', 'wideboyz', 'skullz', 'terrace', 'axes', 'snake'].includes(u)).length > 1).map(e => `${e.p?.name} may belong to only one clan`) },
  { check: ctx => ctx.ents.filter(e => e.ups.includes('grabbers') && e.p && e.p.weapons.some(w => w.kind === 'grabbers')).map(e => `${e.p.name} already has Grabbers`) },
]
export const FIRMS_LIST = { id: 'firms', name: 'The Firms Fleet List', ships: FIRMS_SHIPS, upgrades: FIRMS_UPS, limits: FIRMS_LIMITS, squadrons: true, attackRating: () => 3, firms: true }

export const RUKKA_LISTS = {
  lists: [
    { id: 'gutter', name: 'Gutter Cluster Fleet List (Rukka Pirates)', ships: { ...CRUISAS, ...ESCORTS }, upgrades: UPS, limits: common, attackRating: () => 3 },
    { id: 'bigruck', name: 'Big Ruck Fleet List', ships: BIGRUCK_SHIPS, upgrades: UPS, attackRating: () => 3,
      limits: [...common,
        // For every two cruisas one battleship or battlecruisa; each named battleship (0-1)
        { of: 'big', max: ctx => Math.floor(ctx.n('cruisa') / 2), text: 'one battleship or battlecruisa for every two cruisas' },
        ...['rukka-bigdens-revenge', 'rukka-slammer', 'rukka-deadcert', 'rukka-bullyboy'].map(c => ({ of: { cls: [c] }, max: 1, text: '(0-1) of each named battleship' })),
        // One Rukka Derelict per 1,500 points, each with a Gaffer to command it
        { of: 'hulk', max: ctx => Math.max(1, Math.ceil(ctx.points / 1500)), text: 'one derelict per 1,500 points' },
        { check: ctx => ctx.ents.filter(e => isHulk(e) && !e.ups.some(u => ['gaffer', 'gaffer1', 'gaffer2'].includes(u))).map(() => 'each Rukka hulk must be assigned a Rukka Gaffer') },
      ] },
    FIRMS_LIST,
  ],
}
export { maxOf }
