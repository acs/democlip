import { describe, expect, it } from 'vitest';

import { firstPresentedSample, type SampleSink } from './first-sample.js';

// The rule a card's first frame rests on: a file's first moment cannot always be named,
// and the frame is still there.

/** A sink over a fixed list of samples; `found` is what `getSample` answers. */
const sinkOf = (samples: number[], found: Record<number, number> = {}): SampleSink<number> => ({
  getSample: async timestamp => found[timestamp] ?? null,
  samples: async function* () { yield* samples; },
});

describe('firstPresentedSample', () => {
  it('answers with the sample at the moment when the moment can be named', async () => {
    expect(await firstPresentedSample(sinkOf([1, 2, 3], { 2: 2 }), 2)).toBe(2);
  });

  it('falls back to the file\u2019s first sample when the moment cannot be named', async () => {
    // An MP4 whose first timestamp is negative (an edit list): the very first frame is
    // still the one a card has to draw.
    const sink = sinkOf([7, 8, 9]);
    expect(await firstPresentedSample(sink, -0.021333333333333333)).toBe(7);
  });

  it('answers null only when the file has no sample at all', async () => {
    expect(await firstPresentedSample(sinkOf([]), 0)).toBeNull();
  });
});
