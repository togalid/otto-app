import test from 'node:test'
import assert from 'node:assert/strict'
import {encodeArrangement, decodeArrangement, arrangementMixIds} from '../dist/arrangement-file.js'
import {defaultProgression} from '../dist/music.js'
import {genres} from '../dist/groove.js'

function fixture() {
  const controls = [{id:'genre',value:genres[0].id,checked:false}, {id:'genre-group',value:genres[0].group,checked:false}]
  const mix = arrangementMixIds.map(id => ({id,pressed:false}))
  const score = {slots:[...defaultProgression],beatSlots:Array.from({length:8},()=>[null,null,null,null]),modulation:[0,0,0,0],bassFeel:'straight',bassTones:[],drumSteps:null}
  const sections = Array.from({length:4},()=>({...structuredClone(score),advance:false}))
  const rules = controls.map(({id})=>({id}))
  return {controls,mix,score,sections,rules}
}

test('version 1 preserves captured section performance and accepts older arrangements', () => {
  const f = fixture()
  f.sections[1].performance = {key:2,drums:[{beat:4.5,sound:'hat',velocity:.4}],bass:[{beat:0,midi:38,duration:1,velocity:.8}]}
  const decoded = decodeArrangement(encodeArrangement(f.controls,f.mix,f.score,f.sections), f.rules)
  assert.deepEqual(decoded.sections[1].performance,f.sections[1].performance)
  assert.equal(decoded.sections[0].performance,undefined)
  assert.equal(decodeArrangement(encodeArrangement(f.controls,f.mix,f.score),f.rules).sections.length,4)
})

test('import rejects malformed or excessive captured events', () => {
  const f = fixture()
  for (const performance of [
    {key:0,drums:[{beat:32,sound:'kick',velocity:1}]},
    {key:0,drums:[{beat:1,sound:'unknown',velocity:1}]},
    {key:0,bass:[{beat:31,midi:40,duration:2,velocity:1}]},
    {key:0,bass:[{beat:0,midi:40.5,duration:1,velocity:1}]},
    {key:0,bass:Array.from({length:257},()=>({beat:0,midi:40,duration:1,velocity:1}))},
    {key:0,drums:null}, {key:12,drums:[]},
  ]) {
    f.sections[0].performance = performance
    assert.throws(()=>decodeArrangement(encodeArrangement(f.controls,f.mix,f.score,f.sections),f.rules))
  }
})

test('meter round-trips and older arrangements default to 4/4', () => {
  const f = fixture()
  assert.equal(decodeArrangement(encodeArrangement(f.controls,f.mix,f.score,f.sections),f.rules).score.beatsPerBar,4)
  for (const beatsPerBar of [3,5]) {
    f.score.beatsPerBar = beatsPerBar
    assert.equal(decodeArrangement(encodeArrangement(f.controls,f.mix,f.score,f.sections),f.rules).score.beatsPerBar,beatsPerBar)
  }
})

test('each section preserves independent part timbres and patterns', () => {
  const f = fixture()
  f.controls.push({id:'drum-timbre',value:'acoustic',checked:false})
  f.rules.push({id:'drum-timbre',options:['acoustic','electronic']})
  f.sections[0].partSettings = {'drum-timbre':'acoustic'}
  f.sections[1].partSettings = {'drum-timbre':'electronic'}
  const decoded = decodeArrangement(encodeArrangement(f.controls,f.mix,f.score,f.sections), f.rules)
  assert.deepEqual(decoded.sections[0].partSettings, f.sections[0].partSettings)
  assert.deepEqual(decoded.sections[1].partSettings, f.sections[1].partSettings)
  for (const settings of [{'drum-timbre':'missing'}, {'unknown':'acoustic'}, []]) {
    f.sections[0].partSettings = settings
    assert.throws(() => decodeArrangement(encodeArrangement(f.controls,f.mix,f.score,f.sections), f.rules))
  }
})


