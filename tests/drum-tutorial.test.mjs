import test from 'node:test'
import assert from 'node:assert/strict'
import {drumKitEightBeat,drumPads,drumLessonPattern,matchDrumHit,matchDrumSessionHit,DRUM_LESSON_BPM,isDrumMetronomeBeat,drumUserHitPosition,drumSessionHitPosition} from '../dist/drum-tutorial.js'

test('first beat accepts slightly early input at both turn changes without accepting Otto’s other beats',()=>{
  const pattern=drumLessonPattern(0)
  for(const beat of [3.8,11.8]) {
    const position=drumUserHitPosition(beat)
    assert.ok(position)
    assert.ok(matchDrumHit(pattern,3,position.local,new Set())>=0)
  }
  assert.equal(drumUserHitPosition(3.6),null)
  assert.equal(drumUserHitPosition(8.3),null)
  assert.ok(matchDrumHit(pattern,3,.27,new Set())>=0)
  assert.equal(matchDrumHit(pattern,3,.31,new Set()),-1)
})

test('metronome marks each quarter beat for all four bars at 50 BPM',()=>{
  assert.equal(DRUM_LESSON_BPM,50)
  assert.deepEqual(Array.from({length:33},(_,step)=>step).filter(isDrumMetronomeBeat),[0,2,4,6,8,10,12,14,16,18,20,22,24,26,28,30])
})

test('eight pads mirror each sound with subtle stereo and velocity differences',()=>{
  assert.equal(drumPads.length,8)
  for(const [left,right] of [[0,3],[1,2],[4,7],[5,6]]) {
    assert.equal(drumPads[left].sound,drumPads[right].sound)
    assert.ok(drumPads[left].pan<0 && drumPads[right].pan>0)
    assert.notEqual(drumPads[left].level,drumPads[right].level)
  }
})
test('eight-beat lesson adds backbeats then downbeat kicks without changing alternate hats',()=>{
  const hats=drumLessonPattern(0)
  assert.deepEqual(hats.map(hit=>hit.beat),[0,.5,1,1.5,2,2.5,3,3.5])
  assert.deepEqual(hats.map(hit=>hit.pad),[3,0,3,0,3,0,3,0])
  assert.deepEqual(drumLessonPattern(1).filter(hit=>hit.pad===2).map(hit=>hit.beat),[1,3])
  assert.deepEqual(drumLessonPattern(3).filter(hit=>hit.pad===6).map(hit=>hit.beat),[0,2])
  assert.deepEqual(drumLessonPattern(3).filter(hit=>hit.pad===0||hit.pad===3),hats)
})
test('right-hand practice alternates simultaneous hat and kick or snare each beat',()=>{
  const pattern=drumLessonPattern(2)
  assert.deepEqual([0,1,2,3].map(beat=>pattern.filter(hit=>hit.beat===beat).map(hit=>hit.pad)),[[3,6],[3,2],[3,6],[3,2]])
  const matched=new Set()
  const hat=matchDrumHit(pattern,3,0.08,matched); matched.add(hat)
  assert.ok(hat>=0 && matchDrumHit(pattern,6,0.08,matched)>=0)
  assert.equal(matchDrumHit(pattern,0,0.08,matched),-1)
})
test('timing judge accepts simultaneous hat and snare, rejects wrong hand and duplicate hits',()=>{
  const pattern=drumLessonPattern(3),matched=new Set()
  const hat=matchDrumHit(pattern,3,1.08,matched)
  assert.ok(hat>=0);matched.add(hat)
  const snare=matchDrumHit(pattern,2,1.08,matched)
  assert.ok(snare>=0);matched.add(snare)
  assert.equal(matchDrumHit(pattern,3,1.08,matched),-1)
  assert.equal(matchDrumHit(pattern,0,1.08,matched),-1)
  assert.equal(matchDrumHit(pattern,6,1.08,matched),-1)
})

 test('lesson two starts with right-hand hats and backbeat snare', () => {
  const pattern=drumLessonPattern(1,0)
  assert.deepEqual(pattern.filter(hit=>hit.pad===3).map(hit=>hit.beat),[0,1,2,3])
  assert.deepEqual(pattern.filter(hit=>hit.pad===2).map(hit=>hit.beat),[1,3])
  assert.equal(pattern.some(hit=>hit.pad===0),false)
  assert.equal(drumLessonPattern(1,1).filter(hit=>hit.pad===0).length,4)
})

