import { melodyPresets } from './melody-presets.js'
import { chordWeights } from './audio.js'
import { planBassPattern, bassToneOffset, bassArticulation, swungBassBeat } from './groove.js'
import { backingEvents, planBackingBar, backingAttacks } from './backing.js'
import { rhythmPatterns, drumPadSound } from './rhythm.js'
import { ornamentEvents } from './ornaments.js'
import { bassHarmonyNotes, voicePhrase, chordNotes, defaultProgression } from './music.js'

export const ottoAccompanimentStyles = {
  drums: [
    { id: 'eight_straight', label: 'まっすぐ8ビート' },
    { id: 'sixteen_funk', label: '跳ねるファンク' },
    { id: 'four_drive', label: '押し出す四つ打ち' },
  ],
  bass: [
    { id: 'support_hold', label: 'ルートで支える' },
    { id: 'line_octave', label: 'オクターブで跳ねる' },
    { id: 'line_walk', label: 'ウォーキング' },
  ],
}

/** @typedef {{beat:number, sound:'kick'|'snare'|'hat'|'openhat', velocity:number}} CapturedDrum */
/** @typedef {{beat:number, midi:number, duration:number, velocity:number}} CapturedBass */
/** @typedef {{key:number, drums?:CapturedDrum[], bass?:CapturedBass[]}} CapturedPerformance */
export const barMeters = /** @type {const} */ ([3, 4, 5, '6/8', '3/8'])
export const maxChordBeats = 6

/** @typedef {typeof barMeters[number]} BarMeter */
/** @typedef {{bpm?:number, meter?:BarMeter, key?:number}} BarSettings */
/** @typedef {{slots:string[], beatSlots:(string|null)[][], modulation:number[], name?:string, key?:number, style?:string, backingSteps?:{enabled:boolean,duration:number,level:number}[], backingExpression?:{length:number,dynamics:number,touch?:string,voicing?:string}, advance:boolean, startBar?:number, endBar?:number, bpm?:number, meter?:number, barCount?:number, partSettings?:Record<string,string>, performance?:CapturedPerformance}} Section */

/** Shift this pair and all later pairs, retaining later relative modulations.
 * @param {number[]} modulation @param {number} pair @param {number} amount */
export function shiftModulationFrom(modulation, pair, amount) {
  if (!Number.isInteger(pair) || pair < 0 || pair >= modulation.length || ![-1, 1].includes(amount)) return false
  if (modulation.slice(pair).some(value => Math.abs(value + amount) > 120)) return false
  for (let i = pair; i < modulation.length; i++) modulation[i] += amount
  return true
}

/** Map a repeating drum pattern into one arrangement bar.
 * @template {{beat:number}} T
 * @param {T[]} events @param {number} period @param {number} bar @param {number} beats @param {number} rate
 * @returns {T[]} */
export function drumEventsAtRate(events, period, bar, beats, rate) {
  const from = bar * beats, to = from + beats
  return events.flatMap(event => {
    const first = Math.max(0, Math.ceil((from * rate - event.beat) / period))
    const result = /** @type {T[]} */ ([])
    for (let cycle = first; (event.beat + cycle * period) / rate < to; cycle++) {
      const beat = (event.beat + cycle * period) / rate - from
      if (beat >= 0) result.push({...event, beat})
    }
    return result
  }).sort((a,b) => a.beat-b.beat)
}

/** @typedef {{part:'drums', sound:string, duration?:number} | {part:'bass', midi:number} | {part:'chord', chord:string, key:number}} PadHit */

export class Progression {
  /** @type {{time:number, hit:PadHit}[]} */
  pendingPadHits = []
  /** @type {{time:number, play:()=>void}[]} */
  pendingLiveBass = []
  /** @type {{notes:number[], until:number} | undefined} */
  backingPadHarmony

  /** @param {string} chord @param {number} key @param {number} until */
  followBackingPad(chord, key, until) {
    this.backingPadHarmony = {notes:bassHarmonyNotes(chord, key), until}
  }

  /** @param {number} time @param {number} root @param {(offset:number, notes?:number[])=>void} play */
  scheduleBass(time, root, play) {
    if (this.accompanimentModes.chord !== 'manual') {
      play(0)
      return
    }
    this.pendingLiveBass.push({time, play:() => {
      if (this.accompanimentModes.bass === 'manual') return
      const harmony = this.backingPadHarmony
      const notes = this.accompanimentModes.chord === 'manual' && harmony && time < harmony.until
        ? harmony.notes : undefined
      const offset = notes ? ((notes[0] - root + 6) % 12 + 12) % 12 - 6 : 0
      play(offset, notes)
    }})
  }

  /** @type {(hit:PadHit)=>void} */
  onPadHit = () => {}

