// The game state of a VOID WARS: Fleets battle, the ships in it, Resolve, special orders, Blast Markers and
// the turn sequence. Pure data and rules: nothing here knows about pixels or the screen.
// Exports createGame, addShip, say, giveOrder, leadershipTest, the Blast Marker helpers, the ship-state tests
// (isEscort, isCrippled, isBraced...) and the table sizes. Nearly every other rules module and the battle page import it;
// modules that game.js itself needs but which import it register themselves on `late` to avoid a circular import.
//
// Every roll is written to game.log with what was rolled and what was needed (the rolls are the game: the player
// must be able to follow every result). Choices the defending player makes in the attacker's turn (Brace For
// Impact!) are asked through game.decide, which the screen supplies; tests supply their own.
import { shipById } from '../data/ships.js'
import { raceRule } from '../data/raceRules.js'
import { isReactive, hasOssuary } from './hull.js'   // Katharos reactive hulls and Ossuary
import { createRng, rollDice, sum, d6 } from './dice.js'
import { dist, segPointDist, along, angleTo } from './geometry.js'
import { cloudsTouching, cloudInTheWay } from './terrain.js'

// ---------------- sizes ----------------
// Small bases are 32 mm across, large 60 mm. A ship with 3 or more shields or more than 10 hits
// must use a large base. Bases are treated as circles.
export const BASE_R = { small: 1.6, large: 3.0 }
// A Blast Marker is a 2 cm circle (the game's own size).
export const BLAST_R = 1.0
// A 180 x 120 cm table.
export const TABLE = { w: 180, h: 120 }
// TIDES OF THE ARCHIPELAGO: the sea's open battles (Cruiser Duel, Fleet
// Engagement) are fought on a table half as big again, so the 4x ships and the islands have room. The scenarios keep TABLE.
export const SEA_TABLE = { w: 270, h: 180 }
const EPS = 1e-6

/** Functions other modules register so this one can call them without a circular import (damage.js sets damageShip). */
export const late = {}
export const isEscort = s => s.profile.type === 'escort'
/** Upgrades a list gave this ship (data/fleetLists.js): 'soulship', 'discipline', 'huntseer', 'vampires', 'tbombers'. */
export const hasUp = (s, id) => (s.upgrades ?? []).includes(id)
/** A Soulship, a Penthos vessel run by spirit stones. */
export const isGhost = s => hasUp(s, 'soulship')
export const isCapital = s => !isEscort(s)
export const baseR = s => BASE_R[s.profile.shields >= 3 || s.profile.hits > 10 || s.profile.type === 'defence' || s.profile.base === 'large' ? 'large' : 'small']

// ---------------- ship special rules, read from the profile text ----------------
// The `special` lines in src/data/ships.js state each class's special rules; these read them so there is one source.
const specials = s => (s.profile.special || []).join(' ')
export const noNewHeading = s => /Come to New Heading/i.test(specials(s))                 // e.g. Sovereign
export const extraAheadFull = s => { const m = specials(s).match(/\+(\d*)D6 cm on All Ahead Full/i); return m ? (+m[1] || 1) : 0 }   // e.g. Adder, Faithless
export const noLongRangeShift = s => /No column shift for firing over 30 cm/i.test(specials(s))  // Apostate
export const leadershipBonus = s => /\+1 Resolve/i.test(specials(s)) ? 1 : 0              // Sovereign sensor probes

// ---------------- the game ----------------
/**
 * A new, empty battle. fleets: two { name, fleet: 'freemen' | 'dominion' }. decide: the players' choices made outside
 * their own turn — brace(game, ship, attack) -> boolean; repair(game, ship, crits) -> crit key to fix first.
 */
export function createGame ({ fleets, seed = 1, rounds = 8, decide = {} }) {
  return {
    seed, rng: createRng(seed), table: { ...TABLE }, rounds,
    sides: fleets.map(f => ({ ...f })),
    ships: [], blast: [], ordnance: [], terrain: [], squadrons: [], nextId: 1,
    round: 0, first: 0, active: 0, phase: 'setup', ordersFailed: [false, false],
    decide: { brace: () => false, repair: null, reroll: () => false, rerollAttacks: () => false, honourDie: () => 0, steerTorpedo: () => 0, annihilatorForgo: () => 0, ...decide },
    // Fleet Commander re-rolls: per side, how many are left and the flagship that holds them
    rerolls: fleets.map(() => ({ left: 0, flagship: null })),
    log: [], over: false,
  }
}

export function say (game, text) {
  game.log.push({ round: game.round, side: game.active, phase: game.phase, text })
  return text
}
const fmt = dice => dice.join(', ')
export { fmt as diceText }

/** Add a ship of profile `id` for side `side`. It is not on the table until placed (pos set). */
// opts: ship flags the fleet builder sets. vampires: Lamia raiders; torpedoBombers; mines: bays carry orbital mines
export function addShip (game, side, id, { name, vampires, torpedoBombers, mines } = {}) {
  const profile = shipById(id)
  if (!profile) throw new Error(`no ship called ${id}`)
  const ship = {
    uid: game.nextId++, side, id, profile, name: name ?? profile.name,
    pos: null, facing: 0, leadership: null,
    damage: 0, crits: { dorsal: 0, starboard: 0, port: 0, prow: 0, engine: 0, fire: 0, thrusters: 0, bridge: 0, shields: 0, lances: 0, main: 0, bays: 0, reactors: 0, orbit: 0 },
    order: null, braceNoOrdersRound: null, loaded: { torpedo: true, bays: true },
    moved: null, movedThisPhase: false, fired: false, state: 'active',
    boarding: null, lockedWith: null, noFireRound: null,
    ...(vampires ? { vampires } : {}), ...(torpedoBombers ? { torpedoBombers } : {}), ...(mines ? { mines } : {}),
  }
  game.ships.push(ship)
  GAME_OF.set(ship, game)
  return ship
}

