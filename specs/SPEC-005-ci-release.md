# SPEC-005 — CI and gated deployment

Status: IN PROGRESS (Phase 5, branch `phase-5-deploy`) — refined 2026-10-22 per owner Phase 5 authorisation. **Preparation only: GitHub Pages stays disabled and the deployment workflow must not be run until the owner authorises the first test deployment.**

## Goal
All verification runs on GitHub-hosted runners; publishing to GitHub Pages is a manual, gated, least-privilege workflow that can only deploy the verified `main` branch, deploys exactly the bytes that passed the tests, and can be rolled back.

## User story
US-11. As the owner I can open the real app on my laptop and my Android phone from a public HTTPS address, after I explicitly approve a deployment.

## In / out of scope
In: `ci.yml` (reusable), `deploy.yml` (manual), build stamp, public-file/secret scan, dry-run of the Pages artifact on every pull request, deployment guide, user guide, UAT checklist, rollback and recovery documentation. Out: enabling Pages, running the deploy workflow, releases, tags, custom domain, automatic deployment, preview deployments.

## Dependencies
SPEC-004 (PWA build). ADR-008, ADR-017, ADR-018 (this phase). Official actions only (`actions/*`), every one pinned to a full commit SHA (repository setting `sha_pinning_required`).

## Interface / data contracts
**`ci.yml`** triggers: `pull_request`, `push` to `main`, `workflow_call`. Permissions `contents: read`. Steps: `npm ci`, typecheck, lint, unit tests, `npm run build`, `npm run build:v2`, **stamp** (`scripts/stamp-build.mjs` writes `dist/version.json` = `{app, commit, ref, run}`), **public-file scan** (`scripts/check-public-files.mjs`), size gate, audits, licence check, Playwright (Chromium, Firefox, WebKit smoke), and — only if everything passed — `actions/upload-pages-artifact` of `dist` (retention 1 day). On pull requests this upload is a **dry run** that proves the artifact packaging works; nothing can deploy from it.
**`deploy.yml`** trigger: `workflow_dispatch` only, no inputs. Workflow permissions `contents: read`. Jobs in a strict chain: `guard` (fails unless `GITHUB_REF` is `refs/heads/main`) → `verify` (calls `ci.yml`; same checks as a PR) → `deploy` (**the only job with `pages: write` and `id-token: write`**; environment `github-pages`; `actions/configure-pages` then `actions/deploy-pages` of the artifact produced by the verified run) → `check-live` (read-only; the live site must serve this commit's `version.json`, the manifest with scope `/qr-pocket/`, the worker and an icon over HTTPS). `concurrency: group pages, cancel-in-progress: false` so deployments queue and never overlap.
**Public files** (everything in `dist`): only `.html .js .css .svg .png .webmanifest` and `version.json`; no source maps, dot files, `.ts`, `.md`, `.env`; no secrets or credential patterns; no local paths (`C:\Users`, `/home/runner`, `D:\ClaudProjects`); no e-mail addresses; no absolute `http(s)` URLs other than the explicit allow-list (W3C XML namespace identifiers, which are labels, not requests).
**Expected URL** after authorisation: `https://mabdelaziz.github.io/qr-pocket/`.

## Behaviour
- A failing check anywhere stops the chain: no artifact is uploaded (`if: success()`), so nothing can be deployed from a failed run.
- Dispatching `deploy.yml` on any branch other than `main` fails immediately at `guard`; additionally the `github-pages` environment is restricted to `main` (setup in `docs/DEPLOYMENT.md`).
- The deployed bytes are the verified bytes: the artifact is produced inside the verified run, after the e2e tests ran on the same `dist` (including the stamp).
- Rollback: revert the faulty commit through a normal pull request (CI + protection apply), merge, dispatch the deploy again (guarded and verified); emergency: kill-switch worker (`docs/SW_RECOVERY.md`). Installed apps pick up the rollback as an ordinary update (prompt-based).
- Edge: Pages disabled → `configure-pages` fails and nothing is published; two dispatches queue; hosting caches (`max-age=600`) can delay first-time visitors by ~10 minutes, installed apps see updates at their next update check.

## Security / privacy / accessibility
Least privilege per job; no secrets; `GITHUB_TOKEN` only; no `pull_request_target`; no third-party actions; no step uses untrusted event data in shell. QR payloads never leave the device (no network code in the app, CSP `connect-src 'self'`, tested). The public site contains only the static build and `version.json` (commit id, run id, ref: not sensitive). Pages is HTTPS-only on `github.io`.

## Acceptance criteria
- AC1 Given a pull request or push to `main`, then `ci.yml` runs every gate on a hosted runner (typecheck, lint, unit, build x2, stamp, public-file scan, size, audits, licences, Playwright) and uploads a Pages artifact only after all of them pass.
- AC2 Given `deploy.yml`, then its only trigger is `workflow_dispatch`, and every job is downstream of `guard`, which fails unless the ref is `main`.
- AC3 Given all workflow files, then workflow-level permissions are `contents: read`; the only `write` permissions are `pages: write` and `id-token: write` in the single `deploy` job; there is no `pull_request_target`, no `secrets.*`, and no `contents: write`.
- AC4 Given every `uses:` in every workflow, then it is an `actions/*` action pinned to a 40-hex SHA (or the local reusable `ci.yml`).
- AC5 Given the deployment workflow, then `concurrency` is `pages` with `cancel-in-progress: false`, the verification is the same `ci.yml`, and the deployed artifact comes from that run.
- AC6 Given the built `dist`, then the public-file scan passes, `version.json` carries the commit being built, and the scan demonstrably catches planted secrets, source maps, local paths and unexpected URLs (unit tests).
- AC7 Given the live deployment (after authorisation), then `check-live` confirms HTTPS, the stamped commit, the manifest scope, the worker and an icon.
- AC8 Given the documentation, then `docs/DEPLOYMENT.md` (enable, rollback, recovery, security review), `docs/USER_GUIDE.md` (plain-language steps with screenshots) and `docs/UAT_CHECKLIST.md` (Android checklist) exist and match the implemented behaviour.
- AC9 Given repository settings, then Pages is disabled and no deployment, release or tag exists until the owner authorises the first test deployment.

## Tests
Automated (CI): `tests/unit/workflows.test.ts` (AC2–AC5, YAML pitfalls), `tests/unit/publicFiles.test.ts` and `stamp.test.ts` (AC6), the PR dry-run upload and `npm run check:public` (AC1, AC6). `deploy.yml` itself is NOT executed before authorisation; its jobs are verified statically and by GitHub's workflow parser (it must be listed as a valid workflow). Manual: first test deployment (after approval) + `docs/UAT_CHECKLIST.md` on the owner's laptop and phone.

## Completion evidence
Pending first CI run on `phase-5-deploy`.
