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
    if (this.synth && this.activeTimbre !== this.timbre) this.silence()
    if (!this.synth) {
      this.activeTimbre = this.timbre
      this.gain = this.context.createGain()
      this.gain.gain.value = this.volume * 0.25
      this.gain.connect(partMeter(this.context, 'bass'))
      this.synth = new this.tone.MonoSynth({
        oscillator: {
          type:
            this.timbre === 'acoustic'
              ? 'triangle'
              : this.timbre === 'electric'
                ? 'square'
                : 'sawtooth',
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
    }
    const frequency = 440 * 2 ** ((midi - 69) / 12)
    this.synth.triggerAttackRelease(
      slideFrom === undefined ? frequency : 440 * 2 ** ((slideFrom - 69) / 12),
      duration,
      time,
      Math.max(0, Math.min(1, velocity)),
    )
    if (slideFrom !== undefined) {
      this.synth.frequency.exponentialRampToValueAtTime(frequency, time + Math.min(0.07, duration * 0.5))
    }
  }
  silence() {
    this.synth?.dispose()
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
