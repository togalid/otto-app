# oto architecture and change map

## Runtime

The browser loads authored native ES modules from `dist/`. The transport, score, basic and ornament parts, pads, keyboard, reference controls, and dialogs use the local Vue runtime. Audio timing and score state live in the existing engine. No bundle build, database, external fonts, remote LLM, or remote sample fetch is needed. Tone.js is a local, lazy-loaded synthesis dependency (about 340 KiB); keep its existing promise deduplication. Replacing it would change the instruments and has no measured justification.

`app.js` composes controls, instruments, progression, and Otto. Musical events use the AudioContext clock and look-ahead scheduling. Visual work must never become the audio clock. The reference track uses the same AudioContext, starts at the scheduled backing bar time plus a shared source offset, and uses the part mixer for volume, mute, and solo. Large reference analysis belongs off the UI thread; worker output is accepted only for the current file/selection.

## Ottoのモード構成（開発方針）

| モード | ユーザーの目的 | 画面の中心 |
| --- | --- | --- |
| チュートリアル | 学ぶ | お手本を聴き、まねして、演奏を練習する |
| ライブ | 演奏する | スタイルや曲に合わせて弾き、Ottoとセッションする |
| スタジオ | 作る・編曲する | メロディ、コード進行、伴奏パートを編集し、スタイルとして仕上げる |

スタジオはスタイル編集の快適さを優先する。伴奏再生とOttoとのセッションは、編集中のスタイルの試聴・動作確認に使う。演奏を楽しむためのセッション体験はライブに集約する。

独立したメロディアレンジ画面は終了し、譜面編集はスタジオのメロディパートに統合する。メニューの「ライブ」から既存の曲セッションを開く。ライブ専用画面への発展は今後の開発項目とする。

### ライブの開始フロー（構想）

1. 曲を選ぶ。
2. 遊び方を選ぶ。「Ottoとセッション」「自分で弾く」「ゲームモード」から選択する。
3. 楽器を選ぶ。「メロディ」「ドラム」「ベース」「バッキング」から選択する。

曲を選んだあと、遊び方と楽器の選択が揃ったら曲を開始する。ゲームモードでは、チュートリアルのようにお手本に合わせて演奏し、高得点を目指す。

## Ownership

| Change | Read first | Focused tests |
| --- | --- | --- |
| Shared score navigation, pagination for melody, bass, backing, chord and drums, lanes, note rendering and editing adapters | `score-navigation.js`, `tutorial-view.js`, `melody-arrange.js` | `score-navigation`, `tutorial`, browser |
| Tutorial curriculum, eight-bar clock, dedicated lesson UI | `tutorial.js`, `tutorial-view.js`; mode lifecycle in `melody-view.js` | `tests/tutorial.test.mjs`, browser |
| Drum tutorial, mirrored Beat course, staged rhythm practice and sessions | `drum-tutorial.js`; category navigation in `melody-view.js` | `drum-tutorial`, browser |
| Shared tutorial score, stamp and count label | `tutorial-view.js`; count sound in `tutorial.js` | `tests/tutorial.test.mjs`, browser |
| Instrument and chord choice menus | `choice-menu.js`, `part-steppers.js` | browser |
| Song session and melody arrangement octave control | `part-steppers.js` (`octaveControl`), `song-session.js`, `melody-arrange.js` | browser |
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
| Studio melody, bass, backing and drum editor mounting, rhythm palette and score preview for melody, step entry and playback | `studio-editors.js`, `melody-arrange.js`, `progression.js` | `melody-arrange`, `progression`, browser |
| Studio style envelope and shared pitch bounds | `studio-style.js`; apply order in `app.js` | `studio-style`, `app-settings` |
| Basic parts, section knobs and reference header | `main-controls.js` | browser |
| Phone tempo entry and shared knob handling | `main-controls.js`, `reference-timing-view.js` | `tempo-entry`, browser |
| Quick mixer, accompaniment pads and shared choice fields | `quick-mixer.js`, `part-steppers.js` | `part-steppers`, browser |
| Reference waveform, timing and key assistance | `reference-timing-view.js` | `reference-timing-view`, browser |
| Mobile score editor | `score-pad.js`, mobile toolbar in `chord-grid.js` | browser |
| Reference audio playback and import lifecycle | `reference-player.js` | `reference-player`, browser |
| Reference import processing and PCM encoding | `reference-import.js`, analysis worker modules | `reference-import`, `reference-player` |
| File serving/stems | `server.mjs`, `server/` | server tests |
| Appearance | `appearance-dialog.js`, `skins.js`, `style.css`, `skins.css` | browser |
| Portable settings | `arrangement-file.js`, browser control rules and events in `arrangement-controls.js`, application order in `app.js`, legacy section migration and defaults in `song-score.js` | `arrangement-file`, `app-settings`, `song-score` |
| Score MIDI encoding and download | `score-midi.js`, download wiring in `melody-arrange.js` | `score-midi` |

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

