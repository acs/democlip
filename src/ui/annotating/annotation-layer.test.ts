import { describe, expect, it } from 'vitest';

import { copyControl, drawAnnotations, registerRenderer, removeControl, rendererOf } from './annotation-layer.js';
import type { AnnotationRenderer } from './annotation-layer.js';
// The arrow's renderer and its metrics are part of the arrow's plugin now; importing it
// is also what registers `arrow` in the renderer registry the layer holds.
import { arrowMetrics } from './arrow-plugin.js';
import { Annotation, type StoredAnnotation } from '../../domain/annotation/Annotation.js';
import { Arrow } from '../../domain/annotation/Arrow.js';
import { Span } from '../../domain/clip/Span.js';

// A 2-D context is not in node, so the layer is proved against a stand-in that counts
// what a renderer asked of it — the same idea as the fakes behind the ports. Give it
// a `canvas` to stand for one on screen; without one it is an export's canvas.
function fakeCtx(opts: { width?: number; clientWidth?: number } = {}) {
  const calls: string[] = [];
  const arcs: Array<{ x: number; y: number; r: number }> = [];
  const alphas: number[] = [];
  const noop = (name: string) => () => { calls.push(name); };
  const base: Record<string, unknown> = {
    save: noop('save'), restore: noop('restore'), beginPath: noop('beginPath'),
    moveTo: noop('moveTo'), lineTo: noop('lineTo'), closePath: noop('closePath'),
    stroke: noop('stroke'), fill: noop('fill'),
    arc: (x: number, y: number, r: number) => { calls.push('arc'); arcs.push({ x, y, r }); },
    translate: noop('translate'), rotate: noop('rotate'),
  };
  // A real context starts at 1; recording every write lets a test see the layer's blend.
  let alpha = 1;
  Object.defineProperty(base, 'globalAlpha', {
    get: () => alpha,
    set: (v: number) => { alpha = v; alphas.push(v); },
  });
  if (opts.width !== undefined) base.canvas = { width: opts.width, clientWidth: opts.clientWidth ?? 0 };
  return { ctx: base as unknown as CanvasRenderingContext2D, calls, arcs, alphas };
}

const arrow = (id: string): Arrow => {
  const made = Arrow.create(Span.of(0, 1), { x: 0.1, y: 0.5 }, { x: 0.9, y: 0.5 }, id);
  if (!made) throw new Error('the test arrow should be usable');
  return made;
};

const arrowOver = (id: string, s: number, e: number): Arrow => {
  const made = Arrow.create(Span.of(s, e), { x: 0.1, y: 0.5 }, { x: 0.9, y: 0.5 }, id);
  if (!made) throw new Error('the test arrow should be usable');
  return made;
};

// A kind with no renderer: the layer must skip it rather than fail.
class Stub extends Annotation {
  static readonly id = 'stub';
  constructor() { super('s1', Span.of(0, 1), Stub.id); }
  handles() { return []; }
  withHandle() { return null; }
  movedBy() { return null; }
  withSpan() { return new Stub(); }
  duplicated() { return new Stub(); }
  hitTest() { return false; }
  stored(): StoredAnnotation {
    return { id: this.id, kind: this.kind, s: this.span.s, e: this.span.e, geometry: {} };
  }
}

// A second kind with three grips and no renderer at all: the grips are the layer's,
// drawn from `handles()`, so a new kind gets them without drawing anything.
class Tripod extends Annotation {
  static readonly id = 'tripod';
  constructor() { super('t1', Span.of(0, 1), Tripod.id); }
  handles() { return [{ x: 0.2, y: 0.2, end: 'a' }, { x: 0.5, y: 0.5, end: 'b' }, { x: 0.8, y: 0.8, end: 'c' }]; }
  withHandle() { return null; }
  movedBy() { return null; }
  withSpan() { return new Tripod(); }
  duplicated() { return new Tripod(); }
  hitTest() { return false; }
  stored(): StoredAnnotation {
    return { id: this.id, kind: this.kind, s: this.span.s, e: this.span.e, geometry: {} };
  }
}

