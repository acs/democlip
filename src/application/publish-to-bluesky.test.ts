import { describe, expect, it } from 'vitest';

import { publishToBluesky, type PublicationDeps, type PublicationProgress } from './publish-to-bluesky.js';
import type { BlueskyService, PostedPost, VideoJob } from './bluesky-service.js';
import { AspectRatio } from '../domain/bluesky/AspectRatio.js';
import { IntroCard } from '../domain/clip/IntroCard.js';
import type { ExportPlan } from '../domain/clip/ExportPlan.js';
import type { BlobRef, PostRecord } from '../domain/bluesky/BlueskyPost.js';
import type { PublishableVideo } from '../domain/bluesky/PublishableVideo.js';
import { Clip } from '../domain/clip/Clip.js';
import { Take } from '../domain/clip/Take.js';
import type { TakeRepository } from '../domain/clip/TakeRepository.js';

// The same smallest collection that behaves like the real one as in Clip.test.ts:
// the port is what lets the use case run in node, with no browser anywhere.
class FakeTakes implements TakeRepository {
  private takes: Take[] = [];

  add(blob: Blob, duration: number): Take {
    const take = Take.of(this.takes.length + 1, blob, `blob:${this.takes.length + 1}`, duration);
    this.takes.push(take);
    return take;
  }
  all() { return this.takes; }
  at(index: number) { return this.takes[index]; }
  count() { return this.takes.length; }
  isEmpty() { return !this.takes.length; }
  startOf(index: number) { let at = 0; for (let i = 0; i < index && i < this.takes.length; i++) at += this.takes[i].duration; return at; }
  indexAt(seconds: number) {
    for (let i = 0; i < this.takes.length; i++) if (seconds < this.startOf(i) + this.takes[i].duration) return i;
    return Math.max(0, this.takes.length - 1);
  }
  totalDuration() { return this.takes.reduce((total, take) => total + take.duration, 0); }
  clear() { this.takes = []; }
}

const clipOf = (...durations: number[]): Clip => {
  const clip = Clip.empty(new FakeTakes());
  for (const seconds of durations) clip.addTake(new Blob(['x']), seconds);
  return clip;
};

const blobRef: BlobRef = { $type: 'blob', ref: { $link: 'bafkreivid' }, mimeType: 'video/mp4', size: 2048 };
const POSTED: PostedPost = { uri: 'at://did:plc:x/app.bsky.feed.post/1', cid: 'bafyreicid' };

// A Bluesky that answers from a script: what the upload returns, and what each
// poll returns (the last answer repeats, so a job that never finishes can be one
// entry). It records what it was handed, which is what the assertions read.
class FakeService implements BlueskyService {
  uploads: PublishableVideo[] = [];
  posts: PostRecord[] = [];
  polls = 0;

  constructor(
    private readonly upload: VideoJob,
    private readonly polls_: VideoJob[] = [],
  ) {}

  async uploadVideo(video: PublishableVideo): Promise<VideoJob> {
    this.uploads.push(video);
    return this.upload;
  }
  async videoJob(): Promise<VideoJob> {
    const i = Math.min(this.polls++, this.polls_.length - 1);
    return this.polls_[i] ?? { jobId: 'job-1', state: 'JOB_STATE_ENCODING' };
  }
  async createPost(record: PostRecord): Promise<PostedPost> {
    this.posts.push(record);
    return POSTED;
  }
}

const at = new Date('2026-01-02T03:04:05.000Z');
const ratio = AspectRatio.of(1280, 720);
const settings = { export: { audio: true, fadeSeconds: 0.08, annotations: 'drawn' as const }, text: 'A demo', alt: 'a screen recording', langs: ['en'], aspectRatio: ratio };
const deps = (service: BlueskyService, onProgress?: (p: PublicationProgress) => void, over: Partial<PublicationDeps> = {}): PublicationDeps => ({
  service,
  encode: async () => new Blob(['mp4'], { type: 'video/mp4' }),
  now: () => at,
  wait: async () => {},
  onProgress,
  ...over,
});

const stageChanges = (progress: PublicationProgress[]): string[] =>
  progress.map(p => p.stage).filter((stage, i, all) => stage !== all[i - 1]);

