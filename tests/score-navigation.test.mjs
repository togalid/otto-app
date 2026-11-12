import test from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'

const dom = new JSDOM('<!doctype html><html><body></body></html>', {url:'http://localhost/'})
for (const name of ['window', 'document', 'Element', 'HTMLElement', 'SVGElement', 'Event']) {
  globalThis[name] = name === 'window' ? dom.window : name === 'document' ? dom.window.document : dom.window[name]
}
const { createApp, h, ref, nextTick } = await import('../dist/vendor/vue.runtime.esm-browser.prod.js')
const { scoreNavigation, scoreNote, scoreAccidentalForNote, scoreStaffStep, scoreTrebleTop, scoreLedgerOffsets, scoreStemDown, scoreBeamConnects, scoreBeamStemDown, scoreBeamLayout, scoreBeamGroupStemDown, scoreEighthGroups, tutorialPitchSymbol } = await import('../dist/score-navigation.js')

test('navigation renders changing lanes and notes and preserves editing callbacks', async () => {
  const host = document.createElement('div')
  document.body.append(host)
  const lanes = ref([{id:1, notes:['C', 'D']}, {id:2, notes:['E']}])
  const chosen = []
  const app = createApp({render:()=>scoreNavigation({
    attrs:{'aria-label':'譜面'}, laneContainer:{class:'tutorial-lanes'}, lanes:lanes.value,
    lane:lane=>({
      attrs:{'data-lane':lane.id}, before:[h('span', `小節${lane.id}`)], notes:lane.notes,
      note:(note,index)=>scoreNote('button', {type:'button', onClick:()=>chosen.push([lane.id,index,note])}, [h('span',note)], {beat:index,duration:1,laneBeats:4,top:'50%'}),
      after:[],
    }),
  })})
  app.mount(host)
  assert.deepEqual([...host.querySelectorAll('.tutorial-note')].map(el=>el.textContent), ['C','D','E'])
  assert.equal(host.querySelectorAll('.tutorial-note')[1].style.left, '25%')
  assert.equal(host.querySelectorAll('.tutorial-note')[1].style.width, '25%')
  host.querySelectorAll('.tutorial-note')[1].click()
  assert.deepEqual(chosen, [[1,1,'D']])
  lanes.value = [{id:2, notes:['F']}]
  await nextTick()
  assert.equal(host.querySelectorAll('.tutorial-note-lane').length, 1)
  assert.equal(host.querySelector('.tutorial-note').textContent, 'F')
  app.unmount()
  host.remove()
})

test('sharp notes and naturals are notated within their measure', () => {
  const notes = [{beat:0,midi:66}, {beat:1,midi:65}, {beat:2,midi:65}, {beat:3,midi:70}, {beat:4,midi:69}, {beat:5,midi:72}, {beat:6,midi:71}]
  assert.deepEqual(notes.map((_, index) => scoreAccidentalForNote(notes, index)), ['♯','♮','','♭','','',''])
})

test('B flat is cancelled by B natural in the same measure', () => {
  const notes = [{beat:0,midi:70}, {beat:1,midi:69}, {beat:2,midi:71}, {beat:3,midi:71}, {beat:4,midi:70}, {beat:8,midi:71}]
  assert.deepEqual(notes.map((_, index) => scoreAccidentalForNote(notes, index)), ['♭','','♮','','♭',''])
})

test('E flat is cancelled by E natural in the same measure', () => {
  const notes = [{beat:0,midi:63}, {beat:1,midi:62}, {beat:2,midi:64}, {beat:3,midi:64}, {beat:4,midi:63}, {beat:8,midi:64}]
  assert.deepEqual(notes.map((_, index) => scoreAccidentalForNote(notes, index)), ['♭','','♮','','♭',''])
})

test('treble pitch positions and ledger lines extend from F3 to C6', () => {
  assert.deepEqual([53,57,60,64,72,81,84].map(scoreStaffStep), [-4,-2,0,2,7,12,14])
  assert.deepEqual(scoreLedgerOffsets(53), [-4,-2,0])
  assert.deepEqual(scoreLedgerOffsets(60), [0])
  assert.deepEqual(scoreLedgerOffsets(81), [0])
  assert.deepEqual(scoreLedgerOffsets(84), [2,0])
  assert.notEqual(scoreTrebleTop(60), scoreTrebleTop(72))
  assert.equal(scoreStaffStep(63), scoreStaffStep(64))
  assert.equal(scoreAccidentalForNote([{beat:0,midi:84}], 0), '')
})

