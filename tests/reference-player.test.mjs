import test from 'node:test'
import assert from 'node:assert/strict'
import { loopPosition } from '../dist/reference-player.js'
test('reference loop preserves intro until the end and wraps exactly at boundary', () => {
  assert.equal(loopPosition(0, 9, 10, 18), 9)
  assert.equal(loopPosition(10, 8, 10, 18), 10)
  assert.equal(loopPosition(12, 23, 10, 18), 11)
  assert.equal(loopPosition(12, 0, 10, 18), 12)
})

import { estimateBpm } from '../dist/reference-player.js'
test('tempo estimator finds steady 120 BPM pulses and rejects silence and short input', () => {
  const rate = 8000
  const samples = new Float32Array(rate * 20)
  for (let beat = 0; beat < 40; beat++) {
    for (let i = 0; i < 300; i++) samples[beat * 4000 + i] = Math.sin(i * .4) * Math.exp(-i / 60)
  }
  assert.ok(Math.abs(estimateBpm(samples, rate) - 120) < 1)
  assert.equal(estimateBpm(new Float32Array(rate * 10), rate), null)
  assert.equal(estimateBpm(samples.subarray(0, rate), rate), null)
})

import { analyzeSharedReference } from '../dist/reference-player.js'
function fakeAudio(channels, length, sampleRate) {
  const data = Array.from({length:channels}, () => new Float32Array(length))
  return {numberOfChannels:channels, length, sampleRate, duration:length / sampleRate, getChannelData:channel=>data[channel]}
}
const scoresFor = key => Array.from({length:12}, (_, i) => i === key ? 5 : 1)
test('full-length stems share one source across A–D and preserve chunk sample positions', async () => {
  const audio = fakeAudio(1, 910, 10)
  const ranges = []
  const requests = []
  const signal = new AbortController().signal
  const result = await analyzeSharedReference(audio, {
    signal, bpm:128, key:0, progress:()=>{}, createBuffer:fakeAudio,
    analyze:async request => {
      requests.push(request)
      return request.kind === 'tempo' ? {bpm:requests.length === 1 ? 122 : 120} : {keyScores:scoresFor(3)}
    },
    separate:async (_, start, end) => {
      ranges.push([start,end])
      return Array.from({length:4}, (_, index) => {
        const buffer = fakeAudio(1, Math.round((end-start)*10), 10)
        buffer.getChannelData(0).fill(index + start)
        return buffer
      })
    },
  })
  assert.deepEqual(ranges, [[0,90],[90,91]])
  assert.equal(result.bpm,120)
  assert.equal(result.key,3)
  assert.equal(result.sections.length,4)
  for (const section of result.sections) {
    assert.equal(section.start,0)
    assert.equal(section.end,91)
    assert.equal(section.stemStart,0)
    assert.equal(section.stems,result.sections[0].stems)
    assert.equal(section.stems[2].length,audio.length)
    assert.equal(section.stems[2].getChannelData(0)[899],2)
    assert.equal(section.stems[2].getChannelData(0)[900],92)
  }
  assert.deepEqual(requests.map(request=>request.kind), ['tempo','key','tempo','key'])
  assert.equal('presets' in result,false)
})
test('unmeasurable tempo/key keep the current settings', async () => {
  const audio = fakeAudio(1,40,10)
  const result = await analyzeSharedReference(audio, {
    signal:new AbortController().signal, bpm:85, key:8, progress:()=>{}, createBuffer:fakeAudio,
    analyze:async()=>({bpm:null,keyScores:null}),
    separate:async()=>Array.from({length:4},()=>fakeAudio(1,40,10)),
  })
  assert.equal(result.bpm,85)
  assert.equal(result.key,8)
})
test('cancelling separation prevents stale analysis and incomplete stem results', async () => {
  const controller = new AbortController()
  let analyses=0
  await assert.rejects(analyzeSharedReference(fakeAudio(1,40,10), {
    signal:controller.signal,bpm:120,key:0,progress:()=>{},createBuffer:fakeAudio,
    analyze:async()=>{analyses++;return {}},
    separate:async()=>{controller.abort();return []},
  }), {name:'AbortError'})
  assert.equal(analyses,2)
})

test('original analysis is available before delayed stems finish',async()=>{
 const events=[]
 let complete
 const gate=new Promise(resolve=>{complete=resolve})
 const audio=fakeAudio(1,40,10)
 const task=analyzeSharedReference(audio,{
  signal:new AbortController().signal,bpm:85,key:8,progress:()=>{},createBuffer:fakeAudio,
  analyze:async request=>request.kind==='tempo'?{bpm:120}:{keyScores:scoresFor(3)},
  onAnalyzed:async result=>{events.push(['original',result.bpm,result.key])},
  separate:async()=>{events.push(['separating']);await gate;return Array.from({length:4},()=>fakeAudio(1,40,10))},
 })
 await new Promise(resolve=>setImmediate(resolve))
 assert.deepEqual(events,[['original',120,3],['separating']])
 complete()
 const result=await task
 assert.equal(result.sections[0].stems.length,4)
})

test('cancellation after original analysis prevents separation from starting',async()=>{
 const controller=new AbortController()
 await assert.rejects(analyzeSharedReference(fakeAudio(1,40,10),{
  signal:controller.signal,bpm:120,key:0,progress:()=>{},createBuffer:fakeAudio,
  analyze:async()=>({}),onAnalyzed:async()=>controller.abort(),
  separate:async()=>assert.fail('cancelled import must not start stems'),
 }),{name:'AbortError'})
})

test('a separation error occurs after the playable original analysis is delivered',async()=>{
 let original
 await assert.rejects(analyzeSharedReference(fakeAudio(1,40,10),{
  signal:new AbortController().signal,bpm:120,key:0,progress:()=>{},createBuffer:fakeAudio,
  analyze:async()=>({}),onAnalyzed:async result=>{original=result},
  separate:async()=>{throw new Error('local separator unavailable')},
 }),/separator unavailable/)
 assert.deepEqual(original,{bpm:120,key:0})
})
