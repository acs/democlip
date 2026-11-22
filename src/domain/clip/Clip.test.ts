import { describe, expect, it } from 'vitest';

import { Clip, type ClipEvent } from './Clip.js';
import { Span } from './Span.js';
import { Take } from './Take.js';
import { Arrow } from '../annotation/Arrow.js';
import { AnnotationSet } from '../annotation/AnnotationSet.js';
import type { Annotation } from '../annotation/Annotation.js';
import type { TakeRepository } from './TakeRepository.js';
import type { Picture } from './ClipSize.js';

// The port is what makes this possible: the aggregate is tested with the smallest
// collection that behaves like the real one, and nothing here touches a browser.
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

/** A clip whose takes carry measured picture sizes, which is what its own size follows. */
const clipSized = (...pictures: Array<{ width: number; height: number }>): Clip => {
  const clip = Clip.empty(new FakeTakes());
  for (const picture of pictures) clip.addTake(new Blob(['x']), 2, picture);
  return clip;
};

describe('Clip', () => {
  it('is as long as its takes, without ever being told', () => {
    const clip = clipOf(3, 4);
    expect(clip.total()).toBe(7);
    expect(clip.takes.count()).toBe(2);
  });

  it('takes a cut out of the timeline, and says what that was worth', () => {
    const clip = clipOf(10);
    expect(clip.approve(Span.of(0.2, 0.3))).toBeCloseTo(1);
    expect(clip.keptLength()).toBeCloseTo(9);
    expect(clip.cuts.spans.length).toBe(1);
  });

  it('puts the last one back, once, and says which it was', () => {
    const clip = clipOf(10);
    clip.approve(Span.of(0.2, 0.3));
    const change = clip.undo();
    expect(change?.type).toBe('cut-approved');
    expect(change?.type === 'cut-approved' && change.cut.equals(Span.of(0.2, 0.3))).toBe(true);
    expect(clip.keptLength()).toBeCloseTo(10);
    expect(clip.canUndo()).toBe(false);
    expect(clip.undo()).toBeNull();
  });

  it('remembers what the last cut was worth, for the timeline to say', () => {
    const clip = clipOf(10);
    clip.approve(Span.of(0.1, 0.2));
    expect(clip.canUndo()).toBe(true);
    expect(clip.lastRemoved()).toBeCloseTo(1);
  });

  it('keeps a cut over its moment when the clip grows', () => {
    const clip = clipOf(10);
    clip.approve(Span.of(0.5, 0.6));            // 5s-6s
    clip.addTake(new Blob(['x']), 10);          // now 20s of clip
    expect(clip.cuts.spans[0].s).toBeCloseTo(0.25);
    expect(clip.cuts.spans[0].e).toBeCloseTo(0.3);
    expect(clip.keptLength()).toBeCloseTo(19);  // 20s of clip, the same 1s still gone
    expect(clip.canUndo()).toBe(false);         // measured against a clip that moved
  });

  it('says what an export is made of: the kept stretches, take by take', () => {
    expect(clipOf(3, 3).segmentsIn(0, 6).map(s => [s.takeIndex, s.from, s.to]))
      .toEqual([[0, 0, 3], [1, 3, 6]]);
  });

  it('and leaves the cut stretches out of them, closing the gap', () => {
    const clip = clipOf(3, 3);
    clip.approve(Span.of(0.7, 0.8));            // 4.2s-4.8s of the 6s clip
    expect(clip.segmentsIn(0, 6).map(s => [s.takeIndex, +s.from.toFixed(2), +s.to.toFixed(2)]))
      .toEqual([[0, 0, 3], [1, 3, 4.2], [1, 4.8, 6]]);
  });

  it('empties itself: the takes and the cuts', () => {
    const clip = clipOf(4);
    clip.approve(Span.of(0.1, 0.2));
    clip.clear();
    expect(clip.total()).toBe(0);
    expect(clip.keptLength()).toBe(0);
    expect(clip.cuts.isEmpty).toBe(true);
    expect(clip.canUndo()).toBe(false);
  });
});

