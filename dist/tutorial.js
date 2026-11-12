/** @typedef {{beat:number,midi:number,duration:number,staccato?:boolean}} TutorialNote */
/** @typedef {{title:string,messages:readonly string[],notes:readonly TutorialNote[],patterns?:readonly (readonly TutorialNote[])[],freePitch?:boolean,session?:boolean,keySignature?:string,chords?:readonly (readonly TutorialChordName[])[],flatNotes?:boolean,meter?:3,pickupBeats?:1|3,earlyPhrases?:readonly (readonly TutorialNote[])[],laterPhrases?:readonly (readonly TutorialNote[])[]}} TutorialLesson */

// Development navigation is scoped to the current tab.
const developmentScreen = typeof location !== 'undefined' && ['localhost', '127.0.0.1'].includes(location.hostname)
/** @param {string} key */
export function readDevelopmentScreen(key) {
  if (!developmentScreen) return null
  try { return sessionStorage.getItem(`oto-dev-${key}`) } catch { return null }
}
/** @param {string} key @param {string} value */
export function saveDevelopmentScreen(key, value) {
  if (!developmentScreen) return
  try { sessionStorage.setItem(`oto-dev-${key}`, value) } catch { /* Storage is optional. */ }
}
/** @typedef {{phase:'idle'|'loading'|'countdown'|'otto'|'you'|'complete'|'error',beat:number,bar:number,error:string}} TutorialState */
/** @typedef {{ready:()=>Promise<void>,context?:{currentTime:number},playAt:(notes:readonly number[],time:number,duration:number,level?:number)=>void,silence:()=>void}} TutorialVoice */

/** @typedef {{ready:()=>Promise<void>,context?:{currentTime:number},playAt:(notes:readonly number[],time:number,duration:number,level?:number,bassMidi?:number,pulseSeconds?:number)=>void,silence:()=>void}} TutorialAccompaniment */

/** @param {readonly number[]} pitches @param {number} spacing */
const slide = (pitches,spacing) => pitches.map((midi,i)=>({beat:i*spacing,midi,duration:.25}))
const fifthUp = slide([60,62,64,65,67],.5).map((note,index)=>({...note,duration:index === 4 ? 1 : .5}))
const fifthDown = slide([67,65,64,62,60],.5).map((note,index)=>({...note,duration:index === 4 ? 1 : .5}))
const octaveRhythm = [0,.25,.5,.75,1,1.5,2,2.5]
const octaveUpRhythm = [0,.5,1,1.5,2,2.25,2.5,2.75]
const octaveUp = [60,62,64,65,67,69,71,72].map((midi,i)=>({beat:octaveUpRhythm[i],midi,duration:i < 4 ? .5 : .25}))
const octaveDown = [72,71,69,67,65,64,62,60].map((midi,i)=>({beat:octaveUpRhythm[i],midi,duration:i < 4 ? .5 : .25}))
const octaveUpFast = [60,62,64,65,67,69,71,72].map((midi,i)=>({beat:octaveRhythm[i],midi,duration:i < 4 ? .25 : .5}))
const octaveDownFast = [72,71,69,67,65,64,62,60].map((midi,i)=>({beat:octaveRhythm[i],midi,duration:i < 4 ? .25 : .5}))
/** @param {readonly number[]} beats */
const rhythm = beats => beats.map((beat,i)=>({beat,midi:[60,64,67,69,62,72][i%6],duration:.25}))
export const tutorialPentatonic = [60,62,64,67,69,72]

/** @param {number} lessonIndex @param {number} midi */
export function isTutorialFreePitch(lessonIndex, midi) {
  return (lessonIndex === 7 || lessonIndex === 8) && [60,62,64,65,67,69,71,72].includes(midi)
}

// One call per two-bar exchange, mostly starting on beat one.
/** @param {number} bar */
export const isSessionSlide = bar => [2,5].includes(Math.floor(Math.max(0,Math.min(15,bar))/4)*2 + bar%2)

