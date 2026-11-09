// Pure Otto phrase planning: no UI, audio nodes, or playback clock.
import { melodyRole } from './music.js'
import { swungBassBeat } from './groove.js'
/** @typedef {ReturnType<typeof import('./music.js').melodyPalette>} Palette */
/** @typedef {import('./otto-style.js').ottoStyleFor} ottoStyleFor */

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
 * @param {readonly PhraseNote[]} input @param {(beat:number)=>Palette} suppliedPalette @param {number} swing @param {number} [bpm] @param {ReturnType<ottoStyleFor>} [style]
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
 let previous=65 + ((variant % 3)-1)*2
 for (const at of times) {
  const palette=paletteAt(at).filter(note=>!note.clash && note.category==='chord' && note.midi>=60 && note.midi<=74)
  if (!palette.length) continue
  const target=previous+(notes.length===1 ? (variant%2?2:-2) : 0)
  const selected=[...palette].sort((a,b)=>Math.abs(a.midi-target)-Math.abs(b.midi-target))[0]
  notes.push({step:0,at,duration:Math.min(.85,meter-at),midi:selected.midi,category:selected.category,level:.68,kind:'quote'})
  previous=selected.midi
 }
 return notes.map((note,i)=>({...note,duration:Math.min(note.duration,(notes[i+1]?.at??meter)-note.at)}))
}

/** @typedef {{pentatonic:boolean,chromatic:boolean,pickup:boolean,repeat:boolean,resolve:boolean,phraseBars:number,tension:number,avoid:number,leaps:number,density:number,syncopation:number,rests:number,variation:number,contrast:number,gate:number,register:number,ending:string,omit?:number,wholeTone?:boolean,maxLeap?:number,highest?:number,ornamentLength?:number,soloFlair?:boolean,playStyle?:string}} OttoLabSettings */
export const defaultOttoLab = Object.freeze({pentatonic:true,chromatic:true,pickup:false,repeat:true,resolve:true,phraseBars:2,tension:0,avoid:0,leaps:0,density:90,syncopation:0,rests:5,variation:25,contrast:15,gate:95,register:66,ending:'chord',omit:9,wholeTone:true,maxLeap:7,highest:84,ornamentLength:32,playStyle:'craft'})
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
export function addChromaticApproaches(notes,enabled,wholeTone,random,highest,maxLeap,ornamentLength) {
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
   const candidates=paletteAt(note.at).flatMap(p=>Array.from({length:11},(_,octave)=>({...p,midi:p.midi%12+octave*12}))).filter(p=>p.midi<=127&&!p.clash&&allowed(p.midi)).sort((a,b)=>Math.abs(a.midi-near)-Math.abs(b.midi-near)||Math.abs(a.midi-previous)-Math.abs(b.midi-previous))
   if(!candidates.length)continue
   midi=candidates[0].midi
  }
  result.push({...note,midi});previous=midi
 }
 return result
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

/** Score alignment with configured harmony and the accompaniment's swung sixteenth grid.
 * This is musical feedback, not pitch recognition of the reference recording.
 * @param {number} midi @param {string} chord @param {number} key
 * @param {number} elapsedSeconds @param {number} bpm @param {number} swing */
export function performanceMatch(midi, chord, key, elapsedSeconds, bpm, swing) {
 if(!Number.isFinite(elapsedSeconds)||bpm<=0)return 0
 const beats=elapsedSeconds*bpm/60
 let distance=Infinity
 for(let tick=-4;tick<=8;tick++)distance=Math.min(distance,Math.abs(beats-swungBassBeat(tick/2,swing)))
 const timing=Math.max(0,1-distance*60/bpm/.10)
 const role=melodyRole(midi,chord,key)
 const pitch=role.category==='chord'?1:role.clash?0:.7
 return timing*.55+pitch*.45
}
