// The export's size, as the clip's own settings show it.
//
// Drafting advice rather than a rule, which is why it moved out of the domain when
// the domain got a shape: nothing here decides anything, it only puts a number
// where a person can see it.
//
// The number is what the export **aims for**: the bitrate the encoder is configured with at this
// picture size — the same function, so the two cannot drift — times the clip's kept length. It
// follows the picture, so a 1440p screen is not quietly estimated as if it were 720p, and the
// **export resolution** moves it, which is the point of showing it.
//
// One bare figure, under the button that writes the file: no label, no container and no range —
// what the encoder aims at is the one number the app can stand behind, and the WebM and the MP4
// come out all but the same size.

import { videoBitrate } from '../../infra/export-target.js';

/** The audio the export writes at, in bits per second — the encoder's own rate, for the same reason. */
const AUDIO_BITRATE = 128_000;

/** What a picture export comes to at this size, in MB, at the bitrate the encoder aims for. */
export function estimatePictureText(clipSeconds: number, width = 1280, height = 720): string {
  return megabytes(clipSeconds, videoBitrate(width, height));
}

/** The audio a **sound-only** clip comes to, which has no picture to size it by. */
export function estimateSoundText(clipSeconds: number): string {
  return megabytes(clipSeconds, AUDIO_BITRATE);
}

/** How many megabytes a stream of this bitrate comes to over this many seconds. */
function megabytes(seconds: number, bitsPerSecond: number): string {
  return `${((seconds * bitsPerSecond) / 8 / 1_000_000).toFixed(1)}MB`;
}
