import { mountSongSession } from './song-session.js'
import { mountDrumTutorial } from './drum-tutorial.js'
import { mountTutorial } from './tutorial-view.js'
import { lessons, readDevelopmentScreen, saveDevelopmentScreen } from './tutorial.js'
import { createApp, h, ref } from './vendor/vue.runtime.esm-browser.prod.js'
import { genres } from './groove.js'
import { presets, notes, melodyPalette, melodyRole, displayChordParts } from './music.js'

/** Pads depend on harmony, not on each incoming melody note. Keep one current
 * palette and stable DOM references; feedback alone changes while Otto plays.
 * @param {HTMLButtonElement[]} buttons
 * @param {Pick<Document, 'querySelector'>} [root] */
export function createMelodyView(buttons, root = document) {
  const pads = buttons.map(button => ({
    button,
    label: button.querySelector('.pad-note'),
    degree: button.querySelector('.pad-number'),
    role: button.querySelector('.pad-role'),
  }))
  const current = root.querySelector('#melody-current-chord')
  const feedback = root.querySelector('#melody-feedback')
  let signature = ''
  let palette = melodyPalette(0, 'FM7', 0, 'key')
  /** @param {Element | null} element @param {string} text */
  const setText = (element, text) => {
    if (element && element.textContent !== text) element.textContent = text
  }
  return {
    /** @param {number} key @param {string} chord @param {number} chordKey
     * @param {number | undefined} midi @param {string} degree */
    update(key, chord, chordKey, midi, degree) {
      const next = `${key}:${chord}:${chordKey}`
      if (next !== signature) {
        signature = next
        const scale = melodyPalette(key, chord, chordKey, 'key')
        // Start on the key's fifth: it is a chord tone over I, IV and V.
        // Keep the same pitches under the same keys when chords change.
        palette = Array.from({length: 8}, (_, index) => {
          const position = index + 4
          const note = scale[position % 7]
          return { ...note, midi: note.midi + (position >= 7 ? 12 : 0) }
        })
        pads.forEach(({button, label, degree, role}, index) => {
          const note = palette[index]
          setText(label, note.label)
          setText(degree, note.degree)
          setText(role, note.hint)
          button.dataset.role = note.category
          button.classList.toggle('pad-clash', note.clash)
          button.setAttribute('aria-label', `${note.label}、${note.degree}、${note.hint}を鳴らす（${notes[index].key.toUpperCase()}キー）`)
        })
        const parts = displayChordParts(chord, chordKey, 'chord')
        setText(current, parts.main + parts.suffix)
      }
      if (midi !== undefined) {
        const role = melodyRole(midi, chord, chordKey)
        setText(feedback, `${palette.find(note => note.midi === midi)?.label ?? 'さっきの音'} · ${degree === role.degree ? role.degree : degree + ' → ' + role.degree} — ${role.hint}`)
        degree = role.degree
      }
      return { notes: palette, degree }
    },
  }
}

/** @param {{play:(index:number,hold?:boolean)=>Promise<void>, release:(index:number)=>void, clickRelease:(index:number)=>void}} actions */
export function mountMelodyPads({play, release, clickRelease}) {
createApp({
  render: () => notes.map((note, index) => h('button', {
    class: 'pad',
    type: 'button',
    style: { '--pad-color': note.color },
    'aria-label': `${note.label} ${index >= 5 ? '高い音' : ''}を鳴らす（${note.key.toUpperCase()}キー）`,
    onPointerdown: (/** @type {PointerEvent} */ event) => {
      if (event.button !== 0) return
      const button = /** @type {HTMLButtonElement} */ (event.currentTarget)
      button.setPointerCapture(event.pointerId)
      void play(index, true)
    },
    onPointerup: () => release(index),
    onPointercancel: () => release(index),
    onLostpointercapture: () => release(index),
    onClick: (/** @type {MouseEvent} */ event) => {
      if (event.detail === 0) { void play(index); clickRelease(index) }
    },
  }, [
    h('span', { class: 'pad-number' }, String(index + 1).padStart(2, '0')),
    h('span', { class: 'pad-note' }, note.label),
    h('span', { class: 'pad-role' }),
    h('kbd', note.key.toUpperCase()),
  ])),
}).mount('#pads')
return Array.from(document.querySelectorAll('#pads button'), button => /** @type {HTMLButtonElement} */ (button))
}

