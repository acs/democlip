// The image: the second kind of annotation, and the proof that a kind is described
// rather than fitted.
//
// A picture, over the picture of the clip, for a stretch of its time. Where it sits and how
// big it is are a rect in **fractions of the picture**, like an arrow's ends, so it lands in
// the same place on the preview, on the export canvas and after a reload. The picture itself
// is **not here**: the kind holds an `imageId` and numbers, and the bytes live in
// `src/infra/images.ts`, because `src/domain/` may not touch a `Blob` or a canvas.
//
// A picture comes one of two ways. The person **chooses** one, and it is kept as bytes under
// an `imageId`. Or it is a **logo** — a mark the app serves itself, named in `ui/logos.ts` —
// which is what the clip's **watermark** wears: its `logo` is the name, and the view resolves
// it, so nothing is uploaded and nothing is stored for a mark the app already has.
//
// It keeps the picture's own proportions when it is resized. A rect in fractions of the
// picture does not: a square rect on a 16:9 screen is not square. So the geometry
// carries two ratios — the picture's own and the recorded picture's — and a
// keep-proportions resize solves the height from the width and the two. A free resize
// (a modifier is held) takes the height from the drag instead.
//
// Everything a drag and a pick need is here, because it is geometry and not drawing;
// how it *looks* is the plugin's renderer, under the same id.

import { Span } from '../clip/Span.js';
import {
  Annotation, newAnnotationId,
  type AnnotationHandle, type HandleOptions, type Point, type StoredAnnotation,
} from './Annotation.js';

export interface ImageGeometry {
  /** Which kept picture this is — resolved to bytes in `infra/`, never here. '' for a logo. */
  readonly imageId: string;
  /**
   * The app-served **logo** this is, by name, when its picture is a mark the app serves
   * rather than one the person chose — resolved in the view (`ui/logos.ts`), never here.
   */
  readonly logo?: string;
  /** The rect, as fractions of the picture. */
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  /** The picture's own pixel width ÷ height — what a keep-proportions resize holds. */
  readonly imageAspect: number;
  /** The recorded picture's pixel width ÷ height when it was made — the other half. */
  readonly pictureAspect: number;
}

// Smaller than this (a fraction of the picture) and it is not an image to draw.
const MIN_SIZE = 0.02;

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

const positive = (v: unknown): number => {
  const n = num(v);
  return n > 0 ? n : 1;
};

// A rect pulled inside the picture: width and height first, then the corner, so the
// whole rect stays in — an image drawn past the edge is kept, moved in, not lost.
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

export class ImageAnnotation extends Annotation {
  static readonly id = 'image';

  private constructor(id: string, span: Span, readonly geometry: ImageGeometry) {
    super(id, span, ImageAnnotation.id);
  }

  /**
   * A new image, its rect pulled inside the picture. Null when it is too small to be
   * worth keeping, or carries no picture at all — a stray one is not an image. The picture
   * is a kept `imageId`, a served **logo** by name, or both.
   */
  static create(span: Span, geometry: ImageGeometry, id: string = newAnnotationId()): ImageAnnotation | null {
    const r = rect(geometry?.x, geometry?.y, geometry?.width, geometry?.height);
    const logo = typeof geometry?.logo === 'string' ? geometry.logo.trim() : '';
    const image = new ImageAnnotation(id, span, {
      imageId: String(geometry?.imageId ?? ''),
      // Written down only when there is one, so a picture the person chose carries nothing extra.
      ...(logo ? { logo } : {}),
      ...r,
      imageAspect: positive(geometry?.imageAspect),
      pictureAspect: positive(geometry?.pictureAspect),
    });
    return image.isUsable ? image : null;
  }

  /** Rebuild one from what was written down. Null when it is not an image to draw. */
  static restore(stored: StoredAnnotation): ImageAnnotation | null {
    const g = stored.geometry as Partial<ImageGeometry> | null | undefined;
    if (!g) return null;
    return ImageAnnotation.create(Span.of(stored.s, stored.e), {
      imageId: String(g.imageId ?? ''),
      logo: typeof g.logo === 'string' ? g.logo : undefined,
      x: g.x as number, y: g.y as number, width: g.width as number, height: g.height as number,
      imageAspect: g.imageAspect as number, pictureAspect: g.pictureAspect as number,
    }, stored.id);
  }

  /** Is this worth keeping, or too small to draw? */
  get isUsable(): boolean {
    return (this.geometry.imageId !== '' || (this.geometry.logo ?? '') !== '')
      && this.geometry.width >= MIN_SIZE
      && this.geometry.height >= MIN_SIZE;
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
   * Resize from the corner opposite the one dragged. The picture's own proportions are
   * kept unless `options.free`; a drag past the anchor clamps to a minimum rather than
   * flipping the rect inside out.
   */
  withHandle(end: string, to: Point, options?: HandleOptions): ImageAnnotation | null {
    const { x, y, width, height, imageAspect, pictureAspect, logo } = this.geometry;
    const free = options?.free === true;
    // The fixed corner, and the new width and height measured from the dragged one.
    let anchorX: number, anchorY: number, w: number, h: number;
    switch (end) {
      case 'nw': anchorX = x + width; anchorY = y + height; w = anchorX - to.x; h = anchorY - to.y; break;
      case 'ne': anchorX = x;         anchorY = y + height; w = to.x - anchorX; h = anchorY - to.y; break;
      case 'se': anchorX = x;         anchorY = y;          w = to.x - anchorX; h = to.y - anchorY; break;
      case 'sw': anchorX = x + width; anchorY = y;          w = anchorX - to.x; h = to.y - anchorY; break;
      default: return null;
    }
    w = Math.max(MIN_SIZE, w);
    h = free ? Math.max(MIN_SIZE, h) : (w * pictureAspect) / imageAspect;
    if (!free && h > 1) { h = 1; w = (h * imageAspect) / pictureAspect; }
    // Rebuild from the anchor, whichever corner was dragged.
    const left = end === 'nw' || end === 'sw' ? anchorX - w : anchorX;
    const top  = end === 'nw' || end === 'ne' ? anchorY - h : anchorY;
    return ImageAnnotation.create(this.span, {
      imageId: this.geometry.imageId, logo,
      x: left, y: top, width: w, height: h, imageAspect, pictureAspect,
    }, this.id);
  }

  movedBy(dx: number, dy: number): ImageAnnotation | null {
    const { x, y, width, height, imageId, logo, imageAspect, pictureAspect } = this.geometry;
    return ImageAnnotation.create(this.span, {
      imageId, logo, x: x + dx, y: y + dy, width, height, imageAspect, pictureAspect,
    }, this.id);
  }

  withSpan(span: Span): ImageAnnotation {
    // The stretch says when it is shown, not what shape it is, so it can never make an
    // image unusable — the rect is untouched.
    return new ImageAnnotation(this.id, span, this.geometry);
  }

  duplicated(span: Span): ImageAnnotation {
    // Built straight rather than through `create`: this came from an image already
    // inside the picture and worth keeping. It carries the same `imageId`, so a copy is
    // numbers, not megabytes.
    return new ImageAnnotation(newAnnotationId(), span, this.geometry);
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
      geometry: this.geometry,
    };
  }
}

/**
 * Is this annotation a **watermark** — an image whose picture is a **logo** the app serves,
 * rather than one the person chose? The clip wears at most one, over the whole of its picture,
 * and this is the whole of what makes one *the* watermark rather than another image placed.
 */
export function isWatermark(annotation: Annotation | null | undefined): boolean {
  return annotation instanceof ImageAnnotation && (annotation.geometry.logo ?? '') !== '';
}
