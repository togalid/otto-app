import { scorePagination } from './score-navigation.js'
import { barMeters, maxChordBeats } from './progression.js'
import { keys } from './music.js'
import * as Vue from './vendor/vue.runtime.esm-browser.prod.js'
const { createApp, h } = Vue
const Teleport = Reflect.get(Vue, 'Teleport')

/** @param {{label:string, id?:string, onChange:(input:HTMLInputElement)=>void}} options */
export function scoreTempoInput({label, id, onChange}) {
  return h('label', {class:'score-bar-tempo-label'}, [
    h('span', {'aria-hidden':'true'}, '♪'),
    h('input', {
      id, type:'number', min:40, max:200, step:0.1, inputmode:'decimal',
      class:'score-bar-tempo', 'aria-label':label,
      onChange:(/** @type {Event} */ event)=>onChange(/** @type {HTMLInputElement} */ (event.currentTarget)),
      onKeydown:(/** @type {KeyboardEvent} */ event)=>{
        if (event.key === 'Enter') /** @type {HTMLInputElement} */ (event.currentTarget).blur()
      },
    }),
  ])
}

/** @param {{label:string, id?:string, transpose:(delta:number)=>void}} options */
export function scoreKeyStepper({label, id, transpose}) {
  return h('div', {class:'style-stepper score-bar-key'}, [
    h('output', {id, class:'score-bar-key-value', 'aria-label':label}),
    h('button', {type:'button', 'aria-label':label + 'を半音下げる', onClick:()=>transpose(-1)}, '−'),
    h('button', {type:'button', 'aria-label':label + 'を半音上げる', onClick:()=>transpose(1)}, '＋'),
  ])
}

/** @typedef {{ selectStart: (bar: number) => void, barSetting: (bar: number, field: keyof import('./progression.js').BarSettings, value: number | import('./progression.js').BarMeter | undefined) => void,
 * transpose: (bar: number, delta: number) => void,
 * root: (bar: number, beat: number, value: string) => void,
 * quality: (bar: number, beat: number, select: HTMLSelectElement) => void,
 * openQuality: (select: HTMLSelectElement, bar: number, beat: number) => void,
 * refresh: () => void, preview: (bar: number, beat: number) => void }} Actions */

/** Mount the score controls. Native selects remain the bridge to the choice menus.
 * @param {number} bars @param {Actions} actions */
export function mountChordGrid(bars, actions) {
  /** @param {number} bar */
  function heading(bar) {
    const label = `${bar + 1}小節目`
    return h('div', {class: 'score-bar-heading'}, [
      h('button', {
        type: 'button', class: 'bar-label', 'aria-label': label + 'を再生開始位置にする',
        'aria-pressed': 'false', onClick: () => actions.selectStart(bar),
      }, String(bar + 1)),
      h('div', {class: 'score-bar-settings', role: 'group', 'aria-label': label + 'の設定'}, [
        scoreTempoInput({label:label + 'のBPM', onChange:input=>{
          if (input.validity.valid) actions.barSetting(bar, 'bpm', input.value ? input.valueAsNumber : undefined)
          else actions.refresh()
        }}),
        h('select', {
          class: 'score-bar-meter', 'aria-label': label + 'の拍子',
          onChange: (/** @type {Event} */ event) => {
            const {value} = /** @type {HTMLSelectElement} */ (event.currentTarget)
            actions.barSetting(bar, 'meter', barMeters.find(meter => String(meter) === value))
          },
        }, [h('option', {value: ''}), ...barMeters.map(meter => h('option', {value: meter}, typeof meter === 'number' ? `${meter}/4` : meter))]),
        scoreKeyStepper({label:label + 'のキー', transpose:delta=>actions.transpose(bar, delta)}),
      ]),
    ])
  }

  /** @param {number} bar @param {number} beat */
  function cell(bar, beat) {
    const label = `${bar + 1}小節 ${beat + 1}拍目`
    /** @param {Event} event */
    function open(event) {
      event.preventDefault()
      actions.openQuality(/** @type {HTMLSelectElement} */ (event.currentTarget), bar, beat)
    }
    return h('div', { class: 'base-chord beat-chord' }, [
      h('button', {type:'button', class:'score-chord-edit', 'aria-label':label+'をPadで編集'}),
      h('span', { class: 'root-wrapper' }, [
        h('span', { class: 'root-display', 'aria-hidden': 'true' }),
        h('select', {
          tabindex:-1, 'aria-hidden':'true', class: 'root-select', 'aria-label': label + 'のルート', title: 'タップまたはEnterでPad入力',
          onChange: (/** @type {Event} */ event) => actions.root(bar, beat, /** @type {HTMLSelectElement} */ (event.currentTarget).value),
        }),
      ]),
      h('select', {
        tabindex:-1, 'aria-hidden':'true', class: 'quality-select',
        onChange: (/** @type {Event} */ event) => actions.quality(bar, beat, /** @type {HTMLSelectElement} */ (event.currentTarget)),
        onBlur: actions.refresh,
        onPointerdown: open,
        onKeydown: (/** @type {KeyboardEvent} */ event) => {
          if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(event.key)) open(event)
        },
      }),

    ])
  }

  createApp({
    render: () => Array.from({ length: bars }, (_, bar) =>
      h('div', { class: ['chord-slot', { 'first-in-pair': bar % 2 === 0 }] }, [
        heading(bar),
        ...Array.from({ length: maxChordBeats }, (_, beat) => cell(bar, beat)),
      ])),
  }).mount('#chord-slots')
  return Array.from(document.querySelectorAll('#chord-slots .chord-slot'), element => /** @type {HTMLElement} */ (element))
}

