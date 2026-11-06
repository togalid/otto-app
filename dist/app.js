import { createMelodyView } from './melody-view.js'
import { mountReferencePlayer } from './reference-player.js'
mountReferencePlayer()
import { OrnamentPlayer } from './ornament-audio.js'
import { mountOrnaments } from './ornament-ui.js'
import {
  presetLevel,
  notes,
  keys,
  presets,
  presetGroups,
  presetSlots,
  presetBeatSlots,
  melodyPalette,
  melodyRole,
  displayChordParts,
  rootPitch,
  bassHarmonyNotes,
  changeRoot,
  defaultChord,
  chordConfig,
  customChord,
  qualityGroups,
} from './music.js'
import { timbres, melodyTimbres, melodyTimbreFor } from './timbres.js'
import { chordBackingPatterns } from './backing.js'
import { Instrument, chordWeights } from './audio.js'
import { DrumSynth, rhythmPatterns } from './rhythm.js'
import { Progression } from './progression.js'
import { BassSynth, genres, genreProgressions, createPartMixer, swungBassBeat, bassEvents, bassFeelEvents, bassToneOffset, bassArticulation } from './groove.js'

/** @type {ReturnType<typeof mountBuddy> | undefined} */
let buddyController
const instrument = new Instrument()
instrument.setTimbre('lead-round')
const pads = document.querySelector('#pads')
const status = document.querySelector('#status')
/** @type {HTMLButtonElement[]} */
const buttons = []
/** @type {Map<HTMLButtonElement, ReturnType<typeof setTimeout>>} */
const animations = new Map()

/** @type {Map<number, {midi:number}>} */
const heldPads = new Map()
/** @param {number} index */
function releasePad(index) {
  buddyController?.release(index)
  const held = heldPads.get(index)
  heldPads.delete(index)
  if (held) instrument.release(held.midi)
  buttons[index]?.classList.remove('playing')
}
/** @param {number} index @param {boolean} [hold] */
async function play(index, hold = false) {
  if (buddyController?.active) { buddyController.attack(index); return }
  const note = playableNotes[index]
  const button = buttons[index]
  if (!note || !button || !status) return
  try {
    if (hold) {
      const held = {midi:note.midi}
      heldPads.set(index,held)
      await instrument.ready()
      if (heldPads.get(index) !== held) return
      instrument.attack(note.midi)
    } else await instrument.play(note.midi)
    lastMelodyMidi = note.midi
    lastMelodyDegree = note.degree
    const feedback = document.querySelector('#melody-feedback')
    if (feedback) feedback.textContent = `${note.label} · ${note.degree} — ${note.hint}`
    clearTimeout(animations.get(button))
    button.classList.add('playing')
    animations.set(
      button,
      setTimeout(() => button.classList.remove('playing'), 280),
    )
    status.textContent = ''
  } catch (error) {
    status.textContent =
      error instanceof Error
        ? error.message
        : '音を再生できませんでした。もう一度お試しください。'
  }
}

notes.forEach((note, index) => {
  const button = document.createElement('button')
  button.className = 'pad'
  button.type = 'button'
  button.style.setProperty('--pad-color', note.color)
  button.setAttribute(
    'aria-label',
    `${note.label} ${index >= 5 ? '高い音' : ''}を鳴らす（${note.key.toUpperCase()}キー）`,
  )
  const number = document.createElement('span')
  number.className = 'pad-number'
  number.textContent = String(index + 1).padStart(2, '0')
  const label = document.createElement('span')
  label.className = 'pad-note'
  label.textContent = note.label
  const key = document.createElement('kbd')
  key.textContent = note.key.toUpperCase()
  const role = document.createElement('span')
  role.className = 'pad-role'
  button.append(number, label, role, key)
  button.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return
    button.setPointerCapture(event.pointerId)
    void play(index, true)
  })
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'])
    button.addEventListener(type, () => releasePad(index))
  // Native keyboard and assistive-technology activation.
  button.addEventListener('click', (event) => {
    if (event.detail === 0) { void play(index); buddyController?.release(index) }
  })
  buttons.push(button)
  pads?.append(button)
})

document.addEventListener('keydown', (event) => {
  if (event.target instanceof Element && event.target.closest('dialog[open], #reference-player')) return
  if (
    event.repeat ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    event.target instanceof HTMLInputElement ||
    event.target instanceof HTMLSelectElement
  )
    return
  const index = notes.findIndex((note) => note.key === event.key.toLowerCase())
  if (index < 0) return
  event.preventDefault()
  void play(index, true)
})
document.addEventListener('keyup', event => {
  const index = notes.findIndex(note => note.key === event.key.toLowerCase())
  if (index >= 0) releasePad(index)
})
window.addEventListener('blur', () => { heldPads.clear(); instrument.silence() })
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    heldPads.clear()
    progression.stop()
    instrument.silence()
  }
})

