import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { openSession } from './session.js';
import { openApp } from './browser.js';
import { handleToolCall, type BuildOptions } from './server.js';
import { versionMismatchReason } from './version.js';

// The session's promises about failing: a person is told plainly, and nothing
// half-starts — no browser left behind, no clip half-read.

describe('opening a session', () => {
  it('says plainly when the app\u2019s build is not there, and starts nothing', async () => {
    await expect(openSession({ appRoot: '/definitely/not/here' })).rejects.toThrow(/was not found/);
  });

  it('says plainly when no browser can be opened, and leaves no server behind', async () => {
    // A browser that is not there stands in for a machine with none installed, or no
    // display: the launch fails, and the failure is the person's to read. The profile
    // is the check's own, so a failing launch never touches the person's tenant.
    const profile = await mkdtemp(join(tmpdir(), 'democlip-profile-'));
    try {
      await expect(
        openApp('http://127.0.0.1:1', {
          headless: true,
          executablePath: '/definitely/not/a/browser',
          profile,
        }),
      ).rejects.toThrow();
    } finally {
      await rm(profile, { recursive: true, force: true });
    }
  });
});

describe('the version check, before anything is driven', () => {
  it('refuses a page of another release and does not reach the tool', async () => {
    const reason = versionMismatchReason('1.0.88', '1.0.89');
    expect(reason).not.toBeNull();

    let touched = 0;
    const options: BuildOptions = {
      openSession: async () => {
        // The session is where the check lives: it never hands back a page it does not
        // match, so a tool's own work cannot begin.
        touched += 1;
        throw new Error(reason!);
      },
    };

    const result = await handleToolCall(options, 'describe_clip', {});
    expect(touched).toBe(1);                      // the session was asked for...
    expect(result.isError).toBe(true);            // ...and the call failed before a tool ran
    expect(JSON.parse(result.content[0].text)).toEqual({ ok: false, reason });
  });
});
