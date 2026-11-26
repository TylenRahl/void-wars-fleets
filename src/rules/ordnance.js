// Ordnance (rules/core/06-ordnance.md): torpedo salvoes, attack craft waves (fighters, bombers, assault boats),
// boarding and lamprey torpedoes, Isos missiles, torpedo bombers, mines launched from ships, turrets and the Rukka
// launch capacity check. Main exports: launchTorpedoes, launchCraft, moveWave, moveMissile, ordnancePhase,
// craftAttack, turretDice, convertTorpedoBombers, launchMines, rukkaCapacityCheck/Cull. Used by turn.js,
// movement.js, katharos.js, scenarios.js, computer.js and the battle screen.
import { rollTurrets } from './tracking.js'
import { armourFrom, lowestArmour } from './armour.js'
import { rollDice, count, d6 } from './dice.js'
import { dist, norm, along, firstContact, arcsContaining, lerp } from './geometry.js'
import { fortOf, basilicaWorks, fortBraced } from './fort.js'
import { isPhageShip, hasUp, say, diceText as fmt, ordnanceHalvings, halved, isCrippled, turretsOf, onTable, baseR, offerBrace, BLAST_R, shipByUid, squadronOf } from './game.js'
import { damageShip, braceSave, isAthanatoiShip } from './damage.js'
import { isBraced } from './game.js'
import { fieldSave } from './miragefield.js'
import { offTable } from './movement.js'
import { offLowTable } from './lowOrbit.js'
import { phenomena, firstTouch, inAsteroids, clouds, lineCrosses, ofKind as terrainOf } from './terrain.js'
import { rowOf, actsAs, craftRows, craftSpeed } from '../data/craft.js'
import { hitAndRun } from './endPhase.js'
import { rerollNominated } from './rukka.js'
import { raceRule } from '../data/raceRules.js'
import { isDiceStr, rollStr, textOf, maxOf } from './dicestr.js'
import { moveMines, minefieldDetection, MINE_R } from './defences.js'
import { reveal, ordnanceDisguised, leechLoaded, thnitoiBlocked, loseHarpoon } from './thnitoi.js'

// A torpedo marker no more than 2.5 cm wide; drawn as a circle of that width.
export const TORPEDO_R = 1.25

// Turrets hit Athanatoi ordnance only on a 6, not the usual 4+.
// That covers attack craft, torpedoes, assault boats and orbital mines of the Athanatoi, wherever the turrets are (the roll depends on
// the ordnance's fleet, not the turret ship's).
/** In a Planetary Assault the Phage attacker scores for torpedoes and assault boats that reach the planet's surface. */
const phageLanding = (game, o) => game.sc?.id === 'assault' && o.side === game.attacker && ordnanceFleet(game, o) === 'phage'
const ordnanceFleet = (game, o) => o.fleet ?? (o.from != null ? shipByUid(game, o.from)?.profile.fleet : null) ?? game.sides[o.side]?.fleet
export const turretNeed = (game, o) => ordnanceFleet(game, o) === 'athanatoi' || raceRule(ordnanceFleet(game, o)).ordnanceHitOn === 6 ? 6 : 4

// ---------------- turrets ----------------
// In a phase a ship's turrets shoot either at all the torpedo salvoes attacking it or at all the attack craft waves,
// never both. Ships whose bases touch may mass turrets, +1 die per ship up to three; crippled ships and ships without
// turrets add nothing; every ship that masses is bound to the same choice for the phase. The engine counts a phase as
// one player's turn, because attacks also come in the Manoeuvre Phase when a ship moves into ordnance.
const turnKey = game => `${game.round}:${game.active}`
const turretsFree = (game, s, kind) => isPhageShip(s) || !(s.turretUse?.key === turnKey(game) && s.turretUse.kind !== kind)
export function turretDice (game, ship, kind, from = null) {
  if (isPhageShip(ship) && from?.fleet === 'phage') return 0   // Phage spore clouds will NOT intercept Phage ordnance
  const what = kind === 'torpedo' ? 'torpedoes' : 'attack craft'
  if (!turretsFree(game, ship, kind)) { say(game, `${ship.name}'s turrets have already fired at ${kind === 'torpedo' ? 'attack craft' : 'torpedoes'} this turn, so they can't fire at ${what}`); return 0 }
  const helpers = onTable(game).filter(m => m !== ship && m.side === ship.side && m.state === 'active' && !isCrippled(m) && turretsOf(m) > 0 &&
    dist(m.pos, ship.pos) <= baseR(m) + baseR(ship) + 1e-6 && turretsFree(game, m, kind)).slice(0, 3)
  for (const m of [ship, ...helpers]) m.turretUse = { key: turnKey(game), kind }
  if (helpers.length) say(game, `${helpers.map(m => m.name).join(', ')} in base contact mass turrets with ${ship.name}: +${helpers.length}`)
  return turretsOf(ship) + helpers.length
}

// ---------------- combat air patrol ----------------
/** The fighter waves on CAP with this ship. */
export const capOf = (game, ship) => game.ordnance.filter(o => o.kind === 'wave' && o.cap === ship.uid)
/**
 * Fighters on CAP screen their ship: before turrets, each fighter marker removes one enemy torpedo salvo or attack
 * craft squadron that attacks it, and is removed with it. Returns true if the attacker is gone.
 */
function capScreen (game, ship, enemy) {
  for (const w of capOf(game, ship)) {
    while (w.markers.length && game.ordnance.includes(enemy) && (enemy.kind !== 'wave' || enemy.markers.length)) {
      const fi = Math.max(0, fighterAt(w)), fr = rowOf(w.fleet, w.markers[fi]), at = ship.pos
      if (enemy.kind === 'wave') {
        // the CAP fighter and the squadron it meets go together, unless a resilient one saves (a CAP save is for the Manoeuvre Phase)
        const yi = pickIndex(enemy, 'fighter'), enemySpent = isSpent(game, enemy)
        knockOut(game, enemy, yi, fr, at)
        knockOut(game, w, fi, null, at, { force: enemySpent })
        say(game, `A fighter on combat air patrol with ${ship.name} intercepts an attack craft squadron`)
        if (!enemy.markers.length) remove(game, enemy)
      } else {
        knockOut(game, w, fi, null, at)
        say(game, `A fighter on combat air patrol with ${ship.name} intercepts the torpedo salvo: both removed unless a resilient fighter saves`)
        remove(game, enemy)
      }
    }
    if (!w.markers.length) remove(game, w)
    if (!game.ordnance.includes(enemy)) return true
  }
  return false
}
/** CAP fighters move with their ship: put them on its base. A ship no longer active frees them. */
export function followCap (game, ship) {
  for (const w of capOf(game, ship)) {
    if (ship.state === 'active') w.pos = { ...ship.pos }
    else { w.cap = null; say(game, 'The fighters on combat air patrol are on their own now') }
  }
}
/** Fighters leave CAP at the start of their owner's Manoeuvre Phase (before the ship moves), or by moving
 * in the owner's part of the opponent's Ordnance Phase (moveWave does that). */
export function releaseCap (game, id) {
  const w = game.ordnance.find(o => o.id === id && o.cap)
  if (!w) return { ok: false, reason: 'no such wave on combat air patrol' }
  const ship = shipByUid(game, w.cap)
  if (!(game.phase === 'movement' && w.side === game.active && ship && !ship.movedThisPhase)) return { ok: false, reason: say(game, 'Fighters leave combat air patrol at the start of your Manoeuvre Phase, before the ship moves, or by moving in your opponent\'s Ordnance Phase') }
  w.cap = null; w.moved = false
  say(game, `The fighters leave combat air patrol with ${ship.name}`)
  return { ok: true }
}

/**
 * Launch a ship's torpedoes in its Fire Phase towards `heading` (degrees), which must be in
 * the tubes' fire arc. Strength is halved by bracing and by crippling. The tubes must be loaded.
 * split: [a, b] two headings for a salvo over 6, at least 3 each.
 */
const ARC_MID = { front: 0, right: 90, rear: 180, left: -90 }
/** Is a heading inside this weapon's fire arc (each arc a 90° quarter)? */
export const inTubeArc = (ship, w, heading) => w.arc === 'all' || w.arc.some(a => Math.abs(norm(heading - ship.facing - ARC_MID[a])) <= 45 + 1e-6)

// ---------------- combined ordnance ----------------
const touchingBases = (a, b) => dist(a.pos, b.pos) <= baseR(a) + baseR(b) + 1e-6
/**
 * The ships of `ship`'s squadron that may combine `kind` ('torpedo' | 'bays') with it: loaded, able to launch, and joined
 * to it by a chain of touching bases (every ship in a combined salvo has to be in base contact).
 */