const chordInstrument = new Instrument()
const drums = new DrumSynth(chordInstrument)
const bass = new BassSynth(chordInstrument)
const slotContainer = document.querySelector('#chord-slots')
const progressionStatus = document.querySelector('#progression-status')
const startButton = /** @type {HTMLButtonElement} */ (
  document.querySelector('#progression-play')
)
document.addEventListener('keydown', (event) => {
  if (event.target instanceof Element && event.target.closest('dialog[open], #reference-player')) return
  if (event.target instanceof Element && event.target.closest('#piano-keys')) return
  if (event.code !== 'Space' || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return
  event.preventDefault()
  event.stopPropagation()
  if (!event.repeat) startButton.click()
}, true)
const tempo = /** @type {HTMLInputElement} */ (document.querySelector('#tempo'))
/** @type {HTMLElement[]} */
const slotElements = []
const notation = /** @type {HTMLFieldSetElement} */ (
  document.querySelector('#notation')
)
const keySelect = /** @type {HTMLSelectElement} */ (
  document.querySelector('#key')
)
function notationMode() {
  return (
    /** @type {HTMLInputElement | null} */ (
      notation.querySelector('input:checked')
    )?.value ?? 'number'
  )
}
function updateTransport() {
  const label = startButton.querySelector('.transport-label')
  const running = progression.running || Boolean(buddyController?.active)
  if (label) label.textContent = running ? '■ 停止' : '▶ 再生'
  startButton.setAttribute('aria-pressed', String(running))
}
const melodyMode = /** @type {HTMLSelectElement} */ (
  document.querySelector('#melody-mode')
)
let activeChord = 'FM7'
let activeKey = 0
let playableNotes = melodyPalette(0, activeChord, 0, 'key')
/** @type {number | undefined} */
let lastMelodyMidi
let lastMelodyDegree = ''
const melodyView = createMelodyView(buttons)
function refreshMelody() {
  const state = melodyView.update(Number(keySelect.value), activeChord, activeKey, lastMelodyMidi, lastMelodyDegree)
  playableNotes = state.notes
  lastMelodyDegree = state.degree
}
let displayedBar = -1
let displayedBeat = -1
const progression = new Progression(
  chordInstrument,
  (index, chord, key, beat) => {
    startButton.dataset.beat = index < 0 ? '' : String(beat)
    if (displayedBar !== index || displayedBeat !== beat) {
      const previous = slotElements[displayedBar]
      previous?.querySelectorAll('.beat-chord')[displayedBeat]?.classList.remove('current-beat')
      if (displayedBar !== index) {
        previous?.classList.remove('current')
        previous?.removeAttribute('aria-current')
        slotElements[index]?.classList.add('current')
        slotElements[index]?.setAttribute('aria-current', 'step')
      }
      slotElements[index]?.querySelectorAll('.beat-chord')[beat]?.classList.add('current-beat')
      displayedBar = index
      displayedBeat = beat
    }
    if (activeChord !== chord || activeKey !== key) {
      activeChord = chord
      activeKey = key
      refreshMelody()
    }
    if (index >= 0) updateChordMonitor(index, chord, beat)
    updateTransport()
  },
  (message) => {
    if (progressionStatus) progressionStatus.textContent = message
  },
  drums,
  bass,
)
progression.melody = instrument
melodyMode.addEventListener('change', () => {
  progression.melodyPattern = ''
  buddyController?.setMode(melodyMode.value)
  instrument.silence()
  refreshMelody()
})

const qualityOrigins = progression.slots.map((chord) => [chord, chord, chord, chord])
const qualityMenu = document.createElement('dialog')
qualityMenu.className = 'quality-menu'
qualityMenu.setAttribute('aria-label', 'コードの響きを選択')
document.body.append(qualityMenu)
/** @type {HTMLSelectElement | null} */
let qualityMenuSource = null
qualityMenu.addEventListener('click', (event) => {
  if (event.target === qualityMenu) qualityMenu.close()
})
qualityMenu.addEventListener('close', () => {
  qualityMenuSource?.focus({ preventScroll: true })
  qualityMenuSource = null
})
/** @param {HTMLSelectElement} select @param {number} bar @param {number} beat */
function openQualityMenu(select, bar, beat) {
  if (qualityMenu.open) return
  refreshLabels()
  qualityMenuSource = select
  qualityMenu.replaceChildren()
  for (const group of Array.from(select.querySelectorAll('optgroup'))) {
    const heading = document.createElement('div')
    heading.className = 'quality-menu-heading'
    heading.textContent = group.label
    qualityMenu.append(heading)
    for (const option of Array.from(group.querySelectorAll('option'))) {
      const row = document.createElement('div')
      row.className = 'quality-menu-row'
      const button = document.createElement('button')
      button.type = 'button'
      button.textContent = option.textContent
      button.className = 'quality-menu-option'
      if (option.value === select.value) button.setAttribute('aria-current', 'true')
      button.addEventListener('click', () => {
        select.value = option.value
        select.dispatchEvent(new Event('change', { bubbles: true }))
        qualityMenu.close()
      })
      const preview = document.createElement('button')
      preview.type = 'button'
      preview.className = 'quality-menu-preview'
      preview.setAttribute('aria-label', `${option.textContent || 'コード'}を試聴`)
      preview.title = 'コードを試聴'
      preview.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 10h4l5-4v12l-5-4H4zM16 9c1.5 1.5 1.5 4.5 0 6M19 6c3.5 3 3.5 9 0 12" /></svg>'
      preview.addEventListener('click', async () => {
        const current = beat === 0 ? progression.slots[bar] : progression.beatSlots[bar][beat]
        if (!current) return
        const [quality, extension] = option.value.split(':')
        const chord = customChord({ ...chordConfig(current), quality, extension })
        try {
          await chordInstrument.ready()
          if (chordInstrument.context) {
            const notes = progression.notesForBar(chord, bar, beat)
            chordInstrument.playAt(notes, chordInstrument.context.currentTime, 1.2, 1, chordWeights(notes, chord, progression.keyForBar(bar)))
          }
          if (progressionStatus) progressionStatus.textContent = ''
        } catch (error) {
          if (progressionStatus) progressionStatus.textContent = error instanceof Error ? error.message : 'コードを試聴できませんでした。'
        }
      })
      row.append(button, preview)
      qualityMenu.append(row)
    }
  }
  const rect = select.getBoundingClientRect()
  const width = Math.min(240, window.innerWidth - 16)
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))
  // Keep the first recommendation close to the clicked chord, even when
  // there is not enough room below it for the full list.
  const minHeight = Math.min(150, window.innerHeight - 16)
  const top = Math.max(8, Math.min(rect.top - 30, window.innerHeight - minHeight - 8))
  const height = Math.min(260, window.innerHeight - top - 8)
  qualityMenu.style.left = `${left}px`
  qualityMenu.style.top = `${top}px`
  qualityMenu.style.width = `${width}px`
  qualityMenu.style.maxHeight = `${height}px`
  qualityMenu.showModal()
  qualityMenu.scrollTop = 0
  qualityMenu.querySelector('button')?.focus({ preventScroll: true })
}
progression.slots.forEach((_, bar) => {
  if (bar % 2 === 0) {
    const section = bar / 2
    const modulation = document.createElement('div')
    modulation.className = 'modulation-bar'
    modulation.setAttribute('role', 'group')
    modulation.setAttribute('aria-label', `${bar + 1}〜${bar + 2}小節の設定`)
    const playControls = document.createElement('div')
    playControls.className = 'bar-play-controls'
    for (let index = 0; index < 2; index++) {
      const play = document.createElement('button')
      play.type = 'button'
      play.textContent = '▶'
      play.setAttribute('aria-label', `${bar + index + 1}小節の先頭から再生`)
      play.title = `${bar + index + 1}小節の先頭から再生`
      play.addEventListener('click', () => {
        if (!tempo.reportValidity()) return
        if (progressionStatus) progressionStatus.textContent = ''
        progression.bpm = Number(tempo.value)
        void progression.start(bar + index, 0)
        updateTransport()
      })
      playControls.append(play)
    }
    modulation.append(playControls)
    const label = document.createElement('span')
    label.textContent = '転調'
    const down = document.createElement('button')
    down.type = 'button'
    down.textContent = '−'
    down.className = 'modulation-down'
    down.setAttribute('aria-label', `${bar + 1}〜${bar + 2}小節のキーを半音下げる`)
    const value = document.createElement('output')
    value.className = 'modulation-value'
    value.setAttribute('aria-live', 'polite')
    const up = document.createElement('button')
    up.type = 'button'
    up.textContent = '＋'
    up.className = 'modulation-up'
    up.setAttribute('aria-label', `${bar + 1}〜${bar + 2}小節のキーを半音上げる`)
    /** @param {number} amount */
    function changeModulation(amount) {
      progression.modulation[section] = Math.max(-11, Math.min(11, progression.modulation[section] + amount))
      refreshLabels()
    }
    down.addEventListener('click', () => changeModulation(-1))
    up.addEventListener('click', () => changeModulation(1))
    const stepper = document.createElement('div')
    stepper.className = 'key-stepper modulation-stepper'
    stepper.setAttribute('role', 'group')
    stepper.setAttribute('aria-label', `${bar + 1}〜${bar + 2}小節のキーを半音ずつ変更`)
    stepper.append(down, up)
    modulation.append(label, value, stepper)
    slotContainer?.append(modulation)
  }
  const box = document.createElement('div')
  box.className = `chord-slot${bar % 2 === 0 ? ' first-in-pair' : ''}`
  const barLabel = document.createElement('span')
  barLabel.className = 'bar-label'
  barLabel.textContent = `${bar + 1}`
  box.append(barLabel)
  for (let beat = 0; beat < 4; beat++) {
    const main = document.createElement('div')
    main.className = 'base-chord beat-chord'
    const root = document.createElement('select')
    root.className = 'root-select'
    const rootWrapper = document.createElement('span')
    rootWrapper.className = 'root-wrapper'
    const rootDisplay = document.createElement('span')
    rootDisplay.className = 'root-display'
    rootDisplay.setAttribute('aria-hidden', 'true')
    rootWrapper.append(rootDisplay, root)
    root.setAttribute('aria-label', `${bar + 1}小節 ${beat + 1}拍目のルート`)
    root.addEventListener('change', () => {
      const chord = root.value === '' ? null : defaultChord(Number(root.value))
      if (beat === 0 && chord) progression.slots[bar] = chord
      else if (beat > 0) progression.beatSlots[bar][beat] = chord
      if (chord) qualityOrigins[bar][beat] = chord
      presetSelect.value = 'custom'
      refreshLabels()
    })
    const quality = document.createElement('select')
    quality.className = 'quality-select'
    quality.addEventListener('change', () => {
      const current = beat === 0 ? progression.slots[bar] : progression.beatSlots[bar][beat]
      if (!current) return
      const [qualityName, extension] = quality.value.split(':')
      const chord = customChord({ ...chordConfig(current), quality: qualityName, extension })
      if (beat === 0) progression.slots[bar] = chord
      else progression.beatSlots[bar][beat] = chord
      if (qualityName === 'maj' && ['7', '9', 'b9', 'b9_13', 's9_13'].includes(extension))
        qualityOrigins[bar][beat] = chord
      presetSelect.value = 'custom'
      refreshLabels(quality)
    })
    quality.addEventListener('blur', () => refreshLabels())
    quality.addEventListener('pointerdown', (event) => {
      event.preventDefault()
      openQualityMenu(quality, bar, beat)
    })
    quality.addEventListener('keydown', (event) => {
      if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(event.key)) {
        event.preventDefault()
        openQualityMenu(quality, bar, beat)
      }
    })
    main.append(rootWrapper, quality)
    const preview = document.createElement('button')
    preview.type = 'button'
    preview.className = 'chord-preview'
    preview.setAttribute('aria-label', `${bar + 1}小節 ${beat + 1}拍目のコードを試聴`)
    preview.title = 'コードを試聴'
    preview.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 10h4l5-4v12l-5-4H4zM16 9c1.5 1.5 1.5 4.5 0 6M19 6c3.5 3 3.5 9 0 12" /></svg>'
    preview.addEventListener('click', async () => {
      const chord = beat === 0 ? progression.slots[bar] : progression.beatSlots[bar][beat]
      if (!chord) return
      try {
        await chordInstrument.ready()
        if (chordInstrument.context) {
          const notes = progression.notesForBar(chord, bar, beat)
          chordInstrument.playAt(notes, chordInstrument.context.currentTime, 1.2, 1, chordWeights(notes, chord, progression.keyForBar(bar)))
        }
        if (progressionStatus) progressionStatus.textContent = ''
      } catch (error) {
        if (progressionStatus) progressionStatus.textContent = error instanceof Error ? error.message : 'コードを試聴できませんでした。'
      }
    })
    main.append(preview)
    box.append(main)
  }
  slotElements.push(box)
  slotContainer?.append(box)
})
startButton.addEventListener('click', () => {
  if (buddyController?.active) { buddyController.stop(); return }
  if (progression.running) {
    progression.stop()
    return
  }
  if (progressionStatus) progressionStatus.textContent = ''
  if (!tempo.reportValidity()) return
  progression.bpm = Number(tempo.value)
  if (buddyController) void buddyController.start()
  else void progression.start()
  updateTransport()
})
const tempoNumber = /** @type {HTMLInputElement} */ (document.querySelector('#tempo-value'))
tempo.addEventListener('input', () => {
  progression.bpm = Number(tempo.value)
  tempoNumber.value = tempo.value
})

