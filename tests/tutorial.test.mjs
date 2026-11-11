import test from 'node:test'
import assert from 'node:assert/strict'
import {lessons,createTutorialPlayer,tutorialBeatSeconds,displayedResponseStart,mergePlayedSegments,responseComplete,lessonThreeChords,recordTutorialSuccess,eighthNoteHit,shortNoteTarget,tutorialNotes,tutorialPentatonic,matchSlideNote,isTutorialFreePitch} from '../dist/tutorial.js'

function harness(ready = async () => {}) {
  const states = [], notes = [], timers = new Map()
  let id = 0, silenced = 0
  const context = {currentTime:10}
  const voice = {context,ready,playAt:(...args)=>notes.push(args),silence:()=>silenced++}
  const player = createTutorialPlayer({voice,onUpdate:s=>states.push(s),setTimer:cb=>{timers.set(++id,cb);return id},clearTimer:id=>timers.delete(id)})
  return {player,voice,context,states,notes,timers,get silenced(){return silenced},tick(time){context.currentTime=time;for(const cb of timers.values())cb()}}
}

test('ten self-contained lessons fit a one-octave keyboard and one demo bar',()=>{
  assert.equal(lessons.length,10)
  for(const lesson of lessons) {
    assert.ok(lesson.messages.length > 0)
    assert.ok(lesson.notes.length)
    for(const note of (lesson.patterns ?? [lesson.notes]).flat()) {
      assert.ok(note.midi>=60 && note.midi<=72)
      assert.ok(note.beat>=0 && note.duration>0 && note.beat+note.duration<=4)
    }
  }
})

test('count-in, four Otto/user exchanges, then exactly eight bars complete',async()=>{
  const h=harness(); await h.player.start(0)
  assert.equal(h.states.at(-1).phase,'countdown')
  assert.equal(h.notes.length,0)
  const origin=10+4*tutorialBeatSeconds+.05
  for(let bar=0;bar<8;bar++) {
    h.tick(origin+bar*4*tutorialBeatSeconds+.001)
    assert.equal(h.states.at(-1).phase,bar%2?'you':'otto')
    assert.equal(h.states.at(-1).bar,bar)
  }
  assert.equal(h.notes.length,4)
  assert.deepEqual(h.notes.map(n=>n[1]),[0,8,16,24].map(beat=>origin+beat*tutorialBeatSeconds))
  h.tick(origin+32*tutorialBeatSeconds)
  assert.equal(h.states.at(-1).phase,'complete')
  assert.equal(h.timers.size,0)
  assert.equal(h.silenced,2)
})

test('stopping during audio preparation cannot start a stale lesson',async()=>{
  let resolve
  const h=harness(()=>new Promise(r=>{resolve=r}))
  const pending=h.player.start(0); h.player.stop(); resolve(); await pending
  assert.equal(h.states.at(-1).phase,'idle')
  assert.equal(h.timers.size,0)
  assert.equal(h.notes.length,0)
})

test('switching lesson invalidates an older ready result',async()=>{
  const resolvers=[]
  const h=harness(()=>new Promise(r=>resolvers.push(r)))
  const first=h.player.start(0), second=h.player.start(1)
  resolvers[1](); await second; resolvers[0](); await first
  assert.equal(h.timers.size,1)
  const origin=10+4*tutorialBeatSeconds+.05
  h.tick(origin+2*tutorialBeatSeconds)
  assert.deepEqual(h.notes.map(n=>n[0]),[[62]])
})

test('failure is recoverable and stop cancels future events',async()=>{
  const h=harness(async()=>{throw new Error('audio blocked')})
  await h.player.start(0)
  assert.equal(h.states.at(-1).phase,'error')
  assert.equal(h.states.at(-1).error,'audio blocked')
  h.voice.ready=async()=>{}
  await h.player.start(0)
  h.player.stop()
  h.tick(100)
  assert.equal(h.notes.length,0)
  assert.equal(h.states.at(-1).phase,'idle')
})

test('invalid selection and scheduling failure stop safely',async()=>{
  const h=harness()
  await h.player.start(-1)
  assert.equal(h.states.at(-1).phase,'error')
  await h.player.start(0)
  h.voice.playAt=()=>{throw new Error('voice unavailable')}
  h.tick(10+4*tutorialBeatSeconds+.05)
  assert.equal(h.states.at(-1).error,'voice unavailable')
  assert.equal(h.timers.size,0)
})

