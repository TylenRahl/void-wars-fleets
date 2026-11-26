// Hits, shields, damage, critical hits, crippling and catastrophic damage, for every fleet (with the Rukka and Phage
// tables in rukkaDamage.js and phageDamage.js). Exports hitWithShields, damageShip, braceSave, critical, catastrophic,
// derelictWreck and the critical tables (CRITS, ATHANATOI_CRITS, KATHAROS_CRITS, THNITOI_CRITS...). Used by shooting,
// ordnance, movement, the end phase, the fleet rules and the battle page.
import { rollDice, sum, d6, d3, count } from './dice.js'
import { hulkCritical, lumpCritical, lumpBreaksUp, hulkBreaksUp } from './rukkaDamage.js'
import { phageCritical, phageCatastrophic, PHAGE_CRITS } from './phageDamage.js'
import { late, isPhageShip, say, diceText as fmt, isEscort, isCapital, isBraced, isHulk, isCrippled, shieldsLeft, placeBlastOnShip,
  placeBlastCluster, onTable, offerBrace, remainingHits, baseR } from './game.js'
import { dist, along } from './geometry.js'
import { firstTouch } from './terrain.js'
import { fortCritical, quadrantDown, late as fortLate } from './fort.js'
import { isReactive, saveNeeded, hasOssuary } from './hull.js'   // the Katharos' reactive hull save

// ---------------- hits ----------------
/**
 * `hits` hits land on `ship` from a direct-fire weapon or an explosion (shields block lances, weapons
 * batteries and sunburst cannon: explosions too). Each blocked hit puts a Blast Marker against the base on the line
 * to `from`. The rest are damage. Returns { absorbed, damage }.
 */
export function hitWithShields (game, ship, hits, from, what, { noMarkers = false, critAt = 6, pyro = false, noMarkersWhy = 'asteroid impacts' } = {}) {
  if (hits <= 0) return { absorbed: 0, damage: 0 }
  ship.lastHitFrom = from   // the Rukka hulk's critical table works on the arc that was hit
  if (isHulk(ship)) return hulkHit(game, ship, hits, what)
  let absorbed = 0
  if (noMarkers) absorbed = Math.min(hits, shieldsLeft(game, ship))   // asteroid impacts: shields work, no markers
  else while (absorbed < hits && shieldsLeft(game, ship) > 0) { placeBlastOnShip(game, ship, from); absorbed++ }
  if (absorbed) game.onFx?.({ kind: 'shields', to: ship, n: absorbed, from: from ? { x: from.x, y: from.y } : null, down: !noMarkers && shieldsLeft(game, ship) === 0 })
  if (absorbed) say(game, `${ship.name}: shields absorb ${absorbed} hit${absorbed > 1 ? 's' : ''}${noMarkers ? ` (no Blast Markers for ${noMarkersWhy})` : ` — ${absorbed} Blast Marker${absorbed > 1 ? 's' : ''} placed`}`)
  const done = damageShip(game, ship, hits - absorbed, { what, critAt, pyro })
  return { absorbed, damage: done }
}

/**
 * `n` points of damage to `ship` that shields don't stop. A braced ship saves each on 4+.
 * Every point that lands rolls for a critical hit, a 6, unless opts.noCrits (damage caused by a critical
 * hit never causes another). Returns the damage that landed.
 */
