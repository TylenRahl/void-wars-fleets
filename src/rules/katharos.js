// THE KATHAROS FLEET'S OWN WEAPONS AND RULES that are not a variation of an existing mechanism.
// Exports starPulseProblem, fireStarPulse, ossuaryProblem, useOssuary, portalCount, portalProblem, fadeOut, katharosLoss and
// evadesMines, used by the battle screen, endPhase.js and fleet.js.
// Already in the shared code: storm arcs and particle whips in shooting.js, reactive hull saves in hull.js/damage.js, the critical hits table in
// damage.js, Null-Mass Drive in game.js/movement.js, portals' dice in endPhase.js. What is here: the sun flare generator, the Ossuary, portals' counting,
// fading out, the Pall's mine immunity and the victory-point percentages.
import { d6 } from './dice.js'
import { dist } from './geometry.js'
import { armourFrom } from './armour.js'
import { say, enemiesOf, isCrippled, isCapital, isHulk, isEscort, isPall, leadershipTest, offerBrace, isBraced, remainingHits,
  shieldsLeft, barOrdersThroughNextTurn, shipByUid } from './game.js'
import { hitWithShields } from './damage.js'
import { mayFire, weaponArcs } from './shooting.js'
import { knockOut } from './ordnance.js'
import { arcsContaining } from './geometry.js'
import { hasOssuary } from './hull.js'

const weaponOf = (ship, kind) => ship.profile.weapons.map((w, i) => ({ w, i })).find(x => (x.w.book ?? x.w.kind) === kind)

// ---------------- the sun flare generator ----------------
/** Why this ship's sun flare can't go off now, or null. Not on any special order (Lock On included) and not while crippled.
 * Once a turn, in the Fire Phase (no phase is given in the rules, so the game picks this one). */
export function starPulseProblem (game, ship) {
  const sp = weaponOf(ship, 'starpulse')
  if (!sp) return 'it has no sun flare generator'
  const no = mayFire(game, ship, { sunburst: true })
  if (no) return no
  if (ship.order) return 'a sun flare cannot be generated on any special order, Lock On and Brace for Impact! included'
  if (isCrippled(ship)) return 'a crippled ship cannot generate a sun flare'
  if (ship.pulsedRound === game.round) return 'it has already pulsed this turn'
  return null
}
/**
 * The sun flare: a 20 cm radius pulse that spares Katharos ships. Every enemy ship in range takes one D6 against its armour on the facing
 * nearest the pulse; mirage fields and similar saves do not work against it. Every single ordnance marker in range (each marker of a wave
 * on its own) is removed on a 4+. It is an area effect, so there is no target choice, no target-priority test and no line-of-sight check.
 * Each hit is one hit; shields absorb as for any hit. Enemy ships and ordnance only: the rule spares Katharos ships and allies do not exist
 * in this game, so in practice only the enemy is hit.
 */
export function fireStarPulse (game, ship) {
  const no = starPulseProblem(game, ship)
  if (no) return { ok: false, reason: say(game, `${ship.name} can't generate a sun flare: ${no}`) }
  const { w } = weaponOf(ship, 'starpulse')
  ship.pulsedRound = game.round
  game.onFx?.({ kind: 'pulse', from: ship, radius: w.range })
  const results = []
  const near = enemiesOf(game, ship).filter(e => dist(e.pos, ship.pos) <= w.range + 1e-6)
  say(game, `${ship.name} generates a sun flare: ${near.length} enemy ship${near.length === 1 ? '' : 's'} within ${w.range} cm`)
  for (const t of near) {
    if (t.state !== 'active') continue
    offerBrace(game, t, { by: ship, what: 'sun flare', key: `pulse-${ship.uid}-${game.round}` })
    const need = armourFrom(t, ship.pos), r = d6(game.rng), hit = r >= need
    say(game, `Sun flare on ${t.name}: 1D6 rolled ${r}, needed ${need}+ against the armour facing ${ship.name}: ${hit ? 'a hit' : 'missed'}`)
    if (hit) hitWithShields(game, t, 1, ship.pos, 'the sun flare')
    results.push({ target: t.uid, roll: r, need, hit })
  }
  const swept = sweepOrdnance(game, ship, w.range, 4, () => true, 'sun flare', '')
  return { ok: true, results, ordnance: swept }
}

