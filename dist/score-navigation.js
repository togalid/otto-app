import { h } from './vendor/vue.runtime.esm-browser.prod.js'
import { midiKey } from './keyboard.js'

/** @param {{page:number, pageSize:number, totalBars:number, label:string, onPageChange:(page:number)=>void, maxBars?:number, leadingLabel?:string}} options */
export function scorePagination({page, pageSize, totalBars, label, onPageChange, maxBars = totalBars, leadingLabel}) {
  const first = page * pageSize + 1
  const last = Math.min(totalBars, (page + 1) * pageSize)
  return h('div', {class:'tutorial-score-pagination', role:'group', 'aria-label':label}, [
    leadingLabel ? h('span', {class:'score-page-label', 'aria-hidden':'true'}, leadingLabel) : null,
    h('div', {class:'style-stepper part-choice-steps'}, [
      h('button', {type:'button', 'aria-label':`前の${pageSize}小節`, disabled:page === 0, onClick:()=>onPageChange(page - 1)}, '←'),
      h('button', {type:'button', 'aria-label':`次の${pageSize}小節`, disabled:last >= totalBars && last >= maxBars, onClick:()=>onPageChange(page + 1)}, '→'),
    ]),
    h('span', {class:leadingLabel ? 'sr-only' : undefined, 'aria-live':'polite'}, `${first}-${last}`),
  ])
}

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
  const natural = [3,10].includes(midi % 12) ? midi + 1 : midiKey(midi).black ? midi - 1 : midi
  const pitchClasses = [0,2,4,5,7,9,11]
  return (Math.floor(natural / 12) - 5) * 7 + pitchClasses.indexOf(natural % 12)
}

/** @param {number} midi @param {number} [stepOffset] */
export function scoreTrebleTop(midi, stepOffset = 0) {
  return tutorialStaffTop(3 - (scoreStaffStep(midi) + stepOffset) / 2)
}

/** @param {number} midi @param {number} [stepOffset] */
export function scoreLedgerOffsets(midi, stepOffset = 0) {
  const step = scoreStaffStep(midi) + stepOffset
  const lines = []
  for (let line = 0; line >= step; line -= 2) lines.push(step - line)
  for (let line = 12; line <= step; line += 2) lines.push(step - line)
  return lines
}

export function scoreTrebleClefGlyph() {
  // Scale uniformly around the G-line anchor at y=39.
  return h('text', {x:2, y:47, 'font-size':46, transform:'translate(2 39) scale(1.55) translate(-2 -39)'}, '𝄞')
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
  if (midiKey(midi).black) return '♯'
  const flatNatural = midi % 12 === 4 || midi % 12 === 11
  const altered = flatNatural ? midi - 1 : midi + 1
  if (![1,3,6,8,10].includes(altered % 12) || (!flatNatural && (altered % 12 === 3 || altered % 12 === 10))) return ''
  const previous = notes.slice(0, index).reverse().find(note =>
    Math.floor(note.beat / 4) === Math.floor(beat / 4) && (note.midi === midi || note.midi === altered))
  return previous?.midi === altered ? '♮' : ''
}

/** @param {number} fifths */
export function scoreKeySignature(fifths) {
  const pitches = fifths < 0 ? [71,76,69,74,67,72,65] : [77,72,79,74,69,76,71]
  return pitches.slice(0, Math.abs(fifths)).map(midi => ({midi, sign:fifths < 0 ? '♭' : '♯'}))
}

/** @param {number} key */
export function scoreKeyFifths(key) {
  return [0,-5,2,-3,4,-1,6,1,-4,3,-2,5][key] ?? 0
}

