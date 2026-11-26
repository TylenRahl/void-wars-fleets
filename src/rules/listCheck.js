// Fleet lists as data, read here (data/fleetLists.js): the points of a fleet, whether it is legal, and what its commander, upgrades and
// weapon choices do to the ships once the battle is set up. Exports bayStrength, listContext, extrasPoints, listFleetPoints,
// checkListFleet, listAttackRating, applyPicks, applyListFleet and upgradesFor. fleet.js and the battle screen call these for every
// fleet that has a table in FLEET_LISTS; the Freemen and the Dominion keep the code written for them in fleet.js.
import { shipById } from '../data/ships.js'
import { CLASSES, hasLists, listDef, listsOf, splitShipId } from '../data/fleetLists.js'
import { say, mates } from './game.js'
import { isDiceStr, maxOf } from './dicestr.js'
import { offerLeadershipSwaps } from './rukka.js'
import { applyPhage } from './phage.js'
import { applyFirms } from './firms.js'

/** Launch bay strength of a profile (a bay that has no rule yet is still a bay: `book` holds its real kind). */
export const bayStrength = p => p.weapons.filter(w => (w.book ?? w.kind) === 'bays').reduce((a, w) => a + (isDiceStr(w.str) ? maxOf(w.str) : +w.str || 0), 0)

const matches = (sel, e) => {
  if (sel == null) return true
  if (typeof sel === 'function') return sel(e)
  if (Array.isArray(sel)) return sel.every(x => matches(x, e))
  if (typeof sel === 'string') return sel === 'capital' ? e.capital : e.tags.includes(sel)
  if (sel.cls) return sel.cls.includes(e.cls)
  return false
}

const reserves = (d, list) => list.ships.filter(id => d.ships[splitShipId(list.fleet, id).cls]?.includes('reserve')).length
/** Everything a rule in the table may ask about this fleet. */
export function listContext (list) {
  // a fleet saved before lists existed has no `list`: the first list that has all its ships
  const def = list.list ? listDef(list.fleet, list.list) : (listsOf(list.fleet).filter(d => list.ships.every(id => d.ships[splitShipId(list.fleet, id).cls])).sort((a, b) => reserves(a, list) - reserves(b, list))[0] ?? listDef(list.fleet))
  const ents = list.ships.map((id, i) => {
    const p = shipById(id), { cls } = splitShipId(list.fleet, id), tags = def?.ships[cls]
    return { i, id, cls, picks: list.picks?.[i] ?? splitShipId(list.fleet, id).picks, tags: tags ?? [], known: !!tags, role: p?.role, capital: p?.type !== 'escort', bays: p ? bayStrength(p) : 0, p, ups: [...(list.upgrades?.[i] ?? [])] }
  })
  // A titchy gang pays once for a clan upgrade or Gubbin, and every escort in it has it
  for (const q of list.escortSquadrons ?? []) {
    const members = q.map(i => ents[i]).filter(Boolean), seen = new Set()
    for (const u of def?.upgrades ?? []) if (u.squadron) {
      const has = members.filter(m => m.ups.includes(u.id))
      if (!has.length) continue
      for (const m of members) if (!m.ups.includes(u.id)) m.ups.push(u.id)
      members.forEach(m => { m.paid ??= new Set(); if (seen.has(u.id)) m.paid.add(u.id) ; seen.add(u.id) })
    }
  }
  const cmd = def?.commanders?.options.find(o => o.id === list.commander) ?? null
  const barge = ents.findIndex(e => e.capital && e.tags.includes('barge')), firstCap = barge >= 0 ? barge : ents.findIndex(e => e.capital),   // A Concord Master goes on a host barge in preference
    flame = ents.findIndex(e => e.cls === 'ath-flame')
  const ctx = { list, def, ents, cmd, cmdOn: cmd ? (list.commanderOn ?? (cmd.defaultOn?.(ents) >= 0 ? cmd.defaultOn(ents) : null) ?? (cmd.hero && flame >= 0 ? flame : firstCap)) : null, points: 0,
    n: sel => ents.filter(e => matches(sel, e)).length,
    upCount: id => ents.reduce((a, e) => a + e.ups.filter(u => u === id).length, 0) }
  return ctx
}

