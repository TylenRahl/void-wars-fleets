// Things that move on the battle board: ships gliding, shots, explosions, shields flaring, teleports, boarding fights and
// attack craft. battle.js calls play(e) for each rules event, frame() every animation frame, and glide/drawnAt to move ships.
//
// GLIDING: the engine moves a ship at once; the board draws it gliding there, at a speed that depends on how far is
// left (fast, then easing in). A ship that has a planned path follows it, turns and all.
//
// SHOTS, drawn in SVG: every piece
// is a function of its progress k (0..1) redrawn each frame, eased out (k => 1 - (1-k)^2).
// lances a beam: rises 80 ms, holds 300, fades 250; glow + white core; Freemen blue
// (0x5070ff), Dominion red (0xff3020); a "punch" impact (ring, cross streaks, sparks)
// weapons battery a muzzle bloom, then rounds with a three-colour fire trail flying
// 550 ms, staggered; hits end in an orange "puff", misses fly past and fade
// sunburst cannon a heavy shell, then an "ordnance" fireball with a white shock ring
// shields a blue shimmer ring on the ship for each hit a shield stops
// explosion a ship destroyed: the ordnance fireball, large
// The rules have already been decided when these play: they show the result, they never change it.
// Units: centimetres, the board's own; the effect sizes below are written in inches and scaled by SCALE.

import { sizeOf } from '../data/ships.js'
import { SEA_GROW } from '../view/seaPictures.js'
import { shieldStyleFor, shieldColour, drawCollapse, COLLAPSE_MS, fieldStyleFor } from '../view/shieldFx.js'
let shieldId = 'burst', fieldId = 'mirage'
export function setShieldStyle (id) { shieldId = id }
export function setFieldStyle (id) { fieldId = id }   // the mirage field style
const SCALE = 2.2            // one inch of effect size drawn in cm here: the ships are drawn big
// scatter for the look of a shot: its own little generator, never the game's dice and never Math.random (a seeded game
// replays identically; this touches nothing the rules read)
let lookSeed = 20261106
const look = () => { lookSeed = (lookSeed * 1664525 + 1013904223) >>> 0; return lookSeed / 4294967296 }
const out = k => 1 - (1 - k) * (1 - k)
const rgb = n => '#' + n.toString(16).padStart(6, '0')
const ORANGE = 0xff8a28, HOT = 0xfff0b0
const LOOK = {
  lance: [{ glow: 0x5070ff, core: 0xe8f0ff }, { glow: 0xff3020, core: 0xffe4d8 }],   // Freemen, Dominion
}

// the sounds, on the beat of the picture: battle.js gives this the player from sound.js
let heard = () => {}
export function setHeard (f) { heard = f }
// the two muzzle flash pictures (public/images/fx-*-flash-00N.png, two frames, 55 ms each): las for lances, cannon for batteries
const FLASH = { las: ['/images/fx-las-flash-000.png', '/images/fx-las-flash-001.png'], cannon: ['/images/fx-cannon-flash-000.png', '/images/fx-cannon-flash-001.png'] }
function flash (kind, p, delay, size) {
  add(delay, 110, k => `<image href="${FLASH[kind][k < 0.5 ? 0 : 1]}" x="${(p.x - size / 2).toFixed(2)}" y="${(p.y - size / 2).toFixed(2)}" width="${size}" height="${size}" opacity="${k < 0.5 ? 1 : (2 - 2 * k).toFixed(2)}" style="pointer-events:none;image-rendering:pixelated"/>`)
}

// ---------------- the pieces ----------------
let pieces = []       // { t0, dur, draw(k, now) -> svg string }
let clock = () => performance.now()
let speed = 1
const add = (delay, dur, draw) => pieces.push({ t0: clock() + delay / speed, dur: dur / speed, draw })

const disc = (x, y, r, c, a = 1) => r > 0.02 && a > 0.01 ? `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${r.toFixed(2)}" fill="${rgb(c)}" fill-opacity="${a.toFixed(3)}"/>` : ''
const line = (a, b, w, c, al = 1) => `<line x1="${a.x.toFixed(2)}" y1="${a.y.toFixed(2)}" x2="${b.x.toFixed(2)}" y2="${b.y.toFixed(2)}" stroke="${rgb(c)}" stroke-width="${w.toFixed(3)}" stroke-opacity="${al.toFixed(3)}" stroke-linecap="round"/>`
const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
const bits = n => Array.from({ length: n }, () => look())
function sparks (p, ang, n, reach, len, c, w, k, b) {
  let h = ''
  const e = out(k), fade = 1 - k
  for (let i = 0; i < n; i++) {
    const a = ang + b[i * 2 % b.length] * Math.PI * 2, d = reach * e * (0.55 + 0.45 * b[(i * 2 + 1) % b.length])
    const tail = Math.max(0, d - len * (1 - k * 0.5))
    h += line({ x: p.x + Math.cos(a) * Math.max(tail, d * 0.15), y: p.y + Math.sin(a) * Math.max(tail, d * 0.15) }, { x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d }, w, c, Math.min(1, fade * 1.6))
  }
  return h
}
// impacts (impacts.js): 'puff' for batteries, 'punch' for lances, 'fireball' for the sunburst cannon and explosions
function impact (kind, p, ang, inches, ms, colour, accent, delay) {
  const R = inches * SCALE, b = bits(24)
  add(delay, ms, k => {
    const e = out(k), fade = 1 - k
    if (kind === 'puff') return disc(p.x, p.y, R * (0.5 + 0.5 * e), 0x3a3430, 0.55 * fade) + disc(p.x, p.y, R * (0.25 + 0.55 * e), colour, Math.min(1, fade * 1.7)) +
      (k < 0.45 ? disc(p.x, p.y, R * 0.5 * (1 - k / 0.45) + 0.1, accent, 1) : '') + sparks(p, ang, 7, R * 1.15, R * 0.3, accent, 0.045 * SCALE, k, b)
    if (kind === 'punch') {
      let h = disc(p.x, p.y, R * 0.55 * (1 - k * 0.7), accent, 1) + disc(p.x, p.y, R * (0.45 + 0.4 * e), colour, 0.55 * fade) +
        `<circle cx="${p.x}" cy="${p.y}" r="${(R * (0.3 + 0.7 * e)).toFixed(2)}" fill="none" stroke="${rgb(colour)}" stroke-width="${Math.max(0.08, 0.09 * SCALE * fade).toFixed(3)}" stroke-opacity="${fade.toFixed(3)}"/>`
      for (let i = 0; i < 4; i++) { const a = ang + i * Math.PI / 2 + Math.PI / 4, L = R * (i % 2 ? 1.25 : 1.55) * e; h += line(p, { x: p.x + Math.cos(a) * L, y: p.y + Math.sin(a) * L }, 0.07 * SCALE * fade + 0.05, accent, fade) }
      return h + sparks(p, ang, 6, R * 1.2, R * 0.3, colour, 0.04 * SCALE, k, b)
    }
    // fireball / ordnance (impacts.js l.256): smoke, a grey ring, red-orange-yellow blobs, and a white shock ring
    return disc(p.x, p.y, R * (0.6 + 0.6 * e), 0x2a2420, 0.6 * fade) +
      `<circle cx="${p.x}" cy="${p.y}" r="${(R * (0.4 + 1.1 * e)).toFixed(2)}" fill="none" stroke="#ffffff" stroke-width="${(0.12 * SCALE * fade).toFixed(3)}" stroke-opacity="${(0.8 * fade).toFixed(3)}"/>` +
      disc(p.x, p.y, R * (0.35 + 0.6 * e), 0xc02a10, 0.9 * fade) + disc(p.x, p.y, R * (0.25 + 0.45 * e), colour, Math.min(1, fade * 1.5)) +
      disc(p.x, p.y, R * 0.35 * (1 - k), accent, 1) + sparks(p, ang, 12, R * 1.5, R * 0.4, HOT, 0.05 * SCALE, k, b)
  })
}
// muzzles: the battery bloom — three tapered petals and a white-hot root — and the lance ring
function bloom (p, ang, delay, inches = 0.6, ms = 110) {
  const R = inches * SCALE
  add(delay, ms, k => {
    const e = out(k), fade = 1 - k, L = R * (0.4 + 0.6 * e)
    let h = ''
    for (const [da, l] of [[-0.5, 0.65], [0, 1], [0.5, 0.65]]) {
      const a = ang + da, tip = { x: p.x + Math.cos(a) * L * l, y: p.y + Math.sin(a) * L * l }, w = L * 0.18
      h += `<polygon points="${p.x - Math.sin(a) * w},${p.y + Math.cos(a) * w} ${tip.x},${tip.y} ${p.x + Math.sin(a) * w},${p.y - Math.cos(a) * w}" fill="${rgb(ORANGE)}" fill-opacity="${fade.toFixed(3)}"/>`
    }
    return disc(p.x, p.y, R * 0.5, 0x6a6460, 0.35 * fade) + h + disc(p.x, p.y, R * 0.22 * fade + 0.08, HOT, 1)
  })
}
function ring (p, colour, accent, delay) {
  const R = 0.4 * SCALE
  add(delay, 100, k => disc(p.x, p.y, R * 0.3 * (1 - k) + 0.08, accent, 1) +
    `<circle cx="${p.x}" cy="${p.y}" r="${(R * (0.2 + 0.8 * out(k))).toFixed(2)}" fill="none" stroke="${rgb(colour)}" stroke-width="${Math.max(0.06, 0.05 * SCALE * (1 - k)).toFixed(3)}" stroke-opacity="${(1 - k).toFixed(3)}"/>`)
}

