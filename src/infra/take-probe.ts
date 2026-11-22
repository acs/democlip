// The take probe: how long a recorded blob really is, and how big its picture is.
//
// A MediaRecorder WebM often reports `Infinity` until it is seeked past its end.
// The probe hides that in the browser boundary and answers with a number, and reads
// the element's own picture size while it is there — the one moment a recorded blob
// is loaded and can be measured.

import type { TakeMeasurement, TakeProbePort } from '../application/ports/TakeProbePort.js';

export class TakeProbeAdapter implements TakeProbePort {
  async measure(blob: Blob): Promise<TakeMeasurement> {
    const video = document.createElement('video');
    video.preload = 'metadata';
    const url = URL.createObjectURL(blob);
    video.src = url;
    try {
      await new Promise<void>((resolve, reject) => {
        video.addEventListener('loadedmetadata', () => resolve(), { once: true });
        video.addEventListener('error', () => reject(new Error('cannot read the take')), { once: true });
      });
      const picture = video.videoWidth > 0 && video.videoHeight > 0
        ? { width: video.videoWidth, height: video.videoHeight }
        : null;
      if (Number.isFinite(video.duration) && video.duration > 0.1) return { duration: video.duration, picture };
      // Seek past the end to force the browser to read the real duration.
      await new Promise<void>(resolve => {
        video.addEventListener('durationchange', () => resolve(), { once: true });
        video.currentTime = 1e101;
        setTimeout(resolve, 1500);
      });
      const duration = Number.isFinite(video.duration) && video.duration > 0.1 ? video.duration : 0;
      return { duration, picture };
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

export const takeProbe = new TakeProbeAdapter();
