/** Compatibility entry point for music consumers; pure harmony and voicing live in focused modules. */
import { chordConfig, customChord, rootPitch, bassHarmonyNotes, keys, scaleIntervals, chromaticNames, orderedSlashShapes } from './chord-harmony.js'
export { chords, chordChoices, keys, chordConfig, customChord, rootPitch, bassHarmonyNotes } from './chord-harmony.js'
export { voicePhrase, chordNotes, constrainVoicing, padChordNotes } from './chord-voicing.js'
/** @typedef {import('./chord-harmony.js').ChordConfig} ChordConfig */

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
// The editor selects the bass degree. These shapes keep the upper voices
// in the same order above it, including during automatic voice leading.
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
/** @param {string} id @param {number} key @param {boolean} degrees */
export function chordParts(id, key, degrees) {
  const chord = chordConfig(id)
  if (!keys[key]) throw new RangeError('Unknown key')
  const pitch = (scaleIntervals[chord.root] + chord.alter) % 12
  if (chord.quality === 'slash') {
    const shape = orderedSlashShapes.get(chord.extension)
    if (shape) {
      const upper = (pitch + shape.upper) % 12
      return degrees
        ? { main: degreeNames[pitch], suffix: romanDegrees[upper] + shape.quality + '/' + romanDegrees[pitch] }
        : { main: chromaticNames[(upper + key) % 12], suffix: shape.quality + '/' + chromaticNames[(pitch + key) % 12] }
    }
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
  const config = chordConfig(id)
  const shape = config.quality === 'slash' && config.extension.startsWith('pad_') ? orderedSlashShapes.get(config.extension) : undefined
  if (shape) {
    const bass = rootPitch(id)
    const upper = (bass + shape.upper) % 12
    const names = notation === 'chord' ? chromaticNames : notation === 'roman' ? romanDegrees : degreeNames
    const transpose = notation === 'chord' ? key : 0
    return {main:names[(upper + transpose) % 12], suffix:shape.quality + '/' + names[(bass + transpose) % 12]}
  }
  const parts = chordParts(id, key, notation !== 'chord')
  return {
    ...parts,
    main: notation === 'roman' ? romanDegrees[rootPitch(id)] : parts.main,
    suffix:
      notation === 'roman' && chordConfig(id).quality === 'slash' && !orderedSlashShapes.has(chordConfig(id).extension)
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
  { value: 'slash:ii_over_vi', label: 'II/VI' },
  { value: 'slash:vii7_over_vi', label: 'VII7/VI' },
  { value: 'slash:flat_vii_over_vi', label: '♭VII/VI' },
  { value: 'slash:v_over_7', label: 'V/7' },
  { value: 'slash:v_over_iv', label: 'V/VI' },
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
      'slash:ii_over_vi',
      'slash:vii7_over_vi',
      'slash:flat_vii_over_vi',
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

/** Classify by modulation, then by membership in the major scale.
 * @param {{pattern: readonly string[], changes: readonly {chord: string}[], modulation?: readonly number[]}} preset */
export function presetLevel(preset) {
  if (preset.modulation?.some(offset => offset % 12 !== 0)) return 3
  const chords = new Set([...preset.pattern, ...preset.changes.map(change => change.chord)])
  for (const id of chords) {
    if (bassHarmonyNotes(id, 0).some(note => !scaleIntervals.includes(note % 12))) return 2
  }
  return 1
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

/** Infer a major key from a matched chord root and a zero-based scale degree.
 * @param {number} root @param {number} degree
 */
export function keyFromDegree(root, degree) {
  if (!Number.isInteger(root) || root < 0 || root > 11 || !Number.isInteger(degree) || degree < 0 || degree > 6) throw new RangeError('Invalid root or degree')
  return (root - [0, 2, 4, 5, 7, 9, 11][degree] + 12) % 12
}

/** @param {{key:number,beats:number,bars:number,notes:{midi:number,at:number,duration:number}[]}} phrase */
export function phraseNotation(phrase) {
  const key = keys[((phrase.key % 12) + 12) % 12] ?? keys[0]
  const natural = [0, 2, 4, 5, 7, 9, 11]
  const letters = 'CDEFGAB'
  const signature = key.scale.filter(name => name.includes('♯') || name.includes('♭'))
  const order = signature.some(name => name.includes('♭')) ? 'BEADGC' : 'FCGDAE'
  signature.sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]))
  const altered = new Map(signature.map(name => [name[0], name.includes('♯') ? 1 : -1]))
  const width = Math.max(400, phrase.bars * 250 + 100)
  const start = 55 + signature.length * 9
  const barWidth = (width - start - 10) / phrase.bars
  const accidentals = new Map()
  const notes = [...phrase.notes].sort((a,b) => a.at-b.at).map(note => {
    const pc = ((note.midi % 12) + 12) % 12
    const scaleName = key.scale.find(name => (natural[letters.indexOf(name[0])] + (name.includes('♯') ? 1 : name.includes('♭') ? -1 : 0) + 12) % 12 === pc)
    const sharpNames = ['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B']
    const flatNames = ['C','D♭','D','E♭','E','F','G♭','G','A♭','A','B♭','B']
    const name = scaleName ?? (signature.some(value => value.includes('♭')) ? flatNames : sharpNames)[pc]
    const letter = letters.indexOf(name[0]), alteration = name.includes('♯') ? 1 : name.includes('♭') ? -1 : 0
    const octave = Math.floor((note.midi - natural[letter] - alteration) / 12) - 1
    const y = 100 - ((octave - 4) * 7 + letter) * 5
    const beat = Math.round(note.at * 4) / 4, bar = Math.floor(beat / phrase.beats)
    const accidentalKey = `${bar}:${octave}:${letter}`
    const previous = accidentals.get(accidentalKey) ?? altered.get(name[0]) ?? 0
    accidentals.set(accidentalKey, alteration)
    return {x:start + beat / phrase.beats * barWidth + 12, y, beat, bar, duration:note.duration, flags:note.duration < .375 ? 2 : note.duration < .75 ? 1 : 0, accidental:previous === alteration ? '' : alteration === 1 ? '♯' : alteration === -1 ? '♭' : '♮'}
  })
  /** @type {Array<Array<(typeof notes)[number]>>} */
  const groups = []
  for (const note of notes) {
    const group = groups.at(-1), last = group?.at(-1)
    if (note.flags && group && last && last.flags && note.bar === last.bar && Math.floor(note.beat) === Math.floor(last.beat) && note.beat - last.beat <= .5) group.push(note)
    else groups.push([note])
  }
  return {signature, start, width, barWidth, notes, groups}
}
