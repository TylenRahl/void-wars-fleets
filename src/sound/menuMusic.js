// THE START SCREEN'S MUSIC, AND THE DAY AND NIGHT THAT FOLLOW IT; also the quieter menu song on Rules,
// Settings and Fleet Lists. Exports startMenuMusic, quietMenuMusic, duckMenuMusic, whenMenuSongEnds,
// stopMenuMusic and QUIET_VOLUME; used by battle/pages.js, battle/settingsPage.js and listMusic.js.
//
// The start screen's song is Alien StruggleMain; the menus' song is Alien Struggle. Both are in
// sound_screen/space/start screen/, and Vite bundles them from there
// (the `?url` import gives the hashed path in a build and the real one under `npm run dev`).
//
// THE MUSIC IS THE CLOCK. The battlefield asks `light` every frame and gets its darkness
// from how far into the track the audio element actually is — not from a timer started
// beside it. A timer drifts from the audio the moment the tab stalls or the file buffers,
// and "dusk at 7 seconds" is a promise about the song.
//
// NO SOUND BEFORE A CLICK OR A KEY. Browsers refuse to start audio a page has not been
// touched by, so on a fresh load the music waits for the first pointer press or key, and
// the battlefield holds at daylight until it starts, so dusk still lands on 7 seconds of
// the song. With the menu sound set to Off the same timeline runs silently from a plain
// clock instead. While it waits, the label under the title says so.
//
// IT BUILDS UP. The first play
// rises from silence to full over its first FADE_IN seconds, read off the song's own
// position like the light. The repeats play at full: they follow on from a song already
// playing.
//
// Decoration. It decides nothing and reads no game state.
// The songs are NOT in the repository (see TRACKS.md in each sound_screen folder and CREDITS.md). Each is looked up by
// its file name, so the menu is silent until someone puts them back (listed just below).
// SONGS FOR sound_screen/space/start screen/ (not in the repository; see TRACKS.md there): file name, music video track, start time
//   Alien StruggleMain.mp3   track 01 (00:00)
//   Alien Struggle.mp3   track 02 (00:53)
// (end of the list)
// SONGS FOR sound_screen/harbour/start screen/ (not in the repository; see TRACKS.md there): file name, music video track, start time
//   Imperio Antiguo.mp3   track 03 (03:03)
//   Imperio AntiguoMinor.mp3   track 04 (06:09)
// (end of the list)
const START = import.meta.glob(['../../sound_screen/space/start screen/*.mp3', '../../sound_screen/harbour/start screen/*.mp3'], { query: '?url', import: 'default', eager: true })
const named = file => Object.entries(START).find(([path]) => path.endsWith('/' + file))?.[1] ?? null
const spaceSongUrl = named('space/start screen/Alien StruggleMain.mp3')
const spaceQuietUrl = named('space/start screen/Alien Struggle.mp3')
// at sea (Tides of the Archipelago): the first song in sound_screen/sea/start screen/ if there is one; otherwise the
// harbour songs in sound_screen/harbour/start screen/, Imperio Antiguo then its Minor (OLD_WORLD below means that fallback)
import { SEA } from '../skin.js'
const owMainUrl = named('harbour/start screen/Imperio Antiguo.mp3')
const owMinorUrl = named('harbour/start screen/Imperio AntiguoMinor.mp3')
const SEA_START = Object.values(import.meta.glob('../../sound_screen/sea/start screen/*.mp3', { query: '?url', import: 'default', eager: true }))
const OLD_WORLD = SEA && !SEA_START.length
const songUrl = SEA && SEA_START.length ? SEA_START[0] : OLD_WORLD ? owMainUrl : spaceSongUrl
const quietUrl = SEA && SEA_START.length ? SEA_START[SEA_START.length > 1 ? 1 : 0] : OLD_WORLD ? owMinorUrl : spaceQuietUrl
import { menuMusicOn, soundLevel, onVolumeChange } from './soundSettings.js'