  /** @param {number} time @param {PadHit} hit */
  queuePadHit(time, hit) {
    if (this.accompanimentModes[hit.part] !== 'manual') this.pendingPadHits.push({time, hit})
  }

  /** @param {import('./audio.js').Instrument} instrument @param {(index: number, chord: string, key: number, beat: number, section: number) => void} onStep @param {(message: string) => void} onError @param {{hitAt(sound: string, time: number, velocity?: number, duration?: number, pitch?: number, accent?: boolean): void, hitPadAt?(index: number, time: number, velocity: number, pitchOffset?: number): void, silence(): void} | undefined} [drums] @param {{playAt(midi: number, time: number, duration: number, velocity?: number, slideFrom?: number): void, silence(): void} | undefined} [bass] */
  constructor(instrument, onStep, onError, drums, bass) {
    this.instrument = instrument
    this.onStep = onStep
    this.onError = onError
    this.drums = drums
    this.bass = bass
  }
  /** @type {Section[]} */
  sections = Array.from({length: 4}, () => ({
    slots: [...defaultProgression],
    beatSlots: /** @type {(string | null)[][]} */ (defaultProgression.map(() => [null, null, null, null])),
    modulation: [0, 0, 0, 0],
    advance: false,
  }))
  /** @type {Record<number, BarSettings>} */
  barSettings = {}
  songMode = false
  loopSong = false
  /** @type {number | null} */
  referenceBpm = null
  songBpm = 100
  songMeter = 4
  selectedSection = 0
  nextSection = 0
  nextAbsoluteBar = 0
  /** @type {Map<number, {section:number, bar:number}>} */
  scheduledSections = new Map()
  get slots() { return this.sections[this.selectedSection].slots }
  set slots(value) { this.sections[this.selectedSection].slots = value; if(this.songMode)for(const section of this.sections)section.slots=value }
  get beatSlots() { return this.sections[this.selectedSection].beatSlots }
  set beatSlots(value) { this.sections[this.selectedSection].beatSlots = value; if(this.songMode)for(const section of this.sections)section.beatSlots=value }
  get modulation() { return this.sections[this.selectedSection].modulation }
  set modulation(value) { this.sections[this.selectedSection].modulation = value; if(this.songMode)for(const section of this.sections)section.modulation=value }

  /** @param {number} section */
  sectionAfter(section) {
    return this.sections[section].advance ? (section + 1) % this.sections.length : section
  }

  /** @param {number} [section] */
  barCount(section = this.selectedSection) {
    const score = this.sections[section]
    return Math.max(1, Math.min(score.slots.length, score.barCount ?? score.slots.length))
  }

  /** @param {number} absoluteBar */
  positionAt(absoluteBar) {
    if(this.songMode){const bar=this.loopSong ? absoluteBar%this.barCount() : Math.min(absoluteBar,this.barCount()-1);return this.scheduledSections.get(absoluteBar) ?? {bar,section:this.songSectionAt(bar)}}
    const known = this.scheduledSections.get(absoluteBar)
    if (known) return known
    let section = this.sectionForNextBar()
    let bar = this.nextStep + Math.max(0, absoluteBar - this.nextAbsoluteBar)
    while (bar >= this.barCount(section)) {
      bar -= this.barCount(section)
      section = this.sectionAfter(section)
    }
    return {section, bar}
  }

  /** @param {number} absoluteBar */
  sectionAt(absoluteBar) { return this.positionAt(absoluteBar).section }

  /** @param {number} bar */
  songSectionAt(bar) { return Math.max(0,this.sections.findIndex(section=>bar >= (section.startBar ?? 0) && bar < (section.endBar ?? this.barCount()))) }

  sectionForNextBar() {
    if(this.songMode)return this.songSectionAt(this.nextStep)
    return this.nextStep === 0 && this.nextAbsoluteBar > 0 ? this.sectionAfter(this.nextSection) : this.nextSection
  }