export function combinePartners (game, ship, kind) {
  const q = squadronOf(game, ship)
  if (!q) return []
  const able = x => x.state === 'active' && x.pos && x.noFireRound !== game.round && !x.lockedWith && !x.standby && (kind === 'torpedo' ? x.loaded.torpedo && x.profile.weapons.some(w => w.kind === 'torpedo' || w.kind === 'missile') : x.loaded.bays && !x.crits.bays && countBays(x) > 0)
  const pool = q.uids.map(u => shipByUid(game, u)).filter(x => x !== ship && able(x))
  const group = [ship], out = []
  for (let grew = true; grew;) {
    grew = false
    for (const x of pool) if (!group.includes(x) && group.some(g => touchingBases(g, x))) { group.push(x); out.push(x); grew = true }
  }
  return out
}

export function launchTorpedoes (game, ship, heading, { weapon, split, combine = [], boarding = false } = {}) {
  const ws = ship.profile.weapons
  const wi = weapon ?? ws.findIndex(w => w.kind === 'torpedo' || w.kind === 'missile' || w.kind === 'bio-torpedo')
  const w = ws[wi]
  const refuse = r => ({ ok: false, reason: say(game, `${ship.name} can't launch torpedoes: ${r}`) })
  if (!w || (w.kind !== 'torpedo' && w.kind !== 'missile' && w.kind !== 'bio-torpedo')) return refuse('it has no torpedo tubes')
  if (w.kind === 'bio-torpedo') boarding = true   // The Phage's torpedoes are always boarding torpedoes // an Isos gravitic launcher fires missiles, which are torpedoes
  if (game.phase !== 'shooting' || ship.side !== game.active) return refuse('ordnance is launched in your own Fire Phase')
  if (ship.state !== 'active' || ship.lockedWith || ship.noFireRound === game.round || ship.standby) return refuse('it can\'t launch this turn')
  if (inAsteroids(game, ship.pos)) return refuse('torpedoes can\'t be used inside an asteroid field')
  if (ship.lowOrbit) return refuse('torpedoes may not be fired in low orbit')
  // Concord tubes may fire boarding torpedoes instead of ordinary ones; the tubes fire one kind a turn, since a ship launches its torpedoes once between reloads
  if (boarding && !raceRule(ship.profile.fleet).boardingTorpedoes) return refuse('its fleet has no boarding torpedoes')
  // A Rukka capital ship with torpedoes may buy boarding torpedoes (+5 points; a hulk +15), an upgrade; escorts cannot
  const bu = raceRule(ship.profile.fleet).boardingUpgrade
  if (boarding && bu && !(ship.upgrades ?? []).includes(bu)) return refuse('it has not bought boarding torpedoes')
  if (isPhageShip(ship) && isCrippled(ship)) return refuse('a crippled bio-ship may no longer launch ordnance')
  if (w.kind === 'bio-torpedo' && ship.loaded.tubes?.[wi] === false) return refuse('that tube has been launched: it needs Reload Ordnance (prow and thorax torpedoes are launched separately)')
  const silo = w.loc === 'basilica' && ship.fort   // The fort's torpedo silos are the Basilica's, loaded for the whole fort
  if (silo && !basilicaWorks(game, ship)) return refuse('the Basilica silos fire from the first standing quadrant, and are lost with the Basilica')
  if (silo ? !fortOf(game, ship).siloLoaded : !ship.loaded.torpedo) return refuse('its tubes are empty — it needs Reload Ordnance orders')
  if (ship.crits[w.loc] || thnitoiBlocked(ship, w)) return refuse(`its ${w.loc} armament is damaged`)
  const leech = ship.profile.fleet === 'thnitoi' && leechLoaded(ship)   // The tubes hold whichever was last reloaded; leeches need their own Reload Ordnance
  // A Rukka torpedo chucka rolls its listed dice for the salvo's Strength every time it fires.
  // Nicked Torpedoes lets the ship re-roll that Strength once (the owner's choice, game.decide.rerollTorpedoes; the second roll stands)
  let rolledStr = w.str, rolledText = ''
  const noCombine = raceRule(ship.profile.fleet).noCombineTorpedoes
  if (isDiceStr(w.str)) {
    const mayReroll = (ship.upgrades ?? []).includes('nicked') && rerollNominated(game, ship, 'nicked', w)   // A hulk nominates one torpedo battery a turn, before the roll
    let r = rollStr(game.rng, w.str)
    rolledText = ` (${w.str} rolled ${textOf(r)})`
    if (mayReroll && game.decide.rerollTorpedoes?.(game, ship, { roll: r.total, dice: w.str })) { r = rollStr(game.rng, w.str); rolledText = ` (${w.str} rolled, re-rolled by the Nicked Torpedoes to ${textOf(r)}, the second roll stands)` }
    rolledStr = r.total
  }
  const str = halved(rolledStr, silo ? (fortBraced(game, ship) ? 1 : 0) : ordnanceHalvings(ship))
  const heads = split ? split : [heading]
  for (const h of heads) {
    if (!inTubeArc(ship, w, h)) return refuse(`a heading of ${h}° is outside the tubes' ${w.arc === 'all' ? 'all-round' : w.arc.join('/')} arc`)
  }
  // Squadron ships in base contact may combine their salvoes into one, which must be in every ship's arc; it is
  // measured from the stem of the ship furthest back along its heading, so it gets no free distance
  const partners = combine.map(u => shipByUid(game, u))
  if (partners.length && noCombine) return refuse('Rukka ships in gangs may not combine torpedoes into larger salvoes')
  if (partners.length) {
    if (split) return refuse('a combined salvo is one salvo')
    const ok = combinePartners(game, ship, 'torpedo').filter(x => x.profile.weapons.some(v => v.kind === w.kind))   // missiles only with missiles
    for (const x of partners) {
      if (!ok.includes(x)) return refuse(`${x?.name ?? 'that ship'} isn't a loaded squadron mate in base contact`)
      // does not bar lamprey torpedoes from the combined salvoes of, but one salvo is one kind of torpedo: all the tubes must hold leeches, or none
      if ((x.profile.fleet === 'thnitoi' && leechLoaded(x)) !== leech) return refuse(`${x.name}'s tubes hold ${leech ? 'ordinary torpedoes, not leeches' : 'lamprey torpedoes'}, and a combined salvo is one kind`)
      const xw = x.profile.weapons.find(v => v.kind === w.kind && !x.crits[v.loc])
      if (!xw || !inTubeArc(x, xw, heading)) return refuse(`the heading must be in ${x.name}'s torpedo arc too`)
    }
  }
  const all = [ship, ...partners]
  const total = all.reduce((a, x) => a + halved((x === ship ? w : x.profile.weapons.find(v => v.kind === w.kind)).str, ordnanceHalvings(x)), 0)
  const back = all.reduce((a, x) => (x.pos.x - a.pos.x) * Math.cos(heading * Math.PI / 180) + (x.pos.y - a.pos.y) * Math.sin(heading * Math.PI / 180) < 0 ? x : a)
  if (partners.length) {
    for (const x of all) x.loaded.torpedo = false
    game.ordnance.push({ id: game.nextId++, kind: 'torpedo', side: ship.side, from: back.uid, fromAll: all.map(x => x.uid), str: total, speed: w.kind === 'missile' ? w.minSpeed : w.range, pos: { ...back.pos }, facing: heading, r: TORPEDO_R, fresh: true, attacked: {}, fleet: ship.profile.fleet, ...(boarding ? { boarding: true } : {}), ...(leech ? { leech: true } : {}),
      ...(w.kind === 'missile' ? { missile: true, minSpeed: w.minSpeed, maxSpeed: w.range, moved: false, movedOnce: false } : {}) })   // a combined Isos salvo is still a missile salvo
    game.onFx?.({ kind: 'launch', to: back })
    say(game, `${all.map(x => x.name).join(', ')} combine their torpedoes into one strength ${total} salvo, speed ${w.range} cm from ${back.name}'s stem`)
    return { ok: true }
  }
  let parts = [str]
  if (split) {
    if (rolledStr <= 6 && str <= 6) return refuse('a ship launching six or fewer torpedoes can\'t split its salvo')
    if (Math.abs(norm(split[0] - split[1])) < 1e-6) return refuse('split salvoes must go in different directions')
    const a = Math.ceil(str / 2), b = str - a
    if (b < 3) return refuse('neither salvo may have fewer than three torpedoes')
    parts = [a, b]
  }
  if (w.kind === 'bio-torpedo') { (ship.loaded.tubes ??= {})[wi] = false; if (ws.every((x, i) => x.kind !== 'bio-torpedo' || ship.loaded.tubes[i] === false)) ship.loaded.torpedo = false } else if (silo) fortOf(game, ship).siloLoaded = false
  else ship.loaded.torpedo = false
  parts.forEach((s, i) => game.ordnance.push({ id: game.nextId++, kind: 'torpedo', side: ship.side, from: ship.uid,
    // Isos missiles: torpedoes that choose a speed of 20-40 cm (w.minSpeed to w.range) each Ordnance Phase and may turn 45 degrees; see moveMissile
    str: s, speed: w.kind === 'missile' ? w.minSpeed : boarding && raceRule(ship.profile.fleet).boardingSpeed ? raceRule(ship.profile.fleet).boardingSpeed : w.range, pos: { ...ship.pos }, facing: heads[i], r: TORPEDO_R, fresh: true, attacked: {}, fleet: ship.profile.fleet, ...(boarding ? { boarding: true } : {}), ...(leech ? { leech: true } : {}),
    ...(w.kind === 'missile' ? { missile: true, minSpeed: w.minSpeed, maxSpeed: w.range, moved: false, movedOnce: false } : {}) }))
  game.onFx?.({ kind: 'launch', to: ship })
  say(game, `${ship.name} launches ${parts.length > 1 ? `two ${boarding ? 'boarding ' : ''}torpedo salvoes of ${parts.join(' and ')}` : `a strength ${str} ${boarding ? 'boarding ' : leech ? 'lamprey ' : ''}torpedo salvo`}${str < rolledStr ? ` (halved from ${rolledStr}${isCrippled(ship) ? ', crippled' : ''})` : ''}${rolledText}, speed ${boarding && raceRule(ship.profile.fleet).boardingSpeed ? raceRule(ship.profile.fleet).boardingSpeed : w.range} cm`)
  return { ok: true }
}

