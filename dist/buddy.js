import { mountBuddyView, mountBuddyLab, mountPhraseHistory } from './buddy-view.js'
import { ref } from './vendor/vue.runtime.esm-browser.prod.js'
import { ottoStyleFor } from './otto-style.js'
import { Instrument } from './audio.js'
import { Progression } from './progression.js'

import { modulationAt, ottoReply, gentleOpening, defaultOttoLab, ottoLabPhrase, developingSolo, performOttoStyle, followPlayerMotion, conversationTurn, addChromaticApproaches } from './otto-phrases.js'
export { modulationAt, grooveGrid, echoPhrase, melodicMotionCost, ottoReply, gentleOpening, defaultOttoLab, ottoLabPhrase, developingSolo, performOttoStyle, followPlayerMotion, conversationScore, conversationTurn, performanceMatch } from './otto-phrases.js'
/** @typedef {import('./otto-phrases.js').PhraseNote} PhraseNote */
/** @typedef {import('./otto-phrases.js').OttoLabSettings} OttoLabSettings */

/** @type {Record<string,{play:string[],listen:string[]}>} */
const ottoLines={
 craft:{play:['こうかな？ いい感じじゃない？','この音、つないでみよう','少し隙間を空けてみるね'],listen:['おぉ…いいじゃん…！','その間、好きだな','うん、その続きを聴きたい']},
 imitate:{play:['さっきのフレーズ、こうかな？','君の音を、少しだけ変えてみたよ','この感じ、受け取れたかな？'],listen:['そのフレーズ、覚えておこう','おっ、その入り方いいね','うんうん、聴いてるよ']},
 gentle:{play:['こんなふうに、ゆっくりどう？','一音ずつ、置いてみよう','この余韻、気持ちいいね'],listen:['うん、いい感じだね','その音、やさしく響くね','急がなくていいよ、聴いてる']},
 classical:{play:['この音から、着地してみよう','旋律をつなぐと、こうかな？','少し歌うように弾いてみるね'],listen:['おぉ、そのつながりいいね','きれいに歌ってるね','その終わり方、好きだな']},
 shred:{play:['ちょっと駆け上がってみるね！','ここ、勢いつけてみよう','ふぅ！ こんなのはどう？'],listen:['おぉ…いいじゃん…！','今の、勢いがあっていいね！','よし、僕も乗ってきた！']},
 scale:{play:['こんなスケールの響きはどうかな？','この音の並び、試してみよう','少し違う道を通ってみるね'],listen:['おっ、その音を選ぶんだね','その並び、おもしろいね','いいね、そこからどう行く？']},
 jazz:{play:['ちょっと裏から入ってみよう','この響き、どうかな？','少しためると…こんな感じ'],listen:['おぉ、そのノリいいね','今の間、気持ちいいな','うん、いいところに置いたね']},
}
const modeLines = {
  pc: '僕と交互にメロディをプレイしよう',
  you: '君からメロディをプレイしてね',
  'all-you': '一緒に弾こう',
  'all-pc': '僕がメロディ奏でてみるよ',
}

/** @typedef {ReturnType<typeof import('./music.js').melodyPalette>} Palette */
/** @param {{progression:Progression,instrument:Instrument,drums:import('./rhythm.js').DrumSynth,getNotes:()=>Palette,notesAt:(bar:number,beat:number,absoluteBar:number)=>Palette,reportNote:(midi:number)=>void,refreshTransport:()=>void,onModeChange:(mode:string)=>void,onPlayStyleChange?:(style:string)=>void,reveal:()=>void}} source
 * @param {typeof mountBuddyView} [mountView] */
