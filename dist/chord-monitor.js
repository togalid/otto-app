import { createApp, h, shallowRef } from './vendor/vue.runtime.esm-browser.prod.js'

const whiteOffsets = [0, 1, 1, 2, 2, 3, 4, 4, 5, 5, 6, 6]
const keys = Array.from({ length: 60 }, (_, index) => {
  const midi = 36 + index
  const pitch = midi % 12
  return {
    midi,
    color: [1, 3, 6, 8, 10].includes(pitch) ? 'monitor-black' : 'monitor-white',
    style: { '--key-position': String(Math.floor(index / 12) * 7 + whiteOffsets[pitch]) },
  }
})

export function mountChordMonitor() {
  const element = /** @type {HTMLElement} */ (document.querySelector('#backing-monitor'))
  const state = shallowRef({ notes: new Set(/** @type {number[]} */ ([])), root: -1 })
  createApp({
    render: () => keys.map(({ midi, color, style }) => h('i', {
      key: midi,
      class: [color, { sounding: state.value.notes.has(midi), 'root-note': state.value.root === midi }],
      style,
    })),
  }).mount(element)
  /** @param {number[]} notes @param {number} rootPitch */
  return (notes, rootPitch) => {
    const unique = new Set(notes)
    const root = Math.min(...notes.filter(note => note % 12 === rootPitch))
    const label = `コードの構成音 MIDI ${[...unique].join(', ')}`
    if (element.getAttribute('aria-label') === label && state.value.root === root) return
    element.setAttribute('aria-label', label)
    state.value = { notes: unique, root }
  }
}