// Starting Resolve, D6 — 1 Untried (6), 2-3 Experienced (7), 4-5 Veteran (8), 6 Crack (9).
export const LEADERSHIP_TABLE = [null, 6, 7, 7, 8, 8, 9]
const LD_NAME = { 6: 'Untried', 7: 'Experienced', 8: 'Veteran', 9: 'Crack' }
// Athanatoi ships get +1 on the Resolve table, so 7 to 10.
// Rolled with the Athanatoi for a single ship or an escort squadron alike; still capped at 10 by leadershipOf.
export const tableBonus = ship => (ship.profile.fleet === 'athanatoi' ? 1 : 0) + (raceRule(ship.profile.fleet).ldPlus ?? 0) - (raceRule(ship.profile.fleet).ldMinus ?? 0)   // Thnitoi +1 too // Athanatoi +1; Rukka ships -1 (5 to 8)
const bonusText = plus => plus > 0 ? ` (+${plus} for Athanatoi ships, / Thnitoi)` : plus < 0 ? ` (${plus} for Rukka ships)` : ''
// A Concord ship (the Concord) rolls on its own table, Ld 8-10 (data/raceRules.js)
const tableOf = ship => raceRule(ship.profile.fleet).leadership ?? LEADERSHIP_TABLE
export function rollLeadership (game, ship) {
  const r = d6(game.rng), plus = tableBonus(ship), T = tableOf(ship)
  ship.leadership = T[r] + plus - (ship.profile.role === 'transport' ? 1 : 0)   // Transports one lower
  if (hasOssuary(ship)) ship.leadership = 10   // A ship carrying an Ossuary automatically receives Resolve 10
  if (ship.profile.fixedLd) { ship.leadership = ship.profile.fixedLd; say(game, `${ship.name}: Resolve is always ${ship.profile.fixedLd}`) }
  say(game, `${ship.name}: Resolve roll ${r}${T === LEADERSHIP_TABLE ? ' — ' + LD_NAME[T[r]] : ' (Concord table)'}, Resolve ${ship.leadership}${bonusText(plus)}${ship.profile.role === 'transport' ? ' (a transport, one lower)' : ''}`)
  return ship.leadership
}

// ---------------- state helpers ----------------
export const onTable = game => game.ships.filter(s => s.pos && (s.state === 'active' || s.state === 'drifting' || s.state === 'blazing'))
export const active = game => game.ships.filter(s => s.pos && s.state === 'active')
export const isHulk = s => s.state === 'drifting' || s.state === 'blazing'
export const shipByUid = (game, uid) => game.ships.find(s => s.uid === uid)
export const enemiesOf = (game, ship) => active(game).filter(s => s.side !== ship.side)
export const remainingHits = s => Math.max(0, s.profile.hits - s.damage)
// A ship which loses half its damage points is crippled (a Lantern, 8 hits, at 4 damage).
export const isCrippled = s => s.damage >= s.profile.hits / 2 && !s.profile.hulk   // A Rukka hulk is never crippled
/** The Pall class light cruiser. */
export const isPall = s => s.id === 'kat-pall'
const half = n => Math.ceil(n / 2)   // Halving rounds up

/** Resolve now: rolled value, Sovereign +1, Bridge Smashed -3 each, never above 10. */
// A Dominion Derelict is always -1 Resolve, after every other modifier and bonus (the Harrow Admiral's too)
export const leadershipOf = s => Math.min(10, s.leadership + leadershipBonus(s) + mobRule(s) - 3 * s.crits.bridge) - (s.id === 'spacehulk' ? 1 : 0)
// (Mob Rule): a Rukka escort gang of the Firms list has +1 Resolve while it contains more than five models. The ship finds its game here
// (a WeakMap, so the ship stays plain data for the replay's structuredClone, battle/replay.js).
const GAME_OF = new WeakMap()
/** The game a ship belongs to (for the few rules that need it from a bare ship, e.g. a fort's quadrants). */
export const gameOfShip = s => GAME_OF.get(s)
function mobRule (s) {
  if (!s.mobRule) return 0
  const g = GAME_OF.get(s), q = g?.squadrons.find(x => x.uids.includes(s.uid))
  return q && q.uids.filter(u => g.ships.find(x => x.uid === u)?.state === 'active').length > 5 ? 1 : 0
}