const sessionPhrases = [
  rhythm([0,1,2,3]), rhythm([0,1,2.5,3]),
  slide([60,62,64,65,67],.5), rhythm([0,1.5,2,3]),
  rhythm([0,.5,1,2]), slide([67,65,64,62,60],.5),
  rhythm([0,1,2,3.5]), rhythm([0,1,2]),
].map((phrase,round) => phrase.map((note,index) => ({
  ...note,
  beat:note.beat + (round === 5 ? .5 : 0),
  midi:[2,5].includes(round) ? note.midi : tutorialPentatonic[(round + index * (round % 2 ? 5 : 1)) % 6],
  duration:[2,5].includes(round) ? .5 : round === 0 ? 1
    : round === 6 && index === 2 ? 1 : round === 7 && index === 2 ? 2 : Math.min(.5, (phrase[index+1]?.beat ?? 4) - note.beat),
})))

/** @type {TutorialLesson[]} */
export const lessons = [
  { title: 'ドをひとつ', messages: ['チュートリアルへようこそ！メロディを一緒に弾いてみよう', 'これがきみのけんばん。タップして音を鳴らしてみて。', 'ここに演奏するタイミングと音が表示されるよ。', '最初に僕がお手本を弾いて、その後にきみが弾くを4回繰り返すよ。'], notes: [{beat:0,midi:60,duration:2}], laterPhrases: [[{beat:0,midi:64,duration:2}],[{beat:0,midi:64,duration:2}]] },
  { title: 'ドからレへ', messages: ['2つの音を行ったり来たりしよう。', '「ド・レ」。後半は「ド・ミ」に変わるよ。'], notes: [{beat:0,midi:60,duration:1},{beat:2,midi:62,duration:1}], laterPhrases: [[{beat:0,midi:60,duration:1},{beat:2,midi:64,duration:1}],[{beat:0,midi:60,duration:1},{beat:2,midi:64,duration:1}]] },
  { title: 'ド・レ・ミ', messages: ['音の階段をのぼったり、おりたりしよう。', '3つの音を、あわてずひとつずつ弾いてみよう。'], notes: [{beat:0,midi:60,duration:.5},{beat:1,midi:62,duration:.5},{beat:2,midi:64,duration:1.5}], earlyPhrases: [
    [{beat:0,midi:60,duration:.5},{beat:1,midi:62,duration:.5},{beat:2,midi:64,duration:1.5}],
    [{beat:0,midi:65,duration:.5},{beat:1,midi:64,duration:.5},{beat:2,midi:62,duration:1.5}],
  ], laterPhrases: [
    [{beat:0,midi:67,duration:.5},{beat:1,midi:65,duration:.5},{beat:2,midi:64,duration:1.5}],
    [{beat:0,midi:64,duration:.5},{beat:1,midi:62,duration:.5},{beat:2,midi:62,duration:1.5}],
  ] },
  { title: '短く、長く', messages: ['短い音と、長い音をつなげよう。', '最初の2つは思いっきり短く、最後の音はゆったり長めにひこうね。'], notes: [{beat:0,midi:60,duration:.25,staccato:true},{beat:.5,midi:62,duration:.25,staccato:true},{beat:1,midi:64,duration:2}], earlyPhrases: [
    [{beat:0,midi:60,duration:.25,staccato:true},{beat:.5,midi:62,duration:.25,staccato:true},{beat:1,midi:64,duration:2}],
    [{beat:0,midi:65,duration:.25,staccato:true},{beat:.5,midi:64,duration:.25,staccato:true},{beat:1,midi:62,duration:2}],
  ], laterPhrases: [
    [{beat:0,midi:67,duration:.25,staccato:true},{beat:.5,midi:65,duration:.25,staccato:true},{beat:1,midi:64,duration:2}],
    [{beat:0,midi:64,duration:.25,staccato:true},{beat:.5,midi:62,duration:.25,staccato:true},{beat:1,midi:62,duration:2}],
  ] },
  { title: 'きらきら星', messages: ['きらきら星を一緒に弾いてみよう！', 'ぼくのお手本を聴いて、同じフレーズを弾いてね。'], notes: [{beat:0,midi:60,duration:1},{beat:1,midi:60,duration:1},{beat:2,midi:67,duration:1},{beat:3,midi:67,duration:1}], earlyPhrases: [
    [{beat:0,midi:60,duration:1},{beat:1,midi:60,duration:1},{beat:2,midi:67,duration:1},{beat:3,midi:67,duration:1}],
    [{beat:0,midi:69,duration:1},{beat:1,midi:69,duration:1},{beat:2,midi:67,duration:2}],
  ], laterPhrases: [
    [{beat:0,midi:65,duration:1},{beat:1,midi:65,duration:1},{beat:2,midi:64,duration:1},{beat:3,midi:64,duration:1}],
    [{beat:0,midi:62,duration:1},{beat:1,midi:62,duration:1},{beat:2,midi:60,duration:2}],
  ] },
  { title: 'ドからソへスライド', messages: ['指やマウスを押したまま、ドからソまで滑らせてみよう。', '途中のレ・ミ・ファも通るよ。上ったら、次はソからドへ下ろそう。', 'ぼくと2小節ずつ交代で、上り・下りをやってみよう！'], notes:fifthUp, patterns:[fifthUp,fifthDown] },
  { title: '高いドまでスライド', messages: ['今度はドから高いドまで、ひと息でスライド！', '次は高いドから低いドへ。白い鍵盤をなぞって、下りも楽しもう。', 'ぼくの速さを聴いて、上り・下りを交代でやってみよう！'], notes:octaveUp, patterns:[octaveUp,octaveDown,octaveUpFast,octaveDownFast] },
  { title: '好きな音でリズム', freePitch:true, messages: ['ここからは、好きな白い鍵盤を選んで弾いてみよう。Ottoと同じ音じゃなくていいよ！', 'バーの始まりに合わせて弾こう。バーが長いときは音を伸ばしたり、指を滑らせて音を変えたりしてみよう！'], notes:rhythm([0,2]), earlyPhrases:[
    [{beat:0,midi:60,duration:1},{beat:2,midi:67,duration:1}],
    [{beat:0,midi:69,duration:1},{beat:2,midi:64,duration:1}],
  ], laterPhrases:[
    [60,62,64,60,67].map((midi,i)=>({beat:i*.5,midi,duration:.5})),
    [67,64,62,60,60].map((midi,i)=>({beat:i*.5,midi,duration:i === 4 ? 1 : .5})),
  ] },
  { title: '自分だけのメロディ', freePitch:true, messages: ['最後は短い音も混ぜて、自分だけのメロディ！', 'ぼくのリズムに合わせて、好きな白い鍵盤を弾こう。', '5小節目からは、スライドも使ってみよう！'], notes:rhythm([0,.5,1.5,2,3,3.5]), earlyPhrases:[
    [{beat:0,midi:60,duration:.25},{beat:.5,midi:64,duration:.25},{beat:1.5,midi:64,duration:.25},{beat:2,midi:62,duration:.25},{beat:3,midi:60,duration:.25},{beat:3.5,midi:64,duration:.25}],
    [{beat:0,midi:67,duration:.25},{beat:.5,midi:69,duration:.25},{beat:1.5,midi:67,duration:.25},{beat:2,midi:69,duration:.25},{beat:3,midi:67,duration:.25},{beat:3.5,midi:60,duration:.25}],
  ], laterPhrases:[
    [{beat:0,midi:64,duration:.5},{beat:.5,midi:67,duration:.5},{beat:1,midi:69,duration:1},{beat:2.5,midi:67,duration:.5},{beat:3,midi:64,duration:1}],
    [{beat:0,midi:60,duration:.5},{beat:.5,midi:62,duration:.5},{beat:1,midi:64,duration:1},{beat:2,midi:62,duration:.5},{beat:2.5,midi:60,duration:1.5}],
  ] },
  {title:'Ottoとセッション',session:true,freePitch:true,notes:sessionPhrases[0],
    messages:['ドラム、ベース、コードの伴奏に乗って、Ottoと16小節のセッション！','2小節ずつ交代で弾こう。ナビのリズムに合わせて弾いてみよう！']},
]

