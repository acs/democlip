// The annotation canvas: the one place an annotation of any kind is picked, moved,
// resized, copied, deleted and undone.
//
// It used to be the arrow's own gesture (`annotation-edit.ts`) and named `Arrow` in a
// few places. It is now the shared surface the plugin seam exists for, and it knows no
// kind: picking, moving and resizing ask the annotation itself (`hitTest`, `movedBy`,
// `withHandle`), and a *new* one is made by the kind's plugin through a
// `CreationContext` the canvas provides. The grips and the two controls are the
// layer's, drawn from `handles()` for every kind.
//
// The gesture belongs to the interaction and to nothing else, so it lives on this
// object with a lifetime — as MarkDrag and CropDrag do — and the session ends that
// lifetime, because a drag must not outlive the clip it was drawn on.
//
// How it goes: the section the user selected arms a kind, a press and drag on the
// picture is handed to that kind's plugin (which decides what it makes), and a click on
// an annotation already there picks it so its handles can be dragged. The clip
// announces every change, so this object redraws the preview when it hears one — it
// does not redraw because it happened to be the caller.

import { currentPhase } from '../../state.js';
import { session } from '../../session.js';
import { ctx, el, toast } from '../dom.js';
import { Span } from '../../domain/clip/Span.js';
import type { Annotation, AnnotationHandle, Point } from '../../domain/annotation/Annotation.js';
import { copyControl, drawAnnotations, removeControl, settingsControl } from './annotation-layer.js';
import { pluginOf, propertiesOf, type AnnotationPlugin, type CreationContext } from './annotation-plugin.js';
import { inspector } from './properties-inspector.js';
import { drawFrame } from '../recording/preview.js';
import { player, reviewFrame } from '../clip/clip.js';
import { playback } from '../clip/playback.js';
import { clipboard } from './annotation-clipboard.js';
import { typingIn } from '../../util.js';

const DRAG_MIN = 3;          // px of travel before a press counts as a drag
const GRIP_PX = 14;          // a cursor: how near a handle a press has to be to take hold
const TOUCH_SLOP_PX = 24;    // a finger is wider than a cursor: the slop it gets instead
const MIN_DRAG_PX = 3;       // shorter than this and a creation gesture was a stray click
const COPY_SHIFT = 0.08;     // how far a copy is put from its original, in fractions

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/** The rectangle a kind's corners describe, as fractions of the picture. */
function boxOf(ends: readonly AnnotationHandle[]): { left: number; right: number; top: number; bottom: number } {
  const xs = ends.map(end => end.x);
  const ys = ends.map(end => end.y);
  return { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) };
}

/** Is a point strictly inside that rectangle? A point on an edge is not — a corner is the grip's. */
function insideBox(p: Point, box: { left: number; right: number; top: number; bottom: number }): boolean {
  return p.x > box.left && p.x < box.right && p.y > box.top && p.y < box.bottom;
}

/**
 * Has this shape no body of its own — is it smaller than the grips that sit on it? Then every
 * press inside it lands within a grip's reach, so it could be resized but never picked up and
 * moved. A shape with no second dimension is not this: an arrow is a line, and its ends are its
 * whole self, so its grips come first as they always have.
 */
function hasNoBody(
  box: { left: number; right: number; top: number; bottom: number },
  screenW: number, screenH: number, slopPx: number,
): boolean {
  const w = (box.right - box.left) * screenW;
  const h = (box.bottom - box.top) * screenH;
  if (!(w > 0) || !(h > 0)) return false;
  return w < slopPx * 2 || h < slopPx * 2;
}

// 'move' is the whole thing; anything else is one of the annotation's own handles.
type Grab = string | null;

/** The drag a plugin is waiting on, with the way to answer it. */
interface PendingDrag {
  build: (from: Point, to: Point) => Annotation | null;
  minLengthPx: number;
  resolve: (result: { from: Point; to: Point } | null) => void;
  reject: (reason?: unknown) => void;
}

// Who wants to know when the annotation in hand changes — the timeline lane, so its
// selected bar follows the picture. The view listens; nothing calls into it.
const selectionListeners = new Set<() => void>();

export function onSelectionChange(fn: () => void): void {
  selectionListeners.add(fn);
}

function announceSelection(): void {
  for (const fn of [...selectionListeners]) fn();
}

