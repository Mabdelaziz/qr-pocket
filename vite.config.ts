import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages project site: https://<user>.github.io/qr-pocket/  (SPEC-004/005)
const BASE = '/qr-pocket/';

export default defineConfig({
  base: BASE,
  // Lets tests simulate two deployments: `QR_POCKET_BUILD_ID=v2 vite build --outDir dist-v2` changes the hashed bundle.
  define: { __BUILD_ID__: JSON.stringify(process.env['QR_POCKET_BUILD_ID'] ?? 'v1') },
  build: {
    target: 'es2022',
    sourcemap: false,
    cssCodeSplit: false,
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
  plugins: [
    VitePWA({
      // Prompt-based updates: the page registers the worker itself (src/pwa/register.ts) and never reloads on its own.
      registerType: 'prompt',
      injectRegister: false,
      strategies: 'generateSW',
      manifest: {
        name: 'QR Pocket',
        short_name: 'QR Pocket',
        description: 'Create, save and share QR codes offline. No account needed.',
        id: BASE,
        start_url: BASE,
        scope: BASE,
        display: 'standalone',
        theme_color: '#FFFFFF',
        background_color: '#F5F7FB',
        lang: 'en',
        dir: 'ltr',
        categories: ['utilities', 'productivity'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      workbox: {
        // Cache names start with "qr-pocket" (ADR-009: the github.io origin is shared with other project sites).
        cacheId: 'qr-pocket',
        // Precache the build output ONLY. There are deliberately no runtime caching routes: user text, titles and
        // IndexedDB records can never end up in Cache Storage (SPEC-004 AC8).
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        runtimeCaching: [],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        clientsClaim: true, // a first install takes control at once; an UPDATE still waits for the user
        skipWaiting: false, // a waiting worker activates only on the page's SKIP_WAITING message (Reload button)
        sourcemap: false,
      },
    }),
  ],
});
