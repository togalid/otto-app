/** Pure register/voice-leading policy, separate from chord identity and labels. */
import { chordConfig, bassHarmonyNotes, orderedSlashShapes, isPlainFifthSeven, keys } from './chord-harmony.js'
/** @typedef {import('./chord-harmony.js').ChordConfig} ChordConfig */

/** @typedef {{notes: number[], hand: number[], bass?: number, cost: number}} Voicing */
// MIDI pitches for one bass note and an independently positioned right hand.
// Each candidate keeps the same bass pitch class, including written slash basses.
/** @param {readonly number[]} reference @param {boolean} [phrase] */
function voicingOptions(reference, phrase = false) {
  const bass = reference[0]
  const pitches = [...new Set(reference.slice(1).map(note => note % 12))]
  /** @type {Voicing[]} */
  const options = []
  const basses = [bass]
  if (bass + 12 <= (phrase ? 57 : 55)) basses.push(bass + 12)
  if (bass - 12 >= (phrase ? 40 : 41)) basses.push(bass - 12)
  for (const low of basses) {
    /** @param {number} index @param {number[]} upper */
    function place(index, upper) {
      if (index < pitches.length) {
        for (let note = 53 + ((pitches[index] - 53 + 60) % 12); note <= 76; note += 12) {
          if (note >= low + 5) place(index + 1, [...upper, note])
        }
        return
      }
      upper.sort((a, b) => a - b)
      const top = upper[upper.length - 1]
      let cost = Math.abs(top - 68) * 0.55 + Math.abs(upper[0] - 59) * 0.35
      cost += Math.max(0, upper[0] - low - 19) + Math.max(0, top - upper[0] - 15)
      cost += Math.abs(low - 46) * 0.25
      for (let i = 1; i < upper.length; i++) {
        const gap = upper[i] - upper[i - 1]
        // A close semitone, especially low in the pad, masks the colour tone.
        if (gap === 1) cost += upper[i] < 65 ? 10 : 6
        cost += Math.max(0, gap - 8)
      }
      options.push({ notes: [low, ...upper], hand: upper, bass: low, cost })
    }
    place(0, [])
  }
  return options.sort((a, b) => a.cost - b.cost)
}

/** Match the upper voices in pitch order, allowing a voice to split/join when
 * a triad changes to a seventh or an extended harmony. @param {Voicing} from @param {Voicing} to */
function movement(from, to) {
  const a = from.hand, b = to.hand
  const count = Math.max(a.length, b.length)
  let cost = 0
  for (let i = 0; i < count; i++) {
    const pos = count === 1 ? 0 : i / (count - 1)
    const distance = Math.abs(a[Math.round(pos * (a.length - 1))] - b[Math.round(pos * (b.length - 1))])
    cost += distance + Math.max(0, distance - 4) * 1.5
  }
  const bassLeap = from.bass === undefined || to.bass === undefined ? 0 : Math.abs(from.bass - to.bass)
  return cost / count * 2 + Math.abs(a[a.length - 1] - b[b.length - 1]) * 0.8 +
    bassLeap * 0.25 + Math.max(0, bassLeap - 7) * 2
}

/** @param {Voicing} anchor @param {Voicing[][]} candidates */
function bestPath(anchor, candidates) {
  let previous = [{ option: anchor, cost: 0 }]
  /** @type {{option: Voicing, parent: number}[][]} */
  const layers = []
  for (const options of candidates) {
    const layer = options.map(option => {
      let cost = Infinity, parent = 0
      previous.forEach((source, index) => {
        const candidate = source.cost + movement(source.option, option)
        if (candidate < cost) { cost = candidate; parent = index }
      })
      return { option, cost: cost + option.cost, parent }
    })
    layers.push(layer)
    previous = layer
  }
  let best = 0, bestCost = Infinity
  previous.forEach((option, index) => {
    const cost = option.cost + movement(option.option, anchor)
    if (cost < bestCost) { best = index; bestCost = cost }
  })
  const result = [anchor]
  for (let i = layers.length - 1; i >= 0; i--) {
    const option = layers[i][best]
    result[i + 1] = option.option
    best = option.parent
  }
  return result
}

/** Choose positions around the whole loop. A second pass lets the first
 * chord respond to the ending, too. @param {{id: string, key: number, voicing?:string}[]} cells */