/** A Phage ship's brood cysts (the profile's `spores`), none while Brood cysts injured or ruptured. */
export const isPhageShip = s => s?.profile?.fleet === 'phage'
export const sporesOf = s => isPhageShip(s) && !isHulkState(s) && !s.crits.sporesHurt && !s.crits.sporesGone ? s.profile.spores ?? 0 : 0
const isHulkState = s => s.state === 'drifting' || s.state === 'blazing'
// Crippled halves shields; Shields Collapse: shields 0. Hulks have none.
export function shieldsOf (s) {
  if (isHulk(s) || s.crits.shields) return 0
  if (isPhageShip(s)) return sporesOf(s)   // Spore clouds are the Phage's shields; crippling does not touch them
  const n = isCrippled(s) ? half(s.profile.shields) : s.profile.shields
  return s.crits.reactors ? half(n) : n   // A defence's Reactors Damaged halves shields and turrets
}
// Crippled halves turrets: a hulk's turrets are 0.
export const turretsOf = s => { if (isHulk(s)) return 0; if (isPhageShip(s)) return sporesOf(s);   // Brood cysts count as turrets against ordnance, and crippling does not touch them
  const n = isCrippled(s) ? half(s.profile.turrets) : s.profile.turrets; return s.crits.reactors ? half(n) : n }

// ---------------- squadrons ----------------
// game.squadrons: [{ id, side, name, uids }]. A ship not in one acts alone (a squadron of one).
export const squadronOf = (game, ship) => game.squadrons.find(q => q.uids.includes(ship.uid)) ?? null
/** The ships of `ship`'s squadron still fighting on the table (itself included), or just itself. */
export function mates (game, ship) {
  const q = squadronOf(game, ship)
  return q ? q.uids.map(u => shipByUid(game, u)).filter(s => s && s.pos && s.state === 'active') : [ship]
}
/** Form a squadron. Escorts in squadrons (2-6), capital ships declared before the battle. */
export function formSquadron (game, uids, name) {
  const q = { id: game.nextId++, side: shipByUid(game, uids[0]).side, name, uids: [...uids] }
  game.squadrons.push(q)
  return q
}
/** An escort squadron rolls Resolve once and shares it. */
export function rollSquadronLeadership (game, q) {
  const lead = shipByUid(game, q.uids[0]), r = d6(game.rng), base = tableOf(lead)[r], plus = tableBonus(lead), ld = base + plus - (lead.profile.role === 'transport' ? 1 : 0)   // Athanatoi +1
  for (const u of q.uids) { const x = shipByUid(game, u); x.leadership = hasOssuary(x) ? 10 : ld }   // Ossuary = Resolve 10
  say(game, `${q.name}: Resolve roll ${r}${tableOf(lead) === LEADERSHIP_TABLE ? ' — ' + LD_NAME[base] : ' (Concord table)'}, Resolve ${ld} for the whole squadron${bonusText(plus)}`)
}

// ---------------- special orders ----------------
export const ORDERS = {
  aheadFull: { name: 'All Ahead Full', halves: true },
  newHeading: { name: 'Come to New Heading', halves: true },
  burnRetros: { name: 'Burn Retros', halves: true },
  lockOn: { name: 'Lock On', halves: false },
  reload: { name: 'Reload Ordnance', halves: false },
  brace: { name: 'Brace for Impact!', halves: true },
}
export const orderOf = s => s.order?.kind ?? null
/** A number for each player turn in order (the first player's turn of round 1 is 2, the second's 3, ...), for "until the end of their next turn". */
export const turnIndex = game => game.round * 2 + (game.active === game.first ? 0 : 1)
/**
 * A ship whose crew failed the Ossuary's Resolve Test can take no special orders, Brace for Impact included, until its next
 * turn is over. `noOrdersTurn` is the turnIndex of the end of that next turn.
 */
export const ordersBarred = (game, s) => s.noOrdersTurn != null && turnIndex(game) <= s.noOrdersTurn
/** Mark `s` as barred from orders through its own next turn (set when the Ossuary is used in the attacker's turn). */
export function barOrdersThroughNextTurn (game, s) {
  let t = turnIndex(game) + 1
  while (((t % 2 === 0) ? game.first : 1 - game.first) !== s.side) t++
  s.noOrdersTurn = t
}
export const isBraced = s => orderOf(s) === 'brace'

/** How many times this ship's weapons batteries and lances are halved now (orders: crippled; cumulative). */
export function weaponHalvings (s) {
  return (s.order && ORDERS[s.order.kind].halves && !tenacious(s) ? 1 : 0) + (isCrippled(s) ? 1 : 0) + (s.grappled ? 1 : 0)   // Both ships in a Massive Claws grip shoot at half effectiveness
}
/** Tenacity refit: burning acid batteries and searbile fire at full strength under any of the three halving orders
 * (All Ahead Full, also Burn Retros, also Come to New Heading). (Applied to the whole ship's guns: the other kinds in the Phage fleet are contact weapons.) */
const tenacious = s => hasUp(s, 'tenacity') && ['aheadFull', 'burnRetros', 'newHeading'].includes(s.order?.kind)
/** Ordnance is halved only by Brace for Impact! and crippling. */
export const ordnanceHalvings = s => (isBraced(s) ? 1 : 0) + (isCrippled(s) ? 1 : 0)
export function halved (n, times) { for (let i = 0; i < times; i++) n = half(n); return n }

