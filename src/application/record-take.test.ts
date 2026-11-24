import { describe, expect, it } from 'vitest';

import { RecordTake } from './record-take.js';
import { Clip } from '../domain/clip/Clip.js';
import { Take } from '../domain/clip/Take.js';
import type { TakeRepository } from '../domain/clip/TakeRepository.js';
import type { Picture } from '../domain/clip/ClipSize.js';
import { SourceSet } from '../domain/capture/SourceSet.js';
import { CropRegion } from '../domain/capture/CropRegion.js';
import type { CapturePort, CaptureSession } from './ports/CapturePort.js';
import type { WebcamPort } from './ports/WebcamPort.js';
import type { MicrophonePort } from './ports/MicrophonePort.js';
import type { CompositorPort, CompositorInput, CompositorSession } from './ports/CompositorPort.js';
import type { TakeRecorderPort } from './ports/TakeRecorderPort.js';
import type { TakeProbePort } from './ports/TakeProbePort.js';
import type { ClockPort } from './ports/ClockPort.js';

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

// A stream with one track: enough for the use case's "something came from the sources"
// check, and all the fake ports need of it.
const stream = { getTracks: () => [{}] } as unknown as MediaStream;

const capture = (held: boolean): CapturePort => ({
  start: async () => ({ stream, hasAudio: false }) as CaptureSession,
  stop: () => {},
  current: () => (held ? { stream, hasAudio: false } : null),
  onEnded: () => () => {},
});

const webcam = (held: boolean): WebcamPort => ({
  start: async () => stream,
  stop: () => {},
  current: () => (held ? stream : null),
});

const microphone = (held: boolean): MicrophonePort => ({
  start: async () => stream,
  stop: () => {},
  current: () => (held ? stream : null),
});

const compositor = (): CompositorPort & { opened: CompositorInput[]; closed: number } => {
  const opened: CompositorInput[] = [];
  let closed = 0;
  return {
    opened,
    get closed() { return closed; },
    open(input: CompositorInput): CompositorSession {
      opened.push(input);
      return { stream, hasAudio: true };
    },
    close() { closed++; },
  };
};

const recorder = (): TakeRecorderPort & { started: MediaStream[] } => {
  const started: MediaStream[] = [];
  return {
    started,
    start(stream: MediaStream) { started.push(stream); },
    stop: async () => new Blob(['take']),
    isRecording: () => started.length > 0,
  };
};

const probe = (seconds: number, picture: { width: number; height: number } | null = null): TakeProbePort =>
  ({ measure: async () => ({ duration: seconds, picture }) });

const clock = (): ClockPort => ({ now: () => 1000, setTimeout: () => ({ cancel: () => {} }) });

const build = (options: {
  screen?: boolean;
  webcam?: boolean;
  mic?: boolean;
  duration?: number;
  picture?: { width: number; height: number };
} = {}) => {
  const clip = Clip.empty(new FakeTakes());
  const audio: boolean[] = [];
  const comp = compositor();
  const rec = recorder();
  const take = new RecordTake({
    clip,
    capture: capture(options.screen ?? true),
    webcam: webcam(options.webcam ?? false),
    mic: microphone(options.mic ?? false),
    compositor: comp,
    recorder: rec,
    probe: probe(options.duration ?? 2.5, options.picture ?? null),
    clock: clock(),
    sources: () => SourceSet.of(options.screen ?? true, options.webcam ?? false, options.mic ?? false),
    region: () => CropRegion.FULL,
    setAudio: hasAudio => audio.push(hasAudio),
  });
  return { clip, take, comp, rec, audio };
};

describe('RecordTake', () => {
  it('starts a take on the composed stream and reports it', () => {
    const { take, comp, rec, audio } = build({ screen: true });

    const outcome = take.start();

    expect(outcome).toEqual({ kind: 'started', stream });
    expect(comp.opened).toHaveLength(1);
    expect(rec.started).toEqual([stream]);
    expect(audio).toEqual([true]);
  });

  it('stops with the take added to the clip and its real length', async () => {
    const { clip, take, comp } = build({ screen: true, duration: 2.5 });
    take.start();

    const outcome = await take.stop();

    expect(outcome.kind).toBe('stopped');
    expect(clip.takes.count()).toBe(1);
    expect(clip.takes.at(0)?.duration).toBe(2.5);
    expect(comp.closed).toBe(1);
  });

  it("keeps the size of the take's picture, so the clip can size itself by it", async () => {
    const { clip, take } = build({ screen: true, duration: 2.5, picture: { width: 1920, height: 1080 } });
    take.start();

    await take.stop();

    expect(clip.takes.at(0)?.picture).toEqual({ width: 1920, height: 1080 });
  });

  it('falls back to the wall clock when the blob will not say how long it is', async () => {
    // A blob the browser will not measure comes back as 0, and a take cannot be built
    // without a length — the take must not be lost over it.
    const { clip, take } = build({ screen: true, duration: 0 });
    take.start();

    await take.stop();

    expect(clip.takes.count()).toBe(1);
    expect(clip.takes.at(0)?.duration).toBeCloseTo(0.1);   // the clock stands still, so the floor
  });

  it('refuses a take with no source at all, and says why', () => {
    const { take, comp, rec } = build({ screen: false, webcam: false, mic: false });

    const outcome = take.start();

    expect(outcome.kind).toBe('refused');
    if (outcome.kind === 'refused') expect(outcome.reason).toMatch(/source/i);
    expect(comp.opened).toHaveLength(0);
    expect(rec.started).toHaveLength(0);
  });

  it('starts when only the webcam is on', () => {
    const { take } = build({ screen: false, webcam: true });
    expect(take.start().kind).toBe('started');
  });

  it('starts on the microphone alone, and asks the compositor for no picture', () => {
    const { take, comp, audio } = build({ screen: false, webcam: false, mic: true });

    const outcome = take.start();

    expect(outcome.kind).toBe('started');
    expect(comp.opened).toHaveLength(1);
    expect(comp.opened[0].screen).toBeNull();
    expect(comp.opened[0].webcam).toBeNull();
    expect(comp.opened[0].mic).toBe(stream);
    // Nothing to crop, no first frame to take, and no bubble to draw: there is no picture.
    expect(comp.opened[0].picture).toBeUndefined();
    expect(comp.opened[0].pictureElement).toBeUndefined();
    expect(comp.opened[0].drawBubble).toBeUndefined();
    expect(audio).toEqual([true]);
  });

  it('refuses to record when the sources hand back an empty stream', () => {
    const clip = Clip.empty(new FakeTakes());
    const comp: CompositorPort = {
      open: () => ({ stream: { getTracks: () => [] } as unknown as MediaStream, hasAudio: false }),
      close: () => {},
    };
    const take = new RecordTake({
      clip,
      capture: capture(true),
      webcam: webcam(false),
      mic: microphone(true),
      compositor: comp,
      recorder: recorder(),
      probe: probe(1),
      clock: clock(),
      sources: () => SourceSet.of(false, false, true),
      region: () => CropRegion.FULL,
    });

    const outcome = take.start();

    expect(outcome.kind).toBe('refused');
    if (outcome.kind === 'refused') expect(outcome.reason).toMatch(/nothing came/i);
    expect(clip.takes.isEmpty()).toBe(true);
  });

  it('composes the held sources with the region the view set', () => {
    const { take, comp } = build({ screen: true, webcam: true });
    take.start();

    expect(comp.opened[0].screen).toBe(stream);
    expect(comp.opened[0].webcam).toBe(stream);
    expect(comp.opened[0].region).toBe(CropRegion.FULL);
  });
});
