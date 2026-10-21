# QR Pocket — Traceability (spec → task → test → CI outcome)

Updated 2026-10-21. Outcome column only changes with observed evidence (CI run URL + SHA, or UAT record). Today everything is **NOT RUN**.

| Spec | Key ACs | Screens (mockup frames) | Implementation task | Tests (TEST_PLAN) | CI outcome |
|---|---|---|---|---|---|
| SPEC-001 QR generation | AC1–AC12 (AC4/5/5b = capacity + explicit L) | G1–G8 | P2-1 `src/qr/encode.ts`; P2-2 `src/render/{layout,pixels,canvas}.ts`; P2-3 `src/ui/{model,generate}.ts`, `index.html`, `src/styles/app.css` — **implemented 2026-10-21 (NOT VERIFIED)** | T-001-1..8 (`tests/unit/*.test.ts`, `tests/e2e/generate.spec.ts`) | NOT RUN |
| SPEC-002 Local library | AC1–AC11 | G9, G10, S1–S7 | P3-1 `store/`; P3-2 Saved UI; P3-3 dialogs | T-002-1..4, T-A11Y, T-RESP | NOT RUN |
| SPEC-003 Export/share | AC1–AC8 | G2, G11, G12, S1 | P3-4 `render/toPngBlob`; P3-5 filename; P3-6 download/share | T-003-1..4 | NOT RUN |
| SPEC-004 PWA/offline | AC1–AC8 | N1–N5 | P4-1 manifest+icons; P4-2 SW (vite-plugin-pwa); P4-3 notices | T-004-1..4, T-005-2 | NOT RUN |
| SPEC-005 CI/release | AC1–AC6 | — | P2-0 scaffold (package.json, tsconfig, vite/vitest/playwright/eslint configs, scripts/check-*.mjs) and `.github/workflows/{ci,lockfile}.yml` — **prepared 2026-10-21 (NOT RUN)**; P5-2 deploy.yml later | T-005-1, T-005-2 | NOT RUN |

Rules: test titles start with the spec ID (`SPEC-001: …`); commit/PR descriptions cite spec IDs and task IDs; a spec reaches VERIFIED only when its row has a green CI run recorded here and in `docs/PROGRESS.md`.
