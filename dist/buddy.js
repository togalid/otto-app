import { createApp, h, ref } from './vendor/vue.runtime.esm-browser.prod.js'
import { ottoStyleFor } from './otto-style.js'
import { Instrument } from './audio.js'
import { Progression } from './progression.js'
import { swungBassBeat } from './groove.js'

const invitation = [{step:0,at:0,duration:.75},{step:2,at:1,duration:.75},{step:4,at:2,duration:1.5},{step:2,at:4,duration:.75},{step:1,at:5,duration:.75},{step:0,at:6,duration:1.5}]

/** @typedef {{step:number, at:number, duration:number, midi?:number, category?:string, level?:number, kind?:string, modulation?:Array<{at:number,value:number}>}} PhraseNote */
/** @param {Array<{at:number,value:number}>} points @param {number} elapsed */
export function modulationAt(points, elapsed) {
 let value=0
 for(const point of points) { if(point.at>elapsed) break; value=point.value }
 return value
}
/** Nearest audible sixteenth, using the exact swing mapping of the accompaniment.
 * @param {number} beat @param {number} swing */
export function grooveGrid(beat, swing) {
  let nearest = 0, distance = Infinity
  for (let tick = 0; tick <= 32; tick++) {
    const candidate = swungBassBeat(tick / 2, swing)
    if (Math.abs(candidate - beat) < distance) { nearest = candidate; distance = Math.abs(candidate - beat) }
  }
  return nearest
}
/** Preserve pitches, rests and note lengths; never push attacks to later grid cells.
 * @param {readonly PhraseNote[]} phrase @param {number} swing */
export function echoPhrase(phrase, swing) {
  return phrase.map(note => {
    const at = Math.min(swungBassBeat(15.5, swing), grooveGrid(note.at, swing))
    const end = grooveGrid(Math.min(8, note.at + note.duration), swing)
    return {...note, at, duration: Math.min(8 - at, Math.max(0.08, end - at))}
  })
}
/** Prefer nearby scale steps; recover gently after larger intervals.
 * @param {readonly number[]} history @param {number} next */
export function melodicMotionCost(history, next) {
  if (!history.length) return 0
  const last = history[history.length - 1]
  const distance = Math.abs(next - last)
  const previous = history.length > 1 ? last - history[history.length - 2] : 0
  return distance * .5 + Math.max(0, distance - 2) * 2 +
    (distance === 0 ? 1.8 : 0) +
    (Math.abs(previous) > 4 && distance > 2 ? 6 : 0)
}

/** A restrained, connected melody following the harmony at the audible attack.
 * @param {readonly PhraseNote[]} input @param {(beat:number)=>Palette} suppliedPalette @param {number} swing @param {number} [bpm] @param {ReturnType<typeof ottoStyleFor>} [style]
 * @returns {PhraseNote[]} */
export function ottoReply(input, suppliedPalette, swing, bpm = 100, style) {
  void bpm
  const motif = style?.invitation ?? invitation
  /** @type {PhraseNote[]} */
  const source = input.length ? echoPhrase(input, swing) : motif.map(note => {
    const at = swungBassBeat(note.at * 2, swing)
    return {...note, at, duration: swungBassBeat((note.at + note.duration) * 2, swing) - at}
  })
  /** @type {PhraseNote[]} */
  const result = []
  /** @type {number[]} */
  const history = []
  for (const [index, note] of source.entries()) {
    const at = Math.max(0, note.at)
    if (at >= 8) continue
    const palette = suppliedPalette(at).filter(p => !p.clash)
    if (!palette.length) continue
    const strong = Math.abs(at - Math.round(at / 2) * 2) < .05
    const arrival = index === source.length - 1 || note.duration >= 1
    const chordTones = palette.filter(p => p.category === 'chord')
    const candidates = !input.length && (strong || arrival) && chordTones.length ? chordTones : palette
    const previous = history.at(-1) ?? style?.register ?? 72
    const target = input.length && note.midi !== undefined ? note.midi : previous
    const selected = [...candidates].sort((a,b) => {
      /** @param {Palette[number]} p */
      const cost = p => input.length ? Math.abs(p.midi - target) :
        melodicMotionCost(history, p.midi) + Math.abs(p.midi - (style?.register ?? 72)) * .12 +
        // A small arch supplies direction without forcing jumps or extra notes.
        (history.length && Math.sign(p.midi - previous) !== (index < source.length / 2 ? 1 : -1) ? .6 : 0)
      return cost(a) - cost(b)
    })[0]
    let duration = Math.min(note.duration, 8 - at, (source[index + 1]?.at ?? 8) - at)
    // Harmony changes occur on quarter-note boundaries. Never spill an avoid
    // or an out-of-scale pitch across the next chord, even for a grace period.
    for (let beat = (Math.floor(at * 4) + 1) / 4; beat < at + duration - 1e-9; beat += .25) {
      if (!suppliedPalette(beat).some(p => p.midi % 12 === selected.midi % 12 && !p.clash)) {
        duration = beat - at
        break
      }
    }
    if (duration <= 0) continue
    result.push({...note, midi: selected.midi, category: selected.category, duration,
      kind: 'quote', level: strong ? .9 : .78})
    history.push(selected.midi)
  }
  return result
}

/** A simple, varied first bar; subsequent bars retain the selected style.
 * @param {(beat:number)=>Palette} paletteAt @param {number} meter @param {number} variant @returns {PhraseNote[]} */
export function gentleOpening(paletteAt, meter, variant) {
 const patterns = [[0,1,2.5],[0,.75,2],[.5,1.5,2.5],[0,1.5,3]]
 const times = patterns[((variant % patterns.length)+patterns.length)%patterns.length].filter(at=>at<meter)
 const notes = /** @type {PhraseNote[]} */ ([])
 let previous=68 + ((variant % 3)-1)*2
 for (const at of times) {
  const palette=paletteAt(at).filter(note=>!note.clash && note.category==='chord' && note.midi>=60 && note.midi<=79)
  if (!palette.length) continue
  const target=previous+(notes.length===1 ? (variant%2?2:-2) : 0)
  const selected=[...palette].sort((a,b)=>Math.abs(a.midi-target)-Math.abs(b.midi-target))[0]
  notes.push({step:0,at,duration:Math.min(.85,meter-at),midi:selected.midi,category:selected.category,level:.68,kind:'quote'})
  previous=selected.midi
 }
 return notes.map((note,i)=>({...note,duration:Math.min(note.duration,(notes[i+1]?.at??meter)-note.at)}))
}

/** @typedef {{pentatonic:boolean,chromatic:boolean,pickup:boolean,repeat:boolean,resolve:boolean,phraseBars:number,tension:number,avoid:number,leaps:number,density:number,syncopation:number,rests:number,variation:number,contrast:number,gate:number,register:number,ending:string,omit?:number,wholeTone?:boolean,maxLeap?:number,highest?:number,ornamentLength?:number,soloFlair?:boolean,playStyle?:string}} OttoLabSettings */
export const defaultOttoLab = Object.freeze({pentatonic:true,chromatic:true,pickup:false,repeat:true,resolve:true,phraseBars:2,tension:0,avoid:0,leaps:0,density:90,syncopation:0,rests:5,variation:25,contrast:15,gate:95,register:72,ending:'chord',omit:9,wholeTone:true,maxLeap:7,highest:84,ornamentLength:32,playStyle:'craft'})
/** Deterministic, monophonic two-bar slice of a two/four-bar experiment.
 * @param {(beat:number)=>Palette} paletteAt @param {OttoLabSettings} settings
 * @param {number} block @param {number} meter @param {number} key
 * @param {number} [previousMidi]
 * @returns {PhraseNote[]} */