test('count-in and backing share the lesson clock and stop with the lesson',async()=>{
  const h=harness(), backing=[]
  let stopped=0
  const accompaniment={context:h.context,ready:async()=>{},playAt:(...args)=>backing.push(args),silence:()=>stopped++}
  const timers=new Map(); let id=0
  const player=createTutorialPlayer({voice:h.voice,accompaniment,onUpdate:()=>{},setTimer:cb=>{timers.set(++id,cb);return id},clearTimer:id=>timers.delete(id)})
  await player.start(0)
  const origin=10+4*tutorialBeatSeconds+.05
  for(let beat=-4;beat<4;beat++) { h.context.currentTime=origin+beat*tutorialBeatSeconds; for(const cb of timers.values())cb() }
  assert.equal(backing.length,8)
  assert.deepEqual(backing.slice(0,4).map(n=>n[0]),[[84],[79],[79],[79]])
  assert.deepEqual(backing[4][0],[48,60,64,67])
  player.stop()
  assert.equal(timers.size,0)
  assert.equal(stopped,2)
})

test("near-onset display fills from the start while late playing stays visible",()=>{
  assert.equal(displayedResponseStart(1.08,1),1)
  assert.equal(displayedResponseStart(1.2,1),1.2)
  assert.equal(displayedResponseStart(.9,1),.9)
})


test('completion requires all displayed notes to be covered without gaps',()=>{
  const notes=[{beat:0,midi:60,duration:1},{beat:2,midi:62,duration:1}]
  const played=[{bar:1,midi:60,start:.03,end:.5},{bar:1,midi:60,start:.5,end:1},{bar:1,midi:62,start:2,end:3}]
  assert.equal(responseComplete(notes,played,1),true)
  assert.equal(responseComplete(notes,played.slice(0,2),1),false)
  assert.equal(responseComplete(notes,played,3),false)
  assert.equal(responseComplete(notes,[{bar:1,midi:60,start:0,end:.4},{bar:1,midi:60,start:.6,end:1},played[2]],1),false)
})


test('ドからレへ holds each note for one beat',()=>{
  for (const lesson of lessons.slice(1,2)) assert.deepEqual(lesson.notes.map(n=>n.duration),[1,1])
})

test('ドからレへ plays the specified two-beat chords and bass throughout eight bars',async()=>{
  assert.deepEqual(lessonThreeChords.map(c=>c.name),['C','G/B','Am7','G','FM7','Em7','Dm7','G'])
  const h=harness(), backing=[], timers=new Map(); let id=0
  const accompaniment={context:h.context,ready:async()=>{},playAt:(...args)=>backing.push(args),silence:()=>{}}
  const player=createTutorialPlayer({voice:h.voice,accompaniment,onUpdate:()=>{},setTimer:cb=>{timers.set(++id,cb);return id},clearTimer:id=>timers.delete(id)})
  await player.start(1)
  const origin=10+4*tutorialBeatSeconds+.05
  for(let beat=0;beat<32;beat++) { h.context.currentTime=origin+beat*tutorialBeatSeconds; for(const cb of timers.values())cb() }
  const chords=backing.filter(args=>args[0][0]<79)
  assert.equal(chords.length,32)
  for(let beat=0;beat<32;beat++) {
    const expected=lessonThreeChords[Math.floor(beat/2)%8]
    assert.deepEqual(chords[beat][0],expected.notes)
    assert.equal(chords[beat][4],expected.bass)
  }
  assert.ok(lessonThreeChords[1].notes.includes(62))
  assert.equal(lessonThreeChords[1].bass%12,11)
  player.stop()
})


test('each successful user turn scores once and a new run can reset',()=>{
  const successes=new Set()
  assert.equal(recordTutorialSuccess(successes,1,true),true)
  assert.equal(recordTutorialSuccess(successes,1,true),false)
  assert.equal(recordTutorialSuccess(successes,2,true),false)
  assert.equal(recordTutorialSuccess(successes,3,false),false)
  for(const bar of [3,5,7]) assert.equal(recordTutorialSuccess(successes,bar,true),true)
  assert.equal(successes.size,4)
  successes.clear()
  assert.equal(recordTutorialSuccess(successes,1,true),true)
})


test('eighth notes accept a timely tap but reject wrong or late notes',()=>{
  const notes=lessons[2].notes
  assert.equal(eighthNoteHit(notes,60,.1),notes[0])
  assert.equal(eighthNoteHit(notes,62,.9),notes[1])
  assert.equal(eighthNoteHit(notes,60,.4),undefined)
  assert.equal(eighthNoteHit(notes,64,2),undefined)
  assert.equal(eighthNoteHit(notes,61,0),undefined)
  const hit=eighthNoteHit(notes,60,.1)
  assert.equal(responseComplete([hit],[{bar:1,midi:60,start:hit.beat,end:hit.beat+hit.duration}],1),true)
})


test('短く、長く short notes fill on a timely tap',()=>{
  const notes=lessons[3].notes
  for (const note of notes.slice(0,2)) {
    assert.equal(eighthNoteHit(notes,note.midi,note.beat+.05),note)
    assert.equal(eighthNoteHit(notes,note.midi,note.beat+.4),undefined)
  }
  assert.equal(eighthNoteHit(notes,64,1),undefined)
})


