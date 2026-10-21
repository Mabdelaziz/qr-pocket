// SPEC-001 browser tests — run by GitHub Actions against `vite preview` at /qr-pocket/ (NOT RUN locally).
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import jsQR from 'jsqr';
import { CASES } from '../unit/helpers/cases';

const utf8 = new TextEncoder();
const ORIGIN = 'http://127.0.0.1:4173/qr-pocket/';
const LONG_M = 'a'.repeat(2400); // over Medium (2331), within Low (2953)
const TOO_LONG = 'a'.repeat(2954); // over both
const UNBROKEN_URL = 'https://example.com/' + 'segment/'.repeat(25) + '?q=' + 'x'.repeat(60);

const input = (page: Page) => page.getByLabel('Text or link');
const useLow = (page: Page) => page.getByRole('button', { name: 'Use lower error correction (L)' });
const backToMedium = (page: Page) => page.getByRole('button', { name: 'Back to Medium' });
const clearBtn = (page: Page) => page.getByRole('button', { name: 'Clear' });
const qrCanvas = (page: Page) => page.getByRole('img', { name: 'QR code for the text you entered' });

async function fillText(page: Page, text: string): Promise<void> {
  await input(page).fill(text);
}

interface CanvasSnapshot {
  width: number;
  height: number;
  modules: number;
  scale: number;
  data: number[];
}

async function readCanvas(page: Page): Promise<CanvasSnapshot> {
  return page.locator('canvas').evaluate((node) => {
    if (!(node instanceof HTMLCanvasElement)) throw new Error('not a canvas');
    const ctx = node.getContext('2d');
    if (!ctx) throw new Error('no 2d context');
    const image = ctx.getImageData(0, 0, node.width, node.height);
    return {
      width: node.width,
      height: node.height,
      modules: Number(node.dataset['modules']),
      scale: Number(node.dataset['scale']),
      data: Array.from(image.data),
    };
  });
}

function decode(snapshot: CanvasSnapshot): number[] | null {
  const result = jsQR(Uint8ClampedArray.from(snapshot.data), snapshot.width, snapshot.height, { inversionAttempts: 'dontInvert' });
  return result ? Array.from(result.binaryData) : null;
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

async function expectButtonsInside(page: Page, width: number): Promise<void> {
  const buttons = page.locator('button:visible');
  const count = await buttons.count();
  for (let i = 0; i < count; i++) {
    const box = await buttons.nth(i).boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.x).toBeGreaterThanOrEqual(-0.5);
      expect(box.x + box.width).toBeLessThanOrEqual(width + 0.5);
    }
  }
}

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await expect(input(page)).toBeVisible();
});

test.describe('SPEC-001 AC1: blank input', () => {
  test('SPEC-001 AC1: no message initially; blank shows an alert; typing clears it; clearing the field shows it again', async ({ page }) => {
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.locator('canvas')).toHaveCount(0);

    await fillText(page, '   ');
    await expect(page.getByRole('alert')).toContainText('Enter some text or a link.');
    await expect(page.locator('canvas')).toHaveCount(0);

    await fillText(page, 'hello');
    await expect(qrCanvas(page)).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);

    await fillText(page, '');
    await expect(page.getByRole('alert')).toContainText('Enter some text or a link.');
  });
});

test.describe('SPEC-001 AC2/AC3: independent decode of the rendered preview', () => {
  test.use({ deviceScaleFactor: 3 }); // more pixels per module so jsQR has a fair chance on dense codes

  for (const c of CASES) {
    test(`SPEC-001 AC3: ${c.name} decodes to the exact bytes`, async ({ page }) => {
      await fillText(page, c.text);
      await expect(qrCanvas(page)).toBeVisible();
      const decoded = decode(await readCanvas(page));
      expect(decoded).not.toBeNull();
      expect(decoded).toEqual(Array.from(utf8.encode(c.text)));
    });
  }
});

