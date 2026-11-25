import { describe, expect, it } from 'vitest';

import { Span } from '../clip/Span.js';
import { annotationFrom } from './kinds.js';
import {
  DEFAULT_ZOOM, Magnifier, MAX_RADIUS, MAX_ZOOM, MIN_RADIUS, MIN_ZOOM, ZOOM_STEP,
} from './Magnifier.js';

const WIDE = { w: 1280, h: 720 };     // 16:9, the recording
const TALL = { w: 720, h: 1280 };     // its portrait

const made = (geometry: Partial<{ x: number; y: number; radius: number; zoom: number }> = {}): Magnifier => {
  const one = Magnifier.create(Span.of(0.2, 0.4), {
    x: geometry.x ?? 0.5, y: geometry.y ?? 0.5,
    radius: geometry.radius ?? 0.2, zoom: geometry.zoom ?? DEFAULT_ZOOM,
  });
  if (!one) throw new Error('the test magnifier should be usable');
  return one;
};

describe('the magnifier', () => {
  it('is made in the clip’s colour, at the default zoom, and reads back as the app’s red', () => {
    expect(made().colour).toBe(Magnifier.DEFAULT_COLOUR);
    const green = Magnifier.create(Span.of(0, 1), { x: 0.5, y: 0.5, radius: 0.2, zoom: 3 }, 'm1', '#38a169');
    expect(green?.colour).toBe('#38a169');
    expect(green?.geometry.zoom).toBe(3);
    // A clip written before the kind knew a zoom falls back to the default rather than failing.
    const old = Magnifier.restore({ id: 'm2', kind: 'magnifier', s: 0, e: 1, geometry: { x: 0.5, y: 0.5, radius: 0.2 } });
    expect(old?.geometry.zoom).toBe(DEFAULT_ZOOM);
  });

  it('pulls a lens inside the picture and refuses one below the smallest or past the zoom range', () => {
    expect(made({ x: 0.01, y: 0.99, radius: 0.2 }).geometry).toMatchObject({
      x: MIN_RADIUS, // the centre is pulled in by the smallest lens
      y: 1 - MIN_RADIUS,
      radius: MIN_RADIUS,
    });
    expect(Magnifier.create(Span.of(0, 1), { x: 0.5, y: 0.5, radius: MIN_RADIUS / 2, zoom: 2 })).toBeNull();
    expect(Magnifier.create(Span.of(0, 1), { x: 0.5, y: 0.5, radius: 0.2, zoom: MIN_ZOOM - 0.1 })).toBeNull();
    expect(Magnifier.create(Span.of(0, 1), { x: 0.5, y: 0.5, radius: 0.2, zoom: MAX_ZOOM + 0.1 })).toBeNull();
    expect(Magnifier.create(Span.of(0, 1), { x: 0.5, y: 0.5, radius: 0.2, zoom: Number.NaN })).toBeNull();
    expect(Magnifier.create(Span.of(0, 1), { x: 0.5, y: 0.5, radius: 0.9, zoom: 2 })?.geometry.radius).toBe(MAX_RADIUS);
  });

  it('caps a lens at the room its centre leaves', () => {
    const one = made({ x: 0.1, radius: 0.4 });
    expect(one.geometry.radius).toBe(0.1);
    expect(one.geometry.x).toBe(0.1);
    expect(one.geometry.y).toBe(0.5);
    expect(one.isUsable).toBe(true);
  });

  it('puts its two grips on the rim, measured by the shorter side, so the lens is round at any shape', () => {
    const one = made();
    const radiusPx = one.geometry.radius * Math.min(WIDE.w, WIDE.h);
    const [left, right] = one.handles(WIDE);
    expect(left.end).toBe('left');
    expect(right.end).toBe('right');
    expect((one.geometry.x - left.x) * WIDE.w).toBeCloseTo(radiusPx);
    expect((right.x - one.geometry.x) * WIDE.w).toBeCloseTo(radiusPx);
    expect(left.y).toBe(one.geometry.y);
    expect(right.y).toBe(one.geometry.y);

    // The same lens on a portrait: the shorter side is the width now, and the pixel
    // offset is still the same radius — a circle, not an ellipse.
    const tallRadiusPx = one.geometry.radius * Math.min(TALL.w, TALL.h);
    const [leftTall, rightTall] = one.handles(TALL);
    expect((one.geometry.x - leftTall.x) * TALL.w).toBeCloseTo(tallRadiusPx);
    expect((rightTall.x - one.geometry.x) * TALL.w).toBeCloseTo(tallRadiusPx);
  });

  it('resizes around the same centre, bottoms at the smallest lens, and caps at the room', () => {
    const one = made();
    const larger = one.withHandle('right', { x: 0.6, y: 0.5 }, { picture: WIDE });
    expect(larger).not.toBeNull();
    expect(larger!.geometry.x).toBe(one.geometry.x);
    expect(larger!.geometry.y).toBe(one.geometry.y);
    expect(larger!.geometry.radius).toBeCloseTo((0.1 * WIDE.w) / Math.min(WIDE.w, WIDE.h));
    expect(larger!.geometry.zoom).toBe(one.geometry.zoom);

    const smallest = one.withHandle('left', { x: 0.5001, y: 0.5 }, { picture: WIDE });
    expect(smallest!.geometry.radius).toBe(MIN_RADIUS);

    const nearEdge = Magnifier.create(Span.of(0, 1), { x: 0.15, y: 0.5, radius: 0.1, zoom: 2 })!;
    const capped = nearEdge.withHandle('right', { x: 0.9, y: 0.5 }, { picture: WIDE });
    expect(capped!.geometry.radius).toBeCloseTo(0.15);
    expect(capped!.geometry.x).toBe(0.15);
    expect(one.withHandle('right', { x: 0.6, y: 0.5 })).toBeNull();   // no picture, no resize
    expect(one.withHandle('middle', { x: 0.6, y: 0.5 }, { picture: WIDE })).toBeNull();
  });

  it('moves inside the picture and keeps its radius, zoom and colour', () => {
    const one = made();
    const left = one.movedBy(-0.8, 0)!;
    expect(left.geometry.x).toBeCloseTo(one.geometry.radius);
    expect(left.geometry.y).toBe(one.geometry.y);
    expect(left.geometry.radius).toBe(one.geometry.radius);
    expect(left.geometry.zoom).toBe(one.geometry.zoom);
    expect(left.colour).toBe(one.colour);
    expect(one.movedBy(0.05, 0.05)!.geometry).toMatchObject({ x: 0.55, y: 0.55 });
  });

  it('changes zoom only inside its range, and keeps the lens as it is otherwise', () => {
    const one = made();
    expect(one.withZoom(3)?.geometry.zoom).toBe(3);
    expect(one.withZoom(MIN_ZOOM)?.geometry.zoom).toBe(MIN_ZOOM);
    expect(one.withZoom(MAX_ZOOM)?.geometry.zoom).toBe(MAX_ZOOM);
    expect(one.withZoom(MIN_ZOOM - 0.01)).toBeNull();
    expect(one.withZoom(MAX_ZOOM + 0.01)).toBeNull();
    expect(one.withZoom(Number.NaN)).toBeNull();
    expect(one.withZoom(DEFAULT_ZOOM)).toBe(one);                 // nothing to change is not a change
    expect(ZOOM_STEP).toBe(0.5);
    expect(MAX_RADIUS).toBe(0.5);
  });

  it('changes its colour alone, and copies itself with a new id and the same shape', () => {
    const one = made();
    const green = one.withColour('#38a169');
    expect(green.colour).toBe('#38a169');
    expect(green.geometry).toEqual(one.geometry);

    const copy = one.duplicated(Span.of(0.5, 0.7));
    expect(copy.id).not.toBe(one.id);
    expect(copy.geometry).toEqual(one.geometry);
    expect(copy.colour).toBe(one.colour);
    expect(copy.span).toEqual(Span.of(0.5, 0.7));
  });

  it('is picked inside its pixel circle and nowhere outside it', () => {
    const one = made();
    expect(one.hitTest(0.5, 0.5, WIDE.w, WIDE.h, 0)).toBe(true);
    expect(one.hitTest(0.6, 0.5, WIDE.w, WIDE.h, 0)).toBe(true);     // inside 144 px
    expect(one.hitTest(0.7, 0.5, WIDE.w, WIDE.h, 0)).toBe(false);    // 256 px away
    expect(one.hitTest(0.7, 0.5, WIDE.w, WIDE.h, 120)).toBe(true);   // within a generous tolerance
  });

  it('round-trips its geometry and colour through what is written down', () => {
    const one = made({ x: 0.4, y: 0.6, radius: 0.15, zoom: 3 });
    const back = Magnifier.restore(one.stored());
    expect(back?.geometry).toEqual(one.geometry);
    expect(back?.colour).toBe(one.colour);
    expect(back?.id).toBe(one.id);
    expect(annotationFrom(one.stored())?.kind).toBe('magnifier');
  });

  it('leaves an unusable written shape out rather than failing the clip', () => {
    expect(Magnifier.restore({ id: 'x', kind: 'magnifier', s: 0, e: 1, geometry: { x: 0.5, y: 0.5, radius: 0.001 } })).toBeNull();
    expect(Magnifier.restore({ id: 'x', kind: 'magnifier', s: 0, e: 1, geometry: { x: 0.5, y: 0.5, radius: 0.2, zoom: 99 } })).toBeNull();
    expect(Magnifier.restore({ id: 'x', kind: 'magnifier', s: 0, e: 1, geometry: null })).toBeNull();
  });
});