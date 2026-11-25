import { describe, expect, it } from 'vitest';

import { Span } from '../clip/Span.js';
import { AnnotationSet } from './AnnotationSet.js';
import { SoundAnnotation } from './SoundAnnotation.js';

const span = Span.of(0.2, 0.4);

const make = (sound = 'chime', id = 's1'): SoundAnnotation => {
  const annotation = SoundAnnotation.create(span, sound, id);
  if (!annotation) throw new Error('the test sound should be usable');
  return annotation;
};

describe('the sound annotation', () => {
  it('names a stock sound, and refuses one the app does not serve', () => {
    const sound = make('chime');
    expect(sound.geometry).toEqual({ sound: 'chime' });
    expect(sound.kind).toBe('sound');
    expect(sound.span.equals(span)).toBe(true);
    expect(SoundAnnotation.create(span, 'applause')).toBeNull();
    expect(SoundAnnotation.create(span, undefined)).toBeNull();
  });

  it('has no shape: nothing to drag, nothing to resize, never picked from the picture', () => {
    const sound = make();
    expect(sound.handles()).toEqual([]);
    expect(sound.withHandle()).toBeNull();
    expect(sound.hitTest()).toBe(false);
  });

  it('is a no-op when moved, so a copy is placed unshifted rather than lost', () => {
    const sound = make();
    const moved = sound.movedBy();
    expect(moved.id).toBe(sound.id);
    expect(moved.geometry).toEqual(sound.geometry);
  });

  it('changes its sound and keeps its id, its span and its kind', () => {
    const sound = make('chime');
    const changed = sound.withSound('gong');
    expect(changed?.geometry).toEqual({ sound: 'gong' });
    expect(changed?.id).toBe(sound.id);
    expect(changed?.span.equals(span)).toBe(true);
    expect(changed?.kind).toBe('sound');
    expect(sound.withSound('applause')).toBeNull();
  });

  it('copies as a new sound of the same sound', () => {
    const sound = make('gong');
    const copy = sound.duplicated(Span.of(0.5, 0.6));
    expect(copy.id).not.toBe(sound.id);
    expect(copy.geometry).toEqual({ sound: 'gong' });
    expect(copy.span.s).toBe(0.5);
  });

  it('reads its own shape back, and leaves out a sound the build does not serve', () => {
    const sound = make('chime');
    expect(SoundAnnotation.restore(sound.stored())?.geometry).toEqual({ sound: 'chime' });
    expect(SoundAnnotation.restore({ id: 'x', kind: 'sound', s: 0, e: 1, geometry: { sound: 'applause' } })).toBeNull();
    // a kind this build does not know is left out too — the same rule, one level up
    expect(AnnotationSet.of([sound]).count).toBe(1);
  });
});