export function damageShip (game, ship, n, { what = 'damage', noCrits = false, noSave = false, boarding = false, critAt = 6, pyro = false } = {}) {
  if (n <= 0 || ship.state === 'destroyed' || ship.state === 'disengaged') return 0
  if (isHulk(ship)) return hulkHit(game, ship, n, what).damage
  const need = saveNeeded(ship)   // 4+ braced; a reactive hull: its printed save always, 2+ braced
  if (need != null && !noSave) {
    const saves = rollDice(game.rng, n), saved = count(saves, need)
    say(game, isReactive(ship)
      ? `${ship.name}'s reactive hull${isBraced(ship) ? ' (braced)' : ''}: ${n} save${n > 1 ? 's' : ''} rolled ${fmt(saves)}, needed ${need}+: ${saved} saved`
      : `${ship.name} is braced: ${n} save${n > 1 ? 's' : ''} rolled ${fmt(saves)}, needed 4+: ${saved} saved`)
    n -= saved
  }
  if (n <= 0) return 0
  const wasCrippled = isCrippled(ship)
  let landed = 0
  for (let i = 0; i < n && ship.state === 'active'; i++) {
    ship.damage++; landed++
    if (!noCrits) {
      const c = d6(game.rng), on = Math.min(critOn(ship), critAt)   // A bombardment cannon scores criticals on 4+
      if (c >= on) {
        say(game, `${ship.name}: critical hit roll ${c}, needed ${on}+ — a critical hit${on === 6 ? (isAthanatoiShip(ship) ? ' (a Soulship)' : '') : critAt < critOn(ship) ? ' (bombardment cannon)' : ''}`)
        critical(game, ship)
        // A critical from a burning acid weapon also brings an extra Fire critical
        if (pyro && ship.state === 'active') { say(game, `${ship.name}: burning acid keeps eating: an additional Fire critical`); critical(game, ship, 7, { fire: true }) }
      }
    }
    if (ship.damage >= ship.profile.hits) break
  }
  say(game, `${ship.name} takes ${landed} damage from ${what}: ${remainingHits(ship)} of ${ship.profile.hits} hits left`)
  afterDamage(game, ship, wasCrippled, boarding)
  return landed
}

/**
 * One Brace for Impact save against a single attack that does not go through damageShip's own saves (a Hit-and-Run, a lamprey torpedo): a braced ship rolls a D6 against
 * saveNeeded (4+; a reactive Katharos hull 2+; a Gulper is always braced). Logs the roll and what was needed; true if it saved.
 */
export function braceSave (game, ship, what, page = '') {
  if (!(isBraced(ship) || ship.profile.braceAlways)) return false
  const need = saveNeeded(ship)
  if (need == null) return false
  const s = d6(game.rng)
  say(game, `${what} on ${ship.name}: it is braced and rolls ${s}, needed ${need}+: ${s >= need ? 'saved' : 'no save'}`)
  return s >= need
}

function afterDamage (game, ship, wasCrippled, boarding) {
  if (ship.state !== 'active') return
  if (ship.damage >= ship.profile.hits && boarding && isCapital(ship) && !ship.fort) {   // a fort quadrant at 0 is wreckage
    // Reduced to 0 by a boarding action, it becomes a drifting hulk without a roll
    ship.state = 'drifting'; ship.order = null
    say(game, `${ship.name} is taken in the boarding action and left a Drifting Hulk`)
    return placeBlastOnShip(game, ship, null)
  }
  if (ship.damage >= ship.profile.hits) return destroyed(game, ship)
  if (!wasCrippled && isCrippled(ship)) say(game, `${ship.name} is crippled: shields, turrets, weapons and ordnance halved, speed -5 cm`)
}

