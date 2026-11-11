/** @typedef {{beat:number,midi:number,duration:number}} TutorialNote */
/** @typedef {{title:string,messages:readonly string[],notes:readonly TutorialNote[],patterns?:readonly (readonly TutorialNote[])[],freePitch?:boolean}} TutorialLesson */
/** @typedef {{phase:'idle'|'loading'|'countdown'|'otto'|'you'|'complete'|'error',beat:number,bar:number,error:string}} TutorialState */
/** @typedef {{ready:()=>Promise<void>,context?:{currentTime:number},playAt:(notes:readonly number[],time:number,duration:number,level?:number)=>void,silence:()=>void}} TutorialVoice */

/** @typedef {{ready:()=>Promise<void>,context?:{currentTime:number},playAt:(notes:readonly number[],time:number,duration:number,level?:number,bassMidi?:number)=>void,silence:()=>void}} TutorialAccompaniment */

/** @param {readonly number[]} pitches @param {number} spacing */
const slide = (pitches,spacing) => pitches.map((midi,i)=>({beat:i*spacing,midi,duration:.25}))
const fifthUp = slide([60,62,64,65,67],.5)
const fifthDown = slide([67,65,64,62,60],.5)
const octaveUp = slide([60,62,64,65,67,69,71,72],.375)
const octaveDown = slide([72,71,69,67,65,64,62,60],.375)
/** @param {readonly number[]} beats */
const rhythm = beats => beats.map((beat,i)=>({beat,midi:[60,64,67,69,62,72][i%6],duration:.25}))
export const tutorialPentatonic = [60,62,64,67,69,72]

/** @type {readonly TutorialLesson[]} */
export const lessons = [
  { title: 'ドをひとつ', messages: ['こんにちは、Ottoだよ。一緒に弾こう！', 'ぼくが「ド」を弾いたら、次はあなたの番。下の「ド」を2拍、伸ばしてみよう。', 'お手本と真似を4回くり返すよ。'], notes: [{beat:0,midi:60,duration:2}] },
  { title: 'ドからレへ', messages: ['2つの音を行ったり来たりしよう。', '「ド・レ」。指をひとつ、右に動かしてね。'], notes: [{beat:0,midi:60,duration:1},{beat:2,midi:62,duration:1}] },
  { title: 'ド・レ・ミ', messages: ['音の階段をのぼってみよう。', '「ド・レ・ミ」。あわてず、ひとつずつ。'], notes: [{beat:0,midi:60,duration:.5},{beat:1,midi:62,duration:.5},{beat:2,midi:64,duration:1.5}] },
  { title: '短く、長く', messages: ['短い音と、長い音をつなげよう。', '「ド・レ・ミー」。最後のミを長めにね。'], notes: [{beat:0,midi:60,duration:.35},{beat:.5,midi:62,duration:.35},{beat:1,midi:64,duration:2}] },
  { title: '小さなメロディ', messages: ['最後は、ここまでの音をつないだメロディ！', '「ド・ミ・レ・ド」。4回やりとりできたらゴールだよ。'], notes: [{beat:0,midi:60,duration:.7},{beat:1,midi:64,duration:.7},{beat:2,midi:62,duration:.7},{beat:3,midi:60,duration:.8}] },
  { title: 'ドからソへスライド', messages: ['指やマウスを押したまま、ドからソまで滑らせてみよう。', '途中のレ・ミ・ファも通るよ。上ったら、次はソからドへ下ろそう。', 'ぼくと交代で、上り・下りを2回ずつやってみよう！'], notes:fifthUp, patterns:[fifthUp,fifthDown] },
  { title: '高いドまでスライド', messages: ['今度はドから高いドまで、ひと息でスライド！', '次は高いドから低いドへ。白い鍵盤をなぞって、下りも楽しもう。', 'ぼくの速さを聴いて、上り・下りを交代でやってみよう！'], notes:octaveUp, patterns:[octaveUp,octaveDown] },
  { title: '好きな音でリズム', freePitch:true, messages: ['ここからは、音を自分で選んでみよう！', '鍵盤はド・レ・ミ・ソ・ラのペンタトニック。どれを押しても、この伴奏と一緒に楽しめるよ。', 'ぼくのリズムだけまねしてね。音の高さは同じでも、変えてもいいよ！'], notes:rhythm([0,2]) },
  { title: 'リズムにのって遊ぼう', freePitch:true, messages: ['次は1拍ずつ、好きな音で遊ぼう。', 'ド・レ・ミ・ソ・ラから自由に選んでね。同じ音を続けてもいいよ。', '音は自由、タイミングはぼくのリズムに合わせよう！'], notes:rhythm([0,1,2,3]) },
  { title: '自分だけのメロディ', freePitch:true, messages: ['最後は短い音も混ぜて、自分だけのメロディ！', 'ぼくのリズムに合わせて、ペンタトニックの好きな音を弾こう。', '4回できたら、フリー演奏でも自由にわちゃわちゃ遊んでみよう！'], notes:rhythm([0,.5,1.5,2,3,3.5]) },
]

