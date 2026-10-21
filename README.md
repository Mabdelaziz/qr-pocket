# QR Pocket

Create. Save. Share. — a tiny, private, offline-first QR code generator (installable PWA) for Android Chrome and modern desktop browsers. No accounts, backend, tracking or runtime network requests.

**Status:** Phase 4 — QR generation, local library, PNG export/sharing, and the installable offline PWA (manifest, generated icons, prompt-based updates, install prompt) are implemented and **verified by cloud CI** (210 unit + 131 browser tests incl. Firefox and WebKit smoke; 23.76 KB gzip initial load; see `docs/PROGRESS.md`). Not deployed (GitHub Pages is disabled) and not yet tested on a physical phone (`docs/ANDROID_TESTING.md`). Recovery from a bad service worker: `docs/SW_RECOVERY.md`. Saving, export/share, PWA install/offline and release are later phases. See `docs/PROGRESS.md`.

## Where things are
- Product and design: `docs/PRODUCT_SPEC.md`, `docs/design/SCREEN_SPECS.md`, `docs/design/mockups/index.html`
- Architecture and decisions: `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`
- Specs and traceability: `specs/`, `docs/TRACEABILITY.md`; tests: `docs/TEST_PLAN.md`
- Cloud CI: `.github/workflows/` (inert until pushed); setup: `docs/CI_SETUP.md`

## Commands (run by GitHub Actions; this project does not use a local build environment)
`npm ci` · `npm run typecheck` · `npm run lint` · `npm test` · `npm run build` · `npm run check:size` · `npm run check:licenses` · `npm run test:e2e`

Single unit test file: `npx vitest run tests/unit/model.test.ts` · single browser test: `npx playwright test -g "SPEC-001 AC5"` (in CI or any machine that already has Node; do not install tooling on the project laptop).
