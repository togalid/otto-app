import { h } from './vendor/vue.runtime.esm-browser.prod.js'
import { pianoKey } from './keyboard.js'

const pitches = [60,62,64,65,67,69,71,72]

/**
 * Shared navigation shell. Callers supply their own header, lanes and controls.
 * @param {Record<string, any>} attrs
 * @param {(ReturnType<typeof h>|null)[]} children
 */
export function tutorialNavigation(attrs, children) {
  return h('section', {...attrs, class:['tutorial-navigation', attrs.class]}, children)
}

/** @param {Record<string, any>} attrs @param {(ReturnType<typeof h>|null)[]} children */
export function tutorialLane(attrs, children) {
  return h('div', {...attrs, class:['tutorial-note-lane', attrs.class]}, children)
}

/** @param {'span'|'button'} tag @param {Record<string, any>} attrs @param {(ReturnType<typeof h>|null)[]} children */
export function tutorialNote(tag, attrs, children) {
  return h(tag, {...attrs, class:['tutorial-note', attrs.class]}, children)
}

/**
 * Render score lanes and their notes. Screen adapters supply musical data and
 * optional interactive or lesson-specific decorations, while this owns iteration.
 * @template L, N
 * @param {{attrs:Record<string, any>, header?:(ReturnType<typeof h>|null)[], laneContainer?:Record<string, any>, lanes:L[], lane:(lane:L)=>{attrs:Record<string, any>, before:(ReturnType<typeof h>|null)[], notes:readonly N[], note:(note:N,index:number)=>((ReturnType<typeof h>|null)|((ReturnType<typeof h>|null)[])), after:(ReturnType<typeof h>|null)[]}}} options
 */
export function scoreNavigation({attrs, header = [], laneContainer, lanes, lane}) {
  const rendered = lanes.map(item => {
    const view = lane(item)
    return tutorialLane(view.attrs, [
      ...view.before,
      ...view.notes.flatMap((note, index) => {
        const renderedNote = view.note(note, index)
        return Array.isArray(renderedNote) ? renderedNote : [renderedNote]
      }),
      ...view.after,
    ])
  })
  return tutorialNavigation(attrs, [...header, ...(laneContainer ? [h('div', laneContainer, rendered)] : rendered)])
}

/**
 * Place a note along the lane's beat axis. Decorations and interactions are
 * supplied by the caller so playback and editing remain outside the view.
 * @param {'span'|'button'} tag
 * @param {Record<string, any>} attrs
 * @param {(ReturnType<typeof h>|null)[]} children
 * @param {{beat:number, duration:number, laneBeats:number, top:string, omitWidth?:boolean}} position
 */
export function scoreNote(tag, attrs, children, {beat, duration, laneBeats, top, omitWidth = false}) {
  return tutorialNote(tag, {...attrs, style:{...attrs.style, left:`${beat * 100 / laneBeats}%`, width:omitWidth ? undefined : `${duration * 100 / laneBeats}%`, top}}, children)
}

/** @param {number} steps */
export const tutorialStaffTop = steps => `calc(49% + ${steps * 6}px * var(--tutorial-staff-scale))`

/** @param {number} midi */
export const tutorialPitchTop = midi => tutorialStaffTop(3 - Math.max(0, pitches.indexOf(midi)) / 2)

/** Treble clef positions are measured in diatonic steps from middle C. @param {number} midi */
export function scoreStaffStep(midi) {
  const natural = [3,10].includes(midi % 12) ? midi + 1 : pianoKey(midi).black ? midi - 1 : midi
  const pitchClasses = [0,2,4,5,7,9,11]
  return (Math.floor(natural / 12) - 5) * 7 + pitchClasses.indexOf(natural % 12)
}

/** @param {number} midi */
export function scoreTrebleTop(midi) {
  return tutorialStaffTop(3 - scoreStaffStep(midi) / 2)
}

/** @param {number} midi */
export function scoreLedgerOffsets(midi) {
  const step = scoreStaffStep(midi)
  const lines = []
  for (let line = 0; line >= step; line -= 2) lines.push(step - line)
  for (let line = 12; line <= step; line += 2) lines.push(step - line)
  return lines
}

export function tutorialStaffLines() {
  return h('div',{class:'tutorial-staff-overlay'},[0,1,2,3,4].map(i=>h('span',{class:'tutorial-staff-line',style:{top:tutorialStaffTop(2-i)}})))
}

/** @param {number} gridBeats */
export function tutorialSubdivisions(gridBeats) {
  return Array.from({length:gridBeats*3},(_,i)=>{
    const subdivision = i + 1 + Math.floor(i / 3)
    return h('span',{class:['tutorial-subdivision',{'tutorial-subdivision-eighth':subdivision % 2 === 0}],style:{left:`${subdivision*25/gridBeats}%`}})
  })
}

/** @param {{beat:number,midi:number}[]} notes @param {number} index */
export function scoreAccidentalForNote(notes, index) {
  const {beat, midi} = notes[index]
  if (midi % 12 === 3 || midi % 12 === 10) return '♭'
  if (pianoKey(midi).black) return '♯'
  const flatNatural = midi % 12 === 4 || midi % 12 === 11
  const altered = flatNatural ? midi - 1 : midi + 1
  if (![1,3,6,8,10].includes(altered % 12) || (!flatNatural && (altered % 12 === 3 || altered % 12 === 10))) return ''
  const previous = notes.slice(0, index).reverse().find(note =>
    Math.floor(note.beat / 4) === Math.floor(beat / 4) && (note.midi === midi || note.midi === altered))
  return previous?.midi === altered ? '♮' : ''
}

