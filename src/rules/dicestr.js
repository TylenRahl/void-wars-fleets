// Dice strings in Rukka profiles: 'D6', 'D6+2', 'D3+1', '2D6', '2D6+6' (each Rukka banger's profile gives its own roll and modifier).
// A plain number is a fixed value. Every roll goes through the game's seeded source (dice.js).
// Exports isDiceStr, parseDice, maxOf, rollStr, textOf and addMod; used by the Rukka rules, shooting, ordnance and the fleet lists.
import { d6, d3 } from './dice.js'

const RE = /^(\d*)D(3|6)([+-]\d+)?$/
export const isDiceStr = s => typeof s === 'string' && RE.test(s)
export function parseDice (s) {
  if (typeof s === 'number') return { n: 0, sides: 6, mod: s, fixed: true }
  const m = RE.exec(s)
  if (!m) throw new Error(`not a dice string: ${s}`)
  return { n: +(m[1] || 1), sides: +m[2], mod: +(m[3] || 0), fixed: false }
}
/** The most it can be (used to price launch bays: "calculated based on the maximum number of launch bays available"). */
export const maxOf = s => { const p = parseDice(s); return p.fixed ? p.mod : p.n * p.sides + p.mod }
/** Roll it. Returns { total, dice, mod }. */
export function rollStr (rng, s) {
  const p = parseDice(s)
  if (p.fixed) return { total: p.mod, dice: [], mod: p.mod }
  const dice = Array.from({ length: p.n }, () => p.sides === 3 ? d3(rng) : d6(rng))
  return { total: Math.max(0, dice.reduce((a, b) => a + b, 0) + p.mod), dice, mod: p.mod }
}
export const textOf = r => r.dice.length ? `${r.dice.join('+')}${r.mod ? (r.mod > 0 ? '+' : '') + r.mod : ''} = ${r.total}` : String(r.total)
/** The same dice with the modifier moved by `delta` (a fixed number just changes), never below 0 for a fixed number. */
export function addMod (s, delta) {
  if (typeof s === 'number') return Math.max(0, s + delta)
  const p = parseDice(s), m = p.mod + delta
  return `${p.n > 1 ? p.n : ''}D${p.sides}${m ? (m > 0 ? '+' : '') + m : ''}`
}
