// THE SETTINGS PAGE (Settings > Sound). A row for each sound: On or Off, a slider that a playing song follows at once,
// and on letting go a sample of anything that isn't already playing. Exports showSettings; used by battle.js.
// The values are kept by sound/soundSettings.js.
import { isOn, setOn, volumeOf, setVolumeOf } from '../sound/soundSettings.js'
import { stopMenuMusic, quietMenuMusic } from '../sound/menuMusic.js'
import * as doorSound from '../sound/doorSound.js'
import { sound } from './sound.js'

const ROWS = [
  { id: 'master', label: 'Master', note: 'Over everything below.' },
  { id: 'menu-music', label: 'Menu music', note: 'The start screen, Rules, Settings and Fleet Lists.', toggle: true },
  { id: 'battle-music', label: 'Battle page music', note: 'While you choose a battle. A shuffled deck.', toggle: true },
  { id: 'table-music', label: 'Table music', note: 'On the table. A shuffled deck, under the guns.', toggle: true },
  { id: 'door-sound', label: 'Blast doors', note: 'Hydraulics, a clang as they meet, the bolts, the seal letting go.', toggle: true, sample: () => doorSound.lock() },
  { id: 'gun-sound', label: 'Guns', note: 'Lances, batteries, torpedoes, ships exploding.', toggle: true, sample: () => sound('battery') },
]
const rowHtml = r => `<div class="set-row"><div class="set-name">${r.label}</div>
  ${r.toggle ? `<div class="set-chips">${[['on', 'On'], ['off', 'Off']].map(([v, l]) => `<button data-row="${r.id}" data-value="${v}" class="${isOn(r.id) === (v === 'on') ? 'on' : ''}">${l}</button>`).join('')}</div>` : '<div class="set-chips"></div>'}
  <label class="set-volume"><input type="range" min="0" max="100" step="5" value="${volumeOf(r.id)}" data-volume="${r.id}" aria-label="${r.label} volume"><span data-value-of="${r.id}">${volumeOf(r.id)}%</span></label>
  <div class="set-note">${r.note}</div></div>`

export function showSettings (host) {
  const draw = () => { host.innerHTML = `<h2>Sound</h2>${ROWS.map(rowHtml).join('')}` }
  draw()
  host.onclick = e => {
    const b = e.target.closest('[data-row]')
    if (!b) return
    setOn(b.dataset.row, b.dataset.value === 'on')
    if (b.dataset.row === 'menu-music') { if (b.dataset.value === 'on') quietMenuMusic(); else stopMenuMusic() }
    draw()
  }
  host.oninput = e => {
    const id = e.target.dataset.volume
    if (!id) return
    setVolumeOf(id, e.target.value)
    host.querySelector(`[data-value-of="${id}"]`).textContent = `${e.target.value}%`
  }
  host.onchange = e => ROWS.find(r => r.id === e.target.dataset.volume)?.sample?.()
}
