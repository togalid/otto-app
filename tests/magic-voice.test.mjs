import test from 'node:test'
import assert from 'node:assert/strict'
import {createMagicVoice} from '../dist/keyboard.js'
function fixture(t){
 t.mock.timers.enable({apis:['setTimeout']})
 const events=[]
 const voice=createMagicVoice({enabled:()=>true,bpm:()=>120,resolve:n=>n===65?64:n===71?72:n,attack:n=>events.push(['on',n]),release:n=>events.push(['off',n])})
 return {voice,events}
}
test('resolves after a thirty-second note and releases the resolved pitch',t=>{
 const {voice,events}=fixture(t);voice.attack(65);t.mock.timers.tick(62);assert.deepEqual(events,[['on',65]])
 t.mock.timers.tick(1);voice.release(65);assert.deepEqual(events,[['on',65],['on',64],['off',65],['off',64]])
})
test('releasing the previous key does not cancel a newer resolution',t=>{
 const {voice,events}=fixture(t);voice.attack(60);voice.attack(71);voice.release(60);t.mock.timers.tick(63)
 assert.ok(events.some(([type,n])=>type==='on'&&n===72));voice.stop()
})
test('early release and stopping cancel delayed notes',t=>{
 const {voice,events}=fixture(t);voice.attack(65);voice.release(65);t.mock.timers.tick(100)
 voice.attack(71);voice.stop();t.mock.timers.tick(100)
 assert.ok(!events.some(([type,n])=>type==='on'&&(n===64||n===72)))
})

test('chromatic MIDI pitches sound briefly before resolving and note-off follows the target',t=>{
 t.mock.timers.enable({apis:['setTimeout']})
 const events=[]
 const targets=new Map([[61,60],[63,64],[66,67],[68,67],[70,71]])
 const voice=createMagicVoice({enabled:()=>true,bpm:()=>120,resolve:n=>targets.get(n)??n,attack:n=>events.push(['on',n]),release:n=>events.push(['off',n])})
 for(const [note,target] of targets){events.length=0;voice.attack(note);t.mock.timers.tick(63);voice.release(note);assert.deepEqual(events,[['on',note],['on',target],['off',note],['off',target]])}
})