/**
 * The Ordnance Phase: every marker moves, the player whose turn it is first. Torpedoes go straight
 * ahead their full speed and attack every ship base they touch, friend or foe; Blast Markers crossed detonate a
 * salvo on a 6, once a move; touching an enemy torpedo detonates both; leaving the table removes it.
 */
export function ordnancePhase (game) {
  rukkaCapacityCheck(game)   //
  for (const o of game.ordnance) if (o.kind === 'wave') {
    const ship = o.cap && shipByUid(game, o.cap)
    if (o.cap && (!ship || ship.state !== 'active')) o.cap = null
    // attack craft are moved by the players (moveWave); CAP moved with its ship in its owner's turn: no double move
    o.moved = !!o.cap && o.side === game.active
  }
  // Isos missiles burn out: from the Ordnance Phase after launch, roll a D6 per point of Strength at the start of each Ordnance
  // Phase and take 1 Strength off for every 6. Both players' Ordnance Phases count. Missiles then wait to be moved by hand (moveMissile).
  for (const o of game.ordnance.filter(o => o.kind === 'torpedo' && o.missile)) {
    o.moved = false
    if (!o.movedOnce) continue
    const dice = rollDice(game.rng, o.str), lost = count(dice, 6)
    o.str -= lost
    say(game, `An Isos missile salvo (strength ${o.str + lost}) loses drones: rolled ${fmt(dice)}, one lost per 6: ${lost} lost${o.str <= 0 ? ', the salvo is gone' : `, strength ${o.str}`}`)
    if (o.str <= 0) remove(game, o)
  }
  const order = [...game.ordnance.filter(o => o.side === game.active), ...game.ordnance.filter(o => o.side !== game.active)].filter(o => o.kind === 'torpedo' && !o.missile)
  for (const o of order) if (game.ordnance.includes(o)) {
    // A boarding torpedo may make a single 45 degree turn at the start of every Ordnance Phase except the turn it was launched, measured from the
    // centre of the marker. The owner chooses (game.decide.steerTorpedo: -45, 0 or 45; headless it flies straight).
    if (o.boarding && !o.fresh) {
      const t = +game.decide.steerTorpedo?.(game, o) || 0
      if (t === 45 || t === -45) { o.facing = norm(o.facing + t); say(game, `A boarding torpedo turns ${t > 0 ? 'right' : 'left'} 45 degrees before it moves`) }
    }
    moveTorpedo(game, o)
  }
  moveMines(game, air)       // orbital mines home on the nearest enemy ship
  minefieldDetection(game)   // the active player's minefields look for enemy ships
}

function moveTorpedo (game, o) {
  const a = { ...o.pos }, b = along(a, o.facing, o.speed)
  const events = []
  for (const s of onTable(game)) {
    if (o.boarding && (s.side === o.side || s.state !== 'active')) continue   // Boarding torpedoes do not attack friendly ships, and here pass over hulks (they may choose to ignore them)
    if (o.fresh && (s.uid === o.from || o.fromAll?.includes(s.uid))) continue   // launched from its own stem (or its squadron's)
    const t = firstContact(a, b, o.r, s.pos, baseR(s))
    if (t != null) events.push({ t, kind: 'ship', s })
  }
  let bm = null
  for (const m of game.blast) { const t = firstContact(a, b, o.r, m, BLAST_R); if (t != null && (bm == null || t < bm)) bm = t }
  const L = Math.max(1e-9, o.speed)
  for (const c of clouds(game)) { const d = firstTouch(c.shape, a, b, o.r); if (d != null && (bm == null || d / L < bm)) bm = d / L }   // a cloud is a Blast Marker
  if (bm != null) events.push({ t: bm, kind: 'blast' })
  // asteroid fields and aether rifts detonate torpedoes that strike them; a planet's edge destroys them
  for (const tr of phenomena(game)) {
    if (!['asteroids', 'rift', 'planet', 'island'].includes(tr.kind)) continue   // (an island like a planet: Tides of the Archipelago)
    const d = firstTouch(tr.shape, a, b, o.r)
    if (d != null) events.push({ t: d / L, kind: 'terrain', tr })
  }
  for (const e of game.ordnance) {
    if (e === o || e.side === o.side || ordnanceDisguised(game, e)) continue
    const t = firstContact(a, b, o.r, e.pos, e.r)
    if (t != null) events.push({ t, kind: 'torpedo', e })
  }
  events.sort((x, y) => x.t - y.t)
  o.fresh = false
  for (const e of events) {
    if (!game.ordnance.includes(o)) return
    o.pos = lerp(a, b, e.t)
    if (e.kind === 'blast') {
      const r = d6(game.rng)
      say(game, `A torpedo salvo crosses Blast Markers: rolled ${r}, detonates on a 6`)
      if (r === 6) { remove(game, o); return }
    } else if (e.kind === 'terrain') {
      say(game, `A torpedo salvo strikes ${e.tr.kind === 'asteroids' ? 'an asteroid field and detonates' : e.tr.kind === 'rift' ? 'the aether rift and detonates' : e.tr.kind === 'island' ? 'an island and is destroyed (as a planet)' : `the ${e.tr.moon ? 'moon' : 'planet'} and is destroyed`}`)
      if (e.tr.kind === 'planet' && phageLanding(game, o)) { game.assaultPoints += o.str; say(game, `The Phage torpedoes reach the surface: ${o.str} Assault Point${o.str === 1 ? '' : 's'}, one for each point of Strength, ${game.assaultPoints} in all`) }
      remove(game, o); return
    } else if (e.kind === 'torpedo' && e.e.kind === 'wave') {
      if (!game.ordnance.includes(e.e) || !hasFighter(e.e)) continue
      knockOut(game, e.e, fighterAt(e.e), null, o.pos)   // a resilient fighter may save
      if (!e.e.markers.length) remove(game, e.e)
      say(game, 'A torpedo salvo runs into fighters: both are removed'); remove(game, o); return
    } else if (e.kind === 'torpedo') {
      if (!game.ordnance.includes(e.e) || e.e.kind === 'mine') continue   // mines don't affect other ordnance
      say(game, 'Two torpedo salvoes meet and both detonate')
      remove(game, o); remove(game, e.e); return
    } else if (e.s.state === 'active' || e.s.state === 'drifting' || e.s.state === 'blazing') ordnanceTouchesShip(game, o, e.s)
  }
  if (!game.ordnance.includes(o)) return
  o.pos = b
  if (a.y >= 900 ? offLowTable(b) : offTable(game, b)) { say(game, 'A torpedo salvo leaves the table'); remove(game, o) }   // the low orbit table has its own edges
}
const remove = (game, o) => { game.ordnance = game.ordnance.filter(x => x !== o) }

/**
 * A torpedo salvo touches a ship's base (also when the ship moves into it). Brace is decided before
 * turrets; turrets roll a D6 each, every 4+ removes one torpedo; the rest roll a D6 each against the
 * armour on the side the salvo comes from, ignoring shields; the salvo loses one torpedo per hit and moves on.
 * A salvo attacks the same ship at most once a turn.
 */
