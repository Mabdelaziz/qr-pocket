import { defineConfig, devices } from '@playwright/test';

// Runs against the production build served by `vite preview` under /qr-pocket/ (SPEC-005 AC4).
// CI order: npm run build -> npm run test:e2e
const BASE = 'http://127.0.0.1:4173/qr-pocket/';

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  workers: process.env['CI'] ? 2 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 4173 --strictPort',
    url: BASE,
    reuseExistingServer: !process.env['CI'],
    timeout: 60_000,
  },
});
