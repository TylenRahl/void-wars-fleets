// The battle screen's plates that explain things: the "What now?" guide at the top of the side panel (guideHtml) —
// what this step is for in plain words and which of your ships can still do something — the help box behind the
// ? button (HELP, helpHtml), also shown on the Rules page, and the dice strip of the latest rolls.
// Used by battle.js. It reads the game and decides nothing.

// What each step is for and how to finish it.
export const STEP_HELP = {
  setup: 'Set-up: the ship\'s shadow follows the mouse, green where it may stand and red (with the reason) where it may not. Left click holds it there; Q and E turn it, or hold the middle button and swing; right click puts it down. When everyone is down, choose who goes first.',
  movement: 'Manoeuvre: click one of your ships, then its Move pip. A green line follows the mouse: click to fix how far it goes before turning, click to fix the turn, click to fix the run ahead. Right click at any point makes the move as it stands; Esc cancels. End touching an enemy and a Board pip appears on it. Ships must move at least half their speed and can only turn after a set distance. Athanatoi ships sail instead: the ship faces the mouse, the line stretches to it, up to the speed for the arc the sunward edge lies in (the arrow at the table edge). Before moving, a ship may try a special order (a Command check on 2D6 against its Resolve). Ships you leave go straight ahead their minimum.',
  shooting: 'Fire: click one of your ships. Its weapons appear as pips on the side of the ship they are mounted on (Space hides them). Click a weapon pip then a Target pip to aim that weapon, or just a Target pip to aim every gun that can reach (the fans are each weapon\'s range and arc). Press Fire!. Weapons batteries roll on the gunnery table and need the target\'s armour; lances hit on 4+. Shields stop the first hits and leave Blast Markers. Torpedoes and attack craft are launched here too.',
  ordnance: 'Ordnance: torpedoes move by themselves. Attack craft waves are moved by hand: click a wave, then click where it goes (the dashed circle is how far). Flying into an enemy ship attacks it; onto your own ship (fighters) puts them on patrol over it. Teleport pips appear on enemies within 10 cm of your capital ships: green if it is allowed, grey if not, and resting on a grey one says why. The enemy\'s shields must be down. Athanatoi ships make a second move here once all attack craft have moved: click the ship, then its Second move pip.',
  end: 'End phase: boarding actions and teleport attacks are rolled, ships try to repair damage, fires burn and some Blast Markers drift away. It is all rolled for you.',
  over: 'The battle is over: the result and victory points are on the screen and in the log.',
}

const CAN = {
  movement: (game, s, h) => [!s.movedThisPhase && 'Move', !s.order && !s.movedThisPhase && !game.ordersFailed[s.side] && h.orders(s) && 'Special order'],
  shooting: (game, s, h) => [!s.fired && h.canShoot(s) && 'Fire', h.canLaunch(s) && 'Launch'],
  ordnance: (game, s, h) => [h.second(s)],   // only the Athanatoi have something to do by hand here besides the attack craft
}

/** The "What now?" guide. h: helpers from battle.js — orders(s), canShoot(s), canLaunch(s), shortName(s). */
export function guideHtml (game, ui, h) {
  if (h.hidden) return `<div class="guide-head"><b>What now?</b><button class="guide-toggle" data-guide>show</button></div>`
  let out = `<div class="guide-head"><b>What now?</b><button class="guide-toggle" data-guide>hide</button></div>`
  const phase = game.over ? 'over' : game.phase
  if (phase !== 'setup' && phase !== 'over') out += `<div class="guide-who ${game.active ? 'chs' : 'imp'}">${game.sides[game.active].name} to play.</div>`
  out += `<div class="guide-text">${STEP_HELP[phase] ?? ''}</div>`
  if (!CAN[phase]) return out
  const rows = game.ships.filter(s => s.side === game.active && s.state === 'active' && s.pos)
    .map(s => ({ s, what: CAN[phase](game, s, h).filter(Boolean) })).filter(r => r.what.length)
  if (!rows.length && phase === 'ordnance') return out   // the attack craft are moved from the side panel and their pips
  if (!rows.length) return out + `<div class="guide-none">Nothing left for your ships to do here. Press the gold button (bottom right) to go on.</div>`
  out += `<div class="guide-sub">Your ships that can still act (click one):</div><div class="guide-list">`
  for (const r of rows) out += `<button class="guide-row ${ui.selected === r.s.uid ? 'sel' : ''}" data-pick="${r.s.uid}"><span class="guide-unit">${h.shortName(r.s)}</span><span class="guide-what">${r.what.join(' · ')}</span></button>`
  return out + `</div><div class="guide-none">When you are done, press the gold button (bottom right).</div>`
}

