import { TutorialCompanion, TutorialSelector, TutorialTempo, TutorialScore, tutorialCountLabel, playTutorialSuccess } from './tutorial-view.js'
import { createApp, h, ref } from './vendor/vue.runtime.esm-browser.prod.js'
import { audioContext, Instrument } from './audio.js'
import { BassSynth, swungBassBeat, genres } from './groove.js'
import { readDevelopmentScreen, saveDevelopmentScreen, playTutorialCount } from './tutorial.js'

export const drumPads = Object.freeze([
  {name:'ハイハット',sound:'hat',hand:'左',finger:'薬指',key:'a',pan:-.24,level:.72},
  {name:'スネア',sound:'snare',hand:'左',finger:'中指',key:'s',pan:-.08,level:.9},
  {name:'スネア',sound:'snare',hand:'右',finger:'中指',key:'k',pan:.08,level:1},
  {name:'ハイハット',sound:'hat',hand:'右',finger:'薬指',key:'l',pan:.24,level:.85},
  {name:'オープンハット',sound:'open',hand:'左',finger:'薬指',key:'z',pan:-.3,level:.65},
  {name:'キック',sound:'kick',hand:'左',finger:'人差し指',key:'x',pan:-.03,level:.9},
  {name:'キック',sound:'kick',hand:'右',finger:'人差し指',key:'m',pan:.03,level:1},
  {name:'オープンハット',sound:'open',hand:'右',finger:'薬指',key:',',pan:.3,level:.7},
])
/** @param {number[]} beats @param {number} pad */
const strokes=(beats,pad)=>beats.map(beat=>({beat,pad}))
const alternatingHats=(step=.5)=>Array.from({length:4/step},(_,i)=>({beat:i*step,pad:i%2?0:3}))
const backbeat=strokes([1,3],2)
const sixteenBeatPattern=[...alternatingHats(.25),...backbeat,...strokes([0,2],6)]
// Eighths at double the practice tempo, with a gentle groove.
const discoChords = [[53,60,64,69],[53,59,64,69]] // Dm9, G13 (bass supplies the root)
const discoRoots = [38,43]
const advancedStages=[
  {title:'16ビート',tempo:55,grid:16,practice:'ハイハットは左右交互に。1・3拍目にキック、2・4拍目にスネアを重ねよう。',message:'前半と同じ16ビートを、伴奏に合わせて叩こう。',
    patterns:[sixteenBeatPattern,sixteenBeatPattern]},
  {title:'四つ打ち',tempo:110,grid:8,practice:'キックを続けながら、拍の裏で左のオープンハット、2拍目と4拍目にスネアを叩こう。',message:'キックを続けながら、拍の裏で左のオープンハット、2拍目と4拍目にスネアを叩こう。',
    patterns:[strokes([0,1,2,3],6),[...strokes([0,1,2,3],6),...strokes([.5,1.5,2.5,3.5],4),...backbeat]]},
  {title:'ハーフタイム',tempo:72,grid:8,practice:'3拍目のスネアを目印に、ハイハットと裏拍のキックを重ねよう。',message:'3拍目のスネアを目印に、ハイハットと裏拍のキックを重ねよう。',
    patterns:[[...strokes([0],6),...strokes([2],2)],[...alternatingHats(),...strokes([0,2.5],6),...strokes([2],2)]]},
  {title:'シャッフル',tempo:66,grid:12,practice:'跳ねるハイハットに、1・3拍目のキックと2・4拍目のスネアを重ねよう。',message:'跳ねるハイハットに、1・3拍目のキックと2・4拍目のスネアを重ねよう。',
    patterns:[0,1].map(part=>[...strokes([0,1,2,3],3),...strokes([2/3,5/3,8/3,11/3],0),...(part?[...backbeat,...strokes([0,2],6)]:[])])},
  {title:'2ステップ',tempo:76,grid:8,practice:'キックとスネアの間にハイハットを入れて、2ステップのノリで合わせよう。',message:'キックとスネアの間にハイハットを入れて、2ステップのノリで合わせよう。',
    patterns:[[...strokes([0,2.5],6),...backbeat],[...strokes([0,2.5],6),...backbeat,...strokes([0,2],3),...strokes([.5,1.5,2.5,3.5],0)]]},
]
/** Eighth-note hats alternate; backbeat and kick are progressively added.
 * @param {number} stage @returns {{beat:number,pad:number}[]} */
