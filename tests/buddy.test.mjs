import test from 'node:test'
import assert from 'node:assert/strict'
import { grooveGrid, echoPhrase, conversationScore, conversationTurn } from '../dist/buddy.js'
import { swungBassBeat } from '../dist/groove.js'
import { Progression } from '../dist/progression.js'
import { Instrument } from '../dist/audio.js'
test('echo grid exactly shares accompaniment swing, including sixteenths', () => {
  for (const swing of [0, 20, 100]) {
    for (let i = 0; i <= 32; i++) {
      const beat = swungBassBeat(i / 2, swing)
      assert.equal(grooveGrid(beat + 0.01, swing), beat)
    }
  }
})
test('echo preserves pitches, rests, held lengths and close attacks without pushing notes', () => {
  const phrase = [{step:2,at:0.03,duration:1.95},{step:4,at:3.02,duration:.4},{step:5,at:3.04,duration:.4}]
  const reply = echoPhrase(phrase, 0)
  assert.deepEqual(reply.map(n => n.step), [2,4,5])
  assert.deepEqual(reply.map(n => n.at), [0,3,3])
  assert.equal(reply[0].duration, 2)
  assert.equal(phrase[0].at, .03)
  assert.deepEqual(echoPhrase([], 0), [])
})
test('late and held notes stay inside the two-bar response', () => {
  const reply = echoPhrase([{step:0,at:7.99,duration:4}], 100)[0]
  assert.ok(reply.at < 8)
  assert.ok(reply.at + reply.duration <= 8)
})
test('conversation preserves eight bars, beat changes and local keys without duplication', () => {
  const source = new Progression(new Instrument(), () => {}, () => {})
  source.key = 2
  source.modulation = [0, 3, -1, 2]
  source.beatSlots[1][2] = 'G7'
  const score = conversationScore(source)
  assert.equal(score.length, 8)
  assert.deepEqual(score.map(bar => bar.chord), source.slots)
  assert.equal(score[1].changes[2], 'G7')
  score[1].changes[2] = 'C'
  assert.equal(source.beatSlots[1][2], 'G7')
  assert.equal(score[2].key, 5)
})
test('two-bar turns alternate through eight bars and across loop boundaries in either order', () => {
  assert.deepEqual([0,8,16,24,32].map(beat => conversationTurn(beat,true).pc), [true,false,true,false,true])
  assert.deepEqual([0,8,16,24,32].map(beat => conversationTurn(beat,false).pc), [false,true,false,true,false])
  assert.equal(conversationTurn(31.9,true).bar, 8)
  assert.equal(conversationTurn(32,true).bar, 1)
  assert.equal(conversationTurn(11,true).local, 3)
})

test('future transport start keeps the backing silent until after the count-in and stop clears it', async () => {
  const instrument = new Instrument()
  instrument.context = {currentTime:10,state:'running'}
  instrument.ready = async () => {}
  instrument.silence = () => {}
  let attacks = 0
  instrument.playAt = () => { attacks++ }
  const transport = new Progression(instrument, () => {}, () => {})
  await transport.start(0, 0, 12.4)
  assert.equal(transport.nextTime, 12.4)
  assert.equal(attacks, 0)
  assert.ok(transport.timer)
  transport.stop()
  assert.equal(transport.timer, undefined)
  assert.equal(transport.running, false)
})

test('solo options keep ownership for the full progression and following loops', () => {
  for (const beat of [0, 7.99, 8, 16, 24, 32, 64]) {
    assert.equal(conversationTurn(beat, 'all-pc').pc, true)
    assert.equal(conversationTurn(beat, 'all-you').pc, false)
  }
  assert.equal(conversationTurn(0, 'pc').pc, true)
  assert.equal(conversationTurn(8, 'pc').pc, false)
  assert.equal(conversationTurn(0, 'you').pc, false)
  assert.equal(conversationTurn(8, 'you').pc, true)
})

test('echo retains captured MIDI rather than replacing pitches with a fixed C scale', () => {
  const input = [{step:0,midi:63,at:.02,duration:.45}, {step:2,midi:67,at:1.02,duration:1}]
  const reply = echoPhrase(input, 20)
  assert.deepEqual(reply.map(note => note.midi), [63,67])
  assert.deepEqual(reply.map(note => note.step), [0,2])
  assert.notEqual(reply[0], input[0])
  assert.equal(input[0].at, .02)
})

test('Otto plays a harmonic invitation even when the human leaves silence', async () => {
  const {ottoReply} = await import('../dist/buddy.js')
  const {melodyPalette} = await import('../dist/music.js')
  const paletteAt = () => melodyPalette(2, 'FM7', 2, 'key')
  const reply = ottoReply([], paletteAt, 20)
  assert.ok(reply.length >= 6)
  assert.ok(reply.every(n => n.midi !== undefined && n.at >= 0 && n.at + n.duration <= 8))
  assert.ok(reply.every(n => paletteAt().some(p => p.midi === n.midi)))
})
test('Otto keeps safe input pitches and rests without forced tension fills', async () => {
  const {ottoReply} = await import('../dist/buddy.js')
  const {melodyPalette} = await import('../dist/music.js')
  const phrase = [{step:0,midi:60,at:0,duration:.5},{step:2,midi:64,at:1,duration:.5}]
  const result = ottoReply(phrase,()=>melodyPalette(0,'FM7',0,'key'),0)
  assert.deepEqual(result.map(n=>n.midi),[60,64])
  assert.deepEqual(result.map(n=>n.at),[0,1])
  assert.deepEqual(result.map(n=>n.duration),[.5,.5])
})

