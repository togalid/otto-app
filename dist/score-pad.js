/** Pad dock bridges the standalone audition surface and the score editor.
 * @param {{key:(bar:number)=>number, notation:()=>string, section:()=>number, bars:()=>number, beats:()=>number,
 * play:(bar:number)=>void, read:(bar:number,beat:number)=>string|null, write:(bar:number,beat:number,id:string|null)=>void}} actions */
export function mountScorePad(actions) {
 const dock=document.createElement('section')
 dock.className='score-pad-dock';dock.hidden=true;dock.setAttribute('aria-label','コードPad入力')
 dock.innerHTML='<div class="score-pad-tools"><div class="style-stepper pad-navigation" role="group" aria-label="入力位置を移動"><button type="button" class="prev" aria-label="前の入力位置">←</button><button type="button" class="next" aria-label="次の入力位置">→</button></div><label class="oto-checkbox"><input type="checkbox"> <span>順に入力</span></label><fieldset class="segmented-control pad-interval" aria-label="Pad入力の間隔"><label><input type="radio" name="pad-interval" value="bar" checked><span>1小節</span></label><label><input type="radio" name="pad-interval" value="2"><span>2拍</span></label><label><input type="radio" name="pad-interval" value="1"><span>1拍</span></label></fieldset><button type="button" class="close">閉じる</button></div><span class="score-pad-announcement" role="status" aria-live="polite"></span><iframe title="コード入力Pad" src="/chord-pad.html?embedded=1"></iframe>' 
 document.body.append(dock)
 const position=/** @type {HTMLElement} */(dock.querySelector('.score-pad-announcement'))
 const frame=/** @type {HTMLIFrameElement} */(dock.querySelector('iframe'))
 const advance=/** @type {HTMLInputElement} */(dock.querySelector('input'))
 const interval=()=>/** @type {HTMLInputElement} */(dock.querySelector('input[name=pad-interval]:checked')).value
 const intervalGroup=/** @type {HTMLFieldSetElement} */(dock.querySelector('.pad-interval'))
 const prev=/** @type {HTMLButtonElement} */(dock.querySelector('.prev'))
 const next=/** @type {HTMLButtonElement} */(dock.querySelector('.next'))
 let bar=0,beat=0,section=0
 /** @type {HTMLElement|null} */ let opener=null
 function updateInterval(){intervalGroup.disabled=!advance.checked}
 advance.addEventListener('change',updateInterval)
 updateInterval()
 function sync(){
  document.querySelectorAll('.pad-input-target').forEach(el=>el.classList.remove('pad-input-target'))
  const cell=document.querySelectorAll('.chord-slot')[bar]?.querySelectorAll('.beat-chord')[beat]
  if(!dock.hidden)cell?.classList.add('pad-input-target')
  position.textContent=`${bar+1}小節・${beat+1}拍目`
  prev.disabled=bar===0&&beat===0
  next.disabled=bar*actions.beats()+beat>=actions.bars()*actions.beats()-1
  frame.contentWindow?.postMessage({type:'oto-pad-key',key:actions.key(bar),notation:actions.notation(),skin:document.documentElement.dataset.skin ?? 'milk'},location.origin)
 }
 function close(){dock.hidden=true;document.body.classList.remove('score-pad-open');sync();opener?.focus({preventScroll:true})}
 dock.querySelector('.close')?.addEventListener('click',close)
 dock.addEventListener('keydown',event=>{if(event.key==='Escape')close()})
 frame.addEventListener('load',sync)
 new MutationObserver(sync).observe(document.documentElement,{attributes:true,attributeFilter:['data-skin']})
 document.querySelector('#notation')?.addEventListener('change',sync)
 /** @param {number} direction */
 function move(direction){
  if(section!==actions.section()){close();return}
  const step=advance.checked?(interval()==='bar'?actions.beats():Number(interval())):1
  const position=Math.max(0,Math.min(actions.bars()*actions.beats()-1,bar*actions.beats()+beat+direction*step))
  bar=Math.floor(position/actions.beats());beat=position%actions.beats();sync()
  document.querySelector('.pad-input-target')?.scrollIntoView({block:'nearest',behavior:'smooth'})
 }
 prev.addEventListener('click',()=>move(-1));next.addEventListener('click',()=>move(1))
 window.addEventListener('message',event=>{
  if(event.origin!==location.origin||event.source!==frame.contentWindow||dock.hidden)return
  if(event.data?.type==='oto-pad-close'){close();return}
  if(event.data?.type==='oto-pad-play'){if(section===actions.section()&&bar<actions.bars())actions.play(bar);return}
  if(event.data?.type!=='oto-pad-chord'||typeof event.data.id!=='string')return
  if(section!==actions.section()||bar>=actions.bars()){close();return}
  const id=event.data.id
  actions.write(bar,beat,id)
  if(advance.checked){
   const step=interval()==='bar'?actions.beats():Number(interval())
   const next=bar*actions.beats()+beat+step
   if(next<actions.bars()*actions.beats()){bar=Math.floor(next/actions.beats());beat=next%actions.beats()}
  }
  sync()
  document.querySelector('.pad-input-target')?.scrollIntoView({block:'nearest',behavior:'smooth'})
 })
 document.querySelector('#chord-slots')?.addEventListener('click',event=>{
  const target=event.target instanceof Element?event.target.closest('.score-chord-edit'):null
  if(!target)return
  event.preventDefault();event.stopPropagation()
  const slot=target.closest('.chord-slot'),cell=target.closest('.beat-chord')
  if(!slot||!cell)return
  bar=Array.from(document.querySelectorAll('.chord-slot')).indexOf(slot)
  beat=Array.from(slot.querySelectorAll('.beat-chord')).indexOf(cell)
  section=actions.section();opener=/** @type {HTMLElement} */(target)
  dock.hidden=false;document.body.classList.add('score-pad-open');sync()
  cell.scrollIntoView({block:'center',behavior:'smooth'})
 },true)
}
