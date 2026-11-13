import { encodeScoreMidi } from './score-midi.js'
import { studioPitchRange, resolveDrumPattern, defaultDrumPatterns } from './studio-style.js'
import * as Vue from './vendor/vue.runtime.esm-browser.prod.js'
const {createApp, h, ref, Teleport} = Vue
import { Instrument, audioContext } from './audio.js'
import { DrumSynth, drumPadSound, studioDrumLayout } from './rhythm.js'
import { genres } from './groove.js'
import { midiKey, pianoWhiteLabel } from './keyboard.js'
import { bindTempoKnob } from './main-controls.js'
import { drumPadNames, drumPadState, drumPadPlayable, octaveControl } from './part-steppers.js'
import { scoreNavigation, scorePagination, scoreNote, scoreAccidental, scoreAccidentalGlyph, scoreAccidentalForNote, scoreKeyFifths, scoreKeySignature, scoreKeyedNotes, scoreRhythmGroups, scoreBeamLayout, scoreTrebleTop, scoreStaffStep, scoreStemDown, scoreLedgerOffsets, tutorialStaffLines, tutorialSubdivisions, tutorialPitchSymbol } from './score-navigation.js'

/**
 * @param {HTMLElement} host
 * @param {{empty?:boolean, defaultKeyboardOctaves?:1|2, barCount?:()=>number, previewTimbre?:()=>string, previewDrum?:(id:number)=>void, part?:'bass'|'backing'|'drums', previewBass?:{ready:()=>Promise<AudioContext|undefined>,playAt:(midi:number,time:number)=>void}, keyForBar?:(bar:number)=>number, chordChanges?:(bar:number)=>{beat:number,position:number,label:string}[], togglePlayback?:()=>void, selectBar?:(bar:number, pickup?:boolean, beat?:number)=>void, paginationTarget?:string}} [options]
 */
export function mountMelodyEditor(host, options = {}) {
// [beat, length in beats, MIDI pitch]
const original = [
  [0,1,65],[1,.5,67],[1.5,.5,69],[2,1,72],[3,1,69],
  [4,1,67],[5,.5,69],[5.5,.5,71],[6,1,72],[7,1,71],
  [8,1,67],[9,1,64],[10,.5,67],[10.5,.5,69],[11,1,71],
  [12,1,72],[13,1,67],[14,2,69],
]
const style = genres.find(genre => genre.id === 'vocal_sky')
const bpm = ref(style?.bpm ?? 128)
const isBass = options.part === 'bass'
const isDrums = options.part === 'drums'
const isBacking = options.part === 'backing'
const isAccompaniment = isDrums || isBacking
const partLabel = {bass:'ベース', melody:'メロディ', backing:'バッキング', drums:'ドラム'}[options.part ?? 'melody']
const baseOctave = isBass ? 3 : 4
const minOctaveOffset = isBass ? -2 : -1
const {min: minMidi, max: maxMidi} = studioPitchRange[options.part ?? 'melody']
const octave = ref(baseOctave + (isBass ? -1 : 0))
const keyboardOctaves = ref(/** @type {number} */ (options.defaultKeyboardOctaves ?? 1))
const scorePage = ref(0)
const drumBar = ref(0)
const selectedDrumBoundary = ref(/** @type {number|null} */ (null))
const drumPatternIndex = ref(0)
const drumZeroSelected = ref(false)
const drumAssignments = ref(/** @type {number[]} */ ([]))
const drumPatterns = ref(isDrums ? defaultDrumPatterns() : /** @type {({beat:number,duration:number,midi:number}[]|null)[]} */ ([null,null,null,null]))
const clefs = [
  {label:'ト音記号', bass:false, octave:false, stepOffset:0},
  {label:'ト音記号 8va', bass:false, octave:true, stepOffset:-7},
  {label:'ヘ音記号', bass:true, octave:false, stepOffset:12},
  {label:'ヘ音記号 8vb', bass:true, octave:true, stepOffset:19},
]
const clefIndex = ref(isBass ? 2 : 0)
const totalBars = () => Math.max(4, options.barCount?.() ?? 4)
const totalBeats = () => totalBars() * 4
const chords = [[53,57,60,64],[55,59,62],[52,55,59],[57,60,64]]
const lead = new Instrument('melody')
const backing = new Instrument('chord')
const bass = new Instrument('bass')
const preview = new Instrument('melody')
const drums = new DrumSynth(backing)
lead.timbre = preview.timbre = style?.melody ?? 'lead-round'
backing.timbre = style?.chord ?? 'supersaw'
drums.timbre = style?.drum ?? 'electronic'
bass.timbre = 'lead-bass-round'
lead.setVolume(.75)
backing.setVolume(.23)
bass.setVolume(.45)
drums.setVolume(.23)

if (options.empty) original.length = 0
const notes = ref(original.map(([beat, length, midi]) => ({beat, length, midi})))
const selected = ref(-1)
const showNoteBars = ref(true)
const selection = ref(/** @type {number[]} */ ([]))
const selectionBox = ref(/** @type {{left:number,top:number,right:number,bottom:number}|null} */ (null))
/** @type {{pointer:number,x:number,y:number}|null} */
let selectionStart = null

/** @param {number} index */
function selectNote(index) {
  selected.value = index
  selection.value = []
}

/** @param {PointerEvent} event */
function startSelection(event) {
  if (!event.isPrimary || event.button !== 0 || event.pointerType !== 'mouse' ||
      !matchMedia('(min-width: 701px)').matches || !(event.target instanceof Element) ||
      !event.target.closest('.arrange-staff') ||
      event.target.closest('button:not(.arrange-beat)')) return
  selectionStart = {pointer:event.pointerId, x:event.clientX, y:event.clientY}
}

/** @param {PointerEvent} event */
function moveSelection(event) {
  const start = selectionStart
  const score = event.currentTarget
  if (!start || start.pointer !== event.pointerId || !(score instanceof HTMLElement)) return
  if (!selectionBox.value) {
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) < 5) return
    score.setPointerCapture(event.pointerId)
    score.focus({preventScroll:true})
  }
  selectionBox.value = {
    left:Math.min(start.x,event.clientX), right:Math.max(start.x,event.clientX),
    top:Math.min(start.y,event.clientY), bottom:Math.max(start.y,event.clientY),
  }
}

/** @param {PointerEvent} event */
function finishSelection(event) {
  if (selectionStart?.pointer !== event.pointerId) return
  const box = selectionBox.value
  cancelSelection()
  if (!box || event.type !== 'pointerup') return
  const indices = new Set()
  for (const head of Array.from(host.querySelectorAll('.arrange-note[data-note-index] .tutorial-note-symbol ellipse'))) {
    const {left,right,top,bottom} = head.getBoundingClientRect()
    if (right >= box.left && left <= box.right && bottom >= box.top && top <= box.bottom) {
      indices.add(Number(head.closest('.arrange-note')?.getAttribute('data-note-index')))
    }
  }
  stepCursor.value = null
  selectNote(-1)
  selection.value = [...indices]
}

/** @param {PointerEvent} [event] */
function cancelSelection(event) {
  if (event && selectionStart?.pointer !== event.pointerId) return
  selectionStart = null
  selectionBox.value = null
}

/** @param {number} delta */
function canTransposeSelection(delta) {
  return selection.value.length > 0 && selection.value.every(index => {
    const midi = notes.value[index].midi + delta
    return midi >= minMidi && midi <= maxMidi
  })
}

/** @param {number} delta */
function transposeSelection(delta) {
  if (!canTransposeSelection(delta)) return
  remember()
  for (const index of selection.value) notes.value[index].midi += delta
}
const stepCursor = ref(/** @type {number|null} */ (options.empty ? 0 : null))
const stepDuration = ref(.5)
const inputEnabled = ref(true)
const playbackStart = ref(0)
const pickupStart = -4
const playing = ref(false)
const loading = ref(false)
const error = ref('')
const position = ref(-Infinity)
/** @type {{bar:number, beat:number, time:number, secondsPerBeat:number, meter:number}[]} */
const scheduledBars = []
let playbackFrame = 0
/** @type {AudioContext | null} */
let playbackContext = null
function updatePlaybackPosition() {
  if (!playbackContext || !scheduledBars.length) { playbackFrame = 0; return }
  const now = playbackContext.currentTime
  while (scheduledBars.length > 1 && scheduledBars[1].time <= now) scheduledBars.shift()
  const current = scheduledBars[0]
  if (now >= current.time) {
    const beat = current.beat + (now - current.time) / current.secondsPerBeat
    position.value = current.bar < 0 ? -4 + Math.min(beat / current.meter, .999999) * 4 : current.bar * 4 + Math.min(beat / current.meter, 0.999999) * 4
    scorePage.value = current.bar < 0 ? -1 : Math.floor(current.bar / 4)
    if (isDrums) { drumZeroSelected.value = current.bar < 0; if (current.bar >= 0) { drumBar.value = current.bar; drumPatternIndex.value = drumAssignments.value[current.bar] ?? 0 } }
  }
  playbackFrame = requestAnimationFrame(updatePlaybackPosition)
}
function stopPlaybackPosition() {
  cancelAnimationFrame(playbackFrame)
  playbackFrame = 0
  playbackContext = null
  scheduledBars.length = 0
  position.value = -Infinity
}
/** @typedef {{notes:{beat:number,length:number,midi:number}[],cursor:number|null,page:number,patterns:({beat:number,duration:number,midi:number}[]|null)[]}} EditSnapshot */
const history = ref(/** @type {EditSnapshot[]} */ ([]))
const redoHistory = /** @type {EditSnapshot[]} */ ([])

