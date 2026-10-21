// SPEC-002 browser tests (local library). Run by GitHub Actions against `vite preview` at /qr-pocket/.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { CASES } from '../unit/helpers/cases';
import {
  card,
  cards,
  dbRecords,
  expectNoHorizontalOverflow,
  input,
  installFaultInjector,
  navLink,
  openGenerate,
  openSaved,
  previewCanvas,
  saveButton,
  saveText,
  setFault,
  watchPage,
} from './helpers/app';

const URL_TEXT = 'https://example.com/menu?table=12';
const ARABIC = 'مرحبا بالعالم';
const LONG_M = 'a'.repeat(2400); // over Medium (2331), within Low (2953)
const LONG_TITLE_TEXT = 'A rather long title that must wrap or truncate cleanly on narrow screens';
const LONG_TITLE = Array.from(LONG_TITLE_TEXT).slice(0, 40).join(''); // default titles are cut at 40 code points
const UNBROKEN = 'https://example.com/' + 'segment/'.repeat(25) + '?q=' + 'x'.repeat(60);
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

test.beforeEach(async ({ page }) => {
  await installFaultInjector(page);
  await page.goto('./');
  await expect(input(page)).toBeVisible();
});

const renameButton = (page: Page, title: string) => page.getByRole('button', { name: `Rename ${title}` });
const deleteButton = (page: Page, title: string) => page.getByRole('button', { name: `Delete ${title}` });
const openButton = (page: Page, title: string) => page.getByRole('button', { name: `Open ${title}` });
const renameDialog = (page: Page) => page.getByRole('dialog', { name: 'Rename code' });
const deleteDialog = (page: Page) => page.getByRole('dialog', { name: 'Delete this code?' });

test.describe('SPEC-002 AC1/AC2: save, list, persist', () => {
  test('SPEC-002 AC2: saved items list newest first, with a count, and survive a reload', async ({ page }) => {
    await saveText(page, URL_TEXT);
    await saveText(page, ARABIC);
    await openSaved(page);
    await expect(cards(page)).toHaveCount(2);
    await expect(cards(page).first()).toContainText(ARABIC); // newest first
    await expect(cards(page).nth(1)).toContainText(URL_TEXT);
    await expect(page.locator('#saved-count')).toHaveText('2 codes');

    await page.reload();
    await expect(cards(page)).toHaveCount(2);
    await expect(cards(page).first()).toContainText(ARABIC);
    await expect(cards(page).nth(1)).toContainText(URL_TEXT);
  });

  test('SPEC-002 AC1: every Unicode/Arabic payload is stored exactly, with the documented fields and no image data', async ({ page }) => {
    for (const c of CASES) await saveText(page, c.text);
    const records = await dbRecords(page);
    expect(records).toHaveLength(CASES.length);
    expect(records.map((r) => r.payload).sort()).toEqual(CASES.map((c) => c.text).sort());
    for (const r of records) {
      expect(Object.keys(r).sort()).toEqual(['createdAt', 'ecc', 'id', 'payload', 'source', 'title', 'updatedAt', 'v']);
      expect(r.ecc).toBe('M');
      expect(r.source).toBe('typed');
      expect(r.v).toBe(1);
      expect(r.createdAt).toBe(r.updatedAt);
    }
    expect(new Set(records.map((r) => r.id)).size).toBe(CASES.length);
  });

  test('SPEC-002 AC8: the save message states data stays on this device and never claims a backup', async ({ page }) => {
    await saveText(page, URL_TEXT);
    const panel = page.locator('#action-panel .panel');
    await expect(panel).toContainText('Saved to this device');
    await expect(panel).toContainText('Clearing browser data may erase');
    await expect(panel).toContainText('no backup');
    await expect(page.locator('#sr-status')).toHaveText('Saved to this device.');
    await openSaved(page);
    await expect(page.locator('#saved-notice')).toContainText('no backup');
  });

  test('SPEC-002: thumbnails are drawn lazily for visible cards', async ({ page }) => {
    await saveText(page, URL_TEXT);
    await saveText(page, ARABIC);
    await openSaved(page);
    await expect(page.locator('#saved-body canvas[data-drawn="true"]')).toHaveCount(2);
  });
});