test('short taps immediately before or after the user turn use the audio clock',()=>{
 const notes=lessons[3].notes
 assert.deepEqual(shortNoteTarget(notes,60,3.9),{bar:1,note:notes[0]})
 assert.deepEqual(shortNoteTarget(notes,62,4.55),{bar:1,note:notes[1]})
 assert.equal(shortNoteTarget(notes,60,3.5),undefined)
 assert.equal(shortNoteTarget(notes,64,5),undefined)
})


test('slides alternate ascent and descent with the same phrase for the response',async()=>{
  for (const index of [5,6]) {
    const lesson=lessons[index]
    const h=harness(); await h.player.start(index)
    const origin=10+4*tutorialBeatSeconds+.05
    for (let round=0;round<4;round++) {
      const notes=tutorialNotes(lesson,round*2)
      assert.equal(notes,tutorialNotes(lesson,round*2+1))
      assert.equal(Math.sign(notes.at(-1).midi-notes[0].midi),round%2?-1:1)
      for (const note of notes) h.tick(origin+(round*8+note.beat)*tutorialBeatSeconds)
    }
    assert.deepEqual(h.notes.map(n=>n[0][0]),[0,2,4,6].flatMap(bar=>tutorialNotes(lesson,bar).map(n=>n.midi)))
    h.player.stop()
  }
})

test('free-pitch lessons use pentatonic examples and judge the nearest rhythm onset',()=>{
  for (const lesson of lessons.slice(7, 9)) {
    assert.equal(lesson.freePitch,true)
    assert.ok(lesson.notes.every(n=>tutorialPentatonic.includes(n.midi)&&n.duration<=.5))
    for (const note of lesson.notes) {
      const target=shortNoteTarget(lesson.notes,72,4+note.beat+.02,true)
      assert.equal(target.note,note)
      assert.equal(target.bar,1)
    }
  }
  const notes=lessons[8].notes
  assert.equal(eighthNoteHit(notes,69,.3,true),notes[1])
  assert.equal(eighthNoteHit(notes,69,1,true),undefined)
  assert.equal(eighthNoteHit(notes,69,0,false),undefined)
})

test('No.8 introduces different pitches with the same rhythm before its longer phrases', () => {
  const lesson = lessons[7]
  const first = tutorialNotes(lesson,0)
  const second = tutorialNotes(lesson,2)
  assert.deepEqual(first.map(note => note.beat), [0,2])
  assert.deepEqual(second.map(note => note.beat), [0,2])
  assert.ok([...first,...second].every(note => note.duration === 1))
  assert.equal(shortNoteTarget(first,72,4.05,true)?.note,first[0])
  assert.notDeepEqual(first.map(note => note.midi), second.map(note => note.midi))
  assert.equal(tutorialNotes(lesson,1), first)
  assert.equal(tutorialNotes(lesson,3), second)
  assert.ok([...first,...second].every(note => tutorialPentatonic.includes(note.midi)))
  assert.equal(tutorialNotes(lesson,4).length, 5)
})


test('No.7 slide requires each note in order and near the expected beat', () => {
  for (const bar of [0,2,4,6]) {
    const notes = tutorialNotes(lessons[6],bar)
    let matched = 0
    assert.equal(matchSlideNote(notes,matched,notes[0].midi,-.31),0)
    assert.equal(matchSlideNote(notes,matched,notes[0].midi,.31),0)
    assert.equal(matchSlideNote(notes,matched,notes.at(-1).midi,0),0)
    for (const note of notes) matched = matchSlideNote(notes,matched,note.midi,note.beat + .1)
    assert.equal(matched,notes.length)
    let rushed = 0
    for (const note of notes) rushed = matchSlideNote(notes,rushed,note.midi,0)
    assert.ok(rushed < notes.length)
  }
})


test('final lesson changes to melodic rhythms after four bars', () => {
  const lesson = lessons[8]
  assert.equal(lesson.title, '自分だけのメロディ')
  assert.equal(tutorialNotes(lesson, 0), tutorialNotes(lesson, 1))
  assert.equal(tutorialNotes(lesson, 4), tutorialNotes(lesson, 5))
  assert.equal(tutorialNotes(lesson, 6), tutorialNotes(lesson, 7))
  assert.notDeepEqual(tutorialNotes(lesson, 0).map(note => note.beat), tutorialNotes(lesson, 4).map(note => note.beat))
  for (const bar of [4,6]) {
    for (const note of tutorialNotes(lesson, bar)) {
      assert.ok(tutorialPentatonic.includes(note.midi))
      assert.ok(note.beat + note.duration <= 4)
      assert.equal(shortNoteTarget(tutorialNotes(lesson, bar), 60, (bar + 1) * 4 + note.beat, true)?.note, note)
    }
  }
})


