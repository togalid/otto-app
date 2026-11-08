import { nextTick } from './vendor/vue.runtime.esm-browser.prod.js'
import { audioContext } from './audio.js'
export { estimateBpm, estimateMajorKey, estimateDrumPattern, rankProgressions } from './reference-analysis.js'
import { createReferenceAnalyzer } from './reference-analysis-client.js'

/** @param {AudioBuffer} buffer @param {number} from @param {number} to */
function encodeClip(buffer, from, to) {
  const rate = Math.min(buffer.sampleRate, 48000)
  const channels = Math.min(buffer.numberOfChannels, 2)
  const frames = Math.round((to - from) * rate)
  const wav = new DataView(new ArrayBuffer(44 + frames * channels * 2))
  for (const [offset, label] of /** @type {[number,string][]} */ ([[0,'RIFF'],[8,'WAVEfmt '],[36,'data']])) {
    for (let i = 0; i < label.length; i++) wav.setUint8(offset + i, label.charCodeAt(i))
  }
  wav.setUint32(4, wav.byteLength - 8, true)
  wav.setUint32(16, 16, true)
  wav.setUint16(20, 1, true)
  wav.setUint16(22, channels, true)
  wav.setUint32(24, rate, true)
  wav.setUint32(28, rate * channels * 2, true)
  wav.setUint16(32, channels * 2, true)
  wav.setUint16(34, 16, true)
  wav.setUint32(40, wav.byteLength - 44, true)
  for (let channel = 0; channel < channels; channel++) {
    const data = buffer.getChannelData(channel)
    for (let i = 0; i < frames; i++) {
      const sample = data[Math.floor((from + i / rate) * buffer.sampleRate)] ?? 0
      wav.setInt16(44 + (i * channels + channel) * 2, Math.max(-1, Math.min(1, sample)) * 32767, true)
    }
  }
  return wav.buffer
}

/** Position on a looping audio clock. @param {number} offset @param {number} elapsed @param {number} start @param {number} end */
export function loopPosition(offset, elapsed, start, end) {
  const position = offset + elapsed
  return position < end ? position : start + (position - end) % (end - start)
}

/** @param {AudioBuffer} audio @param {number} start @param {number} end */
function monoClip(audio, start, end) {
  const first = Math.floor(start * audio.sampleRate)
  const length = Math.max(0, Math.min(audio.length - first, Math.ceil((end - start) * audio.sampleRate)))
  const mono = new Float32Array(length)
  for (let channel = 0; channel < audio.numberOfChannels; channel++) {
    const data = audio.getChannelData(channel)
    for (let i = 0; i < length; i++) mono[i] += data[first + i] / audio.numberOfChannels
  }
  return mono
}

/** Separate the complete source once; every arrangement section shares its head and stems.
 * @param {AudioBuffer} audio
 * @param {{analyze:ReturnType<typeof createReferenceAnalyzer>['analyze'],
 * separate:(audio:AudioBuffer,start:number,end:number,signal:AbortSignal)=>Promise<AudioBuffer[]>,
 * createBuffer:(channels:number,length:number,rate:number)=>AudioBuffer,
 * bpm:number,key:number,signal:AbortSignal,progress:(message:string)=>void,onAnalyzed?:(result:{bpm:number,key:number})=>Promise<void>,skipStems?:boolean}} options
 */
