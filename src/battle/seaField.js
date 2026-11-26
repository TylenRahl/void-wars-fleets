// THE SEA START SCREEN'S BACKGROUND (Tides of the Archipelago). The same idea as
// startField.js (the space one): real ships sail past each other and fire, silently, going from day to night, but on the
// open sea between islands, with wakes, bow waves and broadside smoke. One SVG in table cm. Its own little generator; it
// never touches a game's dice. Exports seaField; used by startScreen.js.
import { seaShipPicture, SEA_SCHEMES } from '../view/seaPictures.js'   // the four sea fleets' own ships
import { seaTableSvg, islandSvg, wakeSvg, WAKE_DEFS, seaCss } from '../view/seaArt.js'
import { darkness, phaseName } from './startField.js'

const W = 112, H = 63   // zoomed in
const DARK = 0.72
const PILL = { Daylight: 'Fair weather', Dusk: 'Dusk', 'Night fight': 'Night action', Dawn: 'Dawn' }
// [ship id, picture length cm, lane y, direction]: the Human fleet sails east, the Orc fleet west, the Elf fleet east, faster
// (and the Dominion fleet sails west below the Orcs)
const LANES = [
  { side: 0, fleet: 'freemen', y: 14, dir: 1, speed: 1.3, ships: [['lantern', 20], ['rimward', 20], ['sword', 12], ['steward', 20]] },
  { side: 1, fleet: 'rukka', y: 39, dir: -1, speed: 1.2, ships: [['rukka-terror', 20], ['rukka-bash-cruisa', 20], ['rukka-savage', 12]] },
  { side: 2, fleet: 'athanatoi', y: 26.5, dir: 1, speed: 2.1, ships: [['ath-selene', 20], ['ath-veil', 20], ['ath-kalyx', 12]] },
  { side: 3, fleet: 'dominion', y: 51, dir: -1, speed: 1.5, ships: [['shambles', 20], ['bloodshed', 20], ['profaner', 12]] }
]
const picture = s => seaShipPicture({ fleet: s.fleet, id: s.id, scheme: SEA_SCHEMES[s.fleet][0].id, teleport: true })
const ISLANDS = [
  // moved off the ship lanes: half off the top and bottom edges and in the corners, clear of the ships and the menu
  { id: 1, kind: 'island', shape: { t: 'ell', x: 8, y: -1, rx: 12, ry: 6, rot: 8 } },
  { id: 2, kind: 'island', shape: { t: 'circ', x: 106, y: 1, r: 6 } },
  { id: 3, kind: 'island', shape: { t: 'ell', x: 22, y: 65, rx: 14, ry: 6.5, rot: -6 } },
  { id: 4, kind: 'island', shape: { t: 'circ', x: 100, y: 64, r: 6.5 } },
  { id: 5, kind: 'island', shape: { t: 'circ', x: 70, y: 2, r: 2.4 } },
  { id: 6, kind: 'island', shape: { t: 'circ', x: 60, y: 62, r: 2.2 } }
]