const cmdPoints = ctx => !ctx.cmd ? 0 : typeof ctx.cmd.points === 'function' ? ctx.cmd.points(ctx) : ctx.cmd.points
const stepsOf = list => Math.max(0, +(list.rerolls ?? 0) || 0)
const upDef = (def, id) => def.upgrades?.find(u => u.id === id)
const upCost = (u, e) => u ? (u.perBay ? u.perBay * e.bays : typeof u.points === 'function' ? u.points(e) : u.points ?? 0) : 0
/** Points of the weapon choices made on a ship (a choice with a price, e.g. the lance cruiser's lance +20). */
const pickCost = (fleet, e) => (CLASSES[fleet]?.[e.cls]?.options ?? []).reduce((a, o, k) => a + (o.choices[e.picks?.[k] ?? 0]?.points ?? 0), 0)
/** Points of the extras alone (commander, re-rolls and upgrades), for the view and for victory points. */
export function extrasPoints (list) {
  const ctx = listContext(list), c = ctx.cmd
  if (!ctx.def) return 0
  const up = ctx.ents.reduce((a, e) => a + pickCost(list.fleet, e) + e.ups.reduce((b, id) => b + (e.paid?.has(id) ? 0 : upCost(upDef(ctx.def, id), e)), 0), 0)
  const fr = ctx.def.fleetRerolls   // Re-rolls bought by the fleet as a whole
  return (c ? cmdPoints(ctx) + (c.prices[stepsOf(list)] ?? 0) : 0) + (fr ? fr.prices[stepsOf(list)] ?? 0 : 0) + up + (ctx.def.extraPoints?.(list) ?? 0)
}
export function listFleetPoints (list) {
  return list.ships.reduce((a, id) => a + shipById(id).points, 0) + extrasPoints(list)
}

/** The reasons this fleet breaks its own list (empty when legal). Squadron sizes and the points limit are checked by fleet.js. */
export function checkListFleet (list) {
  const ctx = listContext(list), why = [], { def } = ctx
  if (!def) return [`there is no such list for the ${list.fleet}`]
  ctx.points = listFleetPoints(list)
  for (const e of ctx.ents) if (!e.known) why.push(`${e.p?.name ?? e.id} is not in the ${def.name} list`)
  const co = def.commanders
  if (list.commander && !ctx.cmd) why.push('there is no such commander in this list')
  if (co && !ctx.cmd && ctx.points > co.requiredOver && !list.generated) why.push(`a fleet over ${co.requiredOver} points must include a fleet commander`)
  if (ctx.cmd) {
    const on = ctx.ents[ctx.cmdOn]
    if (!on) why.push(`${ctx.cmd.name} must be assigned a ship`)
    else if (!on.capital) why.push(`${ctx.cmd.name} goes on a capital ship`)
    if (stepsOf(list) > ctx.cmd.prices.length - 1) why.push(`${ctx.cmd.name} can buy at most ${ctx.cmd.prices.length - 1} extra re-roll${ctx.cmd.prices.length === 2 ? '' : 's'}`)
    for (const w of ctx.cmd.check?.(ctx) ?? []) why.push(w)
  } else if (def.fleetRerolls) {
    const fr = def.fleetRerolls
    if (stepsOf(list) > fr.prices.length - 1) why.push(`the fleet can buy at most ${fr.prices.length - 1} extra re-rolls`)
  } else if (stepsOf(list)) why.push('re-rolls are bought for a commander, so the fleet needs one')
  // upgrades, per ship
  for (const e of ctx.ents) {
    const seen = new Set()
    for (const id of e.ups) {
      const u = upDef(def, id), name = e.p?.name ?? e.id
      if (!u) { why.push(`${id} is not offered in the ${def.name} list`); continue }
      if (seen.has(id)) why.push(`${name} has ${u.name} twice`)
      seen.add(id)
      if (!matches(u.on, e)) why.push(`${u.name} can't go on ${name}`)
      if (u.needs === 'bays' && !e.bays) why.push(`${u.name} needs launch bays, which the ${name} does not have`)
      if (u.notOn?.includes(e.cls)) why.push(`${u.name} can't go on the ${name}`)
      if (u.builtInCls?.includes(e.cls) || ctx.cmd?.includes?.includes(id) && e.i === ctx.cmdOn) why.push(`${name} already has ${u.name} in its cost`)
      for (const x of u.excludes ?? []) if (e.ups.includes(x)) why.push(`${name} can't have both ${u.name} and ${upDef(def, x)?.name ?? x}`)
      if (u.noWeapon && e.p && bayStrength(e.p) && u.noWeapon === 'bays') why.push(`${u.name} can't have launch bays: choose another keel weapon`)
    }
  }
  // limits
  for (const l of def.limits ?? []) {
    if (l.check) { why.push(...l.check(ctx)); continue }
    const count = l.byUpgrade ? ctx.upCount(l.of) : ctx.n(l.of)
    const max = typeof l.max === 'function' ? l.max(ctx) : l.max
    if (max != null && count > max) why.push(`${l.text}: ${count} is too many${max >= 0 ? `, ${max} allowed` : ''}`)
    if (l.min != null && count < l.min) why.push(`${l.text}`)
  }
  for (const u of def.upgrades ?? []) if (u.fleetMax != null && ctx.upCount(u.id) > u.fleetMax) why.push(`at most ${u.fleetMax} ${u.name}s`)
  return why
}