// Settings > Sound > Menu music's slider (soundSettings.js soundLevel). VOLUME, QUIET_VOLUME and `wanted` stay the levels
// the songs were set at; this is put on top of them wherever a song's volume is written, and a song already playing
// follows a moved slider at once (the bottom of this file).
const sliderLevel = () => soundLevel('menu-music')

// the Imperio Antiguos are louder (-15.4 LUFS against Alien Struggle's -16.3), so a little under 0.6 to sound as loud
const VOLUME = 0.6 * (OLD_WORLD ? 10 ** ((-16.3 + 15.4) / 20) : 1)
const TRANSITION = 7 // seconds for dusk and for dawn
const FADE_IN = 10 // seconds for the first play to rise from silence to VOLUME
const SONG_S = OLD_WORLD ? 147.624 : 42.432 // Alien StruggleMain.mp3 (Imperio Antiguo.mp3 at sea), measured with ffprobe
const QUIET_S = OLD_WORLD ? 109.56 : SONG_S // the song that loops after it (Imperio AntiguoMinor.mp3 at sea)

// EVERY PLAY THE SAME: daylight 0–7 s, dusk 7–14 s, night until 35 s, then dawn over the
// last 7 s, so the song's end comes back round to the daylight it starts in and the repeat
// has no jump.
const FIRST = [
  { at: 0, dark: 0 },
  { at: 7, dark: 0 },
  { at: 14, dark: 1 },
  { at: SONG_S - TRANSITION, dark: 1 },
  { at: SONG_S, dark: 0 }
]
const REPEAT = QUIET_S === SONG_S ? FIRST : [{ at: 0, dark: 0 }, { at: 7, dark: 0 }, { at: 14, dark: 1 }, { at: QUIET_S - TRANSITION, dark: 1 }, { at: QUIET_S, dark: 0 }]

// THE START SCREEN'S FIRST VISIT: Alien StruggleMain once through, the dark coming later. Daylight to 13 s,
// dusk over 7 s to full night at 20 s, night until the last 7 s, dawn to the end so Alien
// Struggle takes over in daylight. FIRST above stays as it was.
const START_FIRST = [
  { at: 0, dark: 0 },
  { at: 13, dark: 0 },
  { at: 20, dark: 1 },
  { at: SONG_S - TRANSITION, dark: 1 },
  { at: SONG_S, dark: 0 }
]

const ease = x => x * x * (3 - 2 * x)

// darkness 0 (day) to 1 (night) and the label under the title, `s` seconds into a track
function lightAt (keys, s) {
  let i = 0
  while (i + 1 < keys.length && keys[i + 1].at <= s) i++
  const from = keys[i]
  const to = keys[i + 1]
  if (!to || to.dark === from.dark) {
    return { dark: from.dark, name: from.dark === 1 ? 'Night fight' : 'Daylight' }
  }
  const f = ease((s - from.at) / (to.at - from.at))
  return { dark: from.dark + (to.dark - from.dark) * f, name: to.dark > from.dark ? 'Dusk' : 'Dawn' }
}

// TWO SONGS FOR THE MENUS. On every page but the choose-a-battle one, StruggleMain fades into
// Alien Struggle, which plays on at half the volume, the start screen included.
// - The start screen's first visit: Alien StruggleMain, its day and night following it.
// - Leaving it for Rules, Settings or Fleet Lists (quietMenuMusic): StruggleMain
// fades into Alien Struggle over CROSSFADE seconds, and that loops at half the volume.
// - Back on the start screen it plays on, and the battlefield keeps its own timer
// (light is null; battle/startField.js CYCLE).
// - The choose-a-battle screen has the battle music (battle/pages.js battlePage, stopMenuMusic); back
// from it is Alien Struggle again, at half volume.
// StruggleMain does not come back until the page is reloaded.
export const QUIET_VOLUME = VOLUME * 0.5
const CROSSFADE = 3 // seconds
// THE MENUS' ONE SONG, Alien Struggle, looping at QUIET_VOLUME (half) everywhere it plays: after StruggleMain ends on
// the start screen, on Rules, Settings and Fleet Lists, and back on the start screen. The start screen's day and night
// keep their own timer (light is null).
let current = null    // StruggleMain, while the intro is being watched
let loop = null       // Alien Struggle
let wanted = VOLUME   // the level Alien Struggle is heading for
let loopPlaying = false // Alien Struggle has really started (play was not refused)
let waiting = []        // startMenuMusic's whenPlaying callbacks, until it has

