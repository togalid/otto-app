import { sectionControlIds, arrangementControlIds, arrangementMixIds, decodeArrangement, encodeArrangement, restoreArrangement } from './arrangement-file.js'
import { mountBassDetail } from './bass-detail.js'
import { mountStyleChoices, mountPresetChoices } from './arrangement-selects.js'
import { mountMobileChordEditor } from './mobile-chord-editor.js'
import { mountBasicParts, mountReferenceControls } from './main-controls.js'
import { createApp, h, ref } from './vendor/vue.runtime.esm-browser.prod.js'
import { mountPartSteppers, mountTimbreSteppers } from './part-steppers.js'
import { mountChordGrid } from './chord-grid.js'
import { createChoiceMenu } from './choice-menu.js'
import { mountTransport } from './transport-view.js'
import { mountDrumGrid } from './drum-grid.js'
import { mountChordMonitor } from './chord-monitor.js'
import { createMelodyView } from './melody-view.js'
import { mountReferencePlayer } from './reference-player.js'
const playerDisplay = mountReferenceControls()
const referenceView = playerDisplay.state
const referenceTrack = mountReferencePlayer(referenceView, applyReferenceArrangement, section => progression.barCount(section))
mountBasicParts(referenceView, {
  toggleStem: referenceTrack.toggleStem,
  editReference: referenceTrack.editReference,
  cancelImport: referenceTrack.cancelImport,
  remove: referenceTrack.remove,
})
const { style: genreSelect, choose: chooseStyle } = mountStyleChoices()
const { preset: presetSelect, set: setPreset, choose: choosePreset, selected: selectedPreset } = mountPresetChoices()
import { OrnamentPlayer } from './ornament-audio.js'
import { mountOrnaments } from './ornament-ui.js'
import {
  notes,
  keys,
  presets,
  presetSlots,
  presetBeatSlots,
  melodyPalette,
  melodyRole,
  displayChordParts,
  rootPitch,
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
import { BassSynth, genres, genreProgressions, createPartMixer, swungBassBeat } from './groove.js'

/** @type {ReturnType<typeof mountBuddy> | undefined} */
let buddyController
const instrument = new Instrument('melody')
instrument.setTimbre('lead-round')
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
    onPointerup: () => releasePad(index),
    onPointercancel: () => releasePad(index),
    onLostpointercapture: () => releasePad(index),
    onClick: (/** @type {MouseEvent} */ event) => {
      if (event.detail === 0) { void play(index); buddyController?.release(index) }
    },
  }, [
    h('span', { class: 'pad-number' }, String(index + 1).padStart(2, '0')),
    h('span', { class: 'pad-note' }, note.label),
    h('span', { class: 'pad-role' }),
    h('kbd', note.key.toUpperCase()),
  ])),
}).mount('#pads')
buttons.push(...Array.from(document.querySelectorAll('#pads button'), button => /** @type {HTMLButtonElement} */ (button)))

