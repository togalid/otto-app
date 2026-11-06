import { createApp, h, nextTick, shallowRef } from './vendor/vue.runtime.esm-browser.prod.js'

/** @param {HTMLElement[]} slots @param {() => void} refresh */
export function mountMobileChordEditor(slots, refresh) {
  const dialog = document.createElement('dialog')
  dialog.className = 'mobile-editor'
  dialog.setAttribute('aria-label', 'コードを編集')
  document.body.append(dialog)
  /** @type {HTMLButtonElement | null} */
  let trigger = null
  const content = shallowRef(/** @type {ReturnType<typeof h>[]} */ ([]))
  createApp({ render: () => content.value }).mount(dialog)
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close() })
  dialog.addEventListener('close', () => {
    trigger?.focus({ preventScroll: true })
    trigger = null
    content.value = []
  })

  slots.forEach((slot, bar) => {
    slot.querySelectorAll('.beat-chord').forEach((cell, beat) => {
      const host = document.createElement('span')
      host.style.display = 'contents'
      cell.append(host)
      const root = /** @type {HTMLSelectElement} */ (cell.querySelector('.root-select'))
      const quality = /** @type {HTMLSelectElement} */ (cell.querySelector('.quality-select'))
      const modulationLabel = `${Math.floor(bar / 2) * 2 + 1}〜${Math.floor(bar / 2) * 2 + 2}小節の転調`
      /** @param {Element} element @returns {ReturnType<typeof h>} */
      function option(element) {
        if (element instanceof HTMLOptGroupElement) {
          return h('optgroup', { label: element.label, disabled: element.disabled }, Array.from(element.children, option))
        }
        const item = /** @type {HTMLOptionElement} */ (element)
        return h('option', { value: item.value, disabled: item.disabled }, item.textContent)
      }
      function sync() {
        content.value = [
          h('h2', `${bar + 1}小節 · ${beat + 1}拍目`),
          ...[[root, 'ルート'], [quality, '響き・テンション']].map(([input, name]) => {
            const source = /** @type {HTMLSelectElement} */ (input)
            const label = String(name)
            return h('label', [label, h('select', {
              'aria-label': label,
              value: source.value,
              disabled: source.hidden,
              onChange: (/** @type {Event} */ event) => {
                source.value = /** @type {HTMLSelectElement} */ (event.currentTarget).value
                source.dispatchEvent(new Event('change', { bubbles: true }))
                sync()
              },
            }, Array.from(source.children, option))])
          }),
          h('div', { class: 'mobile-editor-actions' }, [
            h('button', { type: 'button', onClick: () => cell.querySelector('button.chord-preview')?.dispatchEvent(new MouseEvent('click', { bubbles: true })) }, '▶ 試聴'),
            h('span', modulationLabel),
            ...[['−', '下げる', '.modulation-down'], ['＋', '上げる', '.modulation-up']].map(([text, label, selector]) => h('button', {
              type: 'button', 'aria-label': modulationLabel + 'を半音' + label,
              onClick: () => {
                document.querySelectorAll('.modulation-bar')[Math.floor(bar / 2)]?.querySelector(/** @type {string} */ (selector))?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
                sync()
              },
            }, text)),
          ]),
          h('button', { type: 'button', onClick: () => dialog.close() }, '完了'),
        ]
      }
      createApp({
        render: () => h('button', {
          type: 'button', class: 'mobile-chord-edit', 'aria-label': `${bar + 1}小節 ${beat + 1}拍目を編集`,
          onClick: async (/** @type {MouseEvent} */ event) => {
            if (trigger) return
            trigger = /** @type {HTMLButtonElement} */ (event.currentTarget)
            refresh()
            sync()
            await nextTick()
            dialog.showModal()
            dialog.querySelector('select')?.focus()
          },
        }),
      }).mount(host)
    })
  })
}
