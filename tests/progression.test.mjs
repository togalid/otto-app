import test from 'node:test'
import assert from 'node:assert/strict'
import { chords, defaultProgression, barDuration, chordNotes, bassHarmonyNotes } from '../dist/music.js'
import { Progression } from '../dist/progression.js'

test('navigator reacts to the audible chord and actual key changes', async () => {
  const { navigatorReaction } = await import('../dist/music.js')
  assert.match(navigatorReaction('FM7', null, 0, 0), /いい感じ/)
  assert.match(navigatorReaction('Am7', 0, 0, 2), /切なく/)
  assert.match(navigatorReaction('x:0:maj:maj9:0', 0, 0, 0), /エモい/)
  assert.equal(navigatorReaction('FM7', 0, 1, 2), '転調した！！')
  assert.equal(navigatorReaction('FM7', 0, 1, 2, true), '転調した！！')
  assert.equal(navigatorReaction('FM7', 0, 0, 0, true), '一味違うね！')
  assert.equal(navigatorReaction('FM7', 0, 0, 1, true), 'おっ、素敵な選び方！')
  assert.equal(navigatorReaction('FM7', 0, 0, 0, true, 1), 'グッとくるね！')
  assert.doesNotMatch(navigatorReaction('FM7', null, 1, 2), /転調した/)
})

test('requested default and chord tones', () => {
  assert.deepEqual(defaultProgression, [
    'FM7',
    'G',
    'Em7',
    'Am7',
    'FM7',
    'G',
    'Em7',
    'Am7',
  ])
  assert.deepEqual(
    chords.FM7.map((n) => n % 12).sort((a, b) => a - b),
    [0, 4, 5, 9],
  )
  assert.deepEqual(
    chords.Em7.map((n) => n % 12).sort((a, b) => a - b),
    [2, 4, 7, 11],
  )
  assert.deepEqual(
    chords.G.map((n) => n % 12).sort((a, b) => a - b),
    [2, 7, 7, 11],
  )
  assert.deepEqual(
    chords.Am7.map((n) => n % 12).sort((a, b) => a - b),
    [0, 4, 7, 9],
  )
  assert.equal(barDuration(100), 2.4)
  assert.throws(() => barDuration(0), RangeError)
})

test('the default 4–5–3 voicing moves smoothly between chord tones', () => {
  const [four, five, three] = [chords.FM7, chords.G, chords.Em7]
  for (let i = 0; i < four.length; i++) {
    assert.ok(Math.abs(four[i] - five[i]) <= 3)
    assert.ok(Math.abs(five[i] - three[i]) <= 3)
  }
  assert.deepEqual(five.slice(1), three.slice(1))
})
function fixture() {
  const calls = [],
    steps = []
  const instrument = {
    context: { currentTime: 0, state: 'running' },
    ready: async () => {},
    silence() {},
    playAt(...args) {
      calls.push(args)
    },
  }
  const player = new Progression(
    instrument,
    (index) => steps.push(index),
    (message) => assert.fail(message),
  )
  return { player, instrument, calls, steps }
}
test('audio scheduling loops eight slots and follows edits and tempo', async () => {
  const { player, instrument, calls, steps } = fixture()
  await player.start()
  clearInterval(player.timer)
  for (let i = 0; i < 9; i++) {
    instrument.context.currentTime = 0.05 + i * 2.4
    player.tick()
  }
  assert.equal(calls.length, 9)
  assert.deepEqual(calls[0][0], chordNotes('FM7', 0))
  assert.deepEqual(calls[8][0], chordNotes('FM7', 0))
  assert.ok(steps.includes(7))
  player.slots[1] = 'C'
  player.bpm = 120
  instrument.context.currentTime = 0.05 + 9 * 2.4
  player.tick()
  assert.deepEqual(calls[9][0], chordNotes('C', 0))
  assert.equal(calls[9][2], 2 * 0.92)
  player.stop()
  assert.equal(player.running, false)
  assert.equal(player.timer, undefined)
  assert.equal(steps.at(-1), -1)
})
test('stop while audio is unlocking prevents late playback', async () => {
  const { player, instrument, calls } = fixture()
  let unlock
  instrument.ready = () =>
    new Promise((resolve) => {
      unlock = resolve
    })
  const start = player.start()
  player.stop()
  unlock()
  await start
  assert.equal(calls.length, 0)
  assert.equal(player.timer, undefined)
})

test('degree labels stay stable while chord names and pitches transpose in all keys', async () => {
  const { chordChoices, keys, chordLabel, chordNotes } =
    await import('../dist/music.js')
  assert.deepEqual(
    chordChoices.slice(0, 7).map((c) => c.degree),
    ['1△7', '2m7', '3m7', '4△7', '57', '6m7', '7m7♭5'],
  )
  for (let key = 0; key < keys.length; key++) {
    for (const chord of chordChoices) {
      assert.equal(chordLabel(chord.id, key, true), chord.degree)
      assert.deepEqual(
        [...new Set(chordNotes(chord.id, key).map(note => note % 12))].sort((a, b) => a - b),
        [...new Set(chords[chord.id].map(note => (note + key) % 12))].sort((a, b) => a - b),
      )
    }
  }
  assert.equal(chordLabel('FM7', 2, false), 'G△7')
  assert.equal(chordLabel('Em7', 1, false), 'Fm7')
  assert.equal(chordLabel('Bm7b5', 6, false), 'E♯m7♭5')
})
test('scheduler transposes the selected degree in the chosen key', async () => {
  const { player, calls } = fixture()
  player.key = 2
  await player.start()
  player.stop()
  assert.deepEqual(
    calls[0][0],
    chordNotes('FM7', 2),
  )
})

