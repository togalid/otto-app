import test from 'node:test'
import assert from 'node:assert/strict'
import {ottoLabPhrase,defaultOttoLab,developingSolo,followPlayerMotion,performOttoStyle} from '../dist/buddy.js'
const palette=()=>Array.from({length:25},(_,i)=>({midi:60+i,category:[0,4,7].includes(i%12)?'chord':'scale',clash:[1,5,8].includes(i%12)}))
test('Otto experiments are deterministic, bounded and monophonic in 3/4, 4/4 and 5/4',()=>{
 for(const meter of [3,4,5]){
  const settings={...defaultOttoLab,pentatonic:true,chromatic:false,wholeTone:false,density:100,rests:0,resolve:false}
  const notes=ottoLabPhrase(palette,settings,0,meter,0)
  assert.deepEqual(notes,ottoLabPhrase(palette,settings,0,meter,0))
  assert.ok(notes.length)
  notes.forEach((n,i)=>{assert.ok(n.at>=0&&n.at<meter*2);assert.ok(n.duration>0);assert.ok(n.at+n.duration<=(notes[i+1]?.at??meter*2));assert.ok([0,2,4,7,9].includes(n.midi%12))})
 }
})
test('rests, density and phrase length change generated passages; ending resolves to harmony',()=>{
 assert.equal(ottoLabPhrase(palette,{...defaultOttoLab,density:0},0,4,0).length,0)
 assert.equal(ottoLabPhrase(palette,{...defaultOttoLab,rests:100},0,4,0).length,0)
 const settings={...defaultOttoLab,density:100,rests:0}
 const notes=ottoLabPhrase(palette,settings,0,4,0)
 assert.ok([0,4,7].includes(notes.at(-1).midi%12))
 assert.notDeepEqual(ottoLabPhrase(palette,{...settings,phraseBars:4},1,4,0),ottoLabPhrase(palette,settings,1,4,0))
})
test('four-bar phrases contain a complete second half and resolve at the phrase end',()=>{
 const settings={...defaultOttoLab,phraseBars:4,density:100,rests:0,contrast:0,pickup:false}
 for(let block=0;block<12;block++){
  const notes=ottoLabPhrase(palette,settings,block,4,0)
  assert.ok(notes.some(note=>note.at>=8),'phrase continues through bars 3 and 4')
  assert.ok(notes.at(-1).at>=15)
  assert.ok([0,4,7].includes(notes.at(-1).midi%12))
  notes.forEach((note,i)=>assert.ok(note.at+note.duration<=(notes[i+1]?.at??16)))
 }
})
test('four-note pentatonic phrases stay compact, vary starts and keep rests sparse',()=>{
 for(const omit of [0,2,4,7,9]){
  let previous
  const starts=new Set()
  for(let block=0;block<8;block++){
   const notes=ottoLabPhrase(palette,{...defaultOttoLab,pentatonic:true,chromatic:false,wholeTone:false,omit,resolve:false},block,4,0,previous)
   assert.ok(notes.length>=10)
   assert.ok(new Set(notes.map(n=>n.midi)).size<=4)
   assert.ok(notes.every(n=>[0,2,4,7,9].includes(n.midi%12)))
   for(let i=1;i<notes.length;i++)assert.ok(Math.abs(notes[i].midi-notes[i-1].midi)<=5)
   starts.add(notes[0].midi)
   previous=notes.at(-1).midi
  }
  assert.ok(starts.size>1)
 }
})

test('syncopated attacks remain on the sixteenth-note grid',()=>{
 for(const meter of [3,4,5])for(let block=0;block<20;block++){
  const notes=ottoLabPhrase(palette,{...defaultOttoLab,density:100,rests:0,syncopation:100,phraseBars:4},block,meter,0)
  assert.ok(notes.every(note=>Number.isInteger(note.at*4)))
 }
})

test('rests create full beat breaths while preserving runs of notes',()=>{
 for(const pentatonic of [false,true]){
  const settings={...defaultOttoLab,pentatonic,density:100,rests:40,contrast:0,resolve:false,pickup:false}
  const notes=ottoLabPhrase(palette,settings,3,4,0)
  const counts=Array.from({length:8},(_,beat)=>notes.filter(n=>n.at>=beat&&n.at<beat+1).length)
  assert.ok(counts.includes(0)); assert.ok(counts.some(n=>n>=2))
 }
})
test('chromatic ornaments approach the following pitch on the sixteenth grid in both modes',()=>{
 for(const pentatonic of [true,false]){
  let found=0
  for(let block=0;block<12;block++){
   const settings={...defaultOttoLab,pentatonic,chromatic:true,wholeTone:false,tension:0,density:90,rests:5}
   const notes=ottoLabPhrase(palette,settings,block,4,0)
   notes.forEach((note,i)=>{if(note.category==='chromatic'){found++;assert.equal(Math.abs(note.midi-notes[i+1].midi),1);assert.ok(Number.isInteger(note.at*4));assert.ok(note.at+note.duration<=notes[i+1].at)}})
  }
  assert.ok(found>0)
 }
})
test('range limits, avoid notes and whole-tone ornaments apply in both modes',()=>{
 for(const pentatonic of [false,true]){
  let ornaments=0
  for(let block=0;block<30;block++){
   const settings={...defaultOttoLab,pentatonic,chromatic:false,wholeTone:true,highest:72,maxLeap:5,register:72,density:90,rests:0}
   const notes=ottoLabPhrase(palette,settings,block,4,0)
   for(let i=0;i<notes.length;i++){
    const n=notes[i];assert.ok(n.midi<=72)
    if(i)assert.ok(Math.abs(n.midi-notes[i-1].midi)<=5)
    if(n.category==='chromatic'){ornaments++;assert.equal(Math.abs(n.midi-notes[i+1].midi),2)}
    else assert.ok(!palette().find(p=>p.midi%12===n.midi%12)?.clash)
   }
  }
  assert.ok(ornaments>0)
 }
})

