import { keys } from './music.js'
import { features } from './features.js'
import { meterParts, partMeter } from './tone-engine.js'
import { createApp, h, ref } from './vendor/vue.runtime.esm-browser.prod.js'

export function mountReferenceControls() {
  const state = ref({
    duration: 0, playing: false, filename: '', message: '', stemsReady: false, importing: false,
    stemEnabled: [true, true, true, true],
    dragging: false, meterLevel: 0,
  }).value
  const style = ref('')
  const genre = ref('')
  const segmentCount = 26
  createApp({
    render: () => [
      h('input', {id: 'ref-file', type: 'file', accept: 'audio/*,.mp3', hidden: true}),
      h('div', { class: 'lcd-screen' }, [
        h('button', {id: 'style-open', type: 'button', class: 'lcd-title', title: state.filename || style.value, 'aria-label': 'ジャンルとスタイルを選ぶ'}, [
          h('span', {class: 'lcd-caption'}, state.filename ? 'ユーザーのお気に入り曲' : genre.value),
          h('span', {class: 'lcd-style-line'}, [
            h('span', {class: 'lcd-note', 'aria-hidden': 'true'}, '♪'),
            h('span', {class: 'lcd-style-name'}, state.filename || style.value || 'oto'),
          ]),
          state.filename ? h('span', {class: 'lcd-applied-style'}, style.value) : null,
        ]),
        h('div', {class: 'lcd-meters', 'aria-hidden': 'true'},
          meterParts.map(part => h('span', {class: 'channel-meter', 'data-channel-meter': part, title: part},
            Array.from({length: 8}, () => h('i'))))),
      ]),
    ],
  }).mount('#player-display')
  const samples = new Float32Array(1024)
  let frame = 0
  const displayedLevels = meterParts.map(() => 0)
  return {
    state,
    /** @param {string} name @param {string} group */
    setStyle(name, group) { style.value = name; genre.value = group },
    /** @param {AudioContext | undefined} context */
    meter(context) {
      if (frame || !context) return
      const analysers = meterParts.map(part => partMeter(context, part))
      const segments = meterParts.map(part => document.querySelectorAll(`[data-channel-meter="${part}"]`))
      const bars = segments.map(meters => Array.from(meters, meter => meter.querySelectorAll('i')))
      function update() {
        analysers.forEach((analyser, index) => {
          analyser.getFloatTimeDomainData(samples)
          let peak = 0
          for (const sample of samples) peak = Math.max(peak, Math.abs(sample))
          const decibels = 20 * Math.log10(peak)
          const target = Math.max(0, segmentCount * (1 + decibels / 48))
          displayedLevels[index] = Math.max(target, displayedLevels[index] - 1)
          const lit = Math.ceil(Math.min(segmentCount, displayedLevels[index]) / segmentCount * 8)
          for (const bar of bars[index]) bar.forEach((segment, step) => segment.classList.toggle('lit', step < lit))
        })
        frame = requestAnimationFrame(update)
      }
      frame = requestAnimationFrame(update)
    },
    stopMeter() {
      cancelAnimationFrame(frame)
      frame = 0
      displayedLevels.fill(0)
      document.querySelectorAll('[data-channel-meter] i').forEach(node => node.classList.remove('lit'))
    },
  }
}

/** @param {ReturnType<typeof mountReferenceControls>['state']} reference
 * @param {{editReference:()=>void, toggleStem:(index:number)=>void, separateStems:()=>void, cancelImport:()=>void, remove:()=>void}} player */
