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
  const buttons = ['基本', '彩り'].map((label, index) => {
    const button = document.createElement('button')
    button.type = 'button'; button.textContent = label
    button.setAttribute('aria-pressed', String(index === 0))
    caption.append(button)
    return button
  })
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
    row.innerHTML = `<button type="button" class="part-heading track-select ornament-select" aria-pressed="${index === 0}" aria-label="${part.label}のミックスを表示"><span class="ornament-icon" aria-hidden="true">${icons[index]}</span><span class="track-name">${part.label}</span></button><label class="select-control"><span class="sr-only">${part.label}の音色</span><select id="${part.id}-timbre">${part.timbres.map(t => `<option value="${t.id}">${t.label}</option>`).join('')}</select></label><label class="select-control"><span class="sr-only">${part.label}のパターン</span><select id="${part.id}-pattern">${ornamentPatterns.filter(p => p.part === part.id).map(p => `<option value="${p.id}">${p.label}</option>`).join('')}</select></label><div class="part-mix" role="group" aria-label="${part.label}のミックス"><button type="button" class="mix-button" id="${part.id}-mute" aria-label="${part.label}をミュート" aria-pressed="false">M</button><button type="button" class="mix-button" id="${part.id}-solo" aria-label="${part.label}をソロ" aria-pressed="false">S</button><label class="volume-knob" title="${part.label}の音量"><input id="${part.id}-volume" type="range" min="0" max="100" value="24" aria-label="${part.label}の音量"><span aria-hidden="true"></span></label></div>`
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
  buttons.forEach((button, index) => button.addEventListener('click', () => {
    basic.forEach(row => { /** @type {HTMLElement} */ (row).hidden = index !== 0 })
    rows.forEach(row => { row.hidden = index === 0 })
    buttons.forEach((item, i) => item.setAttribute('aria-pressed', String(index === i)))
  }))
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
