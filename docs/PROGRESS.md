# QR Pocket — Progress

**Current milestone:** Phase 5 (SPEC-005 gated deployment) — **prepared, cloud CI green on [PR #5](https://github.com/Mabdelaziz/qr-pocket/pull/5)** ([run 39691268609](https://github.com/Mabdelaziz/qr-pocket/actions/runs/39691268609) @ `ccab2bf`, 2026-10-22; 269 unit + 135 browser tests, public-file scan, Pages-artifact dry run). **STOPPED at the deployment gate:** PR #5 is not merged, GitHub Pages is disabled, `deploy.yml` has never been run, no release/tag/deployment exists (verified by API 2026-10-22). Phase 4 is merged (PR #4, `main` `a88bd87`, [CI run 39685692069](https://github.com/Mabdelaziz/qr-pocket/actions/runs/39685692069)); nine automated review threads on PR #4 were answered, resolved and fixed before the merge (`7d5380b`), no protection was bypassed.
**Next small task (needs your authorisation):** approve merging PR #5 and the first test deployment (enable Pages exactly as in `docs/DEPLOYMENT.md` section 2, including the `main`-only environment policy, then dispatch *Deploy* on `main`); then run `docs/UAT_CHECKLIST.md` on the phone.


## Phase 5 evidence (actual CI runs, branch `phase-5-deploy`)

| Run | Commit | Result |
|---|---|---|
| [39687333324](https://github.com/Mabdelaziz/qr-pocket/actions/runs/39687333324) | `ee35491` | **FAIL:** two regex literals lost a backslash in a shell heredoc (lint parse error, `stamp`/`check:public` SyntaxError); an unused initial assignment (lint). Fixed in the source. |
| [39687945503](https://github.com/Mabdelaziz/qr-pocket/actions/runs/39687945503) | `c2a9a1c` | **FAIL, correctly:** the new public-file scan found a real URL in Workbox's runtime (`https://bit.ly/wb-precache`, a documentation link in an error string). Decision: allow that exact URL only (test added). Also first run of the screenshot job: pictures rendered. |
| [39688548685](https://github.com/Mabdelaziz/qr-pocket/actions/runs/39688548685) | `dda8db7` | PASS (all steps). |
| [run 39689273793](https://github.com/Mabdelaziz/qr-pocket/actions/runs/39689273793) | `3caae69` | **PASS (all steps)** after review fixes: **265 unit** (17 files), **135 browser** (Chromium 125, Firefox 5, WebKit 5; 0 failed), initial load **23.91 KB gzip**, worker 6.02 KB, scan of 12 public files passed, `github-pages` artifact (37.8 KB) created from the tested `dist`, screenshots job passed. |

| [run 39691268609](https://github.com/Mabdelaziz/qr-pocket/actions/runs/39691268609) | `ccab2bf` | **PASS (all steps)** after the automated PR review (kill-switch publishing path, scan of file names / image bytes / protocol-relative URLs, same-origin live check, YAML validation of all workflow files by PyYAML): **269 unit**, **135 browser**, initial load 23.91 KB gzip. (An intermediate run, 39690667889, failed on a test fixture of mine and was fixed.) |

**Independent review** (read-only subagent, findings treated as data, each checked): (1) HIGH, accepted: a dispatched branch uses its own workflow file, so `guard` is only a convenience; the `github-pages` environment branch policy restricted to `main` is the mandatory barrier and is now documented as such with a pre-dispatch check; an `if` on the deploy job was added. (2) `page_url` without trailing slash tolerated. (3) live check now also compares the run id and the start page. (4) 10 s request timeout. (5) URL scan is case-insensitive, covers ws/ftp, exact-match allow-list. (6) docs corrected: a third dispatch replaces the waiting second one. Not changed: the e-mail pattern may flag strings such as `icon@2x.png` in future text files (no hit in the current build; the scan will say so).

**Verified by API on 2026-10-22:** Pages not enabled (404), no environments, 0 deployments, 0 releases, 0 tags. **Not verifiable before merge:** that GitHub accepts `deploy.yml` (a workflow is registered only from the default branch); CI therefore parses every workflow file with PyYAML, and `workflows.test.ts` checks its structure. **NOT RUN:** `deploy.yml`, `check-live` against a real site, Pages response headers, the environment-policy commands, all physical-phone steps.

## Phase 4 evidence (actual CI runs)
Branch `phase-4-pwa` → [PR #4](https://github.com/Mabdelaziz/qr-pocket/pull/4); `ubuntu-24.04`, Node 22; lockfile regenerated in the cloud ([run 39671604964](https://github.com/Mabdelaziz/qr-pocket/actions/runs/39671604964): 501 packages, +334 build tooling, no existing package changed, sha512 and registry-only, no install scripts among additions, production tree unchanged).

| Run | Commit | Result |
|---|---|---|
| [39671760632](https://github.com/Mabdelaziz/qr-pocket/actions/runs/39671760632) | `55b3bd9` | **FAIL — no job started:** my CI edit left a colon-space in an unquoted YAML step name. |
| [39671884687](https://github.com/Mabdelaziz/qr-pocket/actions/runs/39671884687) | `f18f2f5` | typecheck, lint, unit **210/210**, both builds, size, audits, licences PASS; browser 123 passed / 8 failed: overflow at 200% text, install text overwritten in the status region, a test locator clash (3 browsers), service-worker tests racing. |
| [39673182340](https://github.com/Mabdelaziz/qr-pocket/actions/runs/39673182340) | `eaac6c0` | browser 130 passed / 1 failed / 1 flaky; a temporary diagnostic showed my wait helper returned while the worker was still *installing* (offline reload works once the worker is active). |
| [39673943074](https://github.com/Mabdelaziz/qr-pocket/actions/runs/39673943074) | `74eedb6` | **PASS — all steps** (4 min 25 s). |

Results of the passing run:
| Check | Result |
|---|---|
| `npm ci`, typecheck, ESLint | PASS |
| Unit tests (Vitest) | **210 passed, 0 failed, 0 skipped** (15 files; new: icons 11, install policy 19) |
| Browser tests (Playwright) | **131 passed, 0 failed, 0 flaky, 0 skipped** (2.8 min): **Chromium 121**, **Firefox 5**, **WebKit 5**. Chromium by file: generate 41, library 27, export 23, pwa 22 (manifest/icons/CSP, scope/caches, offline flows, no payload in caches, notices, install prompt incl. 320–430px and 150/200% text), update 3 (two-deployment update, Later, kill-switch recovery), cross-browser 5 |
| Builds | `npm run build` and `npm run build:v2` PASS (icons generated, manifest + service worker emitted) |
| Bundle (gzip) | **Initial load 23.76 KB** (JS 18.33 + CSS 2.83 + HTML 2.60) vs 150 KB budget; **service worker + Workbox runtime 6.03 KB** (separate download); whole precache 99.11 KB uncompressed (JS, CSS, HTML, 5 icons, manifest, worker) |
| `npm audit` | production 0 vulnerabilities; all dependencies (informational) 0 vulnerabilities; one dev-only deprecation warning (`glob@11.1.0`, via Workbox) — Dependabot tracks it |
| Licence check (production) | PASS — only `qrcode-generator` (MIT) |

Findings and fixes during the loop (root-caused, no test weakened):
- **Real defects fixed:** notice bars and the header overflowed at 320px/200% text; the install text announcement was overwritten by "QR code ready." (decision: do not announce the install prompt); notice accessible names could go stale; focus was lost when a focused bar closed; "Ready to work offline" could be claimed after a recovery worker deleted the cache; a blocked registration resolved to `undefined`.
- **Test defects fixed:** a locator clash ("RenameDownload" contains "renamed"), a racy reload count, too-short timeouts, and the wait helper that never awaited the worker.
- **Independent review:** a read-only reviewer predicted the two blockers before CI ran and found six more issues, all applied.

What these results do **not** prove (NOT RUN / unverified): physical phones (real install prompt and standalone display, maskable icon on a launcher, airplane-mode use, the update flow on Android Chrome); real GitHub Pages hosting (headers such as `max-age=600`, redirects; the test server only imitates them); Safari and Firefox release builds (Playwright's builds were used, desktop only); the real `beforeinstallprompt` event (synthetic in tests); Lighthouse installability audit; deployment.

## Phase 3 evidence (actual CI runs)
Branch `phase-3-library-export` → [PR #3](https://github.com/Mabdelaziz/qr-pocket/pull/3); runner `ubuntu-24.04`, Node 22; lockfile regenerated in the cloud (167 packages: only `fake-indexeddb` added, no version/integrity changes).

| Run | Commit | Result |
|---|---|---|
| [39639713966](https://github.com/Mabdelaziz/qr-pocket/actions/runs/39639713966) | `ecab113` | **FAIL** — typecheck+lint (unused import in a test), unit 178/179 (jsQR cannot read QR version 23), browser 90/91 (keyboard-trap assertion too strict for headless Chromium). Build, size, audit, licences passed. |
| [39640374525](https://github.com/Mabdelaziz/qr-pocket/actions/runs/39640374525) | `780f797` | **FAIL** — temporary decoder diagnostic proved the v23 failure is a jsQR limit (ZXing reads it); browser 89/91: two Share tests stalled. |
| [39641345216](https://github.com/Mabdelaziz/qr-pocket/actions/runs/39641345216) | `9b88a98` | unit **180/180**; browser 89 + 1 flaky + 1 failed — traces showed `canvas.toBlob` taking > 5 s intermittently. |
| [39642123363](https://github.com/Mabdelaziz/qr-pocket/actions/runs/39642123363) | `b6fa429` | browser **91/91** (1.6 min) after CPU-backed canvases; the unit step failed on an *unhandled error* from fake-indexeddb → exposed a real bug (double `abort()` after a request error). |
| [39642640265](https://github.com/Mabdelaziz/qr-pocket/actions/runs/39642640265) | `421ab72` | **PASS — all 17 steps.** |

Results of the passing run:
| Check | Result |
|---|---|
| `npm ci`, typecheck (strict), ESLint | PASS |
| Unit tests (Vitest) | **180 passed, 0 failed, 0 skipped** — export-png 39, store 32, encode 32, surrogates 15, ZXing decode 14, layout 9, model 8, titles 7, share 7, filename 6, savedModel 5, saveState 4, encode-failure 2 |
| Browser tests (Playwright, Chromium) | **91 passed, 0 failed, 0 skipped** (2.2 min) — generate 41 (Phase 2, unchanged), library 27, export 23 |
| Production build / bundle (gzip) | PASS · **21.44 KB** total (JS 16.36 + CSS 2.71 + HTML 2.36) vs 150 KB budget |
| `npm audit --omit=dev` / licences | 0 vulnerabilities · PASS (`qrcode-generator` MIT is the only production dependency) |

Findings and fixes during the loop (all root-caused, none by weakening a test):
- **Real bugs found by tests/review and fixed:** (1) *Open from Saved* drew the QR at 1 px/module because the Generate view was hidden when it was drawn → `refresh()` on route change + a test that compares canvas sizes; (2) double `abort()` after a failed request (fake-indexeddb raised an uncaught error); (3) Esc could close rename/delete dialogs while the write was in flight; (4) `indexedDB` access could throw at load (now treated as unavailable); (5) an export could stay "busy" forever if `toBlob` never returned → 15 s watchdog + visible error; (6) a lint-flagged invisible-character regex in the filename module.
- **Environment finding:** intermittent `canvas.toBlob` stalls (> 5 s) on the GPU-less runner; fixed by CPU-backed canvases (`willReadFrequently`), which also cut the browser suite from 2.3 to 1.6–2.2 min. The GPU-readback cause is inferred from traces and the effect of the fix, not proven.
- **Decoder interoperability:** every QR version 1–40, filled to capacity at Low with diverse content, is read exactly by ZXing from the exported pixels. jsQR reads 39 of 40; **version 23 is unreadable by jsQR at every scale (even plain ASCII)** — a limit of that 2021 library, recorded in the test output.

What these results do **not** prove (still NOT RUN / unverified): physical phones (Arabic scan with real scanners, real Web Share targets, Downloads location, TalkBack, real on-screen keyboard, fractional DPR sharpness); browsers other than Chromium (IndexedDB/dialog behaviour in Firefox/Safari); native Web Share (stubbed in tests); offline/installability (Phase 4).

## Phase 2 evidence (kept)
Repository: https://github.com/Mabdelaziz/qr-pocket (PUBLIC, Pages disabled, default token read-only). Branch `phase-2-core` → PR #1. Runner: GitHub-hosted `ubuntu-24.04`, Node 22.

| Run | What | Result |
|---|---|---|
| [39627052940](https://github.com/Mabdelaziz/qr-pocket/actions/runs/39627052940) | "Generate lockfile (manual)" bootstrap, commit `ecece43` | **PASS** (19 s). Lockfile downloaded as an artifact (no write permissions), verified offline: 166 packages, `sha512` integrity on all, all from `registry.npmjs.org`, 13 direct deps locked at exactly the pinned versions, no git/file sources; only install script is macOS-only `fsevents` (ignored by `.npmrc`). |
| [39627260313](https://github.com/Mabdelaziz/qr-pocket/actions/runs/39627260313) | CI, commit `b307747` | **CANCELLED at the 20-min job limit.** Typecheck, lint, unit tests, build, size, audit, licences all passed; 40/41 browser tests passed, then test #20 (AC6 pixel check) stalled. Root cause: ~400k `expect()` calls in a tight loop blocked the Playwright runner (**test defect, not a product defect**). Same assertions kept, now counted in plain code and asserted once; added Playwright `globalTimeout` and a step timeout. |
| [39630462029](https://github.com/Mabdelaziz/qr-pocket/actions/runs/39630462029) | CI, commit `95ed734` | **PASS — all 17 steps, 1 min 43 s.** |

Results of the passing run (https://github.com/Mabdelaziz/qr-pocket/actions/runs/39630462029):
| Check | Result |
|---|---|
| `npm ci` (lockfile) | PASS |
| TypeScript strict typecheck | PASS |
| ESLint | PASS |
| Unit tests (Vitest) | **80 passed, 0 failed, 0 skipped** — encode 32, surrogates 15, ZXing decode 14, layout 9, model 8, encode-failure 2 |
| Independent decoder round trip (14 payloads incl. Arabic long/diacritics/mixed, bidi controls, emoji ZWJ, €/é, multiline, spaces) | **jsQR PASS (unit + real browser canvas pixels); ZXing PASS (all 14)** — the ECI/charset risk (ADR-014) did **not** materialise for ZXing |
| Browser tests (Playwright, Chromium) | **41 passed, 0 failed, 0 skipped** (57.9 s): AC1–AC9 states, decode of rendered canvas, 320/360/390/430 px, long URL, 150%/200% text scale, short-viewport, Arabic `:dir(rtl)`, axe WCAG 2.0–2.2 A/AA on 7 states (0 violations), keyboard order, ≥48px targets, status/alert behaviour, no cross-origin requests, no console/CSP errors |
| Production build (Vite 8, base `/qr-pocket/`) | PASS |
| Bundle size (gzip) | **12.91 KB total** (JS 9.89 + CSS 1.67 + HTML 1.35) vs 150 KB budget |
| `npm audit --omit=dev` | 0 vulnerabilities |
| Licence check (production tree) | PASS — `qrcode-generator@2.0.4` MIT (only production dependency) |
| Artifact | `reports-<sha>` (Playwright report, 242 KB) |

What these results do **not** prove (still NOT RUN / unverified):
- Real phones: scanning Arabic with two physical scanners (UAT U4), canvas sharpness at fractional device-pixel ratios, TalkBack, on-screen keyboard (only simulated by a short viewport).
- Other browsers (Chromium only), and Windows high-contrast behaviour (CSS added, not tested).
- Offline/install/service worker (Phase 4), saving/export/share (Phase 3), Pages base-path serving beyond `vite preview`.
- jsQR/ZXing both read our output; that shows consistency with two decoders, not with every phone camera app.

## Blockers / open questions
- Behaviour/size of `qrcode-generator` (UTF-8, Arabic, bundle) unverified until CI. `@nayuki/qr-code-generator` does **not** exist on npm (404) — ADR-002 corrected.
- **Arabic/UTF-8 on real scanners is unverified:** no ECI segment is emitted. Both independent decoders (jsQR, ZXing) read all 14 payloads correctly in CI, but phone camera apps may differ — decide after UAT U4 (ADR-014 contingency: ECI via a different encoder).
- Action SHAs re-verified against GitHub on 2026-10-21 (all three are still the latest releases). Repository hardening not yet applied (needs your approval): restrict Actions to GitHub-owned actions + require SHA pinning, branch protection requiring the `verify` check, Dependabot.
- CI has run only on the PR branch; `main` has no `ci.yml` until PR #1 is merged.
- Runner image: pinned `ubuntu-24.04` because `ubuntu-latest` began migrating to Ubuntu 26 on 2026-10-19.
- Known small risks (S3): fractional device-pixel-ratio scaling of the QR canvas (check on phone), bidi-control payload under ZXing (triage), `@types/node` 26 vs Node 22 runtime.
- Busy state ("Generating…" > 200 ms, mock G8) is not implemented: encoding is synchronous and expected to be fast; revisit if CI/phone measurements show otherwise.
- (resolved 2026-10-21) `info.txt` naming corrected to QR Pocket / qr-pocket on 4 lines only.

## Approval gates
- **G1** after Phase 0: APPROVED 2026-10-21 (owner).
- **G1b** after Phase 1: APPROVED 2026-10-21 (owner), with final refinements.
- **G2** before first push / repo creation / Pages change.
- **G3** before production release / tagging.

## Phase backlog and exit gates
| Phase | Work | Exit gate |
|---|---|---|
| 0 Plan | Docs and specs (this) | Owner approves G1 |
| 1 UX | Static HTML/CSS wireframes of Generate, Saved, dialogs, banners; states; a11y notes | Owner approves G1b; A-GEN/A-SAV/A-DLG/A-PWA checks written |
| 2 Core (SPEC-001) | **Written 2026-10-21 (NOT VERIFIED):** scaffold, `src/qr`, `src/render`, `src/ui`, tests, workflows | CI-verified: T-001-* green (needs G2 + first cloud run) |
| 3 Library+export (SPEC-002/003) | **Done 2026-10-21 — CI green ([run 39642640265](https://github.com/Mabdelaziz/qr-pocket/actions/runs/39642640265))**; awaiting your approval | T-002-*, T-003-* green; a11y/resp checks green ✔ |
| 4 PWA (SPEC-004) | manifest, icons, SW, notices | T-004-* green incl. offline + update + subpath |
| 5 CI/release (SPEC-005) | Workflows, size/audit gates, Pages deploy workflow (manual) | Workflows green on PR; deploy workflow reviewed; **G2** obtained |
| 6 Phone UAT | Owner runs TEST_PLAN §5 on deployed URL | All U-steps recorded; no S1/S2 open |
| 7 Release | Final deploy, tag, notes, rollback doc | **G3**; RELEASE_CHECKLIST complete |
Note: CI cannot run before G2 (push needed). To avoid a long blind stretch, request G2 early (after Phase 1) for **repo + feature-branch CI only, no Pages** — recommended.

## Agent roles and file ownership
Orchestrator (main) owns scope, gates, integration, PROGRESS. Specialists via built-in subagents, sequential for edits, parallel only for read-only research/review.
| Role | May write | Notes |
|---|---|---|
| Architect | docs/ARCHITECTURE, DECISIONS, specs/ | docs only |
| UX | docs/design/, static mocks | no app source |
| Implementer | active spec's `src/`, `tests/` | one spec at a time; no refactors |
| QA | `tests/`, defect entries | writes failing tests; checks AC and edge cases |
| Reviewer | none (report only) | severity-ranked findings; never reviews own code |
| Release/Security | `.github/workflows/`, RELEASE_CHECKLIST, CSP/SW review | least privilege, pins |
Each loop: Specify → (Design) → Test-first → Implement → Inspect → CI verify → Repair → Independent review → Report (matrix PASS/FAIL/NOT RUN).

## Risk list
| Risk | Impact | Mitigation |
|---|---|---|
| Arabic/UTF-8 interop: some scanners mishandle UTF-8 without ECI | Garbled text on some readers | Two independent decoders in CI; U4 on phone with two scanners; document findings; consider ECI segment only if proven necessary (ADR) |
| Android downloads/Gallery | PNG not visible in Photos | Promise only "Downloads"; Share as alternate; UAT U9 notes |
| Web Share files unsupported | No share | Feature-detect, fallback to download |
| SW scope / subpath / stale cache | Broken offline or stuck old version | `/qr-pocket/` scope tests, prompt-based update, kill-switch plan |
| Shared github.io origin | Other sites' storage/cookies on same origin | Prefix names; no secrets; documented |
| IndexedDB eviction | Lost saves | Notice, `persist()` best-effort, no backup claim |
| Unverified deps | Licence/security surprise | CI audit/licence check before adoption |
| Can't run anything locally | Late failures | Small specs, test-first, early branch CI (G2 recommendation) |
