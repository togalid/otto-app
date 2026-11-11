import { createApp, h, ref } from './vendor/vue.runtime.esm-browser.prod.js'
import { Instrument } from './audio.js'
import { lessons, createTutorialPlayer, displayedResponseStart, mergePlayedSegments, responseComplete, recordTutorialSuccess, shortNoteTarget, tutorialNotes, isTutorialFreePitch, matchSlideNote } from './tutorial.js'
import { genres, BassSynth } from './groove.js'
import { DrumSynth } from './rhythm.js'

// Temporary local development entry; public hosting keeps the menu.
export const developmentTutorial = typeof location !== 'undefined' && ['localhost','127.0.0.1'].includes(location.hostname)
const pitches = [60,62,64,65,67,69,71,72]
const names = ['ド','レ','ミ','ファ','ソ','ラ','シ','ド']

/** Dedicated lesson screen; free-play settings and transport are never mutated.
 * @param {HTMLElement} root @param {(mode:string)=>void} navigate @param {()=>Promise<string>} connectMidi */
export function mountTutorial(root, navigate, connectMidi) {
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
      const beat = backingBeat++ % 4
      drums.hitAt('hat',time,.35,.08)
      drums.hitAt(beat % 2 === 0 ? 'kick' : 'snare',time,beat % 2 === 0 ? .55 : .38)
      if (beat % 2 === 0) bass.playAt(bassMidi,time,.52,.55)
    },
    silence() { backingBeat = 0; drums.silence(); bass.silence(); backingVoice.silence() },
  }
  const style = genres.find(item => item.id === 'pop')
  backingVoice.setTimbre(style?.chord ?? 'piano')
  drums.timbre = style?.drum ?? 'acoustic'
  bass.timbre = style?.bass ?? 'electric'
  voice.setTimbre('lead-round')
  userVoice.setTimbre('lead-round')
  const selected = ref(developmentTutorial ? 5 : 0), message = ref(0), dialogue = ref(true)
  const state = ref({phase:'idle',beat:0,bar:0,error:''})
  const held = ref(-1), feedback = ref(''), score = ref(0)
  const midiStatus = ref('MIDI接続')
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
  const isSlide = () => Boolean(lessons[selected.value].patterns)
  /** @type {ReturnType<typeof setTimeout>|undefined} */
  let clickTimer
  const responseNotes = (/** @type {number} */ bar) => tutorialNotes(lessons[selected.value],bar)
  const player = createTutorialPlayer({voice, accompaniment, onUpdate: next => {
    if (previous.phase === 'you' && next.phase === 'you' && previous.bar === next.bar && held.value >= 0 && !lessons[selected.value].freePitch && !isSlide()) {
      played.push({bar:next.bar,midi:held.value,start:previous.beat % 4,end:next.beat % 4})
      playedRevision.value++
    }
    if (previous.bar !== next.bar || previous.phase !== next.phase) feedback.value = ''
    if (next.phase === 'you' && (isSlide() ? successes.has(next.bar) : responseComplete(responseNotes(next.bar), played, next.bar))) {
      feedback.value = 'バッチリ！'
      if (recordTutorialSuccess(successes,next.bar,true)) { score.value = successes.size; playSuccess() }
    }
    previous = next; state.value = next
    if (['complete','error'].includes(next.phase)) release()
  }})
  function release(preserveSlide = false) {
    clearTimeout(clickTimer); pointer = undefined; pointerReady = false; revision++
    if (!preserveSlide) { slideBar = -1; slideMatched = 0 }
    if (held.value >= 0) userVoice.release(held.value)
    held.value = -1
  }
  function stop() { player.stop(); release(); userVoice.silence(); silenceSuccess() }
  function start() { stop(); slideProgress.value = 0; slideResultBar = -1; successes.clear(); score.value = 0; played.length = 0; playedRevision.value++; dialogue.value = true; message.value = 0; feedback.value = '' }
  /** @param {number} index */
  function select(index) { stop(); slideProgress.value = 0; slideResultBar = -1; successes.clear(); score.value = 0; played.length = 0; playedRevision.value++; selected.value = index; dialogue.value = false; feedback.value = '' }
  function nextLesson() {
    if (selected.value >= lessons.length - 1) return
    select(selected.value + 1)
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
    else { dialogue.value = false; void player.start(selected.value) }
  }
  /** @param {number} midi */
  function markEighthNote(midi) {
    if (isSlide()) return
    const beat = player.currentBeat()
    if (beat === undefined) return
    const lesson = lessons[selected.value]
    if (lesson.freePitch && !isTutorialFreePitch(selected.value,midi)) return
    const target = [1,3,5,7].map(bar => {
      const hit = shortNoteTarget(responseNotes(bar),midi,beat,lesson.freePitch)
      return hit?.bar === bar ? hit : undefined
    }).find(Boolean)
    if (!target) return
    const {note,bar} = target
    played.push({bar,midi:note.midi,start:note.beat,end:note.beat+note.duration})
    playedRevision.value++
    if (responseComplete(responseNotes(bar),played,bar)) {
      feedback.value = 'バッチリ！'
      if (recordTutorialSuccess(successes,bar,true)) { score.value = successes.size; playSuccess() }
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
      if (state.value.phase === 'you' && !isSlide()) {
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
        const bar = beat !== undefined && currentBar % 2 === 0 ? Math.floor((beat + .35) / 4) : currentBar
        if (isSlide() && bar >= 1 && bar <= 7 && bar % 2 === 1 && beat !== undefined) {
          const notes = responseNotes(bar)
          const matched = selected.value === 6 ? matchSlideNote(notes, 0, midi, beat - bar * 4) : Number(notes[0]?.midi === midi)
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
          if (beat !== undefined && beat >= slideBar * 4 - .35 && beat < (slideBar + 1) * 4) {
            if (selected.value === 6) {
              const matched = matchSlideNote(notes, slideMatched, next, beat - slideBar * 4)
              if (matched > slideMatched) {
                slideMatched = matched
                const note = notes[matched - 1]
                slideProgress.value = matched === notes.length ? 1 : (note.beat + note.duration) / (notes[notes.length - 1].beat + notes[notes.length - 1].duration)
              }
            } else {
              slideProgress.value = Math.max(slideProgress.value, Math.min(1, (next - first) / (last - first)))
            }
            const complete = selected.value === 6 ? slideMatched === notes.length : next === last
            if (complete && recordTutorialSuccess(successes,slideBar,true)) {
              feedback.value = 'バッチリ！'
              score.value = successes.size
              playSuccess()
            }
          }
        }
  }
  /** @param {number} midi */
  function keyEvents(midi) {
    const lift = (/** @type {PointerEvent} */event)=>{if(event.pointerId===pointer)release()}
    return {
      onPointerdown:(/** @type {PointerEvent} */event)=>{
        if(event.button!==0 || pointer!==undefined)return
        event.preventDefault();
        /** @type {HTMLElement} */(event.currentTarget).setPointerCapture(event.pointerId)
        void press(midi)
        pointer=event.pointerId
        beginSlide(midi)
      },
      onPointermove:(/** @type {PointerEvent} */event)=>{
        if (event.pointerId !== pointer) return
        const target = document.elementFromPoint(event.clientX,event.clientY)
        if (!target?.closest('.tutorial-keyboard')) {
          slideBar = -1
          slideMatched = 0
        }
        const key = target?.closest('.tutorial-keyboard [data-midi]')
        if (!(key instanceof HTMLElement)) return
        const next = Number(key.dataset.midi), previousMidi = held.value
        if (!Number.isInteger(next) || next === previousMidi) return
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
    const notes = tutorialNotes(lesson,state.value.bar)
    const connectedRhythm = (selected.value === 7 || selected.value === 8) && state.value.bar >= 4
    const rhythmLane = lesson.freePitch && !connectedRhythm
    const durationRow = (/** @type {number} */ duration) => duration >= 2 ? 3 : duration >= 1 ? 2 : duration >= .5 ? 0 : 1
    const visibleRows = [...new Set(notes.map(note => durationRow(note.duration)))].sort((a,b) => a-b)
    const keyboardPitches = pitches
    const phase = state.value.phase
    const running = ['loading','countdown','otto','you'].includes(phase)
    const beat = ((state.value.beat % 4) + 4) % 4
    const line = dialogue.value ? lesson.messages[message.value]
      : phase === 'otto' ? (selected.value === 8 && state.value.bar >= 4 ? '後半はスライドも使ってみよう！' : 'まずは聴いてみよう。次はあなたの番！')
      : phase === 'you' ? (lesson.freePitch ? '今度はあなた。リズムに合わせて、好きな音で！' : isSlide() ? '今度はあなた。押したまま、最後の音までなぞろう。' : '今度はあなた。一緒のフレーズを弾いてみよう。')
      : phase === 'countdown' ? '準備はいい？ ぼくから弾くから聞いててね。'
      : phase === 'complete' ? (selected.value < lessons.length-1 ? '8小節できたね！ 次のレッスンへすすもう！' : '8小節できたね！ フリー演奏でも遊んでみよう！')
      : phase === 'error' ? state.value.error : 'このレッスンを始めよう。'
    const lastNote = notes[notes.length - 1]
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
    return [
      h('div',{class:'tutorial-selector'},[
        h('button',{class:'tutorial-back',onClick:()=>navigate('menu')},'← メニュー'),
        h('button',{class:'tutorial-midi',onClick:async()=>{midiStatus.value = await connectMidi()}},midiStatus.value),
        h('div',{class:'part-choice-picker'},[
          h('select',{'aria-label':'チュートリアル番号',value:selected.value,onChange:(/** @type {Event} */ event)=>select(Number(/** @type {HTMLSelectElement} */(event.target).value))},['メロディ基礎','メロディ発展'].map((label,group)=>h('optgroup',{label},lessons.slice(group*5,group*5+5).map((l,i)=>h('option',{value:group*5+i},`No.${group*5+i+1} · ${l.title}`))))),
          h('div',{class:'part-choice-steps'},[
            h('button',{'aria-label':'前のチュートリアル',disabled:selected.value===0,onClick:()=>select(selected.value-1)},'←'),
            h('button',{'aria-label':'次のチュートリアル',disabled:selected.value===lessons.length-1,onClick:()=>select(selected.value+1)},'→'),
          ]),
        ]),
        running ? h('button',{class:'tutorial-start',onClick:()=>{stop();dialogue.value=false}},'■ 停止') : null,
      ]),
      h('div',{class:'tutorial-companion'},[
        h('div',{class:'talk-avatar','data-look':'headphones','aria-hidden':'true',innerHTML:drawing}),
        h(dialogue.value || phase==='idle' || phase==='error'?'button':phase==='complete'?'div':'p',{class:'tutorial-message',onClick:dialogue.value || phase==='idle' || phase==='error'?advance:undefined},[
          h('span',line),dialogue.value?h('small',`${message.value+1} / ${lesson.messages.length}　タップして${message.value===lesson.messages.length-1?'演奏へ':'次へ'} →`):phase==='idle' || phase==='error'?h('small','タップしてレッスンをスタート →'):null,
          phase==='complete'?h('div',{class:'tutorial-complete'},[
            h('button',{onClick:start},'もう一度'),
            selected.value<lessons.length-1?h('button',{onClick:nextLesson},'次のレッスン →'):h('button',{onClick:()=>navigate('free')},'フリー演奏へ'),
          ]):null,
        ]),
      ]),
      h('section',{class:'tutorial-demo','aria-label':'Ottoのけんばん'},[
        h('div',{class:'tutorial-caption'},[h('strong','Ottoのけんばん'),h('span',{role:'status'},phase==='otto'?'お手本を聴こう':phase==='you'?'あなたの番':phase==='complete'?'できた！':'')]),
        h('div',{class:'tutorial-demo-keys','aria-hidden':'true'},[
          ...pitches.map((m,i)=>h('span',{class:{active:noteActive(m)}},names[i])),
          slidePosition === undefined ? null : h('div',{class:'tutorial-slide-finger',style:{left:`${(slidePosition + .5) * 12.5}%`}},'👆'),
        ]),
      ]),
      h('section',{class:'tutorial-navigation','aria-label':'演奏ナビゲーション'},[
        h('div',{class:'tutorial-caption tutorial-navigation-header'},[h('div',{class:'tutorial-navigation-copy'},[h('div',{class:'tutorial-navigation-status'},[h('strong',phase==='countdown'?`あと ${Math.ceil(-state.value.beat)} 拍`:phase==='you'?'あなたが弾く':phase==='otto'?'Ottoが弾く':''),h('span',running && phase!=='countdown' && phase!=='loading'?`${Math.min(8,state.value.bar+1)} / 8 小節`:'')]),h('p',{class:'tutorial-feedback',role:'status'},phase==='loading'?'音を準備しています…':feedback.value || (lesson.freePitch ? (selected.value===7 ? 'スライドを使って弾いてみよう！' : 'ファとシ以外の白い鍵盤を弾いてみよう！') : 'Ottoの演奏を聴いたら、下の鍵盤でまねしてみよう'))]),h('div',{class:'tutorial-score',role:'status','aria-label':score.value===4?'4回成功、はなまる！':`成功 ${score.value} / 4回`},[
        score.value < 4 ? h('svg',{viewBox:'0 0 100 100','aria-hidden':'true'},[
          h('circle',{cx:50,cy:50,r:42,class:'tutorial-score-track'}),
          h('circle',{cx:50,cy:50,r:42,class:'tutorial-score-progress','stroke-dasharray':`${score.value*25} 100`,pathLength:100,transform:'rotate(-90 50 50)'}),
        ]) : null,
        h('span',{class:score.value===4?'tutorial-hanamaru':''},score.value===4?'💮':`${score.value}/4`),
      ])]),
        h('div',{class:['tutorial-note-lane',{'tutorial-rhythm-lane':rhythmLane}],style:rhythmLane?{height:`${Math.max(100,35+visibleRows.length*34)}px`}:undefined,'aria-hidden':'true'},[
          ...[0,1,2,3].map(b=>h('span',{class:'tutorial-beat-grid',style:{left:`${b*25}%`}},String(b+1))),
          ...Array.from({length:12},(_,i)=>{
            const subdivision = i + 1 + Math.floor(i / 3)
            return h('span',{class:['tutorial-subdivision',{'tutorial-subdivision-eighth':subdivision % 2 === 0}],style:{left:`${subdivision*6.25}%`}})
          }),
          ...(isSlide() ? [h('div',{
            class:'tutorial-slide-track',
            'data-up':lastNote.midi > notes[0].midi,
            style:{width:`${(lastNote.beat + lastNote.duration)*25}%`},
          },h('div',{class:'tutorial-slide-fill',style:{
            width:`${(successes.has(state.value.bar) ? 1 : slideResultBar === state.value.bar ? slideProgress.value : 0)*100}%`,
          }}))] : []),
          ...notes.map((n,index)=>h('span',{class:['tutorial-note',{'tutorial-slide-note':isSlide(), 'tutorial-connected-note':connectedRhythm, 'tutorial-connected-first':connectedRhythm && (index === 0 || notes[index-1].beat + notes[index-1].duration < n.beat - .001), 'tutorial-connected-last':connectedRhythm && (index === notes.length - 1 || n.beat + n.duration < notes[index+1].beat - .001)}],style:{left:`${n.beat*25}%`,width:isSlide() ? undefined : `${n.duration*25}%`,top:`${isSlide() ? 61 + (lastNote.midi > notes[0].midi ? 1 : -1) * (0.5 - n.beat / (lastNote.beat + lastNote.duration)) * 28 : rhythmLane ? 35 + visibleRows.indexOf(durationRow(n.duration)) * 34 : lesson.freePitch ? 47 : 35+(72-n.midi)*2}px`}},[
            ...mergePlayedSegments(played.filter(p=>p.bar===state.value.bar && p.midi===n.midi && p.end>n.beat && p.start<n.beat+n.duration)).map(p=>{const start=Math.max(displayedResponseStart(p.start,n.beat),n.beat);return h('i',{class:'tutorial-played',style:{left:`${(start-n.beat)/n.duration*100}%`,width:`${Math.max(0,(Math.min(p.end,n.beat+n.duration)-start)/n.duration)*100}%`}})}),
            isSlide() ? h('span',{class:'tutorial-slide-symbol'},n.duration < .5
              ? h('svg',{class:'tutorial-note-symbol',viewBox:'0 0 16 24','aria-hidden':'true'},[
                h('ellipse',{cx:5,cy:19,rx:4,ry:2.8,transform:'rotate(-20 5 19)',fill:'currentColor'}),
                h('path',{d:'M8.8 19V2 M9 2c1.4 2.4 5 3.4 4.2 7 M9 6c1.4 2.4 5 3.4 4.2 7',fill:'none',stroke:'currentColor','stroke-width':1.5,'stroke-linecap':'round'}),
              ]) : n.duration >= 1 ? '♩' : '♪') : null,
            h('span',{class:'tutorial-note-label'},lesson.freePitch && (n.duration >= 2 || n.duration < .5)
              ? h('svg',{class:'tutorial-note-symbol',viewBox:'0 0 16 24','aria-hidden':'true'},[
                h('ellipse',{cx:5,cy:19,rx:4,ry:2.8,transform:'rotate(-20 5 19)',fill:n.duration >= 2 ? 'none' : 'currentColor',stroke:'currentColor','stroke-width':1.5}),
                h('path',{d:'M8.8 19V2',fill:'none',stroke:'currentColor','stroke-width':1.5}),
                n.duration < .5 ? h('path',{d:'M9 2c1.4 2.4 5 3.4 4.2 7M9 6c1.4 2.4 5 3.4 4.2 7',fill:'none',stroke:'currentColor','stroke-width':1.5,'stroke-linecap':'round'}) : null,
              ])
              : lesson.freePitch ? (n.duration >= 1 ? '♩' : '♪') : names[pitches.indexOf(n.midi)]),
          ])),
          ['otto','you'].includes(phase)?h('span',{class:'tutorial-playhead',style:{left:`${beat*25}%`}}):null,
        ]),
      ]),
      h('section',{class:'tutorial-user','aria-label':'あなたのけんばん'},[
        h('div',{class:'tutorial-caption'},[h('strong',lesson.freePitch ? 'あなたのけんばん' : 'あなたのけんばん')]),
        h('div',{class:'tutorial-keyboard',style:{gridTemplateColumns:`repeat(${keyboardPitches.length},1fr)`}},[
          ...keyboardPitches.map((m)=>h('button',{class:['tutorial-white',{active:held.value===m, 'tutorial-avoid':lesson.freePitch && selected.value!==7 && (m===65 || m===71)}], 'data-midi':m, 'aria-label':`${names[pitches.indexOf(m)]} ${m===72?'高いド':''}`,...keyEvents(m)},names[pitches.indexOf(m)])),
          ...[0,1,3,4,5].map(i=>h('button',{class:['tutorial-black',{active:held.value===pitches[i]+1}],'data-midi':pitches[i]+1,style:{left:`${(i+1)*12.5}%`},'aria-label':`${names[i]} シャープ`,...keyEvents(pitches[i]+1)})),
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
      if (!visible || midi < 60 || midi > 72) return
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
    open(){visible=true;start()},
    close(){visible=false;midiHeld.clear();stop()},
  }
}
