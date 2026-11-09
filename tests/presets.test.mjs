import test from 'node:test'
import assert from 'node:assert/strict'
import { presets, presetGroups, presetSlots, presetBeatSlots } from '../dist/presets.js'
import { chordNotes, rootPitch, defaultProgression, presetLevel } from '../dist/music.js'
import { Progression } from '../dist/progression.js'

test('catalog groups follow the requested starting-degree order and every preset matches its group', () => {
  assert.deepEqual(presetGroups.slice(0, 7).map((group) => group.id), ['1', '6', '4', '2', '3', '5', '7'])
  assert.ok(presets.length >= 50)
  assert.equal(new Set(presets.map((preset) => preset.id)).size, presets.length)
  for (const group of presetGroups) {
    assert.ok(presets.some((preset) => preset.group === group.id), group.id)
  }
  for (const preset of presets) {
    const group = presetGroups.find((group) => group.id === preset.group)
    assert.ok(group, preset.id)
    assert.equal(rootPitch(preset.pattern[0]), group.pitch, preset.id)
    assert.ok(preset.family && preset.name && preset.description)
    assert.ok([1, 2, 4, 8].includes(preset.pattern.length), preset.id)
    assert.ok(Object.isFrozen(preset.pattern))
    const positions = new Set()
    for (const change of preset.changes) {
      assert.ok(Number.isInteger(change.bar) && change.bar >= 0 && change.bar < preset.pattern.length)
      assert.ok(Number.isInteger(change.beat) && change.beat >= 1 && change.beat <= 3)
      const position = `${change.bar}:${change.beat}`
      assert.ok(!positions.has(position))
      positions.add(position)
    }
  }
})

test('all catalog chords are playable in every key, including intra-bar changes', () => {
  for (const preset of presets) {
    const ids = [...presetSlots(preset.id), ...presetBeatSlots(preset.id).flat().filter(Boolean)]
    for (let key = 0; key < 12; key++) {
      for (const id of ids) {
        const pitches = chordNotes(id, key)
        assert.ok(pitches.length >= 3, `${preset.id}: ${id}`)
        assert.ok(pitches.every((pitch) => Number.isInteger(pitch) && pitch >= 0 && pitch <= 127))
      }
    }
  }
  assert.deepEqual(presetSlots('royal'), [...defaultProgression])
  for (const id of ['pop', 'sensitive', 'classic', 'jazz']) assert.equal(presetSlots(id).length, 8)
})

test('phrase repeats preserve harmonic rhythm and do not share editable state', () => {
  const slots = presetSlots('marusa-turnaround')
  const beats = presetBeatSlots('marusa-turnaround')
  assert.equal(beats[3][2], 'x:0:maj:7:0')
  assert.equal(beats[7][2], 'x:0:maj:7:0')
  assert.equal(beats[3][0], null)
  assert.notEqual(beats[3], beats[7])
  beats[3][2] = null
  slots[0] = 'C'
  assert.equal(beats[7][2], 'x:0:maj:7:0')
  assert.equal(presetBeatSlots('marusa-turnaround')[3][2], 'x:0:maj:7:0')
  assert.equal(presetSlots('marusa-turnaround')[0], 'FM7')
  assert.equal(presetBeatSlots('royal').flat().filter(Boolean).length, 0)
  assert.equal(presetSlots('six-pedal').every((id) => id === 'Am7'), true)
  assert.notDeepEqual(presetSlots('two-circle-eight').slice(0, 4), presetSlots('two-circle-eight').slice(4))
  assert.throws(() => presetBeatSlots('missing'), RangeError)
})

