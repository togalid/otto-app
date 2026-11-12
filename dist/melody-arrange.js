import { createApp, h, ref } from './vendor/vue.runtime.esm-browser.prod.js'
import { Instrument } from './audio.js'
import { DrumSynth } from './rhythm.js'
import { genres } from './groove.js'
import { pianoKey, pianoWhiteLabel } from './keyboard.js'

// [beat, length in beats, MIDI pitch]
const original = [
  [0,1,65],[1,.5,67],[1.5,.5,69],[2,1,72],[3,1,69],
  [4,1,67],[5,.5,69],[5.5,.5,71],[6,1,72],[7,1,71],
  [8,1,67],[9,1,64],[10,.5,67],[10.5,.5,69],[11,1,71],
  [12,1,72],[13,1,67],[14,2,69],
]
const style = genres.find(genre => genre.id === 'vocal_sky')
const bpm = style?.bpm ?? 128
const chords = [[53,57,60,64],[55,59,62],[52,55,59],[57,60,64]]
const keys = Array.from({length:13}, (_, i) => pianoKey(60 + i))
const white = keys.filter(key => !key.black)
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

const notes = ref(original.map(([beat, length, midi]) => ({beat, length, midi})))
const selected = ref(-1)
const stepCursor = ref(/** @type {number|null} */ (null))
const stepDuration = ref(.5)
const playbackStart = ref(0)
const playing = ref(false)
const loading = ref(false)
const error = ref('')
const position = ref(-1)
const beatSeconds = 60 / bpm
let timer = 0
let generation = 0
let previewGeneration = 0

function stop() {
  generation++
  previewGeneration++
  clearInterval(timer)
  playing.value = loading.value = false
  position.value = -1
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
    const initialBeat = playbackStart.value
    let step = 0
    playing.value = true
    const tick = () => {
      const now = context.currentTime
      position.value = now >= origin ? (initialBeat + (now - origin) / beatSeconds) % 16 : -1
      step = Math.max(step, Math.ceil((now - origin - .04) * 4 / beatSeconds))
      while (origin + step * beatSeconds / 4 < now + .1) {
        const beat = (initialBeat + step / 4) % 16
        const time = origin + step * beatSeconds / 4
        const chord = chords[Math.floor(beat / 4)]
        if (Number.isInteger(beat)) {
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
  const index = selected.value
  if (stepCursor.value !== null) writeStep(midi)
  else if (index >= 0) notes.value[index].midi = midi
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
  notes.value = original.map(([beat, length, midi]) => ({beat, length, midi}))
  selected.value = -1
  stepCursor.value = null
  playbackStart.value = 0
}

function deleteSelectedNote() {
  if (selected.value < 0) return
  notes.value.splice(selected.value, 1)
  selected.value = -1
}

/** @param {number|null} midi */
function writeStep(midi) {
  if (stepCursor.value === null || stepCursor.value >= 16) return
  const start = stepCursor.value
  const end = Math.min(16, start + stepDuration.value)
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
    earliest: previous ? previous.beat + previous.length : 0,
    latest: notes.value[index + 1]?.beat ?? 16,
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
  return beat >= earliest && length >= .25 && beat + length <= latest ? {...note, beat, length} : null
}

/** @type {{pointer:number,index:number,x:number,y:number,width:number,beats:number,beat:number,length:number,midi:number,originRow:number,sharedEnd:number|null,axis:'length'|'time'|'pitch'|null}|null} */
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
  const originRow = Array.from(document.querySelectorAll('.arrange-staff')).indexOf(/** @type {Element} */ (track))
  drag = {pointer:event.pointerId, index, x:event.clientX, y:event.clientY, width, beats:8, beat, length, midi, originRow,
    sharedEnd: axis === 'length' ? sharedBoundaryEnd(index) : null, axis}
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
  const limit = sharedEnd === null ? timingBounds(index).latest : sharedEnd - .25
  const boundary = Math.max(note.beat + .25, Math.min(limit, end))
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
  if (drag.axis === 'pitch') {
    const nextPitch = Math.max(keys[0].midi, Math.min(keys[keys.length - 1].midi, midi - Math.round(dy / 20)))
    if (notes.value[index].midi !== nextPitch) {
      dragPitch.value = nextPitch
      choosePitch(nextPitch)
    }
    return
  }
  const staffs = Array.from(document.querySelectorAll('.arrange-staff'))
  const targetRow = staffs.findIndex(staff => {
    const rect = staff.getBoundingClientRect()
    return event.clientY >= rect.top && event.clientY <= rect.bottom
  })
  const rowOffset = drag.axis === 'time' && targetRow >= 0 ? (targetRow - drag.originRow) * 8 : 0
  const delta = Math.round((dx * beats / width + rowOffset) * 4) / 4
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
      if (next) notes.value[selected.value] = next
    },
  }, label)
}

