// The take file inspector: reading a chosen media file before it becomes a take.
//
// Mediabunny reads the container's header — the same library the export decodes the
// takes with — so a file the inspector accepts is one the export can read back. It
// is handed a `BlobSource`, so the file is read in ranges rather than copied into
// memory whole, which matters for a file that may be hundreds of megabytes.
//
// A file may hold a picture, or only sound — an audio export of a **sound-only** clip
// is the second kind — so a missing video track is a picture the take does not have,
// not a file to refuse. A file with neither track is nothing the app can play.

import { BlobSource, Input, MP4, WEBM } from 'mediabunny';
import type { TakeFileInfo, TakeFilePort } from '../application/ports/TakeFilePort.js';

export class TakeFileInspector implements TakeFilePort {
  async inspect(file: Blob): Promise<TakeFileInfo> {
    const input = new Input({ source: new BlobSource(file), formats: [WEBM, MP4] });
    try {
      const video = await input.getPrimaryVideoTrack();
      const audio = await input.getPrimaryAudioTrack();
      if (!video && !audio) throw new Error('the file has no sound or picture');
      const duration = await input.computeDuration();
      const width = video ? await video.getDisplayWidth() : 0;
      const height = video ? await video.getDisplayHeight() : 0;
      const picture = width > 0 && height > 0 ? { width, height } : null;
      return { duration, hasAudio: !!audio, picture };
    } finally {
      input.dispose();
    }
  }
}

export const takeFile = new TakeFileInspector();
