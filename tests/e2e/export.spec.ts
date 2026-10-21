// SPEC-003 browser tests (PNG export and sharing). The downloaded file's real bytes are parsed and decoded in Node
// with an independent PNG reader and two independent QR decoders. Run by GitHub Actions (vite preview, /qr-pocket/).
import { readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Download, type Page } from '@playwright/test';
import { CASES } from '../unit/helpers/cases';
import { decodeWithJsQr, decodeWithZxing } from '../unit/helpers/decoders';
import {
  expectNoHorizontalOverflow,
  input,
  installFaultInjector,
  openSaved,
  previewCanvas,
  saveText,
  shareButton,
  watchPage,
} from './helpers/app';
import { analysePixels, decodePng, hasPngSignature, measureSymbol, type DecodedPng } from './helpers/png';

const utf8 = new TextEncoder();
const URL_TEXT = 'https://example.com/menu?table=12';
const ARABIC = 'مرحبا بالعالم';
const LONG_M = 'a'.repeat(2400);

test.beforeEach(async ({ page }) => {
  await installFaultInjector(page);
  await page.goto('./');
  await expect(input(page)).toBeVisible();
});

async function readDownload(download: Download): Promise<{ filename: string; bytes: Buffer; png: DecodedPng }> {
  const path = await download.path();
  const bytes = readFileSync(path);
  expect(hasPngSignature(bytes)).toBe(true);
  return { filename: download.suggestedFilename(), bytes, png: decodePng(bytes) };
}

async function downloadFromGenerate(page: Page): Promise<{ filename: string; bytes: Buffer; png: DecodedPng }> {
  const pending = page.waitForEvent('download');
  await page.locator('#download').click();
  return readDownload(await pending);
}

/** Everything SPEC-003 AC1/AC2 requires of one exported PNG, checked from its own bytes. */
async function expectValidExport(png: DecodedPng, payload: string): Promise<void> {
  expect(png.width).toBe(1024);
  expect(png.height).toBe(1024);
  const report = analysePixels(png);
  expect(report.badPixels).toBe(0); // only pure black / white, fully opaque
  expect(report.black).toBeGreaterThan(1000);
  const left = report.minX;
  const right = png.width - 1 - report.maxX;
  const top = report.minY;
  const bottom = png.height - 1 - report.maxY;
  expect(left).toBe(right); // symmetric padding
  expect(top).toBe(bottom);
  expect(left).toBe(top);
  const { scale, modules } = measureSymbol(png, report);
  expect(Number.isInteger(scale)).toBe(true); // whole pixels per module
  expect(scale % 2).toBe(0);
  expect(Number.isInteger(modules)).toBe(true);
  expect(left).toBeGreaterThanOrEqual(4 * scale); // quiet zone of at least four modules
  expect(report.minX + (modules + 4) * scale).toBeLessThanOrEqual(1024); // the symbol plus its right quiet zone fits
  const expectedBytes = Array.from(utf8.encode(payload));
  expect(Array.from(decodeWithJsQr(png) ?? [])).toEqual(expectedBytes);
  expect((await decodeWithZxing(png))?.text).toBe(payload);
}

