// The YouTube side of publishing, as the use case needs to see it.
//
// A port, not a client: the use case sequences "write the MP4, send it, wait for
// YouTube to finish with it", and everything that needs a token, the network or a
// browser sits behind this. That is what lets the sequencing be tested in node
// against a fake, and it is the seam the token-backed client (the resumable session
// and the status poll) sits behind.
//
// Two calls, because the destination has two moments: `uploadVideo` ends when the
// bytes are up, and `videoStatus` is what turns "sent" into "ready".

import type { UploadableVideo } from '../domain/youtube/UploadableVideo.js';
import type { VideoDetails } from '../domain/youtube/VideoDetails.js';

/** How much of the video's bytes have gone: 0..1. */
export type UploadProgress = (fraction: number) => void;

/** The video as YouTube has it: the id it gave it. */
export interface UploadedVideo {
  readonly id: string;
}

/** Where YouTube has got to with an uploaded video. */
export interface VideoStatus {
  readonly state: 'processing' | 'ready' | 'failed';
  /** 0..100 while it is processing, when the service says. */
  readonly progress?: number;
  /** Why it failed, when it did. */
  readonly reason?: string;
}

export interface YouTubeService {
  /**
   * Send the video, with the details it is to be given, reporting how much of it has
   * gone. Answers with the id YouTube gave the video.
   */
  uploadVideo(video: UploadableVideo, details: VideoDetails, progress: UploadProgress): Promise<UploadedVideo>;
  /** Ask YouTube where an uploaded video has got to. */
  videoStatus(videoId: string): Promise<VideoStatus>;
}
