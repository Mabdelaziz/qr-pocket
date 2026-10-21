import { defineConfig, devices } from '@playwright/test';

// Not a test suite: renders the pictures used by docs/USER_GUIDE.md from the production build (SPEC-005 AC8).
// CI runs it after the real tests (npm run screenshots) and uploads the pictures as an artifact; nothing depends on it.
const BASE = 'http://127.0.0.1:4173/qr-pocket/';

export default defineConfig({
  testDir: 'tests/screenshots',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  reporter: [['list']],
  outputDir: 'test-results/screenshots-run',
  use: { baseURL: BASE, serviceWorkers: 'allow', locale: 'en-US', colorScheme: 'light' },
  projects: [{ name: 'phone', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } }],
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 4173 --strictPort',
    url: BASE,
    reuseExistingServer: !process.env['CI'],
    timeout: 60_000,
  },
});
