import {customChord} from './music.js'
import {analyzeReferencePerformance} from './reference-performance.js'

/** @typedef {{startSeconds:number, slots:string[], beatSlots:(string|null)[][], modulation:number[], advance:boolean, confidence:number, performance:ReturnType<typeof analyzeReferencePerformance>}} ReferenceSection */
/** @typedef {{chroma:number[], energy:number}} Feature */
const size = 2048
const window = Float64Array.from({length:size}, (_, i) => .5 - .5 * Math.cos(2 * Math.PI * i / (size - 1)))
const scale = [0, 2, 4, 5, 7, 9, 11]
const qualities = [
  {quality:'maj', extension:'none', intervals:[0,4,7]},
  {quality:'min', extension:'none', intervals:[0,3,7]},
  {quality:'dim', extension:'none', intervals:[0,3,6]},
  {quality:'sus4', extension:'none', intervals:[0,5,7]},
  {quality:'maj', extension:'7', intervals:[0,4,7,10]},
  {quality:'maj', extension:'maj7', intervals:[0,4,7,11]},
  {quality:'min', extension:'7', intervals:[0,3,7,10]},
]

/** Select source-derived eight-bar representatives, not authored presets.
 * Input starts at a user-confirmed downbeat. Section letters describe distinct
 * material, not a claim that a window is semantically a verse or chorus.
 * Analysis is bounded to the first 512 bars; never creates padded silent sections.
 * @param {Float32Array} samples @param {number} rate @param {number} bpm @param {number} key
 * @returns {{sections:ReferenceSection[], analyzedSeconds:number, truncated:boolean}}
 */
export function analyzeReferenceSong(samples, rate, bpm, key) {
  const {selected, analyzedSeconds, truncated} = findReferenceSections(samples, rate, bpm, key)
  return {
    analyzedSeconds, truncated,
    sections:selected.map(candidate => {
      const startSeconds = candidate.index * 1920 / bpm
      const slots = Array.from({length:8}, (_, bar) => candidate.chords[bar * 2].id)
      const beatSlots = slots.map((chord, bar) => [chord, null, candidate.chords[bar * 2 + 1].id === chord ? null : candidate.chords[bar * 2 + 1].id, null])
      const from = Math.round(startSeconds * rate), to = Math.min(samples.length, Math.round((startSeconds + 1920 / bpm) * rate))
      return {startSeconds, slots, beatSlots, modulation:[0,0,0,0], advance:false,
        confidence:candidate.chords.reduce((sum, chord) => sum + chord.confidence, 0) / 16,
        performance:analyzeReferencePerformance(samples.subarray(from, to), rate, bpm, key)}
    }),
  }
}

/** @param {Float32Array} samples @param {number} rate @param {number} bpm @param {number} key */
export function referenceSectionStarts(samples, rate, bpm, key) {
  return findReferenceSections(samples, rate, bpm, key).selected.map(section => section.index * 1920 / bpm)
}