tempoNumber.addEventListener('blur', () => {
  const value = Number(tempoNumber.value)
  if (!tempoNumber.value || !Number.isFinite(value)) {
    tempoNumber.value = tempo.value
    return
  }
  tempo.value = String(Math.max(40, Math.min(200, Math.round(value * 10) / 10)))
  tempo.dispatchEvent(new Event('input', { bubbles: true }))
})
tempoNumber.addEventListener('keydown', event => {
  if (event.key === 'Enter') tempoNumber.blur()
  if (event.key === 'Escape') { tempoNumber.value = tempo.value; tempoNumber.blur() }
})

keys.forEach((key, index) => {
  const option = document.createElement('option')
  option.value = String(index)
  option.textContent = key.name
  keySelect.append(option)
})
/** @param {HTMLSelectElement | null} [keepOptions] */
function refreshLabels(keepOptions = null) {
  slotContainer?.querySelectorAll('.modulation-bar').forEach((element, index) => {
    const section = index
    const offset = progression.modulation[section]
    const relative = offset - (progression.modulation[section - 1] ?? 0)
    const output = element.querySelector('output')
    if (output) output.textContent = `${relative > 0 ? '+' : ''}${relative} (${keys[progression.keyForBar(section * 2)].name})`
    const down = /** @type {HTMLButtonElement | null} */ (element.querySelector('.modulation-down'))
    const up = /** @type {HTMLButtonElement | null} */ (element.querySelector('.modulation-up'))
    if (down) down.disabled = offset <= -11
    if (up) up.disabled = offset >= 11
  })
  slotElements.forEach((element, bar) => {
    element.querySelectorAll('.beat-chord').forEach((beatElement, beat) => {
      const id = beat === 0 ? progression.slots[bar] : progression.beatSlots[bar][beat]
      const root = /** @type {HTMLSelectElement} */ (beatElement.querySelector('.root-select'))
      const barKey = progression.keyForBar(bar)
      const signature = `${barKey}:${notationMode()}:${beat}`
      if (root.dataset.signature !== signature) {
        root.replaceChildren()
        if (beat > 0) {
          const empty = document.createElement('option')
          empty.value = ''
          empty.textContent = '（変更なし）'
          root.append(empty)
        }
        for (let pitch = 0; pitch < 12; pitch++) {
          const option = document.createElement('option')
          option.value = String(pitch)
          option.textContent = displayParts(changeRoot('C', pitch), barKey).main
          root.append(option)
        }
        root.dataset.signature = signature
      }
      root.value = id ? String(rootPitch(id)) : ''
      const rootDisplay = beatElement.querySelector('.root-display')
      if (rootDisplay) rootDisplay.textContent = id ? root.selectedOptions[0]?.textContent ?? '' : '＋'
      const quality = /** @type {HTMLSelectElement} */ (beatElement.querySelector('.quality-select'))
      const preview = /** @type {HTMLButtonElement} */ (beatElement.querySelector('.chord-preview'))
      quality.hidden = !id
      preview.hidden = !id
      beatElement.classList.toggle('is-empty', !id)
      if (!id) return
      const config = chordConfig(id)
      const groupSignature = `${qualityOrigins[bar][beat]}|${id}`
      if (quality !== keepOptions && quality.dataset.origin !== groupSignature) {
        const groupedChoices = qualityGroups(qualityOrigins[bar][beat], id)
        quality.replaceChildren()
        for (const group of groupedChoices) {
          const optgroup = document.createElement('optgroup')
          optgroup.label = group.label
          for (const choice of group.options) {
            const option = document.createElement('option')
            option.value = choice.value
            option.textContent = choice.label
            optgroup.append(option)
          }
          quality.append(optgroup)
        }
        quality.dataset.origin = groupSignature
        quality.title = 'ルートに応じた候補。前後のコードによって響きの印象は変わります'
      }
      quality.value = `${config.quality}:${config.extension}`
      const isMajor = quality.value === 'maj:none'
      quality.classList.toggle('is-major', isMajor)
      quality.classList.toggle('is-long', (quality.selectedOptions[0]?.textContent?.length ?? 0) > 5)
      quality.setAttribute('aria-label', `${bar + 1}小節 ${beat + 1}拍目の響き：${isMajor ? 'maj' : quality.selectedOptions[0]?.textContent || '選択'}`)
    })
  })
  if (!progression.running) {
    activeChord = progression.slots[0]
    activeKey = progression.keyForBar(0)
  }
  refreshMelody()
  if (progressionStatus) progressionStatus.textContent = ''
}
notation.addEventListener('change', () => refreshLabels())
keySelect.addEventListener('change', () => {
  progression.key = Number(keySelect.value)
  refreshLabels()
  buddyController?.harmonyChanged()
})
for (const [selector, step] of [['#key-down', -1], ['#key-up', 1]]) {
  document.querySelector(String(selector))?.addEventListener('click', () => {
    keySelect.value = String((Number(keySelect.value) + Number(step) + keys.length) % keys.length)
    keySelect.dispatchEvent(new Event('change', { bubbles: true }))
  })
}
updateTransport()

const presetSelect = /** @type {HTMLSelectElement} */ (
  document.querySelector('#preset')
)
const presetGroupSelect = /** @type {HTMLSelectElement} */ (
  document.querySelector('#preset-group')
)
for (const group of presetGroups) {
  const option = document.createElement('option')
  option.value = group.id
  option.textContent = group.label
  presetGroupSelect.append(option)
}
/** @param {string} selectedId */
function populatePresets(selectedId) {
  presetSelect.replaceChildren()
  const placeholder = document.createElement('option')
  placeholder.value = ''
  placeholder.textContent = '進行を選択'
  placeholder.disabled = true
  presetSelect.append(placeholder)
  /** @type {Map<string, HTMLOptGroupElement>} */
  const families = new Map()
  for (const preset of orderedPresets()) {
    const level = `Lv.${presetLevel(preset)}`
    let family = families.get(level)
    if (!family) {
      family = document.createElement('optgroup')
      family.label = level
      families.set(level, family)
      presetSelect.append(family)
    }
    const option = document.createElement('option')
    option.value = preset.id
    const labels = ['1','♭2','2','♭3','3','4','♯4','5','♭6','6','♭7','7']
    const degrees = preset.pattern.map(chord => labels[rootPitch(chord)]).join(' → ')
    const tags = [`Lv.${presetLevel(preset)}`]
    if (preset.modulation.some(value => value !== 0)) tags.push('転調あり')
    if (preset.pattern.filter(chord => /9|11|13/.test(chord)).length >= 3) tags.push('テンション多め')
    option.textContent = `${degrees} 〔${tags.join('・')}〕`
    option.title = preset.name
    family.append(option)
  }
  const customOption = document.createElement('option')
  customOption.value = 'custom'
  customOption.textContent = 'カスタム'
  customOption.disabled = true
  presetSelect.append(customOption)
  presetSelect.value = Array.from(presetSelect.options).some((option) => option.value === selectedId) ? selectedId : ''
}
presetGroupSelect.addEventListener('change', () => {
  const first = presets.find((item) => item.group === presetGroupSelect.value)
  if (!first) return
  populatePresets(first.id)
  presetSelect.dispatchEvent(new Event('change', { bubbles: true }))
})
/** @param {string} id */
function applyPreset(id) {
  const selected = presets.find((item) => item.id === id)
  if (!selected) return
  progression.modulation = [...selected.modulation]
  progression.slots = presetSlots(selected.id)
  progression.clearBeatSlots()
  progression.beatSlots = presetBeatSlots(selected.id)
  qualityOrigins.splice(0, qualityOrigins.length, ...progression.slots.map((chord, bar) =>
    progression.beatSlots[bar].map((change) => change ?? chord),
  ))
  refreshLabels()
}
presetSelect.addEventListener('change', () => {
  if (!presets.some(item => item.id === presetSelect.value)) return
  applyPreset(presetSelect.value)
  buddyController?.harmonyChanged()
})
presetGroupSelect.value = '4'
populatePresets('royal')
const presetPrev = /** @type {HTMLButtonElement} */ (document.querySelector('#preset-prev'))
const presetNext = /** @type {HTMLButtonElement} */ (document.querySelector('#preset-next'))
function orderedPresets() {
  return [...presets].sort((a, b) => presetLevel(a) - presetLevel(b))
}
function updatePresetButtons() {
  const options = orderedPresets()
  const index = options.findIndex(item => item.id === presetSelect.value)
  presetPrev.disabled = index === 0
  presetNext.disabled = index === options.length - 1
}
for (const [button, direction] of /** @type {[HTMLButtonElement, number][]} */ ([[presetPrev, -1], [presetNext, 1]])) {
  button.addEventListener('click', () => {
    const options = orderedPresets()
    const index = options.findIndex(item => item.id === presetSelect.value)
    const next = index < 0
      ? options[0]
      : options[index + /** @type {number} */ (direction)]
    if (!next) return
    presetGroupSelect.value = next.group
    populatePresets(next.id)
    presetSelect.dispatchEvent(new Event('change', { bubbles: true }))
  })
}
presetSelect.addEventListener('change', updatePresetButtons)
updatePresetButtons()