/** @param {{beat:number,midi:number}[]} notes @param {(bar:number)=>number} keyForBar */
export function scoreKeyedNotes(notes, keyForBar) {
  /** @type {Map<number, Map<number, number>>} */
  const alterations = new Map()
  const notation = notes.map(() => ({staffMidi:0, sign:''}))
  const ordered = notes.map((note, index) => ({...note, index})).sort((a,b) => a.beat - b.beat)
  for (const {beat, midi, index} of ordered) {
    const bar = Math.floor(beat / 4)
    const fifths = scoreKeyFifths(keyForBar(Math.max(0, bar)))
    const signature = scoreKeySignature(fifths)
    const delta = Math.sign(fifths)
    const inKey = signature.some(entry => (entry.midi + delta) % 12 === midi % 12)
    const altered = inKey ? delta : !midiKey(midi).black ? 0 : [3,10].includes(midi % 12) ? -1 : 1
    const staffMidi = midi - altered
    const keyDefault = signature.some(entry => entry.midi % 12 === staffMidi % 12) ? delta : 0
    let measure = alterations.get(bar)
    if (!measure) {
      measure = new Map()
      alterations.set(bar, measure)
    }
    const previous = measure.get(staffMidi) ?? keyDefault
    measure.set(staffMidi, altered)
    notation[index] = {staffMidi, sign:previous === altered ? '' : altered === 0 ? '♮' : altered > 0 ? '♯' : '♭'}
  }
  return notation
}

const accidentalPaths = {
  '♯': 'M1.8 -7h1.15V8H1.8z M5.05 -8h1.15V7H5.05z M0 -2.5l8 -2v2.8L0 .3z M0 1.5l8 -2v2.8L0 4.3z',
  '♭': 'M1 -9h1.2v7C4 -4 7 -4 7 0c0 2.3-3.1 4-6 5V-9zm1.2 7v5C4 2 5.4.8 5.4-.7 5.4-2.3 3.7-2.8 2.2-2z',
  '♮': 'M1 -8h1.2v6L6 -3v-1h1.2V8H6V3L1 4zm1.2 7v3L6 1v-3z',
}

/** @param {string} sign */
export function scoreAccidentalGlyph(sign) {
  const path = accidentalPaths[/** @type {keyof typeof accidentalPaths} */ (sign)]
  return path ? h('svg', {class:'score-accidental-glyph',viewBox:'0 -9 8 18','aria-hidden':'true'},
    [h('path', {d:path,fill:'currentColor','fill-rule':sign === '♯' ? 'nonzero' : 'evenodd'})]) : sign
}

/** @param {string} sign */
export function scoreAccidental(sign) {
  return sign ? h('span',{class:'tutorial-accidental','aria-hidden':'true'},[scoreAccidentalGlyph(sign)]) : null
}

/** @param {number} midi */
export const scoreStemDown = midi => midi >= 70

/** @param {readonly {midi:number}[]} notes @param {number} index @param {readonly number[]} breaks */
export function scoreBeamConnects(notes, index, breaks = []) {
  return index > 0 && index < notes.length && !breaks.includes(index)
}

/** Determine one stem direction for a beam from the note farthest from B4.
 * If both extremes are equally distant, choose down.
 * @param {readonly {midi:number}[]} notes @param {number} [stepOffset] */
export function scoreBeamStemDown(notes, stepOffset = 0) {
  const steps = notes.map(note => scoreStaffStep(note.midi) + stepOffset - 6)
  const lowest = Math.min(...steps)
  const highest = Math.max(...steps)
  return highest >= -lowest
}

/** Horizontal beam position and stem lengths, in the note symbol's SVG units.
 * @param {readonly {midi:number}[]} notes @param {number} [stepOffset] */
export function scoreBeamLayout(notes, stepOffset = 0) {
  const down = scoreBeamStemDown(notes, stepOffset)
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

/** @param {readonly {beat:number, length:number, midi:number}[]} notes */
export function scoreRhythmGroups(notes) {
  const groups = scoreEighthGroups(notes)
  for (let index = 0; index < notes.length;) {
    const first = notes[index]
    if (first.length !== .25 && first.length !== .5) { index++; continue }
    const group = [index++]
    const beatEnd = Math.floor(first.beat) + 1
    while (index < notes.length && (notes[index].length === .25 || notes[index].length === .5) &&
           notes[index].beat + notes[index].length <= beatEnd &&
           notes[index].beat === notes[index - 1].beat + notes[index - 1].length) {
      group.push(index++)
    }
    if (group.length > 1 && group.some(i => notes[i].length === .25)) groups.push(group)
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

