import { Instrument } from './audio.js'
import { partMeter } from './tone-engine.js'
import { ornamentParts } from './ornaments.js'

/** An independent sound owner for one colour part. FX use tracked native nodes, never the drum mixer. */
export class OrnamentPlayer {
  /** @param {string} id @param {Instrument} referenceInstrument */
  constructor(id, referenceInstrument) {
    const part = ornamentParts.find(part => part.id === id)
    if (!part) throw new RangeError('Unknown ornament part')
    this.id = id
    this.instrument.meterPart = /** @type {import('./tone-engine.js').MeterPart} */ (id)
    this.reference = referenceInstrument
    this.timbre = part.timbres[0].id
    if (id !== 'fx') {
      this.instrument.colour = id === 'bell'
        ? {pan:.38,highpass:650,cutoff:7200,attack:.004,release:1.15,delay:.23,wet:.28}
        : id === 'pluck'
          ? {pan:-.34,highpass:380,cutoff:4400,attack:.006,release:.42,delay:.17,wet:.24}
          : {pan:.12,highpass:450,cutoff:5200,attack:.025,release:.28,delay:.20,wet:.12}
      this.instrument.setTimbre(this.timbre)
    }
    this.instrument.setVolume(this.volume)
  }
  instrument = new Instrument()
  volume = .2
  /** @type {AudioContext | undefined} */
  context
  /** @type {AudioBuffer | undefined} */
  noiseBuffer
  /** @type {GainNode | undefined} */
  fxMaster
  /** @type {Set<{sources:AudioScheduledSourceNode[],nodes:AudioNode[],cleanup:()=>void}>} */
  active = new Set()

  async ready() {
    if (this.id === 'fx') {
      await this.reference.ready()
      this.context = this.reference.context
    } else {
      await this.instrument.ready()
      this.context = this.instrument.context
    }
  }
  /** @param {string} id */
  setTimbre(id) {
    const part = ornamentParts.find(part => part.id === this.id)
    if (!part?.timbres.some(timbre => timbre.id === id)) throw new RangeError('Unknown ornament timbre')
    if (this.timbre === id) return
    this.silence()
    this.timbre = id
    if (this.id !== 'fx') this.instrument.setTimbre(id)
  }
  /** @param {number} value */
  setVolume(value) {
    this.volume = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0
    this.instrument.setVolume(this.volume)
    if (this.fxMaster && this.context)
      this.fxMaster.gain.setTargetAtTime(this.volume * .15, this.context.currentTime, .012)
  }
  /** @param {import('./ornaments.js').OrnamentEvent} event @param {number} time @param {number} seconds */
  schedule(event, time, seconds) {
    if (!Number.isFinite(time) || !Number.isFinite(seconds) || seconds <= 0) return
    if (this.id !== 'fx') {
      this.instrument.playAt(event.notes, time, seconds, event.level)
      return
    }
    const context = this.context ?? this.reference.context
    if (!context || !event.sound) return
    this.context = context
    if (!this.fxMaster) {
      this.fxMaster = context.createGain()
      this.fxMaster.gain.value = this.volume * .15
      this.fxMaster.connect(partMeter(context, 'fx'))
    }
    if (!this.noiseBuffer) {
      this.noiseBuffer = context.createBuffer(1, Math.ceil(context.sampleRate * 2), context.sampleRate)
      const samples = this.noiseBuffer.getChannelData(0)
      let seed = 1234567
      for (let index = 0; index < samples.length; index++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
        samples[index] = seed / 2147483648 - 1
      }
    }
    const start = Math.max(context.currentTime, time)
    const length = Math.max(.025, Math.min(12, seconds))
    const end = start + length
    const filter = context.createBiquadFilter()
    filter.type = 'highpass'
    filter.Q.value = .6
    const reverse = event.sound === 'reverse'
    const metallic = this.timbre === 'cymbal'
    filter.frequency.setValueAtTime(reverse ? metallic ? 1400 : 500 : metallic ? 4300 : 1800, start)
    if (reverse) filter.frequency.exponentialRampToValueAtTime(metallic ? 8500 : 5400, end - .01)
    const envelope = context.createGain()
    const peak = Math.max(.0001, Math.min(1, event.level))
    if (reverse) {
      envelope.gain.setValueAtTime(.0001, start)
      envelope.gain.exponentialRampToValueAtTime(peak, end - .012)
      envelope.gain.linearRampToValueAtTime(0, end)
    } else {
      envelope.gain.setValueAtTime(0, start)
      envelope.gain.linearRampToValueAtTime(peak, start + .004)
      envelope.gain.exponentialRampToValueAtTime(.0001, end)
    }
    filter.connect(envelope)
    envelope.connect(this.fxMaster)
    const noise = context.createBufferSource()
    noise.buffer = this.noiseBuffer
    noise.loop = true
    noise.connect(filter)
    /** @type {AudioScheduledSourceNode[]} */
    const sources = [noise]
    /** @type {AudioNode[]} */
    const nodes = [noise, filter, envelope]
    if (metallic) {
      const metalGain = context.createGain()
      metalGain.gain.value = .025
      metalGain.connect(filter)
      nodes.push(metalGain)
      for (const frequency of [541, 817, 1133, 1553]) {
        const oscillator = context.createOscillator()
        oscillator.type = 'square'
        oscillator.frequency.value = frequency
        oscillator.connect(metalGain)
        sources.push(oscillator)
        nodes.push(oscillator)
      }
    }
    const voice = { sources, nodes, cleanup: () => {} }
    voice.cleanup = () => {
      if (!this.active.delete(voice)) return
      noise.onended = null
      nodes.forEach(node => node.disconnect())
    }
    noise.onended = voice.cleanup
    this.active.add(voice)
    for (const source of sources) {
      source.start(start)
      source.stop(end + .002)
    }
  }
  silence() {
    this.instrument.silence()
    for (const voice of Array.from(this.active)) {
      for (const source of voice.sources) {
        source.onended = null
        // A source already ended between the snapshot and stop is safe to ignore.
        try { source.stop() } catch {}
      }
      voice.cleanup()
    }
    this.fxMaster?.disconnect()
    this.fxMaster = undefined
  }
}