/** @typedef {'C'|'G7'|'F'|'F/C'|'Am'|'C7'|'Bb'|'D'|'G'|'A7'|'Dm'|'Em'|'E5'} TutorialChordName */

/** @type {Record<TutorialChordName,{notes:number[],bass:number}>} */
const songChords = {
  C: {notes:[60,64,67],bass:36},
  G7: {notes:[59,62,65,67],bass:43},
  G: {notes:[59,62,67],bass:43},
  F: {notes:[60,65,69],bass:41},
  'F/C': {notes:[60,65,69],bass:36},
  Am: {notes:[57,60,64],bass:45},
  C7: {notes:[60,64,67,70],bass:36},
  Bb: {notes:[58,62,65],bass:46},
  D: {notes:[62,66,69],bass:38},
  A7: {notes:[61,64,67,69],bass:45},
  Dm: {notes:[62,65,69],bass:38},
  Em: {notes:[59,64,67],bass:40},
  E5: {notes:[59,64],bass:40},
}

/**
 * @param {string} title
 * @param {number[][]} phrases Four bars of alternating MIDI notes and durations.
 * @param {TutorialLesson['chords']} chords One chord per beat.
 * @param {boolean} [flatNotes]
 * @param {string[]} [intro]
 * @param {3} [meter]
 * @param {1|3} [pickupBeats]
 * @returns {TutorialLesson}
 */
