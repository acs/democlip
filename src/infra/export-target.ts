// The two containers the export can write, and what each one needs.
//
// The download is WebM; the Bluesky path needs MP4, which is the only thing
// Bluesky's video service takes. Which container to write is an encode-time
// choice, not part of the plan — the plan is the same kept stretches either way —
// so it arrives as a target, and this table turns it into the mime the blob is
// born with and the codecs to probe. The probes are WebCodecs strings, so the
// browser answers whether it can encode them, exactly as the WebM path already
// asks; only the names on the left are Mediabunny's.
//
// Kept apart from src/offline-export.ts and free of any browser, so the table can
// be read and tested in node while the module that encodes cannot.

import type { ExportTarget } from '../domain/export/ExportTarget.js';

export type { ExportTarget };

/** One video codec Mediabunny knows, and the WebCodecs strings that probe it. */
export interface VideoCodecChoice {
  name: 'vp9' | 'vp8' | 'avc';
  /** The WebCodecs codec strings to try, in order, for a given picture size. */
  probes: (width: number, height: number) => readonly string[];
}

/** The size the encoder is given: some codecs refuse one a crop produced. */
export interface Picture {
  width: number;
  height: number;
}

/** The picture as the crop made it: for a codec that takes any size. */
export function wholePicture(width: number, height: number): Picture {
  return { width, height };
}

/**
 * The picture taken down to the even size below it.
 *
 * H.264 codes colour at half resolution, so both edges have to be even, and an odd
 * one is refused outright: every `avc1.*` probe comes back "no", and the export
 * says "this browser cannot encode MP4 offline" while VP9 takes the very same
 * picture. A crop region is whatever the drag was — a 985×611 one is perfectly
 * ordinary — so an odd edge made every MP4 export impossible and every WebM one
 * fine. Both edges come down by at most one pixel, which the eye is not at.
 */
export function evenPicture(width: number, height: number): Picture {
  return { width: Math.max(2, width - (width % 2)), height: Math.max(2, height - (height % 2)) };
}

export interface TargetSpec {
  mime: string;
  video: readonly VideoCodecChoice[];
  audio: 'opus' | 'aac';
  /** The picture the encoder will take, from the one the crop produced. */
  picture: (width: number, height: number) => Picture;
}

export function specFor(target: ExportTarget): TargetSpec {
  return target === 'mp4'
    ? { mime: 'video/mp4', video: [{ name: 'avc', probes: avcProbes }], audio: 'aac', picture: evenPicture }
    : {
        mime: 'video/webm',
        video: [
          { name: 'vp9', probes: () => ['vp09.00.10.08'] },
          { name: 'vp8', probes: () => ['vp8'] },
        ],
        audio: 'opus',
        picture: wholePicture,
      };
}

// AVC is not one codec string: how large a picture it may carry is fixed by the
// level in the string, and a string whose level is too small is refused outright.
// That is the bug this table exists to prevent — `avc1.42001f` is level 3.1, good
// only to 1280x720, so a 1080p or larger capture probed as "cannot encode MP4"
// while the browser could encode it perfectly well. The level is chosen from the
// picture's 16x16 macroblocks, and the profiles are tried High, Main, Baseline —
// the order an encoder is most likely to accept.
const AVC_LEVELS: ReadonlyArray<{ maxMacroblocks: number; level: string }> = [
  { maxMacroblocks: 3600, level: '1f' },      // 3.1 — up to 1280x720
  { maxMacroblocks: 8192, level: '28' },      // 4.0 — up to 1920x1080
  { maxMacroblocks: 22080, level: '32' },     // 5.0 — up to 2560x1440
  { maxMacroblocks: 36864, level: '33' },     // 5.1 — up to 4096x2160
  { maxMacroblocks: 139264, level: '3c' },    // 6.0 — up to 8192x4320
  { maxMacroblocks: Infinity, level: '3e' },  // 6.2 — beyond
];

/** The WebCodecs strings to probe AVC at a picture size, the level grown to fit it. */
export function avcProbes(width: number, height: number): readonly string[] {
  const macroblocks = Math.ceil(width / 16) * Math.ceil(height / 16);
  const level = AVC_LEVELS.find(rung => macroblocks <= rung.maxMacroblocks)!.level;
  return [`avc1.6400${level}`, `avc1.4d00${level}`, `avc1.4200${level}`];
}

// Screen content is mostly flat, with small sharp text — and H.264 smears that text
// long before the bitrate is "enough" for camera video of the same size. A flat
// 4 Mbps looks fine at 720p and turns a 1440p screen's type to mush, which is
// exactly what a 3440x1440 recording got. These are bits per pixel per frame at
// 30fps.
//
// The least and the most are this app's own bounds on a saved file, and not any
// destination's. The least is a **share** of what the picture asks, never a flat
// rate: a flat floor sits above the rule for every picture under about 1.1
// megapixels, so 720p, 480p and a 360p picture all came out at one bitrate — and a
// smaller **export resolution** then wrote a file no smaller, which is the one thing
// it exists to do. A share leaves the picture's own rule in charge at every size, and
// still refuses a file whose budget cannot afford even that much. A destination with
// a limit of its own passes it as `fit` below, which bounds this further; nothing
// here knows what that destination is.
const BITS_PER_PIXEL = 0.12;
/** The least the app writes: a quarter of what the picture asks. Below it, the file is not that picture. */
const MIN_SHARE = 0.25;
/** A sanity bound under the share: nothing is written below this, however tiny the picture. */
const MIN_BITRATE = 100_000;
const BITRATE_CEILING = 24_000_000;
// A tenth off, so a budget-sized file lands under the limit rather than on it.
const FIT_MARGIN = 0.9;

/** A file that has to fit somewhere: how long it is, and how many bytes it may take. */
export interface FitBudget {
  seconds: number;
  bytes: number;
}

/**
 * What a byte budget affords for a clip of this length, in bits per second, before the
 * app's own floor and ceiling are applied. The margin keeps a budget-sized file under
 * the limit rather than on it.
 */
export function affordableBitrate(fit: FitBudget): number {
  return fit.seconds > 0
    ? Math.round((fit.bytes * 8 * FIT_MARGIN) / fit.seconds)
    : Number.POSITIVE_INFINITY;
}

/**
 * The bitrate to encode at: what the picture asks first — screen content needs far more bits than
 * camera video of the same size, and it asks in proportion to its own pixels, so a smaller picture
 * is a smaller file — and then, when the file has to fit somewhere, held under that destination's
 * byte budget for the clip's length: a long clip at a picture-sized bitrate can be several times
 * the size of what it is going into. The share wins where even the budget cannot be met, and the
 * caller is better off refusing a clip that long.
 */
export function videoBitrate(width: number, height: number, fit?: FitBudget): number {
  const wanted = Math.round(width * height * 30 * BITS_PER_PIXEL);
  const affordable = fit ? affordableBitrate(fit) : Number.POSITIVE_INFINITY;
  const least = Math.max(Math.round(wanted * MIN_SHARE), MIN_BITRATE);
  return Math.min(Math.max(Math.min(wanted, affordable), least), BITRATE_CEILING);
}

/**
 * Whether the app can write a file of this length inside this budget at all.
 *
 * `videoBitrate` will not go below its share of what the picture asks, so a budget that affords
 * less than that over the clip is one the file will miss however it is encoded. The caller is
 * better off refusing that export than writing a file that is not the picture; this is the
 * question it asks before starting.
 */
export function fitsBudget(width: number, height: number, fit: FitBudget): boolean {
  return videoBitrate(width, height, fit) <= affordableBitrate(fit);
}
