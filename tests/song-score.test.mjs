import test from 'node:test'
import assert from 'node:assert/strict'
import { migrateSongSections } from '../dist/song-score.js'
import { Progression } from '../dist/progression.js'
const legacy=()=>['C','Dm7','Em7','G7'].map(chord=>({slots:Array(8).fill(chord),beatSlots:Array.from({length:8},()=>[null,null,null,null]),modulation:[0,0,0,0],advance:false}))
test('legacy sections become one shared score without losing chord order',()=>{
 const original=legacy(), sections=migrateSongSections(original)
 assert.equal(sections[0].slots.length,32)
 assert.deepEqual(sections.map(s=>[s.startBar,s.endBar]),[[0,8],[8,16],[16,24],[24,32]])
 assert.equal(sections[1].slots,sections[0].slots)
 assert.equal(sections[0].slots[8],'Dm7')
 assert.equal(original[0].slots.length,8)
 assert.deepEqual(migrateSongSections(sections),sections)
})
test('song playback resolves range boundaries and shared edits independently of selected part',()=>{
 const player=new Progression({silence(){}},()=>{},()=>{})
 player.sections=migrateSongSections(legacy());player.songMode=true
 assert.deepEqual(player.positionAt(8),{bar:8,section:1})
 player.selectedSection=2;player.slots=[...player.slots];player.slots[9]='Am7'
 assert.equal(player.sections[0].slots[9],'Am7')
 assert.equal(player.barCount(),32)
})
test('whole-song scheduler changes settings at ranges and stops at the song end',async()=>{
 const context={currentTime:0,state:'running'}
 const instrument={context,async ready(){},silence(){},playAt(){}}
 const player=new Progression(instrument,()=>{},message=>assert.fail(message))
 player.sections=migrateSongSections(legacy());player.songMode=true
 player.sections[1].bpm=80;player.sections[1].meter=3
 player.bpm=120;player.backing='whole'
 const ranges=[];player.onScheduleSection=section=>ranges.push(section)
 await player.start(7)
 clearInterval(player.timer)
 context.currentTime=2;player.tick()
 assert.deepEqual(ranges,[0,1])
 assert.equal(player.bpm,80);assert.equal(player.beatsPerBar,3)
 player.stop();assert.equal(player.bpm,120);assert.equal(player.beatsPerBar,4)
 await player.start(31);clearInterval(player.timer)
 context.currentTime=player.nextTime+.01;player.tick();player.tick()
 assert.equal(player.running,false)
})

test('split and remove keep chords, while moving ranges moves their musical contents',async()=>{
 const {splitSongSection,removeSongSection,moveSongSection}=await import('../dist/song-score.js')
 const sections=migrateSongSections(legacy()), original=[...sections[0].slots]
 sections[0].backingSteps=Array.from({length:16},()=>({enabled:true,duration:.5,level:.6}))
 assert.equal(splitSongSection(sections,0),true)
 assert.equal(sections.length,5)
 assert.deepEqual(sections.map(s=>[s.startBar,s.endBar]),[[0,4],[4,8],[8,16],[16,24],[24,32]])
 assert.notEqual(sections[0].backingSteps,sections[1].backingSteps)
 assert.equal(removeSongSection(sections,1),true)
 assert.deepEqual(sections[0].slots,original)
 assert.equal(moveSongSection(sections,0,1),true)
 assert.equal(sections[0].slots[0],'Dm7')
 assert.equal(sections[1].slots[8],'C')
 assert.equal(sections[0].slots,sections[1].slots)
 assert.equal(moveSongSection(sections,0,-1),false)
})
test('custom backing schedules only enabled subdivisions with per-step dynamics',async()=>{
 const played=[], context={currentTime:0,state:'running'}
 const player=new Progression({context,async ready(){},silence(){},playAt(...args){played.push(args)}},()=>{},message=>assert.fail(message))
 player.sections=migrateSongSections(legacy());player.songMode=true;player.bpm=120
 player.sections[0].backingSteps=Array.from({length:16},(_,i)=>({enabled:i===2,duration:.25,level:.4}))
 await player.start();clearInterval(player.timer)
 assert.equal(played.length,1)
 assert.equal(played[0][2],.125)
 assert.equal(played[0][3],.4)
 player.stop()
})

test('can start on the fifth beat of a 5/4 section and offsets include earlier tempo changes',async()=>{
 const context={currentTime:0,state:'running'}, offsets=[]
 const player=new Progression({context,async ready(){},silence(){},playAt(){}},()=>{},message=>assert.fail(message))
 player.sections=migrateSongSections(legacy());player.songMode=true;player.bpm=120
 player.sections[0].bpm=60;player.sections[1].meter=5
 player.onStart=(time,offset)=>offsets.push(offset)
 await player.start(8,4);clearInterval(player.timer)
 assert.equal(player.running,true)
 assert.equal(offsets[0],34) // eight 4/4 bars at 60 BPM, plus four beats at 120 BPM
 player.stop()
})

test('section keys apply by song bar and invalidate cached voicings without changing the score',()=>{
 const player=new Progression({silence(){}},()=>{},()=>{})
 player.sections=migrateSongSections(legacy());player.songMode=true;player.key=2
 const original=[...player.slots]
 player.sections[1].key=5
 assert.equal(player.keyForBar(0),2)
 assert.equal(player.keyForBar(8),5)
 player.selectedSection=3
 assert.equal(player.keyForBar(8),5)
 const before=player.notesForBar(player.slots[8],8)
 player.sections[1].key=6
 const after=player.notesForBar(player.slots[8],8)
 assert.notDeepEqual(before,after)
 assert.deepEqual(player.slots,original)
 assert.equal(player.keyForBar(16),2)
})

test('song loop returns to the first bar and keeps the transport running',async()=>{
 const context={currentTime:0,state:'running'}, played=[]
 const player=new Progression({context,async ready(){},silence(){},playAt(){}},()=>{},message=>assert.fail(message))
 player.sections=migrateSongSections(legacy());player.songMode=true;player.loopSong=true;player.bpm=120
 player.onScheduleBar=(bar)=>played.push(bar)
 await player.start(31);clearInterval(player.timer)
 context.currentTime=player.nextTime+.01;player.tick()
 assert.equal(player.running,true);assert.deepEqual(played,[31,0]);assert.deepEqual(player.positionAt(32),{bar:0,section:0})
 player.stop()
})

test('reference tempo controls accompaniment and seek offsets across section overrides', async () => {
 const context = {currentTime:0,state:'running'}
 const player = new Progression({context,async ready(){},silence(){},playAt(){}},()=>{},message=>assert.fail(message))
 player.sections = migrateSongSections(legacy())
 player.songMode = true
 player.sections[0].bpm = 128
 player.sections[1].bpm = 80
 player.referenceBpm = 120
 let offset
 player.onStart = (_time, seconds) => { offset = seconds }
 await player.start(8, 1)
 clearInterval(player.timer)
 assert.equal(offset, 16.5)
 assert.equal(player.scheduledTempo.bpm, 120)
 player.referenceBpm = 100
 context.currentTime = player.nextTime
 player.tick()
 assert.equal(player.scheduledTempo.bpm, 100)
 player.stop()
 player.referenceBpm = null
 assert.equal(player.bpmForBar(8), 80)
})
