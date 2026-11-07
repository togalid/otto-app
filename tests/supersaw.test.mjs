import test from 'node:test'
import assert from 'node:assert/strict'
import { Instrument, MonoLine } from '../dist/audio.js'
import { getTimbre, melodyTimbreFor, timbreProfile, timbreOutputGain, voiceExpression } from '../dist/timbres.js'

test('supersaw chord and lead use a bounded three-saw unison while the lead keeps mono and vibrato', () => {
  const instances = [], lfos = []
  class MonoSynth {
    constructor(options) {this.options = options;instances.push(this)}
    detune = {}
    connect() {return this}
    dispose() {}
  }
  class PolySynth extends MonoSynth {}
  class Filter {connect(){return this}dispose(){}}
  class LFO {
    constructor(options){this.options=options;lfos.push(this)}
    amplitude = {cancelScheduledValues(){},setValueAtTime(){},linearRampToValueAtTime(){}}
    connect(){return this}start(){return this}dispose(){}
  }
  const Tone = {MonoSynth,PolySynth,Filter,LFO}
  for (const id of ['supersaw','lead-supersaw','saw-brass']) {
    const instrument = new Instrument()
    instrument.context = {currentTime:0,destination:{},createAnalyser:()=>({connect(){}}),createGain:()=>({gain:{value:0},connect(){},disconnect(){}})}
    instrument.engine = {Tone}
    instrument.setTimbre(id)
    instrument.ensureVoice()
    const synth = instances.at(-1)
    const options = id.startsWith('lead-') ? synth.options : synth.options.options
    if (id.includes('supersaw')) assert.deepEqual(options.oscillator,{type:'fatsawtooth',count:3,spread:15})
    else assert.equal(options.oscillator.type,'custom','existing saw remains a separate single-oscillator colour')
    assert.equal(instrument.mono instanceof MonoLine,id.startsWith('lead-'))
    if (id.startsWith('lead-')) {
      assert.equal(options.portamento,.025)
      assert.equal(lfos.at(-1).options.frequency,5.2)
    }
    instrument.silence()
  }
})

test('supersaw recipes retain bright sustained tone and trim the thicker oscillator stack', () => {
  assert.equal(melodyTimbreFor('supersaw'),'lead-supersaw')
  for (const [id,single] of [['supersaw','saw-brass'],['lead-supersaw','lead-saw']]) {
    const recipe = getTimbre(id)
    assert.ok(recipe.sustain >= .85 && recipe.cutoff >= 12000)
    assert.equal(timbreProfile(id).fm,false)
    assert.ok(timbreOutputGain(id) < timbreOutputGain(single))
    for (const midi of [48,60,84]) {
      const expression = voiceExpression(id,midi,.8)
      assert.ok(expression.baseFrequency >= 2500 && expression.baseFrequency <= 6500)
      assert.equal(expression.envelope.sustain,recipe.sustain)
      assert.ok(expression.envelope.release > 0 && expression.envelope.release < .26)
    }
  }
})
