// THE HUMAN FLEET'S ATTACK CRAFT AND TORPEDOES:
// imp-fury Merlin interceptor -> the fighter gyrocopter: a light brass gyrocopter with twin guns at the nose
// imp-longwing Longwing bomber -> the bomber gyrocopter: two rotors fore and aft, a long body, bombs slung under it, two crew
// imp-shark Pike assault boat -> a fast armoured runic boat with a boarding ramp at the bow and a squad aboard
// imp-torpedo Torpedo salvo -> torpedoes running just under the water, foam trails behind them
// Drawn in the Human fleet's runic style and colour scheme (seaShips.js HUMAN_SCHEMES); each picture points up, centred on 0.
// humanCraftSvg(id, { scheme, n }) returns { vb, inner, svg }; n is how many torpedoes the salvo shows. Used by seaPictures.js.
import { HUMAN_SCHEMES, LOOK, FIG, f, man, gyro, glyph, setRunes } from './seaShips.js'

export const HUMAN_CRAFT = [
  { id: 'fre-fury', name: 'Merlin interceptor', text: 'The fighter: a light gyrocopter with twin guns at the nose' },
  { id: 'fre-longwing', name: 'Longwing bomber', text: 'The bomber: two rotors, a long body, a rack of bombs slung under it, pilot and bombardier' },
  { id: 'fre-shark', name: 'Pike assault boat', text: 'A fast armoured runic boat, boarding ramp at the bow, a squad of greatswords aboard' },
  { id: 'fre-torpedo', name: 'Torpedo salvo', text: 'Torpedoes running just under the water, foam trails behind them (as many as the salvo is strong)' }
]
const rotor = (y, r, dur, C) => `<circle cy="${f(y)}" r="${f(r)}" fill="#cfd6dd" opacity=".08"/><circle cy="${f(y)}" r="${f(r)}" fill="none" stroke="#cfd6dd" stroke-width="${f(r * 0.02)}" opacity=".25"/>
  <g transform="translate(0 ${f(y)})"><g><path d="M${f(-r)} ${f(-r * 0.045)} L${f(r)} ${f(-r * 0.03)} L${f(r)} ${f(r * 0.03)} L${f(-r)} ${f(r * 0.045)}Z" fill="#2a2620"/><path d="M${f(-r * 0.045)} ${f(-r)} L${f(r * 0.03)} ${f(r)} L${f(-r * 0.03)} ${f(r)} L${f(r * 0.045)} ${f(-r)}Z" fill="#2a2620" opacity=".0"/><animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="${dur}s" repeatCount="indefinite"/></g><circle r="${f(r * 0.08)}" fill="${C.trim === '#6c7c8e' ? '#c9a24a' : C.trim}"/></g>`

