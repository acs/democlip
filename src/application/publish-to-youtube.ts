// The publish-to-YouTube use case: put the clip's export on the person's own channel.
//
// It has the shape of the Bluesky publish — read the clip, decide what to write, hand
// it on — and two things that are this destination's own.
//
// The **ceiling is asked before anything is encoded**: a default account may upload at
// most fifteen minutes, and a clip past it can never go, so encoding it first would be
// minutes of work spent for a refusal the destination would give anyway. And an upload
// finishing is **not** a video being ready: YouTube transcodes afterwards, so the
// status is polled until the video is ready or has failed, and only then is the address
// the person is given true.
//
// None of the browser work — the token, the chunks, the polling — happens here. It is
// all behind `YouTubeDeps`, so the sequencing runs in node against a fake.

import type { Clip } from '../domain/clip/Clip.js';
import type { ExportPlan, ExportSettings } from '../domain/clip/ExportPlan.js';
import { UploadableVideo, VIDEO_MAX_SECONDS } from '../domain/youtube/UploadableVideo.js';
import { VideoDetails, watchUrl } from '../domain/youtube/VideoDetails.js';
import type { VideoStatus, YouTubeService } from './youtube-service.js';
import { planExport } from './export-clip.js';

export type YouTubeStage = 'encoding' | 'uploading' | 'processing';

export interface YouTubePublicationProgress {
  stage: YouTubeStage;
  /** 0..100 within the stage, when the service says. */
  progress?: number;
}

export interface YouTubePublicationSettings {
  /** What of the clip to write — the same settings the export takes. */
  export: ExportSettings;
  /** What the video says: its title, its description, who may see it. */
  details: VideoDetails;
}

export interface YouTubeDeps {
  service: YouTubeService;
  /** Write the plan as MP4. The browser half; faked in tests. */
  encode: (plan: ExportPlan) => Promise<Blob>;
  now?: () => Date;
  wait?: (ms: number) => Promise<void>;
  onProgress?: (progress: YouTubePublicationProgress) => void;
  pollIntervalMs?: number;
  maxPolls?: number;
}

export interface YouTubePublication {
  readonly id: string;
  readonly url: string;
}

// A second between polls, as the Bluesky path uses. The budget follows the clip,
// because YouTube transcodes and that is not real time: a flat minute is outlived by a
// long clip, and the publish would then fail on a video the service was still working
// on. Twice the clip's length, floored, so even a very short one is given a minute.
const POLL_INTERVAL_MS = 1000;
const MIN_POLLS = 60;
const POLLS_PER_CLIP_SECOND = 2;

export async function publishToYouTube(
  clip: Clip,
  settings: YouTubePublicationSettings,
  deps: YouTubeDeps,
): Promise<YouTubePublication> {
  const plan = planExport(clip, settings.export);
  if (!plan) throw new Error('nothing to publish');
  // YouTube's ceiling for a default account. Refuse here rather than after encoding,
  // where the destination would say it anyway, having spent the work.
  if (plan.total > VIDEO_MAX_SECONDS) {
    throw new Error(`YouTube takes videos up to ${VIDEO_MAX_SECONDS / 60} minutes from this account — cut this clip to upload it`);
  }

  const now = deps.now ?? (() => new Date());
  const createdAt = now();

  deps.onProgress?.({ stage: 'encoding' });
  const video = UploadableVideo.of(
    await deps.encode(plan),
    `democlip-${createdAt.getTime()}.mp4`,
  );

  deps.onProgress?.({ stage: 'uploading' });
  const uploaded = await deps.service.uploadVideo(video, settings.details, fraction => {
    deps.onProgress?.({ stage: 'uploading', progress: Math.round(fraction * 100) });
  });

  const interval = deps.pollIntervalMs ?? POLL_INTERVAL_MS;
  const maxPolls = deps.maxPolls ?? Math.max(MIN_POLLS, Math.ceil(plan.total * POLLS_PER_CLIP_SECOND));
  const wait = deps.wait ?? ((ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms)));
  const status = await waitForVideo(deps, uploaded.id, wait, maxPolls, interval);
  if (status.state !== 'ready') {
    throw new Error(whyNotReady(status, Math.round((maxPolls * interval) / 60_000)));
  }

  return { id: uploaded.id, url: watchUrl(uploaded.id) };
}

/**
 * Poll the destination until the video is ready, or has failed, or we give up.
 *
 * The video's own readiness is the answer, not the upload's completion: YouTube
 * transcodes after the bytes are up, so a video that is still processing is reported as
 * such and the wait goes on.
 */
async function waitForVideo(
  deps: YouTubeDeps,
  videoId: string,
  wait: (ms: number) => Promise<void>,
  maxPolls: number,
  interval: number,
): Promise<VideoStatus> {
  let status = await deps.service.videoStatus(videoId);
  for (let polls = 0; status.state === 'processing' && polls < maxPolls; polls++) {
    deps.onProgress?.({ stage: 'processing', progress: status.progress });
    await wait(interval);
    status = await deps.service.videoStatus(videoId);
  }
  return status;
}

function whyNotReady(status: VideoStatus, minutes: number): string {
  if (status.state === 'failed') {
    return `YouTube could not take the video: ${status.reason || 'it did not say why'}`;
  }
  return `YouTube is still processing the video after ${minutes} minutes`;
}
