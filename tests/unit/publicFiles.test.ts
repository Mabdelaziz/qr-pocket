// SPEC-005 AC6/AC7: what may be published, the build stamp, and the live-site check. Secret-like strings are assembled
// at run time so this file itself never contains anything a secret scanner would flag.
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { checkLive } from '../../scripts/live-check.mjs';
import { buildStamp, scanFiles, writeStamp, type PublicFile } from '../../scripts/public-files.mjs';

const SHA = 'a'.repeat(40);
const OTHER_SHA = 'b'.repeat(40);
const file = (path: string, text: string): PublicFile => ({ path, data: Buffer.from(text) });
const stamp = (commit = SHA): PublicFile => file('version.json', JSON.stringify({ app: 'qr-pocket', commit, ref: 'refs/heads/main', run: '1' }));
const good: PublicFile[] = [
  file('index.html', '<!doctype html><title>QR Pocket</title>'),
  file('assets/index-abc.js', 'const ns="http://www.w3.org/2000/svg";export{ns}'),
  file('assets/index-abc.css', 'body{margin:0}'),
  file('manifest.webmanifest', '{"scope":"/qr-pocket/"}'),
  file('icons/icon-192.png', 'binary'),
  stamp(),
];
const withoutStamp = good.filter((f) => f.path !== 'version.json');

describe('SPEC-005 AC6: public-file scan', () => {
  it('accepts a clean build with a stamp', () => {
    expect(scanFiles(good, { expectedCommit: SHA })).toEqual([]);
  });

  it('rejects source maps, dot files, sources and other unexpected file types', () => {
    const problems = scanFiles([...good, file('assets/index-abc.js.map', '{}'), file('.env', 'X=1'), file('src/main.ts', ''), file('notes.md', ''), file('data.json', '{}')]).join('\n');
    expect(problems).toMatch(/index-abc\.js\.map: source maps/);
    expect(problems).toMatch(/\.env: dot files/);
    expect(problems).toMatch(/main\.ts: file type "\.ts"/);
    expect(problems).toMatch(/notes\.md: file type "\.md"/);
    expect(problems).toMatch(/data\.json: only version\.json/);
  });

  it.each([
    ['a GitHub token', () => 'ghp_' + 'A1b2'.repeat(9)],
    ['a fine-grained token', () => 'github_pat_' + 'x'.repeat(30)],
    ['an AWS key id', () => 'AKIA' + 'Q'.repeat(16)],
    ['a private key', () => '-----BEGIN ' + 'RSA' + ' PRIVATE KEY-----'],
    ['a Slack token', () => 'xoxb-' + '1'.repeat(12)],
  ])('rejects %s', (_label, make) => {
    expect(scanFiles([...good, file('assets/leak.js', `const k="${make()}"`)]).join('\n')).toMatch(/leak\.js: looks like a secret/);
  });

  it.each([
    ['a Windows user path', 'C:\\' + 'Users\\someone\\app'],
    ['the project folder', 'D:\\' + 'ClaudProjects\\qr-pocket'],
    ['a runner path', '/home/' + 'runner/work/qr-pocket'],
    ['a macOS path', '/Users/' + 'someone/code'],
  ])('rejects %s', (_label, path) => {
    expect(scanFiles([...good, file('assets/x.js', `"${path}"`)]).join('\n')).toMatch(/x\.js: contains a local file path/);
  });

  it('rejects an e-mail address', () => {
    expect(scanFiles([...good, file('index.html', 'contact ' + 'someone' + '@' + 'example' + '.com')]).join('\n')).toMatch(/index\.html: contains an e-mail/);
  });

  it('rejects absolute URLs other than the W3C namespace identifiers (nothing may phone home)', () => {
    const problems = scanFiles([...good, file('assets/y.js', 'fetch("https://tracker.example/collect?q=1")')]);
    expect(problems).toEqual(['unexpected absolute URL assets/y.js: https://tracker.example/collect?q=1']);
  });

  it('allows only the exact documentation link found in Workbox, not other links on the same host', () => {
    expect(scanFiles([...good, file('workbox-1.js', 'see https://bit.ly/wb-precache for details')])).toEqual([]);
    expect(scanFiles([...good, file('workbox-1.js', 'x https://bit.ly/wb-precacheX')])).toEqual(['unexpected absolute URL workbox-1.js: https://bit.ly/wb-precacheX']);
    expect(scanFiles([...good, file('workbox-1.js', 'x HTTPS://tracker.example/a')])).toHaveLength(1);
    expect(scanFiles([...good, file('workbox-1.js', 'fetch("https://bit.ly/other")')])).toEqual(['unexpected absolute URL workbox-1.js: https://bit.ly/other']);
  });

  it('requires a valid stamp that matches the commit being built', () => {
    expect(scanFiles(withoutStamp).join('\n')).toMatch(/version\.json is missing/);
    expect(scanFiles([...withoutStamp, file('version.json', 'nope')]).join('\n')).toMatch(/not valid JSON/);
    expect(scanFiles([...withoutStamp, stamp('main')]).join('\n')).toMatch(/40-character/);
    expect(scanFiles([...withoutStamp, stamp(OTHER_SHA)], { expectedCommit: SHA }).join('\n')).toMatch(/is not the expected/);
  });
});