describe('Clip, written down and read back', () => {
  it('snapshots its takes and cuts', () => {
    const clip = clipOf(4, 6);
    clip.approve(Span.of(0.2, 0.3));
    const snap = clip.snapshot();
    expect(snap.takes.map(t => t.duration)).toEqual([4, 6]);
    expect(snap.cuts.map(c => [c.s, c.e])).toEqual([[0.2, 0.3]]);
  });

  it('restores a clip from a snapshot, as long and as cut as it was', () => {
    const clip = Clip.empty(new FakeTakes());
    clip.restore({
      takes: [{ blob: new Blob(['a']), duration: 4 }, { blob: new Blob(['b']), duration: 6 }],
      cuts: [{ s: 0.2, e: 0.3 }],
    });
    expect(clip.total()).toBe(10);
    expect(clip.takes.count()).toBe(2);
    expect(clip.cuts.spans.map(c => [c.s, c.e])).toEqual([[0.2, 0.3]]);
    expect(clip.canUndo()).toBe(false);
  });

  it('comes back the same the second time round', () => {
    const clip = clipOf(5, 5);
    clip.approve(Span.of(0.1, 0.2));
    const snap = clip.snapshot();
    clip.clear();
    clip.restore(snap);
    expect(clip.snapshot()).toEqual(snap);
  });

  it('announces nothing when it is restored', () => {
    const clip = clipOf(4);
    const seen: string[] = [];
    clip.onChange(event => seen.push(event.type));
    clip.restore({ takes: [{ blob: new Blob(['x']), duration: 2 }], cuts: [] });
    expect(seen).toEqual([]);
  });
});

describe('Clip, announcing what changed', () => {
  it('says a take arrived, with where it landed and how long the clip was before', () => {
    const clip = Clip.empty(new FakeTakes());
    const seen: ClipEvent[] = [];
    clip.onChange(event => seen.push(event));
    clip.addTake(new Blob(['x']), 3);
    clip.addTake(new Blob(['x']), 4);
    expect(seen).toEqual([
      { type: 'take-added', take: clip.takes.at(0), index: 0, previousTotal: 0 },
      { type: 'take-added', take: clip.takes.at(1), index: 1, previousTotal: 3 },
    ]);
  });

  it('says a cut was approved, what it was worth, and that it went back', () => {
    const clip = clipOf(10);
    const seen: ClipEvent[] = [];
    clip.onChange(event => seen.push(event));
    clip.approve(Span.of(0.2, 0.3));
    clip.undo();
    expect(seen.map(e => e.type)).toEqual(['cut-approved', 'cut-undone']);
    expect(seen[0]).toMatchObject({ removed: 1 });
    const undone = seen[1] as { cut: Span };
    expect(undone.cut.equals(Span.of(0.2, 0.3))).toBe(true);
  });

  it('says the session was dropped', () => {
    const clip = clipOf(4);
    const seen: string[] = [];
    clip.onChange(event => seen.push(event.type));
    clip.clear();
    expect(seen).toEqual(['cleared']);
  });

  it('lets a listener stop listening', () => {
    const clip = clipOf(4);
    const seen: string[] = [];
    const stop = clip.onChange(event => seen.push(event.type));
    clip.approve(Span.of(0.1, 0.2));
    stop();
    clip.approve(Span.of(0.3, 0.4));
    expect(seen).toEqual(['cut-approved']);
  });
});

// ── Annotations ────────────────────────────────────────────────────────────────

const arrow = (id: string, s: number, e: number): Annotation => {
  const made = Arrow.create(Span.of(s, e), { x: 0.1, y: 0.5 }, { x: 0.9, y: 0.5 }, id);
  if (!made) throw new Error('the test arrow should be usable');
  return made;
};