/** @param {string} chord @param {number} [key] */
function displayParts(chord, key = progression.key) {
  const mode =
    notationMode() === 'roman'
      ? 'roman'
      : notationMode() === 'chord'
        ? 'chord'
        : 'number'
  return displayChordParts(chord, key, mode)
}
refreshLabels()

const rhythmSelect = /** @type {HTMLSelectElement} */ (
  document.querySelector('#rhythm-pattern')
)
/** @type {Map<string, HTMLOptGroupElement>} */
const rhythmGroups = new Map()
for (const pattern of rhythmPatterns) {
  const option = document.createElement('option')
  option.value = pattern.id
  option.textContent = pattern.label
  if (!pattern.group) rhythmSelect.append(option)
  else {
    let group = rhythmGroups.get(pattern.group)
    if (!group) {
      group = document.createElement('optgroup')
      group.label = pattern.group
      rhythmGroups.set(pattern.group, group)
      rhythmSelect.append(group)
    }
    group.append(option)
  }
}
rhythmSelect.value = progression.rhythm
rhythmSelect.addEventListener('change', () => {
  progression.drumSteps = null
  progression.rhythm = rhythmSelect.value
  renderDrumSteps()
  if (rhythmSelect.value === 'off') drums.silence()
})

const timbreSelect = /** @type {HTMLSelectElement} */ (
  document.querySelector('#chord-timbre')
)
for (const timbre of timbres) {
  const option = document.createElement('option')
  option.value = timbre.id
  option.textContent = timbre.label
  timbreSelect.append(option)
}
const melodyTimbre = /** @type {HTMLSelectElement} */ (document.querySelector('#melody-timbre'))
for (const timbre of melodyTimbres) {
  const option = document.createElement('option')
  option.value = timbre.id
  option.textContent = timbre.label
  melodyTimbre.append(option)
}
melodyTimbre.value = instrument.timbre
melodyTimbre.addEventListener('change', () => { instrument.setTimbre(melodyTimbre.value); buddyController?.timbreChanged() })
timbreSelect.value = chordInstrument.timbre
timbreSelect.addEventListener('change', () =>
  chordInstrument.setTimbre(timbreSelect.value),
)
const backingSelect = /** @type {HTMLSelectElement} */ (
  document.querySelector('#chord-backing')
)
for (const pattern of chordBackingPatterns) {
  const option = document.createElement('option')
  option.value = pattern.id
  option.textContent = pattern.label
  backingSelect.append(option)
}
backingSelect.value = progression.backing
backingSelect.addEventListener('change', () => {
  progression.backing = backingSelect.value
})

const genreSelect = /** @type {HTMLSelectElement} */ (
  document.querySelector('#genre')
)
const swing = /** @type {HTMLInputElement} */ (document.querySelector('#swing'))
const bassTimbre = /** @type {HTMLSelectElement} */ (
  document.querySelector('#bass-timbre')
)
const genreGroup = /** @type {HTMLSelectElement} */ (document.querySelector('#genre-group'))
for (const group of new Set(genres.map(genre => genre.group))) {
  const option = document.createElement('option')
  option.value = group
  option.textContent = group
  genreGroup.append(option)
}
function populateGenreStyles() {
  genreSelect.replaceChildren()
  for (const genre of genres.filter(genre => genre.group === genreGroup.value)) {
    const option = document.createElement('option')
    option.value = genre.id
    option.textContent = genre.label
    genreSelect.append(option)
  }
}
populateGenreStyles()
const stylePrev = /** @type {HTMLButtonElement} */ (document.querySelector('#style-prev'))
const styleNext = /** @type {HTMLButtonElement} */ (document.querySelector('#style-next'))
function updateStyleButtons() {
  stylePrev.disabled = genreGroup.selectedIndex === 0 && genreSelect.selectedIndex <= 0
  styleNext.disabled = genreGroup.selectedIndex === genreGroup.options.length - 1 && genreSelect.selectedIndex >= genreSelect.options.length - 1
}
for (const [button, direction] of [[stylePrev, -1], [styleNext, 1]]) {
  /** @type {HTMLButtonElement} */ (button).addEventListener('click', () => {
    const next = genreSelect.selectedIndex + /** @type {number} */ (direction)
    if (next < 0 || next >= genreSelect.options.length) {
      genreGroup.selectedIndex += /** @type {number} */ (direction)
      populateGenreStyles()
      genreSelect.selectedIndex = /** @type {number} */ (direction) < 0 ? genreSelect.options.length - 1 : 0
    } else {
      genreSelect.selectedIndex = next
    }
    genreSelect.dispatchEvent(new Event('change', { bubbles: true }))
  })
}
updateStyleButtons()
genreGroup.addEventListener('change', () => {
  populateGenreStyles()
  genreSelect.dispatchEvent(new Event('change', { bubbles: true }))
})
genreSelect.addEventListener('change', () => {
  updateStyleButtons()
  const genre = genres.find((item) => item.id === genreSelect.value)
  if (!genre) return
  const presetId = genreProgressions[/** @type {keyof typeof genreProgressions} */ (genre.id)]
  const recommended = presets.find(item => item.id === presetId)
  if (recommended) {
    presetGroupSelect.value = recommended.group
    populatePresets(recommended.id)
    applyPreset(recommended.id)
  }
  progression.genre = genre.id
  progression.bassPattern = genre.bassPattern
  bassPattern.value = progression.bassPattern
  progression.drumSteps = null
  progression.rhythm = genre.rhythm
  renderDrumSteps()
  setOrnamentStyle(genre.id)
  progression.bpm = genre.bpm
  progression.swing = genre.swing
  bass.timbre = genre.bass
  drums.timbre = genre.drum
  drumTimbre.value = genre.drum
  progression.backing = genre.backing
  backingSelect.value = progression.backing
  instrument.setTimbre(melodyTimbreFor(genre.melody))
  melodyTimbre.value = instrument.timbre
  melodyMode.dispatchEvent(new Event('change', { bubbles: true }))
  chordInstrument.setTimbre(genre.chord)
  timbreSelect.value = genre.chord
  rhythmSelect.value = genre.rhythm
  bassTimbre.value = genre.bass
  updatePartIcons()
  tempo.value = String(genre.bpm)
  swing.value = String(genre.swing)
  tempoNumber.value = tempo.value
  renderSwing()
  updatePresetButtons()
  buddyController?.styleChanged()
})
bassTimbre.addEventListener('change', () => {
  bass.timbre = bassTimbre.value
  updatePartIcons()
})
swing.addEventListener('input', () => {
  progression.swing = Number(swing.value)
  renderSwing()
})
function renderSwing() {
  document.querySelector('#swing-print .offbeats')?.setAttribute('transform', `translate(${18 * (swungBassBeat(1, Number(swing.value)) - 0.5)} 0)`)
  const output = document.querySelector('#swing-value')
  if (output) output.textContent = `${swing.value}%`
}

