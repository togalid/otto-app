import { createApp, h } from './vendor/vue.runtime.esm-browser.prod.js'
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