// ---------------- the ? box: how to play ----------------
export const HELP = [
  ['The turn', `<p>Each <b>turn</b>, first one player plays all four phases, then the other:</p>
    <ul><li><b>Manoeuvre</b> — every ship moves, maybe on a special order.</li><li><b>Fire</b> — guns fire; torpedoes and attack craft are launched.</li>
    <li><b>Ordnance</b> — torpedoes and attack craft move and attack.</li><li><b>End</b> — boarding, repairs, fires; some Blast Markers go.</li></ul>
    <p>The gold button bottom right ends the phase. The <b>log</b> on the right has every roll: what was rolled and what was needed.</p>
    <p><b>Resolve</b> (6-10) is the crew's quality: tests are 2D6, passed on its value or less.</p>`],
  ['Moving', `<ul><li>Click your ship, then its <b>Move</b> pip: a green line follows the mouse. <b>Click</b> to fix how far before the turn, <b>click</b> to fix the turn, <b>click</b> to fix the run ahead. <b>Right click</b> at any point makes the move as it stands; <b>Esc</b> cancels.</li><li>The tag says how far it goes; the faint circles are the least and most it may move; the green circle is where it ends up.</li>
    <li><b>Athanatoi</b> sail by the sun. Click the ship, then its Move pip: the ship swings round to face the mouse (any heading) and the line stretches to it, from 0 cm (turning on the spot: keep the mouse inside the ship's circle) up to its speed. Its card gives three speeds; which one applies depends on the arc the <b>sunward</b> table edge (the gold arrow) falls in once the ship has turned, and the three fans round the ship show which heading gives which. <b>Click</b> fixes it (click again to free it), <b>right click</b> goes, <b>Esc</b> cancels. If the edge sits exactly on the line between two arcs, a pip lets you pick the speed. In their own Ordnance Phase they get a second move, once every wave of attack craft has gone (a grey pip says why it isn't time yet). On Lock On they may not turn, and Burn Retros, All Ahead Full, Come to New Heading and ramming are not open to them.</li>
    <li>A ship must move at least <b>half its speed</b> and no more than its speed.</li>
    <li>It turns up to its turn angle (45° for most cruisers, 90° for escorts) once, after moving a set distance first: <b>10 cm</b> cruisers, <b>15 cm</b> battleships, none for escorts (the yellow dot).</li>
    <li><b>Special orders</b>, one per ship, before it moves, on a Command check: All Ahead Full (+4D6 cm, no turns), Come to New Heading (an extra turn), Burn Retros (half speed or less), Lock On (re-roll misses), Reload Ordnance, Brace for Impact! (save 4+ against hits). The first failure stops more orders this turn.</li>
    <li>Moving through Blast Markers costs 5 cm. Off the table edge, a ship has left the battle.</li></ul>`],
  ['Fire', `<ul><li>Click your ship, click an enemy: each gun that can reach it is aimed. Press <b>Fire</b>.</li>
    <li><b>Weapons batteries</b>: firepower turns into dice on the gunnery table by how the target is moving (closing, moving away, abeam) and range; each die that equals the target's armour hits.</li>
    <li><b>Lances</b>: one die per strength, 4+ hits whatever the armour. The Athanatoi <b>starlance</b> counts as a lance and can chain extra hits.</li>
    <li><b>Shields</b> stop one hit each and leave a Blast Marker; Blast Markers touching a ship take its shields down.</li>
    <li>Half its hits gone and a ship is <b>crippled</b>: half its guns, shields and turrets. Every hit past the shields rolls for a <b>critical hit</b> on a 6.</li>
    <li>You must fire at the <b>nearest</b> enemy unless the ship passes a Resolve Test.</li></ul>`],
  ['Ordnance', `<ul><li><b>Torpedoes</b>: launched in the Fire Phase in the front arc, they fly straight their speed each Ordnance Phase; each torpedo that reaches a ship rolls against its armour, shields ignored.</li>
    <li><b>Attack craft</b> from launch bays: fighters, bombers, assault boats. Move a wave by clicking it then where it goes. Turrets shoot at them first.</li>
    <li>A ship's tubes and bays are empty after launching until it takes <b>Reload Ordnance</b> orders.</li></ul>`],
  ['Boarding', `<p><b>Boarding</b>: a ship that ends its move touching an enemy may board it. While you are moving, a green <b>Board</b> pip appears on any enemy the move will end touching: click it (it turns gold), then right click to make the move. The ship can't fire or launch that turn. The fight is rolled in the End Phase: each side rolls a D6, with a bonus for the bigger boarding value (hits left, the defender adds its turrets), +1 if the enemy has Blast Markers touching, +2 if crippled, +1 if on special orders, +1 for the Dominion. The loser takes the difference as damage; both may take critical hits. A draw locks the ships together until a later End Phase settles it.</p>
    <p><b>Teleport attacks</b>: in your Ordnance Phase a gold-lined <b>Teleport</b> pip appears on each enemy one of your capital ships can reach: within 10 cm, shields down, and no more hits left than your ship. Your ship must not be crippled, and must be on Lock On, Reload Ordnance or no orders. One attack a ship each turn. Click the pip (click again to cancel) and it is rolled in the End Phase: a D6, 1 fails, 2-6 that result on the critical hits table; an escort is destroyed on 4+.</p>`],
  ['Winning', `<p>Each scenario says how it is won. Most use <b>victory points</b>: an enemy ship destroyed is worth its points, crippled a quarter, disengaged a tenth or a quarter. Cruiser Duel has its own.</p>`],
  ['Controls', `<ul><li><b>Placing a ship</b>: the shadow follows the mouse, green where it may stand, red where it may not. <b>Left click</b> holds it there, <b>Q</b> and <b>E</b> turn it 15°, or hold the <b>middle button</b> and swing it round; <b>right click</b> puts it down. In some scenarios the rules fix which way a ship faces, and the game says so if you try.</li>
    <li><b>M</b> or the Sound button turns the guns' sound on and off.</li>
    <li><b>G</b> shows and hides the grid: thin lines every 10 cm, heavier every 30 cm, the gunnery table's short and long range.</li>
    <li><b>W A S D</b> or the arrow keys move the map. The <b>cinematic zoom</b> flies in on each shot and back out; moving the map yourself cancels it, and it can be turned off on the set-up page.</li>
    <li><b>Mouse wheel</b> zooms, <b>right-drag</b> pans, <b>F</b> shows the whole table.</li>
    <li>The green tags over ships are <b>pips</b>: the buttons for that ship where you are looking. In the Fire Phase each weapon has one, on the side of the ship it is mounted on; grey means it can't fire, and resting on it says why. <b>Space</b> hides and shows them.</li>
    <li>Pips also cover the rarer actions when they are possible: Ram, Disengage, Hold high orbit, Gravity turn, Enter low orbit, Move on, Go on alert, Land troops, Turn over, Detonate, Fighters leave CAP, Combine, and Target on enemy ordnance.</li>
    <li><b>Torpedoes</b>: click the torpedo pip, swing the line with the mouse, then press Launch! or right click.</li>
    <li>"What now?" (bottom right) says what this phase is for and which of your ships can still act.</li>
    <li>The dice at the bottom are the last rolls: green passed, red failed.</li></ul>`],
]
export function helpHtml (tab) {
  return `<button class="close" data-helpclose>Close</button><div class="tabs">${HELP.map(([t], i) => `<button data-helptab="${i}" class="${i === tab ? 'on' : ''}">${t}</button>`).join('')}</div><h3>${HELP[tab][0]}</h3>${HELP[tab][1]}`
}

