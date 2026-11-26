import { defineConfig } from 'vite'

// VOID WARS: Fleets: its own folder, nothing loaded from outside it. Two pages: index.html sends you to
// battle.html, which holds the start screen, the fleet builder and the battle. public/ is served at /, so the ship pictures
// are at /space/... The dev server runs on port 5176.
export default defineConfig({
  server: { port: 5176, watch: { ignored: ['**/dist/**', '**/public/**', '**/sound_screen/**', '**/sound_effects/**'] } },
  build: { target: 'es2022', rollupOptions: { input: { main: 'index.html', battle: 'battle.html' } } },
})
