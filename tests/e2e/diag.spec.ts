// TEMPORARY DIAGNOSTIC (to be removed): how soon after "active + controlling" does an OFFLINE reload work?
// Question: is "Ready to work offline" (shown when serviceWorker.ready resolves) truthful at that instant?
import { expect, test } from '@playwright/test';

test.use({ serviceWorkers: 'allow' });
test.describe.configure({ timeout: 120_000 });

test('DIAG: offline reload timing after the first service-worker activation', async ({ browser }) => {
  const lines: string[] = [];
  for (const delayMs of [0, 0, 250, 1000, 3000]) {
    const context = await browser.newContext({ serviceWorkers: 'allow' });
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:4173/qr-pocket/');
    const t0 = Date.now();
    await page.waitForFunction(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      return !!registration?.active && registration.active.state === 'activated' && !!navigator.serviceWorker.controller;
    });
    const waited = Date.now() - t0;
    if (delayMs) await page.waitForTimeout(delayMs);
    const state = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      const registrations = await navigator.serviceWorker.getRegistrations();
      const names = await caches.keys();
      let entries = 0;
      for (const n of names) entries += (await (await caches.open(n)).keys()).length;
      return {
        active: registration?.active?.state ?? null,
        waiting: registration?.waiting?.state ?? null,
        installing: registration?.installing?.state ?? null,
        registrationsActive: registrations.map((r) => r.active?.state ?? null),
        controller: navigator.serviceWorker.controller?.state ?? null,
        caches: names,
        entries,
      };
    });
    await context.setOffline(true);
    let outcome = 'reload ok';
    try {
      await page.reload({ timeout: 8000 });
      await expect(page.getByRole('heading', { name: 'Create a QR code', level: 1 })).toBeVisible({ timeout: 5000 });
    } catch (error) {
      outcome = `FAILED: ${String(error).split('\n')[0]}`;
    }
    lines.push(`delay=${delayMs}ms waitedForActivation=${waited}ms state=${JSON.stringify(state)} -> ${outcome}`);
    await context.close();
  }
  console.log('\nDIAG-RESULT\n' + lines.join('\n') + '\nEND-DIAG-RESULT');
  expect(lines.length).toBe(5);
});
