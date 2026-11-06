import test from 'node:test'
import assert from 'node:assert/strict'
import { getTimbre, melodyTimbreFor, timbreProfile, timbreOutputGain, voiceExpression } from '../dist/timbres.js'
import { createTimbreVoice } from '../dist/audio.js'

test('saw and pulse voices retain upper harmonics and a strong sustained body instead of decaying like plucks', () => {
  const pluck = getTimbre('pluck'), round = getTimbre('lead-round')
  for (const id of ['saw-brass','pulse-stack','lead-saw','lead-pulse']) {
    const recipe = getTimbre(id), profile = timbreProfile(id)
    assert.ok(recipe.sustain >= .8 && recipe.sustain > pluck.sustain * 20)
    assert.ok(recipe.harmonics.length >= 16)
    assert.ok(recipe.harmonics.slice(7).some(partial => partial >= .1))
    assert.ok(recipe.cutoff > round.cutoff * 2)
    assert.ok(recipe.attack > 0 && recipe.attack < .025 && recipe.release < .16)
    assert.equal(profile.fm,false)
    assert.ok(profile.sweep <= .45,'short bright opening must not collapse into a dark pluck')
    assert.ok(timbreOutputGain(id) > 0 && timbreOutputGain(id) < .55,'sustained bright voices use conservative independent trims')
    for (const midi of [48,60,72,84]) for (const velocity of [.2,1]) {
      const expression = voiceExpression(id,midi,velocity)
      assert.ok(expression.baseFrequency >= 2400 && expression.baseFrequency <= 6500)
      assert.equal(expression.envelope.sustain,recipe.sustain)
      assert.ok(expression.envelope.attack > 0 && expression.envelope.release > 0)
    }
  }
})

test('nasal pulse has a different spectral shape from saw and chip, and maps to its own mono lead', () => {
  const saw = getTimbre('lead-saw'), pulse = getTimbre('lead-pulse'), chip = getTimbre('lead-chip')
  assert.ok(saw.harmonics.every(partial => partial > 0))
  for (const index of [3,7,11,15]) assert.equal(pulse.harmonics[index],0)
  assert.ok(pulse.harmonics[1] > saw.harmonics[1] && pulse.harmonics[1] > chip.harmonics[1])
  assert.equal(melodyTimbreFor('saw-brass'),'lead-saw')
  assert.equal(melodyTimbreFor('pulse-stack'),'lead-pulse')
  assert.equal(melodyTimbreFor('lead-saw'),'lead-saw')
  assert.equal(melodyTimbreFor('lead-pulse'),'lead-pulse')
})

test('new sustained voices use the existing expressive subtractive voice without an additional engine', () => {
  class MonoSynth {
    envelope = {set: value => {this.appliedEnvelope = value}}
    filterEnvelope = {}
    toFrequency(note) {return note}
    triggerAttack(note,time,velocity) {this.attack = {note,time,velocity};return this}
  }
  class FMSynth {constructor(){assert.fail('no FM or external sound engine needed')}}
  for (const id of ['saw-brass','pulse-stack','lead-saw','lead-pulse']) {
    const Voice = createTimbreVoice({MonoSynth,FMSynth},id)
    const voice = new Voice()
    voice.triggerAttack(440,1,.8)
    assert.ok(voice instanceof MonoSynth)
    assert.equal(voice.appliedEnvelope.sustain,getTimbre(id).sustain)
    assert.ok(voice.filterEnvelope.baseFrequency > 3000)
    assert.equal(voice.attack.note,440)
  }
})
