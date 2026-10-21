// SPEC-005 AC2-AC5: the workflow files are checked statically (nothing here runs a workflow). The YAML is simple and
// regular, so small text helpers are enough and no YAML dependency is needed.
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const DIR = resolve('.github/workflows');
const files = readdirSync(DIR).filter((f) => /\.ya?ml$/.test(f));
const read = (name: string): string => readFileSync(resolve(DIR, name), 'utf8');
const deploy = read('deploy.yml');
const ci = read('ci.yml');

/** Text of each job under `jobs:` keyed by job id (a job starts at a two-space-indented key). */
function jobs(text: string): Record<string, string> {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => l === 'jobs:');
  expect(start, 'jobs: block').toBeGreaterThan(-1);
  const out: Record<string, string[]> = {};
  let current: string[] | undefined;
  for (const line of lines.slice(start + 1)) {
    const key = /^ {2}([\w-]+):\s*$/.exec(line);
    if (key?.[1]) {
      current = out[key[1]] = [];
    } else if (current) current.push(line);
  }
  return Object.fromEntries(Object.entries(out).map(([id, body]) => [id, body.join('\n')]));
}

/** The top-level block with this key (everything up to the next top-level key). */
function topLevel(text: string, key: string): string {
  const match = new RegExp(`^${key}:[^\\n]*\\n((?: {2}.*\\n|\\s*\\n)*)`, 'm').exec(text);
  expect(match, `top-level "${key}:"`).not.toBeNull();
  return match?.[0] ?? '';
}

/** The text of every `run:` step (single line or block scalar). */
function runBlocks(text: string): string[] {
  const lines = text.split('\n');
  const blocks: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = /^(\s*)(?:- )?run:\s*(.*)$/.exec(lines[i] ?? '');
    if (!m) continue;
    const indent = (m[1] ?? '').length;
    const value = m[2] ?? '';
    if (value === '|' || value === '>') {
      const body: string[] = [];
      for (let j = i + 1; j < lines.length; j++) {
        const next = lines[j] ?? '';
        if (next.trim() !== '' && next.length - next.trimStart().length <= indent) break;
        body.push(next);
      }
      blocks.push(body.join('\n'));
    } else blocks.push(value);
  }
  return blocks;
}

describe('SPEC-005 AC2: deploy.yml can only be started by hand and only deploys main', () => {
  it('has exactly one trigger: workflow_dispatch (no push, pull_request, schedule, workflow_run)', () => {
    const on = topLevel(deploy, 'on');
    expect(on).toMatch(/^ {2}workflow_dispatch:/m);
    expect(on.match(/^ {2}[\w_]+:/gm)).toHaveLength(1);
    expect(on).not.toMatch(/inputs:/); // nothing to choose at dispatch time, in particular no ref or environment
  });

  it('starts with a guard that fails for any ref except refs/heads/main', () => {
    const guard = jobs(deploy)['guard'] ?? '';
    expect(guard).toMatch(/!=\s*"refs\/heads\/main"/);
    expect(guard).toContain('exit 1');
  });

  it('every other job waits for the guard (directly or through the chain)', () => {
    const all = jobs(deploy);
    expect(Object.keys(all)).toEqual(['guard', 'verify', 'deploy', 'check-live']);
    expect(all['verify']).toMatch(/needs: guard/);
    expect(all['deploy']).toMatch(/needs: \[guard, verify\]/);
    expect(all['check-live']).toMatch(/needs: deploy/);
  });

  it('verifies with the very same CI workflow that pull requests run', () => {
    expect(jobs(deploy)['verify']).toContain('uses: ./.github/workflows/ci.yml');
    expect(topLevel(ci, 'on')).toMatch(/^ {2}workflow_call:/m);
    expect(topLevel(ci, 'on')).toMatch(/^ {2}pull_request:/m);
  });
});

