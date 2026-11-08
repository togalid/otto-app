import { chordConfig, rootPitch } from './music.js'
import { getTimbre, timbreProfile, voiceExpression, timbreOutputGain } from './timbres.js'
import { loadToneEngine, partMeter } from './tone-engine.js'

/** @type {AudioContext | undefined} */
let sharedContext

export function audioContext() {
  if (!globalThis.AudioContext)
    throw new Error('このブラウザは音声再生に対応していません。')
  return sharedContext ??= new AudioContext({ latencyHint: 'interactive' })
}


const upperRoots = new Map([['v_over_7', 7], ['iv_over_v', 5], ['iii_aug_sharp4', 4]])

/** Relative velocity by harmonic role, independent of register and inversion.
 * @param {readonly number[]} notes @param {string} chord @param {number} key */
export function chordWeights(notes, chord, key) {
  const { quality, extension } = chordConfig(chord)
  const root = key + (upperRoots.get(extension) ?? rootPitch(chord))
  return notes.map(note => {
    const interval = (note - root + 120) % 12
    if (interval === 7) return 0.84
    if (interval === 0) return 0.94
    if ((interval === 1 && extension.includes('b9')) ||
        (interval === 3 && extension.includes('s9')) ||
        (interval === 8 && extension.includes('b13')) ||
        (interval === 9 && extension.includes('13')) ||
        (interval === 2 && quality !== 'sus2') ||
        (interval === 5 && quality !== 'sus4')) return 1.10
    return 1
  })
}

/** Expressive voice used independently by chord polyphony and the monophonic melody.
 * @param {any} Tone @param {string} id */
export function createTimbreVoice(Tone, id) {
  const profile = timbreProfile(id)
  const Base = profile.fm ? Tone.FMSynth : Tone.MonoSynth
  return class ExpressiveVoice extends Base {
    constructor(options = {}) { super(options) }
    /** @param {any} note @param {any} time @param {number} [velocity] */
    triggerAttack(note, time, velocity = 1) {
      const frequency = this.toFrequency(note)
      const midi = 69 + 12 * Math.log2(frequency / 440)
      const expression = voiceExpression(id, midi, velocity)
      this.envelope.set(expression.envelope)
      if (profile.fm) {
        this.modulationIndex.value = expression.modulationIndex
        this.modulationEnvelope.decay = expression.transientDecay
      } else {
        this.filterEnvelope.baseFrequency = expression.baseFrequency
        this.filterEnvelope.octaves = expression.octaves
        this.filterEnvelope.decay = expression.transientDecay
      }
      return super.triggerAttack(note, time, velocity)
    }
  }
}

/** One voice, with stale note-offs ignored even for scheduled overlapping phrases. */
export class MonoLine {
  /** @param {(midi:number,time:number,level:number,legato:boolean)=>void} attack @param {(time:number)=>void} release */
  constructor(attack, release) { this.attack = attack; this.release = release }
  /** @type {{id:number,midi:number,time:number,level:number,on:boolean}[]} */
  events = []
  sequence = 0
  current = 0
  /** @param {number} midi @param {number} time @param {number} level @param {number} [duration] */
  noteOn(midi,time,level,duration) {
    const id = ++this.sequence
    this.events.push({id,midi,time,level,on:true})
    if (duration !== undefined) this.noteOff(id,time+duration)
    return id
  }
  /** @param {number} id @param {number} time */
  noteOff(id,time) { this.events.push({id,midi:0,time,level:0,on:false}) }
  /** @param {number} horizon */
  tick(horizon) {
    this.events.sort((a,b)=>a.time-b.time || Number(b.on)-Number(a.on) || a.id-b.id)
    while (this.events.length && this.events[0].time <= horizon) {
      const event = this.events.shift()
      if (!event) break
      if (event.on) {
        this.attack(event.midi,event.time,event.level,this.current !== 0)
        this.current = event.id
      } else if (this.current === event.id) { this.release(event.time); this.current = 0 }
    }
  }
}

export class Instrument {
  glideSeconds = .025
  expressiveVibrato = true
  singing = false
  /** @param {import('./tone-engine.js').MeterPart} [meterPart] */
  constructor(meterPart) {
    this.meterPart = meterPart
  }

  /** @type {AudioContext | undefined} */
  context
  /** @type {Awaited<ReturnType<typeof loadToneEngine>> | undefined} */
  engine
  /** @type {Promise<void> | undefined} */
  initializing
  /** @type {any} */
  synth
  /** @type {any} */
  filter
  /** @type {GainNode | undefined} */
  master
  /** @type {{pan:number,highpass:number,cutoff:number,attack:number,release:number,delay:number,wet:number} | undefined} */
  colour
  /** @type {AudioNode[]} */
  colourNodes = []
  volume = 0.4
  timbre = 'soft'
  activeTimbre = ''
  /** @type {MonoLine | undefined} */
  mono
  /** @type {ReturnType<typeof setInterval> | undefined} */
  monoTimer
  /** @type {any} */
  vibrato
  liveId = 0
  liveMidi = -1