  clearBeatSlots() {
    this.beatSlots = this.slots.map(() => [null, null, null, null])
  }
  key = 0
  /** @param {number} bar @param {number} [section] */
  keyForBar(bar, section = this.selectedSection) {
    const range = this.songMode ? this.sections[this.songSectionAt(bar)] : this.sections[section]
    return (this.songMode ? this.inheritedBarSetting(bar, 'key') : undefined) ?? (((range.key ?? this.key) + (range.modulation[Math.floor(bar / 2)] ?? 0)) % 12 + 12) % 12
  }
  octave = 0
  voicedSignature = ''
  /** @type {Map<number, number[]>} */
  voicedCells = new Map()
  /** @param {string} chord @param {number} bar @param {number} [beat] @param {number} [section] */
  notesForBar(chord, bar, beat = 0, section = this.selectedSection) {
    const {slots, beatSlots, modulation} = this.sections[section]
    const key = this.keyForBar(bar, section)
    const preview = chord !== (beat ? beatSlots[bar]?.[beat] : slots[bar])
    const signature = JSON.stringify([this.beatsPerBar, this.barSettings, this.songMode ? this.sections.map(section=>[section.startBar,section.endBar,section.meter,section.key,section.backingExpression?.voicing]) : null, this.sections[section].backingExpression?.voicing, this.key, modulation, slots, beatSlots, preview ? [bar, beat, chord] : null])
    if (signature !== this.voicedSignature) {
      const cells = []
      for (let index = 0; index < slots.length; index++) {
        for (let position = 0; position < this.chordBeatsForBar(index); position++) {
          const id = index === bar && position === beat ? chord : position ? beatSlots[index]?.[position] : slots[index]
          if (id) cells.push({ cell: index * maxChordBeats + position, id, key: this.keyForBar(index, section), voicing:this.sections[this.songMode?this.songSectionAt(index):section].backingExpression?.voicing })
        }
      }
      const notes = voicePhrase(cells)
      this.voicedCells = new Map(cells.map((cell, i) => [cell.cell, notes[i]]))
      this.voicedSignature = signature
    }
    return (this.voicedCells.get(bar * maxChordBeats + beat) ?? chordNotes(chord, key)).map(note => note + this.octave * 12)
  }
  /** @param {number} bar */
  meterForBar(bar) { return this.chordBeatsForBar(bar) * this.chordBeatLength(bar) }

  /** @param {number} bar */
  meterSignatureForBar(bar) {
    if (!this.songMode) return this.beatsPerBar
    return this.inheritedBarSetting(bar, 'meter') ??
      this.sections[this.songSectionAt(bar)].meter ?? (this.running ? this.songMeter : this.beatsPerBar)
  }

  /** @template {'bpm'|'meter'|'key'} Field
   * @param {number} bar @param {Field} field @returns {BarSettings[Field]}
   */
  inheritedBarSetting(bar, field) {
    let firstBar = 0
    for (let index = this.songSectionAt(bar); index >= 0; index--) {
      if (this.sections[index][field] === undefined) continue
      firstBar = this.sections[index].startBar ?? 0
      break
    }
    /** @type {BarSettings[Field]} */
    let value = undefined
    // Integer keys are enumerated in ascending bar order.
    for (const index in this.barSettings) {
      const changeBar = Number(index)
      if (changeBar > bar) break
      if (changeBar >= firstBar) value = this.barSettings[changeBar][field] ?? value
    }
    return value
  }

  /** @param {number} bar */
  chordBeatsForBar(bar) {
    const meter = this.meterSignatureForBar(bar)
    return typeof meter === 'string' ? Number(meter[0]) : meter
  }

  /** @param {number} bar */
  chordBeatLength(bar) {
    return typeof this.meterSignatureForBar(bar) === 'string' ? 0.5 : 1
  }

  beatsPerBar = 4
  bpm = 100
  /** @type {import('./rhythm.js').DrumHit[] | null} */
  drumSteps = null
  ottoAccompanimentStyle = { drums: 'eight_straight', bass: 'support_hold' }
  /** @type {Record<'drums'|'bass'|'chord', 'auto'|'manual'|'otto'>} */
  accompanimentModes = { drums: 'auto', bass: 'auto', chord: 'auto' }
  /** @type {0.5|1|2} */
  drumRate = 1
  /** @type {number[]} */
  drumAccents = []
  /** @type {Record<string, number>} */
  drumPitch = {}
  rhythm = 'eight'
  genre = 'pop'
  bassPattern = 'straight8'
  bassFeel = 'straight'
  /** @type {string[]} */
  bassTones = []
  bassLength = 50
  bassDynamics = 50
  bassSlide = false
  swing = 0
  backing = 'whole'
  /** @type {import('./audio.js').Instrument | undefined} */
  melody
  melodyPattern = ''
  presetMelody = false
  /** @type {() => {beat:number,duration:number,midi:number,velocity:number}[] | undefined} */
  studioMelody = () => undefined
  /** @type {Progression['studioMelody']} */
  studioBass = () => undefined
  /** @type {Progression['studioMelody']} */
  studioBacking = () => undefined
  /** @type {Progression['studioMelody']} */
  studioDrums = () => undefined
  /** @type {{id:string,pattern:string,voice:{ready():Promise<void>,silence():void,schedule(event:import('./ornaments.js').OrnamentEvent,time:number,seconds:number):void}}[]} */
  ornaments = []
  running = false
  generation = 0
  nextStep = 0
  startBeat = 0
  playbackStartTime = 0
  nextTime = 0
  scheduledTempo = { bpm: 0, time: 0 }

