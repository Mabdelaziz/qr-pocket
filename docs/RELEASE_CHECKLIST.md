# QR Pocket — Release Checklist and Rollback

Status: DRAFT (Phase 0). Nothing here has been executed. Each tick requires evidence (link/hash/date).

## A. One-time setup — needs explicit owner approval at each step
- [ ] Owner creates (or authorises creation of) GitHub repo `qr-pocket`; visibility chosen by owner.
- [ ] Add remote; first push of the approved branch (**approval gate G2**).
- [ ] Settings → Pages → Source: **GitHub Actions** (owner or authorised change).
- [ ] Optional: branch protection on `main` requiring CI; Dependabot.

## B. Pre-release (each release)
- [ ] All specs in scope have status DONE with evidence links.
- [ ] CI green on the release commit: typecheck, lint, unit, build, Playwright, audit, size gate. Run URL: ____ SHA: ____
- [ ] `vite build` output served under `/qr-pocket/`: manifest `start_url`/`scope`, SW path, icons verified by test T-004-1/T-005-2.
- [ ] No outbound requests in core flow (T-004-4).
- [ ] Physical UAT matrix (TEST_PLAN §5) completed by owner on the **staging/pre-release deploy** with recorded results; no open S1/S2 defects.
- [ ] Known limitations updated (Gallery not guaranteed; share-file support varies; data lost if site data cleared; shared github.io origin).
- [ ] Version bumped in `package.json`; changelog entry in `docs/PROGRESS.md`.

## C. Deploy (manual `workflow_dispatch`)
- [ ] Owner approves release (**gate G3**).
- [ ] Run the Deploy workflow on `main`; it re-runs the gates, uploads `dist/`, deploys via `actions/deploy-pages`.
- [ ] Record deployed URL, run URL, commit SHA, time.
- [ ] Smoke test on phone: open URL, hard reload, install, airplane-mode check.
- [ ] Tag `vX.Y.Z` **only with owner authorisation**.

## D. Update behaviour (document for users/owner)
Users with the app installed keep the old version until the new service worker installs; they see "Update available — Reload". Old caches are removed on activation. Expect up to one launch of delay.

## E. Rollback
1. Fast: re-run Deploy workflow on the previous known-good tag/commit (`workflow_dispatch` input `ref`).
2. Or `git revert <bad-commit>` on `main`, push (needs approval), run Deploy.
3. Because the SW uses revisioned precache, clients fetch the rolled-back build as a normal "update"; verify banner appears.
4. Kill-switch if an SW itself is broken: ship a build whose `sw.js` unregisters itself and clears `qr-pocket*` caches (`self.registration.unregister()`); never delete IndexedDB data.
5. Record incident and cause in `docs/PROGRESS.md`.

## F. Post-release
- [ ] Owner confirms install on phone from the production URL.
- [ ] Open issues triaged; next small task set in PROGRESS.
