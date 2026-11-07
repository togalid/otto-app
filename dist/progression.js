import { chordWeights } from './audio.js'
import { bassEvents, bassFeelEvents, bassToneOffset, bassArticulation, swungBassBeat } from './groove.js'
import { backingEvents } from './backing.js'
import { rhythmPatterns } from './rhythm.js'
import { ornamentEvents } from './ornaments.js'
import { bassHarmonyNotes, voicePhrase, chordNotes, defaultProgression } from './music.js'

/** @typedef {{beat:number, sound:'kick'|'snare'|'hat'|'openhat', velocity:number}} CapturedDrum */
/** @typedef {{beat:number, midi:number, duration:number, velocity:number}} CapturedBass */
/** @typedef {{key:number, drums?:CapturedDrum[], bass?:CapturedBass[]}} CapturedPerformance */
/** @typedef {{slots:string[], beatSlots:(string|null)[][], modulation:number[], advance:boolean, barCount?:number, partSettings?:Record<string,string>, performance?:CapturedPerformance}} Section */

export class Progression {
  /** @param {import('./audio.js').Instrument} instrument @param {(index: number, chord: string, key: number, beat: number, section: number) => void} onStep @param {(message: string) => void} onError @param {{hitAt(sound: string, time: number, velocity?: number, duration?: number, pitch?: number, accent?: boolean): void, silence(): void} | undefined} [drums] @param {{playAt(midi: number, time: number, duration: number, velocity?: number, slideFrom?: number): void, silence(): void} | undefined} [bass] */
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
  selectedSection = 0
  nextSection = 0
  nextAbsoluteBar = 0
  /** @type {Map<number, {section:number, bar:number}>} */
  scheduledSections = new Map()
  get slots() { return this.sections[this.selectedSection].slots }
  set slots(value) { this.sections[this.selectedSection].slots = value }
  get beatSlots() { return this.sections[this.selectedSection].beatSlots }
  set beatSlots(value) { this.sections[this.selectedSection].beatSlots = value }
  get modulation() { return this.sections[this.selectedSection].modulation }
  set modulation(value) { this.sections[this.selectedSection].modulation = value }

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

  sectionForNextBar() {
    return this.nextStep === 0 && this.nextAbsoluteBar > 0 ? this.sectionAfter(this.nextSection) : this.nextSection
  }

  clearBeatSlots() {
    this.beatSlots = this.slots.map(() => [null, null, null, null])
  }
  key = 0
  /** @param {number} bar @param {number} [section] */
  keyForBar(bar, section = this.selectedSection) {
    return ((this.key + (this.sections[section].modulation[Math.floor(bar / 2)] ?? 0)) % 12 + 12) % 12
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
    const signature = JSON.stringify([this.beatsPerBar, this.key, modulation, slots, beatSlots, preview ? [bar, beat, chord] : null])
    if (signature !== this.voicedSignature) {
      const cells = []
      for (let index = 0; index < slots.length; index++) {
        for (let position = 0; position < this.beatsPerBar; position++) {
          const id = index === bar && position === beat ? chord : position ? beatSlots[index]?.[position] : slots[index]
          if (id) cells.push({ cell: index * this.beatsPerBar + position, id, key: this.keyForBar(index, section) })
        }
      }
      const notes = voicePhrase(cells)
      this.voicedCells = new Map(cells.map((cell, i) => [cell.cell, notes[i]]))
      this.voicedSignature = signature
    }
    return (this.voicedCells.get(bar * this.beatsPerBar + beat) ?? chordNotes(chord, key)).map(note => note + this.octave * 12)
  }
  beatsPerBar = 4
  bpm = 100
  /** @type {import('./rhythm.js').DrumHit[] | null} */
  drumSteps = null
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
  /** @type {{id:string,pattern:string,voice:{ready():Promise<void>,silence():void,schedule(event:import('./ornaments.js').OrnamentEvent,time:number,seconds:number):void}}[]} */
  ornaments = []
  running = false
  generation = 0
  nextStep = 0
  startBeat = 0
  nextTime = 0
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