function advancedSong(title, phrases, chords, flatNotes = false, intro = [], meter, pickupBeats) {
  const unitsPerBeat = meter === 3 ? 2 / 3 : 1
  const bars = phrases.map(phrase => {
    let beat = 0
    const notes = []
    for (let i = 0; i < phrase.length; i += 2) {
      const [midi, duration] = [phrase[i], phrase[i + 1]]
      notes.push({beat:beat * unitsPerBeat, midi, duration:duration * unitsPerBeat})
      beat += duration
    }
    return notes
  })
  return {
    title, chords, flatNotes, meter, pickupBeats,
    messages:[`${title}を弾いてみよう！`,...intro,'Ottoのお手本を聴いて、同じフレーズを弾いてね。'],
    notes:bars[0], earlyPhrases:bars.slice(0,2), laterPhrases:bars.slice(2),
  }
}

export const advancedStart = lessons.length
lessons.push(
  advancedSong('ちょうちょう', [
    [67,.5,64,.5,64,1,65,.5,62,.5,62,1],
    [60,.5,62,.5,64,.5,65,.5,67,.5,67,.5,67,1],
    [67,.5,64,.5,64,.5,64,.5,65,.5,62,.5,62,1],
    [60,.5,64,.5,67,.5,67,.5,64,.5,64,.5,64,1],
  ], [['C','C','G7','G7'],['C','C','C','C'],['C','C','G7','G7'],['C','C','C','C']]),
  advancedSong('歓喜の歌', [
    [64,.5,64,.5,65,.5,67,.5,67,.5,65,.5,64,.5,62,.5],
    [60,.5,60,.5,62,.5,64,.5,64,.75,62,.25,62,1],
    [64,.5,64,.5,65,.5,67,.5,67,.5,65,.5,64,.5,62,.5],
    [60,.5,60,.5,62,.5,64,.5,62,.75,60,.25,60,1],
  ], [['C','C','G','G'],['C','C','C','G7'],['C','C','C','G7'],['C','C','G7','C']]),
  advancedSong('メリーさんのひつじ', [
    [66,.75,64,.25,62,.5,64,.5,66,.5,66,.5,66,1],
    [64,.5,64,.5,64,1,66,.5,69,.5,69,1],
    [66,.75,64,.25,62,.5,64,.5,66,.5,66,.5,66,1],
    [64,.5,64,.5,66,.75,64,.25,62,2],
  ], [['D','D','D','D'],['A7','A7','D','D'],['D','D','D','D'],['A7','A7','D','D']], false, [
    '♯（シャープ）が付くと、音が半音高くなるよ。ファ♯は、ファのすぐ右にある光った黒鍵だよ。',
    '同じ小節のファ♯は、最初の音にだけ♯が付くよ。次のファ♯も同じ黒鍵で弾こう。',
  ]),
  // Each two-measure exchange includes its own pair of pickup notes.
  advancedSong('ハッピー・バースデー', [
    [60,.75,60,.25,62,1,60,1,65,1,64,2],
    [60,.75,60,.25,62,1,60,1,67,1,65,2],
    [60,.75,60,.25,72,1,69,1,65,1,64,1,62,1],
    [70,.75,70,.25,69,1,65,1,67,1,65,2],
  ], [
    ['F','F','F','F','C7','C7'],
    ['C7','C7','C7','C7','F','F'],
    // The next row opens with the pickup on beat 3 of measure 6.
    ['F','F','F','Am','Bb','Bb'],
    ['Bb','F/C','F/C','C','F','F'],
  ], true, [
    '♭（フラット）が付くと、音が半音低くなるよ。シ♭は、シのすぐ左にある光った黒鍵だよ。',
    '同じ小節では、次のシにも♭が効くよ。続けて同じ黒鍵を弾こう。',
  ], 3, 1),
  // Spring Brook: the first eight measures in C.
  advancedSong('春の小川', [
    [64,.5,67,.5,69,.5,67,.5,64,.5,67,.5,72,.5,72,.5],
    [69,.5,69,.5,67,.5,64,.5,62,.5,64,.5,67,1],
    [64,.5,67,.5,69,.5,67,.5,64,.5,67,.5,72,.5,72,.5],
    [69,.5,69,.5,67,.5,64,.5,62,.5,64,.5,60,1],
  ], [['C','F','C','C'],['F','C','G7','G7'],['C','F','C','C'],['F','C','G7','C']]),
  // Sakura: opening, first melodic phrase, then the traditional closing phrase.
  advancedSong('さくら さくら', [
    [69,.5,69,.5,71,1,69,.5,69,.5,71,1],
    [69,.5,71,.5,72,.5,71,.5,69,.5,71,.25,69,.25,65,1],
    [64,.5,60,.5,64,.5,65,.5,64,.5,64,.25,60,.25,71,1],
    [64,.5,65,.5,71,.25,69,.25,65,.5,64,2],
  ], [['Am','E5','Am','E5'],['Am','Em','Am','F'],['E5','F','E5','E5'],['E5','F','F','E5']]),
  // Greensleeves: opening verse in D minor, adapted to the two-measure practice rows.
  advancedSong('グリーンスリーブス', [
    [62,1,65,.5,67,.5,69,.75,70,.25,69,.5,67,1,64,.5,60,.75,62,.25],
    [65,1,62,.5,62,.75,61,.25,62,.5,64,1,61,.5,69,1,62,.5],
    [65,1,67,.5,69,.75,70,.25,69,.5,67,1,64,.5,60,.75,62,.25,64,.5],
    [65,.75,64,.25,62,.5,61,.75,70,.25,60,.5,62,3],
  ], [
    ['Dm','Dm','F','C','C','C'], ['Dm','Dm','A7','A7','A7','Dm'],
    ['Dm','Dm','F','C','C','C'], ['Dm','Dm','A7','Dm','Dm','Dm'],
  ], true, [], 3, 1),
)

