import test from 'node:test'
import assert from 'node:assert/strict'
import {advancedStart,lessons,createTutorialPlayer,tutorialBeatSeconds,displayedResponseStart,displayedResponseEnd,mergePlayedSegments,responseComplete,lessonThreeChords,melodyThreeBarChords,recordTutorialSuccess,eighthNoteHit,shortNoteTarget,tutorialNotes,tutorialPentatonic,matchSlideNote,isTutorialFreePitch} from '../dist/tutorial.js'

test('No.1 switches from a two-beat C to a two-beat E for both call and response', () => {
  for (let bar = 0; bar < 8; bar++) {
    assert.deepEqual(tutorialNotes(lessons[0], bar), [{beat:0, midi:bar < 4 ? 60 : 64, duration:2}])
  }
})

function harness(ready = async () => {}) {
  const states = [], notes = [], timers = new Map()
  let id = 0, silenced = 0
  const context = {currentTime:10}
  const voice = {context,ready,playAt:(...args)=>notes.push(args),silence:()=>silenced++}
  const player = createTutorialPlayer({voice,onUpdate:s=>states.push(s),setTimer:cb=>{timers.set(++id,cb);return id},clearTimer:id=>timers.delete(id)})
  return {player,voice,context,states,notes,timers,get silenced(){return silenced},tick(time){context.currentTime=time;for(const cb of timers.values())cb()}}
}

test('tutorial lessons fit a one-octave keyboard and four-beat bars',()=>{
  assert.equal(lessons.length - advancedStart,5)
  assert.equal(lessons.at(-1).title,'春の小川')
  for(const lesson of lessons) {
    assert.ok(lesson.messages.length > 0)
    assert.ok(lesson.notes.length)
    for(const note of Array.from({length:lesson.session ? 16 : 8}, (_,bar)=>tutorialNotes(lesson,bar)).flat()) {
      assert.ok(note.midi>=60 && note.midi<=72)
      assert.ok(note.beat>=0 && note.duration>0 && note.beat+note.duration<=4)
    }
  }
})

test('Mary starts with a dotted rhythm and Otto separates repeated notes', async () => {
  const h = harness()
  await h.player.start(advancedStart + 2)
  const origin = 10 + 4*tutorialBeatSeconds + .05
  for (let beat = 0; beat < 4; beat += .125) h.tick(origin + beat*tutorialBeatSeconds)
  const [first, second, , , repeatedFirst, repeatedSecond] = h.notes
  assert.equal(first[0][0],66)
  assert.equal(second[0][0],64)
  assert.ok(Math.abs(second[1] - first[1] - .75*tutorialBeatSeconds) < 1e-9)
  assert.equal(repeatedFirst[0][0],repeatedSecond[0][0])
  assert.ok(repeatedFirst[1] + repeatedFirst[2] < repeatedSecond[1] - .05)
})

