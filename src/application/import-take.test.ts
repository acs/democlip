import { describe, expect, it } from 'vitest';

import { ImportTake } from './import-take.js';
import { Clip } from '../domain/clip/Clip.js';
import { Take } from '../domain/clip/Take.js';
import type { TakeRepository } from '../domain/clip/TakeRepository.js';
import type { TakeFileInfo, TakeFilePort } from './ports/TakeFilePort.js';

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

const file = (name: string, type: string): { name: string; type: string; blob: Blob } =>
  ({ name, type, blob: new Blob(['bytes'], { type }) });

const files = (info: TakeFileInfo | Error): TakeFilePort => ({
  inspect: async () => {
    if (info instanceof Error) throw info;
    return info;
  },
});

const build = (info: TakeFileInfo | Error) => {
  const clip = Clip.empty(new FakeTakes());
  const audio: boolean[] = [];
  const run = new ImportTake({
    clip,
    files: files(info),
    setAudio: has => { if (has) audio.push(has); },
  });
  return { clip, run, audio };
};

describe('ImportTake', () => {
  it('appends the file as a take, with its own length', async () => {
    const { clip, run } = build({ duration: 12.5, hasAudio: false });

    const outcome = await run.run(file('clip.webm', 'video/webm'));

    expect(outcome.kind).toBe('imported');
    expect(clip.takes.count()).toBe(1);
    expect(clip.takes.at(0)?.duration).toBe(12.5);
  });

  it('tells the session the file has sound before the take is added', async () => {
    const { clip, run, audio } = build({ duration: 3, hasAudio: true });
    let seenAtAdd = 0;
    clip.onChange(event => { if (event.type === 'take-added') seenAtAdd = audio.length; });

    await run.run(file('clip.mp4', 'video/mp4'));

    expect(audio).toEqual([true]);
    expect(seenAtAdd).toBe(1);        // said before the take was announced
  });

  it('says nothing when the file has no sound', async () => {
    const { run, audio } = build({ duration: 3, hasAudio: false });
    await run.run(file('clip.webm', 'video/webm'));
    expect(audio).toEqual([]);
  });

  it('refuses a container the export cannot read back', async () => {
    const { clip, run } = build({ duration: 3, hasAudio: false });

    const outcome = await run.run(file('clip.mov', 'video/quicktime'));

    expect(outcome.kind).toBe('refused');
    if (outcome.kind === 'refused') expect(outcome.reason).toMatch(/WebM and MP4/i);
    expect(clip.takes.isEmpty()).toBe(true);
  });

  it('refuses a file that cannot be read as a video', async () => {
    const { clip, run } = build(new Error('not a video'));

    const outcome = await run.run(file('clip.webm', 'video/webm'));

    expect(outcome.kind).toBe('failed');
    expect(clip.takes.isEmpty()).toBe(true);
  });

  it('refuses a video with no length', async () => {
    const { clip, run } = build({ duration: 0, hasAudio: false });

    const outcome = await run.run(file('clip.webm', 'video/webm'));

    expect(outcome.kind).toBe('refused');
    if (outcome.kind === 'refused') expect(outcome.reason).toMatch(/length/i);
    expect(clip.takes.isEmpty()).toBe(true);
  });
});