/** A beam from a to b (rise 80, hold 300, fade 250 ms). */
function beam (a, b, colours, delay, side = 0) {
  const rise = 80, hold = 300, fade = 250
  heard(`lance-${side}`, delay)
  flash('las', a, delay, 3.2)
  ring(a, colours.glow, colours.core, delay)
  add(delay + 55, rise + hold + fade, (k, t) => {
    const ms = k * (rise + hold + fade), al = ms < rise ? ms / rise : ms < rise + hold ? 1 : 1 - (ms - rise - hold) / fade
    return line(a, b, 0.34 * SCALE, colours.glow, 0.55 * al) + line(a, b, 0.11 * SCALE, colours.core, al)
  })
  impact('punch', b, Math.atan2(b.y - a.y, b.x - a.x), 1.25, 380, colours.glow, colours.core, delay + 55 + rise)
}
// ---- a broadside: many small shells, rippling out gun by gun, slow enough to watch cross the table. Only the rolled hits land;
// the rest of the salvo goes wide and past. It shows the result, it never changes it.
const SHELL_SPEED = 38      // cm a second
const RIPPLE_MS = 55        // between one shell leaving and the next
function shell (a, b, delay, ms, hit) {
  const d = Math.hypot(b.x - a.x, b.y - a.y) || 1, ux = (b.x - a.x) / d, uy = (b.y - a.y) / d
  add(delay, ms, k => {
    const head = lerp(a, b, k), L = Math.min(2.2, d * k), fade = hit ? 1 : 1 - k * k
    return line(head, { x: head.x - ux * L, y: head.y - uy * L }, 0.14, 0xff9a2a, 0.5 * fade) + line(head, { x: head.x - ux * L * 0.4, y: head.y - uy * L * 0.4 }, 0.08, 0xfff0b0, 0.9 * fade) + disc(head.x, head.y, 0.13, 0xfff6d8, fade)
  })
  if (hit) impact('puff', b, Math.atan2(uy, ux), 0.7, 340, ORANGE, HOT, delay + ms)
}
function salvo (e, target, pos) {
  const { ms, tips } = turnGuns(e, target, pos), rounds = Math.max(14, Math.min(44, 10 + (e.dice ?? 4) * 4)), hits = Math.min(e.hits ?? 0, rounds)
  let last = 0
  for (let i = 0; i < rounds; i++) {
    const a = tips[i % tips.length], hit = Math.floor((i + 1) * hits / rounds) > Math.floor(i * hits / rounds)
    const spread = hit ? 2.2 : 9, aim = { x: target.x + (look() - 0.5) * spread, y: target.y + (look() - 0.5) * spread }
    const d = Math.hypot(aim.x - a.x, aim.y - a.y), flight = Math.max(450, Math.min(2600, d / SHELL_SPEED * 1000)), past = hit ? 1 : 1.35   // a miss flies on past
    const at = ms + i * RIPPLE_MS + look() * 40
    if (i % 4 === 0) heard('battery', at)
    flash('cannon', a, at, 1.3); bloom(a, Math.atan2(aim.y - a.y, aim.x - a.x), at, 0.22, 90)
    shell(a, lerp(a, aim, past), at, flight * past, hit)
    last = Math.max(last, at + (hit ? flight : 0))
  }
  lag = Math.max(lag, ms, last - 450)
}

// ---- a ship leaves the battle through a miniature wormhole
let artOf = null
export function setArtOf (f) { artOf = f }
function wormhole (e, pos) {
  const ms = 2000, ship = e.ship, from = { ...e.to }, f = ship.facing, c = { x: from.x + Math.cos(f * Math.PI / 180) * 6, y: from.y + Math.sin(f * Math.PI / 180) * 6 }, art = artOf?.(ship), b = bits(16)
  heard('aether', 0)
  add(0, ms, k => {
    const open = Math.min(1, k / 0.22), shut = k > 0.78 ? 1 - (k - 0.78) / 0.22 : 1, R = 6 * open * shut, spin = k * 14
    let h = disc(c.x, c.y, R * 1.25, 0x5a2ad0, 0.22 * shut)
    for (let arm = 0; arm < 3; arm++) {
      const pts = []
      for (let i = 0; i <= 16; i++) { const t = i / 16, a = spin + arm * 2.094 + t * 5.2, r = R * (1.15 - t); pts.push(`${(c.x + Math.cos(a) * r).toFixed(2)},${(c.y + Math.sin(a) * r).toFixed(2)}`) }
      h += `<polyline points="${pts.join(' ')}" fill="none" stroke="#a080ff" stroke-width="0.5" stroke-opacity="${(0.8 * shut).toFixed(2)}" stroke-linecap="round"/><polyline points="${pts.join(' ')}" fill="none" stroke="#e8f0ff" stroke-width="0.16" stroke-opacity="${shut.toFixed(2)}"/>`
    }
    h += disc(c.x, c.y, R * 0.42, 0x02020a, 1) + `<circle cx="${c.x}" cy="${c.y}" r="${(R * 0.44).toFixed(2)}" fill="none" stroke="#c8e0ff" stroke-width="0.25" stroke-opacity="${shut.toFixed(2)}"/>`
    // the ship is drawn in, spinning and shrinking
    const t = Math.max(0, Math.min(1, (k - 0.15) / 0.55)), go = t * t, p = lerp(from, c, go), scale = 1 - go, len = art?.len ?? 6
    if (art && scale > 0.02) h += `<image href="${art.href}" x="${(p.x - len * scale / 2).toFixed(2)}" y="${(p.y - len * scale / 2).toFixed(2)}" width="${(len * scale).toFixed(2)}" height="${(len * scale).toFixed(2)}" transform="rotate(${(f + 90 + go * 540).toFixed(1)} ${p.x.toFixed(2)} ${p.y.toFixed(2)})" style="pointer-events:none"/>`
    if (k > 0.72 && k < 0.92) { const q = (k - 0.72) / 0.2; h += disc(c.x, c.y, 3.5 * (1 - q) + 0.2, 0xffffff, 1 - q) + `<circle cx="${c.x}" cy="${c.y}" r="${(2 + q * 10).toFixed(2)}" fill="none" stroke="#c0a0ff" stroke-width="0.3" stroke-opacity="${(1 - q).toFixed(2)}"/>` + sparks(c, 0, 10, 8, 2, 0xc0a0ff, 0.1, q, b) }
    return h
  })
}

// guns turn before they fire (guns.js): the shots start after the longest turn, from the barrel tips.
// battle.js gives the aiming function; without one (the tests) shots start at the ship.
let aimGuns = null, lag = 0, lead = 0
export function setAimGuns (f) { aimGuns = f }
/** A new action: shields and explosions after this wait only for its own guns to turn. */
export function newAction (flyIn = 0) { lag = flyIn; lead = flyIn }
function turnGuns (e, target, pos) {
  let ms = lead   // the camera flies in first (battle.js cinematic zoom)
  const tips = []
  for (const shot of e.shots ?? e.from.map(ship => ({ ship }))) {
    const g = aimGuns?.(shot.ship, shot.weapon, target)
    if (g?.tips.length) { ms = Math.max(ms, g.ms); tips.push(...g.tips) } else tips.push(pos(shot.ship))
  }
  return { ms, tips }
}

// ---------------- what the game asks for ----------------
/**
 * Play one rules event (the engine's game.onFx; src/rules/shooting.js, damage.js). pos(ship) gives where the ship is
 * drawn now (it may be gliding). e: { kind, from: [ships], to: ship | point, hits, dice, side }.
 */
