import test from 'node:test'
import assert from 'node:assert/strict'
import { rhythmPatterns, DrumSynth } from '../dist/rhythm.js'
import { Progression } from '../dist/progression.js'

test('rhythm presets stay inside a four-beat bar and off is silent', () => {
  assert.equal(
    rhythmPatterns.find((pattern) => pattern.id === 'off').hits.length,
    0,
  )
  for (const pattern of rhythmPatterns) {
    for (const hit of pattern.hits) {
      assert.ok(Number.isInteger(hit.pulse * 2) && hit.pulse >= 0 && hit.pulse < 8)
      assert.ok(['kick', 'snare', 'hat'].includes(hit.sound))
    }
  }
})
test('eight beat has an accented backbeat and alternating hi-hat dynamics', () => {
  const hits = rhythmPatterns.find((pattern) => pattern.id === 'eight').hits
  const snare = hits.filter((hit) => hit.sound === 'snare')
  const hats = hits.filter((hit) => hit.sound === 'hat')
  const kicks = hits.filter((hit) => hit.sound === 'kick')
  assert.deepEqual(snare.map((hit) => hit.pulse), [2, 6])
  assert.equal(hats.length, 8)
  assert.ok(kicks[1].velocity < kicks[2].velocity)
  for (let i = 0; i < hats.length; i += 2) {
    assert.ok(hats[i].velocity >= hats[i + 1].velocity * 2)
    assert.ok(hats[i].duration > hats[i + 1].duration)
  }
  assert.ok(snare.every((hit) => hit.velocity > Math.max(...hats.map((hat) => hat.velocity))))
})
test('other drum grooves have accented hits and contrasting hi-hat lengths', () => {
  for (const id of ['jazz', 'four', 'half']) {
    const hits = rhythmPatterns.find(pattern => pattern.id === id).hits
    const hats = hits.filter(hit => hit.sound === 'hat')
    assert.ok(new Set(hats.map(hit => hit.velocity)).size > 1, id)
    assert.ok(new Set(hats.map(hit => hit.duration)).size > 1, id)
    assert.ok(hits.filter(hit => hit.sound === 'kick').every(hit => hit.velocity > 0), id)
  }
})
test('drum library groups distinct rhythms and uses sixteenth accents', () => {
  for (const group of ['8ビート', '16ビート', 'ダンス・四つ打ち', 'ハーフタイム・ゆったり'])
    assert.ok(rhythmPatterns.filter(pattern => pattern.group === group).length >= 3, group)
  for (const pattern of rhythmPatterns.filter(pattern => pattern.group === '16ビート')) {
    assert.ok(pattern.hits.some(hit => hit.sound !== 'hat' && !Number.isInteger(hit.pulse)), pattern.id)
    assert.ok(new Set(pattern.hits.filter(hit => hit.sound === 'hat').map(hit => hit.velocity)).size >= 3, pattern.id)
  }
  for (const pattern of rhythmPatterns) {
    for (const sound of ['kick', 'snare', 'hat']) {
      const pulses = pattern.hits.filter(hit => hit.sound === sound).map(hit => hit.pulse)
      assert.ok(pulses.every((pulse, index) => index === 0 || pulse > pulses[index - 1]), `${pattern.id}: ${sound}`)
    }
  }
})
test('sixteenth drum hits stay synchronized with swing and tempo', async () => {
  const hits = []
  const instrument = { context: { currentTime: 0, state: 'running' }, ready: async () => {}, silence() {}, playAt() {} }
  const drums = { hitAt: (...args) => hits.push(args), silence() {} }
  const player = new Progression(instrument, () => {}, assert.fail, drums)
  player.rhythm = 'sixteen_funk'
  player.swing = 100
  player.bpm = 120
  await player.start()
  clearInterval(player.timer)
  assert.ok(hits.some(hit => hit[0] === 'kick' && Math.abs(hit[1] - (0.05 + 0.5 * (5 / 6))) < 1e-9))
  assert.ok(hits.every(hit => hit[1] >= 0.05 && hit[1] < 2.05))
  player.stop()
})
test('chords and rhythm share their start and bar duration, including tempo changes', async () => {
  const chords = [],
    hits = []
  let silenced = 0
  const instrument = {
    context: { currentTime: 0, state: 'running' },
    ready: async () => {},
    silence() {},
    playAt(...args) {
      chords.push(args)
    },
  }
  const drums = {
    hitAt(...args) {
      hits.push(args)
    },
    silence() {
      silenced++
    },
  }
  const player = new Progression(instrument, () => {}, assert.fail, drums)
  await player.start()
  clearInterval(player.timer)
  const pattern = rhythmPatterns.find((pattern) => pattern.id === 'eight')
  assert.equal(hits[0][1], chords[0][1])
  assert.equal(hits.length, pattern.hits.length)
  pattern.hits.forEach((hit, index) => {
    assert.equal(hits[index][1], 0.05 + (hit.pulse * 2.4) / 8)
    assert.equal(hits[index][2], hit.velocity)
    assert.equal(hits[index][3], hit.duration)
  })
  player.bpm = 120
  instrument.context.currentTime = 2.45
  player.tick()
  pattern.hits.forEach((hit, index) =>
    assert.equal(
      hits[pattern.hits.length + index][1],
      chords[1][1] + (hit.pulse * 2) / 8,
    ),
  )
  const before = hits.length
  player.rhythm = 'off'
  instrument.context.currentTime = 4.45
  player.tick()
  assert.equal(hits.length, before)
  assert.equal(chords.length, 3)
  player.stop()
  assert.equal(silenced, 2) // start clears prior transport, stop clears queued hits
  assert.equal(player.timer, undefined)
})
test('drum volume is bounded and does not require starting audio', () => {
  const synth = new DrumSynth({})
  synth.setVolume(10)
  assert.equal(synth.volume, 1)
  synth.setVolume(-1)
  assert.equal(synth.volume, 0)
  synth.hitAt('kick', 0)
  synth.silence()
  assert.equal(synth.volume, 0)
})