export async function analyzeSharedReference(audio, {analyze, separate, createBuffer, bpm, key, signal, progress, onAnalyzed, skipStems = false}) {
  signal.throwIfAborted()
  progress('テンポとキーを読み取っています…')
  const rate = audio.sampleRate
  const request = {rate, bpm, key}
  const tempo = await analyze({...request, kind:'tempo', samples:monoClip(audio, 0, 60)})
  signal.throwIfAborted()
  const detectedBpm = Math.round(Math.max(40, Math.min(200, tempo.bpm ?? bpm)))
  const originalKey = await analyze({...request, bpm:detectedBpm, kind:'key', samples:monoClip(audio, 0, 60)})
  signal.throwIfAborted()
  const initialKey = originalKey.keyScores ? originalKey.keyScores.indexOf(Math.max(...originalKey.keyScores)) : key
  await onAnalyzed?.({bpm:detectedBpm,key:initialKey})
  signal.throwIfAborted()
  if (skipStems) return {bpm:detectedBpm, key:initialKey, sections:Array.from({length:4}, () => ({start:0, end:audio.duration, stemStart:0, stems:/** @type {AudioBuffer[]} */ ([])}))}
  /** @type {AudioBuffer[]} */
  let stems = []
  // Stereo 48 kHz PCM16 for 90 seconds stays below the server's 20 MiB limit.
  for (let start = 0; start < audio.duration; start += 90) {
    progress(`Stemを分離しています… ${Math.floor(start / 90) + 1}/${Math.ceil(audio.duration / 90)}`)
    const chunk = await separate(audio, start, Math.min(audio.duration, start + 90), signal)
    signal.throwIfAborted()
    if (chunk.length !== 4 || chunk.some(stem => !stem.length || stem.sampleRate !== rate)) throw new Error('Stemの音声形式を確認できませんでした。')
    if (!stems.length) stems = chunk.map(stem => createBuffer(stem.numberOfChannels, audio.length, rate))
    const offset = Math.round(start * rate)
    chunk.forEach((stem, index) => {
      if (stem.numberOfChannels !== stems[index].numberOfChannels) throw new Error('Stemのチャンネル数が一致しません。')
      for (let channel = 0; channel < stem.numberOfChannels; channel++) {
        stems[index].getChannelData(channel).set(stem.getChannelData(channel).subarray(0, audio.length - offset), offset)
      }
    })
  }
  progress('Stemからテンポとキーを確認しています…')
  const drumTempo = await analyze({...request, bpm:detectedBpm, kind:'tempo', samples:monoClip(stems[1], 0, 60)})
  signal.throwIfAborted()
  const accompaniment = monoClip(stems[3], 0, 60)
  const bass = monoClip(stems[2], 0, 60)
  for (let i = 0; i < accompaniment.length; i++) accompaniment[i] += bass[i]
  const harmony = await analyze({...request, bpm:detectedBpm, kind:'key', samples:accompaniment})
  signal.throwIfAborted()
  const scores = harmony.keyScores?.map((score, index) => score + (index === initialKey ? .08 : 0))
  return {
    bpm:Math.round(Math.max(40, Math.min(200, drumTempo.bpm ?? detectedBpm))),
    key:scores ? scores.indexOf(Math.max(...scores)) : initialKey,
    sections:Array.from({length:4}, () => ({start:0, end:audio.duration, stemStart:0, stems})),
  }
}

/**
 * Independent playback of the original audio.
 * @param {ReturnType<typeof import('./main-controls.js').mountReferenceControls>['state']} state
 * @param {(section:number)=>number} [getSectionBars]
 * @param {(result:{bpm:number,key:number})=>Promise<void>} applyArrangement
 */