test.describe('SPEC-001 AC4/AC5: capacity and explicit Low', () => {
  test('SPEC-001 AC4: beyond 2,953 bytes is an error with no Low option and no QR', async ({ page }) => {
    await fillText(page, TOO_LONG);
    await expect(page.getByRole('alert')).toContainText('Too long for a QR code');
    await expect(page.getByRole('alert')).toContainText('2,954 bytes');
    await expect(useLow(page)).toHaveCount(0);
    await expect(page.locator('canvas')).toHaveCount(0);
    await expect(page.locator('#count')).toHaveText('2,954 / 2,953 bytes');
  });

  test('SPEC-001 AC5: Medium overflow warns, offers Low, never switches silently; Low and Back work', async ({ page }) => {
    await fillText(page, LONG_M);
    await expect(page.locator('.p-warn .ptitle')).toContainText('Too long for Medium error correction');
    await expect(page.locator('.p-warn .pdetail')).toContainText('2,400 bytes, limit 2,331');
    await expect(useLow(page)).toBeVisible();
    await expect(page.locator('canvas')).toHaveCount(0);
    await expect(page.locator('#count')).toHaveText('2,400 / 2,331 bytes · Medium');
    await expect(page.getByText('Error correction: Low')).toBeHidden();

    await useLow(page).click();
    await expect(qrCanvas(page)).toBeVisible();
    await expect(page.getByText('Error correction: Low')).toBeVisible();
    await expect(page.locator('#count')).toHaveText('2,400 / 2,953 bytes · Low');
    await expect(backToMedium(page)).toBeFocused();

    await backToMedium(page).click();
    await expect(page.locator('canvas')).toHaveCount(0);
    await expect(useLow(page)).toBeVisible();
    await expect(useLow(page)).toBeFocused();
  });

  test('SPEC-001 AC5b: exactly 2,953 bytes renders at Low', async ({ page }) => {
    await fillText(page, 'z'.repeat(2953));
    await useLow(page).click();
    await expect(qrCanvas(page)).toBeVisible();
    await expect(page.locator('#count')).toHaveText('2,953 / 2,953 bytes · Low');
  });

  test('SPEC-001: Clear resets text and error correction and refocuses the field', async ({ page }) => {
    await fillText(page, LONG_M);
    await useLow(page).click();
    await clearBtn(page).click();
    await expect(input(page)).toHaveValue('');
    await expect(input(page)).toBeFocused();
    await expect(page.getByText('Error correction: Low')).toBeHidden();
    await expect(page.locator('#count')).toHaveText('0 / 2,331 bytes · Medium');
    await expect(page.locator('canvas')).toHaveCount(0);
  });
});

