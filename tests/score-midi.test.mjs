import assert from 'node:assert/strict'
import test from 'node:test'
import { encodeScoreMidi } from '../dist/score-midi.js'
import { readMidi } from '../scripts/read-midi.mjs'

test('score MIDI keeps pickup timing and releases a pitch before its next attack', () => {
  const notes = [
    {beat:-.5, length:.5, midi:60},
    {beat:0, length:1, midi:60},
  ]
  const bytes = Buffer.from(encodeScoreMidi(notes, 120, 1))
  assert.deepEqual([...bytes.subarray(22, 29)], [0, 255, 81, 3, 7, 161, 32])
  assert.deepEqual(readMidi(bytes).map(({beat, duration, midi}) => ({beat, duration, midi})), [
    {beat:.5, duration:.5, midi:60},
    {beat:1, duration:1, midi:60},
  ])
})
