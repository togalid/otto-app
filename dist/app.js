import { applySavedControl, arrangementControlRules } from './arrangement-controls.js'
import { decodeStudioStyle, drumPlaybackNotes, defaultDrumPatterns } from './studio-style.js'
import { mountStudioEditors } from './studio-editors.js'
import { bundledDrumKits } from './drum-kit-manifest.js'
import { createPartSettings } from './part-settings.js'
import { mountQuickMixer, bassPadNotes } from './quick-mixer.js'
import { mountReferenceTiming } from './reference-timing-view.js'
import { padChordNotes } from './music.js'
import { createBackingDetail } from './backing-detail.js'
import { performanceMatch } from './buddy.js'
import { restoreSongSections } from './song-score.js'
import { sectionControlIds, arrangementControlIds, arrangementMixIds, styleDefaultJson, decodeArrangement, encodeArrangement, restoreArrangement } from './arrangement-file.js'
import { mountBassDetail } from './bass-detail.js'
import { mountStyleChoices, mountPresetChoices } from './arrangement-selects.js'
import { mountBasicParts, mountReferenceControls, mountReferenceDetail, bindKnobDrag, bindTempoKnob, mountPartIcons, mountSectionControls } from './main-controls.js'
import { ref } from './vendor/vue.runtime.esm-browser.prod.js'
import { drumPadNames, drumPadTypes, drumPadType, drumPadState, drumPadPlayable, mountMelodyVoiceChoice, mountPartSteppers, mountTimbreSteppers } from './part-steppers.js'
import { mountChordGrid, mountScoreContext, mountScoreBarCount, mountScorePaging, mountMobileScoreTools } from './chord-grid.js'
import { createChoiceMenu, mountSelectMenus } from './choice-menu.js'
import { mountTransport, mountPlayhead } from './transport-view.js'
import { mountDrumGrid } from './drum-grid.js'
import { mountChordMonitor } from './chord-monitor.js'
import { createMelodyView, mountMelodyPads, mountMelodyLayout, mountBuddyFeedback, mountMobileLayout, mountModeMenu } from './melody-view.js'
import { mountReferencePlayer } from './reference-player.js'
const playerDisplay = mountReferenceControls()
const referenceView = playerDisplay.state
const referenceTrack = mountReferencePlayer(referenceView, applyReferenceArrangement, section => progression.barCount(section))
mountBasicParts(referenceView, {
  toggleStem: referenceTrack.toggleStem,
  separateStems: referenceTrack.separateStems,
  editReference: referenceTrack.editReference,
  cancelImport: referenceTrack.cancelImport,
  remove: referenceTrack.remove,
})
const referenceTimingHost = mountReferenceDetail(referenceView, referenceTrack.remove)
const partSettings = createPartSettings()
const { style: genreSelect, choose: chooseStyle } = mountStyleChoices({capture:captureStudioStyle, restore:restoreStudioStyle})
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
import { Instrument, audioContext, chordWeights } from './audio.js'
import { DrumSynth, rhythmPatterns } from './rhythm.js'
import { Progression, maxChordBeats } from './progression.js'
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
      recordManualMatch(note.midi)
      instrument.attack(note.midi)
    } else { recordManualMatch(note.midi); await instrument.play(note.midi) }
    lastMelodyMidi = note.midi
    lastMelodyDegree = note.degree
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

buttons.push(...mountMelodyPads({ play, release: releasePad, clickRelease: index => buddyController?.release(index) }))

