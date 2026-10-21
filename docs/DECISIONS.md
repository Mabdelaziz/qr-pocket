# QR Pocket — Decisions (ADR log)

Format: ID · Date · Status · Decision · Rationale · Trade-offs. All Phase 0 entries are **Proposed** until the owner approves. Library facts below come from prior knowledge, not from this session's execution; versions/licences must be confirmed in the first cloud run.

## ADR-001 · 2026-10-21 · Proposed · Vite + TypeScript (strict), vanilla DOM, plain CSS
- Why: two screens and a few dialogs; smallest bundle; no framework churn; matches CLAUDE.md.
- Trade-off: manual DOM wiring and focus management for dialogs; mitigated by small view modules and Playwright a11y checks.
- Alternatives: Preact (~4 KB) — viable if UI code grows; React — rejected (size, unnecessary).

## ADR-002 · 2026-10-21 · Proposed · QR encoder behind our own `qr/encode` wrapper
Candidates:
| Library | Licence | Pros | Cons |
|---|---|---|---|
| **qrcode-generator 2.0.4** (kazuhikoarase) (recommended, registry-verified 2026-10-21) | MIT | npm package exists; no runtime deps; ships types + ESM; long-lived | Older code style; UTF-8 byte mode must be set up and tested explicitly; unpacked size 555 KB (shipped bundle size must be measured in CI) |
| Nayuki QR-Code-generator (TypeScript port in the GitHub repo `nayuki/QR-Code-generator`, `typescript-javascript/`) | MIT | Readable, explicit ECC/segments, 847 commits, actively copyrighted 2026 | **No npm package under `@nayuki/qr-code-generator`: registry returned 404 (the Phase 0 draft assumed it existed — corrected).** Would have to be vendored (copy file + licence header) |
| qrcode (node-qrcode) | MIT | Popular | Larger, Node-oriented, not re-checked; unneeded features |
- Decision (Proposed, revised at Phase 1): use **qrcode-generator** from npm behind our wrapper (lockfile, `npm audit`, normal updates). Keep **vendoring Nayuki's TS file** as fallback if the bundle-size gate or Arabic round-trips fail. Final confirmation by CI: licence, audit, bundle size, decoder round-trips (Arabic, emoji, URL).
- Not yet verified (honest status): UTF-8/Arabic interoperability and shipped size — CI only. Nayuki TS port exports/types not read.
- Independent decoders (dev-only): **jsQR 1.4.0** (Apache-2.0, no deps, last release 2021 — fine for a test oracle, flagged) and **zxing-wasm 3.1.6** (MIT, deps `type-fest`, `@types/emscripten`, Node ≥ 22.12 not required at runtime for browsers; used in tests only).
- Trade-off: encoder maintenance is low-risk because QR Model 2 is a frozen standard and tests prove behaviour.

## ADR-003 · Proposed · Own canvas renderer, integer module scale
Why: crisp output, exact 1024×1024, control of quiet zone, no library renderer dependency. Trade-off: ~40 lines to own and test.

## ADR-004 · Proposed · Hand-written IndexedDB wrapper (no `idb`)
Why: one store, four operations; avoids dependency. Trade-off: must test error paths ourselves (fake-indexeddb + injected failures). Revisit if schema grows.

## ADR-005 · Proposed · `vite-plugin-pwa` (Workbox generateSW) for the service worker
Why: precache manifest with revisioned URLs and safe cleanup is easy to get wrong by hand; plugin is widely used and maintained. Meets CLAUDE.md "clearly worthwhile" test.
Trade-off: dev-dependency only (Workbox code is bundled into `sw.js`); confirm plugin version supports the installed Vite major in CI. Fallback: ~60-line hand-written SW with build-time file list.

## ADR-006 · Proposed · Hash-based routing (`#/generate`, `#/saved`)
Why: GitHub Pages has no SPA rewrites; hash routes work under `/qr-pocket/` and offline without 404 fallbacks. Trade-off: slightly uglier URLs.

## ADR-007 · Proposed · ECC policy
**Revised 2026-10-21 per owner (G1).** Default **M**. Error correction is **never downgraded automatically**. If content exceeds M capacity: show an understandable error stating byte count and the M limit, and offer an explicit button "Use lower error correction (L)" if it would fit at L; if it exceeds L too, show the L limit with no option. Choosing L is a visible, per-session state ("Error correction: Low") with a "Back to Medium" control; saved records store the ecc actually used. Never silently truncate. No general ECC picker in MVP. Trade-off: one extra tap for very long text; L codes scan less reliably when damaged/dirty (explained in the notice).

