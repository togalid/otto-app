export {}
const skins = ['milk', 'toy', 'soda']
const storageKey = 'oto-skin'
const root = document.documentElement
/** @param {string | null} value */
function applySkin(value) {
  const skin = value && skins.includes(value) ? value : 'milk'
  root.dataset.skin = skin
  const color = getComputedStyle(root).getPropertyValue('--oto-page').trim()
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color)
}
try { applySkin(localStorage.getItem(storageKey)) } catch { applySkin('milk') }
const settingsMenu = /** @type {HTMLDetailsElement} */ (document.getElementById('settings-menu'))
const settingsOpen = /** @type {HTMLElement} */ (document.getElementById('settings-open'))
settingsMenu.addEventListener('click', event => {
  if (!(event.target instanceof HTMLButtonElement)) return
  settingsMenu.open = false
  settingsOpen.focus()
})
settingsMenu.addEventListener('keydown', event => {
  if (event.key !== 'Escape' || !settingsMenu.open) return
  event.preventDefault()
  settingsMenu.open = false
  settingsOpen.focus()
})
document.addEventListener('pointerdown', event => {
  if (event.target instanceof Node && !settingsMenu.contains(event.target)) settingsMenu.open = false
})
const dialog = /** @type {HTMLDialogElement} */ (document.querySelector('#appearance-dialog'))
const opener = /** @type {HTMLButtonElement} */ (document.querySelector('#appearance-open'))
/** @type {Promise<ReturnType<import('./appearance-dialog.js').mountAppearanceDialog>> | undefined} */
let appearancePromise
const homeOpener = /** @type {HTMLButtonElement} */ (document.querySelector('#mode-appearance'))
let lastOpener = opener
async function openAppearance(/** @type {HTMLButtonElement} */ trigger) {
  lastOpener = trigger
  trigger.disabled = true
  try {
    appearancePromise ??= import('./appearance-dialog.js').then(({ mountAppearanceDialog }) =>
      mountAppearanceDialog({ current: () => root.dataset.skin || 'milk', select: selectSkin, close: () => { void closeAppearance() } }))
    const appearance = await appearancePromise
    appearance.open()
  } catch {
    appearancePromise = undefined
    settingsOpen.title = '外観設定を開けませんでした。もう一度お試しください。'
  } finally { trigger.disabled = false }
}
opener.addEventListener('click', () => { void openAppearance(opener) })
homeOpener.addEventListener('click', () => { void openAppearance(homeOpener) })
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
dialog.addEventListener('click', (event) => { if (event.target === dialog) {
  const bounds = dialog.getBoundingClientRect()
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) void closeAppearance()
} })
dialog.addEventListener('close', () => (lastOpener === opener ? settingsOpen : lastOpener).focus())
/** @param {string} skin */
function selectSkin(skin) {
  applySkin(skin)
  try { localStorage.setItem(storageKey, skin) } catch { /* Optional preference storage. */ }
}
