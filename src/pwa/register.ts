export interface RegisterHandlers {
  /** A new version finished installing and is waiting. Call `accept()` only after the user asked for it. */
  onUpdateReady(accept: () => void): void;
  /** The very first install finished: the app is now available offline. */
  onOfflineReady(): void;
}

const HOUR_MS = 60 * 60 * 1000;

/**
 * Registers the Workbox-generated worker (production only) at <base>sw.js with scope <base>.
 * Updates are prompt-based: the page NEVER reloads on its own. A waiting worker is only activated, and the page
 * reloaded once, after `accept()` (the user pressing Reload). Failures are silent: the app works online without it.
 */
export function registerServiceWorker(handlers: RegisterHandlers): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  const container = navigator.serviceWorker;
  const base = import.meta.env.BASE_URL;

  let accepted = false;
  let reloading = false;
  container.addEventListener('controllerchange', () => {
    // Fires on the first install too (clients.claim); only an accepted update may reload the page.
    if (accepted && !reloading) {
      reloading = true;
      location.reload();
    }
  });

  function offerUpdate(registration: ServiceWorkerRegistration): void {
    handlers.onUpdateReady(() => {
      accepted = true;
      if (registration.waiting) registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      else if (!reloading) {
        reloading = true;
        location.reload();
      }
    });
  }

  /** A worker that installs while an older one controls the page is an UPDATE: wait for the user. */
  function track(registration: ServiceWorkerRegistration, worker: ServiceWorker): void {
    worker.addEventListener('statechange', () => {
      if (worker.state === 'installed' && container.controller) offerUpdate(registration);
    });
  }

  // First ever install: the app is offline-capable once a worker is ACTIVE (its precache is complete by then).
  // `ready` resolves only for a working registration, so this never claims offline support that does not exist.
  if (!container.controller) void container.ready.then(() => handlers.onOfflineReady());

  container
    .register(`${base}sw.js`, { scope: base })
    .then((registration) => {
      if (!registration) return; // registration was blocked or refused: nothing to track
      if (registration.waiting && container.controller) offerUpdate(registration);
      else if (registration.installing) track(registration, registration.installing);
      registration.addEventListener('updatefound', () => {
        if (registration.installing) track(registration, registration.installing);
      });

      // Long-lived (installed) sessions: look for a new version when the app comes back to the foreground.
      let lastCheck = Date.now();
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'visible' || Date.now() - lastCheck < HOUR_MS) return;
        lastCheck = Date.now();
        registration.update().catch(() => undefined);
      });
    })
    .catch(() => undefined);
}
