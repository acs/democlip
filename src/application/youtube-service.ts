// The YouTube side of publishing, as the use case needs to see it.
//
// A port, not a client: the use case sequences "write the MP4, send it, hand it over",
// and everything that needs a token, the network or a browser sits behind this. That is
// what lets the sequencing be tested in node against a fake.
//
// **One call, because the destination allows one.** The app asks for `youtube.upload`
// alone — nothing that reads the person's account — and `videos.insert` is the one
// YouTube call that scope authorizes. Watching the video be processed would need
// `videos.list`, which it does not: asking for it would mean asking a person to hand over
// read access to their whole channel to draw a progress line. So the upload ends when
// YouTube has taken the video, and what YouTube does with it afterwards is **said** rather
// than watched (`research.md` D4).

import type { UploadableVideo } from '../domain/youtube/UploadableVideo.js';
import type { VideoDetails } from '../domain/youtube/VideoDetails.js';

/** How much of the video's bytes have gone: 0..1. */
export type UploadProgress = (fraction: number) => void;

/** The video as YouTube has it: the id it gave it. */
export interface UploadedVideo {
  readonly id: string;
}

export interface YouTubeService {
  /**
   * Send the video, with the details it is to be given, reporting how much of it has
   * gone. Answers with the id YouTube gave the video.
   */
  uploadVideo(video: UploadableVideo, details: VideoDetails, progress: UploadProgress): Promise<UploadedVideo>;
}
