import { describe, expect, it } from 'vitest';

import { LOGO_ROW, LOGO_SPACE, logoRect } from './logo-rect.js';

// The rule: a mark is **scaled, never stretched**. The mistake this exists to catch is comparing
// a fraction of the picture's width with one of its height — two different lengths — and drawing
// the mark to fit that, which deforms it. So the proportions are asserted directly, for marks of
// every shape.

const LANDSCAPE = { width: 294, height: 216 };    // DemoClip's camera, 1.36:1
const PORTRAIT = { width: 748, height: 1140 };   // Graditone's clef, 0.66:1
const SQUARE = { width: 500, height: 500 };

describe('logoRect', () => {
  it('keeps the mark’s own proportions, whatever its shape or the picture’s', () => {
    for (const mark of [LANDSCAPE, PORTRAIT, SQUARE]) {
      for (const picture of [{ w: 1920, h: 1080 }, { w: 640, h: 360 }, { w: 1080, h: 1920 }, { w: 800, h: 800 }]) {
        const rect = logoRect(picture, mark);
        expect(rect.width / rect.height, `${mark.width}x${mark.height} on ${picture.w}x${picture.h}`)
          .toBeCloseTo(mark.width / mark.height, 5);
      }
    }
  });

  it('draws a mark as tall as the row, whatever its shape', () => {
    const picture = { w: 1920, h: 1080 };
    for (const mark of [LANDSCAPE, PORTRAIT, SQUARE]) {
      expect(logoRect(picture, mark).height).toBeCloseTo(LOGO_ROW.h * picture.h, 5);
    }
  });

  it('bounds a very wide mark by the picture instead, keeping its proportions', () => {
    const picture = { w: 1920, h: 1080 };
    const banner = { width: 1400, height: 100 };            // 14:1, wider than the row allows
    const rect = logoRect(picture, banner);
    expect(rect.width).toBeCloseTo(LOGO_ROW.maxW * picture.w, 5);
    expect(rect.height).toBeLessThan(LOGO_ROW.h * picture.h);
    expect(rect.width / rect.height).toBeCloseTo(14, 5);
  });

  it('never draws outside the picture, however wide the mark is', () => {
    for (const mark of [LANDSCAPE, PORTRAIT, SQUARE, { width: 5000, height: 100 }]) {
      const rect = logoRect({ w: 640, h: 360 }, mark);
      expect(rect.x).toBeGreaterThanOrEqual(0);
      expect(rect.x + rect.width).toBeLessThanOrEqual(640 + 0.001);
      expect(rect.y).toBeGreaterThanOrEqual(LOGO_ROW.y * 360 - 0.001);
      expect(rect.y + rect.height).toBeLessThanOrEqual((LOGO_ROW.y + LOGO_ROW.h) * 360 + 0.001);
    }
  });

  it('centres the mark across the picture', () => {
    const picture = { w: 1920, h: 1080 };
    for (const mark of [LANDSCAPE, PORTRAIT, SQUARE]) {
      const rect = logoRect(picture, mark);
      expect(rect.x + rect.width / 2).toBeCloseTo(picture.w / 2, 5);
    }
  });

  it('keeps the words clear of the whole row', () => {
    expect(LOGO_SPACE).toBeGreaterThan(LOGO_ROW.y + LOGO_ROW.h);
  });
});
