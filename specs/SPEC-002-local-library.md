# SPEC-002 — Local library (save, list, open, rename, delete)

Status: DRAFT

## Goal
Persist QR payload metadata in IndexedDB and let the user manage it safely.

## User story
US-04, US-05, US-06.

## In / out of scope
In: Save from Generate, Saved screen, lazy thumbnails, open, rename dialog, delete confirmation, storage notice and errors. Out: search, folders, import/export, sync, duplicate detection (duplicates allowed), per-item ECC edit.

## Dependencies
SPEC-001 (`encode`, `drawQr`). Screen spec §2–3. ADR-004, ADR-009.

## UI impact
Saved screen; Save button state on Generate; Rename and Delete dialogs.

## Interface / data contracts
```ts
interface SavedCode { id: string; title: string; payload: string; ecc: 'L'|'M'; createdAt: number; updatedAt: number; v: 1 }
interface CodeStore {
  add(input: { title?: string; payload: string; ecc: 'L'|'M' }): Promise<SavedCode>;
  list(): Promise<SavedCode[]>;               // newest updatedAt first
  get(id: string): Promise<SavedCode | undefined>;
  rename(id: string, title: string): Promise<SavedCode>;
  remove(id: string): Promise<void>;
}
class StoreError extends Error { kind: 'unavailable' | 'quota' | 'not-found' | 'unknown' }
```
DB `qr-pocket` v1, store `codes`, index `updatedAt`. Title 1–80 chars; blank → default (first 40 chars of first line, else `QR code <date>`). `payload` stored verbatim; no image data stored.

## Behaviour
- Normal: Save adds a record, shows "Saved to this device", button → "Saved ✓" until text changes. Open loads payload into Generate (read/edit; saving an edited payload creates a new item in MVP). Rename updates title + `updatedAt`. Delete requires confirm.
- Errors: IndexedDB unavailable (private mode/blocked) → Generate still works, Save shows an alert; Saved shows error + Retry. Quota → "Not enough storage". Transaction abort → error, state unchanged. Cross-tab changes: list refreshes on screen entry.
- Edge: 3000-char Arabic title/payload; emoji title; deleting last item shows empty state; delete of already-deleted id handled (not-found → refresh); thumbnail encode failure → placeholder.
- Notice (FR-9) shown on first save and in Saved footer. No backup claim anywhere.

## Security / privacy / accessibility
Titles/payloads rendered via `textContent`. Names prefixed `qr-pocket`. Dialog focus: Rename → input, Delete → Cancel; Esc cancels; focus restored; background inert; list is `<ul>`, each action has an accessible name including the item title.

## Acceptance criteria
- AC1 Given a valid QR, when Save is pressed, then a record exists with the exact payload, ecc, timestamps and no image data.
- AC2 Given saved items, when the app reloads, then the same items appear newest-updated first.
- AC3 Given an item, when Rename is submitted with a new title, then the list shows it and `updatedAt` increased; blank title yields the default title.
- AC4 Given an item, when Delete is pressed, then a confirmation appears with Cancel focused; Cancel keeps it; Confirm removes it and focus moves to a sensible target.
- AC5 Given IndexedDB open failure (injected), then Saved shows a visible error with Retry and Generate still works.
- AC6 Given quota/abort errors on add, then the user sees an error and no partial record exists.
- AC7 Given the Saved screen with zero items, then the empty state with a "Create a QR code" action shows.
- AC8 Given the storage notice requirement, then the text appears on Saved and after first save, and contains no claim of backup.
- AC9 Given Open on an Arabic item, then payload displays RTL-correct and re-generates an identical QR.
- AC10 Given 320 px width, then cards/actions don't overflow and are keyboard reachable (Saved-card actions may wrap 3 + 1; labels ≈ 14 px, targets ≥ 48 px).
- AC11 Given a successful Save, then the button shows a non-repeatable "Saved" state and a second activation does not create a record; when the text or the error-correction level then changes, the button resets to "Save" and saving creates a new record (duplicates of an older record's text remain allowed). The state is polite-announced next to the button.

## Tests
Automated (NOT RUN): T-002-1..4, T-A11Y (dialogs), T-RESP. Manual: U7, U11.

## Completion evidence
None yet. Status DRAFT.
