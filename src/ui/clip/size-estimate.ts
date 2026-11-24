// The export's size, as the timeline shows it.
//
// Drafting advice rather than a rule, which is why it moved out of the domain when
// the domain got a shape: nothing here decides anything, it only puts a number
// where a person can see it.
//
// The high end is the bitrate the export actually aims for at this picture size —
// the same function the encoder is configured from, so the two cannot drift — and
// the low end is a quarter of it, for a still screen. It follows the picture, so a
// 1440p screen is not quietly estimated as if it were 720p.

import { videoBitrate } from '../../infra/export-target.js';

export function estimateWebmText(clipSeconds: number, width = 1280, height = 720): string {
  const megabytesPerSecond = videoBitrate(width, height) / 8 / 1_000_000;
  const lo = clipSeconds * megabytesPerSecond * 0.25;
  const hi = clipSeconds * megabytesPerSecond;
  return `~${lo.toFixed(1)}–${hi.toFixed(1)} MB (WebM)`;
}

/** The audio the export writes, at its own bitrate: a **sound-only** clip has no picture to size. */
const AUDIO_BITRATE = 128_000;

export function estimateSoundText(clipSeconds: number): string {
  const megabytesPerSecond = AUDIO_BITRATE / 8 / 1_000_000;
  const lo = clipSeconds * megabytesPerSecond * 0.75;
  const hi = clipSeconds * megabytesPerSecond;
  return `~${lo.toFixed(1)}–${hi.toFixed(1)} MB (audio)`;
}
