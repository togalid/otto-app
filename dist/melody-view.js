import { mountDrumTutorial } from './drum-tutorial.js'
import { mountTutorial } from './tutorial-view.js'
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

const guidePanel = document.createElement('section')
guidePanel.className = 'session-rhythm-guide'
guidePanel.setAttribute('aria-label', 'リズムガイド')
guidePanel.innerHTML = '<div class="session-guide-copy"><strong>リズムに合わせて弾いてみよう</strong><small>好きな音でOK。スライドも使ってみよう！</small></div><div class="session-rhythm-beats" aria-label="1、2、3、4拍"><span>♩<small>1</small></span><span>♩<small>2</small></span><span>♩<small>3</small></span><span>♩<small>4</small></span></div>'
const guideToggle = document.createElement('fieldset')
guideToggle.className = 'segmented-control session-guide-toggle'
guideToggle.setAttribute('aria-label', '表示切り替え')
guideToggle.innerHTML = '<legend class="sr-only">表示切り替え</legend><label><input type="radio" name="session-guide-view" value="rhythm"><span>リズムガイド</span></label><label><input type="radio" name="session-guide-view" value="settings" checked><span>演奏設定</span></label>'
melodyTopRow.append(guideToggle, guidePanel)
/** @param {string} value */
function setGuideView(value) {
  melodyTopRow.dataset.guideView = value
  const selected = /** @type {HTMLInputElement | null} */ (guideToggle.querySelector(`input[value="${value}"]`))
  if (selected) selected.checked = true
}
guideToggle.addEventListener('change', event => {
  if (event.target instanceof HTMLInputElement) setGuideView(event.target.value)
})
document.addEventListener('tutorial-free-session', () => setGuideView('rhythm'))
document.addEventListener('session-rhythm-beat', event => {
  if (!(event instanceof CustomEvent)) return
  const {beat: position, beats} = event.detail
  const beat = Math.floor(position)
  const track = guidePanel.querySelector('.session-rhythm-beats')
  if (track && track.children.length !== beats && beats > 0) {
    track.innerHTML = Array.from({length: beats}, (_, index) => `<span>♩<small>${index + 1}</small></span>`).join('')
    track.setAttribute('aria-label', `${beats}拍のリズム`)
  }
  Array.from(guidePanel.querySelectorAll('.session-rhythm-beats > span')).forEach((node, index) => {
    node.toggleAttribute('data-current', beat === index)
  })
})
setGuideView('rhythm')


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

/** Mobile practice guide. The audio clock supplies timing; animation never schedules sound.
 * @param {() => number | undefined} clock */
