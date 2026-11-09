import { createApp, h, ref } from './vendor/vue.runtime.esm-browser.prod.js'
import { mountAccompanimentPlay, selectStepperView } from './part-steppers.js'
import { ottoAccompanimentStyles } from './progression.js'

export const bassPadNotes = [36, 38, 40, 41, 43, 45, 47, 48]

/** UI adapter for the shared mixer controls. Audio actions stay in the composition root.
 * @param {{
 * progression: import('./progression.js').Progression,
 * mixer: ReturnType<import('./groove.js').createPartMixer>,
 * workspace: HTMLElement, genreSelect: HTMLSelectElement, keySelect: HTMLSelectElement,
 * playAccompanimentPad: (part:'drums'|'bass'|'chord', index:number)=>void,
 * previewChord: (bar:number, beat:number, chord:string, replace?:boolean)=>Promise<void>,
 * animatePartChange: (button:Element|null)=>void,
 * }} dependencies
 */
export function mountQuickMixer({
  progression,
  mixer,
  workspace,
  genreSelect,
  keySelect,
  playAccompanimentPad,
  previewChord,
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
      event.source !== frame?.contentWindow ||
      event.data?.type !== 'oto-pad-chord' ||
      typeof event.data.id !== 'string'
    )
      return
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
    return controls.map((control, index) => {
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
                    else quickAdvanced.add(playable)
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
