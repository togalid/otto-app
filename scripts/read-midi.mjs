// Read note timing in quarter-note beats so Studio can supply the tempo.
export function readMidi(bytes) {
  const invalid = () => { throw new Error('拍ベースの標準MIDIファイル（形式0または1）を指定してください。') }
  if (bytes.length < 14 || bytes.toString('ascii', 0, 4) !== 'MThd') invalid()
  const header = bytes.readUInt32BE(4)
  const format = bytes.readUInt16BE(8)
  const tracks = bytes.readUInt16BE(10)
  const division = bytes.readUInt16BE(12)
  if (header < 6 || format > 1 || !tracks || (format === 0 && tracks !== 1) || !division || division > 32767) invalid()
  let cursor = 8 + header
  const notes = []
  for (let track = 0; track < tracks; track++) {
    if (cursor + 8 > bytes.length || bytes.toString('ascii', cursor, cursor + 4) !== 'MTrk') invalid()
    const end = cursor + 8 + bytes.readUInt32BE(cursor + 4)
    if (end > bytes.length) invalid()
    cursor += 8
    const byte = () => cursor < end ? bytes[cursor++] : invalid()
    const data = () => {
      const value = byte()
      return value < 128 ? value : invalid()
    }
    const variable = () => {
      let value = 0
      for (let i = 0; i < 4; i++) {
        const part = byte()
        value = value * 128 + (part & 127)
        if (part < 128) return value
      }
      invalid()
    }
    let tick = 0
    let running = 0
    const held = new Map()
    while (cursor < end) {
      tick += variable()
      let status = byte()
      if (status < 128) {
        if (!running) invalid()
        cursor--
        status = running
      }
      if (status === 255 || status === 240 || status === 247) {
        if (status === 255) byte()
        const length = variable()
        cursor += length
        if (cursor > end) invalid()
        running = 0
        continue
      }
      if (status >= 240) invalid()
      running = status
      const kind = status >> 4
      const pitch = data()
      const velocity = kind === 12 || kind === 13 ? 0 : data()
      if ((status & 15) === 9 || (kind !== 8 && kind !== 9)) continue
      const key = (status & 15) * 128 + pitch
      if (kind === 9 && velocity) {
        const queue = held.get(key) ?? []
        queue.push({tick, velocity})
        held.set(key, queue)
      } else {
        const note = held.get(key)?.shift()
        if (note && tick > note.tick) {
          notes.push({beat: note.tick / division, duration: (tick - note.tick) / division, midi: pitch, velocity: note.velocity / 127})
          if (notes.length > 20000) throw new Error('MIDIの音符数が上限を超えています。')
        }
      }
    }
  }
  return notes.sort((a, b) => a.beat - b.beat)
}
