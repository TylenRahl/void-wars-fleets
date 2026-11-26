// The board art (boardArt.js, boardSvg.js): every table and every piece exists in both styles, and the pieces are the rules' sizes.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { TABLES, CATALOGUE, piece, partsBox, tableScene } from './boardArt.js'
import { tableSvg, pieceSvg } from './boardSvg.js'

const PUBLIC = fileURLToPath(new URL('../../public/space/', import.meta.url))

test('every table has a sprite PNG and an SVG drawing', () => {
  assert.ok(TABLES.length >= 8)
  for (const t of TABLES) {
    assert.ok(existsSync(`${PUBLIC}tables/${t.id}.png`), `sprite missing for ${t.id}`)
    assert.match(tableSvg(t.id), /^<svg[\s\S]*<\/svg>$/)
    assert.ok(tableScene(t.id).length > 50, `${t.id} has a picture`)
  }
  for (const id of ['hive-city', 'mountains', 'floating-islands']) assert.ok(TABLES.some(t => t.id === id), `the tables include ${id}`)
})

test('every piece has a sprite PNG, a position record and an SVG drawing', () => {
  const boxes = JSON.parse(readFileSync(`${PUBLIC}pieces/boxes.json`, 'utf8'))
  for (const c of CATALOGUE) {
    assert.ok(existsSync(`${PUBLIC}pieces/${c.key}.png`), `sprite missing for ${c.key}`)
    assert.ok(boxes[c.key], `no position record for ${c.key}`)
    assert.match(pieceSvg(c.kind, c.opts).svg, /^<svg[\s\S]*<\/svg>$/)
  }
})

test('pieces are drawn at the rules\' sizes', () => {
  const size = (k, o) => partsBox(piece(k, o))
  const ast = size('asteroids', { w: 15, h: 10 })
  assert.ok(ast.w >= 13 && ast.w <= 18, `a 15 cm asteroid field is ${ast.w.toFixed(1)} cm wide`)
  const pl = partsBox(piece('planet', { d: 20, type: 'rocky' }).filter(p => p.s === 'clip'))
  assert.equal(pl.w, 20, 'a 20 cm planet is 20 cm across')
  const moon = partsBox(piece('moon', { d: 5 }))
  assert.ok(moon.w <= 5, 'moons are up to 5 cm across')
  const sunburst = partsBox(piece('sunburst'))
  assert.ok(Math.abs(sunburst.w - 5) < 0.3, 'the sunburst template is 5 cm')
})
