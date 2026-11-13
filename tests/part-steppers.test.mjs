import test from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'

// Vue captures the document at module load. Use an isolated DOM, never user state.
const dom = new JSDOM('<!doctype html><html><body></body></html>', {url:'http://localhost/'})
for (const name of ['window', 'document', 'Element', 'HTMLElement', 'SVGElement', 'HTMLSelectElement', 'HTMLOptGroupElement', 'Event']) {
  globalThis[name] = name === 'window' ? dom.window : name === 'document' ? dom.window.document : dom.window[name]
}
const { drumPadState, drumPadType, drumPadTypes, mountMelodyVoiceChoice, mountAccompanimentPlay, selectStepperView } = await import('../dist/part-steppers.js')
const { createApp, nextTick } = await import('../dist/vendor/vue.runtime.esm-browser.prod.js')

test('shared melody picker keeps source values, option groups and step boundaries in sync', async () => {
  const source = document.createElement('select')
  source.id = 'melody-timbre'
  source.innerHTML = '<optgroup label="Lead"><option value="a">01: A</option><option value="b">02: B</option></optgroup>'
  const view = mountMelodyVoiceChoice(source)
  document.body.append(view.element)
  let changes = 0
  let detailChanges = 0
  let bubbledChanges = 0
  view.element.querySelector('select').addEventListener('change', () => { detailChanges++ })
  view.element.addEventListener('change', () => { bubbledChanges++ })
  source.addEventListener('change', () => { changes++ })
  const [previous, next] = view.element.querySelectorAll('button')
  assert.equal(previous.disabled, true)
  assert.equal(next.disabled, false)
  assert.equal(view.element.querySelector('optgroup').label, 'Lead')
  assert.equal(view.element.querySelector('select').id, '')
  next.click()
  await nextTick()
  assert.equal(source.value, 'b')
  assert.equal(changes, 1)
  assert.equal(detailChanges, 1)
  assert.equal(bubbledChanges, 1)
  assert.equal(previous.disabled, false)
  assert.equal(next.disabled, true)
  source.value = 'a'
  document.dispatchEvent(new Event('melody-timbre-change'))
  await nextTick()
  assert.equal(view.element.querySelector('select').value, 'a')
  assert.equal(previous.disabled, true)
  view.unmount()
  assert.equal(view.element.childElementCount, 0)
  view.element.remove()
})

test('accompaniment Vue surface maps studio pad positions to saved IDs and preserves mode callbacks and disposal', async () => {
  const played = []
  const modes = []
  const view = mountAccompanimentPlay('drums', 'auto', null, mode => modes.push(mode), index => played.push(index))
  document.body.append(view.element)
  const pads = [...view.element.querySelectorAll('.drum-tutorial-pad')]
  assert.equal(pads.length, 8)
  assert.match(pads[0].getAttribute('aria-label'), /クラッシュ/)
  assert.match(pads[4].getAttribute('aria-label'), /キック/)
  pads[4].click()
  pads[6].click()
  assert.deepEqual(played, [0, 2])
  drumPadState.value = {status:'loading', samples:[0,2]}
  await nextTick()
  assert.equal(pads.every(pad => pad.disabled), true)
  assert.equal(view.element.querySelectorAll('.drum-pad-status').length, 8)
  pads[4].click()
  assert.deepEqual(played, [0, 2])
  drumPadState.value = {status:'error', samples:[0,2]}
  await nextTick()
  assert.match(pads[4].getAttribute('aria-label'), /読込失敗/)
  drumPadState.value = {status:'ready', samples:[0,2]}
  await nextTick()
  assert.equal(pads[4].disabled, false)
  assert.equal(pads[5].disabled, true)
  drumPadState.value = {status:'ready', samples:null}
  await nextTick()
  const otto = view.element.querySelector('input[value="otto"]')
  otto.click()
  await nextTick()
  assert.deepEqual(modes, ['otto'])
  assert.equal(otto.checked, true)
  assert.equal(view.element.querySelector('input[value="auto"]').checked, false)
  view.unmount()
  assert.equal(view.element.childElementCount, 0)
  view.element.remove()
})

test('drum pad light follows the assigned sound, including unknown samples', async () => {
  assert.equal(drumPadType('68_Kick_SP_06.wav'), 'kick')
  assert.equal(drumPadType('CyberneticHipHop_Snare_SP_02.wav'), 'snare')
  assert.equal(drumPadType('ResampledLiveDrums_London_03_HH_01_SP.wav'), 'hat')
  assert.equal(drumPadType('AlienBeatscapes_HighClap_SP_01.wav'), 'clap')
  assert.equal(drumPadType('TearoutDnB_Perc_28_454.wav'), 'other')
  assert.equal(drumPadType('open'), 'hat')

  const view = mountAccompanimentPlay('drums', 'auto', null, () => {}, () => {})
  document.body.append(view.element)
  try {
    const pad = view.element.querySelector('[data-pad-index="5"]')
    assert.equal(pad.dataset.drumType, 'other')
    drumPadTypes.value = {5:'clap'}
    await nextTick()
    assert.equal(pad.dataset.drumType, 'clap')
  } finally {
    drumPadTypes.value = {}
    view.unmount()
    view.element.remove()
  }
})

test('backing iframe preserves the key synchronization load hook', () => {
  let loaded = 0
  const view = mountAccompanimentPlay('chord', 'manual', null, () => {}, () => {}, () => { loaded++ })
  const frame = view.element.querySelector('iframe')
  assert.equal(frame.getAttribute('src'), './chord-pad.html?embedded=1&backing=1')
  frame.dispatchEvent(new Event('load'))
  assert.equal(loaded, 1)
  view.unmount()
})

// Quick mixer arrows historically dispatch a local detail-select event, while
// melody arrows bubble it for the melody panel's touch-feedback animation.
test('quick picker arrows emit one local change without bubbling or duplicate actions', () => {
  const source = document.createElement('select')
  source.innerHTML = '<option value="a">A</option><option value="b">B</option>'
  const host = document.createElement('div')
  let actions = 0
  let localChanges = 0
  let bubbledChanges = 0
  const app = createApp({render:() => selectStepperView(source, '音色', value => {
    source.value = value
    actions++
  })})
  app.mount(host)
  host.querySelector('select').addEventListener('change', () => { localChanges++ })
  host.addEventListener('change', () => { bubbledChanges++ })
  host.querySelectorAll('button')[1].click()
  assert.equal(source.value, 'b')
  assert.equal(actions, 1)
  assert.equal(localChanges, 1)
  assert.equal(bubbledChanges, 0)
  app.unmount()
})
