/** @typedef {Readonly<{step:number,at:number,duration:number}>} InvitationNote */
/** motion scales melodic-motion cost: a larger value favours smaller, connected intervals.
 * tensionBias is a 0..1 preference for a brief safe colour before resolution.
 * @typedef {Readonly<{id:string,register:number,gate:number,tensionBias:number,motion:number,invitation:ReadonlyArray<InvitationNote>}>} OttoStyle */
/** @param {string} id @param {number} register @param {number} gate @param {number} tensionBias @param {number} motion @param {Array<[number,number,number]>} notes
 * @returns {OttoStyle} */
function profile(id, register, gate, tensionBias, motion, notes) {
  return Object.freeze({id,register,gate,tensionBias,motion,
    invitation:Object.freeze(notes.map(([step,at,duration]) => Object.freeze({step,at,duration})))})
}
const profiles = Object.freeze({
  // Long vowels, a breath between thoughts, and a held two-bar arrival.
  lyrical: profile('lyrical',69,.98,.18,1.2,[[0,0,1.5],[1,1.75,.75],[3,2.75,1],[2,4,1.5],[1,5.75,.5],[0,6.5,1.5]]),
  // Offbeat pickups and unequal note lengths leave the rhythm section audible.
  groove: profile('groove',70,.72,.65,1.05,[[0,.5,.25],[2,1.25,.5],[1,2,.25],[3,2.75,.75],[2,4.25,.25],[1,5,.5],[3,5.75,.25],[0,6.5,1]]),
  guitar: profile('guitar',65,.82,.25,1.2,[[0,0,.75],[1,1,.5],[2,2,.75],[1,3.25,.5],[0,4,.75],[1,5,.5],[2,6,.5],[0,7,.75]]),
  // A repeatable hook, never a blanket of sixteenths; the last note opens out.
  pulse: profile('pulse',73,.68,.42,.95,[[0,0,.5],[0,.75,.25],[2,1.5,.5],[1,2.5,.5],[0,3.25,.5],[0,4,.5],[2,4.75,.25],[3,5.5,.5],[1,6.25,.5],[0,7,.75]]),
  // Straight-grid offbeats are transformed by the existing shared swing clock.
  jazz: profile('jazz',67,.88,.88,1.15,[[0,.5,.5],[2,1.25,.5],[1,2,.75],[3,3.25,.5],[2,4.5,.5],[1,5.25,.5],[2,6,.25],[0,6.75,1.25]]),
  // An opening call, one running connection, then a sustained heroic answer.
  hero: profile('hero',75,.86,.35,.78,[[0,0,.75],[3,1,.5],[2,1.75,.25],[1,2.25,.5],[4,3,.75],[3,4,.75],[2,5,.25],[1,5.5,.5],[0,6.25,1.75]]),
  // Toy-like repeated syllables, a little skip, and a generous ending.
  playful: profile('playful',76,.65,.50,.85,[[0,0,.25],[0,.5,.25],[2,1,.5],[1,1.75,.25],[3,2.5,.75],[2,4,.25],[2,4.5,.25],[4,5,.5],[1,5.75,.25],[0,6.5,1.25]]),
  // Few notes and large breaths; suitable for pads, dub space and save rooms.
  float: profile('float',70,1,.30,1.2,[[0,.5,1.75],[1,2.75,1],[2,4.5,1.25],[0,6.25,1.75]]),
  pop: profile('pop',72,.90,.42,1,[[0,0,.75],[2,1,.75],[4,2,1.5],[2,4,.75],[1,5,.75],[0,6,1.5]]),
})
/** Style identity is authored explicitly rather than inferred from BPM or a group label.
 * Neighboring styles at similar tempi may therefore phrase very differently.
 * @type {Record<string,OttoStyle>} */
const assignments = {}
/** @param {keyof typeof profiles} kind @param {string} ids */
function assign(kind, ids) {
  for (const id of ids.split(/\s+/).filter(Boolean)) {
    if (assignments[id]) throw new Error(`Duplicate Otto style: ${id}`)
    assignments[id] = profiles[kind]
  }
}
assign('lyrical', `vocal_letter newmusic_rain clear_letter scene_margin jpop_ballad pop_shadow
  vt_letter anime_emotional anime_ballad idol_emotional radio orbit`)
assign('groove', `vocal_room vocal_dance magic_satin newmusic_coast clear_horizon idol_prism piano_switch
  night_soul scene_dungeon jpop_city midnight_disco wordbeat vt_velvet vt_neon vt_soda vt_moon
  vt_afterglow kpop_dance kpop_rnb kpop_bright kpop_mellow edm_rain edm_float edm_motor
  glove mirror socket prismbell nightlane`)
assign('guitar', `arc_shibuya`)
assign('pulse', `vocal_sky parade_trance parade_shadow scene_signal scene_blue scene_night vt_orbit
  vt_horizon anime_electro idol_dance arc_trance arc_tech edm_nova edm_warp edm_voyage edm_ritual
  dance dance_house bitgate`)
assign('jazz', `arc_swing arc_cabaret edm_owl jazz ballroom alley blueglass`)
assign('hero', `vocal_garage vocal_rocket summer_lift scene_steel jpop_up pop_scene break_rock
  vt_starlight vt_comet vt_spark anime_rock game_rpg game_battle game_danmaku game_indie_battle signal hammer`)
assign('playful', `vocal_cut vocal_chip vocal_theatre scene_clock scene_call scene_toybox scene_march
  vt_sugar vt_phantom vt_prism vt_crown idol_cute game_retro arc_toy arc_pixel edm_confetti spool`)
assign('float', `scene_shadow game_calm game_indie_emotional edm_veil chill garage liquid dub paperstar`)
assign('pop', `vocal_piano pop magic_prism scene_paper scene_prism novel_keys idol_bright
  game_danmaku_melody arc_piano edm_glass edm_aria`)
// Each style keeps its rhythmic family but gets its own sequence of pickups.
// The catalogue index supplies seven independent, stable rhythmic choices.
Object.keys(assignments).sort().forEach((id, index) => {
  const base = assignments[id]
  const notes = base.invitation.map((note, i) => {
    if (i === 0 || i === base.invitation.length - 1) return {...note}
    const previous = base.invitation[i-1]
    const next = base.invitation[i+1]
    const shift = (index >> ((i - 1) % 7)) & 1 ? (note.at % 1 === .75 ? -.25 : .25) : 0
    const at = Math.min(note.at + shift, next.at - .25)
    return {...note, at:Math.max(previous.at + .25, at)}
  }).map((note, i, all) => ({...note, duration: Math.max(.125, Math.min(note.duration, (all[i+1]?.at ?? 8) - note.at))}))
  assignments[id] = Object.freeze({...base, invitation:Object.freeze(notes.map(note=>Object.freeze(note)))})
})
Object.freeze(assignments)
/** Explicit coverage, also available to catalog validation without consulting fallback behavior. */
export const ottoStyleIds = Object.freeze(Object.keys(assignments))

/** A deterministic, immutable playing personality. Unknown saved ids retain the familiar pop phrasing.
 * The existing harmony palette remains responsible for the actual pitches, including all avoid tones.
 * @param {string} styleId @returns {OttoStyle} */
export function ottoStyleFor(styleId) {
  return Object.hasOwn(assignments,styleId) ? assignments[styleId] : profiles.pop
}