function exportMidi() {
  const bytes = encodeScoreMidi(notes.value, bpm.value, -pickupStart)
  const url = URL.createObjectURL(new Blob([bytes],{type:'audio/midi'}))
  const link = document.createElement('a')
  link.href = url
  link.download = 'oto-melody.mid'
  link.click()
  setTimeout(()=>URL.revokeObjectURL(url),1000)
}

function captureEdit() {
  return {
    notes:notes.value.map(note => ({...note})),
    cursor:stepCursor.value,
    page:scorePage.value,
    patterns:drumPatterns.value.map(pattern => pattern?.map(note => ({...note})) ?? null),
  }
}

function remember() {
  history.value.push(captureEdit())
  if (history.value.length > 100) history.value.shift()
  redoHistory.length = 0
}

/** @param {EditSnapshot} snapshot */
function restoreEdit(snapshot) {
  notes.value = snapshot.notes
  drumPatterns.value = snapshot.patterns
  stepCursor.value = snapshot.cursor
  scorePage.value = snapshot.page
  if (isDrums && snapshot.cursor !== null) drumBar.value = Math.floor(snapshot.cursor / 4)
  if (snapshot.cursor !== null && snapshot.cursor < 0) options.selectBar?.(0, true)
  selectNote(-1)
}

function undo() {
  const previous = history.value.pop()
  if (!previous) return
  redoHistory.push(captureEdit())
  restoreEdit(previous)
}

function undoLabel() {
  return [h('svg', {class:'arrange-undo-icon', viewBox:'0 0 24 24', 'aria-hidden':'true'}, [
    h('path', {d:'M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-2', fill:'none', stroke:'currentColor', 'stroke-width':2, 'stroke-linecap':'round', 'stroke-linejoin':'round'}),
  ]), 'やり直し']
}

function pageBounds() {
  return scorePage.value < 0 ? [pickupStart, 0] : [scorePage.value * 16, (scorePage.value + 1) * 16]
}

function clearPage() {
  const [start, end] = pageBounds()
  if (!notes.value.some(note => note.beat < end && note.beat + note.length > start)) return
  remember()
  notes.value = notes.value.flatMap(note => {
    const noteEnd = note.beat + note.length
    if (note.beat >= end || noteEnd <= start) return [note]
    return [
      ...(note.beat < start ? [{...note, length:start - note.beat}] : []),
      ...(noteEnd > end ? [{...note, beat:end, length:noteEnd - end}] : []),
    ]
  })
  selectNote(-1)
}

function redo() {
  const next = redoHistory.pop()
  if (!next) return
  history.value.push(captureEdit())
  restoreEdit(next)
}

/** @param {Event} event */
function changeTempo(event) {
  const input = /** @type {HTMLInputElement} */ (event.target)
  const next = Number(input.value)
  if (next === bpm.value) return
  const wasPlaying = playing.value || loading.value
  const currentBeat = Number.isFinite(position.value) ? Math.floor(position.value * 8) / 8 : playbackStart.value
  if (wasPlaying) stop()
  bpm.value = next
  if (wasPlaying) { playbackStart.value = currentBeat; void play() }
}
let timer = 0
let generation = 0
let previewGeneration = 0

function stop() {
  generation++
  previewGeneration++
  clearInterval(timer)
  playing.value = loading.value = false
  position.value = -Infinity
  lead.silence()
  backing.silence()
  bass.silence()
  preview.silence()
  drums.silence()
}

async function play() {
  if (options.togglePlayback) { options.togglePlayback(); return }
  if (playing.value || loading.value) { stop(); return }
  const request = ++generation
  loading.value = true
  error.value = ''
  try {
    await Promise.all([lead.ready(), backing.ready(), bass.ready()])
    if (request !== generation || !lead.context) return
    const context = lead.context
    const origin = context.currentTime + .06
    const initialBeat = playbackStart.value === 0 && notes.value.some(note => note.beat < 0)
      ? pickupStart : playbackStart.value
    const beatSeconds = 60 / bpm.value
    let step = 0
    playing.value = true
    const tick = () => {
      const now = context.currentTime
      position.value = now >= origin ? (initialBeat + (now - origin) / beatSeconds) % totalBeats() : -Infinity
      step = Math.max(step, Math.ceil((now - origin - .04) * 8 / beatSeconds))
      while (origin + step * beatSeconds / 8 < now + .1) {
        const beat = (initialBeat + step / 8) % totalBeats()
        const time = origin + step * beatSeconds / 8
        const chord = chords[Math.floor(beat / 4) % chords.length]
        if (beat >= 0 && Number.isInteger(beat)) {
          drums.hitAt('kick', time, .65)
          if (beat % 2 === 1) drums.hitAt('snare', time, .45)
        } else if (beat % 1 === .5) {
          drums.hitAt('hat', time, .32)
          backing.playAt(chord, time, beatSeconds * .38)
          bass.playAt([chord[0]], time, beatSeconds * .43)
        }
        const note = notes.value.find(note => note.beat === beat)
        if (note) lead.playAt([note.midi], time, beatSeconds * note.length * .9)
        step++
      }
    }
    tick()
    timer = window.setInterval(tick, 25)
  } catch {
    if (request === generation) {
      stop()
      error.value = '音声を開始できませんでした。もう一度お試しください。'
    }
  } finally {
    if (request === generation) loading.value = false
  }
}

/** @param {number} midi @param {boolean} held */
function setPitchHeld(midi, held) {
  heldPitches.value = held ? [...new Set([...heldPitches.value, midi])] : heldPitches.value.filter(pitch => pitch !== midi)
}

/** @param {number} midi */
function choosePitch(midi) {
  if (midi < minMidi || midi > maxMidi) return
  const index = selected.value
  if (inputEnabled.value && stepCursor.value !== null) writeStep([midi])
  else if (inputEnabled.value && index >= 0 && notes.value[index].midi !== midi) {
    if (!drag) remember()
    notes.value[index].midi = midi
  }
  const request = ++previewGeneration
  const ready = options.previewBass
    ? options.previewBass.ready()
    : preview.ready().then(() => preview.context)
  void ready.then(context => {
    if (request !== previewGeneration || !context) return
    const time = context.currentTime + .01
    if (options.previewBass) {
      options.previewBass.playAt(midi, time)
      return
    }
    if (options.previewTimbre) preview.setTimbre(options.previewTimbre())
    preview.playAt([midi], time, .24)
  }).catch(() => {
    if (request === previewGeneration) error.value = '鍵盤の音を再生できませんでした。'
  })
}

function reset() {
  remember()
  notes.value = original.map(([beat, length, midi]) => ({beat, length, midi}))
  selectNote(-1)
  stepCursor.value = options.empty ? 0 : null
  playbackStart.value = 0
}

function deleteSelectedNote() {
  if (selected.value < 0 && !selection.value.length) return
  remember()
  const indices = new Set(selection.value.length ? selection.value : [selected.value])
  notes.value = notes.value.filter((_, index) => !indices.has(index))
  selectNote(-1)
}

/** @param {readonly number[]} pitches */
function writeStep(pitches) {
  if (stepCursor.value === null || stepCursor.value >= totalBeats()) return false
  remember()
  const start = stepCursor.value
  const end = Math.min(totalBeats(), start + stepDuration.value)
  const updated = []
  for (const note of notes.value) {
    const noteEnd = note.beat + note.length
    if ((isDrums && pitches.length && !pitches.includes(note.midi)) || noteEnd <= start || note.beat >= end) {
      updated.push(note)
      continue
    }
    if (note.beat < start) updated.push({...note, length:start - note.beat})
    if (noteEnd > end) updated.push({...note, beat:end, length:noteEnd - end})
  }
  for (const midi of new Set(pitches)) updated.push({beat:start, length:end - start, midi})
  notes.value = updated.sort((a,b) => a.beat - b.beat)
  selectNote(-1)
  stepCursor.value = end
  if (isDrums && end < totalBeats()) drumBar.value = Math.floor(end / 4)
  if (end >= 0 && end < totalBeats() && Math.floor(Math.max(0, start) / 16) !== Math.floor(end / 16)) {
    scorePage.value = Math.floor(end / 16)
  }
  return true
}

