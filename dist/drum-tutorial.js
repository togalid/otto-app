import { createApp, h, ref } from './vendor/vue.runtime.esm-browser.prod.js'
import { audioContext } from './audio.js'

export const drumPads = Object.freeze([
  {name:'ハイハット',sound:'hat',hand:'左',finger:'薬指',key:'a',pan:-.24,level:.72},
  {name:'スネア',sound:'snare',hand:'左',finger:'中指',key:'s',pan:-.08,level:.9},
  {name:'スネア',sound:'snare',hand:'右',finger:'中指',key:'k',pan:.08,level:1},
  {name:'ハイハット',sound:'hat',hand:'右',finger:'薬指',key:'l',pan:.24,level:.85},
  {name:'オープンハット',sound:'open',hand:'左',finger:'',key:'z',pan:-.3,level:.65},
  {name:'キック',sound:'kick',hand:'左',finger:'親指',key:'x',pan:-.03,level:.9},
  {name:'キック',sound:'kick',hand:'右',finger:'親指',key:'m',pan:.03,level:1},
  {name:'オープンハット',sound:'open',hand:'右',finger:'',key:',',pan:.3,level:.7},
])
/** Eighth-note hats alternate; backbeat and kick are progressively added.
 * @param {number} stage @returns {{beat:number,pad:number}[]} */
export function drumLessonPattern(stage) {
  const hits = Array.from({length:8}, (_,i)=>({beat:i/2,pad:i%2 ? 0 : 3}))
  if(stage>=1) hits.push({beat:1,pad:2},{beat:3,pad:2})
  if(stage>=2) hits.push({beat:0,pad:6},{beat:2,pad:6})
  return hits.sort((a,b)=>a.beat-b.beat)
}
/** @param {{beat:number,pad:number}[]} pattern @param {number} pad @param {number} beat @param {Set<number>} matched */
export function matchDrumHit(pattern,pad,beat,matched) {
  let result=-1, distance=.23
  pattern.forEach((hit,index)=>{
    const delta=Math.abs(hit.beat-beat)
    if(hit.pad===pad&&!matched.has(index)&&delta<distance){result=index;distance=delta}
  })
  return result
}
const stages = [
  {title:'左右のハイハット',message:'右手の薬指、左手の薬指を交互に。外側のハイハットを「右・左・右・左」と叩こう。'},
  {title:'スネアを加えよう',message:'ハイハットを続けながら、2拍目と4拍目に右手の中指でスネア。右のハイハットと一緒に叩こう。'},
  {title:'キックを加えて8ビート',message:'今度は1拍目と3拍目に右手の親指でキックも加えよう。ハイハットと一緒に叩けば8ビート！'},
]

/** One self-contained lesson; no changes to free-play instruments or settings.
 * @param {HTMLElement} host @param {()=>void} onBack */
