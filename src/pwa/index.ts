import { announce } from '../ui/announce';
import { byId } from '../ui/dom';
import { initInstallPrompt, type InstallPrompt } from './install';
import { UPDATE_TEXT, updateMessage } from './installPolicy';
import { createNotices } from './notices';
import { registerServiceWorker } from './register';

const READY_KEY = 'qr-pocket.offlineReady';
const OFFLINE_TEXT = 'You’re offline. Creating, saving and exporting still work.';

async function hasAppCache(): Promise<boolean> {
  try {
    return (await caches.keys()).some((name) => name.startsWith('qr-pocket'));
  } catch {
    return false;
  }
}

function alreadyToldOfflineReady(): boolean {
  try {
    return localStorage.getItem(READY_KEY) === '1';
  } catch {
    return false;
  }
}

function rememberOfflineReady(): void {
  try {
    localStorage.setItem(READY_KEY, '1');
  } catch {
    /* storage unavailable: we may tell the visitor again next time */
  }
}

/** Offline/online status, update and install notices, service-worker registration. */
export interface Pwa extends InstallPrompt {
  /** Call whenever the text field changes (typing, Clear, Open): keeps the update warning truthful. */
  textChanged(): void;
}

export function initPwa(textField: HTMLTextAreaElement): Pwa {
  const notices = createNotices(byId('notices', HTMLElement));
  const chip = byId('offline-chip', HTMLElement);
  // Any text counts, even whitespace: reloading would clear exactly what is visible in the field.
  const hasEditedText = (): boolean => textField.value.length > 0;
  const textChanged = (): void => notices.setText('update', updateMessage(hasEditedText()));

  // ---- offline / online
  const applyConnectivity = (announceChange: boolean): void => {
    const online = navigator.onLine;
    chip.hidden = online;
    if (online) {
      const wasOffline = notices.has('offline');
      notices.hide('offline');
      if (announceChange && wasOffline) announce('Back online.');
    } else {
      notices.show('offline', { kind: 'info', icon: 'offline', text: OFFLINE_TEXT });
      if (announceChange) announce(OFFLINE_TEXT);
    }
  };
  window.addEventListener('online', () => applyConnectivity(true));
  window.addEventListener('offline', () => applyConnectivity(true));
  applyConnectivity(false);

  // ---- service worker: first install and updates
  registerServiceWorker({
    onOfflineReady() {
      if (alreadyToldOfflineReady()) return;
      // Only claim offline support if the app's precache really exists (a recovery worker deletes it).
      void hasAppCache().then((present) => {
        if (!present || alreadyToldOfflineReady()) return;
        notices.show('ready', {
          kind: 'success',
          icon: 'ok',
          text: 'Ready to work offline.',
          actions: [{ id: 'dismiss', label: 'Dismiss', onClick: () => notices.hide('ready') }],
        });
        rememberOfflineReady(); // only after the notice is really shown
        announce('Ready to work offline.');
      });
    },
    onUpdateReady(accept) {
      notices.show('update', {
        kind: 'info',
        icon: 'refresh',
        text: updateMessage(hasEditedText()),
        actions: [
          { id: 'reload', label: UPDATE_TEXT.reload, primary: true, onClick: accept },
          { id: 'later', label: UPDATE_TEXT.later, onClick: () => notices.hide('update') },
        ],
      });
      announce(updateMessage(hasEditedText()));
    },
  });
  // The warning about unsaved text follows what the visitor types; the bar itself never reloads anything.
  textField.addEventListener('input', textChanged);

  return { ...initInstallPrompt(notices), textChanged };
}
