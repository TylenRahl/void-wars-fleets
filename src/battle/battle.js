// THE BATTLE PAGE (battle.html): the start screen, the set-up and fleet builder, then the hotseat battle. Every rule is
// in src/rules; this file draws the board, takes the players' choices, and shows the log (every roll and what was needed).
// It is the page's entry script and exports nothing.
//
// Its sections, in order (each starts with a divider comment):
//   SET-UP          the scenario, fleets, commanders and table chosen before a battle; saved fleets; the fleet builder
//   THE PAGES       moving between the start screen, set-up, rules and settings pages
//   THE BATTLE      starting a game, the computer player, actions (each one engine call, then a redraw), the camera
//                   and cinematic zoom, moving and sailing by the mouse, the boarding finder
//   the board       the SVG table: ships, their state, shields, the placing shadow, celestial phenomena, ordnance
//   the side panel  the selected ship's orders and weapons, scenario controls, docking, the log and score
//   the plates      the turn card, ship card, "What now?" guide and help box around the table (hud.js)
//   action pips     the buttons drawn on the board beside each ship and target
//   input           clicks, keys, zoom and pan, and the hover help
//
// The board is one SVG with a viewBox in centimetres, the engine's units, so nothing here converts pixels to rules:
// a click is turned into cm by the SVG's own transform and handed to the engine as it is.
import { SEA, SEA_FLEETS } from '../skin.js'   // FIRST: the Space / Sea skin renames the fleets before anything is drawn (Tides of the Archipelago)
import { ALL_SHIPS, shipById, sizeOf } from '../data/ships.js'
// the builder works in classes: a Phage ship is its bare class id plus weapon choices (data/phageLists.js keys), while ALL_SHIPS holds each class once under its long loadout id
const SHIPS = [...ALL_SHIPS, ...['pha-hive', 'pha-cruiser', 'pha-gulper', 'pha-vanguard', 'pha-drone'].map(k => ({ ...shipById(k), id: k }))]
import { NEW_FLEETS, notYet } from '../data/fleets.js'
import { hasLists, listsOf, listDef, splitShipId, resolveShipId, CLASSES } from '../data/fleetLists.js'
import { listFromForm } from '../data/listForm.js'
import { sampleFleet } from '../data/sampleFleets.js'
import { createComputer, computerSides } from './computerTurn.js'   // the computer player (rules/computer.js)
import { COMPUTER_DECIDE, agroundHeading } from '../rules/computer.js'
import { listContext, upgradesFor } from '../rules/listCheck.js'
import { firmsCommands } from '../data/rukkaLists.js'
import { TABLES, CATALOGUE, piece, partsBox } from '../view/boardArt.js'
import { startSeaWeather } from './seaWeather.js'
import { FIGURES } from '../view/seaFigures.js'
import { seaShipPicture, seaCraftPicture, seaTorpedoPicture, seaFortPicture, seaFortQuadrant, SEA_SCHEMES, SEA_GROW } from '../view/seaPictures.js'   // the sea fleets' pictures (Tides of the Archipelago)
import { seaTableSvg, islandSvg, wakeSvg, WAKE_DEFS, seaCss, seaMaskSvg } from '../view/seaArt.js'   // the sea skin's table, islands and wakes
import { tableSvg, pieceSvg, svgUrl } from '../view/boardSvg.js'
import { artFor } from '../view/shipArt.js'
import { createCruiserClash, placeShip, placeProblem, allPlaced, victoryPoints, zoneOf, MAX_POINTS, checkForces } from '../rules/cruiserClash.js'
import { createFleetBattle, placeFleetShip, fleetPlaceProblem, nextToPlace, fleetVictoryPoints, checkFleet, fleetPoints, COMMANDERS, MARKS, EXTRA_REROLLS, flagshipIndex } from '../rules/fleet.js'
import { startBattle, nextPhase, PHASE_NAMES } from '../rules/turn.js'
import { isCapital, ramTestDice, halved, ordnanceHalvings, giveOrder, ORDERS, commandModifiers, aheadFullSpec, baseR, mates, squadronOf, shipByUid, isCrippled, isHulk, leadershipOf, shieldsLeft, shieldsOf, turretsOf, remainingHits, orderOf, enemiesOf, isEscort, blastTouching, isBraced } from '../rules/game.js'
import { fireStarPulse, starPulseProblem, useOssuary, ossuaryProblem, fadeOut, portalProblem, portalCount } from '../rules/katharos.js'   // the Katharos
import { turnAfterAground, afterAgroundProblem } from '../rules/movement.js'
import { seaStandProblem } from '../rules/seaHull.js'   // Tides of the Archipelago: at sea a ship takes up its whole hull
import { checkMove, moveShip, disengage, turnDistance, speedOf, touching, canBoardFrom, boardReach, SEA_BOARD_RANGE, pathBlocked, ramReach, isSailor, sunBands, sailOptions, sailMove, secondMoveProblem, ordnanceMoved } from '../rules/movement.js'
import { fireShip, fireSunburst, canReach, canTarget, weaponStrength, weaponWorks, weaponArcs, nearestEnemy, SUNBURST, GUN_KINDS, isLance } from '../rules/shooting.js'
import { frontArmour } from '../rules/armour.js'
import { launchTorpedoes, moveMissile, launchCraft, moveWave, waveSpeed, baysOf, fleetCraftRoom, launchable, hasFighter, canAttackShip, convertTorpedoBombers, launchMines, capOf, releaseCap } from '../rules/ordnance.js'
import { rowOf } from '../data/craft.js'
import { canTeleport } from '../rules/endPhase.js'
import { fieldOf } from '../rules/miragefield.js'
import { ordnanceCost, ORDNANCE_PRICES } from '../data/phageLists.js'
const ORDNANCE_LABEL = { tb: 'Boarding torpedo', boat: 'Assault boat', fighter: 'Fighter' }
import { scent, scentHives, controlled, contactNow, hasContactWeapons, beginInstinct, isPhage, instinct } from '../rules/phage.js'
import { raceRule } from '../data/raceRules.js'
import { hasUp, isPhageShip, SEA_TABLE } from '../rules/game.js'
import { guideHtml, helpHtml, diceHtml } from './hud.js'
import * as FX from './fx.js'
import * as Guns from './guns.js'
import { snapshot, restore, createAsker, Ask } from './replay.js'
import { sound, warm, soundOn, setSound } from './sound.js'
import { createActionPips } from '../shared/actionPips.js'
import { show, music } from './pages.js'
import { FLEET_NAME } from '../rules/names.js'
import { showTitle } from './startScreen.js'
import { showSettings } from './settingsPage.js'
import { battleDoors } from './blastDoors.js'
import { SCENARIOS, scenarioLimits, checkScenarioList, createScenario, nextScenarioPlace, placeScenarioShip, scenarioPlaceProblem, placeSpot, facingFor, facingLocked, entryFor, enterShip,
  goOnAlert, landTroops, assignContact, placeContact, setConvoyEntry, activateContact, placeMarker, markerSide, scenarioVP } from '../rules/scenarios.js'
import { LOW, enterLowOrbit, inLowOrbit, fromPlanetEdge } from '../rules/lowOrbit.js'
import { wellsAt } from '../rules/terrain.js'
import { DEFENCES, canBuy, buyDefence, sellDefence, doneBuying, detonateFireShip, guardOrbital } from '../rules/defences.js'
import { ORBITAL_MODULES, isosOrbital } from '../data/defences.js'
import { dockContacts, fullyDocked, fortOf, setRotates, together as fortTogether, standing as fortStanding, basilicaHolder } from '../rules/fort.js'
import { FORT_PICTURE_CM } from '../view/blueprint.js'
import { combinePartners } from '../rules/ordnance.js'
import { launchHarpoon, harpoonsReady, leechLoaded } from '../rules/thnitoi.js'
import { defenceArt, MINE_ART } from '../view/defenceArt.js'
import { CRITS, critName } from '../rules/damage.js'
import { shieldColour } from '../view/shieldFx.js'
import { along, angleTo, dist, norm, firstContact } from '../rules/geometry.js'
import { rollBattlezone, WELL, wellTurn, seaDefaultBattlezone } from '../rules/terrain.js'
import { SEA_DEFAULT_FLEETS, SEA_DEFAULT_POINTS, seaDefaultFleet } from '../data/seaDefaults.js'   // Tides of the Archipelago: a ready fleet for every sea race
import { arcsContaining } from '../rules/geometry.js'
import { lumpSlide } from '../rules/rukka.js'
import { fireSproglance } from '../rules/firms.js'
import { applyBattlezone, sunwardMatters, radiationNow } from '../rules/effects.js'
import { PLANET_TYPES } from '../view/boardArt.js'

const $ = id => document.getElementById(id)
const SIDE_CLASS = ['imp', 'chs'], SIDE_COLOUR = ['#6fb0ff', '#ff6a5a']
const store = {
  get (k, d) { try { return localStorage.getItem('vwf-battle-' + k) ?? d } catch { return d } },
  set (k, v) { try { localStorage.setItem('vwf-battle-' + k, v) } catch { /* private window: not remembered */ } },
}
const params = new URLSearchParams(location.search)

// ======================================== SET-UP ========================================
const setup = {
  lists: [[], []], table: store.get('table2', 'holographic'), style: store.get('style', 'sprite'),
  brace: params.get('brace') ?? store.get('brace', 'ask'), zone: SEA ? store.get('seazone', 'isles') : store.get('zone', 'none'),   // at sea its own choice, the default islands to start with
  reroll: params.get('reroll') ?? store.get('reroll', 'ask'),
  cine: params.get('cine') ?? store.get('cine', 'on'),
  computer: params.get('computer') ?? store.get('computer', 'none'),   // who the computer plays: none, a (the first fleet), b, both
  names: [null, null], attacker: +store.get('attacker', '1'), transports: +store.get('transports', '4'), transportSquadron: store.get('transportSquadron', '') === '1',
}
// the two plain tables, drawn here
// in SVG; the rest are the board art pictures (view/boardArt.js)
const LOOKS = [{ id: 'holographic', name: 'Holographic', cls: 'holo', grid: '#39d0ff', minor: 0.3, major: 0.65, around: '#020c14', holo: ['#0a4a68', '#03161f'] },
  { id: 'holographic-green', name: 'Holographic green', cls: 'holo-green', grid: '#3dff8a', minor: 0.3, major: 0.65, around: '#02120a', holo: ['#0a5a34', '#03180d'] }, { id: 'plain-blue', name: 'Plain blue', cls: 'blue', grid: '#ffffff', minor: 0.16, major: 0.34, around: '#0d2f55' }]
const lookOf = () => LOOKS.find(t => t.id === setup.table)
const SEA_GRID = { id: 'sea', grid: '#cdeeff', minor: 0.1, major: 0.22 }   // a faint chart grid on the sea
// the sea fleets' colour schemes, one per side, chosen at set-up
setup.seaScheme = (() => { try { const v = JSON.parse(store.get('seaScheme', '[]')); return Array.isArray(v) ? v : [] } catch { return [] } })()
function schemeOf (side, fleet) {
  const list = SEA_SCHEMES[fleet ?? (game?.sides?.[side]?.fleet)] ?? []
  return list.some(c => c.id === setup.seaScheme[side]) ? setup.seaScheme[side] : list[0]?.id
}
// who goes over in a teleport or a boarding party at sea, and who meets them (the figure pictures in view/seaFigures.js)
const SEA_BOARDERS = { freemen: ['human-greatsword', 'human-halberdier', 'human-captain-bsb'], athanatoi: ['elf-flameguard', 'elf-shoreguard'], rukka: ['orc-orc-boy', 'orc-big-orc', 'orc-orc-boy-shield'], dominion: ['dom-knight', 'dom-knight-champion'] }
const SEA_CREW = { freemen: ['human-handgunner', 'human-halberdier'], athanatoi: ['elf-shoreguard', 'elf-archer'], rukka: ['orc-orc-boy', 'orc-goblin'], dominion: ['dom-warrior', 'dom-warrior-shield'] }
const figHrefs = (list, fleet) => (list[fleet] ?? list.freemen).map(k => FIGURES[k]?.href).filter(Boolean)
const drawnPos = s => { const d = FX.drawnAt('ship:' + s.uid, s.pos.x, s.pos.y, s.facing); return { x: d.x, y: d.y } }
// THE END PHASE'S FIGHTS AND THE ATTACK CRAFT (fx.js). Drawn from the rules' own events (game.onFx in rules/endPhase.js
// and rules/ordnance.js), so they show what was rolled; drawing only. At sea the deck figures go over (the Orcs are thrown off the
// catapult at the stern), in space only the light and the flashes.
const SIDE_LIGHT = fleet => fleet === 'dominion' ? 0xff4a2a : fleet === 'athanatoi' ? 0x7fe6bc : fleet === 'rukka' ? 0xffd860 : 0x8fdcff
const figsFor = (list, fleet) => (SEA ? figHrefs(list, fleet) : [])
// how far from a ship's centre its hull's side is, towards point Q (cm): the hull read as the ellipse its shield bubble is drawn on (fx.js wardShape)
function hullEdge (s, Q) {
  const P = drawnPos(s), w = FX.wardShape(s), phi = Math.atan2(Q.y - P.y, Q.x - P.x) - w.rot * Math.PI / 180
  return 0.85 * w.rx * w.ry / Math.hypot(w.ry * Math.cos(phi), w.rx * Math.sin(phi))
}
const craftR = s => (SEA ? shipLen(s) * 0.5 : baseR(s)) + 1.5   // the circle the craft fly round a ship, cm
/** The pictures of a wave's squadrons, as waveSvg draws them; fighters first (the turrets shoot them down first). */
function craftPics (fleet, side, markers) {
  const rows = markers.map(t => rowOf(fleet, t)).filter(Boolean)
  const fighter = o => o.acts?.includes('fighter') && !o.acts.includes('bomber') && !o.acts.includes('boat')
  return [...rows.filter(fighter), ...rows.filter(o => !fighter(o))].map(o => {
    const sea = SEA && seaCraftPicture({ fleet, id: o.id, kind: o.kind, scheme: schemeOf(side, fleet) })
    return sea ? { href: sea, size: 2.6 } : { href: shipArt(o.id), size: 1.8 }
  })
}
function fightFx (e) {
  if (e.kind === 'teleport') {
    const s = e.from, t = e.to
    if (!s?.pos || !t?.pos) return true
    const fa = game.sides[s.side].fleet, p = drawnPos(s), f = s.facing * Math.PI / 180, back = SEA ? shipLen(s) * 0.38 : 0   // the teleport circle (the Orc catapult) is astern
    FX.teleportFx({ a: { x: p.x - Math.cos(f) * back, y: p.y - Math.sin(f) * back }, b: drawnPos(t), attackers: figsFor(SEA_BOARDERS, fa), defenders: figsFor(SEA_CREW, game.sides[t.side].fleet), thrown: SEA && fa === 'rukka', colour: SIDE_LIGHT(fa), ok: e.results.some(Boolean) })
    return true
  }
  if (e.kind === 'boarding') {
    const a = e.from, b = e.to
    if (!a?.pos || !b?.pos) return true
    const fa = game.sides[a.side].fleet
    // at sea the boarding is from range (Tides house rule): the boarder's own assault boats row across; in space the grapnels
    const boat = SEA ? seaCraftPicture({ fleet: fa, kind: 'assault boat', scheme: schemeOf(a.side, fa) }) : null
    FX.boardingFx({ a: drawnPos(a), b: drawnPos(b), attackers: figsFor(SEA_BOARDERS, fa), defenders: figsFor(SEA_CREW, game.sides[b.side].fleet), won: e.won, colour: SIDE_LIGHT(fa), boat, aR: SEA ? hullEdge(a, drawnPos(b)) : baseR(a) + 1, bR: SEA ? hullEdge(b, drawnPos(a)) : baseR(b) + 1 })
    return true
  }
  if (e.kind === 'collide') {   // a collision at sea (Tides house rule): where the two bases meet
    const a = e.from, b = e.to
    if (!a?.pos || !b?.pos) return true
    const pa = drawnPos(a), pb = drawnPos(b), k = baseR(a) / (baseR(a) + baseR(b))
    FX.collideFx({ p: { x: pa.x + (pb.x - pa.x) * k, y: pa.y + (pb.y - pa.y) * k } })
    return true
  }
  if (e.kind === 'craft') {
    const t = e.to
    if (!t?.pos) return true
    FX.craftRun({ from: e.from, to: drawnPos(t), R: craftR(t), hull: FX.wardShape(t), crafts: craftPics(e.fleet, e.side, e.markers), down: e.down, bombers: e.bombers, hits: e.hits, harmless: !!e.harmless })
    return true
  }
  if (e.kind === 'boats') {
    const t = e.to
    if (!t?.pos) return true
    FX.boatsFx({ to: drawnPos(t), attackers: figsFor(SEA_BOARDERS, e.fleet), defenders: figsFor(SEA_CREW, game.sides[t.side].fleet), results: e.results, torpedo: !!e.torpedo })
    return true
  }
  if (e.kind === 'dogfight') { FX.dogfightFx({ p: e.at, pic: craftPics(e.fleet, e.side, [e.craft])[0], gone: e.gone, side: e.side }); return true }
  return false
}
// a ship is drawn firing for a moment after it shoots (at other times its guns are drawn still)
const firingUntil = new Map()
const firingNow = s => (firingUntil.get(s.uid) ?? 0) > performance.now()
const isScenario = () => !!SCENARIOS[setup.mode]
const SQUADRON_ROLES = ['cruiser', 'heavy cruiser', 'battlecruiser', 'battleship', 'grand cruiser', 'lump']   // A gang of Lumps
const roleOf = side => side === setup.attacker ? 'attacker' : 'defender'
// what a ship can be marked as in a scenario, per tag: [value, label]
const TAG_OPTIONS = {
  reinforcement: [['', 'starts on the table'], ['reinforcement', 'reinforcement']],
  alert: [['', 'on standby'], ['alert', 'on alert']],
  standby: [['', 'on patrol'], ['standby', 'standby in high orbit']],
  patrol: [['', 'deployed'], ['patrol', 'on patrol']],
  worldbreaker: [['', '—'], ['worldbreaker', 'Worldbreaker']],
  division: [1, 2, 3, 4, 5].map(n => [String(n), `division ${n}`]),
}
// Merchants (the Isos' heavy transports, two transports each) and Waystations (bought from the defender's fleet points); only the Isos have either
const WAYSTATIONS = [['isos-waystation-bays', 'launch bay'], ['isos-waystation-hook', 'gravitic hook'], ['isos-waystation-railgun', 'railgun battery'], ['isos-waystation-ion', 'ion cannon']]
const scOpts = () => ({ sea: SEA, transports: setup.transports, transportSquadron: setup.transportSquadron, merchants: setup.merchants, waystations: WAYSTATIONS.flatMap(([id]) => Array(setup.way[id] ?? 0).fill(id)) })
// the Isos' extras, shown when an Isos fleet is in the scenario and can use them: Merchants in a Convoy or Planetary Assault, Waystations on the defending side
function isosExtrasHtml (sc) {
  const isos = side => fleetOf(side) === 'isos', def = 1 - setup.attacker
  let h = ''
  if (['convoy', 'assault'].includes(setup.mode) && (isos(0) || isos(1))) h += ` <label title="Each Merchant counts as two transports; at most half the transports">Merchants <input type="number" id="merchants" min="0" max="6" value="${setup.merchants}"></label>`
  if (!sc.symmetric && isos(def)) h += ` Waystations (bought from the defenders' points): ${WAYSTATIONS.map(([id, n]) => `<label>${n} <input type="number" data-way="${id}" min="0" max="4" style="width:3em" value="${setup.way[id] ?? 0}"></label>`).join(' ')}`
  return h
}
const sideLimits = () => scenarioLimits(setup.mode, +$('limit').value, setup.attacker, scOpts())
try { const l = JSON.parse(store.get('lists', '[["lantern"],["malice"]]')); if (Array.isArray(l) && l.length === 2) setup.lists = l } catch { /* keep the default */ }
setup.mode = SEA ? store.get('seamode', 'fleet') : store.get('mode', 'clash')   // at sea its own, a Fleet Engagement to start with: the default fleets are fleets
setup.merchants = +store.get('merchants', '0'); setup.way = (() => { try { return JSON.parse(store.get('way', '{}')) } catch { return {} } })()
setup.fleets = [{ ships: [], squads: [], cmd: '', rerolls: 0 }, { ships: [], squads: [], cmd: 'harrowadmiral-8', marks: [] }]
try { const f = JSON.parse(store.get('fleets', 'null')); if (f?.length === 2) setup.fleets = f } catch { /* keep the default */ }
// a fleet whose lists are data (data/fleetLists.js): ships are kept as their class plus weapon choices; a fleet saved before that had the variant's id and no list
function normaliseFleet (f) {
  if (!f?.fleet || !hasLists(f.fleet)) return f
  f.ships = f.ships.map(x => { const sp = splitShipId(f.fleet, x.id); return sp.cls === x.id ? x : { ...x, id: sp.cls, picks: x.picks ?? sp.picks } })
  if (!f.list) f.list = listContext({ fleet: f.fleet, ships: f.ships.map(x => resolveShipId(f.fleet, x.id, x.picks)) }).def?.id
  return f
}
setup.fleets.forEach(normaliseFleet)
// Cruiser Duel takes cruisers of 185 points or less; a Fleet Engagement anything in the two lists
const eligible = fleet => setup.mode === 'clash' ? SHIPS.filter(s => s.fleet === fleet && s.type === 'cruiser' && s.points <= MAX_POINTS)
  : SHIPS.filter(s => s.fleet === fleet && s.role !== 'transport')   // transports come with their scenario
// the fleet on each side: any of the nine, on either side, the same one on both if wanted
// the ships a fleet's picker offers: for a fleet with lists, the classes of its chosen list once each (their weapon choices are made on the chosen ship)
const pickable = side => {
  const fleet = fleetOf(side)
  if (!hasLists(fleet)) return eligible(fleet)
  const d = listDef(fleet, setup.fleets[side].list)
  return eligible(fleet).filter(s => d.ships[s.id])
}
const reserveNote = (side, s) => { const fleet = fleetOf(side); return hasLists(fleet) && listDef(fleet, setup.fleets[side].list).ships[s.id]?.includes('reserve') ? ' Reserve from the other Athanatoi list: needs an Athanatoi Strategos.' : '' }
const FLEETS = SEA ? SEA_FLEETS : ['freemen', 'dominion', ...NEW_FLEETS]   // (the sea: Human, Elf and Orc fleets only)
const isTube = w => w.kind === 'torpedo' || w.kind === 'missile' || w.kind === 'bio-torpedo'   // Isos missiles are fired like torpedoes
const SIDES = [0, 1]
const fleetOf = side => setup.fleets[side].fleet ?? FLEETS[side]
// the sea offers only its three fleets: a fleet or Cruiser Duel ship saved from the space game is dropped (Tides of the Archipelago)
if (SEA) for (const side of [0, 1]) {
  if (setup.fleets[side].fleet && !FLEETS.includes(setup.fleets[side].fleet)) setup.fleets[side] = { ships: [], squads: [], cmd: '', rerolls: 0, fleet: FLEETS[side] }
  setup.lists[side] = (setup.lists[side] ?? []).filter(id => SHIPS.find(p => p.id === id)?.fleet === fleetOf(side))
  // the older 1,000-point default fleets kept in this browser give way to the 500-point ones
  const OLD_DEFAULTS = ['lantern,rimward,tribune,cannonade,sword,sword,sword,wildfire', 'ath-selene,ath-shadow,ath-shadow,ath-asphodel,ath-oleander,ath-foxglove',
    'rukka-terror,rukka-terror,rukka-bash-cruisa,rukka-bash-cruisa,rukka-ravager,rukka-ravager,rukka-onslaught,rukka-onslaught,rukka-grunt', 'malice,bloodshed,shambles,ruin,charnel']
  if (OLD_DEFAULTS.includes((setup.fleets[side].ships ?? []).map(x => x.id).join())) setup.fleets[side].ships = []
  if (!setup.fleets[side].ships?.length) { const d = seaDefaultFleet(fleetOf(side)); if (d) { setup.fleets[side] = normaliseFleet(d); setup.names[side] = SEA_DEFAULT_FLEETS[fleetOf(side)].name } }   // an empty side gets its race's default fleet
}
const newFleet = fleet => ({ fleet, ships: [], squads: [], cmd: fleet === 'dominion' ? 'harrowadmiral-8' : '', rerolls: 0, marks: [], ...(hasLists(fleet) ? { list: listsOf(fleet)[0].id } : {}) })
// the fleet as fleet.js takes it: escorts go into the squadron they were added to (2-6 escorts each)
function fleetList (side) {
  const f = setup.fleets[side], list = listFromForm(f, fleetOf(side))   // data/listForm.js (shared with the computer's tests)
  if (isScenario()) list.tags = Object.fromEntries(f.ships.map((x, i) => [i, x.tag || (SCENARIOS[setup.mode].tags?.[roleOf(side)]?.[0] === 'division' ? String((i % 5) + 1) : '')]).filter(([, t]) => t))
  return list
}
// a * in the picker and this in its tooltip: what is drawn on this ship but has no rule yet
const silentNote = s => notYet(s).length ? ` Not in yet: ${notYet(s).join(', ')}.` : ''
const capitalName = id => SHIPS.find(p => p.id === id).name.replace(/ class.*/, '')
// the fleet's commanders: an Admiral (on a ship, extra re-rolls); for the Dominion a Harrow Admiral (up to four Marks) and Harrow Lords (one Mark each)
function commandHtml (side) {
  const f = setup.fleets[side], fleet = fleetOf(side)
  if (hasLists(fleet)) return listCommandHtml(side)
  if (!COMMANDERS[fleet].length) return `<span class="dim">This fleet's commanders aren't in the game yet.</span>`
  // the Harrow Admiral's ship can't also have a Harrow Lord: adding a dearer ship moves the Harrow Admiral, so clear a Lord there
  if (fleet === 'dominion' && f.cmd && f.ships.length) { const w = f.ships[flagshipIndex(fleetList(side))]; if (w.lord != null) w.lord = null }
  const list = fleetList(side)
  let h = `<label>${fleet === 'freemen' ? 'Admiral' : 'Harrow Admiral'} <select data-cmd="${side}"><option value="">none</option>${COMMANDERS[fleet].map(c => `<option value="${c.id}" ${f.cmd === c.id ? 'selected' : ''}>${c.name} Resolve ${c.ld} (${c.points} pts)</option>`).join('')}</select></label> <button data-newsq="${side}">Start a new escort squadron</button>`
  const caps = f.ships.map((x, i) => [x, i]).filter(([x]) => SHIPS.find(p => p.id === x.id).role !== 'escort')
  if (fleet === 'freemen' && f.cmd) {
    h += `<div class="row" style="margin:6px 0"><label>Admiral aboard <select data-flag="${side}">${caps.map(([x, i]) => `<option value="${i}" ${list.commanderOn === i ? 'selected' : ''}>${capitalName(x.id)} ${i + 1}</option>`).join('')}</select></label>
      <label>Re-rolls: 1 included, extra <select data-rerolls="${side}">${EXTRA_REROLLS.map((p, n) => `<option value="${n}" ${+(f.rerolls ?? 0) === n ? 'selected' : ''}>${n}${n ? ` (+${p} pts)` : ''}</option>`).join('')}</select></label> <span class="dim"></span></div>`
  }
  if (fleet === 'dominion') {
    if (f.cmd) {
      const on = caps.length ? capitalName(f.ships[flagshipIndex(list)].id) : '—'
      h += `<div style="margin:6px 0">Harrow Admiral aboard <b>${on}</b> <span class="dim">(the most expensive ship)</span> · 1 re-roll, +1 with Cipher<br>Marks: ${Object.entries(MARKS).map(([k, m]) => `<label title="${m.text}"><input type="checkbox" data-mark="${k}" ${(f.marks ?? []).includes(k) ? 'checked' : ''}> ${m.name.replace('Mark of ', '')} +${m.points}</label>`).join(' ')}</div>`
    }
    const fi = flagshipIndex(list)
    const lordable = caps.filter(([, i]) => !(f.cmd && i === fi))
    if (lordable.length) h += `<div style="margin:6px 0">Harrow Lords (0-3, Resolve 8, 50 pts): ${lordable.map(([x, i]) => `<label>${capitalName(x.id)} ${i + 1} <select data-lord="${i}"><option value="none">none</option><option value="" ${x.lord === '' ? 'selected' : ''}>Lord</option>${Object.entries(MARKS).map(([k, m]) => `<option value="${k}" ${x.lord === k ? 'selected' : ''}>Lord + ${m.name.replace('Mark of ', '')} (+${m.points})</option>`).join('')}</select></label>`).join(' ')}</div>`
  }
  return h
}

// a fleet list's command options: the list, its commander, the ship the commander sails on, re-rolls bought; the ships' own weapon choices and upgrades are by each chosen ship
function listCommandHtml (side) {
  const f = setup.fleets[side], fleet = fleetOf(side), d = listDef(fleet, f.list), list = fleetList(side), ctx = listContext(list)
  const lists = listsOf(fleet)
  const ldText = c => c.mode === 'plus' ? `+${c.plus} Resolve, up to ${c.cap}` : `Resolve ${c.ld}`
  let h = `<label>List <select data-list="${side}">${lists.map(x => `<option value="${x.id}" ${x.id === d.id ? 'selected' : ''}>${x.name}</option>`).join('')}</select></label>`
  const co = d.commanders
  if (co) {
    h += ` <label>${co.label ?? 'Commander'} <select data-cmd="${side}"><option value="">none</option>${co.options.map(c => `<option value="${c.id}" ${f.cmd === c.id ? 'selected' : ''}>${c.name}, ${ldText(c)} (${c.pointsText ?? c.points} pts)</option>`).join('')}</select></label>`
    if (ctx.cmd) {
      const caps = f.ships.map((x, i) => [x, i]).filter(([x]) => SHIPS.find(p => p.id === x.id).role !== 'escort')
      h += `<div class="row" style="margin:6px 0"><label>Aboard <select data-flag="${side}">${caps.map(([x, i]) => `<option value="${i}" ${ctx.cmdOn === i ? 'selected' : ''}>${capitalName(x.id)} ${i + 1}</option>`).join('')}</select></label>
        ${ctx.cmd.prices.length > 1 ? `<label>Re-rolls: ${ctx.cmd.free} included, extra <select data-rerolls="${side}">${ctx.cmd.prices.map((p, n) => `<option value="${n}" ${+(f.rerolls ?? 0) === n ? 'selected' : ''}>${n}${n ? ` (+${p} pts)` : ''}</option>`).join('')}</select></label>` : `<span class="dim">${ctx.cmd.free} re-roll included</span>`}
        <span class="dim">${ctx.cmd.hero ? ' · an Athanatoi Strategos: reserves from the other list' : ''}</span></div>`
    } else if (co.requiredOver) h += ` <span class="dim">a fleet over ${co.requiredOver} points needs one</span>`
  }
  if (d.fleetRerolls) {   // No commander; one re-roll included, extras bought for the fleet as a whole
    const fr = d.fleetRerolls
    h += ` <label>${fr.label}: ${fr.free} included, extra <select data-rerolls="${side}">${fr.prices.map((p, n) => `<option value="${n}" ${+(f.rerolls ?? 0) === n ? 'selected' : ''}>${n}${n ? ` (+${p} pts)` : ''}</option>`).join('')}</select></label> <span class="dim">no Fleet Commander</span>`
  }
  if (d.ordnanceShare) {   // Up to 10% of the points on ordnance markers, if at least one queen ship is chosen
    const o = f.ordnance ?? {}, cost = ordnanceCost({ ordnance: o }), cap = Math.floor(fleetPoints(list) * d.ordnanceShare)
    h += `<div class="row" style="margin:6px 0"><b>Ordnance markers</b> ${Object.entries(ORDNANCE_LABEL).map(([k, name]) => `<label>${name} (${ORDNANCE_PRICES[k]} pts) <input type="number" min="0" max="20" style="width:3.5em" data-ord="${side}:${k}" value="${o[k] ?? 0}"></label>`).join(' ')} <span class="dim">${cost} of ${cap} points allowed (10% of the fleet)</span></div>`
  }
  if (d.firms) h += gafferHtml(side, list, ctx)
  h += ` <button data-newsq="${side}">Start a new escort squadron</button>`
  return h
}
// Each Gaffer commands one titchy gang and one other gang per re-roll. The builder fills them in list order; these boxes override it (list.commands).
function gafferHtml (side, list, ctx) {
  const f = setup.fleets[side], cmds = firmsCommands(ctx), sqs = [], seen = new Set()
  for (const q of [...(list.escortSquadrons ?? []), ...(list.capitalSquadrons ?? [])]) { q.forEach(i => seen.add(i)); sqs.push(q) }
  for (const e of ctx.ents) if (e.capital && !seen.has(e.i)) sqs.push([e.i])
  if (!cmds.size) return ''
  const nameOf = q => `${q.length > 1 ? q.length + ' x ' : ''}${ctx.ents[q[0]].p?.name.replace(/ class.*/, '') ?? q[0]} (ship ${q[0] + 1})`
  return `<div class="row gaffers" style="margin:6px 0"><b>Gaffer commands</b> <span class="dim">(each re-roll, one titchy gang of three or more escorts and one other)</span>` + [...cmds].map(([wi, idx]) =>
    `<div>${ctx.ents[wi].p?.name.replace(/ class.*/, '')} ship ${wi + 1} commands: ${sqs.map(q => `<label><input type="checkbox" data-cmdsq="${side}:${wi}:${q[0]}" ${idx.includes(q[0]) ? 'checked' : ''}> ${nameOf(q)}</label>`).join(' ')}</div>`).join('') + `</div>`
}

