// The Rukka rules that are not a number in a table: Resolve swaps at set-up, the Lump's sideways slide on All Ahead Full,
// and the one-weapon limit on a hulk's re-roll upgrades. Exports offerLeadershipSwaps, offerGafferSwaps, lumpSlide and
// rerollNominated; used by battle.js, listCheck.js, firms.js, ordnance.js and shooting.js.
import { say, shipByUid, orderOf, squadronOf } from './game.js'
import { rollStr } from './dicestr.js'
import { along, angleTo } from './geometry.js'

/**
 * Once Resolve is rolled for the Rukka fleet, this ship may trade its Resolve with a Bash cruisa or Bovver Ship (the gaffer
 * takes the best crew for his own vessel). Offered once to the owner (game.decide.swapLeadership(game, ship, candidates) -> the cruisa to swap with, or
 * nothing); headless nobody swaps. Only a swap that gives the big ship a better Resolve is offered.
 */
export function offerLeadershipSwaps (game, side) {
  for (const big of game.ships.filter(s => s.side === side && s.profile.swapLd && !s.swapped)) {
    const cands = game.ships.filter(k => k.side === side && ['rukka-terror', 'rukka-bash-cruisa', 'rukka-terror-torpedo', 'rukka-bash-cruisa-torpedo'].includes(k.id) && !k.swapped && k.leadership > big.leadership)
    if (!cands.length) continue
    const pick = game.decide.swapLeadership?.(game, big, cands)
    const k = pick && cands.includes(pick) ? pick : typeof pick === 'number' ? cands.find(c => c.uid === pick) : null
    if (!k) continue
    ;[big.leadership, k.leadership] = [k.leadership, big.leadership]
    big.swapped = k.swapped = true
    say(game, `${big.name} swaps Resolve with ${k.name}: ${big.leadership} and ${k.leadership}`)
  }
}

/**
 * A Firms Gaffer may also trade Resolve with one ship or escort squadron he commands. Offered once per Gaffer at set-up
 * (game.decide.swapGaffer(game, gafferShip, candidates) -> a candidate ship or its uid, or nothing; headless nobody swaps). A candidate stands for its escort squadron;
 * only a swap that gives the Gaffer's own ship or squadron the better Resolve is offered. A ship already swapped is left alone.
 */
export function offerGafferSwaps (game, side) {
  for (const w of game.ships.filter(s => s.side === side && s.gafferRerolls != null && s.command && !s.swapped)) {
    const group = x => { const q = squadronOf(game, x); return q && q.uids.length > 1 ? q.uids.map(u => shipByUid(game, u)) : [x] }
    const mine = group(w), seen = new Set(mine)
    const cands = []
    for (const u of w.command) { const x = shipByUid(game, u); if (!x || seen.has(x) || x.swapped) continue; group(x).forEach(m => seen.add(m)); if (x.leadership > w.leadership) cands.push(x) }
    if (!cands.length) continue
    const pick = game.decide.swapGaffer?.(game, w, cands)
    const k = pick && cands.includes(pick) ? pick : typeof pick === 'number' ? cands.find(c => c.uid === pick) : null
    if (!k) continue
    const a = w.leadership, b = k.leadership
    for (const m of mine) { m.leadership = b; m.swapped = true }
    for (const m of group(k)) { m.leadership = a; m.swapped = true }
    say(game, `${w.name}'s Gaffer swaps Resolve with ${k.name}${group(k).length > 1 ? "'s squadron" : ''}: ${b} and ${a}`)
  }
}

/**
 * A Lump on All Ahead Full slides an extra 2D6 cm in any direction after its move; if that slide carries it 10 cm or more off
 * its old line, the slide direction becomes its new direction of travel. Facing stands for the direction of travel (a Lump never turns on its own). Call after the Lump has made its 10 cm.
 * `bearing` is the direction (degrees) the owner picks; the distance is the order's extra 2D6 (rolled when the order was given).
 */
export function lumpSlide (game, ship, bearing) {
  const refuse = r => ({ ok: false, reason: say(game, `${ship.name} can't slide: ${r}`) })
  if (!ship.profile.lump) return refuse('only a Lump does this')
  if (orderOf(ship) !== 'aheadFull' || !ship.movedThisPhase) return refuse('a Lump on All Ahead Full slides at the end of its move')
  if (ship.slid === game.round) return refuse('it has already slid this turn')
  const d = ship.order.extra ?? 0
  ship.slid = game.round
  ship.pos = along(ship.pos, bearing, d)
  const diff = Math.abs(((bearing - ship.facing) % 360 + 540) % 360 - 180)
  if (d >= 10 && diff > 1e-6) { ship.facing = ((bearing % 360) + 360) % 360; say(game, `${ship.name} slides ${d} cm towards ${Math.round(bearing)}° and that is its new direction of travel`) }
  else say(game, `${ship.name} slides ${d} cm towards ${Math.round(bearing)}°; under 10 cm in another direction, so its course is unchanged`)
  return { ok: true, moved: d }
}
/**
 * On a Rukka hulk, Nicked Torpedoes and Maniac Gunners each help only one weapon system or torpedo battery a turn, named
 * before its dice are rolled. Called BEFORE a weapon's dice are rolled; true when this weapon may use the re-roll. Any other ship: always.
 * Asks game.decide.nominateReroll(game, ship, { weapon, kind }) once per kind per turn while none is nominated yet (headless: no).
 */
export function rerollNominated (game, ship, kind, weapon) {
  if (!ship.profile.hulk) return true
  const key = `${game.round}:${game.active}`, n = (ship.nominated ??= {})
  if (n[kind]?.turn === key) return n[kind].weapon === ship.profile.weapons.indexOf(weapon)
  if (!game.decide.nominateReroll?.(game, ship, { weapon, kind })) return false
  n[kind] = { turn: key, weapon: ship.profile.weapons.indexOf(weapon) }
  say(game, `${ship.name}: the ${weapon.loc} ${weapon.kind} is nominated for this turn's ${kind === 'maniac' ? 'Maniac Gunners' : 'Nicked Torpedoes'} re-roll; no other system may use it this turn`)
  return true
}
export { rollStr, shipByUid, angleTo }
