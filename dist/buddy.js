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
/** Prefer singable motion, with a step after a leap and a leap after three steps.
 * History includes the user's quoted notes, not just Otto's additions.
 * @param {readonly number[]} history @param {number} next */
export function melodicMotionCost(history, next) {
  if (!history.length) return 0
  const interval = next-history[history.length-1]
  const distance = Math.abs(interval)
  const step = distance > 0 && distance <= 2
  let cost = distance*.3 + Math.max(0,distance-7)*5
  if (!distance) cost += 5
  if (history.length < 2) return cost
  const previous = history[history.length-1]-history[history.length-2]
  if (Math.abs(previous) >= 3) {
    if (!step) cost += 24
    else if (Math.sign(interval) === Math.sign(previous)) cost += 2
  } else {
    let run = 0
    for (let i=history.length-1;i>0;i--) {
      const d = Math.abs(history[i]-history[i-1])
      if (d === 0 || d > 2) break
      run++
    }
    if (run >= 3 && !(distance >= 3 && distance <= 7)) cost += 18
  }
  return cost
}

/** A recognizable quote with a short, harmonically resolved answer in its space.
 * @param {readonly PhraseNote[]} input @param {(beat:number)=>Palette} suppliedPalette @param {number} swing @param {number} [bpm] @param {ReturnType<typeof ottoStyleFor>} [style]
 * @returns {PhraseNote[]} */
