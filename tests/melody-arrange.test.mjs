import test from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'

test('a half note entered on beat four displays tied quarter notes and stays one playback event', async () => {
  const dom = new JSDOM('<div class="melody-choice-row"></div><div id="editor"></div>', {pretendToBeVisual:true})
  const globals = ['window', 'document', 'Element', 'SVGElement', 'HTMLElement', 'HTMLInputElement', 'Event', 'matchMedia', 'cancelAnimationFrame', 'requestAnimationFrame']
  const previous = globals.map(name => Object.getOwnPropertyDescriptor(globalThis, name))
  globals.forEach(name => Object.defineProperty(globalThis, name, {configurable:true, writable:true, value:dom.window[name]}))
  globalThis.matchMedia = () => ({matches:true})
  let editor
  try {
    const {mountMelodyEditor} = await import('../dist/melody-arrange.js')
    const {nextTick, ref} = await import('../dist/vendor/vue.runtime.esm-browser.prod.js')
    const host = document.querySelector('#editor')
    editor = mountMelodyEditor(host, {empty:true, togglePlayback() {}})
    assert.equal(editor.isRecordingEnabled(), false)
    host.querySelector('[aria-label="メロディ入力"]').click()
    editor.setNotes([{beat:0,duration:.5,midi:60}, {beat:.5,duration:.5,midi:60}, {beat:1,duration:.5,midi:62}])
    await nextTick()
    const firstNote = host.querySelector('.arrange-note[data-note-index="0"]')
    firstNote.focus()
    firstNote.click()
    await nextTick()
    let propagated = 0
    const downstreamKeyHandler = () => { propagated++ }
    document.addEventListener('keydown', downstreamKeyHandler)
    document.activeElement.dispatchEvent(new dom.window.KeyboardEvent('keydown', {code:'KeyA', bubbles:true, cancelable:true}))
    assert.equal(editor.getNotes()[0].duration, .25)
    document.activeElement.dispatchEvent(new dom.window.KeyboardEvent('keydown', {code:'KeyS', bubbles:true, cancelable:true}))
    assert.equal(editor.getNotes()[0].duration, .5)
    assert.equal(propagated, 0)
    document.removeEventListener('keydown', downstreamKeyHandler)
    document.activeElement.dispatchEvent(new dom.window.KeyboardEvent('keydown', {code:'KeyS', bubbles:true, cancelable:true}))
    assert.equal(editor.getNotes()[0].duration, .5)
    document.activeElement.dispatchEvent(new dom.window.KeyboardEvent('keydown', {key:'ArrowUp', bubbles:true, cancelable:true}))
    assert.equal(editor.getNotes()[0].midi, 61)
    document.activeElement.dispatchEvent(new dom.window.KeyboardEvent('keydown', {key:'ArrowDown', bubbles:true, cancelable:true}))
    assert.equal(editor.getNotes()[0].midi, 60)
    await nextTick()
    assert.equal(host.querySelector('[aria-label="次の同じ音につなぐ"]').disabled, false)
    document.activeElement.dispatchEvent(new dom.window.KeyboardEvent('keydown', {key:'ArrowRight', bubbles:true, cancelable:true}))
    await nextTick()
    assert.equal(host.querySelector('.arrange-note[data-note-index="1"]').getAttribute('aria-pressed'), 'true')
    assert.equal(host.querySelector('[aria-label="直前の音を伸ばす"]').disabled, true)
    document.activeElement.dispatchEvent(new dom.window.KeyboardEvent('keydown', {key:'ArrowLeft', bubbles:true, cancelable:true}))
    await nextTick()
    host.querySelector('[aria-label="次の同じ音につなぐ"]').click()
    await nextTick()
    assert.deepEqual(editor.getNotes().map(({beat,duration,midi}) => ({beat,duration,midi})), [{beat:0,duration:1,midi:60}, {beat:1,duration:.5,midi:62}])
    editor.setNotes([{beat:0,duration:.5,midi:60}, {beat:.5,duration:.5,midi:62}, {beat:1,duration:.5,midi:64}])
    await nextTick()
    const lastNote = host.querySelector('.arrange-note[data-note-index="2"]')
    lastNote.focus()
    lastNote.click()
    await nextTick()
    assert.equal(lastNote.getAttribute('aria-pressed'), 'true')
    document.activeElement.dispatchEvent(new dom.window.KeyboardEvent('keydown', {key:'Delete', bubbles:true, cancelable:true}))
    await nextTick()
    assert.equal(host.querySelector('.arrange-note[data-note-index="1"]').getAttribute('aria-pressed'), 'true')
    document.activeElement.dispatchEvent(new dom.window.KeyboardEvent('keydown', {key:'Delete', bubbles:true, cancelable:true}))
    await nextTick()
    assert.deepEqual(editor.getNotes().map(note => note.midi), [60])
    assert.equal(host.querySelector('.arrange-note[data-note-index="0"]').getAttribute('aria-pressed'), 'true')
    editor.setNotes([])
    await nextTick()
    assert.equal(host.querySelectorAll('.arrange-staff:first-of-type .arrange-beat').length, 16)
    host.querySelector('[aria-label="1小節目 1.5拍から入力"]').click()
    editor.midiAttack(60)
    assert.equal(editor.getNotes()[0].beat, .5)
    editor.setNotes([])
    await nextTick()
    host.querySelector('[aria-label="1小節目 1拍から入力"]').click()
    await nextTick()
    const rhythmButton = host.querySelector('.arrange-swing-step')
    rhythmButton.click()
    editor.midiAttack(60)
    editor.midiAttack(62)
    editor.midiAttack(64)
    await nextTick()
    assert.deepEqual(editor.getNotes().map(({beat,duration}) => [beat,duration]), [[0,.75],[.75,.25],[1,.5]])
    assert.equal(rhythmButton.getAttribute('aria-pressed'), 'false')
    assert.equal(host.querySelectorAll('.arrange-note-beam').length, 2)
    for (const base of [.25, .5, 1]) {
      for (const [label, ratio] of [['タータ', 1.5], ['タカー', .5]]) {
        editor.setNotes([])
        await nextTick()
        const durationSelect = host.querySelector('[aria-label="音価を選択"]')
        assert.deepEqual([...durationSelect.options].map(option => option.value), ['0.25','0.5','1','2'])
        durationSelect.value = String(base)
        durationSelect.dispatchEvent(new dom.window.Event('change', {bubbles:true}))
        host.querySelector('[aria-label="1小節目 1拍から入力"]').click()
        await nextTick()
        host.querySelector(`[aria-label="${label}"]`).click()
        editor.midiAttack(60)
        editor.midiAttack(62)
        editor.midiAttack(64)
        assert.deepEqual(editor.getNotes().map(({beat,duration}) => [beat,duration]), [
          [0,base * ratio], [base * ratio,base * (2 - ratio)], [base * 2,base],
        ])
      }
    }
    for (const [label, firstLength] of [['タータ', .75], ['タカー', .25]]) {
      editor.setNotes([{beat:0,duration:.5,midi:60}, {beat:.5,duration:.5,midi:62}, {beat:2,duration:.5,midi:64}])
      await nextTick()
      const noteButtons = host.querySelectorAll('.arrange-note')
      noteButtons[0].click()
      for (const note of [...noteButtons].slice(1)) {
        note.dispatchEvent(new dom.window.MouseEvent('click', {bubbles:true,shiftKey:true}))
      }
      await nextTick()
      host.querySelector(`[aria-label="${label}"]`).click()
      assert.deepEqual(editor.getNotes().map(({beat,duration}) => [beat,duration]), [
        [0,firstLength], [firstLength,1-firstLength], [2,.5],
      ])
      await nextTick()
    }
    await nextTick()
    editor.setNotes([{beat:0,duration:.5,midi:60}, {beat:.5,duration:.5,midi:62}, {beat:2,duration:.5,midi:64}])
    await nextTick()
    const score = host.querySelector('.arrange-score')
    score.setPointerCapture = () => {}
    const bars = [...score.querySelectorAll('.arrange-note')]
    bars.forEach((bar, index) => {
      const left = 10 + index * 40
      bar.getBoundingClientRect = () => ({left,right:left + 30,top:20,bottom:40})
    })
    const gridBeat = score.querySelector('.arrange-beat')
    for (const [type, target, x, y] of [
      ['pointerdown', gridBeat, 25, 15],
      ['pointermove', score, 75, 45],
      ['pointerup', score, 75, 45],
    ]) {
      const event = new dom.window.MouseEvent(type, {bubbles:true,cancelable:true,clientX:x,clientY:y})
      Object.defineProperties(event, {pointerId:{value:1},isPrimary:{value:true},pointerType:{value:'mouse'}})
      target.dispatchEvent(event)
    }
    gridBeat.dispatchEvent(new dom.window.MouseEvent('click', {bubbles:true,detail:1}))
    await nextTick()
    assert.deepEqual([...score.querySelectorAll('.arrange-note')].map(bar => bar.getAttribute('aria-pressed')), ['true','true','false'])
    host.querySelector('[aria-label="タータ"]').click()
    assert.deepEqual(editor.getNotes().map(note => note.duration), [.75,.25,.5])
    await nextTick()
    const eighthSelect = host.querySelector('[aria-label="音価を選択"]')
    eighthSelect.value = '0.5'
    eighthSelect.dispatchEvent(new dom.window.Event('change', {bubbles:true}))
    editor.setNotes([])
    const frame = globalThis.requestAnimationFrame
    globalThis.requestAnimationFrame = () => 1
    const transport = {currentTime:11.24}
    try {
      editor.schedulePlaybackBar(1, 0, 10, .5, 4, transport)
      editor.midiAttack(64, performance.now() - 240)
      assert.deepEqual(editor.getNotes().map(({beat,midi}) => ({beat,midi})), [{beat:6,midi:64}])
      transport.currentTime = 12.1
      editor.midiRelease(64, performance.now() - 100)
      assert.equal(editor.getNotes()[0].duration, 2)
      transport.currentTime = 11.19
      editor.midiAttack(67)
      transport.currentTime = 11.43
      editor.midiRelease(67)
      const recorded = editor.getNotes().find(note => note.midi === 67)
      assert.equal(recorded.beat * 4, Math.round(recorded.beat * 4))
      assert.equal(recorded.duration * 4, Math.round(recorded.duration * 4))
      const beforeDisabledInput = editor.getNotes().length
      host.querySelector('[aria-label="メロディ入力"]').click()
      transport.currentTime = 11.6
      editor.midiAttack(65)
      assert.equal(editor.getNotes().length, beforeDisabledInput)
      host.querySelector('[aria-label="メロディ入力"]').click()
    } finally {
      editor.stopPlaybackPosition()
      globalThis.requestAnimationFrame = frame
    }
    assert.equal(editor.isRecordingEnabled(), false)
    await nextTick()
    assert.equal(host.querySelector('[aria-label="メロディ入力"]').getAttribute('aria-pressed'), 'false')
    host.querySelector('[aria-label="メロディ入力"]').click()
    editor.setNotes([])
    host.querySelector('[aria-label="音価を選択"]').value = '0.25'
    host.querySelector('[aria-label="音価を選択"]').dispatchEvent(new Event('change', {bubbles:true}))
    await nextTick()
    assert.ok(host.querySelector('[aria-label="1小節目 1.25拍から入力"]'))
    host.querySelector('[aria-label="音価を選択"]').value = '0.5'
    host.querySelector('[aria-label="音価を選択"]').dispatchEvent(new Event('change', {bubbles:true}))
    await nextTick()
    editor.midiAttack(60)
    await nextTick()
    host.querySelector('[aria-label="直前の音を伸ばす"]').focus()
    host.dispatchEvent(new dom.window.KeyboardEvent('keydown', {code:'KeyX', bubbles:true, cancelable:true}))
    await nextTick()
    assert.deepEqual(editor.getNotes(), [{beat:0, duration:1, midi:60, velocity:.8}])
    host.getClientRects = () => [host.getBoundingClientRect()]
    host.dispatchEvent(new dom.window.KeyboardEvent('keydown', {code:'KeyZ', metaKey:true, bubbles:true, cancelable:true}))
    assert.equal(editor.getNotes()[0].duration, .5)
    host.dispatchEvent(new dom.window.KeyboardEvent('keydown', {code:'KeyZ', metaKey:true, bubbles:true, cancelable:true}))
    assert.deepEqual(editor.getNotes(), [])
    await nextTick()
    editor.setNotes([{beat:0, duration:1, midi:60}, {beat:1.25, duration:.5, midi:62}])
    await nextTick()
    host.querySelector('[aria-label="1小節目 2拍から入力"]').click()
    await nextTick()
    host.querySelector('[aria-label="直前の音を伸ばす"]').click()
    await nextTick()
    assert.deepEqual(editor.getNotes().map(({beat,duration}) => ({beat,duration})), [
      {beat:0,duration:1.25}, {beat:1.25,duration:.5},
    ])
    assert.equal(host.querySelector('[aria-label="直前の音を伸ばす"]').disabled, true)
    host.querySelector('[aria-label="メロディ入力"]').click()
    host.querySelector('.arrange-note[data-note-index="1"]').click()
    await nextTick()
    const extendSelected = host.querySelector('[aria-label="直前の音を伸ばす"]')
    assert.equal(extendSelected.disabled, false)
    extendSelected.click()
    assert.equal(editor.getNotes()[1].duration, 1)
    const draggedNote = host.querySelector('.arrange-note[data-note-index="1"]')
    draggedNote.closest('.arrange-staff').getBoundingClientRect = () => ({width:800})
    draggedNote.setPointerCapture = () => {}
    const dragPointer = (target, type, clientY) => {
      const event = new dom.window.MouseEvent(type, {bubbles:true, button:0, clientY})
      Object.defineProperties(event, {pointerId:{value:1}, isPrimary:{value:true}, pointerType:{value:'mouse'}})
      target.dispatchEvent(event)
    }
    dragPointer(draggedNote, 'pointerdown', 100)
    dragPointer(window, 'pointermove', 80)
    assert.equal(editor.getNotes()[1].midi, 63)
    dragPointer(window, 'pointermove', 120)
    assert.equal(editor.getNotes()[1].midi, 61)
    dragPointer(window, 'pointerup', 120)

    host.querySelector('[aria-label="メロディ入力"]').click()
    editor.setNotes([])
    await nextTick()
    host.querySelector('[aria-label="1小節目 4拍から入力"]').click()
    await nextTick()
    host.querySelector('[aria-label="音価を選択"]').value = '2'
    host.querySelector('[aria-label="音価を選択"]').dispatchEvent(new Event('change', {bubbles:true}))
    await nextTick()
    editor.midiAttack(60)
    await nextTick()
    assert.deepEqual(editor.getNotes(), [{beat:3, duration:2, midi:60, velocity:.8}])
    assert.deepEqual([...host.querySelectorAll('.arrange-note')].map(note => note.style.left), ['37.5%', '50%'])
    assert.equal(host.querySelectorAll('.arrange-note-tie').length, 1)

    host.getClientRects = () => [host.getBoundingClientRect()]
    const command = code => host.dispatchEvent(new dom.window.KeyboardEvent('keydown', {
      code, metaKey:true, bubbles:true, cancelable:true,
    }))
    command('KeyZ')
    assert.deepEqual(editor.getNotes(), [])
    command('KeyY')
    assert.equal(editor.getNotes()[0].duration, 2)
    command('KeyZ')
    await nextTick()
    host.querySelector('[aria-label="2分休符"]').focus()
    host.dispatchEvent(new dom.window.KeyboardEvent('keydown', {code:'KeyZ', bubbles:true, cancelable:true}))
    command('KeyY')
    assert.deepEqual(editor.getNotes(), [])

    const drumHost = document.createElement('section')
    document.body.append(drumHost)
    const {drumPadState} = await import('../dist/part-steppers.js')
    const previewed = []
    const selectedBars = []
    const drumEditor = mountMelodyEditor(drumHost, {empty:true, part:'drums', barCount:()=>20, previewDrum:id=>previewed.push(id), selectBar:(bar,pickup)=>selectedBars.push([bar,pickup])})
    try {
      assert.deepEqual(drumEditor.getDrumPatterns()[0].map(note => ({beat:note.beat,midi:note.midi})), [0,1,2,3].map(beat => ({beat,midi:0})))
      assert.deepEqual([...drumHost.querySelectorAll('[data-pad-index="0"].drum-step[aria-pressed="true"]')].map(cell=>Number(cell.dataset.step)), [0,4,8,12])
      drumEditor.setDrumPatterns([null,null,null,null])
      await nextTick()
      assert.equal(drumHost.querySelectorAll('.arrange-drum-bar').length, 8)
      assert.equal(drumHost.querySelector('[aria-label="ドラムのページ"] .score-page-label').textContent, 'page')
      drumHost.querySelector('[aria-label="ドラムのページ"] [aria-label="次の8小節"]').click()
      await nextTick()
      assert.ok(drumHost.querySelector('[aria-label="9小節目のパターン"]'))
      drumHost.querySelector('[aria-label="ドラムのページ"] [aria-label="前の8小節"]').click()
      await nextTick()
      const assignment = drumHost.querySelector('[aria-label="4小節目のパターン"]')
      assignment.value = '1'
      assignment.dispatchEvent(new Event('change', {bubbles:true}))
      await nextTick()
      assert.equal(assignment.value, '1')
      drumHost.querySelector('[aria-label="1小節目から再生"]').click()
      assert.deepEqual(selectedBars, [[0,undefined]])
      await nextTick()
      assert.equal(drumHost.querySelector('[aria-label="1小節目から再生"]').getAttribute('aria-pressed'), 'true')
      drumHost.querySelector('[aria-label="2小節目から再生"]').click()
      await nextTick()
      assert.equal(drumHost.querySelector('[aria-label="1小節目から再生"]').getAttribute('aria-pressed'), 'false')
      assert.equal(drumHost.querySelector('[aria-label="2小節目から再生"]').getAttribute('aria-pressed'), 'true')
      drumHost.querySelector('[aria-label="1小節目から再生"]').click()
      await nextTick()
      assert.deepEqual(drumEditor.getDrumAssignments(), [0,0,0,1])
      drumHost.querySelector('[aria-label="KICKを試聴"]').click()
      assert.deepEqual(previewed, [0])
      drumPadState.value = {status:'loading', samples:[0,1]}
      await nextTick()
      const loadingKick = drumHost.querySelector('[aria-label="KICKを試聴（ロード中）"]')
      assert.equal(loadingKick.disabled, true)
      assert.equal(loadingKick.hasAttribute('data-loading'), true)
      drumPadState.value = {status:'ready', samples:null}
      await nextTick()
      assert.equal(drumHost.querySelector('[aria-label="KICKを試聴"]').hasAttribute('data-loading'), false)
      assert.ok(drumHost.querySelector('[aria-label="CL HHを試聴"]'))
      assert.ok(drumHost.querySelector('[aria-label="OP HHを試聴"]'))
      assert.deepEqual(drumEditor.getNotes(), [])
      drumHost.querySelector('[data-pad-index="0"][data-step="0"]').click()
      drumHost.querySelector('[data-pad-index="1"][data-step="0"]').click()
      await nextTick()
      assert.deepEqual(drumEditor.getDrumPatterns()[0].map(({beat,midi}) => ({beat,midi})), [{beat:0,midi:0},{beat:0,midi:1}])
      assert.equal(drumHost.querySelectorAll('.arrange-drum-grid:not(.arrange-drum-pickup) .drum-step').length, 128)
      assert.equal(drumHost.querySelector('[aria-label="ステップ入力"]'), null)
      assert.equal(drumHost.querySelector('[aria-label="ドラム入力"]'), null)
      assert.doesNotMatch(drumHost.textContent, /この小節を登録|この小節に上書き/)
      assert.deepEqual([...drumHost.querySelectorAll('.arrange-drum-grid .drum-step[data-step="0"]')].map(button => Number(button.dataset.padIndex)), [5,4,6,7,3,2,1,0])
      drumHost.querySelector('[aria-label="パターンB"]').click()
      await nextTick()
      assert.equal(drumHost.querySelector('[data-pad-index="0"][data-step="0"]').getAttribute('aria-pressed'), 'true')
      assert.equal(drumEditor.getDrumPatterns()[1], null)
      drumHost.querySelector('[data-pad-index="2"][data-step="4"]').click()
      assert.deepEqual(drumEditor.getDrumPatterns()[1], [{beat:0,duration:.25,midi:0},{beat:0,duration:.25,midi:1},{beat:1,duration:.25,midi:2}])
      drumHost.querySelector('[aria-label="パターンA"]').click()
      await nextTick()
      assert.equal(drumHost.querySelector('[data-pad-index="0"][data-step="0"]').getAttribute('aria-pressed'), 'true')
      drumHost.querySelector('[data-pad-index="0"][data-step="0"]').click()
      drumHost.querySelector('[aria-label="パターンC"]').click()
      await nextTick()
      assert.equal(drumHost.querySelector('[data-pad-index="0"][data-step="0"]').getAttribute('aria-pressed'), 'false')
      drumHost.querySelector('[aria-label="パターンB"]').click()
      await nextTick()
      assert.equal(drumHost.querySelector('[data-pad-index="0"][data-step="0"]').getAttribute('aria-pressed'), 'true')
      drumHost.querySelector('[aria-label="パターンA"]').click()
      await nextTick()
      drumHost.querySelector('[data-pad-index="0"][data-step="0"]').click()
      await nextTick()
      let animationFrame
      globalThis.requestAnimationFrame = callback => { animationFrame = callback; return 1 }
      const clock = {currentTime:10}
      drumEditor.schedulePlaybackBar(0, 0, 10, .5, 4, clock)
      animationFrame()
      await nextTick()
      assert.equal(drumHost.querySelectorAll('.drum-step.playing').length, 8)
      assert.equal(drumHost.querySelectorAll('.arrange-drum-bar.playing').length, 1)
      assert.equal(drumHost.querySelector('.drum-step.playing').dataset.step, '0')
      clock.currentTime = 10.25
      animationFrame()
      await nextTick()
      assert.equal(drumHost.querySelector('.drum-step.playing').dataset.step, '2')
      drumEditor.stopPlaybackPosition()
      await nextTick()
      assert.equal(drumHost.querySelectorAll('.drum-step.playing').length, 0)
      assert.equal(drumHost.querySelectorAll('.arrange-drum-bar.playing').length, 0)
      const {drumPlaybackNotes} = await import('../dist/studio-style.js')
      assert.deepEqual(drumPlaybackNotes(drumEditor.getNotes(), drumEditor.getDrumPatterns(), [0,1], 2).map(({beat,midi})=>({beat,midi})),
        [{beat:0,midi:1},{beat:0,midi:0},{beat:4,midi:0},{beat:4,midi:1},{beat:5,midi:2}])

      drumEditor.setNotes([{beat:.125,duration:.25,midi:1}, {beat:-1,duration:.25,midi:0}])
      drumEditor.setDrumPatterns([null,null,null,null])
      await nextTick()
      assert.match(drumHost.textContent, /16分の位置以外に1音/)
      drumHost.querySelector('[aria-label="パターン0"]').click()
      await nextTick()
      assert.equal(drumHost.querySelector('[data-pad-index="0"][data-step="12"]').getAttribute('aria-pressed'), 'true')
      assert.ok(drumHost.querySelector('.arrange-drum-pickup [data-step="11"]'))
      assert.equal(drumEditor.getNotes().length, 2)

      drumEditor.setNotes([])
      drumEditor.setDrumPatterns([null,null,null,null])
      await nextTick()
      const grid = drumHost.querySelector('.arrange-drum-grid:not(.arrange-drum-pickup)')
      grid.setPointerCapture = () => {}
      const cell = step => drumHost.querySelector(`[data-pad-index="0"][data-step="${step}"]`)
      const pointer = (target, type) => {
        const event = new dom.window.MouseEvent(type, {bubbles:true, cancelable:true, button:0})
        Object.defineProperties(event, {pointerId:{value:1}, isPrimary:{value:true}})
        target.dispatchEvent(event)
      }
      document.elementFromPoint = () => cell(3)
      pointer(cell(0), 'pointerdown')
      pointer(grid, 'pointermove')
      pointer(grid, 'pointerup')
      assert.deepEqual(drumEditor.getDrumPatterns()[0].map(note => note.beat), [0,.25,.5,.75])
      drumHost.getClientRects = () => [drumHost.getBoundingClientRect()]
      drumHost.dispatchEvent(new dom.window.KeyboardEvent('keydown', {code:'KeyZ', metaKey:true, bubbles:true, cancelable:true}))
      assert.equal(drumEditor.getDrumPatterns()[0], null)
      delete document.elementFromPoint

    } finally {
      drumEditor.destroy()
    }

    const bassHost = document.createElement('section')
    document.body.append(bassHost)
    const changedHarmony = ref(false)
    const bassEditor = mountMelodyEditor(bassHost, {empty:true, part:'bass', defaultKeyboardOctaves:2, barCount:()=>8, togglePlayback() {}, rootForBeat:beat=>changedHarmony.value ? (beat < 2 ? 5 : beat < 16 ? 7 : 9) : beat < 4 ? 0 : 1})
    try {
      assert.deepEqual(bassEditor.getNotes(), [])
      bassHost.querySelector('[aria-label="ベース入力"]').click()
      bassEditor.initializeBass()
      assert.equal(bassEditor.getNotes().length, 64)
      assert.deepEqual(bassEditor.getPlaybackNotes().slice(0,2).map(note=>note.velocity), [.95,.65])
      bassHost.querySelector('[aria-label="裏にアクセント"]').click()
      assert.deepEqual(bassEditor.getPlaybackNotes().slice(0,2).map(note=>note.velocity), [.65,.95])
      assert.deepEqual(bassEditor.getNotes().slice(0,2).map(note=>note.velocity), [.8,.8])
      assert.equal(bassEditor.getNotes()[0].midi, 36)
      assert.equal(bassEditor.getNotes()[8].midi, 37)
      await nextTick()
      assert.equal(bassHost.querySelector('.arrange-note-role')?.textContent, 'R')
      const savedBass = bassEditor.getNotes()
      const savedTechniques = bassEditor.getBassTechniques()
      bassEditor.setNotes(savedBass)
      bassEditor.setBassTechniques(savedTechniques)
      changedHarmony.value = true
      await nextTick()
      assert.deepEqual(bassEditor.getPlaybackNotes().slice(0, 8).map(note => note.midi), [41,41,41,41,43,43,43,43])
      assert.equal(bassEditor.getPlaybackNotes().find(note => note.beat === 16)?.midi, 45)
      assert.ok(bassHost.querySelector('.arrange-note').getAttribute('aria-label').includes('ファ2'))
      assert.equal(bassEditor.getBassTechniques()[0], 'straight8')
      changedHarmony.value = false
      await nextTick()
      const technique = bassHost.querySelector('[aria-label="表示中のページに適用するベースの奏法"]')
      technique.value = 'straight4'
      technique.dispatchEvent(new Event('change', {bubbles:true}))
      assert.equal(bassEditor.getNotes().filter(note=>note.beat < 16).length, 16)
      assert.equal(bassEditor.getNotes().filter(note=>note.beat >= 16).length, 16)
      assert.equal(bassEditor.getBassTechniques()[1], 'previous')
      const frame = globalThis.requestAnimationFrame
      globalThis.requestAnimationFrame = () => 1
      try {
        bassEditor.schedulePlaybackBar(4, 0, 10, .5, 4, {currentTime:10.12})
        bassEditor.midiAttack(40)
        await nextTick()
        assert.equal(bassEditor.getPlaybackNotes().find(note => note.beat === 16.25)?.midi, 40)
        assert.equal(bassEditor.getBassTechniques()[1], 'custom')
        assert.equal(bassEditor.getPlaybackNotes()[0].midi, 36)
      } finally {
        bassEditor.stopPlaybackPosition()
        globalThis.requestAnimationFrame = frame
      }
      assert.equal(bassEditor.isRecordingEnabled(), false)
      bassHost.querySelector('[aria-label="ベース入力"]').click()
      bassHost.querySelector('[aria-label="次の4小節"]').click()
      await nextTick()
      bassHost.querySelector('[aria-label="表示中のページのノートを消す"]').click()
      await nextTick()
      assert.equal(bassEditor.getBassTechniques()[1], 'custom')
      assert.equal(bassEditor.getPlaybackNotes().filter(note=>note.beat >= 16).length, 0)
      assert.equal(bassEditor.getPlaybackNotes().filter(note=>note.beat < 16).length, 16)
      bassEditor.setNotes([])
      await nextTick()
      assert.ok(bassHost.querySelector('[aria-label="音価を選択"]'))
      assert.ok(bassHost.querySelector('[aria-label="C2（ルート）"] .arrange-root-mark'))
      assert.ok(bassHost.querySelector('[aria-label="C3（ルート）"] .arrange-root-mark'))
      bassHost.querySelector('[aria-label="2小節目 1拍から入力"]').click()
      await nextTick()
      assert.equal(bassHost.querySelector('[aria-label="C2"] .arrange-root-mark'), null)
      assert.ok(bassHost.querySelector('[aria-label="C♯2（ルート）"] .arrange-root-mark'))
      bassHost.querySelector('[aria-label="1小節目 1拍から入力"]').click()
      assert.ok(bassHost.querySelector('[aria-label="8分休符"]'))
      bassEditor.midiAttack(36)
      await nextTick()
      bassHost.querySelector('[aria-label="直前の音を伸ばす"]').click()
      assert.equal(bassEditor.getNotes()[0].duration, 1)
      bassEditor.setNotes([])
      await nextTick()
      assert.ok(bassHost.querySelector('.arrange-keyboard [aria-label="C2（ルート）"]'))
      bassEditor.midiAttack(27)
      bassEditor.midiAttack(28)
      bassEditor.midiAttack(60)
      bassEditor.midiAttack(61)
      await nextTick()
      assert.deepEqual(bassEditor.getNotes().map(note => note.midi), [28, 60])
    } finally {
      bassEditor.destroy()
    }
  } finally {
    editor?.destroy()
    globals.forEach((name, index) => {
      if (previous[index]) Object.defineProperty(globalThis, name, previous[index])
      else delete globalThis[name]
    })
    dom.window.close()
  }
})
