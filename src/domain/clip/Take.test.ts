import { describe, expect, it } from 'vitest';

import { Take } from './Take.js';

describe('Take', () => {
  const blob = new Blob(['x']);

  it('is a recording with a length, a blob and a way to play it', () => {
    const take = Take.of(3, blob, 'blob:one', 4.5);
    expect(take.id).toBe(3);
    expect(take.duration).toBe(4.5);
    expect(take.blob).toBe(blob);
    expect(take.url).toBe('blob:one');
  });

  it('refuses a length that would make the joined timeline wrong', () => {
    expect(() => Take.of(1, blob, 'blob:one', 0)).toThrow(/length/);
    expect(() => Take.of(1, blob, 'blob:one', -1)).toThrow(/length/);
  });

  it('keeps the size of its own picture when it is handed one', () => {
    const take = Take.of(1, blob, 'blob:one', 1, { width: 1920, height: 1080 });
    expect(take.picture).toEqual({ width: 1920, height: 1080 });
  });

  it('is a take whose picture is not measured yet when none is given', () => {
    expect(Take.of(1, blob, 'blob:one', 1).picture).toBeNull();
  });

  it('keeps whether it carries sound, and is silent unless it is told', () => {
    expect(Take.of(1, blob, 'blob:one', 1).hasAudio).toBe(false);
    expect(Take.of(1, blob, 'blob:one', 1, null, true).hasAudio).toBe(true);
    expect(Take.of(1, blob, 'blob:one', 1, { width: 640, height: 360 }, true).hasAudio).toBe(true);
  });

  it('refuses a picture with no size', () => {
    expect(() => Take.of(1, blob, 'blob:one', 1, { width: 0, height: 720 })).toThrow(/picture/);
  });

  it('is the same take only when it is the same recording', () => {
    expect(Take.of(2, blob, 'a', 1).equals(Take.of(2, new Blob(['y']), 'b', 9))).toBe(true);
    expect(Take.of(2, blob, 'a', 1).equals(Take.of(3, blob, 'a', 1))).toBe(false);
  });
});