/** Compose mounted melody components without remounting their audio controls.
 * @param {HTMLElement} melodyVoiceLabel */
export function mountMelodyLayout(melodyVoiceLabel) {
const melodyTopRow=document.createElement('div')
melodyTopRow.className='melody-top-row'
const melodyLabHost=document.querySelector('.otto-lab-host')
const buddyInline = document.querySelector('#buddy-inline')
buddyInline?.before(melodyTopRow)
if (buddyInline) melodyTopRow.append(buddyInline)
const melodyModeField = melodyLabHost?.querySelector('.otto-mode-field')
if (melodyModeField) melodyTopRow.append(melodyModeField)

const melodyChoices = document.createElement('div')
melodyChoices.className = 'melody-choice-row'
melodyChoices.append(melodyVoiceLabel)
const notation = document.querySelector('#notation')
if (notation) {
  const melodyNotation = /** @type {HTMLFieldSetElement} */ (notation.cloneNode(true))
  melodyNotation.removeAttribute('id')
  melodyNotation.classList.add('melody-notation')
  melodyNotation.querySelectorAll('input').forEach(input => { input.name = 'melody-notation' })
  const sync = () => {
    const selected = /** @type {HTMLInputElement | null} */ (notation.querySelector('input:checked'))?.value
    melodyNotation.querySelectorAll('input').forEach(input => { input.checked = input.value === selected })
  }
  melodyNotation.addEventListener('change', event => {
    const target = event.target
    if (!(target instanceof HTMLInputElement)) return
    const matching = Array.from(notation.querySelectorAll('input')).find(input => input.value === target.value)
    if (matching) { matching.checked = true; notation.dispatchEvent(new Event('change', {bubbles:true})) }
  })
  notation.addEventListener('change', sync)
  sync()
  melodyChoices.append(melodyNotation)
}
const melodyStyleField = melodyLabHost?.querySelector('.otto-style-choice')
if (melodyStyleField) melodyChoices.append(melodyStyleField)
for (const [field, kind] of /** @type {const} */ ([[melodyVoiceLabel, 'tone'], [melodyStyleField, 'advanced']])) {
  const picker = field?.querySelector('.part-choice-picker')
  const select = picker?.querySelector('select')
  const arrows = picker?.querySelector('.part-choice-steps')
  if (!picker || !select || !arrows) continue

  if (!picker.querySelector('.step-select')) {
  const stepSelect = document.createElement('div')
  stepSelect.className = 'step-select'
  stepSelect.setAttribute('role', 'group')
  stepSelect.setAttribute('aria-label', select.getAttribute('aria-label') || '選択')
  picker.prepend(stepSelect)
  stepSelect.append(select, arrows)
  }

  const toggle = melodyLabHost?.querySelector(`[data-melody-detail="${kind}"]`)
  if (toggle) picker.append(toggle)
}
document.querySelector('#piano-scroll')?.after(melodyChoices)
if (melodyLabHost) melodyChoices.after(melodyLabHost)

}

/** Visual feedback only; musical timing is supplied by the application.
 * @param {{genreSelect:HTMLSelectElement, presetSelect:HTMLSelectElement,
 * status:Element|null, progressionStatus:Element|null, startButton:HTMLButtonElement,
 * trackGrid:HTMLElement, running:()=>boolean, setStyle:(label:string,group:string)=>void}} options */
