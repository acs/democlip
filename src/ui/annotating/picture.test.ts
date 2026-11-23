import { describe, expect, it } from 'vitest';

import { placePicture, placeWatermark, PLACED_WIDTH, WATERMARK, type PreparedPicture } from './picture.js';

// Where a picture lands, and how big: the one placement both a person's picker and an
// agent's clipboard go through, proved without a browser because it is arithmetic.

const WIDE = { w: 1280, h: 720 };   // 16:9, the recording
const prepared = (imageAspect: number): PreparedPicture => ({ blob: new Blob(['x']), imageAspect });

describe('placePicture', () => {
  it('places a square picture centred, at the default width, keeping its proportions', () => {
    const geometry = placePicture('picture-1', prepared(1), WIDE);

    expect(geometry.imageId).toBe('picture-1');
    expect(geometry.width).toBeCloseTo(PLACED_WIDTH);
    // The rect is in fractions of the *recording*, so a square picture on a 16:9
    // recording is a rectangle: its height is the width scaled by the two ratios.
    expect(geometry.height).toBeCloseTo((PLACED_WIDTH * (1280 / 720)) / 1);
    expect(geometry.x).toBeCloseTo((1 - geometry.width) / 2);
    expect(geometry.y).toBeCloseTo((1 - geometry.height) / 2);
    expect(geometry.imageAspect).toBe(1);
    expect(geometry.pictureAspect).toBeCloseTo(1280 / 720);
  });

  it('shrinks a tall picture to the recording\u2019s height rather than letting it overflow', () => {
    const geometry = placePicture('picture-2', prepared(0.25), WIDE);

    expect(geometry.height).toBeCloseTo(1);
    expect(geometry.width).toBeCloseTo((1 * 0.25) / (1280 / 720));
    expect(geometry.y).toBeCloseTo(0);
  });

  it('takes the corner and width it is given, and pulls a rect that would run off the edge inside', () => {
    const placed = placePicture('picture-3', prepared(1), WIDE, { x: 0.2, y: 0.3, width: 0.2 });
    expect(placed.x).toBeCloseTo(0.2);
    expect(placed.y).toBeCloseTo(0.3);
    expect(placed.width).toBeCloseTo(0.2);

    // A wider rect at that corner is taller than what is left below it, so the corner
    // moves up rather than the rect losing its proportions.
    const pulled = placePicture('picture-4', prepared(1), WIDE, { x: 0.9, y: 0.95, width: 0.5 });
    expect(pulled.width).toBeCloseTo(0.5);
    expect(pulled.x).toBeCloseTo(0.5);
    expect(pulled.y).toBeCloseTo(1 - pulled.height);
  });

  it('falls back to the default width for a width that is not a positive number', () => {
    for (const width of [0, -1, NaN, Infinity]) {
      const geometry = placePicture('picture-5', prepared(1), WIDE, { width });
      expect(geometry.width).toBeCloseTo(PLACED_WIDTH);
    }
  });
});

// The clip's watermark: a logo the app serves, placed small in the top-right corner, scaled
// and never stretched — the same arithmetic as a chosen picture, held to the corner.
describe('placeWatermark', () => {
  /** The drawn shape is the mark's own proportions, whatever rectangle it is put in. */
  const keepsProportions = (g: ReturnType<typeof placeWatermark>): number =>
    (g.width * g.pictureAspect) / (g.height * g.imageAspect);

  it('puts a wide mark small in the top-right corner, as wide as the row', () => {
    const g = placeWatermark('democlip', 3, WIDE);

    expect(g.logo).toBe('democlip');
    expect(g.imageId).toBe('');                         // a served logo, not bytes in the store
    expect(g.width).toBeCloseTo(WATERMARK.width);
    expect(g.y).toBeCloseTo(WATERMARK.margin);
    expect(g.x + g.width).toBeCloseTo(1 - WATERMARK.margin);
    expect(keepsProportions(g)).toBeCloseTo(1);
  });

  it('bounds a tall mark by height, so it does not run down the picture', () => {
    const g = placeWatermark('graditone', 748 / 1140, WIDE);

    expect(g.height).toBeCloseTo(WATERMARK.maxHeight);
    expect(g.x + g.width).toBeCloseTo(1 - WATERMARK.margin);
    expect(keepsProportions(g)).toBeCloseTo(1);
  });
});