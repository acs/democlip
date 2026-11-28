import { describe, expect, it } from 'vitest';

import { agentAskedFor, createAgentSurface } from './surface.js';
import type { ProfileSummary, Result } from './surface.js';
import { describeClip } from './describe.js';
import { Clip } from '../../domain/clip/Clip.js';
import { Span } from '../../domain/clip/Span.js';
import { Take } from '../../domain/clip/Take.js';
import { Arrow } from '../../domain/annotation/Arrow.js';
import type { TakeRepository } from '../../domain/clip/TakeRepository.js';
import { registerPlugin, type AnnotationPlugin } from '../annotating/annotation-plugin.js';

// The surface is the app's own operations, so it is proved the way the app is: in
// node, with the smallest thing that behaves like the real one behind the port.
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
  for (const seconds of durations) clip.addTake(new Blob(['x']), seconds);
  return clip;
};

// A kind whose properties are declared the way a real kind declares them, so the
// description can be checked without pulling a renderer (and so the DOM) in.
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
      with: annotation => annotation,
    },
  ],
  begin: () => {},
};

describe('the gate', () => {
  it('lets a page that asked be driven, and only that page', () => {
    expect(agentAskedFor('?agent=1')).toBe(true);
    expect(agentAskedFor('?agent=1&other=x')).toBe(true);
    expect(agentAskedFor('')).toBe(false);
    expect(agentAskedFor('?agent=0')).toBe(false);
    expect(agentAskedFor('?agent')).toBe(false);
    expect(agentAskedFor('?other=1')).toBe(false);
  });

  it('publishes the version it was handed, and the app\u2019s own operations', () => {
    const surface = createAgentSurface({
      version: '1.2.3',
      describe: () => describeClip(clipOf()),
      sources: () => ({ screen: false, webcam: false, microphone: false }),
      takes: { start: () => ({ ok: true }), stop: async () => ({ ok: false, reason: 'none' }) },
      edit: {
        cut: () => ({ ok: true, removed: 0 }),
        annotate: async () => ({ ok: false, reason: 'none' }),
        setProperty: () => ({ ok: false, reason: 'none' }),
        setClipProperty: () => ({ ok: false, reason: 'none' }),
        remove: () => ({ ok: false, reason: 'none' }),
        undo: () => ({ ok: false, reason: 'nothing to undo' }),
      },
      view: {
        seek: () => ({ ok: true, at: 0 }),
        play: () => ({ ok: true }),
        pause: () => ({ ok: true }),
      },
      out: {
        export: async () => ({ ok: true, filename: 'democlip-1.webm' }),
        publish: async () => ({ ok: false, reason: 'nobody is signed in' }),
      },
      projects: {
        list: async () => ({ ok: true, projects: [], currentId: 'default' }),
        read: async () => ({ ok: false, reason: 'none' }),
        create: async () => ({ ok: false, reason: 'none' }),
        select: async () => ({ ok: false, reason: 'none' }),
        edit: async () => ({ ok: false, reason: 'none' }),
        move: async () => ({ ok: false, reason: 'none' }),
      },
      profiles: {
        list: (): Result<{ profiles: ProfileSummary[]; activeId: string }> =>
          ({ ok: true, profiles: [], activeId: 'default' }),
        create: async () => ({ ok: false, reason: 'none' }),
        edit: async () => ({ ok: false, reason: 'none' }),
      },
    });
    expect(surface.version).toBe('1.2.3');
    expect(Object.keys(surface).sort()).toEqual(['describe', 'edit', 'out', 'profiles', 'projects', 'sources', 'takes', 'version', 'view']);
  });
});

