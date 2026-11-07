import { chordConfig } from './music.js'
import { genres } from './groove.js'

const partControls = [
  ['drum', 'rhythm-pattern'], ['bass', 'bass-pattern'],
  ['chord', 'chord-backing'], ['melody', 'melody-mode'],
  ...['bell', 'pluck', 'phrase', 'fx'].map(id => [id, `${id}-pattern`]),
]

export const sectionControlIds = partControls.flatMap(([id, pattern]) => [id + '-timbre', pattern])

export const arrangementControlIds = [
  'genre-group', 'genre', 'tempo', 'tempo-value', 'swing', 'count-in',
  ...partControls.flatMap(([id, pattern]) => [`${id}-timbre`, pattern, `${id}-volume`]),
  'bass-slide', 'bass-length', 'bass-dynamics', 'key',
]
export const arrangementMixIds = partControls.flatMap(([id]) => [`${id}-mute`, `${id}-solo`])

/** @typedef {{id:string, value:string, checked:boolean}} Control */
/** @typedef {{id:string, pressed:boolean}} Mix */
/** @typedef {Pick<import('./progression.js').Progression, 'slots'|'beatSlots'|'modulation'|'bassFeel'|'bassTones'|'drumSteps'> & Partial<Pick<import('./progression.js').Progression, 'drumAccents'|'drumPitch'|'beatsPerBar'>>} Score */
/** @typedef {{id:string, options?:string[], range?:[number,number]}} ControlRule */

/** @typedef {import('./progression.js').Progression['sections'][number]} Section */

/** @param {Control[]} controls @param {Mix[]} mix @param {Score} score @param {Section[]} [sections] */
export function encodeArrangement(controls, mix, score, sections) {
  return JSON.stringify({format: 'oto-arrangement', version: 1, controls, mix, ...score, sections}, null, 2)
}

/** @param {unknown} value */
function validPerformance(value) {
  if (!value || typeof value !== 'object') return false
  const data = /** @type {import('./progression.js').CapturedPerformance} */ (value)
  const finite = (/** @type {number} */ n, /** @type {number} */ low, /** @type {number} */ high) => Number.isFinite(n) && n >= low && n <= high
  return Number.isInteger(data.key) && finite(data.key, 0, 11) &&
    (data.drums === undefined || Array.isArray(data.drums) && data.drums.length <= 512 && data.drums.every(hit => hit &&
      finite(hit.beat, 0, 32) && hit.beat < 32 && ['kick', 'snare', 'hat', 'openhat'].includes(hit.sound) && finite(hit.velocity, 0, 1))) &&
    (data.bass === undefined || Array.isArray(data.bass) && data.bass.length <= 256 && data.bass.every(note => note &&
      finite(note.beat, 0, 32) && note.beat < 32 && Number.isInteger(note.midi) && finite(note.midi, 0, 127) &&
      finite(note.duration, 0.001, 32 - note.beat) && finite(note.velocity, 0, 1)))
}

/** @param {Partial<Section> | null} data */
function validSection(data) {
  const chord = (/** @type {unknown} */ value) =>
    typeof value === 'string' && value.length < 100 && chordConfig(value) !== undefined
  return (data?.barCount === undefined || (Number.isInteger(data.barCount) && data.barCount >= 1 && data.barCount <= (data.slots?.length ?? 0))) &&
      (data?.performance === undefined || validPerformance(data.performance)) &&
      Array.isArray(data?.slots) && [8, 16].includes(data.slots.length) && data.slots.every(chord) &&
      Array.isArray(data.beatSlots) && data.beatSlots.length === data.slots.length &&
      data.beatSlots.every((/** @type {unknown} */ row) => Array.isArray(row) && [4, 5].includes(row.length) && row.every(value => value === null || chord(value))) &&
      Array.isArray(data.modulation) && data.modulation.length === data.slots.length / 2 &&
      data.modulation.every((/** @type {number} */ value) => Number.isInteger(value) && Math.abs(value) <= 120)
}

