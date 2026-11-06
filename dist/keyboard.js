import { createApp, h } from './vendor/vue.runtime.esm-browser.prod.js'

/** Three octaves, with the closing C. */
export const pianoNotes = Object.freeze(Array.from({length:37},(_,i)=>48+i))
/** @param {number} midi */
export function pianoKey(midi) {
  if (!pianoNotes.includes(midi)) throw new RangeError('Outside keyboard range')
  const pitch=midi%12
  return {midi,black:[1,3,6,8,10].includes(pitch),label:['C','C♯','D','E♭','E','F','F♯','G','A♭','A','B♭','B'][pitch]+(Math.floor(midi/12)-1)}
}
/** @param {{ready:()=>Promise<void>,attack:(midi:number,glide:boolean)=>void,release:(midi:number)=>void,stop:()=>void,onError:(error:unknown)=>void}} source */
export function mountKeyboard(source) {
  const board=/** @type {HTMLElement} */ (document.querySelector('#piano-keys'))
  const scroll=/** @type {HTMLElement} */ (document.querySelector('#piano-scroll'))
  const pads=/** @type {HTMLElement} */ (document.querySelector('#pads'))
  /** @type {Map<number,HTMLButtonElement>} */
  const buttons=new Map()
  let white = 0
  const keys = pianoNotes.map(midi => {
    const key = pianoKey(midi)
    const left = key.black
      ? `calc(${white} * var(--piano-width) - var(--piano-black-width) / 2)`
      : `calc(${white++} * var(--piano-width))`
    return { ...key, left }
  })
  createApp({
    render: () => keys.map(key => h('button', {
      type: 'button', class: key.black ? 'piano-key piano-black' : 'piano-key piano-white',
      'data-midi': key.midi, 'aria-label': key.label + 'を鳴らす',
      tabindex: key.midi === 60 ? 0 : -1, style: { left: key.left },
    }, [h('span', key.label)])),
  }).mount(board)
  for (const button of Array.from(board.querySelectorAll('button'))) {
    buttons.set(Number(button.dataset.midi), button)
  }
  board.style.width = `calc(${white} * var(--piano-width))`
  /** @type {{pointer:number,midi:number,ready:boolean,token:number}|undefined} */
  let gesture
  let token=0
  /** @type {number | undefined} */
  let keyboardMidi
  /** @param {number} midi */
  function focusKey(midi) {buttons.forEach((button,n)=>button.tabIndex=n===midi?0:-1);buttons.get(midi)?.focus()}
  /** @param {number} midi @param {boolean} glide */
  function move(midi,glide) {
    if (!gesture || midi===gesture.midi && glide) return
    const previous=gesture.midi
    gesture.midi=midi
    if (gesture.ready) {
      source.attack(midi,glide)
      if(glide) source.release(previous)
    }
    buttons.forEach((button,n)=>button.toggleAttribute('data-held',n===midi))
  }
  function release() {
    token++
    if(gesture?.ready) source.release(gesture.midi)
    gesture=undefined
    if(keyboardMidi!==undefined) source.release(keyboardMidi)
    keyboardMidi=undefined
    buttons.forEach(button=>button.removeAttribute('data-held'))
  }
  board.addEventListener('pointerdown',async event=>{
    if(event.button!==0 || gesture) return
    const button=event.target instanceof Element?event.target.closest('[data-midi]'):null
    if(!button) return
    event.preventDefault();board.setPointerCapture(event.pointerId)
    const current={pointer:event.pointerId,midi:Number(/** @type {HTMLElement} */(button).dataset.midi),ready:false,token:++token}
    gesture=current;move(current.midi,false)
    try {await source.ready();if(gesture!==current || current.token!==token)return;current.ready=true;source.attack(current.midi,false)}
    catch(error){release();source.onError(error)}
  })
  board.addEventListener('pointermove',event=>{
    if(!gesture || gesture.pointer!==event.pointerId)return
    const hit=document.elementFromPoint(event.clientX,event.clientY)?.closest('#piano-keys [data-midi]')
    if(hit) move(Number(/** @type {HTMLElement} */(hit).dataset.midi),true)
  })
  for(const type of ['pointerup','pointercancel','lostpointercapture'])board.addEventListener(type,event=>{
    if(event instanceof PointerEvent && gesture && event.pointerId!==gesture.pointer)return
    release()
  })
  board.addEventListener('keydown',async event=>{
    const button=event.target instanceof HTMLElement?event.target.closest('[data-midi]'):null
    if(!button || event.ctrlKey || event.metaKey || event.altKey)return
    const midi=Number(/** @type {HTMLElement} */(button).dataset.midi)
    if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){
      event.preventDefault()
      const next=event.key==='Home'?48:event.key==='End'?84:Math.max(48,Math.min(84,midi+(event.key==='ArrowRight'?1:-1)))
      if(keyboardMidi!==undefined){source.attack(next,true);source.release(keyboardMidi);keyboardMidi=next;buttons.forEach((key,n)=>key.toggleAttribute('data-held',n===next))}
      focusKey(next);return
    }
    if(![' ','Enter'].includes(event.key)||event.repeat)return
    event.preventDefault();const ticket=++token
    keyboardMidi=midi
    try {await source.ready();if(token===ticket && keyboardMidi===midi){source.attack(midi,false);buttons.get(midi)?.setAttribute('data-held','')}}catch(error){release();source.onError(error)}
  })
  board.addEventListener('keyup',event=>{if([' ','Enter'].includes(event.key)){event.preventDefault();release()}})
  board.addEventListener('click',event=>{
    if(event.detail!==0 || keyboardMidi!==undefined)return
    const button=event.target instanceof HTMLElement?event.target.closest('[data-midi]'):null
    if(!button)return
    const midi=Number(/** @type {HTMLElement} */(button).dataset.midi)
    const ticket=++token
    void source.ready().then(()=>{if(ticket!==token)return;source.attack(midi,false);setTimeout(()=>{if(ticket===token)source.release(midi)},250)}).catch(source.onError)
  })
  board.addEventListener('focusout',event=>{if(!board.contains(/** @type {Node|null} */(event.relatedTarget)))release()})
  for(const button of Array.from(document.querySelectorAll('[data-melody-view]')))button.addEventListener('click',()=>{
    release()
    const piano=/** @type {HTMLElement} */(button).dataset.melodyView==='piano'
    pads.hidden=piano;scroll.hidden=!piano
    document.querySelectorAll('[data-melody-view]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)))
  })
  window.addEventListener('blur',release)
  document.addEventListener('visibilitychange',()=>{if(document.hidden)release()})
  return {release}
}
