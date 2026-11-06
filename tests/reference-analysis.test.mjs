import test from 'node:test'
import assert from 'node:assert/strict'
import {estimateMajorKey, rankProgressions} from '../dist/reference-analysis.js'
import {createReferenceAnalyzer} from '../dist/reference-analysis-client.js'

test('precomputed spectral kernels preserve characterized key and progression scores', () => {
  const rate = 22050
  const samples = Float32Array.from({length:rate*16}, (_,i) => .2*Math.sin(2*Math.PI*261.6256*i/rate)+.1*Math.sin(2*Math.PI*329.6276*i/rate))
  assert.equal(estimateMajorKey(samples, rate), 'C')
  const ranked = rankProgressions(samples, rate, 120, 0)
  assert.deepEqual(ranked.map(item => item.id), ['six-funk','slow-motion','night-bounce'])
  assert.ok(Math.abs(ranked[0].score - 2.955007231933613) < 1e-12)
  assert.equal(estimateMajorKey(new Float32Array(rate*4),rate), null)
  assert.deepEqual(rankProgressions(new Float32Array(rate*16),rate,120,0), [])
})

test('analysis worker loads on demand, transfers PCM, ignores stale messages and releases cancelled work', async () => {
  const workers = []
  const analyzer = createReferenceAnalyzer(() => {
    const worker = {postMessage(message, transfers) {this.message=message; this.transfers=transfers}, terminate() {this.terminated=true}}
    workers.push(worker)
    return worker
  })
  assert.equal(workers.length, 0)
  const samples = new Float32Array(8)
  const request = {kind:'tempo',samples,rate:8000,bpm:120,key:0}
  const first = analyzer.analyze(request)
  const worker = workers[0]
  assert.equal(worker.transfers[0], samples.buffer)
  worker.onmessage({data:{id:worker.message.id,result:{bpm:120}}})
  assert.deepEqual(await first,{bpm:120})
  const cancelled = analyzer.analyze(request)
  const rejection = assert.rejects(cancelled, {name:'AbortError'})
  analyzer.cancel()
  await rejection
  assert.equal(worker.terminated, true)
  const next = analyzer.analyze(request)
  worker.onmessage({data:{id:worker.message.id,result:{bpm:80}}})
  const current = workers[1]
  current.onmessage({data:{id:current.message.id,result:{bpm:130}}})
  assert.deepEqual(await next,{bpm:130})
  analyzer.cancel()
})

test('worker failures reject with an actionable error and permit retry', async () => {
  const workers = []
  const analyzer = createReferenceAnalyzer(() => {
    const worker = {postMessage() {}, terminate() {}}
    workers.push(worker)
    return worker
  })
  const request = {kind:'tempo',samples:new Float32Array(8),rate:8000,bpm:120,key:0}
  const failed = analyzer.analyze(request)
  const rejected = assert.rejects(failed, /worker failed/)
  workers[0].onerror()
  await rejected
  const retried = analyzer.analyze(request)
  const cancelled = assert.rejects(retried, {name:'AbortError'})
  assert.equal(workers.length, 2)
  analyzer.cancel()
  await cancelled
})
