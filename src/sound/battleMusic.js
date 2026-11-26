// THE BATTLE MUSIC: a shuffled loop on the choose-a-battle page (startBattleMusic) and another on the table
// (startTableMusic). Exports those, their stops, createShuffledMusic and VOLUME; used by battle/pages.js.
//
// Every .mp3 in sound_screen/space/battle screen/ is picked up by the glob below, so a track
// dropped into that folder joins the loop at the next build or dev reload with no code change.
//
// THE ORDER IS A SHUFFLED DECK, not a dice roll per track: every track plays once before any
// plays again, and a new deck never starts with the track the last one ended on, so the same
// song is never heard twice in a row. The shuffle uses its OWN generator (createRng seeded
// from the clock), never the game's seeded source: which song plays next must not move a
// single die (the same rule as battle/sound.js and battle/fx.js).
//
// WHERE IT PLAYS: the start screen and the other pages have the menu song (menuMusic.js); this plays on the
// choose-a-battle screen (battle/pages.js battlePage) and stops when the battle begins or the menu's song takes over. The first track rises from silence over a few
// seconds, the way the menu's does. Settings > Sound > Battle music turns it off.
//
// Decoration. It decides nothing and reads no game state.
import { createRng } from '../rules/dice.js'
import { battleMusicOn, tableMusicOn, soundLevel, onVolumeChange } from './soundSettings.js'
import { shuffled } from './playlist.js'

// TIDES OF THE ARCHIPELAGO: at sea, the songs in sound_screen/sea/ are used instead, as soon
// as any are there.
import { SEA } from '../skin.js'
// Until then, the harbour songs in sound_screen/harbour/.
const own = (a, b) => a.length ? a : b
// SONGS FOR sound_screen/harbour/battle screen/ (not in the repository; see TRACKS.md there): file name, music video track, start time
//   Choose Your Hero.mp3   track 20 (41:30)
//   deadly tournament.mp3   track 21 (42:46)
//   Fridge Fiasco.mp3   track 22 (44:29)
//   Sands of Honor.mp3   track 23 (44:48)
//   Tavern Loop.mp3   track 24 (46:20)
// (end of the list)
const SEA_TRACKS = own(Object.values(import.meta.glob('../../sound_screen/sea/battle screen/*.mp3', { query: '?url', import: 'default', eager: true })), Object.values(import.meta.glob('../../sound_screen/harbour/battle screen/*.mp3', { query: '?url', import: 'default', eager: true })))
// SONGS FOR sound_screen/harbour/battle/ (not in the repository; see TRACKS.md there): file name, music video track, start time
//   Army Forming Ranks.mp3   track 25 (46:42)
//   Determined Path.mp3   track 26 (48:16)
//   Grim Resolve.mp3   track 27 (50:30)
// (end of the list)
const SEA_TABLE = own(Object.values(import.meta.glob('../../sound_screen/sea/battle/*.mp3', { query: '?url', import: 'default', eager: true })), Object.values(import.meta.glob('../../sound_screen/harbour/battle/*.mp3', { query: '?url', import: 'default', eager: true })))
// SONGS FOR sound_screen/space/battle screen/ (not in the repository; see TRACKS.md there): file name, music video track, start time
//   Neon Groove.mp3   track 07 (13:42)
//   Pizza Time!.mp3   track 08 (14:21)
//   Select Your Fighter (1).mp3   track 09 (15:06)
//   Select Your Fighter.mp3   track 10 (16:24)
//   Victory Circuit (1).mp3   track 11 (17:26)
//   Victory Circuit.mp3   track 12 (20:21)
//   Victory Lane (1).mp3   track 13 (22:44)
//   Victory Lane.mp3   track 14 (25:39)
//   You Can't Stop Me.mp3   track 15 (28:12)
// (end of the list)
const SPACE_TRACKS = Object.values(import.meta.glob('../../sound_screen/space/battle screen/*.mp3', { query: '?url', import: 'default', eager: true }))
const TRACKS = SEA && SEA_TRACKS.length ? SEA_TRACKS : SPACE_TRACKS
// Under the guns: the gun sounds play at 0.35 through their own gain (battle/sound.js).
export const VOLUME = 0.3
const FADE_IN = 4 // seconds for the first track to rise from silence

