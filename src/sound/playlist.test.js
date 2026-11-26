// THE BATTLE MUSIC'S SHUFFLE (playlist.js): every track once per deck, and never the same song
// twice in a row across decks.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createRng } from '../rules/dice.js'
import { shuffled } from './playlist.js'

test('every track plays once before any plays again, and none twice running', () => {
  const tracks = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i']
  const random = createRng(7)
  let last = null
  for (let round = 0; round < 500; round++) {
    const deck = shuffled(tracks, random, last)
    assert.deepEqual([...deck].sort(), tracks)
    assert.notEqual(deck[0], last)
    last = deck[deck.length - 1]
  }
})

test('one track is simply played again', () => {
  assert.deepEqual(shuffled(['only'], createRng(1), 'only'), ['only'])
})