test('two-bar modulations independently transpose chords, bass and playback notifications', async () => {
  const { chordNotes } = await import('../dist/music.js')
  const { player, instrument, calls } = fixture()
  const bassCalls = []
  const steps = []
  player.bass = { playAt: (...args) => bassCalls.push(args), silence() {} }
  player.onStep = (index, chord, key) => steps.push([index, chord, key])
  player.key = 4
  player.modulation = [0, 1, -3, 0]
  player.slots.fill('C')
  player.beatSlots[2][3] = 'G'
  await player.start()
  clearInterval(player.timer)
  for (let bar = 0; bar < 8; bar++) {
    instrument.context.currentTime = 0.05 + bar * 2.4
    player.tick()
  }
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7].map((bar) => player.keyForBar(bar)), [4, 4, 5, 5, 1, 1, 4, 4])
  for (const [call, chord, key] of [[2, 'C', 5], [3, 'G', 5], [5, 'C', 1]]) {
    assert.deepEqual(new Set(calls[call][0].map(note => note % 12)), new Set(chordNotes(chord, key).map(note => note % 12)))
  }
  assert.equal(bassCalls[16][0] % 12, chordNotes('C', 5)[0] % 12)
  assert.ok(steps.some(([index, , key]) => index === 3 && key === 5))
  assert.ok(steps.some(([index, , key]) => index === 4 && key === 1))
  player.key = 11
  assert.equal(player.keyForBar(2), 0)
  player.key = 6
  assert.equal(player.keyForBar(2), 7)
  assert.deepEqual(new Set(player.notesForBar('C', 2).map(note => note % 12)), new Set(chordNotes('C', 7).map(note => note % 12)))
  player.stop()
})

test('key and modulation edits while playing affect the next scheduled bars without stopping', async () => {
  const { chordNotes } = await import('../dist/music.js')
  const { player, instrument, calls } = fixture()
  const bassCalls = []
  const steps = []
  player.bass = { playAt: (...args) => bassCalls.push(args), silence() {} }
  player.onStep = (index, chord, key) => steps.push([index, chord, key])
  player.slots.fill('C')
  await player.start()
  clearInterval(player.timer)
  player.key = 2
  player.modulation[1] = 1
  assert.equal(player.running, true)
  instrument.context.currentTime = 2.45
  player.tick()
  assert.deepEqual(calls[1][0], chordNotes('C', 2))
  instrument.context.currentTime = 4.85
  player.tick()
  assert.deepEqual(calls[2][0], chordNotes('C', 2).map((note) => note + 1))
  assert.ok(bassCalls.some(([note]) => note % 12 === 3))
  assert.ok(steps.some(([index, , key]) => index === 2 && key === 3))
  assert.equal(player.running, true)
  player.stop()
})

test('root and chord edits during playback are used when the edited bar is scheduled', async () => {
  const { chordNotes } = await import('../dist/music.js')
  const { player, instrument, calls } = fixture()
  const bassCalls = []
  let drumHits = 0
  player.bass = { playAt: (...args) => bassCalls.push(args), silence() {} }
  player.drums = { hitAt: () => drumHits++, silence() {} }
  await player.start()
  clearInterval(player.timer)
  player.slots[1] = 'G'
  player.beatSlots[1][3] = 'CM7'
  const previousHits = drumHits
  instrument.context.currentTime = 2.45
  player.tick()
  assert.equal(player.running, true)
  assert.deepEqual(calls[1][0], chordNotes('G', 0))
  assert.deepEqual(calls[2][0], chordNotes('CM7', 0))
  assert.ok(drumHits > previousHits)
  assert.ok(bassCalls.some(([note]) => note % 12 === 7))
  player.stop()
})

test('support bass follows chord changes even during a long-note pattern', async () => {
  const { player } = fixture()
  const bassCalls = []
  player.bass = { playAt: (...args) => bassCalls.push(args), silence() {} }
  player.bassPattern = 'support_hold'
  player.slots[0] = 'C'
  player.beatSlots[0][3] = 'G'
  await player.start()
  clearInterval(player.timer)
  assert.deepEqual(bassCalls.map(call => call[0] % 12), [0, 7, 7])
  assert.ok(Math.abs(bassCalls[1][1] - 1.55) < 1e-9)
  assert.ok(bassCalls[1][3] < bassCalls[0][3])
  assert.ok(Math.abs(bassCalls[2][1] - 1.85) < 1e-9)
  player.stop()
})

test('melodic bass resumes at an intra-bar chord change and does not sustain across it', async () => {
  const { player } = fixture()
  const calls = []
  player.bass = { playAt: (...args) => calls.push(args), silence() {} }
  player.bassPattern = 'line_sing'
  player.slots[0] = 'C'
  player.beatSlots[0][1] = 'G'
  await player.start()
  clearInterval(player.timer)
  const changeTime = 0.65
  assert.ok(calls.some(call => Math.abs(call[1] - changeTime) < 1e-9 && call[0] % 12 === 7))
  assert.ok(calls.filter(call => call[1] < changeTime).every(call => call[1] + call[2] <= changeTime + 1e-9))
  player.stop()
})

test('selected bass tones alternate with root and restart at a chord change', async () => {
  const { player } = fixture()
  const calls = []
  player.bass = { playAt: (...args) => calls.push(args), silence() {} }
  player.bassPattern = 'straight4'
  player.bassTones = ['octave']
  player.slots[0] = 'C'
  player.beatSlots[0][2] = 'G'
  await player.start()
  clearInterval(player.timer)
  assert.deepEqual(calls.map(call => call[0]), [36, 48, 43, 55])
  player.stop()
})

