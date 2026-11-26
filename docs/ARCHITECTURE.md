# How the code fits together

Written for someone opening the project cold, with no tools beyond an editor and Node.js.

## Two halves: the rules and the screen

**The rules engine** (`src/rules/`, `src/data/`) is plain JavaScript with no drawing and no browser APIs. It works
in centimetres and degrees on a table measured in centimetres; it never knows what a pixel is. Every test in
`src/**/*.test.js` runs it directly in Node (`npm test`).

**The screen** (`src/battle/`, `src/view/`, `src/sound/`, `src/shared/`) reads the engine's game state, draws it,
and turns clicks into calls on the engine. The engine never imports anything from the screen code.

## The game state

A battle is one plain object, `game`, made by `createFleetBattle` (`src/rules/fleet.js`) for an open battle or
`createScenario` (`src/rules/scenarios.js`) for a scenario. It holds the two sides, every ship (position, facing,
damage, orders), the markers on the table, the current phase and the log.

- **The turn:** `src/rules/turn.js`. The phases are movement, shooting, ordnance and end (`PHASES`); `nextPhase`
  moves on and `checkOver` ends the battle.
- **The log:** every rule that resolves calls `say(game, text)` (`src/rules/game.js`), saying what was rolled and
  what was needed. The battle screen shows the log; the tests read it.
- **Movement:** `src/rules/movement.js` (and `sail.js`, the wind for the sea skin).
- **Shooting:** `src/rules/shooting.js`, damage and critical hits in `damage.js`.
- **Torpedoes and attack craft:** `src/rules/ordnance.js`.
- **Boarding, Hit-and-Run, repairs, the End Phase:** `src/rules/endPhase.js`.
- **Each fleet's own rules:** `firms.js`/`rukka.js`, `thnitoi.js`, `katharos.js`, `phage.js`, `miragefield.js`
  and others, one file per idea.
- **Table features:** `terrain.js`, `effects.js`, `lowOrbit.js`; forts and defences in `fort.js`, `defences.js`.
- **The computer opponent:** `src/rules/computer.js`. It plays through the same engine calls as a human.

## The dice

There is exactly one random source: `createRng(seed)` in `src/rules/dice.js`, stored as `game.rng`. Nothing in the
rules uses `Math.random()`. The same seed and the same decisions replay the same battle, which is how a strange
result can be reproduced. Tests use `scriptedRng([...faces])` from the same file to set the dice they need.
(Only animations and sound in the screen code use `Math.random()`; nothing they do affects the rules.)

## The fleets

- `src/data/ships.js` holds the Freemen and Dominion ships; `ALL_SHIPS` at its end is every ship in the game.
- The other seven fleets are in `src/data/concordShips.js` and the per-fleet files (`rukkaProfiles.js`,
  `isosProfiles.js`, `katharosProfiles.js`, `phageShips.js` …), gathered by `NEW_FLEET_SHIPS` in
  `src/data/fleets.js`.
- Fleet lists (what a legal fleet may contain, and the points) are in `src/data/fleetLists.js` and the per-fleet
  `*Lists.js` files. `src/rules/listCheck.js` checks a fleet against its list.

## Adding a ship

1. Add its profile (id, fleet, name, role, points, hits, speed, turns, shields, armour, turrets, weapons) to the
   fleet's data file in `src/data/`, following a neighbour of the same role.
2. Add it to the fleet's list in `src/data/fleetLists.js` (or the fleet's `*Lists.js`) so the builder offers it.
3. Give it a picture. The sprite style looks for `public/space/sprites/<design>/<scheme>/<lance>/<id>.png`
   (`spriteUrl` in `src/view/shipArt.js`); the drawn style builds it from parts in `src/view/blueprint.js`.
4. Run `npm test`. `src/data/ships.test.js` checks that every profile is complete.

## The page

`index.html` forwards to `battle.html`, which loads `src/battle/battle.js`. That file runs the start screen, the
fleet builder, set-up and the battle screen. `src/battle/fx.js` animates shots and explosions; `src/battle/hud.js`
holds the help plates. The sea skin swaps the pictures (`src/view/sea*.js`) and music but uses the same rules.
