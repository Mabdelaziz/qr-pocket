# QR Pocket — Claude Code Project Instructions

## Mission
Build **QR Pocket**, a tiny, accessible, offline-first, installable QR code generator for Android Chrome and modern desktop browsers. Users can create QR codes from text/URLs (including Arabic/Unicode), save entries locally, export PNG images, and share them where supported.

**Primary delivery:** Progressive Web App (PWA), hosted on GitHub Pages. **Repository:** `qr-pocket`. **Proposed local source folder:** `D:\ClaudProjects\qr-pocket` (or existing chosen folder; never relocate/delete without approval).

## Non-negotiable constraints
1. **No new laptop build environment.** Do not install Node packages, Android Studio, SDK, Java, Gradle, Flutter, Docker, emulators, or other build/test prerequisites locally. Existing Claude Code and git may be used for text/source editing. Do not run `npm install`, `npm ci`, `npm run build`, or browser test installations locally.
2. **Cloud-only verification.** Use GitHub-hosted Actions runners to install dependencies, lint, type-check, test, build, and validate deployable assets. “Local test” means local **source inspection** plus optional interactive browser tests *only if* an already available runnable preview requires no additional installation; otherwise use cloud CI + a browser-accessible GitHub Pages staging/demo build. Never claim an unexecuted test passed.
3. **Controlled external actions.** Do not create a remote repository, authenticate to new services, push code, expose the site, change Pages settings, or publish a release without explicit user authorization. After initial authorization, follow the agreed release policy; do not auto-publish unreviewed pull requests.
4. **Small, private by design.** No backend, API keys, tracking, advertising, cloud data sync, login, QR-generation API, runtime CDN requests or unnecessary frameworks. Stored codes remain on device in IndexedDB unless explicitly exported.
5. **Scope discipline.** MVP first. Do not add camera scanner, QR styling customization, cloud sync, accounts, PDF export, analytics, monetization, APK packaging, or notifications without approved new specs.
6. **Avoid destructive actions.** Inspect directory before writing. Preserve existing source and docs, make incremental commits after meaningful approved milestones, and never overwrite unrelated work.

## Stack (validate versions during Phase 0)
- Vite + TypeScript + semantic HTML + minimal plain CSS; avoid React unless a documented need is approved.
- A well-maintained, locally bundled QR encoder selected through a brief dependency/license/security review.
- IndexedDB for records; avoid large base64 image storage. Derive QR PNGs from stored content on demand.
- PWA manifest, installable icons, carefully scoped offline service worker (use a small maintained plugin only if clearly worthwhile).
- Vitest for unit tests; Playwright in GitHub Actions for key browser flows; independent QR decoding/round-trip checks.
- GitHub Actions for CI and release; GitHub Pages for HTTPS static hosting. Configure Vite `base` and service-worker scope for `/qr-pocket/` project-site paths. Use least-privilege workflow permissions and maintained official Actions.

## Product requirements (MVP)
### QR creation
- Input arbitrary plain text/URLs; supports UTF-8 Arabic, English, emoji and multiline text.
- Reject blank input; count encoded bytes and respond safely to actual QR encoding limits; never truncate silently.
- Render a scanner-compatible black-on-white QR with a sufficient quiet zone; crisp on phone screens.
- Clarify that URL fields encode the *provided* text, not a shortened/hosted URL. No network validation required.
- Test Arabic with independent decoders and a physical phone scanner because interoperability may vary.

### Save and manage
- Save title (optional sensible default), original payload, created/updated timestamps, and encoding/error-correction settings if needed.
- List saved items with a lightweight thumbnail; reopen, rename, delete with confirmation, re-export and share.
- Preserve records across normal app restarts within the same browser profile and origin; handle IndexedDB/storage errors visibly.
- Show a concise notice: uninstalling or clearing browser/site data may erase saved entries. Never claim a backup exists.

### Export and share
- Export valid high-resolution PNG (target 1024 × 1024 including quiet zone) with a safe filename.
- Browser download saves through the browser/Downloads; **do not promise direct Android Gallery-album writes**.
- Use `navigator.canShare` / Web Share API where available, with download fallback.
- Clean up temporary object URLs; handle permissions and rejected share attempts gracefully.

