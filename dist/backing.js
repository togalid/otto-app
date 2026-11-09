import { swungBassBeat } from './groove.js'

export const backingPatterns = Object.freeze([
  { id: 'trance-weave', label: '16分アルペジオ・往復' },
  { id: 'satin-comp', label: 'シンコペーション・軽め' },
  { id: 'sync-varied', label: 'シンコペーション・変化' },
  { id: 'whole', label: '白玉（のばす）' },
  { id: 'quarters', label: '4分刻み' },
  { id: 'eighths', label: '8分刻み' },
  { id: 'offbeat', label: '裏拍' },
  { id: 'arpeggio', label: 'アルペジオ' },
  { id: 'bass-chord', label: 'ベース＋コード' },
  { id: 'key-run', label: '鍵盤の折り返し' },
  { id: 'cutting', label: '16分カッティング' },
  { id: 'stabs', label: 'シンコペーション・食い込み' },
  { id: 'chip-riff', label: 'チップ・リフ' },
  { id: 'strum', label: 'ストラム' },
])
export const melodyArpeggioPatterns = Object.freeze(['arpeggio', 'trance-weave', 'key-run', 'chip-riff'])
// Arpeggiated figures belong to the colour parts; retain the generators for compatibility.
export const chordBackingPatterns = Object.freeze(backingPatterns.filter(pattern => !melodyArpeggioPatterns.includes(pattern.id)))
/** @typedef {{beat: number, duration: number, notes: readonly number[], level?: number}} BackingEvent */
/** @param {readonly number[]} notes @param {string} pattern @param {number} [bassPitch] @param {number} [bar] @returns {BackingEvent[]} */
export function backingEvents(notes, pattern, bassPitch, bar = 0) {
  if (!notes.length) return []
  if (!backingPatterns.some((item) => item.id === pattern))
    throw new RangeError('Unknown backing')
  if (pattern === 'sync-varied') return (bar % 2 ? [[.5,.3,.7],[1.75,.2,.55],[2.5,.65,1],[3.5,.35,.8]] : [[0,.7,1],[1.5,.3,.7],[3,.55,.85]]).map(([beat,duration,level])=>({beat,duration,level,notes}))
  if (pattern === 'trance-weave') {
    const ordered = [...notes].sort((a, b) => a - b)
    const cycle = ordered.length === 1 ? ordered : [...ordered, ...ordered.slice(1, -1).reverse()]
    return Array.from({ length: 16 }, (_, index) => ({
      beat: index / 4,
      duration: index % 4 === 0 ? 0.22 : 0.17,
      notes: [cycle[index % cycle.length]],
      level: index % 4 === 0 ? 0.9 : index % 2 ? 0.62 : 0.76,
    }))
  }
  if (pattern === 'satin-comp') {
    const ordered = [...notes].sort((a, b) => a - b)
    const upper = ordered.length > 2 ? ordered.slice(1) : ordered
    // A soft downbeat, clipped upper-voice answers and a late pickup leave room for the song.
    return [[0, 0.7, 0.98], [0.75, 0.19, 0.76], [1.5, 0.36, 1], [2.5, 0.48, 0.94], [3.5, 0.32, 0.82]]
      .map(([beat, duration, level], index) => ({ beat, duration, level, notes: index === 0 ? ordered : upper }))
  }
  if (pattern === 'whole') return [{ beat: 0, duration: 3.68, notes }]
  if (pattern === 'arpeggio') {
    const ordered = [...notes].sort((a, b) => a - b)
    const top = ordered.length - 1
    const mid = Math.floor(top / 2)
    const phrases = [
      [[0, 0, .42, .92], [.5, mid, .3, .68], [1, top, .65, .86], [2, mid, .32, .72], [2.5, top, .3, .8], [3, 0, .72, .83]],
      [[0, 0, .66, .88], [1, mid, .32, .73], [1.5, top, .34, .9], [2, mid, .42, .75], [2.75, 0, .2, .62], [3, mid, .72, .82]],
    ]
    return phrases[Math.floor(bar / 2) % phrases.length].map(([beat, voice, duration, level]) => ({
      beat, duration, level, notes: [ordered[voice]],
    }))
  }
  if (pattern === 'key-run') {
    const ordered = [...notes].sort((a, b) => a - b)
    const top = ordered.length - 1
    const middle = Math.floor(top / 2)
    // A rising pickup followed by a descending answer leaves the backbeat exposed.
    return [[0, 0, 0.35], [0.5, middle, 0.19], [0.75, top, 0.21], [1.5, top, 0.42],
      [2, middle, 0.32], [2.5, top, 0.19], [2.75, middle, 0.2], [3.25, 0, 0.55]]
      .map(([beat, voice, duration]) => ({ beat, duration, notes: [ordered[voice]], level: beat % 1 ? 0.72 : 0.94 }))
  }
  if (pattern === 'cutting') {
    // Alternate terse sixteenth chops and a longer answer on the last offbeat.
    return [[0.25, 0.12, 0.72], [0.75, 0.15, 0.88], [1.5, 0.26, 0.98], [2.25, 0.12, 0.72],
      [2.75, 0.14, 0.88], [3.5, 0.38, 1]]
      .map(([beat, duration, level]) => ({ beat, duration, level, notes }))
  }
  if (pattern === 'stabs') {
    // Leave room for the bass drum, then answer it with a clipped chord.
    return [[0.5, 0.23, 0.88], [1.75, 0.18, 0.65], [2.5, 0.56, 1], [3.75, 0.18, 0.76]]
      .map(([beat, duration, level]) => ({ beat, duration, level, notes }))
  }
  if (pattern === 'chip-riff') {
    // Repeat a low anchor and let the top voice answer across the bar line.
    const ordered = [...notes].sort((a, b) => a - b)
    const middle = ordered[Math.floor(ordered.length / 2)]
    const top = ordered[ordered.length - 1]
    return [[0, ordered[0], 0.32], [0.75, ordered[0], 0.17], [1, middle, 0.42],
      [1.75, top, 0.18], [2, ordered[0], 0.52], [3, top, 0.25], [3.5, middle, 0.34]]
      .map(([beat, note, duration]) => ({ beat, notes: [note], duration, level: beat % 1 ? 0.72 : 0.94 }))
  }
  if (pattern === 'bass-chord') {
    const lowest = Math.min(...notes)
    const bass = bassPitch == null || lowest % 12 === bassPitch % 12 ? lowest : 41 + ((bassPitch - 41 + 120) % 12)
    const upper = notes.filter((note) => note !== bass)
    return Array.from({ length: 4 }, (_, beat) => ({
      beat,
      duration: beat % 2 === 0 ? 0.82 : 0.48,
      notes: beat % 2 === 0 ? [bass] : upper.length ? upper : [bass],
      level: beat % 2 === 0 ? 0.9 : 0.72,
    }))
  }
  if (pattern === 'strum')
    return Array.from({ length: 4 }, (_, beat) =>
      notes.map((note, index) => ({
        beat: beat + index * 0.03,
        duration: beat % 2 === 0 ? 0.68 : 0.42,
        notes: [note],
        level: (beat % 2 === 0 ? 1 : 0.75) / Math.sqrt(notes.length),
      })),
    ).flat()
  const eighths = pattern === 'eighths'
  return Array.from({ length: eighths ? 8 : 4 }, (_, index) => ({
    beat: eighths ? index / 2 : index + (pattern === 'offbeat' ? 0.5 : 0),
    duration: eighths ? (index % 2 === 0 ? 0.44 : 0.36) : pattern === 'offbeat' ? (index % 2 === 0 ? 0.48 : 0.4) : (index % 2 === 0 ? 0.8 : 0.62),
    notes,
    level: eighths ? (index % 2 === 0 ? 0.9 : 0.62) : index % 2 === 0 ? 0.92 : 0.7,
  }))
}