function fury (C) {
  const s = 30
  // twin guns poking out ahead of the nose of the ordinary gyrocopter
  return [-1, 1].map(sx => `<rect x="${f(sx * s * 0.16 - s * 0.03)}" y="${f(-s * 1.0)}" width="${f(s * 0.06)}" height="${f(s * 0.45)}" fill="#2a2a2a"/><rect x="${f(sx * s * 0.16 - s * 0.045)}" y="${f(-s * 1.02)}" width="${f(s * 0.09)}" height="${f(s * 0.06)}" fill="#111"/>`).join('') + gyro(C, 0, 0, s, () => 0.25)
}
function longwing (C) {
  const s = 30, b = s * 0.32, brass = C.trim === '#6c7c8e' ? '#c9a24a' : C.trim
  const body = `<path d="M0 ${f(-s * 0.9)} C${f(b)} ${f(-s * 0.85)} ${f(b * 1.1)} ${f(-s * 0.2)} ${f(b)} ${f(s * 0.5)} L${f(b * 0.6)} ${f(s * 0.9)} L${f(-b * 0.6)} ${f(s * 0.9)} L${f(-b)} ${f(s * 0.5)} C${f(-b * 1.1)} ${f(-s * 0.2)} ${f(-b)} ${f(-s * 0.85)} 0 ${f(-s * 0.9)}Z" fill="${brass}" stroke="#5a4214" stroke-width="${f(s * 0.03)}"/>`
  let bombs = ''
  for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) { const y = -s * 0.25 + k * s * 0.28, x = sx * b * 1.35; bombs += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(s * 0.07)}" ry="${f(s * 0.12)}" fill="#2e343a" stroke="#111" stroke-width="${f(s * 0.015)}"/><path d="M${f(x - s * 0.07)} ${f(y + s * 0.1)} l${f(s * 0.07)} ${f(s * 0.08)} l${f(s * 0.07)} ${f(-s * 0.08)}Z" fill="${brass}"/><rect x="${f(x - s * 0.07)}" y="${f(y - s * 0.02)}" width="${f(s * 0.14)}" height="${f(s * 0.03)}" fill="#b02a22"/>` }
  const pilot = (y, name) => man(name, 0, y, 0, 0.42)
  return `<ellipse cx="${f(s * 0.2)}" cy="${f(s * 0.3)}" rx="${f(b * 1.6)}" ry="${f(s * 1.1)}" fill="#000" opacity=".28"/>${[-1, 1].map(sx => `<rect x="${f(sx * b * 0.4 - (sx < 0 ? b : 0))}" y="${f(-s * 0.3)}" width="${f(b)}" height="${f(s * 0.06)}" fill="#5a4214"/><rect x="${f(sx * b * 0.4 - (sx < 0 ? b : 0))}" y="${f(s * 0.25)}" width="${f(b)}" height="${f(s * 0.06)}" fill="#5a4214"/>`).join('')}${bombs}${body}
    <ellipse cy="${f(-s * 0.45)}" rx="${f(b * 0.55)}" ry="${f(s * 0.16)}" fill="#3a2a1a"/><ellipse cy="${f(s * 0.15)}" rx="${f(b * 0.55)}" ry="${f(s * 0.16)}" fill="#3a2a1a"/>${pilot(-s * 0.47, 'human-engineer')}${pilot(s * 0.13, 'human-handgunner')}
    ${glyph(2, 0, s * 0.62, s * 0.14, 0, 0.3)}${rotor(-s * 0.55, s * 0.75, 1.3, C)}${rotor(s * 0.55, s * 0.75, 1.5, C)}`
}
function shark (C, rnd) {
  const L = 70, w = 20
  const hull = `M0 ${f(-L / 2)} C${f(w * 0.55)} ${f(-L * 0.35)} ${f(w / 2)} ${f(-L * 0.1)} ${f(w / 2)} ${f(L * 0.25)} L${f(w * 0.42)} ${f(L / 2)} L${f(-w * 0.42)} ${f(L / 2)} L${f(-w / 2)} ${f(L * 0.25)} C${f(-w / 2)} ${f(-L * 0.1)} ${f(-w * 0.55)} ${f(-L * 0.35)} 0 ${f(-L / 2)}Z`
  let h = `<path d="M${f(-w * 0.4)} ${f(L * 0.48)} L${f(-w * 0.9)} ${f(L * 1.1)} L${f(w * 0.9)} ${f(L * 1.1)} L${f(w * 0.4)} ${f(L * 0.48)}Z" fill="#eafaff" opacity=".18"/>`
  h += `<path d="${hull}" fill="#000" opacity=".3" transform="translate(2 3)"/><path d="${hull}" fill="${C.side}" stroke="#000" stroke-width="0.6"/><path d="${hull}" fill="${C.deck}" transform="scale(.86)"/>`
  // the boarding ramp folded up at the bow, the armoured wheelhouse aft, an engine stack with smoke, runes down the sides
  h += `<path d="M${f(-w * 0.3)} ${f(-L * 0.36)} L${f(w * 0.3)} ${f(-L * 0.36)} L${f(w * 0.22)} ${f(-L * 0.24)} L${f(-w * 0.22)} ${f(-L * 0.24)}Z" fill="${C.metal}" stroke="#111" stroke-width="0.5"/>${[0, 1, 2].map(i => `<rect x="${f(-w * 0.26)}" y="${f(-L * 0.35 + i * 2.6)}" width="${f(w * 0.52)}" height="0.5" fill="#111"/>`).join('')}`
  h += `<rect x="${f(-w * 0.3)}" y="${f(L * 0.18)}" width="${f(w * 0.6)}" height="${f(L * 0.16)}" rx="1.4" fill="${C.super}" stroke="${C.superDark}" stroke-width="0.5"/><rect x="${f(-w * 0.24)}" y="${f(L * 0.19)}" width="${f(w * 0.48)}" height="${f(L * 0.03)}" fill="${C.glass}"/>`
  h += `<circle cx="0" cy="${f(L * 0.4)}" r="${f(w * 0.12)}" fill="${C.funnel}" stroke="${C.trim === '#6c7c8e' ? '#c9a24a' : C.trim}" stroke-width="0.6"/>`
  for (let k = 0; k < 2; k++) h += `<circle cx="0" cy="${f(L * 0.4)}" r="2" fill="#55595e" opacity="0"><animate attributeName="cy" values="${f(L * 0.4)};${f(L * 0.75)}" dur="2s" begin="-${k}s" repeatCount="indefinite"/><animate attributeName="r" values="1.5;5" dur="2s" begin="-${k}s" repeatCount="indefinite"/><animate attributeName="opacity" values=".5;0" dur="2s" begin="-${k}s" repeatCount="indefinite"/></circle>`
  for (let y = -L * 0.2, i = 0; y < L * 0.4; y += 6, i++) for (const sx of [-1, 1]) h += glyph(i * 3 + (sx > 0 ? 1 : 0), sx * w * 0.42, y, 2.4, 0, i * 0.3)
  // the boarding squad: greatswords packed in, a captain at the front
  h += man('human-captain-bsb', 0, -L * 0.18, 0, 0.75)
  for (let r = 0; r < 3; r++) for (let c = -1; c <= 1; c += 2) h += man(r === 2 ? 'human-halberdier' : 'human-greatsword', c * w * 0.2, -L * 0.06 + r * FIG * 0.55, 0, 0.62)
  return h
}
function torpedoes (C, n) {
  const tw = 4.4, T = 30, brass = C.trim === '#6c7c8e' ? '#c9a24a' : C.trim
  let h = ''
  for (let k = 0; k < n; k++) {
    const x = (k - (n - 1) / 2) * tw * 2.1, y = Math.abs(k - (n - 1) / 2) * 3
    // the foam trail and bubbles behind, the body seen through the water, the brass nose breaking the surface
    h += `<path d="M${f(x - tw * 0.4)} ${f(y + T * 0.45)} L${f(x - tw * 1.1)} ${f(y + T * 1.6)} L${f(x + tw * 1.1)} ${f(y + T * 1.6)} L${f(x + tw * 0.4)} ${f(y + T * 0.45)}Z" fill="#eafaff" opacity=".22"/>`
    for (let b = 0; b < 3; b++) h += `<circle cx="${f(x)}" cy="${f(y + T * 0.5)}" r="0.9" fill="#ffffff" opacity="0"><animate attributeName="cy" values="${f(y + T * 0.5)};${f(y + T * 1.5)}" dur="1.2s" begin="-${(b * 0.4).toFixed(1)}s" repeatCount="indefinite"/><animate attributeName="opacity" values=".8;0" dur="1.2s" begin="-${(b * 0.4).toFixed(1)}s" repeatCount="indefinite"/><animate attributeName="cx" values="${f(x)};${f(x + (b - 1) * 2)}" dur="1.2s" begin="-${(b * 0.4).toFixed(1)}s" repeatCount="indefinite"/></circle>`
    h += `<rect x="${f(x - tw / 2)}" y="${f(y - T / 2)}" width="${f(tw)}" height="${f(T)}" rx="${f(tw / 2)}" fill="#3e4a52" stroke="#15171a" stroke-width="0.4" opacity=".85"/><path d="M${f(x - tw / 2)} ${f(y - T / 2 + tw * 0.6)} Q${f(x)} ${f(y - T / 2 - tw * 0.7)} ${f(x + tw / 2)} ${f(y - T / 2 + tw * 0.6)}Z" fill="${brass}"/><rect x="${f(x - tw / 2)}" y="${f(y - T / 2 + tw)}" width="${f(tw)}" height="${f(tw * 0.35)}" fill="#b02a22"/>`
    h += `<path d="M${f(x - tw * 0.6)} ${f(y - T / 2)} Q${f(x)} ${f(y - T / 2 - 3)} ${f(x + tw * 0.6)} ${f(y - T / 2)}" fill="none" stroke="#ffffff" stroke-width="0.8" opacity=".7"/>`
  }
  return h
}

export function humanCraftSvg (id, { scheme = 'midnight', n = 3 } = {}) {
  const SCH = HUMAN_SCHEMES.find(x => x.id === scheme) ?? HUMAN_SCHEMES[0]
  setRunes(SCH.rune, SCH.glow)
  const C = { ...LOOK.runic, ...SCH.look }
  const inner = id === 'fre-fury' ? fury(C) : id === 'fre-longwing' ? longwing(C) : id === 'fre-shark' ? shark(C) : id === 'fre-torpedo' ? torpedoes(C, n) : null
  if (inner == null) throw new Error(`humanCraftSvg: no craft called ${id}`)
  const R = id === 'fre-shark' ? 60 : id === 'fre-torpedo' ? 45 : 42
  const vb = { x: -R, y: -R, w: R * 2, h: R * 2 }
  return { vb, inner, svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f(vb.x)} ${f(vb.y)} ${f(vb.w)} ${f(vb.h)}">${inner}</svg>` }
}
