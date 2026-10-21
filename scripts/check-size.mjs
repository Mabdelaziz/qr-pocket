// Initial-load budget check (SPEC-005, SPEC-004 AC15; owner target: 150 KB gzip). Run after `npm run build`.
// Initial load = what a first visit downloads to show the app: HTML + JS + CSS (gzip level 9), EXCLUDING the
// service worker and Workbox runtime, which install in the background. Those are reported separately, together
// with everything the worker precaches. Writes size-report.txt and fails only if the initial load exceeds the budget.
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import { gzipSync } from 'node:zlib';

const BUDGET_BYTES = 150 * 1024;
const DIST = 'dist';
const CODE = /\.(html|js|mjs|css)$/;
const isWorker = (file) => /^(sw|workbox-[\w-]+)\.js$/.test(basename(file));

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

let files;
try {
  files = walk(DIST);
} catch {
  console.error(`No ${DIST}/ directory. Run "npm run build" first.`);
  process.exit(1);
}

const kb = (n) => (n / 1024).toFixed(2);
const row = (file) => {
  const raw = readFileSync(file);
  const gz = gzipSync(raw, { level: 9 }).length;
  return { name: relative(DIST, file).replaceAll('\\', '/'), raw: raw.length, gz };
};

const initial = files.filter((f) => CODE.test(f) && !isWorker(f)).map(row);
const workers = files.filter((f) => CODE.test(f) && isWorker(f)).map(row);
const others = files.filter((f) => !CODE.test(f)).map((f) => ({ name: relative(DIST, f).replaceAll('\\', '/'), raw: statSync(f).size }));
const sum = (rows, key) => rows.reduce((total, r) => total + r[key], 0);

const line = (r) => `${r.name.padEnd(40)} raw ${kb(r.raw).padStart(8)} KB   gzip ${kb(r.gz).padStart(8)} KB`;
const lines = [
  'INITIAL LOAD (HTML + JS + CSS)',
  ...initial.map(line),
  `TOTAL initial gzip ${kb(sum(initial, 'gz'))} KB (budget ${kb(BUDGET_BYTES)} KB)`,
  '',
  'SERVICE WORKER + WORKBOX RUNTIME (background install, not part of the initial load)',
  ...workers.map(line),
  `TOTAL worker gzip ${kb(sum(workers, 'gz'))} KB`,
  '',
  'OTHER FILES (icons, manifest, ...)',
  ...others.map((r) => `${r.name.padEnd(40)} raw ${kb(r.raw).padStart(8)} KB`),
  '',
  `PRECACHE DOWNLOAD (everything above, uncompressed): ${kb(sum(initial, 'raw') + sum(workers, 'raw') + sum(others, 'raw'))} KB`,
];
writeFileSync('size-report.txt', lines.join('\n') + '\n');
console.log(lines.join('\n'));

if (sum(initial, 'gz') > BUDGET_BYTES) {
  console.error('Initial-load budget exceeded.');
  process.exit(1);
}
