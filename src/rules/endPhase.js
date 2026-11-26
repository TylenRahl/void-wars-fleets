// The End Phase: boarding actions, Hit-and-Run (teleport) attacks, repairs, fires, and removing
// Blast Markers (rules/core/09-the-end-phase.md and 08-boarding-ramming-and-hit-and-run.md).
// Exports endPhase, boardingAction, boardingSave, hitAndRun and canTeleport; used by turn.js, movement.js (boarding
// after a move), ordnance.js, phage.js and the battle page.
import { rollDice, count, d6 } from './dice.js'
import { FLEET_NAME } from './names.js'
import { dist } from './geometry.js'
import { isPhageShip, say, diceText as fmt, active, isCapital, isEscort, isCrippled, isBraced, remainingHits, turretsOf, shieldsLeft,
  blastTouching, shipByUid, orderOf, baseR, hasMark, hasUp, isGhost, mates } from './game.js'
import { damageShip, braceSave, critical, REPAIRABLE, CRITS, critName, repaired, destroyEscortOutright } from './damage.js'
import { fieldOf, fieldSave } from './miragefield.js'
import { canBoardFrom } from './movement.js'
import { raceRule } from '../data/raceRules.js'
import { allIsLost, grappleRound, refreshGrapples } from './phage.js'
import { isReactive, saveNeeded, repairNeeded } from './hull.js'
import { portalProblem } from './katharos.js'
import { fullyDocked, dockUpkeep, quadrantsOf, fortOf, fortBoardings } from './fort.js'
import { harpoonRoll, takeSlaves, reveal } from './thnitoi.js'

// ---------------- boarding ----------------
const raceBonus = (s, round = 1) => (({ dominion: 1, rukka: 1 })[s.profile.fleet] ?? raceRule(s.profile.fleet).boardPlus ?? 0) + (round === 1 ? raceRule(s.profile.fleet).boardFirst ?? 0 : raceRule(s.profile.fleet).boardLater ?? 0)   // Thnitoi +1 in the first round, -1 in later rounds; Rukka or Dominion +1, Concord +2 (data/raceRules.js)
function valueMod (mine, theirs) {
  if (theirs <= 0) return mine > 0 ? 4 : 0
  const r = mine / theirs
  return r >= 4 ? 4 : r >= 3 ? 3 : r >= 2 ? 2 : mine > theirs ? 1 : 0
}
// difference -> [name, winner's critical on, loser's critical on]
const RESULTS = { 1: ['Stalemate', 5, 5], 2: ['Heavy Fighting', 4, 5], 3: ['Driven Back', 3, 6], 4: ['Stormed', 2, 6] }   // [name, winner scores on, loser scores on]

/**
 * A mirage field saves ONCE against the boarding attempt, not against any damage after a failed save. The save is
 * rolled when the boarding is declared: movement.js declareBoarding calls this after it sets ship.boarding.
 * If it is never called there, the End Phase rolls it before the fight (ship.boardSavedRound says which). Returns true if the
 * boarding goes ahead; on a miss the boarding is cancelled and a Blast Marker is placed in contact with the boarded ship.
 */
export function boardingSave (game, ship, target) {
  ship.boardSavedRound = game.round
  if (!fieldOf(target)) return true
  const r = fieldSave(game, target, 1, { what: 'boarding', from: ship.pos, by: ship, key: `board-${ship.uid}-${game.round}` })
  if (r.through) return true
  ship.boarding = null
  say(game, `${ship.name}'s boarding of ${target.name} fails: the mirage field turned the attempt aside`)
  return false
}

