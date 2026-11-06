import { createApp, h } from './vendor/vue.runtime.esm-browser.prod.js'

/** @typedef {{ play: (bar: number) => void, modulate: (section: number, amount: number) => void,
 * root: (bar: number, beat: number, value: string) => void,
 * quality: (bar: number, beat: number, select: HTMLSelectElement) => void,
 * openQuality: (select: HTMLSelectElement, bar: number, beat: number) => void,
 * refresh: () => void, preview: (bar: number, beat: number) => void }} Actions */

/** Mount the score controls. Native selects remain the bridge to the choice menus.
 * @param {number} bars @param {Actions} actions */
export function mountChordGrid(bars, actions) {
  /** @param {number} bar */
  function modulation(bar) {
    const pair = `${bar + 1}〜${bar + 2}小節`
    return h('div', { class: 'modulation-bar', role: 'group', 'aria-label': pair + 'の設定' }, [
      h('div', { class: 'bar-play-controls' }, [bar, bar + 1].map(index => {
        const label = `${index + 1}小節の先頭から再生`
        return h('button', { type: 'button', title: label, 'aria-label': label, onClick: () => actions.play(index) }, '▶')
      })),
      h('span', '転調'),
      h('output', { class: 'modulation-value', 'aria-live': 'polite' }),
      h('div', { class: 'key-stepper modulation-stepper', role: 'group', 'aria-label': pair + 'のキーを半音ずつ変更' }, [
        h('button', { type: 'button', class: 'modulation-down', 'aria-label': pair + 'のキーを半音下げる', onClick: () => actions.modulate(bar / 2, -1) }, '−'),
        h('button', { type: 'button', class: 'modulation-up', 'aria-label': pair + 'のキーを半音上げる', onClick: () => actions.modulate(bar / 2, 1) }, '＋'),
      ]),
    ])
  }

  /** @param {number} bar @param {number} beat */
  function cell(bar, beat) {
    const label = `${bar + 1}小節 ${beat + 1}拍目`
    /** @param {Event} event */
    function open(event) {
      event.preventDefault()
      actions.openQuality(/** @type {HTMLSelectElement} */ (event.currentTarget), bar, beat)
    }
    return h('div', { class: 'base-chord beat-chord' }, [
      h('span', { class: 'root-wrapper' }, [
        h('span', { class: 'root-display', 'aria-hidden': 'true' }),
        h('select', {
          class: 'root-select', 'aria-label': label + 'のルート',
          onChange: (/** @type {Event} */ event) => actions.root(bar, beat, /** @type {HTMLSelectElement} */ (event.currentTarget).value),
        }),
      ]),
      h('select', {
        class: 'quality-select',
        onChange: (/** @type {Event} */ event) => actions.quality(bar, beat, /** @type {HTMLSelectElement} */ (event.currentTarget)),
        onBlur: actions.refresh,
        onPointerdown: open,
        onKeydown: (/** @type {KeyboardEvent} */ event) => {
          if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(event.key)) open(event)
        },
      }),
      h('button', {
        type: 'button', class: 'chord-preview', title: 'コードを試聴',
        'aria-label': label + 'のコードを試聴', onClick: () => actions.preview(bar, beat),
      }, [h('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true', focusable: 'false' }, [
        h('path', { d: 'M4 10h4l5-4v12l-5-4H4zM16 9c1.5 1.5 1.5 4.5 0 6M19 6c3.5 3 3.5 9 0 12' }),
      ])]),
    ])
  }

  createApp({
    render: () => Array.from({ length: bars }, (_, bar) => [
      ...(bar % 2 === 0 ? [modulation(bar)] : []),
      h('div', { class: ['chord-slot', { 'first-in-pair': bar % 2 === 0 }] }, [
        h('span', { class: 'bar-label' }, String(bar + 1)),
        ...Array.from({ length: 4 }, (_, beat) => cell(bar, beat)),
      ]),
    ]).flat(),
  }).mount('#chord-slots')
  return Array.from(document.querySelectorAll('#chord-slots .chord-slot'), element => /** @type {HTMLElement} */ (element))
}
