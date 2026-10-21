# QR Pocket — Deployment guide (operator view)

Status 2026-10-22: **prepared, not enabled.** GitHub Pages is off, `deploy.yml` has never been run, there are no releases, tags or deployments. Nothing below has been executed against real Pages yet; steps marked *untested* are written from GitHub's documentation and must be checked at the first authorised test deployment. Spec: `specs/SPEC-005-ci-release.md`; decision: ADR-018.

Expected public address after authorisation: **https://mabdelaziz.github.io/qr-pocket/**

## 1. What the deployment workflow does

`.github/workflows/deploy.yml` — started by hand only (Actions → *Deploy* → *Run workflow*, branch `main`).

| Job | Permissions | What it does |
|---|---|---|
| `guard` | contents: read | Fails at once unless the run is on `refs/heads/main`. |
| `verify` | contents: read | Calls `ci.yml`, the same workflow every pull request runs: typecheck, lint, 200+ unit tests, two builds, stamp, public-file scan, size gate, audits, licences, all browser tests (Chromium, Firefox, WebKit). Only if all pass, it packages `dist/` as the Pages artifact. |
| `deploy` | **pages: write, id-token: write** (the only job with write access) | Environment `github-pages`. `configure-pages`, then `deploy-pages` publishes the artifact the verified run produced. Nothing is rebuilt. |
| `check-live` | contents: read | Fetches the live site (retrying for up to 4 minutes) and requires: HTTPS, `/qr-pocket/` path, `version.json` commit = the commit that was verified, manifest scope/start/id `/qr-pocket/`, standalone display, the 512 px icon, `sw.js`, and the start page. |

Safety properties (each enforced by `tests/unit/workflows.test.ts`):
- one trigger (`workflow_dispatch`), no inputs, so there is nothing to choose at dispatch time;
- a feature branch cannot be deployed: `guard` fails, and `github-pages` should also be restricted to `main` (section 2);
- `concurrency: pages`, `cancel-in-progress: false`: deployments queue and never overlap;
- workflow-level permissions are `contents: read`; no `pull_request_target`, no secrets, no third-party actions; every action is pinned to a full commit SHA;
- the shell steps put no event data into commands.

Run on the same `main` commit that has a green CI check. Pull requests can never deploy.

## 2. Enabling GitHub Pages (needs your authorisation; *untested*)

Do these only after you approve the first test deployment. Nothing here has been done.

**In the web interface** (simplest):
1. Repository → *Settings* → *Pages* → *Build and deployment* → *Source*: **GitHub Actions**. (No branch or folder to choose.)
2. *Settings* → *Environments* → *github-pages* (it appears after step 1) → *Deployment branches and tags* → *Selected branches and tags* → add `main`. Optionally add yourself under *Required reviewers* for a second confirmation click before each deployment.
3. Actions → *Deploy* → *Run workflow* → branch **main**.

**Or with the GitHub command line** (`gh`):
```
gh api -X POST repos/Mabdelaziz/qr-pocket/pages -f build_type=workflow
gh api -X PUT repos/Mabdelaziz/qr-pocket/environments/github-pages --input env.json
gh api -X POST repos/Mabdelaziz/qr-pocket/environments/github-pages/deployment-branch-policies -f name=main -f type=branch
gh workflow run deploy.yml --ref main
```
with `env.json` = `{"deployment_branch_policy":{"protected_branches":false,"custom_branch_policies":true}}`. If GitHub already created the environment with a default-branch policy, the second and third commands may report that it exists; check the result in Settings → Environments.

After the run: open the URL from the *deploy* job (or the address above), then follow `docs/UAT_CHECKLIST.md`. Record the run URL, commit and result in `docs/PROGRESS.md`.

## 3. Rolling back

