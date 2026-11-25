// The magnifier: the fifth kind of annotation. A circular lens over a region of the
// picture, which shows the region's centre **enlarged** for a stretch of the clip.
//
// Where it sits, how big it is and how much it enlarges are numbers in **fractions of
// the picture**, like an arrow's ends, so it lands in the same place on the preview, on
// the export canvas and after a reload. The radius is measured against the picture's
// **shorter side**, and the renderer draws it with the same shorter side, so the lens is
// a true circle at every picture shape — and a circle of diameter at most the short side
// always fits inside the picture, so no stored aspect can go stale when the clip grows.
//
// Everything a drag and a pick need is here, because it is geometry and not drawing:
// the two grips on the rim, how the lens moves and resizes, and how close a press has to
// be to be on it. How it *looks* — the dim, the lens, the rim — is the plugin's, under
// the same id; the domain may not touch a canvas.
//
// The colour is the rim's, carried beside the geometry as the arrow carries its own. The
// zoom is a factor the person changes in the annotation's preferences.

import { Span } from '../clip/Span.js';
import { DEFAULT_ANNOTATION_COLOUR, colourOf, type AnnotationColour } from './AnnotationColour.js';
import {
  Annotation, newAnnotationId,
  type AnnotationHandle, type HandleOptions, type PictureSize, type Point, type StoredAnnotation,
} from './Annotation.js';

export interface MagnifierGeometry {
  /** The centre of the lens, as fractions of the picture. */
  readonly x: number;
  readonly y: number;
  /** The radius, as a fraction of the picture's **shorter side**. */
  readonly radius: number;
  /** How much larger the centre appears; 1.5–8. */
  readonly zoom: number;
}

/** What a new magnifier starts at. */
export const DEFAULT_ZOOM = 2;

/** The zoom range the kind accepts. */
export const MIN_ZOOM = 1.5;
export const MAX_ZOOM = 8;

/** What one press of − or + changes the zoom by, in its preferences. */
export const ZOOM_STEP = 0.5;

/** Smaller than this (of the shorter side) and it is not a lens worth keeping. */
export const MIN_RADIUS = 0.04;

/** A lens never fills more than the shorter side. */
export const MAX_RADIUS = 0.5;

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

export class Magnifier extends Annotation {
  static readonly id = 'magnifier';

  /** The colour a magnifier reads back as when it carries none. A new one is made in the
   * clip's annotation colour, not this. */
  static readonly DEFAULT_COLOUR: AnnotationColour = DEFAULT_ANNOTATION_COLOUR;

  private constructor(
    id: string, span: Span, readonly geometry: MagnifierGeometry,
    readonly colour: AnnotationColour,
  ) {
    super(id, span, Magnifier.id);
  }

  /**
   * A new lens, its centre pulled inside the picture and its radius capped at the room
   * that leaves. Null when the radius is below the smallest lens, the zoom is outside
   * its range, or a number is not a number.
   */
  static create(
    span: Span, geometry: MagnifierGeometry,
    id: string = newAnnotationId(), colour: AnnotationColour = Magnifier.DEFAULT_COLOUR,
  ): Magnifier | null {
    const asked = num(geometry?.radius);
    if (asked < MIN_RADIUS) return null;
    const zoom = geometry?.zoom === undefined || geometry?.zoom === null ? DEFAULT_ZOOM : num(geometry.zoom);
    if (zoom < MIN_ZOOM || zoom > MAX_ZOOM) return null;

    // A centre close to an edge leaves no room for a lens: pull it in by the smallest
    // lens, then cap the radius at the room the (clamped) centre leaves.
    const x = clamp(num(geometry?.x), MIN_RADIUS, 1 - MIN_RADIUS);
    const y = clamp(num(geometry?.y), MIN_RADIUS, 1 - MIN_RADIUS);
    const room = Math.min(x, 1 - x, y, 1 - y);
    const radius = Math.min(asked, MAX_RADIUS, room);
    if (!(radius >= MIN_RADIUS)) return null;

    return new Magnifier(id, span, { x, y, radius, zoom }, colourOf(colour, Magnifier.DEFAULT_COLOUR));
  }

