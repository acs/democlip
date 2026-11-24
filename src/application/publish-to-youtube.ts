// The publish-to-YouTube use case: put the clip's export on the person's own channel.
//
// It has the shape of the Bluesky publish — read the clip, decide what to write, hand it
// on — and two things that are this destination's own.
//
// The **ceiling is asked before anything is encoded**: a default account may upload at
// most fifteen minutes, and a clip past it can never go, so encoding it first would be
// minutes of work spent for a refusal the destination would give anyway.
//
// And the upload **ends when YouTube has taken the video**, not when YouTube has finished
// with it. The app is allowed one call — `videos.insert` — because it asks for the upload
// scope and nothing that reads the person's account; watching the video being processed
// would need `videos.list`, which the scope does not authorize, and asking a person to
// hand over read access to their channel to draw a progress line is not a trade worth
// making. So the address the person is given is true and immediate, and what YouTube is
// still doing with the video is said in words rather than pretended to be known
// (`research.md` D4).
//
// None of the browser work — the token, the chunks — happens here. It is all behind
// `YouTubeDeps`, so the sequencing runs in node against a fake.

import type { Clip } from '../domain/clip/Clip.js';
import type { ExportPlan, ExportSettings } from '../domain/clip/ExportPlan.js';
import { UploadableVideo, VIDEO_MAX_SECONDS } from '../domain/youtube/UploadableVideo.js';
import { VideoDetails, watchUrl } from '../domain/youtube/VideoDetails.js';
import type { YouTubeService } from './youtube-service.js';
import { planExport } from './export-clip.js';

export type YouTubeStage = 'encoding' | 'uploading';

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
  onProgress?: (progress: YouTubePublicationProgress) => void;
}

export interface YouTubePublication {
  readonly id: string;
  readonly url: string;
}

export async function publishToYouTube(
  clip: Clip,
  settings: YouTubePublicationSettings,
  deps: YouTubeDeps,
): Promise<YouTubePublication> {
  const plan = planExport(clip, settings.export);
  if (!plan) throw new Error('nothing to publish');
  // YouTube takes a video, and a clip whose kept stretches have no picture is sound only.
  // Refuse here — before a frame is encoded or a byte is uploaded — rather than let a
  // sound file reach a video service and be turned away there.
  if (plan.soundOnly) {
    throw new Error('YouTube takes a video, and this clip is sound only — it has no picture to write. Export it as a file instead');
  }
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

  return { id: uploaded.id, url: watchUrl(uploaded.id) };
}