// Saved fleets: kept in this browser. Cruiser Duel has its own ship rules, so none there.
const storedFleets = () => { try { return JSON.parse(store.get('saved', '[]')) } catch { return [] } }
// at sea the default fleets head the list (data/seaDefaults.js); they are never written to the store and can't be deleted
const builtInFleets = () => SEA ? Object.entries(SEA_DEFAULT_FLEETS).map(([fleet, d]) => ({ name: d.name, fleet, list: d.list, builtIn: true })) : []
const savedFleets = () => [...builtInFleets(), ...storedFleets()]
const clone = x => JSON.parse(JSON.stringify(x))
function savedHtml (side, sc) {
  if (setup.mode === 'clash' || (sc?.generatedAttacker && side === setup.attacker)) return ''
  const mine = savedFleets().filter(r => r.fleet === fleetOf(side)), loaded = setup.names[side]
  const load = mine.length ? `<label>Saved fleet <select data-load="${side}"><option value="">choose</option>${mine.map(r => `<option ${r.name === loaded ? 'selected' : ''}>${r.name}</option>`).join('')}</select></label>` : setup.listsMode ? '' : '<span class="dim">No saved fleets yet: build them in Fleet Lists.</span>'
  if (!setup.listsMode) return load
  const name = String(loaded ?? '').replace(/"/g, '&quot;')
  return `${load}<input data-name="${side}" placeholder="Fleet name" value="${name}"><button data-save="${side}">Save</button>${mine.some(r => r.name === loaded && !r.builtIn) ? `<button data-unsave="${side}">Delete</button>` : ''}`
}
function saveFleet (side) {
  const name = (setup.names[side] ?? '').trim() || `${FLEET_NAME[fleetOf(side)]} ${fleetPoints(fleetList(side))}`
  if (builtInFleets().some(r => r.name === name)) return   // a default fleet keeps its name: save a changed one under another
  const rest = storedFleets().filter(r => !(r.name === name && r.fleet === fleetOf(side)))
  store.set('saved', JSON.stringify([...rest, { name, fleet: fleetOf(side), list: clone(setup.fleets[side]) }]))
  setup.names[side] = name
}

// a chosen ship's own choices from its fleet's table: weapon options and the upgrades its list offers
function shipChoices (side, x, i) {
  const fleet = fleetOf(side)
  if (!hasLists(fleet)) return ''
  const opts = CLASSES[fleet]?.[x.id]?.options ?? []
  let h = opts.map((o, k) => `<select data-opt="${side}:${i}:${k}" title="${o.label}">${o.choices.map((c, n) => `<option value="${n}" ${(x.picks?.[k] ?? 0) === n ? 'selected' : ''}>${o.slot}: ${c.name}${c.points ? ` +${c.points}` : ''}</option>`).join('')}</select>`).join('')
  const list = fleetList(side)
  // A Tether or Warden hooks on to a carrier with a free gravitic hook; the builder fills it in list order unless a parent is chosen here (list.hooks)
  const ctx2 = fleet === 'isos' ? listContext(list) : null, me = ctx2?.ents[i]
  if (me?.p?.hooked) {
    const carriers = ctx2.ents.filter(c => c.p?.hooks?.takes.includes(me.p.hooked))
    if (carriers.length) h += `<select data-hook="${side}:${i}" title="Which ship carries this ${me.p.hooked === 'tether' ? 'Tether' : 'Warden'} on its gravitic hook"><option value="">hooks on to: first free</option>${carriers.map(c => `<option value="${c.i}" ${setup.fleets[side].hooks?.[i] === c.i ? 'selected' : ''}>hooks on to ${c.p.name.replace(/ class.*/, '')} ${c.i + 1}</option>`).join('')}</select>`
  }
  h += upgradesFor(list, i).map(u => `<label title="${u.text}"><input type="checkbox" data-up="${side}:${i}:${u.id}" ${(x.up ?? []).includes(u.id) ? 'checked' : ''}> ${u.name}${u.points ? ` +${u.points}` : ''}</label>`).join(' ')
  return h
}
// Fleet Lists shows one builder (the left panel); the right panel is a picture of the fleet it makes, drawn with the battle's own art
// the id the battle itself would draw (fleetList resolves a Phage ship's growths), so a fleet is pictured as it will fight
const portraitArt = id => artFor(id, setup.style === 'svg' || shipById(id)?.fleet === 'phage' || shipById(id)?.fort ? 'svg' : 'sprite').src
function portraitHtml () {
  const f = setup.fleets[0], fleet = fleetOf(0), list = fleetList(0), limit = +$('limit').value, used = fleetPoints(list)
  const ps = f.ships.map(x => SHIPS.find(p => p.id === x.id))
  const cmdName = hasLists(fleet) ? listContext(list).cmd?.name : COMMANDERS[fleet]?.find(c => c.id === f.cmd)?.name
  const cmdOn = !f.cmd && !(hasLists(fleet) && listContext(list).cmd) ? -1 : hasLists(fleet) ? listContext(list).cmdOn : flagshipIndex(list)
  const card = (p, i) => `<figure class="pship ${p.type === 'escort' ? 'esc' : ''}"><img src="${portraitArt(list.ships[i])}" alt="" class="${setup.style === 'sprite' ? 'px' : ''}"><figcaption><b>${p.name.replace(/ class.*/, '')}</b> <span class="dim">${p.points} pts</span>${i === cmdOn && cmdName ? `<span class="pcmd">${cmdName}</span>` : ''}</figcaption></figure>`
  const caps = ps.map((p, i) => [p, i]).filter(([p]) => p.type !== 'escort'), escorts = ps.map((p, i) => [p, i]).filter(([p]) => p.type === 'escort')
  const squads = f.squads.map(q => escorts.filter(([, i]) => f.ships[i].squad === q)).filter(q => q.length)
  const extras = used - ps.reduce((a, p) => a + p.points, 0)
  return `<h2>${FLEET_NAME[fleet]} <span class="dim">${f.ships.length ? f.ships.length + ' ship' + (f.ships.length > 1 ? 's' : '') : ''}</span></h2>
    <div class="ptotal ${used > limit ? 'over' : ''}"><b>${used}</b> of ${limit} points${extras ? ` <span class="dim">(ships ${used - extras}, commander, upgrades and weapon choices ${extras})</span>` : ''}</div>
    ${f.ships.length ? '' : '<p class="dim">Add ships and they appear here.</p>'}
    ${caps.length ? `<h3>Capital ships</h3><div class="pgroup">${caps.map(([p, i]) => card(p, i)).join('')}</div>` : ''}
    ${squads.map((q, n) => `<h3>Escort squadron ${n + 1} <span class="dim">${q.length} escort${q.length > 1 ? 's' : ''}, ${q.reduce((a, [p]) => a + p.points, 0)} pts</span></h3><div class="pgroup">${q.map(([p, i]) => card(p, i)).join('')}</div>`).join('')}`
}
function renderSetup () {
  if (setup.listsMode) $('portrait').innerHTML = portraitHtml()
  for (const b of document.querySelectorAll('[data-mode]')) b.classList.toggle('on', b.dataset.mode === setup.mode)
  $('fleet-opts').hidden = setup.mode === 'clash'
  $('rounds-label').hidden = setup.mode !== 'fleet'
  const sc = SCENARIOS[setup.mode]
  $('mode-text').textContent = setup.mode === 'clash' ? 'One to four cruisers each, the same number, each no more than 185 points' : setup.mode === 'fleet' ? 'Equal points from the Rimward Reach lists; escorts in squadrons of 2-6' : sc.text
  $('scenario-opts').hidden = !sc
  if (sc) {
    $('scenario-opts').innerHTML = `${sc.symmetric ? '' : `<label>${sc.roles[0]}: <select id="attacker"><option value="0" ${setup.attacker === 0 ? 'selected' : ''}>${FLEET_NAME[fleetOf(0)]}</option><option value="1" ${setup.attacker === 1 ? 'selected' : ''}>${FLEET_NAME[fleetOf(1)]}</option></select></label> <span class="dim">(the other fleet are the ${sc.roles[1].toLowerCase()})</span>`}
      ${setup.mode === 'convoy' ? ` <label>Transports <input type="number" id="transports" min="2" max="12" value="${setup.transports}"></label> <label><input type="checkbox" id="transportSquadron" ${setup.transportSquadron ? 'checked' : ''}> as one squadron</label>` : ''}${isosExtrasHtml(sc)}`
  }
  const meter = (side, used, limit, text) => {
    const el = $(`used-${side}`), over = limit != null && used > limit
    el.className = 'used' + (over ? ' over' : '')
    el.innerHTML = `${text}${limit != null ? `<div class="bar"><div class="fill" style="width:${Math.min(100, used / limit * 100)}%"></div></div>` : ''}`
  }
  SIDES.forEach(side => {
    const fleet = fleetOf(side)
    $(`fleet-${side}`).innerHTML = `<select data-fleet="${side}" aria-label="Fleet">${FLEETS.map(x => `<option value="${x}" ${x === fleet ? 'selected' : ''}>${SEA ? '' : 'The '}${FLEET_NAME[x]}</option>`).join('')}</select>`
      + (SEA && SEA_SCHEMES[fleet] ? ` <select data-seascheme="${side}" aria-label="Colours" title="The fleet's colours">${SEA_SCHEMES[fleet].map(c => `<option value="${c.id}" ${c.id === schemeOf(side, fleet) ? 'selected' : ''}>${c.name}</option>`).join('')}</select>` : '')
    if (setup.mode === 'clash') {
      const used = setup.lists[side].reduce((a, id) => a + SHIPS.find(p => p.id === id).points, 0), n = setup.lists[side].length
      meter(side, n, 4, `<b>${used}</b> points used · <b>${n}</b> of 4 ships (each ship 185 or less, both fleets the same number)`)
      $(`pick-${side}`).innerHTML = eligible(fleet).map(s => `<button data-add="${side}:${s.id}" title="${silentNote(s).trim()}" ${setup.lists[side].length >= 4 ? 'disabled' : ''}>${s.name.replace(/ class.*/, '')}${notYet(s).length ? ' *' : ''} <span class="dim">${s.points}</span></button>`).join('')
      $(`chosen-${side}`).innerHTML = setup.lists[side].map((id, i) => `<button data-remove="${side}:${i}">${SHIPS.find(s => s.id === id).name.replace(/ class.*/, '')}</button>`).join('') || '<span class="dim">none yet</span>'
      $(`cmd-${side}`).innerHTML = ''; $(`pts-${side}`).textContent = ''
      return
    }
    const f = setup.fleets[side]
    if (sc?.generatedAttacker && side === setup.attacker) {   // the Convoy's raiders are rolled, not picked
      $(`pick-${side}`).innerHTML = '<span class="dim">The attackers are rolled when the battle is set up: D3 rolls, +1 per pair of transports. You pick the ships for each Contact then.</span>'
      $(`cmd-${side}`).innerHTML = ''; $(`chosen-${side}`).innerHTML = ''; $(`pts-${side}`).textContent = ''; meter(side, 0, null, '')
      return
    }
    const limitHere = sc ? sideLimits()[side] : +$('limit').value, usedHere = fleetPoints(fleetList(side)), leftHere = limitHere - usedHere
    meter(side, usedHere, limitHere, usedHere > limitHere ? `<b>${usedHere}</b> of ${limitHere} points used: <b>${-leftHere}</b> over` : `<b>${usedHere}</b> of ${limitHere} points used · <b>${leftHere}</b> left`)
    $(`pick-${side}`).innerHTML = pickable(side).map(s => `<button data-fadd="${side}:${s.id}" class="${s.points > leftHere ? 'nofit' : ''}" title="${s.points > leftHere ? `${s.points} points: only ${Math.max(0, leftHere)} left` : `${s.points} points: ${leftHere - s.points} left after`}${silentNote(s)}${reserveNote(side, s)}">${s.name.replace(/ class.*/, '')}${notYet(s).length ? ' *' : ''}${reserveNote(side, s) ? ' (reserve)' : ''} <span class="dim">${s.points}</span></button>`).join('')
    $(`cmd-${side}`).innerHTML = commandHtml(side)
    const label = x => SHIPS.find(p => p.id === x.id).name.replace(/ class.*/, '') + (x.squad ? ` <span class="dim">sq ${f.squads.indexOf(x.squad) + 1}</span>` : '')
    const tags = sc?.tags?.[roleOf(side)] ?? []
    const tagSel = (x, i) => tags.map(t => (t === 'worldbreaker' && SHIPS.find(p => p.id === x.id).type === 'escort') ? '' : `<select data-tag="${side}:${i}">${TAG_OPTIONS[t].map(([v, l]) => `<option value="${v}" ${(fleetList(side).tags?.[i] ?? '') === v ? 'selected' : ''}>${l}</option>`).join('')}</select>`).join('')
    const csqSel = (x, i) => SQUADRON_ROLES.includes(SHIPS.find(p => p.id === x.id).role) ? `<select data-csq="${side}:${i}" title="Capital ship squadron"><option value="">alone</option>${['A', 'B', 'C', 'D'].map(L => `<option value="${L}" ${x.csq === L ? 'selected' : ''}>squadron ${L}</option>`).join('')}</select>` : ''
    $(`chosen-${side}`).innerHTML = f.ships.map((x, i) => { const extra = tagSel(x, i) + csqSel(x, i) + shipChoices(side, x, i); return extra ? `<span class="tagged"><button data-fremove="${side}:${i}">${label(x)}</button>${extra}</span>` : `<button data-fremove="${side}:${i}">${label(x)}</button>` }).join('') || '<span class="dim">none yet</span>'
    $(`pts-${side}`).textContent = sc && !sc.symmetric ? sc.roles[side === setup.attacker ? 0 : 1] : ''
  })
  // the middle of the page and the saved fleets (Fleet Lists)
  $('setup-name').textContent = setup.listsMode ? 'Fleet Lists' : 'Choose a battle'
  $('mission-name').textContent = setup.listsMode ? 'Build and save' : setup.mode === 'clash' ? 'Cruiser Duel' : setup.mode === 'fleet' ? 'Fleet Engagement' : sc.name
  if (setup.listsMode) $('mode-text').textContent = `Saved fleets can be loaded on the Battle page..`
  const chosenLook = lookOf()
  $('frame').innerHTML = chosenLook ? `<span class="look ${chosenLook.cls}"></span>` : `<img src="/space/tables/${setup.table}.png" alt="">`
  SIDES.forEach(side => { $(`saved-${side}`).innerHTML = savedHtml(side, sc) })
  $('tables').innerHTML = LOOKS.map(t => `<div data-table="${t.id}" class="${t.id === setup.table ? 'on' : ''}"><span class="look ${t.cls}"></span><div>${t.name}</div></div>`).join('') + TABLES.map(t => `<div data-table="${t.id}" class="${t.id === setup.table ? 'on' : ''}"><img src="/space/tables/${t.id}.png" alt="${t.name}"><div>${t.name}</div></div>`).join('')
  for (const b of document.querySelectorAll('[data-style]')) b.classList.toggle('on', b.dataset.style === setup.style)
  $('brace').value = setup.brace; $('zone').value = setup.zone; $('reroll').value = setup.reroll; $('cine').value = setup.cine
  const bad = setup.mode === 'clash' ? checkForces(SIDES.map(side => ({ fleet: fleetOf(side), ships: setup.lists[side] })))
    : sc ? [0, 1].flatMap(side => sc.generatedAttacker && side === setup.attacker ? [] : [...checkFleet(fleetList(side), sideLimits()[side]), ...checkScenarioList(setup.mode, fleetList(side), roleOf(side), sideLimits()[side], scOpts())].map(w => `${FLEET_NAME[fleetOf(side)]}: ${w}`)).join(' · ') || null
      : [0, 1].flatMap(side => checkFleet(fleetList(side), +$('limit').value).map(w => `${FLEET_NAME[fleetOf(side)]}: ${w}`)).join(' · ') || null
  $('why').textContent = bad ?? ''
  $('start').disabled = !!bad
}
$('setup').addEventListener('click', e => {
  const t = e.target.closest('button, [data-table]')
  if (!t) return
  if (t.dataset.add) { const [s, id] = t.dataset.add.split(':'); if (setup.lists[s].length < 4) setup.lists[s].push(id) }
  if (t.dataset.remove) { const [s, i] = t.dataset.remove.split(':'); setup.lists[s].splice(+i, 1) }
  if (t.dataset.table) setup.table = t.dataset.table
  if (t.dataset.mode) setup.mode = t.dataset.mode
  if (t.dataset.fadd) {
    const [side, id] = t.dataset.fadd.split(':'), f = setup.fleets[side]
    let squad = null
    if (SHIPS.find(p => p.id === id).role === 'escort') {
      const cur = f.squads.at(-1), size = cur ? f.ships.filter(x => x.squad === cur).length : 6
      squad = cur && size < 6 ? cur : (f.squads.push(`q${Date.now()}${f.squads.length}`), f.squads.at(-1))
    }
    f.ships.push({ id, squad }); f.commands = null; f.hooks = null   // positions in the list changed: the builder's Gaffer and hook choices start again
  }
  if (t.dataset.fremove) { const [side, i] = t.dataset.fremove.split(':'); const f = setup.fleets[side]; f.ships.splice(+i, 1); f.commands = null; f.hooks = null; f.squads = f.squads.filter(q => f.ships.some(x => x.squad === q)) }
  if (t.dataset.newsq) setup.fleets[t.dataset.newsq].squads.push(`q${Date.now()}`)
  if (t.dataset.style) setup.style = t.dataset.style
  if (t.dataset.save) saveFleet(+t.dataset.save)
  if (t.dataset.unsave) { const side = +t.dataset.unsave; store.set('saved', JSON.stringify(storedFleets().filter(r => !(r.name === setup.names[side] && r.fleet === fleetOf(side))))); setup.names[side] = null }
  store.set('lists', JSON.stringify(setup.lists)); store.set('table2', setup.table); store.set('style', setup.style)
  store.set(SEA ? 'seamode' : 'mode', setup.returnMode ?? setup.mode); store.set('fleets', JSON.stringify(setup.fleets))
  renderSetup()
})
// the name box: kept as typed, without a redraw, which would take the Save button from under the click that blurred it
$('setup').addEventListener('input', e => { if (e.target.dataset.name != null) setup.names[e.target.dataset.name] = e.target.value })
$('setup').addEventListener('change', e => {
  if (e.target.dataset.seascheme != null) { setup.seaScheme[+e.target.dataset.seascheme] = e.target.value; store.set('seaScheme', JSON.stringify(setup.seaScheme)); return }
  const d = e.target.dataset, f = setup.fleets
  if (d.name != null) return
  const here = +e.target.closest('.fleet')?.dataset.side
  if (d.fleet != null) { const dflt = SEA ? seaDefaultFleet(e.target.value) : null; f[d.fleet] = dflt ? normaliseFleet(dflt) : newFleet(e.target.value); setup.lists[d.fleet] = []; setup.names[d.fleet] = dflt ? SEA_DEFAULT_FLEETS[e.target.value].name : '' }   // at sea a new race starts with its default fleet
  if (d.load != null && e.target.value) { const side = +d.load, r = savedFleets().find(x => x.name === e.target.value && x.fleet === fleetOf(side)); if (r) { f[side] = normaliseFleet({ ...clone(r.list), fleet: r.fleet }); setup.names[side] = r.name } }
  if (d.list != null) { const fl = f[d.list]; fl.commands = null; fl.hooks = null; fl.list = e.target.value; fl.cmd = ''; fl.rerolls = 0; fl.ships.forEach(x => { x.flag = false }) }
  if (d.opt != null) { const [sd, i, k] = d.opt.split(':').map(Number), x = f[sd].ships[i]; x.picks = [...(x.picks ?? [])]; x.picks[k] = +e.target.value }
  if (d.up != null) { const [sd, i, id] = d.up.split(':'), x = f[sd].ships[+i], u = new Set(x.up ?? []); e.target.checked ? u.add(id) : u.delete(id); x.up = [...u] }
  if (d.cmd != null) { f[d.cmd].cmd = e.target.value; if (hasLists(fleetOf(+d.cmd))) f[d.cmd].rerolls = 0 }
  if (d.rerolls != null) f[d.rerolls].rerolls = +e.target.value
  if (d.ord != null) { const [sd, k] = d.ord.split(':'); f[+sd].ordnance = { ...(f[+sd].ordnance ?? {}), [k]: Math.max(0, Math.floor(+e.target.value || 0)) } }   // Bought ordnance markers
  if (d.cmdsq != null) {   // a Gaffer's gangs: the boxes ticked now become list.commands for him (the others keep the automatic fill)
    const [sd, wi, q] = d.cmdsq.split(':').map(Number), fl = f[sd], ctx = listContext(fleetList(sd)), now = new Set(firmsCommands(ctx).get(wi) ?? [])
    fl.commands = Object.fromEntries([...firmsCommands(ctx)].map(([w, idx]) => [w, [...idx]]))
    const mine = new Set(fl.commands[wi]); e.target.checked ? mine.add(q) : mine.delete(q); fl.commands[wi] = [...mine]
    for (const w of Object.keys(fl.commands)) if (+w !== wi && e.target.checked) fl.commands[w] = fl.commands[w].filter(i => i !== q)   // one gang has one Gaffer
  }
  if (d.hook != null) { const [sd, i] = d.hook.split(':').map(Number); f[sd].hooks = { ...(f[sd].hooks ?? {}) }; if (e.target.value === '') delete f[sd].hooks[i]; else f[sd].hooks[i] = +e.target.value }
  if (d.flag != null) f[d.flag].ships.forEach((x, i) => { x.flag = i === +e.target.value })
  if (d.mark != null) { const m = new Set(f[here].marks ?? []); e.target.checked ? m.add(d.mark) : m.delete(d.mark); f[here].marks = [...m] }
  if (d.lord != null) f[here].ships[+d.lord].lord = e.target.value === 'none' ? null : e.target.value
  if (d.tag != null) { const [sd, i] = d.tag.split(':').map(Number); f[sd].ships[i].tag = e.target.value }
  if (d.csq != null) { const [sd, i] = d.csq.split(':').map(Number); f[sd].ships[i].csq = e.target.value }
  if (e.target.id === 'attacker') { setup.attacker = +e.target.value; store.set('attacker', setup.attacker) }
  if (e.target.id === 'transports') { setup.transports = Math.max(2, +e.target.value || 2); store.set('transports', setup.transports) }
  if (e.target.id === 'merchants') { setup.merchants = Math.max(0, Math.floor(+e.target.value || 0)); store.set('merchants', setup.merchants) }
  if (d.way != null) { setup.way[d.way] = Math.max(0, Math.floor(+e.target.value || 0)); store.set('way', JSON.stringify(setup.way)) }
  if (e.target.id === 'transportSquadron') { setup.transportSquadron = e.target.checked; store.set('transportSquadron', setup.transportSquadron ? '1' : '') }
  store.set('fleets', JSON.stringify(setup.fleets))
  renderSetup()
})
$('brace').addEventListener('change', e => { setup.brace = e.target.value; store.set('brace', setup.brace) })
$('cine').addEventListener('change', e => { setup.cine = e.target.value; store.set('cine', setup.cine) })
$('computer').value = setup.computer
$('computer').addEventListener('change', e => { setup.computer = e.target.value; store.set('computer', setup.computer) })
$('reroll').addEventListener('change', e => { setup.reroll = e.target.value; store.set('reroll', setup.reroll) })
// at sea the first choice is the default islands (rules/terrain.js SEA_DEFAULT_ISLANDS; a scenario rolls its own instead)
if (SEA) $('zone').insertAdjacentHTML('afterbegin', '<option value="isles">default islands (the same every game)</option>')
if (SEA) $('limit').value = String(SEA_DEFAULT_POINTS)   // the sea starts at the default fleets' 500 points
$('zone').addEventListener('change', e => { setup.zone = e.target.value; store.set(SEA ? 'seazone' : 'zone', setup.zone) })
// To battle: the doors shut, the battle starts behind them with its own music, they open (blastDoors.js)
$('start').addEventListener('click', () => {
  warm()
  battleDoors(() => { begin(+$('seed').value || 1); if (!$('battle').hidden) { $('title').hidden = true; music.table(soundOn()) } })
})

// ?go&fleets=concord,rukka&seed=N&rounds=6: straight into a Fleet Engagement with the sample fleets (data/sampleFleets.js), for the
// computer playing itself. The table: rolled phenomena in space, the default islands at sea.
if (params.has('go')) {
  const [a, b] = (params.get('fleets') ?? (SEA ? 'freemen,rukka' : 'concord,rukka')).split(',')
  setup.mode = 'fleet'
  setup.fleets = [normaliseFleet(sampleFleet(a)), normaliseFleet(sampleFleet(b))]
  setup.names = [null, null]
  setup.zone = SEA ? 'isles' : (params.get('zone') ?? 'roll')
  $('limit').value = '1000'; $('rounds').value = params.get('rounds') ?? '6'; $('seed').value = params.get('seed') ?? '1'
  setTimeout(() => $('start').click(), +(params.get('go') || 300))
}

// ======================================== THE PAGES ========================================
function openSetup (lists) {
  if (lists && !setup.listsMode) { setup.returnMode = setup.mode; setup.mode = 'fleet' }
  setup.listsMode = lists
  const el = $('setup')
  el.classList.toggle('lists-mode', lists)
  el.classList.remove('enter'); void el.offsetWidth; el.classList.add('enter')
  renderSetup()
  show('setup')
}
function goTitle () {
  if (setup.listsMode) { setup.listsMode = false; setup.mode = setup.returnMode; setup.returnMode = null; $('setup').classList.remove('lists-mode') }
  show('title')
  showTitle({ host: $('title'), startMusic: music.title, onChoose: page => {
    if (page === 'battle') { music.battlePage(); openSetup(false) }
    if (page === 'lists') { music.lists(); openSetup(true) }
    if (page === 'rules') { music.menu(); $('rules-body').innerHTML = helpHtml(helpTab); show('rules') }
    if (page === 'settings') { music.menu(); showSettings($('settings-body')); show('settings') }
  } })
}
for (const b of document.querySelectorAll('[data-back]')) b.addEventListener('click', goTitle)
$('rules-body').addEventListener('click', e => { const b = e.target.closest('[data-helptab]'); if (b) { helpTab = +b.dataset.helptab; $('rules-body').innerHTML = helpHtml(helpTab) } })

// ======================================== THE BATTLE ========================================
let game = null
const ui = { move: null, planEdited: false, gun: null, torpAim: null, craftAim: false, grid: store.get('grid', '1') === '1', ghost: { p: null, pinned: false }, facing: null, selected: null, plan: null, shots: {}, torp: 0, sunburst: false, logMark: 0, boarding: null, teleports: new Set(), hover: null, modules: [] }

function begin (seed) {
  const decide = { imperative: askImperative, allIsLost: askAllIsLost, brace: askBrace, reroll: askReroll, repair: askRepair, rerollAttacks: askRerollAttacks, harpoonLoss: askHarpoonLoss, discipline: askDiscipline, fortBoard: askFortBoard, steerTorpedo: askSteer, honourDie: askHonourDie, annihilatorForgo: askForgo, rerollBangers: askRerollBangers, rerollTorpedoes: askRerollTorpedoes, rerollRepair: askRerollRepair, buzzaForgo: askBuzzaForgo, swapLeadership: askSwapLeadership, swapGaffer: askSwapGaffer, gafferBoost: askGafferBoost, nominateReroll: askNominate, dropCraft: askDropCraft, skipContact: askSkipContact, contactKind: askContactKind, deadfallHeading: askDeadfall, clusterMix: askClusterMix, slave: askSlave, mimicMove: askMimic }
  cpu?.stop(); cpu = null
  cpuAground.clear()
  const cpuSides = setup.mode === 'fleet' ? computerSides(setup.computer) : []   // the computer plays the Fleet Engagement; Cruiser Duel and the scenarios not yet
  const mine = side => cpuSides.includes(side)
  for (const k of Object.keys(COMPUTER_DECIDE)) { const human = decide[k]; decide[k] = (g, ship, ...rest) => mine(ship?.side) ? (k === 'brace' && setup.brace === 'never' ? false : COMPUTER_DECIDE[k](g, ship, ...rest)) : human(g, ship, ...rest) }   // the computer braces by its own rule unless Brace is set to never; it spends every re-roll it has
  asker.cpu = q => q.side != null ? mine(q.side) : cpuSides.length === 2   // every other question the computer's side is asked: the button marked first choice
  if (cpuSides.length) setTimeout(() => { cpu = createComputer({ sides: cpuSides, getGame: () => game, pause: +(params.get('pause') ?? 900), run: cpuRun, next: cpuNext, busy: () => FX.busy() || FX.gliding() || !$('ask-block').hidden }); cpu.start() }, 0)
  if (isScenario()) {
    try { game = createScenario({ id: setup.mode, lists: [fleetList(0), fleetList(1)], attacker: setup.attacker, limit: +$('limit').value, seed, decide, zone: setup.zone === 'isles' ? 'roll' : setup.zone, opts: scOpts() }) } catch (e) { $('why').textContent = e.message; return }   // (zone 'isles': a scenario places its own planet, so it rolls; the default islands are for the open battles)
    $('battle').classList.toggle('has-low', !!game.lowOrbit)
    FULL.w = game.table.w + 4; FULL.h = game.table.h + 4
    if (game.lowOrbit) FULL.h = 124 + 56   // the low orbit table is drawn below the main one
    $('setup').hidden = true; $('battle').hidden = false
    setView({ ...FULL })
    ui.logMark = 0
    return render()
  }
  game = setup.mode === 'clash'
    ? createCruiserClash({ seed, lists: SIDES.map(side => ({ name: FLEET_NAME[fleetOf(side)], fleet: fleetOf(side), ships: setup.lists[side] })), decide })
    : createFleetBattle({ seed, lists: [fleetList(0), fleetList(1)], limit: +$('limit').value, rounds: $('rounds').value === 'inf' ? Infinity : +$('rounds').value, decide })
  if (SEA) { game.sea = true; game.table = { ...SEA_TABLE } }   // Tides of the Archipelago: the sea house rules apply (rules/movement.js collide, boardReach), on the bigger sea table (rules/game.js SEA_TABLE)
  $('battle').classList.remove('has-low'); FULL.w = game.table.w + 4; FULL.h = game.table.h + 4; setView({ ...FULL })
  if (setup.zone === 'isles' && SEA) applyBattlezone(game, seaDefaultBattlezone())   // the default islands (rules/terrain.js SEA_DEFAULT_ISLANDS)
  else if (setup.zone !== 'none') {   // the phenomena are rolled with the game's own dice, so a seed replays them
    const z = rollBattlezone(game.rng, { zone: setup.zone === 'roll' ? undefined : +setup.zone, sea: SEA, w: game.table.w, h: game.table.h })   // (the sea: islands only)
    applyBattlezone(game, z)   // terrain, the sunward edge, solar flares and radiation bursts
  }
  $('setup').hidden = true; $('battle').hidden = false
  ui.logMark = 0
  render()
  if (SEA && !params.has('noweather')) startSeaWeather($('boardwrap'), seed).catch(e => console.warn('sea weather', e))   // rain, storm or fog over the sea
}

// Brace for Impact! is the defending player's choice before the dice are rolled. The engine asks
// synchronously; in a hotseat game the other player is at the same keyboard, so a confirm box asks them.
function askBrace (g, ship, attack) {
  if (setup.brace === 'never') return false
  if (setup.brace === 'crippled') return isCrippled(ship)
  return asker.ask({ side: ship.side, title: `${g.sides[ship.side].name}: Brace for Impact!?`, text: `${ship.name} is about to be attacked (${attack.what}). It takes a Command check; if it passes, a 4+ save against each point of damage, but its weapons are halved and it can take no special orders next turn.`, buttons: [{ label: 'Brace', value: true, primary: true }, { label: 'Decline', value: false }] }).value
}

// The Convoy's Contacts: the attackers choose what a turned-over cluster is, where deadfall torpedoes aim,
// and the mix of attack craft.
function askContactKind (g) { return asker.ask({ side: g.attacker, title: `${g.sides[g.attacker].name}: a Contact is turned over`, text: 'A cluster is either a D6+2 strength torpedo salvo or D3+1 squadrons of attack craft.', buttons: [{ label: 'Deadfall torpedoes', value: 'deadfall', primary: true }, { label: 'Attack craft', value: 'craft' }] }).value }
function askDeadfall (g, c, heading) {
  const r = asker.ask({ side: g.attacker, title: `${g.sides[g.attacker].name}: aim the deadfall torpedoes`, text: 'Degrees: 0 right, 90 down, 180 left, 270 up. Decline to aim at the nearest convoy ship.', fields: [{ id: 'heading', label: 'Heading', value: Math.round(((norm(heading)) + 360) % 360) }], buttons: [{ label: 'Aim', value: 'aim', primary: true }, { label: 'Decline', value: 'no' }] })
  return r.value === 'aim' && !isNaN(+r.fields.heading) ? +r.fields.heading : heading
}
function askClusterMix (g, c, n) {
  const half = Math.floor(n / 2), r = asker.ask({ side: g.attacker, title: `${g.sides[g.attacker].name}: ${n} squadrons of attack craft`, text: `Choose the mix: the numbers must add up to ${n}. Decline for ${half} fighters and ${n - half} bombers.`, fields: [{ id: 'fighter', label: 'Fighters', value: half }, { id: 'bomber', label: 'Bombers', value: n - half }, { id: 'boat', label: 'Assault boats', value: 0 }], buttons: [{ label: 'Launch', value: 'mix', primary: true }, { label: 'Decline', value: 'no' }] })
  const f = Math.max(0, +r.fields.fighter || 0), b = Math.max(0, +r.fields.bomber || 0), a = Math.max(0, +r.fields.boat || 0)
  return r.value === 'mix' && f + b + a === n ? { fighter: f, bomber: b, 'assault boat': a } : { fighter: half, bomber: n - half }
}

// A Hunger Imperative passes a Command check or Resolve Test automatically, decided before the dice
function askImperative (g, ship, t) {
  return asker.ask({ side: ship.side, title: `${g.sides[ship.side].name}: use a Hunger Imperative?`, text: `${ship.name}: ${t.why} (needs ${t.need} or less on 2D6). Pass it automatically? You have ${g.imperatives[ship.side].left} left.`, buttons: [{ label: 'Use the Imperative', value: true, primary: true }, { label: 'Roll the dice', value: false }] }).value
}
// All Is Lost, a boarded capital ship may try to destroy itself
function askAllIsLost (g, ship, boarder) {
  return asker.ask({ side: ship.side, title: `${ship.name}: All Is Lost?`, text: `${boarder.name} is boarding. Try to self destruct: a Resolve Test, then 1-3 plasma drive overload, 4-6 aether drive implosion. Failed, the crew face the Phage.`, buttons: [{ label: 'Self destruct', value: true }, { label: 'Fight on', value: false, primary: true }] }).value
}
// A failed Command check or Resolve Test may spend a re-roll
function askReroll (g, ship, t) {
  if (setup.reroll === 'never') return false
  if (setup.reroll === 'always') return true
  return asker.ask({ side: ship.side, title: `${g.sides[ship.side].name}: spend a re-roll?`, text: `${ship.name} failed: ${t.why}. Rolled ${t.total}, needed ${t.need} or less. Spend a ${t.pool} re-roll? The second roll stands, even if worse.`, buttons: [{ label: 'Re-roll', value: true, primary: true }, { label: 'Decline', value: false }] }).value
}

// Slavetaking instead of a Hit-and-Run critical (the Thnitoi's choice, asked once the attack has got through)
function askSlave (g, target, t) {
  return asker.ask({ side: 1 - target.side, title: `${g.sides[1 - target.side].name}: take slaves?`, text: `The Hit-and-Run on ${target.name} has got through. Take slaves instead of rolling a critical hit? +${t.points} victory points${target.profile.type === 'escort' ? ` (an escort is destroyed once 30 have been taken from it; ${target.slavesTaken ?? 0} so far)` : ''}.`, buttons: [{ label: `Take slaves (+${t.points})`, value: true }, { label: 'Critical hit', value: false, primary: true }] }).value
}
// The free mimic engine move after deployment, before either side has taken a turn
function askMimic (g, ship) {
  const v = ship.profile.speed, opts = [['Stay put', null], [`Straight ahead ${v / 2} cm`, [{ fwd: v / 2 }]], [`Straight ahead ${v} cm`, [{ fwd: v }]], [`Turn 90 left, ${v} cm`, [{ turn: -90 }, { fwd: v }]], [`Turn 90 right, ${v} cm`, [{ turn: 90 }, { fwd: v }]]]
  const i = asker.ask({ side: ship.side, title: `${g.sides[ship.side].name}: false-flag engines`, text: `${ship.name} may make one normal move now, before either side has taken a turn. More than 30 cm from every enemy afterwards, it can't be targeted by enemy ships in the first turn until it attacks.`, buttons: opts.map(([label], k) => ({ label, value: k, primary: k === 0 })) }).value
  return opts[i]?.[1] ?? null
}
// Athanatoi Eagle and Phoenix bombers may re-roll the D6 that sets their number of attacks; the second roll stands
function askRerollAttacks (g, ship, t) {
  return asker.ask({ side: g.active, title: `${g.sides[g.active].name}: re-roll the bombers' attacks?`, text: `A squadron attacking ${ship.name} rolled ${t.roll} on its D6, minus ${t.turrets} turret${t.turrets === 1 ? '' : 's'} = ${t.attacks} attack${t.attacks === 1 ? '' : 's'}. Roll it again? The second roll stands, even if worse.`, buttons: [{ label: 'Re-roll', value: true }, { label: 'Keep it', value: false, primary: true }] }).value
}

// A fort may board an enemy touching it, in the End Phase of the fort's own turn; the owner picks how many quadrants take part (boarding value = their hits left)
function askFortBoard (g, leader, t) {
  const buttons = Array.from({ length: t.max }, (_, i) => ({ label: `${i + 1} quadrant${i ? 's' : ''}: boarding value ${t.values[i]}`, value: i + 1, primary: i + 1 === t.max })).concat([{ label: 'Do not board', value: 0 }])
  return asker.ask({ side: leader.side, title: `${g.sides[leader.side].name}: ${leader.profile.name} boards ${t.enemy.name}?`, text: `${t.enemy.name} touches ${t.contact.name}. The quadrants that board add their hits left; ${t.enemy.name} has its hits plus ${t.enemy.profile.turrets ?? 0} turret${t.enemy.profile.turrets === 1 ? '' : 's'}. The damage falls on the quadrant in contact.`, buttons }).value
}
// A firer exactly on the line between two arcs: its player picks which arc the shot uses
const DISCIPLINE_NAME = { front: 'front', rear: 'rear', side: 'side', closing: 'closing (target coming at the firer)', away: 'moving away', abeam: 'abeam' }
function askDiscipline (g, ship, t) {
  return asker.ask({ side: ship.side, title: `${g.sides[ship.side].name}: which arcs for the shot at ${t.target.name}?`, text: `${ship.name} fires along a line between two arcs of ${t.target.name}. Choose the discipline the shot is rolled against; the better one for the dice is marked.`,
    buttons: t.options.map(a => ({ label: (DISCIPLINE_NAME[a] ?? a) + (a === t.best ? ' (most hits expected)' : ''), value: a, primary: a === t.best })) }).value
}
// A Harpoon module beaten: its player picks which ship of the squadron loses one
function askHarpoonLoss (g, home, cands) {
  return asker.ask({ side: home.side, title: `${g.sides[home.side].name}: which escort loses its Harpoon?`, text: `${home.name}'s Harpoon module was defeated. Choose the ship of the squadron that loses a module for the rest of the game.`,
    buttons: cands.map(c => ({ label: `${c.name} (${c.profile.weapons.filter(w => w.kind === 'harpoon').reduce((a, w) => a + w.str, 0) - (c.harpoonsLost ?? 0)} left)`, value: c.uid, primary: c.uid === home.uid })) }).value
}

// The Rukka's choices: every re-roll and every extra choice is the player's, asked here; the second roll always stands
const yesNo = (g, side, title, text) => asker.ask({ side, title, text, buttons: [{ label: 'Re-roll', value: true }, { label: 'Keep it', value: false, primary: true }] }).value
function askRerollBangers (g, ship, t) { return yesNo(g, ship.side, `${g.sides[ship.side].name}: Maniac Gunners`, `${ship.name}'s ${t.weapon.loc} bangers rolled ${t.roll} on ${t.dice}. Re-roll the firepower? The second roll stands.`) }
function askRerollTorpedoes (g, ship, t) { return yesNo(g, ship.side, `${g.sides[ship.side].name}: Nicked Torpedoes`, `${ship.name}'s chucka rolled ${t.roll} on ${t.dice}. Re-roll the salvo strength? The second roll stands.`) }
function askRerollRepair (g, ship, t) { return yesNo(g, ship.side, `${g.sides[ship.side].name}: Mad Spannerz`, `${ship.name}'s damage control dice: ${t.dice.join(', ')} (${t.sixes} fixed). Re-roll them all? The second roll stands.`) }
function askBuzzaForgo (g, ship, t) {
  const buttons = Array.from({ length: Math.min(t.markers - 1, Math.max(t.turrets, 1)) + 1 }, (_, n) => ({ label: n === 0 ? 'All attack' : `${n} suppress turrets`, value: n, primary: n === 0 }))
  if (buttons.length < 2) return 0
  return asker.ask({ side: g.active, title: `${g.sides[g.active].name}: buzza attack on ${ship.name}`, text: `${t.markers} buzzas attack a ship with ${t.turrets} turret${t.turrets === 1 ? '' : 's'}. Each marker that forgoes its run adds +1 attack (up to the ship's turrets).`, buttons }).value
}
// A Gaffer's once-a-game +2 on a boarding roll
function askGafferBoost (g, gaffer, boarder) { return yesNo(g, gaffer.side, `${g.sides[gaffer.side].name}: Gaffer's +2`, `${boarder.name} is in a boarding action. Spend ${gaffer.name}'s Gaffer +2 on its roll? Once per game.`) }
// Craft above the fleet's capacity run out of fuel; the owner picks which waves lose a marker, one marker per press, until the excess is gone
function askDropCraft (g, side, excess) {
  const picked = []
  const waves = () => g.ordnance.filter(o => o.kind === 'wave' && o.side === side)
  for (let left = excess; left > 0; left--) {
    const free = waves().filter(w => w.markers.length - picked.filter(x => x === w.id).length > 0)
    if (!free.length) break
    if (free.length === 1 && left >= free[0].markers.length - picked.filter(x => x === free[0].id).length) { while (left-- > 0) picked.push(free[0].id); break }
    const id = asker.ask({ side, title: `${g.sides[side].name}: craft out of fuel (${left} to go)`, text: `The fleet has ${excess} attack craft more than its launch capacity. Choose a wave to lose one marker ( "use 'em or lose 'em").`,
      buttons: free.map(w => ({ label: `Wave of ${w.markers.length - picked.filter(x => x === w.id).length} (${w.markers.join(', ')}) at ${Math.round(w.pos.x)},${Math.round(w.pos.y)}`, value: w.id })) }).value
    picked.push(id)
  }
  return picked
}
// condition 2: a ship armed with searbile may skip the order to move into contact; asked only when that condition is the one that would apply
function askSkipContact (g, lead) {
  if (!lead.profile.weapons.some(w => w.kind === 'bioplasma') || instinct(g, lead).cond !== 2) return false
  return asker.ask({ side: lead.side, title: `${g.sides[lead.side].name}: skip the contact condition?`, text: `${lead.name} has an enemy in its front arc under 15 cm away and carries searbile. It may skip "must move into contact and board" and read the next condition.`, buttons: [{ label: 'Skip it', value: true }, { label: 'Move into contact', value: false, primary: true }] }).value
}
// A Rukka hulk nominates which weapon system gets this turn's re-roll before its dice are rolled
function askNominate (g, ship, t) { return asker.ask({ side: ship.side, buttons: [{ label: 'Name it', value: true }, { label: 'Not this one', value: false, primary: true }], title: `${g.sides[ship.side].name}: ${t.kind === 'maniac' ? 'Maniac Gunners' : 'Nicked Torpedoes'} on the hulk`, text: `${ship.name} may use the re-roll on only one ${t.kind === 'maniac' ? 'weapon system' : 'torpedo battery'} this turn, named before the roll. Name the ${t.weapon.loc} ${t.weapon.kind} (${t.weapon.str}) now?` }).value }
function askSwapGaffer (g, w, cands) {   //
  return asker.ask({ side: w.side, title: `${g.sides[w.side].name}: Gaffer swaps Resolve?`, text: `${w.name} (Resolve ${w.leadership}) carries a Gaffer, who may swap Resolve with one ship or escort squadron under his command.`, buttons: [...cands.map(c => ({ label: `${c.name} (Resolve ${c.leadership})`, value: c.uid })), { label: 'No swap', value: null, primary: true }] }).value
}
function askSwapLeadership (g, big, cands) {
  return asker.ask({ side: big.side, title: `${g.sides[big.side].name}: swap Resolve?`, text: `${big.name} (Resolve ${big.leadership}) may swap with a Bash cruisa or Bovver ship.`, buttons: [...cands.map(c => ({ label: `${c.name} (Resolve ${c.leadership})`, value: c.uid })), { label: 'No swap', value: null, primary: true }] }).value
}
// A boarding torpedo may make one 45 degree turn at the start of the Ordnance Phase
function askSteer (g, o) {
  return asker.ask({ side: o.side, title: `${g.sides[o.side].name}: steer a boarding torpedo?`, text: 'A boarding torpedo salvo may make a single 45 degree turn from the centre of its marker before it moves.', buttons: [{ label: 'Straight on', value: 0, primary: true }, { label: 'Turn left 45', value: -45 }, { label: 'Turn right 45', value: 45 }] }).value
}
// A Prime Guard rolls two dice and the player uses either
function askHonourDie (g, ship, d) {
  return asker.ask({ side: ship.side, title: `${g.sides[ship.side].name}: Prime Guard`, text: `${ship.name}'s Prime Guard rolled ${d[0]} and ${d[1]} (before the +1 for Concord). Which does the Hit-and-Run attack use?`, buttons: [{ label: `Use the ${d[0]}`, value: 0, primary: true }, { label: `Use the ${d[1]}`, value: 1 }] }).value
}
// Dropwing Annihilators may forgo their attack runs to suppress turrets, decided before the turrets fire
function askForgo (g, ship, t) {
  const buttons = Array.from({ length: Math.min(t.annihilators - 1, t.turrets) + 1 }, (_, n) => ({ label: n === 0 ? 'All attack' : `${n} forgo their run${n > 1 ? 's' : ''}`, value: n, primary: n === 0 }))
  if (buttons.length < 2) return 0
  return asker.ask({ side: g.active, title: `${g.sides[g.active].name}: Annihilator attack on ${ship.name}`, text: `${t.annihilators} Annihilators attack a ship with ${t.turrets} turret${t.turrets === 1 ? '' : 's'}. Each one that forgoes its attack run adds +1 attack to the others, up to the ship's turrets or the surviving attackers; at least one must attack.`, buttons }).value
}

// Each 6 repairs one critically damaged system or puts out one fire, and the player says which
function askRepair (g, ship, left) {
  if (left.length === 1) return left[0]
  return asker.ask({ side: ship.side, title: `${g.sides[ship.side].name}: ${ship.name} repairs`, text: 'A 6 on the repair dice: what do the crews fix first?', buttons: left.map((k, i) => ({ label: k === 'fire' ? 'Put out a fire' : critName(k), value: k, primary: i === 0 })) }).value
}

// a question on the screen (replay.js): the game waits for its answer
const asker = createAsker()
{ const ask = asker.ask; asker.ask = q => asker.cpu?.(q) ? { value: (q.buttons.find(b => b.primary) ?? q.buttons[0]).value, fields: Object.fromEntries((q.fields ?? []).map(f => [f.id, f.value])) } : ask(q) }
// ---------------- the computer player's hands (battle/computerTurn.js): the same act as the buttons ----------------
let cpu = null
const cpuAground = new Set()
function cpuRun (fn, a) {
  if (a.uid != null && a.kind !== 'place') ui.selected = a.uid
  if (a.kind === 'move') { const s = shipByUid(game, a.uid), c = checkMove(game, s, a.legs), pts = [s.pos, ...c.path.segs.map(g => ({ x: g.b.x, y: g.b.y, f: g.facing }))]; return act(fn, { path: { uid: s.uid, pts } }) }
  return act(fn)
}
function cpuNext () { ui.move = null; ui.gun = null; ui.torpAim = null; ui.craftAim = false; ui.wave = null; ui.plan = null; ui.shots = {}; ui.sunburst = false; ui.teleports.clear(); act(() => nextPhase(game, { teleports: [] })) }
function showAsk (q, then) {
  const box = $('ask')
  box.className = 'plate'
  box.innerHTML = `<h3 class="${q.side == null ? '' : SIDE_CLASS[q.side]}">${q.title}</h3><div>${q.text}</div>${q.fields ? `<div class="btns">${q.fields.map(f => `<label>${f.label} <input type="number" data-field="${f.id}" value="${f.value}"></label>`).join('')}</div>` : ''}<div class="btns">${q.buttons.map((b, i) => `<button data-answer="${i}" class="${b.primary ? 'primary' : ''}">${b.label}</button>`).join('')}</div>`
  $('ask-block').hidden = false
  box.onclick = e => {
    const b = e.target.closest('[data-answer]')
    if (!b) return
    const fields = Object.fromEntries([...box.querySelectorAll('[data-field]')].map(i => [i.dataset.field, i.value]))
    $('ask-block').hidden = true
    then({ value: q.buttons[+b.dataset.answer].value, fields })
  }
}

// ---------------- actions: each runs one engine call, then redraws ----------------
function act (fn, { path } = {}) {
  ui.sail = null   // a sail in hand ends with whatever the engine is asked to do now
  const before = game.log.length
  // where everything is drawn before: what moved glides from there (fx.js); a planned move follows its path
  const was = new Map()
  for (const x of game.ships) if (x.pos) was.set('ship:' + x.uid, FX.drawnAt('ship:' + x.uid, x.pos.x, x.pos.y, x.facing))
  for (const o of game.ordnance) if (o.pos) was.set('ord:' + o.id, FX.drawnAt('ord:' + o.id, o.pos.x, o.pos.y, o.facing))
  const snap = snapshot(game)
  asker.clear()
  const run = () => {
    asker.begin(); fxHeld = []
    try { fn() } catch (e) {
      if (e instanceof Ask) {   // a question: back to before the action, ask it, then run it again with the answer (replay.js)
        fxHeld = null; restore(game, snap); render()
        return showAsk(e.question, a => { asker.answer(a); run() })
      }
      console.error(e); game.log.push({ text: 'Error: ' + e.message })
    }
    const fired = fxHeld; fxHeld = null
    const now = [...game.ships.filter(x => x.pos).map(x => ['ship:' + x.uid, x.pos, x.facing, x.uid]), ...game.ordnance.filter(o => o.pos).map(o => ['ord:' + o.id, o.pos, o.facing])]
    for (const [key, p, f, uid] of now) {
      const w = was.get(key)
      if (!w || (Math.abs(w.x - p.x) < 0.01 && Math.abs(w.y - p.y) < 0.01) || Math.abs(w.y - p.y) > 400) continue   // new, still, or between tables
      const way = path && path.uid === uid ? [...path.pts.slice(1, -1), { x: p.x, y: p.y, f }] : [{ x: p.x, y: p.y, f }]
      FX.glide(key, w, way, { ship: key.startsWith('ship:'), steer: !!(path && path.uid === uid) })   // ships move, then turn (fx.js)
    }
    // the camera flies in on a shot before it is fired
    const firing = fired.filter(e => ['lance', 'battery', 'sunburst'].includes(e.kind))
    const pts = firing.flatMap(e => [...e.from.filter(x => x.pos).map(x => x.pos), e.to?.pos ?? e.to].filter(Boolean))
    FX.newAction(cinematic(pts))
    for (const e of fired) playFx(e)   // only the run that finished is shown
    ui.logMark = before
    if (ui.selected && !shipByUid(game, ui.selected)?.pos) ui.selected = null
    render()
    kick()
    askAgroundTurn()
  }
  run()
}
// RUN AGROUND (Tides of the Archipelago): a ship that hits the shore takes damage and the engine pushes it clear, facing
// away; its player then picks a new heading so it does not run aground again at once
const HEADINGS = [['Up', 270], ['Up and right', 315], ['Right', 0], ['Down and right', 45], ['Down', 90], ['Down and left', 135], ['Left', 180], ['Up and left', 225]]
function askAgroundTurn () {
  const s = game.ships.find(x => x.state === 'active' && x.aground && x.aground.round === game.round && !x.aground.turned)
  if (!s) return
  if (asker.cpu?.({ side: s.side })) {   // the computer's ship: towards the nearest enemy; asked once (a refusal leaves it facing as the engine pushed it)
    const key = `${s.uid}:${game.round}`
    if (cpuAground.has(key)) return
    cpuAground.add(key)
    return setTimeout(() => act(() => turnAfterAground(game, s, agroundHeading(game, s))), 0)
  }
  const hit = s.aground.ship != null ? shipByUid(game, s.aground.ship) : null   // a collision at sea (rules/movement.js collide)
  showAsk({ side: s.side, title: hit ? `${s.name} collided with ${hit.name}` : `${s.name} ran aground`, text: hit ? `It has been pushed 1 cm clear of ${hit.name}, still facing the way it was going. Which way should it face now? (Up is the top of the table.)` : 'It has been pushed clear of the shore and faces away from the island. Which way should it face now? (Up is the top of the table.)',
    buttons: [{ label: hit ? 'Keep this heading' : 'Keep facing away', value: null, primary: true }, ...HEADINGS.filter(([, value]) => !afterAgroundProblem(game, s, value)).map(([label, value]) => ({ label, value }))] },   // headings that would swing the hull onto an island or a ship are left out
  a => act(() => turnAfterAground(game, s, a.value ?? s.facing)))
}
let fxHeld = null
function playFx (e) {
  // a boarding torpedo just launched: its boarding party runs to the bow and climbs in first
  if (SEA && e.kind === 'launch' && e.to?.uid != null) {
    const t = [...game.ordnance].reverse().find(o => o.kind === 'torpedo' && o.boarding && o.from === e.to.uid)
    if (t) FX.assembleFx({ p: drawnPos(e.to), facing: e.to.facing, len: shipLen(e.to), figs: figHrefs(SEA_BOARDERS, game.sides[e.to.side].fleet) })
  }
  if (SEA && ['lance', 'battery', 'sunburst'].includes(e.kind)) { for (const s of e.from ?? []) if (s?.uid != null) firingUntil.set(s.uid, performance.now() + 2400); setTimeout(() => { if (game) render() }, 2500) }
  try { if (fightFx(e)) { kick(); return } } catch (err) { console.error('animation', err); return }
  try { FX.play(e, s => { const d = FX.drawnAt('ship:' + s.uid, s.pos.x, s.pos.y, s.facing); return { x: d.x, y: d.y } }); kick() } catch (err) { console.error('animation', err) } }
// one animation loop: gliding ships and ordnance, and the shots (fx.js), drawn until they are all done
let looping = false, lastT = 0
function kick () { if (!looping) { looping = true; lastT = performance.now(); requestAnimationFrame(tick) } }
function tick (t) {
  const dt = Math.min(0.064, (t - lastT) / 1000); lastT = t
  const moving = FX.gliding(), guns = Guns.turning()
  if (moving) FX.stepGlides(dt)
  if (guns) Guns.stepGuns(dt)
  if (moving || guns) { renderBoard(); pips?.place() }
  const f = FX.frame()
  $('board-fx').innerHTML = f.svg ? twoTables(f.svg) : ''
  if (!f.busy) Guns.release()   // the shots are done: the guns swing back
  stepCamera(t, dt, f.busy || moving)
  if (FX.gliding() || f.busy || Guns.turning() || flight || cine.back != null || panning()) requestAnimationFrame(tick)
  else { looping = false; renderBoard(); renderPips() }   // the pips come back when it has all finished
}
// ---- the camera: WASD and the arrow keys, and the cinematic zoom: it flies in on the firer
// and target, and back to where you were when the shots are done. Anything you do to the map cancels the flight.
const PAN_KEYS = { KeyW: [0, -1], ArrowUp: [0, -1], KeyS: [0, 1], ArrowDown: [0, 1], KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0] }
const held = new Set()
const panning = () => held.size > 0
const FLY_MS = 650
const cine = { back: null, due: 0 }
let flight = null
const ease = k => k * k * (3 - 2 * k)
function flyTo (v, ms) { flight = { from: { ...view }, to: v, t0: performance.now(), ms }; kick() }
function leaveCamera () { flight = null; cine.back = null }
function stepCamera (t, dt, busy) {
  if (held.size) {
    const px = view.w / $('board').clientWidth * 840 * dt   // 14 screen pixels a frame at 60 frames a second
    let x = 0, y = 0
    for (const k of held) { x += PAN_KEYS[k][0]; y += PAN_KEYS[k][1] }
    setView({ ...view, x: view.x + x * px, y: view.y + y * px })
  }
  if (flight) {
    const k = Math.min(1, (t - flight.t0) / flight.ms), e = ease(Math.max(0, k)), a = flight.from, b = flight.to
    setView({ x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e, w: a.w + (b.w - a.w) * e, h: a.h + (b.h - a.h) * e })
    if (k >= 1) flight = null
  } else if (cine.back && !busy) {
    if (!cine.due) cine.due = t + 700
    else if (t >= cine.due) { const v = cine.back; cine.back = null; cine.due = 0; flyTo(v, FLY_MS) }
  }
}
/** Fly in on these points, keeping them clear of the plates on the right. Returns how long the flight takes, 0 if there is none. */
function cinematic (points) {
  if (setup.cine !== 'on' || !points.length) return 0
  const shown = points.map(p => p.y >= 900 ? { x: p.x + LOW_DX, y: p.y + LOW_DY } : p)
  const x0 = Math.min(...shown.map(p => p.x)), x1 = Math.max(...shown.map(p => p.x)), y0 = Math.min(...shown.map(p => p.y)), y1 = Math.max(...shown.map(p => p.y))
  const box = $('board').getBoundingClientRect(), free = Math.max(0.55, 1 - ($('side').offsetWidth + 30) / box.width), pad = 16
  const discipline = FULL.h / FULL.w, w = Math.min(FULL.w, Math.max(50, (x1 - x0 + pad * 2) / free, (y1 - y0 + pad * 2) / discipline))
  if (!cine.back) cine.back = { ...view }
  cine.due = 0
  flyTo({ x: (x0 + x1) / 2 - w * free / 2, y: (y0 + y1) / 2 - w * discipline / 2, w, h: w * discipline }, FLY_MS)
  return FLY_MS
}
const selectedShip = () => ui.selected ? shipByUid(game, ui.selected) : null
const fleetMode = () => game.scenario === 'fleetEngagement' || !!game.sc
const nextPlace = () => game.sc ? nextScenarioPlace(game) : fleetMode() ? nextToPlace(game) : game.ships.find(x => x.side === game.placing && !x.pos)
// at sea nothing may be put down with its hull on an island or over another ship (rules/seaHull.js)
const seaPlaceWhy = (uid, P) => { const s = shipByUid(game, uid); if (!game.sea || !s || s.fort || s.profile.role === 'mine' || s.profile.role === 'minefield') return null; const Q = game.sc ? placeSpot(game, s, P) : P; return seaStandProblem(game, s, Q, shownFacing(s, Q)) }
const placeAt = (uid, P) => { const no = seaPlaceWhy(uid, P); return no ? { ok: false, reason: `${shipByUid(game, uid).name} can't go there: ${no}` } : game.sc ? placeScenarioShip(game, uid, P, ui.facing) : fleetMode() ? placeFleetShip(game, uid, P) : placeShip(game, uid, P) }
const placeWhy = (uid, P) => (game.sc ? scenarioPlaceProblem(game, uid, P) : game.scenario === 'fleetEngagement' ? fleetPlaceProblem(game, uid, P) : placeProblem(game, uid, P)) ?? seaPlaceWhy(uid, P)
// Cruiser Duel ships face the opposite long edge: a Fleet Engagement's follow the map's approach arrows
const facingLock = s => game.sc ? facingLocked(game, s) : game.scenario === 'fleetEngagement' ? 'ships set up facing the enemy\'s edge, along the approach arrows' : 'ships set up facing the opposite long table edge'
const shownFacing = (s, P) => game.sc ? facingFor(game, s, P, ui.facing) : zoneOf(game, game.zones[s.side]).facing
const vpOf = side => game.sc ? scenarioVP(game, side) : fleetMode() ? fleetVictoryPoints(game, side) : victoryPoints(game, side)
const setupDone = () => game.sc ? game.setupStep === 'ready' : allPlaced(game)
// the low orbit table is drawn LOW_DY cm above where the engine keeps it, just below the main table (lowOrbit.js)
const LOW_SHOW = 128, LOW_DY = LOW_SHOW - LOW.y0, LOW_DX = 60   // to the right, clear of the ship card (bottom left)
const mine = s => s && s.side === game.active
const isGun = w => GUN_KINDS.includes(w.kind)   // weapons batteries, lances, and the Athanatoi starlance (shooting.js)

