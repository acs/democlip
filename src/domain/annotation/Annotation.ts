// One annotation: something drawn over the picture of a clip, for a stretch of its
// time.
//
// It is a class, and a kind is a subclass of it — the arrow is `Arrow`. The base
// holds what every annotation has: identity, the stretch it is shown over, and the
// pure geometry a drag and a pick are made of. A kind adds its own shape and the
// rules for it.
//
// Nothing here draws. `src/domain/` may not touch a canvas, so how a kind looks
// lives in the view under the same id (`src/ui/annotating/annotation-layer.ts`), for the same
// reason `TakeRepository` is a port: the rules and the browser are kept apart.

import { Span } from '../clip/Span.js';

export type AnnotationId = string;

/** The length a new annotation is given when nothing is selected, in seconds. */
export const DEFAULT_ANNOTATION_S = 2;

/** The shortest stretch worth keeping an annotation over, in seconds. */
export const MIN_ANNOTATION_S = 0.1;

/** A point, as fractions of the picture. */
export interface Point {
  readonly x: number;
  readonly y: number;
}

/** A point a drag can take hold of, in fractions of the picture. */
export interface AnnotationHandle {
  readonly x: number;
  readonly y: number;
  readonly end: string;
}

/**
 * What a resize may be told beyond where the handle went. A kind that ignores it —
 * the arrow, whose ends are its resize — reads it not at all; a kind that resizes a
 * shape, as the image does, uses it to tell a free resize from a constrained one.
 */
export interface HandleOptions {
  /** The user is asking for a free resize — a modifier is held. */
  readonly free?: boolean;
}

/** One annotation as it is written down: its span and geometry, plain numbers. */
export interface StoredAnnotation {
  id: string;
  kind: string;
  s: number;
  e: number;
  geometry: unknown;
}

export abstract class Annotation {
  protected constructor(
    readonly id: AnnotationId,
    /** When it is shown: fractions of the clip, like a cut. */
    readonly span: Span,
    /** Which kind it is — the id both registries key on. */
    readonly kind: string,
  ) {}

  /** The points a drag can take hold of, in fractions of the picture. */
  abstract handles(): readonly AnnotationHandle[];

  /** The same annotation with one handle at a new point, or null if that is not one. */
  abstract withHandle(end: string, to: Point, options?: HandleOptions): Annotation | null;

  /** The same annotation, shifted — how it is moved whole. */
  abstract movedBy(dx: number, dy: number): Annotation | null;

  /** The same annotation over a different stretch — how it follows a clip that grew. */
  abstract withSpan(span: Span): Annotation;

  /**
   * A new annotation like this one, with its own identity — what a paste makes. The
   * stretch is given, because where a copy goes is not the copy's business.
   */
  abstract duplicated(span: Span): Annotation;

  /**
   * The same annotation over a new **duration**, in seconds of the clip. The start is
   * kept and the end is clamped inside the clip, so an annotation never shows past the
   * clip; null when the clip has no length or the duration is below `min`. Whatever a
   * kind carries beyond its stretch — its colour, its shape, its words — is kept, because
   * this delegates to the kind's own `withSpan`.
   */
  withDuration(seconds: number, total: number, min: number = MIN_ANNOTATION_S): Annotation | null {
    if (!(total > 0) || !Number.isFinite(seconds)) return null;
    const length = Math.min(seconds, (1 - this.span.s) * total);   // the end may not pass 1
    if (!(length >= min)) return null;
    return this.withSpan(Span.of(this.span.s, this.span.s + length / total));
  }

  /** Is a point (fractions of the picture) on it, within `tolerancePx`? */
  abstract hitTest(x: number, y: number, w: number, h: number, tolerancePx: number): boolean;

  /** This annotation as it is written down. */
  abstract stored(): StoredAnnotation;
}

let seq = 0;

/** An id that will not collide with a restored one (those carry their own). */
export function newAnnotationId(): AnnotationId {
  seq += 1;
  return `an-${Math.random().toString(36).slice(2, 8)}-${seq}`;
}