/** The Otto bar and following user bar share the same phrase.
 * @param {TutorialLesson} lesson @param {number} bar */
export function tutorialNotes(lesson,bar) {
  return lesson.patterns?.[Math.floor(Math.max(0,Math.min(7,bar))/2)%lesson.patterns.length] ?? lesson.notes
}

/** Snap a near-onset response to the beginning of the displayed note. */
/** @param {number} start @param {number} noteBeat */
export function displayedResponseStart(start, noteBeat) {
  return start >= noteBeat && start - noteBeat <= .12 ? noteBeat : start
}

/** Find a short note (up to an eighth note) hit close to its onset.
 * @param {readonly TutorialNote[]} notes @param {number} midi @param {number} beat @param {boolean} [anyPitch] */
export function eighthNoteHit(notes, midi, beat, anyPitch = false) {
  return notes.filter(note => (anyPitch || note.midi === midi) && note.duration <= .5 + .001 && Math.abs(note.beat - beat) <= .35)
    .sort((a,b)=>Math.abs(a.beat-beat)-Math.abs(b.beat-beat))[0]
}

/** Resolve a short-note tap to the nearest user turn, including just before its first beat.
 * @param {readonly TutorialNote[]} notes @param {number} midi @param {number} absoluteBeat @param {boolean} [anyPitch] */
export function shortNoteTarget(notes, midi, absoluteBeat, anyPitch = false) {
  for (const bar of [1,3,5,7]) {
    const note = eighthNoteHit(notes,midi,absoluteBeat-bar*4,anyPitch)
    if (note) return {bar,note}
  }
  return undefined
}

/** Whether the displayed yellow segments cover every note in the response bar.
 * @param {readonly TutorialNote[]} notes
 * @param {readonly {bar:number,midi:number,start:number,end:number}[]} played
 * @param {number} bar */
export function responseComplete(notes, played, bar) {
  return notes.length > 0 && notes.every(note => {
    const end = note.beat + note.duration
    const segments = played.filter(p => p.bar === bar && p.midi === note.midi && p.end > note.beat && p.start < end)
      .map(p => ({start: displayedResponseStart(p.start,note.beat), end:p.end}))
      .sort((a,b) => a.start-b.start)
    let covered = note.beat
    for (const segment of segments) {
      if (segment.start > covered + .001) break
      covered = Math.max(covered,segment.end)
    }
    return covered >= end - .001
  })
}

/** Register each successful response only once per lesson run.
 * @param {Set<number>} successes @param {number} bar @param {boolean} complete */
export function recordTutorialSuccess(successes, bar, complete) {
  if (!complete || bar < 1 || bar > 7 || bar % 2 !== 1 || successes.has(bar)) return false
  successes.add(bar)
  return true
}

// Four bars, two beats per chord; repeat across all eight lesson bars.
export const lessonThreeChords = [
  {name:'C',notes:[60,64,67],bass:36},
  {name:'G/B',notes:[59,62,67],bass:35},
  {name:'Am7',notes:[60,64,67,69],bass:33},
  {name:'G',notes:[59,62,67],bass:31},
  {name:'FM7',notes:[60,64,65,69],bass:29},
  {name:'Em7',notes:[59,62,64,67],bass:28},
  {name:'Dm7',notes:[57,60,62,65],bass:38},
  {name:'G',notes:[59,62,67],bass:31},
]

export const tutorialBeatSeconds = 60 / 80

/**
 * Owns the lesson clock and scheduled Otto notes. The view owns dialogue and user input.
 * beat is relative to the first Otto bar; the four-beat count-in is negative.
 * @param {{voice:TutorialVoice,onUpdate:(state:TutorialState)=>void,accompaniment?:TutorialAccompaniment,setTimer?:(callback:()=>void,ms:number)=>number,clearTimer?:(id:number)=>void}} options
 */
