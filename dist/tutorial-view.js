import { scoreNavigation, scoreNote, scoreAccidental, scoreStemDown, scoreBeamConnects, scoreBeamGroupStemDown, tutorialPitchTop, tutorialStaffLines, tutorialSubdivisions, tutorialPitchSymbol } from './score-navigation.js'
import { capturePianoPointer, pianoKeyAtPointer, pianoWhiteLabel } from './keyboard.js'
import { createApp, h, ref } from './vendor/vue.runtime.esm-browser.prod.js'
import { Instrument } from './audio.js'
import { bindTempoKnob } from './main-controls.js'
import { lessons, createTutorialPlayer, displayedResponseStart, displayedResponseEnd, mergePlayedSegments, responseComplete, recordTutorialSuccess, shortNoteTarget, tutorialNotes, isTutorialFreePitch, matchSlideNote, isSessionSlide } from './tutorial.js'
import { genres, BassSynth } from './groove.js'
import { DrumSynth } from './rhythm.js'
import { readDevelopmentScreen, saveDevelopmentScreen } from './tutorial.js'

const pitches = [60,62,64,65,67,69,71,72]
const names = pitches.map(pianoWhiteLabel)

function TutorialStamp() {
  return h('svg',{class:'tutorial-stamp',viewBox:'0 0 100 100','aria-hidden':'true'},[
    h('path',{d:'M50 3 L59 9 69 6 75 15 85 17 87 27 96 34 93 44 98 53 92 62 93 72 83 77 79 87 68 88 61 96 51 92 41 97 33 90 23 89 19 79 9 74 10 63 4 54 8 44 5 35 14 28 16 18 27 15 33 6 43 9 Z',fill:'var(--oto-key)',stroke:'#e23c39','stroke-width':2.5}),
    h('text',{x:50,y:44,'text-anchor':'middle',fill:'#e23c39','font-size':12,'font-weight':'bold'},'たいへん'),
    h('text',{x:50,y:59,'text-anchor':'middle',fill:'#e23c39','font-size':12,'font-weight':'bold'},'よくできました'),
  ])
}

/** @param {{score:number,goal:number}} props */
export function TutorialScore({score,goal}) {
  return h('div',{class:'tutorial-score',role:'status','aria-label':score===goal?`${goal}回成功、はなまる！`:`成功 ${score} / ${goal}回`},[
    score < goal ? h('svg',{viewBox:'0 0 100 100','aria-hidden':'true'},[
      h('circle',{cx:50,cy:50,r:42,class:'tutorial-score-track'}),
      h('circle',{cx:50,cy:50,r:42,class:'tutorial-score-progress','stroke-dasharray':`${score*100/goal} 100`,pathLength:100,transform:'rotate(-90 50 50)'}),
    ]) : null,
    score===goal ? h(TutorialStamp) : h('span',`${score}/${goal}`),
  ])
}

/** @param {number} remaining */
export const tutorialCountLabel = remaining => `あと ${remaining} 拍`

/**
 * @param {{drawing:string, line:string, advance?:()=>void, hint?:string, error?:string, actions?:(ReturnType<typeof h>|null)[], perfect?:boolean, happy?:boolean}} props
 */
export function TutorialCompanion({drawing,line,advance,hint,error,actions,perfect,happy}) {
  return h('div',{class:'tutorial-companion'},[
    h('div',{class:'talk-avatar','data-look':'headphones','data-perfect':perfect?'':undefined,'data-happy':happy?'':undefined,'aria-hidden':'true',innerHTML:drawing}),
    h(advance?'button':'div',{
      class:'tutorial-message',
      type:advance?'button':undefined,
      onPointerdown:advance ? event=>event.preventDefault() : undefined,
      onClick:advance,
    },[
      h('span',line),
      error?h('small',{role:'alert'},error):null,
      hint?h('small',hint):null,

    ]),
    actions?h('div',{class:'tutorial-complete'},actions):null,
  ])
}

/** @param {{onBack:()=>void, onSelect:(index:number)=>void, index:number, count:number, label:string, options:(ReturnType<typeof h>|null)[], onStop?:()=>void, minIndex?:number}} props */
export function TutorialSelector({onBack,onSelect,index,count,label,options,onStop,minIndex=0}) {
  return h('header',{class:'tutorial-selector'},[
    h('button',{type:'button',class:'tutorial-back',onClick:onBack},'← メニュー'),
    h('div',{class:'part-choice-picker'},[
      h('select',{'aria-label':label,value:index,onChange:(/** @type {Event} */ event)=>onSelect(Number(/** @type {HTMLSelectElement} */(event.target).value))},options),
      h('div',{class:'part-choice-steps'},[
        h('button',{type:'button','aria-label':'前のレッスン',disabled:index===minIndex,onClick:()=>onSelect(index-1)},'←'),
        h('button',{type:'button','aria-label':'次のレッスン',disabled:index===count-1,onClick:()=>onSelect(index+1)},'→'),
      ]),
    ]),
    onStop?h('button',{type:'button',class:'tutorial-start',onClick:onStop},'■ 停止'):null,
  ])
}

/** @param {{value:number,onTempoUpdate:(value:number)=>void,disabled?:boolean}} props */
export function TutorialTempo({value,onTempoUpdate,disabled=false}) {
  return h('div',{class:'tutorial-tempo'},[h('span','テンポ'),h('span',{class:'volume-knob',style:{'--angle':`${(value-110)*1.3}deg`}},[h('input',{type:'range',min:40,max:180,step:1,value,disabled,ref:bindTempoKnob,'aria-label':'テンポ BPM',onInput:(/** @type {Event} */ event)=>onTempoUpdate(Number(/** @type {HTMLInputElement} */(event.target).value))}),h('span',{'aria-hidden':'true'})]),h('output',String(value))])
}