## ADR-008 · Proposed · CI/release gating
- PR/branch push: install (`npm ci`), typecheck, lint, unit, build, Playwright; **no deploy**.
- Deploy: `workflow_dispatch` only (initially) from `main`, requires the same gates green in the same run, uses `actions/upload-pages-artifact` + `actions/deploy-pages`, permissions `pages: write`, `id-token: write`, `contents: read`.
- Why: honours "no auto-publish". Trade-off: one extra manual click per release.

## ADR-009 · Proposed · Shared-origin hygiene on `github.io`
Prefix all DB/cache/localStorage names with `qr-pocket`; SW scope `/qr-pocket/`. A custom domain is out of scope; if later adopted, revisit.

## ADR-010 · Proposed · Naming
Repo/folder/Vite base = `qr-pocket` (CLAUDE.md is authoritative; `info.txt` mentions `QRCodeGeneratorProject` — stale).

## ADR-011 · 2026-10-21 · Proposed · Toolchain versions and CI Node version
Registry check on 2026-10-21 (declared metadata only; nothing installed or run): vite 8.3.4 (Node ^20.19 || >=22.12), vitest 5.0.5 (Node ^22.12 || ^24 || >=26; vite ^6.4/^7/^8), vite-plugin-pwa 2.0.0 (peer vite up to ^8; Node >=20.19), @playwright/test 1.64.1, fake-indexeddb 6.2.6, @axe-core/playwright 4.14.0 (Node >=22.12). Decision: CI uses **Node 22 LTS** (satisfies all engines). Exact versions are pinned by `package-lock.json` created by the first cloud run; compatibility is only *declared*, not proven, until CI passes. Re-check versions right before scaffolding (Phase 2).

## ADR-012 · 2026-10-21 · Approved by owner · Phase 1 UI decisions
- Share button hidden when file sharing unsupported, replaced by a short explanation line ("Sharing files isn't supported in this browser — use Download."); Download always available. (Owner allowed "hide or disable with explanation"; design shows the explanation text, not an inert button.)
- Saved-item actions are visible text buttons (Open, Rename, Download, Share, Delete) — no icon-only menus.
- Rename and Delete use native `<dialog>`.
- Early branch-only CI after Phase 1 (G2 still required for any repo creation or push; Pages not enabled).
- Packages verified before use: see ADR-002/ADR-011.

