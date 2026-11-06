/** @typedef {{id: string, label: string, harmonics: number[], cutoff: number, attack: number, decay: number, sustain: number, release: number}} Timbre */
/** @type {ReadonlyArray<Timbre>} */
export const timbres = Object.freeze([
  {
    id: 'soft',
    label: 'やわらかシンセ',
    harmonics: [1],
    cutoff: 8000,
    attack: 0.009,
    decay: 0.42,
    sustain: 0.36,
    release: 0.18,
  },
  {
    id: 'piano',
    label: 'ピアノ風',
    harmonics: [1, 0.52, 0.28, 0.12, 0.08, 0.045, 0.028, 0.016],
    cutoff: 5600,
    attack: 0.003,
    decay: 1.65,
    sustain: 0.065,
    release: 0.32,
  },
  {
    id: 'electric',
    label: 'エレピ風',
    harmonics: [1, 0.12, 0.3, 0, 0.08],
    cutoff: 2600,
    attack: 0.004,
    decay: 1.2,
    sustain: 0.22,
    release: 0.32,
  },
  {
    id: 'felt',
    label: 'フェルトピアノ風',
    harmonics: [1, 0.18, 0.06, 0.02],
    cutoff: 1100,
    attack: 0.009,
    decay: 0.8,
    sustain: 0.055,
    release: 0.24,
  },
  {
    id: 'mallet',
    label: 'マリンバ風',
    harmonics: [1, 0, 0.35, 0, 0.12],
    cutoff: 2400,
    attack: 0.002,
    decay: 0.52,
    sustain: 0.025,
    release: 0.13,
  },
  {
    id: 'bell',
    label: 'ベル',
    harmonics: [1, 0.02, 0.12, 0, 0.42, 0, 0.18],
    cutoff: 7000,
    attack: 0.002,
    decay: 1.35,
    sustain: 0.08,
    release: 0.46,
  },
  {
    id: 'organ',
    label: 'オルガン',
    harmonics: [1, 0.55, 0.4, 0.2, 0.16, 0.12],
    cutoff: 5200,
    attack: 0.006,
    decay: 0.04,
    sustain: 0.8,
    release: 0.045,
  },
  {
    id: 'strings',
    label: 'ストリングス',
    harmonics: [1, 0.5, 0.33, 0.25, 0.2, 0.16, 0.14, 0.12],
    cutoff: 2800,
    attack: 0.045,
    decay: 0.25,
    sustain: 0.64,
    release: 0.28,
  },
  {
    id: 'pad',
    label: 'ウォームパッド',
    harmonics: [1, 0.35, 0.18, 0.08, 0.04],
    cutoff: 900,
    attack: 0.065,
    decay: 0.35,
    sustain: 0.6,
    release: 0.36,
  },
  {
    id: 'supersaw',
    label: 'スーパーソー',
    harmonics: [1,.5,.333,.25,.2,.167,.143,.125,.111,.1,.091,.083,.077,.071,.067,.0625],
    cutoff: 12000, attack: .018, decay: .18, sustain: .86, release: .17,
  },
  {
    id: 'saw-brass',
    label: 'ソー・ブラス',
    harmonics: [1,.5,.333,.25,.2,.167,.143,.125,.111,.1,.091,.083,.077,.071,.067,.0625],
    cutoff: 11500, attack: .016, decay: .16, sustain: .84, release: .14,
  },
  {
    id: 'pulse-stack',
    label: 'パルス・スタック',
    harmonics: [1,.707,.333,0,.2,.236,.143,0,.111,.141,.091,0,.077,.101,.067,0],
    cutoff: 10500, attack: .006, decay: .12, sustain: .82, release: .095,
  },
  {
    id: 'pluck',
    label: 'プラック',
    harmonics: [1, 0.3, 0.2, 0.1, 0.08, 0.05],
    cutoff: 4800,
    attack: 0.002,
    decay: 0.24,
    sustain: 0.025,
    release: 0.095,
  },
])

/** Voices articulated for single-note melodies, independent of the chord catalog.
 * @type {ReadonlyArray<Timbre>} */
