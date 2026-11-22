// How long a recorded blob is, and how big its picture is.

import type { Picture } from '../../domain/clip/ClipSize.js';

/** What a take's blob says about itself: its length, and the size of its picture. */
export interface TakeMeasurement {
  /** How long the blob plays, in seconds. */
  readonly duration: number;
  /** The size of its picture, or null when the blob will not say. */
  readonly picture: Picture | null;
}

export interface TakeProbePort {
  /** A blob's length and picture size. Rejects when the blob cannot be read. */
  measure(blob: Blob): Promise<TakeMeasurement>;
}
