import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { JSDOM } from 'jsdom'
import { mountReferencePlayer } from '../dist/reference-player.js'

const flush = () => new Promise(resolve => setImmediate(resolve))
function deferred() {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return {promise,resolve}
}
const audio = {duration:2}
function setup(t, runAnalysis, decodeAudioData = async () => audio) {
  const {window} = new JSDOM(readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8'))
  for (const [name,value] of Object.entries({
    window, document:window.document, Event:window.Event, CustomEvent:window.CustomEvent,
    Element:window.Element, AbortController:window.AbortController,
    requestAnimationFrame:() => 1, cancelAnimationFrame:() => {},
  })) {
    const original = Object.getOwnPropertyDescriptor(globalThis,name)
    Object.defineProperty(globalThis,name,{configurable:true,writable:true,value})
    t.after(() => original ? Object.defineProperty(globalThis,name,original) : delete globalThis[name])
  }
  t.after(() => window.close())
  // These controls are normally mounted before the player.
  for (const [id,tag] of [['ref-file','input'],['tempo','input'],['key','select']]) {
    if (window.document.getElementById(id)) continue
    const control = window.document.createElement(tag)
    control.id = id
    window.document.body.append(control)
  }
  window.document.querySelector('#reference-crop').close = () => {}
  const state = {stemEnabled:[true,true,true,true],playing:false}
  const starts = [], stops = [], applied = []
  const context = {
    currentTime:0, decodeAudioData,
    createGain:() => ({gain:{value:0},connect(){},disconnect(){}}),
    createAnalyser:() => ({connect(){},getFloatTimeDomainData(values){values.fill(0)}}),
    createBufferSource:() => ({connect(){},disconnect(){},start(at,offset){starts.push([at,offset])},stop(){stops.push(1)}}),
  }
  const player = mountReferencePlayer(state, async result => applied.push(result), undefined,
    {getContext:() => context,runAnalysis,stemEnabled:true})
  function load(name) {
    const input = document.querySelector('#ref-file')
    Object.defineProperty(input,'files',{configurable:true,value:[{name,size:8,arrayBuffer:async () => new ArrayBuffer(8)}]})
    input.dispatchEvent(new Event('change'))
  }
  return {player,state,load,starts,stops,applied}
}

test('replacement supersedes an unfinished decode without clearing the new import', async t => {
  const first = deferred(), second = deferred()
  let calls = 0
  const {load,state} = setup(t,async () => ({}), () => (++calls === 1 ? first.promise : second.promise))
  load('old.wav')
  await flush()
  load('new.wav')
  await flush()
  first.resolve(audio)
  await flush()
  assert.equal(state.importing,true)
  assert.equal(state.filename,undefined)
  second.resolve(audio)
  await flush()
  assert.equal(state.filename,'new.wav')
  assert.equal(state.importing,false)
})

test('cancel keeps the original playable and late analysis cannot publish after removal', async t => {
  const work = deferred()
  let request
  const {load,player,state,starts,stops,applied} = setup(t,async (_,options) => {
    request = options
    await work.promise
    options.signal.throwIfAborted()
    await options.onAnalyzed({bpm:100,key:2})
    return {}
  })
  load('song.wav')
  await flush()
  player.cancelImport()
  assert.equal(request.signal.aborted,true)
  assert.equal(state.filename,'song.wav')
  player.startWithAccompaniment(1,0,0)
  assert.deepEqual(starts,[[1,0]])
  player.remove()
  work.resolve()
  await flush()
  assert.equal(state.filename,'')
  assert.equal(state.playing,false)
  assert.equal(state.importing,false)
  assert.deepEqual(applied,[])
  assert.equal(stops.length,1)
})

test('stems finishing during playback become active at stop, with the same timing offset', async t => {
  const stems = deferred()
  const {load,player,state,starts} = setup(t,(_,options) => options.skipStems ? Promise.resolve({}) : stems.promise)
  load('song.wav')
  await flush()
  player.setTiming(0,.25)
  player.startWithAccompaniment(1,0,0)
  const separation = player.separateStems()
  stems.resolve({sections:[{start:0,end:2,stemStart:0,stems:Array(4).fill(audio)}]})
  await separation
  assert.equal(state.stemsReady,false)
  assert.deepEqual(starts,[[1,.25]])
  player.stopWithAccompaniment()
  assert.equal(state.stemsReady,true)
  player.startWithAccompaniment(2,0,0)
  assert.deepEqual(starts.slice(1),Array.from({length:5},() => [2,.25]))
  player.stopWithAccompaniment()
})

test('removing the original in the loaded event prevents analysis from starting', async t => {
  let analyzed = false
  const {load,player,state} = setup(t,async () => { analyzed = true; return {} })
  document.addEventListener('reference-loaded', () => player.remove(), {once:true})
  load('song.wav')
  await flush()
  assert.equal(analyzed,false)
  assert.equal(state.filename,'')
  assert.equal(state.importing,false)
})
