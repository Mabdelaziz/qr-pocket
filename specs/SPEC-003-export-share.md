# SPEC-003 — PNG export and share

Status: DRAFT

## Goal
Produce a 1024×1024 PNG on demand from a payload and let the user download or share it.

## User story
US-07, US-08.

## In / out of scope
In: PNG render, safe filename, download, Web Share (files) with fallback, from Generate and Saved. Out: SVG/PDF, Gallery writes, clipboard, size choices, text sharing.

## Dependencies
SPEC-001 (matrix, renderer); SPEC-002 for the Saved entry points. Screen specs §1–2.

## UI impact
Download PNG and Share buttons (Generate and each saved card); inline error/status.

## Interface / data contracts
```ts
function toPngBlob(m: QrMatrix, size = 1024): Promise<Blob>;       // image/png, exactly size×size
function pngFilename(title: string, date: Date): string;          // 'qr-<slug>-yyyymmdd.png'
function download(blob: Blob, filename: string): void;            // <a download>, revokes URL
function canShareFile(file: File): boolean;                       // navigator.canShare?.({files:[file]})
function shareFile(file: File, title: string): Promise<'shared' | 'cancelled'>; // throws ShareError
```
Filename: Unicode-normalised, strip `\/:*?"<>|` and control chars, collapse whitespace to `-`, lowercase ASCII, keep Arabic letters, max 40 chars of slug, fallback `qr-code`, no reserved Windows names.
PNG: integer module scale centred on white 1024², smoothing off, quiet zone ≥ 4 modules.

## Behaviour
- Download: build blob → anchor click → revoke object URL after use (next tick/timeout). Text says "Saved to your browser's Downloads"; **no Gallery promise**.
- Share: only when `canShare({files})`; otherwise the button is hidden and the text "Sharing files isn't supported in this browser — use Download." is shown (ADR-012). Download is always available. Cancel (`AbortError`) → silent. `NotAllowedError`/other → message "Couldn't open the share sheet. You can download the image instead."
- Busy state while rendering; double-tap guarded.
- Edge: maximum-version QR (n=177) still ≥ 5 px/module (floor(1024/185)=5); empty/too-long payload → actions disabled; extremely long titles; concurrent clicks.

## Security / privacy / accessibility
No network; file never uploaded by the app. Buttons have text labels, busy via `aria-busy`, results announced via live region. Objects URLs not retained.

## Acceptance criteria
- AC1 Given any valid payload, then the PNG is exactly 1024×1024 and its pixels decode to the exact payload.
- AC2 Given the PNG, then the margin around modules ≥ 4 modules wide and only black/white pixels (no anti-aliasing) appear.
- AC3 Given titles with Arabic, emoji, slashes, reserved chars, 200 chars or empty, then the filename is valid, ≤ 60 chars total, ends `.png`.
- AC4 Given Download, then a download event fires with that filename and object URLs are revoked.
- AC5 Given `navigator.canShare` is missing or returns false, then the Share button is not present, the explanation text is visible, and Download works.
- AC6 Given share rejects with AbortError, then no error is shown; given another error, then the message appears and the app stays usable.
- AC7 Given a saved item, when exported, then the PNG is derived from stored payload (no stored image used).
- AC8 Given keyboard/screen-reader use, then buttons are operable and results announced.

## Tests
Automated (NOT RUN): T-003-1..4, T-A11Y. Manual: U9, U10 (Downloads location, Photos visibility not guaranteed, share targets).

## Completion evidence
None yet. Status DRAFT.