export function seaField (host, phase, light) {
  seaCss()
  let seed = 20261108
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 }
  const ships = []
  for (const lane of LANES) lane.ships.forEach(([id, len], i) => {
    ships.push({ id, len, fleet: lane.fleet, side: lane.side, dir: lane.dir, speed: lane.speed, y: lane.y + (random() - 0.5) * 3, x: lane.dir > 0 ? 10 - i * 36 : W - 10 + i * 36, bob: random() * 6.28, next: 1500 + random() * 3000 })
  })
  // its own gradient ids: the start screen stays in the page, hidden, under the battle, and a hidden gradient with the
  // board's ids leaves the board's wakes unpainted
  const sf = h => h.replaceAll('sea-wake-', 'sf-wake-')
  const wake = s => sf(wakeSvg({ x: 0, y: 0 }, 0, s.len, 30, 0, true).replace(' mask="url(#sea-water)"', ''))
  host.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveDisciplineRatio="xMidYMid slice" style="width:100%;height:100%;display:block">${sf(WAKE_DEFS)}${seaTableSvg(W, H, 'sf')}
    ${ISLANDS.map(islandSvg).join('')}
    <g id="sf-ships">${ships.map(s => `<g>${wake(s)}<image href="${picture(s)}" width="${s.len}" height="${s.len}" x="${-s.len / 2}" y="${-s.len / 2}" transform="rotate(90)"/></g>`).join('')}</g>
    <g id="sf-fx"></g><rect id="sf-dark" width="${W}" height="${H}" fill="#020a1a" opacity="0"/></svg>`
  const groups = [...host.querySelectorAll('#sf-ships > g')], dark = host.querySelector('#sf-dark'), fx = host.querySelector('#sf-fx')
  let shots = [], raf = 0, last = performance.now(), t0 = last, shown = ''

  // a broadside: flashes and smoke from the side facing the enemy, then shells landing as splashes near it
  const fire = s => {
    const foes = ships.filter(f => f.side !== s.side && Math.abs(f.x - s.x) < 45)
    const near = foes.sort((a, b) => Math.abs(a.x - s.x) - Math.abs(b.x - s.x))[0]
    if (!near) return
    const down = near.y > s.y ? 1 : -1
    for (let i = 0; i < 4; i++) {
      const fx0 = s.x + (i - 1.5) * s.len * 0.18 * s.dir, fy0 = s.at + down * s.len * 0.16
      const tx = near.x + (random() - 0.5) * near.len * 1.6, ty = near.at + (random() - 0.5) * near.len * 0.9
      shots.push({ x: fx0, y: fy0, tx, ty, t: -i * 90, life: 1900, hit: Math.abs(tx - near.x) < near.len * 0.35 })
    }
  }
  function tick (now) {
    const dt = Math.min(100, now - last); last = now
    const d = light() ?? (() => { const ms = now - t0, v = darkness(ms); return { dark: v, name: phaseName(ms, v) } })()
    dark.setAttribute('opacity', d.dark * DARK)
    const name = PILL[d.name] ?? d.name
    if (name !== shown) { shown = name; phase.textContent = name; phase.classList.toggle('dark', d.dark > 0.5) }
    ships.forEach((s, i) => {
      s.x += s.dir * s.speed * dt / 1000
      if (s.x > W + 50) s.x = -50; if (s.x < -50) s.x = W + 50
      s.at = s.y + Math.sin(now / 2600 + s.bob) * 0.6
      const roll = Math.sin(now / 1900 + s.bob) * 2.5
      groups[i].setAttribute('transform', `translate(${s.x.toFixed(2)} ${s.at.toFixed(2)}) rotate(${(s.dir > 0 ? 0 : 180) + roll})`)
      if ((s.next -= dt) < 0) { s.next = 2600 + random() * 4200; fire(s) }
    })
    let h = ''
    shots = shots.filter(p => (p.t += dt) < p.life)
    for (const p of shots) {
      if (p.t < 0) continue
      const f = p.t / p.life
      // the muzzle flash and its smoke drifting off
      if (f < 0.12) h += `<circle cx="${p.x}" cy="${p.y}" r="${0.6 + f * 6}" fill="#ffe2a0" opacity="${1 - f * 8}"/>`
      h += `<circle cx="${p.x + f * 3}" cy="${p.y - f * 1.5}" r="${0.5 + f * 2.6}" fill="#d9dde2" opacity="${0.55 * (1 - f)}"/>`
      // the shell's flight, then a splash (or a burst on the hull)
      const q = Math.min(1, f / 0.45)
      if (f < 0.45) h += `<circle cx="${p.x + (p.tx - p.x) * q}" cy="${p.y + (p.ty - p.y) * q - Math.sin(q * Math.PI) * 4}" r="0.28" fill="#2a2a2a"/>`
      else {
        const g = (f - 0.45) / 0.55
        h += p.hit ? `<circle cx="${p.tx}" cy="${p.ty}" r="${0.8 + g * 2.4}" fill="#ffb060" opacity="${(1 - g) * 0.9}"/><circle cx="${p.tx + g * 2}" cy="${p.ty - g * 2}" r="${0.6 + g * 2}" fill="#3a3a3a" opacity="${(1 - g) * 0.6}"/>`
          : `<circle cx="${p.tx}" cy="${p.ty}" r="${0.4 + g * 2.2}" fill="none" stroke="#ffffff" stroke-width="${0.35 * (1 - g)}" opacity="${1 - g}"/><circle cx="${p.tx}" cy="${p.ty}" r="${0.7 * (1 - g)}" fill="#eaf8ff" opacity="${1 - g}"/>`
      }
    }
    fx.innerHTML = h
    raf = requestAnimationFrame(tick)
  }
  raf = requestAnimationFrame(tick)
  return () => cancelAnimationFrame(raf)
}