test('marusa turnaround schedules its fifth-to-first motion halfway through bars 4 and 8', async () => {
  const calls = []
  const instrument = {
    context: { currentTime: 0, state: 'running' },
    ready: async () => {},
    playAt: (...args) => calls.push(args),
    silence: () => {},
  }
  const player = new Progression(instrument, () => {}, () => {})
  player.slots = presetSlots('marusa-turnaround')
  player.beatSlots = presetBeatSlots('marusa-turnaround')
  player.bpm = 120
  for (const bar of [3, 7]) {
    calls.length = 0
    await player.start(bar)
    assert.equal(calls.length, 2)
    assert.deepEqual(calls[0][0], chordNotes('x:4:min:7:0', 0))
    assert.deepEqual(calls[1][0], chordNotes('x:0:maj:7:0', 0))
    assert.equal(calls[1][1] - calls[0][1], 1)
    player.stop()
  }
})

test('new variations cover third- and fourth-beat changes across common starting degrees', () => {
  const variations = presets.filter(preset => preset.changes.some(change => change.beat === 2 || change.beat === 3))
  assert.ok(variations.length >= 12)
  for (const group of ['4', '2', '1', '6', '3', '7'])
    assert.ok(variations.some(preset => preset.group === group), group)
  assert.ok(variations.some(preset => preset.changes.some(change => change.beat === 2)))
  assert.ok(variations.some(preset => preset.changes.some(change => change.beat === 3)))
  assert.ok(variations.some(preset => preset.changes.some(change => change.beat === 2) && preset.changes.some(change => change.beat === 3)))
  assert.deepEqual(presetBeatSlots('royal-turn')[3], [null, null, 'Dm7', 'G7'])
  assert.deepEqual(presetBeatSlots('royal-turn')[7], [null, null, 'Dm7', 'G7'])
})

test('game progressions retain the intended minor rise and passing changes', () => {
  assert.deepEqual(presetSlots('game-danmaku-lift').slice(0, 4), ['FM7', 'G', 'Am7', 'Am7'])
  assert.equal(presetBeatSlots('game-danmaku-lift')[1][3], 'x:2:maj:7:0')
  assert.deepEqual(presetSlots('game-indie-battle').slice(0, 4), ['Am7', 'G', 'FM7', 'x:2:maj:7:0'])
  assert.equal(presetBeatSlots('game-indie-battle')[2][3], 'Bm7b5')
  assert.equal(presetBeatSlots('game-indie-memory')[1][2], 'x:3:min:6:0')
})

test('fourth-beat passing chord switches chord and bass together', async () => {
  const chordCalls = [], bassCalls = []
  const instrument = {
    context: { currentTime: 0, state: 'running' },
    ready: async () => {}, silence() {}, playAt: (...args) => chordCalls.push(args),
  }
  const bass = { playAt: (...args) => bassCalls.push(args), silence() {} }
  const player = new Progression(instrument, () => {}, assert.fail, undefined, bass)
  player.slots = presetSlots('royal-passing')
  player.beatSlots = presetBeatSlots('royal-passing')
  player.bassPattern = 'straight4'
  await player.start()
  clearInterval(player.timer)
  const changeTime = 0.05 + 3 * 0.6
  assert.ok(chordCalls.some(call => Math.abs(call[1] - changeTime) < 1e-9 && call[0][0] % 12 === 6))
  assert.ok(bassCalls.some(call => Math.abs(call[1] - changeTime) < 1e-9 && call[0] % 12 === 6))
  player.stop()
})

test('eight-bar developments retain their distinct second half and late changes', () => {
  const ids = ['eight-royal-return', 'eight-456-marusa', 'eight-four-minor', 'eight-two-lift', 'eight-two-marusa', 'eight-pop-bridge', 'eight-one-borrowed', 'eight-komuro-rise', 'eight-minor-game', 'eight-minor-memory', 'eight-three-cycle', 'eight-sharp-four', 'eight-seven-minor', 'eight-five-pop']
  for (const id of ids) {
    const preset = presets.find(item => item.id === id)
    assert.equal(preset.pattern.length, 8, id)
    assert.notDeepEqual(presetSlots(id).slice(0, 4), presetSlots(id).slice(4), id)
    const beats = presetBeatSlots(id)
    for (const change of preset.changes) assert.equal(beats[change.bar][change.beat], change.chord, id)
  }
  const beats = presetBeatSlots('eight-royal-return')
  assert.equal(beats[3][2], null)
  assert.equal(beats[7][2], 'x:4:min:7:0')
  assert.equal(beats[7][3], 'x:0:maj:7:0')
})