/** Roll `need`+ for every ordnance marker of the enemy within `range` that `pick` accepts: a wave's markers one by one, a salvo or a mine once. Returns how many went. */
function sweepOrdnance (game, ship, range, need, pick, what, page) {
  let gone = 0
  for (const o of [...game.ordnance]) {
    if (o.side === ship.side || dist(o.pos, ship.pos) > range + 1e-6 || !pick(o)) continue
    if (o.kind === 'wave') {
      for (let i = o.markers.length - 1; i >= 0; i--) {
        const r = d6(game.rng), ok = r >= need
        say(game, `${what} on a ${o.markers[i]} marker: rolled ${r}, removed on ${need}+: ${ok ? 'hit' : 'missed'}`)
        if (ok && knockOut(game, o, i, null, o.pos)) gone++
      }
      if (!o.markers.length) game.ordnance = game.ordnance.filter(x => x !== o)
    } else {
      const r = d6(game.rng), ok = r >= need
      say(game, `${what} on a ${o.boarding ? 'boarding torpedo' : o.kind} marker: rolled ${r}, removed on ${need}+: ${ok ? 'hit, removed' : 'missed'}`)
      if (ok) {
        game.ordnance = game.ordnance.filter(x => x !== o); gone++
        if (o.kind === 'mine' && o.purchased) { game.minesLost ??= [0, 0]; game.minesLost[o.side]++ }
      }
    }
  }
  return gone
}

// ---------------- the Ossuary ----------------
export function ossuaryProblem (game, ship) {
  if (!hasOssuary(ship)) return 'it carries no Ossuary'
  const no = mayFire(game, ship, { sunburst: true })
  if (no) return no
  // The Ossuary needs a ship that is neither crippled nor on any special order
  if (ship.order) return 'an Ossuary can only be unleashed when the ship is not on any special orders'
  if (isCrippled(ship)) return 'a crippled ship cannot unleash its Ossuary'
  if (ship.crits.ossuary) return 'its Ossuary is damaged until repaired'
  if (ship.ossuaryRound === game.round) return 'it has already unleashed its Ossuary this turn'
  return null
}
/**
 * The Ossuary targets one enemy ship within 20 cm, which takes a Resolve Test. A pass does nothing. A failure costs it 1 Resolve for good and
 * bars all special orders, Brace for Impact included, until after the end of its next turn. Every ordnance marker within 20 cm, apart from
 * ordinary (non-boarding) torpedoes, is also removed on a 4+. The Resolve Test is the plain 2D6 with no modifiers; the target may spend a
 * re-roll. Used in the Fire Phase (no phase is given in the rules). `targetUid` may be null to sweep ordnance alone.
 */
export function useOssuary (game, ship, targetUid) {
  const no = ossuaryProblem(game, ship)
  if (no) return { ok: false, reason: say(game, `${ship.name} can't unleash its Ossuary: ${no}`) }
  const { w } = weaponOf(ship, 'ossuary')
  const t = targetUid != null ? shipByUid(game, targetUid) : null
  if (targetUid != null && (!t || t.side === ship.side || t.state !== 'active' || dist(t.pos, ship.pos) > w.range + 1e-6)) return { ok: false, reason: say(game, `${ship.name}: the Ossuary's target must be an enemy ship within ${w.range} cm`) }
  ship.ossuaryRound = game.round
  game.onFx?.({ kind: 'pulse', from: ship, radius: w.range, ossuary: true })   // the view's ripple (battle/fx.js); decides nothing
  say(game, `${ship.name} unleashes its Ossuary${t ? ` on ${t.name}` : ''}: a wave of palpable psychic force`)
  let result = null
  if (t) {
    const test = leadershipTest(game, t, { why: `resist the Ossuary's wave of horror` })
    result = { pass: test.pass }
    if (!test.pass) {
      t.leadership -= 1
      barOrdersThroughNextTurn(game, t)
      say(game, `${t.name}'s crew breaks: Resolve permanently -1 (now ${t.leadership}), and no special orders, Brace for Impact! included, until after the end of its next turn`)
    } else say(game, `${t.name}'s captain restores order: nothing happens`)
  }
  const swept = sweepOrdnance(game, ship, w.range, 4, o => !(o.kind === 'torpedo' && !o.boarding), 'Ossuary', '')
  return { ok: true, ...result, ordnance: swept }
}

