// THE BLAST DOORS shown when To battle is pressed, with their sound (sound/doorSound.js). They shut, `behind`
// runs out of sight, they open. Exports battleDoors; used by battle.js. The CSS (.battle-doors in pages.css) has these timings too, written separately: keep them matched.
import * as doorSound from '../sound/doorSound.js'

const DOORS_CLOSE_MS = 700, DOORS_HOLD_MS = 450, DOORS_OPEN_MS = 1100
const door = side => `<i class="df-door ${side}">
      <span class="door-plate top"></span><span class="door-plate bottom"></span>
      <span class="door-ribs"></span>
      <span class="door-edge"></span>
      <span class="door-lamp"></span>
      <span class="door-stencil">${side === 'left' ? 'BAY' : '40'}</span>
      <span class="door-seal"><span class="door-skull"></span></span>
    </i>`

export function battleDoors (behind) {
  const doors = document.createElement('div')
  doors.className = 'battle-doors'
  doors.innerHTML = door('left') + door('right')
  document.body.append(doors)
  doorSound.shut(DOORS_CLOSE_MS)
  setTimeout(() => {
    doors.classList.add('shut')
    behind()
    doorSound.lock()
    setTimeout(() => {
      doors.classList.add('open')
      doorSound.open(DOORS_OPEN_MS)
      setTimeout(() => doors.remove(), DOORS_OPEN_MS + 50)
    }, DOORS_HOLD_MS)
  }, DOORS_CLOSE_MS)
}
