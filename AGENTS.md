# oto development

This directory is the standalone oto music app, not the parent research-vault/Tauri app.
Use `README.md` for startup and `docs/ARCHITECTURE.md` for ownership and validation.
Keep its established Milk UI and musical behavior unless the user requests a change.

## 公開方針と開発対象

- 開発を始める際は、[公開と収益化の検討方針](docs/RELEASE_STRATEGY.md)を参照する。無料Web版と、Stem分離・作り込み機能を持つ有料ローカル版が有力案。確定事項と検討案を区別する。
- 通常の開発対象はFull版（有料提供候補を含む全機能）とする。無料版の範囲を理由に、依頼された機能や既存機能を削除・制限しない。これは未依頼の機能を先回りして実装する指示ではない。
- 無料版とFull版は共通コードを基本とし、提供機能を一か所で管理する方針。提供機能は `dist/features.js` で管理する。通常起動はFull版、`npm run dev:free` は無料版プレビュー。Stem分離以外の料金境界は未確定。公開設定と開発用設定、実行環境の対応可否、購入権限は区別する。

## 設計方針

- 操作はシンプルに、見た目は親しみやすく、音楽には真面目に。マリオやカービィのように、最初のひと押しで遊び始められ、触り続けるうちに奥深さがわかる体験を目指す。
- 機能は説明文で教えず、配置・形・アイコン・音・操作直後の反応で伝える。操作名、必要な状態表示、エラーからの復帰に必要な文言は短く明確にし、読み上げ用のラベルも備える。
- 機能を足すときは、既存の操作にまとめられるかを先に考える。同じ目的の操作は一か所に集め、細かい調整は必要になったときに開けるようにする。
- 鳴らしながら試せることを基本にする。奏法・コード・キー・スタイル・Ottoの役割を変えても再生を保ち、音楽的な区切りで変更を反映する。原曲と伴奏は同じ再生操作と拍の基準を共有する。
- 音の質は実際の演奏で判断する。Ottoは音数より音選び・長さ・音のつながりを大事にし、コードやノリに沿って返す。彩りは基本パートと役割が重ならないよう、音域や音色、入る位置で補い合う。

## UI変更の必須手順

- 配置・文言だけの変更も含め、UIを触る前に [otoのデザインシステム](docs/DESIGN_SYSTEM.md) を読み、同じ役割の部品が使われている箇所を探す。既存コンポーネントを優先し、共通CSSで実装されている部品はクラスとマークアップをセットで再利用する。DOMの移動や組み替えでは、スタイルが依存する親要素と状態属性も確認する。
- 既存部品で対応できない場合は、共通部品の拡張を先に検討する。新しい見た目が必要な場合も `dist/skins.css` のトークンを使う。ネイティブ入力のキーボード操作と読み上げを保ちながら、標準のラジオの丸印や灰色のボタンが意図せず露出する実装は完了としない。
- 完了前にブラウザーで対象画面を開き、既存の同種の部品と並べて見た目を確認する。操作して押下・選択後の状態を確認し、該当する場合はキーボードフォーカス、無効状態、狭い幅でも確認する。確認できなかった項目があれば報告する。

## Work efficiently

- Locate the relevant symbol with `rg` before reading files. Read only the affected modules and their tests; do not ingest all presets, CSS, vendor code, or historical design notes.
- `dist/` is authored source, not generated output. There is no build step. Do not edit vendored runtime files. Vue owns the transport, drum grid, chord monitor, and settings dialogs. Keep audio scheduling and score state outside Vue. Add new Vue components only at a clear UI boundary.
- `app.js` は初期化・音楽操作・モジュール連携を担当する。画面の描画や操作部品は `docs/ARCHITECTURE.md` の担当Vueモジュールへ追加し、inline `createApp` や同じ選択UIの再実装を戻さない。音色・パターンの選択は `part-steppers.js` の共通部品を利用する。Vueで管理中の子DOMを外から組み替えず、画面を破棄するときはunmountする。
- Use native ES modules, Web Audio, Tone.js, and strict checked JSDoc. Separate pure musical/analysis rules from DOM and server I/O.
- Preserve public exports and version-1 arrangement files. Transport, quantization, note-off ordering, style changes during playback, and stale async results need special care.
- Avoid unlimited caches and caches keyed by mutable object identity. Never move audio scheduling to requestAnimationFrame.
- Do not call remote AI services or upload reference audio. Stem separation is explicit local Demucs work, not a startup task.

## 変更を重ねるときのルール

- 音色・奏法・演奏モードの適用は `part-settings.js` の既存経路を使う。手動操作・スタイル変更・セクション切り替え・設定復元で適用処理を複製しない。新しい保存項目を追加する場合は、旧設定に項目がない場合の既定値と、保存・読み込みの往復を確認する。
- イベント購読・タイマー・試聴などは、それを開始したモジュールが解除する。画面の破棄やファイルの差し替え後に、古い処理結果が現在の状態を書き換えないようにする。
- 担当モジュールや確認方法を変えたら、`docs/ARCHITECTURE.md` の該当行も更新する。今回必要な範囲を越える整理は別の変更に分け、残す負債は具体的な影響と着手条件を記録する。

## Validation proportional to the change

1. Run the affected `node --test tests/<name>.test.mjs` files while editing.
2. At integration, run `npm run typecheck` and `npm test` once. Repeat only for new changes or unresolved failures.
3. UI/worker/audio lifecycle changes need browser smoke checks. Use synthetic audio and temporary settings, never real user data.
4. Pure style/content changes do not need new tests mirroring their implementation.
5. The parent Tauri build, Rust checks, vault tests, dependency reinstall, and Demucs model download do not validate this standalone app. Do not run them unless that scope actually changes.
6. Do not run expensive real stem inference for every edit; use injected server fakes for protocol tests. Run real inference when the Demucs integration changes.

スタイル・セクション・設定復元の連携を変えたときは、`tests/app-settings.test.mjs` を実行する。再生中の挙動を変えた場合は、対象条件で音色・コード・再生位置の組み合わせをブラウザーでも確認する。

No watch-mode checks or automated full suites run in the browser or on each request.
