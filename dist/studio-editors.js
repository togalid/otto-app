import { melodyPresets } from './melody-presets.js'
import { mountMelodyVoiceChoice } from './part-steppers.js'
import { rootPitch } from './music.js'

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
 *   previewDrum: NonNullable<EditorOptions['previewDrum']>,
 *   bassTimbre: HTMLSelectElement,
 *   onMelodyMounted: (editor: StudioEditor) => void,
 *   onBassMounted: (editor: StudioEditor) => void,
 *   onAccompanimentMounted: (part:'backing'|'drums', editor:StudioEditor) => void,
 * }} options
 */
export function mountStudioEditors({
  progression, seekMelodyBar, togglePlayback, readChordRevision, displayParts,
  previewTimbre, previewBass, previewDrum, bassTimbre, onMelodyMounted, onBassMounted, onAccompanimentMounted,
}) {
  const studioMelodyHost = document.createElement('section')
  studioMelodyHost.className = 'melody-arrange tutorial-screen studio-melody-editor'
  studioMelodyHost.setAttribute('aria-label', 'メロディを編集')
  document.querySelector('#detail-melody')?.append(studioMelodyHost)
  void import('./melody-arrange.js').then(({mountMelodyEditor}) => {
    /** @type {Parameters<typeof mountMelodyEditor>[1]} */
    const editorOptions = {
      empty:true,
      paginationTarget:'#melody-score-pagination',
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
    const editor = mountMelodyEditor(studioMelodyHost, {...editorOptions, previewTimbre, rhythmPalette:true})
    onMelodyMounted(editor)
    progression.studioMelody = () => {
      const notes = editor.getNotes()
      return notes.length ? notes : melodyPresets[progression.genre] ?? []
    }
    for (const [part, label] of /** @type {const} */ ([['backing', 'バッキング'], ['drums', 'ドラム']])) {
      const host = document.createElement('section')
      host.className = studioMelodyHost.className
      host.dataset.studioPart = part
      host.setAttribute('aria-label', label + 'を編集')
      document.querySelector('.studio-accompaniment-scores')?.append(host)
      const editor = mountMelodyEditor(host, {
        ...editorOptions, part, paginationTarget:part === 'drums' ? '#drum-score-pagination' : '#backing-score-pagination', previewDrum:part === 'drums' ? previewDrum : undefined,
        keyForBar:part === 'drums' ? undefined : editorOptions.keyForBar,
      })
      onAccompanimentMounted(part, editor)
    }
    const bassDetail = document.querySelector('#detail-bass')
    if (!bassDetail) return
    const bassControls = document.createElement('div')
    bassControls.className = 'melody-choice-row bass-choice-row'
    const {element: bassVoiceChoice} = mountMelodyVoiceChoice(bassTimbre, 'ベース')
    const bassToneButton = document.createElement('div')
    bassToneButton.id = 'bass-tone-button-host'
    const bassPagination = document.createElement('div')
    bassPagination.id = 'bass-score-pagination'
    bassControls.append(bassVoiceChoice, bassToneButton, bassPagination)
    const bassHost = document.createElement('section')
    bassHost.className = studioMelodyHost.className
    bassHost.setAttribute('aria-label', 'ベースを編集')
    bassDetail.prepend(bassControls)
    bassDetail.append(bassHost)
    document.dispatchEvent(new Event('bass-editor-ready'))
    const bassEditor = mountMelodyEditor(bassHost, {
      ...editorOptions,
      part:'bass',
      paginationTarget:'#bass-score-pagination',
      previewBass,
      rootForBeat:beat => {
        readChordRevision()
        const bar = Math.max(0, Math.min(progression.barCount() - 1, Math.floor(beat / 4)))
        const section = progression.songMode ? progression.songSectionAt(bar) : progression.selectedSection
        const score = progression.sections[section]
        let slot = Math.min(progression.chordBeatsForBar(bar) - 1, Math.floor(Math.max(0, beat - bar * 4) * progression.chordBeatsForBar(bar) / 4))
        let chord = slot > 0 ? score.beatSlots[bar]?.[slot] : score.slots[bar]
        while (!chord && slot > 0) {
          slot--
          chord = slot > 0 ? score.beatSlots[bar]?.[slot] : score.slots[bar]
        }
        return chord ? (rootPitch(chord) + progression.keyForBar(bar, section) + 12) % 12 : null
      },
    })
    bassEditor.initializeBass()
    onBassMounted(bassEditor)
    progression.studioBass = bassEditor.getPlaybackNotes
  })
}
