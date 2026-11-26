// THE SKIN: Space (VOID WARS: Fleets) or Sea ("Tides of the Archipelago"): the same rules drawn as ships on the sea,
// chosen with the toggle at the top left of the start screen. Exports SKIN, SEA, GAME_TITLE, SEA_FLEETS,
// SEA_FLEET_NAME and setSkin; imported first by battle.js and read by every drawing that differs between the two.
// Read once when the page loads; switching saves the choice and reloads, so every drawing reads one value.
// ?skin=sea or ?skin=space in the address wins (test scripts, links).
import { FLEET_NAME } from './rules/names.js'

const KEY = 'vwf.skin'
const read = () => {
  try {
    const q = new URLSearchParams(location.search).get('skin')
    if (q === 'sea' || q === 'space') return q
    return localStorage.getItem(KEY) === 'sea' ? 'sea' : 'space'
  } catch { return 'space' }
}
export const SKIN = typeof location === 'undefined' ? 'space' : read()
export const SEA = SKIN === 'sea'
export const GAME_TITLE = SEA ? ['TIDES OF THE', 'ARCHIPELAGO'] : ['VOID WARS', 'FLEETS']   // VOID WARS: Fleets

// The sea fleets and the rules each one plays by: Human fleet = the Freemen rules, Elf fleet = the Athanatoi,
// Orc fleet = the Rukka, Dominion fleet = the Dominion. Display only: the ids, data and rules are the space game's.
export const SEA_FLEETS = ['freemen', 'athanatoi', 'rukka', 'dominion']
export const SEA_FLEET_NAME = { freemen: 'Human fleet', athanatoi: 'Elf fleet', rukka: 'Orc fleet', dominion: 'Dominion fleet' }
if (SEA) Object.assign(FLEET_NAME, SEA_FLEET_NAME)

export function setSkin (skin) {
  try { localStorage.setItem(KEY, skin) } catch {}
  const u = new URL(location.href); u.searchParams.delete('skin')
  location.href = u.toString()
}
