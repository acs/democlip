import { describe, expect, it } from 'vitest';

import { INTRO_S, introFor } from './intro.js';
import { Clip } from '../../domain/clip/Clip.js';
import { Take } from '../../domain/clip/Take.js';
import type { TakeRepository } from '../../domain/clip/TakeRepository.js';

// The rule the export and both publishes ask: whether this clip wants a card, and what it
// shows. It reads the clip's own property and nothing else.

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

const DAY = new Date(2026, 10, 22, 9, 30);   // 22 November 2026

describe('introFor', () => {
  it('is no card until the clip asks for one', () => {
    expect(introFor(withWords(), DAY)).toBeNull();
  });

  it('is a card of two seconds when the clip asks, with the day line under the words', () => {
    const clip = withWords();
    clip.setProperty('addToExport', 'true');
    expect(introFor(clip, DAY)).toMatchObject({
      title: 'A demo', description: 'What it shows', stamp: '2026-11-22 - DemoClip', seconds: 2,
    });
    expect(INTRO_S).toBe(2);
  });

  it('is a card from one word alone', () => {
    const clip = clipOf(4);
    clip.setProperty('title', 'A demo');
    clip.setProperty('addToExport', 'true');
    expect(introFor(clip, DAY)?.title).toBe('A demo');
  });

  it('is a card even when the clip asks with nothing to say: the day line is always there', () => {
    const clip = clipOf(4);
    clip.setProperty('addToExport', 'true');
    expect(introFor(clip, DAY)?.stamp).toBe('2026-11-22 - DemoClip');
  });

  it('carries the logo the clip wears, and none at all by default', () => {
    const clip = withWords();
    clip.setProperty('addToExport', 'true');
    clip.setProperty('logo', 'democlip');
    expect(introFor(clip, DAY)?.logo).toBe('democlip');

    expect(introFor(withWords(), DAY)).toBeNull();          // no card, so nothing to carry
    const plain = clipOf(4);
    plain.setProperty('addToExport', 'true');
    expect(introFor(plain, DAY)?.logo).toBe('');
  });

  it('is a card for a logo alone: a logo lives on the card, so a clip that wears one opens with it', () => {
    const clip = clipOf(4);
    clip.setProperty('logo', 'democlip');
    expect(introFor(clip, DAY)).toMatchObject({ logo: 'democlip', seconds: INTRO_S, title: '' });
  });
});