export function ordnanceTouchesShip (game, o, ship) {
  if (o.attacked[ship.uid] === game.round) return
  o.attacked[ship.uid] = game.round
  o.attackedAny = true; reveal(game, shipByUid(game, o.from))
  if (capScreen(game, ship, o)) return
  offerBrace(game, ship, { by: o, what: 'torpedoes', key: `torp-${o.id}` })
  const tur = turretDice(game, ship, 'torpedo', o)
  if (tur > 0) {
    const tn = turretNeed(game, o), t = rollTurrets(game, ship, tur, tn), down = Math.min(o.str, t.hits)
    say(game, `${ship.name}'s ${tur} turret${tur > 1 ? 's' : ''} fire at the strength ${o.str} torpedo salvo: ${t.text}, needed ${tn}+${tn === 6 ? ' (Athanatoi ordnance)' : ''}: ${down} torpedo${down === 1 ? '' : 'es'} shot down`)
    o.str -= down
  }
  if (o.str <= 0) { remove(game, o); say(game, 'The salvo is wiped out'); return }
  const need = Math.min(6, armourFrom(ship, o.pos) + (hasUp(ship, 'mucous') ? 1 : 0))   // the deflector and the Explorer's rear: rules/armour.js: Mucous Membrane, torpedoes need +1 to hit, at most 6+
  const dice = rollDice(game.rng, o.str)
  let hits = count(dice, need), again = ''
  // Athanatoi torpedoes always re-roll every miss once (not optional)
  if (ordnanceFleet(game, o) === 'athanatoi' || (raceRule(ordnanceFleet(game, o)).rerollTorpedoMiss && !o.leech)) {   // Thnitoi torpedoes except leeches
    const missed = dice.length - hits, re = rollDice(game.rng, missed)
    hits += count(re, need)
    again = missed ? `; Athanatoi torpedoes re-roll the ${missed} miss${missed > 1 ? 'es' : ''}: ${fmt(re)}` : ''
  }
  if (hits) game.onFx?.({ kind: 'torpedo', to: ship })
  say(game, `Strength ${o.str} ${o.boarding ? 'boarding ' : ''}torpedo salvo hits ${ship.name}: rolled ${fmt(dice)}, needed ${need}+ against its armour${again}: ${hits} hit${hits === 1 ? '' : 's'}, shields ignored`)
  o.str -= hits
  if (o.str <= 0) remove(game, o)
  // A lamprey torpedo does no damage, only a single automatic critical hit with no table roll: -10 cm and no All Ahead Full. The void field or mirage field saves
  // once against each hit (it is an ordnance hit) and a braced ship saves each one on a 4+ as usual.
  if (o.leech) {
    hits = fieldSave(game, ship, hits, { what: 'lamprey torpedo', from: o.pos, by: o, braceAsked: true }).through
    for (let i = 0; i < hits; i++) {
      if (braceSave(game, ship, 'Lamprey torpedo', '')) continue
      ship.crits.leech = (ship.crits.leech ?? 0) + 1
      say(game, `A lamprey torpedo fastens on ${ship.name}: speed -10 cm and no All Ahead Full until all ${ship.crits.leech} leech hit${ship.crits.leech > 1 ? 's are' : ' is'} repaired; one -10 cm only however many`)
    }
    return
  }
  // Each boarding torpedo that hits makes a Hit-and-Run attack in the Ordnance Phase instead of a point of damage (the mirage field and Brace saves are in hitAndRun)
  if (o.boarding) {
    // the board draws the boarding party bursting out onto the deck (battle.js fightFx 'boats'); the results are written in as they are rolled, as craftAttack's
    const fxBoard = { kind: 'boats', to: ship, side: o.side, fleet: o.fleet, results: [], torpedo: true }
    if (hits) game.onFx?.(fxBoard)
    for (let i = 0; i < hits && ship.state === 'active'; i++) fxBoard.results.push(hitAndRun(game, ship, { name: 'a boarding torpedo', fleet: o.fleet }, { braceAsked: true }))
    return
  }
  // A mirage field saves once against each ordnance hit (the torpedo is spent either way)
  hits = fieldSave(game, ship, hits, { what: 'torpedo', from: o.pos, by: o, braceAsked: true }).through
  damageShip(game, ship, hits, { what: 'torpedoes' })
}

// ======================================== ATTACK CRAFT ========================================
// A wave: { id, kind: 'wave', side, from, pos, markers: [craft kind, ...], r, moved }. Each marker is one squadron; squadrons launched together form
// one wave. What a kind of craft is, how fast it goes and what it does (fighter, bomber, assault boat, resilient, bomber re-roll, torpedo bomber) is a
// row in src/data/craft.js, looked up by the wave's `fleet`; nothing in this file names a fleet's craft.
// Not in yet: hiding other craft on a CAP ship's base, a resilient craft that also bombs or boards (Dropwing, Delta) once it has saved.

const waveR = n => Math.sqrt(n) * 1.1   // 20 mm square markers kept touching
const phaseKey = game => `${game.round}:${game.active}:${game.phase}`
const turnOf = game => `${game.round}:${game.active}`
const isSpent = (game, w) => w.spentKey === phaseKey(game)
const fighterAt = w => w.markers.findIndex(k => actsAs(w.fleet, k, 'fighter'))
/** Does this wave hold a marker that fights as a fighter? */
export const hasFighter = w => fighterAt(w) >= 0
/** Can this wave do harm to a ship (a bomber attack or a Hit-and-Run)? Fighters and torpedo bombers cannot. */
export const canAttackShip = w => w.markers.some(k => { const r = rowOf(w.fleet, k); return r && (r.acts.includes('boat') || r.acts.includes('harpoon') || (r.acts.includes('bomber') && !r.torpedoOnly)) })
// A Rukka carrier's launch bay Strength may be dice (D3+1, D6+2). It is rolled when the ship launches or when the fleet's capacity is checked (ship.bayRoll),
// and counts as its maximum until then (so a bay is never taken for less than it can launch).
const bayValue = (ship, w) => isDiceStr(w.str) ? (ship.bayRoll?.by?.[ship.profile.weapons.indexOf(w)] ?? maxOf(w.str)) : w.str
export function rollBays (game, ship, why = 'launches') {
  const by = {}
  ship.profile.weapons.forEach((w, i) => { if (w.kind === 'bays' && isDiceStr(w.str)) { const r = rollStr(game.rng, w.str); by[i] = r.total; say(game, `${ship.name}'s ${w.loc} launch bays: ${w.str} rolled ${textOf(r)}`) } })
  ship.bayRoll = { key: turnKey(game), by }
  return ship.bayRoll
}
const hasVariableBays = ship => ship.profile.weapons.some(w => w.kind === 'bays' && isDiceStr(w.str))
/** A Rukka carrier's dice bays are not yet rolled this turn (launchCraft rolls them first; the computer rolls them the same way to know how many it may launch). */
export const bayRollDue = (game, ship) => hasVariableBays(ship) && ship.bayRoll?.key !== turnKey(game)
const countBays = ship => ship.profile.weapons.filter(w => w.kind === 'bays' && !(isAthanatoiShip(ship) && ship.crits[w.loc])).reduce((a, w) => a + bayValue(ship, w), 0)   // A damaged keel armament (where the Athanatoi carry bays) can't launch
/** Squadrons a carrier can launch now: its bays, halved by bracing and crippling. */
// A derelict launches up to double the squadrons of its remaining launch bays
export const baysOf = ship => halved(countBays(ship), ordnanceHalvings(ship)) * (ship.id === 'spacehulk' || ship.profile.hulk ? 2 : 1)
/** The fleet may have no more attack craft in play than its working launch bays. Bays that carry orbital mines don't count. */
export function fleetCraftRoom (game, side) {
  const total = game.ships.filter(s => s.side === side && s.state === 'active' && s.pos && !s.mines).reduce((a, s) => a + baysOf(s), 0) * (raceRule(game.sides[side].fleet).doubleCraft ? 2 : 1)   // A fleet that cannot run out of ordnance has twice the limit
  const inPlay = game.ordnance.filter(o => o.kind === 'wave' && o.side === side).reduce((a, o) => a + o.markers.filter(k => k !== 'harpoon').length, 0)   // Harpoons are not counted with other ordnance for launch limits
  return total - inPlay
}
/** The kinds of craft this carrier may launch, in the fleet's row order. A craft that `needs` a flag (Lamia raiders, torpedo bombers) is offered only when the
 * ship (or its profile) has it: the fleet builder sets `ship.vampires`, `ship.torpedoBombers`. A ship's profile.craft can narrow it further. */
export const launchable = (game, ship) => craftRows(game.sides[ship.side].fleet)
    .filter(r => r.live && !r.harpoon && (!r.needs || (ship[r.needs] ?? ship.profile[r.needs])) && (!ship.profile.craft || ship.profile.craft.includes(r.kind)) && (!hasUp(ship, 'barge') || r.kind === 'assault boat')).map(r => r.kind)   // A Boarding Barge may only use assault boats

const plural = k => k + 's'
const mixText = (kinds, mix) => kinds.filter(k => mix[k]).map(k => `${mix[k]} ${mix[k] > 1 ? plural(k) : k}`).join(', ')

