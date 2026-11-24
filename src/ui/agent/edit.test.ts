import { describe, expect, it } from 'vitest';

import { createEditor } from './edit.js';
import { Clip } from '../../domain/clip/Clip.js';
import { Span } from '../../domain/clip/Span.js';
import { Take } from '../../domain/clip/Take.js';
import { Arrow } from '../../domain/annotation/Arrow.js';
import { TextAnnotation } from '../../domain/annotation/TextAnnotation.js';
import type { TakeRepository } from '../../domain/clip/TakeRepository.js';
import { registerPlugin, type AnnotationPlugin } from '../annotating/annotation-plugin.js';
import { MIN_SECTION } from '../cutting/selection.js';
import type { MakeAnnotation } from './edit.js';

// The editing operations, proved in node: what they do to the clip, and — the half
// that matters most — what they refuse, and that a refusal leaves the clip alone.

class FakeTakes implements TakeRepository {
  private takes: Take[] = [];
  add(blob: Blob, duration: number, picture?: { width: number; height: number } | null): Take {
    const take = Take.of(this.takes.length + 1, blob, `blob:${this.takes.length + 1}`, duration, picture ?? null);
    this.takes.push(take);
    return take;
  }
  all() { return this.takes; }
  at(index: number) { return this.takes[index]; }
  count() { return this.takes.length; }
  isEmpty() { return !this.takes.length; }
  startOf(index: number) { let at = 0; for (let i = 0; i < index && i < this.takes.length; i++) at += this.takes[i].duration; return at; }
  indexAt(seconds: number) {
    for (let i = 0; i < this.takes.length; i++) if (seconds < this.startOf(i) + this.takes[i].duration) return i;
    return Math.max(0, this.takes.length - 1);
  }
  totalDuration() { return this.takes.reduce((total, take) => total + take.duration, 0); }
  clear() { this.takes = []; }
}

const clipOf = (...durations: number[]): Clip => {
  const clip = Clip.empty(new FakeTakes());
  for (const seconds of durations) clip.addTake(new Blob(['x']), seconds, { width: 1280, height: 720 });
  return clip;
};

const stubKind: AnnotationPlugin = {
  id: 'stub',
  action: { label: 'Stub', title: 'Stub', icon: '' },
  renderer: { id: 'stub', draw: () => {} },
  properties: [
    {
      id: 'colour',
      label: 'Colour',
      control: 'colour',
      value: () => 'red',
      with: (_annotation, value) => (value === 'blue' ? null : _annotation),
    },
  ],
  begin: () => {},
};

const editorOf = (clip: Clip, make: MakeAnnotation = () => ({ reason: 'not in this check' })) =>
  createEditor(clip, make);

describe('cut', () => {
  it('takes a stretch out, and says what that was worth', () => {
    const clip = clipOf(10);
    const result = editorOf(clip).cut(0.2, 0.4);
    expect(result).toEqual({ ok: true, removed: 2 });
    expect(clip.keptLength()).toBeCloseTo(8);
  });

  it('refuses a stretch thinner than the minimum, and leaves the clip alone', () => {
    const clip = clipOf(10);
    const result = editorOf(clip).cut(0.2, 0.2 + MIN_SECTION / 2);
    expect(result.ok).toBe(false);
    expect(clip.keptLength()).toBe(10);
    expect(clip.cuts.spans.length).toBe(0);
  });

  it('refuses a stretch that is not two numbers', () => {
    const clip = clipOf(10);
    expect(editorOf(clip).cut(NaN, 0.5).ok).toBe(false);
    expect(clip.cuts.spans.length).toBe(0);
  });
});

describe('annotate', () => {
  it('refuses a kind the app does not have', async () => {
    const clip = clipOf(10);
    const result = await editorOf(clip).annotate('hologram', { span: { s: 0.1, e: 0.4 } });
    expect(result).toMatchObject({ ok: false });
    expect(clip.annotations.count).toBe(0);
  });

  it('refuses a stretch that is too short to be shown over', async () => {
    registerPlugin(stubKind);
    const clip = clipOf(10);
    const result = await editorOf(clip).annotate('stub', { span: { s: 0.1, e: 0.1 + MIN_SECTION / 2 } });
    expect(result).toMatchObject({ ok: false });
    expect(clip.annotations.count).toBe(0);
  });

  it('makes one through the kind\u2019s maker, and answers its id', async () => {
    registerPlugin(stubKind);
    const clip = clipOf(10);
    const arrow = Arrow.create(Span.of(0.1, 0.4), { x: 0.2, y: 0.3 }, { x: 0.6, y: 0.7 });
    expect(arrow).not.toBeNull();
    const result = await editorOf(clip, () => ({ annotation: arrow! })).annotate('stub', { span: { s: 0.1, e: 0.4 } });
    expect(result).toEqual({ ok: true, id: arrow!.id });
    expect(clip.annotations.count).toBe(1);
  });

  it('hands the maker the colour the clip makes new annotations in', async () => {
    registerPlugin(stubKind);
    const clip = clipOf(10);
    clip.setProperty('annotationColour', '#3182ce');
    const arrow = Arrow.create(Span.of(0.1, 0.4), { x: 0.2, y: 0.3 }, { x: 0.6, y: 0.7 })!;
    let seen: string | null = null;
    await editorOf(clip, (_kind, _params, _span, colour) => {
      seen = colour;
      return { annotation: arrow };
    }).annotate('stub', { span: { s: 0.1, e: 0.4 } });
    // The clip's own annotation colour, not the kind's fallback: an agent's arrow is the same
    // colour a person's would be.
    expect(seen).toBe('#3182ce');
  });

  it('waits for a maker that has to read something first, as an image does', async () => {
    registerPlugin(stubKind);
    const clip = clipOf(10);
    const arrow = Arrow.create(Span.of(0.1, 0.4), { x: 0.2, y: 0.3 }, { x: 0.6, y: 0.7 })!;
    // The maker answers later, as one that decodes and keeps a picture must: the clip
    // takes the annotation only once there is one, and the answer still arrives.
    const result = await editorOf(clip, () => Promise.resolve({ annotation: arrow }))
      .annotate('stub', { span: { s: 0.1, e: 0.4 } });
    expect(result).toEqual({ ok: true, id: arrow.id });
    expect(clip.annotations.count).toBe(1);
  });

  it('passes a maker\u2019s own refusal through, and leaves the clip alone', async () => {
    registerPlugin(stubKind);
    const clip = clipOf(10);
    const result = await editorOf(clip, () => ({ reason: 'that picture could not be read' }))
      .annotate('stub', { span: { s: 0.1, e: 0.4 } });
    expect(result).toEqual({ ok: false, reason: 'that picture could not be read' });
    expect(clip.annotations.count).toBe(0);
  });
});