export function ottoReply(input, suppliedPalette, swing, bpm = 100, style) {
  const motif = style?.invitation ?? invitation
  /** @type {Map<number,Palette>} */
  const cachedPalettes = new Map()
  /** @param {number} beat */
  function paletteAt(beat) {
    let palette = cachedPalettes.get(beat)
    if (!palette) { palette = suppliedPalette(beat); cachedPalettes.set(beat,palette) }
    return palette
  }
  // Keep avoid tones out of the reply, including quoted notes and later chord changes.
  // A newly dissonant held note may only spill over for at most 60 ms (and .1 beat).
  const grace = Math.min(.1, Math.max(1, bpm) * .06 / 60)
  /** @param {PhraseNote[]} phrase */
  function harmonize(phrase) {
    return phrase.flatMap(note => {
      if (note.midi === undefined) return [note]
      const palette = paletteAt(note.at)
      const role = palette.find(p => p.midi === note.midi) ?? palette.find(p => p.midi % 12 === /** @type {number} */ (note.midi) % 12)
      let midi = note.midi
      if (!role || role.clash) {
        const safe = palette.filter(p => !p.clash)
        if (!safe.length) return []
        midi = [...safe].sort((a,b) => Math.abs(a.midi-midi)-Math.abs(b.midi-midi) ||
          Number(b.category === 'chord')-Number(a.category === 'chord'))[0].midi
      }
      let duration = note.duration
      for (let beat = (Math.floor(note.at*4)+1)/4; beat < note.at+duration; beat += .25) {
        const upcoming = paletteAt(beat)
        const nextRole = upcoming.find(p => p.midi === midi) ?? upcoming.find(p => p.midi%12 === midi%12)
        if (!nextRole || nextRole.clash) {
          duration = Math.min(duration, beat-note.at+grace)
          break
        }
      }
      return [{...note,midi,duration}]
    })
  }
  /** @type {number[]} */
  const invitationHistory = []
  const original = input.length ? input : motif.map((note,index) => {
    const palette = paletteAt(note.at)
    const available = palette.filter(p => !p.clash && (index !== motif.length-1 || p.category === 'chord'))
    const choices = available.length ? available : palette
    const target = invitationHistory.at(-1) ?? style?.register ?? 72
    // Score each candidate once; sorting used to repeat the melodic lookahead.
    const endings = index === motif.length-2
      ? paletteAt(motif[index+1].at).filter(end => !end.clash && end.category === 'chord') : []
    const selected = choices.map(p => ({note:p, cost:melodicMotionCost(invitationHistory,p.midi) +
        (index === 0 ? Math.abs(p.midi-target) : (p.midi < target ? .6 : 0)) +
        (style ? Math.max(0, Math.abs(p.midi-style.register)-5)*1.5 : 0) +
        (p.category === 'chord' ? 0 : .4 - (style?.tensionBias ?? 0)*.2) +
        (style ? Math.abs(p.midi - (style.register + (note.step - 1) * 2)) * .45 : 0) +
        (index === motif.length-2 ? Math.min(...endings.map(end => melodicMotionCost([...invitationHistory,p.midi],end.midi)), 30) : 0)
    })).sort((a,b) => a.cost-b.cost)[0].note
    invitationHistory.push(selected.midi)
    const at = swungBassBeat(note.at * 2, swing)
    const end = swungBassBeat((note.at + note.duration) * 2, swing)
    return {...note, at, duration: end - at, midi:selected.midi, category:selected.category}
  })
  const quote = echoPhrase(original, swing).map(note => ({...note, kind:'quote',
    level: Math.abs(note.at - Math.round(note.at)) < .03 ? .92 : .76}))
  if (!quote.length) return []
  // The quote keeps every pitch. Reserve a small ending only when no natural space exists.
  const gaps = quote.map((note, i) => ({from: note.at + note.duration, to: quote[i + 1]?.at ?? 8, index:i}))
    .filter(gap => gap.to - gap.from >= .7 && gap.from >= .5)
    .sort((a,b) => (b.to-b.from) - (a.to-a.from))
  let gap = gaps[0]
  if (!gap) {
    const last = quote[quote.length - 1]
    if (last.at < 6.5) {
      last.duration = Math.min(last.duration, 7 - last.at)
      gap = {from:7,to:8,index:quote.length - 1}
    }
  }
  if (!gap) return harmonize(quote)
  // Choose a whole melodic path, including its arrival, rather than the next nearest note.
  const rhythmic = original.length >= 5 || (original.length >= 3 && new Set(original.map(n => n.midi)).size === 1)
  const span = gap.to - gap.from
  const fractions = span >= 2 ? (rhythmic ? [0,.12,.32,.55] : [0,.2,.5]) : [0,.5]
  const starts = fractions.map(fraction => {
    let straight = Math.ceil((gap.from + span * fraction) * 4) / 4
    while (swungBassBeat(straight * 2, swing) < gap.from) straight += .25
    return swungBassBeat(straight * 2, swing)
  }).filter((at,i,all) => at < gap.to-.2 && (i === 0 || at > all[i-1]+.05))
  if (starts.length < 2) return harmonize(quote)
  const anchor = quote[gap.index].midi ?? 60
  const destination = quote[gap.index+1]?.midi
  const prior = quote[Math.max(0,gap.index-1)].midi ?? anchor
  const direction = Math.sign(anchor-prior) || 1
  /** @type {{notes:PhraseNote[],cost:number}[]} */
  let paths = [{notes:[],cost:0}]
  const quoteHistory = quote.slice(0,gap.index+1).map(n => n.midi ?? anchor)
  starts.forEach((at,index) => {
    const end = starts[index+1] ?? gap.to
    const final = index === starts.length-1
    // The arrival sings; connecting tones leave a little breathing room.
    const duration = (end-at) * (final ? .94 : index % 2 ? .78 : .9) * (style?.gate ?? 1)
    const palette = paletteAt(at)
    // Sustained harmony depends on the candidate, never on the preceding beam path.
    // Keep individual adjustments in order so floating-point tie breaks stay unchanged.
    const candidates = palette.filter(note => !note.clash && (!final || note.category === 'chord')).map(note => {
      const harmonyCosts = []
      for (let beat = at+.25; beat < at+duration; beat += .25) {
        const role = paletteAt(beat).find(p => p.midi === note.midi)
        if (role?.clash) harmonyCosts.push(2)
        else if (role?.category === 'chord') harmonyCosts.push(-.15)
      }
      return {note, step:palette.indexOf(note), harmonyCosts}
    })
    const next = []
    for (const path of paths) {
      const previous = path.notes.at(-1)?.midi ?? anchor
      const previousInterval = path.notes.length > 1 ? previous-(path.notes.at(-2)?.midi ?? previous) : previous-anchor
      const history = [...quoteHistory, ...path.notes.map(n => n.midi ?? anchor)]
      for (const {note, step, harmonyCosts} of candidates) {
        const interval = note.midi-previous
        let cost = path.cost + melodicMotionCost(history,note.midi) * (style?.motion ?? 1)
        if (!interval) cost += 3
        if (path.notes.some(n => n.midi === note.midi)) cost += .7
        // Continue the gesture, then turn back after a leap instead of wandering.
        if (Math.abs(previousInterval) >= 4 && Math.sign(interval) === Math.sign(previousInterval)) cost += 4
        const contour = index < starts.length/2 ? direction : -direction
        if (Math.sign(interval) !== contour) cost += .9
        if (index === 0 && note.category === 'tension') cost -= style ? style.tensionBias * 3 : 2
        if (duration > .65 && note.category !== 'chord') cost += 1.2
        for (const adjustment of harmonyCosts) cost += adjustment
        if (final && destination !== undefined) cost += Math.abs(note.midi-destination)*.65
        if (final && path.notes.length && previous === note.midi) cost += 2
        next.push({cost,notes:[...path.notes,{step,midi:note.midi,at,duration,
          level:final ? .94 : index%2 ? .72 : .85,kind:'answer'}]})
      }
    }
    paths = next.sort((a,b) => a.cost-b.cost).slice(0,32)
  })
  const answer = paths[0]?.notes ?? []

  return harmonize([...quote,...answer].sort((a,b) => a.at-b.at))
}

