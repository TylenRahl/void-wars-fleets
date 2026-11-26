// The Fire Phase: range and fire arcs, target priority, weapons batteries on the gunnery
// table, lances, Lock On, splitting fire, and the sunburst cannon. Shooting at ordnance is here too.
// Main export fireShip (plus gunnery helpers, weapon-kind tests and fireSunburst); battle.js calls it for the player and
// computer.js for the computer side, and the race files (phage, katharos, firms) reuse its helpers.
import { trackedBy } from './tracking.js'
import { armourAt } from './armour.js'
import { rollDice, sum, count, d6, scatter } from './dice.js'
import { dist, arcsContaining, along } from './geometry.js'
import { say, diceText as fmt, active, isEscort, isHulk, orderOf, weaponHalvings, halved, isCrippled, leadershipTest,
  blastInTheWay, blastTouching, noLongRangeShift, shipByUid, offerBrace, onTable, baseR, placeBlastCluster, ORDERS, isBraced, mates, squadronOf, leadershipOf } from './game.js'
import { hitWithShields, damageShip } from './damage.js'
import { lineOfFire, inAsteroids } from './terrain.js'
import { firingSunward } from './effects.js'
import { lowOrbitFires } from './lowOrbit.js'
import { fieldOf, fieldShift, fieldSave } from './miragefield.js'
import { isDiceStr, rollStr, textOf } from './dicestr.js'
import { isPhageShip, hasUp, gameOfShip } from './game.js'
import { rerollNominated } from './rukka.js'
import { raceRule } from '../data/raceRules.js'
import { thnitoiBlocked, isDisguised, reveal } from './thnitoi.js'
import { fortFront, sameFort, isBasilica, basilicaWorks, fortBraced, fortLockedOn, fortOf } from './fort.js'
import { phageTargets, phageScreened, bioplasmaFire } from './phage.js'

// ---------------- the gunnery table ----------------
// Columns, most dice first: 0 Defences | 1 capital ships closing | 2 capital ships moving away, escorts closing |
// 3 capital ships abeam, escorts moving away | 4 escorts abeam, ordnance. Checked against the worked example in
// rules/core/05-fire.md (firepower 10, closing cruiser: 7 dice; within 15 cm 9; over 30 cm 5).
export const GUNNERY = [
  null,
  [1, 1, 1, 0, 0], [2, 1, 1, 1, 0], [3, 2, 2, 1, 1], [4, 3, 2, 1, 1], [5, 4, 3, 2, 1],
  [5, 4, 3, 2, 1], [6, 5, 4, 2, 1], [7, 6, 4, 3, 2], [8, 6, 5, 3, 2], [9, 7, 5, 4, 2],
  [10, 8, 6, 4, 2], [11, 8, 6, 4, 2], [12, 9, 7, 5, 3], [13, 10, 7, 5, 3], [14, 11, 8, 5, 3],
  [14, 11, 8, 6, 3], [15, 12, 9, 6, 3], [16, 13, 9, 6, 4], [17, 13, 10, 7, 4], [18, 14, 10, 7, 4],
]
export const COLUMN_NAMES = ['Defences', 'capital ships closing', 'capital ships moving away / escorts closing',
  'capital ships abeam / escorts moving away', 'escorts abeam / ordnance']
/** Dice for `fp` firepower in column `col`; over 20, look up 20 and the rest separately and add. */
export function gunneryDice (fp, col) {
  let n = 0
  while (fp > 20) { n += GUNNERY[20][col]; fp -= 20 }
  return n + (fp > 0 ? GUNNERY[fp][col] : 0)
}

/** The target's discipline is the quarter of the TARGET that the firer sits in. */
export function disciplines (firer, target) {
  return arcsContaining(target.pos, target.facing, firer.pos).map(a => a === 'front' ? 'closing' : a === 'rear' ? 'away' : 'abeam')
}
/** Athanatoi weapons batteries count every target as 'closing' on the Gunnery table, whatever its true discipline. */
export const alwaysClosing = firer => firer?.profile?.fleet === 'athanatoi' || !!raceRule(firer?.profile?.fleet).alwaysClosing   // The Thnitoi too
/** The gunnery column for a ship target before shifts. A ship that moved under 5 cm is a Defence.
 * `firer` (optional): the Athanatoi's batteries use the 'closing' column for capital ships and escorts alike, while Defences
 * (and ships that moved under 5 cm, which count as Defences) are still targeted as such. */
export function baseColumn (target, discipline, firer = null) {
  if (target.moved != null && target.moved < 5) return 0
  if (target.profile.type === 'defence' || target.profile.type === 'ground') return 0   // planetary defences too, and the Dominion Derelict, whose type is Defence
  const esc = isEscort(target)
  if (alwaysClosing(firer)) discipline = 'closing'
  const col = { closing: esc ? 2 : 1, away: esc ? 3 : 2, abeam: esc ? 4 : 3 }[discipline]
  return firer?.droneLinked ? Math.max(0, col - 1) : col   // Drone Link, a left shift before all other modifiers
}

