import test from 'node:test'
import assert from 'node:assert/strict'
import { ToneBass, ToneDrums } from '../dist/tone-engine.js'

test('bass LFO adjusts cutoff independently while retaining pitch modulation', () => {
  const bass = new ToneBass({}, {})
  const pitch = [], filter = []
  const fake = (values) => ({frequency:{rampTo:v=>values.push(['rate',v])},amplitude:{rampTo:v=>values.push(['depth',v])},dispose(){values.push(['dispose'])}})
  bass.toneLfos = [fake(pitch)]
  bass.filterLfos = [fake(filter)]
  bass.setLfo(3, 40, true, true, 'triangle')
  assert.equal(bass.toneLfos[0].type, 'triangle')
  assert.equal(bass.filterLfos[0].type, 'triangle')
  assert.deepEqual(pitch, [['rate',3],['depth',.4]])
  assert.deepEqual(filter, [['rate',3],['depth',.4]])
  bass.setLfo(0, 40, false)
  assert.deepEqual(filter.slice(-2), [['rate',0],['depth',0]])
  assert.deepEqual(pitch.slice(-2), [['rate',0],['depth',0]])
  bass.silence()
  assert.deepEqual(filter.at(-1), ['dispose'])
})

test('bass expression updates all active voices and vibratos', () => {
  const bass = new ToneBass({}, {})
  const bends = [], depths = []
  bass.voices = [{ detune: { rampTo: value => bends.push(value) } }, { detune: { rampTo: value => bends.push(value) } }]
  bass.vibratos = [{ amplitude: { rampTo: value => depths.push(value) } }, { amplitude: { rampTo: value => depths.push(value) } }]
  bass.setPitchBend(.5)
  bass.setModulation(.75)
  assert.deepEqual(bends, [100, 100])
  assert.deepEqual(depths, [.75, .75])
})

test('Tone instruments schedule on the supplied clock and dispose on stop', () => {
  const events = []
  class FakeSynth {
    volume = { value: 0 }
    connect() {
      return this
    }
    triggerAttackRelease(...args) {
      events.push(args)
    }
    dispose() {
      events.push('dispose')
    }
  }
  const tone = {
    MonoSynth: FakeSynth,
    MembraneSynth: FakeSynth,
    NoiseSynth: FakeSynth,
    MetalSynth: FakeSynth,
  }
  const context = {
    currentTime: 0,
    destination: {}, createAnalyser: () => ({ connect() {} }),
    createGain: () => ({
      gain: { value: 0, setTargetAtTime() {} },
      connect() {},
      disconnect() {},
    }),
  }
  const bass = new ToneBass(tone, context)
  bass.playAt(36, 3, 0.25, 0.55)
  assert.equal(events[0][2], 3)
  assert.equal(events[0][3], 0.55)
  bass.silence()
  assert.equal(events[1], 'dispose')
  const drums = new ToneDrums(tone, context)
  drums.hitAt('hat', 4)
  assert.equal(events[2][2], 4)
  drums.silence()
  assert.equal(events.filter((event) => event === 'dispose').length, 5)
})

test('both drum timbres layer the snare body in time with the noise', () => {
  class FakeSynth {
    volume = { value: 0 }
    calls = []
    connect() { return this }
    triggerAttackRelease(...args) { this.calls.push(args) }
    dispose() {}
  }
  const tone = { MembraneSynth: FakeSynth, NoiseSynth: FakeSynth, MetalSynth: FakeSynth }
  const context = {
    currentTime: 0, destination: {}, createAnalyser: () => ({ connect() {} }),
    createGain: () => ({ gain: { value: 0 }, connect() {}, disconnect() {} }),
  }
  for (const [timbre, note] of [['acoustic', 'C4'], ['electronic', 'G3']]) {
    const drums = new ToneDrums(tone, context)
    drums.timbre = timbre
    drums.hitAt('snare', 2, 0.92)
    assert.deepEqual(drums.snare.calls[0], [0.12, 2, 0.92])
    assert.deepEqual(drums.snareBody.calls[0], [note, 0.1, 2, 0.92])
    drums.silence()
  }
})