export class AnnotationCanvas {
  private creating: { plugin: AnnotationPlugin; span: Span } | null = null;
  private pending: PendingDrag | null = null;
  private live = false;                          // a creation drag is in flight
  private from: Point = { x: 0, y: 0 };
  private to: Point = { x: 0, y: 0 };
  private draft: Annotation | null = null;
  private pickId: string | null = null;          // the annotation in hand, if any
  private grab: Grab = null;
  private last: Point = { x: 0, y: 0 };
  private fromX = 0;
  private fromY = 0;

  get selectedId(): string | null { return this.pickId; }
  /** Is a kind armed, waiting to be made? */
  get armed(): boolean { return this.creating !== null; }

  /**
   * The section's action: make a new one of `kindId` over `span`. The kind's plugin
   * decides what a press then does — the arrow asks for a drag, the image asks for a
   * picture — and the canvas only carries it out.
   */
  add(kindId: string, span: Span): void {
    const plugin = pluginOf(kindId);
    if (!plugin) return;
    this.creating = { plugin, span };
    this.pickId = null;
    this.grab = null;
    this.draft = null;
    el.cv.style.cursor = 'crosshair';
    // The frame under the gesture has to be one of the stretch's own. A playhead
    // sitting exactly on the section's end is outside its half-open span — the second
    // mark leaves it there — and the annotation would vanish the moment it was made,
    // because `annotationsAt` would have nothing to answer with.
    const total = session.clip.total();
    if (total > 0 && !span.contains(player.time() / total)) playback.hold(span.s * total);
    announceSelection();
    this.repaint();
    plugin.begin(this.creationContext());
  }

  /** Pick an annotation from outside the picture (the timeline lane). */
  pick(id: string | null): void {
    // The panel belongs to one annotation; a different pick closes it. The new one's
    // opens from its own settings control.
    if (this.pickId !== id) inspector.close();
    this.pickId = id;
    this.grab = null;
    announceSelection();
    this.repaint();
  }

  /** The annotation in hand is gone (removed, or the session ended). */
  forget(id?: string): void {
    if (id && this.pickId !== id) return;
    inspector.close();
    this.pickId = null;
    this.grab = null;
    announceSelection();
  }

  /** Let go of an armed kind, or of the one in hand, or both. */
  cancel(): void {
    const pending = this.pending;
    this.disarm();
    inspector.close();
    this.pickId = null;
    announceSelection();
    pending?.reject(new Error('the creation was let go'));
  }

  /** Wire the pointer, the keys and the clip to this canvas. Called once, at startup. */
  init(): void {
    el.cv.addEventListener('pointerdown', e => this.down(e));
    window.addEventListener('pointermove', e => this.move(e));
    window.addEventListener('pointerup', e => this.end(e));
    window.addEventListener('pointercancel', () => this.end());

    // Escape lets go of an armed kind or of the one in hand; Delete takes the picked one
    // away, because reaching for the × on it is a longer trip than pressing the key that
    // means "remove this". The one undo brings it back.
    window.addEventListener('keydown', evt => {
      if (typingIn(evt.target)) return;             // a field's Delete belongs to the field

      if (evt.key === 'Escape') {
        if (!this.armed && !this.selectedId) return;
        if (this.armed) this.cancel();
        else            this.forget();
        this.repaint();
        return;
      }

      // Delete is Supr; on a Mac keyboard the same key is Backspace.
      if ((evt.key === 'Delete' || evt.key === 'Backspace') && this.selectedId && currentPhase() === 'review') {
        evt.preventDefault();
        session.clip.removeAnnotation(this.selectedId);   // the clip announces it; the view follows
        return;
      }

      // Copy the annotation in hand, and paste a new one of the same shape where the
      // playhead holds — how a callout is repeated at another moment without selecting a
      // stretch and drawing it again. The browser's own copy is left alone when nothing
      // is picked, so copying selected text still works.
      const key = evt.key.toLowerCase();
      if (!(evt.metaKey || evt.ctrlKey) || (key !== 'c' && key !== 'v')) return;
      if (currentPhase() !== 'review') return;

      if (key === 'c' && this.selectedId) {
        const picked = session.clip.annotations.byId(this.selectedId);
        if (!picked) return;
        evt.preventDefault();
        clipboard.copy(picked);
        toast(`${this.labelOf(picked.kind)} copied`);
        return;
      }

      if (key === 'v' && clipboard.has) {
        const pasted = this.pasteAtPlayhead();
        if (!pasted) return;
        evt.preventDefault();
        toast(`${this.labelOf(pasted.kind)} pasted — drag it where you want it`);
      }
    });

    // The clip says what changed; this is where the preview follows.
    session.clip.onChange(event => {
      if (event.type === 'cleared') { this.cancel(); return; }
      if (event.type === 'annotation-removed') this.forget(event.annotation.id);
      if (event.type === 'annotation-added' || event.type === 'annotation-changed' || event.type === 'annotation-removed') this.repaint();
    });
  }