// ---------------- weapons ----------------
const ARC_OF_CRIT = { port: 'port', starboard: 'starboard', prow: 'prow', dorsal: 'dorsal', keel: 'keel', lances: 'lances', main: 'main', bays: 'bays', thorax: 'thorax' }   // the last three: defences; thorax: the Phage's
/** The weapon kinds fireShip fires: weapons batteries and lances, and the Athanatoi starlance (which counts as a lance shot). */
export const GUN_KINDS = ['battery', 'lance', 'starlance', 'phantom', 'bombardment', 'lightning', 'whip', 'heavybangers', 'pyro', 'bioplasma']   // pyro, bioplasma: the Phage's; lightning and whip: the Katharos' storm arc and sterilizer flayer
/** A lance or a starlance: shields and Blast Markers treat it as a lance, a mirage field saves against it. */
export const isLance = w => w.kind === 'lance' || w.kind === 'starlance' || w.kind === 'phantom' || w.kind === 'whip'   // the flayer counts as a lance (except for its 6s)
/** A weapons battery, or a weapon that fires like one apart from a couple of exceptions (Concord bombardment cannon, Phage pyro, Katharos storm arc, Rukka heavy bangers). */
export const isBattery = w => w.kind === 'battery' || w.kind === 'pyro' || w.kind === 'bombardment' || w.kind === 'lightning' || w.kind === 'heavybangers'
export const weaponArcs = w => w.arc === 'all' ? ['front', 'right', 'rear', 'left'] : w.arc
/** A weapon knocked out by a critical hit can't fire. */
export const weaponWorks = (ship, w) => !(ARC_OF_CRIT[w.loc] && ship.crits[ARC_OF_CRIT[w.loc]] && !(ship.fort && w.loc === 'main')) && !thnitoiBlocked(ship, w) && !(ship.fort && isBasilica(w) && !basilicaWorks(gameOfShip(ship), ship))   // a fort's 'main armament damaged' halves instead; Basilica weapons fire from one standing quadrant; thnitoiBlocked: Thnitoi criticals
/** Firepower or strength now: halved for orders and crippling, cumulative, rounding up. */
export const weaponStrength = (ship, w) => isDiceStr(w.str) ? w.str : ship.fort ? fortStrength(ship, w) : halved(w.str, weaponHalvings(ship))
/** Basilica weapons are halved by Brace for Impact! (any quadrant braced) only; a quadrant's by its own orders, crippling, and 'main armament damaged'. */
const fortStrength = (ship, w) => isBasilica(w) ? halved(w.str, fortBraced(gameOfShip(ship), ship) ? 1 : 0) : halved(w.str, weaponHalvings(ship) + (ship.crits.main && w.kind === 'battery' ? 1 : 0))   // a Rukka gun's dice are rolled when it fires, so before then it is the dice text
/** Rukka bangers roll their firepower afresh each time they fire. Brace for Impact! is decided before the dice are rolled, so this is called after offerBrace. */
export const isRolled = w => isDiceStr(w.str)
function rollBangers (game, ship, w) {
  const mayReroll = (ship.upgrades ?? []).includes('maniac') && rerollNominated(game, ship, 'maniac', w)   // A hulk nominates one weapon system a turn, before the roll
  let r = rollStr(game.rng, w.str)
  let text = `${w.str} rolled ${textOf(r)}`
  // Maniac Gunners: the ship may re-roll its bangers' firepower dice; the owner chooses (game.decide.rerollBangers), the second roll stands
  if (mayReroll && game.decide.rerollBangers?.(game, ship, { roll: r.total, weapon: w, dice: w.str })) {
    const again = rollStr(game.rng, w.str)
    text += `, re-rolled by the Maniac Gunners to ${textOf(again)} (the second roll stands)`
    r = again
  }
  return { fp: r.total, text }
}
/** Firepower now for a ship shooting at ordnance (no Brace to wait for): rolled if its dice, then halved. */
function firepowerNow (game, ship, w) {
  if (!isRolled(w)) return weaponStrength(ship, w)
  const r = rollBangers(game, ship, w)
  say(game, `${ship.name}'s ${w.loc} bangers: ${r.text}`)
  return halved(r.fp, weaponHalvings(ship))
}
/**
 * Katharos critical hits 2-5, Power Flow Disrupted: storm arcs and particle whips can't fire into an arc until repaired. Port is the left arc,
 * starboard the right. 4 switches storm arcs off in every arc, 5 both weapons in every arc.
 */
export function arcOff (ship, w, arc) {
  if (w.kind !== 'lightning' && w.kind !== 'whip') return false
  const c = ship.crits
  return !!(c.flowAll || (w.kind === 'lightning' && c.flowArcs) || (arc === 'left' && c.flowPort) || (arc === 'right' && c.flowStarboard))
}
export function canReach (ship, w, p) {
  return dist(ship.pos, p) <= w.range + 1e-6 && arcsContaining(ship.pos, ship.facing, p).some(a => weaponArcs(w).includes(a) && !arcOff(ship, w, a))
}
/** In range, in arc, and with a clear line of fire past the celestial phenomena. */
export const canTarget = (game, ship, w, p) => canReach(ship, w, p) && !lineOfFire(game, ship.pos, p)

/** The nearest enemy ship (hulks don't count, and no test is needed to ignore one). */
export function nearestEnemy (game, ship) {
  let best = null
  for (const e of active(game)) if (e.side !== ship.side && !isDisguised(game, e) && (!best || dist(e.pos, ship.pos) < dist(best.pos, ship.pos))) best = e
  return best
}

export function mayFire (game, ship, { sunburst = false } = {}) {
  if (game.phase !== 'shooting' || ship.side !== game.active) return 'ships fire in their own Fire Phase'
  if (ship.state !== 'active') return 'it is not an active ship'
  if (!sunburst && ship.fired) return 'it has already fired this phase'
  if (ship.noFireRound === game.round) return 'it is boarding or failed to disengage this turn'
  if (ship.lockedWith) return 'it is locked in a boarding action'
  if (ship.standby) return 'it is on standby'
  if (inAsteroids(game, ship.pos) && (isBraced(ship) || isCrippled(ship))) return 'ships that are braced or crippled may not shoot inside an asteroid field'
  return null
}

