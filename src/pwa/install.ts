import {
  INSTALL_TEXT,
  parseInstallState,
  shouldShowInstallPrompt,
  withDismissed,
  withInstalled,
  withShown,
  type InstallState,
} from './installPolicy';
import type { Notices } from './notices';

/** The non-standard (Chromium) install prompt event. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const KEY = 'qr-pocket.install';
const BAR = 'install';

function readState(): InstallState {
  try {
    return parseInstallState(localStorage.getItem(KEY));
  } catch {
    return {}; // storage blocked: behave as a first visit, never persist
  }
}

function writeState(state: InstallState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable: the prompt simply is not remembered */
  }
}

function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export interface InstallPrompt {
  /** Call when the visitor has seen a QR code: only then may the prompt appear. */
  notifyEngaged(): void;
}

/**
 * Custom install prompt (SPEC-004 AC10). It never appears on page load, only when the browser offered installation
 * (so we never promise something unsupported), and it respects dismissals. Without the event nothing is shown;
 * the browser's own menu still offers installation.
 */
export function initInstallPrompt(notices: Notices): InstallPrompt {
  let deferred: BeforeInstallPromptEvent | null = null;
  let engaged = false;
  let shownThisSession = false;

  function hide(): void {
    notices.hide(BAR);
  }

  function maybeShow(): void {
    const now = Date.now();
    const allowed = shouldShowInstallPrompt({
      now,
      state: readState(),
      hasPromptEvent: deferred !== null,
      engaged,
      standalone: isStandalone(),
      shownThisSession,
    });
    if (!allowed) return;
    shownThisSession = true;
    writeState(withShown(readState(), now));
    notices.show(BAR, {
      kind: 'info',
      icon: 'download',
      title: INSTALL_TEXT.title,
      text: INSTALL_TEXT.description,
      actions: [
        { id: 'install', label: INSTALL_TEXT.install, primary: true, onClick: () => void install() },
        {
          id: 'not-now',
          label: INSTALL_TEXT.later,
          onClick: () => {
            writeState(withDismissed(readState(), Date.now()));
            hide();
          },
        },
      ],
    });
    // Deliberately NOT announced: it is not urgent, would interrupt the "QR code ready" message, and the labelled group is
    // the first thing a screen-reader user meets at the top of the page.
  }

  async function install(): Promise<void> {
    const event = deferred;
    if (!event) return;
    deferred = null; // the event can be used once
    hide();
    try {
      await event.prompt();
      const choice = await event.userChoice;
      if (choice.outcome === 'dismissed') writeState(withDismissed(readState(), Date.now()));
    } catch {
      /* the browser refused to show its prompt; nothing else to do */
    }
  }

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault(); // keep the native mini-bar from interrupting; the browser menu can still install
    deferred = event as BeforeInstallPromptEvent;
    maybeShow();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    writeState(withInstalled(readState(), Date.now()));
    hide();
  });

  return {
    notifyEngaged() {
      engaged = true;
      maybeShow();
    },
  };
}