/** The attack (initiative) rating of the fleet as listed (the list's own rule). */
export function listAttackRating (list) {
  const ctx = listContext(list)
  ctx.points = listFleetPoints(list)
  return ctx.def?.attackRating?.(ctx) ?? 3
}

/** A copy of a profile with dotted paths set: { hits: 6, 'armour.front': 6 }. */
const setPaths = (profile, set) => { const p = { ...profile, armour: { ...profile.armour } }; for (const [k, v] of Object.entries(set)) { const [a, b] = k.split('.'); if (b) p[a] = { ...p[a], [b]: v }; else p[a] = v } return p }

/** A profile with the chosen weapon swaps put in (a choice with no drawing of its own): same weapon positions, so drawn mounts stay valid. */
export function applyPicks (fleet, cls, profile, picks = []) {
  const opts = CLASSES[fleet]?.[cls]?.options
  if (!opts) return profile
  const weapons = profile.weapons.map(w => ({ ...w }))
  opts.forEach((o, i) => { for (const s of o.choices[picks[i] ?? 0]?.swap ?? []) weapons[s.at] = { ...weapons[s.at], ...s.w } })
  return { ...profile, weapons }
}

/**
 * Put the list's extras on the ships once they exist (createFleetBattle, after Resolve is rolled). `ships` are the game's ships in list order.
 * The commander replaces or adds to his ship's Resolve (a commander who adds, like the Prince, gives +2 to a maximum of 10), the fleet's
 * re-rolls are set, upgrades are put on the ships as `ship.upgrades`, Huntseers get their own re-roll.
 */