export function ottoLabPhrase(paletteAt,settings,block,meter,key,previousMidi) {
 let seed=(block+1)*173+17
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}
 const maxLeap=settings.maxLeap??7, highest=settings.highest??84
 const length=meter*settings.phraseBars, notes=/** @type {PhraseNote[]} */([])
 // Group silence into one-beat breaths; the control sets their chance per beat.
 const silentBeats=Array.from({length},()=>random()<settings.rests/100)
 // A compact four-note vocabulary: walk neighbouring scale notes instead of
 // repeatedly targeting the register centre or re-filtering to each chord.
 if(settings.pentatonic){
  if(settings.density<=0||settings.rests>=100)return []
  const allDegrees=[0,2,4,7,9]
  const omitted=allDegrees[(block*3+Math.floor(block/5))%allDegrees.length]
  const degrees=allDegrees.filter(degree=>degree!==omitted)
  const base=key+12*Math.floor((Math.min(settings.register,highest)-key)/12)
  const pitches=degrees.map(degree=>Math.max(48,Math.min(84,base+degree))).filter(midi=>midi<=highest)
  if(!pitches.length)return []
  let index=previousMidi===undefined?block%pitches.length:pitches.reduce((best,pitch,i)=>Math.abs(pitch-previousMidi)<Math.abs(pitches[best]-previousMidi)?i:best,0)
  if(previousMidi!==undefined&&block%2===1)index=index===pitches.length-1?index-1:index+1
  let direction=block%2===0?1:-1
  for(let at=0,step=0;at<length;step++){
   const final=at>=length-1
   const span=final?length-at:random()<settings.density/100?.5:1
   if(step>0){
    if(index===0)direction=1
    else if(index===pitches.length-1)direction=-1
    else if(step%4===0||random()<settings.variation/300)direction*=-1
    if(random()>.2)index=Math.max(0,Math.min(pitches.length-1,index+direction*(random()<settings.leaps/100?2:1)))
   }
   const lastMidi=notes.at(-1)?.midi
   if(settings.leaps===0&&lastMidi!==undefined&&Math.abs(pitches[index]-lastMidi)>5)index=pitches.indexOf(lastMidi)
   if(!silentBeats[Math.floor(at)]&&!(at===0&&settings.pickup)){
    const palette=paletteAt(at)
    const safe=pitches.filter(pitch=>palette.some(p=>p.midi%12===pitch%12&&!p.clash)&&(lastMidi===undefined||Math.abs(pitch-lastMidi)<=maxLeap))
    if(!safe.length){at+=span;continue}
    if(!safe.includes(pitches[index]))index=pitches.indexOf(safe.sort((a,b)=>Math.abs(a-pitches[index])-Math.abs(b-pitches[index]))[0])
    const midi=pitches[index]
    notes.push({step:0,at,midi,category:palette.find(p=>p.midi===midi)?.category??'scale',duration:span*settings.gate/100,level:final?.72:.8,kind:'quote'})
   }
   at+=span
  }
  if(settings.resolve&&notes.length){
   const last=notes[notes.length-1],palette=paletteAt(last.at)
   const choices=pitches.filter(midi=>(notes.length<2||Math.abs(midi-(notes.at(-2)?.midi??midi))<=maxLeap)&&palette.some(p=>p.midi%12===midi%12&&!p.clash)&&Math.abs(midi-(last.midi??midi))<=4&&(settings.ending==='tonic'?[0,4,7].includes((midi-key+120)%12):palette.some(p=>p.midi===midi&&p.category==='chord')))
   choices.sort((a,b)=>Math.abs(a-(last.midi??a))-Math.abs(b-(last.midi??b)))
   if(choices.length)last.midi=choices[0]
  }
  if(settings.soloFlair&&block%3!==0&&notes.length){
   const from=length-2
   let previous=notes.filter(n=>n.at<from).at(-1)?.midi??settings.register
   const run=/** @type {PhraseNote[]} */([])
   for(let i=0;i<8;i++){
    const at=from+i*.25
    const candidates=paletteAt(at).filter(p=>!p.clash&&p.midi>=48&&p.midi<=highest&&Math.abs(p.midi-previous)<=maxLeap)
    const direction=block%2===0?1:-1
    candidates.sort((a,b)=>Math.abs(a.midi-(previous+direction*(i===0?maxLeap:2)))-Math.abs(b.midi-(previous+direction*(i===0?maxLeap:2))))
    if(candidates.length){previous=candidates[0].midi;run.push({step:0,at,midi:previous,duration:.2,level:.82,kind:'quote'})}
   }
   if(run.length){notes.splice(0,notes.length,...notes.filter(n=>n.at+n.duration<=from),...run)}
  }
  return addChromaticApproaches(notes,settings.chromatic,settings.wholeTone??false,random,highest,maxLeap,settings.ornamentLength??32)
 }
 let previous=settings.register
 const pattern=[0,2,1,3,2,1,0,2]
 for(let tick=0;tick<length*2;tick++) {
  const at=tick/2
  const slow=settings.contrast>0&&(block*2+Math.floor(at/meter))%2===1
  if(silentBeats[Math.floor(at)]||random()>settings.density/100*(slow?1-settings.contrast/150:1))continue
  if(at===0&&settings.pickup&&block%2===0)continue
  const shifted=Math.round(Math.max(0,at-(tick%2===0&&random()<settings.syncopation/100?.25:0))*4)/4
  let candidates=paletteAt(shifted).filter(p=>p.midi>=48&&p.midi<=highest&&(notes.length===0||Math.abs(p.midi-(notes.at(-1)?.midi??p.midi))<=maxLeap))
  const allowAvoid=random()<settings.avoid/100
  if(!allowAvoid)candidates=candidates.filter(p=>!p.clash)
  if(settings.pentatonic)candidates=candidates.filter(p=>[0,2,4,7,9].includes((p.midi-key+120)%12))
  const color=random()<settings.tension/100
  const preferred=candidates.filter(p=>color?p.category!=='chord':p.category==='chord')
  if(preferred.length)candidates=preferred
  if(!candidates.length)continue
  const jump=random()<settings.leaps/100
  const target=settings.repeat?settings.register+pattern[tick%pattern.length]:previous
  candidates.sort((a,b)=>Math.abs(a.midi-target)-Math.abs(b.midi-target))
  let selected=candidates[Math.min(candidates.length-1,jump?Math.floor(random()*candidates.length):random()<settings.variation/100?1:0)]
  let midi=selected.midi
  notes.push({step:0,at:shifted,midi,category:selected.category,duration:Math.min(length-shifted,(slow?1:.5)*settings.gate/100),level:tick%2===0?.85:.7,kind:'quote'})
  previous=midi
 }
 if(settings.resolve&&notes.length){
  const last=notes[notes.length-1],palette=paletteAt(last.at)
  const ending=palette.filter(p=>p.midi<=highest&&(notes.length<2||Math.abs(p.midi-(notes.at(-2)?.midi??p.midi))<=maxLeap)).filter(p=>settings.ending==='tonic'?[0,4,7].includes((p.midi-key+120)%12):p.category==='chord'&&!p.clash&&(!p.degree||['R','3','♭3','5'].includes(p.degree)))
  ending.sort((a,b)=>Math.abs(a.midi-(last.midi??72))-Math.abs(b.midi-(last.midi??72)))
  if(ending.length)last.midi=ending[0].midi
 }
 return addChromaticApproaches(notes.map((note,i)=>({...note,duration:Math.max(.04,Math.min(note.duration,(notes[i+1]?.at??length)-note.at))})),settings.chromatic,settings.wholeTone??false,random,highest,maxLeap,settings.ornamentLength??32)
}

/** Insert short chromatic approaches on sixteenth-note positions before a target.
 * @param {PhraseNote[]} notes @param {boolean} enabled @param {boolean} wholeTone @param {()=>number} random @param {number} highest @param {number} maxLeap @param {number} ornamentLength @returns {PhraseNote[]} */
