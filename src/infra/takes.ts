// The session's recordings, and the browser handle that plays each one.
//
// In memory, on purpose: a session lives in the page and nothing is saved. What
// the repository is for is the object URL — making one when a take arrives, and
// revoking every one of them when the session is dropped. That used to be a
// parallel array of URLs inside the player and a `releaseParts()` the exporter
// also had to call, which is how you play a revoked URL or leak the ones nobody
// released.
//
// If sessions are ever persisted, this is the seam: the takes would be written
// and read back here, and nothing outside would have to know.

import { Take } from '../domain/clip/Take.js';
import type { TakeRepository } from '../domain/clip/TakeRepository.js';
import type { Picture } from '../domain/clip/ClipSize.js';

export class InMemoryTakeRepository implements TakeRepository {
  private takes: Take[] = [];
  private nextId = 1;

  /** A new take at the end of the session, with the URL that plays it. */
  add(blob: Blob, duration: number, picture?: Picture | null, hasAudio = false): Take {
    const take = Take.of(this.nextId++, blob, URL.createObjectURL(blob), duration, picture ?? null, hasAudio);
    this.takes.push(take);
    return take;
  }

  /** The takes in the order they were recorded. */
  all(): readonly Take[] {
    return this.takes;
  }

  /** By position on the joined timeline, which is the order they were recorded in. */
  at(index: number): Take | undefined {
    return this.takes[index];
  }

  count(): number {
    return this.takes.length;
  }

  isEmpty(): boolean {
    return this.takes.length === 0;
  }

  /** Where a take begins on the joined timeline. */
  startOf(index: number): number {
    let at = 0;
    for (let i = 0; i < index && i < this.takes.length; i++) at += this.takes[i].duration;
    return at;
  }

  /** Which take holds a moment of the joined timeline. */
  indexAt(seconds: number): number {
    for (let i = 0; i < this.takes.length; i++) {
      if (seconds < this.startOf(i) + this.takes[i].duration) return i;
    }
    return Math.max(0, this.takes.length - 1);
  }

  /** How long the joined clip is. */
  totalDuration(): number {
    return this.takes.reduce((total, take) => total + take.duration, 0);
  }

  /** The session is over: nothing is left holding its recordings alive. */
  clear(): void {
    for (const take of this.takes) URL.revokeObjectURL(take.url);
    this.takes = [];
  }
}