test('bass slide ramps from the previous pitch to the target', () => {
  const attacks = [], ramps = []
  class FakeSynth {
    frequency = { exponentialRampToValueAtTime: (...args) => ramps.push(args) }
    connect() { return this }
    triggerAttackRelease(...args) { attacks.push(args) }
    dispose() {}
  }
  const context = { currentTime: 0, destination: {}, createAnalyser: () => ({ connect() {} }), createGain: () => ({ gain: { value: 0 }, connect() {}, disconnect() {} }) }
  const bass = new ToneBass({ MonoSynth: FakeSynth }, context)
  bass.playAt(48, 2, 0.5, 0.7, 45)
  assert.equal(attacks[0][0], 110)
  assert.ok(Math.abs(ramps[0][0] - 130.8128) < 0.001)
  assert.equal(ramps[0][1], 2.07)
  bass.silence()
})

test('G13 colours get distinct attack velocities with subtly staggered attacks', async () => {
  const { Instrument, chordWeights } = await import('../dist/audio.js')
  const instrument = new Instrument()
  const calls = []
  instrument.context = {}
  instrument.engine = {}
  instrument.activeTimbre = instrument.timbre
  instrument.synth = { triggerAttackRelease: (...args) => calls.push(args) }
  const notes = [53, 59, 62, 64, 69] // F, B, D, E, A over G
  instrument.playAt(notes, 4, 0.8, 1, chordWeights(notes, 'x:4:maj:13:0', 0))
  assert.equal(calls.length, 5)
  assert.ok(calls.every(([, duration, time]) => Math.abs(duration + time - 4.7944) < 1e-9 && time >= 3.9944 && time <= 4.0056))
  const [seventh, third, fifth, thirteenth, ninth] = calls.map(call => call[3])
  assert.ok(fifth < third && third === seventh && ninth === thirteenth && ninth > third)
})

test('chord voices vary colour with touch and decay with register without sharing envelopes', async () => {
  const { createTimbreVoice } = await import('../dist/audio.js')
  const { timbres, voiceExpression, timbreProfile } = await import('../dist/timbres.js')
  class FakeVoice {
    envelope = { set: value => { this.shape = value } }
    filterEnvelope = {}
    modulationEnvelope = {}
    modulationIndex = { value: 0 }
    toFrequency(note) { return note }
    triggerAttack(...args) { this.attack = args; return this }
  }
  const tone = { MonoSynth: FakeVoice, FMSynth: FakeVoice }
  for (const timbre of timbres) {
    const low = voiceExpression(timbre.id, 48, 0.3)
    const high = voiceExpression(timbre.id, 84, 0.9)
    assert.ok(low.envelope.decay > high.envelope.decay, timbre.id)
    assert.ok(low.envelope.release > high.envelope.release, timbre.id)
    assert.ok(high.envelope.attack < low.envelope.attack, timbre.id)
    const Voice = createTimbreVoice(tone, timbre.id)
    const first = new Voice(), second = new Voice()
    first.triggerAttack(220, 4, 0.3)
    const before = { ...first.shape }
    second.triggerAttack(880, 4.125, 0.9)
    assert.deepEqual(first.shape, before)
    assert.deepEqual(second.attack, [880, 4.125, 0.9])
    if (timbreProfile(timbre.id).fm) {
      assert.ok(second.modulationIndex.value > first.modulationIndex.value)
    } else {
      assert.ok(second.filterEnvelope.baseFrequency > first.filterEnvelope.baseFrequency)
    }
  }
})

test('bass filter settings update an existing voice without waiting for another note', () => {
  const applied = []
  class FakeSynth {
    filter = {Q:{value:1}}
    envelope = {set:value=>applied.push(['amp',value])}
    filterEnvelope = {set:value=>applied.push(['filter',value])}
    connect(){return this}
    triggerAttackRelease(){}
    dispose(){}
  }
  const context = {currentTime:0,destination:{},createAnalyser:()=>({connect(){}}),createGain:()=>({gain:{value:0},connect(){},disconnect(){}})}
  const bass = new ToneBass({MonoSynth:FakeSynth},context)
  bass.playAt(36,0,.5)
  bass.toneSettings = {cutoff:420,resonance:7,amp:{attack:.01,decay:.2,sustain:.5,release:.1},filter:{attack:.01,decay:.2,sustain:.4,release:.1,amount:1}}
  bass.applyToneSettings()
  assert.equal(bass.synth.filter.Q.value,7)
  assert.equal(applied.at(-1)[1].baseFrequency,420)
  bass.toneSettings.filterType = 'highpass'
  bass.toneSettings.filter.amount = -2
  bass.applyToneSettings()
  assert.equal(bass.synth.filter.type,'highpass')
  assert.equal(applied.at(-1)[1].octaves,-2)
})
