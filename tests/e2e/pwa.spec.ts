// SPEC-004 browser tests: manifest and icons, service worker scope and caches, offline use, notices, install prompt.
// Run by GitHub Actions against `vite preview` of the production build at /qr-pocket/ (Chromium).
import { readFile } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { decodeWithJsQr } from '../unit/helpers/decoders';
import { dbRecords, expectNoHorizontalOverflow, input, installFaultInjector, openSaved, previewCanvas, saveText, watchPage } from './helpers/app';
import { decodePng, hasPngSignature } from './helpers/png';
import {
  fireInstallPrompt,
  installBar,
  installStateInStorage,
  offlineBar,
  readCaches,
  readyBar,
  waitForServiceWorker,
} from './helpers/pwa';

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const URL_TEXT = 'https://example.com/menu?table=12';
const OFFLINE_TEXT = 'You’re offline. Creating, saving and exporting still work.';
const BLUE = [21, 94, 239];

async function scan(page: Page, label: string): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  expect(results.violations, label).toEqual([]);
}

test.describe('SPEC-004 AC1/AC14: manifest, icons and CSP', () => {
  test.use({ serviceWorkers: 'block' });

  test('SPEC-004 AC1: the web manifest is linked, valid and scoped to /qr-pocket/', async ({ page }) => {
    await page.goto('./');
    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(href).toMatch(/\/qr-pocket\/manifest\.webmanifest$/);
    const response = await page.request.get(href ?? '');
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toMatch(/json|manifest/);
    const manifest = (await response.json()) as Record<string, unknown> & { icons: Array<{ src: string; sizes: string; type: string; purpose?: string }> };
    expect(manifest['name']).toBe('QR Pocket');
    expect(manifest['short_name']).toBe('QR Pocket');
    expect(manifest['id']).toBe('/qr-pocket/');
    expect(manifest['start_url']).toBe('/qr-pocket/');
    expect(manifest['scope']).toBe('/qr-pocket/');
    expect(manifest['display']).toBe('standalone');
    expect(manifest['theme_color']).toBe('#FFFFFF');
    expect(manifest['background_color']).toBe('#F5F7FB');
    expect(manifest['lang']).toBe('en');
    expect(typeof manifest['description']).toBe('string');

    const icons = manifest.icons.map((i) => `${i.sizes}|${i.type}|${i.purpose ?? 'any'}|${new URL(i.src, response.url()).pathname}`).sort();
    expect(icons).toEqual(
      [
        '192x192|image/png|any|/qr-pocket/icons/icon-192.png',
        '512x512|image/png|any|/qr-pocket/icons/icon-512.png',
        '512x512|image/png|maskable|/qr-pocket/icons/icon-maskable-512.png',
        'any|image/svg+xml|any|/qr-pocket/icons/icon.svg',
      ].sort(),
    );
  });

  test('SPEC-004 AC1: every icon exists with its exact size; the page uses the SVG as favicon', async ({ page }) => {
    await page.goto('./');
    for (const [name, size] of [
      ['icons/icon-192.png', 192],
      ['icons/icon-512.png', 512],
      ['icons/icon-maskable-512.png', 512],
    ] as const) {
      const response = await page.request.get(name);
      expect(response.status(), name).toBe(200);
      const bytes = Buffer.from(await response.body());
      expect(hasPngSignature(bytes)).toBe(true);
      const png = decodePng(bytes);
      expect([png.width, png.height], name).toEqual([size, size]);
    }
    const svg = await page.request.get('icons/icon.svg');
    expect(svg.status()).toBe(200);
    expect(svg.headers()['content-type']).toContain('image/svg+xml');
    expect(await svg.text()).toContain('#155EEF');
    expect(await page.locator('link[rel="icon"]').getAttribute('href')).toMatch(/\/qr-pocket\/icons\/icon\.svg$/);
  });

  test('SPEC-004 AC1: the "any" icon has transparent rounded corners; the maskable icon keeps its artwork in the safe zone', async ({ page }) => {
    await page.goto('./');
    const any = decodePng(Buffer.from(await (await page.request.get('icons/icon-512.png')).body()));
    expect(any.data[3]).toBe(0); // top-left corner transparent
    expect(any.data[(512 * 256 + 256) * 4 + 3]).toBe(255); // middle opaque

    const maskable = decodePng(Buffer.from(await (await page.request.get('icons/icon-maskable-512.png')).body()));
    const size = 512;
    let outside = 0;
    let artwork = 0;
    let transparent = 0;
    // One pass, totals asserted once (thousands of expect() calls stall the runner).
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;
        if (maskable.data[i + 3] !== 255) transparent++;
        const isBlue = maskable.data[i] === BLUE[0] && maskable.data[i + 1] === BLUE[1] && maskable.data[i + 2] === BLUE[2];
        if (!isBlue) {
          artwork++;
          if (Math.hypot(x + 0.5 - size / 2, y + 0.5 - size / 2) > 0.4 * size + 1) outside++;
        }
      }
    }
    expect(transparent).toBe(0); // full-bleed: the OS may crop to any shape
    expect(artwork).toBeGreaterThan(1000);
    expect(outside).toBe(0);
  });

  test('SPEC-004 AC14: the CSP gained only worker-src and manifest-src; the page raises no console errors and makes no external requests', async ({ page }) => {
    const watch = watchPage(page);
    await page.goto('./');
    await expect(input(page)).toBeVisible();
    const csp = (await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content')) ?? '';
    expect(csp).toContain("worker-src 'self'");
    expect(csp).toContain("manifest-src 'self'");
    expect(csp).not.toContain('unsafe-inline');
    expect(csp).not.toContain('unsafe-eval');
    expect(csp).not.toMatch(/https?:\/\//); // no external origin is allowed anywhere
    expect(watch.external).toEqual([]);
    expect(watch.failures).toEqual([]);
    expect(watch.problems).toEqual([]);
  });
});

