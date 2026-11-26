// Action pips: small HTML buttons that float on the board over the thing they act on (Undo where a
// move started, a weapon pick beside its ship). Exports createActionPips({ host, canvas, toScreen, onHold, screens }),
// which battle.js calls; it returns an object for setting, placing and pressing pips. Space hides and shows them.
// Styled by src/shared/pips.css.
//
// The caller decides what a pip says and what pressing it does; this file only draws the
// pips where the board has them and moves them as the board pans and zooms. It knows
// nothing about rules, and nothing about board units beyond handing them to `toScreen`.
//
// A pip is { key, label, why, icon, at: {x, y} in board units, onPress, state? }. Pips whose `at` is
// the same place sit side by side.
//
// THE AIMING PIPS use five more fields, all optional:
// className extra classes on the button (the round attack pips, the weapon pips);
// free true = not grouped and not lifted: the pip's CENTRE sits on `at`, moved by
// `px` ({x, y} screen pixels) and lifted `lift` board units (negative = lower), so a
// row of attack pips fans out beside a model at any zoom;
// lineTo {x, y} in board units: a dashed line from the pip to that spot (a filled attack pip to its target);
// onHover called with true / false as the pointer enters / leaves the pip;
// drag called with (clientX, clientY) when the pip is dragged and let go somewhere.
// stack true = the pips sharing this spot are a COLUMN, top to bottom in list order, not a row.
// leftOf board units: the group stands to the LEFT of `at`, its right edge this far from it and its middle level with it, instead of
// above it.
// This file still decides nothing: the caller says what each pip means and does.

// The screens over which Space must NOT toggle the pips (a default list; battle.js passes its own).
const SCREENS = ['start', 'setup', 'roster', 'drawer', 'settings-screen']
// How close two anchors must be, in screen pixels, to count as the same place.
const SAME_PLACE = 6
// Pips never go right to the edge of the board: one whose target is off screen is held
// this far inside it, so an action on a unit you have scrolled away from is still found.
const EDGE = 10