export function play (e, pos) {
  if (sea && seaPlay(e, pos)) return
  if (e.kind === 'pulse') return pulse(e, pos)
  const target = e.to?.uid != null ? pos(e.to) : e.to
  if (!target) return
  if (e.kind === 'lance') {
    const colours = LOOK.lance[e.side ?? 0], { ms, tips } = turnGuns(e, target, pos)
    lag = Math.max(lag, ms)
    for (let n = 0; n < Math.max(1, Math.min(8, tips.length)); n++) {
      const hit = n < e.hits, off = hit ? { x: 0, y: 0 } : { x: (look() - 0.5) * 6, y: (look() - 0.5) * 6 }
      beam(tips[n % tips.length], { x: target.x + off.x + (look() - 0.5) * 1.2, y: target.y + off.y + (look() - 0.5) * 1.2 }, colours, ms + n * 200 + look() * 90, e.side ?? 0)
    }
  } else if (e.kind === 'battery') {
    salvo(e, target, pos)
  } else if (e.kind === 'sunburst') {
    const a = pos(e.from[0]), d = Math.hypot(target.x - a.x, target.y - a.y)
    heard('sunburst', lead); heard('boom-big', lead + 850)
    bloom(a, Math.atan2(target.y - a.y, target.x - a.x), lead, 1.6, 220)
    add(lead + 150, 700, k => { const p = lerp(a, target, k); return disc(p.x, p.y, 0.9, 0xffd060, 1) + disc(p.x, p.y, 1.6, 0xff8a28, 0.35) })
    impact('fireball', target, 0, 2.6, 800, ORANGE, HOT, lead + 850)
    void d
  } else if (e.kind === 'shields') {
    // the shield style (view/shieldFx.js), on the side the hit came from, sized to the ship picture
    const colour = shieldColour(e.to.profile.fleet, e.to.side), style = shieldStyleFor(e.to.profile.fleet, shieldId)   // Isos hex, Rukka arcs; the rest the game's shield style
    const a0 = e.from ? Math.atan2(e.from.y - target.y, e.from.x - target.x) : look() * Math.PI * 2
    const base = (e.delay ?? 450) + lag
    // At sea the same styles, drawn
    // round the long hull: the round bubble squashed into the ellipse the standing ward uses (battle.js shieldBubbleSvg).
    const W = wardShape(e.to), r = W.rx, rot = W.rot, sq = W.ry / W.rx
    const a = sea ? Math.atan2(Math.sin(a0 - rot * Math.PI / 180) / sq, Math.cos(a0 - rot * Math.PI / 180)) : a0
    const frame = sea ? g => `<g transform="translate(${target.x.toFixed(2)} ${target.y.toFixed(2)}) rotate(${rot.toFixed(1)}) scale(1 ${sq.toFixed(3)})">${g}</g>` : g => g
    const at = sea ? { x: 0, y: 0 } : { x: target.x, y: target.y }
    let s
    for (let i = 0; i < Math.min(6, e.n); i++) {
      s = { ...at, r, a: a + (look() - 0.5) * 0.5, b: bits(24), ...colour }
      const one = s
      add(base + i * 90, style.ms, k => frame(style.draw(one, k)))
    }
    if (e.down) { const one = s; add(base + e.n * 90 + 150, COLLAPSE_MS, k => frame(drawCollapse(one, k))) }
  } else if (e.kind === 'field') {
    // a mirage field or void field save (rules/mirage field.js fieldSave): the chosen field style on the ship, once per roll, a miss and then a hit if there are both
    const art = artOf?.(e.to), colour = shieldColour(e.to.profile.fleet, e.to.side), style = fieldStyleFor(e.to.profile.fleet, fieldId)
    if (art) {
      const base = (e.delay ?? 450) + lag, r = 3 * sizeOf(e.to.profile) / 2 * 0.95, a = e.from ? Math.atan2(e.from.y - target.y, e.from.x - target.x) : look() * Math.PI * 2
      let n = 0
      for (const saved of [true, false]) {
        if (!(saved ? e.saved : e.through)) continue
        const s = { x: target.x, y: target.y, r, a, b: bits(24), ...colour, href: art.href, size: art.len, rot: (e.to.facing ?? 0) + 90, key: `${e.to.uid}${saved ? 's' : 't'}`, saved }
        add(base + n++ * style.ms * 0.6, style.ms, k => style.draw(s, k))
      }
    }
  } else if (e.kind === 'explode') {
    heard(e.big ? 'boom-big' : 'boom', (e.delay ?? 600) + lag)
    impact('fireball', target, 0, e.big ? 4 : 2.2, e.big ? 1100 : 750, ORANGE, HOT, (e.delay ?? 600) + lag)
  } else if (e.kind === 'torpedo') {
    heard('hit', 0)
    impact('fireball', target, 0, 1.6, 600, ORANGE, HOT, 0)
  } else if (e.kind === 'wormhole') {
    wormhole(e, pos)
  } else if (e.kind === 'launch') {
    heard('launch', 0)
    bloom(target, 0, 0, 1.0, 200)
  }
}

// The Katharos' sun flare and Ossuary: an area effect around the ship, so no target; rings spreading out to the weapon's range (e.radius, cm).
// The sun flare is a cold green-white flash with three rings; the Ossuary a violet swell with thinner, slower ripples and rays (a wave of psychic force).
function pulse (e, pos) {
  const c = pos(e.from), R = e.radius ?? 20, psychic = !!e.ossuary
  const glow = psychic ? 0xb070ff : 0x6dffb0, core = psychic ? 0xf0e0ff : 0xeafff2
  heard('aether', 0)
  add(0, 260, k => disc(c.x, c.y, 2.2 + 2.5 * k, core, 1 - k) + disc(c.x, c.y, 3 + 4 * k, glow, 0.5 * (1 - k)))   // the flash at the ship
  const rings = psychic ? 4 : 3, ms = psychic ? 1500 : 1000
  for (let i = 0; i < rings; i++) {
    add(i * (psychic ? 220 : 160), ms, k => {
      const r = R * out(k), fade = 1 - k
      let h = `<circle cx="${c.x.toFixed(2)}" cy="${c.y.toFixed(2)}" r="${r.toFixed(2)}" fill="none" stroke="${rgb(glow)}" stroke-width="${(psychic ? 0.25 : 0.45) * (0.4 + fade)}" stroke-opacity="${(0.9 * fade).toFixed(3)}"/>`
      if (i === 0) h += disc(c.x, c.y, r, glow, 0.16 * fade)   // the swept area, faint
      if (psychic && i === 0) for (let n = 0; n < 12; n++) { const a = n * Math.PI / 6 + k * 0.6; h += line({ x: c.x + Math.cos(a) * r * 0.55, y: c.y + Math.sin(a) * r * 0.55 }, { x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r }, 0.12, core, 0.6 * fade) }
      return h
    })
  }
  if (!psychic) add(120, 700, k => `<circle cx="${c.x.toFixed(2)}" cy="${c.y.toFixed(2)}" r="${(R * out(k)).toFixed(2)}" fill="none" stroke="#ffffff" stroke-width="${(0.2 * (1 - k)).toFixed(3)}" stroke-opacity="${(0.7 * (1 - k)).toFixed(3)}" stroke-dasharray="0.8 1.2"/>`)
}

/** The shots' SVG for this moment, and whether anything is still playing. map(p) moves a point to where it is drawn. */
export function frame () {
  const now = clock()
  let h = ''
  pieces = pieces.filter(p => now < p.t0 + p.dur)
  for (const p of pieces) { if (now < p.t0) continue; h += p.draw(Math.min(1, (now - p.t0) / p.dur), now - p.t0) }
  return { svg: h, busy: pieces.length > 0 }
}
export const busy = () => pieces.length > 0
export function setSpeed (s) { speed = s }

// ---------------- gliding ----------------
// the glide: speed = clamp(left * 5 per second, 7, 34) inches a second; here x2.54 for cm.
const MIN = 8, MAX = 28, PER = 1.5   // cm a second; slowed down from that, ships are heavy
const glides = new Map()   // key -> { x, y, f, way: [{x, y, f}], ship }
const norm180 = a => ((a % 360) + 540) % 360 - 180
const TURN = 90   // degrees a second a ship turns on the spot
/** Tell the board where a thing is drawn now and the path to its new place (waypoints, the last its new spot). A ship
 * (opts.ship) moves, then turns, never both at once: it turns on the spot to face each leg, runs the leg straight, and at the end turns
 * to its new facing. Without opts.steer (a drift, a pull) it does not turn to face the way it is pushed. */
export function glide (key, from, way, opts = {}) { glides.set(key, { x: from.x, y: from.y, f: from.f, way: way.map(p => ({ ...p })), ship: !!opts.ship, steer: !!opts.steer }) }
/** Where to draw a thing now: its glide position, or where it is. */
export function drawnAt (key, x, y, f) {
  const g = glides.get(key)
  return g ? { x: g.x, y: g.y, f: g.f } : { x, y, f }
}
// turn g towards `to` by at most `room` degrees; true once it faces it
function turnTo (g, to, room) {
  const d = norm180(to - g.f)
  if (Math.abs(d) <= room) { g.f = to; return true }
  g.f += Math.sign(d) * room
  return false
}
/** Step every glide by dt seconds; true while any is still moving. */
export function stepGlides (dt) {
  for (const [key, g] of glides) {
    if (g.ship && g.f != null) { stepShip(key, g, dt); continue }
    let left = 0, p = g
    for (const w of g.way) { left += Math.hypot(w.x - p.x, w.y - p.y); p = w }
    if (!g.way.length || left < 0.05) { glides.delete(key); continue }
    let step = Math.min(MAX, Math.max(MIN, left * PER)) * dt
    while (step > 0 && g.way.length) {
      const w = g.way[0], d = Math.hypot(w.x - g.x, w.y - g.y)
      if (d <= step) { g.x = w.x; g.y = w.y; g.f = w.f ?? g.f; step -= d; g.way.shift(); continue }
      g.x += (w.x - g.x) / d * step; g.y += (w.y - g.y) / d * step
      const travel = Math.atan2(w.y - g.y, w.x - g.x) * 180 / Math.PI
      g.f += norm180((w.f ?? travel) - g.f) * Math.min(1, dt * 8)
      step = 0
    }
  }
  return glides.size > 0
}
function stepShip (key, g, dt) {
  let left = 0, p = g
  for (const w of g.way) { left += Math.hypot(w.x - p.x, w.y - p.y); p = w }
  let step = Math.min(MAX, Math.max(MIN, left * PER)) * dt, room = TURN * dt
  while (g.way.length) {
    const w = g.way[0], d = Math.hypot(w.x - g.x, w.y - g.y)
    if (d < 0.01) {   // at the waypoint: turn on the spot to the facing it ends with, then on to the next leg
      if (w.f != null && !turnTo(g, w.f, room)) return
      room = 0; g.way.shift(); continue
    }
    if (g.steer && !turnTo(g, Math.atan2(w.y - g.y, w.x - g.x) * 180 / Math.PI, room)) return   // face the leg first
    if (step <= 0) return
    if (d <= step) { g.x = w.x; g.y = w.y; step -= d; continue }
    g.x += (w.x - g.x) / d * step; g.y += (w.y - g.y) / d * step
    return
  }
  glides.delete(key)
}
export const gliding = () => glides.size > 0

