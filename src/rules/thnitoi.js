// The Thnitoi: the rules that are theirs alone. Here: weapons knocked out by criticals, Harpoon assault modules, leech
// torpedoes, slavetaking and false-flag engines. Elsewhere: void fields in miragefield.js (FIELDS), the critical table in damage.js,
// Resolve and boarding in game.js and endPhase.js, attack craft in data/craft.js.
// Used by turn.js, shooting.js, ordnance.js, endPhase.js and battle.js.
import { d6, rollDice, sum } from './dice.js'
import { say, hasUp, shipByUid, active, enemiesOf, baseR, onTable, squadronOf, mates, isEscort } from './game.js'
import { dist, along } from './geometry.js'

const isT = s => s?.profile?.fleet === 'thnitoi'

/** Weapons Systems Damaged stops every weapon, Prow Armament Damaged the main prow armament (not its weapons batteries), Weapons Batteries Damaged the integral batteries. */
export function thnitoiBlocked (ship, w) {
  const c = ship.crits
  if (!isT(ship) || w.kind === 'bays') return false
  return !!(c.weaponsAll || (c.prowMain && w.loc === 'prow' && w.kind !== 'battery') || (c.batteries && w.kind === 'battery'))
}

// ---------------- Harpoon assault modules ----------------
/** Harpoon modules a ship carries: its harpoon weapons' strengths (the module count), less those destroyed for good by a roll of 1. */
export const harpoonCap = ship => ship.profile.weapons.filter(w => w.kind === 'harpoon').reduce((a, w) => a + w.str, 0) - (ship.harpoonsLost ?? 0)
/**
 * When an escort squadron loses a Harpoon, its owner picks which ship of the squadron loses it. Asked through
 * game.decide.harpoonLoss(game, launcher, candidates) -> a ship uid; headless: the launching ship, when it still has one, else the first that does.
 */
export function loseHarpoon (game, home) {
  const q = squadronOf(game, home), cands = q && isEscort(home) ? mates(game, home).filter(m => harpoonCap(m) > 0) : [home]
  let pick = home
  if (cands.length > 1) {
    const asked = game.decide.harpoonLoss?.(game, home, cands)
    pick = cands.find(c => c.uid === asked) ?? (harpoonCap(home) > 0 ? home : cands[0])
    say(game, `${home.name}'s Harpoon is defeated: its owner decides which ship of the squadron loses a module — ${pick.name}`)
  }
  pick.harpoonsLost = (pick.harpoonsLost ?? 0) + 1
  say(game, `${pick.name}'s Harpoon is lost for the rest of the game`)
}
/** Modules ready to launch: not out, not lost. Reload Ordnance brings the ones that went out (or were shot down) back. */
export const harpoonsReady = ship => Math.max(0, harpoonCap(ship) - (ship.harpoonsOut ?? 0))
/** Harpoon-armed vessels: active ships of the side that still carry a module. */
export const harpoonVessels = (game, side) => game.ships.filter(s => s.side === side && s.state === 'active' && s.pos && harpoonCap(s) > 0).length
export const harpoonsInPlay = (game, side) => game.ordnance.filter(o => o.kind === 'wave' && o.side === side).reduce((a, o) => a + o.markers.filter(k => k === 'harpoon').length, 0)

/**
 * Launch one Harpoon from `ship` in its Fire Phase, "like an assault boat". No launch bays are used; the module is not counted in launch limits.
 * Refused if none is ready (needs Reload Ordnance), or if Harpoons in play already equal the number of Harpoon armed vessels.
 */
export function launchHarpoon (game, ship) {
  const refuse = r => ({ ok: false, reason: say(game, `${ship.name} can't launch a Harpoon: ${r}`) })
  const w = ship.profile.weapons.find(x => x.kind === 'harpoon')
  if (!w) return refuse('it carries none')
  if (game.phase !== 'shooting' || ship.side !== game.active) return refuse('modules are launched in your own Fire Phase, like assault boats')
  if (ship.state !== 'active' || ship.lockedWith || ship.noFireRound === game.round || ship.standby) return refuse('it can\'t launch this turn')
  if (ship.crits.weaponsAll || (ship.crits.prowMain && w.loc === 'prow') || ship.crits.prow) return refuse('its prow armament is damaged')
  if (harpoonsReady(ship) < 1) return refuse('no module is ready: Reload Ordnance first')
  if (harpoonsInPlay(game, ship.side) >= harpoonVessels(game, ship.side)) return refuse(`Harpoons in play already equal the ${harpoonVessels(game, ship.side)} Harpoon armed vessel${harpoonVessels(game, ship.side) === 1 ? '' : 's'} in the fleet`)
  ship.harpoonsOut = (ship.harpoonsOut ?? 0) + 1
  game.ordnance.push({ id: game.nextId++, kind: 'wave', side: ship.side, from: ship.uid, pos: { ...ship.pos }, markers: ['harpoon'], r: 1.1, moved: false, fresh: true, fleet: 'thnitoi', launchKey: `${game.round}:${game.active}` })
  say(game, `${ship.name} launches a Harpoon assault module (30 cm); it must be reloaded before it can go again`)
  return { ok: true }
}
/** Reload Ordnance returns every module to its parent ship. Called from giveOrder. */
export function reloadHarpoons (game, ship) { if (ship.harpoonsOut) { ship.harpoonsOut = 0 } }
/** At the start of each Thnitoi turn every Harpoon on the table is removed, out of fuel (Reload Ordnance readies them again). */
export function harpoonFuel (game) {
  const gone = game.ordnance.filter(o => o.kind === 'wave' && o.side === game.active && o.markers.includes('harpoon'))
  if (!gone.length) return
  for (const w of gone) { w.markers = w.markers.filter(k => k !== 'harpoon') }
  game.ordnance = game.ordnance.filter(o => !(o.kind === 'wave' && !o.markers.length))
  say(game, `${gone.length} Harpoon module${gone.length > 1 ? 's' : ''} run out of fuel and return to ${gone.length > 1 ? 'their' : 'the'} parent ship${gone.length > 1 ? 's' : ''}; Reload Ordnance is needed to launch again`)
}

