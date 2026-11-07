import { createApp, h, shallowRef } from './vendor/vue.runtime.esm-browser.prod.js'

const rows = [['hat', 'ハット'], ['snare', 'スネア'], ['kick', 'キック']]
const steps = Array.from({ length: 20 }, (_, step) => step)

/** @param {import('./rhythm.js').DrumHit} hit @param {string} sound @param {number} step */
function matchesStep(hit, sound, step) {
  return hit.sound === sound && Math.round(hit.pulse * 2) === step
}

/** @param {(hits: import('./rhythm.js').DrumHit[]) => void} onEdit
 * @param {import('./progression.js').Progression} progression */
export function mountDrumGrid(onEdit, progression) {
  const hits = shallowRef(/** @type {readonly import('./rhythm.js').DrumHit[]} */ ([]))
  const accents = shallowRef(progression.drumAccents)
  const pitch = shallowRef(progression.drumPitch)
  const selected = shallowRef('')
  const meter = shallowRef(progression.beatsPerBar)
  const grid = /** @type {HTMLElement} */ (document.getElementById('drum-sequencer'))
  /** @type {{pointerId:number, sound:string, step:number, add:boolean} | undefined} */
  let stroke

  /** @param {string} sound @param {number} step */
  const isOn = (sound, step) => hits.value.some(hit => matchesStep(hit, sound, step))

  /** @param {string} sound @param {number} first @param {number} last @param {boolean} add */
  function paint(sound, first, last, add) {
    const next = [...hits.value]
    let changed = false
    for (let step = Math.min(first, last); step <= Math.max(first, last); step++) {
      const active = isOn(sound, step)
      if (active === add) continue
      changed = true
      if (add) next.push({ sound, pulse: step / 2, velocity: sound === 'hat' ? 0.3 : 0.9 })
      else {
        for (let index = next.length - 1; index >= 0; index--) {
          if (matchesStep(next[index], sound, step)) next.splice(index, 1)
        }
      }
    }
    if (changed) onEdit(next.sort((a, b) => a.pulse - b.pulse))
  }

  /** @param {EventTarget | null} target */
  function stepAt(target) {
    const button = target instanceof Element ? target.closest('button[data-sound][data-step]') : null
    if (!(button instanceof HTMLElement) || !grid.contains(button)) return
    const {sound, step} = button.dataset
    if (sound && step !== undefined) return {sound, step:Number(step)}
  }

  grid.addEventListener('pointerdown', event => {
    if (stroke || !event.isPrimary || event.button !== 0) return
    const cell = stepAt(event.target)
    if (!cell) return
    const add = !isOn(cell.sound, cell.step)
    stroke = {...cell, pointerId:event.pointerId, add}
    grid.setPointerCapture(event.pointerId)
    paint(cell.sound, cell.step, cell.step, add)
  })
  grid.addEventListener('pointermove', event => {
    if (stroke?.pointerId !== event.pointerId) return
    const cell = stepAt(document.elementFromPoint(event.clientX, event.clientY))
    if (!cell) return
    paint(cell.sound, cell.sound === stroke.sound ? stroke.step : cell.step, cell.step, stroke.add)
    Object.assign(stroke, cell)
  })
  /** @param {PointerEvent} event */
  function endStroke(event) {
    if (stroke?.pointerId === event.pointerId) stroke = undefined
  }
  grid.addEventListener('pointerup', endStroke)
  grid.addEventListener('pointercancel', endStroke)
  grid.addEventListener('lostpointercapture', endStroke)
  grid.style.setProperty('--drum-steps', String(meter.value * 4))
  createApp({
    render: () => [
      h('span', { class: 'drum-row-label' }, '強調'),
      ...steps.map(step => h('button', {
        type: 'button', class: 'drum-step-label', hidden: step >= meter.value * 4,
        'aria-label': `ステップ ${step + 1} のアクセント`,
        'aria-pressed': String(accents.value.includes(step)),
        onClick: () => {
          progression.drumAccents = accents.value = accents.value.includes(step)
            ? accents.value.filter(value => value !== step)
            : [...accents.value, step]
        },
      }, step % 4 === 0 ? String(step / 4 + 1) : '·')),
      ...rows.flatMap(([sound, name]) => [
        h('button', {
          type: 'button', class: 'drum-row-label drum-voice', key: sound,
          'aria-expanded': String(selected.value === sound),
          onClick: () => { selected.value = selected.value === sound ? '' : sound },
        }, name),
        ...steps.map(step => h('button', {
          key: sound + step, hidden: step >= meter.value * 4,
          type: 'button',
          class: step % 4 === 0 ? 'drum-step beat-start' : 'drum-step',
          'data-step': step,
          'data-sound': sound,
          'aria-label': `${name}、${Math.floor(step / 4) + 1}拍目の${step % 4 + 1}ステップ`,
          'aria-pressed': String(isOn(sound, step)),
          onClick: (/** @type {MouseEvent} */ event) => {
            if (event.detail === 0) paint(sound, step, step, !isOn(sound, step))
          },
        })),
      ]),
      selected.value && h('label', { class: 'drum-pitch' }, [
        `${rows.find(([sound]) => sound === selected.value)?.[1]} Pitch`,
        h('input', {
          type: 'range', min: -12, max: 12, step: 1, value: pitch.value[selected.value] ?? 0,
          onInput: (/** @type {Event} */ event) => {
            const value = /** @type {HTMLInputElement} */ (event.target).valueAsNumber
            progression.drumPitch = pitch.value = { ...pitch.value, [selected.value]: value }
          },
        }),
        h('output', `${pitch.value[selected.value] ?? 0} 半音`),
      ]),
    ],
  }).mount(grid)
  // Keep the moving playhead out of the editor's render cycle.
  const columns = steps.map(step => Array.from(document.querySelectorAll(`#drum-sequencer [data-step="${step}"]`)))
  let position = -1
  return {
    hits,
    refreshSettings() {
      meter.value = progression.beatsPerBar
      grid.style.setProperty('--drum-steps', String(meter.value * 4))
      accents.value = progression.drumAccents
      pitch.value = progression.drumPitch
    },
    /** @param {number} step */
    showPosition(step) {
      if (position === step) return
      columns[position]?.forEach(button => button.classList.remove('playing'))
      columns[step]?.forEach(button => button.classList.add('playing'))
      position = step
    },
  }
}
