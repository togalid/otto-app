/** Four independent arrangement colours; all pitched timbres use the existing chord voice catalog. */
export const ornamentParts = Object.freeze([
  { id: 'bell', label: 'ベル', timbres: [{ id: 'bell', label: 'きらめくベル' }, { id: 'mallet', label: 'マリンバ' }] },
  { id: 'pluck', label: 'プラック', timbres: [{ id: 'pluck', label: 'プラックシンセ' }, { id: 'soft', label: 'やわらかシンセ' }, { id: 'electric', label: 'エレピ' }] },
  { id: 'phrase', label: 'フレーズ', timbres: [{ id: 'strings', label: 'ストリングス' }, { id: 'piano', label: 'ピアノ' }, { id: 'soft', label: 'シンセ' }, { id: 'supersaw', label: 'スーパーソー' }, { id: 'saw-brass', label: 'ソー・ブラス' }, { id: 'pulse-stack', label: 'パルス・スタック' }] },
  { id: 'fx', label: '展開FX', timbres: [{ id: 'cymbal', label: 'シンバル' }, { id: 'noise', label: 'ノイズ' }] },
].map(part => Object.freeze({ ...part, timbres: Object.freeze(part.timbres.map(timbre => Object.freeze(timbre))) })))

/** @type {ReadonlyArray<{id:string,part:string,label:string}>} */
export const ornamentPatterns = Object.freeze([
  { id: 'off', part: 'bell', label: 'なし' },
  { id: 'sparkle-even', part: 'bell', label: '2・4・6・8小節のきらめき' },
  { id: 'sparkle-four', part: 'bell', label: '4・8小節のベルフィル' },
  { id: 'bell-answer', part: 'bell', label: '後半の小さな返事' },
  { id: 'off', part: 'pluck', label: 'なし' },
  { id: 'pluck-gaps', part: 'pluck', label: '合間のプラック' },
  { id: 'pluck-sync', part: 'pluck', label: '裏拍の受け答え' },
  { id: 'pluck-sixteen', part: 'pluck', label: '16分の小さな刻み' },
  { id: 'pluck-thirds', part: 'pluck', label: '3度重ねのかけあい' },
  { id: 'pluck-chords', part: 'pluck', label: '密集コード・パパパン' },
  { id: 'pluck-trance', part: 'pluck', label: 'トランス・裏拍コード' },
  { id: 'pluck-trance-drive', part: 'pluck', label: 'トランス・16分ドライブ' },
  { id: 'off', part: 'phrase', label: 'なし' },
  { id: 'strings-lift', part: 'phrase', label: '4・8小節のストリングス走句' },
  { id: 'strings-fourths', part: 'phrase', label: '4度重ねのストリングス疾走' },
  { id: 'strings-cluster-rise', part: 'phrase', label: '4・8小節のクラスター上昇' },
  { id: 'strings-cluster-rise-wave', part: 'phrase', label: '4・8小節の波打つ上昇' },
  { id: 'strings-cluster-fall', part: 'phrase', label: '4・8小節のクラスター下降' },
  { id: 'strings-cluster-fall-wave', part: 'phrase', label: '4・8小節の波打つ下降' },
  { id: 'synth-rush', part: 'phrase', label: '16分シンセ・ラッシュ' },
  { id: 'piano-wide', part: 'phrase', label: 'ピアノの広域アルペジオ' },
  { id: 'off', part: 'fx', label: 'なし' },
  { id: 'crash-one', part: 'fx', label: '1小節目のクラッシュ' },
  { id: 'reverse-four', part: 'fx', label: '4・8小節のリバース' },
  { id: 'transition', part: 'fx', label: 'リバース＋頭のクラッシュ' },
].map(pattern => Object.freeze(pattern)))

/** @typedef {{beat:number,duration:number,notes:number[],level:number,sound?:'crash'|'reverse'}} OrnamentEvent */

/** Map pitch classes into an ordered register; octave changes never invent chord tones.
 * @param {readonly number[]} notes @param {number} low @param {number} high */
function registerNotes(notes, low, high) {
  const pitches = new Set(notes.filter(note => Number.isInteger(note) && note >= 0 && note <= 127).map(note => note % 12))
  return Array.from({ length: high - low + 1 }, (_, i) => low + i).filter(note => pitches.has(note % 12))
}

