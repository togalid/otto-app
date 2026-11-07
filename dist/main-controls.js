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
 * @param {{editReference:()=>void, toggleStem:(index:number)=>void, cancelImport:()=>void, remove:()=>void}} player */
export function mountBasicParts(reference, player) {
  const referenceMeter = {
    render: () => h('span', {class: 'channel-meter', 'aria-hidden': 'true'},
      Array.from({length: 8}, (_, i) => h('i', {class: {lit: i < Math.ceil(reference.meterLevel * .8)}}))),
  }
  createApp({
    render: () => [
      h('div', {class: ['reference-channel', {'awaiting-file': !reference.duration || !!reference.message}], role: 'group', 'aria-label': 'MP3パート'}, [
        reference.message ? h('div', {class: 'reference-upload reference-import-status', 'aria-busy': reference.importing}, [
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
          ]) : h('div', {class: 'reference-stem-switches', role: 'group', 'aria-label': '分離したパート'}, [
          ...[[1, 'Drum'], [2, 'Bass'], [0, 'Vocal'], [3, 'Other']].map(([index, label]) =>
            h('button', {type: 'button', key: index, disabled: !reference.stemsReady,
              'aria-pressed': reference.stemsReady && reference.stemEnabled[Number(index)],
              onClick: () => player.toggleStem(Number(index))}, String(label))),
        ]),
        reference.duration && !reference.message ? h('button', {type:'button', disabled:reference.importing, onClick:player.remove}, '曲を外す') : null,
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
          'aria-label': reference.duration ? 'MP3の開始位置を調整' : 'MP3ファイルを選ぶ',
          title: reference.filename || undefined,
          onClick: () => reference.duration ? player.editReference() : document.getElementById('ref-file')?.click()}, [
          h('svg', {class: 'part-icon', viewBox: '0 0 24 24', 'aria-hidden': 'true'}, [
            h('path', {d: 'M2 10v4m4-7v10m4-14v18m4-15v12m4-10v8m4-6v4',
              fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round'}),
          ]),
          h('span', {class: 'track-name'}, 'MP3'),
        ]),
      ]),
      h("div", {"class": "drum-controls", "role": "group", "aria-label": "ドラムパート"}, [
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
      h("div", {"class": "bass-controls", "role": "group", "aria-label": "ベースパート"}, [
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
      h("div", {"class": "chord-sound-controls part-controls", "role": "group", "aria-label": "コードの音色とバッキング"}, [
        h("button", {"class": "part-heading track-select", "type": "button", "data-track": "chord", "aria-controls": "detail-chord", "aria-label": "コードの詳細を表示", "title": "コードの設定を表示", "aria-pressed": "true"}, [
          h("svg", {"class": "part-icon", "aria-hidden": "true", "focusable": "false", "viewBox": "0 0 24 24"}, [
            h("rect", {"class": "stamp", "x": "1", "y": "4", "width": "22", "height": "16", "rx": "2"}),
            h("path", {"class": "cut", "d": "M7 10v8m5-8v8m5-8v8"}),
            h("path", {"class": "print", "d": "M5 4h3v8H5zm10 0h3v8h-3z"}),
          ]),
          h("span", {"class": "track-name", "aria-hidden": "true"}, "コード"),
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
      h("div", {"class": "melody-controls", "role": "group", "aria-label": "メロディパート"}, [
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
            h("option", {"value": "all-you"}, "自分で"),
            h("option", {"value": "all-pc"}, "自動演奏"),
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
    ],
  }).mount('#track-grid')
}