// Under fire (Blast Marker in contact) -1; enemy contacts (any enemy on special orders) +1.
export function commandModifiers (game, ship) {
  // A squadron is under fire if any of its ships has Blast Markers touching
  // Improved Logic Engines: Blast Markers in contact do not lower the ship's Resolve
  // A reactive hull is immune to Resolve modifiers from blast markers
  const under = !hasUp(ship, 'ile') && !isReactive(ship) && mates(game, ship).some(m => blastTouching(game, m).length > 0) ? -1 : 0
  // An uncrippled Pall never gives the enemy the bonus for being on special orders; and while any uncrippled Pall is on the table the whole
  // Katharos fleet gets an extra +1 whenever any enemy vessel is on special orders.
  const onOrders = enemiesOf(game, ship).filter(e => e.order && !(isPall(e) && !isCrippled(e)))
  const contacts = onOrders.length ? 1 : 0
  const pallSees = enemiesOf(game, ship).some(e => e.order) && isReactive(ship) && active(game).some(x => x.side === ship.side && isPall(x) && !isCrippled(x)) ? 1 : 0
  return { under, contacts, pall: pallSees, total: under + contacts + pallSees }
}

/**
 * A Resolve Test: roll `dice` D6 (2 unless said otherwise), pass on a total equal to or under Resolve.
 * Resolve never above 10, and a roll of 11 or 12 always fails. Returns { pass, roll, dice, need }.
 */
export function leadershipTest (game, ship, { dice = 2, modifier = 0, why, page, reroll = true, command = false, ld: ldBase } = {}) {
  const sl = raptureNear(game, ship)
  if (sl) say(game, `${ship.name} is within 15 cm of ${sl.name}, which bears the Rapture Protocol: Resolve -2`)
  // A radiation burst's interference lowers every ship's Resolve for the rest of the turn
  const rad = game.effects?.radiation?.round === game.round && !isReactive(ship) ? game.effects.radiation.level : 0   // Reactive hulls are immune to radiation
  if (rad) say(game, `${ship.name}: radiation interference, Resolve -${rad} this turn`)
  const hook = game.hooks?.ldMod?.(game, ship)   // a scenario's own Resolve change (The Corsairs)
  if (hook) say(game, `${ship.name}: ${hook.why}, Resolve ${hook.mod > 0 ? '+' : ''}${hook.mod}`)
  const ld = Math.min(10, (ldBase ?? leadershipOf(ship)) + modifier + (sl ? -2 : 0) + (hook?.mod ?? 0) - psychicScream(game, ship)) - rad   // ldBase: the Phage's own Resolve rules
  const hordes = ship.hordes ?? 0   // Each horde of sprogs on the hull adds a D6 to the ship's next Resolve check or special order
  if (hordes) { dice += hordes; say(game, `${ship.name}: ${hordes} horde${hordes === 1 ? '' : 's'} of sprogs on the hull, ${dice} dice for this test`) }
  const roll = () => {
    const rolled = rollDice(game.rng, dice), total = sum(rolled)
    return { pass: total <= ld, total, dice: rolled, need: ld }   // capped at 10, so 11 and 12 always fail
  }
  // A Hunger Imperative passes a Command check or Resolve Test automatically; the decision is taken before the dice are rolled
  const imp = game.imperatives?.[ship.side]
  if (imp?.left > 0 && game.decide.imperative?.(game, ship, { why, need: ld, command })) {
    imp.left--
    say(game, `${ship.name}: ${why} — a Hunger Imperative is used (${imp.left} left): the test is passed automatically`)
    return { pass: true, total: 0, dice: [], need: ld, imperative: true }
  }
  let t = roll()
  say(game, `${ship.name}: ${why} — Resolve Test on ${dice}D6, rolled ${fmt(t.dice)} = ${t.total}, needed ${ld} or less: ${t.pass ? 'passed' : 'failed'}`)
  // A re-roll may be spent on a failed Command check or Resolve Test, one per test
  if (!t.pass && reroll) {
    const pool = rerollFor(game, ship, { command })
    if (pool && game.decide.reroll(game, ship, { why, need: ld, total: t.total, pool: pool.name })) {
      pool.spend()
      t = { ...roll(), rerolled: true }
      say(game, `${ship.name}: ${pool.name} re-roll spent (${pool.left()} left) — rolled ${fmt(t.dice)} = ${t.total}, needed ${ld} or less: ${t.pass ? 'passed' : 'failed'}; the second roll stands`)
    }
  }
  return t
}

// ---------------- re-rolls and Warden Protocols ----------------
export const hasMark = (s, m) => (s.marks ?? []).includes(m)
/**
 * The re-roll this ship may spend, or null. A Harrow Lord's own re-roll (Cipher Protocol) only for his ship or its
 * squadron, spent first; else the fleet's.
 */
export function rerollFor (game, ship, { command = false } = {}) {
  const own = mates(game, ship).find(m => m.rerolls > 0) ?? (ship.rerolls > 0 ? ship : null)
  if (own) return { name: `${own.commander ?? own.name}'s own`, spend: () => own.rerolls--, left: () => own.rerolls }
  const wl = game.ships.find(w => w.side === ship.side && w.state === 'active' && w.gafferRerolls > 0 && w.command?.includes(ship.uid))   // A Firms Gaffer's re-rolls are for the gangs under his command only
  if (wl) return { name: `${wl.name}'s Gaffer`, spend: () => wl.gafferRerolls--, left: () => wl.gafferRerolls }
  const fp = ship.fort && late.fort?.(game, ship)
  if (fp && fp.rerolls > 0) return { name: 'the fort\'s own', spend: () => fp.rerolls--, left: () => fp.rerolls }   // One re-roll (bought, for the Host Keep) for the whole fort
  const fs = huntseerFor(game, ship)
  if (fs) return { name: `${fs.name}'s Huntseer`, spend: () => fs.huntseer.left--, left: () => fs.huntseer.left }
  const f = game.rerolls?.[ship.side]
  // During a radiation burst, Fleet Commanders' re-rolls only for Command checks on their own ship or squadron
  if (f && game.effects?.radiation?.round === game.round && !(command && mates(game, ship).some(m => m.uid === f.flagship))) return null
  if (f && f.left > 0) return { name: f.name ?? (f.flagship == null ? 'The fleet\'s' : 'Fleet Commander'), spend: () => f.left--, left: () => f.left }
  return null
}
/**
 * A Huntseer gives its ship one re-roll, for that ship, a capital ship in its squadron or an escort squadron
 * up to 15 cm away. Returns the ship that carries a Huntseer with a re-roll left that can serve `ship`, or null.
 */
