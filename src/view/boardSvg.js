// THE BOARD IN THE SVG STYLE: the recipes in src/view/boardArt.js drawn as SVG, in centimetres (viewBox units are cm,
// so a piece can be dropped into a table drawing at its real size). Soft parts use a Gaussian blur filter.
// Exports tableSvg, pieceSvg and svgUrl; used by battle.js for the table and the celestial phenomena.
import { tableScene, piece, partsBox, TABLE_W, TABLE_H } from './boardArt.js'

let uid = 0
const n = v => +v.toFixed(2)
const pts = list => list.map(([x, y]) => `${n(x)},${n(y)}`).join(' ')

/** Render parts to SVG markup; defs collects gradients, filters and clip paths. */
function render (parts, defs, ctx) {
  let out = ''
  for (const p of parts) {
    const op = p.a != null && p.a < 1 ? ` opacity="${n(p.a)}"` : ''
    const fl = p.blur ? ` filter="url(#${blurId(defs, ctx, p.blur)})"` : ''
    if (p.s === 'bg') {
      const id = `${ctx}g${uid++}`, h = p.dir === 'h'
      defs.push(`<linearGradient id="${id}" x1="0" y1="0" x2="${h ? 1 : 0}" y2="${h ? 0 : 1}">${p.stops.map(([t, c]) => `<stop offset="${t}" stop-color="${c}"/>`).join('')}</linearGradient>`)
      out += `<rect x="0" y="0" width="${TABLE_W}" height="${TABLE_H}" fill="url(#${id})"${op}/>`
    } else if (p.s === 'circ') out += `<circle cx="${n(p.x)}" cy="${n(p.y)}" r="${n(Math.max(p.r, 0.05))}" fill="${p.f}"${op}${fl}/>`
    else if (p.s === 'ell') {
      const fill = p.stroke ? `fill="none" stroke="${p.f}" stroke-width="${n(p.stroke)}"` : `fill="${p.f}"`
      out += `<ellipse cx="${n(p.x)}" cy="${n(p.y)}" rx="${n(p.rx)}" ry="${n(p.ry)}" transform="rotate(${n(p.rot || 0)} ${n(p.x)} ${n(p.y)})" ${fill}${op}${fl}/>`
    } else if (p.s === 'poly') out += `<polygon points="${pts(p.pts)}" fill="${p.f}"${op}${fl}/>`
    else if (p.s === 'line') out += `<polyline points="${pts(p.pts)}" fill="none" stroke="${p.f}" stroke-width="${n(p.w)}" stroke-linecap="round" stroke-linejoin="round"${op}${fl}/>`
    else if (p.s === 'polys') out += `<path d="${p.list.map(l => 'M' + pts(l).replace(/ /g, 'L') + 'Z').join('')}" fill="${p.f}"${op}/>`
    else if (p.s === 'dots') { const r = n(Math.max(p.r, 0.05)); out += `<path d="${p.pts.map(([x, y]) => `M${n(x - r)},${n(y)}a${r},${r} 0 1 0 ${n(2 * r)},0a${r},${r} 0 1 0 ${n(-2 * r)},0`).join('')}" fill="${p.f}"${op}/>` }
    else if (p.s === 'relief') out += relief(p, defs, ctx)
    else if (p.s === 'clip') {
      const id = `${ctx}c${uid++}`
      defs.push(`<clipPath id="${id}"><circle cx="${n(p.x)}" cy="${n(p.y)}" r="${n(p.r)}"/></clipPath>`)
      out += `<g clip-path="url(#${id})">${render(p.parts, defs, ctx)}</g>`
    }
  }
  return out
}
// A lit landscape (see boardArt.js 'relief'): the strokes' opacity is height. One filter turns that alpha into colour
// through the ramp and multiplies it by a distant light from the top left (azimuth 225°), as the sprite pictures are lit.
function relief (p, defs, ctx) {
  const id = `${ctx}r${uid++}`
  const table = j => {   // the ramp sampled at 16 heights, one channel
    const vals = []
    for (let i = 0; i <= 16; i++) {
      const t = i / 16
      let k = 0
      while (k < p.ramp.length - 2 && t > p.ramp[k + 1][0]) k++
      const [t0, c0] = p.ramp[k], [t1, c1] = p.ramp[k + 1], u = Math.max(0, Math.min(1, (t - t0) / ((t1 - t0) || 1)))
      const ch = c => parseInt(c.slice(1 + j * 2, 3 + j * 2), 16)
      vals.push(n((ch(c0) + (ch(c1) - ch(c0)) * u) / 255))
    }
    return vals.join(' ')
  }
  defs.push(`<filter id="${id}" x="0" y="0" width="${TABLE_W}" height="${TABLE_H}" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">` +
    `<feGaussianBlur in="SourceAlpha" stdDeviation="${n(p.soften ?? 0)}" result="h"/>` +
    `<feColorMatrix in="h" type="matrix" values="0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 0 1" result="grey"/>` +
    `<feComponentTransfer in="grey" result="col"><feFuncR type="table" tableValues="${table(0)}"/><feFuncG type="table" tableValues="${table(1)}"/><feFuncB type="table" tableValues="${table(2)}"/></feComponentTransfer>` +
    `<feGaussianBlur in="SourceAlpha" stdDeviation="${n(p.light ?? 0)}" result="bump"/>` +
    `<feDiffuseLighting in="bump" surfaceScale="${n((p.depth ?? 6) * 1.6)}" diffuseConstant="1.45" lighting-color="#ffffff" result="light"><feDistantLight azimuth="225" elevation="42"/></feDiffuseLighting>` +
    `<feBlend in="col" in2="light" mode="multiply"/></filter>`)
  const strokes = render(p.strokes.map(st => ({ ...st, f: '#ffffff' })), defs, ctx)
  return `<g filter="url(#${id})"><rect x="0" y="0" width="${TABLE_W}" height="${TABLE_H}" fill="#ffffff" opacity="0.004"/>${strokes}</g>`
}
function blurId (defs, ctx, b) {
  const id = `${ctx}b${String(n(b)).replace('.', '_')}`
  if (!defs.some(d => d.includes(`id="${id}"`))) defs.push(`<filter id="${id}" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="${n(b)}"/></filter>`)
  return id
}

/** A table background as an SVG string, 180 x 120 cm. opts.width: the pixel width (height follows). */
export function tableSvg (id, { width = 1080 } = {}) {
  const defs = [], ctx = `t${uid++}`
  const body = render(tableScene(id), defs, ctx)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${TABLE_W} ${TABLE_H}" width="${width}" height="${Math.round(width * TABLE_H / TABLE_W)}" preserveDisciplineRatio="none"><defs>${defs.join('')}</defs>${body}</svg>`
}

/** One piece as an SVG string. Returns { svg, box } where box is its extent in cm round its centre (0, 0). */
export function pieceSvg (kind, opts = {}, { pxPerCm = 6 } = {}) {
  const parts = piece(kind, opts), box = partsBox(parts), defs = [], ctx = `p${uid++}`
  const body = render(parts, defs, ctx)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${n(box.x)} ${n(box.y)} ${n(box.w)} ${n(box.h)}" width="${Math.ceil(box.w * pxPerCm)}" height="${Math.ceil(box.h * pxPerCm)}"><defs>${defs.join('')}</defs>${body}</svg>`
  return { svg, box }
}

export const svgUrl = svg => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
