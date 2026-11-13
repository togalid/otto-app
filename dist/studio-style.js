export const studioPitchRange = {
  melody: {min: 53, max: 84},
  bass: {min: 28, max: 60},
  backing: {min: 24, max: 96},
  drums: {min: 0, max: 7},
}

/** @typedef {{beat:number, duration:number, midi:number}} StudioNote */

/**
 * @param {unknown} notes
 * @param {{min:number, max:number}} range
 * @returns {notes is StudioNote[]}
 */
function validNotes(notes, {min, max}) {
  return Array.isArray(notes) && notes.every(note =>
    note && Number.isFinite(note.beat) && note.beat >= -1 &&
    Number.isFinite(note.duration) && note.duration > 0 &&
    Number.isInteger(note.midi) && note.midi >= min && note.midi <= max)
}

/** @param {unknown} value */
export function decodeStudioAccompaniment(value) {
  if (value === undefined) return {backing:[], drums:[]}
  const {backing, drums} = /** @type {{backing?:unknown, drums?:unknown}} */ (value ?? {})
  if (!validNotes(backing, studioPitchRange.backing) || !validNotes(drums, studioPitchRange.drums)) {
    throw new Error('Invalid Studio accompaniment')
  }
  return {backing, drums}
}

/** @param {string} json */
export function decodeStudioStyle(json) {
  const {arrangement, melody, bass = []} = JSON.parse(json)
  if (typeof arrangement !== 'string' ||
      !validNotes(melody, studioPitchRange.melody) ||
      !validNotes(bass, studioPitchRange.bass)) {
    throw new Error('Invalid Studio style')
  }
  return {arrangement, melody, bass}
}
