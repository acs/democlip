import { describe, expect, it } from 'vitest';

import { estimateSoundText, estimateWebmText } from './size-estimate.js';

describe('estimateWebmText', () => {
  it('gives a range, because the size depends on how much moves', () => {
    expect(estimateWebmText(10)).toBe('~1.3–5.0 MB (WebM)');   // 1280x720 by default
  });

  it('follows the picture, so a big screen is not estimated as a small one', () => {
    expect(estimateWebmText(10, 3440, 1440)).toBe('~5.6–22.3 MB (WebM)');
  });

  it('says nothing was measured as nothing', () => {
    expect(estimateWebmText(0)).toBe('~0.0–0.0 MB (WebM)');
  });
});

describe('estimateSoundText', () => {
  it('sizes the audio a sound-only clip exports, with no picture in it', () => {
    expect(estimateSoundText(10)).toBe('~0.1–0.2 MB (audio)');
  });

  it('says nothing was measured as nothing', () => {
    expect(estimateSoundText(0)).toBe('~0.0–0.0 MB (audio)');
  });
});