export function huntseerFor (game, ship) {
  return game.ships.find(f => f.side === ship.side && f.state === 'active' && f.pos && f.huntseer?.left > 0 && (
    f === ship ||
    (isCapital(ship) && isCapital(f) && squadronOf(game, f) && squadronOf(game, f) === squadronOf(game, ship)) ||
    (isEscort(ship) && f.pos && ship.pos && mates(game, ship).some(m => dist(m.pos, f.pos) <= 15 + EPS)))) ?? null
}
/** Mind Scream, enemies within 15 cm of the ship are -2 Resolve. */
export function psychicScream (game, ship) {
  if (!ship.pos || !game.ships.some(h => h.side !== ship.side && h.state === 'active' && h.pos && hasUp(h, 'scream') && dist(h.pos, ship.pos) <= 15 + EPS)) return 0
  say(game, `${ship.name} is within 15 cm of a ship with Mind Scream: Resolve -2`)
  return 2
}
/** The nearest queen ship of the ship's side within `range` cm (default 45), or null. */
export function hiveNear (game, ship, range = 45) {
  if (!ship.pos) return null
  return game.ships.filter(h => h.side === ship.side && h.state === 'active' && h.pos && h.profile.hive && dist(h.pos, ship.pos) <= range + EPS).sort((a, b) => dist(a.pos, ship.pos) - dist(b.pos, ship.pos))[0] ?? null
}
/** Enemy ships within 15 cm of a ship with the Rapture Protocol are -2 Resolve, whatever is in the way. */
export function raptureNear (game, ship) {
  if (!ship.pos) return null
  return active(game).find(e => e.side !== ship.side && hasMark(e, 'rapture') && dist(e.pos, ship.pos) <= 15 + EPS) ?? null
}

/** All Ahead Full adds 4D6 cm; some classes more (Adder, Faithless); transports 3D6. */
// Rukka ships roll 2D6 on All Ahead Full: Souped-Up Engines (the profile's own aheadFullDice) 4D6; Big Boostas 4D6 too
export const aheadFullDice = ship => (hasUp(ship, 'big') ? 4 : ship.profile.aheadFullDice ?? raceRule(ship.profile.fleet).aheadFullDice ?? (ship.profile.role === 'transport' ? 3 : 4 + extraAheadFull(ship))) + (hasUp(ship, 'adrenaline') ? 1 : 0)   // Adrenaline Sacs +1D6
/**
 * What All Ahead Full adds: dice and a multiplier in cm. 4D6 cm. Null-Mass Drive: a Katharos ship adds D6 x 10 cm instead and
 * may turn once per 20 cm moved; the rest of All Ahead Full works as usual.
 */
export const aheadFullSpec = ship => ship.profile.noAheadFullMove ? { dice: 0, mult: 1 } : isReactive(ship) ? { dice: 1, mult: 10 } :   // A Rukka hulk's All Ahead Full gives no extra movement, only the chance to ram
  { dice: aheadFullDice(ship), mult: 1 }
/** The Resolve Test to ram: 3D6 at a smaller type, 2D6 the same, 1D6 a bigger. */
export function ramTestDice (ship, target) {
  const size = { escort: 0, cruiser: 1, battleship: 2, defence: 3 }
  const mine = size[ship.profile.type], theirs = size[target.profile.type]
  return theirs < mine ? 3 : theirs === mine ? 2 : 1
}

/**
 * Put a ship on a special order: take a Command check. Only in its own Manoeuvre Phase before it moves,
 * except Brace for Impact! (any time it faces damage). Once a Command check fails no more orders that turn
 * except Brace. opts.ram: for All Ahead Full, the ship it will try to ram (declared before the extra speed).
 */
