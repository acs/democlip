// The arrow: the first kind of annotation, and the worked example of one.
//
// A line with a head, given by where it starts (`from`, the tail) and what it points
// at (`to`, the head), both as fractions of the picture so it lands in the same place
// on the preview, on the export canvas and after a reload.
//
// Everything a drag and a pick need is here, because it is geometry and not drawing:
// the ends to take hold of, how the arrow moves and aims, and how close a point has
// to be to be on it. How it *looks* — and the colour it is drawn in — is the arrow's
// plugin (`src/ui/annotating/arrow-plugin.ts`), under the same id; the domain may not
// touch a canvas.
//
// The colour is part of the arrow, not of its shape: it is carried beside the ends and
// written down with them, so an arrow that is aimed, moved or copied keeps the colour
// it was given, and one stored before colours existed reads back in the arrow's red.

import { Span } from '../clip/Span.js';
import { colourOf, type AnnotationColour } from './AnnotationColour.js';
import {
  Annotation, newAnnotationId,
  type AnnotationHandle, type Point, type StoredAnnotation,
} from './Annotation.js';

export interface ArrowGeometry {
  /** The tail, as fractions of the picture. */
  readonly from: Point;
  /** The head — what it points at. */
  readonly to: Point;
}

// Shorter than this (a fraction of the picture's width) and it is a stray click,
// not an arrow.
const MIN_LENGTH = 0.02;

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

// An arrow drawn past the edge is kept, pulled to the edge — it is not lost.
const clamp01 = (v: unknown): number => {
  const n = num(v);
  return n < 0 ? 0 : n > 1 ? 1 : n;
};

const point = (p: { x?: unknown; y?: unknown } | undefined): Point => ({
  x: clamp01(p?.x),
  y: clamp01(p?.y),
});

/** How far a point is from a segment, in the same units as the points. */
function distanceToSegment(px: number, py: number, x0: number, y0: number, x1: number, y1: number): number {
  const dx = x1 - x0, dy = y1 - y0;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq > 0 ? Math.max(0, Math.min(1, ((px - x0) * dx + (py - y0) * dy) / lengthSq)) : 0;
  return Math.hypot(px - (x0 + t * dx), py - (y0 + t * dy));
}

export class Arrow extends Annotation {
  static readonly id = 'arrow';

  /** The colour an arrow reads back as when it carries none — the app's red, for one stored before
   * colours existed. A new one is made in the clip's annotation colour, not this. */
  static readonly DEFAULT_COLOUR: AnnotationColour = '#e53e3e';

  private constructor(
    id: string, span: Span, readonly from: Point, readonly to: Point,
    readonly colour: AnnotationColour,
  ) {
    super(id, span, Arrow.id);
  }

  /**
   * A new arrow, both points pulled inside the picture. Null when the two are so
   * close that it is a stray click rather than an arrow.
   */
  static create(
    span: Span, from: Point, to: Point,
    id: string = newAnnotationId(), colour: AnnotationColour = Arrow.DEFAULT_COLOUR,
  ): Arrow | null {
    const arrow = new Arrow(id, span, point(from), point(to), colourOf(colour, Arrow.DEFAULT_COLOUR));
    return arrow.isUsable ? arrow : null;
  }

  /** Rebuild one from what was written down. Null when it is not an arrow to draw. */
  static restore(stored: StoredAnnotation): Arrow | null {
    const g = stored.geometry as
      { from?: { x?: unknown; y?: unknown }; to?: { x?: unknown; y?: unknown }; colour?: unknown } | null | undefined;
    return Arrow.create(Span.of(stored.s, stored.e), point(g?.from), point(g?.to), stored.id, colourOf(g?.colour, Arrow.DEFAULT_COLOUR));
  }

  /** Is this worth keeping, or a stray click? */
  get isUsable(): boolean {
    return Math.hypot(this.to.x - this.from.x, this.to.y - this.from.y) >= MIN_LENGTH;
  }

  /** The arrow's own shape: where it starts and what it points at. */
  get geometry(): ArrowGeometry {
    return { from: this.from, to: this.to };
  }

  /** The same arrow, same ends and stretch, in another colour. */
  withColour(colour: AnnotationColour): Arrow {
    return new Arrow(this.id, this.span, this.from, this.to, colourOf(colour, Arrow.DEFAULT_COLOUR));
  }

  handles(): readonly AnnotationHandle[] {
    return [
      { x: this.from.x, y: this.from.y, end: 'from' },
      { x: this.to.x, y: this.to.y, end: 'to' },
    ];
  }

  withHandle(end: string, to: Point): Arrow | null {
    if (end === 'from') return Arrow.create(this.span, to, this.to, this.id, this.colour);
    if (end === 'to')   return Arrow.create(this.span, this.from, to, this.id, this.colour);
    return null;
  }

  movedBy(dx: number, dy: number): Arrow | null {
    return Arrow.create(
      this.span,
      { x: this.from.x + dx, y: this.from.y + dy },
      { x: this.to.x + dx, y: this.to.y + dy },
      this.id,
      this.colour,
    );
  }

  withSpan(span: Span): Arrow {
    // The stretch says when it is shown, not what shape it is, so it can never make
    // an arrow unusable — the ends are untouched.
    return new Arrow(this.id, span, this.from, this.to, this.colour);
  }

  duplicated(span: Span): Arrow {
    // Built straight rather than through `create`: this came from an arrow that is
    // already inside the picture and already worth keeping, so there is nothing left
    // to normalise or refuse.
    return new Arrow(newAnnotationId(), span, this.from, this.to, this.colour);
  }

  hitTest(x: number, y: number, w: number, h: number, tolerancePx: number): boolean {
    const d = distanceToSegment(x * w, y * h, this.from.x * w, this.from.y * h, this.to.x * w, this.to.y * h);
    return d <= tolerancePx;
  }

  stored(): StoredAnnotation {
    return {
      id: this.id,
      kind: this.kind,
      s: this.span.s,
      e: this.span.e,
      geometry: { from: this.from, to: this.to, colour: this.colour },
    };
  }
}