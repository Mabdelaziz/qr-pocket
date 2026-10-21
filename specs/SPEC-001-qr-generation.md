# SPEC-001 — QR generation and preview

Status: VERIFIED by cloud CI 2026-10-21 ([run 39630462029](https://github.com/Mabdelaziz/qr-pocket/actions/runs/39630462029), commit `95ed734`, Chromium + Node 22 on ubuntu-24.04). Not yet DONE: physical-phone UAT (U3–U6, U14) and owner approval to continue are outstanding.

## Goal
Turn user text into a scanner-compatible QR code, locally, and show a crisp preview with clear validation.

## User story
US-01, US-02, US-03.

## In / out of scope
In: Generate screen input, live generation, byte counter, capacity handling, explicit user-chosen switch from M to L (never automatic), canvas preview, Clear, states. Out: saving, export, share, styling, ECC picker, scanning.

## Dependencies
`qrcode-generator` per ADR-002 (via `src/qr/encode.ts` wrapper; Nayuki vendored file is the fallback); jsQR + zxing-wasm (dev-only) for tests. Screen spec §1.

## UI impact
Generate screen (SCREEN_SPECS §1).

## Interface / data contracts
```ts
type Ecc = 'L' | 'M';
interface QrMatrix { size: number; get(x: number, y: number): boolean; ecc: Ecc; version: number; }
type EncodeResult =
  | { ok: true; matrix: QrMatrix; bytes: number }
  | { ok: false; reason: 'empty'; bytes: number }
  | { ok: false; reason: 'too-long'; bytes: number; maxBytes: number; fitsAtL: boolean }
  | { ok: false; reason: 'failed'; bytes: number };   // encoder error, or text with a lone surrogate (refused, never substituted)
function encode(text: string, ecc: Ecc = 'M'): EncodeResult;   // pure, no DOM; never changes ecc itself
function drawQr(canvas: HTMLCanvasElement, m: QrMatrix, px: number): void; // quiet zone 4, integer scale
```
`bytes` = `new TextEncoder().encode(text).length`. Text is encoded exactly as entered (no trimming of content; blank check uses `trim()`).

## Behaviour
- Normal: non-blank text → encode at the selected level (default M) → preview; counter shows bytes and the limit for the selected level.
- M overflow → **no preview**, alert: "Too long for Medium error correction: N bytes, maximum M." If `fitsAtL`, an explicit button **"Use lower error correction (L)"** is offered with a one-line explanation (L tolerates less damage). Nothing changes until the user presses it. If it exceeds L too: "Too long: N bytes. Maximum is 2,953." with no option.
- After the user picks L, a persistent line "Error correction: Low · [Back to Medium]" shows; editing text keeps L until Back/Clear. Saved record stores the level actually used.
- Blank → `empty`; message only after the user has interacted.
- Edge: newline-only, 1 byte, emoji (4 bytes), RTL/LTR mix, leading/trailing spaces preserved, max boundary 2953 bytes at L, very rapid typing (debounce; last input wins), Clear returns to empty state.
- Errors: unexpected encoder exception, or text containing a lone surrogate (would otherwise be silently changed to U+FFFD; detected by `hasLoneSurrogate()`, which does not depend on `String.prototype.isWellFormed`) → alert "Couldn't generate this code"; app remains usable.
- Announcements use ONE channel: errors are `role="alert"` panels (rebuilt only when the message changes; their byte numbers update in place with `aria-live="off"`); the Medium-overflow warning has no live role and is announced through the polite `#sr-status` region together with "QR code ready."; the byte counter is not live.
- Focus: after "Use lower error correction (L)" focus moves to "Back to Medium" (keyboard stays closed); after "Back to Medium" it moves to the Low action if present, else the field; Clear refocuses the field.
- Restore-safe: if the browser re-populates the field (reload/back-forward), the initial state is derived from the field value.

## Security / privacy / accessibility
`textContent` only for echoing user text; no network. Textarea has a visible label, `dir="auto"`; counter and errors programmatically associated (`aria-describedby`); preview canvas `role="img"` with `aria-label="QR code for the text you entered"`; focus ring; touch ≥ 48 px.

## Acceptance criteria
- AC1 Given blank/whitespace input, when the user has typed then cleared, then a "Enter some text or a link." message shows and no QR is drawn.
- AC2 Given `https://example.com`, then a QR is drawn and decoding its pixels with the independent decoder returns the exact string.
- AC3 Given Arabic text (≥ 200 chars), emoji, and multiline text, then decode returns byte-identical text for each.
- AC4 Given 2954 ASCII bytes, then `too-long` (`fitsAtL:false`), counts shown, no QR, no L option.
- AC5 Given text between the M and L limits, then no QR is drawn, the M-limit error is shown with the explicit "Use lower error correction (L)" button; the encoder is never silently called at L; after pressing it a QR at L is drawn, the "Error correction: Low" line shows, and "Back to Medium" restores the error.
- AC5b Given exactly 2953 ASCII bytes with L selected, then a QR is produced and decodes exactly.
- AC6 Given any QR, then quiet zone ≥ 4 modules, module scale is an integer, and only black/white pixels are used.
- AC7 Given 320, 360, 390 and 430 px viewports, then the white preview frame is ≥ 240 CSS px, the QR canvas is square and fully inside the viewport, and there is no horizontal scroll (the QR itself may be smaller than the frame for dense codes because the module scale is an integer).
- AC10 Given Arabic content, then the field direction follows the content (`:dir(rtl)`), Latin content is `:dir(ltr)`, and Unicode is never normalised or altered (bidi controls, ZWJ sequences, decomposed forms and leading/trailing spaces round-trip byte-exact).
- AC11 Given 150% and 200% text scaling at 320 px, and a short viewport simulating the on-screen keyboard, then there is no horizontal overflow, controls stay inside the viewport, the page scrolls, and the Low/Back/Clear actions remain reachable; all controls are ≥ 48×48 CSS px; helper text and labels are ≈ 14 px.
- AC12 Given state changes, then the screen-reader status announces "QR code ready." / the Medium-overflow warning once, error alerts are not announced twice or rebuilt while typing, and focus moves as described under Behaviour.
- AC8 Given keyboard-only use, then all controls are reachable and errors are announced (axe + aria-live assertions pass).
- AC9 Given the app running, then no network requests are made during generation.

## Tests
Automated (CI, NOT RUN): T-001-1..8 — `tests/unit/{encode,layout,model,decode-zxing}.test.ts`, `tests/e2e/generate.spec.ts`. Test titles prefixed `SPEC-001`. Independent decoders: jsQR (unit + browser canvas pixels) and ZXing (unit; a mismatch is a real interoperability finding, ADR-014).
Manual: UAT U3–U6 on phone with two scanners.

## Completion evidence
CI run 39630462029 (PASS): typecheck, ESLint, 80/80 unit tests (jsQR and ZXing both decode all 14 payload cases byte-exact), 41/41 Playwright tests (AC1–AC12 covered incl. axe WCAG A/AA on 7 states, 150%/200% text, 320–430 px, keyboard, CSP/privacy), build 12.91 KB gzip, 0 vulnerabilities. An earlier run ([39627260313](https://github.com/Mabdelaziz/qr-pocket/actions/runs/39627260313)) was cancelled by a test defect (AC6 pixel loop), fixed in `95ed734`. Not covered by CI: real phone scanners/TalkBack/on-screen keyboard, non-Chromium browsers. A static independent review (2026-10-21, source reading only) led to fixes for: a Playwright strict-mode selector clash, stale byte counts in alert text, double screen-reader announcements, restore-safe initial state, forced-colors focus outline, weak jsQR scale at capacity boundaries, lone-surrogate handling. Recorded in docs/PROGRESS.md and docs/TRACEABILITY.md.