export function boardingAction (game, attacker, defender) {
  // The attacker's value is its remaining hits; the boarded ship adds its remaining turrets
  // A ship with the Wrath Protocol doubles its value in boarding actions
  const wrath = s => hasMark(s, 'wrath') || raceRule(s.profile.fleet).boardDouble || (s.gaffer && !s.profile.hulk) ? 2 : 1   // A Gaffer aboard doubles a ship's boarding value (not a Rukka hulk); Phage ships always count theirs twice
  // Sky Flock vessels (and any Isos defences) have their boarding value halved (rounded up, as every halving); Flock Guard capital ships have a standard value
  const halfOf = s => s.profile.halfBoarding ? 0.5 : 1
  // Boarding a Bastion (only a derelict may): its boarding value uses the hits left on all four quadrants, plus the turrets of the boarded quadrant alone
  const hitsFor = s => s.fort && s.fortBoardHits != null ? s.fortBoardHits : s.fort ? quadrantsOf(game, s).reduce((a, q) => a + (q.state === 'active' ? remainingHits(q) : 0), 0) : s.profile.boardHits && remainingHits(s) ? Math.max(s.profile.boardHits, remainingHits(s)) : remainingHits(s)   // A Grunt counts as 2 HP
  const va = Math.ceil(hitsFor(attacker) * wrath(attacker) * halfOf(attacker)), vd = Math.ceil(hitsFor(defender) * wrath(defender) * halfOf(defender)) + turretsOf(defender)   // Turrets are added after
  if (defender.fort) say(game, `${defender.name} is boarded: the hits left on all four quadrants count (${vd - turretsOf(defender)}) plus the turrets of this quadrant (${turretsOf(defender)})`)
  for (const s of [attacker, defender]) if (hasMark(s, 'wrath')) say(game, `${s.name} bears the Wrath Protocol: its boarding value is doubled`)
  // A draw locks the ships and they fight again; each fight after the first is a later round
  const round = attacker.lockedWith === defender.uid ? (attacker.boardRound ?? 1) + 1 : 1
  const mods = (me, them, mine, theirs) => {
    const m = [], v = valueMod(mine, theirs)
    if (v) m.push([`boarding value ${mine} against ${theirs}`, v])
    if (blastTouching(game, them).length && !raceRule(them.profile.fleet).boardDouble) m.push(['enemy has Blast Markers touching', 1])   // Blast Markers never hinder the Phage when they board; their target gets no such pass
    if (isCrippled(them)) m.push(['enemy crippled', 2])
    if (them.order) m.push(['enemy on special orders', 1])
    if (raceBonus(me, round)) m.push([`${FLEET_NAME[me.profile.fleet]}${raceRule(me.profile.fleet).boardFirst ? (round === 1 ? ', first round' : ', later round') : ''}`, raceBonus(me, round)])
    if (hasUp(me, 'mega')) m.push(['Heavy Clobba Boarding Parties', 1])
    if (hasUp(me, 'terrace')) m.push(['Terrace Lot', 1])
    // Once a game a Gaffer may put +2 on one boarding roll (the owner's choice, game.decide.gafferBoost; headless never)
    const wl = mates(game, me).find(x => x.gafferBoost && !x.boostSpent) ?? (me.gafferBoost && !me.boostSpent ? me : null)
    if (wl && game.decide.gafferBoost?.(game, wl, me)) { wl.boostSpent = true; m.push([`${wl.name}'s Gaffer2`, 2]) }
    // A Discipline Warrior fighting crew adds +2 to the dice roll in a boarding action
    if (hasUp(me, 'discipline')) m.push(['Discipline Warrior crew', 2])
    // Enemies boarding a Soulship gain +1: a ship that boards a Kalyx or a Duskhunter gains +1
    if (isGhost(them)) m.push(['boarding a Soulship', 1])
    if (them.profile.rules?.boardedPlus) m.push([`boarding ${them.profile.name.split(',')[0]}`, 1])
    return m
  }
  const ma = mods(attacker, defender, va, vd), md = mods(defender, attacker, vd, va)
  // The Phage roll 2D6 when boarding and keep the better die
  const best = s => { const n = raceRule(s.profile.fleet).boardBest ?? 1, r = Array.from({ length: n }, () => d6(game.rng)); if (n > 1) say(game, `${s.name} rolls ${n} dice and keeps the highest: ${r.join(', ')}`); return Math.max(...r) }
  const ra = best(attacker), rd = best(defender)
  const ta = ra + ma.reduce((a, [, v]) => a + v, 0), td = rd + md.reduce((a, [, v]) => a + v, 0)
  const show = (s, r, m, t) => `${s.name} rolled ${r}${m.map(([w, v]) => ` ${v > 0 ? '+' : '-'}${Math.abs(v)} (${w})`).join('')} = ${t}`
  say(game, `Boarding action: ${show(attacker, ra, ma, ta)}; ${show(defender, rd, md, td)}`)
  if (ta === td) {
    attacker.lockedWith = defender.uid; defender.lockedWith = attacker.uid; attacker.boardRound = defender.boardRound = round
    say(game, 'A draw: the ships are locked together and fight again next End Phase; neither may move, shoot or launch')
    game.onFx?.({ kind: 'boarding', from: attacker, to: defender, won: null })   // the board draws the fight (battle/fx.js boardingFx); drawing only
    return { draw: true }
  }
  const [win, lose] = ta > td ? [attacker, defender] : [defender, attacker], diff = Math.abs(ta - td)
  attacker.lockedWith = null; defender.lockedWith = null; attacker.boardRound = defender.boardRound = 0
  const [name, wc, lc] = RESULTS[Math.min(diff, 4)] ?? []
  const res = diff >= 5 ? ['Overwhelmed', 1, null] : [name, wc, lc]   // Overwhelmed: Auto/None — the loser takes one, the winner none
  say(game, `${win.name} wins by ${diff} — ${res[0]}: ${lose.name} takes ${diff} damage`)
  game.onFx?.({ kind: 'boarding', from: attacker, to: defender, won: win === attacker, diff })   // before the damage, so the fight is drawn before anything blows up
  // Boarding damage is the loss margin; the critical chances come from the results table, not per point
  damageShip(game, lose, diff, { what: 'the boarding action', noCrits: true, noSave: true, boarding: true })
  // The results table gives two critical numbers: the winner scores a critical on the loser on the first number, the loser
  // on the winner on the second (the Hyperion example: Heavy Fighting, the loser suffers one on 4+, the winner on 5+).
  // A Harrow Admiral's ship with the Wrath Protocol adds +1 to its rolls for inflicting critical damage.
  for (const [s, by, need] of [[lose, win, res[1]], [win, lose, res[2]]]) {
    if (need == null || s.state !== 'active') continue
    const plus = hasMark(by, 'wrath') && by.commander === 'Harrow Admiral' ? 1 : 0
    const r = need === 1 ? null : d6(game.rng)
    const shown = r == null ? '' : plus ? `rolled ${r} +1 (the Harrow Admiral's Wrath Protocol) = ${r + 1}, needed ${need}+` : `rolled ${r}, needed ${need}+`
    if (r == null || r + plus >= need) { say(game, `${by.name} against ${s.name}: ${r == null ? 'an automatic' : shown + ':'} critical hit from the fighting`); critical(game, s) }
    else say(game, `${by.name} against ${s.name}: ${shown} for a critical: none`)
  }
  attacker.fortBoardHits = defender.fortBoardHits = null   // The quadrants committed fight on only while the draw holds
  return { winner: win.uid, diff }
}

