import { createApp, h, shallowRef } from './vendor/vue.runtime.esm-browser.prod.js'

const rows = [['hat', 'ハット'], ['snare', 'スネア'], ['kick', 'キック']]
const steps = Array.from({ length: 16 }, (_, step) => step)

/** @param {import('./rhythm.js').DrumHit} hit @param {string} sound @param {number} step */
function matchesStep(hit, sound, step) {
  return hit.sound === sound && Math.round(hit.pulse * 2) % 16 === step
}

/** @param {(hits: import('./rhythm.js').DrumHit[]) => void} onEdit */
export function mountDrumGrid(onEdit) {
  const hits = shallowRef(/** @type {readonly import('./rhythm.js').DrumHit[]} */ ([]))
  /** @param {string} sound @param {number} step */
  function toggle(sound, step) {
    const current = hits.value
    const next = current.some(hit => matchesStep(hit, sound, step))
      ? current.filter(hit => !matchesStep(hit, sound, step))
      : [...current, { sound, pulse: step / 2, velocity: sound === 'hat' ? 0.3 : 0.9 }].sort((a, b) => a.pulse - b.pulse)
    onEdit(next)
  }
  createApp({
    render: () => [
      h('span'),
      ...steps.map(step => h('span', { class: 'drum-step-label' }, step % 4 === 0 ? String(step / 4 + 1) : '·')),
      ...rows.flatMap(([sound, name]) => [
        h('span', { class: 'drum-row-label', key: sound }, name),
        ...steps.map(step => h('button', {
          key: sound + step,
          type: 'button',
          class: step % 4 === 0 ? 'drum-step beat-start' : 'drum-step',
          'data-step': step,
          'aria-label': `${name}、${Math.floor(step / 4) + 1}拍目の${step % 4 + 1}ステップ`,
          'aria-pressed': String(hits.value.some(hit => matchesStep(hit, sound, step))),
          onClick: () => toggle(sound, step),
        })),
      ]),
    ],
  }).mount('#drum-sequencer')
  // Keep the moving playhead out of the editor's render cycle.
  const columns = steps.map(step => Array.from(document.querySelectorAll(`#drum-sequencer [data-step="${step}"]`)))
  let position = -1
  return {
    hits,
    /** @param {number} step */
    showPosition(step) {
      if (position === step) return
      columns[position]?.forEach(button => button.classList.remove('playing'))
      columns[step]?.forEach(button => button.classList.add('playing'))
      position = step
    },
  }
}
