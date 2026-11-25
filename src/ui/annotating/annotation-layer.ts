// Drawing the annotations over the picture: the one place a kind is painted, and the
// grips every kind is edited by.
//
// One layer serves the preview and the export: `drawAnnotations` is called by the
// playback loop and by the offline export, each on its own canvas, in fractions of
// whichever canvas is handed in — so an annotation lands in the same place in the file
// as on the screen, whatever the two sizes are.
//
// Two things are drawn, and they are kept apart on purpose:
//
//   * the annotation itself, by the renderer a kind registers under its own id, in the
//     picture's own proportions — what it looks like is part of the picture and must
//     export the same;
//   * the **grips** a picked annotation is dragged by, here, once, for every kind —
//     they are an editing affordance, never exported, and sized in screen pixels so a
//     grip is the same size to the hand whatever the canvas resolution.
//
// A renderer draws and nothing else: how an annotation is picked, moved and resized is
// geometry, and lives on the class (`src/domain/annotation/`). Which renderer a kind
// has is part of its plugin (`annotation-plugin.ts`), registered here under the kind's
// id — the id is the whole of the coupling between the class, the plugin and the
// drawing.
//
// An annotation is not switched on and off at the edges of its stretch: over the first
// and last moments of it the layer blends it over the picture, the same 80 ms a take
// dissolves into the next, so it arrives and leaves softly. The blend is asked for
// where a moment is *moving* — playback and the export — and left out where it is
// still, so a hold or a seek shows the annotation settled.

import type { Annotation } from '../../domain/annotation/Annotation.js';
import { propertiesOf } from './annotation-plugin.js';

export interface AnnotationRenderer<A extends Annotation> {
  readonly id: string;
  /**
   * Does drawing it need the picture beneath it? A lens does; an arrow does not. The
   * layer takes one copy of the frame for the renderers that say yes, and draws them
   * before the others so the picture they read is the picture alone.
   */
  readonly readsPicture?: boolean;
  /** Paint it, inside `w × h`, in the picture's own proportions. */
  draw(ctx: CanvasRenderingContext2D, annotation: A, w: number, h: number, picture?: CanvasImageSource): void;
}

/** A renderer with its annotation erased, which is how the registry holds them. */
interface AnyRenderer {
  readonly id: string;
  readonly readsPicture?: boolean;
  draw(ctx: CanvasRenderingContext2D, annotation: Annotation, w: number, h: number, picture?: CanvasImageSource): void;
}

const renderers = new Map<string, AnyRenderer>();

export function registerRenderer<A extends Annotation>(renderer: AnnotationRenderer<A>): void {
  renderers.set(renderer.id, {
    id: renderer.id,
    readsPicture: renderer.readsPicture,
    draw: (ctx, annotation, w, h, picture) => renderer.draw(ctx, annotation as A, w, h, picture),
  });
}

export function rendererOf(id: string): AnyRenderer | null {
  return renderers.get(id) ?? null;
}

/** Does any of these annotations (or the draft) need the picture beneath it? */
export function needsPicture(annotations: readonly Annotation[], draft?: Annotation | null): boolean {
  if (draft && renderers.get(draft.kind)?.readsPicture) return true;
  return annotations.some(annotation => renderers.get(annotation.kind)?.readsPicture === true);
}

/** One scratch canvas, reused: the copy lives inside one synchronous draw. */
let scratch: HTMLCanvasElement | null = null;

/**
 * A copy of the picture on this context, for the renderers that read it. It must be
 * taken **before any annotation is drawn**: the lens magnifies the picture, not the
 * app's own marks. Null off the browser (the node tests), or with no canvas to copy.
 */
export function copyPicture(ctx: CanvasRenderingContext2D): CanvasImageSource | null {
  if (typeof document === 'undefined') return null;
  const source = ctx.canvas as HTMLCanvasElement | undefined;
  if (!source || !(source.width > 0) || !(source.height > 0)) return null;
  scratch ??= document.createElement('canvas');
  scratch.width = source.width;
  scratch.height = source.height;
  const context = scratch.getContext('2d');
  if (!context) return null;
  context.clearRect(0, 0, scratch.width, scratch.height);
  context.drawImage(source, 0, 0);
  return scratch;
}

/** The picture for these annotations, or undefined when none of them reads it. */
export function pictureFor(
  ctx: CanvasRenderingContext2D, annotations: readonly Annotation[], draft?: Annotation | null,
): CanvasImageSource | undefined {
  return needsPicture(annotations, draft) ? copyPicture(ctx) ?? undefined : undefined;
}

/**
 * The order annotations are drawn in: the ones that read the picture first, then the
 * rest, each group in the family's stable order. The canvas picks and grabs in the
 * reverse of this, so what is picked is what is on top.
 */
