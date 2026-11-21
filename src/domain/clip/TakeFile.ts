// A video file chosen to become a take.
//
// Importing is the one way a take arrives that nothing was recorded for: the file
// is already a finished recording, so its own bytes become the take and nothing is
// re-encoded. But the export has to decode every take it writes, and not every
// container comes back — so a file is importable only when its container is one the
// export reads: WebM or MP4. This is the rule that says which. The picker's own
// filter shows the same two, but a filter is a convenience rather than a guarantee.
//
// The container is read off the file's own type where the browser gives one, and
// off its name only where it gives none — a file the system does not recognise
// arrives with an empty type. A type that names a video container we do not take
// (QuickTime, Matroska) is refused rather than second-guessed by its extension.

export type TakeContainer = 'webm' | 'mp4';

export class TakeFile {
  private constructor(
    readonly name: string,
    readonly container: TakeContainer,
  ) {}

  /** The file, when it is one the app can take in; null when it is not. */
  static of(name: string, type: string): TakeFile | null {
    const container = containerOf(type, name);
    return container ? new TakeFile(name, container) : null;
  }

  /** The media type the file's bytes are. */
  get mime(): string {
    return this.container === 'mp4' ? 'video/mp4' : 'video/webm';
  }
}

function containerOf(type: string, name: string): TakeContainer | null {
  const bare = type.toLowerCase().split(';')[0].trim();
  if (bare === 'video/webm') return 'webm';
  if (bare === 'video/mp4') return 'mp4';
  if (bare.startsWith('video/')) return null;      // a video container we do not take
  return containerFromName(name);                   // the browser gave no type at all
}

function containerFromName(name: string): TakeContainer | null {
  const dot = name.lastIndexOf('.');
  if (dot < 0) return null;
  const ext = name.slice(dot + 1).toLowerCase();
  if (ext === 'webm') return 'webm';
  if (ext === 'mp4' || ext === 'm4v') return 'mp4';
  return null;
}
