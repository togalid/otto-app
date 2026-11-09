import test from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import { createPartSettings } from '../dist/part-settings.js'
import { restoreArrangement } from '../dist/arrangement-file.js'

test('native selection, arrangement import and section restore share the part command', async () => {
  const { window } = new JSDOM('<div><select id="bass-pattern"><option>root</option><option>walking</option></select></div>')
  const previous = {document: globalThis.document, Event: globalThis.Event}
  Object.assign(globalThis, {document: window.document, Event: window.Event})
  try {
    const control = document.getElementById('bass-pattern')
    const calls = []
    const parts = createPartSettings()
    parts.bind(control, () => calls.push(control.value))
    control.parentElement.addEventListener('part-sync', () => calls.push('sync:' + control.value))
    control.value = 'walking'
    control.dispatchEvent(new Event('change', {bubbles: true}))
    await restoreArrangement({
      style: 'jazz', controls: [{id: control.id, value: 'root'}], mix: [], score: {}, sections: [],
    }, {
      stop: () => calls.push('stop'),
      chooseStyle: async id => calls.push(id),
      applyControl: ({value}) => parts.apply(control, value),
      applyMix: () => {},
      applyScore: () => parts.restore([control.id], {[control.id]: 'walking'}),
    })
    parts.restore([control.id], {[control.id]: 'walking'})
    assert.deepEqual(calls, ['walking', 'stop', 'jazz', 'root', 'sync:root', 'walking', 'sync:walking'])
  } finally {
    Object.assign(globalThis, previous)
    window.close()
  }
})