  down(e: PointerEvent): void {
    if (currentPhase() !== 'review') return;
    const p = this.fractionAt(e.clientX, e.clientY);
    // A finger is wider than a cursor, and every control here is drawn small. On
    // touch a press gets a fixed slop on screen; a mouse keeps the tolerance it had.
    const touch = e.pointerType === 'touch';
    const scale = this.screenScale();
    const slopPx = touch ? TOUCH_SLOP_PX : GRIP_PX;
    const tolerance = touch ? TOUCH_SLOP_PX * scale : Math.max(9, el.cv.width / 55);

    // A kind is armed: this press may begin its creation drag. A kind waiting on
    // something else (a picture being chosen) takes no press, so a press on the
    // picture while it waits is not a press that edits something already there.
    if (this.creating) {
      if (!this.pending) return;
      playback.pause();                    // a still frame's business, as a mark is
      this.live = true;
      this.from = this.to = p;
      this.fromX = e.clientX;
      this.fromY = e.clientY;
      e.preventDefault();
      return;
    }

    // The picked annotation's own controls come first: they sit off the annotation, so
    // a press on one is nowhere near the hit test below — and it must never be a press
    // that aims. They are looked for among the annotations shown at this moment,
    // because that is what the layer drew: a control that is not on the picture is not
    // one a press can land on.
    if (this.pickId) {
      const picked = session.clip.annotationsAt(player.time()).find(a => a.id === this.pickId);
      if (picked) {
        const w = el.cv.width, h = el.cv.height;
        const remove = removeControl(picked, w, h, scale);
        if (remove && this.canvasDistance(remove, p) <= slopPx * scale) {
          session.clip.removeAnnotation(picked.id);   // the clip announces it; the views follow
          return;
        }
        const copy = copyControl(picked, w, h, scale);
        if (copy && this.canvasDistance(copy, p) <= slopPx * scale) {
          this.duplicate(picked);
          return;
        }
        // The settings control is drawn only for a kind with properties, so it is a
        // press target only then — a kind with none has no dead spot beside it.
        if (propertiesOf(picked).length > 0) {
          const settings = settingsControl(picked, w, h, scale);
          if (settings && this.canvasDistance(settings, p) <= slopPx * scale) {
            inspector.toggle(picked);            // the inspector is the panel's owner
            return;
          }
        }
      }
    }

    // A grip is a target in its own right. The grips are the layer's, drawn from the
    // annotation's `handles()` for every kind, and they are drawn at the shape's edge —
    // so part of a grip is *outside* the shape. A press on one has to take hold even
    // though the point is not on the annotation, or a corner could only be grabbed by
    // aiming at the half of it that happens to lie inside.
    const grip = this.gripAt(p, slopPx);
    if (grip) {
      this.pickId = grip.annotation.id;
      this.grab = grip.end;
      this.last = p;
      this.fromX = e.clientX;
      this.fromY = e.clientY;
      playback.pause();
      announceSelection();
      this.repaint();
      e.preventDefault();
      return;
    }

    // Otherwise a press may pick an annotation that is already there, and move it.
    const hit = this.hitAnnotation(p, tolerance);
    if (!hit) { this.forget(); this.repaint(); return; }
    this.pickId = hit.id;
    this.grab = 'move';
    this.last = p;
    this.fromX = e.clientX;
    this.fromY = e.clientY;
    playback.pause();
    announceSelection();
    this.repaint();
    e.preventDefault();
  }

