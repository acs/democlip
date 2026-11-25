// The export resolution: the size a clip's **file** is finally written at.
//
// A clip is worked in at its **clip size** — the frame the review shows, which every take is fitted
// into. The **export resolution** is a second, optional size, the one the file (and a publish) is
// written at; with none set, the file is the clip size, exactly as it was before this existed, so
// nothing changes for anyone who does not use it.
//
// It keeps the clip size's **aspect ratio**: it is the clip size **scaled** by one factor, both
// edges made even, so the file is the same picture as the review at fewer (or more) pixels —
// nothing cropped, nothing stretched, nothing letterboxed. That is also what makes it cheap: the
// encoder's canvas already *is* the picture it is handed, each take is fitted into it, and the
// annotations and the card are drawn from the canvas in fractions, so handing the export this
// picture instead of the clip size fits every take and draws everything to scale with no new
// drawing code.
//
// The encoder's bitrate follows the picture, so the resolution is what controls the file's size —
// a smaller resolution is a smaller file of the same clip.
//
// Nothing here touches a browser: it is arithmetic over a width and a height, so the whole rule is
// proved in node. The id lives here so the descriptor the panel draws — and the three paths that
// write a file, the download and the two publishes — all read the one string, as the sound boost's
// id is shared the same way.

import { ClipSize } from './ClipSize.js';
import type { ClipProperties } from './ClipProperties.js';

/** The clip property's id, in one place: the descriptor, the panel and the write paths share it. */
export const EXPORT_RESOLUTION_ID = 'exportResolution';

/**
 * The levels the app offers, as the number the clip's **shorter edge** is written at. Naming the
 * shorter edge is the one convention that reads right in every orientation — 1080p is the height
 * of a landscape clip and the width of a portrait one — and it is the same set of pictures either
 * way, because the clip size's aspect ratio is kept.
 */
export const LEVELS = [2160, 1440, 1080, 720, 480] as const;

/** One of the app's levels, or the clip size — the value the clip's own property holds. */
export class ExportResolution {
  private constructor(readonly value: string) {}

  /** The size that means "the clip size": the default, and the ordinary case. */
  static readonly CLIP_SIZE = new ExportResolution('');

  /**
   * A resolution from the value the clip holds: `''` is the clip size, a level is itself, and
   * anything else the app does not offer is **null** — the one refusal, so a hand-written profile,
   * a stored record or an agent cannot leave a clip on a size the app cannot write.
   */
  static of(value: string): ExportResolution | null {
    if (value === '') return ExportResolution.CLIP_SIZE;
    const level = Number(value);
    return isLevel(level) ? new ExportResolution(String(level)) : null;
  }

  /**
   * The picture the file is written at: the clip size itself, or the clip size scaled so its
   * **shorter edge** is this level, the aspect kept and both edges made even (through `ClipSize.of`).
   * It answers `null` only when the scaled picture runs past `ClipSize.MAX_EDGE`, so a very large
   * clip at a high level is written at the clip size rather than refusing the export.
   */
  picture(clipSize: ClipSize): ClipSize | null {
    if (this.value === '') return clipSize;
    const level = Number(this.value);
    const shorter = Math.min(clipSize.width, clipSize.height);
    const longer = Math.max(clipSize.width, clipSize.height);
    if (!(shorter > 0)) return clipSize;
    const scaled = (longer * level) / shorter;
    return clipSize.width <= clipSize.height
      ? ClipSize.of(level, scaled)
      : ClipSize.of(scaled, level);
  }

  /** What the resolution reads as where a person chooses it: `Clip size`, or `1080p`. */
  label(): string {
    return this.value === '' ? 'Clip size' : `${this.value}p`;
  }
}

/** Whether a string is the clip size (`''`) or one of the app's levels — the descriptor's `with`. */
export function isExportResolution(value: string): boolean {
  return value === '' || isLevel(Number(value));
}

/**
 * The picture a clip's file is written at: its **export resolution**, or its **clip size** when it
 * holds none. An unknown stored value — a hand-edited record, or one written by a later version —
 * is treated as the **clip size** rather than throwing, so no export is ever left without a
 * picture. `null` when the clip itself has no size (no take has a measured picture).
 */
export function exportPicture(properties: ClipProperties, clipSize: ClipSize | null): ClipSize | null {
  if (!clipSize) return null;
  return ExportResolution.of(properties.get(EXPORT_RESOLUTION_ID))?.picture(clipSize) ?? clipSize;
}

function isLevel(level: number): boolean {
  return (LEVELS as readonly number[]).includes(level);
}