export function giveOrder (game, ship, kind, opts = {}) {
  const o = ORDERS[kind]
  if (!o) throw new Error(`no special order called ${kind}`)
  const why = reason => ({ ok: false, reason: say(game, `${ship.name} can't go on ${o.name}: ${reason}`) })
  if (ship.state !== 'active') return why('it is not an active ship')
  if (ordersBarred(game, ship)) return why('its crew was shaken by an Ossuary: no special orders, Brace for Impact! included, until after the end of its next turn')
  if (ship.braceNoOrdersRound === game.round && ship.side === game.active) return why('it braced last turn, so it can take no special orders this turn')
  if (ship.braceNoOrdersRound != null && kind === 'brace' && isBraced(ship)) return why('it is already braced')
  if (ship.disengageFailedRound === game.round && kind !== 'brace') return why('it failed to disengage this turn')
  // Planetary defences take no special orders but Reload Ordnance and Brace for Impact!, on Resolve 7
  if (ship.profile.fleet === 'defence' && !ship.profile.fort && !['reload', 'brace'].includes(kind)) return why('planetary defences take only Reload Ordnance and Brace for Impact!')
  if (ship.fort && !['reload', 'lockOn', 'brace'].includes(kind)) return why('a fort takes only Reload Ordnance, Lock On and Brace for Impact!')
  if (kind !== 'brace') {
    if (ship.standby) return why('it is on standby: only Brace for Impact!')
    if (ship.alertRound === game.round) return why('it went on alert this turn, so no special orders')
    if (game.phase !== 'movement' || ship.side !== game.active) return why('special orders are given in your own Manoeuvre Phase')
    if (ship.movedThisPhase) return why('orders are given before the ship moves')
    if (ship.order) return why(`it is already on ${ORDERS[ship.order.kind].name} (one order at a time)`)
    if (game.ordersFailed[ship.side] && !isPhageShip(ship) && !(kind === 'newHeading' && raceRule(ship.profile.fleet).autoNewHeading && !ship.crits.manoeuvre)) return why('a Command check has already failed this turn')   // the Phage's checks are the queen ships' own
    if (kind === 'aheadFull' && ship.crits.nullmass) return why('its Null-Mass Drive is damaged: no All Ahead Full until repaired')
    if (kind === 'newHeading' && noNewHeading(ship)) return why('this class cannot use Come to New Heading')
    // No Come to New Heading or Burn Retros; it moves exactly 10 cm, so All Ahead Full can't apply either
    if ((ship.profile.hulk || ship.profile.lump) && kind === 'burnRetros') return why('a derelict may not use Burn Retros')
    if (ship.id === 'spacehulk' && ['burnRetros', 'aheadFull'].includes(kind)) return why(kind === 'burnRetros' ? 'a derelict may not use Burn Retros' : 'a derelict moves exactly 10 cm, no more')
    if (ship.lockedWith) return why('it is locked in a boarding action')
    // The Athanatoi never ram and have none of the orders All Ahead Full, nor Burn Retros, nor Come To New Heading
    // Thnitoi cruisers (not escorts) cannot Burn Retros; a lamprey torpedo hit forbids All Ahead Full
    if (kind === 'burnRetros' && raceRule(ship.profile.fleet).noMinMove && !isEscort(ship)) return why('Thnitoi cruisers cannot use Burn Retros')
    if (kind === 'aheadFull' && ship.crits.leech) return why('a lamprey torpedo is fastened to it: no All Ahead Full until every leech hit is repaired')
    if (ship.profile.sail && ['aheadFull', 'burnRetros', 'newHeading'].includes(kind)) return why('the Athanatoi sail by the sun: no All Ahead Full, no Burn Retros, no Come To New Heading, so no ramming either')
  }
  let ram = null
  if (kind === 'aheadFull' && opts.ram != null) {
    ram = shipByUid(game, opts.ram)
    if (!ram || ram.side === ship.side || ram.state !== 'active') return why('the ram target must be an enemy ship')
  }
  // One Command check for the whole squadron, on the highest Resolve left in it; every ship takes the order
  const squad = ship.fort && opts.together?.length ? [ship, ...opts.together] : mates(game, ship)   // Split orders, one Command check for a pair of quadrants
  if (kind !== 'brace' && squad.some(x => x.movedThisPhase || (x.order && x.order.kind !== kind))) return why('a squadron takes its order before any of its ships moves')
  // Superstructure Damaged: roll a D6 each time the ship tries a special order; a 1 costs it one more damage point.
  if (ship.crits.superOrders) {
    const r = d6(game.rng)
    say(game, `${ship.name}: Superstructure Damaged, rolled ${r} for attempting special orders; a 1 is one more damage point`)
    if (r === 1) late.damageShip?.(game, ship, 1, { what: 'a strained superstructure', noCrits: true, noSave: true })
  }
  const leader = squad.reduce((a, b) => leadershipOf(b) > leadershipOf(a) ? b : a, ship)
  const m = commandModifiers(game, ship)
  // After one Soulship fails a Command check, no more Command checks for other Soulships that turn (crewed vessels may still try)
  if (isGhost(ship) && kind !== 'brace' && game.ghostFailed?.[ship.side] === game.round) return why('a Soulship has already failed a Command check this turn, so no more Command checks for Soulships')
  // A Phage ship has no Resolve of its own. Under synaptic control (a queen ship passed its Command check this turn) it may go on special orders "without
  // requiring a second command check"; Brace For Impact tests against the nearest queen ship within 45 cm, or a default 7.
  const ph = isPhageShip(ship), hv = ph && kind === 'brace' ? hiveNear(game, ship) : null
  if (ph && kind !== 'brace' && ship.control?.round !== game.round) return why('it follows Lost Scent unless a queen ship takes control of it')
  const phageFree = ph && kind !== 'brace' ? (say(game, `${ship.name} is under synaptic control: ${o.name} needs no second Command check`), { pass: true, total: 0, dice: [], need: 0 }) : null
  const phageLd = ph && kind === 'brace' ? { ld: hv ? leadershipOf(hv) : raceRule('phage').defaultLd } : {}
  // Rukka take All Ahead Full with no Command check; a failed check earlier this turn still bars it (the "a Command check has already failed" refusal above)
  // Thnitoi ships pass the Command check for Come to New Heading automatically, so the check is not rolled and a failed check earlier in the turn does not stop it;
  // After Manoeuvring Systems Damaged they must pass one
  const darkFree = kind === 'newHeading' && raceRule(ship.profile.fleet).autoNewHeading && !ship.crits.manoeuvre ? (say(game, `${ship.name}: Thnitoi ships pass the Command check to Come to New Heading automatically`), { pass: true, total: 0, dice: [], need: 0 }) : null
  const rukkaFree = kind === 'aheadFull' && raceRule(ship.profile.fleet).freeAheadFull ? (say(game, `${ship.name}: Rukka ships need no Command check for All Ahead Full`), { pass: true, total: 0, dice: [], need: 0 }) : null
  // A ship touching a friendly Bastion may Burn Retros with no Command check
  const dockFree = kind === 'burnRetros' && late.fortContact?.(game, ship) ? (say(game, `${ship.name} is in contact with a friendly fort: Burn Retros needs no Command check`), { pass: true, total: 0, dice: [], need: 0 }) : null
  const snake = kind === 'brace' && hasUp(ship, 'snake') ? 1 : 0   // Old School get +1 to the Command check to Brace for Impact!
  const hordesBefore = leader.hordes ?? 0
  const t = phageFree ?? rukkaFree ?? darkFree ?? dockFree ?? leadershipTest(game, leader, { ...phageLd, command: true, modifier: m.total + snake, why: `Command check for ${o.name}${snake ? ', Old School +1' : ''}${m.under ? ', under fire -1' : ''}${m.contacts ? ', enemy contacts +1' : ''}${m.pall ? ', a Pall\'s sensors +1' : ''}` })
  if (hordesBefore) { leader.hordes--; say(game, `${leader.name}: the special order shoves a horde of sprogs out of the airlock, ${leader.hordes} left`) }   // Every special order, even failed, repairs one
  let ghostBrace = false
  if (!t.pass && isGhost(ship)) {
    if (kind === 'brace') {
      // A Soulship that fails can still Brace for Impact, but its next turn is spent only moving
      ghostBrace = true
      say(game, `${ship.name}: the Command check failed, but a Soulship still braces; in its next turn it may do nothing except move`)
    } else {
      // The order fails and the Soulship may only move this turn; this does not stop crewed vessels getting orders
      (game.ghostFailed ??= {})[ship.side] = game.round
      ship.noFireRound = game.round
      say(game, `${ship.name} is a Soulship and failed its Command check: it may do nothing except move this turn, and no other Soulship may be given an order this turn`)
      return { ok: false, test: t, reason: 'Command check failed' }
    }
  } else if (!t.pass) {
    if (!ph) game.ordersFailed[ship.side] = true
    return { ok: false, test: t, reason: 'Command check failed' }
  }
  ship.order = { kind, round: game.round, side: game.active }
  if (squad.length > 1) say(game, `The whole squadron (${squad.length} ships) goes on ${o.name}`)
  if (kind === 'aheadFull') {
    // The ram target and its Resolve Test come before the extra distance is rolled.
    if (ram) {
      const ramPlus = (hasUp(ship, 'terrace') ? 1 : 0) + (hasUp(ship, 'pram') ? 1 : 0)   // Terrace Lot +1 Resolve to ram: Prow Ram +1
      const r = leadershipTest(game, ship, { dice: ramTestDice(ship, ram), modifier: ramPlus, why: `ram ${ram.name}${ramPlus ? `, +${ramPlus} (Terrace / Prow Ram)` : ''}` })
      ship.order.ram = { target: ram.uid, pass: r.pass }
    }
    // Cruising speed +4D6 cm; improved thrusters add more.
    const { dice: extraDice, mult } = aheadFullSpec(ship)
    const extra = rollDice(game.rng, extraDice)
    ship.order.extra = sum(extra) * mult
    say(game, mult > 1 ? `${ship.name}: Null-Mass Drive, D6 x 10 cm rolled ${fmt(extra)} = +${sum(extra) * mult} cm, a turn for every 20 cm it travels` : `${ship.name}: All Ahead Full, +${extraDice}D6 cm rolled ${fmt(extra)} = +${sum(extra)} cm`)
  }
  if (kind === 'reload') for (const x of squad) { x.loaded.torpedo = true; x.loaded.bays = true; x.loaded.tubes = {}; x.harpoonsOut = 0; x.leechLoaded = !!opts.leech }   // Harpoons return; lamprey torpedoes need their own Reload Ordnance
  if (kind === 'reload' && ship.fort) { const f = late.fort?.(game, ship); if (f) f.siloLoaded = true }   // the Basilica's silos count as under every quadrant's orders
  if (kind === 'reload') say(game, `${squad.length > 1 ? 'The squadron' : ship.name}: ordnance reloaded`)
  if (kind === 'brace') braceSet(game, ship)
  if (ghostBrace) ship.noFireRound = ship.order.until   // Nothing but moving in its next turn
  for (const x of squad) if (x !== ship) { x.order = { ...ship.order }; if (kind === 'brace') { x.braceNoOrdersRound = ship.braceNoOrdersRound } }
  return { ok: true, test: t }
}