export function drumLessonPattern(stage, exercise=stage===2?0:1) {
  const advanced=advancedStages[stage-5]
  if(advanced)return [...advanced.patterns[1]].sort((a,b)=>a.beat-b.beat)
  if(stage===4 && exercise===0) return Array.from({length:4},(_,beat)=>[{beat,pad:3},{beat,pad:6},{beat:beat+.5,pad:0},{beat:beat+.5,pad:5}]).flat()
  if(stage===1 && exercise===0) return Array.from({length:4},(_,beat)=>beat%2 ? [{beat,pad:3},{beat,pad:2}] : [{beat,pad:3}]).flat()
  if(stage===2 && exercise===0) return Array.from({length:4},(_,beat)=>[{beat,pad:3},{beat,pad:beat%2?2:6}]).flat()
  const hits = Array.from({length:8}, (_,i)=>({beat:i/2,pad:i%2 ? 0 : 3}))
  if(stage>=1) hits.push({beat:1,pad:2},{beat:3,pad:2})
  if(stage>=3 || (stage===2 && exercise===1)) hits.push({beat:0,pad:6},{beat:2,pad:6})
  if(stage===4) hits.push({beat:2.5,pad:5})
  return hits.sort((a,b)=>a.beat-b.beat)
}
/** @param {{beat:number,pad:number}[]} pattern @param {number} pad @param {number} beat @param {Set<number>} matched */
export function matchDrumHit(pattern,pad,beat,matched) {
  let result=-1, distance=Infinity
  pattern.forEach((hit,index)=>{
    const delta=Math.abs(hit.beat-beat)
    const tolerance=hit.beat===0?.30:.23
    if(hit.pad===pad&&!matched.has(index)&&delta<tolerance&&delta<distance){result=index;distance=delta}
  })
  return result
}
/** Map an early first-beat hit to the upcoming user bar.
 * @param {number} beat @returns {{bar:number,local:number}|null} */
export function drumUserHitPosition(beat) {
  if(beat<0 || beat>=16) return null
  const bar=Math.floor(beat/4), local=beat%4
  if(bar%2===1) return {bar,local}
  if(local>=3.7 && bar+1<4) return {bar:bar+1,local:local-4}
  return null
}
/** @param {number} beat */
export function drumSessionHitPosition(beat,early=.3) {
  if(beat>=-early && beat<0)return {bar:0,local:beat}
  if(beat<0 || beat>=32)return null
  const bar=Math.floor(beat/4), local=beat%4
  return local>=4-early && bar<7 ? {bar:bar+1,local:local-4} : {bar,local}
}
/** Match the nearest unclaimed hit across adjacent session bars.
 * @param {{beat:number,pad:number}[]} pattern @param {number} pad @param {number} beat
 * @param {Map<number,Set<number>>} matchedByBar @param {number} [early]
 */
export function matchDrumSessionHit(pattern,pad,beat,matchedByBar,early=.3) {
  let best=null, distance=Infinity
  for(const bar of [Math.floor(beat/4)-1,Math.floor(beat/4),Math.floor(beat/4)+1]) {
    if(bar<0 || bar>=8 || beat< -early || beat>=32 || beat-bar*4 < -early)continue
    const local=beat-bar*4, matched=matchedByBar.get(bar) ?? new Set()
    const index=matchDrumHit(pattern,pad,local,matched)
    if(index>=0 && Math.abs(local-pattern[index].beat)<distance){best={bar,index};distance=Math.abs(local-pattern[index].beat)}
  }
  return best
}
export const DRUM_LESSON_BPM = 50
/** @param {number} eighthStep */
export function isDrumMetronomeBeat(eighthStep) { return eighthStep >= 0 && eighthStep < 32 && eighthStep % 2 === 0 }
const drumIntro = [
  {line:'ドラムチュートリアルへようこそ！ ここでは指を使って、パッドというボタンを叩いて音を鳴らしていくよ。', pads:[]},
  {line:'四角いボタンがドラムのパッドだよ。タップすると音が鳴るよ。鳴らしてみよう！', pads:[]},
  {line:'ハイハットっていう色のついたパッドに、両手の薬指を乗せてみて。', pads:[0,3]},
  {line:'右・左・右・左と交互に鳴らす練習をしてみよう。', pads:[0,3]},
]