describe('publishToBluesky', () => {
  it('encodes, uploads, waits for the video, and posts it', async () => {
    const service = new FakeService(
      { jobId: 'job-1', state: 'JOB_STATE_CREATED' },
      [
        { jobId: 'job-1', state: 'JOB_STATE_ENCODED', progress: 50 },
        { jobId: 'job-1', state: 'JOB_STATE_COMPLETED', progress: 100, blob: blobRef },
      ],
    );
    const progress: PublicationProgress[] = [];

    const result = await publishToBluesky(clipOf(10), settings, deps(service, p => progress.push(p)));

    expect(result).toEqual(POSTED);
    expect(service.uploads).toHaveLength(1);
    expect(service.uploads[0].blob.type).toBe('video/mp4');
    expect(service.uploads[0].name).toMatch(/^democlip-\d+\.mp4$/);
    expect(service.posts[0].embed).toEqual({
      $type: 'app.bsky.embed.video',
      video: blobRef,
      alt: 'a screen recording',
      aspectRatio: { width: 1280, height: 720 },
    });
    expect(service.posts[0]).toMatchObject({ text: 'A demo', langs: ['en'], createdAt: at.toISOString() });

    expect(stageChanges(progress)).toEqual(['encoding', 'uploading', 'processing', 'posting']);
    expect(progress.filter(p => p.stage === 'processing').map(p => p.progress)).toContain(50);
  });

  it('carries the title card into the encode when the export has one', async () => {
    const intro = IntroCard.of('A demo', 'What it shows', new Date(2026, 0, 2, 12), 3)!;
    const captured: { plan?: ExportPlan } = {};
    const service = new FakeService(
      { jobId: 'job-1', state: 'JOB_STATE_CREATED' },
      [{ jobId: 'job-1', state: 'JOB_STATE_COMPLETED', blob: blobRef }],
    );

    await publishToBluesky(clipOf(2), { ...settings, export: { ...settings.export, intro } }, deps(service, undefined, {
      encode: async plan => { captured.plan = plan; return new Blob(['mp4'], { type: 'video/mp4' }); },
    }));

    expect(captured.plan?.intro).toBe(intro);
    expect(captured.plan?.total).toBeCloseTo(4.95);   // 1.95s of clip, and the 3s card
  });

  it('posts when the video service answers with an error that still carries the blob', async () => {
    // Bluesky's own warning: a video already processed comes back as an error
    // with the blob in it. The blob, not the state, says it is done.
    const service = new FakeService(
      { jobId: 'job-1', state: 'JOB_STATE_FAILED', error: 'already_exists', blob: blobRef },
    );

    await publishToBluesky(clipOf(10), settings, deps(service));

    expect(service.polls).toBe(0);
    expect(service.posts).toHaveLength(1);
  });

  it('says there is nothing to publish, and never reaches Bluesky', async () => {
    const service = new FakeService({ jobId: 'job-1', state: 'JOB_STATE_CREATED' });

    await expect(publishToBluesky(clipOf(), settings, deps(service))).rejects.toThrow(/nothing to publish/);
    expect(service.uploads).toHaveLength(0);
  });

  it('refuses a clip longer than Bluesky takes, before encoding it', async () => {
    const service = new FakeService({ jobId: 'job-1', state: 'JOB_STATE_CREATED' });

    await expect(publishToBluesky(clipOf(601), settings, deps(service))).rejects.toThrow(/up to 10 minutes/);
    expect(service.uploads).toHaveLength(0);
  });

  it('refuses a file the encoder wrote that is not an MP4', async () => {
    const service = new FakeService({ jobId: 'job-1', state: 'JOB_STATE_CREATED' });

    await expect(
      publishToBluesky(clipOf(10), settings, { ...deps(service), encode: async () => new Blob(['webm'], { type: 'video/webm' }) }),
    ).rejects.toThrow(/video\/mp4/);
    expect(service.uploads).toHaveLength(0);
  });

  it('gives up when the video service cannot process the video', async () => {
    const service = new FakeService(
      { jobId: 'job-1', state: 'JOB_STATE_CREATED' },
      [{ jobId: 'job-1', state: 'JOB_STATE_FAILED', message: 'video too long' }],
    );

    await expect(publishToBluesky(clipOf(10), settings, deps(service)))
      .rejects.toThrow(/could not process the video: video too long/);
    expect(service.posts).toHaveLength(0);
  });

  it('stops polling and says so when the video never arrives', async () => {
    const service = new FakeService(
      { jobId: 'job-1', state: 'JOB_STATE_CREATED' },
      [{ jobId: 'job-1', state: 'JOB_STATE_ENCODING', progress: 40 }],
    );

    await expect(publishToBluesky(clipOf(10), settings, deps(service, undefined, { maxPolls: 2 })))
      .rejects.toThrow(/still processing/);
    expect(service.polls).toBe(3);          // the first answer plus maxPolls more
  });

  it('waits longer for a longer clip, because the video service transcodes', async () => {
    const service = new FakeService(
      { jobId: 'job-1', state: 'JOB_STATE_CREATED' },
      [{ jobId: 'job-1', state: 'JOB_STATE_ENCODING', progress: 10 }],
    );

    await expect(publishToBluesky(clipOf(600), settings, deps(service))).rejects.toThrow(/still processing/);
    // A flat two minutes would have given up on a ten-minute clip that was still being
    // transcoded, and it would have looked like Bluesky's fault.
    expect(service.polls).toBeGreaterThan(120);
  });
});