export function voicePhrase(cells) {
  if (!cells.length) return []
  const options = cells.map(cell => {
    const original=chordOptions(cell.id,cell.key,true)
    if(!cell.voicing || cell.voicing==='auto')return original
    const candidates=original.flatMap(option=>{
      const variants=[option.hand]
      if(cell.voicing==='open' && option.hand.length>=3){
        for(let i=0;i<option.hand.length-1;i++)variants.push(option.hand.map((note,index)=>index===i?note+12:note).sort((a,b)=>a-b))
      }
      return variants.filter(hand=>hand[hand.length-1]<=84).map(hand=>{
        const span=hand[hand.length-1]-hand[0]
        let cost=option.cost + (cell.voicing==='open'?Math.max(0,14-span)*3:Math.max(0,span-11)*4)
        for(let i=1;i<hand.length;i++)if(hand[i]<60 && hand[i]-hand[i-1]<3)cost+=15
        const bass=option.bass
        return {...option,hand,notes:bass===undefined?[...hand]:[bass,...hand],cost}
      })
    })
    return candidates.sort((a,b)=>a.cost-b.cost).slice(0,24)
  })
  const anchor = cells[0].voicing && cells[0].voicing!=='auto' ? options[0][0] : chordOptions(cells[0].id, cells[0].key, false)[0]
  if (cells.length === 1) return [anchor.notes]
  const initial = bestPath(anchor, options.slice(1))
  const end = initial[initial.length - 1]
  const final = bestPath(end, options.slice(0, -1)).slice(1)
  return [...final, end].map(option => option.notes)
}

const colourExtensions = new Set(['9', 'maj9', 'add9', '11', 'add11',
  '13', 'maj13', 'b9', 'b13', 'b9_13', 's9_13', 'b9_b13', 's9_b13'])

/** Comping shapes fit in one hand. With a seventh present, leave the root to
 * the bass. A four-note grip retains the defining guide and colour tones.
 * @param {ChordConfig} config @param {number[]} harmony @returns {Voicing[]} */
function compingOptions(config, harmony) {
  const root = harmony[0] % 12
  const isAdded = config.extension.startsWith('add')
  const intervals = [...new Set(harmony.map(n => (n - harmony[0] + 120) % 12))]
    .filter(interval => isAdded || interval !== 0)
  if (intervals.length > 4 && intervals.includes(7)) intervals.splice(intervals.indexOf(7), 1)
  const third = ['maj', 'aug'].includes(config.quality) ? 4 : config.quality === 'sus4' ? 5 : 3
  const seventh = config.extension.startsWith('maj') ? 11 : 10
  const options = []
  // Rotate the closed shape. Prefer a guide-tone foundation and a colour
  // note on top. Seconds in the middle give the pad its soft cluster.
  for (let low = 52; low <= 67; low++) {
    const lowerRole = (low - root + 12) % 12
    if (!intervals.includes(lowerRole)) continue
    const notes = intervals.map(i => low + ((i - lowerRole + 12) % 12)).sort((a, b) => a - b)
    const top = notes[notes.length - 1]
    const topRole = (top - root + 12) % 12
    let cost = Math.abs(top - 69) * 0.65 + Math.abs(low - 59) * 0.3
    if (lowerRole !== third && lowerRole !== seventh && !(isAdded && lowerRole === 0)) cost += 2.5
    if ([1, 2, 8, 9].includes(topRole)) cost -= 1.2
    if (notes[1] - low <= 1 && low < 60) cost += 5
    if (top - notes[notes.length - 2] === 1) cost += 4
    options.push({ notes, hand: notes, cost })
  }
  return options.sort((a, b) => a.cost - b.cost)
}

