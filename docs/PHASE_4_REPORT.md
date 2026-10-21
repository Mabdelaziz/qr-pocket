# QR Pocket — Phase 4 report (SPEC-004 PWA install and offline)

Date: 2026-10-21 · Branch `phase-4-pwa` · [PR #4](https://github.com/Mabdelaziz/qr-pocket/pull/4) (not merged) · Verified by [CI run 39673943074](https://github.com/Mabdelaziz/qr-pocket/actions/runs/39673943074) (commit `74eedb6`). Evidence: `docs/PROGRESS.md`, `docs/TRACEABILITY.md`; decisions: ADR-017.

## Installation behaviour
- **Manifest** `/qr-pocket/manifest.webmanifest`: name/short name "QR Pocket", `id`/`start_url`/`scope` `/qr-pocket/`, standalone, theme `#FFFFFF`, background `#F5F7FB`, icons 192 and 512 ("any"), 512 maskable, SVG.
- **Icons** are generated in the build from one description (`scripts/icons.mjs`, Node `zlib` only; no image library). Reference copies: `docs/design/icons/`.
- **Install prompt** (owner wording: "Keep QR Pocket on your phone" / "Install QR Pocket for quick access and offline QR creation. No account needed." / "Install app", "Not now"): appears only if the browser offered installation and a QR code has been shown; "Not now" silences it for 30 days, an ignored prompt for 7 days; once per session; never in standalone mode or after install; not announced; nothing shown where the browser has no install event (menus still work).

## Offline and updates
- Worker (`/qr-pocket/sw.js`, scope `/qr-pocket/`) precaches build output only; no runtime caching, so no QR text, title or IndexedDB record can enter Cache Storage (tested by URL and body). Cache names start `qr-pocket`.
- Updates are prompt-based: a new version waits; the bar offers **Reload** or **Later**; nothing reloads on its own (tested while typing and with a dialog open). Saved codes survive updates, offline use and the recovery procedure.
- Notices: header chip + bar while offline, polite announcements, "Ready to work offline." once per profile (only if the app cache exists).
- Recovery: `docs/SW_RECOVERY.md` and a tested kill-switch worker (`docs/recovery/kill-switch-sw.js`).

## Tests (run 39673943074)
Unit 210 passed. Browser 131 passed, 0 failed, 0 flaky, 0 skipped: Chromium 121, Firefox 5, WebKit 5. Typecheck, lint, both builds, size, audits (0 vulnerabilities) and licences passed. Initial load **23.76 KB gzip**; service worker + Workbox runtime 6.03 KB gzip (separate).

## Accessibility and security findings
axe (WCAG 2.0–2.2 A/AA): 0 violations on the offline notice, ready notice and install prompt. Layout verified at 320/360/430px and at 150%/200% text (a real overflow found and fixed). Targets ≥ 48px. Focus returns to the screen heading when a focused notice closes. CSP changed only by `worker-src 'self'` and `manifest-src 'self'`; no inline scripts/styles, no external requests, no console errors. One dev-only deprecation warning (`glob@11.1.0` via Workbox); production tree unchanged (`qrcode-generator` only).

## Remaining risks
1. Nothing is verified on a physical phone (`docs/ANDROID_TESTING.md`): real install prompt and standalone mode, maskable icon on a launcher, airplane-mode use, update flow on Android Chrome.
2. Real GitHub Pages hosting is untested (Pages disabled): response headers and redirects are only imitated by the test server.
3. Firefox/WebKit results use Playwright's desktop builds, not Safari/iOS or Firefox release builds; the install event is Chromium-only and synthetic in tests; no Lighthouse installability audit yet.
4. Update checks depend on the browser (navigation, ≤ 24 h) plus our hourly foreground check; two open tabs can briefly disagree; `/qr-pocket` without the slash is not served offline.
5. Storage can still be cleared by the user or evicted by the browser; there is no backup and none is claimed.
6. Workbox adds 334 dev-only packages to the supply chain (Dependabot and `npm audit` watch them).

## Next
Phase 5 (SPEC-005): a manual, gated deploy workflow (Pages still needs your separate authorisation), then the physical-phone UAT.