export function mountBasicParts(reference, player) {
  const referenceMeter = {
    render: () => h('span', {class: 'channel-meter', 'aria-hidden': 'true'},
      Array.from({length: 8}, (_, i) => h('i', {class: {lit: i < Math.ceil(reference.meterLevel * .8)}}))),
  }
  createApp({
    render: () => {
      const parts = [
      h('div', {key:'reference', class: ['reference-channel', {'awaiting-file': !reference.duration}], role: 'group', 'aria-label': 'MP3パート'}, [
        reference.message && !reference.duration ? h('div', {class: 'reference-upload reference-import-status', 'aria-busy': reference.importing}, [
          reference.importing ? h('span', {class: 'ref-import-spinner', 'aria-hidden': 'true'}) : null,
          h('p', {role: 'status', 'aria-live': 'polite'}, reference.message),
          h('button', {type: 'button', onClick: player.cancelImport}, reference.importing ? '中断' : '閉じる'),
        ]) : !reference.duration ? h('button', {type: 'button', class: ['reference-upload', {dragging: reference.dragging}],
          'data-reference-drop': '', 'aria-label': 'MP3ファイルを読み込む',
          onClick: () => document.getElementById('ref-file')?.click()}, [
            h('svg', {class: 'part-icon', viewBox: '0 0 24 24', 'aria-hidden': 'true'}, [
              h('path', {d: 'M2 10v4m4-7v10m4-14v18m4-15v12m4-10v8m4-6v4',
                fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round'}),
            ]),
            h('span', 'MP3 読み込み'),
          ]) : !reference.stemsReady ? h('div', {class:'reference-stem-panel'}, [
            h('div', {class:'reference-stem-header'}, [h('span', '元音源'), features.stemSeparation ? h('button', {type:'button', class:'reference-stem-action', disabled:reference.importing || reference.message.includes('次の再生'), onClick:player.separateStems}, 'Stem') : null]),
            reference.message ? h('span', {class:'reference-stem-status', role:'status'}, reference.message) : null,
            reference.importing ? h('button', {type:'button', class:'reference-stem-cancel', onClick:player.cancelImport}, '中断') : null,
          ]) : h('div', {class: 'reference-stem-switches', role: 'group', 'aria-label': '分離したパート'}, [
          ...[[1, 'Drum'], [2, 'Bass'], [0, 'Vocal'], [3, 'Other']].map(([index, label]) =>
            h('button', {type: 'button', key: index, disabled: !reference.stemsReady,
              'aria-pressed': reference.stemsReady && reference.stemEnabled[Number(index)],
              onClick: () => player.toggleStem(Number(index))}, String(label))),
        ]),
        h('div', {class: 'part-mix', role: 'group', 'aria-label': 'MP3のミックス'}, [
          h('button', {id: 'reference-mute', type: 'button', class: 'mix-button', 'aria-label': 'MP3をミュート', 'aria-pressed': 'false'}, 'M'),
          h('button', {id: 'reference-solo', type: 'button', class: 'mix-button', 'aria-label': 'MP3をソロ', 'aria-pressed': 'false'}, 'S'),
          h('label', {class: 'volume-knob', title: 'MP3の音量'}, [
            h('input', {id: 'reference-volume', type: 'range', min: 0, max: 100, value: 25, 'aria-label': 'MP3の音量'}),
            h('span', {'aria-hidden': 'true'}),
          ]),
          h(referenceMeter),
        ]),
        h('button', {class: 'part-heading track-select reference-play-key', type: 'button',
          'data-track':'reference', 'aria-controls':'detail-reference', 'aria-pressed':'false',
          'aria-label':'MP3の詳細を表示',
          title: reference.filename || undefined,
          onClick: () => {}}, [
          h('svg', {class: 'part-icon', viewBox: '0 0 24 24', 'aria-hidden': 'true'}, [
            h('path', {d: 'M2 10v4m4-7v10m4-14v18m4-15v12m4-10v8m4-6v4',
              fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round'}),
          ]),
          h('span', {class: 'track-name'}, 'MP3'),
        ]),
      ]),
      h("div", {key:"drums", "class": "drum-controls", "role": "group", "aria-label": "ドラムパート"}, [
        h("button", {"class": "part-heading track-select", "type": "button", "data-track": "drums", "aria-controls": "detail-drums", "aria-label": "ドラムの詳細を表示", "title": "ドラムの設定を表示", "aria-pressed": "false"}, [
          h("svg", {"class": "part-icon", "aria-hidden": "true", "focusable": "false", "viewBox": "0 0 24 24"}, [
            h("path", {"class": "stamp", "d": "M3 9q9 5 18 0l-2 9q-7 5-14 0z"}),
            h("ellipse", {"class": "print", "cx": "12", "cy": "7", "rx": "9", "ry": "3"}),
            h("path", {"class": "cut", "d": "m6 12 2 5 3-4m3 0 2 4 2-5"}),
          ]),
          h("span", {"class": "track-name", "aria-hidden": "true"}, "ドラム"),
        ]),
        h("label", {"class": "select-control"}, [
          h("span", {"class": "sr-only"}, "ドラムの音色"),
          h("select", {"id": "drum-timbre"}, [
            h("option", {"value": "acoustic"}, "生ドラム"),
            h("option", {"value": "electronic"}, "電子ドラム"),
            h("option", {"value": "chip"}, "8bit ノイズ"),
          ]),
        ]),
        h("label", {"class": "select-control", "for": "rhythm-pattern", "title": "ドラムパターン"}, [
          h("span", {"class": "sr-only"}, "ドラムパターン"),
          h("select", {"id": "rhythm-pattern"}),
        ]),
        h("div", {"class": "part-mix", "role": "group", "aria-label": "ドラムのミックス"}, [
          h("button", {"type": "button", "class": "mix-button", "id": "drum-mute", "aria-label": "ドラムをミュート", "aria-pressed": "false", "title": "ミュート"}, "M"),
          h("button", {"type": "button", "class": "mix-button", "id": "drum-solo", "aria-label": "ドラムをソロ", "aria-pressed": "false", "title": "ソロ"}, "S"),
          h("label", {"class": "volume-knob", "title": "ドラムの音量"}, [
            h("input", {"id": "drum-volume", "type": "range", "min": "0", "max": "100", "value": "35", "aria-label": "ドラムの音量"}),
            h("span", {"aria-hidden": "true"}),
          ]),
        ]),
      ]),
      h("div", {key:"bass", "class": "bass-controls", "role": "group", "aria-label": "ベースパート"}, [
        h("button", {"class": "part-heading track-select", "type": "button", "data-track": "bass", "aria-controls": "detail-bass", "aria-label": "ベースの詳細を表示", "title": "ベースの設定を表示", "aria-pressed": "false"}, [
          h("svg", {"class": "part-icon", "aria-hidden": "true", "focusable": "false", "viewBox": "0 0 24 24"}, [
            h("path", {"class": "stamp", "d": "m13 9 6-7 3 2-7 8q2 4-2 8-4 4-8 1t-2-8q2-4 6-3z"}),
            h("path", {"class": "print", "d": "m5 15 4 4 2-2-4-4z"}),
            h("path", {"class": "cut", "d": "m10 14 8-9"}),
          ]),
          h("span", {"class": "track-name", "aria-hidden": "true"}, "ベース"),
        ]),
        h("label", {"class": "select-control", "for": "bass-timbre", "title": "ベースの音色"}, [
          h("span", {"class": "sr-only"}, "ベースの音色"),
          h("select", {"id": "bass-timbre"}, [
            h("option", {"value": "acoustic"}, "アコースティック"),
            h("option", {"value": "electric", "selected": true}, "エレクトリックベース"),
            h("option", {"value": "synth"}, "シンセベース"),
          ]),
        ]),
        h("label", {"class": "select-control"}, [
          h("span", {"class": "sr-only"}, "ベースパターン"),
          h("select", {"id": "bass-pattern"}, [
            h("optgroup", {"label": "ストレート"}, [
              h("option", {"value": "straight4"}, "4分刻み"),
              h("option", {"value": "straight8", "selected": true}, "8分刻み"),
              h("option", {"value": "straight16"}, "16分刻み"),
            ]),
            h("optgroup", {"label": "ベースライン"}, [
              h("option", {"value": "line_walk"}, "ウォーキング"),
              h("option", {"value": "line_sing"}, "メロディック"),
              h("option", {"value": "line_hook"}, "跳ねるオクターブ"),
              h("option", {"value": "line_relay"}, "階段フレーズ"),
              h("option", {"value": "line_octave"}, "オクターブ・ライン"),
            ]),
            h("optgroup", {"label": "グルーヴ"}, [
              h("option", {"value": "offbeat"}, "裏拍"),
              h("option", {"value": "pop"}, "ポップ"),
              h("option", {"value": "chill"}, "チル"),
            ]),
            h("optgroup", {"label": "コードプログレッション"}, [
              h("option", {"value": "support_hold"}, "ロングトーン"),
              h("option", {"value": "support_half"}, "2拍ずつ"),
              h("option", {"value": "support_pulse"}, "ゆったりパルス"),
            ]),
            h("option", {"value": "off"}, "なし"),
          ]),
        ]),
        h("div", {"class": "part-mix", "role": "group", "aria-label": "ベースのミックス"}, [
          h("button", {"type": "button", "class": "mix-button", "id": "bass-mute", "aria-label": "ベースをミュート", "aria-pressed": "false", "title": "ミュート"}, "M"),
          h("button", {"type": "button", "class": "mix-button", "id": "bass-solo", "aria-label": "ベースをソロ", "aria-pressed": "false", "title": "ソロ"}, "S"),
          h("label", {"class": "volume-knob", "title": "ベースの音量"}, [
            h("input", {"id": "bass-volume", "type": "range", "min": "0", "max": "100", "value": "50", "aria-label": "ベースの音量"}),
            h("span", {"aria-hidden": "true"}),
          ]),
        ]),
      ]),
      h("div", {key:"chord", "class": "chord-sound-controls part-controls", "role": "group", "aria-label": "バッキングパート"}, [
        h("button", {"class": "part-heading track-select", "type": "button", "data-track": "chord", "aria-controls": "detail-chord", "aria-label": "バッキングの詳細を表示", "title": "バッキングの設定を表示", "aria-pressed": "true"}, [
          h("svg", {"class": "part-icon", "aria-hidden": "true", "focusable": "false", "viewBox": "0 0 24 24"}, [
            h("rect", {"class": "stamp", "x": "1", "y": "4", "width": "22", "height": "16", "rx": "2"}),
            h("path", {"class": "cut", "d": "M7 10v8m5-8v8m5-8v8"}),
            h("path", {"class": "print", "d": "M5 4h3v8H5zm10 0h3v8h-3z"}),
          ]),
          h("span", {"class": "track-name", "aria-hidden": "true"}, "バッキング"),
        ]),
        h("label", {"class": "select-control", "for": "chord-timbre"}, [
          h("span", {"class": "sr-only"}, "コードの音色"),
          h("select", {"id": "chord-timbre"}),
        ]),
        h("label", {"class": "select-control", "for": "chord-backing"}, [
          h("span", {"class": "sr-only"}, "コードのバッキング"),
          h("select", {"id": "chord-backing"}),
        ]),
        h("div", {"class": "part-mix", "role": "group", "aria-label": "コードのミックス"}, [
          h("button", {"type": "button", "class": "mix-button", "id": "chord-mute", "aria-label": "コードをミュート", "aria-pressed": "false", "title": "ミュート"}, "M"),
          h("button", {"type": "button", "class": "mix-button", "id": "chord-solo", "aria-label": "コードをソロ", "aria-pressed": "false", "title": "ソロ"}, "S"),
          h("label", {"class": "volume-knob", "title": "コードの音量"}, [
            h("input", {"id": "chord-volume", "type": "range", "min": "0", "max": "100", "value": "40", "aria-label": "コードの音量"}),
            h("span", {"aria-hidden": "true"}),
          ]),
        ]),
      ]),
      h("div", {key:"melody", "class": "melody-controls", "role": "group", "aria-label": "メロディパート"}, [
        h("button", {"class": "part-heading track-select melody-track", "type": "button", "data-track": "melody", "aria-controls": "detail-melody", "aria-label": "メロディの詳細を表示", "title": "メロディの設定を表示", "aria-pressed": "false"}, [
          h("svg", {"class": "part-icon", "aria-hidden": "true", "focusable": "false", "viewBox": "0 0 24 24"}, [
            h("path", {"class": "stamp", "d": "M8 5 21 2v15c0 4-8 6-8 2 0-2 3-4 6-4V7l-9 2v10c0 4-8 6-8 2 0-2 3-4 6-4z"}),
            h("path", {"class": "print", "d": "m8 5 13-3v3L8 8z"}),
          ]),
          h("span", {"class": "track-name", "aria-hidden": "true"}, "メロディ"),
        ]),
        h("label", {"class": "select-control", "for": "melody-timbre"}, [
          h("span", {"class": "sr-only"}, "メロディの音色"),
          h("select", {"id": "melody-timbre"}),
        ]),
        h("label", {"class": "select-control", "for": "melody-mode"}, [
          h("span", {"class": "sr-only"}, "メロディの演奏方法"),
          h("select", {"id": "melody-mode"}, [
            h("option", {"value": "all-you"}, "自分で弾く"),
            h("option", {"value": "all-pc"}, "Ottoに弾いてもらう"),
            h("option", {"value": "session"}, "Ottoとセッション"),
          ]),
        ]),
        h("div", {"class": "part-mix", "role": "group", "aria-label": "メロディのミックス"}, [
          h("button", {"type": "button", "class": "mix-button", "id": "melody-mute", "aria-label": "メロディをミュート", "aria-pressed": "false", "title": "ミュート"}, "M"),
          h("button", {"type": "button", "class": "mix-button", "id": "melody-solo", "aria-label": "メロディをソロ", "aria-pressed": "false", "title": "ソロ"}, "S"),
          h("label", {"class": "volume-knob", "title": "メロディの音量"}, [
            h("input", {"id": "melody-volume", "type": "range", "min": "0", "max": "100", "value": "40", "aria-label": "メロディの音量"}),
            h("span", {"aria-hidden": "true"}),
          ]),
        ]),
      ]),
      ]
      const [referencePart, drums, bass, backing, melody] = parts
      return [
        h('div', {key:'mp3-label', class:'compact-mixer-caption compact-mixer-mp3'}, 'MP3'),
        referencePart,
        h('div', {key:'play-label', class:'compact-mixer-caption compact-mixer-play'}, 'Play'),
        melody,
        h('div', {key:'accompaniment-label', class:'compact-mixer-caption compact-mixer-accompaniment'}, '伴奏'),
        drums, bass, backing,
      ]
    },
  }).mount('#track-grid')
}

/** @param {ReturnType<typeof mountReferenceControls>['state']} reference
 * @param {()=>void} remove */
export function mountReferenceDetail(reference, remove){
 const panel=document.createElement('section')
 panel.id='detail-reference';panel.hidden=true;panel.setAttribute('aria-label','MP3の詳細')
 document.querySelector('.track-details')?.append(panel)
 const header=document.createElement('div')
 panel.append(header)
 createApp({render:()=>[
  h('h2','MP3'),
  h('div',{class:'reference-file-details'},[
   h('p',{class:'reference-filename'},reference.filename || 'MP3ファイルを読み込んでください。'),
   reference.duration ? h('button',{type:'button',class:'reference-trash',title:'曲を外す','aria-label':'曲を外す',onClick:remove},[h('svg',{viewBox:'0 0 24 24',width:16,height:16,fill:'none',stroke:'currentColor','stroke-width':1.5,'aria-hidden':'true'},[h('path',{d:'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 10v7M14 10v7'})])]) :
    h('button',{type:'button',class:'reference-remove-key',onClick:()=>document.getElementById('ref-file')?.click()},'MP3を読み込む'),
  ]),
  reference.duration && reference.message ? h('div',{class:'reference-background-status',role:'status','aria-live':'polite'},[
    reference.importing?h('span',{class:'ref-import-spinner','aria-hidden':'true'}):null,
    h('span',reference.message),
    reference.importing?h('button',{type:'button',onClick:()=>document.dispatchEvent(new Event('reference-import-cancel'))},'中断'):null,
  ]):null,
 ]}).mount(header)
 // The timing controls own their DOM independently from the reactive file header.
 const timingHost=document.createElement('div')
 panel.append(timingHost)
 return timingHost
}

/** @param {HTMLInputElement} input @param {number} sensitivity @param {boolean} [integer] */
export function bindKnobDrag(input, sensitivity, integer = false) {
  const knob = input.parentElement
  if (!knob) return
  // Drag relative to the starting value so touching the knob never jumps it.
  input.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0) return
    event.preventDefault()
    input.focus({ preventScroll: true })
    const startX = event.clientX
    const startY = event.clientY
    const startValue = Number(input.value)
    knob.setPointerCapture(event.pointerId)
    /** @param {PointerEvent} move */
    const onMove = move => {
      if (move.pointerId !== event.pointerId) return
      const change = (move.clientX - startX) - (move.clientY - startY)
      const previous = input.value
      input.value = String(integer ? Math.round(startValue + change * sensitivity) : startValue + change * sensitivity)
      if (input.value !== previous) {
        input.dispatchEvent(new Event('input', { bubbles: true }))
      }
    }
    /** @param {PointerEvent} end */
    const onEnd = end => {
      if (end.pointerId !== event.pointerId) return
      knob.removeEventListener('pointermove', onMove)
      knob.removeEventListener('pointerup', onEnd)
      knob.removeEventListener('pointercancel', onEnd)
      knob.removeEventListener('lostpointercapture', onEnd)
    }
    knob.addEventListener('pointermove', onMove)
    knob.addEventListener('pointerup', onEnd)
    knob.addEventListener('pointercancel', onEnd)
    knob.addEventListener('lostpointercapture', onEnd)
  })
}


/** @param {HTMLSelectElement} drumTimbre @param {HTMLSelectElement} bassTimbre */
export function mountPartIcons(drumTimbre, bassTimbre) {
// Pictograms are printed in the same two inks as the existing part keys.
const partIcons = {
  drums: {
    acoustic: '<path class="stamp" d="M3 9q9 5 18 0l-2 9q-7 5-14 0z"/><ellipse class="print" cx="12" cy="7" rx="9" ry="3"/><path class="cut" d="m6 12 2 5 3-4m3 0 2 4 2-5"/>',
    electronic: '<rect class="stamp" x="2" y="3" width="20" height="18" rx="3"/><circle class="icon-cutout" cx="7" cy="8" r="2"/><circle class="icon-cutout" cx="17" cy="8" r="2"/><circle class="icon-cutout" cx="7" cy="16" r="2"/><circle class="icon-cutout" cx="17" cy="16" r="2"/>',
  },
  bass: {
    electric: '<path class="stamp" d="m13 9 6-7 3 2-7 8q2 4-2 8-4 4-8 1t-2-8q2-4 6-3z"/><path class="print" d="m5 15 4 4 2-2-4-4z"/><path class="cut" d="m10 14 8-9"/>',
    acoustic: '<path class="stamp" d="M13 2h3v8c3 1 4 3 4 6 0 4-3 6-8 6s-8-2-8-6c0-3 2-5 5-6l1-3h3z"/><circle class="print" cx="12" cy="15" r="2.5"/><path class="cut" d="M13 4v12m2-12v12"/>',
    synth: '<path class="stamp" d="M3 3h18v18H3z"/><path class="cut" fill="none" d="M5 15h3v-5h3v5h3v-5h3v5h2"/><circle class="print" cx="7" cy="6.5" r="1"/><circle class="print" cx="12" cy="6.5" r="1"/><circle class="print" cx="17" cy="6.5" r="1"/>',
  },
}
function updatePartIcons() {
  for (const [track, value] of [['drums', drumTimbre.value], ['bass', bassTimbre.value]]) {
    const icon = document.querySelector(`[data-track="${track}"] .part-icon`)
    const designs = track === 'drums' ? partIcons.drums : partIcons.bass
    const svg = Reflect.get(designs, value)
    if (icon && typeof svg === 'string') icon.innerHTML = svg
  }
}
updatePartIcons()

return updatePartIcons
}

/** Range controls keep the version-1 baseline inputs mounted for persistence.
 * @param {{workspace:HTMLElement, progression:import('./progression.js').Progression,
 * editingSection:{value:number}, mixerKey:HTMLInputElement, meterInput:HTMLInputElement,
 * tempo:HTMLInputElement, keySelect:HTMLSelectElement, contextChanged:()=>void, harmonyChanged:()=>void}} controls */
export function mountSectionKnobs({workspace, progression, editingSection, mixerKey, meterInput, tempo, keySelect, contextChanged, harmonyChanged}) {
// Section knobs edit range metadata without changing the song's fallback settings.
const baselineControls=document.createElement('div')
baselineControls.hidden=true
workspace.append(baselineControls)
const sectionKnobs = /** @type {(()=>void)[]} */ ([])
for (const [source, field, caption] of /** @type {[HTMLInputElement, 'key'|'meter'|'bpm', string][]} */ ([[mixerKey,'key','キー'],[meterInput,'meter','拍子'],[tempo,'bpm','テンポ']])) {
  const original=/** @type {HTMLElement} */(source.closest(field==='bpm'?'.timing-control':'.mixer-key, .mixer-meter'))
  const clone=/** @type {HTMLElement} */(original.cloneNode(true))
  clone.querySelectorAll('[id]').forEach(element=>element.id='section-'+element.id)
  clone.querySelectorAll('[for]').forEach(element=>element.setAttribute('for','section-'+element.getAttribute('for')))
  original.before(clone)
  baselineControls.append(original)
  const input=/** @type {HTMLInputElement} */(clone.querySelector('input[type=range]'))
  input.setAttribute('aria-label',`セクションの${caption}`)
  const numeric=/** @type {HTMLInputElement|null} */(clone.querySelector('input[type=number]'))
  if(numeric)numeric.setAttribute('aria-label','セクションのテンポを数値で入力')
  const output=clone.querySelector('output')
  const knob=/** @type {HTMLElement} */(input.parentElement)
  function refresh() {
    const section=progression.sections[editingSection.value]
    const value=(field==='bpm' ? progression.referenceBpm : null) ?? section[field] ?? (field==='key'?progression.key:Number(source.value))
    input.value=String(field==='key'&&value>6?value-12:value)
    const text=field==='key'?keys[value].name:field==='meter'?`${value}/4`:String(value)
    if(output)output.textContent=text
    if(numeric)numeric.value=String(value)
    input.setAttribute('aria-valuetext',text)
    knob.style.setProperty('--angle',`${field==='key'?Number(input.value)*11.25:field==='meter'?(value-4)*90:(value-120)*1.6875}deg`)
  }
  input.addEventListener('input',()=>{
    const value=Number(input.value)
    if (field === 'bpm' && progression.referenceBpm !== null) {
      tempo.value = input.value
      tempo.dispatchEvent(new Event('input', {bubbles:true}))
      return
    }
    progression.sections[editingSection.value][field]=field==='key'?(value%12+12)%12:value
    contextChanged()
    refresh()
    if(field!=='bpm'){harmonyChanged()}
  })
  if(numeric)numeric.addEventListener('keydown',event=>{if(event.key==='Enter')numeric.blur();if(event.key==='Escape'){refresh();numeric.blur()}})
  if(numeric)numeric.addEventListener('blur',()=>{
    const value=Number(numeric.value)
    if(Number.isFinite(value)&&value>=40&&value<=200){input.value=String(Math.round(value*10)/10);input.dispatchEvent(new Event('input',{bubbles:true}))}
    else refresh()
  })
  bindKnobDrag(input,field==='bpm'?.6:field==='meter'?.035:.12,true)
  sectionKnobs.push(refresh)
}
const refreshSectionKnobs=()=>sectionKnobs.forEach(refresh=>refresh())
refreshSectionKnobs()

for (const control of [tempo,meterInput,keySelect]) control.addEventListener(control===keySelect?'change':'input',()=>{contextChanged();refreshSectionKnobs()})

return refreshSectionKnobs
}