export function mountMobileGuide(clock) {
  const board = /** @type {HTMLElement} */ (document.querySelector('#piano-keys'))
  const scroll = /** @type {HTMLElement} */ (document.querySelector('#piano-scroll'))
  const host = document.createElement('section')
  host.className = 'mobile-guide'
  host.setAttribute('aria-label', '演奏ナビゲーション')
  host.innerHTML = '<div class="mobile-guide-heading"><strong>Otto</strong><span>鍵盤を見てみよう</span></div><div class="mobile-otto-keys" aria-label="Ottoの演奏" role="img"></div><div class="mobile-guide-label">線に重なったら、同じ音を弾こう</div><div class="mobile-guide-lane" aria-hidden="true"><div class="mobile-guide-line"></div><div class="mobile-guide-notes"></div></div><div class="mobile-guide-feedback" role="status" aria-live="polite">再生して、一緒に弾こう</div><strong class="mobile-user-label">あなた</strong>'
  scroll.before(host)
  const keys = /** @type {HTMLElement} */ (host.querySelector('.mobile-otto-keys'))
  for (const label of ['ド','レ','ミ','ファ','ソ','ラ','シ','ド']) {
    const key = document.createElement('span'); key.textContent = label; keys.append(key)
  }
  const lane = /** @type {HTMLElement} */ (host.querySelector('.mobile-guide-notes'))
  const feedback = /** @type {HTMLElement} */ (host.querySelector('.mobile-guide-feedback'))
  /** @type {{time:number,midi:number,node:HTMLElement,hit:boolean}[]} */
  let targets = []
  let frame = 0
  const pitches = [48,52,55,52]
  const labels = ['ド','ミ','ソ','ミ']
  const mobile = typeof matchMedia === 'function' ? matchMedia('(max-width: 600px)') : null
  function render() {
    frame = 0
    const now = clock()
    if (now === undefined || !mobile?.matches) return
    targets = targets.filter(target => {
      const distance = target.time - now
      if (distance < -0.5) { target.node.remove(); return false }
      target.node.style.left = `${12 + distance * 42}%`
      return true
    })
    const active = new Set(Array.from(board.querySelectorAll('[data-pc-playing]'), key => Number(/** @type {HTMLElement} */ (key).dataset.midi) % 12))
    ;[0,2,4,5,7,9,11,0].forEach((pitch,index) => keys.children[index]?.toggleAttribute('data-playing', active.has(pitch)))
    if (targets.length) frame = requestAnimationFrame(render)
  }
  /** @param {number} startBeat @param {number} time @param {number} beatSeconds @param {number} beats */
  function schedule(startBeat, time, beatSeconds, beats) {
    if (!mobile?.matches || !Number.isFinite(beatSeconds) || beatSeconds <= 0) return
    for (let beat = Math.ceil(startBeat); beat < beats; beat++) {
      const node = document.createElement('span'); node.className = 'mobile-guide-note'; node.textContent = labels[beat % 4]
      lane.append(node)
      targets.push({time:time + (beat - startBeat) * beatSeconds,midi:pitches[beat % 4],node,hit:false})
    }
    if (!frame) frame = requestAnimationFrame(render)
  }
  /** @param {number} midi */
  function hit(midi) {
    if (!mobile?.matches) return
    const now = clock()
    if (now === undefined || !targets.length) { feedback.textContent = 'いい音！ 再生するとリズムが流れるよ'; return }
    const target = targets.filter(note => !note.hit).sort((a,b) => Math.abs(a.time-now)-Math.abs(b.time-now))[0]
    if (!target || Math.abs(target.time-now) > .25) { feedback.textContent = '線に重なったら押してみよう'; return }
    if (midi % 12 !== target.midi % 12) { feedback.textContent = `${target.node.textContent}を押してみよう`; return }
    target.hit = true
    feedback.textContent = Math.abs(target.time-now) <= .10 ? 'Great!' : 'Good!'
    target.node.dataset.hit = 'true'
  }
  function clear() {
    cancelAnimationFrame(frame); frame = 0
    targets.forEach(target => target.node.remove()); targets = []
    Array.from(keys.children).forEach(key => key.removeAttribute('data-playing'))
    feedback.textContent = '再生して、一緒に弾こう'
  }
  mobile?.addEventListener('change', clear)
  return {schedule, hit, clear}
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
      <span>キー / テンポ</span><strong class="mobile-key-tempo"></strong><span>ミキサー</span>
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
    const key = document.querySelector('output[for="section-mixer-key"]')?.textContent
    const tempo = /** @type {HTMLInputElement|null} */ (document.querySelector('#section-tempo-value'))
    keyTempo.textContent = [key, tempo?.value].filter(Boolean).join(' / ')
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
  function placeTransport() {
    if (!transport || !narrow.matches) return
    const destination = melodyPanel?.matches(':not([hidden])') ? melodyTop : playRow
    if (destination && transport.parentElement !== destination) destination.append(transport)
  }
  if (melodyPanel) new MutationObserver(placeTransport).observe(melodyPanel, {attributes:true, attributeFilter:['hidden']})
  const guide = document.querySelector('#detail-melody .mobile-guide')
  const keyboard = document.querySelector('#piano-scroll')
  const keyboardHome = document.createComment('keyboard home')
  guide?.before(keyboardHome)
  function resize() {
    if (!transport) return
    if (narrow.matches) {
      placeTransport()
      if (guide && keyboard) melodyPanel?.append(guide, keyboard)
    } else {
      original.after(transport)
      if (guide && keyboard) keyboardHome.after(guide, keyboard)
    }
    refresh()
  }
  narrow.addEventListener('change', resize)
  resize()
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
  categories.innerHTML = '<button type="button" data-category-back>← メニュー</button><h1 tabindex="-1">どの楽器で遊ぶ？</h1><div class="mode-choices"><button type="button" data-lesson="tutorial"><strong>メロディ編</strong><span>鍵盤で音とリズムを楽しもう · 10レッスン</span></button><button type="button" data-lesson="drum-tutorial"><strong>ドラム編</strong><span>8つのパッドで8ビートを叩こう · 1レッスン</span></button><button type="button" disabled><strong>ベース編</strong><span>準備中</span></button><button type="button" disabled><strong>コード編</strong><span>準備中</span></button></div>'
  const drumRoot = document.createElement('section')
  drumRoot.className = 'tutorial-screen drum-tutorial'
  drumRoot.hidden = true
  menu.after(categories, drumRoot)
  const drumView = mountDrumTutorial(drumRoot, () => open('categories'))
  categories.querySelector('[data-category-back]')?.addEventListener('click', () => open('menu'))
  categories.querySelectorAll('[data-lesson]').forEach(button => button.addEventListener('click', () => open(button.getAttribute('data-lesson') ?? 'categories')))
  /** @param {string} mode */
  function open(mode) {
    stopPlayback()
    tutorialView.close()
    drumView.close()
    categories.hidden = mode !== 'categories'
    drumRoot.hidden = mode !== 'drum-tutorial'
    if (mode === 'drum-tutorial') drumView.open()
    document.body.dataset.appMode = mode
    free.hidden = mode !== 'free'
    menu.hidden = mode !== 'menu'
    tutorial.hidden = mode !== 'tutorial'
    if (mode === 'tutorial') tutorialView.open()
    const target = mode === 'free' ? free.querySelector('.mode-back')
      : mode === 'menu' ? document.querySelector('#mode-menu-title') : mode === 'categories' ? categories.querySelector('h1') : null
    if (target instanceof HTMLElement) target.focus()
    else if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
  }
  const tutorialView = mountTutorial(tutorial, mode => {
    open(mode === 'menu' ? 'categories' : mode)
    if (mode === 'free') { selectSession(); document.dispatchEvent(new Event('tutorial-free-session')) }
  }, connectMidi)
  document.querySelectorAll('[data-open-mode]').forEach(button => {
    button.addEventListener('click', () => open(button.getAttribute('data-open-mode') === 'tutorial' ? 'categories' : button.getAttribute('data-open-mode') ?? 'menu'))
  })
  const logo = free.querySelector('.logo')
  logo?.addEventListener('click', event => { event.preventDefault(); open('menu') })
  for (const type of ['keydown', 'keyup']) {
    document.addEventListener(type, event => {
      if (['tutorial','drum-tutorial'].includes(document.body.dataset.appMode ?? '') && event instanceof KeyboardEvent && event.key === ' ') {
        event.preventDefault()
        event.stopImmediatePropagation()
        if (event.type === 'keydown' && !event.repeat) {
          if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
          if (document.body.dataset.appMode === 'drum-tutorial') drumView.advanceMessage()
          else tutorialView.advanceMessage()
        }
        return
      }
      if (document.body.dataset.appMode === 'free' || document.body.dataset.appMode === 'drum-tutorial' || (event.target instanceof Node && tutorial.contains(event.target))) return
      // Menu controls retain native keyboard activation without triggering performance shortcuts.
      event.stopImmediatePropagation()
    }, true)
  }
  free.hidden = true
  open('menu')
  return tutorialView
}
