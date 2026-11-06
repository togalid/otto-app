import { createApp, h, ref } from './vendor/vue.runtime.esm-browser.prod.js'

export function mountReferenceControls() {
  const state = ref({
    duration: 0, position: 0, head: '0', ruler: '0', region: false, regionLabel: '',
    bandStyle: {left: '0%', width: '0%'}, clock: '0:00.0 / 0:00.0',
    message: '', result: '', splitStatus: '', stems: false,
    dragging: false, matching: false, playing: false, starting: false,
    enabledStems: [true, true, true, true],
  }).value
  const playbackPosition = {render: () => [
    h("input", {"id": "ref-seek", "type": "range", "min": "0", "max": state.duration || 1, "step": "0.01", "value": state.position, "aria-label": "お手本の再生位置"}),
    h("output", {"id": "ref-clock"}, state.clock),
  ]}
  createApp({
    render: () => [
      h("summary", null, "お手本 · MP3を読み込む"),
      h("label", {"class": ["reference-drop", {dragging: state.dragging}], "id": "ref-drop"}, [
        h("input", {"id": "ref-file", "type": "file", "accept": "audio/*,.mp3"}),
        h("span", null, [
          "音声ファイルをここにドロップ",
          h("br", null),
          "またはクリックして選択",
        ]),
      ]),
      h("p", {"id": "ref-status", "role": "status"}, state.message),
      h("fieldset", {"disabled": !state.duration}, [
        h("legend", {"class": "sr-only"}, "お手本の再生"),
        h("div", {"class": "reference-row"}, [
          h("button", {"id": "ref-region", "type": "button"}, "再生位置を8小節の頭に"),
          h("label", null, [
            "頭（秒）",
            h("input", {"id": "ref-head", "type": "number", "min": "0", "step": "0.001", "max": state.duration || 1, "value": state.head}),
          ]),
          h("button", {"id": "ref-apply", "type": "button", "disabled": !state.region || state.matching}, "合わせる"),
        ]),
        h("div", {"class": "reference-row"}, [
          h("output", {"id": "ref-bpm-result", "role": "status"}, state.result),
          h("output", {"id": "ref-split-status", "role": "status"}, state.splitStatus),
        ]),
        h("div", {"id": "ref-stems", "class": "reference-row", "style": {display: state.stems ? "" : "none"}}, [
          h("label", null, [
            h("input", {"type": "checkbox", "checked": state.enabledStems[0]}),
            "歌",
          ]),
          h("label", null, [
            h("input", {"type": "checkbox", "checked": state.enabledStems[1]}),
            "ドラム",
          ]),
          h("label", null, [
            h("input", {"type": "checkbox", "checked": state.enabledStems[2]}),
            "ベース",
          ]),
          h("label", null, [
            h("input", {"type": "checkbox", "checked": state.enabledStems[3]}),
            "その他",
          ]),
        ]),
        h("div", {"class": "reference-ruler"}, [
          h("output", {"id": "ref-region-label"}, state.regionLabel),
          h("div", {"class": "reference-timeline"}, [
            h("div", {"id": "ref-band", "hidden": !state.region, "style": state.bandStyle, "aria-hidden": "true"}),
            h("input", {"id": "ref-ruler", "type": "range", "min": "0", "max": state.duration || 1, "step": "0.001", "value": state.ruler, "aria-label": "8小節の開始位置"}),
          ]),
        ]),
        h("div", {"class": "reference-row"}, [
          h("button", {"id": "ref-play", "type": "button", "disabled": state.starting}, state.playing ? "Ⅱ 一時停止" : "▶ お手本を再生"),
          h(playbackPosition),
          h("label", null, [
            "原曲の音量",
            h("input", {"id": "ref-volume", "type": "range", "min": "0", "max": "1", "step": "0.01", "value": "0.5"}),
          ]),
        ]),
      ]),
    ],
  }).mount('#reference-player')
  return state
}

export function mountBasicParts() {
  createApp({
    render: () => [
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
            h("option", {"value": "all-you"}, "自分が弾く"),
            h("option", {"value": "all-pc"}, "Ottoが弾く"),
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
