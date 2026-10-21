// Shared helpers for the PWA browser tests (SPEC-004).
import { expect, type Page } from '@playwright/test';

/** Resolves once a service worker is active AND controls this page (so offline reloads will be served by it). */
export async function waitForServiceWorker(page: Page): Promise<void> {
  await page.waitForFunction(
    async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      return !!registration?.active && registration.active.state === 'activated' && !!navigator.serviceWorker.controller;
    },
    undefined,
    { timeout: 30_000 },
  );
}

export interface CacheEntry {
  cache: string;
  url: string;
  type: string;
  /** Present only for text-like responses. */
  text: string | null;
}

/** Everything in Cache Storage (URLs and, for text-like entries, bodies) as seen from the page. */
export async function readCaches(page: Page): Promise<CacheEntry[]> {
  return page.evaluate(async () => {
    const entries: CacheEntry[] = [];
    for (const name of await caches.keys()) {
      const cache = await caches.open(name);
      for (const request of await cache.keys()) {
        const response = await cache.match(request);
        const type = response?.headers.get('content-type') ?? '';
        const textual = /text|javascript|json|svg|manifest/.test(type);
        entries.push({ cache: name, url: request.url, type, text: textual && response ? await response.clone().text() : null });
      }
    }
    return entries;
  });
}

/** Dispatches a synthetic `beforeinstallprompt` (Chromium-only in reality) and reports whether it was deferred. */
export async function fireInstallPrompt(page: Page, outcome: 'accepted' | 'dismissed' = 'accepted'): Promise<boolean> {
  return page.evaluate((choice) => {
    const event = new Event('beforeinstallprompt', { cancelable: true }) as Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
    event.prompt = async () => {
      const w = window as unknown as { __promptCalls?: number };
      w.__promptCalls = (w.__promptCalls ?? 0) + 1;
    };
    event.userChoice = Promise.resolve({ outcome: choice });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  }, outcome);
}

export const installBar = (page: Page) => page.locator('[data-notice="install"]');
export const updateBar = (page: Page) => page.locator('[data-notice="update"]');
export const offlineBar = (page: Page) => page.locator('[data-notice="offline"]');
export const readyBar = (page: Page) => page.locator('[data-notice="ready"]');

export async function installStateInStorage(page: Page): Promise<Record<string, number>> {
  return page.evaluate(() => JSON.parse(localStorage.getItem('qr-pocket.install') ?? '{}') as Record<string, number>);
}

export async function expectBuild(page: Page, build: string): Promise<void> {
  await expect(page.locator('html')).toHaveAttribute('data-build', build);
}
