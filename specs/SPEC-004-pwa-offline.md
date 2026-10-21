# SPEC-004 — PWA install and offline

Status: DRAFT

## Goal
Installable app that works offline after first load, with safe, user-controlled updates under `/qr-pocket/`.

## User story
US-09, US-10.

## In / out of scope
In: manifest, icons, service worker precache, registration, offline chip, update banner, install hint, offline-ready toast. Out: push notifications, background sync, runtime caching of any data, iOS install guidance, share target, shortcuts.

## Dependencies
SPEC-001–003 built output; ADR-005, ADR-006, ADR-009; screen spec §4.

## UI impact
Header offline chip; update banner; install hint; toast.

## Interface / data contracts
Manifest: `name "QR Pocket"`, `short_name "QR Pocket"`, `id/start_url/scope "/qr-pocket/"`, `display standalone`, `theme_color`/`background_color` (white-based, final in Phase 1), `lang "en"`, icons 192, 512, 512 maskable (PNG). SW at `/qr-pocket/sw.js`, precache = build assets only, `navigateFallback` = `/qr-pocket/index.html`, `cleanupOutdatedCaches`, update via prompt. No runtime caching routes. Install UI uses `beforeinstallprompt`; dismissal key `qr-pocket.installDismissed`.

## Behaviour
- First visit online: SW installs, precaches shell; toast "Ready to work offline" once.
- Offline: reload and navigation to `#/generate`/`#/saved` work; IndexedDB features unaffected.
- Update: new SW waits → banner → Reload → `skipWaiting` + page reload; Later dismisses until next launch. Never auto-reloads.
- Failure: SW registration unsupported/fails → app works online, no error spam, offline chip still informational.
- Edge: private mode; SW scope mistakes; opening `/qr-pocket` without trailing slash (GitHub Pages redirects); stale cache after rollback.

## Security / privacy / accessibility
Cache holds only static build files; no user payload (tested). Names prefixed `qr-pocket`. Banners use `aria-live=polite`, don't cover primary actions at 320 px, controls ≥ 48 px.

## Acceptance criteria
- AC1 Given the built `dist/`, then the manifest has the required fields, all icon files exist with correct dimensions, and `start_url`/`scope` start with `/qr-pocket/`.
- AC2 Given a first online load, then a SW controls the page under `/qr-pocket/` and precache contains every built asset referenced by index.html.
- AC3 Given the app loaded once, when the network is disabled and the page reloaded, then Generate, Saved (with existing data) and Download work.
- AC4 Given a newer build deployed, then the update banner appears, Reload activates the new version, and old caches are removed.
- AC5 Given core flows, then no cross-origin requests occur and the Cache API contains no payload text.
- AC6 Given offline/online toggles, then the chip appears/disappears and is announced politely.
- AC7 Given `beforeinstallprompt`, then the hint shows, is dismissible, and stays dismissed across reloads.
- AC8 Given Chrome Android, then "Install app"/Add to Home screen is offered and the installed app opens standalone (manual).

## Tests
Automated (NOT RUN): T-004-1..4, T-005-2, T-A11Y. Manual: U2, U8, U13.

## Completion evidence
None yet. Status DRAFT.
