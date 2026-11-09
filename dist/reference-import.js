// Reference import processing. No DOM, Vue, playback clock, or global AudioContext.
// Analysis, separation and buffer allocation are supplied by the caller.

/** @param {AudioBuffer} buffer @param {number} from @param {number} to */
export function encodeClip(buffer, from, to) {
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
 * @param {{analyze:ReturnType<typeof import('./reference-analysis-client.js').createReferenceAnalyzer>['analyze'],
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
