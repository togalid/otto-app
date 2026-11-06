import { notes, melodyPalette, melodyRole, displayChordParts } from './music.js'

/** Pads depend on harmony, not on each incoming melody note. Keep one current
 * palette and stable DOM references; feedback alone changes while Otto plays.
 * @param {HTMLButtonElement[]} buttons
 * @param {Pick<Document, 'querySelector'>} [root] */
export function createMelodyView(buttons, root = document) {
  const pads = buttons.map(button => ({
    button,
    label: button.querySelector('.pad-note'),
    degree: button.querySelector('.pad-number'),
    role: button.querySelector('.pad-role'),
  }))
  const current = root.querySelector('#melody-current-chord')
  const feedback = root.querySelector('#melody-feedback')
  let signature = ''
  let palette = melodyPalette(0, 'FM7', 0, 'key')
  /** @param {Element | null} element @param {string} text */
  const setText = (element, text) => {
    if (element && element.textContent !== text) element.textContent = text
  }
  return {
    /** @param {number} key @param {string} chord @param {number} chordKey
     * @param {number | undefined} midi @param {string} degree */
    update(key, chord, chordKey, midi, degree) {
      const next = `${key}:${chord}:${chordKey}`
      if (next !== signature) {
        signature = next
        palette = melodyPalette(key, chord, chordKey, 'key')
        pads.forEach(({button, label, degree, role}, index) => {
          const note = palette[index]
          setText(label, note.label)
          setText(degree, note.degree)
          setText(role, note.hint)
          button.dataset.role = note.category
          button.classList.toggle('pad-clash', note.clash)
          button.setAttribute('aria-label', `${note.label}、${note.degree}、${note.hint}を鳴らす（${notes[index].key.toUpperCase()}キー）`)
        })
        const parts = displayChordParts(chord, chordKey, 'chord')
        setText(current, parts.main + parts.suffix)
      }
      if (midi !== undefined) {
        const role = melodyRole(midi, chord, chordKey)
        setText(feedback, `${palette.find(note => note.midi === midi)?.label ?? 'さっきの音'} · ${degree === role.degree ? role.degree : degree + ' → ' + role.degree} — ${role.hint}`)
        degree = role.degree
      }
      return { notes: palette, degree }
    },
  }
}
