import { createApp, h, ref } from './vendor/vue.runtime.esm-browser.prod.js'
import { getTimbre } from './timbres.js'
import { phraseNotation } from './music.js'
import { Instrument } from './audio.js'
import { defaultOttoLab } from './otto-phrases.js'

/** @param {HTMLElement} ui @param {{join:()=>void,imitate:()=>void,keepPlaying:()=>void,first?:(user:boolean)=>void,shift?:(direction:number)=>void,bars?:(bars:number)=>void}} actions */
export function mountBuddyView(ui, actions) {
  const originalBuddy = /** @type {HTMLElement} */ (document.querySelector('#oto-buddy'))
  const view = ref({
    line: '', status: '', speaking: false, look: originalBuddy.dataset.look ?? '',
    hideContinue: true, hideJoin: true, hideImitate: true,
    turnProgress:0,turnRemaining:0,sessionVisible:false,sessionRunning:false,userFirst:false,turnBars:2,
  }).value
  /** @param {boolean} user */
  function selectFirst(user) {
    view.userFirst = user
    actions.first?.(user)
  }
  createApp({
    render: () => [
      h('div',{class:'session-turn-display',inert:!view.sessionVisible},[
        h('div',{class:'session-ring-row','role':'group','aria-label':'交代位置の調整'},[
            h('button',{class:'session-turn-ring',type:'button',
              'aria-label':view.userFirst?'自分が先。押すとOttoが先':'Ottoが先。押すと自分が先',
              title:'先に弾く人を切り替える',onClick:()=>selectFirst(!view.userFirst)},[
              h('svg',{viewBox:'0 0 100 100','aria-hidden':'true'},[
                h('circle',{cx:50,cy:50,r:42,class:view.userFirst?'turn-user':'turn-otto',fill:'none','stroke-width':8,'stroke-dasharray':'131.95 131.95',transform:'rotate(-90 50 50)'}),
                h('circle',{cx:50,cy:50,r:42,class:view.userFirst?'turn-otto':'turn-user',fill:'none','stroke-width':8,'stroke-dasharray':'131.95 131.95',transform:'rotate(90 50 50)'}),
                h('circle',{cx:50,cy:8,r:5,class:'turn-marker',transform:`rotate(${view.turnProgress*360} 50 50)`}),
              ]),
              h('span',{class:'session-turn-count','aria-hidden':'true'},[
                h('strong', view.sessionRunning ? String(view.turnRemaining) : `${view.turnBars}＋${view.turnBars}`),
                view.sessionRunning ? h('small', view.speaking ? 'Otto' : 'あなた') : null,
              ]),
            ]),
            h('div',{class:'style-stepper session-offset-stepper'},[
              h('button',{type:'button','aria-label':'交代位置を1小節後へ',onClick:()=>actions.shift?.(1)},'＋'),
              h('button',{type:'button','aria-label':'交代位置を1小節前へ',onClick:()=>actions.shift?.(-1)},'−'),
            ]),
        ]),
        h('div',{class:'part-choice-field session-timing-field'},[
          h('span','交代のタイミング'),
          h('fieldset',{class:'segmented-control session-length','aria-label':'交代する小節数'},[h('legend',{class:'sr-only'},'交代する小節数'),...[2,4].map(bars=>h('label',[h('input',{type:'radio',name:'session-turn-bars',checked:view.turnBars===bars,onChange:()=>{view.turnBars=bars;actions.bars?.(bars)}}),h('span',`${bars}小節`)]))]),
        ]),
      ]),
      h('div', {class: 'talk-companion'}, [
        h('div', {class: 'talk-face', 'aria-hidden': 'true', 'data-speaking': String(view.speaking), 'data-listening':String(view.sessionRunning&&!view.speaking)}, [
          h('div', {class: 'talk-avatar', 'data-mood': 'idle', 'data-look': view.look}),
          h('span',{class:'otto-floating-notes','aria-hidden':'true'},['♪','♫','♪'].map((note,index)=>h('span',{class:'otto-floating-note',style:`--note-index:${index}`},note))),
        ]),
        h('p', {class: 'talk-bubble'}, view.line),
      ]),
      h('p', {id: 'buddy-status', class: 'sr-only', role: 'status', 'aria-live': 'polite'}, view.status),
    ],
  }).mount(ui)
  const drawing = originalBuddy.querySelector('svg')
  if (drawing) ui.querySelector('.talk-avatar')?.append(drawing.cloneNode(true))
  return view
}

