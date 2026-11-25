import { describe, expect, it } from 'vitest';

import { estimatePictureText, estimateSoundText } from './size-estimate.js';

describe('estimatePictureText', () => {
  it('is what the encoder aims for at that size — one bare figure, no label or container', () => {
    expect(estimatePictureText(10)).toBe('4.1MB');   // 1280x720 by default
  });

  it('follows the picture, so a big screen is not estimated as a small one', () => {
    expect(estimatePictureText(10, 3440, 1440)).toBe('22.3MB');
  });

  it('follows the export resolution, so a smaller one reads as a smaller file', () => {
    // The same clip at 1920x1080 and at 854x480, the two levels a person chooses between.
    expect(estimatePictureText(10, 1920, 1080)).toBe('9.3MB');
    expect(estimatePictureText(10, 854, 480)).toBe('1.8MB');
  });

  it('says nothing was measured as nothing', () => {
    expect(estimatePictureText(0)).toBe('0.0MB');
  });
});

describe('estimateSoundText', () => {
  it('sizes the audio a sound-only clip exports, with no picture in it', () => {
    expect(estimateSoundText(10)).toBe('0.2MB');
  });

  it('says nothing was measured as nothing', () => {
    expect(estimateSoundText(0)).toBe('0.0MB');
  });
});