export function mountReferencePlayer(state, applyArrangement, getSectionBars = () => 16) {
  const currentMeter = () => Number(/** @type {HTMLInputElement | null} */ (document.getElementById('meter'))?.value) || 4
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
  const time = (/** @type {number} */ value) => {
    const tenths = Math.round(value * 10)
    return `${Math.floor(tenths / 600)}:${((tenths % 600) / 10).toFixed(1).padStart(4, '0')}`
  }

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
    if (!pendingStemSections || source) return
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
  const cropTime = /** @type {HTMLOutputElement} */ (cropDialog.querySelector('#ref-crop-time'))
  const cropEnd = /** @type {HTMLElement} */ (cropDialog.querySelector('#ref-crop-end'))
  const extendCrop = /** @type {HTMLButtonElement} */ (cropDialog.querySelector('#ref-crop-extend'))
  const zoomIn = /** @type {HTMLButtonElement} */ (cropDialog.querySelector('#ref-crop-zoom-in'))
  const zoomOut = /** @type {HTMLButtonElement} */ (cropDialog.querySelector('#ref-crop-zoom-out'))
  const cropStart = /** @type {HTMLElement} */ (cropDialog.querySelector('.crop-scale > span'))
  const cropMask = /** @type {SVGRectElement} */ (cropDialog.querySelector('rect'))
  const cropWave = /** @type {SVGPathElement} */ (cropDialog.querySelector('path'))
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

  /** @type {AudioBufferSourceNode | undefined} */ let cropPreview
  let cropPreviewRequest = 0
  let cropPreviewFrame = 0

  function stopCropPreview() {
    ++cropPreviewRequest
    cancelAnimationFrame(cropPreviewFrame)
    if (!cropPreview) return
    cropPreview.stop()
    cropPreview.disconnect()
    cropPreview = undefined
  }

  /** @param {AudioBuffer} audio @param {number} initialOffset @returns {Promise<number | null>} */
  function chooseCrop(audio, initialOffset, draft = /** @type {number[] | null} */ (null), sectionDuration = 960 * currentMeter() / Number(tempo.value)) {
    const extensionSeconds = 15
    let horizon = Math.max(extensionSeconds, Math.ceil(initialOffset / extensionSeconds) * extensionSeconds)
    let viewStart = 0
    let selectedOffset = initialOffset
    function drawCursor() {
      cropMask.setAttribute('width', String(1000 * (selectedOffset - viewStart) / (horizon - viewStart)))
      cropTime.value = time(cropPosition.valueAsNumber)
    }
    function resetCursor() {
      stopCropPreview()
      cropPosition.value = String(selectedOffset)
      drawCursor()
    }
    cropDialog.querySelector('form')?.setAttribute('novalidate', '')
    cropDialog.returnValue = ''
    return new Promise(resolve => {
      const listeners = new AbortController()
      const options = {signal: listeners.signal}
      let playing = false
      let selectedSection = 0
      /** @type {((position:number | null) => void)[]} */ const playbackCursors = []
      const tabs = document.createElement('div')
      tabs.className = 'crop-section-waves'
      /** @type {(() => void)[]} */ const refreshRows = []
      if (draft) {
        cropDialog.querySelector('.crop-heading')?.after(tabs)
        draft.forEach((start, index) => {
          const row = document.createElement('div')
          const label = document.createElement('strong')
          label.textContent = 'ABCD'[index]
          const wave = document.createElement('div')
          wave.className = 'reference-timeline crop-timeline'
          let from = 0
          let to = audio.duration
          let windowOffset = Math.max(0, start - 2)
          const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
          svg.setAttribute('viewBox', '0 0 1000 100')
          svg.setAttribute('preserveAspectRatio', 'none')
          const path = document.createElementNS(svg.namespaceURI, 'path')
          path.setAttribute('d', waveformPath(audio, Math.floor(to * audio.sampleRate), Math.floor(from * audio.sampleRate)))
          const marker = document.createElementNS(svg.namespaceURI, 'line')
          marker.setAttribute('y1', '0'); marker.setAttribute('y2', '100')
          marker.setAttribute('stroke', '#d32638'); marker.setAttribute('stroke-width', '2')
          const mask = document.createElementNS(svg.namespaceURI, 'rect')
          mask.setAttribute('x', '0'); mask.setAttribute('y', '0')
          mask.setAttribute('height', '100'); mask.setAttribute('width', '0')
          const playhead = document.createElementNS(svg.namespaceURI, 'line')
          playhead.setAttribute('y1', '0'); playhead.setAttribute('y2', '100')
          playhead.setAttribute('stroke', '#f5cc24'); playhead.setAttribute('stroke-width', '3')
          playhead.setAttribute('stroke-dasharray', '5 3')
          playhead.setAttribute('visibility', 'hidden')
          playbackCursors.push(position => {
            const visible = position !== null && position >= from && position <= to
            playhead.setAttribute('visibility', visible ? 'visible' : 'hidden')
            if (position !== null) {
              const x = String((position - from) / (to - from) * 1000)
              playhead.setAttribute('x1', x); playhead.setAttribute('x2', x)
            }
          })
          const handle = document.createElementNS(svg.namespaceURI, 'path')
          handle.setAttribute('fill', '#d32638')
          handle.setAttribute('stroke', 'none')
          svg.append(path, mask, marker, playhead, handle)
          const slider = document.createElement('input')
          slider.type = 'range'; slider.min = String(from); slider.max = String(Math.min(to, audio.duration - .1)); slider.step = 'any'; slider.value = String(start)
          slider.setAttribute('aria-label', 'ABCD'[index] + 'の頭')
          const output = document.createElement('output')
          function update() {
            if (!draft) return
            const earliest = 0
            draft[index] = Math.max(earliest, Math.min(audio.duration - .1, draft[index]))
            from = Math.min(audio.duration - .1, earliest + windowOffset)
            to = Math.min(audio.duration, from + 15)
            slider.min = String(from); slider.max = String(to - .1); slider.value = String(draft[index])
            path.setAttribute('d', waveformPath(audio, Math.floor(to * audio.sampleRate), Math.floor(from * audio.sampleRate)))
            const x = String((Number(slider.value) - from) / (to - from) * 1000)
            mask.setAttribute('width', String(Math.max(0, Math.min(1000, Number(x)))))
            marker.setAttribute('x1', x); marker.setAttribute('x2', x)
            const handleX = Math.max(10, Math.min(990, Number(x)))
            handle.setAttribute('d', `M${handleX - 9} 0H${handleX + 9}V7L${handleX} 15L${handleX - 9} 7Z`)
            output.value = time(Number(slider.value))
          }
          slider.addEventListener('input', () => {
            draft[index] = Number(slider.value)
            selectedSection = index
            selectedOffset = draft[index]
            viewStart = from; horizon = to
            cropPosition.value = slider.value
            stopCropPreview(); playing = false; updatePreviewButton()
            refreshRows.forEach(refresh => refresh())
            void playPreview(true)
          }, options)
          let dragging = false
          /** @param {PointerEvent} event */
          function seek(event) {
            if (confirmCrop.disabled) return
            const bounds = wave.getBoundingClientRect()
            slider.value = String(from + Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)) * (to - from))
            slider.dispatchEvent(new Event('input'))
          }
          wave.addEventListener('pointerdown', event => {
            if (event.button !== 0 || confirmCrop.disabled) return
            event.preventDefault()
            const bounds = wave.getBoundingClientRect()
            const markerX = bounds.left + Math.max(.01, Math.min(.99, (draft[index] - from) / (to - from))) * bounds.width
            dragging = event.clientY - bounds.top <= 22 || Math.abs(event.clientX - markerX) <= 22
            if (dragging) {
              wave.setPointerCapture(event.pointerId)
              seek(event)
            } else {
              selectedSection = index; selectedOffset = draft[index]
              viewStart = from; horizon = to
              void playPreview()
            }
          }, options)
          wave.addEventListener('pointermove', event => { if (dragging) seek(event) }, options)
          wave.addEventListener('pointerup', () => { dragging = false }, options)
          wave.addEventListener('pointercancel', () => { dragging = false }, options)
          const navigation = document.createElement('div')
          navigation.className = 'crop-wave-navigation'
          for (const direction of [-1, 1]) {
            const button = document.createElement('button')
            button.type = 'button'; button.textContent = direction < 0 ? '−15秒' : '＋15秒'
            button.addEventListener('click', () => {
              if (confirmCrop.disabled) return
              windowOffset = Math.max(0, Math.min(audio.duration - .1, windowOffset + direction * 15))
              update()
            }, options)
            navigation.append(button)
          }
          const preview = document.createElement('button')
          preview.type = 'button'; preview.textContent = '▶ 試聴'
          preview.addEventListener('click', () => {
            selectedSection = index; selectedOffset = draft[index]
            viewStart = from; horizon = to
            void playPreview()
          }, options)
          refreshRows.push(update)
          update()
          wave.append(svg, slider); row.append(label, wave, output, preview, navigation); tabs.append(row)
        })
        cropDialog.classList.add('section-heads')
      }
      listeners.signal.addEventListener('abort', () => { tabs.remove(); cropDialog.classList.remove('section-heads') }, {once:true})
      function updatePreviewButton() {
        if (!playing) playbackCursors.forEach(cursor => cursor(null))
        previewButton.textContent = playing ? '■ 停止' : '▶ 試聴'
        previewButton.setAttribute('aria-label', playing ? '試聴を停止' : '試聴を再生')
      }
      updatePreviewButton()
      let resumeAfterDrag = false
      /** @type {number | null} */ let pointer = null
      let lastScrub = -Infinity
      /** @param {boolean} [scrubbing] */
      async function playPreview(scrubbing = false) {
        if (!context || !gain || confirmCrop.disabled) return
        stopCropPreview()
        playing = !scrubbing
        updatePreviewButton()
        const offset = selectedOffset
        const request = cropPreviewRequest
        try {
          await context.resume()
          if (request !== cropPreviewRequest || !cropDialog.open) return
          const node = context.createBufferSource()
          node.buffer = audio
          const startedAt = context.currentTime
          const duration = Math.min(scrubbing ? .12 : Math.max(.1, horizon - offset), audio.duration - offset)
          const envelope = context.createGain()
          if (scrubbing) {
            envelope.gain.setValueAtTime(0, startedAt)
            envelope.gain.linearRampToValueAtTime(1, startedAt + .008)
            envelope.gain.setValueAtTime(1, startedAt + duration - .018)
            envelope.gain.linearRampToValueAtTime(0, startedAt + duration)
          }
          node.connect(envelope).connect(gain)
          node.onended = () => {
            node.disconnect()
            envelope.disconnect()
            if (cropPreview !== node) return
            playbackCursors.forEach(cursor => cursor(null))
            cropPreview = undefined
            if (!scrubbing) {
              playing = false
              updatePreviewButton()
              resetCursor()
            }
          }
          node.start(startedAt, offset, duration)
          cropPreview = node
          const previewContext = context
          function followPlayback() {
            if (cropPreview !== node) return
            const currentPosition = offset + previewContext.currentTime - startedAt
            playbackCursors.forEach((cursor, index) => cursor(index === selectedSection ? currentPosition : null))
            cropPosition.value = String(currentPosition)
            drawCursor()
            cropPreviewFrame = requestAnimationFrame(followPlayback)
          }
          if (!scrubbing) cropPreviewFrame = requestAnimationFrame(followPlayback)
        } catch {
          if (request !== cropPreviewRequest) return
          playing = false
          updatePreviewButton()
          cropTime.value = '試聴できませんでした。'
        }
      }
      cropPosition.addEventListener('pointerdown', event => {
        if (event.button !== 0 || pointer !== null) return
        pointer = event.pointerId
        resumeAfterDrag = playing
        playing = false
        updatePreviewButton()
        lastScrub = -Infinity
        stopCropPreview()
      }, options)
      cropPosition.addEventListener('input', () => {
        selectedOffset = cropPosition.valueAsNumber
        drawCursor()
        if (pointer === null && playing) {
          void playPreview()
        } else if (performance.now() - lastScrub >= 75) {
          lastScrub = performance.now()
          void playPreview(true)
        }
      }, options)
      /** @param {PointerEvent} event */
      function finishDrag(event) {
        if (pointer !== event.pointerId) return
        pointer = null
        if (resumeAfterDrag) void playPreview()
        else if (event.type === 'pointerup') void playPreview(true)
        else resetCursor()
      }
      window.addEventListener('pointerup', finishDrag, options)
      window.addEventListener('pointercancel', finishDrag, options)
      /** @param {number} position */
      function drawWaveform(position) {
        const endSample = Math.min(horizon * audio.sampleRate, audio.length)
        horizon = endSample / audio.sampleRate
        cropPosition.min = String(viewStart)
        cropPosition.max = String(Math.floor(Math.min(horizon, audio.duration - .1) * 1000) / 1000)
        cropPosition.value = String(position)
        selectedOffset = cropPosition.valueAsNumber
        cropWave.setAttribute('d', waveformPath(audio, endSample, Math.floor(viewStart * audio.sampleRate)))
        cropStart.textContent = time(viewStart)
        cropEnd.textContent = time(horizon)
        zoomIn.disabled = horizon - viewStart <= 1
        zoomOut.disabled = viewStart === 0 && horizon === audio.duration
        extendCrop.disabled = endSample === audio.length
        drawCursor()
      }
      /** @param {number} factor */
      function zoom(factor) {
        const width = Math.max(1, Math.min(audio.duration, (horizon - viewStart) * factor))
        viewStart = Math.max(0, Math.min(audio.duration - width, selectedOffset - width / 2))
        horizon = viewStart + width
        drawWaveform(selectedOffset)
        if (playing) void playPreview()
      }
      zoomIn.addEventListener('click', () => zoom(.5), options)
      zoomOut.addEventListener('click', () => zoom(2), options)
      drawWaveform(initialOffset)
      extendCrop.addEventListener('click', () => {
        horizon += extensionSeconds
        drawWaveform(selectedOffset)
        if (playing) void playPreview()
      }, {signal: listeners.signal})
      if (!cropDialog.open) cropDialog.showModal()
      cropPosition.focus()
      /** @param {number} direction */
      function adjustPosition(direction) {
        if (cropPosition.disabled) return
        const next = Math.max(0, Math.min(Number(cropPosition.max),
          Math.round((cropPosition.valueAsNumber + direction * .1) * 1000) / 1000))
        cropPosition.value = String(next)
        cropPosition.dispatchEvent(new Event('input'))
      }
      cropBack.addEventListener('click', () => adjustPosition(-1), options)
      cropForward.addEventListener('click', () => adjustPosition(1), options)
      function togglePreview() {
        if (pointer !== null || previewButton.disabled) return
        if (playing) {
          playing = false
          updatePreviewButton()
          resetCursor()
        } else void playPreview()
      }
      previewButton.addEventListener('click', togglePreview, options)
      cropDialog.addEventListener('keydown', event => {
        if ((event.key === 'ArrowLeft' || event.key === 'ArrowRight') &&
            !event.ctrlKey && !event.metaKey && !event.altKey && !event.isComposing) {
          event.preventDefault()
          event.stopPropagation()
          adjustPosition(event.key === 'ArrowLeft' ? -1 : 1)
          return
        }
        if (event.code !== 'Space' || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return
        event.stopPropagation()
        event.preventDefault()
        if (event.repeat) return
        togglePreview()
      }, {signal: listeners.signal})
      cropDialog.addEventListener('keyup', event => {
        if (event.code === 'Space' && !event.ctrlKey && !event.metaKey && !event.altKey && !event.isComposing) {
          event.preventDefault()
          event.stopPropagation()
        }
      }, options)
      cropDialog.addEventListener('submit', event => {
        if (event.submitter !== confirmCrop) return
        event.preventDefault()
        listeners.abort()
        stopCropPreview()
        // Each row owns its start; playback never writes into the draft.
        resolve(selectedOffset)
      }, {signal: listeners.signal})
      cropDialog.addEventListener('close', () => {
        listeners.abort()
        stopCropPreview()
        resolve(null)
      }, {signal: listeners.signal, once: true})
    })
  }

  /** @param {File} selected @param {number | null} [previousOffset] @param {boolean} [skipStems] */
  async function loadFile(selected, previousOffset = null, skipStems = false) {
    if (activeImport) return
    removeReference.hidden = previousOffset === null
    const request = new AbortController()
    activeImport = request
    state.importing = true
    const {signal} = request
    try {
      if (selected.size > 100 * 1024 * 1024) throw new Error('100MB以下の音声を選んでください。')
      context ??= audioContext()
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
      await nextTick()
      document.dispatchEvent(new Event('reference-loaded'))
      try {
        const result=await analyzeSharedReference(decoded,{
          analyze:analyzer.analyze,separate:separateRegion,
          createBuffer:(channels,length,rate)=>/** @type {AudioContext} */(context).createBuffer(channels,length,rate),
          bpm:Number(tempo.value),key:Number(key.value),signal,skipStems,
          progress:message=>{state.message=message},
          onAnalyzed:async result=>{
            // Late analysis never overwrites a manual adjustment or stops playback.
            if(!touched&&!state.playing){await applyArrangement(result);signal.throwIfAborted();document.dispatchEvent(new Event('reference-analysis-ready'))}
          },
        })
        signal.throwIfAborted()
        if(!skipStems){
          pendingStemSections=Array.from({length:32},()=>result.sections[0])
          if(source)state.message='Stem分離完了 · 次の再生から使用します'
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

  function cancelImport() {
    activeImport?.abort()
    activeImport = undefined
    analyzer.cancel()
    state.message = ''
    state.importing = false
    removeReference.disabled = false
    stopCropPreview()
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
    void loadFile(selected)
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
    setVolume, toggleStem,
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
