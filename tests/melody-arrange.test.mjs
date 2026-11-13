import test from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'

test('a half note entered on beat four displays tied quarter notes and stays one playback event', async () => {
  const dom = new JSDOM('<div class="melody-choice-row"></div><div id="editor"></div>', {pretendToBeVisual:true})
  const globals = ['window', 'document', 'Element', 'SVGElement', 'HTMLElement', 'HTMLInputElement', 'Event', 'cancelAnimationFrame']
  const previous = globals.map(name => Object.getOwnPropertyDescriptor(globalThis, name))
  globals.forEach(name => Object.defineProperty(globalThis, name, {configurable:true, writable:true, value:dom.window[name]}))
  let editor
  try {
    const {mountMelodyEditor} = await import('../dist/melody-arrange.js')
    const {nextTick} = await import('../dist/vendor/vue.runtime.esm-browser.prod.js')
    const host = document.querySelector('#editor')
    editor = mountMelodyEditor(host, {empty:true, togglePlayback() {}})
    host.querySelector('[aria-label="1小節目 4拍から入力"]').click()
    await nextTick()
    host.querySelector('[aria-label="2分音符"]').click()
    editor.midiAttack(60)
    await nextTick()
    assert.deepEqual(editor.getNotes(), [{beat:3, duration:2, midi:60, velocity:.8}])
    assert.deepEqual([...host.querySelectorAll('.arrange-note')].map(note => note.style.left), ['37.5%', '50%'])
    assert.equal(host.querySelectorAll('.arrange-note-tie').length, 1)

    host.getClientRects = () => [host.getBoundingClientRect()]
    const command = code => host.dispatchEvent(new dom.window.KeyboardEvent('keydown', {
      code, metaKey:true, bubbles:true, cancelable:true,
    }))
    command('KeyZ')
    assert.deepEqual(editor.getNotes(), [])
    command('KeyY')
    assert.equal(editor.getNotes()[0].duration, 2)
    command('KeyZ')
    await nextTick()
    host.querySelector('[aria-label="2分休符"]').click()
    command('KeyY')
    assert.deepEqual(editor.getNotes(), [])

    const bassHost = document.createElement('section')
    document.body.append(bassHost)
    const bassEditor = mountMelodyEditor(bassHost, {empty:true, part:'bass', defaultKeyboardOctaves:2})
    try {
      assert.deepEqual(bassEditor.getNotes(), [])
      assert.ok(bassHost.querySelector('.arrange-keyboard [aria-label="C2"]'))
      bassEditor.midiAttack(27)
      bassEditor.midiAttack(28)
      bassEditor.midiAttack(60)
      bassEditor.midiAttack(61)
      await nextTick()
      assert.deepEqual(bassEditor.getNotes().map(note => note.midi), [28, 60])
    } finally {
      bassEditor.destroy()
    }
  } finally {
    editor?.destroy()
    globals.forEach((name, index) => {
      if (previous[index]) Object.defineProperty(globalThis, name, previous[index])
      else delete globalThis[name]
    })
    dom.window.close()
  }
})
