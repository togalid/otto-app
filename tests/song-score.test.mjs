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


test('meter and tempo carry forward until the next change and are included in seek offsets', async () => {
 const context = {currentTime: 0, state: 'running'}
 const player = new Progression({context, async ready(){}, silence(){}, playAt(){}}, () => {}, message => assert.fail(message))
 player.sections = migrateSongSections(legacy())
 player.songMode = true
 player.bpm = 120
 player.barSettings = {1: {bpm: 60, meter: 5, key: 7}, 3: {meter: 4, bpm: 120}}
 const scheduled = []
 player.onScheduleBar = (bar, beat, time, secondsPerBeat) => scheduled.push({bar, time, secondsPerBeat})
 await player.start(1)
 clearInterval(player.timer)
 assert.equal(player.beatsPerBar, 5)
 assert.equal(player.keyForBar(1), 7)
 assert.equal(player.keyForBar(2), 7)
 assert.equal(scheduled[0].secondsPerBeat, 1)
 context.currentTime = player.nextTime
 player.tick()
 assert.equal(scheduled[1].time - scheduled[0].time, 5)
 assert.equal(scheduled[1].secondsPerBeat, 1)
 assert.equal(player.bpmForBar(3), 120)
 assert.equal(player.beatsPerBar, 5)
 assert.equal(player.meterSignatureForBar(3), 4)
 player.stop()
 let offset
 player.onStart = (_time, seconds) => { offset = seconds }
 await player.start(3)
 clearInterval(player.timer)
 assert.equal(offset, 12)
 player.stop()
})

test('eighth-note meters schedule all chord slots and keep quarter-note BPM', async () => {
 const context = {currentTime: 0, state: 'running'}
 const player = new Progression({context, async ready(){}, silence(){}, playAt(){}}, () => {}, message => assert.fail(message))
 player.sections = migrateSongSections(legacy())
 player.songMode = true
 player.bpm = 120
 player.barSettings = {0: {meter: '6/8'}, 1: {meter: '3/8'}}
 player.beatSlots[0][5] = 'G7'
 await player.start()
 clearInterval(player.timer)
 const first = player.pending.filter(step => step.index === 0)
 assert.equal(first.length, 6)
 assert.equal(first[5].chord, 'G7')
 assert.ok(Math.abs(first[5].time - first[0].time - 1.25) < 1e-9)
 const secondStart = player.nextTime
 assert.ok(Math.abs(secondStart - first[0].time - 1.5) < 1e-9)
 context.currentTime = secondStart - .01
 player.tick()
 assert.equal(player.pending.filter(step => step.index === 1).length, 3)
 assert.ok(Math.abs(player.nextTime - secondStart - 0.75) < 1e-9)
 player.stop()
})

test('pickup notes play before the first bar when starting at the pickup', async () => {
 const context = {currentTime:0, state:'running'}
 const notes = []
 const instrument = {context, async ready(){}, silence(){}, playAt(){}}
 const player = new Progression(instrument, ()=>{}, message=>assert.fail(message))
 player.sections = migrateSongSections(legacy())
 player.songMode = true
 player.bpm = 120
 player.melody = {async ready(){}, silence(){}, playAt(pitches, time){notes.push({pitches, time})}}
 player.studioMelody = () => [{beat:-1, duration:.5, midi:60, velocity:.8}, {beat:0, duration:1, midi:62, velocity:.8}]
 let startTime
 player.onStart = time => {startTime = time}
 await player.start(0, -1)
 clearInterval(player.timer)
 assert.equal(notes[0].pitches[0], 60)
 assert.ok(Math.abs(startTime - notes[0].time - .5) < 1e-9)
 player.stop()
})