export function applyListFleet (game, side, list, ships) {
  const ctx = listContext(list), def = ctx.def
  ctx.points = listFleetPoints(list)
  ships.forEach((s, i) => {
    const e = ctx.ents[i]
    s.upgrades = [...e.ups, ...(CLASSES[list.fleet]?.[e.cls]?.builtIn ?? [])]
    s.upgradePoints = pickCost(list.fleet, e) + e.ups.reduce((a, id) => a + (e.paid?.has(id) ? 0 : upCost(upDef(def, id), e)), 0)
    const sp = splitShipId(list.fleet, e.id)
    if (CLASSES[list.fleet]?.[e.cls]?.options?.some(o => o.choices.some(c => c.swap))) s.profile = applyPicks(list.fleet, e.cls, s.profile, list.picks?.[i] ?? sp.picks)
    for (const id of e.ups) {
      const u = upDef(def, id)
      if (u?.set) s.profile = setPaths(s.profile, u.set)   // e.g. the Merchant's 6 hits, the Emissary's deflector
      if (u?.gaffer) {   // A Gaffer's re-rolls are the fleet's (the lists limit them to nothing narrower); his vessel doubles its boarding value (rules/endPhase.js)
        if (u.noDouble) s.gafferBoost = true   // The Firms Gaffer adds +2 to one boarding roll per game instead of doubling the value
        else s.gaffer = true
        s.commander ??= 'Rukka Gaffer'
        if (u.noDouble) s.gafferRerolls = u.rerolls   // A Firms Gaffer's re-rolls are only for the gangs he leads, not the whole fleet (rules/firms.js sets who)
        else { const r = game.rerolls[side]; r.left += u.rerolls; r.flagship ??= s.uid; r.name ??= 'Rukka Gaffer' }
        say(game, `${s.name} carries a Rukka Gaffer: ${u.rerolls} re-roll${u.rerolls > 1 ? 's' : ''} for ${u.noDouble ? 'his gangs' : 'the fleet'}${u.noDouble ? ', +2 on one boarding roll per game' : s.profile.hulk ? '' : ', boarding value doubled'}`)
      }
      if (u?.add) s.profile = Object.fromEntries(Object.entries({ ...s.profile }).map(([k, v]) => [k, u.add[k] != null ? (v ?? 0) + u.add[k] : v]))   // e.g. the Phage's extra brood cyst and reinforced carapace
      if (u?.shields) s.profile = { ...s.profile, shields: s.profile.shields + u.shields }   // e.g. the lance cruiser's additional shield
      if (id === 'huntseer') { s.huntseer = { left: 1 }; say(game, `${s.name} carries a Huntseer: one re-roll for itself, a capital ship in its squadron, or an escort squadron within 15 cm`) }
      else if (u) say(game, `${s.name}: ${u.name} — ${u.text}`)
    }
    if (s.upgrades.includes('discipline') && !e.ups.includes('discipline')) say(game, `${s.name} carries a Discipline Warrior fighting crew: +2 in a boarding action, +1 on a Hit-and-Run roll`)
  })
  if (def.firms) applyFirms(game, side, def, ctx, ships)
  if (def.fleetRerolls && !ctx.cmd) {   // No commander: the fleet has one free re-roll and may buy more
    const n = def.fleetRerolls.free + stepsOf(list)
    game.rerolls[side] = { left: n, flagship: null }
    say(game, `${game.sides[side].name}: the fleet has ${n} re-roll${n === 1 ? '' : 's'}, bought by the fleet as a whole, not by a commander`)
  }
  if (ctx.cmd) {
    const c = ctx.cmd, on = ships[ctx.cmdOn], steps = stepsOf(list)
    const before = on.leadership
    on.leadership = c.mode === 'plus' ? Math.min(c.cap, on.leadership + c.plus) : c.ld
    on.commander = c.name
    for (const id of c.includes ?? []) { on.upgrades.push(id); on.upgradePoints += 0 }
    const n = c.free + steps
    game.rerolls[side] = { left: n, flagship: on.uid }
    on.commanderPoints = cmdPoints(ctx) + (c.prices[steps] ?? 0)
    say(game, `${c.name} commands from ${on.name}: Resolve ${c.mode === 'plus' ? `${before} + ${c.plus} (to a maximum of ${c.cap}) = ${on.leadership}` : on.leadership}, ${n} Fleet Commander re-roll${n === 1 ? '' : 's'}`)
  }
  // The Tethers of a parent ship form one squadron with the parent's Resolve. Gravitic hooks do nothing else in play.
  // Each Tether is given the first carrier with a free hook that takes Tethers (the builder has no parent choice); a squadron of parents shares its best Resolve.
  const room = new Map(ships.filter(c => c.profile.hooks).map(c => [c, c.profile.hooks.capacity])), carries = new Map()
  ships.forEach((o, i) => {
    const kind = o.profile.hooked
    if (!kind) return
    const fits = k => room.get(k) > 0 && k.profile.hooks.takes.includes(kind) && [...(carries.get(k) ?? [])].every(x => x === kind)   // A ship with Wardens carries only Wardens
    const asked = list.hooks?.[i] != null ? ships[list.hooks[i]] : null   // the builder's choice of parent, else the first carrier that fits
    const c = asked && fits(asked) ? asked : [...room.keys()].find(fits)
    if (!c) return
    room.set(c, room.get(c) - 1); carries.set(c, [...(carries.get(c) ?? []), kind])
    o.parent = c.uid
    if (kind === 'tether') {   //
      o.leadership = Math.max(...mates(game, c).map(m => m.leadership))
      say(game, `${o.name} hangs on ${c.name}'s gravitic hook and takes its Resolve, ${o.leadership}`)
    } else say(game, `${o.name} hangs on ${c.name}'s gravitic hook, but is an independent squadron with its own Resolve`)
  })
  // the flags rules/ordnance.js reads (addShip's vampires, torpedoBombers, mines)
  for (const s of ships) {
    if (s.upgrades.includes('vampires')) s.vampires = true
    if (s.upgrades.includes('tbombers')) s.torpedoBombers = true
    if (s.upgrades.includes('mines')) s.mines = true
  }
  if (def.annihilators) for (const s of ships) s.annihilators = true   // The Crusade list's launch bays carry Dropwing Annihilators too
  if (def.onApply === 'phage') applyPhage(game, side, ships, list)   // the Hunger's Resolve, re-rolls and Imperatives
  if (ships.some(s => s.profile.swapLd)) offerLeadershipSwaps(game, side)   //
  game.sides[side].attackRating = listAttackRating(list)
  game.sides[side].list = def.id
  say(game, `${game.sides[side].name}: ${def.name}, attack rating ${game.sides[side].attackRating}`)
}

export { hasLists }

/** The upgrades the list offers for the ship at index `i` (the builder shows these as boxes): [{ id, name, points, text }]. */
export function upgradesFor (list, i) {
  const ctx = listContext(list), e = ctx.ents[i]
  if (!e?.known) return []
  return (ctx.def.upgrades ?? []).filter(u => matches(u.on, e) && !(u.needs === 'bays' && !e.bays) && !u.notOn?.includes(e.cls) && !u.builtInCls?.includes(e.cls))
    .map(u => ({ id: u.id, name: u.name, points: u.perBay ? u.perBay * e.bays : typeof u.points === 'function' ? u.points(e) : u.points, text: u.text }))
}
