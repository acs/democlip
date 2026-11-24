import { describe, expect, it } from 'vitest';

import { publishToYouTube, type YouTubeDeps, type YouTubePublicationProgress } from './publish-to-youtube.js';
import type { UploadedVideo, YouTubeService } from './youtube-service.js';
import { VIDEO_MAX_SECONDS, type UploadableVideo } from '../domain/youtube/UploadableVideo.js';
import { VideoDetails, watchUrl } from '../domain/youtube/VideoDetails.js';
import { Clip } from '../domain/clip/Clip.js';
import { IntroCard } from '../domain/clip/IntroCard.js';
import type { ExportPlan } from '../domain/clip/ExportPlan.js';
import { Take } from '../domain/clip/Take.js';
import type { TakeRepository } from '../domain/clip/TakeRepository.js';

// The same smallest collection that behaves like the real one as in Clip.test.ts:
// the port is what lets the use case run in node, with no browser anywhere.
class FakeTakes implements TakeRepository {
  private takes: Take[] = [];

  add(blob: Blob, duration: number, picture?: { width: number; height: number } | null): Take {
    const take = Take.of(this.takes.length + 1, blob, `blob:${this.takes.length + 1}`, duration, picture ?? null);
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

// Takes with a picture, since a video service takes a video: the sound-only refusal has
// a clip of its own below.
const clipOf = (...durations: number[]): Clip => {
  const clip = Clip.empty(new FakeTakes());
  for (const seconds of durations) clip.addTake(new Blob(['x']), seconds, { width: 1280, height: 720 });
  return clip;
};

const soundOnlyClipOf = (seconds: number): Clip => {
  const clip = Clip.empty(new FakeTakes());
  clip.addTake(new Blob(['x']), seconds);
  return clip;
};

const UPLOADED: UploadedVideo = { id: 'abc123' };

// A YouTube that answers from a script: what the upload returns. It records what it was
// handed, which is what the assertions read — and it has one call, because the app makes
// one (`research.md` D4).
class FakeService implements YouTubeService {
  uploads: Array<{ video: UploadableVideo; details: VideoDetails }> = [];

  constructor(private readonly upload: UploadedVideo = UPLOADED) {}

  async uploadVideo(video: UploadableVideo, details: VideoDetails, progress: (fraction: number) => void): Promise<UploadedVideo> {
    this.uploads.push({ video, details });
    progress(0.5);
    progress(1);
    return this.upload;
  }
}

const when = new Date('2026-01-02T03:04:05.000Z');
const details = VideoDetails.of({ title: 'A demo' }, when);
const settings = () => ({ export: { fadeSeconds: 0.08, annotations: 'drawn' as const }, details });

const deps = (service: YouTubeService, onProgress?: (progress: YouTubePublicationProgress) => void, over: Partial<YouTubeDeps> = {}): YouTubeDeps => ({
  service,
  encode: async () => new Blob(['mp4'], { type: 'video/mp4' }),
  now: () => when,
  onProgress,
  ...over,
});

describe('publishToYouTube', () => {
  it('answers with the video YouTube made, addressed by its id', async () => {
    const published = await publishToYouTube(clipOf(2), settings(), deps(new FakeService()));
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

  it('refuses a sound-only clip, because YouTube takes a video and not a sound file', async () => {
    const service = new FakeService();
    let encodes = 0;

    await expect(publishToYouTube(soundOnlyClipOf(4), settings(), deps(service, undefined, {
      encode: async () => { encodes++; return new Blob(['mp4'], { type: 'video/mp4' }); },
    }))).rejects.toThrow(/picture/i);
    expect(encodes).toBe(0);
    expect(service.uploads).toHaveLength(0);
  });

  it('takes a clip right at the ceiling', async () => {
    await expect(publishToYouTube(clipOf(VIDEO_MAX_SECONDS), settings(), deps(new FakeService()))).resolves.toBeTruthy();
  });

  it('carries the title card into the encode when the export has one', async () => {
    const intro = IntroCard.of('A demo', 'What it shows', new Date(2026, 0, 2, 12), 3)!;
    const captured: { plan?: ExportPlan } = {};
    const service = new FakeService();

    await publishToYouTube(clipOf(2), { ...settings(), export: { ...settings().export, intro } }, deps(service, undefined, {
      encode: async plan => { captured.plan = plan; return new Blob(['mp4'], { type: 'video/mp4' }); },
    }));

    expect(captured.plan?.intro).toBe(intro);
    expect(captured.plan?.total).toBeCloseTo(4.95);   // 1.95s of clip, and the 3s card
    expect(service.uploads).toHaveLength(1);
  });

  it('refuses a clip the card would push past the account\u2019s ceiling', async () => {
    const intro = IntroCard.of('A demo', 'What it shows', new Date(2026, 0, 2, 12), 3)!;
    const service = new FakeService();
    let encodes = 0;

    await expect(publishToYouTube(clipOf(VIDEO_MAX_SECONDS), {
      ...settings(),
      export: { ...settings().export, intro },
    }, deps(service, undefined, {
      encode: async () => { encodes++; return new Blob(['mp4'], { type: 'video/mp4' }); },
    }))).rejects.toThrow(/up to 15 minutes/);

    expect(encodes).toBe(0);
    expect(service.uploads).toHaveLength(0);
  });

  it('refuses a clip with nothing in it', async () => {
    await expect(publishToYouTube(clipOf(), settings(), deps(new FakeService()))).rejects.toThrow(/nothing to publish/);
  });

  it('reports the two stages in order, with what the service says of each', async () => {
    const stages: YouTubePublicationProgress[] = [];
    await publishToYouTube(clipOf(2), settings(), deps(new FakeService(), progress => stages.push(progress)));

    expect(stages.map(step => step.stage)).toEqual([
      'encoding',
      'uploading', 'uploading', 'uploading',   // the stage, then 50% and 100% of the bytes
    ]);
    expect(stages[1].progress).toBeUndefined();
    expect(stages[2].progress).toBe(50);
    expect(stages[3].progress).toBe(100);
  });

  it('asks the destination for nothing after the video is taken', async () => {
    // The upload ends the sequence: there is no read of the video, because the scope the
    // app asks for does not authorize one, and the address it answers with is the video's.
    let calls = 0;
    const service = new FakeService();
    const counting: YouTubeService = {
      uploadVideo: (...args: Parameters<YouTubeService['uploadVideo']>) => { calls++; return service.uploadVideo(...args); },
    };
    const published = await publishToYouTube(clipOf(2), settings(), deps(counting));
    expect(calls).toBe(1);
    expect(published.url).toContain(published.id);
  });

  it('lets the encode fail for itself, so a browser that cannot write MP4 says so', async () => {
    const service = new FakeService();
    await expect(publishToYouTube(clipOf(2), settings(), deps(service, undefined, {
      encode: async () => { throw new Error('this browser cannot encode MP4 offline'); },
    }))).rejects.toThrow(/cannot encode MP4/);
    expect(service.uploads).toHaveLength(0);
  });

  it('lets the destination refuse for itself, and says nothing on its behalf', async () => {
    const refusing: YouTubeService = {
      uploadVideo: async () => { throw new Error('the upload allowance for this app is used up — try again later'); },
    };
    await expect(publishToYouTube(clipOf(2), settings(), deps(refusing))).rejects.toThrow(/allowance for this app is used up/);
  });
});