document.addEventListener('keydown', (event) => {
  if (document.body.dataset.appMode !== 'free') return
  if (!document.querySelector('#track-grid .track-select[data-track="melody"][aria-pressed="true"]')) return
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
  if (document.body.dataset.appMode !== 'free') return
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
const progressionStatus = document.querySelector('#progression-status')
const transportView = mountTransport(togglePlayback)
const startButton = /** @type {HTMLButtonElement} */ (
  document.querySelector('#progression-play')
)
document.addEventListener('keydown', (event) => {
  if (document.body.dataset.appMode !== 'free') return
  if (event.target instanceof Element && event.target.closest('dialog[open]')) return
  if (event.target instanceof Element && event.target.closest('#piano-keys')) return
  if (event.code !== 'Space' || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return
  const spaceTarget = event.target instanceof Element ? event.target : null
  if (spaceTarget?.closest('.score-pad-dock button, .score-pad-dock input, .score-pad-dock select, .session-turn-ring, .arrange-clef')) return
  event.preventDefault()
  event.stopPropagation()
  if (!event.repeat) {
    if (spaceTarget instanceof HTMLButtonElement && spaceTarget.matches('.arrange-beat')) spaceTarget.blur()
    const target = spaceTarget
    const selected = document.querySelector('.pad-input-target')?.closest('.chord-slot')
    const bar = selected ? slotElements.indexOf(/** @type {HTMLElement} */(selected)) : -1
    const interactive = target?.closest('input, select, textarea, button:not(.score-chord-edit), [contenteditable=true]')
    if (spaceTarget?.closest('.timing-waveform')) { startButton.click(); return }
    if (bar >= 0 && !interactive) {
      if (progression.running) progression.stop()
      else playFromBar(bar)
    } else startButton.click()
  }
}, true)
// Left and right browse styles while ordinary controls keep their native keys.
document.addEventListener('keydown', event => {
  if (document.body.dataset.appMode !== 'free') return
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
  const melodyPanel=document.querySelector('#detail-melody')
  if(melodyPanel instanceof HTMLElement) {
    melodyPanel.dataset.transportRunning=String(progression.running)
    melodyPanel.style.setProperty('--otto-beat-duration',`${60 / progression.bpm}s`)
  }
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
document.addEventListener('melody-keyboard-change', refreshMelody)
let resumeMelodyBar = 0
let referenceBarInput = /** @type {HTMLInputElement | undefined} */ (undefined)
let melodyPlayhead = /** @type {HTMLElement | undefined} */ (undefined)
let melodyExpressionBar = -1
let manualBeatTime = -Infinity
let manualMatchTotal = 0, manualMatchCount = 0, manualMatchRate = 0
/** @type {ReturnType<typeof setTimeout>|undefined} */
let humanMotionTimer
function showHumanPlaying() {
 const panel=document.querySelector('#detail-melody')
 panel?.setAttribute('data-human-playing','true')
 clearTimeout(humanMotionTimer)
 humanMotionTimer=setTimeout(()=>panel?.removeAttribute('data-human-playing'),Math.max(700,120000/progression.bpm))
}
window.addEventListener('blur',()=>{clearTimeout(humanMotionTimer);document.querySelector('#detail-melody')?.removeAttribute('data-human-playing')})
/** @param {number} midi */
function recordManualMatch(midi) {
 showHumanPlaying()
 if(!progression.running || buddyController?.active)return
 manualMatchTotal+=performanceMatch(midi,activeChord,activeKey,(performance.now()-manualBeatTime)/1000,progression.bpm,progression.swing)
 manualMatchCount++
}
let displayedBar = -1
let displayedBeat = -1
const playingSection = ref(-1)
const editingSection = ref(0)
const sectionBars = ref(16)
const scorePage = ref(0)
const pickupChord = ref(/** @type {string|null} */ (null))
const sectionContextRevision = ref(0)
let refreshSectionControls = () => {}
const progression = new Progression(
  chordInstrument,
  (index, chord, key, beat, section) => {
    melodyExpressionBar=index
    manualBeatTime=index>=0?performance.now():-Infinity
    if (index >= 0) {
      resumeMelodyBar = index
      for (const input of [melodyPlayhead?.querySelector('input'), referenceBarInput]) {
        if (input && document.activeElement !== input) input.value = String(index + 1)
      }
    }
    if(index>=0 && Math.floor(index/16)!==scorePage.value){scorePage.value=Math.floor(index/16);refreshLabels()}
    const previousSection = playingSection.value
    playingSection.value = index < 0 ? -1 : section
    if (index === 0 && beat === 0 && previousSection >= 0 && previousSection !== section) {
      editSection(section)
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
    if (index < 0) {
      const bar = Math.max(0, Math.min(resumeMelodyBar, progression.barCount() - 1))
      const selected = progression.songMode ? progression.songSectionAt(bar) : progression.selectedSection
      chord = progression.sections[selected].slots[bar] ?? progression.slots[0]
      key = progression.keyForBar(bar, selected)
    }
    if (activeChord !== chord || activeKey !== key) {
      activeChord = chord
      activeKey = key
      refreshMelody()
    }
    if (index >= 0) { updateChordMonitor(index, chord, beat, section); refreshSectionControls() }
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
/** @type {Map<number,number>} */
const waveformStartBeats = new Map()
let studioEditor = /** @type {ReturnType<typeof import('./melody-arrange.js').mountMelodyEditor> | undefined} */ (undefined)

let studioBassEditor = /** @type {typeof studioEditor} */ (undefined)

/** @type {Partial<Record<'backing'|'drums', NonNullable<typeof studioEditor>>>} */
const studioAccompanimentEditors = {}
let studioAccompanimentLoad = /** @type {ReturnType<typeof import('./studio-style.js').decodeStudioAccompaniment> | undefined} */ (undefined)

progression.onScheduleBar = (/** @type {number} */ bar, /** @type {number} */ beat, /** @type {number} */ time, /** @type {number} */ secondsPerBeat) => {
  playerDisplay.meter(chordInstrument.context)
  const context = chordInstrument.context
  if (!context) return
  const meter = progression.meterForBar(Math.max(0, bar))
  studioEditor?.schedulePlaybackBar(bar, beat, time, secondsPerBeat, meter, context)
  studioBassEditor?.schedulePlaybackBar(bar, beat, time, secondsPerBeat, meter, context)
  for (const editor of Object.values(studioAccompanimentEditors)) editor.schedulePlaybackBar(bar, beat, time, secondsPerBeat, meter, context)
}
progression.onStart = referenceTrack.startWithAccompaniment
progression.onStop = () => {
  studioEditor?.stopPlaybackPosition()
  studioBassEditor?.stopPlaybackPosition()
  for (const editor of Object.values(studioAccompanimentEditors)) editor.stopPlaybackPosition()
  barPlayback = null
  referenceTrack.stopWithAccompaniment()
  playerDisplay.stopMeter()
  clearAccompanimentPads()
}
const refreshBassDetail = mountBassDetail(progression)
const drumGrid = mountDrumGrid(hits => {
  const captured = progression.sections[progression.selectedSection].performance
  if (captured) delete captured.drums
  progression.drumSteps = hits
  renderDrumSteps()
}, progression)
document.querySelectorAll('input[name="drum-rate"]').forEach(input => input.addEventListener('change', () => {
  progression.drumRate = /** @type {0.5|1|2} */ (Number(/** @type {HTMLInputElement} */ (input).value))
}))
progression.onDrumPosition = drumGrid.showPosition
renderDrumSteps()
progression.melody = instrument
partSettings.bind(melodyMode, () => {
  progression.melodyPattern = ''
  buddyController?.setPlayMode(melodyMode.value)
  instrument.silence()
  refreshMelody()
})

const qualityOrigins = progression.slots.map((chord) => [chord, chord, chord, chord, chord])
const qualityMenu = createChoiceMenu('quality')
mountSelectMenus()
/** @param {number} bar @param {number} beat @param {string} chord @param {boolean} [replace] */
async function previewChord(bar, beat, chord, replace = false) {
  try {
    const key = progression.keyForBar(bar)
    const notes = replace ? padChordNotes(chord, key) : progression.notesForBar(chord, bar, beat)
    const recorded = replace && studioAccompanimentEditors.backing?.recordStep(notes)
    await chordInstrument.ready()
    if (chordInstrument.context) {
      if (replace) {
        if (!recorded || !progression.running) chordInstrument.silence()
        if (progression.running && progression.accompanimentModes.chord === 'manual') {
          const barDuration = progression.meterForBar(bar) * 60 / progression.bpmForBar(bar)
          progression.followBackingPad(chord, progression.keyForBar(bar), chordInstrument.context.currentTime + barDuration)
        }
      }
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
/** @param {number} bar @param {keyof import('./progression.js').BarSettings} field @param {number | import('./progression.js').BarMeter | undefined} value */
function setBarSetting(bar, field, value) {
  const settings = progression.barSettings[bar] ??= {}
  if (value === undefined) delete settings[field]
  else Object.assign(settings, {[field]: value})
  if (!Object.keys(settings).length) delete progression.barSettings[bar]
  refreshLabels()
}

const slotElements = mountChordGrid(1024, {
  selectStart: seekMelodyBar,
  barSetting: setBarSetting,
  transpose(bar, delta) {
    setBarSetting(bar, 'key', (progression.keyForBar(bar) + delta + 12) % 12)
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
  if(buddyController?.autoPlay && progression.studioMelody() === undefined){void buddyController.start(false,resumeMelodyBar)}
  else if (playbackHead !== undefined) {
    const bar = Math.min(playbackHead, progression.barCount() - 1)
    void progression.start(bar, waveformStartBeats.get(progression.selectedSection) ?? 0)
    barPlayback = {bar, section: progression.selectedSection}
  } else if (progression.songMode) {
    void progression.start(0,0)
  } else if (buddyController) {
    const firstPlay = !hasOpenedPlayPanel
    if (firstPlay) hasOpenedPlayPanel = true
    void buddyController.start(firstPlay)
  } else void progression.start()
  updateTransport()
}
const tempoNumber = /** @type {HTMLInputElement} */ (document.querySelector('#tempo-value'))
tempo.addEventListener('pointerdown', () => { /* Drag commits whole BPM through bindKnobDrag. */ })
tempo.addEventListener('input', () => {
  progression.bpm = Number(tempo.value)
  if(progression.songMode)progression.songBpm=progression.bpm
  if (progression.referenceBpm !== null) progression.referenceBpm = progression.bpm
  tempoNumber.value = tempo.value
  refreshLabels()
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
const melodyChordsRevision = ref(0)
function refreshLabels() {
  melodyChordsRevision.value++
  // Sections can grow from eight to sixteen bars, and older scores have only
  // four beat entries. Keep the UI's choice origins aligned with the score.
  progression.slots.forEach((chord, bar) => {
    qualityOrigins[bar] ??= []
    for (let beat = 0; beat < maxChordBeats; beat++) {
      qualityOrigins[bar][beat] ??= progression.beatSlots[bar]?.[beat] ?? chord
    }
  })
  sectionBars.value = progression.barCount()
  scorePage.value=Math.min(scorePage.value,Math.floor((progression.barCount()-1)/16))
  referenceTrack.refreshLoopLength()
  slotElements.forEach((element, bar) => {
    element.hidden = bar >= progression.barCount() || Math.floor(bar/16)!==scorePage.value
    if (element.hidden) return
    const meter = progression.chordBeatsForBar(bar)
    const settings = progression.barSettings[bar]
    const bpm = /** @type {HTMLInputElement} */ (element.querySelector('.score-bar-tempo'))
    bpm.value = String(progression.bpmForBar(bar))
    bpm.title = 'BPMを入力。空欄で前のBPMを引き継ぐ'
    const meterSelect = /** @type {HTMLSelectElement} */ (element.querySelector('.score-bar-meter'))
    meterSelect.options[0].textContent = '前の拍子を引き継ぐ'
    const signature = progression.meterSignatureForBar(bar)
    meterSelect.options[0].hidden = settings?.meter === undefined
    meterSelect.value = String(signature)
    const key = progression.keyForBar(bar)
    const previousKey = bar > 0 ? progression.keyForBar(bar - 1) : progression.sections[0].key ?? progression.key
    const difference = (key - previousKey + 18) % 12 - 6
    const keyValue = /** @type {HTMLOutputElement} */ (element.querySelector('.score-bar-key-value'))
    keyValue.value = `${keys[key].name}(${difference > 0 ? '+' : ''}${difference})`
    element.style.setProperty('--beats-per-bar', String(meter))
    element.querySelectorAll('.beat-chord').forEach((cell, beat) => {
      cell.toggleAttribute('hidden', beat >= meter)
      if (beat < meter) updateChordCell(cell, bar, beat)
    })
  })
  refreshScoreStart()
  refreshHarmonyViews()
}

function refreshScoreStart() {
  const previous = document.querySelector('#chord-slots .bar-label[aria-pressed="true"]')
  const bar = playbackHeads.get(progression.selectedSection)
  const current = bar === undefined ? null : slotElements[Math.min(bar, progression.barCount() - 1)]?.querySelector('.bar-label')
  if (previous === current) return
  previous?.setAttribute('aria-pressed', 'false')
  current?.setAttribute('aria-pressed', 'true')
}

/** @param {number} bar @param {number} beat @param {HTMLSelectElement | null} [keepOptions] */
function refreshChordCell(bar, beat, keepOptions = null) {
  melodyChordsRevision.value++
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
  const editButton=beatElement.querySelector('.score-chord-edit')
  editButton?.setAttribute('aria-label',`${bar+1}小節 ${beat+1}拍目：${id ? displayParts(id,barKey).main : '変更なし'}をPadで編集`)
  quality.hidden = !id
  beatElement.classList.toggle('is-empty', !id)
  if (!id) return
  const config = chordConfig(id)
  const display = displayParts(id, barKey)
  const padSlash = config.quality === 'slash' && config.extension.startsWith('pad_')
  if (padSlash && rootDisplay) rootDisplay.textContent = display.main
  if (padSlash) editButton?.setAttribute('aria-label', `${bar+1}小節 ${beat+1}拍目：${display.main}${display.suffix}をPadで編集`)
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
  if (padSlash && !quality.selectedOptions.length) {
    const option = document.createElement('option')
    option.value = `${config.quality}:${config.extension}`
    option.textContent = display.suffix
    quality.append(option)
    quality.value = option.value
  }
  if (padSlash && quality.selectedOptions[0]) quality.selectedOptions[0].textContent = display.suffix
  const isMajor = quality.value === 'maj:none'
  quality.classList.toggle('is-major', isMajor)
  quality.classList.toggle('is-long', (quality.selectedOptions[0]?.textContent?.length ?? 0) > 5)
  quality.setAttribute('aria-label', `${bar + 1}小節 ${beat + 1}拍目の響き：${isMajor ? 'maj' : quality.selectedOptions[0]?.textContent || '選択'}`)
}

function refreshHarmonyViews(refreshBass = true) {
  if (!progression.running) {
    const bar = Math.max(0, Math.min(resumeMelodyBar, progression.barCount() - 1))
    const section = progression.songMode ? progression.songSectionAt(bar) : progression.selectedSection
    activeChord = progression.sections[section].slots[bar] ?? progression.slots[0]
    activeKey = progression.keyForBar(bar, section)
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
  while (slots.length < progression.slots.length) {
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
partSettings.bind(rhythmSelect, () => {
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
for (const [index, timbre] of melodyTimbres.entries()) {
  const option = document.createElement('option')
  option.value = timbre.id
  option.textContent = `${String(index + 1).padStart(2, '0')}: ${timbre.label}`
  melodyTimbre.append(option)
}
melodyTimbre.value = instrument.timbre
partSettings.bind(melodyTimbre, () => { instrument.setTimbre(melodyTimbre.value); buddyController?.timbreChanged(); document.dispatchEvent(new Event('melody-timbre-change')) })
timbreSelect.value = chordInstrument.timbre
partSettings.bind(timbreSelect, () =>
  chordInstrument.setTimbre(timbreSelect.value),
)
const backingSelect = /** @type {HTMLSelectElement} */ (
  document.querySelector('#chord-backing')
)
for (const pattern of chordBackingPatterns) {
  const option = document.createElement('option')
  option.value = pattern.id
  option.textContent = pattern.label
  option.hidden = ['bass-chord','cutting','strum'].includes(pattern.id)
  backingSelect.append(option)
}
backingSelect.value = progression.backing
partSettings.bind(backingSelect, () => {
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
  delete progression.sections[progression.selectedSection].backingSteps
  backingEditorRevision.value++
  syncCapturedChoices()
  progression.sections[progression.selectedSection].style = genre.id
  sectionContextRevision.value++
  queueMicrotask(()=>refreshSectionControls())
  progression.genre = genre.id
  partSettings.apply(bassPattern, genre.bassPattern)
  partSettings.apply(rhythmSelect, genre.rhythm)
  setOrnamentStyle(genre.id)
  if (!referenceView.filename) {
    if (progression.songMode) progression.sections[progression.selectedSection].bpm = genre.bpm
    else progression.bpm = genre.bpm
  }
  progression.swing = 0
  partSettings.apply(bassTimbre, genre.bass)
  partSettings.apply(drumTimbre, genre.drum)
  partSettings.apply(backingSelect, genre.backing === 'bass-chord' ? 'quarters' : genre.backing)
  partSettings.apply(melodyTimbre, melodyTimbreFor(genre.melody))
  partSettings.apply(melodyMode, melodyMode.value)
  partSettings.apply(timbreSelect, genre.chord)
  if (!referenceView.filename && !progression.songMode) tempo.value = String(genre.bpm)
  swing.value = '0'
  tempoNumber.value = tempo.value
  renderSwing()
  buddyController?.styleChanged()
  rememberSectionParts()
  if (!referenceView.filename && melodyPlayhead) seekMelodyBar(0)
})
partSettings.bind(bassTimbre, () => {
  bass.timbre = bassTimbre.value
  updatePartIcons()
})
let jazzSwingOriginal = /** @type {number | undefined} */ (undefined)
/** @param {boolean} enabled */
function setJazzSwing(enabled) {
  if (enabled && jazzSwingOriginal === undefined) jazzSwingOriginal = Number(swing.value)
  else if (!enabled && jazzSwingOriginal !== undefined) { swing.value = String(jazzSwingOriginal); jazzSwingOriginal = undefined }
  if (enabled) swing.value = '100'
  swing.dispatchEvent(new Event('input', {bubbles:true}))
}
swing.addEventListener('input', () => {
  if (jazzSwingOriginal !== undefined) swing.value = '100'
  progression.swing = Number(swing.value)
  renderSwing()
})
document.querySelector('#swing-toggle')?.addEventListener('click', () => {
  swing.value = Number(swing.value) > 0 ? '0' : '100'
  swing.dispatchEvent(new Event('input', {bubbles:true}))
})
function renderSwing() {
  refreshBassDetail()
  const output = document.querySelector('#swing-value')
  if (output) output.textContent = `${swing.value}%`
  document.querySelector('#swing-toggle')?.setAttribute('aria-pressed', String(Number(swing.value) > 0))
}

const ornamentTracks = ['bell', 'pluck', 'phrase', 'fx'].map((id, index) => ({
  id, pattern: ['sparkle-even', 'pluck-gaps', 'strings-lift', 'transition'][index],
  voice: new OrnamentPlayer(id, chordInstrument),
}))
progression.ornaments = ornamentTracks.filter(track => track.id !== 'fx')
const setOrnamentStyle = mountOrnaments(ornamentTracks, partSettings)

const mixParts = [
  { part: drums, volume: 0.35 }, { part: bass, volume: 0.5 },
  { part: chordInstrument, volume: 0.4 }, { part: instrument, volume: 0.4 },
  ...ornamentTracks.map(track => ({part: track.voice, volume: .24})),
  {part: referenceTrack, volume: .25},
]
const mixer = createPartMixer(mixParts)
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
  if(input === tempo) bindTempoKnob(input)
  else bindKnobDrag(input, .5)
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
partSettings.bind(bassPattern, () => {
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
/** @typedef {{id:string, name:string, samples:{id:number,label:string,file:string}[], skipped:number, bundled?:boolean}} DrumKit */
/** @type {DrumKit[]} */
let drumKits = []
let drumKitGeneration = 0
let drumKitCatalogGeneration = 0
const drumKitHeaders = {'X-Otto-Local':'1'}
async function refreshDrumKits() {
  const ticket = ++drumKitCatalogGeneration
  try {
    /** @type {DrumKit[]} */
    let localKits = []
    try {
      const response = await fetch('./api/drum-kits', {headers:drumKitHeaders})
      if (response.ok) localKits = await response.json()
    } catch {
      // Bundled kits also work with static hosting.
    }
    const kits = [
      ...bundledDrumKits.map(kit => ({...kit, bundled:true})),
      ...localKits.filter(kit => !bundledDrumKits.some(bundled => bundled.id === kit.id)),
    ]
    if (ticket !== drumKitCatalogGeneration) return
    const previous = drumTimbre.value
    drumKits = kits
    for (const option of Array.from(drumTimbre.options)) if (option.dataset.drumKit !== undefined) option.remove()
    const alreadyNumbered = /^\d+: /.test(drumTimbre.options[0]?.textContent ?? '')
    for (const [index, kit] of kits.entries()) {
      const option = document.createElement('option')
      option.value = 'sample:' + kit.id
      option.dataset.drumKit = ''
      const label = kit.name.replace(/^(\d+)[_ -]+/, '')
      option.textContent = alreadyNumbered ? `${String(index + 4).padStart(2, '0')}: ${label}` : label
      drumTimbre.append(option)
    }
    if (previous.startsWith('sample:') && !kits.some(kit => 'sample:' + kit.id === previous)) {
      const unavailable = document.createElement('option')
      unavailable.value = previous
      unavailable.dataset.drumKit = ''
      unavailable.disabled = true
      unavailable.textContent = previous.slice(7) + '（見つかりません）'
      drumTimbre.append(unavailable)
      if (progressionStatus) progressionStatus.textContent = 'ドラムキットが見つかりません: ' + previous.slice(7)
    }
    if (Array.from(drumTimbre.options).some(option => option.value === previous)) drumTimbre.value = previous
    drumTimbre.dispatchEvent(new Event('part-sync', {bubbles:true}))
  } catch {
    // The app can also run as a static site without local sample access.
  }
}

function selectDrumTimbre() {
  const selected = drumTimbre.value
  const ticket = ++drumKitGeneration
  const kit = drumKits.find(item => 'sample:' + item.id === selected)
  if (!kit) {
    drums.samplesEnabled = false
    drums.sampleReady = Promise.resolve()
    drumPadNames.value = {}
    drumPadTypes.value = {}
    drumPadState.value = {status:'ready', samples:null}
    drums.timbre = selected
    updatePartIcons()
    return
  }
  drums.samplesEnabled = true
  drumPadState.value = {status:'loading', samples:kit.samples.map(sample => sample.id)}
  drums.samples.clear()
  drumPadNames.value = Object.fromEntries(kit.samples.map(sample => [sample.id, sample.label]))
  drumPadTypes.value = Object.fromEntries(kit.samples.map(sample => [sample.id, drumPadType(sample.label + ' ' + sample.file)]))
  const context = audioContext()
  drums.sampleReady = Promise.all(kit.samples.map(async sample => {
    const url = kit.bundled
      ? new URL(`./samples/${encodeURIComponent(kit.id)}/${encodeURIComponent(sample.file)}`, import.meta.url)
      : new URL('./api/drum-kit-sample', location.href)
    if (!kit.bundled) {
      url.searchParams.set('kit', kit.id)
      url.searchParams.set('file', sample.file)
    }
    const response = await fetch(url, kit.bundled ? undefined : {headers:drumKitHeaders})
    if (!response.ok) throw new Error('WAVを読み込めませんでした')
    const bytes = await response.arrayBuffer()
    const header = new TextDecoder()
    if (header.decode(bytes.slice(0,4)) !== 'RIFF' || header.decode(bytes.slice(8,12)) !== 'WAVE')
      throw new Error('WAV形式を確認してください')
    const buffer = await context.decodeAudioData(bytes)
    if (buffer.duration > 5 || buffer.numberOfChannels > 2) throw new Error('WAVは5秒以下のモノラルまたはステレオにしてください')
    return [sample.id, buffer]
  })).then(entries => {
    if (ticket !== drumKitGeneration) return
    drums.samples = new Map(/** @type {[number,AudioBuffer][]} */ (entries))
    drumPadState.value = {status:'ready', samples:kit.samples.map(sample => sample.id)}
    if (progressionStatus) progressionStatus.textContent = kit.skipped ? '8個を超えるWAVは読み込んでいません' : ''
  }).catch(error => {
    if (ticket !== drumKitGeneration) return
    drumPadState.value = {status:'error', samples:kit.samples.map(sample => sample.id)}
    if (progressionStatus) progressionStatus.textContent = kit.name + 'を読み込めませんでした: ' + String(error)
  })
  updatePartIcons()
}
await refreshDrumKits()
partSettings.bind(drumTimbre, selectDrumTimbre)
window.addEventListener('focus', () => { void refreshDrumKits() })


const wholeScorePanel=document.getElementById('detail-chord')
if(wholeScorePanel){wholeScorePanel.classList.add('whole-song-score');document.querySelector('main')?.append(wholeScorePanel)}
const workspace = /** @type {HTMLElement} */ (document.querySelector('main'))
for (const input of Array.from(document.querySelectorAll('input[name="workspace-view"]'))) input.addEventListener('change', () => {
  const view=/** @type {HTMLInputElement} */ (input).value
  if(view!=='score')document.querySelector('.score-pad-dock:not([hidden]) .close')?.dispatchEvent(new MouseEvent('click',{bubbles:true}))
  workspace.dataset.workspaceView = view
  document.querySelector('.mixer-score-link')?.setAttribute('aria-pressed', String(view === 'score'))
  if (view === 'score') {
    document.querySelectorAll('#track-grid .track-select').forEach(button => button.setAttribute('aria-pressed', 'false'))
  }
  document.dispatchEvent(new Event('resize'))
})
mountScoreContext({progression, sectionContextRevision, playingSection, editingSection, meterInput, tempo})
const backingDetail = createBackingDetail(progression, editingSection, meterInput, refreshLabels)
const backingEditorRevision = backingDetail.revision
document.addEventListener('reference-loaded', () => {
  progression.stop()
  progression.loopSong = false
  if (progression.barCount() === 16 && progression.sections.length === 1) changeBarCount(84)
  playbackHeads.clear()
  waveformStartBeats.clear()
  seekMelodyBar(0)
  const view=/** @type {HTMLInputElement|null} */(document.querySelector('input[name="workspace-view"][value="mixer"]'))
  if(view){view.checked=true;view.dispatchEvent(new Event('change',{bubbles:true}))}
  // Use the existing mixer and panel actions so visible and audio state agree.
  rhythmSelect.value = 'four'
  rhythmSelect.dispatchEvent(new Event('change', {bubbles:true}))
  rhythmSelect.dispatchEvent(new Event('part-sync'))
  for (const [id, pressed] of [['reference-mute', 'true'], ['reference-solo', 'false'], ['drum-mute', 'true'], ['drum-solo', 'false']]) {
    const button = document.getElementById(id)
    if (button?.getAttribute('aria-pressed') === pressed) button.click()
  }
  document.querySelector('.track-select[data-track="reference"]')?.dispatchEvent(new MouseEvent('click', {bubbles:true}))
})
document.addEventListener('reference-removed', () => {
  progression.loopSong = true
  const solo = document.getElementById('reference-solo')
  if (solo?.getAttribute('aria-pressed') === 'true') solo.click()
})
const {updateQuickMixer, syncBackingPad, clearAccompanimentPads, trackGrid, showPadHit} = mountQuickMixer({
  progression, mixer, workspace, genreSelect, keySelect, bass, playAccompanimentPad, previewChord, togglePlayback: () => startButton.click(), animatePartChange: button => animatePartChange(button),
})
progression.onPadHit = showPadHit
trackGrid.addEventListener('click', event => {
  if (event.target instanceof Element && event.target.closest('[data-track="drums"]')) void refreshDrumKits()
})
/** @param {'drums'|'bass'|'chord'} part @param {number} index @param {boolean} [record] */
async function playAccompanimentPad(part, index, record = true) {
  if (part === 'drums' && !drumPadPlayable(index)) return
  if (part === 'drums' && record) studioAccompanimentEditors.drums?.recordStep([index])
  try {
    await chordInstrument.ready()
    const time = chordInstrument.context?.currentTime
    if (time === undefined) return
    if (part === 'drums') {
      await drums.sampleReady
      drums.hitPadAt(index, time + .01, .85)
    } else if (part === 'bass') {
      bass.playAt(bassPadNotes[index], time + .01, .35, .85)
    } else {
      const bar = index % progression.barCount()
      await previewChord(bar, 0, progression.slots[bar])
    }
  } catch (error) {
    if (progressionStatus) progressionStatus.textContent = String(error)
  }
}

const updatePartIcons = mountPartIcons(drumTimbre, bassTimbre)

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

const {animatePartChange, refreshBuddyLook} = mountBuddyFeedback({
  genreSelect, presetSelect, status, progressionStatus, startButton, trackGrid,
  running: () => progression.running, setStyle: playerDisplay.setStyle,
})

mountMobileScoreTools()

// Call-and-response shares the main pads, note palette and transport.
import { mountBuddy } from './buddy.js'
import { mountKeyboard, mountMidiInput, createMagicVoice, pianoNotes, pianoKey } from './keyboard.js'
const magicVoice=createMagicVoice({
  enabled:()=>document.querySelector('#piano-keys')?.getAttribute('data-magic')==='true',
  bpm:()=>progression.bpm,
  resolve:midi=>{
    const degree=(midi-activeKey+120)%12
    if(![1,3,5,6,8,10,11].includes(degree)||melodyRole(midi,activeChord,activeKey).category==='chord')return midi
    const candidates=[midi-1,midi+1,midi-2,midi+2].filter(note=>note>=0&&note<=127&&melodyRole(note,activeChord,activeKey).category==='chord')
    return candidates[0] ?? midi
  },
  attack:(midi,glide,screen)=>{if(buddyController?.active)buddyController.attackMidi(midi,glide,screen);else{recordManualMatch(midi);instrument.attack(midi,glide);lastMelodyMidi=midi;lastMelodyDegree=melodyRole(midi,activeChord,activeKey).degree;refreshMelody()}},
  release:midi=>{if(buddyController?.active)buddyController.releaseMidi(midi);else instrument.release(midi)},
})
window.addEventListener('blur',()=>magicVoice.stop())
document.addEventListener('melody-keyboard-change',()=>magicVoice.stop())
document.addEventListener('visibilitychange',()=>{if(document.hidden)magicVoice.stop()})
mountKeyboard({
  bass: () => instrument.timbre.startsWith('lead-bass-'),
  key: () => activeKey,
  ready: () => instrument.ready(),
  attack:(midi,glide)=>magicVoice.attack(midi,glide,true),
  release:midi=>magicVoice.release(midi),
  stop: () => { buddyController?.stop();instrument.silence() },
  onError: error => { if(status)status.textContent=error instanceof Error?error.message:'音を再生できませんでした。' },
})
refreshMelody()
const {element: melodyVoiceLabel} = mountMelodyVoiceChoice(melodyTimbre)
document.querySelector('.melody-heading')?.after(melodyVoiceLabel)
/** MIDI notes retain their original destination until note-off, even if the selected part changes. */
let midiPart = 'melody'
/** @type {Map<number,string>} */
const midiDestinations = new Map()
document.querySelector('#track-grid')?.addEventListener('click', event => {
  const button = event.target instanceof Element ? event.target.closest('.track-select[data-track]') : null
  const part = button instanceof HTMLElement ? button.dataset.track : undefined
  if (part && part !== 'melody') for (const index of heldPads.keys()) releasePad(index)
  if (part && ['melody','bass','drums','chord'].includes(part)) midiPart = part
})
const midiInput = mountMidiInput({
  transpose:()=>document.body.dataset.appMode === 'free' && workspace.dataset.workspaceView !== 'mixer' && midiPart==='melody' && document.querySelector('#piano-keys')?.getAttribute('data-magic')==='true'?activeKey:0,
  bend:value=>{ if(document.body.dataset.appMode !== 'free')return; if(midiPart==='melody')instrument.setPitchBend(value); else if(midiPart==='chord')chordInstrument.setPitchBend(value); else if(midiPart==='bass')bass.setPitchBend(value); else if(midiPart==='drums')drums.setPitchBend(value) },
  modulation:value=>{if(document.body.dataset.appMode !== 'free')return;if(midiPart==='melody'){instrument.setModulation(value);buddyController?.rememberModulation(value)}else if(midiPart==='bass')bass.setModulation(value)},
  ready: async () => { await Promise.all([instrument.ready(), chordInstrument.ready()]) },
  attack:midi=>{
    if(document.body.dataset.appMode === 'tutorial') { midiDestinations.set(midi,'tutorial'); tutorialView?.midiAttack(midi); return }
    if(document.body.dataset.appMode === 'song-session') { midiDestinations.set(midi,'song-session'); tutorialView?.songMidiAttack(midi); return }
    if(document.body.dataset.appMode !== 'free')return
    const part=midiPart
    if (part === 'melody' && workspace.dataset.workspaceView === 'mixer' && workspace.dataset.mixerPart === 'melody' && studioEditor) {
      midiDestinations.set(midi, 'studio-melody')
      studioEditor.midiAttack(midi)
      return
    }
    if (workspace.dataset.workspaceView === 'mixer' && workspace.dataset.mixerPart === 'bass' && studioBassEditor) {
      midiDestinations.set(midi, 'studio-bass')
      studioBassEditor.midiAttack(midi)
      return
    }
    midiDestinations.set(midi,part)
    if(part==='melody') magicVoice.attack(midi)
    else if(part==='chord') chordInstrument.attack(midi)
    else if(part==='bass') {const time=chordInstrument.context?.currentTime;if(time!==undefined)bass.playAt(midi,time+.01,.5,.8)}
    else {
      const gm = /** @type {Record<number,number>} */ ({35:0,36:0,38:1,40:1,42:2,44:2,46:3,41:4,43:4,45:4,47:6,48:6,50:6,49:7,51:5})
      const index=gm[midi] ?? ((midi%8)+8)%8
      if (workspace.dataset.workspaceView === 'mixer' && workspace.dataset.mixerPart === 'drums') {
        void playAccompanimentPad('drums', index)
        return
      }
      const time=chordInstrument.context?.currentTime
      if(time!==undefined)drums.hitPadAt(index,time+.01,.85)
    }
  },
  release:midi=>{const part=midiDestinations.get(midi);midiDestinations.delete(midi);if(part==='tutorial')tutorialView?.midiRelease(midi);else if(part==='song-session')tutorialView?.songMidiRelease(midi);else if(part==='studio-melody')studioEditor?.midiRelease(midi);else if(part==='studio-bass')studioBassEditor?.midiRelease(midi);else if(part==='melody')magicVoice.release(midi);else if(part==='chord')chordInstrument.release(midi)},
})
buddyController = mountBuddy({
  progression, instrument, drums,
  getNotes: () => playableNotes,
  refreshTransport: updateTransport,
  onModeChange: mode => {
    const preset = mode === 'preset'
    const presetChanged = progression.presetMelody !== preset
    if (presetChanged) instrument.silence()
    progression.presetMelody = preset
    melodyMode.value = ['pc', 'you'].includes(mode) ? 'session' : mode
    melodyMode.dispatchEvent(new Event('part-sync'))
    if (presetChanged) rememberSectionParts()
  },
  onPlayStyleChange: style => setJazzSwing(style === 'jazz'),
  notesAt: (bar, beat, absoluteBar) => {
    const {section, bar:localBar} = progression.positionAt(absoluteBar)
    bar = localBar
    const {slots, beatSlots} = progression.sections[section]
    let chord = slots[bar]
    for (let i = 1; i <= Math.min(progression.chordBeatsForBar(bar) - 1, Math.floor(beat / progression.chordBeatLength(bar))); i++) chord = beatSlots[bar]?.[i] ?? chord
    // Otto follows the sounding harmony, independently of the human keyboard view.
    const key = progression.keyForBar(bar, section)
    const scalePitches = new Set(melodyPalette(key, chord, key, 'key').map(note => note.midi % 12))
    const palette = melodyPalette(key, chord, key, 'chord')
      .filter(note => !note.clash && (note.category === 'chord' || scalePitches.has(note.midi % 12)))
    return palette.flatMap(note => Array.from({length:8}, (_,octave) => 24 + octave * 12 + ((note.midi % 12 + 12) % 12))
      .filter(midi => midi <= 108)
      .map(midi => ({...note,midi,...melodyRole(midi,chord,key)})))
      .filter((note,index,all) => all.findIndex(other => other.midi === note.midi) === index)
      .sort((a,b) => a.midi-b.midi)
  },
  reportNote: midi => {
    showHumanPlaying()
    lastMelodyMidi = midi
    lastMelodyDegree = melodyRole(midi, activeChord, activeKey).degree
    refreshMelody()
  },
  reveal: () => {
    /** @type {HTMLButtonElement} */ (document.querySelector('[data-track="melody"]')).click()
    document.querySelector('#detail-melody')?.scrollIntoView({behavior: 'smooth', block: 'start'})
  },
})

let restoringSectionParts = false

/** @param {HTMLInputElement | HTMLSelectElement} control */
function savedControlValue(control) {
  if (control.id === 'rhythm-pattern') return progression.rhythm
  if (control.id === 'bass-pattern') return progression.bassPattern
  return control.value
}

function readSectionParts() {
  return Object.fromEntries(sectionControlIds.map(id => {
    const control = /** @type {HTMLSelectElement} */ (document.getElementById(id))
    return [id, savedControlValue(control)]
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
    partSettings.restore(sectionControlIds, settings)
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
  const timing = /** @type {HTMLInputElement | null} */ (document.querySelector('.reference-timing-control input[type=range]:not([aria-label])'))
  if (timing) {
    timing.value = String(referenceTrack.getTiming(section))
    const output = document.querySelector('.reference-timing-control output')
    if (output) output.textContent = Number(timing.value).toFixed(2) + ' 秒'
  }
  progression.selectedSection = editingSection.value = section
  const style = progression.sections[section].style
  if (style) {
    void chooseStyle(style, false)
    const item=genres.find(item=>item.id===style)
    if(item){progression.genre=item.id;progression.swing=0;swing.value='0';renderSwing();playerDisplay.setStyle(item.label,item.group);refreshBuddyLook()}
  }
  restoreSectionParts()
  sectionContextRevision.value++
  refreshSectionControls()
  backingEditorRevision.value++
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

mountScoreBarCount({sectionBars, changeBarCount})
/** @param {number} delta */
function changeBarCount(delta) {
  const section = progression.sections[0]
  const count = Math.max((progression.sections[progression.sections.length-1].startBar ?? 0)+1, Math.min(100, progression.barCount() + delta))
  // Older saved arrangements have eight stored bars; extend without losing edits.
  while (count > section.slots.length) {
    progression.slots = [...section.slots, ...section.slots]
    progression.beatSlots = [...section.beatSlots, ...section.beatSlots.map(row => [...row])]
    progression.modulation = [...section.modulation, ...section.modulation]
  }
  for(const item of progression.sections)item.barCount=count
  progression.sections[progression.sections.length-1].endBar=count
  refreshLabels()
}

mountScorePaging({scorePage, sectionBars, refreshLabels, changeBarCount})

// Start with the same complete arrangement as the displayed style.
genreSelect.dispatchEvent(new Event('change', {bubbles:true}))
while (progression.slots.length < 200) {
  progression.slots = [...progression.slots, ...progression.slots]
  progression.beatSlots = [...progression.beatSlots, ...progression.beatSlots.map(row => [...row])]
  progression.modulation = [...progression.modulation, ...progression.modulation]
}
progression.sections = [{
  ...progression.sections[0],
  partSettings: readSectionParts(),
  style: genreSelect.value,
  barCount: 16,
  startBar: 0,
  endBar: 16,
}]
progression.songMode=true
progression.loopSong=true
backingDetail.mount()
refreshLabels()

// Adapt version 1 control IDs to the current UI.
const savedControls = new Map(arrangementControlIds.map(id =>
  [id, /** @type {HTMLInputElement | HTMLSelectElement} */ (document.getElementById(id))]))
const savedMix = new Map(arrangementMixIds.map(id =>
  [id, /** @type {HTMLButtonElement} */ (document.getElementById(id))]))

function captureArrangement() {
  tempoNumber.blur()
  const controls = [...savedControls.values()].map(el => ({
    id: el.id, value: savedControlValue(el), checked: el instanceof HTMLInputElement && el.checked,
  }))
  const mix = [...savedMix.values()].map(el => ({id: el.id, pressed: el.getAttribute('aria-pressed') === 'true'}))
  const {slots, beatSlots, modulation} = progression.sections[0]
  const {bassFeel, bassTones, drumSteps, drumAccents, drumPitch, sections, drumRate, barSettings} = progression
  const beatsPerBar = Number(meterInput.value)
  const studioAccompaniment = {
    pickupChord:pickupChord.value,
    backing: studioAccompanimentEditors.backing?.getNotes() ?? [],
    drums: studioAccompanimentEditors.drums?.getNotes() ?? [],
    drumPatterns: studioAccompanimentEditors.drums?.getDrumPatterns() ?? (studioAccompanimentLoad ? studioAccompanimentLoad.drumPatterns ?? [null,null,null,null] : defaultDrumPatterns()),
    drumAssignments: studioAccompanimentEditors.drums?.getDrumAssignments() ?? studioAccompanimentLoad?.drumAssignments ?? [],
  }
  return encodeArrangement(controls, mix, {studioAccompaniment, slots, beatSlots, modulation, bassFeel, bassTones, drumSteps, drumAccents, drumPitch, beatsPerBar, drumRate, barSettings}, sections)
}

function captureStudioStyle() {
  return JSON.stringify({arrangement:captureArrangement(), melody:studioEditor?.getNotes() ?? [], bass:studioBassEditor?.getNotes() ?? []})
}

/** @param {string} json */
async function restoreStudioStyle(json) {
  const {arrangement, melody, bass: bassNotes} = decodeStudioStyle(json)
  await applyArrangementJson(arrangement)
  studioEditor?.setNotes(melody)
  studioBassEditor?.setNotes(bassNotes)
}

function saveArrangement() {
  const url = URL.createObjectURL(new Blob([captureArrangement()], {type: 'application/json'}))
  const link = document.createElement('a')
  link.href = url
  link.download = `oto-${genreSelect.value}.json`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return '設定ファイルを書き出しました。'
}

/** @param {File} file */
async function loadArrangement(file) {
  try {
    if (file.size > 16 * 1024 * 1024) throw new Error('size')
    await applyArrangementJson(await file.text())
    return '保存した設定を読み込みました。'
  } catch {
    return '読み込めませんでした。otoで保存した設定ファイルを選んでください。'
  }
}

/** @param {string} json */
async function applyArrangementJson(json, selectedStyle = false) {
  const arrangement = decodeArrangement(json, arrangementControlRules(savedControls.values()))
  await restoreArrangement(arrangement, {
    stop() { buddyController?.stop(); progression.stop() },
    chooseStyle: selectedStyle ? async () => {} : async id => {
      restoringArrangementStyle = true
      try { await chooseStyle(id) } finally { restoringArrangementStyle = false }
    },
    applyControl(saved) {
      const el = savedControls.get(saved.id)
      if (!el) return
      if (el instanceof HTMLSelectElement && partSettings.apply(el, saved.value)) {
        rememberSectionParts()
        return
      }
      applySavedControl(el, saved)
    },
    applyMix({id, pressed}) {
      const el = savedMix.get(id)
      if (el && (el.getAttribute('aria-pressed') === 'true') !== pressed) el.click()
    },
    applyScore(score, sections) {
      progression.barSettings = score.barSettings ?? {}
      progression.drumRate = score.drumRate ?? 1
      const selectedRate = /** @type {HTMLInputElement | null} */ (document.querySelector(`input[name="drum-rate"][value="${progression.drumRate}"]`))
      if (selectedRate) selectedRate.checked = true
      progression.beatsPerBar = score.beatsPerBar ?? 4
      refreshMeter()
      progression.sections = restoreSongSections(sections, readSectionParts())
      progression.songMode = true
      scorePage.value=0
      progression.bassFeel = score.bassFeel
      progression.bassTones = score.bassTones
      if (!selectedStyle) {
        studioAccompanimentLoad = score.studioAccompaniment
        pickupChord.value = studioAccompanimentLoad?.pickupChord ?? null
        studioAccompanimentEditors.backing?.setNotes(studioAccompanimentLoad?.backing ?? [])
        studioAccompanimentEditors.drums?.setNotes(studioAccompanimentLoad?.drums ?? [])
        studioAccompanimentEditors.drums?.setDrumPatterns(studioAccompanimentLoad?.drumPatterns ?? [null,null,null,null])
        studioAccompanimentEditors.drums?.setDrumAssignments(studioAccompanimentLoad?.drumAssignments ?? [])
      }
      progression.drumSteps = score.drumSteps
      progression.drumAccents = score.drumAccents ?? []
      progression.drumPitch = score.drumPitch ?? {}
      drumGrid.refreshSettings()
      editSection(0)
      renderDrumSteps()
      buddyController?.styleChanged()
    },
  })
}

let restoringArrangementStyle = false
genreSelect.addEventListener('change', () => {
  if (restoringArrangementStyle) return
  const json = styleDefaultJson[genreSelect.value]
  if (!json) return
  void applyArrangementJson(json, true).catch(() => {
    if (progressionStatus) progressionStatus.textContent = 'スタイルの既定の編成を読み込めませんでした。'
  })
})

const songOpen = /** @type {HTMLButtonElement} */ (document.querySelector('#song-open'))
/** @type {Promise<ReturnType<import('./song-dialog.js').mountSongDialog>> | undefined} */
let songDialogPromise
songOpen.addEventListener('click', async () => {
  songOpen.disabled = true
  try {
    songDialogPromise ??= import('./song-dialog.js').then(({ mountSongDialog }) =>
      mountSongDialog({
        save: saveArrangement,
        load: loadArrangement,
        onClose: () => document.getElementById('settings-open')?.focus(),
      }))
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

/** @param {{bpm:number,key:number}} result */
async function applyReferenceArrangement(result) {
  buddyController?.stop()
  progression.stop()
  tempo.value = String(result.bpm)
  tempo.dispatchEvent(new Event('input', {bubbles:true}))
  keySelect.value = String(result.key)
  keySelect.dispatchEvent(new Event('change', {bubbles:true}))
}

const playheadActions = {
  current: () => resumeMelodyBar, count: () => progression.barCount(), seek: seekMelodyBar,
}
const { updateTimingPreview, playhead: referencePlayhead } = mountReferenceTiming(referenceTimingHost, {
  reference: referenceView, player: referenceTrack, progression, tempo, keySelect,
  section: () => editingSection.value, preset: () => selectedPreset.value, choosePreset,
  playbackHeads, waveformStartBeats, playFromBar, bindKnobDrag, playhead: playheadActions,
})
referenceBarInput = referencePlayhead?.input

// Meter changes preserve quarter-note tempo and the current accompaniment transport.
meterInput.addEventListener('input', () => {
  progression.beatsPerBar = /** @type {3|4|5} */ (Number(meterInput.value))
  if(progression.songMode)progression.songMeter=progression.beatsPerBar
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
 reveal:bar=>{const page=Math.floor(bar/16);if(scorePage.value!==page){scorePage.value=page;refreshLabels()}},
 bars:()=>progression.barCount(), beats:bar=>progression.chordBeatsForBar(bar ?? 0),
 play:bar=>{if(progression.running)progression.stop();else playFromBar(bar)},
 preview:(bar,beat,id)=>{void previewChord(bar,beat,id)},
 read:(bar,beat)=>beat===0?progression.slots[bar]:progression.beatSlots[bar][beat],
 write:(bar,beat,id)=>{
  if(id!==null)chordConfig(id)
  if(beat===0){if(!id)return;progression.slots[bar]=id}
  else progression.beatSlots[bar][beat]=id
  if(id)qualityOrigins[bar][beat]=id
  setPreset('custom');chordRate.disabled=true;refreshChordCell(bar,beat)
 },
})


mountMelodyLayout(melodyVoiceLabel)
const melodyNavigation = mountPlayhead(playheadActions)
melodyPlayhead = melodyNavigation.element
const melodyBarInput = melodyNavigation.input
/** @param {number} target @param {boolean} [pickup] @param {number} [gridBeat] */
function seekMelodyBar(target, pickup = false, gridBeat = 0){
 const running=progression.running
 const bar=Math.max(0,Math.min(progression.barCount()-1,Math.round(target)))
 if(buddyController?.active)buddyController.stop();else if(running)progression.stop()
 resumeMelodyBar=bar;playbackHeads.set(progression.selectedSection,bar);waveformStartBeats.set(progression.selectedSection,pickup ? -1 : gridBeat * progression.meterForBar(bar) / 4)
 refreshScoreStart()
 refreshSectionControls()
 refreshHarmonyViews()
 melodyBarInput.value=String(bar+1)
 if (referenceBarInput) referenceBarInput.value = String(bar+1)
 if(running){if(buddyController?.autoPlay)void buddyController.start(false,bar);else void progression.start(bar,pickup ? -1 : gridBeat * progression.meterForBar(bar) / 4)}
}
let lastMiniFrame=0,averageEnergy=.08,expressionBar=-1,barEnergy=0,barSamples=0
 document.addEventListener('reference-position',event=>{
 const {playing}=/** @type {CustomEvent<{playing:boolean}>} */(event).detail
 const now=performance.now();if(playing&&now-lastMiniFrame<100)return;lastMiniFrame=now
 const {energy: previewEnergy}=referenceTrack.livePreview()
 const faces=document.querySelectorAll('#buddy-inline .talk-avatar')
 if(!playing){
  expressionBar=-1;barEnergy=0;barSamples=0;manualMatchTotal=0;manualMatchCount=0;manualMatchRate=0
  document.querySelector('#detail-melody')?.removeAttribute('data-manual-match')
  faces.forEach(face=>face.removeAttribute('data-energy-mood'))
  return
 }
 if(melodyExpressionBar>=0 && melodyExpressionBar!==expressionBar){
  if(barSamples){
   const energy=barEnergy/barSamples
   const manual=!!document.querySelector('#detail-melody .otto-play-mode input[value="manual"]:checked')
   if(manual){
    manualMatchRate=manualMatchCount?manualMatchTotal/manualMatchCount:manualMatchRate*.45
    const panel=document.querySelector('#detail-melody')
    panel?.setAttribute('data-manual-match',String(Math.round(manualMatchRate*100)))
    if(panel instanceof HTMLElement)panel.style.setProperty('--otto-match-bounce',`${2+manualMatchRate*9}px`)
   }
   manualMatchTotal=0;manualMatchCount=0
   const mood=manual ? (manualMatchRate>.8?'excited':manualMatchRate>.55?'happy':'') : energy>.09 && energy>averageEnergy*1.2 ? (energy>averageEnergy*1.6?'excited':'happy') : ''
   faces.forEach(face=>{if(mood)face.setAttribute('data-energy-mood',mood);else face.removeAttribute('data-energy-mood')})
   averageEnergy=averageEnergy*.8+energy*.2
  }
  expressionBar=melodyExpressionBar;barEnergy=0;barSamples=0
 }
 barEnergy+=previewEnergy;barSamples++
 })

refreshSectionControls = mountSectionControls({
  workspace, progression, editingSection, mixerKey, meterInput, tempo, keySelect, currentBar: () => resumeMelodyBar,
  contextChanged: () => { sectionContextRevision.value++ },
  harmonyChanged: () => { backingEditorRevision.value++; refreshLabels() },
})

mountMobileLayout()


const tutorialView = mountModeMenu(() => {
  for (const index of heldPads.keys()) releasePad(index)
  chordInstrument.silence()
  bass.silence()
  drums.silence()
  buddyController?.stop()
  progression.stop()
  magicVoice.stop()
  instrument.silence()
}, () => midiInput.connect(), () => partSettings.apply(melodyMode, 'session'))


mountStudioEditors({
  progression, seekMelodyBar, togglePlayback, displayParts, bassTimbre,
  readChordRevision: () => melodyChordsRevision.value,
  previewTimbre: () => instrument.timbre,
  previewDrum: id => { void playAccompanimentPad('drums', id, false) },
  previewBass: {
    ready: async () => {
      await chordInstrument.ready()
      return chordInstrument.context
    },
    playAt: (midi, time) => bass.playAt(midi, time, .24, .85),
  },
  onMelodyMounted: editor => { studioEditor = editor },
  onBassMounted: editor => { studioBassEditor = editor },
  onAccompanimentMounted(part, editor) {
    studioAccompanimentEditors[part] = editor
    editor.setNotes(studioAccompanimentLoad?.[part] ?? [])
    if (part === 'drums') {
      if (studioAccompanimentLoad) editor.setDrumPatterns(studioAccompanimentLoad.drumPatterns ?? [null,null,null,null])
      editor.setDrumAssignments(studioAccompanimentLoad?.drumAssignments ?? [])
    }
    progression[part === 'backing' ? 'studioBacking' : 'studioDrums'] = () => {
      const notes = editor.getNotes()
      if (part === 'drums') return drumPlaybackNotes(notes, editor.getDrumPatterns(), editor.getDrumAssignments(), progression.barCount())
      return notes.length ? notes : undefined
    }
  },
})
