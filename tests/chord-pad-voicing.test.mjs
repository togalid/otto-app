import test from 'node:test'
import assert from 'node:assert/strict'
import {padChordNotes, customChord, chordNotes} from '../dist/music.js'
for (const [root,quality,extension,expected] of [
  [3,'maj','maj7',[41,57,60,64]],
  [3,'maj','maj9',[41,55,57,60,64]],
  [5,'min','7',[45,55,57,60,64]],
  [5,'min','9',[45,55,59,62]],
  [0,'maj','maj7',[36,59,60,64,67]],
  [1,'min','7',[38,65,69,72]],
  [4,'maj','7',[43,53,55,59,62]],
  [0,'min','7',[48,58,60,63,67]],
  [1,'min','9',[50,60,65,69,72,76]],
  [2,'sus4','7',[52,55,60,62,67]],
  [2,'min','7',[40,55,59,62]],
]) test(`pad voicing ${root}:${quality}:${extension} keeps ordered voices and transposes`,()=>{
 const id=customChord({root,quality,extension,alter:0})
 assert.deepEqual(padChordNotes(id,0),expected)
 assert.deepEqual(padChordNotes(id,2),expected.map(n=>n+2))
 assert.deepEqual(padChordNotes(id,11),expected.map(n=>n-1))
})
test('unconfigured pad chords retain the existing voicing',()=>{
 assert.deepEqual(padChordNotes(customChord({root:2,quality:'maj',extension:'7',alter:0}),0),chordNotes(customChord({root:2,quality:'maj',extension:'7',alter:0}),0))
})
