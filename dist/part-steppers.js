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
    const options = () => Array.from(select.options).filter(option => !option.disabled && !option.parentElement?.hasAttribute('disabled'))
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
    Array.from(select.options).forEach((option, index) => {
      option.textContent = `${String(index + 1).padStart(2, '0')}: ${option.textContent ?? ''}`
    })
    const syncTitle = () => { select.title = select.selectedOptions[0]?.textContent ?? '' }
    select.addEventListener('change', syncTitle)
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
