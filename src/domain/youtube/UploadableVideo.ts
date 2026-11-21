// The video YouTube takes: the MP4 bytes, the name it travels under, and the
// destination's own ceilings.
//
// `videos.insert` takes `video/*` or `application/octet-stream`, at most 256 GB, and a
// default account may upload at most fifteen minutes — a verified one longer, which this
// app cannot read and so does not assume. DemoClip records WebM, so the export that
// feeds this writes MP4; a WebM blob is not constructible here, which is the point of the
// type rather than a check every caller has to remember.
//
// Only the length binds. At the app's own bitrate ceiling (see `infra/export-target.ts`,
// 24 Mbps) a fifteen-minute file is about 2.7 GB — two orders of magnitude under the byte
// ceiling — so the use case asks the length before it plans anything and the encoder is
// given no byte budget at all.

export const VIDEO_MIME = 'video/mp4';
export const VIDEO_MAX_BYTES = 256 * 1000 ** 3;
/** The ceiling for a default account: fifteen minutes. */
export const VIDEO_MAX_SECONDS = 15 * 60;

export class UploadableVideo {
  private constructor(
    readonly blob: Blob,
    readonly name: string,
  ) {}

  static of(blob: Blob, name: string): UploadableVideo {
    if (blob.type !== VIDEO_MIME) {
      throw new Error(`YouTube takes ${VIDEO_MIME}, not ${blob.type || 'an unknown type'}`);
    }
    if (blob.size <= 0) throw new Error('an uploadable video cannot be empty');
    if (blob.size > VIDEO_MAX_BYTES) {
      throw new Error(`a YouTube video is at most ${VIDEO_MAX_BYTES} bytes, got ${blob.size}`);
    }
    return new UploadableVideo(blob, name);
  }
}
