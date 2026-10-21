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
  // A timestamp in the future (clock moved backwards) gives a negative age, which is still inside the cooldown.
  // Callers sanitise stored state first (sanitizeInstallState) so such a timestamp cannot block forever either.
  if (ctx.state.dismissedAt !== undefined && ctx.now - ctx.state.dismissedAt < DISMISS_COOLDOWN_MS) return false;
  if (ctx.state.shownAt !== undefined && ctx.now - ctx.state.shownAt < IGNORED_COOLDOWN_MS) return false;
  return true;
}

/**
 * A stored timestamp later than `now` means the device clock moved backwards. Treat it as "just happened": the cooldown
 * restarts from now instead of being skipped (early prompt) or lasting until the wrong future date (blocked for good).
 */
export function sanitizeInstallState(state: InstallState, now: number): InstallState {
  const clamp = (value: number | undefined): number | undefined => (value !== undefined && value > now ? now : value);
  const next: { dismissedAt?: number; shownAt?: number; installedAt?: number } = {};
  const dismissedAt = clamp(state.dismissedAt);
  const shownAt = clamp(state.shownAt);
  const installedAt = clamp(state.installedAt);
  if (dismissedAt !== undefined) next.dismissedAt = dismissedAt;
  if (shownAt !== undefined) next.shownAt = shownAt;
  if (installedAt !== undefined) next.installedAt = installedAt;
  return next;
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

/** Forget that the prompt was shown (used when the browser refused to display its own prompt). */
export function withoutShown(state: InstallState): InstallState {
  const next: { dismissedAt?: number; installedAt?: number } = {};
  if (state.dismissedAt !== undefined) next.dismissedAt = state.dismissedAt;
  if (state.installedAt !== undefined) next.installedAt = state.installedAt;
  return next;
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