function extensionTarget() {
  if (!inputEnabled.value || stepCursor.value === null) return null
  const cursor = stepCursor.value
  const index = notes.value.findIndex(note => Math.abs(note.beat + note.length - cursor) < 1e-7)
  if (index < 0 || cursor + stepDuration.value > totalBeats()) return null
  const indices = isBacking ? notes.value.flatMap((note, i) => Math.abs(note.beat - notes.value[index].beat) < 1e-7 && Math.abs(note.beat + note.length - cursor) < 1e-7 ? [i] : []) : [index]
  const next = notes.value.reduce((earliest, note, other) => {
    if (indices.includes(other) || note.beat + note.length <= cursor) return earliest
    return Math.min(earliest, Math.max(cursor, note.beat))
  }, totalBeats())
  const end = Math.min(cursor + stepDuration.value, next)
  return end > cursor + 1e-7 ? {indices, end} : null
}

function extendPreviousNote() {
  const target = extensionTarget()
  if (!target || stepCursor.value === null) return
  remember()
  for (const index of target.indices) notes.value[index].length += target.end - stepCursor.value
  stepCursor.value = target.end
  if (target.end < totalBeats()) scorePage.value = Math.floor(Math.max(0, target.end) / 16)
}

/** @param {number} beat */
function setStepCursor(beat) {
  selectNote(-1)
  stepCursor.value = beat
  if (isDrums && beat >= 0) drumBar.value = Math.floor(beat / 4)
  playbackStart.value = beat
  if (playing.value || loading.value) {
    stop()
    void play()
  }
}

/** @param {number} index */
function timingBounds(index) {
  if (isAccompaniment) {
    const note = notes.value[index]
    const peers = isDrums ? notes.value.filter(other => other.midi === note.midi) : notes.value
    return {
      earliest: peers.filter(other => other.beat < note.beat).reduce((end, other) => Math.max(end, other.beat + other.length), pickupStart),
      latest: peers.filter(other => other.beat > note.beat).reduce((start, other) => Math.min(start, other.beat), totalBeats()),
    }
  }
  const previous = notes.value[index - 1]
  return {
    earliest: previous ? previous.beat + previous.length : pickupStart,
    latest: notes.value[index + 1]?.beat ?? totalBeats(),
  }
}

/** @param {number} duration */
function canSetDuration(duration) {
  const index = selected.value
  return index < 0 || notes.value[index].beat + duration <= timingBounds(index).latest
}

async function playRestClick() {
  const request = ++previewGeneration
  try {
    const context = audioContext()
    if (context.state !== 'running') await context.resume()
    if (request !== previewGeneration || context.state !== 'running') return
    const time = context.currentTime
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.value = 850
    gain.gain.setValueAtTime(.07, time)
    gain.gain.exponentialRampToValueAtTime(.001, time + .035)
    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect() }
    oscillator.start(time)
    oscillator.stop(time + .04)
  } catch {
    // Audio can be unavailable while the score remains editable.
  }
}

/** @param {number} duration @param {boolean} rest */
function useDuration(duration, rest) {
  if (rest) {
    if (!inputEnabled.value || stepCursor.value === null || stepCursor.value >= totalBeats()) return
    stepDuration.value = duration
    writeStep([])
    void playRestClick()
    return
  }
  if (!canSetDuration(duration)) return
  const note = notes.value[selected.value]
  if (note && note.length !== duration) {
    remember()
    note.length = duration
  }
  stepDuration.value = duration
}

/** @type {{pointer:number,index:number,x:number,y:number,width:number,beats:number,beat:number,length:number,midi:number,originRow:number,sharedEnd:number|null,group:{index:number,midi:number}[],changed:boolean,axis:'length'|'time'|'pitch'|null}|null} */
let drag = null
const heldPitches = ref(/** @type {number[]} */ ([]))
const dragPitch = ref(/** @type {number|null} */ (null))

/** @param {PointerEvent} event @param {number} index @param {'length'|'pitch'|null} axis */
function startDrag(event, index, axis) {
  if (drag || !event.isPrimary || event.button !== 0 || !(event.currentTarget instanceof HTMLElement)) return
  const track = event.currentTarget.closest('.arrange-staff')
  const width = track?.getBoundingClientRect().width
  if (!width) return
  event.currentTarget.setPointerCapture(event.pointerId)
  window.addEventListener('pointermove', moveDrag)
  window.addEventListener('pointerup', endDrag)
  window.addEventListener('pointercancel', endDrag)
  stepCursor.value = null
  const {beat, length, midi} = notes.value[index]
  const originRow = Array.from(host.querySelectorAll('.arrange-staff')).indexOf(/** @type {Element} */ (track))
  const group = !isDrums && axis === null && event.pointerType === 'mouse' && selection.value.length > 1 && selection.value.includes(index)
    ? selection.value.map(index => ({index, midi:notes.value[index].midi}))
    : []
  drag = {pointer:event.pointerId, index, x:event.clientX, y:event.clientY, width, beats:beat < 0 ? 1 : 8, beat, length, midi, originRow,
    changed:false, sharedEnd: axis === 'length' ? sharedBoundaryEnd(index) : null, group, axis}
  if (!group.length) selectNote(index)
}

/** @param {number} index */
function sharedBoundaryEnd(index) {
  if (isAccompaniment) return null
  const note = notes.value[index]
  const next = notes.value[index + 1]
  const barEnd = (Math.floor(note.beat / 4) + 1) * 4
  return next && next.beat < barEnd && next.beat === note.beat + note.length ? next.beat + next.length : null
}

/** @param {number} index @param {number} end @param {number|null} sharedEnd @param {number} originalBoundary */
function moveBoundary(index, end, sharedEnd, originalBoundary) {
  const note = notes.value[index]
  const limit = sharedEnd === null ? timingBounds(index).latest : sharedEnd - .125
  const boundary = Math.max(note.beat + .125, Math.min(limit, end))
  note.length = boundary - note.beat
  if (sharedEnd !== null) {
    const next = notes.value[index + 1]
    next.beat = Math.max(originalBoundary, boundary)
    next.length = sharedEnd - next.beat
  }
}

/** @param {PointerEvent} event */
function moveDrag(event) {
  if (!drag || drag.pointer !== event.pointerId) return
  const {index, x, y, width, beats, beat, length, midi} = drag
  const dx = event.clientX - x
  const dy = event.clientY - y
  if (drag.group.length) {
    const pitches = drag.group.map(note => note.midi)
    const delta = Math.max(minMidi - Math.min(...pitches), Math.min(maxMidi - Math.max(...pitches), Math.round(-dy / 20)))
    if (drag.group.every(({index,midi}) => notes.value[index].midi === midi + delta)) return
    if (!drag.changed) { remember(); drag.changed = true }
    for (const {index,midi} of drag.group) notes.value[index].midi = midi + delta
    return
  }
  if (!drag.axis) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 8) return
    drag.axis = Math.abs(dy) > Math.abs(dx) ? 'pitch' : 'time'
  }
  if (isDrums && drag.axis === 'pitch') return
  if (!drag.changed) { remember(); drag.changed = true }
  if (drag.axis === 'pitch') {
    const nextPitch = Math.max(minMidi, Math.min(maxMidi, midi - Math.round(dy / 20)))
    if (notes.value[index].midi !== nextPitch) {
      dragPitch.value = nextPitch
      choosePitch(nextPitch)
    }
    return
  }
  const staffs = Array.from(host.querySelectorAll('.arrange-staff'))
  const targetRow = staffs.findIndex(staff => {
    const rect = staff.getBoundingClientRect()
    return event.clientY >= rect.top && event.clientY <= rect.bottom
  })
  const rowOffset = drag.axis === 'time' && targetRow >= 0 ? Number(staffs[targetRow].getAttribute('data-start-beat')) - Number(staffs[drag.originRow]?.getAttribute('data-start-beat')) : 0
  const delta = Math.round((dx * beats / width + rowOffset) * 8) / 8
  const {earliest, latest} = timingBounds(index)
  const note = notes.value[index]
  if (drag.axis === 'length') moveBoundary(index, beat + length + delta, drag.sharedEnd, beat + length)
  else note.beat = Math.max(earliest, Math.min(latest - length, beat + delta))
}

/** @param {PointerEvent} event */
function endDrag(event) {
  if (drag?.pointer === event.pointerId) {
    drag = null
    dragPitch.value = null
    window.removeEventListener('pointermove', moveDrag)
    window.removeEventListener('pointerup', endDrag)
    window.removeEventListener('pointercancel', endDrag)
  }
}

