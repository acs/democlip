import { describe, expect, it } from 'vitest';

import { HttpYouTubeService } from './youtube.js';
import { VideoDetails } from '../domain/youtube/VideoDetails.js';
import { UploadableVideo } from '../domain/youtube/UploadableVideo.js';

// The half of the client that only needs a token and `fetch`, tested with both
// injected — no browser, no network. The half that needs the browser (the consent, the
// script, the channel) is the end-to-end suite's, which stands it in.

type Answer = Response | (() => Response | Promise<Response>);

/** A fetch that answers from a script, recording what it was asked. */
function scripted(answers: Answer[]): { fetchFn: typeof fetch; calls: Array<{ url: string; init: RequestInit }> } {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init: init ?? {} });
    const answer = answers[Math.min(calls.length - 1, answers.length - 1)];
    return typeof answer === 'function' ? await answer() : answer;
  }) as unknown as typeof fetch;
  return { fetchFn, calls };
}

const headersOf = (call: { init: RequestInit }): Record<string, string> => call.init.headers as Record<string, string>;
const rangeOf = (call: { init: RequestInit }): string => headersOf(call)['content-range'];

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const session = (location: string): Response => new Response(null, { status: 200, headers: { location } });
const incomplete = (range: string): Response => new Response(null, { status: 308, headers: { range } });
const created = (id: string): Response => json({ id }, 201);
const problem = (status: number, reason?: string): Response =>
  json({ error: { errors: reason ? [{ reason }] : [] } }, status);

const when = new Date('2026-11-21T10:30:00.000Z');
const details = VideoDetails.of({ title: 'A demo', description: 'What it shows' }, when);
const video = UploadableVideo.of(new Blob(['x'.repeat(100)], { type: 'video/mp4' }), 'democlip-1.mp4');

const service = (fetchFn: typeof fetch, chunkBytes?: number): HttpYouTubeService =>
  new HttpYouTubeService({ token: async () => 'tok' }, fetchFn, chunkBytes);