test.describe('SPEC-003 AC1/AC2/AC4: download from Generate', () => {
  for (const c of CASES.filter((x) => ['url', 'arabic-short', 'emoji-zwj-sequence', 'multiline', 'bidi-control-characters', 'arabic-long-200-plus-chars'].includes(x.name))) {
    test(`SPEC-003 AC1: ${c.name} exports a valid 1024x1024 PNG that decodes to the exact payload`, async ({ page }) => {
      await input(page).fill(c.text);
      await expect(previewCanvas(page)).toBeVisible();
      const { filename, png } = await downloadFromGenerate(page);
      expect(filename).toMatch(/^qr-.+-\d{8}\.png$/);
      expect(filename.length).toBeLessThanOrEqual(60);
      await expectValidExport(png, c.text);
    });
  }

  test('SPEC-003 AC9: a version-40 payload (2,953 bytes at Low) exports at 4 px/module and decodes exactly', async ({ page }) => {
    const text = 'y'.repeat(2953);
    await input(page).fill(text);
    await page.getByRole('button', { name: 'Use lower error correction (L)' }).click();
    await expect(previewCanvas(page)).toBeVisible();
    const { png } = await downloadFromGenerate(page);
    await expectValidExport(png, text);
    expect(measureSymbol(png, analysePixels(png)).scale).toBe(4);
  });

  test('SPEC-003 AC9: 2,400 bytes at Low and 2,331 bytes at Medium export and decode exactly', async ({ page }) => {
    await input(page).fill(LONG_M);
    await page.getByRole('button', { name: 'Use lower error correction (L)' }).click();
    await expect(previewCanvas(page)).toBeVisible();
    await expectValidExport((await downloadFromGenerate(page)).png, LONG_M);

    const medium = 'z'.repeat(2331);
    await page.getByRole('button', { name: 'Back to Medium' }).click();
    await input(page).fill(medium);
    await expect(previewCanvas(page)).toBeVisible();
    await expectValidExport((await downloadFromGenerate(page)).png, medium);
  });

  test('SPEC-003 AC4: object URLs created for downloads are revoked, and the download button is single-shot while busy', async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as unknown as { __created: string[]; __revoked: string[] };
      w.__created = [];
      w.__revoked = [];
      const create = URL.createObjectURL.bind(URL);
      const revoke = URL.revokeObjectURL.bind(URL);
      URL.createObjectURL = (obj: Blob | MediaSource) => {
        const url = create(obj);
        w.__created.push(url);
        return url;
      };
      URL.revokeObjectURL = (url: string) => {
        w.__revoked.push(url);
        revoke(url);
      };
    });
    await page.goto('./');
    let downloads = 0;
    page.on('download', () => downloads++);
    await input(page).fill(URL_TEXT);
    await expect(previewCanvas(page)).toBeVisible();
    await expect(page.locator('#download')).toHaveAttribute('aria-disabled', 'false');
    await page.evaluate(() => {
      const button = document.querySelector<HTMLButtonElement>('#download');
      button?.click();
      button?.click(); // rapid second activation while the first is rendering
      button?.click();
    });
    await expect.poll(() => downloads, { timeout: 10_000 }).toBeGreaterThanOrEqual(1);
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const w = window as unknown as { __created: string[]; __revoked: string[] };
            return w.__created.length > 0 && w.__created.every((u) => w.__revoked.includes(u));
          }),
        { timeout: 10_000 },
      )
      .toBe(true);
    await page.waitForTimeout(400);
    expect(downloads).toBe(1);
  });

  test('SPEC-003 AC11: with no QR (empty, blank or too long) Download and Share do nothing', async ({ page }) => {
    let downloads = 0;
    page.on('download', () => downloads++);
    for (const text of ['', '   ', 'a'.repeat(2954)]) {
      await input(page).fill(text);
      await expect(page.locator('#download')).toHaveAttribute('aria-disabled', 'true');
      await expect(shareButton(page)).toHaveAttribute('aria-disabled', 'true');
      await page.locator('#download').click({ force: true });
    }
    await page.waitForTimeout(500);
    expect(downloads).toBe(0);
    await expect(page.locator('#action-panel .panel')).toHaveCount(0); // no error either: nothing was attempted
  });
});

test.describe('SPEC-003 AC3/AC7: saved cards export from the stored payload with safe filenames', () => {
  test('SPEC-003 AC7: a saved Arabic item downloads a valid PNG named after its title, and no image is stored', async ({ page }) => {
    await saveText(page, ARABIC);
    await openSaved(page);
    const pending = page.waitForEvent('download');
    await page.getByRole('button', { name: `Download ${ARABIC}` }).click();
    const { filename, png } = await readDownload(await pending);
    expect(filename).toMatch(/^qr-مرحبا-بالعالم-\d{8}\.png$/); // Arabic letters are kept
    await expectValidExport(png, ARABIC);
    const raw = JSON.stringify(
      await page.evaluate(
        () =>
          new Promise<unknown[]>((resolve) => {
            const open = indexedDB.open('qr-pocket');
            open.onsuccess = () => {
              const request = open.result.transaction('codes').objectStore('codes').getAll();
              request.onsuccess = () => resolve(request.result);
            };
          }),
      ),
    );
    expect(raw).not.toMatch(/data:image|blob:|PNG|iVBOR/); // payloads only; images are derived on demand
  });

  test('SPEC-003 AC3: a renamed title with slashes, quotes and emoji becomes a safe filename', async ({ page }) => {
    await saveText(page, URL_TEXT);
    await openSaved(page);
    await page.getByRole('button', { name: `Rename ${URL_TEXT}` }).click();
    await page.getByRole('textbox', { name: 'Title' }).fill('../Menu: "Table/12" \u{1F600}*?');
    await page.keyboard.press('Enter');
    // Wait for the re-rendered list to show the NEW title (the old card also matched 'menu' via its payload).
    await expect(page.locator('#saved-body h2')).toHaveText('../Menu: "Table/12" ' + String.fromCodePoint(0x1f600) + '*?');
    const pending = page.waitForEvent('download');
    await page.getByRole('button', { name: /^Download / }).click();
    const { filename } = await readDownload(await pending);
    expect(filename).toMatch(/^qr-menu-table-12-\d{8}\.png$/);
  });
});

