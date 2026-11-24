// The publish use case: put the clip's export on Bluesky as a video post.
//
// It has the shape of the export — read the clip, decide what to write, hand it
// on — but the "on" is not a download. The clip is planned as it always is
// (`planExport`), the encoder behind `encode` writes it as MP4, and Bluesky's
// video service is handed the bytes, watched until it has finished, and finally
// asked for a post that carries the finished video.
//
// Bluesky takes `video/mp4` only (see `PublishableVideo`), which is why the
// encode step is a separate concern: DemoClip's download stays WebM, and this
// path writes MP4. None of the browser work — the encoder, the upload, the
// polling — happens here. It is all behind `PublicationDeps`, so the sequencing
// (the order, the progress, giving up) runs in node against a fake.

import type { Clip } from '../domain/clip/Clip.js';
import type { ExportPlan, ExportSettings } from '../domain/clip/ExportPlan.js';
import type { AspectRatio } from '../domain/bluesky/AspectRatio.js';
import { BlueskyPost } from '../domain/bluesky/BlueskyPost.js';
import { PublishableVideo, VIDEO_MAX_SECONDS } from '../domain/bluesky/PublishableVideo.js';
import type { BlueskyService, VideoJob } from './bluesky-service.js';
import { planExport } from './export-clip.js';

export type PublicationStage = 'encoding' | 'uploading' | 'processing' | 'posting';

export interface PublicationProgress {
  stage: PublicationStage;
  /** 0..100, the video service's own figure, while it is processing. */
  progress?: number;
}

export interface PublicationSettings {
  /** What of the clip to write — the same settings the export takes. */
  export: ExportSettings;
  /** The post's text. May be empty: the video is the content. */
  text: string;
  /** The video's description, for accessibility. */
  alt?: string;
  /** Up to three language tags. */
  langs?: readonly string[];
  /** The ratio the post shows the video at. */
  aspectRatio: AspectRatio;
}

export interface PublicationDeps {
  service: BlueskyService;
  /** Write the plan as MP4. The browser half; faked in tests. */
  encode: (plan: ExportPlan) => Promise<Blob>;
  now?: () => Date;
  wait?: (ms: number) => Promise<void>;
  onProgress?: (progress: PublicationProgress) => void;
  pollIntervalMs?: number;
  maxPolls?: number;
}

export interface Publication {
  uri: string;
  cid: string;
}

// A second between polls is what Bluesky's own example uses. The budget follows the
// clip, because the video service *transcodes* and that is not real time: a flat two
// minutes is outlived by a ten-minute clip, and the publish would then fail on a
// video the service was still working on. Twice the clip's length, floored, so even
// a very short one is given two minutes.
const POLL_INTERVAL_MS = 1000;
const MIN_POLLS = 120;
const POLLS_PER_CLIP_SECOND = 2;

export async function publishToBluesky(
  clip: Clip,
  settings: PublicationSettings,
  deps: PublicationDeps,
): Promise<Publication> {
  const plan = planExport(clip, settings.export);
  if (!plan) throw new Error('nothing to publish');
  // Bluesky takes a video, and a clip whose kept stretches have no picture is sound only.
  // Refuse here — before a frame is encoded or a byte is uploaded — rather than let a
  // sound file reach a video service and be turned away there.
  if (plan.soundOnly) {
    throw new Error('Bluesky takes a video, and this clip is sound only — it has no picture to write. Export it as a file instead');
  }
  // Bluesky's ceiling: ten minutes. Refuse here rather than after encoding, where
  // the video service would say it anyway, having spent the upload.
  if (plan.total > VIDEO_MAX_SECONDS) {
    throw new Error(`Bluesky takes videos up to ${VIDEO_MAX_SECONDS / 60} minutes — cut this clip to publish it`);
  }

  const now = deps.now ?? (() => new Date());
  const wait = deps.wait ?? ((ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms)));
  const createdAt = now();

  deps.onProgress?.({ stage: 'encoding' });
  const video = PublishableVideo.of(
    await deps.encode(plan),
    `democlip-${createdAt.getTime()}.mp4`,
    settings.aspectRatio,
  );

  deps.onProgress?.({ stage: 'uploading' });
  const uploaded = await deps.service.uploadVideo(video);

  const interval = deps.pollIntervalMs ?? POLL_INTERVAL_MS;
  const maxPolls = deps.maxPolls ?? Math.max(MIN_POLLS, Math.ceil(plan.total * POLLS_PER_CLIP_SECOND));
  const finished = await waitForVideo(deps, uploaded, wait, maxPolls, interval);
  if (!finished.blob) throw new Error(whyStillNoVideo(finished, Math.round((maxPolls * interval) / 60_000)));

  deps.onProgress?.({ stage: 'posting' });
  const post = BlueskyPost.of({
    text: settings.text,
    alt: settings.alt,
    langs: settings.langs,
    aspectRatio: settings.aspectRatio,
    createdAt,
  });
  const { uri, cid } = await deps.service.createPost(post.record(finished.blob));
  return { uri, cid };
}

/**
 * Poll the video service until it hands back a blob, or fails, or we give up.
 *
 * The blob — not the state — says "done". Bluesky's own warning: a video it has
 * already processed comes back as an *error* that still carries the blob, so a
 * failure with a blob in hand is a success, and the state is only read when there
 * is no blob to use.
 */
async function waitForVideo(
  deps: PublicationDeps,
  first: VideoJob,
  wait: (ms: number) => Promise<void>,
  maxPolls: number,
  interval: number,
): Promise<VideoJob> {
  let job = first;
  for (let polls = 0; !job.blob && polls <= maxPolls; polls++) {
    if (job.state === 'JOB_STATE_FAILED') return job;
    deps.onProgress?.({ stage: 'processing', progress: job.progress });
    await wait(interval);
    job = await deps.service.videoJob(job.jobId);
  }
  return job;
}

function whyStillNoVideo(job: VideoJob, minutes: number): string {
  if (job.state === 'JOB_STATE_FAILED') {
    return 'Bluesky could not process the video: '
      + (job.message || job.error || job.failureCode || job.state);
  }
  return `Bluesky is still processing the video after ${minutes} minutes`;
}
