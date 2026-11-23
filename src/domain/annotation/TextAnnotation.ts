// The text: the third kind, and the proof that a kind is described rather than fitted.
//
// A line of text over the picture, for a stretch of the clip's time. Where it sits and
// how big it is are a box in **fractions of the picture**; the box's height is the font
// size and its width is what the text measured at that size, so drawing at any canvas
// size lands the same place and the same size as the review.
//
// The box is the whole of the kind's shape: picking is inside it, moving shifts it, and
// resizing a corner scales both its width and its height by the same factor — which is
// what makes the text grow and shrink with it. There is no free resize: text is not a
// picture to stretch.
//
// It also says what can be changed about it after it is placed: its colour, and its
// words. `withWords` takes the width the new words measure at the current font size —
// **measured in the view and handed in** — and keeps the anchor and the size, shrinking
// both only when the words would otherwise run past the picture. The measuring is the
// view's because this may not touch a canvas.

import { Span } from '../clip/Span.js';
import { colourOf, type AnnotationColour } from './AnnotationColour.js';
import {
  Annotation, newAnnotationId,
  type AnnotationHandle, type Point, type StoredAnnotation,
} from './Annotation.js';

export interface TextGeometry {
  readonly text: string;
  /** The box, as fractions of the picture: top-left, width, height. */
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

// Smaller than this (a fraction of the picture) and it is not text to draw.
const MIN_SIZE = 0.02;

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

function rect(x: unknown, y: unknown, width: unknown, height: unknown): { x: number; y: number; width: number; height: number } {
  const w = clamp01(num(width));
  const h = clamp01(num(height));
  return {
    width: w,
    height: h,
    x: Math.min(clamp01(num(x)), 1 - w),
    y: Math.min(clamp01(num(y)), 1 - h),
  };
}

export class TextAnnotation extends Annotation {
  static readonly id = 'text';

  /** The colour text has when none is chosen — white, with the outline keeping it legible. */
  static readonly DEFAULT_COLOUR: AnnotationColour = '#ffffff';

  private constructor(
    id: string, span: Span, readonly geometry: TextGeometry,
    readonly colour: AnnotationColour,
  ) {
    super(id, span, TextAnnotation.id);
  }

  /**
   * A new piece of text, its box pulled inside the picture. Null when there is nothing
   * to say or the box is too small to draw — a stray one is not text.
   */
  static create(
    span: Span, geometry: TextGeometry,
    id: string = newAnnotationId(), colour: AnnotationColour = TextAnnotation.DEFAULT_COLOUR,
  ): TextAnnotation | null {
    const r = rect(geometry?.x, geometry?.y, geometry?.width, geometry?.height);
    const text = typeof geometry?.text === 'string' ? geometry.text : '';
    const annotation = new TextAnnotation(id, span, { text, ...r }, colourOf(colour, TextAnnotation.DEFAULT_COLOUR));
    return annotation.isUsable ? annotation : null;
  }

  /** Rebuild one from what was written down. Null when it is not text to draw. */
  static restore(stored: StoredAnnotation): TextAnnotation | null {
    const g = stored.geometry as Partial<TextGeometry> & { colour?: unknown } | null | undefined;
    if (!g) return null;
    return TextAnnotation.create(Span.of(stored.s, stored.e), {
      text: typeof g.text === 'string' ? g.text : '',
      x: g.x as number, y: g.y as number, width: g.width as number, height: g.height as number,
    }, stored.id, colourOf(g.colour, TextAnnotation.DEFAULT_COLOUR));
  }

  /** Is this worth keeping, or too small to draw? */
  get isUsable(): boolean {
    return this.geometry.text.trim() !== ''
      && this.geometry.width >= MIN_SIZE
      && this.geometry.height >= MIN_SIZE;
  }

  /** The same text, same box and stretch, in another colour. */
  withColour(colour: AnnotationColour): TextAnnotation {
    return new TextAnnotation(this.id, this.span, this.geometry, colourOf(colour, TextAnnotation.DEFAULT_COLOUR));
  }

