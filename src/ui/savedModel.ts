import type { SavedCode, StoreErrorKind } from '../store/types';

export type SavedStatus =
  | { readonly kind: 'loading' }
  | { readonly kind: 'error'; readonly error: StoreErrorKind }
  | { readonly kind: 'ready'; readonly items: readonly SavedCode[] };

export interface SavedView {
  readonly mode: 'loading' | 'error' | 'empty' | 'list';
  /** "3 codes", "1 code" or '' */
  readonly countLabel: string;
  /** Polite screen-reader text for the status region; '' = nothing to announce. */
  readonly announce: string;
}

export function countLabel(count: number): string {
  return count === 1 ? '1 code' : `${count} codes`;
}

export function deriveSavedView(status: SavedStatus): SavedView {
  switch (status.kind) {
    case 'loading':
      return { mode: 'loading', countLabel: '', announce: 'Loading saved codes…' };
    case 'error':
      return { mode: 'error', countLabel: '', announce: '' }; // the alert panel announces itself
    case 'ready':
      return status.items.length === 0
        ? { mode: 'empty', countLabel: '', announce: 'No saved codes.' }
        : { mode: 'list', countLabel: countLabel(status.items.length), announce: `${countLabel(status.items.length)} saved.` };
  }
}

export type StoreAction = 'save' | 'load' | 'rename' | 'delete';

export interface ErrorText {
  readonly title: string;
  readonly body: string;
}

/** User-facing wording for storage failures; never claims anything was saved when it was not. */
export function storeErrorText(action: StoreAction, kind: StoreErrorKind): ErrorText {
  switch (action) {
    case 'save':
      if (kind === 'quota') {
        return { title: 'Couldn’t save to this device', body: 'There isn’t enough storage space left. You can still download or share this code.' };
      }
      return {
        title: 'Couldn’t save to this device',
        body:
          kind === 'unavailable'
            ? 'Storage isn’t available in this browser right now (for example in private browsing). You can still download or share this code.'
            : 'Something went wrong while saving. You can still download or share this code.',
      };
    case 'load':
      return { title: 'Couldn’t open saved codes', body: 'Your device’s storage isn’t available right now. You can still create and download codes.' };
    case 'rename':
      return kind === 'not-found'
        ? { title: 'That code no longer exists', body: 'It may have been deleted. Close this dialog to refresh the list.' }
        : { title: 'Couldn’t save the new name', body: 'Nothing was changed.' };
    case 'delete':
      return kind === 'not-found'
        ? { title: 'That code was already deleted', body: 'Close this dialog to refresh the list.' }
        : { title: 'Couldn’t delete this code', body: 'It is still saved. Try again.' };
  }
}