// ---------------- critical hits ----------------
// key, extra damage, what it does
export const CRITS = {
  2: { key: 'dorsal', extra: 0, text: 'Dorsal Armament Damaged — dorsal weapons can\'t fire until repaired' },
  3: { key: 'starboard', extra: 0, text: 'Starboard Armament Damaged — right side weapons can\'t fire until repaired' },
  4: { key: 'port', extra: 0, text: 'Port Armament Damaged — left side weapons can\'t fire until repaired' },
  5: { key: 'prow', extra: 0, text: 'Prow Armament Damaged — prow weapons can\'t fire until repaired' },
  6: { key: 'engine', extra: 1, text: 'Engine Room Damaged — no turns until repaired, +1 damage' },
  7: { key: 'fire', extra: 0, text: 'Fire! — 1 damage in the End Phase unless put out' },
  8: { key: 'thrusters', extra: 1, text: 'Thrusters Damaged — speed -10 cm until repaired, +1 damage' },
  9: { key: 'bridge', extra: 0, text: 'Bridge Smashed — Resolve -3, can\'t be repaired' },
  10: { key: 'shields', extra: 0, text: 'Shields Collapse — shields 0, can\'t be repaired' },
  11: { key: 'breach', extra: 'D3', text: 'Hull Breach — +D3 damage' },
  12: { key: 'bulkhead', extra: 'D6', text: 'Bulkhead Collapse — +D6 damage' },
}
// The Defences Critical Hits Table, for stationary defences and ground units (planetary defences)
export const DEF_CRITS = {
  2: { key: 'lances', extra: 0, text: 'Lances Damaged — its lances can\'t fire until repaired' },
  3: { key: 'lances', extra: 0, text: 'Lances Damaged — its lances can\'t fire until repaired' },
  4: { key: 'main', extra: 0, text: 'Main Armament Damaged — its weapons batteries can\'t fire until repaired' },
  5: { key: 'bays', extra: 0, text: 'Ordnance Bays Hit — no ordnance until repaired' },
  6: { key: 'reactors', extra: 1, text: 'Reactors Damaged — shields and turrets halved until repaired, +1 damage' },
  7: { key: 'fire', extra: 0, text: 'Fire! — 1 damage in the End Phase unless put out' },
  8: { key: 'orbit', extra: 1, text: 'Orbit Lost — falls D6 cm towards the planet each Manoeuvre Phase until repaired, +1 damage' },
  9: { key: 'orbit', extra: 1, text: 'Orbit Lost — falls D6 cm towards the planet each Manoeuvre Phase until repaired, +1 damage' },
  10: { key: 'shields', extra: 0, text: 'Shields Collapse — shields 0, can\'t be repaired' },
  11: { key: 'breach', extra: 'D3', text: 'Hull Breach — +D3 damage' },
  12: { key: 'bulkhead', extra: 'D6', text: 'Bulkhead Collapse — +D6 damage' },
}
// Athanatoi Critical Hits: each hit on an Athanatoi ship is a critical on a D6 of 4+ (not 6+), rolled as 2D6 on this
// table instead of the standard one.
// Row keys are what the rest of the engine reads: weaponWorks (keel, prow), movement (mastLines, mainsailScarred, superstructure,
// mainsailShredded), miragefield.js (mirage field). Row 2 and 9 take Resolve off at once (see applyAthanatoiCrit).
export const ATHANATOI_CRITS = {
  2: { key: 'infinity', extra: 0, text: 'Infinity Circuit Damaged — Resolve -1 until repaired' },
  3: { key: 'keel', extra: 0, text: 'Keel Armament Damaged — keel weapons can\'t fire until repaired' },
  4: { key: 'prow', extra: 0, text: 'Prow Armament Damaged — prow weapons can\'t fire until repaired' },
  5: { key: 'mastLines', extra: 0, text: 'Mast Lines Severed — may only turn up to 90° before it moves, until repaired' },
  6: { key: 'mainsailScarred', extra: 0, text: 'Mainsail Scarred — each of its speeds -5 cm until repaired' },
  7: { key: 'superstructure', extra: 1, text: 'Superstructure Damaged — roll a dice every time it turns over 45°, on a 1 one extra damage, until repaired, +1 damage' },
  8: { key: 'mainsailShredded', extra: 0, text: 'Mainsail Shredded — can\'t move in the Ordnance Phase until repaired' },
  9: { key: 'infinitySmashed', extra: 1, text: 'Infinity Circuit Smashed — Resolve -3, can\'t be repaired, +1 damage' },
  10: { key: 'miragefield', extra: 0, text: 'Mirage Field Generators Destroyed — no mirage fields, can\'t be repaired' },
  11: { key: 'breach', extra: 'D3', text: 'Hull Breach — +D3 damage' },
  12: { key: 'bulkhead', extra: 'D6', text: 'Bulkhead Collapse — +D6 damage' },
}
// The Katharos' own Critical Hits Table, 2D6. A drive or core result takes Resolve off for good (`ld`); the "Power Flow Disrupted"
// rows switch storm arcs and particle whips off in an arc until repaired (read by shooting.js arcOff). Row 9 is rolled again on a ship with no Ossuary.
export const KATHAROS_CRITS = {
  2: { key: 'flowPort', extra: 0, ld: 0, text: 'Power Flow Disrupted — no storm arc or flayer in the port arc until repaired' },
  3: { key: 'flowStarboard', extra: 0, ld: 0, text: 'Power Flow Disrupted — no storm arc or flayer in the starboard arc until repaired' },
  4: { key: 'flowArcs', extra: 0, ld: 0, text: 'Power Flow Disrupted — no storm arc in any arc until repaired' },
  5: { key: 'flowAll', extra: 0, ld: 0, text: 'Power Flow Disrupted — no storm arc or flayer in any arc until repaired' },
  6: { key: 'driveFixed', extra: 0, ld: 1, text: 'Drive Damaged — may not change facing until repaired, Resolve permanently -1' },
  7: { key: 'driveSlow', extra: 0, ld: 1, text: 'Drive Damaged — movement -5 cm until repaired, Resolve permanently -1' },
  8: { key: 'nullmass', extra: 0, ld: 1, text: 'Null-Mass Drive Damaged — no All Ahead Full until repaired, Resolve permanently -1' },
  9: { key: 'ossuary', extra: 0, ld: 2, text: 'Ossuary Damaged — no Ossuary until repaired, Resolve permanently -2' },
  10: { key: 'core', extra: 0, ld: 3, text: 'Command Core Damaged — Resolve permanently -3' },
  11: { key: 'surge', extra: 'D3', ld: 2, text: 'Power Surge — Resolve permanently -2, +D3 damage' },
  12: { key: 'rupture', extra: 'D6', ld: 2, text: 'Ruptured Power Core — Resolve permanently -2, +D6 damage' },
}
// The Thnitoi's own Critical Hits Table, 2D6. They suffer a critical on a 6 like everyone but the Athanatoi. Keys read elsewhere: weaponsAll, prowMain, batteries
// (thnitoi.js thnitoiBlocked), manoeuvre (giveOrder), fins (movement.js, turns of 45 degrees at most), thrusters (speedOf, Engines Damaged, -10 cm), superOrders (giveOrder),
// void field (miragefield.js). Row 9 takes Resolve off for good: it cannot be repaired.
export const THNITOI_CRITS = {
  2: { key: 'weaponsAll', extra: 0, text: 'Weapons Systems Damaged — none of the ship\'s weapons may fire until repaired' },
  3: { key: 'prowMain', extra: 0, text: 'Prow Armament Damaged — the main prow armament (not its weapons batteries) may not fire until repaired' },
  4: { key: 'manoeuvre', extra: 0, text: 'Manoeuvring Systems Damaged — must pass a Command check to come to new heading until repaired' },
  5: { key: 'batteries', extra: 0, text: 'Weapons Batteries Damaged — its integral weapons batteries may not fire until repaired' },
  6: { key: 'fins', extra: 0, text: 'Turning Fins Dented — turns of up to 45° only until repaired' },
  7: { key: 'thrusters', extra: 0, text: 'Engines Damaged — speed -10 cm until repaired' },
  8: { key: 'superOrders', extra: 1, text: 'Superstructure Damaged — roll a dice every time it attempts special orders, on a 1 one extra damage point, +1 damage' },
  9: { key: 'commanders', extra: 0, text: 'Commanders Slain — Resolve -1, can\'t be repaired' },
  10: { key: 'voidfield', extra: 0, text: 'Void Field Generator Destroyed — no void fields, can\'t be repaired' },
  11: { key: 'breach', extra: 'D3', text: 'Hull Breach — +D3 damage' },
  12: { key: 'bulkhead', extra: 'D6', text: 'Bulkhead Collapse — +D6 damage' },
}
export const isThnitoiShip = s => s.profile.fleet === 'thnitoi'
/** A Katharos ship. */
export const isKatharosShip = s => isReactive(s)
/** An Athanatoi ship. */
export const isAthanatoiShip = s => s.profile.fleet === 'athanatoi'
/** The D6 a hit must reach for a critical: 6, 4 for the Athanatoi. */
// A Soulship takes criticals only on a 6, unlike other Athanatoi ships (4+)
export const critOn = s => isAthanatoiShip(s) && !(s.upgrades ?? []).includes('soulship') ? 4 : 6
export const isDefenceShip = s => s.profile.type === 'defence' || s.profile.type === 'ground'
// the Athanatoi's repairable ones: infinity circuit damaged, keel, mast lines, mainsail scarred, superstructure, mainsail shredded
export const REPAIRABLE = ['thorax', 'sporesHurt', 'vents', 'scent', 'dorsal', 'starboard', 'port', 'prow', 'engine', 'fire', 'thrusters', 'lances', 'main', 'bays', 'reactors', 'orbit',
  'keel', 'infinity', 'mastLines', 'mainsailScarred', 'superstructure', 'mainsailShredded',
  'flowPort', 'flowStarboard', 'flowArcs', 'flowAll', 'driveFixed', 'driveSlow', 'nullmass', 'ossuary',
  'weaponsAll', 'prowMain', 'manoeuvre', 'batteries', 'fins', 'superOrders', 'leech']   // the last seven (Thnitoi), and a lamprey torpedo hit (repaired like a critical) // the last eight (the Resolve lost with them is for good)
