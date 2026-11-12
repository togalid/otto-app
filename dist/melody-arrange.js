import { createApp, h, ref } from './vendor/vue.runtime.esm-browser.prod.js'
import { Instrument } from './audio.js'
import { DrumSynth } from './rhythm.js'
import { genres } from './groove.js'
import { pianoKey, pianoWhiteLabel } from './keyboard.js'
import { bindTempoKnob } from './main-controls.js'
import { octaveControl } from './part-steppers.js'
import { scoreNavigation, scoreNote, scoreAccidental, scoreAccidentalForNote, scoreEighthGroups, scoreBeamLayout, scoreTrebleTop, scoreLedgerOffsets, tutorialStaffLines, tutorialSubdivisions, tutorialPitchSymbol } from './score-navigation.js'

/**
 * @param {HTMLElement} host
 * @param {{empty?:boolean, barCount?:()=>number}} [options]
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
const octave = ref(4)
const keyboardOctaves = ref(1)
const scorePage = ref(0)
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
const stepCursor = ref(/** @type {number|null} */ (null))
const stepDuration = ref(.5)
const playbackStart = ref(0)
const pickupStart = -1
const showPickup = ref(false)
const playing = ref(false)
const loading = ref(false)
const error = ref('')
const position = ref(-Infinity)
const history = ref(/** @type {{notes:{beat:number,length:number,midi:number}[],cursor:number|null}[]} */ ([]))

function exportMidi() {
  const offset = notes.value.some(note => note.beat < 0) ? -pickupStart : 0
  const events = notes.value.flatMap(note => [
    {tick:Math.round((note.beat + offset) * 480), bytes:[0x90,note.midi,100]},
    {tick:Math.round((note.beat + note.length + offset) * 480), bytes:[0x80,note.midi,0]},
  ]).sort((a,b)=>a.tick-b.tick || a.bytes[0]-b.bytes[0])
  const track = [0,255,81,3, ...[16,8,0].map(shift => (Math.round(60000000 / bpm.value) >> shift) & 255)]
  let previous = 0
  for (const event of events) {
    let delta = event.tick - previous
    const encoded = [delta & 127]
    while ((delta >>= 7) > 0) encoded.unshift((delta & 127) | 128)
    track.push(...encoded,...event.bytes)
    previous = event.tick
  }
  track.push(0,255,47,0)
  const bytes = new Uint8Array([77,84,104,100,0,0,0,6,0,0,0,1,1,224,77,84,114,107,
    ...[24,16,8,0].map(shift => (track.length >>> shift) & 255), ...track])
  const url = URL.createObjectURL(new Blob([bytes],{type:'audio/midi'}))
  const link = document.createElement('a')
  link.href = url
  link.download = 'oto-melody.mid'
  link.click()
  setTimeout(()=>URL.revokeObjectURL(url),1000)
}

function remember() {
  history.value.push({notes:notes.value.map(note => ({...note})), cursor:stepCursor.value})
  if (history.value.length > 100) history.value.shift()
}

