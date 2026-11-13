import test from 'node:test'
import assert from 'node:assert/strict'
import { notes, frequency, keyFromDegree } from '../dist/music.js'
import { Instrument } from '../dist/audio.js'
test('pads use unique keys and ascending pentatonic notes', () => {
  assert.equal(notes.length, 8)
  assert.equal(new Set(notes.map((n) => n.key)).size, 8)
  notes.forEach((note, index) => {
    assert.ok([0, 2, 4, 7, 9].includes(note.midi % 12))
    if (index) assert.ok(note.midi > notes[index - 1].midi)
  })
})
test('standard tuning and octave frequency', () => {
  assert.equal(frequency(69), 440)
  assert.equal(frequency(81), 880)
})
test('unsupported audio reports a recoverable error', async () => {
  const instrument = new Instrument()
  await assert.rejects(() => instrument.play(60), /対応していません/)
  instrument.silence()
})
test('volume stays within safe bounds', () => {
  const instrument = new Instrument()
  instrument.setVolume(5)
  assert.equal(instrument.volume, 1)
  instrument.setVolume(-1)
  assert.equal(instrument.volume, 0)
})

test('sixth-degree slash chords retain the requested voicing in a progression', async () => {
  const { bassHarmonyNotes, chordNotes, customChord, defaultChord, displayChordParts, qualityGroups, voicePhrase } =
    await import('../dist/music.js')
  const sixth = defaultChord(9)
  const options = qualityGroups(sixth).flatMap(group => group.options.map(option => option.value))

  for (const [extension, notes, symbol] of [
    ['vii7_over_vi', [57, 63, 66, 71], 'B7/A'],
    ['flat_vii_over_vi', [57, 62, 65, 70], 'B♭/A'],
  ]) {
    assert.ok(options.includes('slash:' + extension))
    const id = customChord({ root: 5, alter: 0, quality: 'slash', extension })
    const parts = displayChordParts(id, 0, 'chord')
    assert.equal(parts.main + parts.suffix, symbol)
    assert.deepEqual(chordNotes(id, 0), notes)
    assert.deepEqual(voicePhrase([{ id: 'C', key: 0 }, { id, key: 2 }])[1], notes.map(note => note + 2))
    assert.equal(bassHarmonyNotes(id, 2)[0] % 12, 11)
  }
})

test('matched roots infer the key for all seven major degrees', () => {
  const intervals = [0, 2, 4, 5, 7, 9, 11]
  for (let key = 0; key < 12; key++) intervals.forEach((offset, degree) => assert.equal(keyFromDegree((key + offset) % 12, degree), key))
  assert.equal(keyFromDegree(6, 3), 1) // F sharp as IV gives D flat.
  assert.throws(() => keyFromDegree(12, 0), RangeError)
  assert.throws(() => keyFromDegree(0, 7), RangeError)
})

test('Pad upper structures preserve the selected bass and upper chord through transposition',async()=>{
 const {customChord,padChordNotes}=await import('../dist/music.js')
 for(let key=0;key<12;key++)for(let offset=0;offset<12;offset++){
  const id=customChord({root:0,alter:0,quality:'slash',extension:`pad_${offset}_maj7`})
  const notes=padChordNotes(id,key)
  assert.equal(Math.min(...notes)%12,key)
  for(const interval of [0,4,7,11])assert.ok(notes.some(note=>note%12===(key+offset+interval)%12))
 }
})

test('Pad slash chord labels show the upper chord and bass in each notation', async () => {
  const {customChord, displayChordParts} = await import('../dist/music.js')
  const id = customChord({root:3, alter:0, quality:'slash', extension:'pad_2_maj'})
  assert.deepEqual(displayChordParts(id, 0, 'number'), {main:'5', suffix:'/4'})
  assert.deepEqual(displayChordParts(id, 0, 'roman'), {main:'V', suffix:'/IV'})
  assert.deepEqual(displayChordParts(id, 2, 'chord'), {main:'A', suffix:'/G'})
})

test('open and closed voicings keep harmonic pitches and bass while changing spacing',async()=>{
 const {voicePhrase}=await import('../dist/music.js')
 const cells=['CM7','Dm7','G7','CM7'].map(id=>({id,key:0}))
 const closed=voicePhrase(cells.map(c=>({...c,voicing:'closed'}))), open=voicePhrase(cells.map(c=>({...c,voicing:'open'})))
 assert.notDeepEqual(open,closed)
 open.forEach((notes,i)=>{assert.equal(notes[0]%12,closed[i][0]%12);assert.deepEqual([...new Set(notes.map(n=>n%12))].sort(),[...new Set(closed[i].map(n=>n%12))].sort());assert.ok(Math.max(...notes)<=84)})
})