test.describe('SPEC-004 AC2-AC4/AC8/AC9: service worker, offline use and caches', () => {
  test.use({ serviceWorkers: 'allow' });

  test.beforeEach(async ({ page }) => {
    await installFaultInjector(page); // also disables native share so results do not depend on the runner
  });

  test('SPEC-004 AC2: exactly one worker at /qr-pocket/sw.js with scope /qr-pocket/; cache names start with qr-pocket; precache holds only build assets', async ({ page }) => {
    const watch = watchPage(page);
    await page.goto('./');
    await waitForServiceWorker(page);
    const info = await page.evaluate(async () => {
      const registrations = await navigator.serviceWorker.getRegistrations();
      return { scopes: registrations.map((r) => r.scope), scripts: registrations.map((r) => r.active?.scriptURL ?? ''), caches: await caches.keys() };
    });
    expect(info.scopes).toEqual([new URL('./', page.url()).href]); // origin + /qr-pocket/
    expect(info.scopes[0]).toMatch(/\/qr-pocket\/$/);
    expect(info.scripts).toEqual([new URL('sw.js', page.url()).href]);
    expect(info.caches.length).toBeGreaterThan(0);
    for (const name of info.caches) expect(name).toMatch(/^qr-pocket/);

    const urls = (await readCaches(page)).map((e) => new URL(e.url).pathname);
    expect(urls).toContain('/qr-pocket/index.html');
    expect(urls).toContain('/qr-pocket/manifest.webmanifest');
    expect(urls).toContain('/qr-pocket/icons/icon-192.png');
    expect(urls.some((u) => /^\/qr-pocket\/assets\/.+\.js$/.test(u))).toBe(true);
    for (const u of urls) expect(u, 'only build output is precached').toMatch(/^\/qr-pocket\/(index\.html|manifest\.webmanifest|icons\/[\w.-]+|assets\/[\w.-]+)$/);
    expect(watch.external).toEqual([]);
    expect(watch.problems).toEqual([]);
  });

  test('SPEC-004 AC3/AC4: after one online load the app reloads offline, and Generate, Save, Saved, Open and Download work offline', async ({ page, context }) => {
    await page.goto('./');
    await waitForServiceWorker(page);

    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Create a QR code', level: 1 })).toBeVisible();
    await expect(page.locator('#offline-chip')).toBeVisible();
    await expect(offlineBar(page)).toContainText(OFFLINE_TEXT);

    // Generate and save while offline.
    await saveText(page, URL_TEXT);
    expect(await dbRecords(page)).toHaveLength(1);

    // Download works offline and the PNG decodes to the exact payload.
    const pending = page.waitForEvent('download');
    await page.locator('#download').click();
    const download = await pending;
    const bytes = await readFile(await download.path());
    const png = decodePng(bytes);
    expect([png.width, png.height]).toEqual([1024, 1024]);
    expect(new TextDecoder().decode(decodeWithJsQr(png) ?? new Uint8Array())).toBe(URL_TEXT);

    // Reload offline: the saved record persists; open it from the Saved list.
    await page.reload();
    await openSaved(page);
    await expect(page.locator('#saved-body .scard[data-id]')).toHaveCount(1);
    await page.getByRole('button', { name: `Open ${URL_TEXT}` }).click();
    await expect(input(page)).toHaveValue(URL_TEXT);
    await expect(previewCanvas(page)).toBeVisible();

    // A brand-new tab, still offline, loads the app from the worker too.
    const second = await context.newPage();
    await second.goto(new URL('./', page.url()).href);
    await expect(second.getByRole('heading', { name: 'Create a QR code', level: 1 })).toBeVisible();
    await second.close();

    // Back online: notices disappear and the change is announced politely.
    await context.setOffline(false);
    await expect(page.locator('#offline-chip')).toBeHidden();
    await expect(offlineBar(page)).toHaveCount(0);
    await expect(page.locator('#sr-status')).toHaveText('Back online.');
  });

  test('SPEC-004 AC8: no payload, title or saved record ever enters Cache Storage (online or offline)', async ({ page, context }) => {
    const secret = 'https://example.com/private?token=SECRET-PWA-98765';
    await page.goto('./');
    await waitForServiceWorker(page);
    await saveText(page, secret);
    const online = page.waitForEvent('download');
    await page.locator('#download').click();
    await online;

    await context.setOffline(true);
    await page.reload();
    await saveText(page, secret + '&offline=1');
    const offline = page.waitForEvent('download');
    await page.locator('#download').click();
    await offline;

    const entries = await readCaches(page);
    expect(entries.length).toBeGreaterThan(3);
    for (const entry of entries) {
      expect(entry.cache).toMatch(/^qr-pocket/);
      expect(new URL(entry.url).origin).toBe(new URL(page.url()).origin);
      expect(entry.url, 'URL').not.toContain('SECRET');
      expect(entry.url, 'URL').not.toContain(encodeURIComponent('example.com/private'));
      if (entry.text !== null) expect(entry.text, entry.url).not.toContain('SECRET-PWA');
    }
    expect((await dbRecords(page)).length).toBe(2); // the data lives in IndexedDB only
  });

  test('SPEC-004 AC9: "Ready to work offline" is announced once per browser profile', async ({ page }) => {
    await page.goto('./');
    await expect(readyBar(page)).toBeVisible();
    await expect(readyBar(page)).toContainText('Ready to work offline.');
    await expect(page.locator('#sr-status')).toHaveText('Ready to work offline.');
    await scan(page, 'ready notice');
    await readyBar(page).getByRole('button', { name: 'Dismiss' }).click();
    await expect(readyBar(page)).toHaveCount(0);
    await page.reload();
    await waitForServiceWorker(page);
    await page.waitForTimeout(500);
    await expect(readyBar(page)).toHaveCount(0); // not shown again
  });

  test('SPEC-004 AC9/AC11: offline notice is accessible and fits at 320px and at 150%/200% text', async ({ page, context }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto('./');
    await waitForServiceWorker(page);
    await context.setOffline(true);
    await expect(offlineBar(page)).toBeVisible();
    await expect(page.locator('#sr-status')).toHaveText(OFFLINE_TEXT);
    await scan(page, 'offline notice');
    await expectNoHorizontalOverflow(page);
    for (const percent of [150, 200]) {
      await page.evaluate((p) => {
        document.documentElement.style.fontSize = `${p}%`;
      }, percent);
      await expectNoHorizontalOverflow(page);
      const box = await offlineBar(page).boundingBox();
      expect(box?.x ?? -1).toBeGreaterThanOrEqual(0);
      expect((box?.x ?? 0) + (box?.width ?? 999)).toBeLessThanOrEqual(320.5);
    }
  });
});

