// THE STYLE SWITCH — the one place the game asks for a space ship's picture: artFor(id, style, opts), used by battle.js
// and startField.js.
// style 'sprite': the pixel-art PNG in public/space/sprites/<design>/<scheme>/<lance>/<id>.png
// style 'svg': the vector drawing from src/view/svgShips.js
// Both are drawn prow-up from the same blueprint (src/view/blueprint.js), in any design and colour scheme.
import { shipSvg } from './svgShips.js'
import { DEFAULT_LANCE, defaultScheme, blueprint, designOf, fortQuadrant } from './blueprint.js'

export const STYLES = ['sprite', 'svg']
export const spriteUrl = (id, design, scheme, lance) => `/space/sprites/${design}/${scheme}/${lance}/${id}.png`

/** { style, src } — a URL usable as an <img> src or a texture source. opts: design, scheme, lance. */
export function artFor(id, style, opts = {}) {
  const design = opts.design ?? designOf(id), lance = opts.lance ?? DEFAULT_LANCE, scheme = opts.scheme ?? defaultScheme(opts.quadrant ? fortQuadrant(id, opts.quadrant).fleet : blueprint(id, design).fleet)
  const layer = opts.layer
  if (opts.quadrant) return { style: 'svg', src: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(shipSvg(id, { scheme, quadrant: opts.quadrant })) }   // a fort's quadrant has no sprite: always vector
  if (style === 'svg') return { style, src: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(shipSvg(id, { design, scheme, lance, layer })) }
  if (style === 'sprite') return { style, src: layer == null ? spriteUrl(id, design, scheme, lance) : spriteUrl(id, design, scheme, lance).replace(/\.png$/, layer === 'hull' ? '.hull.png' : `.m${layer}.png`) }
  throw new Error(`artFor: unknown style ${style} (use ${STYLES.join(' or ')})`)
}
