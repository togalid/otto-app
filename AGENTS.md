# oto development

This directory is the standalone oto music app, not the parent research-vault/Tauri app.
Use `README.md` for startup and `docs/ARCHITECTURE.md` for ownership and validation.
Keep its established Milk UI and musical behavior unless the user requests a change.

## 設計方針

- 操作はシンプルに、見た目は親しみやすく、音楽には真面目に。マリオやカービィのように、最初のひと押しで遊び始められ、触り続けるうちに奥深さがわかる体験を目指す。
- 機能は説明文で教えず、配置・形・アイコン・音・操作直後の反応で伝える。操作名、必要な状態表示、エラーからの復帰に必要な文言は短く明確にし、読み上げ用のラベルも備える。
- 機能を足すときは、既存の操作にまとめられるかを先に考える。同じ目的の操作は一か所に集め、細かい調整は必要になったときに開けるようにする。
- 鳴らしながら試せることを基本にする。奏法・コード・キー・スタイル・Ottoの役割を変えても再生を保ち、音楽的な区切りで変更を反映する。原曲と伴奏は同じ再生操作と拍の基準を共有する。
- 音の質は実際の演奏で判断する。Ottoは音数より音選び・長さ・音のつながりを大事にし、コードやノリに沿って返す。彩りは基本パートと役割が重ならないよう、音域や音色、入る位置で補い合う。

## Work efficiently

- Locate the relevant symbol with `rg` before reading files. Read only the affected modules and their tests; do not ingest all presets, CSS, vendor code, or historical design notes.
- `dist/` is authored source, not generated output. There is no build step. Do not edit vendored runtime files. Vue owns the transport, drum grid, chord monitor, and settings dialogs. Keep audio scheduling and score state outside Vue. Add new Vue components only at a clear UI boundary.
- Use native ES modules, Web Audio, Tone.js, and strict checked JSDoc. Separate pure musical/analysis rules from DOM and server I/O.
- Preserve public exports and version-1 arrangement files. Transport, quantization, note-off ordering, style changes during playback, and stale async results need special care.
- Avoid unlimited caches and caches keyed by mutable object identity. Never move audio scheduling to requestAnimationFrame.
- Do not call remote AI services or upload reference audio. Stem separation is explicit local Demucs work, not a startup task.

## Validation proportional to the change

1. Run the affected `node --test tests/<name>.test.mjs` files while editing.
2. At integration, run `npm run typecheck` and `npm test` once. Repeat only for new changes or unresolved failures.
3. UI/worker/audio lifecycle changes need browser smoke checks. Use synthetic audio and temporary settings, never real user data.
4. Pure style/content changes do not need new tests mirroring their implementation.
5. The parent Tauri build, Rust checks, vault tests, dependency reinstall, and Demucs model download do not validate this standalone app. Do not run them unless that scope actually changes.
6. Do not run expensive real stem inference for every edit; use injected server fakes for protocol tests. Run real inference when the Demucs integration changes.

No watch-mode checks or automated full suites run in the browser or on each request.
