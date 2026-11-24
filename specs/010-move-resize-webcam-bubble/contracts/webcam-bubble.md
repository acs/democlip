# Contracts: Move and Resize the Webcam Bubble

DemoClip is a browser app with no server, so its interfaces are the domain value object
the view asks and the interaction a person performs. Both are recorded here; neither adds
a network or storage contract.

## Contract 1 — `WebcamBubble`, the placement (domain value object)

The one place the circle's rules are stated. Pure: numbers in, numbers out, no DOM.

```ts
class WebcamBubble {
  static readonly MIN_SIZE: number;   // 0.12
  static readonly MAX_SIZE: number;   // 0.60

  /** The placement for a region, by its pixel size. */
  static default(width: number, height: number): WebcamBubble;

  /** Build one. Throws if a coordinate is not finite or the size is out of bounds. */
  static of(cx: number, cy: number, size: number): WebcamBubble;

  readonly cx: number;    // centre, fraction of the region's width
  readonly cy: number;    // centre, fraction of the region's height
  readonly size: number;  // diameter, fraction of the region's shorter side

  /** Move to a centre; clamped so the whole circle stays inside the region. */
  withCentre(cx: number, cy: number, width: number, height: number): WebcamBubble;

  /** Resize to a diameter; clamped to MIN_SIZE..MAX_SIZE and to what still fits. */
  withSize(size: number, width: number, height: number): WebcamBubble;

  /** This placement for a region that may have changed size: clamped inside. */
  fitted(width: number, height: number): WebcamBubble;

  /** The centre and radius in pixels of the rectangle the caller holds. */
  geometry(width: number, height: number): { cx: number; cy: number; r: number };

  /** Is a point (pixels) on the circle? `tolerance` grows it into the rim handle. */
  contains(x: number, y: number, width: number, height: number, tolerance?: number): boolean;

  equals(other: WebcamBubble): boolean;
}
```

**Guarantees**
- A placement the object hands back is always wholly inside the region it was asked
  against.
- `geometry` is the single source of the circle's centre and radius; the preview and the
  recorder both draw through it, so they cannot disagree.
- `of` refuses what the rules forbid, exactly as `CropRegion.of` refuses an empty region.

## Contract 2 — The interaction contract (what a person sees and does)

The bubble exists only with **screen + webcam** on, over the recorded region, always a
circle.

| gesture | where | result |
|---|---|---|
| drag the **middle** of the circle | live preview | the bubble moves, keeping the point the pointer took hold of, clamped inside the region |
| drag its **edge** — a little inside or outside the line | live preview | the bubble resizes; the drag's distance from its (fixed) centre decides the diameter, clamped to `MIN_SIZE..MAX_SIZE` |
| drag **anywhere else** | live preview | the crop, exactly as before — the bubble is not touched |
| press on the circle during a take or in review | — | nothing; the placement changes only in the live phase |

**What the person sees**
- The bubble in the default corner (bottom-right, default diameter) before they touch it.
- The bubble following the pointer while they drag it, and staying where they release it.
- A small **handle on the rim** while the preview is live, so the resize is discoverable;
  the handle is not drawn in the recording.
- On **New** and after a **reload**: the default corner, at the default diameter.

**What the recording holds**
- The recording draws the same placement through `drawWebcamOverlay` against the
  compositor canvas, so a take holds the bubble in the same place and at the same relative
  size the live preview showed — for the next take onward. A take already made is not
  changed.

## Contract 3 — The gesture router

`src/ui/recording/region.ts` keeps the canvas's three pointer handlers and decides, once
per press, which gesture it is:

- **bubble first** — a press on the circle (or its rim) is the bubble's move/resize; the
  crop does not begin.
- **otherwise the crop** — unchanged from today.

This is the only place the two gestures are told apart; nothing else may attach a
competing press handler to the preview canvas.