/** @param {string} id @param {number} key @param {boolean} phrase @returns {Voicing[]} */
function chordOptions(id, key, phrase) {
  const config = chordConfig(id)
  const harmony = bassHarmonyNotes(id, key)
  if (config.quality === 'maj' && config.extension === 'b13') {
    // Root, flat seventh, third, flat thirteenth; omit the fifth.
    const root = ((harmony[0] % 12) + 12) % 12
    const options = []
    for (let low = 48; low <= 59; low++) {
      if (low % 12 !== root) continue
      const notes = [low, low + 10, low + 16, low + 20]
      options.push({ notes, hand: notes.slice(1), bass: low, cost: Math.abs(low - 53) * 0.8 })
    }
    return options
  }
  if (config.quality === 'slash' && orderedSlashShapes.has(config.extension)) {
    const bass = 48 + ((harmony[0] % 12 + 12) % 12)
    const notes = harmony.map(note => note + bass - harmony[0])
    return [{ notes, hand: notes.slice(1), bass, cost: 0 }]
  }
  if (isPlainFifthSeven(config)) {
    // Ordered ♭7, R, 3, 5 (F G B D in C). An octave change is allowed,
    // but reversing the order would lose the intended close voicing.
    const options = []
    for (let low = 50; low <= 67; low++) {
      if (low % 12 !== (5 + key) % 12) continue
      const notes = [low, low + 2, low + 6, low + 9]
      options.push({ notes, hand: notes, cost: Math.abs(low - 59) * 0.8 })
    }
    return options.sort((a, b) => a.cost - b.cost)
  }
  if (colourExtensions.has(config.extension)) return compingOptions(config, harmony)
  const bass = 41 + (((harmony[0] - 41) % 12 + 12) % 12)
  if (config.quality === 'maj' && config.extension === '7') {
    return voicingOptions([bass, bass + 4, bass + 7, bass + 10], phrase)
  }
  let notes = constrainVoicing(harmony.map(note => note + bass - harmony[0]))
  // The original Fmaj7 puts the third above the fifth and seventh.
  if (bass === 41 && notes.length === 4 && notes[1] === 57 && notes[2] === 60 && notes[3] === 64)
    notes = [bass, 60, 64, 69]
  return phrase ? voicingOptions(notes, true) : [{ notes, hand: notes.slice(1), bass, cost: 0 }]
}

/** @param {string} id @param {number} key */
export function chordNotes(id, key) {
  return chordOptions(id, key, false)[0].notes
}
/** Keep the bass above F2 and every upper voice below G5. Low basses use
 * a close upper structure in A3–A4. Preserve pitch classes and bass choice.
 * @param {readonly number[]} notes @returns {number[]} */
export function constrainVoicing(notes) {
  if (!notes.length) return []
  let bass = notes[0]
  while (bass < 41) bass += 12
  while (bass > 67) bass -= 12
  const upper = notes.slice(1).map((note) => {
    if (bass <= 47) return 57 + (((note - 57) % 12 + 12) % 12)
    while (note > 79) note -= 12
    while (note <= bass) note += 12
    return note
  })
  return [bass, ...new Set(upper.sort((a, b) => a - b))]
}
/** Explicit voicings for the chord-pad audition, transposed from key C.
 * @param {string} id @param {number} key @returns {number[]} */
export function padChordNotes(id, key) {
  const config = chordConfig(id)
  const voicings = new Map([
    ['3:maj:maj7', [41, 57, 60, 64]],
    ['3:maj:maj9', [41, 55, 57, 60, 64]],
    ['5:min:7', [45, 55, 57, 60, 64]],
    ['5:min:9', [45, 55, 59, 62]],
    ['0:maj:maj7', [36, 59, 60, 64, 67]],
    ['1:min:7', [38, 65, 69, 72]],
    ['4:maj:7', [43, 53, 55, 59, 62]],
    ['0:min:7', [48, 58, 60, 63, 67]],
    ['1:min:9', [50, 60, 65, 69, 72, 76]],
    ['2:sus4:7', [52, 55, 60, 62, 67]],
    ['2:min:7', [40, 55, 59, 62]],
  ])
  if (!Number.isInteger(key) || !keys[key]) throw new RangeError('Unknown key')
  const notes = config.alter === 0 ? voicings.get(`${config.root}:${config.quality}:${config.extension}`) : undefined
  const offset = key > 6 ? key - 12 : key
  const result = notes ? notes.map(note => note + offset) : chordNotes(id, key)
  if (config.root === 5 && config.alter === 0 &&
      ((config.quality === 'min' && config.extension === '9') ||
       (config.quality === 'slash' && ['pad_10_maj', 'pad_8_maj7'].includes(config.extension)))) {
    result.unshift(33 + offset)
  }
  return result
}
