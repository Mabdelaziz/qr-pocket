# SPEC-003 — PNG export and share

Status: IN PROGRESS (Phase 3, branch `phase-3-library-export`) — refined 2026-10-21 per owner Phase 3 authorisation.

## Goal
Produce a 1024×1024 PNG on demand from a payload (never from stored images) and let the user download or share it.

## User story
US-07, US-08.

## In / out of scope
In: PNG render, safe filename, download, Web Share (files) only when supported, from Generate and from Saved cards. Out: SVG/PDF, Gallery writes, clipboard, size choices, text/URL sharing, sending any payload to an external service.

## Dependencies
SPEC-001 (matrix, `matrixToRgba`); SPEC-002 for the Saved entry points. Screen specs §1–2.

## UI impact
Download PNG and Share buttons (Generate and each saved card); inline error panels; "Sharing files isn't supported in this browser." line when Share is hidden.

## Interface / data contracts
```ts
// src/export/png.ts
function computeExportLayout(modules: number, size = 1024): { size: number; scale: number; offset: number; pixels: number };
function renderExportRgba(matrix: QrMatrix, size = 1024): RgbaImage;   // pure; what the PNG contains
function renderPngBlob(matrix: QrMatrix, size = 1024): Promise<Blob>;  // image/png via canvas
// src/export/filename.ts
function slugify(title: string): string;
function pngFilename(title: string, date: Date): string;               // 'qr-<slug>-yyyymmdd.png'
// src/export/download.ts
function downloadBlob(blob: Blob, filename: string): void;             // <a download>; revokes the object URL
// src/share/share.ts
function canShareImageFiles(nav?: Navigator): boolean;
function shareImageFile(file: File, nav?: Navigator): Promise<'shared' | 'cancelled'>; // throws ShareError
```
**Layout:** modules are drawn at the largest **even integer** scale `s` with `s * (modules + 8) <= 1024`; the symbol including its 4-module quiet zone is centred, so the left/right and top/bottom white margins are identical (evenness makes the padding exactly symmetric because 1024 is even and `modules + 8` is odd). Black `#000` modules on white `#fff`, fully opaque, no anti-aliasing. Largest symbol (version 40, 177 modules) → 4 px/module; typical symbols ≥ 10 px/module.
**Filename:** NFC-normalised; control and bidi-control characters removed; lower-cased; any run of characters that are not letters, combining marks or digits becomes `-`; ≤ 40 code points; fallback `code`; always `qr-<slug>-<yyyymmdd>.png` (local date), ≤ 60 characters. Arabic letters are kept; emoji and path/reserved characters are dropped.
**Share:** feature-detected with `navigator.share` + `navigator.canShare({ files })` using a tiny probe image file; only a PNG `File` is shared (no `title`/`text`/`url`, so the payload is not sent as text). `AbortError` → `'cancelled'` (silent); anything else → `ShareError` shown as "Couldn't open the share sheet. You can download the image instead."
**Download:** object URL created for the click and revoked ≤ 4 s later; nothing retained.

## Behaviour
- Download and Share are enabled only when a QR is shown (muted, not activatable, no explanatory message otherwise); a busy guard ignores repeated activations while rendering.
- The PNG is derived from the payload and level (`encode` → matrix → pixels); saved cards use the record's payload/level and title; generated codes use the default title of the payload for the filename.
- Share hidden when unsupported; the explanatory line replaces it; Download always remains.
- Text copy: "Saved to your browser's Downloads" is never claimed as Gallery integration.
- Edge: version-40 payload (2,953 bytes at Low) exports at 4 px/module and still decodes; titles with Arabic/emoji/slashes/200 characters/empty; concurrent clicks; encode failure for a corrupt stored record → error panel on Saved.

## Security / privacy / accessibility
No network access; the file never leaves the device except through the user's chosen share target. Buttons have text labels and `aria-busy` while rendering; errors are alert panels.

## Acceptance criteria
- AC1 Given any valid payload, then the PNG is exactly 1024×1024 and its pixels decode (independent decoders: jsQR and ZXing) to the exact payload bytes.
- AC2 Given the exported pixels, then only pure black and pure white appear, fully opaque; the white margin around the symbol is symmetric (left = right, top = bottom) and at least 4 modules wide; module blocks have integer size.
- AC3 Given titles with Arabic, emoji, slashes, reserved characters, 200 characters or empty, then the filename is valid, ≤ 60 characters, ends `.png`, and keeps Arabic letters.
- AC4 Given Download, then a download event fires with that filename, the file is a valid PNG, and every created object URL is revoked.
- AC5 Given `navigator.share`/`canShare` is missing or returns false, then Share is not present, the explanation line is visible, and Download works.
- AC6 Given share rejects with `AbortError`, then no error is shown; given another error, then the error panel appears, Download still works and the app stays usable.
- AC7 Given a saved item, when exported, then the PNG is derived from the stored payload and level (no stored image exists), with the record title in the filename.
- AC8 Given keyboard/screen-reader use, then buttons are operable, labelled and axe-clean.
- AC9 Given a version-40 payload (2,953 bytes at Low), then export succeeds at 4 px/module and decodes exactly.
- AC10 Given export/share, then no request leaves the origin.
- AC11 Given no QR (empty/invalid/too long), then Download/Share do nothing when activated.

## Tests
Automated (CI): `tests/unit/export-png.test.ts`, `filename.test.ts`, `share.test.ts`; `tests/e2e/export.spec.ts` (download bytes parsed and decoded in Node with a minimal PNG decoder, share stubs, object-URL tracking, network log, responsive/axe). Manual: UAT U9, U10 (Downloads location; Photos visibility not guaranteed; real share targets).

## Completion evidence
Pending first CI run on `phase-3-library-export`.
