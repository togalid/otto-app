import { melodyPresets } from './melody-presets.js'
import { mountMelodyVoiceChoice } from './part-steppers.js'

/** @typedef {ReturnType<typeof import('./melody-arrange.js').mountMelodyEditor>} StudioEditor */
/** @typedef {NonNullable<Parameters<typeof import('./melody-arrange.js').mountMelodyEditor>[1]>} EditorOptions */

/**
 * @param {{
 *   progression: import('./progression.js').Progression,
 *   seekMelodyBar: NonNullable<EditorOptions['selectBar']>,
 *   togglePlayback: NonNullable<EditorOptions['togglePlayback']>,
 *   readChordRevision: () => number,
 *   displayParts: (id: string, key: number) => {main:string, suffix:string},
 *   previewTimbre: NonNullable<EditorOptions['previewTimbre']>,
 *   previewBass: NonNullable<EditorOptions['previewBass']>,
 *   bassTimbre: HTMLSelectElement,
 *   onMelodyMounted: (editor: StudioEditor) => void,
 *   onBassMounted: (editor: StudioEditor) => void,
 * }} options
 */
export function mountStudioEditors({
  progression, seekMelodyBar, togglePlayback, readChordRevision, displayParts,
  previewTimbre, previewBass, bassTimbre, onMelodyMounted, onBassMounted,
}) {
  const studioMelodyHost = document.createElement('section')
  studioMelodyHost.className = 'melody-arrange tutorial-screen studio-melody-editor'
  studioMelodyHost.setAttribute('aria-label', 'メロディを編集')
  document.querySelector('#detail-melody')?.append(studioMelodyHost)
  void import('./melody-arrange.js').then(({mountMelodyEditor}) => {
    /** @type {Parameters<typeof mountMelodyEditor>[1]} */
    const editorOptions = {
      empty:true,
      defaultKeyboardOctaves:window.matchMedia('(min-width: 701px)').matches ? 2 : 1,
      barCount:()=>progression.barCount(),
      selectBar:seekMelodyBar,
      keyForBar:bar=>{
        readChordRevision()
        return progression.keyForBar(bar)
      },
      chordChanges(bar) {
        readChordRevision()
        if (bar >= progression.barCount()) return []
        const key = progression.keyForBar(bar)
        return Array.from({length: Math.min(4 / progression.chordBeatLength(bar), progression.chordBeatsForBar(bar))}, (_, beat) => {
          const id = beat === 0 ? progression.slots[bar] : progression.beatSlots[bar]?.[beat]
          if (!id) return null
          const {main, suffix} = displayParts(id, key)
          return {beat, position: beat * progression.chordBeatLength(bar), label: main + suffix}
        }).filter(change => change !== null)
      },
      togglePlayback,
    }
    const editor = mountMelodyEditor(studioMelodyHost, {...editorOptions, previewTimbre})
    onMelodyMounted(editor)
    progression.studioMelody = () => {
      const notes = editor.getNotes()
      return notes.length ? notes : melodyPresets[progression.genre] ?? []
    }
    const bassDetail = document.querySelector('#detail-bass')
    if (!bassDetail) return
    const bassControls = document.createElement('div')
    bassControls.className = 'melody-choice-row bass-choice-row'
    const {element: bassVoiceChoice} = mountMelodyVoiceChoice(bassTimbre, 'ベース')
    bassControls.append(bassVoiceChoice)
    const bassHost = document.createElement('section')
    bassHost.className = studioMelodyHost.className
    bassHost.setAttribute('aria-label', 'ベースを編集')
    bassDetail.append(bassControls, bassHost)
    const bassEditor = mountMelodyEditor(bassHost, {
      ...editorOptions,
      part:'bass',
      previewBass,
    })
    onBassMounted(bassEditor)
    progression.studioBass = bassEditor.getNotes
  })
}
