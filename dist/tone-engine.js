import { frequency } from './music.js'

export const meterParts = /** @type {const} */ (['drum', 'bass', 'chord', 'melody', 'bell', 'pluck', 'phrase', 'fx'])
/** @typedef {typeof meterParts[number]} MeterPart */

/** @type {WeakMap<AudioContext, Map<MeterPart, AnalyserNode>>} */
const meters = new WeakMap()

/** @param {AudioContext} context @param {MeterPart} part */
export function partMeter(context, part) {
  let parts = meters.get(context)
  if (!parts) {
    parts = new Map()
    meters.set(context, parts)
  }
  let meter = parts.get(part)
  if (!meter) {
    meter = context.createAnalyser()
    meter.fftSize = 1024
    meter.connect(context.destination)
    parts.set(part, meter)
  }
  return meter
}

/** @type {Promise<any> | undefined} */
let libraryPromise
/** @type {AudioContext | undefined} */
let activeContext
/** @param {AudioContext} context */
export async function loadToneEngine(context) {
  if (!libraryPromise) {
    libraryPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = './vendor/tone.js'
      script.onload = () => resolve(/** @type {any} */ (window).Tone)
      script.onerror = () => {
        script.remove()
        reject(new Error('Tone.js を読み込めませんでした。'))
      }
      document.head.append(script)
    }).catch((error) => {
      libraryPromise = undefined
      throw error
    })
  }
  const Tone = await libraryPromise
  if (!Tone) throw new Error('Tone.js を初期化できませんでした。')
  if (activeContext !== context) {
    Tone.setContext(
      // PolySynth queues future voices via Tone's clock; schedule them ahead of
      // the audio deadline so small main-thread delays do not shift attacks.
      new Tone.Context({ context, clockSource: 'timeout', lookAhead: 0.1 }),
    )
    activeContext = context
  }
  return {
    Tone,
    bass: new ToneBass(Tone, context),
    drums: new ToneDrums(Tone, context),
  }
}

