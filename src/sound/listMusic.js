// THE FLEET LISTS' MUSIC. Exports startListMusic, stopListMusic, levelFor, CROSSFADE, tracksOf and
// createListMusic; used by battle/pages.js.
//
// Every .mp3 in sound_screen/space/build list/ is picked up by the glob below and played one after
// another, round and round, for as long as the fleet builder is open: from the Fleet Lists button
// (battle/pages.js lists) until it is left (its Back, or any other page: pages.js leaveListMusic). Coming in, Alien Struggle sinks to silence
// while the first track rises over CROSSFADE (menuMusic.js duckMenuMusic); going out, the reverse
// (quietMenuMusic). Settings > Sound > Menu music turns this off with the menus' own song.
//
// THE SAME LEVEL AS ALIEN STRUGGLE, so the songs sound equally loud. Each track's volume is Alien Struggle's QUIET_VOLUME scaled by
// the difference in loudness, measured with ffmpeg's ebur128 filter (integrated loudness, LUFS):
// Alien Struggle -16.3, Steady Foundation -15.6, Unresolved Loop -16.2. A track added
// later and not measured plays at QUIET_VOLUME as it is.
//
// QUIETER THAN THAT. Every
// track plays at LIST_LEVEL of the matched level above (0.6, about 4.4 dB down).
//
// AFTER ALIEN STRUGGLE ENDS: the menu song plays out before the builder's music starts.
// startListMusic's `after` holds the first track back until then
// (pages.js passes menuMusic.js whenMenuSongEnds); leaving the builder first cancels the wait.
//
// Decoration. It decides nothing and reads no game state.
import { menuMusicOn, soundLevel, onVolumeChange } from './soundSettings.js'
import { QUIET_VOLUME } from './menuMusic.js'

import { SEA } from '../skin.js'
// at sea (Tides of the Archipelago) the harbour build-list songs, matched to the sea's menu song: Wandering Path and War Council -15.3 LUFS against the Imperio Antiguos' -15.4
// SONGS FOR sound_screen/harbour/build list/ (not in the repository; see TRACKS.md there): file name, music video track, start time
//   Wandering Path.mp3   track 18 (35:33)
//   War Council.mp3   track 19 (39:15)
// (end of the list)
const FILES = SEA ? import.meta.glob('../../sound_screen/harbour/build list/*.mp3', { query: '?url', import: 'default', eager: true })
  // SONGS FOR sound_screen/space/build list/ (not in the repository; see TRACKS.md there): file name, music video track, start time
  //   Steady Foundation.mp3   track 05 (08:12)
  //   Unresolved Loop.mp3   track 06 (10:39)
  // (end of the list)
  : import.meta.glob('../../sound_screen/space/build list/*.mp3', { query: '?url', import: 'default', eager: true })

const MENU_LUFS = SEA ? -15.4 : -16.3 // Alien Struggle.mp3 (Imperio AntiguoMinor.mp3 at sea)
const LUFS = SEA ? { 'Wandering Path.mp3': -15.3, 'War Council.mp3': -15.3 } : { 'Steady Foundation.mp3': -15.6, 'Unresolved Loop.mp3': -16.2 }
export const CROSSFADE = 5 // seconds: a slow change
const LIST_LEVEL = 0.6

// The tracks of a Vite glob (path -> url), in file-name order.
export function tracksOf (files) {
  return Object.entries(files).sort(([a], [b]) => a.localeCompare(b))
    .map(([path, url]) => ({ name: path.split('/').pop(), url }))
}

// A FLEET BUILDER'S MUSIC: `tracks` round and round, each at the volume that
// sounds as loud as the menu's song at `menuVolume` (its loudness `menuLufs`, each track's in
// `lufs`), times LIST_LEVEL.
export function createListMusic ({ tracks, lufs = {}, menuLufs, menuVolume }) {
  // The volume that sounds as loud as the menu's song at menuVolume.
  const levelFor = name => {
    const loudness = lufs[name]
    if (loudness === undefined) return menuVolume * LIST_LEVEL
    return Math.min(1, menuVolume * LIST_LEVEL * 10 ** ((menuLufs - loudness) / 20))
  }

  let playing = null // { stop } while the lists' music is running, or waiting to

  // Starts the music, or leaves it playing if it already is. `after(fn)`, when given, calls fn
  // when the music may start and returns a function that cancels the wait.
  function start ({ after = null } = {}) {
    if (playing) return
    if (!menuMusicOn() || tracks.length === 0 || typeof Audio === 'undefined') return
    let left = false
    let music = null
    let cancelWait = null
    playing = { stop () { left = true; cancelWait?.(); music?.stop() } }
    const go = () => { cancelWait = null; if (!left) music = play() }
    if (after) cancelWait = after(go)
    else go()
  }

  function play () {
    let n = 0
    let first = true
    let ramp = null
    let stopped = false
    let name = null
    const audio = new Audio()
    // Settings > Sound > Menu music's slider covers these too (soundSettings.js soundLevel): they are matched to its song
    const heard = trackName => levelFor(trackName) * soundLevel('menu-music')
    const unlisten = onVolumeChange(id => {
      if ((id === 'menu-music' || id === 'master') && !stopped && !first && ramp === null && name) audio.volume = heard(name)
    })

    // squared on the way up and the way down, as every fade in menuMusic.js
    function rampTo (target, seconds, then = null) {
      if (ramp !== null) clearInterval(ramp)
      const from = audio.volume
      const t0 = performance.now()
      ramp = setInterval(() => {
        const f = Math.min(1, (performance.now() - t0) / 1000 / seconds)
        audio.volume = target >= from ? from + (target - from) * f * f : target + (from - target) * (1 - f) * (1 - f)
        if (f >= 1) { clearInterval(ramp); ramp = null; then?.() }
      }, 50)
    }

    function next () {
      if (stopped) return
      const track = tracks[n % tracks.length]
      n++
      name = track.name
      audio.src = track.url
      audio.volume = first ? 0 : heard(track.name)
      audio.play().then(() => {
        if (first) { first = false; rampTo(heard(track.name), CROSSFADE) }
      }).catch(() => setTimeout(next, 1000))
    }
    audio.addEventListener('ended', next)
    next()

    function halt () {
      unlisten()
      if (ramp !== null) clearInterval(ramp)
      audio.removeEventListener('ended', next)
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
    }

    return {
      // out over CROSSFADE, under the menu's song coming back
      stop () {
        if (stopped) return
        stopped = true
        if (audio.paused) halt()
        else rampTo(0, CROSSFADE, halt)
      }
    }
  }

  // True when there was music to stop.
  function stop () {
    const was = playing !== null
    playing?.stop()
    playing = null
    return was
  }

  return { start, stop, levelFor }
}

// This game's: sound_screen/space/build list/ (or the sea's), matched to the menu song at QUIET_VOLUME.
const LIST = createListMusic({ tracks: tracksOf(FILES), lufs: LUFS, menuLufs: MENU_LUFS, menuVolume: QUIET_VOLUME })
export const levelFor = LIST.levelFor
export const startListMusic = LIST.start
export const stopListMusic = LIST.stop
