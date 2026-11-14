import { createApp, h } from './vendor/vue.runtime.esm-browser.prod.js'

/** Three octaves, with the closing C. */
export const pianoNotes = Object.freeze(Array.from({length:37},(_,i)=>48+i))
/** @param {number} midi */
export function pianoKey(midi) {
  if (!pianoNotes.includes(midi)) throw new RangeError('Outside keyboard range')
  return midiKey(midi)
}

/** @param {number} midi */
export function midiKey(midi) {
  const pitch=midi%12
  return {midi,black:[1,3,6,8,10].includes(pitch),label:['C','C♯','D','E♭','E','F','F♯','G','A♭','A','B♭','B'][pitch]+(Math.floor(midi/12)-1)}
}
/** @param {number} midi */
export const pianoWhiteLabel = midi => ['ド','','レ','','ミ','ファ','','ソ','','ラ','','シ'][midi % 12]

/** @param {PointerEvent} event @param {Element} board */
export function pianoKeyAtPointer(event, board) {
  const key = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-midi]')
  return key instanceof HTMLElement && board.contains(key) ? Number(key.dataset.midi) : undefined
}

/** @param {PointerEvent} event @param {HTMLElement} captureTarget */
export function capturePianoPointer(event, captureTarget) {
  if (event.button !== 0) return false
  event.preventDefault()
  captureTarget.setPointerCapture(event.pointerId)
  return true
}