  /** @param {string} id */
  setTimbre(id) {
    getTimbre(id)
    this.timbre = id
  }
  /** @param {number} volume */
  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume))
    if (this.context && this.master)
      this.master.gain.setTargetAtTime(
        this.volume * 0.25 * timbreOutputGain(this.activeTimbre || this.timbre),
        this.context.currentTime,
        0.02,
      )
  }
  async ready() {
    this.context = audioContext()
    if (this.context.state !== 'running') await this.context.resume()
    if (this.context.state !== 'running')
      throw new Error('音声を開始できませんでした。もう一度お試しください。')
    if (!this.initializing)
      this.initializing = loadToneEngine(this.context)
        .then((engine) => {
          this.engine = engine
        })
        .catch((error) => {
          this.initializing = undefined
          throw error
        })
    await this.initializing
  }
  /** @param {number} midi */
  async play(midi) {
    await this.ready()
    if (this.context) this.playAt([midi], this.context.currentTime + 0.01, 1.15)
  }
  /** @param {readonly number[]} midis @param {number} time @param {number} duration @param {number} [level] @param {readonly number[]} [weights] */
  playAt(midis, time, duration, level = 1, weights = []) {
    if (!this.engine || !this.context || !midis.length) return
    this.ensureVoice()
    if (this.mono) {
      this.mono.noteOn(midis[midis.length-1], Math.max(this.context.currentTime,time), Math.min(1,level),duration)
      this.flushMono()
      return
    }
    const velocity = level / Math.sqrt(midis.length)
    const ordered = [...midis].sort((a, b) => a - b)
    midis.forEach((midi, index) => {
      const frequency = 440 * 2 ** ((midi - 69) / 12)
      // A compact hand gesture, bounded even for dense tension voicings.
      const rank = ordered.indexOf(midi)
      const spread = midis.length > 1 ? Math.min(0.028, duration * 0.014) : 0
      const offset = midis.length > 1 ? spread * rank / (midis.length - 1) : 0
      this.synth.triggerAttackRelease(frequency, Math.max(0.001, duration - offset), Math.max(this.context?.currentTime ?? 0, time + offset - spread / 2), Math.min(1, velocity * (weights[index] ?? 1)))
    })
  }
  ensureVoice() {
    if (!this.engine || !this.context) return
    const { Tone } = this.engine
    if (!this.synth || this.activeTimbre !== this.timbre) {
      this.silence()
      const baseRecipe = getTimbre(this.timbre)
      const recipe = this.colour ? {...baseRecipe, attack: Math.max(baseRecipe.attack,this.colour.attack), release: Math.max(baseRecipe.release,this.colour.release), cutoff: Math.min(baseRecipe.cutoff,this.colour.cutoff)} : baseRecipe
      this.master = this.context.createGain()
      this.master.gain.value = this.volume * 0.25 * timbreOutputGain(this.timbre)
      this.master.connect(this.meterPart ? partMeter(this.context, this.meterPart) : this.context.destination)
      let destination = /** @type {AudioNode} */ (this.master)
      if (this.colour) {
        const colour = this.colour
        const highpass = this.context.createBiquadFilter()
        highpass.type = 'highpass'; highpass.frequency.value = colour.highpass; highpass.Q.value = .5
        const pan = this.context.createStereoPanner(); pan.pan.value = colour.pan
        highpass.connect(pan); pan.connect(this.master)
        this.colourNodes = [highpass,pan]
        // Two quiet opposite-side reflections, with no feedback or unbounded tail.
        for (const [multiple,level] of [[1,colour.wet],[1.73,colour.wet*.48]]) {
          const delay = this.context.createDelay(2); delay.delayTime.value = colour.delay*multiple
          const gain = this.context.createGain(); gain.gain.value = level
          const echoPan = this.context.createStereoPanner(); echoPan.pan.value = -colour.pan
          highpass.connect(delay); delay.connect(gain); gain.connect(echoPan); echoPan.connect(this.master)
          this.colourNodes.push(delay,gain,echoPan)
        }
        destination = highpass
      }
      this.filter = new Tone.Filter({
        frequency: recipe.cutoff,
        type: 'lowpass',
        rolloff: -12,
      }).connect(destination)
      const profile = timbreProfile(this.timbre)
      const options = {
          // Three detuned band-limited saws provide motion without multiplying voice owners.
          oscillator: this.timbre === 'supersaw' || this.timbre === 'lead-supersaw'
            ? {type:'fatsawtooth',count:3,spread:15}
            : profile.fm ? { type: 'sine' } : { type: 'custom', partials: recipe.harmonics },
          ...(profile.fm ? {
            harmonicity: profile.ratio, modulationIndex: profile.index,
            modulation: { type: 'sine' },
            modulationEnvelope: { attack: 0.001, decay: profile.transient, sustain: 0.01, release: recipe.release },
          } : {
            filter: { type: 'lowpass', Q: 0.5, rolloff: -12 },
            filterEnvelope: { attack: recipe.attack, decay: profile.transient, sustain: 0.12, release: recipe.release, baseFrequency: recipe.cutoff * 0.34, octaves: profile.sweep },
          }),
          envelope: {
            attack: recipe.attack,
            decay: recipe.decay,
            sustain: recipe.sustain,
            release: recipe.release,
          },
      }
      const Voice = createTimbreVoice(Tone, this.timbre)
      if (this.timbre.startsWith('lead-')) {
        this.synth = new Voice({...options, portamento:0.025}).connect(this.filter)
        this.vibrato = new Tone.LFO({frequency:5.2,min:this.singing?-65:-14,max:this.singing?65:14,amplitude:0}).connect(this.synth.detune).start()
        this.mono = new MonoLine((midi,time,level,legato) => {
          const frequency = 440 * 2 ** ((midi-69)/12)
          this.synth.portamento = legato ? this.glideSeconds : 0
          if (legato) this.synth.setNote(frequency,time)
          else this.synth.triggerAttack(frequency,time,level)
          const depth = this.vibrato.amplitude
          depth.cancelScheduledValues(time)
          depth.setValueAtTime(0,time)
          depth.setValueAtTime(0,time+(this.singing?.22:.32))
          depth.linearRampToValueAtTime(this.expressiveVibrato?(this.singing?1:this.timbre === 'lead-chip' ? .35 : 1):0,time+(this.singing?.55:.78))
          if(this.singing&&this.expressiveVibrato){
            this.filter.frequency.cancelScheduledValues(time)
            this.filter.frequency.setValueAtTime(2200,time)
            this.filter.frequency.linearRampToValueAtTime(7000,time+.6)
          }
        }, time => {
          this.synth.triggerRelease(time)
          this.vibrato.amplitude.cancelScheduledValues(time)
          this.vibrato.amplitude.setValueAtTime(0,time)
        })
      } else {
        this.synth = new Tone.PolySynth({voice:Voice,maxPolyphony:96,options}).connect(this.filter)
      }
      this.activeTimbre = this.timbre
    }
  }
  /** @param {number} bend normalized -1..1, two semitones */
  setPitchBend(bend) {
    this.ensureVoice()
    if(this.synth?.detune)this.synth.detune.rampTo(Math.max(-1,Math.min(1,bend))*200,.02)
  }
  /** @param {number} amount normalized 0..1 @param {boolean} [override] */
  setModulation(amount, override = false) {
    this.ensureVoice()
    if(this.filter)this.filter.frequency.rampTo(1800+Math.max(0,Math.min(1,amount))*10000,.04)
    if(this.vibrato){
      if(override && this.context)this.vibrato.amplitude.cancelScheduledValues(this.context.currentTime)
      this.vibrato.min=-65;this.vibrato.max=65
      this.vibrato.frequency.rampTo(5.2+amount*3,.04)
      this.vibrato.amplitude.rampTo(Math.min(1,amount*1.5),.04)
    }
  }
  flushMono() {
    if (this.context) this.mono?.tick(this.context.currentTime + .08)
    if (this.mono?.events.length) {
      if (!this.monoTimer) this.monoTimer = setInterval(()=>this.flushMono(),5)
    } else { clearInterval(this.monoTimer); this.monoTimer = undefined }
  }
  /** @param {number} midi @param {boolean} [glide] */
  attack(midi, glide = false) {
    this.ensureVoice()
    if (this.context && this.mono) {
      this.liveMidi = midi
      this.liveId = this.mono.noteOn(midi,this.context.currentTime+.01,.8)
      this.synth.portamento = glide ? .085 : .025
      this.flushMono()
      this.synth.portamento = .025
      return
    }
    if (this.context && this.synth) this.synth.triggerAttack(440 * 2 ** ((midi - 69) / 12), this.context.currentTime + 0.01, 0.8)
  }
  /** @param {number} midi */
  release(midi) {
    if (this.mono && this.context) {
      if (midi === this.liveMidi && this.liveId) {
        this.mono.noteOff(this.liveId,this.context.currentTime+.01)
        this.liveId = 0; this.liveMidi = -1; this.flushMono()
      }
      return
    }
    if (this.context && this.synth) this.synth.triggerRelease(440 * 2 ** ((midi - 69) / 12), this.context.currentTime + 0.01)
  }
  silence() {
    clearInterval(this.monoTimer); this.monoTimer = undefined
    this.mono = undefined; this.liveId = 0; this.liveMidi = -1
    this.vibrato?.dispose(); this.vibrato = undefined
    this.synth?.dispose()
    this.filter?.dispose()
    this.colourNodes.forEach(node => node.disconnect()); this.colourNodes = []
    this.master?.disconnect()
    this.synth = undefined
    this.filter = undefined
    this.master = undefined
    this.activeTimbre = ''
  }
}
