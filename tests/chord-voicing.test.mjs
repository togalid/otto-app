import test from 'node:test'
import assert from 'node:assert/strict'
import { voicePhrase, chordNotes, padChordNotes } from '../dist/chord-voicing.js'
import { chordConfig, bassHarmonyNotes } from '../dist/chord-harmony.js'
import * as music from '../dist/music.js'

test('music entry point retains the shared harmony and voicing implementations', () => {
  for (const [name, implementation] of Object.entries({voicePhrase, chordNotes, padChordNotes, chordConfig, bassHarmonyNotes})) {
    assert.equal(music[name], implementation)
  }
})

test('loop voicing retains established register and does not mutate score cells', () => {
  // Characterized before separating the harmony model from voicing policy.
  const expected = {
    auto: [[41,60,64,69],[65,67,71,74],[52,62,67,71],[45,60,64,67]],
    open: [[41,60,69,76],[65,71,74,79],[52,62,71,79],[45,60,67,76]],
    closed: [[41,60,64,69],[65,67,71,74],[52,62,67,71],[45,60,64,67]],
  }
  for (const [voicing, notes] of Object.entries(expected)) {
    const cells = ['FM7','G7','Em7','Am7'].map(id => Object.freeze({id, key: 0, voicing}))
    assert.deepEqual(voicePhrase(cells), notes)
    assert.deepEqual(voicePhrase(cells), notes)
  }
  assert.deepEqual(voicePhrase([]), [])
})
