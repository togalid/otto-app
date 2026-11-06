import { createApp, h, ref } from './vendor/vue.runtime.esm-browser.prod.js'

/** @param {() => void} togglePlayback */
export function mountTransport(togglePlayback) {
  const running = ref(false)
  const beat = ref('')
  createApp({
    render: () => [
      h('label', { class: 'count-in-option' }, [
        h('input', { id: 'count-in', type: 'checkbox', checked: true }),
        ' カウントイン',
      ]),
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