export const melodyTimbres = Object.freeze([
  {id:'lead-supersaw',label:'スーパーソー・リード',harmonics:[1,.5,.333,.25,.2,.167,.143,.125,.111,.1,.091,.083,.077,.071,.067,.0625],cutoff:13000,attack:.010,decay:.14,sustain:.90,release:.12},
  {id:'lead-saw',label:'バズ・ソーリード',harmonics:[1,.5,.333,.25,.2,.167,.143,.125,.111,.1,.091,.083,.077,.071,.067,.0625],cutoff:12500,attack:.009,decay:.12,sustain:.88,release:.105},
  {id:'lead-pulse',label:'エッジ・パルスリード',harmonics:[1,.707,.333,0,.2,.236,.143,0,.111,.141,.091,0,.077,.101,.067,0],cutoff:11500,attack:.004,decay:.095,sustain:.84,release:.075},
  {id:'lead-round',label:'まるいリード',harmonics:[1,.22,.08,.025],cutoff:4200,attack:.008,decay:.22,sustain:.62,release:.12},
  {id:'lead-glass',label:'ガラスのリード',harmonics:[1,.08,.22],cutoff:5800,attack:.004,decay:.65,sustain:.38,release:.2},
  {id:'lead-flute',label:'息のフルート',harmonics:[1,.055,.035,.012],cutoff:3000,attack:.035,decay:.2,sustain:.74,release:.16},
  {id:'lead-reed',label:'木管リード',harmonics:[1,.03,.42,.015,.15,.01,.06],cutoff:3600,attack:.015,decay:.18,sustain:.65,release:.1},
  {id:'lead-bowed',label:'歌うストリング',harmonics:[1,.48,.29,.17,.1,.065],cutoff:4000,attack:.028,decay:.3,sustain:.7,release:.18},
  {id:'lead-chip',label:'ピコピコリード',harmonics:[1,0,.33,0,.2,0,.14],cutoff:6500,attack:.002,decay:.09,sustain:.5,release:.055},
  {id:'lead-marimba',label:'ころころマリンバ',harmonics:[1,0,.28,0,.08],cutoff:3400,attack:.002,decay:.38,sustain:.04,release:.09},
  {id:'lead-box',label:'小さなオルゴール',harmonics:[1,.02,.1,0,.26],cutoff:6400,attack:.002,decay:.85,sustain:.06,release:.24},
])
/** Preserve the musical intent of existing style recipes without exposing chord voices in the melody menu.
 * @param {string} id */
export function melodyTimbreFor(id) {
  if (melodyTimbres.some(t => t.id === id)) return id
  const mapping = {supersaw:'lead-supersaw','saw-brass':'lead-saw','pulse-stack':'lead-pulse',soft:'lead-round',piano:'lead-glass',electric:'lead-glass',felt:'lead-flute',
    mallet:'lead-marimba',bell:'lead-box',organ:'lead-reed',strings:'lead-bowed',pad:'lead-flute',pluck:'lead-chip'}
  const mapped = Reflect.get(mapping,id)
  if (!mapped) throw new RangeError('Unknown melody timbre')
  return /** @type {string} */ (mapped)
}

/** @param {string} id */
export function getTimbre(id) {
  const timbre = [...timbres, ...melodyTimbres].find((item) => item.id === id)
  if (!timbre) throw new RangeError('Unknown timbre')
  return timbre
}


/** Synthesis follows the instrument's physical gesture, rather than sharing one static wave.
 * FM: ratio, index, transient decay. Subtractive: filter sweep in octaves.
 */
