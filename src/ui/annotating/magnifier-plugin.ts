// The magnifier: the fifth kind in the view.
//
// A round lens over a detail, which shows the centre of what it covers enlarged, with
// the rest of the picture dimmed for the stretch of the annotation. It is the first kind
// whose renderer **reads the picture beneath it**: the layer takes one copy of the frame
// before any mark is drawn and hands it in as `picture`, so the lens magnifies the
// recording and not the app's own annotations.
//
// Making one is a drag from the detail outward. The canvas owns the pointer plumbing;
// the kind's own builder is the circle, from the centre the press started at to the rim
// the pointer reached, converted to a fraction of the picture's shorter side. A stray
// click, or a circle smaller than a lens, makes nothing and says so.
//
// Everything else — picking it, moving it, resizing it from a rim grip, copying,
// deleting, undoing, saving and exporting — is the shared canvas's, and this file writes
// none of it. Its preferences are its rim colour and its zoom, plus the shared duration.

import { Magnifier, DEFAULT_ZOOM, MAX_ZOOM, MIN_ZOOM, ZOOM_STEP } from '../../domain/annotation/Magnifier.js';
import { isColour } from '../../domain/annotation/AnnotationColour.js';
import type { Annotation } from '../../domain/annotation/Annotation.js';
import { registerRenderer, type AnnotationRenderer } from './annotation-layer.js';
import {
  registerPlugin,
  type AnnotationAction, type AnnotationPlugin, type AnnotationProperty, type CreationContext,
} from './annotation-plugin.js';

const DRAFT_ID = 'draft';
const ARMED = 'MAGNIFIER — press the detail and drag outward';
const STRAY = 'MAGNIFIER — drag from the detail outward';
const SMALL = 'MAGNIFIER — drag a wider circle (at least 4% of the short side)';

const ACTION_ICON = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/></svg>';

// ── the look ──────────────────────────────────────────────────────────────────
//
// One level for the build: the picture outside the circle, darkened. The rim keeps the
// family's thin dark edge, so it reads over light and dark pictures.

const DIM_ALPHA = 0.55;
const OUTLINE = 'rgba(2,3,8,0.72)';

/** The radius a drag asks for, as a fraction of the picture's shorter side. */
export function radiusOf(picture: { w: number; h: number }, from: { x: number; y: number }, to: { x: number; y: number }): number {
  const shorter = Math.min(picture.w, picture.h);
  if (!(shorter > 0)) return 0;
  return Math.hypot((to.x - from.x) * picture.w, (to.y - from.y) * picture.h) / shorter;
}

/** The magnifier kind in the view: its action, its preferences, its look and its creation. */
export class MagnifierPlugin implements AnnotationPlugin, AnnotationRenderer<Annotation> {
  readonly id = Magnifier.id;

  readonly action: AnnotationAction = {
    label: 'Magnifier',
    title: 'Magnify a detail over this section',
    icon: ACTION_ICON,
  };

  /** It reads the picture: the layer copies the frame for it and draws it first. */
  readonly readsPicture = true;

  /** What can be changed after it is placed: the rim colour and the zoom. */
  readonly properties: readonly AnnotationProperty[] = [
    {
      id: 'colour',
      label: 'Colour',
      control: 'colour',
      value: annotation => (annotation instanceof Magnifier ? annotation.colour : Magnifier.DEFAULT_COLOUR),
      with: (annotation, value) =>
        annotation instanceof Magnifier && isColour(value) ? annotation.withColour(value) : null,
    },
    {
      id: 'zoom',
      label: 'Zoom',
      control: 'number',
      min: MIN_ZOOM,
      max: MAX_ZOOM,
      step: ZOOM_STEP,
      suffix: '×',
      value: annotation => (annotation instanceof Magnifier ? String(annotation.geometry.zoom) : String(DEFAULT_ZOOM)),
      with: (annotation, value) => {
        if (!(annotation instanceof Magnifier)) return null;
        const zoom = Number(value);
        return Number.isFinite(zoom) ? annotation.withZoom(zoom) : null;
      },
    },
  ];

  /** The magnifier is its own renderer, so a kind is one object with one id. */
  get renderer(): AnnotationRenderer<Annotation> {
    return this;
  }

  begin(ctx: CreationContext): void {
    ctx.say(ARMED);
    void (async () => {
      try {
        for (;;) {
          const drag = await ctx.drag((from, to) => this.make(ctx, from, to, DRAFT_ID));
          if (!drag) { ctx.abandon(STRAY); continue; }
          const made = this.make(ctx, drag.from, drag.to);
          if (made) { ctx.commit(made); return; }
          // A drag, but a circle too small to be a lens: stay armed for a wider one.
          ctx.abandon(SMALL);
        }
      } catch {
        // The canvas was disarmed — Escape, a new selection, or the session over.
      }
    })();
  }

  private make(ctx: CreationContext, from: { x: number; y: number }, to: { x: number; y: number }, id?: string): Magnifier | null {
    return Magnifier.create(ctx.span, {
      x: from.x,
      y: from.y,
      radius: radiusOf(ctx.picture, from, to),
      zoom: DEFAULT_ZOOM,
    }, id, ctx.colour);
  }

  draw(ctx: CanvasRenderingContext2D, annotation: Annotation, w: number, h: number, picture?: CanvasImageSource): void {
    if (!(annotation instanceof Magnifier)) return;
    const { x, y, radius, zoom } = annotation.geometry;
    const cx = x * w;
    const cy = y * h;
    const r = radius * Math.min(w, h);

    // The spotlight: the whole frame, with the circle cut out of it.
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
    ctx.moveTo(cx + r, cy);
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fillStyle = `rgba(2,3,8,${DIM_ALPHA})`;
    ctx.fill('evenodd');
    ctx.restore();

    // The lens: the central part of its own circle, drawn to fill it — a magnifying
    // glass. The source is inside the lens, so it is inside the picture; no content is
    // invented at an edge. A still-to-be-decoded frame draws only the rim.
    if (picture && r > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.clip();
      const half = r / zoom;
      ctx.drawImage(picture, cx - half, cy - half, half * 2, half * 2, cx - r, cy - r, r * 2, r * 2);
      ctx.restore();
    }

    // The rim: a dark edge first, so the mark reads on any picture, then the colour.
    const weight = Math.max(2, w * 0.0035);
    const edge = Math.max(1, w * 0.0015);
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.lineWidth = weight + edge * 2;
    ctx.strokeStyle = OUTLINE;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.lineWidth = weight;
    ctx.strokeStyle = annotation.colour;
    ctx.stroke();
    ctx.restore();
  }
}

// One magnifier kind: the options offer its action, the layer draws it.
export const magnifierPlugin = new MagnifierPlugin();
registerRenderer(magnifierPlugin);
registerPlugin(magnifierPlugin);