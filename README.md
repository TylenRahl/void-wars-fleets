# VOID WARS: Fleets

**Play it in your browser: https://tylenrahl.github.io/void-wars-fleets/**

A turn-based fleet battle game for two players at one keyboard, played in the browser. Fleets of starships, or
of sailing ships in the sea skin *Tides of the Archipelago*, manoeuvre, fire broadsides, launch attack craft
and board each other. Distances are in centimetres on a virtual table; every result comes from six-sided dice. The
game measures, rolls and keeps the log, and you make every decision. There is also a computer opponent.

Nine fleets: the Freemen, the Dominion, the Concord, the Rukka, the Athanatoi, the Thnitoi, the Katharos, the
Phage and the Isos.

## Run it

You need [Node.js](https://nodejs.org) 21 or newer.

```sh
npm install        # once: fetches PixiJS (drawing) and Vite (the local web server)
npm run dev        # starts the game at http://localhost:5176 — open that address in a browser
npm test           # runs the rules tests in the terminal (no browser needed)
npm run build      # makes a static copy in dist/ that any web host can serve
```

On the start screen, the switch at the top left picks **Space** or **Sea**.

## The rules

The rules book is in [`rules/core/`](rules/core/), one chapter per file, starting with
[`01-the-game-and-the-dice.md`](rules/core/01-the-game-and-the-dice.md). The background of each fleet is in
[`rules/armies/`](rules/armies/).

## The code

Plain JavaScript modules, no framework. For how the pieces fit together, read
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). In short:

| Folder | What is in it |
|---|---|
| `src/rules/` | The rules engine: turns, movement, shooting, damage, ordnance, boarding, scenarios, the computer opponent. No drawing; it runs in Node for the tests. |
| `src/data/` | The fleets: ship profiles, weapons, attack craft, fleet lists and their points. |
| `src/battle/` | The page itself: start screen, fleet builder, the battle screen, the log, animations. |
| `src/view/` | Drawing ships, craft, islands and the table as SVG and sprites. |
| `src/sound/`, `src/shared/` | Music, sound settings, weather and the on-board action buttons. |
| `public/` | Pictures served as they are (ship sprites, table pieces, sound files). |
| `sound_screen/`, `sound_effects/` | Music and sound effects. |

## Licences

- Code: MIT, see [LICENSE](LICENSE).
- Music: not included (the author's, all rights reserved); each `sound_screen/` folder's `TRACKS.md` says which file goes where. Every sound effect is synthesised and MIT. See [CREDITS.md](CREDITS.md).
- Fonts and npm packages: see [THIRD-PARTY.md](THIRD-PARTY.md).
- Read [DISCLAIMER.md](DISCLAIMER.md): this is an independent game. If you use or change it, what you do with it is
  your responsibility.