/** Launch a wave from a carrier in its Fire Phase. mix: { [craft kind]: count }, kinds from `launchable`. */
export function launchCraft (game, ship, mix, { combine = [] } = {}) {
  const refuse = r => ({ ok: false, reason: say(game, `${ship.name} can't launch attack craft: ${r}`) })
  const fleet = game.sides[ship.side].fleet, rows = craftRows(fleet).filter(r => r.live), ok = launchable(game, ship)
  const kinds = rows.map(r => r.kind)
  for (const k of Object.keys(mix)) if (mix[k] && !ok.includes(k)) {
    const r = rows.find(x => x.kind === k)
    return refuse(!r ? `its fleet has no ${k} squadrons` : r.needs && !(ship[r.needs] ?? ship.profile[r.needs]) ? `it is not equipped with ${k}s` : `it carries only ${ship.profile.craft.join('s and ')}s`)
  }
  const n = kinds.reduce((a, t) => a + (mix[t] ?? 0), 0)
  // Carriers of a squadron in base contact may launch one bigger wave together
  const partners = combine.map(u => shipByUid(game, u)), okP = partners.length ? combinePartners(game, ship, 'bays') : []
  for (const x of partners) if (!okP.includes(x)) return refuse(`${x?.name ?? 'that ship'} isn't a loaded squadron carrier in base contact`)
  if (ship.state === 'active' && game.phase === 'shooting' && ship.side === game.active && hasVariableBays(ship) && ship.bayRoll?.key !== turnKey(game)) rollBays(game, ship)   // (the launch roll is this reading)
  const capacity = [ship, ...partners].reduce((a, x) => a + baysOf(x), 0)
  if (!countBays(ship) && !ship.profile.weapons.some(w => w.kind === 'bays')) return refuse('it has no launch bays')
  if (isPhageShip(ship) && isCrippled(ship)) return refuse('a crippled bio-ship may no longer launch ordnance')
  if (ship.mines) return refuse('its bays carry orbital mines instead of attack craft')
  if (game.phase !== 'shooting' || ship.side !== game.active) return refuse('ordnance is launched in your own Fire Phase')
  if (ship.state !== 'active' || ship.lockedWith || ship.noFireRound === game.round || ship.standby) return refuse('it can\'t launch this turn')
  if (ship.crits.bays || !countBays(ship)) return refuse('its ordnance bays are damaged (a damaged keel armament counts too)')
  if (!ship.loaded.bays) return refuse('its bays must be reloaded first — Reload Ordnance orders')
  if (n < 1) return refuse('choose at least one squadron')
  if (n > capacity) return refuse(`${partners.length ? 'together they' : 'it'} can launch at most ${capacity} squadrons now`)
  if (n > fleetCraftRoom(game, ship.side)) return refuse(`the fleet may have no more attack craft in play than its launch bays, room for ${Math.max(0, fleetCraftRoom(game, ship.side))}`)
  const markers = kinds.flatMap(t => Array(mix[t] ?? 0).fill(t))
  // A Boarding Barge adds one assault boat marker to every normal launch (still while crippled or braced, but not when both)
  if (hasUp(ship, 'barge') && markers.length && !(isCrippled(ship) && ship.order?.kind === 'brace')) { markers.push('assault boat'); say(game, `${ship.name} is a Boarding Barge: one extra assault boat marker joins the wave`) }
  ship.loaded.bays = false
  for (const x of partners) x.loaded.bays = false
  if (partners.length) say(game, `${[ship, ...partners].map(x => x.name).join(', ')} launch their attack craft together as one wave`)
  game.ordnance.push({ id: game.nextId++, kind: 'wave', side: ship.side, from: ship.uid, pos: { ...ship.pos }, markers, r: waveR(markers.length), moved: false, fresh: true, fleet, launchKey: turnOf(game), ...(hasUp(ship, 'excellent') ? { excellent: true } : {}) })
  say(game, `${ship.name} launches a wave of ${mixText(kinds, mix)}`)
  return { ok: true }
}
export const waveSpeed = w => Math.min(...w.markers.map(k => craftSpeed(w.fleet, k)))   // the slowest

/** Take one marker out of a wave, the first that does `prefer` ('fighter' first when anything shoots at or fights a wave), else the last. Shot down or removed outright. */
function loseOne (w, prefer = 'fighter') {
  const i = w.markers.findIndex(k => actsAs(w.fleet, k, prefer))
  w.markers.splice(i >= 0 ? i : w.markers.length - 1, 1)
  w.r = waveR(Math.max(1, w.markers.length))
}
const pickIndex = (w, prefer = 'fighter') => { const i = w.markers.findIndex(k => actsAs(w.fleet, k, prefer)); return i >= 0 ? i : w.markers.length - 1 }

/**
 * Marker i of wave w is removed by other ordnance (a fighter removes what it meets and goes with it). A resilient craft rolls a 4+ save instead, once
 * each Ordnance Phase; `by` is the row of the enemy craft doing it, null for a torpedo or a mine. If it saves, it stops where the contact was and
 * splits off from its wave to wait there, and the rest of the wave goes on. A craft that has already saved this phase has no save: it is removed.
 * `force` = no save at all (it is the second craft in a meeting that involves one already used up). Returns true if the marker is gone, false if it stayed.
 */
export function knockOut (game, w, i, by, at, opts = {}) {
  const kind = w.markers[i], gone = knockOutNow(game, w, i, by, at, opts)
  // game.onFx 'dogfight': the board draws the craft twisting round where they met and, if it went, falling (battle/fx.js dogfightFx); drawing only
  game.onFx?.({ kind: 'dogfight', at: at ? { x: at.x, y: at.y } : { ...w.pos }, side: w.side, fleet: w.fleet, craft: kind, gone })
  return gone
}
function knockOutNow (game, w, i, by, at, { force = false } = {}) {
  const kind = w.markers[i], row = rowOf(w.fleet, kind)
  // Excellent Pilots (High Helm's flagship): fighters that intercept attack craft or torpedoes stay in play on a D6 roll of 4+
  // instead of being removed
  if (!force && w.excellent && !row?.resilient && actsAs(w.fleet, kind, 'fighter')) {
    const r = d6(game.rng)
    say(game, `Excellent Pilots: a fighter that should be removed rolls ${r}, stays in play on 4+: ${r >= 4 ? 'it stays' : 'removed'}`)
    if (r >= 4) return false
  }
  const can = !force && row?.resilient && !isSpent(game, w) && (row.resilient !== 'fighters' || by?.acts.includes('fighter'))
  if (can) {
    const r = d6(game.rng), ok = r >= 4
    say(game, `A resilient ${kind} is removed: it saves on a 4+, rolled ${r} — ${ok ? 'it stays where it met the enemy and can move no more this phase' : 'removed'}`)
    if (ok) {
      if (w.markers.length === 1) { w.spentKey = phaseKey(game); w.pos = { ...at }; w.moved = true }
      else {
        w.markers.splice(i, 1); w.r = waveR(w.markers.length)
        game.ordnance.push({ ...w, id: game.nextId++, markers: [kind], r: waveR(1), pos: { ...at }, moved: true, spentKey: phaseKey(game), fresh: false, attackedShip: false })
      }
      return false
    }
  } else if (row?.resilient && isSpent(game, w) && !force) say(game, `A resilient ${kind} that has already saved this phase is met again, so it is removed`)
  w.markers.splice(i, 1); w.r = waveR(Math.max(1, w.markers.length))
  return true
}
const air = { fighterAt, knockOut }   // handed to moveMines (rules/defences.js), which can't import this file

/** Two waves meet: each fighter removes one enemy squadron, fighters first, and is removed with it, unless a resilient craft saves. */
function dogfight (game, a, b, at) {
  let fights = 0
  for (const [x, y] of [[a, b], [b, a]]) {
    while (hasFighter(x) && y.markers.length) {
      const fi = fighterAt(x), yi = pickIndex(y, 'fighter'), xr = rowOf(x.fleet, x.markers[fi]), yr = rowOf(y.fleet, y.markers[yi])
      const ySpent = isSpent(game, y)
      fights++
      knockOut(game, y, yi, xr, at)
      knockOut(game, x, fi, yr, at, { force: ySpent })   // A marker that already saved and is attacked again goes, and the one that attacked it
    }
  }
  if (fights) say(game, `Attack craft meet: ${fights} fight${fights > 1 ? 's' : ''}, each fighter and its victim removed`)
  for (const w of [a, b]) if (!w.markers.length) remove(game, w)
  return fights
}

/**
 * Move a wave up to its speed towards `dest` in the Ordnance Phase (attack craft turn freely). The player
 * whose turn it is moves first: the other side's waves wait until all of theirs have moved. Along the way, in the
 * order met: Blast Markers and clouds (a 6 removes the whole wave, once a move), an aether rift destroys it,
 * enemy ordnance (fighters fight it), and the first enemy ship touched is attacked, ending the move.
 */
