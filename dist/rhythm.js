import { partMeter } from './tone-engine.js'

/** @typedef {{ pulse: number, sound: string, velocity?: number, duration?: number }} DrumHit */
/** @param {number[]} levels */
function sixteenHats(levels) {
  return levels.map((velocity, index) => ({ pulse: index / 2, sound: 'hat', velocity, duration: index % 2 ? 0.035 : 0.055 }))
}
/** @param {number[]} pulses @param {string} sound @param {number[]} levels */
function drumHits(pulses, sound, levels) {
  return pulses.map((pulse, index) => ({ pulse, sound, velocity: levels[index] }))
}
/** @type {ReadonlyArray<{id: string, label: string, group: string, hits: readonly DrumHit[]}>} */
export const rhythmPatterns = Object.freeze([
  { id: 'off', group: '', label: 'なし', hits: [] },
  { id: 'edm_half', group: '音ゲー・EDM', label: 'ハーフタイム・ドロップ', hits: [
    ...drumHits([0, 1.5, 3.5, 5.5, 7], 'kick', [1, .7, .85, .8, .7]),
    ...drumHits([4, 7.5], 'snare', [1, .3]),
    ...sixteenHats([.5,.15,.3,.2,.5,.2,.35,.2,.6,.15,.3,.2,.5,.2,.35,.4]),
  ] },
  { id: 'edm_speed', group: '音ゲー・EDM', label: '高速四つ打ち・ロール', hits: [
    ...drumHits([0, 2, 4, 6, 7.5], 'kick', [1,.9,1,.9,.6]),
    ...drumHits([2, 6, 7, 7.5], 'snare', [.9,1,.3,.45]),
    ...sixteenHats([.2,.1,.5,.15,.2,.1,.55,.15,.2,.1,.5,.15,.2,.1,.55,.3]),
  ] },
  { id: 'edm_future', group: '音ゲー・EDM', label: 'フューチャー・シンコペーション', hits: [
    ...drumHits([0, 2.5, 3.5, 5, 7], 'kick', [.95,.7,.8,.85,.7]),
    ...drumHits([2, 6, 6.5], 'snare', [.95,1,.25]),
    ...drumHits([0,1,1.5,3,4,5.5,6.5,7.5], 'hat', [.25,.55,.2,.5,.3,.55,.25,.45]),
  ] },
  { id: 'edm_shuffle', group: '音ゲー・EDM', label: 'シンセハウス・シャッフル', hits: [
    ...drumHits([0,2,4,6], 'kick', [.95,.85,.95,.85]),
    ...drumHits([2,5.5,6], 'snare', [.9,.2,.95]),
    ...drumHits([1,2.5,3,5,6.5,7], 'hat', [.6,.15,.55,.6,.15,.55]),
  ] },
  {
    id: 'eight',
    group: '8ビート',
    label: '8ビート',
    hits: [
      ...[{ pulse: 0, velocity: 0.9 }, { pulse: 4, velocity: 0.56 }, { pulse: 5, velocity: 0.9 }]
        .map((hit) => ({ ...hit, sound: 'kick' })),
      ...[{ pulse: 2, velocity: 1 }, { pulse: 6, velocity: 0.96 }]
        .map((hit) => ({ ...hit, sound: 'snare' })),
      ...[0.34, 0.10, 0.29, 0.09, 0.32, 0.11, 0.28, 0.12]
        .map((velocity, pulse) => ({ pulse, sound: 'hat', velocity, duration: pulse % 2 === 0 ? 0.11 : 0.04 })),
    ],
  },
  { id: 'disco_pickup', group: 'シーン・グルーヴ', label: 'ディスコ・食い込み', hits: [
    ...drumHits([0, 2, 3.5, 4, 6], 'kick', [0.96, 0.78, 0.49, 0.94, 0.8]),
    ...drumHits([2, 5.5, 6], 'snare', [0.93, 0.22, 1]),
    ...drumHits([1, 2.5, 3, 5, 7, 7.5], 'hat', [0.55, 0.17, 0.48, 0.58, 0.47, 0.19]),
  ] },
  { id: 'piano_skip', group: 'シーン・グルーヴ', label: '鍵盤ポップ・駆け足', hits: [
    ...drumHits([0, 1.5, 4, 5, 7], 'kick', [0.94, 0.66, 0.9, 0.61, 0.7]),
    ...drumHits([2, 3.5, 6], 'snare', [0.93, 0.23, 1]),
    ...drumHits([0, 1, 2, 3, 4, 4.5, 5, 6, 7], 'hat', [0.45, 0.24, 0.34, 0.21, 0.41, 0.16, 0.29, 0.36, 0.25]),
  ] },
  { id: 'fragment_clock', group: '同人・ゲームソング', label: '途切れた電子時計', hits: [
    ...drumHits([0, 2.5, 5.5], 'kick', [0.91, 0.53, 0.8]),
    ...drumHits([3, 6.5], 'snare', [0.7, 0.89]),
    ...drumHits([0, 0.5, 2, 3.5, 4, 5, 6.5], 'hat', [0.33, 0.1, 0.2, 0.12, 0.28, 0.13, 0.25]),
  ] },
  { id: 'trance_roll', group: '同人・ゲームソング', label: 'トランス・裏ハット', hits: [
    ...drumHits([0, 2, 4, 6], 'kick', [0.95, 0.86, 0.92, 0.87]),
    ...drumHits([2, 6, 7.5], 'snare', [0.87, 0.9, 0.32]),
    ...drumHits([1, 3, 5, 7, 7.5], 'hat', [0.35, 0.37, 0.34, 0.39, 0.15]),
  ] },
  { id: 'battle_gallop', group: '同人・ゲームソング', label: 'バトル・ギャロップ', hits: [
    ...drumHits([0, 1, 1.5, 3, 4, 5, 5.5, 7], 'kick', [0.98, 0.71, 0.64, 0.74, 0.94, 0.72, 0.62, 0.78]),
    ...drumHits([2, 6], 'snare', [0.97, 1]),
    ...drumHits([0, 1, 2, 3, 4, 5, 6, 7], 'hat', [0.37, 0.19, 0.29, 0.17, 0.36, 0.18, 0.31, 0.21]),
  ] },
  { id: 'denpa_call', group: '同人・ゲームソング', label: 'コール・ストップ', hits: [
    ...drumHits([0, 1.5, 3, 4], 'kick', [0.93, 0.68, 0.79, 0.96]),
    ...drumHits([2, 4.5, 6], 'snare', [0.93, 0.4, 0.95]),
    ...drumHits([0, 1, 1.5, 2.5, 3, 4, 5, 6], 'hat', [0.32, 0.18, 0.12, 0.16, 0.29, 0.36, 0.17, 0.28]),
  ] },
  { id: 'eight_straight', group: '8ビート', label: '8ビート・ストレート', hits: [
    ...drumHits([0, 4], 'kick', [0.92, 0.86]), ...drumHits([2, 6], 'snare', [0.95, 0.97]),
    ...[0.3, 0.12, 0.27, 0.1, 0.29, 0.12, 0.26, 0.11].map((velocity, pulse) => ({ pulse, sound: 'hat', velocity, duration: pulse % 2 ? 0.04 : 0.1 })),
  ] },
  { id: 'eight_drive', group: '8ビート', label: '8ビート・ドライブ', hits: [
    ...drumHits([0, 3, 4, 5], 'kick', [0.92, 0.62, 0.72, 0.85]), ...drumHits([2, 6], 'snare', [0.94, 0.98]),
    ...[0.32, 0.14, 0.28, 0.12, 0.3, 0.14, 0.27, 0.16].map((velocity, pulse) => ({ pulse, sound: 'hat', velocity, duration: pulse % 2 ? 0.04 : 0.09 })),
  ] },
  { id: 'sixteen_pop', group: '16ビート', label: '16ビート・ポップ', hits: [
    ...drumHits([0, 3.5, 4, 5.5], 'kick', [0.92, 0.6, 0.83, 0.68]), ...drumHits([2, 6], 'snare', [0.96, 0.97]),
    ...sixteenHats([0.27, 0.09, 0.2, 0.14, 0.25, 0.08, 0.2, 0.13, 0.27, 0.09, 0.2, 0.14, 0.24, 0.08, 0.2, 0.14]),
  ] },
  { id: 'sixteen_funk', group: '16ビート', label: '16ビート・ファンク', hits: [
    ...drumHits([0, 1.5, 4, 5.5], 'kick', [0.94, 0.62, 0.85, 0.73]), ...drumHits([2, 3.5, 6, 7.5], 'snare', [0.96, 0.2, 0.98, 0.18]),
    ...sixteenHats([0.25, 0.11, 0.2, 0.17, 0.24, 0.09, 0.2, 0.17, 0.25, 0.1, 0.2, 0.18, 0.24, 0.09, 0.2, 0.17]),
  ] },
  { id: 'sixteen_light', group: '16ビート', label: '16ビート・軽やか', hits: [
    ...drumHits([0, 3.5, 4.5], 'kick', [0.85, 0.52, 0.72]), ...drumHits([2, 6, 7.5], 'snare', [0.88, 0.92, 0.16]),
    ...sixteenHats([0.22, 0.08, 0.16, 0.13, 0.21, 0.08, 0.16, 0.12, 0.22, 0.08, 0.16, 0.13, 0.2, 0.08, 0.16, 0.12]),
  ] },
  {
    id: 'jazz',
    group: 'ジャズ・スウィング',
    label: 'ジャズ',
    hits: [
      ...[{ pulse: 0, velocity: 0.65 }, { pulse: 4, velocity: 0.55 }].map((hit) => ({ ...hit, sound: 'kick' })),
      ...[{ pulse: 2, velocity: 0.62 }, { pulse: 6, velocity: 0.7 }].map((hit) => ({ ...hit, sound: 'snare' })),
      ...[{ pulse: 0, velocity: 0.27 }, { pulse: 2, velocity: 0.3 }, { pulse: 3, velocity: 0.12 }, { pulse: 4, velocity: 0.26 }, { pulse: 6, velocity: 0.3 }, { pulse: 7, velocity: 0.12 }].map((hit) => ({ ...hit, sound: 'hat', duration: hit.pulse % 2 ? 0.04 : 0.1 })),
    ],
  },
  {
    id: 'four',
    group: 'ダンス・四つ打ち',
    label: '四つ打ち',
    hits: [
      ...[0.95, 0.82, 0.9, 0.82].map((velocity, i) => ({ pulse: i * 2, sound: 'kick', velocity })),
      ...[{ pulse: 2, velocity: 0.92 }, { pulse: 6, velocity: 0.97 }].map((hit) => ({ ...hit, sound: 'snare' })),
      ...[0.26, 0.18, 0.24, 0.2].map((velocity, i) => ({ pulse: i * 2 + 1, sound: 'hat', velocity, duration: i % 2 ? 0.05 : 0.09 })),
    ],
  },
  { id: 'four_drive', group: 'ダンス・四つ打ち', label: '四つ打ち・ドライブ', hits: [
    ...drumHits([0, 2, 4, 6], 'kick', [0.95, 0.84, 0.92, 0.84]), ...drumHits([2, 6], 'snare', [0.92, 0.98]),
    ...drumHits([1, 1.5, 3, 5, 5.5, 7], 'hat', [0.29, 0.1, 0.23, 0.27, 0.1, 0.24]),
  ] },
  { id: 'four_soft', group: 'ダンス・四つ打ち', label: '四つ打ち・ソフト', hits: [
    ...drumHits([0, 2, 4, 6], 'kick', [0.82, 0.72, 0.78, 0.72]), ...drumHits([2, 6], 'snare', [0.72, 0.78]),
    ...drumHits([1, 3, 5, 7], 'hat', [0.22, 0.15, 0.2, 0.16]),
  ] },
  {
    id: 'half',
    group: 'ハーフタイム・ゆったり',
    label: 'ゆったり',
    hits: [
      ...[{ pulse: 0, velocity: 0.86 }, { pulse: 5, velocity: 0.62 }].map((hit) => ({ ...hit, sound: 'kick' })),
      { pulse: 4, sound: 'snare', velocity: 0.88 },
      ...[0.28, 0.17, 0.25, 0.15].map((velocity, i) => ({ pulse: i * 2, sound: 'hat', velocity, duration: i % 2 ? 0.05 : 0.1 })),
    ],
  },
  { id: 'broken_two', group: 'ブレイク・変則', label: '2ステップ', hits: [
    ...drumHits([0, 3.5, 5], 'kick', [0.96, 0.66, 0.9]), ...drumHits([2, 6], 'snare', [0.9, 0.96]),
    ...drumHits([0.5, 1, 2.5, 3, 4.5, 5.5, 7, 7.5], 'hat', [0.12, 0.32, 0.1, 0.22, 0.16, 0.24, 0.32, 0.12]),
  ] },
  { id: 'jungle_break', group: 'ブレイク・変則', label: '高速ブレイク', hits: [
    ...drumHits([0, 3, 5], 'kick', [0.98, 0.62, 0.9]), ...drumHits([2, 3.5, 4.5, 6, 7.5], 'snare', [0.93, 0.24, 0.16, 1, 0.27]),
    ...sixteenHats([0.3, 0.1, 0.2, 0.08, 0.24, 0.07, 0.21, 0.11, 0.31, 0.08, 0.22, 0.14, 0.26, 0.07, 0.2, 0.12]),
  ] },
  { id: 'one_drop', group: 'ブレイク・変則', label: 'ワンドロップ', hits: [
    ...drumHits([4], 'kick', [0.94]), ...drumHits([4], 'snare', [0.82]),
    ...drumHits([0, 1, 2, 3, 4, 5, 6, 7], 'hat', [0.13, 0.34, 0.12, 0.25, 0.14, 0.32, 0.12, 0.26]),
  ] },
  { id: 'half_ballad', group: 'ハーフタイム・ゆったり', label: 'ハーフ・バラード', hits: [
    ...drumHits([0, 4.5], 'kick', [0.8, 0.55]), ...drumHits([4], 'snare', [0.8]),
    ...drumHits([0, 2, 4, 6], 'hat', [0.22, 0.13, 0.2, 0.13]),
  ] },
  { id: 'half_rnb', group: 'ハーフタイム・ゆったり', label: 'ハーフ・R&B', hits: [
    ...drumHits([0, 3.5, 5.5], 'kick', [0.88, 0.55, 0.7]), ...drumHits([4, 7.5], 'snare', [0.9, 0.18]),
    ...sixteenHats([0.23, 0.07, 0.15, 0.12, 0.2, 0.07, 0.15, 0.11, 0.22, 0.07, 0.15, 0.12, 0.2, 0.07, 0.15, 0.12]),
  ] },
])

