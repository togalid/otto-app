import test from 'node:test'
import assert from 'node:assert/strict'
import { backingEvents, backingPatterns } from '../dist/backing.js'
import { timbres, getTimbre } from '../dist/timbres.js'
import { Instrument } from '../dist/audio.js'
import { Progression } from '../dist/progression.js'

test('all backings stay inside the bar and use only selected chord notes', () => {
  for (const notes of [[60], [48, 60, 64, 67], [48, 64, 67, 70, 73, 81]]) {
    for (const pattern of backingPatterns) {
      const events = backingEvents(notes, pattern.id)
      assert.ok(events.length)
      for (const event of events) {
        assert.ok(event.beat >= 0 && event.duration > 0)
        assert.ok(event.beat + event.duration <= 4)
        assert.ok(
          event.notes.length &&
            event.notes.every((note) => notes.includes(note)),
        )
      }
    }
  }
  assert.equal(backingEvents([48, 60, 64, 67], 'whole').length, 1)
  assert.equal(backingEvents([48, 60, 64, 67], 'eighths').length, 8)
  assert.ok(
    backingEvents([48, 60, 64, 67], 'arpeggio').every(
      (event) => event.notes.length === 1,
    ),
  )
  assert.ok(
    backingEvents([48, 60, 64, 67], 'strum').every(
      (event) => event.level > 0 && event.level <= 0.5,
    ),
  )
  assert.throws(() => backingEvents([60], 'unknown'), RangeError)
})
test('backings vary articulation and give the offbeats a softer touch', () => {
  for (const pattern of ['quarters', 'eighths', 'offbeat', 'arpeggio', 'bass-chord', 'strum']) {
    const events = backingEvents([48, 60, 64, 67], pattern)
    assert.ok(new Set(events.map(event => event.duration)).size > 1, pattern)
    assert.ok(new Set(events.map(event => event.level)).size > 1, pattern)
  }
  const eighths = backingEvents([48, 60, 64, 67], 'eighths')
  assert.ok(eighths[0].level > eighths[1].level)
  assert.ok(eighths[0].duration > eighths[1].duration)
})
test('backing offbeats follow swing and remain aligned with drum hits', async () => {
  const notes = [], hits = []
  const instrument = { context: { currentTime: 0, state: 'running' }, ready: async () => {}, silence() {}, playAt: (...args) => notes.push(args) }
  const drums = { hitAt: (...args) => hits.push(args), silence() {} }
  const player = new Progression(instrument, () => {}, assert.fail, drums)
  player.backing = 'eighths'
  player.swing = 100
  await player.start()
  clearInterval(player.timer)
  const offbeatTime = 0.05 + 0.6 * 2 / 3
  assert.ok(Math.abs(notes[1][1] - offbeatTime) < 1e-9)
  assert.ok(hits.some(hit => Math.abs(hit[1] - offbeatTime) < 1e-9))
  player.stop()
})
test('arpeggios share the drum clock and follow next-bar tempo changes', async () => {
  const notes = [],
    hits = []
  const instrument = {
    context: { currentTime: 0, state: 'running' },
    ready: async () => {},
    silence() {},
    playAt(...args) {
      notes.push(args)
    },
  }
  const drums = {
    hitAt(...args) {
      hits.push(args)
    },
    silence() {},
  }
  const player = new Progression(instrument, () => {}, assert.fail, drums)
  player.backing = 'arpeggio'
  await player.start()
  clearInterval(player.timer)
  assert.equal(notes.length, 6)
  assert.equal(notes[0][1], hits[0][1])
  const beats = [0, 0.5, 1, 2, 2.5, 3]
  notes.forEach((event, index) =>
    assert.ok(Math.abs(event[1] - (0.05 + beats[index] * 0.6)) < 1e-9),
  )
  player.bpm = 120
  instrument.context.currentTime = 2.45
  player.tick()
  notes
    .slice(6)
    .forEach((event, index) =>
      assert.ok(Math.abs(event[1] - (2.45 + beats[index] * 0.5)) < 1e-9),
    )
  player.stop()
  assert.equal(player.timer, undefined)
})
test('melody arpeggio uses its own instrument and manual mode schedules no melody', async () => {
  const chords = [], melody = []
  const context = { currentTime: 0, state: 'running' }
  const voice = events => ({ context, ready: async () => {}, silence() {}, playAt: (...args) => events.push(args) })
  const player = new Progression(voice(chords), () => {}, assert.fail)
  player.melody = voice(melody)
  player.melodyPattern = 'arpeggio'
  await player.start()
  clearInterval(player.timer)
  assert.equal(chords.length, 1)
  assert.equal(melody.length, 6)
  assert.ok(melody.every(event => event[0].length === 1))
  player.stop()
  melody.length = 0
  player.melodyPattern = ''
  await player.start()
  clearInterval(player.timer)
  assert.equal(melody.length, 0)
  player.stop()
})
test('thirteen timbres have distinct synthesis recipes and safe envelopes', () => {
  assert.equal(timbres.length, 13)
  assert.equal(new Set(timbres.map((t) => t.id)).size, 13)
  assert.equal(
    new Set(
      timbres.map((t) =>
        JSON.stringify([t.harmonics, t.cutoff, t.attack, t.decay, t.sustain]),
      ),
    ).size,
    13,
  )
  for (const timbre of timbres) {
    assert.ok(
      timbre.harmonics.length && timbre.harmonics.every((value) => value >= 0),
    )
    assert.ok(
      timbre.attack > 0 &&
        timbre.decay > 0 &&
        timbre.release > 0 &&
        timbre.sustain > 0 &&
        timbre.sustain <= 1,
    )
    assert.equal(getTimbre(timbre.id), timbre)
  }
  assert.throws(() => getTimbre('invalid'), RangeError)
})
test('Tone chord voices use a compact attack spread and stop without affecting other instruments', () => {
  const calls = []
  let synthOptions
  class FakeFilter {
    connect() {
      return this
    }
    dispose() {
      calls.push('filter-stop')
    }
  }
  class FakePoly {
    constructor(options) { synthOptions = options }
    connect() {
      return this
    }
    triggerAttackRelease(...args) {
      calls.push(args)
    }
    dispose() {
      calls.push('synth-stop')
    }
  }
  const tone = { Filter: FakeFilter, PolySynth: FakePoly, Synth: class {}, MonoSynth: class {}, FMSynth: class {} }
  const instrument = new Instrument()
  instrument.context = {
    currentTime: 0,
    destination: {}, createAnalyser: () => ({ connect() {} }),
    createGain: () => ({ gain: { value: 0 }, connect() {}, disconnect() {} }),
  }
  instrument.engine = { Tone: tone }
  instrument.playAt([60, 64, 67], 1, 2)
  assert.equal(synthOptions.maxPolyphony, 96)
  assert.ok(synthOptions.voice.prototype instanceof tone.MonoSynth)
  assert.ok(synthOptions.options.envelope.attack > 0)
  assert.equal(calls.length, 3)
  assert.ok(calls.every(([, duration, time]) => Math.abs(duration + time - 2.986) < 1e-9 && time >= 0.986 && time <= 1.014))
  instrument.silence()
  assert.deepEqual(calls.slice(3), ['synth-stop', 'filter-stop'])
})


test('trance weave turns through chord tones on sixteenths, satin leaves space for the vocal', () => {
  const notes = [60, 64, 67, 71]
  const weave = backingEvents(notes, 'trance-weave')
  assert.equal(weave.length, 16)
  assert.deepEqual(weave.slice(0, 7).map(event => event.notes[0]), [60, 64, 67, 71, 67, 64, 60])
  assert.equal(weave[15].beat, 3.75)
  assert.ok(weave.every(event => event.notes.length === 1 && event.duration <= 0.25))
  const satin = backingEvents(notes, 'satin-comp')
  assert.deepEqual(satin[0].notes, notes)
  assert.ok(satin.slice(1).every(event => !event.notes.includes(60)))
  assert.ok(satin.some(event => event.beat % 1 !== 0))
})
