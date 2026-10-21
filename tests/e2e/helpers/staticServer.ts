// A tiny static server that behaves like GitHub Pages for the app (served under /qr-pocket/) but whose content can be
// swapped while the browser keeps its installed service worker. This simulates "deploy a new version" (SPEC-004 AC5-AC7,
// AC12) without any network service. Tests only; nothing here ships.
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
  '.json': 'application/json',
};

export interface MutableServer {
  readonly origin: string;
  /** Serve a different build directory from now on (a "deployment"). */
  setRoot(dir: string): void;
  /** Serve fixed content for one path under /qr-pocket/ (e.g. a replacement sw.js); null removes the override. */
  override(path: string, content: string | null): void;
  close(): Promise<void>;
}

export async function startServer(initialRoot: string): Promise<MutableServer> {
  let root = initialRoot;
  const overrides = new Map<string, string>();

  const handle = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname === '/qr-pocket') {
      res.writeHead(301, { location: '/qr-pocket/' }).end(); // what GitHub Pages does
      return;
    }
    if (!url.pathname.startsWith('/qr-pocket/')) {
      res.writeHead(404).end('not found');
      return;
    }
    const relative = url.pathname.slice('/qr-pocket/'.length) || 'index.html';
    const headers = { 'cache-control': 'public, max-age=600' }; // like GitHub Pages
    const override = overrides.get(relative);
    if (override !== undefined) {
      res.writeHead(200, { ...headers, 'content-type': TYPES[extname(relative)] ?? 'application/octet-stream' }).end(override);
      return;
    }
    const file = normalize(join(root, relative));
    if (!file.startsWith(normalize(root) + sep)) {
      res.writeHead(403).end('forbidden');
      return;
    }
    try {
      const body = await readFile(file);
      res.writeHead(200, { ...headers, 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' }).end(body);
    } catch {
      res.writeHead(404).end('not found');
    }
  };

  const server: Server = createServer((req, res) => {
    handle(req, res).catch(() => res.writeHead(500).end('error'));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;

  return {
    origin: `http://127.0.0.1:${port}`,
    setRoot: (dir) => {
      root = dir;
    },
    override: (path, content) => {
      if (content === null) overrides.delete(path);
      else overrides.set(path, content);
    },
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}
