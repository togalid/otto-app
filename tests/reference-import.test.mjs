import test from 'node:test'
import assert from 'node:assert/strict'
import { encodeClip, analyzeSharedReference } from '../dist/reference-import.js'
import { analyzeSharedReference as compatibilityExport } from '../dist/reference-player.js'

test('import pipeline remains available through its original public export', () => {
  assert.equal(compatibilityExport, analyzeSharedReference)
})

test('stem WAV encoding preserves region offsets, stereo interleaving and sample clipping', () => {
  const channels = [Float32Array.of(0, .5, 2, -.5), Float32Array.of(0, -.5, -2, .5)]
  const wav = new DataView(encodeClip({ sampleRate: 4, numberOfChannels: 2, getChannelData: i => channels[i] }, .25, .75))
  assert.equal(wav.byteLength, 52)
  assert.equal(wav.getUint16(22, true), 2)
  assert.equal(wav.getUint32(24, true), 4)
  assert.equal(wav.getUint32(40, true), 8)
  assert.deepEqual([44, 46, 48, 50].map(i => wav.getInt16(i, true)), [16383, -16383, 32767, -32767])
})

test('stem WAV encoding caps rate and channels to the server upload contract', () => {
  const wav = new DataView(encodeClip({ sampleRate: 96000, numberOfChannels: 4, getChannelData: () => new Float32Array(960) }, 0, .01))
  assert.equal(wav.getUint32(24, true), 48000)
  assert.equal(wav.getUint16(22, true), 2)
  assert.equal(wav.byteLength, 44 + 480 * 2 * 2)
})
