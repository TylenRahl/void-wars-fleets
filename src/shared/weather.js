// Weather over the board: rain, storm, fog, snow, dust, ash and aether storms, drawn with PixiJS.
// Exports WEATHER, WEATHER_FOR_FELT, weatherChoice/setWeatherChoice (the saved choice), generator, hazeTexture
// (a tileable cloud) and createWeather; used by src/battle/seaWeather.js.
// Purely visual: it decides nothing and reads no game state. Its randomness is its own small generator,
// never the game's seeded dice, which it must not disturb.
//
// How it looks:
// - fog, dust and the aether's haze are a soft noise texture drifting with the wind, not shapes;
// - every drop and flake has its own size, speed, slant and faintness, and the rain falls
// heavier and lighter in bands that move across the screen;
// - the wind (0 still, 1 breeze, 2 strong) drives the slant, the drift and the haze;
// - SPELLS: the chosen weather comes and goes — it builds, holds, eases off and stays clear
// for a while, then builds again. `changing: false` holds it at full.
//
// A layer drawn over everything else, in SCREEN pixels: createWeather(parent, size) returns
// { set(kind), setWind(n), resize(w, h), tick(seconds), destroy }. The caller drives tick
// from its own frame loop, so a page that has stopped drawing stops the weather too.
import { Container, Graphics, Texture, TilingSprite } from 'pixi.js'

// What each kind is, and what each board colour (felt) may have: rain does not
// fall on the void, snow falls on the snow board, sand blows on the desert and Mars.
export const WEATHER = {
  clear: { label: 'Clear' },
  rain: { label: 'Rain' },
  storm: { label: 'Storm (rain and lightning)' },
  fog: { label: 'Fog' },
  snow: { label: 'Snow' },
  dust: { label: 'Dust storm' },
  ash: { label: 'Falling ash' },
  void: { label: 'Aether storm (lightning)' }
}
export const WEATHER_FOR_FELT = {
  grass: ['clear', 'rain', 'storm', 'fog'],
  desert: ['clear', 'dust', 'storm', 'fog'],
  ash: ['clear', 'ash', 'storm', 'fog'],
  snow: ['clear', 'snow', 'storm', 'fog'],
  mars: ['clear', 'dust', 'storm', 'fog'],
  void: ['clear', 'void', 'fog']
}

// The haze each kind has, if any: colour and how thick at its thickest. Kept faint — it is
// there to be felt more than seen.
const HAZE = { fog: [0xd4d8dc, 0.3], dust: [0xc8a468, 0.24], void: [0x8a5ac0, 0.16], storm: [0x9aa4b0, 0.08], snow: [0xffffff, 0.08] }

// How long a spell lasts, seconds: clear, building, full, easing.
const SPELL = { clear: [25, 50], build: [10, 18], full: [40, 80], ease: [12, 20] }

// THE BATTLE SETUP'S CHOICE, kept per board colour in this browser: a list of WEATHER ids, taken
// in turn. None chosen is a clear sky. Storage can be refused; the choice then lasts the page.
const CHOICE_KEY = 'vwf.weather'
export function weatherChoice (felt) {
  try {
    const stored = JSON.parse(localStorage.getItem(CHOICE_KEY) ?? '{}')[felt]
    if (Array.isArray(stored)) return stored.filter(one => (WEATHER_FOR_FELT[felt] ?? []).includes(one) && one !== 'clear')
  } catch {}
  return []
}
export function setWeatherChoice (felt, list) {
  try {
    const all = JSON.parse(localStorage.getItem(CHOICE_KEY) ?? '{}')
    all[felt] = list
    localStorage.setItem(CHOICE_KEY, JSON.stringify(all))
  } catch {}
}

export function generator (seed = 1) {
  let h = seed >>> 0 || 1
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    h ^= h >>> 16
    h >>>= 0
    return h / 4294967296
  }
}

// A soft, tileable cloud: value noise, four octaves, wrapped at the edges so it repeats unseen.
// Exported so other effects can reuse it.
export function hazeTexture (random, size = 256) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const g = canvas.getContext('2d')
  const image = g.createImageData(size, size)
  const total = new Float32Array(size * size)
  let weight = 0
  for (const [cells, amp] of [[4, 1], [8, 0.5], [16, 0.25], [32, 0.12]]) {
    const grid = Array.from({ length: cells * cells }, () => random())
    const at = (x, y) => grid[((y + cells) % cells) * cells + ((x + cells) % cells)]
    const smooth = t => t * t * (3 - 2 * t)
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const fx = x / size * cells
        const fy = y / size * cells
        const x0 = Math.floor(fx)
        const y0 = Math.floor(fy)
        const sx = smooth(fx - x0)
        const sy = smooth(fy - y0)
        const top = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * sx
        const bottom = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * sx
        total[y * size + x] += (top + (bottom - top) * sy) * amp
      }
    }
    weight += amp
  }
  for (let i = 0; i < total.length; i++) {
    // thin in most places, thicker in drifts: the low values cut away
    const v = Math.max(0, total[i] / weight - 0.42) / 0.58
    image.data[i * 4] = image.data[i * 4 + 1] = image.data[i * 4 + 2] = 255
    image.data[i * 4 + 3] = Math.round(255 * v * v)
  }
  g.putImageData(image, 0, 0)
  return Texture.from(canvas)
}

