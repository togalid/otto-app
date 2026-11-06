export const notes = Object.freeze([
  { midi: 60, label: 'ド', key: 'a', color: '#f4baa7' },
  { midi: 62, label: 'レ', key: 's', color: '#f1d19a' },
  { midi: 64, label: 'ミ', key: 'd', color: '#e4df9c' },
  { midi: 67, label: 'ソ', key: 'f', color: '#b7d9bf' },
  { midi: 69, label: 'ラ', key: 'j', color: '#add8d8' },
  { midi: 72, label: 'ド', key: 'k', color: '#b9cbed' },
  { midi: 74, label: 'レ', key: 'l', color: '#cdc1e9' },
  { midi: 76, label: 'ミ', key: ';', color: '#e9bfd0' },
])
/** @param {number} midi */
export function frequency(midi) {
  return 440 * 2 ** ((midi - 69) / 12)
}

/** @type {Readonly<Record<string, readonly number[]>>} */
export const chords = Object.freeze({
  C: [48, 60, 64, 67],
  CM7: [48, 59, 64, 67],
  Bm7b5: [47, 57, 62, 65],
  Dm7: [50, 60, 65, 69],
  Em7: [52, 59, 62, 67],
  F: [53, 60, 65, 69],
  FM7: [53, 60, 64, 69],
  G: [55, 59, 62, 67],
  G7: [43, 59, 62, 65],
  Am7: [45, 60, 64, 67],
})
export const defaultProgression = Object.freeze([
  'FM7',
  'G',
  'Em7',
  'Am7',
  'FM7',
  'G',
  'Em7',
  'Am7',
])
/** @param {number} bpm */
export function barDuration(bpm) {
  if (!Number.isFinite(bpm) || bpm < 40 || bpm > 200)
    throw new RangeError('テンポは40〜200です')
  return 240 / bpm
}

export const chordChoices = Object.freeze([
  { id: 'CM7', degree: '1△7', root: 0, suffix: 'M7' },
  { id: 'Dm7', degree: '2m7', root: 1, suffix: 'm7' },
  { id: 'Em7', degree: '3m7', root: 2, suffix: 'm7' },
  { id: 'FM7', degree: '4△7', root: 3, suffix: 'M7' },
  { id: 'G7', degree: '57', root: 4, suffix: '7' },
  { id: 'Am7', degree: '6m7', root: 5, suffix: 'm7' },
  { id: 'Bm7b5', degree: '7m7♭5', root: 6, suffix: 'm7♭5' },
  { id: 'C', degree: '1', root: 0, suffix: '' },
  { id: 'F', degree: '4', root: 3, suffix: '' },
  { id: 'G', degree: '5', root: 4, suffix: '' },
])
export const keys = Object.freeze([
  { name: 'C', scale: ['C', 'D', 'E', 'F', 'G', 'A', 'B'] },
  { name: 'D♭', scale: ['D♭', 'E♭', 'F', 'G♭', 'A♭', 'B♭', 'C'] },
  { name: 'D', scale: ['D', 'E', 'F♯', 'G', 'A', 'B', 'C♯'] },
  { name: 'E♭', scale: ['E♭', 'F', 'G', 'A♭', 'B♭', 'C', 'D'] },
  { name: 'E', scale: ['E', 'F♯', 'G♯', 'A', 'B', 'C♯', 'D♯'] },
  { name: 'F', scale: ['F', 'G', 'A', 'B♭', 'C', 'D', 'E'] },
  { name: 'F♯', scale: ['F♯', 'G♯', 'A♯', 'B', 'C♯', 'D♯', 'E♯'] },
  { name: 'G', scale: ['G', 'A', 'B', 'C', 'D', 'E', 'F♯'] },
  { name: 'A♭', scale: ['A♭', 'B♭', 'C', 'D♭', 'E♭', 'F', 'G'] },
  { name: 'A', scale: ['A', 'B', 'C♯', 'D', 'E', 'F♯', 'G♯'] },
  { name: 'B♭', scale: ['B♭', 'C', 'D', 'E♭', 'F', 'G', 'A'] },
  { name: 'B', scale: ['B', 'C♯', 'D♯', 'E', 'F♯', 'G♯', 'A♯'] },
])
const scaleIntervals = [0, 2, 4, 5, 7, 9, 11]
const chromaticNames = [
  'C',
  'D♭',
  'D',
  'E♭',
  'E',
  'F',
  'G♭',
  'G',
  'A♭',
  'A',
  'B♭',
  'B',
]
const degreeNames = [
  '1',
  '♭2',
  '2',
  '♭3',
  '3',
  '4',
  '♯4',
  '5',
  '♭6',
  '6',
  '♭7',
  '7',
]
/** @typedef {{root: number, quality: string, extension: string, alter: number}} ChordConfig */
/** @param {string} id @returns {ChordConfig} */
export function chordConfig(id) {
  const known = chordChoices.find((choice) => choice.id === id)
  if (known)
    return {
      root: known.root,
      quality:
        id === 'Bm7b5' ? 'dim' : known.suffix.startsWith('m') ? 'min' : 'maj',
      extension:
        known.suffix === 'M7'
          ? 'maj7'
          : known.suffix.includes('7')
            ? '7'
            : 'none',
      alter: 0,
    }
  const [prefix, root, quality, extension, alter, extra] = id.split(':')
  if (
    prefix !== 'x' ||
    !/^[0-6]$/.test(root) ||
    !['maj', 'min', 'dim', 'sus4', 'sus2', 'aug', 'slash'].includes(quality) ||
    ![
      'none',
      '7',
      'maj7',
      '9',
      'maj9',
      'add9',
      '11',
      'add11',
      'b9',
      'b13',
      'b9_13',
      's9_13',
      '6',
      '13',
      'maj13',
      'dim7',
      '7inv',
      'b9_b13',
      's9_b13',
      'v_over_7',
      'iv_over_v',
      'iii_aug_sharp4',
    ].includes(extension) ||
    !/^([0-9]|1[01])$/.test(alter) ||
    extra !== undefined
  )
    throw new RangeError('Unknown chord')
  return {
    root: Number(root),
    quality,
    extension,
    alter: Number(alter),
  }
}

