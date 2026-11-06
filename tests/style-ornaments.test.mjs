import test from 'node:test'
import assert from 'node:assert/strict'
import { genres } from '../dist/groove.js'
import { ornamentParts, ornamentPatterns, ornamentEvents } from '../dist/ornaments.js'
import { styleOrnaments } from '../dist/style-ornaments.js'

const part = (style,id) => styleOrnaments[style].find(entry => entry.id === id)

test('every selectable style has exactly four complete, valid, immutable colour choices', () => {
  assert.deepEqual(Object.keys(styleOrnaments).sort(),genres.map(genre => genre.id).sort())
  assert.ok(Object.isFrozen(styleOrnaments))
  for (const genre of genres) {
    const entries = styleOrnaments[genre.id]
    assert.deepEqual(entries.map(entry => entry.id),ornamentParts.map(part => part.id),genre.id)
    assert.ok(Object.isFrozen(entries))
    for (const entry of entries) {
      assert.ok(Object.isFrozen(entry))
      assert.ok(ornamentParts.find(part => part.id === entry.id).timbres.some(timbre => timbre.id === entry.timbre),`${genre.id}: ${entry.timbre}`)
      assert.ok(ornamentPatterns.some(pattern => pattern.part === entry.id && pattern.id === entry.pattern),`${genre.id}: ${entry.pattern}`)
      assert.ok(Number.isFinite(entry.volume) && entry.volume >= 0 && entry.volume <= 1)
    }
  }
})

test('sanctuaries, jazz interplay and guitar riffs keep space while genre signatures differ', () => {
  for (const id of ['game_calm','game_indie_emotional','jpop_ballad','vt_letter']) {
    assert.equal(part(id,'fx').pattern,'off')
    assert.equal(part(id,'phrase').pattern,'off')
    assert.equal(part(id,'pluck').pattern,'off')
  }
  for (const id of ['jazz','alley','blueglass']) assert.ok(styleOrnaments[id].every(entry => entry.pattern === 'off'))
  assert.equal(part('hammer','pluck').pattern,'off')
  assert.equal(part('hammer','phrase').pattern,'off')
  assert.equal(part('game_indie_emotional','bell').timbre,'bell')
  assert.equal(part('edm_voyage','phrase').pattern,'synth-rush')
  assert.equal(part('game_battle','phrase').pattern,'strings-fourths')
  assert.equal(part('arc_piano','phrase').pattern,'piano-wide')
  assert.equal(part('kpop_dance','pluck').pattern,'pluck-chords')
  assert.notDeepEqual(styleOrnaments.vocal_theatre,styleOrnaments.parade_shadow)
  assert.notDeepEqual(styleOrnaments.vt_neon,styleOrnaments.mirror)
})

test('dense ornaments never stack two continuous sixteenth layers and stay below foreground gain', () => {
  const continuous = new Set(['pluck-sixteen','pluck-trance-drive','strings-fourths','synth-rush','piano-wide'])
  for (const genre of genres) {
    const entries = styleOrnaments[genre.id]
    assert.ok(entries.filter(entry => continuous.has(entry.pattern)).length <= 1,genre.id)
    for (const entry of entries) assert.ok(entry.volume <= .24,`${genre.id} ${entry.id}`)
  }
})

test('all style arrangements render eight bars with bounded events through changing harmony', () => {
  const harmony = beat => beat < 2 ? [48,60,64,67,71] : [50,62,65,69,72]
  for (const genre of genres) for (const entry of styleOrnaments[genre.id]) {
    let total = 0
    for (let bar = 0; bar < 8; bar++) {
      const events = ornamentEvents(entry.id,entry.pattern,bar,harmony,genre.bpm)
      total += events.length
      for (const event of events) {
        assert.ok(event.beat >= 0 && event.beat < 4)
        assert.ok(event.duration > 0 && event.beat + event.duration <= 4)
        assert.ok(event.level > 0 && event.level * entry.volume <= .24)
      }
    }
    assert.equal(total === 0,entry.pattern === 'off',`${genre.id} ${entry.id}`)
  }
})
