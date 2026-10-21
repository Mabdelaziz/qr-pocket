// Checks a LIVE deployment over HTTPS (SPEC-005 AC7). Pure given a fetch function, so it is unit-tested with a fake site.
const EXPECTED_PATH = '/qr-pocket/';

/** Returns a list of problems (empty = the live site is the verified build and is installable). */
export async function checkLive({ baseUrl, commit, fetchImpl = fetch }) {
  const problems = [];
  let base;
  try {
    base = new URL(baseUrl);
  } catch {
    return [`"${baseUrl}" is not a URL`];
  }
  if (base.protocol !== 'https:') problems.push(`the site must be served over HTTPS, not ${base.protocol}`);
  if (base.pathname !== EXPECTED_PATH) problems.push(`the site must live at ${EXPECTED_PATH}, not ${base.pathname}`);

  const get = async (path) => {
    const url = new URL(path, base);
    url.searchParams.set('check', String(Date.now())); // bypass the host cache for this request only
    try {
      return await fetchImpl(url, { headers: { 'Cache-Control': 'no-cache' }, redirect: 'manual' });
    } catch (error) {
      problems.push(`${path}: request failed (${error instanceof Error ? error.message : String(error)})`);
      return undefined;
    }
  };

  const version = await get('version.json');
  if (version) {
    if (!version.ok) problems.push(`version.json: HTTP ${version.status}`);
    else {
      try {
        const body = await version.json();
        if (body.commit !== commit) problems.push(`version.json: live commit ${body.commit} is not the verified commit ${commit}`);
      } catch {
        problems.push('version.json: not valid JSON');
      }
    }
  }

  let iconPath;
  const manifest = await get('manifest.webmanifest');
  if (manifest) {
    if (!manifest.ok) problems.push(`manifest.webmanifest: HTTP ${manifest.status}`);
    else {
      try {
        const body = await manifest.json();
        for (const key of ['scope', 'start_url', 'id']) if (body[key] !== EXPECTED_PATH) problems.push(`manifest: ${key} is ${body[key]}, expected ${EXPECTED_PATH}`);
        if (body.display !== 'standalone') problems.push(`manifest: display is ${body.display}, expected standalone`);
        const icon = (body.icons ?? []).find((i) => i.sizes === '512x512' && i.purpose === 'any');
        if (icon) iconPath = icon.src;
        else problems.push('manifest: no 512x512 icon');
      } catch {
        problems.push('manifest.webmanifest: not valid JSON');
      }
    }
  }

  const worker = await get('sw.js');
  if (worker) {
    if (!worker.ok) problems.push(`sw.js: HTTP ${worker.status}`);
    else if (!/javascript/.test(worker.headers.get('content-type') ?? '')) problems.push(`sw.js: content type is "${worker.headers.get('content-type')}", expected JavaScript`);
  }

  if (iconPath) {
    const icon = await get(iconPath);
    if (icon && !icon.ok) problems.push(`${iconPath}: HTTP ${icon.status}`);
    else if (icon && !(icon.headers.get('content-type') ?? '').startsWith('image/png')) problems.push(`${iconPath}: content type is "${icon.headers.get('content-type')}", expected image/png`);
  }

  const page = await get('');
  if (page && !page.ok) problems.push(`start page: HTTP ${page.status}`);
  return problems;
}
