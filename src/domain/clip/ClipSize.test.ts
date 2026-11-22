import { describe, expect, it } from 'vitest';

import { ClipSize } from './ClipSize.js';

// The value object: the even rule, the largest rule and the fit. No browser, no clip.

describe('ClipSize', () => {
  it('rounds an odd edge up to the next even size', () => {
    expect(ClipSize.of(985, 611)?.toString()).toBe('986x612');
    expect(ClipSize.of(1280, 720)?.toString()).toBe('1280x720');
  });

  it('is null for a size that is not a positive whole picture', () => {
    expect(ClipSize.of(0, 100)).toBeNull();
    expect(ClipSize.of(100, 0)).toBeNull();
    expect(ClipSize.of(-2, 100)).toBeNull();
    expect(ClipSize.of(Number.NaN, 100)).toBeNull();
    expect(ClipSize.of(100, Number.POSITIVE_INFINITY)).toBeNull();
    expect(ClipSize.of(ClipSize.MAX_EDGE + 1, 100)).toBeNull();
  });

  it('is the largest width and the largest height among the pictures, rounded up', () => {
    expect(ClipSize.largest([{ width: 1280, height: 720 }, { width: 1920, height: 1080 }])?.toString())
      .toBe('1920x1080');
    // a portrait and a landscape take make the rectangle that holds both whole
    expect(ClipSize.largest([{ width: 1080, height: 1920 }, { width: 1920, height: 1080 }])?.toString())
      .toBe('1920x1920');
    expect(ClipSize.largest([{ width: 985, height: 611 }])?.toString()).toBe('986x612');
    expect(ClipSize.largest([])).toBeNull();
    expect(ClipSize.largest([null, undefined])).toBeNull();
  });

  it('fits a picture whole and centred, keeping its shape', () => {
    const size = ClipSize.of(1920, 1080)!;
    // the same shape fills it exactly
    expect(size.frameFor({ width: 1280, height: 720 })).toEqual({ x: 0, y: 0, width: 1920, height: 1080 });
    // a square is pillarboxed
    expect(size.frameFor({ width: 640, height: 640 })).toEqual({ x: 420, y: 0, width: 1080, height: 1080 });
    // a picture larger than the size is scaled down, not cropped
    expect(ClipSize.of(640, 360)!.frameFor({ width: 1280, height: 720 }))
      .toEqual({ x: 0, y: 0, width: 640, height: 360 });
  });

  it('is a value: two sizes with the same edges are equal', () => {
    expect(ClipSize.of(1920, 1080)?.equals(ClipSize.of(1920, 1080)!)).toBe(true);
    expect(ClipSize.of(1920, 1080)?.equals(ClipSize.of(1280, 720)!)).toBe(false);
  });
});