export function createTutorialPlayer({voice,onUpdate,accompaniment,setTimer = (callback,ms) => globalThis.setInterval(callback,ms),clearTimer = id => globalThis.clearInterval(id)}) {
  let generation = 0
  /** @type {number|undefined} */
  let origin
  /** @type {number|undefined} */
  let timer
  /** @param {TutorialState['phase']} phase @param {number} [beat] @param {string} [error] */
  const publish = (phase,beat = 0,error = '') => onUpdate({phase,beat,bar:Math.max(0,Math.min(8,Math.floor(beat / 4))),error})
  function cancel() {
    generation++
    origin = undefined
    if (timer !== undefined) clearTimer(timer)
    timer = undefined
    voice.silence()
    accompaniment?.silence()
  }
  function stop() { cancel(); publish('idle') }
  /** @param {number} index */
  async function start(index) {
    cancel()
    const token = generation
    const lesson = lessons[index]
    if (!Number.isInteger(index) || !lesson) { publish('error',0,'チュートリアルを選び直してください。'); return }
    publish('loading')
    try {
      await Promise.all([voice.ready(), accompaniment?.ready()])
      if (token !== generation) return
      if (!voice.context) throw new Error('音声を開始できませんでした。もう一度スタートを押してください。')
      const startTime = voice.context.currentTime + 4 * tutorialBeatSeconds + .05
      origin = startTime
      const events = Array.from({length:4}, (_, round) => {
        const phrase = tutorialNotes(lesson, round * 2)
        return phrase.map((note, noteIndex) => {
          const next = phrase[noteIndex + 1]
          // Keep the mono voice held until the next key takes over.
          const duration = lesson.patterns && next
            ? (next.beat - note.beat) * tutorialBeatSeconds + .01
            : note.duration * tutorialBeatSeconds
          return {midi:note.midi, time:startTime + (round * 8 + note.beat) * tutorialBeatSeconds, duration}
        })
      }).flat()
      const backing = Array.from({length:36},(_,i) => ({beat:i-4,time:startTime+(i-4)*tutorialBeatSeconds}))
      let backingCursor = 0
      let cursor = 0
      const tick = () => {
        if (token !== generation || !voice.context) return
        try {
          const now = voice.context.currentTime
          const beat = Math.max(-4,(now - startTime) / tutorialBeatSeconds)
          if (now >= startTime + 32 * tutorialBeatSeconds) { cancel(); publish('complete',32); return }
          while (backingCursor < backing.length && backing[backingCursor].time < now + .12) {
            const event = backing[backingCursor++]
            if (event.time >= now - .08 && accompaniment) {
              if (event.beat < 0) accompaniment.playAt([event.beat === -4 ? 84 : 79],event.time,.12,.45)
              else if (index === 1) {
                const chord = lessonThreeChords[Math.floor(event.beat / 2) % lessonThreeChords.length]
                accompaniment.playAt(chord.notes,event.time,.35,event.beat % 4 === 0 ? .32 : .18,chord.bass)
              } else accompaniment.playAt(event.beat % 4 === 0 ? [48,60,64,67] : [60,64,67],event.time,.35,event.beat % 4 === 0 ? .32 : .18)
            }
          }
          while (cursor < events.length && events[cursor].time < now + .12) {
            const event = events[cursor++]
            // After a suspended/background clock, skip missed notes instead of a burst.
            if (event.time >= now - .08) voice.playAt([event.midi],event.time,event.duration,.75)
          }
          publish(beat < 0 ? 'countdown' : Math.floor(beat / 4) % 2 === 0 ? 'otto' : 'you',beat)
        } catch (error) {
          cancel()
          publish('error',0,error instanceof Error ? error.message : '音声を再生できませんでした。もう一度スタートを押してください。')
        }
      }
      timer = setTimer(tick,25)
      tick()
    } catch (error) {
      if (token !== generation) return
      cancel()
      publish('error',0,error instanceof Error ? error.message : '音声を開始できませんでした。もう一度スタートを押してください。')
    }
  }
  return {start,stop, currentBeat:()=>origin !== undefined && voice.context ? (voice.context.currentTime-origin)/tutorialBeatSeconds : undefined}
}
