import { createApp, h, ref } from './vendor/vue.runtime.esm-browser.prod.js'
import { backingEvents, backingArticulation } from './backing.js'

/** @param {import('./progression.js').Progression} progression
 * @param {{value:number}} editingSection @param {HTMLInputElement} meterInput
 * @param {()=>void} refreshLabels */
export function createBackingDetail(
  progression,
  editingSection,
  meterInput,
  refreshLabels,
) {
  const backingPanel = document.createElement('section')
  backingPanel.id = 'detail-backing'
  backingPanel.hidden = false
  backingPanel.innerHTML = '<h2>バッキングを調整しよう。</h2>'
  document.querySelector('.track-details')?.append(backingPanel)
  const backingDetailSelect = /** @type {HTMLSelectElement} */ (
    document.getElementById('chord-backing')
  )
  const backingEditorRevision = ref(0)
  const backingEditorHost = document.createElement('div')
  backingEditorHost.className = 'backing-step-editor'
  backingPanel.append(backingEditorHost)
  backingDetailSelect.addEventListener('change', () => {
    delete progression.sections[editingSection.value].backingSteps
    backingEditorRevision.value++
  })
  function mount() {
    createApp({
      render: () => {
        backingEditorRevision.value
        const section = progression.sections[editingSection.value]
        const beats = section.meter ?? Number(meterInput.value)
        const expression = section.backingExpression ?? {
          length: 50,
          dynamics: 50,
        }
        const baseEvents = section.backingSteps
          ? section.backingSteps.flatMap((step, index) =>
              step.enabled
                ? [
                    {
                      beat: index / 4,
                      duration: step.duration,
                      level: step.level,
                    },
                  ]
                : [],
            )
          : backingEvents([60, 64, 67], backingDetailSelect.value, 48).filter(
              (event) => event.beat < beats,
            )
        const range = (
          /** @type {'length'|'dynamics'} */ key,
          /** @type {string} */ label,
        ) =>
          h('label', { class: 'bass-range' }, [
            h('span', label),
            h('span', { class: 'bass-range-value' }, [
              h('input', {
                type: 'range',
                min: 0,
                max: 100,
                step: 1,
                value: expression[key],
                'aria-label': `バッキングの${label}`,
                onInput: (/** @type {Event} */ event) => {
                  section.backingExpression = {
                    ...expression,
                    [key]: Number(
                      /** @type {HTMLInputElement} */ (event.target).value,
                    ),
                  }
                  backingEditorRevision.value++
                },
              }),
              h('output', `${expression[key]}%`),
            ]),
          ])
        return [
          h('label', { class: 'bass-range' }, [
            h('span', 'ボイシング'),
            h(
              'select',
              {
                'aria-label': 'バッキングのボイシング',
                value: expression.voicing ?? 'auto',
                onChange: (/** @type {Event} */ event) => {
                  section.backingExpression = {
                    ...expression,
                    voicing: /** @type {HTMLSelectElement} */ (event.target)
                      .value,
                  }
                  backingEditorRevision.value++
                  refreshLabels()
                },
              },
              [
                ['auto', 'おすすめ'],
                ['closed', 'クローズ'],
                ['open', 'オープン'],
              ].map(([value, label]) => h('option', { value }, label)),
            ),
          ]),
          h('div', { class: 'backing-adjustments' }, [
            h('div', { class: 'bass-expression' }, [
              range('length', '音の長さ'),
              range('dynamics', 'アクセント'),
              h('label', { class: 'bass-range' }, [
                h('span', '奏法'),
                h(
                  'select',
                  {
                    'aria-label': 'バッキングの奏法',
                    value: expression.touch ?? 'block',
                    onChange: (/** @type {Event} */ event) => {
                      section.backingExpression = {
                        ...expression,
                        touch: /** @type {HTMLSelectElement} */ (event.target)
                          .value,
                      }
                      backingEditorRevision.value++
                    },
                  },
                  [
                    ['block', '同時に鳴らす'],
                    ['cutting', 'カッティング'],
                    ['strum', 'ストラム'],
                  ].map(([value, label]) => h('option', { value }, label)),
                ),
              ]),
            ]),
            h('div', { class: 'backing-preview' }, [
              h('span', '1小節目のリズム'),
              h(
                'svg',
                {
                  viewBox: `0 0 ${beats * 80} 56`,
                  role: 'img',
                  'aria-label': 'バッキングのリズムプレビュー',
                },
                [
                  ...Array.from({ length: beats + 1 }, (_, i) =>
                    h('path', { class: 'bass-grid', d: `M${i * 80} 0v56` }),
                  ),
                  ...baseEvents.map((event) => {
                    const a = backingArticulation(
                      event.duration,
                      event.level ?? 1,
                      expression,
                    )
                    return h('rect', {
                      class: 'bass-note',
                      x: event.beat * 80,
                      y: 24,
                      width: Math.max(
                        2,
                        Math.min(a.duration, beats - event.beat) * 80 - 2,
                      ),
                      height: 8,
                      rx: 3,
                      opacity: Math.max(0.15, a.level),
                    })
                  }),
                ],
              ),
            ]),
          ]),
        ]
      },
    }).mount(backingEditorHost)
  }

  return { revision: backingEditorRevision, mount }
}
