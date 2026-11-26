# Third-party components

Everything below keeps its own licence. None of it is stored in this repository: npm installs the packages, and the
fonts are loaded from Google's servers when the page opens.

## Fonts (loaded from fonts.googleapis.com by `battle.html`)

| Font | Copyright | Licence |
|---|---|---|
| Cinzel | Copyright 2020 The Cinzel Project Authors | [SIL Open Font License 1.1](https://openfontlicense.org) |
| Barlow Condensed | Copyright 2017 The Barlow Project Authors | [SIL Open Font License 1.1](https://openfontlicense.org) |

The Open Font License allows use in any project, commercial or not. Linking to Google Fonts needs no notice in the
game. If you copy the font files into the repository instead, include the font's `OFL.txt` beside them, and do not
call a modified version of Cinzel "Cinzel".

## npm packages in the built game

| Package | Version | Licence | Copyright |
|---|---|---|---|
| pixi.js | 8.x | MIT | Mathew Groves, Chad Engler |
| @pixi/colord | 2.x | MIT | Vlad Shilov |
| earcut | 3.x | ISC | Mapbox |
| eventemitter3 | 5.x | MIT | Arnout Kazemier |
| ismobilejs | 1.x | MIT | Kai Mallea |
| parse-svg-path | 0.2 | MIT | Jake Rosoman |
| gifuct-js | 2.x | MIT | Matt Way |
| js-binary-schema-parser | 2.x | MIT | Matt Way |
| tiny-lru | 11.x | BSD-3-Clause | Jason Mulligan |
| @xmldom/xmldom | 0.8 | MIT | Christopher J. Brody and contributors |

## Build tools (not part of the built game)

| Package | Licence |
|---|---|
| vite (and its dependencies: esbuild, rollup, postcss and others) | MIT, ISC or BSD |

The MIT, ISC and BSD licences all allow commercial use, as long as each package's copyright notice and licence
text are kept. The built game in `dist/` includes them in the bundled code. The full licence text of each package is
in `node_modules/<package>/LICENSE` after `npm install`.
