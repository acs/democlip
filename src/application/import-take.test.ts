import { describe, expect, it } from 'vitest';

import { ImportTake, type ImportOutcome } from './import-take.js';
import { Clip } from '../domain/clip/Clip.js';
import { Take } from '../domain/clip/Take.js';
import { Span } from '../domain/clip/Span.js';
import { AnnotationSidecar } from '../domain/clip/AnnotationSidecar.js';
import { Arrow } from '../domain/annotation/Arrow.js';
import type { Annotation } from '../domain/annotation/Annotation.js';
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
  const pictures: Array<{ id: string; blob: Blob }> = [];
  const run = new ImportTake({
    clip,
    files: files(info),
    pictures: {
      put: async (id, blob) => { pictures.push({ id, blob }); },
      all: async () => [],
    },
    setAudio: has => { if (has) audio.push(has); },
  });
  return { clip, run, audio, pictures };
};

/** A sidecar: arrows over the given fractions of a file of this length. */
const sidecarFor = (length: number, arrows: Array<[number, number]>): AnnotationSidecar =>
  AnnotationSidecar.of(
    length,
    arrows.map(([s, e], at) => {
      const made = Arrow.create(Span.of(s, e), { x: 0.1, y: 0.1 }, { x: 0.5, y: 0.5 }, `an-${at}`);
      if (!made) throw new Error('the test could not make an arrow');
      return made.stored();
    }),
  );

const placeOf = (annotation: Annotation): [number, number] =>
  [annotation.span.s, annotation.span.e];

/** The outcome, as an import — saying so loudly when the take did not arrive. */
function imported(outcome: ImportOutcome) {
  if (outcome.kind !== 'imported') throw new Error(`the take should have arrived, not been ${outcome.kind}`);
  return outcome;
}

describe('ImportTake', () => {
  it('appends the file as a take, with its own length', async () => {
    const { clip, run } = build({ duration: 12.5, hasAudio: false });

    const outcome = await run.run(file('clip.webm', 'video/webm'));

    expect(outcome.kind).toBe('imported');
    expect(clip.takes.count()).toBe(1);
    expect(clip.takes.at(0)?.duration).toBe(12.5);
  });

  it('takes a sound-only file in as a take with no picture', async () => {
    const { clip, run, audio } = build({ duration: 3, hasAudio: true });

    const outcome = await run.run(file('voice.webm', 'audio/webm'));

    expect(outcome.kind).toBe('imported');
    expect(clip.takes.at(0)?.picture).toBeNull();
    expect(clip.hasPicture()).toBe(false);
    expect(audio).toEqual([true]);
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

  it('places the annotations a sidecar carried over the stretch the file was given', async () => {
    const { clip, run } = build({ duration: 4, hasAudio: false });

    const outcome = await run.run(file('clip.webm', 'video/webm'), sidecarFor(4, [[0.25, 0.5]]));

    expect(imported(outcome).annotations).toEqual({ count: 1 });
    expect(clip.annotations.all.map(placeOf)).toEqual([[0.25, 0.5]]);
  });

  it('scales and moves them when the clip already held something', async () => {
    const { clip, run } = build({ duration: 4, hasAudio: false });
    clip.addTake(new Blob(['first']), 4);           // the clip is 4s, so the file lands at 4s

    await run.run(file('clip.webm', 'video/webm'), sidecarFor(4, [[0.25, 0.5]]));

    // A quarter to a half of the file, which is now the 4s..8s stretch of an 8s clip.
    expect(clip.annotations.all.map(placeOf)).toEqual([[0.625, 0.75]]);
  });

  it('adds them to what the clip already drew rather than in place of it', async () => {
    const { clip, run } = build({ duration: 4, hasAudio: false });
    const before = Arrow.create(Span.of(0.05, 0.1), { x: 0.1, y: 0.1 }, { x: 0.5, y: 0.5 }, 'an-old');
    clip.addAnnotation(before!);

    await run.run(file('clip.webm', 'video/webm'), sidecarFor(4, [[0.25, 0.5]]));

    expect(clip.annotations.all.map(annotation => annotation.span.s)).toEqual([0.05, 0.25]);
    expect(clip.annotations.all.map(annotation => annotation.id)).toContain('an-old');
  });

  it('brings them back as annotations of their own, even when the clip still holds the ones that left', async () => {
    const { clip, run } = build({ duration: 4, hasAudio: false });
    // Appending is what an import does, so the clip commonly still holds the arrow whose
    // id the sidecar carries. It comes back as a new annotation rather than not at all.
    const left = Arrow.create(Span.of(0.25, 0.5), { x: 0.1, y: 0.1 }, { x: 0.5, y: 0.5 }, 'an-0');
    clip.addAnnotation(left!);

    const outcome = await run.run(file('clip.webm', 'video/webm'), sidecarFor(4, [[0.25, 0.5]]));

    expect(imported(outcome).annotations).toEqual({ count: 1 });
    expect(clip.annotations.count).toBe(2);
    expect(new Set(clip.annotations.all.map(annotation => annotation.id)).size).toBe(2);
  });

  it('says why the annotations are not the clip\u2019s when the sidecar is another file\u2019s', async () => {
    const { clip, run } = build({ duration: 4, hasAudio: false });

    const outcome = await run.run(file('clip.webm', 'video/webm'), sidecarFor(12, [[0.25, 0.5]]));

    expect(imported(outcome).annotations?.count).toBe(0);
    expect(imported(outcome).annotations?.reason).toMatch(/12s/);
    expect(imported(outcome).annotations?.reason).toMatch(/4s/);
    expect(clip.annotations.isEmpty).toBe(true);
  });

  it('puts the pictures a sidecar carried back in the store, under their ids', async () => {
    const { run, pictures } = build({ duration: 4, hasAudio: false });
    const blob = new Blob(['picture'], { type: 'image/png' });

    await run.run(file('clip.webm', 'video/webm'), AnnotationSidecar.of(4, [], [{ id: 'im-1', blob }]));

    expect(pictures.map(drawn => drawn.id)).toEqual(['im-1']);
    expect(pictures[0].blob).toBe(blob);
  });
});
