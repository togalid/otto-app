import { encodeClip, analyzeSharedReference } from './reference-import.js'
export { analyzeSharedReference } from './reference-import.js'
import { features } from './features.js'
import { nextTick } from './vendor/vue.runtime.esm-browser.prod.js'
import { audioContext } from './audio.js'
export { estimateBpm, estimateMajorKey, estimateDrumPattern, rankProgressions } from './reference-analysis.js'
import { createReferenceAnalyzer } from './reference-analysis-client.js'

/** Position on a looping audio clock. @param {number} offset @param {number} elapsed @param {number} start @param {number} end */
export function loopPosition(offset, elapsed, start, end) {
  const position = offset + elapsed
  return position < end ? position : start + (position - end) % (end - start)
}

/**
 * Independent playback of the original audio.
 * @param {ReturnType<typeof import('./main-controls.js').mountReferenceControls>['state']} state
 * @param {(section:number)=>number} [_getSectionBars]
 * @param {{getContext?:typeof audioContext,runAnalysis?:typeof analyzeSharedReference,stemEnabled?:boolean}} [dependencies]
 * @param {(result:{bpm:number,key:number})=>Promise<void>} applyArrangement
 */
export function mountReferencePlayer(state, applyArrangement, _getSectionBars = () => 16, dependencies = {}) {
  const {getContext = audioContext, runAnalysis = analyzeSharedReference, stemEnabled = features.stemSeparation} = dependencies
  const file = /** @type {HTMLInputElement} */ (document.getElementById('ref-file'))
  const tempo = /** @type {HTMLInputElement} */ (document.querySelector('#tempo'))
  const key = /** @type {HTMLSelectElement} */ (document.querySelector('#key'))
  const timingOffsets = Array(32).fill(0)
  /** @type {{start:number, end:number, stemStart?:number, stems:AudioBuffer[]}[]} */ let sections = []
  /** @type {typeof sections | undefined} */ let pendingStemSections
  const analyzer = createReferenceAnalyzer()
  /** @type {AbortController | undefined} */ let activeImport

  /** @param {AudioBuffer} audio @param {number} start @param {number} end @param {AbortSignal} signal */
  async function separateRegion(audio, start, end, signal) {
    if (!features.stemSeparation) throw new Error('Stem分離はFull版で利用できます。')
    const response = await fetch('/api/stems', {method:'POST', headers:{'Content-Type':'audio/wav'}, body:encodeClip(audio, start, end), signal})
    if (!response.ok) throw new Error(response.status === 404 ? '分離サーバーを起動してください。' : await response.text())
    const payload = await response.arrayBuffer()
    const view = new DataView(payload)
    let cursor = 0
    return Promise.all(Array.from({length: 4}, () => {
      const size = view.getUint32(cursor, true)
      cursor += 4
      if (!size || size > payload.byteLength - cursor) throw new Error('ステムの受信に失敗しました。')
      const bytes = payload.slice(cursor, cursor + size)
      cursor += size
      return /** @type {AudioContext} */ (context).decodeAudioData(bytes)
    }))
  }

  /** @type {AudioContext | undefined} */ let context
  /** @type {AudioBuffer | undefined} */ let buffer
  /** @type {GainNode | undefined} */ let gain
  /** @type {AnalyserNode | undefined} */ let analyser
  const meterSamples = new Float32Array(256)
  /** @type {AudioBufferSourceNode | undefined} */ let source
  /** @type {{node:AudioBufferSourceNode, level:GainNode}[]} */
  const stemSources = []
  let followingAccompaniment = false
  let playingSection = 0, accompanimentOffset = 0
  let startedAt = 0, startOffset = 0, playRequest = 0
  let frame = 0, volume = .25, position = 0

  function currentPosition() {
    if (!source || !context) return position
    const elapsed = Math.max(0, context.currentTime - startedAt)
    return source.loop
      ? loopPosition(startOffset, elapsed, source.loopStart, source.loopEnd)
      : Math.min(state.duration, startOffset + elapsed)
  }

  function draw() {
    frame = 0
    position = currentPosition()
    document.dispatchEvent(new CustomEvent('reference-position', {detail:{position, playing:!!source && state.playing}}))
    if (source && analyser) {
      analyser.getFloatTimeDomainData(meterSamples)
      let peak = 0
      for (const sample of meterSamples) peak = Math.max(peak, Math.abs(sample))
      state.meterLevel = Math.min(10, Math.max(0, Math.ceil(10 * (1 + 20 * Math.log10(peak) / 48))))
      frame = requestAnimationFrame(draw)
    } else state.meterLevel = 0
  }

  function activateStems() {
    if (!pendingStemSections || state.playing || source) return
    sections=pendingStemSections
    pendingStemSections=undefined
    state.stemsReady=true
    state.message=''
  }

  function stop() {
    ++playRequest
    followingAccompaniment = false
    position = currentPosition()
    if (source) {
      source.onended = null
      source.stop()
      source.disconnect()
      source = undefined
    }
    for (const {node, level} of stemSources.splice(0)) {
      node.stop()
      node.disconnect()
      level.disconnect()
    }
    state.playing = false
    activateStems()
    cancelAnimationFrame(frame)
    draw()
  }

  /** @param {number} sectionIndex @param {number} [startTime] @param {number} [offset] */
  async function play(sectionIndex, startTime, offset = 0) {
    playingSection = sectionIndex
    accompanimentOffset = offset
    const originalSection = sections[sectionIndex]
    const shift = timingOffsets[sectionIndex] ?? 0
    const section = originalSection && {...originalSection, start:originalSection.start + shift, end:Math.min(buffer?.duration ?? originalSection.end, originalSection.end + shift)}
    if (!section) { state.message = `セクション${'ABCD'[sectionIndex]}に原曲の区間が割り当てられていません。`; return }
    if (!context || !buffer || !gain) return
    const request = ++playRequest
    state.playing = true
    followingAccompaniment = startTime !== undefined
    try {
      if (!followingAccompaniment) await context.resume()
      if (request !== playRequest) return
      const node = context.createBufferSource()
      node.buffer = buffer
      node.loop = true
      node.loopStart = section.start
      node.loopEnd = section.end
      if(!state.stemsReady)node.connect(gain)
      node.onended = () => {
        if (source !== node) return
        source = undefined
        position = state.duration
        node.disconnect()
        stop()
      }
      startedAt = startTime ?? context.currentTime + 0.02
      if (followingAccompaniment) {
        const duration = section.end - section.start
        offset = ((offset) % duration + duration) % duration
      }
      for (const [i, stem] of section.stems.entries()) {
        const stemNode = context.createBufferSource()
        const level = context.createGain()
        stemNode.buffer = stem
        stemNode.loop = true
        stemNode.loopStart = section.start - (originalSection.stemStart ?? originalSection.start)
        stemNode.loopEnd = Math.min(stem.duration, section.end - (originalSection.stemStart ?? originalSection.start))
        level.gain.value = state.stemEnabled[i] ? 1 : 0
        stemNode.connect(level)
        level.connect(gain)
        stemNode.start(startedAt, stemNode.loopStart + offset % (stemNode.loopEnd - stemNode.loopStart))
        stemSources.push({node: stemNode, level})
      }
      startOffset = loopPosition(section.start, offset, section.start, section.end)
      node.start(startedAt, startOffset)
      source = node
      document.dispatchEvent(new CustomEvent('reference-playback-start', {detail:{
        section:sectionIndex, adjustment:shift, sourceOffset:startOffset, scheduledTime:startedAt,
        stemOffsets:stemSources.map(({node})=>node.loopStart + offset % (node.loopEnd-node.loopStart)),
      }}))
      draw()
    } catch {
      if (request === playRequest) {
        stop()
        state.message = '原曲を再生できませんでした。'
      }
    }
  }

  /** @param {number} index */
  function toggleStem(index) {
    if (!state.stemsReady || !context) return
    const enabled = !state.stemEnabled[index]
    state.stemEnabled[index] = enabled
    stemSources[index]?.level.gain.setTargetAtTime(enabled ? 1 : 0, context.currentTime, 0.01)
  }
  /** @param {number} value */
  function setVolume(value) {
    volume = value
    if (gain && context) gain.gain.setTargetAtTime(value, context.currentTime, .02)
  }
  /** @param {AudioBuffer} audio @param {number} [endSample] @param {number} [startSample] */
  function waveformPath(audio, endSample = audio.length, startSample = 0) {
    const columns = 1000
    const lows = new Float32Array(columns)
    const highs = new Float32Array(columns)
    for (let channel = 0; channel < audio.numberOfChannels; channel++) {
      const samples = audio.getChannelData(channel)
      for (let x = 0; x < columns; x++) {
        const start = Math.max(0, startSample + Math.floor(x * (endSample - startSample) / columns))
        const end = Math.min(samples.length, startSample + Math.floor((x + 1) * (endSample - startSample) / columns))
        for (let i = start; i < end; i++) {
          lows[x] = Math.min(lows[x], samples[i])
          highs[x] = Math.max(highs[x], samples[i])
        }
      }
    }
    const peak = Math.max(0.01, ...highs, ...lows.map(value => -value))
    return Array.from(highs, (value, x) =>
      `M${x + 0.5} ${(50 - 46 * value / peak).toFixed(1)}V${(50 - 46 * lows[x] / peak).toFixed(1)}`
    ).join('')
  }

  const cropDialog = /** @type {HTMLDialogElement} */ (document.querySelector('#reference-crop'))
  const cropPosition = /** @type {HTMLInputElement} */ (cropDialog.querySelector('input'))
  const extendCrop = /** @type {HTMLButtonElement} */ (cropDialog.querySelector('#ref-crop-extend'))
  const zoomIn = /** @type {HTMLButtonElement} */ (cropDialog.querySelector('#ref-crop-zoom-in'))
  const zoomOut = /** @type {HTMLButtonElement} */ (cropDialog.querySelector('#ref-crop-zoom-out'))
  const cropBack = /** @type {HTMLButtonElement} */ (cropDialog.querySelector('#ref-crop-back'))
  const cropForward = /** @type {HTMLButtonElement} */ (cropDialog.querySelector('#ref-crop-forward'))
  const previewButton = /** @type {HTMLButtonElement} */ (cropDialog.querySelector('#ref-crop-preview'))
  const importStatus = /** @type {HTMLElement} */ (cropDialog.querySelector('#ref-import-status'))
  const confirmCrop = /** @type {HTMLButtonElement} */ (cropDialog.querySelector('button[value="ok"]'))
  const cancelCrop = /** @type {HTMLButtonElement} */ (cropDialog.querySelector('button[value="cancel"]'))
  const removeReference = /** @type {HTMLButtonElement} */ (cropDialog.querySelector('#ref-remove'))

  /** @param {string} message @param {boolean} busy */
  function setImportStatus(message, busy) {
    importStatus.textContent = message
    state.message = message
    cropDialog.classList.toggle('processing', busy)
    cropPosition.disabled = confirmCrop.disabled = busy
    removeReference.disabled = busy && !buffer
    if (busy) extendCrop.disabled = zoomIn.disabled = zoomOut.disabled = true
    cropBack.disabled = cropForward.disabled = previewButton.disabled = busy
    cancelCrop.textContent = '中断'
    cancelCrop.hidden = !busy
  }

  /** @param {File} selected @param {number | null} [previousOffset] @param {boolean} [skipStems] */
  async function loadFile(selected, previousOffset = null, skipStems = true) {
    if (activeImport) return
    removeReference.hidden = previousOffset === null
    const request = new AbortController()
    activeImport = request
    state.importing = true
    const {signal} = request
    try {
      if (selected.size > 100 * 1024 * 1024) throw new Error('100MB以下の音声を選んでください。')
      context ??= getContext()
      if (!gain) { gain = context.createGain(); gain.gain.value = volume; analyser = context.createAnalyser(); analyser.fftSize = 256; gain.connect(analyser); analyser.connect(context.destination) }
      const decoded = await context.decodeAudioData(await selected.arrayBuffer())
      signal.throwIfAborted()
      if (decoded.duration < .1) throw new Error('短すぎる音声です。')
      // Publish the playable original before analysis or the local separation request.
      pendingStemSections=undefined
      stop()
      buffer=decoded
      const offset=Math.max(0,Math.min(decoded.duration-.1,previousOffset ?? 0))
      timingOffsets.fill(offset)
      sections=Array.from({length:32},()=>({start:0,end:decoded.duration,stemStart:0,stems:[]}))
      position=offset
      state.stemEnabled.fill(true)
      Object.assign(state,{duration:decoded.duration,filename:selected.name,stemsReady:false,message:'テンポとキーを読み取っています…'})
      removeReference.disabled=false
      let touched=false
      const interactions=new AbortController()
      const touch=()=>{touched=true}
      for(const name of ['pointerdown','keydown','input'])document.addEventListener(name,touch,{capture:true,signal:interactions.signal})
      document.dispatchEvent(new Event('reference-timing-refresh'))
      try {
        await nextTick()
        signal.throwIfAborted()
        document.dispatchEvent(new Event('reference-loaded'))
        signal.throwIfAborted()
        const result=await runAnalysis(decoded,{
          analyze:analyzer.analyze,separate:separateRegion,
          createBuffer:(channels,length,rate)=>/** @type {AudioContext} */(context).createBuffer(channels,length,rate),
          bpm:Number(tempo.value),key:Number(key.value),signal,skipStems,
          progress:message=>{state.message=message},
          onAnalyzed:async result=>{
            signal.throwIfAborted()
            // Late analysis never overwrites a manual adjustment or stops playback.
            if(!touched&&!state.playing){await applyArrangement(result);signal.throwIfAborted();document.dispatchEvent(new Event('reference-analysis-ready'))}
          },
        })
        signal.throwIfAborted()
        if(!skipStems){
          pendingStemSections=Array.from({length:32},()=>result.sections[0])
          if(state.playing)state.message='Stem分離完了 · 次の再生から使用します'
          else activateStems()
        }else state.message=''
      } finally {interactions.abort()}
    } catch (error) {
      if (signal.aborted) return
      setImportStatus(error instanceof Error && error.message ? error.message : '読み込めませんでした。', false)
      confirmCrop.disabled = cropPosition.disabled = extendCrop.disabled = cropBack.disabled = cropForward.disabled = previewButton.disabled = true
      state.message = buffer ? 'Stem分離を完了できませんでした。原音のまま調整・再生できます。' : (importStatus.textContent ?? '読み込めませんでした。')
    } finally {
      if (activeImport === request) {
        activeImport = undefined
        state.importing = false
        removeReference.disabled = false
      }
    }
  }

  async function separateStems() {
    if (!stemEnabled || !buffer || !context || activeImport || state.stemsReady || pendingStemSections) return
    const audio = buffer
    const request = new AbortController()
    activeImport = request
    state.importing = true
    try {
      const result = await runAnalysis(audio, {
        analyze: analyzer.analyze, separate: separateRegion,
        createBuffer: (channels, length, rate) => /** @type {AudioContext} */ (context).createBuffer(channels, length, rate),
        bpm: Number(tempo.value), key: Number(key.value), signal: request.signal,
        progress: message => { state.message = message },
      })
      request.signal.throwIfAborted()
      if (buffer !== audio) return
      pendingStemSections = Array.from({length: 32}, () => result.sections[0])
      if (state.playing) state.message = 'Stem分離完了 · 次の再生から使用します'
      else activateStems()
    } catch (error) {
      if (!request.signal.aborted) state.message = error instanceof Error ? `Stem分離に失敗しました: ${error.message}` : 'Stem分離に失敗しました。'
    } finally {
      if (activeImport === request) { activeImport = undefined; state.importing = false }
    }
  }

  function cancelImport() {
    activeImport?.abort()
    activeImport = undefined
    analyzer.cancel()
    state.message = ''
    state.importing = false
    removeReference.disabled = false
  }
  document.addEventListener('reference-import-cancel',cancelImport)
  cropDialog.addEventListener('close', () => {
    cancelImport()
    setImportStatus('', false)
  })
  removeReference.addEventListener('click', () => {
    cancelImport()
    pendingStemSections=undefined
    stop()
    buffer = undefined
    sections = []
    document.dispatchEvent(new Event('reference-timing-refresh'))
    position = 0
    state.stemEnabled.fill(true)
    Object.assign(state, {duration: 0, filename: '', stemsReady: false, message: ''})
    document.dispatchEvent(new Event('reference-removed'))
    cropDialog.close()
  })
  /** @param {File} selected */
  function chooseImport(selected) {
    cancelImport()
    // Keep timing adjustment on the original audio; Stem separation is opt-in.
    void loadFile(selected, null, true)
  }
  file.addEventListener('change', () => { const selected = file.files?.[0]; if (selected) chooseImport(selected); file.value = '' })
  /** @param {Event} event */
  const isDropTarget = event => event.target instanceof Element && event.target.closest('[data-reference-drop]')
  document.addEventListener('dragover', event => {
    if (!isDropTarget(event)) return
    event.preventDefault()
    state.dragging = true
  })
  document.addEventListener('dragleave', event => {
    if (isDropTarget(event)) state.dragging = false
  })
  document.addEventListener('drop', event => {
    if (!isDropTarget(event)) return
    event.preventDefault()
    state.dragging = false
    const selected = event.dataTransfer?.files[0]
    if (selected) chooseImport(selected)
  })
  window.addEventListener('pagehide', () => { cancelImport(); stop() })
  /** @type {AudioBufferSourceNode | undefined} */ let keyPreview
  /** @type {OscillatorNode | undefined} */ let keyTone
  /** @type {GainNode | undefined} */ let keyGain
  let keyPreviewRequest = 0
  function stopKeyPreview() {
    keyPreviewRequest++
    keyPreview?.stop(); keyPreview?.disconnect(); keyPreview = undefined
    keyTone?.stop(); keyTone?.disconnect(); keyTone = undefined
    keyGain?.disconnect(); keyGain = undefined
  }
  document.addEventListener('reference-removed', stopKeyPreview)
  window.addEventListener('pagehide', stopKeyPreview)
  return {
    stopKeyPreview,
    /** @param {number} root */
    setKeyPreviewRoot(root) {
      if (keyTone && Number.isFinite(root)) keyTone.frequency.value = 130.8128 * 2 ** (root / 12)
    },
    /** @param {number} root */
    async previewKey(root) {
      stopKeyPreview()
      if (!context || !buffer) return
      const request = keyPreviewRequest
      await context.resume()
      if (request !== keyPreviewRequest) return
      keyPreview = context.createBufferSource(); keyPreview.buffer = buffer
      keyPreview.loop = true; keyPreview.loopStart = timingOffsets[0]
      keyPreview.loopEnd = Math.min(buffer.duration, timingOffsets[0] + 60 / Number(tempo.value))
      keyGain = context.createGain(); keyGain.gain.value = .18; keyGain.connect(context.destination)
      keyPreview.connect(keyGain); keyPreview.start(0, keyPreview.loopStart)
      keyTone = context.createOscillator(); keyTone.type = 'sine'
      keyTone.frequency.value = 130.8128 * 2 ** (root / 12)
      const level = context.createGain(); level.gain.value = .25
      keyTone.connect(level); level.connect(keyGain); keyTone.start()
    },
    refreshLoopLength() {
      if (!source || !followingAccompaniment) return
      const section = sections[playingSection]
      if (!section) return
      const end = Math.min(buffer?.duration ?? section.end, section.end + (timingOffsets[playingSection] ?? 0))
      source.loopEnd = end
      for (const {node} of stemSources) node.loopEnd = Math.min(node.buffer?.duration ?? end, end - (section.stemStart ?? section.start))
    },
    setVolume, toggleStem, separateStems,
    /** Compact, bounded preview around the actual audio clock. */
    livePreview() {
      if(!buffer)return {path:'',energy:0}
      const samples=buffer.getChannelData(0),rate=buffer.sampleRate,now=currentPosition()
      let path='',energy=0
      for(let x=0;x<120;x++){
        let peak=0
        for(let j=0;j<8;j++){
          const i=Math.floor((now-1+x/120*4+j/960*4)*rate)
          peak=Math.max(peak,Math.abs(samples[i]??0))
        }
        path+=`M${x} ${25-peak*24}V${25+peak*24}`
      }
      const center=Math.floor(now*rate)
      for(let j=0;j<256;j++){const v=samples[center+j*8]??0;energy+=v*v}
      return {path,energy:Math.sqrt(energy/256)}
    },
    getPosition() { return currentPosition() },
    /** @param {number} section @param {number} seconds @param {number} [pageOffset] */
    timingWaveform(section, seconds, pageOffset = 0) {
      const region = sections[section]
      if (!buffer || !region) return ''
      return waveformPath(buffer, Math.floor((region.start + timingOffsets[section] + pageOffset + seconds) * buffer.sampleRate), Math.floor((region.start + timingOffsets[section] + pageOffset) * buffer.sampleRate))
    },
    /** Waveform onset cue only; this does not judge the song's musical downbeat.
     * @param {number} section @param {number} [secondsAhead] */
    timingOnsetNear(section, secondsAhead = 0) {
      const region=sections[section]
      if(!buffer||!region)return false
      const data=buffer.getChannelData(0),rate=buffer.sampleRate
      const center=Math.round((region.start+timingOffsets[section]+secondsAhead)*rate)
      const energy=(/** @type {number} */ start)=>{
        let sum=0,count=0
        for(let i=Math.max(0,start);i<Math.min(data.length,start+rate*.025);i+=8){sum+=data[i]*data[i];count++}
        return count?Math.sqrt(sum/count):0
      }
      const before=energy(center-rate*.035),after=energy(center)
      return after>.025&&after>before*1.7
    },
    /** @param {number} section */
    timingBounds(section) {
      const region = sections[section]
      return buffer && region ? {min:-region.start, max:Math.max(0, buffer.duration - .1)} : {min:0,max:0}
    },
    /** @param {number} section */
    getTiming(section) { return timingOffsets[section] ?? 0 },
    /** @param {number} section @param {number} value */
    setTiming(section, value) {
      if (!Number.isFinite(value) || !buffer || !sections[section]) return
      const region = sections[section]
      const limit=buffer.duration-.1
      const adjusted=Math.max(-region.start,Math.min(limit,value))
      timingOffsets.fill(adjusted)
      if (state.playing && followingAccompaniment && context) {
        const now = context.currentTime
        const restartAt = Math.max(now, startedAt)
        const elapsed = Math.max(0, now - startedAt)
        const offset = accompanimentOffset + elapsed
        stop()
        void play(playingSection, restartAt, offset)
      }
    },
    /** @param {number} time @param {number} offset @param {number} section */
    startWithAccompaniment(time, offset, section) {
      stopKeyPreview()
      document.dispatchEvent(new Event('key-preview-stopped'))
      if (!buffer) return
      stop()
      void play(section, time, offset)
    },
    stopWithAccompaniment() {
      if (followingAccompaniment) stop()
    },
    editReference() {
      document.querySelector('.reference-timing-row')?.scrollIntoView({behavior:'smooth', block:'center'})
    },
    cancelImport,
    remove() { removeReference.click() },
  }
}