## ADR-013 · 2026-10-21 · Proposed (G1b) · Visual system v2 (Soft Modern / Minimal Utility)
- Decision: adopt the owner-specified tokens (#F5F7FB bg, #FFFFFF surface, #155EEF primary, #172033 text, #64748B muted, #E5EAF2 borders, 12–16px radius, 4/8/12/16/24/32 spacing, system fonts) as vanilla CSS custom properties; own inline SVG icons; no frameworks, icon libraries, web fonts, gradients.
- Deviation for accessibility: add `--muted-text` #55637A for small text on the page background (#64748B is 4.44:1 there); darker field border #8391A6 (3.2:1) because #E5EAF2 is decorative only.
- Notifications are inline (not floating); status uses icon shape + text; disabled actions carry no separate message.
- Rejected for now: always-visible error-correction selector (reviewer suggestion) — conflicts with ADR-007; revisit only on owner request.
- Trade-off: 12px action labels and 13px hints are small but scale with text size; accepted for compact Saved cards.

## ADR-014 · 2026-10-21 · Proposed · UTF-8 byte conversion for qrcode-generator, and the ECI question
- Finding (read from the package's own ESM source, 2.0.4): Byte mode converts text with the replaceable `qrcode.stringToBytes`, whose default keeps only `charCodeAt(i) & 0xff`. Arabic, emoji, € and any non-Latin-1 text would be silently corrupted.
- Decision: `src/qr/encode.ts` replaces it at module load with `TextEncoder` UTF-8, and a regression test (T-001-2c) plus decoder round trips (T-001-2/2b) guard it. Text with a lone surrogate is refused ('failed') rather than substituted with U+FFFD, using a hand-written `hasLoneSurrogate()` (tests/unit/surrogates.test.ts) so browsers without `isWellFormed` are covered.
- Open risk (unverified): the library emits no ECI segment, so a reader that guesses charsets (ZXing does) might misread non-ASCII UTF-8; phone scanners may behave the same. T-001-2b measures ZXing; the physical-phone test U4 covers real scanners.
- Contingency if T-001-2b or U4 shows misreads: emit an ECI 26 (UTF-8) header for non-ASCII payloads. `qrcode-generator` cannot do this; it would require the vendored Nayuki encoder (segment API with ECI) behind the same `encode()` contract — a new ADR and owner decision, and a re-run of all decoders including jsQR.

## ADR-015 · 2026-10-21 · Proposed · Toolchain pins and typing for Phase 2
- TypeScript pinned to **5.9.3** (registry-verified to exist): the registry's `latest` is 7.0.2, which typescript-eslint 8.72.0 does not support (peer `<6.1.0`). Revisit when typescript-eslint supports it.
- `qrcode-generator` ships a global-script `.d.ts` that is not a module; types are provided by `src/types/qrcode-generator.d.ts` via tsconfig `paths` (types only; runtime still resolves the real package).
- `.npmrc`: `ignore-scripts=true`, `save-exact=true`. Playwright browsers are installed explicitly in CI.
- E2E/preview bind `127.0.0.1:4173` (avoids IPv6-only `localhost` binding on Node 22).
- CI triggers: `pull_request` and pushes to `main` (avoids duplicate runs on PR branches); every check after `npm ci` runs even if an earlier one fails so a single cloud run reports all problems.
- Viewport meta uses `interactive-widget=resizes-content` and an in-flow, scrollable layout so actions stay reachable with the on-screen keyboard.

## ADR-016 · 2026-10-21 · Proposed · Phase 3 design decisions (library, export, share)
- **Ordering:** the Saved list is newest first by `createdAt` (strictly increasing within a session), so renaming never reorders items. This refines the earlier "newest-updated first" wording; `updatedAt` is still stored. Index `createdAt` replaces `updatedAt`.
- **Save state is keyed on exact text + error-correction level** (`contentKey`). Any change resets it; saving then creates a **new** record (`IDBObjectStore.add`, never `put`). Rapid repeats are ignored by an `aria-disabled` + state guard. Opening a saved item marks its content as saved; deleting the record resets the state. After a reload the state is empty, so a deliberate second save creates a second record (no cross-session duplicate detection).
- **Source field:** records carry `source: 'typed' | 'scanned'`; only `'typed'` is written in 1.0 (schema allowance for V1.1 camera scanning, nothing else).
- **Storage failures never block generation or export;** `StoreError` kinds `unavailable | quota | not-found | invalid | unknown` are mapped to specific, honest messages (never "saved" on failure). Unreadable `indexedDB` access at load is treated as unavailable.
- **PNG export layout:** pure pixel function (`renderExportRgba`) decoded directly in tests, then encoded by canvas. Largest **even** integer module scale that fits 1024, symbol centred → exactly symmetric padding (even scale × odd `modules+8` keeps the symbol side even). Consequences: version-40 symbols export at 4 px/module (5 would break symmetry); the quiet zone is ≥ 4 modules plus extra white padding. 1024×1024, black on white, opaque, no anti-aliasing.
- **Filenames:** `qr-<slug>-yyyymmdd.png`; Arabic letters and combining marks kept; control/bidi/zero-width characters stripped using ranges built from code points (no invisible characters in source); ≤ 60 characters.
- **Share:** only the PNG `File` is shared (no title/text/url) so the payload is never sent as text; feature-detected once at load with a probe file; Share is hidden with an explanation when unsupported; `AbortError` is silent.
- **Navigation/dialogs:** hash router (`#/generate`, `#/saved`), bottom navigation in normal flow; native `<dialog>` + `showModal()` for rename/delete; Esc is ignored while a change is being written; focus returns to the opener or the nearest surviving control. The Saved list is rebuilt from storage on every visit and thumbnails are drawn lazily (IntersectionObserver) and discarded on leave.
- **Test environment:** browser tests inject faults by wrapping the real IndexedDB prototypes; native Web Share is disabled by default in tests and stubbed where needed so results do not depend on the runner's browser.

### Updates after Phase 3 CI evidence (2026-10-21)
- **ADR-014 outcome:** with no ECI segment, ZXing read every QR version 1–40 (filled to capacity at Low, diverse content) and all 14 payload cases, including long Arabic, diacritics, bidi controls and emoji sequences, from the real exported pixels. jsQR reads 39 of 40 versions; version 23 is unreadable by jsQR at any scale (a limit of that library). The ECI contingency is **not triggered by CI**; real phone scanners (UAT U4) remain the open question.
- **ADR-016 additions:** (a) canvases used for export/preview are created with `willReadFrequently: true` (CPU memory) because GPU readback made `toBlob` stall intermittently on the CI runner; (b) PNG encoding has a 15 s watchdog so the UI can never stay busy forever; (c) IndexedDB transactions are aborted manually only for non-request failures (a request error already aborts; a second `abort()` is an error); (d) Esc is ignored while a rename/delete is being written; (e) the Generate preview is redrawn when its view becomes visible (a QR loaded while hidden has no measurable width).
