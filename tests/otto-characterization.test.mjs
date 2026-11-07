import test from 'node:test'
import assert from 'node:assert/strict'
import { ottoReply } from '../dist/buddy.js'
import { melodyRole, melodyPalette } from '../dist/music.js'
import { ottoStyleFor } from '../dist/otto-style.js'

// Exercise safe note attacks and held notes across keys, styles and harmony changes.
test('Otto avoids clashing notes throughout the 288-case phrase corpus', () => {
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
            const reply = ottoReply(input, palette, swing, 120, ottoStyleFor(styleId))
            assert.ok(reply.length > 0)
            for (const note of reply) {
              assert.ok(note.duration > 0)
              assert.ok(note.at + note.duration <= 8 + 1e-9)
              for (let beat = note.at; beat < note.at + note.duration - 1e-9; beat += .01) {
                assert.ok(palette(beat).some(p => p.midi === note.midi && !p.clash),
                  `unsafe pitch ${note.midi} at ${beat}`)
              }
            }
            results.push(reply)
          }
        }
      }
    }
  }
  assert.equal(results.length, 288)
})
