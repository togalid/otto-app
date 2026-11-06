import test from 'node:test'
import assert from 'node:assert/strict'
import {pianoNotes,pianoKey} from '../dist/keyboard.js'
import {ottoReply} from '../dist/buddy.js'
import {melodyPalette,melodyRole} from '../dist/music.js'
test('keyboard spans three complete chromatic octaves and a closing C',()=>{
  assert.equal(pianoNotes.length,37)
  assert.equal(pianoKey(pianoNotes[0]).label,'C3')
  assert.equal(pianoKey(pianoNotes.at(-1)).label,'C6')
  assert.equal(pianoNotes.filter(n=>pianoKey(n).black).length,15)
  assert.equal(pianoNotes.filter(n=>!pianoKey(n).black).length,22)
  assert.throws(()=>pianoKey(47),RangeError)
})
test('Otto preserves keyboard notes beyond the pad range, including black keys',()=>{
  const base=melodyPalette(0,'FM7',0,'key')[0]
  const palette=()=>pianoNotes.map(midi=>({...base,midi,label:pianoKey(midi).label,...melodyRole(midi,'FM7',0)}))
  const input=[{step:148,midi:48,at:0,duration:.75},{step:175,midi:75,at:1,duration:.75}]
  const reply=ottoReply(input,palette,0)
  assert.deepEqual(reply.filter(n=>n.kind==='quote').map(n=>n.midi),[48,75])
  assert.ok(reply.every(n=>n.midi>=48 && n.midi<=84))
})