test('No.8 accepts every white key including F and B', () => {
  for (const midi of [60,62,64,65,67,69,71,72]) assert.equal(isTutorialFreePitch(7,midi),true)
  assert.equal(isTutorialFreePitch(7,61),false)
  assert.equal(isTutorialFreePitch(8,65),true)
  assert.equal(isTutorialFreePitch(8,71),true)
})

test('No.7 plays each rhythm ascending and descending before switching', () => {
  for (const bar of [0,2]) {
    const notes = tutorialNotes(lessons[6],bar)
    assert.deepEqual(notes.map(note => note.beat), [0,.5,1,1.5,2,2.25,2.5,2.75])
    assert.deepEqual(notes.map(note => note.duration), [.5,.5,.5,.5,.25,.25,.25,.25])
  }
  for (const bar of [4,6]) {
    const notes = tutorialNotes(lessons[6],bar)
    assert.deepEqual(notes.map(note => note.beat), [0,.25,.5,.75,1,1.5,2,2.5])
    assert.deepEqual(notes.map(note => note.duration), [.25,.25,.25,.25,.5,.5,.5,.5])
  }
})


test('No.8 plays ラ・ミ in bar 3 and ends bar 7 with a held ド', () => {
  const lesson = lessons[7]
  assert.deepEqual(tutorialNotes(lesson,2).map(note => note.midi), [69,64])
  const phrase = tutorialNotes(lesson,6)
  assert.deepEqual(phrase.map(note => note.midi), [67,64,62,60,60])
  assert.equal(phrase.at(-1).duration,1)
  assert.equal(tutorialNotes(lesson,7),phrase)
})


test('No.8 releases the first repeated C before playing it again', async () => {
  const h = harness()
  await h.player.start(7)
  const origin = 10 + 4 * tutorialBeatSeconds + .05
  for (const note of tutorialNotes(lessons[7],6)) h.tick(origin + (24 + note.beat) * tutorialBeatSeconds)
  const repeated = h.notes.filter(event => event[0][0] === 60 && event[1] >= origin + 24 * tutorialBeatSeconds)
  assert.equal(repeated.length,2)
  assert.ok(repeated[0][1] + repeated[0][2] < repeated[1][1])
  assert.equal(repeated[1][2],tutorialBeatSeconds)
  h.player.stop()
})


test('continuous played intervals draw as one segment while gaps remain visible', () => {
  assert.deepEqual(mergePlayedSegments([
    {start:.5,end:.75}, {start:0,end:.25}, {start:.25,end:.5},
    {start:1,end:1.2}, {start:1.1,end:1.4},
  ]), [{start:0,end:.75},{start:1,end:1.4}])
})


test('No.9 has the requested phrases in bars 1, 3 and 7', () => {
  const lesson = lessons[8]
  assert.deepEqual(tutorialNotes(lesson,0).map(note=>note.midi),[60,64,64,62,60,64])
  assert.deepEqual(tutorialNotes(lesson,2).map(note=>note.midi),[67,69,67,69,67,60])
  const last = tutorialNotes(lesson,6)
  assert.deepEqual(last.map(note=>note.midi),[60,62,64,62,60])
  assert.deepEqual(last.map(note=>note.beat),[0,.5,1,2,2.5])
  assert.deepEqual(last.map(note=>note.duration),[.5,.5,1,.5,1.5])
})


test('session schedules eight calls and replies over sixteen bars', async () => {
  const h = harness()
  await h.player.start(9)
  const origin = 10 + 4 * tutorialBeatSeconds + .05
  const rhythms = new Set()
  for (let round = 0; round < 8; round++) {
    const phrase = tutorialNotes(lessons[9],round * 2)
    assert.equal(phrase,tutorialNotes(lessons[9],round * 2 + 1))
    rhythms.add(phrase.map(note=>note.beat).join(','))
    for (const note of phrase) h.tick(origin + (round * 8 + note.beat) * tutorialBeatSeconds)
    h.tick(origin + (round * 8 + 4.01) * tutorialBeatSeconds)
    assert.equal(h.states.at(-1).phase,'you')
    assert.equal(h.states.at(-1).bar,round * 2 + 1)
  }
  assert.equal(rhythms.size,8)
  const finalNote = tutorialNotes(lessons[9],15).at(-1)
  assert.equal(finalNote.duration,2)
  assert.deepEqual(shortNoteTarget([finalNote],60,62,true,16),{bar:15,note:finalNote})
  assert.equal(recordTutorialSuccess(new Set(),15,true,16),true)
  h.tick(origin + 64 * tutorialBeatSeconds)
  assert.equal(h.states.at(-1).phase,'complete')
})