  /** @param {number} [bar] @param {number} [beat] @param {number} [startTime] AudioContext time, for a synchronized count-in. */
  async start(bar = 0, beat = 0, startTime = 0) {
    if (!Number.isInteger(bar) || bar < 0 || bar >= this.barCount() || !Number.isInteger(beat) || beat < 0 || beat >= this.beatsPerBar)
      throw new RangeError('再生位置が正しくありません')
    this.stop()
    const generation = this.generation
    this.scheduledPartSection = -1
    this.nextSection = this.selectedSection
    this.nextAbsoluteBar = bar
    this.scheduledSections.clear()
    this.running = true
    try {
      await this.instrument.ready()
      if (this.melody) await this.melody.ready()
      await Promise.all(this.ornaments.map(track => track.voice.ready()))
      if (generation !== this.generation) return
      this.nextStep = bar
      this.startBeat = beat
      this.nextTime = Math.max((this.instrument.context?.currentTime ?? 0) + (startTime ? 0.02 : 0.05), startTime)
      this.onStart(this.nextTime, (bar * this.beatsPerBar + beat) * 60 / this.bpm, this.nextSection)
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
  drumHits() {
    const hits = rhythmPatterns.find(pattern => pattern.id === this.rhythm)?.hits ?? []
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
      // A live length edit takes effect at the next unscheduled bar.
      if (this.nextStep >= this.barCount(this.nextSection)) this.nextStep = 0
      const duration = this.beatsPerBar * 60 / this.bpm
      const section = this.nextSection = this.sectionForNextBar()
      if (section !== this.scheduledPartSection) {
        this.scheduledPartSection = section
        this.onScheduleSection(section)
      }
      this.scheduledSections.set(this.nextAbsoluteBar, {section, bar:this.nextStep})
      this.scheduledSections.delete(this.nextAbsoluteBar - 64)
      const score = this.sections[section]
      const chord = score.slots[this.nextStep]
      const barKey = this.keyForBar(this.nextStep, section)
      const startBeat = this.startBeat
      this.onScheduleBar(this.nextStep, startBeat, this.nextTime, duration / this.beatsPerBar)
      /** @param {string} id @param {number} beat */
      const changeAt = (id, beat) => ({
        beat, chord: id, notes: this.notesForBar(id, this.nextStep, beat, section), bassNotes: bassHarmonyNotes(id, barKey),
      })
      const changes = [changeAt(chord, 0)]
      for (let beat = 1; beat < this.beatsPerBar; beat++) {
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
      if (this.backing === 'whole') {
        for (const change of changes) {
          const end = nextChange(change.beat)
          if (end <= startBeat) continue
          const from = Math.max(change.beat, startBeat)
          this.instrument.playAt(
            change.notes,
            this.nextTime + ((from - startBeat) * duration) / this.beatsPerBar,
            ((end - from) * duration * 0.92) / this.beatsPerBar,
            1,
            chordWeights(change.notes, change.chord, barKey),
          )
        }
      } else {
        // Keep the backing pattern's original bar position as chords change.
        for (const change of changes) {
          const end = nextChange(change.beat)
          for (const event of this.backingEvents(change.notes, this.backing, change.bassNotes[0])) {
            const beat = swungBassBeat(event.beat * 2, this.swing)
            if (beat < change.beat || beat < startBeat || beat >= end) continue
            this.instrument.playAt(
              event.notes,
              this.nextTime + ((beat - startBeat) * duration) / this.beatsPerBar,
              (Math.min(event.duration, end - beat) / this.beatsPerBar) * duration,
              event.level ?? 1,
              chordWeights(event.notes, change.chord, barKey),
            )
          }
        }
      }
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
      if (score.performance?.drums) {
        const barBeat = this.nextStep * this.beatsPerBar
        for (const hit of [...score.performance.drums].sort((a, b) => a.beat - b.beat)) {
          const beat = hit.beat - barBeat
          if (beat < startBeat || beat >= this.beatsPerBar) continue
          const time = this.nextTime + (beat - startBeat) * duration / this.beatsPerBar
          const pitch = this.drumPitch[hit.sound]
          const accent = this.drumAccents.includes(Math.floor(beat * 4))
          if (pitch || accent) this.drums?.hitAt(hit.sound, time, hit.velocity, undefined, pitch, accent)
          else this.drums?.hitAt(hit.sound, time, hit.velocity)
        }
      } else {
        // Synth envelopes require monotonically increasing scheduled times.
        const hits = this.drumSteps
          ? [...this.drumSteps].sort((a, b) => a.pulse - b.pulse)
          : this.drumHits()
        for (const hit of hits) {
          const beat = swungBassBeat(hit.pulse, this.swing)
          if (beat < startBeat || beat >= this.beatsPerBar) continue
          this.drums?.hitAt(
            hit.sound,
            this.nextTime + ((beat - startBeat) * duration) / this.beatsPerBar,
            hit.velocity,
            hit.duration,
            this.drumPitch[hit.sound],
            this.drumAccents.includes(Math.round(hit.pulse * 2) % (this.beatsPerBar * 4)),
          )
        }
      }
      if (score.performance?.bass) {
        const barBeat = this.nextStep * this.beatsPerBar
        for (const note of [...score.performance.bass].sort((a, b) => a.beat - b.beat)) {
          const beat = note.beat - barBeat
          if (beat < startBeat || beat >= this.beatsPerBar) continue
          this.bass?.playAt(Math.max(0, Math.min(127, note.midi + this.key - score.performance.key)),
            this.nextTime + (beat - startBeat) * duration / this.beatsPerBar,
            Math.min(note.duration, 32 - note.beat) * duration / this.beatsPerBar, note.velocity)
        }
      } else {
        // Generate pitch relative to the chord sounding at each bass event.
        const authoredBass = bassFeelEvents(bassEvents(this.bassPattern, 0, this.nextStep), this.bassFeel)
        const bassPatternEvents = [...authoredBass, ...(this.beatsPerBar === 5 ? authoredBass.filter(event => event.pulse < 2).map(event => ({...event, pulse:event.pulse + 8})) : [])].filter(event => event.pulse < this.beatsPerBar * 2).sort((a,b) => a.pulse - b.pulse)
        if (this.bassPattern.startsWith('support_') || this.bassPattern.startsWith('line_')) {
          for (const change of changes.slice(1)) {
            const pulse = change.beat * 2
            if (!bassPatternEvents.some(event => event.pulse === pulse))
              bassPatternEvents.push({ pulse, duration: 1.5, velocity: 0.82, tone: 'root', midi: 0 })
          }
          const nextBar = (this.nextStep + 1) % this.barCount(section)
          const nextSection = nextBar === 0 ? this.sectionAfter(section) : section
          const transitions = changes.slice(1).map(change => change.beat * 2)
          if (chordAt(this.beatsPerBar - 0.01).chord !== this.sections[nextSection].slots[nextBar] || barKey !== this.keyForBar(nextBar, nextSection)) transitions.push(this.beatsPerBar * 2)
          for (const boundary of this.bassPattern.startsWith('support_') ? transitions : []) {
            const fillPulse = boundary - 1
            if (fillPulse > 0 && !bassPatternEvents.some(event => Math.abs(event.pulse - fillPulse) < 1))
              bassPatternEvents.push({ pulse: fillPulse, duration: 0.32, velocity: 0.55, tone: 'fifth', midi: 0 })
            const lastPulse = boundary - 0.5
            if (this.bassPattern === 'support_pulse' && lastPulse > 0 && !bassPatternEvents.some(event => Math.abs(event.pulse - lastPulse) < 0.5))
              bassPatternEvents.push({ pulse: lastPulse, duration: 0.17, velocity: 0.48, tone: 'third', midi: 0 })
          }
          bassPatternEvents.sort((a, b) => a.pulse - b.pulse)
        }
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
          this.bass?.playAt(
            pitch,
            this.nextTime + ((beat - startBeat) * duration) / this.beatsPerBar,
            (Math.min(articulation.duration, nextChange(beat) - beat, (bassPatternEvents[index + 1] ? swungBassBeat(bassPatternEvents[index + 1].pulse, this.swing) : this.beatsPerBar) - beat) * duration) / this.beatsPerBar,
            articulation.velocity,
            this.bassSlide && previousBass !== undefined && previousBass !== pitch ? previousBass : undefined,
          )
          previousBass = pitch
          chordNoteIndex++
        }
      }
      for (let beat = startBeat; beat < this.beatsPerBar; beat++) {
        this.pending.push({ index: this.nextStep, chord: chordAt(beat).chord, key: barKey, beat, section, time: this.nextTime + ((beat - startBeat) * duration) / this.beatsPerBar })
      }
      for (let step = startBeat * 4; step < this.beatsPerBar * 4; step++) {
        const beat = swungBassBeat(step / 2, this.swing)
        this.pendingDrumPositions.push({ step, time: this.nextTime + ((beat - startBeat) * duration) / this.beatsPerBar })
      }
      this.nextTime += ((this.beatsPerBar - startBeat) * duration) / this.beatsPerBar
      this.startBeat = 0
      this.nextAbsoluteBar++
      this.nextStep = (this.nextStep + 1) % this.barCount(section)
    }
    while (this.pending.length && this.pending[0].time <= now) {
      const step = this.pending.shift()
      if (step) this.onStep(step.index, step.chord, step.key, step.beat, step.section)
    }
    while (this.pendingDrumPositions.length && this.pendingDrumPositions[0].time <= now) {
      const position = this.pendingDrumPositions.shift()
      if (position) this.onDrumPosition(position.step)
    }
  }

  stop() {
    this.generation++
    this.running = false
    this.onStop()
    clearInterval(this.timer)
    this.timer = undefined
    this.pending = []
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