export function mountDrumTutorial(host,onBack) {
  const state=ref({stage:0,phase:'intro',message:stages[0].message,beat:-1,bar:0,score:0,error:'',lit:/** @type {number[]} */([]),pressed:/** @type {number[]} */([]),matched:/** @type {number[]} */([])}).value
  let visible=false, generation=0, origin=0, tick=0, frame=0, nextBar=0, judgedBar=-1
  /** @type {AudioContext|undefined} */ let context
  /** @type {GainNode|undefined} */ let master
  /** @type {AudioBuffer|undefined} */ let noise
  /** @type {Set<AudioScheduledSourceNode>} */ const sources=new Set()
  /** @type {Map<number,number>} */ const flashes=new Map()
  /** @type {Set<number>} */ let matches=new Set()
  const secondsPerBeat=60/64
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
    sources.forEach(source=>{try{source.stop()}catch{}});sources.clear()
    flashes.forEach(timer=>window.clearTimeout(timer));flashes.clear()
    state.lit=[];state.pressed=[];state.beat=-1
  }
  function finish() {
    cancel();state.phase='complete';state.message=state.stage===2?(state.score>=20?'8ビートできたね！両手でリズムを作れたよ！':'最後まで練習したね。もう一度、ゆっくり合わせてみよう！'):'ここまで練習したね。もう一度でも、次の音を加えてもいいよ。'
  }
  function animate() {
    if(!context||!visible||!['count','play'].includes(state.phase))return
    const beat=(context.currentTime-origin)/secondsPerBeat
    if(beat>=16){finish();return}
    if(beat<0){state.phase='count';state.message=`${Math.min(4,Math.max(1,Math.floor(beat+4)+1))}　カウントイン`;state.beat=-1}
    else {
      const bar=Math.floor(beat/4),local=beat%4
      state.phase='play';state.bar=bar;state.beat=local
      state.message=bar%2?'あなたの番。光るパッドに合わせて叩こう！':'Ottoのお手本。左右の手の動きを見てね。'
      if(judgedBar!==bar){judgedBar=bar;matches=new Set();state.matched=[]}
      const pattern=drumLessonPattern(state.stage)
      state.lit=pattern.filter(hit=>local>=hit.beat&&local<hit.beat+.18).map(hit=>hit.pad)
    }
    frame=requestAnimationFrame(animate)
  }
  async function start() {
    cancel();const ticket=generation;state.error='';state.phase='loading'
    try {
      await ready();if(ticket!==generation||!visible)return
      origin=/** @type {AudioContext} */(context).currentTime+4*secondsPerBeat+.12
      state.score=0;matches=new Set();state.matched=[];nextBar=-1;judgedBar=-1;state.phase='count'
      const schedule=()=>{
        if(!context)return
        const horizon=context.currentTime+.12
        // Only schedule shortly ahead, so stopping never leaves a whole lesson queued.
        while(nextBar<32 && origin+nextBar*.5*secondsPerBeat<=horizon){
          const at=nextBar*.5
          if(at<0)sound(3,origin+at*secondsPerBeat)
          else if(Math.floor(at/4)%2===0)drumLessonPattern(state.stage).filter(hit=>hit.beat===at%4).forEach(hit=>sound(hit.pad,origin+at*secondsPerBeat))
          nextBar++
        }
      }
      // Four quiet quarter-note clicks before the first demonstration.
      for(let i=0;i<4;i++)sound(3,origin-(4-i)*secondsPerBeat)
      nextBar=0;schedule();tick=window.setInterval(schedule,25);animate()
    } catch(error) {if(ticket!==generation)return;state.phase='intro';state.error=error instanceof Error?error.message:'音を準備できませんでした。'}
  }
  /** @param {number} pad */
  async function hit(pad) {
    const ticket=generation
    try {
      await ready();if(!visible||ticket!==generation||!context)return
      sound(pad,context.currentTime+.005)
      window.clearTimeout(flashes.get(pad));state.pressed=[...new Set([...state.pressed,pad])]
      flashes.set(pad,window.setTimeout(()=>{state.pressed=state.pressed.filter(value=>value!==pad);flashes.delete(pad)},120))
      if(state.phase==='play') {
        const beat=(context.currentTime-origin)/secondsPerBeat,bar=Math.floor(beat/4)
        if(bar%2===1&&bar<4){
          if(judgedBar!==bar){judgedBar=bar;matches=new Set();state.matched=[]}
          const pattern=drumLessonPattern(state.stage),index=matchDrumHit(pattern,pad,beat%4,matches)
          if(index>=0){matches.add(index);state.matched=[...matches];state.score++}
        }
      }
    }catch(error){state.error=error instanceof Error?error.message:'音を準備できませんでした。'}
  }
  function advanceMessage() {if(!visible)return;if(state.phase==='intro')void start();else if(state.phase==='complete'&&state.stage<2){state.stage++;state.phase='intro';state.message=stages[state.stage].message;state.matched=[];state.score=0}}
  const onKey=/** @param {KeyboardEvent} event */event=>{
    if(!visible||event.repeat||event.metaKey||event.ctrlKey||event.altKey)return
    const pad=drumPads.findIndex(p=>p.key===event.key.toLowerCase())
    if(pad>=0){event.preventDefault();void hit(pad)}
  }
  createApp({render:()=>h('div',{class:'drum-lesson'},[
    h('header',{class:'drum-lesson-header'},[h('button',{type:'button',onClick:onBack},'← チュートリアル'),h('strong','ドラム編 · はじめての8ビート'),['play','count'].includes(state.phase)?h('button',{type:'button',onClick:()=>{cancel();state.phase='intro';state.message=stages[state.stage].message}},'■ 停止'):null]),
    h('div',{class:'drum-stage-steps','aria-label':'練習の順番'},stages.map((stage,i)=>h('span',{'data-current':i===state.stage?'':undefined},`${i+1}. ${stage.title}`))),
    h('section',{class:'drum-lesson-message'},[h('p',state.message),state.error?h('p',{role:'alert'},state.error):null,state.phase==='intro'?h('button',{type:'button',onClick:advanceMessage},'タップして練習をスタート →'):null,state.phase==='complete'?h('div',{class:'drum-complete-actions'},[h('button',{type:'button',onClick:()=>void start()},'もう一度'),h('button',{type:'button',onClick:state.stage<2?advanceMessage:onBack},state.stage<2?'次のステップ →':'チュートリアルへ')]):null]),
    h('section',{class:'drum-lesson-guide','aria-label':'ドラムのリズム'},[
      h('div',{class:'drum-guide-heading'},[h('strong',state.phase==='play'?(state.bar%2?'あなたが叩く':'Ottoが叩く'):'まずはお手本を聴こう'),h('span',`${state.score} / ${drumLessonPattern(state.stage).length*2}`)]),
      h('div',{class:'drum-beat-count'},['1','と','2','と','3','と','4','と'].map((label,i)=>h('span',{'data-current':state.beat>=i/2&&state.beat<(i+1)/2?'':undefined},label))),
      ...[3,0,...(state.stage>=1?[2]:[]),...(state.stage>=2?[6]:[])].map(pad=>h('div',{class:'drum-guide-row'},[h('small',`${drumPads[pad].hand} ${drumPads[pad].name}`),...Array.from({length:8},(_,i)=>{
        const index=drumLessonPattern(state.stage).findIndex(hit=>hit.pad===pad&&hit.beat===i/2)
        return h('span',{'data-note':index>=0?'':undefined,'data-hit':state.matched.includes(index)?'':undefined},index>=0?'●':'')
      })])),
    ]),
    h('div',{class:'drum-pad-grid','aria-label':'左右のドラムパッド'},drumPads.map((pad,i)=>h('button',{type:'button',class:'drum-tutorial-pad','data-sound':pad.sound,'data-lit':state.lit.includes(i)||state.pressed.includes(i)?'':undefined,'aria-label':`${pad.hand}手 ${pad.name} ${pad.key}キー`,onPointerdown:(/** @type {PointerEvent} */event)=>{if(event.button!==0)return;event.preventDefault();void hit(i)},onClick:(/** @type {MouseEvent} */event)=>{if(event.detail===0)void hit(i)}},[h('small',`${pad.hand}手${pad.finger}`),h('strong',pad.name),h('kbd',pad.key.toUpperCase())]))),
    h('p',{class:'drum-pad-hint'},'右と左で少し違う音。両手で同時にタップできます。'),
  ])}).mount(host)
  return {
    open(){visible=true;state.stage=0;state.phase='intro';state.message=stages[0].message;state.score=0;state.error='';state.matched=[];document.addEventListener('keydown',onKey)},
    close(){visible=false;cancel();document.removeEventListener('keydown',onKey);master?.disconnect();master=undefined},
    advanceMessage,
  }
}