export function moveWave (game, id, dest, { cap } = {}) {
  const w = game.ordnance.find(o => o.id === id && o.kind === 'wave')
  const refuse = r => ({ ok: false, reason: say(game, `That wave can't move: ${r}`) })
  if (!w) return refuse('there is no such wave')
  if (game.phase !== 'ordnance') return refuse('attack craft move in the Ordnance Phase')
  if (w.moved) return refuse(w.cap ? 'it moved with its ship on combat air patrol this turn' : isSpent(game, w) ? 'it saved against other ordnance and can move no more this phase' : 'it has already moved this phase')
  const guard = cap != null ? shipByUid(game, cap) : null
  if (cap != null) {
    if (!guard || guard.side !== w.side || guard.state !== 'active') return refuse('combat air patrol is flown over a friendly ship')
    if (!w.markers.every(k => actsAs(w.fleet, k, 'fighter'))) return refuse('only fighters go on combat air patrol; launch fighters as their own wave')
    dest = guard.pos
  }
  if (w.cap) { say(game, 'The fighters leave combat air patrol'); w.cap = null }
  if (w.side !== game.active && game.ordnance.some(o => o.kind === 'wave' && o.side === game.active && !o.moved)) return refuse('the player whose turn it is moves all their ordnance first')
  const sp = waveSpeed(w), a = { ...w.pos }
  let d = Math.hypot(dest.x - a.x, dest.y - a.y)
  const b = d > sp ? along(a, Math.atan2(dest.y - a.y, dest.x - a.x) * 180 / Math.PI, sp) : dest
  d = Math.min(d, sp)
  const L = Math.max(d, 1e-9), events = []
  let bm = null
  for (const m of game.blast) { const t = firstContact(a, b, w.r, m, BLAST_R); if (t != null && (bm == null || t < bm)) bm = t }
  for (const c of clouds(game)) { const x = firstTouch(c.shape, a, b, w.r); if (x != null && (bm == null || x / L < bm)) bm = x / L }
  if (bm != null) events.push({ t: bm, kind: 'blast' })
  for (const tr of terrainOf(game, 'rift')) { const x = firstTouch(tr.shape, a, b, w.r); if (x != null) events.push({ t: x / L, kind: 'rift' }) }
  if (phageLanding(game, w)) for (const tr of phenomena(game).filter(t => t.kind === 'planet')) { const x = firstTouch(tr.shape, a, b, w.r); if (x != null) events.push({ t: x / L, kind: 'planet' }) }   //
  for (const o of game.ordnance) { if (o === w || o.side === w.side || ordnanceDisguised(game, o)) continue; const t = firstContact(a, b, w.r, o.pos, o.r); if (t != null) events.push({ t, kind: 'ord', o }) }
  for (const s of onTable(game)) { if (s.side === w.side) continue; const t = firstContact(a, b, w.r, s.pos, baseR(s)); if (t != null) events.push({ t, kind: 'ship', s }) }
  events.sort((x, y) => x.t - y.t)
  w.moved = true
  say(game, `A wave (${w.markers.join(', ')}) moves ${Math.round(d * 10) / 10} cm`)
  for (const e of events) {
    if (!game.ordnance.includes(w)) return { ok: true }
    w.pos = lerp(a, b, e.t)
    if (e.kind === 'blast') {
      const r = d6(game.rng)
      say(game, `The wave crosses Blast Markers: rolled ${r}, the whole wave is lost on a 6`)
      if (r === 6) { remove(game, w); return { ok: true } }
    } else if (e.kind === 'planet') {   // In a Planetary Assault every assault boat marker that reaches the surface scores one Assault Point; the other craft fly on
      const boats = w.markers.filter(k => actsAs(w.fleet, k, 'boat')).length
      if (!boats) continue
      w.markers = w.markers.filter(k => !actsAs(w.fleet, k, 'boat')); w.r = waveR(Math.max(1, w.markers.length)); game.assaultPoints += boats
      say(game, `${boats} Phage assault boat marker${boats > 1 ? 's' : ''} reach the surface: ${boats} Assault Point${boats > 1 ? 's' : ''}, ${game.assaultPoints} in all`)
      if (!w.markers.length) { remove(game, w); return { ok: true } }
    } else if (e.kind === 'rift') { say(game, 'The wave flies into the aether rift and is destroyed'); remove(game, w); return { ok: true } }
    else if (e.kind === 'ord') {
      if (!game.ordnance.includes(e.o)) continue
      if (e.o.kind === 'wave') dogfight(game, w, e.o, w.pos)
      else if (hasFighter(w)) {
        // fighters meet a torpedo salvo or a mine: both removed, unless the fighter is resilient and saves
        knockOut(game, w, fighterAt(w), null, w.pos); remove(game, e.o)
        say(game, 'Fighters intercept a torpedo salvo: both are removed')
        if (!w.markers.length) remove(game, w)
      }
      saved(game)
      if (game.ordnance.includes(w) && isSpent(game, w)) { return { ok: true } }   // it saved: it stops where the contact was
    } else if (e.kind === 'ship') { craftAttack(game, w, e.s); return { ok: true } }
  }
  if (game.ordnance.includes(w)) w.pos = b
  if (guard && game.ordnance.includes(w) && dist(w.pos, guard.pos) <= baseR(guard) + w.r + 1e-6) {
    w.cap = guard.uid; w.pos = { ...guard.pos }
    say(game, `The fighters go on combat air patrol with ${guard.name}: they move with it and screen it from enemy ordnance`)
  } else if (guard && game.ordnance.includes(w)) say(game, `The fighters can't reach ${guard.name} this phase`)
  return { ok: true }
}

/** A wave attacks a ship: turrets fire once at the whole wave, fighters shot first; bombers
 * make D6 minus turrets attacks each against the lowest armour, plus one per fighter in the wave (no more than the
 * bombers left); assault boats make a Hit-and-Run attack each; then the wave is gone. Shields don't stop it. */