export function drawOrder(annotations: readonly Annotation[]): readonly Annotation[] {
  if (!annotations.some(annotation => renderers.get(annotation.kind)?.readsPicture)) return annotations;
  const readers: Annotation[] = [];
  const rest: Annotation[] = [];
  for (const annotation of annotations) {
    (renderers.get(annotation.kind)?.readsPicture ? readers : rest).push(annotation);
  }
  return [...readers, ...rest];
}

/**
 * How a drawn moment is dissolved: an annotation comes in over the first `seconds`
 * of its stretch and goes out over the last, as the picture does at a join between
 * takes. `at` and `total` are seconds of the recording, which a stretch is a
 * fraction of; without it an annotation is drawn at full strength, which is what a
 * still frame — a hold, a seek, an edit — wants.
 */
export interface AnnotationDissolve {
  readonly at: number;
  readonly total: number;
  readonly seconds: number;
}

/** Paint every annotation shown at this moment, in order, and the picked one's grips. */
export function drawAnnotations(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  annotations: readonly Annotation[],
  selectedId: string | null = null,
  dissolve?: AnnotationDissolve,
  hasSettings?: (annotation: Annotation) => boolean,
  picture?: CanvasImageSource,
): void {
  for (const annotation of drawOrder(annotations)) {
    const renderer = renderers.get(annotation.kind);
    if (!renderer) continue;
    const alpha = dissolve && dissolve.total > 0
      ? annotation.span.fadeAt(dissolve.at / dissolve.total, dissolve.seconds / dissolve.total)
      : 1;
    if (alpha <= 0) continue;                 // not on the picture yet, or already off it
    if (alpha < 1) {
      // Blend it over the picture for its first and last moments, so it does not
      // pop on or off — the same softness as a take's join.
      ctx.save();
      ctx.globalAlpha = alpha;
      renderer.draw(ctx, annotation, w, h, picture);
      ctx.restore();
    } else {
      renderer.draw(ctx, annotation, w, h, picture);
    }
  }
  const picked = selectedId === null ? null : annotations.find(a => a.id === selectedId);
  if (picked) drawHandles(ctx, picked, w, h, hasSettings?.(picked) ?? propertiesOf(picked).length > 0);
}

// ── the grips ────────────────────────────────────────────────────────────────
//
// Where a picked annotation can be dragged, drawn from the annotation's own
// `handles()` — so a kind gets the same grip UI without writing any, which is the
// point of it living here rather than in each renderer.
//
// The picked annotation carries two controls the grips do not: the × that takes it
// away, and the copy that puts another like it beside it. A phone has no Delete key and
// no ⌘C, and a press on either must not be a press that aims — so both sit off the
// annotation rather than on it, on opposite sides of its middle. `removeControl` and
// `copyControl` are the one place each says where, and `annotation-canvas.ts` hit-tests
// the same two points.

// Canvas pixels per screen pixel: a grip must be the same size to the hand whatever
// the picture's resolution. 1 when the canvas is not on screen, which is what an
// export's canvas is — and nothing is picked during an export anyway.
function screenScale(ctx: CanvasRenderingContext2D): number {
  const css = (ctx.canvas as HTMLCanvasElement | undefined)?.clientWidth ?? 0;
  return css > 0 ? ctx.canvas.width / css : 1;
}

const CONTROL_GAP = 22;  // screen px from the annotation's middle to a control, so it clears it
const CONTROL_R   = 12;  // screen px: bigger than a grip — a button, and a finger's, not a cursor's

type Control = 'remove' | 'copy' | 'settings';

// How far from the middle a control sits, in gaps: the × on one side, the copy on the
// other, the settings a further gap out so the three never overlap.
function controlSpot(
  annotation: Annotation, w: number, h: number, scale: number, offset: number,
): { x: number; y: number } | null {
  const ends = annotation.handles({ w, h });
  if (ends.length < 2) return null;
  const a = ends[0], b = ends[ends.length - 1];
  const dx = (b.x - a.x) * w, dy = (b.y - a.y) * h;
  const len = Math.hypot(dx, dy);
  if (len < 1) return null;
  const gap = CONTROL_GAP * scale * offset;
  const x = ((a.x + b.x) / 2) * w - (dy / len) * gap;
  const y = ((a.y + b.y) / 2) * h + (dx / len) * gap;
  const clamp = (v: number, hi: number) => (v < 0 ? 0 : v > hi ? hi : v);
  return { x: clamp(x, w) / w, y: clamp(y, h) / h };
}

/**
 * Where the picked annotation's remove control sits, in fractions of the picture — or
 * null when there is no pair of ends to hang it off. It is off to one side of the
 * middle, so a press on it can never be a press that aims. `scale` is canvas px per
 * screen px.
 */
export function removeControl(
  annotation: Annotation, w: number, h: number, scale: number,
): { x: number; y: number } | null {
  return controlSpot(annotation, w, h, scale, 1);
}

