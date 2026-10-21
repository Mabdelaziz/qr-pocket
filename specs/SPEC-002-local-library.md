# SPEC-002 — Local library (save, list, open, rename, delete)

Status: IN PROGRESS (Phase 3, branch `phase-3-library-export`) — refined 2026-10-21 per owner Phase 3 authorisation.

## Goal
Persist QR payloads (never images) in IndexedDB and let the user manage them safely, while generation and export keep working if storage is unavailable.

## User story
US-04, US-05, US-06.

## In / out of scope
In: Save from Generate, Saved screen (loading / empty / error / list), lazy thumbnails, Open, Rename dialog, Delete confirmation, storage notice and errors, hash routing + bottom navigation. Out: search, folders, import/export, sync, camera scanning (V1.1; only the `source` field allows for it), editing a saved record's payload in place (editing creates a new record), duplicate detection across sessions.

## Dependencies
SPEC-001 (`encode`, `drawQr`, Generate state). SPEC-003 for Download/Share on cards. Screen specs §2–3 and "Final G1b refinements". ADR-004, ADR-009, ADR-016.

## UI impact
Saved screen (S1–S7), Save button states and messages on Generate (G9, G10), bottom navigation, native `<dialog>` for rename/delete.

## Interface / data contracts
```ts
type SavedSource = 'typed' | 'scanned';           // 'scanned' reserved for V1.1; never written in 1.0
interface SavedCode {
  id: string;                  // crypto.randomUUID() (fallback: getRandomValues hex)
  title: string;               // 1–80 code points; blank => default title
  payload: string;             // exact text, never normalised or trimmed
  ecc: 'L' | 'M';              // level actually used
  source: SavedSource;
  createdAt: number;           // epoch ms; strictly increasing within a session
  updatedAt: number;
  v: 1;                        // record schema version
}
interface CodeStore {
  add(input: { payload: string; ecc: Ecc; title?: string; source?: SavedSource }): Promise<SavedCode>;
  list(): Promise<SavedCode[]>;                        // newest first = createdAt desc (renames do not reorder)
  get(id: string): Promise<SavedCode | undefined>;
  rename(id: string, title: string): Promise<SavedCode>;
  remove(id: string): Promise<void>;                   // idempotent
}
class StoreError extends Error { kind: 'unavailable' | 'quota' | 'not-found' | 'invalid' | 'unknown' }
```
IndexedDB database `qr-pocket`, version 1, object store `codes` (keyPath `id`), index `createdAt`. `add` uses `IDBObjectStore.add` only (never `put`), so an existing record is never overwritten. Promises resolve on transaction `complete`, reject on `abort`/`error`. No image data is stored. Default title: first non-blank line of the payload, ≤ 40 code points, else `QR code YYYY-MM-DD`.

## Behaviour
- **Save:** enabled only when a QR is shown. While saving the button is busy and further activations are ignored. On success the button becomes a non-repeatable "Saved" state next to a success panel ("Saved to this device. Clearing browser data may erase saved codes — there's no backup.") announced politely once. The state is keyed on **text + error-correction level**: any change to either resets it to "Save", and saving then creates a **new** record. Opening a saved item marks its content as saved; editing it and saving creates a new record (never an overwrite). Deleting the record that the Save state refers to resets the state. After a page reload the state is empty, so saving the same content again creates a new record (explicit user action).
- **Saved screen:** loading skeleton → list (newest first, "N codes") or empty state ("Nothing saved yet" + "Create a QR code" → Generate, input focused) or error panel (Retry + Create). Each card: thumbnail (drawn lazily), title (`dir="auto"`, two-line clamp), date, **Open** (primary), Rename, Download, Share (only when supported), Delete; accessible names include the title.
- **Open:** loads payload and level into Generate (Save shows "Saved" until edited) and navigates there.
- **Rename:** native dialog, field prefilled and selected; Save disabled while busy; blank or whitespace → default title; Esc/Cancel changes nothing; failure keeps the dialog open with an inline error and leaves the record unchanged.
- **Delete:** native dialog with Cancel focused; Delete removes the record; failure keeps the record and the dialog open with an inline error. After deletion focus moves to the next card's Open button, else the previous card's, else the empty-state button.
- **Storage unavailable / quota / blocked:** Save shows an error panel with Try again (no partial record); Saved shows the error state; QR generation and PNG export stay fully usable.
- **Focus:** each dialog restores focus to the control that opened it (or the nearest surviving element).
- **Edge:** 2,953-byte and emoji/Arabic payloads and titles; titles with control characters are cleaned; two tabs open (list reloads whenever the Saved screen is entered); malformed records in the database are skipped when listing.

## Security / privacy / accessibility
All user text is rendered with `textContent`/DOM APIs. Names are prefixed `qr-pocket` (shared github.io origin, ADR-009). Native dialogs (`showModal`) give a top layer, focus trap, Esc and inert background. Status messages: one channel per message (alert panels announce themselves; success/info through the polite status region). Targets ≥ 48px, labels ≈ 14px, rem-based sizes (150%/200% text), no horizontal overflow at 320px, navigation reachable with the on-screen keyboard (in-flow layout, `interactive-widget=resizes-content`).

## Acceptance criteria
- AC1 Given a valid QR, when Save is pressed, then exactly one record exists with the exact payload (byte-identical Unicode/Arabic), level, `source: 'typed'`, timestamps, `v: 1`, and no image data.
- AC2 Given saved items, when the app reloads, then the same items appear newest first (createdAt desc); renaming does not reorder.
- AC3 Given an item, when Rename is submitted, then the list shows the new title and `updatedAt` increased; a blank title yields the default title; Esc/Cancel leaves it unchanged.
- AC4 Given an item, when Delete is pressed, then a dialog with Cancel focused appears; Cancel keeps it; Confirm removes it and focus moves as specified.
- AC5 Given IndexedDB cannot be opened (injected), then Saved shows an error with Retry, Save shows an error panel, and generation/Download still work.
- AC6 Given quota/abort errors on add (injected), then the user sees an error and no record exists.
- AC7 Given zero items, then the empty state with a "Create a QR code" action shows.
- AC8 Given a successful save, then the notice states data stays on this device and may be erased, and never claims a backup.
- AC9 Given Open on an Arabic item, then the payload appears with correct direction and regenerates an identical QR.
- AC10 Given 320px width and 150%/200% text, then cards and actions do not overflow, wrap gracefully and remain keyboard reachable (≥ 48px targets).
- AC11 Given a successful Save, then a second activation (including rapid double activation) creates no second record; changing the text or the level resets the button and the next save creates a new record; deleting the saved record also resets it.
- AC12 Given a rename or delete failure (injected), then the record is unchanged, the dialog stays open with an inline error, and a retry succeeds once the fault clears.
- AC13 Given the Saved screen is loading, then a polite "Loading saved codes…" state is present (view model) and replaced by the result.
- AC14 Given keyboard-only and screen-reader use, then dialogs trap focus, Esc closes them, focus returns to the opener, and axe finds no WCAG 2.x A/AA violations on the Saved screen (populated, empty, error) and both dialogs.
- AC15 Given the whole flow, then no request leaves the origin and there are no console/CSP errors.

## Tests
Automated (CI): `tests/unit/store.test.ts`, `titles.test.ts`, `saveState.test.ts`, `savedModel.test.ts` (fake-indexeddb, injected faults), `tests/e2e/library.spec.ts` (persistence, Unicode, duplicates, resets, dialogs, faults, responsive, axe, keyboard, privacy). Manual: UAT U7, U11, U14.

## Completion evidence
Pending first CI run on `phase-3-library-export`.