// ---- moving by the mouse: the Move pip, then a green line follows the mouse straight ahead; a click fixes
// that stretch and the line swings for the turn; a click fixes the turn and the line runs ahead again; right click at any
// point makes the move as it stands. checkMove still judges it: this only reads the mouse into legs.
// A Katharos ship on All Ahead Full turns once per 20 cm, up to four turns, so the plan has up to four turns and five straights
const STAGES = ['a', 't1', 'b', 't2', 'c', 't3', 'd', 't4', 'e']
const isTurnStage = k => k[0] === 't'
const nullmass = s => !!s.profile.reactive && (orderOf(s) === 'brace' ? s.order.was?.kind : orderOf(s)) === 'aheadFull'
const turnsOpen = s => checkMove(game, s, []).turns
// may it turn after `a` cm? (Burn Retros and low orbit need no distance first; a hulk at the end of its 10 cm)
function mayTurnAt (s, a, total = a, made = 0) {
  const order = orderOf(s) === 'brace' ? s.order.was?.kind : orderOf(s)
  if (nullmass(s)) return total >= 20 * (made + 1) - 1e-6   // A turn for every 20 cm travelled
  return order === 'burnRetros' || s.lowOrbit || a >= turnDistance(s) - 1e-6
}
function moveHint (s, c) {
  const st = ui.move.stage, turns = turnsOpen(s)
  if (st === 'a') return turns === 0 ? 'right click: go' : mayTurnAt(s, ui.plan.a) ? 'click: turn here · right click: go' : `${nullmass(s) ? 20 : turnDistance(s)} cm before it can turn · right click: go`
  if (isTurnStage(st)) return 'click: fix the turn · right click: go'
  if (!isTurnStage(st)) return 'click: stop here · right click: go'
  return 'right click: go'
}
const legPoint = (s, upto) => {   // where the plan stands, and its heading, before stage `upto`
  const p = ui.plan
  let at = s.pos, f = s.facing + (p.g1 || 0)   // a gravity well's free turn at the start
  for (const k of STAGES) {
    if (k === upto) return { at, f }
    if (isTurnStage(k)) f += p[k] || 0; else at = along(at, f, p[k] || 0)
  }
  return { at, f }
}
function steerMove (P) {
  const s = selectedShip(), m = ui.move, p = ui.plan
  if (!s || !m || m.stage === 'done') return
  const lim = checkMove(game, s, []), st = m.stage, { at, f } = legPoint(s, st)
  const out = d => Math.round(d * 2) / 2
  if (!isTurnStage(st)) {
    const used = STAGES.slice(0, STAGES.indexOf(st)).filter(k => !isTurnStage(k)).reduce((a, k) => a + (p[k] || 0), 0), room = Math.max(0, lim.max - used)
    const ahead = dist(at, P) * Math.cos((angleTo(at, P) - f) * Math.PI / 180)
    let d = Math.min(room, Math.max(0, out(ahead)))
    if (ahead >= room) d = room                       // the most it may go is always reachable
    if (st === 'a' && lim.turns === 0) d = Math.max(Math.min(lim.min, room), d)   // no turn to come, so nothing can make up a short move
    if (s.id === 'spacehulk') d = 10
    p[st] = round1(d)
  } else {
    const most = s.id === 'spacehulk' ? 45 : s.profile.turns
    p[st] = Math.max(-most, Math.min(most, Math.round(norm(angleTo(at, P) - f) / 5) * 5))
  }
  renderBoard(); renderPips()
}
/** A left click while moving: fixes this stage and goes on to the next, as far as the ship's turns allow. */
function nextMoveStage () {
  const s = selectedShip(), m = ui.move, turns = turnsOpen(s), p = ui.plan
  const at = STAGES.indexOf(m.stage)
  if (isTurnStage(m.stage)) { m.stage = STAGES[at + 1] ?? 'done'; return renderBoard() }
  // after a straight stage: another turn only if the ship has one left and has gone far enough since the last ( for a Katharos's 20 cm)
  const made = STAGES.slice(0, at).filter(isTurnStage).length, total = STAGES.slice(0, at + 1).filter(k => !isTurnStage(k)).reduce((a, k) => a + (p[k] || 0), 0)
  const since = p[m.stage] || 0, next = STAGES[at + 1]
  const may = next && made < turns && (made === 0 ? mayTurnAt(s, since, total, 0) : nullmass(s) ? mayTurnAt(s, since, total, made) : since >= (s.profile.type === 'escort' ? 0 : turnDistance(s)))
  m.stage = may ? next : 'done'
  renderBoard()
}
function startMove (s) {
  ui.plan = { a: 0, t1: 0, b: 0, t2: 0, c: 0, t3: 0, d: 0, t4: 0, e: 0, g1: ui.g1 || 0, g2: 0 }; ui.planEdited = false; ui.move = { stage: 'a' }; ui.g1 = 0
  if (s.id === 'spacehulk') ui.plan.a = 10
  render()
}
function cancelMove () { ui.move = null; ui.plan = null; render() }
/** Right click: the move as it stands. Too short or otherwise refused, it says why and you carry on. */
function confirmMove () {
  const s = selectedShip()
  if (!s || !ui.move) return
  const c = checkMove(game, s, legsOf(ui.plan))
  if (!c.ok) { game.log.push({ text: `${s.name} can't make that move: ${c.reasons.join('; ')}` }); ui.logMark = game.log.length - 1; return renderLog() }
  doMove(s)
}

/** Make the planned move; the ship glides along the plan's path (fx.js). */
function doMove (s) {
  const legs = legsOf(ui.plan), c = checkMove(game, s, legs), picked = ui.boarding || $('boardSel')?.value
  const board = picked && canBoardFrom(game, { ...s, pos: c.path.end, facing: c.path.facing }, shipByUid(game, +picked)) ? picked : null   // only if the move really ends touching it (in reach at sea)
  const pts = [s.pos, ...c.path.segs.map(g => ({ x: g.b.x, y: g.b.y, f: g.facing }))]
  ui.plan = null; ui.boarding = null; ui.move = null; ui.planEdited = false
  return act(() => moveShip(game, s, legs, board ? { board: +board } : {}), { path: { uid: s.uid, pts } })
}

// a movement plan: straight a cm, turn t1°, b cm, turn t2° (Come to New Heading only), c cm
function legsOf (p) {
  const legs = []
  if (p.g1) legs.push({ turn: p.g1, gravity: true })   // a gravity well's free turn at the start
  if (p.a > 0) legs.push({ fwd: p.a })
  if (p.t1) legs.push({ turn: p.t1 })
  if (p.b > 0) legs.push({ fwd: p.b })
  if (p.t2) legs.push({ turn: p.t2 })
  if (p.c > 0) legs.push({ fwd: p.c })
  if (p.t3) legs.push({ turn: p.t3 })
  if (p.d > 0) legs.push({ fwd: p.d })
  if (p.t4) legs.push({ turn: p.t4 })
  if (p.e > 0) legs.push({ fwd: p.e })
  if (p.g2) legs.push({ turn: p.g2, gravity: true })   // and at the end
  return legs
}
const round1 = x => Math.round(x * 10) / 10
const lerp2 = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
/** A plan that heads for point P: straight to the turning point, one turn (no more than the ship's), then on. */
function planToward (ship, P) {
  const lim = checkMove(game, ship, [])
  const order = orderOf(ship) === 'brace' ? ship.order.was?.kind : orderOf(ship)
  const ahead = norm(angleTo(ship.pos, P) - ship.facing), D = dist(ship.pos, P)
  if (ship.id === 'spacehulk') {   // 10 cm straight, then up to 45° towards the click if it may turn
    const end = along(ship.pos, ship.facing, 10)
    let t = lim.turns ? Math.max(-45, Math.min(45, norm(angleTo(end, P) - ship.facing))) : 0
    t = Math.round(t / 5) * 5
    return { a: 10, t1: 0, b: 0, t2: 0, c: 0, g1: 0, g2: 0, ...(t ? { t1: t } : {}) }
  }
  if (lim.turns === 0 || Math.abs(ahead) < 3) {
    const along1 = Math.max(lim.min, Math.min(lim.max, D * Math.cos(ahead * Math.PI / 180)))
    return { a: round1(along1), t1: 0, b: 0, t2: 0, c: 0, g1: 0, g2: 0 }
  }
  const a = order === 'burnRetros' ? 0 : nullmass(ship) ? 20 : turnDistance(ship)   // A Katharos's first turn comes after 20 cm
  const A = along(ship.pos, ship.facing, a)
  let t = norm(angleTo(A, P) - ship.facing)
  t = Math.max(-ship.profile.turns, Math.min(ship.profile.turns, t))
  t = Math.round(t / 5) * 5 || (t > 0 ? 5 : -5)
  let b = dist(A, P) * Math.cos((norm(angleTo(A, P) - ship.facing) - t) * Math.PI / 180)
  b = Math.max(lim.min - a, Math.min(lim.max - a, b))
  return { a, t1: t, b: round1(Math.max(0, b)), t2: 0, c: 0, g1: 0, g2: 0 }
}