export class ToneBass {
  /** @param {any} tone @param {AudioContext} context */
  constructor(tone, context) {
    this.tone = tone
    this.context = context
  }
  volume = 0.5
  timbre = 'electric'
  activeTimbre = ''
  /** @type {{waveform:string,octave:number,cent:number}[]|undefined} */
  oscillators
  activeWaveform = ''
  /** @type {any[]} */
  voices = []
  /** @type {any[]} */
  vibratos = []
  /** @type {any[]} */
  toneLfos = []
  /** @type {any[]} */
  filterLfos = []
  lfoRate = 5
  lfoDepth = 0
  lfoCutoff = false
  lfoPitch = false
  lfoWaveform = 'sine'
  lfoPhase = 0
  lfoPhaseTime = 0
  pitchBend = 0
  modulation = 0
  /** @type {{time:number,duration:number,release:number}[]} */
  displayNotes = []
  /** @type {{cutoff:number,resonance:number,filterType?:'lowpass'|'highpass',amp:{attack:number,decay:number,sustain:number,release:number},filter:{attack:number,decay:number,sustain:number,release:number,amount:number}}|undefined} */
  toneSettings
  /** @type {any} */
  synth
  /** @type {GainNode | undefined} */
  gain
  /** @param {number} value */
  setVolume(value) {
    this.volume = Math.max(0, Math.min(1, value))
    if (this.gain)
      this.gain.gain.setTargetAtTime(
        this.volume * 0.25,
        this.context.currentTime,
        0.02,
      )
  }
  /** @param {number} midi @param {number} time @param {number} duration @param {number} [velocity] @param {number} [slideFrom] */
  playAt(midi, time, duration, velocity = 0.8, slideFrom) {
    const specs = this.oscillators ?? [{waveform:'',octave:0,cent:0}]
    const signature = JSON.stringify(specs)
    if (specs.every(spec => spec.waveform === 'off')) { if (this.synth) this.silence(); return }
    if (this.synth && (this.activeTimbre !== this.timbre || this.activeWaveform !== signature)) this.silence()
    if (!this.synth) {
      this.activeTimbre = this.timbre
      this.activeWaveform = signature
      this.gain = this.context.createGain()
      this.gain.gain.value = this.volume * 0.25
      this.gain.connect(partMeter(this.context, 'bass'))
      const createVoice = (/** @type {string} */ waveform) => new this.tone.MonoSynth({
        oscillator: {
          type: waveform || (
            this.timbre === 'acoustic'
              ? 'triangle'
              : this.timbre === 'electric'
                ? 'square'
                : 'sawtooth'),
        },
        filter: { type: 'lowpass', Q: 1, rolloff: -24 },
        envelope: { attack: 0.005, decay: this.timbre === 'synth' ? 0.18 : 0.7, sustain: this.timbre === 'synth' ? 0.42 : 0.12, release: 0.12 },
        filterEnvelope: {
          attack: 0.005,
          decay: 0.18,
          sustain: 0.24,
          release: 0.12,
          baseFrequency: 100,
          octaves: 3,
        },
      }).connect(this.gain)
      this.voices = specs.map(spec => spec.waveform === 'off' ? null : createVoice(spec.waveform))
      this.synth = this.voices.find(Boolean)
      this.vibratos = this.voices.map(voice => voice && this.tone.LFO ? new this.tone.LFO({frequency:5.2,min:-65,max:65,amplitude:this.modulation}).connect(voice.detune).start() : null)
      this.toneLfos = this.voices.map(voice => voice && this.tone.LFO ? new this.tone.LFO({type:this.lfoWaveform,frequency:this.lfoRate,min:-100,max:100,amplitude:this.lfoPitch ? this.lfoDepth / 100 : 0}).connect(voice.detune).start() : null)
      this.filterLfos = this.voices.map(voice => voice?.filter?.detune && this.tone.LFO ? new this.tone.LFO({type:this.lfoWaveform,frequency:this.lfoRate,min:-1200,max:1200,amplitude:this.lfoCutoff ? this.lfoDepth / 100 : 0}).connect(voice.filter.detune).start() : null)
      this.lfoPhase = 0
      this.lfoPhaseTime = this.context.currentTime
      this.setPitchBend(this.pitchBend)
    }
    if (!this.synth) return
    this.applyToneSettings()
    const now = this.context.currentTime
    this.displayNotes = this.displayNotes.filter(note => note.time + note.duration + note.release > now).slice(-63)
    this.displayNotes.push({time,duration,release:Number(this.synth.envelope?.release ?? .12)})
    this.voices.forEach((voice, index) => {
      if (!voice) return
      const spec = specs[index]
      const offset = spec.octave * 12 + spec.cent / 100
      const frequency = 440 * 2 ** ((midi + offset - 69) / 12)
      const start = slideFrom === undefined ? frequency : 440 * 2 ** ((slideFrom + offset - 69) / 12)
      voice.triggerAttackRelease(start, duration, time, Math.max(0, Math.min(1, velocity)) / Math.sqrt(this.voices.filter(Boolean).length))
      if (slideFrom !== undefined) voice.frequency.exponentialRampToValueAtTime(frequency, time + Math.min(0.07, duration * 0.5))
    })
  }
  applyToneSettings() {
    if (!this.synth || !this.toneSettings) return
    const {cutoff, resonance, amp, filter} = this.toneSettings
    this.voices.filter(Boolean).forEach(voice => {
      voice.filter.type = this.toneSettings?.filterType ?? 'lowpass'
      voice.filter.Q.value = resonance
      voice.envelope.set(amp)
      voice.filterEnvelope.set({ attack: filter.attack, decay: filter.decay, sustain: filter.sustain, release: filter.release, baseFrequency: cutoff, octaves: filter.amount })
    })
  }
  /** @param {number} value */
  setPitchBend(value) {
    this.pitchBend = Math.max(-1,Math.min(1,value))
    this.voices.filter(Boolean).forEach(voice => voice.detune?.rampTo(this.pitchBend * 200,.02))
  }
  /** @param {number} value */
  setModulation(value) {
    this.modulation = Math.max(0,Math.min(1,value))
    this.vibratos.filter(Boolean).forEach(lfo => lfo.amplitude.rampTo(this.modulation,.04))
  }
  /** @param {number} rate @param {number} depth @param {boolean} [cutoff] @param {boolean} [pitch] @param {string} [waveform] */
  setLfo(rate, depth, cutoff = false, pitch = false, waveform = 'sine') {
    if (this.synth) this.lfoPhase = this.getLfoPhase()
    this.lfoPhaseTime = this.context.currentTime ?? 0
    this.lfoRate = Math.max(0, Math.min(12, rate))
    this.lfoDepth = Math.max(0, Math.min(100, depth))
    this.lfoCutoff = cutoff
    this.lfoPitch = pitch
    this.lfoWaveform = ['sine','triangle','sawtooth','square'].includes(waveform) ? waveform : 'sine'
    this.toneLfos.filter(Boolean).forEach(lfo => {
      if (lfo.type !== this.lfoWaveform) lfo.type = this.lfoWaveform
      lfo.frequency.rampTo(this.lfoRate, .04)
      lfo.amplitude.rampTo(pitch ? this.lfoDepth / 100 : 0, .04)
    })
    this.filterLfos.filter(Boolean).forEach(lfo => {
      if (lfo.type !== this.lfoWaveform) lfo.type = this.lfoWaveform
      lfo.frequency.rampTo(this.lfoRate, .04)
      lfo.amplitude.rampTo(cutoff ? this.lfoDepth / 100 : 0, .04)
    })
  }
  getLfoPhase() {
    return (this.lfoPhase + Math.max(0, (this.context.currentTime ?? 0) - this.lfoPhaseTime) * this.lfoRate) % 1
  }
  silence() {
    this.displayNotes = []
    this.vibratos.filter(Boolean).forEach(lfo => lfo.dispose())
    this.vibratos = []
    this.toneLfos.filter(Boolean).forEach(lfo => lfo.dispose())
    this.toneLfos = []
    this.filterLfos.filter(Boolean).forEach(lfo => lfo.dispose())
    this.filterLfos = []
    this.voices.filter(Boolean).forEach(voice => voice.dispose())
    this.voices = []
    this.synth = undefined
    this.gain?.disconnect()
    this.gain = undefined
  }
}

