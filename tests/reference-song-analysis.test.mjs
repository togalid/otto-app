import test from 'node:test'
import assert from 'node:assert/strict'
import {analyzeReferenceSong} from '../dist/reference-song-analysis.js'
import {chordNotes} from '../dist/music.js'

const rate = 6000, bpm = 120, barLength = rate * 2
function song(chords) {
  const samples = new Float32Array(chords.length * barLength)
  chords.forEach((pitches, bar) => {
    for (let i = 0; i < barLength; i++) {
      for (const midi of pitches) samples[bar * barLength + i] += .14 * Math.sin(2 * Math.PI * 440 * 2 ** ((midi - 69) / 12) * i / rate)
    }
  })
  return samples
}
const c = [60,64,67], f = [60,65,69], g = [59,62,67], a = [60,64,69]

test('repeated eight-bar material occupies one section and contrasting material becomes B', () => {
  const verse = [c,c,f,f,g,g,c,c], chorus = [a,a,f,f,c,c,g,g]
  const result = analyzeReferenceSong(song([...verse,...verse,...chorus,...chorus]),rate,bpm,0)
  assert.equal(result.sections.length, 2)
  assert.deepEqual(result.sections.map(section => section.startSeconds), [0,32])
  for (let index = 0; index < 8; index++) {
    const detected = new Set(chordNotes(result.sections[0].slots[index],0).map(note => note % 12))
    assert.deepEqual(detected, new Set(verse[index].map(note => note % 12)))
  }
  assert.equal(result.truncated, false)
  assert.ok(result.sections[0].performance)
})

test('recognizes source chords in the selected major-key coordinate system', () => {
  const result = analyzeReferenceSong(song(Array.from({length:8}, () => [62,66,69])),rate,bpm,2)
  assert.equal(result.sections.length, 1)
  assert.deepEqual(new Set(chordNotes(result.sections[0].slots[0],2).map(note => note % 12)), new Set([2,6,9]))
})

test('captures a mid-bar chord change without forcing a preset progression', () => {
  const samples = song(Array.from({length:8}, () => c))
  for (let bar = 0; bar < 8; bar++) for (let i = barLength / 2; i < barLength; i++) {
    samples[bar * barLength + i] = g.reduce((sum, midi) => sum + .14 * Math.sin(2 * Math.PI * 440 * 2 ** ((midi-69)/12) * i/rate),0)
  }
  const result = analyzeReferenceSong(samples,rate,bpm,0)
  assert.ok(result.sections[0].beatSlots.every(row => row[2] && row[2] !== row[0]))
})

test('silence, short audio and invalid timing never manufacture four sections', () => {
  assert.deepEqual(analyzeReferenceSong(new Float32Array(barLength*16),rate,bpm,0).sections, [])
  assert.deepEqual(analyzeReferenceSong(song([c,c]),rate,bpm,0).sections, [])
  assert.throws(() => analyzeReferenceSong(new Float32Array(),rate,0,0),RangeError)
})

test('skips silent windows but retains source offsets', () => {
  const result = analyzeReferenceSong(song([...Array.from({length:8}, () => []),...Array.from({length:8}, () => c)]),rate,bpm,0)
  assert.equal(result.sections.length,1)
  assert.equal(result.sections[0].startSeconds,16)
})