/** A playful listening prompt, not a claim that a chord has one fixed emotion.
 * @param {string} chord @param {number | null} previousKey @param {number} key @param {number} bar @param {boolean} [edited] @param {number} [beat] */
export function navigatorReaction(chord, previousKey, key, bar, edited = false, beat = 0) {
  if (previousKey !== null && previousKey !== key) return '転調した！！'
  if (edited) return ['一味違うね！', 'グッとくるね！', 'エモい！', 'その響き、いいね！', 'おっ、素敵な選び方！'][(bar * 4 + beat) % 5]
  const { quality, extension } = chordConfig(chord)
  if (quality === 'dim' || ['b9', 'b9_b13', 's9_b13', 'b9_13', 's9_13'].includes(extension))
    return 'おっ、緊張感がある…この先が気になる！'
  if (['maj9', '9', 'maj13', '13', 'add9', '11', 'add11'].includes(extension))
    return bar % 2 === 0 ? 'エモい…！ 響きがふわっと広がるね。' : 'この余韻、気持ちいいな…'
  if (quality === 'min') return bar % 2 === 0 ? 'ちょっと切なくなる…' : 'この響き、じんわりくるね。'
  if (quality === 'sus2' || quality === 'sus4') return 'まだ着地しない感じが、いいね。'
  return bar % 2 === 0 ? 'いい感じ！ どこへ向かうかな？' : 'この流れ、心地いいね。'
}
/** @param {ChordConfig} chord */
export function customChord(chord) {
  const id = `x:${chord.root}:${chord.quality}:${chord.extension}:${chord.alter}`
  chordConfig(id)
  return id
}
/** @param {string} id @param {number} key @param {boolean} degrees */
export function chordParts(id, key, degrees) {
  const chord = chordConfig(id)
  if (!keys[key]) throw new RangeError('Unknown key')
  const pitch = (scaleIntervals[chord.root] + chord.alter) % 12
  if (chord.quality === 'slash') {
    const upper =
      chord.extension === 'v_over_7'
        ? 7
        : chord.extension === 'iv_over_v'
          ? 5
          : 4
    const upperName = chromaticNames[(upper + key) % 12]
    const bassName = chromaticNames[(pitch + key) % 12]
    return degrees
      ? {
          main: degreeNames[pitch],
          suffix:
            chord.extension === 'v_over_7'
              ? 'V/7'
              : chord.extension === 'iv_over_v'
                ? 'IV/5'
                : 'III+/♯4',
        }
      : {
          main: upperName,
          suffix:
            (chord.extension === 'iii_aug_sharp4' ? '+' : '') + '/' + bassName,
        }
  }
  const main = degrees
    ? degreeNames[pitch]
    : chord.alter === 0
      ? keys[key].scale[chord.root]
      : chromaticNames[(pitch + key) % 12]
  const quality =
    chord.quality === 'min'
      ? 'm'
      : chord.quality === 'dim'
        ? chord.extension === 'none' || chord.extension === 'dim7'
          ? 'dim'
          : 'm'
        : ''
  const extension =
    chord.extension === 'none'
      ? ''
      : chord.extension === 'maj7'
        ? '△7'
        : chord.extension === 'maj9'
          ? '△9'
          : chord.extension === 'maj13'
            ? '△13'
            : chord.extension === 'dim7' || chord.extension === '7inv'
              ? '7'
              : chord.extension
  return {
    main,
    suffix:
      chord.quality === 'sus2'
        ? 'sus2'
        : chord.quality === 'sus4'
          ? chord.extension === 'none'
            ? 'sus4'
            : chord.extension === '9'
              ? '9sus4'
              : '7sus4'
          : (chord.quality === 'aug' ? 'aug' : quality) +
            (chord.extension === '7inv' && !degrees && !(chord.root === 4 && chord.alter === 0)
              ? '7/' + chromaticNames[(pitch + key + 10) % 12]
              : chord.extension === 'b9_b13'
                ? '7(♭9,♭13)'
                : chord.extension === 's9_b13'
                  ? '7(♯9,♭13)'
                  : chord.extension === 'add11'
                    ? '(9,11)'
                    : chord.extension === 'b13'
                      ? '7(♭13)'
                      : chord.extension === 'b9'
                      ? '7(♭9)'
                      : chord.extension === 'b9_13'
                        ? '7(♭9,13)'
                        : chord.extension === 's9_13'
                          ? '7(♯9,13)'
                          : extension) +
            (chord.quality === 'dim' &&
            !['none', 'dim7'].includes(chord.extension)
              ? '♭5'
              : ''),
  }
}
/** @param {string} id @param {number} key @param {boolean} degrees */
export function chordLabel(id, key, degrees) {
  const parts = chordParts(id, key, degrees)
  return parts.main + parts.suffix
}
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
 * chord respond to the ending, too. @param {{id: string, key: number}[]} cells */
