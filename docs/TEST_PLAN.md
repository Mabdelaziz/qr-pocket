# QR Pocket — Test Plan

Status: DRAFT (Phase 0). **T-001-*, T-002-*, T-003-* PASSED in cloud CI run 39642640265 on 2026-10-21 (180 unit + 91 browser tests, Chromium); PWA/offline (T-004-*), deploy and all physical-phone UAT items are still NOT RUN.** Nothing executes locally; "local testing" = source inspection only (diff review, type/logic reading, a11y/security read-through), recorded as *inspection*, never as a pass.

## 1. Environments
| Where | What runs |
|---|---|
| Laptop | Edit files, inspect diffs. No npm, no browsers, no builds. |
| GitHub Actions (hosted runner, after owner authorisation) | `npm ci`, typecheck, lint, Vitest, build, Playwright, audit, size gate. |
| Owner's Android phone (Chrome) | UAT matrix §5 against the deployed HTTPS URL. |

## 2. Automated matrix (CI)
IDs trace to specs. Titles in code must start with the spec ID, e.g. `SPEC-001: rejects blank input`.
| ID | Area | Case | Tool |
|---|---|---|---|
| T-001-1 | Input | empty, spaces-only, tabs/newlines-only rejected (`tests/unit/encode.test.ts`, `model.test.ts`; `tests/e2e/generate.spec.ts` AC1) | Vitest + Playwright |
| T-001-2 | Input | 14 payload cases (`tests/unit/helpers/cases.ts`: ASCII, URL, Arabic short/long/diacritics, mixed RTL/LTR, bidi controls, emoji incl. ZWJ, €/é, multiline, spaces, decomposed Unicode) **decode byte-exact** via jsQR (unit + real canvas pixels in the browser) | Vitest + Playwright |
| T-001-2b | Interop | same cases via a **second** decoder, ZXing (WASM). A failure may be a real finding (no ECI; charset guessing) | Vitest |
| T-001-2c | Regression | `qrcode-generator` default lossy `stringToBytes` replaced by UTF-8 (€ → E2 82 AC, é → C3 A9) | Vitest |
| T-001-3 | Capacity | 2953 bytes at L OK; 2954 → too-long; between M and L limits → error with `fitsAtL` and **no** automatic downgrade; L only after explicit choice; byte (not char) counting for Arabic/emoji | Vitest + Playwright |
| T-001-4 | Render | quiet zone exactly 4 modules, integer scale, black/white only, real canvas pixels (`layout.test.ts`, e2e AC6) | Vitest + Playwright |
| T-001-5 | Responsive | 320/360/390/430 px, long unbroken URL, 150% / 200% text scaling, short viewport (keyboard), square preview, no horizontal overflow | Playwright |
| T-001-6 | Direction | Arabic content → `:dir(rtl)`, Latin → `:dir(ltr)` | Playwright |
| T-001-7 | A11y | axe (WCAG 2.0–2.2 A/AA) on empty, success, Arabic, blank, M-overflow warning, too-long error, Low state; keyboard order and focus after Use-Low/Back; every control ≥ 48px; status region announces changes; alert not rebuilt while typing | Playwright |
| T-001-8 | Privacy/CSP | no cross-origin or failed requests, no console errors (CSP violations), strict CSP meta | Playwright |
| T-002-1 | Store | add/list/get/rename/remove; newest-first by createdAt (renames do not reorder); `add` never overwrites (id collision rejected); 20 concurrent adds; malformed records skipped; exact fields, no image data; Unicode/Arabic payloads byte-exact (`tests/unit/store.test.ts`, `titles.test.ts`) | Vitest + fake-indexeddb |
| T-002-2 | Store | persistence across reload; raw database read independent of the app; record shape for all 14 payload cases (`tests/e2e/library.spec.ts`) | Playwright |
| T-002-3 | Store | open failure (SecurityError), quota on add, failing put/delete injected into the REAL IndexedDB prototypes → visible errors, no partial record, retry succeeds; generation and Download still work | Vitest (fake-indexeddb) + Playwright |
| T-002-4 | UI | Save state (`saveState.test.ts`): rapid duplicate activation → 1 record; text or level change resets; delete resets; Saved view model; native dialogs: focus, Esc, restore, failures keep dialog open; empty/error states; Open; navigation focus; responsive 320–430px and 150/200% text; axe on list/empty/error/dialogs; keyboard; privacy | Vitest + Playwright |
| T-003-1 | PNG | exact 1024×1024; only pure black/white opaque pixels; symmetric margins ≥ 4 modules; even integer module scale; decoded with jsQR AND ZXing from (a) pure pixels (all QR versions' layout, 14 payloads, 2,953 B at Low, 2,331 B at Medium) and (b) the real downloaded file parsed by an independent PNG reader (`export-png.test.ts`, `export.spec.ts`) | Vitest + Playwright |
| T-003-2 | Filename | sanitised, Arabic kept, emoji/path/bidi/control dropped, ≤ 60 chars, fallback; renamed title with slashes/quotes → safe name in the real download | Vitest + Playwright |
| T-003-3 | Share | feature detection unit tests; stubbed Web Share in the browser: only a PNG file is shared (no title/text/url), AbortError silent, other error shown with Download still working, Share hidden + explanation when unsupported, Share on saved cards | Vitest + Playwright (stubbed) |
| T-003-4 | Cleanup | every created object URL revoked; repeated activation → one download; no request contains the payload | Playwright |
| T-004-1 | PWA | manifest fields, icons exist and sizes right, `start_url`/`scope` under `/qr-pocket/` | Vitest on `dist/` |
| T-004-2 | PWA | SW registers; after load, context offline → reload works; Generate/Saved/Export OK | Playwright |
| T-004-3 | PWA | update path: new build waits → banner → Reload | Playwright (two builds) |
| T-004-4 | Privacy | no cross-origin requests during core flow; Cache API has no user payloads | Playwright |
| T-A11Y | a11y | axe-core on all screens/dialogs; keyboard-only flow; focus return | Playwright |
| T-RESP | Layout | 320/360/430/1280: no horizontal scroll, actions reachable | Playwright |
| T-005-1 | CI | `npm ci` from lockfile, typecheck strict, lint, build, bundle ≤ budget, `npm audit --omit=dev` | Actions |
| T-005-2 | CI | built site served under `/qr-pocket/` loads all assets (no 404) | Playwright |

## 3. Reporting
Each CI run records: run URL, commit SHA, per-job result, test counts (passed/failed/skipped), artifacts (Playwright report). Copied to `docs/PROGRESS.md` only after being actually observed.

## 4. Manual review checklists (inspection, not execution)
Diff read; strict types; no `innerHTML` with user data; no network calls; names prefixed `qr-pocket`; spec IDs referenced; a11y attributes present.

## 5. Physical Android UAT (owner, Chrome)
Provide URL after approved deploy. Record result (Pass/Fail/Notes + device model + Chrome version + date).
| # | Step | Expect |
|---|---|---|
| U1 | Open HTTPS URL | App loads, Generate screen |
| U2 | Install / Add to Home screen | Icon appears; opens standalone |
| U3 | Generate `https://example.com`; scan with the stock camera and a second QR app | Exact URL |
| U4 | Generate Arabic `مرحبا بالعالم` and a mixed Arabic+URL string; scan with both scanners | Exact text; note any scanner that garbles |
| U5 | Emoji + multiline text; scan | Exact text |
| U6 | Over-limit text | Clear error, no QR |
| U7 | Save; close app; reopen | Item present |
| U8 | Airplane mode; open app from icon | Opens; Generate, Saved, Download work |
| U9 | Download PNG | File in Downloads (via Files/Chrome downloads); open in Photos if indexed (not guaranteed); 1024×1024; scans from screen |
| U10 | Share PNG to Messages/WhatsApp/Drive | Share sheet shows; cancel is silent |
| U11 | Rename, then delete (confirm) | Works; cancel keeps item |
| U12 | Dev Tools/remote or proxy check (if feasible): no requests when generating | None |
| U13 | After a later deploy: open app online | Update banner; Reload applies |
| U14 | Rotate, 200% font scale, TalkBack quick pass | Usable, no clipped actions |

## 6. Issue/feedback loop
Owner reports in a message using: `Uxx · device · Chrome ver · expected · actual · screenshot optional`. Orchestrator logs defects in `docs/PROGRESS.md` (ID, severity S1–S3, spec, status), writes a failing test where practical, fixes, CI reruns, owner retests only the affected steps.