### Offline/PWA
- Installability: manifest, icons, appropriate start URL/display and service-worker registration.
- Once first load/install and caching succeed, core Generate, Saved, and Export flows work offline.
- Avoid caching sensitive user-generated payloads in network responses; explain deployment/update behaviour.
- Support small Android screens, touch targets, keyboard navigation, screen readers, loading/empty/error states, and RTL content without changing the whole UI language.

## UX: mandatory screen specifications
Create `docs/design/SCREEN_SPECS.md` and simple **text/HTML/CSS wireframes** before feature implementation. Required views:
1. **Generate:** app heading, text input, clear/generate action (live generation if performant), preview, Save, Download PNG, Share; empty/invalid/busy/success/error states.
2. **Saved:** saved cards with title/date/thumbnail, search/filter only if trivially inexpensive, open/rename/delete/export; empty state.
3. **Edit/Confirm dialogs:** rename and delete confirmation, accessible focus handling.
4. **Install/offline notices:** unobtrusive install guidance and offline/update status.
Use 360–430px mobile viewport as primary; also verify 320px and desktop. Write meaningful acceptance checks for each screen.

## Specification-driven source of truth
Maintain these files (create if missing):
- `docs/PRODUCT_SPEC.md`: scope, user journeys, user stories, functional/nonfunctional requirements, out-of-scope.
- `docs/ARCHITECTURE.md`: data flow, dependencies, storage schema, error handling, trust boundaries, ADRs.
- `docs/design/SCREEN_SPECS.md`: wireframes, navigation, states, accessibility and responsive rules.
- `specs/README.md`: spec conventions and index.
- `specs/SPEC-001-qr-generation.md`, `SPEC-002-local-library.md`, `SPEC-003-export-share.md`, `SPEC-004-pwa-offline.md`, `SPEC-005-ci-release.md`.
- `docs/TEST_PLAN.md`: automated/manual test matrix, CI coverage, Android device tests.
- `docs/RELEASE_CHECKLIST.md`: deployment and rollback manual.
- `docs/DECISIONS.md`: concise ADR-style decisions, with date/rationale/trade-offs.
- `docs/PROGRESS.md`: current milestone, verified results, blockers, next small task.

Each `specs/SPEC-###-name.md` must contain: Goal; user story; in/out of scope; dependencies; UI impact; interface/data contracts; normal/error/edge behavior; security/privacy/accessibility; Given/When/Then acceptance criteria; automated + manual tests; completion evidence and status. Every changed behavior must trace to a spec and test.

## Agent operating model
**Orchestrator (main Claude):** owns priority, scope, user approval gates, integration, progress summary. Use *specialist subagents when supported*, with narrowly scoped read/write boundaries:
- **Product/Architect agent:** specifications, architecture decisions and acceptance criteria; docs only unless authorized.
- **UX agent:** wireframes, screen specs, accessible interaction details; docs/prototypes only.
- **Implementation agent:** only the active spec, tests and targeted source files; no unrelated refactors.
- **QA agent:** independent review of acceptance criteria, edge cases and evidence; tests and defect reports.
- **Security/Release agent:** privacy, dependencies, Actions configuration, PWA cache paths and deployment checklist.
- **Reviewer agent:** scrutinize code and tests, enumerate defects by severity; do not mark own implementation reviewed.
Use built-in subagents or focused sequential tasks; do not assume agent teams or orchestration APIs are enabled. Parallelize independent research/review, **not conflicting edits**. Avoid complex agent frameworks and spending tokens on repetitive agent roles.

## Continuous spec–test–repair loop
For *each* approved spec, run:
1. **Specify:** confirm acceptance criteria, file ownership, edge cases, dependencies; register work in PROGRESS.
2. **Design:** update screen contracts/wireframes if visible UI changes.
3. **Test-first:** add/adjust a failing test representing the required behaviour (when practical).
4. **Implement:** smallest change satisfying the spec; prefer simple functions.
5. **Review locally without builds:** inspect diff, formatting, type logic, accessibility and security; record that these are inspections, not passing runtime tests.
6. **Verify remotely:** after cloud setup/authorization, push to an approved feature branch/PR; wait for CI evidence, review logs and test reports. Before cloud access exists, mark tests `NOT RUN` and produce a clear verification handoff.
7. **Repair:** classify failures, fix root cause, rerun CI; repeat until all required checks pass. Never pretend an iteration succeeded.
8. **Independent review:** QA/reviewer checks spec completeness and regression risk. Update spec status and evidence links.
9. **Commit/report:** concise changes, pass/fail/not-run matrix, risks, next spec.
Stop a loop when the acceptance criteria and exit gates are met, or surface a blocker with a proposed fix; never loop indefinitely or silently weaken requirements.

