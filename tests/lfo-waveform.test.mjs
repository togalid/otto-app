import test from 'node:test'
import assert from 'node:assert/strict'
import { lfoWaveValue } from '../dist/groove.js'

test('LFO preview waveforms repeat and have distinct shapes', () => {
  for (const wave of ['sine', 'triangle', 'sawtooth', 'square']) {
    assert.equal(lfoWaveValue(wave, .25), lfoWaveValue(wave, 1.25))
  }
  assert.equal(lfoWaveValue('square', .25), 1)
  assert.equal(lfoWaveValue('square', .75), -1)
  assert.equal(lfoWaveValue('sawtooth', .25), .5)
  assert.equal(lfoWaveValue('triangle', .25), 1)
})