// ---- sailing by the mouse (the Athanatoi; rules/sail.js) ----
// A sailing ship turns to ANY heading first and then goes straight; its speed is one of three by the arc the sunward table edge
// lies in after the turn. Same grammar as the Move pip above: the ship faces the mouse and the line stretches to it (never past
// what the engine allows on that heading), left click fixes it (again frees it), right click goes, Esc cancels. Nothing here
// decides: sailOptions says what is allowed and what each speed is, sailMove does it.
const SAIL_REFUSED = ['aheadFull', 'burnRetros', 'newHeading']   // hidden for sailors; giveOrder refuses them (game.js)
const sailing = () => !!ui.sail && ui.selected === ui.sail.uid
const sailedNow = s => (s.sailed && s.sailed.round === game.round && s.sailed.side === s.side ? s.sailed : null)
const lockedOnSail = s => (orderOf(s) === 'brace' ? s.order.was?.kind : orderOf(s)) === 'lockOn'
let lastMouse = null   // where the mouse last was on the board, in cm: a sail begun by a pip starts from it
/** The move a sailor may make now ('first' in its Manoeuvre Phase, 'second' in its own Ordnance Phase), and why it may not yet. */
function sailTurn (s) {
  if (game.phase === 'movement') return s.movedThisPhase ? null : { when: 'first', why: null }
  if (game.phase === 'ordnance' && s.side === game.active && !sailedNow(s)?.second) return { when: 'second', why: secondMoveProblem(game, s) }
  return null
}
const speedsText = bd => ['front', 'rear', 'side'].map(a => bd.bands.find(b => b.arc === a)).map(b => `${b.printed}${b.cm !== b.printed ? ` (${b.cm})` : ''}`).join(' / ') + ' cm (front / rear / side)'
function sailWhy (s) {
  const bd = sunBands(game, s)
  return `Sails by the sun: it turns to any heading, then goes straight, from 0 cm up to its speed. Sunward edge: ${bd.edge ?? 'not rolled yet'}. Speeds ${speedsText(bd)}: the speed is the one for the arc the sunward edge lies in after the turn. The ship faces the mouse and the line stretches to it; click fixes it, right click goes, Esc cancels.`
}
function startSail (s) {
  ui.plan = null; ui.move = null; ui.planEdited = false; ui.boarding = null
  ui.sail = { uid: s.uid, heading: s.facing, want: 0, dist: 0, fixed: false, arc: null, endTurn: 0 }
  if (lastMouse) steerSail(lastMouse)
  render()
}
const cancelSail = () => { ui.sail = null; ui.boarding = null; render() }
/** The ship's options for the sail as it stands (read-only). */
const sailNow = (s, m = ui.sail) => sailOptions(game, s, m.heading, { dist: m.dist, arc: m.arc ?? undefined, peek: true })
/** Cap the stretch at what the engine allows on this heading, and drop an arc choice that no longer applies. */
function fitSail (s) {
  const m = ui.sail
  const o0 = sailOptions(game, s, m.heading, { peek: true })
  if (m.arc && !o0.options.some(x => x.arc === m.arc)) m.arc = null
  const o = sailOptions(game, s, m.heading, { peek: true, arc: m.arc ?? undefined })
  m.dist = round1(Math.max(0, Math.min(o.max, m.want >= o.max ? o.max : Math.round(m.want * 2) / 2)))
}
function steerSail (P) {
  const s = selectedShip(), m = ui.sail
  if (!s || !m || m.uid !== s.uid || m.fixed) return
  const d = dist(s.pos, P), locked = lockedOnSail(s)
  m.heading = locked ? s.facing : d > 0.3 ? Math.round(angleTo(s.pos, P)) : m.heading
  const ahead = locked ? d * Math.cos((angleTo(s.pos, P) - s.facing) * Math.PI / 180) : d
  m.want = ahead <= 1 ? 0 : ahead   // inside the base: a pure turn, no distance
  fitSail(s)
  if (ui.boarding != null) ui.boarding = null
  renderBoard(); renderPips(); renderActions()   // the side panel's numbers follow the mouse too
}
/** Right click: the sail as it stands. Refused, it says why and you carry on. */
function confirmSail () {
  const s = selectedShip(), m = ui.sail
  if (!s || !m || m.uid !== s.uid) return
  const o = sailNow(s)
  if (!o.ok) { game.log.push({ text: `${s.name} can't make that move: ${o.reasons.join('; ')}` }); ui.logMark = game.log.length - 1; return renderLog() }
  const board = ui.boarding != null && o.when === 'first' && canBoardFrom(game, { ...s, pos: o.path.end, facing: m.heading }, shipByUid(game, ui.boarding)) ? ui.boarding : null
  const opts = { dist: m.dist, ...(m.arc ? { arc: m.arc } : {}), ...(board != null ? { board } : {}), ...(m.endTurn ? { endTurn: m.endTurn } : {}) }
  const heading = m.heading, end = o.path.end
  ui.sail = null; ui.boarding = null
  return act(() => sailMove(game, s, heading, opts), { path: { uid: s.uid, pts: [s.pos, { x: end.x, y: end.y, f: heading }] } })
}
/** A heading and distance that end touching `e` (first move only), or null. Judged by the engine's own sailOptions. */
function planSailTouch (s, e) {
  if (game.sea) return planSailReach(s, e)
  const R = baseR(s) + baseR(e) - 0.3, base = Math.round(angleTo(s.pos, e.pos)), vx = e.pos.x - s.pos.x, vy = e.pos.y - s.pos.y
  for (const dh of [0, 1, -1, 2, -2, 3, -3]) {
    const heading = base + dh, ux = Math.cos(heading * Math.PI / 180), uy = Math.sin(heading * Math.PI / 180)
    const tc = vx * ux + vy * uy, perp2 = vx * vx + vy * vy - tc * tc
    if (perp2 > R * R) continue
    const t0 = tc - Math.sqrt(R * R - perp2)
    for (const add of [0, 0.2, 0.4]) {
      const d = Math.max(0, Math.ceil((t0 + add) * 10) / 10), o = sailOptions(game, s, heading, { dist: d, peek: true })
      if (o.ok && touching({ ...s, pos: o.path.end }, e)) return { heading, dist: d }
    }
  }
  return null
}
// AT SEA (Tides house rule, rules/movement.js boardReach): a boarding needs the enemy within SEA_BOARD_RANGE cm in a side arc at the end of
// the move, not contact. These find the shortest move that ends so, its path not running into the enemy (that would be a collision).
const reachAt = (s, pos, facing, e) => boardReach({ ...s, pos, facing }, e) && dist(pos, e.pos) - baseR(s) - baseR(e) >= 0.5
const clearOf = (a, b, s, e) => firstContact(a, b, baseR(s), e.pos, baseR(e)) == null || dist(a, e.pos) - baseR(s) - baseR(e) < 0   // already touching: free to leave
const reachMemo = new Map()   // planToReach / planSailReach per ship, enemy and where both stand: the search is a few thousand points
const reachKey = (k, s, e) => [k, s.uid, s.pos.x, s.pos.y, s.facing, e.uid, e.pos.x, e.pos.y, game.round, game.phase, s.order?.kind ?? '', game.ordersFailed[s.side] ? 1 : 0, game.blast.length, enemiesOf(game, s).filter(x => x.order).length].join('|')   // the Command check odds change with Blast Markers and enemy orders
const outOfReach = (s, e, most) => dist(s.pos, e.pos) - baseR(s) - baseR(e) > most + SEA_BOARD_RANGE + 1
function memoReach (k, s, e, f) {
  const key = reachKey(k, s, e)
  if (!reachMemo.has(key)) { if (reachMemo.size > 400) reachMemo.clear(); reachMemo.set(key, f()) }
  return reachMemo.get(key)
}
function planSailReach (s, e) {
  if (outOfReach(s, e, sailOptions(game, s, s.facing, { peek: true }).max + 40)) return null
  return memoReach('sail', s, e, () => planSailReachNow(s, e))
}
function planSailReachNow (s, e) {
  let best = null
  for (let h = 0; h < 360; h += 5) {
    const o0 = sailOptions(game, s, h, { peek: true })
    for (let d = 0; d <= o0.max + 1e-6; d += 0.5) {
      if (best && d >= best.dist) break
      const end = along(s.pos, h, d)
      if (!clearOf(s.pos, end, s, e)) break
      if (reachAt(s, end, h, e)) { const o = sailOptions(game, s, h, { dist: d, peek: true }); if (o.ok && !pathBlocked(game, s, o.path.segs ?? [{ a: s.pos, b: o.path.end, from: 0, len: d, facing: h }])) { best = { heading: h, dist: d }; break } }
    }
  }
  return best
}
function planToReach (s, e) {
  const lim = checkMove(game, s, [])
  if (outOfReach(s, e, lim.max)) return null
  return memoReach('legs', s, e, () => planToReachNow(s, e, lim))
}
function planToReachNow (s, e, lim) {
  const empty = { a: 0, t1: 0, b: 0, t2: 0, c: 0, g1: 0, g2: 0 }
  // the engine's own judgement: a legal move, ending in reach, that runs into no other ship and no island on the way (rules/movement.js)
  const works = p => { const c = checkMove(game, s, legsOf(p)); return c.ok && canBoardFrom(game, { ...s, pos: c.path.end, facing: c.path.facing }, e) && !pathBlocked(game, s, c.path.segs, c.path.facing) }
  for (let d = Math.ceil(lim.min * 2) / 2; d <= lim.max + 1e-6; d += 0.5) {   // straight on, the shortest first
    const end = along(s.pos, s.facing, d)
    if (!clearOf(s.pos, end, s, e)) break
    if (reachAt(s, end, s.facing, e) && works({ ...empty, a: d })) return { ...empty, a: d }
  }
  if (lim.turns < 1) return null
  let best = null
  for (let a = turnDistance(s); a <= lim.max + 1e-6; a += 1) {   // a run, one turn, a run in: the shortest total
    const A = along(s.pos, s.facing, a)
    if (!clearOf(s.pos, A, s, e)) break
    for (let t = -s.profile.turns; t <= s.profile.turns; t += 5) {
      if (!t) continue
      const f = s.facing + t
      for (let b = 0; a + b <= lim.max + 1e-6; b += 0.5) {
        if (a + b < lim.min - 1e-6) continue
        if (best && a + b >= best.a + best.b) break
        const end = along(A, f, b)
        if (!clearOf(A, end, s, e)) break
        if (reachAt(s, end, f, e)) { const p = { ...empty, a, t1: t, b }; if (works(p)) { best = p; break } }
      }
    }
  }
  return best
}
// THE BOARDING FINDER WITH ORDERS: a boarding may need a turn or a special order to reach the enemy.
// When no plain move reaches an enemy, the Board pip
// offers the special order that gives the best chance: Come to New Heading (two turns), Burn Retros (one turn anywhere, half speed), or All
// Ahead Full (straight on, the extra distance rolled), each with the chance of passing the Command check and, for All Ahead
// Full, of rolling a distance that ends in reach. The rules decide it all when pressed (giveOrder, moveShip); this only finds and shows.
const P2D6 = n => { let k = 0; for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) if (a + b <= Math.min(10, n)) k++; return k / 36 }   // 11 and 12 always fail
function commandOdds (s, kind) {
  if (kind === 'aheadFull' && raceRule(s.profile.fleet).freeAheadFull) return { p: 1, text: 'no Command check for Rukka ships' }
  if (kind === 'newHeading' && raceRule(s.profile.fleet).autoNewHeading && !s.crits.manoeuvre) return { p: 1, text: 'passed automatically by Thnitoi ships' }
  const m = commandModifiers(game, s).total, need = Math.min(10, leadershipOf(s) + m)
  return { p: P2D6(need), text: `Command check 2D6 ≤ ${need} (Resolve ${leadershipOf(s)}${m ? ` ${m > 0 ? '+' : ''}${m}` : ''}), ${Math.round(P2D6(need) * 100)}%` }
}
// the move ends where it may board e: touching in space, in reach at sea (Tides house rule)
const boardGoal = (s, e) => (pos, f) => game.sea ? reachAt(s, pos, f, e) : (d => d <= 0 && d >= -1.2)(dist(pos, e.pos) - baseR(s) - baseR(e))
/** The shortest legal plan for `sim` (the ship as it would be on an order) that ends where it may board e, with up to `turns` turns. */
function searchBoard (sim, e, turns) {
  const lim = checkMove(game, sim, []), goal = boardGoal(sim, e), empty = { a: 0, t1: 0, b: 0, t2: 0, c: 0, g1: 0, g2: 0 }
  const T = sim.profile.turns, angles = [...new Set([-T, -Math.round(T / 2 / 5) * 5, Math.round(T / 2 / 5) * 5, T])].filter(Boolean)
  const free = (a, b) => !game.sea || clearOf(a, b, sim, e)
  const works = p => { const c = checkMove(game, sim, legsOf(p)); return c.ok && goal(c.path.end, c.path.facing) && !pathBlocked(game, sim, c.path.segs, c.path.facing) }
  const retros = orderOf(sim) === 'burnRetros', first = retros ? 0 : turnDistance(sim)
  let best = null
  const total = p => p.a + p.b + p.c
  for (let a = Math.ceil(lim.min * 2) / 2; a <= lim.max + 1e-6; a += 0.5) { const end = along(sim.pos, sim.facing, a); if (!free(sim.pos, end)) break; if (goal(end, sim.facing) && works({ ...empty, a })) return { ...empty, a } }
  if (lim.turns < 1 || turns < 1) return null
  for (let a = first; a <= lim.max + 1e-6; a += 1) {
    const A = along(sim.pos, sim.facing, a)
    if (!free(sim.pos, A)) break
    for (const t1 of angles) {
      const f1 = sim.facing + t1
      for (let b = 0; a + b <= lim.max + 1e-6; b += turns > 1 ? 1 : 0.5) {
        if (best && a + b >= total(best)) break
        const B = along(A, f1, b)
        if (!free(A, B)) break
        if (a + b >= lim.min - 1e-6 && goal(B, f1)) { const p = { ...empty, a, t1, b }; if (works(p)) { best = p; break } }
        if (turns < 2 || lim.turns < 2 || b < (sim.profile.type === 'escort' ? 0 : turnDistance(sim))) continue
        for (const t2 of angles) {
          const f2 = f1 + t2
          for (let c = 0.5; a + b + c <= lim.max + 1e-6; c += 0.5) {
            if (best && a + b + c >= total(best)) break
            const C = along(B, f2, c)
            if (!free(B, C)) break
            if (a + b + c >= lim.min - 1e-6 && goal(C, f2)) { const p = { ...empty, a, t1, b, t2, c }; if (works(p)) { best = p; break } }
          }
        }
      }
    }
  }
  return best
}
/** The chance All Ahead Full straight on ends in reach of e: over every total of its extra dice. Returns { p, plan } or null. */
function aheadFullOdds (s, e) {
  const sim = { ...s, order: { kind: 'aheadFull', round: game.round, side: game.active, extra: 0 } }, { dice, mult } = aheadFullSpec(s), goal = boardGoal(s, e)
  let dist0 = [1]   // the chance of each total of the extra dice
  for (let i = 0; i < dice; i++) { const n = new Array(dist0.length + 6).fill(0); dist0.forEach((q, t) => { for (let f = 1; f <= 6; f++) n[t + f] += q / 6 }); dist0 = n }
  let p = 0
  dist0.forEach((q, t) => {
    if (!q) return
    const extra = t * mult, c = checkMove(game, { ...sim, order: { ...sim.order, extra } }, [{ fwd: speedOf(s) + extra }])
    if (c.ok && goal(c.path.end, c.path.facing) && !pathBlocked(game, s, c.path.segs, c.path.facing)) p += q
  })
  return p > 0 ? { p } : null
}
/** The best way to board e with a special order, or null: { kind, p (overall chance), plan (null for All Ahead Full), text }. */
function orderBoardPlan (s, e) {
  if (s.order || game.ordersFailed[s.side] || isSailor(s) || s.profile.fleet === 'defence') return null
  if (outOfReach(s, e, speedOf(s) + 6 * aheadFullSpec(s).dice * aheadFullSpec(s).mult)) return null
  return memoReach('orders', s, e, () => {
    const opts = []
    for (const kind of ['newHeading', 'burnRetros']) {
      const plan = searchBoard({ ...s, order: { kind, round: game.round, side: game.active } }, e, kind === 'newHeading' ? 2 : 1)
      if (plan) { const o = commandOdds(s, kind); opts.push({ kind, plan, p: o.p, text: o.text }) }
    }
    const af = aheadFullOdds(s, e)
    if (af) { const o = commandOdds(s, 'aheadFull'); opts.push({ kind: 'aheadFull', plan: null, p: o.p * af.p, reach: af.p, text: `${o.text}; then ${Math.round(af.p * 100)}% to roll a distance that ends in reach` }) }
    return opts.sort((a, b) => b.p - a.p)[0] ?? null
  })
}
/** Press: give the order (the Command check is rolled), and if it passes make the move and board. All one action, every roll in the log. */
function boardWithOrder (s, e, o) {
  act(() => {
    const r = giveOrder(game, s, o.kind)
    if (!r.ok) return
    const legs = o.kind === 'aheadFull' ? [{ fwd: checkMove(game, s, []).max }] : legsOf(o.plan)   // All Ahead Full: the full distance it rolled, straight on
    const c = checkMove(game, s, legs)
    moveShip(game, s, legs, c.ok && canBoardFrom(game, { ...s, pos: c.path.end, facing: c.path.facing }, e) ? { board: e.uid } : {})
  })
}
const FAN = { front: '#ffc060', side: '#6fd0ff', rear: '#c080ff' }
const wedge = (p, a0, a1, r) => { const a = along(p, a0, r), b = along(p, a1, r); return `M${p.x},${p.y} L${a.x},${a.y} A${r},${r} 0 0 1 ${b.x},${b.y} Z` }
/** An arrow at the sunward table edge: where the ship's three speeds come from. */
function sunArrowSvg (sunDir) {
  const C = { x: 90, y: 60 }, E = along(C, sunDir, sunDir % 180 === 0 ? 90 : 60), tail = along(E, sunDir + 180, 14), tip = along(E, sunDir + 180, 2.5)
  const l = along(tip, sunDir + 150, 3.5), r = along(tip, sunDir - 150, 3.5), t = along(E, sunDir + 180, 17.5)
  return `<g style="pointer-events:none" opacity="0.85"><line x1="${tail.x}" y1="${tail.y}" x2="${tip.x}" y2="${tip.y}" stroke="#ffd060" stroke-width="0.9"/><polygon points="${tip.x},${tip.y} ${l.x},${l.y} ${r.x},${r.y}" fill="#ffd060"/>
    <text x="${t.x}" y="${t.y + 0.7}" font-size="2.2" text-anchor="middle" fill="#ffd060" stroke="#000" stroke-width="0.3" paint-order="stroke">sunward edge</text></g>`
}
/** The board drawing of a sail in hand: the three speed fans, the line, the end shadow, the numbers. */
function sailSvg (sel) {
  const m = ui.sail, o = sailNow(sel), bd = sunBands(game, sel), P = sel.pos, E = o.path.end, col = o.ok ? '#7ad07a' : '#ff7a6a'
  let h = bd.sunDir != null ? sunArrowSvg(bd.sunDir) : ''
  for (const b of bd.bands) if (b.cm > 0) for (const [lo, hi] of b.ranges) {
    const on = b.arc === o.arc
    h += `<path d="${wedge(P, lo, hi, b.cm)}" fill="${FAN[b.arc]}" fill-opacity="${on ? 0.13 : 0.045}" stroke="${FAN[b.arc]}" stroke-opacity="${on ? 0.6 : 0.25}" stroke-width="0.15" stroke-dasharray="${on ? '' : '1 0.8'}" style="pointer-events:none"/>`
    const q = along(P, (lo + hi) / 2, b.cm * 0.72)
    h += `<text x="${q.x}" y="${q.y}" font-size="1.7" text-anchor="middle" fill="${FAN[b.arc]}" fill-opacity="${on ? 1 : 0.6}" stroke="#000" stroke-width="0.25" paint-order="stroke" style="pointer-events:none">${b.arc} ${b.cm}</text>`
  }
  const far = along(P, m.heading, o.max)
  h += `<line x1="${P.x}" y1="${P.y}" x2="${far.x}" y2="${far.y}" stroke="${col}" stroke-opacity="0.3" stroke-width="0.2" stroke-dasharray="1.2 0.8" style="pointer-events:none"/>`
  h += `<line x1="${P.x}" y1="${P.y}" x2="${E.x}" y2="${E.y}" stroke="${col}" stroke-width="0.35" style="pointer-events:none"/>`
  h += ghostSvg(sel, E, m.heading, o.ok)
  const lab = along(E, m.heading + 90, baseR(sel) + 20), turn = Math.round(o.turn)
  const lines = [`${round1(m.dist)} cm of ${round1(o.max)} · turn ${Math.abs(turn)}°${turn > 0 ? ' to starboard' : turn < 0 ? ' to port' : ''}`,
    `${o.arc} band${o.arcs.length > 1 ? ' (on the line between two arcs)' : ''}: ${o.printed} cm${o.penalties.length ? ` less ${o.penalties.map(p => `${p.cm} ${p.why}`).join(', ')} = ${o.base}` : ''}${o.slowed ? ', 5 less for Blast Markers' : ''}`,
    `printed ${speedsText(bd)} · sunward ${bd.edge ?? 'edge not rolled'}`,
    !o.ok ? o.reasons[0] : lockedOnSail(sel) ? 'Lock On: it cannot turn · ' + (m.fixed ? 'fixed' : 'click: fix') + ' · right click: go' : m.fixed ? 'fixed · click: free it · right click: go' : 'click: fix · right click: go']
  h += `<g style="pointer-events:none"><rect x="${lab.x - 25}" y="${lab.y - 2.4}" width="50" height="${lines.length * 2.6 + 1.4}" rx="0.6" fill="#0b0d13" fill-opacity="0.88" stroke="${col}" stroke-width="0.2"/>` +
    lines.map((t, i) => `<text x="${lab.x}" y="${lab.y + 0.6 + i * 2.6}" font-size="${i ? 1.8 : 2.3}" text-anchor="middle" fill="${i === 3 && !o.ok ? '#ffc8c0' : i ? '#cfe3d0' : '#dfffd8'}" ${i ? '' : 'font-weight="600"'}>${t}</text>`).join('') + '</g>'
  return h
}
/** The pips while a sail is in hand: swap the speed if the sunward edge is on a line between two arcs, Board, gravity turn. */
function sailPips (s) {
  const m = ui.sail, o = sailNow(s), end = o.path.end, list = []
  if (o.options.length > 1) for (const op of o.options) list.push({ key: 'sailarc-' + op.arc, label: `${op.arc[0].toUpperCase() + op.arc.slice(1)} speed ${op.cm} cm`, free: true, at: along(end, m.heading + 90, baseR(s) + 3), px: { x: 0, y: op.arc === o.arc ? 0 : 28 },
    why: `The sunward edge lies exactly on the line between two arcs, so the Athanatoi player chooses which speed to use. ${op.arc} is ${op.cm} cm.`, state: op.arc === o.arc ? 'picked' : undefined,
    onPress: () => { m.arc = op.arc; fitSail(s); renderBoard(); renderPips() } })
  if (o.when === 'first') list.push(...boardChoicePips(s, end, m.heading + 180))   // the side away from the speed pips
  const w = wellTurn(game, end, m.heading)
  if (w) list.push({ key: 'g2', label: `Gravity turn ${Math.round(w.max)}°`, free: true, at: along(end, m.heading + 180, baseR(s) + 2), px: { x: 0, y: 26 }, why: `A free turn towards the ${w.planet.hulk ? 'derelict' : w.planet.moon ? 'moon' : 'planet'} at the end of the move.`, state: m.endTurn ? 'picked' : undefined, onPress: () => { m.endTurn = m.endTurn ? 0 : w.sign * Math.floor(w.max); renderBoard(); renderPips() } })
  else m.endTurn = 0
  return list
}
/** The side panel for a sailor: the sunward edge, the three speeds, and the sail in hand. */
function sailPanel (s) {
  const t = sailTurn(s), bd = sunBands(game, s)
  let h = `<h3>${t?.when === 'second' ? 'Second move, in the Ordnance Phase' : 'Sail'} — by the sun</h3><div class="stat">Sunward edge: <b>${bd.edge ?? 'rolled when the first ship sails'}</b> · speeds <b>${speedsText(bd)}</b>: the arc the sunward edge lies in after the turn. It turns to any heading, then goes straight, 0 cm up to that speed.</div>`
  if (!t) return h
  if (t.why) return h + `<div class="why">${t.why}</div>`
  if (!sailing()) return h + `<div class="btns"><button class="big" data-sailstart>Sail</button> <span class="dim">or the Move pip</span></div>`
  const o = sailNow(s), m = ui.sail
  h += `<div class="stat">Heading <b>${Math.round(norm(m.heading))}°</b> (turn ${Math.round(o.turn)}°) · ${o.arc} band <b>${o.printed} cm</b>${o.penalties.length ? ` less ${o.penalties.map(p => `${p.cm} ${p.why}`).join(', ')} = <b>${o.base} cm</b>` : ''}${o.slowed ? ', 5 cm less for Blast Markers' : ''} · it may go up to <b>${round1(o.max)} cm</b> · going <b>${round1(m.dist)} cm</b>${o.strain ? '<br><span class="bad">Superstructure Damaged: a turn over 45° rolls for 1 extra damage</span>' : ''}</div>`
  if (!o.ok) h += `<div class="why">${o.reasons.join('<br>')}</div>`
  return h + `<div class="btns"><button class="big" data-sailgo ${o.ok ? '' : 'disabled'}>Go</button> <button data-sailcancel>Cancel</button></div>`
}

// ---------------- the board ----------------
let boxes = {}
fetch('/space/pieces/boxes.json').then(r => r.ok ? r.json() : {}).then(b => { boxes = b; if (game) render() }).catch(() => {})
const tableSvgCache = new Map()
function tableHref () {
  if (setup.style === 'sprite') return `/space/tables/${setup.table}.png`
  if (!tableSvgCache.has(setup.table)) tableSvgCache.set(setup.table, svgUrl(tableSvg(setup.table, { width: 1440 })))
  return tableSvgCache.get(setup.table)
}
const shipHref = new Map()
function shipArt (id, side, layer) {
  if (DEFENCES.some(d => d.id === id)) return (SEA && seaFortPicture(id, schemeOf(side, 'freemen'))) || defenceArt(id, game.sides[side].fleet)   // planetary defences (view/defenceArt.js); at sea the sea forts
  const k = id + setup.style + (layer ?? '')
  // the Phage have no sprite PNGs: their vector drawing stands in
  if (!shipHref.has(k)) shipHref.set(k, artFor(id, setup.style === 'svg' || shipById(id)?.fleet === 'phage' ? 'svg' : 'sprite', { layer }).src)
  return shipHref.get(k)
}
// A fort's quadrant is drawn as its own quarter (view/blueprint.js fortQuadrant), centred on its base, so four quadrants never stack as four whole fortresses; the quadrant that holds the Basilica carries it
const fortHref = new Map()
function fortArt (s) {
  const basilica = basilicaHolder(game, s) === s, k = s.id + (basilica ? '+b' : '')
  if (SEA) return seaFortQuadrant(basilica, schemeOf(s.side, 'freemen'))   // at sea: a bastion of the sea star fort, with its quay
  if (!fortHref.has(k)) fortHref.set(k, artFor(s.id, 'svg', { quadrant: { basilica } }).src)
  return fortHref.get(k)
}
/** The picture and its side in cm for a ship on the table: a fort's quadrant is its own square, anything else 3 x its size. */
// the sea ships drawn SEA_GROW (4) x the space length, so the figures on deck are big enough to see (view/seaPictures.js)
const shipLen = s => 3 * sizeOf(s.profile) * (SEA && seaPicture(s) ? SEA_GROW : 1)
const pictureOf = s => s.fort ? { href: fortArt(s), len: FORT_PICTURE_CM } : { href: (SEA && seaPicture(s)) || shipArt(s.id, s.side), len: shipLen(s) }
// at sea: the ship's fleet drawing, its side's colours, its Dominion mark, whether it can teleport now, and whether it is firing
function seaPicture (s) {
  if (DEFENCES.some(d => d.id === s.id)) return null
  const fleet = game.sides[s.side].fleet
  return seaShipPicture({ fleet, id: s.id, scheme: schemeOf(s.side, fleet), mark: s.marks?.[0] ?? null, teleport: isCapital(s) && !isCrippled(s), firing: firingNow(s) })
}
function pieceAt (key, x, y, rot = 0, extra = '') {
  const c = CATALOGUE.find(p => p.key === key)
  if (setup.style === 'svg') {
    const { svg, box } = pieceSvg(c.kind, c.opts)
    return `<image href="${svgUrl(svg)}" x="${x + box.x}" y="${y + box.y}" width="${box.w}" height="${box.h}" transform="rotate(${rot} ${x} ${y})" ${extra}/>`
  }
  // the sprite: boxes.json says where the piece's centre is in the PNG and how big the PNG is (written when the piece pictures are drawn)
  const b = boxes[key] ?? (() => { const pb = partsBox(piece(c.kind, c.opts)); return { ox: pb.x, oy: pb.y, px: 1, w: pb.w, h: pb.h } })()
  return `<image class="px" href="/space/pieces/${key}.png" x="${x + b.ox}" y="${y + b.oy}" width="${b.w / b.px}" height="${b.h / b.px}" transform="rotate(${rot} ${x} ${y})" preserveDisciplineRatio="none" ${extra}/>`
}
// which way a ship faces: the front quarter of its base circle, drawn bright, the front fire arc
const frontArc = (p, facing, r, col, w = 0.55) => {
  const a = along(p, facing - 45, r), b = along(p, facing + 45, r)
  return `<path d="M${a.x},${a.y} A${r},${r} 0 0 1 ${b.x},${b.y}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" style="pointer-events:none"/>`
}
const sector = (p, facing, arc, r) => {
  const mid = facing + { front: 0, right: 90, rear: 180, left: -90 }[arc]
  const a = along(p, mid - 45, r), b = along(p, mid + 45, r)
  return `M${p.x},${p.y} L${a.x},${a.y} A${r},${r} 0 0 1 ${b.x},${b.y} Z`
}

