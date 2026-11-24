import { describe, expect, it } from 'vitest';
import { WebcamBubble } from './WebcamBubble.js';

/** Is the whole circle inside the region of this size? */
function inside(bubble: WebcamBubble, width: number, height: number): boolean {
  const { cx, cy, r } = bubble.geometry(width, height);
  const eps = 1e-9;
  return cx - r >= -eps && cy - r >= -eps && cx + r <= width + eps && cy + r <= height + eps;
}

describe('WebcamBubble', () => {
  it('refuses a non-finite coordinate', () => {
    expect(() => WebcamBubble.of(Number.NaN, 0.5, 0.3)).toThrow('finite');
    expect(() => WebcamBubble.of(0.5, Number.POSITIVE_INFINITY, 0.3)).toThrow('finite');
  });

  it('refuses a diameter outside the bounds', () => {
    expect(() => WebcamBubble.of(0.5, 0.5, WebcamBubble.MIN_SIZE - 0.01)).toThrow('shorter side');
    expect(() => WebcamBubble.of(0.5, 0.5, WebcamBubble.MAX_SIZE + 0.01)).toThrow('shorter side');
  });

  it('draws the default in the bottom-right of any region, wholly inside it', () => {
    for (const [width, height] of [[1280, 720], [720, 1280], [1000, 1000]]) {
      const bubble = WebcamBubble.default(width, height);
      const { cx, cy, r } = bubble.geometry(width, height);
      expect(cx).toBeGreaterThan(width / 2);
      expect(cy).toBeGreaterThan(height / 2);
      expect(r).toBeCloseTo(WebcamBubble.DEFAULT_SIZE * Math.min(width, height) / 2, 6);
      expect(inside(bubble, width, height)).toBe(true);
    }
  });

  it('keeps the whole circle inside when moved past an edge', () => {
    const { width, height } = { width: 1280, height: 720 };
    const far = WebcamBubble.default(width, height).withCentre(2, 2, width, height);
    const near = WebcamBubble.default(width, height).withCentre(-1, -1, width, height);
    expect(inside(far, width, height)).toBe(true);
    expect(inside(near, width, height)).toBe(true);
    const { cx, cy, r } = far.geometry(width, height);
    expect(cx + r).toBeCloseTo(width, 6);
    expect(cy + r).toBeCloseTo(height, 6);
  });

  it('clamps the diameter to the bounds and re-centres to fit', () => {
    const { width, height } = { width: 1280, height: 720 };
    expect(WebcamBubble.default(width, height).withSize(0, width, height).size).toBe(WebcamBubble.MIN_SIZE);
    expect(WebcamBubble.default(width, height).withSize(5, width, height).size).toBe(WebcamBubble.MAX_SIZE);
    // A bigger circle keeps its centre but stays inside the region.
    const grown = WebcamBubble.default(width, height).withSize(WebcamBubble.MAX_SIZE, width, height);
    expect(inside(grown, width, height)).toBe(true);
  });

  it('fits an old placement into a region that changed size', () => {
    const placed = WebcamBubble.default(4000, 3000).withCentre(0.99, 0.99, 4000, 3000);
    const fitted = placed.fitted(400, 300);
    expect(inside(fitted, 400, 300)).toBe(true);
    expect(fitted.size).toBe(placed.size);
  });

  it('tells a point on the circle from one beside it', () => {
    const { width, height } = { width: 1280, height: 720 };
    const bubble = WebcamBubble.default(width, height);
    const { cx, cy, r } = bubble.geometry(width, height);
    expect(bubble.contains(cx, cy, width, height)).toBe(true);
    expect(bubble.contains(cx + r + 1, cy, width, height)).toBe(false);
    expect(bubble.contains(cx + r + 1, cy, width, height, 5)).toBe(true);
    expect(bubble.contains(cx - r - 100, cy, width, height, 5)).toBe(false);
  });

  it('compares by value', () => {
    expect(WebcamBubble.of(0.5, 0.5, 0.3).equals(WebcamBubble.of(0.5, 0.5, 0.3))).toBe(true);
    expect(WebcamBubble.of(0.5, 0.5, 0.3).equals(WebcamBubble.of(0.5, 0.5, 0.4))).toBe(false);
  });
});
