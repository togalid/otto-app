/** Pure chord identity, validation and harmonic pitches. No UI or voicing search. */
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
export const scaleIntervals = [0, 2, 4, 5, 7, 9, 11]
export const chromaticNames = [
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
export const orderedSlashShapes = new Map([
  ['v_over_iv', { intervals: [0, 6, 9, 14], upper: 2, quality: '' }],
  ['ii_over_vi', { intervals: [0, 5, 9, 12], upper: 5, quality: '' }],
  ['vii7_over_vi', { intervals: [0, 6, 9, 14], upper: 2, quality: '7' }],
  ['flat_vii_over_vi', { intervals: [0, 5, 8, 13], upper: 1, quality: '' }],
])

// Relative upper structures retain the selected Pad bass under transposition.
for (let offset=0;offset<12;offset++) {
  for (const [quality,steps,label] of /** @type {[string,number[],string][]} */ ([['maj',[0,4,7],''],['maj7',[0,4,7,11],'△7'],['min7',[0,3,7,10],'m7']])) {
    orderedSlashShapes.set(`pad_${offset}_${quality}`, {intervals:[0,...steps.map(step=>offset+step+ (offset<3?12:0))],upper:offset,quality:label})
  }
}

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
    (![
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
    ].includes(extension) && !(quality === 'slash' && orderedSlashShapes.has(extension))) ||
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

/** @param {ChordConfig} chord */
export function customChord(chord) {
  const id = `x:${chord.root}:${chord.quality}:${chord.extension}:${chord.alter}`
  chordConfig(id)
  return id
}
/** @param {ChordConfig} config */
export function isPlainFifthSeven(config) {
  return config.root === 4 && config.alter === 0 && config.quality === 'maj' &&
    ['7', '7inv'].includes(config.extension)
}

/** @param {string} id @param {number} key */
export function bassHarmonyNotes(id, key) {
  const chord = chordConfig(id)
  if (!Number.isInteger(key) || !keys[key]) throw new RangeError('Unknown key')
  const offset = key > 6 ? key - 12 : key
  if (chords[id]) return chords[id].map((note) => note + offset)
  const bass = 48 + ((scaleIntervals[chord.root] + chord.alter) % 12) + offset
  if (chord.quality === 'slash') {
    const shape = orderedSlashShapes.get(chord.extension)
    if (shape) return shape.intervals.map(interval => bass + interval)
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
/** @param {string} id */
export function rootPitch(id) {
  const config = chordConfig(id)
  return (scaleIntervals[config.root] + config.alter) % 12
}