// ---------------- Hit-and-Run attacks ----------------
/** One Hit-and-Run attack on `target`: D6, 1 fails, 2-6 that result on the critical hits table; an escort is destroyed on 4+.
 * A braced ship saves on 4+. */
export function hitAndRun (game, target, by, { braceAsked = false, natural: given = null, mod = 0 } = {}) {
  if (by.harpoon) return harpoonAttack(game, target, by, { braceAsked })   // a Thnitoi harpoon has its own attack (thnitoi.js)
  // Against a Phage ship, Hit-and-Run rolls 2D6 and uses the worse die
  // A die handed in (Deepflesh and Prime Guard teleports) is still one of the two dice against a Phage: the second is rolled here
  let natural = given ?? d6(game.rng)
  if (raceRule(target.profile.fleet).harLowestAgainst) { const b = d6(game.rng); say(game, `Hit-and-Run on ${target.name}: two dice, ${natural} and ${b}, the lowest is taken`); natural = Math.min(natural, b) }
  // A fleet whose own rule gives +1 to Hit-and-Run rolls 2 to 7, so it can never fail: Concord, the Thnitoi and the Phage.
  // The Rukka have no such fleet rule; their Heavy Clobba Boarding Parties and an Athanatoi Discipline crew are ship
  // upgrades giving a plain +1 to the roll, so for them a natural 1 still fails.
  // A Discipline Warrior crew gives +1. Hit-and-Run attacks against a Soulship or a Duskhunter add +1, on top of any
  // fleet bonus the attacker has.
  // Concord add +1 to any Hit-and-Run attack they make and enemy attacks against a Concord ship deduct 1 (3+ against a capital ship, 5+ against
  // an escort). With the +1 the roll runs 2 to 7, so it always does some critical damage: a natural 1 does not fail for them.
  const mods = [], fleetOf = x => x.fleet ?? x.profile?.fleet
  const plus = by.harpoon ? 0 : raceRule(fleetOf(by)).harPlus ?? 0,   // The Thnitoi +1 excludes Harpoons
     minus = raceRule(target.profile.fleet).harAgainst ?? 0
  if (plus) mods.push([fleetOf(by) === 'concord' ? 'Concord' : FLEET_NAME[fleetOf(by)] ?? 'race bonus', plus, { thnitoi: '', phage: '' }[fleetOf(by)] ?? ''])
  if (minus) mods.push(['against a Concord ship', minus, ''])
  if (hasUp(by, 'discipline')) mods.push(['Discipline Warrior crew', 1, ''])
  if (isGhost(target)) mods.push(['against a Soulship', 1, ''])
  if (mod) mods.push(['Mucous Membrane', mod, ''])
  // Heavy Clobba Boarding Parties: +1 to boarding actions and to every kind of Hit-and-Run (teleports, assault boats, boarding torpedoes)
  const src = by.upgrades ? by : by.from != null ? shipByUid(game, by.from) : null
  if (src && hasUp(src, 'mega')) mods.push(['Heavy Clobba Boarding Parties', 1, ''])
  if (target.profile.rules?.harPlus) mods.push([`against ${target.profile.name.split(',')[0]}`, 1, ''])
  const r = natural + mods.reduce((a, m) => a + m[1], 0)
  const need = isEscort(target) ? 4 : 2
  const shown = mods.length ? `${natural}${mods.map(m => ` ${m[1] > 0 ? '+' : '-'}${Math.abs(m[1])} (${m[0]})`).join('')} = ${r}` : `${r}`
  if ((natural === 1 && plus <= 0) || r < need) { say(game, `Hit-and-Run on ${target.name}: rolled ${shown}, needed ${need}+${plus > 0 ? '' : ' (a 1 always fails)'}: it fails`); return false }
  // A mirage field saves once against each Hit-and-Run attack that hits (also teleport attacks); brace was asked first
  if (fieldOf(target) && !fieldSave(game, target, 1, { what: 'Hit-and-Run', from: by.pos ?? null, by, braceAsked, key: `hnr-${game.round}-${by.uid ?? by.name}` }).through) {
    say(game, `Hit-and-Run on ${target.name}: stopped by its mirage field`)
    return false
  }
  // A reactive hull gets no save against Hit-and-Run unless the ship is braced; braced, it saves on 2+
  if (braceSave(game, target, 'Hit-and-Run')) return false   // A Gulper counts as always braced when it takes damage
  say(game, `Hit-and-Run on ${target.name} by ${by.name}: rolled ${shown}`)
  if (slaveChoice(game, target, by, 10)) return true   // Slavetaking instead of the critical roll
  critical(game, target, isEscort(target) ? null : r)
  return true
}
// Slavetaking can replace any Hit-and-Run attack, for +10 victory points (+30 by Harpoon); not against Katharos or Phage fleets; brace saves may be taken against it
// (hitAndRun has already done the brace save). The player decides after the attack has got through (game.decide.slave, headless: no). An escort with 30 or more taken from it is destroyed.
function slaveChoice (game, target, by, points) {
  const fl = by.fleet ?? by.profile?.fleet
  if (!raceRule(fl).slaveTaking || isReactive(target) || isPhageShip(target) || target.state !== 'active') return false
  if (!game.decide.slave?.(game, target, { by, points })) return false
  if (takeSlaves(game, 1 - target.side, target, points) && target.state === 'active') {
    say(game, `${target.name}: 30 or more victory points of slaves taken from an escort: it is considered destroyed`)
    destroyEscortOutright(game, target)
  }
  return true
}
/**
 * A Harpoon assault module in contact: D6, a 1 and the boarders are defeated (the module is lost for good: the caller reads by.defeated); 2-6 a critical
 * hit looked up at 2D6 added (against Phage 2D6 twice, lowest). No +1 for the Thnitoi. Against an escort the added score must be an unmodified 4+. Void Field/mirage field
 * and Brace save as for any Hit-and-Run; the target's own modifiers (against Concord, Soulship, Duskhunter) move the added score on a capital ship.
 */
