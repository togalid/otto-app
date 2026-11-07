import test from 'node:test'
import assert from 'node:assert/strict'
import { OrnamentPlayer } from '../dist/ornament-audio.js'
import { Instrument } from '../dist/audio.js'
import { Progression } from '../dist/progression.js'
import { swungBassBeat } from '../dist/groove.js'
import { chordNotes } from '../dist/music.js'

function nativeFixture() {
  const sources = [], nodes = [], parameters = []
  const param = () => ({ value: 0,
    setValueAtTime(...args) { parameters.push(['set', ...args]) },
    setTargetAtTime(...args) { parameters.push(['target', ...args]) },
    exponentialRampToValueAtTime(...args) { parameters.push(['exp', ...args]) },
    linearRampToValueAtTime(...args) { parameters.push(['linear', ...args]) },
  })
  const node = () => {
    const value = { gain: param(), frequency: param(), Q: param(), connections: [], disconnected: false,
      connect(destination) { this.connections.push(destination); return destination },
      disconnect() { this.disconnected = true },
    }
    nodes.push(value)
    return value
  }
  const source = () => {
    const value = Object.assign(node(), { starts: [], stops: [], onended: null,
      start(time) { this.starts.push(time) }, stop(time) { this.stops.push(time) },
    })
    sources.push(value)
    return value
  }
  const reference = new Instrument()
  reference.context = { currentTime: 1, sampleRate: 100, destination: {}, createAnalyser: () => ({ connect() {} }),
    createGain: node, createBiquadFilter: node, createBufferSource: source, createOscillator: source,
    createBuffer: (_, length) => ({ getChannelData: () => new Float32Array(length) }),
  }
  reference.ready = async () => {}
  return {reference,sources,nodes,parameters}
}

test('native crash/reverse own their nodes, support mute, and cancel future sound on stop', async () => {
  const {reference,sources,nodes,parameters} = nativeFixture()
  const fx = new OrnamentPlayer('fx', reference)
  await fx.ready()
  fx.schedule({beat:2,duration:2,notes:[],level:.62,sound:'reverse'}, 5, 1)
  assert.equal(sources.length,5)
  assert.ok(sources.every(source => source.starts[0] === 5 && source.stops[0] === 6.002))
  assert.ok(parameters.some(call => call[0] === 'exp' && call[1] === .62 && call[2] === 5.988))
  fx.setVolume(0)
  assert.ok(parameters.some(call => call[0] === 'target' && call[1] === 0))
  fx.silence()
  assert.equal(fx.active.size,0)
  assert.ok(sources.every(source => source.stops.length === 2 && source.stops[1] === undefined))
  assert.ok(nodes.every(node => node.disconnected))
  assert.equal(fx.fxMaster,undefined)
})

test('naturally completed effects disconnect resources and noise has no metallic oscillator bank', async () => {
  const {reference,sources,nodes} = nativeFixture()
  const fx = new OrnamentPlayer('fx',reference)
  fx.setTimbre('noise')
  await fx.ready()
  fx.schedule({beat:0,duration:2,notes:[],level:.5,sound:'crash'},2,1)
  assert.equal(sources.length,1)
  sources[0].onended()
  assert.equal(fx.active.size,0)
  assert.ok(nodes.filter(node=>node!==fx.fxMaster).every(node=>node.disconnected))
  fx.silence()
  assert.ok(nodes.every(node=>node.disconnected))
})

test('pitched ornaments use their own voice and validate the timbre catalog', () => {
  const part = new OrnamentPlayer('bell',new Instrument())
  const calls = []
  part.instrument.playAt = (...args) => calls.push(args)
  part.schedule({beat:2,duration:.5,notes:[84],level:.6},3,.25)
  assert.deepEqual(calls,[[[84],3,.25,.6]])
  assert.equal(part.instrument.timbre,'bell')
  part.setTimbre('mallet')
  assert.equal(part.instrument.timbre,'mallet')
  assert.throws(()=>part.setTimbre('piano'),RangeError)
  assert.throws(()=>new OrnamentPlayer('missing',new Instrument()),RangeError)
  part.setVolume(Infinity)
  assert.equal(part.volume,0)
})

function playerFixture() {
  const scheduled = []
  let ready = 0, stopped = 0
  const instrument = { context: {currentTime:0,state:'running'}, ready:async()=>{}, silence(){}, playAt(){} }
  const player = new Progression(instrument,()=>{},message=>assert.fail(message))
  player.bpm = 120
  player.swing = 60
  player.ornaments = [{ id:'pluck',pattern:'pluck-sync',voice:{ready:async()=>{ready++},silence(){stopped++},schedule(...args){scheduled.push(args)}} }]
  return {player,instrument,scheduled,count:()=>({ready,stopped})}
}

test('ornaments share transport time and swing both note endpoints, with their own readiness and stop', async () => {
  const {player,scheduled,count} = playerFixture()
  try {
    await player.start()
    assert.equal(count().ready,1)
    const [event,time,seconds] = scheduled[0]
    const start = swungBassBeat(event.beat*2,60)
    const end = swungBassBeat((event.beat+event.duration)*2,60)
    assert.equal(time,.05+start*.5)
    assert.ok(Math.abs(seconds-(end-start)*.5)<1e-9)
  } finally {player.stop()}
  assert.equal(count().stopped,2) // start first clears previous sound, then explicit stop
})

test('starting partway through a bar skips earlier ornaments and uses the current intra-bar harmony', async () => {
  const {player,scheduled} = playerFixture()
  player.beatSlots[0][2]='x:0:maj:none:1'
  try {
    await player.start(0,2)
    assert.ok(scheduled.length > 0)
    assert.ok(scheduled.every(([event]) => swungBassBeat(event.beat*2,player.swing)>=2))
    const target = chordNotes('x:0:maj:none:1',0).map(note=>note%12)
    assert.ok(scheduled.every(([event]) => event.notes.every(note=>target.includes(note%12))))
    assert.ok(scheduled.every(([,time]) => time>=.05))
  } finally {player.stop()}
})

test('an ornament readiness failure stops the transport and cancels all part owners', async () => {
  const {player,count} = playerFixture()
  const errors=[]
  player.onError=message=>errors.push(message)
  player.ornaments[0].voice.ready=async()=>{throw new Error('sound unavailable')}
  await player.start()
  assert.equal(player.running,false)
  assert.equal(player.timer,undefined)
  assert.deepEqual(errors,['sound unavailable'])
  assert.equal(count().stopped,2)
})