/** The name of a critical hit by its key, from any table. */
export const critName = k => k === 'leech' ? 'a lamprey torpedo' : (Object.values(CRITS).find(c => c.key === k) ?? Object.values(DEF_CRITS).find(c => c.key === k) ?? Object.values(ATHANATOI_CRITS).find(c => c.key === k) ?? Object.values(KATHAROS_CRITS).find(c => c.key === k) ?? Object.values(THNITOI_CRITS).find(c => c.key === k) ?? Object.values(PHAGE_CRITS).find(c => c.key === k))?.text.split(' —')[0] ?? k
/** A repair puts back what the critical took: the Athanatoi infinity circuit's -1 Resolve. */
export function repaired (ship, key) {
  ship.crits[key]--
  if (key === 'infinity' && ship.leadership != null) ship.leadership += 1
}
const hasWeaponsAt = (ship, loc) => ship.profile.weapons.some(w => w.loc === loc)

/**
 * One critical hit on `ship`: roll 2D6 on the table, or use `roll` (a Hit-and-Run attack uses its own D6).
 * A result that can't apply (no such weapons, or a second Bridge Smashed / Shields Collapse) becomes
 * the next one up. An escort that takes any critical hit is destroyed.
 */
export function critical (game, ship, roll, { fire = false } = {}) {
  if (ship.state !== 'active') return
  if (isEscort(ship)) {
    say(game, `${ship.name}: an escort that suffers a critical hit is destroyed`)
    ship.damage = ship.profile.hits
    return destroyed(game, ship)
  }
  if (ship.fort) return fortCritical(game, ship, roll, { damage: damageShip, run: tableCritical })
  if (ship.profile.lump) return lumpCritical(game, ship, damageShip)
  if (ship.profile.hulk) return void hulkCritical(game, ship)
  if (isPhageShip(ship)) return phageCritical(game, ship, fire ? 7 : roll)   // The Phage table (a Fire critical is its Heavy wound)
  // An Athanatoi ship rolls on its own table. It has no Fire! row (Fire criticals come only from effects
  // that inflict them directly, not from a roll), so a fire ship's blast keeps the standard Fire! effect.
  if (isAthanatoiShip(ship) && !fire) return tableCritical(game, ship, roll, ATHANATOI_SPEC)
  if (isThnitoiShip(ship) && !fire) return tableCritical(game, ship, roll, THNITOI_SPEC)
  if (isKatharosShip(ship) && !fire) return tableCritical(game, ship, roll, KATHAROS_SPEC)
  return tableCritical(game, ship, roll, isDefenceShip(ship) ? DEF_SPEC : STANDARD_SPEC)
}

