// THE BLAST DOORS, HEARD: the sound of battle/blastDoors.js. Exports shut, lock and open; used by
// blastDoors.js and battle/settingsPage.js (the sample when its slider is let go).
//
// SYNTHESISED with Web Audio: filtered noise for the hydraulics, a low
// saw for the motor, a handful of out-of-tune sines for the ring of the steel. Nothing to load,
// nothing to 404. The press of To battle is the click a browser wants before it makes a sound,
// so the context is built there and is running.
//
// Three moments, timed by blastDoors.js against the doors' own CSS:
// shut(ms) the doors run together over `ms`: hiss and motor, then the CLANG as they meet
// lock the bolts going home: two hard clunks
// open(ms) the seal letting go (a burst of air), the motor again, a knock as they stop
//
// Settings > Sound > Blast doors turns it off. Decoration: it decides nothing.
import { doorSoundOn, soundLevel } from './soundSettings.js'

let ctx = null
let master = null

function audio () {
  if (!doorSoundOn()) return null
  if (!ctx) {
    const Ctor = globalThis.AudioContext ?? globalThis.webkitAudioContext
    if (!Ctor) return null
    try { ctx = new Ctor() } catch { return null }
    master = ctx.createGain()
    master.gain.value = 0.55
    master.connect(ctx.destination)
  }
  // Settings > Sound > Blast doors' slider (soundSettings.js soundLevel), read every time the doors move
  master.gain.value = 0.55 * soundLevel('door-sound')
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  return ctx
}

// one second of white noise, made once and played from a random point each time
let noiseBuffer = null
function noise (a) {
  if (!noiseBuffer) {
    noiseBuffer = a.createBuffer(1, a.sampleRate, a.sampleRate)
    const data = noiseBuffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  }
  const source = a.createBufferSource()
  source.buffer = noiseBuffer
  source.loop = true
  return source
}

// A gain that rises to `peak` over `attack` seconds from `at`, holds, and falls to nothing by `end`.
function envelope (a, at, attack, peak, end) {
  const gain = a.createGain()
  gain.gain.setValueAtTime(0.0001, at)
  gain.gain.exponentialRampToValueAtTime(peak, at + attack)
  gain.gain.setValueAtTime(peak, Math.max(at + attack, end - 0.12))
  gain.gain.exponentialRampToValueAtTime(0.0001, end)
  gain.connect(master)
  return gain
}

// HYDRAULICS: noise through a band-pass whose centre slides from `from` Hz to `to` Hz.
function hiss (a, at, seconds, from, to, peak) {
  const source = noise(a)
  const band = a.createBiquadFilter()
  band.type = 'bandpass'
  band.Q.value = 1.4
  band.frequency.setValueAtTime(from, at)
  band.frequency.exponentialRampToValueAtTime(to, at + seconds)
  source.connect(band).connect(envelope(a, at, Math.min(0.15, seconds / 3), peak, at + seconds))
  source.start(at, Math.random() * 0.5)
  source.stop(at + seconds + 0.05)
}

// THE MOTOR: a low saw, its pitch climbing as the doors gather speed, through a low-pass.
function motor (a, at, seconds, peak) {
  const saw = a.createOscillator()
  saw.type = 'sawtooth'
  saw.frequency.setValueAtTime(38, at)
  saw.frequency.linearRampToValueAtTime(62, at + seconds * 0.8)
  const low = a.createBiquadFilter()
  low.type = 'lowpass'
  low.frequency.value = 260
  saw.connect(low).connect(envelope(a, at, 0.12, peak, at + seconds))
  saw.start(at)
  saw.stop(at + seconds + 0.05)
}

// A THUMP: a sine dropping fast, felt more than heard.
function thump (a, at, from, to, seconds, peak) {
  const sine = a.createOscillator()
  sine.frequency.setValueAtTime(from, at)
  sine.frequency.exponentialRampToValueAtTime(to, at + seconds)
  sine.connect(envelope(a, at, 0.004, peak, at + seconds))
  sine.start(at)
  sine.stop(at + seconds + 0.05)
}

// THE RING OF THE STEEL: partials that are not in tune with each other (which is what makes it
// a slab of metal rather than a bell), each dying at its own rate, over a crack of noise.
function clang (a, at, peak) {
  for (const [hz, seconds, share] of [[97, 1.6, 0.5], [151, 1.3, 0.35], [233, 1.0, 0.28], [367, 0.8, 0.2], [541, 0.55, 0.14], [829, 0.35, 0.1]]) {
    const sine = a.createOscillator()
    sine.frequency.value = hz
    sine.connect(envelope(a, at, 0.003, peak * share, at + seconds))
    sine.start(at)
    sine.stop(at + seconds + 0.05)
  }
  const crack = noise(a)
  const low = a.createBiquadFilter()
  low.type = 'lowpass'
  low.frequency.value = 2400
  crack.connect(low).connect(envelope(a, at, 0.002, peak * 0.9, at + 0.18))
  crack.start(at, Math.random() * 0.5)
  crack.stop(at + 0.25)
  thump(a, at, 90, 32, 0.45, peak)
}

// A BOLT GOING HOME: a short knock of filtered noise and a little ring.
function clunk (a, at, peak) {
  const knock = noise(a)
  const band = a.createBiquadFilter()
  band.type = 'bandpass'
  band.frequency.value = 900
  band.Q.value = 2
  knock.connect(band).connect(envelope(a, at, 0.002, peak, at + 0.09))
  knock.start(at, Math.random() * 0.5)
  knock.stop(at + 0.12)
  thump(a, at, 180, 60, 0.12, peak * 0.6)
}

export function shut (ms) {
  const a = audio()
  if (!a) return
  const now = a.currentTime + 0.01
  const seconds = ms / 1000
  hiss(a, now, seconds, 2200, 700, 0.35)
  motor(a, now, seconds, 0.4)
  clang(a, now + seconds, 0.7)
}

export function lock () {
  const a = audio()
  if (!a) return
  const now = a.currentTime + 0.01
  clunk(a, now, 0.6)
  clunk(a, now + 0.11, 0.5)
}

export function open (ms) {
  const a = audio()
  if (!a) return
  const now = a.currentTime + 0.01
  const seconds = ms / 1000
  // the seal: a sharp burst of air, high and falling
  hiss(a, now, 0.45, 5200, 1800, 0.45)
  hiss(a, now + 0.1, seconds - 0.1, 1600, 500, 0.22)
  motor(a, now + 0.08, seconds - 0.1, 0.32)
  clunk(a, now + seconds - 0.05, 0.45)
}
