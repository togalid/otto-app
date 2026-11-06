import test from 'node:test'
import assert from 'node:assert/strict'
import { genres } from '../dist/groove.js'
import { ottoStyleFor, ottoStyleIds } from '../dist/otto-style.js'
import { swungBassBeat } from '../dist/groove.js'

test('every style has a bounded immutable two-bar monophonic personality', () => {
  assert.deepEqual([...ottoStyleIds].sort(),genres.map(genre => genre.id).sort())
  const profiles = new Set()
  for (const genre of genres) {
    const profile = ottoStyleFor(genre.id)
    profiles.add(profile.id)
    assert.ok(Object.isFrozen(profile))
    assert.ok(Object.isFrozen(profile.invitation))
    assert.ok(profile.register >= 60 && profile.register <= 76)
    assert.ok(profile.gate >= .65 && profile.gate <= 1)
    assert.ok(profile.tensionBias >= 0 && profile.tensionBias <= 1)
    assert.ok(profile.motion >= .7 && profile.motion <= 1.2)
    let end = 0
    for (const note of profile.invitation) {
      assert.ok(Object.isFrozen(note))
      assert.ok(Number.isInteger(note.step) && note.step >= 0 && note.step <= 7)
      assert.ok(note.at >= end && note.at >= 0 && note.at < 8,genre.id)
      assert.ok(note.duration > 0 && note.at + note.duration <= 8)
      assert.equal(note.at * 4,Math.round(note.at * 4))
      assert.equal(note.duration * 4,Math.round(note.duration * 4))
      end = note.at + note.duration
    }
  }
  assert.equal(profiles.size,9)
})

test('explicit style choices contrast at similar tempos and preserve lyrical versus rhythmic habits', () => {
  assert.equal(ottoStyleFor('jpop_ballad').id,'lyrical')
  assert.equal(ottoStyleFor('game_calm').id,'float')
  assert.equal(ottoStyleFor('parade_trance').id,'pulse')
  assert.equal(ottoStyleFor('game_battle').id,'hero')
  assert.equal(ottoStyleFor('alley').id,'jazz')
  assert.equal(ottoStyleFor('vocal_theatre').id,'playful')
  assert.equal(ottoStyleFor('night_soul').id,'groove')
  assert.notEqual(ottoStyleFor('piano_switch').id,ottoStyleFor('vt_prism').id)
  const lyrical = ottoStyleFor('vt_letter'), groove = ottoStyleFor('glove')
  const mean = profile => profile.invitation.reduce((sum,note) => sum + note.duration,0) / profile.invitation.length
  assert.ok(mean(lyrical) > mean(groove))
  assert.ok(lyrical.gate > groove.gate)
  assert.ok(ottoStyleFor('alley').tensionBias > lyrical.tensionBias)
  assert.ok(ottoStyleFor('game_battle').register > ottoStyleFor('alley').register)
  assert.ok(groove.invitation.filter(note => note.at % 1 !== 0).length >= 5)
})

test('all templates remain ordered and within two bars after shared swing and gating', () => {
  for (const genre of genres) for (const swing of [0,38,100]) {
    const profile = ottoStyleFor(genre.id)
    let end = 0
    for (const note of profile.invitation) {
      const onset = swungBassBeat(note.at*2,swing)
      const release = swungBassBeat((note.at+note.duration)*2,swing)
      assert.ok(onset >= end - 1e-9)
      assert.ok(release > onset && release <= 8)
      end = onset + (release-onset)*profile.gate
    }
  }
})

test('lookup has deterministic backwards-compatible fallback and rejects inherited record keys', () => {
  const fallback = ottoStyleFor('unknown-old-style')
  assert.equal(fallback.id,'pop')
  assert.equal(ottoStyleFor('toString'),fallback)
  assert.equal(ottoStyleFor('__proto__'),fallback)
  assert.equal(ottoStyleFor('glove'),ottoStyleFor('glove'))
})

test('K-pop styles have distinct rhythmic motifs while retaining their shared groove', () => {
  const ids = ['kpop_dance','kpop_rnb','kpop_bright','kpop_mellow']
  const motifs = ids.map(id=>ottoStyleFor(id).invitation.map(note=>note.at).join(','))
  assert.equal(new Set(motifs).size,ids.length)
})