const NO_LIGHT = { light: () => null, stop () {}, stopped: () => false, sound: false, time: () => null, follow () {}, seek () {} }

// The start screen. The FIRST visit since the page loaded plays Alien StruggleMain once through,
// its day and night following the song (START_FIRST), and when it ends Alien Struggle loops on
// at half (QUIET_VOLUME) and the battlefield goes back to its own timer. Every later visit is
// Alien Struggle at half, carrying on at the level it was.
//
// `whenPlaying(fn)` calls fn once the music is really heard — at once if it already is, or if
// there will be no sound (the setting is off) — so the battlefield's entrance waits for the
// music. When the browser refuses sound
// until a click, that is the first click (the start screen's PRESS ANY KEY).
let mainHeard = false // StruggleMain has had its one start-screen play since the page loaded
export function startMenuMusic () {
  const whenPlaying = fn => {
    if (loopPlaying || current?.playing() || (!loop && !current)) fn()
    else waiting.push(fn)
  }
  if (!mainHeard && !loop && !current && menuMusicOn() && typeof Audio !== 'undefined' && songUrl) {   // no song file: as if the music were off
    mainHeard = true
    wanted = VOLUME
    const main = newMenuMusic({
      keys: START_FIRST,
      once: true,
      onPlaying: heard,
      // the song has finished: Alien Struggle takes over (it rises over CROSSFADE)
      onEnd: () => { if (current === main) { current = null; handOver(QUIET_VOLUME) } }
    })
    current = main
    return { ...main, whenPlaying }
  }
  handOver(QUIET_VOLUME)
  return { ...NO_LIGHT, whenPlaying }
}

// the music is really playing: everything waiting on whenPlaying goes
function heard () {
  for (const fn of waiting.splice(0)) fn()
}

// Rules, Settings, Fleet Lists: Alien Struggle at half.
export function quietMenuMusic (seconds = CROSSFADE) {
  handOver(QUIET_VOLUME, seconds)
}

// The fleet builder (listMusic.js): Alien Struggle sinks to silence over `seconds` and keeps
// its place, so quietMenuMusic brings it back up where it was rather than from the top.
export function duckMenuMusic (seconds = CROSSFADE) {
  wanted = 0
  const main = current
  current = null
  if (main && !main.stopped()) main.fadeOut(seconds)
  loop?.level(0, seconds)
}

// THE BUILDER WAITS FOR ALIEN STRUGGLE to play out before its own music. Alien Struggle stops looping and plays on to its end (it is
// 1 min 43 s), is stopped there, and `fn` is called. With Alien Struggle not playing (the
// setting off, no click yet, or StruggleMain still on), `fn` is called at once. Returns the
// cancel, for leaving before the end: Alien Struggle goes on looping as before.
export function whenMenuSongEnds (fn) {
  if (current || !loop?.finishThen(fn)) { fn(); return () => {} }
  const mine = loop
  return () => mine.keepLooping()
}

// Alien Struggle to `level`. If the intro's StruggleMain is playing, it fades out once Alien
// Struggle has really started, so a file still loading leaves no silent gap between them.
// Already heading for that level (back from Fleet Lists, rising over their slower
// crossfade), the ramp under way is left alone rather than restarted at a different pace.
function handOver (level, seconds = CROSSFADE) {
  const same = wanted === level
  wanted = level
  const main = current
  current = null
  const fadeMain = () => { if (main && !main.stopped()) main.fadeOut(seconds) }
  if (!playLoop(fadeMain)) { if (!same) loop?.level(level, seconds); fadeMain() }
}

