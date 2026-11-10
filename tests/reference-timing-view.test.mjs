import test from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'

// Exercise real Vue DOM/event wiring without audio hardware or a user file.
test('reference alignment keeps source timing, seeking and key controls connected after Vue updates', async () => {
  const dom = new JSDOM('<div id="host"></div><input id="tempo" value="120"><select id="key"><option value="0">C</option><option value="3">E♭</option></select>', {url: 'http://localhost'})
  const previous = new Map()
  for (const name of ['window', 'document', 'Element', 'SVGElement', 'HTMLElement', 'Event']) {
    previous.set(name, Object.getOwnPropertyDescriptor(globalThis, name))
    Object.defineProperty(globalThis, name, {configurable: true, writable: true, value: dom.window[name]})
  }
  try {
    const { mountReferenceTiming } = await import('../dist/reference-timing-view.js')
    const { nextTick } = await import('../dist/vendor/vue.runtime.esm-browser.prod.js')
    const { presets } = await import('../dist/music.js')
    const host = document.getElementById('host'), tempo = document.getElementById('tempo'), keySelect = document.getElementById('key')
    let timing = 0, selectedPreset = presets.find(item => item.group === '6').id
    const starts = [], rootPreviews = [], boundKnobs = []
    const progression = {
      beatsPerBar: 4, bpm: 120, selectedSection: 0, sections: [{key: 0}], running: false,
      barCount: () => 16,
      stop() { this.running = false },
      start(bar, beat) { this.running = true; starts.push([bar, beat]); return Promise.resolve() },
    }
    const reference = {filename: 'synthetic.wav', duration: 32, playing: false}
    const player = {
      getTiming: () => timing, setTiming: (_, value) => { timing = value },
      getPosition: () => 0, timingWaveform: () => 'M0 50L1000 50', timingOnsetNear: () => true,
      stopKeyPreview() {}, previewKey: async root => { rootPreviews.push(root) }, setKeyPreviewRoot: root => rootPreviews.push(root),
    }
    const playbackHeads = new Map(), waveformStartBeats = new Map()
    const seeks = []
    const view = mountReferenceTiming(host, {
      reference, player, progression, tempo, keySelect, section: () => 0, preset: () => selectedPreset,
      choosePreset: id => { selectedPreset = id }, playbackHeads, waveformStartBeats,
      playhead: {current: () => 4, count: () => 16, seek: bar => seeks.push(bar)},
      playFromBar: bar => { void progression.start(bar, 0) },
      bindKnobDrag: input => { boundKnobs.push(input) },
    })
    await nextTick()
    assert.equal(boundKnobs.length, 3)
    assert.ok(boundKnobs.every(input => input.isConnected))
    assert.equal(host.querySelectorAll('.reference-timing-row').length, 1)
    const waveform = host.querySelector('.timing-waveform')
    waveform.getBoundingClientRect = () => ({left: 0, width: 1000})

    waveform.dispatchEvent(new dom.window.KeyboardEvent('keydown', {key: 'ArrowRight', bubbles: true}))
    await nextTick()
    assert.equal(timing, .01)
    assert.equal(host.querySelector('.reference-timing-control output').textContent, '0.01 秒')

    const timingTempo = host.querySelector('.timing-tempo-knob input')
    timingTempo.value = '133.4'
    timingTempo.dispatchEvent(new Event('input', {bubbles: true}))
    await nextTick()
    assert.equal(tempo.value, '133')
    assert.equal(host.querySelector('.timing-tempo-knob output').textContent, '133')
    // Vue updates keep the same input node so installed knob gesture handlers survive.
    assert.equal(host.querySelector('.timing-tempo-knob input'), timingTempo)

    host.querySelector('.reference-timing-control > button').click()
    await nextTick()
    assert.deepEqual(starts, [[0, 0]])
    assert.equal(waveform.classList.contains('aligned'), true)
    assert.equal(playbackHeads.get(0), 0)
    const pointer = new dom.window.MouseEvent('pointerdown', {button: 0, clientX: 620, bubbles: true})
    Object.defineProperties(pointer, {isPrimary: {value: true}, pointerId: {value: 1}})
    waveform.dispatchEvent(pointer)
    await nextTick()
    assert.deepEqual(starts.at(-1), [1, 0])
    assert.equal(playbackHeads.get(0), 1)
    assert.equal(waveformStartBeats.get(0), 0)
    assert.equal(host.querySelector('.wave-selected-line').getAttribute('visibility'), 'visible')

    const root = host.querySelector('[aria-label="聴き比べるルート音"]')
    root.value = '0'; root.dispatchEvent(new Event('input', {bubbles: true}))
    await nextTick()
    // C as degree VI implies E-flat major, applied through the existing key control.
    assert.equal(keySelect.value, '3')
    assert.equal(progression.sections[0].key, 3)
    assert.equal(host.querySelector('.key-match-result').textContent, 'キー E♭')
    host.querySelector('.key-listen').click()
    await nextTick()
    assert.deepEqual(rootPreviews, [0])
    assert.equal(host.querySelector('.key-listen').getAttribute('aria-pressed'), 'true')
    document.dispatchEvent(new Event('reference-timing-refresh'))
    await nextTick()
    assert.equal(host.querySelector('.key-listen').getAttribute('aria-pressed'), 'false')

    timing = 1.25
    document.dispatchEvent(new Event('reference-timing-refresh'))
    await nextTick()
    view.updateTimingPreview()
    await nextTick()
    assert.equal(host.querySelector('.reference-timing-control output').textContent, '1.25 秒')
    assert.equal(host.querySelectorAll('.reference-timing-row').length, 1)
    const navigation = host.querySelector('.reference-playhead-host')
    assert.equal(navigation.querySelector('input').value, '5')
    for (const label of ['1小節目に戻る', '前の小節へ', '次の小節へ']) {
      navigation.querySelector(`button[aria-label="${label}"]`).click()
    }
    assert.deepEqual(seeks, [0, 3, 5])
    assert.equal(timing, 1.25)
    view.unmount()
    assert.equal(host.children.length, 0)
    tempo.value = '99'
    document.dispatchEvent(new Event('reference-loaded'))
    assert.equal(progression.referenceBpm, undefined)
  } finally {
    dom.window.close()
    for (const [name, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor)
      else delete globalThis[name]
    }
  }
})