describe('Clip, annotations', () => {
  it('holds what is drawn over the picture, and says which show at a moment', () => {
    const clip = clipOf(10);
    clip.addAnnotation(arrow('a', 0.1, 0.3));
    expect(clip.annotations.count).toBe(1);
    expect(clip.annotationsAt(2).map(a => a.id)).toEqual(['a']);   // 2s is 0.2 of the clip
    expect(clip.annotationsAt(5)).toEqual([]);
  });

  it('is not shown at the exact end of its stretch, which is half-open', () => {
    const clip = clipOf(10);
    clip.addAnnotation(arrow('a', 0.2, 0.4));          // 2s-4s
    expect(clip.annotationsAt(2).map(a => a.id)).toEqual(['a']);   // the start is inside
    expect(clip.annotationsAt(4)).toEqual([]);                    // the end is not
  });

  it('takes the last change back, whatever kind it was: an arrow added', () => {
    const clip = clipOf(10);
    clip.addAnnotation(arrow('a', 0.1, 0.3));
    expect(clip.canUndo()).toBe(true);
    expect(clip.pendingUndo()?.type).toBe('annotation-added');
    clip.undo();
    expect(clip.annotations.isEmpty).toBe(true);
    expect(clip.canUndo()).toBe(false);
  });

  it('puts a removed arrow back, and a changed one back the way it was', () => {
    const clip = clipOf(10);
    clip.addAnnotation(arrow('a', 0.1, 0.3));
    expect(clip.removeAnnotation('a')?.id).toBe('a');
    clip.undo();
    expect(clip.annotations.byId('a')?.span.s).toBeCloseTo(0.1);

    clip.changeAnnotation('a', arrow('a', 0.4, 0.6));
    expect(clip.annotations.byId('a')?.span.s).toBeCloseTo(0.4);
    clip.undo();
    expect(clip.annotations.byId('a')?.span.s).toBeCloseTo(0.1);
  });

  it('takes an arrow out of the way of a cut, and brings it back when the cut is undone', () => {
    const clip = clipOf(10);
    clip.addAnnotation(arrow('a', 0.1, 0.3));          // 1s-3s
    clip.approve(Span.of(0.15, 0.25));                 // 1.5s-2.5s
    expect(clip.annotationsAt(2)).toEqual([]);         // inside the cut: nothing drawn
    expect(clip.annotationsAt(1.2).map(a => a.id)).toEqual(['a']);  // outside it: drawn
    clip.undo();                                       // the cut goes back
    expect(clip.annotationsAt(2).map(a => a.id)).toEqual(['a']);
  });

  it('keeps an arrow over its moment when the clip grows', () => {
    const clip = clipOf(10);
    clip.addAnnotation(arrow('a', 0.5, 0.6));          // 5s-6s
    clip.addTake(new Blob(['x']), 10);                 // now 20s
    expect(clip.annotations.byId('a')?.span.s).toBeCloseTo(0.25);
    expect(clip.annotationsAt(5).map(a => a.id)).toEqual(['a']);
  });

  it('writes the annotations down and reads them back', () => {
    const clip = clipOf(4);
    clip.addAnnotation(arrow('a', 0.2, 0.3));
    const snap = clip.snapshot();
    expect(snap.annotations?.map(a => a.id)).toEqual(['a']);
    const back = Clip.empty(new FakeTakes());
    back.restore(snap);
    expect(back.annotations.byId('a')?.span.e).toBeCloseTo(0.3);
    expect(back.snapshot()).toEqual(snap);
  });

  it('drops an annotation of a kind it does not know, rather than failing', () => {
    const clip = Clip.empty(new FakeTakes());
    clip.restore({
      takes: [{ blob: new Blob(['x']), duration: 4 }],
      cuts: [],
      annotations: [{ id: 'z', kind: 'hologram', s: 0.1, e: 0.2, geometry: {} }],
    });
    expect(clip.annotations.isEmpty).toBe(true);
  });

  it('announces an arrow added, changed and removed', () => {
    const clip = clipOf(10);
    const seen: ClipEvent[] = [];
    clip.onChange(event => seen.push(event));
    clip.addAnnotation(arrow('a', 0.1, 0.3));
    clip.changeAnnotation('a', arrow('a', 0.2, 0.4));
    clip.removeAnnotation('a');
    expect(seen.map(e => e.type)).toEqual(['annotation-added', 'annotation-changed', 'annotation-removed']);
  });

  it('empties the annotations with the cuts', () => {
    const clip = clipOf(4);
    clip.addAnnotation(arrow('a', 0.1, 0.3));
    clip.clear();
    expect(clip.annotations.isEmpty).toBe(true);
  });
});

