import { createApp, h, ref } from './vendor/vue.runtime.esm-browser.prod.js'
import { styleOrnaments } from './style-ornaments.js'
import { ornamentParts, ornamentPatterns } from './ornaments.js'

/** Mount a second bank in the same four-row space. @param {{id:string,pattern:string,voice:{setTimbre:(id:string)=>void,silence:()=>void}}[]} tracks */
export function mountOrnaments(tracks) {
  const grid = /** @type {HTMLElement} */ (document.querySelector('#track-grid'))
  const basic = Array.from(grid.children)
  const caption = document.createElement('div')
  caption.className = 'part-bank'
  caption.setAttribute('role', 'group')
  caption.setAttribute('aria-label', '表示するパート')
  const bank = ref(0)
  const genre = /** @type {HTMLElement} */ (document.querySelector('#genre-group'))
  const heading = document.createElement('div')
  heading.className = 'genre-caption'
  const label = document.createElement('label')
  label.htmlFor = 'genre-group'; label.textContent = 'ジャンル'
  const field = genre.parentElement
  if (field) {
    field.firstChild?.remove()
    field.prepend(heading)
    heading.append(label, caption)
    // Avoid interactive buttons nested in a label.
    const replacement = document.createElement('div')
    replacement.className = field.className
    replacement.append(...Array.from(field.childNodes))
    field.replaceWith(replacement)
  }
  const icons = ['✦', '♪', '≋', '◌']
  const rows = ornamentParts.map((part, index) => {
    const row = document.createElement('div')
    row.className = 'ornament-controls'; row.hidden = true
    row.setAttribute('role', 'group'); row.setAttribute('aria-label', `${part.label}パート`)
    const mixLabel = part.label + 'のミックス'
    /** @param {string} kind @param {string} label @param {readonly {id:string,label:string}[]} options */
    const selector = (kind, label, options) => h('label', { class: 'select-control' }, [
      h('span', { class: 'sr-only' }, part.label + 'の' + label),
      h('select', { id: part.id + '-' + kind }, options.map(option => h('option', { value: option.id }, option.label))),
    ])
    createApp({
      render: () => [
        h('button', { type: 'button', class: 'part-heading track-select ornament-select',
          'aria-pressed': String(index === 0), 'aria-label': mixLabel + 'を表示' }, [
          h('span', { class: 'ornament-icon', 'aria-hidden': 'true' }, icons[index]),
          h('span', { class: 'track-name' }, part.label),
        ]),
        selector('timbre', '音色', part.timbres),
        selector('pattern', 'パターン', ornamentPatterns.filter(pattern => pattern.part === part.id)),
        h('div', { class: 'part-mix', role: 'group', 'aria-label': mixLabel }, [
          ...[['mute', 'ミュート', 'M'], ['solo', 'ソロ', 'S']].map(([id, label, glyph]) =>
            h('button', { type: 'button', class: 'mix-button', id: part.id + '-' + id,
              'aria-label': part.label + 'を' + label, 'aria-pressed': 'false' }, glyph)),
          h('label', { class: 'volume-knob', title: part.label + 'の音量' }, [
            h('input', { id: part.id + '-volume', type: 'range', min: 0, max: 100, value: 24, 'aria-label': part.label + 'の音量' }),
            h('span', { 'aria-hidden': 'true' }),
          ]),
        ]),
      ],
    }).mount(row)
    grid.append(row)
    const track = tracks[index]
    const timbre = /** @type {HTMLSelectElement} */ (row.querySelector(`#${part.id}-timbre`))
    const pattern = /** @type {HTMLSelectElement} */ (row.querySelector(`#${part.id}-pattern`))
    timbre.addEventListener('change', () => track.voice.setTimbre(timbre.value))
    pattern.value = track.pattern
    pattern.addEventListener('change', () => { track.pattern = pattern.value; track.voice.silence() })
    row.querySelector('button')?.addEventListener('click', () => {
      for (const other of rows) other.querySelector('button')?.setAttribute('aria-pressed', String(other === row))
    })
    return row
  })
  createApp({
    render: () => ['基本', '彩り'].map((label, index) => h('button', {
      type: 'button',
      'aria-pressed': String(bank.value === index),
      onClick: () => {
        bank.value = index
        basic.forEach(row => { /** @type {HTMLElement} */ (row).hidden = index !== 0 })
        rows.forEach(row => { row.hidden = index === 0 })
      },
    }, label)),
  }).mount(caption)
  /** @param {string} styleId */
  return function setStyle(styleId) {
    const settings = styleOrnaments[styleId]
    if (!settings) throw new RangeError('Unknown arrangement style')
    for (const setting of settings) {
      const track = tracks.find(track => track.id === setting.id)
      if (!track) continue
      const timbre = /** @type {HTMLSelectElement} */ (document.querySelector(`#${setting.id}-timbre`))
      timbre.value = setting.timbre
      track.voice.setTimbre(setting.timbre)
      const pattern = /** @type {HTMLSelectElement} */ (document.querySelector(`#${setting.id}-pattern`))
      pattern.value = setting.pattern
      pattern.dispatchEvent(new Event('change', {bubbles:true}))
      const volume = /** @type {HTMLInputElement} */ (document.querySelector(`#${setting.id}-volume`))
      volume.value = String(Math.round(setting.volume * 100))
      volume.dispatchEvent(new Event('input', {bubbles:true}))
    }
  }
}
