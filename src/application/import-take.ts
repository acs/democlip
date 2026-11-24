// The import use case: a media file becomes a take — one with a picture, or one with only
// sound.
//
// The file is already a finished recording, so there is nothing to record: it is read for
// its length, its sound and its picture, and it is appended to the clip as a take, exactly
// as a pressed Record appends one — same addTake, same events, same kept copy. A take needs
// a length, so a file that has none is refused. A refusal is a value, not an exception; the
// flow reports it.
//
// A file may also arrive with its **sidecar**: the annotations an export wrote beside the
// video rather than drawing them in. They are fractions of the file, and the file becomes
// a stretch of the clip, so they are scaled to the clip and moved over that stretch — a
// clip that went out to be worked on comes back whole, wherever it lands.

import type { Clip } from '../domain/clip/Clip.js';
import type { Take } from '../domain/clip/Take.js';
import { TakeFile } from '../domain/clip/TakeFile.js';
import { Span } from '../domain/clip/Span.js';
import { AnnotationSet } from '../domain/annotation/AnnotationSet.js';
import type { AnnotationSidecar } from '../domain/clip/AnnotationSidecar.js';
import type { ImageStorePort } from './ports/ImageStorePort.js';
import type { TakeFilePort } from './ports/TakeFilePort.js';

export type ImportOutcome =
  | { kind: 'imported'; take: Take; hasAudio: boolean; annotations?: CarriedAnnotations }
  | { kind: 'refused'; reason: string }
  | { kind: 'failed'; reason: string };

/** What became of the annotations a sidecar carried, when one came with the file. */
export interface CarriedAnnotations {
  /** How many became the clip's. */
  readonly count: number;
  /** Why none did, when none did. */
  readonly reason?: string;
}

/** The file a person chose, as the browser gave it. */
export interface ImportInput {
  readonly name: string;
  readonly type: string;
  readonly blob: Blob;
}

export interface ImportDeps {
  readonly clip: Clip;
  readonly files: TakeFilePort;
  /** Where the pictures a sidecar carries are put back. Without it they stay in the file. */
  readonly pictures?: ImageStorePort;
  /** Told the file's sound *before* the take is added, so the kept copy carries it. */
  readonly setAudio?: (hasAudio: boolean) => void;
}

export class ImportTake {
  constructor(private readonly deps: ImportDeps) {}

  async run(file: ImportInput, sidecar?: AnnotationSidecar | null): Promise<ImportOutcome> {
    if (!TakeFile.of(file.name, file.type)) {
      return { kind: 'refused', reason: 'Only WebM and MP4 files can be imported.' };
    }
    let info;
    try {
      info = await this.deps.files.inspect(file.blob);
    } catch {
      return { kind: 'failed', reason: 'The file could not be read as a recording.' };
    }
    if (!(info.duration > 0)) return { kind: 'refused', reason: 'That file has no length.' };

    // A sidecar's annotations are fractions of the file it was written for, so they are
    // taken on only when this is that file: a frame's drift is nothing, another length is
    // another clip.
    const carried = sidecar?.forLength(info.duration) ?? null;

    this.deps.setAudio?.(info.hasAudio);
    const take = this.deps.clip.addTake(file.blob, info.duration, info.picture);

    const annotations = !sidecar ? undefined
      : carried ? await this.carryThem(sidecar, carried, info.duration)
      : { count: 0, reason: itsOwnFile(sidecar.length, info.duration) };

    return { kind: 'imported', take, hasAudio: info.hasAudio, ...(annotations ? { annotations } : {}) };
  }

  /**
   * The annotations over the stretch the file was given. Each is a **new** annotation like
   * the one that left, over that stretch: the file is not where it was, and the clip it
   * comes back to may still hold the originals — which is exactly what appending does — so
   * they arrive with identities of their own rather than colliding with what is there.
   *
   * The pictures they draw go back into the store first, so the first frame has them.
   */
  private async carryThem(sidecar: AnnotationSidecar, carried: AnnotationSet, length: number): Promise<CarriedAnnotations> {
    for (const picture of sidecar.pictures) {
      await this.deps.pictures?.put(picture.id, picture.blob).catch(() => {});
    }
    const total = this.deps.clip.total();
    const start = Math.max(0, total - length);
    const at = (fraction: number): number => (start + fraction * length) / total;
    const placed = AnnotationSet.of(carried.all.map(annotation =>
      annotation.duplicated(Span.of(at(annotation.span.s), at(annotation.span.e)))));
    return { count: this.deps.clip.carry(placed) };
  }
}

/** Why a sidecar's annotations are not the clip's: the file is not the one they were written for. */
function itsOwnFile(written: number, file: number): string {
  return `the annotations were written for a ${seconds(written)} file, and this one is ${seconds(file)}`;
}

function seconds(value: number): string {
  return `${Math.round(value * 10) / 10}s`;
}