/** @param {string} text @param {ControlRule[]} rules */
export function decodeArrangement(text, rules) {
  const data = JSON.parse(text)
  if (data?.format !== 'oto-arrangement' || data.version !== 1 || !validSection(data)) {
    throw new Error('Invalid arrangement score')
  }

  if (!Array.isArray(data.controls) || data.controls.length !== rules.length || !Array.isArray(data.mix)) {
    throw new Error('Invalid arrangement controls')
  }
  const controls = new Map(rules.map(({id, options, range}) => {
    const item = data.controls.find((/** @type {Control} */ entry) => entry?.id === id)
    if (!item || typeof item.value !== 'string' || typeof item.checked !== 'boolean') throw new Error('Invalid control')
    if (options && !options.includes(item.value)) throw new Error('Invalid option')
    if (range) {
      const value = Number(item.value)
      if (!Number.isFinite(value) || value < range[0] || value > range[1]) throw new Error('Invalid range')
    }
    return [id, /** @type {Control} */ (item)]
  }))
  const style = controls.get('genre')?.value
  const group = controls.get('genre-group')?.value
  if (!genres.some(item => item.id === style && item.group === group)) throw new Error('Invalid style')

  const mix = arrangementMixIds.map(id => {
    const item = data.mix.find((/** @type {Mix} */ entry) => entry?.id === id)
    if (typeof item?.pressed !== 'boolean') throw new Error('Invalid mix')
    return {id, pressed: item.pressed}
  })
  const {slots, beatSlots, modulation, bassFeel, bassTones, drumSteps, drumAccents, drumPitch, beatsPerBar = 4} = data
  if (![3, 4, 5].includes(beatsPerBar)) throw new Error('Invalid meter')
  if (typeof bassFeel !== 'string' ||
      !Array.isArray(bassTones) || !bassTones.every(tone => ['root','third','fifth','seventh','octave','ninth'].includes(tone)) ||
      !(drumSteps === null || Array.isArray(drumSteps) && drumSteps.every(hit =>
        hit && ['kick','snare','hat','openhat'].includes(hit.sound) &&
        Number.isFinite(hit.pulse) && hit.pulse >= 0 && hit.pulse < 10 &&
        (hit.velocity === undefined || Number.isFinite(hit.velocity))))) throw new Error('Invalid parts')

  if (drumAccents !== undefined && (!Array.isArray(drumAccents) || drumAccents.length > 20 ||
      !drumAccents.every(step => Number.isInteger(step) && step >= 0 && step < 20)))
    throw new Error('Invalid drum accents')
  if (drumPitch !== undefined && (!drumPitch || typeof drumPitch !== 'object' || Array.isArray(drumPitch) ||
      !Object.entries(drumPitch).every(([sound, value]) =>
        ['kick', 'snare', 'hat'].includes(sound) && typeof value === 'number' &&
        Number.isInteger(value) && Math.abs(value) <= 12)))
    throw new Error('Invalid drum pitch')

  /** @type {Section[]} */
  let sections
  if (data.sections === undefined) {
    sections = Array.from({length: 4}, () => ({
      slots: [...slots], beatSlots: beatSlots.map((/** @type {(string|null)[]} */ row) => [...row]),
      modulation: [...modulation], advance: false,
    }))
  } else {
    if (!Array.isArray(data.sections) || data.sections.length !== 4 ||
        !data.sections.every((/** @type {Section} */ section) => validSection(section) && typeof section.advance === 'boolean'))
      throw new Error('Invalid sections')
    for (const section of data.sections) {
      if (section.partSettings !== undefined && (
        !section.partSettings || typeof section.partSettings !== 'object' || Array.isArray(section.partSettings) ||
        !Object.entries(section.partSettings).every(([id, value]) =>
          sectionControlIds.includes(id) && typeof value === 'string' &&
          !!rules.find(rule => rule.id === id)?.options?.includes(value))
      )) throw new Error('Invalid section parts')
    }
    sections = data.sections.map((/** @type {Section} */ section) => ({
      ...(section.barCount === undefined ? {} : {barCount:section.barCount}),
      slots: section.slots, beatSlots: section.beatSlots, modulation: section.modulation, advance: section.advance,
      ...(section.partSettings === undefined ? {} : {partSettings: {...section.partSettings}}),
      ...(section.performance === undefined ? {} : {performance: section.performance}),
    }))
  }

  return {
    style: /** @type {string} */ (style),
    controls: [...controls.values()].filter(item => item.id !== 'genre' && item.id !== 'genre-group'),
    mix,
    sections,
    score: /** @type {Score} */ ({slots, beatSlots, modulation, bassFeel, bassTones, drumSteps, drumAccents, drumPitch, beatsPerBar}),
  }
}

/** @param {ReturnType<typeof decodeArrangement>} arrangement
 * @param {{stop:()=>void, chooseStyle:(id:string)=>Promise<void>, applyControl:(control:Control)=>void,
 * applyMix:(mix:Mix)=>void, applyScore:(score:Score,sections:Section[])=>void}} target */
export async function restoreArrangement(arrangement, target) {
  target.stop()
  await target.chooseStyle(arrangement.style)
  arrangement.controls.forEach(target.applyControl)
  arrangement.mix.forEach(target.applyMix)
  target.applyScore(arrangement.score, arrangement.sections)
}