  /** Rebuild one from what was written down. Null when it is not a lens this build can use. */
  static restore(stored: StoredAnnotation): Magnifier | null {
    const g = stored.geometry as Partial<MagnifierGeometry> & { colour?: unknown } | null | undefined;
    if (!g) return null;
    return Magnifier.create(Span.of(stored.s, stored.e), {
      x: g.x as number, y: g.y as number, radius: g.radius as number, zoom: g.zoom as number,
    }, stored.id, colourOf(g.colour, Magnifier.DEFAULT_COLOUR));
  }

  /** Is this worth keeping, and does it sit wholly inside the picture? */
  get isUsable(): boolean {
    const { x, y, radius, zoom } = this.geometry;
    return Number.isFinite(x) && Number.isFinite(y)
      && radius >= MIN_RADIUS && radius <= MAX_RADIUS
      && zoom >= MIN_ZOOM && zoom <= MAX_ZOOM
      && x >= radius && x <= 1 - radius
      && y >= radius && y <= 1 - radius;
  }

  /** The same lens, same shape and stretch, in another rim colour. */
  withColour(colour: AnnotationColour): Magnifier {
    return new Magnifier(this.id, this.span, this.geometry, colourOf(colour, Magnifier.DEFAULT_COLOUR));
  }

  /** The same lens at another zoom; null when it is not a value the kind accepts. */
  withZoom(zoom: number): Magnifier | null {
    if (!Number.isFinite(zoom) || zoom < MIN_ZOOM || zoom > MAX_ZOOM) return null;
    if (zoom === this.geometry.zoom) return this;
    return new Magnifier(this.id, this.span, { ...this.geometry, zoom }, this.colour);
  }

  /** Two grips on the horizontal rim, on the pixel circle the renderer draws. */
  handles(picture?: PictureSize): readonly AnnotationHandle[] {
    const { x, y, radius } = this.geometry;
    const w = picture && picture.w > 0 ? picture.w : 1;
    const h = picture && picture.h > 0 ? picture.h : 1;
    const offset = (radius * Math.min(w, h)) / w;
    return [
      { x: clamp(x - offset, 0, 1), y, end: 'left' },
      { x: clamp(x + offset, 0, 1), y, end: 'right' },
    ];
  }

  /**
   * Resize around the same centre: the radius is the pixel distance from the centre to
   * the dragged point, over the shorter side, capped at the room the centre leaves. The
   * picture is required, because a fraction of the shorter side is not a fraction of
   * the width.
   */
  withHandle(end: string, to: Point, options?: HandleOptions): Magnifier | null {
    if ((end !== 'left' && end !== 'right') || !options?.picture) return null;
    const { w, h } = options.picture;
    const shorter = Math.min(w, h);
    if (!(w > 0) || !(h > 0)) return null;

    const { x, y, zoom } = this.geometry;
    const asked = Math.hypot((to.x - x) * w, (to.y - y) * h) / shorter;
    const room = Math.min(x, 1 - x, y, 1 - y);
    const radius = clamp(asked, MIN_RADIUS, Math.min(MAX_RADIUS, room));
    return new Magnifier(this.id, this.span, { x, y, radius, zoom }, this.colour);
  }

  movedBy(dx: number, dy: number): Magnifier | null {
    const { x, y, radius, zoom } = this.geometry;
    const nextX = clamp(x + dx, radius, 1 - radius);
    const nextY = clamp(y + dy, radius, 1 - radius);
    return new Magnifier(this.id, this.span, { x: nextX, y: nextY, radius, zoom }, this.colour);
  }

  withSpan(span: Span): Magnifier {
    // The stretch says when it is shown, not what shape it is, so it can never make a
    // lens unusable — the circle is untouched.
    return new Magnifier(this.id, span, this.geometry, this.colour);
  }

  duplicated(span: Span): Magnifier {
    return new Magnifier(newAnnotationId(), span, this.geometry, this.colour);
  }

  /** Is a point (fractions of the picture) inside the lens, within `tolerancePx`? */
  hitTest(x: number, y: number, w: number, h: number, tolerancePx: number): boolean {
    const { x: cx, y: cy, radius } = this.geometry;
    const r = radius * Math.min(w, h);
    return Math.hypot((x - cx) * w, (y - cy) * h) <= r + tolerancePx;
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