# QR Pocket — Traceability (spec → task → test → CI outcome)

Updated 2026-10-21. Outcome column only changes with observed evidence (CI run URL + SHA, or UAT record). SPEC-001 and the CI part of SPEC-005 have CI evidence; everything else is **NOT RUN**.

| Spec | Key ACs | Screens (mockup frames) | Implementation task | Tests (TEST_PLAN) | CI outcome |
|---|---|---|---|---|---|
| SPEC-001 QR generation | AC1–AC12 (AC4/5/5b = capacity + explicit L) | G1–G8 | P2-1 `src/qr/encode.ts`; P2-2 `src/render/{layout,pixels,canvas}.ts`; P2-3 `src/ui/{model,generate}.ts`, `index.html`, `src/styles/app.css` — **implemented 2026-10-21 (NOT VERIFIED)** | T-001-1..8 (`tests/unit/*.test.ts`, `tests/e2e/generate.spec.ts`) | **PASS** — 80 unit + 41 browser tests, 0 failed/skipped; [run 39630462029](https://github.com/Mabdelaziz/qr-pocket/actions/runs/39630462029) @ `95ed734`, PR #1 |
| SPEC-002 Local library | AC1–AC11 | G9, G10, S1–S7 | P3-1 `store/`; P3-2 Saved UI; P3-3 dialogs | T-002-1..4, T-A11Y, T-RESP | NOT RUN |
| SPEC-003 Export/share | AC1–AC8 | G2, G11, G12, S1 | P3-4 `render/toPngBlob`; P3-5 filename; P3-6 download/share | T-003-1..4 | NOT RUN |
| SPEC-004 PWA/offline | AC1–AC8 | N1–N5 | P4-1 manifest+icons; P4-2 SW (vite-plugin-pwa); P4-3 notices | T-004-1..4, T-005-2 | NOT RUN |
| SPEC-005 CI/release | AC1–AC6 | — | P2-0 scaffold (package.json, tsconfig, vite/vitest/playwright/eslint configs, scripts/check-*.mjs) and `.github/workflows/{ci,lockfile}.yml` — **prepared 2026-10-21 (NOT RUN)**; P5-2 deploy.yml later | T-005-1 (partial: install/typecheck/lint/test/build/size/audit/licences/e2e + lockfile bootstrap), T-005-2 | **PARTIAL PASS** — [ci run 39630462029](https://github.com/Mabdelaziz/qr-pocket/actions/runs/39630462029), [lockfile run 39627052940](https://github.com/Mabdelaziz/qr-pocket/actions/runs/39627052940); deploy workflow and Pages-path serving: NOT RUN |

Rules: test titles start with the spec ID (`SPEC-001: …`); commit/PR descriptions cite spec IDs and task IDs; a spec reaches VERIFIED only when its row has a green CI run recorded here and in `docs/PROGRESS.md`.

## CI evidence log
| Date | Spec(s) | Run | Commit | Result | Notes |
|---|---|---|---|---|---|
| 2026-10-21 | SPEC-005 (bootstrap) | [39627052940](https://github.com/Mabdelaziz/qr-pocket/actions/runs/39627052940) | `ecece43` (main) | PASS | lockfile generated + verified |
| 2026-10-21 | SPEC-001 | [39627260313](https://github.com/Mabdelaziz/qr-pocket/actions/runs/39627260313) | `b307747` (PR #1) | CANCELLED (20-min limit) | test defect in AC6 pixel loop; fixed |
| 2026-10-21 | SPEC-001, SPEC-005 | [39630462029](https://github.com/Mabdelaziz/qr-pocket/actions/runs/39630462029) | `95ed734` (PR #1) | **PASS** | 80 unit + 41 browser, 12.91 KB gzip, 0 vulns |
