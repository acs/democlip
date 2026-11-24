// The takes a clip is made of.
//
// An interface rather than the implementation, because the aggregate that owns
// the takes must not know how they are held: the app keeps them in memory and
// hands out object URLs, and that is an adapter's business (`InMemoryTakeRepository`
// in src/infra/takes.ts). It is also what lets the aggregate be tested without a
// browser, which is most of the reason for having the seam.

import type { Take } from './Take.js';
import type { Picture } from './ClipSize.js';

export interface TakeRepository {
  /** A new take at the end of the clip, ready to play, with the size of its own picture and whether it carries sound. */
  add(blob: Blob, duration: number, picture?: Picture | null, hasAudio?: boolean): Take;

  /** The takes in the order they were recorded. */
  all(): readonly Take[];

  /** By position on the joined timeline, which is the order they were recorded in. */
  at(index: number): Take | undefined;

  count(): number;

  isEmpty(): boolean;

  /** Where the take at `index` begins on the joined timeline, in seconds. */
  startOf(index: number): number;

  /** Which take holds a moment of the joined timeline. */
  indexAt(seconds: number): number;

  /** How long the joined clip is. */
  totalDuration(): number;

  /** Nothing keeps the recordings alive any more. */
  clear(): void;
}