export class DrumSynth {
  /** @param {import('./audio.js').Instrument} instrument */
  constructor(instrument) {
    this.instrument = instrument
  }
  timbre = 'acoustic'
  samplesEnabled = false
  sampleReady = Promise.resolve()
  /** @type {Map<number, AudioBuffer>} */
  samples = new Map()
  /** @type {Set<AudioBufferSourceNode>} */
  sampleVoices = new Set()
  /** @type {GainNode | undefined} */
  sampleGain

  /** @param {number} index @param {number} time @param {number} velocity */
  playSample(index, time, velocity) {
    const buffer = this.samplesEnabled && this.samples.get(index)
    const context = this.instrument.context
    if (!buffer || !context) return false
    if (!this.sampleGain) {
      this.sampleGain = context.createGain()
      this.sampleGain.gain.value = this.volume * .35
      this.sampleGain.connect(partMeter(context, 'drum'))
    }
    const source = context.createBufferSource()
    const gain = context.createGain()
    source.buffer = buffer
    gain.gain.value = Math.max(0, Math.min(1, velocity))
    source.connect(gain).connect(this.sampleGain)
    this.sampleVoices.add(source)
    source.onended = () => {
      this.sampleVoices.delete(source)
      source.disconnect()
      gain.disconnect()
    }
    source.start(time)
    return true
  }

