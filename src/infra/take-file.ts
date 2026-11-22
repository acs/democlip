// The take file inspector: reading a chosen video file before it becomes a take.
//
// Mediabunny reads the container's header — the same library the export decodes the
// takes with — so a file the inspector accepts is one the export can read back. It
// is handed a `BlobSource`, so the file is read in ranges rather than copied into
// memory whole, which matters for a file that may be hundreds of megabytes.

import { BlobSource, Input, MP4, WEBM } from 'mediabunny';
import type { TakeFileInfo, TakeFilePort } from '../application/ports/TakeFilePort.js';

export class TakeFileInspector implements TakeFilePort {
  async inspect(file: Blob): Promise<TakeFileInfo> {
    const input = new Input({ source: new BlobSource(file), formats: [WEBM, MP4] });
    try {
      const video = await input.getPrimaryVideoTrack();
      if (!video) throw new Error('the file has no video track');
      const duration = await input.computeDuration();
      const audio = await input.getPrimaryAudioTrack();
      const width = await video.getDisplayWidth();
      const height = await video.getDisplayHeight();
      const picture = width > 0 && height > 0 ? { width, height } : null;
      return { duration, hasAudio: !!audio, picture };
    } finally {
      input.dispose();
    }
  }
}

export const takeFile = new TakeFileInspector();