test('stems and flags point down from B flat 4, including short notes', () => {
  const host = document.createElement('div')
  document.body.append(host)
  const app = createApp({render:()=>h('div', [tutorialPitchSymbol({midi:69,duration:.25}), tutorialPitchSymbol({midi:70,duration:.25}), tutorialPitchSymbol({midi:84,duration:2})])})
  app.mount(host)
  const symbols = host.querySelectorAll('svg')
  assert.equal(symbols[0].querySelector('path').getAttribute('d'), 'M8.8 19V2')
  assert.equal(symbols[1].querySelector('path').getAttribute('d'), 'M1.2 19V36')
  assert.equal(symbols[2].querySelector('path').getAttribute('d'), 'M1.2 19V36')
  assert.match(symbols[1].querySelectorAll('path')[1].getAttribute('d'), /^M1.2 36/)
  app.unmount()
  host.remove()
})

test('beams connect across stem direction changes but respect phrase boundaries', () => {
  const notes = [67,69,70,72,69].map(midi=>({midi}))
  assert.deepEqual(notes.map((_,i)=>scoreBeamConnects(notes,i,[])), [false,true,true,true,true])
  assert.equal(scoreBeamConnects(notes,3,[3]), false)
  assert.equal(scoreStemDown(58), false)
  assert.equal(scoreStemDown(70), true)
})

test('eighth notes beam only in a complete beat', () => {
  const notes = [
    {beat:0,length:.5,midi:67}, {beat:.5,length:.5,midi:69},
    {beat:1,length:.5,midi:69}, {beat:1.5,length:.5,midi:71},
    {beat:2,length:.5,midi:71}, {beat:2.5,length:.5,midi:72},
    {beat:3.5,length:.5,midi:67}, {beat:4,length:.5,midi:69},
    {beat:5,length:.25,midi:67}, {beat:5.25,length:.5,midi:69},
  ]
  assert.deepEqual(scoreEighthGroups(notes), [[0,1,2,3],[4,5]])
})

test('dotted quarter, eighth and sixteenth notes retain their dot and flags', () => {
  const host = document.createElement('div')
  document.body.append(host)
  const app = createApp({render:()=>h('div', [1.5, .75, .375].map(duration=>tutorialPitchSymbol({midi:65,duration})) )})
  app.mount(host)
  const symbols = host.querySelectorAll('svg')
  assert.deepEqual([...symbols].map(symbol=>symbol.querySelectorAll('circle').length), [1,1,1])
  assert.deepEqual([...symbols].map(symbol=>symbol.querySelectorAll('path').length), [1,2,3])
  app.unmount()
  host.remove()
})

test('a beam uses the most distant pitch to choose a shared stem direction', () => {
  const notes = [69,71,72,64].map(midi => ({midi}))
  assert.equal(scoreBeamStemDown(notes.slice(0, 2)), false)
  assert.equal(scoreBeamStemDown(notes.slice(1, 3)), true)
  assert.equal(scoreBeamStemDown(notes.slice(2, 4)), false)
  assert.equal(scoreBeamStemDown([{midi:69},{midi:72}]), true)
  assert.deepEqual(notes.map((_,i)=>scoreBeamGroupStemDown(notes,i,[2])), [false,false,false,false])
})

test('four eighth notes group within each half-bar, not across its midpoint or a rest', () => {
  const complete = Array.from({length:8}, (_, i) => ({beat:i / 2,length:.5,midi:60 + i}))
  assert.deepEqual(scoreEighthGroups(complete), [[0,1,2,3],[4,5,6,7]])
  assert.deepEqual(scoreEighthGroups(complete.slice(2,6)), [[0,1],[2,3]])
  assert.deepEqual(scoreEighthGroups(complete.filter(note => note.beat !== .5)), [[1,2],[3,4,5,6]])
  assert.deepEqual(scoreEighthGroups([{beat:0,length:.5,midi:60},{beat:.5,length:.5,midi:62},{beat:1,length:.75,midi:64},{beat:1.75,length:.25,midi:65}]), [[0,1]])
})

test('four-note beams use one shared direction and stems reach a common height', () => {
  const up = scoreBeamLayout([60,62,67,69].map(midi=>({midi})))
  assert.equal(up.down, false)
  assert.equal(up.referenceIndex, 3)
  assert.deepEqual(up.stemLengths, [37,33,21,17])
  const down = scoreBeamLayout([71,72,74,76].map(midi=>({midi})))
  assert.equal(down.down, true)
  assert.equal(down.referenceIndex, 0)
  assert.deepEqual(down.stemLengths, [17,21,25,29])
})
