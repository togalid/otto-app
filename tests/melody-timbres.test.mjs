import test from 'node:test'
import assert from 'node:assert/strict'
import { timbres, melodyTimbres, melodyTimbreFor, timbreProfile, voiceExpression, timbreOutputGain, getTimbre } from '../dist/timbres.js'
import { genres } from '../dist/groove.js'
test('all existing styles resolve to a dedicated melody voice, separate from chord choices', () => {
  const ids = new Set(melodyTimbres.map(t => t.id))
  assert.equal(ids.size, 11)
  assert.ok(timbres.every(t => !ids.has(t.id)))
  for (const genre of genres) assert.ok(ids.has(melodyTimbreFor(genre.melody)))
  for (const t of melodyTimbres) assert.equal(melodyTimbreFor(t.id), t.id)
  assert.throws(()=>melodyTimbreFor('invalid'),RangeError)
})
test('dedicated voices have distinct recipes and bounded expressive envelopes across playing register', () => {
  assert.equal(new Set(melodyTimbres.map(t => JSON.stringify([t.harmonics,t.attack,t.decay,t.sustain,t.release]))).size,11)
  for (const voice of melodyTimbres) {
    assert.equal(getTimbre(voice.id),voice)
    assert.ok(timbreProfile(voice.id))
    assert.ok(Number.isFinite(timbreOutputGain(voice.id)))
    for (const midi of [48,60,84]) for (const velocity of [.2,1]) {
      const e = voiceExpression(voice.id,midi,velocity)
      assert.ok(e.envelope.attack>0 && e.envelope.release>0 && e.envelope.decay>0)
      assert.ok(e.envelope.sustain>=0 && e.envelope.sustain<=1)
    }
  }
})
