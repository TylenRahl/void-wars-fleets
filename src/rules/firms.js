// Da Rukka Firms (Rukka fleet clans) and the Gubbins that need rules of their own: set-up (Mob Rule, Young 'Uns, the profile changes of Nicked Lances, Grabbers,
// the Sprog Lance, Maniac Turrets), the Sprog Lance itself and the sprog hordes it leaves.
// Exports firmsProfile, applyFirms, hordeDice, clearHorde and fireSproglance; used by listCheck.js (fleet set-up) and the
// battle page. game.js and endPhase.js read and clear ship.hordes themselves.
import { say, addShip, shipByUid, isEscort, isCrippled, isBraced, shieldsLeft, hasUp, active, placeBlastOnShip, mates, squadronOf, remainingHits } from './game.js'
import { d6, d3 } from './dice.js'
import { dist } from './geometry.js'
import { fieldOf, fieldSave } from './miragefield.js'
import { saveNeeded } from './hull.js'
import { destroyEscortOutright } from './damage.js'
import { weaponWorks, mayFire } from './shooting.js'
import { firmsCommands } from '../data/rukkaLists.js'
import { offerGafferSwaps } from './rukka.js'

const W = (loc, kind, range, str, arc) => ({ loc, kind, range, str, arc })

/** Profile changes the Gubbins make. `ups` are the upgrade ids on the ship (granted ones included). */
export function firmsProfile (profile, ups, escort) {
  let p = { ...profile, weapons: profile.weapons.map(w => ({ ...w })) }
  if (ups.includes('llances')) {   // Heavy bangers turn into Strength 2 lances: 15 cm on an escort, 30 cm on a capital ship
    p.weapons = p.weapons.map(w => w.kind === 'heavybangers' ? { ...w, kind: 'lance', str: 2, range: escort ? 15 : 30 } : w)
  }
  if (ups.includes('sproglance')) {   // A prow heavy bangers battery is replaced by the Sprog Lance, 30 cm
    const i = p.weapons.findIndex(w => w.loc === 'prow' && w.kind === 'heavybangers')
    if (i >= 0) p.weapons[i] = W('prow', 'sproglance', 30, 'special', ['front'])
  }
  if (ups.includes('grabbers') && !p.weapons.some(w => w.kind === 'grabbers')) p.weapons.push(W('prow', 'grabbers', 0, 'special', ['front']))
  return p
}

/** Called from applyListFleet for the Firms list: grants, profile changes, Mob Rule, Young 'Uns. */
export function applyFirms (game, side, def, ctx, ships) {
  const upOf = id => def.upgrades.find(u => u.id === id)
  ships.forEach((s, i) => {
    const e = ctx.ents[i], esc = isEscort(s)
    for (const id of [...s.upgrades]) for (const g of upOf(id)?.grants ?? []) {
      const tube = s.profile.weapons.some(w => w.kind === 'torpedo'), heavy = s.profile.weapons.some(w => w.kind === 'heavybangers')
      if (s.upgrades.includes(g)) continue
      if (g === 'nicked' && !tube) continue
      if (g === 'llances' && !heavy) continue
      if (g === 'btorp' && !tube) continue
      s.upgrades.push(g)
      say(game, `${s.name} gains ${upOf(g)?.name ?? g} from ${upOf(id).name} at no cost`)
    }
    s.profile = firmsProfile(s.profile, s.upgrades, esc)
    if (s.upgrades.includes('mturret')) {   // Turret value replaced by D3 turrets (rolled once)
      const n = d3(game.rng); s.profile = { ...s.profile, turrets: n }
      say(game, `${s.name}: Maniac Turrets, D3 rolled ${n}: ${n} turret${n === 1 ? '' : 's'}`)
    }
    if (s.upgrades.includes('terrace') && e.known) say(game, `${s.name} is a Terrace ship: +1 on boarding actions and +1 Resolve to ram`)
    if (esc) s.mobRule = true   // (Mob Rule): +1 Resolve while the gang has more than five ships
  })
  // Each Gaffer's re-rolls are for the gangs under his command only; he may swap Resolve with one ship or escort squadron of them
  for (const [wi, idx] of firmsCommands(ctx)) { const w = ships[wi]; if (w?.gafferRerolls != null) w.command = idx.map(i => ships[i]?.uid).filter(Boolean) }
  // (Young 'Uns): an escort gang with Resolve 5 or 6 gets a free escort no dearer than its cheapest, up to ten escorts
  for (const q of game.squadrons.filter(x => x.side === side && shipByUid(game, x.uids[0]) && isEscort(shipByUid(game, x.uids[0])))) {
    const members = q.uids.map(u => shipByUid(game, u)), ld = members[0].leadership
    if (ld == null || ld < 5 || ld > 6 || members.length >= 10) {
      if (members.length > 5) say(game, `${q.name}: Mob Rule, more than five ships, Resolve +1`)
      continue
    }
    const cheapest = members.filter(m => String(m.id).startsWith('rukka-')).reduce((a, b) => b.profile.points < a.profile.points ? b : a)
    const n = addShip(game, side, cheapest.id)
    n.profile = { ...cheapest.profile, points: 0 }
    n.leadership = ld; n.mobRule = true; n.free = true
    n.upgrades = [...cheapest.upgrades]
    q.uids.push(n.uid)
    n.name = `${cheapest.profile.name} (free)`
    say(game, `${q.name}: Resolve ${ld}, Young 'Uns bring a free ${cheapest.profile.name}`)
    if (q.uids.length > 5) say(game, `${q.name}: Mob Rule, more than five ships, Resolve +1`)
  }
  for (const w of ships.filter(x => x.gafferRerolls != null)) w.command = [...new Set([...(w.command ?? []), ...(w.command ?? []).flatMap(u => squadronOf(game, shipByUid(game, u))?.uids ?? [])])]   // the free Young 'Uns escorts fight under him too
  offerGafferSwaps(game, side)
}

