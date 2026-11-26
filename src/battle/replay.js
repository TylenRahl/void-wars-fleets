// ASKING A PLAYER SOMETHING IN THE MIDDLE OF THE RULES, with an in-game prompt instead of a browser pop-up.
// Exports Ask, snapshot, restore and createAsker; used by battle.js. The rules ask Brace for Impact! and "spend a re-roll?" synchronously, deep inside resolving a shot, and
// only the browser's own confirm box can stop JavaScript there. So: the question throws Ask; the action is rewound to just
// before it started; the prompt is shown; and the action runs again from the top with the answers so far. The seeded dice
// are rewound too, so the replay rolls exactly what the first run rolled, up to the next question.
// It knows nothing about the screen.

export class Ask extends Error {
  constructor (question) { super('a question for the player'); this.question = question }
}

// The game's fields that don't change in an action, or can't be copied: kept as they are.
const KEEP = new Set(['ships', 'rng', 'decide', 'hooks', 'sc', 'table', 'log', 'terrain', 'planet', 'onFx', 'divisions'])
const copy = v => (v === null || typeof v !== 'object') ? v : structuredClone(v)

/** Everything an action can change. Ship objects are restored in place: the action's closures hold them. */
export function snapshot (game) {
  const fields = {}
  for (const [k, v] of Object.entries(game)) if (!KEEP.has(k) && typeof v !== 'function') fields[k] = copy(v)
  return {
    fields,
    rng: game.rng.state?.(),
    log: game.log.length,
    ships: game.ships.map(s => { const { profile, ...rest } = s; return [s, profile, structuredClone(rest)] }),
  }
}
export function restore (game, snap) {
  for (const k of Object.keys(game)) if (!KEEP.has(k) && typeof game[k] !== 'function' && !(k in snap.fields)) delete game[k]
  for (const [k, v] of Object.entries(snap.fields)) game[k] = copy(v)
  game.log.length = snap.log
  game.ships = snap.ships.map(([s]) => s)
  for (const [s, profile, rest] of snap.ships) {
    for (const k of Object.keys(s)) if (!(k in rest) && k !== 'profile') delete s[k]
    Object.assign(s, structuredClone(rest)); s.profile = profile
  }
  if (snap.rng != null) game.rng.restore(snap.rng)
}

/**
 * The asking side of a run. Give the game's decide functions `ask(question)`: it returns the answer given earlier in
 * this run, or throws Ask for a new question.
 */
export function createAsker () {
  const answers = []
  let at = 0
  return { ask: q => { if (at < answers.length) return answers[at++]; throw new Ask(q) }, begin: () => { at = 0 }, answer: a => { answers.push(a) }, clear: () => { answers.length = 0; at = 0 } }
}