function undo() {
  const previous = history.value.pop()
  if (!previous) return
  notes.value = previous.notes
  stepCursor.value = previous.cursor
  selected.value = -1
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

/** @param {number} midi */
function choosePitch(midi) {
  if (midi < 53 || midi > 84) return
  const index = selected.value
  if (stepCursor.value !== null) writeStep(midi)
  else if (index >= 0 && notes.value[index].midi !== midi) {
    if (!drag) remember()
    notes.value[index].midi = midi
  }
  const request = ++previewGeneration
  void preview.ready().then(() => {
    if (request === previewGeneration && preview.context) {
      preview.playAt([midi], preview.context.currentTime + .01, .24)
    }
  }).catch(() => {
    if (request === previewGeneration) error.value = '鍵盤の音を再生できませんでした。'
  })
}

function reset() {
  remember()
  notes.value = original.map(([beat, length, midi]) => ({beat, length, midi}))
  selected.value = -1
  stepCursor.value = null
  playbackStart.value = 0
}

function deleteSelectedNote() {
  if (selected.value < 0) return
  remember()
  notes.value.splice(selected.value, 1)
  selected.value = -1
}

/** @param {number|null} midi */
function writeStep(midi) {
  if (stepCursor.value === null || stepCursor.value >= totalBeats()) return
  remember()
  const start = stepCursor.value
  const end = Math.min(totalBeats(), start + stepDuration.value)
  const updated = []
  for (const note of notes.value) {
    const noteEnd = note.beat + note.length
    if (noteEnd <= start || note.beat >= end) {
      updated.push(note)
      continue
    }
    if (note.beat < start) updated.push({...note, length:start - note.beat})
    if (noteEnd > end) updated.push({...note, beat:end, length:noteEnd - end})
  }
  if (midi !== null) {
    for (let beat = start; beat < end;) {
      const segmentEnd = Math.min(end, (Math.floor(beat / 4) + 1) * 4)
      updated.push({beat, length:segmentEnd - beat, midi})
      beat = segmentEnd
    }
  }
  notes.value = updated.sort((a,b) => a.beat - b.beat)
  selected.value = -1
  stepCursor.value = end
}

/** @param {number} beat */
function setStepCursor(beat) {
  selected.value = -1
  stepCursor.value = beat
  playbackStart.value = beat
  if (playing.value || loading.value) {
    stop()
    void play()
  }
}

/** @param {number} index */
function timingBounds(index) {
  const previous = notes.value[index - 1]
  return {
    earliest: previous ? previous.beat + previous.length : showPickup.value ? pickupStart : 0,
    latest: notes.value[index + 1]?.beat ?? totalBeats(),
  }
}

/** @param {number} move @param {number} resize */
function timingChange(move, resize) {
  const index = selected.value
  if (index < 0) return null
  const note = notes.value[index]
  const {earliest, latest} = timingBounds(index)
  const beat = note.beat + move
  const length = note.length + resize
  return beat >= earliest && length >= .125 && beat + length <= latest ? {...note, beat, length} : null
}

/** @type {{pointer:number,index:number,x:number,y:number,width:number,beats:number,beat:number,length:number,midi:number,originRow:number,sharedEnd:number|null,changed:boolean,axis:'length'|'time'|'pitch'|null}|null} */
let drag = null
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
  drag = {pointer:event.pointerId, index, x:event.clientX, y:event.clientY, width, beats:beat < 0 ? 1 : 8, beat, length, midi, originRow,
    changed:false, sharedEnd: axis === 'length' ? sharedBoundaryEnd(index) : null, axis}
  selected.value = index
}

/** @param {number} index */
function sharedBoundaryEnd(index) {
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
  if (!drag.axis) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 8) return
    drag.axis = Math.abs(dy) > Math.abs(dx) ? 'pitch' : 'time'
  }
  if (!drag.changed) { remember(); drag.changed = true }
  if (drag.axis === 'pitch') {
    const nextPitch = Math.max(53, Math.min(84, midi - Math.round(dy / 20)))
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

/** @param {string} label @param {number} move @param {number} resize */
function timingButton(label, move, resize) {
  return h('button', {
    type:'button', disabled:!timingChange(move, resize),
    onClick:()=>{
      const next = timingChange(move, resize)
      if (next) { remember(); notes.value[selected.value] = next }
    },
  }, label)
}

/** @param {number} midi */
const noteName = midi => ((midi % 12 === 3 || midi % 12 === 10) ? pianoWhiteLabel(midi + 1) + '♭' : pianoWhiteLabel(midi) || pianoWhiteLabel(midi - 1) + '♯') + Math.floor(midi / 12 - 1)
/** @param {number} midi */
const noteTop = scoreTrebleTop

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
    ? h('rect', {x:5,y:11,width:14,height:5,fill:'currentColor'})
    : base === 1
      ? h('path', {d:'M9 2 L15 8 L11 13 L16 17 L10 23 C7 26 9 30 13 30 C10 27 12 25 15 27',fill:'none',stroke:'currentColor','stroke-width':2.5,'stroke-linejoin':'round','stroke-linecap':'round'})
      : [h('path', {d:'M16 5L9 28',fill:'none',stroke:'currentColor','stroke-width':2.2,'stroke-linecap':'round'}),
        h('path', {d:'M15 8c-2 3-7 4-8 1-1-2 1-4 3-3 1 1 1 2 0 3',fill:'currentColor'}),
        base === .25 ? h('path', {d:'M13 15c-2 3-7 4-8 1-1-2 1-4 3-3 1 1 1 2 0 3',fill:'currentColor'}) : null]
  return h('svg', {class:'arrange-rhythm-icon',viewBox:'0 0 24 32','aria-hidden':'true'}, [shape, [.375,.75,1.5].includes(duration) ? h('circle',{cx:20,cy:16,r:1.5,fill:'currentColor'}) : null])
}

