# QR Pocket — Service worker recovery and rollback

Status: documented 2026-10-21 (Phase 4). The kill-switch path is exercised by an automated test (`tests/e2e/update.spec.ts`, SPEC-004 AC12); the human steps below have **not** been tried on a real phone yet (UAT item U13).

## What can go wrong
A service worker lives in the browser, not on the server: a bad release can keep serving a broken cached app even after the site itself was fixed. QR Pocket limits the blast radius:
- the worker precaches **only** the build output (HTML, hashed JS/CSS, manifest, icons) and has no runtime caching, so it can never hold user data;
- saved QR codes live in IndexedDB, which the worker, updates and every recovery step below **never touch**;
- updates are prompt-based: a new worker waits until the user presses **Reload**.

## Levels of response (try in order)
1. **Fix forward (normal).** Deploy a corrected build. Browsers fetch `sw.js` on navigation (at most every 24 h otherwise); users see "A new version is ready" and press Reload.
2. **Rollback.** Revert the faulty commit by pull request, merge, run *Deploy* (`docs/DEPLOYMENT.md` section 3). Because the precache is revisioned, clients treat it as an ordinary update. A rollback does not help users stuck on a worker that never offers updates; use step 3.
3. **Kill switch.** Publish `docs/recovery/kill-switch-sw.js` as `/qr-pocket/sw.js` through the gated pipeline: open a pull request that adds the empty marker file `recovery/KILL_SWITCH`, merge it, and run *Deploy*. CI then swaps `dist/sw.js` for the emergency worker after all tests passed on the normal build (`scripts/apply-kill-switch.mjs`), marks `version.json` with `"recovery": "kill-switch"`, and prints a warning. This is the one case where published bytes differ from tested bytes (the emergency worker has its own test). To end the recovery, delete the marker in a later pull request together with the fix.
   - Effect on each browser at its next update check: the kill-switch worker installs at once (`skipWaiting`), deletes this app's caches (names starting `qr-pocket` that contain its own scope URL, so a sibling project on the same `github.io` origin is never touched), and unregisters itself even if cache cleanup fails. Requests go straight to the network again. It has no `fetch` handler and never opens IndexedDB.
   - Existing open tabs keep running until reloaded; a reload then loads the app from the network.
   - While the kill switch is deployed the page still tries to register `sw.js`, so the browser re-installs and re-removes it on each visit. That is harmless (a few bytes) but means the kill switch is a **temporary** measure: ship a fixed build as soon as possible (step 1).
   - Verified by an automated test: caches deleted, registration gone, saved codes intact, app loads.
4. **Manual user steps (last resort).** In Chrome on Android: Site settings for the app's address → **Clear & reset** removes the cache and the worker **but also the saved QR codes (IndexedDB)** — warn users first and offer PNG export. Reinstall the app afterwards if it was installed.

## Operator checklist when a bad worker is suspected
- [ ] Reproduce in a fresh browser profile and in a profile with the old worker installed (the second one is what users have).
- [ ] Decide: fix forward, rollback, or kill switch. Prefer fix forward when the app itself loads.
- [ ] If using the kill switch: add `recovery/KILL_SWITCH` by pull request, merge, run *Deploy* (never publish by hand), check `/qr-pocket/version.json` shows `"recovery": "kill-switch"`, verify in an installed-worker profile.
- [ ] Record the incident, cause and the follow-up fix in `docs/PROGRESS.md`; add a regression test.
- [ ] Never delete or migrate IndexedDB as part of recovery.

## Facts to remember
- Cache names start with `qr-pocket` (shared `github.io` origin: never delete caches that do not).
- The worker scope is `/qr-pocket/`; it cannot affect other project sites on the same origin.
- `/qr-pocket` without the trailing slash is redirected by the host and is not served offline.