/**
 * The one critical-hit routine every 2D6 table shares: roll 2D6 (or use `roll`, a Hit-and-Run
 * attack's own score), step down the table past a result that can't apply ("the next one up"), log it, count it
 * against the ship, take the extra damage (no save, no further critical) and let a ship carrying orbital mines blow them.
 * `spec` is the table and its hooks: { table, name, page, nextPage, skip(c, ship) -> true if the row can't apply,
 * adjust(r, roll, rolled) -> the row to use (the Katharos' re-roll), counts(c, ship) -> false to leave `ship.crits` alone,
 * after(c, ship, game) -> run once the critical is counted (a Resolve loss, the flagship's re-rolls),
 * extraHook(c, extra, ship, game) -> true if the row dealt with its own damage, finish(c, ship, game) -> after the extra damage (the Phage's ichor) }.
 */
export function tableCritical (game, ship, roll, spec) {
  let r = roll
  const rolled = () => { const two = rollDice(game.rng, 2); say(game, `${ship.name}: ${spec.name}, 2D6 rolled ${fmt(two)} = ${sum(two)}`); return sum(two) }
  if (r == null) r = rolled()
  if (spec.adjust) r = spec.adjust(r, roll, rolled, ship, game)
  const first = r
  for (; r < 12; r++) if (!spec.skip?.(spec.table[r], ship)) break
  const c = spec.table[Math.min(r, 12)]
  if (r !== first) say(game, `${ship.name}: that critical can't apply, so it becomes the next one up`)
  say(game, `${ship.name}: ${c.text}`)
  if (spec.counts ? spec.counts(c, ship) : true) ship.crits[c.key] = (ship.crits[c.key] ?? 0) + 1
  spec.after?.(c, ship, game)
  const extra = c.extra === 'D3' ? d3(game.rng) : c.extra === 'D6' ? d6(game.rng) : c.extra
  if (spec.extraHook?.(c, extra, ship, game)) return   // the fort's Basilica and reactor rows spread their damage over the quadrants themselves
  if (extra) {
    if (typeof c.extra === 'string') say(game, `${ship.name}: ${c.extra} extra damage rolled ${extra}`)
    damageShip(game, ship, extra, { what: c.text.split(' —')[0], noCrits: true, noSave: true })
  }
  spec.finish?.(c, ship, game)
  mineBlast(game, ship, c.key)
}

