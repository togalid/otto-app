export {}
const skins = ['milk', 'natural', 'bauhaus', 'toy']
const storageKey = 'oto-skin'
const root = document.documentElement
/** @param {string | null} value */
function applySkin(value) {
  const skin = value && skins.includes(value) ? value : 'milk'
  root.dataset.skin = skin
  document.querySelectorAll('input[name="skin"]').forEach((element) => {
    const input = /** @type {HTMLInputElement} */ (element)
    input.checked = input.value === skin
  })
  const color = getComputedStyle(root).getPropertyValue('--oto-page').trim()
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color)
}
try { applySkin(localStorage.getItem(storageKey)) } catch { applySkin('milk') }
const dialog = /** @type {HTMLDialogElement} */ (document.querySelector('#appearance-dialog'))
const opener = /** @type {HTMLButtonElement} */ (document.querySelector('#appearance-open'))
opener.addEventListener('click', () => dialog.showModal())
let closing = false
async function closeAppearance() {
  if (closing || !dialog.open) return
  closing = true
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const animation = dialog.animate([{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(.97)' }], { duration: 100, easing: 'ease-in' })
    await animation.finished.catch(() => {})
  }
  dialog.close()
  closing = false
}
dialog.addEventListener('cancel', event => { event.preventDefault(); void closeAppearance() })
document.querySelector('#appearance-close')?.addEventListener('click', () => { void closeAppearance() })
dialog.addEventListener('click', (event) => { if (event.target === dialog) {
  const bounds = dialog.getBoundingClientRect()
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) void closeAppearance()
} })
dialog.addEventListener('close', () => opener.focus())
document.querySelectorAll('input[name="skin"]').forEach((element) => {
  element.addEventListener('change', () => {
    const input = /** @type {HTMLInputElement} */ (element)
    if (!input.checked) return
    applySkin(input.value)
    try { localStorage.setItem(storageKey, input.value) } catch { /* Optional preference storage. */ }
  })
})
