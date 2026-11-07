import { createApp, h, ref } from './vendor/vue.runtime.esm-browser.prod.js'
import { ottoStyleFor } from './otto-style.js'
import { Instrument } from './audio.js'
import { Progression } from './progression.js'
import { swungBassBeat } from './groove.js'

const invitation = [{step:0,at:0,duration:.75},{step:2,at:1,duration:.75},{step:4,at:2,duration:1.5},{step:2,at:4,duration:.75},{step:1,at:5,duration:.75},{step:0,at:6,duration:1.5}]

/** @typedef {{step:number, at:number, duration:number, midi?:number, category?:string, level?:number, kind?:string}} PhraseNote */
/** Nearest audible sixteenth, using the exact swing mapping of the accompaniment.
 * @param {number} beat @param {number} swing */
export function grooveGrid(beat, swing) {
  let nearest = 0, distance = Infinity
  for (let tick = 0; tick <= 32; tick++) {
    const candidate = swungBassBeat(tick / 2, swing)
    if (Math.abs(candidate - beat) < distance) { nearest = candidate; distance = Math.abs(candidate - beat) }
  }
  return nearest
}
/** Preserve pitches, rests and note lengths; never push attacks to later grid cells.
 * @param {readonly PhraseNote[]} phrase @param {number} swing */
export function echoPhrase(phrase, swing) {
  return phrase.map(note => {
    const at = Math.min(swungBassBeat(15.5, swing), grooveGrid(note.at, swing))
    const end = grooveGrid(Math.min(8, note.at + note.duration), swing)
    return {...note, at, duration: Math.min(8 - at, Math.max(0.08, end - at))}
  })
}
/** Prefer nearby scale steps; recover gently after larger intervals.
 * @param {readonly number[]} history @param {number} next */
export function melodicMotionCost(history, next) {
  if (!history.length) return 0
  const last = history[history.length - 1]
  const distance = Math.abs(next - last)
  const previous = history.length > 1 ? last - history[history.length - 2] : 0
  return distance * .5 + Math.max(0, distance - 2) * 2 +
    (distance === 0 ? 1.8 : 0) +
    (Math.abs(previous) > 4 && distance > 2 ? 6 : 0)
}

/** A restrained, connected melody following the harmony at the audible attack.
 * @param {readonly PhraseNote[]} input @param {(beat:number)=>Palette} suppliedPalette @param {number} swing @param {number} [bpm] @param {ReturnType<typeof ottoStyleFor>} [style]
 * @returns {PhraseNote[]} */
export function ottoReply(input, suppliedPalette, swing, bpm = 100, style) {
  void bpm
  const motif = style?.invitation ?? invitation
  /** @type {PhraseNote[]} */
  const source = input.length ? echoPhrase(input, swing) : motif.map(note => {
    const at = swungBassBeat(note.at * 2, swing)
    return {...note, at, duration: swungBassBeat((note.at + note.duration) * 2, swing) - at}
  })
  /** @type {PhraseNote[]} */
  const result = []
  /** @type {number[]} */
  const history = []
  for (const [index, note] of source.entries()) {
    const at = Math.max(0, note.at)
    if (at >= 8) continue
    const palette = suppliedPalette(at).filter(p => !p.clash)
    if (!palette.length) continue
    const strong = Math.abs(at - Math.round(at / 2) * 2) < .05
    const arrival = index === source.length - 1 || note.duration >= 1
    const chordTones = palette.filter(p => p.category === 'chord')
    const candidates = !input.length && (strong || arrival) && chordTones.length ? chordTones : palette
    const previous = history.at(-1) ?? style?.register ?? 72
    const target = input.length && note.midi !== undefined ? note.midi : previous
    const selected = [...candidates].sort((a,b) => {
      /** @param {Palette[number]} p */
      const cost = p => input.length ? Math.abs(p.midi - target) :
        melodicMotionCost(history, p.midi) + Math.abs(p.midi - (style?.register ?? 72)) * .12 +
        // A small arch supplies direction without forcing jumps or extra notes.
        (history.length && Math.sign(p.midi - previous) !== (index < source.length / 2 ? 1 : -1) ? .6 : 0)
      return cost(a) - cost(b)
    })[0]
    let duration = Math.min(note.duration, 8 - at, (source[index + 1]?.at ?? 8) - at)
    // Harmony changes occur on quarter-note boundaries. Never spill an avoid
    // or an out-of-scale pitch across the next chord, even for a grace period.
    for (let beat = (Math.floor(at * 4) + 1) / 4; beat < at + duration - 1e-9; beat += .25) {
      if (!suppliedPalette(beat).some(p => p.midi % 12 === selected.midi % 12 && !p.clash)) {
        duration = beat - at
        break
      }
    }
    if (duration <= 0) continue
    result.push({...note, midi: selected.midi, category: selected.category, duration,
      kind: 'quote', level: strong ? .9 : .78})
    history.push(selected.midi)
  }
  return result
}