describe('HttpYouTubeService.uploadVideo', () => {
  it('opens a resumable session with the details, and sends the bytes where it points', async () => {
    const { fetchFn, calls } = scripted([session('https://upload/1'), created('abc123')]);
    const uploaded = await service(fetchFn).uploadVideo(video, details, () => {});
    expect(uploaded).toEqual({ id: 'abc123' });

    expect(calls[0].url).toContain('uploadType=resumable');
    expect(calls[0].url).toContain('part=snippet%2Cstatus');
    expect(headersOf(calls[0]).authorization).toBe('Bearer tok');
    expect(headersOf(calls[0])['x-upload-content-length']).toBe('100');
    expect(headersOf(calls[0])['x-upload-content-type']).toBe('video/mp4');
    // The visibility is sent explicitly: an unset one means *public* to YouTube.
    expect(JSON.parse(String(calls[0].init.body))).toEqual({
      snippet: { title: 'A demo', description: 'What it shows', categoryId: '22' },
      status: { privacyStatus: 'private' },
    });

    expect(calls[1].url).toBe('https://upload/1');
    expect(rangeOf(calls[1])).toBe('bytes 0-99/100');
    expect((calls[1].init.body as Blob).size).toBe(100);
  });

  it('sends the bytes in chunks, resuming from the range the service names', async () => {
    const { fetchFn, calls } = scripted([session('https://upload/1'), incomplete('bytes=0-49'), created('abc123')]);
    const progress: number[] = [];
    const uploaded = await service(fetchFn, 50).uploadVideo(video, details, fraction => progress.push(fraction));

    expect(uploaded.id).toBe('abc123');
    expect(calls).toHaveLength(3);
    expect(rangeOf(calls[1])).toBe('bytes 0-49/100');
    expect(rangeOf(calls[2])).toBe('bytes 50-99/100');
    expect(progress).toEqual([0, 0.5, 1]);
  });

  it('asks where an interrupted upload got to, and goes on from there', async () => {
    const { fetchFn, calls } = scripted([
      session('https://upload/1'),
      () => { throw new Error('the connection dropped'); },
      incomplete('bytes=0-49'),
      created('abc123'),
    ]);
    const uploaded = await service(fetchFn, 50).uploadVideo(video, details, () => {});

    expect(uploaded.id).toBe('abc123');
    expect(rangeOf(calls[2])).toBe('bytes */100');      // the question
    expect(rangeOf(calls[3])).toBe('bytes 50-99/100');  // the rest of the file
  });

  it('reports the upload as interrupted rather than done when it cannot continue', async () => {
    const { fetchFn } = scripted([
      session('https://upload/1'),
      () => { throw new Error('the connection dropped'); },
      incomplete('bytes=0-0'),
    ]);
    await expect(service(fetchFn, 50).uploadVideo(video, details, () => {}))
      .rejects.toThrow(/upload was interrupted/);
  });

  it('says the session expired rather than retrying it forever', async () => {
    const { fetchFn } = scripted([session('https://upload/1'), problem(404)]);
    await expect(service(fetchFn).uploadVideo(video, details, () => {}))
      .rejects.toThrow(/session had expired/);
  });

  it('says the app\u2019s upload allowance is used up', async () => {
    const { fetchFn } = scripted([problem(403, 'quotaExceeded')]);
    await expect(service(fetchFn).uploadVideo(video, details, () => {}))
      .rejects.toThrow(/allowance for this app is used up/);
  });

  it('says when the account has uploaded as many videos as it may', async () => {
    const { fetchFn } = scripted([problem(403, 'uploadLimitExceeded')]);
    await expect(service(fetchFn).uploadVideo(video, details, () => {}))
      .rejects.toThrow(/allowance for this app is used up/);
  });

  it('says when the YouTube Data API is not enabled for the project', async () => {
    // Google's own words for a project that has not enabled the API name the project and a
    // console URL; the app says what to do instead.
    const { fetchFn } = scripted([problem(403, 'accessNotConfigured')]);
    await expect(service(fetchFn).uploadVideo(video, details, () => {}))
      .rejects.toThrow(/YouTube Data API is not enabled/);
  });

  it('says when the account has no YouTube channel to upload to', async () => {
    // The destination's own answer to "may this account upload at all"; the app must not
    // guess it from a channel read it is not authorized to make.
    const { fetchFn } = scripted([problem(401, 'youtubeSignupRequired')]);
    await expect(service(fetchFn).uploadVideo(video, details, () => {}))
      .rejects.toThrow(/no YouTube channel yet/);
  });

  it('says when a browser may not read where to send the video', async () => {
    const { fetchFn } = scripted([new Response(null, { status: 200 })]);
    await expect(service(fetchFn).uploadVideo(video, details, () => {}))
      .rejects.toThrow(/may not read that answer/);
  });

  it('passes on what the destination said when it refuses for a reason of its own', async () => {
    const { fetchFn } = scripted([problem(400, 'invalidTitle')]);
    await expect(service(fetchFn).uploadVideo(video, details, () => {}))
      .rejects.toThrow(/did not take the video\u2019s title/);
  });

  it('says the sign-in has expired before it can even start', async () => {
    const expired = new HttpYouTubeService({ token: async () => { throw new Error('the Google sign-in has expired — sign in again'); } }, scripted([]).fetchFn);
    await expect(expired.uploadVideo(video, details, () => {})).rejects.toThrow(/sign-in has expired/);
  });
});

describe('HttpYouTubeService.videoStatus', () => {
  const statusOf = async (item: unknown): Promise<unknown> => {
    const { fetchFn, calls } = scripted([json({ items: [item] })]);
    const status = await service(fetchFn).videoStatus('abc123');
    expect(calls[0].url).toContain('part=status%2CprocessingDetails');
    expect(calls[0].url).toContain('id=abc123');
    return status;
  };

  it('is ready once YouTube has finished with the video', async () => {
    expect(await statusOf({ status: { uploadStatus: 'processed' } })).toEqual({ state: 'ready' });
    expect(await statusOf({ processingDetails: { processingStatus: 'succeeded' } })).toEqual({ state: 'ready' });
  });

  it('is still processing, with the percentage the destination gives', async () => {
    expect(await statusOf({
      status: { uploadStatus: 'uploaded' },
      processingDetails: { processingStatus: 'processing', processingProgress: { partsProcessed: 1, partsTotal: 4 } },
    })).toEqual({ state: 'processing', progress: 25 });
  });

  it('says why when YouTube could not take the video', async () => {
    expect(await statusOf({
      processingDetails: { processingStatus: 'failed', processingFailureReason: 'unsupported codec' },
    })).toEqual({ state: 'failed', reason: 'unsupported codec' });
    expect(await statusOf({ status: { uploadStatus: 'rejected' } }))
      .toEqual({ state: 'failed', reason: 'rejected' });
  });

  it('is a failure when YouTube does not have the video at all', async () => {
    const { fetchFn } = scripted([json({ items: [] })]);
    expect(await service(fetchFn).videoStatus('gone')).toEqual({ state: 'failed', reason: 'YouTube does not have that video' });
  });

  it('says the sign-in has expired when the destination turns the call away', async () => {
    const { fetchFn } = scripted([problem(401, 'authError')]);
    await expect(service(fetchFn).videoStatus('abc123')).rejects.toThrow(/sign-in has expired/);
  });
});
