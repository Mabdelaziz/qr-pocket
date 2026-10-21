# Specs

One file per implementable feature: `SPEC-###-name.md`. Work proceeds one approved spec at a time.

## Required sections
Goal · User story · In/out of scope · Dependencies · UI impact · Interface/data contracts · Normal/error/edge behaviour · Security/privacy/accessibility · Given/When/Then acceptance criteria (IDs `SPEC-###-ACn`) · Automated + manual tests · Completion evidence · Status.

## Conventions
- Status: `DRAFT` → `APPROVED` → `IN PROGRESS` → `IMPLEMENTED (NOT VERIFIED)` → `VERIFIED` (only with CI/UAT evidence) → `DONE` (after independent review).
- Test titles begin with the spec ID; changes cite the spec ID.
- Evidence = CI run URL + SHA + counts, or UAT record. Never "should pass".
- Acceptance criteria are testable and map to TEST_PLAN IDs.

## Index
| Spec | Title | Depends on | Status |
|---|---|---|---|
| [SPEC-001](SPEC-001-qr-generation.md) | QR generation and preview | — | DRAFT |
| [SPEC-002](SPEC-002-local-library.md) | Local library (save/list/rename/delete) | 001 | DRAFT |
| [SPEC-003](SPEC-003-export-share.md) | PNG export and share | 001 | DRAFT |
| [SPEC-004](SPEC-004-pwa-offline.md) | PWA install and offline | 001–003 | DRAFT |
| [SPEC-005](SPEC-005-ci-release.md) | CI and release | all | DRAFT |

Implementation order: 001 → 002 → 003 → 004 → 005 (CI config for 001 is prepared early; see PROGRESS).