/** @typedef {{id:number,bpm:number,key:number,beats:number,bars:number,chords:string[],notes:{midi:number,at:number,duration:number,level:number}[],saved?:boolean}} PhraseCapture */
/** @param {HTMLElement|null} anchor @param {()=>boolean} isPlaying */
export function mountPhraseHistory(anchor, isPlaying) {
  const phraseHistory=ref(/** @type {PhraseCapture[]} */([])), phraseIndex=ref(0), phraseNotice=ref('')
  let captureStart=-Infinity
  const phraseHost=anchor ? document.createElement('section') : null;if(phraseHost){phraseHost.className='otto-phrase-score';anchor?.after(phraseHost)}
  const audition=new Instrument('melody')
  let auditionGeneration=0
  const stopAudition=()=>{auditionGeneration++;audition.silence()}
  window.addEventListener('blur',stopAudition)
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stopAudition()})
  if(phraseHost)document.getElementById('progression-play')?.addEventListener('change',stopAudition)
  const download=(/** @type {Blob} */ blob,/** @type {string} */ name)=>{const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
  function savePhrase(){
    const phrase=phraseHistory.value[phraseIndex.value];if(!phrase)return
    download(new Blob([JSON.stringify(phrase,null,2)],{type:'application/json'}),`otto-phrase-${phrase.id}.json`)
    phrase.saved=true;phraseNotice.value='フレーズをファイルに保存しました'
  }
  async function previewPhrase(){
    const phrase=phraseHistory.value[phraseIndex.value];if(!phrase)return
    const ticket=++auditionGeneration;audition.silence()
    if(isPlaying()){phraseNotice.value='再試聴するには演奏を停止してください';return}
    try{await audition.ready();if(ticket!==auditionGeneration)return;const start=(audition.context?.currentTime ?? 0)+.05
      for(const note of phrase.notes)audition.playAt([note.midi],start+note.at*60/phrase.bpm,note.duration*60/phrase.bpm,note.level)
    }catch{phraseNotice.value='再試聴できませんでした'}
  }
  const midiFile=(/** @type {PhraseCapture} */ phrase)=>{
    const variable=(/** @type {number} */ n)=>{const bytes=[n&127];while(n>>=7)bytes.unshift((n&127)|128);return bytes}
    const tempo=Math.round(60000000/phrase.bpm), events=[{at:0,bytes:[255,81,3,(tempo>>16)&255,(tempo>>8)&255,tempo&255]}]
    for(const n of phrase.notes){events.push({at:Math.round(n.at*480),bytes:[144,n.midi,Math.max(1,Math.round(n.level*100))]},{at:Math.round((n.at+n.duration)*480),bytes:[128,n.midi,0]})}
    events.sort((a,b)=>a.at-b.at||a.bytes[0]-b.bytes[0]);let previous=0;const data=[]
    for(const event of events){data.push(...variable(event.at-previous),...event.bytes);previous=event.at}data.push(0,255,47,0)
    return new Uint8Array([77,84,104,100,0,0,0,6,0,0,0,1,1,224,77,84,114,107,(data.length>>>24)&255,(data.length>>>16)&255,(data.length>>>8)&255,data.length&255,...data])
  }
  if(phraseHost)createApp({render:()=>{
    const phrase=phraseHistory.value[phraseIndex.value]
    return [h('div',{class:'otto-phrase-tools'},[h('strong','Ottoのフレーズ'),h('button',{type:'button',disabled:phraseIndex.value<=0,onClick:()=>phraseIndex.value--,'aria-label':'前のフレーズ'},'←'),h('span',phrase?`${phraseIndex.value+1} / ${phraseHistory.value.length}`:'まだ演奏していません'),h('button',{type:'button',disabled:phraseIndex.value>=phraseHistory.value.length-1,onClick:()=>phraseIndex.value++,'aria-label':'次のフレーズ'},'→'),h('button',{type:'button',disabled:!phrase,onClick:previewPhrase},'再試聴'),h('button',{type:'button',disabled:!phrase,onClick:savePhrase},'残す'),h('button',{type:'button',disabled:!phrase,onClick:()=>{if(phrase)download(new Blob([midiFile(phrase)],{type:'audio/midi'}),`otto-phrase-${phrase.id}.mid`)}},'MIDI')]),
    phrase?(()=>{const score=phraseNotation(phrase), sharpY=[50,65,45,60,75,55], flatY=[70,55,75,60,80,65];return h('div',{class:'otto-staff-scroll'},[h('svg',{viewBox:`0 0 ${score.width} 150`,role:'img','aria-label':'Ottoが演奏したフレーズの簡易五線譜'},[
     ...[0,1,2,3,4].map(i=>h('path',{d:`M10 ${50+i*10}H${score.width-10}`,class:'otto-staff-line'})),
     h('text',{x:12,y:82,'font-size':38},'𝄞'),
     ...score.signature.map((name,i)=>h('text',{x:38+i*9,y:(name.includes('♯')?sharpY:flatY)[i]+5,'font-size':16},name.includes('♯')?'♯':'♭')),
     ...Array.from({length:phrase.bars},(_,i)=>h('g',[h('path',{d:`M${score.start+i*score.barWidth} 50V90`,class:'otto-staff-line'}),h('text',{x:score.start+3+i*score.barWidth,y:24,'font-size':12},phrase.chords[i]??'')])),
     ...score.groups.flatMap(group=>{const beamY=Math.min(...group.map(note=>note.y))-28, beamed=group.length>1 && group[0].flags>0;return [
       ...group.map(note=>h('g',[...Array.from({length:Math.max(0,Math.floor((note.y-90)/10))},(_,i)=>h('path',{d:`M${note.x-8} ${100+i*10}h18`,class:'otto-staff-line'})),...Array.from({length:Math.max(0,Math.floor((50-note.y)/10))},(_,i)=>h('path',{d:`M${note.x-8} ${40-i*10}h18`,class:'otto-staff-line'})),h('ellipse',{cx:note.x,cy:note.y,rx:6,ry:4,transform:`rotate(-20 ${note.x} ${note.y})`}),note.duration<3?h('path',{d:`M${note.x+5} ${note.y}V${beamed?beamY:note.y-28}`,class:'otto-staff-line'}):null,note.accidental?h('text',{x:note.x-16,y:note.y+4,'font-size':13},note.accidental):null,!beamed&&note.flags?h('path',{d:`M${note.x+5} ${note.y-28}q12 5 3 14${note.flags===2?'m-3 -8q12 5 3 14':''}`,class:'otto-staff-line'}):null])),
       ...(beamed?[h('path',{d:`M${group[0].x+5} ${beamY}H${group[group.length-1].x+5}`,stroke:'currentColor','stroke-width':4}),...group.map((note,i)=>note.flags===2?h('path',{d:`M${note.x+5} ${beamY+6}h${i<group.length-1&&group[i+1].flags===2?group[i+1].x-note.x:i>0&&group[i-1].flags===2?0:8}`,stroke:'currentColor','stroke-width':3}):null)]:[])]})
    ]),h('small',`${phrase.bpm} BPM · ${phrase.beats}/4 · 簡易譜（音価は目安）。MIDIには元のタイミングを保存`) ])})():h('p','Ottoが弾くと、ここにフレーズが残ります'),h('span',{role:'status'},phraseNotice.value)]
  }}).mount(phraseHost)
  /** @param {import('./otto-phrases.js').PhraseNote} note @param {number} start
   * @param {()=>Omit<PhraseCapture,'id'|'notes'>} describe */
  function captureNote(note, start, describe) {
    if (note.midi === undefined) return
    if (captureStart !== start) {
      captureStart = start
      const count = phraseHistory.value.length
      phraseHistory.value.push({id:Date.now(), ...describe(), notes:[]})
      if(phraseHistory.value.length>16)phraseHistory.value.shift()
      if(!count || phraseIndex.value===count-1)phraseIndex.value=phraseHistory.value.length-1
    }
    phraseHistory.value.at(-1)?.notes.push({midi:note.midi,at:note.at,duration:note.duration,level:note.level??.8})
  }
  return {captureNote}
}

