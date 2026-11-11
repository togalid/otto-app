import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {JSDOM} from 'jsdom'
import {genres} from '../dist/groove.js'

test('style changes and arrangement round trips keep score and section settings in sync', async () => {
  const html = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8')
  const {window} = new JSDOM(html, {url: 'http://localhost', pretendToBeVisual: true})
  window.matchMedia = () => ({matches: true, addEventListener() {}})
  const names = ['window', 'document', 'Element', 'HTMLElement', 'SVGElement', 'HTMLButtonElement', 'HTMLInputElement', 'HTMLSelectElement', 'HTMLOptionElement', 'HTMLOptGroupElement', 'Event', 'CustomEvent', 'MouseEvent', 'MutationObserver', 'localStorage', 'requestAnimationFrame', 'cancelAnimationFrame']
  const previous = names.map(name => Object.getOwnPropertyDescriptor(globalThis, name))
  for (const name of names) Object.defineProperty(globalThis, name, {configurable: true, writable: true, value: name === 'window' ? window : name.endsWith('AnimationFrame') ? window[name].bind(window) : window[name]})
  const savedBlobs = []
  const createObjectURL = URL.createObjectURL
  URL.createObjectURL = blob => {
    savedBlobs.push(blob)
    return 'blob:oto-settings-test'
  }
  window.HTMLAnchorElement.prototype.click = () => {}
  window.HTMLDialogElement.prototype.showModal = function () { this.open = true }
  try {
    await import('../dist/app.js')
    const byId = id => document.getElementById(id)
    const bar = document.querySelector('[aria-label="移動する小節"]')
    bar.value = '4'
    bar.dispatchEvent(new Event('change', {bubbles: true}))
    assert.equal(bar.value, '4')
    byId('song-open').click()
    while (byId('song-open').disabled) await new Promise(resolve => setImmediate(resolve))
    const save = async () => {
      byId('song-save').click()
      return JSON.parse(await savedBlobs.at(-1).text())
    }
    const initialSlots = (await save()).slots
    byId('style-next').click()
    await new Promise(resolve => setImmediate(resolve))
    const style = genres.find(item => item.id === byId('genre').value)
    assert.equal(style.id, genres.find(item => item.group === genres[0].group && item.id !== genres[0].id).id)
    assert.equal(byId('drum-timbre').value, style.drum)
    assert.equal(byId('bass-pattern').value, style.bassPattern)
    assert.equal(bar.value, '1')

    const load = async arrangement => {
      const input = byId('song-file')
      const file = new File([JSON.stringify(arrangement)], 'settings.json')
      Object.defineProperty(input, 'files', {configurable: true, value: [file]})
      input.dispatchEvent(new Event('change', {bubbles: true}))
      await new Promise(resolve => setImmediate(resolve))
      assert.equal(byId('song-status').textContent, '保存した設定を読み込みました。')
    }
    const arrangement = await save()
    assert.notDeepEqual(arrangement.slots, initialSlots)
    const [section] = arrangement.sections
    const drum = byId('drum-timbre')
    const alternate = [...drum.options].find(option => option.value !== style.drum).value
    arrangement.sections = [
      {...section, endBar: 8},
      {...section, name: 'B', startBar: 8, partSettings: {...section.partSettings, 'drum-timbre': alternate}},
    ]
    await load(arrangement)
    const selectSection = async name => {
      document.querySelector(`[aria-label="セクション${name}を編集"]`).click()
      await new Promise(resolve => setImmediate(resolve))
    }
    await selectSection('B')
    assert.equal(drum.value, alternate)
    await selectSection('A')
    assert.equal(drum.value, style.drum)
    const roundTrip = await save()
    await load(roundTrip)
    await selectSection('B')
    assert.equal(drum.value, alternate)
    assert.equal(byId('bass-pattern').value, style.bassPattern)
  } finally {
    URL.createObjectURL = createObjectURL
    window.close()
    names.forEach((name, index) => {
      if (previous[index]) Object.defineProperty(globalThis, name, previous[index])
      else delete globalThis[name]
    })
  }
})
