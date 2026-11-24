import { describe, expect, it } from 'vitest';

import { RestoreClip } from './restore-clip.js';
import { Clip, type ClipSnapshot } from '../domain/clip/Clip.js';
import { Take } from '../domain/clip/Take.js';
import type { TakeRepository } from '../domain/clip/TakeRepository.js';
import type { KeptClipPort } from './ports/KeptClipPort.js';

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

const clipWith = (...durations: number[]): Clip => {
  const clip = Clip.empty(new FakeTakes());
  for (const seconds of durations) clip.addTake(new Blob(['x']), seconds);
  return clip;
};

const storeOf = (stored: ClipSnapshot | null): KeptClipPort & { cleared: number } => {
  let cleared = 0;
  return {
    get cleared() { return cleared; },
    saveTake: async () => {},
    saveMeta: async () => {},
    saveClip: async () => {},
    load: async () => stored,
    clear: async () => { cleared++; },
  };
};

describe('RestoreClip', () => {
  it('rebuilds a stored clip', async () => {
    const saved = clipWith(2, 3);
    const clip = clipWith();
    const store = storeOf(saved.snapshot());
    const restore = new RestoreClip({ clip, store });

    const outcome = await restore.run();

    expect(outcome).toEqual({ kind: 'restored' });
    expect(clip.takes.count()).toBe(2);
    expect(clip.total()).toBe(5);
  });

  it('restores nothing when the store is empty', async () => {
    const clip = clipWith();
    const store = storeOf(null);
    const restore = new RestoreClip({ clip, store });

    const outcome = await restore.run();

    expect(outcome).toEqual({ kind: 'empty' });
    expect(clip.takes.isEmpty()).toBe(true);
  });

  it('drops a clip it cannot rebuild and says why', async () => {
    const clip = clipWith();
    const store = storeOf({ takes: [{ blob: new Blob(['x']), duration: 0 }], cuts: [] });
    const restore = new RestoreClip({ clip, store });

    const outcome = await restore.run();

    expect(outcome.kind).toBe('failed');
    expect(store.cleared).toBe(1);
    expect(clip.takes.isEmpty()).toBe(true);
  });

  it('announces nothing: a restore is a load, not a change', async () => {
    const saved = clipWith(2);
    const clip = clipWith();
    const store = storeOf(saved.snapshot());
    const restore = new RestoreClip({ clip, store });
    const seen: string[] = [];
    clip.onChange(event => seen.push(event.type));

    await restore.run();

    expect(seen).toEqual([]);
  });
});
