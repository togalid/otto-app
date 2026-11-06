import test from 'node:test'
import assert from 'node:assert/strict'
import { ornamentParts, ornamentPatterns, ornamentEvents } from '../dist/ornaments.js'
import { chordNotes } from '../dist/music.js'
import { getTimbre } from '../dist/timbres.js'
const harmony = () => [48, 60, 64, 67]

test('four independent ornament parts have compatible timbres and an explicit off choice', () => {
  assert.deepEqual(ornamentParts.map(part => part.id), ['bell', 'pluck', 'phrase', 'fx'])
  for (const part of ornamentParts) {
    assert.ok(ornamentPatterns.some(pattern => pattern.part === part.id && pattern.id === 'off'))
    assert.deepEqual(ornamentEvents(part.id, 'off', 0, harmony), [])
    if (part.id !== 'fx') for (const timbre of part.timbres) assert.equal(getTimbre(timbre.id).id, timbre.id)
  }
  assert.throws(() => ornamentEvents('missing', 'off', 0, harmony), RangeError)
  assert.throws(() => ornamentEvents('bell', 'piano-wide', 0, harmony), RangeError)
  assert.throws(() => ornamentEvents('bell', 'bell-answer', -1, harmony), RangeError)
  assert.throws(() => ornamentEvents('bell', 'bell-answer', 0, harmony, 0), RangeError)
})

test('bell and strings occupy their authored phrase positions across repeated loops', () => {
  for (let bar = 0; bar < 16; bar++) {
    assert.equal(ornamentEvents('bell', 'sparkle-even', bar, harmony).length > 0, bar % 2 === 1)
    for (const [part, pattern] of [['bell', 'sparkle-four'], ['phrase', 'strings-lift']])
      assert.equal(ornamentEvents(part, pattern, bar, harmony).length > 0, bar % 4 === 3)
  }
})

test('crash and reverse have bounded envelopes at the correct transitions, including loop return', () => {
  for (let bar = 0; bar < 16; bar++) {
    const events = ornamentEvents('fx', 'transition', bar, harmony)
    assert.equal(events.some(event => event.sound === 'crash'), bar % 8 === 0)
    assert.equal(events.some(event => event.sound === 'reverse'), bar % 4 === 3)
    for (const event of events) {
      assert.deepEqual(event.notes, [])
      assert.ok(event.beat >= 0 && event.beat + event.duration <= 4)
      if (event.sound === 'reverse') assert.equal(event.beat + event.duration, 4)
    }
  }
})

test('all pitched gestures stay on current chord pitch classes across keys and intra-bar changes', () => {
  for (let key = 0; key < 12; key++) {
    const first = chordNotes('FM7', key), second = chordNotes('x:2:maj:b9_b13:0', key)
    const atBeat = beat => beat < 2 ? first : second
    for (const pattern of ornamentPatterns.filter(pattern => pattern.part !== 'fx')) {
      for (const bar of [0, 1, 3, 7]) {
        for (const event of ornamentEvents(pattern.part, pattern.id, bar, atBeat, 180)) {
          assert.ok(event.beat >= 0 && event.beat < 4)
          assert.ok(event.duration > 0 && event.beat + event.duration <= 4)
          assert.ok(event.notes.length > 0)
          assert.ok(event.notes.every(note => note >= 48 && note <= 95 && Number.isInteger(note)))
          assert.ok(event.notes.every((note,i) => atBeat(event.beat).some(chord => chord % 12 === note % 12) || (pattern.id.startsWith('strings-') && i === 1 && note - event.notes[0] === 5 && !atBeat(event.beat).some(chord => (note - chord + 120) % 12 === 1))))
          assert.ok(event.level > 0 && event.level <= 1)
        }
      }
    }
  }
})

test('a ringing pitched ornament is clipped when a subsequent chord no longer supports its pitch', () => {
  const events = ornamentEvents('bell', 'sparkle-even', 1, beat => beat < 2.25 ? [60] : [61])
  const first = events[0]
  assert.equal(first.beat, 2)
  assert.equal(first.duration, .25)
  assert.ok(events.slice(1).every(event => event.notes[0] % 12 === 1))
})