export function mountBuddyFeedback({genreSelect, presetSelect, status, progressionStatus, startButton, trackGrid, running, setStyle}) {
// Short responses belong to the object that the user just touched.
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
/** @type {WeakMap<Element, Animation>} */
const smallResponses = new WeakMap()
/** @param {Element | null} element @param {Keyframe[]} frames @param {number} [duration] */
function respondToTouch(element, frames, duration = 220) {
  if (!element || reducedMotion.matches) return
  smallResponses.get(element)?.cancel()
  const animation = element.animate(frames, { duration, easing: 'ease-out' })
  smallResponses.set(element, animation)
}
/** @param {Element | null} button */
function animatePartChange(button) {
  respondToTouch(button?.querySelector('.part-icon') ?? null, [
    { transform: 'translateY(0) rotate(0) scale(1)' },
    { transform: 'translateY(-5px) rotate(-12deg) scale(1.17)' },
    { transform: 'translateY(1px) rotate(6deg) scale(1.04)' },
    { transform: 'translateY(0) rotate(0) scale(1)' },
  ], 280)
}
const buddy = /** @type {HTMLButtonElement} */ (document.querySelector('#oto-buddy'))
const cropBuddy = /** @type {HTMLElement} */ (document.querySelector('.crop-buddy'))
const buddyIcon = buddy.querySelector('svg')
if (buddyIcon) cropBuddy.append(buddyIcon.cloneNode(true))
new MutationObserver(() => { cropBuddy.dataset.look = buddy.dataset.look }).observe(buddy, {attributes: true, attributeFilter: ['data-look']})
const buddyMessage = /** @type {HTMLElement} */ (document.querySelector('#buddy-message'))
// Musical listening cues describe the gesture rather than repeat control labels.
const arrangementCues = new Map([
  ['satin-comp', '低音のあとに上の音が応えるよ。和音の隙間にも耳を向けてみて。'],
  ['trance-weave', '同じ和音を行き来する細かな音が、流れを前へ運んでいくよ。'],
  ['whole', '音を伸ばすと、コードが替わる瞬間の色の違いがよく聴こえるよ。'],
  ['quarters', '一拍ずつ和音を置くと、低音との重なりがはっきりするね。'],
  ['eighths', '細かな刻みが、コードの流れに走る力を添えているよ。'],
  ['offbeat', '拍の間に和音が入るから、リズムが少し浮き上がる感じがするね。'],
  ['arpeggio', '和音を一音ずつほどくと、内側に隠れていた旋律が見えてくるよ。'],
  ['bass-chord', '低音と和音の受け答えが、伴奏にゆったりした歩幅を作るよ。'],
  ['key-run', '鍵盤の音が折り返すところで、伴奏にも小さな歌が生まれるね。'],
  ['cutting', '短く切った和音の隙間で、ドラムとベースが顔を出すよ。'],
  ['stabs', '和音が拍を先取りすると、次の一拍へ引っ張られる感じがするね。'],
  ['chip-riff', '短い音の反復で、コードにもフックができるよ。'],
  ['strum', '和音の音を少しずつずらして、弦を払うような広がりを作っているよ。'],
])
const buddyLooks = new Map([
  ['洋楽ポップ', 'glasses bow'], ['洋楽ロック', 'spikes glasses'], ['ジャズ', 'beret fringe'],
  ['J-POP', 'fringe'], ['ボカロ', 'headphones fringe lashes'],
  ['K-POP', 'glasses'], ['VTuberポップ', 'bow lashes'],
  ['アイドル', 'bow fringe'], ['アニソン', 'spikes'],
  ['きらめきポップ', 'bow lashes fringe'], ['EDM・同人エレクトロ', 'headphones'],
  ['PCゲーム音楽', 'headphones spikes'], ['ゲーム音楽', 'spikes headphones'],
  ['音楽ゲーム', 'glasses headphones'], ['ダンス・チル', 'glasses'],
  ['ニューミュージック', 'beret'], ['同人音楽', 'beret glasses'],
  ['幻想エレクトロ', 'fringe glasses'], ['電波・アキバポップ', 'bow headphones lashes'],
])
function refreshBuddyLook() {
  const group = genres.find(item => item.id === genreSelect.value)?.group ?? ''
  buddy.dataset.look = buddyLooks.get(group) ?? 'fringe'
}
genreSelect.addEventListener('change', refreshBuddyLook)
genreSelect.addEventListener('change', () => {
  const style = genres.find(item => item.id === genreSelect.value)
  setStyle(style?.label ?? '', style?.group ?? '')
})
refreshBuddyLook()
function refreshBuddy() {
  const failed = Boolean(status?.textContent?.trim() || progressionStatus?.textContent?.trim())
  const mood = failed ? 'error' : running() ? 'listening' : 'idle'
  if (buddy.dataset.mood === mood) return
  buddy.dataset.mood = mood
  buddy.title = failed ? '音の準備で困っています。表示されたメッセージを確認してね。' : running() ? '聴いてるよ。' : 'やあ。'
  buddy.setAttribute('aria-label', failed ? '再生エラー。画面のエラーメッセージを確認' : 'Otto（オットー）にあいさつ')
  respondToTouch(buddy.querySelector('svg'), [{ transform: 'translateY(0)' }, { transform: 'translateY(-2px)' }, { transform: 'translateY(0)' }])
}
buddy.addEventListener('click', () => {
  respondToTouch(buddy.querySelector('svg'), [
    { transform: 'rotate(0)' }, { transform: 'rotate(-9deg)' },
    { transform: 'rotate(7deg)' }, { transform: 'rotate(0)' },
  ], 340)
  respondToTouch(buddy.querySelector('.buddy-eyes'), [
    { transform: 'scaleY(1)' }, { transform: 'scaleY(.15)', offset: .4 }, { transform: 'scaleY(1)' },
  ], 260)
})
const buddyObserver = new MutationObserver(refreshBuddy)
for (const message of [status, progressionStatus]) {
  if (message) buddyObserver.observe(message, { childList: true, characterData: true, subtree: true })
}
buddyObserver.observe(startButton, { attributes: true, attributeFilter: ['aria-pressed'] })
refreshBuddy()
document.addEventListener('click', event => {
  const target = event.target instanceof Element ? event.target : null
  const part = target?.closest('.track-select')
  if (part) respondToTouch(part.querySelector('.part-icon'), [
    { transform: 'rotate(0)' }, { transform: 'rotate(-7deg)' }, { transform: 'rotate(4deg)' }, { transform: 'rotate(0)' },
  ])
  const step = target?.closest('.drum-step')
  if (step) respondToTouch(document.activeElement?.closest('.drum-step') ?? null, [
    { transform: 'scale(.88)' }, { transform: 'scale(1.07)' }, { transform: 'scale(1)' },
  ], 160)
})
document.addEventListener('change', event => {
  const target = event.target instanceof Element ? event.target : null
  if (target === genreSelect) {
    const genre = genres.find(item => item.id === genreSelect.value)
    if (genre) {
      const preset = presets.find(item => item.id === presetSelect.value)
      const cue = arrangementCues.get(genre.backing) ?? ''
      buddyMessage.textContent = [preset?.description, cue].filter(Boolean).join(' ')
    }
  } else if (target === presetSelect) {
    const preset = presets.find(item => item.id === presetSelect.value)
    if (preset) buddyMessage.textContent = preset.description
  } else if (target?.matches('#chord-slots .root-select, #chord-slots .quality-select')) {
    buddyMessage.textContent = 'コードを変えると、進行の響きも変わるよ。'
  }
  if (target?.matches('.melody-choice-row select')) {
    animatePartChange(trackGrid.querySelector('.track-select[data-track="melody"]'))
  }
  if (target?.matches('#genre, #preset')) {
    respondToTouch(document.querySelector('.track-select[aria-pressed="true"] .part-icon'), [
      { transform: 'translateY(0)' }, { transform: 'translateY(-3px)' }, { transform: 'translateY(0)' },
    ])
  }
})


return {animatePartChange, refreshBuddyLook}
}