test('Otto replies remain bounded across transposition, borrowed chords and dense input', async () => {
  const {ottoReply} = await import('../dist/buddy.js')
  const {melodyPalette} = await import('../dist/music.js')
  for (const key of [0,2,7]) for (const chord of ['G7','Dm7','x:2:maj:b9_b13:0','x:3:min:6:0']) {
    const paletteAt = () => melodyPalette(key,chord,(key+3)%12,'key')
    const phrase = Array.from({length:32},(_,i) => ({step:i%8,midi:paletteAt()[i%8].midi,at:i/4,duration:.25}))
    const result = ottoReply(phrase,paletteAt,60)
    assert.equal(result.filter(n => n.kind === 'quote').length,32)
    assert.ok(result.every(n => Number.isFinite(n.midi) && n.duration > 0 && n.at+n.duration <= 8))
  }
})

test('singing motion prefers neighbors without forcing leaps after a run', async () => {
  const {melodicMotionCost,ottoReply} = await import('../dist/buddy.js')
  const {melodyPalette} = await import('../dist/music.js')
  assert.ok(melodicMotionCost([60,67],65)<melodicMotionCost([60,67],72))
  assert.ok(melodicMotionCost([60,62,64,65],67)<melodicMotionCost([60,62,64,65],69))
  const line=ottoReply([],()=>melodyPalette(0,'FM7',0,'chord'),0)
  assert.ok(line.some(n=>n.duration>=1))
  assert.ok(line.every((n,i)=>!i || Math.abs(n.midi-line[i-1].midi)<=5))
})

test('Otto replaces quoted avoid tones while keeping safe tones and rhythm', async () => {
  const {ottoReply} = await import('../dist/buddy.js')
  const {melodyPalette,melodyRole} = await import('../dist/music.js')
  const base = melodyPalette(0,'C',0,'key')[0]
  const palette = () => Array.from({length:37},(_,i)=>({...base,midi:48+i,...melodyRole(48+i,'C',0)}))
  const reply = ottoReply([{step:0,midi:65,at:0,duration:2},{step:1,midi:64,at:3,duration:1}],palette,0)
  const quote = reply.filter(n=>n.kind==='quote')
  assert.equal(quote[0].at,0)
  assert.equal(quote[0].duration,2)
  assert.equal(melodyRole(quote[0].midi,'C',0).clash,false)
  assert.equal(quote[1].midi,64)
  assert.ok(reply.every(n=>!melodyRole(n.midi,'C',0).clash))
})

test('held reply notes stop exactly before an avoid harmony', async () => {
  const {ottoReply} = await import('../dist/buddy.js')
  const {melodyPalette,melodyRole} = await import('../dist/music.js')
  const base = melodyPalette(0,'C',0,'key')[0]
  for (const bpm of [60,100,200]) {
    // F is a chord tone over F, then an avoid 11 over C.
    const palette = beat => Array.from({length:37},(_,i)=>({...base,midi:48+i,...melodyRole(48+i,beat<1?'F':'C',0)}))
    const reply = ottoReply([{step:0,midi:65,at:0,duration:4}],palette,0,bpm)
    const quote = reply.find(n=>n.kind==='quote')
    assert.equal(quote.midi,65)
    assert.equal(quote.duration,1)
    assert.ok((quote.duration-1)*60/bpm <= .06 + 1e-9)
  }
})

test('Otto style changes solo rhythm while preserving quoted safe pitches', async () => {
  const {ottoReply} = await import('../dist/buddy.js')
  const {ottoStyleFor} = await import('../dist/otto-style.js')
  const {melodyPalette,melodyRole} = await import('../dist/music.js')
  const base = melodyPalette(0,'C',0,'chord')[0]
  const palette = () => Array.from({length:25},(_,i)=>({...base,midi:60+i,...melodyRole(60+i,'C',0)}))
  const styles = ['clear_letter','edm_voyage','vocal_chip'].map(ottoStyleFor)
  const replies = styles.map(style=>ottoReply([],palette,0,120,style))
  assert.notDeepEqual(replies[0].map(n=>n.at),replies[1].map(n=>n.at))
  for (const style of styles) {
    const reply=ottoReply([{step:0,midi:64,at:0,duration:1}],palette,0,120,style)
    assert.equal(reply.find(n=>n.kind==='quote').midi,64)
    assert.ok(reply.every(n=>n.duration>0 && n.at+n.duration<=8.001 && !melodyRole(n.midi,'C',0).clash))
  }
})

test('generated jazz offbeats follow swing grid rather than rounding early', async () => {
  const {ottoReply} = await import('../dist/buddy.js')
  const {ottoStyleFor} = await import('../dist/otto-style.js')
  const {melodyPalette} = await import('../dist/music.js')
  const style = ottoStyleFor('jazz')
  const result = ottoReply([],()=>melodyPalette(0,'C',0,'chord'),100,120,style).filter(n=>n.kind==='quote')
  for (let i=0;i<style.invitation.length;i++) assert.ok(Math.abs(result[i].at-swungBassBeat(style.invitation[i].at*2,100))<1e-9)
})
test('Otto alternates every two physical bars in triple and quintuple meter', () => {
  for (const meter of [3, 5]) {
    const span = meter * 2
    assert.equal(conversationTurn(span - .01, 'pc', meter).pc, true)
    assert.equal(conversationTurn(span, 'pc', meter).pc, false)
    assert.equal(conversationTurn(span, 'pc', meter).bar, 3)
    assert.equal(conversationTurn(span, 'pc', meter).local, 0)
    assert.equal(conversationTurn(meter * 8, 'pc', meter).bar, 1)
  }
})
