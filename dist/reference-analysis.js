import { presets, presetSlots, chordNotes } from './music.js'

// Shared immutable window; one bounded coefficient set for the current sample rate.
const window = Float64Array.from({length:2048}, (_, i) => .5 - .5 * Math.cos(2 * Math.PI * i / 2047))
let coefficientRate = 0
let coefficients = new Float64Array(36)
/** @param {number} rate */
function spectralCoefficients(rate) {
  if (rate !== coefficientRate) {
    coefficients = Float64Array.from({length:36}, (_, i) => 2 * Math.cos(2 * Math.PI * 440 * 2 ** ((i + 48 - 69) / 12) / rate))
    coefficientRate = rate
  }
  return coefficients
}
/** Estimate tempo from positive energy changes; null for insufficient rhythmic evidence.
 * @param {Float32Array} samples @param {number} sampleRate */
export function estimateBpm(samples, sampleRate) {
  const hop = Math.max(1, Math.round(sampleRate / 100))
  const count = Math.floor(samples.length / hop)
  if (count < 800) return null
  const onset = new Float64Array(count)
  let previous = 0, total = 0
  for (let i = 0; i < count; i++) {
    let energy = 0
    for (let j = 0; j < hop; j++) energy += samples[i * hop + j] ** 2
    energy = Math.sqrt(energy / hop)
    onset[i] = Math.max(0, energy - previous)
    total += onset[i]; previous = energy
  }
  const mean = total / count
  if (mean < 0.00001) return null
  let best = 0, bpm = 0
  for (let candidate = 70; candidate <= 190; candidate += .25) {
    const lag = sampleRate / hop * 60 / candidate
    let score = 0
    for (let multiple = 1; multiple <= 3; multiple++) {
      const shift = Math.round(lag * multiple)
      let sum = 0
      for (let i = shift; i < count; i++) sum += onset[i] * onset[i - shift]
      score += sum / (count - shift) / multiple
    }
    if (score > best) { best = score; bpm = candidate }
  }
  return best > mean * mean * 1.5 ? Math.round(bpm * 10) / 10 : null
}

/** Estimate a major-key pitch collection from sampled spectral energy. Minor templates map to their relative major.
 * @param {Float32Array} samples @param {number} sampleRate @returns {string | null} */
export function estimateMajorKey(samples, sampleRate) {
  if (samples.length < sampleRate * 3) return null
  const chroma = new Float64Array(12), size = 2048
  const coefficients = spectralCoefficients(sampleRate)
  const stride = Math.max(size, Math.floor(samples.length / 240))
  for (let offset = 0; offset + size <= samples.length; offset += stride) {
    for (let midi = 48; midi <= 83; midi++) {
      const coefficient = coefficients[midi - 48]
      let a = 0, b = 0
      for (let i = 0; i < size; i++) {
        const x = samples[offset + i] * window[i] + coefficient * a - b
        b = a; a = x
      }
      chroma[midi % 12] += Math.sqrt(Math.max(0, a * a + b * b - coefficient * a * b))
    }
  }
  const total = chroma.reduce((sum, x) => sum + x, 0)
  if (total < .01) return null
  const major = [6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88]
  const minor = [6.33,2.68,3.52,5.38,2.6,3.53,2.54,4.75,3.98,2.69,3.34,3.17]
  const normalized = Array.from(chroma, x => x / total)
  let best = -Infinity, key = 0
  for (let root = 0; root < 12; root++) {
    for (const [profile, shift] of [[major, 0], [minor, 3]]) {
      const weights = /** @type {number[]} */ (profile)
      let score = 0
      for (let i = 0; i < 12; i++) score += normalized[(root + i) % 12] * weights[i]
      if (score > best) { best = score; key = (root + /** @type {number} */ (shift)) % 12 }
    }
  }
  return ['C','D♭','D','E♭','E','F','F♯','G','A♭','A','B♭','B'][key]
}

/** Rough low-frequency pulse regularity, used only to suggest a basic drum pattern.
 * @param {Float32Array} samples @param {number} sampleRate @param {number | null} bpm
 * @returns {string | null} */
export function estimateDrumPattern(samples, sampleRate, bpm) {
  if (!bpm || samples.length < sampleRate * 8) return null
  const hop = Math.round(sampleRate / 100), envelope = []
  const alpha = 1 - Math.exp(-2 * Math.PI * 140 / sampleRate)
  let low = 0, previous = 0
  for (let pos = 0; pos + hop <= samples.length; pos += hop) {
    let energy = 0
    for (let j = 0; j < hop; j++) { low += alpha * (samples[pos + j] - low); energy += low * low }
    const level = Math.sqrt(energy / hop)
    envelope.push(Math.max(0, level - previous)); previous = level
  }
  const lag = Math.round(100 * 60 / bpm)
  let beat = 0, half = 0, energy = 0
  for (let i = lag; i < envelope.length; i++) {
    beat += envelope[i] * envelope[i - lag]
    half += envelope[i] * envelope[i - Math.round(lag / 2)]
    energy += envelope[i] * envelope[i]
  }
  if (energy < 1e-6 || beat / energy < .12) return null
  return beat > half * 1.35 ? 'four' : 'eight_straight'
}

/** Rank authored progressions against eight bars of spectral pitch energy.
 * @param {Float32Array} samples @param {number} rate @param {number} bpm @param {number} key */
export function rankProgressions(samples, rate, bpm, key) {
  const barSize = 240 / bpm * rate
  const coefficients = spectralCoefficients(rate)
  if (samples.length < barSize * 8 - 1) return []
  const bars = Array.from({length:8}, (_, bar) => {
    const chroma = new Float64Array(12)
    for (let frame = 0; frame < 8; frame++) {
      const offset = Math.floor(bar * barSize + (frame + .5) * barSize / 8)
      for (let midi = 48; midi < 84; midi++) {
        const coefficient = coefficients[midi - 48]
        let a = 0, b = 0
        for (let i = 0; i < 2048; i++) {
          const x = (samples[offset + i] ?? 0) * window[i] + coefficient * a - b
          b = a; a = x
        }
        chroma[midi % 12] += Math.sqrt(Math.max(0,a*a+b*b-coefficient*a*b))
      }
    }
    const total = chroma.reduce((sum,x) => sum+x,0)
    return Array.from(chroma,x => total ? x/total : 0)
  })
  if (bars.every(bar => bar.every(x => x === 0))) return []
  return presets.map(preset => {
    const slots = presetSlots(preset.id)
    const score = bars.reduce((sum,bar,index) => {
      const pitches = new Set(chordNotes(slots[index], (key + preset.modulation[Math.floor(index/2)] + 120) % 12).map(n => n % 12))
      return sum + bar.reduce((s,x,pitch) => s + x * (pitches.has(pitch) ? 1 / Math.sqrt(pitches.size) : -.15),0)
    },0)
    return {id:preset.id,name:preset.name,score}
  }).sort((a,b) => b.score-a.score).slice(0,3)
}

