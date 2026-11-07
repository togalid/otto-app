import test from 'node:test'
import assert from 'node:assert/strict'
import {MonoLine, Instrument} from '../dist/audio.js'
test('overlapping scheduled notes use legato and an old note-off cannot cut the new note',()=>{
  const events=[]
  const mono=new MonoLine((...args)=>events.push(['on',...args]),time=>events.push(['off',time]))
  mono.noteOn(60,1,.8,2)
  mono.noteOn(64,1.5,.8,3)
  mono.tick(5)
  assert.deepEqual(events,[['on',60,1,.8,false],['on',64,1.5,.8,true],['off',4.5]])
})
test('touching notes stay legato while an actual rest starts a new attack',()=>{
  const events=[]
  const mono=new MonoLine((m,t,l,legato)=>events.push(legato),()=>{})
  mono.noteOn(60,1,.8,1)
  mono.noteOn(62,2,.8,1)
  mono.noteOn(64,4,.8,1)
  mono.tick(6)
  assert.deepEqual(events,[false,true,false])
})
test('mono melody builds one voice, delays vibrato, and clears pending notes on silence',()=>{
  const actions=[],depth=[]
  class Voice {
    detune={}
    envelope={set(){}}
    filterEnvelope={}
    connect(){return this}
    toFrequency(n){return n}
    triggerAttack(...args){actions.push(['attack',...args])}
    setNote(...args){actions.push(['legato',...args])}
    triggerRelease(...args){actions.push(['release',...args])}
    dispose(){actions.push(['dispose'])}
  }
  class LFO {
    amplitude={cancelScheduledValues:t=>depth.push(['cancel',t]),setValueAtTime:(v,t)=>depth.push(['set',v,t]),linearRampToValueAtTime:(v,t)=>depth.push(['ramp',v,t])}
    connect(){return this}
    start(){return this}
    dispose(){depth.push(['dispose'])}
  }
  const instrument=new Instrument()
  instrument.setTimbre('lead-round')
  instrument.context={currentTime:0,destination:{},createAnalyser:()=>({connect(){}}),createGain:()=>({gain:{value:0},connect(){},disconnect(){}})}
  instrument.engine={Tone:{MonoSynth:Voice,Filter:class {connect(){return this} dispose(){}},LFO}}
  try {
    instrument.playAt([60],1,2)
    instrument.playAt([64],1.5,3)
    instrument.mono.tick(5)
    assert.equal(actions.filter(a=>a[0]==='attack').length,1)
    assert.equal(actions.filter(a=>a[0]==='legato').length,1)
    assert.deepEqual(actions.find(a=>a[0]==='release'),['release',4.5])
    assert.ok(depth.some(a=>a[0]==='set' && a[1]===0 && a[2]===1.32))
    assert.ok(depth.some(a=>a[0]==='ramp' && a[1]===1 && a[2]===1.78))
  } finally {instrument.silence()}
  assert.equal(instrument.mono,undefined)
  assert.equal(instrument.monoTimer,undefined)
  assert.ok(depth.some(a=>a[0]==='dispose'))
})

test('keyboard glide uses longer portamento without retriggering and ignores the previous key release',()=>{
  const instrument=new Instrument(),events=[]
  instrument.context={currentTime:0}
  instrument.synth={portamento:.025}
  instrument.ensureVoice=()=>{}
  instrument.mono=new MonoLine((m,t,l,legato)=>events.push({m,legato,glide:instrument.synth.portamento}),t=>events.push({off:t}))
  instrument.attack(60)
  instrument.attack(67,true)
  instrument.release(60)
  assert.deepEqual(events,[{m:60,legato:false,glide:.025},{m:67,legato:true,glide:.085}])
  assert.equal(instrument.synth.portamento,.025)
  instrument.release(67)
  assert.equal(events.length,3)
  assert.ok('off' in events[2])
})