The site is static, so a rollback is "publish the previous good version".
1. **Normal rollback (about 10 minutes).** Open a pull request that reverts the faulty commit (`git revert <sha>`). CI and branch protection apply as always. Merge it, then run *Deploy* on `main`. The check-live job confirms the older commit is live.
2. **Faster option.** If the previous good commit is still on `main`'s history and the revert would be large, a revert of the merge commit gives the same result.
3. **Installed apps** treat a rollback like any update: they show "A new version is ready" with *Reload* or *Later*. Saved QR codes are never touched (they live in the browser's IndexedDB, not in the site files).
4. **Emergency: a broken service worker keeps serving a bad version.** Follow `docs/SW_RECOVERY.md`: deploy the kill-switch worker (`docs/recovery/kill-switch-sw.js`) as `sw.js`. It deletes only this app's caches, unregisters itself and leaves saved codes alone. Then deploy a good build.
5. **Take the site offline completely.** Settings → Pages → *Unpublish site*. (Installed copies keep working from their cache until the browser drops them.)

GitHub keeps the previous deployment's artifact for one day only (`retention-days: 1`); rollback is therefore by commit, not by artifact.

## 4. How future updates reach the installed app

Merge to `main` through a pull request (CI must pass), then run *Deploy*. Visitors fetch the new `sw.js` on their next visit or the hourly foreground check; the new version waits and the app offers **Reload** / **Later**. It never reloads by itself and never while a dialog is open. Hosting caches pages for up to 10 minutes, so a brand-new visitor may see the previous version for that long.

## 5. Deployment configuration review (findings)

| Area | Finding | Evidence |
|---|---|---|
| Manifest paths | `id`, `start_url`, `scope` are `/qr-pocket/`; icons are relative (`icons/…`) so they resolve under `/qr-pocket/`; display `standalone`. | `vite.config.ts`; `tests/e2e/pwa.spec.ts` (subpath) and `check-live` against the real site |
| Service worker scope | `/qr-pocket/sw.js`, scope `/qr-pocket/`; the default scope rule needs no `Service-Worker-Allowed` header because worker and app share the folder. Cache names start `qr-pocket` so other project sites on the same `github.io` origin are never touched. | ADR-009, ADR-017 |
| CSP on Pages | Delivered by `<meta http-equiv>` because Pages cannot set headers: `default-src 'self'; script-src 'self'; worker-src 'self'; manifest-src 'self'; style-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'`. No inline scripts or styles, so Pages needs no exceptions. Limitation: a meta tag cannot enforce `frame-ancestors`, so the app could be framed by another site (it holds no secrets and has no sign-in). | `index.html`; e2e "no CSP violations" |
| Payloads stay on the device | There is no network code beyond loading the app's own files; `connect-src 'self'`; the scan fails the build if any absolute URL other than the W3C XML namespace labels is present; e2e asserts zero cross-origin requests while generating, saving, exporting and sharing. | `scripts/public-files.mjs`, `generate.spec.ts` AC9 |
| Public files hold no secrets | The scan covers every file of `dist/`: no source maps, dot files, sources or unexpected types; no token/key patterns; no local paths; no e-mail addresses. The only extra file is `version.json` (commit id, ref, run id: all public already). | `npm run check:public`, `publicFiles.test.ts` |
| Deployed bytes = verified bytes | The Pages artifact is created in the verified run after the browser tests ran on that `dist`, and is published without rebuilding. `check-live` compares the live `version.json` with the dispatched commit. | `ci.yml`, `deploy.yml`, `check-live` |
| Unverified branches | `guard` + one trigger + environment restricted to `main` + branch protection on `main` (PR, `verify` check, conversation resolution). | `workflows.test.ts`; `docs/SECURITY_SETTINGS.md` |
| HTTPS | Pages serves `github.io` over HTTPS only; `check-live` requires `https:`. Installability and service workers need a secure origin, which this provides. | `live-check.mjs` |
| PWA installability | Manifest with name, icons (192/512/maskable), `start_url`, `display: standalone`; service worker with a fetch handler (navigation fallback); HTTPS. Confirm *Install app* appears in Chrome on the first test deployment. | SPEC-004; `docs/UAT_CHECKLIST.md` |
| Headers | Pages sends `Cache-Control: max-age=600` and no custom headers. Pages (and first-time visitors) can therefore see the previous version for up to 10 minutes after a deployment. Browsers fetch the service-worker script itself without the HTTP cache by default (`updateViaCache: 'imports'`), so installed apps are not delayed by it. Acceptable; it is the reason for the 10-minute note above. | GitHub Pages documentation (*untested here*) |
| `/qr-pocket` without slash | Pages redirects to `/qr-pocket/`. | documented behaviour (*untested here*) |

Known limitations: no physical-device result yet; the first real Pages response headers have not been observed; Firefox/WebKit are Playwright desktop builds; `frame-ancestors` cannot be set.

## 6. If the deployment run fails

| Symptom | Likely cause | Action |
|---|---|---|
| `guard` fails | Run started from another branch | Re-run from `main`. |
| `verify` fails | A real check failed on `main` | Read the log, fix through a pull request. Nothing was published. |
| `configure-pages` fails: "Get Pages site failed" | Pages source is not *GitHub Actions* | Section 2, step 1. |
| `deploy` waits for approval | Required reviewers set on the environment | Approve in the run page. |
| `deploy` is refused: branch not allowed | Environment restricted to a different branch | Check the policy lists `main`. |
| `check-live` fails after 4 minutes | CDN delay, or the live commit differs | Re-run the job; compare `/qr-pocket/version.json`; if it stays wrong, roll back (section 3). |
