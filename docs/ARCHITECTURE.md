# oto architecture and change map

## Runtime

The browser loads authored native ES modules from `dist/`. The transport, score, basic and ornament parts, pads, keyboard, reference controls, and dialogs use the local Vue runtime. Audio timing and score state live in the existing engine. No bundle build, database, external fonts, remote LLM, or remote sample fetch is needed. Tone.js is a local, lazy-loaded synthesis dependency (about 340 KiB); keep its existing promise deduplication. Replacing it would change the instruments and has no measured justification.

`app.js` composes controls, instruments, progression, and Otto. Musical events use the AudioContext clock and look-ahead scheduling. Visual work must never become the audio clock. The reference track uses the same AudioContext and starts each clip segment at the scheduled backing bar time. It derives the source offset from the selected eight-bar region and uses the part mixer for volume, mute, and solo. Large reference analysis belongs off the UI thread; worker output is accepted only for the current file/selection.

## Ownership

| Change | Read first | Focused tests |
| --- | --- | --- |
| Instrument and chord choice menus | `choice-menu.js`, select adapters in `app.js` | browser |
| Score grid and part pattern controls | `chord-grid.js`, `part-steppers.js`, adapters in `app.js` | browser |
| Harmony, chord labels | `music.js`, `presets.js` | `music`, `presets` |
| Transport display and playback | `transport-view.js`, `progression.js` | `progression` |
| Drum grid and chord monitor | `drum-grid.js`, `chord-monitor.js` | browser |
| Otto phrase/interaction | `buddy.js`, `otto-style.js` | `buddy`, `otto-style` |
| Melody pad feedback | `melody-view.js`, relevant `app.js` handler | `melody-view` |
| Synth/mono/timbre | `audio.js`, `tone-engine.js`, `timbres.js` | `mono-line`, `tone-engine`, timbre tests |
| Basic accompaniment | `backing.js`, `groove.js`, `rhythm.js` | matching tests |
| Ornament arrangement | `ornaments.js`, `ornament-audio.js`, `style-ornaments.js` | matching tests |
| Style and progression selectors | `arrangement-selects.js`, arrangement handlers in `app.js` | browser |
| Bass detail and phrase preview | `bass-detail.js`, `groove.js` | browser |
| Basic parts and reference controls | `main-controls.js` | browser |
| Mobile score editor | `mobile-chord-editor.js`, `chord-grid.js` | browser |
| Reference audio | `reference-player.js`, `reference-analysis.js` and worker modules | `reference-player`, analysis tests |
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

`app.js` still owns substantial composition and settings wiring; split future features at real ownership boundaries instead of mechanically splitting by line count. CSS has historical overrides: removing them needs computed-style comparison across skins and screen sizes. Audio-node counts and real-device latency still require browser profiling; unit timing is not a latency guarantee.

## Source-derived eight-bar sections

`reference-song-analysis.js` groups non-silent eight-bar windows from the selected downbeat (up to 512 bars), collapses repeated harmonic trajectories, and emits at most four chronological representatives. It directly infers half-bar chord IDs, not preset matches. `reference-performance.js` extracts quantized drum onsets and monophonic bass sketches; isolated stems are optional. The worker runs these pure analyses and cancellation prevents stale file/head/style work from being applied.

Sections optionally carry `performance: {key, drums?, bass?}`. Undefined part arrays use normal accompaniment; empty arrays intentionally stay silent. Version-1 files preserve these bounded, validated optional events. Original-source offsets remain transient in the reference player. A failed stem split preserves the mixed-source result; successful A-region stems refine its drums/bass without overwriting an intervening part edit. This does not perform semantic verse/chorus recognition, automatic downbeat correction, or rich-chord transcription.

## Score Pad prototype

Selecting the unified chord-name button or an empty beat opens the bottom Pad dock (`score-pad.js`); native button Enter/Space activation is supported. Root and quality selects remain internal label/state adapters, outside keyboard focus and the accessibility tree. Desktop and mobile use the same Pad trigger. The dock embeds the same-origin `chord-pad.html?embedded=1` audition surface. Origin/source-checked messages commit only on a short tap, while long presses configure the Pad. Score writes use the existing custom-preset and harmony refresh path. Optional sequential input advances by one bar, two beats, or one beat, stopping at the final position. Previous/next controls move the input position by the selected interval. Live transport recording is not part of this prototype.