/** Arrange the existing controls for narrow screens without remounting them. */
export function mountMobileLayout() {
  if (typeof matchMedia !== 'function') return
  const narrow = matchMedia('(max-width: 600px)')
  const mixer = document.querySelector('main > .groove')
  const transport = document.querySelector('#transport')
  const grid = document.querySelector('#track-grid')
  if (!mixer || !transport || !grid) return
  const panel = document.createElement('section')
  panel.className = 'mobile-performance-controls'
  panel.setAttribute('aria-label', '演奏の設定')
  panel.innerHTML = `
    <div class="mobile-control-row">
      <span>パート <strong class="mobile-part-name"></strong></span>
      <div class="style-stepper">
        <button type="button" aria-label="前のパート">←</button>
        <button type="button" aria-label="次のパート">→</button>
      </div>
    </div>
    <button type="button" class="mobile-control-row mobile-mixer-toggle" aria-expanded="false" aria-controls="mobile-performance-mixer">
      <span>テンポ / キー</span><strong class="mobile-key-tempo"></strong><span>ミキサー</span>
    </button>
    <div class="mobile-control-row mobile-play-row"></div>`
  mixer.id ||= 'mobile-performance-mixer'
  mixer.before(panel)
  const original = document.createComment('transport home')
  transport.before(original)
  const playRow = panel.querySelector('.mobile-play-row')
  const toggle = /** @type {HTMLButtonElement} */ (panel.querySelector('.mobile-mixer-toggle'))
  const partName = /** @type {HTMLElement} */ (panel.querySelector('.mobile-part-name'))
  const keyTempo = /** @type {HTMLElement} */ (panel.querySelector('.mobile-key-tempo'))
  const parts = ['メロディ', 'ドラム', 'ベース', 'バッキング']
  const ids = ['melody', 'drums', 'bass', 'chord']
  const partButtons = ids.map(id => /** @type {HTMLButtonElement|null} */ (grid.querySelector(`[data-track="${id}"]`)))
  function selected() {
    return partButtons.findIndex(button => button?.getAttribute('aria-pressed') === 'true')
  }
  function refresh() {
    const index = selected()
    partName.textContent = index < 0 ? '選択なし' : parts[index]
    const key = document.querySelector('#section-key-value')?.textContent
    const tempo = /** @type {HTMLInputElement|null} */ (document.querySelector('#section-tempo-value'))
    keyTempo.textContent = [tempo?.value, key].filter(Boolean).join(' / ')
  }
  panel.querySelectorAll('.style-stepper button').forEach((button, index) => {
    button.addEventListener('click', () => {
      const current = selected()
      const next = current < 0 ? (index === 0 ? parts.length - 1 : 0) : (current + (index === 0 ? -1 : 1) + parts.length) % parts.length
      partButtons[next]?.click()
      refresh()
    })
  })
  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true'
    toggle.setAttribute('aria-expanded', String(open))
    mixer.toggleAttribute('data-mobile-mixer-open', open)
  })
  new MutationObserver(refresh).observe(mixer, {subtree:true, childList:true, characterData:true, attributes:true, attributeFilter:['aria-pressed','value']})
  mixer.addEventListener('input', refresh)
  const melodyPanel = document.querySelector('#detail-melody')
  const melodyTop = melodyPanel?.querySelector('.melody-top-row')
  const bassPanel = document.querySelector('#detail-bass')
  function placeTransport() {
    if (!transport || !narrow.matches) return
    const editingNotes = melodyPanel?.matches(':not([hidden])') || bassPanel?.matches(':not([hidden])')
    const destination = editingNotes ? melodyTop : playRow
    if (destination && transport.parentElement !== destination) destination.append(transport)
  }
  const editorVisibility = new MutationObserver(placeTransport)
  for (const editor of [melodyPanel, bassPanel]) {
    if (editor) editorVisibility.observe(editor, {attributes:true, attributeFilter:['hidden']})
  }
  const keyboard = document.querySelector('#piano-scroll')
  const keyboardHome = document.createComment('keyboard home')
  keyboard?.before(keyboardHome)
  function resize() {
    if (!transport) return
    if (narrow.matches) {
      placeTransport()
      if (keyboard) melodyPanel?.append(keyboard)
    } else {
      original.after(transport)
      if (keyboard) keyboardHome.after(keyboard)
    }
    refresh()
  }
  narrow.addEventListener('change', resize)
  resize()
}

