# QR Pocket — Traceability (spec → task → test → CI outcome)

Updated 2026-10-21. Outcome column only changes with observed evidence (CI run URL + SHA, or UAT record). SPEC-001, SPEC-002, SPEC-003, SPEC-004 and the CI part of SPEC-005 have CI evidence; Phase 4/5 items and physical-phone UAT are **NOT RUN**.

| Spec | Key ACs | Screens (mockup frames) | Implementation task | Tests (TEST_PLAN) | CI outcome |
|---|---|---|---|---|---|
| SPEC-001 QR generation | AC1–AC12 (AC4/5/5b = capacity + explicit L) | G1–G8 | P2-1 `src/qr/encode.ts`; P2-2 `src/render/{layout,pixels,canvas}.ts`; P2-3 `src/ui/{model,generate}.ts`, `index.html`, `src/styles/app.css` — **implemented 2026-10-21 (NOT VERIFIED)** | T-001-1..8 (`tests/unit/*.test.ts`, `tests/e2e/generate.spec.ts`) | **PASS** — 80 unit + 41 browser tests, 0 failed/skipped; [run 39630462029](https://github.com/Mabdelaziz/qr-pocket/actions/runs/39630462029) @ `95ed734`, PR #1 |
| SPEC-002 Local library | AC1–AC15 | G9, G10, S1–S7 | P3-1 `src/store/{types,titles,indexedDb}.ts`; P3-2 `src/ui/{saved,savedModel,saveState,generate,dialogs,panels,router,announce,dom}.ts`, `index.html`, `src/styles/app.css` — **implemented** | T-002-1..4 (`store/titles/saveState/savedModel` unit, `library.spec.ts`) | **PASS** — 27 library browser + unit tests; [run 39642640265](https://github.com/Mabdelaziz/qr-pocket/actions/runs/39642640265) @ `421ab72`, PR #3 |
| SPEC-003 Export/share | AC1–AC11 | G2, G11, G12, S1 | P3-4 `src/export/{png,filename,download}.ts`; P3-6 `src/share/share.ts` — **implemented** | T-003-1..4 (`export-png/filename/share` unit, `export.spec.ts`) | **PASS** — 23 export browser + 39+6+7 unit tests; [run 39642640265](https://github.com/Mabdelaziz/qr-pocket/actions/runs/39642640265) @ `421ab72`, PR #3 |
| SPEC-004 PWA/offline | AC1–AC15 | N1–N5 | P4-1 `scripts/icons.mjs` + `generate-icons.mjs` (icons); P4-2 `vite.config.ts` (manifest, worker), `src/pwa/{register,notices,install,installPolicy,index}.ts`; P4-3 `index.html`, `src/styles/app.css`; recovery `docs/recovery/kill-switch-sw.js`, `docs/SW_RECOVERY.md` — **implemented** | T-004-1..9 (`icons`, `installPolicy` unit; `pwa`, `update`, `cross-browser` specs) | **PASS** — 30 unit + 30 PWA browser tests on Chromium, 5+5 on Firefox/WebKit; [run 39673943074](https://github.com/Mabdelaziz/qr-pocket/actions/runs/39673943074) @ `74eedb6`, PR #4 |
| SPEC-005 CI/release | AC1–AC6 | — | P2-0 scaffold (package.json, tsconfig, vite/vitest/playwright/eslint configs, scripts/check-*.mjs) and `.github/workflows/{ci,lockfile}.yml` — **prepared 2026-10-21 (NOT RUN)**; P5-2 deploy.yml later | T-005-1 (partial: install/typecheck/lint/test/build/size/audit/licences/e2e + lockfile bootstrap), T-005-2 | **PARTIAL PASS** — [ci run 39630462029](https://github.com/Mabdelaziz/qr-pocket/actions/runs/39630462029), [lockfile run 39627052940](https://github.com/Mabdelaziz/qr-pocket/actions/runs/39627052940); deploy workflow and Pages-path serving: NOT RUN |

Rules: test titles start with the spec ID (`SPEC-001: …`); commit/PR descriptions cite spec IDs and task IDs; a spec reaches VERIFIED only when its row has a green CI run recorded here and in `docs/PROGRESS.md`.

## CI evidence log
| Date | Spec(s) | Run | Commit | Result | Notes |
|---|---|---|---|---|---|
| 2026-10-21 | SPEC-005 (bootstrap) | [39627052940](https://github.com/Mabdelaziz/qr-pocket/actions/runs/39627052940) | `ecece43` (main) | PASS | lockfile generated + verified |
| 2026-10-21 | SPEC-001 | [39627260313](https://github.com/Mabdelaziz/qr-pocket/actions/runs/39627260313) | `b307747` (PR #1) | CANCELLED (20-min limit) | test defect in AC6 pixel loop; fixed |
| 2026-10-21 | SPEC-001, SPEC-005 | [39630462029](https://github.com/Mabdelaziz/qr-pocket/actions/runs/39630462029) | `95ed734` (PR #1) | **PASS** | 80 unit + 41 browser, 12.91 KB gzip, 0 vulns |
| 2026-10-21 | SPEC-002/003 | [39639713966](https://github.com/Mabdelaziz/qr-pocket/actions/runs/39639713966) | `ecab113` (PR #3) | FAIL | lint/type (unused import), jsQR v23 limit, keyboard assertion |
| 2026-10-21 | SPEC-002/003 | [39640374525](https://github.com/Mabdelaziz/qr-pocket/actions/runs/39640374525) | `780f797` (PR #3) | FAIL | decoder diagnostic; share tests stalled (toBlob) |
| 2026-10-21 | SPEC-002/003 | [39641345216](https://github.com/Mabdelaziz/qr-pocket/actions/runs/39641345216) | `9b88a98` (PR #3) | FAIL | unit 180/180; browser share stall persisted |
| 2026-10-21 | SPEC-002/003 | [39642123363](https://github.com/Mabdelaziz/qr-pocket/actions/runs/39642123363) | `b6fa429` (PR #3) | FAIL (unit step) | browser 91/91; fake-indexeddb unhandled error → double-abort bug |
| 2026-10-21 | SPEC-001/002/003 | [39642640265](https://github.com/Mabdelaziz/qr-pocket/actions/runs/39642640265) | `421ab72` (PR #3) | **PASS** | 180 unit + 91 browser, 21.44 KB gzip, 0 vulns |
| 2026-10-21 | SPEC-005 | [39671604964](https://github.com/Mabdelaziz/qr-pocket/actions/runs/39671604964) | `55b3bd9`.. (PR #4) | PASS | lockfile bootstrap for vite-plugin-pwa/workbox (501 packages) |
| 2026-10-21 | SPEC-004 | [39671760632](https://github.com/Mabdelaziz/qr-pocket/actions/runs/39671760632) | `55b3bd9` (PR #4) | FAIL (no job) | invalid YAML step name |
| 2026-10-21 | SPEC-004 | [39671884687](https://github.com/Mabdelaziz/qr-pocket/actions/runs/39671884687) | `f18f2f5` (PR #4) | FAIL | 123 passed / 8 failed (overflow, announcement, locator, helper race) |
| 2026-10-21 | SPEC-004 | [39673182340](https://github.com/Mabdelaziz/qr-pocket/actions/runs/39673182340) | `eaac6c0` (PR #4) | FAIL | 130 passed / 1 failed / 1 flaky; diagnostic found the wait-helper bug |
| 2026-10-21 | SPEC-001..005 | [39673943074](https://github.com/Mabdelaziz/qr-pocket/actions/runs/39673943074) | `74eedb6` (PR #4) | **PASS** | 210 unit + 131 browser (121 Chromium, 5 Firefox, 5 WebKit), 23.76 KB gzip initial, 0 vulns |
| 2026-10-21 | baseline | [39669823951](https://github.com/Mabdelaziz/qr-pocket/actions/runs/39669823951) | `c59b1d6` (main) | PASS | Phase 3 merged |