  move(e: PointerEvent): void {
    if (currentPhase() !== 'review') return;
    const p = this.fractionAt(e.clientX, e.clientY);

    // A creation drag: the kind's own builder says what the draft looks like.
    if (this.live) {
      this.to = p;
      this.draft = this.pending?.build(this.from, this.to) ?? null;
      this.repaint();
      return;
    }
    if (!this.pickId || !this.grab) return;
    // Any direction counts: an annotation is aimed and stretched as often as it is
    // slid sideways.
    if (Math.hypot(e.clientX - this.fromX, e.clientY - this.fromY) < DRAG_MIN) return;

    const annotation = session.clip.annotations.byId(this.pickId);
    if (!annotation) return;
    const dx = p.x - this.last.x, dy = p.y - this.last.y;
    this.last = p;

    // How it moves and resizes is the annotation's own business — this only asks. The
    // modifier is passed as `free`: what it means is the kind's rule.
    const next = this.grab === 'move'
      ? annotation.movedBy(dx, dy)
      : annotation.withHandle(this.grab, p, { free: e.shiftKey });
    // The clip announces the change, and the redraw is the listener's — not this.
    if (next) session.clip.changeAnnotation(annotation.id, next);
  }

  end(e?: PointerEvent): void {
    if (!this.live) { this.grab = null; return; }
    this.live = false;
    const pending = this.pending;
    this.pending = null;
    this.draft = null;
    if (e) this.to = this.fractionAt(e.clientX, e.clientY);
    const travel = e ? Math.hypot(e.clientX - this.fromX, e.clientY - this.fromY) : Infinity;
    const min = pending?.minLengthPx ?? MIN_DRAG_PX;
    const result = travel >= min ? { from: this.from, to: this.to } : null;
    this.repaint();
    pending?.resolve(result);
  }

  /** The draft the armed kind is showing, for the layer to draw. */
  preview(): Annotation | null {
    return this.draft;
  }

  /**
   * The copy control: another annotation like this one, shown over the same stretch,
   * put a little away from it — where a keyboard's paste puts a copy at the playhead
   * instead, which is how the same callout is repeated at another moment. The copy is
   * picked, so it can be dragged where it is wanted straight away.
   */
  duplicate(picked: Annotation): void {
    const { dx, dy } = this.copyShift(picked);
    const copy = picked.duplicated(picked.span);
    const placed = copy.movedBy(dx, dy) ?? copy.movedBy(-dx, -dy);   // the other way if that leaves the picture
    if (!placed) return;
    session.clip.addAnnotation(placed);      // the clip announces it; the views follow
    this.pick(placed.id);
    toast(`${this.labelOf(placed.kind)} copied — drag it where you want it`);
  }

  /** One is made: the clip takes it, and it is put in hand. */
  private commit(annotation: Annotation): void {
    this.disarm();
    session.clip.addAnnotation(annotation);      // the clip announces it; the views follow
    this.pick(annotation.id);
  }

  private disarm(): void {
    this.creating = null;
    this.pending = null;
    this.live = false;
    this.draft = null;
    this.grab = null;
    el.cv.style.cursor = '';
  }

  /** A kind decided not to make anything: let the canvas go and say why. */
  private cancelCreation(message: string): void {
    this.disarm();
    el.tCut.textContent = message;
    this.repaint();
  }

  /** What a kind is handed to make a new one. */
  private creationContext(): CreationContext {
    return {
      span: this.creating!.span,
      picture: { w: el.cv.width, h: el.cv.height },
      drag: (build, minLengthPx = MIN_DRAG_PX) => new Promise((resolve, reject) => {
        this.pending?.reject(new Error('a new creation began'));
        this.pending = { build, minLengthPx, resolve, reject };
      }),
      draft: annotation => { this.draft = annotation; this.repaint(); },
      commit: annotation => this.commit(annotation),
      abandon: message => { this.draft = null; el.tCut.textContent = message; this.repaint(); },
      cancel: message => this.cancelCreation(message),
      say: message => { el.tCut.textContent = message; },
    };
  }

  /** Redraw the frame under the gesture, the annotations, and the draft being made. */
  private repaint(): void {
    if (currentPhase() !== 'review' || el.rv.readyState < 1) return;
    const w = el.cv.width, h = el.cv.height;
    try { drawFrame(el.rv, reviewFrame(el.rv)); } catch { return; }        // a frame still decoding
    drawAnnotations(ctx, w, h, session.clip.annotationsAt(player.time()), this.selectedId);
    const draft = this.preview();
    if (draft) pluginOf(draft.kind)?.renderer.draw(ctx, draft, w, h);
  }