/** @param {{ready:()=>Promise<void>,attack:(midi:number,glide:boolean)=>void,release:(midi:number)=>void,stop:()=>void,key?:()=>number,bass?:()=>boolean,bpm?:()=>number,resolve?:(midi:number)=>number,onError:(error:unknown)=>void}} source */
export function mountKeyboard(source) {
  const original=source
  const sounding=new Map()
  let octave = 0
  const board=/** @type {HTMLElement} */ (document.querySelector('#piano-keys'))
  source={...original,attack:(midi,glide)=>{const pitch=midi+12*octave+(board.dataset.magic==='true'?(original.key?.()??0):0);sounding.set(midi,pitch);original.attack(pitch,glide)},release:midi=>{original.release(sounding.get(midi)??midi);sounding.delete(midi)}}
  const scroll=/** @type {HTMLElement} */ (document.querySelector('#piano-scroll'))
  const pads=/** @type {HTMLElement} */ (document.querySelector('#pads'))
  /** @type {Map<number,HTMLButtonElement>} */
  const buttons=new Map()
  let white = 0
  const keys = pianoNotes.slice(0, 25).map(midi => {
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
    }, key.black ? [] : [h('span', {'aria-hidden':'true'}, pianoWhiteLabel(key.midi))])),
  }).mount(board)
  for (const button of Array.from(board.querySelectorAll('button'))) {
    buttons.set(Number(button.dataset.midi), button)
  }
  board.style.width = 'calc(var(--piano-white-count, 15) * var(--piano-width))'
  const portrait = typeof matchMedia === 'function' ? matchMedia('(max-width:600px) and (orientation:portrait)') : null
  const lastMidi = () => portrait?.matches ? 60 : 72
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
    if (!capturePianoPointer(event, board)) return
    const current={pointer:event.pointerId,midi:Number(/** @type {HTMLElement} */(button).dataset.midi),ready:false,token:++token}
    gesture=current;move(current.midi,false)
    try {await source.ready();if(gesture!==current || current.token!==token)return;current.ready=true;source.attack(current.midi,false)}
    catch(error){release();source.onError(error)}
  })
  board.addEventListener('pointermove',event=>{
    if(!gesture || gesture.pointer!==event.pointerId)return
    const midi=pianoKeyAtPointer(event,board)
    if(midi!==undefined) move(midi,true)
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
      const next=event.key==='Home'?48:event.key==='End'?lastMidi():Math.max(48,Math.min(lastMidi(),midi+(event.key==='ArrowRight'?1:-1)))
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
  function refreshLabels() {
    const offset = octave - (original.bass?.() ? 2 : 0)
    board.setAttribute('aria-label', `C${3 + offset}からC${Math.floor(lastMidi() / 12) - 1 + offset}の鍵盤`)
    buttons.forEach((button,midi)=>{
      const label = pianoKey(midi).label.replace(/\d+$/, String(Math.floor(midi / 12) - 1 + offset))
      button.setAttribute('aria-label', label+'を鳴らす')
    })
  }
  const octaveOutput = document.querySelector('#keyboard-octave')
  const octaveDown = document.querySelector('#octave-down')
  const octaveUp = document.querySelector('#octave-up')
  /** @param {number} direction */
  function stepOctave(direction) {
    const next = octave + direction
    if (next < -2 || next > 2) return
    release()
    for (const midi of sounding.keys()) source.release(midi)
    octave = next
    if (octaveOutput) octaveOutput.textContent = octave > 0 ? `+${octave}` : String(octave)
    octaveDown?.toggleAttribute('disabled', octave === -2)
    octaveUp?.toggleAttribute('disabled', octave === 2)
    refreshLabels()
  }
  octaveDown?.addEventListener('click', () => stepOctave(-1))
  octaveUp?.addEventListener('click', () => stepOctave(1))
  refreshLabels()
  portrait?.addEventListener('change', () => {
    release()
    for (const midi of sounding.keys()) source.release(midi)
    const active = board.querySelector('button[tabindex="0"]')
    if (active instanceof HTMLElement && Number(active.dataset.midi) > lastMidi()) {
      if (board.contains(document.activeElement)) focusKey(lastMidi())
      else {
        active.tabIndex = -1
        const lastKey = buttons.get(lastMidi())
        if (lastKey) lastKey.tabIndex = 0
      }
    }
    refreshLabels()
  })
  document.addEventListener('melody-timbre-change', refreshLabels)
  const magicToggle = document.querySelector('#magic-toggle')
  magicToggle?.addEventListener('click', () => {
    release()
    const enabled = board.dataset.magic !== 'true'
    board.dataset.magic = String(enabled)
    magicToggle.setAttribute('aria-checked', String(enabled))
    refreshLabels()
    document.dispatchEvent(new Event('melody-keyboard-change'))
    pads.hidden = true
    scroll.hidden = false
  })
  window.addEventListener('blur',release)
  document.addEventListener('visibilitychange',()=>{if(document.hidden)release()})
  return {release}
}

/** MIDI input is explicitly enabled by a user gesture; SysEx is never requested.
 * @param {{ready:()=>Promise<void>,attack:(note:number,receivedAt?:number)=>void,release:(note:number,receivedAt?:number)=>void,bend?:(value:number)=>void,modulation?:(value:number)=>void,transpose?:()=>number}} source */
export function mountMidiInput(source) {
 const button=document.createElement('button')
 button.type='button';button.className='reference-remove-key melody-midi-button';button.textContent='MIDIを接続'
 document.querySelector('.settings-options')?.prepend(button)
 /** @type {MIDIAccess|undefined} */ let access
 /** @type {Map<string,Map<number,number>>} */ const held=new Map()
 /** @param {string} id */
 const releasePort=id=>{for(const note of held.get(id)?.values()??[])source.release(note);held.delete(id)}
 const silence=()=>{for(const id of held.keys())releasePort(id)}
 const refresh=()=>{
  if(!access)return
  let count=0
  access.inputs.forEach(input=>{
   if(input.state==='disconnected'){releasePort(input.id);return}
   count++
   input.onmidimessage=(/** @type {MIDIMessageEvent} */ event)=>{
    const [status,note,velocity]=event.data??[]
    const kind=status&0xf0
    let notes=held.get(input.id)
    if(!notes){notes=new Map();held.set(input.id,notes)}
    if(kind===0x90&&velocity>0){const previous=notes.get(note);if(previous!==undefined)source.release(previous,event.timeStamp);const pitch=Math.max(0,Math.min(127,note+(source.transpose?.()??0)));notes.set(note,pitch);source.attack(pitch,event.timeStamp)}
    else if(kind===0x80||(kind===0x90&&velocity===0)){const pitch=notes.get(note);notes.delete(note);if(pitch!==undefined)source.release(pitch,event.timeStamp)}
    else if(kind===0xe0)source.bend?.((((velocity<<7)|note)-8192)/8192)
    else if(kind===0xb0&&note===1)source.modulation?.(velocity/127)
    else if(kind===0xb0&&(note===120||note===123))releasePort(input.id)
   }
  })
  button.textContent=count?`MIDI 接続中（${count}）`:'MIDI 接続待ち'
 }
 button.disabled=!navigator.requestMIDIAccess
 if(button.disabled)button.title='このブラウザはMIDI入力に対応していません'
 const connect=async(userGesture=true)=>{
  try{
   if(userGesture)await source.ready()
   access??=await navigator.requestMIDIAccess({sysex:false})
   access.onstatechange=refresh;refresh()
   localStorage.setItem('oto-midi-enabled','1')
  }catch(error){button.textContent='MIDIを再接続';button.title=error instanceof Error?error.message:'MIDIに接続できませんでした'}
 }
 button.addEventListener('click',()=>void connect())
 if(!button.disabled&&localStorage.getItem('oto-midi-enabled')==='1'){
  void navigator.permissions.query({name:/** @type {PermissionName} */('midi')}).then(permission=>{if(permission.state==='granted')void connect(false)}).catch(()=>{})
 }
 window.addEventListener('blur',silence)
 window.addEventListener('pagehide',silence)
 document.addEventListener('visibilitychange',()=>{if(document.hidden)silence()})
 return {connect:async()=>{if(button.disabled)return 'MIDI非対応';await connect();return button.textContent ?? 'MIDI接続'}}
}

/** Shared note lifecycle for screen and MIDI keyboards.
 * @param {{enabled:()=>boolean,bpm:()=>number,resolve:(note:number)=>number,attack:(note:number,glide:boolean,screen:boolean)=>void,release:(note:number)=>void}} source */
export function createMagicVoice(source) {
 /** @type {Map<number,{pitch:number,timer:ReturnType<typeof setTimeout>|undefined}>} */
 const held=new Map()
 let generation=0
 return {
  attack(/** @type {number} */ note,glide=false,screen=false){
   const previous=held.get(note);if(previous){clearTimeout(previous.timer);source.release(previous.pitch)}
   const ticket=++generation
   const state={pitch:note,timer:/** @type {ReturnType<typeof setTimeout>|undefined} */(undefined)}
   held.set(note,state);source.attack(note,glide,screen)
   const target=source.enabled()?source.resolve(note):note
   if(target!==note)state.timer=setTimeout(()=>{
    state.timer=undefined
    if(ticket!==generation||held.get(note)!==state||!source.enabled())return
    source.attack(target,false,screen);source.release(state.pitch);state.pitch=target
   },60000/Math.max(40,source.bpm())/8)
  },
  release(/** @type {number} */ note){const state=held.get(note);if(!state)return;clearTimeout(state.timer);held.delete(note);source.release(state.pitch)},
  get heldCount(){return held.size},
  stop(){generation++;for(const state of held.values()){clearTimeout(state.timer);source.release(state.pitch)}held.clear()}
 }
}
