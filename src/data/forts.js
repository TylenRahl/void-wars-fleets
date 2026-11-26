// The Bastion class star fort profile. Exports BASTION (a Freemen and a Dominion copy), read by data/ships.js and the fort rules in rules/fort.js.
// One profile per quadrant (12 hits, 4 shields, armour 5+, 4 turrets); four quadrants make a fort. Freemen and Dominion fleets pay 875 points of
// their own allowance for it, and only as a defence or in place of a planet, so only the planet scenarios (Surprise Attack, Planetary Assault,
// Worldbreak) take it, on the defender's side. The Concord Host Keep is in data/concordShips.js.
const W = (loc, kind, range, str, arc, extra = {}) => ({ loc, kind, range, str, arc, ...extra })
const bastion = (id, fleet, name) => ({ id, fleet, name, role: 'fortress', points: 875, size: 4,
  type: 'defence', hits: 12, speed: 0, turns: 0, shields: 4, armour: { front: 5, other: 5 }, turrets: 4, fort: true, fortRerolls: 1,
  weapons: [W('main', 'battery', 60, 12, ['front']), W('lances', 'lance', 60, 5, ['front']), W('bays', 'bays', 30, 4, []),
    W('basilica', 'battery', 45, 4, 'all'), W('basilica', 'torpedo', 30, 9, 'all')],
  special: ['Four quadrants, each with its own hits, shields and turrets.', 'Only as a defence or in place of a planet; by prior agreement in competitive games.'] })
export const BASTION = [bastion('bastion-freemen', 'freemen', 'Bastion class star fort'), bastion('bastion-dominion', 'dominion', 'Bastion class star fort (rebel)')]
