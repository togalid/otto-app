import { migrateSongSections, splitSongSection } from './song-score.js'
import { sectionControlIds, arrangementControlIds, arrangementMixIds, decodeArrangement, encodeArrangement, restoreArrangement } from './arrangement-file.js'
import { mountBassDetail } from './bass-detail.js'
import { mountStyleChoices, mountPresetChoices } from './arrangement-selects.js'
import { mountMobileChordEditor } from './mobile-chord-editor.js'
import { mountBasicParts, mountReferenceControls, mountReferenceDetail } from './main-controls.js'
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
const referenceTimingHost = mountReferenceDetail(referenceView, referenceTrack.remove)
const { style: genreSelect, choose: chooseStyle } = mountStyleChoices()
const { preset: presetSelect, set: setPreset, choose: choosePreset, selected: selectedPreset } = mountPresetChoices()
import { OrnamentPlayer } from './ornament-audio.js'
import { mountOrnaments } from './ornament-ui.js'
import {
  notes,
  keyFromDegree,
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
import { Progression, shiftModulationFrom } from './progression.js'
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
    if (spaceTarget?.closest('.timing-waveform')) { startButton.click(); return }
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
let lastMagicKey = -1
function refreshMelody() {
  if(activeKey!==lastMagicKey&&document.querySelector('#piano-keys button')){
    lastMagicKey=activeKey
    if(((activeKey%12)+12)%12!==0)document.querySelector('[data-melody-view="magic"]')?.dispatchEvent(new MouseEvent('click',{bubbles:true}))
  }
  const state = melodyView.update(Number(keySelect.value), activeChord, activeKey, lastMelodyMidi, lastMelodyDegree)
  const chordPitches = new Set(melodyPalette(activeKey, activeChord, activeKey, 'chord')
    .filter(note => note.category === 'chord').map(note => note.midi % 12))
  document.querySelectorAll('#piano-keys [data-midi]').forEach(key => {
    const matches = chordPitches.has((Number(key.getAttribute('data-midi')) + (document.querySelector('#piano-keys')?.getAttribute('data-magic')==='true'?activeKey:0)) % 12)
    if (key.hasAttribute('data-harmony') !== matches) key.toggleAttribute('data-harmony', matches)
  })
  playableNotes = state.notes
  lastMelodyDegree = state.degree
}
document.addEventListener('melody-keyboard-change', refreshMelody)
let resumeMelodyBar = 0
let melodyPlayhead = /** @type {HTMLElement | undefined} */ (undefined)
let melodyExpressionBar = -1
let displayedBar = -1
let displayedBeat = -1
const playingSection = ref(-1)
const editingSection = ref(0)
const sectionAdvance = ref(false)
const sectionBars = ref(200)
const scorePage = ref(0)
const sectionContextRevision = ref(0)
let refreshSectionKnobs = () => {}
const progression = new Progression(
  chordInstrument,
  (index, chord, key, beat, section) => {
    melodyExpressionBar=index
    if(index>=0){resumeMelodyBar=index;if(melodyPlayhead){const input=melodyPlayhead.querySelector('input');if(input && document.activeElement!==input)input.value=String(index+1)}}
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
/** @type {Map<number,number>} */
const waveformStartBeats = new Map()
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
document.querySelectorAll('input[name="drum-rate"]').forEach(input => input.addEventListener('change', () => {
  progression.drumRate = /** @type {0.5|1|2} */ (Number(/** @type {HTMLInputElement} */ (input).value))
}))
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
const slotElements = mountChordGrid(1024, {
  play: playFromBar,
  modulate(section, amount) {
    shiftModulationFrom(progression.modulation, section, amount)
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
  if(buddyController?.autoPlay){void buddyController.start(false,resumeMelodyBar)}
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
  scorePage.value=Math.min(scorePage.value,Math.floor((progression.barCount()-1)/16))
  referenceTrack.refreshLoopLength()
  slotContainer?.querySelectorAll('.modulation-bar').forEach((element, index) => {
    const section = index
    element.toggleAttribute('hidden', (index * 2 >= progression.barCount() || Math.floor(index*2/16)!==scorePage.value))
    if ((index * 2 >= progression.barCount() || Math.floor(index*2/16)!==scorePage.value)) return
    const offset = progression.modulation[section]
    const relative = offset - (progression.modulation[section - 1] ?? 0)
    const output = element.querySelector('output')
    if (output) output.textContent = `${keys[progression.keyForBar(section * 2)].name} (${relative > 0 ? '+' : ''}${relative})`
    const down = /** @type {HTMLButtonElement | null} */ (element.querySelector('.modulation-down'))
    const up = /** @type {HTMLButtonElement | null} */ (element.querySelector('.modulation-up'))
    const subsequent = progression.modulation.slice(section)
    if (down) down.disabled = subsequent.some(value => value <= -120)
    if (up) up.disabled = subsequent.some(value => value >= 120)
  })
  slotElements.forEach((element, bar) => {
    element.hidden = bar >= progression.barCount() || Math.floor(bar/16)!==scorePage.value
    if (element.hidden) return
    const range=progression.songMode?progression.songSectionAt(bar):progression.selectedSection
    const sectionName=progression.sections[range].name ?? String.fromCharCode(65+range)
    element.dataset.sectionColor=String(Math.max(0,'ABCD'.indexOf(sectionName))%4)
    const label=element.querySelector('.bar-label')
    if(label)label.textContent=`${bar+1}${progression.songMode?' · '+(progression.sections[range].name ?? String.fromCharCode(65+range)):''}`
    const meter=progression.songMode?(progression.sections[range].meter ?? Number(meterInput.value)):progression.beatsPerBar
    element.style.setProperty('--beats-per-bar', String(meter))
    element.querySelectorAll('.beat-chord').forEach((cell, beat) => {
      cell.toggleAttribute('hidden', beat >= meter)
      if (beat < meter) updateChordCell(cell, bar, beat)
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
  const editButton=beatElement.querySelector('.score-chord-edit')
  editButton?.setAttribute('aria-label',`${bar+1}小節 ${beat+1}拍目：${id ? displayParts(id,barKey).main : '変更なし'}をPadで編集`)
  quality.hidden = !id
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
  if (recommended && !referenceView.filename && !progression.songMode) {
    setPreset(recommended.id)
    applyPreset(recommended.id)
  }
  delete progression.sections[progression.selectedSection].performance
  delete progression.sections[progression.selectedSection].backingSteps
  backingEditorRevision.value++
  syncCapturedChoices()
  progression.sections[progression.selectedSection].style = genre.id
  sectionContextRevision.value++
  queueMicrotask(()=>refreshSectionKnobs())
  progression.genre = genre.id
  progression.bassPattern = genre.bassPattern
  bassPattern.value = progression.bassPattern
  progression.drumSteps = null
  progression.rhythm = genre.rhythm
  renderDrumSteps()
  setOrnamentStyle(genre.id)
  if (!referenceView.filename) {
    if (progression.songMode) progression.sections[progression.selectedSection].bpm = genre.bpm
    else progression.bpm = genre.bpm
  }
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
  if (!referenceView.filename && !progression.songMode) tempo.value = String(genre.bpm)
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
/** @param {HTMLInputElement} input @param {number} sensitivity @param {boolean} [integer] */
function bindKnobDrag(input, sensitivity, integer = false) {
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
      input.value = String((input === tempo || integer) ? Math.round(startValue + change * sensitivity) : startValue + change * sensitivity)
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

const wholeScorePanel=document.getElementById('detail-chord')
if(wholeScorePanel){wholeScorePanel.classList.add('whole-song-score');document.querySelector('main')?.append(wholeScorePanel)}
const workspace = /** @type {HTMLElement} */ (document.querySelector('main'))
for (const input of Array.from(document.querySelectorAll('input[name="workspace-view"]'))) input.addEventListener('change', () => {
  const view=/** @type {HTMLInputElement} */ (input).value
  if(view!=='score')document.querySelector('.score-pad-dock:not([hidden]) .close')?.dispatchEvent(new MouseEvent('click',{bubbles:true}))
  workspace.dataset.workspaceView = view
  document.dispatchEvent(new Event('resize'))
})
createApp({render:()=>{
  sectionContextRevision.value
  const index=playingSection.value>=0 ? playingSection.value : editingSection.value
  const section=progression.sections[index]
  const key=keys[section.key ?? progression.key].name
  const meter=section.meter ?? Number(meterInput.value)
  const bpm=section.bpm ?? Number(tempo.value)
  return h('div',{class:'score-context'},[
    h('span',{class:'score-context-section'},`${section.name ?? String.fromCharCode(65+index)} · ${(section.startBar ?? 0)+1}〜${section.endBar ?? progression.barCount()}小節`),
    h('span',`キー ${key}`),h('span',`${meter}/4`),h('span',`♩ ${bpm}`),
  ])
}}).mount('#score-section-context')
const backingPanel=document.createElement('section')
backingPanel.id='detail-backing';backingPanel.hidden=false
backingPanel.innerHTML='<h2>コードのバッキング</h2><div class="backing-pattern-options"></div>'
document.querySelector('.track-details')?.append(backingPanel)
const backingDetailSelect=/** @type {HTMLSelectElement} */(document.getElementById('chord-backing'))
for(const option of Array.from(backingDetailSelect.options)){
 const button=document.createElement('button');button.type='button';button.className='reference-remove-key';button.textContent=option.text
 button.addEventListener('click',()=>{delete progression.sections[progression.selectedSection].backingSteps;backingEditorRevision.value++;backingDetailSelect.value=option.value;backingDetailSelect.dispatchEvent(new Event('change',{bubbles:true}));backingPanel.querySelectorAll('button').forEach(item=>item.setAttribute('aria-pressed',String(item===button)))})
 backingPanel.querySelector('.backing-pattern-options')?.append(button)
}
const backingEditorRevision=ref(0)
const backingEditorHost=document.createElement('div');backingEditorHost.className='backing-step-editor';backingPanel.append(backingEditorHost)
function mountBackingStepEditor(){
 createApp({render:()=>{
  backingEditorRevision.value
  const section=progression.sections[editingSection.value]
  const beats=section.meter ?? Number(meterInput.value)
  return [h('label',{class:'oto-checkbox'},[
   h('input',{type:'checkbox',checked:!!section.backingSteps,onChange:(/** @type {Event} */ event)=>{
    if((/** @type {HTMLInputElement} */(event.target)).checked)section.backingSteps=Array.from({length:beats*4},(_,index)=>({enabled:index%4===0,duration:.8,level:.8}))
    else delete section.backingSteps
    backingEditorRevision.value++
   }}),h('span','拍ごとに編集'),
  ]),section.backingSteps?h('div',{class:'backing-step-grid',style:`--step-columns:${beats*4}`},Array.from({length:beats*4},(_,index)=>{
   const step=section.backingSteps?.[index]
   if(!step)return null
   return h('div',{class:'backing-step'},[
    h('button',{type:'button',class:'reference-remove-key','aria-label':`${index/4+1}拍目を発音`,'aria-pressed':String(step.enabled),onClick:()=>{step.enabled=!step.enabled;backingEditorRevision.value++}},index%4===0?String(index/4+1):'・'),
    h('label',{class:'backing-step-label'},'長さ'),
    h('input',{type:'range',min:.1,max:2,step:.1,value:step.duration,disabled:!step.enabled,'aria-label':`${index/4+1}拍目の長さ`,onInput:(/** @type {Event} */event)=>{step.duration=Number((/** @type {HTMLInputElement} */(event.target)).value)}}),
    h('label',{class:'backing-step-label'},'強さ'),
    h('input',{type:'range',min:0,max:1,step:.05,value:step.level,disabled:!step.enabled,'aria-label':`${index/4+1}拍目の強さ`,onInput:(/** @type {Event} */event)=>{step.level=Number((/** @type {HTMLInputElement} */(event.target)).value)}}),
   ])
  })):null]
 }}).mount(backingEditorHost)
}
const trackButtons = Array.from(document.querySelectorAll('.track-select[data-track]:not(.ornament-select)'))
document.addEventListener('reference-loaded', () => {
  progression.stop()
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
  const solo = document.getElementById('reference-solo')
  if (solo?.getAttribute('aria-pressed') === 'true') solo.click()
})
for (const button of trackButtons) {
  button.addEventListener('click', () => {
    const selected = /** @type {HTMLElement} */ (button).dataset.track
    for (const item of trackButtons)
      item.setAttribute('aria-pressed', String(item === button))
    const details = /** @type {HTMLElement} */ (document.querySelector('.track-details'))
    details.hidden = selected === 'melody'
    for (const name of ['reference', 'drums', 'bass', 'chord', 'melody']) {
      const panel = /** @type {HTMLElement} */ (
        document.querySelector(name==='chord'?'#detail-backing':`#detail-${name}`)
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
import { mountKeyboard, mountMidiInput, pianoNotes, pianoKey } from './keyboard.js'
mountKeyboard({
  key: () => activeKey,
  ready: () => instrument.ready(),
  attack: (midi,glide) => {
    if (buddyController?.active) buddyController.attackMidi(midi,glide)
    else { instrument.attack(midi,glide); lastMelodyMidi=midi; lastMelodyDegree=melodyRole(midi,activeChord,activeKey).degree; refreshMelody() }
  },
  release: midi => { if(buddyController?.active)buddyController.releaseMidi(midi);else instrument.release(midi) },
  stop: () => { buddyController?.stop();instrument.silence() },
  onError: error => { if(status)status.textContent=error instanceof Error?error.message:'音を再生できませんでした。' },
})
refreshMelody()
const melodyVoiceLabel=document.createElement('label')
melodyVoiceLabel.className='section-style-choice'
melodyVoiceLabel.textContent='音色 '
const melodyVoiceSelect=/** @type {HTMLSelectElement} */(melodyTimbre.cloneNode(true))
melodyVoiceSelect.removeAttribute('id');melodyVoiceSelect.setAttribute('aria-label','メロディ画面の音色')
melodyVoiceSelect.addEventListener('change',()=>{melodyTimbre.value=melodyVoiceSelect.value;melodyTimbre.dispatchEvent(new Event('change',{bubbles:true}))})
melodyTimbre.addEventListener('change',()=>{melodyVoiceSelect.value=melodyTimbre.value})
melodyVoiceLabel.append(melodyVoiceSelect)
document.querySelector('.melody-heading')?.after(melodyVoiceLabel)
mountMidiInput({
  transpose:()=>document.querySelector('#piano-keys')?.getAttribute('data-magic')==='true'?activeKey:0,
  bend:value=>instrument.setPitchBend(value),
  modulation:value=>{instrument.setModulation(value);buddyController?.rememberModulation(value)},
  ready: () => instrument.ready(),
  attack: midi => { if(buddyController?.active){buddyController.attackMidi(midi);return} instrument.attack(midi); lastMelodyMidi=midi; lastMelodyDegree=melodyRole(midi,activeChord,activeKey).degree; refreshMelody(); document.querySelector(`#piano-keys [data-midi="${midi}"]`)?.setAttribute('data-playing','') },
  release: midi => { if(buddyController?.active)buddyController.releaseMidi(midi);else instrument.release(midi); document.querySelector(`#piano-keys [data-midi="${midi}"]`)?.removeAttribute('data-playing') },
})
buddyController = mountBuddy({
  progression, instrument, drums,
  getNotes: () => playableNotes,
  refreshTransport: updateTransport,
  onModeChange: mode => { melodyMode.value = mode },
  onPlayStyleChange: style => setJazzSwing(style === 'jazz'),
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
    if(item){progression.genre=item.id;progression.swing=item.swing;swing.value=String(item.swing);renderSwing();playerDisplay.setStyle(item.label,item.group);refreshBuddyLook()}
  }
  restoreSectionParts()
  sectionContextRevision.value++
  refreshSectionKnobs()
  backingEditorRevision.value++
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

const sectionRangeRevision=ref(0)
createApp({
  render: () => (sectionRangeRevision.value, sectionContextRevision.value, [
    ...progression.sections.map((_, index) => {const name=progression.sections[index].name ?? String.fromCharCode(65+index);return h('button', {
      type: 'button', 'aria-label': `セクション${name}を編集`,
      'aria-pressed': String(index === editingSection.value),
      'data-playing': index === playingSection.value ? 'true' : undefined,
      onClick: () => editSection(index),
    }, name)}),
    h('div',{class:'section-style-summary'}, `範囲 ${(progression.sections[editingSection.value].startBar ?? 0)+1}〜${progression.sections[editingSection.value].endBar ?? progression.barCount()}小節`),
    h('label',{class:'section-style-choice'},['スタイル',h('select',{'aria-label':'セクションのスタイル',value:progression.sections[editingSection.value].style ?? genreSelect.value,onChange:(/** @type {Event} */ event)=>void chooseStyle((/** @type {HTMLSelectElement} */(event.target)).value)},genres.map(item=>h('option',{value:item.id},item.label)))]),
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
/** @param {number} delta */
function changeBarCount(delta) {
  const section = progression.sections[0]
  const count = Math.max((progression.sections[progression.sections.length-1].startBar ?? 0)+1, Math.min(1024, progression.barCount() + delta))
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

const scorePaging=document.createElement('div')
scorePaging.className='score-paging'
document.getElementById('section-bar-count')?.after(scorePaging)
const scoreHeading=document.querySelector('#detail-chord .chord-heading')
const scoreSettings=document.querySelector('#detail-chord .chord-settings')
if(scoreHeading && scoreSettings)scoreSettings.after(scoreHeading)
createApp({setup:()=>()=>h('div',{class:'style-stepper',role:'group','aria-label':'コード進行のページ'},[
 h('button',{type:'button',disabled:scorePage.value===0,'aria-label':'前の16小節',onClick:()=>{scorePage.value--;refreshLabels()}},'〈'),
 h('output',{'aria-live':'polite'},`${scorePage.value*16+1}〜${Math.min((scorePage.value+1)*16,sectionBars.value)}小節`),
 h('button',{type:'button',disabled:(scorePage.value+1)*16>=sectionBars.value,'aria-label':'次の16小節',onClick:()=>{scorePage.value++;refreshLabels()}},'〉'),
 h('button',{type:'button',disabled:sectionBars.value>=1024,'aria-label':'16小節追加',onClick:()=>changeBarCount(Math.min(16,1024-sectionBars.value))},'＋16小節'),
])}).mount(scorePaging)

// Start with the same complete arrangement as the displayed style.
genreSelect.dispatchEvent(new Event('change', {bubbles:true}))
while (progression.slots.length < 200) {
  progression.slots = [...progression.slots, ...progression.slots]
  progression.beatSlots = [...progression.beatSlots, ...progression.beatSlots.map(row => [...row])]
  progression.modulation = [...progression.modulation, ...progression.modulation]
}
progression.sections[0].barCount = 200
for (let index = 1; index < progression.sections.length; index++) {
  const {slots, beatSlots, modulation} = progression.sections[0]
  progression.sections[index] = {slots: [...slots], beatSlots: beatSlots.map(row => [...row]), modulation: [...modulation], advance: false, barCount:200}
}

for (const section of progression.sections) section.partSettings = {...readSectionParts()}
// Start with one arrangement for the entire song; boundaries are user-authored.
progression.sections=[{...progression.sections[0],name:'A',style:genreSelect.value,startBar:0,endBar:200}]
progression.songMode=true
mountBackingStepEditor()
sectionRangeRevision.value++
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
  const {bassFeel, bassTones, drumSteps, drumAccents, drumPitch, sections, drumRate} = progression
  const beatsPerBar = Number(meterInput.value)
  const json = encodeArrangement(controls, mix, {slots, beatSlots, modulation, bassFeel, bassTones, drumSteps, drumAccents, drumPitch, beatsPerBar, drumRate}, sections)
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
    if (file.size > 16 * 1024 * 1024) throw new Error('size')
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
        progression.drumRate = score.drumRate ?? 1
        const selectedRate = /** @type {HTMLInputElement | null} */ (document.querySelector(`input[name="drum-rate"][value="${progression.drumRate}"]`))
        if (selectedRate) selectedRate.checked = true
        progression.beatsPerBar = score.beatsPerBar ?? 4
        refreshMeter()
        const fallbackParts = readSectionParts()
        for (const section of sections) section.partSettings ??= {...fallbackParts}
        progression.sections = migrateSongSections(sections)
        progression.songMode = true
        scorePage.value=0
        sectionRangeRevision.value++
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

/** @param {{bpm:number,key:number}} result */
async function applyReferenceArrangement(result) {
  buddyController?.stop()
  progression.stop()
  tempo.value = String(result.bpm)
  tempo.dispatchEvent(new Event('input', {bubbles:true}))
  keySelect.value = String(result.key)
  keySelect.dispatchEvent(new Event('change', {bubbles:true}))
}

const timingControl = document.createElement('div')
timingControl.className = 'reference-timing-control'
const timingLabel = document.createElement('span')
timingLabel.textContent = '原曲の開始位置'
const timingOutput = document.createElement('output')
timingOutput.value = '0.00 秒'
function refreshTimingRange() {
  timingOutput.value = referenceTrack.getTiming(editingSection.value).toFixed(2) + ' 秒'
}
/** @param {number} value */
function commitReferenceTiming(value) {
  referenceTrack.setTiming(editingSection.value, value)
  refreshTimingRange()
  updateTimingPreview()
}
timingControl.append(timingOutput)

const timingPreview = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
timingPreview.classList.add('timing-waveform')
timingPreview.setAttribute('viewBox', '0 0 1000 100')
timingPreview.setAttribute('preserveAspectRatio', 'none')
timingPreview.setAttribute('role', 'img')
// SVG backgrounds do not reliably receive pointer events in every browser.
const waveformHitArea=document.createElementNS(timingPreview.namespaceURI,'rect')
waveformHitArea.setAttribute('width','1000');waveformHitArea.setAttribute('height','100')
waveformHitArea.setAttribute('fill','transparent')
waveformHitArea.setAttribute('pointer-events','all')
timingPreview.append(waveformHitArea)
timingPreview.setAttribute('aria-label', '原曲の波形と2小節の8分音符グリッド')
// Keep the actual scheduled position observable without exposing audio or filenames.
document.addEventListener('reference-playback-start', event=>{
 const detail=/** @type {CustomEvent<{section:number,adjustment:number,sourceOffset:number,scheduledTime:number,stemOffsets:number[]}>} */(event).detail
 timingPreview.dataset.playback=JSON.stringify(detail)
 timingOutput.title=`直近の再生：${'ABCD'[detail.section]} / 調整 ${detail.adjustment.toFixed(2)} 秒 / 原曲 ${detail.sourceOffset.toFixed(3)} 秒`
})
let timingZoomBars = 2
let timingPage = 0
let manualTimingPage = false
let waveformWasPlaying = false
let timingAligned = false
let zoomFrame = 0
let zoomTarget = 2
const timingWave = document.createElementNS(timingPreview.namespaceURI, 'path')
timingPreview.append(timingWave)
let timingGrid = ''
function refreshTimingGrid() {
  const bars = timingZoomBars
  const grid = `${progression.beatsPerBar}:${bars}:${timingPage}`
  if (timingGrid === grid) return
  timingGrid = grid
  timingPreview.querySelectorAll('.bar-grid, .beat-grid, .ruler-tick').forEach(line => line.remove())
  waveBarNumbers.replaceChildren()
  const beats=progression.beatsPerBar*bars
  // Four small divisions per beat make the waveform feel like a measuring tool.
  for(let tick=Math.ceil(-.12*beats*4);tick<=beats*4;tick++) {
    const beat=tick/4,x=(beat/beats+.12)*1000
    if(x<0||x>1000)continue
    const barLine=tick%(progression.beatsPerBar*4)===0
    const beatLine=tick%4===0
    const line=document.createElementNS(timingPreview.namespaceURI,'line')
    line.setAttribute('x1',String(x));line.setAttribute('x2',String(x))
    line.setAttribute('y1','0');line.setAttribute('y2',barLine?'100':beatLine?'50':tick%2===0?'5':'3')
    line.setAttribute('class',barLine?(tick===0?'bar-grid first-beat-grid':'bar-grid'):beatLine?'beat-grid':'ruler-tick')
    timingPreview.append(line)
    const bar=Math.round(timingPage+beat/progression.beatsPerBar)+1
    if(barLine&&bar>0){
      const label=document.createElement('span')
      label.style.left=`${x/10}%`
      label.textContent=`${bar}小節`
      waveBarNumbers.append(label)
    }
  }
}
const timingCursor = document.createElementNS(timingPreview.namespaceURI, 'line')
timingCursor.setAttribute('class', 'playhead')
timingCursor.setAttribute('y1', '0'); timingCursor.setAttribute('y2', '100')
timingCursor.setAttribute('visibility', 'hidden')
const waveformArea = document.createElement('div')
waveformArea.className = 'timing-waveform-area'
const waveBarNumbers=document.createElement('div')
waveBarNumbers.className='waveform-bar-numbers'
waveBarNumbers.setAttribute('aria-hidden','true')
const waveReticle=document.createElement('span')
waveReticle.className='waveform-reticle'
waveReticle.setAttribute('aria-hidden','true')
const scopeCue=document.createElement('span');scopeCue.className='waveform-scope-cue';scopeCue.textContent='いい感じ！';scopeCue.hidden=true
waveReticle.append(scopeCue)
const waveformZoom = document.createElement('div')
waveformZoom.className = 'style-stepper waveform-zoom'
waveformZoom.setAttribute('role', 'group')
waveformZoom.setAttribute('aria-label', '波形の拡大・縮小')
for (const [label, direction] of /** @type {[string, number][]} */ ([['縮小', 1], ['拡大', -1]])) {
  const button = document.createElement('button')
  button.type = 'button'; button.textContent = direction > 0 ? '−' : '＋'
  button.setAttribute('aria-label', `波形を${label}`)
  button.addEventListener('click', () => {
    zoomTarget = Math.max(1, Math.min(16, zoomTarget * (direction > 0 ? 2 : .5)))
    manualTimingPage = false
    cancelAnimationFrame(zoomFrame)
    const from = timingZoomBars, started = performance.now()
    /** @param {number} now */
    const animate = now => {
      const t = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : Math.min(1,(now-started)/240)
      timingZoomBars = from + (zoomTarget-from)*(1-(1-t)**3)
      updateTimingPreview()
      if(t<1) zoomFrame=requestAnimationFrame(animate)
    }
    zoomFrame=requestAnimationFrame(animate)
  })
  waveformZoom.append(button)
}
const zoomIcon=document.createElement('span')
zoomIcon.className='waveform-zoom-icon'
zoomIcon.setAttribute('aria-hidden','true')
zoomIcon.innerHTML='<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/></svg>'
waveformZoom.prepend(zoomIcon)
// Each gesture snapshots its scale and start value; every move commits to audio state.
/** @type {{id:number,x:number,value:number,secondsPerPixel:number}|null} */
let waveformDrag = null
timingPreview.setAttribute('tabindex', '0')
timingPreview.addEventListener('pointerdown', event => {
  if (!event.isPrimary || event.button !== 0) return
  event.preventDefault()
  if (timingAligned) {
    const beats = waveformBeatAt(event.clientX)
    const bar = Math.floor(beats / progression.beatsPerBar)
    playbackHeads.set(progression.selectedSection,bar)
    waveformStartBeats.set(progression.selectedSection,beats % progression.beatsPerBar)
    selectedWaveBeat=beats
    timingPreview.focus({preventScroll:true})
    renderWaveSelection()
    if (progression.running) {
      progression.bpm=Number(tempo.value)
      void progression.start(bar,beats % progression.beatsPerBar)
    }
    return
  }
  progression.stop()
  const width = timingPreview.getBoundingClientRect().width
  waveformDrag = {id:event.pointerId, x:event.clientX, value:referenceTrack.getTiming(editingSection.value), secondsPerPixel:60 * timingZoomBars * progression.beatsPerBar / Math.max(40,Number(tempo.value)) / Math.max(1,width)}
  timingPreview.setPointerCapture(event.pointerId)
  timingPreview.focus({preventScroll:true})
  timingPreview.classList.add('dragging')
  waveformHint.hidden = true
  challengeStatus.textContent = '② 聴いて重なりを確かめる'
  rhythmDone.setAttribute('aria-pressed','false')
})
timingPreview.addEventListener('pointermove', event => {
  if(timingAligned) { setWaveLine(hoverWaveLine,waveformBeatAt(event.clientX)); return }
  if (!waveformDrag || event.pointerId !== waveformDrag.id) return
  commitReferenceTiming(waveformDrag.value + (waveformDrag.x-event.clientX)*waveformDrag.secondsPerPixel)
})
function endWaveformDrag() { waveformDrag=null; timingPreview.classList.remove('dragging') }
for (const name of ['pointerup','pointercancel','lostpointercapture']) timingPreview.addEventListener(name,endWaveformDrag)
window.addEventListener('blur',endWaveformDrag)
document.addEventListener('reference-removed',endWaveformDrag)
timingPreview.addEventListener('keydown', event => {
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
  event.preventDefault()
  commitReferenceTiming(referenceTrack.getTiming(editingSection.value)+(event.key==='ArrowRight'?.01:-.01))
})
/** @type {number|null} */ let selectedWaveBeat=null
const hoverWaveLine=document.createElementNS(timingPreview.namespaceURI,'line')
const selectedWaveLine=document.createElementNS(timingPreview.namespaceURI,'line')
const waveSpeaker=document.createElement('span')
waveSpeaker.className='wave-position-speaker'
waveSpeaker.hidden=true
waveSpeaker.setAttribute('aria-label','ここから再生')
waveSpeaker.innerHTML='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 8a6 6 0 0 1 0 8M19 5a10 10 0 0 1 0 14"/></svg>'
waveformArea.append(waveSpeaker)
for(const [line,kind] of /** @type {[Element,string][]} */ ([[hoverWaveLine,'wave-hover-line'],[selectedWaveLine,'wave-selected-line']])) {
  line.setAttribute('class',String(kind));line.setAttribute('y1','0');line.setAttribute('y2','100');line.setAttribute('visibility','hidden')
  timingPreview.append(line)
}
/** @param {number} clientX */
function waveformBeatAt(clientX) {
 const rect=timingPreview.getBoundingClientRect()
 return Math.max(0,Math.min(progression.barCount()*progression.beatsPerBar-1,Math.round((((clientX-rect.left)/rect.width-.12)*timingZoomBars+timingPage)*progression.beatsPerBar)))
}
/** @param {Element} line @param {number} beat */
function setWaveLine(line,beat) {
 const x=((beat/progression.beatsPerBar-timingPage)/timingZoomBars+.12)*1000
 line.setAttribute('x1',String(x));line.setAttribute('x2',String(x));line.setAttribute('visibility',timingAligned&&x>=0&&x<=1000?'visible':'hidden')
 waveSpeaker.hidden=!(timingAligned&&x>=0&&x<=1000)
 waveSpeaker.style.left=String(x/10)+'%'
}
function renderWaveSelection(){if(selectedWaveBeat!==null)setWaveLine(selectedWaveLine,selectedWaveBeat)}
timingPreview.addEventListener('pointerleave',()=>{hoverWaveLine.setAttribute('visibility','hidden');waveSpeaker.hidden=true;renderWaveSelection()})
const waveformHint = document.createElement('div')
waveformHint.className = 'waveform-drag-hint'
waveformHint.textContent = '↔ 波形をつかんで、音の立ち上がりを左の1拍目へ'
const beatTarget = document.createElement('span')
beatTarget.className = 'waveform-beat-target'
beatTarget.textContent = '1拍目'
const waveformPreRoll=document.createElement('span')
waveformPreRoll.className='waveform-pre-roll-mask'
waveformPreRoll.setAttribute('aria-hidden','true')
waveformArea.append(timingPreview, waveformPreRoll, waveBarNumbers, waveReticle, waveformHint, beatTarget, waveformZoom)
const rhythmChallenge = document.createElement('strong')
rhythmChallenge.textContent = 'リズムを重ねよう'
const challengeStatus = document.createElement('span')
challengeStatus.className = 'timing-challenge-status'
challengeStatus.setAttribute('aria-live', 'polite')
challengeStatus.textContent = '① 波形を左右に動かす'
const rhythmCheck = document.createElement('button')
rhythmCheck.type = 'button'
rhythmCheck.className = 'reference-remove-key'
rhythmCheck.textContent = '▶ 聴いて確認'
rhythmCheck.addEventListener('click', () => {
  if (progression.running) { progression.stop(); rhythmCheck.textContent = '▶ 聴いて確認'; return }
  if(!timingAligned&&referenceTrack.timingOnsetNear(editingSection.value)&&referenceTrack.timingOnsetNear(editingSection.value,60*progression.beatsPerBar/Math.max(40,Number(tempo.value))))rhythmDone.click()
  rootGuide.hidden=true
  playFromBar(0)
  rhythmCheck.textContent = '■ 停止'
  challengeStatus.textContent = '原曲とドラムの重なりを聴こう'
})
const rhythmDone = document.createElement('button')
rhythmDone.type = 'button'; rhythmDone.className = 'reference-remove-key'
rhythmDone.textContent = '合わせ直す'
rhythmDone.hidden=true
rhythmDone.addEventListener('click', () => {
  timingAligned=!timingAligned
  timingTempo.hidden=timingAligned
  waveSpeaker.hidden=true
  if(!timingAligned){manualTimingPage=false;timingPage=0;waveformStartBeats.clear();selectedWaveBeat=null;selectedWaveLine.setAttribute('visibility','hidden');hoverWaveLine.setAttribute('visibility','hidden')}
  endWaveformDrag()
  rhythmDone.hidden=!timingAligned
  challengeStatus.textContent=timingAligned?'ルーラーをクリックして再生':'① 波形を左右に動かす'
  waveformHint.hidden=timingAligned
  waveformHint.textContent=timingAligned?'▶ ルーラーをクリックして、この拍から再生':'↔ 波形をつかんで1拍目に合わせる'
  timingPreview.classList.toggle('aligned',timingAligned)
  if(timingAligned) manualTimingPage=false
  if(timingAligned) {
    selectedWaveBeat=0
    playbackHeads.set(progression.selectedSection,0)
    waveformStartBeats.set(progression.selectedSection,0)
    renderWaveSelection()
  }
  updateTimingPreview()
})
const timingNudge=document.createElement('div')
timingNudge.className='style-stepper timing-navigation'
for(const direction of [-1,1]) {
  const button=document.createElement('button');button.type='button';button.textContent=direction<0?'←':'→'
  button.setAttribute('aria-label',direction<0?'開始位置を少し戻す':'開始位置を少し進める')
  let timer=/** @type {ReturnType<typeof setTimeout>|undefined} */(undefined)
  const stop=()=>{clearTimeout(timer);timer=undefined}
  const step=()=>commitReferenceTiming(referenceTrack.getTiming(editingSection.value)+direction*.01)
  button.addEventListener('pointerdown',event=>{if(event.button!==0)return;event.preventDefault();button.setPointerCapture(event.pointerId);step();timer=setTimeout(function repeat(){step();timer=setTimeout(repeat,70)},350)})
  for(const name of ['pointerup','pointercancel','lostpointercapture','blur'])button.addEventListener(name,stop)
  window.addEventListener('blur',stop)
  document.addEventListener('visibilitychange',stop)
  button.addEventListener('click',event=>{if(event.detail===0)step()})
  timingNudge.append(button)
}
const timingTempo=document.createElement('div')
timingTempo.className='timing-tempo-controls'
timingTempo.innerHTML='<label class="timing-tempo-knob">テンポ<span class="volume-knob"><input type="range" min="40" max="200" step="0.1" aria-label="位置合わせのテンポ"><span aria-hidden="true"></span></span><output></output></label>'
const timingTempoInput=/** @type {HTMLInputElement} */(timingTempo.querySelector('input'))
const timingTempoOutput=/** @type {HTMLOutputElement} */(timingTempo.querySelector('output'))
const tempoMultipliers=document.createElement('div')
tempoMultipliers.className='timing-tempo-multipliers'
tempoMultipliers.setAttribute('role','group');tempoMultipliers.setAttribute('aria-label','テンポの半分・2倍')
for(const [factor,label,name] of /** @type {[number,string,string][]} */ ([[.5,'½','テンポを半分にする'],[2,'×2','テンポを2倍にする']])) {
 const button=document.createElement('button');button.type='button';button.textContent=label
 button.setAttribute('aria-label',name);button.title=name
 button.dataset.factor=String(factor)
 button.addEventListener('click',()=>{
  const next=Math.round(Number(tempo.value)*factor*10)/10
  if(next<40||next>200)return
  tempo.value=String(next);tempo.dispatchEvent(new Event('input',{bubbles:true}))
 })
 tempoMultipliers.append(button)
}
timingTempo.append(tempoMultipliers)
function syncTimingTempo(){
 tempoMultipliers.querySelectorAll('button').forEach(button=>{const value=Number(tempo.value)*Number(button.dataset.factor);button.disabled=value<40||value>200})
 timingTempoInput.value=tempo.value
 timingTempoOutput.value=tempo.value
 timingTempoInput.parentElement?.style.setProperty('--angle',`${-135+(Number(tempo.value)-40)/160*270}deg`)
}
timingTempoInput.addEventListener('input',()=>{tempo.value=String(Math.round(Number(timingTempoInput.value)));tempo.dispatchEvent(new Event('input',{bubbles:true}))})
timingTempoInput.addEventListener('keydown',event=>{
 const direction=['ArrowRight','ArrowUp'].includes(event.key)?1:['ArrowLeft','ArrowDown'].includes(event.key)?-1:0
 if(!direction)return
 event.preventDefault()
 tempo.value=String(Math.max(40,Math.min(200,Math.round(Number(tempo.value))+direction)))
 tempo.dispatchEvent(new Event('input',{bubbles:true}))
})
tempo.addEventListener('input',syncTimingTempo)
bindKnobDrag(timingTempoInput,.5,true)
syncTimingTempo()
timingControl.append(timingTempo)
for(const direction of [-1,1]) {
 const button=document.createElement('button');button.type='button';button.textContent=direction<0?'〈':'〉'
 button.setAttribute('aria-label',direction<0?'波形を1小節前へ':'波形を1小節先へ')
 button.addEventListener('click',()=>{
  const seconds=60*timingZoomBars*progression.beatsPerBar/Math.max(40,Number(tempo.value))
  const maxPage=Math.max(0,Math.ceil((referenceView.duration-referenceTrack.getTiming(editingSection.value))/seconds*timingZoomBars)-1)
  timingPage=Math.max(0,Math.min(maxPage,timingPage+direction));manualTimingPage=true;updateTimingPreview()
 })
 timingNudge.append(button)
}
document.addEventListener('reference-loaded',()=>{manualTimingPage=false;timingPage=0;updateTimingPreview()})
const tempoGuide=document.createElement('span');tempoGuide.className='timing-guide-bubble';tempoGuide.textContent='テンポを動かしてみよう！';tempoGuide.hidden=true
timingTempo.append(tempoGuide)
const listenGuide=document.createElement('span');listenGuide.className='timing-guide-bubble';listenGuide.textContent='確認してみよう！';listenGuide.hidden=true
timingControl.append(timingNudge, rhythmCheck, listenGuide, rhythmDone)
const timingRow = document.createElement('div')
timingRow.className = 'reference-timing-row'
timingRow.hidden = !referenceView.filename
document.addEventListener('reference-timing-refresh', () => {
  queueMicrotask(() => {
    timingRow.hidden = !referenceView.filename
    refreshTimingRange()
    timingOutput.value = referenceTrack.getTiming(editingSection.value).toFixed(2) + ' 秒'
    updateTimingPreview()
  })
})
timingRow.append(waveformArea, timingControl)
referenceTimingHost.append(timingRow)
/** @param {boolean} [redraw] */
function updateTimingPreview(redraw = true) {
  const bars = timingZoomBars
  const seconds = (60 * bars * progression.beatsPerBar) / Math.max(40, Number(tempo.value))
  timingPreview.setAttribute('aria-label', `原曲の波形（${bars}小節、拍グリッド）`)
  const elapsed = Math.max(0, referenceTrack.getPosition() - referenceTrack.getTiming(editingSection.value))
  if (!manualTimingPage) {
    const focusSeconds = timingAligned && referenceView.playing ? elapsed : timingAligned && selectedWaveBeat !== null ? selectedWaveBeat * 60 / Math.max(40,Number(tempo.value)) : 0
    // Keep bar 1 anchored during alignment; browse/follow in single-bar increments.
    const focusBar = focusSeconds / seconds * bars
    timingPage = timingAligned ? Math.max(0, Math.floor(focusBar - bars * .75)) : 0
  }
  beatTarget.textContent = timingPage === 0 ? '1拍目' : `${timingPage+1}小節`
  refreshTimingGrid()
  if (redraw || !timingWave.getAttribute('d')) timingWave.setAttribute('d', referenceTrack.timingWaveform(editingSection.value, seconds, (timingPage/bars-.12) * seconds))
  timingPreview.append(hoverWaveLine,selectedWaveLine,timingCursor)
  renderWaveSelection()
  waveformZoom.querySelectorAll('button')[0].disabled = bars >= 16
  waveformZoom.querySelectorAll('button')[1].disabled = bars <= 1
  timingWave.setAttribute('transform','matrix(1 0 0 .76 0 12)')
  const near=!timingAligned&&referenceTrack.timingOnsetNear(editingSection.value)
  waveReticle.classList.toggle('on-target',near)
  scopeCue.hidden=timingAligned
  const nextBarSeconds=60*progression.beatsPerBar/Math.max(40,Number(tempo.value))
  const both=near&&referenceTrack.timingOnsetNear(editingSection.value,nextBarSeconds)
  scopeCue.textContent=both?'ばっちり！次にすすもう！':near?'いいかんじ！2小節目も合わせてみよう':'波形を掴んで動かしてみよう…'
  tempoGuide.hidden=true
  listenGuide.hidden=true
  waveformHint.hidden=true
  waveReticle.classList.toggle('bars-on-target',both)
}
document.addEventListener('reference-timing-refresh', () => updateTimingPreview())
tempo.addEventListener('input', () => updateTimingPreview())
updateTimingPreview()
document.addEventListener('reference-position', event => {
  const detail = /** @type {CustomEvent<{position:number,playing:boolean}>} */ (event).detail
  if (detail.playing && !waveformWasPlaying) { manualTimingPage=false; updateTimingPreview() }
  waveformWasPlaying=detail.playing
  if (detail.playing && !timingRow.hidden) {
    const seconds = 60 * timingZoomBars * progression.beatsPerBar / Math.max(40, Number(tempo.value))
    const elapsed = detail.position - referenceTrack.getTiming(editingSection.value)
    const page = timingAligned ? Math.max(0, Math.floor(Math.max(0, elapsed) / seconds * timingZoomBars - timingZoomBars * .75)) : 0
    if (!manualTimingPage && page !== timingPage) updateTimingPreview()
    const x = Math.max(0, Math.min(1000, ((elapsed - timingPage / timingZoomBars * seconds) / seconds + .12) * 1000))
    timingCursor.setAttribute('x1', String(x)); timingCursor.setAttribute('x2', String(x))
    timingCursor.setAttribute('visibility', 'visible')
  } else timingCursor.setAttribute('visibility', 'hidden')
})

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
 bars:()=>progression.barCount(), beats:bar=>progression.songMode?(progression.sections[progression.songSectionAt(bar ?? 0)].meter ?? Number(meterInput.value)):progression.beatsPerBar,
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


const keyAssist = document.createElement('section')
keyAssist.className = 'reference-key-assist'
keyAssist.setAttribute('aria-label', '耳でキーを合わせる')
keyAssist.innerHTML = '<button type="button" class="reference-remove-key key-listen" aria-pressed="false">▶ 最初の1拍を聴き比べる</button><label class="key-match-control">ルート音<span class="volume-knob"><input type="range" min="0" max="11" step="1" value="0" aria-label="聴き比べるルート音"><span aria-hidden="true"></span></span><output>C</output></label><label>これは何のコード？<select aria-label="コードの度数">'+[[6,'☾ 6｜哀しげ'],[4,'♡ 4｜切なさ・優しさ'],[1,'☀ 1｜元気・明るい'],[2,'2'],[3,'3'],[5,'5'],[7,'7']].map(([n,label])=>`<option value="${Number(n)-1}">${label}</option>`).join('')+'</select></label><output class="key-match-result" aria-live="polite">キー C</output>'
referenceTimingHost.append(keyAssist)
const rootGuide=document.createElement('span');rootGuide.className='timing-guide-bubble root-guide';rootGuide.textContent='次はルート音を聴き比べよう！';rootGuide.hidden=true
keyAssist.append(rootGuide)
const matchRoot = /** @type {HTMLInputElement} */ (keyAssist.querySelector('input'))
const matchDegree = /** @type {HTMLSelectElement} */ (keyAssist.querySelector('select'))
const keyListen = /** @type {HTMLButtonElement} */ (keyAssist.querySelector('.key-listen'))
const keyResult = /** @type {HTMLOutputElement} */ (keyAssist.querySelector('.key-match-result'))
const moodOrder=[5,3,0,1,2,4,6]
const moodLabels=['6｜哀しげ','4｜切なさ・優しさ','1｜元気・明るい','2','3','5','7']
const moodLabel=document.createElement('label');moodLabel.className='key-match-control mood-control'
moodLabel.innerHTML='雰囲気<span class="volume-knob"><input type="range" min="0" max="6" step="1" value="0" aria-label="雰囲気"><span aria-hidden="true"></span></span><output>6｜哀しげ</output>'
const moodInput=/** @type {HTMLInputElement} */(moodLabel.querySelector('input'))
matchDegree.parentElement?.replaceWith(moodLabel)
moodInput.addEventListener('input',()=>{matchDegree.value=String(moodOrder[Number(moodInput.value)]);matchDegree.dispatchEvent(new Event('change'));applyMatchedKey();stopKeyMatch()})
bindKnobDrag(moodInput,.08)
let matchingKey = false
const inferredKey = () => keyFromDegree(Number(matchRoot.value), Number(matchDegree.value))
function refreshKeyAssist() {
  const moodIndex=Math.max(0,moodOrder.indexOf(Number(matchDegree.value)))
  moodInput.value=String(moodIndex)
  moodInput.parentElement?.style.setProperty('--angle',`${-135+moodIndex/6*270}deg`)
  const moodOutput=moodLabel.querySelector('output')
  if(moodOutput)moodOutput.textContent=moodLabels[moodIndex]
  const pitch = Number(matchRoot.value)
  const output = keyAssist.querySelector('output')
  if (output) output.textContent = keys[pitch].name
  matchRoot.parentElement?.style.setProperty('--angle', `${-135 + pitch / 11 * 270}deg`)
  keyResult.value = `キー ${keys[inferredKey()].name}`
  keyAssist.hidden = !referenceView.filename
}
function stopKeyMatch() { matchingKey = false; referenceTrack.stopKeyPreview(); keyListen.setAttribute('aria-pressed','false'); keyListen.textContent = '▶ 最初の1拍を聴き比べる' }
keyListen.addEventListener('click', () => {
  if (matchingKey) { stopKeyMatch(); return }
  progression.stop(); matchingKey = true; keyListen.setAttribute('aria-pressed','true'); keyListen.textContent = '■ 聴き比べを停止'
  void referenceTrack.previewKey(Number(matchRoot.value)).catch(() => { stopKeyMatch(); keyListen.textContent = '再試行：最初の1拍を聴く' })
})
matchRoot.addEventListener('input', () => { rootGuide.hidden=true; refreshKeyAssist(); applyMatchedKey(); if (matchingKey) referenceTrack.setKeyPreviewRoot(Number(matchRoot.value)) })
matchDegree.addEventListener('change', () => {
  const group = String(Number(matchDegree.value) + 1)
  // Keep a matching progression; otherwise use the catalog's first starting point.
  if (presets.find(item => item.id === selectedPreset.value)?.group !== group) {
    const preset = presets.find(item => item.group === group)
    if (preset) choosePreset(preset.id)
  }
  refreshKeyAssist()
})
bindKnobDrag(matchRoot, .1)
function applyMatchedKey() {
  const key=inferredKey()
  const section=progression.sections[progression.selectedSection]
  if(section.key!==undefined)section.key=key
  keySelect.value=String(key)
  keySelect.dispatchEvent(new Event('change',{bubbles:true}))
  for (const id of ['reference','drum','melody','bass','chord','bell','pluck','phrase','fx']) {
    const button = document.getElementById(id+'-solo')
    const wanted=['reference','drum','melody'].includes(id)
    if(button&&(button.getAttribute('aria-pressed')==='true')!==wanted)button.click()
  }
}
document.addEventListener('reference-loaded', () => { stopKeyMatch(); matchRoot.value = String((Number(keySelect.value) + 9) % 12); matchDegree.value = '5'; matchDegree.dispatchEvent(new Event('change')); refreshKeyAssist() })
document.addEventListener('reference-analysis-ready',()=>{matchRoot.value=String((Number(keySelect.value)+9)%12);refreshKeyAssist()})
document.addEventListener('key-preview-stopped', stopKeyMatch)
document.addEventListener('reference-timing-refresh', stopKeyMatch)
tempo.addEventListener('input', stopKeyMatch)
document.addEventListener('reference-removed', () => { stopKeyMatch(); refreshKeyAssist() })
document.addEventListener('visibilitychange', () => { if(document.hidden) stopKeyMatch() })
refreshKeyAssist()


const melodyTopRow=document.createElement('div')
melodyTopRow.className='melody-top-row'
const melodyLabHost=document.querySelector('.otto-lab-host')
melodyLabHost?.before(melodyTopRow)
melodyTopRow.append(melodyVoiceLabel)
const melodyModeField=melodyLabHost?.querySelector('.otto-play-mode')
if(melodyModeField)melodyTopRow.append(melodyModeField)
const melodyKnobs=document.createElement('div');melodyKnobs.className='melody-context-knobs'
const melodySecondaryRow=document.createElement('div');melodySecondaryRow.className='melody-secondary-row'
melodyTopRow.after(melodySecondaryRow)
const melodyStyleField=melodyLabHost?.querySelector('.otto-style-choice')
if(melodyStyleField)melodySecondaryRow.append(melodyStyleField)
melodyPlayhead=document.createElement('div');melodyPlayhead.className='melody-playhead';melodyPlayhead.innerHTML='<label class="melody-bar-input"><input type="number" min="1" step="1" value="1" aria-label="移動する小節"><span>小節</span></label>';melodyPlayhead.setAttribute('aria-label','現在の再生位置')
const melodyBarInput=/** @type {HTMLInputElement} */ (melodyPlayhead.querySelector('input'))
/** @param {number} target */
function seekMelodyBar(target){
 const running=progression.running
 const bar=Math.max(0,Math.min(progression.barCount()-1,Math.round(target)))
 if(buddyController?.active)buddyController.stop();else if(running)progression.stop()
 resumeMelodyBar=bar;playbackHeads.set(progression.selectedSection,bar);waveformStartBeats.set(progression.selectedSection,0)
 melodyBarInput.value=String(bar+1)
 if(running){if(buddyController?.autoPlay)void buddyController.start(false,bar);else void progression.start(bar,0)}
}
melodyBarInput.addEventListener('focus',()=>{melodyBarInput.max=String(progression.barCount())})
melodyBarInput.addEventListener('change',()=>{const value=Number(melodyBarInput.value);if(melodyBarInput.value.trim() && Number.isFinite(value))seekMelodyBar(value-1);else melodyBarInput.value=String(resumeMelodyBar+1)})
melodyBarInput.addEventListener('keydown',event=>{if(event.key==='Enter')melodyBarInput.blur();if(event.key==='Escape'){melodyBarInput.value=String(resumeMelodyBar+1);melodyBarInput.blur()}})
const melodyNavigation=document.createElement('div');melodyNavigation.className='style-stepper melody-navigation'
for(const direction of [-1,1]){
 const button=document.createElement('button');button.type='button';button.textContent=direction<0?'←':'→';button.setAttribute('aria-label',direction<0?'前の小節へ':'次の小節へ')
 button.addEventListener('click',()=>{
  seekMelodyBar(resumeMelodyBar+direction)
 })
 melodyNavigation.append(button)
}
const miniWave=document.createElementNS('http://www.w3.org/2000/svg','svg')
miniWave.classList.add('melody-live-wave');miniWave.setAttribute('viewBox','0 0 120 50');miniWave.setAttribute('preserveAspectRatio','none');miniWave.setAttribute('aria-hidden','true')
const miniPath=document.createElementNS(miniWave.namespaceURI,'path');miniWave.append(miniPath)
const miniCursor=document.createElementNS(miniWave.namespaceURI,'path');miniCursor.setAttribute('d','M30 0V50');miniCursor.classList.add('mini-cursor');miniWave.append(miniCursor)
melodyPlayhead.append(miniWave,melodyNavigation)
let lastMiniFrame=0,averageEnergy=.08,expressionBar=-1,barEnergy=0,barSamples=0
 document.addEventListener('reference-position',event=>{
 const {playing}=/** @type {CustomEvent<{playing:boolean}>} */(event).detail
 const now=performance.now();if(playing&&now-lastMiniFrame<100)return;lastMiniFrame=now
 const preview=referenceTrack.livePreview();miniPath.setAttribute('d',preview.path)
 const faces=document.querySelectorAll('#buddy-inline .talk-avatar')
 if(!playing){
  expressionBar=-1;barEnergy=0;barSamples=0
  faces.forEach(face=>face.removeAttribute('data-energy-mood'))
  return
 }
 if(melodyExpressionBar>=0 && melodyExpressionBar!==expressionBar){
  if(barSamples){
   const energy=barEnergy/barSamples
   const mood=energy>.09 && energy>averageEnergy*1.2 ? (energy>averageEnergy*1.6?'excited':'happy') : ''
   faces.forEach(face=>{if(mood)face.setAttribute('data-energy-mood',mood);else face.removeAttribute('data-energy-mood')})
   averageEnergy=averageEnergy*.8+energy*.2
  }
  expressionBar=melodyExpressionBar;barEnergy=0;barSamples=0
 }
 barEnergy+=preview.energy;barSamples++
 })
melodySecondaryRow.append(melodyPlayhead,melodyKnobs)
for(const [caption,id] of [['キー','section-mixer-key'],['テンポ','section-tempo']]){
 const label=document.createElement('label');label.className='melody-context-knob';label.textContent=caption
 const knob=document.createElement('span');knob.className='volume-knob'
 const input=document.createElement('input');input.type='range';input.min=caption==='キー'?'-12':'40';input.max=caption==='キー'?'12':'200';input.step='1';input.setAttribute('aria-label',`メロディの${caption}`)
 const face=document.createElement('span');face.setAttribute('aria-hidden','true');knob.append(input,face)
 const output=document.createElement('output');label.append(knob,output);melodyKnobs.append(label)
 input.addEventListener('input',()=>{const target=/** @type {HTMLInputElement|null} */(document.getElementById(id));if(target){target.value=input.value;target.dispatchEvent(new Event('input',{bubbles:true}))}sync()})
 function sync(){const section=progression.sections[editingSection.value],value=caption==='キー'?(section.key??progression.key):(section.bpm??progression.bpm);input.value=String(caption==='キー'&&value>6?value-12:value);output.textContent=caption==='キー'?keys[(value+12)%12].name:String(value);knob.style.setProperty('--angle',`${caption==='キー'?Number(input.value)*11.25:(value-120)*1.6875}deg`)}
 bindKnobDrag(input,caption==='キー'?.12:.6,true)
 document.addEventListener('pointerup',sync);input.addEventListener('focus',sync);queueMicrotask(sync)
}

// Mirror the mixer melody level so solo and manual playing share one volume.
const soloVolumeSource=/** @type {HTMLInputElement} */ (document.getElementById('melody-volume'))
const soloVolumeLabel=document.createElement('label');soloVolumeLabel.className='melody-context-knob';soloVolumeLabel.textContent='ソロ音量'
const soloVolumeKnob=document.createElement('span');soloVolumeKnob.className='volume-knob'
const soloVolumeInput=document.createElement('input');soloVolumeInput.type='range';soloVolumeInput.min='0';soloVolumeInput.max='100';soloVolumeInput.step='1';soloVolumeInput.setAttribute('aria-label','ソロの音量')
const soloVolumeFace=document.createElement('span');soloVolumeFace.setAttribute('aria-hidden','true');soloVolumeKnob.append(soloVolumeInput,soloVolumeFace)
const soloVolumeOutput=document.createElement('output');soloVolumeLabel.append(soloVolumeKnob,soloVolumeOutput);melodyKnobs.append(soloVolumeLabel)
function syncSoloVolume(){soloVolumeInput.value=soloVolumeSource.value;soloVolumeOutput.textContent=`${soloVolumeSource.value}%`;soloVolumeKnob.style.setProperty('--angle',`${-135+Number(soloVolumeSource.value)*2.7}deg`)}
soloVolumeInput.addEventListener('input',()=>{soloVolumeSource.value=soloVolumeInput.value;soloVolumeSource.dispatchEvent(new Event('input',{bubbles:true}))})
soloVolumeSource.addEventListener('input',syncSoloVolume)
soloVolumeInput.addEventListener('focus',syncSoloVolume)
bindKnobDrag(soloVolumeInput,.5,true)
syncSoloVolume()

// Section knobs edit range metadata without changing the song's fallback settings.
const baselineControls=document.createElement('div')
baselineControls.hidden=true
workspace.append(baselineControls)
const sectionKnobs = /** @type {(()=>void)[]} */ ([])
for (const [source, field, caption] of /** @type {[HTMLInputElement, 'key'|'meter'|'bpm', string][]} */ ([[mixerKey,'key','キー'],[meterInput,'meter','拍子'],[tempo,'bpm','テンポ']])) {
  const original=/** @type {HTMLElement} */(source.closest(field==='bpm'?'.timing-control':'.mixer-key, .mixer-meter'))
  const clone=/** @type {HTMLElement} */(original.cloneNode(true))
  clone.querySelectorAll('[id]').forEach(element=>element.id='section-'+element.id)
  clone.querySelectorAll('[for]').forEach(element=>element.setAttribute('for','section-'+element.getAttribute('for')))
  original.before(clone)
  baselineControls.append(original)
  const input=/** @type {HTMLInputElement} */(clone.querySelector('input[type=range]'))
  input.setAttribute('aria-label',`セクションの${caption}`)
  const numeric=/** @type {HTMLInputElement|null} */(clone.querySelector('input[type=number]'))
  if(numeric)numeric.setAttribute('aria-label','セクションのテンポを数値で入力')
  const output=clone.querySelector('output')
  const knob=/** @type {HTMLElement} */(input.parentElement)
  function refresh() {
    const section=progression.sections[editingSection.value]
    const value=section[field] ?? (field==='key'?progression.key:Number(source.value))
    input.value=String(field==='key'&&value>6?value-12:value)
    const text=field==='key'?keys[value].name:field==='meter'?`${value}/4`:String(value)
    if(output)output.textContent=text
    if(numeric)numeric.value=String(value)
    input.setAttribute('aria-valuetext',text)
    knob.style.setProperty('--angle',`${field==='key'?Number(input.value)*11.25:field==='meter'?(value-4)*90:(value-120)*1.6875}deg`)
  }
  input.addEventListener('input',()=>{
    const value=Number(input.value)
    progression.sections[editingSection.value][field]=field==='key'?(value%12+12)%12:value
    sectionContextRevision.value++
    refresh()
    if(field!=='bpm'){backingEditorRevision.value++;refreshLabels()}
  })
  if(numeric)numeric.addEventListener('keydown',event=>{if(event.key==='Enter')numeric.blur();if(event.key==='Escape'){refresh();numeric.blur()}})
  if(numeric)numeric.addEventListener('blur',()=>{
    const value=Number(numeric.value)
    if(Number.isFinite(value)&&value>=40&&value<=200){input.value=String(Math.round(value*10)/10);input.dispatchEvent(new Event('input',{bubbles:true}))}
    else refresh()
  })
  bindKnobDrag(input,field==='bpm'?.6:field==='meter'?.035:.12,true)
  sectionKnobs.push(refresh)
}
refreshSectionKnobs=()=>sectionKnobs.forEach(refresh=>refresh())
refreshSectionKnobs()

for (const control of [tempo,meterInput,keySelect]) control.addEventListener(control===keySelect?'change':'input',()=>{sectionContextRevision.value++;refreshSectionKnobs()})