// ---------------- the dice strip: the latest rolls in the log ----------------
const FACES = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] }
const die = (v, state) => `<span class="die ${state ?? ''}">${[...Array(9)].map((_, i) => `<i class="${FACES[v]?.includes(i) ? 'pip' : ''}"></i>`).join('')}</span>`
/** Up to three of the newest log lines (since `mark`) that show dice: "rolled 3, 5, 6 ... needed 4+" or "needed 8 or less". */
export function diceHtml (log, mark) {
  const lines = log.slice(mark).filter(l => /rolled [1-6](, [1-6])*/.test(l.text)).slice(-3)
  if (!lines.length) return ''
  return lines.map(l => {
    const m = l.text.match(/rolled ((?:[1-6], )*[1-6])/), dice = m[1].split(', ').map(Number)
    const plus = l.text.slice(m.index).match(/needed (\d+)\+/), under = l.text.slice(m.index).match(/needed (\d+) or less/)
    const state = v => plus ? (v >= +plus[1] ? 'passed' : 'failed') : ''
    let note = ''
    if (plus) { const n = dice.filter(v => v >= +plus[1]).length; note = `<span class="note">${plus[1]}+: <span class="${n ? 'ok' : 'bad'}">${n} of ${dice.length}</span></span>` }
    if (under) { const t = dice.reduce((a, b) => a + b, 0); note = `<span class="note">${t} vs ${under[1]} or less: <span class="${t <= +under[1] ? 'ok' : 'bad'}">${t <= +under[1] ? 'passed' : 'failed'}</span></span>` }
    return `<div class="row">${dice.map(v => die(v, state(v))).join('')}${note}</div><div class="what">${l.text.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</div>`
  }).join('')
}
