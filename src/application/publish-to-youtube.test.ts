import { describe, expect, it } from 'vitest';

import { publishToYouTube, type YouTubeDeps, type YouTubePublicationProgress } from './publish-to-youtube.js';
import type { UploadedVideo, VideoStatus, YouTubeService } from './youtube-service.js';
import { VIDEO_MAX_SECONDS, type UploadableVideo } from '../domain/youtube/UploadableVideo.js';
import { VideoDetails, watchUrl } from '../domain/youtube/VideoDetails.js';
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

const UPLOADED: UploadedVideo = { id: 'abc123' };

// A YouTube that answers from a script: what the upload returns, and what each poll
// returns (the last answer repeats, so a video that never becomes ready can be one
// entry). It records what it was handed, which is what the assertions read.
class FakeService implements YouTubeService {
  uploads: Array<{ video: UploadableVideo; details: VideoDetails }> = [];
  polls = 0;

  constructor(
    private readonly upload: UploadedVideo = UPLOADED,
    private readonly statuses: VideoStatus[] = [{ state: 'ready' }],
  ) {}

  async uploadVideo(video: UploadableVideo, details: VideoDetails, progress: (fraction: number) => void): Promise<UploadedVideo> {
    this.uploads.push({ video, details });
    progress(0.5);
    progress(1);
    return this.upload;
  }

  async videoStatus(): Promise<VideoStatus> {
    const i = Math.min(this.polls++, this.statuses.length - 1);
    return this.statuses[i] ?? { state: 'processing', progress: 10 };
  }
}

const when = new Date('2026-01-02T03:04:05.000Z');
const details = VideoDetails.of({ title: 'A demo' }, when);
const settings = () => ({ export: { audio: true, fadeSeconds: 0.08, annotations: 'drawn' as const }, details });

const deps = (service: YouTubeService, onProgress?: (progress: YouTubePublicationProgress) => void, over: Partial<YouTubeDeps> = {}): YouTubeDeps => ({
  service,
  encode: async () => new Blob(['mp4'], { type: 'video/mp4' }),
  now: () => when,
  wait: async () => {},
  onProgress,
  ...over,
});

describe('publishToYouTube', () => {
  it('answers with the video YouTube made, addressed by its id', async () => {
    const service = new FakeService();
    const published = await publishToYouTube(clipOf(2), settings(), deps(service));
    expect(published).toEqual({ id: 'abc123', url: watchUrl('abc123') });
  });

  it('hands the destination the MP4 and the details it is to be given', async () => {
    const service = new FakeService();
    await publishToYouTube(clipOf(2), settings(), deps(service));
    expect(service.uploads).toHaveLength(1);
    expect(service.uploads[0].video.blob.type).toBe('video/mp4');
    expect(service.uploads[0].video.name).toMatch(/^democlip-\d+\.mp4$/);
    expect(service.uploads[0].details).toBe(details);
  });

  it('refuses a clip past the account\'s ceiling before anything is encoded', async () => {
    const service = new FakeService();
    let encodes = 0;
    await expect(publishToYouTube(clipOf(VIDEO_MAX_SECONDS + 100), settings(), deps(service, undefined, {
      encode: async () => { encodes++; return new Blob(['mp4'], { type: 'video/mp4' }); },
    }))).rejects.toThrow(/up to 15 minutes/);
    expect(encodes).toBe(0);
    expect(service.uploads).toHaveLength(0);
  });

  it('takes a clip right at the ceiling', async () => {
    const service = new FakeService();
    await expect(publishToYouTube(clipOf(VIDEO_MAX_SECONDS), settings(), deps(service))).resolves.toBeTruthy();
  });

  it('refuses a clip with nothing in it', async () => {
    await expect(publishToYouTube(clipOf(), settings(), deps(new FakeService()))).rejects.toThrow(/nothing to publish/);
  });

  it('reports the three stages in order, with what the service says of each', async () => {
    const stages: YouTubePublicationProgress[] = [];
    const service = new FakeService(UPLOADED, [{ state: 'processing', progress: 40 }, { state: 'ready' }]);
    await publishToYouTube(clipOf(2), settings(), deps(service, progress => stages.push(progress)));

    expect(stages.map(step => step.stage)).toEqual([
      'encoding',
      'uploading', 'uploading', 'uploading',   // the stage, then 50% and 100% of the bytes
      'processing',
    ]);
    expect(stages[1].progress).toBeUndefined();
    expect(stages[2].progress).toBe(50);
    expect(stages[3].progress).toBe(100);
    expect(stages[4].progress).toBe(40);
  });

  it('waits for the video to be ready rather than calling the upload the end', async () => {
    const service = new FakeService(UPLOADED, [
      { state: 'processing', progress: 20 },
      { state: 'processing', progress: 80 },
      { state: 'ready' },
    ]);
    const published = await publishToYouTube(clipOf(2), settings(), deps(service));
    expect(published.id).toBe('abc123');
    expect(service.polls).toBe(3);
  });

  it('says why when YouTube could not take the video', async () => {
    const service = new FakeService(UPLOADED, [{ state: 'failed', reason: 'it was rejected' }]);
    await expect(publishToYouTube(clipOf(2), settings(), deps(service))).rejects.toThrow(/it was rejected/);
  });

  it('gives up on a video that never becomes ready, and says how long it waited', async () => {
    const service = new FakeService(UPLOADED, [{ state: 'processing', progress: 5 }]);
    await expect(publishToYouTube(clipOf(2), settings(), deps(service, undefined, { maxPolls: 3, pollIntervalMs: 1000 })))
      .rejects.toThrow(/still processing the video after \d+ minutes/);
  });

  it('lets the encode fail for itself, so a browser that cannot write MP4 says so', async () => {
    const service = new FakeService();
    await expect(publishToYouTube(clipOf(2), settings(), deps(service, undefined, {
      encode: async () => { throw new Error('this browser cannot encode MP4 offline'); },
    }))).rejects.toThrow(/cannot encode MP4/);
    expect(service.uploads).toHaveLength(0);
  });
});