function harpoonAttack (game, target, by, { braceAsked }) {
  const t = harpoonRoll(game, target, { phage: isPhageShip(target) })
  if (t.failed) { by.defeated = true; say(game, `Harpoon on ${target.name}: rolled ${t.first}: the boarders are defeated and the module is lost for the rest of the game`); return false }
  if (fieldOf(target) && !fieldSave(game, target, 1, { what: 'Harpoon Hit-and-Run', from: by.pos ?? null, by, braceAsked, key: `fre-${game.round}-${by.from}` }).through) { say(game, `Harpoon on ${target.name}: stopped by its field`); return false }
  if (braceSave(game, target, 'Harpoon')) return false
  const adj = (raceRule(target.profile.fleet).harAgainst ?? 0) + (isGhost(target) ? 1 : 0) + (target.profile.rules?.harPlus ? 1 : 0)
  const score = Math.max(2, Math.min(12, t.total + (isEscort(target) ? 0 : adj)))
  say(game, `Harpoon on ${target.name}: D6 ${t.first} (not a 1), then ${t.text}${adj && !isEscort(target) ? `, ${adj > 0 ? '+' : ''}${adj} for the target = ${score}` : ''}${isEscort(target) ? `; an escort needs an unmodified 4+: ${t.total >= 4 ? 'destroyed' : 'it holds'}` : ''}`)
  if (slaveChoice(game, target, by, 30)) return true
  if (isEscort(target)) { if (t.total >= 4) critical(game, target, null); return t.total >= 4 }
  critical(game, target, score)
  return true
}

