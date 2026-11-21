import { describe, expect, it } from 'vitest';

import { AnnotationSidecar } from './AnnotationSidecar.js';
import { Span } from './Span.js';
import { Arrow } from '../annotation/Arrow.js';
import type { StoredAnnotation } from '../annotation/Annotation.js';

// What a sidecar *is*: the annotations, the length they are fractions of, and the rule
// that says when they may be taken on. Writing it as a file is `src/infra`, which has its
// own check beside it.

/** A real arrow, written down the way a clip writes one down. */
function arrow(s: number, e: number): StoredAnnotation {
  const made = Arrow.create(Span.of(s, e), { x: 0.1, y: 0.2 }, { x: 0.6, y: 0.7 });
  if (!made) throw new Error('the test could not make an arrow');
  return made.stored();
}

const sidecarOf = (length: number, stored: StoredAnnotation[]): AnnotationSidecar =>
  AnnotationSidecar.of(length, stored);

describe('AnnotationSidecar', () => {
  it('gives the annotations back, with their stretches and their ids', () => {
    const stored = arrow(0.25, 0.5);

    const restored = sidecarOf(4, [stored]).forLength(4);

    expect(restored?.count).toBe(1);
    const [annotation] = restored!.all;
    expect(annotation.id).toBe(stored.id);
    expect(annotation.kind).toBe(stored.kind);
    expect(annotation.span.s).toBeCloseTo(0.25);
    expect(annotation.span.e).toBeCloseTo(0.5);
  });

  it('is taken for a file of its own length, and one that drifted by a frame', () => {
    const sidecar = sidecarOf(4, [arrow(0.25, 0.5)]);

    // An export stops a hair short of the last frame, and a re-encode drifts by one.
    expect(sidecar.forLength(4)).not.toBeNull();
    expect(sidecar.forLength(3.95)).not.toBeNull();
    expect(sidecar.forLength(3.98)).not.toBeNull();
  });

  it('is refused for a file of another length, where the fractions would be guesses', () => {
    const sidecar = sidecarOf(12, [arrow(0.25, 0.5)]);

    expect(sidecar.forLength(9)).toBeNull();
    expect(sidecar.forLength(0)).toBeNull();
  });

  it('takes a very short clip on a frame\u2019s drift, not on two per cent of it', () => {
    const sidecar = sidecarOf(1, [arrow(0.25, 0.5)]);

    expect(sidecar.forLength(1.2)).not.toBeNull();
    expect(sidecar.forLength(0.7)).toBeNull();
  });

  it('keeps the kinds it knows and leaves out one it does not', () => {
    const stranger: StoredAnnotation = { id: 'an-x', kind: 'hologram', s: 0.1, e: 0.2, geometry: {} };

    const restored = sidecarOf(4, [arrow(0.25, 0.5), stranger]).forLength(4);

    expect(restored?.all.map(annotation => annotation.kind)).toEqual(['arrow']);
  });

  it('carries the pictures its annotations draw, under the ids they name', () => {
    const picture = { id: 'im-1', blob: new Blob(['bytes'], { type: 'image/png' }) };

    const sidecar = AnnotationSidecar.of(4, [arrow(0.25, 0.5)], [picture]);

    expect(sidecar.pictures).toEqual([picture]);
  });

  it('carries nothing when there is nothing to carry', () => {
    expect(sidecarOf(4, []).forLength(4)?.isEmpty).toBe(true);
    expect(sidecarOf(4, []).pictures).toEqual([]);
  });
});