/** @param {Float32Array} samples @param {number} rate @param {number} bpm @param {number} key */
function findReferenceSections(samples, rate, bpm, key) {
  if (!Number.isFinite(rate) || rate < 4000 || rate > 192000 || !Number.isFinite(bpm) || bpm < 40 || bpm > 200 || !Number.isInteger(key) || key < 0 || key > 11)
    throw new RangeError('Invalid reference analysis parameters')
  const barSeconds = 240 / bpm
  const available = Math.floor((samples.length / rate + 1e-6) / barSeconds)
  const bars = Math.min(512, available)
  const analyzedSeconds = bars * barSeconds
  if (bars < 8) return {selected:[], analyzedSeconds, truncated:available > bars}
  // Block-average decimation keeps the spectral scan small and attenuates aliases.
  const stride = Math.max(1, Math.floor(rate / 6000))
  const analysisRate = rate / stride
  const length = Math.min(samples.length, Math.floor(analyzedSeconds * rate))
  const mono = new Float32Array(Math.floor(length / stride))
  for (let i = 0; i < mono.length; i++) {
    let sum = 0
    for (let j = 0; j < stride; j++) { const value = samples[i * stride + j]; sum += Number.isFinite(value) ? value : 0 }
    mono[i] = sum / stride
  }
  const coefficients = Float64Array.from({length:36}, (_, i) => 2 * Math.cos(2 * Math.PI * 440 * 2 ** ((i + 48 - 69) / 12) / analysisRate))
  /** @type {Feature[]} */ const frames = []
  for (let half = 0; half < bars * 2; half++) {
    const chroma = new Array(12).fill(0)
    let energy = 0
    for (const position of [.3, .7]) {
      const center = (half + position) * barSeconds / 2 * analysisRate
      const offset = Math.round(center - size / 2)
      const frame = new Float64Array(size)
      for (let i = 0; i < size; i++) { const value = mono[offset + i] ?? 0; frame[i] = value * window[i]; energy += value * value / (size * 2) }
      for (let note = 0; note < coefficients.length; note++) {
        let a = 0, b = 0
        const coefficient = coefficients[note]
        for (let i = 0; i < size; i++) { const next = frame[i] + coefficient * a - b; b = a; a = next }
        chroma[note % 12] += Math.sqrt(Math.max(0, a * a + b * b - coefficient * a * b))
      }
    }
    const norm = Math.hypot(...chroma)
    frames.push({chroma:chroma.map(value => norm ? value / norm : 0), energy:Math.sqrt(energy)})
  }
  const maxEnergy = Math.max(...frames.map(frame => frame.energy))
  if (maxEnergy < .0001) return {selected:[], analyzedSeconds, truncated:available > bars}
  const candidates = Array.from({length:Math.floor(bars / 8)}, (_, index) => {
    const features = frames.slice(index * 16, index * 16 + 16)
    const energy = features.reduce((sum, feature) => sum + feature.energy, 0) / 16
    const chords = features.map(feature => identifyChord(feature.chroma, key))
    return {index, features, energy, chords}
  }).filter(candidate => candidate.energy > maxEnergy * .12 && candidate.features.filter(frame => frame.energy > maxEnergy * .025).length >= 12)
  /** @type {typeof candidates} */ const selected = []
  for (const candidate of candidates) {
    const duplicate = selected.some(previous => {
      const similarity = candidate.features.reduce((sum, feature, i) => sum + feature.chroma.reduce((score, value, pitch) => score + value * previous.features[i].chroma[pitch], 0), 0) / 16
      const sameChords = candidate.chords.filter((chord, i) => chord.id === previous.chords[i].id).length / 16
      // Ignore gain-only changes and small variations within repeated passages.
      return similarity > .92 || (sameChords >= .75 && similarity > .8)
    })
    if (!duplicate) selected.push(candidate)
    if (selected.length === 4) break
  }
  return {selected, analyzedSeconds, truncated:available > bars}
}

/** @param {number[]} chroma @param {number} key */
function identifyChord(chroma, key) {
  let best = -Infinity, second = -Infinity, id = 'C'
  for (let pitch = 0; pitch < 12; pitch++) for (const shape of qualities) {
    const evidence = shape.intervals.map(interval => chroma[(pitch + interval) % 12])
    // An absent third/seventh must not turn a sparse triad into a rich chord.
    const score = evidence.reduce((sum, value) => sum + value, 0) / Math.sqrt(evidence.length)
      + .12 * Math.min(...evidence) - (shape.intervals.length === 4 ? .025 : 0)
    if (score > best) {
      second = best; best = score
      const relative = (pitch - key + 12) % 12
      let root = 0
      for (let degree = 1; degree < scale.length; degree++) if (scale[degree] <= relative) root = degree
      id = customChord({root, quality:shape.quality, extension:shape.extension, alter:relative - scale[root]})
    } else if (score > second) second = score
  }
  return {id, confidence:Math.max(0, Math.min(1, (best - second) * 8))}
}
