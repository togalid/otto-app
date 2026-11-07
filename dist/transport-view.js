import { createApp, h, ref } from './vendor/vue.runtime.esm-browser.prod.js'

/** @param {() => void} togglePlayback */
export function mountTransport(togglePlayback) {
  const running = ref(false)
  const beat = ref('')
  createApp({ render: () => [
    h('span', {class: 'count-in-label'}, 'カウントイン'),
    h('input', {id: 'count-in', type: 'checkbox', checked: false, value: '0', hidden: true}),
    h('fieldset', {class: 'segmented-control count-in-switch', 'aria-label': 'カウントイン'}, [
      h('legend', {class: 'sr-only'}, 'カウントイン'),
      ...[['4', '4拍'], ['2', '2拍'], ['0', 'なし']].map(([value, label]) => h('label', [
        h('input', {type: 'radio', name: 'count-in-choice', value, checked: value === '0', onChange: () => {
          const control = /** @type {HTMLInputElement} */ (document.getElementById('count-in'))
          control.checked = value !== '0'; control.value = value
          control.dispatchEvent(new Event('change', {bubbles: true}))
        }}), h('span', label),
      ])),
    ]),
  ] }).mount('#count-in-control')
  const countControl = /** @type {HTMLInputElement} */ (document.getElementById('count-in'))
  countControl.addEventListener('change', () => {
    const value = countControl.checked ? (countControl.value === '2' ? '2' : '4') : '0'
    const choice = /** @type {HTMLInputElement | null} */ (document.querySelector(`input[name="count-in-choice"][value="${value}"]`))
    if (choice) choice.checked = true
  })
  createApp({
    render: () => [
      h('button', {
        id: 'progression-play',
        type: 'button',
        'aria-keyshortcuts': 'Space',
        title: 'スペースキーで再生・停止',
        'aria-pressed': String(running.value),
        'data-beat': beat.value,
        onClick: togglePlayback,
      }, [
        h('span', { class: 'transport-label' }, running.value ? '■ 停止' : '▶ 再生'),
        h('span', { class: 'beat-strip', 'aria-hidden': 'true' }, Array.from({ length: 4 }, () => h('i'))),
      ]),
    ],
  }).mount('#transport')
  return { running, beat }
}