export function craftAttack (game, w, ship) {
  // Fighters do nothing to a ship and steer clear of its turrets; the marker stays in play. Torpedo bombers don't bomb.
  // game.onFx 'craft': the board draws the wave circling the ship (battle/fx.js craftRun) — drawing only, it decides nothing
  const fxRun = { kind: 'craft', to: ship, side: w.side, fleet: w.fleet, from: { ...w.pos }, markers: [...w.markers], down: 0, bombers: 0, hits: 0 }
  if (!canAttackShip(w)) { game.onFx?.({ ...fxRun, harmless: true }); say(game, `${w.markers.some(k => rowOf(w.fleet, k)?.torpedoOnly) ? 'Torpedo bombers' : 'Fighters'} reach ${ship.name}: they can do nothing to a ship and stay in play`); return }
  w.attackedShip = true
  w.attackedAny = true; reveal(game, shipByUid(game, w.from))   // A mimic ship's ordnance that attacks gives it away
  if (capScreen(game, ship, w)) return
  saved(game)   // a Dropwing that saved against the ship's CAP fighters stopped in base contact and still makes its attack
  offerBrace(game, ship, { by: w, what: 'attack craft', key: `wave-${w.id}` })
  const rowsOf = () => w.markers.map(k => rowOf(w.fleet, k))
  // turret suppression comes from plain fighters only; a Dropwing is an assault boat and an Annihilator a bomber with a bonus of its own
  const fighters = rowsOf().filter(r => r.acts.includes('fighter') && !r.acts.includes('bomber') && !r.acts.includes('boat')).length
  // Before the turrets fire, the player declares which markers skip their attack run to suppress turrets instead (game.decide.annihilatorForgo)
  const annBefore = rowsOf().filter(r => r.annihilator).length
  const forgo = annBefore > 1 ? Math.max(0, Math.min(annBefore - 1, +game.decide.annihilatorForgo?.(game, ship, { annihilators: annBefore, turrets: turretsOf(ship) }) || 0)) : 0
  // Before the turrets fire, the player declares which markers skip their attack run to suppress turrets instead (game.decide.buzzaForgo)
  const fBefore = rowsOf().filter(r => r.buzzaDropper).length
  const fDecl = fBefore > 1 ? Math.max(0, Math.min(fBefore - 1, +game.decide.buzzaForgo?.(game, ship, { markers: fBefore, turrets: turretsOf(ship) }) || 0)) : 0
  const tur = turretDice(game, ship, 'craft', w)
  if (tur > 0) {
    const tn = turretNeed(game, w), t = rollTurrets(game, ship, tur, tn), down = Math.min(w.markers.length, t.hits)
    say(game, `${ship.name}'s ${tur} turret${tur > 1 ? 's' : ''} fire at the wave: ${t.text}, needed ${tn}+${tn === 6 ? ' (Athanatoi ordnance)' : ''}: ${down} squadron${down === 1 ? '' : 's'} shot down, fighters first`)
    for (let i = 0; i < down; i++) loseOne(w, 'fighter')
    fxRun.down = down
  }
  // Annihilators that forwent their runs soak the turret fire first: survivors split into attackers and forgoers
  const annLeft = rowsOf().filter(r => r.annihilator).length, lost = annBefore - annLeft
  const forgoLeft = Math.max(0, forgo - lost), annAttack = annLeft - forgoLeft
  const fLeft = rowsOf().filter(r => r.buzzaDropper).length, fForgoLeft = Math.max(0, fDecl - (fBefore - fLeft)), fAttack = fLeft - fForgoLeft   // turret hits take the suppressors first
  const bomberRows = rowsOf().filter(r => r.acts.includes('bomber') && !r.torpedoOnly)
  const attackRows = bomberRows.slice(0, bomberRows.length - forgoLeft - fForgoLeft)   // the forgoers are the last Annihilators in the wave
  const bombers = attackRows.length
  const boats = w.markers.filter(k => actsAs(w.fleet, k, 'boat')).length
  if (forgo && annAttack < 1) say(game, `Every Annihilator that meant to attack was shot down by the turrets: the wave makes no attack run`)
  if (fDecl && fAttack < 1) say(game, 'Every buzza that meant to attack was shot down: the wave makes no attack run')
  if (bombers && !(forgo && annAttack < 1) && !(fDecl && fAttack < 1)) {
    const turrets = turretsOf(ship), rolls = rollDice(game.rng, bombers)
    // Athanatoi Phoenix and Eagle bombers may re-roll their number of attacks, the second roll standing. The re-roll is the
    // player's choice: the game asks through game.decide.rerollAttacks, and headless (no answer given) there is no re-roll.
    let attacks = 0
    const shown = rolls.map((r0, i) => { let r = r0
      if (attackRows[i].d3) r = Math.ceil(r / 2)   // A buzza squadron rolls a D3 against a ship, not a D6
      const kept = Math.max(0, r - turrets - (hasUp(ship, 'mucous') ? 1 : 0))   // Mucous Membrane, -1 on the Attack roll
      if ((attackRows[i].rerollAttacks || w.excellent) && game.decide.rerollAttacks?.(game, ship, { roll: r, turrets, attacks: kept, craft: attackRows[i] })) {
        const again = d6(game.rng); attacks += Math.max(0, again - turrets - (hasUp(ship, 'mucous') ? 1 : 0)); return `${r} re-rolled to ${again}`
      }
      attacks += kept; return String(r)
    })
    // Each Annihilator that survives turrets gets +1 attack after the turret reduction, so it makes at least one; each forgoer adds one more, up to the
    // ship's turrets or the surviving attacking Annihilators, whichever is fewer
    const annBonus = annAttack > 0 ? annAttack : 0, forgoBonus = Math.min(forgoLeft, turrets, annAttack)
    attacks += annBonus + forgoBonus
    // Each buzza that survives the turrets adds +1 attack (so each makes at least one), and each marker that forwent its run adds one more, as many as the ship
    // has turrets or there are surviving attackers, whichever is fewer (the number declared counts, even if one of them was shot down)
    if (fAttack > 0) { const fb = fAttack + Math.min(fDecl, turrets, fAttack); attacks += fb; say(game, `Buzzas: +${fAttack} (one for each marker that survived the turrets)${fDecl ? `, +${Math.min(fDecl, turrets, fAttack)} from ${fDecl} marker${fDecl > 1 ? 's' : ''} that forwent their runs` : ''} = +${fb} attacks`) }
    // turret suppression: Athanatoi vessels have no real turrets, so escorting fighters give no bonus against them
    const bonus = isAthanatoiShip(ship) || raceRule(ship.profile.fleet).noTurretBonus ? 0 : Math.min(fighters, bombers)   //
    attacks += bonus
    const need = lowestArmour(ship)
    const hits = count(rollDice(game.rng, attacks), need)
    if ((isAthanatoiShip(ship) || raceRule(ship.profile.fleet).noTurretBonus) && fighters) say(game, `${ship.name} has no turrets for the escorting fighters to suppress`)
    say(game, `${bombers} bomber squadron${bombers > 1 ? 's' : ''} attack ${ship.name}: D6 each rolled ${shown.join(', ')}, minus ${turrets} turrets${annBonus ? `, +${annBonus} (one for each Annihilator)` : ''}${forgoBonus ? `, +${forgoBonus} from Annihilators that forwent their runs` : ''}${bonus ? `, +${bonus} for escorting fighters` : ''} = ${attacks} attacks against armour ${need}+: ${hits} hit${hits === 1 ? '' : 's'}, shields ignored`)
    // A mirage field saves once against each bomber hit
    const through = fieldSave(game, ship, hits, { what: 'bomber', from: w.pos, by: w, braceAsked: true }).through
    game.onFx?.({ ...fxRun, bombers, hits: through }); fxRun.sent = true   // sent before the damage, so the bombs fall before anything blows up
    damageShip(game, ship, through, { what: 'bombers' })
  }
  if (!fxRun.sent) game.onFx?.(fxRun)
  // the assault boats' landings (fx.js boatsFx): the event is sent first and each result written into it as it is rolled; the board draws
  // an action's events only once it has finished (battle.js act), so the results are there when it plays
  const fxBoats = { kind: 'boats', to: ship, side: w.side, fleet: w.fleet, results: [] }
  if (boats) game.onFx?.(fxBoats)
  // Dropwings and every Concord assault craft add +1 to their Hit-and-Run attacks (hitAndRun reads the craft's fleet)
  for (let i = 0; i < boats && ship.state === 'active'; i++) fxBoats.results.push(hitAndRun(game, ship, { name: 'assault boats', fleet: w.fleet, from: w.from }, { braceAsked: true, mod: hasUp(ship, 'mucous') ? -1 : 0 }))
  // A Harpoon that gets into contact makes a special Hit-and-Run attack (no Thnitoi +1); a roll of 1 loses the module for good
  const harpoons = w.markers.filter(k => k === 'harpoon').length
  for (let i = 0; i < harpoons && ship.state === 'active'; i++) {
    const by = { name: 'a Harpoon assault module', fleet: w.fleet, harpoon: true, from: w.from, pos: w.pos }
    hitAndRun(game, ship, by, { braceAsked: true })
    if (by.defeated) { const home = shipByUid(game, w.from); if (home) loseHarpoon(game, home) }
  }
  if (!bombers && !boats && !harpoons && w.markers.length) { say(game, 'The fighters left can do nothing to a ship and stay in play'); return }
  remove(game, w)
}

/**
 * A resilient craft (a Dropwing, or an Annihilator) that used its 4+ save and is left touching an enemy ship's base may still attack
 * it, as long as it needs no further move. Called for the waves that saved this phase.
 */
function saved (game, active) {
  for (const v of game.ordnance.filter(o => o.kind === 'wave' && o.spentKey === phaseKey(game) && !o.attackedShip && o.markers.length && canAttackShip(o))) {
    const t = onTable(game).find(s => s.side !== v.side && s.state === 'active' && dist(v.pos, s.pos) <= baseR(s) + v.r + 1e-6)
    if (t) { say(game, `The craft that saved is in base contact with ${t.name}: it attacks`); craftAttack(game, v, t) }
  }
}

// ---------------- Isos missiles ----------------
/**
 * Move an Isos missile salvo in the Ordnance Phase towards `dest` (a point): each Ordnance Phase it picks any speed from 20 to 40 cm and may first turn up to
 * 45 degrees, measured from the centre of the marker; no turn in the phase it was launched. The speed is the distance to `dest`, kept to 20-40 cm; the heading is the line to it, which in the launch phase is the launch heading.
 * The player whose turn it is moves first. It then attacks whatever it touches exactly as any torpedo does (moveTorpedo).
 */
export function moveMissile (game, id, dest) {
  const o = game.ordnance.find(x => x.id === id && x.kind === 'torpedo' && x.missile)
  const refuse = r => ({ ok: false, reason: say(game, `That missile salvo can't move: ${r}`) })
  if (!o) return refuse('there is no such missile salvo')
  if (game.phase !== 'ordnance') return refuse('missiles move in the Ordnance Phase')
  if (o.moved) return refuse('it has already moved this phase')
  if (o.side !== game.active && game.ordnance.some(x => x.missile && x.side === game.active && !x.moved)) return refuse('the player whose turn it is moves all their ordnance first')
  const heading = o.movedOnce ? Math.atan2(dest.y - o.pos.y, dest.x - o.pos.x) * 180 / Math.PI : o.facing
  const turn = Math.abs(norm(heading - o.facing))
  if (turn > 45 + 1e-6) return refuse(`it can turn only 45 degrees at the start of its move, that is ${Math.round(turn)}`)
  const want = o.movedOnce ? Math.hypot(dest.x - o.pos.x, dest.y - o.pos.y) : Math.max(0, (dest.x - o.pos.x) * Math.cos(o.facing * Math.PI / 180) + (dest.y - o.pos.y) * Math.sin(o.facing * Math.PI / 180))
  const speed = Math.max(o.minSpeed, Math.min(o.maxSpeed, want))
  o.facing = norm(heading); o.speed = speed; o.moved = true; o.movedOnce = true
  say(game, `An Isos missile salvo (strength ${o.str}) ${turn > 1e-6 ? `turns ${Math.round(turn)} degrees and ` : ''}moves ${Math.round(speed * 10) / 10} cm (20-40 cm)`)
  moveTorpedo(game, o)
  return { ok: true }
}
/** The end of an Ordnance Phase: a missile salvo nobody moved goes straight on its minimum move, 20 cm. */
export function autoMoveMissiles (game) {
  for (const o of game.ordnance.filter(x => x.kind === 'torpedo' && x.missile && !x.moved)) {
    o.speed = o.minSpeed; o.moved = true; o.movedOnce = true
    say(game, `An Isos missile salvo was not steered, so it flies straight on ${o.speed} cm`)
    moveTorpedo(game, o)
  }
}