/**
 * A teleport attack, in the End Phase, by a capital ship that is not crippled and is on Lock On, Reload
 * Ordnance or no orders, against an enemy within 10 cm whose shields are down and which has no more hits left than it.
 */
export function canTeleport (game, ship, target) {
  if (ship.profile.noTeleport) return 'Isos ships may not conduct teleport hit and run attacks'
  if (!isCapital(ship) || ship.state !== 'active' || isCrippled(ship)) return 'only capital ships that aren\'t crippled can teleport'
  if (isGhost(ship)) return 'a Soulship may not make Hit-and-Run attacks of any form'
  if (remainingHits(ship) <= 1) return 'a defence with one damage point left can\'t teleport'
  if (![null, 'lockOn', 'reload'].includes(orderOf(ship))) return 'only on Lock On, Reload Ordnance or no orders'
  if (!target || target.side === ship.side || target.state !== 'active') return 'the target must be an enemy ship'
  if (dist(ship.pos, target.pos) > (hasUp(ship, 'telly') ? 30 : 10)) return hasUp(ship, 'telly') ? 'the target must be within 30 cm (Jump Box)' : 'the target must be within 10 cm'
  if (shieldsLeft(game, target) > 0) return 'the target\'s shields must be down'
  if (remainingHits(target) > remainingHits(ship)) return 'the target has more hits left than this ship'
  return null
}

// game.onFx 'teleport': the board draws the troops going across (battle/fx.js teleportFx; the Rukka throw them off a catapult at sea).
// Sent before the attack and each Hit-and-Run result written into it as it is rolled: the board draws an action's events only once the
// action has finished (battle.js act), so the results are there when it plays, and it plays before any explosion they cause. Drawing only.
function teleFx (game, from, to, kind) {
  const e = { kind: 'teleport', from, to, how: kind, results: [] }
  game.onFx?.(e)
  return e
}