export function createActionPips ({ host, canvas, toScreen, onHold = () => {}, screens = SCREENS }) {
  const layer = document.createElement('div')
  layer.id = 'action-pips'
  host.appendChild(layer)
  const lines = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  lines.setAttribute('class', 'pip-lines')
  layer.appendChild(lines)
  const tip = document.createElement('div')
  tip.id = 'pip-tip'
  tip.hidden = true
  host.appendChild(tip)

  // A PIP ANSWERS THE LEFT BUTTON ONLY. It stands on the table, often just where a move
  // is being aimed, and the right button there COMMITS the move — so a right click on a pip
  // is handed straight on to the board underneath, as if the pip were not there (otherwise a
  // commit click could land on the Undo pip).
  for (const type of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'auxclick', 'contextmenu']) {
    layer.addEventListener(type, event => {
      if (event.button === 0 && type !== 'contextmenu') return
      event.preventDefault()
      event.stopPropagation()
      const Kind = event instanceof PointerEvent ? PointerEvent : MouseEvent
      canvas.dispatchEvent(new Kind(type, event))
    }, true)
  }

  let pips = []
  let tipTimer = null
  const drawn = new Map()   // key -> button
  let shown = true
  let frame = null
  let dragging = null     // { button, x, y, moved, line } while an attack pip is being dragged
  let swallowClick = false

  // SPACE HIDES AND SHOWS THEM. Only on the battle board: other screens use Space for
  // their own things, and typing into a number box must not flick the pips away.
  // A TAP TOGGLES, A HOLD (more than HOLD_MS) SHOWS THE LEADERS: while Space is held the board
  // rings every piece that may aim its attacks (the onHold callback); letting go clears it. The
  // toggle is on key-up so a hold does not also flick the pips away.
  const HOLD_MS = 250
  let down = false
  let holding = false
  let holdTimer = null
  window.addEventListener('keydown', event => {
    if (event.key !== ' ' || event.ctrlKey || event.altKey || event.metaKey) return
    if (screens.some(id => document.getElementById(id)?.hidden === false)) return
    const target = event.target
    if (target?.closest?.('input, textarea, select, [contenteditable="true"]')) return
    // Space on a focused button would press it as well; the pips are the only thing Space
    // does on the board.
    event.preventDefault()
    if (event.repeat) return
    if (target instanceof HTMLElement && target !== document.body) target.blur()
    down = true
    holding = false
    clearTimeout(holdTimer)
    holdTimer = setTimeout(() => { if (down) { holding = true; onHold(true) } }, HOLD_MS)
  })
  window.addEventListener('keyup', event => {
    if (event.key !== ' ' || !down) return
    down = false
    clearTimeout(holdTimer)
    if (holding) { holding = false; onHold(false); return }
    shown = !shown
    layer.classList.toggle('hidden', !shown)
    tip.hidden = true
    schedule()
  })
  // A tab switched away from while Space is down never sees the key-up.
  window.addEventListener('blur', () => {
    clearTimeout(holdTimer)
    down = false
    if (holding) { holding = false; onHold(false) }
  })

  function set (list) {
    pips = list
    const keep = new Set(list.map(one => one.key))
    for (const [key, button] of drawn) {
      if (!keep.has(key)) {
        // A removed pip never fires pointerleave: say so, or its hover ring stays on the board.
        if (button._hovering) { const gone = button._pip; setTimeout(() => gone.onHover?.(false), 0) }
        button.remove(); drawn.delete(key)
      }
    }
    for (const pip of list) {
      let button = drawn.get(pip.key)
      if (!button) {
        button = document.createElement('button')
        button.addEventListener('click', event => {
          event.stopPropagation()
          if (swallowClick) { swallowClick = false; return }
          button.blur()
          clearTimeout(tipTimer)
          tip.hidden = true
          button._pip.onPress()
        })
        // The rule shows after a short rest on the pip, not the instant the pointer
        // crosses it on its way across the table — it is a big box over the squad.
        button.addEventListener('pointerenter', () => {
          clearTimeout(tipTimer)
          tipTimer = setTimeout(() => showTip(button), 350)
          button._hovering = true
          button._pip.onHover?.(true)
        })
        button.addEventListener('pointerleave', () => { clearTimeout(tipTimer); tip.hidden = true; button._hovering = false; button._pip.onHover?.(false) })
        button.addEventListener('pointerdown', event => {
          if (event.button !== 0 || !button._pip.drag) return
          dragging = { button, x: event.clientX, y: event.clientY, moved: false, line: null }
        })
        layer.appendChild(button)
        drawn.set(pip.key, button)
      }
      button._pip = pip
      button.className = 'action-pip' + (pip.className ? ` ${pip.className}` : '')
      // A vehicle's gun pip has a state (set by the caller): picked, fired, or held back.
      for (const state of ['picked', 'fired', 'off', 'destroyed']) button.classList.toggle(`is-${state}`, pip.state === state)
      const inner = `${pip.icon ?? ''}<span>${pip.label}</span>`
      if (button._inner !== inner) { button.innerHTML = inner; button._inner = inner; button._size = null }
      button.setAttribute('aria-label', pip.aria ?? pip.label)
    }
    // A rewritten label wipes the controller's letter with it; put the letters back (the controller code re-assigns them anyway).
    for (const key of lettered.keys()) if (!keep.has(key)) lettered.delete(key)
    paintBadges()
    schedule()
  }

  // A DRAGGED ATTACK PIP: a line follows the pointer from the pip; letting go hands the spot to the caller.
  window.addEventListener('pointermove', event => {
    if (!dragging) return
    if (!dragging.moved && Math.hypot(event.clientX - dragging.x, event.clientY - dragging.y) > 5) {
      dragging.moved = true
      dragging.line = document.createElementNS('http://www.w3.org/2000/svg', 'line')
      dragging.line.setAttribute('class', 'pip-drag-line')
      lines.appendChild(dragging.line)
      tip.hidden = true
    }
    if (!dragging.moved) return
    const hostBox = host.getBoundingClientRect()
    const box = dragging.button.getBoundingClientRect()
    dragging.line.setAttribute('x1', box.left - hostBox.left + box.width / 2)
    dragging.line.setAttribute('y1', box.top - hostBox.top + box.height / 2)
    dragging.line.setAttribute('x2', event.clientX - hostBox.left)
    dragging.line.setAttribute('y2', event.clientY - hostBox.top)
  })
  window.addEventListener('pointerup', event => {
    if (!dragging) return
    const drag = dragging
    dragging = null
    drag.line?.remove()
    if (!drag.moved) return
    swallowClick = true
    setTimeout(() => { swallowClick = false }, 0)
    drag.button._pip?.drag?.(event.clientX, event.clientY)
  })

  function showTip (button) {
    const pip = button._pip
    if (!pip?.why) return
    tip.innerHTML = `<b>${pip.tipTitle ?? pip.label}</b>${pip.why}`
    tip.hidden = false
    const box = button.getBoundingClientRect()
    const hostBox = host.getBoundingClientRect()
    const x = box.left - hostBox.left + box.width / 2
    const width = tip.offsetWidth
    tip.style.left = `${Math.max(EDGE, Math.min(hostBox.width - width - EDGE, x - width / 2))}px`
    // Under the pip: above it is the thing it acts on, which is what you are looking at.
    tip.style.top = `${box.bottom - hostBox.top + 8}px`
  }

  // FOLLOWING THE CAMERA, only when it moves. The caller calls place from the board's
  // camera hook, and set and a window resize ask for it too; several asks in one frame
  // are one placement. Running every frame and re-reading the layout each time caused
  // visible lag.
  window.addEventListener('resize', () => schedule())
  function schedule () {
    if (frame === null) frame = requestAnimationFrame(place)
  }
  function place () {
    frame = null
    if (!shown || pips.length === 0) { lines.replaceChildren(); return }
    const hostBox = host.getBoundingClientRect()
    const canvasBox = canvas.getBoundingClientRect()
    const dx = canvasBox.left - hostBox.left
    const dy = canvasBox.top - hostBox.top
    const groups = []
    const here = toScreen(0, 0)
    const inchPixels = Math.hypot(toScreen(1, 0).x - here.x, toScreen(1, 0).y - here.y)
    // A pip that moved out from under the pointer (filled / emptied) also never fires pointerleave.
    for (const button of drawn.values()) {
      if (button._hovering && !button.matches(':hover')) { button._hovering = false; button._pip.onHover?.(false) }
    }
    lines.replaceChildren(...(dragging?.line ? [dragging.line] : []))
    for (const pip of pips) {
      if (pip.free) {
        const button = drawn.get(pip.key)
        if (!button._size) button._size = { w: button.offsetWidth, h: button.offsetHeight }
        const at = toScreen(pip.at.x, pip.at.y)
        const cx = at.x + dx + (pip.px?.x ?? 0)
        const cy = at.y + dy + (pip.px?.y ?? 0) - (pip.lift ?? 0) * inchPixels
        const left = Math.max(EDGE, Math.min(hostBox.width - button._size.w - EDGE, cx - button._size.w / 2))
        const top = Math.max(EDGE, Math.min(hostBox.height - button._size.h - EDGE, cy - button._size.h / 2))
        button.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`
        if (pip.lineTo) {
          const to = toScreen(pip.lineTo.x, pip.lineTo.y)
          const line = document.createElementNS('http://www.w3.org/2000/svg', 'line')
          line.setAttribute('class', 'pip-line')
          line.setAttribute('x1', left + button._size.w / 2)
          line.setAttribute('y1', top + button._size.h / 2)
          line.setAttribute('x2', to.x + dx)
          line.setAttribute('y2', to.y + dy)
          lines.appendChild(line)
        }
        continue
      }
      const at = toScreen(pip.at.x, pip.at.y)
      const x = at.x + dx
      const y = at.y + dy
      const group = groups.find(one => Math.hypot(one.x - x, one.y - y) < SAME_PLACE)
      if (group) group.pips.push(pip)
      else groups.push({ x, y, pips: [pip] })
    }
    const gap = 6
    const rows = groups.map(group => {
      const buttons = group.pips.map(pip => drawn.get(pip.key))
      // Measured once per label, not per placement.
      for (const button of buttons) {
        if (!button._size) button._size = { w: button.offsetWidth, h: button.offsetHeight }
      }
      const widths = buttons.map(one => one._size.w)
      const heights = buttons.map(one => one._size.h)
      // A STACK is a column (`stack`, above): as wide as its widest pip, as tall as all of them.
      const column = group.pips.every(pip => pip.stack)
      const leftOf = group.pips[0].leftOf
      const total = column ? Math.max(...widths) : widths.reduce((sum, w) => sum + w, 0) + gap * (buttons.length - 1)
      const height = column ? heights.reduce((sum, h) => sum + h, 0) + gap * (buttons.length - 1) : heights[0]
      // Held inside the board: a pip for a unit scrolled off screen waits at the edge.
      const wantLeft = leftOf != null ? group.x - leftOf * inchPixels - total : group.x - total / 2
      const wantTop = leftOf != null ? group.y - height / 2 : group.y - height - 8
      const left = Math.max(EDGE, Math.min(hostBox.width - total - EDGE, wantLeft))
      const top = Math.max(EDGE, Math.min(hostBox.height - height - EDGE, wantTop))
      return { buttons, widths, heights, column, total, height, left, top }
    })
    // NO PIP COVERS ANOTHER. Several gun pips on one piece can stand very close, which at a
    // zoomed-out table is less than a pip's width, so one could hide between two others. Lowest first, each row that would overlap one already
    // placed is lifted just clear above it.
    const placed = []
    for (const row of [...rows].sort((a, b) => b.top - a.top)) {
      for (let guard = 0; guard < rows.length; guard++) {
        const hit = placed.find(other => row.left < other.left + other.total + gap && other.left < row.left + row.total + gap &&
          row.top < other.top + other.height + 3 && other.top < row.top + row.height + 3)
        if (!hit) break
        row.top = Math.max(EDGE, hit.top - row.height - 4)
      }
      placed.push(row)
      let left = row.left
      let top = row.top
      row.buttons.forEach((button, i) => {
        if (row.column) {
          // top to bottom in the order the caller listed them, each centred on the column
          button.style.transform = `translate(${Math.round(row.left + (row.total - row.widths[i]) / 2)}px, ${Math.round(top)}px)`
          top += row.heights[i] + gap
          return
        }
        button.style.transform = `translate(${Math.round(left)}px, ${Math.round(row.top)}px)`
        left += row.widths[i] + gap
      })
    }
  }

  // THE CONTROLLER'S LETTERS. Gamepad code asks which
  // pips are on screen, gives the three nearest its cursor X, Y and B, and presses one through the pip's own click, so
  // a pip pressed from the controller does exactly what a mouse click on it does. Optional: nothing needs to call these.
  let lettered = new Map() // key -> letter shown
  function paintBadges () {
    for (const [key, button] of drawn) {
      const letter = lettered.get(key) ?? null
      let badge = button.querySelector(':scope > .pad-badge')
      if (!letter) { badge?.remove(); continue }
      if (!badge) { badge = document.createElement('span'); badge.className = 'pad-badge'; button.prepend(badge) }
      if (badge.textContent !== letter) { badge.textContent = letter; badge.dataset.letter = letter }
    }
  }
  function badges (map) {
    const same = map.size === lettered.size && [...map].every(([key, letter]) => lettered.get(key) === letter)
    if (same) return
    lettered = new Map(map)
    paintBadges()
  }
  // The pips that can be pressed now, with their centres in client pixels.
  function onScreen () {
    if (!shown) return []
    const out = []
    for (const [key, button] of drawn) {
      const box = button.getBoundingClientRect()
      if (box.width === 0 && box.height === 0) continue
      out.push({ key, x: box.left + box.width / 2, y: box.top + box.height / 2 })
    }
    return out
  }
  function press (key) {
    const button = drawn.get(key)
    if (!button || !shown) return false
    button.click()
    return true
  }

  return {
    set,
    place: schedule,
    get shown () { return shown },
    onScreen,
    badges,
    press,
    get lettered () { return new Map(lettered) }
  }
}