describe('setProperty', () => {
  const withOne = (): Clip => {
    // The stub stands in for the text kind, under the id the annotation carries, so
    // the property is read from the same place the inspector reads it.
    registerPlugin({ ...stubKind, id: TextAnnotation.id });
    const clip = clipOf(10);
    clip.addAnnotation(TextAnnotation.create(Span.of(0.1, 0.4), {
      text: 'hello', x: 0.1, y: 0.1, width: 0.3, height: 0.1,
    })!);
    return clip;
  };

  it('changes the value through the kind\u2019s own property', () => {
    const clip = withOne();
    const id = clip.annotations.all[0].id;
    const result = editorOf(clip).setProperty(id, 'colour', 'green');
    expect(result).toEqual({ ok: true, value: 'red' });
  });

  it('refuses a value the kind will not take', () => {
    const clip = withOne();
    const id = clip.annotations.all[0].id;
    expect(editorOf(clip).setProperty(id, 'colour', 'blue')).toMatchObject({ ok: false });
  });

  it('refuses a property the kind does not have, and an unknown id', () => {
    const clip = withOne();
    const id = clip.annotations.all[0].id;
    expect(editorOf(clip).setProperty(id, 'smell', 'x')).toMatchObject({ ok: false });
    expect(editorOf(clip).setProperty('nope', 'colour', 'green')).toMatchObject({ ok: false });
  });
});

describe('setClipProperty', () => {
  it('changes what the clip says about itself, through the clip register', () => {
    const clip = clipOf(10);
    const result = editorOf(clip).setClipProperty('title', 'A demo');
    expect(result).toEqual({ ok: true, value: 'A demo' });
    expect(clip.properties.get('title')).toBe('A demo');
  });

  it('refuses a property the clip does not have, and leaves the clip alone', () => {
    const clip = clipOf(10);
    expect(editorOf(clip).setClipProperty('subtitle', 'x')).toMatchObject({ ok: false });
    expect(clip.properties.toRecord()).toEqual({});
  });

  it('refuses the switch to add the card while the clip has nothing to put on it', () => {
    const clip = clipOf(10);
    const refused = editorOf(clip).setClipProperty('addToExport', 'true');
    expect(refused).toMatchObject({ ok: false });
    expect(clip.properties.get('addToExport')).toBe('');
    // A word on the clip is what it was waiting for, and the same change then goes through.
    editorOf(clip).setClipProperty('title', 'A demo');
    expect(editorOf(clip).setClipProperty('addToExport', 'true')).toEqual({ ok: true, value: 'true' });
  });

  it('is the change the one undo takes back', () => {
    const clip = clipOf(10);
    const editor = editorOf(clip);
    editor.setClipProperty('description', 'What it shows');
    expect(editor.undo()).toEqual({ ok: true, change: 'property-changed' });
    expect(clip.properties.get('description')).toBe('');
  });
});

describe('remove and undo', () => {
  it('removes one and says what kind it was', () => {
    registerPlugin(stubKind);
    const clip = clipOf(10);
    const arrow = Arrow.create(Span.of(0.1, 0.4), { x: 0.2, y: 0.3 }, { x: 0.6, y: 0.7 })!;
    clip.addAnnotation(arrow);
    expect(editorOf(clip).remove(arrow.id)).toEqual({ ok: true, kind: Arrow.id });
    expect(clip.annotations.count).toBe(0);
  });

  it('refuses to remove one that is not there', () => {
    expect(editorOf(clipOf(10)).remove('nope')).toMatchObject({ ok: false });
  });

  it('takes back the last change, whatever kind it was', () => {
    const clip = clipOf(10);
    const editor = editorOf(clip);
    editor.cut(0.2, 0.4);
    expect(editor.undo()).toEqual({ ok: true, change: 'cut-approved' });
    expect(clip.keptLength()).toBe(10);
  });

  it('refuses to undo when there is nothing to take back', () => {
    expect(editorOf(clipOf(10)).undo()).toMatchObject({ ok: false });
  });
});
