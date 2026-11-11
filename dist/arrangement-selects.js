import { createApp, h, nextTick, ref } from './vendor/vue.runtime.esm-browser.prod.js'
import { genres } from './groove.js'
import { presetChoiceIds } from './presets.js'
import { presetGroups, presetLevel, presets, rootPitch } from './music.js'

/** @param {string} id */
const select = id => /** @type {HTMLSelectElement} */ (document.getElementById(id))
/** @param {HTMLSelectElement} element */
const announce = element => element.dispatchEvent(new Event('change', {bubbles: true}))

/** @param {string} prefix @param {()=>number} index @param {number} length @param {(direction:number)=>void} step */
function mountArrows(prefix, index, length, step) {
  const host = document.getElementById(`${prefix}-prev`)?.parentElement
  if (!host) return
  const label = prefix === 'style' ? 'スタイル' : 'コード進行'
  createApp({
    render: () => [
      h('button', {id: `${prefix}-prev`, type: 'button', 'aria-label': `前の${label}`, disabled: index() === 0, onClick: () => step(-1)}, '←'),
      h('button', {id: `${prefix}-next`, type: 'button', 'aria-label': `次の${label}`, disabled: index() === length - 1, onClick: () => step(1)}, '→'),
    ],
  }).mount(host)
}

export function mountStyleChoices() {
  const group = select('genre-group')
  const style = select('genre')
  const choices = genres
  const groups = [...new Set(choices.map(item => item.group))]
  const ordered = groups.flatMap(group => choices.filter(item => item.group === group))
  const selected = ref(ordered[0].id)
  const family = ref(ordered[0].group)
  createApp({render: () => [...new Set([...groups, family.value])].map(name => h('option', {key: name, value: name, selected: name === family.value}, name))}).mount(group)
  createApp({render: () => genres.filter(item => item.group === family.value).map(item =>
    h('option', {key: item.id, value: item.id, selected: item.id === selected.value}, item.label),
  )}).mount(style)
  const index = () => ordered.findIndex(item => item.id === selected.value)

  /** @param {string} id */
  async function choose(id, notify = true) {
    const item = genres.find(item => item.id === id)
    if (!item) return
    selected.value = id
    family.value = item.group
    await nextTick()
    if (selected.value !== id) return
    style.value = id
    if (notify) announce(style)
  }
  style.addEventListener('change', () => { selected.value = style.value })
  group.addEventListener('change', () => {
    const item = ordered.find(item => item.group === group.value)
    if (item) void choose(item.id)
  })
  mountArrows('style', index, ordered.length, direction => {
    const current = index()
    const next = ordered[current < 0 ? 0 : current + direction]
    if (next) void choose(next.id)
  })
  mountStyleBrowser(style, choose)
  return {style, choose}
}

export function mountPresetChoices() {
  const group = select('preset-group')
  const preset = select('preset')
  const ordered = presets.filter(item => presetChoiceIds.includes(item.id)).sort((a, b) =>
    presetLevel(a) - presetLevel(b) || a.pattern.length - b.pattern.length,
  )
  const levels = [...new Set(ordered.map(presetLevel))]
  const selected = ref('royal')
  const family = ref('4')
  const labels = ['1','♭2','2','♭3','3','4','♯4','5','♭6','6','♭7','7']
  const names = new Map(presets.map(item => {
    const tags = [`Lv.${presetLevel(item)}`]
    if (item.modulation.some(Boolean)) tags.push('転調あり')
    if (item.pattern.filter(chord => /9|11|13/.test(chord)).length >= 3) tags.push('テンション多め')
    return [item.id, `${item.pattern.map(chord => labels[rootPitch(chord)]).join('–')} 〔${tags.join('・')}〕`]
  }))
  createApp({render: () => presetGroups.map(item => h('option', {key: item.id, value: item.id, selected: item.id === family.value}, item.label))}).mount(group)
  createApp({render: () => [
    h('option', {value: '', disabled: true}, '進行を選択'),
    ...levels.map(level => h('optgroup', {key: level, label: `Lv.${level}`}, ordered.filter(item => presetLevel(item) === level).map(item =>
      h('option', {key: item.id, value: item.id, title: item.name}, names.get(item.id)),
    ))),
    ...presets.filter(item => item.id === selected.value && !presetChoiceIds.includes(item.id)).map(item => h('option', {value:item.id}, names.get(item.id))),
    h('option', {value: 'custom', disabled: true}, 'カスタム'),
  ]}).mount(preset)

  /** @param {string} id */
  function set(id) {
    const item = presets.find(item => item.id === id)
    if (id !== 'custom' && !item) return
    if (item) family.value = item.group
    selected.value = id
    // The shared choice dialog reads native option selection synchronously.
    preset.value = id
  }
  set(selected.value)
  const index = () => ordered.findIndex(item => item.id === selected.value)
  /** @param {string} id */
  function choose(id) { set(id); announce(preset) }
  preset.addEventListener('change', () => set(preset.value))
  group.addEventListener('change', () => {
    const first = ordered.find(item => item.group === group.value)
    if (first) choose(first.id)
  })
  mountArrows('preset', index, ordered.length, direction => {
    const current = index()
    const next = ordered[current < 0 ? 0 : current + direction]
    if (next) choose(next.id)
  })
  return {preset, set, choose, selected}
}

