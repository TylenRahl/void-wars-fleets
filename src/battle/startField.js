// THE START SCREEN'S BACKGROUND (space skin), in one SVG: the real ships drift past each other and fire, silently,
// over a table picture, and a star goes dark and comes back in time with the song.
// Decoration: it has its own little generator and never touches a game's dice.
// Exports startField, plus darkness and phaseName (also used by seaField.js); used by startScreen.js.
import { artFor } from '../view/shipArt.js'

const W = 1600, H = 900
const CYCLE = [13000, 7000, 15000, 7000]   // full light, dusk, dark, dawn, in ms
const DARK = 0.78                          // how much of the picture the dark hides
const PILL = { Daylight: 'Sunlit', Dusk: 'Dusk', 'Night fight': 'Eclipse', Dawn: 'Dawn' }
const FREEMEN = [['reckoning', 120, 190], ['lantern', 70, 400], ['rimward', 70, 610], ['sword', 34, 300], ['sword', 34, 330], ['steward', 74, 760]]
const DOMINION = [['harrower', 120, 690], ['bloodshed', 70, 470], ['malice', 70, 250], ['profaner', 34, 560], ['profaner', 34, 590], ['ruin', 74, 120]]
const SPEED = 9, GAP = 300     // cm-free screen units a second; the spread of a line of ships
const ease = x => x * x * (3 - 2 * x)

export function darkness (ms) {
  const [day, dusk, night, dawn] = CYCLE
  let m = ms % (day + dusk + night + dawn)
  if (m < day) return 0
  m -= day; if (m < dusk) return ease(m / dusk)
  m -= dusk; if (m < night) return 1
  m -= night; return 1 - ease(m / dawn)
}
export function phaseName (ms, dark) {
  const [day, dusk] = CYCLE
  const m = ms % CYCLE.reduce((a, b) => a + b)
  return dark === 0 ? 'Daylight' : dark === 1 ? 'Night fight' : m < day + dusk ? 'Dusk' : 'Dawn'
}

/** `light`: { dark, name } for this frame, or null for this screen's own cycle (the day and night loop). */
export function startField (host, phase, light) {
  let seed = 20261106
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 }
  const fleet = (list, side) => list.map(([id, len, y], i) => ({ id, len, y, side, x: side ? W + 100 - i * GAP : -100 + i * GAP, bob: random() * 6.28, next: 900 + random() * 3000 }))
  const ships = [...fleet(FREEMEN, 0), ...fleet(DOMINION, 1)]
  const available = ships.filter(s => { try { artFor(s.id, 'sprite'); return true } catch { return false } })
  host.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveDisciplineRatio="xMidYMid slice"><image href="/space/tables/nebula.png" width="${W}" height="${H}" preserveDisciplineRatio="xMidYMid slice"/>
    <g id="sf-ships">${available.map(s => `<image href="${artFor(s.id, 'sprite').src}" width="${s.len * 2}" height="${s.len * 2}" x="${-s.len}" y="${-s.len}" style="image-rendering:pixelated"/>`).join('')}</g>
    <rect id="sf-dark" width="${W}" height="${H}" fill="#000" opacity="0"/><g id="sf-fx"></g></svg>`
  const images = [...host.querySelectorAll('#sf-ships image')], dark = host.querySelector('#sf-dark'), fx = host.querySelector('#sf-fx')
  let shots = [], raf = 0, last = performance.now(), t0 = last, shown = ''

  const fire = (s, foes) => {
    const near = foes.filter(f => Math.abs(f.x - s.x) < 900).sort((a, b) => Math.hypot(a.x - s.x, a.y - s.y) - Math.hypot(b.x - s.x, b.y - s.y))[Math.floor(random() * 2)]
    if (!near) return
    const lance = random() < 0.4, n = lance ? 1 : 6
    for (let i = 0; i < n; i++) shots.push({ lance, side: s.side, from: { x: s.x, y: s.y + (random() - 0.5) * s.len * 0.8 }, to: { x: near.x + (random() - 0.5) * near.len, y: near.y + (random() - 0.5) * near.len * 0.7 }, t: lance ? 0 : -i * 70, life: lance ? 500 : 1100 })
  }
  function tick (now) {
    const dt = Math.min(100, now - last); last = now
    const l = light()
    const d = l ?? (() => { const ms = now - t0, v = darkness(ms); return { dark: v, name: phaseName(ms, v) } })()
    dark.setAttribute('opacity', d.dark * DARK)
    const name = PILL[d.name] ?? d.name
    if (name !== shown) { shown = name; phase.textContent = name; phase.classList.toggle('dark', d.dark > 0.5) }
    available.forEach((s, i) => {
      s.x += (s.side ? -1 : 1) * SPEED * dt / 1000
      if (s.x > W + 700) s.x = -700; if (s.x < -700) s.x = W + 700   // round again, out of sight
      const y = s.y + Math.sin(now / 2400 + s.bob) * 5
      s.at = y
      images[i].setAttribute('transform', `translate(${s.x} ${y}) rotate(${s.side ? -90 : 90})`)
      if ((s.next -= dt) < 0) { s.next = 1400 + random() * 3600; fire(s, available.filter(f => f.side !== s.side)) }
    })
    let h = ''
    shots = shots.filter(p => (p.t += dt) < p.life)
    for (const p of shots) {
      const colour = p.side ? '#ff7a5a' : '#8fd0ff'
      if (p.t < 0) continue
      const f = p.t / p.life
      if (p.lance) h += `<line x1="${p.from.x}" y1="${p.from.y}" x2="${p.to.x}" y2="${p.to.y}" stroke="${colour}" stroke-width="${3 * (1 - f) + 0.6}" opacity="${1 - f}"/><circle cx="${p.to.x}" cy="${p.to.y}" r="${6 + f * 16}" fill="#fff" opacity="${(1 - f) * 0.7}"/>`
      else if (f < 0.85) { const q = f / 0.85; h += `<circle cx="${p.from.x + (p.to.x - p.from.x) * q}" cy="${p.from.y + (p.to.y - p.from.y) * q}" r="1.8" fill="#ffd98a"/>` }
      else h += `<circle cx="${p.to.x}" cy="${p.to.y}" r="${3 + (f - 0.85) * 60}" fill="#ffb060" opacity="${(1 - f) * 4}"/>`
    }
    fx.innerHTML = h
    raf = requestAnimationFrame(tick)
  }
  raf = requestAnimationFrame(tick)
  return () => cancelAnimationFrame(raf)
}