export function mountBuddy(source, mountView = mountBuddyView) {
  const panel = /** @type {HTMLElement} */ (document.querySelector('#detail-melody'))
  const ui = /** @type {HTMLElement} */ (document.querySelector('#buddy-inline'))
  const open = /** @type {HTMLButtonElement} */ (document.querySelector('#buddy-talk-open'))
  const view = mountView(ui, {join, imitate, keepPlaying,first:user=>{userFirst=user;setMode(user?'you':'pc')},bars:bars=>{turnBars=bars;if(active){partner.silence();scheduled.clear();recorded=[];lastBlock=-1;const turn=sessionTurn(Math.max(0,position()));replyPlan=turn.pc?makeResponse(turn.block):[];tick()}},shift:direction=>{if(active){origin+=direction*meter()*60/sessionBpm;partner.silence();scheduled.clear();lastBlock=-1;recorded=[];replyPlan=makeResponse(sessionTurn(Math.max(0,position())).block);tick()}}})
  const {captureNote: recordPhraseNote} = mountPhraseHistory(mountView === mountBuddyView ? ui : null, () => source.progression.running)

  /** @param {PhraseNote} note @param {number} start */
  function captureNote(note, start) {
    recordPhraseNote(note, start, () => {
      const beats = meter()
      const bars = Math.ceil(phraseBeats() / beats)
      const {slots, nextStep} = transport
      return {
        bpm: sessionBpm,
        key: transport.keyForBar(Math.floor(Math.max(0, position()) / beats)),
        beats, bars,
        chords: Array.from({length:bars}, (_, index) => slots[(nextStep + index) % slots.length]),
      }
    })
  }
  const pianoKeys = Array.from(document.querySelectorAll('#piano-keys [data-midi]'))
  const pads = Array.from(document.querySelectorAll('#pads button'))
  const transport = source.progression
  const player = source.instrument
  const partner = new Instrument('melody')
  partner.singing = true
  const lab=ref(/** @type {OttoLabSettings} */ ({...defaultOttoLab}))
  const labMode=ref(false)
  const sessionMode=ref(false)
  view.sessionVisible=sessionMode.value
  /** @type {PhraseNote[]} */
  let recorded = []
  /** @type {Map<number, PhraseNote & {screen:boolean}>} */
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
  /** @param {boolean} [stopTransport] */
  function stop(stopTransport = true) {
    const owned = active || preparing
    generation++; active = false; preparing = false
    listening = false; firstEcho = false; answeringUntil = 0; tempoChange = undefined
    clearInterval(timer); timer = undefined
    if (owned && stopTransport) { transport.stop(); player.silence() }
    panel.dataset.ottoPlaying = 'false'
    delete panel.dataset.inviting
    partner.silence(); lastReplyModulation = -1
    held.clear(); recorded = []; replyPlan = []; scheduled.clear(); lastBlock = -1
    pads.forEach(pad => {
      pad.removeAttribute('data-playing'); pad.removeAttribute('data-pc-playing');
      /** @type {HTMLButtonElement} */ (pad).disabled = false
    })
    pianoKeys.forEach(key => { key.removeAttribute('data-pc-playing'); key.removeAttribute('data-playing') })
    view.speaking = false; view.line = selectedLine(); view.hideContinue = true; view.hideJoin = true; view.hideImitate = true
    source.refreshTransport()
    view.sessionRunning=false;view.turnProgress=0;view.turnRemaining=0
    document.dispatchEvent(new CustomEvent('session-rhythm-beat', {detail:{beat:-1, beats:meter()}}))
    view.status = '停止'
  }
  let dialogueKey='',dialogueText='',dialogueIndex=0
  function dialogue(/** @type {'play'|'listen'} */ kind,/** @type {number} */ block) {
    const style=lab.value.playStyle ?? 'craft', key=`${style}:${kind}:${block}`
    if(key!==dialogueKey){const lines=(ottoLines[style] ?? ottoLines.craft)[kind];dialogueText=lines[dialogueIndex++%lines.length];dialogueKey=key}
    return dialogueText
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
    const { bpm, time } = transport.scheduledTempo
    if (bpm !== sessionBpm && !tempoChange) {
      tempoChange = {time, beat:(time - origin) / (60 / sessionBpm), bpm}
    }
    if (tempoChange && player.context.currentTime >= tempoChange.time) {
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
        response.forEach(note => { if (note.midi !== undefined) partner.playAt([note.midi], startTime + note.at * 60 / sessionBpm, note.duration * 60 / sessionBpm, note.level ?? .8);captureNote(note,startTime) })
        answeringUntil = startTime + Math.max(0, ...response.map(note => note.at + note.duration)) * 60 / sessionBpm
        view.line = dialogue('play',Math.floor(beat/phraseBeats()))
      }
      if (answeringUntil && now >= answeringUntil) {
        listening = false; answeringUntil = 0; recorded = []; scheduled.clear()
        lastBlock = sessionTurn(beat).block
      } else {
        view.speaking = Boolean(answeringUntil)
        panel.dataset.ottoPlaying = String(Boolean(answeringUntil))
        panel.dataset.ottoInterruptible = 'true'
        view.hideContinue = true; view.hideJoin = !answeringUntil; view.hideImitate = true
        if (!answeringUntil) view.line = '聴いてるよ、続けてみて'
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
    if (sessionMode.value) document.dispatchEvent(new CustomEvent('session-rhythm-beat', {detail: {beat: beat % meter(), beats: meter()}}))
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
    const line = turn.pc ? dialogue('play',turn.block) : firstEcho ? '一音、聞かせて' : '君の番だよ。聴いてるね'
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
      if (turn.pc && mode !== 'all-you' && !scheduled.has(id) && time < (tempoChange?.time ?? Infinity) && time <= now + 0.12 && time >= now - 0.05 && note.midi !== undefined) {
        scheduled.add(id)
        partner.playAt([note.midi], time, note.duration * 60 / sessionBpm, note.level ?? 0.8)
        captureNote(note,replyStart)
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
      const userPlaying=[...held.values()].some(note=>note.midi===midi && !note.screen)
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
    partner.setTimbre(player.timbre)
    partner.setVolume(player.volume)
    pads.forEach(pad => { /** @type {HTMLButtonElement} */ (pad).disabled = true; pad.classList.remove('playing') })
    try {
      await Promise.all([player.ready(), partner.ready(), transport.instrument.ready(), transport.melody?.ready(), ...transport.ornaments.map(track => track.voice.ready())])
      if (ticket !== generation) return
      sessionBpm = transport.bpmForBar(startBar)
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
        if (note.at >= meter()) return
        if (note.midi !== undefined) {partner.playAt([note.midi], origin + note.at * beatSeconds, note.duration * beatSeconds, note.level ?? 0.8);captureNote(note,origin)}
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
  async function joinPlayback() {
    if (!transport.running || active || preparing) return
    const ticket = ++generation
    preparing = true
    partner.setTimbre(player.timbre)
    partner.setVolume(player.volume)
    try {
      await partner.ready()
      if (ticket !== generation || !transport.running) return
      sessionBpm = transport.scheduledTempo.bpm || transport.bpm
      origin = transport.nextTime - transport.nextAbsoluteBar * meter() * 60 / sessionBpm
      const turn = sessionTurn(Math.max(0, position()))
      replyPlan = turn.pc ? makeResponse(turn.block) : []
      lastBlock = turn.block
      active = true
      preparing = false
      source.refreshTransport()
      tick()
      timer = setInterval(tick, 25)
    } catch (error) {
      if (ticket === generation) {
        stop(false)
        view.status = error instanceof Error ? error.message : '音を準備できませんでした。'
      }
    } finally {
      if (ticket === generation && !active) preparing = false
    }
  }
  /** @param {number} step @param {number} midiOverride @param {boolean} glide @param {boolean} screen */
  function attack(step, midiOverride = -1, glide = false, screen = false) {
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
    const note = {step, screen, midi: pitch.midi, category: pitch.category, at: listening ? Math.min(phraseBeats() - .25, beat - listenStart) : beat % phraseBeats(), duration: 0.25, modulation:[{at:0,value:midiModulation}]}
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
  /** @param {string} value */
  function setPlayMode(value) {
    if (!['session', 'all-pc', 'all-you'].includes(value)) return
    sessionMode.value = value === 'session'
    view.sessionVisible = sessionMode.value
    labMode.value = value === 'all-pc'
    setMode(sessionMode.value ? (userFirst ? 'you' : 'pc') : value)
    source.onModeChange(sessionMode.value ? 'session' : value)
    if (value === 'all-you') stop(false)
    else if (transport.running && !active && !preparing) void joinPlayback()
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
  if (mountView === mountBuddyView) mountBuddyLab(panel, {
    view, player, partner, lab, labMode, sessionMode, setPlayMode,
    onPlayStyleChange:source.onPlayStyleChange,
  })
  /** @param {number} amount */
  function rememberModulation(amount) {
    midiModulation=Math.max(0,Math.min(1,amount))
    if(!active || !player.context) return
    const beat=position()
    const local=listening ? beat-listenStart : beat%phraseBeats()
    held.forEach(note=>{if(note.modulation && local>=note.at)note.modulation.push({at:Math.max(0,local-note.at),value:midiModulation})})
  }
  return {harmonyChanged, styleChanged, timbreChanged, rememberModulation, setPlayMode, get autoPlay() { return labMode.value || sessionMode.value }, get active() { return active || preparing }, start, setMode, attack, attackMidi: (/** @type {number} */ midi, glide = false, screen = false) => attack(100+midi,midi,glide,screen), releaseMidi: (/** @type {number} */ midi) => release(100+midi), release, stop}
}