test('advanced songs schedule accompaniment through both turns and resolve to their tonic', async () => {
  for (const [offset, tonic] of [36,36,38,41,36].entries()) {
    const h = harness()
    const backing = []
    const player = createTutorialPlayer({
      voice:h.voice, onUpdate:state=>h.states.push(state),
      accompaniment:{ready:async()=>{}, playAt:(...args)=>backing.push(args), silence:()=>{}},
      setTimer:callback=>{h.timers.set(1,callback);return 1}, clearTimer:()=>h.timers.clear(),
    })
    await player.start(advancedStart + offset)
    const {meter = 4, pickupBeats = 0} = lessons[advancedStart + offset]
    const countIn = meter - pickupBeats
    const turnBeats = meter === 3 ? 12 : 8
    const pulseSeconds = tutorialBeatSeconds
    const origin = 10 + countIn*pulseSeconds + .05
    for (let beat = -countIn; beat < turnBeats*4; beat++) h.tick(origin + beat*pulseSeconds)
    const bass = backing.filter(event=>event[4] !== undefined).map(event=>event[4])
    const clicks = backing.filter(event=>event[0][0] >= 79).map(event=>event[0][0])
    assert.deepEqual(clicks,[84,...Array(countIn-1).fill(79)])
    assert.equal(bass.length,turnBeats*4)
    assert.deepEqual(bass.slice(0,turnBeats),bass.slice(turnBeats,turnBeats*2))
    assert.deepEqual(bass.slice(turnBeats*2,turnBeats*3),bass.slice(turnBeats*3))
    if (offset === 3) {
      const finalPulses = backing.filter(event=>event[4] !== undefined).slice(-12)
      assert.deepEqual(finalPulses.slice(3).map(event=>[event[0],event[4]]), [
        [[57,60,64],45],
        [[58,62,65],46], [[58,62,65],46], [[58,62,65],46],
        [[60,65,69],36], [[60,65,69],36], [[60,64,67],36],
        [[60,65,69],41], [[60,65,69],41],
      ])
    }
    assert.equal(bass.at(-1),tonic)
    assert.ok(new Set(bass).size > 1)
    assert.ok(h.notes.length > 0)
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

test('No.3 uses four phrases for the matching Otto and user turns',()=>{
  const expected = [[60,62,64],[65,64,62],[67,65,64],[64,62,62]]
  expected.forEach((pitches,round)=>{
    const notes = tutorialNotes(lessons[2],round*2)
    assert.deepEqual(notes.map(note=>note.midi),pitches)
    assert.deepEqual(notes.map(note=>[note.beat,note.duration]),[[0,.5],[1,.5],[2,1.5]])
    assert.equal(tutorialNotes(lessons[2],round*2+1),notes)
  })
})

test('No.3 plays the requested chords in each of its eight bars',async()=>{
  const h=harness(), backing=[], timers=new Map(); let id=0
  const accompaniment={context:h.context,ready:async()=>{},playAt:(...args)=>backing.push(args),silence:()=>{}}
  const player=createTutorialPlayer({voice:h.voice,accompaniment,onUpdate:()=>{},setTimer:cb=>{timers.set(++id,cb);return id},clearTimer:id=>timers.delete(id)})
  await player.start(2)
  const origin=10+4*tutorialBeatSeconds+.05
  for(let beat=0;beat<32;beat++) { h.context.currentTime=origin+beat*tutorialBeatSeconds; for(const cb of timers.values())cb() }
  const chords=backing.filter(args=>args[0][0]<79)
  const barIndices=[0,0,1,1,2,2,3,4]
  assert.deepEqual(melodyThreeBarChords.map(chord=>chord.name),['C','Dm7','G/E','F','G'])
  assert.equal(chords.length,32)
  chords.forEach((args,beat)=>{
    const expected=melodyThreeBarChords[barIndices[Math.floor(beat/4)]]
    assert.deepEqual(args[0],expected.notes)
    assert.equal(args[4],expected.bass)
  })
})

test('ドからレへ changes to ド・ミ for both later call and response pairs',()=>{
  for (let bar=0; bar<8; bar++) {
    const notes = tutorialNotes(lessons[1],bar)
    assert.deepEqual(notes.map(note=>note.midi), bar<4 ? [60,62] : [60,64])
    assert.deepEqual(notes.map(note=>[note.beat,note.duration]), [[0,1],[2,1]])
    if (bar%2===1) assert.equal(responseComplete(notes,notes.map(note=>({bar,midi:note.midi,start:note.beat,end:note.beat+note.duration})),bar),true)
  }
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

test('long notes accept the same onset timing as eighth notes',()=>{
  const note={beat:1,midi:64,duration:1}
  assert.equal(shortNoteTarget([note],64,5.3,false,8,true)?.note,note)
  assert.equal(shortNoteTarget([note],64,5.36,false,8,true),undefined)
  assert.equal(shortNoteTarget([note],62,5,false,8,true),undefined)
  const half={beat:1,midi:64,duration:2}
  assert.equal(shortNoteTarget([half],64,5,false,8,true),undefined)
  assert.equal(shortNoteTarget([half],64,5,true,8,true),undefined)
  assert.equal(responseComplete([half],[{bar:1,midi:64,start:1,end:1.1}],1),false)
  assert.equal(responseComplete([half],[{bar:1,midi:64,start:1,end:2.65}],1),true)
})

test('No.4 plays its staccato eighth notes for a sixteenth-note duration',async()=>{
  const notes=lessons[3].notes
  assert.deepEqual(notes.slice(0,2).map(note=>[note.beat,note.duration,note.staccato]),[[0,.25,true],[.5,.25,true]])
  const h=harness()
  await h.player.start(3)
  const origin=10+4*tutorialBeatSeconds+.05
  h.tick(origin)
  h.tick(origin+.5*tutorialBeatSeconds)
  assert.deepEqual(h.notes.slice(0,2).map(event=>event[2]),[.25*tutorialBeatSeconds,.25*tutorialBeatSeconds])
  for(const note of notes.slice(0,2)) assert.equal(shortNoteTarget(notes,note.midi,4+note.beat)?.note,note)
})

test('No.5 presents the opening of Twinkle Twinkle in matching call and response phrases',()=>{
  const expected = [[60,60,67,67],[69,69,67],[65,65,64,64],[62,62,60]]
  for (let round=0;round<4;round++) {
    const bar=Math.floor(round/2)*4+round%2
    const phrase=tutorialNotes(lessons[4],bar)
    assert.deepEqual(phrase.map(note=>note.midi),expected[round])
    assert.deepEqual(tutorialNotes(lessons[4],bar+2),phrase)
    assert.equal(phrase.at(-1).duration,round%2 ? 2 : 1)
  }
})

test('No.5 alternates every two bars and separates quarter notes',async()=>{
  const h=harness(); await h.player.start(4)
  const origin=10+4*tutorialBeatSeconds+.05
  for(let beat=0;beat<32;beat++) h.tick(origin+beat*tutorialBeatSeconds)
  assert.deepEqual(h.notes.map(n=>n[0][0]),[60,60,67,67,69,69,67,65,65,64,64,62,62,60])
  assert.equal(h.notes[0][2],tutorialBeatSeconds*.8)
  assert.equal(h.notes[6][2],tutorialBeatSeconds*2)
  for (const bar of [2,3,6,7]) assert.equal(recordTutorialSuccess(new Set(),bar,true,8,true),true)
  assert.equal(shortNoteTarget(tutorialNotes(lessons[4],2),60,8,false,8,true,true)?.bar,2)
  assert.equal(shortNoteTarget(tutorialNotes(lessons[4],0),60,0,false,8,true,true),undefined)
})

test('No.4 follows No.3 pitches and chord changes with short first notes',async()=>{
  const h=harness(), backing=[], timers=new Map(); let id=0
  const accompaniment={context:h.context,ready:async()=>{},playAt:(...args)=>backing.push(args),silence:()=>{}}
  const player=createTutorialPlayer({voice:h.voice,accompaniment,onUpdate:()=>{},setTimer:cb=>{timers.set(++id,cb);return id},clearTimer:id=>timers.delete(id)})
  await player.start(3)
  const origin=10+4*tutorialBeatSeconds+.05
  for(let beat=0;beat<32;beat+=.5) { h.context.currentTime=origin+beat*tutorialBeatSeconds; for(const cb of timers.values())cb() }
  for(let round=0;round<4;round++) {
    const notes=tutorialNotes(lessons[3],round*2)
    assert.deepEqual(notes.map(note=>note.midi),tutorialNotes(lessons[2],round*2).map(note=>note.midi))
    assert.deepEqual(notes.map(note=>note.duration),[.25,.25,2])
    assert.equal(tutorialNotes(lessons[3],round*2+1),notes)
    assert.deepEqual(h.notes.slice(round*3,round*3+3).map(args=>args[2]),[.25*tutorialBeatSeconds,.25*tutorialBeatSeconds,2*tutorialBeatSeconds])
  }
  const chords=backing.filter(args=>args[0][0]<79)
  for(let bar=0;bar<8;bar++) assert.equal(chords[bar*4][4],melodyThreeBarChords[[0,0,1,1,2,2,3,4][bar]].bass)
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
      const bar=Math.floor(round/2)*4+round%2
      const notes=tutorialNotes(lesson,bar)
      assert.equal(notes,tutorialNotes(lesson,bar+2))
      assert.equal(Math.sign(notes.at(-1).midi-notes[0].midi),round%2?-1:1)
      for (const note of notes) h.tick(origin+(bar*4+note.beat)*tutorialBeatSeconds)
    }
    assert.deepEqual(h.notes.map(n=>n[0][0]),[0,1,4,5].flatMap(bar=>tutorialNotes(lesson,bar).map(n=>n.midi)))
    h.player.stop()
  }
})

test('No.6 and No.7 use FM7, G, Em7, Am7 then Dm7, G, C, CM7',async()=>{
 for (const lessonIndex of [5,6]) {
  const h=harness(), backing=[]
  const accompaniment={ready:async()=>{},playAt:(...args)=>backing.push(args),silence:()=>{}}
  let tick
  const player=createTutorialPlayer({voice:h.voice,accompaniment,onUpdate:()=>{},setTimer:cb=>{tick=cb;return 1},clearTimer:()=>{}})
  await player.start(lessonIndex)
  const origin=10+4*tutorialBeatSeconds+.05
  for(let beat=-4;beat<32;beat++){h.context.currentTime=origin+beat*tutorialBeatSeconds;tick()}
  const chords=backing.slice(4)
  for(let beat=0;beat<32;beat++){
    const bar=Math.floor(beat/4)
    const expected=bar<4 ? lessonThreeChords[[4,3,5,2][bar]] : bar===7 ? {notes:[60,64,67,71],bass:36} : lessonThreeChords[[6,3,0][bar-4]]
    assert.deepEqual(chords[beat][0],expected.notes)
    assert.equal(chords[beat][4],expected.bass)
  }
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
  const second = tutorialNotes(lesson,1)
  assert.deepEqual(first.map(note => note.beat), [0,2])
  assert.deepEqual(second.map(note => note.beat), [0,2])
  assert.ok([...first,...second].every(note => note.duration === 1))
  assert.equal(shortNoteTarget(first,72,4.05,true)?.note,first[0])
  assert.notDeepEqual(first.map(note => note.midi), second.map(note => note.midi))
  assert.equal(tutorialNotes(lesson,2), first)
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
  assert.equal(tutorialNotes(lesson, 0), tutorialNotes(lesson, 2))
  assert.equal(tutorialNotes(lesson, 4), tutorialNotes(lesson, 6))
  assert.equal(tutorialNotes(lesson, 5), tutorialNotes(lesson, 7))
  assert.notDeepEqual(tutorialNotes(lesson, 0).map(note => note.beat), tutorialNotes(lesson, 4).map(note => note.beat))
  for (const bar of [4,5]) {
    for (const note of tutorialNotes(lesson, bar)) {
      assert.ok(tutorialPentatonic.includes(note.midi))
      assert.ok(note.beat + note.duration <= 4)
      assert.equal(shortNoteTarget(tutorialNotes(lesson, bar), 60, (bar + 2) * 4 + note.beat, true, 8, true, true)?.note, note)
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
  assert.deepEqual(tutorialNotes(lesson,1).map(note => note.midi), [69,64])
  const phrase = tutorialNotes(lesson,5)
  assert.deepEqual(phrase.map(note => note.midi), [67,64,62,60,60])
  assert.equal(phrase.at(-1).duration,1)
  assert.equal(tutorialNotes(lesson,7),phrase)
})


test('No.8 releases the first repeated C before playing it again', async () => {
  const h = harness()
  await h.player.start(7)
  const origin = 10 + 4 * tutorialBeatSeconds + .05
  for (const note of tutorialNotes(lessons[7],5)) h.tick(origin + (20 + note.beat) * tutorialBeatSeconds)
  const repeated = h.notes.filter(event => event[0][0] === 60 && event[1] >= origin + 20 * tutorialBeatSeconds)
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
  assert.deepEqual(tutorialNotes(lesson,1).map(note=>note.midi),[67,69,67,69,67,60])
  const last = tutorialNotes(lesson,5)
  assert.deepEqual(last.map(note=>note.midi),[60,62,64,62,60])
  assert.deepEqual(last.map(note=>note.beat),[0,.5,1,2,2.5])
  assert.deepEqual(last.map(note=>note.duration),[.5,.5,1,.5,1.5])
})


test('session schedules two-bar calls and responses over sixteen bars', async () => {
  const h = harness()
  await h.player.start(9)
  const origin = 10 + 4 * tutorialBeatSeconds + .05
  const rhythms = new Set()
  for (let round = 0; round < 4; round++) {
    for (let offset = 0; offset < 2; offset++) {
      const bar = round * 4 + offset
      const phrase = tutorialNotes(lessons[9],bar)
      assert.equal(phrase,tutorialNotes(lessons[9],bar + 2))
      rhythms.add(phrase.map(note=>note.beat).join(','))
      for (const note of phrase) h.tick(origin + (bar * 4 + note.beat) * tutorialBeatSeconds)
    }
    h.tick(origin + (round * 16 + 8.01) * tutorialBeatSeconds)
    assert.equal(h.states.at(-1).phase,'you')
  }
  assert.equal(rhythms.size,8)
  h.tick(origin + 64 * tutorialBeatSeconds)
  assert.equal(h.states.at(-1).phase,'complete')
})

test('sustained notes accept a slightly early release without filling larger gaps', () => {
  assert.equal(displayedResponseEnd(1.88, 2, 2), 2)
  assert.equal(displayedResponseEnd(1.65, 2, 2), 2)
  assert.equal(displayedResponseEnd(1.64, 2, 2), 1.64)
  assert.equal(displayedResponseEnd(.525, .7, .7), .7)
  assert.equal(displayedResponseEnd(.52, .7, .7), .52)
  assert.equal(displayedResponseEnd(.4, .5, .5), .4)
  assert.equal(responseComplete([{beat:0,midi:60,duration:2}], [{bar:1,midi:60,start:0,end:1.88}], 1), true)
  assert.equal(responseComplete([{beat:0,midi:60,duration:2}], [{bar:1,midi:60,start:0,end:1.65}], 1), true)
  assert.equal(responseComplete([{beat:0,midi:60,duration:2}], [{bar:1,midi:60,start:0,end:1.64}], 1), false)
  assert.equal(responseComplete([{beat:0,midi:60,duration:.7}], [{bar:1,midi:60,start:0,end:.525}], 1), true)
})

test('moving lessons to different indices preserves their playback', async () => {
  const original = lessons.slice()
  async function trace(lesson) {
    const h = harness()
    const backing = []
    const player = createTutorialPlayer({
      voice:h.voice,onUpdate:state=>h.states.push(state),
      accompaniment:{ready:async()=>{},playAt:(...args)=>backing.push(args),silence:()=>{}},
      setTimer:cb=>{h.timers.set(1,cb);return 1},clearTimer:()=>h.timers.clear(),
    })
    const index = lessons.indexOf(lesson)
    await player.start(index, lesson.session ? 1 : 0, lesson.settings?.tempo)
    for (let i = 0; i < 1500 && h.timers.size; i++) h.tick(10 + i * .05)
    return {notes:h.notes,backing,states:h.states,freePitch:isTutorialFreePitch(index,65)}
  }
  const expected = []
  for (const lesson of original) expected.push(await trace(lesson))
  try {
    lessons.reverse()
    for (const [i,lesson] of original.entries()) assert.deepEqual(await trace(lesson),expected[i],lesson.title)
  } finally {
    lessons.splice(0,lessons.length,...original)
  }
})
