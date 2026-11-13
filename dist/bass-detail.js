import { createApp, h, ref, shallowRef } from './vendor/vue.runtime.esm-browser.prod.js'
import { bassArticulation, bassEvents, bassFeelEvents, bassToneOffset, swungBassBeat } from './groove.js'
import { bassHarmonyNotes } from './music.js'

/** @param {import('./progression.js').Progression} progression */
function phraseNotes(progression) {
  const events = bassFeelEvents(bassEvents(progression.bassPattern, 0, 0), progression.bassFeel)
  const chords = [{ beat: 0, id: progression.slots[0] }]
  progression.beatSlots[0].forEach((id, beat) => { if (id && beat) chords.push({ beat, id }) })
  let lastChord = '', noteIndex = 0
  const shapes = events.map((event, index) => {
    const beat = swungBassBeat(event.pulse, progression.swing)
    const chord = chords.filter(change => change.beat <= beat).at(-1) || chords[0]
    const harmony = bassHarmonyNotes(chord.id, progression.keyForBar(0))
    if (lastChord !== chord.id) { lastChord = chord.id; noteIndex = 0 }
    const offset = progression.bassTones.length
      ? bassToneOffset(noteIndex, progression.bassTones, harmony)
      : event.tone === 'root' ? 0 : bassToneOffset(1, [event.tone], harmony)
    noteIndex++
    const pitch = 36 + ((harmony[0] % 12 + 12) % 12) + event.midi + offset
    const duration = bassArticulation(event.duration, event.velocity, progression.bassLength, progression.bassDynamics)
    const nextBeat = events[index + 1] ? swungBassBeat(events[index + 1].pulse, progression.swing) : 4
    const nextChord = chords.find(change => change.beat > beat)?.beat ?? 4
    return { x: beat * 80, width: Math.max(3, Math.min(duration.duration, nextBeat - beat, nextChord - beat, 4 - beat) * 80 - 2), pitch, velocity: duration.velocity }
  })
  const pitches = shapes.map(shape => shape.pitch)
  const low = Math.min(...pitches, 36), high = Math.max(...pitches, 48)
  return shapes.map(shape => ({
    x: shape.x, y: 44 - (shape.pitch - low) / Math.max(12, high - low) * 36,
    width: shape.width, opacity: Math.max(.4, shape.velocity),
  }))
}

/** @param {import('./progression.js').Progression} progression */
export function mountBassDetail(progression) {
  const notes = shallowRef(phraseNotes(progression))
  const expression = ref({
    bassFeel: progression.bassFeel, bassTones: [...progression.bassTones],
    bassSlide: progression.bassSlide, bassLength: progression.bassLength, bassDynamics: progression.bassDynamics,
  }).value
  const toneChoices = [['octave', 'オクターブ'], ['fifth', '5th'], ['third', '3rd']]
  function refresh() {
    expression.bassFeel = progression.bassFeel
    expression.bassTones = [...progression.bassTones]
    expression.bassSlide = progression.bassSlide
    expression.bassLength = progression.bassLength
    expression.bassDynamics = progression.bassDynamics
    notes.value = phraseNotes(progression)
  }

  /** @param {'bassLength'|'bassDynamics'} property @param {string} id @param {string} label */
  function range(property, id, label) {
    return h('label', {class: 'bass-range', for: id}, [
      h('span', label),
      h('span', {class: 'bass-range-value'}, [
        h('input', {id, type: 'range', min: 0, max: 100, step: 1, value: expression[property],
          onInput: (/** @type {Event} */ event) => {
            progression[property] = Number((/** @type {HTMLInputElement} */ (event.currentTarget)).value)
            refresh()
          }}),
        h('output', {id: `${id}-value`, for: id}, `${expression[property]}%`),
      ]),
    ])
  }
  createApp({
    render: () => [
      h('h2', {class: 'track-detail-title'}, 'ベースの動きをつくってみよう。'),
      h('div', {class: 'bass-preview', 'aria-label': 'ベースの1小節目のフレーズ'}, [
        h('span', '1小節目のフレーズ'),
        h('svg', {id: 'bass-phrase', viewBox: '0 0 320 56', role: 'img', 'aria-label': 'ベースフレーズのプレビュー'}, [
          ...[0, 1, 2, 3, 4].map(i => h('path', {class: 'bass-grid', d: `M${i * 80} 0v56`})),
          ...notes.value.map(note => h('rect', {class: 'bass-note', ...note, height: 8, rx: 3})),
        ]),
      ]),
      h('fieldset', {class: 'bass-tones'}, [
        h('legend', 'フレーズに使う音'),
        ...toneChoices.map(([value, label]) => h('label', {key: value}, [
          h('input', {type: 'checkbox', value, checked: expression.bassTones.includes(value),
            onChange: (/** @type {Event} */ event) => {
              const checked = (/** @type {HTMLInputElement} */ (event.currentTarget)).checked
              progression.bassTones = toneChoices.map(([tone]) => tone)
                .filter(tone => tone === value ? checked : expression.bassTones.includes(tone))
              refresh()
            }}),
          h('span', label),
        ])),
        h('label', [
          h('input', {id: 'bass-slide', type: 'checkbox', checked: expression.bassSlide,
            onChange: (/** @type {Event} */ event) => {
              progression.bassSlide = (/** @type {HTMLInputElement} */ (event.currentTarget)).checked
              expression.bassSlide = progression.bassSlide
            }}),
          h('span', 'スライド'),
        ]),
      ]),
      h('div', {class: 'bass-expression'}, [
        h('fieldset', {class: 'bass-feel'}, [
          h('legend', '拍の位置'),
          h('div', {class: 'bass-feel-segments'}, [['straight', '表'], ['offbeat', '裏']].map(([value, label]) =>
            h('label', {key: value}, [
              h('input', {type: 'radio', name: 'bass-feel', value, checked: expression.bassFeel === value,
                onChange: () => { progression.bassFeel = value; refresh() }}),
              h('span', label),
            ]),
          )),
        ]),
        range('bassLength', 'bass-length', '音の長さ'),
        range('bassDynamics', 'bass-dynamics', '強弱'),
      ]),
    ],
  }).mount('#bass-pattern-detail')
  return refresh
}
