import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { ottoReply } from '../dist/buddy.js'
import { melodyRole, melodyPalette } from '../dist/music.js'
import { ottoStyleFor } from '../dist/otto-style.js'

// Captured before scoring-loop optimization. This protects note choice, stable tie
// ordering, duration and articulation across harmony changes, not wall-clock speed.
test('optimized Otto scoring preserves the existing 288-case phrase corpus', () => {
  const results = []
  for (const key of [0, 2, 7, 11]) {
    for (const chord of ['C', 'FM7', 'G7', 'x:2:maj:s9_b13:0']) {
      for (const swing of [0, 40, 100]) {
        for (const styleId of ['jazz', 'edm_voyage', 'vocal_chip']) {
          const base = melodyPalette(key, chord, key, 'key')[0]
          const palette = beat => Array.from({ length: 37 }, (_, i) => ({
            ...base, midi: 48 + i,
            ...melodyRole(48 + i, beat < 4 ? chord : 'Dm7', key),
          }))
          const phrase = [
            { step: 0, midi: 60, at: 0, duration: .5 },
            { step: 1, midi: 64, at: 1, duration: .5 },
          ]
          for (const input of [[], phrase]) {
            results.push(ottoReply(input, palette, swing, 120, ottoStyleFor(styleId)))
          }
        }
      }
    }
  }
  assert.equal(results.length, 288)
  assert.equal(createHash('sha256').update(JSON.stringify(results)).digest('hex'),
    '979c195612f2dde0d6e397280c5b383eb5ec59f7f9b5a8088e637957b260ee5a')
})
