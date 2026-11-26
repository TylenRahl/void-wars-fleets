// THE SVG STYLE — a ship's blueprint (src/view/blueprint.js) drawn as vectors: hulls shaded across the beam with a
// gradient, every hull part outlined, gun ports, windows, lance tips and engines given a soft glow. Prow up.
// The sprite style is the same blueprint drawn as pixel art (PNGs in public/space/sprites/), so the two always match.
// Exports shipSvg(id, opts); used by shipArt.js.
import { blueprint, fortQuadrant, palette, GLOW_ROLES, DEFAULT_DESIGN, DEFAULT_LANCE } from './blueprint.js'

let uid = 0
const n = v => +v.toFixed(2)
const SHADED = ['hull', 'hullLight', 'panel', 'prow', 'prowLight', 'trim', 'rock', 'rockLight']

/** An SVG string for a ship or ordnance counter. opts: design, scheme, lance, height (pixel height; width follows). */
export function shipSvg(id, opts = {}) {
  const bp = opts.quadrant ? fortQuadrant(id, opts.quadrant) : blueprint(id, opts.design ?? DEFAULT_DESIGN, opts.lance ?? DEFAULT_LANCE), pal = palette(bp.fleet, opts.scheme), p = `vwf${++uid}`
  const pad = bp.exact ? 0 : bp.box.w * 0.06 + 2
  const vb = [bp.box.x - pad, bp.box.y - pad, bp.box.w + pad * 2, bp.box.h + pad * 2]
  const sw = n(Math.max(bp.box.h, bp.box.w) / 300 + 0.2)   // outline width in drawing units
  const fill = role => SHADED.includes(role) ? `url(#${p}-${role})` : pal[role]
  const grads = SHADED.map(role => `<linearGradient id="${p}-${role}" x1="0" x2="1" y1="0" y2="0">
<stop offset="0" stop-color="${mix(pal[role], '#ffffff', 0.25)}"/><stop offset="0.45" stop-color="${pal[role]}"/><stop offset="1" stop-color="${mix(pal[role], '#000000', 0.4)}"/></linearGradient>`).join('')
  const shape = (q, extra = '') => q.s === 'poly' ? `<polygon points="${q.pts.map(([x, y]) => `${n(x)},${n(y)}`).join(' ')}"${extra}/>`
    : q.s === 'rect' ? `<rect x="${n(q.x)}" y="${n(q.y)}" width="${n(q.w)}" height="${n(q.h)}"${extra}/>`
    : `<circle cx="${n(q.cx)}" cy="${n(q.cy)}" r="${n(q.r)}"${extra}/>`
  const body = [], halo = []
  // opts.layer: 'hull' draws the ship without its turning guns, a number one gun alone, on the same canvas (src/battle/guns.js)
  const shown = opts.layer == null ? bp.parts : opts.layer === 'hull' ? bp.parts.filter(q => q.l == null) : bp.parts.filter(q => q.l === opts.layer)
  for (const q of shown) {
    if (GLOW_ROLES.includes(q.f)) { body.push(shape(q, ` fill="${pal[q.f]}"`)); if (q.f === 'glow' || q.f === 'glowCore') halo.push(shape(q, ` fill="${pal.glow}"`)) }
    else body.push(shape(q, ` fill="${fill(q.f)}" stroke="${pal.outline}" stroke-width="${sw}" stroke-linejoin="round"`))
  }
  const size = opts.height ? ` height="${opts.height}" width="${n(opts.height * vb[2] / vb[3])}"` : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.map(n).join(' ')}"${size}>
<defs>${grads}<filter id="${p}-blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${n(sw * 3)}"/></filter></defs>
<g filter="url(#${p}-blur)" opacity="0.9">${halo.join('')}</g>${body.join('')}</svg>`
}

function mix(a, b, t) {
  const h = s => [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16)), A = h(a), B = h(b)
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('')
}