// the Holographic and Plain blue tables
function plainTable (look) {
  if (look.id === 'plain-blue') return `<rect x="0" y="0" width="${game.table.w}" height="${game.table.h}" fill="#1c4f8c"/>`
  return `<defs><radialGradient id="holoBg" cx="50%" cy="50%" r="70%"><stop offset="0" stop-color="${look.holo[0]}"/><stop offset="1" stop-color="${look.holo[1]}"/></radialGradient>
    <pattern id="holoScan" width="1" height="1.2" patternUnits="userSpaceOnUse"><rect width="1" height="0.3" fill="${look.grid}" fill-opacity="0.05"/></pattern></defs>
    <rect x="0" y="0" width="${game.table.w}" height="${game.table.h}" fill="url(#holoBg)"/><rect x="0" y="0" width="${game.table.w}" height="${game.table.h}" fill="url(#holoScan)"/>`
}
// the grid: every 10 cm, heavier every 30 cm with its distance on the edge, to judge range by eye.
// A help for the eye only: the rules measure exactly.
function gridSvg (x0, y0, w, h, look) {
  const col = look?.grid ?? '#ffffff', minor = look?.minor ?? 0.12, major = look?.major ?? 0.28
  let s = ''
  const ln = (x1, y1, x2, y2, k) => { s += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${col}" stroke-opacity="${k ? major : minor}" stroke-width="${k ? 0.18 : 0.08}"/>` }
  for (let d = 10; d < w; d += 10) { ln(x0 + d, y0, x0 + d, y0 + h, d % 30 === 0); if (d % 30 === 0) s += `<text x="${x0 + d + 0.4}" y="${y0 + 2}" font-size="1.5" fill="${col}" fill-opacity="0.7">${d}</text>` }
  for (let d = 10; d < h; d += 10) { ln(x0, y0 + d, x0 + w, y0 + d, d % 30 === 0); if (d % 30 === 0) s += `<text x="${x0 + 0.4}" y="${y0 + d - 0.4}" font-size="1.5" fill="${col}" fill-opacity="0.7">${d}</text>` }
  return s
}
// ---------------- what a ship's state looks like on the table ----------------
// Hits left and shields are rows of icons above the ship; harmful effects are icons below it. Looks only: every number comes from the rules
// (remainingHits, shieldsLeft, s.crits); each row says it in words on hover.
const ICON = SEA ? 1.5 : 1   // sea ships are drawn 4x, so their icons a little bigger too
/** The ship's shield bubble at the drawn place P and heading F: { rx, ry, rot }, the same shape fx.js flares on a hit. */
const wardOf = (s, F) => FX.wardShape({ ...s, facing: F })
/** How far the ship reaches above and below its centre on the screen: the bubble, or the picture where that is bigger. */
function reachY (s, F, len) {
  if (s.fort) return baseR(s) + 1
  const w = wardOf(s, F), t = w.rot * Math.PI / 180
  return Math.max(baseR(s), Math.hypot(w.rx * Math.sin(t), w.ry * Math.cos(t)), SEA ? 0 : len * 0.42)
}
// Shields that are up: shieldsLeft already takes off
// one for each Blast Marker touching and all of them after Shields Collapse. Brighter the more are up.
function shieldBubbleSvg (s, P, F) {
  const n = shieldsOf(s), up = shieldsLeft(game, s)
  if (!n || !up || isHulk(s) || s.fort) return ''
  const w = wardOf(s, F), c = shieldColour(s.profile.fleet, s.side), k = 0.45 + 0.55 * up / n
  shimmers.push(shimmerSvg(s, P, w, c))   // drawn over the ships later
  return `<g class="ward" style="pointer-events:none;animation-delay:-${((s.uid * 613) % 3000 / 1000).toFixed(2)}s" transform="translate(${P.x.toFixed(2)} ${P.y.toFixed(2)}) rotate(${w.rot.toFixed(1)})">
    <ellipse rx="${w.rx.toFixed(2)}" ry="${w.ry.toFixed(2)}" fill="${c.glow}" fill-opacity="${(0.07 * k).toFixed(3)}" stroke="${c.glow}" stroke-opacity="${(0.55 * k).toFixed(2)}" stroke-width="${(0.14 * ICON).toFixed(2)}"/>
    <ellipse rx="${(w.rx * 0.97).toFixed(2)}" ry="${(w.ry * 0.94).toFixed(2)}" fill="none" stroke="${c.core}" stroke-opacity="${(0.25 * k).toFixed(2)}" stroke-width="${(0.06 * ICON).toFixed(2)}"/></g>`
}
// THE SHIMMER on a raised shield: every few
// seconds a band of light sweeps across the bubble and its rim flares, each ship at its own moment (battle.html .ward-shimmer, CSS only, so a
// redraw doesn't restart it). Drawn only while a shield is up.
let shimmers = []   // drawn over every ship once the ships are drawn (renderBoard), so the sweep crosses the hull, not under it
function shimmerSvg (s, P, w, c) {
  const id = `vwf-wsh-${s.uid}`, delay = ((s.uid * 1237) % 5000 / 1000).toFixed(2)
  return `<g style="pointer-events:none" transform="translate(${P.x.toFixed(2)} ${P.y.toFixed(2)}) rotate(${w.rot.toFixed(1)})">
    <defs><clipPath id="${id}-c"><ellipse rx="${w.rx.toFixed(2)}" ry="${w.ry.toFixed(2)}"/></clipPath>
      <linearGradient id="${id}-g" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="${c.core}" stop-opacity="0"/><stop offset="0.5" stop-color="${c.core}" stop-opacity="0.55"/><stop offset="1" stop-color="${c.core}" stop-opacity="0"/></linearGradient></defs>
    <g clip-path="url(#${id}-c)"><rect class="ward-shimmer" style="animation-delay:-${delay}s;--sweep:${(w.rx * 2.6).toFixed(2)}px" x="${(-w.rx * 1.3 - w.rx * 0.5).toFixed(2)}" y="${(-w.ry * 1.2).toFixed(2)}" width="${(w.rx * 0.5).toFixed(2)}" height="${(w.ry * 2.4).toFixed(2)}" fill="url(#${id}-g)" transform="skewX(-20)"/></g>
    <ellipse class="ward-flare" style="animation-delay:-${delay}s" rx="${w.rx.toFixed(2)}" ry="${w.ry.toFixed(2)}" fill="none" stroke="${c.core}" stroke-width="${(0.12 * ICON).toFixed(2)}"/></g>`
}
const PLATE = 'M0,-0.5 L0.42,0 L0,0.5 L-0.42,0 Z'   // a hull plate: one damage point
const HOLO = 'M0,-0.55 L0.3,-0.2 L0.3,0.45 L0,0.3 L-0.3,0.45 L-0.3,-0.2 Z'   // a ghost hull: the mirage field
const FIELDS_SHOWN = { athanatoi: { name: 'miragefield' }, thnitoi: { name: 'voidfield' } }
const CREST = 'M-0.42,-0.5 L0.42,-0.5 L0.42,0 Q0.42,0.4 0,0.58 Q-0.42,0.4 -0.42,0 Z'   // a shield
/** Hit plates and shield crests in rows centred on x, the bottom row's centre at y. Returns { svg, rows }. Also used on the card. */
function statusRows (s, x, y, k = ICON) {
  const hits = s.profile.hits, left = remainingHits(s), crip = isCrippled(s), n = shieldsOf(s), up = shieldsLeft(game, s)
  const blasts = blastTouching(game, s).length, col = shieldColour(s.profile.fleet, s.side)
  const step = 1.05 * k, rows = []
  // more than 30 (Orc hulks): ten plates, each a tenth, and the number beside
  const per = hits > 30 ? Math.ceil(hits / 10) : 1, plates = Math.ceil(hits / per), shown = Math.ceil(left / per)
  const hitTitle = `${left} of ${hits} hits left${crip ? ', crippled' : ''}${isHulk(s) ? ', a hulk' : ''}`
  for (let r = 0; r < Math.ceil(plates / 10); r++) {
    let g = ''
    const inRow = Math.min(10, plates - r * 10)
    for (let i = 0; i < inRow; i++) {
      const j = r * 10 + i, on = j < shown, px = x + (i - (inRow - 1) / 2) * step
      g += `<path d="${PLATE}" transform="translate(${px.toFixed(2)} 0) scale(${k})" fill="${on ? (crip ? '#ff5a4a' : '#8fe07f') : '#14161c'}" fill-opacity="${on ? 1 : 0.7}" stroke="${on ? '#0b0d13' : '#8a8f9c'}" stroke-width="${(on ? 0.12 : 0.08) / 1}"/>`
    }
    if (per > 1 && r === 0) g += `<text x="${(x + (inRow / 2) * step + 0.3).toFixed(2)}" y="${0.6 * k}" font-size="${1.7 * k}" fill="#dfe6d8" stroke="#000" stroke-width="0.3" paint-order="stroke">${left}</text>`
    rows.push(`<g data-tip="${hitTitle}" style="pointer-events:all">${g}</g>`)
  }
  if (n) {
    let g = ''
    for (let i = 0; i < n; i++) {
      const on = i < up, px = x + (i - (n - 1) / 2) * step * 1.05
      g += `<path d="${CREST}" transform="translate(${px.toFixed(2)} 0) scale(${k})" fill="${on ? col.glow : '#1a1d24'}" stroke="${on ? col.core : '#5a5f6a'}" stroke-width="0.1"/>`
    }
    const down = n - up
    rows.unshift(`<g data-tip="${up} of ${n} shield${n === 1 ? '' : 's'} up${down ? `, ${down} down${blasts ? ` (${Math.min(blasts, down)} from Blast Markers touching)` : ''}` : ''}. Each shield stops one hit from guns and places a Blast Marker; lances and torpedoes too, but not ramming or boarding." style="pointer-events:all">${g}</g>`)
  }
  // THE MIRAGE FIELD: one ghost-hull icon in its own row, lit while the field works, dark once
  // its generators are destroyed (the red effect icon below says so too). Every hit that would land is rolled again.
  const fd = FIELDS_SHOWN[s.profile.fleet]
  if (fd) {
    const on = !!fieldOf(s)
    const g = `<g transform="translate(${x.toFixed(2)} 0) scale(${k})"><path d="${HOLO}" fill="${on ? '#7fe6bc' : '#1a1d24'}" fill-opacity="${on ? 0.35 : 1}" stroke="${on ? '#eafff4' : '#5a5f6a'}" stroke-width="0.09"/><path d="${HOLO}" transform="translate(0.22 0.12)" fill="none" stroke="${on ? '#7fe6bc' : '#5a5f6a'}" stroke-width="0.07" stroke-dasharray="0.15 0.1"/></g>`
    rows.unshift(`<g data-tip="${on ? `${fd.name[0].toUpperCase() + fd.name.slice(1)} working. Guns firing at it shift one column right on the gunnery table; every other hit that would land (lances, torpedoes, attack craft, ramming, boarding) is rolled again: 1 gets through, 2-6 misses and a Blast Marker is placed. It does not depend on how far the ship moved.` : `${fd.name[0].toUpperCase() + fd.name.slice(1)} generators destroyed: no ${fd.name} for the rest of the battle (critical hit).`}" style="pointer-events:all">${g}</g>`)
  }
  // bottom row at y, the rest stacked above it
  const gap = 1.25 * k
  const svg = rows.map((g, i) => `<g transform="translate(0 ${(y - (rows.length - 1 - i) * gap).toFixed(2)})">${g}</g>`).join('')
  return { svg: `<g style="pointer-events:none">${svg}</g>`, rows: rows.length, height: rows.length * gap }
}
/** Where the status rows above a ship end (their top), so the action pips can stand above them. */
function statusTop (s) {
  const D = FX.drawnAt('ship:' + s.uid, s.pos.x, s.pos.y, s.facing), len = s.fort ? FORT_PICTURE_CM : shipLen(s)
  const C = s.fort ? along(D, D.f, baseR(s) + 3) : D, ry = s.fort ? 1.2 : reachY(s, D.f, len)   // as renderBoard places them
  const rows = (Math.ceil(Math.ceil(s.profile.hits / (s.profile.hits > 30 ? Math.ceil(s.profile.hits / 10) : 1)) / 10) + (shieldsOf(s) ? 1 : 0) + (FIELDS_SHOWN[s.profile.fleet] ? 1 : 0))
  return { x: C.x, y: C.y - ry - 0.9 * ICON - rows * 1.25 * ICON }
}
/** Under the ship, below its effect icons: where the order pips stand, so they never cover the Move pip above it. */
function statusBottom (s) {
  const D = FX.drawnAt('ship:' + s.uid, s.pos.x, s.pos.y, s.facing), len = s.fort ? FORT_PICTURE_CM : shipLen(s)
  const C = s.fort ? along(D, D.f, baseR(s) + 3) : D, ry = s.fort ? 1.2 : reachY(s, D.f, len)
  return { x: C.x, y: C.y + ry + 2.2 * ICON + 2.5 }
}
// The bad effects, one icon each under the ship. Every critical in
// s.crits gets one (named by critName, rules/damage.js), so a new critical is never hidden: unknown keys show a warning.
const FLAME = 'M0,-1 C0.15,-0.55 0.62,-0.3 0.62,0.2 C0.62,0.65 0.3,0.9 0,0.9 C-0.3,0.9 -0.62,0.65 -0.62,0.2 C-0.62,-0.05 -0.4,-0.2 -0.3,-0.45 C-0.2,-0.25 -0.1,-0.2 -0.05,-0.3 C0,-0.5 -0.1,-0.75 0,-1 Z'
const AMBER = '#ffb24a', RED = '#ff5a4a'
const BLAST_TIP = 'Blast Marker: debris and energy from a shield hit or an explosion. A ship it touches has one shield down for each and -1 Resolve for orders; a ship moving through loses 5 cm (one with no shields takes 1 damage on a 6); guns shift a column right; attack craft crossing it are lost on a 6. D6 are removed in each End Phase, never those touching a ship.'
const GLYPH = {
  fire: () => `<path d="${FLAME}" transform="scale(0.55)" fill="#ff5a14" stroke="#7a1a00" stroke-width="0.12"/><path d="${FLAME}" fill="#ffc83c" transform="translate(0 0.15) scale(0.3)"/>`,
  gun: c => `<rect x="-0.5" y="-0.1" width="0.8" height="0.2" fill="${c}"/><rect x="-0.55" y="-0.28" width="0.32" height="0.56" fill="${c}"/><path d="M-0.15,-0.45 L0.45,0.45" stroke="${RED}" stroke-width="0.14"/>`,
  engine: c => `<circle r="0.36" fill="none" stroke="${c}" stroke-width="0.2" stroke-dasharray="0.17 0.11"/><circle r="0.13" fill="${c}"/><path d="M-0.45,-0.45 L0.45,0.45" stroke="${RED}" stroke-width="0.12"/>`,
  bridge: c => `<path d="M-0.5,0 Q0,-0.42 0.5,0 Q0,0.42 -0.5,0 Z" fill="none" stroke="${c}" stroke-width="0.1"/><circle r="0.14" fill="${c}"/><path d="M0.05,-0.5 L-0.05,-0.1 L0.1,0.1 L-0.02,0.5" fill="none" stroke="${RED}" stroke-width="0.09"/>`,
  shield: c => `<path d="${CREST}" transform="scale(0.85)" fill="none" stroke="${c}" stroke-width="0.11"/><path d="M-0.05,-0.42 L0.1,-0.1 L-0.1,0.1 L0.05,0.45" fill="none" stroke="${RED}" stroke-width="0.1"/>`,
  bays: c => `<path d="M-0.5,0.1 L0,-0.15 L0.5,0.1 L0,0 Z" fill="${c}"/><path d="M-0.4,-0.4 L0.4,0.4" stroke="${RED}" stroke-width="0.12"/>`,
  crippled: () => `<path d="${PLATE}" transform="scale(1.1)" fill="none" stroke="${RED}" stroke-width="0.11"/><path d="M-0.05,-0.5 L0.1,-0.15 L-0.12,0.08 L0.06,0.5" fill="none" stroke="${RED}" stroke-width="0.1"/>`,
  brace: c => `<circle cy="-0.32" r="0.12" fill="none" stroke="${c}" stroke-width="0.08"/><path d="M0,-0.2 L0,0.42 M-0.25,-0.05 L0.25,-0.05 M-0.38,0.15 Q-0.3,0.45 0,0.45 Q0.3,0.45 0.38,0.15" fill="none" stroke="${c}" stroke-width="0.09"/>`,
  blast: () => `<path d="M0,-0.5 L0.12,-0.18 L0.45,-0.25 L0.22,0 L0.45,0.25 L0.12,0.18 L0,0.5 L-0.12,0.18 L-0.45,0.25 L-0.22,0 L-0.45,-0.25 L-0.12,-0.18 Z" fill="#ff8a28" stroke="#ffd060" stroke-width="0.06"/>`,
  chain: c => `<ellipse cx="-0.2" rx="0.22" ry="0.13" transform="rotate(-30 -0.2 0)" fill="none" stroke="${c}" stroke-width="0.09"/><ellipse cx="0.22" rx="0.22" ry="0.13" transform="rotate(-30 0.22 0)" fill="none" stroke="${c}" stroke-width="0.09"/><path d="M-0.02,-0.4 L0.02,0.4" stroke="${RED}" stroke-width="0.08"/>`,
  warn: c => `<path d="M0,-0.45 L0.45,0.38 L-0.45,0.38 Z" fill="none" stroke="${c}" stroke-width="0.09"/><path d="M0,-0.15 L0,0.12" stroke="${c}" stroke-width="0.09"/><circle cy="0.25" r="0.05" fill="${c}"/>`,
}
// which drawing each critical's key gets (keys from every fleet's table in rules/damage.js)
const CRIT_GLYPH = {
  dorsal: 'gun', starboard: 'gun', port: 'gun', prow: 'gun', prowMain: 'gun', keel: 'gun', lances: 'gun', main: 'gun', batteries: 'gun', weaponsAll: 'gun', flowAll: 'gun', flowArcs: 'gun', flowPort: 'gun', flowStarboard: 'gun',
  engine: 'engine', thrusters: 'engine', driveFixed: 'engine', driveSlow: 'engine', fins: 'engine', manoeuvre: 'engine', mastLines: 'engine', mainsailScarred: 'engine', mainsailShredded: 'engine', superstructure: 'engine', nullmass: 'engine', orbit: 'engine',
  bridge: 'bridge', commanders: 'bridge', infinity: 'bridge', infinitySmashed: 'bridge', superOrders: 'bridge',
  shields: 'shield', miragefield: 'shield', voidfield: 'shield', reactors: 'shield', core: 'shield', surge: 'shield',
  bays: 'bays', fire: 'fire',
}
function effectList (s) {
  const out = []
  if (isCrippled(s)) out.push({ g: 'crippled', t: 'Crippled: half its hits gone — speed, turns and firepower cut' })
  for (const [k, v] of Object.entries(s.crits)) {
    if (!v) continue
    if (k === 'fire') { for (let i = 0; i < Math.min(v, 6); i++) out.push({ g: 'fire', t: `${v} fire${v > 1 ? 's' : ''} burning: each one not put out does 1 damage in the End Phase`, n: i === 5 && v > 6 ? v : 0 }); continue }
    out.push({ g: CRIT_GLYPH[k] ?? 'warn', t: `${critName(k)}${v > 1 ? ' ×' + v : ''} (critical hit)` })
  }
  if (isBraced(s)) out.push({ g: 'brace', t: 'Braced For Impact: saves damage on 4+, but its firepower and speed are halved' })
  const b = blastTouching(game, s).length
  if (b) out.push({ g: 'blast', t: `${b} Blast Marker${b > 1 ? 's' : ''} touching: shields down by that many, Resolve -1 for Command checks` })
  const q = squadronOf(game, s)
  if (q && mates(game, s).length > 1 && mates(game, s).every(m => m === s || dist(m.pos, s.pos) > 15)) out.push({ g: 'chain', t: 'Out of formation: more than 15 cm from the squadron' })
  return out
}
function effectIconsSvg (s, x, y, k = ICON) {
  const list = effectList(s)
  if (!list.length) return ''
  const step = 1.55 * k
  let h = '<g style="pointer-events:all">'
  list.forEach((e, i) => {
    const px = x + (i - (list.length - 1) / 2) * step
    h += `<g transform="translate(${px.toFixed(2)} ${y.toFixed(2)}) scale(${k})"${e.g === 'fire' ? ` class="flame" style="animation-delay:${(i * 0.17).toFixed(2)}s"` : ''} data-tip="${e.t.replace(/"/g, '&quot;')}"><rect x="-0.68" y="-0.68" width="1.36" height="1.36" rx="0.25" fill="#0b0d13" fill-opacity="0.82" stroke="${e.g === 'crippled' ? RED : '#5a4a30'}" stroke-width="0.07"/>${GLYPH[e.g](AMBER)}</g>`
    if (e.n) h += `<text x="${(px + 0.9 * k).toFixed(2)}" y="${(y + 0.6 * k).toFixed(2)}" font-size="${1.7 * k}" fill="#ffc83c" stroke="#000" stroke-width="0.3" paint-order="stroke">×${e.n}</text>`
  })
  return h + '</g>'
}
function renderBoard () {
  const svg = $('board')
  const look = lookOf()
  let h = SEA ? seaTableSvg(game.table.w, game.table.h) + seaMaskSvg(game.terrain, game.table.w, game.table.h) : look ? plainTable(look) : `<image href="${tableHref()}" x="0" y="0" width="180" height="120" preserveDisciplineRatio="none" class="${setup.style === 'sprite' ? 'px' : ''}"/>`
  $('boardwrap').style.background = $('battle').style.background = SEA ? '#05263b' : look?.around ?? '#000'
  h += `<rect x="0" y="0" width="${game.table.w}" height="${game.table.h}" fill="none" stroke="${look?.holo ? look.grid : '#c9a24a55'}" stroke-width="0.3"/>`
  if (ui.grid) h += gridSvg(0, 0, game.table.w, game.table.h, SEA ? SEA_GRID : look)
  if (game.phase === 'setup' && !game.sc) {
    for (const side of [0, 1]) {
      const z = zoneOf(game, game.zones[side])
      h += `<rect x="0" y="${z.y0}" width="${game.table.w}" height="${z.y1 - z.y0}" fill="${SIDE_COLOUR[side]}" opacity="${game.placing === side ? 0.18 : 0.07}"/>`
      h += `<text x="2" y="${z.y0 + 4}" font-size="3" fill="${SIDE_COLOUR[side]}">${game.sides[side].name} set-up zone ${game.zones[side]}</text>`
    }
  }
  h += terrainSvg()
  const stat = h
  h = (SEA ? WAKE_DEFS : '') + scenarioMarksSvg()
  // Blast Markers and ordnance
  // each Blast Marker: its picture, and over it the same starburst icon the ships carry for markers touching them, with hover help
  //
  for (const m of game.blast) h += pieceAt(`blast-${(m.id % 3) + 1}`, m.x, m.y)   // the icons go over the ships, below
  for (const o0 of game.ordnance) {
    const D = FX.drawnAt('ord:' + o0.id, o0.pos.x, o0.pos.y, o0.facing), o = { ...o0, pos: { x: D.x, y: D.y } }
    if (o.kind === 'wave') { h += waveSvg(o); continue }
    if (o.kind === 'mine') { h += `<image href="${MINE_ART}" x="${o.pos.x - 1.4}" y="${o.pos.y - 1.4}" width="2.8" height="2.8" data-ord="${o.id}" style="cursor:pointer"/><circle cx="${o.pos.x}" cy="${o.pos.y}" r="${o.r + 0.3}" fill="none" stroke="${SIDE_COLOUR[o.side]}" stroke-width="0.15"/>`; continue }
    const tf = o.fleet ?? game.sides[o.side]?.fleet, seaT = SEA && (o.boarding ? seaCraftPicture({ fleet: tf, kind: 'boarding torpedo', scheme: schemeOf(o.side, tf) }) : null || seaTorpedoPicture(tf, schemeOf(o.side, tf)))   // the sea torpedo salvo (a Dominion boarding torpedo has its own)
    h += seaT ? `<image href="${seaT}" x="${o.pos.x - 1.8}" y="${o.pos.y - 1.8}" width="3.6" height="3.6" transform="rotate(${o.facing + 90} ${o.pos.x} ${o.pos.y})" data-ord="${o.id}" style="cursor:pointer"/>` : pieceAt('torpedoes', o.pos.x, o.pos.y, o.facing + 90, `data-ord="${o.id}" style="cursor:pointer"`)
    h += `<text x="${o.pos.x + 1.6}" y="${o.pos.y - 1}" font-size="2.2" fill="${SIDE_COLOUR[o.side]}" stroke="#000" stroke-width="0.25" paint-order="stroke">${o.str}</text>`
  }
  const sel = selectedShip()
  // overlays under the ships: weapon arcs in the Fire Phase, the move plan in the Manoeuvre Phase
  if (sel && sel.state === 'active' && game.phase === 'shooting' && mine(sel) && !sel.fired) {
    sel.profile.weapons.forEach((w, i) => {
      if (!(isGun(w) || w.kind === 'sunburst' || isTube(w))) return
      const col = isLance(w) ? '#6fd0ff' : w.kind === 'battery' || w.kind === 'bombardment' ? '#ffc060' : '#c080ff'   // a starlance counts as a lance
      for (const arc of weaponArcs(w)) h += `<path d="${sector(sel.pos, sel.facing, arc, isTube(w) ? w.range : w.range)}" fill="${col}" opacity="${ui.hoverWeapon === i || ui.gun === `${sel.uid}:${i}` ? 0.2 : ui.gun ? 0.02 : 0.05}" stroke="${col}" stroke-opacity="0.35" stroke-width="0.15"/>`
    })
    for (const [k, t] of Object.entries(ui.shots)) {
      const [uid, i] = k.split(':').map(Number), x = shipByUid(game, uid), tgt = t != null && typeof t === 'number' && shipByUid(game, t)
      if (tgt && x) h += `<line x1="${x.pos.x}" y1="${x.pos.y}" x2="${tgt.pos.x}" y2="${tgt.pos.y}" stroke="${isLance(x.profile.weapons[i]) ? '#6fd0ff' : '#ffc060'}" stroke-width="0.25" stroke-dasharray="1 0.6"/>`
    }
    const tw = sel.profile.weapons[ui.torpAim ?? -1] ?? sel.profile.weapons.find(w => isTube(w))
    if (tw && sel.loaded.torpedo && (ui.torpAim != null || ui.torp)) { const end = along(sel.pos, sel.facing + ui.torp, tw.range); h += `<line x1="${sel.pos.x}" y1="${sel.pos.y}" x2="${end.x}" y2="${end.y}" stroke="#c080ff" stroke-width="0.3" stroke-dasharray="0.8 0.5"/>` }
  }
  if (sel && sel.state === 'active' && game.phase === 'movement' && mine(sel) && !sel.movedThisPhase && ui.plan && (ui.move || ui.planEdited)) {
    const c = checkMove(game, sel, legsOf(ui.plan))
    const pts = [sel.pos, ...c.path.segs.map(s => s.b)]
    h += `<polyline points="${pts.map(p => `${p.x},${p.y}`).join(' ')}" fill="none" stroke="${c.ok ? '#7ad07a' : '#ff7a6a'}" stroke-width="0.35"/>`
    // where it will end up: the same shadow as placing it, a filled circle with the ship faint in it
    h += ghostSvg(sel, c.path.end, c.path.facing, c.ok)
    // the minimum move and the turning point
    const minP = along(sel.pos, sel.facing, c.min), turnP = along(sel.pos, sel.facing, turnDistance(sel))
    h += `<circle cx="${minP.x}" cy="${minP.y}" r="0.5" fill="#ffffff" opacity="0.6"/>`
    if (turnDistance(sel)) h += `<circle cx="${turnP.x}" cy="${turnP.y}" r="0.45" fill="#ffd060" opacity="0.8"/>`
    // how far: the least and most it may move as faint
    // rings, each leg's length on it, and the whole distance in a tag at the end
    h += `<circle cx="${sel.pos.x}" cy="${sel.pos.y}" r="${c.max}" fill="none" stroke="#7ad07a" stroke-opacity="0.25" stroke-width="0.2" stroke-dasharray="1.2 0.8"/>`
    if (c.min > 0.5) h += `<circle cx="${sel.pos.x}" cy="${sel.pos.y}" r="${c.min}" fill="none" stroke="#ffffff" stroke-opacity="0.18" stroke-width="0.15" stroke-dasharray="0.5 0.8"/>`
    if (c.path.segs.length > 1) for (const sg of c.path.segs) if (sg.len > 3) { const m = lerp2(sg.a, sg.b); h += `<text x="${m.x}" y="${m.y - 0.8}" font-size="1.8" text-anchor="middle" fill="#dfffd8" stroke="#000" stroke-width="0.3" paint-order="stroke">${round1(sg.len)}</text>` }
    const lab = along(c.path.end, c.path.facing + 90, baseR(sel) + 9.5)   // beside the ship, clear of the path and its pip
    h += `<g><rect x="${lab.x - 7.5}" y="${lab.y - 2.2}" width="15" height="3.6" rx="0.6" fill="#0b0d13" fill-opacity="0.85" stroke="${c.ok ? '#7ad07a' : '#ff7a6a'}" stroke-width="0.2"/><text x="${lab.x}" y="${lab.y + 0.6}" font-size="2.3" text-anchor="middle" fill="${c.ok ? '#dfffd8' : '#ffd0c8'}" font-weight="600">${round1(c.path.total)} cm of ${round1(c.max)}</text></g>`
    if (ui.move) { const say = c.ok ? moveHint(sel, c) : c.reasons[0]; h += `<text x="${lab.x}" y="${lab.y + 3.8}" font-size="1.9" text-anchor="middle" fill="${c.ok ? '#dfffd8' : '#ffc8c0'}" stroke="#000" stroke-width="0.3" paint-order="stroke">${say}</text>` }
  }
  if (sel && sel.state === 'active' && mine(sel) && isSailor(sel) && ['movement', 'ordnance'].includes(game.phase) && sailing()) h += sailSvg(sel)   // the Athanatoi's sail in hand
  else if (sel && isSailor(sel) && game.phase !== 'setup' && sunBands(game, sel).sunDir != null) h += sunArrowSvg(sunBands(game, sel).sunDir)   // the sunward edge, whenever one of them is picked
  if (ui.hoverRam != null && sel) {   // the straight line a ram would take
    const e = shipByUid(game, ui.hoverRam), r = e && ramReach(sel, e)
    if (r) { const t = along(sel.pos, sel.facing, r.cm); h += `<line x1="${sel.pos.x}" y1="${sel.pos.y}" x2="${t.x}" y2="${t.y}" stroke="#ff9a4a" stroke-width="0.4" stroke-dasharray="1 0.6"/>` }
  }
  if (ui.sunburst && sel) for (const arc of ['front']) h += `<path d="${sector(sel.pos, sel.facing, arc, 150)}" fill="#c080ff" opacity="0.06"/>`
  // ships. IN SPACE a ship gliding over another passes under it, see-through: drawn first, at half opacity.
  const shown = game.ships.filter(s => s.pos && !['destroyed', 'disengaged', 'gone', 'landed', 'lost', 'reserve'].includes(s.state))
  const under = new Set()
  if (!SEA) for (const s of shown) {
    const D = FX.drawnAt('ship:' + s.uid, s.pos.x, s.pos.y, s.facing)
    if (Math.hypot(D.x - s.pos.x, D.y - s.pos.y) <= 0.05) continue   // not gliding
    const q = squadronOf(game, s)
    if (shown.some(o => o !== s && !(q && squadronOf(game, o) === q) && Math.hypot(D.x - drawnPos(o).x, D.y - drawnPos(o).y) < (shipLen(s) + shipLen(o)) * 0.35)) under.add(s.uid)
  }
  shimmers = []
  for (const s of [...shown.filter(x => under.has(x.uid)), ...shown.filter(x => !under.has(x.uid))]) {
    // where it is drawn: gliding to its new place, or where it is (fx.js)
    const D = FX.drawnAt('ship:' + s.uid, s.pos.x, s.pos.y, s.facing), P = { x: D.x, y: D.y }, F = D.f
    const R = baseR(s), len = s.fort ? FORT_PICTURE_CM : shipLen(s), hulk = isHulk(s)
    const ring = s.uid === ui.selected ? '#ffffff' : SIDE_COLOUR[s.side]
    h += `<g data-ship="${s.uid}" style="cursor:pointer"${under.has(s.uid) ? ' opacity="0.5"' : ''}>`
    const movingNow = Math.hypot(P.x - s.pos.x, P.y - s.pos.y) > 0.05   // still gliding to where the rules put it
    if (SEA && !s.fort) h += wakeSvg(P, F, len, s.moved ?? 0, performance.now(), movingNow)   // the water round the ship (the sea skin), parting at the bow while it moves
    h += `<circle cx="${P.x}" cy="${P.y}" r="${R}" fill="${SIDE_COLOUR[s.side]}" fill-opacity="0.12" stroke="${ring}" stroke-width="${s.uid === ui.selected ? 0.35 : 0.2}"/>`
    h += frontArc(P, F, R, s.uid === ui.selected ? '#ffd060' : SIDE_COLOUR[s.side], 0.7)   // under the picture
    h += shieldBubbleSvg(s, P, F)   // the shields that are up, as a bubble (under the picture)
    const cls = setup.style === 'sprite' ? 'px' : '', spin = `rotate(${F + 90} ${P.x} ${P.y})`, turned = isHulk(s) || s.fort || (SEA && seaPicture(s)) ? null : Guns.layersOf(s, setup.style)
    if (turned) {   // guns turning (guns.js): the hull, then each gun about its own pivot. At rest it is the one picture.
      h += `<image href="${shipArt(s.id, s.side, 'hull')}" x="${P.x - len / 2}" y="${P.y - len / 2}" width="${len}" height="${len}" class="${cls}" transform="${spin}"/>`
      for (const g of turned.guns) h += `<image href="${shipArt(s.id, s.side, g.layer)}" x="${P.x - len / 2}" y="${P.y - len / 2}" width="${len}" height="${len}" class="${cls}" transform="${spin} rotate(${g.turn} ${P.x + g.px} ${P.y + g.py})"/>`
    } else {
      const img = `<image href="${pictureOf(s).href}" x="${P.x - len / 2}" y="${P.y - len / 2}" width="${len}" height="${len}" class="${setup.style === 'sprite' && !s.fort && !SEA ? 'px' : ''}" transform="rotate(${F + 90} ${P.x} ${P.y})" opacity="${hulk ? 0.55 : 1}" style="${hulk ? 'filter:grayscale(1) brightness(.7);' : ''}${s.fort ? 'pointer-events:none' : ''}"/>`
      // at sea a ship bobs on the swell, harder while it ploughs forward
      const bob = SEA && !s.fort && !hulk ? `transform-box:view-box;transform-origin:${P.x}px ${P.y}px;animation:${movingNow ? 'sea-bob-move 1.1s' : 'sea-bob 3.4s'} ease-in-out infinite;animation-delay:-${((performance.now() + s.uid * 777) % 3400 / 1000).toFixed(2)}s` : ''
      h += bob ? `<g style="${bob}">${img}</g>` : img
    }
    // hits and shields above, bad effects below; the name, order and the rest are on the card under the mouse.
    // A fort quadrant's go outward of the quadrant, clear of the others.
    const C = s.fort ? along(P, F, R + 3) : P, ry = s.fort ? 1.2 : reachY(s, F, len)
    h += statusRows(s, C.x, C.y - ry - 0.9 * ICON).svg
    h += effectIconsSvg(s, C.x, C.y + ry + 1 * ICON)
    h += '</g>'
  }
  h += shimmers.join('')
  for (const m of game.blast) h += `<g transform="translate(${m.x.toFixed(2)} ${m.y.toFixed(2)}) scale(${ICON})" style="pointer-events:all" data-tip="${BLAST_TIP}"><rect x="-0.6" y="-0.6" width="1.2" height="1.2" rx="0.25" fill="#0b0d13" fill-opacity="0.75" stroke="#ff8a28" stroke-width="0.08"/>${GLYPH.blast()}</g>`   // over the ships, so a marker by a hull can be hovered
  // the table and its phenomena change rarely: rewritten only when they do. The moving things go over them, clipped
  // to the main table; then the low orbit table below it, showing the same things moved up (lowOrbit.js)
  const statAll = stat + `<defs><clipPath id="clipMain"><rect x="-6" y="-6" width="${game.table.w + 12}" height="${game.table.h + 11}"/></clipPath><clipPath id="clipLow"><rect x="${LOW.x0 - 6}" y="${LOW.y0 - 3}" width="${LOW.w + 12}" height="${LOW.h + 8}"/></clipPath></defs>` + (game.lowOrbit ? `<g transform="translate(${LOW_DX} 0)">${lowTableSvg()}</g>` : '')
  if (statAll !== lastStatic) { $('board-static').innerHTML = statAll; lastStatic = statAll }
  $('board-dyn').innerHTML = twoTables(h)
  void svg
}
let lastStatic = ''
const twoTables = h => `<g clip-path="url(#clipMain)">${h}</g>` + (game.lowOrbit ? `<g transform="translate(${LOW_DX} ${LOW_DY})"><g clip-path="url(#clipLow)">${h}</g></g>` : '')
function lowTableSvg () {
  const y = LOW_SHOW, edge30 = LOW.y0 + LOW.h - 30 + LOW_DY
  return `<rect x="${LOW.x0}" y="${y}" width="${LOW.w}" height="${LOW.h}" fill="#05070d" stroke="#c9a24a55" stroke-width="0.3"/>
    <defs><linearGradient id="lowPlanet" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a6aa0" stop-opacity="0"/><stop offset="1" stop-color="#3a6aa0" stop-opacity="0.55"/></linearGradient></defs>
    <rect x="${LOW.x0}" y="${y + LOW.h - 8}" width="${LOW.w}" height="8" fill="url(#lowPlanet)"/>
    <line x1="${LOW.x0}" y1="${y + LOW.h}" x2="${LOW.x0 + LOW.w}" y2="${y + LOW.h}" stroke="#7ab0e0" stroke-width="0.5"/>
    ${game.sc?.id === 'assault' ? `<line x1="${LOW.x0}" y1="${edge30}" x2="${LOW.x0 + LOW.w}" y2="${edge30}" stroke="#ffd060" stroke-width="0.2" stroke-dasharray="1 0.8" opacity="0.6"/><text x="${LOW.x0 + LOW.w - 1}" y="${edge30 - 0.8}" font-size="2" text-anchor="end" fill="#ffd060">troops land below this line (30 cm)</text>` : ''}
    ${ui.grid ? gridSvg(LOW.x0, y, LOW.w, LOW.h, lookOf()) : ''}<text x="${LOW.x0 + 1}" y="${y - 0.8}" font-size="2.4" fill="#c9a24a">Low orbit: ships here are pulled ${({ small: 5, medium: 8, large: 10 })[game.lowOrbit.size]} cm towards the planet at the start of each turn</text>
    <text x="${LOW.x0 + LOW.w / 2}" y="${y + LOW.h + 2.8}" font-size="2.2" text-anchor="middle" fill="#7ab0e0">the planet's edge — off it a ship is destroyed; escorts and transports may land</text>`
}
// ---------------- the shadow of the ship being placed ----------------
// Green where the rules say it may stand, red where not, with the reason; its front marked in white. It decides nothing.
const LEGAL = '#6fbf5f', ILLEGAL = '#d05a5a'
/** Where a move will end: the same shadow as placing a ship, a filled circle with the ship faint in it. One drawing for the legs and the sail. */
function ghostSvg (sel, E, facing, ok) {
  const col = ok ? LEGAL : ILLEGAL, L = shipLen(sel)
  return `<circle cx="${E.x}" cy="${E.y}" r="${baseR(sel)}" fill="${col}" fill-opacity="0.3" stroke="${col}" stroke-width="0.3"/>${frontArc(E, facing, baseR(sel), col, 0.7)}<image href="${pictureOf(sel).href}" x="${E.x - L / 2}" y="${E.y - L / 2}" width="${L}" height="${L}" class="${setup.style === 'sprite' && !SEA ? 'px' : ''}" transform="rotate(${facing + 90} ${E.x} ${E.y})" opacity="0.55" style="pointer-events:none"/>`
}
const placing = () => game?.phase === 'setup' && (!game.sc || game.setupStep === 'place') && !setupDone() ? nextPlace() : null
function renderGhost () {
  const box = $('board-ghost'), s = placing(), g = ui.ghost
  if (!s || !g.p) { box.innerHTML = ''; return }
  const P = game.sc ? placeSpot(game, s, g.p) : g.p, why = placeWhy(s.uid, g.p), col = why ? ILLEGAL : LEGAL
  if (s.fort) {   // the whole fort: four quadrant pictures round the click, turned together (rules/fort.js placeFort)
    const rot = ui.facing ?? 0, quads = [0, 1, 2, 3].map(k => { const f = rot + [270, 0, 90, 180][k]; return { f, p: along(P, f, 3 * Math.SQRT2) } })
    let h = quads.map((q, k) => `<circle cx="${q.p.x}" cy="${q.p.y}" r="${baseR(s)}" fill="${col}" fill-opacity="0.22" stroke="${col}" stroke-width="0.3"/><image href="${k === 0 ? pictureOf(s).href : pictureOf({ ...s, uid: -1 }).href}" x="${q.p.x - FORT_PICTURE_CM / 2}" y="${q.p.y - FORT_PICTURE_CM / 2}" width="${FORT_PICTURE_CM}" height="${FORT_PICTURE_CM}" transform="rotate(${q.f + 90} ${q.p.x} ${q.p.y})" opacity="0.6" style="pointer-events:none"/>`).join('')
    const text = why ? why.replace(/^.*? must be placed /, '') : g.pinned ? 'right click to put it down' : ''
    if (text) h += `<text x="${P.x}" y="${P.y + 12}" font-size="2.1" text-anchor="middle" fill="${why ? '#ffc8c0' : '#dfffd8'}" stroke="#000" stroke-width="0.35" paint-order="stroke">${text.length > 70 ? text.slice(0, 68) + '…' : text}</text>`
    box.innerHTML = h; box.style.pointerEvents = 'none'; return
  }
  const F = shownFacing(s, P), R = baseR(s), len = shipLen(s)
  const art = s.profile.role === 'mine' || s.profile.role === 'minefield' ? '' : `<image href="${pictureOf(s).href}" x="${P.x - len / 2}" y="${P.y - len / 2}" width="${len}" height="${len}" class="${setup.style === 'sprite' && !SEA ? 'px' : ''}" transform="rotate(${F + 90} ${P.x} ${P.y})" opacity="0.7" style="pointer-events:none"/>`
  let h = `<circle cx="${P.x}" cy="${P.y}" r="${R}" fill="${col}" fill-opacity="0.22" stroke="${col}" stroke-width="0.3"/>${frontArc(P, F, R, col, 0.7)}${art}`
  if (g.pinned) h += `<circle cx="${P.x}" cy="${P.y}" r="${R + 0.7}" fill="none" stroke="#f0d060" stroke-width="0.2" stroke-dasharray="0.8 0.5"/>`
  const text = why ? why.replace(/^.*? must be placed /, '') : g.pinned ? 'right click to put it down' : ''
  if (text) h += `<text x="${P.x}" y="${P.y + R + 3}" font-size="2.1" text-anchor="middle" fill="${why ? '#ffc8c0' : '#dfffd8'}" stroke="#000" stroke-width="0.35" paint-order="stroke">${text.length > 70 ? text.slice(0, 68) + '…' : text}</text>`
  box.innerHTML = P.y >= 900 ? `<g transform="translate(${LOW_DX} ${LOW_DY})">${h}</g>` : h
  box.style.pointerEvents = 'none'
}
/** Put the shadow's ship down. Refused, it follows the mouse again and the log says why. */
function commitPlacing (at) {
  const s = placing(), P = ui.ghost.p ?? at
  if (!s || !P) return
  const uid = s.uid, side = s.side, sq = squadronOf(game, s)
  act(() => {
    const r = placeAt(uid, P)
    if (!r.ok) { game.log.push({ text: r.reason }); ui.ghost.pinned = false; return }
    ui.ghost.pinned = false
    // the next ship starts as this one faced if it is the same squadron, else as the rules default
    const n = placing()
    if (!n || n.side !== side || !sq || squadronOf(game, n) !== sq) ui.facing = null
  })
}
function turnPlacing (deg) {
  const s = placing()
  if (!s) return
  const lock = facingLock(s)
  if (lock) { game.log.push({ text: `${s.name} can't be turned: ${lock}` }); ui.logMark = game.log.length - 1; return renderLog() }
  ui.facing = (((s.fort ? ui.facing ?? 0 : ui.ghost.p ? shownFacing(s, ui.ghost.p) : ui.facing ?? 0) + deg) % 360 + 360) % 360
  renderGhost()
}

// the scenario's own pieces: Contact markers, division markers, the convoy's entry point, edges a waiting ship may enter by
function scenarioMarksSvg () {
  if (!game.sc) return ''
  let h = ''
  for (const c of game.contacts ?? []) if (c.pos && !c.done) h += `<g><circle cx="${c.pos.x}" cy="${c.pos.y}" r="2" fill="#2a1010" stroke="${SIDE_COLOUR[game.attacker]}" stroke-width="0.3"/><text x="${c.pos.x}" y="${c.pos.y + 0.9}" font-size="2.4" text-anchor="middle" fill="${SIDE_COLOUR[game.attacker]}">?</text><circle cx="${c.pos.x}" cy="${c.pos.y}" r="30" fill="none" stroke="${SIDE_COLOUR[game.attacker]}" stroke-opacity="0.18" stroke-width="0.15" stroke-dasharray="1 1"/></g>`
  for (const m of game.markers ?? []) if (m.pos && !m.arrived) h += `<g><rect x="${m.pos.x - 2}" y="${m.pos.y - 2}" width="4" height="4" fill="#111" stroke="${SIDE_COLOUR[m.side]}" stroke-width="0.3"/><text x="${m.pos.x}" y="${m.pos.y + 0.9}" font-size="2.4" text-anchor="middle" fill="${SIDE_COLOUR[m.side]}">${m.div}</text></g>`
  if (game.convoyEntry) { const x = game.convoyEntry.edge === 'left' ? 0 : 180; h += `<line x1="${x}" y1="${game.convoyEntry.y - 10}" x2="${x}" y2="${game.convoyEntry.y + 10}" stroke="${SIDE_COLOUR[game.defender]}" stroke-width="0.8"/>` }
  if (game.setupStep === 'entry') { const x = game.convoyEdge === 'left' ? 0 : 180; h += `<line x1="${x}" y1="45" x2="${x}" y2="75" stroke="${SIDE_COLOUR[game.defender]}" stroke-width="0.5" stroke-dasharray="1 0.6"/>` }
  if (game.sc.id === 'blockade' && game.phase === 'setup') for (const y of [40, 80]) h += `<line x1="0" y1="${y}" x2="180" y2="${y}" stroke="#ffffff" stroke-opacity="0.25" stroke-width="0.2" stroke-dasharray="2 1"/>`
  if (ui.entering != null) {
    const s = shipByUid(game, ui.entering), e = s && entryFor(game, s)
    for (const sg of e?.segs ?? []) h += `<line x1="${sg.a.x}" y1="${sg.a.y}" x2="${sg.b.x}" y2="${sg.b.y}" stroke="#7ad07a" stroke-width="1"/>`
  }
  return h
}

// a wave of attack craft: its squadrons as the ordnance pictures, 2 cm each, in a block
function waveSvg (w) {
  const n = w.markers.length, cols = Math.ceil(Math.sqrt(n))
  let h = `<g data-wave="${w.id}" style="cursor:pointer"><circle cx="${w.pos.x}" cy="${w.pos.y}" r="${w.r}" fill="${SIDE_COLOUR[w.side]}" fill-opacity="0.12" stroke="${ui.wave === w.id ? '#fff' : SIDE_COLOUR[w.side]}" stroke-width="${ui.wave === w.id ? 0.3 : 0.15}" stroke-dasharray="0.5 0.3"/>`
  // on combat air patrol: the craft fly round the ship they guard,
  // spread on a ring, noses along it. The SMIL turn runs on the page's own clock, so a redraw does not restart it.
  const guard = w.cap != null && shipByUid(game, w.cap)
  if (guard?.pos) {
    const c = drawnPos(guard), R = craftR(guard), pics = craftPics(w.fleet, w.side, w.markers), dur = Math.max(6, R * 0.9).toFixed(1)
    h += `<circle cx="${c.x}" cy="${c.y}" r="${R}" fill="none" stroke="${SIDE_COLOUR[w.side]}" stroke-opacity="0.35" stroke-width="0.12" stroke-dasharray="0.4 0.8"/><g>`
    pics.forEach((p, i) => {
      const a = i / pics.length * 360, x = c.x + R * Math.cos(a * Math.PI / 180), y = c.y + R * Math.sin(a * Math.PI / 180)
      h += `<image href="${p.href}" x="${x - p.size / 2}" y="${y - p.size / 2}" width="${p.size}" height="${p.size}" transform="rotate(${a + 180} ${x} ${y})" class="${!SEA && setup.style === 'sprite' ? 'px' : ''}"/>`   // the picture points up: +90 to face along the ring, +90 more as it turns clockwise
    })
    return h + `<animateTransform attributeName="transform" type="rotate" from="0 ${c.x} ${c.y}" to="360 ${c.x} ${c.y}" dur="${dur}s" repeatCount="indefinite"/></g></g>`
  }
  // waiting: the squadrons circle slowly round the marker, as the patrol ring does, but small and on the marker itself
  if (!(ui.wave === w.id && game.phase === 'ordnance' && !w.moved)) {
    const c = FX.drawnAt('ord:' + w.id, w.pos.x, w.pos.y), pics = craftPics(w.fleet, w.side, w.markers), R = Math.max(1.1, w.r * 0.7)
    h += '<g>'
    pics.forEach((p, i) => {
      const a = i / pics.length * 360, x = c.x + R * Math.cos(a * Math.PI / 180), y = c.y + R * Math.sin(a * Math.PI / 180)
      h += `<image href="${p.href}" x="${x - p.size / 2}" y="${y - p.size / 2}" width="${p.size}" height="${p.size}" transform="rotate(${a + 180} ${x} ${y})" class="${!SEA && setup.style === 'sprite' ? 'px' : ''}"/>`
    })
    return h + `<animateTransform attributeName="transform" type="rotate" from="0 ${c.x} ${c.y}" to="360 ${c.x} ${c.y}" dur="${(8 + w.id % 4).toFixed(0)}s" repeatCount="indefinite"/></g></g>`
  }
  w.markers.forEach((t, i) => {
    const o = rowOf(w.fleet, t)   // data/craft.js: the row's id is the drawn craft's id
    const x = w.pos.x + ((i % cols) - (cols - 1) / 2) * 1.6, y = w.pos.y + (Math.floor(i / cols) - (Math.ceil(n / cols) - 1) / 2) * 1.6
    const sea = SEA && seaCraftPicture({ fleet: w.fleet, id: o.id, kind: o.kind, scheme: schemeOf(w.side, w.fleet) })   // the sea craft: gyrocopters, griffins, scrap kites, dragons
    h += sea ? `<image href="${sea}" x="${x - 1.3}" y="${y - 1.3}" width="2.6" height="2.6"/>` : `<image href="${shipArt(o.id)}" x="${x - 0.9}" y="${y - 0.9}" width="1.8" height="1.8" class="${setup.style === 'sprite' ? 'px' : ''}"/>`
  })
  if (ui.wave === w.id && game.phase === 'ordnance' && !w.moved) h += `<circle cx="${w.pos.x}" cy="${w.pos.y}" r="${waveSpeed(w)}" fill="none" stroke="#fff" stroke-opacity="0.4" stroke-width="0.15" stroke-dasharray="1 0.6"/>`
  return h + '</g>'
}

// ---------------- celestial phenomena: the board art, stretched to the rolled sizes ----------------
const planetType = t => PLANET_TYPES[(t.id * 7 + game.seed) % PLANET_TYPES.length]
function pieceStretched (kind, opts, x, y, w, h, rot, key) {
  // SVG: drawn at the exact size; sprite: the nearest catalogue picture, stretched to it
  if (setup.style === 'svg') {
    const { svg, box } = pieceSvg(kind, opts)
    return `<image href="${svgUrl(svg)}" x="${x + box.x}" y="${y + box.y}" width="${box.w}" height="${box.h}" transform="rotate(${rot} ${x} ${y})"/>`
  }
  const c = CATALOGUE.find(p => p.key === key), b = boxes[key]
  if (!c || !b) return ''
  const pb = partsBox(piece(c.kind, c.opts))
  const sx = w / (c.opts.w ?? c.opts.l ?? c.opts.d), sy = h / (c.opts.h ?? c.opts.w ?? c.opts.d)
  const kx = c.kind === 'cloud' || c.kind === 'rift' ? w / c.opts.l : sx, ky = c.kind === 'cloud' || c.kind === 'rift' ? h / c.opts.w : sy
  return `<image class="px" href="/space/pieces/${key}.png" x="${b.ox}" y="${b.oy}" width="${b.w / b.px}" height="${b.h / b.px}" preserveDisciplineRatio="none" transform="translate(${x} ${y}) rotate(${rot}) scale(${kx} ${ky})"/>`
}
const nearest = (list, v) => list.reduce((a, b) => Math.abs(b - v) < Math.abs(a - v) ? b : a)
function terrainSvg () {
  let h = ''
  const theme = TABLES.find(t => t.id === setup.table)?.planet
  for (const t of game.terrain ?? []) {
    const sh = t.shape
    if (t.kind === 'island') { h += islandSvg(t); continue }   // the sea skin: the beach is the rules' edge (view/seaArt.js)
    if (t.kind === 'planet') {
      const well = sh.r + WELL[t.moon ? 'small' : t.size]
      h += `<circle cx="${sh.x}" cy="${sh.y}" r="${well}" fill="none" stroke="#9ad0ff" stroke-opacity="0.35" stroke-width="0.2" stroke-dasharray="1 0.8"/>`
      const d = sh.r * 2, size = t.moon ? 'moon' : t.size
      if (setup.style === 'svg') {
        const kind = theme ?? (t.moon ? 'moon' : 'planet')
        const { svg, box } = pieceSvg(kind, kind === 'planet' ? { d, type: planetType(t) } : { d, seed: t.id })
        h += `<image href="${svgUrl(svg)}" x="${sh.x + box.x}" y="${sh.y + box.y}" width="${box.w}" height="${box.h}"/>`
      } else {
        const key = theme ? (t.moon ? `${theme}-moon-${(t.id % 2) + 1}` : `${theme}-${size}`) : (t.moon ? `moon-${(t.id % 3) + 1}` : `planet-${planetType(t)}-${size}`)
        const c = CATALOGUE.find(p => p.key === key), b = boxes[key], k = c ? d / c.opts.d : 1
        if (b) h += `<image class="px" href="/space/pieces/${key}.png" x="${b.ox}" y="${b.oy}" width="${b.w / b.px}" height="${b.h / b.px}" preserveDisciplineRatio="none" transform="translate(${sh.x} ${sh.y}) scale(${k})"/>`
      }
    } else if (sh.t === 'ring') {
      const r = (sh.r0 + sh.r1) / 2, w = sh.r1 - sh.r0
      h += `<circle cx="${sh.x}" cy="${sh.y}" r="${r}" fill="none" stroke="${t.kind === 'cloud' ? '#b8a080' : '#6a5a4a'}" stroke-opacity="${t.kind === 'cloud' ? 0.35 : 0.6}" stroke-width="${w}" ${t.kind === 'asteroids' ? `stroke-dasharray="0.6 0.5"` : ''}/>`
    } else if (t.kind === 'asteroids' && t.minefield) {   // a minefield: drawn as its owner's dotted area
      const col = SIDE_COLOUR[t.minefield.side]
      h += `<ellipse cx="${sh.x}" cy="${sh.y}" rx="${sh.rx}" ry="${sh.ry}" fill="${col}" fill-opacity="0.08" stroke="${col}" stroke-width="0.3" stroke-dasharray="0.8 0.6"/>`
      for (let i = 0; i < 12; i++) { const a = i * 2.4, rr = Math.sqrt((i + 0.5) / 12); h += `<circle cx="${sh.x + Math.cos(a) * rr * sh.rx * 0.9}" cy="${sh.y + Math.sin(a) * rr * sh.ry * 0.9}" r="0.35" fill="#ff6060"/>` }
      h += `<text x="${sh.x}" y="${sh.y - sh.ry - 0.8}" font-size="2" text-anchor="middle" fill="${col}">minefield</text>`
    } else if (t.kind === 'asteroids') {
      const [w, hh] = t.size, big = Math.max(w, hh), small = Math.min(w, hh)
      const key = `asteroids-${big}x${small}-${(t.id % 2) + 1}`
      const has = CATALOGUE.some(p => p.key === key) ? key : `asteroids-${nearest([5, 10, 15], big)}x${nearest([5, 10, 15], small)}-1`
      h += pieceStretched('asteroids', { w, h: hh, seed: t.id }, sh.x, sh.y, w, hh, sh.rot, CATALOGUE.some(p => p.key === has) ? has : 'asteroids-10x10-1')
    } else if (t.kind === 'cloud') {
      const [l, w] = t.size
      const key = `cloud-dust-${nearest([4, 6, 8, 12], w)}x${nearest([15, 20, 30, 25], l)}`
      h += pieceStretched('cloud', { w, l, seed: t.id }, sh.x, sh.y, l, w, sh.rot, CATALOGUE.some(p => p.key === key) ? key : 'cloud-dust-6x20')
    } else if (t.kind === 'rift') {
      const [l, w] = t.size
      h += pieceStretched('rift', { w, l, seed: t.id }, sh.x, sh.y, l, w, sh.rot, `rift-${nearest([5, 10, 15], w)}x${nearest([10, 20, 30], l)}`)
    }
    // the exact edge the rules use, as a thin dashed line (a phenomenon acts when it touches a base)
    const col = { cloud: '#e8d0a0', asteroids: '#d0b090', rift: '#e080ff', planet: '#9ad0ff' }[t.kind]
    if (sh.t === 'ell') h += `<ellipse cx="${sh.x}" cy="${sh.y}" rx="${sh.rx}" ry="${sh.ry}" transform="rotate(${sh.rot} ${sh.x} ${sh.y})" fill="none" stroke="${col}" stroke-opacity="0.6" stroke-width="0.18" stroke-dasharray="0.7 0.5"/>`
    else if (sh.t === 'ring') for (const r of [sh.r0, sh.r1]) h += `<circle cx="${sh.x}" cy="${sh.y}" r="${r}" fill="none" stroke="${col}" stroke-opacity="0.6" stroke-width="0.18" stroke-dasharray="0.7 0.5"/>`
    else h += `<circle cx="${sh.x}" cy="${sh.y}" r="${sh.r}" fill="none" stroke="${col}" stroke-opacity="0.5" stroke-width="0.15"/>`
  }
  return h
}

// ---------------- the side panel ----------------
function shipCard (s, why) {
  const p = s.profile, crits = Object.entries(s.crits).filter(([, v]) => v).map(([k, v]) => `${critName(k)}${v > 1 ? ' ×' + v : ''}`)
  const q = squadronOf(game, s), far = q && mates(game, s).length > 1 && mates(game, s).every(m => m === s || dist(m.pos, s.pos) > 15)
  // the same hit plates and shield crests as over the ship, a little bigger
  const rows = statusRows(s, 7, 0, 1), icons = effectList(s).length
  const pips = `<svg class="card-pips" viewBox="-0.5 ${(-rows.height + 0.4).toFixed(2)} 15 ${(rows.height + 0.9 + (icons ? 1.8 : 0)).toFixed(2)}" width="100%" style="max-width:20rem;display:block;margin:2px 0 4px">${rows.svg}${effectIconsSvg(s, 7, 1.5, 1)}</svg>`
  return `${why ? `<div class="dim card-why">${why}</div>` : ''}<h2 class="${SIDE_CLASS[s.side]}">${s.name}</h2>${pips}${q ? `<div class="dim">${q.name} — ${mates(game, s).length} ship${mates(game, s).length === 1 ? '' : 's'} left${far ? ' · <span class="bad">out of formation: more than 15 cm from the squadron</span>' : ''}</div>` : ''}${s.commander ? `<div class="good">${s.commander} aboard${s.marks?.length ? ' · ' + s.marks.map(m => `<span title="${MARKS[m].text}">${MARKS[m].name}</span>`).join(', ') : ''}${s.rerolls ? ` · own re-roll ${s.rerolls}` : ''}</div>` : ''}
  <div class="stat">Hits <b>${remainingHits(s)}/${p.hits}</b>${isCrippled(s) ? ' <span class="bad">crippled</span>' : ''} · Resolve <b>${leadershipOf(s)}</b> · ${isSailor(s) ? `sails <b>${p.sail.sunFront} / ${p.sail.sunRear} / ${p.sail.sunSide} cm</b> (sunward edge in its front / rear / side arc) · turns <b>to any heading</b>` : `speed <b>${speedOf(s)} cm</b> · turns <b>${p.turns}°</b>`}<br>
  Shields <b>${shieldsLeft(game, s)}/${shieldsOf(s)}</b> · armour <b>${p.armour.front === p.armour.other && !p.armour.rear ? p.armour.other + '+' : `${frontArmour(s)}+ front${p.deflector ? (s.crits.prow ? ' (deflector off)' : ' (deflector)') : ''}, ${p.armour.other}+${p.armour.rear ? `, ${p.armour.rear}+ rear` : ''}`}</b> · turrets <b>${turretsOf(s)}</b>${s.order ? ` · <span class="good">${ORDERS[s.order.kind].name}</span>` : ''}${isHulk(s) ? ' · <span class="bad">hulk</span>' : ''}${fullyDocked(game, s) ? ' · docked' : ''}
  ${p.weapons.some(w => isTube(w)) ? ` · torpedoes <b>${s.loaded.torpedo ? 'loaded' : 'empty'}</b>` : ''}
  ${notYet(p).length ? `<br><span class="dim">Not in yet: ${notYet(p).join(', ')}</span>` : ''}${crits.length ? `<br><span class="bad">${crits.join(', ')}</span>` : ''}${s.state !== 'active' ? `<br><span class="bad">${s.state}</span>` : ''}</div>${capHtml(s)}`
}
// fighters on combat air patrol with this ship; they may leave at the start of the owner's Manoeuvre Phase
function capHtml (s) {
  const cap = capOf(game, s)
  if (!cap.length) return ''
  const n = cap.reduce((a, w) => a + w.markers.length, 0)
  const canLeave = game.phase === 'movement' && s.side === game.active && !s.movedThisPhase
  return `<div class="stat">Combat air patrol: <b>${n} fighter${n === 1 ? '' : 's'}</b> screening this ship${canLeave ? cap.map(w => ` <button data-leavecap="${w.id}">Fighters leave CAP</button>`).join('') : ''}</div>`
}

function renderActions () {
  const s = selectedShip(), el = $('actions')
  let h = ''
  if (game.over) { el.innerHTML = '<h2>The battle is over</h2>'; return }
  if (game.phase === 'setup' && game.sc) { el.innerHTML = scenarioSetupHtml(); return }
  if (game.phase === 'setup') {
    const next = nextPlace()
    if (!allPlaced(game)) h += `<p><b class="${SIDE_CLASS[game.placing]}">${game.sides[game.placing].name}</b>: place <b>${next.name}</b> in your shaded zone. The shadow follows the mouse: left click holds it, right click puts it down.</p><p class="dim">Facing fixed: ${facingLock(next)}.</p>`
    else h += `<p><b class="${SIDE_CLASS[game.firstChooser]}">${game.sides[game.firstChooser].name}</b> won the first-turn roll and chooses:</p>
      <div class="btns"><button class="big" data-first="${game.firstChooser}">We go first</button><button class="big" data-first="${1 - game.firstChooser}">We go second</button></div>`
    el.innerHTML = h; return
  }
  if (game.sc && game.phase === 'movement') h += waitingHtml()   // ships waiting off the table first, where they're seen
  if (!s) h += `<p class="dim">Click a ship to select it.</p>`
  if (s && mine(s) && s.state === 'active' && s.standby) {   // Surprise Attack
    h += `<p class="bad">On standby: it can't move, fire or launch until it goes on alert. It may brace and repair.</p>${game.phase === 'movement' ? `<div class="btns"><button data-alert="${s.uid}" ${s.alertTried === game.round ? 'disabled' : ''}>Try to go on alert: a Resolve Test</button></div>` : ''}`
  } else if (s && mine(s) && s.state === 'active') {
    if (game.phase === 'movement') h += lowOrbitHtml(s) + movementPanel(s)
    if (game.phase === 'shooting') h += troopsHtml(s) + shootingPanel(s)
  }
  if (game.phase === 'ordnance' && s && mine(s) && s.state === 'active' && !s.standby && isSailor(s) && sailTurn(s)) h += sailPanel(s)   // the Athanatoi's second move
  if (game.phase === 'ordnance') {
    const waves = game.ordnance.filter(o => o.kind === 'wave')
    if (waves.length) {
      const order = [...waves.filter(w => w.side === game.active), ...waves.filter(w => w.side !== game.active)]
      h += `<h3>Attack craft — click a wave, then click where it goes (up to its speed; the player whose turn it is first). Click one of your own ships to put a fighter wave on combat air patrol.</h3>` +
        order.map(w => `<div><button data-pickwave="${w.id}" class="${ui.wave === w.id ? 'on' : ''}" ${w.moved ? 'disabled' : ''}><span class="${SIDE_CLASS[w.side]}">${game.sides[w.side].name}</span>: ${w.markers.join(', ')} · ${waveSpeed(w)} cm${w.cap ? ` · CAP on ${shipByUid(game, w.cap)?.name.replace(/ class.*/, '')}` : ''}${w.moved ? ' · moved' : ''}</button></div>`).join('')
    }
    const pairs = []
    for (const a of game.ships.filter(x => x.side === game.active && x.state === 'active')) for (const t of enemiesOf(game, a)) if (!canTeleport(game, a, t)) pairs.push([a, t])
    if (pairs.length) h += `<h3>Teleport attacks — made in the End Phase</h3>` + pairs.map(([a, t]) => `<label><input type="checkbox" data-tele="${a.uid}:${t.uid}" ${ui.teleports.has(`${a.uid}:${t.uid}`) ? 'checked' : ''}> ${a.name} → ${t.name}</label><br>`).join('')
  }
  if (game.phase === 'movement') h += `<div class="dim" style="font-size:13px">Ships you leave unmoved go straight ahead their minimum distance.</div>`
  el.innerHTML = h
}

// ---------------- scenarios on the side panel ----------------
function scenarioSetupHtml () {
  const g = game, step = g.setupStep, A = g.sides[g.attacker]
  let h = `<h2>${g.sc.name}</h2>`
  if (step === 'defences') {
    const b = g.defenceBudget, D = g.sides[g.defender]
    h += `<p><b class="${SIDE_CLASS[g.defender]}">${D.name}</b>: planetary defences, <b>${b.points - b.spent}</b> of ${b.points} points left. You place them after, with your fleet: high orbit ones inside a planet's or moon's gravity well${g.lowOrbit ? ', ground ones along the planet edge of the low orbit table' : ''}.</p>`
    h += `<table>${DEFENCES.map(d => {
      // An Isos Orbital is its core plus up to four modules, priced as chosen
      const orb = d.id === 'isos-orbital-core' ? isosOrbital(ui.modules.filter(Boolean)) : null, cost = orb?.points ?? d.points, no = d.id === 'isos-orbital-core' && !orb ? 'a core module plus up to four more modules' : canBuy(g, d.id, orb?.points)
      const mods = d.id === 'isos-orbital-core' ? `<div class="btns">${[0, 1, 2, 3].map(k => `<select data-mod="${k}" title="module ${k + 1}"><option value="">no module</option>${Object.entries(ORBITAL_MODULES).map(([m, o]) => `<option value="${m}" ${ui.modules[k] === m ? 'selected' : ''}>${o.name} +${o.points}</option>`).join('')}</select>`).join('')}</div>` : ''
      return `<tr><td>${d.name} <span class="dim">${cost} pts${d.max ? ` · 0-${d.max}` : ''}</span>${mods}</td><td><button data-buy="${d.id}" ${no ? `disabled title="${no}"` : ''}>Buy</button></td></tr>` }).join('')}</table>`
    const mine = g.ships.filter(x => x.side === g.defender && x.profile.fleet === 'defence')
    if (mine.length) h += `<h3>Bought — click to take back</h3><div class="btns">${mine.map(x => `<button data-sell="${x.uid}">${x.name}</button>`).join('')}</div>`
    // A Tether or Warden of the fleet may guard an Orbital (City, Waystation): Resolve 7, no squadron with other escorts
    const orbs = g.ships.filter(x => x.side === g.defender && x.profile.fleet === 'defence' && x.profile.hooks), free = g.ships.filter(x => x.side === g.defender && x.profile.hooked && !x.guard)
    if (orbs.length) h += `<h3>Guards</h3>` + orbs.map(o => { const mine = g.ships.filter(x => x.guard === o.uid); return `<div class="btns">${o.name}: ${mine.length ? mine.map(x => x.name.replace(/ class.*/, '')).join(', ') + ' · ' : ''}${free.length ? `<select data-guardsel="${o.uid}">${free.map(x => `<option value="${x.uid}">${x.name.replace(/ class.*/, '')}</option>`).join('')}</select> <button data-guard="${o.uid}">Guard</button>` : '<span class="dim">no Tether or Warden free</span>'}</div>` }).join('')
    h += `<div class="btns" style="margin-top:8px"><button class="big" data-donebuy>Done: set up the battle</button></div>`
  } else if (step === 'assign') {
    h += `<p><b class="${SIDE_CLASS[g.attacker]}">${A.name}</b>: choose the ships under each Contact from your fleet list.</p>`
    const mineList = SHIPS.filter(p => p.fleet === A.fleet && p.role !== 'transport' && p.role !== 'derelict')
    for (const c of g.contacts.filter(c => c.kind !== 'cluster')) {
      const opts = c.kind === 'capital' ? mineList.filter(p => p.type !== 'escort' && p.points <= c.limit) : mineList.filter(p => p.type === 'escort')
      h += `<div class="btns">${c.kind === 'capital' ? 'A capital ship' : 'An escort squadron'} up to ${c.limit} pts: <select data-ctype="${c.id}">${opts.map(p => `<option value="${p.id}">${p.name.replace(/ class.*/, '')} ${p.points}</option>`).join('')}</select>
        ${c.kind === 'escorts' ? `× <input type="number" min="1" max="6" value="2" data-cn="${c.id}">` : ''} <button data-assign="${c.id}">${c.ships.length ? 'Change' : 'Choose'}</button> ${c.ships.length ? `<span class="good">${c.ships.map(u => shipByUid(g, u).name.replace(/ class.*/, '')).join(', ')}</span>` : ''}</div>`
    }
  } else if (step === 'contacts') {
    const n = g.contacts.filter(c => c.pos).length
    h += `<p><b class="${SIDE_CLASS[g.attacker]}">${A.name}</b>: click to place Contact marker ${n + 1} of ${g.contacts.length} — at least 30 cm from every edge and from each other.</p>`
  } else if (step === 'entry') {
    h += `<p><b class="${SIDE_CLASS[g.defender]}">${g.sides[g.defender].name}</b>: click the ${g.convoyEdge} edge where the convoy will move on — not within 45 cm of a long edge.</p>`
  } else if (step === 'markers') {
    const side = markerSide(g)
    h += `<p><b class="${SIDE_CLASS[side]}">${g.sides[side].name}</b>: click to place your starting Contact marker (division ${g.markers.find(m => m.side === side && m.start).div}) — at least 30 cm from every edge and 60 cm from the enemy's.</p>`
  } else if (step === 'place') {
    const next = nextPlace()
    if (next) {
      h += `<p><b class="${SIDE_CLASS[next.side]}">${g.sides[next.side].name}</b>: place <b>${next.name}</b>${next.standby ? ' (on standby)' : next.highOrbit ? ' (standby, in high orbit)' : next.patrolBy != null ? ` (on patrol, set up by ${g.sides[next.patrolBy].name})` : ''}.</p><p class="dim">${placeHint(next)}</p>`
      if (next.fort) {   // Decided before the game, then it cannot change
        const f = fortOf(g, next)
        h += f.rotatesSet ? `<p>The fort <b>${f.rotates ? 'will rotate' : 'will not rotate'}</b>: decided.</p>` : `<p>Does the fort rotate? It turns 45 degrees at the start of its owner's Manoeuvre Phase each turn, and cannot be docked with if it does. Decide before the game; it cannot be changed.</p><div class="btns"><button data-rotate="1">Rotates</button><button data-rotate="0">Does not rotate</button></div>`
        h += `<p class="dim">Click places the whole fort with its centre where you click; Q and E turn all four quadrants together.</p>`
      }
      h += `<p class="dim">${facingLock(next) ? `Facing fixed: ${facingLock(next)}.` : 'Q and E turn it, or hold the middle button and swing.'} Left click holds it, right click puts it down.</p>`
    }
  } else if (step === 'ready') {
    if (g.firstFixed != null) h += `<p><b class="${SIDE_CLASS[g.firstFixed]}">${g.sides[g.firstFixed].name}</b> take the first turn.</p><div class="btns"><button class="big" data-first="${g.firstFixed}">Start the battle</button></div>`
    else h += `<p><b class="${SIDE_CLASS[g.firstChooser]}">${g.sides[g.firstChooser].name}</b> won the first-turn roll and chooses:</p><div class="btns"><button class="big" data-first="${g.firstChooser}">We go first</button><button class="big" data-first="${1 - g.firstChooser}">We go second</button></div>`
  }
  const waiting = g.ships.filter(x => x.state === 'reserve')
  if (waiting.length) h += `<h3>Off the table at the start</h3><div class="dim">${waiting.map(x => `<span class="${SIDE_CLASS[x.side]}">${x.name.replace(/ class.*/, '')}</span>`).join(', ')}</div>`
  return h
}
function placeHint (s) {
  if (s.profile.fleet === 'defence') return ({ ground: 'Click along the bottom of the low orbit table: it goes on the planet\'s edge, facing out.', minefield: 'With an edge within 15 cm of a planet, moon or asteroid field; its size is rolled, D3×5 by D3×5 cm.' })[s.profile.role] ?? 'Inside a planet\'s or moon\'s gravity well (the dashed circle), not on the planet, not overlapping another station.'
  const id = game.sc.id, def = s.side === game.defender
  return ({ bait: def ? 'In the centre of the table, facing the right edge.' : 'More than 60 cm behind the pursued: to their left.',
    corsairs: 'At least 30 cm from every edge; ships and squadrons 20 cm apart; all facing the way the first one faces.',
    surprise: s.standby ? 'On standby: a ship within 15 cm of the planet, set abeam of it.' : 'On alert: anywhere at least 30 cm from an edge.',
    blockade: def ? `In its third (${['top', 'middle', 'bottom'][s.third]}), not within 60 cm of the left edge.` : 'Within 15 cm of the left edge.',
    assault: def ? (s.highOrbit ? 'In high orbit: inside the planet\'s gravity well.' : 'Not within 30 cm of an edge or inside celestial phenomena.') : 'Within 15 cm of the left edge.',
    worldbreak: def ? 'Not within 30 cm of an edge.' : 'Within 15 cm of the left edge.',
    escalating: 'Within 10 cm of your Contact marker.' })[id] ?? ''
}
// ships waiting off the table this turn, and the Convoy raiders' Contacts
function waitingHtml () {
  const g = game, mineWaiting = g.ships.filter(x => x.side === g.active && x.state === 'reserve')
  let h = ''
  if (mineWaiting.length) h += `<h3>Off the table — click Move on, then click the table edge</h3>` + mineWaiting.map(x => { const e = entryFor(g, x); return `<div class="btns"><button data-enter="${x.uid}" class="${ui.entering === x.uid ? 'on' : ''}" ${e.why ? 'disabled' : ''}>Move on: ${x.name.replace(/ class.*/, '')}</button>${e.why ? ` <span class="dim">${e.why}</span>` : ''}</div>` }).join('')
  if (g.sc.id === 'convoy' && g.active === g.attacker) {
    const left = g.contacts.filter(c => !c.done)
    if (left.length) h += `<h3>Contacts — turn one over at the start of your Manoeuvre Phase (two if a convoy ship is on special orders)</h3><div class="btns">${left.map((c, i) => `<button data-reveal="${c.id}">Turn over Contact ${i + 1}</button>`).join('')}</div>`
  }
  return h
}
// Entering low orbit, at the start of the ship's turn, from inside the planet's gravity well
function lowOrbitHtml (s) {
  if (!game.lowOrbit || s.movedThisPhase || s.profile.speed === 0) return ''
  if (inLowOrbit(s)) return `<p class="dim">In low orbit, ${Math.round(fromPlanetEdge(s))} cm from the planet edge: no minimum move, no distance before turning; batteries one column right, lances and sunburst cannon fire on 4+, no torpedoes.</p>`
  const inWell = wellsAt(game, s.pos).some(w => w.id === game.lowOrbit.planet)
  return inWell ? `<div class="btns"><button data-lowenter="${s.uid}" class="${ui.lowEnter === s.uid ? 'on' : ''}">Enter low orbit</button> <span class="dim">then click along the top of the low orbit table</span></div>` : ''
}
// Landing troops in the Planetary Assault
function troopsHtml (s) {
  if (game.sc?.id !== 'assault' || s.side !== game.attacker || !inLowOrbit(s) || fromPlanetEdge(s) > 30) return ''
  return `<div class="btns"><button data-land="${s.uid}" ${s.fired ? 'disabled' : ''}>Land troops / bombard: +${s.profile.role === 'transport' ? 2 : 1} assault point${s.profile.role === 'transport' ? 's' : ''}, and nothing else this turn</button></div>`
}

function movementPanel (s) {
  if (s.profile.speed === 0) return '<p class="dim">A stationary defence: it never moves, and takes only Reload Ordnance or Brace for Impact! on Resolve 7.</p>' + stationaryOrders(s)
  const fire = s.id === 'fireship' || s.profile.fireShip ? `<div class="btns"><button data-detonate="${s.uid}">Detonate the fire ship: D3 Fire criticals on every ship within 3D6 cm</button></div>` : ''
  if (fire) return fire + movementPanelShip(s)
  return movementPanelShip(s)
}
// A defence takes Reload Ordnance; a fort also Lock On, and may give a pair of quadrants one order with one Command check
function stationaryOrders (s) {
  if (game.phase !== 'movement' || s.side !== game.active || s.state !== 'active') return ''
  const kinds = s.fort ? ['lockOn', 'reload'] : ['reload'], off = s.order || game.ordersFailed[s.side] ? 'disabled' : ''
  let h = '<h3>Special orders: a Command check on 2D6</h3>'
  if (s.fort) {
    const pals = fortStanding(game, s).filter(q => q !== s)
    h += `<div class="btns"><label>Give it to a pair of quadrants (one Command check) <select id="together"><option value="">this quadrant alone</option>${pals.map(q => `<option value="${q.uid}">with ${q.name.replace(/.*\((.*)\)/, '$1')}</option>`).join('')}</select></label></div>`
  }
  return h + `<div class="btns">${kinds.map(k => `<button data-order="${k}" ${off} class="${orderOf(s) === k ? 'on' : ''}">${ORDERS[k].name}</button>`).join('')}</div>`
}
// A ship in contact with a friendly fort may halt as if in a gravity well and Burn Retros without a Command check; at a pier it is fully docked
function dockHtml (s) {
  const c = dockContacts(game, s)
  if (!c.length || s.movedThisPhase) return ''
  const full = fullyDocked(game, s)
  return `<div class="dock"><b>Docked:</b> touching ${c.map(q => q.name.replace(/.*\((.*)\)/, '$1')).join(' and ')} of a friendly fort${full ? ` — <b>fully docked at a pier</b> (turn ${s.dockedTurns ?? 0} of 2 for an automatic reload, +4 damage control dice)` : ''}.
    <div class="btns"><button data-dockhalt title="Ships touching a friendly Bastion may stop where they are, as they could in a gravity well">Halt: stay docked, don't move</button></div></div>`
}
function movementPanelShip (s) {
  if (s.movedThisPhase) {
    let h = '<p class="dim">This ship has moved.</p>'
    // A Lump on All Ahead Full ends its move by sliding its extra 2D6 cm whichever way the player picks; the bearing is a click on the table
    if (s.profile.lump && orderOf(s) === 'aheadFull' && s.slid !== game.round && s.order?.extra) h += `<div class="btns"><button data-slide class="${ui.slide ? 'on' : ''}">${ui.slide ? `Click the table in the direction to slide ${s.order.extra} cm…` : `Slide ${s.order.extra} cm`}</button></div>`
    if (s.state === 'active' && !s.disengageFailedRound) h += '<div class="btns"><button data-disengage>Try to disengage</button></div>'
    return h
  }
  let h = dockHtml(s) + '<h3>Special orders: a Command check on 2D6</h3><div class="btns">'
  for (const [k, o] of Object.entries(ORDERS)) if (k !== 'brace' && !(isSailor(s) && SAIL_REFUSED.includes(k))) h += `<button data-order="${k}" ${s.order || game.ordersFailed[s.side] ? 'disabled' : ''} class="${orderOf(s) === k ? 'on' : ''}">${o.name}</button>`
  if (s.profile.fleet === 'thnitoi' && s.profile.weapons.some(w => w.kind === 'torpedo')) h += `<button data-order="reload" data-leech ${s.order || game.ordersFailed[s.side] ? 'disabled' : ''} title="Lamprey torpedoes need a Reload Ordnance roll of their own${leechLoaded(s) ? ' (leeches are loaded now)' : ''}">Reload Ordnance (leech)</button>`
  h += '</div>'
  if (!s.order && !game.ordersFailed[s.side] && !isSailor(s)) {   // no ramming for the Athanatoi
    const enemies = enemiesOf(game, s)
    h += `<div class="btns"><span class="dim">All Ahead Full and try to ram</span> <select id="ram"><option value="">no ram</option>${enemies.map(e => `<option value="${e.uid}">${e.name}</option>`).join('')}</select> <button data-order="aheadFull" data-withram>Order</button></div>`
  }
  if (game.ordersFailed[s.side]) h += '<div class="why">A Command check has failed this turn: no more special orders.</div>'
  if (isSailor(s)) return h + sailPanel(s)   // the legs panel is for ships that turn by degrees
  if (!ui.plan) ui.plan = planToward(s, along(s.pos, s.facing, speedOf(s)))
  const c = checkMove(game, s, legsOf(ui.plan)), p = ui.plan
  const two = c.turns >= 2
  h += `<h3>Move — click the table to aim, or set the legs (min ${round1(c.min)} cm, max ${round1(c.max)} cm, ${c.turns} turn${c.turns === 1 ? '' : 's'}, turn after ${turnDistance(s)} cm)</h3>
  <table><tr><td>Ahead</td><td><input type="number" step="0.5" data-plan="a" value="${p.a}"> cm</td><td>then turn</td><td><input type="number" step="5" data-plan="t1" value="${p.t1}">°</td></tr>
  <tr><td>Ahead</td><td><input type="number" step="0.5" data-plan="b" value="${p.b}"> cm</td>${two ? `<td>then turn</td><td><input type="number" step="5" data-plan="t2" value="${p.t2}">°</td></tr><tr><td>Ahead</td><td><input type="number" step="0.5" data-plan="c" value="${p.c}"> cm</td>` : ''}</tr>
  ${c.turns >= 3 ? `<tr><td>then turn</td><td><input type="number" step="5" data-plan="t3" value="${p.t3 ?? 0}">°</td><td>Ahead</td><td><input type="number" step="0.5" data-plan="d" value="${p.d ?? 0}"> cm</td></tr>` : ''}
  ${c.turns >= 4 ? `<tr><td>then turn</td><td><input type="number" step="5" data-plan="t4" value="${p.t4 ?? 0}">°</td><td>Ahead</td><td><input type="number" step="0.5" data-plan="e" value="${p.e ?? 0}"> cm</td></tr>` : ''}</table>
  <div class="dim" style="font-size:13px">Positive turns are to starboard (right), negative to port. Total ${round1(c.path.total)} cm.</div>`
  if (c.well) h += `<div style="margin-top:6px">In a gravity well: a free turn towards the ${c.well.planet.moon ? 'moon' : 'planet'}, up to ${Math.round(c.well.max)}° ${c.well.sign > 0 ? 'to starboard' : 'to port'}, before moving <input type="number" step="5" data-plan="g1" value="${p.g1 ?? 0}">° and/or at the end <input type="number" step="5" data-plan="g2" value="${p.g2 ?? 0}">°</div>`
  if (c.orbit) h += '<div class="btns"><button data-orbit>Hold high orbit — don\'t move (shot at as a Defence)</button></div>'
  if (!c.ok) h += `<div class="why">${c.reasons.join('<br>')}</div>`
  const touchingEnemies = enemiesOf(game, s)
  h += `<div class="btns"><span class="dim">${game.sea ? `Board an enemy within ${SEA_BOARD_RANGE} cm in a side arc where you end (Tides house rule)` : 'Board an enemy you end touching'}</span> <select id="boardSel"><option value="">no</option>${touchingEnemies.map(e => `<option value="${e.uid}" ${ui.boarding == e.uid ? 'selected' : ''}>${e.name}</option>`).join('')}</select></div>`
  h += `<div class="btns"><button class="big" data-move ${c.ok ? '' : 'disabled'}>Move</button></div>`
  return h
}

function shootingPanel (s) {
  let h = ''
  if (s.fired) h += '<p class="dim">This ship has fired its batteries and lances.</p>'
  else {
    const enemies = game.ships.filter(x => x.side !== s.side && x.pos && (x.state === 'active' || isHulk(x)))
    const near = nearestEnemy(game, s)
    const squad = mates(game, s).filter(x => !x.fired)
    h += `<h3>${squad.length > 1 ? `The squadron fires together` : 'Weapons batteries and lances'} — nearest enemy: ${near ? near.name + ' ' + round1(dist(near.pos, s.pos)) + ' cm' : 'none'}</h3><table>`
    for (const x of squad) x.profile.weapons.forEach((w, i) => {
      if (!isGun(w)) return
      const key = `${x.uid}:${i}`, str = weaponStrength(x, w), works = weaponWorks(x, w)
      const options = enemies.filter(e => canTarget(game, x, w, e.pos)), ords = game.ordnance.filter(o => o.side !== x.side && canTarget(game, x, w, o.pos))
      const xNear = nearestEnemy(game, x)
      if (!(key in ui.shots)) ui.shots[key] = works && options.length ? (options.includes(xNear) ? xNear.uid : options[0].uid) : null
      h += `<tr data-weapon-row="${x === s ? i : ''}"><td>${squad.length > 1 ? `<b>${x.name.replace(/ class.*/, '')}</b> ` : ''}${w.loc} ${w.kind === 'battery' ? 'battery' : w.kind === 'heavybangers' ? 'heavy bangers' : w.kind === 'starlance' ? 'starlances' : 'lances'} <span class="dim">${w.range} cm, ${w.kind === 'battery' ? 'firepower' : 'strength'} ${str}${str < w.str ? ' (halved)' : ''}</span></td><td>${works ? `<select data-shot="${key}"><option value="">hold fire</option>${options.map(e => `<option value="${e.uid}" ${ui.shots[key] === e.uid ? 'selected' : ''}>${e.name} ${round1(dist(e.pos, x.pos))} cm</option>`).join('')}${ords.map(o => `<option value="o${o.id}" ${ui.shots[key] === 'o' + o.id ? 'selected' : ''}>${o.kind === 'wave' ? `attack craft wave (${o.markers.length})` : `torpedo salvo ${o.str}`}</option>`).join('')}</select>` : '<span class="bad">damaged</span>'}</td></tr>`
    })
    h += '</table><div class="btns"><button class="big" data-fire>Fire</button></div>'
  }
  if (s.profile.weapons.some(w => w.kind === 'sproglance') && s.sproglanceFired !== game.round) h += `<h3>Sprog Lance</h3><div class="btns"><button data-sproglance class="${ui.sproglance ? 'on' : ''}">${ui.sproglance ? 'Click an enemy ship within 30 cm whose shields are down…' : 'Fire the Sprog Lance'}</button></div>`
  const sunburst = s.profile.weapons.find(w => w.kind === 'sunburst')
  if (sunburst && !s.sunburstFired) h += `<h3>Sunburst cannon</h3><div class="btns"><button data-sunburst class="${ui.sunburst ? 'on' : ''}">${ui.sunburst ? 'Click the table where the shell should land…' : 'Aim the sunburst cannon'}</button></div>`
  if (s.profile.weapons.some(w => w.kind === 'bays')) {
    if (!s.loaded.bays) h += '<p class="dim">Launch bays empty — Reload Ordnance orders next turn.</p>'
    else {
      const room = Math.min(baysOf(s), fleetCraftRoom(game, s.side))
      const cp = combinePartners(game, s, 'bays'), with_ = cp.filter(x => ui.combineC?.has(x.uid))
      const roomC = Math.min(baysOf(s) + with_.reduce((a, x) => a + baysOf(x), 0), fleetCraftRoom(game, s.side))
      h += `<h3>Launch bays: up to ${roomC} squadron${roomC === 1 ? '' : 's'} as one wave</h3>${cp.length ? `<div class="btns">Launch together with (in base contact): ${cp.map(x => `<label><input type="checkbox" data-combc="${x.uid}" ${ui.combineC?.has(x.uid) ? 'checked' : ''}> ${x.name.replace(/ class.*/, '')}</label>`).join(' ')}</div>` : ''}<div class="btns">${launchable(game, s).map(t => `<label>${t}s <input type="number" min="0" max="${roomC}" value="${ui.craft?.[t] ?? 0}" data-craft="${t}"></label>`).join(' ')} <button data-launchcraft>Launch</button></div>`
    }
  }
  if (harpoonsReady(s) > 0 && game.phase === 'shooting' && s.side === game.active) h += `<h3>Harpoon assault module</h3><div class="btns"><button data-harpoon>Launch a Harpoon (${harpoonsReady(s)} ready)</button></div>`
  if (s.mines && game.phase === (isPhageShip(s) ? 'ordnance' : 'movement') && s.loaded.bays) h += `<h3>${isPhageShip(s) ? 'Great spore mines' : 'Orbital mines'}</h3><div class="btns"><button data-launchmines>Launch ${baysOf(s)} mine${baysOf(s) > 1 ? 's' : ''} from the stem</button></div>`
  const bioTubes = s.profile.weapons.map((w, i) => [w, i]).filter(([w]) => w.kind === 'bio-torpedo')
  if (bioTubes.length > 1) h += `<p class="dim">Bio-torpedo tubes: ${bioTubes.map(([w, i]) => `${w.loc} ${s.loaded.tubes?.[i] === false || !s.loaded.torpedo ? 'launched' : 'loaded'}`).join(', ')}. Each is launched once between reloads.</p>`
  const tw = s.profile.weapons.find(w => isTube(w))
  if (tw) {
    if (!s.loaded.torpedo) h += '<p class="dim">Torpedo tubes empty — Reload Ordnance orders next turn.</p>'
    else {
      const cp = combinePartners(game, s, 'torpedo'), allRound = tw.arc === 'all'
      h += `<h3>Torpedoes: strength ${tw.str}, speed ${tw.range} cm, ${allRound ? 'all round' : 'front arc'}</h3>${cp.length ? `<div class="btns">Combine with (in base contact): ${cp.map(x => `<label><input type="checkbox" data-combt="${x.uid}" ${ui.combineT?.has(x.uid) ? 'checked' : ''}> ${x.name.replace(/ class.*/, '')}</label>`).join(' ')}</div>` : ''}
      <div class="btns">Heading <input type="range" min="${allRound ? -180 : -45}" max="${allRound ? 180 : 45}" step="5" value="${ui.torp}" data-torp> <span>${ui.torp > 0 ? ui.torp + '° starboard' : ui.torp < 0 ? -ui.torp + '° port' : 'dead ahead'}</span> <button data-launch>Launch</button>${raceRule(s.profile.fleet).boardingTorpedoes ? ` <label><input type="checkbox" data-boardt ${ui.boardT ? 'checked' : ''}> boarding torpedoes</label>` : ''}</div>`
    }
  }
  return h
}

function renderStatus () {
  const g = game
  const rr = fleetMode() ? `<div class="score">Fleet Commander re-rolls left: <span class="imp">${g.sides[0].name} ${g.rerolls[0].left}</span> · <span class="chs">${g.sides[1].name} ${g.rerolls[1].left}</span></div>` : ''
  const scLine = g.sc ? `<div class="score">${g.sc.name}${g.sc.symmetric ? '' : `: <span class="${SIDE_CLASS[g.attacker]}">${g.sides[g.attacker].name}</span> ${g.sc.roles[0].toLowerCase()}, <span class="${SIDE_CLASS[g.defender]}">${g.sides[g.defender].name}</span> ${g.sc.roles[1].toLowerCase()}`}${g.sc.id === 'assault' ? ` · assault points <b>${g.assaultPoints}</b>/10` : ''}${g.sc.id === 'corsairs' && g.round <= (g.alertTurns ?? 0) ? ` · defenders -1 Resolve until the end of turn ${g.alertTurns}` : ''}${g.sc.id === 'convoy' && g.phase !== 'setup' ? ` · transports through: <b>${g.ships.filter(x => x.profile.role === 'transport' && x.exitEdge === (g.convoyEdge === 'left' ? 'right' : 'left')).length}</b>` : ''}</div>` : ''
  const e = g.effects, fx = e ? `<div class="score">Sunward: the ${e.sunward} edge${sunwardMatters(g) ? ' — range shifts doubled firing towards it' : ''}${e.flares ? ` · solar flare${e.flares > 1 ? 's' : ''}: ${e.flareDone ? 'spent' : `${e.flares} rolled for each turn, 6 to erupt`}` : ''}${e.bursts ? ` · radiation: ${radiationNow(g) ? `<span class="bad">-${radiationNow(g)} Resolve this turn</span>` : `${e.bursts} rolled for each turn, 5-6`}` : ''}</div>` : ''
  const vp = g.phase === 'setup' ? scLine + rr + fx : scLine + `<div class="score">Victory points: <span class="imp">${g.sides[0].name} ${vpOf(0)}</span> · <span class="chs">${g.sides[1].name} ${vpOf(1)}</span></div>${rr}${fx}`
  // top left, the turn card: whose turn, then the phase; under it the four phases, the current one lit
  const st = $('phase-state')
  st.className = 'plate ' + (g.phase === 'setup' || g.over ? '' : SIDE_CLASS[g.active])
  $('phase-turn').textContent = g.phase === 'setup' ? 'Set-up' : g.over ? 'Battle over' : `Turn ${g.round}${Number.isFinite(g.rounds) ? ` of ${g.rounds}` : ''} · ${g.sides[g.active].name}`
  $('phase-name').textContent = g.phase === 'setup' ? (g.sc ? g.sc.name : g.scenario === 'fleetEngagement' ? 'Fleet Engagement' : 'Cruiser Duel') : g.over ? (g.result?.title ?? 'The end') : `${PHASE_NAMES[g.phase]} Phase`
  const PH = ['movement', 'shooting', 'ordnance', 'end'], at = PH.indexOf(g.phase)
  const STEP = { movement: 'move, special orders', shooting: 'guns, torpedoes, attack craft', ordnance: 'torpedoes and craft move', end: 'boarding, repairs, fires' }
  $('stepper').innerHTML = g.phase === 'setup' ? '' : PH.map((p, i) => `<li data-state="${g.over ? 'done' : i < at ? 'done' : i === at ? 'current' : 'todo'}"><span class="n" data-n="${i + 1}">${PHASE_NAMES[p]}</span>${i === at ? `<span class="step">${STEP[p]}</span>` : ''}</li>`).join('')
  $('score').innerHTML = vp.replace(/class="score"/g, '') + '<div class="dim" style="margin-top:4px">wheel zoom · right-drag pan · F fit · G grid · Space pips</div>'
}

function renderLog () {
  const el = $('log')
  el.innerHTML = game.log.map((l, i) => `<div class="${/Phase$|^Turn \d/.test(l.text) ? 'head' : / rolled [1-6]/.test(l.text) ? 'roll' : ''} ${i >= ui.logMark ? 'new' : ''}">${l.text.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</div>`).join('')
  $('log-scroll').scrollTop = $('log-scroll').scrollHeight
}

function render () {
  // the engine tells the board what to animate (fx.js): drawing only, the dice are already rolled
  // (a drawing error must never reach the rules: the shot is being resolved while this runs)
  if (!game.onFx) game.onFx = e => { if (fxHeld) fxHeld.push(e); else playFx(e) }
  renderBoard(); renderGhost(); renderStatus(); renderActions(); renderLog(); renderHud()
  if (ui.overClosed) return   // Look at the table: the result stays away until asked for
  if (game.over && game.result) {
    const r = game.result
    $('over-text').innerHTML = `<h1>${r.title}</h1><p>${r.why}.</p><p>${r.text ?? ''}</p><p>Victory points: <span class="imp">${game.sides[0].name} ${r.vp?.[0] ?? vpOf(0)}</span> · <span class="chs">${game.sides[1].name} ${r.vp?.[1] ?? vpOf(1)}</span></p><button class="big" data-new>New battle</button> <button data-look>Look at the table</button>`
    $('over').hidden = false
  } else if (game.over) {
    const a = vpOf(0), b = vpOf(1)
    $('over-text').innerHTML = `<h1>${a === b ? 'A draw' : game.sides[a > b ? 0 : 1].name + ' wins'}</h1><p>Victory points: <span class="imp">${game.sides[0].name} ${a}</span> · <span class="chs">${game.sides[1].name} ${b}</span></p><p class="dim">${fleetMode() ? 'Destroyed ships their points, crippled 25%, disengaged 25% or 10%, hulks 50% to the fleet holding the field' : '1 per damage point inflicted, +1 per crippled ship, +3 per destroyed ship'}</p><button class="big" data-new>New battle</button> <button data-look>Look at the table</button>`
    $('over').hidden = false
  }
}

// ---------------- the plates around the table: turn card, ship card, guide, help, dice (hud.js) ----------------
let guideHidden = false, helpTab = 0
try { guideHidden = localStorage.getItem('vwf-guide-hidden') === '1' } catch { /* not remembered */ }
const shortName = s => s.name.replace(/ class.*/, '')
function renderHud () {
  const s = selectedShip()
  // bottom left: a card for the ship under the mouse, else the selected ship
  const over = ui.hover != null ? shipByUid(game, ui.hover) : null, c = over && over.pos && !['destroyed', 'disengaged', 'gone', 'landed', 'lost', 'reserve'].includes(over.state) ? over : s
  $('unit-card').hidden = !c
  if (c) $('unit-card').innerHTML = shipCard(c, c !== s ? 'under the mouse' : 'selected')
  // "What now?" over the ship's buttons
  $('guide').innerHTML = guideHtml(game, ui, {
    hidden: guideHidden, shortName,
    orders: x => x.profile.fleet !== 'defence' && !x.standby,
    canShoot: x => x.profile.weapons.some(w => isGun(w)) && enemiesOf(game, x).some(e => x.profile.weapons.some(w => isGun(w) && canTarget(game, x, w, e.pos))),
    second: x => { if (!isSailor(x) || game.phase !== 'ordnance' || x.standby || sailedNow(x)?.second) return null; return !secondMoveProblem(game, x) ? 'Second move' : !ordnanceMoved(game) ? 'Second move (after the attack craft)' : null },
    canLaunch: x => (x.loaded.torpedo && x.profile.weapons.some(isTube)) || (x.loaded.bays && baysOf(x) > 0),
  })
  // bottom right: the big gold button ends the phase
  const nextName = { movement: 'End Manoeuvre', shooting: 'End Fire', ordnance: 'End Phase' }[game.phase]
  $('phase-buttons').innerHTML = nextName && !game.over ? `<button id="next" title="Finish this phase and go to the next">${nextName}</button>` : game.over && ui.overClosed ? '<button id="see-result">Result</button>' : ''
  // bottom centre: the newest dice
  const d = diceHtml(game.log, ui.logMark)
  $('dice-strip').hidden = !d
  $('dice-strip').innerHTML = d
  renderPips()
}
$('phase-buttons').addEventListener('click', e => {
  if (!e.target.closest('#next') || !game) return
  ui.move = null; ui.planEdited = false; ui.wave = null; ui.missile = null; ui.plan = null; ui.shots = {}; ui.sunburst = false; ui.slide = false; ui.sproglance = false; ui.gun = null; ui.torpAim = null; ui.craftAim = false
  const teleports = [...ui.teleports].map(k => k.split(':').map((v, i) => i < 2 ? +v : v)); ui.teleports.clear()
  act(() => nextPhase(game, { teleports }))
})
$('guide').addEventListener('click', e => {
  const b = e.target.closest('button')
  if (!b) return
  if (b.dataset.guide != null) { guideHidden = !guideHidden; try { localStorage.setItem('vwf-guide-hidden', guideHidden ? '1' : '0') } catch { /* not remembered */ } return render() }
  if (b.dataset.pick != null) { ui.selected = +b.dataset.pick; ui.plan = null; ui.sail = null; ui.shots = {}; return render() }
})
FX.setArtOf(ship => pictureOf(ship))
FX.setHeard(sound)
FX.setAimGuns((ship, weapon, target) => { if (weapon == null || !ship.pos) return null; const d = FX.drawnAt('ship:' + ship.uid, ship.pos.x, ship.pos.y, ship.facing); return Guns.aim(ship, weapon, d, target, setup.style === 'svg' ? 'svg' : 'sprite') })
FX.setFieldStyle(store.get('field', 'mirage'))   // the mirage field style, unless one was saved
FX.setShieldStyle(store.get('shield', 'burst'))   // the shield style, unless one was saved
setSound(store.get('sound', '1') === '1')
const showSound = () => { $('b-sound').textContent = soundOn() ? 'Sound' : 'Muted'; $('b-sound').classList.toggle('on', !soundOn()) }
const toggleSound = () => { setSound(!soundOn()); store.set('sound', soundOn() ? '1' : '0'); showSound(); if (soundOn()) warm(); music.mute(!soundOn()) }   // guns and table music together
showSound()
$('b-sound').addEventListener('click', toggleSound)
$('over').addEventListener('click', e => {
  if (e.target.closest('[data-new]')) location.reload()
  if (e.target.closest('[data-look]')) { ui.overClosed = true; $('over').hidden = true; render() }
})
$('phase-buttons').addEventListener('click', e => { if (e.target.id === 'see-result') { ui.overClosed = false; render() } })
$('log-toggle').addEventListener('click', () => $('log-wrap').classList.toggle('folded'))
$('b-menu').addEventListener('click', () => showAsk({ title: 'Leave this battle?', text: 'It goes back to the start screen. This battle is not saved.', buttons: [{ label: 'Leave', value: true, primary: true }, { label: 'Decline', value: false }] }, a => { if (a.value) location.reload() }))
$('b-help').addEventListener('click', () => { const box = $('help-box'); box.hidden = !box.hidden; $('b-help').classList.toggle('on', !box.hidden); if (!box.hidden) box.innerHTML = helpHtml(helpTab) })
$('help-box').addEventListener('click', e => {
  const b = e.target.closest('button')
  if (!b) return
  if (b.dataset.helptab != null) { helpTab = +b.dataset.helptab; $('help-box').innerHTML = helpHtml(helpTab) }
  if (b.dataset.helpclose != null) { $('help-box').hidden = true; $('b-help').classList.remove('on') }
})

// ---------------- the action pips: buttons drawn on the board beside the ship or target they act on ----------------
// Each pip is a button the side panel already has, put on the ship or target it acts on. Space hides and shows them.
let pips = null
function toScreenPx (x, y) {
  const svg = $('board'), m = svg.getScreenCTM(), box = svg.getBoundingClientRect()
  const vx = y >= 900 ? x + LOW_DX : x, vy = y >= 900 ? y + LOW_DY : y
  return { x: m.a * vx + m.c * vy + m.e - box.left, y: m.b * vx + m.d * vy + m.f - box.top }
}
// ---- the weapons as pips: one per weapon, standing out from the side of the
// ship it is mounted on; ready, picked, fired, or greyed with the reason. Pick a gun, then its target; or pick no gun and a
// Target pip aims every gun that can reach. A ship's guns fire together, so Fire! ends it.
const WEAPON_ANGLE = { prow: 0, starboard: 90, aft: 180, port: -90, dorsal: 180, keel: 135, lances: 0, main: 90, bays: -90 }
const WEAPON_WORD = { lightning: 'Storm arcs', whip: 'Flayer', portal: 'Portal', bombardment: 'Bombardment cannon', battery: 'Guns', lance: 'Lances', starlance: 'Starlances', phantom: 'Hollow lances', torpedo: 'Torpedoes', bays: 'Launch bays', sunburst: 'Sunburst cannon' }
const SIDE_WORD = { prow: 'Prow', starboard: 'Starboard', port: 'Port', dorsal: 'Dorsal', aft: 'Aft', keel: 'Keel', lances: '', main: '', bays: '' }
function weaponPips (s) {
  const list = [], D = FX.drawnAt('ship:' + s.uid, s.pos.x, s.pos.y, s.facing), P = { x: D.x, y: D.y }, R = baseR(s) + 1.5
  const count = {}
  const stand = (angle, key) => {   // out from the ship on that side, a row further for each weapon there; the pip's own width pushes it clear
    const n = count[key] = (count[key] ?? -1) + 1, a = (D.f + angle) * Math.PI / 180
    return { free: true, at: along(P, D.f + angle, R), px: { x: Math.cos(a) * 62, y: Math.sin(a) * 26 + n * 28 } }
  }
  const pickable = [...new Set(s.profile.weapons.map((w, i) => [w, i]))]
  for (const [w, i] of pickable) {
    const word = `${SIDE_WORD[w.loc] ?? ''} ${WEAPON_WORD[w.kind] ?? w.kind}`.trim(), key = `${s.uid}:${i}`, spot = stand(w.arc === 'all' && w.loc === 'dorsal' ? 180 : (WEAPON_ANGLE[w.loc] ?? 180), w.loc)
    const broken = !weaponWorks(s, w) || (w.kind === 'bays' && s.crits.bays)
    if (isGun(w)) {
      const str = weaponStrength(s, w), reach = enemiesOf(game, s).filter(e => canTarget(game, s, w, e.pos)), aimed = typeof ui.shots[key] === 'number' ? shipByUid(game, ui.shots[key]) : null
      const why = broken ? 'it is damaged' : !reach.length ? `no enemy in its ${w.range} cm range and arc` : null
      list.push({ key: 'g-' + i, ...spot, label: `${word} ${str}${aimed ? ` → ${shortName(aimed)}` : String(ui.shots[key] ?? '').startsWith('o') ? ' → ordnance' : ''}`, why: s.fired ? 'It has fired this phase.' : why ? `Can't fire: ${why}.` : `${w.range} cm. Click, then click a Target pip to aim just this weapon.`, state: s.fired ? 'fired' : why ? 'off' : ui.gun === key ? 'picked' : undefined, lineTo: aimed && !s.fired ? aimed.pos : undefined,
        onHover: on => { ui.hoverWeapon = on ? i : null; renderBoard() }, onPress: () => { if (s.fired || why) return; ui.gun = ui.gun === key ? null : key; render() } })
    } else if (isTube(w)) {
      const why = broken ? 'its tubes are damaged' : !s.loaded.torpedo ? 'the tubes are empty: Reload Ordnance orders next turn' : w.kind === 'bio-torpedo' && s.loaded.tubes?.[i] === false ? 'this tube has been launched; it needs Reload Ordnance' : null
      list.push({ key: 't-' + i, ...spot, label: `Launch ${word.toLowerCase()} ${halved(w.str, ordnanceHalvings(s))}`, why: why ? `Can't launch: ${why}.` : `Speed ${w.range} cm. Click, swing the line with the mouse, then press Launch or right click.`, state: why ? 'off' : ui.torpAim === i ? 'picked' : undefined,
        onPress: () => { if (why) return; ui.boardT = false; ui.torpAim = ui.torpAim === i ? null : i; ui.torp = ui.torpAim === i && w.arc !== 'all' ? ARC_OF[w.arc[0]] ?? 0 : 0; render() } })
      // Concord tubes may fire boarding torpedoes instead (not both in one turn)
      if (raceRule(s.profile.fleet).boardingTorpedoes) list.push({ key: 'tb-' + i, ...spot, label: `Launch boarding torpedoes ${halved(w.str, ordnanceHalvings(s))}`, why: why ? `Can't launch: ${why}.` : `Boarding torpedoes: each hit is a Hit-and-Run attack at +1 instead of damage; they may turn 45 degrees each Ordnance Phase. Speed ${w.range} cm.`, state: why ? 'off' : ui.torpAim === i && ui.boardT ? 'picked' : undefined,
        onPress: () => { if (why) return; if (ui.torpAim === i && ui.boardT) { ui.torpAim = null; ui.boardT = false } else { ui.torpAim = i; ui.boardT = true } ui.torp = ui.torpAim === i && w.arc !== 'all' ? ARC_OF[w.arc[0]] ?? 0 : 0; render() } })
      if (ui.torpAim === i) { const end = along(s.pos, s.facing + ui.torp, w.range); list.push({ key: 'launch', label: 'Launch!', why: 'Launch the salvo along the line.', at: end, free: true, onPress: launchAimed }) }
    } else if (w.kind === 'bays' && !list.some(p => p.key === 'bays')) {
      const room = Math.min(baysOf(s) + [...(ui.combineC ?? [])].reduce((a, u) => a + baysOf(shipByUid(game, u)), 0), fleetCraftRoom(game, s.side)), why = broken ? 'the bays are damaged' : !s.loaded.bays ? 'the bays are empty: Reload Ordnance orders next turn' : room < 1 ? 'the fleet has all the attack craft in play its bays allow' : null
      list.push({ key: 'bays', ...spot, label: `Launch craft ${Math.max(0, room)}`, why: why ? `Can't launch: ${why}.` : 'Click, choose the squadrons, then Launch.', state: why ? 'off' : ui.craftAim ? 'picked' : undefined, onPress: () => { if (!why) { ui.craftAim = !ui.craftAim; render() } } })
      if (ui.craftAim && !why) {
        const n = launchable(game, s).reduce((a, t) => a + (ui.craft?.[t] ?? 0), 0)
        for (const t of launchable(game, s)) list.push({ key: 'c-' + t, ...stand(WEAPON_ANGLE[w.loc] ?? 180, w.loc), label: `+ ${t} ${ui.craft?.[t] ?? 0}`, why: `Add a squadron (${n} of ${room}). The side panel can change the numbers.`, state: n >= room ? 'off' : undefined, onPress: () => { if (n < room) { ui.craft = { ...(ui.craft ?? {}), [t]: (ui.craft?.[t] ?? 0) + 1 }; render() } } })
        if (n) list.push({ key: 'c-go', ...stand(WEAPON_ANGLE[w.loc] ?? 180, w.loc), label: `Launch ${n}!`, why: 'Launch them as one wave.', onPress: () => { const mix = { ...ui.craft }, combine = [...(ui.combineC ?? [])]; ui.craft = {}; ui.craftAim = false; ui.combineC = new Set(); act(() => launchCraft(game, s, mix, { combine })) } })
      }
    } else if (w.kind === 'starpulse') {   //
      const why = starPulseProblem(game, s), near = enemiesOf(game, s).filter(e => dist(e.pos, s.pos) <= w.range + 1e-6).length + game.ordnance.filter(o => o.side !== s.side && dist(o.pos, s.pos) <= w.range + 1e-6).length
      list.push({ key: 'pulse', ...spot, label: `Sun flare (${near})`, why: why ? `Can't pulse: ${why}.` : `Click: a pulse of energy ${w.range} cm around it, one D6 to hit every enemy ship (against the armour facing it) and a 4+ for every ordnance marker; other Katharos ships are safe, mirage fields do not save. ${near} in range now.`, state: why ? 'off' : undefined,
        onPress: () => { if (!why) act(() => fireStarPulse(game, s)) } })
    } else if (w.kind === 'ossuary') {   //
      const why = ossuaryProblem(game, s)
      list.push({ key: 'sep', ...spot, label: 'Ossuary', why: why ? `Can't unleash it: ${why}.` : `Click: sweep away ordnance within ${w.range} cm on 4+ (not ordinary torpedoes). Press an Ossuary pip on an enemy ship within ${w.range} cm to shake its crew as well.`, state: why ? 'off' : undefined,
        onPress: () => { if (!why) act(() => useOssuary(game, s, null)) } })
      if (!why) for (const e of enemiesOf(game, s).filter(e => dist(e.pos, s.pos) <= w.range + 1e-6)) {
        const d = FX.drawnAt('ship:' + e.uid, e.pos.x, e.pos.y, e.facing)
        list.push({ key: 'sep-' + e.uid, label: 'Ossuary', why: `${e.name} takes a Resolve Test: failed, Resolve -1 for good and no special orders (Brace included) until after its next turn. Ordnance within ${w.range} cm is swept on 4+.`, at: { x: d.x, y: d.y + baseR(e) + 1.6 }, className: 'pip-yellow',
          onPress: () => act(() => useOssuary(game, s, e.uid)) })
      }
    } else if (w.kind === 'sunburst') {
      const why = s.sunburstFired ? 'it has fired' : isCrippled(s) ? 'a crippled ship can\'t fire it' : broken ? 'the prow is damaged' : null
      list.push({ key: 'sunburst', ...spot, label: 'Sunburst cannon', why: why ? `Can't fire: ${why}.` : 'Click, then click the table where the shell should land.', state: why ? 'off' : ui.sunburst ? 'picked' : undefined, onPress: () => { if (!why) { ui.sunburst = !ui.sunburst; render() } } })
    }
  }
  // Planetary Assault
  if (game.sc?.id === 'assault' && s.side === game.attacker && inLowOrbit(s) && fromPlanetEdge(s) <= 30 && !s.fired && !(isEscort(s) && s.profile.role !== 'transport')) list.push({ key: 'land', ...stand(180, 'fire'), label: `Land troops +${s.profile.role === 'transport' ? 2 : 1}`, why: 'Assault points, and it does nothing else this turn.', onPress: () => act(() => landTroops(game, s.uid)) })
  // combining with squadron mates in base contact: a pip on each while aiming torpedoes or choosing craft
  for (const [kind, set, on] of [['torpedo', 'combineT', ui.torpAim != null], ['bays', 'combineC', ui.craftAim]]) if (on) for (const x of combinePartners(game, s, kind)) {
    const picked = ui[set]?.has(x.uid)
    list.push({ key: `comb-${kind}-${x.uid}`, label: picked ? 'Combined' : 'Combine', why: `${x.name} is in base contact: add its ${kind === 'torpedo' ? 'torpedoes to the salvo' : 'bays to the wave'}.`, at: { x: x.pos.x, y: x.pos.y - baseR(x) - 1.2 }, state: picked ? 'picked' : undefined, onPress: () => { ui[set] ??= new Set(); picked ? ui[set].delete(x.uid) : ui[set].add(x.uid); render() } })
  }
  if (!s.fired) {
    const gun = ui.gun && s.profile.weapons[+ui.gun.split(':')[1]]
    // ordnance can be shot at like a target, and needs no Resolve Test
    for (const o of game.ordnance.filter(o => o.side !== s.side && (o.kind !== 'wave' || !o.cap))) {
      const reaches = (x, w) => isGun(w) && canTarget(game, x, w, o.pos) && weaponWorks(x, w)
      if (!(gun ? reaches(s, gun) : mates(game, s).some(x => x.profile.weapons.some(w => reaches(x, w))))) continue
      const word = o.kind === 'wave' ? 'craft' : o.kind === 'mine' ? 'mine' : `torpedoes ${o.str}`, D2 = FX.drawnAt('ord:' + o.id, o.pos.x, o.pos.y)
      list.push({ key: 'xo-' + o.id, label: `Target ${word}`, why: `Aim ${gun ? 'this weapon' : 'every gun that can reach'} at it. Lances and batteries need 6s.`, at: { x: D2.x, y: D2.y - (o.r ?? 1) - 1 }, state: Object.values(ui.shots).includes('o' + o.id) ? 'picked' : undefined,
        onPress: () => { if (gun) { ui.shots[ui.gun] = 'o' + o.id; ui.gun = null } else for (const x of mates(game, s)) x.profile.weapons.forEach((w, i) => { if (reaches(x, w)) ui.shots[`${x.uid}:${i}`] = 'o' + o.id }); render() } })
    }
    for (const e of enemiesOf(game, s)) {
      const can = gun ? canTarget(game, s, gun, e.pos) : mates(game, s).some(x => x.profile.weapons.some(w => isGun(w) && canTarget(game, x, w, e.pos)))
      if (!can) continue
      const d = FX.drawnAt('ship:' + e.uid, e.pos.x, e.pos.y, e.facing)
      list.push({ key: 'x-' + e.uid, label: `Target · ${Math.round(dist(s.pos, e.pos))} cm`, why: gun ? `Aim this weapon at ${e.name}.` : `Aim every gun that can reach ${e.name} at it.`, at: { x: d.x, y: d.y - baseR(e) - 1.2 }, state: Object.values(ui.shots).includes(e.uid) ? 'picked' : undefined,
        onPress: () => { if (gun) { ui.shots[ui.gun] = e.uid; ui.gun = null } else for (const x of mates(game, s)) x.profile.weapons.forEach((w, i) => { if (isGun(w) && canTarget(game, x, w, e.pos) && weaponWorks(x, w)) ui.shots[`${x.uid}:${i}`] = e.uid }); render() } })
    }
    if (Object.values(ui.shots).some(v => v != null && v !== '')) list.push({ key: 'fire', label: 'Fire!', why: 'Fire the aimed guns, all together.', ...stand(180, 'fire'), className: 'is-picked', onPress: () => { ui.gun = null; pressSide('[data-fire]') } })
  }
  return list
}
const ARC_OF = { front: 0, right: 90, rear: 180, left: -90 }
function launchAimed () {
  const s = selectedShip(), i = ui.torpAim
  if (!s || i == null) return
  const combine = [...(ui.combineT ?? [])]; ui.combineT = new Set(); ui.torpAim = null
  const boarding = !!ui.boardT; ui.boardT = false
  act(() => launchTorpedoes(game, s, s.facing + ui.torp, { weapon: i, combine, boarding }))
}
// the rest of a ship's Manoeuvre Phase, on the ship: everything the side panel has but the typed legs
// And an "are you sure": it can't be taken back, and a pass takes the ship out of the battle
/** A legal move ending in base contact with `e`: straight, or a stretch, one turn and a run in. Null if there is none. */
function planToTouch (s, e) {
  const k = orderOf(s)
  if (k === 'newHeading' || k === 'burnRetros') return memoReach('ordered', s, e, () => searchBoard(s, e, k === 'newHeading' ? 2 : 1))   // an order already given: its turns
  if (game.sea) return planToReach(s, e)
  const empty = { a: 0, t1: 0, b: 0, t2: 0, c: 0, g1: 0, g2: 0 }, R = baseR(s) + baseR(e) - 0.3
  const works = p => { const c = checkMove(game, s, legsOf(p)); return c.ok && touching({ ...s, pos: c.path.end }, e) }
  const lim = checkMove(game, s, [])
  const ahead = dist(s.pos, e.pos) * Math.cos((angleTo(s.pos, e.pos) - s.facing) * Math.PI / 180)
  const straight = { ...empty, a: round1(Math.max(0, ahead - R * 0.9)) }
  if (works(straight)) return straight
  if (lim.turns < 1) return null
  for (let a = turnDistance(s); a <= lim.max + 1e-6; a += 1) {
    const A = along(s.pos, s.facing, a), Q = along(e.pos, angleTo(e.pos, A), R), t = norm(angleTo(A, Q) - s.facing)
    const plan = { ...empty, a: round1(a), t1: round1(t), b: round1(dist(A, Q)) }
    if (works(plan)) return plan
  }
  return null
}
function askDisengage (s) {
  showAsk({ side: s.side, title: `Disengage ${s.name}?`, text: 'A Resolve Test. Passed, the ship leaves the battle for good; failed, it can\'t fire, launch or take special orders this turn.', buttons: [{ label: 'Disengage', value: true, primary: true }, { label: 'Decline', value: false }] }, a => { if (a.value) act(() => disengage(game, s)) })
}
function movePips (s, at) {
  const list = [], up = x => statusBottom(x)   // the row under the ship, away from the Move pip above it
  if (s.id === 'fireship' || s.profile.fireShip) list.push({ key: 'detonate', label: 'Detonate', className: 'pip-yellow', why: 'D3 Fire criticals on every ship within 3D6 cm, friend or foe; escorts and ordnance there are destroyed.', at: up(s), onPress: () => act(() => detonateFireShip(game, s.uid)) })
  // the Phage: the Hunger may take the ship, Lost Scent says what it does otherwise, contact weapons may strike a ship already touching
  if (isPhage(s) && !s.movedThisPhase) {
    if (!controlled(game, s)) {
      const hives = scentHives(game, s), inst = s.instinct?.round === game.round ? s.instinct : null
      if (inst) list.push({ key: 'inst', label: `Instinct ${inst.cond}`, why: `Lost Scent, condition ${inst.cond}: ${inst.text}.`, at: up(s), state: 'off', onPress: () => {} })
      else if (game.sides[s.side].list === 'vanguard') list.push({ key: 'syn', label: 'Override instinct', why: 'The squadron tests its own Resolve, the ships left in it.', at: up(s), onPress: () => act(() => scent(game, s.uid)) })
      else for (const h of hives) list.push({ key: 'syn-' + h.uid, label: `Scent: ${shortName(h)}`, why: `${h.name} makes a Command check to take control of ${s.name}: passed, any special order with no second check; failed, that queen ship tries no more this turn.`, at: { x: up(s).x, y: up(s).y + 5 * hives.indexOf(h) }, onPress: () => act(() => scent(game, s.uid, h.uid)) })
      if (!inst && !hives.length && game.sides[s.side].list !== 'vanguard') list.push({ key: 'beginst', label: 'Instinct', why: 'No queen ship in reach: read the Lost Scent flowchart.', at: up(s), onPress: () => act(() => beginInstinct(game, s)) })
    }
    if (hasContactWeapons(s)) for (const e of enemiesOf(game, s)) if (touching(s, e)) list.push({ key: 'contact-' + e.uid, label: 'Tentacles / claws', why: `Attack ${e.name}, already touching, with feeder tentacles and massive claws, then still move.`, at: at(e), onPress: () => act(() => contactNow(game, s.uid, e.uid)) })
  }
  if (s.movedThisPhase) {
    if (s.profile.reactive && s.state === 'active') list.push({ key: 'fade', label: 'Fade out', className: 'pip-yellow', why: 'A Katharos ship may fade out at the end of its Manoeuvre Phase: it disengages automatically, no test. It counts for victory points by the Katharos percentages.', at: { x: at(s).x, y: at(s).y + 5.5 }, onPress: () => act(() => fadeOut(game, s)) })
    if (!s.disengageFailedRound && s.profile.speed > 0) list.push({ key: 'disengage', label: 'Disengage', className: 'pip-yellow', why: 'A Resolve Test: +1 for each Blast Marker within 5 cm, -1 for each enemy ship or ordnance marker within 15 cm. Passed, it leaves the battle; failed, it can\'t fire this turn.', at: at(s), onPress: () => askDisengage(s) })
    return list
  }
  const c = isSailor(s) ? {} : checkMove(game, s, [])   // a sailor has no legs to check: its sail is judged by sailOptions
  if (s.profile.speed > 0 && c.orbit) list.push({ key: 'orbit', label: 'Hold high orbit', why: 'Stay where it is, in orbit; it is shot at as a Defence.', at: up(s), onPress: () => { ui.plan = null; act(() => moveShip(game, s, [])) } })
  if (s.profile.speed > 0 && c.well && !isSailor(s)) list.push({ key: 'g1', label: `Gravity turn ${Math.round(c.well.max)}°`, why: `A free turn towards the ${c.well.planet.hulk ? 'derelict' : c.well.planet.moon ? 'moon' : 'planet'} before moving. Then press Move.`, at: up(s), state: ui.g1 ? 'picked' : undefined, onPress: () => { ui.g1 = ui.g1 ? 0 : c.well.sign * Math.floor(c.well.max); render() } })
  if (game.lowOrbit && s.profile.speed > 0 && !inLowOrbit(s) && wellsAt(game, s.pos).some(w => w.id === game.lowOrbit.planet)) list.push({ key: 'low', label: ui.lowEnter === s.uid ? 'Click the low orbit table' : 'Enter low orbit', why: 'Before it moves: it goes onto the low orbit table, at the edge furthest from the planet.', at: up(s), state: ui.lowEnter === s.uid ? 'picked' : undefined, onPress: () => { ui.lowEnter = ui.lowEnter === s.uid ? null : s.uid; render() } })
  for (const w of capOf(game, s)) list.push({ key: 'cap-' + w.id, label: 'Fighters leave CAP', why: 'At the start of your Manoeuvre Phase the fighters may leave combat air patrol.', at: up(s), onPress: () => act(() => releaseCap(game, w.id)) })
  // boarding range: a pip on every enemy a legal move can end touching; pressing it plans that move
  if (s.profile.speed > 0 && s.id !== 'spacehulk') for (const e of enemiesOf(game, s)) {
    const sail = isSailor(s), plan = sail ? planSailTouch(s, e) : planToTouch(s, e)   // an Athanatoi ship plans through sailOptions, never the legs
    if (!plan) {
      const o = !sail && orderBoardPlan(s, e)
      if (!o) continue
      const endurance = (e.marks ?? []).includes('endurance'), name = ORDERS[o.kind].name
      list.push({ key: 'boardorder-' + e.uid, label: `Board · ${name} ${Math.round(o.p * 100)}%`, at: at(e), state: endurance ? 'off' : undefined,
        why: endurance ? `${e.name} bears the Endurance Protocol and may not be boarded.` : `No plain move reaches ${e.name}. ${name}: ${o.text}. Pressing gives the order; if it passes, the ship ${o.kind === 'aheadFull' ? 'goes straight on the full distance it rolled (it boards only if that distance ends in reach)' : `moves ${round1(checkMove(game, { ...s, order: { kind: o.kind } }, legsOf(o.plan)).path.total)} cm`} and boards ${game.sea ? `from ${SEA_BOARD_RANGE} cm (Tides house rule)` : ''}; it can't fire or launch this turn.`,
        onPress: () => { if (!endurance) boardWithOrder(s, e, o) } })
      continue
    }
    const endurance = (e.marks ?? []).includes('endurance'), cm = sail ? plan.dist : checkMove(game, s, legsOf(plan)).path.total
    list.push({ key: 'boardgo-' + e.uid, label: `Board · ${Math.round(cm)} cm`, at: at(e), state: endurance ? 'off' : undefined,
      why: endurance ? `${e.name} bears the Endurance Protocol and may not be boarded.` : `Move ${round1(cm)} cm to ${game.sea ? `bring ${e.name} within ${SEA_BOARD_RANGE} cm of a side (Tides house rule)` : `touch ${e.name}`} and board it, now: this ship can't fire or launch this turn, and the fight is rolled in the End Phase.`,
      // pressing it makes the move straight away, rather than only planning it and waiting for a right click on the table
      onPress: () => { if (endurance) return; if (sail) { ui.plan = null; ui.move = null; ui.sail = { uid: s.uid, heading: plan.heading, want: plan.dist, dist: plan.dist, fixed: true, arc: null, endTurn: 0 }; ui.boarding = e.uid; return confirmSail() } ui.plan = plan; ui.planEdited = false; ui.move = { stage: 'done' }; ui.boarding = e.uid; doMove(s) } })
  }
  // ramming range: only what lies dead ahead, All Ahead Full makes no turns
  if (s.profile.fleet !== 'defence' && s.id !== 'spacehulk' && s.profile.speed > 0 && !isSailor(s)) {   // the Athanatoi cannot ram
    const locked = s.order ? `it is already on ${ORDERS[s.order.kind].name}` : game.ordersFailed[s.side] ? 'a Command check has failed this turn' : null
    for (const e of enemiesOf(game, s)) {
      const r = ramReach(s, e)
      if (!r) continue
      const test = ramTestDice(s, e)
      list.push({ key: 'ram-' + e.uid, label: `Ram · ${Math.round(r.cm)} cm${r.sure ? '' : '?'}`, at: at(e), className: r.sure ? '' : 'ram-far', state: locked ? 'off' : undefined,
        why: locked ? `Can't ram: ${locked}.` : `All Ahead Full at ${e.name}, ${round1(r.cm)} cm dead ahead. ${r.sure ? 'Any roll reaches it.' : `It must roll ${Math.ceil(r.need)} or more on ${r.dice}D6 to reach it.`} Then a Resolve Test on ${test}D6 to ram.`,
        onHover: on => { ui.hoverRam = on ? e.uid : null; renderBoard() }, onPress: () => { if (locked) return; ui.plan = null; ui.hoverRam = null; act(() => giveOrder(game, s, 'aheadFull', { ram: e.uid })) } })
    }
  }
  return list
}
// the scenario's own pips, whichever ship is selected: ships waiting at the edge, Contacts, ships on standby
function scenarioPips (at) {
  const list = [], g = game, seen = new Set()
  let n = 0
  for (const x of g.ships.filter(x => x.side === g.active && x.state === 'reserve')) {
    const e = entryFor(g, x)
    if (!e.segs) continue
    const sg = e.segs[0], mid = { x: (sg.a.x + sg.b.x) / 2, y: (sg.a.y + sg.b.y) / 2 }
    list.push({ key: 'on-' + x.uid, label: ui.entering === x.uid ? 'Click the green edge' : `Move on: ${shortName(x)}`, free: true, at: mid, px: { x: mid.x < 90 ? 70 : -70, y: n++ * 28 }, why: `${x.name} comes on from the edge: click this, then click the green edge.`, state: ui.entering === x.uid ? 'picked' : undefined, onPress: () => { ui.entering = ui.entering === x.uid ? null : x.uid; render() } })
  }
  if (g.sc.id === 'convoy' && g.active === g.attacker) for (const c of g.contacts.filter(c => !c.done && c.pos)) list.push({ key: 'contact-' + c.id, label: 'Turn over', why: 'At the start of your Manoeuvre Phase, turn over one Contact, two if a convoy ship is on special orders.', at: { x: c.pos.x, y: c.pos.y - 3 }, onPress: () => act(() => activateContact(g, c.id)) })
  for (const x of g.ships.filter(x => x.side === g.active && x.standby && x.state === 'active' && x.pos)) {
    const q = squadronOf(g, x)
    if (q && seen.has(q.id)) continue
    if (q) seen.add(q.id)
    list.push({ key: 'alert-' + x.uid, label: 'Go on alert', why: 'A Resolve Test: passed, it may act from now on, but no special orders this turn.', at: at(x), state: x.alertTried === g.round ? 'off' : undefined, onPress: () => { if (x.alertTried !== g.round) act(() => goOnAlert(g, x.uid)) } })
  }
  return list
}
/** A Board pip on every enemy the move in hand ends touching: the legs and the sail both use it. */
function boardChoicePips (s, end, facing = s.facing) {
  const list = [], me = { ...s, pos: end, facing }
  let n = 0
  for (const e of enemiesOf(game, s)) {
    if (!canBoardFrom(game, me, e)) continue
    const endurance = (e.marks ?? []).includes('endurance')
    // beside where the move ends, square to its heading, so it can be reached and clicked. The line
    // follows the mouse by how far ahead it is, so a hand going sideways to this pip leaves the move, and the pip, where they
    // are; on the far side of the enemy the move chased the mouse and the pip ran away. More than one: alternate sides.
    const side = n % 2 ? -1 : 1, at = along(end, facing + 90 * side, baseR(s) + 3 + Math.floor(n / 2) * 3); n++
    list.push({ key: 'board-' + e.uid, label: ui.boarding === e.uid ? 'Boarding!' : 'Board', free: true, at,
      why: endurance ? `${e.name} bears the Endurance Protocol and may not be boarded.` : `Board ${e.name}: it can't fire or launch this turn, and the fight is rolled in the End Phase. Right click to make the move.`,
      state: endurance ? 'off' : ui.boarding === e.uid ? 'picked' : undefined, onPress: () => { if (endurance) return; ui.boarding = ui.boarding === e.uid ? null : e.uid; renderPips() } })
  }
  if (ui.boarding != null && !list.some(p => p.key === 'board-' + ui.boarding)) ui.boarding = null   // the plan no longer ends touching it
  return list
}
function boardPips (s) {
  const cm = checkMove(game, s, legsOf(ui.plan)), end = cm.path.end, list = boardChoicePips(s, end, cm.path.facing)
  // A gravity well's free turn at the end of the move
  const c = checkMove(game, s, legsOf(ui.plan)), bare = c.path.facing - (ui.plan.g2 || 0), w = wellTurn(game, end, bare)
  if (w) list.push({ key: 'g2', label: `Gravity turn ${Math.round(w.max)}°`, free: true, at: along(end, bare + 180, baseR(s) + 2), px: { x: 0, y: 26 }, why: `A free turn towards the ${w.planet.hulk ? 'derelict' : w.planet.moon ? 'moon' : 'planet'} at the end of the move.`, state: ui.plan.g2 ? 'picked' : undefined, onPress: () => { ui.plan.g2 = ui.plan.g2 ? 0 : w.sign * Math.floor(w.max); renderBoard(); renderPips() } })
  else ui.plan.g2 = 0
  return list
}
// a picked wave's targets within its reach: Patrol over your own ships (fighters), Intercept enemy ordnance
// (fighters), Attack enemy ships (bombers and assault boats). Clicking the table still moves it anywhere.
function wavePips (w) {
  if (!w || w.moved) return []
  const list = [], sp = waveSpeed(w), fighters = hasFighter(w), allFighters = w.markers.every(t => rowOf(w.fleet, t)?.acts.includes('fighter')), harmless = !canAttackShip(w)
  const go = fn => { ui.wave = null; act(fn) }
  const off = (r, y) => ({ x: r.x, y: r.y - y })
  const near = (p, r) => dist(w.pos, p) - r - w.r <= sp + 1e-6
  for (const s of game.ships.filter(s => s.side === w.side && s.state === 'active' && s.pos && allFighters && near(s.pos, baseR(s)))) list.push({ key: 'patrol-' + s.uid, label: 'Patrol', why: `Combat air patrol over ${s.name}: the fighters move with it and stop one attacker each, before its turrets fire.`, at: off(s.pos, baseR(s) + 1.2), onPress: () => go(() => moveWave(game, w.id, s.pos, { cap: s.uid })) })
  if (fighters) for (const o of game.ordnance.filter(o => o.side !== w.side && near(o.pos, o.r ?? 1))) list.push({ key: 'intercept-' + o.id, label: 'Intercept', why: `Fighters attack ${o.kind === 'wave' ? 'the enemy wave' : o.kind === 'mine' ? 'the mine' : 'the torpedo salvo'}: each fighter and its victim are removed.`, at: off(o.pos, (o.r ?? 1) + 1), onPress: () => go(() => moveWave(game, w.id, o.pos)) })
  if (!harmless) for (const e of game.ships.filter(s => s.side !== w.side && s.state === 'active' && s.pos && near(s.pos, baseR(s)))) list.push({ key: 'attack-' + e.uid, label: 'Attack', why: `The wave attacks ${e.name}: its turrets fire first, then bombers and assault boats.`, at: off(e.pos, baseR(e) + 1.2), onPress: () => go(() => moveWave(game, w.id, e.pos)) })
  // torpedo bombers: swap for a Strength 2 salvo each at the start of an Ordnance Phase, not the one they were launched in
  if (game.phase === 'ordnance' && w.markers.some(t => rowOf(w.fleet, t)?.torpedoOnly)) for (const e of game.ships.filter(s => s.side !== w.side && s.state === 'active' && s.pos)) list.push({ key: 'torp-' + e.uid, label: 'Torpedoes', why: `The torpedo bombers become a salvo of Strength 2 each heading for ${e.name}; it moves now and is gone at the end of the phase.`, at: off(e.pos, baseR(e) + 1.2), onPress: () => go(() => convertTorpedoBombers(game, w.id, angleTo(w.pos, e.pos))) })
  return list
}
// A Teleport pip on each enemy a ship of yours can reach, a line back to the ship; one a ship each turn
function teleportPips () {
  const list = [], seen = {}, greyed = []
  for (const a of game.ships.filter(x => x.side === game.active && x.state === 'active' && x.pos)) for (const t of enemiesOf(game, a)) {
    const no = canTeleport(game, a, t)
    if (no) {   // close enough to want to, but a rule stops it: greyed, and it says which
      if (isCapital(a) && dist(a.pos, t.pos) <= 10 && !seen['no' + t.uid]) { seen['no' + t.uid] = true; greyed.push({ key: 'tpno-' + t.uid, label: 'Teleport', free: true, at: { x: t.pos.x, y: t.pos.y - baseR(t) - 1.2 }, px: { x: 0, y: -14 }, state: 'off', why: `${shortName(a)} can't teleport to ${shortName(t)}: ${no}.`, target: t.uid, onPress: () => {} }) }
      continue
    }
    const key = `${a.uid}:${t.uid}`, on = ui.teleports.has(key), n = seen[t.uid] = (seen[t.uid] ?? -1) + 1
    list.push({ key: 'tp-' + key, label: on ? `Teleporting: ${shortName(a)}` : `Teleport: ${shortName(a)}`, free: true, at: { x: t.pos.x, y: t.pos.y - baseR(t) - 1.2 }, px: { x: 0, y: -14 - n * 28 }, lineTo: a.pos,
      why: `${a.name} sends a Hit-and-Run attack across to ${t.name} in the End Phase: a D6, 1 fails, 2-6 that critical hit; an escort is destroyed on 4+. One a ship each turn.`, state: on ? 'picked' : undefined,
      onPress: () => { for (const k of [...ui.teleports]) if (k.startsWith(a.uid + ':') && k.split(':').length === 2) ui.teleports.delete(k); if (!on) ui.teleports.add(key); render() } })
    // Deepflesh boarding parties and a Prime Guard are extra teleport attacks, each once a turn, in addition to the normal one
    for (const [kind, label, text] of [['deepflesh', 'Deepflesh Dyads', 'two dice, both results apply, +1 each for Concord'], ['honour', 'Prime Guard', 'two dice, you choose which to use, +1 for Concord']]) {
      if (!hasUp(a, kind)) continue
      const k2 = `${a.uid}:${t.uid}:${kind}`, on2 = ui.teleports.has(k2), m = seen[t.uid] = (seen[t.uid] ?? -1) + 1
      list.push({ key: 'tp-' + k2, label: on2 ? `${label}: ${shortName(a)}` : `${label}: ${shortName(a)}?`, free: true, at: { x: t.pos.x, y: t.pos.y - baseR(t) - 1.2 }, px: { x: 0, y: -14 - m * 28 }, lineTo: a.pos,
        why: `${a.name}'s ${label} go across to ${t.name} in the End Phase, in addition to a normal teleport attack: ${text}. Once a turn.`, state: on2 ? 'picked' : undefined,
        onPress: () => { for (const k of [...ui.teleports]) if (k.startsWith(a.uid + ':') && k.endsWith(':' + kind)) ui.teleports.delete(k); if (!on2) ui.teleports.add(k2); render() } })
    }
  }
  // Each portal is one more Hit-and-Run attack at 10 cm against a ship with its shields down, on any special order; click to add one, again to add another, until all are used, then once more to clear
  for (const a of game.ships.filter(x => x.side === game.active && x.state === 'active' && x.pos && portalCount(x) > 0)) for (const t of enemiesOf(game, a)) {
    if (portalProblem(game, a, t, 0)) continue
    const mine = k => k.startsWith(`${a.uid}:`) && k.split(':')[2] === 'portal', here = k => k.startsWith(`${a.uid}:${t.uid}:portal`)
    const used = [...ui.teleports].filter(mine).length, onHere = [...ui.teleports].filter(here).length, n = portalCount(a)
    list.push({ key: `pt-${a.uid}:${t.uid}`, label: `Portal ×${onHere}/${n}: ${shortName(a)}`, free: true, at: { x: t.pos.x, y: t.pos.y + baseR(t) + 1.6 }, lineTo: a.pos,
      why: `${a.name} has ${n} portal${n === 1 ? '' : 's'}: each is a Hit-and-Run attack on ${t.name} in the End Phase, in addition to a normal teleport. Click to send one, again to send another; ${used} of ${n} used.`, state: onHere ? 'picked' : undefined,
      onPress: () => { if (used < n) ui.teleports.add(`${a.uid}:${t.uid}:portal:${onHere}`); else for (const k of [...ui.teleports].filter(here)) ui.teleports.delete(k); render() } })
  }
  return [...list, ...greyed.filter(g => !list.some(p => p.key.endsWith(':' + g.target)))]
}
function pressSide (sel) { const b = document.querySelector(sel); if (b && !b.disabled) b.click() }
function renderPips () {
  if (!pips) pips = createActionPips({ host: $('boardwrap'), canvas: $('board'), toScreen: toScreenPx, screens: ['setup'] })
  const list = [], s = selectedShip()
  if (!game || game.over || game.phase === 'setup' || FX.gliding() || FX.busy() || Guns.turning()) { pips.set([]); return }   // nothing over the table while ships glide or shots play
  const at = x => { const t = statusTop(x); return { x: t.x, y: t.y - 0.6 } }   // over the hit and shield rows
  if (s && mine(s) && s.state === 'active' && !s.standby) {
    // the line follows the mouse: nothing in its way but a Board pip, on the far side of any enemy the move ends touching
    if (isSailor(s) && sailing() && ['movement', 'ordnance'].includes(game.phase)) { pips.set(sailPips(s)); return }   // the sail in hand
    if (game.phase === 'movement' && !s.movedThisPhase && ui.move) { pips.set(boardPips(s)); return }
    if (isSailor(s) && s.profile.speed > 0 && sailTurn(s)) {   // the Move pip for the first move, and again for the second in the Ordnance Phase (greyed with the reason until it may)
      const t = sailTurn(s)
      list.push({ key: 'move', label: t.when === 'second' ? 'Second move' : 'Move', state: t.why ? 'off' : undefined, why: t.why ? `Can't make its second move yet: ${t.why}.` : sailWhy(s), at: at(s), onPress: () => { if (!t.why) startSail(s) } })
    } else if (game.phase === 'movement' && !s.movedThisPhase && s.profile.speed > 0) {
      list.push({ key: 'move', label: 'Move', why: 'A green line follows the mouse: click to fix how far before the turn, click to fix the turn, click to fix the run ahead. Right click at any point goes. Esc cancels.', at: at(s), onPress: () => startMove(s) })
    }
    if (game.phase === 'movement') list.push(...movePips(s, at))
    if (game.phase === 'movement' && !s.movedThisPhase && !s.order && !game.ordersFailed[s.side] && s.profile.fleet !== 'defence') {
      for (const [k, o] of Object.entries(ORDERS)) if (k !== 'brace' && document.querySelector(`[data-order="${k}"]`)) list.push({ key: 'o-' + k, label: o.name, className: 'pip-blue', why: `Special order: a Command check on 2D6 against Resolve ${leadershipOf(s)}.`, at: statusBottom(s), onPress: () => pressSide(`[data-order="${k}"]`) })
    }
    if (game.phase === 'shooting') list.push(...weaponPips(s))
  }
  if (game.phase === 'movement' && game.sc) list.push(...scenarioPips(at))
  if (game.phase === 'ordnance') list.push(...teleportPips())
  if (game.phase === 'ordnance' && ui.wave != null) list.push(...wavePips(game.ordnance.find(o => o.id === ui.wave)))
  if (game.phase === 'ordnance') for (const m of game.ordnance.filter(o => o.kind === 'torpedo' && o.missile && !o.moved)) {
    const d = FX.drawnAt('ord:' + m.id, m.pos.x, m.pos.y), on = ui.missile === m.id
    list.push({ key: 'm-' + m.id, label: on ? 'Click where it goes' : 'Steer missiles', free: true, state: on ? 'picked' : undefined, at: { x: d.x, y: d.y - 2 },
      why: `${game.sides[m.side].name}'s Isos missile salvo, strength ${m.str}: click, then click where it goes. It flies 20-40 cm (the distance to your click), and may turn up to 45 degrees${m.movedOnce ? '' : ' (not in the phase it was launched)'}; unsteered it flies 20 cm straight on.`,
      onPress: () => { ui.missile = on ? null : m.id; render() } })
  }
  if (game.phase === 'ordnance' && ui.wave == null) for (const w of game.ordnance.filter(o => o.kind === 'wave' && !o.moved)) {
    const d = FX.drawnAt('ord:' + w.id, w.pos.x, w.pos.y)
    list.push({ key: 'w-' + w.id, label: 'Move wave', why: `${game.sides[w.side].name}'s ${w.markers.join(', ')}: click, then click where it goes (${waveSpeed(w)} cm).`, at: { x: d.x, y: d.y - w.r - 1 }, onPress: () => { ui.wave = w.id; render() } })
  }
  pips.set(list)
}

// ---------------- input ----------------
function toCm (e) {
  const svg = $('board'), pt = svg.createSVGPoint()
  pt.x = e.clientX; pt.y = e.clientY
  const p = pt.matrixTransform(svg.getScreenCTM().inverse())
  if (game?.lowOrbit && p.y > LOW_SHOW - 3) return { x: p.x - LOW_DX, y: p.y - LOW_DY }   // a click on the low orbit table
  return { x: p.x, y: p.y }
}
$('board').addEventListener('click', e => {
  if (!game || game.over) return
  const P = toCm(e)
  const shipEl = e.target.closest('[data-ship]'), ordEl = e.target.closest('[data-ord]')
  const clicked = shipEl ? shipByUid(game, +shipEl.dataset.ship) : null
  if (game.phase === 'setup') {
    const said = r => { if (!r.ok) game.log.push({ text: r.reason }) }
    if (game.sc?.id === 'convoy' && game.setupStep === 'contacts') return act(() => said(placeContact(game, P)))
    if (game.sc?.id === 'convoy' && game.setupStep === 'entry') return act(() => said(setConvoyEntry(game, P)))
    if (game.sc?.id === 'escalating' && game.setupStep === 'markers') return act(() => said(placeMarker(game, P)))
    if (setupDone() || !placing()) return
    ui.ghost = { p: P, pinned: true }   // left click holds the shadow there; right click puts it down
    return renderGhost()
  }
  if (ui.sail) {   // the Athanatoi's sail: a click fixes it, another frees it again
    if (sailing()) { const was = ui.sail.fixed; ui.sail.fixed = false; steerSail(P); ui.sail.fixed = !was; renderBoard(); renderPips() }
    return
  }
  if (ui.entering != null && game.phase === 'movement') { const uid = ui.entering; ui.entering = null; ui.selected = uid; ui.plan = null; return act(() => enterShip(game, uid, P)) }
  if (ui.lowEnter != null && game.phase === 'movement') { const s = shipByUid(game, ui.lowEnter); ui.lowEnter = null; return act(() => enterLowOrbit(game, s, P.y > LOW.y0 - 5 ? P.x : LOW.w / 2)) }
  const waveEl = e.target.closest('[data-wave]')
  if (game.phase === 'ordnance') {
    if (ui.missile != null) { const id = ui.missile; ui.missile = null; return act(() => moveMissile(game, id, P)) }   // Isos missiles: click where the salvo goes, 20-40 cm, 45 degrees
    if (waveEl) { ui.wave = +waveEl.dataset.wave; return render() }
    if (ui.wave != null) {
      const id = ui.wave, w = game.ordnance.find(o => o.id === id); ui.wave = null
      // clicking a friendly ship with a fighter wave puts it on combat air patrol
      if (clicked && w && clicked.side === w.side) return act(() => moveWave(game, id, clicked.pos, { cap: clicked.uid }))
      return act(() => moveWave(game, id, P))
    }
  }
  if (ui.move && game.phase === 'movement') { steerMove(P); return nextMoveStage() }   // a click fixes this stage of the move
  const sel = selectedShip()
  if (ui.sunburst && sel) { ui.sunburst = false; return act(() => fireSunburst(game, sel, P)) }
  if (ui.slide && sel) { ui.slide = false; return act(() => lumpSlide(game, sel, angleTo(sel.pos, P))) }   // The click gives the bearing
  if (ui.sproglance && sel) {
    if (clicked && clicked.side !== sel.side) { ui.sproglance = false; return act(() => fireSproglance(game, sel, clicked)) }   //
    return render()
  }
  if (game.phase === 'shooting' && sel && mine(sel) && !sel.fired) {
    if (clicked && clicked.side !== sel.side && ui.gun) {   // the picked weapon only
      const w = sel.profile.weapons[+ui.gun.split(':')[1]]
      if (canTarget(game, sel, w, clicked.pos)) { ui.shots[ui.gun] = clicked.uid; ui.gun = null }
      return render()
    }
    if (clicked && clicked.side !== sel.side) {   // aim every weapon that can reach it at it
      for (const x of mates(game, sel)) x.profile.weapons.forEach((w, i) => { if (isGun(w) && canTarget(game, x, w, clicked.pos) && weaponWorks(x, w)) ui.shots[`${x.uid}:${i}`] = clicked.uid })
      return render()
    }
    const tgtOrd = ordEl ?? e.target.closest('[data-wave]')
    if (tgtOrd) { const o = game.ordnance.find(x => x.id === +(tgtOrd.dataset.ord ?? tgtOrd.dataset.wave)); for (const x of mates(game, sel)) x.profile.weapons.forEach((w, i) => { if (isGun(w) && canTarget(game, x, w, o.pos)) ui.shots[`${x.uid}:${i}`] = 'o' + o.id }); return render() }
  }
  if (clicked) { if (ui.selected !== clicked.uid) { const same = sel && squadronOf(game, sel) && squadronOf(game, sel) === squadronOf(game, clicked); ui.selected = clicked.uid; ui.plan = null; ui.move = null; ui.sail = null; ui.g1 = 0; ui.lowEnter = null; ui.planEdited = false; if (!same) ui.shots = {}; ui.torp = 0; ui.boarding = null; ui.gun = null; ui.torpAim = null; ui.craftAim = false } return render() }
})
$('actions').addEventListener('click', e => {
  const b = e.target.closest('button')
  if (!b || b.disabled) return
  const s = selectedShip()
  if (b.dataset.first != null) return act(() => startBattle(game, +b.dataset.first))
  if (b.dataset.buy != null) return act(() => { const r = buyDefence(game, b.dataset.buy, b.dataset.buy === 'isos-orbital-core' ? { modules: ui.modules.filter(Boolean) } : {}); if (!r.ok) game.log.push({ text: r.reason }) })
  if (b.dataset.guard != null) return act(() => { guardOrbital(game, +document.querySelector(`[data-guardsel="${b.dataset.guard}"]`).value, +b.dataset.guard) })
  if (b.dataset.rotate != null) { const f = nextPlace(); return act(() => { const r = setRotates(game, f, b.dataset.rotate === '1'); if (!r.ok) game.log.push({ text: r.reason }) }) }
  if (b.dataset.sell != null) return act(() => sellDefence(game, +b.dataset.sell))
  if (b.dataset.donebuy != null) return act(() => doneBuying(game))
  if (b.dataset.detonate != null) return act(() => detonateFireShip(game, +b.dataset.detonate))
  if (b.dataset.assign != null) {
    const id = +b.dataset.assign, type = document.querySelector(`[data-ctype="${id}"]`).value, n = +(document.querySelector(`[data-cn="${id}"]`)?.value ?? 1)
    return act(() => { const r = assignContact(game, id, Array(Math.max(1, n)).fill(type)); if (!r.ok) game.log.push({ text: r.reason }) })
  }
  if (b.dataset.enter != null) { ui.entering = ui.entering === +b.dataset.enter ? null : +b.dataset.enter; return render() }
  if (b.dataset.reveal != null) return act(() => activateContact(game, +b.dataset.reveal))
  if (b.dataset.alert != null) return act(() => goOnAlert(game, +b.dataset.alert))
  if (b.dataset.lowenter != null) { ui.lowEnter = ui.lowEnter === +b.dataset.lowenter ? null : +b.dataset.lowenter; return render() }
  if (b.dataset.harpoon != null) return act(() => launchHarpoon(game, s))
  if (b.dataset.land != null) return act(() => landTroops(game, +b.dataset.land))
  if (b.id === 'next') { ui.move = null; ui.gun = null; ui.torpAim = null; ui.craftAim = false; ui.wave = null; ui.plan = null; ui.shots = {}; ui.sunburst = false; const teleports = [...ui.teleports].map(k => k.split(':').map((v, i) => i < 2 ? +v : v)); ui.teleports.clear(); return act(() => nextPhase(game, { teleports })) }
  if (b.dataset.order) {
    const ram = b.dataset.withram != null ? ($('ram').value ? +$('ram').value : null) : null
    ui.plan = null; ui.move = null
    const pair = s.fort && $('together')?.value ? { together: fortTogether(game, s, [+$('together').value]) } : {}
    return act(() => giveOrder(game, s, b.dataset.order, ram != null ? { ram } : b.dataset.leech != null ? { leech: true } : pair))
  }
  if (b.dataset.sailstart != null) return startSail(s)
  if (b.dataset.sailgo != null) return confirmSail()
  if (b.dataset.sailcancel != null) return cancelSail()
  if (b.dataset.move != null) return doMove(s)
  if (b.dataset.disengage != null) return askDisengage(s)
  if (b.dataset.dockhalt != null) { ui.plan = null; return act(() => moveShip(game, s, [])) }
  if (b.dataset.orbit != null) { ui.plan = null; return act(() => moveShip(game, s, [])) }
  if (b.dataset.fire != null) {
    const shots = Object.entries(ui.shots).filter(([, t]) => t != null && t !== '').map(([k, t]) => { const [uid, i] = k.split(':').map(Number); return { ship: uid, weapon: i, target: String(t).startsWith('o') ? { ordnance: +String(t).slice(1) } : +t } })
    ui.shots = {}
    return act(() => shots.length ? fireShip(game, s, shots) : (mates(game, s).forEach(x => { x.fired = true }), game.log.push({ text: `${mates(game, s).length > 1 ? 'The squadron' : s.name} holds fire` })))
  }
  if (b.dataset.sunburst != null) { ui.sunburst = !ui.sunburst; return render() }
  if (b.dataset.slide != null) { ui.slide = !ui.slide; return render() }
  if (b.dataset.sproglance != null) { ui.sproglance = !ui.sproglance; return render() }
  if (b.dataset.pickwave != null) { ui.wave = +b.dataset.pickwave; return render() }
  if (b.dataset.leavecap != null) return act(() => releaseCap(game, +b.dataset.leavecap))
  if (b.dataset.launch != null) { const combine = [...(ui.combineT ?? [])]; ui.combineT = new Set(); const boarding = !!ui.boardT; ui.boardT = false; return act(() => launchTorpedoes(game, s, s.facing + ui.torp, { combine, boarding })) }
  if (b.dataset.launchmines != null) return act(() => launchMines(game, s))
  if (b.dataset.launchcraft != null) { const mix = { ...(ui.craft ?? {}) }, combine = [...(ui.combineC ?? [])]; ui.craft = {}; ui.combineC = new Set(); return act(() => launchCraft(game, s, mix, { combine })) }
})
$('actions').addEventListener('change', e => {
  const t = e.target
  if (t.dataset.mod != null) { ui.modules[+t.dataset.mod] = t.value; return render() }
  if (t.dataset.plan) { ui.plan[t.dataset.plan] = +t.value || 0; ui.planEdited = true; ui.move = null; return render() }
  if (t.dataset.shot) { ui.shots[t.dataset.shot] = t.value === '' ? null : (t.value.startsWith('o') ? t.value : +t.value); return render() }
  if (t.dataset.craft) { ui.craft = { ...(ui.craft ?? {}), [t.dataset.craft]: +t.value || 0 }; return }
  if (t.dataset.boardt != null) { ui.boardT = t.checked; return }
  if (t.dataset.tele) { t.checked ? ui.teleports.add(t.dataset.tele) : ui.teleports.delete(t.dataset.tele); return }
  if (t.id === 'boardSel') ui.boarding = t.value
  if (t.dataset.combt != null) { ui.combineT ??= new Set(); t.checked ? ui.combineT.add(+t.dataset.combt) : ui.combineT.delete(+t.dataset.combt); return render() }
  if (t.dataset.combc != null) { ui.combineC ??= new Set(); t.checked ? ui.combineC.add(+t.dataset.combc) : ui.combineC.delete(+t.dataset.combc); return render() }
})
$('actions').addEventListener('input', e => { if (e.target.dataset.torp != null) { ui.torp = +e.target.value; renderBoard(); const span = e.target.nextElementSibling; span.textContent = ui.torp > 0 ? ui.torp + '° starboard' : ui.torp < 0 ? -ui.torp + '° port' : 'dead ahead' } })
$('actions').addEventListener('mouseover', e => { const r = e.target.closest('[data-weapon-row]'); const w = r ? +r.dataset.weaponRow : null; if (w !== ui.hoverWeapon) { ui.hoverWeapon = w; renderBoard() } })

// ---------------- zoom and pan: the mouse wheel zooms on the cursor, a right-button drag pans, Fit shows it all ----------------
const FULL = { x: -2, y: -2, w: 184, h: 124 }   // the table and a 2 cm margin; begin sets it to the game's table (the sea's is bigger, rules/game.js SEA_TABLE)
let view = { ...FULL }
const setView = v => {
  v.w = Math.max(20, Math.min(FULL.w, v.w)); v.h = v.w * FULL.h / FULL.w
  v.x = Math.max(FULL.x - v.w * 0.25, Math.min(FULL.x + FULL.w - v.w * 0.75, v.x)); v.y = Math.max(FULL.y - v.h * 0.25, Math.min(FULL.y + FULL.h - v.h * 0.75, v.y))
  view = v; $('board').setAttribute('viewBox', `${v.x} ${v.y} ${v.w} ${v.h}`)
  pips?.place()
}
$('board').addEventListener('wheel', e => {
  e.preventDefault()
  const P = toCm(e), k = e.deltaY > 0 ? 1.15 : 1 / 1.15
  leaveCamera()
  setView({ x: P.x - (P.x - view.x) * k, y: P.y - (P.y - view.y) * k, w: view.w * k, h: view.h * k })
}, { passive: false })
let pan = null
$('board').addEventListener('contextmenu', e => e.preventDefault())
let swing = false   // the middle button held: the ship being placed turns freely towards the mouse
$('board').addEventListener('mousedown', e => {
  if (e.button === 2) pan = { cx: e.clientX, cy: e.clientY, v: { ...view }, k: view.w / $('board').clientWidth, moved: false }
  if (e.button === 1 && placing()) {
    e.preventDefault()
    const s = placing()
    if (facingLock(s)) return turnPlacing(0)
    swing = true
    if (ui.ghost.p) ui.ghost.pinned = true
  }
})
$('board').addEventListener('mousemove', e => {
  if (game) lastMouse = toCm(e)
  // aiming torpedoes: the line swings to the mouse, inside the tubes' arc
  if (game && ui.torpAim != null && game.phase === 'shooting') {
    const s = selectedShip(), w = s?.profile.weapons[ui.torpAim]
    if (s && w) {
      const want = norm(angleTo(s.pos, toCm(e)) - s.facing), mid = w.arc === 'all' ? want : ARC_OF[w.arc.reduce((a, b) => Math.abs(norm(want - ARC_OF[b])) < Math.abs(norm(want - ARC_OF[a])) ? b : a)]
      ui.torp = mid + Math.max(-45, Math.min(45, norm(want - mid))); renderBoard(); renderPips()
    }
    return
  }
  if (game && ui.sail) return sailing() ? steerSail(toCm(e)) : undefined
  if (game && ui.move && game.phase === 'movement') return steerMove(toCm(e))
  if (!game || !placing()) return
  const P = toCm(e)
  if (swing && ui.ghost.p) { ui.facing = angleTo(ui.ghost.p, P); return renderGhost() }
  if (!ui.ghost.pinned) { ui.ghost.p = P; renderGhost() }
})
$('board').addEventListener('mouseleave', () => { if (game && !ui.ghost.pinned) { ui.ghost.p = null; renderGhost() } })
// the ship under the mouse goes on the card (renderHud); only the card is redrawn, never the board
$('board').addEventListener('mousemove', e => {
  if (!game) return
  const el = e.target.closest?.('[data-ship]'), uid = el ? +el.dataset.ship : null
  if (uid !== ui.hover) { ui.hover = uid; renderHud() }
})
$('board').addEventListener('mouseleave', () => { if (game && ui.hover != null) { ui.hover = null; renderHud() } })
addEventListener('mousemove', e => {
  if (!pan) return
  if (Math.hypot(e.clientX - pan.cx, e.clientY - pan.cy) > 5) { pan.moved = true; leaveCamera() }
  if (pan.moved) setView({ ...pan.v, x: pan.v.x - (e.clientX - pan.cx) * pan.k * (FULL.w / FULL.w), y: pan.v.y - (e.clientY - pan.cy) * pan.k })
})
addEventListener('mouseup', e => {
  swing = false
  const p = pan; pan = null
  // a right click that didn't drag: the same button pans, so it is judged on release
  if (e.button === 2 && p && !p.moved && e.target.closest?.('#board') && placing()) commitPlacing(toCm(e))
  else if (e.button === 2 && p && !p.moved && e.target.closest?.('#board') && ui.torpAim != null) launchAimed()
  else if (e.button === 2 && p && !p.moved && e.target.closest?.('#board') && ui.sail) confirmSail()
  else if (e.button === 2 && p && !p.moved && e.target.closest?.('#board') && ui.move) confirmMove()
})
addEventListener('keyup', e => { held.delete(e.code) })
addEventListener('blur', () => held.clear())
addEventListener('keydown', e => {
  if (e.target.closest?.('input, select, textarea')) return
  if (PAN_KEYS[e.code] && game && !$('battle').hidden) { e.preventDefault(); held.add(e.code); leaveCamera(); return kick() }
  if (e.key === 'f') { leaveCamera(); setView({ ...FULL }) }
  if ((e.key === 'm' || e.key === 'M') && game) toggleSound()
  if ((e.key === 'g' || e.key === 'G') && game) { ui.grid = !ui.grid; store.set('grid', ui.grid ? '1' : '0'); renderBoard() }
  if (e.key === 'q' || e.key === 'Q') turnPlacing(-15)   // 15° a press, either way
  if (e.key === 'e' || e.key === 'E') turnPlacing(15)
  if (e.key === 'Escape' && placing()) { ui.ghost.pinned = false; renderGhost() }
  if (e.key === 'Escape' && ui.sail) cancelSail()
  if (e.key === 'Escape' && ui.move) cancelMove()
})

renderSetup()
goTitle()
// HOVER HELP: anything with data-tip
// (the hit plates, shield crests, mirage field and effect icons, on the board and the card) shows its text beside the mouse at once. The board
// redraws many times a second, which kills the browser's own slow <title> tooltips, so this follows the mouse instead.
const tipBox = Object.assign(document.createElement('div'), { className: 'board-tip' })
tipBox.hidden = true
document.body.append(tipBox)
addEventListener('mousemove', e => {
  const t = e.target.closest?.('[data-tip]')
  if (!t) { tipBox.hidden = true; return }
  tipBox.textContent = t.dataset.tip; tipBox.hidden = false
  const w = tipBox.offsetWidth, h = tipBox.offsetHeight
  tipBox.style.left = `${Math.min(innerWidth - w - 8, e.clientX + 16)}px`; tipBox.style.top = `${Math.min(innerHeight - h - 8, e.clientY + 18)}px`
})
if (SEA) { seaCss(); FX.setSea(true) }   // the sea's own shots (battle/fx.js seaPlay)
