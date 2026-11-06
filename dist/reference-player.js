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

/** A local-only reference player; independent of the backing transport. */
export function mountReferencePlayer() {
  const root = document.querySelector('#reference-player')
  if (!root) return
  /** @param {string} id */
  const input = id => /** @type {HTMLInputElement} */ (root.querySelector(`#ref-${id}`))
  const file = input('file'), seek = input('seek'), volume = input('volume')
  const controls = /** @type {HTMLFieldSetElement} */ (root.querySelector('fieldset'))
  const play = /** @type {HTMLButtonElement} */ (root.querySelector('#ref-play'))
  const message = /** @type {HTMLElement} */ (root.querySelector('#ref-status'))
  const bpmResult = /** @type {HTMLElement} */ (root.querySelector('#ref-bpm-result'))
  const apply = /** @type {HTMLButtonElement} */ (root.querySelector('#ref-apply'))
  const ruler = /** @type {HTMLInputElement} */ (root.querySelector('#ref-ruler'))
  const rulerLabel = /** @type {HTMLElement} */ (root.querySelector('#ref-region-label'))
  const head = input('head')
  const band = /** @type {HTMLElement} */ (root.querySelector('#ref-band'))
  const tempo = /** @type {HTMLInputElement} */ (document.querySelector('#tempo'))
  const key = /** @type {HTMLSelectElement} */ (document.querySelector('#key'))
  const splitStatus = /** @type {HTMLOutputElement} */ (root.querySelector('#ref-split-status'))
  const stemPanel = /** @type {HTMLElement} */ (root.querySelector('#ref-stems'))
  const toggles = Array.from(stemPanel.querySelectorAll('input'))
  /** @type {AudioBuffer[]} */ let stems = []
  /** @type {{node:AudioBufferSourceNode, level:GainNode}[]} */ let stemVoices = []
  const analyzer = createReferenceAnalyzer()
  /** @type {AbortController | undefined} */ let stemRequest
  let stemRevision = 0
  function clearStems() {
    stemRevision++
    analyzer.cancel()
    stemRequest?.abort()
    stemRequest = undefined
    stems = []
    stemPanel.style.display = 'none'
    splitStatus.textContent = ''
  }
  toggles.forEach((toggle, index) => toggle.addEventListener('change', () => {
    if (context) stemVoices[index]?.level.gain.setTargetAtTime(toggle.checked ? 1 : 0, context.currentTime, .01)
  }))
  async function separateRegion() {
    if (!buffer || !context || stems.length) return
    const revision = stemRevision
    const request = new AbortController()
    stemRequest = request
    splitStatus.textContent = 'ステムを分離しています…'
    try {
      const response = await fetch('/api/stems', {method:'POST', headers:{'Content-Type':'audio/wav'}, body:encodeClip(buffer, from, to), signal:request.signal})
      if (!response.ok) throw new Error(response.status === 404 ? '分離サーバーを起動してください。' : await response.text())
      const payload = await response.arrayBuffer()
      const view = new DataView(payload)
      let cursor = 0
      const decoded = await Promise.all(toggles.map(() => {
        const size = view.getUint32(cursor, true)
        cursor += 4
        if (!size || size > payload.byteLength - cursor) throw new Error('ステムの受信に失敗しました。')
        const bytes = payload.slice(cursor, cursor + size)
        cursor += size
        return /** @type {AudioContext} */ (context).decodeAudioData(bytes)
      }))
      if (revision !== stemRevision) return
      const playing = !!source
      pause()
      stems = decoded
      toggles.forEach(toggle => { toggle.checked = true })
      stemPanel.style.display = ''
      splitStatus.textContent = '分離できました。チェックを外すとそのパートが消えます。'
      if (playing) begin()
    } catch (error) {
      if (revision === stemRevision) splitStatus.textContent = error instanceof Error && error.message ? error.message : '分離できませんでした。'
    } finally {
      if (stemRequest === request) stemRequest = undefined
    }
  }
  let region = false
  /** @param {number} start @param {number} bpm */
  function selectRegion(start, bpm) {
    if (!buffer || !Number.isFinite(start)) return false
    const length = 1920 / bpm
    if (start < 0 || start + length > buffer.duration + 1e-8) {
      ruler.value = String(from)
      head.value = from.toFixed(3)
      message.textContent = 'この位置から8小節分の長さがありません。'
      return false
    }
    const playing = !!source
    pause()
    if (!region || from !== start || Math.abs(to - (start + length)) > 1e-8) clearStems()
    region = true
    from = start
    to = Math.min(buffer.duration, start + length)
    ruler.value = String(from)
    head.value = from.toFixed(3)
    band.hidden = false
    band.style.left = `${from / buffer.duration * 100}%`
    band.style.width = `${(to - from) / buffer.duration * 100}%`
    rulerLabel.textContent = `${from.toFixed(3)}秒 → ${to.toFixed(3)}秒`
    apply.disabled = matching
    offset = from
    if (playing) begin(); else draw()
    return true
  }
  root.querySelector('#ref-region')?.addEventListener('click', () => selectRegion(Math.floor(position() * 1000) / 1000, Number(tempo.value)))
  ruler.addEventListener('change', () => selectRegion(Number(ruler.value), Number(tempo.value)))
  head.addEventListener('change', () => selectRegion(head.valueAsNumber, Number(tempo.value)))

  /** @param {AudioBuffer} audio @param {number} start @param {number} end */
  function monoClip(audio, start, end) {
    const first = Math.floor(start * audio.sampleRate)
    const length = Math.min(audio.length - first, Math.ceil((end - start) * audio.sampleRate))
    const mono = new Float32Array(length)
    for (let channel = 0; channel < audio.numberOfChannels; channel++) {
      const data = audio.getChannelData(channel)
      for (let i = 0; i < length; i++) mono[i] += data[first + i] / audio.numberOfChannels
    }
    return mono
  }

  let matching = false
  apply.addEventListener('click', async () => {
    if (!buffer || !region || matching) return
    matching = true
    apply.disabled = true
    const audio = buffer
    const revision = stemRevision
    bpmResult.textContent = 'BPM・キー・コード進行を調べています…'
    try {
      const rate = audio.sampleRate
      const tempoAnalysis = await analyzer.analyze({kind:'tempo', samples:monoClip(audio, from, from + 60), rate, bpm:Number(tempo.value), key:Number(key.value)})
      if (audio !== buffer || revision !== stemRevision) return
      const detectedBpm = tempoAnalysis.bpm
      const bpm = detectedBpm ?? Number(tempo.value)
      if (!selectRegion(from, bpm)) {
        bpmResult.textContent = 'このBPMでは8小節分の長さがありません。頭を手前に移してください。'
        return
      }
      apply.disabled = true
      const clip = monoClip(audio, from, to)
      const harmonyRevision = stemRevision
      const harmony = await analyzer.analyze({kind:'harmony', samples:clip, rate, bpm, key:Number(key.value)})
      if (audio !== buffer || harmonyRevision !== stemRevision) return
      const detectedKey = harmony.key
      const option = Array.from(key.options).find(item => item.textContent === detectedKey)
      const [match] = harmony.matches ?? []
      tempo.value = String(bpm)
      tempo.dispatchEvent(new Event('input', {bubbles:true}))
      if (option) {
        key.value = option.value
        key.dispatchEvent(new Event('change', {bubbles:true}))
      }
      const drumPattern = harmony.drum
      const drums = /** @type {HTMLSelectElement | null} */ (document.querySelector('#rhythm-pattern'))
      if (drums && drumPattern && Array.from(drums.options).some(item => item.value === drumPattern)) {
        drums.value = drumPattern
        drums.dispatchEvent(new Event('change', {bubbles:true}))
      }
      if (match) document.dispatchEvent(new CustomEvent('reference-preset', {detail:match.id}))
      bpmResult.textContent = `${bpm} BPM${detectedBpm ? '' : '（現在値）'} ／ ${detectedKey ?? '現在のキー'} ／ ${match?.name ?? '進行候補なし'}`
      await separateRegion()
    } catch (error) {
      if (audio === buffer && !(error instanceof DOMException && error.name === 'AbortError')) bpmResult.textContent = '解析できませんでした。'
    } finally {
      matching = false
      apply.disabled = !region
    }
  })
  const clock = /** @type {HTMLElement} */ (root.querySelector('#ref-clock'))
  /** @type {AudioContext | undefined} */ let context
  /** @type {AudioBuffer | undefined} */ let buffer
  /** @type {AudioBufferSourceNode | undefined} */ let source
  /** @type {GainNode | undefined} */ let gain
  let offset = 0, began = 0, from = 0, to = 0, generation = 0, frame = 0
  const position = () => source && context ? loopPosition(offset, Math.max(0, context.currentTime - began), from, to) : offset
  const time = (/** @type {number} */ value) => `${Math.floor(value / 60)}:${(value % 60).toFixed(1).padStart(4, '0')}`
  function draw() {
    const current = position()
    seek.value = String(current)
    const label = `${time(current)} / ${time(buffer?.duration ?? 0)}`
    if (clock.textContent !== label) clock.textContent = label
    if (source) frame = requestAnimationFrame(draw)
  }
  function pause() {
    offset = position()
    for (const voice of stemVoices) {
      voice.node.stop()
      voice.node.disconnect()
      voice.level.disconnect()
    }
    stemVoices = []
    if (source && !stems.length) { source.stop(); source.disconnect() }
    source = undefined
    cancelAnimationFrame(frame)
    play.textContent = '▶ お手本を再生'
    draw()
  }
  function begin() {
    if (!context || !buffer || !gain) return
    if (offset >= to || (region && offset < from)) offset = from
    if (stems.length) {
      began = context.currentTime + .015
      const loopLength = Math.min(to - from, ...stems.map(stem => stem.duration))
      for (const [index, stem] of stems.entries()) {
        const node = context.createBufferSource(), level = context.createGain()
        node.buffer = stem; node.loop = true; node.loopEnd = loopLength
        level.gain.value = toggles[index].checked ? 1 : 0
        node.connect(level); level.connect(gain)
        node.start(began, (offset - from) % loopLength)
        stemVoices.push({node, level})
      }
      source = stemVoices[0].node
      play.textContent = 'Ⅱ 一時停止'
      draw()
      return
    }
    source = context.createBufferSource()
    source.buffer = buffer; source.loop = true; source.loopStart = from; source.loopEnd = to
    source.connect(gain); began = context.currentTime; source.start(began, offset)
    play.textContent = 'Ⅱ 一時停止'
    cancelAnimationFrame(frame); draw()
  }
  /** @param {File} selected */
  async function loadFile(selected) {
    const token = ++generation
    pause(); clearStems(); bpmResult.textContent = ''; apply.disabled = true; buffer = undefined; controls.disabled = true
    message.textContent = '読み込み中…'
    try {
      if (selected.size > 100 * 1024 * 1024) throw new Error('100MB以下の音声を選んでください。')
      context ??= new AudioContext()
      if (!gain) { gain = context.createGain(); gain.gain.value = Number(volume.value); gain.connect(context.destination) }
      const decoded = await context.decodeAudioData(await selected.arrayBuffer())
      if (token !== generation) return
      if (decoded.duration < .1) throw new Error('短すぎる音声です。')
      buffer = decoded; offset = from = 0; to = decoded.duration
      region = false; band.hidden = true; head.value = '0'; head.max = String(to); ruler.value = '0'; ruler.max = String(to); rulerLabel.textContent = '';
      const countIn = /** @type {HTMLInputElement | null} */ (document.querySelector('#count-in'))
      if (countIn) { countIn.checked = false; countIn.dispatchEvent(new Event('change', { bubbles: true })) }
      seek.max = String(to)
      controls.disabled = false
      message.textContent = selected.name
      draw()
    } catch (error) {
      if (token === generation) message.textContent = error instanceof Error && error.message.includes('ください') ? error.message : '読み込めませんでした。別のMP3・音声ファイルを選んでください。'
    }
  }
  file.addEventListener('change', () => { const selected = file.files?.[0]; if (selected) void loadFile(selected); file.value = '' })
  const drop = /** @type {HTMLElement} */ (root.querySelector('#ref-drop'))
  drop.addEventListener('dragover', event => { event.preventDefault(); drop.classList.add('dragging') })
  drop.addEventListener('dragleave', () => drop.classList.remove('dragging'))
  drop.addEventListener('drop', event => { event.preventDefault(); drop.classList.remove('dragging'); const selected = event.dataTransfer?.files[0]; if (selected) void loadFile(selected) })
  play.addEventListener('click', async () => {
    if (source) { pause(); return }
    play.disabled = true
    const token = generation
    try { await context?.resume(); if (token === generation && !document.hidden) begin() }
    catch { message.textContent = '再生できませんでした。もう一度再生を押してください。' }
    finally { play.disabled = false }
  })
  seek.addEventListener('input', () => {
    const playing = !!source, requested = Number(seek.value)
    pause(); offset = requested
    if (playing) begin(); else draw()
  })
  volume.addEventListener('input', () => { if (gain && context) gain.gain.setTargetAtTime(Number(volume.value), context.currentTime, .02) })
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause() })
  window.addEventListener('pagehide', () => { ++generation; analyzer.cancel(); stemRequest?.abort(); pause(); void context?.close() })
  root.addEventListener('keydown', event => event.stopPropagation())
}