test.describe('SPEC-002 AC11: Save state and duplicates', () => {
  test('SPEC-002 AC11: rapid repeated activation creates exactly one record', async ({ page }) => {
    await input(page).fill(URL_TEXT);
    await expect(previewCanvas(page)).toBeVisible();
    await expect(saveButton(page)).toHaveAttribute('aria-disabled', 'false');
    // Five activations in the same tick, as a double-tap or a held Enter key could produce.
    await page.evaluate(() => {
      const button = document.querySelector<HTMLButtonElement>('#save');
      for (let i = 0; i < 5; i++) button?.click();
    });
    await expect(saveButton(page)).toHaveText('Saved');
    expect(await dbRecords(page)).toHaveLength(1);
    await saveButton(page).click({ force: true }); // an inactive "Saved" button does nothing
    await page.waitForTimeout(300);
    expect(await dbRecords(page)).toHaveLength(1);
  });

  test('SPEC-002 AC11: changing the text resets Save and the next save is a new record, never an overwrite', async ({ page }) => {
    await saveText(page, 'one');
    await input(page).fill('one!');
    await expect(saveButton(page)).toHaveText('Save');
    await expect(saveButton(page)).toHaveAttribute('aria-disabled', 'false');
    await expect(page.locator('#action-panel .panel')).toHaveCount(0); // the old success message does not linger
    await saveButton(page).click();
    await expect(saveButton(page)).toHaveText('Saved');
    const records = await dbRecords(page);
    expect(records.map((r) => r.payload).sort()).toEqual(['one', 'one!']);
  });

  test('SPEC-002 AC11: changing the error-correction level counts as a change; Low is stored as Low', async ({ page }) => {
    await input(page).fill(LONG_M);
    await page.getByRole('button', { name: 'Use lower error correction (L)' }).click();
    await expect(previewCanvas(page)).toBeVisible();
    await saveButton(page).click();
    await expect(saveButton(page)).toHaveText('Saved');

    await page.getByRole('button', { name: 'Back to Medium' }).click(); // level changes: no QR at Medium for this text
    await expect(saveButton(page)).toHaveAttribute('aria-disabled', 'true');
    await page.getByRole('button', { name: 'Use lower error correction (L)' }).click(); // same text + same level again
    await expect(saveButton(page)).toHaveText('Saved'); // this exact content is already saved

    await input(page).fill(LONG_M + 'b'); // new content at Low
    await expect(saveButton(page)).toHaveText('Save');
    await saveButton(page).click();
    await expect(saveButton(page)).toHaveText('Saved');
    const records = await dbRecords(page);
    expect(records).toHaveLength(2);
    expect(records.every((r) => r.ecc === 'L')).toBe(true);
  });

  test('SPEC-002 AC11: deleting the saved record lets the same content be saved again', async ({ page }) => {
    await saveText(page, 'delete me then save me');
    await openSaved(page);
    await deleteButton(page, 'delete me then save me').click();
    await deleteDialog(page).getByRole('button', { name: 'Delete' }).click();
    await expect(cards(page)).toHaveCount(0);
    await openGenerate(page);
    await expect(saveButton(page)).toHaveText('Save');
    await expect(saveButton(page)).toHaveAttribute('aria-disabled', 'false');
    await saveButton(page).click();
    await expect(saveButton(page)).toHaveText('Saved');
    expect(await dbRecords(page)).toHaveLength(1);
  });

  test('SPEC-002 AC11: Save is inactive when there is no QR', async ({ page }) => {
    await expect(saveButton(page)).toHaveAttribute('aria-disabled', 'true');
    await saveButton(page).click({ force: true });
    await input(page).fill('   ');
    await saveButton(page).click({ force: true });
    await input(page).fill('a'.repeat(2954));
    await saveButton(page).click({ force: true });
    await page.waitForTimeout(300);
    expect(await dbRecords(page)).toHaveLength(0);
  });
});