export class ToneDrums {
  /** @param {any} tone @param {AudioContext} context */
  constructor(tone, context) {
    this.tone = tone
    this.context = context
  }
  volume = 0.35
  timbre = 'acoustic'
  activeTimbre = ''
  /** @type {any} */
  kick
  /** @type {any} */
  snare
  /** @type {any} */
  snareBody
  /** @type {any} */
  hat
  /** @type {GainNode | undefined} */
  gain
  /** @param {number} value */
  setVolume(value) {
    this.volume = Math.max(0, Math.min(1, value))
    if (this.gain)
      this.gain.gain.setTargetAtTime(
        this.volume * 0.35,
        this.context.currentTime,
        0.02,
      )
  }
  /** @param {string} sound @param {number} time @param {number} [velocity] @param {number} [duration] @param {number} [pitch] @param {boolean} [accent] */
  hitAt(sound, time, velocity, duration, pitch = 0, accent = false) {
    const defaults = { kick: 0.85, snare: 0.55, hat: 0.35 }
    const level = Math.max(0, Math.min(1, Number.isFinite(velocity) ? /** @type {number} */ (velocity) : (defaults[/** @type {keyof typeof defaults} */ (sound)] ?? 0)))
    if (this.gain && this.activeTimbre !== this.timbre) this.silence()
    if (!this.gain) {
      this.activeTimbre = this.timbre
      this.gain = this.context.createGain()
      this.gain.gain.value = this.volume * 0.35
      this.gain.connect(partMeter(this.context, 'drum'))
      this.kick = new this.tone.MembraneSynth({
        pitchDecay: this.timbre === 'electronic' ? 0.065 : this.timbre === 'chip' ? 0.025 : 0.04,
        octaves: this.timbre === 'electronic' ? 7 : this.timbre === 'chip' ? 3 : 5,
        oscillator: { type: this.timbre === 'chip' ? 'triangle' : 'sine' },
        envelope: { attack: this.timbre === 'chip' ? 0.003 : 0.001, decay: this.timbre === 'chip' ? 0.2 : 0.32, sustain: 0, release: 0.05 },
      }).connect(this.gain)
      this.kick.volume.value = 1
      this.snare = new this.tone.NoiseSynth({
        noise: { type: this.timbre === 'electronic' ? 'pink' : 'white' },
        envelope: { attack: 0.001, decay: this.timbre === 'electronic' ? 0.16 : 0.12, sustain: 0 },
      }).connect(this.gain)
      this.snare.volume.value = this.timbre === 'chip' ? 6 : 2
      // A short pitched body makes the backbeat read as a drum, not another hi-hat.
      this.snareBody = new this.tone.MembraneSynth({
        pitchDecay: this.timbre === 'electronic' ? 0.025 : 0.014,
        octaves: this.timbre === 'electronic' ? 3 : 2,
        oscillator: { type: this.timbre === 'chip' ? 'square' : 'sine' },
        envelope: { attack: 0.001, decay: this.timbre === 'electronic' ? 0.12 : 0.09, sustain: 0, release: 0.03 },
      }).connect(this.gain)
      this.snareBody.volume.value = -5
      this.hat = new this.tone.MetalSynth({
        harmonicity: this.timbre === 'chip' ? 2 : 5.1,
        modulationIndex: this.timbre === 'chip' ? 40 : 24,
        resonance: 4500,
        octaves: 1.5,
        envelope: { attack: 0.001, decay: 0.065, sustain: 0.35, release: 0.025 },
      }).connect(this.gain)
      this.hat.volume.value = -12
    }
    const ratio = 2 ** (pitch / 12)
    const strength = accent ? Math.min(1, level * 1.5) : level
    if (sound === 'kick') this.kick.triggerAttackRelease(pitch ? frequency(31 + pitch) : 'G1', 0.32, time, strength)
    else if (sound === 'snare') {
      this.snare.triggerAttackRelease(0.12, time, strength)
      this.snareBody.triggerAttackRelease(pitch ? frequency((this.timbre === 'electronic' ? 55 : 60) + pitch)
        : this.timbre === 'electronic' ? 'G3' : 'C4', 0.1, time, strength)
    } else if (sound === 'hat') this.hat.triggerAttackRelease(220 * ratio, duration ?? 0.06, time, strength)
  }
  silence() {
    this.kick?.dispose()
    this.snare?.dispose()
    this.snareBody?.dispose()
    this.hat?.dispose()
    this.kick = this.snare = this.snareBody = this.hat = undefined
    this.gain?.disconnect()
    this.gain = undefined
  }
}
