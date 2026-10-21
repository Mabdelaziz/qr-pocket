let region: HTMLElement | null = null;

/** Registers the polite status region (`role="status"`) that is the single channel for non-alert announcements. */
export function initAnnouncer(element: HTMLElement): void {
  region = element;
}

/** Announce politely. Alert panels announce themselves; do not repeat their text here. */
export function announce(message: string): void {
  if (region && region.textContent !== message) region.textContent = message;
}
