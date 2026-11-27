import { describe, expect, it } from 'vitest';

import { KeepClip } from './keep-clip.js';
import { Clip } from '../domain/clip/Clip.js';
import { ClipProfile } from '../domain/clip/ClipProfile.js';
import { Take } from '../domain/clip/Take.js';
import { Span } from '../domain/clip/Span.js';
import type { TakeRepository } from '../domain/clip/TakeRepository.js';
import type { RecordingPlace, RecordingStorePort } from './ports/RecordingStorePort.js';
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

interface Call { kind: 'take' | 'meta' | 'all'; id?: string; index?: number }
const place: RecordingPlace = { projectId: 'p1', profile: ClipProfile.DEFAULT.stored(), createdAt: 42 };

const store = () => {
  const calls: Call[] = [];
  const port = {
    calls,
    saveTake: async (id: string, _clip: Clip, index: number) => { calls.push({ kind: 'take', id, index }); },
    saveMeta: async (id: string) => { calls.push({ kind: 'meta', id }); },
    saveAll: async (id: string) => { calls.push({ kind: 'all', id }); },
    load: async () => null,
    list: async () => [],
    delete: async () => {},
    setProject: async () => {},
    open: async () => null,
    setOpen: async () => {},
    clearOpen: async () => {},
    readLegacy: async () => null,
    adopt: async () => {},
    clearLegacy: async () => {},
  } as RecordingStorePort & { calls: Call[] };
  return port;
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

const build = (clip: Clip, open = true) => {
  const kept = store();
  const time = clock();
  let target: { recordingId: string; place: RecordingPlace } | null = open
    ? { recordingId: 'r1', place }
    : null;
  const keep = new KeepClip({
    clip,
    store: kept,
    clock: time,
    place: () => target,
  });
  keep.watch();
  return { keep, kept, time, close: () => { target = null; } };
};

describe('KeepClip', () => {
  it('saves a take as it arrives, at once, under the open recording', async () => {
    const clip = clipWith();
    const { kept } = build(clip);

    clip.addTake(new Blob(['x']), 2);
    await Promise.resolve();

    expect(kept.calls).toEqual([{ kind: 'take', id: 'r1', index: 0 }]);
  });

  it('writes the small half after a pause, not on every cut', async () => {
    const clip = clipWith(10);
    const { kept, time } = build(clip);

    clip.approve(Span.of(0.1, 0.2));
    clip.approve(Span.of(0.3, 0.4));
    expect(kept.calls).toEqual([]);

    time.flush();
    await Promise.resolve();

    expect(kept.calls).toEqual([{ kind: 'meta', id: 'r1' }]);
  });

  it('has nowhere to write when no recording is open', async () => {
    const clip = clipWith();
    const { kept, time } = build(clip, false);

    clip.addTake(new Blob(['x']), 2);
    clip.approve(Span.of(0.1, 0.2));
    time.flush();
    await Promise.resolve();

    expect(kept.calls).toEqual([]);
  });

  it('does not write the small half for a profile chosen on an empty draft', async () => {
    const clip = clipWith();
    const { kept, time } = build(clip);

    clip.chooseProfile(ClipProfile.create('tv', 'TV', { logo: 'democlip' })!);
    time.flush();
    await Promise.resolve();

    expect(kept.calls).toEqual([]);
  });

  it('cancels a pending write when the session ends', async () => {
    const clip = clipWith(10);
    const { kept, time } = build(clip);

    clip.approve(Span.of(0.1, 0.2));
    clip.clear();
    time.flush();
    await Promise.resolve();

    expect(kept.calls).toEqual([]);
  });

  it('writes the whole recording when a sign-in waits on it', async () => {
    const clip = clipWith(2);
    const { keep, kept } = build(clip);

    expect(await keep.persist()).toEqual({ kind: 'saved' });
    expect(kept.calls).toEqual([{ kind: 'all', id: 'r1' }]);
  });

  it('skips a persist with no recording open, and with nothing to keep', async () => {
    const empty = build(clipWith());
    expect(await empty.keep.persist()).toEqual({ kind: 'skipped' });

    const closed = build(clipWith(2), false);
    expect(await closed.keep.persist()).toEqual({ kind: 'skipped' });
  });

  it('answers with the reason when the store refuses, the quota by name', async () => {
    const clip = clipWith(2);
    const kept = store();
    kept.saveAll = async () => { throw Object.assign(new Error('no room'), { name: 'QuotaExceededError' }); };
    const keep = new KeepClip({ clip, store: kept, clock: clock(), place: () => ({ recordingId: 'r1', place }) });

    expect(await keep.persist()).toEqual({
      kind: 'failed',
      reason: 'the browser has no room left for the recording',
    });
  });
});