/** The Otto bar and following user bar share the same phrase.
 * @param {TutorialLesson} lesson @param {number} bar @param {number} [level] @returns {readonly TutorialNote[]} */
export function tutorialNotes(lesson,bar,level = 0) {
  if (lesson.session) {
    const phrase = sessionPhrases[Math.floor(Math.max(0,Math.min(15,bar))/4)*2 + bar%2]
    if (!level || isSessionSlide(bar)) return phrase
    return phrase.map((note, index) => index === 1 && (phrase[index + 1]?.beat ?? 4) > note.beat + .5
      ? {...note, beat: note.beat + .5, duration: Math.min(note.duration, .5)} : note)
  }
  if (lessons.indexOf(lesson) >= 4) {
    const phraseIndex = Math.floor(Math.max(0,Math.min(7,bar)) / 4) * 2 + bar % 2
    if (lesson.patterns) return lesson.patterns[phraseIndex % lesson.patterns.length]
    if (lesson.earlyPhrases && lesson.laterPhrases) return phraseIndex < 2 ? lesson.earlyPhrases[phraseIndex] : lesson.laterPhrases[phraseIndex - 2]
  }
  if (lesson.earlyPhrases && bar < 4) return lesson.earlyPhrases[Math.floor(Math.max(0,bar) / 2)]
  if (lesson.laterPhrases && bar >= 4) return lesson.laterPhrases[Math.min(lesson.laterPhrases.length - 1, Math.floor((bar - 4) / 2))]
  return lesson.patterns?.[Math.floor(Math.max(0,Math.min(7,bar))/2)%lesson.patterns.length] ?? lesson.notes
}