test.describe('SPEC-001 AC6: sharp, scanner-readable rendering', () => {
  test('SPEC-001 AC6: black/white pixels only, integer scale, exact 4-module quiet zone', async ({ page }) => {
    await fillText(page, 'https://example.com/menu?table=12');
    await expect(qrCanvas(page)).toBeVisible();
    const snap = await readCanvas(page);
    const total = snap.modules + 8;
    expect(snap.width).toBe(snap.height);
    expect(snap.width).toBe(total * snap.scale);
    expect(Number.isInteger(snap.scale)).toBe(true);

    // Scan in plain code and assert once: tens of thousands of expect() calls block the runner (CI run 1 stalled here).
    let badPixels = 0;
    let minX = snap.width;
    let maxX = -1;
    let minY = snap.height;
    let maxY = -1;
    for (let y = 0; y < snap.height; y++) {
      for (let x = 0; x < snap.width; x++) {
        const i = (y * snap.width + x) * 4;
        const r = snap.data[i] ?? -1;
        if ((r !== 0 && r !== 255) || snap.data[i + 1] !== r || snap.data[i + 2] !== r || snap.data[i + 3] !== 255) badPixels++;
        if (r === 0) {
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
      }
    }
    expect(badPixels).toBe(0); // only pure black/white, fully opaque: no anti-aliasing
    const margin = 4 * snap.scale;
    expect(minX).toBe(margin);
    expect(minY).toBe(margin);
    expect(maxX).toBe(snap.width - margin - 1);
    expect(maxY).toBe(snap.height - margin - 1);
  });
});

test.describe('SPEC-001 AC7: responsive layout', () => {
  for (const width of [320, 360, 390, 430]) {
    test(`SPEC-001 AC7: ${width}px — square preview fully visible, no horizontal overflow`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await fillText(page, 'https://example.com/menu?table=12');
      await expect(qrCanvas(page)).toBeVisible();
      await expectNoHorizontalOverflow(page);
      const frame = await page.locator('.pv').boundingBox();
      const canvas = await qrCanvas(page).boundingBox();
      expect(frame?.width ?? 0).toBeGreaterThanOrEqual(240);
      expect(canvas).not.toBeNull();
      if (canvas) {
        expect(Math.abs(canvas.width - canvas.height)).toBeLessThanOrEqual(1);
        expect(canvas.x).toBeGreaterThanOrEqual(0);
        expect(canvas.x + canvas.width).toBeLessThanOrEqual(width);
      }
    });
  }

  test('SPEC-001 AC7: a long unbroken URL does not overflow at 320px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await fillText(page, UNBROKEN_URL);
    await expect(qrCanvas(page)).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  for (const percent of [150, 200]) {
    test(`SPEC-001 AC7: ${percent}% text scaling at 320px — no overflow, controls inside the viewport`, async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 700 });
      await page.evaluate((p) => {
        document.documentElement.style.fontSize = `${p}%`;
      }, percent);
      await fillText(page, LONG_M);
      await expect(useLow(page)).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await expectButtonsInside(page, 320);

      await useLow(page).click();
      await expect(qrCanvas(page)).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await expectButtonsInside(page, 320);
      const canvas = await qrCanvas(page).boundingBox();
      if (canvas) expect(canvas.x + canvas.width).toBeLessThanOrEqual(320);
    });
  }

  test('SPEC-001 AC7: with a short viewport (on-screen keyboard) the page scrolls and actions stay reachable', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 320 });
    await fillText(page, LONG_M);
    await expect(useLow(page)).toBeAttached();
    await useLow(page).scrollIntoViewIfNeeded();
    const box = await useLow(page).boundingBox();
    expect(box).not.toBeNull();
    if (box) expect(box.y + box.height).toBeLessThanOrEqual(320);
    const scrollable = await page.evaluate(() => (document.scrollingElement?.scrollHeight ?? 0) > window.innerHeight);
    expect(scrollable).toBe(true);
  });
});

test.describe('SPEC-001: Arabic input direction', () => {
  test('SPEC-001 AC3: the field follows the content direction (dir=auto)', async ({ page }) => {
    await fillText(page, 'مرحبا بالعالم');
    expect(await input(page).evaluate((el) => el.matches(':dir(rtl)'))).toBe(true);
    await fillText(page, 'hello world');
    expect(await input(page).evaluate((el) => el.matches(':dir(ltr)'))).toBe(true);
  });
});