test('developing solos use shaped phrases without thirty-second runs',()=>{
 const notes=developingSolo([60,62,64,67,69,72,74,76,79],4,4,1)
 assert.ok(notes.every(n=>Number.isInteger(n.at*4)))
 assert.ok(notes.some(n=>n.duration>.4))
 assert.ok(new Set(notes.map(n=>n.midi)).size>2)
 notes.forEach((n,i)=>{assert.ok(n.at>=4&&n.at+n.duration<=8);if(notes[i+1])assert.ok(n.at+n.duration<=notes[i+1].at)})
})

test('session replies and ornaments stay within the player interval and register',()=>{
 const input=[60,62,64,62].map((midi,i)=>({step:0,midi,at:i,duration:.5}))
 const response=[84,48,79,60,76].map((midi,i)=>({step:0,midi,at:i,duration:.25}))
 const notes=followPlayerMotion(response,input,palette)
 assert.ok(notes.length)
 let previous=62
 for(const n of notes){assert.ok(n.midi>=58&&n.midi<=66);assert.ok(Math.abs(n.midi-previous)<=4);previous=n.midi}
})

test('shred sustains connected ascending arpeggios; scale uses adjacent diatonic degrees',()=>{
 const shred=performOttoStyle([],'shred',8,palette,0,0)
 assert.ok(shred.length>24)
 assert.ok(shred.slice(1).some((n,i)=>n.at-shred[i].at===.125))
 assert.ok(shred.every((n,i)=>n.duration>=Math.min(.125,8-n.at)&&[0,4,7].includes(n.midi%12)))
 assert.ok(shred.slice(0,3).every((n,i,a)=>!i||n.midi>a[i-1].midi))
 const run=performOttoStyle([],'scale',8,palette,0,0)
 assert.equal(run.length,32)
 assert.ok(run.slice(1).every((n,i)=>Math.abs(n.midi-run[i].midi)<=2))
 assert.ok(run.some((n,i)=>i&&n.midi>run[i-1].midi))
 assert.ok(run.some((n,i)=>i&&n.midi<run[i-1].midi))
})
test('jazz displaces downbeats and all styled attacks stay on sixteenths inside the phrase',()=>{
 const input=Array.from({length:8},(_,i)=>({step:0,at:i,duration:.9,midi:72}))
 const jazz=performOttoStyle(input,'jazz',8,palette,0,0)
 assert.ok(jazz.filter(n=>n.at%1!==0).length>=5)
 for(const style of ['shred','scale','jazz'])for(const beats of [6,8,10]){
  const notes=performOttoStyle(input,style,beats,palette,0,2,true)
  assert.equal(notes[0].midi,input[0].midi)
  assert.ok(notes.every(n=>n.at<beats&&(style==='jazz'?Math.abs(n.at*3-Math.round(n.at*3))<1e-8:Number.isInteger(n.at*8))&&n.duration>0&&n.at+n.duration<=beats))
 }
 assert.deepEqual(performOttoStyle(input,'craft',8,palette,0,0),input)
})

test('scale colour occasionally includes sharp eleven',()=>{
 const normal=performOttoStyle([],'scale',8,palette,0,0)
 const colour=performOttoStyle([],'scale',8,palette,0,3)
 assert.ok(!normal.some(n=>n.midi%12===6))
 assert.ok(colour.some(n=>n.midi%12===6))
})

test('opening varies while staying restrained and on safe chord tones', async () => {
 const {gentleOpening}=await import('../dist/buddy.js')
 const openings=Array.from({length:12},(_,i)=>gentleOpening(palette,4,i))
 assert.ok(new Set(openings.map(notes=>JSON.stringify(notes.map(n=>[n.at,n.midi])))).size>=4)
 for(const notes of openings){
  assert.ok(notes.length>0 && notes.length<=3)
  assert.ok(notes.every(n=>n.at>=0 && n.at+n.duration<=4 && n.level<=.68 && palette().some(p=>p.midi===n.midi && p.category==='chord' && !p.clash)))
 }
})

 test('low MIDI replies retain notes instead of falling outside the lead palette',()=>{
 const input=[36,38,40,38].map((midi,i)=>({step:0,midi,at:i,duration:.5}))
 const response=[72,74,76,74].map((midi,i)=>({step:0,midi,at:i,duration:.5}))
 const notes=followPlayerMotion(response,input,palette)
 assert.equal(notes.length,response.length)
 assert.ok(notes.every(n=>n.midi>=34&&n.midi<=42))
 })