/** @param {string} sign */
export function scoreAccidental(sign) {
  return sign ? h('span',{class:'tutorial-accidental','aria-hidden':'true'},sign) : null
}

/** @param {number} midi */
export const scoreStemDown = midi => midi >= 70

/** @param {readonly {midi:number}[]} notes @param {number} index @param {readonly number[]} breaks */
export function scoreBeamConnects(notes, index, breaks = []) {
  return index > 0 && index < notes.length && !breaks.includes(index)
}

/** Determine one stem direction for a beam from the note farthest from B4.
 * If both extremes are equally distant, choose down.
 * @param {readonly {midi:number}[]} notes */
export function scoreBeamStemDown(notes) {
  const steps = notes.map(note => scoreStaffStep(note.midi) - 6)
  const lowest = Math.min(...steps)
  const highest = Math.max(...steps)
  return highest >= -lowest
}

/** Horizontal beam position and stem lengths, in the note symbol's SVG units.
 * @param {readonly {midi:number}[]} notes */
export function scoreBeamLayout(notes) {
  const down = scoreBeamStemDown(notes)
  const steps = notes.map(note => scoreStaffStep(note.midi))
  const extreme = down ? Math.min(...steps) : Math.max(...steps)
  return {down, referenceIndex:steps.indexOf(extreme), stemLengths:steps.map(step => 17 + 4 * Math.abs(step - extreme))}
}

/** @param {readonly {midi:number}[]} notes @param {number} index @param {readonly number[]} breaks */
export function scoreBeamGroupStemDown(notes, index, breaks = []) {
  let start = index
  let end = index + 1
  while (start > 0 && !breaks.includes(start)) start--
  while (end < notes.length && !breaks.includes(end)) end++
  return end - start > 1 ? scoreBeamStemDown(notes.slice(start, end)) : scoreStemDown(notes[index].midi)
}

/** Group eighth notes in 4/4: four within either half-bar, otherwise two within a beat.
 * @param {readonly {beat:number, length:number, midi:number}[]} notes */
export function scoreEighthGroups(notes) {
  /** @type {number[][]} */
  const groups = []
  for (let index = 0; index < notes.length;) {
    const first = notes[index]
    if (first.length !== .5 || !Number.isInteger(first.beat)) { index++; continue }
    const complete = (/** @type {number} */ count) => Array.from({length:count}, (_, offset) => notes[index + offset])
      .every((note, offset) => note && note.length === .5 && note.beat === first.beat + offset * .5)
    if (first.beat % 2 === 0 && complete(4)) {
      groups.push([index,index + 1,index + 2,index + 3])
      index += 4
    } else if (complete(2)) {
      groups.push([index,index + 1])
      index += 2
    } else index++
  }
  return groups
}

/** @param {{midi:number, duration:number, beam?:boolean, staccato?:boolean, dotY?:number, ledger?:boolean, ledgerOffsets?:number[], stemDown?:boolean, stemLength?:number}} props */
export function tutorialPitchSymbol({midi,duration,beam=false,staccato=false,dotY=15,ledger=midi===60,ledgerOffsets,stemDown,stemLength=17}) {
  const down = stemDown ?? scoreStemDown(midi)
  return h('span',{class:'tutorial-slide-symbol','data-ledger':!ledgerOffsets && ledger ? '' : undefined}, [
    ...(ledgerOffsets ?? []).map(offset => h('span',{class:'score-ledger',style:{top:`calc(var(--tutorial-notehead-offset) + ${offset * 3}px * var(--tutorial-staff-scale))`}})),
    h('svg',{class:'tutorial-note-symbol',viewBox:'0 0 16 24','aria-hidden':'true'},[
      h('ellipse',{cx:5,cy:19,rx:4,ry:2.8,transform:`rotate(${midi >= 62 ? -28 : -18} 5 19)`,fill:duration >= 2 ? 'none' : 'currentColor',stroke:'currentColor','stroke-width':1.5}),
      duration < 4 ? h('path',{d:down ? `M1.2 19V${19 + stemLength}` : `M8.8 19V${19 - stemLength}`,fill:'none',stroke:'currentColor','stroke-width':1.5}) : null,
      !beam && duration <= .75 ? h('path',{d:down ? 'M1.2 36c1.4 -2.4 5 -3 4.2 -7' : 'M9 2c1.4 2.4 5 3 4.2 7',fill:'none',stroke:'currentColor','stroke-width':1.5,'stroke-linecap':'round'}) : null,
      duration < .5 && !staccato && !beam ? h('path',{d:down ? 'M1.2 32c1.4 -2.4 5 -3 4.2 -7' : 'M9 6c1.4 2.4 5 3 4.2 7',fill:'none',stroke:'currentColor','stroke-width':1.5,'stroke-linecap':'round'}) : null,
      staccato ? h('circle',{cx:5,cy:25,r:1.3,fill:'currentColor'}) : null,
      (duration === 1.5 || duration === .75 || duration === .375 || duration === 3) ? h('circle',{cx:13,cy:dotY,r:1.3,fill:'currentColor'}) : null,
    ])])
}

