import { createApp, h, nextTick, shallowRef } from './vendor/vue.runtime.esm-browser.prod.js'

/** @typedef {{ label: string, value: string, selected: boolean, preview?: () => void }} Choice */
/** @typedef {{ heading?: string, choices: Choice[] }} Group */

/** @param {'select' | 'quality'} kind */
export function createChoiceMenu(kind) {
  const dialog = document.createElement('dialog')
  const prefix = kind + '-menu'
  dialog.className = prefix
  document.body.append(dialog)
  const groups = shallowRef(/** @type {Group[]} */ ([]))
  /** @type {HTMLSelectElement | null} */
  let source = null
  /** @param {string} value */
  function choose(value) {
    if (!source) return
    const changed = source.value !== value
    source.value = value
    source.dispatchEvent(new Event('change', { bubbles: true }))
    if (changed) source.dispatchEvent(new Event('part-user-change', { bubbles: true }))
    dialog.close()
  }
  createApp({
    render: () => groups.value.flatMap(group => [
      ...(group.heading ? [h('div', { class: prefix + '-heading' }, group.heading)] : []),
      ...group.choices.map(choice => {
        const option = h('button', {
          type: 'button',
          class: kind === 'quality' ? 'quality-menu-option' : undefined,
          'aria-current': choice.selected ? 'true' : undefined,
          onClick: () => choose(choice.value),
        }, choice.label)
        if (!choice.preview) return option
        return h('div', { class: 'quality-menu-row' }, [
          option,
          h('button', {
            type: 'button', class: 'quality-menu-preview', title: 'コードを試聴',
            'aria-label': (choice.label || 'コード') + 'を試聴', onClick: choice.preview,
          }, [h('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true', focusable: 'false' }, [
            h('path', { d: 'M4 10h4l5-4v12l-5-4H4zM16 9c1.5 1.5 1.5 4.5 0 6M19 6c3.5 3 3.5 9 0 12' }),
          ])]),
        ])
      }),
    ]),
  }).mount(dialog)
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close() })
  dialog.addEventListener('close', () => {
    source?.focus({ preventScroll: true })
    source = null
    groups.value = []
  })
  return {
    get busy() { return source !== null },
    /** @param {HTMLSelectElement} select @param {string} label @param {Group[]} items
     * @param {{left: number, top: number, width: number, height: number}} bounds */
    async open(select, label, items, bounds) {
      if (source || select.disabled) return
      source = select
      groups.value = items
      dialog.setAttribute('aria-label', label)
      Object.assign(dialog.style, {
        left: bounds.left + 'px', top: bounds.top + 'px',
        width: bounds.width + 'px', maxHeight: bounds.height + 'px',
      })
      await nextTick()
      dialog.showModal()
      if (kind === 'quality') dialog.scrollTop = 0
      const selected = kind === 'select' ? dialog.querySelector('button[aria-current="true"]') : null
      const first = /** @type {HTMLButtonElement | null} */ (selected || dialog.querySelector('button'))
      first?.focus({ preventScroll: kind === 'quality' })
    },
  }
}

/** Mount the shared native-select adapter once at application startup. */
export function mountSelectMenus() {
const selectMenu = createChoiceMenu('select')
/** @param {HTMLSelectElement} select */
function openSelectMenu(select) {
  if (select.disabled || selectMenu.busy) return
  const groups = Array.from(select.children, child => {
    const group = child instanceof HTMLOptGroupElement ? child : null
    const options = group ? Array.from(group.children) : [child]
    return {
      heading: group?.label,
      choices: options.flatMap(option => {
        if (!(option instanceof HTMLOptionElement) || option.disabled || option.hidden || group?.disabled) return []
        return [{ label: option.textContent || '', value: option.value, selected: option.selected }]
      }),
    }
  })
  const label = select.getAttribute('aria-label') || select.closest('label')?.childNodes[0]?.textContent?.trim() || '選択肢'
  const rect = select.getBoundingClientRect()
  const width = Math.min(Math.max(rect.width, 180), window.innerWidth - 16)
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))
  const height = Math.min(320, window.innerHeight - 16)
  const top = Math.max(8, Math.min(rect.bottom + 4, window.innerHeight - height - 8))
  void selectMenu.open(select, label, groups, { left, top, width, height })
}
document.addEventListener('pointerdown', event => {
  const select = event.target instanceof Element ? event.target.closest('select') : null
  if (!select || select.classList.contains('quality-select') || select.disabled) return
  event.preventDefault()
  openSelectMenu(select)
})
document.addEventListener('keydown', event => {
  const select = event.target instanceof HTMLSelectElement ? event.target : null
  if (!select || select.classList.contains('quality-select') || select.disabled) return
  if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(event.key)) {
    event.preventDefault()
    openSelectMenu(select)
  }
})


}
