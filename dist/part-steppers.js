import { createApp, h, ref } from './vendor/vue.runtime.esm-browser.prod.js'

export function mountPartSteppers() {
  for (const [id, label] of [
    ['rhythm-pattern', 'ドラムパターン'],
    ['bass-pattern', 'ベースパターン'],
    ['chord-backing', 'コードのバッキング'],
    ['melody-mode', 'メロディの演奏方法'],
    ['bell-pattern', 'ベルパターン'], ['pluck-pattern', 'プラックパターン'],
    ['phrase-pattern', 'フレーズパターン'], ['fx-pattern', '展開FXパターン'],
  ]) {
    const select = /** @type {HTMLSelectElement} */ (document.getElementById(id))
    const control = select.closest('.select-control')
    if (!control) continue
    const wrapper = document.createElement('div')
    wrapper.className = 'part-pattern-picker'
    control.before(wrapper)
    wrapper.append(control)
    const stepper = document.createElement('div')
    stepper.className = 'style-stepper part-pattern-stepper'
    stepper.setAttribute('role', 'group')
    stepper.setAttribute('aria-label', `${label}を切り替え`)
    const index = ref(-1)
    const count = ref(0)
    const options = () => Array.from(select.options).filter(option => !option.disabled && !option.hidden && !option.parentElement?.hasAttribute('disabled'))
    if (id !== 'melody-mode') {
      Array.from(select.options).forEach((option, index) => {
        option.textContent = `${String(index + 1).padStart(2, '0')}: ${option.textContent ?? ''}`
      })
    }
    function sync() {
      const choices = options()
      index.value = choices.indexOf(select.selectedOptions[0])
      count.value = choices.length
      select.title = select.selectedOptions[0]?.textContent ?? ''
    }
    /** @param {number} direction */
    function step(direction) {
      const choices = options()
      const choice = choices[choices.indexOf(select.selectedOptions[0]) + direction]
      if (!choice) return
      select.value = choice.value
      select.dispatchEvent(new Event('change', { bubbles: true }))
      select.dispatchEvent(new Event('part-user-change', { bubbles: true }))
    }
    select.addEventListener('change', sync)
    select.addEventListener('part-sync', sync)
    document.getElementById('genre')?.addEventListener('change', sync)
    wrapper.append(stepper)
    sync()
    createApp({
      render: () => [
        h('button', { type: 'button', disabled: index.value <= 0, 'aria-label': '前の' + label, onClick: () => step(-1) }, '▴'),
        h('button', { type: 'button', disabled: index.value < 0 || index.value >= count.value - 1, 'aria-label': '次の' + label, onClick: () => step(1) }, '▾'),
      ],
    }).mount(stepper)
  }
}

export function mountTimbreSteppers() {
  for (const element of Array.from(document.querySelectorAll('#track-grid select[id$="-timbre"]'))) {
    if (!(element instanceof HTMLSelectElement)) continue
    const select = element
    const picker = document.createElement('div')
    picker.className = 'timbre-picker'
    select.before(picker)
    const arrows = document.createElement('span')
    arrows.className = 'timbre-arrows'
    picker.append(select, arrows)
    // Melody options already carry numbers when they are created.
    if (select.id !== 'melody-timbre') {
      Array.from(select.options).forEach((option, index) => {
        option.textContent = `${String(index + 1).padStart(2, '0')}: ${option.textContent ?? ''}`
      })
    }
    const syncTitle = () => { select.title = select.selectedOptions[0]?.textContent ?? '' }
    select.addEventListener('change', syncTitle)
    select.addEventListener('part-sync', syncTitle)
    document.getElementById('genre')?.addEventListener('change', syncTitle)
    syncTitle()
    const label = select.getAttribute('aria-label') || '音色'
    /** @param {number} direction */
    function step(direction) {
      const count = select.options.length
      if (!count) return
      select.selectedIndex = (select.selectedIndex + direction + count) % count
      select.dispatchEvent(new Event('change', { bubbles: true }))
      select.dispatchEvent(new Event('part-user-change', { bubbles: true }))
    }
    createApp({
      render: () => [
        h('button', { type: 'button', 'aria-label': label + ' 前へ', onClick: () => step(-1) }, '▴'),
        h('button', { type: 'button', 'aria-label': label + ' 次へ', onClick: () => step(1) }, '▾'),
      ],
    }).mount(arrows)
  }
}
const drums = [
  ['キック', 'kick', 0, .18], ['スネア', 'snare', 0, .12],
  ['クローズハット', 'hat', 0, .045], ['オープンハット', 'hat', 0, .22],
  ['ローキック', 'kick', -5, .24], ['ハイスネア', 'snare', 5, .08],
  ['ロータム風', 'kick', 7, .13], ['ハイハット強', 'hat', 4, .08],
]
const notes = ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'C']

/** Mount the accompaniment surface with the same shared controls as the mixer.
 * @param {'drums'|'bass'|'chord'} part @param {'auto'|'manual'|'otto'} initialMode
 * @param {SVGElement|null} face @param {(mode:'auto'|'manual'|'otto')=>void} setMode
 * @param {(index:number)=>void} play @param {()=>void} [onFrameLoad]
 */