  /** @param {number} index @param {number} time @param {number} velocity @param {number} [pitchOffset] */
  hitPadAt(index, time, velocity, pitchOffset = 0) {
    if (this.samplesEnabled) { this.playSample(index, time, velocity); return }
    const pad = drumPadSound(index)
    if (!pad) return
    const [, sound, pitch, duration] = pad
    this.hitAt(sound, time, velocity, duration, pitch + pitchOffset, index === 7, false)
  }
  pitchBend = 0
  /** @param {number} value */
  setPitchBend(value) { this.pitchBend = Math.max(-1, Math.min(1, value)) }
  volume = 0.35
  /** @param {number} value */
  setVolume(value) {
    this.volume = Math.max(0, Math.min(1, value))
    this.instrument.engine?.drums.setVolume(this.volume)
    if (this.sampleGain) this.sampleGain.gain.value = this.volume * .35
  }
  /** @param {string} sound @param {number} time @param {number} [velocity] @param {number} [duration] @param {number} [pitch] @param {boolean} [accent] @param {boolean} [useSamples] */
  hitAt(sound, time, velocity, duration, pitch, accent, useSamples = true) {
    const index = sound === 'kick' ? 0 : sound === 'snare' ? 1 : sound === 'hat' ? ((duration ?? 0) >= .2 ? 3 : 2) : -1
    if (useSamples && this.samplesEnabled) { this.playSample(index, time, velocity ?? .6); return }
    const tone = this.instrument.engine?.drums
    if (!tone || !['kick', 'snare', 'hat'].includes(sound)) return
    tone.timbre = this.timbre
    tone.setVolume(this.volume)
    tone.hitAt(sound, time, velocity, duration, (pitch ?? 0) + this.pitchBend * 2, accent)
  }
  silence() {
    for (const source of this.sampleVoices) source.stop()
    this.sampleVoices.clear()
    this.instrument.engine?.drums.silence()
  }
}

const studioDrumPads = [
  ['キック', 'kick', 0, .18], ['スネア', 'snare', 0, .12],
  ['クローズハット', 'hat', 0, .045], ['オープンハット', 'hat', 0, .22],
  ['ローキック', 'kick', -5, .24], ['ハイスネア', 'snare', 5, .08],
  ['ロータム風', 'kick', 7, .13], ['ハイハット強', 'hat', 4, .08],
]

// Display order is independent of the pad IDs saved in Studio scores.
export const studioDrumLayout = [
  {id:7, name:'クラッシュ', sound:'crash', key:'a'},
  {id:6, name:'ハイタム', sound:'high-tom', key:'s'},
  {id:4, name:'フロアタム', sound:'floor-tom', key:'k'},
  {id:5, name:'ライド', sound:'ride', key:'l'},
  {id:0, name:'キック', sound:'kick', key:'z'},
  {id:1, name:'スネア', sound:'snare', key:'x'},
  {id:2, name:'クローズHH', sound:'hat', key:'m'},
  {id:3, name:'オープンHH', sound:'open', key:','},
]

/** @param {number} index */
export function drumPadSound(index) {
  return /** @type {[string,string,number,number]} */ (studioDrumPads[index])
}