test.describe('SPEC-001 AC8: accessibility', () => {
  const states: ReadonlyArray<readonly [string, string, (page: Page) => Promise<void>]> = [
    ['empty', '', async () => {}],
    ['success', 'https://example.com/menu?table=12', async (p) => expect(qrCanvas(p)).toBeVisible()],
    ['arabic success', 'مرحبا بالعالم', async (p) => expect(qrCanvas(p)).toBeVisible()],
    ['blank error', '   ', async (p) => expect(p.getByRole('alert')).toBeVisible()],
    ['medium overflow warning', LONG_M, async (p) => expect(useLow(p)).toBeVisible()],
    ['too long error', TOO_LONG, async (p) => expect(p.getByRole('alert')).toBeVisible()],
  ];

  for (const [name, text, ready] of states) {
    test(`SPEC-001 AC8: axe finds no WCAG 2.x A/AA violations — ${name}`, async ({ page }) => {
      if (text) await fillText(page, text);
      await ready(page);
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
      expect(results.violations).toEqual([]);
    });
  }

  test('SPEC-001 AC8: axe finds no violations — Low selected', async ({ page }) => {
    await fillText(page, LONG_M);
    await useLow(page).click();
    await expect(qrCanvas(page)).toBeVisible();
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
    expect(results.violations).toEqual([]);
  });

  test('SPEC-001 AC8: keyboard order is field, Clear, then the Low action; Enter activates it', async ({ page }) => {
    await input(page).focus();
    await fillText(page, LONG_M);
    await expect(useLow(page)).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(clearBtn(page)).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(useLow(page)).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(qrCanvas(page)).toBeVisible();
    await expect(backToMedium(page)).toBeFocused();
  });

  test('SPEC-001 AC8: every visible control is at least 48x48 CSS px', async ({ page }) => {
    await fillText(page, LONG_M);
    await useLow(page).click();
    await expect(qrCanvas(page)).toBeVisible();
    const controls = page.locator('button:visible, textarea:visible');
    const count = await controls.count();
    expect(count).toBeGreaterThanOrEqual(3);
    for (let i = 0; i < count; i++) {
      const box = await controls.nth(i).boundingBox();
      expect(box).not.toBeNull();
      if (box) {
        expect(box.height).toBeGreaterThanOrEqual(47.5);
        expect(box.width).toBeGreaterThanOrEqual(47.5);
      }
    }
  });

  test('SPEC-001 AC8: screen-reader status announces state changes, and the alert is not rebuilt while typing', async ({ page }) => {
    await fillText(page, 'hello');
    await expect(page.locator('#sr-status')).toHaveText('QR code ready.');
    await fillText(page, TOO_LONG);
    await expect(page.getByRole('alert')).toBeVisible();
    const handle = await page.getByRole('alert').elementHandle();
    await fillText(page, TOO_LONG + 'b');
    await expect(page.locator('#count')).toHaveText('2,955 / 2,953 bytes');
    const same = await page.evaluate((el) => document.querySelector('[role="alert"]') === el, handle);
    expect(same).toBe(true); // same element: not rebuilt, so not re-announced
    await expect(page.getByRole('alert')).toContainText('2,955 bytes'); // ...but its numbers stay current
    await expect(page.locator('#sr-status')).toHaveText(''); // errors are announced by the alert only (one channel)
  });
});

test.describe('SPEC-001 AC9: privacy and CSP', () => {
  test('SPEC-001 AC9: no cross-origin requests, no failed requests, no console errors or CSP violations', async ({ page }) => {
    const requests: string[] = [];
    const failures: string[] = [];
    const problems: string[] = [];
    page.on('request', (r) => requests.push(r.url()));
    page.on('requestfailed', (r) => failures.push(r.url()));
    page.on('console', (m) => {
      if (m.type() === 'error') problems.push(`error: ${m.text()}`);
    });
    page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));

    await page.goto('./');
    await fillText(page, 'https://example.com/private?token=abc');
    await expect(qrCanvas(page)).toBeVisible();
    await fillText(page, LONG_M);
    await useLow(page).click();
    await expect(qrCanvas(page)).toBeVisible();
    await clearBtn(page).click();

    const external = requests.filter((u) => !u.startsWith(ORIGIN) && !u.startsWith('data:'));
    expect(external).toEqual([]);
    expect(failures).toEqual([]);
    expect(problems).toEqual([]);
  });

  test('SPEC-001 AC9: the page ships a strict Content-Security-Policy', async ({ page }) => {
    const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("connect-src 'self'");
    expect(csp).not.toContain('unsafe-inline');
    expect(csp).not.toContain('unsafe-eval');
  });
});