test('each chord position plays its chord in the selected key', async () => {
  const { player, calls } = fixture()
  const bassCalls = []
  player.bass = { playAt: (...args) => bassCalls.push(args), silence() {} }
  player.slots[0] = 'CM7'
  player.beatSlots[0][3] = 'G'
  player.modulation[0] = 1
  await player.start()
  clearInterval(player.timer)
  assert.deepEqual(calls[0][0], chordNotes('CM7', 1))
  assert.deepEqual(calls[1][0], chordNotes('G', 1))
  assert.equal(bassCalls[0][0] % 12, 1)
  assert.equal(bassCalls.at(-1)[0] % 12, 8)
  player.clearBeatSlots()
  assert.deepEqual(player.beatSlots[0], [null, null, null, null])
  player.stop()
})

test('presets fill eight playable slots without shared mutable state', async () => {
  const { presets, presetSlots, chordNotes } = await import('../dist/music.js')
  assert.deepEqual(presetSlots('royal'), [...defaultProgression])
  for (const preset of presets) {
    const slots = presetSlots(preset.id)
    assert.equal(slots.length, 8)
    assert.deepEqual(slots, Array.from({ length: 8 }, (_, bar) => preset.pattern[bar % preset.pattern.length]))
    assert.ok(slots.every((id) => chordNotes(id, 0).length >= 3))
    slots[0] = 'changed'
    assert.notEqual(presetSlots(preset.id)[0], 'changed')
  }
  assert.throws(() => presetSlots('missing'), RangeError)
})

test('melody follows the key or the actual chord across all twelve keys', async () => {
  const { melodyNotes, chordNotes } = await import('../dist/music.js')
  for (let key = 0; key < 12; key++) {
    for (const chord of Object.keys(chords)) {
      const allowed = chordNotes(chord, key).map((note) => note % 12)
      const melody = melodyNotes(key, chord, 'chord')
      assert.equal(melody.length, 8)
      assert.ok(melody.every((note) => note.label && (note.category === 'chord') === allowed.includes(note.midi % 12)))
      assert.ok(
        melody.every(
          (note, index) => !index || note.midi >= melody[index - 1].midi,
        ),
      )
    }
    const melody = melodyNotes(key, 'FM7', 'key')
    assert.ok(
      melody.every((note) =>
        [0, 2, 4, 5, 7, 9, 11].includes((note.midi - key + 12) % 12),
      ),
    )
    assert.ok(
      melody.every(
        (note, index) => !index || note.midi > melody[index - 1].midi,
      ),
    )
  }
})

test('chord melody pads follow root, tensions and chord quality', async () => {
  const { melodyNotes, customChord } = await import('../dist/music.js')
  const major = melodyNotes(0, 'CM7', 'chord')
  assert.deepEqual(major.map((note) => note.midi), [60, 62, 64, 65, 67, 69, 71, 72])
  assert.deepEqual(major.map((note) => note.degree), ['R', '9', '3', '11', '5', '13', '7', 'R'])
  assert.deepEqual(major.map((note) => note.category), ['chord', 'scale', 'chord', 'scale', 'chord', 'scale', 'chord', 'chord'])
  const minor = melodyNotes(0, 'Dm7', 'chord')
  assert.deepEqual(minor.map((note) => note.midi), [62, 64, 65, 67, 69, 71, 72, 74])
  assert.equal(minor[2].degree, '♭3')
  assert.equal(minor[6].degree, '♭7')
  assert.deepEqual(melodyNotes(0, 'FM7', 'chord').map((note) => note.category), ['chord', 'scale', 'chord', 'outside', 'chord', 'scale', 'chord', 'chord'])
  const altered = customChord({ root: 4, quality: 'maj', extension: 'b9_b13', alter: 0 })
  const notes = melodyNotes(0, altered, 'chord')
  assert.equal(notes[1].midi - notes[0].midi, 1)
  assert.equal(notes[5].midi - notes[0].midi, 8)
  assert.equal(notes[1].category, 'chord')
  assert.equal(notes[5].category, 'chord')
  assert.equal(notes[1].degree, '♭9')
  assert.equal(notes[5].degree, '♭13')
  assert.deepEqual(melodyNotes(0, 'CM7', 'key').map((note) => note.degree), ['R', '2', '3', '4', '5', '6', '7', 'R'])
})

test('numeric degree and quality are separate; royal preset is 4–5–3–6', async () => {
  const { chordParts, presetSlots } = await import('../dist/music.js')
  assert.deepEqual(chordParts('FM7', 0, true), { main: '4', suffix: '△7' })
  assert.deepEqual(chordParts('Em7', 0, true), { main: '3', suffix: 'm7' })
  assert.deepEqual(presetSlots('royal'), [
    'FM7',
    'G',
    'Em7',
    'Am7',
    'FM7',
    'G',
    'Em7',
    'Am7',
  ])
})
test('flavors and tritone dominants generate matching intervals in all keys', async () => {
  const { customChord, chordNotes, chordParts } =
    await import('../dist/music.js')
  const minor9 = customChord({
    root: 3,
    quality: 'min',
    extension: '9',
    alter: 0,
  })
  assert.deepEqual(chordParts(minor9, 0, true), { main: '4', suffix: 'm9' })
  for (let key = 0; key < 12; key++) {
    const notes = bassHarmonyNotes(minor9, key)
    assert.deepEqual(
      notes.map((n) => (n - notes[0]) % 12).sort((a, b) => a - b),
      [0, 2, 3, 7, 10],
    )
  }
  const substitute = customChord({
    root: 4,
    quality: 'maj',
    extension: '7',
    alter: 6,
  })
  assert.deepEqual(chordParts(substitute, 0, true), { main: '♭2', suffix: '7' })
  assert.deepEqual(chordParts(substitute, 0, false), {
    main: 'D♭',
    suffix: '7',
  })
  assert.throws(
    () => customChord({ root: 9, quality: 'maj', extension: '7', alter: 0 }),
    RangeError,
  )
})

