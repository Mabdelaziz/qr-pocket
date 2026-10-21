// QR Pocket service-worker KILL SWITCH (emergency recovery; see docs/SW_RECOVERY.md).
//
// If a released service worker misbehaves, deploy THIS file as /qr-pocket/sw.js. Browsers that already run the bad worker
// fetch it on their next update check (at most 24 hours later, usually at the next visit), install it immediately,
// delete the app's caches and unregister, so every request goes straight to the network again.
//
// It never touches IndexedDB: saved QR codes stay on the device. It has no fetch handler and caches nothing.
// The github.io origin is shared with other project sites, so only caches that belong to THIS app are deleted: Workbox
// names them "qr-pocket-precache-v2-<this worker's scope URL>", which another project cannot share.
self.addEventListener('install', () => {
  self.skipWaiting(); // do not wait for old tabs to close: this is an emergency path
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const scope = self.registration.scope;
        const names = await caches.keys();
        const ours = names.filter((name) => name.startsWith('qr-pocket') && name.includes(scope));
        await Promise.allSettled(ours.map((name) => caches.delete(name)));
      } finally {
        await self.registration.unregister(); // even if cache cleanup failed: stop controlling the app
      }
    })(),
  );
});
