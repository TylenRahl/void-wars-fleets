// The one random source in the VOID WARS: Fleets game. Never Math.random anywhere else: a seeded game has to
// replay identically or a surprising result can't be reproduced.
// Exports createRng (a seeded mulberry32 generator), scriptedRng (fixed faces, for tests), d6, d3, rollDice, sum,
// count and scatter. Every rules module that rolls dice imports from here. The game's rules are in rules/core/*.md.

export function createRng (seed) {
  if (!Number.isInteger(seed)) throw new Error(`the random seed must be a whole number, got ${seed}`)
  let a = seed >>> 0
  const next = function () {
    a = (a + 0x6D2B79F5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  next.state = () => a
  next.restore = s => { a = s >>> 0 }
  return next
}

/** For tests: a source that hands out the given D6 faces in order, then throws when it runs out. */
export function scriptedRng (faces) {
  let i = 0
  const next = () => {
    if (i >= faces.length) throw new Error(`scripted dice ran out after ${faces.length} rolls`)
    return (faces[i++] - 0.5) / 6
  }
  next.used = () => i
  return next
}

// All rolls use six-sided dice.
export const d6 = rng => Math.floor(rng() * 6) + 1
export const rollDice = (rng, n) => Array.from({ length: Math.max(0, n) }, () => d6(rng))
export const sum = dice => dice.reduce((a, b) => a + b, 0)
// A D3 is a D6 halved, rounding up.
export const d3 = rng => Math.ceil(d6(rng) / 2)
export const count = (dice, need) => dice.filter(v => v >= need).length

// The scatter dice for the sunburst cannon: 2 faces in 6 are a "hit", otherwise an arrow in a random direction.
export function scatter (rng) {
  const f = d6(rng)
  if (f <= 2) return { hit: true, face: f }
  return { hit: false, face: f, angle: Math.floor(rng() * 360) }
}