describe('the annotation layer', () => {
  it('knows the arrow, and null for a kind it does not draw', () => {
    expect(rendererOf('arrow')?.id).toBe('arrow');
    expect(rendererOf('hologram')).toBeNull();
  });

  it('draws the arrow it is handed', () => {
    const { ctx, calls } = fakeCtx();
    drawAnnotations(ctx, 320, 180, [arrow('a')]);
    expect(calls).toContain('stroke');
    expect(calls).toContain('fill');
  });

  it('blends an annotation in at the start of its stretch, as a take dissolves at a join', () => {
    const a = arrowOver('a', 0.2, 0.6);                 // a stretch of 0.2..0.6 of a 10s clip

    const atStart = fakeCtx();
    drawAnnotations(atStart.ctx, 320, 180, [a], null, { at: 2, total: 10, seconds: 0.8 });
    expect(atStart.calls).toEqual([]);                  // its very first moment: not there yet

    const arriving = fakeCtx();
    drawAnnotations(arriving.ctx, 320, 180, [a], null, { at: 2.4, total: 10, seconds: 0.8 });
    expect(arriving.calls).toContain('stroke');
    expect(arriving.alphas.length).toBe(1);             // blended, not drawn plain
    expect(arriving.alphas[0]).toBeCloseTo(0.5);        // halfway over the picture

    const settled = fakeCtx();
    drawAnnotations(settled.ctx, 320, 180, [a], null, { at: 4, total: 10, seconds: 0.8 });
    expect(settled.calls).toContain('stroke');
    expect(settled.alphas).toEqual([]);                 // in the middle: full, nothing to blend
  });

  it('draws an annotation at full strength on a still frame, however near its edge', () => {
    const { ctx, calls, alphas } = fakeCtx();
    drawAnnotations(ctx, 320, 180, [arrowOver('a', 0.2, 0.6)]);   // no dissolve: a hold or a seek
    expect(calls).toContain('stroke');
    expect(alphas).toEqual([]);
  });

  it('keeps an arrow small enough not to swamp the picture', () => {
    for (const w of [640, 1280, 1920, 3840]) {
      expect(arrowMetrics(w).head).toBeLessThan(w * 0.02);
      expect(arrowMetrics(w).weight).toBeLessThan(w * 0.004);
    }
  });

  it('draws grips only for the picked annotation, at its own ends', () => {
    const { ctx, arcs } = fakeCtx();
    drawAnnotations(ctx, 320, 180, [arrow('a'), arrow('b')], 'b');
    // The two ends, then the three controls: the ×, the copy and the settings pencil
    // are each a disc — the arrow offers a property, so it gets the settings control.
    expect(arcs.length).toBe(5);
    expect(arcs[0].x).toBeCloseTo(0.1 * 320);
    expect(arcs[1].x).toBeCloseTo(0.9 * 320);

    const none = fakeCtx();
    drawAnnotations(none.ctx, 320, 180, [arrow('a')], null);
    expect(none.arcs.length).toBe(0);
  });

  it('gives a new kind the same grips without it drawing any', () => {
    const { ctx, arcs } = fakeCtx();
    drawAnnotations(ctx, 320, 180, [new Tripod()], 't1');
    expect(arcs.length).toBe(5);                 // three ends, and the two controls
  });

  it('puts the remove control off the annotation\'s side, so a press on it cannot aim', () => {
    const spot = removeControl(arrow('a'), 320, 180, 1);   // 0.1,0.5 -> 0.9,0.5
    expect(spot).not.toBeNull();
    expect(spot!.x).toBeCloseTo(0.5);            // beside its middle
    expect(spot!.y).toBeGreaterThan(0.5);        // and off the line, not on it
  });

  it('puts the copy control on the other side of the middle from the ×', () => {
    const a = arrow('a');                        // 0.1,0.5 -> 0.9,0.5
    const remove = removeControl(a, 320, 180, 1)!;
    const copy = copyControl(a, 320, 180, 1)!;
    expect(copy.x).toBeCloseTo(remove.x);        // the same distance along the arrow
    expect(copy.y).toBeLessThan(0.5);            // and the opposite side of the line
  });

  it('keeps the remove control inside the picture, at the edge', () => {
    const edge = Arrow.create(Span.of(0, 1), { x: 0.1, y: 0.99 }, { x: 0.9, y: 0.99 }, 'c');
    const spot = removeControl(edge!, 320, 180, 1);        // the offset would fall below it
    expect(spot!.y).toBe(1);
  });

  it('has no remove control for a kind with no pair of ends', () => {
    expect(removeControl(new Stub(), 320, 180, 1)).toBeNull();
  });

  it('has no copy control for a kind with no pair of ends either', () => {
    expect(copyControl(new Stub(), 320, 180, 1)).toBeNull();
  });

  it('sizes a grip to the screen, not to the picture', () => {
    const small = fakeCtx({ width: 640, clientWidth: 640 });      // 1 canvas px per screen px
    drawAnnotations(small.ctx, 640, 360, [arrow('a')], 'a');
    const big = fakeCtx({ width: 3840, clientWidth: 640 });       // 6 canvas px per screen px
    drawAnnotations(big.ctx, 3840, 2160, [arrow('a')], 'a');
    expect(small.arcs[0].r).toBeGreaterThan(0);
    expect(big.arcs[0].r / small.arcs[0].r).toBeCloseTo(6);
  });

  it('draws a grip of a sane size when the canvas is not on screen (an export)', () => {
    const { ctx, arcs } = fakeCtx();
    drawAnnotations(ctx, 1280, 720, [arrow('a')], 'a');
    expect(Number.isFinite(arcs[0].r)).toBe(true);
    expect(arcs[0].r).toBeGreaterThan(0);
  });

  it('takes a new renderer without changing what the arrow draws', () => {
    const box: AnnotationRenderer<Annotation> = { id: 'box', draw: () => {} };
    registerRenderer(box);
    expect(rendererOf('box')?.id).toBe('box');

    const { ctx, calls } = fakeCtx();
    drawAnnotations(ctx, 320, 180, [arrow('a')]);
    expect(calls).toContain('stroke');
  });

  it('skips a kind it cannot draw, rather than failing', () => {
    const { ctx, calls } = fakeCtx();
    drawAnnotations(ctx, 320, 180, [new Stub()]);
    expect(calls).toEqual([]);
  });
});
