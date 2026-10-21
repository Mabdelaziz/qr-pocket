# QR Pocket — Phase 3 report (SPEC-002 local library, SPEC-003 PNG export and sharing)

Date: 2026-10-21 · Branch `phase-3-library-export` · [PR #3](https://github.com/Mabdelaziz/qr-pocket/pull/3) · Verified by [CI run 39642640265](https://github.com/Mabdelaziz/qr-pocket/actions/runs/39642640265) (commit `421ab72`). Evidence details: `docs/PROGRESS.md`, `docs/TRACEABILITY.md`.

## Implemented
- **Local library (SPEC-002):** versioned IndexedDB store (`qr-pocket` v1, store `codes`) with add-only writes, durable on transaction completion, typed errors; records hold id, title, exact payload, ECC level, `source` (`typed`; `scanned` reserved for V1.1), `createdAt`/`updatedAt`, `v`; no image data. Saved screen (loading / empty / error / list, newest first, lazy thumbnails), Open, Rename and Delete in native dialogs, hash routing with bottom navigation.
- **Save behaviour:** Save is keyed on exact text + error-correction level; rapid repeats create one record, any change resets it (new record, never an overwrite), deleting the record resets it. Storage failures show specific messages and never block generating or exporting.
- **Export and share (SPEC-003):** 1024 × 1024 black-on-white PNG at the largest even integer module scale (symmetric padding, quiet zone ≥ 4 modules), safe filenames (`qr-<slug>-yyyymmdd.png`, Arabic kept), download with object-URL cleanup, Web Share of the PNG file only (hidden with an explanation when unsupported), cancellation handled separately from errors. Everything is derived from the stored payload on demand.

## Files modified (PR #3 vs `main`: 41 files, +3,851 / −195)
- **New source:** `src/store/{types,titles,indexedDb}.ts`, `src/export/{png,filename,download}.ts`, `src/share/share.ts`, `src/ui/{dom,panels,announce,router,dialogs,saved,savedModel,saveState}.ts`.
- **Changed source:** `index.html`, `src/main.ts`, `src/ui/{generate,model}.ts`, `src/styles/app.css`.
- **New tests:** unit `store, titles, saveState, savedModel, filename, share, export-png, surrogates, encode-failure`; browser `library.spec.ts`, `export.spec.ts`, helpers (`app.ts` fault injection, `png.ts` independent PNG reader).
- **Config/docs:** `package.json` + `package-lock.json` (+ `fake-indexeddb` 6.2.6, dev only), `playwright.config.ts` (expect timeout), SPEC-002/003, ADR-016 and updates, PROGRESS, TRACEABILITY, TEST_PLAN, ARCHITECTURE, README.

## Tests (CI run 39642640265)
Unit **180 passed / 0 failed / 0 skipped**; browser (Chromium) **91 passed / 0 failed / 0 skipped**; typecheck, ESLint, build, size, `npm audit` (0 vulnerabilities) and licence checks passed. Bundle **21.44 KB gzip** (budget 150 KB).

## Storage, Unicode and PNG interoperability
- Storage: Unicode/Arabic payloads (14 cases) stored and read back byte-exact; verified both through the app and by reading the real database directly; failures injected into the real IndexedDB prototypes (open, add/quota, put, delete, getAll) are reported, leave no partial records, and recover on retry.
- PNG: downloaded files are parsed by an independent PNG reader (1024 × 1024, only pure black/white opaque pixels, symmetric margins, whole even pixels per module) and decoded by **two** decoders. ZXing reads every QR version 1–40 filled to capacity; jsQR reads 39 of 40 (**version 23 unreadable by jsQR**, a library limit). A version-40 payload (2,953 bytes at Low) exports at 4 px/module and decodes.

## Browser and accessibility findings
axe (WCAG 2.0–2.2 A/AA) reports 0 violations on: empty, populated and error Saved states, both dialogs, share-available, export-error and saved states. No horizontal overflow and ≥ 48 px targets at 320/360/430 px and at 150%/200% text. Keyboard flows (card actions, modal dialogs, Esc, focus restoration), single announcement channel, and privacy (no cross-origin requests, no console/CSP errors, no request containing the payload) are covered. Limits: Chromium only; real screen reader, real on-screen keyboard and native Web Share are not exercised.

## Remaining risks
1. Physical phones are untested (Arabic with two real scanners, QR sharpness at fractional pixel ratios, Share to real apps, Downloads location, TalkBack).
2. Browsers other than Chromium (IndexedDB and `<dialog>` behaviour) are untested.
3. The `toBlob` stall root cause (GPU readback) is inferred, not proven; mitigated by CPU-backed canvases and a watchdog.
4. Browser storage can be cleared or evicted; no backup exists and none is claimed (`storage.persist()` is not requested).
5. No ECI segment is emitted; fine for ZXing in CI, unknown for phone camera apps (ADR-014 contingency).
6. Test-only: Web Share is stubbed; fault injection wraps the real IndexedDB prototypes but cannot reproduce every browser failure.

## Proposed Phase 4 plan (SPEC-004 PWA and offline) — tests first, same loop
1. **Specify:** confirm SPEC-004 acceptance criteria; decide icon production (SVG source → PNG 192/512/maskable generated deterministically in CI or committed after CI generation; no local tooling).
2. **Tests first:** manifest validation on `dist/` (fields, icon files and sizes, `start_url`/`scope`/`id` = `/qr-pocket/`); Playwright: service worker registers under `/qr-pocket/`, offline reload (`context.setOffline`) keeps Generate, Saved, Download working; update flow with two builds (waiting worker → banner → Reload); no payload in Cache API; no cross-origin requests.
3. **Implement:** `vite-plugin-pwa` 2.0.0 (prompt-based updates, precache build output only, `navigateFallback`), manifest + icons, offline chip, update banner, install hint (`beforeinstallprompt`), "offline ready" note; CSP gains `worker-src 'self'` and `manifest-src 'self'` only.
4. **Review and CI:** independent static review, push to `phase-4-pwa`, repair loop, record evidence; Pages stays disabled until the release phase.
5. **Open decisions for you:** icon artwork (use the current logo mark?), install-prompt wording, and whether the manual `deploy.yml` (Phase 5) is prepared inside Phase 4.