test.describe('SPEC-004 AC10: install prompt', () => {
  test.use({ serviceWorkers: 'block' });

  test.beforeEach(async ({ page }) => {
    await installFaultInjector(page);
    await page.goto('./');
    await expect(input(page)).toBeVisible();
  });

  const useApp = async (page: Page): Promise<void> => {
    await input(page).fill(URL_TEXT);
    await expect(previewCanvas(page)).toBeVisible();
  };

  test('SPEC-004 AC10: never on page load; the browser event is deferred; nothing appears until a QR code has been shown', async ({ page }) => {
    expect(await fireInstallPrompt(page)).toBe(true); // preventDefault: we decide when to ask
    await page.waitForTimeout(400);
    await expect(installBar(page)).toHaveCount(0);
    await useApp(page);
    await expect(installBar(page)).toBeVisible();
  });

  test('SPEC-004 AC10: shows the approved wording, announces it, is accessible and does not cover the app', async ({ page }) => {
    await fireInstallPrompt(page);
    await useApp(page);
    const bar = installBar(page);
    await expect(bar).toContainText('Keep QR Pocket on your phone');
    await expect(bar).toContainText('Install QR Pocket for quick access and offline QR creation. No account needed.');
    await expect(bar.getByRole('button', { name: 'Install app' })).toBeVisible();
    await expect(bar.getByRole('button', { name: 'Not now' })).toBeVisible();
    await expect(page.locator('#sr-status')).toContainText('Keep QR Pocket on your phone');
    await scan(page, 'install prompt');
    // Inline, above the content: the field and the actions are still reachable and unobstructed.
    await expect(input(page)).toBeVisible();
    await expect(page.locator('#save')).toBeVisible();
  });

  test('SPEC-004 AC10: "Not now" hides it, is remembered for 30 days, and may ask again afterwards', async ({ page }) => {
    await fireInstallPrompt(page);
    await useApp(page);
    await installBar(page).getByRole('button', { name: 'Not now' }).click();
    await expect(installBar(page)).toHaveCount(0);
    expect(Object.keys(await installStateInStorage(page))).toContain('dismissedAt');

    await page.reload(); // next visit, browser offers installation again
    await fireInstallPrompt(page);
    await useApp(page);
    await page.waitForTimeout(400);
    await expect(installBar(page)).toHaveCount(0);

    await page.evaluate(() => {
      const state = JSON.parse(localStorage.getItem('qr-pocket.install') ?? '{}') as Record<string, number>;
      state['dismissedAt'] = Date.now() - 31 * 24 * 60 * 60 * 1000;
      state['shownAt'] = Date.now() - 31 * 24 * 60 * 60 * 1000;
      localStorage.setItem('qr-pocket.install', JSON.stringify(state));
    });
    await page.reload();
    await fireInstallPrompt(page);
    await useApp(page);
    await expect(installBar(page)).toBeVisible();
  });

  test('SPEC-004 AC10: a prompt that was shown and ignored is not repeated for 7 days, and only once per session', async ({ page }) => {
    await fireInstallPrompt(page);
    await useApp(page);
    await expect(installBar(page)).toHaveCount(1);
    await fireInstallPrompt(page); // a second browser event in the same session
    await page.waitForTimeout(300);
    await expect(installBar(page)).toHaveCount(1); // no duplicate bar

    await page.reload();
    await fireInstallPrompt(page);
    await useApp(page);
    await page.waitForTimeout(400);
    await expect(installBar(page)).toHaveCount(0); // ignored last time: quiet for 7 days

    await page.evaluate(() => {
      const state = JSON.parse(localStorage.getItem('qr-pocket.install') ?? '{}') as Record<string, number>;
      state['shownAt'] = Date.now() - 8 * 24 * 60 * 60 * 1000;
      localStorage.setItem('qr-pocket.install', JSON.stringify(state));
    });
    await page.reload();
    await fireInstallPrompt(page);
    await useApp(page);
    await expect(installBar(page)).toBeVisible();
  });

  test('SPEC-004 AC10: "Install app" calls the browser prompt once and hides the bar; accepting records no dismissal, declining does', async ({ page }) => {
    await fireInstallPrompt(page, 'accepted');
    await useApp(page);
    await installBar(page).getByRole('button', { name: 'Install app' }).click();
    await expect(installBar(page)).toHaveCount(0);
    expect(await page.evaluate(() => (window as unknown as { __promptCalls?: number }).__promptCalls)).toBe(1);
    expect(Object.keys(await installStateInStorage(page))).not.toContain('dismissedAt');

    await page.reload();
    await page.evaluate(() => localStorage.removeItem('qr-pocket.install'));
    await page.reload();
    await fireInstallPrompt(page, 'dismissed');
    await useApp(page);
    await installBar(page).getByRole('button', { name: 'Install app' }).click();
    await expect.poll(async () => Object.keys(await installStateInStorage(page))).toContain('dismissedAt');
  });

  test('SPEC-004 AC10: after installation (appinstalled) it disappears and never returns', async ({ page }) => {
    await fireInstallPrompt(page);
    await useApp(page);
    await expect(installBar(page)).toBeVisible();
    await page.evaluate(() => window.dispatchEvent(new Event('appinstalled')));
    await expect(installBar(page)).toHaveCount(0);
    expect(Object.keys(await installStateInStorage(page))).toContain('installedAt');
    await page.reload();
    await fireInstallPrompt(page);
    await useApp(page);
    await page.waitForTimeout(400);
    await expect(installBar(page)).toHaveCount(0);
  });

  test('SPEC-004 AC10: without a browser install event nothing is shown or promised', async ({ page }) => {
    await useApp(page);
    await page.waitForTimeout(500);
    await expect(installBar(page)).toHaveCount(0);
    await expect(page.getByText('Install app')).toHaveCount(0);
  });

  test('SPEC-004 AC10: never shown when the app already runs standalone', async ({ page }) => {
    await page.addInitScript(() => {
      const original = window.matchMedia.bind(window);
      window.matchMedia = (query: string) => {
        const result = original(query);
        return query.includes('display-mode: standalone')
          ? ({ ...result, matches: true, media: query, addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined, dispatchEvent: () => false, onchange: null } as unknown as MediaQueryList)
          : result;
      };
    });
    await page.reload();
    await fireInstallPrompt(page);
    await useApp(page);
    await page.waitForTimeout(500);
    await expect(installBar(page)).toHaveCount(0);
  });

  for (const width of [320, 360, 430]) {
    test(`SPEC-004 AC11: the install prompt at ${width}px fits, has >= 48px actions and no overflow`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await fireInstallPrompt(page);
      await useApp(page);
      await expect(installBar(page)).toBeVisible();
      await expectNoHorizontalOverflow(page);
      for (const name of ['Install app', 'Not now']) {
        const box = await installBar(page).getByRole('button', { name }).boundingBox();
        expect(box?.height ?? 0).toBeGreaterThanOrEqual(47.5);
        expect(box?.width ?? 0).toBeGreaterThanOrEqual(47.5);
        expect((box?.x ?? -1) + (box?.width ?? 999)).toBeLessThanOrEqual(width + 0.5);
      }
    });
  }

  for (const percent of [150, 200]) {
    test(`SPEC-004 AC11: the install prompt at 320px with ${percent}% text wraps without overflow`, async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 800 });
      await page.evaluate((p) => {
        document.documentElement.style.fontSize = `${p}%`;
      }, percent);
      await fireInstallPrompt(page);
      await useApp(page);
      await expect(installBar(page)).toBeVisible();
      await expectNoHorizontalOverflow(page);
    });
  }
});
