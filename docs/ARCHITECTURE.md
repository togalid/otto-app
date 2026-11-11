# oto architecture and change map

## Runtime

The browser loads authored native ES modules from `dist/`. The transport, score, basic and ornament parts, pads, keyboard, reference controls, and dialogs use the local Vue runtime. Audio timing and score state live in the existing engine. No bundle build, database, external fonts, remote LLM, or remote sample fetch is needed. Tone.js is a local, lazy-loaded synthesis dependency (about 340 KiB); keep its existing promise deduplication. Replacing it would change the instruments and has no measured justification.

`app.js` composes controls, instruments, progression, and Otto. Musical events use the AudioContext clock and look-ahead scheduling. Visual work must never become the audio clock. The reference track uses the same AudioContext, starts at the scheduled backing bar time plus a shared source offset, and uses the part mixer for volume, mute, and solo. Large reference analysis belongs off the UI thread; worker output is accepted only for the current file/selection.

## Ownership

| Change | Read first | Focused tests |
| --- | --- | --- |
| Tutorial curriculum, eight-bar clock, dedicated lesson UI | `tutorial.js`, `tutorial-view.js`; mode lifecycle in `melody-view.js` | `tests/tutorial.test.mjs`, browser |
| Drum tutorial, mirrored pads, staged rhythm practice and sessions | `drum-tutorial.js`; category navigation in `melody-view.js` | `drum-tutorial`, browser |
| Instrument and chord choice menus | `choice-menu.js`, `part-steppers.js` | browser |
| Score grid and part pattern controls | `chord-grid.js`, `backing-detail.js`, `part-steppers.js` | browser |
| Harmony, chord labels | `chord-harmony.js`, `music.js`, `presets.js` | `music`, `presets` |
| Chord register, voice leading and Pad voicings | `chord-voicing.js` | `chord-voicing`, `chord-pad-voicing` |
| Transport display and playback | `transport-view.js`, `progression.js` | `progression` |
| Drum grid and chord monitor | `drum-grid.js`, `chord-monitor.js` | browser |
| Otto phrase planning | `otto-phrases.js`, `otto-style.js` | `otto-characterization`, `otto-lab`, `buddy` |
| Otto interaction and scheduling | `buddy.js` | `buddy-render`, browser |
| Mobile timing guide | `melody-view.js`, `app.js` scheduling hook, `keyboard.js` | browser, `app-settings` |
| Melody pad feedback | `melody-view.js`, relevant `app.js` handler | `melody-view` |
| Synth/mono/timbre | `audio.js`, `tone-engine.js`, `timbres.js` | `mono-line`, `tone-engine`, timbre tests |
| Basic accompaniment | `backing.js`, `groove.js`, `rhythm.js` | matching tests |
| Ornament arrangement | `ornaments.js`, `ornament-audio.js`, `style-ornaments.js` | matching tests |
| Style and progression selectors | `arrangement-selects.js`, arrangement handlers in `app.js` | browser |
| Bass detail and phrase preview | `bass-detail.js`, `groove.js` | browser |
| Basic parts, section knobs and reference header | `main-controls.js` | browser |
| Quick mixer, accompaniment pads and shared choice fields | `quick-mixer.js`, `part-steppers.js` | `part-steppers`, browser |
| Reference waveform, timing and key assistance | `reference-timing-view.js` | `reference-timing-view`, browser |
| Mobile score editor | `score-pad.js`, mobile toolbar in `chord-grid.js` | browser |
| Reference audio playback and import lifecycle | `reference-player.js` | `reference-player`, browser |
| Reference import processing and PCM encoding | `reference-import.js`, analysis worker modules | `reference-import`, `reference-player` |
| File serving/stems | `server.mjs`, `server/` | server tests |
| Appearance | `appearance-dialog.js`, `skins.js`, `style.css`, `skins.css` | browser |
| Portable settings | `arrangement-file.js`, UI adapter at the end of `app.js` | temporary JSON round trip |

Test names are `tests/<name>.test.mjs`. Sources referenced above live under `dist/` unless noted. Keep public analysis exports compatible with existing consumers.

## Costs and invalidation

- A melody note updates feedback; pad labels/palette change only when key/chord changes. The view retains one current palette, not an accumulating cache.
- Quality choices regenerate only when their original/current chord ids change, rather than allocating and serializing all choices to discover no change.
- Otto candidate evaluation can share scores inside one phrase computation; never carry harmony-sensitive results across score/style changes without a full key.
- Static assets use browser revalidation; changed files must still become visible immediately. Stem responses must never enter the public asset cache.
- Audio buffers and separated stems remain in memory for the selected reference. Replacement and stale results must release references. Do not persist or log uploaded audio.
- Local Demucs is the expensive AI computation. It runs on explicit user analysis, not render, playback, startup, or tests. There is no paid inference API in the app. Coding-agent cost is reduced by this change map, narrow reads, and focused checks, not by deleting correctness tests.