export function createWeather (parent, { width, height, seed = 7, wind = 1, changing = true } = {}) {
  const random = generator(seed)
  const between = ([a, b]) => a + random() * (b - a)
  const layer = new Container()
  layer.eventMode = 'none'
  parent.addChild(layer)
  const cloud = hazeTexture(random)
  const hazeFar = new TilingSprite({ texture: cloud, width, height })
  const hazeNear = new TilingSprite({ texture: cloud, width, height })
  hazeFar.tileScale.set(3.2)
  hazeNear.tileScale.set(1.9)
  const shade = new Graphics()
  const drops = new Graphics()
  const flash = new Graphics()
  layer.addChild(shade, hazeFar, drops, hazeNear, flash)

  let W = width
  let H = height
  let kind = 'clear'
  // THE CHOSEN WEATHERS, taken in turn: each spell is the next of them, with a clear
  // spell between, round and round.
  let playlist = []
  let turn = 0
  let windLevel = wind
  let particles = []
  let ripples = []
  let t = 0
  let nextStrike = 3
  let strike = null
  // the spell: which part of it, and when that part ends
  let spell = { part: 'full', ends: Infinity, from: 1 }
  let intensity = 1

  const blowing = () => [0.25, 1, 2.6][windLevel] ?? 1

  function newParticle (anywhere) {
    return {
      x: random() * (W + 200) - 100,
      y: anywhere ? random() * H : -30 - random() * 60,
      z: random(), // nearness: 0 far and faint, 1 near
      speed: 0.7 + random() * 0.6,
      slant: (random() - 0.5) * 0.25,
      length: 0.6 + random() * 0.8,
      size: 0.5 + random(),
      phase: random() * Math.PI * 2,
      wobble: 0.5 + random(),
      keep: random() // which drops the lighter bands leave out: fixed, so none flickers
    }
  }

  function fill () {
    const count = { rain: 520, storm: 700, snow: 300, dust: 260, ash: 220 }[kind] ?? 0
    particles = Array.from({ length: count }, () => newParticle(true))
    ripples = []
    nextStrike = t + 3 + random() * 5
    strike = null
  }
  function reseed () {
    fill()
    if (changing && kind !== 'clear') spell = { part: 'full', ends: t + between(SPELL.full), from: 1 }
    else spell = { part: 'full', ends: Infinity, from: 1 }
  }

  // The spell moves on: full -> easing -> clear -> building -> full.
  function advanceSpell () {
    if (t < spell.ends) return
    const next = { full: 'ease', ease: 'clear', clear: 'build', build: 'full' }[spell.part]
    spell = { part: next, ends: t + between(SPELL[next]), start: t }
    // the clear spell is over: the next of the chosen weathers builds
    if (next === 'build' && playlist.length > 1) {
      turn = (turn + 1) % playlist.length
      kind = playlist[turn]
      fill()
    }
  }
  function spellIntensity () {
    if (!changing || kind === 'clear') return kind === 'clear' ? 0 : 1
    advanceSpell()
    const smooth = x => x * x * (3 - 2 * x)
    const along = spell.ends === Infinity ? 1 : Math.min(1, (t - (spell.start ?? t)) / Math.max(0.01, spell.ends - (spell.start ?? t)))
    return { full: 1, clear: 0, build: smooth(along), ease: 1 - smooth(along) }[spell.part]
  }

  function draw (dt) {
    drops.clear()
    flash.clear()
    shade.clear()
    intensity = spellIntensity()
    const wind = blowing()
    // the haze: two layers of the cloud, drifting at their own speeds with the wind
    const haze = HAZE[kind]
    hazeFar.visible = hazeNear.visible = !!haze && intensity > 0
    if (haze) {
      hazeFar.tint = hazeNear.tint = haze[0]
      hazeFar.alpha = haze[1] * 0.7 * intensity
      hazeNear.alpha = haze[1] * 0.55 * intensity
      hazeFar.tilePosition.x += 9 * wind * dt
      hazeFar.tilePosition.y += 1.5 * dt
      hazeNear.tilePosition.x += 22 * wind * dt
      hazeNear.tilePosition.y -= 2 * dt
    }
    if (kind === 'clear' || intensity <= 0.001) return
    // how many of the particles are falling now, and the moving bands of heavier rain
    const shown = Math.floor(particles.length * intensity)
    const band = x => 0.55 + 0.45 * Math.sin(x / 260 - t * 0.35 * wind) * Math.sin(x / 97 + t * 0.2)
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i]
      if (kind === 'rain' || kind === 'storm') {
        const fall = (650 + 650 * p.z) * p.speed
        const across = (40 + 120 * wind) * p.speed + p.slant * fall
        p.y += fall * dt
        p.x += across * dt
        if (p.y > H + 30 || p.x > W + 100) Object.assign(p, newParticle(false))
        if (i >= shown) continue
        const heavy = band(p.x)
        if (p.keep > heavy + 0.25) continue
        const len = (8 + 18 * p.z) * p.length
        const dx = across / fall * len
        drops.moveTo(p.x, p.y).lineTo(p.x - dx, p.y - len)
          .stroke({ width: 0.6 + p.z * 0.7, color: 0xc8d6e4, alpha: (0.08 + 0.24 * p.z) * heavy })
        // a splash where a near drop lands
        if (p.z > 0.8 && random() < 0.03 * intensity) ripples.push({ x: p.x, y: p.y, at: t })
      } else if (kind === 'snow' || kind === 'ash') {
        const fall = (kind === 'snow' ? 34 : 24) * (0.5 + p.z) * p.speed
        p.y += fall * dt
        p.x += (Math.sin(t * p.wobble + p.phase) * 16 + 14 * wind * wind * (0.6 + p.z)) * dt
        if (p.y > H + 10 || p.x > W + 40) Object.assign(p, newParticle(false), { x: random() * W - 40 * wind })
        if (i >= shown) continue
        const r = (kind === 'snow' ? 0.8 + 1.8 * p.z : 0.8 + 1.4 * p.z) * p.size
        if (kind === 'snow') drops.circle(p.x, p.y, r).fill({ color: 0xffffff, alpha: 0.12 + 0.3 * p.z })
        else drops.rect(p.x, p.y, r, r * 0.8).fill({ color: 0x4e4a46, alpha: 0.18 + 0.35 * p.z })
      } else if (kind === 'dust') {
        const speed = (60 + 120 * wind) * (0.5 + p.z) * p.speed
        p.x += speed * dt
        p.y += Math.sin(t * p.wobble + p.phase) * 10 * dt
        if (p.x > W + 20) Object.assign(p, newParticle(true), { x: -20 - random() * 80 })
        if (i >= shown) continue
        const len = (3 + 8 * p.z) * p.length * (0.6 + wind * 0.3)
        drops.moveTo(p.x, p.y).lineTo(p.x - len, p.y)
          .stroke({ width: 0.8 + p.z, color: 0xe0c08a, alpha: (0.1 + 0.28 * p.z) * band(p.x) })
      }
    }
    for (const r of ripples) {
      const age = t - r.at
      if (age > 0.35) continue
      drops.ellipse(r.x, r.y, 1 + age * 14, 0.5 + age * 6).stroke({ width: 0.8, color: 0xd8e4f0, alpha: 0.25 * (1 - age / 0.35) })
    }
    ripples = ripples.filter(r => t - r.at <= 0.35)
    // the storm's dimness, so the lightning has something to light
    if (kind === 'storm') shade.rect(0, 0, W, H).fill({ color: 0x101824, alpha: 0.2 * intensity })
    if (kind === 'void') shade.rect(0, 0, W, H).fill({ color: 0x140a24, alpha: 0.18 * intensity })
    // LIGHTNING AS LIGHT ONLY: now and then the board is lit white for a moment; no bolt is drawn.
    if ((kind === 'storm' || kind === 'void') && intensity > 0.6) {
      if (t >= nextStrike) {
        strike = { at: t }
        nextStrike = t + 4 + random() * 9
      }
    }
    if (strike) {
      const age = t - strike.at
      // two quick pulses, the way lightning flickers, then gone
      const light = age < 0.08 ? 1 : age < 0.16 ? 0.25 : age < 0.26 ? 0.8 : Math.max(0, 0.8 - (age - 0.26) * 3)
      if (light <= 0) strike = null
      else {
        const colour = kind === 'void' ? 0xc8a0ff : 0xeef4ff
        flash.rect(0, 0, W, H).fill({ color: colour, alpha: 0.24 * light })
      }
    }
  }

  return {
    layer,
    get kind () { return kind },
    // how much of it there is now, 0 to 1 (the spells)
    get intensity () { return intensity },
    // One weather, or a list of them to take in turn. 'clear' in a list is no weather; a list
    // with nothing else in it is a clear sky.
    set (next) {
      playlist = (Array.isArray(next) ? next : [next]).filter(one => WEATHER[one] && one !== 'clear')
      turn = 0
      kind = playlist[0] ?? 'clear'
      reseed()
      draw(0)
    },
    // the chosen weathers, and the one in its spell now
    get playlist () { return [...playlist] },
    setWind (level) { windLevel = level },
    setChanging (on) {
      changing = on
      reseed()
    },
    resize (w, h) {
      W = w
      H = h
      hazeFar.width = hazeNear.width = w
      hazeFar.height = hazeNear.height = h
      reseed()
    },
    // `seconds` since the last tick; a long pause (a hidden tab) is cut short, not caught up.
    tick (seconds) {
      const dt = Math.min(0.1, Math.max(0, seconds))
      t += dt
      draw(dt)
    },
    destroy () {
      layer.destroy({ children: true })
      cloud.destroy(true)
    }
  }
}
