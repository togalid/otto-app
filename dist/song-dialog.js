// Local Vue runtime is loaded only when the settings dialog is first opened.
// @ts-ignore The vendored browser runtime is JavaScript without type declarations.
import { createApp, h, ref } from './vendor/vue.runtime.esm-browser.prod.js'

/** @param {{save: () => string, load: (file: File) => Promise<string>, loadDefault?: () => Promise<string>, onClose: () => void}} actions */
export function mountSongDialog(actions) {
  const dialog = /** @type {HTMLDialogElement} */ (document.querySelector('#song-dialog'))
  const status = ref('')
  /** @type {HTMLInputElement | null} */
  let fileInput = null
  let loading = false
  const app = createApp({
    setup() {
      /** @param {Event} event */
      async function selectFile(event) {
        const input = /** @type {HTMLInputElement} */ (event.target)
        const file = input.files?.[0]
        if (!file || loading) return
        loading = true
        try { status.value = await actions.load(file) }
        finally { input.value = ''; loading = false }
      }
      async function loadDefault() {
        if (!actions.loadDefault || loading) return
        loading = true
        try { status.value = await actions.loadDefault() }
        finally { loading = false }
      }
      return () => [
        h('div', { class: 'dialog-heading' }, [
          h('h2', { id: 'song-title' }, '設定保存／ロード'),
          h('button', { id: 'song-close', class: 'dialog-close', type: 'button', 'aria-label': '閉じる', onClick: () => dialog.close() }, '×'),
        ]),
        h('div', { class: 'reference-row' }, [
          h('button', { id: 'song-save', type: 'button', onClick: () => { status.value = actions.save() } }, '編成JSONを書き出す'),
          h('button', { id: 'song-load', type: 'button', onClick: () => fileInput?.click() }, '編成JSONを読み込む'),
        ]),
        actions.loadDefault ? h('div', { class: 'reference-row' }, [
          h('button', { id: 'song-load-default', type: 'button', onClick: loadDefault }, 'コネクト・スカイの既定の編成を読み込む'),
        ]) : null,
        h('input', { id: 'song-file', type: 'file', accept: '.json,application/json', hidden: true,
          ref: (/** @type {unknown} */ element) => { fileInput = /** @type {HTMLInputElement | null} */ (element) }, onChange: selectFile }),
        h('p', { id: 'song-status', role: 'status' }, status.value),
      ]
    },
  })
  app.mount(dialog)
  dialog.addEventListener('close', actions.onClose)
  return { open: () => dialog.showModal() }
}
