/** When the custom install prompt may appear (SPEC-004 AC10). Pure, so the rules are unit-tested. */
export const DAY_MS = 24 * 60 * 60 * 1000;
/** After "Not now" (or a dismissed native prompt) stay quiet this long. */
export const DISMISS_COOLDOWN_MS = 30 * DAY_MS;
/** If the prompt was shown and simply ignored, do not show it again within this time. */
export const IGNORED_COOLDOWN_MS = 7 * DAY_MS;

export interface InstallState {
  readonly dismissedAt?: number;
  readonly shownAt?: number;
  readonly installedAt?: number;
}

export interface InstallContext {
  readonly now: number;
  readonly state: InstallState;
  /** The browser fired `beforeinstallprompt` (so installation is possible and we hold the event). */
  readonly hasPromptEvent: boolean;
  /** At least one QR code has been shown: the visitor is actually using the app. */
  readonly engaged: boolean;
  readonly standalone: boolean;
  readonly shownThisSession: boolean;
}

export function shouldShowInstallPrompt(ctx: InstallContext): boolean {
  if (!ctx.hasPromptEvent || !ctx.engaged || ctx.standalone || ctx.shownThisSession) return false;
  if (ctx.state.installedAt !== undefined) return false;
  // Absolute difference: a clock that moved backwards must not re-enable a prompt early.
  if (ctx.state.dismissedAt !== undefined && Math.abs(ctx.now - ctx.state.dismissedAt) < DISMISS_COOLDOWN_MS) return false;
  if (ctx.state.shownAt !== undefined && Math.abs(ctx.now - ctx.state.shownAt) < IGNORED_COOLDOWN_MS) return false;
  return true;
}

/** Tolerant parser for the stored state: anything unexpected yields an empty state. */
export function parseInstallState(raw: string | null): InstallState {
  if (!raw) return {};
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null) return {};
    const record = value as Record<string, unknown>;
    const num = (key: string): number | undefined => {
      const v = record[key];
      return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
    };
    const state: { dismissedAt?: number; shownAt?: number; installedAt?: number } = {};
    const dismissedAt = num('dismissedAt');
    const shownAt = num('shownAt');
    const installedAt = num('installedAt');
    if (dismissedAt !== undefined) state.dismissedAt = dismissedAt;
    if (shownAt !== undefined) state.shownAt = shownAt;
    if (installedAt !== undefined) state.installedAt = installedAt;
    return state;
  } catch {
    return {};
  }
}

export const withShown = (state: InstallState, now: number): InstallState => ({ ...state, shownAt: now });
export const withDismissed = (state: InstallState, now: number): InstallState => ({ ...state, dismissedAt: now });
export const withInstalled = (state: InstallState, now: number): InstallState => ({ ...state, installedAt: now });

export const INSTALL_TEXT = {
  title: 'Keep QR Pocket on your phone',
  description: 'Install QR Pocket for quick access and offline QR creation. No account needed.',
  install: 'Install app',
  later: 'Not now',
} as const;

export const UPDATE_TEXT = {
  ready: 'A new version is ready.',
  clears: 'A new version is ready. Reloading will clear the text you are typing.',
  reload: 'Reload',
  later: 'Later',
} as const;

export function updateMessage(hasEditedText: boolean): string {
  return hasEditedText ? UPDATE_TEXT.clears : UPDATE_TEXT.ready;
}
