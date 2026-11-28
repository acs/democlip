// Serving the app's own build, on loopback.
//
// The server ships the build it was released with and serves it from its own
// package, which is what makes "the server and the app agree on how a clip is
// written down" true by construction rather than a promise. Loopback is a **secure
// context**, so screen capture works with no certificate and no deployment — and
// nothing is hosted and no network is needed to record, edit or export.
//
// It is a static file server and nothing more: the build's own files, by path,
// with the MIME types a browser needs. No directory listing, no traversal.

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { appPort, LOOPBACK_HOST } from './loopback.js';

const TYPES: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

export interface AppServer {
  /** The loopback origin the app is served from. */
  readonly origin: string;
  /** The directory being served. */
  readonly root: string;
  /** True when an app already on the port was reused instead of one being started. */
  readonly reused: boolean;
  close(): Promise<void>;
}

export interface ServeOptions {
  /**
   * The port to serve on. Default: the fixed `DEMOCLIP_PORT`. `0` asks for a free
   * port instead and never reuses — what a check uses so it cannot land on a
   * person's own tenant.
   */
  readonly port?: number;
}

/** How a page on the port is told from DemoClip itself. */
const DEMOCLIP_TITLE = /<title>\s*DemoClip\s*<\/title>/i;

/** Whether DemoClip already answers at `origin` — the MCP's own, or a demo run's. */
async function demoClipServingAt(origin: string): Promise<boolean> {
  try {
    const response = await fetch(`${origin}/`);
    return response.ok && DEMOCLIP_TITLE.test(await response.text());
  } catch {
    return false;
  }
}

/**
 * Serve a directory of the app's build on loopback.
 *
 * The port is **fixed** (`DEMOCLIP_PORT`, default 57364) so the origin — and the
 * browser storage keyed by it — does not move between sessions, and a DemoClip
 * already answering there is **reused**, so an agent session and a demo run share one
 * tenant rather than each opening an empty one. A port held by something that is not
 * DemoClip is refused, never silently worked around.
 */
export async function serveApp(root: string, options: ServeOptions = {}): Promise<AppServer> {
  const base = resolve(root);
  const fixed = options.port ?? appPort();
  const origin = `http://${LOOPBACK_HOST}:${fixed}`;
  if (fixed !== 0 && (await demoClipServingAt(origin))) {
    return { origin, root: base, reused: true, close: async () => {} };
  }

  const server = createServer((req, res) => {
    void respond(base, req, res);
  });

  await new Promise<void>((done, fail) => {
    server.once('error', fail);
    server.listen(fixed, LOOPBACK_HOST, () => done());
  }).catch((error: unknown) => {
    server.close();
    if ((error as { code?: string }).code === 'EADDRINUSE') {
      throw new Error(
        `port ${fixed} is already in use by something that is not DemoClip — ` +
          `set DEMOCLIP_PORT to another port, or free it`,
      );
    }
    throw error;
  });

  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : fixed;
  return {
    origin: `http://${LOOPBACK_HOST}:${port}`,
    root: base,
    reused: false,
    close: () => new Promise<void>(done => server.close(() => done())),
  };
}

async function respond(base: string, req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const path = pathFor(base, req.url ?? '/');
    if (!path) return send(res, 404, 'Not found');
    const info = await stat(path);
    if (!info.isFile()) return send(res, 404, 'Not found');
    const body = await readFile(path);
    res.writeHead(200, {
      'content-type': TYPES[extname(path).toLowerCase()] ?? 'application/octet-stream',
      'content-length': body.byteLength,
      'cache-control': 'no-store',
    });
    res.end(body);
  } catch {
    send(res, 404, 'Not found');
  }
}

/** The file a request names, kept inside `base`; null when it escapes or is empty. */
function pathFor(base: string, url: string): string | null {
  const withoutQuery = url.split('?')[0].split('#')[0];
  const decoded = decodeURIComponent(withoutQuery);
  const relative = decoded === '/' || decoded === '' ? 'index.html' : decoded.replace(/^\/+/, '');
  const path = resolve(join(base, relative));
  if (path !== base && !path.startsWith(base + sep)) return null;
  return path;
}

function send(res: ServerResponse, status: number, body: string): void {
  res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8' });
  res.end(body);
}
