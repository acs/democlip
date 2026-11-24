// A media file chosen to become a take: a recording with a picture, or one with only sound.
//
// Importing is the one way a take arrives that nothing was recorded for: the file
// is already a finished recording, so its own bytes become the take and nothing is
// re-encoded. But the export has to decode every take it writes, and not every
// container comes back — so a file is importable only when its container is one the
// export reads: WebM or MP4. This is the rule that says which, for a video and for
// the sound-only file an audio export writes. The picker's own filter shows the same
// two, but a filter is a convenience rather than a guarantee.
//
// The container is read off the file's own type where the browser gives one, and
// off its name only where it gives none — a file the system does not recognise
// arrives with an empty type. A type that names a container we do not take
// (QuickTime, Matroska, MP3) is refused rather than second-guessed by its extension.

export type TakeContainer = 'webm' | 'mp4';

/** Whether the file is a recording with a picture, or a sound-only one. */
export type TakeMedia = 'video' | 'audio';

export class TakeFile {
  private constructor(
    readonly name: string,
    readonly container: TakeContainer,
    readonly media: TakeMedia,
  ) {}

  /** The file, when it is one the app can take in; null when it is not. */
  static of(name: string, type: string): TakeFile | null {
    const found = containerOf(type, name);
    return found ? new TakeFile(name, found.container, found.media) : null;
  }

  /** The media type the file's bytes are. */
  get mime(): string {
    return `${this.media}/${this.container}`;
  }
}

function containerOf(type: string, name: string): { container: TakeContainer; media: TakeMedia } | null {
  const bare = type.toLowerCase().split(';')[0].trim();
  const container = bare.endsWith('/webm') ? 'webm'
    : bare.endsWith('/mp4') ? 'mp4'
    : null;
  if (container && (bare.startsWith('video/') || bare.startsWith('audio/'))) {
    return { container, media: bare.startsWith('audio/') ? 'audio' : 'video' };
  }
  if (bare.startsWith('video/') || bare.startsWith('audio/')) return null;   // a container we do not take
  const fromName = containerFromName(name);         // the browser gave no type at all
  return fromName ? { container: fromName, media: 'video' } : null;
}

function containerFromName(name: string): TakeContainer | null {
  const dot = name.lastIndexOf('.');
  if (dot < 0) return null;
  const ext = name.slice(dot + 1).toLowerCase();
  if (ext === 'webm') return 'webm';
  if (ext === 'mp4' || ext === 'm4v') return 'mp4';
  return null;
}
