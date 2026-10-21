// What may be published (SPEC-005 AC6): a pure scanner over the files of `dist`, plus the build stamp.
// Used by scripts/check-public-files.mjs (CI) and unit-tested with planted problems.
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, relative, sep } from 'node:path';

export const ALLOWED_EXTENSIONS = ['.html', '.js', '.css', '.svg', '.png', '.webmanifest', '.json'];
const TEXT_EXTENSIONS = new Set(['.html', '.js', '.css', '.svg', '.webmanifest', '.json']);

/** Absolute URLs that may appear in published text: XML namespace identifiers are labels, not requests. */
export const URL_ALLOW_LIST = ['http://www.w3.org/'];

const SECRET_PATTERNS = [
  ['GitHub token', /\bgh[pousr]_[A-Za-z0-9]{30,}\b/],
  ['GitHub fine-grained token', /\bgithub_pat_[A-Za-z0-9_]{20,}\b/],
  ['AWS access key id', /\bAKIA[0-9A-Z]{16}\b/],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{35}\b/],
  ['Slack token', /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/],
  ['private key block', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
];
const LOCAL_PATH_PATTERNS = [/[A-Za-z]:\\(?:Users|ClaudProjects)\\/, /\/home\/(?:runner|[a-z][\w-]*)\//, /\/Users\/[A-Za-z][\w.-]*\//];
const EMAIL = /\b[\w.+-]+@[A-Za-z0-9-]+\.[A-Za-z]{2,}\b/;
const URL_PATTERN = /https?:\/\/[^\s"'`)<>\\]+/g;
const FULL_SHA = /^[0-9a-f]{40}$/;

/** `files`: [{ path: 'assets/x.js', data: Buffer }] with forward-slash paths relative to dist. Returns problems (empty = OK). */
export function scanFiles(files, { expectedCommit, requireStamp = true } = {}) {
  const problems = [];
  const urls = new Set();
  for (const { path, data } of files) {
    const ext = extname(path).toLowerCase();
    const name = path.split('/').pop() ?? path;
    if (name.startsWith('.')) problems.push(`${path}: dot files must not be published`);
    if (ext === '.map') problems.push(`${path}: source maps must not be published`);
    else if (!ALLOWED_EXTENSIONS.includes(ext)) problems.push(`${path}: file type "${ext || '(none)'}" is not allowed`);
    if (ext === '.json' && path !== 'version.json') problems.push(`${path}: only version.json may be published as JSON`);
    if (!TEXT_EXTENSIONS.has(ext)) continue;
    const text = data.toString('utf8');
    for (const [label, pattern] of SECRET_PATTERNS) if (pattern.test(text)) problems.push(`${path}: looks like a secret (${label})`);
    for (const pattern of LOCAL_PATH_PATTERNS) if (pattern.test(text)) problems.push(`${path}: contains a local file path (${pattern})`);
    if (EMAIL.test(text)) problems.push(`${path}: contains an e-mail address`);
    for (const url of text.match(URL_PATTERN) ?? []) {
      if (!URL_ALLOW_LIST.some((prefix) => url.startsWith(prefix))) urls.add(`${path}: ${url}`);
    }
  }
  for (const entry of [...urls].sort()) problems.push(`unexpected absolute URL ${entry}`);

  const stamp = files.find((f) => f.path === 'version.json');
  if (!stamp) {
    if (requireStamp) problems.push('version.json is missing (run scripts/stamp-build.mjs after the build)');
  } else {
    try {
      const value = JSON.parse(stamp.data.toString('utf8'));
      if (value.app !== 'qr-pocket') problems.push('version.json: "app" must be "qr-pocket"');
      if (typeof value.commit !== 'string' || !(FULL_SHA.test(value.commit) || value.commit === 'local')) problems.push('version.json: "commit" must be a 40-character commit id (or "local")');
      if (expectedCommit && value.commit !== expectedCommit) problems.push(`version.json: commit ${value.commit} is not the expected ${expectedCommit}`);
    } catch {
      problems.push('version.json: not valid JSON');
    }
  }
  return problems;
}

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

export function readDir(dir) {
  return walk(dir).map((file) => ({ path: relative(dir, file).split(sep).join('/'), data: readFileSync(file) }));
}

/** The build stamp: which commit these bytes were built from. Contains nothing sensitive (all public in the repository). */
export function buildStamp(env = process.env) {
  const sha = env.GITHUB_SHA ?? '';
  return {
    app: 'qr-pocket',
    commit: FULL_SHA.test(sha) ? sha : 'local',
    ref: env.GITHUB_REF ?? 'local',
    run: /^\d+$/.test(env.GITHUB_RUN_ID ?? '') ? env.GITHUB_RUN_ID : 'local',
  };
}

export function writeStamp(dir, env = process.env) {
  const stamp = buildStamp(env);
  writeFileSync(join(dir, 'version.json'), `${JSON.stringify(stamp, null, 2)}\n`);
  return stamp;
}
