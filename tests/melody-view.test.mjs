import test from 'node:test'
import assert from 'node:assert/strict'
import { createMelodyView } from '../dist/melody-view.js'

test('repeated melody notes reuse harmony and do not rewrite pad DOM', () => {
  let writes = 0
  const element = () => ({
    value: '',
    get textContent() { return this.value },
    set textContent(value) { this.value = value; writes++ },
  })
  const buttons = Array.from({ length: 8 }, () => ({
    children: new Map(), dataset: {},
    classList: { toggle() { writes++ } },
    setAttribute() { writes++ },
    querySelector(selector) {
      if (!this.children.has(selector)) this.children.set(selector, element())
      return this.children.get(selector)
    },
  }))
  const elements = new Map()
  const root = { querySelector(selector) {
    if (!elements.has(selector)) elements.set(selector, element())
    return elements.get(selector)
  } }
  const view = createMelodyView(buttons, root)
  const first = view.update(0, 'FM7', 0, 60, '')
  assert.equal(first.notes[0].label, 'G')
  assert.equal(first.notes[0].clash, false)
  assert.ok(first.notes.every((note, index) => index === 0 || note.midi > first.notes[index - 1].midi))
  view.update(0, 'FM7', 0, 60, first.degree)
  const before = writes
  for (let i = 0; i < 100; i++) {
    assert.equal(view.update(0, 'FM7', 0, 60, first.degree).notes, first.notes)
  }
  assert.equal(writes, before)
  const nextChord = view.update(0, 'CM7', 0, 60, '')
  assert.deepEqual(nextChord.notes.map(note => note.midi), first.notes.map(note => note.midi))
  const changed = view.update(2, 'FM7', 2, 60, first.degree)
  assert.notEqual(changed.notes, first.notes)
  assert.ok(writes > before)
  assert.notEqual(elements.get('#melody-current-chord').textContent, 'F△7')
})
