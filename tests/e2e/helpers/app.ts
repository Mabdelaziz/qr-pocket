// Shared locators and browser-side fault injection for the Phase 3 browser tests (SPEC-002, SPEC-003).
import { expect, type Locator, type Page } from '@playwright/test';

export const ORIGIN = 'http://127.0.0.1:4173/qr-pocket/';

export const input = (page: Page): Locator => page.getByLabel('Text or link');
export const saveButton = (page: Page): Locator => page.locator('#save');
export const downloadButton = (page: Page): Locator => page.locator('#download');
export const shareButton = (page: Page): Locator => page.locator('#share');
export const previewCanvas = (page: Page): Locator => page.getByRole('img', { name: 'QR code for the text you entered' });
// Real cards only: skeleton placeholders share the .scard class but have no data-id.
export const cards = (page: Page): Locator => page.locator('#saved-body .scard[data-id]');
export const card = (page: Page, text: string): Locator => page.locator('#saved-body .scard[data-id]', { hasText: text });
export const navLink = (page: Page, name: 'Generate' | 'Saved'): Locator => page.getByRole('link', { name, exact: true });

export type Fault = 'open' | 'add' | 'put' | 'delete' | 'getAll';

/**
 * Wraps the REAL IndexedDB prototype methods so a test can make them fail like a blocked, full or broken
 * store would (SecurityError on open, QuotaExceededError on add, UnknownError otherwise). Off by default.
 */
export async function installFaultInjector(page: Page): Promise<void> {
  await page.addInitScript(() => {
    // Deterministic across platforms: native Web Share exists on some desktop browsers. Tests that need sharing install a stub afterwards.
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: undefined });
    const w = window as unknown as { __fail: Record<string, boolean> };
    w.__fail = {};
    const store = IDBObjectStore.prototype as unknown as Record<string, (...args: unknown[]) => unknown>;
    const methods: Array<[string, string]> = [
      ['add', 'QuotaExceededError'],
      ['put', 'UnknownError'],
      ['delete', 'UnknownError'],
      ['getAll', 'UnknownError'],
    ];
    for (const [method, errorName] of methods) {
      const original = store[method];
      if (!original) continue;
      store[method] = function (this: unknown, ...args: unknown[]) {
        if (w.__fail[method]) throw new DOMException('injected fault', errorName);
        return original.apply(this, args);
      };
    }
    const factory = IDBFactory.prototype as unknown as { open: (...args: unknown[]) => unknown };
    const open = factory.open;
    factory.open = function (this: unknown, ...args: unknown[]) {
      if (w.__fail['open']) throw new DOMException('injected fault', 'SecurityError');
      return open.apply(this, args);
    };
  });
}

export async function setFault(page: Page, fault: Fault, on: boolean): Promise<void> {
  await page.evaluate(([name, value]) => {
    (window as unknown as { __fail: Record<string, boolean> }).__fail[name as string] = value as boolean;
  }, [fault, on] as const);
}

export interface RawRecord {
  id: string;
  title: string;
  payload: string;
  ecc: string;
  source: string;
  createdAt: number;
  updatedAt: number;
  v: number;
}

/** Reads the real database directly (not through the app) so persistence is checked independently. */
export async function dbRecords(page: Page): Promise<RawRecord[]> {
  return page.evaluate(
    () =>
      new Promise<RawRecord[]>((resolve, reject) => {
        // Never create the database as a side effect of looking: check that it exists first.
        indexedDB.databases().then((databases) => {
          if (!databases.some((d) => d.name === 'qr-pocket')) {
            resolve([]);
            return;
          }
          const open = indexedDB.open('qr-pocket');
          open.onerror = () => reject(open.error);
          open.onsuccess = () => {
            const db = open.result;
            if (!db.objectStoreNames.contains('codes')) {
              db.close();
              resolve([]);
              return;
            }
            const request = db.transaction('codes', 'readonly').objectStore('codes').getAll();
            request.onsuccess = () => {
              db.close();
              resolve(request.result as RawRecord[]);
            };
            request.onerror = () => reject(request.error);
          };
        }, reject);
      }),
  );
}

/** Type text, wait for the QR, press Save and wait for the saved state. */
export async function saveText(page: Page, text: string): Promise<void> {
  await input(page).fill(text);
  await expect(previewCanvas(page)).toBeVisible();
  await expect(saveButton(page)).toHaveAttribute('aria-disabled', 'false');
  await saveButton(page).click();
  await expect(saveButton(page)).toHaveText('Saved');
}

export async function openSaved(page: Page): Promise<void> {
  await navLink(page, 'Saved').click();
  await expect(page.getByRole('heading', { name: 'Saved codes', level: 1 })).toBeVisible();
}

export async function openGenerate(page: Page): Promise<void> {
  await navLink(page, 'Generate').click();
  await expect(page.getByRole('heading', { name: 'Create a QR code', level: 1 })).toBeVisible();
}

export async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

/** Collects console errors, page errors, failed requests and non-origin requests for privacy/CSP checks. */
export function watchPage(page: Page): { problems: string[]; external: string[]; failures: string[] } {
  const problems: string[] = [];
  const external: string[] = [];
  const failures: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(`console error: ${m.text()}`);
  });
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('request', (r) => {
    if (!r.url().startsWith(ORIGIN) && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) external.push(r.url());
  });
  page.on('requestfailed', (r) => failures.push(r.url()));
  return { problems, external, failures };
}