// A weapons row for weapons the ship hasn't got, or a second Bridge Smashed / Shields Collapse, becomes the next one up
const STANDARD_SPEC = {
  table: CRITS, name: 'critical hits table',
  skip: (c, ship) => (['dorsal', 'starboard', 'port', 'prow'].includes(c.key) && !hasWeaponsAt(ship, c.key)) || ((c.key === 'bridge' || c.key === 'shields') && ship.crits[c.key]),
  counts: (c, ship) => c.key in ship.crits,
  after: (c, ship, game) => {
    // Bridge Smashed on the Fleet Commander's flagship loses his remaining re-rolls
    const fr = game.rerolls?.[ship.side]
    if (c.key === 'bridge' && fr && fr.flagship === ship.uid && fr.left > 0) { fr.left = 0; say(game, `${ship.name} is the flagship: the Fleet Commander's remaining re-rolls are lost`) }
  },
}
// The defences' own table
const DEF_SPEC = {
  table: DEF_CRITS, name: 'defences critical hits table',
  skip: (c, ship) => STANDARD_SPEC.skip(c, ship) || (['lances', 'main', 'bays'].includes(c.key) ? !hasWeaponsAt(ship, c.key) : c.key === 'orbit' ? ship.profile.type === 'ground' : c.key === 'shields' && ship.crits.shields),
  counts: STANDARD_SPEC.counts, after: STANDARD_SPEC.after,
}
// A result that can't apply (no keel or prow weapons; a second Infinity Circuit Smashed or Mirage Field Generators
// Destroyed, which can't be repaired) becomes the next one up. Resolve is taken off the rolled score now and given back by repaired (row 2); row 9 never.
const ATHANATOI_SPEC = {
  table: ATHANATOI_CRITS, name: 'Athanatoi critical hits table',
  skip: (c, ship) => ((c.key === 'keel' || c.key === 'prow') && !hasWeaponsAt(ship, c.key)) || ((c.key === 'infinitySmashed' || c.key === 'miragefield') && ship.crits[c.key]),
  after: (c, ship) => {
    if (c.key === 'infinity' && ship.leadership != null) ship.leadership -= 1
    if (c.key === 'infinitySmashed' && ship.leadership != null) ship.leadership -= 3
  },
}
// The standard table's "next one up" rule is applied here too: for a prow row on a ship with no main prow weapon, and for a
// second Commanders Slain or Void Field Generator Destroyed, which cannot be repaired (the same reading as the Athanatoi table).
const THNITOI_SPEC = {
  table: THNITOI_CRITS, name: 'Thnitoi critical hits table',
  skip: (c, ship) => (c.key === 'prowMain' && !ship.profile.weapons.some(w => w.loc === 'prow' && w.kind !== 'battery')) || ((c.key === 'commanders' || c.key === 'voidfield') && ship.crits[c.key]),
  after: (c, ship) => { if (c.key === 'commanders' && ship.leadership != null) ship.leadership -= 1 },
}
// Row 9: a ship without an ossuary rolls again (a fresh 2D6; a Hit-and-Run's D6 goes to the next row up).
// The other rows always apply. The permanent Resolve loss cannot be repaired: repairing the critical does not give it back.
const KATHAROS_SPEC = {
  table: KATHAROS_CRITS, name: 'Katharos critical hits table',
  adjust: (r, roll, rolled, ship, game) => {
    if (r !== 9 || hasOssuary(ship)) return r
    say(game, `${ship.name}: Ossuary Damaged, but it has no Ossuary — roll again`)
    if (roll != null) return 10   // a Hit-and-Run's single D6: next row up
    r = rolled()
    while (r === 9) { say(game, `${ship.name}: 9 again, no Ossuary — roll again`); r = rolled() }
    return r
  },
  counts: c => !(c.key === 'core' || c.key === 'surge' || c.key === 'rupture'),
  after: (c, ship, game) => {
    if (!c.ld || ship.leadership == null) return
    ship.leadership -= c.ld
    say(game, `${ship.name}: Resolve permanently -${c.ld}, now ${ship.leadership}`)
    if (ship.leadership <= 1) say(game, `${ship.name}'s Resolve is ${ship.leadership}: it can only try to fade out`)
  },
}