// ---------------- the Sprog Lance and sprog hordes ----------------
/** The dice a ship's next Resolve check or special order is made with: one extra D6 for each horde still on its hull. */
export const hordeDice = ship => ship.hordes ?? 0
/** Each special order made with a horde's extra die clears one horde, whether the order passed or failed. */
export function clearHorde (game, ship) {
  if (!ship.hordes) return
  ship.hordes--
  say(game, `${ship.name}: the crew shoves a horde of sprogs out of the airlock, ${ship.hordes} left`)
}

/**
 * Fire the Sprog Lance at `target`: not when crippled or braced; 30 cm, front arc; only at a ship whose shields are down; 4+ to hit;
 * a mirage field and Brace for Impact! save as usual. A hit puts D3+1 hordes on the ship (its next D3+1 Resolve checks or special orders use an extra D6 each);
 * a miss leaves a Blast Marker in contact. Against escorts the squadron rolls a D6: on 4+ the closest escort takes a Blast Marker; on 1-3 the closest
 * unshielded escort in range is destroyed. Fired once a turn per lance, like any other weapon in the Fire Phase.
 */
export function fireSproglance (game, ship, target) {
  const refuse = r => ({ ok: false, reason: say(game, `${ship.name} can't fire its Sprog Lance: ${r}`) })
  const w = ship.profile.weapons.find(x => x.kind === 'sproglance')
  if (!w) return refuse('it has none')
  const no = mayFire(game, ship, { sunburst: true })
  if (no) return refuse(no)
  if (ship.sproglanceFired === game.round) return refuse('it has already fired it this turn')
  if (isCrippled(ship)) return refuse('not when crippled')
  if (isBraced(ship)) return refuse('not when braced')
  if (!weaponWorks(ship, w)) return refuse('its prow armament is damaged')
  if (!target || target.side === ship.side || target.state !== 'active') return refuse('the target must be an enemy ship')
  if (dist(ship.pos, target.pos) > w.range + 1e-6) return refuse(`the target is beyond ${w.range} cm`)
  if (shieldsLeft(game, target) > 0) return refuse('it is only effective against ships whose shields are down')
  ship.sproglanceFired = game.round
  const r = d6(game.rng)
  if (r < 4) {
    placeBlastOnShip(game, target, ship.pos)
    say(game, `${ship.name} fires its Sprog Lance at ${target.name}: rolled ${r}, needed 4+: missed; the sprogs bounce off the hull and leave a Blast Marker in contact`)
    return { ok: true, hit: false, roll: r }
  }
  say(game, `${ship.name} fires its Sprog Lance at ${target.name}: rolled ${r}, needed 4+: hit`)
  if (fieldOf(target) && !fieldSave(game, target, 1, { what: 'Sprog Lance', from: ship.pos, by: ship, braceAsked: false }).through) {
    say(game, `${target.name}'s mirage field turns the sprogs aside`)
    return { ok: true, hit: false, roll: r, saved: 'miragefield' }
  }
  const sv = saveNeeded(target)
  if (sv) {
    const s = d6(game.rng)
    if (s >= sv) { say(game, `${target.name} is braced and saves on ${s}, needed ${sv}+`); return { ok: true, hit: false, roll: r, saved: 'brace' } }
    say(game, `${target.name} is braced but rolled ${s}, needed ${sv}+: no save`)
  }
  if (!isEscort(target)) {
    const n = d3(game.rng) + 1
    target.hordes = (target.hordes ?? 0) + n
    say(game, `${n} hordes of sprogs are teleported onto ${target.name}: its next ${target.hordes} Resolve check${target.hordes === 1 ? '' : 's'} or special order${target.hordes === 1 ? '' : 's'} use an extra D6`)
    return { ok: true, hit: true, hordes: n, roll: r }
  }
  const sq = mates(game, target), d = d6(game.rng)
  const closest = sq.reduce((a, b) => dist(b.pos, ship.pos) < dist(a.pos, ship.pos) ? b : a)
  if (d >= 4) {
    placeBlastOnShip(game, closest, ship.pos)
    say(game, `${target.name}'s squadron rolls ${d}: 4+, the hordes have no effect; ${closest.name} gets a Blast Marker in contact`)
    return { ok: true, hit: true, roll: r, escortRoll: d }
  }
  const bare = sq.filter(x => shieldsLeft(game, x) === 0 && dist(x.pos, ship.pos) <= w.range + 1e-6).sort((a, b) => dist(a.pos, ship.pos) - dist(b.pos, ship.pos))[0]
  if (bare) { say(game, `${target.name}'s squadron rolls ${d}: 1-3, so ${bare.name}, the closest unshielded escort in range, is destroyed`); destroyEscortOutright(game, bare) }
  else say(game, `${target.name}'s squadron rolls ${d}: 3 or less, but no escort in range has its shields down`)
  return { ok: true, hit: true, roll: r, escortRoll: d, destroyed: bare?.uid ?? null }
}
export { active, hasUp, remainingHits, squadronOf }