// ---------------- portals ----------------
/** How many portal attacks the ship can make now: its portals, cut in half rounding DOWN for crippled and again for Braced. */
export function portalCount (ship) {
  const p = weaponOf(ship, 'portal')
  if (!p || ship.state !== 'active') return 0
  let n = +p.w.str || 0
  if (isCrippled(ship)) n = Math.floor(n / 2)
  if (isBraced(ship)) n = Math.floor(n / 2)
  return n
}
/**
 * Why this portal attack cannot be made, or null. Range 10 cm, only against a ship whose shields are all down. The usual limit to targets with
 * fewer hull points left does not apply, except that a Raider (an escort) cannot attack a ship with more than 6 Hull Points left. No special
 * order prevents it. `made` = portal attacks the ship has already made this End Phase.
 */
export function portalProblem (game, ship, target, made = 0) {
  const p = weaponOf(ship, 'portal')
  if (!p) return 'it has no portal'
  if (made >= portalCount(ship)) return portalCount(ship) === 0 && (isCrippled(ship) || isBraced(ship)) ? 'a crippled or braced ship has its portals halved (rounded down) to none' : `it has only ${portalCount(ship)} portal${portalCount(ship) === 1 ? '' : 's'}`
  if (!target || target.side === ship.side || target.state !== 'active') return 'the target must be an enemy ship'
  if (dist(ship.pos, target.pos) > p.w.range + 1e-6) return `the target must be within ${p.w.range} cm`
  if (!arcsContaining(ship.pos, ship.facing, target.pos).some(a => weaponArcs(p.w).includes(a))) return 'the target is not in the portal\'s fire arc'
  if (shieldsLeft(game, target) > 0) return 'the target\'s shields must be down'
  if (isEscort(ship) && remainingHits(target) > 6) return 'a Raider carries too few Drones for anything with more than 6 Hull Points left'
  return null
}

// ---------------- fading out ----------------
/** Fade out: at the end of its own Manoeuvre Phase move any Katharos ship may disengage automatically. No Resolve Test, no modifiers. */
export function fadeOut (game, ship) {
  if (!ship.profile.reactive) return { ok: false, reason: say(game, `${ship.name} can't fade out: only Katharos ships can`) }
  if (game.phase !== 'movement' || ship.side !== game.active || !ship.movedThisPhase || ship.state !== 'active') return { ok: false, reason: say(game, `${ship.name} can only fade out at the end of its own Manoeuvre Phase move`) }
  if (ship.lockedWith) return { ok: false, reason: say(game, `${ship.name} is locked in a boarding action and can't fade out`) }
  ship.state = 'disengaged'
  ship.fadedOut = true
  game.onFx?.({ kind: 'wormhole', to: { ...ship.pos }, ship })
  say(game, `${ship.name} fades out, dematerialising and dropping out of normal space: it has disengaged automatically`)
  return { ok: true }
}

// ---------------- victory points ----------------
/**
 * What an enemy scores for this Katharos ship, from its points `value`, or null if this is not a Katharos ship and the standard table applies.
 * Katharos losses use their own percentages: a capital ship that disengages with no damage 10%; with any damage, or any raider that
 * disengages, 25%; a capital ship that is crippled 50%; destroyed but not left a drifting hulk 200%; destroyed and left a drifting hulk 300%. These stand in for the
 * normal percentages; a ship that fits several lines counts the highest. A raider that is destroyed is the standard 100% (not listed).
 */
export function katharosLoss (s, value) {
  if (!s.profile.reactive) return null
  const pct = p => Math.ceil(value * p)
  if (isHulk(s)) return pct(isCapital(s) ? 3 : 1)
  if (s.state === 'destroyed' || s.state === 'gone' || s.state === 'lost') return pct(isCapital(s) ? 2 : 1)
  if (s.state === 'disengaged') return isCapital(s) ? pct(isCrippled(s) ? 0.5 : s.damage > 0 ? 0.25 : 0.10) : pct(0.25)
  if (isCapital(s) && isCrippled(s)) return pct(0.5)
  return 0
}

// ---------------- the Pall ----------------
/** An uncrippled Pall never sets off orbital mines. */
export const evadesMines = ship => isPall(ship) && !isCrippled(ship)
