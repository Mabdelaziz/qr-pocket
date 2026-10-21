// QR Pocket service-worker KILL SWITCH (emergency recovery; see docs/SW_RECOVERY.md).
//
// If a released service worker misbehaves, deploy THIS file as /qr-pocket/sw.js. Browsers that already run the bad worker
// fetch it on their next update check (at most 24 hours later, usually at the next visit), install it immediately,
// delete the app's caches and unregister, so every request goes straight to the network again.
//
// It never touches IndexedDB: saved QR codes stay on the device. It has no fetch handler and caches nothing.
self.addEventListener('install', () => {
  self.skipWaiting(); // do not wait for old tabs to close: this is an emergency path
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((name) => name.startsWith('qr-pocket')).map((name) => caches.delete(name)));
      await self.registration.unregister();
    })(),
  );
});
