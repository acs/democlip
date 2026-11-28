import { mkdtemp, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { waitForNamedFile } from './downloads.js';

// A download is a file that arrives: in flight it is written as `<name>.crdownload`, and
// it is renamed to the name the app gave it when it is whole. The watcher reads the
// finished one, so it must wait for the rename and must survive Chrome's ` (1)`.

describe('waiting for a download the browser named itself', () => {
  it('gives the file once the browser has finished renaming it', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'democlip-dl-'));
    try {
      const part = join(dir, 'clip.webm.crdownload');
      await writeFile(part, 'half');
      const waiting = waitForNamedFile(dir, 'clip.webm');
      setTimeout(() => void rename(part, join(dir, 'clip.webm')), 50);
      expect(await waiting).toBe(join(dir, 'clip.webm'));
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('takes the " (1)" name Chrome picks when the name is already taken', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'democlip-dl-'));
    try {
      await writeFile(join(dir, 'clip (1).webm'), 'whole');
      expect(await waitForNamedFile(dir, 'clip.webm')).toBe(join(dir, 'clip (1).webm'));
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('does not mistake a sidecar for the video it belongs to', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'democlip-dl-'));
    try {
      await writeFile(join(dir, 'clip.democlip.json'), '{}');
      expect(await waitForNamedFile(dir, 'clip.democlip.json')).toBe(join(dir, 'clip.democlip.json'));
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