test('three notations preserve pitch and separate quality', async () => {
  const { displayChordParts, changeRoot, rootPitch } =
    await import('../dist/music.js')
  assert.deepEqual(displayChordParts('FM7', 0, 'number'), {
    main: '4',
    suffix: '△7',
  })
  assert.deepEqual(displayChordParts('FM7', 0, 'roman'), {
    main: 'IV',
    suffix: '△7',
  })
  assert.deepEqual(displayChordParts('FM7', 0, 'chord'), {
    main: 'F',
    suffix: '△7',
  })
  for (let pitch = 0; pitch < 12; pitch++) {
    const id = changeRoot('Em7', pitch)
    assert.equal(rootPitch(id), pitch)
    assert.equal(displayChordParts(id, 0, 'number').suffix, 'm7')
  }
})
test('chord type alone determines the notes; extra layers are rejected', async () => {
  const { customChord, chordNotes, chordConfig } =
    await import('../dist/music.js')
  const id = customChord({ root: 3, quality: 'min', extension: '9', alter: 0 })
  const midi = bassHarmonyNotes(id, 0)
  assert.deepEqual(
    midi.map((note) => (note - midi[0]) % 12).sort((a, b) => a - b),
    [0, 2, 3, 7, 10],
  )
  assert.throws(() => chordConfig(id + ':13'), RangeError)
})

test('root defaults and recommended chord options follow each degree', async () => {
  const { defaultChord, rootPitch, chordConfig, customChord, qualityGroups } =
    await import('../dist/music.js')
  const defaults = [
    'maj:maj7',
    'maj:7',
    'min:7',
    'dim:dim7',
    'min:7',
    'maj:maj7',
    'dim:7',
    'maj:7inv',
    'dim:dim7',
    'min:7',
    'maj:7',
    'slash:v_over_7',
  ]
  for (let pitch = 0; pitch < 12; pitch++) {
    const chord = defaultChord(pitch)
    const config = chordConfig(chord)
    assert.equal(rootPitch(chord), pitch)
    assert.equal(`${config.quality}:${config.extension}`, defaults[pitch])
    const groups = qualityGroups('C', chord)
    assert.equal(groups[0].options[0].value, defaults[pitch])
    const options = groups.flatMap((group) =>
      group.options.map((option) => option.value),
    )
    assert.equal(new Set(options).size, options.length)
  }
  const values = (pitch) =>
    qualityGroups(defaultChord(pitch))[0].options.map((option) => option.value)
  for (const value of ['maj:7', 'maj:b9_b13', 'maj:s9_b13', 'sus4:7'])
    assert.ok(values(4).includes(value))
  for (const value of ['slash:iv_over_v', 'min:7'])
    assert.ok(values(7).includes(value))
  const fifthGroups = qualityGroups(defaultChord(7))
  assert.equal(fifthGroups[0].options[0].label, '7')
  for (let pitch = 0; pitch < 12; pitch++) {
    const major = customChord({ ...chordConfig(defaultChord(pitch)), quality: 'maj', extension: 'none' })
    const groups = qualityGroups(defaultChord(pitch), major)
    assert.equal(groups[1].options[0].value, 'maj:none')
    assert.equal(groups[1].options[0].label, 'maj')
    assert.ok(!groups[0].options.some((option) => option.value === 'maj:none'))
  }
  assert.ok(values(6).includes('slash:iii_aug_sharp4'))
  assert.ok(values(11).includes('dim:7'))
})

test('inversions, slash chords and altered notes transpose and drive bass', async () => {
  const { defaultChord, chordNotes, chordParts, customChord, melodyNotes } =
    await import('../dist/music.js')
  const pitchClasses = (notes) =>
    [...new Set(notes.map((note) => ((note % 12) + 12) % 12))].sort(
      (a, b) => a - b,
    )
  const five = defaultChord(7),
    seven = defaultChord(11)
  assert.equal(bassHarmonyNotes(five, 0)[0] % 12, 7)
  assert.deepEqual(pitchClasses(chordNotes(five, 0)), [2, 5, 7, 11])
  assert.deepEqual(chordParts(five, 0, false), { main: 'G', suffix: '7' })
  assert.equal(chordNotes(seven, 0)[0] % 12, 11)
  assert.deepEqual(pitchClasses(chordNotes(seven, 0)), [2, 7, 11])
  assert.deepEqual(chordParts(seven, 0, false), { main: 'G', suffix: '/B' })
  const slash = customChord({
    root: 3,
    quality: 'slash',
    extension: 'iii_aug_sharp4',
    alter: 1,
  })
  assert.deepEqual(pitchClasses(chordNotes(slash, 0)), [0, 4, 6, 8])
  const maj13 = customChord({
    root: 0,
    quality: 'maj',
    extension: 'maj13',
    alter: 0,
  })
  assert.deepEqual(pitchClasses(bassHarmonyNotes(maj13, 0)), [0, 2, 4, 7, 9, 11])
  const minor13 = customChord({
    root: 0,
    quality: 'min',
    extension: '13',
    alter: 0,
  })
  assert.deepEqual(pitchClasses(bassHarmonyNotes(minor13, 0)), [0, 2, 3, 7, 9, 10])
  for (const ext of ['b9_b13', 's9_b13']) {
    const chord = customChord({
      root: 2,
      quality: 'maj',
      extension: ext,
      alter: 0,
    })
    for (let key = 0; key < 12; key++) {
      const tones = bassHarmonyNotes(chord, key)
      assert.ok(tones.some((n) => (n - tones[0] + 120) % 12 === 8))
      assert.ok(melodyNotes(key, chord, 'chord').every((note) =>
        (note.category === 'chord') === tones.some((n) => n % 12 === note.midi % 12),
      ))
    }
  }
})

