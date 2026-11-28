import { createServer } from 'node:http';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { serveApp } from './serve.js';
import { LOOPBACK_HOST } from './loopback.js';

// Serving on the fixed origin, and the two things that keep the tenant whole: an
// already-serving DemoClip is reused rather than shadowed, and a stranger on the port
// is refused rather than worked around.

/** A stand-in app answering `<title>` on a free port. */
async function standIn(title: string): Promise<{ port: number; close: () => Promise<void> }> {
  const server = createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(`<!doctype html><title>${title}</title>`);
  });
  await new Promise<void>(done => server.listen(0, '127.0.0.1', () => done()));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  return { port, close: () => new Promise<void>(done => server.close(() => done())) };
}

describe('serving on a fixed origin', () => {
  let root = '';

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'democlip-serve-'));
    await writeFile(join(root, 'index.html'), '<!doctype html><title>DemoClip</title>');
  });

  afterAll(async () => {
    if (root) await rm(root, { recursive: true, force: true });
  });

  it('reuses a DemoClip already on the port, and leaves it running', async () => {
    const running = await standIn('DemoClip');
    try {
      const app = await serveApp(root, { port: running.port });
      expect(app.reused).toBe(true);
      expect(app.origin).toBe(`http://${LOOPBACK_HOST}:${running.port}`);
      await app.close();
      // A reused server is not ours to close: it still answers.
      expect((await fetch(`${app.origin}/`)).ok).toBe(true);
    } finally {
      await running.close();
    }
  });

  it('serves its own build when the port is free', async () => {
    const app = await serveApp(root, { port: 0 });
    try {
      expect(app.reused).toBe(false);
      expect((await fetch(`${app.origin}/`)).ok).toBe(true);
    } finally {
      await app.close();
    }
  });

  it('refuses a port held by something that is not DemoClip', async () => {
    const stranger = await standIn('Something else');
    try {
      await expect(serveApp(root, { port: stranger.port })).rejects.toThrow(/already in use/);
    } finally {
      await stranger.close();
    }
  });
});
