import { defineConfig, devices } from '@playwright/test';

// Runs against the production build served by `vite preview` under /qr-pocket/ (SPEC-005 AC4).
// CI order: npm run build -> npm run build:v2 -> npm run test:e2e   (update.spec.ts needs dist AND dist-v2)
const BASE = 'http://127.0.0.1:4173/qr-pocket/';

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  expect: { timeout: 10_000 }, // shared 2-vCPU CI runners can be slow; assertions still fail if the condition never holds
  globalTimeout: 20 * 60_000, // a stalled suite must fail fast, not burn the CI job limit
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  workers: process.env['CI'] ? 2 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE,
    trace: 'retain-on-failure',
    // The app's logic specs run without a service worker so they stay deterministic; the PWA specs
    // (pwa, update, cross-browser offline) opt in with test.use({ serviceWorkers: 'allow' }).
    serviceWorkers: 'block',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // SPEC-004 AC13: Firefox and WebKit run the @cross smoke subset only.
    { name: 'firefox', use: { ...devices['Desktop Firefox'] }, grep: /@cross/ },
    { name: 'webkit', use: { ...devices['Desktop Safari'] }, grep: /@cross/ },
  ],
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 4173 --strictPort',
    url: BASE,
    reuseExistingServer: !process.env['CI'],
    timeout: 60_000,
  },
});
