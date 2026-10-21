import { describe, expect, it } from 'vitest';
import type { SavedCode } from '../../src/store/types';
import { countLabel, deriveSavedView, storeErrorText } from '../../src/ui/savedModel';

function item(id: string): SavedCode {
  return { id, title: id, payload: id, ecc: 'M', source: 'typed', createdAt: 1, updatedAt: 1, v: 1 };
}

describe('SPEC-002: Saved view model', () => {
  it('AC13: has a loading state that announces politely', () => {
    expect(deriveSavedView({ kind: 'loading' })).toEqual({ mode: 'loading', countLabel: '', announce: 'Loading saved codes…' });
  });

  it('AC7: shows the empty state for zero items', () => {
    expect(deriveSavedView({ kind: 'ready', items: [] }).mode).toBe('empty');
  });

  it('shows the list with a correctly pluralised count', () => {
    expect(deriveSavedView({ kind: 'ready', items: [item('a')] })).toMatchObject({ mode: 'list', countLabel: '1 code' });
    expect(deriveSavedView({ kind: 'ready', items: [item('a'), item('b'), item('c')] })).toMatchObject({ mode: 'list', countLabel: '3 codes' });
    expect(countLabel(0)).toBe('0 codes');
  });

  it('AC5: shows an error state whose alert announces itself (no duplicate status text)', () => {
    expect(deriveSavedView({ kind: 'error', error: 'unavailable' })).toEqual({ mode: 'error', countLabel: '', announce: '' });
  });

  it('describes failures without claiming anything was saved, and keeps export available', () => {
    expect(storeErrorText('save', 'quota').body).toMatch(/storage space/);
    expect(storeErrorText('save', 'unavailable').body).toMatch(/private browsing/);
    expect(storeErrorText('save', 'unknown').body).toMatch(/download or share/);
    expect(storeErrorText('load', 'unavailable').body).toMatch(/still create and download/);
    expect(storeErrorText('rename', 'unknown').body).toBe('Nothing was changed.');
    expect(storeErrorText('delete', 'unknown').body).toBe('It is still saved. Try again.');
    expect(storeErrorText('rename', 'not-found').title).toMatch(/no longer exists/);
  });
});