/** Where the copy control sits: the same, on the other side of the middle. */
export function copyControl(
  annotation: Annotation, w: number, h: number, scale: number,
): { x: number; y: number } | null {
  return controlSpot(annotation, w, h, scale, -1);
}

/** Where the settings control sits: a further gap out again, on the copy's side. */
export function settingsControl(
  annotation: Annotation, w: number, h: number, scale: number,
): { x: number; y: number } | null {
  return controlSpot(annotation, w, h, scale, -2);
}

const ACCENT = '#e53e3e';

function drawHandles(ctx: CanvasRenderingContext2D, annotation: Annotation, w: number, h: number, withSettings: boolean): void {
  const scale = screenScale(ctx);
  const r = 5 * scale;
  ctx.save();
  for (const handle of annotation.handles({ w, h })) {
    ctx.beginPath();
    ctx.arc(handle.x * w, handle.y * h, r, 0, Math.PI * 2);
    ctx.fillStyle = ACCENT;
    ctx.fill();
    ctx.lineWidth = Math.max(1, 1.5 * scale);
    ctx.strokeStyle = '#fff';           // a light ring, so it reads over a dark picture
    ctx.stroke();
  }
  const controls: Array<[Control, { x: number; y: number } | null]> = [
    ['remove', removeControl(annotation, w, h, scale)],
    ['copy', copyControl(annotation, w, h, scale)],
  ];
  // The settings control exists only for a kind that has something to change; a kind
  // with no properties would only open an empty panel.
  if (withSettings) {
    controls.push(['settings', settingsControl(annotation, w, h, scale)]);
  }
  for (const [control, spot] of controls) {
    if (spot) drawControl(ctx, control, spot.x * w, spot.y * h, CONTROL_R * scale, scale);
  }
  ctx.restore();
}

// A control on the picked annotation: the grips' own disc and ring, so it reads as one
// of its controls rather than a new thing, with its mark cut into it.
function drawControl(ctx: CanvasRenderingContext2D, control: Control, x: number, y: number, r: number, scale: number): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = ACCENT;
  ctx.fill();
  ctx.lineWidth = Math.max(1, 1.5 * scale);
  ctx.strokeStyle = '#fff';
  ctx.stroke();

  ctx.lineWidth = Math.max(1, 1.8 * scale);
  ctx.strokeStyle = '#fff';

  if (control === 'remove') {
    const k = r * 0.42;
    ctx.beginPath();
    ctx.moveTo(x - k, y - k);
    ctx.lineTo(x + k, y + k);
    ctx.moveTo(x + k, y - k);
    ctx.lineTo(x - k, y + k);
    ctx.stroke();
    return;
  }

  // The settings control: a pencil, the mark everyone reads as "edit" — the same mark a
  // profile's row wore for its name before naming moved into its own dialog.
  if (control === 'settings') {
    const s = r * 0.62;                     // half its length, along its own axis
    const w = r * 0.17;                     // half its width, across it
    const u = Math.SQRT1_2;                 // its axis: up and to the right
    // A point on the pencil: `along` down its axis from the middle, `side` across it.
    const at = (along: number, side: number) => ({
      x: x + along * u + side * w * u,
      y: y - along * u + side * w * u,
    });
    const tip = at(-s, 0);                  // the point, at the lower-left end
    const base = -s + s * 0.45;             // where the nib meets the shaft
    ctx.beginPath();
    ctx.moveTo(at(s, 1).x, at(s, 1).y);
    ctx.lineTo(at(base, 1).x, at(base, 1).y);
    ctx.lineTo(tip.x, tip.y);
    ctx.lineTo(at(base, -1).x, at(base, -1).y);
    ctx.lineTo(at(s, -1).x, at(s, -1).y);
    ctx.closePath();
    ctx.fillStyle = '#fff';
    ctx.fill();
    // The nib, cut back out of the disc's own colour so the point reads.
    ctx.beginPath();
    ctx.moveTo(at(base, -1).x, at(base, -1).y);
    ctx.lineTo(at(base, 1).x, at(base, 1).y);
    ctx.strokeStyle = ACCENT;
    ctx.stroke();
    return;
  }

  // Two sheets: the far one behind, the near one filled in the disc's own colour so it
  // knocks the overlap out and the two read apart at this size. The pair is centred on
  // the disc, so the mark does not lean.
  const k = r * 0.40, off = r * 0.30;
  const sheet = (cx: number, cy: number) => {
    ctx.beginPath();
    ctx.moveTo(cx - k, cy - k);
    ctx.lineTo(cx + k, cy - k);
    ctx.lineTo(cx + k, cy + k);
    ctx.lineTo(cx - k, cy + k);
    ctx.closePath();
  };
  sheet(x + off, y - off);        // the far one, up and to the right, solid
  ctx.fillStyle = '#fff';
  ctx.fill();
  sheet(x - off, y + off);        // the near one, over it, cut out of the disc
  ctx.fillStyle = ACCENT;
  ctx.fill();
  ctx.stroke();
}