/** @typedef {{value:number}} NumberState */
/** @param {{progression:import('./progression.js').Progression, sectionContextRevision:NumberState,
 * playingSection:NumberState, editingSection:NumberState, meterInput:HTMLInputElement, tempo:HTMLInputElement}} state */
export function mountScoreContext({progression, sectionContextRevision, playingSection, editingSection, meterInput, tempo}) {
createApp({render:()=>{
  sectionContextRevision.value
  const index=playingSection.value>=0 ? playingSection.value : editingSection.value
  const section=progression.sections[index]
  const key=keys[section.key ?? progression.key].name
  const meter=section.meter ?? Number(meterInput.value)
  const bpm=progression.referenceBpm ?? section.bpm ?? Number(tempo.value)
  return h('div',{class:'score-context'},[
    h('span',`キー ${key}`),h('span',`${meter}/4`),h('span',`♩ ${bpm}`),
  ])
}}).mount('#score-section-context')

}

export function mountMobileScoreTools() {
// The unified Pad trigger handles desktop and mobile chord editing.
const chordDetail = document.querySelector('#detail-chord')
for (const [className, label] of [['mobile-options', 'キー・表示'], ['mobile-monitor', '鍵盤・指板']]) {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = className
  button.textContent = className === 'mobile-monitor' ? '♬' : label
  button.setAttribute('aria-label', label + 'を開閉')
  button.setAttribute('aria-expanded', 'false')
  button.addEventListener('click', () => button.setAttribute('aria-expanded', String(button.getAttribute('aria-expanded') !== 'true')))
  chordDetail?.querySelector('.chord-heading')?.append(button)
}
const positionButton = document.createElement('button')
positionButton.type = 'button'
positionButton.className = 'mobile-position'
positionButton.textContent = '演奏位置へ'
positionButton.addEventListener('click', () => document.querySelector('.chord-slot.current')?.scrollIntoView({ block: 'center', behavior: 'smooth' }))
chordDetail?.append(positionButton)

const scoreHint = document.createElement('p')
scoreHint.className = 'mobile-score-hint'
scoreHint.textContent = 'コードをタップして編集。＋で音の変わり目を追加。'
chordDetail?.querySelector('.chord-grid-scroll')?.before(scoreHint)


}

/** @param {{sectionBars:NumberState, changeBarCount:(delta:number)=>void}} state */
export function mountScoreBarCount({sectionBars, changeBarCount}) {
createApp({setup: () => () => h('div', {class:'section-bar-count'}, [
  h('span', {}, '小節数'),
  h('div', {class:'style-stepper'}, [
    h('button', {type:'button', disabled:sectionBars.value <= 1, 'aria-label':'小節数を減らす', onClick:() => changeBarCount(-1)}, '−'),
    h('output', {'aria-live':'polite'}, String(sectionBars.value)),
    h('button', {type:'button', disabled:sectionBars.value >= 1024, 'aria-label':'小節数を増やす', onClick:() => changeBarCount(1)}, '＋'),
  ]),
])}).mount('#section-bar-count')

}

/** @param {{scorePage:NumberState, sectionBars:NumberState, refreshLabels:()=>void, changeBarCount:(delta:number)=>void}} state */
export function mountScorePaging({scorePage, sectionBars, refreshLabels, changeBarCount}) {
  const scoreHeading = document.querySelector('#detail-chord .chord-heading')
  const scoreSettings = document.querySelector('#detail-chord .chord-settings')
  const host = document.querySelector('#score-pagination')
  if (scoreHeading && scoreSettings) scoreSettings.after(scoreHeading)
  if (!host) return
  createApp({render:()=>[scorePagination({
    page:scorePage.value, pageSize:16, totalBars:sectionBars.value, maxBars:Math.max(100, sectionBars.value), label:'コード進行のページ', leadingLabel:'page',
    onPageChange:page=>{
      if (page * 16 >= sectionBars.value) changeBarCount(Math.min(16, 100 - sectionBars.value))
      scorePage.value = page
      refreshLabels()
    },
  }), h(Teleport, {to:'#score-length-host'}, h('label', {class:'score-length'}, [
    h('span', '小節数'),
    h('input', {type:'number', min:1, max:100, step:1, value:sectionBars.value, 'aria-label':'曲の小節数', onChange:(/** @type {Event} */ event)=>{
      const input = /** @type {HTMLInputElement} */ (event.currentTarget)
      if (input.value && input.validity.valid) changeBarCount(input.valueAsNumber - sectionBars.value)
      input.value = String(sectionBars.value)
    }}),
  ]))]}).mount(host)
}
