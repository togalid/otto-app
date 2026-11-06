# Runtime refactor: preserve native modules, isolate expensive work

Status: implemented, 2026-11-06.

## Decision

Retain native browser ES modules + Web Audio/Tone.js + Node HTTP + checked JSDoc. No added framework or dependency. The observed problems were repeated work and coupled responsibilities, not framework throughput. Keep the existing UI and musical output.

Separate pure reference DSP, worker request lifecycle, melody presentation, static serving, and stem execution. Keep composition in app.js; avoid an unrelated all-at-once rewrite of settings, CSS, and score representation.

## Evidence

Synthetic Node measurements on the development machine (not real-device latency promises):

- 16s / 22.05kHz key + progression analysis median: 196.1ms → 71.3ms. Precomputed Hann window/frequency coefficients; characterized key, ordering, score preserved.
- 288 Otto phrase cases: before 293/297/289ms; after 222/218/220ms. Hash comparison preserves exact phrase output.
- Ten steady-note UI ticks: zero repeated pad/key attribute writes after first highlight. Melody view also reuses its palette for 100 unchanged harmony updates.
- Unchanged HTTP assets respond 304 with no body. Local Tone.js alone is 345,500 bytes no longer retransferred on revalidation. Cache is bounded by public allowlist and invalidated using stat metadata.
- Existing whole suite plus regressions: 154 tests passed, about 464ms in the integration run. No evidence justifies deleting tests to save runtime. Checks do not run during normal app use.

## Verification

- Strict JSDoc typecheck passed.
- 154 Node tests passed, including worker failure/retry/cancel, HTTP invalidation/recovery/access control, stem busy/cancel, musical output equivalence, and differential DOM updates.
- Browser: app boot, Otto start/stop, style switch while running, temporary synthetic WAV load, real module Worker analysis and application, successful four-stem result, and range change invalidating stems. No browser error logs observed.
- Local server restarted with the existing temporary Demucs installation/model configuration.

## Limits

No claim of measured end-to-end audio latency or quality improvement. DSP algorithms and presets intentionally unchanged. Real mobile profiling, long-session audio-node counts, CSS consolidation, and deeper app.js/settings decomposition remain separate work. Demucs CPU cost is not made cheaper per inference; unchanged results are reused and obsolete requests cancelled. No paid LLM API exists in this app. Scoped AGENTS.md and architecture map reduce coding-agent context and unrelated checks; actual token savings have not been measured.
