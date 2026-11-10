import { mountPlayhead } from './transport-view.js'
import { createKeyPreview } from './reference-key-preview.js'
import { timingGrid } from './reference-timing-grid.js'
import { createApp, h, ref } from './vendor/vue.runtime.esm-browser.prod.js'
import { keyFromDegree, keys, presets } from './music.js'

/**
 * Reference alignment owns its view state; playback and source buffers stay in the engine.
 * @param {HTMLElement} host
 * @param {{
 * reference: ReturnType<import('./main-controls.js').mountReferenceControls>['state'],
 * player: ReturnType<import('./reference-player.js').mountReferencePlayer>,
 * progression: import('./progression.js').Progression,
 * tempo: HTMLInputElement, keySelect: HTMLSelectElement,
 * section: ()=>number, preset: ()=>string, choosePreset: (id:string)=>void,
 * playbackHeads: Map<number,number>, waveformStartBeats: Map<number,number>,
 * playFromBar: (bar:number)=>void,
 * playhead?: import('./transport-view.js').PlayheadActions,
 * bindKnobDrag: (input:HTMLInputElement,sensitivity:number,integer?:boolean)=>void
 * }} options
 */
export function mountReferenceTiming(host, options) {
  const {
    reference,
    player,
    progression,
    tempo,
    keySelect,
    section,
    preset,
    choosePreset,
    playbackHeads,
    waveformStartBeats,
    playFromBar,
    bindKnobDrag,
  } = options
  const view = ref({
    bars: 2,
    page: 0,
    aligned: false,
    dragging: false,
    path: '',
    timing: '0.00 秒',
    playback: '',
    playbackTitle: '',
    near: false,
    both: false,
    checkPlaying: false,
    bpm: Number(tempo.value),
    /** @type {{x:number,height:number,kind:string,bar:number}[]} */
    grid: [],
    /** @type {number|null} */
    selectedX: null,
    /** @type {number|null} */
    hoverX: null,
    /** @type {number|null} */
    speakerX: null,
    root: 0,
    degree: 5,
    matching: false,
    keyRetry: false,
  }).value
  const moodOrder = [5, 3, 0, 1, 2, 4, 6]
  const moodLabels = [
    '6｜哀しげ',
    '4｜切なさ・優しさ',
    '1｜元気・明るい',
    '2',
    '3',
    '5',
    '7',
  ]
  let wasPlaying = false,
    zoomFrame = 0,
    zoomTarget = 2,
    gridSignature = ''
  /** @type {number|null} */
  let selectedBeat = null
  /** @type {{id:number,x:number,value:number,secondsPerPixel:number}|null} */
  let drag = null
  /** @type {SVGSVGElement} */
  let waveform
  /** @type {SVGLineElement} */
  let cursor
  const seconds = () =>
    (60 * view.bars * progression.beatsPerBar) /
    Math.max(40, Number(tempo.value))
  const inferredKey = () => keyFromDegree(view.root, view.degree)

  /** @param {number} value */
  function commitTiming(value) {
    player.setTiming(section(), value)
    view.timing = player.getTiming(section()).toFixed(2) + ' 秒'
    updateTimingPreview()
  }
  function refreshGrid() {
    const signature = `${progression.beatsPerBar}:${view.bars}:${view.page}`
    if (gridSignature === signature) return
    gridSignature = signature
    view.grid = timingGrid(progression.beatsPerBar, view.bars, view.page)
  }
  /** @param {number} beat */
  function beatX(beat) {
    const x =
      ((beat / progression.beatsPerBar - view.page) / view.bars + 0.12) * 1000
    return view.aligned && x >= 0 && x <= 1000 ? x : null
  }
  function renderSelection() {
    if (selectedBeat === null) return
    view.selectedX = beatX(selectedBeat)
    view.speakerX = view.selectedX
  }
  /** @param {number} clientX */
  function waveformBeatAt(clientX) {
    const rect = waveform.getBoundingClientRect()
    return Math.max(
      0,
      Math.min(
        progression.barCount() * progression.beatsPerBar - 1,
        Math.round(
          (((clientX - rect.left) / rect.width - 0.12) * view.bars +
            view.page) *
            progression.beatsPerBar,
        ),
      ),
    )
  }
  function endDrag() {
    drag = null
    view.dragging = false
  }
  /** @param {PointerEvent} event */
  function startDrag(event) {
    if (!event.isPrimary || event.button !== 0) return
    event.preventDefault()
    if (view.aligned) {
      const beats = waveformBeatAt(event.clientX),
        bar = Math.floor(beats / progression.beatsPerBar)
      playbackHeads.set(progression.selectedSection, bar)
      waveformStartBeats.set(
        progression.selectedSection,
        beats % progression.beatsPerBar,
      )
      selectedBeat = beats
      waveform.focus({ preventScroll: true })
      renderSelection()
      if (progression.running) {
        progression.bpm = Number(tempo.value)
        void progression.start(bar, beats % progression.beatsPerBar)
      }
      return
    }
    progression.stop()
    drag = {
      id: event.pointerId,
      x: event.clientX,
      value: player.getTiming(section()),
      secondsPerPixel:
        seconds() / Math.max(1, waveform.getBoundingClientRect().width),
    }
    waveform.setPointerCapture(event.pointerId)
    waveform.focus({ preventScroll: true })
    view.dragging = true
  }
  /** @param {PointerEvent} event */
  function moveDrag(event) {
    if (view.aligned) {
      view.hoverX = beatX(waveformBeatAt(event.clientX))
      view.speakerX = view.hoverX
    } else if (drag && event.pointerId === drag.id) {
      commitTiming(drag.value + (drag.x - event.clientX) * drag.secondsPerPixel)
    }
  }
  function toggleAligned() {
    view.aligned = !view.aligned
    view.speakerX = null
    if (!view.aligned) {
      view.page = 0
      waveformStartBeats.clear()
      selectedBeat = null
      view.selectedX = null
      view.hoverX = null
    }
    endDrag()
    if (view.aligned) {
      selectedBeat = 0
      playbackHeads.set(progression.selectedSection, 0)
      waveformStartBeats.set(progression.selectedSection, 0)
      renderSelection()
    }
    updateTimingPreview()
  }
  function checkRhythm() {
    if (progression.running) {
      progression.stop()
      view.checkPlaying = false
      return
    }
    if (
      !view.aligned &&
      player.timingOnsetNear(section()) &&
      player.timingOnsetNear(
        section(),
        (60 * progression.beatsPerBar) / Math.max(40, Number(tempo.value)),
      )
    )
      toggleAligned()
    playFromBar(0)
    view.checkPlaying = true
  }
  /** @param {number} direction */
  function zoom(direction) {
    zoomTarget = Math.max(
      1,
      Math.min(16, zoomTarget * (direction > 0 ? 2 : 0.5)),
    )
    cancelAnimationFrame(zoomFrame)
    const from = view.bars,
      started = performance.now()
    /** @param {number} now */
    const animate = (now) => {
      const t = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 1
        : Math.min(1, (now - started) / 240)
      view.bars = from + (zoomTarget - from) * (1 - (1 - t) ** 3)
      updateTimingPreview()
      if (t < 1) zoomFrame = requestAnimationFrame(animate)
    }
    zoomFrame = requestAnimationFrame(animate)
  }
  /** @param {number} value */
  function setTempo(value) {
    tempo.value = String(value)
    tempo.dispatchEvent(new Event('input', { bubbles: true }))
  }
  /** @param {KeyboardEvent} event */
  function tempoKey(event) {
    const direction = ['ArrowRight', 'ArrowUp'].includes(event.key)
      ? 1
      : ['ArrowLeft', 'ArrowDown'].includes(event.key)
        ? -1
        : 0
    if (!direction) return
    event.preventDefault()
    setTempo(
      Math.max(40, Math.min(200, Math.round(Number(tempo.value)) + direction)),
    )
  }
  /** @param {boolean} [redraw] */
  function updateTimingPreview(redraw = true) {
    const duration = seconds()
    const elapsed = Math.max(
      0,
      player.getPosition() - player.getTiming(section()),
    )
    const focus =
      view.aligned && reference.playing
        ? elapsed
        : view.aligned && selectedBeat !== null
          ? (selectedBeat * 60) / Math.max(40, Number(tempo.value))
          : 0
    view.page = view.aligned
      ? Math.max(
          0,
          Math.floor((focus / duration) * view.bars - view.bars * 0.75),
        )
      : 0
    refreshGrid()
    if (redraw || !view.path)
      view.path = player.timingWaveform(
        section(),
        duration,
        (view.page / view.bars - 0.12) * duration,
      )
    renderSelection()
    view.near = !view.aligned && player.timingOnsetNear(section())
    view.both =
      view.near &&
      player.timingOnsetNear(
        section(),
        (60 * progression.beatsPerBar) / Math.max(40, Number(tempo.value)),
      )
  }
  const keyPreview = createKeyPreview(player, progression, view)
  const { stop: stopKeyMatch, toggle: listenKey } = keyPreview
  function chooseDegree() {
    const group = String(view.degree + 1)
    if (presets.find((item) => item.id === preset())?.group !== group) {
      const choice = presets.find((item) => item.group === group)
      if (choice) choosePreset(choice.id)
    }
  }
  function applyMatchedKey() {
    const manual = /** @type {HTMLInputElement|null} */ (
      document.querySelector(
        '#detail-melody .otto-play-mode input[value="manual"]',
      )
    )
    if (manual && !manual.checked) {
      manual.checked = true
      manual.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const key = inferredKey(),
      selected = progression.sections[progression.selectedSection]
    if (selected.key !== undefined) selected.key = key
    keySelect.value = String(key)
    keySelect.dispatchEvent(new Event('change', { bubbles: true }))
    for (const id of [
      'reference',
      'drum',
      'melody',
      'bass',
      'chord',
      'bell',
      'pluck',
      'phrase',
      'fx',
    ]) {
      const button = document.getElementById(id + '-solo')
      const wanted = ['reference', 'drum', 'melody'].includes(id)
      if (button && (button.getAttribute('aria-pressed') === 'true') !== wanted)
        button.click()
    }
  }
  /** @param {Event} event */
  function changeRoot(event) {
    view.root = Number(/** @type {HTMLInputElement} */ (event.target).value)
    applyMatchedKey()
    if (view.matching) player.setKeyPreviewRoot(view.root)
  }
  /** @param {Event} event */
  function changeMood(event) {
    view.degree =
      moodOrder[Number(/** @type {HTMLInputElement} */ (event.target).value)]
    chooseDegree()
    applyMatchedKey()
    stopKeyMatch()
  }
  /** @param {string} kind @param {number|null} x */
  const selectionLine = (kind, x) =>
    h('line', {
      class: kind,
      x1: x ?? 0,
      x2: x ?? 0,
      y1: 0,
      y2: 100,
      visibility: x === null ? 'hidden' : 'visible',
    })
  const speakerIcon = () =>
    h(
      'svg',
      {
        viewBox: '0 0 24 24',
        width: 18,
        height: 18,
        fill: 'none',
        stroke: 'currentColor',
        'stroke-width': 1.7,
        'aria-hidden': 'true',
      },
      [
        h('path', { d: 'M4 9h4l5-4v14l-5-4H4z' }),
        h('path', { d: 'M16 8a6 6 0 0 1 0 8M19 5a10 10 0 0 1 0 14' }),
      ],
    )
  const app = createApp({
    render: () => [
      h('div', { class: 'reference-timing-row', hidden: !reference.filename }, [
        h('div', { class: 'timing-waveform-area' }, [
          h(
            'span',
            {
              class: 'wave-position-speaker',
              hidden: view.speakerX === null,
              style: { left: `${(view.speakerX ?? 0) / 10}%` },
              'aria-label': 'ここから再生',
            },
            [speakerIcon()],
          ),
          h(
            'span',
            {
              class: 'waveform-scope-cue',
              hidden: view.aligned,
              'aria-live': 'polite',
            },
            view.both
              ? 'ばっちり！次にすすもう！'
              : view.near
                ? 'いいかんじ！2小節目も合わせてみよう'
                : '波形を掴んで動かしてみよう…',
          ),
          h(
            'svg',
            {
              class: [
                'timing-waveform',
                { aligned: view.aligned, dragging: view.dragging },
              ],
              viewBox: '0 0 1000 100',
              preserveAspectRatio: 'none',
              role: 'img',
              tabindex: 0,
              'aria-label': `原曲の波形（${view.bars}小節、拍グリッド）`,
              'data-playback': view.playback || undefined,
              onPointerdown: startDrag,
              onPointermove: moveDrag,
              onPointerup: endDrag,
              onPointercancel: endDrag,
              onLostpointercapture: endDrag,
              onPointerleave: () => {
                view.hoverX = null
                view.speakerX = null
                renderSelection()
              },
              onKeydown: /** @param {KeyboardEvent} event */ (event) => {
                if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')
                  return
                event.preventDefault()
                commitTiming(
                  player.getTiming(section()) +
                    (event.key === 'ArrowRight' ? 0.01 : -0.01),
                )
              },
            },
            [
              h('rect', {
                width: 1000,
                height: 100,
                fill: 'transparent',
                'pointer-events': 'all',
              }),
              h('path', { d: view.path, transform: 'matrix(1 0 0 .76 0 12)' }),
              ...view.grid.map((line) =>
                h('line', {
                  key: line.x,
                  class: line.kind,
                  x1: line.x,
                  x2: line.x,
                  y1: 0,
                  y2: line.height,
                }),
              ),
              selectionLine('wave-hover-line', view.hoverX),
              selectionLine('wave-selected-line', view.selectedX),
              h('line', {
                class: 'playhead',
                y1: 0,
                y2: 100,
                visibility: 'hidden',
              }),
            ],
          ),
          h('span', { class: 'waveform-pre-roll-mask', 'aria-hidden': 'true' }),
          h(
            'div',
            { class: 'waveform-bar-numbers', 'aria-hidden': 'true' },
            view.grid
              .filter((line) => line.bar > 0)
              .map((line) =>
                h(
                  'span',
                  { key: line.x, style: { left: `${line.x / 10}%` } },
                  `${line.bar}小節`,
                ),
              ),
          ),
          h('span', {
            class: [
              'waveform-reticle',
              { 'on-target': view.near, 'bars-on-target': view.both },
            ],
            'aria-hidden': 'true',
          }),
          h(
            'span',
            { class: 'waveform-beat-target' },
            view.page === 0 ? '1拍目' : `${view.page + 1}小節`,
          ),
          h(
            'div',
            {
              class: 'style-stepper waveform-zoom',
              role: 'group',
              'aria-label': '波形の拡大・縮小',
            },
            [
              h(
                'span',
                { class: 'waveform-zoom-icon', 'aria-hidden': 'true' },
                [
                  h(
                    'svg',
                    {
                      viewBox: '0 0 24 24',
                      width: 16,
                      height: 16,
                      fill: 'none',
                      stroke: 'currentColor',
                      'stroke-width': 1.8,
                    },
                    [
                      h('circle', { cx: 10, cy: 10, r: 6 }),
                      h('path', { d: 'm15 15 5 5' }),
                    ],
                  ),
                ],
              ),
              h(
                'button',
                {
                  type: 'button',
                  disabled: view.bars >= 16,
                  'aria-label': '波形を縮小',
                  onClick: () => zoom(1),
                },
                '−',
              ),
              h(
                'button',
                {
                  type: 'button',
                  disabled: view.bars <= 1,
                  'aria-label': '波形を拡大',
                  onClick: () => zoom(-1),
                },
                '＋',
              ),
            ],
          ),
        ]),
        h('div', { class: 'reference-timing-control' }, [
          h('output', { title: view.playbackTitle }, view.timing),
          h('div', { class: 'timing-tempo-controls', hidden: view.aligned }, [
            h('label', { class: 'timing-tempo-knob' }, [
              'テンポ',
              h(
                'span',
                {
                  class: 'volume-knob',
                  style: {
                    '--angle': `${-135 + ((view.bpm - 40) / 160) * 270}deg`,
                  },
                },
                [
                  h('input', {
                    type: 'range',
                    min: 40,
                    max: 200,
                    step: 0.1,
                    value: view.bpm,
                    'aria-label': '位置合わせのテンポ',
                    onInput: /** @param {Event} event */ (event) =>
                      setTempo(
                        Math.round(
                          Number(
                            /** @type {HTMLInputElement} */ (event.target)
                              .value,
                          ),
                        ),
                      ),
                    onKeydown: tempoKey,
                  }),
                  h('span', { 'aria-hidden': 'true' }),
                ],
              ),
              h('output', String(view.bpm)),
            ]),
            h(
              'div',
              {
                class: 'timing-tempo-multipliers',
                role: 'group',
                'aria-label': 'テンポの半分・2倍',
              },
              [0.5, 2].map((factor) =>
                h(
                  'button',
                  {
                    type: 'button',
                    'data-factor': factor,
                    title:
                      factor === 0.5
                        ? 'テンポを半分にする'
                        : 'テンポを2倍にする',
                    'aria-label':
                      factor === 0.5
                        ? 'テンポを半分にする'
                        : 'テンポを2倍にする',
                    disabled: view.bpm * factor < 40 || view.bpm * factor > 200,
                    onClick: () => {
                      const value =
                        Math.round(Number(tempo.value) * factor * 10) / 10
                      if (value >= 40 && value <= 200) setTempo(value)
                    },
                  },
                  factor === 0.5 ? '½' : '×2',
                ),
              ),
            ),
          ]),
          h('div', { class: 'reference-playhead-host' }),
          h(
            'button',
            {
              type: 'button',
              class: 'reference-remove-key',
              onClick: checkRhythm,
            },
            view.checkPlaying ? '■ 停止' : '▶ 聴いて確認',
          ),
          h(
            'button',
            {
              type: 'button',
              class: 'reference-remove-key',
              hidden: !view.aligned,
              onClick: toggleAligned,
            },
            '合わせ直す',
          ),
        ]),
      ]),
      h(
        'section',
        {
          class: 'reference-key-assist',
          'aria-label': '耳でキーを合わせる',
          hidden: !reference.filename,
        },
        [
          h(
            'button',
            {
              type: 'button',
              class: 'reference-remove-key key-listen',
              'aria-pressed': view.matching,
              onClick: listenKey,
            },
            [
              h('span', view.keyRetry
                ? '再試行：最初の1拍を聴く'
                : view.matching
                  ? '■ 聴き比べを停止'
                  : '▶ 最初の1拍を聴き比べる'),
              ...['再試行：最初の1拍を聴く', '■ 聴き比べを停止', '▶ 最初の1拍を聴き比べる']
                .map(label => h('span', {class: 'key-listen-measure', 'aria-hidden': 'true'}, label)),
            ],
          ),
          h('label', { class: 'key-match-control' }, [
            'ルート音',
            h(
              'span',
              {
                class: 'volume-knob',
                style: { '--angle': `${-135 + (view.root / 11) * 270}deg` },
              },
              [
                h('input', {
                  type: 'range',
                  min: 0,
                  max: 11,
                  step: 1,
                  value: view.root,
                  'aria-label': '聴き比べるルート音',
                  onInput: changeRoot,
                }),
                h('span', { 'aria-hidden': 'true' }),
              ],
            ),
            h('output', keys[view.root].name),
          ]),
          h('label', { class: 'key-match-control mood-control' }, [
            '雰囲気',
            h(
              'span',
              {
                class: 'volume-knob',
                style: {
                  '--angle': `${-135 + (Math.max(0, moodOrder.indexOf(view.degree)) / 6) * 270}deg`,
                },
              },
              [
                h('input', {
                  type: 'range',
                  min: 0,
                  max: 6,
                  step: 1,
                  value: Math.max(0, moodOrder.indexOf(view.degree)),
                  'aria-label': '雰囲気',
                  onInput: changeMood,
                }),
                h('span', { 'aria-hidden': 'true' }),
              ],
            ),
            h(
              'output',
              moodLabels[Math.max(0, moodOrder.indexOf(view.degree))],
            ),
          ]),
          h(
            'output',
            { class: 'key-match-result', 'aria-live': 'polite' },
            `キー ${keys[inferredKey()].name}`,
          ),
        ],
      ),
    ],
  })
  app.mount(host)
  waveform = /** @type {SVGSVGElement} */ (
    host.querySelector('.timing-waveform')
  )
  cursor = /** @type {SVGLineElement} */ (waveform.querySelector('.playhead'))
  for (const [
    selector,
    sensitivity,
    integer,
  ] of /** @type {[string,number,boolean][]} */ ([
    ['.timing-tempo-knob input', 0.5, true],
    [
      '.reference-key-assist input[aria-label="聴き比べるルート音"]',
      0.1,
      false,
    ],
    ['.mood-control input', 0.08, false],
  ]))
    bindKnobDrag(
      /** @type {HTMLInputElement} */ (host.querySelector(selector)),
      sensitivity,
      integer,
    )
  const listeners = new window.AbortController()
  const playheadHost = host.querySelector('.reference-playhead-host')
  const playhead = options.playhead && playheadHost
    ? mountPlayhead(options.playhead, playheadHost)
    : undefined
  window.addEventListener('blur', endDrag, {signal: listeners.signal})
  document.addEventListener('reference-removed', endDrag, {signal: listeners.signal})
  document.addEventListener('reference-playback-start', (event) => {
    const detail =
      /** @type {CustomEvent<{section:number,adjustment:number,sourceOffset:number,scheduledTime:number,stemOffsets:number[]}>} */ (
        event
      ).detail
    view.playback = JSON.stringify(detail)
    view.playbackTitle = `直近の再生：${'ABCD'[detail.section]} / 調整 ${detail.adjustment.toFixed(2)} 秒 / 原曲 ${detail.sourceOffset.toFixed(3)} 秒`
  }, {signal: listeners.signal})
  document.addEventListener('reference-timing-refresh', () => {
    updateTimingPreview()
    queueMicrotask(() => {
      if (listeners.signal.aborted) return
      view.timing = player.getTiming(section()).toFixed(2) + ' 秒'
      updateTimingPreview()
    })
    stopKeyMatch()
  }, {signal: listeners.signal})
  tempo.addEventListener('input', () => {
    view.bpm = Number(tempo.value)
    updateTimingPreview()
    stopKeyMatch()
  }, {signal: listeners.signal})
  document.addEventListener('reference-loaded', () => {
    progression.referenceBpm = Number(tempo.value)
    view.page = 0
    tempo.dispatchEvent(new Event('input', { bubbles: true }))
    stopKeyMatch()
    view.root = (Number(keySelect.value) + 9) % 12
    view.degree = 5
    chooseDegree()
  }, {signal: listeners.signal})
  document.addEventListener('reference-removed', () => {
    progression.referenceBpm = null
    tempo.dispatchEvent(new Event('input', { bubbles: true }))
    stopKeyMatch()
  }, {signal: listeners.signal})
  document.addEventListener('reference-analysis-ready', () => {
    view.root = (Number(keySelect.value) + 9) % 12
  }, {signal: listeners.signal})
  document.addEventListener('key-preview-stopped', stopKeyMatch, {signal: listeners.signal})
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopKeyMatch()
  }, {signal: listeners.signal})
  document.addEventListener('reference-position', (event) => {
    const detail =
      /** @type {CustomEvent<{position:number,playing:boolean}>} */ (event)
        .detail
    if (detail.playing && !wasPlaying) {
      updateTimingPreview()
    }
    wasPlaying = detail.playing
    if (detail.playing && reference.filename) {
      const duration = seconds(),
        elapsed = detail.position - player.getTiming(section())
      const nextPage = view.aligned
        ? Math.max(
            0,
            Math.floor(
              (Math.max(0, elapsed) / duration) * view.bars - view.bars * 0.75,
            ),
          )
        : 0
      if (nextPage !== view.page) updateTimingPreview()
      const x = Math.max(
        0,
        Math.min(
          1000,
          ((elapsed - (view.page / view.bars) * duration) / duration + 0.12) *
            1000,
        ),
      )
      // Only the visual playhead follows frame events; the engine remains the audio clock.
      cursor.setAttribute('x1', String(x))
      cursor.setAttribute('x2', String(x))
      cursor.setAttribute('visibility', 'visible')
    } else cursor.setAttribute('visibility', 'hidden')
  }, {signal: listeners.signal})
  updateTimingPreview()
  function unmount() {
    if (listeners.signal.aborted) return
    listeners.abort()
    playhead?.unmount()
    if (zoomFrame) cancelAnimationFrame(zoomFrame)
    endDrag()
    stopKeyMatch()
    app.unmount()
  }
  return { updateTimingPreview, unmount, playhead }
}
