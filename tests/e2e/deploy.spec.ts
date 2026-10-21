// SPEC-005 AC6: the stamped build as it will be published. CI runs `npm run stamp` before the browser tests, so the
// served files are the files that the Pages artifact carries. Chromium only (not tagged @cross).
import { expect, test } from '@playwright/test';
import { readCaches, waitForServiceWorker } from './helpers/pwa';

test.describe('SPEC-005 AC6: published build', () => {
  test('SPEC-005 AC6: version.json names the built commit and is public, small and harmless', async ({ request }) => {
    const response = await request.get('version.json');
    expect(response.status(), 'run "npm run stamp" after "npm run build" first').toBe(200);
    const body = await response.json();
    expect(Object.keys(body).sort()).toEqual(['app', 'commit', 'ref', 'run']);
    expect(body.app).toBe('qr-pocket');
    expect(body.commit).toMatch(/^(?:[0-9a-f]{40}|local)$/);
    if (process.env['GITHUB_SHA']) expect(body.commit).toBe(process.env['GITHUB_SHA']);
  });

  test.describe('with the service worker', () => {
    test.use({ serviceWorkers: 'allow' });

    test('SPEC-005 AC6: the stamp is never precached (a stale cache can not hide which commit is live)', async ({ page }) => {
      await page.goto('./');
      await waitForServiceWorker(page);
      const urls = (await readCaches(page)).map((e) => new URL(e.url).pathname);
      expect(urls.length).toBeGreaterThan(0);
      expect(urls.some((u) => u.endsWith('version.json'))).toBe(false);
    });
  });
});