export function voicePhrase(cells) {
  if (!cells.length) return []
  const options = cells.map(cell => chordOptions(cell.id, cell.key, true))
  const anchor = chordOptions(cells[0].id, cells[0].key, false)[0]
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

/** @param {ChordConfig} config */
function isPlainFifthSeven(config) {
  return config.root === 4 && config.alter === 0 && config.quality === 'maj' &&
    ['7', '7inv'].includes(config.extension)
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
/** @param {string} id @param {number} key */
export function bassHarmonyNotes(id, key) {
  const chord = chordConfig(id)
  if (!Number.isInteger(key) || !keys[key]) throw new RangeError('Unknown key')
  const offset = key > 6 ? key - 12 : key
  if (chords[id]) return chords[id].map((note) => note + offset)
  const bass = 48 + ((scaleIntervals[chord.root] + chord.alter) % 12) + offset
  if (chord.quality === 'slash') {
    const intervals =
      chord.extension === 'v_over_7'
        ? [-4, 0, 3]
        : chord.extension === 'iv_over_v'
          ? [-2, 2, 5]
          : [-2, 2, 6]
    return [bass - 12, ...intervals.map((interval) => bass + 12 + interval)]
  }
  const result = [
    bass,
    bass +
      12 +
      (chord.quality === 'sus2'
        ? 2
        : chord.quality === 'sus4'
          ? 5
          : ['maj', 'aug'].includes(chord.quality)
            ? 4
            : 3),
    bass + 12 + (chord.quality === 'dim' ? 6 : chord.quality === 'aug' ? 8 : 7),
  ]
  if (
    [
      '7',
      '7inv',
      'dim7',
      'maj7',
      '9',
      'maj9',
      '11',
      'b9',
      'b13',
      'b9_13',
      's9_13',
      '13',
      'maj13',
      'b9_b13',
      's9_b13',
    ].includes(chord.extension)
  )
    result.push(
      bass +
        12 +
        (chord.extension === 'dim7'
          ? 9
          : ['maj7', 'maj9', 'maj13'].includes(chord.extension)
            ? 11
            : 10),
    )
  if (['9', 'maj9', 'add9', '11', 'add11'].includes(chord.extension))
    result.push(bass + 26)
  if (['11', 'add11'].includes(chord.extension)) result.push(bass + 29)
  if (['b9', 'b9_13'].includes(chord.extension)) result.push(bass + 25)
  if (chord.extension === 'b13') result.push(bass + 32)
  if (chord.extension === 's9_13') result.push(bass + 27)
  if (['b9_13', 's9_13'].includes(chord.extension)) result.push(bass + 33)
  if (chord.extension === '6') result.push(bass + 21)
  if (['13', 'maj13'].includes(chord.extension))
    result.push(bass + 26, bass + 33)
  if (['b9_b13', 's9_b13'].includes(chord.extension))
    result.push(bass + (chord.extension === 'b9_b13' ? 25 : 27), bass + 32)
  if (chord.extension === '7inv') return isPlainFifthSeven(chord)
    ? [bass, bass + 4, bass + 7, bass + 10] : [bass - 2, bass, bass + 4, bass + 7]
  if (
    ['9', 'maj9', 'add9', '11', 'add11', 'b9', 'b13', 'b9_13', 's9_13',
      '13', 'maj13', 'b9_b13', 's9_b13'].includes(chord.extension)
  ) {
    // Place the seventh just below the upper octave, then the ninth, third,
    // fifth and other extensions above it. This keeps the colour tones close
    // together without pushing a 13th into a third octave.
    const upper = result.slice(1).map((note) => {
      const pitch = (note - bass) % 12
      return bass + (pitch === 10 || pitch === 11 ? pitch : 12 + pitch)
    })
    return [bass, ...new Set(upper.sort((a, b) => a - b))]
  }
  return result
}
export { presets, presetGroups, presetSlots, presetBeatSlots } from './presets.js'

/** @param {number} key @param {string} chord @param {'key' | 'chord'} mode */
export function melodyNotes(key, chord, mode) {
  const scale = [0, 2, 4, 5, 7, 9, 11]
  if (mode === 'chord') {
    const config = chordConfig(chord)
    const root = (rootPitch(chord) + key) % 12
    const chordPitches = new Set(bassHarmonyNotes(chord, key).map((note) => ((note % 12) + 12) % 12))
    const scalePitches = new Set(scale.map((interval) => (interval + key) % 12))
    /** @param {number} interval */
    const inChord = (interval) => chordPitches.has((root + interval) % 12)
    /** @param {number} interval */
    const inScale = (interval) => scalePitches.has((root + interval) % 12)
    const ninth = ['b9', 'b9_13', 'b9_b13'].includes(config.extension) ? 1
      : ['s9_13', 's9_b13'].includes(config.extension) ? 3 : 2
    const third = config.quality === 'min' || config.quality === 'dim' ? 3
      : config.quality === 'maj' || config.quality === 'aug' ? 4
        : inChord(3) ? 3 : inChord(4) ? 4 : inScale(3) ? 3 : 4
    const fifth = config.quality === 'dim' ? 6 : config.quality === 'aug' ? 8 : 7
    const thirteenth = ['b13', 'b9_b13', 's9_b13'].includes(config.extension) ? 8 : 9
    const seventh = inChord(11) ? 11 : inChord(10) ? 10 : inScale(11) ? 11 : 10
    const intervals = [0, ninth, third, 5, fifth, thirteenth, seventh, 12]
    const degreeLabels = [
      'R', ninth === 1 ? '♭9' : ninth === 3 ? '♯9' : '9',
      third === 3 ? '♭3' : '3', '11',
      fifth === 6 ? '♭5' : fifth === 8 ? '♯5' : '5',
      thirteenth === 8 ? '♭13' : '13', seventh === 10 ? '♭7' : '7', 'R',
    ]
    return intervals.map((interval, index) => {
      const midi = 60 + root + interval
      const pitch = midi % 12
      const degree = scale.findIndex((value) => (value + key) % 12 === pitch)
      return {
        midi,
        label: keys[key].scale[degree] ?? chromaticNames[pitch],
        degree: degreeLabels[index],
        category: chordPitches.has(pitch) ? 'chord' : scalePitches.has(pitch) ? 'scale' : 'outside',
      }
    })
  }
  const pitchClasses =
    scale.map((interval) => (interval + key) % 12)
  return Array.from({ length: 8 }, (_, index) => {
    const pitch = pitchClasses[index % pitchClasses.length]
    const octave = Math.floor(index / pitchClasses.length)
    // Keep each pad ascending, including keys whose scale crosses C.
    const wrap = pitch < key ? 12 : 0
    const midi = 60 + pitch + octave * 12 + wrap
    const degree = scale.findIndex(
      (interval) => (interval + key) % 12 === pitch,
    )
    return { midi, label: keys[key].scale[degree] ?? chromaticNames[pitch], category: 'scale', degree: ['R', '2', '3', '4', '5', '6', '7', 'R'][index] }
  })
}

export const romanDegrees = [
  'I',
  '♭II',
  'II',
  '♭III',
  'III',
  'IV',
  '♯IV',
  'V',
  '♭VI',
  'VI',
  '♭VII',
  'VII',
]
/** @param {string} id */
export function rootPitch(id) {
  const config = chordConfig(id)
  return (scaleIntervals[config.root] + config.alter) % 12
}
/** @param {string} id @param {number} pitch */
export function changeRoot(id, pitch) {
  if (!Number.isInteger(pitch) || pitch < 0 || pitch > 11)
    throw new RangeError('Unknown root')
  const roots = [0, 1, 1, 2, 2, 3, 3, 4, 5, 5, 6, 6]
  const root = roots[pitch]
  return customChord({
    ...chordConfig(id),
    root,
    alter: (pitch - scaleIntervals[root] + 12) % 12,
  })
}
/** @param {number} pitch */
export function defaultChord(pitch) {
  const choices = [
    [0, 'maj', 'maj7', 0],
    [1, 'maj', '7', 11],
    [1, 'min', '7', 0],
    [2, 'dim', 'dim7', 11],
    [2, 'min', '7', 0],
    [3, 'maj', 'maj7', 0],
    [3, 'dim', '7', 1],
    [4, 'maj', '7inv', 0],
    [5, 'dim', 'dim7', 11],
    [5, 'min', '7', 0],
    [6, 'maj', '7', 11],
    [6, 'slash', 'v_over_7', 0],
  ]
  if (!Number.isInteger(pitch) || !choices[pitch])
    throw new RangeError('Unknown root')
  const [root, quality, extension, alter] = choices[pitch]
  return customChord({
    root: Number(root),
    quality: String(quality),
    extension: String(extension),
    alter: Number(alter),
  })
}

/** @param {string} id @param {number} key @param {'number'|'roman'|'chord'} notation */
export function displayChordParts(id, key, notation) {
  const parts = chordParts(id, key, notation !== 'chord')
  return {
    ...parts,
    main: notation === 'roman' ? romanDegrees[rootPitch(id)] : parts.main,
    suffix:
      notation === 'roman' && chordConfig(id).quality === 'slash'
        ? { v_over_7: 'V/VII', iv_over_v: 'IV/V', iii_aug_sharp4: 'III+/♯IV' }[
            /** @type {'v_over_7'|'iv_over_v'|'iii_aug_sharp4'} */ (
              chordConfig(id).extension
            )
          ]
        : parts.suffix,
  }
}

export const qualityCatalog = Object.freeze([
  { value: 'maj:7inv', label: '7' },
  { value: 'slash:v_over_7', label: 'V/7' },
  { value: 'slash:iv_over_v', label: 'IV/V' },
  { value: 'slash:iii_aug_sharp4', label: 'III+/♯IV' },
  { value: 'dim:dim7', label: 'dim7' },
  { value: 'maj:6', label: '6' },
  { value: 'min:6', label: 'm6' },
  { value: 'maj:13', label: '13' },
  { value: 'maj:maj13', label: '△13' },
  { value: 'min:13', label: 'm13' },
  { value: 'maj:b13', label: '7(♭13)' },
  { value: 'maj:b9_b13', label: '7(♭9,♭13)' },
  { value: 'maj:s9_b13', label: '7(♯9,♭13)' },
  { value: 'maj:none', label: 'maj' },
  { value: 'maj:maj7', label: '△7' },
  { value: 'maj:maj9', label: '△9' },
  { value: 'maj:add9', label: 'add9' },
  { value: 'min:none', label: 'm' },
  { value: 'min:7', label: 'm7' },
  { value: 'min:9', label: 'm9' },
  { value: 'min:add11', label: 'm(9,11)' },
  { value: 'min:11', label: 'm11' },
  { value: 'min:add9', label: 'madd9' },
  { value: 'sus2:none', label: 'sus2' },
  { value: 'sus4:none', label: 'sus4' },
  { value: 'sus4:7', label: '7sus4' },
  { value: 'sus4:9', label: '9sus4' },
  { value: 'maj:7', label: '7' },
  { value: 'maj:9', label: '9' },
  { value: 'maj:b9_13', label: '7(♭9,13)' },
  { value: 'maj:s9_13', label: '7(♯9,13)' },
  { value: 'min:maj7', label: 'm△7' },
  { value: 'min:maj9', label: 'm△9' },
  { value: 'dim:none', label: 'dim' },
  { value: 'dim:7', label: 'm7♭5' },
  { value: 'dim:9', label: 'm9♭5' },
  { value: 'dim:maj7', label: 'm△7♭5' },
  { value: 'dim:maj9', label: 'm△9♭5' },
  { value: 'dim:add9', label: 'madd9♭5' },
  { value: 'aug:none', label: 'aug' },
  { value: 'maj:b9', label: '7(♭9)' },
])
/** Candidates are prioritized by the selected chromatic degree. @param {string} originalId @param {string} [currentId] */
export function qualityGroups(originalId, currentId = originalId) {
  const pitch = rootPitch(currentId)
  const priorities = [
    [
      'maj:maj7',
      'maj:maj9',
      'maj:add9',
      'maj:maj13',
      'sus2:none',
      'sus4:none',
      'sus4:7',
      'maj:7',
      'maj:6',
      'min:7',
    ],
    ['maj:7', 'maj:9', 'maj:13', 'maj:b9_b13', 'maj:s9_b13'],
    [
      'min:7',
      'min:9',
      'min:11',
      'min:13',
      'min:add11',
      'min:6',
      'maj:7',
      'maj:9',
    ],
    ['dim:dim7', 'maj:7', 'maj:9', 'maj:13', 'maj:b9_b13', 'maj:s9_b13'],
    ['min:7', 'maj:7', 'maj:9', 'maj:b9_b13', 'maj:s9_b13', 'sus4:7'],
    ['maj:maj7', 'maj:maj9', 'maj:add9', 'maj:maj13', 'min:6', 'min:7'],
    ['dim:7', 'slash:iii_aug_sharp4', 'dim:9'],
    [
      'maj:7inv',
      'slash:iv_over_v',
      'min:7',
      'min:9',
      'min:11',
      'maj:7',
      'maj:9',
    ],
    ['dim:dim7', 'maj:7', 'maj:9', 'dim:7'],
    [
      'min:7',
      'min:9',
      'min:11',
      'min:13',
      'min:add11',
      'sus2:none',
      'sus4:none',
      'sus4:7',
      'maj:7',
    ],
    ['maj:7', 'maj:9', 'maj:13', 'maj:b9_b13', 'maj:s9_b13'],
    ['slash:v_over_7', 'dim:7', 'dim:9', 'maj:7', 'maj:9'],
  ][pitch]
  const defaultValue = `${chordConfig(defaultChord(pitch)).quality}:${chordConfig(defaultChord(pitch)).extension}`
  const current = chordConfig(currentId)
  const currentValue = `${current.quality}:${current.extension}`
  const first = [...new Set([defaultValue, ...priorities, currentValue])].filter(
    (value) => value !== 'maj:none',
  )
  const available = qualityCatalog.filter((option) =>
    option.value.startsWith('slash:') ? first.includes(option.value) : true,
  )
  return [
    {
      label: '✦ このルートにおすすめ',
      options: first
        .map((value) => available.find((option) => option.value === value))
        .filter((option) => option !== undefined),
    },
    {
      label: '↗ その他の響き',
      options: [
        ...available.filter((option) => option.value === 'maj:none'),
        ...available.filter((option) => option.value !== 'maj:none' && !first.includes(option.value)),
      ],
    },
  ]
}

/** How much harmonic movement there is to follow in a preset.
 * @param {{pattern: readonly string[], changes: readonly {bar: number, chord: string}[], modulation?: readonly number[]}} preset */
export function presetLevel(preset) {
  if (preset.modulation?.some(offset => offset !== 0)) return 3
  const changesPerBar = new Map()
  for (const change of preset.changes) {
    const count = (changesPerBar.get(change.bar) ?? 0) + 1
    if (count >= 2) return 3
    changesPerBar.set(change.bar, count)
  }
  const qualities = ['maj', 'min', 'min', 'maj', 'maj', 'min', 'dim']
  const chords = new Set([...preset.pattern, ...preset.changes.map(change => change.chord)])
  let colorful = 0
  for (const id of chords) {
    const { root, alter, quality, extension } = chordConfig(id)
    if (alter || quality !== qualities[root] || !['none', '7', 'maj7'].includes(extension)
      || (quality === 'maj' && extension === '7' && root !== 4)) colorful++
  }
  if (colorful >= 3 || (colorful >= 2 && preset.changes.length >= 2)) return 3
  return colorful || preset.changes.length || chords.size > 5 ? 2 : 1
}


/** A pitch keeps its identity; its harmonic role belongs to the currently sounding chord.
 * Tension is a description, not a promise of consonance (e.g. 11 over a major third).
 * @param {number} midi @param {string} chord @param {number} key */
export function melodyRole(midi, chord, key) {
  const root = (rootPitch(chord) + key) % 12
  const interval = (midi - root + 120) % 12
  const pitches = new Set(bassHarmonyNotes(chord, key).map(note => (note + 120) % 12))
  const degree = ['R', '♭9', '9', '♭3', '3', '11', '♯11', '5', '♭13', '13', '♭7', '7'][interval]
  const chordTone = pitches.has(midi % 12)
  const tension = [1, 2, 5, 6, 8, 9].includes(interval)
  const clash = !chordTone && [...pitches].some(pitch => (midi - pitch + 120) % 12 === 1)
  return { degree, category: chordTone ? 'chord' : tension ? 'tension' : 'passing',
    hint: chordTone ? 'コードトーン' : clash ? '半音のぶつかり' : tension ? 'テンション' : '経過音', clash }
}

/** Fixed pads follow only the global key, even when the accompaniment modulates.
 * @param {number} key @param {string} chord @param {number} chordKey @param {'key'|'chord'} mode */
export function melodyPalette(key, chord, chordKey, mode) {
  return melodyNotes(mode === 'key' ? key : chordKey, chord, mode)
    .map(note => ({ ...note, ...melodyRole(note.midi, chord, chordKey) }))
}