/** Advance one note of a slide only when its pitch and timing match.
 * @param {readonly TutorialNote[]} notes @param {number} progress @param {number} midi @param {number} beat
 * @returns {number} Number of matched notes.
 */
export function matchSlideNote(notes, progress, midi, beat) {
  const note = notes[progress]
  if (!note || note.midi !== midi || Math.abs(beat - note.beat) > .30) return progress
  return progress + 1
}

/** Snap a near-onset response to the beginning of the displayed note. */
/** @param {number} start @param {number} noteBeat */
export function displayedResponseStart(start, noteBeat) {
  return start >= noteBeat && start - noteBeat <= .12 ? noteBeat : start
}

/** Allow an early release proportional to the length of sustained notes. */
/** @param {number} end @param {number} noteEnd @param {number} duration */
export function displayedResponseEnd(end, noteEnd, duration) {
  const allowance = duration >= .7 ? Math.min(duration * .25, .35) : 0
  return end < noteEnd && noteEnd - end <= allowance + 1e-9 ? noteEnd : end
}

/** Find a short note (up to an eighth note) hit close to its onset.
 * @param {readonly TutorialNote[]} notes @param {number} midi @param {number} beat @param {boolean} [anyPitch] @param {boolean} [includeLong] */
export function eighthNoteHit(notes, midi, beat, anyPitch = false, includeLong = false) {
  return notes.filter(note => (anyPitch || note.midi === midi) && (includeLong ? note.duration < 2 : (anyPitch || note.duration <= .5 + .001)) && Math.abs(note.beat - beat) <= .35)
    .sort((a,b)=>Math.abs(a.beat-beat)-Math.abs(b.beat-beat))[0]
}

/** Resolve a short-note tap to the nearest user turn, including just before its first beat.
 * @param {readonly TutorialNote[]} notes @param {number} midi @param {number} absoluteBeat @param {boolean} [anyPitch] @param {number} [totalBars] @param {boolean} [includeLong] @param {boolean} [twoBarTurns] */
export function shortNoteTarget(notes, midi, absoluteBeat, anyPitch = false, totalBars = 8, includeLong = false, twoBarTurns = false) {
  for (let bar = 1; bar < totalBars; bar++) {
    if (twoBarTurns ? bar % 4 < 2 : bar % 2 !== 1) continue
    const note = eighthNoteHit(notes,midi,absoluteBeat-bar*4,anyPitch,includeLong)
    if (note) return {bar,note}
  }
  return undefined
}

/** Merge touching recorded intervals while preserving real gaps.
 * @param {readonly {start:number,end:number}[]} segments
 */
