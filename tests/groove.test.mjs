import test from 'node:test'
import { timbres } from '../dist/timbres.js'
import assert from 'node:assert/strict'
import { genres, genreProgressions, swungBeat, swungBassBeat, bassEvents, bassFeelEvents, bassToneOffset, bassArticulation, BassSynth } from '../dist/groove.js'
import { backingPatterns } from '../dist/backing.js'
import { presets, presetSlots, presetBeatSlots } from '../dist/presets.js'
import { rhythmPatterns } from '../dist/rhythm.js'

test('bass unison spreads voices around the selected pitch', () => {
  const tone = { setVolume() {}, setPitchBend() {}, setModulation() {}, setLfo() {}, playAt() {} }
  const bass = new BassSynth({ engine: { bass: tone } })
  bass.oscillators[0].octave = -1
  bass.unisonCount = 3
  bass.unisonDetune = 20
  bass.playAt(36, 0, 1)
  assert.deepEqual(tone.oscillators, [-20, 0, 20].map(cent => ({ waveform: 'sawtooth', octave: -1, cent })))
  bass.unisonCount = 1
  bass.oscillators[0].cent = 12
  bass.playAt(36, 0, 1)
  assert.equal(tone.oscillators[0].cent, 12)
})

test('swing moves only offbeats from straight eighths to triplets', () => {
  assert.equal(swungBeat(1, 0), 0.5)
  assert.equal(swungBeat(1, 100), 2 / 3)
  assert.equal(swungBeat(2, 100), 1)
  assert.equal(swungBeat(7, 100), 3 + 2 / 3)
})

test('every genre recommends an existing progression with editable independent bars', () => {
  assert.deepEqual(Object.keys(genreProgressions).sort(), genres.map(genre => genre.id).sort())
  for (const genre of genres) {
    const id = genreProgressions[genre.id]
    assert.ok(presets.some(preset => preset.id === id), genre.id)
    const first = presetSlots(id), second = presetSlots(id)
    assert.equal(first.length, 8)
    first[0] = 'changed'
    assert.notEqual(first[0], second[0])
    assert.equal(presetBeatSlots(id).length, 8)
  }
})
test('genre defaults and bass patterns stay within a bar', () => {
  for (const id of ['garage', 'liquid', 'dub']) assert.ok(genres.some(genre => genre.id === id))
  assert.equal(new Set(genres.map(genre => genre.id)).size, genres.length)
  const groups = new Set(genres.map(genre => genre.group))
  for (const group of ['J-POP', 'ボカロ', 'アニソン', 'アイドル', 'K-POP', 'ゲーム音楽', '音楽ゲーム', 'ダンス・チル']) assert.ok(groups.has(group), group)
  for (const genre of genres) {
    assert.ok(genre.bpm >= 40 && genre.bpm <= 200)
    const events = bassEvents(genre.bassPattern, 36)
    assert.ok(
      events.length &&
        events.every(
          (event) => event.pulse >= 0 && event.pulse < 8 && event.midi >= 36,
        ),
    )
    assert.ok(rhythmPatterns.some(pattern => pattern.id === genre.rhythm))
    assert.ok(['acoustic', 'electronic'].includes(genre.drum))
    assert.ok(['acoustic', 'electric', 'synth'].includes(genre.bass))
    assert.ok(backingPatterns.some(pattern => pattern.id === genre.backing))
    assert.ok(timbres.some(timbre => timbre.id === genre.chord))
  }
})

test('bass volume is bounded and can be changed before audio starts', async () => {
  const { BassSynth } = await import('../dist/groove.js')
  const bass = new BassSynth({})
  bass.setVolume(-1)
  assert.equal(bass.volume, 0)
  bass.setVolume(2)
  assert.equal(bass.volume, 1)
})

test('bass patterns support offbeats and silence', () => {
  assert.deepEqual(
    bassEvents('offbeat', 36).map((event) => event.pulse),
    [1, 3, 5, 7],
  )
  assert.deepEqual(bassEvents('off', 36), [])
})

test('bass patterns have deliberate accents and contrasting note lengths', () => {
  for (const pattern of ['pop', 'dance', 'chill', 'jazz', 'offbeat']) {
    const events = bassEvents(pattern, 36)
    assert.ok(Math.max(...events.map(event => event.velocity)) - Math.min(...events.map(event => event.velocity)) >= 0.2)
    assert.ok(Math.max(...events.map(event => event.duration)) >= 1.7 * Math.min(...events.map(event => event.duration)))
  }
})

test('selected bass tones follow chord quality and unselected tones are absent', () => {
  assert.equal(bassToneOffset(1, [], [48, 52, 55]), 0)
  assert.equal(bassToneOffset(0, ['octave'], [48, 52, 55]), 0)
  assert.equal(bassToneOffset(1, ['octave'], [48, 52, 55]), 12)
  assert.equal(bassToneOffset(1, ['fifth'], [48, 52, 55]), 7)
  assert.equal(bassToneOffset(1, ['fifth'], [48, 51, 54]), 6)
  assert.equal(bassToneOffset(1, ['third'], [48, 52, 55]), 4)
  assert.equal(bassToneOffset(1, ['third'], [48, 51, 55]), 3)
  assert.equal(bassToneOffset(1, ['third'], [48, 53, 55]), 0)
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7].map(index => bassToneOffset(index, ['octave', 'fifth', 'third'], [48, 52, 55])), [0, 12, 0, 7, 0, 4, 0, 12])
  assert.deepEqual([0, 1, 2, 3].map(index => bassToneOffset(index, ['octave'], [48, 52, 55])), [0, 12, 0, 12])
  assert.ok(bassEvents('dance', 36).every(event => event.midi === 36))
})