describe('describeClip', () => {
  it('reports the takes, the length, and no cuts or annotations on a fresh clip', () => {
    const described = describeClip(clipOf(3, 4));
    expect(described.length).toBe(7);
    expect(described.keptLength).toBe(7);
    expect(described.takes).toEqual([{ index: 0, seconds: 3 }, { index: 1, seconds: 4 }]);
    expect(described.cuts).toEqual([]);
    expect(described.annotations).toEqual([]);
    expect(described.properties).toEqual([
      { id: 'title', label: 'Title', control: 'text', value: '', readOnly: false },
      { id: 'description', label: 'Description', control: 'long-text', value: '', readOnly: false },
      { id: 'logo', label: 'Logo', control: 'choice', value: '', choices: ['', 'democlip', 'graditone'], readOnly: false },
      // The switch is read-only with nothing to put on the card, and comes to life with a word.
      { id: 'addToExport', label: 'Add to export', control: 'toggle', value: '', readOnly: true },
      // The colour a new annotation is made in: the app's red until the clip says otherwise, and
      // the palette offered by value so an agent is not guessing at a colour.
      { id: 'annotationColour', label: 'Annotation colour', control: 'colour', value: '#e53e3e', choices: ['#e53e3e', '#ff6c23', '#ffffff', '#f6e05e', '#38a169', '#3182ce', '#111827'], readOnly: false },
      // The sound boost: the one switch whose default is on, so it reads as on for a clip
      // that never set it, and it is the person's to move.
      { id: 'soundBoost', label: 'Boost the sound', control: 'toggle', value: 'true', readOnly: false },
      { id: 'size', label: 'Clip size', control: 'text', value: '', readOnly: true },
      // The size the file is finally written at: the clip size is left alone, and this is the
      // list of levels a person chooses or a profile fixes. Read-only here for the same reason the
      // switch is — this clip's takes carry no picture, so there is no picture to write at a size.
      { id: 'exportResolution', label: 'Export resolution', control: 'choice', value: '', choices: ['', '2160', '1440', '1080', '720', '480'], readOnly: true },
    ]);
  });

  it('reports the clip\'s own properties with the value it holds', () => {
    const clip = clipOf(3);
    clip.setProperty('title', 'A demo');
    const described = describeClip(clip);
    expect(described.properties.find(property => property.id === 'title')).toMatchObject({ value: 'A demo' });
    expect(described.properties.find(property => property.id === 'description')).toMatchObject({ value: '' });
  });

  it('reports the export resolution read-only when a profile fixes it, and the person\'s otherwise', () => {
    const clip = Clip.empty(new FakeTakes());
    clip.addTake(new Blob(['x']), 3, { width: 1280, height: 720 });
    clip.setProperty('exportResolution', '1080');
    // A picture is there, so the row is not blocked by the sound-only reason; what makes it
    // read-only is the profile that fixes it, and without one it is the person's.
    expect(describeClip(clip).properties.find(property => property.id === 'exportResolution'))
      .toMatchObject({ control: 'choice', value: '1080', readOnly: false });
    expect(describeClip(clip, id => (id === 'exportResolution' ? 'DemoClipTV' : null)).properties
      .find(property => property.id === 'exportResolution'))
      .toMatchObject({ value: '1080', readOnly: true });
  });

  it('reports a cut as a fraction of the clip, and the kept length it leaves', () => {
    const clip = clipOf(10);
    clip.approve(Span.of(0.2, 0.3));
    const described = describeClip(clip);
    expect(described.cuts).toEqual([{ s: 0.2, e: 0.3 }]);
    expect(described.keptLength).toBeCloseTo(9);
  });

  it('reports each annotation with its kind, its span and the properties its kind declares', () => {
    // The stub stands in for the kind, under the id the annotation carries, so the
    // description is read from the same place the inspector reads it.
    registerPlugin({ ...stubKind, id: Arrow.id });
    const clip = clipOf(10);
    const arrow = Arrow.create(Span.of(0.1, 0.4), { x: 0.2, y: 0.3 }, { x: 0.6, y: 0.7 });
    expect(arrow).not.toBeNull();
    clip.addAnnotation(arrow!);

    const [annotation] = describeClip(clip).annotations;
    expect(annotation.kind).toBe(Arrow.id);
    expect(annotation.span).toEqual({ s: 0.1, e: 0.4 });
    // The shape is readable as data too — the arrow's points and its colour.
    expect(annotation.geometry).toEqual({
      from: { x: 0.2, y: 0.3 }, to: { x: 0.6, y: 0.7 }, colour: '#e53e3e',
    });
    expect(annotation.properties).toEqual([
      { id: 'colour', label: 'Colour', control: 'colour', value: 'red' },
    ]);
    expect(annotation.id).toBeTruthy();
  });
});
