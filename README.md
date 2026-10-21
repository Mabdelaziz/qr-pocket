# QR Pocket

Create. Save. Share. — a tiny, private, offline-first QR code generator (installable PWA) for Android Chrome and modern desktop browsers. No accounts, backend, tracking or runtime network requests.

**Status:** Phase 2 — QR generation (SPEC-001) implemented in source; **nothing has been built, tested or run yet** (cloud CI only). Saving, export/share, PWA install/offline and release are later phases. See `docs/PROGRESS.md`.

## Where things are
- Product and design: `docs/PRODUCT_SPEC.md`, `docs/design/SCREEN_SPECS.md`, `docs/design/mockups/index.html`
- Architecture and decisions: `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`
- Specs and traceability: `specs/`, `docs/TRACEABILITY.md`; tests: `docs/TEST_PLAN.md`
- Cloud CI: `.github/workflows/` (inert until pushed); setup: `docs/CI_SETUP.md`

## Commands (run by GitHub Actions; this project does not use a local build environment)
`npm ci` · `npm run typecheck` · `npm run lint` · `npm test` · `npm run build` · `npm run check:size` · `npm run check:licenses` · `npm run test:e2e`

Single unit test file: `npx vitest run tests/unit/model.test.ts` · single browser test: `npx playwright test -g "SPEC-001 AC5"` (in CI or any machine that already has Node; do not install tooling on the project laptop).
