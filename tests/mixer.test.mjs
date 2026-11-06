import test from 'node:test'
import assert from 'node:assert/strict'
import { createPartMixer } from '../dist/groove.js'

test('mute and multiple solos combine while preserving normal part levels', () => {
  const levels = [0.35, 0.5, 0.4, 0.4]
  const actual = [...levels]
  const mixer = createPartMixer(levels.map((volume, index) => ({ volume, part: { setVolume: value => { actual[index] = value } } })))
  mixer.toggleMute(1)
  assert.deepEqual(actual, [0.35, 0, 0.4, 0.4])
  mixer.toggleSolo(0)
  assert.deepEqual(actual, [0.35, 0, 0, 0])
  mixer.toggleSolo(2)
  assert.deepEqual(actual, [0.35, 0, 0.4, 0])
  mixer.toggleMute(0)
  assert.deepEqual(actual, [0, 0, 0.4, 0])
  mixer.toggleSolo(0)
  mixer.toggleSolo(2)
  assert.deepEqual(actual, [0, 0, 0.4, 0.4])
  mixer.toggleMute(0)
  mixer.toggleMute(1)
  assert.deepEqual(actual, levels)
})

test('hidden colour bank shares solos and preserves all eight part levels', () => {
  const levels = [.35,.5,.4,.4,.24,.24,.24,.24]
  const actual = [...levels]
  const mixer = createPartMixer(levels.map((volume,index) => ({volume,part:{setVolume:value=>{actual[index]=value}}})))
  mixer.toggleSolo(6)
  assert.deepEqual(actual, [0,0,0,0,0,0,.24,0])
  mixer.setVolume(0,.6)
  assert.equal(actual[0],0)
  mixer.toggleSolo(0)
  assert.deepEqual(actual,[.6,0,0,0,0,0,.24,0])
  mixer.toggleSolo(6); mixer.toggleSolo(0)
  assert.deepEqual(actual,[.6,.5,.4,.4,.24,.24,.24,.24])
})