describe('SPEC-005 AC3: least privilege', () => {
  it.each(files)('%s: workflow-level permissions are read-only contents and nothing else', (name) => {
    const block = topLevel(read(name), 'permissions').trim().split('\n');
    expect(block.map((l) => l.trim())).toEqual(['permissions:', 'contents: read']);
  });

  it('only the deploy job may write, and only pages and id-token', () => {
    const writes = files.flatMap((name) => (read(name).match(/^\s*[\w-]+: write\b/gm) ?? []).map((w) => `${name}:${w.trim()}`));
    expect(writes.sort()).toEqual(['deploy.yml:id-token: write', 'deploy.yml:pages: write']);
    const deployJob = jobs(deploy)['deploy'] ?? '';
    expect(deployJob).toMatch(/^ {6}pages: write/m);
    expect(deployJob).toMatch(/^ {6}id-token: write/m);
    for (const [id, body] of Object.entries(jobs(deploy))) {
      if (id !== 'deploy') expect(body, `job ${id}`).not.toMatch(/: write\b/);
    }
  });

  it('the deploy job itself also requires main', () => {
    expect(jobs(deploy)['deploy']).toContain("if: ${{ github.ref == 'refs/heads/main' }}");
  });

  it('deploys through the protected github-pages environment, one deployment at a time', () => {
    expect(jobs(deploy)['deploy']).toMatch(/environment:\s*\n\s+name: github-pages/);
    const concurrency = topLevel(deploy, 'concurrency');
    expect(concurrency).toContain('group: pages');
    expect(concurrency).toContain('cancel-in-progress: false');
  });

  it.each(files)('%s: no pull_request_target, no secrets, no content write access', (name) => {
    const text = read(name).replace(/^\s*#.*$/gm, '');
    expect(text).not.toContain('pull_request_target');
    expect(text).not.toMatch(/secrets\./);
    expect(text).not.toMatch(/contents: write/);
    expect(text).not.toMatch(/workflow_run:/);
  });

  it('CI never deploys: the deploy actions appear only in deploy.yml', () => {
    expect(ci).not.toMatch(/deploy-pages|configure-pages|environment:/);
    expect(ci).toContain('upload-pages-artifact'); // packaging dry run only
  });

  it.each(files)('%s: shell steps interpolate no event data (values go through env)', (name) => {
    for (const block of runBlocks(read(name))) {
      for (const expression of block.match(/\$\{\{[^}]*\}\}/g) ?? []) {
        expect(expression, `inside a run step of ${name}`).toMatch(/^\$\{\{\s*github\.sha\s*\}\}$/);
      }
    }
  });
});

describe('SPEC-005 AC4: only pinned, GitHub-owned actions', () => {
  it.each(files)('%s: every `uses:` is actions/* at a full commit SHA, or the local CI workflow', (name) => {
    const uses = [...read(name).matchAll(/^\s*(?:- )?uses:\s*(\S+)(.*)$/gm)];
    expect(uses.length).toBeGreaterThan(0);
    for (const m of uses) {
      const ref = m[1] ?? '';
      if (ref === './.github/workflows/ci.yml') continue;
      expect(ref, `${name}: ${ref}`).toMatch(/^actions\/[\w.-]+@[0-9a-f]{40}$/);
      expect(m[2] ?? '', `${name}: ${ref} needs a version comment`).toMatch(/#\s*v\d/);
    }
  });
});

describe('SPEC-005 AC1/AC5: the deployed bytes are the verified bytes', () => {
  const order = (needle: string): number => {
    const at = ci.indexOf(needle);
    expect(at, needle).toBeGreaterThan(-1);
    return at;
  };

  it('CI stamps and scans the build before the browser tests, and uploads the Pages artifact last', () => {
    expect(order('npm run build ')).toBeLessThan(order('npm run stamp'));
    expect(order('npm run stamp')).toBeLessThan(order('npm run test:e2e'));
    expect(order('npm run check:public')).toBeLessThan(order('npm run test:e2e'));
    expect(order('npm run test:e2e')).toBeLessThan(order('npm run recovery'));
    expect(order('npm run recovery')).toBeLessThan(order('actions/upload-pages-artifact'));
  });

  it('the Pages artifact is uploaded only if every earlier step succeeded, from dist, for one day', () => {
    const step = /upload-pages-artifact@[\s\S]*?(?=\n\n|$)/.exec(ci)?.[0] ?? '';
    expect(step).toContain('if: ${{ success() }}');
    expect(step).toMatch(/path: dist\b/);
    expect(step).toContain('retention-days: 1');
  });

  it('deploy.yml rebuilds nothing: the publishing job has no checkout, npm or shell step', () => {
    const publisher = jobs(deploy)['deploy'] ?? '';
    expect(publisher).not.toMatch(/checkout|npm |vite|run:/);
    expect(publisher).toContain('actions/deploy-pages@');
    expect(publisher).toContain('actions/configure-pages@');
  });

  it('the post-deployment check compares the live commit with the dispatched commit', () => {
    expect(jobs(deploy)['check-live']).toContain('"$PAGE_URL" "$GITHUB_SHA" "$GITHUB_RUN_ID"');
  });
});

describe('SPEC-005: YAML pitfalls', () => {
  it.each(files)('%s: no unquoted step name contains ": " (it would break the file)', (name) => {
    for (const m of read(name).matchAll(/^\s*- name:\s*(.+)$/gm)) {
      const value = (m[1] ?? '').trim();
      if (/^['"]/.test(value)) continue;
      expect(value, `unquoted step name in ${name}`).not.toMatch(/: | #/);
    }
  });

  it.each(files)('%s: uses spaces only (no tabs)', (name) => {
    expect(read(name)).not.toContain('\t');
  });
});
