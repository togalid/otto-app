import assert from 'node:assert/strict'
import test from 'node:test'
import { decodeStudioStyle } from '../dist/studio-style.js'

test('legacy studio styles without bass retain melody and load an empty bass track', () => {
  const saved = {arrangement:'{}', melody:[{beat:-1, duration:1, midi:53}]}
  assert.deepEqual(decodeStudioStyle(JSON.stringify(saved)), {...saved, bass:[]})
})

test('studio style validation uses separate pitch ranges for melody and bass', () => {
  const note = {beat:0, duration:1, midi:28}
  const saved = {arrangement:'{}', melody:[], bass:[note]}
  assert.deepEqual(decodeStudioStyle(JSON.stringify(saved)), saved)
  assert.throws(() => decodeStudioStyle(JSON.stringify({...saved, melody:[note]})), /Invalid Studio style/)
  assert.throws(() => decodeStudioStyle(JSON.stringify({...saved, bass:[{...note, midi:61}]})), /Invalid Studio style/)
})

test('Studio accompaniment accepts old files and validates recorded pitches and pad indices', async () => {
  const {decodeStudioAccompaniment} = await import('../dist/studio-style.js')
  assert.deepEqual(decodeStudioAccompaniment(undefined), {backing:[], drums:[]})
  const notes = {backing:[{beat:4, duration:1, midi:33}], drums:[{beat:4, duration:.5, midi:7}]}
  assert.deepEqual(decodeStudioAccompaniment(JSON.parse(JSON.stringify(notes))), notes)
  const fullPickup = {...notes, drums:[{beat:-4,duration:.25,midi:0}]}
  assert.deepEqual(decodeStudioAccompaniment(JSON.parse(JSON.stringify(fullPickup))), fullPickup)
  const patterns = [[{beat:0,duration:.25,midi:0}],null,[],null]
  assert.deepEqual(decodeStudioAccompaniment({...notes, drumPatterns:patterns}).drumPatterns, patterns)
  assert.throws(() => decodeStudioAccompaniment({...notes, drumPatterns:[[{beat:4,duration:.25,midi:0}],null,null,null]}), /Invalid drum patterns/)
  assert.deepEqual(decodeStudioAccompaniment({...notes, drumAssignments:[0,1,2,3]}).drumAssignments, [0,1,2,3])
  assert.throws(() => decodeStudioAccompaniment({...notes, drumAssignments:[4]}), /Invalid drum assignments/)
  assert.throws(() => decodeStudioAccompaniment({...notes, drums:[{...notes.drums[0], midi:8}]}), /Invalid Studio accompaniment/)
})


test('drum playback resolves assigned patterns by bar and preserves legacy recordings', async () => {
  const {drumPlaybackNotes} = await import('../dist/studio-style.js')
  const original = [{beat:-1,duration:.25,midi:1},{beat:4,duration:.25,midi:3}]
  const empty = [null,null,null,null]
  assert.equal(drumPlaybackNotes([], empty, [], 4), undefined)
  assert.deepEqual(drumPlaybackNotes(original, empty, [], 4).map(n => n.beat), [-1,4])
  const patterns = [[{beat:0,duration:.25,midi:0}], [{beat:1,duration:.25,midi:2}], null, []]
  const played = drumPlaybackNotes(original, patterns, [0,1,2,3], 4)
  assert.deepEqual(played.map(({beat,midi}) => ({beat,midi})), [{beat:-1,midi:1},{beat:0,midi:0},{beat:5,midi:2},{beat:8,midi:0}])
  assert.deepEqual(drumPlaybackNotes([], patterns, [], 3).map(n => n.beat), [0,4,8])
  assert.deepEqual(drumPlaybackNotes([], patterns, [2,3], 2).map(n => n.beat), [0])
  assert.deepEqual(drumPlaybackNotes([], [[],null,null,null], [], 4), [])
  assert.deepEqual(drumPlaybackNotes(original, [null,[],null,null], [0,2], 2).map(n=>n.beat), [-1,4])
})


test('new drum patterns begin with independent four-on-the-floor kick', async () => {
  const {defaultDrumPatterns, drumPlaybackNotes} = await import('../dist/studio-style.js')
  const patterns = defaultDrumPatterns()
  assert.deepEqual(patterns[0].map(({beat,midi})=>({beat,midi})), [0,1,2,3].map(beat=>({beat,midi:0})))
  assert.deepEqual(drumPlaybackNotes([], patterns, [0,1], 2).map(note=>note.beat), [0,1,2,3,4,5,6,7])
  patterns[0].length = 0
  assert.equal(defaultDrumPatterns()[0].length, 4)
})
