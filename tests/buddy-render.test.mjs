import test from 'node:test'
import assert from 'node:assert/strict'
import { mountBuddy } from '../dist/buddy.js'
import { Instrument } from '../dist/audio.js'
import { melodyPalette } from '../dist/music.js'

class ElementStub {
  attributes = new Set()
  dataset = {}
  listeners = new Map()
  classList = { add() {}, remove() {} }
  disabled = false
  hidden = false
  textContent = ''
  writes = 0
  setAttribute(name) { this.writes++; this.attributes.add(name) }
  removeAttribute(name) { this.writes++; this.attributes.delete(name) }
  hasAttribute(name) { return this.attributes.has(name) }
  toggleAttribute(name, on) { this.writes++; on ? this.attributes.add(name) : this.attributes.delete(name) }
  addEventListener(name, listener) { this.listeners.set(name, listener) }
  append() {}
  querySelector() { return null }
}

test('Otto sustained notes do not rewrite pad/key highlights on every audio tick', async t => {
  const elements = new Map()
  const element = selector => {
    if (!elements.has(selector)) elements.set(selector, new ElementStub())
    return elements.get(selector)
  }
  const pads = Array.from({ length: 8 }, () => new ElementStub())
  const keys = Array.from({ length: 37 }, (_, i) => {
    const key = new ElementStub()
    key.dataset.midi = String(48 + i)
    return key
  })
  element('#buddy-inline').querySelector = element
  element('#count-in').checked = false
  const globals = {
    document: {
      querySelector: element,
      querySelectorAll: selector => selector === '#pads button' ? pads : keys,
      createElementNS: () => new ElementStub(), addEventListener() {},
    },
    window: { addEventListener() {} },
    MutationObserver: class { observe() {} },
  }
  for (const [name, value] of Object.entries(globals)) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, name)
    Object.defineProperty(globalThis, name, { configurable: true, value })
    t.after(() => descriptor ? Object.defineProperty(globalThis, name, descriptor) : delete globalThis[name])
  }
  let tick
  t.mock.method(globalThis, 'setInterval', callback => { tick = callback; return 1 })
  t.mock.method(globalThis, 'clearInterval', () => {})
  const context = { currentTime: 0, state: 'running' }
  t.mock.method(Instrument.prototype, 'ready', async function () { this.context = context })
  for (const method of ['silence', 'playAt', 'release']) t.mock.method(Instrument.prototype, method, () => {})
  const player = new Instrument()
  const transport = {
    instrument: new Instrument(), ornaments: [], bpm: 100, swing: 0, genre: 'pop',
    slots: Array(8).fill('FM7'), running: false, nextTime: 2.4,
    stop() { this.running = false },
    async start() { this.running = true },
  }
  const palette = melodyPalette(0, 'FM7', 0, 'key')
  const buddy = mountBuddy({ progression: transport, instrument: player,
    drums: { hitAt() {} }, getNotes: () => palette, notesAt: () => palette,
    reportNote() {}, refreshTransport() {}, onModeChange() {}, reveal() {},
  })
  buddy.setMode('all-pc')
  await buddy.start()
  context.currentTime = .1
  tick()
  assert.ok(pads.some(pad => pad.hasAttribute('data-pc-playing')))
  assert.ok(keys.some(key => key.hasAttribute('data-pc-playing')))
  const writes = () => [...pads, ...keys].reduce((sum, node) => sum + node.writes, 0)
  const before = writes()
  for (let i = 0; i < 10; i++) { context.currentTime += .01; tick() }
  assert.equal(writes(), before, 'same held note should not clear/re-add attributes')

  element('#otto-join').listeners.get('click')()
  tick()
  assert.ok(pads.every(pad => !pad.disabled && !pad.hasAttribute('data-pc-playing')))
  assert.ok(keys.every(key => !key.hasAttribute('data-pc-playing')))
  buddy.stop()
})
