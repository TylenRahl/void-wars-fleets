import { defineConfig } from 'vite'

// VOID WARS: Fleets: its own folder, nothing loaded from outside it. Two pages: index.html sends you to
// battle.html, which holds the start screen, the fleet builder and the battle. public/ is served at /, so the ship pictures
// are at /space/... The dev server runs on port 5176.
// GITHUB PAGES. The game is played from an address such as https://tylenrahl.github.io/<repo>/, not from the site's root.
// The Pages build (.github/workflows/pages.yml) sets PAGES_BASE=/<repo>/, and then every '/images/...' path in the built
// code, and every pattern that reads such a path, gets that prefix. The source and an ordinary build keep '/images/...'.
const BASE = process.env.PAGES_BASE ?? '/'
const DIRS = 'images|sfx|dw|space|rules-book'
const escaped = BASE.replace(/\//g, '\\/')
const pagesPaths = {
  name: 'pages-paths',
  apply: 'build',
  renderChunk (code) {
    if (BASE === '/') return null
    return code.replace(new RegExp(`(['"\`(])/(${DIRS})/`, 'g'), `$1${BASE}$2/`)
               .replace(new RegExp(`\\\\/(${DIRS})\\\\/`, 'g'), `${escaped}$1\\/`)
  },
  transformIndexHtml (html) { return BASE === '/' ? html : html.replace(/href="\/"/g, `href="${BASE}"`) }
}

export default defineConfig({
  server: { port: 5176, watch: { ignored: ['**/dist/**', '**/public/**', '**/sound_screen/**', '**/sound_effects/**'] } },
  plugins: [pagesPaths],
  base: BASE,
  build: { target: 'es2022', rollupOptions: { input: { main: 'index.html', battle: 'battle.html' } } },
})