test.describe('SPEC-002 AC7/AC9: empty state and Open', () => {
  test('SPEC-002 AC7: the empty state explains itself and its action returns to a focused text field', async ({ page }) => {
    await openSaved(page);
    await expect(page.getByRole('heading', { name: 'Nothing saved yet' })).toBeVisible();
    await expect(page.locator('#saved-notice')).toBeVisible();
    await page.getByRole('button', { name: 'Create a QR code' }).click();
    await expect(page.getByRole('heading', { name: 'Create a QR code', level: 1 })).toBeVisible();
    await expect(input(page)).toBeFocused();
  });

  test('SPEC-002 AC9: opening an Arabic item restores text, RTL direction and a Saved button; editing then saving makes a new record', async ({ page }) => {
    await saveText(page, ARABIC);
    const typedWidth = await previewCanvas(page).evaluate((c) => (c as HTMLCanvasElement).width);
    await input(page).fill('');
    await openSaved(page);
    await openButton(page, ARABIC).click();
    await expect(input(page)).toHaveValue(ARABIC);
    await expect(previewCanvas(page)).toBeVisible();
    // The QR loaded while the Generate view was hidden must be drawn at the real container size, not 1 px/module.
    await expect.poll(() => previewCanvas(page).evaluate((c) => (c as HTMLCanvasElement).width)).toBe(typedWidth);
    expect(await input(page).evaluate((el) => el.matches(':dir(rtl)'))).toBe(true);
    await expect(saveButton(page)).toHaveText('Saved');

    await input(page).fill(ARABIC + ' 2');
    await expect(saveButton(page)).toHaveText('Save');
    await saveButton(page).click();
    await expect(saveButton(page)).toHaveText('Saved');
    const payloads = (await dbRecords(page)).map((r) => r.payload).sort();
    expect(payloads).toEqual([ARABIC, ARABIC + ' 2'].sort());
  });

  test('SPEC-002: navigation marks the current tab, moves focus to the new heading and updates the title', async ({ page }) => {
    await expect(navLink(page, 'Generate')).toHaveAttribute('aria-current', 'page');
    await openSaved(page);
    await expect(navLink(page, 'Saved')).toHaveAttribute('aria-current', 'page');
    await expect(navLink(page, 'Generate')).not.toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('heading', { name: 'Saved codes', level: 1 })).toBeFocused();
    await expect(page).toHaveTitle('Saved codes – QR Pocket');
    await openGenerate(page);
    await expect(page.getByRole('heading', { name: 'Create a QR code', level: 1 })).toBeFocused();
    await expect(page).toHaveTitle('QR Pocket');
  });
});

test.describe('SPEC-002 AC3/AC12: rename', () => {
  test('SPEC-002 AC3: rename updates the title, keeps the order and returns focus; Esc changes nothing', async ({ page }) => {
    await saveText(page, 'first item');
    await saveText(page, 'second item');
    await openSaved(page);

    await renameButton(page, 'first item').click();
    await expect(renameDialog(page)).toBeVisible();
    const field = page.getByRole('textbox', { name: 'Title' });
    await expect(field).toBeFocused();
    expect(await field.evaluate((el) => ((el as HTMLInputElement).selectionEnd ?? 0) - ((el as HTMLInputElement).selectionStart ?? 0))).toBe('first item'.length); // selected
    await page.keyboard.press('Escape');
    await expect(renameDialog(page)).toBeHidden();
    await expect(renameButton(page, 'first item')).toBeFocused(); // focus restored
    await expect(card(page, 'first item')).toBeVisible();

    await renameButton(page, 'first item').click();
    await field.fill('Wi-Fi poster');
    await page.keyboard.press('Enter');
    await expect(renameDialog(page)).toBeHidden();
    await expect(cards(page).nth(1)).toContainText('Wi-Fi poster'); // still second: renames do not reorder
    await expect(cards(page).first()).toContainText('second item');
    await expect(renameButton(page, 'Wi-Fi poster')).toBeFocused();
    const renamed = (await dbRecords(page)).find((r) => r.payload === 'first item');
    expect(renamed?.title).toBe('Wi-Fi poster');
    expect(renamed?.updatedAt).toBeGreaterThan(renamed?.createdAt ?? Infinity);
  });

  test('SPEC-002 AC3: a blank title becomes the default title', async ({ page }) => {
    await saveText(page, 'default title source\nsecond line');
    await openSaved(page);
    await renameButton(page, 'default title source').click();
    await page.getByRole('textbox', { name: 'Title' }).fill('   ');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(renameDialog(page)).toBeHidden();
    expect((await dbRecords(page))[0]?.title).toBe('default title source');
  });

  test('SPEC-002 AC12: a failed rename keeps the dialog open with an inline error and the old title; retry works', async ({ page }) => {
    await saveText(page, 'keep my title');
    await openSaved(page);
    await renameButton(page, 'keep my title').click();
    await page.getByRole('textbox', { name: 'Title' }).fill('Changed');
    await setFault(page, 'put', true);
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(renameDialog(page)).toBeVisible();
    await expect(renameDialog(page).getByRole('alert')).toContainText('Couldn’t save the new name');
    expect((await dbRecords(page))[0]?.title).toBe('keep my title');
    await setFault(page, 'put', false);
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(renameDialog(page)).toBeHidden();
    await expect(card(page, 'Changed')).toBeVisible();
  });
});