## Compatibility and remaining boundaries

Version-1 settings retain control IDs and musical IDs. UI labels may change independently. No dependency migration or musical preset rewrite is part of the performance refactor.

`app.js` owns initialization, musical commands, settings restoration and cross-module event wiring. Screen rendering belongs to the Vue view modules; it no longer mounts inline Vue apps. `melody-view.js` also owns melody layout/pad presentation and visual feedback, while `transport-view.js` owns the playhead controls. Keep seek/restart decisions in the application and audio scheduling in the engine. CSS has historical overrides: removing them needs computed-style comparison across skins and screen sizes. Audio-node counts and real-device latency still require browser profiling; unit timing is not a latency guarantee.

## Source-derived eight-bar sections

`reference-song-analysis.js` groups non-silent eight-bar windows from the selected downbeat (up to 512 bars), collapses repeated harmonic trajectories, and emits at most four chronological representatives. It directly infers half-bar chord IDs, not preset matches. `reference-performance.js` extracts quantized drum onsets and monophonic bass sketches; isolated stems are optional. The worker runs these pure analyses and cancellation prevents stale file/head/style work from being applied.

Sections optionally carry `performance: {key, drums?, bass?}`. Undefined part arrays use normal accompaniment; empty arrays intentionally stay silent. Version-1 files preserve these bounded, validated optional events. Original-source offsets remain transient in the reference player. The current import does not invoke this legacy transcription path; existing arrangement performance data remains compatible. This does not perform semantic verse/chorus recognition, automatic downbeat correction, or rich-chord transcription.

## Score Pad prototype

Selecting the unified chord-name button or an empty beat opens the bottom Pad dock (`score-pad.js`); native button Enter/Space activation is supported. Root and quality selects remain internal label/state adapters, outside keyboard focus and the accessibility tree. Desktop and mobile use the same Pad trigger. The dock embeds the same-origin `chord-pad.html?embedded=1` audition surface. Origin/source-checked messages commit only on a short tap, while long presses configure the Pad. Score writes use the existing custom-preset and harmony refresh path. Sequential input defaults on and advances by one bar, two beats, or one beat, stopping at the final position. Opening a score cell selects one bar on beat 1, two beats on beat 3, and one beat otherwise; users can override the interval or turn sequential input off. Previous/next controls move the input position by the selected interval. Live transport recording is not part of this prototype.

## Shared reference audio

`analyzeSharedReference` runs worker tempo/key estimates and local Demucs separation over the complete source. Ninety-second upload chunks respect the server limit and are assembled at absolute sample offsets into four full-length buffers. These processing chunks are independent of arrangement sections. All A–D entries share the same buffers and zero base start; timing edits fill all section offsets together. The source loops from the shared head to the file end. Section transitions never restart the reference; explicit transport starts add the selected bar offset. Tempo/key application stops transport but preserves chord progressions and part settings.

Results commit only after separation and analysis complete and the import is still active. Cancellation terminates worker/server work; failures leave the previously loaded reference intact. Success enables MP3 solo and opens its detail panel. The panel owns shared timing/precision/waveform controls outside the Vue-rendered file header, and removal clears MP3 solo.

## Stem CPU measurement

The Demucs child process defaults OMP/MKL thread counts to at most four, respecting explicit operator environment values and smaller CPU allocations. On the local 10-CPU machine, full CLI separation of synthetic 12-second audio took 7.878 s at eight threads versus 7.248 s at four; 36-second audio took 17.507 s versus 16.141 s (about 8% faster). Two threads were slower. These timings include process/model startup and output writing; throughput depends on hardware and audio length. Model, overlap, shifts, and output format remain unchanged.

### Whole-song workspace views

The `楽器ミキサー` / `コード進行` segmented switch changes presentation only; the transport and audio components remain mounted. The mixer edits the selected range's style, absolute key, meter and BPM. Baseline version-1 controls remain mounted but hidden, so reference analysis and old arrangement files retain their fallback values. Section knobs write range metadata rather than changing those fallbacks. Changing a range's style preserves the shared song score; choosing a score preset remains an explicit score operation.

