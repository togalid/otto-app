import { chordWeights } from './audio.js'
import { bassEvents, bassFeelEvents, bassToneOffset, bassArticulation, swungBassBeat } from './groove.js'
import { backingEvents } from './backing.js'
import { rhythmPatterns } from './rhythm.js'
import { ornamentEvents } from './ornaments.js'
import { bassHarmonyNotes, voicePhrase, chordNotes, defaultProgression, barDuration } from './music.js'

export class Progression {
  /** @param {import('./audio.js').Instrument} instrument @param {(index: number, chord: string, key: number, beat: number) => void} onStep @param {(message: string) => void} onError @param {{hitAt(sound: string, time: number, velocity?: number, duration?: number): void, silence(): void} | undefined} [drums] @param {{playAt(midi: number, time: number, duration: number, velocity?: number, slideFrom?: number): void, silence(): void} | undefined} [bass] */
  constructor(instrument, onStep, onError, drums, bass) {
    this.instrument = instrument
    this.onStep = onStep
    this.onError = onError
    this.drums = drums
    this.bass = bass
  }
  slots = [...defaultProgression]
  /** @type {(string | null)[][]} */
  beatSlots = Array.from({ length: defaultProgression.length }, () => [null, null, null, null])

  clearBeatSlots() {
    this.beatSlots = this.slots.map(() => [null, null, null, null])
  }
  key = 0
  /** Independent semitone offsets for each two-bar section. */
  modulation = [0, 0, 0, 0]
  /** @param {number} bar */
  keyForBar(bar) {
    return ((this.key + (this.modulation[Math.floor(bar / 2)] ?? 0)) % 12 + 12) % 12
  }
  octave = 0
  voicedSignature = ''
  /** @type {Map<number, number[]>} */
  voicedCells = new Map()
  /** @param {string} chord @param {number} bar @param {number} [beat] */
  notesForBar(chord, bar, beat = 0) {
    const key = this.keyForBar(bar)
    const preview = chord !== (beat ? this.beatSlots[bar]?.[beat] : this.slots[bar])
    const signature = JSON.stringify([this.key, this.modulation, this.slots, this.beatSlots, preview ? [bar, beat, chord] : null])
    if (signature !== this.voicedSignature) {
      const cells = []
      for (let index = 0; index < this.slots.length; index++) {
        for (let position = 0; position < 4; position++) {
          const id = index === bar && position === beat ? chord : position ? this.beatSlots[index]?.[position] : this.slots[index]
          if (id) cells.push({ cell: index * 4 + position, id, key: this.keyForBar(index) })
        }
      }
      const notes = voicePhrase(cells)
      this.voicedCells = new Map(cells.map((cell, i) => [cell.cell, notes[i]]))
      this.voicedSignature = signature
    }
    return (this.voicedCells.get(bar * 4 + beat) ?? chordNotes(chord, key)).map(note => note + this.octave * 12)
  }
  bpm = 100
  /** @type {import('./rhythm.js').DrumHit[] | null} */
  drumSteps = null
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
  /** @type {{index: number, chord: string, key: number, beat: number, time: number}[]} */
  pending = []
  /** @type {{step: number, time: number}[]} */
  pendingDrumPositions = []
  /** @type {(step: number) => void} */
  onDrumPosition = () => {}