const stages = [
  {title:'左右のハイハット',message:'右手の薬指、左手の薬指を交互に。外側のハイハットを「右・左・右・左」と叩こう。'},
  {title:'スネアを加えよう',message:'ハイハットを続けながら、2拍目と4拍目に右手の中指でスネア。右のハイハットと一緒に叩こう。'},
  {title:'キックを加えて8ビート',message:'右手だけで練習しよう。キックは人差し指で叩くよ。ハイハットとキック、ハイハットとスネアを1拍ずつ交互に叩こう。'},
  {title:'8ビートでセッション',message:'覚えた8ビートで8小節叩いてみよう！ ぼくはメロディを弾くね。'},
  {title:'キックをひとつ加えよう',message:'3拍目の裏で、左手のハイハットとキックを一緒に叩こう。左キックは人差し指だよ。'},
  ...advancedStages,
]

/** Small instrument illustrations keep the pad names easy to recognize. @param {string} sound */
export function padIcon(sound) {
  const common={viewBox:'0 0 32 32','aria-hidden':'true',class:'drum-pad-icon'}
  if(sound==='kick') return h('svg',common,[h('circle',{cx:16,cy:16,r:11}),h('circle',{cx:16,cy:16,r:7}),h('path',{d:'M9 25l-2 3m16-3 2 3'})])
  if(sound==='snare') return h('svg',common,[h('path',{d:'M5 12 Q16 8 27 12 L25 23 Q16 27 7 23 Z'}),h('path',{d:'M5 12 Q16 16 27 12 M8 20 Q16 23 24 20 M10 4l12 8 M22 4 10 12'})])
  return h('svg',common,[h('path',{d:'M3 13 Q16 6 29 13 Q16 16 3 13 Z M16 8V4 M16 15v13 M10 28h12'}),...(sound==='open'?[h('path',{d:'M5 19 Q16 23 27 19'})]:[])])
}

/** One self-contained lesson; no changes to free-play instruments or settings.
 * @param {HTMLElement} host @param {()=>void} onBack */