The score header follows the audible playback section, falling back to the selected editing section while stopped. `Section.key` and `Section.style` are optional version-1 fields; missing keys inherit the song key. Key lookup and voicing cache signatures include the section key, so previews and scheduled accompaniment agree across range boundaries.

### Progressive reference import

Decoded original audio and its waveform are published before analysis and separation. The import opens the MP3 detail and stops the previous arrangement once. Original-audio tempo/key analysis may initialize settings only before any user interaction and while playback is stopped; final stem analysis never replaces manual settings. Background progress stays in the MP3 detail without disabling tuning, playback, or removal. Cancellation and separation failure retain the playable original. Finished stem buffers are installed immediately when idle or after the current playback stops, preserving the shared timing offsets. Removing/replacing a file aborts the import; every asynchronous result is checked against its abort signal before publication.

### Otto melody experiment panel

The melody workspace switches between manual playing and Otto's continuous automatic mode. `ottoLabPhrase` in `buddy.js` generates complete deterministic monophonic two/four-bar phrases from the current harmony palette. Its experiment settings cover pentatonic restriction, chromatic ornaments, tension/avoid preference, melodic motion and register, attack density, pickups, syncopation, articulation, rests, variation, contrast, and two/four-bar phrase structure. New values apply when the next phrase is planned; currently scheduled notes are not rescheduled. The same Web Audio scheduler plays the result and the master transport starts/stops automatic mode. These experimental controls are session-local and are not yet part of arrangement JSON. Percentages are generator preferences/probabilities, not a musical quality score.

Automatic Otto selection takes precedence over section-restored melody modes. Section transitions retain continuous generation; four-bar phrases share one plan and resolve in their final bar.

## View composition contract

- Free and Full use these same modules. Edition selection remains in `features.js`; do not duplicate views for previews.
- `selectStepperView` in `part-steppers.js` is the shared tone/pattern picker. Preserve the existing native source select IDs and events: version-1 settings, score menus and musical commands rely on them. Hidden baseline controls are compatibility adapters, not dead components.
- Vue owns generated controls in the quick mixer and reference timing view. Keep native inputs stable through reactive updates so focus and pointer capture survive. `mountAccompanimentPlay` returns an explicit unmount function; call it before replacing a part view.
- Use existing Milk classes and DOM parent structure. Do not reparent Vue-owned descendants; compose the mounted root or a dedicated host instead.
- High-frequency waveform cursor movement and note flashes use direct visual updates. They never schedule audio. Vue does not own AudioContext nodes, transport clocks, source buffers or arrangement domain state.
- The unused `mobile-chord-editor.js` and its exclusive CSS were removed; desktop and mobile score input both use Score Pad.

The view refactor is validated by checked JSDoc, the full Node suite, real Vue/jsdom regressions for shared selectors and reference timing, and browser smoke checks. There is still no bundling step or new runtime dependency.

## Domain boundaries and remaining refactor priorities

Pure computation is intentionally outside Vue. `music.js` remains a compatible entry point while `chord-harmony.js` owns chord identity/pitch rules and `chord-voicing.js` owns register/voice leading. `buddy.js` re-exports its historical phrase APIs from `otto-phrases.js`; UI and clock behavior remain in the controller. `reference-import.js` accepts analysis, separation and buffer allocation as inputs and has no DOM or global audio context.

The uncalled legacy `chooseCrop` dialog workflow and its preview state were removed. The hidden reference dialog's status/removal adapters still have callers; do not delete them by appearance alone. Current timing editing remains in `reference-timing-view.js`.

Prioritize further work by coupling, not line count:

1. The mounted reference lifecycle is covered by `reference-lifecycle.test.mjs`: replacement during decode, cancellation, removal, and deferred Stem activation. Tests use a fake audio context; real decoding and Demucs are outside their scope.
2. Chord backing attacks are planned in `backing.js` and authored bass pulses in `groove.js`. `Progression.tick` owns the single look-ahead clock, scheduling and cancellation. Live chord-pad overrides are still resolved just before bass playback. Use these boundaries when extracting further part planning.
3. `buddy-view.js` owns the session view, lab controls, and phrase history, including export and audition. `buddy.js` supplies capture metadata and handles session scheduling.
4. Removed legacy Buddy selectors and a superseded session spacing declaration. For broader CSS consolidation, compare computed styles across skins, selection states and viewport widths because historical overrides are order-sensitive.

Large preset/timbre tables are mostly data and are lower priority. Do not migrate frameworks, introduce global state infrastructure, or split data files solely to reduce line counts. Free/Full still share one implementation.
