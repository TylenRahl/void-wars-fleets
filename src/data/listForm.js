// Turns the set-up page's fleet form into the list that rules/fleet.js createFleetBattle takes. Exports listFromForm and SQUADRON_ROLES.
// Used by battle.js and the computer opponent's tests, so they can both build the same battles headless. No page state: everything comes in.
// Form: { fleet, list?, cmd, rerolls, marks, squads: [ids], ships: [{ id, squad, flag?, picks?, up?, lord?, csq? }], commands?, hooks?, ordnance? }
import { ALL_SHIPS, shipById } from './ships.js'
import { hasLists, listsOf, listDef, resolveShipId } from './fleetLists.js'
import { FLEET_NAME } from '../rules/names.js'

const SHIPS = [...ALL_SHIPS, ...['pha-hive', 'pha-cruiser', 'pha-gulper', 'pha-vanguard', 'pha-drone'].map(k => ({ ...shipById(k), id: k }))]
export const SQUADRON_ROLES = ['cruiser', 'heavy cruiser', 'battlecruiser', 'battleship', 'grand cruiser', 'lump']   // A gang of Lumps
const profileOf = id => SHIPS.find(p => p.id === id)

export function listFromForm (f, fleet = f.fleet) {
  const capital = i => profileOf(f.ships[i].id).role !== 'escort'
  const flagged = f.ships.findIndex((x, i) => x.flag && capital(i))
  const list = { name: FLEET_NAME[fleet], fleet, ships: f.ships.map(x => x.id), escortSquadrons: f.squads.map(q => f.ships.map((x, i) => x.squad === q ? i : -1).filter(i => i >= 0)).filter(q => q.length), commander: f.cmd || null }
  if (fleet === 'freemen') { list.commanderOn = flagged >= 0 ? flagged : Math.max(0, f.ships.findIndex((x, i) => capital(i))); list.rerolls = f.cmd ? +(f.rerolls ?? 0) : 0 }
  else if (hasLists(fleet)) {   // the fleet's own table: list, commander, weapon choices and upgrades (data/fleetLists.js)
    list.list = f.list ?? listsOf(fleet)[0].id
    list.ships = f.ships.map(x => resolveShipId(fleet, x.id, x.picks))
    if (flagged >= 0) list.commanderOn = flagged
    list.rerolls = f.cmd || listDef(fleet, list.list).fleetRerolls ? +(f.rerolls ?? 0) : 0   // A Katharos fleet's re-rolls are bought by the fleet, not a commander
    if (f.commands && listDef(fleet, list.list).firms) list.commands = f.commands   // The gangs under each Gaffer, set in the builder
    if (f.hooks && listDef(fleet, list.list).hooks !== false) list.hooks = f.hooks   // Which carrier a Tether or Warden hooks on to
    list.picks = f.ships.map(x => x.picks ?? [])   // weapon choices that have no drawing of their own (data/fleetLists.js swap)
    list.upgrades = Object.fromEntries(f.ships.map((x, i) => [i, x.up ?? []]).filter(([, u]) => u.length))
    if (f.ordnance && listDef(fleet, list.list).ordnanceShare) list.ordnance = { ...f.ordnance }   // ordnance markers bought for the fleet
  }
  else if (fleet === 'dominion') { list.marks = f.cmd ? [...(f.marks ?? [])] : []; list.lords = f.ships.map((x, i) => x.lord != null ? { on: i, mark: x.lord || null } : null).filter(Boolean) }
  // capital ship squadrons: the ships given the same letter
  const letters = [...new Set(f.ships.map(x => x.csq).filter(Boolean))].sort()
  list.capitalSquadrons = letters.map(L => f.ships.map((x, i) => x.csq === L && SQUADRON_ROLES.includes(profileOf(x.id).role) ? i : -1).filter(i => i >= 0)).filter(q => q.length)
  return list
}