describe('SPEC-005 AC6: build stamp', () => {
  const dirs: string[] = [];
  afterAll(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));

  it('records the commit, ref and run of CI', () => {
    expect(buildStamp({ GITHUB_SHA: SHA, GITHUB_REF: 'refs/heads/main', GITHUB_RUN_ID: '42' })).toEqual({ app: 'qr-pocket', commit: SHA, ref: 'refs/heads/main', run: '42' });
  });

  it('is clearly marked local outside CI and never copies malformed values', () => {
    expect(buildStamp({})).toEqual({ app: 'qr-pocket', commit: 'local', ref: 'local', run: 'local' });
    const odd = buildStamp({ GITHUB_SHA: 'not-a-sha', GITHUB_RUN_ID: '1; rm -rf' });
    expect(odd.commit).toBe('local');
    expect(odd.run).toBe('local');
  });

  it('writes dist/version.json that the scanner accepts', () => {
    const dir = mkdtempSync(join(tmpdir(), 'stamp-'));
    dirs.push(dir);
    writeStamp(dir, { GITHUB_SHA: SHA, GITHUB_REF: 'refs/heads/main', GITHUB_RUN_ID: '7' });
    const text = readFileSync(join(dir, 'version.json'), 'utf8');
    expect(scanFiles([file('version.json', text)], { expectedCommit: SHA })).toEqual([]);
  });
});

describe('SPEC-005 AC7: live-site check', () => {
  const BASE = 'https://example.github.io/qr-pocket/';
  const manifest = { id: '/qr-pocket/', scope: '/qr-pocket/', start_url: '/qr-pocket/', display: 'standalone', icons: [{ src: 'icons/icon-512.png', sizes: '512x512', purpose: 'any' }] };
  type Site = Record<string, { status?: number; type?: string; body?: unknown }>;
  const siteFetch = (site: Site): typeof fetch =>
    (async (input: URL | RequestInfo) => {
      const path = new URL(String(input)).pathname.replace('/qr-pocket/', '');
      const entry = site[path];
      if (!entry) return new Response('missing', { status: 404 });
      const body = typeof entry.body === 'string' ? entry.body : JSON.stringify(entry.body ?? {});
      return new Response(body, { status: entry.status ?? 200, headers: { 'content-type': entry.type ?? 'application/json' } });
    }) as typeof fetch;
  const healthy = (): Site => ({
    '': { type: 'text/html', body: '<html><head><title>QR Pocket</title></head></html>' },
    'version.json': { body: { app: 'qr-pocket', commit: SHA, run: '99' } },
    'manifest.webmanifest': { type: 'application/manifest+json', body: manifest },
    'sw.js': { type: 'text/javascript', body: 'self.skipWaiting' },
    'icons/icon-512.png': { type: 'image/png', body: 'png' },
  });

  it('passes for the verified commit with a correct manifest, worker and icon', async () => {
    expect(await checkLive({ baseUrl: BASE, commit: SHA, fetchImpl: siteFetch(healthy()) })).toEqual([]);
  });

  it('rejects an older deployment of the same commit and a foreign start page; tolerates a missing trailing slash', async () => {
    expect((await checkLive({ baseUrl: BASE, commit: SHA, runId: '100', fetchImpl: siteFetch(healthy()) })).join('\n')).toMatch(/live run 99 is not this run 100/);
    expect(await checkLive({ baseUrl: BASE, commit: SHA, runId: '99', fetchImpl: siteFetch(healthy()) })).toEqual([]);
    expect(await checkLive({ baseUrl: BASE.slice(0, -1), commit: SHA, fetchImpl: siteFetch(healthy()) })).toEqual([]);
    const foreign = healthy();
    foreign[''] = { type: 'text/html', body: '<title>Other</title>' };
    expect((await checkLive({ baseUrl: BASE, commit: SHA, fetchImpl: siteFetch(foreign) })).join('\n')).toMatch(/does not look like QR Pocket/);
  });

  it('fails for a different commit (stale or wrong deployment)', async () => {
    const problems = await checkLive({ baseUrl: BASE, commit: OTHER_SHA, fetchImpl: siteFetch(healthy()) });
    expect(problems.join('\n')).toMatch(/is not the verified commit/);
  });

  it('fails for plain HTTP, a wrong path, a wrong scope, a missing worker and a broken icon', async () => {
    expect((await checkLive({ baseUrl: 'http://example.github.io/qr-pocket/', commit: SHA, fetchImpl: siteFetch(healthy()) })).join('\n')).toMatch(/HTTPS/);
    expect((await checkLive({ baseUrl: 'https://example.github.io/', commit: SHA, fetchImpl: siteFetch(healthy()) })).join('\n')).toMatch(/must live at \/qr-pocket\//);
    const bad = healthy();
    bad['manifest.webmanifest'] = { body: { ...manifest, scope: '/' } };
    delete bad['sw.js'];
    bad['icons/icon-512.png'] = { status: 404 };
    const problems = (await checkLive({ baseUrl: BASE, commit: SHA, fetchImpl: siteFetch(bad) })).join('\n');
    expect(problems).toMatch(/manifest: scope is \//);
    expect(problems).toMatch(/sw\.js: HTTP 404/);
    expect(problems).toMatch(/icon-512\.png: HTTP 404/);
  });

  it('reports a network failure instead of throwing', async () => {
    const failing = (async () => {
      throw new Error('offline');
    }) as typeof fetch;
    expect((await checkLive({ baseUrl: BASE, commit: SHA, fetchImpl: failing })).join('\n')).toMatch(/request failed \(offline\)/);
  });
});