test('altered dominant 9 and 13 labels match exact intervals and survive transposition', async () => {
  const { customChord, chordParts, chordNotes } =
    await import('../dist/music.js')
  for (const [extension, suffix, ninth] of [
    ['b9_13', '7(♭9,13)', 1],
    ['s9_13', '7(♯9,13)', 3],
  ]) {
    const id = customChord({ root: 4, quality: 'maj', extension, alter: 0 })
    assert.equal(chordParts(id, 0, true).suffix, suffix)
    for (let key = 0; key < 12; key++) {
      const midi = bassHarmonyNotes(id, key)
      assert.deepEqual(
        midi.map((note) => (note - midi[0]) % 12).sort((a, b) => a - b),
        [0, 4, 7, 10, ninth, 9].sort((a, b) => a - b),
      )
    }
  }
})

test('tension voicings retain their chord tones within the upper limit', async () => {
  const { customChord, chordNotes, qualityCatalog } = await import('../dist/music.js')
  const cMaj9 = customChord({ root: 0, quality: 'maj', extension: 'maj9', alter: 0 })
  assert.deepEqual(chordNotes(cMaj9, 0), [59, 62, 64, 67])
  const expectedTensions = {
    '9': [2, 10], maj9: [2, 11], add9: [2],
    '11': [2, 5, 10], add11: [2, 5], b9: [1, 10],
    b9_13: [1, 9, 10], s9_13: [3, 9, 10],
    '13': [2, 9, 10], maj13: [2, 9, 11],
    b9_b13: [1, 8, 10], s9_b13: [3, 8, 10],
  }
  for (const { value } of qualityCatalog) {
    const [quality, extension] = value.split(':')
    const required = expectedTensions[extension]
    if (!required) continue
    for (let root = 0; root < 7; root++) {
      const chord = customChord({ root, quality, extension, alter: 0 })
      for (let key = 0; key < 12; key++) {
        const notes = chordNotes(chord, key)
        const rootClass = bassHarmonyNotes(chord, key)[0] % 12
        const intervals = notes.map(note => note - rootClass)
        assert.ok(intervals.every((interval) => interval >= 0 && rootClass + interval <= 79), value)
        assert.ok(intervals.every((interval, index) => index === 0 || interval > intervals[index - 1]), value)
        assert.ok(notes.at(-1) - notes[0] < 12, value)
        assert.ok(notes.length <= 4, value)
        for (const tone of required)
          assert.ok(intervals.some((interval) => interval % 12 === tone), `${value} missing ${tone}`)
      }
    }
  }
})

test('all standalone chord qualities in every key fit the accompaniment register', async () => {
  const { customChord, qualityCatalog } = await import('../dist/music.js')
  for (const { value } of qualityCatalog) {
    const [quality, extension] = value.split(':')
    for (let root = 0; root < 7; root++) {
      for (const alter of [11, 0, 1]) {
        const chord = customChord({ root, quality, extension, alter })
        for (let key = 0; key < 12; key++) {
          const notes = chordNotes(chord, key)
          assert.ok(notes[0] >= 41 && notes.at(-1) <= 79, value)
          assert.ok(notes.every((note, index) => !index || note > notes[index - 1]), value)
        }
      }
    }
  }
})

test('only plain V7 uses the ordered ♭7, root, third, fifth grip; bass stays on V', async () => {
  const { defaultChord } = await import('../dist/music.js')
  for (let key = 0; key < 12; key++) {
    for (const id of ['G7', defaultChord(7), 'x:4:maj:7:0']) {
      const notes = chordNotes(id, key)
      assert.deepEqual(notes.map(note => note % 12), [5, 7, 11, 2].map(pc => (pc + key) % 12))
      assert.equal(notes.at(-1) - notes[0], 9)
      assert.equal(bassHarmonyNotes(id, key)[0] % 12, (7 + key) % 12)
    }
    const secondary = chordNotes('x:2:maj:7:0', key)
    assert.equal(secondary[0] % 12, (4 + key) % 12)
  }
})

test('IV, V7/V13, vi and III7 keep a continuous top line through the loop in all keys', () => {
  const { player } = fixture()
  for (const dominant of ['G7', 'x:4:maj:13:0']) {
    player.slots = ['FM7', dominant, 'Am7', 'x:2:maj:7:0']
    for (let key = 0; key < 12; key++) {
      player.key = key
      const phrase = player.slots.map((chord, bar) => player.notesForBar(chord, bar))
      phrase.forEach((notes, i) => {
        const next = phrase[(i + 1) % phrase.length]
        assert.ok(Math.abs(notes.at(-1) - next.at(-1)) <= 5)
      })
      const voiced = phrase[1]
      if (dominant === 'G7') {
        assert.deepEqual(voiced.map(n => n % 12), [5, 7, 11, 2].map(pc => (pc + key) % 12))
      } else {
        assert.deepEqual(voiced.map(n => (n - key - 7 + 24) % 12).sort((a,b) => a-b), [2, 4, 9, 10])
        assert.ok(voiced.at(-1) - voiced[0] < 12)
      }
    }
  }
})

test('auditioning an alternative in a cell yields the actual inserted voicing without editing the score', () => {
  const { player } = fixture()
  const preview = player.notesForBar('x:4:maj:13:0', 2, 2)
  assert.equal(player.beatSlots[2][2], null)
  player.beatSlots[2][2] = 'x:4:maj:13:0'
  assert.deepEqual(player.notesForBar('x:4:maj:13:0', 2, 2), preview)
})

