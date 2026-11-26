// THE SOUND SETTINGS behind the Settings page, kept in localStorage under this game's own keys (vwf-sound.*,
// vwf-volume.*). Each sound has an On/Off, a percentage (100 unless moved), and the master over all of them.
// Read by every file in src/sound, battle/sound.js and battle/settingsPage.js. Decoration: nothing here reaches the rules.
const SWITCH_KEY = id => `vwf-sound.${id}`
const VOLUME_KEY = id => `vwf-volume.${id}`

function read (key) { try { return localStorage.getItem(key) } catch { return null } }
function write (key, value) { try { localStorage.setItem(key, value) } catch { /* storage blocked: lasts until reload */ } }

export const isOn = id => read(SWITCH_KEY(id)) !== 'off'
export const setOn = (id, on) => write(SWITCH_KEY(id), on ? 'on' : 'off')
export const menuMusicOn = () => isOn('menu-music')
export const battleMusicOn = () => isOn('battle-music')
export const tableMusicOn = () => isOn('table-music')
export const doorSoundOn = () => isOn('door-sound')
export const gunSoundOn = () => isOn('gun-sound')

export function volumeOf (id) {
  const stored = read(VOLUME_KEY(id)), value = Number(stored)
  return stored !== null && Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 100
}
export function setVolumeOf (id, percent) {
  const value = Math.round(Number(percent))
  if (!Number.isFinite(value)) return
  write(VOLUME_KEY(id), String(Math.max(0, Math.min(100, value))))
  for (const listener of volumeListeners) listener(id)
}
// The multiplier a player puts on its built-in level: its own percentage times the master's.
export function soundLevel (id) { return (volumeOf(id) / 100) * (volumeOf('master') / 100) }
// So a song already playing follows the slider at once.
const volumeListeners = new Set()
export function onVolumeChange (listener) { volumeListeners.add(listener); return () => volumeListeners.delete(listener) }