/** @typedef {{id:string, title:string, detailTitle?:string, subtitle:string, description:string, badge:string, icon:string, image?:string, disabled?:boolean, previewOnly?:boolean}} MenuChoice */
/** Shared selection stage: selection previews; only the explicit start enters a mode.
 * @param {Element} host @param {MenuChoice[]} choices @param {(id:string)=>void} confirm */
export function mountSelectionStage(host, choices, confirm) {
  const selected = ref(choices[0].id)
  const hasSwitched = ref(false)
  const current = () => choices.find(choice => choice.id === selected.value) ?? choices[0]
  const app = createApp({render: () => {
    const item = current()
    return h('div', {class:'selection-stage'}, [
      h('div', {class:'selection-list', role:'group', 'aria-label':'遊び方を選ぶ'}, choices.map((choice, index) =>
        h('button', {type:'button', class:'selection-choice', 'aria-pressed':choice.id === selected.value, disabled:choice.disabled,
          onClick:() => {
            if (selected.value === choice.id) return
            hasSwitched.value = true
            selected.value = choice.id
          }}, [
          h('span', {class:'selection-number', 'aria-hidden':'true'}, String(index + 1).padStart(2,'0')),
          h('span', {class:'selection-choice-copy'}, [h('strong', choice.title), h('small', choice.disabled || choice.previewOnly ? '準備中' : choice.subtitle)]),
          h('span', {'aria-hidden':'true', class:'selection-pointer'}, choice.disabled ? '…' : '›'),
        ]))),
      h('div', {class:'selection-feature', 'data-instrument':item.icon}, [
        h('div', {key:`art-${item.id}`, class:['selection-art', hasSwitched.value && 'selection-enter'], 'aria-hidden':'true'}, item.image ? [h('img',{class:'mode-scene',src:item.image,alt:'',width:480,height:320})] : [
          h('span', {class:'selection-orbit orbit-one'}), h('span', {class:'selection-orbit orbit-two'}),
          h('svg', {class:'selection-otto', viewBox:'0 0 100 100'}, [
            h('circle',{cx:50,cy:50,r:38,fill:'currentColor'}),
            h('path',{d:'M23 37Q30 20 48 20M37 42v12m26-12v12M58 78Q72 74 78 62',fill:'none',stroke:'var(--oto-key)','stroke-width':5,'stroke-linecap':'round'}),
            h('circle',{cx:50,cy:57,r:4,fill:'var(--oto-accent)'}),
            h('path',{d:'M10 50V40a40 40 0 0 1 80 0v10',fill:'none',stroke:'currentColor','stroke-width':5}),
            h('rect',{x:4,y:42,width:13,height:25,rx:6,fill:'var(--oto-key)',stroke:'currentColor','stroke-width':3}),
            h('rect',{x:83,y:42,width:13,height:25,rx:6,fill:'var(--oto-key)',stroke:'currentColor','stroke-width':3}),
          ]),
          h('div',{class:['selection-instrument',item.icon]}, item.icon === 'drums'
            ? Array.from({length:8},(_,i)=>h('i',{key:i}))
            : Array.from({length:7},(_,i)=>h('i',{key:i}))),
          h('span',{class:'selection-note note-one'},'♪'),h('span',{class:'selection-note note-two'},'♫'),
        ]),
        h('div',{class:'selection-detail','aria-live':'polite'},[
          h('div',{key:item.id,class:hasSwitched.value ? 'selection-enter' : undefined},[
            h('span',{class:'selection-badge'},item.badge),h('h2',item.detailTitle ?? item.title),h('p',item.description),
          ]),
        ]),
        h('button',{type:'button',class:'selection-start',disabled:item.disabled || item.previewOnly,onClick:()=>{if (!item.disabled && !item.previewOnly) confirm(item.id)}},[h('span',item.disabled || item.previewOnly ? '準備中' : 'これであそぶ'),h('span',{'aria-hidden':'true'},'▶')]),
      ]),
    ])
  }})
  app.mount(host)
  return () => app.unmount()
}