/** @param {number} midi */
const noteName = midi => pianoWhiteLabel(midi) || pianoWhiteLabel(midi - 1) + '♯'
/** @param {number} midi */
const noteTop = midi => 86 - white.findIndex(key => key.midi === (pianoKey(midi).black ? midi - 1 : midi)) * 5

/** @param {number} duration */
function noteIcon(duration) {
  return h('svg', {class:'arrange-rhythm-icon', viewBox:'0 0 24 32', 'aria-hidden':'true'}, [
    h('ellipse', {cx:8,cy:25,rx:5,ry:3.2,transform:'rotate(-22 8 25)',stroke:'currentColor','stroke-width':1.5,fill:duration === 2 ? 'none' : 'currentColor'}),
    h('path', {d:'M12.5 25V3',fill:'none',stroke:'currentColor','stroke-width':1.8}),
    duration <= .5 ? h('path',{d:'M12.5 3c1 3 7 4 5 10',fill:'none',stroke:'currentColor','stroke-width':1.8,'stroke-linecap':'round'}) : null,
    duration === .25 ? h('path',{d:'M12.5 8c1 3 7 4 5 10',fill:'none',stroke:'currentColor','stroke-width':1.8,'stroke-linecap':'round'}) : null,
  ])
}

/** @param {number} duration */
function restIcon(duration) {
  const shape = duration === 2
    ? h('rect', {x:5,y:11,width:14,height:5,fill:'currentColor'})
    : duration === 1
      ? h('path', {d:'M14 3l-5 7 5 5-5 7 4 2-2 5',fill:'none',stroke:'currentColor','stroke-width':2.5,'stroke-linejoin':'round','stroke-linecap':'round'})
      : [h('path', {d:'M16 5L9 28',fill:'none',stroke:'currentColor','stroke-width':2.2,'stroke-linecap':'round'}),
        h('path', {d:'M15 8c-2 3-7 4-8 1-1-2 1-4 3-3 1 1 1 2 0 3',fill:'currentColor'}),
        duration === .25 ? h('path', {d:'M13 15c-2 3-7 4-8 1-1-2 1-4 3-3 1 1 1 2 0 3',fill:'currentColor'}) : null]
  return h('svg', {class:'arrange-rhythm-icon',viewBox:'0 0 24 32','aria-hidden':'true'}, shape)
}

