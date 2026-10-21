// SPEC-004 AC10: when the custom install prompt may appear.
import { describe, expect, it } from 'vitest';
import {
  DAY_MS,
  DISMISS_COOLDOWN_MS,
  IGNORED_COOLDOWN_MS,
  INSTALL_TEXT,
  UPDATE_TEXT,
  parseInstallState,
  sanitizeInstallState,
  shouldShowInstallPrompt,
  updateMessage,
  withDismissed,
  withInstalled,
  withoutShown,
  withShown,
  type InstallContext,
} from '../../src/pwa/installPolicy';

const NOW = Date.UTC(2026, 9, 21, 12, 0, 0);
const ready: InstallContext = { now: NOW, state: {}, hasPromptEvent: true, engaged: true, standalone: false, shownThisSession: false };
const allow = (patch: Partial<InstallContext>): boolean => shouldShowInstallPrompt({ ...ready, ...patch });

describe('SPEC-004 AC10: install prompt policy', () => {
  it('shows once the browser offered installation and the visitor has used the app', () => {
    expect(allow({})).toBe(true);
  });

  it('never shows without the browser event (nothing unsupported is promised)', () => {
    expect(allow({ hasPromptEvent: false })).toBe(false);
  });

  it('never shows before a QR code has been shown (not on page load)', () => {
    expect(allow({ engaged: false })).toBe(false);
  });

  it('never shows in standalone mode, after installation, or twice in one session', () => {
    expect(allow({ standalone: true })).toBe(false);
    expect(allow({ state: withInstalled({}, NOW - 1) })).toBe(false);
    expect(allow({ shownThisSession: true })).toBe(false);
  });

  it('respects "Not now" for 30 days, then may ask again', () => {
    expect(allow({ state: withDismissed({}, NOW - DAY_MS) })).toBe(false);
    expect(allow({ state: withDismissed({}, NOW - (DISMISS_COOLDOWN_MS - 1000)) })).toBe(false);
    expect(allow({ state: withDismissed({}, NOW - DISMISS_COOLDOWN_MS - 1000) })).toBe(true);
  });

  it('does not nag when the prompt was shown and ignored: quiet for 7 days', () => {
    expect(allow({ state: withShown({}, NOW - 2 * DAY_MS) })).toBe(false);
    expect(allow({ state: withShown({}, NOW - IGNORED_COOLDOWN_MS - 1000) })).toBe(true);
  });

  it('a long dismissal still wins over an old "shown" record', () => {
    const state = withShown(withDismissed({}, NOW - 10 * DAY_MS), NOW - 20 * DAY_MS);
    expect(allow({ state })).toBe(false);
  });

  it('a future timestamp (clock moved backwards) is still inside the cooldown', () => {
    expect(allow({ state: withDismissed({}, NOW + 5 * DAY_MS) })).toBe(false);
    expect(allow({ state: withShown({}, NOW + 400 * DAY_MS) })).toBe(false); // even far in the future: not skipped
  });

  it('sanitising clamps future timestamps to now, so the cooldown restarts instead of lasting until the wrong date', () => {
    const clean = sanitizeInstallState({ dismissedAt: NOW + 400 * DAY_MS, shownAt: NOW - DAY_MS }, NOW);
    expect(clean).toEqual({ dismissedAt: NOW, shownAt: NOW - DAY_MS });
    expect(allow({ state: clean })).toBe(false); // restarted cooldown
    expect(allow({ state: { dismissedAt: NOW - DISMISS_COOLDOWN_MS - 1 } })).toBe(true); // and it expires normally later
  });

  it('a prompt the browser refused to show is not counted as shown', () => {
    expect(withoutShown({ shownAt: NOW, dismissedAt: 5 })).toEqual({ dismissedAt: 5 });
  });
});

describe('SPEC-004: stored install state is parsed defensively', () => {
  it('accepts a valid record', () => {
    expect(parseInstallState(JSON.stringify({ dismissedAt: 1, shownAt: 2, installedAt: 3 }))).toEqual({ dismissedAt: 1, shownAt: 2, installedAt: 3 });
  });

  it.each([null, '', 'not json', '[]', '"x"', '123', JSON.stringify({ dismissedAt: 'yesterday', shownAt: null, installedAt: NaN })])('falls back to empty for %j', (raw) => {
    expect(parseInstallState(raw as string | null)).toEqual({});
  });

  it('keeps only valid fields from a partly valid record', () => {
    expect(parseInstallState(JSON.stringify({ dismissedAt: 5, shownAt: 'x', extra: true }))).toEqual({ dismissedAt: 5 });
  });
});

describe('SPEC-004: approved wording', () => {
  it('uses the owner-approved install text', () => {
    expect(INSTALL_TEXT.title).toBe('Keep QR Pocket on your phone');
    expect(INSTALL_TEXT.description).toBe('Install QR Pocket for quick access and offline QR creation. No account needed.');
    expect(INSTALL_TEXT.install).toBe('Install app');
    expect(INSTALL_TEXT.later).toBe('Not now');
  });

  it('warns about unsaved text only when there is some', () => {
    expect(updateMessage(false)).toBe(UPDATE_TEXT.ready);
    expect(updateMessage(true)).toContain('Reloading will clear the text you are typing.');
  });
});
