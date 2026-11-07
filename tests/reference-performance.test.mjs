import test from 'node:test'
import assert from 'node:assert/strict'
import {analyzeReferencePerformance} from '../dist/reference-performance.js'

const rate = 8000, bpm = 120
function bassTone(midi, seconds = 2) {
  return Float32Array.from({length:rate * seconds}, (_, i) => .3 * Math.sin(2 * Math.PI * 440 * 2 ** ((midi - 69) / 12) * i / rate))
}

test('silence yields no invented notes or drum pattern and parameters are validated', () => {
  assert.deepEqual(analyzeReferencePerformance(new Float32Array(rate * 16), rate, bpm, 0), {key:0,drums:[],bass:[]})
  assert.throws(() => analyzeReferencePerformance(new Float32Array(0), 0, bpm, 0), RangeError)
})

test('stable bass pitch and duration survive extraction without a preset', () => {
  const result = analyzeReferencePerformance(bassTone(40), rate, bpm, 3)
  assert.equal(result.key, 3)
  assert.ok(result.bass.length > 0)
  assert.ok(result.bass.every(note => note.midi === 40))
  assert.ok(result.bass[0].duration >= 3)
  assert.ok(result.drums.every(hit => hit.sound !== 'kick'))
})

test('separated bass input follows changed pitch and never overlaps notes', () => {
  const bass = new Float32Array(rate * 4)
  bass.set(bassTone(40)); bass.set(bassTone(43), rate * 2)
  const result = analyzeReferencePerformance(new Float32Array(rate * 4), rate, bpm, 0, {bass})
  assert.ok(result.bass.some(note => note.midi === 40))
  assert.ok(result.bass.some(note => note.midi === 43))
  assert.ok(result.bass.every((note, i) => i === 0 || result.bass[i - 1].beat + result.bass[i - 1].duration <= note.beat))
})

test('percussive low-band attacks retain irregular source timing on sixteenth grid', () => {
  const audio = new Float32Array(rate * 16)
  const beats = [0, 0.5, 2, 3.25, 7]
  for (const beat of beats) {
    const offset = Math.round(beat * .5 * rate)
    for (let i = 0; i < rate * .15; i++) audio[offset + i] += Math.sin(2 * Math.PI * 65 * i / rate) * Math.exp(-i / rate * 35)
  }
  const hits = analyzeReferencePerformance(audio, rate, bpm, 0).drums.filter(hit => hit.sound === 'kick')
  assert.deepEqual(hits.map(hit => hit.beat), beats)
  assert.ok(hits.every(hit => hit.velocity > 0 && hit.velocity <= 1))
})