const modeLines = {
  pc: '僕と交互にメロディをプレイしよう',
  you: '君からメロディをプレイしてね',
  'all-you': '一緒に弾こう',
  'all-pc': '僕がメロディ奏でてみるよ',
}

/** Keep the authored eight-bar timeline unchanged.
 * @param {import('./progression.js').Progression} source */
export function conversationScore(source) {
  return source.slots.map((chord, index) => ({chord, changes: [...source.beatSlots[index]], key: source.keyForBar(index)}))
}
/** @param {number} beat @param {boolean | string} mode @param {number} [beatsPerBar] */
export function conversationTurn(beat, mode, beatsPerBar = 4) {
  const block = Math.floor(Math.max(0, beat) / (beatsPerBar * 2))
  return {block, local: Math.max(0, beat) % (beatsPerBar * 2), pc: mode === 'all-pc' || (mode !== 'all-you' && block % 2 === (mode === true || mode === 'pc' ? 0 : 1)), bar: Math.floor(Math.max(0, beat) / beatsPerBar) % 8 + 1}
}

/** @param {HTMLElement} ui @param {{join:()=>void,imitate:()=>void,keepPlaying:()=>void}} actions */
function mountBuddyView(ui, actions) {
  const originalBuddy = /** @type {HTMLElement} */ (document.querySelector('#oto-buddy'))
  const view = ref({
    line: '', status: '', speaking: false, look: originalBuddy.dataset.look ?? '',
    hideContinue: true, hideJoin: true, hideImitate: true,
  }).value
  createApp({
    render: () => [
      h('div', {class: 'talk-companion'}, [
        h('div', {class: 'talk-face', 'aria-hidden': 'true', 'data-speaking': String(view.speaking)}, [
          h('div', {class: 'talk-avatar', 'data-mood': 'idle', 'data-look': view.look}),
        ]),
        h('p', {class: 'talk-bubble'}, view.line),
        h('button', {type: 'button', id: 'otto-continue', hidden: view.hideContinue, onClick: actions.keepPlaying}, 'もっと聴かせて！'),
        h('button', {type: 'button', id: 'otto-join', hidden: view.hideJoin, onClick: actions.join}, '自分も弾く！'),
        h('button', {type: 'button', id: 'otto-imitate', hidden: view.hideImitate, onClick: actions.imitate}, '真似してみて！'),
      ]),
      h('p', {id: 'buddy-status', class: 'sr-only', role: 'status', 'aria-live': 'polite'}, view.status),
    ],
  }).mount(ui)
  const drawing = originalBuddy.querySelector('svg')
  if (drawing) ui.querySelector('.talk-avatar')?.append(drawing.cloneNode(true))
  new MutationObserver(() => { view.look = originalBuddy.dataset.look ?? '' })
    .observe(originalBuddy, {attributes:true, attributeFilter:['data-look']})
  return view
}