// Braced until the end of its next turn, and no special orders in that turn.
function braceSet (game, ship) {
  const playsLaterThisRound = game.active !== ship.side && ship.side !== game.first
  const next = game.active === ship.side ? game.round + 1 : playsLaterThisRound ? game.round : game.round + 1
  ship.order.until = next
  ship.braceNoOrdersRound = next
  say(game, isReactive(ship) ? `${ship.name} braces for impact: its reactive hull save becomes 2+ and its armour falls to 4+ until the end of its next turn` : `${ship.name} braces for impact: a 4+ save against each point of damage until the end of its next turn`)
}

/**
 * Before an attack that may damage `ship`, its player may brace: asked through game.decide.brace.
 * `attack` is { by, what, key }: a failed attempt can't be repeated against the same attacker (same key).
 */
export function offerBrace (game, ship, attack) {
  if (ship.state !== 'active' || isBraced(ship)) return isBraced(ship)
  if (ordersBarred(game, ship)) return false
  if (ship.braceFailedKey && ship.braceFailedKey === attack.key) return false
  if (ship.braceNoOrdersRound === game.round && ship.side === game.active && ship.order?.kind !== 'brace') return false
  if (!game.decide.brace(game, ship, attack)) return false
  const prev = ship.order
  ship.order = null
  const r = giveOrder(game, ship, 'brace')
  if (!r.ok) { ship.order = prev; ship.braceFailedKey = attack.key; return false }
  if (prev) ship.order.was = prev   // The old order's effects stay (a ship on All Ahead Full keeps going)
  return true
}

