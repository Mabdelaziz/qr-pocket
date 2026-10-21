// SPEC-004 AC5-AC7, AC12: updates between two deployments, user-controlled reload, preserved data, recovery.
// `dist` (build v1) and `dist-v2` (build v2, `npm run build:v2`) are served by a static server whose content is swapped
// while the browser keeps its installed service worker, exactly what a new deployment looks like to a returning visitor.
// Chromium only (the project configuration restricts Firefox/WebKit to @cross tests).
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { dbRecords, input, installFaultInjector, openSaved, saveText } from './helpers/app';
import { readCaches, expectBuild, updateBar, waitForServiceWorker } from './helpers/pwa';
import { startServer, type MutableServer } from './helpers/staticServer';

const V1 = resolve('dist');
const V2 = resolve('dist-v2');
const KILL_SWITCH = readFileSync(resolve('docs/recovery/kill-switch-sw.js'), 'utf8');
const DRAFT = 'unsaved draft text';
const UPDATE_WARNING = 'A new version is ready. Reloading will clear the text you are typing.';

test.use({ serviceWorkers: 'allow' });
test.describe.configure({ timeout: 90_000 }); // deploy simulation: install, update check, reload, offline reload

const mainScript = (dir: string): string => {
  const found = readdirSync(resolve(dir, 'assets')).find((f) => /^index-.+\.js$/.test(f));
  if (!found) throw new Error(`no main bundle in ${dir}/assets`);
  return found;
};

test.beforeAll(() => {
  for (const dir of [V1, V2]) {
    if (!existsSync(resolve(dir, 'index.html'))) throw new Error(`${dir} is missing: run "npm run build" and "npm run build:v2" first`);
  }
  expect(mainScript(V1), 'the two builds must differ, or the update cannot be detected').not.toBe(mainScript(V2));
});

/** Serves v1, opens the app and waits until its service worker controls the page. */
async function withDeployedApp(page: Page, run: (server: MutableServer, url: string) => Promise<void>): Promise<void> {
  const server = await startServer(V1);
  try {
    await installFaultInjector(page);
    const url = `${server.origin}/qr-pocket/`;
    await page.goto(url);
    await expectBuild(page, 'v1');
    await waitForServiceWorker(page);
    await run(server, url);
  } finally {
    await server.close();
  }
}

const checkForUpdate = (page: Page): Promise<void> =>
  page.evaluate(async () => {
    await (await navigator.serviceWorker.getRegistration())?.update();
  });

