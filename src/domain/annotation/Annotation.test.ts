import { describe, expect, it } from 'vitest';

import { Span } from '../clip/Span.js';
import { Annotation, DEFAULT_ANNOTATION_S, MIN_ANNOTATION_S, newAnnotationId } from './Annotation.js';
import { Arrow } from './Arrow.js';
import { ImageAnnotation } from './ImageAnnotation.js';
import { TextAnnotation } from './TextAnnotation.js';

describe('annotation identity', () => {
  it('gives ids that do not repeat', () => {
    expect(new Set([newAnnotationId(), newAnnotationId(), newAnnotationId()]).size).toBe(3);
  });

  it('gives one a restored annotation never has, because those carry their own', () => {
    expect(newAnnotationId()).not.toBe(newAnnotationId());
  });
});

describe('annotation duration', () => {
  /** An arrow over `[s, e)` of the clip, or a loud failure if it cannot be made. */
  const arrow = (s = 0.2, e = 0.4): Arrow => {
    const made = Arrow.create(Span.of(s, e), { x: 0.3, y: 0.3 }, { x: 0.6, y: 0.6 });
    if (!made) throw new Error('no arrow');
    return made;
  };

  it('starts a new one at two seconds and keeps nothing shorter than a tenth', () => {
    expect(DEFAULT_ANNOTATION_S).toBe(2);
    expect(MIN_ANNOTATION_S).toBe(0.1);
  });

  it('keeps the start and sets the length, in seconds of the clip', () => {
    const next = arrow(0.2, 0.4).withDuration(3, 10);    // start 0.2, wants 3 s of a 10 s clip
    expect(next?.span.s).toBeCloseTo(0.2);
    expect(next?.span.length).toBeCloseTo(0.3);
  });

  it('clamps the end inside the clip rather than running past it', () => {
    const next = arrow(0.8, 0.9).withDuration(5, 10);    // would end at 1.3
    expect(next?.span.s).toBeCloseTo(0.8);
    expect(next?.span.e).toBe(1);
  });

  it('refuses a duration below the shortest worth keeping', () => {
    expect(arrow().withDuration(MIN_ANNOTATION_S / 2, 10)).toBeNull();
    expect(arrow().withDuration(0, 10)).toBeNull();
    expect(arrow().withDuration(-1, 10)).toBeNull();
  });

  it('refuses a value that is not a number, and a clip with no length', () => {
    expect(arrow().withDuration(Number.NaN, 10)).toBeNull();
    expect(arrow().withDuration(Number.POSITIVE_INFINITY, 10)).toBeNull();
    expect(arrow().withDuration(1, 0)).toBeNull();
  });

  it('keeps what a kind carries beyond its stretch — the arrow’s colour, ends and id', () => {
    const before = arrow();
    const after = before.withDuration(1, 10) as Arrow;
    expect(after).toBeInstanceOf(Annotation);
    expect(after.id).toBe(before.id);
    expect(after.colour).toBe(before.colour);
    expect(after.from).toEqual(before.from);
    expect(after.to).toEqual(before.to);
  });

  it('keeps a text’s words and colour, and an image’s picture', () => {
    const text = TextAnnotation.create(
      Span.of(0.1, 0.3), { text: 'hi', x: 0.1, y: 0.1, width: 0.2, height: 0.1 }, undefined, '#f6e05e',
    );
    if (!text) throw new Error('no text');
    const reworded = text.withDuration(1, 10) as TextAnnotation;
    expect(reworded.geometry.text).toBe('hi');
    expect(reworded.colour).toBe('#f6e05e');

    const image = ImageAnnotation.create(Span.of(0.1, 0.3), {
      imageId: 'p1', x: 0.1, y: 0.1, width: 0.2, height: 0.2, imageAspect: 1, pictureAspect: 1,
    });
    if (!image) throw new Error('no image');
    const resized = image.withDuration(1, 10) as ImageAnnotation;
    expect(resized.geometry.imageId).toBe('p1');
  });
});
