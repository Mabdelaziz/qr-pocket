# SPEC-005 — CI and release

Status: DRAFT

## Goal
All install/lint/test/build verification runs on GitHub-hosted runners; deployment to GitHub Pages is manual, gated and reversible.

## User story
US-11.

## In / out of scope
In: `ci.yml` (PR/branch), `deploy.yml` (`workflow_dispatch`), lockfile policy, audit/licence/size gates, Playwright reports, Pages base-path check. Out: automatic production deploy, PR preview URLs, release notes automation, custom domain, secrets.

## Dependencies
ADR-008; RELEASE_CHECKLIST; other specs' tests. **Pushing or enabling Pages requires owner approval (G2/G3).**

## UI impact
None.

## Interface / data contracts
`ci.yml`: trigger `pull_request` and `push` to non-main branches (and `main` without deploy); `permissions: contents: read`; `concurrency` cancel-in-progress per ref; steps: `actions/checkout`, `actions/setup-node` (Node LTS, npm cache), `npm ci`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, size gate, `npm audit --omit=dev --audit-level=high`, licence check, Playwright install + e2e against `vite preview` at `/qr-pocket/`, upload Playwright report and `dist` artifact.
`deploy.yml`: `workflow_dispatch` (input `ref`), job 1 repeats gates, job 2 uses `actions/configure-pages`, `actions/upload-pages-artifact`, `actions/deploy-pages`; `permissions: pages: write, id-token: write, contents: read`; environment `github-pages`; concurrency group `pages` no cancel.
npm scripts contract: `dev`, `build`, `preview`, `typecheck`, `lint`, `test`, `test:e2e`. Action versions pinned to current majors (SHA pinning proposed, verified at write time).

## Behaviour
- Any failing gate fails the run; no deploy job runs.
- Run summary records SHA, test counts, bundle size.
- Failure triage: classify (test defect / product defect / infra), fix root cause, rerun; never loosen gates silently — changes to gates need an ADR.
- Edge: lockfile out of sync → `npm ci` fails (desired); flaky e2e → investigate, no blanket retries beyond Playwright's single retry with report.

## Security / privacy / accessibility
Least privilege per job; no secrets; no `pull_request_target`; third-party actions limited to official `actions/*`; Dependabot proposal pending approval; artifacts contain no user data.

## Acceptance criteria
- AC1 Given a PR or branch push, then `ci.yml` runs all listed gates on a hosted runner and publishes results.
- AC2 Given a failing unit/e2e/type/lint test, then CI fails and `deploy.yml` cannot succeed.
- AC3 Given `deploy.yml` run manually on `main`, then gates pass before artifact upload and deployment, and the deployed URL ends in `/qr-pocket/`.
- AC4 Given the built site served at `/qr-pocket/`, then no asset request returns 404 (T-005-2).
- AC5 Given workflow files, then `permissions` are least-privilege and no secrets or `pull_request_target` are used (inspection).
- AC6 Given a rollback request, then re-running deploy with a prior ref restores that version (RELEASE_CHECKLIST §E).

## Tests
Verification is the workflows' own runs: T-005-1, T-005-2. Manual: checklist walkthrough.

## Completion evidence
None. Workflows not yet written; nothing run.