/** An escort destroyed outright by something other than a critical (slavetaking). */
export function destroyEscortOutright (game, ship) {
  if (ship.state !== 'active') return
  ship.damage = ship.profile.hits
  return destroyed(game, ship)
}

/** A ship carrying orbital mines that takes a critical hit affecting its launch bays takes an extra D3 damage as some mines detonate. */
function mineBlast (game, ship, key) {
  if (!ship.mines || ship.state !== 'active' || !(key === 'bays' || ship.profile.weapons.some(w => w.kind === 'bays' && w.loc === key))) return
  const x = d3(game.rng)
  say(game, `${ship.name}: some of the orbital mines in its bays detonate, ${x} extra damage`)
  damageShip(game, ship, x, { what: 'mines detonating', noCrits: true, noSave: true })
}

// ---------------- destruction ----------------
function destroyed (game, ship) {
  if (ship.fort) return quadrantDown(game, ship)
  if (ship.profile.lump) return lumpBreaksUp(game, ship)
  // a one-hit defence is simply destroyed; one with more hits rolls for catastrophic damage like a capital ship
  if (isEscort(ship) || (isDefenceShip(ship) && ship.profile.hits === 1)) {
    ship.state = 'destroyed'
    game.onFx?.({ kind: 'explode', to: { ...ship.pos } })
    say(game, `${ship.name} is destroyed; a Blast Marker is left where it was`)
    placeBlastCluster(game, ship.pos, 1)
    return
  }
  say(game, `${ship.name} has no hits left`)
  catastrophic(game, ship)
}

