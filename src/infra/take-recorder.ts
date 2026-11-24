// The take recorder: MediaRecorder and the bytes it collects.
//
// It owns the recorder, its chunks and when it started. It starts on the stream the
// compositor built and stops with the blob a take is made from. A stream with no
// video track is a **sound-only** take, and the blob says so: `audio/webm` rather
// than `video/webm`, so the player, the probe and the store all read it for what it is.

import { getBestMime } from './codecs.js';
import type { TakeRecorderPort } from '../application/ports/TakeRecorderPort.js';

export class TakeRecorderAdapter implements TakeRecorderPort {
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private startedAt = 0;
  private blobType = 'video/webm';

  start(stream: MediaStream): void {
    const hasVideo = stream.getVideoTracks().length > 0;
    const hasAudio = stream.getAudioTracks().length > 0;
    const mime = getBestMime(hasVideo, hasAudio);
    this.blobType = mime?.split(';')[0] ?? (hasVideo ? 'video/webm' : 'audio/webm');
    this.chunks = [];
    this.recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : {});
    this.recorder.ondataavailable = event => {
      if (event.data.size > 0) this.chunks.push(event.data);
    };
    this.recorder.start(100);
    this.startedAt = Date.now();
  }

  stop(): Promise<Blob> {
    const recorder = this.recorder;
    if (!recorder || recorder.state === 'inactive') return Promise.resolve(new Blob());
    return new Promise(resolve => {
      recorder.addEventListener('stop', () => {
        const blob = new Blob(this.chunks, { type: this.blobType });
        this.recorder = null;
        this.chunks = [];
        resolve(blob);
      }, { once: true });
      recorder.stop();
    });
  }

  isRecording(): boolean {
    return this.recorder?.state === 'recording';
  }

  /** When the current take started, for the wall-clock fallback. */
  startedAtMs(): number {
    return this.startedAt;
  }
}

export const takeRecorder = new TakeRecorderAdapter();