const ornamentTracks = ['bell', 'pluck', 'phrase', 'fx'].map((id, index) => ({
  id, pattern: ['sparkle-even', 'pluck-gaps', 'strings-lift', 'transition'][index],
  voice: new OrnamentPlayer(id, chordInstrument),
}))
progression.ornaments = ornamentTracks
const setOrnamentStyle = mountOrnaments(ornamentTracks)

const mixer = createPartMixer([
  { part: drums, volume: 0.35 }, { part: bass, volume: 0.5 },
  { part: chordInstrument, volume: 0.4 }, { part: instrument, volume: 0.4 },
  ...ornamentTracks.map(track => ({part: track.voice, volume: .24})),
])
for (const [index, id] of ['drum', 'bass', 'chord', 'melody', 'bell', 'pluck', 'phrase', 'fx'].entries()) {
  const volume = /** @type {HTMLInputElement} */ (document.querySelector(`#${id}-volume`))
  const renderVolume = () => {
    mixer.setVolume(index, Number(volume.value) / 100)
    volume.parentElement?.style.setProperty('--angle', `${-135 + Number(volume.value) * 2.7}deg`)
  }
  volume.addEventListener('input', renderVolume)
  // Drag relative to the starting value so touching the knob never jumps it.
  volume.addEventListener('pointerdown', event => {
    if (event.button !== 0) return
    event.preventDefault()
    volume.focus({ preventScroll: true })
    const startX = event.clientX
    const startY = event.clientY
    const startValue = Number(volume.value)
    volume.setPointerCapture(event.pointerId)
    /** @param {PointerEvent} move */
    const onMove = move => {
      if (move.pointerId !== event.pointerId) return
      const change = (move.clientX - startX) - (move.clientY - startY)
      const value = Math.max(0, Math.min(100, Math.round(startValue + change / 2)))
      if (Number(volume.value) !== value) {
        volume.value = String(value)
        volume.dispatchEvent(new Event('input', { bubbles: true }))
      }
    }
    /** @param {PointerEvent} end */
    const onEnd = end => {
      if (end.pointerId !== event.pointerId) return
      volume.removeEventListener('pointermove', onMove)
      volume.removeEventListener('pointerup', onEnd)
      volume.removeEventListener('pointercancel', onEnd)
      volume.removeEventListener('lostpointercapture', onEnd)
    }
    volume.addEventListener('pointermove', onMove)
    volume.addEventListener('pointerup', onEnd)
    volume.addEventListener('pointercancel', onEnd)
    volume.addEventListener('lostpointercapture', onEnd)
  })
  renderVolume()
  for (const mode of ['mute', 'solo']) {
    const toggle = mode === 'mute' ? mixer.toggleMute : mixer.toggleSolo
    const button = /** @type {HTMLButtonElement} */ (document.querySelector(`#${id}-${mode}`))
    button.addEventListener('click', () => button.setAttribute('aria-pressed', String(toggle(index))))
  }
}

const bassPattern = /** @type {HTMLSelectElement} */ (
  document.querySelector('#bass-pattern')
)
bassPattern.addEventListener('change', () => {
  progression.bassPattern = bassPattern.value
  if (bassPattern.value === 'off') bass.silence()
})
const drumTimbre = /** @type {HTMLSelectElement} */ (
  document.querySelector('#drum-timbre')
)
drumTimbre.addEventListener('change', () => {
  drums.timbre = drumTimbre.value
  updatePartIcons()
})

const trackButtons = Array.from(document.querySelectorAll('.track-select:not(.ornament-select)'))
for (const input of Array.from(document.querySelectorAll('input[name="bass-feel"]'))) {
  input.addEventListener('change', () => { progression.bassFeel = /** @type {HTMLInputElement} */ (input).value })
}
for (const [id, property] of [['bass-length', 'bassLength'], ['bass-dynamics', 'bassDynamics']]) {
  const input = /** @type {HTMLInputElement} */ (document.getElementById(id))
  const output = /** @type {HTMLOutputElement} */ (document.getElementById(`${id}-value`))
  input.addEventListener('input', () => {
    if (property === 'bassLength') progression.bassLength = Number(input.value)
    else progression.bassDynamics = Number(input.value)
    output.value = `${input.value}%`
  })
}
const bassSlide = /** @type {HTMLInputElement} */ (document.getElementById('bass-slide'))
bassSlide.addEventListener('change', () => { progression.bassSlide = bassSlide.checked })
for (const input of Array.from(document.querySelectorAll('#detail-bass .bass-tones input[type="checkbox"]:not(#bass-slide)'))) {
  input.addEventListener('change', () => {
    progression.bassTones = Array.from(document.querySelectorAll('#detail-bass .bass-tones input[type="checkbox"]:not(#bass-slide):checked'))
      .map((item) => /** @type {HTMLInputElement} */ (item).value)
  })
}
for (const button of trackButtons) {
  button.addEventListener('click', () => {
    const selected = /** @type {HTMLElement} */ (button).dataset.track
    for (const item of trackButtons)
      item.setAttribute('aria-pressed', String(item === button))
    const details = /** @type {HTMLElement} */ (document.querySelector('.track-details'))
    details.hidden = selected === 'melody'
    for (const name of ['drums', 'bass', 'chord', 'melody']) {
      const panel = /** @type {HTMLElement} */ (
        document.querySelector(`#detail-${name}`)
      )
      panel.hidden = name !== selected
    }
  })
}