// ---------------- torpedo bombers ----------------
/**
 * Swap torpedo bomber squadrons of a wave for a Strength 2 torpedo salvo each, all combined into one salvo (a wave's torpedo bombers may merge
 * their salvoes), aimed at `heading` degrees. At the beginning of an Ordnance Phase, so before the wave has moved, and not in the phase the wave was launched
 * in. The salvo moves at once, as a standard torpedo, at the row's `salvoSpeed`, and is removed at the end of this Ordnance Phase (expireTorpedoes).
 * An Athanatoi salvo re-rolls its misses and is hit by turrets on a 6 only, being Athanatoi ordnance. `count` squadrons, default all of them.
 */
export function convertTorpedoBombers (game, id, heading, { count: n, separate = false } = {}) {   // separate: Rukka tin-fishers may merge into one salvo or launch any number of markers as salvoes of their own
  const w = game.ordnance.find(o => o.id === id && o.kind === 'wave')
  const refuse = r => ({ ok: false, reason: say(game, `Torpedo bombers can't launch their torpedoes: ${r}`) })
  if (!w) return refuse('there is no such wave')
  if (game.phase !== 'ordnance') return refuse('only at the beginning of an Ordnance Phase')
  if (w.moved) return refuse('they have already moved this phase, so it is no longer the beginning of it')
  if (w.launchKey === turnOf(game)) return refuse('not in the Ordnance Phase they were launched in; use ordinary bombers to attack at close range')
  const idx = w.markers.map((k, i) => rowOf(w.fleet, k)?.torpedoOnly ? i : -1).filter(i => i >= 0)
  const take = Math.min(n ?? idx.length, idx.length)
  if (take < 1) return refuse('the wave holds no torpedo bombers')
  const row = rowOf(w.fleet, w.markers[idx[0]])
  for (const i of idx.slice(0, take).reverse()) w.markers.splice(i, 1)
  w.r = waveR(Math.max(1, w.markers.length))
  const t = { id: game.nextId++, kind: 'torpedo', side: w.side, from: null, str: 2 * take, speed: row.salvoSpeed ?? 30, pos: { ...w.pos }, facing: heading, r: TORPEDO_R, fresh: false, attacked: {}, fleet: w.fleet, expires: phaseKey(game) }
  if (!w.markers.length) remove(game, w)
  if (separate && take > 1) {
    t.str = 2
    const extra = Array.from({ length: take - 1 }, () => ({ ...t, id: game.nextId++, attacked: {} }))
    game.ordnance.push(t, ...extra)
    say(game, `${take} tin-fisher squadrons each become a Strength 2 salvo, launched separately, heading ${Math.round(norm(heading))}°`)
    for (const x of [t, ...extra]) moveTorpedo(game, x)
    return { ok: true, torpedo: t }
  }
  game.ordnance.push(t)
  say(game, `${take} torpedo bomber squadron${take > 1 ? 's' : ''} become a Strength ${t.str} torpedo salvo (2 each), heading ${Math.round(norm(heading))}°, speed ${t.speed} cm; it is removed at the end of this Ordnance Phase`)
  moveTorpedo(game, t)
  return { ok: true, torpedo: t }
}
/** The end of an Ordnance Phase: torpedoes the bombers made have run out of fuel. */
export function expireTorpedoes (game) {
  rukkaCapacityCull(game)
  for (const o of game.ordnance.filter(x => x.kind === 'torpedo' && x.expires === phaseKey(game))) { remove(game, o); say(game, 'A torpedo bomber salvo runs out of fuel and is removed') }
}

// ---------------- orbital mines carried instead of craft ----------------
/**
 * A cruiser refitted for mines (`ship.mines`, set by the fleet builder; +5 points per bay strength) launches one orbital mine per launch bay strength
 * from its stem at the end of its Manoeuvre Phase. Mines can't form waves, are not counted against the fleet's attack craft limit, and the bays that
 * hold them are left out of that limit (fleetCraftRoom). The mine then behaves as in (rules/defences.js); an Athanatoi mine is hit by turrets on a 6
 * only. Reloading is the same as for craft.
 */
export function launchMines (game, ship) {
  const refuse = r => ({ ok: false, reason: say(game, `${ship.name} can't launch orbital mines: ${r}`) })
  if (!ship.mines) return refuse('it is not refitted to carry them')
  if (ship.profile.role !== 'cruiser' && !isPhageShip(ship)) return refuse('only cruisers may carry orbital mines')   // Great Spore Mines for any Phage capital ship with assault boat bays
  const spore = isPhageShip(ship)   // A Phage ship's launch bays each launch one great spore mine in the Ordnance Phase
  if (spore ? (game.phase !== 'ordnance' || ship.side !== game.active) : (game.phase !== 'movement' || ship.side !== game.active)) return refuse(spore ? 'great spore mines are launched in your own Ordnance Phase' : 'mines are launched at the end of your own Manoeuvre Phase')
  if (ship.state !== 'active' || (!spore && !ship.movedThisPhase)) return refuse('it launches them from its stem once it has moved')
  if (ship.crits.bays || !countBays(ship)) return refuse('its bays are damaged')
  if (!ship.loaded.bays) return refuse('its bays are empty: Reload Ordnance orders')
  const n = baysOf(ship)
  ship.loaded.bays = false
  for (let i = 0; i < n; i++) game.ordnance.push({ id: game.nextId++, kind: 'mine', side: ship.side, pos: { ...ship.pos }, r: MINE_R, purchased: false, attacked: {}, fleet: game.sides[ship.side].fleet, from: ship.uid })
  say(game, `${ship.name} launches ${n} orbital mine${n > 1 ? 's' : ''} from its stem; every Ordnance Phase each mine drifts 10 cm towards the closest enemy ship`)
  return { ok: true, launched: n }
}

// ---------------- the Rukka launch capacity ----------------
/**
 * While Rukka attack craft are in play, a Rukka fleet with dice-rated launch bays checks its craft capacity in each of its own Ordnance Phases:
 * roll the dice of every ship with dice-rated bays and add the fixed bay Strength of the other carriers; the sum is the fleet's capacity. Bays are halved for crippling and bracing and a hulk's doubled as for launching. Run at the start of the active player's Ordnance Phase.
 */
export function rukkaCapacityCheck (game) {
  const side = game.active
  if (!raceRule(game.sides[side].fleet).variableLaunch) return
  const carriers = game.ships.filter(s => s.side === side && s.state === 'active' && s.pos && !s.mines)
  const inPlay = game.ordnance.filter(o => o.kind === 'wave' && o.side === side).reduce((a, o) => a + o.markers.length, 0)
  if (!inPlay || !carriers.some(hasVariableBays)) return
  for (const s of carriers) if (hasVariableBays(s)) rollBays(game, s, 'capacity')
  const total = carriers.reduce((a, s) => a + baysOf(s), 0)
  ;(game.craftCap ??= {})[side] = { key: turnKey(game), total }
  say(game, `${game.sides[side].name}: launch capacity check — the fleet can keep ${total} attack craft in play, ${inPlay} are`)
}
/** The end of that Ordnance Phase: craft above the capacity run out of fuel and are removed (use them or lose them). The owner picks which (game.decide.dropCraft(game, side, excess) -> wave ids, one marker each); headless the last ones go. */
export function rukkaCapacityCull (game) {
  const side = game.active, cap = game.craftCap?.[side]
  if (!cap || cap.key !== turnKey(game)) return
  const waves = () => game.ordnance.filter(o => o.kind === 'wave' && o.side === side)
  let excess = waves().reduce((a, o) => a + o.markers.length, 0) - cap.total
  if (excess <= 0) return
  const asked = game.decide.dropCraft?.(game, side, excess) ?? []
  const loseMarker = w => { w.markers.pop(); w.r = waveR(Math.max(1, w.markers.length)); excess--; if (!w.markers.length) remove(game, w) }
  for (const id of asked) {   // the owner's picks, one marker each
    const w = game.ordnance.find(o => o.id === id)
    if (excess > 0 && w?.markers.length && game.ordnance.includes(w)) loseMarker(w)
  }
  for (const w of waves().reverse()) while (excess > 0 && w.markers.length && game.ordnance.includes(w)) loseMarker(w)   // the rest: the last waves launched
  say(game, `Attack craft above the fleet's capacity of ${cap.total} run out of fuel and are removed`)
}