// ---------------- Blast Markers ----------------
// Blast Markers touching a ship's base, and gas/dust clouds touching it: each cloud is the same as a single Blast
// Marker in all respects — shields, Resolve, repairs, boarding, gunnery
// An Athanatoi ship that passed its celestial Resolve check this turn ignores clouds (effects.js cloudCheck)
export const ignoresClouds = (game, ship) => !!ship.cloudOk?.pass && ship.cloudOk.round === game.round
// A fort quadrant counts only the Blast Markers placed against it
export const blastTouching = (game, ship) => [...game.blast.filter(m => dist(m, ship.pos) <= baseR(ship) + BLAST_R + EPS && (!ship.fort || m.q == null || [].concat(m.q).includes(ship.uid))), ...(ignoresClouds(game, ship) ? [] : cloudsTouching(game, ship, baseR(ship)))]
/** Shields are reduced by 1 for each Blast Marker touching the base: they stay down until it moves away. */
export const shieldsLeft = (game, ship) => Math.max(0, shieldsOf(ship) - blastTouching(game, ship).length)

const overlapsMarker = (game, p) => game.blast.some(m => dist(m, p) < 2 * BLAST_R - EPS)
/** Place a Blast Marker touching `ship`'s base: the first on the line towards `from`, the rest fanned round it. */
export function placeBlastOnShip (game, ship, from) {
  const R = baseR(ship) + BLAST_R, a0 = from ? angleTo(ship.pos, from) : 0
  const step = 2 * Math.asin(Math.min(1, BLAST_R / R)) * 180 / Math.PI
  for (let k = 0; k * step <= 180; k++) {
    for (const s of k ? [1, -1] : [1]) {
      const p = along(ship.pos, a0 + s * k * step, R)
      if (!overlapsMarker(game, p)) return tagQ(game, addBlast(game, p), ship, from)
    }
  }
  return tagQ(game, addBlast(game, along(ship.pos, a0, R)), ship, from)   // no room left: stacked (allowed only then)
}
/** Place n Blast Markers: one at `p`, the rest fanned round it without overlapping. */
export function placeBlastCluster (game, p, n) {
  if (n <= 0) return
  addBlast(game, p)
  let placed = 1
  for (let ring = 1; placed < n && ring < 20; ring++) {
    const R = 2 * BLAST_R * ring, step = 2 * Math.asin(Math.min(1, BLAST_R / R)) * 180 / Math.PI
    for (let a = 0; a < 360 - EPS && placed < n; a += step) {
      const q = along(p, a, R)
      if (!overlapsMarker(game, q)) { addBlast(game, q); placed++ }
    }
  }
}
// Fire at a fort quadrant puts Blast Markers only between that quadrant and its neighbour nearest the line of fire: one round of shooting
// can mark at most two quadrants. So a marker counts for the quadrant
// struck, and also for the neighbour on the firer's side if the marker physically touches that neighbour's base; no other quadrant ever counts it.
function tagQ (game, m, ship, from) {
  if (!ship.fort) return m
  m.q = [ship.uid]
  const nb = from && late.fortNeighbour?.(game, ship, from)
  if (nb && dist(m, nb.pos) <= baseR(nb) + BLAST_R + EPS) m.q.push(nb.uid)
  return m
}
function addBlast (game, p) {
  const m = { id: game.nextId++, x: p.x, y: p.y }
  game.blast.push(m)
  return m
}
/** A line of fire through any Blast Marker, or firer or target touching one, shifts gunnery one column right. */
export function blastInTheWay (game, firer, target) {
  return blastTouching(game, firer).length > 0 || blastTouching(game, target).length > 0 ||
    game.blast.some(m => segPointDist(firer.pos, target.pos, m) < BLAST_R - EPS) || cloudInTheWay(game, firer.pos, target.pos)
}