  /** @param {number} bar */
  bpmForBar(bar) {
    const override = this.songMode ? this.inheritedBarSetting(bar, 'bpm') : undefined
    if (override !== undefined) return override
    if (this.referenceBpm !== null) return this.referenceBpm
    if (!this.songMode) return this.bpm
    return this.sections[this.songSectionAt(bar)].bpm ?? (this.running ? this.songBpm : this.bpm)
  }
  /** @type {ReturnType<typeof setInterval> | undefined} */
  timer
  /** @type {{index: number, chord: string, key: number, beat: number, time: number, section: number}[]} */
  pending = []
  /** @type {{step: number, time: number}[]} */
  pendingDrumPositions = []
  /** @type {(step: number) => void} */
  onDrumPosition = () => {}

  scheduledPartSection = -1
  /** @type {(section:number) => void} */
  onScheduleSection = () => {}
  /** @type {(bar: number, beat: number, time: number, secondsPerBeat: number) => void} */
  onScheduleBar = () => {}
  /** @type {(time: number, offset: number, section: number) => void} */
  onStart = () => {}
  onStop = () => {}

  /** @param {string} style @param {number} startBeat @param {number} duration */
  scheduleStudioMelody(style, startBeat, duration) {
    const editedMelody = this.studioMelody()
    if (this.melody && (editedMelody !== undefined || this.presetMelody)) {
      const notes = editedMelody ?? melodyPresets[style] ?? []
      if (notes.length) {
        // Studio notation and its presets store four grid beats per measure.
        let barBeat = editedMelody === undefined ? 0 : this.nextStep * 4
        if (editedMelody === undefined) {
          for (let bar = 0; bar < this.nextStep; bar++) barBeat += this.meterForBar(bar)
        }
        const end = barBeat + (editedMelody === undefined ? this.beatsPerBar : Math.min(4, this.beatsPerBar))
        const secondsPerBeat = duration / this.beatsPerBar
        for (const note of notes) {
          if (note.beat >= end) break
          if (note.beat < barBeat + startBeat) continue
          this.melody.playAt([note.midi], this.nextTime + (note.beat - barBeat - startBeat) * secondsPerBeat,
            note.duration * secondsPerBeat, note.velocity)
        }
      }
    }
  }

  /**
   * @param {NonNullable<ReturnType<Progression['studioBass']>>} notes
   * @param {number} startBeat
   * @param {number} duration
   */
  scheduleStudioBass(notes, startBeat, duration) {
    // Scale the four-beat notation grid to the active meter.
    const barBeat = this.nextStep * 4
    for (const note of notes) {
      if (note.beat < barBeat || note.beat >= barBeat + 4) continue
      const beat = (note.beat - barBeat) * this.beatsPerBar / 4
      if (beat < startBeat || !this.bass) continue
      const time = this.nextTime + (beat - startBeat) * duration / this.beatsPerBar
      this.queuePadHit(time, {part:'bass', midi:note.midi})
      this.bass.playAt(note.midi, time, note.duration * duration / 4, note.velocity)
    }
  }

  /**
   * @param {NonNullable<ReturnType<Progression['studioMelody']>>} notes
   * @param {number} gridStart @param {number} gridEnd
   * @param {number} secondsPerGridBeat
   */
  scheduleStudioAccompaniment(notes, gridStart, gridEnd, secondsPerGridBeat, percussion = false) {
    const events = new Map()
    for (const note of notes) {
      if (note.beat < gridStart || note.beat >= gridEnd) continue
      const time = this.nextTime + (note.beat - gridStart) * secondsPerGridBeat
      if (percussion) {
        const [, sound, pitch, duration] = drumPadSound(note.midi)
        this.queuePadHit(time, {part:'drums', sound, duration})
        const pitchOffset = this.drumPitch[sound] ?? 0
        if (this.drums?.hitPadAt) this.drums.hitPadAt(note.midi, time, note.velocity, pitchOffset)
        else this.drums?.hitAt(sound, time, note.velocity, duration, pitch + pitchOffset, note.midi === 7)
      } else {
        const key = `${note.beat}:${note.duration}`
        const event = events.get(key)
        if (event) event.notes.push(note.midi)
        else events.set(key, {notes:[note.midi], time, duration:note.duration * secondsPerGridBeat, velocity:note.velocity})
      }
    }
    for (const {notes, time, duration, velocity} of events.values()) {
      this.instrument.playAt(notes, time, duration, velocity)
    }
  }

