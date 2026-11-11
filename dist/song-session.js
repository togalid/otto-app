import { createApp, h, ref } from './vendor/vue.runtime.esm-browser.prod.js'
import { Instrument } from './audio.js'
import { pianoKey, pianoNotes } from './keyboard.js'
import { DrumSynth } from './rhythm.js'

// Bass MIDI transcription: [start tick, duration in ticks, MIDI pitch].
const bassNotes = [
  [74880, 236, 49],
  [75120, 236, 49],
  [75360, 236, 49],
  [75600, 236, 49],
  [75840, 236, 49],
  [76080, 236, 49],
  [76320, 236, 49],
  [76560, 236, 49],
  [76800, 236, 51],
  [77040, 236, 51],
  [77280, 236, 51],
  [77520, 236, 51],
  [77760, 236, 51],
  [78000, 236, 51],
  [78240, 236, 51],
  [78480, 236, 49],
  [78720, 236, 48],
  [78960, 236, 48],
  [79200, 236, 48],
  [79440, 236, 48],
  [79680, 236, 48],
  [79920, 236, 48],
  [80160, 236, 48],
  [80400, 236, 48],
  [80640, 236, 53],
  [81120, 236, 52],
  [81600, 236, 51],
  [82080, 236, 50],
]
const ticksPerBeat = 480
const bpm = 123
const firstTick = 74880
const beatsPerBar = 4
const barTicks = ticksPerBeat * beatsPerBar
const loopTicks = barTicks * 4
const hitWindow = 0.12