export function mountAccompanimentPlay(part, initialMode, face, setMode, play, onFrameLoad) {
  const element = document.createElement('div')
  element.className = 'accompaniment-play'
  const mode = ref(initialMode)
  const labels = part === 'drums' ? drums.map(([label]) => String(label)) : notes.map((note, index) => note + (index === 7 ? '3' : '2'))
  const padOrder = part === 'drums' ? [4, 5, 6, 7, 0, 1, 2, 3] : labels.map((_, index) => index)
  const modes = /** @type {const} */ ([['auto', 'パターン'], ['manual', '自分が弾く'], ['otto', 'Ottoが弾く']])
  const app = createApp({ render: () => [
    h('div', { class: 'accompaniment-play-heading' }, [
      h('div', { class: 'talk-companion' }, [
        h('div', { class: 'talk-avatar', 'aria-hidden': 'true', 'data-look': face?.parentElement?.getAttribute('data-look') ?? '', innerHTML: face?.outerHTML ?? '' }),
        h('p', { class: 'talk-bubble' }, '一緒に弾こう'),
      ]),
      h('div', { class: 'part-choice-field' }, [
        h('span', 'プレイモード'),
        h('fieldset', { class: 'segmented-control otto-play-mode', 'aria-label': 'プレイモード' }, modes.map(([value, label]) =>
          h('label', [h('input', { type: 'radio', name: 'accompaniment-mode', value, checked: mode.value === value,
            onChange: () => { mode.value = value; setMode(value) },
          }), h('span', label)]))),
      ]),
    ]),
    part === 'chord'
      ? h('iframe', { class: 'backing-chord-pads', title: 'バッキングのコードパッド', src: './chord-pad.html?embedded=1&backing=1', onLoad: onFrameLoad })
      : h('div', { class: ['accompaniment-pads', { 'drum-pads': part === 'drums' }], role: 'group', 'aria-label': part === 'drums' ? 'ドラムパッド' : '演奏パッド' },
        padOrder.map(index => h('button', { type: 'button', class: 'pad', 'data-pad-index': String(index), onClick: () => play(index) }, [h('span', labels[index])]))),
  ] })
  app.mount(element)
  return { element, unmount: () => app.unmount() }
}

// Preserve the public adapter for standalone consumers; the mixer uses the
// explicit lifecycle above when switching among accompaniment surfaces.
/** @param {'drums'|'bass'|'chord'} part @param {'auto'|'manual'|'otto'} mode
 * @param {SVGElement|null} face @param {(mode:'auto'|'manual'|'otto')=>void} setMode
 * @param {(index:number)=>void} play */
export function accompanimentPlay(part, mode, face, setMode, play) {
  return mountAccompanimentPlay(part, mode, face, setMode, play).element
}

/** @param {number} index */
export function drumPadSound(index) {
  return /** @type {[string,string,number,number]} */ (drums[index])
}

/** @param {Element} element @returns {import('vue').VNode} */
function optionView(element) {
  const attributes = Object.fromEntries(Array.from(element.attributes, attribute => [attribute.name, attribute.value]))
  return element instanceof HTMLOptGroupElement
    ? h('optgroup', attributes, Array.from(element.children, optionView))
    : h('option', attributes, element.textContent)
}

/** Shared tactile picker, backed by the original arrangement select.
 * @param {HTMLSelectElement} control @param {string} caption
 * @param {(value:string)=>void} change
 * @param {{ value?:string, options?:{id:string,label:string}[], stylePart?:string|null, ariaLabel?:string, bubbleChange?:boolean }} [override]
 */
export function selectStepperView(control, caption, change, override = {}) {
  const value = override.value ?? control.value
  const options = override.options
    ? override.options.map(({id, label}) => h('option', {value:id}, label))
    : Array.from(control.children, optionView)
  const values = override.options ? override.options.map(option => option.id) : Array.from(control.options, option => option.value)
  const index = values.indexOf(value)
  const attributes = Object.fromEntries(Array.from(control.attributes, attribute => [attribute.name, attribute.value]).filter(([name]) => name !== 'id'))
  return h('div', {class:'step-select', role:'group', 'aria-label':override.ariaLabel ?? caption}, [
    h('select', {...attributes, value, 'aria-label':override.ariaLabel ?? caption, 'data-otto-style':override.stylePart ?? undefined,
      onChange:(/** @type {Event} */ event) => change((/** @type {HTMLSelectElement} */ (event.target)).value),
    }, options),
    h('div', {class:'style-stepper part-choice-steps', role:'group', 'aria-label':`${caption}を切り替え`}, [-1, 1].map(direction => h('button', {
      type:'button', 'aria-label':(direction < 0 ? '前の' : '次の') + caption,
      disabled:direction < 0 ? index <= 0 : index >= values.length - 1,
      onClick:(/** @type {MouseEvent} */ event) => {
        const picker = /** @type {HTMLSelectElement|null} */ ((/** @type {HTMLElement} */ (event.currentTarget)).closest('.step-select')?.querySelector('select'))
        if (!picker) return
        const next = picker.selectedIndex + direction
        if (next < 0 || next >= picker.options.length) return
        picker.selectedIndex = next
        // Keep detail-select listeners (including touch feedback) on the same
        // event path as a direct choice. The source update happens only in onChange.
        picker.dispatchEvent(new Event('change', {bubbles:override.bubbleChange ?? false}))
      },
    }, direction < 0 ? '←' : '→'))),
  ])
}

/** @param {HTMLSelectElement} source */
export function mountMelodyVoiceChoice(source) {
  const element = document.createElement('div')
  element.className = 'section-style-choice part-choice-field'
  const revision = ref(0)
  const sync = () => { revision.value++ }
  const app = createApp({render:() => {
    revision.value
    return [h('span', '音色'), h('div', {class:'part-choice-picker'}, [
      selectStepperView(source, '音色', value => {
        source.value = value
        source.dispatchEvent(new Event('change', {bubbles:true}))
      }, {ariaLabel:'メロディ画面の音色', bubbleChange:true}),
    ])]
  }})
  app.mount(element)
  source.addEventListener('change', sync)
  document.addEventListener('melody-timbre-change', sync)
  return {element, unmount:() => {
    source.removeEventListener('change', sync)
    document.removeEventListener('melody-timbre-change', sync)
    app.unmount()
  }}
}