  // A new annotation of the copied shape, over the same part of the picture, at the
  // moment the playhead holds — kept inside the clip, and in hand at once so its grips
  // show.
  private pasteAtPlayhead(): Annotation | null {
    const total = session.clip.total();
    if (!(total > 0) || !clipboard.has) return null;
    const length = clipboard.length;
    const at = Math.max(0, Math.min(1 - length, player.time() / total));
    const pasted = clipboard.paste(Span.of(at, at + length));
    if (!pasted) return null;
    session.clip.addAnnotation(pasted);      // the clip announces it; the views follow
    this.pick(pasted.id);
    return pasted;
  }

  /** What a kind is called in a message, or a plain word for one this build cannot name. */
  private labelOf(kind: string): string {
    return pluginOf(kind)?.action.label ?? 'Annotation';
  }

  private fractionAt(clientX: number, clientY: number): Point {
    const r = el.cv.getBoundingClientRect();
    return {
      x: clamp01(r.width > 0 ? (clientX - r.left) / r.width : 0),
      y: clamp01(r.height > 0 ? (clientY - r.top) / r.height : 0),
    };
  }

  // Canvas pixels per screen pixel: the same conversion the layer sizes its controls
  // with, so a slop named in screen pixels is measured in the picture's own.
  private screenScale(): number {
    return el.cv.clientWidth > 0 ? el.cv.width / el.cv.clientWidth : 1;
  }

  // The distance between two points of the picture, on the canvas.
  private canvasDistance(a: Point, b: Point): number {
    return Math.hypot((a.x - b.x) * el.cv.width, (a.y - b.y) * el.cv.height);
  }

  // Where a copy goes: a fraction of the picture away, so it is as far off on a phone
  // as on a desktop, and toward the middle of the picture — away from whichever edge
  // the original is nearest, so the copy is never the one pushed off it.
  private copyShift(annotation: Annotation): { dx: number; dy: number } {
    const ends = annotation.handles();
    const a = ends[0], b = ends[ends.length - 1];
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    return {
      dx: mx > 0.5 ? -COPY_SHIFT : COPY_SHIFT,
      dy: my > 0.5 ? -COPY_SHIFT : COPY_SHIFT,
    };
  }

  // The topmost annotation whose grip the press is on, and which grip. The grips are
  // the layer's, drawn from `handles()` for every kind, and they reach a little outside
  // the shape — so this asks about the grip, not about the shape.
  private gripAt(p: Point, slopPx: number): { annotation: Annotation; end: string } | null {
    const shown = session.clip.annotationsAt(player.time());
    const screenW = el.cv.clientWidth > 0 ? el.cv.clientWidth : el.cv.width;
    const screenH = el.cv.clientHeight > 0 ? el.cv.clientHeight : el.cv.height;
    if (!(screenW > 0)) return null;
    for (let i = shown.length - 1; i >= 0; i--) {
      const ends = shown[i].handles();
      // A shape too small to have a body of its own would have every press inside it taken by a
      // grip, and so could never be picked up and moved. A press inside such a shape is a press
      // to move it; its corners still resize from on them or just outside.
      if (hasNoBody(boxOf(ends), screenW, screenH, slopPx) && insideBox(p, boxOf(ends))) continue;
      for (const handle of ends) {
        if (Math.hypot(handle.x - p.x, handle.y - p.y) * screenW <= slopPx) {
          return { annotation: shown[i], end: handle.end };
        }
      }
    }
    return null;
  }

  // The topmost annotation under a point, at the moment the playhead holds. The hit
  // test is the annotation's own, because how close is close enough is geometry.
  private hitAnnotation(p: Point, tolerancePx: number): Annotation | null {
    const shown = session.clip.annotationsAt(player.time());
    const w = el.cv.width, h = el.cv.height;
    for (let i = shown.length - 1; i >= 0; i--) {
      if (shown[i].hitTest(p.x, p.y, w, h, tolerancePx)) return shown[i];
    }
    return null;
  }
}

export const canvas = new AnnotationCanvas();

export function initAnnotationCanvas(): void {
  canvas.init();
}