## Phase gates
- **Phase 0 (Plan):** inspect existing files, feasibility/dependency review, specs skeleton and decision docs. **STOP for user approval; no app source, installs or publication.**
- **Phase 1 (UX):** Generate and Saved screen wireframes; user flows, responsive/accessibility states. **STOP for design approval.**
- **Phase 2 (Core):** implement QR generation against SPEC-001; tests prepared and cloud-verified once authorized.
- **Phase 3 (Library/export):** IndexedDB, PNG export and sharing against SPEC-002/003.
- **Phase 4 (PWA):** offline/install/updates against SPEC-004.
- **Phase 5 (CI/release):** CI and deployment workflow against SPEC-005; get approval before first remote push/publication. Validate build, tests, security, Pages base paths.
- **Phase 6 (Phone UAT):** provide actual URL and Android Chrome steps; ask user to execute physical-device test matrix, collect results and fix defects; do not claim physical testing without evidence.
- **Phase 7 (Release):** approve final production release, tag only with user authorization, document version, known limitations and rollback.

## Test and acceptance matrix
Automate in GitHub Actions:
- Typecheck, lint, unit tests, browser smoke tests, production build.
- Input: empty, spaces, URLs, long Unicode/Arabic, emoji, payload at/above limits.
- Decode rendered QR via an **independent** decoder and compare exact bytes/text.
- PNG dimensions, readable contrast/quiet zone and content round trip.
- IndexedDB CRUD, persistence after reload, duplicates, deletion confirmation, storage exceptions.
- Share feature-detection/fallback, failed share behavior.
- PWA manifest, offline navigation after install/cache, update paths, GitHub Pages subpath (`/qr-pocket/`).
- 320px/360px/430px screen behavior, keyboard/focus/a11y smoke checks.
Manual UAT on physical Android Chrome:
- Open deployed HTTPS link; Add to Home Screen/Install if browser offers it.
- Generate URL and Arabic QR; scan each with a separate QR reader/phone camera.
- Save, close/reopen, work in airplane mode after caching, export PNG, locate in Downloads/Gallery if indexed, share, rename, delete.
- Check no data leaves device during core operations (where feasible) and update/reload behaviour.

## CI/deployment strategy
- Pull requests/features: build and automated tests only, no automatic public deployment. Optional staging preview needs explicit approved design; do not assume GitHub Pages provides native PR preview URLs.
- Main/release: deploy only after explicit user-authorized workflow and passing checks; prefer a manual `workflow_dispatch` release gate initially.
- Pages uses production `dist/`, HTTPS and the correct Vite `base: '/qr-pocket/'` (or derive from repo path); service worker manifest/start URL must match scope.
- Workflows use `npm ci`, lockfile, least permissions, cached deps, concurrency controls, and official GitHub actions (secure pinned versions when practical).
- Record Actions run URL, pass/fail counts, deployed URL, commit hash and any known limitations.
- If no GitHub repository/CI authorization yet, prepare configuration and explain exactly what remains unverified.

## Working practices
- TypeScript strict mode. Avoid `any` unless documented. No gratuitous abstractions.
- Keep UI separate from QR codec and persistence; avoid giant components/modules.
- Make layouts responsive and accessible. Use clear actionable errors and no network dependency.
- Document genuine technical compromises; don't invent test results, screenshots, phone results or deployment URLs.
- Every phase report: **Completed; files changed; specs covered; tests PASS/FAIL/NOT RUN; risks; next step; approvals needed.**
- Reference the applicable spec ID in change descriptions and test titles.
- On a blocking decision, offer a grounded recommendation and continue only within the user's previously approved scope.

## First instruction
If this is the first session, **start Phase 0 only**. Inspect the existing folder, draft the required planning/specification documents and a phased execution backlog. Do not write application source code or trigger any external actions. Present the architecture, testing strategy and approval questions, and then stop at the Phase 0 gate.
