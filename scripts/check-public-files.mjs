// Fails if `dist` contains anything that must not be public (SPEC-005 AC6). Run after stamp-build.mjs.
import { readDir, scanFiles } from './public-files.mjs';

let files;
try {
  files = readDir('dist');
} catch {
  console.error('No dist/ directory. Run "npm run build" first.');
  process.exit(1);
}
const expectedCommit = /^[0-9a-f]{40}$/.test(process.env.GITHUB_SHA ?? '') ? process.env.GITHUB_SHA : undefined;
const problems = scanFiles(files, { expectedCommit });
console.log(`Scanned ${files.length} public files in dist/.`);
for (const file of files.map((f) => f.path).sort()) console.log(`  ${file}`);
if (problems.length > 0) {
  console.error(`\n${problems.length} problem(s):`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log('Public-file check passed.');