test('section lengths round trip independently while retaining hidden chords', () => {
  const f = fixture()
  f.sections[0].barCount = 3
  f.sections[1].barCount = 7
  const decoded = decodeArrangement(encodeArrangement(f.controls,f.mix,f.score,f.sections), f.rules)
  assert.equal(decoded.sections[0].barCount, 3)
  assert.equal(decoded.sections[1].barCount, 7)
  assert.deepEqual(decoded.sections[0].slots, f.sections[0].slots)
})

test('variable song sections preserve identities, custom backing and reject invalid steps',async()=>{
  const {migrateSongSections}=await import('../dist/song-score.js')
  const f=fixture(),sections=migrateSongSections(f.sections)
  sections[1].name='サビ'
  sections[1].backingSteps=Array.from({length:16},()=>({enabled:true,duration:.5,level:.7}))
  sections[1].bpm=132;sections[1].meter=4
  const score={...f.score,slots:sections[0].slots,beatSlots:sections[0].beatSlots,modulation:sections[0].modulation}
  const decoded=decodeArrangement(encodeArrangement(f.controls,f.mix,score,sections),f.rules)
  assert.equal(decoded.sections.length,4)
  assert.equal(decoded.sections[1].name,'サビ')
  assert.deepEqual(decoded.sections[1].backingSteps,sections[1].backingSteps)
  sections[1].backingSteps[0].level=2
  assert.throws(()=>decodeArrangement(encodeArrangement(f.controls,f.mix,score,sections),f.rules))
})

test('whole song ranges reject gaps and overlaps before restoring any settings',async()=>{
 const {migrateSongSections}=await import('../dist/song-score.js')
 const f=fixture(), sections=migrateSongSections(f.sections)
 const score={...f.score,slots:sections[0].slots,beatSlots:sections[0].beatSlots,modulation:sections[0].modulation}
 sections[1].startBar++
 assert.throws(()=>decodeArrangement(encodeArrangement(f.controls,f.mix,score,sections),f.rules),/ranges/)
 sections[1].startBar-=2
 assert.throws(()=>decodeArrangement(encodeArrangement(f.controls,f.mix,score,sections),f.rules),/ranges/)
})

test('section key and style round trip with validation and legacy fallback',()=>{
 const f=fixture()
 f.sections[1].key=9;f.sections[1].style=genres[1].id
 const decode=()=>decodeArrangement(encodeArrangement(f.controls,f.mix,f.score,f.sections),f.rules)
 assert.equal(decode().sections[1].key,9)
 assert.equal(decode().sections[1].style,genres[1].id)
 assert.equal(decode().sections[0].key,undefined)
 for(const key of [-1,12,1.5]){f.sections[1].key=key;assert.throws(decode)}
 f.sections[1].key=9;f.sections[1].style='missing-style';assert.throws(decode)
})

test('backing expression round trips and rejects invalid values', () => {
  const f=fixture(); f.sections[0].backingExpression={length:35,dynamics:70}
  const decode=()=>decodeArrangement(encodeArrangement(f.controls,f.mix,f.score,f.sections),f.rules)
  assert.deepEqual(decode().sections[0].backingExpression,{length:35,dynamics:70})
  assert.equal(decode().sections[1].backingExpression,undefined)
  for (const value of [-1,101,NaN]) { f.sections[0].backingExpression.length=value; assert.throws(decode) }
})

test('version 1 arrangement round-trips both Studio accompaniment tracks', () => {
  const {controls, mix, score, rules} = fixture()
  assert.deepEqual(decodeArrangement(encodeArrangement(controls, mix, score), rules).score.studioAccompaniment, {backing:[], drums:[]})
  score.studioAccompaniment = {
    backing:[{beat:4, duration:1, midi:33}, {beat:4, duration:1, midi:60}],
    drums:[{beat:4.5, duration:.5, midi:3}],
  }
  assert.deepEqual(decodeArrangement(encodeArrangement(controls, mix, score), rules).score.studioAccompaniment, score.studioAccompaniment)
})