Studio shows a continuous score with numbered bars and starts new arrangements with one range. Version-1 files can still carry multiple ranges, whose settings take effect during playback. `Section.key` and `Section.style` are optional version-1 fields; missing keys inherit the song key. Key lookup and voicing cache signatures include the section key, so previews and scheduled accompaniment agree across range boundaries.

Studio chord headings edit optional per-bar BPM, meter changes and absolute key overrides. Meter and BPM changes carry forward until the next explicit change. Version-1 JSON stores them in the top-level `barSettings` object, keyed by zero-based bar number. Playback and seeks resolve overrides before the inherited range and song settings.

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

The Studio editor mounting, style envelope validation and scheduling now have separate entry points. Edited melody and bass still have distinct meter conversions: melody clips the four-beat grid to the current meter, while bass scales that grid across the bar. Empty edited bass means silence. Preserve both contracts when changing scheduling.

Version-1 control rules are read from the current browser controls before decoding. The application still applies style, controls, mixer and score in the existing order. Score MIDI encoding is independent of the browser download; the MIDI reader verifies pickups and note boundaries. The score input dock uses its later shared CSS rules. Broader CSS consolidation needs computed-style comparison across skins and viewport sizes.

Large preset/timbre tables are mostly data and are lower priority. Do not migrate frameworks, introduce global state infrastructure, or split data files solely to reduce line counts. Free/Full still share one implementation.

## Selection lobby

Mode and tutorial-instrument selection use the shared Vue selector in `melody-view.js`: browsing changes the preview, and a separate confirmation enters the mode. New mode entries belong in its option data. The planned curated-MP3 mode (“曲でセッション”) is a preview-only, unavailable entry; it does not load audio or claim a catalog exists. A future catalog should provide preconfigured source timing and session settings before enabling entry.

`arrangement-selects.js` owns the style list, selected-detail preview and explicit application through the existing `chooseStyle` path. `selection-browser.css` supplies its responsive appearance. The song/settings dialog remains JSON save/load. Validate preview/cancel without changing active music, confirmation, keyboard focus, and narrow screens.

スタイルのメロディプリセットは `scripts/set-melody-preset.mjs` でMIDIから登録し、`dist/melody-presets.js` のノートを `progression.js` が伴奏と一緒に予約します。

The Studio drum editor in `melody-arrange.js` shows one 16-step bar with eight pad rows, backed by the same full-song notes and undo history. Existing off-grid notes are preserved and reported. The Studio places part settings and pickup above the shared score and accompaniment pads below the entry controls. Studio backing and drum pads write into the shared four-beat score grid. Backing stores the voiced pitches at each step and drums store the pad index. Recorded tracks replace their generated patterns during playback, and the optional `studioAccompaniment` field carries both tracks in version-1 arrangement files.

The Studio drum kit UI lives in `quick-mixer.js`. `DrumSynth` in `rhythm.js` owns the eight decoded WAV slots and uses the existing drum mixer and audio clock. Slots are session-only; version-1 arrangements retain pad indices. Unassigned pads use the synthesized sound.

Studio drum display order and WAV slot labels share the layout in `rhythm.js`. Display positions are separate from the pad IDs stored in version-1 scores.

Bundled drum kits are listed in `dist/drum-kit-manifest.js` and served from `dist/samples/` by both static hosting and the development server. `npm run drum:kits` copies the source WAVs and regenerates the manifest. Local drum kits are also discovered from folders under `~/Desktop/Otto用素材/電子ドラムサンプル/` by `server/drum-kits.mjs`. The existing drum timbre control selects a kit. `app.js` loads and decodes the files together, with a generation guard for changes while loading. Arrangement settings store the folder name, not audio files; static hosting only exposes bundled kits.