export function mergePlayedSegments(segments) {
  /** @type {Array<{start:number,end:number}>} */
  const merged = []
  for (const segment of [...segments].sort((a,b) => a.start-b.start)) {
    const last = merged[merged.length-1]
    if (last && segment.start <= last.end + .001) last.end = Math.max(last.end,segment.end)
    else merged.push({...segment})
  }
  return merged
}

/** Whether the displayed yellow segments cover every note in the response bar.
 * @param {readonly TutorialNote[]} notes
 * @param {readonly {bar:number,midi:number,start:number,end:number}[]} played
 * @param {number} bar */
export function responseComplete(notes, played, bar) {
  return notes.length > 0 && notes.every(note => {
    const end = note.beat + note.duration
    const segments = played.filter(p => p.bar === bar && p.midi === note.midi && p.end > note.beat && p.start < end)
      .map(p => ({start: displayedResponseStart(p.start,note.beat), end:displayedResponseEnd(p.end,end,note.duration)}))
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
 * @param {Set<number>} successes @param {number} bar @param {boolean} complete @param {number} [totalBars] @param {boolean} [twoBarTurns] */
export function recordTutorialSuccess(successes, bar, complete, totalBars = 8, twoBarTurns = false) {
  if (!complete || bar < 1 || bar >= totalBars || (twoBarTurns ? bar % 4 < 2 : bar % 2 !== 1) || successes.has(bar)) return false
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

// No.3 follows the four call-and-response phrases, with a final G resolution.
export const melodyThreeBarChords = [
  {name:'C',notes:[60,64,67],bass:36},
  {name:'Dm7',notes:[57,60,62,65],bass:38},
  {name:'G/E',notes:[59,62,67],bass:40},
  {name:'F',notes:[60,65,69],bass:41},
  {name:'G',notes:[59,62,67],bass:43},
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
  const publish = (phase,beat = 0,error = '') => onUpdate({phase,beat,bar:Math.max(0,Math.floor(beat / 4)),error})
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
  let beatSeconds = tutorialBeatSeconds
  /** @param {number} index @param {number} [level] @param {number} [bpm] */
  async function start(index, level = 0, bpm) {
    cancel()
    const token = generation
    const lesson = lessons[index]
    if (!Number.isInteger(index) || !lesson) { publish('error',0,'チュートリアルを選び直してください。'); return }
    beatSeconds = bpm && Number.isFinite(bpm) ? 60 / Math.max(40,Math.min(180,bpm)) : lesson.session && level > 0 ? 60 / 90 : tutorialBeatSeconds
    const triple = lesson.meter === 3
    const pickupBeats = lesson.pickupBeats ?? 0
    const pulse = triple ? 2 / 3 : pickupBeats ? .5 : 1
    const countIn = (lesson.meter ?? 4) - pickupBeats
    if (triple) beatSeconds /= pulse
    const totalBeats = lesson.session ? 64 : 32
    publish('loading')
    try {
      await Promise.all([voice.ready(), accompaniment?.ready()])
      if (token !== generation) return
      if (!voice.context) throw new Error('音声を開始できませんでした。もう一度スタートを押してください。')
      const startTime = voice.context.currentTime + countIn * pulse * beatSeconds + .05
      origin = startTime
      const events = Array.from({length:totalBeats / 4}, (_, bar) => {
        if (index >= 4 ? bar % 4 >= 2 : bar % 2 !== 0) return []
        const phrase = tutorialNotes(lesson, bar, level)
        return phrase.map((note, noteIndex) => {
          const next = phrase[noteIndex + 1]
          // Keep the mono voice held until the next key takes over.
          const connected = (lesson.patterns || (lesson.session && isSessionSlide(bar)) || ((index === 7 || index === 8) && bar >= 4 && next && note.beat + note.duration >= next.beat - .001)) && next
          const writtenSeconds = note.duration * beatSeconds
          const separation = index >= advancedStart
            ? Math.min(writtenSeconds * .2, next && next.midi !== note.midi ? .045 : .09)
            : 0
          const duration = connected
            ? (next.beat - note.beat) * beatSeconds + (next.midi === note.midi ? -.025 : .01)
            : index === 4 && note.duration === 1 ? writtenSeconds * .8 : writtenSeconds - separation
          return {midi:note.midi, time:startTime + (bar * 4 + note.beat) * beatSeconds, duration}
        })
      }).flat()
      const backing = Array.from({length:totalBeats / pulse + countIn}, (_, i) => {
        const slot = i - countIn
        return {slot, beat:slot * pulse, time:startTime + slot * pulse * beatSeconds}
      })
      let backingCursor = 0
      let cursor = 0
      const tick = () => {
        if (token !== generation || !voice.context) return
        try {
          const now = voice.context.currentTime
          const beat = Math.max(-countIn * pulse,(now - startTime) / beatSeconds)
          if (now >= startTime + totalBeats * beatSeconds) { cancel(); publish('complete',totalBeats); return }
          while (backingCursor < backing.length && backing[backingCursor].time < now + .12) {
            const event = backing[backingCursor++]
            if (event.time >= now - .08 && accompaniment) {
              if (event.beat < 0) accompaniment.playAt([event.slot === -countIn ? 84 : 79],event.time,.12,.45)
              else if (lesson.session) {
                const chord = lessonThreeChords[[0,3,2,4][Math.floor(event.beat / 4) % 4]]
                accompaniment.playAt(chord.notes,event.time,.52,event.beat % 2 === 0 ? .35 : .22,chord.bass)
              }
              else if (index === 1) {
                const chord = lessonThreeChords[Math.floor(event.beat / 2) % lessonThreeChords.length]
                accompaniment.playAt(chord.notes,event.time,.35,event.beat % 4 === 0 ? .32 : .18,chord.bass)
              } else if (lesson.chords || index === 4) {
                const bar = Math.floor(event.beat / 4)
                const phraseIndex = Math.floor(bar / 4) * 2 + bar % 2
                const beatInBar = event.slot % (4 / pulse)
                const chord = lesson.chords
                  ? songChords[lesson.chords[phraseIndex][beatInBar]]
                  : lessonThreeChords[[[0,0],[4,0],[4,0],[3,0]][phraseIndex][Math.floor(beatInBar / 2)]]
                const downbeat = (beatInBar - pickupBeats) % (lesson.meter ?? 4) === 0
                accompaniment.playAt(chord.notes,event.time,.35,downbeat ? .32 : .18,chord.bass,pulse * beatSeconds)
              } else if (index === 5 || index === 6) {
                const bar = Math.floor(event.beat / 4)
                const chord = bar < 4 ? lessonThreeChords[[4,3,5,2][bar]] : bar === 7 ? {name:'CM7',notes:[60,64,67,71],bass:36} : lessonThreeChords[[6,3,0][bar - 4]]
                accompaniment.playAt(chord.notes,event.time,.35,event.beat % 4 === 0 ? .32 : .18,chord.bass)
              } else if (index === 2 || index === 3) {
                const bar = Math.floor(event.beat / 4)
                const chord = melodyThreeBarChords[bar === 7 ? 4 : Math.floor(bar / 2)]
                accompaniment.playAt(chord.notes,event.time,.35,event.beat % 4 === 0 ? .32 : .18,chord.bass)
              } else accompaniment.playAt(event.beat % 4 === 0 ? [48,60,64,67] : [60,64,67],event.time,.35,event.beat % 4 === 0 ? .32 : .18)
            }
          }
          while (cursor < events.length && events[cursor].time < now + .12) {
            const event = events[cursor++]
            // After a suspended/background clock, skip missed notes instead of a burst.
            if (event.time >= now - .08) voice.playAt([event.midi],event.time,event.duration,.75)
          }
          publish(beat < 0 ? 'countdown' : (index >= 4 ? Math.floor(beat / 8) % 2 === 0 : Math.floor(beat / 4) % 2 === 0) ? 'otto' : 'you',beat)
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
  return {start,stop, currentBeat:()=>origin !== undefined && voice.context ? (voice.context.currentTime-origin)/beatSeconds : undefined}
}