function addChromaticApproaches(notes,enabled,wholeTone,random,highest,maxLeap,ornamentLength) {
 if(!enabled&&!wholeTone)return notes
 const result=/** @type {PhraseNote[]} */([])
 for(let i=0;i<notes.length;i++){
  const note={...notes[i]},next=notes[i+1]
  if(next?.midi!==undefined&&note.midi!==undefined&&next.at-note.at>=.5&&random()<.3){
   const at=next.at-.25, interval=enabled&&Math.abs(next.midi-note.midi)===4?1:enabled&&wholeTone?(random()<.5?1:2):wholeTone?2:1
   let pitch=next.midi+(note.midi<next.midi?-interval:interval)
   if(pitch===note.midi||pitch>highest||pitch<48||Math.abs(pitch-note.midi)>maxLeap)pitch=next.midi+(pitch<next.midi?interval:-interval)
   if(pitch>=48&&pitch<=highest&&pitch!==note.midi&&Math.abs(pitch-note.midi)<=maxLeap&&interval<=maxLeap){
    note.duration=Math.min(note.duration,at-note.at)
    result.push(note,{step:0,at,midi:pitch,duration:Math.max(.025,Math.min(.25,.25*ornamentLength/100)),category:'chromatic',level:.42,kind:'quote'})
    continue
   }
  }
  result.push(note)
 }
 return result
}

/** Developing solo: descending sequences, turns, and short approach notes.
 * @param {readonly number[]} pitches @param {number} from @param {number} beats @param {number} variation @returns {PhraseNote[]} */
export function developingSolo(pitches,from,beats,variation) {
 const sorted=[...new Set(pitches)].sort((a,b)=>a-b)
 if(!sorted.length)return []
 const result=/** @type {PhraseNote[]} */([])
 // Short descending cells with an answering turn, rather than a repeating run.
 const shapes=[[0,-1,-3,-5],[-2,-3,0,1],[2,1,3,4],[1,1,0,-1]]
 const rhythms=[[.5,.25,.25,1],[.5,.5,.25,.75],[.25,.25,.5,1]]
 let at=0,step=0
 const peak=Math.max(0,sorted.length-2-variation%3)
 while(at<beats){
  const cell=Math.floor(step/4), shape=shapes[(cell+variation)%shapes.length]
  const index=Math.max(0,Math.min(sorted.length-1,peak+shape[step%4]))
  const midi=sorted[index],span=Math.min(rhythms[(variation+cell)%3][step%4],beats-at)
  result.push({step:0,at:from+at,midi,duration:span*.85,level:step%4===0?.86:.72,kind:'quote'})
  at+=span;step++
 }
 return result
}

/** Distinct performance vocabulary, shared by solo and call/response modes.
 * @param {PhraseNote[]} notes @param {string} style @param {number} beats
 * @param {(beat:number)=>Palette} paletteAt @param {number} key @param {number} block
 * @param {boolean} quote @returns {PhraseNote[]} */
export function performOttoStyle(notes,style,beats,paletteAt,key,block,quote=false) {
 if(style==='shred'||style==='scale') {
  const from=quote?1:0
  const result=notes.filter(n=>n.at<from)
  const scale=block%5===3?[0,2,4,6,7,9,11]:[0,2,4,5,7,9,11]
  let step=0,at=from
  while(at<beats-.001) {
   const palette=paletteAt(at).filter(p=>!p.clash&&p.midi>=60&&p.midi<=84)
   let pitches=style==='shred'?[...new Set(palette.filter(p=>p.category==='chord').map(p=>p.midi))].sort((a,b)=>a-b):
    Array.from({length:25},(_,i)=>60+i).filter(m=>scale.includes(((m-key)%12+12)%12))
   if(style==='shred'&&pitches.length){const base=pitches[Math.floor(pitches.length/4)] ;pitches=pitches.filter(p=>p>=base&&p<=base+12)}
   if(!pitches.length)pitches=[...new Set(palette.map(p=>p.midi))].sort((a,b)=>a-b)
   if(!pitches.length)break
   const cycle=Math.max(1,pitches.length-1),phase=step%(cycle*2)
   const stair=[0,1,2,1,2,3,2,3,4,3,4,5]
   const index=style==='shred'?(block%2?stair[step%stair.length]%pitches.length:step%pitches.length):(block%2?cycle-Math.abs(cycle-phase):Math.abs(cycle-phase))
   const progress=(at-from)/Math.max(.001,beats-from)
   const span=style==='shred'?(progress<.3?.5:progress<.65?.25:step%4===0?.125:.25):.25
   const duration=Math.min(span+(style==='shred'?.15:.01),beats-at)
   result.push({step:0,at,midi:pitches[Math.min(pitches.length-1,index)],duration,level:step%4===0?.88:.76,kind:'quote'})
   at+=span;step++
  }
  return result
 }
 if(style==='jazz') {
  const result=notes.map((n,i)=>{
   const beat=Math.floor(n.at), offbeat=(i+block)%3!==0
   return {...n,at:beat+(offbeat?2/3:1/3)}
  }).filter(n=>n.at<beats).sort((a,b)=>a.at-b.at).filter((n,i,a)=>!i||n.at>a[i-1].at)
  return result.map((n,i)=>({...n,duration:Math.min((result[i+1]?.at??beats)-n.at,n.duration),level:i%3===0?.92:.7}))
 }
 return notes
}

/** Keep replies close to the player's register and interval vocabulary.
 * @param {PhraseNote[]} response @param {readonly PhraseNote[]} input
 * @param {(beat:number)=>Palette} paletteAt @returns {PhraseNote[]} */
export function followPlayerMotion(response,input,paletteAt) {
 const played=input.filter(n=>n.midi!==undefined)
 if(!played.length)return response
 const pitches=played.map(n=>/** @type {number} */(n.midi))
 const jump=Math.min(12,Math.max(2,...pitches.slice(1).map((n,i)=>Math.abs(n-pitches[i])+2)))
 const low=Math.min(...pitches)-2,high=Math.max(...pitches)+2
 let previous=pitches.at(-1)??pitches[0]
 const result=/** @type {PhraseNote[]} */([])
 for(const note of response){
  if(note.midi===undefined)continue
  const near=played.reduce((best,n)=>Math.abs(n.at-note.at)<Math.abs(best.at-note.at)?n:best,played[0]).midi??previous
  const allowed=(/** @type {number} */ midi)=>midi>=low&&midi<=high&&Math.abs(midi-previous)<=jump&&Math.abs(midi-near)<=jump
  let midi=note.midi
  if(!allowed(midi)){
   const candidates=paletteAt(note.at).filter(p=>!p.clash&&allowed(p.midi)).sort((a,b)=>Math.abs(a.midi-near)-Math.abs(b.midi-near)||Math.abs(a.midi-previous)-Math.abs(b.midi-previous))
   if(!candidates.length)continue
   midi=candidates[0].midi
  }
  result.push({...note,midi});previous=midi
 }
 return result
}

const modeLines = {
  pc: '僕と交互にメロディをプレイしよう',
  you: '君からメロディをプレイしてね',
  'all-you': '一緒に弾こう',
  'all-pc': '僕がメロディ奏でてみるよ',
}

/** Keep the authored eight-bar timeline unchanged.
 * @param {import('./progression.js').Progression} source */
export function conversationScore(source) {
  return source.slots.map((chord, index) => ({chord, changes: [...source.beatSlots[index]], key: source.keyForBar(index)}))
}
/** @param {number} beat @param {boolean | string} mode @param {number} [beatsPerBar] @param {number} [turnBars] */
export function conversationTurn(beat, mode, beatsPerBar = 4, turnBars = 2) {
  const block = Math.floor(Math.max(0, beat) / (beatsPerBar * turnBars))
  return {block, local: Math.max(0, beat) % (beatsPerBar * turnBars), pc: mode === 'all-pc' || (mode !== 'all-you' && block % 2 === (mode === true || mode === 'pc' ? 0 : 1)), bar: Math.floor(Math.max(0, beat) / beatsPerBar) % 8 + 1}
}