/** @param {AudioContext} context @param {Set<OscillatorNode>} successSounds */
export function playTutorialSuccess(context, successSounds) {
    const now = context.currentTime
    // Two short, bright tones make the rising quiz-show confirmation distinct.
    for (const [frequency,offset] of [[1046.5,0],[1568,.085]]) {
      const oscillator = context.createOscillator(), gain = context.createGain()
      const start = now + offset
      oscillator.type = 'triangle'
      oscillator.frequency.setValueAtTime(frequency,start)
      gain.gain.setValueAtTime(.0001,start)
      gain.gain.exponentialRampToValueAtTime(.075,start+.008)
      gain.gain.exponentialRampToValueAtTime(.0001,start+.15)
      oscillator.connect(gain); gain.connect(context.destination)
      successSounds.add(oscillator)
      oscillator.onended = () => { successSounds.delete(oscillator); oscillator.disconnect(); gain.disconnect() }
      oscillator.start(start); oscillator.stop(start+.16)
    }
}

/** Dedicated lesson screen; free-play settings and transport are never mutated.
 * @param {HTMLElement} root @param {(mode:string)=>void} navigate */
export function mountTutorial(root, navigate) {
  const voice = new Instrument('melody')
  const userVoice = new Instrument('melody')
  const backingVoice = new Instrument('chord')
  const drums = new DrumSynth(backingVoice)
  const bass = new BassSynth(backingVoice)
  drums.setVolume(.20)
  bass.setVolume(.25)
  let backingBeat = 0
  const accompaniment = {
    get context() { return backingVoice.context },
    ready: () => backingVoice.ready(),
    /** @param {readonly number[]} notes @param {number} time @param {number} duration @param {number} [level] @param {number} [bassMidi] */
    playAt(notes,time,duration,level = 1,bassMidi = 36) {
      backingVoice.playAt(notes,time,duration,level)
      if (notes[0] >= 79) return
      const lesson = lessons[selected.value]
      const beat = backingBeat++
      const downbeat = lesson.meter || lesson.pickupBeats
        ? (beat - (lesson.pickupBeats ?? 0)) % (lesson.meter ?? 4) === 0
        : beat % 2 === 0
      drums.hitAt('hat',time,.35,.08)
      drums.hitAt(downbeat ? 'kick' : 'snare',time,downbeat ? .55 : .38)
      if (downbeat) bass.playAt(bassMidi,time,.52,.55)
    },
    silence() { backingBeat = 0; drums.silence(); bass.silence(); backingVoice.silence() },
  }
  const style = genres.find(item => item.id === 'pop')
  backingVoice.setTimbre(style?.chord ?? 'piano')
  drums.timbre = style?.drum ?? 'acoustic'
  bass.timbre = style?.bass ?? 'electric'
  voice.setTimbre('lead-round')
  userVoice.setTimbre('lead-round')
  const selected = ref(0), message = ref(0), dialogue = ref(true)
  const state = ref({phase:'idle',beat:0,bar:0,error:''})
  const held = ref(-1), feedback = ref(''), score = ref(0)
  const successes = new Set()
  /** @type {Set<OscillatorNode>} */
  const successSounds = new Set()
  function silenceSuccess() {
    for (const oscillator of successSounds) { try { oscillator.stop() } catch {} }
    successSounds.clear()
  }
  function playSuccess() {
    const context = voice.context
    if (!context || context.state !== 'running') return
    playTutorialSuccess(context, successSounds)
  }
  /** @type {import('./tutorial.js').TutorialState} */
  let previous = {phase:'idle',beat:0,bar:0,error:''}
  /** @type {Array<{bar:number,midi:number,start:number,end:number}>} */
  const played = []
  const playedRevision = ref(0)
  let visible = false, revision = 0
  /** @type {number|undefined} */
  let pointer
  let pointerReady = false
  let slideBar = -1
  const slideProgress = ref(0)
  let slideMatched = 0
  let slideResultBar = -1
  const currentLesson = () => lessons[selected.value]
  const isSlide = () => Boolean(lessons[selected.value].patterns)
  /** @type {ReturnType<typeof setTimeout>|undefined} */
  let clickTimer
  const scorePreviewPage = ref(0)
  const sessionLevel = ref(0)
  const retryTempo = ref(80)
  const resetRetryTempo = () => { retryTempo.value = currentLesson().settings?.tempo ?? 80 }
  const responseNotes = (/** @type {number} */ bar) => tutorialNotes(lessons[selected.value],bar,sessionLevel.value)
  const player = createTutorialPlayer({voice, accompaniment, onUpdate: next => {
    if (isSlide() && next.phase === 'you' && previous.phase !== 'you' && held.value >= 0 && slideBar < 0) beginSlide(held.value)
    if (previous.phase === 'you' && next.phase === 'you' && previous.bar === next.bar && held.value >= 0 && !lessons[selected.value].freePitch && !isSlide()) {
      played.push({bar:next.bar,midi:held.value,start:previous.beat % 4,end:next.beat % 4})
      playedRevision.value++
    }
    if (previous.bar !== next.bar || previous.phase !== next.phase) feedback.value = ''
    if (!lessons[selected.value].session && next.phase === 'you' && (isSlide() ? successes.has(next.bar) : responseComplete(responseNotes(next.bar), played, next.bar))) {
      feedback.value = 'バッチリ！'
      if (recordTutorialSuccess(successes,next.bar,true,8,Boolean(currentLesson().settings?.twoBarTurns))) { score.value = successes.size; playSuccess() }
    }
    previous = next; state.value = next
    if (next.phase === 'complete' && currentLesson().settings?.course === 'songs') scorePreviewPage.value = 1
    if (['complete','error'].includes(next.phase)) release()
  }})
  function release(preserveSlide = false) {
    clearTimeout(clickTimer); pointer = undefined; pointerReady = false; revision++
    if (!preserveSlide) { slideBar = -1; slideMatched = 0 }
    if (held.value >= 0) userVoice.release(held.value)
    held.value = -1
  }
  function stop() { player.stop(); release(); userVoice.silence(); silenceSuccess() }
  function start() { stop(); scorePreviewPage.value = 0; slideProgress.value = 0; slideResultBar = -1; successes.clear(); score.value = 0; played.length = 0; playedRevision.value++; dialogue.value = true; message.value = 0; feedback.value = '' }
  /** @param {number} index */
  function select(index) { stop(); scorePreviewPage.value = 0; slideProgress.value = 0; slideResultBar = -1; successes.clear(); score.value = 0; played.length = 0; playedRevision.value++; selected.value = index; saveDevelopmentScreen('melody-lesson', lessons[index].title); sessionLevel.value = 0; resetRetryTempo(); dialogue.value = false; feedback.value = '' }
  const courseIndices = () => lessons.flatMap((lesson,index) =>
    (lesson.settings?.course ?? 'basic') === (currentLesson().settings?.course ?? 'basic') ? [index] : [])
  function nextLesson() {
    const indices = courseIndices()
    const next = indices[indices.indexOf(selected.value) + 1]
    if (next === undefined) return
    select(next)
    start()
  }
  function advance() {
    if (!dialogue.value && state.value.phase === 'complete') {
      nextLesson()
      return
    }
    if (!dialogue.value) {
      if (state.value.phase === 'idle' || state.value.phase === 'error') start()
      return
    }
    if (message.value < lessons[selected.value].messages.length - 1) message.value++
    else { dialogue.value = false; voice.toneSettings.amp = currentLesson().settings?.release !== undefined ? {release:currentLesson().settings?.release} : {}; void player.start(selected.value, sessionLevel.value, retryTempo.value) }
  }
  /** @param {number} midi */
  function markEighthNote(midi) {
    if (isSlide()) return
    const beat = player.currentBeat()
    if (beat === undefined) return
    const lesson = lessons[selected.value]
    if (!lesson.session && lesson.freePitch && !isTutorialFreePitch(selected.value,midi)) return
    const totalBars = lesson.session ? 16 : 8
    const target = Array.from({length:totalBars}, (_,i) => i).filter(bar => Boolean(currentLesson().settings?.twoBarTurns) ? bar % 4 >= 2 : bar % 2 === 1).map(bar => {
      const hit = shortNoteTarget(responseNotes(bar),midi,beat,lesson.freePitch,totalBars,true,Boolean(currentLesson().settings?.twoBarTurns))
      return hit?.bar === bar ? hit : undefined
    }).find(Boolean)
    if (!target) return
    const {note,bar} = target
    played.push({bar,midi:note.midi,start:note.beat,end:note.beat+note.duration})
    playedRevision.value++
    if (responseComplete(responseNotes(bar),played,bar)) {
      feedback.value = 'バッチリ！'
      if (recordTutorialSuccess(successes,bar,true,totalBars,Boolean(currentLesson().settings?.twoBarTurns))) { score.value = successes.size; playSuccess() }
    }
  }
  /** @param {number} midi */
  async function press(midi, preserveSlide = false) {
    release(preserveSlide)
    held.value = midi
    markEighthNote(midi)
    const token = revision
    try {
      await userVoice.ready()
      if (!visible || token !== revision || held.value < 0) return
      userVoice.attack(held.value)
      if (pointer !== undefined) pointerReady = true
      if (state.value.phase === 'you' && !isSlide() && !lessons[selected.value].session) {
        const beat = state.value.beat % 4
        const match = responseNotes(state.value.bar).some(note => (lessons[selected.value].freePitch ? isTutorialFreePitch(selected.value,midi) : note.midi === midi) && Math.abs(note.beat - beat) < .45)
        if (feedback.value !== 'バッチリ！') feedback.value = match ? 'いいね、その調子！' : '聴いた音を、もう一度'
      }
    } catch { if (token === revision) { feedback.value = '音を出せませんでした。もう一度鍵盤を押してね。'; held.value = -1 } }
  }
  const midiHeld = new Set()
  /** @param {number} midi */
  function beginSlide(midi) {
        const beat = player.currentBeat()
        const currentBar = beat === undefined ? -1 : Math.floor(beat / 4)
        const bar = beat !== undefined && currentBar % 4 < 2 ? Math.floor((beat + .35) / 4) : currentBar
        if (isSlide() && bar >= 0 && bar <= 7 && bar % 4 >= 2 && beat !== undefined) {
          const notes = responseNotes(bar)
          const matched = currentLesson().settings?.slide === 'octave' ? matchSlideNote(notes, 0, midi, beat - bar * 4) : Number(notes[0]?.midi === midi)
          if (matched) {
            slideBar = bar
            slideMatched = matched
            slideResultBar = bar
            slideProgress.value = notes[0].duration / (notes[notes.length - 1].beat + notes[notes.length - 1].duration)
          }
        }
  }
  /** @param {number} next */
  function moveSlide(next) {
        if (slideBar >= 0) {
          const beat = player.currentBeat()
          const notes = responseNotes(slideBar)
          const first = notes[0].midi
          const last = notes[notes.length - 1].midi
          if (beat !== undefined && beat >= slideBar * 4 - .35 && beat < (slideBar + 1) * 4 + (currentLesson().settings?.slide === 'fifth' ? .35 : 0)) {
            if (currentLesson().settings?.slide === 'octave') {
              const matched = matchSlideNote(notes, slideMatched, next, beat - slideBar * 4)
              if (matched > slideMatched) {
                slideMatched = matched
                const note = notes[matched - 1]
                slideProgress.value = matched === notes.length ? 1 : (note.beat + note.duration) / (notes[notes.length - 1].beat + notes[notes.length - 1].duration)
              }
            } else {
              slideProgress.value = Math.max(slideProgress.value, Math.min(1, (next - first) / (last - first)))
            }
            const complete = currentLesson().settings?.slide === 'octave' ? slideMatched === notes.length : next === last
            if (complete && recordTutorialSuccess(successes,slideBar,true,8,true)) {
              feedback.value = 'バッチリ！'
              score.value = successes.size
              playSuccess()
            }
          }
        }
  }
  /** @param {number} midi */
  function keyEvents(midi) {
    const lift = (/** @type {PointerEvent} */ event) => {
      if (event.pointerId !== pointer) return
      if (event.type === 'pointerup' && isSlide()) {
        const board = /** @type {HTMLElement} */(event.currentTarget).closest('.tutorial-keyboard')
        const finalKey = board ? pianoKeyAtPointer(event, board) : undefined
        if (finalKey !== undefined) {
          if (slideBar < 0) beginSlide(held.value)
          moveSlide(finalKey)
        }
      }
      release()
    }
    return {
      onPointerdown:(/** @type {PointerEvent} */event)=>{
        if(pointer!==undefined || !capturePianoPointer(event, /** @type {HTMLElement} */(event.currentTarget)))return
        void press(midi)
        pointer=event.pointerId
        beginSlide(midi)
      },
      onPointermove:(/** @type {PointerEvent} */event)=>{
        if (event.pointerId !== pointer) return
        const board = /** @type {HTMLElement} */(event.currentTarget).closest('.tutorial-keyboard')
        const next = board ? pianoKeyAtPointer(event, board) : undefined
        if (next === undefined) {
          slideBar = -1
          slideMatched = 0
          return
        }
        const previousMidi = held.value
        if (next === previousMidi) return
        if (isSlide() && slideBar < 0) beginSlide(previousMidi)
        held.value = next
        markEighthNote(next)
        moveSlide(next)
        if (pointerReady) { userVoice.attack(next,true); userVoice.release(previousMidi) }
      },
      onPointerup:lift,onPointercancel:lift,onLostpointercapture:lift,
      onKeydown:(/** @type {KeyboardEvent} */event)=>{
        if([' ','Enter'].includes(event.key)){event.preventDefault();if(!event.repeat)void press(midi)}
      },
      onKeyup:(/** @type {KeyboardEvent} */event)=>{if([' ','Enter'].includes(event.key)){event.preventDefault();release()}},
      onBlur:release,
      onClick:(/** @type {MouseEvent} */event)=>{
        if(event.detail!==0 || held.value!==-1)return
        const pending=press(midi), token=revision
        void pending.then(()=>{if(token===revision)clickTimer=setTimeout(release,250)})
      },
    }
  }
  const drawing = document.querySelector('#oto-buddy svg')?.outerHTML ?? ''
  const app = createApp({render() {
    void playedRevision.value
    const lesson = lessons[selected.value]
    const indices = courseIndices()
    const courseIndex = indices.indexOf(selected.value)
    const hasNext = courseIndex < indices.length - 1
    const rhythmOnlyGuide = lesson.settings?.rhythmOnlyGuide
    const notes = tutorialNotes(lesson,state.value.bar,sessionLevel.value)
    const totalBars = lesson.session ? 16 : 8
    const scoreGoal = totalBars / 2
    const sessionSlide = lesson.session && isSessionSlide(state.value.bar)
    const connectedRhythm = sessionSlide || state.value.bar >= (lesson.settings?.connectFromBar ?? Infinity)
    const rhythmLane = lesson.freePitch && !connectedRhythm
    const durationRow = (/** @type {number} */ duration) => duration >= 2 ? 3 : duration >= 1 ? 2 : duration >= .5 ? 0 : 1
    const visibleRows = [...new Set(notes.map(note => durationRow(note.duration)))].sort((a,b) => a-b)
    const advanced = currentLesson().settings?.course === 'songs'
    const notationScale = advanced ? (lesson.meter ?? 4) / 2 : 1
    const gridBeats = lesson.meter === 3 ? 6 : lesson.pickupBeats ? 8 : 4
    const pickupBeats = lesson.pickupBeats ?? 0
    const secondMeasureBeat = pickupBeats + (lesson.meter ?? 4)
    const keyboardPitches = advanced ? [60,62,64,65,67,69,71,72,74,76,77,79,81,83,84] : pitches
    const phase = state.value.phase
    const running = ['loading','countdown','otto','you'].includes(phase)
    const firstLane = advanced && !running
      ? scorePreviewPage.value * 4
      : Math.floor(Math.min(state.value.bar,totalBars-1)/2)*2
    const scorePage = firstLane >= 4 ? 1 : 0
    const beat = ((state.value.beat % 4) + 4) % 4
    // The advanced score shows two four-beat measures per scheduled phrase.
    const measure = (/** @type {number} */ bar, /** @type {number} */ half) =>
      (Math.floor(bar / 4) * 2 + bar % 2) * 2 + half + 1
    const scorePosition = advanced
      ? `${measure(Math.min(state.value.bar,totalBars-1),beat * notationScale >= secondMeasureBeat ? 1 : 0)} / 8 小節`
      : `${Math.min(totalBars,state.value.bar+1)} / ${totalBars} 小節`
    const remainingCount = Math.ceil(-state.value.beat * (lesson.meter || pickupBeats ? notationScale : 1) - 1e-9)
    const countText = pickupBeats ? `${(lesson.meter ?? 4) - pickupBeats + 1 - remainingCount} / ${lesson.meter ?? 4}` : tutorialCountLabel(remainingCount)
    const line = dialogue.value ? lesson.messages[message.value]
      : phase === 'otto' ? (lesson.settings?.connectedNotation && state.value.bar >= 4 ? '後半はスライドも使ってみよう！' : 'まずは聴いてみよう。次はあなたの番！')
      : phase === 'you' ? (lesson.session ? 'あなたの番。伴奏に合わせて自由に弾いてみよう！' : lesson.freePitch ? '今度はあなた。リズムに合わせて、好きな音で！' : isSlide() ? '今度はあなた。押したまま、最後の音までなぞろう。' : '今度はあなた。一緒のフレーズを弾いてみよう。')
      : phase === 'countdown' ? '準備はいい？ ぼくから弾くから聞いててね。'
      : phase === 'complete' ? (hasNext ? '8小節できたね！ 次のレッスンへすすもう！' : 'すごい！最後まで演奏できたね！')
      : phase === 'error' ? state.value.error : 'このレッスンを始めよう。'
    const lastNote = notes[notes.length - 1]
    // Treble staff: E is on the bottom line, with one step per line or space.
    const beamSlide = currentLesson().settings?.slide === 'fifth' || currentLesson().settings?.slide === 'octave'
    const staffMidi = (/** @type {number} */ midi) => advanced && (midi === 61 || midi === 66 || midi === 70) ? midi + (midi === 70 && lesson.flatNotes ? 1 : -1) : midi
    const accidental = (/** @type {number} */ midi) => staffMidi(midi) === midi ? '' : staffMidi(midi) > midi ? '♭' : '♯'
    const pitchTop = (/** @type {number} */ midi) =>
      tutorialPitchTop(staffMidi(midi))
    /** @type {number | undefined} */
    let slidePosition
    // Show the finger while Otto plays the connected phrases.
    if ((isSlide() || connectedRhythm) && phase === 'otto' && beat >= notes[0].beat && beat < lastNote.beat + lastNote.duration) {
      const nextIndex = notes.findIndex(note => note.beat > beat)
      if (nextIndex > 0) {
        const from = notes[nextIndex - 1]
        const to = notes[nextIndex]
        const fromKey = pitches.indexOf(from.midi)
        const connected = isSlide() || from.beat + from.duration >= to.beat - .001
        if (connected) {
          const progress = (beat - from.beat) / (to.beat - from.beat)
          slidePosition = fromKey + (pitches.indexOf(to.midi) - fromKey) * progress
        } else if (beat < from.beat + from.duration) {
          slidePosition = fromKey
        }
      } else {
        slidePosition = pitches.indexOf(lastNote.midi)
      }
    }
    const noteActive = (/** @type {number} */ midi) => {
      if (isSlide()) return slidePosition !== undefined && pitches[Math.round(slidePosition)] === midi
      return phase === 'otto' && notes.some(note => note.midi === midi && beat >= note.beat && beat < note.beat + note.duration)
    }
    const introFocus = lesson.settings?.introGuide && dialogue.value ? (message.value === 1 ? 'keyboard' : message.value === 2 ? 'navigation' : '') : ''
    const explainingAccidental = dialogue.value && [1,2].includes(message.value)
    const highlightedMidi = explainingAccidental
      ? (lesson.settings?.highlightMidi ?? -1)
      : -1
    const introSlide = currentLesson().settings?.slide === 'fifth' && dialogue.value && message.value <= 1
    return [
      h(TutorialSelector,{
        onBack:()=>navigate('menu'),onSelect:i=>select(indices[i]),index:courseIndex,count:indices.length,label:'チュートリアル番号',
        options:indices.map((index,i)=>{
          return h('option',{value:i},`No.${i + (lesson.settings?.course === 'adlib' ? 8 : 1)} · ${lessons[index].title}`)
        }),
        onStop:running?()=>{stop();dialogue.value=false}:undefined,
      }),
      h(TutorialCompanion,{
        drawing,line,perfect:phase==='complete' && score.value===scoreGoal,
        advance:dialogue.value || phase==='idle' || phase==='error'?advance:undefined,
        hint:dialogue.value?`${message.value+1} / ${lesson.messages.length}　タップして${message.value===lesson.messages.length-1?'演奏へ':'次へ'} →`:phase==='idle' || phase==='error'?'タップしてレッスンをスタート →':undefined,
      }),
      h('div',{class:['tutorial-lesson-area',{'tutorial-intro-shade':!!introFocus}]},[
      h('div',{class:'tutorial-guide-area'},[
      h('section',{class:['tutorial-demo',{'tutorial-demo-complete':phase==='complete'}],'aria-label':phase==='complete'?'レッスン終了後の操作':'Ottoのけんばん'},[
        h('div',{class:'tutorial-caption','aria-hidden':phase==='complete'?'true':undefined},[h('strong','Ottoのけんばん')]),
        h('div',{class:'tutorial-demo-keys','aria-hidden':'true'},[
          ...pitches.map((m,i)=>h('span',{class:{active:noteActive(m)}},names[i])),
          slidePosition === undefined ? null : h('div',{class:'tutorial-slide-finger',style:{left:`${(slidePosition + .5) * 12.5}%`}},'👆'),
        ]),
        phase==='complete'?h('div',{class:'tutorial-complete tutorial-demo-actions'},[
          h('button',{type:'button',onClick:start},'もう一度'),
          h(TutorialTempo,{value:retryTempo.value,onTempoUpdate:(/** @type {number} */ value)=>{retryTempo.value=value}}),
          lesson.session && sessionLevel.value === 0 ? h('button',{type:'button',onClick:()=>{sessionLevel.value = 1; retryTempo.value = 90; start()}},'もう少しレベルを上げる') : null,
          hasNext?h('button',{type:'button',class:'tutorial-next',onClick:nextLesson},'次のレッスン →'):h('button',{type:'button',class:'tutorial-next',onClick:()=>navigate('menu')},'チュートリアルへ →'),
        ]):null,
      ]),
      scoreNavigation({attrs:{class:{'tutorial-navigation-advanced':advanced,'tutorial-intro-highlight':introFocus === 'navigation'},'aria-label':'演奏ナビゲーション'}, header:[
        h('div',{class:'tutorial-caption tutorial-navigation-header'},[h('div',{class:'tutorial-navigation-copy'},[h('div',{class:'tutorial-navigation-status'},[h('strong',phase==='countdown'?countText:phase==='you'?'あなた番です...':phase==='otto'?'Otto演奏中...':''),h('span',running && phase!=='countdown' && phase!=='loading'?scorePosition:'')]),feedback.value || phase==='loading' ? h('span',{class:'sr-only',role:'status'},phase==='loading'?'音を準備しています…':feedback.value) : null]),
        advanced && ['localhost','127.0.0.1'].includes(location.hostname) && phase !== 'complete' ? h(TutorialTempo,{value:retryTempo.value,disabled:running,onTempoUpdate:(/** @type {number} */ value)=>{retryTempo.value=value}}) : null,
        advanced ? h('div',{class:'tutorial-score-pagination','aria-label':'楽譜のページ'},[
          h('div',{class:'part-choice-steps'},[
            h('button',{type:'button','aria-label':'前半の楽譜',disabled:running || scorePage === 0,onClick:()=>{scorePreviewPage.value=0}},'←'),
            h('button',{type:'button','aria-label':'後半の楽譜',disabled:running || scorePage === 1,onClick:()=>{scorePreviewPage.value=1}},'→'),
          ]),
          h('span',{'aria-live':running ? 'off' : 'polite'},scorePage === 0 ? '1〜4小節' : '5〜8小節'),
        ]) : null,
        lesson.session ? h('div',{class:'tutorial-score tutorial-session-ring',
          role:'img','aria-label':phase==='you'?'あなたの番':phase==='otto'?'Ottoの番':'2小節ずつ交代'},[
          h('svg',{viewBox:'0 0 100 100','aria-hidden':'true'},[
            h('circle',{cx:50,cy:50,r:42,stroke:'var(--oto-accent)',pathLength:100,'stroke-dasharray':'48 52',transform:'rotate(-90 50 50)'}),
            h('circle',{cx:50,cy:50,r:42,stroke:'var(--oto-secondary)',pathLength:100,'stroke-dasharray':'48 52',transform:'rotate(90 50 50)'}),
            ['otto','you'].includes(phase) ? h('circle',{cx:50,cy:8,r:5,style:{fill:'var(--oto-ink)',stroke:'var(--oto-key)',strokeWidth:2},transform:`rotate(${(state.value.beat % 16)*22.5} 50 50)`}) : null,
          ]),
          h('span',phase==='you'?'あなた':phase==='otto'?'Otto':'交代'),
        ]) : null, h(TutorialScore,{score:score.value,goal:scoreGoal})]),
        ], laneContainer:{class:['tutorial-lanes','tutorial-lanes-double',{'tutorial-lanes-advanced':advanced && lesson.keySignature}]}, lanes:[firstLane,firstLane+1], lane:laneBar=>{
        const notes = tutorialNotes(lesson,laneBar,sessionLevel.value)
        const lastNote = notes[notes.length - 1]
        const pickupPair = pickupBeats && notes[0].midi === notes[1]?.midi
          && Math.abs(notes[0].duration * notationScale - .75) < .001
          && Math.abs(notes[1].duration * notationScale - .25) < .001
        const pickupBeamStyle = pickupPair ? {
          '--beam-second-start':scoreStemDown(notes[0].midi) ? '-5px' : '5px',
          '--beam-second-end':scoreStemDown(notes[1].midi) ? '-5px' : '5px',
          '--beam-start-offset':scoreStemDown(notes[0].midi) ? 'var(--tutorial-stem-rise)' : 'calc(-1 * var(--tutorial-stem-rise))',
          '--beam-end-offset':scoreStemDown(notes[1].midi) ? 'var(--tutorial-stem-rise)' : 'calc(-1 * var(--tutorial-stem-rise))',
          '--beam-start':pitchTop(notes[0].midi),
          '--beam-end':pitchTop(notes[1].midi),
          '--pickup-stem-x':`calc(8px + ${scoreStemDown(notes[0].midi) ? .9 : 6.6}px * var(--tutorial-staff-scale) + ${accidental(notes[0].midi) ? 4 : 0}px)`,
        } : null
        const beamBreaks = currentLesson().settings?.slide === 'fifth' ? [notes.length - 1] : currentLesson().settings?.slide === 'octave' ? [4] : []
        const connectedRhythm = (lesson.session && isSessionSlide(laneBar)) || lesson.settings?.connectedNotation
        const rhythmLane = lesson.freePitch && !connectedRhythm
        const visibleRows = [...new Set(notes.map(note => durationRow(note.duration)))].sort((a,b) => a-b)
        return {attrs:{class:{'tutorial-rhythm-lane':rhythmLane,'tutorial-pitch-lane':!rhythmLane,'tutorial-final-bar':advanced ? measure(laneBar,1) === 8 : laneBar === totalBars - 1},'aria-hidden':'true'}, before:[
          advanced && lesson.keySignature ? h('span',{class:'tutorial-key-signature'},lesson.keySignature) : null,
          !rhythmLane ? tutorialStaffLines() : null,
          ...Array.from({length:gridBeats},(_,b)=>{
            const beatsPerMeasure = gridBeats / 2
            const measureOffset = b - pickupBeats
            const label = advanced
              ? (measureOffset >= 0 && measureOffset % beatsPerMeasure === 0 ? String(measure(laneBar,measureOffset / beatsPerMeasure)) : '')
              : String(b+1)
            return h('span',{class:'tutorial-beat-grid',style:{left:`${b*100/gridBeats}%`,width:`${100/gridBeats}%`}},label)
          }),
          ...(advanced ? (pickupBeats ? [pickupBeats, secondMeasureBeat] : [gridBeats / 2]).map(position =>
            h('span',{class:'tutorial-measure-divider',style:{left:`${position*100/gridBeats}%`}})) : []),
          ...tutorialSubdivisions(gridBeats),
          ...(isSlide() ? [h('div',{
            class:'tutorial-slide-track',
            style:{
              width:`${(lastNote.beat + lastNote.duration)*25}%`,
              '--slide-start':pitchTop(notes[0].midi),
              '--slide-end':pitchTop(lastNote.midi),
              '--slide-end-beat':`${lastNote.beat / (lastNote.beat + lastNote.duration)*100}%`,
            },
          },h('div',{class:'tutorial-slide-fill',style:{
            width:`${(successes.has(laneBar) ? 1 : slideResultBar === laneBar ? slideProgress.value : 0)*100}%`,
          }}))] : []),
          ...(beamSlide ? notes.flatMap((note,index)=>{
            if (!scoreBeamConnects(notes,index,beamBreaks)) return []
            const previousNote = notes[index-1]
            const down = scoreBeamGroupStemDown(notes,index,beamBreaks)
            const stemX = (/** @type {number} */ midi) => `calc(8px + ${down ? .9 : 6.6}px * var(--tutorial-staff-scale) + ${accidental(midi) ? 4 : 0}px)`
            const startX = stemX(previousNote.midi)
            const endX = stemX(note.midi)
            const beamStyle = {left:`calc(${previousNote.beat*25}% + ${startX})`,width:`calc(${(note.beat-previousNote.beat)*25}% + ${endX} - ${startX} + 1px)`,'--beam-start':pitchTop(previousNote.midi),'--beam-end':pitchTop(note.midi),'--beam-second-start':down ? '-5px' : '5px','--beam-second-end':down ? '-5px' : '5px','--beam-start-offset':down ? 'var(--tutorial-stem-rise)' : 'calc(-1 * var(--tutorial-stem-rise))','--beam-end-offset':down ? 'var(--tutorial-stem-rise)' : 'calc(-1 * var(--tutorial-stem-rise))'}
            return [h('span',{class:'tutorial-slide-beam',style:beamStyle}), ...(currentLesson().settings?.slide === 'octave' && previousNote.duration < .5 && note.duration < .5 ? [h('span',{class:'tutorial-slide-beam tutorial-slide-beam-secondary',style:beamStyle})] : [])]
          }) : []),
          ...(pickupBeamStyle ? [
            h('span',{class:'tutorial-slide-beam',style:{
              ...pickupBeamStyle, left:'var(--pickup-stem-x)', width:`calc(${notes[1].beat*25}% + 1px)`,
            }}),
            h('span',{class:'tutorial-slide-beam tutorial-slide-beam-secondary',style:{
              ...pickupBeamStyle, left:`calc(${notes[1].beat*25}% + var(--pickup-stem-x) - 7px)`, width:'8px',
            }}),
          ] : []),
          ], notes, note:(n,index)=>{
            const hasBeam = (beamSlide && (scoreBeamConnects(notes,index,beamBreaks) || scoreBeamConnects(notes,index + 1,beamBreaks))) || (pickupPair && index < 2)
            const notationBeat = Math.round(n.beat * notationScale * 4) / 4
            const notationDuration = Math.round(n.duration * notationScale * 4) / 4
            const beatInMeasure = notationBeat - pickupBeats
            const measureIndex = Math.floor(beatInMeasure / (lesson.meter ?? 4))
            const dotY = pitches.indexOf(staffMidi(n.midi)) % 2 === 0 ? 15 : 19
            const sign = accidental(n.midi)
            const showSign = sign && !notes.slice(0,index).some(previous =>
              previous.midi === n.midi && Math.floor((Math.round(previous.beat * notationScale * 4) / 4 - pickupBeats) / (lesson.meter ?? 4)) === measureIndex)
            return scoreNote('span',{class:[{'tutorial-slide-note':isSlide(), 'tutorial-pitch-note':!lesson.freePitch, 'tutorial-accidental-note':!!accidental(n.midi), 'tutorial-connected-note':connectedRhythm, 'tutorial-connected-first':connectedRhythm && (index === 0 || notes[index-1].beat + notes[index-1].duration < n.beat - .001), 'tutorial-connected-last':connectedRhythm && (index === notes.length - 1 || n.beat + n.duration < notes[index+1].beat - .001)}]},[
            ...mergePlayedSegments(played.filter(p=>p.bar===laneBar && p.midi===n.midi && p.end>n.beat && p.start<n.beat+n.duration)).map(p=>{const start=Math.max(displayedResponseStart(p.start,n.beat),n.beat);return h('i',{class:'tutorial-played',style:{left:`${(start-n.beat)/n.duration*100}%`,width:`${Math.max(0,(Math.min(displayedResponseEnd(p.end,n.beat+n.duration,n.duration),n.beat+n.duration)-start)/n.duration)*100}%`}})}),
            scoreAccidental(showSign ? sign : ''),
            (isSlide() || !lesson.freePitch) ? tutorialPitchSymbol({midi:n.midi,duration:notationDuration,beam:!!hasBeam,stemDown:beamSlide && hasBeam ? scoreBeamGroupStemDown(notes,index,beamBreaks) : undefined,staccato:n.staccato,dotY}) : null,
            rhythmOnlyGuide || (advanced && (beatInMeasure < 0 ? index > 0 : beatInMeasure % (lesson.meter ?? 4) >= 1)) ? null : h('span',{class:['tutorial-note-label',{'tutorial-note-label-fa':!lesson.freePitch && n.midi % 12 === 5}]},lesson.freePitch && (n.duration >= 2 || n.duration < .5)
              ? h('svg',{class:'tutorial-note-symbol',viewBox:'0 0 16 24','aria-hidden':'true'},[
                h('ellipse',{cx:5,cy:19,rx:4,ry:2.8,transform:'rotate(-20 5 19)',fill:n.duration >= 2 ? 'none' : 'currentColor',stroke:'currentColor','stroke-width':1.5}),
                h('path',{d:'M8.8 19V2',fill:'none',stroke:'currentColor','stroke-width':1.5}),
                n.duration < .5 ? h('path',{d:'M9 2c1.4 2.4 5 3.4 4.2 7M9 6c1.4 2.4 5 3.4 4.2 7',fill:'none',stroke:'currentColor','stroke-width':1.5,'stroke-linecap':'round'}) : null,
              ])
              : lesson.freePitch ? (n.duration >= 1 ? '♩' : '♪') : `${names[pitches.indexOf(staffMidi(n.midi))]}${accidental(n.midi)}`),
          ], {beat:n.beat,duration:n.duration,laneBeats:4,omitWidth:isSlide(),top:rhythmOnlyGuide ? 'calc(49% - 14px)' : rhythmLane ? `${35+visibleRows.indexOf(durationRow(n.duration))*34}px` : pitchTop(n.midi)})}, after:[
          ['otto','you'].includes(phase) && laneBar === state.value.bar?h('span',{class:'tutorial-playhead',style:{left:`${beat*25}%`}}):null,
        ]}
        }}),
      ]),
      h('section',{class:['tutorial-user',{'tutorial-intro-focus':introFocus === 'keyboard'}],'aria-label':'あなたのけんばん'},[
        h('div',{class:['tutorial-keyboard',{'tutorial-keyboard-advanced':advanced}]},[
          ...keyboardPitches.map((m,i)=>h('button',{class:['tutorial-white',{'tutorial-upper-key':advanced && i>7,active:held.value===m || noteActive(m)}], 'data-midi':m, 'aria-label':`${pianoWhiteLabel(m)} ${m===84?'高いド':''}`,...keyEvents(m)},pianoWhiteLabel(m))),
          ...keyboardPitches.map((m,i)=>({m,i})).filter(({m,i})=>i<keyboardPitches.length-1 && [0,2,5,7,9].includes(m%12)).map(({m,i})=>h('button',{class:['tutorial-black',{'tutorial-upper-key':advanced && i>=7,active:held.value===m+1 || noteActive(m+1) || highlightedMidi===m+1}],'data-midi':m+1,style:{left:`calc(${i+1} * 100% / var(--tutorial-key-count))`,width:'calc(56% / var(--tutorial-key-count))'},'aria-label':lesson.flatNotes && m === 69 ? 'シ フラット' : `${pianoWhiteLabel(m)} シャープ`,...keyEvents(m+1)})),
          introSlide ? h('div',{class:['tutorial-slide-finger','tutorial-slide-intro',{'tutorial-slide-intro-down':message.value === 1}],key:message.value,'aria-hidden':'true'},'👆') : slidePosition === undefined ? null : h('div',{class:'tutorial-slide-finger',style:{left:`${(slidePosition + .5) * 12.5}%`},'aria-hidden':'true'},'👆'),
        ]),
      ]),
      ]),
    ]
  }})
  app.mount(root)
  // Keep free-play's document shortcuts out of this independent screen.
  const isolate = (/** @type {Event} */event)=>event.stopPropagation()
  root.addEventListener('keydown',isolate)
  root.addEventListener('keyup',isolate)
  const suspend = ()=>{
    if (!visible) return
    // Release held keys when focus moves, while the lesson keeps playing.
    midiHeld.clear()
    release()
    userVoice.silence()
  }
  window.addEventListener('blur',suspend)
  document.addEventListener('visibilitychange',()=>{if(document.hidden)suspend()})
  return {
    midiAttack(/** @type {number} */ midi) {
      if (!visible || !Number.isInteger(midi) || midi < 0 || midi > 127) return
      const continuing = midiHeld.size > 0 && held.value >= 0
      const beat = player.currentBeat()
      const continuingSlide = isSlide() && slideBar >= 0 && beat !== undefined
        && beat >= slideBar * 4 - .35 && beat < (slideBar + 1) * 4
      midiHeld.add(midi)
      if (!continuing && continuingSlide) {
        moveSlide(midi)
        void press(midi, true)
        return
      }
      if (!continuing) { void press(midi); beginSlide(midi); return }
      const previousMidi = held.value
      held.value = midi
      markEighthNote(midi)
      moveSlide(midi)
      userVoice.attack(midi,true)
      userVoice.release(previousMidi)
    },
    midiRelease(/** @type {number} */ midi) {
      midiHeld.delete(midi)
      if (held.value === midi) release(isSlide())
    },
    advanceMessage(){ if (visible) advance() },
    selectLesson(/** @type {number} */ index){ select(index); start() },
    open(restore = false){visible=true;const saved=readDevelopmentScreen('melody-lesson');const namedIndex=lessons.findIndex(lesson=>lesson.title===saved);const index=namedIndex>=0 ? namedIndex : saved === null ? 0 : Number(saved);selected.value=restore && Number.isInteger(index) && index>=0 && index<lessons.length ? index : 0;saveDevelopmentScreen('melody-lesson',currentLesson().title);sessionLevel.value=0;resetRetryTempo();start()},
    close(){visible=false;midiHeld.clear();stop()},
  }
}
