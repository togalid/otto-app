import test from 'node:test'
import assert from 'node:assert/strict'
import { notes, frequency } from '../dist/music.js'
import { Instrument } from '../dist/audio.js'
test('pads use unique keys and ascending pentatonic notes', () => {
  assert.equal(notes.length, 8)
  assert.equal(new Set(notes.map((n) => n.key)).size, 8)
  notes.forEach((note, index) => {
    assert.ok([0, 2, 4, 7, 9].includes(note.midi % 12))
    if (index) assert.ok(note.midi > notes[index - 1].midi)
  })
})
test('standard tuning and octave frequency', () => {
  assert.equal(frequency(69), 440)
  assert.equal(frequency(81), 880)
})
test('unsupported audio reports a recoverable error', async () => {
  const instrument = new Instrument()
  await assert.rejects(() => instrument.play(60), /対応していません/)
  instrument.silence()
})
test('volume stays within safe bounds', () => {
  const instrument = new Instrument()
  instrument.setVolume(5)
  assert.equal(instrument.volume, 1)
  instrument.setVolume(-1)
  assert.equal(instrument.volume, 0)
})
