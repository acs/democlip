import { describe, expect, it } from 'vitest';

import { KeepClip } from './keep-clip.js';
import { Clip } from '../domain/clip/Clip.js';
import { Take } from '../domain/clip/Take.js';
import { Span } from '../domain/clip/Span.js';
import type { TakeRepository } from '../domain/clip/TakeRepository.js';
import type { KeptClipPort } from './ports/KeptClipPort.js';
import type { ClockPort } from './ports/ClockPort.js';

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

interface Call { kind: 'take' | 'meta' | 'clip' | 'clear'; index?: number }

const store = (): KeptClipPort & { calls: Call[] } => {
  const calls: Call[] = [];
  return {
    calls,
    saveTake: async (_clip, index) => { calls.push({ kind: 'take', index }); },
    saveMeta: async () => { calls.push({ kind: 'meta' }); },
    saveClip: async () => { calls.push({ kind: 'clip' }); },
    load: async () => null,
    clear: async () => { calls.push({ kind: 'clear' }); },
  };
};

const clock = (): ClockPort & { flush: () => void } => {
  const pending: Array<() => void> = [];
  return {
    now: () => 0,
    setTimeout: callback => {
      pending.push(callback);
      return { cancel: () => { const at = pending.indexOf(callback); if (at >= 0) pending.splice(at, 1); } };
    },
    flush: () => { for (const callback of pending.splice(0)) callback(); },
  };
};

const clipWith = (...durations: number[]): Clip => {
  const clip = Clip.empty(new FakeTakes());
  for (const seconds of durations) clip.addTake(new Blob(['x']), seconds);
  return clip;
};

const build = (clip: Clip) => {
  const kept = store();
  const time = clock();
  const keep = new KeepClip({
    clip,
    store: kept,
    clock: time,
  });
  keep.watch();
  return { keep, kept, time };
};

describe('KeepClip', () => {
  it('saves a take as it arrives, at once', async () => {
    const clip = clipWith();
    const { kept } = build(clip);

    clip.addTake(new Blob(['x']), 2);
    await Promise.resolve();

    expect(kept.calls).toEqual([{ kind: 'take', index: 0 }]);
  });

  it('puts the metadata write off a moment, so a drag is one write', async () => {
    const clip = clipWith(2);
    const { kept, time } = build(clip);

    clip.approve(Span.of(0.2, 0.4));
    expect(kept.calls).toEqual([]);

    time.flush();
    await Promise.resolve();

    expect(kept.calls).toEqual([{ kind: 'meta' }]);
  });

  it('saves the whole clip before a sign-in, and waits for it', async () => {
    const clip = clipWith(2);
    const { keep, kept } = build(clip);

    const outcome = await keep.persist();

    expect(outcome).toEqual({ kind: 'saved' });
    expect(kept.calls).toEqual([{ kind: 'clip' }]);
  });

  it('skips the sign-in write when there is nothing to keep', async () => {
    const { keep, kept } = build(clipWith());

    const outcome = await keep.persist();

    expect(outcome).toEqual({ kind: 'skipped' });
    expect(kept.calls).toEqual([]);
  });

  it('lets the kept copy go when the clip is cleared', async () => {
    const clip = clipWith(2);
    const { kept } = build(clip);

    clip.clear();
    await Promise.resolve();

    expect(kept.calls).toEqual([{ kind: 'clear' }]);
  });

  it('reports a failed write as a value, not a throw', async () => {
    const clip = clipWith(2);
    const kept: KeptClipPort = {
      saveTake: async () => {},
      saveMeta: async () => {},
      saveClip: async () => { throw new Error('the store is full'); },
      load: async () => null,
      clear: async () => {},
    };
    const keep = new KeepClip({ clip, store: kept, clock: clock() });

    const outcome = await keep.persist();

    expect(outcome.kind).toBe('failed');
    if (outcome.kind === 'failed') expect(outcome.reason).toMatch(/full/);
  });
});
