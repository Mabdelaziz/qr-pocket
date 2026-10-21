// Licence gate for PRODUCTION dependencies (SPEC-005). Walks package.json "dependencies" and their
// transitive "dependencies" in node_modules, and fails on any licence outside the allow-list.
// Dev dependencies are not shipped to users and are not checked here.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, parse } from 'node:path';

const ALLOWED = new Set(['MIT', 'ISC', 'BSD-2-Clause', 'BSD-3-Clause', 'Apache-2.0', '0BSD', 'CC0-1.0', 'Unlicense']);

function findPackageDir(name, fromDir) {
  let dir = fromDir;
  for (;;) {
    const candidate = join(dir, 'node_modules', name);
    if (existsSync(join(candidate, 'package.json'))) return candidate;
    const parent = dirname(dir);
    if (parent === dir || dir === parse(dir).root) return undefined;
    dir = parent;
  }
}

const root = JSON.parse(readFileSync('package.json', 'utf8'));
const seen = new Map();
const problems = [];

function visit(name, fromDir) {
  const dir = findPackageDir(name, fromDir);
  if (!dir) {
    problems.push(`${name}: not installed (run npm ci first)`);
    return;
  }
  const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
  const key = `${pkg.name}@${pkg.version}`;
  if (seen.has(key)) return;
  const license = typeof pkg.license === 'string' ? pkg.license : (pkg.license?.type ?? 'UNKNOWN');
  seen.set(key, license);
  if (!ALLOWED.has(license)) problems.push(`${key}: licence "${license}" is not on the allow-list`);
  for (const dep of Object.keys(pkg.dependencies ?? {})) visit(dep, dir);
}

for (const dep of Object.keys(root.dependencies ?? {})) visit(dep, process.cwd());

for (const [pkg, license] of seen) console.log(`${pkg.padEnd(40)} ${license}`);
if (problems.length > 0) {
  console.error('\nLicence check FAILED:\n' + problems.map((p) => ` - ${p}`).join('\n'));
  process.exit(1);
}
console.log(`\nLicence check passed for ${seen.size} production package(s).`);
