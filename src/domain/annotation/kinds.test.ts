import { describe, expect, it } from 'vitest';

import { Span } from '../clip/Span.js';
import { AnnotationSet } from './AnnotationSet.js';
import { Arrow } from './Arrow.js';
import { Annotation, type AnnotationHandle, type StoredAnnotation } from './Annotation.js';
import { SoundAnnotation } from './SoundAnnotation.js';
import { annotationFrom, registerKind, registeredKinds } from './kinds.js';

// A throwaway second kind, the one the register exists for. It lives only in this
// test: registering it is what proves a new kind needs no change to the arrow.

class Dot extends Annotation {
  static readonly id = 'dot';

  private constructor(id: string, span: Span, readonly x: number, readonly y: number) {
    super(id, span, Dot.id);
  }

  static create(span: Span, x: number, y: number, id = 'dot-1'): Dot {
    const clamp = (v: number) => Math.min(1, Math.max(0, v));
    return new Dot(id, span, clamp(x), clamp(y));
  }

  static restore(stored: StoredAnnotation): Dot | null {
    const g = stored.geometry as { x?: number; y?: number } | null;
    return Dot.create(Span.of(stored.s, stored.e), g?.x ?? 0, g?.y ?? 0, stored.id);
  }

  handles(): readonly AnnotationHandle[] { return [{ x: this.x, y: this.y, end: 'at' }]; }
  withHandle(): Dot { return this; }
  movedBy(dx: number, dy: number): Dot { return Dot.create(this.span, this.x + dx, this.y + dy, this.id); }
  withSpan(span: Span): Dot { return Dot.create(span, this.x, this.y, this.id); }
  duplicated(span: Span): Dot { return Dot.create(span, this.x, this.y); }
  hitTest(): boolean { return false; }
  stored(): StoredAnnotation {
    return { id: this.id, kind: this.kind, s: this.span.s, e: this.span.e, geometry: { x: this.x, y: this.y } };
  }
}

const arrowAt = (id: string): Arrow => {
  const arrow = Arrow.create(Span.of(0, 1), { x: 0, y: 0.5 }, { x: 1, y: 0.5 }, id);
  if (!arrow) throw new Error('the test arrow should be usable');
  return arrow;
};

describe('the annotation family', () => {
  it('knows the arrow, and null for a kind it does not know', () => {
    expect(registeredKinds()).toContain('arrow');
    expect(annotationFrom({ id: 'z', kind: 'hologram', s: 0, e: 1, geometry: {} })).toBeNull();
  });

  it('takes a new kind without changing the arrow', () => {
    const before = arrowAt('a1').geometry;

    registerKind(Dot);
    expect(registeredKinds()).toContain('dot');

    // the arrow is exactly as it was
    expect(arrowAt('a2').geometry).toEqual(before);

    // and the new kind is generic through the same set and the same register
    const dot = Dot.create(Span.of(0.2, 0.3), 2, -1, 'd1');
    expect({ x: dot.x, y: dot.y }).toEqual({ x: 1, y: 0 });
    expect(AnnotationSet.EMPTY.add(dot).at(0.25).map(a => a.kind)).toEqual(['dot']);
    expect(annotationFrom(dot.stored())?.kind).toBe('dot');
  });

  it('reads a sound annotation back, and leaves out a sound this build does not serve', () => {
    expect(registeredKinds()).toContain('sound');
    const sound = SoundAnnotation.create(Span.of(0.1, 0.3), 'gong', 's1');
    expect(annotationFrom(sound!.stored())?.kind).toBe('sound');
    // a name the app does not serve is left out, as an unknown kind is
    expect(annotationFrom({ id: 'x', kind: 'sound', s: 0, e: 1, geometry: { sound: 'applause' } })).toBeNull();
  });
});