test('Fmaj7 keeps F2 while placing its upper voices at C4 E4 A4', async () => {
  const { customChord } = await import('../dist/music.js')
  assert.deepEqual(chordNotes('FM7', 0), [41, 60, 64, 69])
  assert.deepEqual(chordNotes(customChord({ root: 3, quality: 'maj', extension: 'maj7', alter: 0 }), 0), [41, 60, 64, 69])
  assert.deepEqual(chordNotes('CM7', 5), [41, 60, 64, 69])
})

test('empty beats sustain the chord and a fourth beat change updates chord and bass', async () => {
  const { player, instrument, calls } = fixture()
  const bassCalls = []
  const steps = []
  player.bass = { playAt: (...args) => bassCalls.push(args), silence() {} }
  player.onStep = (index, chord) => steps.push([index, chord])
  player.slots[0] = 'Em7'
  player.beatSlots[0][3] = 'G'
  await player.start()
  clearInterval(player.timer)
  assert.equal(calls.length, 2)
  assert.deepEqual(calls[0][0], player.notesForBar('Em7', 0))
  assert.deepEqual(calls[1][0], player.notesForBar('G', 0, 3))
  assert.ok(Math.abs(calls[1][1] - 1.85) < 1e-9)
  assert.ok(calls[0][2] < 1.8)
  assert.equal(bassCalls[0][0] % 12, chords.Em7[0] % 12)
  assert.equal(bassCalls.at(-1)[0] % 12, chords.G[0] % 12)
  instrument.context.currentTime = 1.85
  player.tick()
  assert.deepEqual(steps.at(-1), [0, 'G'])
  player.clearBeatSlots()
  assert.equal(player.beatSlots[0][3], null)
  player.stop()
})

test('starting inside a bar carries the previous chord and synchronizes the remaining beats', async () => {
  const { player, instrument, calls } = fixture()
  const drums = [], bass = [], steps = []
  player.drums = { hitAt: (...args) => drums.push(args), silence() {} }
  player.bass = { playAt: (...args) => bass.push(args), silence() {} }
  player.onStep = (index, chord, key) => steps.push([index, chord, key])
  player.slots[2] = 'C'
  player.beatSlots[2][1] = 'Em7'
  player.beatSlots[2][3] = 'G'
  player.modulation[1] = 1
  await player.start(2, 2)
  clearInterval(player.timer)
  assert.equal(calls.length, 2)
  assert.deepEqual(calls[0][0], player.notesForBar('Em7', 2, 1))
  assert.deepEqual(calls[1][0], player.notesForBar('G', 2, 3))
  assert.ok(Math.abs(calls[0][1] - 0.05) < 1e-9)
  assert.ok(Math.abs(calls[1][1] - 0.65) < 1e-9)
  assert.ok(drums.every((hit) => hit[1] >= 0.05))
  assert.ok(bass.every((hit) => hit[1] >= 0.05))
  instrument.context.currentTime = 0.05
  player.tick()
  assert.deepEqual(steps.at(-1), [2, 'Em7', 1])
  instrument.context.currentTime = 1.25
  player.tick()
  assert.deepEqual(calls[2][0], player.notesForBar(player.slots[3], 3))
  player.stop()
})

test('backing rhythm stays aligned with the bar when the chord changes', async () => {
  const { player, calls } = fixture()
  player.backing = 'offbeat'
  player.slots[0] = 'Em7'
  player.beatSlots[0][1] = 'G'
  await player.start()
  clearInterval(player.timer)
  assert.equal(calls.length, 4)
  assert.deepEqual(calls[0][0], player.notesForBar('Em7', 0))
  assert.deepEqual(calls[1][0], player.notesForBar('G', 0, 1))
  assert.ok(Math.abs(calls[1][1] - 0.95) < 1e-9)
  player.stop()
})

test('live drum edits schedule added early steps in chronological order', async () => {
  const { player, instrument } = fixture()
  const times = []
  player.drums = { silence() {}, hitAt(sound, time) { times.push(time) } }
  await player.start()
  times.length = 0
  player.drumSteps = [
    { sound: 'snare', pulse: 6 },
    { sound: 'snare', pulse: 2 },
    { sound: 'snare', pulse: 0 },
  ]
  instrument.context.currentTime = player.nextTime - 0.05
  player.tick()
  player.stop()
  assert.ok(times.every((time, index) => index === 0 || time >= times[index - 1]))
})

test('fixed melody pads keep pitches while a third becomes a ninth over the next chord', async () => {
  const { melodyPalette, melodyRole } = await import('../dist/music.js')
  const first = melodyPalette(0, 'CM7', 0, 'key')
  const next = melodyPalette(0, 'Dm7', 0, 'key')
  assert.deepEqual(first.map(note => note.midi), next.map(note => note.midi))
  assert.equal(first[2].label, 'E')
  assert.equal(first[2].degree, '3')
  assert.equal(first[2].category, 'chord')
  assert.equal(next[2].degree, '9')
  assert.equal(next[2].category, 'tension')
  assert.equal(melodyRole(65, 'CM7', 0).clash, true)
  assert.equal(melodyRole(64, 'CM7', 0).clash, false)
  // Local modulation recontextualizes the same fixed notes rather than moving the pads.
  for (let key = 0; key < 12; key++) {
    assert.deepEqual(melodyPalette(key, 'Am7', (key + 3) % 12, 'key').map(note => note.midi),
      melodyPalette(key, 'CM7', key, 'key').map(note => note.midi))
    const roots = melodyPalette(key, 'Dm7', key, 'chord')
    assert.equal(roots[0].degree, 'R')
    assert.equal(roots[0].category, 'chord')
  }
})