// ======================================== AT SEA ========================================
// TIDES OF THE ARCHIPELAGO, the sea skin. Every shot
// at sea is drawn in its fleet's own weapons, from the side of the ship facing the target, with a muzzle flare; a hit bursts on
// the ship with fire, smoke and flying debris, a miss throws up a splash in the water. Sounds are the recorded ones only
// (sound.js 'sea-' keys), never the space cannon takes.
// Human fleet lances: rail gun slugs (blue-white streak) batteries: turret shells, grey muzzle smoke
// Elf fleet lances: sun mirror (gold) or rune crystal (green) batteries: storm ballista bolts
// Orc fleet lances: zap guns (green lightning) batteries: cannon fireballs
// Dominion fleet lances: red lasers batteries: shells with red tracers
let sea = false
export function setSea (v) { sea = !!v }
// the sea pictures are drawn SEA_GROW x the space length (view/seaPictures.js), so the sea effects use the same length
const seaLen = ship => 3 * sizeOf(ship.profile) * SEA_GROW
/** The shield bubble round a ship, in cm: a circle in space, an ellipse along the hull at sea. One shape for the standing
 * ward (battle.js) and the hit effects here, so the flare lands on the bubble you see. rot is the hull's heading in degrees. */
export function wardShape (ship) {
  if (!sea) { const r = 3 * sizeOf(ship.profile) / 2 * 0.95; return { rx: r, ry: r, rot: 0 } }
  const len = seaLen(ship)
  return { rx: len * 0.5, ry: len * 0.2, rot: ship.facing ?? 0 }
}
const fleetOf = ship => ship?.profile?.fleet ?? 'freemen'
// where the shots leave a ship at sea: points down its side nearest the target (the pictures' guns, not the space blueprint's)
function seaTips (e, target, pos) {
  const tips = []
  for (const shot of e.shots?.length ? e.shots : (e.from ?? []).map(ship => ({ ship }))) {
    const p = pos(shot.ship), len = seaLen(shot.ship), f = (shot.ship.facing ?? 0) * Math.PI / 180
    const ax = Math.cos(f), ay = Math.sin(f), tx = target.x - p.x, ty = target.y - p.y, d = Math.hypot(tx, ty) || 1
    const side = (ax * ty - ay * tx) > 0 ? 1 : -1, w = shot.ship.profile.weapons?.[shot.weapon]
    const along = w?.loc === 'prow' ? 0.35 : w?.loc === 'dorsal' ? 0.05 : (look() - 0.5) * 0.6
    const out = w?.loc === 'prow' || w?.loc === 'dorsal' ? 0 : 0.16
    tips.push({ x: p.x + ax * len * along + (-ay * side) * len * out, y: p.y + ay * len * along + (ax * side) * len * out, w, fleet: fleetOf(shot.ship) })
  }
  return tips
}
// a splash where a shot hits the water: a white column, a spreading ring, droplets thrown out, a foam patch
function splash (p, size, delay) {
  const b = bits(16)
  add(delay, 900, k => {
    const e = out(k), fade = 1 - k
    let h = disc(p.x, p.y, size * (0.4 + 0.5 * e), 0xeafaff, 0.35 * fade) + `<circle cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}" r="${(size * (0.3 + 1.4 * e)).toFixed(2)}" fill="none" stroke="#ffffff" stroke-width="${(0.18 * fade).toFixed(3)}" stroke-opacity="${(0.8 * fade).toFixed(2)}"/>`
    if (k < 0.5) h += disc(p.x, p.y, size * 0.45 * (1 - k * 2) + 0.05, 0xffffff, 0.9)
    for (let i = 0; i < 8; i++) { const a = b[i] * Math.PI * 2, d = size * (0.4 + 1.2 * e) * (0.6 + 0.4 * b[i + 8]); h += disc(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, size * 0.09 * fade + 0.02, 0xffffff, fade) }
    return h
  })
}
// a hit on a ship: a flash, fire, smoke drifting off and debris flying
function burst (p, size, delay, colour = ORANGE) {
  const b = bits(24)
  add(delay, 1100, k => {
    const e = out(k), fade = 1 - k
    let h = disc(p.x + e * size * 0.6, p.y + e * size * 0.4, size * (0.5 + 0.9 * e), 0x2a2622, 0.55 * fade)
    h += disc(p.x, p.y, size * (0.35 + 0.5 * e), colour, Math.min(1, fade * 1.6)) + (k < 0.35 ? disc(p.x, p.y, size * 0.5 * (1 - k / 0.35) + 0.05, HOT, 1) : '')
    for (let i = 0; i < 7; i++) { const a = b[i] * Math.PI * 2, d = size * 1.6 * e * (0.5 + 0.5 * b[i + 7]); h += `<rect x="${(p.x + Math.cos(a) * d - 0.12).toFixed(2)}" y="${(p.y + Math.sin(a) * d - 0.08).toFixed(2)}" width="0.24" height="0.16" fill="#2a2420" opacity="${fade.toFixed(2)}" transform="rotate(${(b[i + 14] * 360 + k * 400).toFixed(0)} ${(p.x + Math.cos(a) * d).toFixed(2)} ${(p.y + Math.sin(a) * d).toFixed(2)})"/>` }
    return h + sparks(p, b[0] * 6, 8, size * 1.3, size * 0.35, HOT, 0.08, k, b)
  })
}
// a muzzle flare: a bright flash and a puff of smoke (cannons), a ring of light (energy weapons)
function flare (p, ang, delay, kind, colour) {
  if (kind === 'smoke' || kind === 'fire') { bloom(p, ang, delay, kind === 'fire' ? 0.5 : 0.3, 120); add(delay + 40, 900, k => disc(p.x + Math.cos(ang) * k * 1.4, p.y + Math.sin(ang) * k * 1.4, 0.3 + k * 1.1, kind === 'fire' ? 0x2a2420 : 0xb8bcc0, 0.5 * (1 - k))) }
  else add(delay, 160, k => disc(p.x, p.y, 0.25 + k * 0.9, colour, 1 - k) + `<circle cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}" r="${(0.3 + k * 1.6).toFixed(2)}" fill="none" stroke="${rgb(colour)}" stroke-width="0.12" stroke-opacity="${(1 - k).toFixed(2)}"/>`)
}
// a shot that flies: a projectile drawn by `draw(head, ux, uy, k)` from a to b, then a burst (hit) or a splash (miss, past b)
function flyer (a, b, delay, ms, hit, draw, size) {
  const d = Math.hypot(b.x - a.x, b.y - a.y) || 1, ux = (b.x - a.x) / d, uy = (b.y - a.y) / d
  add(delay, ms, k => draw(lerp(a, b, k), ux, uy, k))
  if (hit) burst(b, size, delay + ms)
  else splash(b, size * 0.9, delay + ms)
}
const SEA_LANCE = { freemen: 'rail', athanatoi: 'crystal', rukka: 'zap', dominion: 'laser' }
const SEA_LANCE_SOUND = { rail: 'sea-rail', crystal: 'sea-crystal', mirror: 'sea-crystal', zap: 'sea-zap', laser: 'sea-laser' }
function seaLance (e, target, pos) {
  const tips = seaTips(e, target, pos), n = Math.max(1, Math.min(8, tips.length)), base = lead
  for (let i = 0; i < n; i++) {
    const t = tips[i % tips.length], hit = i < (e.hits ?? 0), at = base + i * 220 + look() * 90
    const style = t.fleet === 'athanatoi' && t.w?.loc === 'prow' && t.w?.kind === 'starlance' ? 'mirror' : SEA_LANCE[t.fleet] ?? 'rail'
    const aim = hit ? { x: target.x + (look() - 0.5) * 1.6, y: target.y + (look() - 0.5) * 1.6 } : { x: target.x + (look() - 0.5) * 9, y: target.y + (look() - 0.5) * 9 }
    const ang = Math.atan2(aim.y - t.y, aim.x - t.x)
    heard(SEA_LANCE_SOUND[style], at)
    if (style === 'rail') {   // a slug: a short white-blue streak, very fast
      flare(t, ang, at, 'ring', 0x8fd8ff)
      flyer(t, aim, at + 40, 260, hit, (h, ux, uy) => line(h, { x: h.x - ux * 3, y: h.y - uy * 3 }, 0.32, 0x6fd8ff, 0.5) + line(h, { x: h.x - ux * 1.6, y: h.y - uy * 1.6 }, 0.12, 0xffffff, 1) + disc(h.x, h.y, 0.22, 0xffffff, 1), 1.1)
    } else {   // a beam: rises, holds, fades; laser red, crystal green, mirror gold, zap a flickering bolt of green lightning
      const C = { laser: [0xff2a1a, 0xffe0d8, 0.34], crystal: [0x5fe8b0, 0xf0fff8, 0.28], mirror: [0xffc840, 0xfff8e0, 0.6], zap: [0x7fe85a, 0xeaffd8, 0.22] }[style]
      flare(t, ang, at, 'ring', C[1])
      const b = bits(20)
      add(at + 40, 620, (k) => {
        const al = k < 0.12 ? k / 0.12 : k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4
        if (style === 'zap') {   // a jagged bolt, re-drawn each frame so it crackles
          const d = Math.hypot(aim.x - t.x, aim.y - t.y), nx = -(aim.y - t.y) / d, ny = (aim.x - t.x) / d, j = Math.floor(k * 12)
          let pts = `${t.x.toFixed(2)},${t.y.toFixed(2)}`
          for (let q = 1; q < 8; q++) { const p = lerp(t, aim, q / 8), o = (b[(q + j) % 20] - 0.5) * 2.2; pts += ` ${(p.x + nx * o).toFixed(2)},${(p.y + ny * o).toFixed(2)}` }
          pts += ` ${aim.x.toFixed(2)},${aim.y.toFixed(2)}`
          return `<polyline points="${pts}" fill="none" stroke="${rgb(C[0])}" stroke-width="0.5" stroke-opacity="${(0.6 * al).toFixed(2)}"/><polyline points="${pts}" fill="none" stroke="${rgb(C[1])}" stroke-width="0.16" stroke-opacity="${al.toFixed(2)}"/>`
        }
        return line(t, aim, C[2] * 2.2, C[0], 0.5 * al) + line(t, aim, C[2] * 0.7, C[1], al) + (style === 'crystal' ? disc(t.x + (aim.x - t.x) * ((k * 3) % 1), t.y + (aim.y - t.y) * ((k * 3) % 1), 0.3, 0xffffff, al) : '')
      })
      if (hit) burst(aim, style === 'mirror' ? 1.6 : 1.2, at + 120, C[0]); else splash(aim, 1.0, at + 120)
    }
  }
  lag = Math.max(lag, base + n * 220 + 400)
}
function seaBattery (e, target, pos) {
  const tips = seaTips(e, target, pos), fleet = tips[0]?.fleet ?? 'freemen', rounds = Math.max(8, Math.min(28, 6 + (e.dice ?? 4) * 2.5)), hits = Math.min(e.hits ?? 0, rounds)
  const base = lead
  if (fleet === 'rukka' && look() < 0.35) heard('voice-orc-fire', base)   // his Rukka line, now and then
  let last = 0
  for (let i = 0; i < rounds; i++) {
    const a = tips[i % tips.length], hit = Math.floor((i + 1) * hits / rounds) > Math.floor(i * hits / rounds)
    const aim = { x: target.x + (look() - 0.5) * (hit ? 2.4 : 10), y: target.y + (look() - 0.5) * (hit ? 2.4 : 10) }, ang = Math.atan2(aim.y - a.y, aim.x - a.x)
    const d = Math.hypot(aim.x - a.x, aim.y - a.y), at = base + i * 70 + look() * 50
    if (i % 3 === 0) heard(fleet === 'rukka' ? 'sea-fire' : fleet === 'athanatoi' ? 'sea-ballista' : 'sea-cannon', at)
    if (fleet === 'rukka') {   // a fireball, slow, arcing a little, trailing flame
      const ms = Math.max(600, Math.min(2600, d / 26 * 1000))
      flare(a, ang, at, 'fire')
      flyer(a, aim, at, ms, hit, (h, ux, uy, k) => { const lift = Math.sin(k * Math.PI) * 1.2; return disc(h.x - ux * 0.8, h.y - uy * 0.8 - lift * 0.6, 0.35, 0xff8a1a, 0.6) + disc(h.x, h.y - lift, 0.42, 0xff5a10, 1) + disc(h.x, h.y - lift, 0.22, 0xffe070, 1) }, 1.0)
      last = Math.max(last, at + ms)
    } else if (fleet === 'athanatoi') {   // a ballista bolt: thin, fast, a white head
      const ms = Math.max(350, Math.min(1600, d / 55 * 1000))
      flare(a, ang, at, 'ring', 0xeafff2)
      flyer(a, aim, at, ms, hit, (h, ux, uy) => line(h, { x: h.x - ux * 1.6, y: h.y - uy * 1.6 }, 0.12, 0xd8c8a0, 1) + disc(h.x, h.y, 0.14, 0xffffff, 1), 0.7)
      last = Math.max(last, at + ms)
    } else {   // shells: a tracer (red for Dominion), grey smoke at the muzzle
      const ms = Math.max(450, Math.min(2200, d / 38 * 1000)), c = fleet === 'dominion' ? 0xff3a1a : 0xffb040
      flare(a, ang, at, 'smoke')
      flyer(a, aim, at, ms, hit, (h, ux, uy) => line(h, { x: h.x - ux * 1.4, y: h.y - uy * 1.4 }, 0.12, c, 0.7) + disc(h.x, h.y, 0.13, 0xfff0b0, 1), 0.8)
      last = Math.max(last, at + ms)
    }
  }
  lag = Math.max(lag, base, last - 450)
}
// SHIELDS AT SEA: a ward shaped to the hull, seen side-on from above,
// flaring where the shot strikes it, rippling out over the water; each fleet its own:
// Human the runic ward: pale blue, runes sparking along the struck side
// Orc a crude yellow field crackling with arcs
// Dominion a blood-red ward with dark smoke curling off it
// other a pale blue ward
// A ward knocked down shatters into shards that fall into the sea. Elf mirage fields: the ship blurs into ghost images in a veil of spray.
const WARD = { freemen: [0x8fdcff, 0xeafaff, 'runes'], rukka: [0xffe040, 0xfff8c0, 'arcs'], dominion: [0xff3a2a, 0xffd0c0, 'smoke'], athanatoi: [0x7fe6bc, 0xeafff4, 'runes'] }
function seaShield (e, target) {
  const ship = e.to, fleet = ship.profile?.fleet, [col, core, kind] = WARD[fleet] ?? [0x9ad0ff, 0xffffff, 'plain']
  const len = seaLen(ship), rx = len * 0.62, ry = len * 0.3, rot = ship.facing ?? 0, base = (e.delay ?? 450) + lag
  const hitA = e.from ? Math.atan2(e.from.y - target.y, e.from.x - target.x) : look() * Math.PI * 2
  // the struck point on the ward, in the ship's frame
  const la = hitA - rot * Math.PI / 180, px = Math.cos(la) * rx, py = Math.sin(la) * ry
  const frame = inner => `<g transform="translate(${target.x.toFixed(2)} ${target.y.toFixed(2)}) rotate(${rot.toFixed(1)})">${inner}</g>`
  for (let i = 0; i < Math.min(5, e.n ?? 1); i++) {
    const b = bits(16), j = { x: px + (b[0] - 0.5) * rx * 0.25, y: py + (b[1] - 0.5) * ry * 0.25 }
    add(base + i * 110, 650, k => {
      const fade = 1 - k, e2 = out(k)
      let h = `<ellipse rx="${rx.toFixed(2)}" ry="${ry.toFixed(2)}" fill="${rgb(col)}" fill-opacity="${(0.12 * fade).toFixed(3)}" stroke="${rgb(col)}" stroke-width="${(0.18 * fade).toFixed(3)}" stroke-opacity="${(0.7 * fade).toFixed(2)}"/>`
      h += disc(j.x, j.y, 0.5 + e2 * 1.6, col, 0.5 * fade) + disc(j.x, j.y, 0.35 * fade + 0.05, core, fade)
      h += `<ellipse cx="${j.x.toFixed(2)}" cy="${j.y.toFixed(2)}" rx="${(0.4 + e2 * 3).toFixed(2)}" ry="${(0.25 + e2 * 1.8).toFixed(2)}" fill="none" stroke="${rgb(core)}" stroke-width="${(0.12 * fade).toFixed(3)}" stroke-opacity="${fade.toFixed(2)}"/>`
      if (kind === 'runes') for (let q = 0; q < 6; q++) { const t = la + (b[q + 2] - 0.5) * 1.4, x = Math.cos(t) * rx, y = Math.sin(t) * ry; h += `<path d="M${(x - 0.25).toFixed(2)} ${(y - 0.35).toFixed(2)} L${x.toFixed(2)} ${(y + 0.35).toFixed(2)} L${(x + 0.25).toFixed(2)} ${(y - 0.35).toFixed(2)}" fill="none" stroke="${rgb(core)}" stroke-width="0.1" stroke-opacity="${(fade * (q % 2 ? 1 : 0.6)).toFixed(2)}"/>` }
      if (kind === 'arcs') for (let q = 0; q < 3; q++) { const t = la + (b[q + 2] - 0.5) * 1.8; let d = `M${j.x.toFixed(2)} ${j.y.toFixed(2)}`; for (let z = 1; z <= 4; z++) { const tt = la + (t - la) * z / 4, x = Math.cos(tt) * rx, y = Math.sin(tt) * ry; d += ` L${(x + (b[(z + q) % 16] - 0.5) * 0.8).toFixed(2)} ${(y + (b[(z + q + 5) % 16] - 0.5) * 0.8).toFixed(2)}` } h += `<path d="${d}" fill="none" stroke="${rgb(core)}" stroke-width="0.12" stroke-opacity="${(k < 0.6 ? 1 : fade * 2).toFixed(2)}"/>` }
      if (kind === 'smoke') for (let q = 0; q < 4; q++) h += disc(j.x + (b[q + 2] - 0.5) * 2 + e2 * 1.5, j.y + (b[q + 6] - 0.5) * 1.2 - e2 * 1.2, 0.4 + e2 * 1.2, 0x1a1012, 0.45 * fade)
      return frame(h)
    })
  }
  if (e.down) {   // the ward shatters: shards fly off and drop into the sea with little splashes
    const b = bits(24)
    add(base + (e.n ?? 1) * 110 + 150, 900, k => {
      let h = ''
      for (let q = 0; q < 12; q++) { const t = b[q] * Math.PI * 2, d = 1 + out(k) * 3 * (0.5 + b[q + 12] * 0.5), x = Math.cos(t) * (rx + d * 0.6), y = Math.sin(t) * (ry + d * 0.4); h += `<path d="M${x.toFixed(2)} ${y.toFixed(2)} l0.5 -0.3 l-0.2 0.7Z" fill="${rgb(col)}" fill-opacity="${(1 - k).toFixed(2)}" transform="rotate(${(k * 300 + q * 30).toFixed(0)} ${x.toFixed(2)} ${y.toFixed(2)})"/>` }
      return frame(`<ellipse rx="${(rx * (1 + k * 0.3)).toFixed(2)}" ry="${(ry * (1 + k * 0.3)).toFixed(2)}" fill="none" stroke="${rgb(core)}" stroke-width="${(0.25 * (1 - k)).toFixed(3)}" stroke-opacity="${(1 - k).toFixed(2)}" stroke-dasharray="1 0.6"/>` + h)
    })
  }
}
// an Elf mirage field at sea: spray rises round the ship and its picture splits into drifting ghosts, so the shot finds only water
function seaMiragefield (e, target) {
  const art = artOf?.(e.to), len = art?.len ?? 6, rot = (e.to.facing ?? 0) + 90, base = (e.delay ?? 450) + lag
  let n = 0
  for (const saved of [true, false]) {
    if (!(saved ? e.saved : e.through)) continue
    add(base + n++ * 500, 900, k => {
      const fade = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3, spread = (saved ? 2.2 : 0.8) * Math.sin(k * Math.PI)
      let h = disc(target.x, target.y, len * 0.6, 0xeafaff, 0.18 * fade)
      if (art) for (const sx of [-1, 1]) h += `<image href="${art.href}" x="${(target.x - len / 2 + sx * spread).toFixed(2)}" y="${(target.y - len / 2 + sx * spread * 0.4).toFixed(2)}" width="${len}" height="${len}" transform="rotate(${rot} ${(target.x + sx * spread).toFixed(2)} ${(target.y + sx * spread * 0.4).toFixed(2)})" opacity="${(0.35 * fade).toFixed(2)}"/>`
      for (let q = 0; q < 8; q++) { const t = q / 8 * Math.PI * 2 + k * 2, d = len * (0.35 + k * 0.25); h += disc(target.x + Math.cos(t) * d, target.y + Math.sin(t) * d * 0.6, 0.25 + k * 0.4, 0xffffff, 0.5 * fade) }
      return h
    })
  }
}
// what the sea draws itself; false lets the space effects play (pulses, launches)
function seaPlay (e, pos) {
  const target = e.to?.uid != null ? pos(e.to) : e.to
  // shield hits: the space styles, squashed to the hull (the kind === 'shields' branch of play); seaShield is kept, unused
  if (e.kind === 'field' && target) { seaMiragefield(e, target); return true }
  if (e.kind === 'lance' && target) { seaLance(e, target, pos); return true }
  if (e.kind === 'battery' && target) { seaBattery(e, target, pos); return true }
  if (e.kind === 'sunburst' && target) {   // the great mortar: a huge shell lobbed high, then a blast and a tower of water
    const a = pos(e.from[0]), d = Math.hypot(target.x - a.x, target.y - a.y)
    heard('sea-boom-big', lead); flare(a, Math.atan2(target.y - a.y, target.x - a.x), lead, 'smoke')
    add(lead, 1300, k => { const p = lerp(a, target, k), lift = Math.sin(k * Math.PI) * d * 0.12; return disc(p.x + 0.6, p.y + 0.8, 0.6 * (1 - Math.sin(k * Math.PI) * 0.4), 0x000000, 0.25) + disc(p.x, p.y - lift, 0.7 + Math.sin(k * Math.PI) * 0.6, 0x2a2e33, 1) })
    burst(target, 3, lead + 1300); splash(target, 3.4, lead + 1350); heard('sea-boom-big', lead + 1300)
    return true
  }
  if (e.kind === 'torpedo' && target) { heard('sea-boom', 0); splash(target, 2.4, 0); burst(target, 2, 80); return true }
  if (e.kind === 'explode' && target) {
    const d = (e.delay ?? 600) + lag, big = e.big ? 1.6 : 1
    heard(e.big ? 'sea-boom-big' : 'sea-boom', d)
    burst(target, 2.6 * big, d); burst({ x: target.x + 1.2, y: target.y - 0.8 }, 1.6 * big, d + 250); splash(target, 4 * big, d + 400)
    add(d + 300, 3000, k => disc(target.x + k * 4, target.y + k * 2.5, 1.5 + k * 4 * big, 0x1e1c1a, 0.5 * (1 - k)))   // the smoke column drifting off
    return true
  }
  return false
}