// Keep the native selects as the source of truth while presenting their choices
// in the same tactile menu as the rest of the instrument.
const selectMenu = document.createElement('dialog')
selectMenu.className = 'select-menu'
document.body.append(selectMenu)
/** @type {HTMLSelectElement | null} */
let menuSelect = null
selectMenu.addEventListener('click', event => {
  if (event.target === selectMenu) selectMenu.close()
})
selectMenu.addEventListener('close', () => {
  menuSelect?.focus({ preventScroll: true })
  menuSelect = null
})
/** @param {HTMLSelectElement} select */
function openSelectMenu(select) {
  if (select.disabled || selectMenu.open) return
  menuSelect = select
  selectMenu.replaceChildren()
  selectMenu.setAttribute('aria-label', select.getAttribute('aria-label') || select.closest('label')?.childNodes[0]?.textContent?.trim() || '選択肢')
  for (const child of Array.from(select.children)) {
    if (child instanceof HTMLOptGroupElement) {
      const heading = document.createElement('div')
      heading.className = 'select-menu-heading'
      heading.textContent = child.label
      selectMenu.append(heading)
    }
    const options = child instanceof HTMLOptGroupElement ? Array.from(child.children) : [child]
    for (const option of options) {
      if (!(option instanceof HTMLOptionElement) || option.disabled || option.hidden || option.parentElement instanceof HTMLOptGroupElement && option.parentElement.disabled) continue
      const button = document.createElement('button')
      button.type = 'button'
      button.textContent = option.textContent
      if (option.selected) button.setAttribute('aria-current', 'true')
      button.addEventListener('click', () => {
        select.value = option.value
        select.dispatchEvent(new Event('change', { bubbles: true }))
        selectMenu.close()
      })
      selectMenu.append(button)
    }
  }
  const rect = select.getBoundingClientRect()
  const width = Math.min(Math.max(rect.width, 180), window.innerWidth - 16)
  selectMenu.style.width = `${width}px`
  selectMenu.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))}px`
  const height = Math.min(320, window.innerHeight - 16)
  selectMenu.style.top = `${Math.max(8, Math.min(rect.bottom + 4, window.innerHeight - height - 8))}px`
  selectMenu.style.maxHeight = `${height}px`
  selectMenu.showModal()
  const selected = /** @type {HTMLButtonElement | null} */ (selectMenu.querySelector('[aria-current="true"]'))
  ;(selected || selectMenu.querySelector('button'))?.focus()
}
document.addEventListener('pointerdown', event => {
  const select = event.target instanceof Element ? event.target.closest('select') : null
  if (!select || select.classList.contains('quality-select') || select.disabled) return
  event.preventDefault()
  openSelectMenu(select)
})
document.addEventListener('keydown', event => {
  const select = event.target instanceof HTMLSelectElement ? event.target : null
  if (!select || select.classList.contains('quality-select') || select.disabled) return
  if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(event.key)) {
    event.preventDefault()
    openSelectMenu(select)
  }
})

// Pictograms are printed in the same two inks as the existing part keys.
const partIcons = {
  drums: {
    acoustic: '<path class="stamp" d="M3 9q9 5 18 0l-2 9q-7 5-14 0z"/><ellipse class="print" cx="12" cy="7" rx="9" ry="3"/><path class="cut" d="m6 12 2 5 3-4m3 0 2 4 2-5"/>',
    electronic: '<rect class="stamp" x="2" y="3" width="20" height="18" rx="3"/><circle class="print" cx="7" cy="8" r="2"/><circle class="print" cx="17" cy="8" r="2"/><circle class="print" cx="7" cy="16" r="2"/><circle class="print" cx="17" cy="16" r="2"/>',
  },
  bass: {
    electric: '<path class="stamp" d="m13 9 6-7 3 2-7 8q2 4-2 8-4 4-8 1t-2-8q2-4 6-3z"/><path class="print" d="m5 15 4 4 2-2-4-4z"/><path class="cut" d="m10 14 8-9"/>',
    acoustic: '<path class="stamp" d="M13 2h3v8c3 1 4 3 4 6 0 4-3 6-8 6s-8-2-8-6c0-3 2-5 5-6l1-3h3z"/><circle class="print" cx="12" cy="15" r="2.5"/><path class="cut" d="M13 4v12m2-12v12"/>',
    synth: '<rect class="stamp" x="2" y="4" width="20" height="16" rx="2"/><path class="print" d="M5 7h3v5H5zm6 0h3v5h-3zm6 0h3v5h-3z"/><path class="cut" d="M7 14v4m5-4v4m5-4v4"/>',
  },
}
function updatePartIcons() {
  for (const [track, value] of [['drums', drumTimbre.value], ['bass', bassTimbre.value]]) {
    const icon = document.querySelector(`[data-track="${track}"] .part-icon`)
    const designs = track === 'drums' ? partIcons.drums : partIcons.bass
    const svg = Reflect.get(designs, value)
    if (icon && typeof svg === 'string') icon.innerHTML = svg
  }
}
updatePartIcons()

/** Render the first bar from the same pattern and articulation used in playback. */
function renderBassPhrase() {
  const svg = document.querySelector('#bass-phrase')
  if (!svg) return
  const events = bassFeelEvents(bassEvents(progression.bassPattern, 0, 0), progression.bassFeel)
  const chords = [{ beat: 0, id: progression.slots[0] }]
  progression.beatSlots[0].forEach((id, beat) => { if (id && beat) chords.push({ beat, id }) })
  let lastChord = '', noteIndex = 0
  const shapes = events.map((event, index) => {
    const beat = swungBassBeat(event.pulse, progression.swing)
    const chord = chords.filter(change => change.beat <= beat).at(-1) || chords[0]
    const harmony = bassHarmonyNotes(chord.id, progression.keyForBar(0))
    if (lastChord !== chord.id) { lastChord = chord.id; noteIndex = 0 }
    const offset = progression.bassTones.length
      ? bassToneOffset(noteIndex, progression.bassTones, harmony)
      : event.tone === 'root' ? 0 : bassToneOffset(1, [event.tone], harmony)
    noteIndex++
    const pitch = 36 + ((harmony[0] % 12 + 12) % 12) + event.midi + offset
    const duration = bassArticulation(event.duration, event.velocity, progression.bassLength, progression.bassDynamics)
    const nextBeat = events[index + 1] ? swungBassBeat(events[index + 1].pulse, progression.swing) : 4
    const nextChord = chords.find(change => change.beat > beat)?.beat ?? 4
    return { x: beat * 80, width: Math.max(3, Math.min(duration.duration, nextBeat - beat, nextChord - beat, 4 - beat) * 80 - 2), pitch, velocity: duration.velocity }
  })
  const pitches = shapes.map(shape => shape.pitch)
  const low = Math.min(...pitches, 36), high = Math.max(...pitches, 48)
  svg.innerHTML = [0, 1, 2, 3, 4].map(i => `<path class="bass-grid" d="M${i * 80} 0v56"/>`).join('') +
    shapes.map(shape => `<rect class="bass-note" x="${shape.x}" y="${44 - (shape.pitch - low) / Math.max(12, high - low) * 36}" width="${shape.width}" height="8" rx="3" opacity="${Math.max(.4, shape.velocity)}"/>`).join('')
}
document.addEventListener('input', event => {
  if (event.target instanceof Element && event.target.closest('#detail-bass, #swing')) renderBassPhrase()
})
document.addEventListener('change', event => {
  if (event.target instanceof Element && event.target.closest('#detail-bass, #bass-pattern, #genre, #chord-slots, #preset, #preset-group, #key')) renderBassPhrase()
})
renderBassPhrase()

let currentDrumPosition = -1
/** @param {number} step */
progression.onDrumPosition = step => {
  currentDrumPosition = step
  document.querySelectorAll('#drum-sequencer .drum-step').forEach(button => {
    button.classList.toggle('playing', Number(button.getAttribute('data-step')) === step)
  })
}

function renderDrumSteps() {
  const grid = document.querySelector('#drum-sequencer')
  if (!grid) return
  const hits = progression.drumSteps ?? rhythmPatterns.find(pattern => pattern.id === progression.rhythm)?.hits ?? []
  grid.replaceChildren()
  const corner = document.createElement('span')
  grid.append(corner)
  for (let step = 0; step < 16; step++) {
    const label = document.createElement('span')
    label.className = 'drum-step-label'
    label.textContent = step % 4 === 0 ? String(step / 4 + 1) : '·'
    grid.append(label)
  }
  for (const [sound, name] of [['hat', 'ハット'], ['snare', 'スネア'], ['kick', 'キック']]) {
    const label = document.createElement('span')
    label.className = 'drum-row-label'
    label.textContent = name
    grid.append(label)
    for (let step = 0; step < 16; step++) {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'drum-step'
      button.dataset.step = String(step)
      button.classList.toggle('playing', step === currentDrumPosition)
      if (step % 4 === 0) button.classList.add('beat-start')
      const matches = hits.filter(hit => hit.sound === sound && Math.round(hit.pulse * 2) % 16 === step)
      button.setAttribute('aria-label', `${name}、${Math.floor(step / 4) + 1}拍目の${step % 4 + 1}ステップ`)
      button.setAttribute('aria-pressed', String(matches.length > 0))
      button.addEventListener('click', () => {
        const current = progression.drumSteps ?? [...hits]
        progression.drumSteps = matches.length
          ? current.filter(hit => !(hit.sound === sound && Math.round(hit.pulse * 2) % 16 === step))
          : [...current, { sound, pulse: step / 2, velocity: sound === 'hat' ? 0.3 : 0.9 }].sort((a, b) => a.pulse - b.pulse)
        renderDrumSteps()
        const buttons = grid.querySelectorAll('button')
        const row = sound === 'hat' ? 0 : sound === 'snare' ? 1 : 2
        buttons[row * 16 + step]?.focus({ preventScroll: true })
      })
      grid.append(button)
    }
  }
}
renderDrumSteps()

const backingMonitor = document.querySelector('#backing-monitor')
const monitorKeys = new Map()
for (let midi = 36; midi <= 95; midi++) {
  const key = document.createElement('i')
  const black = [1, 3, 6, 8, 10].includes(midi % 12)
  key.className = black ? 'monitor-black' : 'monitor-white'
  key.style.setProperty('--key-position', String((Math.floor(midi / 12) - 3) * 7 + [0, 1, 1, 2, 2, 3, 4, 4, 5, 5, 6, 6][midi % 12]))
  backingMonitor?.append(key)
  monitorKeys.set(midi, key)
}
/** @type {Set<number>} */
let monitorNotes = new Set()
let monitorRoot = -1
/** @param {number} bar @param {string} chord @param {number} beat */
function updateChordMonitor(bar, chord, beat) {
  let chordBeat = Math.floor(beat)
  while (chordBeat > 0 && !progression.beatSlots[bar][chordBeat]) chordBeat--
  const nextNotes = new Set(progression.notesForBar(chord, bar, chordBeat))
  const root = (rootPitch(chord) + progression.keyForBar(bar) + 12) % 12
  const lowestRoot = Math.min(...[...nextNotes].filter(note => note % 12 === root))
  for (const midi of monitorNotes) {
    if (!nextNotes.has(midi)) monitorKeys.get(midi)?.classList.remove('sounding')
  }
  for (const midi of nextNotes) {
    if (!monitorNotes.has(midi)) monitorKeys.get(midi)?.classList.add('sounding')
  }
  if (monitorRoot !== lowestRoot) {
    monitorKeys.get(monitorRoot)?.classList.remove('root-note')
    monitorKeys.get(lowestRoot)?.classList.add('root-note')
    monitorRoot = lowestRoot
  }
  const label = `コードの構成音 MIDI ${[...nextNotes].join(', ')}`
  if (backingMonitor?.getAttribute('aria-label') !== label) backingMonitor?.setAttribute('aria-label', label)
  monitorNotes = nextNotes
}
updateChordMonitor(0, progression.slots[0], 0)

// Place sequential controls next to each part's pattern selector.
for (const [id, label] of [
  ['rhythm-pattern', 'ドラムパターン'],
  ['bass-pattern', 'ベースパターン'],
  ['chord-backing', 'コードのバッキング'],
  ['melody-mode', 'メロディの演奏方法'],
  ['bell-pattern', 'ベルパターン'], ['pluck-pattern', 'プラックパターン'],
  ['phrase-pattern', 'フレーズパターン'], ['fx-pattern', '展開FXパターン'],
]) {
  const select = /** @type {HTMLSelectElement} */ (document.getElementById(id))
  const control = select.closest('.select-control')
  if (!control) continue
  const wrapper = document.createElement('div')
  wrapper.className = 'part-pattern-picker'
  control.before(wrapper)
  wrapper.append(control)
  const stepper = document.createElement('div')
  stepper.className = 'style-stepper part-pattern-stepper'
  stepper.setAttribute('role', 'group')
  stepper.setAttribute('aria-label', `${label}を切り替え`)
  const previous = document.createElement('button')
  const next = document.createElement('button')
  for (const [button, direction, text] of [[previous, -1, '←'], [next, 1, '→']]) {
    const step = /** @type {number} */ (direction)
    const target = /** @type {HTMLButtonElement} */ (button)
    target.type = 'button'
    target.textContent = String(text)
    target.setAttribute('aria-label', `${step < 0 ? '前' : '次'}の${label}`)
    target.addEventListener('click', () => {
      const options = Array.from(select.options).filter(option => !option.disabled && !option.parentElement?.hasAttribute('disabled'))
      const index = options.indexOf(select.selectedOptions[0])
      const choice = options[index + step]
      if (!choice) return
      select.value = choice.value
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })
    stepper.append(target)
  }
  function updateStepper() {
    const options = Array.from(select.options).filter(option => !option.disabled && !option.parentElement?.hasAttribute('disabled'))
    const index = options.indexOf(select.selectedOptions[0])
    previous.disabled = index <= 0
    next.disabled = index < 0 || index >= options.length - 1
  }
  select.addEventListener('change', updateStepper)
  wrapper.append(stepper)
  updateStepper()
}

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
const buddy = /** @type {HTMLButtonElement} */ (document.querySelector('#oto-buddy'))
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
refreshBuddyLook()
let hasShownPlaybackTip = false
function refreshBuddy() {
  if (progression.running && !hasShownPlaybackTip) {
    buddyMessage.textContent = '鳴らしたまま、各パートの←→で奏法を変えてみよう。好きな組み合わせを探してね。'
    hasShownPlaybackTip = true
  }
  const failed = Boolean(status?.textContent?.trim() || progressionStatus?.textContent?.trim())
  const mood = failed ? 'error' : progression.running ? 'listening' : 'idle'
  if (buddy.dataset.mood === mood) return
  buddy.dataset.mood = mood
  buddy.title = failed ? '音の準備で困っています。表示されたメッセージを確認してね。' : progression.running ? '聴いてるよ。' : 'やあ。'
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
  if (target?.matches('#genre, #preset')) {
    respondToTouch(document.querySelector('.track-select[aria-pressed="true"] .part-icon'), [
      { transform: 'translateY(0)' }, { transform: 'translateY(-3px)' }, { transform: 'translateY(0)' },
    ])
  }
})

// Phone editing reuses the same select change handlers as the score.
const phoneEditor = document.createElement('dialog')
phoneEditor.className = 'mobile-editor'
phoneEditor.setAttribute('aria-label', 'コードを編集')
document.body.append(phoneEditor)
/** @type {HTMLButtonElement | undefined} */
let phoneEditorSource
phoneEditor.addEventListener('close', () => phoneEditorSource?.focus({ preventScroll: true }))
phoneEditor.addEventListener('click', event => {
  if (event.target === phoneEditor) phoneEditor.close()
})
slotElements.forEach((slot, bar) => {
  slot.querySelectorAll('.beat-chord').forEach((cell, beat) => {
    const edit = document.createElement('button')
    edit.type = 'button'
    edit.className = 'mobile-chord-edit'
    edit.setAttribute('aria-label', `${bar + 1}小節 ${beat + 1}拍目を編集`)
    edit.addEventListener('click', () => {
      phoneEditorSource = edit
      refreshLabels()
      const heading = document.createElement('h2')
      heading.textContent = `${bar + 1}小節 · ${beat + 1}拍目`
      const close = document.createElement('button')
      close.textContent = '完了'
      close.addEventListener('click', () => phoneEditor.close())
      const root = /** @type {HTMLSelectElement} */ (cell.querySelector('.root-select'))
      const quality = /** @type {HTMLSelectElement} */ (cell.querySelector('.quality-select'))
      const rootCopy = document.createElement('select')
      const qualityCopy = document.createElement('select')
      const sync = () => {
        for (const [source, target] of [[root, rootCopy], [quality, qualityCopy]]) {
          target.innerHTML = source.innerHTML
          target.value = source.value
        }
        qualityCopy.disabled = quality.hidden
      }
      for (const [name, source, copy] of [['ルート', root, rootCopy], ['響き・テンション', quality, qualityCopy]]) {
        const label = document.createElement('label')
        label.textContent = /** @type {string} */ (name)
        const target = /** @type {HTMLSelectElement} */ (copy)
        const original = /** @type {HTMLSelectElement} */ (source)
        label.append(target)
        target.setAttribute('aria-label', /** @type {string} */ (name))
        target.addEventListener('change', () => {
          original.value = target.value
          original.dispatchEvent(new Event('change', { bubbles: true }))
          sync()
        })
        if (source === root) phoneEditor.replaceChildren(heading, label)
        else phoneEditor.append(label)
      }
      sync()
      const actions = document.createElement('div')
      actions.className = 'mobile-editor-actions'
      const preview = document.createElement('button')
      preview.textContent = '▶ 試聴'
      preview.addEventListener('click', () => /** @type {HTMLButtonElement} */ (cell.querySelector('.chord-preview')).click())
      const modulationLabel = document.createElement('span')
      modulationLabel.textContent = `${Math.floor(bar / 2) * 2 + 1}〜${Math.floor(bar / 2) * 2 + 2}小節の転調`
      actions.append(preview, modulationLabel)
      for (const [text, selector] of [['−', '.modulation-down'], ['＋', '.modulation-up']]) {
        const button = document.createElement('button')
        button.textContent = text
        button.setAttribute('aria-label', `${modulationLabel.textContent}を半音${text === '−' ? '下げる' : '上げる'}`)
        button.addEventListener('click', () => {
          const bars = document.querySelectorAll('.modulation-bar')
          const control = /** @type {HTMLButtonElement} */ (bars[Math.floor(bar / 2)].querySelector(selector))
          control.click()
          sync()
        })
        actions.append(button)
      }
      phoneEditor.append(actions, close)
      phoneEditor.showModal()
      rootCopy.focus()
    })
    cell.append(edit)
  })
})
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

// Call-and-response shares the main pads, note palette and transport.
import { mountBuddy } from './buddy.js'
import { mountKeyboard, pianoNotes, pianoKey } from './keyboard.js'
mountKeyboard({
  ready: () => instrument.ready(),
  attack: (midi,glide) => {
    if (buddyController?.active) buddyController.attackMidi(midi,glide)
    else { instrument.attack(midi,glide); lastMelodyMidi=midi; lastMelodyDegree=melodyRole(midi,activeChord,activeKey).degree; refreshMelody() }
  },
  release: midi => { if(buddyController?.active)buddyController.releaseMidi(midi);else instrument.release(midi) },
  stop: () => { buddyController?.stop();instrument.silence() },
  onError: error => { if(status)status.textContent=error instanceof Error?error.message:'音を再生できませんでした。' },
})
buddyController = mountBuddy({
  progression, instrument, drums,
  getNotes: () => playableNotes,
  refreshTransport: updateTransport,
  onModeChange: mode => { melodyMode.value = mode },
  notesAt: (bar, beat) => {
    let chord = progression.slots[bar]
    for (let i = 1; i <= Math.floor(beat); i++) chord = progression.beatSlots[bar]?.[i] ?? chord
    // Otto follows the sounding harmony, independently of the human keyboard view.
    const key = progression.keyForBar(bar)
    const palette = melodyPalette(key, chord, key, 'chord')
    return palette.flatMap(note => [note.midi-12,note.midi,note.midi+12]
      .filter(midi => midi >= 60 && midi <= 84)
      .map(midi => ({...note,midi,...melodyRole(midi,chord,key)})))
      .filter((note,index,all) => all.findIndex(other => other.midi === note.midi) === index)
      .sort((a,b) => a.midi-b.midi)
  },
  reportNote: midi => {
    lastMelodyMidi = midi
    lastMelodyDegree = melodyRole(midi, activeChord, activeKey).degree
    refreshMelody()
  },
  reveal: () => {
    /** @type {HTMLButtonElement} */ (document.querySelector('[data-track="melody"]')).click()
    document.querySelector('#detail-melody')?.scrollIntoView({behavior: 'smooth', block: 'start'})
  },
})

// Start with the same complete arrangement as the displayed style.
genreSelect.dispatchEvent(new Event('change', {bubbles:true}))

// Portable arrangement files. Audio references and generated performances are not embedded.
const savedControls = Array.from(document.querySelectorAll('.groove input[id], .groove select[id], #track-grid input[id], #track-grid select[id], #detail-bass input[id], #key, #count-in'))
  .filter(element => element instanceof HTMLInputElement || element instanceof HTMLSelectElement)
const savedMix = Array.from(document.querySelectorAll('#track-grid button[id][aria-pressed]'))
const saveStatus = /** @type {HTMLElement} */ (document.querySelector('#song-status'))
const songFile = /** @type {HTMLInputElement} */ (document.querySelector('#song-file'))
document.querySelector('#song-save')?.addEventListener('click', () => {
  tempoNumber.blur()
  const data = {format:'oto-arrangement', version:1,
    controls:savedControls.map(element => { const el = /** @type {HTMLInputElement} */ (element); return {id:el.id,value:el.value,checked:el.checked ?? false} }),
    mix:savedMix.map(el => ({id:el.id,pressed:el.getAttribute('aria-pressed') === 'true'})),
    slots:progression.slots, beatSlots:progression.beatSlots, modulation:progression.modulation,
    bassFeel:progression.bassFeel, bassTones:progression.bassTones, drumSteps:progression.drumSteps}
  const url = URL.createObjectURL(new Blob([JSON.stringify(data,null,2)], {type:'application/json'}))
  const link = document.createElement('a'); link.href=url; link.download='oto-style.json'; link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  saveStatus.textContent = '設定ファイルを書き出しました。'
})
document.querySelector('#song-load')?.addEventListener('click', () => songFile.click())
songFile.addEventListener('change', async () => {
  const file = songFile.files?.[0]; if (!file) return
  try {
    if (file.size > 1024 * 1024) throw new Error('size')
    const data = JSON.parse(await file.text())
    const chord = (/** @type {unknown} */ value) => typeof value === 'string' && value.length < 100 && chordConfig(value) !== undefined
    if (data.format !== 'oto-arrangement' || data.version !== 1 || !Array.isArray(data.controls) || data.controls.length !== savedControls.length ||
        !Array.isArray(data.slots) || data.slots.length !== 8 || !data.slots.every(chord) ||
        !Array.isArray(data.beatSlots) || data.beatSlots.length !== 8 || !data.beatSlots.every((/** @type {unknown} */ row) => Array.isArray(row) && row.length === 4 && row.every(v => v === null || chord(v))) ||
        !Array.isArray(data.modulation) || data.modulation.length !== 4 || !data.modulation.every((/** @type {number} */ n) => Number.isInteger(n) && Math.abs(n) <= 120)) throw new Error('format')
    for (const element of savedControls) {
      const el = /** @type {HTMLInputElement} */ (element)
      const item = data.controls.find((/** @type {{id:string}} */ item) => item.id === el.id)
      if (!item || typeof item.value !== 'string' || typeof item.checked !== 'boolean') throw new Error('control')
      if (el instanceof HTMLSelectElement && el.id !== 'genre' && !Array.from(el.options).some(o => o.value === item.value)) throw new Error('option')
      if (el.type === 'range' || el.type === 'number') {
        const n = Number(item.value)
        if (!Number.isFinite(n) || n < Number(el.min) || n > Number(el.max)) throw new Error('range')
      }
    }
    if (!Array.isArray(data.mix) || !savedMix.every(el => data.mix.some((/** @type {{id:string,pressed:boolean}} */ m) => m.id === el.id && typeof m.pressed === 'boolean')) ||
      typeof data.bassFeel !== 'string' || !Array.isArray(data.bassTones) || !data.bassTones.every((/** @type {unknown} */ n) => typeof n === 'string' && ['root','third','fifth','seventh','octave','ninth'].includes(n)) ||
      !(data.drumSteps === null || Array.isArray(data.drumSteps) && data.drumSteps.every((/** @type {{sound:string,pulse:number,velocity:number}} */ h) => h && ['kick','snare','hat','openhat'].includes(h.sound) && Number.isFinite(h.pulse) && h.pulse >= 0 && h.pulse < 8 && (h.velocity === undefined || Number.isFinite(h.velocity))))) throw new Error('parts')
    buddyController?.stop(); progression.stop()
    for (const element of savedControls) {
      const el = /** @type {HTMLInputElement} */ (element)
      const item = data.controls.find((/** @type {{id:string}} */ item) => item.id === el.id)
      el.value = item.value; el.checked = item.checked
      el.dispatchEvent(new Event(el.type === 'range' || el.type === 'number' ? 'input' : 'change', {bubbles:true}))
    }
    for (const el of savedMix) {
      const item = data.mix.find((/** @type {{id:string}} */ m) => m.id === el.id)
      if ((el.getAttribute('aria-pressed') === 'true') !== item.pressed) /** @type {HTMLButtonElement} */ (el).click()
    }
    progression.slots = data.slots; progression.beatSlots = data.beatSlots; progression.modulation = data.modulation
    progression.bassFeel = data.bassFeel; progression.bassTones = data.bassTones; progression.drumSteps = data.drumSteps
    refreshLabels(); renderDrumSteps(); refreshMelody(); buddyController?.styleChanged()
    saveStatus.textContent = '保存した設定を読み込みました。'
  } catch { saveStatus.textContent = '読み込めませんでした。otoで保存した設定ファイルを選んでください。' }
  finally { songFile.value = '' }
})

const songDialog = /** @type {HTMLDialogElement} */ (document.querySelector('#song-dialog'))
const songOpen = /** @type {HTMLButtonElement} */ (document.querySelector('#song-open'))
songOpen.addEventListener('click', () => songDialog.showModal())
document.querySelector('#song-close')?.addEventListener('click', () => songDialog.close())
songDialog.addEventListener('close', () => songOpen.focus())

document.addEventListener('reference-preset', event => {
  const id = /** @type {CustomEvent<string>} */ (event).detail
  const selected = presets.find(p => p.id === id)
  if (!selected) return
  presetGroupSelect.value = selected.group; populatePresets(id)
  presetSelect.dispatchEvent(new Event('change', {bubbles:true}))
  updatePresetButtons()
})

// Sound buttons share the same change handlers as the selects.
for (const select of Array.from(document.querySelectorAll('#track-grid select[id$="-timbre"]'))) {
  if (!(select instanceof HTMLSelectElement) || !select.parentElement) continue
  const picker = document.createElement('div')
  picker.className = 'timbre-picker'
  const parent = select.parentElement
  parent.replaceChild(picker, select)
  picker.append(select)
  Array.from(select.options).forEach((option, index) => {
    const name = option.textContent || ''
    option.title = name
    option.textContent = String(index + 1).padStart(2, '0')
  })
  for (const [label, direction] of [['←', -1], ['→', 1]]) {
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = String(label)
    button.setAttribute('aria-label', `${select.getAttribute('aria-label') || '音色'} ${direction === -1 ? '前へ' : '次へ'}`)
    button.addEventListener('click', () => {
      select.selectedIndex = (select.selectedIndex + Number(direction) + select.options.length) % select.options.length
      select.dispatchEvent(new Event('change', {bubbles:true}))
    })
    picker.append(button)
  }
}
