/** @typedef {{kind:'tempo'|'harmony', samples:Float32Array, rate:number, bpm:number, key:number}} AnalysisRequest */
/** @typedef {{bpm?:number|null, key?:string|null, drum?:string|null, matches?:{id:string,name:string,score:number}[]}} AnalysisResult */

/** One lazily created worker. Cancellation releases CPU and rejects pending requests.
 * @param {() => Worker} makeWorker */
export function createReferenceAnalyzer(makeWorker = () => new Worker(new URL('./reference-analysis-worker.js', import.meta.url), {type:'module'})) {
  /** @type {Worker | undefined} */ let worker
  let sequence = 0
  /** @type {Map<number, {resolve:(value:AnalysisResult)=>void, reject:(reason:Error)=>void}>} */
  const pending = new Map()
  /** @param {Error} reason */
  function stop(reason) {
    worker?.terminate()
    worker = undefined
    for (const request of pending.values()) request.reject(reason)
    pending.clear()
  }
  function cancel() { stop(new DOMException('Analysis cancelled', 'AbortError')) }
  /** @param {AnalysisRequest} request @returns {Promise<AnalysisResult>} */
  function analyze(request) {
    return new Promise((resolve, reject) => {
      if (!worker) {
        worker = makeWorker()
        worker.onmessage = ({data}) => {
          const handler = pending.get(data.id)
          if (!handler) return
          pending.delete(data.id)
          if (data.error) handler.reject(new Error(data.error)); else handler.resolve(data.result)
        }
        worker.onerror = () => stop(new Error('Analysis worker failed to load or execute'))
      }
      const id = ++sequence
      pending.set(id, {resolve, reject})
      try { worker.postMessage({...request, id}, [request.samples.buffer]) }
      catch (error) { pending.delete(id); reject(error) }
    })
  }
  return {analyze, cancel}
}
