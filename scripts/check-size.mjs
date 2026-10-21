// Initial-load budget check (SPEC-005, owner target: 150 KB gzip). Run after `npm run build`.
// Measures every file Vite emitted that a first load needs (HTML + JS + CSS), gzip level 9,
// writes size-report.txt, and fails if the total exceeds the budget.
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { gzipSync } from 'node:zlib';

const BUDGET_BYTES = 150 * 1024;
const DIST = 'dist';
const COUNTED = /\.(html|js|mjs|css)$/;

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

let files;
try {
  files = walk(DIST).filter((f) => COUNTED.test(f));
} catch {
  console.error(`No ${DIST}/ directory. Run "npm run build" first.`);
  process.exit(1);
}

let total = 0;
const rows = files.map((file) => {
  const raw = readFileSync(file);
  const gz = gzipSync(raw, { level: 9 }).length;
  total += gz;
  return { file: relative(DIST, file).replaceAll('\\', '/'), raw: raw.length, gz };
});

const kb = (n) => (n / 1024).toFixed(2);
const lines = [
  ...rows.map((r) => `${r.file.padEnd(40)} raw ${kb(r.raw).padStart(8)} KB   gzip ${kb(r.gz).padStart(8)} KB`),
  `TOTAL gzip ${kb(total)} KB (budget ${kb(BUDGET_BYTES)} KB)`,
];
writeFileSync('size-report.txt', lines.join('\n') + '\n');
console.log(lines.join('\n'));

if (total > BUDGET_BYTES) {
  console.error('Initial-load budget exceeded.');
  process.exit(1);
}
