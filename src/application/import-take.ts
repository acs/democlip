// The import use case: a video file becomes a take.
//
// The file is already a finished recording, so there is nothing to record: it is
// read for its length and its sound, and it is appended to the clip as a take,
// exactly as a pressed Record appends one — same addTake, same events, same kept
// copy. A take needs a length, so a file that has none is refused. A refusal is a
// value, not an exception; the flow reports it.

import type { Clip } from '../domain/clip/Clip.js';
import type { Take } from '../domain/clip/Take.js';
import { TakeFile } from '../domain/clip/TakeFile.js';
import type { TakeFilePort } from './ports/TakeFilePort.js';

export type ImportOutcome =
  | { kind: 'imported'; take: Take; hasAudio: boolean }
  | { kind: 'refused'; reason: string }
  | { kind: 'failed'; reason: string };

/** The file a person chose, as the browser gave it. */
export interface ImportInput {
  readonly name: string;
  readonly type: string;
  readonly blob: Blob;
}

export interface ImportDeps {
  readonly clip: Clip;
  readonly files: TakeFilePort;
  /** Told the file's sound *before* the take is added, so the kept copy carries it. */
  readonly setAudio?: (hasAudio: boolean) => void;
}

export class ImportTake {
  constructor(private readonly deps: ImportDeps) {}

  async run(file: ImportInput): Promise<ImportOutcome> {
    if (!TakeFile.of(file.name, file.type)) {
      return { kind: 'refused', reason: 'Only WebM and MP4 videos can be imported.' };
    }
    let info;
    try {
      info = await this.deps.files.inspect(file.blob);
    } catch {
      return { kind: 'failed', reason: 'The file could not be read as a video.' };
    }
    if (!(info.duration > 0)) return { kind: 'refused', reason: 'That video has no length.' };
    this.deps.setAudio?.(info.hasAudio);
    return { kind: 'imported', take: this.deps.clip.addTake(file.blob, info.duration), hasAudio: info.hasAudio };
  }
}