/**
 * A Harpoon touches an enemy ship: a special Hit-and-Run attack. D6: a 1 and the boarders are defeated, the module is lost for the rest of the game. A 2-6 is a
 * critical hit, rolled as 2D6 added and looked up on the target's Critical Hits table; against an escort that added score must be an unmodified 4+ to destroy it; against Phage
 * 2D6 are rolled twice and the lowest taken. Called by endPhase.js hitAndRun (option harpoon).
 */
export function harpoonRoll (game, target, { phage = false } = {}) {
  const first = d6(game.rng)
  if (first === 1) return { failed: true, first }
  let two = rollDice(game.rng, 2), total = sum(two), text = `2D6 ${two.join('+')} = ${total}`
  if (phage) { const again = rollDice(game.rng, 2); text += ` and again ${again.join('+')} = ${sum(again)}, the lowest taken`; total = Math.min(total, sum(again)) }
  return { failed: false, first, total, text }
}

// ---------------- slavetaking ----------------
/** Victory points for slaves taken from `target` by `side` (+10, +30 by Harpoon); an escort that has lost 30 or more is destroyed. Returns true if the escort was destroyed. */
export function takeSlaves (game, side, target, points) {
  ;(game.slaveVP ??= [0, 0])[side] += points
  target.slavesTaken = (target.slavesTaken ?? 0) + points
  say(game, `Slavetaking: ${points} victory points for ${game.sides[side].name} from ${target.name} (${target.slavesTaken} from it so far)`)
  return target.profile.type === 'escort' && target.slavesTaken >= 30
}

// ---------------- lamprey torpedoes ----------------
/** A lamprey torpedo hit: no damage, a single automatic critical with no table roll, which is -10 cm speed and no All Ahead Full. Brace may be used against it. */
export const leechHits = ship => ship.crits.leech ?? 0
export const leeched = ship => leechHits(ship) > 0
/** Are leeches in the tubes? A ship may start with them by a note on its sheet (the 'leechstart' upgrade), else they are loaded by a Reload Ordnance for leeches. */
export const leechLoaded = ship => ship.leechLoaded ?? hasUp(ship, 'leechstart')

// ---------------- false-flag engines ----------------
const MIMICKED = ['freemen', 'dominion', 'concord', 'rukka', 'athanatoi', 'isos', 'thnitoi']   // Freemen, Athanatoi, Rukka, Dominion and Isos ships; Concord are Freemen ships, the Thnitoi are Athanatoi
/** Does the enemy fleet fall for the disguise? Not Phage or Katharos. */
export const mimicWorks = (game, ship) => MIMICKED.includes(game.sides[1 - ship.side]?.fleet)
/** Disguised: a mimic ship more than 30 cm from every enemy after its set-up move, until it attacks or the first game turn ends. */
export const isDisguised = (game, ship) => !!ship.disguised && game.round <= 1 && !ship.revealed
/** The ship attacked or its ordnance did: the disguise is gone. */
export function reveal (game, ship) {
  if (ship?.disguised && !ship.revealed) { ship.revealed = true; say(game, `${ship.name} has attacked: its false-flag engines no longer hide it`) }
}
/** Enemy ordnance ignores a disguised ship's own ordnance until that ordnance has attacked. */
export const ordnanceDisguised = (game, o) => { const s = o.from != null ? shipByUid(game, o.from) : null; return !!s && isDisguised(game, s) && !o.attackedAny }
/** After its free move: disguised if every enemy ship is more than 30 cm away. */
export function setDisguise (game, ship) {
  if (!hasUp(ship, 'mimic') || !mimicWorks(game, ship)) return
  const near = enemiesOf(game, ship).find(e => dist(e.pos, ship.pos) <= 30)
  ship.disguised = !near
  say(game, near ? `${ship.name} ends its mimic move within 30 cm of ${near.name}: it is not hidden` : `${ship.name} ends its mimic move more than 30 cm from every enemy: it can't be targeted by enemy ships in the first turn until it attacks`)
}
