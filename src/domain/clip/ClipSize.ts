// The picture a clip is shown and exported at: a width and a height, both even.
//
// A clip is made of takes whose own pictures are whatever the crop or the file made
// them — different sizes, and often odd. The clip has one size, and every take is
// fitted into it whole and centred, so the review and every export hold one picture
// size from beginning to end.
//
// Both edges are even because H.264 (the MP4 path) refuses an odd one outright, and
// an odd clip size would make the MP4 file a pixel smaller than the clip the person
// set. Rounding **up** rather than down means no take is ever scaled below its own
// picture. A size is a value: `of`, `parse`, `largest` and `frameFor` are the whole of
// its rules, and none of them needs the browser.

/** The size of a take's own picture, or the size a clip is written at. */
export interface Picture {
  readonly width: number;
  readonly height: number;
}

/** The rectangle a take is drawn into, in the clip's own pixels. */
export interface Frame {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export class ClipSize {
  /** The largest edge the app's targets carry — the top of the AVC level table. */
  static readonly MAX_EDGE = 8192;

  private constructor(
    readonly width: number,
    readonly height: number,
  ) {}

  /**
   * A size from two edges. An odd edge is rounded **up** to the next even one; a size
   * that is not a finite positive whole picture, or is past `MAX_EDGE`, is null — the
   * one rule both the first take and the panel go through.
   */
  static of(width: number, height: number): ClipSize | null {
    if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
    const w = even(width);
    const h = even(height);
    if (w < 2 || h < 2 || w > ClipSize.MAX_EDGE || h > ClipSize.MAX_EDGE) return null;
    return new ClipSize(w, h);
  }

  /** A size from `"1920x1080"` (either `x` or `×`), or null for anything else. */
  static parse(text: string): ClipSize | null {
    const match = /^\s*(\d+)\s*[x×]\s*(\d+)\s*$/i.exec(text ?? '');
    if (!match) return null;
    return ClipSize.of(Number(match[1]), Number(match[2]));
  }

  /**
   * The largest width and the largest height among a list of pictures, rolled up to
   * even — the size a clip grows to. Null for an empty list, or when no picture has a
   * usable size. A portrait and a landscape take make the rectangle that holds both.
   */
  static largest(pictures: readonly (Picture | null | undefined)[]): ClipSize | null {
    let width = 0;
    let height = 0;
    for (const picture of pictures) {
      if (!picture) continue;
      if (!Number.isFinite(picture.width) || !Number.isFinite(picture.height)) continue;
      width = Math.max(width, picture.width);
      height = Math.max(height, picture.height);
    }
    return ClipSize.of(width, height);
  }

  /** As the property holds it: `"1920x1080"`. */
  toString(): string {
    return `${this.width}x${this.height}`;
  }

  equals(other: ClipSize): boolean {
    return this.width === other.width && this.height === other.height;
  }

  /**
   * The rectangle a picture is drawn into: scaled so the whole of it sits inside this
   * size — whichever edge runs out first decides the scale — and centred, leaving the
   * clip's background around it. Never empty for a picture with a size; nothing is
   * cropped and nothing is stretched.
   */
  frameFor(picture: Picture): Frame {
    const pw = picture.width > 0 ? picture.width : this.width;
    const ph = picture.height > 0 ? picture.height : this.height;
    const scale = Math.min(this.width / pw, this.height / ph);
    const width = Math.max(1, Math.round(pw * scale));
    const height = Math.max(1, Math.round(ph * scale));
    return {
      x: Math.round((this.width - width) / 2),
      y: Math.round((this.height - height) / 2),
      width,
      height,
    };
  }
}

/** The even size at or above an edge, so a 985 becomes a 986. */
function even(edge: number): number {
  return Math.ceil(edge / 2) * 2;
}