test('rush and wide arpeggio articulate sixteen distinct steps while sparse plucks leave room', () => {
  const rush = ornamentEvents('phrase', 'synth-rush', 0, harmony, 180)
  const wide = ornamentEvents('phrase', 'piano-wide', 0, harmony, 180)
  assert.equal(rush.length, 16)
  assert.equal(wide.length, 16)
  assert.equal(new Set(rush.map(event => event.beat)).size, 16)
  assert.ok(new Set(rush.map(event => event.level)).size >= 3)
  assert.ok(Math.max(...wide.flatMap(event => event.notes)) - Math.min(...wide.flatMap(event => event.notes)) >= 24)
  assert.ok(ornamentEvents('pluck', 'pluck-gaps', 0, harmony).length <= 3)
  for (const pattern of ornamentPatterns.filter(pattern => pattern.part !== 'fx'))
    assert.deepEqual(ornamentEvents(pattern.part, pattern.id, 3, () => []), [])
})

test('generation is deterministic and does not mutate supplied harmony or previous events', () => {
  const notes = [48, 60, 64, 67]
  const first = ornamentEvents('phrase', 'piano-wide', 3, () => notes)
  const second = ornamentEvents('phrase', 'piano-wide', 3, () => notes)
  assert.deepEqual(first, second)
  assert.deepEqual(notes, [48, 60, 64, 67])
  first[0].notes[0] = 1
  assert.notEqual(first[0].notes[0], second[0].notes[0])
})

test('layered plucks add close chord tones with distinct rhythmic patterns', () => {
  const ids = ['pluck-thirds','pluck-chords','pluck-trance','pluck-trance-drive']
  for (const id of ids) {
    const events = ornamentEvents('pluck',id,0,harmony)
    assert.ok(events.length >= 4)
    assert.ok(events.every(event => event.notes.length >= 2))
    assert.ok(events.every(event => Math.max(...event.notes)-Math.min(...event.notes) < 12))
    if (id === 'pluck-thirds') assert.ok(events.every(event => [3,4].includes(event.notes[1]-event.notes[0])))
  }
  assert.ok(ornamentEvents('pluck','pluck-trance-drive',0,harmony).length > ornamentEvents('pluck','pluck-trance',0,harmony).length)
  const changed = beat => beat < 1.5 ? [60,64,67] : [61,65,68]
  for (const id of ids) for (const event of ornamentEvents('pluck',id,0,changed)) {
    assert.ok(event.notes.every(note => changed(event.beat).some(chord => chord % 12 === note % 12)))
    if (event.beat < 1.5) assert.ok(event.beat + event.duration <= 1.5)
  }
})


test('string runs combine quick articulated fourths and chord-aware accents', () => {
  for (const pattern of ['strings-lift','strings-fourths']) {
    const events = ornamentEvents('phrase',pattern,3,harmony)
    assert.ok(events.length >= 8)
    assert.ok(events.some(event => event.notes.length === 2 && event.notes[1]-event.notes[0] === 5))
    assert.ok(new Set(events.map(event => event.level)).size >= 3)
    assert.ok(events.every(event => event.duration <= .22 + 1e-9))
  }
})

test('four-note string cluster rises only in bars four and eight and follows chord changes', () => {
  for (let bar = 0; bar < 16; bar++) {
    const events = ornamentEvents('phrase','strings-cluster-rise',bar,harmony)
    assert.equal(events.length, bar % 4 === 3 ? 8 : 0)
    if (!events.length) continue
    assert.ok(events.every(event => event.notes.length === 4))
    assert.ok(events.every((event,i) => !i || event.notes[0] >= events[i-1].notes[0]))
    assert.ok(events.at(-1).level > events[0].level)
  }
  const harmonyChange = beat => beat < 3 ? [60,64,67,71] : [61,65,68,72]
  for (const event of ornamentEvents('phrase','strings-cluster-rise',3,harmonyChange))
    assert.ok(event.notes.every(note => harmonyChange(event.beat).some(chord => chord % 12 === note % 12)))
})

test('cluster variations rise or fall in bars four and eight with contrasting contours', () => {
  const names = ['strings-cluster-rise','strings-cluster-rise-wave','strings-cluster-fall','strings-cluster-fall-wave']
  const lines = names.map(id => ornamentEvents('phrase',id,3,harmony).map(event => event.notes[0]))
  assert.ok(lines[0].at(-1) > lines[0][0])
  assert.ok(lines[1].at(-1) > lines[1][0])
  assert.ok(lines[2].at(-1) < lines[2][0])
  assert.ok(lines[3].at(-1) < lines[3][0])
  assert.notDeepEqual(lines[0],lines[1])
  assert.notDeepEqual(lines[2],lines[3])
  for (const id of names) {
    assert.equal(ornamentEvents('phrase',id,2,harmony).length,0)
    assert.ok(ornamentEvents('phrase',id,7,harmony).every(event=>event.notes.length===4))
  }
})