document.addEventListener('keydown', (event) => {
  if (event.target instanceof Element && event.target.closest('dialog[open]')) return
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

const chordInstrument = new Instrument('chord')
const drums = new DrumSynth(chordInstrument)
const bass = new BassSynth(chordInstrument)
const slotContainer = document.querySelector('#chord-slots')
const progressionStatus = document.querySelector('#progression-status')
const transportView = mountTransport(togglePlayback)
const startButton = /** @type {HTMLButtonElement} */ (
  document.querySelector('#progression-play')
)
document.addEventListener('keydown', (event) => {
  if (event.target instanceof Element && event.target.closest('dialog[open]')) return
  if (event.target instanceof Element && event.target.closest('#piano-keys')) return
  if (event.code !== 'Space' || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return
  const spaceTarget = event.target instanceof Element ? event.target : null
  if (spaceTarget?.closest('.score-pad-dock button, .score-pad-dock input, .score-pad-dock select')) return
  event.preventDefault()
  event.stopPropagation()
  if (!event.repeat) {
    const target = spaceTarget
    const selected = document.querySelector('.pad-input-target')?.closest('.chord-slot')
    const bar = selected ? slotElements.indexOf(/** @type {HTMLElement} */(selected)) : -1
    const interactive = target?.closest('input, select, textarea, button:not(.score-chord-edit), [contenteditable=true]')
    if (bar >= 0 && !interactive) {
      if (progression.running) progression.stop()
      else playFromBar(bar)
    } else startButton.click()
  }
}, true)
// Left and right browse styles while ordinary controls keep their native keys.
document.addEventListener('keydown', event => {
  if (event.defaultPrevented || event.repeat || event.isComposing || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
  if (document.querySelector('dialog[open]')) return
  if (event.target instanceof Element && event.target.closest('input, select, textarea, [contenteditable]:not([contenteditable="false"]), [role="slider"], [role="radio"], #piano-keys')) return
  const button = /** @type {HTMLButtonElement | null} */ (document.getElementById(event.key === 'ArrowLeft' ? 'style-prev' : 'style-next'))
  if (!button || button.disabled) return
  event.preventDefault()
  button.click()
})
const tempo = /** @type {HTMLInputElement} */ (document.querySelector('#tempo'))
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
  transportView.running.value = progression.running || Boolean(buddyController?.active)
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
const playingSection = ref(-1)
const editingSection = ref(0)
const sectionAdvance = ref(false)
const sectionBars = ref(16)
const progression = new Progression(
  chordInstrument,
  (index, chord, key, beat, section) => {
    const previousSection = playingSection.value
    playingSection.value = index < 0 ? -1 : section
    if (index === 0 && beat === 0 && previousSection >= 0 && previousSection !== section) {
      editSection(section)
      referenceTrack.startWithAccompaniment(chordInstrument.context?.currentTime ?? 0, 0, section)
    }
    const visibleBar = section === editingSection.value ? index : -1
    transportView.beat.value = index < 0 ? '' : String(beat)
    if (displayedBar !== visibleBar || displayedBeat !== beat) {
      const previous = slotElements[displayedBar]
      previous?.querySelectorAll('.beat-chord')[displayedBeat]?.classList.remove('current-beat')
      if (displayedBar !== visibleBar) {
        previous?.classList.remove('current')
        previous?.removeAttribute('aria-current')
        slotElements[visibleBar]?.classList.add('current')
        slotElements[visibleBar]?.setAttribute('aria-current', 'step')
      }
      slotElements[visibleBar]?.querySelectorAll('.beat-chord')[beat]?.classList.add('current-beat')
      displayedBar = visibleBar
      displayedBeat = beat
    }
    if (activeChord !== chord || activeKey !== key) {
      activeChord = chord
      activeKey = key
      refreshMelody()
    }
    if (index >= 0) updateChordMonitor(index, chord, beat, section)
    updateTransport()
  },
  (message) => {
    if (progressionStatus) progressionStatus.textContent = message
  },
  drums,
  bass,
)
/** @type {{bar: number, section: number} | null} */
let barPlayback = null
/** Last explicitly selected playback head, kept separately from the running state. */
/** @type {Map<number, number>} */
const playbackHeads = new Map()
progression.onScheduleBar = () => playerDisplay.meter(chordInstrument.context)
progression.onStart = referenceTrack.startWithAccompaniment
progression.onStop = () => {
  barPlayback = null
  referenceTrack.stopWithAccompaniment()
  playerDisplay.stopMeter()
}
const refreshBassDetail = mountBassDetail(progression)
const drumGrid = mountDrumGrid(hits => {
  const captured = progression.sections[progression.selectedSection].performance
  if (captured) delete captured.drums
  progression.drumSteps = hits
  renderDrumSteps()
}, progression)
progression.onDrumPosition = drumGrid.showPosition
renderDrumSteps()
progression.melody = instrument
melodyMode.addEventListener('change', () => {
  progression.melodyPattern = ''
  buddyController?.setMode(melodyMode.value)
  instrument.silence()
  refreshMelody()
})

const qualityOrigins = progression.slots.map((chord) => [chord, chord, chord, chord, chord])
const qualityMenu = createChoiceMenu('quality')
/** @param {number} bar @param {number} beat @param {string} chord */
async function previewChord(bar, beat, chord) {
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
}

/** @param {HTMLSelectElement} select @param {number} bar @param {number} beat */
function openQualityMenu(select, bar, beat) {
  if (qualityMenu.busy) return
  refreshLabels()
  const groups = Array.from(select.querySelectorAll('optgroup'), group => ({
    heading: group.label,
    choices: Array.from(group.querySelectorAll('option'), option => ({
      label: option.textContent || '',
      value: option.value,
      selected: option.value === select.value,
      preview: () => {
        const current = beat === 0 ? progression.slots[bar] : progression.beatSlots[bar][beat]
        if (!current) return
        const [quality, extension] = option.value.split(':')
        void previewChord(bar, beat, customChord({ ...chordConfig(current), quality, extension }))
      },
    })),
  }))
  const rect = select.getBoundingClientRect()
  const width = Math.min(240, window.innerWidth - 16)
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))
  const minHeight = Math.min(150, window.innerHeight - 16)
  const top = Math.max(8, Math.min(rect.top - 30, window.innerHeight - minHeight - 8))
  const height = Math.min(260, window.innerHeight - top - 8)
  void qualityMenu.open(select, 'コードの響きを選択', groups, { left, top, width, height })
}
/** @param {number} bar */
function playFromBar(bar) {
  if (progression.running && barPlayback?.bar === bar && barPlayback.section === progression.selectedSection) {
    progression.stop(); updateTransport(); return
  }
  if (!tempo.reportValidity()) return
  if (progressionStatus) progressionStatus.textContent = ''
  progression.bpm = Number(tempo.value)
  playbackHeads.set(progression.selectedSection, bar)
  void progression.start(bar, 0)
  barPlayback = {bar, section: progression.selectedSection}
  updateTransport()
}
const slotElements = mountChordGrid(16, {
  play: playFromBar,
  modulate(section, amount) {
    progression.modulation[section] = Math.max(-11, Math.min(11, progression.modulation[section] + amount))
    refreshLabels()
  },
  root(bar, beat, value) {
    const chord = value === '' ? null : defaultChord(Number(value))
    if (beat === 0 && chord) progression.slots[bar] = chord
    else if (beat > 0) progression.beatSlots[bar][beat] = chord
    if (chord) qualityOrigins[bar][beat] = chord
    setPreset('custom')
    chordRate.disabled = true
    refreshChordCell(bar, beat)
  },
  quality(bar, beat, select) {
    const current = beat === 0 ? progression.slots[bar] : progression.beatSlots[bar][beat]
    if (!current) return
    const [quality, extension] = select.value.split(':')
    const chord = customChord({ ...chordConfig(current), quality, extension })
    if (beat === 0) progression.slots[bar] = chord
    else progression.beatSlots[bar][beat] = chord
    if (quality === 'maj' && ['7', '9', 'b9', 'b9_13', 's9_13'].includes(extension))
      qualityOrigins[bar][beat] = chord
    setPreset('custom')
    chordRate.disabled = true
    refreshChordCell(bar, beat, select)
  },
  openQuality: openQualityMenu,
  refresh: () => refreshLabels(),
  preview(bar, beat) {
    const chord = beat === 0 ? progression.slots[bar] : progression.beatSlots[bar][beat]
    if (chord) void previewChord(bar, beat, chord)
  },
})
let hasOpenedPlayPanel = false
function togglePlayback() {
  if (buddyController?.active) { buddyController.stop(); return }
  if (progression.running) {
    progression.stop()
    return
  }
  if (progressionStatus) progressionStatus.textContent = ''
  if (!tempo.reportValidity()) return
  progression.bpm = Number(tempo.value)
  const playbackHead = playbackHeads.get(progression.selectedSection)
  if (playbackHead !== undefined) {
    const bar = Math.min(playbackHead, progression.barCount() - 1)
    void progression.start(bar, 0)
    barPlayback = {bar, section: progression.selectedSection}
  } else if (buddyController) {
    const firstPlay = !hasOpenedPlayPanel
    if (firstPlay) hasOpenedPlayPanel = true
    void buddyController.start(firstPlay)
  } else void progression.start()
  updateTransport()
}
const tempoNumber = /** @type {HTMLInputElement} */ (document.querySelector('#tempo-value'))
tempo.addEventListener('input', () => {
  progression.bpm = Number(tempo.value)
  tempoNumber.value = tempo.value
})

tempo.addEventListener('keydown', event => {
  if (event.key !== 'ArrowUp' && event.key !== 'ArrowRight' && event.key !== 'ArrowDown' && event.key !== 'ArrowLeft') return
  event.preventDefault()
  const direction = event.key === 'ArrowUp' || event.key === 'ArrowRight' ? 1 : -1
  tempo.value = String(Math.round(Number(tempo.value)) + direction)
  tempo.dispatchEvent(new Event('input', { bubbles: true }))
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
  option.textContent = `${key.name}(${index > 0 ? '+' : ''}${index})`
  keySelect.append(option)
})
const mixerKey = /** @type {HTMLInputElement} */ (document.querySelector('#mixer-key'))
const mixerKeyValue = /** @type {HTMLOutputElement} */ (document.querySelector('#mixer-key-value'))
const meterInput = /** @type {HTMLInputElement} */ (document.querySelector('#meter'))
const meterValue = /** @type {HTMLOutputElement} */ (document.querySelector('#meter-value'))
function refreshMeter() {
  meterInput.value = String(progression.beatsPerBar)
  meterValue.value = `${progression.beatsPerBar}/4`
  meterInput.setAttribute('aria-valuetext', `${progression.beatsPerBar}拍子`)
  meterInput.parentElement?.style.setProperty('--angle', `${(progression.beatsPerBar - 4) * 90}deg`)
}
refreshMeter()
function refreshMixerKey() {
  const pitch = Number(keySelect.value)
  if ((Number(mixerKey.value) % 12 + 12) % 12 !== pitch) {
    mixerKey.value = String(pitch > 6 ? pitch - 12 : pitch)
  }
  const semitones = Number(mixerKey.value)
  const offsetLabel = `${semitones > 0 ? '+' : ''}${semitones}`
  mixerKeyValue.value = `${keys[pitch].name} (${offsetLabel})`
  mixerKey.setAttribute('aria-valuetext', `${keys[pitch].name} ${offsetLabel}`)
  mixerKey.parentElement?.style.setProperty('--angle', `${Number(mixerKey.value) * 11.25}deg`)
}
mixerKey.addEventListener('input', () => {
  keySelect.value = String((Number(mixerKey.value) % 12 + 12) % 12)
  keySelect.dispatchEvent(new Event('change', { bubbles: true }))
})
refreshMixerKey()
function refreshLabels() {
  // Sections can grow from eight to sixteen bars, and older scores have only
  // four beat entries. Keep the UI's choice origins aligned with the score.
  progression.slots.forEach((chord, bar) => {
    qualityOrigins[bar] ??= []
    for (let beat = 0; beat < 5; beat++) {
      qualityOrigins[bar][beat] ??= progression.beatSlots[bar]?.[beat] ?? chord
    }
  })
  sectionBars.value = progression.barCount()
  referenceTrack.refreshLoopLength()
  slotContainer?.querySelectorAll('.bar-play-controls button').forEach((element, bar) => { element.toggleAttribute('hidden', bar >= progression.barCount()) })
  slotContainer?.querySelectorAll('.modulation-bar').forEach((element, index) => {
    const section = index
    element.toggleAttribute('hidden', index * 2 >= progression.barCount())
    if (index * 2 >= progression.barCount()) return
    const offset = progression.modulation[section]
    const relative = offset - (progression.modulation[section - 1] ?? 0)
    const output = element.querySelector('output')
    if (output) output.textContent = `${keys[progression.keyForBar(section * 2)].name} (${relative > 0 ? '+' : ''}${relative})`
    const down = /** @type {HTMLButtonElement | null} */ (element.querySelector('.modulation-down'))
    const up = /** @type {HTMLButtonElement | null} */ (element.querySelector('.modulation-up'))
    if (down) down.disabled = offset <= -11
    if (up) up.disabled = offset >= 11
  })
  slotElements.forEach((element, bar) => {
    element.hidden = bar >= progression.barCount()
    if (element.hidden) return
    element.style.setProperty('--beats-per-bar', String(progression.beatsPerBar))
    element.querySelectorAll('.beat-chord').forEach((cell, beat) => {
      cell.toggleAttribute('hidden', beat >= progression.beatsPerBar)
      if (beat < progression.beatsPerBar) updateChordCell(cell, bar, beat)
    })
  })
  refreshHarmonyViews()
}

/** @param {number} bar @param {number} beat @param {HTMLSelectElement | null} [keepOptions] */
function refreshChordCell(bar, beat, keepOptions = null) {
  const cell = slotElements[bar].querySelectorAll('.beat-chord')[beat]
  if (cell) updateChordCell(cell, bar, beat, keepOptions)
  refreshHarmonyViews(bar === 0)
}

/** @param {Element} beatElement @param {number} bar @param {number} beat @param {HTMLSelectElement | null} [keepOptions] */
function updateChordCell(beatElement, bar, beat, keepOptions = null) {
  const mode = notationMode()
  const id = beat === 0 ? progression.slots[bar] : progression.beatSlots[bar][beat]
  const root = /** @type {HTMLSelectElement} */ (beatElement.querySelector('.root-select'))
  const barKey = progression.keyForBar(bar)
  const signature = `${barKey}:${mode}:${beat}`
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
  const editButton=beatElement.querySelector('.score-chord-edit')
  editButton?.setAttribute('aria-label',`${bar+1}小節 ${beat+1}拍目：${id ? displayParts(id,barKey).main : '変更なし'}をPadで編集`)
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
}

function refreshHarmonyViews(refreshBass = true) {
  if (!progression.running) {
    activeChord = progression.slots[0]
    activeKey = progression.keyForBar(0)
  }
  refreshMelody()
  if (refreshBass) refreshBassDetail()
  if (progressionStatus) progressionStatus.textContent = ''
}
notation.addEventListener('change', () => refreshLabels())
keySelect.addEventListener('change', () => {
  refreshMixerKey()
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

const chordRate = /** @type {HTMLSelectElement} */ (document.querySelector('#chord-rate'))
const chordRates = [1, 0.5, 2]

/** @param {typeof presets[number]} preset @param {number} rate */
function arrangePreset(preset, rate) {
  const slots = presetSlots(preset.id)
  const beatSlots = presetBeatSlots(preset.id)
  const modulation = [...preset.modulation]
  if (rate === 1) return { slots, beatSlots, modulation }

  const bars = Array.from({length: 8}, () => /** @type {(string | null)[]} */ ([null, null, null, null]))
  for (let bar = 0; bar < 8; bar++) {
    for (let beat = 0; beat < 4; beat++) {
      const chord = beatSlots[bar][beat] ?? (beat === 0 ? slots[bar] : null)
      if (!chord) continue
      const tick = Math.floor((bar * 4 + beat) / rate)
      if (rate === 0.5 && tick >= 32) break
      for (let offset = tick; offset < 32; offset += 32 / rate) {
        const row = bars[Math.floor(offset / 4)]
        row[offset % 4] ??= chord
      }
    }
  }
  let heldChord = slots[0]
  return {
    slots: bars.map(row => {
      const firstChord = row[0] ?? heldChord
      heldChord = row.slice().reverse().find(chord => chord !== null) ?? heldChord
      return firstChord
    }),
    beatSlots: bars.map(row => [null, ...row.slice(1)]),
    modulation: modulation.map((_, pair) => modulation[Math.floor(pair * rate)] ?? 0),
  }
}

/** @param {string} id */
function applyPreset(id) {
  const selected = presets.find((item) => item.id === id)
  if (!selected) return
  chordRate.disabled = false
  const double = /** @type {HTMLOptionElement} */ (chordRate.options[2])
  double.disabled = selected.modulation.some(Boolean)
  if (double.disabled && chordRate.value === '2') chordRate.value = '1'
  const {slots, beatSlots, modulation} = arrangePreset(selected, Number(chordRate.value))
  progression.modulation = modulation
  if (progression.slots.length === 16 && slots.length === 8) {
    slots.push(...slots)
    beatSlots.push(...beatSlots.map(row => [...row]))
    modulation.push(...modulation)
  }
  progression.slots = slots
  progression.clearBeatSlots()
  progression.beatSlots = beatSlots
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
chordRate.addEventListener('change', () => {
  applyPreset(selectedPreset.value)
  buddyController?.harmonyChanged()
})
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
  if (rhythmSelect.value === 'reference') return
  const captured = progression.sections[progression.selectedSection].performance
  if (captured) delete captured.drums
  syncCapturedChoices()
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

const swing = /** @type {HTMLInputElement} */ (document.querySelector('#swing'))
const bassTimbre = /** @type {HTMLSelectElement} */ (
  document.querySelector('#bass-timbre')
)
genreSelect.addEventListener('change', () => {
  const genre = genres.find((item) => item.id === genreSelect.value)
  if (!genre) return
  const presetId = genreProgressions[/** @type {keyof typeof genreProgressions} */ (genre.id)]
  const recommended = presets.find(item => item.id === presetId)
  if (recommended && !referenceView.filename) {
    setPreset(recommended.id)
    applyPreset(recommended.id)
  }
  delete progression.sections[progression.selectedSection].performance
  syncCapturedChoices()
  progression.genre = genre.id
  progression.bassPattern = genre.bassPattern
  bassPattern.value = progression.bassPattern
  progression.drumSteps = null
  progression.rhythm = genre.rhythm
  renderDrumSteps()
  setOrnamentStyle(genre.id)
  if (!referenceView.filename) progression.bpm = genre.bpm
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
  if (!referenceView.filename) tempo.value = String(genre.bpm)
  swing.value = String(genre.swing)
  tempoNumber.value = tempo.value
  renderSwing()
  buddyController?.styleChanged()
  rememberSectionParts()
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
  refreshBassDetail()
  const output = document.querySelector('#swing-value')
  if (output) output.textContent = `${swing.value}%`
}

const ornamentTracks = ['bell', 'pluck', 'phrase', 'fx'].map((id, index) => ({
  id, pattern: ['sparkle-even', 'pluck-gaps', 'strings-lift', 'transition'][index],
  voice: new OrnamentPlayer(id, chordInstrument),
}))
progression.ornaments = ornamentTracks
const setOrnamentStyle = mountOrnaments(ornamentTracks)

const mixParts = [
  { part: drums, volume: 0.35 }, { part: bass, volume: 0.5 },
  { part: chordInstrument, volume: 0.4 }, { part: instrument, volume: 0.4 },
  ...ornamentTracks.map(track => ({part: track.voice, volume: .24})),
  {part: referenceTrack, volume: .25},
]
const mixer = createPartMixer(mixParts)
/** @param {HTMLInputElement} input @param {number} sensitivity */
function bindKnobDrag(input, sensitivity) {
  const knob = input.parentElement
  if (!knob) return
  // Drag relative to the starting value so touching the knob never jumps it.
  input.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0) return
    event.preventDefault()
    input.focus({ preventScroll: true })
    const startX = event.clientX
    const startY = event.clientY
    const startValue = Number(input.value)
    knob.setPointerCapture(event.pointerId)
    /** @param {PointerEvent} move */
    const onMove = move => {
      if (move.pointerId !== event.pointerId) return
      const change = (move.clientX - startX) - (move.clientY - startY)
      const previous = input.value
      input.value = String(input === tempo ? Math.round(startValue + change * sensitivity) : startValue + change * sensitivity)
      if (input.value !== previous) {
        input.dispatchEvent(new Event('input', { bubbles: true }))
      }
    }
    /** @param {PointerEvent} end */
    const onEnd = end => {
      if (end.pointerId !== event.pointerId) return
      knob.removeEventListener('pointermove', onMove)
      knob.removeEventListener('pointerup', onEnd)
      knob.removeEventListener('pointercancel', onEnd)
      knob.removeEventListener('lostpointercapture', onEnd)
    }
    knob.addEventListener('pointermove', onMove)
    knob.addEventListener('pointerup', onEnd)
    knob.addEventListener('pointercancel', onEnd)
    knob.addEventListener('lostpointercapture', onEnd)
  })
}

bindKnobDrag(mixerKey, .12)
bindKnobDrag(meterInput, .025)

for (const input of [tempo, swing]) {
  const knob = document.createElement('span')
  knob.className = 'volume-knob timing-knob'
  const cap = document.createElement('span')
  cap.setAttribute('aria-hidden', 'true')
  input.before(knob)
  knob.append(input, cap)
  const refresh = () => {
    const ratio = (input.valueAsNumber - Number(input.min)) / (Number(input.max) - Number(input.min))
    knob.style.setProperty('--angle', `${-135 + ratio * 270}deg`)
  }
  input.addEventListener('input', refresh)
  document.getElementById('genre')?.addEventListener('change', refresh)
  bindKnobDrag(input, .5)
  refresh()
}

for (const [index, id] of ['drum', 'bass', 'chord', 'melody', 'bell', 'pluck', 'phrase', 'fx', 'reference'].entries()) {
  const volume = /** @type {HTMLInputElement} */ (document.querySelector(`#${id}-volume`))
  const renderVolume = () => {
    mixer.setVolume(index, Number(volume.value) / 100)
    volume.parentElement?.style.setProperty('--angle', `${-135 + Number(volume.value) * 2.7}deg`)
  }
  volume.addEventListener('input', renderVolume)
  bindKnobDrag(volume, .5)
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
  if (bassPattern.value === 'reference') return
  const captured = progression.sections[progression.selectedSection].performance
  if (captured) delete captured.bass
  syncCapturedChoices()
  progression.bassPattern = bassPattern.value
  if (bassPattern.value === 'off') bass.silence()
  refreshBassDetail()
})
const drumTimbre = /** @type {HTMLSelectElement} */ (
  document.querySelector('#drum-timbre')
)
drumTimbre.addEventListener('change', () => {
  drums.timbre = drumTimbre.value
  updatePartIcons()
})

const trackButtons = Array.from(document.querySelectorAll('.track-select[data-track]:not(.ornament-select)'))
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

// Select a part only for a direct user edit, not for style or file loading.
const trackGrid = /** @type {HTMLElement} */ (document.querySelector('#track-grid'))
/** @param {Event} event */
function selectEditedTrack(event) {
  if (!(event.target instanceof HTMLSelectElement)) return
  const row = event.target.closest('[role="group"]')
  const button = /** @type {HTMLButtonElement | null} */ (row?.querySelector('.track-select'))
  if (button) button.click()
}
trackGrid.addEventListener('change', event => {
  if (event.isTrusted) selectEditedTrack(event)
})
trackGrid.addEventListener('part-user-change', selectEditedTrack)

// Keep the native selects as the source of truth while presenting their choices
// in the same tactile menu as the rest of the instrument.
const styleDialog = document.createElement('dialog')
styleDialog.className = 'style-browser'
styleDialog.setAttribute('aria-label', 'ジャンルとスタイルを選ぶ')
document.body.append(styleDialog)
const styleGroup = ref('')
createApp({render: () => [
  h('div', {class: 'style-browser-header'}, [
    ...(styleGroup.value ? [h('button', {type: 'button', onClick: () => { styleGroup.value = '' }}, '← ジャンル')] : [h('strong', 'ジャンル')]),
    h('button', {type: 'button', 'aria-label': '閉じる', onClick: () => styleDialog.close()}, '×'),
  ]),
  ...(styleGroup.value
    ? genres.filter(item => item.group === styleGroup.value).map(item => h('button', {
      type: 'button', class: 'style-browser-choice', 'aria-current': item.id === genreSelect.value ? 'true' : undefined,
      onClick: () => { void chooseStyle(item.id); styleDialog.close() },
    }, item.label))
    : [...new Set(genres.map(item => item.group))].map(group => h('button', {
      type: 'button', class: 'style-browser-choice', onClick: () => { styleGroup.value = group },
    }, group + ' ›'))),
]}).mount(styleDialog)
document.getElementById('style-open')?.addEventListener('click', () => { styleGroup.value = ''; styleDialog.showModal() })
styleDialog.addEventListener('click', event => { if (event.target === styleDialog) styleDialog.close() })
styleDialog.addEventListener('close', () => document.getElementById('style-open')?.focus({preventScroll: true}))

const selectMenu = createChoiceMenu('select')
/** @param {HTMLSelectElement} select */
function openSelectMenu(select) {
  if (select.disabled || selectMenu.busy) return
  const groups = Array.from(select.children, child => {
    const group = child instanceof HTMLOptGroupElement ? child : null
    const options = group ? Array.from(group.children) : [child]
    return {
      heading: group?.label,
      choices: options.flatMap(option => {
        if (!(option instanceof HTMLOptionElement) || option.disabled || option.hidden || group?.disabled) return []
        return [{ label: option.textContent || '', value: option.value, selected: option.selected }]
      }),
    }
  })
  const label = select.getAttribute('aria-label') || select.closest('label')?.childNodes[0]?.textContent?.trim() || '選択肢'
  const rect = select.getBoundingClientRect()
  const width = Math.min(Math.max(rect.width, 180), window.innerWidth - 16)
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))
  const height = Math.min(320, window.innerHeight - 16)
  const top = Math.max(8, Math.min(rect.bottom + 4, window.innerHeight - height - 8))
  void selectMenu.open(select, label, groups, { left, top, width, height })
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
    electronic: '<rect class="stamp" x="2" y="3" width="20" height="18" rx="3"/><circle class="icon-cutout" cx="7" cy="8" r="2"/><circle class="icon-cutout" cx="17" cy="8" r="2"/><circle class="icon-cutout" cx="7" cy="16" r="2"/><circle class="icon-cutout" cx="17" cy="16" r="2"/>',
  },
  bass: {
    electric: '<path class="stamp" d="m13 9 6-7 3 2-7 8q2 4-2 8-4 4-8 1t-2-8q2-4 6-3z"/><path class="print" d="m5 15 4 4 2-2-4-4z"/><path class="cut" d="m10 14 8-9"/>',
    acoustic: '<path class="stamp" d="M13 2h3v8c3 1 4 3 4 6 0 4-3 6-8 6s-8-2-8-6c0-3 2-5 5-6l1-3h3z"/><circle class="print" cx="12" cy="15" r="2.5"/><path class="cut" d="M13 4v12m2-12v12"/>',
    synth: '<path class="stamp" d="M3 3h18v18H3z"/><path class="cut" fill="none" d="M5 15h3v-5h3v5h3v-5h3v5h2"/><circle class="print" cx="7" cy="6.5" r="1"/><circle class="print" cx="12" cy="6.5" r="1"/><circle class="print" cx="17" cy="6.5" r="1"/>',
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

function renderDrumSteps() {
  drumGrid.hits.value = progression.drumSteps ?? progression.drumHits()
}

const setChordMonitor = mountChordMonitor()
/** @param {number} bar @param {string} chord @param {number} beat @param {number} [section] */
function updateChordMonitor(bar, chord, beat, section = progression.selectedSection) {
  let chordBeat = Math.floor(beat)
  while (chordBeat > 0 && !progression.sections[section].beatSlots[bar][chordBeat]) chordBeat--
  const root = (rootPitch(chord) + progression.keyForBar(bar, section) + 12) % 12
  setChordMonitor(progression.notesForBar(chord, bar, chordBeat, section), root)
}
updateChordMonitor(0, progression.slots[0], 0)

for (const [selector, name] of [
  ['.drum-controls', 'drum'], ['.bass-controls', 'bass'], ['.chord-sound-controls', 'chord'], ['.melody-controls', 'melody'],
  ...['bell', 'pluck', 'phrase', 'fx'].map(id => [`#${id}-volume`, id]),
]) {
  const item = document.querySelector(selector)
  const mix = item?.closest('.part-mix') || item?.querySelector('.part-mix')
  if (!mix) continue
  const meter = document.createElement('span')
  meter.className = 'channel-meter'
  meter.setAttribute('data-channel-meter', name)
  meter.setAttribute('aria-hidden', 'true')
  for (let step = 0; step < 8; step++) {
    const segment = document.createElement('i')
    segment.style.setProperty('--step', String(step))
    meter.append(segment)
  }
  mix.append(meter)
}
for (const select of [rhythmSelect, bassPattern]) {
  const option = document.createElement('option')
  option.value = 'reference'
  option.textContent = '原曲から抽出'
  select.append(option)
}
mountPartSteppers()
function syncCapturedChoices() {
  const captured = progression.sections[progression.selectedSection].performance
  for (const [select, available] of /** @type {[HTMLSelectElement,boolean][]} */ ([[rhythmSelect, !!captured?.drums], [bassPattern, !!captured?.bass]])) {
    const option = select.querySelector('option[value="reference"]')
    if (option instanceof HTMLOptionElement) option.disabled = !available
    select.dispatchEvent(new Event('part-sync'))
  }
}
syncCapturedChoices()

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
  playerDisplay.setStyle(style?.label ?? '', style?.group ?? '')
})
refreshBuddyLook()
function refreshBuddy() {
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
  notesAt: (bar, beat, absoluteBar) => {
    const {section, bar:localBar} = progression.positionAt(absoluteBar)
    bar = localBar
    const {slots, beatSlots} = progression.sections[section]
    let chord = slots[bar]
    for (let i = 1; i <= Math.floor(beat); i++) chord = beatSlots[bar]?.[i] ?? chord
    // Otto follows the sounding harmony, independently of the human keyboard view.
    const key = progression.keyForBar(bar, section)
    const scalePitches = new Set(melodyPalette(key, chord, key, 'key').map(note => note.midi % 12))
    const palette = melodyPalette(key, chord, key, 'chord')
      .filter(note => !note.clash && (note.category === 'chord' || scalePitches.has(note.midi % 12)))
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

const sectionNames = ['A', 'B', 'C', 'D']
let restoringSectionParts = false

function readSectionParts() {
  return Object.fromEntries(sectionControlIds.map(id => {
    const control = /** @type {HTMLSelectElement} */ (document.getElementById(id))
    return [id, id === 'rhythm-pattern' ? progression.rhythm :
      id === 'bass-pattern' ? progression.bassPattern : control.value]
  }))
}

function rememberSectionParts() {
  if (!restoringSectionParts) progression.sections[progression.selectedSection].partSettings = readSectionParts()
}

function restoreSectionParts() {
  const settings = progression.sections[progression.selectedSection].partSettings
  if (!settings) return
  const currentPerformance = progression.sections[progression.selectedSection].performance
  const performance = currentPerformance ? {...currentPerformance} : undefined
  restoringSectionParts = true
  try {
    for (const id of sectionControlIds) {
      const control = /** @type {HTMLSelectElement} */ (document.getElementById(id))
      const value = settings[id]
      if (value !== undefined && control.value !== value) {
        control.value = value
        control.dispatchEvent(new Event('change', {bubbles: true}))
      }
    }
  } finally {
    progression.sections[progression.selectedSection].performance = performance
    restoringSectionParts = false
  }
}
for (const id of sectionControlIds) document.getElementById(id)?.addEventListener('change', rememberSectionParts)
progression.onScheduleSection = (/** @type {number} */ section) => {
  if (section !== progression.selectedSection) editSection(section)
}


/** @param {number} section */
function editSection(section) {
  queueMicrotask(() => document.dispatchEvent(new Event('reference-timing-refresh')))
  const timing = /** @type {HTMLInputElement | null} */ (document.querySelector('.reference-timing-control input'))
  if (timing) {
    timing.value = String(referenceTrack.getTiming(section))
    const output = document.querySelector('.reference-timing-control output')
    if (output) output.textContent = Number(timing.value).toFixed(2) + ' 秒'
  }
  progression.selectedSection = editingSection.value = section
  restoreSectionParts()
  sectionAdvance.value = progression.sections[section].advance
  const captured = progression.sections[section].performance
  rhythmSelect.value = captured?.drums ? 'reference' : progression.rhythm
  bassPattern.value = captured?.bass ? 'reference' : progression.bassPattern
  syncCapturedChoices()
  qualityOrigins.splice(0, qualityOrigins.length, ...progression.slots.map((chord, bar) =>
    progression.beatSlots[bar].map(change => change ?? chord)))
  const slots = JSON.stringify(progression.slots)
  const beats = JSON.stringify(progression.beatSlots)
  const modulation = JSON.stringify(progression.modulation)
  const rate = chordRates.find(rate => presets.some(item => matches(item, rate))) ?? 1
  const preset = presets.find(item => matches(item, rate))
  /** @param {typeof presets[number]} item @param {number} rate */
  function matches(item, rate) {
    if (rate === 2 && item.modulation.some(Boolean)) return false
    const layout = arrangePreset(item, rate)
    return JSON.stringify(layout.modulation) === modulation &&
      JSON.stringify(layout.slots) === slots && JSON.stringify(layout.beatSlots) === beats
  }
  chordRate.value = String(rate)
  chordRate.disabled = !preset
  chordRate.options[2].disabled = !!preset?.modulation.some(Boolean)
  setPreset(preset?.id ?? 'custom')
  refreshLabels()
  if (!progression.running) updateChordMonitor(0, progression.slots[0], 0)
}

createApp({
  render: () => [
    ...sectionNames.map((name, index) => h('button', {
      type: 'button', 'aria-label': `セクション${name}を編集`,
      'aria-pressed': String(index === editingSection.value),
      'data-playing': index === playingSection.value ? 'true' : undefined,
      onClick: () => editSection(index),
    }, name)),
    h('div', {class: 'section-advance', role: 'radiogroup', 'aria-label': 'セクション終了後'}, [
      ...[[false, 'ループ'], [true, '次へ']].map(([advance, label]) =>
        h('label', [
          h('input', {
            type: 'radio', name: 'section-advance', checked: sectionAdvance.value === advance,
            onChange: () => {
              progression.sections[editingSection.value].advance = sectionAdvance.value = Boolean(advance)
            },
          }),
          h('span', String(label)),
        ])),
    ]),
  ],
}).mount('#song-sections')

createApp({setup: () => () => h('div', {class:'section-bar-count'}, [
  h('span', {}, '小節数'),
  h('div', {class:'style-stepper'}, [
    h('button', {type:'button', disabled:sectionBars.value <= 1, 'aria-label':'小節数を減らす', onClick:() => changeBarCount(-1)}, '−'),
    h('output', {'aria-live':'polite'}, String(sectionBars.value)),
    h('button', {type:'button', disabled:sectionBars.value >= 16, 'aria-label':'小節数を増やす', onClick:() => changeBarCount(1)}, '＋'),
  ]),
])}).mount('#section-bar-count')
/** @param {number} delta */
function changeBarCount(delta) {
  const section = progression.sections[progression.selectedSection]
  const count = Math.max(1, Math.min(16, progression.barCount() + delta))
  // Older saved arrangements have eight stored bars; extend without losing edits.
  if (count > section.slots.length) {
    section.slots = [...section.slots, ...section.slots]
    section.beatSlots = [...section.beatSlots, ...section.beatSlots.map(row => [...row])]
    section.modulation = [...section.modulation, ...section.modulation]
  }
  section.barCount = count
  refreshLabels()
}

// Start with the same complete arrangement as the displayed style.
genreSelect.dispatchEvent(new Event('change', {bubbles:true}))
if (progression.slots.length === 8) {
  progression.slots = [...progression.slots, ...progression.slots]
  progression.beatSlots = [...progression.beatSlots, ...progression.beatSlots.map(row => [...row])]
  progression.modulation = [...progression.modulation, ...progression.modulation]
}
progression.sections[0].barCount = 16
for (let index = 1; index < progression.sections.length; index++) {
  const {slots, beatSlots, modulation} = progression.sections[0]
  progression.sections[index] = {slots: [...slots], beatSlots: beatSlots.map(row => [...row]), modulation: [...modulation], advance: false, barCount:16}
}

for (const section of progression.sections) section.partSettings = {...readSectionParts()}
refreshLabels()

// Adapt version 1 control IDs to the current UI.
const savedControls = new Map(arrangementControlIds.map(id =>
  [id, /** @type {HTMLInputElement | HTMLSelectElement} */ (document.getElementById(id))]))
const savedMix = new Map(arrangementMixIds.map(id =>
  [id, /** @type {HTMLButtonElement} */ (document.getElementById(id))]))

function saveArrangement() {
  tempoNumber.blur()
  const controls = [...savedControls.values()].map(el => ({
    id: el.id, value: el.id === 'rhythm-pattern' ? progression.rhythm : el.id === 'bass-pattern' ? progression.bassPattern : el.value, checked: el instanceof HTMLInputElement && el.checked,
  }))
  const mix = [...savedMix.values()].map(el => ({id: el.id, pressed: el.getAttribute('aria-pressed') === 'true'}))
  const {slots, beatSlots, modulation} = progression.sections[0]
  const {bassFeel, bassTones, drumSteps, drumAccents, drumPitch, sections, beatsPerBar} = progression
  const json = encodeArrangement(controls, mix, {slots, beatSlots, modulation, bassFeel, bassTones, drumSteps, drumAccents, drumPitch, beatsPerBar}, sections)
  const url = URL.createObjectURL(new Blob([json], {type: 'application/json'}))
  const link = document.createElement('a')
  link.href = url
  link.download = 'oto-style.json'
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return '設定ファイルを書き出しました。'
}

/** @param {File} file */
async function loadArrangement(file) {
  try {
    if (file.size > 1024 * 1024) throw new Error('size')
    const rules = [...savedControls.values()].map(el => {
      if (el instanceof HTMLSelectElement && el.id !== 'genre') {
        const options = Array.from(el.options, option => option.value)
        if (el.id === 'bass-pattern') options.push('')
        return {id: el.id, options}
      }
      if (el instanceof HTMLInputElement && (el.type === 'range' || el.type === 'number')) {
        return {id: el.id, range: /** @type {[number,number]} */ ([Number(el.min), Number(el.max)])}
      }
      return {id: el.id}
    })
    const arrangement = decodeArrangement(await file.text(), rules)
    await restoreArrangement(arrangement, {
      stop() { buddyController?.stop(); progression.stop() },
      chooseStyle,
      applyControl({id, value, checked}) {
        const el = savedControls.get(id)
        if (!el) return
        el.value = value
        if (el instanceof HTMLInputElement) el.checked = checked
        const eventType = el.type === 'range' || el.type === 'number' ? 'input' : 'change'
        el.dispatchEvent(new Event(eventType, {bubbles: true}))
      },
      applyMix({id, pressed}) {
        const el = savedMix.get(id)
        if (el && (el.getAttribute('aria-pressed') === 'true') !== pressed) el.click()
      },
      applyScore(score, sections) {
        progression.beatsPerBar = score.beatsPerBar ?? 4
        refreshMeter()
        const fallbackParts = readSectionParts()
        for (const section of sections) section.partSettings ??= {...fallbackParts}
        progression.sections = sections
        progression.bassFeel = score.bassFeel
        progression.bassTones = score.bassTones
        progression.drumSteps = score.drumSteps
        progression.drumAccents = score.drumAccents ?? []
        progression.drumPitch = score.drumPitch ?? {}
        drumGrid.refreshSettings()
        editSection(0)
        renderDrumSteps()
        buddyController?.styleChanged()
      },
    })
    return '保存した設定を読み込みました。'
  } catch {
    return '読み込めませんでした。otoで保存した設定ファイルを選んでください。'
  }
}

const songOpen = /** @type {HTMLButtonElement} */ (document.querySelector('#song-open'))
/** @type {Promise<ReturnType<import('./song-dialog.js').mountSongDialog>> | undefined} */
let songDialogPromise
songOpen.addEventListener('click', async () => {
  songOpen.disabled = true
  try {
    songDialogPromise ??= import('./song-dialog.js').then(({ mountSongDialog }) =>
      mountSongDialog({ save: saveArrangement, load: loadArrangement, onClose: () => document.getElementById('settings-open')?.focus() }))
    const dialog = await songDialogPromise
    dialog.open()
  } catch {
    songDialogPromise = undefined
    if (progressionStatus) progressionStatus.textContent = '設定画面を開けませんでした。もう一度お試しください。'
  } finally {
    songOpen.disabled = false
  }
})

mountTimbreSteppers()

/** @param {{bpm:number,key:number,presets:string[],style?:string}} result */
async function applyReferenceArrangement(result) {
  await chooseStyle(result.style ?? genreSelect.value)
  if (bassPattern.value === 'straight16') {
    bassPattern.value = 'straight8'
    bassPattern.dispatchEvent(new Event('change', {bubbles:true}))
  }
  bassPattern.value = 'straight4'
  bassPattern.dispatchEvent(new Event('change', {bubbles:true}))
  swing.value = '0'
  swing.dispatchEvent(new Event('input', {bubbles:true}))
  backingSelect.value = 'whole'
  backingSelect.dispatchEvent(new Event('change', {bubbles:true}))
  tempo.value = String(result.bpm)
  tempo.dispatchEvent(new Event('input', {bubbles:true}))
  keySelect.value = String(result.key)
  keySelect.dispatchEvent(new Event('change', {bubbles:true}))
  progression.drumSteps = null
  renderDrumSteps()
  for (let index = 0; index < sectionNames.length; index++) {
    const preset = presets.find(item => item.id === result.presets[index]) ?? presets.find(item => item.id === 'royal')
    if (!preset) continue
    progression.sections[index] = {
      barCount:16,
      slots: Array(16).fill('FM7'),
      beatSlots: Array.from({length:16}, () => [null, null, null, null]),
      modulation: Array(8).fill(0),
      advance: true,
      partSettings: {...readSectionParts()},
    }
  }
  editSection(0)
  buddyController?.styleChanged()
}

const timingControl = document.createElement('label')
timingControl.className = 'reference-timing-control'
timingControl.textContent = '原曲の開始位置 '
const timingInput = document.createElement('input')
timingInput.type = 'range'
timingInput.min = '-0.9'
timingInput.max = '0.9'
timingInput.step = '0.01'
timingInput.value = '0'
timingInput.title = 'セクションの開始位置を調整'
timingInput.setAttribute('aria-label', '原曲のタイミング（秒）')
const timingOutput = document.createElement('output')
timingOutput.value = '0.00 秒'
timingInput.addEventListener('input', () => {
  referenceTrack.setTiming(editingSection.value, timingInput.valueAsNumber)
  timingOutput.value = referenceTrack.getTiming(editingSection.value).toFixed(2) + ' 秒'
  updateTimingPreview()
})
timingControl.append(timingInput, timingOutput)
document.querySelector('.chord-settings')?.append(timingControl)

const timingPreview = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
timingPreview.classList.add('timing-waveform')
timingPreview.setAttribute('viewBox', '0 0 1000 100')
timingPreview.setAttribute('preserveAspectRatio', 'none')
timingPreview.setAttribute('role', 'img')
timingPreview.setAttribute('aria-label', '原曲の波形と2小節の8分音符グリッド')
const timingWave = document.createElementNS(timingPreview.namespaceURI, 'path')
timingPreview.append(timingWave)
let timingMeter = 0
function refreshTimingGrid() {
  if (timingMeter === progression.beatsPerBar) return
  timingMeter = progression.beatsPerBar
  timingPreview.querySelectorAll('line').forEach(line => line.remove())
  const eighths = timingMeter * 4
  for (let beat = 0; beat <= eighths; beat++) {
    const line = document.createElementNS(timingPreview.namespaceURI, 'line')
    line.setAttribute('x1', String(beat * 1000 / eighths))
    line.setAttribute('x2', String(beat * 1000 / eighths))
    line.setAttribute('y1', '0'); line.setAttribute('y2', '100')
    line.setAttribute('class', beat % (timingMeter * 2) === 0 ? 'bar-grid' : beat % 2 === 0 ? 'beat-grid' : 'eighth-grid')
    timingPreview.append(line)
  }
}
const timingRow = document.createElement('div')
timingRow.className = 'reference-timing-row'
timingRow.hidden = !referenceView.filename
document.addEventListener('reference-timing-refresh', () => {
  queueMicrotask(() => {
    timingRow.hidden = !referenceView.filename
    const bounds = referenceTrack.timingBounds(editingSection.value)
    timingInput.min = String(bounds.min); timingInput.max = String(bounds.max)
    timingInput.value = String(referenceTrack.getTiming(editingSection.value))
    updateTimingPreview()
  })
})
timingControl.replaceWith(timingRow)
timingRow.append(timingControl, timingPreview)
/** @param {boolean} [redraw] */
function updateTimingPreview(redraw = true) {
  refreshTimingGrid()
  const seconds = (120 * progression.beatsPerBar) / Math.max(40, Number(tempo.value))
  if (redraw || !timingWave.getAttribute('d')) timingWave.setAttribute('d', referenceTrack.timingWaveform(editingSection.value, seconds))
  timingWave.removeAttribute('transform')
}
document.addEventListener('reference-timing-refresh', () => updateTimingPreview())
tempo.addEventListener('input', () => updateTimingPreview())
updateTimingPreview()



// Move the source underneath the fixed musical grid.
timingPreview.style.touchAction = 'none'
timingPreview.addEventListener('pointerdown', event => {
  const startX = event.clientX
  const initial = referenceTrack.getTiming(editingSection.value)
  const width = timingPreview.getBoundingClientRect().width
  const seconds = (120 * progression.beatsPerBar) / Math.max(40, Number(tempo.value))
  timingPreview.setPointerCapture(event.pointerId)
  const move = (/** @type {PointerEvent} */ next) => {
    timingInput.value = String(initial - (next.clientX - startX) / width * seconds)
    timingInput.dispatchEvent(new Event('input'))
  }
  const end = () => {
    timingPreview.removeEventListener('pointermove', move)
    timingPreview.removeEventListener('pointerup', end)
    timingPreview.removeEventListener('pointercancel', end)
  }
  timingPreview.addEventListener('pointermove', move)
  timingPreview.addEventListener('pointerup', end)
  timingPreview.addEventListener('pointercancel', end)
})

// Meter changes preserve quarter-note tempo and the current accompaniment transport.
meterInput.addEventListener('input', () => {
  progression.beatsPerBar = /** @type {3|4|5} */ (Number(meterInput.value))
  refreshMeter()
  refreshLabels()
  drumGrid.refreshSettings()
  renderDrumSteps()
  buddyController?.styleChanged()
  updateTimingPreview()
})

import { mountScorePad } from './score-pad.js'
mountScorePad({
 key:bar=>progression.keyForBar(bar), notation:notationMode, section:()=>progression.selectedSection,
 bars:()=>progression.barCount(), beats:()=>progression.beatsPerBar,
 play:bar=>{if(progression.running)progression.stop();else playFromBar(bar)},
 read:(bar,beat)=>beat===0?progression.slots[bar]:progression.beatSlots[bar][beat],
 write:(bar,beat,id)=>{
  if(id!==null)chordConfig(id)
  if(beat===0){if(!id)return;progression.slots[bar]=id}
  else progression.beatSlots[bar][beat]=id
  if(id)qualityOrigins[bar][beat]=id
  setPreset('custom');chordRate.disabled=true;refreshChordCell(bar,beat)
 },
})