/**
 * Fire a ship's weapons batteries and lances — and, if it is in a squadron, the whole squadron's (a
 * squadron's fire is combined). shots: [{ weapon, target: ship uid or { ordnance: id }, str?, ship?: uid }] — `ship`
 * says whose weapon it is (default: this ship).
 * Weapons that can bear on the nearest enemy must fire at it unless the ship (the squadron, on its best
 * Resolve) passes a Resolve Test on 2D6; if it fails those shots go to the nearest enemy instead.
 * opts.discipline: when a firer is exactly on the line between two of the target's arcs, the shooter's choice.
 */
export function fireShip (game, ship, shots, opts = {}) {
  const squad = mates(game, ship)
  for (const x of squad) { const no = mayFire(game, x); if (no && x === ship) return { ok: false, reason: say(game, `${ship.name} can't fire: ${no}`) } }
  const firers = squad.filter(x => !mayFire(game, x))
  // A shot at a fort hits the quadrant on the line from the firer's stem to the fort's centre; a quadrant already wrecked takes nothing
  const shotsBy = shots.map(s => ({ ...s, by: s.ship != null ? shipByUid(game, s.ship) : ship })).map(s => {
    const t = typeof s.target === 'number' ? shipByUid(game, s.target) : null
    if (!t?.fort || !s.by) return s
    const q = fortFront(game, t, s.by.pos)
    if (q.uid !== t.uid) say(game, `${s.by.name} fires at ${t.profile.name}: the line to its centre crosses the ${q.name.split('(')[1].replace(')', '')}`)
    return { ...s, target: q.uid, absorbed: q.state !== 'active' }   // a wrecked quadrant is an asteroid field; hits are lost in the wreckage
  })
  // check every shot first, so a refused order changes nothing
  const used = new Map()
  for (const s of shotsBy) {
    const x = s.by, w = x && x.profile.weapons[s.weapon]
    if (!x || !firers.includes(x)) return { ok: false, reason: say(game, `${x?.name ?? 'that ship'} can't fire with this squadron now`) }
    if (!w || !GUN_KINDS.includes(w.kind)) return { ok: false, reason: say(game, `${x.name}: weapon ${s.weapon} is not a weapons battery or lance`) }
    if (!weaponWorks(x, w)) return { ok: false, reason: say(game, `${x.name}: its ${w.loc} armament is damaged`) }
    if (typeof s.target === 'number' && isDisguised(game, shipByUid(game, s.target))) return { ok: false, reason: say(game, `${shipByUid(game, s.target).name} can't be targeted: its false-flag engines hide it in the first turn until it attacks`) }
    const tp = targetPos(game, s.target)
    if (!tp) return { ok: false, reason: say(game, `${x.name}: no such target`) }
    if (!canReach(x, w, tp)) return { ok: false, reason: say(game, `${x.name}: the target is out of range or fire arc of its ${w.loc} ${w.kind}`) }
    const lof = s.absorbed ? null : lineOfFire(game, x.pos, tp)   // the wreck is where the shot lands, not something in its way
    if (lof) return { ok: false, reason: say(game, `${x.name}: ${lof}`) }
    if (isRolled(w) && (s.str != null || shotsBy.filter(o => o.by === x && o.weapon === s.weapon).length > 1)) return { ok: false, reason: say(game, `${x.name}: its ${w.loc} bangers have a rolled firepower and fire at one target`) }
    if (w.shared && !x.loaded.torpedo) return { ok: false, reason: say(game, `${x.name}: its prow chuckas are not loaded: Reload Ordnance first`) }
    const key = x.uid + ':' + s.weapon, str = isRolled(w) ? 0 : s.str ?? weaponStrength(x, w)
    used.set(key, (used.get(key) ?? 0) + str)
    if (!isRolled(w) && used.get(key) > weaponStrength(x, w)) return { ok: false, reason: say(game, `${x.name}: its ${w.loc} ${w.kind} has only ${weaponStrength(x, w)} to split`) }
  }
  // target priority (a squadron counts as one target; ordnance needs no test)
  const sameTarget = (a, b) => a === b || sameFort(shipByUid(game, a), shipByUid(game, b)) || (squadronOf(game, shipByUid(game, a)) && squadronOf(game, shipByUid(game, a)) === squadronOf(game, shipByUid(game, b)))
  const nearestOf = x => nearestEnemy(game, x)
  // Defenders may always target a Worldbreaker with no Resolve Test
  const strays = s => { const n = nearestOf(s.by); return typeof s.target === 'number' && n && !sameTarget(s.target, n.uid) && !shipByUid(game, s.target)?.worldbreaker && canTarget(game, s.by, s.by.profile.weapons[s.weapon], n.pos) }
  let plan = shotsBy
  // Phage ships shoot at the nearest enemy unless a Forerunner drone marks another target; they take no Resolve Test, so any other target is swapped for the nearest
  if (shotsBy.some(s => isPhageShip(s.by))) plan = phageTargets(game, plan, strays)
  for (const x of firers) x.droneLinked = hasUp(x, 'drone-link') && active(game).some(v => v.side === x.side && v.profile.vanguard && dist(v.pos, x.pos) <= 15 + 1e-6)   // Drone Link
  if (shotsBy.some(s => strays(s) && !isPhageShip(s.by))) {
    const leader = firers.reduce((a, b) => leadershipOf(b) > leadershipOf(a) ? b : a)
    // -1 Resolve to ignore closer targets when firing on a queen ship screened by a squadron of only Picket drones
    const screen = shotsBy.filter(s => !isPhageShip(s.by) && strays(s)).some(s => phageScreened(game, s.by, shipByUid(game, s.target)))
    if (screen) say(game, 'The queen ship is screened by picket drones touching it: -1 Resolve to ignore the closer targets')
    const t = leadershipTest(game, leader, { why: 'fire at a target other than the nearest enemy', modifier: screen ? -1 : 0 })
    if (!t.pass) {
      plan = plan.map(s => strays(s) && !isPhageShip(s.by) ? { ...s, target: nearestOf(s.by).uid } : s)
      say(game, 'They must fire at the nearest enemy instead')
    }
  }
  for (const x of firers) { x.fired = true; reveal(game, x) }   // Attacking gives a mimic ship away
  for (const s of plan) if (s.by.profile.weapons[s.weapon].shared) s.by.loaded.torpedo = false   // The Hammer's chuckas fire torpedoes OR the bombardment cannon, then need Reload Ordnance
  const lockOn = orderOf(ship) === 'lockOn'
  const escorts = firers.every(isEscort) && firers.length > 1
  const results = []
  // ordnance targets one by one
  for (const s of plan.filter(s => typeof s.target === 'object')) results.push(shootOrdnance(game, s.by, s.by.profile.weapons[s.weapon], s.str ?? firepowerNow(game, s.by, s.by.profile.weapons[s.weapon]), s.target.ordnance))
  // ship targets: group by target ship (a target squadron is hit as one), lances together, batteries by column
  const groups = new Map()
  for (const s of plan.filter(s => typeof s.target === 'number')) {
    const t = shipByUid(game, s.target)
    if (t?.fort && t.state !== 'active') { say(game, `${s.by.name}'s shot at ${t.name}: the quadrant is drifting wreckage, the hits plow into it and do no damage`); continue }
    if (!t || (t.state !== 'active' && !isHulk(t))) continue
    if (!groups.has(t.uid)) groups.set(t.uid, [])
    groups.get(t.uid).push(s)
  }
  for (const [uid, list] of groups) {
    const target = shipByUid(game, uid)
    offerBrace(game, target, { by: ship, what: 'shooting', key: `fire-${ship.uid}-${game.round}` })
    // lances: one roll for all of them
    // Lances in low orbit need a 4+ to fire, each weapon
    const lances = list.filter(s => isLance(s.by.profile.weapons[s.weapon]) && lowOrbitFires(game, s.by, `${s.by.profile.weapons[s.weapon].loc} lances`))
    if (lances.length) {
      const strOf = s => s.str ?? weaponStrength(s.by, s.by.profile.weapons[s.weapon])
      const plain = lances.filter(s => s.by.profile.weapons[s.weapon].kind === 'lance'), starlances = lances.filter(s => s.by.profile.weapons[s.weapon].kind === 'starlance'), phantoms = lances.filter(s => s.by.profile.weapons[s.weapon].kind === 'phantom'), whips = lances.filter(s => s.by.profile.weapons[s.weapon].kind === 'whip')
      let hitDice = [], hits = 0
      if (plain.length) {
        const str = plain.reduce((a, s) => a + strOf(s), 0)
        const r = rollToHit(game, str, 4, lockOn)
        say(game, `${names(plain)} fire${plain.length > 1 || firers.length > 1 ? '' : 's'} lances (strength ${str}) at ${target.name}: ${r.text}: ${r.hits} hit${r.hits === 1 ? '' : 's'}`)
        hitDice = r.dice.filter(v => v >= 4).concat(r.reroll.filter(v => v >= 4)); hits += r.hits
      }
      // The sterilizer flayer is a lance, but a 6 to hit gets past shields, mirage fields and anything like them: a 6 goes straight to damage (no Blast Marker); a 4 or 5 is an ordinary lance hit. Brace and a reactive hull save still apply to the damage.
      let whipSixes = 0
      if (whips.length) {
        const str = whips.reduce((a, s) => a + strOf(s), 0)
        const r = rollToHit(game, str, 4, lockOn)
        const won = r.dice.filter(v => v >= 4).concat(r.reroll.filter(v => v >= 4)), sixes = won.filter(v => v === 6).length
        say(game, `${names(whips)} fire${whips.length > 1 || firers.length > 1 ? '' : 's'} flayer (strength ${str}) at ${target.name}: ${r.text}: ${r.hits} hit${r.hits === 1 ? '' : 's'}, ${sixes} of them 6${sixes === 1 ? '' : 's'} that ignore shields and mirage fields`)
        hitDice = hitDice.concat(won.filter(v => v < 6)); hits += r.hits; whipSixes = sixes
      }
      let starlanceHits = 0
      if (starlances.length) {
        const str = starlances.reduce((a, s) => a + strOf(s), 0)
        const p = starlanceChains(game, str, lockOn)
        say(game, `${names(starlances)} fire${starlances.length > 1 || firers.length > 1 ? '' : 's'} starlances (strength ${str}, ${str} chain${str === 1 ? '' : 's'}) at ${target.name}: ${p.text}: ${p.hits} hit${p.hits === 1 ? '' : 's'}`)
        starlanceHits = p.hits; hits += p.hits; hitDice = hitDice.concat(Array(p.hits).fill(4))
      }
      // The Thnitoi hollow lance, their version of the starlance: a D6 per point of strength, 1-3 no hits, 4 one hit, 5-6 two hits. Read as a lance for shields, Blast
      // Markers and the void field save, as the starlance is. Lock On re-rolls the dice that gave no hit.
      if (phantoms.length) {
        const str = phantoms.reduce((a, s) => a + strOf(s), 0)
        const p = phantomHits(game, str, lockOn)
        say(game, `${names(phantoms)} fire${phantoms.length > 1 || firers.length > 1 ? '' : 's'} hollow lances (strength ${str}) at ${target.name}: ${p.text}: ${p.hits} hit${p.hits === 1 ? '' : 's'}`)
        hits += p.hits; hitDice = hitDice.concat(Array(p.hits).fill(4))
      }
      // game.onFx: the board's animations (src/battle/fx.js) — drawing only, the result is already decided. A starlance counts as a
      // lance shot and draws as one: plain lances and starlances are one 'lance' event, each shot named in `shots`.
      game.onFx?.({ kind: 'lance', from: [...new Set(lances.map(s => s.by))], to: target, hits, side: ship.side, shots: lances.map(s => ({ ship: s.by, weapon: s.weapon, str: strOf(s) })) })
      const lr = takeHits(game, target, hitDice, list.map(s => s.by), 'lance', 'lances')
      if (whipSixes) {   // the 6s: the nearest ship of a squadron first, as for any hit; no shields, no mirage field, no Blast Marker
        const q = squadronOf(game, target)
        let dmg = 0
        const pool = q && !isHulk(target) ? mates(game, target).filter(t => list.some(s => canTarget(game, s.by, s.by.profile.weapons[s.weapon], t.pos))).sort((a, b) => dist(list[0].by.pos, a.pos) - dist(list[0].by.pos, b.pos)) : [target]
        for (let i = 0; i < whipSixes; i++) { const t = pool.find(x => x.state === 'active') ?? (isHulk(target) ? target : null); if (!t) break; dmg += isHulk(t) ? (hitWithShields(game, t, 1, null, 'the flayer'), 0) : damageShip(game, t, 1, { what: 'flayer hits that ignore shields' }) }
        lr.damage = (lr.damage ?? 0) + dmg
      }
      results.push({ target: uid, kind: 'lance', hits, starlanceHits, whipSixes, ...lr })
    }
    // batteries: each firer's firepower looked up in its own column, summed per column; escort squadrons halve
    // their total once for orders, capital ships each their own
    const bios = list.filter(s => s.by.profile.weapons[s.weapon].kind === 'bioplasma')
    if (bios.length) results.push({ target: uid, kind: 'bioplasma', ...bioplasmaFire(game, target, bios.map(s => ({ by: s.by, str: s.str ?? weaponStrength(s.by, s.by.profile.weapons[s.weapon]) })), lockOn) })
    const bats = list.filter(s => isBattery(s.by.profile.weapons[s.weapon]))
    if (!bats.length) continue
    const cols = new Map()
    for (const s of bats) {
      const w = s.by.profile.weapons[s.weapon]
      // The bangers' dice are rolled now, after Brace for Impact! was decided (offerBrace above); then halved for orders and crippling, round up
      let raw = w.str
      if (s.str == null && isRolled(w)) { const rg = rollBangers(game, s.by, w); raw = rg.fp; say(game, `${s.by.name}'s ${w.loc} bangers: ${rg.text}, firepower ${rg.fp}`) }
      const fp = s.str ?? (escorts ? raw : halved(raw, weaponHalvings(s.by)))
      const heavy = w.kind === 'heavybangers'
      const bomb = w.kind === 'bombardment', arc = w.kind === 'lightning', pyro = w.kind === 'pyro'
      const pick = choosePick(game, s.by, target, fp, opts, bomb, arc, heavy)
      const k = pick.col.col + ':' + pick.armour + (bomb ? ':bombardment' : '') + (arc ? ':lightning' : '') + (pyro ? ':pyro' : '') + (heavy ? ':heavy' : '')
      if (!cols.has(k)) cols.set(k, { pick, fp: 0, list: [], bomb, arc, pyro, heavy })
      const c = cols.get(k); c.fp += fp; c.list.push(s)
    }
    for (const c of cols.values()) {
      const fp = escorts && ORDERS[ship.order?.kind]?.halves ? Math.ceil(c.fp / 2) : c.fp
      const dice = gunneryDice(fp, c.pick.col.col)
      const r = rollToHit(game, dice, c.pick.armour, lockOn)
      // Heavy bangers: every hit counts twice. The doubled hits go to shields first like any others.
      if (c.heavy) { const won = r.dice.concat(r.reroll).filter(v => v >= c.pick.armour); r.hits *= 2; r.dice = won.flatMap(v => [v, v]); r.reroll = [] }
      game.onFx?.({ kind: 'battery', from: [...new Set(c.list.map(s => s.by))], to: target, dice, hits: r.hits, side: ship.side, shots: c.list.map(s => ({ ship: s.by, weapon: s.weapon })) })
      say(game, `${names(c.list)} fire${c.list.length > 1 ? '' : 's'} ${c.bomb ? 'bombardment cannon' : c.arc ? 'storm arcs' : c.heavy ? 'heavy bangers (hits count double)' : 'weapons batteries'} (firepower ${fp}${fp !== c.fp ? `, the squadron's ${c.fp} halved` : ''}) at ${target.name}, ${c.pick.col.text}: ${dice} dice ${r.text}: ${r.hits} hit${r.hits === 1 ? '' : 's'}${c.bomb ? ' (hits on 4+ whatever the armour, criticals on 4+)' : c.arc ? ' (every target counts as closing, and mirage and void fields give no column shift)' : ''}`)
      results.push({ target: uid, kind: 'battery', dice, hits: r.hits, ...takeHits(game, target, r.dice.concat(r.reroll), c.list.map(s => s.by), c.bomb ? 'bombardment' : 'battery', c.bomb ? 'bombardment cannon' : c.pyro ? 'burning acid batteries' : 'weapons batteries', c.pick.armour, { pyro: c.pyro }) })
    }
  }
  return { ok: true, results }
}
const names = list => [...new Set(list.map(s => s.by.name.replace(/ class.*/, '')))].join(' and ')

// the discipline the shooter picks when on a line: the one expected to do the most hits
function choosePick (game, ship, target, fp, opts, bomb = false, arc = false, heavy = false) {
  const picks = (arc ? ['closing'] : disciplines(ship, target)).map(a0 => { const a = a0
    // A storm arc treats all targets as closing, and ignores the mirage field and void field column shift (its bolts need no sight)
    const col = arc ? shiftColumn(game, ship, target, baseColumn(target, 'closing', null), 'storm arc: every target counts as closing', true)
      : shiftColumn(game, ship, target, baseColumn(target, a, ship), alwaysClosing(ship) && a !== 'closing' ? `the ${a === 'away' ? 'moving away' : 'abeam'} side counted as closing for Athanatoi batteries` : '', false, heavy)
    const armour = bomb ? 4 : armourAt(target, a)   // Bombardment cannons always hit on 4+
    return { a, col, armour, expect: gunneryDice(fp, col.col) * (7 - armour) / 6 }
  })
  const best = picks.reduce((x, y) => y.expect > x.expect ? y : x)
  if (opts.discipline) return picks.find(p => p.a === opts.discipline) ?? best
  // When the line of fire lies exactly between two arcs the shooting player picks the arc. The owner is asked once per firer and target
  // (game.decide.discipline(game, ship, { target, options, best }) -> a discipline name); headless, and when the hook is absent, the pick expected to do most hits stands.
  if (picks.length > 1 && game.decide.discipline) {
    const asked = askedDiscipline.get(opts) ?? askedDiscipline.set(opts, new Map()).get(opts), key = ship.uid + ':' + target.uid
    if (!asked.has(key)) asked.set(key, game.decide.discipline(game, ship, { target, options: picks.map(p => p.a), best: best.a }))
    return picks.find(p => p.a === asked.get(key)) ?? best
  }
  return best
}
const askedDiscipline = new WeakMap()

/**
 * Hand hits to a target. A lone ship takes them all. A squadron: hits go to the nearest eligible ship
 * (in range and arc of the firers, with a line of fire) until it is destroyed, then the next; for batteries with mixed
 * armour each die goes, lowest first, to the nearest ship it can hurt. `dice` are the successful (or all) dice rolled.
 */
function takeHits (game, target, dice, firers, kind, what, need = 4, { pyro = false } = {}) {
  const q = squadronOf(game, target)
  const from = firers[0].pos
  // A mirage field saves once against each successful lance hit (batteries only get the column shift); brace was offered first
  const saveField = (ship, n) => kind === 'lance' && fieldOf(ship) ? fieldSave(game, ship, n, { what: 'lance', from, by: firers[0], braceAsked: true }).through : n
  const critAt = kind === 'bombardment' ? 4 : 6   // a bombardment cannon scores criticals on 4+
  if (!q || isHulk(target)) return hitWithShields(game, target, saveField(target, dice.filter(v => v >= need).length), from, `${firers.map(f => f.name.replace(/ class.*/, '')).join(' and ')}'s ${what}`, { critAt, pyro })
  const reach = s => firers.some(f => f.profile.weapons.some(w => (kind === 'lance' ? isLance(w) : kind === 'bombardment' ? w.kind === 'bombardment' : isBattery(w)) && canTarget(game, f, w, s.pos)))
  const pool = mates(game, target).filter(reach).sort((a, b) => dist(from, a.pos) - dist(from, b.pos))
  const armourOf = s => kind === 'lance' || kind === 'bombardment' ? 4 : armourAt(s, disciplines(firers[0], s)[0])
  let absorbed = 0, damage = 0
  for (const v of [...dice].sort((a, b) => a - b)) {
    const s = pool.find(x => x.state === 'active' && v >= armourOf(x))
    if (!s) continue
    if (saveField(s, 1) < 1) continue
    const r = hitWithShields(game, s, 1, from, `the ${what}`, { critAt, pyro })
    absorbed += r.absorbed; damage += r.damage
  }
  if (pool.length < mates(game, target).length) say(game, `Only the ${pool.length} ship${pool.length === 1 ? '' : 's'} of ${q.name} in range and arc can be hit`)
  return { absorbed, damage }
}

function targetPos (game, target) {
  if (typeof target === 'number') { const t = shipByUid(game, target); return t && t.pos && (t.state === 'active' || isHulk(t) || t.fort) ? t.pos : null }   // a wrecked fort quadrant is still where the shot lands
  const o = game.ordnance.find(x => x.id === target?.ordnance)
  return o ? o.pos : null
}

/**
 * A starlance hits on a 4+ whatever the armour; after a hit it rolls again, and keeps rolling until it misses or has
 * 3 hits in all. One chain for each point of strength (the rules don't say whether strength 2 is one chain or two; read
 * as two). Under Lock On each miss gets one re-roll, and a chain whose re-roll misses too is over (still at most 3 hits).
 */
export function starlanceChains (game, str, lockOn) {
  let hits = 0
  const parts = []
  for (let c = 0; c < str; c++) {
    let n = 0, ended = false
    const seq = []
    while (!ended && n < 3) {
      let v = d6(game.rng)
      if (v >= 4) { n++; seq.push(String(v)); continue }
      if (lockOn) {
        const again = d6(game.rng)
        seq.push(`${v}→${again}`)
        if (again >= 4) { n++; continue }
      } else seq.push(String(v))
      ended = true
    }
    hits += n
    parts.push(`${seq.join(', ')}${n >= 3 ? ' (three hits, the chain stops)' : ''}`)
  }
  return { hits, text: `${str > 1 ? 'chains ' : 'chain '}${parts.map(x => `[${x}]`).join(' ')}, needed 4+ each${lockOn ? '; Lock On re-rolls each miss once, shown miss→re-roll' : ''}` }
}

/** One D6 per point of hollow lance strength, 1-3 no hits, 4 one hit, 5-6 two hits. Lock On: each die showing 1-3 is rolled once more. */
export function phantomHits (game, str, lockOn) {
  const dice = rollDice(game.rng, str), hitsOf = v => v >= 5 ? 2 : v === 4 ? 1 : 0
  let hits = dice.reduce((a, v) => a + hitsOf(v), 0), text = `rolled ${fmt(dice)} (1-3 none, 4 one hit, 5-6 two hits)`
  if (lockOn) {
    const missed = dice.filter(v => v <= 3).length
    if (missed) { const re = rollDice(game.rng, missed); hits += re.reduce((a, v) => a + hitsOf(v), 0); text += `; Lock On re-rolls the ${missed} that gave no hit: ${fmt(re)}` }
  }
  return { hits, text }
}

function rollToHit (game, n, need, lockOn) {
  const dice = rollDice(game.rng, n)
  let hits = count(dice, need), text = `rolled ${fmt(dice)}, needed ${need}+`, kept = dice.filter(v => v >= need), reroll = []
  if (lockOn) {
    const missed = dice.length - hits
    if (missed) { reroll = rollDice(game.rng, missed); hits += count(reroll, need); text += `; Lock On re-rolls the ${missed} miss${missed > 1 ? 'es' : ''}: ${fmt(reroll)}` }
  }
  return { hits, text, dice: lockOn ? kept : dice, reroll }
}

/** Within 15 cm one column left; over 30 cm one right; Blast Markers in the way one right. */
function shiftColumn (game, ship, target, col0, note = '', noField = false, noRange = false) {
  const d = dist(ship.pos, target.pos)
  let col = col0
  const why = []
  // Firing sunward in the Flare Region, Mercurial Zone or Inner Biosphere doubles the range shifts
  const sun = firingSunward(game, ship.pos, target.pos) ? 2 : 1, sunText = sun > 1 ? ', doubled firing sunward' : ''
  if (noRange) why.push('heavy bangers ignore the range columns')
  if (!noRange && d <= 15 && !(inAsteroids(game, ship.pos) && inAsteroids(game, target.pos))) { col -= sun; why.push(`within 15 cm, ${sun > 1 ? 'two columns' : 'one column'} left${sunText}`) }
  if (!noRange && d > 30 && !noLongRangeShift(ship) && !trackedBy(game, ship)) { col += sun; why.push(`over 30 cm, ${sun > 1 ? 'two columns' : 'one column'} right${sunText}`) }
  if (blastInTheWay(game, ship, target)) { col++; why.push('Blast Markers in the way, one column right') }
  if (ship.lowOrbit) { col++; why.push('in low orbit, one column right') }
  // Mirage fields shift every gunnery table attack one column right, on top of the range and Blast Marker shifts
  const fs = noField ? 0 : fieldShift(target)
  if (fs) { col += fs; why.push('mirage field, one column right') }
  if (note) why.unshift(note)
  col = Math.max(0, Math.min(4, col))   // never past the first or last column
  return { col, text: `${Math.round(d * 10) / 10} cm, ${COLUMN_NAMES[col0]}${why.length ? ' (' + why.join(', ') + ')' : ''} → column "${COLUMN_NAMES[col]}"` }
}

/** Batteries use the Ordnance column (range and Blast Marker shifts apply), lances and batteries need
 * 6s; one hit removes the marker. */
function shootOrdnance (game, ship, w, str, id) {
  const o = game.ordnance.find(x => x.id === id)
  if (!o) return { kind: 'ordnance', hits: 0 }
  let n = str, text = ''
  if (isBattery(w)) {   // lances and starlances: strength dice on 6s, no chain against a marker
    const d = dist(ship.pos, o.pos)
    const sun = firingSunward(game, ship.pos, o.pos) ? 2 : 1   // firing sunward doubles the range shifts
    let col = 4 - (d <= 15 ? sun : 0) + (d > 30 && !noLongRangeShift(ship) && !trackedBy(game, ship) ? sun : 0) + (blastTouching(game, ship).length || game.blast.some(m => dist(m, o.pos) < 1.0 + o.r) ? 1 : 0)
    col = Math.max(0, Math.min(4, col))
    n = gunneryDice(str, col); text = `${n} dice on the "${COLUMN_NAMES[col]}" column, `
  }
  const need = w.kind === 'bombardment' ? 4 : 6   // a bombardment cannon hits on 4+, ordnance included
  const dice = rollDice(game.rng, n), hits = count(dice, need)
  game.onFx?.({ kind: isLance(w) ? 'lance' : 'battery', from: [ship], to: { ...o.pos }, dice: n, hits, side: ship.side, shots: [{ ship, weapon: ship.profile.weapons.indexOf(w), str: n }] })
  say(game, `${ship.name} fires its ${w.loc} ${w.kind} at a ${o.kind} marker: ${text}rolled ${fmt(dice)}, needed ${need}+: ${hits ? 'hit, the marker is removed' : 'missed'}`)
  if (hits) { game.ordnance = game.ordnance.filter(x => x !== o); if (o.kind === 'mine' && o.purchased) { game.minesLost ??= [0, 0]; game.minesLost[o.side]++ } }
  return { kind: 'ordnance', hits }
}

// ---------------- the sunburst cannon ----------------
export const SUNBURST = { outer: 2.5, hole: 0.6 }   // a 5 cm template with a 1.2 cm hole
/**
 * Fire the sunburst cannon at point `at`. The template's edge must be 30-150 cm from the ship and in its front arc.
 * Every ship that might be hit may brace first. Scatter: under 45 cm 1D6 cm, 45-60 cm 2D6, over 60 cm 3D6,
 * unless the scatter dice shows a hit. Touched: 1 hit; under the hole: D6 hits; shields work. Ordnance touched
 * is removed. A miss leaves one Blast Marker.
 */
export function fireSunburst (game, ship, at) {
  const no = mayFire(game, ship, { sunburst: true })
  const w = ship.profile.weapons.find(x => x.kind === 'sunburst')
  const refuse = r => ({ ok: false, reason: say(game, `${ship.name} can't fire its sunburst cannon: ${r}`) })
  if (!w) return refuse('it has none')
  if (no) return refuse(no)
  if (ship.sunburstFired) return refuse('it has already fired it this phase')
  if (ship.order && ORDERS[ship.order.kind].halves) return refuse(`not on ${ORDERS[ship.order.kind].name} orders`)
  if (isCrippled(ship)) return refuse('crippled ships can\'t fire it')
  if (ship.grappled) return refuse('a ship in the grip of Massive Claws cannot fire sunburst cannon')
  if (!weaponWorks(ship, w)) return refuse('its prow armament is damaged')
  const d = dist(ship.pos, at)
  if (d - SUNBURST.outer < w.minRange - 1e-6 || d - SUNBURST.outer > w.range + 1e-6) return refuse(`the template's edge must be ${w.minRange}-${w.range} cm away`)
  if (!arcsContaining(ship.pos, ship.facing, at).includes('front')) return refuse('it fires into the front arc only')
  if (inAsteroids(game, ship.pos)) return refuse('sunburst cannons don\'t work inside an asteroid field')
  const lof = lineOfFire(game, ship.pos, at)
  if (lof) return refuse(`it is a line of sight weapon: ${lof}`)
  ship.sunburstFired = true
  if (!lowOrbitFires(game, ship, 'sunburst cannon')) return { ok: true, results: [] }   // in low orbit it needs a 4+ to fire
  const scatterMax = d < 45 ? 6 : d <= 60 ? 12 : 18
  for (const t of onTable(game)) if (t.side !== ship.side && dist(t.pos, at) <= SUNBURST.outer + baseR(t) + scatterMax) offerBrace(game, t, { by: ship, what: 'sunburst cannon', key: `sunburst-${ship.uid}-${game.round}` })
  const sc = scatter(game.rng)
  let p = at
  if (sc.hit) say(game, `${ship.name} fires its sunburst cannon ${Math.round(d)} cm: the scatter dice shows a hit, the shell lands where aimed`)
  else {
    const n = d < 45 ? 1 : d <= 60 ? 2 : 3, rd = rollDice(game.rng, n), by = sum(rd)
    p = along(at, sc.angle, by)
    say(game, `${ship.name} fires its sunburst cannon ${Math.round(d)} cm: it scatters ${by} cm (${n}D6 rolled ${fmt(rd)}) towards ${sc.angle}°`)
  }
  game.onFx?.({ kind: 'sunburst', from: [ship], to: { ...p } })
  let any = false
  for (const t of onTable(game)) {
    const gap = dist(t.pos, p)
    if (gap > SUNBURST.outer + baseR(t)) continue
    any = true
    // A mirage field saves against the SHELL hit (under the hole or touched by the template), once;
    // if it saves, the shot does nothing but leave a Blast Marker; if not, roll the damage with no further save
    if (fieldOf(t) && !fieldSave(game, t, 1, { what: 'sunburst cannon shell', from: p, by: ship, braceAsked: true }).through) { say(game, `${t.name}: the sunburst cannon has no effect`); continue }
    let hits = 1
    if (gap <= SUNBURST.hole + baseR(t)) { hits = d6(game.rng); say(game, `${t.name} is under the centre hole: D6 rolled ${hits} hits`) } else say(game, `${t.name} is touched by the blast: 1 hit`)
    hitWithShields(game, t, hits, p, 'the sunburst cannon')
  }
  const before = game.ordnance.length
  game.ordnance = game.ordnance.filter(o => dist(o.pos, p) > SUNBURST.outer + o.r)
  if (game.ordnance.length < before) say(game, `${before - game.ordnance.length} ordnance marker(s) caught in the blast are removed`)
  if (!any) { say(game, 'The sunburst cannon touches no ship: one Blast Marker is left'); placeBlastCluster(game, p, 1) }
  return { ok: true, at: p }
}
