// Race rules as data, one entry per fleet. Exports RACE_RULES and raceRule(fleet); the rules code (rules/game.js, ordnance.js,
// damage.js and others) asks raceRule(fleet) instead of testing a fleet's name. Field meanings:
// leadership the D6 table for randomly generated Resolve, index 1-6 (replaces the standard table)
// boardPlus added to the D6 in a boarding action, attacking or defending
// harPlus added to the D6 of the fleet's own Hit-and-Run attacks (assault craft, torpedoes, teleports); 2 to 7 on a D6 means a natural 1 does not fail
// harAgainst added to (negative) the D6 of enemy Hit-and-Run attacks against its ships
// boardingTorpedoes its torpedo tubes may fire boarding torpedoes
// assaultPoints Assault points a capital ship earns each turn landing troops or bombarding in a Planetary Assault
// worldbreakerNeed what a host barge needs to exterminate the planet
export const RACE_RULES = {
  // Concord: Resolve table, boarding and Hit-and-Run bonuses, Planetary Assault points, Worldbreak, boarding torpedoes
  concord: { leadership: [null, 8, 8, 9, 9, 10, 10], boardPlus: 2, harPlus: 1, harAgainst: -1, boardingTorpedoes: true, assaultPoints: 2, worldbreakerNeed: 3 },
}
// The Phage. Hit-and-Run: +1 for their own raids, lowest of two dice against them. Boarding: double value, best of two
// dice. navLd: Resolve checks to navigate celestial phenomena. defaultLd: Brace For Impact with no queen ship within 45 cm. noLdRoll: Resolve is not rolled.
// doubleCraft, a fleet that cannot run out of ordnance has twice the launch limit. They do not earn 2 Assault points a ship; their Planetary Assault scores brood cysts instead.
RACE_RULES.phage = { harPlus: 1, harLowestAgainst: true, boardDouble: true, boardBest: 2, navLd: 10, defaultLd: 7, scent: 45, noLdRoll: true, doubleCraft: true, boardingTorpedoes: true }
// The Rukka. ldMinus: every Rukka ship takes 1 off the Resolve it rolled. freeAheadFull: All Ahead Full needs no Command check
// unless one has already failed this turn; aheadFullDice: 2D6 instead of 4D6. boardPlus: +1 in boarding actions. noCombineTorpedoes: gangs may not combine salvoes.
RACE_RULES.rukka = { boardingTorpedoes: true, boardingUpgrade: 'btorp', boardingSpeed: 20, ldMinus: 1, freeAheadFull: true, aheadFullDice: 2, boardPlus: 1, noCombineTorpedoes: true, variableLaunch: true }
// The Thnitoi. ldPlus: +1 on the Resolve table. noMinMove: cruisers have no minimum move and no distance before turning, but no Burn Retros.
// autoNewHeading: Come to New Heading needs no Command check. boardFirst/boardLater: +1 in the first round of a boarding action, -1 in later rounds. harPlus: +1 on Hit-and-Run, not Harpoons.
// alwaysClosing: weapons batteries count every target as closing. ordnanceHitOn: turrets hit their ordnance only on a 6. rerollTorpedoMiss: a torpedo that misses re-rolls.
// noTurretBonus: escorting fighters give bombers no turret bonus. celestialCheck: a Resolve check ignores celestial phenomena. critOn 6.
RACE_RULES.thnitoi = { ldPlus: 1, noMinMove: true, autoNewHeading: true, boardFirst: 1, boardLater: -1, harPlus: 1, alwaysClosing: true, ordnanceHitOn: 6, rerollTorpedoMiss: true, noTurretBonus: true, celestialCheck: true, slaveTaking: true }
export const raceRule = fleet => RACE_RULES[fleet] ?? {}
