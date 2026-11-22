import { describe, expect, it } from 'vitest';

import { ExportVideo } from './export-video.js';
import { Clip } from '../domain/clip/Clip.js';
import { Take } from '../domain/clip/Take.js';
import { IntroCard } from '../domain/clip/IntroCard.js';
import type { TakeRepository } from '../domain/clip/TakeRepository.js';
import type { EncoderPort, EncodeOptions, ExportStats, FrameRendererPort } from './ports/EncoderPort.js';
import type { ExportPlan } from '../domain/clip/ExportPlan.js';
import type { DownloadPort } from './ports/DownloadPort.js';
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

const clipOf = (...durations: number[]): Clip => {
  const clip = Clip.empty(new FakeTakes());
  for (const seconds of durations) clip.addTake(new Blob(['x']), seconds);
  return clip;
};

const renderer: FrameRendererPort = {
  draw: () => {},
  preview: () => {},
  hold: () => {},
  dissolve: () => null,
};

const stats: ExportStats = { bytes: 2048, seconds: 2, frames: 60, realtime: 10 };

const encoder = (options: { available?: boolean; fail?: boolean; fits?: boolean } = {}) => {
  let encoded = 0;
  let last: EncodeOptions | undefined;
  let plan: ExportPlan | undefined;
  const port: EncoderPort = {
    available: () => options.available ?? true,
    fitsBudget: () => options.fits ?? true,
    encode: async (thePlan: ExportPlan, _renderer: FrameRendererPort, encodeOptions: EncodeOptions) => {
      plan = thePlan;
      last = encodeOptions;
      encoded++;
      if (options.fail) throw new Error('the encoder broke');
      return { blob: new Blob(['encoded']), stats };
    },
  };
  return { port, get encoded() { return encoded; }, get last() { return last; }, get plan() { return plan; } };
};

const downloads = (): DownloadPort & { saved: string[] } => {
  const saved: string[] = [];
  return { saved, save: (_blob, filename) => { saved.push(filename); } };
};

const clock: ClockPort = { now: () => 1234, setTimeout: () => ({ cancel: () => {} }) };

const build = (
  clip: Clip,
  options: { available?: boolean; fail?: boolean; fits?: boolean; picture?: { width: number; height: number } } = {},
) => {
  const enc = encoder(options);
  const dl = downloads();
  const useCase = new ExportVideo({
    clip,
    encoder: enc.port,
    renderer,
    download: dl,
    clock,
    audio: () => false,
    fadeSeconds: 0.25,
    picture: () => options.picture ?? { width: 1280, height: 720 },
  });
  return { useCase, enc, dl };
};

describe('ExportVideo', () => {
  it('encodes the plan and hands the file over', async () => {
    const { useCase, enc, dl } = build(clipOf(2));

    const outcome = await useCase.run('webm');

    expect(outcome.kind).toBe('exported');
    if (outcome.kind === 'exported') {
      expect(outcome.blob).toBeInstanceOf(Blob);
      expect(outcome.stats).toEqual(stats);
    }
    expect(enc.encoded).toBe(1);
    expect(dl.saved).toEqual(['democlip-1234.webm']);
  });

  it('refuses when the browser cannot encode here', async () => {
    const { useCase, enc, dl } = build(clipOf(2), { available: false });

    const outcome = await useCase.run('webm');

    expect(outcome.kind).toBe('refused');
    expect(enc.encoded).toBe(0);
    expect(dl.saved).toEqual([]);
  });

  it('refuses when there is nothing to export', async () => {
    const { useCase } = build(clipOf());

    const outcome = await useCase.run('webm');

    expect(outcome.kind).toBe('refused');
  });

  it('reports a failure without throwing', async () => {
    const { useCase, dl } = build(clipOf(2), { fail: true });

    const outcome = await useCase.run('mp4');

    expect(outcome.kind).toBe('failed');
    if (outcome.kind === 'failed') expect(outcome.reason).toMatch(/broke/);
    expect(dl.saved).toEqual([]);
  });

  it('takes the export size from the picture, not the encoder’s 1280×720 default', async () => {
    const { useCase, enc } = build(clipOf(2), { picture: { width: 854, height: 480 } });

    await useCase.run('webm');

    expect(enc.last?.width).toBe(854);
    expect(enc.last?.height).toBe(480);
  });

  it('carries a byte budget into the encode', async () => {
    const { useCase, enc } = build(clipOf(2));

    await useCase.run('mp4', { maxBytes: 5_000_000 });

    expect(enc.last?.maxBytes).toBe(5_000_000);
  });

  it('puts a title card at the head of the plan when the caller asks for one', async () => {
    const intro = IntroCard.of('A demo', 'What it shows', new Date(2026, 0, 2, 12), 3)!;
    const { useCase, enc } = build(clipOf(2));

    await useCase.run('webm', { intro });

    expect(enc.plan?.intro).toBe(intro);
    expect(enc.plan?.introSeconds).toBe(3);
  });

  it('has no title card when the caller asks for none', async () => {
    const { useCase, enc } = build(clipOf(2));

    await useCase.run('webm');

    expect(enc.plan?.intro).toBeNull();
    expect(enc.plan?.introSeconds).toBe(0);
  });

  it('refuses, and writes nothing, when the budget cannot be met', async () => {
    const { useCase, enc, dl } = build(clipOf(2), { fits: false });

    const outcome = await useCase.run('mp4', { maxBytes: 1_000_000 });

    expect(outcome.kind).toBe('refused');
    if (outcome.kind === 'refused') expect(outcome.reason).toMatch(/too long/);
    expect(enc.encoded).toBe(0);
    expect(dl.saved).toEqual([]);
  });

  it('does not ask about a budget when the caller gave none', async () => {
    const { useCase, enc } = build(clipOf(2), { fits: false });

    const outcome = await useCase.run('webm');

    expect(outcome.kind).toBe('exported');
    expect(enc.encoded).toBe(1);
  });
});
