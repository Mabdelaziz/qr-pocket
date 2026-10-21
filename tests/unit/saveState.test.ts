import { describe, expect, it } from 'vitest';
import { afterDelete, canStartSave, contentKey, SAVE_IDLE, saveButtonState, type SaveUi } from '../../src/ui/saveState';

describe('SPEC-002 AC11: Save state', () => {
  const key = contentKey('hello', 'M');

  it('keys on both the exact text and the error-correction level', () => {
    expect(contentKey('hello', 'M')).toBe(contentKey('hello', 'M'));
    expect(contentKey('hello', 'M')).not.toBe(contentKey('hello', 'L'));
    expect(contentKey('hello', 'M')).not.toBe(contentKey('hello ', 'M')); // whitespace counts
    expect(contentKey('a', 'M')).not.toBe(contentKey('A', 'M'));
  });

  it('allows a save only when a QR is shown and the content is not already saving/saved', () => {
    expect(canStartSave(SAVE_IDLE, key, true)).toBe(true);
    expect(canStartSave(SAVE_IDLE, key, false)).toBe(false);
    expect(canStartSave({ kind: 'saving', key }, key, true)).toBe(false); // rapid duplicate
    expect(canStartSave({ kind: 'saved', key, id: 'a' }, key, true)).toBe(false);
  });

  it('shows saving/saved only for the matching content and resets when text or level changes', () => {
    const saved: SaveUi = { kind: 'saved', key, id: 'a' };
    expect(saveButtonState(saved, key)).toBe('saved');
    expect(saveButtonState(saved, contentKey('hello!', 'M'))).toBe('save'); // text changed
    expect(saveButtonState(saved, contentKey('hello', 'L'))).toBe('save'); // level changed
    expect(canStartSave(saved, contentKey('hello!', 'M'), true)).toBe(true); // a new record may be saved
    expect(saveButtonState({ kind: 'saving', key }, key)).toBe('saving');
    expect(saveButtonState({ kind: 'saving', key }, contentKey('x', 'M'))).toBe('save');
  });

  it('deleting the saved record resets the state, deleting another does not', () => {
    const saved: SaveUi = { kind: 'saved', key, id: 'a' };
    expect(afterDelete(saved, 'a')).toBe(SAVE_IDLE);
    expect(afterDelete(saved, 'b')).toBe(saved);
    expect(afterDelete(SAVE_IDLE, 'a')).toBe(SAVE_IDLE);
  });
});