createApp({ render: () => [
  h('header', {class:'selection-header'}, [
    h('a', {href:'./'}, '← メニュー'),
    h('h1', 'コネクト・スカイ'),
  ]),
  h('div', {class:'arrange-controls'}, [
    h('button', {type:'button', class:'tutorial-start', onClick:play}, playing.value || loading.value ? '■ 停止' : '▶ 伴奏と聴く'),
    h('button', {type:'button', disabled:notes.value.length === original.length && notes.value.every(({beat,length,midi}, index) => beat === original[index][0] && length === original[index][1] && midi === original[index][2]), onClick:reset}, 'お手本に戻す'),
  ]),
  error.value ? h('p', {role:'alert'}, error.value) : null,
  h('section', {class:'tutorial-navigation arrange-score', 'aria-label':'4小節のメロディ'}, [0,8].map(start =>
    h('div', {class:'arrange-staff', role:'group', 'aria-label':`${start / 4 + 1}〜${start / 4 + 2}小節`}, [
      ...Array.from({length:8}, (_, i) => h('button', {
        type:'button', class:['arrange-beat', {'arrange-cursor-beat':stepCursor.value === start + i}],
        style:{left:`${i * 12.5}%`}, 'aria-label':`${Math.floor((start + i) / 4) + 1}小節目 ${i % 4 + 1}拍から入力`,
        onClick:()=>setStepCursor(start + i),
      }, i % 4 === 0 ? String((start + i) / 4 + 1) : '')), 
      stepCursor.value !== null && stepCursor.value >= start && stepCursor.value < start + 8
        ? h('span',{class:'arrange-step-cursor',style:{left:`${(stepCursor.value-start)*12.5}%`},'aria-hidden':'true'}) : null,
      ...[36,46,56,66,76].map(top => h('span', {class:'arrange-staff-line', style:{top:`${top}%`}})),
      ...notes.value.flatMap(({beat,length,midi}, index) => {
        if (beat >= start + 8 || beat + length <= start) return []
        const segmentStart = Math.max(beat, start)
        const segmentEnd = Math.min(beat + length, start + 8)
        const active = position.value >= beat && position.value < beat + length
        return [h('button', {
          key:index, type:'button', class:['arrange-note', {active}], 'aria-pressed':selected.value === index,
          'aria-label':`${Math.floor(beat / 4) + 1}小節目、${beat % 4 + 1}拍、${noteName(midi)}、長さ${length}拍`,
          style:{left:`${(segmentStart - start) * 12.5}%`,width:`${(segmentEnd - segmentStart) * 12.5}%`,top:`${noteTop(midi)}%`},
          onClick:()=>{ stepCursor.value = null; selected.value = index },
          ...dragEvents(index, null),
        }, [
          h('svg', {viewBox:'0 0 20 26','aria-hidden':'true'}, [
            h('ellipse', {cx:8,cy:20,rx:4,ry:2.8,transform:'rotate(-24 8 20)',stroke:'currentColor',fill:length >= 2 ? 'none' : 'currentColor'}),
            h('path',{d:length < 1 ? 'M12 20V3q7 4 5 9' : 'M12 20V3',fill:'none',stroke:'currentColor'}),
          ]),
          h('span', noteName(midi)),
        ]), ...(beat + length <= start + 8 ? [h('button', {
          key:`boundary-${index}`, type:'button', class:'arrange-score-boundary',
          style:{left:`${(beat + length - start) * 12.5}%`,top:`${noteTop(midi)}%`},
          'aria-label':`${Math.floor(beat / 4) + 1}小節目、${noteName(midi)}の右端を移動`,
          ...dragEvents(index, 'length'),
          onKeydown:(/** @type {KeyboardEvent} */ event)=>{
            if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
            event.preventDefault()
            selected.value = index
            const delta = event.key === 'ArrowLeft' ? -.25 : .25
            moveBoundary(index, beat + length + delta, sharedBoundaryEnd(index), beat + length)
          },
        })] : [])]
      }),
      position.value >= start && position.value < start + 8 ? h('span', {class:'tutorial-playhead',style:{left:`${(position.value-start)*12.5}%`}}) : null,
    ]),
  )),
  selected.value >= 0 ? h('section', {class:'arrange-timing', 'aria-label':'選んだ小節のタイミング編集'}, [
    h('div', {role:'status'}, `${Math.floor(notes.value[selected.value].beat / 4) + 1}小節目 · ${notes.value[selected.value].beat % 4 + 1}拍目 · 長さ ${notes.value[selected.value].length}拍`),
    h('div', {class:'arrange-timing-buttons'}, [
      timingButton('前へ', -.25, 0), timingButton('後ろへ', .25, 0),
      timingButton('短く', 0, -.25), timingButton('長く', 0, .25),
      h('button', {type:'button', onClick:deleteSelectedNote}, '削除'),
    ]),
  ]) : null,
  h('div', {class:'arrange-input-dock'}, [
  stepCursor.value !== null ? h('section', {class:'arrange-step-controls', 'aria-label':'ステップ入力'}, [
    h('div', {class:'arrange-step-status',role:'status'}, stepCursor.value >= 16 ? '入力終了' : `${Math.floor(stepCursor.value / 4) + 1}小節目 · ${stepCursor.value % 4 + 1}拍目から入力`),
    h('div', {class:'arrange-step-row',role:'group','aria-label':'音の長さ'}, [
      ...[[.25,'16分'],[.5,'8分'],[1,'4分'],[2,'2分']].map(([duration,label]) =>
        h('button',{type:'button','aria-label':`${label}音符`,title:`${label}音符`,'aria-pressed':stepDuration.value === duration,
          onClick:()=>{stepDuration.value = Number(duration)}},noteIcon(Number(duration)))),
    ]),
    h('div', {class:'arrange-step-row',role:'group','aria-label':'休符を入力'}, [
      ...[[.25,'16分'],[.5,'8分'],[1,'4分'],[2,'2分']].map(([duration,label]) =>
        h('button',{type:'button','aria-label':`${label}休符`,title:`${label}休符`,disabled:stepCursor.value === 16,onClick:()=>{stepDuration.value = Number(duration);writeStep(null)}},restIcon(Number(duration)))),
    ]),
  ]) : null,
  h('div', {class:'tutorial-keyboard arrange-keyboard',role:'group','aria-label':'メロディを試す鍵盤'}, keys.map(key => h('button', {
    type:'button', class:[key.black ? 'tutorial-black' : 'tutorial-white', {active:dragPitch.value === key.midi || (playing.value && notes.value.some(note => note.midi === key.midi && position.value >= note.beat && position.value < note.beat + note.length * .9))}],
    style:key.black ? {left:`${white.filter(note => note.midi < key.midi).length * 12.5}%`} : undefined,
    'aria-label':key.label, onClick:()=>choosePitch(key.midi),
  }, key.black ? '' : pianoWhiteLabel(key.midi)))),
  ]),
] }).mount('#melody-arrange')

document.addEventListener('keydown', event => {
  if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return
  const target = event.target
  if (target instanceof HTMLElement && (target.isContentEditable || target.closest('input, textarea, select'))) return
  if ((event.key === 'Delete' || event.key === 'Backspace') && selected.value >= 0) {
    event.preventDefault()
    deleteSelectedNote()
  } else if (event.code === 'Space') {
    event.preventDefault()
    void play()
  }
})

window.addEventListener('pagehide', stop)
