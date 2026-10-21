import type { Ecc } from '../qr/encode';

/** Identity of what the Save button would save: the exact text plus the error-correction level (SPEC-002 AC11). */
export function contentKey(text: string, ecc: Ecc): string {
  return `${ecc}\u0000${text}`;
}

export type SaveUi =
  | { readonly kind: 'idle' }
  | { readonly kind: 'saving'; readonly key: string }
  | { readonly kind: 'saved'; readonly key: string; readonly id: string };

export const SAVE_IDLE: SaveUi = { kind: 'idle' };

export type SaveButtonState = 'save' | 'saving' | 'saved';

/** The button reflects the save state only while the content still matches; any change resets it to 'save'. */
export function saveButtonState(ui: SaveUi, currentKey: string): SaveButtonState {
  if (ui.kind === 'saving' && ui.key === currentKey) return 'saving';
  if (ui.kind === 'saved' && ui.key === currentKey) return 'saved';
  return 'save';
}

/** A save may start only when a QR is shown and this exact content is neither saving nor already saved. */
export function canStartSave(ui: SaveUi, currentKey: string, hasQr: boolean): boolean {
  return hasQr && saveButtonState(ui, currentKey) === 'save';
}

/** Deleting the saved record that the button refers to resets it, so the content can be saved again. */
export function afterDelete(ui: SaveUi, deletedId: string): SaveUi {
  return ui.kind === 'saved' && ui.id === deletedId ? SAVE_IDLE : ui;
}