// A SHUFFLED MUSIC PLAYER: `tracks` (urls) as a shuffled deck at `volume`.
// `isOn`: the Settings switch that lets it play (Battle music by default). `levelId`: its slider under Settings > Sound
// (soundSettings.js soundLevel), put on top of `volume` and followed at once while a track plays; none, it plays at `volume`.
export function createShuffledMusic ({ tracks, volume = VOLUME, isOn = battleMusicOn, levelId = null }) {
  let playing = null // { audio, stop } while the music is running
  const level = () => volume * (levelId ? soundLevel(levelId) : 1)

  // Starts the music, or leaves it playing if it already is (coming back to the choose-a-battle
  // screen from a battle's setup keeps the song it had).
  function start () {
    if (playing) return
    if (!isOn() || tracks.length === 0 || typeof Audio === 'undefined') return
    const random = createRng(Date.now() % 2147483647)
    let deck = []
    let last = null
    let first = true
    let fade = null
    let stopped = false
    const audio = new Audio()

    function next () {
      if (stopped) return
      if (deck.length === 0) deck = shuffled(tracks, random, last)
      last = deck.shift()
      audio.src = last
      audio.volume = first ? 0 : level()
      audio.play().then(() => {
        if (!first) return
        first = false
        // squared, as the menu's: a straight line in volume sounds like it arrives at once
        fade = setInterval(() => {
          const f = Math.min(1, audio.currentTime / FADE_IN)
          audio.volume = level() * f * f
          if (f >= 1) { clearInterval(fade); fade = null }
        }, 50)
      }).catch(() => {
        // Refused (no click on the page yet, or a file that will not play): try the next
        // track rather than fall silent for good.
        setTimeout(next, 1000)
      })
    }
    audio.addEventListener('ended', next)
    next()
    const unlisten = levelId
      ? onVolumeChange(id => { if ((id === levelId || id === 'master') && !first && fade === null) audio.volume = level() })
      : () => {}

    playing = {
      audio,
      stop () {
        stopped = true
        unlisten()
        if (fade !== null) clearInterval(fade)
        audio.removeEventListener('ended', next)
        audio.pause()
        audio.removeAttribute('src')
        audio.load()
      }
    }
  }

  function stop () {
    playing?.stop()
    playing = null
  }

  return { start, stop }
}

// The choose-a-battle page's: sound_screen/space/battle screen/ (or the sea's).
const BATTLE = createShuffledMusic({ tracks: TRACKS, levelId: 'battle-music' })
export const startBattleMusic = BATTLE.start
export const stopBattleMusic = BATTLE.stop

// THE TABLE'S OWN MUSIC. Every .mp3 in sound_screen/space/battle/ (a song dropped in joins at the next reload), shuffled as above, from the moment the
// battle begins (battle/pages.js table) until the menu or the choose-a-battle screen. Settings > Sound > Table music.
// SONGS FOR sound_screen/space/battle/ (not in the repository; see TRACKS.md there): file name, music video track, start time
//   Circle of Preparation.mp3   track 16 (28:44)
//   relentless forward momentum.mp3   track 17 (31:43)
// (end of the list)
const SPACE_TABLE = Object.values(import.meta.glob('../../sound_screen/space/battle/*.mp3', { query: '?url', import: 'default', eager: true }))
const TABLE_TRACKS = SEA && SEA_TABLE.length ? SEA_TABLE : SPACE_TABLE
const TABLE = createShuffledMusic({ tracks: TABLE_TRACKS, isOn: tableMusicOn, levelId: 'table-music' })
export const startTableMusic = TABLE.start
export const stopTableMusic = TABLE.stop