/** @param {HTMLElement} host @param {() => Promise<string>} connectMidi */
export function mountSongSession(host, connectMidi) {
  const audio = document.createElement('audio')
  audio.src = new URL('./otto-session-demo.mp3', import.meta.url).href
  audio.loop = true
  audio.preload = 'none'
  const playing = ref(false)
  const counting = ref(0)
  const octave = ref(0)
  let countTimer = 0
  const countNodes = new Set()
  const error = ref('')
  const midiStatus = ref('MIDI接続')
  const part = ref('bass')
  const position = ref(0)
  const hits = ref(new Set())
  const midiHeld = ref(new Set())
  let frame = 0

  function updateScore() {
    const tick = Math.min(loopTicks - 0.001, audio.currentTime * bpm / 60 * ticksPerBeat)
    if (tick < position.value) hits.value = new Set()
    position.value = tick
    frame = requestAnimationFrame(updateScore)
  }

  function resetScore() {
    cancelAnimationFrame(frame)
    position.value = 0
    hits.value = new Set()
  }
  const voice = new Instrument()
  const drums = new DrumSynth(voice)
  const parts = [
    { id: 'melody', label: 'メロディ', icon: '♫' },
    { id: 'drums', label: 'ドラム', icon: '▦' },
    { id: 'bass', label: 'ベース', icon: '♬' },
  ]
  const keys = pianoNotes.slice(0, 13).map(pianoKey)
  let whiteCount = 0
  const positions = keys.map(key => key.black ? whiteCount : whiteCount++)
  let generation = 0

  function stop() {
    generation++
    clearTimeout(countTimer)
    counting.value = 0
    for (const node of countNodes) { try { node.stop() } catch {} }
    countNodes.clear()
    audio.pause()
    resetScore()
    if (audio.readyState > 0) audio.currentTime = 0
    voice.silence()
    midiHeld.value.clear()
  }

  async function togglePlayback() {
    if (!audio.paused || counting.value) { stop(); return }
    const request = ++generation
    error.value = ''
    counting.value = 1
    try {
      await voice.ready()
      if (request !== generation || !voice.context) return
      const context = voice.context
      const start = context.currentTime + 0.08
      const beatLength = 60 / bpm
      for (let beat = 0; beat < 4; beat++) {
        const oscillator = context.createOscillator()
        const gain = context.createGain()
        oscillator.frequency.value = beat === 0 ? 1200 : 900
        gain.gain.setValueAtTime(0.12, start + beat * beatLength)
        gain.gain.exponentialRampToValueAtTime(0.001, start + beat * beatLength + 0.05)
        oscillator.connect(gain)
        gain.connect(context.destination)
        countNodes.add(oscillator)
        oscillator.onended = () => { countNodes.delete(oscillator); oscillator.disconnect(); gain.disconnect() }
        oscillator.start(start + beat * beatLength)
        oscillator.stop(start + beat * beatLength + 0.05)
      }
      const updateCount = () => {
        if (request !== generation) return
        const elapsed = context.currentTime - start
        if (elapsed >= 4 * beatLength) {
          counting.value = 0
          void audio.play().catch(() => {
            if (request === generation) error.value = '曲を再生できませんでした。もう一度お試しください。'
          })
          return
        }
        counting.value = Math.max(1, Math.min(4, Math.floor(elapsed / beatLength) + 1))
        countTimer = window.setTimeout(updateCount, 20)
      }
      updateCount()
    } catch {
      if (request === generation) {
        counting.value = 0
        error.value = 'カウントインを再生できませんでした。'
      }
    }
  }

  audio.addEventListener('playing', () => {
    playing.value = true
    cancelAnimationFrame(frame)
    updateScore()
  })
  audio.addEventListener('pause', () => {
    playing.value = false
    cancelAnimationFrame(frame)
  })
  audio.addEventListener('error', () => {
    playing.value = false
    error.value = '曲を読み込めませんでした。'
  })

  /** @param {number|string} note */
  async function playNote(note) {
    const request = generation
    const selected = part.value
    if (selected === 'bass' && playing.value && typeof note === 'number') {
      const tick = audio.currentTime * bpm / 60 * ticksPerBeat
      if (tick < position.value) hits.value = new Set()
      let closest = -1
      let distance = hitWindow * bpm / 60 * ticksPerBeat
      bassNotes.forEach(([start, , pitch], index) => {
        const delta = Math.abs(start - firstTick - tick)
        if (((note % 12) + 12) % 12 === pitch % 12 && !hits.value.has(index) && delta <= distance) {
          closest = index
          distance = delta
        }
      })
      if (closest >= 0) hits.value.add(closest)
      position.value = Math.min(tick, loopTicks - 0.001)
    }
    try {
      await voice.ready()
      if (request !== generation || selected !== part.value || !voice.context) return
      const time = voice.context.currentTime + 0.01
      if (typeof note === 'string') {
        drums.hitAt(note, time)
      } else {
        voice.setTimbre(selected === 'bass' ? 'lead-bass-round' : 'lead-round')
        voice.playAt([selected === 'bass' ? note + 12 : note], time, 0.35)
      }
    } catch {
      if (request === generation) error.value = '楽器の音を準備できませんでした。'
    }
  }

  createApp({ render: () => {
    const bar = Math.floor(position.value / barTicks)
    const barStart = firstTick + bar * barTicks
    const bass = part.value === 'bass'
    return [
    h('button', { type: 'button', onClick: async () => {
      try { midiStatus.value = await connectMidi() }
      catch { midiStatus.value = 'MIDI接続に失敗しました' }
    } }, midiStatus.value),
    h('div', { class: 'song-session-transport' }, [
      h('strong', '♪ 0_Otto体験用_bass抜き.mp3'),
      h('button', { type: 'button', class: 'tutorial-start', onClick: togglePlayback },
        playing.value || counting.value ? '■ 停止' : '▶ 再生'),
    ]),
    counting.value ? h('p', { role: 'status', class: 'song-session-count' }, `カウントイン ${counting.value} / 4`) : null,
    h('div', { class: 'song-session-parts', role: 'group', 'aria-label': '演奏パート' }, parts.map(item =>
      h('button', {
        type: 'button', 'aria-pressed': part.value === item.id,
        onClick: () => { voice.silence(); midiHeld.value.clear(); part.value = item.id },
      }, [h('span', { 'aria-hidden': 'true' }, item.icon), item.label]),
    )),
    h('section', { class: 'tutorial-navigation', 'aria-label': '譜面' }, [
      h('p', { class: 'song-session-score-status' }, bass ? `${bar + 1} / 4 小節 · ${bpm} BPM` : 'このパートの譜面は準備中'),
      h('div', { class: 'tutorial-note-lane', 'aria-hidden': 'true' }, [...Array.from({ length: 16 }, (_, i) =>
        h('span', {
          class: i % 4 === 0 ? 'tutorial-beat-grid' : 'tutorial-subdivision',
          style: { left: `${i * 6.25}%` },
        }, i % 4 === 0 ? String(i / 4 + 1) : ''),
      ), ...(bass ? bassNotes.flatMap(([start, duration, midi], index) => {
        const from = Math.max(start, barStart)
        const to = Math.min(start + duration, barStart + barTicks)
        if (from >= to) return []
        return [h('span', {
          key: index,
          class: ['tutorial-note', 'song-session-note', { 'song-session-hit': hits.value.has(index) }],
          style: { left: `${(from - barStart) * 100 / barTicks}%`, width: `${(to - from) * 100 / barTicks}%` },
        }, pianoKey(midi + 12).label)]
      }) : []), playing.value && bass ? h('span', {
        class: 'tutorial-playhead',
        style: { left: `${position.value % barTicks * 100 / barTicks}%` },
      }) : null]),
    ]),
    part.value === 'drums'
      ? h('div', { class: 'song-session-parts', role: 'group', 'aria-label': 'ドラムパッド' },
        [['kick', 'キック'], ['snare', 'スネア'], ['hat', 'ハイハット']].map(([id, label]) =>
          h('button', { type: 'button', onClick: () => void playNote(id) }, label)))
      : h('div', {
        class: 'tutorial-keyboard song-session-keys', role: 'group', 'aria-label': `C${3 + octave.value}からC${4 + octave.value}の鍵盤`,
        style: { gridTemplateColumns: `repeat(${whiteCount}, minmax(0, 1fr))` },
      }, keys.map((key, i) => h('button', {
        type: 'button', class: [key.black ? 'tutorial-black' : 'tutorial-white', { active: midiHeld.value.has(key.midi + octave.value * 12) }],
        'aria-label': `${key.label.replace(/\d+$/, String(Math.floor((key.midi + octave.value * 12) / 12) - 1))}を鳴らす`,
        style: key.black ? { left: `${positions[i] * 100 / whiteCount}%` } : undefined,
        onClick: () => void playNote(key.midi + octave.value * 12),
      }, !key.black && key.midi % 12 === 0 ? `C${Math.floor((key.midi + octave.value * 12) / 12) - 1}` : ''))),
    part.value !== 'drums' ? h('div', { class: 'keyboard-octave song-session-octave', role: 'group', 'aria-label': '鍵盤のオクターブ' }, [
      h('span', 'Oct'),
      h('div', { class: 'style-stepper' }, [
      h('button', { type:'button', 'aria-label':'オクターブを下げる', disabled:octave.value <= -2, onClick:()=>{octave.value--} }, '−'),
      h('output', `${octave.value > 0 ? '+' : ''}${octave.value}`),
      h('button', { type:'button', 'aria-label':'オクターブを上げる', disabled:octave.value >= 2, onClick:()=>{octave.value++} }, '＋'),
      ]),
    ]) : null,
    error.value ? h('p', { role: 'alert' }, error.value) : null,
    ]
  } }).mount(host)

  return {
    stop,
    togglePlayback,
    /** @param {number} midi */
    midiRelease(midi) { midiHeld.value.delete(midi) },
    /** @param {number} midi */
    midiAttack(midi) {
      if (part.value === 'drums') {
        const sounds = /** @type {Record<number, string>} */ ({ 35: 'kick', 36: 'kick', 38: 'snare', 40: 'snare', 42: 'hat', 44: 'hat', 46: 'hat' })
        const sound = sounds[midi]
        if (sound) void playNote(sound)
      } else {
        midiHeld.value.add(midi)
        void playNote(midi)
      }
    },
  }
}
