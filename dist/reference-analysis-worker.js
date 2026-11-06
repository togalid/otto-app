import { estimateBpm, estimateMajorKey, estimateDrumPattern, rankProgressions } from './reference-analysis.js'

/** @param {MessageEvent<import('./reference-analysis-client.js').AnalysisRequest & {id:number}>} event */
globalThis.onmessage = ({data}) => {
  const {id, kind, samples, rate, bpm, key} = data
  try {
    if (kind === 'tempo') {
      globalThis.postMessage({id, result:{bpm:estimateBpm(samples, rate)}})
      return
    }
    const detectedKey = estimateMajorKey(samples, rate)
    const keyIndex = ['C','D♭','D','E♭','E','F','F♯','G','A♭','A','B♭','B'].indexOf(detectedKey ?? '')
    globalThis.postMessage({id, result:{key:detectedKey, drum:estimateDrumPattern(samples, rate, bpm), matches:rankProgressions(samples, rate, bpm, keyIndex < 0 ? key : keyIndex)}})
  } catch (error) {
    globalThis.postMessage({id, error:error instanceof Error ? error.message : 'Analysis failed'})
  }
}
