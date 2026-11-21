import { describe, expect, it } from 'vitest';

import { createOut, type Exporter, type Publisher, type YouTubePublisher } from './out.js';

// The surface's own rules for what leaves the page: which destination, what each one
// needs, and what happens when nobody is signed in. The app's own flows are faked, so
// nothing here needs a browser or an account — and a refusal must send nothing.

interface Recorded {
  exported: Array<{ target: string; annotations: string }>;
  posts: string[];
  uploads: Array<{ title?: string; visibility?: string }>;
}

const POST_URL = 'https://bsky.app/profile/alice.bsky.social/post/1';
const VIDEO_URL = 'https://youtu.be/vid123';

function fakes(over: { account?: boolean; channel?: boolean } = {}): { out: ReturnType<typeof createOut>; seen: Recorded } {
  const signedIn = over.account ?? true;
  const hasChannel = over.channel ?? true;
  const seen: Recorded = { exported: [], posts: [], uploads: [] };

  const exporter: Exporter = {
    async export(target, annotations) {
      seen.exported.push({ target, annotations });
      return { kind: 'exported', bytes: 2048, filename: 'democlip-1.webm' };
    },
  };
  const publisher: Publisher = {
    async account() { return signedIn ? { handle: 'alice.bsky.social' } : null; },
    async publish(text, _alt, handlers) {
      seen.posts.push(text);
      handlers.onDone({ uri: 'at://did:plc:x/app.bsky.feed.post/1', url: POST_URL });
    },
  };
  const video: YouTubePublisher = {
    async account() { return hasChannel ? { channel: 'A test channel' } : null; },
    async upload(settings, handlers) {
      seen.uploads.push(settings);
      handlers.onDone({ url: VIDEO_URL });
    },
  };
  return { out: createOut(exporter, publisher, video), seen };
}

describe('the surface\u2019s publish', () => {
  it('posts to Bluesky when no destination is said, as it did before there were two', async () => {
    const { out, seen } = fakes();
    expect(await out.publish({ text: 'A demo', alt: 'what it shows' }))
      .toEqual({ ok: true, url: POST_URL });
    expect(seen.posts).toEqual(['A demo']);
    expect(seen.uploads).toHaveLength(0);
  });

  it('posts to Bluesky when Bluesky is named', async () => {
    const { out, seen } = fakes();
    await out.publish({ destination: 'bluesky', text: 'A demo' });
    expect(seen.posts).toEqual(['A demo']);
    expect(seen.uploads).toHaveLength(0);
  });

  it('uploads to YouTube when YouTube is named, with the video\u2019s own details', async () => {
    const { out, seen } = fakes();
    const result = await out.publish({ destination: 'youtube', title: 'A demo', visibility: 'unlisted' });
    expect(result).toEqual({ ok: true, url: VIDEO_URL });
    expect(seen.uploads).toEqual([{ title: 'A demo', visibility: 'unlisted' }]);
    expect(seen.posts).toHaveLength(0);
  });

  it('refuses a destination the app does not publish to, and sends nothing', async () => {
    const { out, seen } = fakes();
    const result = await out.publish({ destination: 'peertube' });
    expect(result).toEqual({ ok: false, reason: 'the app publishes to bluesky or youtube, not peertube' });
    expect(seen.posts).toHaveLength(0);
    expect(seen.uploads).toHaveLength(0);
  });

  it('refuses a Bluesky post with nobody signed in, and sends nothing', async () => {
    const { out, seen } = fakes({ account: false });
    const result = await out.publish({ destination: 'bluesky' });
    expect(result.ok).toBe(false);
    expect((result as { reason: string }).reason).toMatch(/nobody is signed in to publish/);
    expect(seen.posts).toHaveLength(0);
  });

  it('refuses a YouTube upload with nobody signed in, and sends nothing', async () => {
    const { out, seen } = fakes({ channel: false });
    const result = await out.publish({ destination: 'youtube' });
    expect(result.ok).toBe(false);
    expect((result as { reason: string }).reason).toMatch(/nobody is signed in to upload to YouTube/);
    expect(seen.uploads).toHaveLength(0);
  });
});

describe('the surface\u2019s export', () => {
  it('writes the container the app writes, and says the file', async () => {
    const { out, seen } = fakes();
    expect(await out.export('mp4', 'carried')).toEqual({ ok: true, filename: 'democlip-1.webm' });
    expect(seen.exported).toEqual([{ target: 'mp4', annotations: 'carried' }]);
  });

  it('refuses a container it does not write', async () => {
    const { out, seen } = fakes();
    expect((await out.export('avi')).ok).toBe(false);
    expect(seen.exported).toHaveLength(0);
  });
});
