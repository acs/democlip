// A recorded take: one press of Record.
//
// It has identity — a session's takes are numbered, and the element, the waveform
// and the export all have to mean the same one — and it has a lifetime: the blob
// it holds and the object URL that plays it. The URL is made and revoked by
// TakeRepository, which is the only thing that reaches the browser for it.
//
// A take has to have a length, because the joined timeline is the sum of them: a
// zero-length take would make every position after it wrong, so it cannot be
// constructed. Its picture may be known when it arrives, and may not: it is what the
// clip's own size is derived from, so a take that carries one is a take the clip can
// size itself by.

import type { Picture } from './ClipSize.js';

export class Take {
  private constructor(
    readonly id: number,
    readonly blob: Blob,
    readonly url: string,
    readonly duration: number,
    /**
     * The size of this take's own picture, when the browser has measured it. It is
     * what the clip's own size is derived from, so a recorded or imported take
     * carries it; null is a take whose picture has not been measured.
     */
    readonly picture: Picture | null,
  ) {}

  static of(id: number, blob: Blob, url: string, duration: number, picture: Picture | null = null): Take {
    if (!(duration > 0)) throw new Error(`a take needs a length, got ${duration}`);
    if (picture && !(picture.width > 0 && picture.height > 0)) {
      throw new Error(`a take's picture needs a size, got ${picture.width}x${picture.height}`);
    }
    return new Take(id, blob, url, duration, picture ?? null);
  }

  /** Two takes are the same take when they are the same recording, not the same bytes. */
  equals(other: Take): boolean {
    return this.id === other.id;
  }
}
