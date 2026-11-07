import {padChordNotes, customChord, qualityGroups} from './music.js'
import {createChoiceMenu} from './choice-menu.js'
const degrees=['I','II','III','IV','V','VI','VII','♭II','♭III','♭V','♭VI','♭VII']
const numericDegrees=['1','2','3','4','5','6','7','♭2','♭3','♭5','♭6','♭7']
let notation='roman'
const degreeRoots=[0,1,2,3,4,5,6,1,2,4,5,6]
const layout=[7,8,9,10,3,4,5,11,0,1,2,6]
const names=['C','D♭','D','E♭','E','F','F♯','G','A♭','A','B♭','B']
const key=/** @type {HTMLSelectElement} */(document.querySelector('#pad-key'))
names.forEach((name,i)=>key.add(new Option(name,String(i))))
const status=/** @type {HTMLElement} */(document.querySelector('#result-voicing'))
const resultChord=/** @type {HTMLElement} */(document.querySelector('#result-chord'))
let context=/** @type {AudioContext | undefined} */(undefined)
let active=/** @type {{index:number,zone:string,button:HTMLButtonElement,pointer?:number}|null} */(null)
/** @type {Map<string,{quality:string,extension:string,label:string}>} */
const assignments=new Map(Object.entries({
 '1:bl':{quality:'sus4',extension:'7',label:'7sus4'}, '1:br':{quality:'min',extension:'9',label:'m9'},
 '2:bl':{quality:'sus4',extension:'7',label:'7sus4'}, '2:br':{quality:'maj',extension:'s9_b13',label:'7(♯9,♭13)'},
 '3:center':{quality:'maj',extension:'maj9',label:'△9'},
 '3:bl':{quality:'slash',extension:'v_over_iv',label:'V/VI'},
 '4:bl':{quality:'sus4',extension:'7',label:'7sus4'}, '4:tr':{quality:'maj',extension:'b13',label:'7(♭13)'},
 '5:bl':{quality:'sus4',extension:'7',label:'7sus4'}, '5:br':{quality:'min',extension:'9',label:'m9'},
 '6:bl':{quality:'slash',extension:'v_over_7',label:'V/7'},
 ...Object.fromEntries([7,8,9,10,11].map(index=>[index+':center',{quality:'maj',extension:'maj7',label:'△7'}])),
}))
const embedded=new URLSearchParams(location.search).has('embedded')&&window.parent!==window
if(embedded){
 document.documentElement.classList.add('embedded-pad-root')
 document.body.classList.add('embedded-pad')
 window.addEventListener('message',event=>{
  if(event.origin===location.origin&&event.source===parent&&event.data?.type==='oto-pad-key'&&Number.isInteger(event.data.key)&&event.data.key>=0&&event.data.key<12){
   key.value=String(event.data.key)
   if(['milk','toy','soda'].includes(event.data.skin))document.documentElement.dataset.skin=event.data.skin
   const nextNotation=event.data.notation==='number'?'number':'roman'
   if(notation!==nextNotation){notation=nextNotation;refreshPadLabels()}
  }
 })
 document.addEventListener('keydown',event=>{
  if(event.key==='Escape')parent.postMessage({type:'oto-pad-close'},location.origin)
  if(event.code==='Space'&&!event.repeat&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!(event.target instanceof Element&&event.target.closest('dialog[open]'))){
   event.preventDefault();parent.postMessage({type:'oto-pad-play'},location.origin)
  }
 })
}
const menu=createChoiceMenu('quality')
/** @param {number} index @param {string} zone @param {HTMLButtonElement} button */
function openChoices(index,zone,button){
 if(menu.busy)return
 const source=document.createElement('select')
 source.className='pad-menu-source'
 source.setAttribute('aria-label',degrees[index]+' のコード種類')
 document.body.append(source)
 const config=assignments.get(index+':'+zone)
 const centerConfig=zone==='center' ? (index===6?'dim:7':[1,2,5].includes(index)?'min:7':index===4?'maj:7':'maj:maj7') : ''
 const current=config ? config.quality+':'+config.extension : (new Map([['tl','dim:dim7'],['tr','maj:7'],['bl','sus2:none'],['br','min:7']])).get(zone) ?? centerConfig
 const groups=qualityGroups(chord(index,'center').id,chord(index,zone).id).map(group=>({heading:group.label,choices:group.options.map(option=>{
  source.add(new Option(option.label,option.value))
  return {label:option.label,value:option.value,selected:option.value===current}
 })}))
 source.value=current
 source.addEventListener('change',()=>{
  const [quality,extension]=source.value.split(':');const label=source.selectedOptions[0]?.textContent
  if(quality && extension && label){assignments.set(index+':'+zone,{quality,extension,label});renderPadLabel(index,zone,button)}
 })
 source.addEventListener('focus',()=>{source.remove();button.focus({preventScroll:true})})
 const rect=button.getBoundingClientRect(), width=Math.min(240,window.innerWidth-16)
 const left=Math.max(8,Math.min(rect.left,window.innerWidth-width-8))
 const top=Math.max(8,Math.min(rect.top-30,window.innerHeight-Math.min(150,window.innerHeight-16)-8))
 void menu.open(source,'コードの響きを選択',groups,{left,top,width,height:Math.min(260,window.innerHeight-top-8)})
}
/** @param {number} index @param {string} zone */
function chord(index,zone){
 const minor=[1,2,5].includes(index)
 const assigned=assignments.get(index+':'+zone)
 const quality=assigned?.quality ?? (zone==='tl'?'dim':zone==='br'?'min':zone==='bl'?'sus2':zone==='tr'?'maj':index===6?'dim':minor?'min':'maj')
 const extension=assigned?.extension ?? (zone==='tl'?'dim7':zone==='bl'?'none':zone==='tr'||zone==='br'?'7':index===0||index===3?'maj7':'7')
 return {id:customChord({root:degreeRoots[index],quality,extension,alter:index>=7?11:0}),label:assigned?.quality==='slash' ? assigned.label : degrees[index]+(assigned?.label ?? (zone==='tl'?'dim7':zone==='bl'?'sus2':zone==='tr'?'7':zone==='br'?'m7':index===6?'m7♭5':minor?'m7':index===4?'7':'△7'))}
}
/** @param {string} label */
function numberLabel(label){
 return label.replace(/VII|VI|IV|III|II|V|I/g,roman=>String({I:1,II:2,III:3,IV:4,V:5,VI:6,VII:7}[/** @type {'I'|'II'|'III'|'IV'|'V'|'VI'|'VII'} */(roman)]))
}
/** @param {number} index @param {string} zone @param {HTMLButtonElement} button */
function renderPadLabel(index,zone,button){
 const assignment=assignments.get(index+':'+zone)
 const raw=zone==='center'?chord(index,zone).label:(assignment?.label ?? ({tl:'dim7',tr:'7',bl:'sus2',br:'m7'}[/** @type {'tl'|'tr'|'bl'|'br'} */(zone)] ?? ''))
 const label=notation==='number'?numberLabel(raw):raw
 button.replaceChildren()
 if(zone==='center'&&assignment?.quality!=='slash'){
  const prefix=notation==='number'?numericDegrees[index]:degrees[index]
  const degree=document.createElement('span');degree.className='pad-degree';degree.textContent=prefix
  const quality=document.createElement('span');quality.className='pad-quality';quality.textContent=label.slice(prefix.length)
  button.append(degree,quality)
 }else button.textContent=label
 button.setAttribute('aria-label',zone==='center'?label:(notation==='number'?numericDegrees[index]:degrees[index])+' '+label)
}
function refreshPadLabels(){
 document.querySelectorAll('.chord-pad').forEach(pad=>{
  const index=Number(/** @type {HTMLElement} */(pad).dataset.degree)
  pad.querySelectorAll('button').forEach(button=>renderPadLabel(index,button.classList.contains('pad-center')?'center':['tl','tr','bl','br'].find(zone=>button.classList.contains(zone)) ?? '',button))
 })
}
/** @param {number} index @param {string} zone */
function sound(index,zone){try{context??=new AudioContext();void context.resume();const now=context.currentTime;for(const midi of padChordNotes(chord(index,zone).id,Number(key.value))){const osc=context.createOscillator();const gain=context.createGain();osc.type='triangle';osc.frequency.value=440*2**((midi-69)/12);gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(.07,now+.015);gain.gain.exponentialRampToValueAtTime(.001,now+.65);osc.connect(gain).connect(context.destination);osc.start(now);osc.stop(now+.7)}}catch{status.textContent='音声を開始できません。Padは記録できます。'}}
/** @param {string} zone */
function choose(zone){if(!active)return;active.zone=zone}
/** @param {boolean} commit */
function finish(commit){
 if(!active)return
 if(commit){
  const selected=chord(active.index,active.zone)
  const notes=padChordNotes(selected.id,Number(key.value))
  if(embedded)parent.postMessage({type:'oto-pad-chord',id:selected.id},location.origin)
  resultChord.textContent=selected.label
  status.textContent=notes.map(midi=>names[(midi%12+12)%12]+(Math.floor(midi/12)-1)).join('  ·  ')
  sound(active.index,active.zone)
 }
 active=null
}
layout.forEach(index=>{
 const degree=degrees[index]
 const pad=document.createElement('div'); pad.className='chord-pad'+(index>=7?' chromatic-pad':'')
 pad.dataset.degree=String(index)
 for(const [zone,label] of [['tl','dim7'],['tr','7'],['center',chord(index,'center').label],['bl','sus2'],['br','m7']]) {
  const button=document.createElement('button'); button.type='button'; button.className=zone==='center'?'pad-center':'corner '+zone
  renderPadLabel(index,zone,button)
  let timer=/** @type {ReturnType<typeof setTimeout>|undefined} */(undefined)
  let held=false
  {
   button.addEventListener('pointerdown',event=>{if(event.button!==0)return;held=false;timer=setTimeout(()=>{timer=undefined;held=true;openChoices(index,zone,button)},550)})
   const cancel=()=>{if(timer!==undefined){clearTimeout(timer);timer=undefined}}
   button.addEventListener('pointerup',cancel);button.addEventListener('pointercancel',cancel);button.addEventListener('pointerleave',cancel)
   button.addEventListener('contextmenu',event=>{event.preventDefault();cancel();if(!menu.busy){held=true;openChoices(index,zone,button)}})
   button.addEventListener('keydown',event=>{if(event.key==='F10'&&event.shiftKey){event.preventDefault();openChoices(index,zone,button)}})
  }
  button.addEventListener('click',()=>{if(held){held=false;return}active={index,zone,button};choose(zone);finish(true)})
  pad.append(button)
 }
 document.querySelector('#pads')?.append(pad)
})
document.addEventListener('keydown',event=>{
 if(event.repeat || event.target instanceof HTMLSelectElement || event.target instanceof HTMLButtonElement || !/^[1-7]$/.test(event.key))return
 const index=Number(event.key)-1
 const button=/** @type {HTMLButtonElement} */(document.querySelector('[data-degree="'+index+'"] .pad-center'))
 active={index,zone:'center',button};choose('center');finish(true)
})