export function mountDrumTutorial(host,onBack) {
  const state=ref({stage:0,exercise:0,introStep:0,tempo:50,phase:'intro',message:stages[0].message,countIndex:0,beat:-1,bar:0,score:0,error:'',lit:/** @type {number[]} */([]),pressed:/** @type {number[]} */([]),matched:/** @type {number[]} */([])}).value
  let visible=false, generation=0, origin=0, tick=0, frame=0, nextBar=0, judgedBar=-1, displayedBar=-1
  /** @type {AudioContext|undefined} */ let context
  /** @type {GainNode|undefined} */ let master
  /** @type {AudioBuffer|undefined} */ let noise
  /** @type {Set<AudioScheduledSourceNode>} */ const sources=new Set()
  /** @type {Map<number,number>} */ const flashes=new Map()
  /** @type {Set<number>} */ let matches=new Set()
  /** @type {Map<number,Set<number>>} */ const sessionMatches=new Map()
  /** @type {Set<OscillatorNode>} */ const successSounds=new Set()
  const backing=new Instrument('chord'), melody=new Instrument('melody'), countVoice=new Instrument('chord'), bass=new BassSynth(backing)
  countVoice.setTimbre(genres.find(item=>item.id==='pop')?.chord ?? 'piano')
  backing.setTimbre('piano'); melody.setTimbre('lead-round'); bass.setVolume(.25)
  let secondsPerBeat=60/DRUM_LESSON_BPM
  const advanced=()=>advancedStages[state.stage-5]
  const split=()=>[1,2,4].includes(state.stage)||Boolean(advanced())
  const session=()=>state.stage===3 || (Boolean(advanced()) && state.exercise===1)
  const defaultTempo=()=>advanced()?.tempo ?? (state.stage===3?80:DRUM_LESSON_BPM)
  const goal=()=>currentPattern().length*(session()?8:2)
  /** @param {number} time @param {boolean} accent */
  function metronome(time,accent) {
    if(!context||!master)return
    const oscillator=context.createOscillator(), gain=context.createGain()
    oscillator.type='sine'; oscillator.frequency.value=accent?1100:850
    gain.gain.setValueAtTime(accent?.15:.10,time)
    gain.gain.exponentialRampToValueAtTime(.001,time+.045)
    oscillator.connect(gain);gain.connect(master);sources.add(oscillator)
    oscillator.onended=()=>{sources.delete(oscillator);oscillator.disconnect();gain.disconnect()}
    oscillator.start(time);oscillator.stop(time+.05)
  }
  /** @param {number} pad @param {number} time */
  function sound(pad,time) {
    if(!context||!master||!noise)return
    const config=drumPads[pad], ctx=context
    const pan=ctx.createStereoPanner();pan.pan.value=config.pan
    const amp=ctx.createGain();amp.connect(pan);pan.connect(master)
    const length=config.sound==='open'?.24:config.sound==='hat'?.07:config.sound==='snare'?.15:.24
    amp.gain.setValueAtTime(config.level*(config.sound==='kick'?.6:config.sound==='snare'?.3:.14),time)
    amp.gain.exponentialRampToValueAtTime(.001,time+length)
    /** @type {AudioScheduledSourceNode} */ let source
    /** @type {BiquadFilterNode|undefined} */ let filter
    if(config.sound==='kick') {
      const oscillator=ctx.createOscillator();oscillator.frequency.setValueAtTime(config.hand==='右'?130:125,time)
      oscillator.frequency.exponentialRampToValueAtTime(45,time+.12);oscillator.connect(amp);source=oscillator
    } else {
      const buffer=ctx.createBufferSource();buffer.buffer=noise;filter=ctx.createBiquadFilter()
      filter.type='highpass';filter.frequency.value=config.sound==='snare'?1100:config.hand==='右'?6800:7300
      buffer.connect(filter);filter.connect(amp);source=buffer
    }
    sources.add(source)
    source.onended=()=>{sources.delete(source);source.disconnect();filter?.disconnect();amp.disconnect();pan.disconnect()}
    source.start(time);source.stop(time+length+.02)
  }
  async function ready() {
    const ticket=generation
    context=audioContext();await context.resume()
    if(ticket!==generation||!visible)return
    if(context.state!=='running')throw new Error('音を準備できませんでした。もう一度タップしてね。')
    if(!master){master=context.createGain();master.gain.value=.7;master.connect(context.destination)}
    if(!noise){noise=context.createBuffer(1,Math.ceil(context.sampleRate*.4),context.sampleRate);const data=noise.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1}
  }
  function cancel() {
    generation++;window.clearInterval(tick);cancelAnimationFrame(frame)
    backing.silence();melody.silence();countVoice.silence();bass.silence()
    successSounds.forEach(source=>{try{source.stop()}catch{}});successSounds.clear()
    sources.forEach(source=>{try{source.stop()}catch{}});sources.clear()
    flashes.forEach(timer=>window.clearTimeout(timer));flashes.clear()
    state.lit=[];state.pressed=[];state.beat=-1
  }
  const currentPattern=()=>drumLessonPattern(state.stage,split() ? state.exercise : 1)
  function finish() {
    cancel();
    if(split() && state.exercise===0){state.phase='practiceComplete';state.message=advanced()?'前半おつかれさま！ 次は伴奏に合わせて叩いてみよう。':state.stage===4?'同時押しを練習できたね！ 次は8ビートに加えてみよう。':'右手の練習ができたね！ 次は左手も加えてみよう。';return}
    state.phase='complete';state.message=state.score===goal()?'すごい！ぜんぶバッチリ！ 次のレッスンも楽しもう！':state.stage===stages.length-1?(state.score>=goal()*.7?'セッションできたね！ いいリズムだったよ！':'最後まで練習したね。もう一度、ゆっくり合わせてみよう！'):'よく頑張ったね！ 次はもっとうまく叩けるよ！'
  }
  function animate() {
    if(!context||!visible||!['count','play'].includes(state.phase))return
    const beat=(context.currentTime-origin)/secondsPerBeat
    if(beat>=(session()?32:16)){finish();return}
    if(beat<0){state.phase='count';state.countIndex=Math.min(3,Math.max(0,Math.floor(beat+4)));state.message=session()?(state.stage===5||state.stage===6?'カウントのあと、伴奏に合わせて叩こう！':'カウントのあと、ぼくのメロディに合わせて叩こう！'):'まず僕がお手本を叩くね。その後に君も真似して叩いてみてね。';state.beat=-1}
    else {
      const bar=Math.floor(beat/4),local=beat%4
      if(displayedBar!==bar){displayedBar=bar;if(judgedBar!==bar)state.matched=[]}
      state.phase='play';state.bar=bar;state.beat=local
      state.message=session()?`${bar+1} / 8小節　${advanced()?.message ?? '8ビートを続けよう！'}`:state.stage===1 && state.exercise===0?'右手の薬指でハイハット。2拍目と4拍目は中指でスネアも一緒に叩こう。':state.stage===0?'右・左・右・左……タイミングよく薬指で鳴らそう。':advanced()?.practice ?? (bar%2?'あなたの番。光るパッドに合わせて叩こう！':state.stage===2 && state.exercise===0?'右手の動きを見てね。':'左右の手の動きを見てね。')
      if(session()) state.matched=[...(sessionMatches.get(bar) ?? [])]
      else if(bar%2===1 && judgedBar<bar){judgedBar=bar;matches=new Set();state.matched=[]}
      const pattern=currentPattern()
      state.lit=pattern.filter(hit=>local>=hit.beat&&local<hit.beat+.18).map(hit=>hit.pad)
    }
    frame=requestAnimationFrame(animate)
  }
  async function start() {
    cancel();const ticket=generation;state.error='';state.phase='loading';secondsPerBeat=60/(Number.isFinite(state.tempo) && state.tempo>=40 && state.tempo<=180 ? state.tempo : defaultTempo())
    try {
      await ready();if(ticket!==generation||!visible)return
      backing.setTimbre(state.stage===6?'supersaw':'piano');melody.setTimbre(state.stage===6?'lead-supersaw':'lead-round');bass.timbre=state.stage===6?'synth':'electric'
      await Promise.all([countVoice.ready(), ...(session() ? [backing.ready(),melody.ready()] : [])]);if(ticket!==generation||!visible)return
      origin=/** @type {AudioContext} */(context).currentTime+4*secondsPerBeat+.12
      state.score=0;matches=new Set();sessionMatches.clear();state.matched=[];nextBar=-1;judgedBar=-1;displayedBar=-1;state.phase='count'
      const accompanied=session()
      const pattern=currentPattern()
      const discoSession=accompanied && state.stage===5
      // The disco backing fits two accompaniment beats into each practice beat.
      const backingBeatsPerBeat=discoSession?2:1
      const ticksPerBeat=12*backingBeatsPerBeat
      const backingBeatSeconds=secondsPerBeat/backingBeatsPerBeat
      const schedule=()=>{
        if(!context)return
        const horizon=context.currentTime+.12
        // Only schedule shortly ahead, so stopping never leaves a whole lesson queued.
        while(nextBar<(accompanied?32:16)*ticksPerBeat && origin+nextBar/ticksPerBeat*secondsPerBeat<=horizon){
          const at=nextBar/ticksPerBeat
          const atTime=origin+at*secondsPerBeat
          if(accompanied && state.stage===6 && nextBar%3===0){
            // A quiet sixteenth-note arpeggio adds motion around the player's beat.
            const bar=Math.floor(at/4), step=(nextBar/3)%16
            const arp=[[69,72,76,72],[65,69,72,69],[67,72,76,72],[67,71,74,71]]
            melody.playAt([arp[bar%4][step%4]+(step>=8?12:0)],atTime,secondsPerBeat*.16,step%4===0?.24:.17)
          }
          if(discoSession && nextBar%6===0){
            const eighth = nextBar/6
            const bar = Math.floor(eighth/8)
            const step = eighth%8
            const harmony = Math.floor(bar/2)%2
            const offbeat = step%2===1
            const root = discoRoots[harmony]
            const grooveTime = origin + swungBassBeat(eighth, 20) * backingBeatSeconds
            bass.playAt(root+(offbeat?12:0),grooveTime,backingBeatSeconds*(offbeat?.29:.42),offbeat?.60:.88)
            if(offbeat) {
              backing.playAt(discoChords[harmony],grooveTime,backingBeatSeconds*.25,.30)
            }
          }else if(accompanied && state.stage===6 && nextBar%6===0){
            const step=(nextBar/6)%8, bar=Math.floor(at/4)
            const chords=[[57,60,64],[53,57,60],[60,64,67],[55,59,62]], roots=[33,29,36,31]
            if(step%2===1){
              bass.playAt(roots[bar%4]+(step===7 && bar%2===1?12:0),atTime,secondsPerBeat*.38,.9)
              backing.playAt(chords[bar%4],atTime,secondsPerBeat*.38,.38)
            }
          }else if(accompanied && !discoSession && nextBar%6===0){
            const bar=Math.floor(at/4), step=(nextBar/6)%8
            const chords=[[60,64,67],[57,60,64],[53,57,60],[55,59,62]], roots=[36,33,29,31], lead=[[[0,72,1],[2,76,1],[4,79,2],[7,76,.5]],[[0,76,1],[3,74,.5],[4,72,2]],[[0,69,1],[2,72,.5],[3,74,.5],[4,76,2]],[[0,79,1.5],[3,76,.5],[4,74,1],[6,71,1]],[[0,76,1],[2,79,.5],[3,81,.5],[4,79,2]],[[0,81,1],[2,76,1],[4,72,1],[6,69,1]],[[0,69,2],[4,72,.5],[5,74,.5],[6,76,1]],[[0,74,.5],[1,71,.5],[2,67,1],[4,71,1],[6,72,1]]]
            if(step===0 || step===4)backing.playAt(chords[bar%4],atTime,secondsPerBeat*1.6,.24)
            if(step%2===0)bass.playAt(roots[bar%4],atTime,secondsPerBeat*.75,.5)
            for(const [onset,pitch,duration] of lead[bar%8]) if(onset===step)melody.playAt([pitch],atTime,secondsPerBeat*duration*.85,.35)
          }else if(!accompanied){
            if(nextBar%ticksPerBeat===0)metronome(atTime,nextBar%(4*ticksPerBeat)===0)
            if(Math.floor(at/4)%2===0)pattern.filter(hit=>Math.round(hit.beat*ticksPerBeat)===nextBar%(4*ticksPerBeat)).forEach(hit=>sound(hit.pad,atTime))
          }
          nextBar++
        }
      }
      // Four quiet quarter-note clicks before the first demonstration.
      for(let i=0;i<4;i++)playTutorialCount(countVoice,origin-(4-i)*secondsPerBeat,i===0)
      nextBar=0;schedule();tick=window.setInterval(schedule,25);animate()
    } catch(error) {if(ticket!==generation)return;state.phase='intro';state.error=error instanceof Error?error.message:'音を準備できませんでした。'}
  }
  /** @param {number} pad */
  async function hit(pad) {
    const ticket=generation
    const hitTime=context?.currentTime
    try {
      await ready();if(!visible||ticket!==generation||!context)return
      sound(pad,context.currentTime+.005)
      window.clearTimeout(flashes.get(pad));state.pressed=[...new Set([...state.pressed,pad])]
      flashes.set(pad,window.setTimeout(()=>{state.pressed=state.pressed.filter(value=>value!==pad);flashes.delete(pad)},120))
      if(state.phase==='play' || (session() && state.phase==='count')) {
        const beat=((hitTime ?? context.currentTime)-origin)/secondsPerBeat
        if(session()) {
          const pattern=currentPattern(), hit=matchDrumSessionHit(pattern,pad,beat,sessionMatches,advanced()?.grid===16?.125:.3)
          if(hit){const matched=sessionMatches.get(hit.bar) ?? new Set();matched.add(hit.index);sessionMatches.set(hit.bar,matched);if(state.phase==='play' && state.bar===hit.bar)state.matched=[...matched];state.score++;if(matched.size===pattern.length)playTutorialSuccess(context,successSounds)}
          return
        }
        const position=drumUserHitPosition(beat)
        if(position){
          const {bar,local}=position
          if(judgedBar<bar){judgedBar=bar;matches=new Set();state.matched=[]}
          if(judgedBar!==bar)return
          const pattern=currentPattern(),index=matchDrumHit(pattern,pad,local,matches)
          if(index>=0){matches.add(index);state.matched=[...matches];state.score++; if(matches.size===pattern.length) playTutorialSuccess(context,successSounds)}
        }
      }
    }catch(error){state.error=error instanceof Error?error.message:'音を準備できませんでした。'}
  }
  function advanceMessage() {if(!visible)return;if(state.phase==='intro'){
      if(state.stage===0 && state.introStep<drumIntro.length-1){state.introStep++;return}
      void start()
    }else if(state.phase==='complete'&&state.stage<stages.length-1){selectStage(state.stage+1)}}
  const onKey=/** @param {KeyboardEvent} event */event=>{
    if(!visible||event.repeat||event.metaKey||event.ctrlKey||event.altKey)return
    const pad=drumPads.findIndex(p=>p.key===event.key.toLowerCase())
    if(pad>=0){event.preventDefault();void hit(pad)}
  }
  const drawing = document.querySelector('#oto-buddy svg')?.outerHTML ?? ''
  function selectStage(/** @type {number} */ stage) {
    cancel()
    state.stage = stage
    saveDevelopmentScreen('drum-lesson', String(stage))
    state.exercise = 0
    state.tempo = defaultTempo()
    state.introStep = 0
    state.phase = 'intro'
    state.message = advanced()?.practice ?? stages[stage].message
    state.score = 0
    state.matched = []
    state.error = ''
  }
  createApp({render:()=>{
    const pattern=currentPattern()
    const grid=advanced()?.grid ?? 8
    const gridSteps=Array.from({length:grid},(_,i)=>i)
    const slotsPerBeat=grid/4
    const gridLine=(/** @type {number} */ i)=>i%slotsPerBeat===0?'drum-grid-beat':grid===16 && i%2===1?'drum-grid-sixteenth':'drum-grid-eighth'
    const rows=[3,7,2,6,5,1,4,0].filter(pad=>(state.stage===4 && (pad===1 || pad===2)) || pattern.some(hit=>hit.pad===pad))
    const firstLeft=rows.findIndex(pad=>drumPads[pad].hand==='左')
    const intro=state.phase==='intro' && state.stage===0 ? drumIntro[state.introStep] : undefined
    const placementPads=intro?.pads ?? (state.phase==='intro' ? (state.stage===1 ? (state.exercise===0 ? [2,3] : [0,2,3]) : state.stage===2 ? (state.exercise===0 ? [6] : [0,2,3,6]) : state.stage===4 ? (state.exercise===0 ? [0,3,5,6] : [0,5]) : state.stage===6 ? [4] : []) : [])
    return h('div',{class:'drum-lesson'},[
    h(TutorialSelector,{
      onBack,onSelect:selectStage,index:state.stage,count:stages.length,label:'ビート編のレッスン',
      options:stages.map((stage,i)=>h('option',{value:i},`No.${i+1} · ${stage.title}${i>=5?'（応用）':''}`)),
      onStop:['play','count','loading'].includes(state.phase)?()=>selectStage(state.stage):undefined,
    }),
    h(TutorialCompanion,{
      drawing,line:intro?.line ?? (state.phase==='intro' && state.stage===4 && state.exercise===0 ? '右ハイハットと右キック、次に左ハイハットと左キックを一緒に叩こう。4回繰り返してみよう。' : state.phase==='intro' && state.stage===1 && state.exercise===0 ? 'まず右手だけで練習しよう。薬指でハイハット、2拍目と4拍目は中指でスネアも一緒に叩こう。' : state.message),error:state.error,happy:state.phase==='complete',perfect:state.phase==='complete' && state.score===goal(),
      advance:state.phase==='intro'?advanceMessage:undefined,
      hint:state.phase==='intro'?(intro && state.introStep<drumIntro.length-1?`${state.introStep+1} / ${drumIntro.length}　タップして次へ →`:'準備ができたらタップしてスタート →'):undefined,
      actions:state.phase==='practiceComplete'?[h('button',{type:'button',onClick:()=>{state.exercise=1;if(advanced()){void start();return}state.phase='intro';state.message=state.stage===4?stages[4].message:state.stage===2?'今度は1拍目と3拍目に右手の人差し指でキックも加えよう。ハイハットと一緒に叩けば8ビート！':stages[1].message;state.score=0;state.matched=[]}},advanced()?'後半：伴奏に合わせる →':state.stage===4?'8ビートに加える →':'左手も加える →'),h('button',{type:'button',onClick:()=>void start()},'もう一度'),h(TutorialTempo,{value:state.tempo,onTempoUpdate:(/** @type {number} */ value)=>{state.tempo=value}})]:state.phase==='complete'?[
        h('button',{type:'button',onClick:()=>void start()},'もう一度'),
        h(TutorialTempo,{value:state.tempo,onTempoUpdate:(/** @type {number} */ value)=>{state.tempo=value}}),
        state.stage<stages.length-1
          ? h('button',{type:'button',onClick:advanceMessage},'次のレッスン →')
          : h('button',{type:'button',onClick:onBack},'チュートリアルへ'),
      ]:undefined,
    }),
    h('section',{class:'drum-lesson-guide',style:{'--drum-grid-columns':grid},'aria-label':'ドラムのリズム'},[
      h('div',{class:'drum-guide-heading'},[h('strong',state.phase==='count'?tutorialCountLabel(4-state.countIndex):state.phase==='play'?(session()?'あなたが叩く':state.bar%2?'あなたが叩く':'Ottoが叩く'):session()?'8小節セッション':advanced()?'前半：リズムの練習':'まずはお手本を聴こう'),h('div',{class:'drum-guide-hands','aria-label':'左右の手'},['左','右'].map(hand=>h('div',{class:'drum-guide-hand'},[
        h('svg',{viewBox:'0 0 60 64',class:hand==='左'?'drum-hand-left':'','aria-hidden':'true'},[
          h('path',{class:'drum-hand-palm',d:'M21 60 Q19 54 14 50 Q10 46 7 40 L3 33 Q1 29 4 27 Q7 25 10 29 L16 36 L14 15 Q14 11 17 11 Q21 10 22 15 L25 29 L25 8 Q25 3 29 3 Q33 3 33 8 L34 28 L37 11 Q38 7 41 8 Q45 8 44 13 L42 31 L47 19 Q49 15 52 17 Q55 18 53 23 L49 40 Q48 50 42 55 L41 60 Z'}),
          ...[
            ['親指','M4 28 Q7 26 10 30 L15 36 Q13 40 10 39 L4 32 Q2 30 4 28 Z'],
            ['人差し指','M15 15 Q15 12 18 12 Q20 12 21 16 L24 29 Q22 31 19 30 Z'],
            ['中指','M26 8 Q26 4 29 4 Q32 4 32 8 L33 27 Q30 30 26 27 Z'],
            ['薬指','M38 12 Q39 8 41 9 Q44 9 43 13 L41 29 Q38 31 35 28 Z'],
          ].map(([finger,d])=>{
            const matches=/** @param {number} i */ i=>drumPads[i].hand===hand && drumPads[i].finger===finger
            const active=state.pressed.some(matches) || (state.phase==='play' && !session() && state.bar%2===0 && state.lit.some(matches))
            const hint=placementPads.some(matches)
            return h('path',{d,class:'drum-hand-active','data-hint':hint && !active?'':undefined,visibility:active || hint?'visible':'hidden'})
          }),
        ]),h('span',hand+'手'),
      ]))),h(TutorialScore,{score:state.score,goal:goal()})]),
      h('div',{class:'drum-timeline'},[
        h('div',{class:'drum-timeline-grid','aria-hidden':'true'},gridSteps.map(i=>h('span',{class:gridLine(i)},i%slotsPerBeat?'':String(i/slotsPerBeat+1)))),
        state.phase==='play'?h('span',{class:'drum-playhead','aria-hidden':'true',style:{left:`${state.beat*25}%`,height:`${30+rows.length*28}px`}}):null,
      ]),
      ...rows.map((pad,row)=>h('div',{class:'drum-guide-row','data-hand-divider':firstLeft>0 && row===firstLeft?'':undefined},[h('small',{'data-highlight':state.stage===6 && pad===4?'':undefined},`${drumPads[pad].hand} ${drumPads[pad].name}`),...gridSteps.map(i=>{
        const index=pattern.findIndex(hit=>hit.pad===pad&&Math.round(hit.beat*slotsPerBeat)===i)
        return h('span',{class:gridLine(i),'data-note':index>=0?'':undefined,'data-hit':state.matched.includes(index)||(index>=0 && state.phase==='intro' && state.pressed.includes(pad))?'':undefined,'aria-label':index>=0?`${drumPads[pad].hand}手の${drumPads[pad].finger}`:undefined},index>=0?drumPads[pad].finger[0]:'')
      })])),
    ]),
    h('div',{class:'drum-pad-grid','aria-label':'左右のドラムパッド'},drumPads.map((pad,i)=>h('button',{type:'button',class:'drum-tutorial-pad','data-sound':pad.sound,'data-placement':placementPads.includes(i)?'':undefined,'data-lit':state.lit.includes(i)||state.pressed.includes(i)?'':undefined,'aria-label':`${pad.hand}手 ${pad.finger} ${pad.name} ${pad.key}キー`,onPointerdown:(/** @type {PointerEvent} */event)=>{if(event.button!==0)return;event.preventDefault();void hit(i)},onClick:(/** @type {MouseEvent} */event)=>{if(event.detail===0)void hit(i)}},[
      h('span',{class:'drum-pad-name'},[padIcon(pad.sound),h('strong',pad.name)]),h('kbd',pad.key.toUpperCase())]))),
  ])}}).mount(host)
  return {
    open(restore = false){visible=true;const saved=readDevelopmentScreen('drum-lesson');const index=saved === null ? 0 : Number(saved);const stage=restore && Number.isInteger(index) && index>=0 && index<stages.length ? index : 0;selectStage(stage);document.addEventListener('keydown',onKey)},
    close(){visible=false;cancel();document.removeEventListener('keydown',onKey);master?.disconnect();master=undefined},
    advanceMessage,
  }
}
