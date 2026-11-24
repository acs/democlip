// The webcam bubble's placement: where and how big the camera circle sits over the
// recorded picture.
//
// Held in fractions of the recorded region — the centre across its width and height, the
// diameter as a fraction of its shorter side — so the live preview and the recording,
// which are handed rectangles of different sizes, put the circle in the same place. It is
// a rule, not a view type: the circle is always round, its diameter is bounded, and the
// whole circle stays inside the region it is asked against. The view drags it; the
// preview and the compositor both draw through it; this class keeps it honest.

const MIN_SIZE = 0.12;      // the smallest diameter, as a fraction of the shorter side
const MAX_SIZE = 0.6;       // the largest diameter, so it cannot swallow the picture
const DEFAULT_SIZE = 0.28;  // the size the app has always drawn the bubble at
const CORNER_MARGIN = 0.7;  // how far the centre sits from the corner, in diameters

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

export class WebcamBubble {
  /** The smallest diameter a placement may have, as a fraction of the shorter side. */
  static readonly MIN_SIZE = MIN_SIZE;
  /** The largest diameter a placement may have, as a fraction of the shorter side. */
  static readonly MAX_SIZE = MAX_SIZE;
  /** The diameter the app has always drawn the bubble at, as a fraction of the shorter side. */
  static readonly DEFAULT_SIZE = DEFAULT_SIZE;

  private constructor(
    /** The circle's centre across the recorded region, as a fraction of its width. */
    readonly cx: number,
    /** The circle's centre down the recorded region, as a fraction of its height. */
    readonly cy: number,
    /** The circle's diameter, as a fraction of the region's shorter side. */
    readonly size: number,
  ) {}

  /**
   * A placement from a centre and a diameter. Rejects a non-finite coordinate, and a
   * diameter outside `MIN_SIZE..MAX_SIZE`. Containment is not asked here — it depends on
   * the region — so `withCentre`, `withSize` and `fitted` are what keep the circle in.
   */
  static of(cx: number, cy: number, size: number): WebcamBubble {
    if (![cx, cy, size].every(Number.isFinite)) throw new Error('A webcam bubble needs three finite numbers');
    if (size < MIN_SIZE || size > MAX_SIZE) {
      throw new Error(`A webcam bubble is between ${MIN_SIZE} and ${MAX_SIZE} of the shorter side`);
    }
    return new WebcamBubble(cx, cy, size);
  }

  /**
   * The default placement for a region: the bottom-right corner, a margin of
   * `CORNER_MARGIN` diameters in from each edge, at the default diameter — what the app
   * has always drawn, so a person who never touches the bubble sees nothing new.
   */
  static default(width: number, height: number): WebcamBubble {
    if (!(width > 0) || !(height > 0)) throw new Error('A webcam bubble needs a region with a size');
    const diameter = DEFAULT_SIZE * Math.min(width, height);
    return WebcamBubble.of(
      (width - diameter * CORNER_MARGIN) / width,
      (height - diameter * CORNER_MARGIN) / height,
      DEFAULT_SIZE,
    );
  }

  /** Move to a centre, clamped so the whole circle stays inside the region. */
  withCentre(cx: number, cy: number, width: number, height: number): WebcamBubble {
    const [rx, ry] = this.halfExtents(width, height);
    return WebcamBubble.of(clamp(cx, rx, 1 - rx), clamp(cy, ry, 1 - ry), this.size);
  }

  /**
   * Resize to a diameter (a fraction of the shorter side), clamped to
   * `MIN_SIZE..MAX_SIZE`, and re-centred so a bigger circle still fits.
   */
  withSize(size: number, width: number, height: number): WebcamBubble {
    const resized = WebcamBubble.of(this.cx, this.cy, clamp(size, MIN_SIZE, MAX_SIZE));
    return resized.withCentre(this.cx, this.cy, width, height);
  }

  /** This placement for a region that may have changed size: still wholly inside it. */
  fitted(width: number, height: number): WebcamBubble {
    return this.withSize(this.size, width, height);
  }

  /** The centre and radius in pixels, for the rectangle the caller holds. */
  geometry(width: number, height: number): { cx: number; cy: number; r: number } {
    return {
      cx: this.cx * width,
      cy: this.cy * height,
      r: this.size * Math.min(width, height) / 2,
    };
  }

  /** Is a point on the circle? `tolerance` grows it outwards, into the resize rim. */
  contains(x: number, y: number, width: number, height: number, tolerance = 0): boolean {
    const { cx, cy, r } = this.geometry(width, height);
    const reach = r + tolerance;
    return (x - cx) ** 2 + (y - cy) ** 2 <= reach ** 2;
  }

  equals(other: WebcamBubble): boolean {
    return this.cx === other.cx && this.cy === other.cy && this.size === other.size;
  }

  /** The radius as a fraction of each side, which is what the centre is kept between. */
  private halfExtents(width: number, height: number): [number, number] {
    const radius = this.size * Math.min(width, height) / 2;
    return [radius / width, radius / height];
  }
}