describe('Clip, what it says about itself', () => {
  it('sets a property and reads it back, and says nothing changed for the same value again', () => {
    const clip = clipOf(4);
    const seen: ClipEvent[] = [];
    clip.onChange(event => seen.push(event));

    expect(clip.setProperty('title', 'A demo')).toBe(true);
    expect(clip.properties.get('title')).toBe('A demo');
    expect(clip.setProperty('title', 'A demo')).toBe(false);   // not a change

    expect(seen).toEqual([
      { type: 'property-changed', id: 'title', value: 'A demo', previous: '' },
    ]);
  });

  it('takes a property change back with the one undo', () => {
    const clip = clipOf(4);
    clip.setProperty('title', 'A demo');
    expect(clip.canUndo()).toBe(true);
    expect(clip.pendingUndo()?.type).toBe('property-changed');
    clip.undo();
    expect(clip.properties.get('title')).toBe('');
    expect(clip.canUndo()).toBe(false);
  });

  it('writes its properties down and reads them back', () => {
    const clip = clipOf(4);
    clip.setProperty('title', 'A demo');
    clip.setProperty('description', 'What it shows');
    const snap = clip.snapshot();
    expect(snap.properties).toEqual({ title: 'A demo', description: 'What it shows' });

    const back = Clip.empty(new FakeTakes());
    back.restore(snap);
    expect(back.properties.get('title')).toBe('A demo');
    expect(back.snapshot()).toEqual(snap);
  });

  it('opens a clip written before properties existed, with none', () => {
    const clip = Clip.empty(new FakeTakes());
    clip.restore({ takes: [{ blob: new Blob(['x']), duration: 4 }], cuts: [] });
    expect(clip.properties.toRecord()).toEqual({});
  });

  it('keeps a property across a new take: it is not a fraction of the clip', () => {
    const clip = clipOf(10);
    clip.setProperty('title', 'A demo');
    clip.addTake(new Blob(['x']), 10);
    expect(clip.properties.get('title')).toBe('A demo');
  });

  it('lets the properties go with the session', () => {
    const clip = clipOf(4);
    clip.setProperty('title', 'A demo');
    clip.clear();
    expect(clip.properties.toRecord()).toEqual({});
    expect(clip.canUndo()).toBe(false);
  });
});

describe('Clip, leaving as a file and coming back', () => {
  it('writes its annotations as a file of the kept stretches holds them', () => {
    const clip = clipOf(4, 4);                     // 8s
    clip.addAnnotation(arrow('a', 0.25, 0.375));   // 2s-3s
    clip.approve(Span.of(0, 0.125));               // 0s-1s gone, so the file holds 7s

    const [written] = clip.annotationsAsExported();

    // The arrow is one second into the file, which is seven long, and one second wide.
    expect(clip.keptLength()).toBeCloseTo(7);
    expect(written.s).toBeCloseTo(1 / 7);
    expect(written.e).toBeCloseTo(2 / 7);
    expect(written.kind).toBe('arrow');
  });

  it('pushes the written annotations along by the card at the head of the file', () => {
    const clip = clipOf(4, 4);                     // 8s
    clip.addAnnotation(arrow('a', 0.25, 0.375));   // 2s-3s
    clip.approve(Span.of(0, 0.125));               // 0s-1s gone: the file holds 7s, plus 3s of card

    const [written] = clip.annotationsAsExported(3);

    // The file is ten long, the card takes the first three, and the arrow is one second
    // into the clip after that: 4s to 5s of the ten.
    expect(written.s).toBeCloseTo(4 / 10);
    expect(written.e).toBeCloseTo(5 / 10);
  });

  it('writes nothing for an annotation the cuts took entirely', () => {
    const clip = clipOf(4);
    clip.addAnnotation(arrow('a', 0.25, 0.375));   // 1s-1.5s
    clip.approve(Span.of(0.2, 0.4));               // ...and that stretch is gone

    expect(clip.annotationsAsExported()).toEqual([]);
  });

  it('takes on the annotations a file carried, without that becoming the undo', () => {
    const clip = clipOf(4);
    clip.addAnnotation(arrow('a', 0.1, 0.2));

    const taken = clip.carry(AnnotationSet.of([arrow('b', 0.5, 0.6)]));

    expect(taken).toBe(1);
    expect(clip.annotations.all.map(annotation => annotation.id)).toEqual(['a', 'b']);
    expect(clip.canUndo()).toBe(false);            // a load, not an edit
  });

  it('takes on nothing for an id it already has', () => {
    const clip = clipOf(4);
    clip.addAnnotation(arrow('a', 0.1, 0.2));

    expect(clip.carry(AnnotationSet.of([arrow('a', 0.5, 0.6)]))).toBe(0);
    expect(clip.annotations.byId('a')?.span.s).toBeCloseTo(0.1);
  });
});