const app = createApp({ render: () => [
  h('button', {type:'button', onClick:exportMidi}, 'MIDIを書き出す'),
  h('div', {class:'arrange-controls'}, [
    h('button', {type:'button', class:'tutorial-start', onClick:play}, playing.value || loading.value ? '■ 停止' : '▶ 伴奏と聴く'),
    h('label', {class:'arrange-tempo'}, [
      h('span', 'テンポ'),
      h('span', {class:'volume-knob', style:{'--angle':`${(bpm.value - 120) * 1.6875}deg`}}, [
        h('span'), h('input', {type:'range', min:40, max:200, value:bpm.value, 'aria-label':'テンポ', onInput:changeTempo, ref:bindTempoKnob}),
      ]),
      h('output', `${bpm.value} BPM`),
    ]),
    h('button', {type:'button', onClick:()=>{
      showPickup.value = true
      scorePage.value = 0
      setStepCursor(pickupStart)
    }}, '弱起から入力'),
    h('button', {type:'button', disabled:notes.value.length === original.length && notes.value.every(({beat,length,midi}, index) => beat === original[index][0] && length === original[index][1] && midi === original[index][2]), onClick:reset}, 'お手本に戻す'),
  ]),
  error.value ? h('p', {role:'alert'}, error.value) : null,
  scoreNavigation({attrs:{class:'tutorial-navigation-advanced arrange-score', 'aria-label':'メロディの楽譜'}, lanes:[
    ...(scorePage.value === 0 && (showPickup.value || notes.value.some(note => note.beat < 0)) ? [pickupStart] : []),
    scorePage.value * 16, scorePage.value * 16 + 8,
  ], lane:start => {
    const pickup = start < 0
    const laneBeats = pickup ? 1 : 8
    const percent = 100 / laneBeats
    return {
    attrs:{class:'arrange-staff tutorial-pitch-lane', role:'group', 'data-start-beat':start, 'aria-label':pickup ? '弱起' : `${start / 4 + 1}〜${start / 4 + 2}小節`}, before:[
      ...Array.from({length:laneBeats}, (_, i) => h('button', {
        type:'button', class:['arrange-beat', {'arrange-cursor-beat':stepCursor.value === start + i}],
        style:{left:`${i * percent}%`}, 'aria-label':pickup ? '弱起の1拍から入力' : `${Math.floor((start + i) / 4) + 1}小節目 ${i % 4 + 1}拍から入力`,
        onClick:()=>setStepCursor(start + i),
      }, pickup ? '弱起' : i % 4 === 0 ? String((start + i) / 4 + 1) : '')),
      stepCursor.value !== null && stepCursor.value >= start && stepCursor.value < start + laneBeats
        ? h('span',{class:'arrange-step-cursor',style:{left:`${(stepCursor.value-start)*percent}%`},'aria-hidden':'true'}) : null,
      tutorialStaffLines(),
      pickup ? null : h('span', {class:'tutorial-measure-divider'}),
      ...tutorialSubdivisions(laneBeats),
      ...scoreEighthGroups(notes.value).flatMap(group => {
        const firstIndex = group[0]
        const lastIndex = group[group.length - 1]
        const first = notes.value[firstIndex]
        const last = notes.value[lastIndex]
        if (first.beat < start || last.beat >= start + laneBeats) return []
        const layout = scoreBeamLayout(group.map(index => notes.value[index]))
        const stemX = (/** @type {number} */ index) => `calc(8px + ${layout.down ? .9 : 6.6}px * var(--tutorial-staff-scale) + ${scoreAccidentalForNote(notes.value, index) ? 4 : 0}px)`
        const firstX = stemX(firstIndex)
        const lastX = stemX(lastIndex)
        const offset = layout.down ? 'var(--tutorial-stem-rise)' : 'calc(-1 * var(--tutorial-stem-rise))'
        const beamTop = noteTop(notes.value[group[layout.referenceIndex]].midi)
        return [h('span', {class:'tutorial-slide-beam arrange-note-beam', 'aria-hidden':'true', style:{
          left:`calc(${(first.beat - start) * percent}% + ${firstX})`,
          width:`calc(${(last.beat - first.beat) * percent}% + ${lastX} - ${firstX} + 1px)`,
          '--beam-start':beamTop, '--beam-end':beamTop,
          '--beam-start-offset':offset, '--beam-end-offset':offset,
        }})]
      }),
      ], notes:notes.value.map((note,index)=>({...note,index})).filter(({beat,length})=>beat < start + laneBeats && beat + length > start),
      note:({beat,length,midi,index}) => {
        const segmentStart = Math.max(beat, start)
        const segmentEnd = Math.min(beat + length, start + laneBeats)
        const active = position.value >= beat && position.value < beat + length
        const sign = scoreAccidentalForNote(notes.value, index)
        const group = scoreEighthGroups(notes.value).find(group => group.includes(index))
        const beamLayout = group ? scoreBeamLayout(group.map(noteIndex => notes.value[noteIndex])) : undefined
        return [scoreNote('button', {
          key:index, type:'button', class:['tutorial-pitch-note', 'arrange-note', {active, 'tutorial-accidental-note':!!sign}], 'aria-pressed':selected.value === index,
          'aria-label':`${beat < 0 ? '弱起' : `${Math.floor(beat / 4) + 1}小節目、${beat % 4 + 1}拍`}、${noteName(midi)}、長さ${length}拍`,
          onClick:()=>{ stepCursor.value = null; selected.value = index },
          ...dragEvents(index, null),
        }, [
          scoreAccidental(sign),
          tutorialPitchSymbol({midi, duration:length, beam:!!group, stemDown:beamLayout?.down, stemLength:beamLayout && group ? beamLayout.stemLengths[group.indexOf(index)] : undefined, ledgerOffsets:scoreLedgerOffsets(midi)}),
          h('span', {class:'tutorial-note-label'}, noteName(midi).replace(/\d+$/, '')),
        ], {beat:segmentStart - start, duration:segmentEnd - segmentStart, laneBeats, top:noteTop(midi)}), ...(beat + length <= start + laneBeats ? [h('button', {
          key:`boundary-${index}`, type:'button', class:'arrange-score-boundary',
          style:{left:`${(beat + length - start) * percent}%`,top:noteTop(midi)},
          'aria-label':`${beat < 0 ? '弱起' : `${Math.floor(beat / 4) + 1}小節目`}、${noteName(midi)}の右端を移動`,
          ...dragEvents(index, 'length'),
          onKeydown:(/** @type {KeyboardEvent} */ event)=>{
            if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
            event.preventDefault()
            selected.value = index
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
  selected.value >= 0 ? h('section', {class:'arrange-timing', 'aria-label':'選んだ小節のタイミング編集'}, [
    h('div', {role:'status'}, `${Math.floor(notes.value[selected.value].beat / 4) + 1}小節目 · ${notes.value[selected.value].beat % 4 + 1}拍目 · 長さ ${notes.value[selected.value].length}拍`),
    h('div', {class:'arrange-timing-buttons'}, [
      timingButton('短く', 0, -.125), timingButton('長く', 0, .125),
      h('button', {type:'button', onClick:deleteSelectedNote}, '削除'),
    ]),
  ]) : null,
  h('div', {class:'arrange-input-dock'}, [
  stepCursor.value !== null ? h('section', {class:'arrange-step-controls', 'aria-label':'ステップ入力'}, [
    h('div', {class:'arrange-step-status',role:'status'}, stepCursor.value >= totalBeats() ? '入力終了' : `${stepCursor.value < 0 ? '弱起' : `${Math.floor(stepCursor.value / 4) + 1}小節目 · ${stepCursor.value % 4 + 1}拍目`}から入力`),
    h('div', {class:'arrange-step-row',role:'group','aria-label':'音の長さ'}, [
      ...durations.map(([duration,label]) =>
        h('button',{type:'button','aria-label':`${label}音符`,title:`${label}音符`,'aria-pressed':stepDuration.value === duration,
          onClick:()=>{stepDuration.value = Number(duration)}},noteIcon(Number(duration)))),
    ]),
    h('div', {class:'arrange-step-row',role:'group','aria-label':'休符を入力'}, [
      ...durations.map(([duration,label]) =>
        h('button',{type:'button','aria-label':`${label}休符`,title:`${label}休符`,disabled:stepCursor.value === totalBeats(),onClick:()=>{stepDuration.value = Number(duration);writeStep(null)}},restIcon(Number(duration)))),
    ]),
  ]) : null,
  h('div', {class:'arrange-keyboard-toolbar'}, [
    h('button', {type:'button', disabled:history.value.length === 0, onClick:undo}, '↶ やり直し'),
    octaveControl(octave.value - 4, delta => { octave.value += delta }, {min:-1,max:2 - keyboardOctaves.value}),
    h('div', {class:'segmented-control arrange-octave-width', role:'group', 'aria-label':'鍵盤の表示範囲'}, [1,2].map(count =>
      h('label', [
        h('input', {type:'radio', name:'arrange-octaves', value:count, checked:keyboardOctaves.value === count,
          onChange:()=>{
            octave.value = Math.min(octave.value, 6 - count)
            keyboardOctaves.value = count
          }}),
        h('span', `${count}オクターブ`),
      ]))),
    h('div', {class:'tutorial-score-pagination', 'aria-label':'楽譜のページ'}, [
      h('div', {class:'part-choice-steps'}, [
        h('button', {type:'button', 'aria-label':'前の4小節', disabled:scorePage.value === 0, onClick:()=>{scorePage.value--}}, '←'),
        h('button', {type:'button', 'aria-label':'次の4小節', disabled:(scorePage.value + 1) * 4 >= totalBars(), onClick:()=>{scorePage.value++}}, '→'),
      ]),
      h('span', {'aria-live':'polite'}, `${scorePage.value * 4 + 1}〜${Math.min(totalBars(), scorePage.value * 4 + 4)}小節`),
    ]),
  ]),
  h('div', {class:'tutorial-keyboard arrange-keyboard', style:{'--tutorial-key-count':String(keyboardOctaves.value * 7 + 1)},role:'group','aria-label':'メロディを試す鍵盤'}, Array.from({length:keyboardOctaves.value * 12 + 1}, (_, i) => pianoKey((octave.value + 1) * 12 + i)).map(key => h('button', {
    type:'button', class:[key.black ? 'tutorial-black' : 'tutorial-white', {active:dragPitch.value === key.midi || (playing.value && notes.value.some(note => note.midi === key.midi && position.value >= note.beat && position.value < note.beat + note.length * .9))}],
    style:key.black ? {left:`${Array.from({length:keyboardOctaves.value * 12 + 1}, (_, i) => pianoKey((octave.value + 1) * 12 + i)).filter(note => !note.black && note.midi < key.midi).length * (100 / (keyboardOctaves.value * 7 + 1))}%`} : undefined,
    'aria-label':key.label, disabled:key.midi < 53 || key.midi > 84, onClick:()=>choosePitch(key.midi),
  }, key.black ? '' : pianoWhiteLabel(key.midi)))),
  ]),
] })
app.mount(host)

const handleKey = (/** @type {KeyboardEvent} */ event) => {
  if (!host.contains(document.activeElement)) return
  if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return
  const target = event.target
  if (target instanceof HTMLElement && (target.isContentEditable || target.closest('input, textarea, select, dialog'))) return
  if ((event.key === 'Delete' || event.key === 'Backspace') && selected.value >= 0) {
    event.preventDefault()
    deleteSelectedNote()
  } else if (event.code === 'Space') {
    event.preventDefault()
    void play()
  }
}
document.addEventListener('keydown', handleKey)
window.addEventListener('pagehide', stop)
return {destroy() {stop();app.unmount();document.removeEventListener('keydown', handleKey);window.removeEventListener('pagehide',stop)}}
}
