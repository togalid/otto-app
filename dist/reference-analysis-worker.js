import { genres, bassEvents } from './groove.js'
import { rhythmPatterns } from './rhythm.js'
import { analyzeReferencePerformance } from './reference-performance.js'
import { analyzeReferenceSong, referenceSectionStarts } from './reference-song-analysis.js'
import { estimateBpm, majorKeyScores, estimateMajorKey, estimateDrumPattern, rankProgressions, scoreProgressionPresets } from './reference-analysis.js'

/** @param {MessageEvent<import('./reference-analysis-client.js').AnalysisRequest & {id:number}>} event */
globalThis.onmessage = ({data}) => {
  const {id, kind, samples, rate, bpm, key} = data
  try {
    if (kind === 'key') {
      globalThis.postMessage({id, result:{keyScores:majorKeyScores(samples, rate)}})
      return
    }
    if (kind === 'performance') {
      const performance = analyzeReferencePerformance(samples, rate, bpm, key, data.stems)
      const {sections} = analyzeReferenceSong(samples, rate, bpm, key)
      globalThis.postMessage({id, result:{performance, sections}})
      return
    }
    if (kind === 'tempo') {
      globalThis.postMessage({id, result:{bpm:estimateBpm(samples, rate)}})
      return
    }
    if (kind === 'presets') {
      const {matches, fallbackScore} = scoreProgressionPresets(samples, rate, bpm, key)
      const best = matches[0]
      const preset = best && best.score > fallbackScore + .12 ? best.id : 'royal'
      const style = data.stems ? matchStyle(samples, rate, bpm, key, data.stems) : undefined
      globalThis.postMessage({id, result:{preset, style}})
      return
    }
    const detectedKey = estimateMajorKey(samples, rate)
    const keyIndex = ['C','D♭','D','E♭','E','F','F♯','G','A♭','A','B♭','B'].indexOf(detectedKey ?? '')
    if (kind === 'sections') {
      const starts = referenceSectionStarts(samples, rate, bpm, keyIndex < 0 ? key : keyIndex)
      globalThis.postMessage({id, result:{key:detectedKey, starts}})
      return
    }
    if (kind === 'song') {
      const {sections} = analyzeReferenceSong(samples, rate, bpm, keyIndex < 0 ? key : keyIndex)
      globalThis.postMessage({id, result:{key:detectedKey, sections}})
      return
    }
    globalThis.postMessage({id, result:{key:detectedKey, drum:estimateDrumPattern(samples, rate, bpm), matches:rankProgressions(samples, rate, bpm, keyIndex < 0 ? key : keyIndex)}})
  } catch (error) {
    globalThis.postMessage({id, error:error instanceof Error ? error.message : 'Analysis failed'})
  }
}


// Compare observed onsets with the rhythms of authored styles. Other parts
// come from the same style so the timbres and ornament patterns work together.
/** @param {Float32Array} samples @param {number} rate @param {number} bpm @param {number} key
 * @param {{bass:Float32Array, drums:Float32Array}} stems */
function matchStyle(samples, rate, bpm, key, stems) {
  const observed = analyzeReferencePerformance(samples, rate, bpm, key, stems)
  /** @param {number[]} pulses */
  const histogram = pulses => {
    const bins = new Float64Array(16)
    for (const pulse of pulses) bins[Math.round(pulse * 2) % 16]++
    return bins
  }
  const kick = histogram(observed.drums.filter(hit => hit.sound === 'kick').map(hit => hit.beat * 2))
  const snare = histogram(observed.drums.filter(hit => hit.sound === 'snare').map(hit => hit.beat * 2))
  const bass = histogram(observed.bass.map(note => note.beat * 2))
  /** @param {Float64Array} actual @param {Float64Array} candidate */
  const similarity = (actual, candidate) => {
    const norm = Math.hypot(...actual) * Math.hypot(...candidate)
    return norm ? actual.reduce((sum, value, i) => sum + value * candidate[i], 0) / norm : 0
  }
  if (![...kick, ...snare, ...bass].some(Boolean)) return undefined
  let bestScore = -Infinity
  let best
  for (const style of genres) {
    const hits = rhythmPatterns.find(pattern => pattern.id === style.rhythm)?.hits ?? []
    const bassPulses = [0, 1].flatMap(bar => bassEvents(style.bassPattern, 0, bar).map(note => note.pulse))
    const score = similarity(kick, histogram(hits.filter(hit => hit.sound === 'kick').map(hit => hit.pulse)))
      + similarity(snare, histogram(hits.filter(hit => hit.sound === 'snare').map(hit => hit.pulse)))
      + similarity(bass, histogram(bassPulses)) - Math.abs(Math.log2(style.bpm / bpm)) * .5
    if (score > bestScore) {
      bestScore = score
      best = style.id
    }
  }
  return best
}
