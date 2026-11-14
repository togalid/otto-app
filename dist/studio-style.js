import { chordChoices } from './chord-harmony.js'

export const studioPitchRange = {
  melody: {min: 53, max: 84},
  bass: {min: 28, max: 60},
  backing: {min: 24, max: 96},
  drums: {min: 0, max: 7},
}

/** @typedef {{beat:number, duration:number, midi:number, role?:'R'}} StudioNote */

/** @returns {(StudioNote[]|null)[]} */
export function defaultDrumPatterns() {
  return [Array.from({length:4}, (_, beat) => ({beat, duration:.25, midi:0})), null, null, null]
}

/**
 * @param {unknown} notes
 * @param {{min:number, max:number}} range
 * @returns {notes is StudioNote[]}
 */
function validNotes(notes, {min, max}) {
  return Array.isArray(notes) && notes.every(note =>
    note && Number.isFinite(note.beat) && note.beat >= -4 &&
    Number.isFinite(note.duration) && note.duration > 0 &&
    Number.isInteger(note.midi) && note.midi >= min && note.midi <= max)
}

/** @param {unknown} value */
export function decodeStudioAccompaniment(value) {
  if (value === undefined) return {backing:[], drums:[]}
  const {backing, drums, drumPatterns, drumAssignments, pickupChord} = /** @type {{backing?:unknown, drums?:unknown, drumPatterns?:unknown, drumAssignments?:unknown, pickupChord?:unknown}} */ (value ?? {})
  if (!validNotes(backing, studioPitchRange.backing) || !validNotes(drums, studioPitchRange.drums)) {
    throw new Error('Invalid Studio accompaniment')
  }
  if (drumPatterns !== undefined && (!Array.isArray(drumPatterns) || drumPatterns.length !== 4 ||
      !drumPatterns.every(pattern => pattern === null || validNotes(pattern, studioPitchRange.drums) &&
        pattern.every(note => note.beat >= 0 && note.beat < 4 && note.beat + note.duration <= 4)))) {
    throw new Error('Invalid drum patterns')
  }
  if (drumAssignments !== undefined && (!Array.isArray(drumAssignments) || drumAssignments.length > 1000 || !drumAssignments.every(value => Number.isInteger(value) && value >= 0 && value < 4))) throw new Error('Invalid drum assignments')
  if (pickupChord !== undefined && pickupChord !== null && !chordChoices.some(({id}) => id === pickupChord)) throw new Error('Invalid pickup chord')
  return {backing, drums, ...(pickupChord === undefined ? {} : {pickupChord:/** @type {string|null} */ (pickupChord)}), ...(drumPatterns === undefined ? {} : {drumPatterns}), ...(drumAssignments === undefined ? {} : {drumAssignments})}
}

/** @param {string} json */
export function decodeStudioStyle(json) {
  const {arrangement, melody, bass = [], bassAccent, bassTechniques} = JSON.parse(json)
  if (typeof arrangement !== 'string' ||
      !validNotes(melody, studioPitchRange.melody) ||
      !validNotes(bass, studioPitchRange.bass) ||
      !bass.every(note => note.role === undefined || note.role === 'R') ||
      (bassTechniques !== undefined && (!bassTechniques || typeof bassTechniques !== 'object' || Array.isArray(bassTechniques) ||
        !Object.entries(bassTechniques).every(([page, technique]) => /^(0|[1-9][0-9]{0,2})$/.test(page) &&
          ['none','previous','straight8','straight4','straight16','offbeat','support_hold','custom'].includes(typeof technique === 'string' ? technique : '') &&
          (page !== '0' || technique !== 'previous')))) ||
      (bassAccent !== undefined && bassAccent !== 'front' && bassAccent !== 'back')) {
    throw new Error('Invalid Studio style')
  }
  return {arrangement, melody, bass, ...(bassTechniques === undefined ? {} : {bassTechniques}), ...(bassAccent === undefined ? {} : {bassAccent:/** @type {'front'|'back'} */ (bassAccent)})}
}

/**
 * Resolve reusable patterns into the existing song-wide note format.
 * Unedited B–D patterns inherit A; an explicitly empty pattern stays silent.
 * @param {StudioNote[]} notes
 * @param {(StudioNote[]|null)[]} patterns
 * @param {number[]} assignments
 * @param {number} barCount
 * @returns {(StudioNote & {velocity:number})[]|undefined}
 */
export function drumPlaybackNotes(notes, patterns, assignments, barCount) {
  if (!patterns.some(pattern => pattern !== null)) {
    return notes.length ? notes.map(note => ({...note, velocity:.8})) : undefined
  }
  const result = notes.filter(note => note.beat < 0).map(note => ({...note, velocity:.8}))
  for (let bar = 0; bar < barCount; bar++) {
    const pattern = resolveDrumPattern(patterns, assignments[bar] ?? 0)
    if (!pattern) {
      for (const note of notes) if (note.beat >= bar * 4 && note.beat < (bar + 1) * 4) result.push({...note, velocity:.8})
      continue
    }
    for (const note of pattern) result.push({...note, beat:bar * 4 + note.beat, velocity:.8})
  }
  return result.sort((a,b) => a.beat - b.beat)
}

/** @param {(StudioNote[]|null)[]} patterns @param {number} index */
export function resolveDrumPattern(patterns, index) {
  return patterns[index] ?? (index === 0 ? null : patterns[0]) ?? null
}