/** @typedef {ReturnType<typeof import('./music.js').melodyPalette>} Palette */
/** @param {{progression:Progression,instrument:Instrument,drums:import('./rhythm.js').DrumSynth,getNotes:()=>Palette,notesAt:(bar:number,beat:number,absoluteBar:number)=>Palette,reportNote:(midi:number)=>void,refreshTransport:()=>void,onModeChange:(mode:string)=>void,reveal:()=>void}} source
 * @param {typeof mountBuddyView} [mountView] */
export function mountBuddy(source, mountView = mountBuddyView) {
  const panel = /** @type {HTMLElement} */ (document.querySelector('#detail-melody'))
  const ui = /** @type {HTMLElement} */ (document.querySelector('#buddy-inline'))
  const open = /** @type {HTMLButtonElement} */ (document.querySelector('#buddy-talk-open'))
  const view = mountView(ui, {join, imitate, keepPlaying})
  const pianoKeys = Array.from(document.querySelectorAll('#piano-keys [data-midi]'))
  const pads = Array.from(document.querySelectorAll('#pads button'))
  const transport = source.progression
  const player = source.instrument
  const partner = new Instrument('melody')
  /** @type {PhraseNote[]} */
  let recorded = []
  /** @type {Map<number, PhraseNote>} */
  const held = new Map()
  const scheduled = new Set()
  let mode = 'all-you'
  /** @type {PhraseNote[]} */
  let replyPlan = []
  let countBeats = 4
  let origin = 0, active = false, preparing = false, generation = 0, lastBlock = -1
  let listening = false, listenStart = 0, lastRelease = 0, answeringUntil = 0
  let firstEcho = false, echoStart = 0, echoBeatSeconds = 0
  /** @type {{time:number,beat:number,bpm:number} | undefined} */
  let tempoChange
  let sessionBpm = 100
  /** @type {ReturnType<typeof setInterval> | undefined} */
  let timer
  function stop() {
    const owned = active || preparing
    generation++; active = false; preparing = false
    listening = false; firstEcho = false; answeringUntil = 0; tempoChange = undefined
    clearInterval(timer); timer = undefined
    if (owned) { transport.stop(); player.silence() }
    panel.dataset.ottoPlaying = 'false'
    delete panel.dataset.inviting
    partner.silence()
    held.clear(); recorded = []; replyPlan = []; scheduled.clear(); lastBlock = -1
    pads.forEach(pad => {
      pad.removeAttribute('data-playing'); pad.removeAttribute('data-pc-playing');
      /** @type {HTMLButtonElement} */ (pad).disabled = false
    })
    pianoKeys.forEach(key => key.removeAttribute('data-pc-playing'))
    view.speaking = false; view.line = selectedLine(); view.hideContinue = true; view.hideJoin = true; view.hideImitate = true
    source.refreshTransport()
    view.status = '停止'
  }
  function selectedLine() {
    return Reflect.get(modeLines, mode) ?? '一緒に遊ぼう。'
  }
  function meter() { return transport.beatsPerBar ?? 4 }
  function phraseBeats() { return meter() * 2 }
  function position() { return ((player.context?.currentTime ?? origin) - origin) / (60 / sessionBpm) }
  /** @param {number} step */
  function release(step) {
    const note = held.get(step)
    if (!note) return
    const local = listening ? position() - listenStart : position() % phraseBeats()
    note.duration = Math.max(0.08, Math.min(phraseBeats() - note.at, (local < note.at ? phraseBeats() : local) - note.at))
    if (note.midi !== undefined) player.release(note.midi)
    held.delete(step); pads[step]?.removeAttribute('data-playing')
    if (listening && !held.size) lastRelease = player.context?.currentTime ?? 0
  }
  /** @param {number} block */
  function makeResponse(block) {
    // Solo passages get fresh, style-specific motifs; user phrases are quoted only as replies.
    const phrase = mode === 'all-pc' ? [] : recorded
    const baseStyle = ottoStyleFor(transport.genre)
    const variation = block % 4
    const style = variation ? {...baseStyle, register: Math.max(60, Math.min(78, baseStyle.register + [0,2,-2,1][variation])),
      invitation: baseStyle.invitation.map((note,i,all) => {
        const shift = i > 0 && i < all.length-1 && (i + variation) % 3 === 0 ? .25 : 0
        const at = Math.min(note.at + shift, (all[i+1]?.at ?? 8) - .25)
        return {...note,at,duration:Math.max(.125,Math.min(note.duration,(all[i+1]?.at ?? 8)-at))}
      })} : baseStyle
    return Array.from({length: Math.ceil(phraseBeats() / 8)}, (_, chunk) => ottoReply(phrase.filter(note => note.at >= chunk * 8 && note.at < (chunk + 1) * 8).map(note => ({...note, at: note.at - chunk * 8})), offset => {
      const beat = offset + chunk * 8
      const absoluteBar = block * 2 + Math.floor(beat / meter())
      return source.notesAt(absoluteBar % transport.slots.length, beat % meter(), absoluteBar)
    }, transport.swing, transport.bpm, style).map(note => ({...note, at: note.at + chunk * 8})))
      .flat().filter(note => note.at < phraseBeats()).map(note => ({...note, duration: Math.min(note.duration, phraseBeats() - note.at)}))
  }
  function tick() {
    if (!active || !player.context) return
    if (!transport.running) { stop(); return }
    if (transport.bpm !== sessionBpm && !tempoChange) {
      const time = transport.nextTime
      tempoChange = {time, beat:(time - origin) / (60 / sessionBpm), bpm:transport.bpm}
    }
    if (tempoChange && player.context.currentTime >= tempoChange.time - .1) {
      sessionBpm = tempoChange.bpm
      origin = tempoChange.time - tempoChange.beat * 60 / sessionBpm
      tempoChange = undefined
      partner.silence(); scheduled.clear()
    }
    const beat = position()
    if (beat < 0) {
      view.line = `♪  ${Math.max(1, Math.min(countBeats, Math.floor(beat + countBeats) + 1))} / ${countBeats}`
      view.status = `カウントイン · ${Math.max(1, Math.min(countBeats, Math.floor(beat + countBeats) + 1))} / ${countBeats}`
      return
    }
    if (listening) {
      const now = player.context.currentTime
      if (!answeringUntil && !held.size && lastRelease && now - lastRelease >= 1) {
        const startBeat = Math.ceil((beat + .15) * 4) / 4
        const startTime = origin + startBeat * 60 / sessionBpm
        const response = ottoReply(recorded, offset => {
          const absolute = startBeat + offset
          return source.notesAt(Math.floor(absolute / meter()) % transport.slots.length, absolute % meter(), Math.floor(absolute / meter()))
        }, transport.swing, sessionBpm, ottoStyleFor(transport.genre))
          .filter(note => note.at < phraseBeats()).map(note => ({...note, duration: Math.min(note.duration, phraseBeats() - note.at)}))
        replyPlan = response
        echoStart = startTime
        echoBeatSeconds = 60 / sessionBpm
        response.forEach(note => { if (note.midi !== undefined) partner.playAt([note.midi], startTime + note.at * 60 / sessionBpm, note.duration * 60 / sessionBpm, note.level ?? .8) })
        answeringUntil = startTime + Math.max(0, ...response.map(note => note.at + note.duration)) * 60 / sessionBpm
        view.line = 'Ottoの番 ♪'
      }
      if (answeringUntil && now >= answeringUntil) {
        listening = false; answeringUntil = 0; recorded = []; scheduled.clear()
        lastBlock = conversationTurn(beat, mode, meter()).block
      } else {
        view.speaking = Boolean(answeringUntil)
        panel.dataset.ottoPlaying = String(Boolean(answeringUntil))
        panel.dataset.ottoInterruptible = 'true'
        view.hideContinue = true; view.hideJoin = !answeringUntil; view.hideImitate = true
        if (!answeringUntil) view.line = '聴いてるよ'
        const sounding = new Set(replyPlan.flatMap(note => {
          const start = echoStart + note.at * echoBeatSeconds
          return answeringUntil && note.midi !== undefined && now >= start && now < start + note.duration * echoBeatSeconds ? [note.midi] : []
        }))
        showKeys(sounding, false)
        return
      }
    }
    const turn = conversationTurn(beat, mode, meter())
    if (turn.block !== lastBlock) {
      held.forEach((note, step) => {
        note.duration = Math.max(0.08, phraseBeats() - note.at)
        if (note.midi !== undefined) player.release(note.midi)
        pads[step]?.removeAttribute('data-playing')
      })
      held.clear()
      if (!turn.pc) { recorded = []; scheduled.clear() }
      else if (lastBlock >= 0) {
        if (mode === 'all-pc') recorded = replyPlan.map(note => ({...note}))
        scheduled.clear(); replyPlan = makeResponse(turn.block)
      }
      lastBlock = turn.block
    }
    const message = `${turn.pc ? 'Ottoの番' : 'あなたの番'} · ${turn.bar}/8小節 · ${Math.floor(turn.local % meter()) + 1}拍`
    view.status = message
    const hideContinue = !turn.pc || mode === 'all-pc'
    const hideImitate = turn.pc || !recorded.length || held.size > 0
    view.hideContinue = hideContinue
    view.hideJoin = !turn.pc
    view.hideImitate = hideImitate
    const speaking = String(turn.pc)
    view.speaking = turn.pc
    if (firstEcho && !panel.dataset.inviting) panel.dataset.inviting = 'true'
    const line = turn.pc ? 'Ottoの番 ♪' : firstEcho ? '一音、聞かせて' : '君の番 ♪'
    view.line = line
    if (panel.dataset.ottoPlaying !== speaking) panel.dataset.ottoPlaying = speaking
    if (panel.dataset.ottoInterruptible !== 'false') panel.dataset.ottoInterruptible = 'false'
    /** @type {Set<number>} */
    const sounding = new Set()
    const targetBlock = turn.block
    const replyStart = origin + targetBlock * phraseBeats() * 60 / sessionBpm
    const now = player.context.currentTime
    replyPlan.forEach((note, index) => {
      const time = replyStart + note.at * 60 / sessionBpm
      const id = `${targetBlock}:${index}`
      if (turn.pc && mode !== 'all-you' && !scheduled.has(id) && time <= now + 0.12 && time >= now - 0.05 && note.midi !== undefined) {
        scheduled.add(id)
        partner.playAt([note.midi], time, note.duration * 60 / sessionBpm, note.level ?? 0.8)
      }
      if (turn.pc && now >= time && now < time + note.duration * 60 / sessionBpm) {
        if (note.midi !== undefined) sounding.add(note.midi)
      }
    })
    showKeys(sounding, turn.pc)
  }

  /** @param {Set<number>} sounding @param {boolean} locked */
  function showKeys(sounding, locked) {
    // Diff the final visual state. Clearing/re-adding the same key every 25 ms
    // used to trigger CSS/attribute mutations throughout sustained notes.
    const notes = sounding.size ? source.getNotes() : []
    const soundingPads = new Set([...sounding].map(midi => notes.findIndex(note => note.midi === midi)))
    pads.forEach((pad, step) => {
      const button = /** @type {HTMLButtonElement} */ (pad)
      if (button.disabled !== locked) button.disabled = locked
      const pcPlaying = soundingPads.has(step)
      const playing = held.has(step) || pcPlaying
      if (pad.hasAttribute('data-playing') !== playing) pad.toggleAttribute('data-playing', playing)
      if (pad.hasAttribute('data-pc-playing') !== pcPlaying) pad.toggleAttribute('data-pc-playing', pcPlaying)
    })
    pianoKeys.forEach(key => {
      const playing = sounding.has(Number(/** @type {HTMLElement} */ (key).dataset.midi))
      if (key.hasAttribute('data-pc-playing') !== playing) key.toggleAttribute('data-pc-playing', playing)
    })
  }
  async function start(intro = false) {
    stop()
    firstEcho = intro && mode === 'all-you'
    transport.stop(); player.silence()
    const ticket = generation
    preparing = true; source.refreshTransport()
    view.line = view.status = '音を準備中…'
    sessionBpm = transport.bpm
    partner.setTimbre(player.timbre)
    partner.setVolume(player.volume)
    pads.forEach(pad => { /** @type {HTMLButtonElement} */ (pad).disabled = true; pad.classList.remove('playing') })
    try {
      await Promise.all([player.ready(), partner.ready(), transport.instrument.ready(), transport.melody?.ready(), ...transport.ornaments.map(track => track.voice.ready())])
      if (ticket !== generation) return
      const beatSeconds = 60 / sessionBpm
      const countControl = /** @type {HTMLInputElement} */ (document.querySelector('#count-in'))
      countBeats = countControl.checked ? (countControl.value === '2' ? 2 : 4) : 0
      const countIn = countBeats > 0
      const countStart = (player.context?.currentTime ?? 0) + (countIn ? 0.12 : 0.03)
      origin = countStart + (countBeats * beatSeconds)
      await transport.start(0, 0, origin)
      if (ticket !== generation) return
      if (!transport.running) { stop(); return }
      for (let i = 0; countIn && i < countBeats; i++) source.drums.hitAt('hat', countStart + i * beatSeconds, i === 0 ? 0.9 : 0.6, 0.06)
      replyPlan = makeResponse(0)
      if (conversationTurn(0, mode, meter()).pc) replyPlan.forEach((note, index) => {
        if (note.midi !== undefined) partner.playAt([note.midi], origin + note.at * beatSeconds, note.duration * beatSeconds, note.level ?? 0.8)
        scheduled.add(`0:${index}`)
      })
      lastBlock = -1; active = true; preparing = false
      source.refreshTransport()
      view.status = countIn ? `カウントイン · 1 / ${countBeats}` : '演奏スタート'
      timer = setInterval(tick, 25)
    } catch (error) {
      if (ticket === generation) { stop(); view.line = view.status = error instanceof Error ? error.message : '音を準備できませんでした。もう一度試してね。' }
    }
  }
  /** @param {number} step */
  function attack(step, midiOverride = -1, glide = false) {
    if (!active || held.has(step)) return
    const beat = position()
    if (beat < 0) return
    if (listening && !recorded.length) listenStart = beat
    if (!listening && conversationTurn(beat, mode, meter()).pc || recorded.length >= 64) return
    if (listening && answeringUntil) { partner.silence(); answeringUntil = 0; recorded = []; listenStart = beat }
    if (listening) lastRelease = 0
    tick()
    if (!active) return
    const pitch = midiOverride >= 0 ? {midi:midiOverride,category:'scale'} : source.getNotes()[step]
    if (!pitch) return
    if (firstEcho) {
      firstEcho = false
      delete panel.dataset.inviting
      listening = true
      recorded = []
      listenStart = beat
      lastRelease = 0
      view.line = '聴いてるよ'
    }
    const note = {step, midi: pitch.midi, category: pitch.category, at: listening ? Math.min(phraseBeats() - .25, beat - listenStart) : beat % phraseBeats(), duration: 0.25}
    recorded.push(note); held.set(step, note)
    player.attack(pitch.midi,glide); source.reportNote(pitch.midi)
    pads[step]?.setAttribute('data-playing','')
  }
  pads.forEach(pad => {
    const hand = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    hand.setAttribute('viewBox', '0 0 64 64'); hand.setAttribute('aria-hidden', 'true')
    hand.classList.add('talk-pad-hand')
    hand.innerHTML = '<g transform="rotate(180 32 32)"><path d="M24 31V10c0-7 9-7 9 0v16c3-6 9-4 9 2 4-6 10-2 8 5 7-4 12 3 5 13l-9 12H25L10 42c-6-8 2-14 9-7l5 5z"/><path d="M27 49h17M33 27v10m9-9v11m8-6-2 9"/></g>'
    pad.append(hand)
  })
  open?.addEventListener('click', source.reveal)
  function join() {
    if (!active || !(answeringUntil || conversationTurn(Math.max(0, position()), mode, meter()).pc)) return
    partner.silence(); scheduled.clear(); recorded = []; listening = false; answeringUntil = 0
    mode = 'all-you'; source.onModeChange(mode); lastBlock = -1
    view.hideJoin = true; view.hideContinue = true; view.speaking = false
    panel.dataset.ottoPlaying = 'false'
    pads.forEach(pad => { /** @type {HTMLButtonElement} */ (pad).disabled = false })
    view.line = '君のメロディ聞かせて'
  }
  function imitate() {
    if (!active || mode !== 'all-you' || !recorded.length || held.size) return
    listening = true; answeringUntil = 0
    mode = 'all-pc'; source.onModeChange(mode);
    /** @type {HTMLSelectElement} */ (document.querySelector('#melody-mode')).dispatchEvent(new Event('change', {bubbles:true}))
    const first = recorded[0].at
    recorded = recorded.map(note => ({...note, at: Math.max(0, note.at - first)}))
    lastRelease = (player.context?.currentTime ?? 0) - 1.01
    view.hideImitate = true
    tick()
  }
  function keepPlaying() {
    if (!active || !conversationTurn(Math.max(0, position()), mode, meter()).pc) return
    mode = 'all-pc'
    view.hideContinue = true
    source.onModeChange(mode)
    const select = /** @type {HTMLSelectElement} */ (document.querySelector('#melody-mode'))
    select.dispatchEvent(new Event('change', {bubbles:true}))
  }
  /** @param {string} value */
  function setMode(value) {
    if (!Object.hasOwn(modeLines,value)) throw new RangeError('Unknown session mode')
    if (mode === value) return
    held.forEach((note, step) => release(step))
    partner.silence()
    mode = value
    firstEcho = false
    delete panel.dataset.inviting
    if (listening) { listening = false; answeringUntil = 0; recorded = [] }
    scheduled.clear()
    if (active) {
      const beat = Math.max(0, position())
      const turn = conversationTurn(beat, mode, meter())
      replyPlan = turn.pc ? makeResponse(turn.block) : []
      lastBlock = turn.block
      tick()
    }
    view.line = selectedLine(); source.onModeChange(value)
  }
  window.addEventListener('blur', () => { if (active || preparing) stop() })
  document.addEventListener('visibilitychange', () => { if (document.hidden && (active || preparing)) stop() })
  view.line = selectedLine()
  function timbreChanged() {
    if (partner.timbre === player.timbre) return
    partner.silence()
    partner.setTimbre(player.timbre)
    if (active && !listening) { scheduled.clear(); tick() }
  }
  function styleChanged() {
    timbreChanged()
    if (!active) return
    if (listening) { partner.silence(); listening = false; answeringUntil = 0 }
    if (mode === 'all-pc') recorded = []
    harmonyChanged()
  }
  function harmonyChanged() {
    if (!active) return
    const turn = conversationTurn(Math.max(0, position()), mode, meter())
    if (!turn.pc) return
    partner.silence()
    replyPlan = makeResponse(turn.block)
    scheduled.clear()
  }
  return {harmonyChanged, styleChanged, timbreChanged, get active() { return active || preparing }, start, setMode, attack, attackMidi: (/** @type {number} */ midi, glide = false) => attack(100+midi,midi,glide), releaseMidi: (/** @type {number} */ midi) => release(100+midi), release, stop}
}
