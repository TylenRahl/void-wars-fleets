// THE START SCREEN: the menu buttons (Battle, Fleet Lists, Rules, Settings) and the Space / Sea toggle.
// Exports showTitle; used by battle.js. The first visit opens
// on a black card, Press any key: a browser plays nothing until the page is touched, and the card means that first press
// can't land on a button. When the song is really playing the card goes, the buttons come, the picture fades up. Later visits
// have no card. The ship picture is startField.js.
import { startField } from './startField.js'
import { seaField } from './seaField.js'   // the sea skin's background: ships between islands
import { SEA, GAME_TITLE, setSkin } from '../skin.js'

const MODES = [
  { id: 'battle', label: 'Battle', note: 'scenario, fleets and table', primary: true },
  { id: 'lists', label: 'Fleet Lists', note: 'build and save' },
  { id: 'rules', label: 'Rules', note: 'how to play' },
  { id: 'settings', label: 'Settings', note: 'sound' },
]

let pressedOnce = false

export function showTitle ({ host, startMusic, onChoose }) {
  host.replaceChildren()
  const field = document.createElement('div'); field.className = 'sb-space'
  const centre = document.createElement('div'); centre.className = 'sb-centre'
  centre.innerHTML = `<div class="sb-title">${GAME_TITLE[0]}<em>${GAME_TITLE[1]}</em></div><div class="sb-subtitle">Hotseat &middot; Both fleets, one keyboard</div>`
  // THE SKIN TOGGLE, top left: Space or Sea; choosing the other one reloads into it
  const toggle = document.createElement('div'); toggle.className = 'sb-skin'
  toggle.innerHTML = ['space', 'sea'].map(k => `<button data-skin="${k}" class="${(k === 'sea') === SEA ? 'on' : ''}">${k === 'sea' ? 'Sea' : 'Space'}</button>`).join('')
  toggle.addEventListener('click', e => { const b = e.target.closest('[data-skin]'); if (b && (b.dataset.skin === 'sea') !== SEA) setSkin(b.dataset.skin) })
  host.append(toggle)
  const phase = document.createElement('div'); phase.className = 'sb-phase'
  const nav = document.createElement('nav'); nav.className = 'sb-nav'
  centre.append(phase, nav)
  host.append(field, centre)

  let music = null, started = false
  const DAYLIGHT = { dark: 0, name: 'Daylight' }
  const stopField = (SEA ? seaField : startField)(field, phase, () => started ? (music?.light?.() ?? null) : DAYLIGHT)

  const menu = () => {
    nav.replaceChildren(...MODES.map(m => { const b = document.createElement('button'); b.className = 'sb-btn' + (m.primary ? ' primary' : ''); b.dataset.page = m.id; b.innerHTML = `<span>${m.label}</span><span class="sb-btn-note">${m.note}</span>`; return b }))
  }
  nav.addEventListener('click', e => {
    const b = e.target.closest('[data-page]')
    if (!b) return
    stopField(); document.removeEventListener('keydown', pressed); document.removeEventListener('pointerdown', pressed)
    onChoose(b.dataset.page)
  })
  menu()

  const begin = () => {
    music = startMusic()
    music.whenPlaying(() => { started = true; press.remove(); centre.classList.remove('sb-dark'); nav.style.display = ''; phase.style.display = '' })
  }
  const press = document.createElement('div'); press.className = 'sb-press'; press.textContent = 'Press any key'
  function pressed () {
    document.removeEventListener('keydown', pressed); document.removeEventListener('pointerdown', pressed)
    pressedOnce = true
    begin()
  }
  if (pressedOnce) return begin()
  nav.style.display = 'none'; phase.style.display = 'none'
  centre.classList.add('sb-dark'); centre.append(press)
  document.addEventListener('keydown', pressed); document.addEventListener('pointerdown', pressed)
}