test('lesson three combines right-hand practice and the full eight beat',()=>{
  assert.deepEqual(drumLessonPattern(2,0),drumLessonPattern(2))
  assert.deepEqual(drumLessonPattern(2,1),drumLessonPattern(3))
})

test('session judges all eight bars and early transitions',()=>{
  assert.deepEqual(drumSessionHitPosition(3.8),{bar:1,local:-0.20000000000000018})
  assert.deepEqual(drumSessionHitPosition(28),{bar:7,local:0})
  assert.equal(drumSessionHitPosition(32),null)
})

test('session accepts both simultaneous hits just before the first beat',()=>{
  const position=drumSessionHitPosition(-.12)
  assert.deepEqual(position,{bar:0,local:-.12})
  const pattern=drumLessonPattern(3), matches=new Set()
  for(const pad of [3,6]) { const index=matchDrumHit(pattern,pad,position.local,matches); assert.ok(index>=0); matches.add(index) }
  assert.equal(drumSessionHitPosition(-.31),null)
})

test('session keeps adjacent bars independent when simultaneous hits straddle a bar line',()=>{
  const pattern=drumLessonPattern(6,1), bars=new Map()
  const early=matchDrumSessionHit(pattern,6,3.96,bars)
  assert.equal(early?.bar,1)
  bars.set(1,new Set([early.index]))
  const previous=matchDrumSessionHit(pattern,4,3.70,bars)
  assert.equal(previous?.bar,0)
  const snare=matchDrumSessionHit(pattern,2,4.99,bars)
  const kick=matchDrumSessionHit(pattern,6,5.04,bars)
  assert.equal(snare?.bar,1); assert.equal(kick?.bar,1)
  assert.notEqual(snare?.index,kick?.index)
})

test('lesson five adds left kick together with left hat on the upbeat of three',()=>{
  const pattern=drumLessonPattern(4)
  assert.deepEqual(pattern.filter(hit=>hit.beat===2.5).map(hit=>hit.pad).sort(),[0,5])
  assert.deepEqual(pattern.filter(hit=>hit.pad!==5),drumLessonPattern(3))
})

test('lesson five repeats the third beat with both hands',()=>{
  const pattern=drumLessonPattern(4,0)
  assert.deepEqual(pattern.filter(hit=>hit.beat===0).map(hit=>hit.pad),[3,6])
  assert.deepEqual(pattern.filter(hit=>hit.beat===.5).map(hit=>hit.pad),[0,5])
  assert.deepEqual(drumLessonPattern(4,1),drumLessonPattern(4))
})

test('advanced exercises build on their first-half patterns and use playable grid positions',()=>{
  for(const [stage,division] of [[5,4],[6,2],[7,2],[8,3],[9,2]]) {
    const practice=drumLessonPattern(stage,0), session=drumLessonPattern(stage,1)
    assert.ok(practice.length>0)
    assert.deepEqual(practice,session)
    if(stage===5) {
      assert.deepEqual(practice.filter(hit=>hit.pad===6).map(hit=>hit.beat),[0,2])
      assert.deepEqual(practice.filter(hit=>hit.pad===2).map(hit=>hit.beat),[1,3])
    }
    for(const hit of practice) assert.ok(session.some(other=>other.beat===hit.beat && other.pad===hit.pad))
    const matched=new Set()
    for(const {beat,pad} of session) {
      assert.ok(beat>=0 && beat<4 && Math.abs(beat*division-Math.round(beat*division))<1e-8)
      const index=matchDrumHit(session,pad,beat,matched)
      assert.ok(index>=0)
      matched.add(index)
    }
  }
  assert.deepEqual(drumSessionHitPosition(3.75,.125),{bar:0,local:3.75})
  assert.equal(drumSessionHitPosition(3.94,.125)?.bar,1)
})

test('kit 8-beat uses the three lower pads with simultaneous hits on each quarter', () => {
  const pattern = drumKitEightBeat()
  assert.deepEqual(pattern.filter(hit => hit.pad === 6).map(hit => hit.beat), [0,.5,1,1.5,2,2.5,3,3.5])
  assert.deepEqual(pattern.filter(hit => hit.pad === 4).map(hit => hit.beat), [0,2])
  assert.deepEqual(pattern.filter(hit => hit.pad === 5).map(hit => hit.beat), [1,3])
})