// ---------------- the whole End Phase ----------------
/**
 * 1 boarding actions and Hit-and-Run attacks, 2 repairs (both players), 3 the player whose turn it is
 * removes D6 Blast Markers. opts.teleports: [[attackerUid, targetUid]] for the active player's teleport attacks.
 */
export function endPhase (game, { teleports = [] } = {}) {
  // 1. boarding: declared this turn, or locked together from an earlier draw
  const pairs = []
  for (const s of active(game)) {
    if (s.side === game.active && s.boarding != null) {
      const t = shipByUid(game, s.boarding)
      if (t && t.state === 'active' && canBoardFrom(game, s, t) && (s.boardSavedRound === game.round || boardingSave(game, s, t))) pairs.push([s, t])
    }
    if (s.lockedWith && s.uid < s.lockedWith) pairs.push([s, shipByUid(game, s.lockedWith)])
  }
  refreshGrapples(game)
  for (const [a, b] of pairs) if (a.state === 'active' && b.state === 'active') { if (allIsLost(game, b, a) || allIsLost(game, a, b)) continue; boardingAction(game, a, b) }   // All Is Lost
  fortBoardings(game, boardingAction, boardingSave)   // A fort boards enemies in contact in its own End Phase
  for (const s of game.ships) if (s.boarding != null) s.boarding = null
  grappleRound(game)   // Massive claws attack again in every End phase
  // Teleport attacks: one a turn for a ship. Deepflesh boarding parties and a Prime Guard each add one more a turn, "in addition to a
  // normal teleport attack"; the third element of a teleport says which: 'normal' (default), 'deepflesh' (two dice, both results applied, each with the
  // +1 for Concord) or 'honour' (two dice, the player chooses which to use, through game.decide.honourDie).
  const teleported = new Set()
  const portalsMade = new Map()
  for (const [a, t, kind = 'normal'] of teleports) {
    const s = shipByUid(game, a), target = shipByUid(game, t)
    // The Host Keep's Deepflesh Dyads (and Prime Guard) are the fort's, not a quadrant's: one extra attack a turn, from any quadrant that can teleport
    const fortUp = u => !!s?.fort && quadrantsOf(game, s).some(q => hasUp(q, u))
    const key = s?.fort && kind !== 'normal' ? `fort${s.fort.id}:${kind}` : a + ':' + kind
    if (kind === 'portal') {   // Each portal is one more Hit-and-Run attack, in addition to the normal teleport attack
      const no = s ? portalProblem(game, s, target, portalsMade.get(a) ?? 0) : 'no such ship'
      if (no) { say(game, `${s?.name} can't use a portal: ${no}`); continue }
      portalsMade.set(a, (portalsMade.get(a) ?? 0) + 1)
      say(game, `${s.name}'s portal floods ${target.name} with Katharos Drones and Scrubbers`)
      teleFx(game, s, target, 'portal').results.push(hitAndRun(game, target, s))
      continue
    }
    const needs = { deepflesh: 'deepflesh', honour: 'honour' }[kind]
    const no = teleported.has(key) ? (kind === 'normal' ? 'a ship may only make one teleport attack each turn' : `a ship may use its ${kind === 'honour' ? 'Prime Guard' : 'Deepflesh Dyads'} once a turn`)
      : needs && !hasUp(s, needs) && !fortUp(needs) ? `it has no ${kind === 'honour' ? 'Prime Guard' : 'Deepflesh boarding party'}` : canTeleport(game, s, target)
    if (no) { say(game, `${s?.name} can't teleport: ${no}`); continue }
    teleported.add(key)
    const fx = teleFx(game, s, target, kind)
    if (kind === 'deepflesh') {
      const d = [d6(game.rng), d6(game.rng)]
      say(game, `${s.name}'s Deepflesh boarding party teleports across: two dice rolled ${d.join(' and ')}, both results apply`)
      for (const n of d) if (target.state === 'active') fx.results.push(hitAndRun(game, target, s, { natural: n }))
    } else if (kind === 'honour') {
      const d = [d6(game.rng), d6(game.rng)], pick = game.decide.honourDie?.(game, s, d) === 1 ? 1 : 0
      say(game, `${s.name}'s Prime Guard teleports across: two dice rolled ${d.join(' and ')}, the player uses the ${pick ? 'second' : 'first'}`)
      fx.results.push(hitAndRun(game, target, s, { natural: d[pick] }))
    } else fx.results.push(hitAndRun(game, target, s))
  }
  // 2. repairs: capital ships roll one D6 per hit left, half with Blast Markers touching; each 6 fixes one
  for (const s of active(game)) {
    if (!isCapital(s) && !s.crits.leech) continue   // Escorts can repair a lamprey torpedo's effect on a 6 as capital ships repair criticals
    const broken = REPAIRABLE.filter(k => s.crits[k] > 0 && (isCapital(s) || k === 'leech'))
    if (broken.length || s.hordes) {
      let n = remainingHits(s)
      if (isGhost(s)) n = Math.ceil(n / 2)   // A Soulship rolls half the normal dice, before halving again for Blast Markers
      const bm = blastTouching(game, s).length > 0
      if (bm) n = Math.ceil(n / 2)
      if (fullyDocked(game, s)) { n += 4; say(game, `${s.name} is fully docked at a fort's pier: four extra dice for damage control`) }
      if (hasUp(s, 'healing')) n += 2   // Accelerated Healing, two extra dice added after halving for Blast markers
      const need = repairNeeded(s)
      let dice = rollDice(game.rng, n), sixes = count(dice, need)
      // Mad Spannerz: the ship may re-roll its damage control dice; the owner's choice (game.decide.rerollRepair), the second roll stands
      if (hasUp(s, 'mad') && game.decide.rerollRepair?.(game, s, { dice, sixes })) { const first = fmt(dice); dice = rollDice(game.rng, n); sixes = count(dice, need); say(game, `${s.name}: Mad Spannerz re-roll the damage control dice (first roll ${first}); the second roll stands`) }
      say(game, `${s.name} repairs: ${n} dice${isGhost(s) ? ' (half, a Soulship)' : ''}${bm ? ' (halved, Blast Markers touching)' : ''} rolled ${fmt(dice)}, each ${need === 6 ? '6' : need + '+'} fixes one: ${sixes}`)
      for (let i = 0; i < sixes; i++) {
        const left = REPAIRABLE.filter(k => s.crits[k] > 0 && (isCapital(s) || k === 'leech'))
        if (!left.length) { if (s.hordes > 0) { s.hordes--; say(game, `${s.name} shoves a horde of sprogs out of the airlock, ${s.hordes} left`); continue } break }   // Hordes are repaired like critical damage
        const k = game.decide.repair?.(game, s, left) ?? (left.includes('fire') ? 'fire' : left[0])
        repaired(s, k)
        say(game, `${s.name} repairs ${k === 'fire' ? 'a fire' : critName(k)}`)
      }
    }
    // Each fire not put out does 1 damage and keeps burning
    if (s.crits.fire && s.state === 'active') { say(game, `${s.name}: ${s.crits.fire} fire${s.crits.fire > 1 ? 's' : ''} still burning`); damageShip(game, s, s.crits.fire, { what: 'fire', noCrits: true, noSave: true }) }
  }
  dockUpkeep(game)   // Two full turns docked reloads ordnance
  // 3. Blast Markers: D6 removed, not ones touching a ship's base; the oldest go first
  const r = d6(game.rng)
  const free = game.blast.filter(m => !game.ships.some(s => s.pos && ['active', 'drifting', 'blazing'].includes(s.state) && dist(m, s.pos) <= baseR(s) + 1.0 + 1e-6))
  const gone = free.slice(0, r)
  game.blast = game.blast.filter(m => !gone.includes(m))
  say(game, `End Phase: rolled ${r}, ${gone.length} Blast Marker${gone.length === 1 ? '' : 's'} removed`)
}
