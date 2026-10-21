// SPEC-004 AC13: a smoke subset that runs on Chromium, Firefox AND WebKit (tests tagged @cross; the Playwright projects
// for Firefox/WebKit run only these). Core flows: generate, decode, save, persistence, dialogs, PNG download, manifest, offline.
import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import jsQR from 'jsqr';
import { card, cards, dbRecords, input, installFaultInjector, openSaved, previewCanvas, saveText } from './helpers/app';
import { decodePng } from './helpers/png';
import { waitForServiceWorker } from './helpers/pwa';

const ARABIC = 'مرحبا بالعالم';
const URL_TEXT = 'https://example.com/menu?table=12';

test.beforeEach(async ({ page }) => {
  await installFaultInjector(page);
  await page.goto('./');
  await expect(input(page)).toBeVisible();
});

test('@cross SPEC-004 AC13: an Arabic payload renders a QR code that an independent decoder reads exactly', async ({ page }) => {
  await input(page).fill(ARABIC);
  await expect(previewCanvas(page)).toBeVisible();
  const pixels = await page.locator('canvas').evaluate((node) => {
    const canvas = node as HTMLCanvasElement;
    const image = canvas.getContext('2d')?.getImageData(0, 0, canvas.width, canvas.height);
    if (!image) throw new Error('no 2d context');
    return { width: canvas.width, height: canvas.height, data: Array.from(image.data) };
  });
  const decoded = jsQR(Uint8ClampedArray.from(pixels.data), pixels.width, pixels.height, { inversionAttempts: 'dontInvert' });
  expect(decoded).not.toBeNull();
  expect(new TextDecoder().decode(Uint8Array.from(decoded?.binaryData ?? []))).toBe(ARABIC);
});

test('@cross SPEC-004 AC13: saved codes persist across a reload; the Saved list, Open and both dialogs work', async ({ page }) => {
  await saveText(page, URL_TEXT);
  await saveText(page, ARABIC);
  expect(await dbRecords(page)).toHaveLength(2);
  await page.reload();
  await openSaved(page);
  await expect(cards(page)).toHaveCount(2);
  await expect(cards(page).first()).toContainText(ARABIC);

  await page.getByRole('button', { name: `Rename ${ARABIC}` }).click();
  const rename = page.getByRole('dialog', { name: 'Rename code' });
  await expect(rename).toBeVisible();
  await page.getByRole('textbox', { name: 'Title' }).fill('Renamed');
  await page.keyboard.press('Enter');
  await expect(rename).toBeHidden();
  await expect(card(page, 'Renamed')).toBeVisible();

  await page.getByRole('button', { name: 'Delete Renamed' }).click();
  const confirm = page.getByRole('dialog', { name: 'Delete this code?' });
  await expect(confirm).toBeVisible();
  await page.keyboard.press('Escape'); // Esc cancels
  await expect(confirm).toBeHidden();
  await expect(cards(page)).toHaveCount(2);
  await page.getByRole('button', { name: 'Delete Renamed' }).click();
  await confirm.getByRole('button', { name: 'Delete' }).click();
  await expect(cards(page)).toHaveCount(1);

  await page.getByRole('button', { name: `Open ${URL_TEXT}` }).click();
  await expect(input(page)).toHaveValue(URL_TEXT);
  await expect(previewCanvas(page)).toBeVisible();
});

test('@cross SPEC-004 AC13: the PNG download is a valid 1024x1024 black-and-white PNG that decodes to the payload', async ({ page }) => {
  await input(page).fill(ARABIC);
  await expect(previewCanvas(page)).toBeVisible();
  const pending = page.waitForEvent('download');
  await page.locator('#download').click();
  const download = await pending;
  expect(download.suggestedFilename()).toMatch(/^qr-.+-\d{8}\.png$/);
  const png = decodePng(await readFile(await download.path()));
  expect([png.width, png.height]).toEqual([1024, 1024]);
  const decoded = jsQR(png.data, png.width, png.height, { inversionAttempts: 'dontInvert' });
  expect(new TextDecoder().decode(Uint8Array.from(decoded?.binaryData ?? []))).toBe(ARABIC);
});

test('@cross SPEC-004 AC13: the manifest and icons are served', async ({ page }) => {
  const manifest = (await (await page.request.get('manifest.webmanifest')).json()) as { start_url: string; scope: string; icons: Array<{ src: string }> };
  expect(manifest.start_url).toBe('/qr-pocket/');
  expect(manifest.scope).toBe('/qr-pocket/');
  expect(manifest.icons.length).toBeGreaterThanOrEqual(3);
  for (const icon of manifest.icons) expect((await page.request.get(new URL(icon.src, page.url()).href)).status(), icon.src).toBe(200);
});

test.describe('@cross offline', () => {
  test.use({ serviceWorkers: 'allow' });

  test('@cross SPEC-004 AC13: the service worker installs and the app reloads and works offline', async ({ page, context }) => {
    await page.reload(); // load once with workers allowed
    await waitForServiceWorker(page);
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Create a QR code', level: 1 })).toBeVisible();
    await saveText(page, URL_TEXT);
    await page.reload();
    await openSaved(page);
    await expect(cards(page)).toHaveCount(1);
    await context.setOffline(false);
  });
});