test.describe('SPEC-002 AC4/AC12: delete', () => {
  test('SPEC-002 AC4: confirmation focuses Cancel; Cancel and Esc keep the record and restore focus; Delete removes it and moves focus on', async ({ page }) => {
    await saveText(page, 'alpha');
    await saveText(page, 'beta');
    await openSaved(page);

    await deleteButton(page, 'beta').click();
    await expect(deleteDialog(page)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cancel' }).last()).toBeFocused();
    await page.keyboard.press('Enter'); // Enter on the focused Cancel must NOT delete
    await expect(deleteDialog(page)).toBeHidden();
    await expect(cards(page)).toHaveCount(2);
    await expect(deleteButton(page, 'beta')).toBeFocused();

    await deleteButton(page, 'beta').click();
    await page.keyboard.press('Escape');
    await expect(cards(page)).toHaveCount(2);
    await expect(deleteButton(page, 'beta')).toBeFocused();

    await deleteButton(page, 'beta').click();
    await deleteDialog(page).getByRole('button', { name: 'Delete' }).click();
    await expect(cards(page)).toHaveCount(1);
    await expect(card(page, 'alpha')).toBeVisible();
    await expect(openButton(page, 'alpha')).toBeFocused(); // focus moves to the nearest surviving card
    expect((await dbRecords(page)).map((r) => r.payload)).toEqual(['alpha']);

    await deleteButton(page, 'alpha').click();
    await deleteDialog(page).getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByRole('heading', { name: 'Nothing saved yet' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create a QR code' })).toBeFocused(); // last one: the empty-state action
  });

  test('SPEC-002 AC12: a failed delete keeps the record and the dialog open with an inline error; retry deletes', async ({ page }) => {
    await saveText(page, 'stubborn');
    await openSaved(page);
    await deleteButton(page, 'stubborn').click();
    await setFault(page, 'delete', true);
    await deleteDialog(page).getByRole('button', { name: 'Delete' }).click();
    await expect(deleteDialog(page)).toBeVisible();
    await expect(deleteDialog(page).getByRole('alert')).toContainText('Couldn’t delete this code');
    expect(await dbRecords(page)).toHaveLength(1);
    await setFault(page, 'delete', false);
    await deleteDialog(page).getByRole('button', { name: 'Delete' }).click();
    await expect(deleteDialog(page)).toBeHidden();
    expect(await dbRecords(page)).toHaveLength(0);
  });
});

test.describe('SPEC-002 AC5/AC6: storage faults never break generation or export', () => {
  test('SPEC-002 AC5: with storage unavailable, generating and downloading still work, Save and Saved explain the problem, and Retry recovers', async ({ page }) => {
    await setFault(page, 'open', true);
    await input(page).fill(URL_TEXT);
    await expect(previewCanvas(page)).toBeVisible();

    const download = page.waitForEvent('download');
    await page.locator('#download').click();
    expect((await download).suggestedFilename()).toMatch(/^qr-.*\.png$/);

    await saveButton(page).click();
    await expect(page.locator('#action-panel').getByRole('alert')).toContainText('Couldn’t save to this device');
    await expect(page.locator('#action-panel')).toContainText('private browsing');
    await expect(page.locator('#action-panel')).toContainText('download or share');
    await expect(saveButton(page)).toHaveText('Save'); // never shows Saved on failure

    await openSaved(page);
    await expect(page.locator('#saved-panel').getByRole('alert')).toContainText('Couldn’t open saved codes');
    await setFault(page, 'open', false);
    await page.getByRole('button', { name: 'Retry' }).click();
    await expect(page.getByRole('heading', { name: 'Nothing saved yet' })).toBeVisible();
    expect(await dbRecords(page)).toHaveLength(0); // the failed save left nothing behind
  });

  test('SPEC-002 AC6: a quota error on save is explained, leaves no record, and Try again works once space is available', async ({ page }) => {
    await setFault(page, 'add', true);
    await input(page).fill(URL_TEXT);
    await expect(previewCanvas(page)).toBeVisible();
    await saveButton(page).click();
    await expect(page.locator('#action-panel').getByRole('alert')).toContainText('enough storage space');
    expect(await dbRecords(page)).toHaveLength(0);
    await setFault(page, 'add', false);
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(saveButton(page)).toHaveText('Saved');
    expect(await dbRecords(page)).toHaveLength(1);
  });
});

test.describe('SPEC-002 AC10/AC14/AC15: responsive, accessible, private', () => {
  async function seed(page: Page): Promise<void> {
    await saveText(page, ARABIC + ' — أهلاً بكم في مقهانا الجديد، لوحة الأسعار');
    await saveText(page, UNBROKEN);
    await saveText(page, LONG_TITLE_TEXT);
  }

  for (const width of [320, 360, 430]) {
    test(`SPEC-002 AC10: Saved list at ${width}px — no overflow, targets >= 48px, actions inside the viewport`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await seed(page);
      await openSaved(page);
      await expect(cards(page)).toHaveCount(3);
      await expectNoHorizontalOverflow(page);
      const controls = page.locator('#saved-body button, .tabs a');
      const count = await controls.count();
      expect(count).toBeGreaterThanOrEqual(12);
      for (let i = 0; i < count; i++) {
        const box = await controls.nth(i).boundingBox();
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
    test(`SPEC-002 AC10: Saved list at 320px with ${percent}% text — no overflow, actions reachable`, async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 700 });
      await seed(page);
      await page.evaluate((p) => {
        document.documentElement.style.fontSize = `${p}%`;
      }, percent);
      await openSaved(page);
      await expect(cards(page)).toHaveCount(3);
      await expectNoHorizontalOverflow(page);
      const buttons = page.locator('#saved-body button');
      const count = await buttons.count();
      for (let i = 0; i < count; i++) {
        const box = await buttons.nth(i).boundingBox();
        if (box) expect(box.x + box.width).toBeLessThanOrEqual(320.5);
      }
      await renameButton(page, LONG_TITLE).scrollIntoViewIfNeeded();
      await expect(renameButton(page, LONG_TITLE)).toBeVisible();
    });
  }

  test('SPEC-002 AC14: axe finds no WCAG 2.x A/AA violations — list, empty, error, rename dialog, delete dialog', async ({ page }) => {
    const scan = async (label: string) => {
      const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
      expect(results.violations, label).toEqual([]);
    };
    await openSaved(page);
    await expect(page.getByRole('heading', { name: 'Nothing saved yet' })).toBeVisible();
    await scan('empty');

    await openGenerate(page);
    await saveText(page, URL_TEXT);
    await saveText(page, ARABIC);
    await openSaved(page);
    await expect(cards(page)).toHaveCount(2);
    await scan('list');

    await renameButton(page, ARABIC).click();
    await expect(renameDialog(page)).toBeVisible();
    await scan('rename dialog');
    await page.keyboard.press('Escape');

    await deleteButton(page, ARABIC).click();
    await expect(deleteDialog(page)).toBeVisible();
    await scan('delete dialog');
    await page.keyboard.press('Escape');

    await setFault(page, 'getAll', true);
    await openGenerate(page);
    await openSaved(page);
    await expect(page.locator('#saved-panel').getByRole('alert')).toBeVisible();
    await scan('error');
  });

  test('SPEC-002 AC14: keyboard-only — Open, Rename, Download, Delete are reachable in order; Enter opens a dialog; Esc returns focus', async ({ page }) => {
    await saveText(page, 'keyboard item');
    await openSaved(page);
    await openButton(page, 'keyboard item').focus();
    await page.keyboard.press('Tab');
    await expect(renameButton(page, 'keyboard item')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Download keyboard item' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(deleteButton(page, 'keyboard item')).toBeFocused(); // Share is absent here: unsupported in desktop Chromium
    await page.keyboard.press('Enter');
    await expect(deleteDialog(page)).toBeVisible();
    // Focus stays inside the modal dialog however many times Tab is pressed (the exact wrap target is browser-defined).
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('Tab');
      expect(await page.evaluate(() => document.activeElement?.closest('dialog[open]') !== null)).toBe(true);
    }
    await page.keyboard.press('Escape');
    await expect(deleteButton(page, 'keyboard item')).toBeFocused();
  });

  test('SPEC-002 AC15: saving, listing, renaming, exporting and deleting send nothing off-device and raise no console or CSP errors', async ({ page }) => {
    const watch = watchPage(page);
    await page.goto('./');
    await saveText(page, URL_TEXT);
    await openSaved(page);
    await expect(cards(page)).toHaveCount(1);
    await renameButton(page, URL_TEXT).click();
    await page.getByRole('textbox', { name: 'Title' }).fill('Menu');
    await page.keyboard.press('Enter');
    await expect(card(page, 'Menu')).toBeVisible();
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download Menu' }).click();
    await download;
    await deleteButton(page, 'Menu').click();
    await deleteDialog(page).getByRole('button', { name: 'Delete' }).click();
    await expect(cards(page)).toHaveCount(0);
    expect(watch.external).toEqual([]);
    expect(watch.failures).toEqual([]);
    expect(watch.problems).toEqual([]);
  });
});