// ---- TELEPORTS AND BOARDING AT SEA: the teleported troops appear on the target ship and fight its crew; boarding
// parties gather towards the torpedo or boat that carries them. Drawing only: the
// rules have already rolled the attack. figs are image hrefs (the deck figures, view/seaFigures.js); a, b are table points.
const figImg = (href, x, y, s, rot = 0, al = 1) => `<image href="${href}" x="${(x - s / 2).toFixed(2)}" y="${(y - s / 2).toFixed(2)}" width="${s.toFixed(2)}" height="${s.toFixed(2)}" transform="rotate(${rot.toFixed(0)} ${x.toFixed(2)} ${y.toFixed(2)})" opacity="${al.toFixed(2)}" style="image-rendering:pixelated"/>`
// the fight on deck at b: the attackers hack at the crew, sparks and flashes. won true: two of the crew fall; false: the attackers fall
// and fade (beaten back); null (a draw): nobody falls. With no figures (space) only the sparks and flashes.
function deckFight ({ b, attackers, defenders, t0, dur = 2600, won = true, n = 5, sz = 1.1 }) {
  const spots = Array.from({ length: Math.min(n, attackers.length ? n : 0) }, (_, i) => { const t = i / n * Math.PI * 2 + look(); return { x: Math.cos(t) * 1.4, y: Math.sin(t) * 1.4 } })
  const foes = defenders.length ? Array.from({ length: 3 }, (_, i) => { const t = i / 3 * Math.PI * 2 + 1; return { x: Math.cos(t) * 2.2, y: Math.sin(t) * 2.2 } }) : []
  heard('steps-heavy', t0)
  add(t0, dur, k => {
    let h = ''
    const fade = k > 0.85 ? 1 - (k - 0.85) / 0.15 : 1
    foes.forEach((p, i) => { const dead = won === true && i < 2 && k > 0.55 + i * 0.12; if (!dead) h += figImg(defenders[i % defenders.length], b.x + p.x, b.y + p.y, sz, 180 + Math.sin(k * 30 + i) * 12, fade) })
    spots.forEach((p, i) => {
      const dead = won === false && i % 2 === 0 && k > 0.5 + i * 0.06, back = won === false ? Math.max(0, k - 0.6) * 2 : 0
      if (dead) return
      const j = Math.sin(k * 40 + i * 2) * 0.25, toward = 0.35 + 0.25 * Math.sin(k * 6 + i) - back
      h += figImg(attackers[i % attackers.length], b.x + p.x * (1 - toward) + j, b.y + p.y * (1 - toward), sz, Math.atan2(-p.y, -p.x) * 180 / Math.PI + 90, won === false ? fade * (1 - back * 0.6) : fade)
    })
    for (let q = 0; q < 3; q++) { const ph = (k * 9 + q * 0.33) % 1, at = { x: b.x + Math.cos(q * 2.1 + k * 3) * 1.1, y: b.y + Math.sin(q * 2.1 + k * 3) * 1.1 }; if (ph < 0.25) h += disc(at.x, at.y, 0.35 * (1 - ph * 4) + 0.05, 0xfff0b0, 1 - ph * 4) + sparks(at, q, 5, 0.9, 0.3, 0xffd060, 0.06, ph * 4, [0.1, 0.4, 0.7, 0.2, 0.9, 0.5, 0.3, 0.8, 0.6, 0.15]) }
    return h
  })
  lag = Math.max(lag, t0 + dur)
}
/** A teleport attack: the troops vanish in light at their own ship (an Orc's are thrown off the catapult in a high arc) and fight on the
 * target's deck. ok: whether the Hit-and-Run got through (true: the crew fall; false: the attackers are beaten back). No figures (space):
 * the light column and the flash only. */