test('articulation controls change length and accent without exceeding velocity bounds', () => {
  assert.ok(bassArticulation(0.5, 0.7, 0, 50).duration < bassArticulation(0.5, 0.7, 50, 50).duration)
  assert.ok(bassArticulation(0.5, 0.7, 100, 50).duration > bassArticulation(0.5, 0.7, 50, 50).duration)
  assert.ok(bassArticulation(0.5, 0.6, 50, 100).velocity < bassArticulation(0.5, 0.6, 50, 0).velocity)
  assert.ok(bassArticulation(0.5, 1, 50, 100).velocity <= 1)
  assert.deepEqual(bassArticulation(0.5, 0.7, 50, 50), { duration: 0.5, velocity: 0.7 })
})

test('nine bass patterns retain their rhythmic character and offbeat shift stays in the bar', () => {
  const patterns = ['straight4', 'straight8', 'straight16', 'line_walk', 'line_sing', 'line_octave', 'support_hold', 'support_half', 'support_pulse']
  assert.deepEqual(patterns.slice(0, 3).map(id => bassEvents(id, 0).length), [4, 8, 16])
  for (const pattern of patterns) {
    const events = bassEvents(pattern, 0)
    const shifted = bassFeelEvents(events, 'offbeat')
    assert.equal(shifted.length, events.length)
    assert.ok(shifted.every(event => event.pulse >= 0 && event.pulse < 8))
    assert.ok(shifted.every((event, i) => i === 0 || event.pulse > shifted[i - 1].pulse))
    for (const swing of [0, 100])
      assert.ok(shifted.every((event, i) => i === 0 || swungBassBeat(event.pulse, swing) > swungBassBeat(shifted[i - 1].pulse, swing)))
  }
  assert.equal(swungBassBeat(1, 100), 2 / 3)
  assert.equal(swungBassBeat(0.5, 100), 1 / 3)
  assert.ok(bassEvents('line_sing', 0).some(event => event.tone === 'third'))
})

test('bass lines alternate motifs and combine held notes with rests', () => {
  for (const id of ['line_walk', 'line_sing', 'line_octave']) {
    const first = bassEvents(id, 36, 0)
    const second = bassEvents(id, 36, 1)
    assert.notDeepEqual(first, second)
    assert.deepEqual(first, bassEvents(id, 36, 2))
    assert.ok(first.some(event => event.duration > 1))
    assert.ok(first.some((event, i) => i < first.length - 1 && event.pulse / 2 + event.duration < first[i + 1].pulse / 2 - 0.05))
  }
})

 test('Vocaloid catalog spans electronic and acoustic arrangements with independent recipes', () => {
  const vocal = genres.filter(genre => genre.group === 'ボカロ')
  assert.equal(vocal.length, 10)
  assert.equal(new Set(vocal.map(genre => genreProgressions[genre.id])).size, 10)
  assert.ok(vocal.some(genre => genre.drum === 'acoustic'))
  assert.ok(vocal.some(genre => genre.drum === 'electronic'))
  assert.ok(vocal.some(genre => genre.rhythm === 'fragment_clock'))
  assert.ok(vocal.some(genre => genre.backing === 'strum'))
  assert.ok(!genres.some(genre => genre.group === '現代ポップ'))
  assert.equal(genres.find(genre => genre.id === 'jazz').group, 'ジャズ')
})

 test('VTuber additions have dedicated harmony and contrasting arrangements', () => {
  const additions = genres.filter(genre => genre.id.startsWith('vt_'))
  assert.equal(additions.length, 15)
  assert.equal(genres.filter(genre => genre.group === 'VTuberポップ').length, 17)
  const harmony = additions.map(genre => presets.find(preset => preset.id === genreProgressions[genre.id]))
  assert.equal(new Set(harmony.map(preset => preset.id)).size, 15)
  assert.ok(harmony.every(preset => preset.family === 'VTuberポップ'))
  assert.ok(harmony.some(preset => preset.changes.length > 0))
  assert.ok(harmony.some(preset => preset.modulation.some(delta => delta !== 0)))
  assert.ok(new Set(additions.map(genre => genre.rhythm)).size >= 8)
  assert.ok(additions.some(genre => genre.drum === 'acoustic'))
  assert.ok(additions.some(genre => genre.drum === 'electronic'))
})

test('all styles select chord accompaniment, leaving arpeggios to colour parts', async () => {
  const { chordBackingPatterns, melodyArpeggioPatterns } = await import('../dist/backing.js')
  for (const genre of genres) assert.ok(chordBackingPatterns.some(pattern => pattern.id === genre.backing), genre.id)
  assert.ok(chordBackingPatterns.every(pattern => !melodyArpeggioPatterns.includes(pattern.id)))
})