// Silence: the choose-a-battle screen, and Settings > Menu music > Off.
export function stopMenuMusic () {
  current?.stop()
  current = null
  loop?.stop()
  loop = null
}

// Alien Struggle, looping, rising from silence to `wanted` over CROSSFADE when it starts and
// moving to any new level over CROSSFADE after. `onPlaying` is called once it has started.
// Returns false when it does not start (the setting is off, or it is already playing).
function playLoop (onPlaying = null) {
  if (loop || !menuMusicOn() || typeof Audio === 'undefined' || !quietUrl) return false
  const audio = new Audio(quietUrl)
  audio.loop = true
  audio.volume = 0
  let ramp = null
  let stopped = false
  let playing = false
  const gesture = () => { removeGesture(); begin() }
  const removeGesture = () => {
    document.removeEventListener('pointerdown', gesture)
    document.removeEventListener('keydown', gesture)
  }
  // squared on the way up, as every fade here: the ear hears loudness roughly that way
  function rampTo (target, seconds = CROSSFADE) {
    if (ramp !== null) clearInterval(ramp)
    const from = audio.volume
    const t0 = performance.now()
    ramp = setInterval(() => {
      const f = Math.min(1, (performance.now() - t0) / 1000 / seconds)
      audio.volume = from + (target * sliderLevel() - from) * f * f
      if (f >= 1) { clearInterval(ramp); ramp = null }
    }, 50)
  }
  function begin () {
    if (stopped) return
    audio.play().then(() => {
      playing = true
      loopPlaying = true
      onPlaying?.()
      heard()
      rampTo(wanted)
    }).catch(() => {
      // refused: no click yet. Try again on the first one.
      document.addEventListener('pointerdown', gesture, { once: true })
      document.addEventListener('keydown', gesture, { once: true })
    })
  }
  begin()
  // whenMenuSongEnds: called at the end of the play under way, instead of looping
  let then = null
  audio.addEventListener('ended', () => {
    if (stopped || !then) return
    const fn = then
    then = null
    if (loop === self) loop = null
    self.stop()
    fn()
  })
  const self = {
    level (target, seconds = CROSSFADE) { if (playing && !stopped) rampTo(target, seconds) },
    // the slider moved: straight to `wanted` at the new level, unless a ramp is on its way there already
    relevel () { if (playing && !stopped && ramp === null) audio.volume = wanted * sliderLevel() },
    finishThen (fn) {
      if (!playing || stopped) return false
      then = fn
      audio.loop = false
      return true
    },
    keepLooping () {
      then = null
      audio.loop = true
    },
    stop () {
      stopped = true
      loopPlaying = false
      waiting = []
      removeGesture()
      if (ramp !== null) clearInterval(ramp)
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
    }
  }
  loop = self
  return true
}

