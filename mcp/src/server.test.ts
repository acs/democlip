import { describe, expect, it } from 'vitest';
import type { Page } from 'playwright';

import { handleToolCall, type BuildOptions } from './server.js';
import type { Session } from './session.js';

// A session whose page answers with whatever the check wants, so the dispatch — the
// half that turns a tool call into an answer — is proved without a browser.

function sessionWith(answer: unknown): Session {
  const page = {
    evaluate: async () => answer,
  } as unknown as Page;
  return {
    page,
    origin: 'http://127.0.0.1:0',
    version: '1.2.3',
    browser: { label: 'Google Chrome', grantable: true },
    downloadsDir: '/tmp',
    downloadsNamed: false,
    close: async () => {},
  };
}

const opens = (session: Session): BuildOptions => ({ openSession: async () => session });

const textOf = (result: { content: Array<{ text: string }> }): unknown =>
  JSON.parse(result.content[0].text);

describe('a tool call', () => {
  it('answers with what the operation answered', async () => {
    const described = { length: 5, keptLength: 5, takes: [], cuts: [], annotations: [] };
    const result = await handleToolCall(opens(sessionWith(described)), 'describe_clip', {});
    expect(result.isError).toBe(false);
    expect(textOf(result)).toEqual(described);
  });

  it('hands back an app-level refusal as a result, not an error', async () => {
    const refusal = { ok: false, reason: 'that stretch is too short' };
    const result = await handleToolCall(opens(sessionWith(refusal)), 'describe_clip', {});
    expect(result.isError).toBe(false);
    expect(textOf(result)).toEqual(refusal);
  });

  it('hands back a publish with no sign-in as a result, with the reason', async () => {
    const refusal = { ok: false, reason: 'nobody is signed in to publish \u2014 sign in to Bluesky in this window first' };
    const result = await handleToolCall(opens(sessionWith(refusal)), 'publish_clip', { text: 'hello' });
    expect(result.isError).toBe(false);
    expect(textOf(result)).toEqual(refusal);
  });

  it('refuses a name it does not offer', async () => {
    const result = await handleToolCall(opens(sessionWith({})), 'run_anything', {});
    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatchObject({ ok: false });
  });

  it('says plainly when a session cannot be had, and nothing half-starts', async () => {
    const options: BuildOptions = {
      openSession: async () => {
        throw new Error('the app\u2019s build was not found');
      },
    };
    const result = await handleToolCall(options, 'describe_clip', {});
    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatchObject({ ok: false, reason: 'the app\u2019s build was not found' });
  });

  it('opens the session lazily \u2014 not until a tool is called', async () => {
    let opened = 0;
    const options: BuildOptions = {
      openSession: async () => {
        opened += 1;
        return sessionWith({});
      },
    };
    expect(opened).toBe(0);
    await handleToolCall(options, 'describe_clip', {});
    expect(opened).toBe(1);
    await handleToolCall(options, 'describe_clip', {});
    expect(opened).toBe(2);          // the options decide; the dispatch asks each time
  });
});