/** @param {number} index @param {'length'|'pitch'|null} axis */
function dragEvents(index, axis) {
  return {
    onPointerdown:(/** @type {PointerEvent} */ event)=>startDrag(event, index, axis),
  }
}

/** @param {number} midi */
const noteName = midi => isDrums ? (drumPadNames.value[midi] ?? drumPadSound(midi)[0]) : ((midi % 12 === 3 || midi % 12 === 10) ? pianoWhiteLabel(midi + 1) + '♭' : pianoWhiteLabel(midi) || pianoWhiteLabel(midi - 1) + '♯') + Math.floor(midi / 12 - 1)

const noteKeys = 'QWERTYU'
const restKeys = 'ASDFGHJ'
const durations = [[.25,'16分'],[.5,'8分'],[.75,'付点8分'],[1,'4分'],[1.5,'付点4分'],[2,'2分']]

/** @param {number} duration */
function noteIcon(duration) {
  return h('svg', {class:'arrange-rhythm-icon', viewBox:'0 0 24 32', 'aria-hidden':'true'}, [
    h('ellipse', {cx:8,cy:25,rx:5,ry:3.2,transform:'rotate(-22 8 25)',stroke:'currentColor','stroke-width':1.5,fill:duration === 2 ? 'none' : 'currentColor'}),
    h('path', {d:'M12.5 25V3',fill:'none',stroke:'currentColor','stroke-width':1.8}),
    duration <= .75 ? h('path',{d:'M12.5 3c1 3 7 4 5 10',fill:'none',stroke:'currentColor','stroke-width':1.8,'stroke-linecap':'round'}) : null,
    duration <= .375 ? h('path',{d:'M12.5 8c1 3 7 4 5 10',fill:'none',stroke:'currentColor','stroke-width':1.8,'stroke-linecap':'round'}) : null,
    [.375,.75,1.5].includes(duration) ? h('circle',{cx:19,cy:25,r:1.5,fill:'currentColor'}) : null,
  ])
}

/** @param {number} duration */
function restIcon(duration) {
  const base = duration === 1.5 ? 1 : duration === .75 ? .5 : duration === .375 ? .25 : duration
  const shape = base === 2
    ? h('rect', {x:5,y:12,width:14,height:5,fill:'currentColor'})
    : base === 1
      ? h('path', {d:'M8 2l9 9-5 7 5 6c-3-1.5-6-.4-6 2.2 0 1.5 1 2.9 2.7 4.4-4.7-1.2-6.8-3.9-6-6.6.5-1.6 1.9-2.5 3.6-2.7L7 16l5-7z',fill:'currentColor'})
      : [
        h('path', {d:'M17 6h1.5L11 29H9.5z M17 8c-2 4-7 7-11 4l1-1c4 1 7-1 10-5z',fill:'currentColor'}),
        h('circle', {cx:6.5,cy:9.5,r:2.6,fill:'currentColor'}),
        base === .25 ? h('path', {d:'M14 15c-2 4-7 7-11 4l1-1c4 1 7-1 10-5z M6 16.5a2.6 2.6 0 1 1-5.2 0 2.6 2.6 0 0 1 5.2 0',fill:'currentColor'}) : null,
      ]
  return h('svg', {class:'arrange-rhythm-icon',viewBox:'0 0 24 32','aria-hidden':'true'}, [shape, [.375,.75,1.5].includes(duration) ? h('circle',{cx:20,cy:16,r:1.5,fill:'currentColor'}) : null])
}

/** @param {number} bar */
function selectDrumBar(bar) {
  const earliest = -1
  const next = Math.max(earliest, Math.min(totalBars() - 1, bar))
  setStepCursor(next < 0 ? pickupStart : next * 4)
  if (next >= 0) drumPatternIndex.value = drumAssignments.value[next] ?? 0
}

/** @param {number} bar */
function drumViewNotes(bar) {
  if (bar < 0) return notes.value
  const pattern = resolveDrumPattern(drumPatterns.value, drumPatternIndex.value)
  if (pattern) return pattern.map(note => ({beat:bar * 4 + note.beat, length:note.duration, midi:note.midi}))
  return notes.value
}

/** @param {number} bar @param {{beat:number,length:number,midi:number}[]} edited */
function setDrumViewNotes(bar, edited) {
  if (bar < 0) { notes.value = edited; return }
  const start = bar * 4
  drumPatterns.value[drumPatternIndex.value] = edited.filter(note => note.beat >= start && note.beat < start + 4)
    .map(note => ({beat:note.beat - start, duration:Math.min(note.length, start + 4 - note.beat), midi:note.midi}))
}

/** @param {number} id @param {number} beat @param {number} bar */
function toggleDrumStep(id, beat, bar) {
  const current = drumViewNotes(bar)
  const matches = current.filter(note => note.midi === id && Math.abs(note.beat - beat) < 1e-7)
  remember()
  if (matches.length) {
    setDrumViewNotes(bar, current.filter(note => !matches.includes(note)))
  } else {
    setDrumViewNotes(bar, [...current, {beat, length:.25, midi:id}].sort((a,b) => a.beat - b.beat))
    if (drumPadPlayable(id)) options.previewDrum?.(id)
  }
  setStepCursor(beat)
}

/** @type {{pointerId:number, id:number, step:number, bar:number, add:boolean}|undefined} */
let drumStroke

/** @param {EventTarget|null} target @param {HTMLElement} grid */
function drumStrokeCell(target, grid) {
  const cell = target instanceof Element ? target.closest('button.drum-step[data-pad-index][data-step]') : null
  if (!(cell instanceof HTMLElement) || cell.hasAttribute('disabled') || !grid.contains(cell)) return
  return {id:Number(cell.dataset.padIndex), step:Number(cell.dataset.step)}
}

/** @param {number} id @param {number} first @param {number} last */
function paintDrumStroke(id, first, last) {
  if (!drumStroke) return
  const next = [...drumViewNotes(drumStroke.bar)]
  for (let step = Math.min(first,last); step <= Math.max(first,last); step++) {
    const beat = drumStroke.bar * 4 + step / 4
    if (beat < pickupStart) continue
    const matches = next.filter(note => note.midi === id && Math.abs(note.beat - beat) < 1e-7)
    if (drumStroke.add && !matches.length) {
      next.push({beat, length:.25, midi:id})
      if (drumPadPlayable(id)) options.previewDrum?.(id)
    } else if (!drumStroke.add && matches.length) {
      for (const note of matches) next.splice(next.indexOf(note), 1)
    }
  }
  setDrumViewNotes(drumStroke.bar, next.sort((a,b)=>a.beat-b.beat))
  setStepCursor(drumStroke.bar * 4 + last / 4)
}

/** @param {PointerEvent} event */
function startDrumStroke(event) {
  if (drumStroke || !event.isPrimary || event.button !== 0) return
  const grid = /** @type {HTMLElement} */ (event.currentTarget)
  const cell = drumStrokeCell(event.target, grid)
  if (!cell) return
  const bar = Number(grid.dataset.bar)
  const beat = bar * 4 + cell.step / 4
  const add = !drumViewNotes(bar).some(note => note.midi === cell.id && Math.abs(note.beat - beat) < 1e-7)
  remember()
  drumStroke = {pointerId:event.pointerId, bar, add, ...cell}
  grid.setPointerCapture(event.pointerId)
  event.preventDefault()
  paintDrumStroke(cell.id, cell.step, cell.step)
}

/** @param {PointerEvent} event */
function moveDrumStroke(event) {
  if (!drumStroke || drumStroke.pointerId !== event.pointerId) return
  const grid = /** @type {HTMLElement} */ (event.currentTarget)
  const cell = drumStrokeCell(document.elementFromPoint(event.clientX, event.clientY), grid)
  if (!cell) return
  paintDrumStroke(cell.id, cell.id === drumStroke.id ? drumStroke.step : cell.step, cell.step)
  Object.assign(drumStroke, cell)
}

/** @param {PointerEvent} event */
function endDrumStroke(event) {
  if (drumStroke?.pointerId === event.pointerId) drumStroke = undefined
}

/** @param {{id:number,name:string}} pad */
function drumRowName(pad) {
  const name = drumPadNames.value[pad.id] ?? pad.name
  if (/ハイハット|クローズHH|オープンHH|hi[ -]?hat|\bHH\b/i.test(name)) {
    if (/オープン|open|\bOP\b/i.test(name) || pad.id === 3) return 'OP HH'
    return 'CL HH'
  }
  /** @type {Record<string,string>} */
  const names = {'キック':'KICK', 'スネア':'SNARE', 'クラップ':'CLAP', 'パーカッション':'PERC',
    'ブロック':'BLOCK', 'クラッシュ':'CRASH', 'ハイタム':'HI TOM', 'フロアタム':'FLOOR TOM', 'ライド':'RIDE'}
  return names[name] ?? (/^[a-z0-9 _-]+$/i.test(name) ? name.toUpperCase() : `FLEX ${pad.id + 1}`)
}