  /** @param {number} [bar] @param {number} [beat] @param {number} [startTime] AudioContext time, for a synchronized count-in. */
  async start(bar = 0, beat = 0, startTime = 0) {
    if (!Number.isInteger(bar) || bar < 0 || bar >= this.barCount() || !Number.isFinite(beat) || (beat < 0 && !(bar === 0 && beat === -1)) || beat >= this.meterForBar(bar))
      throw new RangeError('再生位置が正しくありません')
    this.stop()
    const generation = this.generation
    this.scheduledPartSection = -1
    if(this.songMode){this.songBpm=this.bpm;this.songMeter=this.beatsPerBar}
    this.nextSection = this.songMode?this.songSectionAt(bar):this.selectedSection
    this.nextAbsoluteBar = bar
    this.scheduledSections.clear()
    this.running = true
    try {
      await this.instrument.ready()
      if (this.melody) await this.melody.ready()
      await Promise.all(this.ornaments.map(track => track.voice.ready()))
      if (generation !== this.generation) return
      this.nextStep = bar
      const pickup = beat === -1
      this.startBeat = pickup ? 0 : beat
      this.nextTime = Math.max((this.instrument.context?.currentTime ?? 0) + (startTime ? 0.02 : 0.05), startTime)
      if (pickup) {
        const secondsPerBeat = 60 / this.bpmForBar(0)
        for (const note of this.studioMelody() ?? []) {
          if (note.beat >= 0 || note.beat < -1) continue
          this.melody?.playAt([note.midi], this.nextTime + (note.beat + 1) * secondsPerBeat, note.duration * secondsPerBeat, note.velocity)
        }
        for (const note of this.studioBass() ?? []) {
          if (note.beat >= 0 || note.beat < -1) continue
          this.bass?.playAt(note.midi, this.nextTime + (note.beat + 1) * secondsPerBeat,
            note.duration * secondsPerBeat, note.velocity)
        }
        if (this.accompanimentModes.chord !== 'manual') {
          this.scheduleStudioAccompaniment(this.studioBacking() ?? [], -1, 0, secondsPerBeat)
        }
        if (this.accompanimentModes.drums !== 'manual') {
          this.scheduleStudioAccompaniment(this.studioDrums() ?? [], -1, 0, secondsPerBeat, true)
        }
        this.nextTime += secondsPerBeat
        beat = 0
      }
      let offset=(bar * this.beatsPerBar + beat)*60/this.bpmForBar(bar)
      if(this.songMode){
        offset=0
        for(let index=0;index<=bar;index++){
          offset+=(index===bar?beat:this.meterForBar(index))*60/this.bpmForBar(index)
        }
      }
      this.scheduledTempo = { bpm: this.bpmForBar(bar), time: this.nextTime }
      this.playbackStartTime = this.nextTime
      this.onStart(this.nextTime, offset, this.nextSection)
      this.tick()
      if (this.running) this.timer = setInterval(() => this.tick(), 25)
    } catch (error) {
      if (generation !== this.generation) return
      this.stop()
      this.onError(
        error instanceof Error ? error.message : '再生できませんでした。',
      )
    }
  }

  /** Authored presets use four quarter-notes; extend the opening beat in 5/4. */
  drumHits(rhythm = this.rhythm) {
    const hits = rhythmPatterns.find(pattern => pattern.id === rhythm)?.hits ?? []
    return [...hits, ...(this.beatsPerBar === 5 ? hits.filter(hit => hit.pulse < 2).map(hit => ({...hit, pulse:hit.pulse + 8})) : [])]
      .filter(hit => hit.pulse < this.beatsPerBar * 2)
  }

  /** @param {number[]} notes @param {string} pattern @param {number} root */
  backingEvents(notes, pattern, root) {
    const events = backingEvents(notes, pattern, root, this.nextStep)
    return [...events, ...(this.beatsPerBar === 5 ? events.filter(event => event.beat < 1).map(event => ({...event, beat:event.beat + 4})) : [])]
      .filter(event => event.beat < this.beatsPerBar).sort((a,b) => a.beat - b.beat)
  }