const voiceProfiles = Object.freeze({
  'lead-supersaw': {fm:false,ratio:1,index:0,transient:.18,sweep:.28},
  supersaw: {fm:false,ratio:1,index:0,transient:.24,sweep:.4},
  'lead-saw': {fm:false,ratio:1,index:0,transient:.16,sweep:.24},
  'lead-pulse': {fm:false,ratio:1,index:0,transient:.10,sweep:.12},
  'lead-round': {fm:false,ratio:1,index:0,transient:.12,sweep:1.4},
  'lead-glass': {fm:true,ratio:2,index:1.1,transient:.2,sweep:0},
  'lead-flute': {fm:false,ratio:1,index:0,transient:.16,sweep:.45},
  'lead-reed': {fm:false,ratio:1,index:0,transient:.1,sweep:.7},
  'lead-bowed': {fm:false,ratio:1,index:0,transient:.23,sweep:1.1},
  'lead-chip': {fm:false,ratio:1,index:0,transient:.035,sweep:.3},
  'lead-marimba': {fm:true,ratio:4,index:.85,transient:.055,sweep:0},
  'lead-box': {fm:true,ratio:3.5,index:1.5,transient:.3,sweep:0},
  'saw-brass': {fm:false,ratio:1,index:0,transient:.20,sweep:.45},
  'pulse-stack': {fm:false,ratio:1,index:0,transient:.12,sweep:.18},
  soft: { fm: false, ratio: 1, index: 0, transient: 0.22, sweep: 1.1 },
  piano: { fm: false, ratio: 1, index: 0, transient: 0.16, sweep: 2.3 },
  electric: { fm: true, ratio: 3, index: 1.4, transient: 0.32, sweep: 0 },
  felt: { fm: false, ratio: 1, index: 0, transient: 0.14, sweep: 0.7 },
  mallet: { fm: true, ratio: 4, index: 1.1, transient: 0.065, sweep: 0 },
  bell: { fm: true, ratio: 2.76, index: 2.2, transient: 0.62, sweep: 0 },
  organ: { fm: false, ratio: 1, index: 0, transient: 0.03, sweep: 0.05 },
  strings: { fm: false, ratio: 1, index: 0, transient: 0.3, sweep: 0.6 },
  pad: { fm: false, ratio: 1, index: 0, transient: 0.4, sweep: 0.85 },
  pluck: { fm: false, ratio: 1, index: 0, transient: 0.09, sweep: 2.3 },
})

/** @param {string} id */
export function timbreProfile(id) {
  getTimbre(id)
  return voiceProfiles[/** @type {keyof typeof voiceProfiles} */ (id)]
}

/** Per-voice parameters: no shared filter automation between overlapping chord tones.
 * @param {string} id @param {number} midi @param {number} velocity */
export function voiceExpression(id, midi, velocity) {
  const recipe = getTimbre(id)
  const profile = timbreProfile(id)
  const touch = Math.max(0, Math.min(1, velocity))
  const register = Math.max(0.55, Math.min(1.5, 2 ** ((60 - midi) / 48)))
  const attack = recipe.attack * (1.12 - touch * 0.24)
  return {
    envelope: { attack, decay: recipe.decay * register, sustain: recipe.sustain,
      release: recipe.release * register, attackCurve: 'linear', decayCurve: 'exponential', releaseCurve: 'exponential' },
    baseFrequency: Math.min(6500, Math.max(180, recipe.cutoff * 0.34 * 2 ** ((midi - 60) / 36))),
    octaves: profile.sweep * (0.45 + touch * 0.55),
    modulationIndex: profile.index * (0.35 + touch * 0.65),
    transientDecay: profile.transient * register,
  }
}

/** Output trims in dB keep oscillator and filter differences out of touch velocity.
 * Positive trims restore quieter, darker voices; sustained bright voices need less gain.
 * @param {string} id */
export function timbreOutputGain(id) {
  getTimbre(id)
  const trims = {supersaw:-9,'lead-supersaw':-8,'lead-saw':-6,'lead-pulse':-6.5,'saw-brass':-7,'pulse-stack':-7.5, 'lead-round':-1,'lead-glass':6,'lead-flute':2,'lead-reed':-2,'lead-bowed':-3,'lead-chip':-4,'lead-marimba':8,'lead-box':7, soft: 0, piano: 1.5, electric: 9, felt: 3,
    mallet: 10, bell: 9, organ: -3, strings: -2, pad: 2, pluck: 2 }
  return 10 ** (trims[/** @type {keyof typeof trims} */ (id)] / 20)
}
