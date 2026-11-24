// The arrow: the first kind, and the worked example of the plugin seam.
//
// A line with a head, given by where it starts (`from`, the tail) and what it points
// at (`to`, the head) — both as fractions of the picture. Its shape and the rules for
// it are the domain class (`src/domain/annotation/Arrow.ts`); this class is the arrow
// in the view: the button the section offers, how it is drawn, and how a new one is
// made. It is its own renderer — one thing, one id — because what the arrow looks like
// is the arrow's business.
//
// Making one is a drag across the picture. The canvas owns the pointer plumbing and
// hands it back through `ctx.drag`, whose `build` is the arrow's own shape — so the
// draft the user sees while dragging is an `Arrow`, drawn by this class, and the commit
// is an `Arrow`. A stray click makes nothing and says so, and stays armed so the next
// try is a drag away rather than a selection to be made again.

import { Arrow } from '../../domain/annotation/Arrow.js';
import { isColour } from '../../domain/annotation/AnnotationColour.js';
import type { Annotation } from '../../domain/annotation/Annotation.js';
import { registerRenderer, type AnnotationRenderer } from './annotation-layer.js';
import {
  registerPlugin,
  type AnnotationAction, type AnnotationPlugin, type AnnotationProperty, type CreationContext,
} from './annotation-plugin.js';

const DRAFT_ID = 'draft';
const ARMED = 'ARROW — drag on the picture';
const STRAY = 'ARROW — drag across the picture';

const ACTION_ICON = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 19L19 5"/><path d="M12 5h7v7"/></svg>';

// ── the look ──────────────────────────────────────────────────────────────────
//
// One style, defined once: a shaft with a solid head, in the clip's annotation colour —
// red unless the clip or a profile says otherwise — with a thin dark edge so it reads
// over both light and dark pictures at every colour the palette holds.

const OUTLINE = 'rgba(2,3,8,0.72)';

/**
 * How big an arrow is drawn, in the picture's own pixels. It is a rule rather than a
 * magic number so that it can be tested: a mark must not swamp the picture it is
 * drawn over — the head is under 2% of the width and the shaft under 0.4%, at every
 * size the app records at.
 */
export function arrowMetrics(w: number): { head: number; weight: number; edge: number } {
  return {
    head: Math.max(6, w * 0.015),
    weight: Math.max(1.5, w * 0.0028),
    edge: Math.max(1, w * 0.0012),
  };
}

/** The arrow kind in the view: its action, its look, and how a new one is made. */
export class ArrowPlugin implements AnnotationPlugin, AnnotationRenderer<Annotation> {
  readonly id = Arrow.id;

  readonly action: AnnotationAction = {
    label: 'Arrow',
    title: 'Annotate this section with an arrow',
    icon: ACTION_ICON,
  };

  /** The arrow's colour — the clip's annotation colour unless the user chose another. */
  readonly properties: readonly AnnotationProperty[] = [
    {
      id: 'colour',
      label: 'Colour',
      control: 'colour',
      value: annotation => (annotation instanceof Arrow ? annotation.colour : Arrow.DEFAULT_COLOUR),
      with: (annotation, value) =>
        // A value the palette does not hold is refused, not silently turned into the
        // default: a caller asking for a colour that is not one of ours is told so,
        // rather than being handed the arrow's red and told it worked.
        annotation instanceof Arrow && isColour(value) ? annotation.withColour(value) : null,
    },
  ];

  /** The arrow is its own renderer, so a kind is one object with one id. */
  get renderer(): AnnotationRenderer<Annotation> {
    return this;
  }

  begin(ctx: CreationContext): void {
    ctx.say(ARMED);
    void (async () => {
      try {
        for (;;) {
          const drag = await ctx.drag((from, to) => Arrow.create(ctx.span, from, to, DRAFT_ID, ctx.colour));
          const arrow = drag ? Arrow.create(ctx.span, drag.from, drag.to, undefined, ctx.colour) : null;
          if (arrow) { ctx.commit(arrow); return; }
          // A stray click is not an arrow. Stay armed, so the next try is a drag
          // away rather than a selection to be made again.
          ctx.abandon(STRAY);
        }
      } catch {
        // The canvas was disarmed — Escape, a new selection, or the session over.
      }
    })();
  }

  draw(ctx: CanvasRenderingContext2D, annotation: Annotation, w: number, h: number): void {
    if (!(annotation instanceof Arrow)) return;
    const { from, to } = annotation.geometry;
    const x0 = from.x * w, y0 = from.y * h;
    const x1 = to.x * w, y1 = to.y * h;
    const { head: size, weight, edge } = arrowMetrics(w);
    const angle = Math.atan2(y1 - y0, x1 - x0);
    const bx = x1 - Math.cos(angle) * size * 0.8;
    const by = y1 - Math.sin(angle) * size * 0.8;

    ctx.save();
    ctx.lineCap = 'round';
    this.line(ctx, x0, y0, bx, by, weight + edge * 2, OUTLINE);   // the dark edge first
    this.line(ctx, x0, y0, bx, by, weight, annotation.colour);
    this.head(ctx, bx, by, angle, size + edge * 2, OUTLINE);
    this.head(ctx, bx, by, angle, size, annotation.colour);
    ctx.restore();
  }

  private line(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, width: number, colour: string): void {
    ctx.strokeStyle = colour;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }

  private head(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, size: number, colour: string): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.moveTo(size, 0);
    ctx.lineTo(-size * 0.55, size * 0.55);
    ctx.lineTo(-size * 0.55, -size * 0.55);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

// One arrow kind: the section offers its action, and the layer draws it.
export const arrowPlugin = new ArrowPlugin();
registerRenderer(arrowPlugin);
registerPlugin(arrowPlugin);