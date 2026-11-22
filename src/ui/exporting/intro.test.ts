import { describe, expect, it } from 'vitest';

import { INTRO_S, introFor } from './intro.js';
import { Clip } from '../../domain/clip/Clip.js';
import { Take } from '../../domain/clip/Take.js';
import type { TakeRepository } from '../../domain/clip/TakeRepository.js';

// The rule the export and both publishes ask: whether this clip wants a card, and how
// long it is. It reads the clip's own property and nothing else.

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

const withWords = (): Clip => {
  const clip = clipOf(4);
  clip.setProperty('title', 'A demo');
  clip.setProperty('description', 'What it shows');
  return clip;
};

describe('introFor', () => {
  it('is no card until the clip asks for one', () => {
    expect(introFor(withWords())).toBeNull();
  });

  it('is a card of two seconds when the clip asks and has words', () => {
    const clip = withWords();
    clip.setProperty('addToExport', 'true');
    expect(introFor(clip)).toMatchObject({ title: 'A demo', description: 'What it shows', seconds: 2 });
    expect(INTRO_S).toBe(2);
  });

  it('is a card from one word alone', () => {
    const clip = clipOf(4);
    clip.setProperty('title', 'A demo');
    clip.setProperty('addToExport', 'true');
    expect(introFor(clip)?.title).toBe('A demo');
  });

  it('is no card when the clip asks but has nothing to say', () => {
    const clip = clipOf(4);
    clip.setProperty('addToExport', 'true');
    expect(introFor(clip)).toBeNull();
  });
});
