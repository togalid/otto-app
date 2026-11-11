import test from 'node:test'
import assert from 'node:assert/strict'
import {drumPads,drumLessonPattern,matchDrumHit} from '../dist/drum-tutorial.js'

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
  assert.deepEqual(drumLessonPattern(2).filter(hit=>hit.pad===6).map(hit=>hit.beat),[0,2])
  assert.deepEqual(drumLessonPattern(2).filter(hit=>hit.pad===0||hit.pad===3),hats)
})
test('timing judge accepts simultaneous hat and snare, rejects wrong hand and duplicate hits',()=>{
  const pattern=drumLessonPattern(2),matched=new Set()
  const hat=matchDrumHit(pattern,3,1.08,matched)
  assert.ok(hat>=0);matched.add(hat)
  const snare=matchDrumHit(pattern,2,1.08,matched)
  assert.ok(snare>=0);matched.add(snare)
  assert.equal(matchDrumHit(pattern,3,1.08,matched),-1)
  assert.equal(matchDrumHit(pattern,0,1.08,matched),-1)
  assert.equal(matchDrumHit(pattern,6,1.08,matched),-1)
})
