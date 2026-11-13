/**
 * Encode a format-0 MIDI file from quarter-note beats.
 * @param {{beat:number,length:number,midi:number}[]} notes
 * @param {number} bpm
 * @param {number} pickupBeats
 */
export function encodeScoreMidi(notes, bpm, pickupBeats) {
  const offset = notes.some(note => note.beat < 0) ? pickupBeats : 0
  const events = notes.flatMap(note => [
    {tick:Math.round((note.beat + offset) * 480), bytes:[0x90,note.midi,100]},
    {tick:Math.round((note.beat + note.length + offset) * 480), bytes:[0x80,note.midi,0]},
  ]).sort((a,b)=>a.tick-b.tick || a.bytes[0]-b.bytes[0])
  const track = [0,255,81,3, ...[16,8,0].map(shift => (Math.round(60000000 / bpm) >> shift) & 255)]
  let previous = 0
  for (const event of events) {
    let delta = event.tick - previous
    const encoded = [delta & 127]
    while ((delta >>= 7) > 0) encoded.unshift((delta & 127) | 128)
    track.push(...encoded,...event.bytes)
    previous = event.tick
  }
  track.push(0,255,47,0)
  return new Uint8Array([77,84,104,100,0,0,0,6,0,0,0,1,1,224,77,84,114,107,
    ...[24,16,8,0].map(shift => (track.length >>> shift) & 255), ...track])
}
