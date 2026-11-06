import test from 'node:test'
import assert from 'node:assert/strict'
import { loopPosition } from '../dist/reference-player.js'
test('reference loop preserves intro until the end and wraps exactly at boundary', () => {
  assert.equal(loopPosition(0, 9, 10, 18), 9)
  assert.equal(loopPosition(10, 8, 10, 18), 10)
  assert.equal(loopPosition(12, 23, 10, 18), 11)
  assert.equal(loopPosition(12, 0, 10, 18), 12)
})

import { estimateBpm } from '../dist/reference-player.js'
test('tempo estimator finds steady 120 BPM pulses and rejects silence and short input', () => {
  const rate = 8000
  const samples = new Float32Array(rate * 20)
  for (let beat = 0; beat < 40; beat++) {
    for (let i = 0; i < 300; i++) samples[beat * 4000 + i] = Math.sin(i * .4) * Math.exp(-i / 60)
  }
  assert.ok(Math.abs(estimateBpm(samples, rate) - 120) < 1)
  assert.equal(estimateBpm(new Float32Array(rate * 10), rate), null)
  assert.equal(estimateBpm(samples.subarray(0, rate), rate), null)
})