test('7 flat 13 keeps root, seventh, third and flat thirteenth in order in every key', async () => {
  const { voicePhrase } = await import('../dist/music.js')
  const id = 'x:4:maj:b13:0'
  for (let key = 0; key < 12; key++) {
    const notes = chordNotes(id, key)
    assert.deepEqual(notes.map(note => note - notes[0]), [0, 10, 16, 20])
    assert.equal(notes[0] % 12, (7 + key) % 12)
    const phrase = voicePhrase([{ id: 'FM7', key }, { id, key }, { id: 'CM7', key }])
    assert.deepEqual(phrase[1].map(note => note - phrase[1][0]), [0, 10, 16, 20])
  }
})

test('section transitions use each score and allow changing the switch during bar eight', async t => {
  const {player, instrument, calls} = fixture()
  t.after(() => player.stop())
  player.sections[1].slots.fill('C')
  await player.start(7)
  clearInterval(player.timer)
  player.selectedSection = 2
  player.sections[0].advance = true
  instrument.context.currentTime = player.nextTime
  player.tick()
  assert.equal(player.nextSection, 1)
  assert.equal(player.sectionAt(8), 1)
  assert.deepEqual(calls[1][0], chordNotes('C', 0))

  for (let bar = 0; bar < 8; bar++) {
    instrument.context.currentTime = player.nextTime
    player.tick()
  }
  assert.equal(player.nextSection, 1)
  assert.equal(player.sectionAt(16), 1)

  player.selectedSection = 3
  player.sections[3].advance = true
  await player.start(7)
  clearInterval(player.timer)
  instrument.context.currentTime = player.nextTime
  player.tick()
  assert.equal(player.nextSection, 0)
})

test('captured section notes retain timing, transpose, and replace preset parts independently', async () => {
  const {player, instrument} = fixture()
  const drums = [], bass = []
  player.drums = {hitAt(...args) { drums.push(args) }, silence() {}}
  player.bass = {playAt(...args) { bass.push(args) }, silence() {}}
  player.bpm = 120
  player.swing = 100
  player.key = 2
  player.sections[0].performance = {key:0,
    drums:[{beat:.25,sound:'snare',velocity:.6}, {beat:4,sound:'kick',velocity:.8}],
    bass:[{beat:.25,midi:40,duration:.5,velocity:.7}, {beat:4,midi:43,duration:1,velocity:.8}]}
  await player.start()
  clearInterval(player.timer)
  assert.deepEqual(drums, [['snare', .175, .6]])
  assert.deepEqual(bass, [[42, .175, .25, .7]])
  instrument.context.currentTime = 1.95
  player.tick()
  assert.deepEqual(drums[1], ['kick', 2.05, .8])
  assert.deepEqual(bass[1], [45, 2.05, .5, .8])
  player.stop()
  drums.length = 0; bass.length = 0
  player.sections[0].performance = {key:0, drums:[]}
  await player.start()
  clearInterval(player.timer)
  assert.equal(drums.length, 0)
  assert.ok(bass.length > 0, 'uncaptured bass continues to use its preset')
  player.stop()
})

for (const meter of [3, 5]) {
  test(`${meter}/4 keeps quarter-note tempo and schedules the next bar at its boundary`, async t => {
    const {player, instrument, calls} = fixture()
    t.after(() => player.stop())
    player.beatsPerBar = meter
    player.bpm = 120
    await player.start()
    clearInterval(player.timer)
    assert.ok(Math.abs(player.nextTime - (0.05 + meter * 0.5)) < 1e-9)
    assert.ok(Math.abs(calls[0][2] - meter * 0.5 * 0.92) < 1e-9)
    instrument.context.currentTime = player.nextTime
    player.tick()
    assert.ok(Math.abs(calls[1][1] - (0.05 + meter * 0.5)) < 1e-9)
    assert.ok(player.drumHits().every(hit => hit.pulse < meter * 2))
    if (meter === 5) assert.ok(player.drumHits().some(hit => hit.pulse >= 8))
  })
}

test('5/4 transport start reports the actual offset of a later bar', async t => {
  const {player} = fixture()
  t.after(() => player.stop())
  player.beatsPerBar = 5
  player.bpm = 120
  let offset
  player.onStart = (_time, seconds) => { offset = seconds }
  await player.start(2)
  clearInterval(player.timer)
  assert.equal(offset, 5)
})

test('section part settings apply before scheduling and only on section transitions', async t => {
  const {player, instrument, calls} = fixture()
  t.after(() => player.stop())
  const sections = []
  player.sections[0].advance = true
  player.onScheduleSection = section => {
    sections.push(section)
    player.backing = section === 0 ? 'whole' : 'quarters'
  }
  await player.start(7)
  clearInterval(player.timer)
  const before = calls.length
  instrument.context.currentTime = player.nextTime
  player.tick()
  assert.deepEqual(sections, [0, 1])
  assert.equal(calls.length - before, 4)
  instrument.context.currentTime = player.nextTime
  player.tick()
  assert.deepEqual(sections, [0, 1])
})


test('section lengths control loop boundaries without discarding hidden chords', async t => {
  const {player, instrument} = fixture()
  t.after(() => player.stop())
  const original = [...player.sections[0].slots]
  player.sections[0].barCount = 3
  player.sections[0].advance = true
  player.sections[1].barCount = 5
  await player.start(2)
  clearInterval(player.timer)
  instrument.context.currentTime = player.nextTime
  player.tick()
  assert.deepEqual(player.positionAt(3), {section:1, bar:0})
  for (let i = 0; i < 5; i++) {
    instrument.context.currentTime = player.nextTime
    player.tick()
  }
  assert.deepEqual(player.positionAt(8), {section:1, bar:0})
  assert.deepEqual(player.sections[0].slots, original)
  player.sections[0].barCount = 8
  assert.equal(player.barCount(0), 8)
  assert.deepEqual(player.sections[0].slots, original)
})