/** Adjust the authored articulation while keeping 50% as the original sound.
 * @param {number} duration @param {number} level @param {{length:number,dynamics:number,touch?:string}|undefined} expression */
export function backingArticulation(duration, level, expression) {
  const length = expression?.length ?? 50, dynamics = expression?.dynamics ?? 50
  return {duration: duration * (0.3 + length * 0.014) * (expression?.touch === 'cutting' ? .45 : 1), level: Math.max(0, Math.min(1, 1 + (level - 1) * dynamics * .02))}
}

/** @param {readonly number[]} notes @param {string|undefined} touch */
export function backingAttacks(notes,touch) {
 return touch==='strum' ? notes.map((note,index)=>({notes:[note],delay:index*.012,gain:1/Math.sqrt(notes.length)})) : [{notes:[...notes],delay:0,gain:1}]
}

/** Plan chord attacks in seconds relative to the requested start beat.
 * @param {{changes:{beat:number,chord:string,notes:number[],bassNotes:readonly number[]}[],
 * startBeat:number,beatsPerBar:number,bpm:number,duration:number,swing:number,pattern:string,
 * steps?:{enabled:boolean,duration:number,level:number}[],expression?:Parameters<typeof backingArticulation>[2],
 * eventsFor:(notes:number[],pattern:string,root:number)=>BackingEvent[]}} bar
 */
export function* planBackingBar(bar) {
  const {changes,startBeat,beatsPerBar,bpm,duration,swing,pattern,steps,expression,eventsFor} = bar
  if (!changes.length) return
  if (steps) {
    let index = 0
    for (const [stepIndex,step] of steps.entries()) {
      const beat = stepIndex / 4
      if (!step.enabled || beat < startBeat || beat >= beatsPerBar) continue
      while (changes[index + 1]?.beat <= beat) index++
      const {notes,chord} = changes[index]
      const end = changes[index + 1]?.beat ?? beatsPerBar
      const art = backingArticulation(step.duration,step.level,expression)
      yield {notes,chord,offset:(beat-startBeat)*60/bpm,length:Math.min(art.duration,end-beat)*60/bpm,level:art.level}
    }
    return
  }
  for (const [index,change] of changes.entries()) {
    const end = changes[index + 1]?.beat ?? beatsPerBar
    if (pattern === 'whole') {
      if (end <= startBeat) continue
      const from = Math.max(change.beat,startBeat)
      const art = backingArticulation((end-from)*.92,1,expression)
      yield {notes:change.notes,chord:change.chord,offset:(from-startBeat)*duration/beatsPerBar,
        length:Math.min(art.duration,end-from)*duration/beatsPerBar,level:art.level}
      continue
    }
    for (const event of eventsFor(change.notes,pattern,change.bassNotes[0])) {
      const beat = swungBassBeat(event.beat*2,swing)
      if (beat < change.beat || beat < startBeat || beat >= end) continue
      const art = backingArticulation(event.duration,event.level ?? 1,expression)
      yield {notes:event.notes,chord:change.chord,offset:(beat-startBeat)*duration/beatsPerBar,
        length:(Math.min(art.duration,end-beat)/beatsPerBar)*duration,level:art.level}
    }
  }
}