// `keys`: the first play's day and night. `once`: play through one time only (the start
// screen's first visit), then stop, call `onEnd`, and give light null. `onPlaying`: called
// when the song really starts.
function newMenuMusic ({ hold = false, keys = FIRST, once = false, onEnd = null, onPlaying = null } = {}) {
  const sound = menuMusicOn() && typeof Audio !== 'undefined' && !!songUrl   // no song file: the same timeline, silent
  const song = sound ? new Audio(songUrl) : null
  let first = true // the first play has its own day and night, and the fade
  let started = false
  let stopped = false
  let fade = null

  // with no sound, the same timeline from a plain clock, a song's length at a time
  const t0 = performance.now()

  if (sound) {
    song.volume = 0
    // NOT `loop = true`: a looping element never fires `ended`, and the end of the first
    // play is where its day and night hand over to the repeats'.
    song.addEventListener('ended', () => {
      if (stopped) return
      if (once) { stop(); onEnd?.(); return }
      first = false
      song.currentTime = 0
      song.play().catch(() => {})
    })
  }

  const gesture = () => { removeGesture(); begin() }
  const removeGesture = () => {
    document.removeEventListener('pointerdown', gesture)
    document.removeEventListener('keydown', gesture)
  }

  // THE INTRO'S CLOCK. While an intro plays, a song the browser held
  // back until a click starts at the intro's second, not at 0, so sound and picture agree.
  let introClock = null

  // squared, because the ear hears loudness roughly that way: a straight line in volume
  // sounds like it arrives almost at once and then barely moves. Timed from when it began to
  // play, so a song started late by the intro (or put back to its start) still builds up.
  function buildUp () {
    if (fade !== null) clearInterval(fade)
    const from = performance.now()
    fade = setInterval(() => {
      const f = first ? Math.min(1, (performance.now() - from) / 1000 / FADE_IN) : 1
      song.volume = VOLUME * sliderLevel() * f * f
      if (f >= 1) { clearInterval(fade); fade = null }
    }, 50)
  }

  function begin () {
    if (stopped || started) return
    if (introClock) song.currentTime = Math.min(SONG_S - 0.5, Math.max(0, introClock()))
    song.play().then(() => {
      started = true
      buildUp()
      onPlaying?.()
    }).catch(() => {
      // refused: no click yet. Try again on the first one.
      document.addEventListener('pointerdown', gesture, { once: true })
      document.addEventListener('keydown', gesture, { once: true })
    })
  }
  if (sound && !hold) begin()

  function light () {
    if (!sound) {
      const s = (performance.now() - t0) / 1000
      return s < SONG_S ? lightAt(keys, s) : lightAt(REPEAT, (s - SONG_S) % QUIET_S)
    }
    if (once && stopped) return null
    // the start screen says PRESS ANY KEY itself
    if (!started) return { dark: 0, name: once ? 'Daylight' : 'Click for music' }
    return lightAt(first ? keys : REPEAT, song.currentTime)
  }

  function stop () {
    stopped = true
    removeGesture()
    if (fade !== null) clearInterval(fade)
    if (!song) return
    song.pause()
    song.removeAttribute('src')
    song.load()
  }

  // Down to silence over `seconds`, then stopped: the first half of the crossfade.
  function fadeOut (seconds) {
    if (!song || stopped) return stop()
    if (fade !== null) clearInterval(fade)
    removeGesture()
    const from = song.volume
    const t0 = performance.now()
    fade = setInterval(() => {
      const f = Math.min(1, (performance.now() - t0) / 1000 / seconds)
      song.volume = from * (1 - f) * (1 - f)
      if (f >= 1) stop()
    }, 50)
  }

  // For the intro: the song's position in seconds while it is playing its first time through,
  // else null; and the intro's own clock, for a late start.
  const time = () => (sound && started && !stopped && first && !song.paused ? song.currentTime : null)
  const follow = clock => { introClock = clock }
  // the intro's Begin: the song to `seconds`, building up again from silence
  const seek = seconds => {
    if (!sound || stopped) return
    song.currentTime = seconds
    if (started) buildUp()
  }

  // `start`: a held song begins (the intro's Begin).
  const start = () => { if (sound) begin() }

  const playing = () => started && !stopped

  // the slider moved: StruggleMain to its full level at the new setting, unless it is still building up or fading
  const relevel = () => { if (sound && started && !stopped && fade === null) song.volume = VOLUME * sliderLevel() }

  return { light, stop, fadeOut, time, follow, seek, start, playing, relevel, stopped: () => stopped, sound }
}

onVolumeChange(id => {
  if (id !== 'menu-music' && id !== 'master') return
  loop?.relevel()
  current?.relevel()
})