/** @param {HTMLElement} ui @param {{join:()=>void,imitate:()=>void,keepPlaying:()=>void,first?:(user:boolean)=>void,shift?:(direction:number)=>void,bars?:(bars:number)=>void}} actions */
function mountBuddyView(ui, actions) {
  const originalBuddy = /** @type {HTMLElement} */ (document.querySelector('#oto-buddy'))
  const view = ref({
    line: '', status: '', speaking: false, look: originalBuddy.dataset.look ?? '',
    hideContinue: true, hideJoin: true, hideImitate: true,
    turnProgress:0,turnRemaining:0,sessionVisible:false,sessionRunning:false,userFirst:false,turnBars:2,
  }).value
  createApp({
    render: () => [
      view.sessionVisible?h('div',{class:'session-turn-display'},[
        h('div',{class:'session-ring-column'},[h('div',{class:'session-turn-ring','aria-hidden':'true'},[
          h('svg',{viewBox:'0 0 100 100'},[
            h('circle',{cx:50,cy:50,r:42,class:view.userFirst?'turn-user':'turn-otto',fill:'none','stroke-width':8,'stroke-dasharray':'131.95 131.95',transform:'rotate(-90 50 50)'}),
            h('circle',{cx:50,cy:50,r:42,class:view.userFirst?'turn-otto':'turn-user',fill:'none','stroke-width':8,'stroke-dasharray':'131.95 131.95',transform:'rotate(90 50 50)'}),
            h('circle',{cx:50,cy:8,r:5,class:'turn-marker',transform:`rotate(${view.turnProgress*360} 50 50)`}),
          ]),
          h('div',{class:'session-turn-count'},[h('strong',view.sessionRunning?String(view.turnRemaining):`${view.turnBars}＋${view.turnBars}`),h('small',view.sessionRunning?(view.speaking?'Ottoの番':'あなたの番'):'小節')]),
        ]),h('label',{class:'session-length'},['交代 ',h('select',{'aria-label':'交代する小節数',value:view.turnBars,onChange:(/** @type {Event} */ event)=>{const bars=Number((/** @type {HTMLSelectElement} */ (event.target)).value);view.turnBars=bars;actions.bars?.(bars)}},[2,4,8].map(bars=>h('option',{value:bars},`${bars}小節`)))])]),
        h('div',[h('strong',`Ottoと${view.turnBars}小節ずつ`),h('fieldset',{class:'segmented-control session-first','aria-label':'先に弾く人'},...[['Ottoが先',false],['自分が先',true]].map(([label,user])=>h('label',[h('input',{type:'radio',name:'session-first',checked:view.userFirst===user,onChange:()=>{view.userFirst=Boolean(user);actions.first?.(Boolean(user))}}),h('span',String(label))]))),h('div',{class:'style-stepper session-phase'},[h('button',{type:'button','aria-label':'交代位置を1小節前へ',onClick:()=>actions.shift?.(-1)},'← 1小節'),h('button',{type:'button','aria-label':'交代位置を1小節後へ',onClick:()=>actions.shift?.(1)},'1小節 →')])]),
      ]):null,
      h('div', {class: 'talk-companion'}, [
        h('div', {class: 'talk-face', 'aria-hidden': 'true', 'data-speaking': String(view.speaking), 'data-listening':String(view.sessionRunning&&!view.speaking)}, [
          h('div', {class: 'talk-avatar', 'data-mood': 'idle', 'data-look': view.look}),
        ]),
        h('p', {class: 'talk-bubble'}, view.line),
      ]),
      h('p', {id: 'buddy-status', class: 'sr-only', role: 'status', 'aria-live': 'polite'}, view.status),
    ],
  }).mount(ui)
  const drawing = originalBuddy.querySelector('svg')
  if (drawing) ui.querySelector('.talk-avatar')?.append(drawing.cloneNode(true))
  new MutationObserver(() => { view.look = originalBuddy.dataset.look ?? '' })
    .observe(originalBuddy, {attributes:true, attributeFilter:['data-look']})
  return view
}

/** @typedef {ReturnType<typeof import('./music.js').melodyPalette>} Palette */
/** @param {{progression:Progression,instrument:Instrument,drums:import('./rhythm.js').DrumSynth,getNotes:()=>Palette,notesAt:(bar:number,beat:number,absoluteBar:number)=>Palette,reportNote:(midi:number)=>void,refreshTransport:()=>void,onModeChange:(mode:string)=>void,onPlayStyleChange?:(style:string)=>void,reveal:()=>void}} source
 * @param {typeof mountBuddyView} [mountView] */
