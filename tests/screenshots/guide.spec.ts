// Pictures for docs/USER_GUIDE.md (SPEC-005 AC8). Real app, real service worker, real IndexedDB; only the install event is synthetic.
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { card, input, openGenerate, openSaved, previewCanvas, saveText } from '../e2e/helpers/app';
import { fireInstallPrompt, installBar, offlineBar, waitForServiceWorker } from '../e2e/helpers/pwa';

const OUT = resolve(process.env['SCREENSHOT_DIR'] ?? 'user-guide-screenshots');
mkdirSync(OUT, { recursive: true });

const URL_TEXT = 'https://example.com/hello';
// Arabic "welcome to QR Pocket", built from code points so no source tool can change the characters.
const ARABIC = String.fromCodePoint(0x645, 0x631, 0x62d, 0x628, 0x627, 0x20, 0x628, 0x643, 0x20, 0x641, 0x64a, 0x20, 0x51, 0x52, 0x20, 0x50, 0x6f, 0x63, 0x6b, 0x65, 0x74);

const shot = (page: Page, name: string): Promise<Buffer> => page.screenshot({ path: resolve(OUT, `${name}.png`) });

test('SPEC-005 AC8: user guide pictures', async ({ page, context }) => {
  await page.goto('./');
  await waitForServiceWorker(page);
  await expect(input(page)).toBeVisible();
  await shot(page, '01-generate-empty');

  await input(page).fill(URL_TEXT);
  await expect(previewCanvas(page)).toBeVisible();
  await fireInstallPrompt(page);
  await expect(installBar(page)).toBeVisible();
  await page.waitForTimeout(300);
  await shot(page, '02-generate-url-with-install-card');
  await installBar(page).getByRole('button', { name: 'Not now' }).click();
  await expect(installBar(page)).toHaveCount(0);
  await page.waitForTimeout(300);
  await shot(page, '03-generate-url');

  await page.getByRole('button', { name: 'Clear' }).click();
  await saveText(page, ARABIC);
  await shot(page, '04-generate-arabic-saved');

  await page.getByRole('button', { name: 'Clear' }).click();
  await saveText(page, URL_TEXT);
  await openSaved(page);
  await expect(card(page, URL_TEXT)).toBeVisible();
  await page.waitForTimeout(300);
  await shot(page, '05-saved-list');

  await page.getByRole('button', { name: /^Rename / }).first().click();
  await expect(page.getByRole('dialog', { name: 'Rename code' })).toBeVisible();
  await page.waitForTimeout(300);
  await shot(page, '06-rename-dialog');
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: /^Delete / }).first().click();
  await expect(page.getByRole('dialog', { name: 'Delete this code?' })).toBeVisible();
  await page.waitForTimeout(300);
  await shot(page, '07-delete-dialog');
  await page.keyboard.press('Escape');

  await context.setOffline(true);
  await page.reload();
  await expect(offlineBar(page)).toBeVisible();
  await openGenerate(page);
  await input(page).fill(URL_TEXT);
  await expect(previewCanvas(page)).toBeVisible();
  await page.waitForTimeout(300);
  await shot(page, '08-offline');
  await context.setOffline(false);
});
