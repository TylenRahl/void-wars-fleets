// Pictures of the planetary defences for the battle board (space skin): simple vector drawings, pointing up (the
// board turns them to the defence's facing), in the colours of the side that owns them. One drawing serves both
// styles, since blueprint.js draws warships, not stations. Exports defenceArt(id, fleet) and MINE_ART; used by battle.js.
const PAL = {
  freemen: { hull: '#8a909c', dark: '#3d424c', light: '#c9ced8', trim: '#c9a24a', glow: '#9fd0ff' },
  dominion: { hull: '#3a2a2a', dark: '#1a1212', light: '#6a4a44', trim: '#b08840', glow: '#ff6a4a' },
}
const hexPts = (r, cx = 50, cy = 50) => [...Array(6)].map((_, i) => { const a = Math.PI / 3 * i + Math.PI / 6; return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}` }).join(' ')
const DRAW = {
  obsidian: c => `<polygon points="50,4 70,30 96,50 70,70 50,96 30,70 4,50 30,30" fill="${c.dark}" stroke="${c.trim}" stroke-width="2"/><polygon points="50,22 64,50 50,78 36,50" fill="#10141c" stroke="${c.glow}" stroke-width="1.5"/><circle cx="50" cy="50" r="5" fill="${c.glow}"/>`,
  spacestation: c => `<circle cx="50" cy="50" r="40" fill="none" stroke="${c.hull}" stroke-width="9"/><circle cx="50" cy="50" r="40" fill="none" stroke="${c.trim}" stroke-width="1.5" stroke-dasharray="6 5"/>${[0, 60, 120].map(a => `<rect x="47" y="10" width="6" height="80" fill="${c.dark}" transform="rotate(${a} 50 50)"/>`).join('')}<circle cx="50" cy="50" r="13" fill="${c.light}" stroke="${c.trim}" stroke-width="2"/>`,
  orbitaldock: c => `<rect x="40" y="6" width="20" height="88" rx="4" fill="${c.hull}" stroke="${c.dark}" stroke-width="2"/><rect x="6" y="40" width="88" height="20" rx="4" fill="${c.hull}" stroke="${c.dark}" stroke-width="2"/>${[[16, 30], [72, 30], [16, 62], [72, 62]].map(([x, y]) => `<rect x="${x}" y="${y}" width="12" height="8" fill="${c.dark}"/>`).join('')}<circle cx="50" cy="50" r="10" fill="${c.trim}"/>`,
  laserplatform: c => `<polygon points="${hexPts(32)}" fill="${c.hull}" stroke="${c.trim}" stroke-width="2"/>${[0, 120, 240].map(a => `<rect x="46" y="4" width="8" height="34" fill="${c.dark}" transform="rotate(${a} 50 50)"/><rect x="47.5" y="2" width="5" height="8" fill="${c.glow}" transform="rotate(${a} 50 50)"/>`).join('')}<circle cx="50" cy="50" r="9" fill="${c.glow}"/>`,
  torpedolauncher: c => `<polygon points="${hexPts(34)}" fill="${c.hull}" stroke="${c.trim}" stroke-width="2"/>${[[38, 38], [56, 38], [38, 56], [56, 56], [47, 30], [47, 64]].map(([x, y]) => `<rect x="${x}" y="${y}" width="7" height="7" fill="${c.dark}" stroke="${c.light}" stroke-width="1"/>`).join('')}`,
  weaponsplatform: c => `<polygon points="${hexPts(34)}" fill="${c.hull}" stroke="${c.trim}" stroke-width="2"/>${[0, 60, 120, 180, 240, 300].map(a => `<rect x="47" y="10" width="6" height="18" fill="${c.dark}" transform="rotate(${a} 50 50)"/>`).join('')}<circle cx="50" cy="50" r="12" fill="${c.light}" stroke="${c.dark}" stroke-width="2"/>`,
  monitor: c => `<path d="M50 6 L68 30 L68 92 L32 92 L32 30 Z" fill="${c.hull}" stroke="${c.dark}" stroke-width="2"/><rect x="38" y="40" width="24" height="14" fill="${c.dark}"/>${[46, 60, 74].map(y => `<rect x="24" y="${y}" width="8" height="6" fill="${c.trim}"/><rect x="68" y="${y}" width="8" height="6" fill="${c.trim}"/>`).join('')}<rect x="44" y="4" width="12" height="10" fill="${c.glow}"/>`,
  systemship: c => `<path d="M50 10 L64 34 L62 90 L38 90 L36 34 Z" fill="${c.hull}" stroke="${c.dark}" stroke-width="2"/><rect x="42" y="46" width="16" height="12" fill="${c.dark}"/><rect x="40" y="86" width="20" height="6" fill="${c.glow}"/>`,
  fireship: c => `<path d="M50 10 L64 34 L62 90 L38 90 L36 34 Z" fill="${c.hull}" stroke="#ff8030" stroke-width="2"/>${[[44, 40], [52, 52], [44, 64], [52, 76]].map(([x, y]) => `<circle cx="${x + 2}" cy="${y}" r="5" fill="#ff7020" opacity="0.85"/>`).join('')}`,
  airbase: c => `<rect x="10" y="30" width="80" height="40" rx="6" fill="${c.hull}" stroke="${c.dark}" stroke-width="2"/><rect x="18" y="46" width="64" height="8" fill="${c.dark}"/>${[24, 40, 56, 72].map(x => `<rect x="${x}" y="49" width="6" height="2" fill="${c.trim}"/>`).join('')}`,
  lasersilo: c => `<path d="M14 80 A36 36 0 0 1 86 80 Z" fill="${c.hull}" stroke="${c.dark}" stroke-width="2"/><rect x="45" y="12" width="10" height="44" fill="${c.dark}"/><rect x="46" y="8" width="8" height="8" fill="${c.glow}"/>`,
  missilesilo: c => `<rect x="20" y="56" width="60" height="30" rx="4" fill="${c.hull}" stroke="${c.dark}" stroke-width="2"/><path d="M50 8 L58 24 L58 60 L42 60 L42 24 Z" fill="${c.light}" stroke="${c.trim}" stroke-width="2"/>`,
}
// The Isos' orbitals: a soft ring round a core, one drawing for all of them
PAL.isos = { hull: '#c4b183', dark: '#26303a', light: '#efe4c4', trim: '#6a8aa8', glow: '#cfe4f4' }
for (const id of ['isos-orbital-city', 'isos-security-orbital', 'isos-orbital-core', 'isos-waystation-bays', 'isos-waystation-hook', 'isos-waystation-railgun', 'isos-waystation-ion']) {
  DRAW[id] = c => `<circle cx="50" cy="50" r="38" fill="none" stroke="${c.hull}" stroke-width="8"/><circle cx="50" cy="50" r="38" fill="none" stroke="${c.trim}" stroke-width="1.5"/><rect x="34" y="34" width="32" height="32" rx="8" fill="${c.dark}" stroke="${c.light}" stroke-width="2"/><circle cx="50" cy="50" r="6" fill="${c.glow}"/>`
}
/** An SVG data URL of defence `id` for side fleet 'freemen' | 'dominion'. */
export function defenceArt (id, fleet = 'freemen') {
  const c = PAL[fleet] ?? PAL.freemen, draw = DRAW[id]
  if (!draw) return null
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${draw(c)}</svg>`)
}
/** An orbital mine marker: a spiked sphere. */
export const MINE_ART = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${[...Array(8)].map((_, i) => `<rect x="47" y="6" width="6" height="22" fill="#c03030" transform="rotate(${i * 45} 50 50)"/>`).join('')}<circle cx="50" cy="50" r="24" fill="#5a1a1a" stroke="#ff6060" stroke-width="4"/><circle cx="50" cy="50" r="7" fill="#ff8080"/></svg>`)