  tick() {
    const now = this.instrument.context?.currentTime ?? 0
    if (this.instrument.context?.state !== 'running') {
      this.stop()
      return
    }
    if (this.nextTime < now - 0.15) this.nextTime = now + 0.05
    while (this.nextTime < now + 0.12) {
      if(this.songMode && !this.loopSong && this.nextStep>=this.barCount()){if(this.pending.length===0 && now>=this.nextTime)this.stop();break}
      // A live length edit takes effect at the next unscheduled bar.
      if (this.nextStep >= this.barCount(this.nextSection)) this.nextStep = 0
      const section = this.nextSection = this.sectionForNextBar()
      if (section !== this.scheduledPartSection) {
        this.scheduledPartSection = section
        this.onScheduleSection(section)
      }
      this.bpm = this.bpmForBar(this.nextStep)
      if (this.songMode) this.beatsPerBar = this.meterForBar(this.nextStep)
      if (this.scheduledTempo.bpm !== this.bpm) this.scheduledTempo = { bpm: this.bpm, time: this.nextTime }
      const duration = this.beatsPerBar * 60 / this.bpm
      this.scheduledSections.set(this.nextAbsoluteBar, {section, bar:this.nextStep})
      this.scheduledSections.delete(this.nextAbsoluteBar - 64)
      const score = this.sections[section]
      const chord = score.slots[this.nextStep]
      const barKey = this.keyForBar(this.nextStep, section)
      const startBeat = this.startBeat
      this.onScheduleBar(this.nextStep, startBeat, this.nextTime, duration / this.beatsPerBar)
      /** @param {string} id @param {number} beat */
      const changeAt = (id, beat) => ({
        beat: beat * chordBeatLength, chord: id, notes: this.notesForBar(id, this.nextStep, beat, section), bassNotes: bassHarmonyNotes(id, barKey),
      })
      const chordBeatLength = this.chordBeatLength(this.nextStep)
      const chordBeats = this.chordBeatsForBar(this.nextStep)
      const changes = [changeAt(chord, 0)]
      for (let beat = 1; beat < chordBeats; beat++) {
        const next = score.beatSlots[this.nextStep]?.[beat]
        if (next) changes.push(changeAt(next, beat))
      }
      /** @param {number} beat */
      const chordAt = (beat) => {
        let current = changes[0]
        for (const change of changes) {
          if (change.beat > beat) break
          current = change
        }
        return current
      }
      /** @param {number} beat */
      const nextChange = (beat) => changes.find((change) => change.beat > beat)?.beat ?? this.beatsPerBar
      const customBacking=score.backingSteps
      const expression=score.backingExpression
      const { drums: drumMode, bass: bassMode, chord: chordMode } = this.accompanimentModes
      const ottoDrumPattern = drumMode === 'otto' && this.ottoAccompanimentStyle.drums
      const ottoBassPattern = bassMode === 'otto' && this.ottoAccompanimentStyle.bass
      const bassPattern = ottoBassPattern || this.bassPattern
      const drums = drumMode === 'manual' ? undefined : this.drums
      const bass = bassMode === 'manual' ? undefined : this.bass
      const originalInstrument=this.instrument
      const playBacking=(/** @type {readonly number[]} */ notes,/** @type {number} */ time,/** @type {number} */ length,/** @type {number} */ level,/** @type {number[]} */ weights,/** @type {string} */ id)=>{
        if (chordMode === 'manual') return
        if (notes.length) this.queuePadHit(time, {part:'chord', chord:id, key:barKey})
        const touch = chordMode === 'otto' ? 'strum' : expression?.touch
        for(const attack of backingAttacks(notes,touch))originalInstrument.playAt(attack.notes,time+attack.delay,Math.max(.01,length-attack.delay),level*attack.gain,attack.notes.map(note=>weights[notes.indexOf(note)]))
      }
      const gridStart = this.nextStep * 4 + startBeat * 4 / this.beatsPerBar
      const gridEnd = (this.nextStep + 1) * 4
      const recordedBacking = this.studioBacking()
      if (recordedBacking !== undefined) {
        if (chordMode !== 'manual') this.scheduleStudioAccompaniment(recordedBacking, gridStart, gridEnd, duration / 4)
      } else {
        for (const event of planBackingBar({
          changes, startBeat, beatsPerBar:this.beatsPerBar, bpm:this.bpm, duration,
          swing:this.swing, pattern:this.backing, steps:customBacking, expression,
          eventsFor:(notes, pattern, root) => this.backingEvents(notes, pattern, root),
        })) {
          playBacking(event.notes, this.nextTime + event.offset, event.length, event.level,
            chordWeights(event.notes, event.chord, barKey), event.chord)
        }
      }
      this.scheduleStudioMelody(score.style ?? this.genre, startBeat, duration)
      if (this.melody && this.melodyPattern) {
        for (const change of changes) {
          const end = nextChange(change.beat)
          for (const event of this.backingEvents(change.notes, this.melodyPattern, change.bassNotes[0])) {
            const beat = swungBassBeat(event.beat * 2, this.swing)
            if (beat < change.beat || beat < startBeat || beat >= end) continue
            this.melody.playAt(event.notes, this.nextTime + ((beat - startBeat) * duration) / this.beatsPerBar,
              Math.min(event.duration, end - beat) * duration / this.beatsPerBar, event.level ?? 1,
              chordWeights(event.notes, change.chord, barKey))
          }
        }
      }
      for (const track of this.ornaments) {
        for (const event of ornamentEvents(track.id, track.pattern, this.nextStep, beat => chordAt(beat).notes, this.bpm)) {
          const from = swungBassBeat(event.beat * 2, this.swing)
          if (from < startBeat || from >= this.beatsPerBar) continue
          const to = Math.min(this.beatsPerBar, swungBassBeat((event.beat + event.duration) * 2, this.swing))
          track.voice.schedule(event, this.nextTime + (from - startBeat) * duration / this.beatsPerBar, (to - from) * duration / this.beatsPerBar)
        }
      }
      const recordedDrums = this.studioDrums()
      if (recordedDrums !== undefined) {
        if (drums) this.scheduleStudioAccompaniment(recordedDrums, gridStart, gridEnd, duration / 4, true)
      } else if (!ottoDrumPattern && score.performance?.drums) {
        const hits = drumEventsAtRate(score.performance.drums, this.beatsPerBar * 8, this.nextStep, this.beatsPerBar, this.drumRate)
        for (const hit of hits) {
          const beat = hit.beat
          if (beat < startBeat || beat >= this.beatsPerBar) continue
          const time = this.nextTime + (beat - startBeat) * duration / this.beatsPerBar
          const sound = hit.sound === 'openhat' ? 'hat' : hit.sound
          const length = hit.sound === 'openhat' ? .22 : undefined
          const pitch = this.drumPitch[sound]
          const accent = this.drumAccents.includes(Math.floor(beat * 4)) || (drumMode === 'otto' && beat % 2 === 0)
          if (drums) this.queuePadHit(time, {part:'drums', sound, duration:length})
          if (pitch || accent || length) drums?.hitAt(sound, time, hit.velocity, length, pitch, accent)
          else drums?.hitAt(sound, time, hit.velocity)
        }
      } else {
        // Synth envelopes require monotonically increasing scheduled times.
        const hits = !ottoDrumPattern && this.drumSteps
          ? [...this.drumSteps].sort((a, b) => a.pulse - b.pulse)
          : this.drumHits(ottoDrumPattern || this.rhythm)
        const timedHits = this.drumRate === 1 ? hits.map(hit => ({...hit, beat:hit.pulse / 2})) : drumEventsAtRate(hits.map(hit => ({...hit, beat:hit.pulse / 2})), this.beatsPerBar, this.nextStep, this.beatsPerBar, this.drumRate)
        for (const hit of timedHits) {
          const beat = swungBassBeat(hit.beat * 2, this.swing)
          if (beat < startBeat || beat >= this.beatsPerBar) continue
          const time = this.nextTime + ((beat - startBeat) * duration) / this.beatsPerBar
          if (drums) this.queuePadHit(time, {part:'drums', sound:hit.sound, duration:hit.duration})
          drums?.hitAt(
            hit.sound,
            time,
            hit.velocity,
            hit.duration,
            this.drumPitch[hit.sound],
            this.drumAccents.includes(Math.round(hit.pulse * 2) % (this.beatsPerBar * 4)) || (drumMode === 'otto' && beat % 2 === 0),
          )
        }
      }
      const editedBass = this.studioBass()
      if (editedBass !== undefined) {
        this.scheduleStudioBass(editedBass, startBeat, duration)
      } else if (!ottoBassPattern && score.performance?.bass) {
        const barBeat = this.nextStep * this.beatsPerBar
        for (const note of [...score.performance.bass].sort((a, b) => a.beat - b.beat)) {
          const beat = note.beat - barBeat
          if (beat < startBeat || beat >= this.beatsPerBar) continue
          const midi = Math.max(0, Math.min(127, note.midi + this.key - score.performance.key))
          const time = this.nextTime + (beat - startBeat) * duration / this.beatsPerBar
          if (bass) this.scheduleBass(time, chordAt(beat).bassNotes[0], offset => {
            const pitch = Math.max(0, Math.min(127, midi + offset))
            this.queuePadHit(time, {part:'bass', midi:pitch})
            bass.playAt(pitch, time,
              Math.min(note.duration, 32 - note.beat) * duration / this.beatsPerBar,
              bassMode === 'otto' && beat % 1 !== 0 ? note.velocity * .76 : note.velocity)
          })
        }
      } else {
        // Generate pitch relative to the chord sounding at each bass event.
        let changesAtEnd = false
        if (bassPattern.startsWith('support_') || bassPattern.startsWith('line_')) {
          const nextBar = (this.nextStep + 1) % this.barCount(section)
          const nextSection = nextBar === 0 ? this.sectionAfter(section) : section
          changesAtEnd = chordAt(this.beatsPerBar - .01).chord !== this.sections[nextSection].slots[nextBar]
            || barKey !== this.keyForBar(nextBar, nextSection)
        }
        const bassPatternEvents = planBassPattern(bassPattern, this.nextStep, this.beatsPerBar,
          this.bassFeel, changes.slice(1).map(change => change.beat), changesAtEnd)
        /** @type {number | undefined} */
        let previousBass
        let lastChord = ''
        let chordNoteIndex = 0
        for (const [index, event] of bassPatternEvents.entries()) {
          const beat = swungBassBeat(event.pulse, this.swing)
          if (beat < startBeat || beat >= this.beatsPerBar) continue
          const { chord: currentChord, bassNotes: notes } = chordAt(beat)
          if (currentChord !== lastChord) { lastChord = currentChord; chordNoteIndex = 0 }
          const root = 36 + (((notes[0] % 12) + 12) % 12)
          const phraseOffset = this.bassTones.length ? bassToneOffset(chordNoteIndex, this.bassTones, notes) : event.tone === 'root' ? 0 : bassToneOffset(1, [event.tone], notes)
          const pitch = root + event.midi + phraseOffset
          const articulation = bassArticulation(event.duration, event.velocity, this.bassLength, this.bassDynamics)
          const time = this.nextTime + ((beat - startBeat) * duration) / this.beatsPerBar
          const slideFrom = this.bassSlide && previousBass !== pitch ? previousBass : undefined
          const toneIndex = chordNoteIndex
          if (bass) this.scheduleBass(time, root, (offset, liveNotes) => {
            const livePhraseOffset = liveNotes
              ? (this.bassTones.length ? bassToneOffset(toneIndex, this.bassTones, liveNotes) : event.tone === 'root' ? 0 : bassToneOffset(1, [event.tone], liveNotes))
              : phraseOffset
            const livePitch = root + offset + event.midi + livePhraseOffset
            this.queuePadHit(time, {part:'bass', midi:livePitch})
            bass.playAt(
              livePitch,
              time,
              (Math.min(articulation.duration, nextChange(beat) - beat, (bassPatternEvents[index + 1] ? swungBassBeat(bassPatternEvents[index + 1].pulse, this.swing) : this.beatsPerBar) - beat) * duration) / this.beatsPerBar,
              bassMode === 'otto' ? articulation.velocity * (beat % 1 === 0 ? 1 : .76) : articulation.velocity,
              slideFrom === undefined ? undefined : slideFrom + offset,
            )
          })
          previousBass = pitch
          chordNoteIndex++
        }
      }
      for (let beat = Math.ceil(startBeat / chordBeatLength); beat < chordBeats; beat++) {
        const position = beat * chordBeatLength
        this.pending.push({ index: this.nextStep, chord: chordAt(position).chord, key: barKey, beat, section, time: this.nextTime + (position - startBeat) * 60 / this.bpm })
      }
      for (let step = Math.ceil(startBeat * 4); step < this.beatsPerBar * 4; step++) {
        const beat = swungBassBeat(step / 2, this.swing)
        this.pendingDrumPositions.push({ step, time: this.nextTime + ((beat - startBeat) * duration) / this.beatsPerBar })
      }
      this.nextTime += ((this.beatsPerBar - startBeat) * duration) / this.beatsPerBar
      this.pendingPadHits.sort((a,b) => a.time - b.time)
      this.startBeat = 0
      this.nextAbsoluteBar++
      if(this.songMode && !this.loopSong && this.nextStep+1>=this.barCount(section)){this.nextStep++;break}
      this.nextStep = (this.nextStep + 1) % this.barCount(section)
    }
    while (this.pendingLiveBass.length && this.pendingLiveBass[0].time <= now + .03) {
      this.pendingLiveBass.shift()?.play()
    }
    while (this.pending.length && this.pending[0].time <= now) {
      const step = this.pending.shift()
      if (step) this.onStep(step.index, step.chord, step.key, step.beat, step.section)
    }
    while (this.pendingPadHits.length && this.pendingPadHits[0].time <= now) {
      const event = this.pendingPadHits.shift()
      if (event && now - event.time < .15 && this.accompanimentModes[event.hit.part] !== 'manual') this.onPadHit(event.hit)
    }
    while (this.pendingDrumPositions.length && this.pendingDrumPositions[0].time <= now) {
      const position = this.pendingDrumPositions.shift()
      if (position) this.onDrumPosition(position.step)
    }
  }

  stop() {
    if(this.songMode && this.running){this.bpm=this.songBpm;this.beatsPerBar=this.songMeter}
    this.generation++
    this.running = false
    this.onStop()
    clearInterval(this.timer)
    this.timer = undefined
    this.pending = []
    this.pendingPadHits = []
    this.pendingLiveBass = []
    this.backingPadHarmony = undefined
    this.pendingDrumPositions = []
    this.onDrumPosition(-1)
    this.instrument.silence()
    this.melody?.silence()
    this.drums?.silence()
    this.bass?.silence()
    this.ornaments.forEach(track => track.voice.silence())
    this.onStep(-1, this.slots[0], this.keyForBar(0), 0, this.selectedSection)
  }
}