/** @param {() => void} stopPlayback @param {() => Promise<string>} connectMidi
 * @param {() => void} selectSession */
export function mountModeMenu(stopPlayback, connectMidi, selectSession) {
  const free = /** @type {HTMLElement} */ (document.querySelector('.shell'))
  const menu = /** @type {HTMLElement} */ (document.querySelector('#mode-menu'))
  const tutorial = /** @type {HTMLElement} */ (document.querySelector('#tutorial-menu'))
  const categories = document.createElement('section')
  categories.className = 'mode-screen tutorial-categories'
  categories.hidden = true
  categories.innerHTML = '<div class="selection-header"><button type="button" data-category-back>← メニュー</button><span class="selection-step">TUTORIAL</span></div><h1>どの楽器で遊ぶ？</h1><p class="selection-intro">気になる楽器を選んで、Ottoとチャレンジ。</p><div class="category-selection"></div>'

  const drumRoot = document.createElement('section')
  drumRoot.className = 'tutorial-screen drum-tutorial'
  drumRoot.hidden = true
  const drumKitRoot = document.createElement('section')
  drumKitRoot.className = 'tutorial-screen drum-tutorial'
  drumKitRoot.hidden = true
  const songPrototype = document.createElement('section')
  songPrototype.className = 'tutorial-screen song-session-prototype'
  songPrototype.hidden = true
  songPrototype.innerHTML = '<header class="selection-header"><button type="button" data-song-back>← メニュー</button><h1>ライブ</h1></header><section class="live-setup"></section><main aria-label="ライブ演奏" hidden></main>'
  songPrototype.querySelector('[data-song-back]')?.addEventListener('click', () => open('menu'))
  menu.after(categories, drumRoot, drumKitRoot, songPrototype)
  const livePerformance = /** @type {HTMLElement} */ (songPrototype.querySelector('main'))
  const songSession = mountSongSession(livePerformance)
  const liveStep = ref(0)
  const playMode = ref('')
  const playModes = ['Ottoとセッション', '自分で弾く', 'ゲームモード']
  const liveSetup = /** @type {HTMLElement} */ (songPrototype.querySelector('.live-setup'))
  /** @param {string} label @param {()=>void} select */
  const liveChoice = (label, select) => h('button', {type:'button', onClick:select}, label)
  createApp({render: () => {
    if (liveStep.value === 3) return [
      h('p', playMode.value === '自分で弾く' ? playMode.value : `${playMode.value}（試作では自由演奏）`),
      liveChoice('選び直す', () => {
        songSession.stop()
        livePerformance.hidden = true
        liveStep.value = 0
      }),
    ]
    const title = ['曲を選ぶ', '遊び方を選ぶ', '楽器を選ぶ'][liveStep.value]
    const choices = liveStep.value === 0 ? [liveChoice('Otto体験用（ベース抜き）', () => {liveStep.value = 1})]
      : liveStep.value === 1 ? playModes.map(mode => liveChoice(mode, () => {
        playMode.value = mode
        liveStep.value = 2
      }))
      : songSession.parts.map(part => liveChoice(part.label, () => {
        songSession.selectPart(part.id)
        livePerformance.hidden = false
        liveStep.value = 3
        void songSession.togglePlayback()
      }))
    return [
      h('h2', {tabindex:-1}, title),
      h('div', {class:'song-session-parts', role:'group', 'aria-label':title}, choices),
      liveStep.value ? liveChoice('← 戻る', () => {liveStep.value--}) : null,
    ]
  }}).mount(liveSetup)
  const drumView = mountDrumTutorial(drumRoot, () => open('categories'))
  const drumKitView = mountDrumTutorial(drumKitRoot, () => open('categories'), true)
  categories.querySelector('[data-category-back]')?.addEventListener('click', () => open('menu'))

  /** @param {string} mode */
  function open(mode, restore = false) {
    stopPlayback()
    if (!songPrototype.hidden) songSession.stop()
    if (mode === 'song-session') {
      liveStep.value = 0
      livePerformance.hidden = true
    }
    tutorialView.close()
    drumView.close()
    drumKitView.close()
    categories.hidden = mode !== 'categories'
    drumRoot.hidden = mode !== 'drum-tutorial'
    songPrototype.hidden = mode !== 'song-session'
    if (mode === 'drum-tutorial') drumView.open(restore)
    drumKitRoot.hidden = mode !== 'drum-kit-tutorial'
    if (mode === 'drum-kit-tutorial') drumKitView.open(restore)
    document.body.dataset.appMode = mode
    saveDevelopmentScreen('mode', mode)
    free.hidden = mode !== 'free'
    menu.hidden = mode !== 'menu'
    tutorial.hidden = mode !== 'tutorial'
    if (mode === 'tutorial') tutorialView.open(restore)
    const target = mode === 'free' ? free.querySelector('.mode-back')
      : mode === 'song-session' ? songPrototype.querySelector('[data-song-back]') : mode === 'categories' ? categories.querySelector('[data-category-back]') : null
    if (target instanceof HTMLElement) target.focus()
    else if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
  }
  const tutorialView = mountTutorial(tutorial, mode => {
    open(mode === 'menu' ? 'categories' : mode)
    if (mode === 'free') selectSession()
  })
  const modeHost = menu.querySelector('#mode-selection')
  if (modeHost) mountSelectionStage(modeHost, [
    {id:'categories',title:'チュートリアル',subtitle:'お手本に合わせてチャレンジ',description:'聴いて、まねして、ひとつずつ。楽器を選んでリズムの冒険へ。',badge:'はじめてでも大丈夫',icon:'keys',image:'./mode-tutorial.svg'},
    {id:'song-session',title:'ライブ',subtitle:'曲に合わせて演奏',description:'デモ曲に合わせて演奏しよう。ベースは譜面を見ながら練習できるよ。',badge:'ベータ',icon:'session',image:'./mode-song.svg'},
    {id:'free',title:'スタジオ',subtitle:'自由に作曲・演奏',description:'音色や伴奏にこだわって、自由に作曲・演奏を楽しもう。',badge:'じっくり音楽づくり',icon:'session',image:'./mode-free.svg'},
  ], mode => open(mode))
  const categoryHost = categories.querySelector('.category-selection')
  if (categoryHost) mountSelectionStage(categoryHost, [
    {id:'melody-basic',title:'メロディ編 1',detailTitle:'きほんのそうさ',subtitle:'鍵盤で音とリズムを楽しもう',description:'ひとつの音からスライドまで。Ottoのお手本に合わせて弾いてみよう。',badge:`${lessons.filter(lesson=>(lesson.settings?.course ?? 'basic') === 'basic').length} LESSONS`,icon:'keys'},
    {id:'melody-advanced',title:'メロディ編 2',detailTitle:'いろんな曲',subtitle:'曲のメロディを弾こう',description:'「ちょうちょう」から、シャープやフラットが出てくる曲まで。',badge:`${lessons.filter(lesson=>lesson.settings?.course === 'songs').length} LESSONS`,icon:'keys'},
    {id:'adlib',title:'メロディ編 3',detailTitle:'即興アレンジ',subtitle:'好きな音でメロディをつくろう',description:'好きな音を選んで、その場でメロディをつくろう。Ottoとのセッションにも挑戦！',badge:`${lessons.filter(lesson=>lesson.settings?.course === 'adlib').length} LESSONS`,icon:'keys'},
    {id:'drum-tutorial',title:'ビート編',subtitle:'8つのパッドでビートを刻もう',description:'左右の手で、トン、タン。基本のリズムからセッションまで、少しずつステップアップ。',badge:'10 LESSONS',icon:'drums'},
    {id:'drum-kit-tutorial',title:'ドラム編',subtitle:'ドラムキットで8ビート',description:'キック、スネア、ハイハット。下段の3つでOttoの8ビートをまねしてみよう。',badge:'1 LESSON',icon:'drums'},
    {id:'bass',title:'ベース編',subtitle:'',description:'',badge:'',icon:'keys',disabled:true},
    {id:'chords',title:'コード編',subtitle:'',description:'',badge:'',icon:'keys',disabled:true},
  ], mode => {
    const course = { 'melody-basic':'basic', 'melody-advanced':'songs', 'adlib':'adlib' }[mode]
    const index = course === undefined ? -1 : lessons.findIndex(lesson=>(lesson.settings?.course ?? 'basic') === course)
    if (index >= 0) { open('tutorial'); tutorialView.selectLesson(index) }
    else open(mode)
  })
  const midiButton = document.querySelector('#mode-midi')
  if (midiButton instanceof HTMLButtonElement) midiButton.addEventListener('click', async () => {
    midiButton.disabled = true
    try { midiButton.textContent = await connectMidi() }
    finally { midiButton.disabled = false }
  })
  document.querySelectorAll('[data-open-mode]').forEach(button => {
    button.addEventListener('click', () => open(button.getAttribute('data-open-mode') === 'tutorial' ? 'categories' : button.getAttribute('data-open-mode') ?? 'menu'))
  })
  const logo = free.querySelector('.logo')
  logo?.addEventListener('click', event => { event.preventDefault(); open('menu') })
  for (const type of ['keydown', 'keyup']) {
    document.addEventListener(type, event => {
      if (event.target instanceof Element && event.target.closest('.tutorial-keyboard button[data-midi]')) return
      if (document.body.dataset.appMode === 'song-session' && event instanceof KeyboardEvent && event.key === ' ') {
        event.preventDefault()
        event.stopImmediatePropagation()
        if (event.type === 'keydown' && !event.repeat) void songSession.togglePlayback()
        return
      }
      if (['tutorial','drum-tutorial','drum-kit-tutorial'].includes(document.body.dataset.appMode ?? '') && event instanceof KeyboardEvent && event.key === ' ') {
        event.preventDefault()
        event.stopImmediatePropagation()
        if (event.type === 'keydown' && !event.repeat) {
          if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
          if (document.body.dataset.appMode === 'drum-kit-tutorial') drumKitView.advanceMessage()
          else if (document.body.dataset.appMode === 'drum-tutorial') drumView.advanceMessage()
          else tutorialView.advanceMessage()
        }
        return
      }
      if (['free','drum-tutorial','drum-kit-tutorial'].includes(document.body.dataset.appMode ?? '') || (event.target instanceof Node && tutorial.contains(event.target))) return
      // Menu controls retain native keyboard activation without triggering performance shortcuts.
      event.stopImmediatePropagation()
    }, true)
  }
  free.hidden = true
  const previousMode = readDevelopmentScreen('mode')
  open(previousMode && ['menu','categories','free','tutorial','drum-tutorial','drum-kit-tutorial','song-session'].includes(previousMode) ? previousMode : 'menu', true)
  return Object.assign(tutorialView, { songMidiAttack: songSession.midiAttack, songMidiRelease: songSession.midiRelease })
}