/** @param {number} bar */
function drumGrid(bar) {
  const start = bar * 4
  const viewNotes = drumViewNotes(bar)
  const offGrid = viewNotes.filter(note => note.beat >= start && note.beat < start + 4 &&
    Math.abs(note.beat * 4 - Math.round(note.beat * 4)) > 1e-7).length
  return [
    offGrid ? h('p', {class:'arrange-drum-offgrid', role:'status'}, `16分の位置以外に${offGrid}音あります。`) : null,
    h('div', {class:['drum-sequencer arrange-drum-grid', {'arrange-drum-pickup':bar < 0}], 'data-bar':bar, role:'group', 'aria-label':bar < 0 ? '0小節目の16ステップ' : `${bar + 1}小節目の16ステップ`,
      onPointerdown:startDrumStroke, onPointermove:moveDrumStroke, onPointerup:endDrumStroke, onPointercancel:endDrumStroke, onLostpointercapture:endDrumStroke}, [
      ...[...studioDrumLayout.slice(4), ...studioDrumLayout.slice(0, 4)].reverse().flatMap(pad => [
        h('button', {type:'button', class:'drum-row-label arrange-drum-name', 'data-loading':drumPadState.value.status === 'loading' ? '' : undefined,
          'aria-label':`${drumRowName(pad)}を試聴${drumPadState.value.status === 'loading' ? '（ロード中）' : drumPadState.value.status === 'error' ? '（読込失敗）' : !drumPadPlayable(pad.id) ? '（未設定）' : ''}`,
          title:drumRowName(pad), disabled:!options.previewDrum || !drumPadPlayable(pad.id),
          onClick:()=>options.previewDrum?.(pad.id)}, drumRowName(pad)),
        ...Array.from({length:16}, (_, step) => {
          const beat = start + step / 4
          const on = viewNotes.some(note => note.midi === pad.id && Math.abs(note.beat - beat) < 1e-7)
          const current = Number.isFinite(position.value) && position.value >= start && position.value < start + 4 &&
            Math.floor((position.value - start) * 4) === step
          return h('button', {
            type:'button', class:['drum-step', {'beat-start':step % 4 === 0, playing:current}],
            'data-step':step, 'data-pad-index':pad.id,
            'aria-label':`${drumRowName(pad)}、${bar < 0 ? '0小節目' : `${bar + 1}小節目`}、${(Math.floor(step / 4) + 1)}拍目の${step % 4 + 1}ステップ`,
            'aria-pressed':on, disabled:beat < pickupStart,
            onClick:(/** @type {MouseEvent} */ event)=>{ if (event.detail === 0) toggleDrumStep(pad.id, beat, bar) },
          })
        }),
      ]),
    ]),
  ]
}

function drumNavigation() {
  const bar = Math.max(0, Math.min(totalBars() - 1, drumBar.value))
  const pagination = scorePagination({
    page:Math.floor(Math.max(0,bar) / 8), pageSize:8, totalBars:totalBars(), label:'ドラムのページ', leadingLabel:'page',
    onPageChange:page=>selectDrumBar(page * 8),
  })
  return h('section', {class:'tutorial-navigation arrange-drum-navigation', 'aria-label':'ドラムのステップシーケンサー'}, [
    options.paginationTarget ? h(Teleport, {to:options.paginationTarget}, pagination) : h('div', {class:'arrange-drum-pagination'}, [pagination]),
    h('div', {class:'arrange-drum-header', 'aria-label':'小節バー'}, [
      h('div', {class:'arrange-drum-bars', role:'group', 'aria-label':'小節ごとのパターン'},
        Array.from({length:Math.min(8, totalBars() - Math.floor(Math.max(0,bar) / 8) * 8)}, (_, index) => {
          const target = Math.floor(Math.max(0,bar) / 8) * 8 + index
          const pattern = drumAssignments.value[target] ?? 0
          const sounding = Number.isFinite(position.value) && Math.floor(position.value / 4) === target
          return h('div', {class:['arrange-drum-bar', {playing:sounding}], key:target}, [
            h('button', {type:'button', class:'arrange-drum-boundary', 'aria-label':`${target + 1}小節目から再生`, 'aria-pressed':selectedDrumBoundary.value === target,
              onClick:()=>{selectedDrumBoundary.value = target; selectDrumBar(target); options.selectBar?.(target)}}, h('span', {'aria-hidden':'true'})),
            h('label', {class:'arrange-drum-choice'}, [
              h('span', {class:'arrange-drum-bar-number', 'aria-hidden':'true'}, String(target + 1)),
              h('span', {class:'arrange-drum-pattern-label', 'aria-hidden':'true'}, [h('span', {class:'arrange-drum-pattern-prefix'}, 'Ptn'), 'ABCD'[pattern]]),
              h('select', {class:'arrange-drum-assignment', 'aria-label':`${target + 1}小節目のパターン`, value:String(pattern),
              onPointerdown:()=>selectDrumBar(target),
              onChange:(/** @type {Event} */ event)=>{
                const next = Number((/** @type {HTMLSelectElement} */ (event.target)).value)
                while (drumAssignments.value.length <= target) drumAssignments.value.push(0)
                drumAssignments.value[target] = next
                selectDrumBar(target)
              }}, 'ABCD'.split('').map((label, patternIndex)=>h('option', {value:String(patternIndex)}, `${target + 1}  Ptn${label}`))),
            ]),
          ])
        })),
    ]),
    h('div', {class:'arrange-drum-pattern-row'}, [h('div', {class:'arrange-drum-patterns', role:'group', 'aria-label':'ドラムパターン'}, [
      h('button', {type:'button', 'aria-label':'パターン0', 'aria-pressed':drumZeroSelected.value, onClick:()=>{drumZeroSelected.value = true}}, '0'),
      ...['A','B','C','D'].map((label, index) => h('button', {type:'button', 'aria-label':`パターン${label}`, 'aria-pressed':!drumZeroSelected.value && drumPatternIndex.value === index, onClick:()=>{drumZeroSelected.value = false; drumPatternIndex.value = index}}, `Ptn${label}`)),
    ]), h('button', {type:'button', class:'arrange-drum-undo', disabled:history.value.length === 0, onClick:undo}, undoLabel())]),
    ...drumGrid(drumZeroSelected.value ? -1 : bar),
  ])
}