/** The Catastrophic Damage table, 2D6. */
export function catastrophic (game, ship, force) {
  if (isPhageShip(ship)) return phageCatastrophic(game, ship, force)
  const two = force == null ? rollDice(game.rng, 2) : [force], r = force ?? sum(two), hits = ship.profile.hits   // `force`: All Is Lost names the result
  const pre = `${ship.name}: Catastrophic Damage table, 2D6 rolled ${fmt(two)} = ${r} — `
  if (r <= 8) {
    const blazing = r >= 7
    if (blazing && ship.state === 'blazing') { say(game, pre + 'still a Blazing Hulk'); return }
    const first = ship.state === 'active'
    ship.state = blazing ? 'blazing' : 'drifting'
    ship.order = null
    say(game, pre + (blazing ? 'Blazing Hulk: drifts 4D6 cm a turn and rolls on this table again after each move'
      : 'Drifting Hulk: drifts 4D6 cm a turn'))
    if (first) placeBlastOnShip(game, ship, null)   // the table's one Blast Marker; a drifting wreck adds one after each move instead
    return
  }
  if (ship.profile.hulk) { game.onFx?.({ kind: 'explode', to: { ...ship.pos }, big: true }); say(game, pre + (r === 12 ? 'Aether Drive Implosion' : 'Plasma Drive Overload')); return hulkBreaksUp(game, ship, r === 12) }
  game.onFx?.({ kind: 'explode', to: { ...ship.pos }, big: r > 8 })
  const aether = r === 12, strength = aether ? hits : Math.floor(hits / 2), markers = aether ? hits : Math.floor(hits / 2)
  ship.state = 'destroyed'
  const rd = rollDice(game.rng, 3), reach = sum(rd)
  say(game, pre + (aether ? 'Aether Drive Implosion' : 'Plasma Drive Overload') + `: ${markers} Blast Markers, and every ship within 3D6 cm (rolled ${fmt(rd)} = ${reach} cm) is struck by strength ${strength} lance shots`)
  placeBlastCluster(game, ship.pos, markers)
  for (const other of onTable(game)) {
    if (other === ship || dist(other.pos, ship.pos) > reach) continue
    const key = `explosion-${ship.uid}`
    offerBrace(game, other, { by: ship, what: 'explosion', key })
    const dice = rollDice(game.rng, strength), hitsOn = count(dice, 4)
    say(game, `${other.name} caught in the explosion: ${strength} lance shots rolled ${fmt(dice)}, needed 4+: ${hitsOn} hit${hitsOn === 1 ? '' : 's'}`)
    hitWithShields(game, other, hitsOn, ship.pos, 'the explosion')
  }
}

/** Hits on a hulk roll once on the Catastrophic Damage table per attack, not per hit. */
function hulkHit (game, ship, hits, what) {
  if (hits <= 0) return { absorbed: 0, damage: 0 }
  say(game, `${ship.name} (a hulk) is hit by ${what}`)
  catastrophic(game, ship)
  return { absorbed: 0, damage: 0 }
}

/** Hulks drift 4D6 cm straight ahead in each of their Movement Phases, a Blast Marker after each move;
 * a blazing hulk then rolls on the table again. */
export function derelictWreck (game, ship) {
  if (isDefenceShip(ship)) return   // Defences stay where they are: they never drift
  const rd = rollDice(game.rng, 4), d = sum(rd)
  const from = ship.pos
  ship.pos = along(ship.pos, ship.facing, d)
  say(game, `${ship.name} drifts ${d} cm (4D6 rolled ${fmt(rd)})`)
  // Hulks that drift into a planet are destroyed; into an aether rift they vanish
  for (const t of game.terrain ?? []) {
    if (t.kind === 'planet' && firstTouch(t.shape, from, ship.pos, 0) != null) { say(game, `${ship.name} drifts into the ${t.moon ? 'moon' : 'planet'} and is destroyed`); ship.state = 'destroyed'; return }
    if (t.kind === 'island' && firstTouch(t.shape, from, ship.pos, 0) != null) { say(game, `${ship.name} drifts onto the island and is wrecked (as a planet)`); ship.state = 'destroyed'; return }
    if (t.kind === 'rift' && firstTouch(t.shape, from, ship.pos, 0) != null) { say(game, `${ship.name} drifts into the aether rift and is never seen again`); ship.state = 'gone'; return }
  }
  if (ship.pos.x < 0 || ship.pos.y < 0 || ship.pos.x > game.table.w || ship.pos.y > game.table.h) {
    say(game, `${ship.name} drifts off the table`)
    ship.state = 'gone'
    return
  }
  placeBlastOnShip(game, ship, null)
  if (ship.state === 'blazing') catastrophic(game, ship)
}


late.damageShip = damageShip
fortLate.hit = (game, ship, hits, from, what) => hitWithShields(game, ship, hits, from, what)
