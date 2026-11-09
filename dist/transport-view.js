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

/** Presentation only: seeking and restarting audio remain with the application.
 * @param {{current:()=>number, count:()=>number, seek:(bar:number)=>void}} actions */
export function mountPlayhead(actions) {
  const element = document.createElement('div')
  element.className = 'melody-playhead'
  element.setAttribute('aria-label', '現在の再生位置')
  document.querySelector('.mixer-score-link')?.before(element)
  const reset = () => { input.value = String(actions.current() + 1) }
  createApp({render: () => [
    h('div', {class:'style-stepper melody-navigation melody-navigation-start'}, [
      h('button', {type:'button', 'aria-label':'1小節目に戻る', onClick:()=>actions.seek(0)}, '|<'),
    ]),
    h('label', {class:'melody-bar-input'}, [
      h('input', {type:'number', min:1, step:1, value:1, 'aria-label':'移動する小節',
        onFocus:()=>{ input.max = String(actions.count()) },
        onChange:()=>{
          const value = Number(input.value)
          if (input.value.trim() && Number.isFinite(value)) actions.seek(value - 1)
          else reset()
        },
        onKeydown:(/** @type {KeyboardEvent} */ event)=>{
          if (event.key === 'Enter') input.blur()
          if (event.key === 'Escape') { reset(); input.blur() }
        },
      }), h('span', '小節'),
    ]),
    h('div', {class:'style-stepper melody-navigation'}, [-1,1].map(direction =>
      h('button', {type:'button', 'aria-label':direction<0?'前の小節へ':'次の小節へ', onClick:()=>actions.seek(actions.current()+direction)}, direction<0?'←':'→'),
    )),
  ]}).mount(element)
  const input = /** @type {HTMLInputElement} */ (element.querySelector('input'))
  return {element, input}
}
