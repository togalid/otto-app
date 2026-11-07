/** @typedef {{beat:number,sound:'kick'|'snare'|'hat'|'openhat',velocity:number}} ReferenceDrum */
/** @typedef {{beat:number,midi:number,duration:number,velocity:number}} ReferenceBass */
/** @typedef {{key:number,drums:ReferenceDrum[],bass:ReferenceBass[]}} ReferencePerformance */

/** Extract an editable eight-bar sketch, not a transcription guarantee. Optional isolated
 * stems substantially reduce bass/drum confusion. All buffers must use the supplied rate.
 * @param {Float32Array} samples @param {number} rate @param {number} bpm @param {number} key
 * @param {{bass?:Float32Array,drums?:Float32Array}} [stems]
 * @returns {ReferencePerformance} */
export function analyzeReferencePerformance(samples, rate, bpm, key, stems = {}) {
  if (!Number.isFinite(rate) || rate < 2000 || !Number.isFinite(bpm) || bpm < 30 || bpm > 300 || !Number.isFinite(key))
    throw new RangeError('Invalid performance analysis parameters')
  const seconds = 32 * 60 / bpm
  const limit = Math.min(samples.length, Math.ceil(seconds * rate))
  if (limit < rate / 4) return {key, drums: [], bass: []}
  return {
    key,
    drums: extractDrums((stems.drums ?? samples).subarray(0, limit), rate, bpm),
    bass: extractBass((stems.bass ?? samples).subarray(0, limit), rate, bpm),
  }
}

/** @param {Float32Array} samples @param {number} rate @param {number} bpm @returns {ReferenceDrum[]} */
function extractDrums(samples, rate, bpm) {
  const hop = Math.max(1, Math.round(rate * .01))
  /** @type {number[][]} */ const envelopes = [[], [], []]
  const lowAlpha = 1 - Math.exp(-2 * Math.PI * 160 / rate)
  const highAlpha = 1 - Math.exp(-2 * Math.PI * 2200 / rate)
  let low = 0, middle = 0
  for (let offset = 0; offset + hop <= samples.length; offset += hop) {
    const energy = [0, 0, 0]
    for (let i = offset; i < offset + hop; i++) {
      const sample = Number.isFinite(samples[i]) ? samples[i] : 0
      low += lowAlpha * (sample - low)
      middle += highAlpha * (sample - middle)
      energy[0] += low * low
      energy[1] += (middle - low) ** 2
      energy[2] += (sample - middle) ** 2
    }
    for (let band = 0; band < 3; band++) envelopes[band].push(Math.sqrt(energy[band] / hop))
  }
  /** @type {Map<string,ReferenceDrum>} */ const hits = new Map()
  const sounds = /** @type {const} */ (['kick', 'snare', 'hat'])
  for (let band = 0; band < 3; band++) {
    const values = envelopes[band]
    const peak = Math.max(0, ...values)
    if (peak < .003) continue
    let last = -100
    for (let i = 0; i < values.length - 1; i++) {
      const onset = values[i] - (values[i - 1] ?? 0)
      const nextOnset = values[i + 1] - values[i]
      const prior = values.slice(Math.max(0, i - 12), i)
      const floor = prior.reduce((sum, value) => sum + value, 0) / Math.max(1, prior.length)
      if (onset < peak * .12 || onset < nextOnset || values[i] < floor * 1.35 || i - last < 7) continue
      // A sustained pitched bass is not a kick; high-band spill alone is not a snare.
      if (band === 0 && values[Math.min(i + 12, values.length - 1)] > values[i] * .85) continue
      if (band === 1 && envelopes[2][i] < values[i] * .12) continue
      const beat = Math.max(0, Math.round((i * hop / rate - .005) * bpm / 60 * 4) / 4)
      if (beat >= 32) continue
      const sound = sounds[band]
      const velocity = Math.max(.25, Math.min(1, values[i] / peak))
      const id = `${beat}:${sound}`
      if ((hits.get(id)?.velocity ?? 0) < velocity) hits.set(id, {beat, sound, velocity})
      last = i
    }
  }
  return [...hits.values()].sort((a, b) => a.beat - b.beat).slice(0, 512)
}

/** Low-pass and resample for bounded pitch work; normalized autocorrelation requires
 * a stable periodic signal and rejects noisy windows rather than inventing roots.
 * @param {Float32Array} samples @param {number} rate @param {number} bpm @returns {ReferenceBass[]} */
function extractBass(samples, rate, bpm) {
  const targetRate = 2000
  const audio = new Float32Array(Math.floor(samples.length / rate * targetRate))
  const alpha = 1 - Math.exp(-2 * Math.PI * 280 / rate)
  let low = 0, next = 0
  for (let i = 0; i < samples.length; i++) {
    low += alpha * ((Number.isFinite(samples[i]) ? samples[i] : 0) - low)
    if (i >= next * rate / targetRate && next < audio.length) audio[next++] = low
  }
  const size = 256, hop = 40
  /** @type {{midi:number, time:number,level:number}[]} */ const frames = []
  let peak = 0
  for (let offset = 0; offset + size <= audio.length; offset += hop) {
    let energy = 0
    for (let i = 0; i < size; i++) energy += audio[offset + i] ** 2
    const level = Math.sqrt(energy / size)
    peak = Math.max(peak, level)
    let midi = -1
    if (level > .004) {
      const correlations = new Float64Array(63)
      let maximum = 0
      for (let lag = 9; lag < 62; lag++) {
        let dot = 0, norm = 0
        for (let i = 0; i < size - lag; i++) {
          const a = audio[offset + i], b = audio[offset + i + lag]
          dot += a * b; norm += a * a + b * b
        }
        correlations[lag] = norm > 0 ? 2 * dot / norm : 0
        maximum = Math.max(maximum, correlations[lag])
      }
      for (let lag = 10; lag < 61; lag++) {
        const correlation = correlations[lag]
        if (correlation < .84 || correlation < maximum * .92 || correlation < correlations[lag - 1] || correlation < correlations[lag + 1]) continue
        const note = Math.round(69 + 12 * Math.log2(targetRate / lag / 440))
        if (note >= 28 && note <= 55) { midi = note; break }
      }
    }
    frames.push({midi, time:offset / targetRate, level})
  }
  /** @type {ReferenceBass[]} */ const notes = []
  for (let start = 0; start < frames.length;) {
    let end = start + 1
    while (end < frames.length && frames[end].midi === frames[start].midi) end++
    const frame = frames[start]
    if (frame.midi >= 0 && end - start >= 3 && frame.level >= peak * .08) {
      const beat = Math.max(0, Math.round(frame.time * bpm / 60 * 4) / 4)
      const duration = Math.min(32 - beat, Math.max(.25, Math.round((end - start) * hop / targetRate * bpm / 60 * 4) / 4))
      if (beat < 32) {
        const previous = notes.at(-1)
        if (previous) previous.duration = Math.min(previous.duration, beat - previous.beat)
        if (previous && previous.duration <= 0) notes.pop()
        notes.push({beat, midi:frame.midi, duration, velocity:Math.max(.35, Math.min(.9, frame.level / peak))})
      }
    }
    start = end
  }
  return notes.slice(0, 256)
}
