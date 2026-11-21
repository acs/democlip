import { describe, expect, it } from 'vitest';

import { UploadableVideo, VIDEO_MAX_BYTES, VIDEO_MAX_SECONDS } from './UploadableVideo.js';

const mp4 = (bytes = 1024): Blob => new Blob(['x'.repeat(bytes)], { type: 'video/mp4' });

// Blob.size is a getter, so a file too big to allocate is built by overriding it.
const sized = (size: number, type = 'video/mp4'): Blob =>
  Object.defineProperty(new Blob(['x'], { type }), 'size', { value: size }) as Blob;

describe('UploadableVideo', () => {
  it('is an MP4 with the name it travels under', () => {
    const blob = mp4();
    const video = UploadableVideo.of(blob, 'democlip-1.mp4');
    expect(video.blob).toBe(blob);
    expect(video.name).toBe('democlip-1.mp4');
  });

  it('refuses the WebM DemoClip records, which YouTube is not given', () => {
    expect(() => UploadableVideo.of(new Blob(['x'], { type: 'video/webm' }), 'a.webm'))
      .toThrow(/video\/mp4/);
  });

  it('refuses a type-less blob', () => {
    expect(() => UploadableVideo.of(new Blob(['x']), 'a')).toThrow(/unknown type/);
  });

  it('refuses an empty file', () => {
    expect(() => UploadableVideo.of(sized(0), 'a.mp4')).toThrow(/empty/);
  });

  it('takes a file right at the byte ceiling and refuses one over it', () => {
    expect(() => UploadableVideo.of(sized(VIDEO_MAX_BYTES), 'a.mp4')).not.toThrow();
    expect(() => UploadableVideo.of(sized(VIDEO_MAX_BYTES + 1), 'a.mp4')).toThrow(/at most/);
  });

  it('carries the length a default account may upload: fifteen minutes', () => {
    expect(VIDEO_MAX_SECONDS).toBe(900);
  });
});