/** Sparse musical gestures on the current harmony. Time is in beats, before swing.
 * barIndex is zero-based. The generator is pure and deterministic, including at loop boundaries.
 * @param {string} partId @param {string} patternId @param {number} barIndex
 * @param {(beat:number)=>readonly number[]} notesAtBeat @param {number} [bpm]
 * @returns {OrnamentEvent[]} */
export function ornamentEvents(partId, patternId, barIndex, notesAtBeat, bpm = 100) {
  if (!ornamentParts.some(part => part.id === partId)) throw new RangeError('Unknown ornament part')
  if (!ornamentPatterns.some(pattern => pattern.id === patternId && pattern.part === partId)) throw new RangeError('Unknown ornament pattern')
  if (!Number.isInteger(barIndex) || barIndex < 0 || !Number.isFinite(bpm) || bpm <= 0) throw new RangeError('Invalid ornament position or tempo')
  if (patternId === 'off') return []
  const bar = barIndex % 8
  /** @type {OrnamentEvent[]} */
  const events = []
  /** @param {number} beat @param {number} duration @param {number} rank @param {number} level @param {number} low @param {number} high */
  function pitch(beat, duration, rank, level, low, high) {
    const available = registerNotes(notesAtBeat(beat), low, high)
    if (!available.length) return
    const midi = available[((rank % available.length) + available.length) % available.length]
    let end = Math.min(4, beat + duration)
    // A long sparkle may ring, but not through a harmony that makes it unrelated.
    for (let boundary = (Math.floor(beat * 4) + 1) / 4; boundary < end; boundary += .25) {
      if (!notesAtBeat(boundary).some(note => note % 12 === midi % 12)) { end = boundary; break }
    }
    events.push({ beat, duration: end - beat, notes: [midi], level })
  }
  if (partId === 'fx') {
    if ((patternId === 'crash-one' || patternId === 'transition') && bar === 0)
      events.push({ beat: 0, duration: 3.5, notes: [], level: .72, sound: 'crash' })
    if ((patternId === 'reverse-four' || patternId === 'transition') && (bar === 3 || bar === 7))
      events.push({ beat: 2, duration: 2, notes: [], level: .62, sound: 'reverse' })
    return events
  }
  if (partId === 'bell') {
    if (patternId === 'sparkle-even' && bar % 2 === 0) return []
    if (patternId === 'sparkle-four' && bar !== 3 && bar !== 7) return []
    const timing = patternId === 'bell-answer' ? [2.5, 3.25] : [2, 2.5, 3.25]
    timing.forEach((beat, i) => pitch(beat, i === timing.length - 1 ? .7 : .35, i === timing.length - 1 ? 2 : i + (bar % 4), i === 0 ? .52 : i === timing.length - 1 ? .64 : .4, 72, 95))
  } else if (partId === 'pluck') {
    if (['pluck-thirds', 'pluck-chords', 'pluck-trance', 'pluck-trance-drive'].includes(patternId)) {
      const timing = patternId === 'pluck-thirds' ? [1.25, 2, 2.75, 3.5]
        : patternId === 'pluck-chords' ? [1, 1.25, 1.5, 2.75, 3, 3.5]
          : patternId === 'pluck-trance' ? [.5, 1.5, 2.5, 3.5]
            : [.25, .5, .75, 1.25, 1.5, 1.75, 2.25, 2.5, 2.75, 3.25, 3.5, 3.75]
      timing.forEach((beat, i) => {
        const available = registerNotes(notesAtBeat(beat), 60, 83)
        if (!available.length) return
        let selected
        if (patternId === 'pluck-thirds') {
          const pairs = available.flatMap(low => available.filter(high => high-low === 3 || high-low === 4).map(high => [low,high]))
          selected = pairs.length ? pairs[(i + bar) % pairs.length] : [available[(i + bar) % available.length]]
        } else {
          // Pick distinct chord tones within a single octave, alternating inversions.
          const start = (i + Math.floor(bar / 2)) % Math.min(3, available.length)
          selected = available.slice(start, start + 3).filter(note => note - available[start] < 12)
        }
        let end = Math.min(4, beat + (patternId === 'pluck-trance' ? .36 : i % 3 === 2 ? .28 : .14))
        for (let boundary = (Math.floor(beat * 4) + 1) / 4; boundary < end; boundary += .25) {
          const pitches = notesAtBeat(boundary).map(note => note % 12)
          if (selected.some(note => !pitches.includes(note % 12))) { end = boundary; break }
        }
        events.push({beat,duration:end-beat,notes:selected,level:i % 3 === 2 ? .72 : .55})
      })
      return events
    }
    const timing = patternId === 'pluck-gaps' ? (bar % 2 ? [1.75, 2.5, 3.25] : [1.5, 2.75])
      : patternId === 'pluck-sync' ? [0.75, 1.5, 2.75, 3.5]
        : [0.5, 0.75, 1.5, 2.25, 2.5, 3.5, 3.75]
    timing.forEach((beat, i) => pitch(beat, i === timing.length - 1 ? .2 : .14, [0, 2, 1, 3, 2, 1, 0][i % 7] + bar % 2, i % 2 ? .48 : .64, 60, 83))
  } else if (['strings-cluster-rise', 'strings-cluster-rise-wave', 'strings-cluster-fall', 'strings-cluster-fall-wave'].includes(patternId)) {
    if (bar !== 3 && bar !== 7) return []
    for (let i = 0; i < 8; i++) {
      const beat = 2 + i / 4
      const available = registerNotes(notesAtBeat(beat), 60, 95)
      if (!available.length) continue
      const falling = patternId.includes('fall')
      const wave = patternId.endsWith('wave')
      const contour = wave ? [0, 2, 1, 3, 2, 4, 3, 5] : [0, 1, 2, 3, 4, 5, 6, 7]
      const maxStart = Math.max(0, available.length - 4)
      const rank = Math.min(contour[i], maxStart)
      const start = falling ? maxStart - rank : rank
      const notes = available.slice(start, start + 4)
      if (!notes.length) continue
      let end = Math.min(4, beat + (i === 7 ? .24 : .17))
      for (let boundary = (Math.floor(beat * 4) + 1) / 4; boundary < end; boundary += .25) {
        const pitches = notesAtBeat(boundary).map(note => note % 12)
        if (notes.some(note => !pitches.includes(note % 12))) { end = boundary; break }
      }
      events.push({beat,duration:end-beat,notes,level:Math.min(.85, .48 + i*.035 + (wave && i % 4 === 0 ? .1 : 0))})
    }
  } else if (patternId === 'strings-lift' || patternId === 'strings-fourths') {
    if (patternId === 'strings-lift' && bar !== 3 && bar !== 7) return []
    const start = patternId === 'strings-lift' ? 2 : 0
    const count = patternId === 'strings-lift' ? 8 : 16
    const contour = [0,1,2,1,2,3,4,3,2,3,4,3,4,5,6,5]
    for (let i = 0; i < count; i++) {
      const beat = start + i / 4
      const chord = notesAtBeat(beat)
      const available = registerNotes(chord, 65, 86)
      if (!available.length) continue
      const low = available[contour[i] % available.length]
      // A perfect fourth above a chord tone, unless it clashes by a semitone
      // with the sounding harmony; then use a nearby chord tone instead.
      const fourth = low + 5
      const clash = chord.some(note => (fourth - note + 120) % 12 === 1)
      const upper = !clash && fourth <= 91 ? fourth : available.find(note => note > low && note-low <= 7)
      const notes = upper === undefined ? [low] : [low, upper]
      let end = Math.min(4, beat + (i % 4 === 3 ? .22 : .17))
      for (let boundary = (Math.floor(beat * 4) + 1) / 4; boundary < end; boundary += .25) {
        if (notesAtBeat(boundary).some(note => (low - note + 120) % 12 === 1) || !notesAtBeat(boundary).some(note => note % 12 === low % 12)) { end = boundary; break }
      }
      events.push({beat,duration:end-beat,notes,level:i % 4 === 0 ? .78 : i % 4 === 3 ? .68 : .52 + (i % 2)*.08})
    }
  } else if (patternId === 'synth-rush') {
    Array.from({ length: 16 }, (_, i) => i / 4).forEach((beat, i) => {
      const rank = [0, 2, 4, 2, 1, 3, 5, 3][i % 8] + (bar % 2 ? 1 : 0)
      pitch(beat, bpm >= 150 ? .19 : .16, rank, i % 4 === 0 ? .68 : i % 2 ? .4 : .53, 60, 95)
    })
  } else if (patternId === 'piano-wide') {
    // A travelling hand spans almost three octaves; the return takes a different path.
    const contour = [0, 2, 4, 6, 8, 10, 8, 6, 4, 2, 1, 3, 5, 7, 5, 2]
    contour.forEach((rank, i) => pitch(i / 4, i === 15 ? .24 : .22, rank + bar % 2, i % 4 === 0 ? .78 : i % 2 ? .48 : .62, 48, 95))
  }
  return events
}
