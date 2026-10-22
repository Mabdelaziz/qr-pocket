// Emergency recovery path (docs/SW_RECOVERY.md, SPEC-005): if the marker file recovery/KILL_SWITCH is committed, the
// emergency worker replaces dist/sw.js in the artifact that CI uploads for deployment. Without the marker nothing happens.
// It runs AFTER the tests on purpose (the browser tests need the normal worker), so a recovery deployment is the one
// documented case where published bytes differ from tested bytes; the change is a reviewed pull request, the emergency
// worker itself has its own test (tests/e2e/update.spec.ts), and version.json says so ("recovery": "kill-switch").
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const MARKER = 'recovery/KILL_SWITCH';
export const KILL_SWITCH = 'docs/recovery/kill-switch-sw.js';

/** Returns true if the kill switch was applied. */
export function applyKillSwitch({ root = '.', dist = 'dist' } = {}) {
  if (!existsSync(join(root, MARKER))) return false;
  copyFileSync(join(root, KILL_SWITCH), join(root, dist, 'sw.js'));
  const file = join(root, dist, 'version.json');
  const stamp = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
  writeFileSync(file, `${JSON.stringify({ ...stamp, recovery: 'kill-switch' }, null, 2)}\n`);
  return true;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (applyKillSwitch()) console.log('::warning::RECOVERY BUILD: dist/sw.js is the kill-switch worker (recovery/KILL_SWITCH exists).');
  else console.log('No recovery marker: the tested dist is published unchanged.');
}