// The clip's own size: the largest take picture (both even) until the person sets one,
// kept with the clip, taken back by the one undo, and written down with the takes.

describe('Clip size', () => {
  it('is the largest take picture, both edges even', () => {
    const clip = clipSized({ width: 1280, height: 720 }, { width: 985, height: 611 });
    expect(clip.size()?.toString()).toBe('1280x720');

    clip.addTake(new Blob(['x']), 2, { width: 1920, height: 1081 });
    expect(clip.size()?.toString()).toBe('1920x1082');
  });

  it('grows to a larger take and does not shrink for a smaller one', () => {
    const clip = clipSized({ width: 1280, height: 720 });
    clip.addTake(new Blob(['x']), 2, { width: 1920, height: 1080 });
    expect(clip.size()?.toString()).toBe('1920x1080');

    clip.addTake(new Blob(['x']), 2, { width: 640, height: 480 });
    expect(clip.size()?.toString()).toBe('1920x1080');
  });

  it('is null for a clip whose takes have no measured picture', () => {
    expect(Clip.empty(new FakeTakes()).size()).toBeNull();
    expect(clipOf(2).size()).toBeNull();
  });

  it('is not moved by a size written into the properties — it follows the takes', () => {
    const clip = clipSized({ width: 1280, height: 720 });
    clip.setProperty('size', '800x600');
    expect(clip.size()?.toString()).toBe('1280x720');

    clip.addTake(new Blob(['x']), 2, { width: 1920, height: 1080 });
    expect(clip.size()?.toString()).toBe('1920x1080');
  });

  it("comes back from a snapshot with the takes' pictures", () => {
    const clip = clipSized({ width: 1920, height: 1080 });
    const rebuilt = Clip.empty(new FakeTakes());
    rebuilt.restore(clip.snapshot());
    expect(rebuilt.size()?.toString()).toBe('1920x1080');
  });
});

// Applying what a **profile** fixes: announced, so every view follows it, and deliberately
// not what the one undo takes back — the profile would only put it back.
describe('Clip.applyProperty', () => {
  it('announces the change, so the views follow it', () => {
    const clip = Clip.empty(new FakeTakes());
    const seen: ClipEvent[] = [];
    clip.onChange(event => seen.push(event));

    expect(clip.applyProperty('addToExport', 'true')).toBe(true);
    expect(clip.properties.get('addToExport')).toBe('true');
    expect(seen).toEqual([{ type: 'property-changed', id: 'addToExport', value: 'true', previous: '' }]);
  });

  it('is no change at all when the clip already holds the value', () => {
    const clip = Clip.empty(new FakeTakes());
    clip.applyProperty('addToExport', 'true');
    const seen: ClipEvent[] = [];
    clip.onChange(event => seen.push(event));

    expect(clip.applyProperty('addToExport', 'true')).toBe(false);
    expect(seen).toEqual([]);
  });

  it('is not what the one undo takes back: the person’s own last change still is', () => {
    const clip = Clip.empty(new FakeTakes());
    clip.setProperty('title', 'A demo');
    clip.applyProperty('addToExport', 'true');

    expect(clip.pendingUndo()).toEqual({ type: 'property-changed', id: 'title', value: 'A demo', previous: '' });
    clip.undo();
    expect(clip.properties.get('title')).toBe('');
    expect(clip.properties.get('addToExport')).toBe('true');
  });
});
