import { describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Page } from 'playwright';

import { importTakeFile } from './import.js';
import type { Session } from './session.js';

// The delivery, proved without a browser: the page is nothing but what the delivery
// asks of it — the app's file input, the app's Import button, the app's own words — and
// the clip the app answers with. What a real browser does with a path, and what a real
// app does with a file, is proved in integration.test.ts.

interface App {
  readonly session: Session;
  /** The paths handed to the app's file input. */
  readonly files: string[];
  /** The takes the app's clip holds, as `describe_clip` reports them. */
  takes(seconds: number[]): void;
  /** The app refuses what arrives, in its own words. */
  refuse(words: string): void;
  /** The app takes what arrives, as a take of this length. */
  take(seconds: number): void;
  noFileInput(): void;
  importDisabled(): void;
  fails(error: Error): void;
}

function app(): App {
  const state = {
    takes: [] as Array<{ index: number; seconds: number }>,
    words: '',
    hasInput: true,
    disabled: false,
    failure: null as Error | null,
    files: [] as string[],
    onFiles: null as (() => void) | null,
  };

  const page = {
    locator: (selector: string) => {
      if (selector === '#file-input') {
        return {
          count: async () => (state.hasInput ? 1 : 0),
          setInputFiles: async (paths: string | string[]) => {
            if (state.failure) throw state.failure;
            state.files.push(...(Array.isArray(paths) ? paths : [paths]));
            state.onFiles?.();
          },
        };
      }
      if (selector === '#file-btn') {
        return { count: async () => 1, isDisabled: async () => state.disabled };
      }
      if (selector === '#toast') {
        return { textContent: async () => state.words };
      }
      throw new Error(`the stub page has no ${selector}`);
    },
    evaluate: async (_script: unknown, arg: { path?: string }) => {
      if (arg?.path === 'describe') return { takes: state.takes };
      throw new Error(`the app offers no ${arg?.path}`);
    },
  } as unknown as Page;

  const session: Session = {
    page,
    origin: 'http://127.0.0.1:0',
    version: '1.2.3',
    browser: { label: 'Google Chrome', grantable: true },
    downloadsDir: '/tmp',
    close: async () => {},
  };

  return {
    session,
    get files() { return state.files; },
    takes: seconds => { state.takes = seconds.map((s, index) => ({ index, seconds: s })); },
    refuse: words => { state.onFiles = () => { state.words = words; }; },
    take: seconds => { state.onFiles = () => { state.takes.push({ index: state.takes.length, seconds }); }; },
    noFileInput: () => { state.hasInput = false; },
    importDisabled: () => { state.disabled = true; },
    fails: error => { state.failure = error; },
  };
}

describe('import_take', () => {
  it('needs a file, named as a path', async () => {
    const { session } = app();
    const outcome = await importTakeFile(session, '   ');
    expect(outcome.ok).toBe(false);
    expect(outcome.reason).toMatch(/path/i);
  });

  it('says so plainly when the app it is driving has no file input', async () => {
    const stub = app();
    stub.noFileInput();
    const outcome = await importTakeFile(stub.session, '/tmp/clip.webm');
    expect(outcome.ok).toBe(false);
    expect(outcome.reason).toMatch(/file input/i);
  });

  it('refuses while a take is in flight, without filling the input', async () => {
    const stub = app();
    stub.importDisabled();
    const outcome = await importTakeFile(stub.session, '/tmp/clip.webm');
    expect(outcome.ok).toBe(false);
    expect(outcome.reason).toMatch(/take is in flight/i);
    expect(stub.files).toEqual([]);
  });

  it('answers with the take the app made, and its own length', async () => {
    const stub = app();
    stub.take(1.4);
    const outcome = await importTakeFile(stub.session, '/tmp/clip.webm');
    expect(outcome).toEqual({ ok: true, take: { index: 0, seconds: 1.4 } });
    expect(stub.files).toEqual(['/tmp/clip.webm']);
  });

  it('hands over the sidecar written beside the file, so the annotations travel with it', async () => {
    const work = await mkdtemp(join(tmpdir(), 'democlip-sidecar-'));
    try {
      const video = join(work, 'clip.webm');
      // The name the app writes its sidecars under: the video's name, its extension
      // replaced by `.democlip.json`.
      const sidecar = `${join(work, 'clip')}.democlip.json`;
      await writeFile(video, 'a video, as far as this stub is concerned');
      await writeFile(sidecar, JSON.stringify({ version: 1, length: 4, annotations: [] }));

      const stub = app();
      stub.take(4);

      await importTakeFile(stub.session, video);

      expect(stub.files).toEqual([video, sidecar]);
    } finally {
      await rm(work, { recursive: true, force: true });
    }
  });

  it('hands back the app\u2019s own words when it will not take the file', async () => {
    const stub = app();
    stub.refuse('Only WebM and MP4 videos can be imported.');
    const outcome = await importTakeFile(stub.session, '/tmp/notes.txt');
    expect(outcome).toEqual({ ok: false, reason: 'Only WebM and MP4 videos can be imported.' });
  });

  it('answers a file it could not open with the browser\u2019s own words', async () => {
    const stub = app();
    stub.fails(new Error('ENOENT: no such file or directory, open \'/tmp/gone.webm\''));
    const outcome = await importTakeFile(stub.session, '/tmp/gone.webm');
    expect(outcome.ok).toBe(false);
    expect(outcome.reason).toMatch(/could not be opened/);
    expect(outcome.reason).toMatch(/ENOENT/);
  });

  it('gives up with a plain reason when the app takes nothing and says nothing', async () => {
    vi.useFakeTimers();
    try {
      const { session } = app();
      const pending = importTakeFile(session, '/tmp/clip.webm');
      await vi.advanceTimersByTimeAsync(16_000);
      expect(await pending).toEqual({ ok: false, reason: 'the app did not take the file' });
    } finally {
      vi.useRealTimers();
    }
  });
});
