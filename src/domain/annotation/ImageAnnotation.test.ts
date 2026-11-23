import { describe, expect, it } from 'vitest';

import { Span } from '../clip/Span.js';
import { ImageAnnotation, type ImageGeometry } from './ImageAnnotation.js';
import type { StoredAnnotation } from './Annotation.js';

const span = Span.of(0.2, 0.4);

// A 1:1 picture on a 16:9 clip picture, unless a test says otherwise.
const geo = (over: Partial<ImageGeometry> = {}): ImageGeometry => ({
  imageId: 'img1', x: 0.3, y: 0.3, width: 0.2, height: 0.2, imageAspect: 1, pictureAspect: 16 / 9,
  ...over,
});

const make = (over: Partial<ImageGeometry> = {}): ImageAnnotation => {
  const image = ImageAnnotation.create(span, geo(over));
  if (!image) throw new Error('the test image should be usable');
  return image;
};

describe('the image annotation', () => {
  it('pulls the whole rect inside the picture, and keeps its kind and stretch', () => {
    const image = ImageAnnotation.create(span, geo({ x: 1.5, y: -0.5, width: 0.3, height: 0.4 }));
    expect(image?.geometry).toMatchObject({ x: 0.7, y: 0, width: 0.3, height: 0.4 });
    expect(image?.kind).toBe('image');
    expect(image?.span.equals(span)).toBe(true);
  });

  it('refuses a rect below the minimum, and one with no picture', () => {
    expect(ImageAnnotation.create(span, geo({ width: 0.005 }))).toBeNull();
    expect(ImageAnnotation.create(span, geo({ imageId: '' }))).toBeNull();
  });

  it('is not fooled by a NaN', () => {
    expect(make({ x: NaN, y: NaN }).geometry).toMatchObject({ x: 0, y: 0 });
  });

  it('gives the four corners to take hold of', () => {
    const corners = make({ x: 0.2, y: 0.2, width: 0.3, height: 0.4 }).handles();
    expect(corners.map(c => c.end)).toEqual(['nw', 'ne', 'se', 'sw']);
    const expected = [[0.2, 0.2], [0.5, 0.2], [0.5, 0.6], [0.2, 0.6]];
    corners.forEach((c, i) => {
      expect(c.x).toBeCloseTo(expected[i][0]);
      expect(c.y).toBeCloseTo(expected[i][1]);
    });
  });

  it('keeps the picture\'s proportions on a resize, with the opposite corner fixed', () => {
    const image = make({ x: 0.3, y: 0.3, width: 0.2, height: 0.2, imageAspect: 1, pictureAspect: 16 / 9 });
    const resized = image.withHandle('se', { x: 0.6, y: 0.9 });
    // width from the drag; height solved so the picture is not squashed
    expect(resized?.geometry.width).toBeCloseTo(0.3);
    expect(resized?.geometry.height).toBeCloseTo(0.3 * (16 / 9));
    // the nw corner is the anchor and does not move
    expect(resized?.geometry.x).toBeCloseTo(0.3);
    expect(resized?.geometry.y).toBeCloseTo(0.3);
    // and the displayed shape is the picture's own
    const g = resized!.geometry;
    expect((g.width * g.pictureAspect) / (g.height * g.imageAspect)).toBeCloseTo(1);
  });

  it('resizes freely in both directions when told to', () => {
    const resized = make({ x: 0.3, y: 0.3, width: 0.2, height: 0.2 }).withHandle('se', { x: 0.6, y: 0.9 }, { free: true });
    expect(resized?.geometry.width).toBeCloseTo(0.3);
    expect(resized?.geometry.height).toBeCloseTo(0.6);
    expect(resized?.geometry.x).toBeCloseTo(0.3);
  });

  it('clamps a drag past the anchor rather than flipping the rect', () => {
    const image = make({ x: 0.3, y: 0.3, width: 0.2, height: 0.2 });
    const resized = image.withHandle('se', { x: 0.1, y: 0.1 });
    expect(resized).not.toBeNull();
    expect(resized?.geometry.width).toBeGreaterThan(0);
    expect(resized?.geometry.x).toBeCloseTo(0.3);         // the anchor held
  });

  it('anchors each corner on its opposite', () => {
    const base = { x: 0.2, y: 0.2, width: 0.2, height: 0.2, imageAspect: 1, pictureAspect: 1 };
    const nw = make(base).withHandle('nw', { x: 0.15, y: 0.15 }, { free: true })!.geometry;
    for (const [a, b] of [[nw.x, 0.15], [nw.y, 0.15], [nw.width, 0.25], [nw.height, 0.25]]) expect(a).toBeCloseTo(b);
    const ne = make(base).withHandle('ne', { x: 0.5, y: 0.1 }, { free: true })!.geometry;
    for (const [a, b] of [[ne.x, 0.2], [ne.y, 0.1], [ne.width, 0.3], [ne.height, 0.3]]) expect(a).toBeCloseTo(b);
    const sw = make(base).withHandle('sw', { x: 0.15, y: 0.6 }, { free: true })!.geometry;
    for (const [a, b] of [[sw.x, 0.15], [sw.y, 0.2], [sw.width, 0.25], [sw.height, 0.4]]) expect(a).toBeCloseTo(b);
    expect(make(base).withHandle('nowhere', { x: 0, y: 0 })).toBeNull();
  });

  it('moves whole, pulled back inside the picture', () => {
    const image = make({ x: 0.3, y: 0.3, width: 0.2, height: 0.2 });
    const moved = image.movedBy(0.9, 0)?.geometry;
    expect(moved?.x).toBeCloseTo(0.8);                 // 1 - width
    expect(moved?.y).toBeCloseTo(0.3);
    expect(moved?.width).toBeCloseTo(0.2);
  });

  it('follows a clip that grew, keeping its rect', () => {
    const grown = make().withSpan(Span.of(0.1, 0.2));
    expect(grown.span.s).toBeCloseTo(0.1);
    expect(grown.geometry).toEqual(make().geometry);
  });

  it('copies itself as a new image over the same picture', () => {
    const image = make();
    const copy = image.duplicated(Span.of(0.6, 0.8));
    expect(copy.id).not.toBe(image.id);
    expect(copy.geometry.imageId).toBe(image.geometry.imageId);
    expect(copy.geometry).toEqual(image.geometry);
    expect(copy.span.s).toBeCloseTo(0.6);
  });

  it('knows when a point is inside it', () => {
    const image = make({ x: 0.3, y: 0.3, width: 0.2, height: 0.2 });
    expect(image.hitTest(0.4, 0.4)).toBe(true);
    expect(image.hitTest(0.6, 0.4)).toBe(false);
  });

  it('writes itself down and reads itself back', () => {
    const image = make();
    const stored = image.stored();
    expect(stored).toMatchObject({ id: image.id, kind: 'image', s: 0.2, e: 0.4 });
    expect(ImageAnnotation.restore(stored)?.geometry).toEqual(image.geometry);
    expect(ImageAnnotation.restore(stored)?.id).toBe(image.id);
  });

  it('reads a damaged one back as nothing, rather than throwing', () => {
    expect(ImageAnnotation.restore({ id: 'z', kind: 'image', s: 0, e: 0.1, geometry: null } as StoredAnnotation)).toBeNull();
    expect(ImageAnnotation.restore({ id: 'z', kind: 'image', s: 0, e: 0.1, geometry: { imageId: '' } } as unknown as StoredAnnotation)).toBeNull();
  });
});
