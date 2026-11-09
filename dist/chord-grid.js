import { keys } from './music.js'
import { splitSongSection } from './song-score.js'
import { createApp, h } from './vendor/vue.runtime.esm-browser.prod.js'

/** @typedef {{ play: (bar: number) => void, modulate: (section: number, amount: number) => void,
 * root: (bar: number, beat: number, value: string) => void,
 * quality: (bar: number, beat: number, select: HTMLSelectElement) => void,
 * openQuality: (select: HTMLSelectElement, bar: number, beat: number) => void,
 * refresh: () => void, preview: (bar: number, beat: number) => void }} Actions */

/** Mount the score controls. Native selects remain the bridge to the choice menus.
 * @param {number} bars @param {Actions} actions */
export function mountChordGrid(bars, actions) {
  /** @param {number} bar */
  function modulation(bar) {
    const pair = `${bar + 1}〜${bar + 2}小節`
    return h('div', { class: 'modulation-bar', role: 'group', 'aria-label': pair + 'の設定' }, [
      h('span', '転調'),
      h('output', { class: 'modulation-value', 'aria-live': 'polite' }),
      h('div', { class: 'key-stepper modulation-stepper', role: 'group', 'aria-label': pair + 'のキーを半音ずつ変更' }, [
        h('button', { type: 'button', class: 'modulation-down', 'aria-label': pair + 'のキーを半音下げる', onClick: () => actions.modulate(bar / 2, -1) }, '−'),
        h('button', { type: 'button', class: 'modulation-up', 'aria-label': pair + 'のキーを半音上げる', onClick: () => actions.modulate(bar / 2, 1) }, '＋'),
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
    render: () => Array.from({ length: bars }, (_, bar) => [
      ...(bar % 2 === 0 ? [modulation(bar)] : []),
      h('div', { class: ['chord-slot', { 'first-in-pair': bar % 2 === 0 }] }, [
        h('span', { class: 'bar-label' }, String(bar + 1)),
        ...Array.from({ length: 5 }, (_, beat) => cell(bar, beat)),
      ]),
    ]).flat(),
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
    h('span',{class:'score-context-section'},`${section.name ?? String.fromCharCode(65+index)} · ${(section.startBar ?? 0)+1}〜${section.endBar ?? progression.barCount()}小節`),
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

/** @param {{progression:import('./progression.js').Progression, sectionRangeRevision:NumberState,
 * sectionContextRevision:NumberState, editingSection:NumberState, playingSection:NumberState,
 * sectionBars:NumberState, editSection:(index:number)=>void, changeBarCount:(delta:number)=>void,
 * refreshLabels:()=>void}} state */
export function mountScoreSections({progression, sectionRangeRevision, sectionContextRevision, editingSection, playingSection, sectionBars, editSection, changeBarCount, refreshLabels}) {
createApp({
  render: () => (sectionRangeRevision.value, sectionContextRevision.value, [
    ...progression.sections.map((_, index) => {const name=progression.sections[index].name ?? String.fromCharCode(65+index);return h('button', {
      type: 'button', 'aria-label': `セクション${name}を編集`,
      'aria-pressed': String(index === editingSection.value),
      'data-playing': index === playingSection.value ? 'true' : undefined,
      onClick: () => editSection(index),
    }, name)}),
    h('div',{class:'section-style-summary'}, `範囲 ${(progression.sections[editingSection.value].startBar ?? 0)+1}〜${progression.sections[editingSection.value].endBar ?? progression.barCount()}小節`),
    h('div',{class:'song-range-settings',key:sectionRangeRevision.value},[
      h('span',`${(progression.sections[editingSection.value].startBar ?? 0)+1}小節〜`),
      h('input',{type:'number',min:(progression.sections[editingSection.value].startBar ?? 0)+1,max:editingSection.value===progression.sections.length-1?1024:(progression.sections[editingSection.value+1].endBar ?? progression.barCount())-1,value:progression.sections[editingSection.value].endBar,'aria-label':'セクションの終了小節',onChange:(/** @type {Event} */ event)=>{
        const input=/** @type {HTMLInputElement} */(event.target), index=editingSection.value
        const next=progression.sections[index+1]
        const value=Math.round(Number(input.value)), current=progression.sections[index]
        if(!Number.isFinite(value)||value<1||value>1024){input.value=String(current.endBar);return}
        if(!next&&value>=progression.barCount()){
          changeBarCount(value-progression.barCount());sectionRangeRevision.value++
        }
        else if(!next&&value>(current.startBar ?? 0)&&value<progression.barCount()){
          if(splitSongSection(progression.sections,index)){
            current.endBar=value;progression.sections[index+1].startBar=value
            sectionRangeRevision.value++;refreshLabels()
          }
        }
        else if(next&&value>(current.startBar ?? 0)&&value<=(next.endBar ?? 0)-1){current.endBar=value;if(next)next.startBar=value;sectionRangeRevision.value++;refreshLabels()}
        else input.value=String(current.endBar)
      }}),
    ]),
  ]),
}).mount('#song-sections')

createApp({setup: () => () => h('div', {class:'section-bar-count'}, [
  h('span', {}, '小節数'),
  h('div', {class:'style-stepper'}, [
    h('button', {type:'button', disabled:sectionBars.value <= 1, 'aria-label':'小節数を減らす', onClick:() => changeBarCount(-1)}, '−'),
    h('output', {'aria-live':'polite'}, String(sectionBars.value)),
    h('button', {type:'button', disabled:sectionBars.value >= 1024, 'aria-label':'小節数を増やす', onClick:() => changeBarCount(1)}, '＋'),
  ]),
])}).mount('#section-bar-count')

}

/** @param {{scorePage:NumberState, sectionBars:NumberState, refreshLabels:()=>void}} state */
export function mountScorePaging({scorePage, sectionBars, refreshLabels}) {
const scorePaging=document.createElement('div')
scorePaging.className='score-paging compact-playhead'
document.getElementById('section-bar-count')?.after(scorePaging)
const scoreHeading=document.querySelector('#detail-chord .chord-heading')
const scoreSettings=document.querySelector('#detail-chord .chord-settings')
if(scoreHeading && scoreSettings)scoreSettings.after(scoreHeading)
createApp({setup:()=>()=>h('div',{class:'part-choice-picker',role:'group','aria-label':'コード進行のページ'},[
 h('output',{'aria-live':'polite'},`${scorePage.value*16+1}〜${Math.min((scorePage.value+1)*16,sectionBars.value)}小節`),
 h('div',{class:'style-stepper part-choice-steps'},[
 h('button',{type:'button',disabled:scorePage.value===0,'aria-label':'前の16小節',onClick:()=>{scorePage.value--;refreshLabels()}},'←'),
 h('button',{type:'button',disabled:(scorePage.value+1)*16>=sectionBars.value,'aria-label':'次の16小節',onClick:()=>{scorePage.value++;refreshLabels()}},'→'),
 ]),
])}).mount(scorePaging)


}