const modeLines = {
  pc: '僕と交互にメロディをプレイしよう',
  you: '君からメロディをプレイしてね',
  'all-you': '君のメロディ聞かせて',
  'all-pc': '僕がメロディ奏でてみるよ',
}

/** Keep the authored eight-bar timeline unchanged.
 * @param {import('./progression.js').Progression} source */
export function conversationScore(source) {
  return source.slots.map((chord, index) => ({chord, changes: [...source.beatSlots[index]], key: source.keyForBar(index)}))
}
/** @param {number} beat @param {boolean | string} mode */
export function conversationTurn(beat, mode) {
  const block = Math.floor(Math.max(0, beat) / 8)
  return {block, local: Math.max(0, beat) % 8, pc: mode === 'all-pc' || (mode !== 'all-you' && block % 2 === (mode === true || mode === 'pc' ? 0 : 1)), bar: Math.floor(Math.max(0, beat) / 4) % 8 + 1}
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
/** @param {{progression:Progression,instrument:Instrument,drums:import('./rhythm.js').DrumSynth,getNotes:()=>Palette,notesAt:(bar:number,beat:number)=>Palette,reportNote:(midi:number)=>void,refreshTransport:()=>void,onModeChange:(mode:string)=>void,reveal:()=>void}} source
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
  const partner = new Instrument()
  /** @type {PhraseNote[]} */
  let recorded = []
  /** @type {Map<number, PhraseNote>} */
  const held = new Map()
  const scheduled = new Set()
  let mode = 'all-you'
  /** @type {PhraseNote[]} */
  let replyPlan = []
  let origin = 0, active = false, preparing = false, generation = 0, lastBlock = -1
  let listening = false, listenStart = 0, lastRelease = 0, answeringUntil = 0
  /** @type {{time:number,beat:number,bpm:number} | undefined} */
  let tempoChange
  let sessionBpm = 100
  /** @type {ReturnType<typeof setInterval> | undefined} */
  let timer
  function stop() {
    const owned = active || preparing
    generation++; active = false; preparing = false
    listening = false; answeringUntil = 0; tempoChange = undefined
    clearInterval(timer); timer = undefined
    if (owned) { transport.stop(); player.silence() }
    panel.dataset.ottoPlaying = 'false'
    partner.silence()
    held.clear(); recorded = []; replyPlan = []; scheduled.clear(); lastBlock = -1
    pads.forEach(pad => {
      pad.removeAttribute('data-playing'); pad.removeAttribute('data-pc-playing');
      /** @type {HTMLButtonElement} */ (pad).disabled = false
    })
    pianoKeys.forEach(key => key.removeAttribute('data-pc-playing'))
    view.speaking = false; view.line = selectedLine(); view.hideContinue = true; view.hideJoin = true; view.hideImitate = true
    source.refreshTransport()
    view.status = '再生すると、4拍数えて始まるよ。'
  }
  function selectedLine() {
    return Reflect.get(modeLines, mode) ?? '一緒に遊ぼう。'
  }
  function position() { return ((player.context?.currentTime ?? origin) - origin) / (60 / sessionBpm) }
  /** @param {number} step */
  function release(step) {
    const note = held.get(step)
    if (!note) return
    const local = listening ? position() - listenStart : position() % 8
    note.duration = Math.max(0.08, Math.min(8 - note.at, (local < note.at ? 8 : local) - note.at))
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
    return ottoReply(phrase, beat => {
      const bar = (block * 2 + Math.floor(beat / 4)) % transport.slots.length
      return source.notesAt(bar, beat % 4)
    }, transport.swing, transport.bpm, style)
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
      view.line = 'いち、に、さん、し…'
      view.status = `カウントイン · ${Math.max(1, Math.min(4, Math.floor(beat + 4) + 1))} / 4`
      return
    }
    if (listening) {
      const now = player.context.currentTime
      if (!answeringUntil && !held.size && lastRelease && now - lastRelease >= 1) {
        const startBeat = Math.ceil((beat + .15) * 4) / 4
        const startTime = origin + startBeat * 60 / sessionBpm
        const response = ottoReply(recorded, offset => {
          const absolute = startBeat + offset
          return source.notesAt(Math.floor(absolute / 4) % transport.slots.length, absolute % 4)
        }, transport.swing, sessionBpm, ottoStyleFor(transport.genre))
        replyPlan = response
        response.forEach(note => { if (note.midi !== undefined) partner.playAt([note.midi], startTime + note.at * 60 / sessionBpm, note.duration * 60 / sessionBpm, note.level ?? .8) })
        answeringUntil = startTime + Math.max(0, ...response.map(note => note.at + note.duration)) * 60 / sessionBpm
        view.line = 'こんな感じかな？'
      }
      if (answeringUntil && now >= answeringUntil) {
        listening = false; answeringUntil = 0; recorded = []; scheduled.clear()
        lastBlock = conversationTurn(beat, mode).block
      } else {
        view.speaking = Boolean(answeringUntil)
        panel.dataset.ottoPlaying = String(Boolean(answeringUntil))
        view.hideContinue = true; view.hideJoin = !answeringUntil; view.hideImitate = true
        if (!answeringUntil) view.line = 'うん、聴いてるよ！'
        return
      }
    }
    const turn = conversationTurn(beat, mode)
    if (turn.block !== lastBlock) {
      held.forEach((note, step) => {
        note.duration = Math.max(0.08, 8 - note.at)
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
    const message = `${turn.pc ? 'Ottoの番' : 'あなたの番'} · ${turn.bar}/8小節 · ${Math.floor(turn.local % 4) + 1}拍`
    view.status = message
    const hideContinue = !turn.pc || mode === 'all-pc'
    const hideImitate = turn.pc || !recorded.length || held.size > 0
    view.hideContinue = hideContinue
    view.hideJoin = !turn.pc
    view.hideImitate = hideImitate
    const speaking = String(turn.pc)
    view.speaking = turn.pc
    const line = turn.pc ? (recorded.length ? 'そのフレーズ、こんなのはどう？' : '僕から弾いてみるね') : '君の番だよ'
    view.line = line
    if (panel.dataset.ottoPlaying !== speaking) panel.dataset.ottoPlaying = speaking
    if (panel.dataset.ottoInterruptible !== 'false') panel.dataset.ottoInterruptible = 'false'
    /** @type {Set<number>} */
    const sounding = new Set()
    const targetBlock = turn.block
    const replyStart = origin + targetBlock * 8 * 60 / sessionBpm
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
    // Diff the final visual state. Clearing/re-adding the same key every 25 ms
    // used to trigger CSS/attribute mutations throughout sustained notes.
    const notes = sounding.size ? source.getNotes() : []
    const soundingPads = new Set([...sounding].map(midi => notes.findIndex(note => note.midi === midi)))
    pads.forEach((pad, step) => {
      const button = /** @type {HTMLButtonElement} */ (pad)
      if (button.disabled !== turn.pc) button.disabled = turn.pc
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
  async function start() {
    stop()
    transport.stop(); player.silence()
    const ticket = generation
    preparing = true; source.refreshTransport()
    view.status = '音を準備しています…'
    sessionBpm = transport.bpm
    partner.setTimbre(player.timbre)
    partner.setVolume(player.volume)
    pads.forEach(pad => { /** @type {HTMLButtonElement} */ (pad).disabled = true; pad.classList.remove('playing') })
    try {
      await Promise.all([player.ready(), partner.ready(), transport.instrument.ready(), transport.melody?.ready(), ...transport.ornaments.map(track => track.voice.ready())])
      if (ticket !== generation) return
      const beatSeconds = 60 / sessionBpm
      const countIn = /** @type {HTMLInputElement} */ (document.querySelector('#count-in')).checked
      const countStart = (player.context?.currentTime ?? 0) + (countIn ? 0.12 : 0.03)
      origin = countStart + (countIn ? 4 * beatSeconds : 0)
      await transport.start(0, 0, origin)
      if (ticket !== generation) return
      if (!transport.running) { stop(); return }
      for (let i = 0; countIn && i < 4; i++) source.drums.hitAt('hat', countStart + i * beatSeconds, i === 0 ? 0.9 : 0.6, 0.06)
      replyPlan = makeResponse(0)
      if (conversationTurn(0, mode).pc) replyPlan.forEach((note, index) => {
        if (note.midi !== undefined) partner.playAt([note.midi], origin + note.at * beatSeconds, note.duration * beatSeconds, note.level ?? 0.8)
        scheduled.add(`0:${index}`)
      })
      lastBlock = -1; active = true; preparing = false
      source.refreshTransport()
      view.status = countIn ? 'カウントイン · 1 / 4' : '演奏スタート'
      timer = setInterval(tick, 25)
    } catch (error) {
      if (ticket === generation) { stop(); view.status = error instanceof Error ? error.message : '音を準備できませんでした。もう一度試してね。' }
    }
  }
  /** @param {number} step */
  function attack(step, midiOverride = -1, glide = false) {
    if (!active || held.has(step)) return
    const beat = position()
    if (beat < 0) return
    if (listening && !recorded.length) listenStart = beat
    if (!listening && conversationTurn(beat, mode).pc || recorded.length >= 64) return
    if (listening && answeringUntil) { partner.silence(); answeringUntil = 0; recorded = []; listenStart = beat }
    tick()
    if (!active) return
    const pitch = midiOverride >= 0 ? {midi:midiOverride,category:'scale'} : source.getNotes()[step]
    if (!pitch) return
    const note = {step, midi: pitch.midi, category: pitch.category, at: listening ? Math.min(7.75, beat - listenStart) : beat % 8, duration: 0.25}
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
    if (!active || !conversationTurn(Math.max(0, position()), mode).pc) return
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
    if (!active || !conversationTurn(Math.max(0, position()), mode).pc) return
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
    scheduled.clear()
    if (active) {
      const beat = Math.max(0, position())
      const turn = conversationTurn(beat, mode)
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
    const turn = conversationTurn(Math.max(0, position()), mode)
    if (!turn.pc) return
    partner.silence()
    replyPlan = makeResponse(turn.block)
    scheduled.clear()
  }
  return {harmonyChanged, styleChanged, timbreChanged, get active() { return active || preparing }, start, setMode, attack, attackMidi: (/** @type {number} */ midi, glide = false) => attack(100+midi,midi,glide), releaseMidi: (/** @type {number} */ midi) => release(100+midi), release, stop}
}