export function mountBuddy(source, mountView = mountBuddyView) {
  const panel = /** @type {HTMLElement} */ (document.querySelector('#detail-melody'))
  const ui = /** @type {HTMLElement} */ (document.querySelector('#buddy-inline'))
  const open = /** @type {HTMLButtonElement} */ (document.querySelector('#buddy-talk-open'))
  const view = mountView(ui, {join, imitate, keepPlaying,first:user=>{userFirst=user;setMode(user?'you':'pc')},bars:bars=>{turnBars=bars;if(active){partner.silence();scheduled.clear();recorded=[];lastBlock=-1;const turn=sessionTurn(Math.max(0,position()));replyPlan=turn.pc?makeResponse(turn.block):[];tick()}},shift:direction=>{if(active){origin+=direction*meter()*60/sessionBpm;partner.silence();scheduled.clear();lastBlock=-1;recorded=[];replyPlan=makeResponse(sessionTurn(Math.max(0,position())).block);tick()}}})
  const pianoKeys = Array.from(document.querySelectorAll('#piano-keys [data-midi]'))
  const pads = Array.from(document.querySelectorAll('#pads button'))
  const transport = source.progression
  const player = source.instrument
  const partner = new Instrument('melody')
  partner.singing = true
  const lab=ref(/** @type {OttoLabSettings} */ ({...defaultOttoLab}))
  const labMode=ref(false)
  const sessionMode=ref(mountView===mountBuddyView)
  view.sessionVisible=sessionMode.value
  /** @type {PhraseNote[]} */
  let recorded = []
  /** @type {Map<number, PhraseNote>} */
  const held = new Map()
  const scheduled = new Set()
  let userFirst=false
  let mode = sessionMode.value ? 'pc' : labMode.value ? 'all-pc' : 'all-you'
  /** @type {PhraseNote[]} */
  let replyPlan = []
  let countBeats = 4
  let origin = 0, active = false, preparing = false, generation = 0, lastBlock = -1
  let midiModulation = 0
  let lastReplyModulation = -1
  let lastExpressiveNote = /** @type {PhraseNote | undefined} */ (undefined)
  let openingVariant = 0
  let turnBars = 2
  let listening = false, listenStart = 0, lastRelease = 0, answeringUntil = 0
  let firstEcho = false, echoStart = 0, echoBeatSeconds = 0
  /** @type {{time:number,beat:number,bpm:number} | undefined} */
  let tempoChange
  let sessionBpm = 100
  /** @type {ReturnType<typeof setInterval> | undefined} */
  let timer
  function stop() {
    const owned = active || preparing
    generation++; active = false; preparing = false
    listening = false; firstEcho = false; answeringUntil = 0; tempoChange = undefined
    clearInterval(timer); timer = undefined
    if (owned) { transport.stop(); player.silence() }
    panel.dataset.ottoPlaying = 'false'
    delete panel.dataset.inviting
    partner.silence(); lastReplyModulation = -1
    held.clear(); recorded = []; replyPlan = []; scheduled.clear(); lastBlock = -1
    pads.forEach(pad => {
      pad.removeAttribute('data-playing'); pad.removeAttribute('data-pc-playing');
      /** @type {HTMLButtonElement} */ (pad).disabled = false
    })
    pianoKeys.forEach(key => key.removeAttribute('data-pc-playing'))
    view.speaking = false; view.line = selectedLine(); view.hideContinue = true; view.hideJoin = true; view.hideImitate = true
    source.refreshTransport()
    view.sessionRunning=false;view.turnProgress=0;view.turnRemaining=0
    view.status = '停止'
  }
  function selectedLine() {
    return Reflect.get(modeLines, mode) ?? '一緒に遊ぼう。'
  }
  function meter() { return transport.beatsPerBar ?? 4 }
  function phraseBeats() { return meter() * (labMode.value ? lab.value.phraseBars : turnBars) }
  /** @param {number} beat */
  function sessionTurn(beat) {
    if (!labMode.value) return conversationTurn(beat, mode, meter(), turnBars)
    const length=phraseBeats(), absolute=Math.max(0,beat)
    return {block:Math.floor(absolute/length),local:absolute%length,pc:true,bar:Math.floor(absolute/meter())+1}
  }
  function position() { return ((player.context?.currentTime ?? origin) - origin) / (60 / sessionBpm) }
  /** @param {number} step */
  function release(step) {
    const note = held.get(step)
    if (!note) return
    const local = listening ? position() - listenStart : position() % phraseBeats()
    note.duration = Math.max(0.08, Math.min(phraseBeats() - note.at, (local < note.at ? phraseBeats() : local) - note.at))
    if (note.midi !== undefined) player.release(note.midi)
    held.delete(step); pads[step]?.removeAttribute('data-playing')
    if (listening && !held.size) lastRelease = player.context?.currentTime ?? 0
  }
  /** @param {number} block */
  function makeResponse(block) {
    const personality=lab.value.playStyle??'craft'
    const soloSettings={...lab.value,soloFlair:true,leaps:Math.max(25,lab.value.leaps)}
    if(personality==='gentle')Object.assign(soloSettings,{soloFlair:false,leaps:0,maxLeap:3,density:65,chromatic:false,wholeTone:false,gate:95})
    if(personality==='classical')Object.assign(soloSettings,{chromatic:false,wholeTone:false,syncopation:0,gate:85,leaps:15})
    if(personality==='shred')Object.assign(soloSettings,{density:100,rests:0,gate:60,leaps:35})
    if(personality==='scale')Object.assign(soloSettings,{density:95,leaps:0,maxLeap:3,chromatic:false,wholeTone:false})
    if(personality==='jazz')Object.assign(soloSettings,{syncopation:55,tension:30,ornamentLength:45})
    // Solo passages get fresh, style-specific motifs; user phrases are quoted only as replies.
    partner.expressiveVibrato=personality!=='classical'
    partner.glideSeconds=personality==='shred'?.045:.025
    if(mode==='all-pc'&&labMode.value){
     const paletteAt=/** @param {number} beat */(beat)=>{
      const absoluteBar=block*lab.value.phraseBars+Math.floor(beat/meter())
      return source.notesAt(absoluteBar%transport.slots.length,beat%meter(),absoluteBar)
     }
     const key=transport.keyForBar(block*lab.value.phraseBars)
     const solo=performOttoStyle(ottoLabPhrase(paletteAt,soloSettings,block,meter(),key,replyPlan.at(-1)?.midi),personality,phraseBeats(),paletteAt,key,block)
     return block===0 ? [...gentleOpening(paletteAt,meter(),openingVariant),...solo.filter(note=>note.at>=meter())] : solo
    }
    const phrase = mode === 'all-pc' ? [] : recorded
    if(personality==='imitate'&&phrase.length)return phrase.filter(n=>n.at<phraseBeats()).map(n=>{
      const bar=block*turnBars+Math.floor(n.at/meter())
      const palette=source.notesAt(bar%transport.slots.length,n.at%meter(),bar)
      const exact=palette.find(p=>p.midi===n.midi)
      const selected=exact&&!exact.clash?n.midi:[...palette].filter(p=>!p.clash).sort((a,b)=>Math.abs(a.midi-(n.midi??72))-Math.abs(b.midi-(n.midi??72)))[0]?.midi
      return {...n,midi:selected,duration:Math.min(n.duration,phraseBeats()-n.at)}
    })
    const baseStyle = ottoStyleFor(transport.genre)
    const variation = block % 4
    const style = variation ? {...baseStyle, register: Math.max(60, Math.min(78, baseStyle.register + [0,2,-2,1][variation])),
      invitation: baseStyle.invitation.map((note,i,all) => {
        const shift = i > 0 && i < all.length-1 && (i + variation) % 3 === 0 ? .25 : 0
        const at = Math.min(note.at + shift, (all[i+1]?.at ?? 8) - .25)
        return {...note,at,duration:Math.max(.125,Math.min(note.duration,(all[i+1]?.at ?? 8)-at))}
      })} : baseStyle
    const response = Array.from({length: Math.ceil(phraseBeats() / 8)}, (_, chunk) => ottoReply(phrase.filter(note => note.at >= chunk * 8 && note.at < (chunk + 1) * 8).map(note => ({...note, at: note.at - chunk * 8})), offset => {
      const beat = offset + chunk * 8
      const absoluteBar = block * turnBars + Math.floor(beat / meter())
      return source.notesAt(absoluteBar % transport.slots.length, beat % meter(), absoluteBar)
    }, transport.swing, transport.bpm, style).map(note => ({...note, at: note.at + chunk * 8})))
      .flat().filter(note => note.at < phraseBeats()).map(note => ({...note, duration: Math.min(note.duration, phraseBeats() - note.at)}))
    if(!sessionMode.value)return response
    let seed=block*7919+37
    const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}
    // Retain the user's opening, occasionally answering with a short final run.
    // Leave most replies intact. Sparse user phrases get occasional answers;
    // dense phrases already contain enough material and keep their own space.
    const turnIndex=Math.floor(block/2)
    const flourish=personality!=='gentle'&&turnIndex>0&&(personality==='shred'||personality==='scale'||(turnIndex*17+11)%7===0||(turnIndex*17+11)%7===3)&&phrase.length<=12
    if(flourish){
      const from=phraseBeats()-(turnIndex%2===0?2:3)
      const palette=source.notesAt((block*turnBars+1)%transport.slots.length,0,block*turnBars+1).filter(p=>!p.clash&&p.midi>=60&&p.midi<=84)
      const pitches=[...new Set(palette.filter(p=>personality==='classical'?p.category==='chord':true).map(p=>p.midi))].sort((a,b)=>a-b)
      if(pitches.length){
        response.splice(0,response.length,...response.filter(n=>n.at+n.duration<=from))
        response.push(...developingSolo(pitches,from,phraseBeats()-from,turnIndex))
      }
    }
    const styled=response.filter((note,index)=>personality!=='gentle'||index%3!==2).map((note,index)=>({...note,
      duration:note.duration,
      level:personality==='gentle'?.65:personality==='classical'?(index%4===0?.9:.7):note.level,
      at:personality==='jazz'&&index%2===1?Math.round((note.at+.25)*4)/4:note.at,
    })).sort((a,b)=>a.at-b.at).filter((note,index,all)=>!index||note.at>all[index-1].at)
    const bounded=styled.map((note,index)=>({...note,duration:Math.max(.04,Math.min(note.duration,(styled[index+1]?.at??phraseBeats())-note.at))})).filter(note=>note.at<phraseBeats())
    const paletteAt=/** @param {number} beat */(beat)=>{
      const bar=block*turnBars+Math.floor(beat/meter())
      return source.notesAt(bar%transport.slots.length,beat%meter(),bar)
    }
    const performed=performOttoStyle(bounded,personality,phraseBeats(),paletteAt,transport.keyForBar(block*turnBars),block,phrase.length>0)
    if(block===0 && !phrase.length) performed.splice(0,performed.length,...gentleOpening(paletteAt,meter(),openingVariant),...performed.filter(note=>note.at>=meter()))
    const reply=followPlayerMotion(addChromaticApproaches(performed,personality!=='classical'&&personality!=='gentle'&&personality!=='jazz',personality!=='classical'&&personality!=='gentle'&&personality!=='jazz',random,84,12,lab.value.ornamentLength??32),phrase,beat=>{
      const bar=block*turnBars+Math.floor(beat/meter())
      return source.notesAt(bar%transport.slots.length,beat%meter(),bar)
    })
    const finalReply=block===0 && !phrase.length ? [...gentleOpening(paletteAt,meter(),openingVariant),...reply.filter(note=>note.at>=meter())] : reply
    return personality==='shred'||personality==='scale'?finalReply.map((n,i)=>({...n,duration:Math.min(phraseBeats()-n.at,((reply[i+1]?.at??phraseBeats())-n.at)+.15)})):finalReply
  }
  function tick() {
    if (!active || !player.context) return
    if (!transport.running) { stop(); return }
    if (transport.bpm !== sessionBpm && !tempoChange) {
      const time = transport.nextTime
      tempoChange = {time, beat:(time - origin) / (60 / sessionBpm), bpm:transport.bpm}
    }
    if (tempoChange && player.context.currentTime >= tempoChange.time - .1) {
      sessionBpm = tempoChange.bpm
      origin = tempoChange.time - tempoChange.beat * 60 / sessionBpm
      tempoChange = undefined
      partner.silence(); scheduled.clear()
    }
    const beat = position()
    if (beat < 0) {
      view.line = `♪  ${Math.max(1, Math.min(countBeats, Math.floor(beat + countBeats) + 1))} / ${countBeats}`
      view.status = `カウントイン · ${Math.max(1, Math.min(countBeats, Math.floor(beat + countBeats) + 1))} / ${countBeats}`
      return
    }
    if (listening) {
      const now = player.context.currentTime
      if (!answeringUntil && !held.size && lastRelease && now - lastRelease >= 1) {
        const startBeat = Math.ceil((beat + .15) * 4) / 4
        const startTime = origin + startBeat * 60 / sessionBpm
        const response = ottoReply(recorded, offset => {
          const absolute = startBeat + offset
          return source.notesAt(Math.floor(absolute / meter()) % transport.slots.length, absolute % meter(), Math.floor(absolute / meter()))
        }, transport.swing, sessionBpm, ottoStyleFor(transport.genre))
          .filter(note => note.at < phraseBeats()).map(note => ({...note, duration: Math.min(note.duration, phraseBeats() - note.at)}))
        replyPlan = response
        echoStart = startTime
        echoBeatSeconds = 60 / sessionBpm
        response.forEach(note => { if (note.midi !== undefined) partner.playAt([note.midi], startTime + note.at * 60 / sessionBpm, note.duration * 60 / sessionBpm, note.level ?? .8) })
        answeringUntil = startTime + Math.max(0, ...response.map(note => note.at + note.duration)) * 60 / sessionBpm
        view.line = 'Ottoの番 ♪'
      }
      if (answeringUntil && now >= answeringUntil) {
        listening = false; answeringUntil = 0; recorded = []; scheduled.clear()
        lastBlock = sessionTurn(beat).block
      } else {
        view.speaking = Boolean(answeringUntil)
        panel.dataset.ottoPlaying = String(Boolean(answeringUntil))
        panel.dataset.ottoInterruptible = 'true'
        view.hideContinue = true; view.hideJoin = !answeringUntil; view.hideImitate = true
        if (!answeringUntil) view.line = '聴いてるよ'
        const sounding = new Set(replyPlan.flatMap(note => {
          const start = echoStart + note.at * echoBeatSeconds
          return answeringUntil && note.midi !== undefined && now >= start && now < start + note.duration * echoBeatSeconds ? [note.midi] : []
        }))
        showKeys(sounding, false)
        return
      }
    }
    const turn = sessionTurn(beat)
    view.sessionRunning=sessionMode.value
    view.turnProgress=(beat%(meter()*turnBars*2))/(meter()*turnBars*2)
    panel.style?.setProperty('--otto-beat-duration',`${60/sessionBpm}s`)
    view.turnRemaining=Math.ceil(meter()*turnBars-turn.local)
    if (turn.block !== lastBlock) {
      held.forEach((note, step) => {
        note.duration = Math.max(0.08, phraseBeats() - note.at)
        if (note.midi !== undefined) player.release(note.midi)
        pads[step]?.removeAttribute('data-playing')
      })
      held.clear()
      if (!turn.pc) { recorded = []; scheduled.clear() }
      else if (lastBlock >= 0) {
        if (mode === 'all-pc') recorded = replyPlan.map(note => ({...note}))
        scheduled.clear(); replyPlan = makeResponse(turn.block)
      }
      lastBlock = turn.block
    }
    const message = `${turn.pc ? 'Ottoの番' : 'あなたの番'} · ${turn.bar}小節 · ${Math.floor(turn.local % meter()) + 1}拍`
    view.status = message
    const hideContinue = !turn.pc || mode === 'all-pc'
    const hideImitate = turn.pc || !recorded.length || held.size > 0
    view.hideContinue = hideContinue
    view.hideJoin = !turn.pc
    view.hideImitate = hideImitate
    const speaking = String(turn.pc)
    view.speaking = turn.pc
    if (firstEcho && !panel.dataset.inviting) panel.dataset.inviting = 'true'
    const line = turn.pc ? 'Ottoの番 ♪' : firstEcho ? '一音、聞かせて' : '君の番 ♪'
    view.line = line
    if (panel.dataset.ottoPlaying !== speaking) panel.dataset.ottoPlaying = speaking
    if (panel.dataset.ottoInterruptible !== 'false') panel.dataset.ottoInterruptible = 'false'
    /** @type {Set<number>} */
    const sounding = new Set()
    const targetBlock = turn.block
    const replyStart = origin + targetBlock * phraseBeats() * 60 / sessionBpm
    const now = player.context.currentTime
    replyPlan.forEach((note, index) => {
      const time = replyStart + note.at * 60 / sessionBpm
      const id = `${targetBlock}:${index}`
      if (turn.pc && mode !== 'all-you' && !scheduled.has(id) && time <= now + 0.12 && time >= now - 0.05 && note.midi !== undefined) {
        scheduled.add(id)
        partner.playAt([note.midi], time, note.duration * 60 / sessionBpm, note.level ?? 0.8)
      }
      if (turn.pc && now >= time && now < time + note.duration * 60 / sessionBpm) {
        if (note.midi !== undefined) sounding.add(note.midi)
      }
    })
    const localTime=(now-replyStart)/(60/sessionBpm)
    const expressiveNote=turn.pc ? [...replyPlan].reverse().find(note=>note.modulation && localTime>=note.at && localTime<note.at+note.duration) : undefined
    if(expressiveNote?.modulation) {
      const amount=modulationAt(expressiveNote.modulation,localTime-expressiveNote.at)
      if(amount!==lastReplyModulation || expressiveNote!==lastExpressiveNote){partner.setModulation(amount,true);lastReplyModulation=amount;lastExpressiveNote=expressiveNote}
    } else if(lastReplyModulation>=0) { partner.setModulation(0,true);lastReplyModulation=-1;lastExpressiveNote=undefined }
    showKeys(sounding, turn.pc)
  }

  /** @param {Set<number>} sounding @param {boolean} locked */
  function showKeys(sounding, locked) {
    // Diff the final visual state. Clearing/re-adding the same key every 25 ms
    // used to trigger CSS/attribute mutations throughout sustained notes.
    const notes = sounding.size ? source.getNotes() : []
    const soundingPads = new Set([...sounding].map(midi => notes.findIndex(note => note.midi === midi)))
    pads.forEach((pad, step) => {
      const button = /** @type {HTMLButtonElement} */ (pad)
      if (button.disabled !== locked) button.disabled = locked
      const pcPlaying = soundingPads.has(step)
      const playing = held.has(step) || pcPlaying
      if (pad.hasAttribute('data-playing') !== playing) pad.toggleAttribute('data-playing', playing)
      if (pad.hasAttribute('data-pc-playing') !== pcPlaying) pad.toggleAttribute('data-pc-playing', pcPlaying)
    })
    pianoKeys.forEach(key => {
      const midi=Number(/** @type {HTMLElement} */ (key).dataset.midi)
      const userPlaying=[...held.values()].some(note=>note.midi===midi)
      if(key.hasAttribute('data-playing')!==userPlaying)key.toggleAttribute('data-playing',userPlaying)
      const playing = sounding.has(midi)
      if (key.hasAttribute('data-pc-playing') !== playing) key.toggleAttribute('data-pc-playing', playing)
    })
  }
  async function start(intro = false, startBar = 0) {
    stop()
    openingVariant = Math.floor(Math.random()*12)
    firstEcho = intro && mode === 'all-you'
    transport.stop(); player.silence()
    const ticket = generation
    preparing = true; source.refreshTransport()
    view.line = view.status = '音を準備中…'
    sessionBpm = transport.bpm
    partner.setTimbre(player.timbre)
    partner.setVolume(player.volume)
    pads.forEach(pad => { /** @type {HTMLButtonElement} */ (pad).disabled = true; pad.classList.remove('playing') })
    try {
      await Promise.all([player.ready(), partner.ready(), transport.instrument.ready(), transport.melody?.ready(), ...transport.ornaments.map(track => track.voice.ready())])
      if (ticket !== generation) return
      const beatSeconds = 60 / sessionBpm
      const countControl = /** @type {HTMLInputElement} */ (document.querySelector('#count-in'))
      countBeats = countControl.checked ? (countControl.value === '2' ? 2 : 4) : 0
      const countIn = countBeats > 0
      const countStart = (player.context?.currentTime ?? 0) + (countIn ? 0.12 : 0.03)
      origin = countStart + (countBeats * beatSeconds)
      await transport.start(startBar, 0, origin)
      origin = transport.playbackStartTime
      if (ticket !== generation) return
      if (!transport.running) { stop(); return }
      for (let i = 0; countIn && i < countBeats; i++) source.drums.hitAt('hat', countStart + i * beatSeconds, i === 0 ? 0.9 : 0.6, 0.06)
      replyPlan = makeResponse(0)
      if (sessionTurn(0).pc) replyPlan.forEach((note, index) => {
        if (note.midi !== undefined) partner.playAt([note.midi], origin + note.at * beatSeconds, note.duration * beatSeconds, note.level ?? 0.8)
        scheduled.add(`0:${index}`)
      })
      lastBlock = -1; active = true; preparing = false
      source.refreshTransport()
      view.status = countIn ? `カウントイン · 1 / ${countBeats}` : '演奏スタート'
      timer = setInterval(tick, 25)
    } catch (error) {
      if (ticket === generation) { stop(); view.line = view.status = error instanceof Error ? error.message : '音を準備できませんでした。もう一度試してね。' }
    }
  }
  /** @param {number} step */
  function attack(step, midiOverride = -1, glide = false) {
    if (!active || held.has(step)) return
    const beat = position()
    if (beat < 0) return
    if (listening && !recorded.length) listenStart = beat
    if (!listening && sessionTurn(beat).pc || recorded.length >= 64) return
    if (listening && answeringUntil) { partner.silence(); answeringUntil = 0; recorded = []; listenStart = beat }
    if (listening) lastRelease = 0
    tick()
    if (!active) return
    const pitch = midiOverride >= 0 ? {midi:midiOverride,category:'scale'} : source.getNotes()[step]
    if (!pitch) return
    if (firstEcho) {
      firstEcho = false
      delete panel.dataset.inviting
      listening = true
      recorded = []
      listenStart = beat
      lastRelease = 0
      view.line = '聴いてるよ'
    }
    const note = {step, midi: pitch.midi, category: pitch.category, at: listening ? Math.min(phraseBeats() - .25, beat - listenStart) : beat % phraseBeats(), duration: 0.25, modulation:[{at:0,value:midiModulation}]}
    recorded.push(note); held.set(step, note)
    player.attack(pitch.midi,glide); source.reportNote(pitch.midi)
    pads[step]?.setAttribute('data-playing','')
  }
  pads.forEach(pad => {
    const hand = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    hand.setAttribute('viewBox', '0 0 64 64'); hand.setAttribute('aria-hidden', 'true')
    hand.classList.add('talk-pad-hand')
    hand.innerHTML = '<g transform="rotate(180 32 32)"><path d="M24 31V10c0-7 9-7 9 0v16c3-6 9-4 9 2 4-6 10-2 8 5 7-4 12 3 5 13l-9 12H25L10 42c-6-8 2-14 9-7l5 5z"/><path d="M27 49h17M33 27v10m9-9v11m8-6-2 9"/></g>'
    pad.append(hand)
  })
  open?.addEventListener('click', source.reveal)
  function join() {
    if (!active || !(answeringUntil || sessionTurn(Math.max(0, position())).pc)) return
    partner.silence(); scheduled.clear(); recorded = []; listening = false; answeringUntil = 0
    mode = 'all-you'; source.onModeChange(mode); lastBlock = -1
    view.hideJoin = true; view.hideContinue = true; view.speaking = false
    panel.dataset.ottoPlaying = 'false'
    pads.forEach(pad => { /** @type {HTMLButtonElement} */ (pad).disabled = false })
    view.line = '君のメロディ聞かせて'
  }
  function imitate() {
    if (!active || mode !== 'all-you' || !recorded.length || held.size) return
    listening = true; answeringUntil = 0
    mode = 'all-pc'; source.onModeChange(mode);
    /** @type {HTMLSelectElement} */ (document.querySelector('#melody-mode')).dispatchEvent(new Event('change', {bubbles:true}))
    const first = recorded[0].at
    recorded = recorded.map(note => ({...note, at: Math.max(0, note.at - first)}))
    lastRelease = (player.context?.currentTime ?? 0) - 1.01
    view.hideImitate = true
    tick()
  }
  function keepPlaying() {
    if (!active || !sessionTurn(Math.max(0, position())).pc) return
    mode = 'all-pc'
    view.hideContinue = true
    source.onModeChange(mode)
    const select = /** @type {HTMLSelectElement} */ (document.querySelector('#melody-mode'))
    select.dispatchEvent(new Event('change', {bubbles:true}))
  }
  /** @param {string} value */
  function setMode(value) {
    // Section part restoration must not cancel the explicitly selected Otto solo.
    if (sessionMode.value) value = userFirst?'you':'pc'
    else if (labMode.value) value = 'all-pc'
    if (!Object.hasOwn(modeLines,value)) throw new RangeError('Unknown session mode')
    if (mode === value) return
    held.forEach((note, step) => release(step))
    partner.silence()
    mode = value
    firstEcho = false
    delete panel.dataset.inviting
    if (listening) { listening = false; answeringUntil = 0; recorded = [] }
    scheduled.clear()
    if (active) {
      const beat = Math.max(0, position())
      const turn = sessionTurn(beat)
      replyPlan = turn.pc ? makeResponse(turn.block) : []
      lastBlock = turn.block
      tick()
    }
    view.line = selectedLine(); source.onModeChange(value)
  }
  window.addEventListener('blur', () => { if (active || preparing) stop() })
  document.addEventListener('visibilitychange', () => { if (document.hidden && (active || preparing)) stop() })
  view.line = selectedLine()
  function timbreChanged() {
    if (partner.timbre === player.timbre) return
    partner.silence()
    partner.setTimbre(player.timbre)
    if (active && !listening) { scheduled.clear(); tick() }
  }
  function styleChanged() {
    timbreChanged()
    if (!active) return
    if (listening) { partner.silence(); listening = false; answeringUntil = 0 }
    if (mode === 'all-pc') recorded = []
    harmonyChanged()
  }
  function harmonyChanged() {
    if (!active) return
    const turn = sessionTurn(Math.max(0, position()))
    if (!turn.pc) return
    partner.silence()
    replyPlan = makeResponse(turn.block)
    scheduled.clear()
  }
  if(mountView===mountBuddyView){
  const labHost=document.createElement('div');labHost.className='otto-lab-host';panel.querySelector('.melody-heading')?.after(labHost)
  const groups=[
    {name:'音階',toggles:[['repeat','音形を繰り返す'],['resolve','終わりを着地させる']],knobs:[['tension','テンション',0,100],['avoid','半音のぶつかり',0,100],['leaps','跳躍',0,100],['register','音域の中心',48,84],['maxLeap','最大跳躍（半音）',1,24],['highest','最高音',48,84]]},
    {name:'リズム',toggles:[['pickup','助走を入れる']],knobs:[['density','音の密度',0,100],['syncopation','食い気味にずらす',0,100],['gate','音の長さ',10,100],['ornamentLength','飾りの音の長さ',10,100]]},
    {name:'聴きやすさ',toggles:[],knobs:[['rests','休符',0,100],['contrast','緩急',0,100]]},
  ]
  const update=(/** @type {string} */ id,/** @type {number|boolean|string} */ value)=>{if(id==='playStyle')source.onPlayStyleChange?.(String(value));Reflect.set(lab.value,id,value)}
  createApp({render:()=>{view.status;return [
    h('fieldset',{class:'segmented-control otto-play-mode','aria-label':'メロディの演奏者'},[h('legend',{class:'sr-only'},'メロディの演奏者'),...[['session','Ottoとセッション'],['auto','Ottoに弾いてもらう'],['manual','自分で弾く']].map(([value,label])=>h('label',[h('input',{type:'radio',name:'otto-lab-mode',value,checked:value==='session'?sessionMode.value:value==='auto'?labMode.value:!labMode.value&&!sessionMode.value,onChange:()=>{sessionMode.value=value==='session';view.sessionVisible=sessionMode.value;labMode.value=value==='auto';setMode(sessionMode.value?'pc':labMode.value?'all-pc':'all-you');if(value==='manual')stop();}}),h('span',label)]))]),
    h('label',{class:'otto-style-choice'},['Ottoのプレイスタイル ',h('select',{'aria-label':'Ottoのプレイスタイル',value:lab.value.playStyle??'craft',onChange:(/** @type {Event} */ e)=>update('playStyle',(/** @type {HTMLSelectElement} */(e.target)).value)},...[['imitate','丁寧に真似する'],['gentle','やさしい'],['classical','クラシック上がり'],['shred','高速ピロピロマン'],['scale','スケール大好き'],['jazz','ジャズ好き'],['craft','職人ソロプレイヤー']].map(([value,label])=>h('option',{value},label)))]),
    labMode.value?h('div',{class:'otto-lab'},[
      h('div',{class:'otto-lab-toolbar'},[h('button',{type:'button',class:'reference-remove-key',onClick:()=>{if(active)stop();else void start()}},active?'停止':'▶ フレーズを再生'),h('button',{type:'button',class:'reference-remove-key',onClick:()=>{source.onPlayStyleChange?.(defaultOttoLab.playStyle);lab.value={...defaultOttoLab}}},'初期値に戻す'),h('span','変更は次のフレーズから反映')]),
      ...groups.map(group=>h('section',{class:'otto-lab-group'},[h('h3',group.name),...group.toggles.map(([id,label])=>h('label',{class:'oto-checkbox'},[h('input',{type:'checkbox',checked:Reflect.get(lab.value,id),onChange:(/** @type {Event} */ e)=>update(id,(/** @type {HTMLInputElement} */(e.target)).checked)}),h('span',label)])),
      h('div',{class:'otto-lab-knobs'},group.knobs.map(([id,label,min,max])=>{
        const value=Number(Reflect.get(lab.value,String(id)))
        return h('label',{class:'otto-lab-knob'},[h('span',String(label)),h('span',{class:'volume-knob',style:`--angle:${-135+(value-Number(min))/(Number(max)-Number(min))*270}deg`},[h('input',{type:'range',min,max,step:1,value,disabled:lab.value.pentatonic&&['tension','avoid','syncopation','contrast'].includes(String(id)),'aria-label':String(label),onInput:(/** @type {Event} */ e)=>update(String(id),Number((/** @type {HTMLInputElement} */(e.target)).value)),onPointerdown:(/** @type {PointerEvent} */ event)=>{
          if(event.button!==0||(/** @type {HTMLInputElement} */(event.target)).disabled)return;event.preventDefault()
          const input=/** @type {HTMLInputElement} */(event.target),x=event.clientX,y=event.clientY
          input.focus();input.setPointerCapture(event.pointerId)
          const move=(/** @type {PointerEvent} */ e)=>update(String(id),Math.round(Math.max(Number(min),Math.min(Number(max),value+(e.clientX-x-e.clientY+y)*.5))))
          const end=()=>{input.removeEventListener('pointermove',move);input.removeEventListener('pointerup',end);input.removeEventListener('pointercancel',end)}
          input.addEventListener('pointermove',move);input.addEventListener('pointerup',end);input.addEventListener('pointercancel',end)
        }}),h('span',{'aria-hidden':'true'})]),h('output',String(value)+(id==='register'||id==='highest'?' MIDI':id==='maxLeap'?' 半音':'%'))])
      })),group.name==='音階'?h('label',['終わりの音 ',h('select',{'aria-label':'終わりの音',value:lab.value.ending,onChange:(/** @type {Event} */ e)=>update('ending',(/** @type {HTMLSelectElement} */(e.target)).value)},[h('option',{value:'chord'},'コードのR・3・5度'),h('option',{value:'tonic'},'キーの1・3・5度')])]):null,
      group.name==='リズム'?h('label',['フレーズ ',h('select',{'aria-label':'フレーズの小節数',value:lab.value.phraseBars,onChange:(/** @type {Event} */ e)=>update('phraseBars',Number((/** @type {HTMLSelectElement} */(e.target)).value))},[h('option',{value:2},'2小節'),h('option',{value:4},'4小節')])]):null])),
    ]):null,
  ]}}).mount(labHost)
  }
  /** @param {number} amount */
  function rememberModulation(amount) {
    midiModulation=Math.max(0,Math.min(1,amount))
    if(!active || !player.context) return
    const beat=position()
    const local=listening ? beat-listenStart : beat%phraseBeats()
    held.forEach(note=>{if(note.modulation && local>=note.at)note.modulation.push({at:Math.max(0,local-note.at),value:midiModulation})})
  }
  return {harmonyChanged, styleChanged, timbreChanged, rememberModulation, get autoPlay() { return labMode.value || sessionMode.value }, get active() { return active || preparing }, start, setMode, attack, attackMidi: (/** @type {number} */ midi, glide = false) => attack(100+midi,midi,glide), releaseMidi: (/** @type {number} */ midi) => release(100+midi), release, stop}
}