/** @param {HTMLElement} panel
 * @param {{view:ReturnType<typeof mountBuddyView>, player:Instrument, partner:Instrument,
 * lab:{value:import('./otto-phrases.js').OttoLabSettings},
 * labMode:{value:boolean},
 * sessionMode:{value:boolean},
 * setPlayMode:(value:string)=>void,onPlayStyleChange?:(style:string)=>void}} options */
export function mountBuddyLab(panel, {view,player,partner,lab,labMode,sessionMode,setPlayMode,onPlayStyleChange}) {
  const labHost=document.createElement('div');labHost.className='otto-lab-host';panel.querySelector('.melody-heading')?.after(labHost)
  const groups=[
    {name:'音階',toggles:[['repeat','音形を繰り返す'],['resolve','終わりを着地させる']],knobs:[['tension','テンション',0,100],['avoid','半音のぶつかり',0,100],['leaps','跳躍',0,100],['register','音域の中心',48,84],['maxLeap','最大跳躍（半音）',1,24],['highest','最高音',48,84]]},
    {name:'リズム',toggles:[['pickup','助走を入れる']],knobs:[['density','音の密度',0,100],['syncopation','食い気味にずらす',0,100],['gate','音の長さ',10,100],['ornamentLength','飾りの音の長さ',10,100]]},
    {name:'聴きやすさ',toggles:[],knobs:[['rests','休符',0,100],['contrast','緩急',0,100]]},
  ]
  /** @type {Record<string, string>} */
  const playStyleLooks = {imitate:'headphones bow', gentle:'bow', classical:'beret', shred:'spikes', scale:'fringe', jazz:'beret glasses', craft:'headphones'}
  const setPlayStyleLook=(/** @type {string} */ style)=>{view.look=playStyleLooks[style] ?? ''}
  setPlayStyleLook(defaultOttoLab.playStyle)
  const update=(/** @type {string} */ id,/** @type {number|boolean|string} */ value)=>{if(id==='playStyle'){onPlayStyleChange?.(String(value));setPlayStyleLook(String(value))}Reflect.set(lab.value,id,value)}
  const playStyles=[['craft','職人ソロプレイヤー'],['imitate','丁寧に真似する'],['gentle','やさしい'],['classical','クラシック上がり'],['shred','高速ピロピロマン'],['scale','スケール大好き'],['jazz','ジャズ好き']]
  const toneRevision = ref(0)
  document.addEventListener('melody-timbre-change', () => { toneRevision.value++ })
  /** @param {(voice:Instrument)=>void} apply */
  const eachVoice = apply => { apply(player); apply(partner); toneRevision.value++ }
  /** @param {string} label @param {number} value @param {number} min @param {number} max @param {number} step @param {string} unit @param {(value:number)=>void} change @param {boolean} [knob] */
  function toneControl(label,value,min,max,step,unit,change,knob=false) {
    const input = h('input',{type:'range',min,max,step,value,'aria-label':label,
      onInput:(/** @type {Event} */ event)=>change((/** @type {HTMLInputElement} */ (event.target)).valueAsNumber)})
    return h('label',{class:knob?'otto-lab-knob':'tone-envelope-control'},[
      h('span',label),
      knob ? h('span',{class:'volume-knob',style:`--angle:${-135+270*(value-min)/(max-min)}deg`},[input,h('span',{'aria-hidden':'true'})]) : input,
      h('output',`${Number(value.toFixed(3))}${unit}`),
    ])
  }
  /** @param {string} title @param {'amp'|'filter'} kind */
  function envelopeControls(title,kind) {
    const settings = player.toneSettings[kind]
    const preset = getTimbre(player.timbre)
    const stages = /** @type {const} */ (['attack','decay','sustain','release'])
    return h('fieldset',[h('legend',title),
      ...(kind==='filter'?[toneControl('深さ',player.toneSettings.filter.amount,0,3,.1,' oct',value=>eachVoice(voice=>{voice.toneSettings.filter.amount=value}))]:[]),
      ...stages.map(stage=>toneControl(
        `${kind==='amp'?'音量':'フィルター'} ${stage[0].toUpperCase()+stage.slice(1)}`,
        settings[stage] ?? preset[stage],stage==='sustain'?0:.001,stage==='sustain'?1:2,.001,stage==='sustain'?'':' 秒',
        value=>eachVoice(voice=>{voice.toneSettings[kind][stage]=value}),
      )),
    ])
  }
  const settingsOpen = ref('')
  const detailToggle = (/** @type {string} */ kind, /** @type {string} */ label) => h('button', {
    type:'button', class:'melody-deep-toggle', 'data-melody-detail':kind,
    'aria-label':label+'にこだわる', 'aria-controls':'otto-'+kind+'-settings',
    'aria-expanded':String(settingsOpen.value===kind),
    onClick:()=>{settingsOpen.value=settingsOpen.value===kind?'':kind},
  }, 'こだわる')
  createApp({render:()=>{view.status;toneRevision.value;return [
    h('div',{class:'part-choice-field otto-mode-field'},[
      h('span',{'aria-hidden':'true'},'弾く人'),
      h('fieldset',{class:'segmented-control otto-play-mode','aria-label':'弾く人'},[h('legend',{class:'sr-only'},'弾く人'),...[['manual','あなた'],['auto','Otto'],['session','セッション']].map(([value,label])=>h('label',[h('input',{type:'radio',name:'otto-lab-mode',value,checked:value==='session'?sessionMode.value:value==='auto'?labMode.value:!labMode.value&&!sessionMode.value,onChange:()=>setPlayMode(value==='session'?'session':value==='auto'?'all-pc':'all-you')}),h('span',label)]))]),
    ]),
    h('div',{class:'otto-style-choice part-choice-field'},[h('span','Ottoのプレイスタイル'),h('div',{class:'part-choice-picker'},[
      h('select',{'aria-label':'Ottoのプレイスタイル',value:lab.value.playStyle??'craft',onChange:(/** @type {Event} */ e)=>update('playStyle',(/** @type {HTMLSelectElement} */(e.target)).value)},...playStyles.map(([value,label])=>h('option',{value},label))),
      h('div',{class:'style-stepper part-choice-steps',role:'group','aria-label':'Ottoのプレイスタイルを切り替え'},[-1,1].map(direction=>h('button',{type:'button','aria-label':direction<0?'前のプレイスタイル':'次のプレイスタイル',disabled:playStyles.findIndex(([id])=>id===lab.value.playStyle)+direction<0||playStyles.findIndex(([id])=>id===lab.value.playStyle)+direction>=playStyles.length,onClick:()=>{const index=playStyles.findIndex(([id])=>id===lab.value.playStyle)+direction;if(playStyles[index])update('playStyle',playStyles[index][0])}},direction<0?'←':'→')))
    ])]),
    detailToggle('tone', '音色'),
    detailToggle('advanced', 'プレイスタイル'),
    h('section',{id:'otto-tone-settings',hidden:settingsOpen.value!=='tone'},[
      h('h3','音色の調整'),
      h('div',{class:'tone-editor'},[
        h('fieldset',[h('legend','フィルター'),
          toneControl('Cutoff', player.toneSettings.cutoff ?? getTimbre(player.timbre).cutoff, 100, 18000, 1, ' Hz', value=>eachVoice(voice=>voice.setFilterControl('cutoff',value)), true),
          toneControl('Resonance', player.toneSettings.resonance ?? 1, .1, 12, .1, '', value=>eachVoice(voice=>voice.setFilterControl('resonance',value)), true),
        ]),
        envelopeControls('音量 ADSR', 'amp'),
        envelopeControls('フィルターエンベロープ', 'filter'),
      ]),
    ]),
    h('div',{id:'otto-advanced-settings',hidden:settingsOpen.value!=='advanced'},[h('div',{class:'otto-lab'},[
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
    ])]),
  ]}}).mount(labHost)
  }
