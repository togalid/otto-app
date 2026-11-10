import { bindSynthKnob } from './main-controls.js'
import { createApp, h, ref } from './vendor/vue.runtime.esm-browser.prod.js'
import { mountAccompanimentPlay, selectStepperView } from './part-steppers.js'
import { ottoAccompanimentStyles } from './progression.js'
import { lfoWaveforms, lfoWaveformNames, lfoWaveValue } from './groove.js'

export const bassPadNotes = [36, 38, 40, 41, 43, 45, 47, 48]

/** UI adapter for the shared mixer controls. Audio actions stay in the composition root.
 * @param {{
 * progression: import('./progression.js').Progression,
 * mixer: ReturnType<import('./groove.js').createPartMixer>, bass: import('./groove.js').BassSynth,
 * workspace: HTMLElement, genreSelect: HTMLSelectElement, keySelect: HTMLSelectElement,
 * playAccompanimentPad: (part:'drums'|'bass'|'chord', index:number)=>void,
 * previewChord: (bar:number, beat:number, chord:string, replace?:boolean)=>Promise<void>,
 * togglePlayback: ()=>void,
 * animatePartChange: (button:Element|null)=>void,
 * }} dependencies
 */
export function mountQuickMixer({
  progression,
  mixer,
  bass,
  workspace,
  genreSelect,
  keySelect,
  playAccompanimentPad,
  previewChord,
  togglePlayback,
  animatePartChange,
}) {
  const trackButtons = Array.from(
    document.querySelectorAll('#track-grid .track-select[data-track]'),
  )
  const quickEdit = /** @type {HTMLElement} */ (
    document.querySelector('.mixer-quick-edit')
  )
  const quickFields = /** @type {HTMLElement} */ (
    quickEdit.querySelector('.mixer-quick-fields')
  )
  workspace.dataset.mixerLayout = 'simple'

  const quickPlay = document.createElement('div')
  quickFields.before(quickPlay)
  const quickAdvanced = new Set()
  const fieldsRevision = ref(0)
  const bassToneOpen = ref(false)
  const filterDisplay = ref(0)
  const lfoPhase = ref(0)
  const ampNote = ref(/** @type {{time:number,duration:number,release:number,now:number}|null} */ (null))
  let filterFrame = 0
  /** @type {number | undefined} */
  let lfoPreviousTime
  /** Keep visual updates independent of the audio scheduler. */
  function animateFilter() {
    if (!bassToneOpen.value || playable !== 'bass') { filterFrame = 0; lfoPreviousTime = undefined; return }
    const envelope = bass.instrument.engine?.bass.synth?.filterEnvelope
    const time = bass.instrument.context?.currentTime
    if (time !== undefined) {
      if (lfoPreviousTime !== undefined && bass.lfo.depth > 0 && bass.lfo.rate > 0) lfoPhase.value = (lfoPhase.value + Math.max(0,time-lfoPreviousTime) * bass.lfo.rate) % 1
      lfoPreviousTime = time
    }
    const value = time === undefined ? 0 : envelope?.getValueAtTime?.(time) ?? 0
    filterDisplay.value = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0
    const note = time === undefined ? undefined : bass.instrument.engine?.bass.displayNotes.filter(note => note.time <= time && time < note.time + note.duration + note.release).at(-1)
    ampNote.value = note && time !== undefined ? {...note,now:time} : null
    filterFrame = requestAnimationFrame(animateFilter)
  }
  function startFilterAnimation() { if (!filterFrame && bassToneOpen.value && playable === 'bass') filterFrame = requestAnimationFrame(animateFilter) }

  /** @type {HTMLSelectElement[]} */
  let controls = []
  /** @type {'drums'|'bass'|'chord'|undefined} */
  let playable
  let unmountPlay = () => {}
  const fieldsApp = createApp({ render: renderQuickFields })
  fieldsApp.mount(quickFields)
  const accompanimentParts = /** @type {const} */ (['drums', 'bass', 'chord'])
  /** @type {Map<Element,ReturnType<typeof setTimeout>>} */
  const padFlashes = new Map()

  function clearAccompanimentPads() {
    for (const [pad, timer] of padFlashes) {
      clearTimeout(timer)
      pad.removeAttribute('data-sequencer-note')
    }
    padFlashes.clear()
    const frame = /** @type {HTMLIFrameElement|null} */ (
      quickPlay.querySelector('.backing-chord-pads')
    )
    frame?.contentWindow?.postMessage(
      { type: 'oto-pad-clear' },
      location.origin,
    )
  }

  const showPadHit = (/** @type {import('./progression.js').PadHit} */ hit) => {
    if (
      quickEdit.hidden ||
      workspace.dataset.mixerPart !== hit.part ||
      mixer.effectiveVolume(accompanimentParts.indexOf(hit.part)) <= 0
    )
      return
    if (hit.part === 'chord') {
      const frame = /** @type {HTMLIFrameElement|null} */ (
        quickPlay.querySelector('.backing-chord-pads')
      )
      frame?.contentWindow?.postMessage(
        { type: 'oto-pad-hit', chord: hit.chord, key: hit.key },
        location.origin,
      )
      return
    }
    const index =
      hit.part === 'drums'
        ? new Map([
            ['kick', 0],
            ['snare', 1],
            ['hat', (hit.duration ?? 0) >= 0.1 ? 3 : 2],
            ['openhat', 3],
          ]).get(hit.sound)
        : bassPadNotes.reduce(
            (best, note, i) =>
              Math.abs(note - hit.midi) <
              Math.abs(bassPadNotes[best] - hit.midi)
                ? i
                : best,
            0,
          )
    if (index === undefined) return
    const pad = quickPlay.querySelector(
      `.accompaniment-pads .pad[data-pad-index="${index}"]`,
    )
    if (!pad) return
    const note =
      hit.part === 'bass'
        ? ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'][
            ((hit.midi % 12) + 12) % 12
          ] +
          (Math.floor(hit.midi / 12) - 1)
        : ''
    clearTimeout(padFlashes.get(pad))
    pad.setAttribute('data-sequencer-note', note)
    padFlashes.set(
      pad,
      setTimeout(() => {
        pad.removeAttribute('data-sequencer-note')
        padFlashes.delete(pad)
      }, 125),
    )
  }

  function syncBackingPad() {
    const frame = /** @type {HTMLIFrameElement|null} */ (
      quickPlay.querySelector('.backing-chord-pads')
    )
    const barInput = /** @type {HTMLInputElement|null} */ (
      document.querySelector('.melody-bar-input input')
    )
    const bar = Math.max(
      0,
      Math.min(progression.barCount() - 1, Number(barInput?.value || 1) - 1),
    )
    frame?.contentWindow?.postMessage(
      {
        type: 'oto-pad-key',
        key: progression.keyForBar(bar),
        notation: 'number',
        skin: document.documentElement.dataset.skin ?? 'milk',
      },
      location.origin,
    )
  }
  window.addEventListener('message', (event) => {
    const frame = /** @type {HTMLIFrameElement|null} */ (
      quickPlay.querySelector('.backing-chord-pads')
    )
    if (
      event.origin !== location.origin ||
      event.source !== frame?.contentWindow
    ) return
    if (event.data?.type === 'oto-pad-play') { togglePlayback(); return }
    if (event.data?.type !== 'oto-pad-chord' || typeof event.data.id !== 'string') return
    const barInput = /** @type {HTMLInputElement|null} */ (
      document.querySelector('.melody-bar-input input')
    )
    const bar = Math.max(
      0,
      Math.min(progression.barCount() - 1, Number(barInput?.value || 1) - 1),
    )
    void previewChord(bar, 0, event.data.id, true)
  })
  keySelect.addEventListener('change', syncBackingPad)
  document.addEventListener('input', (event) => {
    if (
      event.target instanceof Element &&
      event.target.matches('.melody-bar-input input')
    )
      syncBackingPad()
  })
  document.addEventListener('click', (event) => {
    if (
      event.target instanceof Element &&
      event.target.closest('.melody-navigation')
    )
      queueMicrotask(syncBackingPad)
  })
  new MutationObserver(syncBackingPad).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-skin'],
  })

  function updateQuickMixer() {
    const selected = /** @type {HTMLElement|null} */ (
      document.querySelector('#track-grid .track-select[aria-pressed="true"]')
    )
    const part = selected?.dataset.track
    playable = accompanimentParts.find((name) => name === part)
    startFilterAnimation()
    const simple = workspace.dataset.mixerLayout === 'simple'
    workspace.dataset.mixerPart = part ?? ''
    quickEdit.hidden = (!simple && !playable) || !part || part === 'melody'
    quickEdit.classList.toggle('has-accompaniment-play', Boolean(playable))
    workspace.classList.toggle(
      'hide-accompaniment-detail',
      Boolean(playable && !quickAdvanced.has(playable)),
    )
    if (quickEdit.hidden) return
    clearAccompanimentPads()
    unmountPlay()
    unmountPlay = () => {}
    quickPlay.replaceChildren()
    if (playable) {
      const part = playable
      const view = mountAccompanimentPlay(
        part,
        progression.accompanimentModes[part],
        document.querySelector('#oto-buddy svg'),
        (mode) => {
          progression.accompanimentModes[part] = mode
          clearAccompanimentPads()
          fieldsRevision.value++
        },
        (index) => playAccompanimentPad(part, index),
        syncBackingPad,
      )
      quickPlay.append(view.element)
      unmountPlay = view.unmount
    }
    const row = selected?.closest('[role="group"]')
    controls = Array.from(row?.querySelectorAll('select') ?? [])
    const title = quickEdit.querySelector('h2')
    if (title)
      title.textContent =
        selected?.querySelector('.track-name')?.textContent ?? 'MP3'
    fieldsRevision.value++
  }

  function renderQuickFields() {
    fieldsRevision.value
    const mode = playable && progression.accompanimentModes[playable]
    const fields = controls.map((control, index) => {
      const stylePart =
        index === 1 &&
        mode === 'otto' &&
        (playable === 'drums' || playable === 'bass')
          ? playable
          : null
      const caption =
        index === 0
          ? '音色'
          : stylePart
            ? 'Ottoのプレイスタイル'
            : mode === 'auto'
              ? 'パターン'
              : '奏法'
      const value = stylePart
        ? progression.ottoAccompanimentStyle[stylePart]
        : control.value
      /** @param {string} next */
      function change(next) {
        if (stylePart) progression.ottoAccompanimentStyle[stylePart] = next
        else {
          control.value = next
          control.dispatchEvent(new Event('change', { bubbles: true }))
        }
        fieldsRevision.value++
      }
      return h('div', { class: 'part-choice-field', key: control.id }, [
        h('span', caption),
        h('div', { class: 'part-choice-picker' }, [
          selectStepperView(control, caption, change, {
            value,
            stylePart,
            options: stylePart
              ? ottoAccompanimentStyles[stylePart].map(({ id, label }, i) => ({
                  id,
                  label: `${String(i + 1).padStart(2, '0')}: ${label}`,
                }))
              : undefined,
          }),
          playable === 'bass' && index === 0 ? h('button', { type: 'button', class: 'melody-deep-toggle', 'aria-controls': 'bass-tone-settings', 'aria-expanded': String(bassToneOpen.value), onClick: () => { bassToneOpen.value = !bassToneOpen.value; if (bassToneOpen.value) { quickAdvanced.delete('bass'); workspace.classList.add('hide-accompaniment-detail') } startFilterAnimation(); fieldsRevision.value++ } }, 'こだわる') : null,
          playable && index === controls.length - 1
            ? h(
                'button',
                {
                  type: 'button',
                  class: 'melody-deep-toggle',
                  'aria-controls': 'mixer-track-details',
                  'aria-expanded': String(quickAdvanced.has(playable)),
                  onClick: () => {
                    if (quickAdvanced.has(playable))
                      quickAdvanced.delete(playable)
                    else { quickAdvanced.add(playable); if (playable === 'bass') bassToneOpen.value = false }
                    workspace.classList.toggle(
                      'hide-accompaniment-detail',
                      !quickAdvanced.has(playable),
                    )
                    fieldsRevision.value++
                  },
                },
                'こだわる',
              )
            : null,
        ]),
      ])
    })
    if (playable === 'bass') {
      const settings = bass.toneSettings
      /** @param {string} label @param {number} value @param {number} min @param {number} max @param {number} step @param {string} unit @param {(value:number)=>void} change @param {boolean} [knob] */
      const control = (label,value,min,max,step,unit,change,knob=false) => h('label',{class:knob?'otto-lab-knob':'tone-envelope-control'},[
        h('span',label),
        knob ? h('span',{class:['volume-knob',label==='Envの効き'?'synth-bipolar-knob':''],style:`--angle:${-135+270*(value-min)/(max-min)}deg`},[h('input',{type:'range',min,max,step,value,'aria-label':label,'aria-valuetext':label==='波形' ? ['','サイン波','三角波','ノコギリ波','矩形波'][value] : label==='LFO波形' ? lfoWaveformNames[value] : undefined,ref:bindSynthKnob,onInput:(/** @type {Event} */ e)=>{change((/** @type {HTMLInputElement} */(e.target)).valueAsNumber);bass.applyToneSettings();fieldsRevision.value++}}),h('span',{'aria-hidden':'true'})]) : h('input',{type:'range',min,max,step,value,'aria-label':label,onInput:(/** @type {Event} */ e)=>{change((/** @type {HTMLInputElement} */(e.target)).valueAsNumber);bass.applyToneSettings();fieldsRevision.value++}}),
        h('output',`${Number(value.toFixed(3))}${unit}`),
      ])
      // Frequency perception is logarithmic: spread low frequencies across the knob.
      const cutoffPosition = Math.round(1000 * Math.log(settings.cutoff / 50) / Math.log(18000 / 50))
      const envLevel = filterDisplay.value
      const liveEnvelope = bass.instrument.engine?.bass.synth?.filterEnvelope
      const baseCutoff = !bass.toneEdited && liveEnvelope ? liveEnvelope.baseFrequency : settings.cutoff
      const envelopeAmount = !bass.toneEdited && liveEnvelope ? liveEnvelope.octaves : settings.filter.amount
      const activeBass = bass.instrument.engine?.bass
      const cutoffPhase = activeBass?.synth ? activeBass.getLfoPhase() : lfoPhase.value
      const lfoCutoffFactor = bass.lfo.cutoff && activeBass?.synth ? 2 ** (lfoWaveValue(bass.lfo.waveform, cutoffPhase) * bass.lfo.depth / 100) : 1
      const effectiveCutoff = Math.min(20000, Math.max(20, baseCutoff * (1 + (2 ** envelopeAmount - 1) * envLevel) * lfoCutoffFactor))
      const visualCutoffPosition = Math.max(0, Math.min(1000, 1000 * Math.log(effectiveCutoff / 50) / Math.log(18000 / 50)))
      const curvePoints = Array.from({length:81},(_,i)=>{
        const frequency = 20 * (1000 ** (i / 80))
        const ratio = frequency / Math.max(20,effectiveCutoff)
        const q = Math.max(.1,settings.resonance)
        const magnitude = (settings.filterType === 'highpass' ? ratio * ratio : 1) / Math.sqrt((1-ratio*ratio)**2+(ratio/q)**2)
        const db = Math.max(-48, 40 * Math.log10(Math.max(.0001,magnitude)))
        return `${(i*3).toFixed(1)},${(8+(44-db)*1.2).toFixed(1)}`
      }).join(' ')
      const graphGradient = (/** @type {string} */ id) => h('defs',[h('linearGradient',{id,x1:0,y1:0,x2:0,y2:125,gradientUnits:'userSpaceOnUse'},[h('stop',{offset:'0%','stop-color':'var(--oto-accent)','stop-opacity':.22}),h('stop',{offset:'100%','stop-color':'var(--oto-accent)','stop-opacity':0})])])
      const filterCurve = h('svg',{class:'synth-filter-curve',viewBox:'0 0 240 125',role:'img','aria-label':'フィルターの周波数特性'},[
        graphGradient('synth-filter-gradient'),
        h('path',{d:`M0 125 L${curvePoints.replaceAll(' ',' L')} L240 125 Z`,fill:'url(#synth-filter-gradient)'}),
        h('polyline',{points:curvePoints,class:'synth-filter-line'})
      ])
      const cutoffKnob = h('label',{class:'otto-lab-knob'},[
        h('span','明るさ'),
        h('span',{class:'volume-knob',style:`--angle:${-135+270*cutoffPosition/1000}deg`},[
          h('input',{type:'range',min:0,max:1000,step:1,value:cutoffPosition,'aria-label':'明るさ','aria-valuetext':`${Math.round(settings.cutoff)} Hz`,ref:bindSynthKnob,onInput:(/** @type {Event} */ e)=>{const position=(/** @type {HTMLInputElement} */(e.target)).valueAsNumber;settings.cutoff=Math.round(50 * (18000/50)**(position/1000));bass.applyToneSettings();fieldsRevision.value++}}),
          h('span',{'aria-hidden':'true'}),
          h('svg',{class:'synth-cutoff-marker',viewBox:'0 0 40 40','aria-hidden':'true'},[
            h('circle',{class:'turn-marker',cx:20,cy:1,r:2.5,transform:`rotate(${-135+270*visualCutoffPosition/1000} 20 20)`})
          ])
        ]),h('output',`${Math.round(settings.cutoff)} Hz`)
      ])
      const stages = /** @type {const} */ (['attack','decay','sustain','release'])
      // The sustain segment is an illustrative held note; the other widths follow their durations.
      const amp = settings.amp
      const duration = amp.attack + amp.decay + 0.5 + amp.release
      const x = (/** @type {number} */ time) => 8 + 224 * time / duration
      const peakX = x(amp.attack)
      const sustainX = x(amp.attack + amp.decay)
      const releaseX = x(amp.attack + amp.decay + 0.5)
      const sustainY = 124 - 109 * amp.sustain
      const envelopePath = `M8 124 L${peakX} 15 L${sustainX} ${sustainY} L${releaseX} ${sustainY} L232 124`
      const note = ampNote.value
      const heldX = (/** @type {number} */ t) => t < amp.attack ? x(t) : t < amp.attack + amp.decay ? x(t) : sustainX + (releaseX - sustainX) * Math.min(1, (t - amp.attack - amp.decay) / Math.max(.001, (note?.duration ?? 0) - amp.attack - amp.decay))
      const elapsed = note ? note.now - note.time : 0
      const markerX = note ? elapsed < note.duration ? heldX(elapsed) : heldX(note.duration) + (232 - heldX(note.duration)) * Math.min(1, (elapsed - note.duration) / Math.max(.001,note.release)) : 0
      const ampCurve = h('svg',{class:'synth-filter-curve',viewBox:'0 0 240 125',role:'img','aria-label':'音量エンベロープ。アタック、ディケイ、サステイン、リリースの形'},[
        graphGradient('synth-amp-gradient'),
        h('path',{d:`${envelopePath} L232 125 L8 125 Z`,fill:'url(#synth-amp-gradient)'}),
        h('path',{d:envelopePath,class:'synth-filter-line'}),
        note ? h('line',{x1:markerX,x2:markerX,y1:8,y2:117,class:'synth-amp-playhead','aria-hidden':'true'}) : null
      ])
      const waveforms = ['','サイン','三角波','ノコギリ波','矩形波']
      const waveIds = ['off','sine','triangle','sawtooth','square']
      const faders = (/** @type {'amp'|'filter'} */ kind) => h('div',{class:'synth-faders'},stages.map(stage=>h('label',{class:'synth-fader'},[
        h('input',{type:'range',min:stage==='sustain'?0:.001,max:stage==='sustain'?1:2,step:.001,value:settings[kind][stage], 'aria-label':`${kind==='amp'?'音量':'フィルター'} ${stage}`,onInput:(/** @type {Event} */ e)=>{settings[kind][stage]=(/** @type {HTMLInputElement} */(e.target)).valueAsNumber;bass.applyToneSettings();fieldsRevision.value++}}),
        h('span',stage[0].toUpperCase())
      ])))
      const lfoPoints = Array.from({length:241},(_,i)=>`${i},${62.5 - lfoWaveValue(bass.lfo.waveform, i / 120) * 48 * bass.lfo.depth / 100}`).join(' ')
      const lfoIndex = Math.max(0,lfoWaveforms.indexOf(/** @type {typeof lfoWaveforms[number]} */ (bass.lfo.waveform)))
      const lfoCurve = h('svg',{class:'synth-filter-curve',viewBox:'0 0 240 125',role:'img','aria-label':`LFO の波形 ${lfoWaveformNames[lfoIndex]}、速度 ${bass.lfo.rate} Hz、深さ ${bass.lfo.depth} cent`},[
        h('polyline',{points:lfoPoints,class:'synth-filter-line'}),
        bass.lfo.depth > 0 ? h('line',{x1:lfoPhase.value*120,x2:lfoPhase.value*120,y1:8,y2:117,class:'synth-amp-playhead','aria-hidden':'true'}) : null
      ])
      fields.push(h('section',{id:'bass-tone-settings',hidden:!bassToneOpen.value,style:'grid-column:1 / -1'},[h('div',{class:'tone-editor synth-editor'},[
        h('fieldset',{class:'synth-osc'},[h('legend','OSC'),h('div',{class:'synth-osc-bank'},[bass.oscillators[0]].map((osc,index)=>{
          if (!waveIds.includes(osc.waveform) || osc.waveform === 'off') osc.waveform = 'sawtooth'
          const waveIndex=waveIds.indexOf(osc.waveform)
          const indicator=h('svg',{class:'synth-wave-icon',viewBox:'0 0 40 20',role:'img','aria-label':waveforms[waveIndex]},[h('path',{d:['','M3 10 C8 -1 12 -1 17 10 S26 21 31 10 S35 1 37 3','M3 17 L11 3 L19 17 L27 3 L35 17','M3 17 L15 3 L15 17 L27 3 L27 17 L37 5','M3 16 V4 H12 V16 H22 V4 H32 V16 H37'][waveIndex],fill:'none',stroke:'currentColor','stroke-width':2.8,'stroke-linecap':'round','stroke-linejoin':'round'})])
          return h('div',{class:'synth-osc-column'},[
            h('div',{class:'synth-osc-control'},[control('波形',waveIndex,1,4,1,'',value=>{osc.waveform=waveIds[value]},true),indicator]),
            h('div',{class:'synth-octave-control'},[h('span','Oct'),h('fieldset',{class:'segmented-control synth-octave-switch','aria-label':'オクターブ'},[h('legend',{class:'sr-only'},'オクターブ'),...[-1,0,1].map(value=>h('label',[h('input',{type:'radio',name:'bass-osc-octave',value,checked:osc.octave===value,onChange:()=>{osc.octave=value;bass.applyToneSettings();fieldsRevision.value++}}),h('span',value>0?`+${value}`:String(value))]))])])
          ])
        }).concat([
          h('div',{class:'synth-osc-column'},[h('div',{class:'synth-osc-control'},[control('重ねる音数',bass.unisonCount,1,5,1,'',value=>{bass.unisonCount=value},true),h('span',{class:'synth-osc-value'},String(bass.unisonCount))]),h('div',{class:'synth-cutoff-control'},[control('音程',bass.oscillators[0].cent,-100,100,1,' cent',value=>{bass.oscillators[0].cent=value},true),h('button',{type:'button',class:'melody-deep-toggle synth-lfo-toggle','aria-label':'音程に LFO をかける','aria-pressed':String(bass.lfo.pitch),onClick:()=>{bass.lfo.pitch=!bass.lfo.pitch;bass.applyToneSettings();fieldsRevision.value++}},'LFO')])]),
          h('div',{class:'synth-osc-column'},[h('div',{class:'synth-osc-control'},[control('ズラす量',bass.unisonDetune,0,50,1,' cent',value=>{bass.unisonDetune=value},true),h('span',{class:'synth-osc-value'},`${bass.unisonDetune} cent`)])])
        ])),h('section',{class:'synth-amp'},[h('h3','Amp Env'),ampCurve,faders('amp')])]),
        h('fieldset',[h('legend','Filter'),h('div',{class:'synth-knob-row'},[h('div',{class:'synth-cutoff-control'},[cutoffKnob,h('button',{type:'button',class:'melody-deep-toggle synth-lfo-toggle','aria-label':'明るさに LFO をかける','aria-pressed':String(bass.lfo.cutoff),onClick:()=>{bass.lfo.cutoff=!bass.lfo.cutoff;bass.applyToneSettings();fieldsRevision.value++}},'LFO')]),control('音のクセ',settings.resonance,.1,12,.1,'',value=>{settings.resonance=value},true),control('Envの効き',settings.filter.amount,-6,6,.1,' oct',value=>{settings.filter.amount=value},true)]),h('div',{class:'synth-filter-type-control'},[h('span','タイプ'),h('fieldset',{class:'segmented-control synth-filter-type','aria-label':'フィルターの種類'},[h('legend',{class:'sr-only'},'フィルターの種類'),.../** @type {const} */ ([['lowpass','ローパス'],['highpass','ハイパス']]).map(([type,label])=>h('label',[h('input',{type:'radio',name:'bass-filter-type',value:type,checked:settings.filterType===type,onChange:()=>{settings.filterType=type;bass.applyToneSettings();fieldsRevision.value++}}),h('span',label)]))])]),h('div',{class:'synth-filter-envelope'},[h('h3','Filter Env'),filterCurve,faders('filter')])]),
        h('fieldset',{class:'synth-lfo'},[h('legend','LFO'),h('div',{class:'synth-knob-row'},[
          control('速さ',bass.lfo.rate,0,12,.1,' Hz',value=>{bass.lfo.rate=value},true),
          control('深さ',bass.lfo.depth,0,100,1,' cent',value=>{bass.lfo.depth=value},true),
          h('div',{class:'synth-osc-control'},[control('LFO波形',lfoIndex,0,3,1,'',value=>{bass.lfo.waveform=lfoWaveforms[value]},true),h('svg',{class:'synth-wave-icon',viewBox:'0 0 40 20',role:'img','aria-label':lfoWaveformNames[lfoIndex]},[h('path',{d:['M3 10 C8 -1 12 -1 17 10 S26 21 31 10 S35 1 37 3','M3 17 L11 3 L19 17 L27 3 L35 17','M3 17 L15 3 L15 17 L27 3 L27 17 L37 5','M3 16 V4 H12 V16 H22 V4 H32 V16 H37'][lfoIndex],fill:'none',stroke:'currentColor','stroke-width':2.8,'stroke-linecap':'round','stroke-linejoin':'round'})])])
        ]),h('div',{class:'synth-lfo-display'},[lfoCurve])]),
      ])]))
    }
    return fields
  }

  for (const input of Array.from(
    document.querySelectorAll('input[name="mixer-layout"]'),
  )) {
    input.addEventListener('change', () => {
      workspace.dataset.mixerLayout = /** @type {HTMLInputElement} */ (
        input
      ).value
      updateQuickMixer()
    })
  }
  document.querySelector('.mixer-score-link')?.addEventListener('click', () => {
    ;/** @type {HTMLInputElement|null} */ (
      document.querySelector('input[name="workspace-view"][value="score"]')
    )?.click()
  })
  genreSelect.addEventListener('change', () => queueMicrotask(updateQuickMixer))

  for (const button of trackButtons) {
    button.addEventListener('click', () => {
      if (workspace.dataset.workspaceView === 'score') {
        ;/** @type {HTMLInputElement|null} */ (
          document.querySelector('input[name="workspace-view"][value="mixer"]')
        )?.click()
      }
      const selected = /** @type {HTMLElement} */ (button).dataset.track
      for (const item of trackButtons)
        item.setAttribute('aria-pressed', String(item === button))
      const details = /** @type {HTMLElement} */ (
        document.querySelector('.track-details')
      )
      details.hidden = selected === 'melody'
      for (const name of ['reference', 'drums', 'bass', 'chord', 'melody']) {
        const panel = /** @type {HTMLElement} */ (
          document.querySelector(
            name === 'chord' ? '#detail-backing' : `#detail-${name}`,
          )
        )
        panel.hidden = name !== selected
      }
      updateQuickMixer()
    })
  }
  document
    .querySelector('.melody-track')
    ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))

  // Select a part only for a direct user edit, not for style or file loading.
  const trackGrid = /** @type {HTMLElement} */ (
    document.querySelector('#track-grid')
  )
  /** @param {Event} event */
  function selectEditedTrack(event) {
    if (!(event.target instanceof HTMLSelectElement)) return
    const row = event.target.closest('[role="group"]')
    const button = /** @type {HTMLButtonElement | null} */ (
      row?.querySelector('.track-select')
    )
    if (button) {
      button.click()
      animatePartChange(button)
    }
  }
  trackGrid.addEventListener('change', (event) => {
    if (event.isTrusted) selectEditedTrack(event)
  })
  trackGrid.addEventListener('part-user-change', selectEditedTrack)
  const refreshFields = () => { fieldsRevision.value++ }
  trackGrid.addEventListener('change', refreshFields)
  trackGrid.addEventListener('part-sync', refreshFields)

  return {
    updateQuickMixer,
    syncBackingPad,
    clearAccompanimentPads,
    showPadHit,
    trackGrid,
  }
}
