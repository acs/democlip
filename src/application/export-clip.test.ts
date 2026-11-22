import { describe, expect, it } from 'vitest';

import { planExport } from './export-clip.js';
import { Clip } from '../domain/clip/Clip.js';
import { Arrow } from '../domain/annotation/Arrow.js';
import { Span } from '../domain/clip/Span.js';
import { IntroCard } from '../domain/clip/IntroCard.js';
import { Take } from '../domain/clip/Take.js';
import type { TakeRepository } from '../domain/clip/TakeRepository.js';

// The same smallest collection that behaves like the real one as in Clip.test.ts:
// the port is what lets the use case run in node, with no browser anywhere.
class FakeTakes implements TakeRepository {
  private takes: Take[] = [];

  add(blob: Blob, duration: number): Take {
    const take = Take.of(this.takes.length + 1, blob, `blob:${this.takes.length + 1}`, duration);
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

const settings = { audio: false, fadeSeconds: 0.08, annotations: 'drawn' as const };

describe('planExport', () => {
  it('plans the whole clip', () => {
    const plan = planExport(clipOf(10), settings);
    expect(plan?.pieces).toHaveLength(1);
    expect(plan?.total).toBeCloseTo(9.95);      // a hair off the end, so the last frame decodes
    expect(plan?.to).toBeCloseTo(9.95);
  });

  it('leaves the cut out, and says where each take lands', () => {
    const clip = clipOf(5, 5);
    clip.approve(Span.of(0.3, 0.4));            // 3s-4s of the 10s clip
    const plan = planExport(clip, settings);
    expect(plan?.pieces.map(p => [p.takeIndex, +p.at.toFixed(2)]))
      .toEqual([[0, 0], [0, 3], [1, 4]]);
    expect(plan?.steps.map(s => s.joinAt)).toEqual([null, 4]);
  });

  it('plans nothing when there is nothing to write', () => {
    expect(planExport(clipOf(), settings)).toBeNull();     // no takes at all
  });

  it('carries whether the clip has sound', () => {
    expect(planExport(clipOf(4), { audio: true, fadeSeconds: 0.08, annotations: 'drawn' })?.audio).toBe(true);
  });

  it('puts a title card at the head of the file when the export has one', () => {
    const intro = IntroCard.of('A demo', 'What it shows', new Date(2026, 0, 2, 12), 3)!;
    const plan = planExport(clipOf(10), { ...settings, intro })!;
    expect(plan.intro).toBe(intro);
    expect(plan.pieces[0].at).toBe(3);              // the clip's own frames start after it
    expect(plan.total).toBeCloseTo(12.95);          // 9.95s of clip and 3s of card
  });

  it('draws no annotations into a file that carries them beside it', () => {
    const clip = clipOf(4);
    const arrow = Arrow.create(Span.of(0.25, 0.5), { x: 0.1, y: 0.1 }, { x: 0.5, y: 0.5 }, 'an-1');
    clip.addAnnotation(arrow!);

    const drawn = planExport(clip, settings)!;
    const carried = planExport(clip, { ...settings, annotations: 'carried' })!;

    expect(drawn.annotationsAt(1.5)).toHaveLength(1);      // a moment the arrow is over
    expect(carried.annotationsAt(1.5)).toHaveLength(0);    // the file holds the picture only
    // ...and the clip still knows them: that is what is written beside the file.
    expect(clip.annotationsAsExported()).toHaveLength(1);
  });
});