const app = createApp({ render: () => [
  h('button', {type:'button', onClick:exportMidi}, 'MIDIを書き出す'),
  h('div', {class:'arrange-controls'}, [
    options.togglePlayback ? null : h('button', {type:'button', class:'tutorial-start', onClick:play}, playing.value || loading.value ? '■ 停止' : '▶ 伴奏と聴く'),
    h('label', {class:'arrange-tempo'}, [
      h('span', 'テンポ'),
      h('span', {class:'volume-knob', style:{'--angle':`${(bpm.value - 120) * 1.6875}deg`}}, [
        h('span'), h('input', {type:'range', min:40, max:200, value:bpm.value, 'aria-label':'テンポ', onInput:changeTempo, ref:bindTempoKnob}),
      ]),
      h('output', `${bpm.value} BPM`),
    ]),
    options.togglePlayback ? null : h('button', {type:'button', disabled:notes.value.length === original.length && notes.value.every(({beat,length,midi}, index) => beat === original[index][0] && length === original[index][1] && midi === original[index][2]), onClick:reset}, 'お手本に戻す'),
  ]),
  error.value ? h('p', {role:'alert'}, error.value) : null,
  isDrums ? drumNavigation() : scoreNavigation({attrs:{
    class:['tutorial-navigation-advanced arrange-score', {'arrange-hide-note-bars':isDrums || !showNoteBars.value, 'arrange-pickup-page':scorePage.value < 0}], 'aria-label':partLabel + 'の楽譜', tabindex:-1,
    onPointerdown:startSelection, onPointermove:moveSelection, onPointerup:finishSelection,
    onPointercancel:cancelSelection, onLostpointercapture:cancelSelection,
    onPointerleave:()=>{ if (!selectionBox.value) cancelSelection() },
  }, header:[selectionBox.value ? h('div', {
    class:'arrange-selection-box', 'aria-hidden':'true',
    style:{
      left:`${selectionBox.value.left}px`, top:`${selectionBox.value.top}px`,
      width:`${selectionBox.value.right - selectionBox.value.left}px`,
      height:`${selectionBox.value.bottom - selectionBox.value.top}px`,
    },
  }) : null], lanes:[
    ...(scorePage.value < 0 ? [pickupStart] : [scorePage.value * 16, scorePage.value * 16 + 8]),
  ], lane:start => {
    const clef = clefs[clefIndex.value]
    const noteTop = (/** @type {number} */ midi) => isDrums ? scoreTrebleTop([65,72,81,83,69,79,76,86][midi]) : scoreTrebleTop(midi, clef.stepOffset)
    const rhythmGroups = isAccompaniment ? [] : scoreRhythmGroups(notes.value)
    const pickup = start < 0
    const laneBeats = pickup ? 4 : 8
    const percent = 100 / laneBeats
    const keyForBar = options.keyForBar
    const keyed = keyForBar ? scoreKeyedNotes(notes.value, keyForBar) : null
    const staffMidi = (/** @type {number} */ index) => keyed?.[index].staffMidi ?? notes.value[index].midi
    const accidental = (/** @type {number} */ index) => isDrums ? '' : keyed?.[index].sign ?? scoreAccidentalForNote(notes.value, index)
    const firstBar = Math.max(0, start / 4)
    const fifths = !isDrums && keyForBar ? scoreKeyFifths(keyForBar(firstBar)) : 0
    const nextFifths = !isDrums && keyForBar && !pickup && firstBar + 1 < totalBars()
      ? scoreKeyFifths(keyForBar(firstBar + 1)) : fifths
    const signature = scoreKeySignature(fifths)
    const change = nextFifths === fifths ? [] : nextFifths === 0
      ? signature.map(entry => ({...entry, sign:'♮'})) : scoreKeySignature(nextFifths)
    const signatureSpacing = options.togglePlayback ? 4.25 : 8
    const signatureShift = (/** @type {number} */ beat) => beat === start + 4 ? change.length * signatureSpacing : 0
    const chordChanges = !pickup && options.chordChanges
      ? [0, 1].flatMap(offset => options.chordChanges?.(start / 4 + offset)
        .map(change => ({...change, position: offset * 4 + change.position, bar: start / 4 + offset + 1})) ?? [])
      : null
    const laneNotes = notes.value.map((note,index)=>({...note,index})).filter(({beat,length})=>beat < start + laneBeats && beat + length > start)
    const farthestStep = Math.max(0, ...laneNotes.map(({index}) => Math.abs(scoreStaffStep(staffMidi(index)) + clef.stepOffset - 6)))
    const minHeight = clefIndex.value && farthestStep > 8 ? `${farthestStep * 9 + 88}px` : undefined
    return {
    attrs:{class:['arrange-staff tutorial-pitch-lane', {'arrange-drum-lane':isDrums}], role:'group', style:{minHeight, '--arrange-clef-clearance':clef.bass ? '23px' : '27px', '--arrange-sign-width':`${signature.length * signatureSpacing}px`}, 'data-start-beat':start, 'aria-label':pickup ? '0' : `${start / 4 + 1}〜${start / 4 + 2}小節`}, before:[
      ...Array.from({length:laneBeats}, (_, i) => h('button', {
        type:'button', class:['arrange-beat', {'arrange-cursor-beat':stepCursor.value === start + i}],
        style:{left:`${i * percent}%`}, 'aria-label':pickup ? `0小節目の${i + 1}拍から入力` : `${Math.floor((start + i) / 4) + 1}小節目 ${i % 4 + 1}拍から入力`,
        onClick:()=>{
          setStepCursor(start + i)
          if (pickup) options.selectBar?.(0, true)
          else options.selectBar?.(Math.floor((start + i) / 4), false, (start + i) % 4)
        },
      }, pickup ? (i === 0 ? '0' : '') : i % 4 === 0 ? String((start + i) / 4 + 1) : '')),
      chordChanges ? h('div', {class:'arrange-chord-strip', role:'group', 'aria-label':'コード進行'},
        chordChanges.map(({bar, beat, position, label}, index) => h('span', {
          class:['arrange-chord-change', {'arrange-chord-on-downbeat': beat === 0}],
          style:{left:`${position * percent}%`, width:`${((chordChanges[index + 1]?.position ?? laneBeats) - position) * percent}%`},
          title:label,
          'aria-label':`${bar}小節目 ${beat + 1}拍目 ${label}`,
        }, label))) : null,
      !playbackContext && stepCursor.value !== null && stepCursor.value >= start && stepCursor.value < start + laneBeats
        ? h('span',{class:'arrange-step-cursor',style:{left:`${(stepCursor.value-start)*percent}%`},'aria-hidden':'true'}) : null,
      tutorialStaffLines(),
      options.togglePlayback && !isDrums ? h('span', {
        class:'arrange-clef', role:'img', 'aria-label':clef.label,
        style:{top:scoreTrebleTop(clef.bass ? 74 : 67)},
      }, [h('svg', {viewBox:'0 0 28 84', 'aria-hidden':'true'}, [
        clef.bass ? h('g', [
          h('path', {d:'M3 39C3 28 20 27 20 38C20 48 10 54 2 57C10 52 16 46 16 38C16 31 8 30 5 36Z'}),
          h('circle', {cx:6, cy:39, r:3.5}),
          h('circle', {cx:24, cy:34.5, r:1.6}),
          h('circle', {cx:24, cy:43.5, r:1.6}),
        ]) : h('text', {x:2, y:39, class:'arrange-treble-glyph'}, '\uE050'),
        clef.octave ? h('text', {x:clef.bass ? 8 : 11, y:clef.bass ? 65 : 1, 'font-size':10}, '8') : null,
      ])]) : null,
      ...[signature, change].flatMap((entries, group) => entries.map(({midi, sign}, index) =>
        h('span', {class:'arrange-key-sign', 'aria-hidden':'true', style:{
          left:group === 0 ? `${(index - entries.length) * signatureSpacing - 3}px` : `calc(50% + ${index * signatureSpacing}px)`,
          top:scoreTrebleTop(midi, clef.bass ? -2 : 0),
        }}, [scoreAccidentalGlyph(sign)]))),
      pickup ? null : h('span', {class:'tutorial-measure-divider'}),
      h('span', {class:'tutorial-measure-divider arrange-end-barline', 'aria-hidden':'true'}),
      ...tutorialSubdivisions(laneBeats),
      ...rhythmGroups.flatMap(group => {
        const firstIndex = group[0]
        const lastIndex = group[group.length - 1]
        const first = notes.value[firstIndex]
        const last = notes.value[lastIndex]
        if (first.beat < start || last.beat >= start + laneBeats) return []
        const layout = scoreBeamLayout(group.map(index => ({midi:staffMidi(index)})), clef.stepOffset)
        const stemX = (/** @type {number} */ index) => `calc(8px + ${layout.down ? .9 : 6.6}px * var(--tutorial-staff-scale) + ${(accidental(index) ? 4 : 0) + signatureShift(notes.value[index].beat)}px)`
        const offset = layout.down ? 'var(--tutorial-stem-rise)' : 'calc(-1 * var(--tutorial-stem-rise))'
        const beamTop = noteTop(staffMidi(group[layout.referenceIndex]))
        const stemLeft = (/** @type {number} */ index) =>
          `calc(${(notes.value[index].beat - start) * percent}% + ${stemX(index)})`
        const beamWidth = (/** @type {number} */ from, /** @type {number} */ to) =>
          `calc(${(notes.value[to].beat - notes.value[from].beat) * percent}% + ${stemX(to)} - ${stemX(from)} + 1px)`
        const beamStyle = {
          '--beam-start':beamTop, '--beam-end':beamTop,
          '--beam-start-offset':offset, '--beam-end-offset':offset,
        }
        const secondaryOffset = layout.down ? '-5px' : '5px'
        const beams = [h('span', {
          class:'tutorial-slide-beam arrange-note-beam', 'aria-hidden':'true',
          style:{...beamStyle, left:stemLeft(firstIndex), width:beamWidth(firstIndex,lastIndex)},
        })]
        for (let slot = 0; slot < group.length;) {
          const from = slot++
          if (notes.value[group[from]].length !== .25) continue
          while (slot < group.length && notes.value[group[slot]].length === .25) slot++
          const fromIndex = group[from]
          const toIndex = group[slot - 1]
          let left = stemLeft(fromIndex)
          let width = beamWidth(fromIndex,toIndex)
          if (fromIndex === toIndex) {
            // A lone sixteenth gets a short hook pointing into the group.
            const towardLeft = slot === group.length
            const neighbor = group[towardLeft ? from - 1 : slot]
            const gap = Math.abs(notes.value[neighbor].beat - notes.value[fromIndex].beat) * percent
            width = `min(10px, ${gap / 2}%)`
            if (towardLeft) left = `calc(${left} - ${width} + 1px)`
          }
          beams.push(h('span', {
            class:'tutorial-slide-beam tutorial-slide-beam-secondary arrange-note-beam',
            'aria-hidden':'true',
            style:{...beamStyle, left, width, '--beam-second-start':secondaryOffset, '--beam-second-end':secondaryOffset},
          }))
        }
        return beams
      }),
      ], notes:laneNotes,
      note:({beat,length,midi,index}) => {
        const end = beat + length
        const group = rhythmGroups.find(group => group.includes(index))
        const beamLayout = group ? scoreBeamLayout(group.map(noteIndex => ({midi:staffMidi(noteIndex)})), clef.stepOffset) : undefined
        const stemDown = beamLayout?.down ?? (clefIndex.value ? scoreStaffStep(staffMidi(index)) + clef.stepOffset >= 6 : scoreStemDown(midi))
        const top = noteTop(staffMidi(index))
        const rendered = []
        const laneEnd = start + laneBeats
        for (let segmentStart = Math.max(beat, start); segmentStart < Math.min(end, laneEnd);) {
          const segmentEnd = Math.min(end, laneEnd, (Math.floor(segmentStart / 4) + 1) * 4)
          const active = position.value >= segmentStart && position.value < segmentEnd
          const sign = segmentStart === beat ? accidental(index) : ''
          const shift = signatureShift(segmentStart)
          const headOffset = 8 + (sign ? 4 : 0) + shift
          const incoming = segmentStart === start && beat < start
          const outgoing = segmentEnd < end
          // At a system break, draw the two halves at the edges of their respective rows.
          const tie = (/** @type {number} */ left, /** @type {number} */ right, /** @type {number} */ from, /** @type {number} */ to) => h('svg', {
            key:`tie-${index}-${segmentStart}-${left === right ? 'in' : 'out'}`, class:'arrange-note-tie', 'aria-hidden':'true', viewBox:'0 0 100 20', preserveAspectRatio:'none',
            style:{left:`calc(${left}% + ${from}px)`, width:`max(0px, calc(${right - left}% + ${to - from}px))`, top},
          }, [h('path', {
            d:stemDown ? 'M0 6 Q50 -3 100 6 Q50 1 0 6Z' : 'M0 14 Q50 23 100 14 Q50 19 0 14Z',
            fill:'currentColor',
          })])
          if (incoming) rendered.push(tie(0, 0, 0, headOffset + 1))
          if (outgoing) rendered.push(tie(
            (segmentStart - start) * percent, (segmentEnd - start) * percent,
            headOffset + 9, segmentEnd === laneEnd ? 0 : 9 + signatureShift(segmentEnd),
          ))
          rendered.push(scoreNote('button', {
            key:`note-${index}-${Math.floor(segmentStart / 4)}`, type:'button', class:['tutorial-pitch-note', 'arrange-note', {active, 'tutorial-accidental-note':!!sign}], 'data-note-index':index, 'aria-pressed':selected.value === index || selection.value.includes(index),
            style:{'--arrange-signature-shift':`${signatureShift(segmentStart)}px`},
            'aria-label':`${beat < 0 ? '0小節目' : `${Math.floor(beat / 4) + 1}小節目、${beat % 4 + 1}拍`}、${noteName(midi)}、長さ${length}拍`,
            onClick:()=>{ stepCursor.value = null; if (!selection.value.includes(index)) selectNote(index) },
            ...dragEvents(index, null),
          }, [
            scoreAccidental(sign),
            isDrums ? h('span', {class:['arrange-drum-symbol', {'arrange-drum-cymbal':[2,3,5,7].includes(midi)}], 'aria-hidden':'true'}, [h('span', {class:'arrange-drum-head'}), h('span', {class:'arrange-drum-stem'}), segmentEnd - segmentStart <= .5 ? h('span', {class:'arrange-drum-flag'}) : null, segmentEnd - segmentStart <= .25 ? h('span', {class:'arrange-drum-flag arrange-drum-flag-second'}) : null]) : tutorialPitchSymbol({midi, duration:segmentEnd - segmentStart, beam:!!group, stemDown, stemLength:beamLayout && group ? beamLayout.stemLengths[group.indexOf(index)] : undefined, ledgerOffsets:scoreLedgerOffsets(staffMidi(index), clef.stepOffset)}),
            h('span', {class:'tutorial-note-label'}, noteName(midi).replace(/\d+$/, '')),
          ], {beat:segmentStart - start, duration:segmentEnd - segmentStart, laneBeats, top}))
          segmentStart = segmentEnd
        }
        return [...rendered, ...(!isDrums && showNoteBars.value && beat + length <= start + laneBeats ? [h('button', {
          key:`boundary-${index}`, type:'button', class:'arrange-score-boundary',
          style:{left:`${(beat + length - start) * percent}%`,top:noteTop(staffMidi(index))},
          'aria-label':`${beat < 0 ? '0小節目' : `${Math.floor(beat / 4) + 1}小節目`}、${noteName(midi)}の右端を移動`,
          ...dragEvents(index, 'length'),
          onKeydown:(/** @type {KeyboardEvent} */ event)=>{
            if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
            event.preventDefault()
            selectNote(index)
            const delta = event.key === 'ArrowLeft' ? -.125 : .125
            remember()
            moveBoundary(index, beat + length + delta, sharedBoundaryEnd(index), beat + length)
          },
        })] : [])]
      }, after:[
      position.value >= start && position.value < start + laneBeats ? h('span', {class:'tutorial-playhead',style:{left:`${(position.value-start)*percent}%`}}) : null,
    ]}
    },
  }),
  selection.value.length ? h('section', {class:'arrange-timing', 'aria-label':'選択した音符の編集'}, [
    h('div', {role:'status'}, `${selection.value.length}音を選択中`),
    h('div', {class:'arrange-timing-buttons'}, [
      isDrums ? null : h('button', {type:'button', disabled:!canTransposeSelection(-1), onClick:()=>transposeSelection(-1)}, '半音下げる'),
      isDrums ? null : h('button', {type:'button', disabled:!canTransposeSelection(1), onClick:()=>transposeSelection(1)}, '半音上げる'),
      h('button', {type:'button', onClick:deleteSelectedNote}, '削除'),
    ]),
  ]) : null,
  h('div', {class:'arrange-input-dock'}, [
  h('div', {class:'arrange-entry-row'}, [
  isDrums ? null : h('section', {class:'arrange-step-controls', 'aria-label':'ステップ入力'}, [
    stepCursor.value === null ? null : h('div', {class:'arrange-step-status',role:'status'}, stepCursor.value >= totalBeats() ? '入力終了' : `${stepCursor.value < 0 ? '0小節目' : `${Math.floor(stepCursor.value / 4) + 1}小節目 · ${stepCursor.value % 4 + 1}拍目`}から入力`),
    (() => {
      const current = notes.value[selected.value]?.length ?? stepDuration.value
      const found = durations.findIndex(([duration]) => duration === current)
      const index = found < 0 ? durations.findIndex(([duration]) => duration === stepDuration.value) : found
      const [duration, label] = durations[index]
      return h('div', {class:'arrange-duration-picker', role:'group', 'aria-label':'音価'}, [
        h('div', {class:'arrange-duration-values'}, [
          h('label', {class:'arrange-duration-select'}, [
            noteIcon(Number(duration)),
            h('select', {'aria-label':'音価を選択', value:String(duration),
              onChange:(/** @type {Event} */ event)=>useDuration(Number((/** @type {HTMLSelectElement} */ (event.currentTarget)).value), false)},
              durations.map(([value, name]) => h('option', {value:String(value), disabled:!canSetDuration(Number(value))}, `${name}音符`))),
          ]),
          h('div', {class:'arrange-step-row'}, [
            h('button', {type:'button', 'aria-label':`${label}休符`, title:`${label}休符 (Z)`, 'aria-keyshortcuts':'Z',
              disabled:!inputEnabled.value || stepCursor.value === null || stepCursor.value >= totalBeats(),
              onClick:()=>useDuration(Number(duration), true)}, restIcon(Number(duration))),
            h('button', {type:'button', 'aria-label':'直前の音を伸ばす', title:'直前の音を選択した音価分伸ばす (X)', 'aria-keyshortcuts':'X', disabled:!extensionTarget(), onClick:extendPreviousNote}, '→伸'),
            h('button', {type:'button', class:'arrange-clear-page', 'aria-label':'表示中のページのノートを消す', disabled:!notes.value.some(note => { const [start, end] = pageBounds(); return note.beat < end && note.beat + note.length > start }), onClick:clearPage}, 'ページを消す'),
          ]),
        ]),
      ])
    })(),
  ]),
  h('div', {class:'arrange-entry-actions'}, [
    isDrums ? null : options.paginationTarget ? h(Teleport, {to:options.paginationTarget}, scorePagination({
      page:scorePage.value, pageSize:4, totalBars:totalBars(), label:'楽譜のページ', leadingLabel:'page', minPage:-1,
      onPageChange:page=>{scorePage.value = page},
    })) : scorePagination({
      page:scorePage.value, pageSize:4, totalBars:totalBars(), label:'楽譜のページ', leadingLabel:'page', minPage:-1,
      onPageChange:page=>{scorePage.value = page},
    }),
  isDrums ? null : h('div', {class:'part-mix arrange-record'}, [
    h('button', {type:'button', class:'mix-button', 'aria-label':partLabel + '入力', title:partLabel + '入力 (Shift+R)', 'aria-keyshortcuts':'Shift+R', 'aria-pressed':inputEnabled.value, onClick:()=>{ inputEnabled.value = !inputEnabled.value }}, [
      h('span', {'aria-hidden':'true'}, '●'), ' Rec',
    ]),
  ]),
  ]),
  ]),
  h('div', {class:'arrange-keyboard-toolbar'}, [
    isAccompaniment ? null : octaveControl(octave.value - baseOctave, delta => { octave.value += delta }, {min:minOctaveOffset,max:(isBass ? 1 : 2) - keyboardOctaves.value}),
    isAccompaniment ? null : h('div', {class:'arrange-octave-display'}, [
    h('div', {class:'segmented-control arrange-octave-width', role:'group', 'aria-label':'鍵盤の表示範囲'}, [1,2].map(count =>
      h('label', [
        h('input', {type:'radio', name:isBass ? 'bass-arrange-octaves' : 'arrange-octaves', value:count, 'aria-label':`${count}オクターブ`, checked:keyboardOctaves.value === count,
          onChange:()=>{
            octave.value = Math.min(octave.value, baseOctave + (isBass ? 1 : 2) - count)
            keyboardOctaves.value = count
          }}),
        h('span', `${count}oct`),
      ]))),
    ]),
    isDrums ? null : h('button', {type:'button', class:'arrange-bar-toggle', 'aria-pressed':showNoteBars.value, onClick:()=>{ showNoteBars.value = !showNoteBars.value }}, 'バー'),
    isDrums ? null : h('button', {type:'button', class:'arrange-undo', disabled:history.value.length === 0, onClick:undo}, undoLabel()),
  ]),
  isAccompaniment ? null : h('div', {class:'tutorial-keyboard arrange-keyboard', style:{'--tutorial-key-count':String(keyboardOctaves.value * 7 + 1)},role:'group','aria-label':partLabel + 'を試す鍵盤'}, Array.from({length:keyboardOctaves.value * 12 + 1}, (_, i) => midiKey((octave.value + 1) * 12 + i)).map(key => h('button', {
    type:'button', class:[key.black ? 'tutorial-black' : 'tutorial-white', {active:heldPitches.value.includes(key.midi) || dragPitch.value === key.midi || (playing.value && notes.value.some(note => note.midi === key.midi && position.value >= note.beat && position.value < note.beat + note.length * .9))}],
    style:key.black ? {left:`${Array.from({length:keyboardOctaves.value * 12 + 1}, (_, i) => midiKey((octave.value + 1) * 12 + i)).filter(note => !note.black && note.midi < key.midi).length * (100 / (keyboardOctaves.value * 7 + 1))}%`} : undefined,
    'aria-label':key.label, disabled:key.midi < minMidi || key.midi > maxMidi,
    onPointerdown:()=>setPitchHeld(key.midi, true),
    onPointerup:()=>setPitchHeld(key.midi, false),
    onPointercancel:()=>setPitchHeld(key.midi, false),
    onLostpointercapture:()=>setPitchHeld(key.midi, false),
    onPointerleave:(/** @type {PointerEvent} */ event)=>{if (event.buttons) setPitchHeld(key.midi, false)},
    onClick:()=>choosePitch(key.midi),
  }, key.black || key.midi % 12 !== 0 ? '' : `C${Math.floor(key.midi / 12) - 1}`))),
  ]),
] })
app.mount(host)

