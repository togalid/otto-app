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
  assert.throws(() => decodeStudioAccompaniment({...notes, drums:[{...notes.drums[0], midi:8}]}), /Invalid Studio accompaniment/)
})
