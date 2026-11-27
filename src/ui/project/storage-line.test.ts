import { describe, expect, it } from 'vitest';

import { formatBytes, storageLine } from './storage-line.js';

describe('formatBytes', () => {
  it('follows the size, so the unit is the one that reads', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(500_000)).toBe('500 kB');
    expect(formatBytes(120_000_000)).toBe('120 MB');
    expect(formatBytes(2_000_000_000)).toBe('2 GB');
  });

  it('keeps a decimal only where the figure is small enough for it to mean something', () => {
    expect(formatBytes(1_500_000_000)).toBe('1.5 GB');
    expect(formatBytes(4_100_000)).toBe('4.1 MB');
  });

  it('drops a trailing zero, so two gigabytes does not read as 2.0 GB', () => {
    expect(formatBytes(1_000_000)).toBe('1 MB');
    expect(formatBytes(1_000_000_000)).toBe('1 GB');
  });

  it('reads a negative count as nothing', () => {
    expect(formatBytes(-5)).toBe('0 B');
  });
});

describe('storageLine', () => {
  it('says nothing when the browser gave no reading', () => {
    expect(storageLine(null)).toBeNull();
  });

  it('reads the two byte counts a person sees', () => {
    expect(storageLine({ usage: 120_000_000, quota: 2_000_000_000 })).toEqual({
      used: '120 MB',
      total: '2 GB',
    });
  });
});