test('modulation edits carry forward while preserving later changes and saved bounds', async () => {
  const {shiftModulationFrom} = await import('../dist/progression.js')
  const offsets = [0, 0, 2, 2]
  assert.equal(shiftModulationFrom(offsets, 0, 1), true)
  assert.deepEqual(offsets, [1, 1, 3, 3])
  assert.equal(shiftModulationFrom(offsets, 1, -1), true)
  assert.deepEqual(offsets, [1, 0, 2, 2])
  const bounded = [0, 120, 0]
  assert.equal(shiftModulationFrom(bounded, 0, 1), false)
  assert.deepEqual(bounded, [0, 120, 0])
})

test('drum rate repeats or stretches a pattern across bars without changing other parts', async () => {
  const {drumEventsAtRate} = await import('../dist/progression.js')
  const hits = [{beat:0}, {beat:1}, {beat:2}, {beat:3}]
  assert.deepEqual(drumEventsAtRate(hits, 4, 0, 4, 2).map(x=>x.beat), [0,.5,1,1.5,2,2.5,3,3.5])
  assert.deepEqual(drumEventsAtRate(hits, 4, 0, 4, .5).map(x=>x.beat), [0,2])
  assert.deepEqual(drumEventsAtRate(hits, 4, 1, 4, .5).map(x=>x.beat), [0,2])
  assert.deepEqual(drumEventsAtRate(hits, 4, 0, 4, 1).map(x=>x.beat), [0,1,2,3])
})

test('automatic pad hits follow scheduled attacks and clear on stop', async () => {
  const { player, instrument, calls } = fixture()
  const drums = [], bass = [], hits = []
  player.drums = { hitAt: (...args) => drums.push(args), silence() {} }
  player.bass = { playAt: (...args) => bass.push(args), silence() {} }
  player.onPadHit = hit => hits.push(hit)
  await player.start()
  clearInterval(player.timer)
  assert.deepEqual(hits, [])
  instrument.context.currentTime = calls[0][1]
  player.tick()
  assert.ok(hits.some(hit => hit.part === 'chord' && hit.chord === player.slots[0]))
  assert.ok(hits.some(hit => hit.part === 'bass' && hit.midi === bass[0][0]))
  assert.ok(hits.some(hit => hit.part === 'drums' && hit.sound === drums[0][0]))
  assert.ok(player.pendingPadHits.length > 0)
  player.stop()
  assert.deepEqual(player.pendingPadHits, [])
})

test('Otto accompaniment styles override the pattern only for the selected part in Otto mode', async () => {
  const { player } = fixture()
  const drums = [], bass = []
  player.rhythm = 'off'
  player.bassPattern = 'support_hold'
  player.ottoAccompanimentStyle = { drums: 'eight_straight', bass: 'line_octave' }
  player.drums = { hitAt: (...args) => drums.push(args), silence() {} }
  player.bass = { playAt: (...args) => bass.push(args), silence() {} }

  async function playBar(drumMode, bassMode) {
    drums.length = bass.length = 0
    player.accompanimentModes = { drums: drumMode, bass: bassMode, chord: 'auto' }
    await player.start(0)
    player.stop()
    return { drums: drums.map(([sound]) => sound), bass: bass.map(([midi]) => midi) }
  }

  const auto = await playBar('auto', 'auto')
  const ottoDrums = await playBar('otto', 'auto')
  const ottoBass = await playBar('auto', 'otto')
  assert.deepEqual(auto.drums, [])
  assert.ok(ottoDrums.drums.includes('snare'))
  assert.deepEqual(ottoDrums.bass, auto.bass)
  assert.deepEqual(ottoBass.drums, auto.drums)
  assert.notDeepEqual(ottoBass.bass, auto.bass)
  assert.deepEqual(await playBar('auto', 'auto'), auto)
})


test('Otto drum attacks illuminate pads at the scheduled time', async () => {
  const { player, instrument, calls } = fixture()
  const hits = []
  player.drums = { hitAt() {}, silence() {} }
  player.onPadHit = hit => hits.push(hit)
  assert.deepEqual(player.ottoAccompanimentStyle, { drums: 'eight_straight', bass: 'support_hold' })
  player.accompanimentModes.drums = 'otto'
  await player.start()
  clearInterval(player.timer)
  for (let time = calls[0][1]; time < calls[0][1] + 1; time += .025) {
    instrument.context.currentTime = time
    player.tick()
  }
  assert.ok(hits.some(hit => hit.part === 'drums' && hit.sound === 'kick'))
  player.stop()
})

test('Studio bass starts silent and schedules only entered notes', async () => {
  const {player} = fixture()
  const bassCalls = []
  player.bass = {playAt(...args) { bassCalls.push(args) }, silence() {}}
  player.bpm = 120
  player.studioBass = () => []
  await player.start()
  player.stop()
  assert.deepEqual(bassCalls, [])

  player.studioBass = () => [{beat:0, midi:36, duration:1, velocity:.8}]
  await player.start()
  player.stop()
  assert.deepEqual(bassCalls, [[36, .05, .5, .8]])
})

test('Studio backing voices and drum pads replace patterns on the shared score grid', async () => {
  const {player, calls} = fixture()
  const drums = []
  player.drums = {hitPadAt(...args) { drums.push(args) }, silence() {}}
  player.bpm = 120
  player.beatsPerBar = 3
  player.studioBacking = () => [33, 60, 64].map(midi => ({beat:2, midi, duration:1, velocity:.8}))
  player.studioDrums = () => [{beat:2, midi:3, duration:.5, velocity:.8}]
  await player.start(0, 1.5)
  player.stop()
  assert.deepEqual(calls, [[[33, 60, 64], .05, .375, .8]])
  assert.deepEqual(drums, [[3, .05, .8, 0]])
})