/** @param {HTMLSelectElement} genreSelect @param {(id:string)=>Promise<void>} chooseStyle */
function mountStyleBrowser(genreSelect, chooseStyle) {
  const styleDialog = document.createElement('dialog')
  styleDialog.className = 'style-browser selection-browser'
  styleDialog.setAttribute('aria-label', 'スタイルを選ぼう')
  document.body.append(styleDialog)
  const groups = [...new Set(genres.map(item => item.group))]
  const selected = ref(genres[0].id)
  const family = ref(genres[0].group)
  const applying = ref(false)
  const error = ref('')
  const current = () => genres.find(item => item.id === selected.value) ?? genres[0]
  createApp({render: () => [
    h('div', {class: 'style-browser-header'}, [
      h('h2', 'スタイルを選ぼう'),
      h('button', {type:'button', 'aria-label':'閉じる', onClick:()=>styleDialog.close()}, '×'),
    ]),
    h('label', {class:'selection-family'}, ['ジャンル', h('select', {
      value:family.value, disabled:applying.value,
      onChange:(/** @type {Event} */ event)=>{
        family.value = /** @type {HTMLSelectElement} */ (event.target).value
        selected.value = genres.find(item=>item.group===family.value)?.id ?? genres[0].id
      },
    }, groups.map(group=>h('option',{value:group},group)))]),
    h('div',{class:'selection-browser-body'},[
      h('div',{class:'selection-track-list',role:'group','aria-label':'スタイル一覧'},genres.filter(item=>item.group===family.value).map((item,index)=>h('button',{
        type:'button',class:'style-browser-choice','aria-pressed':item.id===selected.value,disabled:applying.value,
        onClick:()=>{selected.value=item.id;error.value=''},
      },[h('span',{class:'selection-track-number'},String(index+1).padStart(2,'0')),h('strong',item.label),h('span',{class:'selection-track-tempo'},`${item.bpm} BPM`)]))),
      h('section',{class:'selection-track-detail','aria-label':'選択中のスタイル'},[
        h('div',{class:'selection-record','aria-hidden':'true'},[h('span','♫')]),
        h('div',{'aria-live':'polite'},[h('p',{class:'selection-track-family'},current().group),h('h3',current().label),h('p',{class:'selection-bpm'},[h('strong',String(current().bpm)),' BPM'])]),
        h('button',{type:'button',class:'selection-confirm',disabled:applying.value,onClick:async()=>{
          applying.value=true;error.value=''
          try { await chooseStyle(selected.value);styleDialog.close() }
          catch { error.value='変更できませんでした。もう一度お試しください。' }
          finally { applying.value=false }
        }},applying.value?'変更中…':'このスタイルで遊ぶ →'),
        h('p',{class:'selection-error',role:'status'},error.value),
      ]),
    ]),
  ]}).mount(styleDialog)
  document.getElementById('style-open')?.addEventListener('click',()=>{
    const item=genres.find(item=>item.id===genreSelect.value) ?? genres[0]
    selected.value=item.id;family.value=item.group;error.value=''
    styleDialog.showModal()
  })
  styleDialog.addEventListener('click',event=>{if(event.target===styleDialog)styleDialog.close()})
  styleDialog.addEventListener('close',()=>document.getElementById('style-open')?.focus({preventScroll:true}))
}