test.describe('SPEC-004 AC5/AC6: a new deployment is offered, never forced', () => {
  test('SPEC-004 AC5/AC6: the update waits for the user (typing and dialogs untouched); Reload moves to the new build once, keeps saved codes and replaces the old cache', async ({ page, context }) => {
    await withDeployedApp(page, async (server) => {
      await saveText(page, 'saved before the update');
      await input(page).fill(DRAFT);
      await page.evaluate(() => ((window as unknown as { __marker: string }).__marker = 'alive'));
      let loads = 0;
      page.on('load', () => loads++);

      // Deploy v2 and let the browser check for it.
      server.setRoot(V2);
      await checkForUpdate(page);
      await expect(updateBar(page)).toBeVisible();
      await expect(updateBar(page)).toContainText(UPDATE_WARNING); // there is unsaved text: the bar says so
      await expect(page.locator('#sr-status')).toHaveText(UPDATE_WARNING);
      await expect(updateBar(page).getByRole('button', { name: 'Reload' })).toBeVisible();
      await expect(updateBar(page).getByRole('button', { name: 'Later' })).toBeVisible();

      // AC5: nothing happens on its own, even while a dialog is open.
      await openSaved(page);
      await page.getByRole('button', { name: /^Rename / }).click();
      const dialog = page.getByRole('dialog', { name: 'Rename code' });
      await expect(dialog).toBeVisible();
      await page.waitForTimeout(2500);
      await expect(dialog).toBeVisible();
      expect(await page.evaluate(() => (window as unknown as { __marker?: string }).__marker)).toBe('alive');
      await expectBuild(page, 'v1');
      expect(loads).toBe(0);
      await page.keyboard.press('Escape');
      await page.getByRole('link', { name: 'Generate', exact: true }).click();
      await expect(input(page)).toHaveValue(DRAFT); // the draft is untouched

      // Typing the draft away removes the warning from the bar (it follows the text field).
      await input(page).fill('');
      await expect(updateBar(page)).toContainText('A new version is ready.');
      await expect(updateBar(page)).not.toContainText('Reloading will clear');
      await input(page).fill(DRAFT);

      // AC6: the user accepts.
      await updateBar(page).getByRole('button', { name: 'Reload' }).click();
      await expectBuild(page, 'v2');
      await expect.poll(() => loads).toBe(1); // exactly one reload (the load event follows the module script)
      await expect(input(page)).toHaveValue(''); // the warned-about draft is gone, as announced
      await waitForServiceWorker(page);

      // Saved codes are untouched by the update.
      expect(await dbRecords(page)).toHaveLength(1);
      await openSaved(page);
      await expect(page.locator('#saved-body .scard[data-id]')).toHaveCount(1);
      await expect(page.locator('#saved-body')).toContainText('saved before the update');

      // Only the new build's precache remains.
      const entries = await readCaches(page);
      expect(new Set(entries.map((e) => e.cache)).size).toBe(1);
      const cachedAssets = entries.map((e) => new URL(e.url).pathname).filter((p) => p.startsWith('/qr-pocket/assets/')).map((p) => p.split('/').pop());
      expect([...cachedAssets].sort()).toEqual(readdirSync(resolve(V2, 'assets')).sort());
      expect(cachedAssets).not.toContain(mainScript(V1));

      // And the new version works offline.
      await context.setOffline(true);
      await page.reload();
      await expectBuild(page, 'v2');
      await openSaved(page);
      await expect(page.locator('#saved-body .scard[data-id]')).toHaveCount(1);
    });
  });

  test('SPEC-004 AC5: the unsaved-text warning counts whitespace and follows Clear and Open, not only typing', async ({ page }) => {
    await withDeployedApp(page, async (server) => {
      await saveText(page, 'a saved code');
      await input(page).fill('   '); // whitespace is still what the field shows
      server.setRoot(V2);
      await checkForUpdate(page);
      await expect(updateBar(page)).toContainText('Reloading will clear the text you are typing.');

      await page.getByRole('button', { name: 'Clear' }).click(); // a programmatic change: no input event
      await expect(updateBar(page)).not.toContainText('Reloading will clear');

      await openSaved(page);
      await page.getByRole('button', { name: /^Open / }).click(); // Open fills the field
      await expect(updateBar(page)).toContainText('Reloading will clear the text you are typing.');
    });
  });

  test('SPEC-004 AC7: "Later" hides the bar and keeps the current build; the offer returns on the next visit', async ({ page }) => {
    await withDeployedApp(page, async (server) => {
      await page.evaluate(() => ((window as unknown as { __marker: string }).__marker = 'alive'));
      server.setRoot(V2);
      await checkForUpdate(page);
      await expect(updateBar(page)).toBeVisible();
      await expect(updateBar(page)).toContainText('A new version is ready.');
      await expect(updateBar(page)).not.toContainText('Reloading will clear'); // nothing typed: no warning

      await updateBar(page).getByRole('button', { name: 'Later' }).click();
      await expect(updateBar(page)).toHaveCount(0);
      await page.waitForTimeout(1500);
      expect(await page.evaluate(() => (window as unknown as { __marker?: string }).__marker)).toBe('alive'); // nothing reloaded
      await expectBuild(page, 'v1');

      await page.reload(); // the waiting worker is still waiting: the user is offered it again
      await expectBuild(page, 'v1');
      await expect(updateBar(page)).toBeVisible();
    });
  });
});

test.describe('SPEC-004 AC12: recovery from a bad service worker', () => {
  test('SPEC-004 AC12: the kill-switch worker deletes the app caches and unregisters, while saved codes stay', async ({ page }) => {
    await withDeployedApp(page, async (server, url) => {
      await saveText(page, 'must survive the recovery');
      expect((await readCaches(page)).length).toBeGreaterThan(0);

      server.override('sw.js', KILL_SWITCH); // "deploy" the emergency worker as /qr-pocket/sw.js
      await checkForUpdate(page);
      await expect.poll(() => page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length), { timeout: 20_000 }).toBe(0);
      await expect.poll(() => page.evaluate(async () => (await caches.keys()).filter((k) => k.startsWith('qr-pocket')).length), { timeout: 20_000 }).toBe(0);

      // IndexedDB was never touched, and the app still loads (from the network now).
      expect(await dbRecords(page)).toHaveLength(1);
      await page.goto(url);
      await expect(page.getByRole('heading', { name: 'Create a QR code', level: 1 })).toBeVisible();
      await openSaved(page);
      await expect(page.locator('#saved-body')).toContainText('must survive the recovery');
    });
  });
});
