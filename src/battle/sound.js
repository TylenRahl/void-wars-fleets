// GUNS, HEARD, for the VOID WARS: Fleets board. Exports sound(what, delayMs), warm, setSound and soundOn;
// battle.js and settingsPage.js call it on the beat of each shot.
// The synthesised sounds in sound_effects/ and public/sfx/ (and any voice lines put back in sound_voices/), played through one Web Audio gain. It decides nothing and delays nothing: the shot is
// already rolled. Its randomness is its own generator: which take plays must never draw from the game's seeded dice.
// THE FILES IN sound_effects/ ARE SYNTHESISED STAND-INS for recordings that are not in the repository;
// sound_effects/ORIGINALS.md names the video track of each original, which can be saved over its stand-in.
import laserCannon from '../../sound_effects/laser-cannon.mp3?url'
import darkLance from '../../sound_effects/dark-lance.mp3?url'
import missile from '../../sound_effects/missile.mp3?url'
import earthshaker from '../../sound_effects/heavy-shell.mp3?url'
import battleCannon from '../../sound_effects/battle-cannon.mp3?url'
import { gunSoundOn, soundLevel, onVolumeChange } from '../sound/soundSettings.js'
// AT SEA (Tides of the Archipelago): only the recorded sounds in sound_effects/ and the recorded voice lines,
// never the cannon takes in public/sfx/
import gauss from '../../sound_effects/gauss.mp3?url'
import plasmaCannon from '../../sound_effects/plasma-cannon.mp3?url'
import melta from '../../sound_effects/fusion.mp3?url'
import shuriken from '../../sound_effects/disc-gun.mp3?url'
import autocannon from '../../sound_effects/autocannon.mp3?url'
import assaultCannon from '../../sound_effects/rotary-cannon.mp3?url'
import burna from '../../sound_effects/flamer.mp3?url'
// THE RUKKA VOICE LINES ARE NOT IN THE REPOSITORY (see CREDITS.md and sound_voices/README.md).
// They are picked up from sound_voices/ by these exact names when someone puts them back, and are silent until then:
//   sound_voices/orc-fire.mp3, sound_voices/orc-charge.mp3, sound_voices/orc-move.mp3
const VOICES = import.meta.glob('../../sound_voices/*.mp3', { query: '?url', import: 'default', eager: true })
const voice = file => VOICES[`../../sound_voices/${file}`] ?? null
const orcFire = voice('orc-fire.mp3'), orcAssault = voice('orc-charge.mp3'), orcMove = voice('orc-move.mp3')
import heavySteps from '../../sound_effects/heavy-steps.mp3?url'

const FILES = {
  'lance-0': laserCannon, 'lance-1': darkLance, launch: missile, sunburst: earthshaker, boom: battleCannon,
  'sea-gauss': gauss, 'sea-plasma': plasmaCannon, 'sea-melta': melta, 'sea-shuriken': shuriken, 'sea-autocannon': autocannon, 'sea-assault': assaultCannon, 'sea-burna': burna,
  'voice-orc-fire': orcFire, 'voice-orc-assault': orcAssault, 'voice-orc-move': orcMove, 'steps-heavy': heavySteps,
  'cannon-1': '/sfx/cannon_1.wav', 'cannon-2': '/sfx/cannon_2.wav', 'cannon-3': '/sfx/cannon_3.wav', 'cannon-4': '/sfx/cannon_4.wav',
}
const VOLUME = 0.35, MAX_AT_ONCE = 12   // past a dozen at once they clip into one crackle
let seed = 20261001
const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 }

let ctx = null, out = null, playing = 0, on = true
export const stats = { asked: 0, played: 0, failed: 0 }
const buffers = new Map()

function context () {
  if (!ctx) {
    const Ctor = globalThis.AudioContext ?? globalThis.webkitAudioContext
    if (!Ctor) return null
    try { ctx = new Ctor() } catch { return null }
    out = ctx.createGain(); out.gain.value = VOLUME * soundLevel('gun-sound'); out.connect(ctx.destination)
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  return ctx
}
function load (key) {
  if (buffers.has(key)) return buffers.get(key)
  const loading = fetch(FILES[key]).then(r => r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.status))).then(b => ctx.decodeAudioData(b))
    .then(b => { buffers.set(key, b); return b }).catch(() => { buffers.set(key, null); stats.failed++; return null })
  buffers.set(key, loading)
  return loading
}
/** Load everything once a battle starts, so the first shot isn't late. */
export function warm () { if (context()) for (const k of Object.keys(FILES)) if (!k.startsWith('voice-') && k !== 'steps-heavy') load(k) }
export const soundOn = () => on
export function setSound (v) { on = !!v }

// how each event sounds: file, pitch (1 = as recorded), how much it may vary
const LOOK = {
  'lance-0': ['lance-0', 1, 0.04], 'lance-1': ['lance-1', 1, 0.04],
  battery: [null, 0.9, 0.16],       // one of the four cannon takes
  aether: ['launch', 0.42, 0.03], launch: ['launch', 0.8, 0.06], sunburst: ['sunburst', 0.9, 0.04],
  boom: ['boom', 0.62, 0.06], 'boom-big': ['boom', 0.45, 0.04], hit: ['boom', 0.8, 0.1],
  // at sea: the recordings only (battle/fx.js seaPlay)
  'sea-rail': ['sea-gauss', 0.9, 0.06], 'sea-laser': ['lance-0', 0.85, 0.05], 'sea-zap': ['sea-plasma', 1.1, 0.08], 'sea-crystal': ['sea-melta', 1.25, 0.06],
  'sea-ballista': ['sea-shuriken', 0.7, 0.1], 'sea-cannon': [['boom', 'sea-autocannon', 'sea-assault'], 0.85, 0.14], 'sea-fire': ['sea-burna', 0.8, 0.1],
  'sea-boom': ['boom', 0.55, 0.06], 'sea-boom-big': ['boom', 0.4, 0.04], 'sea-launch': ['launch', 0.75, 0.06],
  'voice-orc-fire': ['voice-orc-fire', 1, 0], 'voice-orc-assault': ['voice-orc-assault', 1, 0], 'voice-orc-move': ['voice-orc-move', 1, 0], 'steps-heavy': ['steps-heavy', 1, 0],
}
/** Play `what` in `delayMs`, on the beat of the picture (fx.js). */
export function sound (what, delayMs = 0) {
  if (!on || !gunSoundOn()) return
  const look = LOOK[what], audio = context()
  if (!look || !audio) return
  stats.asked++
  const key = Array.isArray(look[0]) ? look[0][Math.floor(random() * look[0].length)] : look[0] ?? `cannon-${1 + Math.floor(random() * 4)}`, due = audio.currentTime + delayMs / 1000
  if (!FILES[key]) return   // a voice line that is not there: silent, nothing requested
  Promise.resolve(load(key)).then(buffer => {
    if (!buffer || playing >= MAX_AT_ONCE) return
    const src = audio.createBufferSource()
    src.buffer = buffer
    src.playbackRate.value = look[1] + (random() - 0.5) * look[2]
    src.connect(out)
    playing++; stats.played++
    src.onended = () => { playing-- }
    src.start(Math.max(audio.currentTime, due))
  })
}
// Settings > Guns' slider: the shots after it are at the new level
onVolumeChange(() => { if (out) out.gain.value = VOLUME * soundLevel('gun-sound') })