  /**
   * The same text with new words, its box refitted. `measuredWidth` is the width the
   * words measure at this text's current font size, as a fraction of the picture — the
   * view measures and hands it in. The anchor and the size are kept; when the words
   * would run past the picture from the anchor, both are shrunk by one factor until they
   * fit, so the text stays wholly on the frame and does not jump. Null for no words.
   */
  withWords(words: string, measuredWidth: number): TextAnnotation | null {
    const text = words.trim();
    if (!text) return null;
    const { x, y, height } = this.geometry;
    const room = Math.max(MIN_SIZE, 1 - x);
    const measured = Number.isFinite(measuredWidth) ? measuredWidth : 0;
    let width = Math.max(MIN_SIZE, measured);
    let nextHeight = height;
    if (width > room) {
      const k = room / width;
      width = room;
      nextHeight = height * k;
    }
    return TextAnnotation.create(this.span, { text, x, y, width, height: nextHeight }, this.id, this.colour);
  }

  handles(): readonly AnnotationHandle[] {
    const { x, y, width, height } = this.geometry;
    return [
      { x, y, end: 'nw' },
      { x: x + width, y, end: 'ne' },
      { x: x + width, y: y + height, end: 'se' },
      { x, y: y + height, end: 'sw' },
    ];
  }

  /**
   * Resize from the corner opposite the one dragged, scaling the box — and so the text
   * with it. There is no free resize: text is not stretched.
   */
  withHandle(end: string, to: Point): TextAnnotation | null {
    const { x, y, width, height } = this.geometry;
    // The fixed corner, and the box the drag asks for from the dragged one.
    let anchorX: number, anchorY: number, w: number, h: number;
    switch (end) {
      case 'nw': anchorX = x + width; anchorY = y + height; w = anchorX - to.x; h = anchorY - to.y; break;
      case 'ne': anchorX = x;         anchorY = y + height; w = to.x - anchorX; h = anchorY - to.y; break;
      case 'se': anchorX = x;         anchorY = y;          w = to.x - anchorX; h = to.y - anchorY; break;
      case 'sw': anchorX = x + width; anchorY = y;          w = anchorX - to.x; h = to.y - anchorY; break;
      default: return null;
    }
    // One factor scales both, so the text keeps its shape: it fits inside the box the
    // drag describes rather than stretching past the pointer. The smallest it may go is a
    // box of MIN_SIZE — and the floor is on the **factor**, not on each edge. Clamping the
    // edges one at a time left the box a different shape from the words, so at the smallest
    // size the line ran out past its own box and the grips sat on the first word alone.
    const asked = Math.min(w / width, h / height);
    const smallest = MIN_SIZE / Math.min(width, height);
    const k = Math.max(smallest, asked);
    const nw = width * k;
    const nh = height * k;
    const left = end === 'nw' || end === 'sw' ? anchorX - nw : anchorX;
    const top  = end === 'nw' || end === 'ne' ? anchorY - nh : anchorY;
    return TextAnnotation.create(this.span, {
      text: this.geometry.text, x: left, y: top, width: nw, height: nh,
    }, this.id, this.colour);
  }

  movedBy(dx: number, dy: number): TextAnnotation | null {
    const { text, x, y, width, height } = this.geometry;
    return TextAnnotation.create(this.span, { text, x: x + dx, y: y + dy, width, height }, this.id, this.colour);
  }

  withSpan(span: Span): TextAnnotation {
    // The stretch says when it is shown, not what it says, so it can never make text
    // unusable — the box is untouched.
    return new TextAnnotation(this.id, span, this.geometry, this.colour);
  }

  duplicated(span: Span): TextAnnotation {
    // Built straight rather than through `create`: this came from text already inside
    // the picture and worth keeping.
    return new TextAnnotation(newAnnotationId(), span, this.geometry, this.colour);
  }

  hitTest(x: number, y: number): boolean {
    const { x: left, y: top, width, height } = this.geometry;
    return x >= left && x <= left + width && y >= top && y <= top + height;
  }

  stored(): StoredAnnotation {
    return {
      id: this.id,
      kind: this.kind,
      s: this.span.s,
      e: this.span.e,
      geometry: { ...this.geometry, colour: this.colour },
    };
  }
}