const handleKey = (/** @type {KeyboardEvent} */ event) => {
  const target = event.target
  if (!isDrums && event.code === 'KeyR' && event.shiftKey && options.empty && host.getClientRects().length > 0 &&
      !event.repeat && !event.isComposing && !event.ctrlKey && !event.metaKey && !event.altKey &&
      !document.querySelector('dialog[open]') &&
      !(target instanceof HTMLElement && (target.isContentEditable || target.closest('input, textarea, select, [contenteditable]')))) {
    event.preventDefault()
    event.stopImmediatePropagation()
    inputEnabled.value = !inputEnabled.value
    return
  }
  if (event.metaKey && !event.shiftKey && !event.ctrlKey && !event.altKey && !event.isComposing &&
      (event.code === 'KeyZ' || event.code === 'KeyY') && !drag &&
      host.getClientRects().length > 0 && !document.querySelector('dialog[open]') &&
      !(target instanceof HTMLElement && (target.isContentEditable || target.closest('input, textarea, select, [contenteditable]')))) {
    event.preventDefault()
    if (!event.repeat) {
      if (event.code === 'KeyZ') undo()
      else redo()
    }
    return
  }
  if (!host.contains(document.activeElement)) return
  if (event.defaultPrevented || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return
  if (target instanceof HTMLElement && (target.isContentEditable || target.closest('input, textarea, select, dialog'))) return
  if (!event.shiftKey && !event.isComposing && !document.querySelector('dialog[open]')) {
    if (!isDrums && event.code === 'KeyZ') {
      event.preventDefault()
      useDuration(notes.value[selected.value]?.length ?? stepDuration.value, true)
      return
    }
    if (!isDrums && event.code === 'KeyX') {
      event.preventDefault()
      extendPreviousNote()
      return
    }
    const key = /^Key([A-Z])$/.exec(event.code)?.[1]
    if (key) {
      const noteIndex = noteKeys.indexOf(key)
      const restIndex = restKeys.indexOf(key)
      const duration = durations[Math.max(noteIndex, restIndex)]
      if (duration) {
        event.preventDefault()
        useDuration(Number(duration[0]), restIndex >= 0)
        return
      }
    }
  }
  if ((event.key === 'Delete' || event.key === 'Backspace') && (selected.value >= 0 || selection.value.length)) {
    event.preventDefault()
    deleteSelectedNote()
  } else if (!isDrums && selection.value.length && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
    event.preventDefault()
    transposeSelection(event.key === 'ArrowUp' ? 1 : -1)
  } else if (event.code === 'Space') {
    event.preventDefault()
    void play()
  }
}
document.addEventListener('keydown', handleKey, true)
window.addEventListener('pagehide', stop)
return {
  /** @param {number} bar @param {number} beat @param {number} time @param {number} secondsPerBeat @param {number} meter @param {AudioContext} context */
  schedulePlaybackBar(bar, beat, time, secondsPerBeat, meter, context) {
    playbackContext = context
    scheduledBars.push({bar, beat, time, secondsPerBeat, meter})
    if (!playbackFrame) playbackFrame = requestAnimationFrame(updatePlaybackPosition)
  },
  stopPlaybackPosition,
  /** @param {{beat:number,duration:number,midi:number}[]} saved */
  setNotes(saved) {
    stop()
    notes.value = saved.map(note => ({beat:note.beat, length:note.duration, midi:note.midi}))
    history.value = []
    redoHistory.length = 0
    selectNote(-1)
    stepCursor.value = 0
    playbackStart.value = 0
    scorePage.value = 0
    drumBar.value = 0
    drumZeroSelected.value = false
    selectedDrumBoundary.value = null
  },
  /** @param {number} midi */
  midiAttack(midi) {
    if (midi < minMidi || midi > maxMidi) return
    setPitchHeld(midi, true)
    choosePitch(midi)
  },
  /** @param {number} midi */
  midiRelease(midi) { setPitchHeld(midi, false) },
  /** @param {readonly number[]} pitches */
  recordStep(pitches) {
    if (isDrums && inputEnabled.value && stepCursor.value === null && selected.value >= 0) {
      stepCursor.value = notes.value[selected.value].beat
    }
    if (inputEnabled.value && stepCursor.value !== null && pitches.length &&
        pitches.every(midi => Number.isInteger(midi) && midi >= minMidi && midi <= maxMidi)) {
      return writeStep(pitches)
    }
    return false
  },
  /** @param {({beat:number,duration:number,midi:number}[]|null)[]} patterns */
  setDrumPatterns(patterns) { drumPatterns.value = patterns.map(pattern => pattern?.map(note => ({...note})) ?? null) },
  getDrumPatterns() { return drumPatterns.value.map(pattern => pattern?.map(note => ({...note})) ?? null) },
  /** @param {number[]} assignments */
  setDrumAssignments(assignments) { drumAssignments.value = [...assignments] },
  getDrumAssignments() { return [...drumAssignments.value] },
  getNotes() {
    const result = notes.value.map(note => ({beat:note.beat, duration:note.length, midi:note.midi, velocity:0.8}))
    return isAccompaniment ? result.sort((a,b) => a.beat - b.beat) : result
  },
  destroy() {stopPlaybackPosition();stop();app.unmount();document.removeEventListener('keydown', handleKey, true);window.removeEventListener('pagehide',stop)}}
}
