import { describe, expect, it } from 'vitest';

import {
  pluginOf, plugins, propertiesFor, propertiesOf, registerPlugin,
  type AnnotationPlugin, type AnnotationProperty,
} from './annotation-plugin.js';
// Imported for its side effect: the arrow registers itself, which is what makes the
// section offer its action and the layer draw it. Only this plugin is imported — the
// image's and the text's modules touch the DOM at load, so their lists are proved in
// the browser harness instead (quickstart §2).
import './arrow-plugin.js';
import { Annotation } from '../../domain/annotation/Annotation.js';
import { Arrow } from '../../domain/annotation/Arrow.js';
import { Span } from '../../domain/clip/Span.js';
import { Take } from '../../domain/clip/Take.js';
import { Clip } from '../../domain/clip/Clip.js';
import type { Picture } from '../../domain/clip/ClipSize.js';
import type { TakeRepository } from '../../domain/clip/TakeRepository.js';
import { durationProperty, DURATION_STEP_S } from './duration-property.js';

// A throwaway plugin, the one the register exists for. It lives only in this test:
// registering it is what proves a new kind needs no change to the canvas or the marks.

const stub = (id: string): AnnotationPlugin => ({
  id,
  action: { label: id, title: `add a ${id}`, icon: '<svg/>' },
  renderer: { id, draw: () => {} },
  begin: () => {},
});

describe('the annotation plugin register', () => {
  it('knows the arrow, and null for a kind it does not offer', () => {
    expect(pluginOf('arrow')?.id).toBe('arrow');
    expect(pluginOf('hologram')).toBeNull();
  });

  it('takes a new plugin and lists it, without the arrow changing', () => {
    const before = pluginOf('arrow')?.action.label;
    registerPlugin(stub('box'));
    expect(pluginOf('box')?.id).toBe('box');
    expect(plugins().map(p => p.id)).toContain('box');
    expect(pluginOf('arrow')?.action.label).toBe(before);
  });

  it('replaces a plugin registered under the same id, as a test wants', () => {
    registerPlugin(stub('box'));
    registerPlugin({ ...stub('box'), action: { label: 'Box', title: 't', icon: 'i' } });
    expect(pluginOf('box')?.action.label).toBe('Box');
  });
});

describe('the properties a kind offers', () => {
  it('the arrow offers its colour', () => {
    expect(pluginOf('arrow')?.properties?.map(p => p.id)).toEqual(['colour']);
  });

  it('a kind that offers none has no list, so it gets no settings control', () => {
    registerPlugin(stub('plain'));
    expect(pluginOf('plain')?.properties ?? []).toEqual([]);
  });

  it('propertiesOf answers for the annotation it is given, and for none', () => {
    const arrow = Arrow.create(Span.of(0, 1), { x: 0.1, y: 0.5 }, { x: 0.9, y: 0.5 });
    expect(propertiesOf(arrow).map(p => p.id)).toEqual(['colour']);
    expect(propertiesOf(null)).toEqual([]);
  });

  it('a new kind brings its own properties with no change to the register', () => {
    const colour: AnnotationProperty = {
      id: 'colour',
      label: 'Colour',
      control: 'colour',
      value: () => '#111827',
      with: annotation => annotation,
    };
    registerPlugin({ ...stub('tag'), properties: [colour] });
    expect(pluginOf('tag')?.properties?.map(p => p.id)).toEqual(['colour']);
  });
});

// The smallest collection that behaves like the real one, so the clip can be built in node.
class FakeTakes implements TakeRepository {
  private takes: Take[] = [];
  add(blob: Blob, duration: number, picture?: Picture | null): Take {
    const take = Take.of(this.takes.length + 1, blob, `blob:${this.takes.length + 1}`, duration, picture ?? null);
    this.takes.push(take);
    return take;
  }
  all() { return this.takes; }
  at(index: number) { return this.takes[index]; }
  count() { return this.takes.length; }
  isEmpty() { return !this.takes.length; }
  startOf(index: number) { let at = 0; for (let i = 0; i < index && i < this.takes.length; i++) at += this.takes[i].duration; return at; }
  indexAt(seconds: number) { for (let i = 0; i < this.takes.length; i++) if (seconds < this.startOf(i) + this.takes[i].duration) return i; return Math.max(0, this.takes.length - 1); }
  totalDuration() { return this.takes.reduce((total, take) => total + take.duration, 0); }
  clear() { this.takes = []; }
}

const clipOf = (...durations: number[]): Clip => {
  const clip = Clip.empty(new FakeTakes());
  for (const seconds of durations) clip.addTake(new Blob(['x']), seconds);
  return clip;
};

/** A kind of annotation that declares no properties of its own, to prove the shared duration. */
class Barekind extends Annotation {
  static readonly id = 'barekind';
  constructor(span: Span = Span.of(0.1, 0.3), id = 'bare-1') { super(id, span, Barekind.id); }
  handles() { return []; }
  withHandle() { return null; }
  movedBy() { return this; }
  withSpan(span: Span) { return new Barekind(span, this.id); }
  duplicated(span: Span) { return new Barekind(span, 'bare-2'); }
  hitTest() { return false; }
  stored() { return { id: this.id, kind: this.kind, s: this.span.s, e: this.span.e, geometry: {} }; }
}

describe('the shared duration property', () => {
  const arrow = (): Arrow => {
    const made = Arrow.create(Span.of(0.2, 0.4), { x: 0.1, y: 0.5 }, { x: 0.9, y: 0.5 });
    if (!made) throw new Error('no arrow');
    return made;
  };

  it('reads an annotation’s length in seconds of the clip, and sets it', () => {
    const clip = clipOf(10);
    const duration = durationProperty(clip);
    expect(DURATION_STEP_S).toBe(0.1);
    expect(duration.value(arrow())).toBe('2.00');           // 0.2 of a 10 s clip
    const longer = duration.with(arrow(), '3');
    expect(longer?.span.s).toBeCloseTo(0.2);
    expect(longer?.span.length).toBeCloseTo(0.3);
  });

  it('refuses a value that is not a number, and one the rule will not take', () => {
    const clip = clipOf(10);
    const duration = durationProperty(clip);
    expect(duration.with(arrow(), 'nonsense')).toBeNull();
    expect(duration.with(arrow(), '0')).toBeNull();
  });

  it('propertiesFor is the kind’s own properties plus the duration', () => {
    const clip = clipOf(10);
    const one = arrow();
    clip.addAnnotation(one);
    expect(propertiesFor(one, clip).map(p => p.id)).toEqual(['colour', 'duration']);
  });

  it('leaves the duration off the clip’s watermark', () => {
    const clip = clipOf(10);
    const water = arrow().withSpan(Span.of(0, 1));
    clip.addAnnotation(water);
    clip.setWatermarks([water]);
    expect(propertiesFor(water, clip).map(p => p.id)).toEqual(['colour']);
  });
});

describe('a new kind fits the same control', () => {
  it('takes a row and the shared duration with no edit to the column or the descriptor', () => {
    registerPlugin(stub('barekind'));
    expect(plugins().map(p => p.id)).toContain('barekind');

    const clip = clipOf(10);
    const one = new Barekind();
    clip.addAnnotation(one);
    // A kind that declares no properties still gets the one shared duration, so the
    // annotate column and the duration control never learn the kind.
    expect(propertiesFor(one, clip).map(p => p.id)).toEqual(['duration']);
  });
});