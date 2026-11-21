import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { openSession, type Session } from './session.js';
import { handleToolCall, type BuildOptions } from './server.js';
import { serverVersion } from './version.js';

// The server, end to end: the app's own build served on loopback, a real browser on
// it, and a tool call answered by the app. This is the one check that proves the two
// halves meet — the surface in the page and the server beside it — and it is the
// slowest, because it opens a browser.
//
// The browser is headless here, which is a property of the *check*, not of a session:
// a session for a person is headful, because watching the edits land is the feature.

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const builtApp = fileURLToPath(new URL('../../dist/index.html', import.meta.url));
const builtVersion = fileURLToPath(new URL('../../dist/version.json', import.meta.url));

/**
 * Build the app unless the build on disk is already this release's.
 *
 * The check drives the app *this checkout* built, and the session refuses a page whose
 * version is not its own — which is correct, and which turns a stale build into a
 * puzzling failure after a branch switch. So the build is made current instead.
 */
function ensureBuiltApp(): void {
  if (existsSync(builtApp) && builtVersionOnDisk() === serverVersion()) return;
  execSync('npm run build', { cwd: repoRoot, stdio: 'inherit' });
}

function builtVersionOnDisk(): string {
  try {
    const build = JSON.parse(readFileSync(builtVersion, 'utf8')) as { version?: string };
    return build.version ?? '';
  } catch {
    return '';
  }
}

describe('the server, end to end', () => {
  let session: Session;
  /** Where the file an export writes goes — and what the import is handed straight back. */
  let work = '';

  beforeAll(async () => {
    ensureBuiltApp();
    work = await mkdtemp(join(tmpdir(), 'democlip-round-trip-'));
    // The build from *this checkout*, explicitly: the released server prefers the
    // build packaged inside it, which is right for a release and wrong for a check —
    // a stale packaged copy must never be able to make this pass.
    session = await openSession({
      headless: true,
      appRoot: fileURLToPath(new URL('../../dist', import.meta.url)),
      // The clip has to be made of something, and no machine keeps a camera waiting for
      // a check: these are the two flags the end-to-end suite launches its browser with.
      args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
      downloadsDir: work,
    });
  }, 300_000);

  afterAll(async () => {
    await session?.close();
    if (work) await rm(work, { recursive: true, force: true });
  });

  const options = (): BuildOptions => ({ openSession: async () => session });

  it('opens the app it shipped, agrees on the version, and reads the clip', async () => {
    const result = await handleToolCall(options(), 'describe_clip', {});
    expect(result.isError).toBe(false);

    const described = answered(result) as Record<string, unknown>;
    expect(described).toMatchObject({ length: 0, keptLength: 0, takes: [], cuts: [], annotations: [] });
  });

  it('serves the app on loopback and reports the version the two agree on', async () => {
    expect(session.origin).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
    expect(session.version).toBe(serverVersion());
  });

  // The round trip `import_take` exists for, driven the way an agent would drive it: the
  // app records, the clip goes out to a file, and the same file comes back as a take
  // beside it. These run last — the check above says the clip starts empty.

  it('goes out with its annotations and comes back with them', async () => {
    expect(answered(await handleToolCall(options(), 'turn_source_on', { source: 'webcam' }))).toMatchObject({ ok: true });
    expect((await handleToolCall(options(), 'start_take', {})).isError).toBe(false);
    await pause(800);
    const stopped = answered<{ take?: { seconds: number } }>(await handleToolCall(options(), 'stop_take', {}));
    expect(stopped.take?.seconds ?? 0).toBeGreaterThan(0.3);

    // An arrow to lose, and to find again: over the last part of the clip.
    const drawn = answered<{ ok: boolean }>(await handleToolCall(options(), 'annotate', {
      kind: 'arrow',
      span: { s: 0.2, e: 0.8 },
      from: { x: 0.3, y: 0.4 },
      to: { x: 0.6, y: 0.5 },
    }));
    expect(drawn.ok).toBe(true);

    // Out: the picture alone, with the annotations written beside it — the pair a clip
    // goes out to be worked on with.
    const exported = answered<{ ok: boolean; path: string; annotations?: string }>(
      await handleToolCall(options(), 'export_clip', { target: 'webm', annotations: 'carried' }),
    );
    expect(exported.ok).toBe(true);
    expect(existsSync(exported.path)).toBe(true);
    expect(existsSync(exported.annotations ?? '')).toBe(true);

    // Back in: the file, and the sidecar beside it, which the import finds for itself.
    const imported = answered<{ ok: boolean; take?: { index: number; seconds: number } }>(
      await handleToolCall(options(), 'import_take', { path: exported.path }),
    );
    expect(imported.ok).toBe(true);
    expect(imported.take?.index).toBe(1);
    expect(imported.take?.seconds ?? 0).toBeGreaterThan(0.3);
    expect(imported.take?.seconds ?? 0).toBeLessThanOrEqual(stopped.take?.seconds ?? 0);

    // The clip holds both takes, and both arrows: the one that left is still over the take
    // it was drawn on — the clip grew, so its fractions shrank with it — and the one from
    // the sidecar is its own, over the stretch the file was given.
    const described = answered<{
      takes: Array<{ seconds: number }>;
      annotations: Array<{ kind: string; span: { s: number; e: number } }>;
    }>(await handleToolCall(options(), 'describe_clip', {}));
    expect(described.takes).toHaveLength(2);
    expect(described.annotations.map(annotation => annotation.kind)).toEqual(['arrow', 'arrow']);

    const [first, second] = described.takes;
    const total = first.seconds + second.seconds;
    const landed = first.seconds / total;            // where the file begins in the clip
    const [left, carried] = described.annotations;

    expect(left.span.s).toBeGreaterThan(0);
    expect(left.span.e).toBeLessThan(landed);        // the take it was drawn on
    expect(carried.span.s).toBeGreaterThan(landed);  // the stretch the file was given...
    expect(carried.span.e).toBeLessThanOrEqual(1);
    // ...as wide as it was: the arrow covered 0.6 of the clip, and covers 0.6 of the
    // file — which is that much of the clip's second share.
    expect(carried.span.e - carried.span.s).toBeCloseTo(0.6 * (second.seconds / total), 2);
  });

  it('hands back the app\u2019s own words for a file it will not take', async () => {
    const path = join(work, 'notes.txt');
    await writeFile(path, 'not a video');

    const result = await handleToolCall(options(), 'import_take', { path });
    expect(result.isError).toBe(false);

    const refused = answered<{ ok: boolean; reason: string }>(result);
    expect(refused.ok).toBe(false);
    expect(refused.reason).toMatch(/WebM and MP4/);

    // Nothing arrived: the clip still holds the two takes the round trip left.
    const described = answered<{ takes: unknown[] }>(await handleToolCall(options(), 'describe_clip', {}));
    expect(described.takes).toHaveLength(2);
  });
});

/** What a tool answered, as the data it holds. */
function answered<T = unknown>(result: { content: Array<{ text: string }> }): T {
  return JSON.parse(result.content[0].text) as T;
}

function pause(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