/** Installs a controllable Web Share stub before the app loads. */
async function stubShare(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __shares: Array<Record<string, unknown>>; __shareMode: string };
    w.__shares = [];
    w.__shareMode = 'ok';
    Object.defineProperty(navigator, 'canShare', {
      configurable: true,
      value: (data?: ShareData) => !!data?.files && data.files.length > 0 && data.files.every((f) => f.type === 'image/png'),
    });
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (data: ShareData) => {
        const file = data.files?.[0];
        const header = file ? Array.from(new Uint8Array(await file.arrayBuffer()).slice(0, 24)) : [];
        w.__shares.push({ keys: Object.keys(data), count: data.files?.length ?? 0, name: file?.name, type: file?.type, size: file?.size, header });
        if (w.__shareMode === 'abort') throw new DOMException('dismissed', 'AbortError');
        if (w.__shareMode === 'fail') throw new DOMException('blocked', 'NotAllowedError');
      },
    });
  });
  await page.goto('./');
  await expect(input(page)).toBeVisible();
}

async function shares(page: Page): Promise<Array<Record<string, unknown>>> {
  return page.evaluate(() => (window as unknown as { __shares: Array<Record<string, unknown>> }).__shares);
}

test.describe('SPEC-003 AC5/AC6: Web Share', () => {
  test('SPEC-003 AC5: where file sharing is unsupported, Share is hidden, an explanation shows, and Download stays', async ({ page }) => {
    await input(page).fill(URL_TEXT);
    await expect(previewCanvas(page)).toBeVisible();
    await expect(shareButton(page)).toBeHidden();
    await expect(page.locator('#share-note')).toBeVisible();
    await expect(page.locator('#share-note')).toContainText('Sharing files isn’t supported in this browser');
    await expect(page.locator('#download')).toBeVisible();
    await expect(page.locator('#download')).toHaveAttribute('aria-disabled', 'false');
    await saveText(page, URL_TEXT);
    await openSaved(page);
    await expect(page.getByRole('button', { name: /^Share / })).toHaveCount(0); // no Share on cards either
    await expect(page.getByRole('button', { name: /^Download / })).toBeVisible();
  });

  test('SPEC-003 AC6: where supported, Share sends only a 1024x1024 PNG file (no title, text or URL)', async ({ page }) => {
    await stubShare(page);
    await expect(shareButton(page)).toBeVisible();
    await expect(page.locator('#share-note')).toBeHidden();
    await input(page).fill(ARABIC);
    await expect(previewCanvas(page)).toBeVisible();
    await shareButton(page).click();
    await expect.poll(async () => (await shares(page)).length).toBe(1);
    const [shared] = await shares(page);
    expect(shared?.['keys']).toEqual(['files']);
    expect(shared?.['count']).toBe(1);
    expect(shared?.['type']).toBe('image/png');
    expect(String(shared?.['name'])).toMatch(/^qr-مرحبا-بالعالم-\d{8}\.png$/);
    expect(Number(shared?.['size'])).toBeGreaterThan(1000);
    const header = Buffer.from(shared?.['header'] as number[]);
    expect(hasPngSignature(header)).toBe(true);
    expect(header.readUInt32BE(16)).toBe(1024); // IHDR width
    expect(header.readUInt32BE(20)).toBe(1024); // IHDR height
    await expect(page.locator('#action-panel .panel')).toHaveCount(0);
  });

  test('SPEC-003 AC6: a dismissed share sheet is silent; a real failure shows an error and Download still works', async ({ page }) => {
    await stubShare(page);
    await input(page).fill(URL_TEXT);
    await expect(previewCanvas(page)).toBeVisible();

    await page.evaluate(() => ((window as unknown as { __shareMode: string }).__shareMode = 'abort'));
    await shareButton(page).click();
    await expect.poll(async () => (await shares(page)).length).toBe(1);
    await page.waitForTimeout(300);
    await expect(page.getByRole('alert')).toHaveCount(0); // cancellation is not an error

    await page.evaluate(() => ((window as unknown as { __shareMode: string }).__shareMode = 'fail'));
    await shareButton(page).click();
    await expect(page.getByRole('alert')).toContainText('Couldn’t open the share sheet');
    await expect(page.getByRole('alert')).toContainText('download the image instead');
    const { png } = await downloadFromGenerate(page);
    await expectValidExport(png, URL_TEXT);
  });

  test('SPEC-003 AC6: saved cards offer Share when supported and share the stored code', async ({ page }) => {
    await stubShare(page);
    await saveText(page, ARABIC);
    await openSaved(page);
    await page.getByRole('button', { name: `Share ${ARABIC}` }).click();
    await expect.poll(async () => (await shares(page)).length).toBe(1);
    expect((await shares(page))[0]?.['type']).toBe('image/png');
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  test('SPEC-003 AC8: axe finds no violations with Share available, an export error shown, and the saved state', async ({ page }) => {
    await stubShare(page);
    await input(page).fill(URL_TEXT);
    await expect(previewCanvas(page)).toBeVisible();
    let results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
    expect(results.violations).toEqual([]);

    await page.evaluate(() => ((window as unknown as { __shareMode: string }).__shareMode = 'fail'));
    await shareButton(page).click();
    await expect(page.getByRole('alert')).toBeVisible();
    results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
    expect(results.violations).toEqual([]);

    await saveText(page, URL_TEXT + '#2');
    results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
    expect(results.violations).toEqual([]);
  });
});

test.describe('SPEC-003 AC8/AC10: layout, targets and privacy', () => {
  for (const width of [320, 360, 430]) {
    test(`SPEC-003 AC8: Generate actions at ${width}px — inside the viewport, >= 48px, no overflow, no explanatory text on inactive buttons`, async ({ page }) => {
      await stubShare(page);
      await page.setViewportSize({ width, height: 800 });
      await expect(page.locator('#actions')).not.toContainText('enable'); // no misleading disabled-action message
      await input(page).fill(URL_TEXT);
      await expect(previewCanvas(page)).toBeVisible();
      await expectNoHorizontalOverflow(page);
      for (const id of ['#save', '#download', '#share']) {
        const box = await page.locator(id).boundingBox();
        expect(box).not.toBeNull();
        if (box) {
          expect(box.height).toBeGreaterThanOrEqual(47.5);
          expect(box.width).toBeGreaterThanOrEqual(47.5);
          expect(box.x).toBeGreaterThanOrEqual(-0.5);
          expect(box.x + box.width).toBeLessThanOrEqual(width + 0.5);
        }
      }
    });
  }

  for (const percent of [150, 200]) {
    test(`SPEC-003 AC8: Generate actions at 320px with ${percent}% text — wrap instead of overflowing`, async ({ page }) => {
      await stubShare(page);
      await page.setViewportSize({ width: 320, height: 700 });
      await page.evaluate((p) => {
        document.documentElement.style.fontSize = `${p}%`;
      }, percent);
      await input(page).fill(URL_TEXT);
      await expect(previewCanvas(page)).toBeVisible();
      await expectNoHorizontalOverflow(page);
      for (const id of ['#save', '#download', '#share']) {
        const box = await page.locator(id).boundingBox();
        if (box) expect(box.x + box.width).toBeLessThanOrEqual(320.5);
      }
    });
  }

  test('SPEC-003 AC10: exporting and sharing send nothing off-device — no request contains the payload', async ({ page }) => {
    await stubShare(page);
    const secret = 'https://example.com/private?token=SECRET-PAYLOAD-12345';
    const requests: string[] = [];
    page.on('request', (r) => requests.push(`${r.method()} ${r.url()} ${r.postData() ?? ''}`));
    const watch = watchPage(page);
    await input(page).fill(secret);
    await expect(previewCanvas(page)).toBeVisible();
    await downloadFromGenerate(page);
    await shareButton(page).click();
    await expect.poll(async () => (await shares(page)).length).toBe(1);
    expect(watch.external).toEqual([]);
    expect(watch.failures).toEqual([]);
    expect(watch.problems).toEqual([]);
    expect(requests.filter((r) => r.includes('SECRET-PAYLOAD') || r.includes(encodeURIComponent(secret)))).toEqual([]);
  });
});
