// THE WEATHER AT SEA (Tides of the Archipelago): the PixiJS weather layer (shared/weather.js) on a see-through canvas
// over the board: rain, a storm with lightning, or fog, chosen from the battle's seed, coming and going. Decoration only:
// it reads no game state and has its own random source. Exports startSeaWeather; used by battle.js.
let running = null

export async function startSeaWeather (host, seed = 1) {
  if (running) return running
  const [{ Application }, { createWeather }] = await Promise.all([import('pixi.js'), import('../shared/weather.js')])
  const app = new Application()
  await app.init({ backgroundAlpha: 0, resizeTo: host, antialias: false })
  app.canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none'
  app.canvas.id = 'sea-weather'
  host.appendChild(app.canvas)
  const weather = createWeather(app.stage, { width: app.screen.width, height: app.screen.height, seed: 7 + seed, wind: 1, changing: true })
  const kind = ['rain', 'storm', 'fog'][Math.abs(seed) % 3]
  weather.set(kind)
  app.renderer.on('resize', (w, h) => weather.resize(w, h))
  app.ticker.add(t => weather.tick(t.deltaMS / 1000))
  running = { app, weather, kind }
  return running
}