  /** @param {number} [bar] @param {number} [beat] @param {number} [startTime] AudioContext time, for a synchronized count-in. */
  async start(bar = 0, beat = 0, startTime = 0) {
    if (!Number.isInteger(bar) || bar < 0 || bar >= this.slots.length || !Number.isInteger(beat) || beat < 0 || beat > 3)
      throw new RangeError('再生位置が正しくありません')
    this.stop()
    const generation = this.generation
    this.running = true
    try {
      await this.instrument.ready()
      if (this.melody) await this.melody.ready()
      await Promise.all(this.ornaments.map(track => track.voice.ready()))
      if (generation !== this.generation) return
      this.nextStep = bar
      this.startBeat = beat
      this.nextTime = Math.max((this.instrument.context?.currentTime ?? 0) + (startTime ? 0.02 : 0.05), startTime)
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

  tick() {
    const now = this.instrument.context?.currentTime ?? 0
    if (this.instrument.context?.state !== 'running') {
      this.stop()
      return
    }
    if (this.nextTime < now - 0.15) this.nextTime = now + 0.05
    while (this.nextTime < now + 0.12) {
      const duration = barDuration(this.bpm)
      const chord = this.slots[this.nextStep]
      const barKey = this.keyForBar(this.nextStep)
      const startBeat = this.startBeat
      /** @param {string} id @param {number} beat */
      const changeAt = (id, beat) => ({
        beat, chord: id, notes: this.notesForBar(id, this.nextStep, beat), bassNotes: bassHarmonyNotes(id, barKey),
      })
      const changes = [changeAt(chord, 0)]
      for (let beat = 1; beat < 4; beat++) {
        const next = this.beatSlots[this.nextStep]?.[beat]
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
      const nextChange = (beat) => changes.find((change) => change.beat > beat)?.beat ?? 4
      if (this.backing === 'whole') {
        for (const change of changes) {
          const end = nextChange(change.beat)
          if (end <= startBeat) continue
          const from = Math.max(change.beat, startBeat)
          this.instrument.playAt(
            change.notes,
            this.nextTime + ((from - startBeat) * duration) / 4,
            ((end - from) * duration * 0.92) / 4,
            1,
            chordWeights(change.notes, change.chord, barKey),
          )
        }
      } else {
        // Keep the backing pattern's original bar position as chords change.
        for (const change of changes) {
          const end = nextChange(change.beat)
          for (const event of backingEvents(change.notes, this.backing, change.bassNotes[0], this.nextStep)) {
            const beat = swungBassBeat(event.beat * 2, this.swing)
            if (beat < change.beat || beat < startBeat || beat >= end) continue
            this.instrument.playAt(
              event.notes,
              this.nextTime + ((beat - startBeat) * duration) / 4,
              (Math.min(event.duration, end - beat) / 4) * duration,
              event.level ?? 1,
              chordWeights(event.notes, change.chord, barKey),
            )
          }
        }
      }
      if (this.melody && this.melodyPattern) {
        for (const change of changes) {
          const end = nextChange(change.beat)
          for (const event of backingEvents(change.notes, this.melodyPattern, change.bassNotes[0], this.nextStep)) {
            const beat = swungBassBeat(event.beat * 2, this.swing)
            if (beat < change.beat || beat < startBeat || beat >= end) continue
            this.melody.playAt(event.notes, this.nextTime + ((beat - startBeat) * duration) / 4,
              Math.min(event.duration, end - beat) * duration / 4, event.level ?? 1,
              chordWeights(event.notes, change.chord, barKey))
          }
        }
      }
      for (const track of this.ornaments) {
        for (const event of ornamentEvents(track.id, track.pattern, this.nextStep, beat => chordAt(beat).notes, this.bpm)) {
          const from = swungBassBeat(event.beat * 2, this.swing)
          if (from < startBeat) continue
          const to = swungBassBeat((event.beat + event.duration) * 2, this.swing)
          track.voice.schedule(event, this.nextTime + (from - startBeat) * duration / 4, (to - from) * duration / 4)
        }
      }
      const pattern = rhythmPatterns.find(
        (pattern) => pattern.id === this.rhythm,
      )
      // Synth envelopes require monotonically increasing scheduled times.
      const hits = this.drumSteps
        ? [...this.drumSteps].sort((a, b) => a.pulse - b.pulse)
        : pattern?.hits ?? []
      for (const hit of hits) {
        const beat = swungBassBeat(hit.pulse, this.swing)
        if (beat < startBeat) continue
        this.drums?.hitAt(
          hit.sound,
          this.nextTime + ((beat - startBeat) * duration) / 4,
          hit.velocity,
          hit.duration,
        )
      }
      // Generate pitch relative to the chord sounding at each bass event.
      const bassPatternEvents = bassFeelEvents(bassEvents(this.bassPattern, 0, this.nextStep), this.bassFeel)
      if (this.bassPattern.startsWith('support_') || this.bassPattern.startsWith('line_')) {
        for (const change of changes.slice(1)) {
          const pulse = change.beat * 2
          if (!bassPatternEvents.some(event => event.pulse === pulse))
            bassPatternEvents.push({ pulse, duration: 1.5, velocity: 0.82, tone: 'root', midi: 0 })
        }
        const nextBar = (this.nextStep + 1) % this.slots.length
        const transitions = changes.slice(1).map(change => change.beat * 2)
        if (chordAt(3.99).chord !== this.slots[nextBar] || this.keyForBar(this.nextStep) !== this.keyForBar(nextBar)) transitions.push(8)
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
        if (beat < startBeat) continue
        const { chord: currentChord, bassNotes: notes } = chordAt(beat)
        if (currentChord !== lastChord) { lastChord = currentChord; chordNoteIndex = 0 }
        const root = 36 + (((notes[0] % 12) + 12) % 12)
        const phraseOffset = this.bassTones.length ? bassToneOffset(chordNoteIndex, this.bassTones, notes) : event.tone === 'root' ? 0 : bassToneOffset(1, [event.tone], notes)
        const pitch = root + event.midi + phraseOffset
        const articulation = bassArticulation(event.duration, event.velocity, this.bassLength, this.bassDynamics)
        this.bass?.playAt(
          pitch,
          this.nextTime + ((beat - startBeat) * duration) / 4,
          (Math.min(articulation.duration, nextChange(beat) - beat, (bassPatternEvents[index + 1] ? swungBassBeat(bassPatternEvents[index + 1].pulse, this.swing) : 4) - beat) * duration) / 4,
          articulation.velocity,
          this.bassSlide && previousBass !== undefined && previousBass !== pitch ? previousBass : undefined,
        )
        previousBass = pitch
        chordNoteIndex++
      }
      for (let beat = startBeat; beat < 4; beat++) {
        this.pending.push({ index: this.nextStep, chord: chordAt(beat).chord, key: barKey, beat, time: this.nextTime + ((beat - startBeat) * duration) / 4 })
      }
      for (let step = startBeat * 4; step < 16; step++) {
        const beat = swungBassBeat(step / 2, this.swing)
        this.pendingDrumPositions.push({ step, time: this.nextTime + ((beat - startBeat) * duration) / 4 })
      }
      this.nextTime += ((4 - startBeat) * duration) / 4
      this.startBeat = 0
      this.nextStep = (this.nextStep + 1) % this.slots.length
    }
    while (this.pending.length && this.pending[0].time <= now) {
      const step = this.pending.shift()
      if (step) this.onStep(step.index, step.chord, step.key, step.beat)
    }
    while (this.pendingDrumPositions.length && this.pendingDrumPositions[0].time <= now) {
      const position = this.pendingDrumPositions.shift()
      if (position) this.onDrumPosition(position.step)
    }
  }

  stop() {
    this.generation++
    this.running = false
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
    this.onStep(-1, this.slots[0], this.keyForBar(0), 0)
  }
}