export function teleportFx ({ a, b, attackers, defenders, thrown = false, colour = 0x8fdcff, delay = 0, ok = true }) {
  const n = Math.min(5, attackers.length), sz = 1.1, spots = Array.from({ length: n }, (_, i) => { const t = i / n * Math.PI * 2 + look(); return { x: Math.cos(t) * 1.4, y: Math.sin(t) * 1.4 } })
  delay += lag
  heard(thrown ? 'voice-orc-assault' : 'sea-launch', delay)
  if (!thrown) {
    // they vanish in a column of light at their own ship ...
    add(delay, 700, k => { let h = disc(a.x, a.y, 2.6 * (0.4 + k), colour, 0.35 * (1 - k)) + `<circle cx="${a.x.toFixed(2)}" cy="${a.y.toFixed(2)}" r="${(1 + k * 3).toFixed(2)}" fill="none" stroke="${rgb(colour)}" stroke-width="0.2" stroke-opacity="${(1 - k).toFixed(2)}"/>`; spots.forEach((p, i) => { h += figImg(attackers[i % attackers.length], a.x + p.x * (1 - k), a.y + p.y * (1 - k), sz * (1 - k * 0.8), 0, 1 - k) }); return h })
    // ... and appear on the enemy's deck in a flash
    add(delay + 650, 500, k => disc(b.x, b.y, 3 * (1 - k) + 0.3, 0xffffff, 0.8 * (1 - k)) + `<circle cx="${b.x.toFixed(2)}" cy="${b.y.toFixed(2)}" r="${(0.5 + k * 3.5).toFixed(2)}" fill="none" stroke="${rgb(colour)}" stroke-width="0.25" stroke-opacity="${(1 - k).toFixed(2)}"/>`)
  } else {
    // the Orcs' way: the boyz are flung off the catapult in a high arc, arms and legs flailing; the arm swings first
    add(delay, 260, k => `<circle cx="${a.x.toFixed(2)}" cy="${a.y.toFixed(2)}" r="${(0.6 + k * 1.4).toFixed(2)}" fill="none" stroke="#e8d8b0" stroke-width="0.15" stroke-opacity="${(1 - k).toFixed(2)}"/>`)
    add(delay, 1100, k => { let h = ''; spots.forEach((p, i) => { const t = Math.min(1, Math.max(0, k * 1.4 - i * 0.08)), q = lerp(a, { x: b.x + p.x, y: b.y + p.y }, t), lift = Math.sin(t * Math.PI) * 6; h += disc(q.x + 0.3, q.y + 0.4, 0.45 * (1 - Math.sin(t * Math.PI) * 0.6), 0x000000, 0.25) + figImg(attackers[i % attackers.length], q.x, q.y - lift, sz * (1 + Math.sin(t * Math.PI) * 0.5), t * 720) }); return h })
    add(delay + 1000, 400, k => disc(b.x, b.y, 0.6 + k * 2.4, 0xd8c8a0, 0.4 * (1 - k)))   // they land in a cloud of dust and splinters
  }
  deckFight({ b, attackers, defenders, t0: delay + (thrown ? 1050 : 900), won: ok, sz })
}
// A boarding action: grapnels shot across from the boarder to the boarded ship, the boarders run over the lines, and
// the fight on the boarded deck. won: true the boarders win, false they are thrown back, null a draw (both locked, nobody falls).
// No figures (space): the grapnel lines and flashes only. a, b: the two ships' drawn centres; colour the boarders' side.
export function boardingFx ({ a, b, attackers, defenders, won = true, colour = 0xd8d0c0, delay = 0, boat = null, aR = 0, bR = 0 }) {
  delay += lag
  const d = Math.hypot(b.x - a.x, b.y - a.y) || 1, ux = (b.x - a.x) / d, uy = (b.y - a.y) / d, nx = -uy, ny = ux
  if (boat) {   // AT SEA (the Tides house rule: boarding from range): the assault boats put off from the boarder's side and row across, then the fight
    const from = { x: a.x + ux * aR, y: a.y + uy * aR }, to = { x: b.x - ux * bR, y: b.y - uy * bR }, head = Math.atan2(uy, ux) * 180 / Math.PI, n = 3, ROW = 1600
    heard('sea-launch', delay)
    add(delay, ROW, k => {
      let h = ''
      for (let i = 0; i < n; i++) {
        const t = Math.min(1, Math.max(0, k * 1.3 - i * 0.12)), o = (i - 1) * 1.6, p = lerp({ x: from.x + nx * o, y: from.y + ny * o }, { x: to.x + nx * o * 0.5, y: to.y + ny * o * 0.5 }, out(t))
        if (t >= 1) continue
        for (let w = 1; w <= 3; w++) h += disc(p.x - ux * w * 0.7, p.y - uy * w * 0.7, 0.25 + w * 0.12, 0xffffff, 0.25 * (1 - w / 4))   // the wake
        h += `<image href="${boat}" x="${(p.x - 1.4).toFixed(2)}" y="${(p.y - 1.4).toFixed(2)}" width="2.8" height="2.8" transform="rotate(${(head + 90).toFixed(0)} ${p.x.toFixed(2)} ${p.y.toFixed(2)})"/>`
      }
      return h
    })
    add(delay + ROW - 200, 400, k => disc(to.x, to.y, 0.6 + k * 2.4, 0xeafaff, 0.4 * (1 - k)))   // they hit the hull in a burst of spray
    deckFight({ b: { x: b.x - ux * bR * 0.3, y: b.y - uy * bR * 0.3 }, attackers, defenders, t0: delay + ROW, won, sz: 1.1 })
    return
  }
  const lines = [-1.4, 0, 1.4].map(o => ({ p: { x: a.x + ux * d * 0.2 + nx * o, y: a.y + uy * d * 0.2 + ny * o }, q: { x: a.x + ux * d * 0.78 + nx * o * 0.8, y: a.y + uy * d * 0.78 + ny * o * 0.8 } }))
  heard('launch', delay)
  // the grapnels fly out, then the lines stay taut through the fight
  lines.forEach((L, i) => add(delay + i * 90, 3900, k => {
    const t = Math.min(1, k * 3900 / 320), head = lerp(L.p, L.q, t), fade = k > 0.9 ? (1 - k) / 0.1 : 1
    return line(L.p, head, 0.12, 0x2a2420, 0.9 * fade) + line(L.p, head, 0.05, colour, 0.8 * fade) + (t < 1 ? disc(head.x, head.y, 0.22, 0xc8c0b0, 1) : disc(L.q.x, L.q.y, 0.18, 0x6a6258, fade))
  }))
  lines.forEach((L, i) => add(delay + 320 + i * 90, 160, k => disc(L.q.x, L.q.y, 0.4 * (1 - k) + 0.1, HOT, 1 - k)))   // the hooks bite
  // the boarders run across the lines
  const n = Math.min(6, attackers.length * 2), sz = 1.1
  if (n) add(delay + 450, 1000, k => { let h = ''; for (let i = 0; i < n; i++) { const L = lines[i % 3], t = Math.min(1, Math.max(0, k * 1.5 - Math.floor(i / 3) * 0.3)); if (t <= 0 || t >= 1) continue; const q = lerp(L.p, L.q, t); h += figImg(attackers[i % attackers.length], q.x, q.y + Math.sin(t * 20) * 0.08, sz, Math.atan2(uy, ux) * 180 / Math.PI + 90) } return h })
  const deck = lerp(a, b, 0.86)
  deckFight({ b: deck, attackers, defenders, t0: delay + 1300, won, sz })
}
// A COLLISION AT SEA (the Tides house rule, rules/movement.js collide): timbers splinter where the hulls meet, spray and smoke; in space a
// scrape of sparks. p is where they meet.
export function collideFx ({ p, delay = 0 }) {
  delay += lag
  heard(sea ? 'sea-boom' : 'boom', delay)
  burst(p, 1.6, delay)
  if (sea) { splash(p, 2.2, delay + 120); splash({ x: p.x + 1, y: p.y - 0.8 }, 1.4, delay + 260) }
  add(delay, 500, k => sparks(p, look() * 6, 10, 2.4, 0.6, HOT, 0.08, k, bits(20)))
  lag = Math.max(lag, delay + 700)
}
// ATTACK CRAFT. The wave flies in from
// its marker, circles the target one and a half times, the turrets' flak bursting round it; the squadrons the turrets shot down spin and
// fall; the bombs drop as they pass over (a hit bursts on the hull, a miss splashes at sea or flashes in space); then they fly off, the
// wave spent. Fighters that can do nothing to a ship (harmless) circle once and go back to their marker. crafts: [{ href, size }] in the
// wave's order, those shot down first; R the circle's radius (cm); hull { rx, ry, rot } where a bomb counts as on the ship.
const craftAt = (c, R, ang) => ({ x: c.x + Math.cos(ang) * R, y: c.y + Math.sin(ang) * R })
const craftImg = (cr, p, headDeg, al = 1, scale = 1) => `<image href="${cr.href}" x="${(p.x - cr.size * scale / 2).toFixed(2)}" y="${(p.y - cr.size * scale / 2).toFixed(2)}" width="${(cr.size * scale).toFixed(2)}" height="${(cr.size * scale).toFixed(2)}" transform="rotate(${(headDeg + 90).toFixed(0)} ${p.x.toFixed(2)} ${p.y.toFixed(2)})" opacity="${al.toFixed(2)}"/>`
export function craftRun ({ from, to, R, hull, crafts, down = 0, bombers = 0, hits = 0, harmless = false, delay = 0 }) {
  if (!crafts.length) return
  delay += lag
  const IN = 900, LAP = 2600, laps = harmless ? 1 : 1.5, CIRCLE = LAP * laps, OUT = 800, n = crafts.length
  const a0 = Math.atan2(from.y - to.y, from.x - to.x), dir = look() < 0.5 ? 1 : -1, gap = Math.min(0.45, 2.2 / n)
  const angOf = (i, t) => a0 - dir * i * gap + dir * Math.PI * 2 * laps * t   // t 0..1 over the circling
  const ring = i => R + (i % 2) * 0.7
  const lostAt = i => i < down ? IN + 250 + i * 260 : Infinity   // ms after the start the turrets bring it down
  const total = IN + CIRCLE + OUT
  heard('launch', delay)
  add(delay, total, k => {
    let h = ''
    const t = k * total   // ms since the start on the timeline (the game's speed setting scales add, not this)
    crafts.forEach((cr, i) => {
      let p, head
      if (t < IN) {   // flying in from the marker to its place on the circle, nose along the way
        const e = out(t / IN), dest = craftAt(to, ring(i), angOf(i, 0)), start = { x: from.x + (i % 3 - 1) * 0.8, y: from.y + (Math.floor(i / 3) - 0.5) * 0.8 }
        p = lerp(start, dest, e); head = Math.atan2(dest.y - start.y, dest.x - start.x) * 180 / Math.PI
      } else if (t < IN + CIRCLE) {
        const ang = angOf(i, (t - IN) / CIRCLE); p = craftAt(to, ring(i), ang); head = ang * 180 / Math.PI + dir * 90
      } else {   // off again: back to the marker (fighters) or away out of the fight (the wave is spent)
        const e = (t - IN - CIRCLE) / OUT, last = craftAt(to, ring(i), angOf(i, 1)), tangent = angOf(i, 1) + dir * Math.PI / 2
        const dest = harmless ? from : { x: last.x + Math.cos(tangent) * 12, y: last.y + Math.sin(tangent) * 12 }
        p = lerp(last, dest, e); head = Math.atan2(dest.y - last.y, dest.x - last.x) * 180 / Math.PI
        if (!harmless && e > 0.6) return void (h += craftImg(cr, p, head, (1 - e) / 0.4))
      }
      const lost = lostAt(i)
      if (t >= lost) {   // shot down: it spins, trails smoke and drops
        const f = (t - lost) / 900
        if (f >= 1) return
        const q = craftAt(to, ring(i), angOf(i, Math.max(0, (lost - IN) / CIRCLE)))
        for (let z = 0; z < 4; z++) h += disc(q.x + z * 0.3, q.y - z * 0.25, 0.25 + z * 0.12, 0x2a2622, 0.4 * (1 - f) * (1 - z / 4))
        return void (h += craftImg(cr, q, head + f * 540, 1 - f * 0.7, 1 - f * 0.6))
      }
      h += craftImg(cr, p, head)
    })
    return h
  })
  // turret flak round the wave as it comes in (puffs, a dark one with a flash)
  for (let q = 0; q < 6 + down * 2; q++) {
    const at = delay + IN * 0.6 + q * 160 + look() * 80, ang = a0 + (look() - 0.5) * 1.6, r = R + (look() - 0.5) * 2, p = craftAt(to, r, ang)
    add(at, 600, k => disc(p.x, p.y, 0.2 + k * 0.7, 0x3a3632, 0.55 * (1 - k)) + (k < 0.2 ? disc(p.x, p.y, 0.25, HOT, 1 - k * 5) : ''))
    if (q % 3 === 0) heard('hit', at)
  }
  for (let i = 0; i < Math.min(down, n); i++) {   // where each one shot down falls: a splash at sea, a small burst in space
    const lost = lostAt(i), p = craftAt(to, ring(i), angOf(i, Math.max(0, (lost - IN) / CIRCLE)))
    if (sea) splash(p, 0.9, delay + lost + 850); else burst(p, 0.7, delay + lost + 850)
  }
  // the bombs: dropped as the circling bombers pass over; hits burst on the hull, misses splash beside it
  const drops = harmless || !bombers ? 0 : Math.min(12, Math.max(hits + 2, bombers * 2)), H = hull ?? { rx: R * 0.5, ry: R * 0.5, rot: 0 }
  for (let j = 0; j < drops; j++) {
    const hit = j < hits ? true : false, at = delay + IN + CIRCLE * (0.15 + 0.75 * (j + 0.5) / drops), ang = look() * Math.PI * 2, r0 = hit ? 0.2 + look() * 0.55 : 1.15 + look() * 0.5
    const lx = Math.cos(ang) * H.rx * r0, ly = Math.sin(ang) * H.ry * r0, rr = (H.rot ?? 0) * Math.PI / 180
    const p = { x: to.x + lx * Math.cos(rr) - ly * Math.sin(rr), y: to.y + lx * Math.sin(rr) + ly * Math.cos(rr) }
    add(at - 380, 380, k => disc(p.x, p.y - (1 - k) * 2.2, 0.22, 0x2a2622, 1) + disc(p.x + 0.2, p.y + 0.25, 0.18 * k, 0x000000, 0.25))   // the bomb falling, its shadow growing
    if (hit) { burst(p, 1.2, at); heard(sea ? 'sea-boom' : 'boom', at) } else if (sea) splash(p, 1.0, at); else add(at, 300, k => disc(p.x, p.y, 0.3 + k * 0.8, ORANGE, 0.6 * (1 - k)))
  }
  lag = Math.max(lag, delay + IN + CIRCLE + 200)
}
// A DOGFIGHT: where fighters meet other ordnance the craft twist round each other with tracer
// fire; one that is removed spins down trailing smoke into the sea (a burst in space). Each craft of the meeting sends its own event, so the
// two sides circle the same point, a little apart.
export function dogfightFx ({ p, pic, gone, side = 0, delay = 0 }) {
  if (!pic) return
  delay += lag
  const dir = side ? -1 : 1, R = 1.4, LOOP = 1100, a0 = look() * Math.PI * 2
  const at = k => { const a = a0 + dir * k * Math.PI * 3; return { x: p.x + Math.cos(a) * R * (side ? 0.8 : 1), y: p.y + Math.sin(a) * R * (side ? 0.8 : 1), head: a * 180 / Math.PI + dir * 90 } }
  heard('hit', delay + 200)
  add(delay, LOOP, k => {
    const q = at(k), f = q.head * Math.PI / 180
    return (Math.floor(k * 14) % 2 ? line(q, { x: q.x + Math.cos(f) * 1.2, y: q.y + Math.sin(f) * 1.2 }, 0.06, 0xfff0b0, 0.9) : '') + craftImg(pic, q, q.head)
  })
  if (!gone) return
  const q = at(1)
  add(delay + LOOP, 900, k => { let h = ''; for (let z = 0; z < 4; z++) h += disc(q.x - z * 0.3, q.y - z * 0.2, 0.2 + z * 0.1, 0x2a2622, 0.4 * (1 - k)); return h + craftImg(pic, { x: q.x + k * 0.8, y: q.y + k * 1.2 }, q.head + k * 600, 1 - k * 0.6, 1 - k * 0.6) })
  if (sea) splash({ x: q.x + 0.8, y: q.y + 1.2 }, 0.8, delay + LOOP + 850); else burst({ x: q.x + 0.8, y: q.y + 1.2 }, 0.6, delay + LOOP + 850)
}
// assault boats landing: each Hit-and-Run is a party fighting on the deck; any one got through, the crew fall
export function boatsFx ({ to, attackers, defenders, results, delay = 0, torpedo = false }) {
  if (!results.length) return
  delay += lag
  if (torpedo) { burst(to, 1.1, delay); heard(sea ? 'sea-boom' : 'boom', delay); delay += 350 }   // a boarding torpedo: it rams the hull and the party bursts out
  add(delay, 400, k => disc(to.x, to.y, 0.6 + k * 2.4, 0xd8c8a0, 0.4 * (1 - k)))
  deckFight({ b: to, attackers, defenders, t0: delay + 200, won: results.some(Boolean), n: Math.min(5, 2 + results.length) })
}
// the boarding party runs to the bow, where the boarding torpedo waits, and climbs in before it goes
export function assembleFx ({ p, facing, len, figs, delay = 0 }) {
  const f = facing * Math.PI / 180, bow = { x: p.x + Math.cos(f) * len * 0.42, y: p.y + Math.sin(f) * len * 0.42 }, n = Math.min(6, figs.length * 2)
  const starts = Array.from({ length: n }, (_, i) => ({ x: p.x - Math.cos(f) * len * (0.1 + 0.05 * i) + Math.sin(f) * (i % 2 ? 0.8 : -0.8), y: p.y - Math.sin(f) * len * (0.1 + 0.05 * i) - Math.cos(f) * (i % 2 ? 0.8 : -0.8) }))
  heard('steps-heavy', delay)
  add(delay, 1500, k => { let h = ''; starts.forEach((s0, i) => { const t = Math.min(1, Math.max(0, k * 1.5 - i * 0.07)), q = lerp(s0, bow, t), shrink = t > 0.85 ? 1 - (t - 0.85) / 0.15 : 1; if (shrink > 0.02) h += figImg(figs[i % figs.length], q.x, q.y, 0.95 * shrink, facing + 90, shrink) }); return h + (k > 0.8 ? disc(bow.x, bow.y, 0.8 * (1 - (k - 0.8) / 0.2) + 0.1, 0xfff0b0, 1 - (k - 0.8) / 0.2) : '') })
  lag = Math.max(lag, delay + 1500)
}
