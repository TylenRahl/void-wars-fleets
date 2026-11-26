// THE PAGES OF battle.html: start screen, set-up, rules, settings and battle are sections of one HTML page,
// because music can't play on across a real page change. show(id) shows one section at a time, and `music`
// says what happens to the music on each move. Used by battle.js.
import { startMenuMusic, quietMenuMusic, stopMenuMusic, whenMenuSongEnds, duckMenuMusic } from '../sound/menuMusic.js'
import { startBattleMusic, stopBattleMusic, startTableMusic, stopTableMusic } from '../sound/battleMusic.js'
import { startListMusic, stopListMusic, CROSSFADE as LIST_CROSSFADE } from '../sound/listMusic.js'

const PAGES = ['title', 'setup', 'rules', 'settings', 'battle']
export function show (id) { for (const p of PAGES) document.getElementById(p).hidden = p !== id }

// out of the fleet builder: its songs sink while Alien Struggle comes back up, as slowly as they came in
function leaveListMusic () { if (stopListMusic()) quietMenuMusic(LIST_CROSSFADE) }

export const music = {
  // Start: music.title answers what startMenuMusic answers, for the light and the Press any key card
  title () { stopBattleMusic(); stopTableMusic(); leaveListMusic(); return startMenuMusic() },
  menu () { leaveListMusic(); quietMenuMusic() },                      // Rules, Settings
  lists () { stopBattleMusic(); quietMenuMusic(); startListMusic({ after: go => whenMenuSongEnds(() => { duckMenuMusic(LIST_CROSSFADE); go() }) }) },
  battlePage () { stopListMusic(); stopMenuMusic(); startBattleMusic() },
  // behind the shut doors; `heard` false when the player has muted the battle
  table (heard) { stopBattleMusic(); if (heard) startTableMusic() },
  mute (off) { if (off) stopTableMusic(); else startTableMusic() },
}