test('reworked presets preserve their opening and develop the second half', () => {
  for (const [id, opening] of [
    ['marusa', ['FM7', 'x:2:maj:7:0', 'Am7', 'x:0:maj:7:0']],
    ['game-indie-battle', ['Am7', 'G', 'FM7', 'x:2:maj:7:0']],
    ['two-royal', ['Dm7', 'G', 'Em7', 'Am7']],
  ]) {
    const slots = presetSlots(id)
    assert.deepEqual(slots.slice(0, 4), opening, id)
    assert.notDeepEqual(slots.slice(4), opening, id)
  }
  assert.equal(presetBeatSlots('game-indie-battle')[2][3], 'Bm7b5')
  assert.equal(presetBeatSlots('game-indie-battle')[6][3], null)
  assert.ok(presets.filter(preset => preset.pattern.length === 8).length >= 50)
})


test('newmusic and magical pop retain pivot dominants and independent tonal excursions', () => {
  const prism = presets.find(preset => preset.id === 'magic-prism')
  assert.deepEqual(prism.modulation, [0, 3, 0, 0])
  // Bb7 in C leads to Eb, then local A7 in Eb becomes C7 and leads back to F.
  assert.equal(rootPitch(presetBeatSlots(prism.id)[1][3]), 10)
  assert.equal((rootPitch(presetBeatSlots(prism.id)[3][3]) + prism.modulation[1]) % 12, 0)
  const horizon = presets.find(preset => preset.id === 'clear-horizon')
  assert.deepEqual(horizon.modulation, [0, 0, 2, 0])
  assert.equal(rootPitch(presetBeatSlots(horizon.id)[3][3]), 9)
  for (const id of ['parade-trance', 'parade-shadow', 'magic-satin', 'magic-prism', 'newmusic-coast', 'newmusic-rain', 'clear-horizon', 'clear-letter']) {
    assert.equal(presetSlots(id).length, 8)
    assert.ok(presetBeatSlots(id).flat().some(Boolean))
  }
})

test('preset levels distinguish diatonic pitches, chromatic chords, and modulation', () => {
  const pattern = ['FM7', 'G7', 'Em7', 'Am7', 'x:0:maj:maj9:0']
  assert.equal(presetLevel({pattern, changes: [{chord: 'Dm7'}, {chord: 'C'}]}), 1)
  for (const chord of ['x:3:dim:7:1', 'x:5:maj:maj7:11', 'x:2:maj:7:0']) {
    assert.equal(presetLevel({pattern, changes: [{chord}]}), 2)
  }
  assert.equal(presetLevel({pattern, changes: [], modulation: [0, 0, 2, 0]}), 3)
})

test('curated choices retain every starting degree and resolve legacy recipes', async () => {
  const {presetChoiceIds} = await import('../dist/presets.js')
  const {genres, styleChoiceIds} = await import('../dist/groove.js')
  assert.equal(new Set(presetChoiceIds).size, presetChoiceIds.length)
  assert.equal(new Set(styleChoiceIds).size, styleChoiceIds.length)
  for (const id of presetChoiceIds) assert.ok(presets.some(item => item.id === id), id)
  for (const id of styleChoiceIds) assert.ok(genres.some(item => item.id === id), id)
  for (const group of presetGroups) assert.ok(presets.some(item => item.group === group.id && presetChoiceIds.includes(item.id)), group.id)
  assert.ok(presetChoiceIds.length <= presets.length / 2)
  assert.ok(styleChoiceIds.length <= genres.length / 2)
  for (const item of presets) assert.equal(presetSlots(item.id).length, 8)
})
