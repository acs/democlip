# Phase 1 — Data Model: Move and Resize the Webcam Bubble

The feature adds one value object and one piece of view state. Nothing is persisted, and
the clip is not touched.

## WebcamBubble — the placement (value object, pure)

**File**: `src/domain/capture/WebcamBubble.ts`. **Test beside it**:
`src/domain/capture/WebcamBubble.test.ts`.

A circle over the recorded region: where the camera is drawn and how big. Immutable, like
`CropRegion` and `SourceSet` — every move or resize yields a new one.

### Fields (read-only)

| field | meaning | domain |
|---|---|---|
| `cx` | the circle's centre across the recorded region | fraction of the region's **width**, `0..1` |
| `cy` | the circle's centre down the recorded region | fraction of the region's **height**, `0..1` |
| `size` | the circle's **diameter** | fraction of the region's **shorter side**, `MIN_SIZE..MAX_SIZE` |

The diameter is one number because the shape is one shape: a circle. A resize changes
`size` and nothing else.

### Constants

| name | value | meaning |
|---|---|---|
| `MIN_SIZE` | `0.12` | the smallest diameter, so the bubble can never be dragged away |
| `MAX_SIZE` | `0.60` | the largest diameter, so it can never swallow the recording |
| (default diameter) | `0.28` | the mid-range size the app draws today |

### Validation rules (the invariant)

- Every coordinate is finite; `size` lies within `MIN_SIZE..MAX_SIZE`. `of` throws
  otherwise, as `CropRegion.of` does.
- **The circle is wholly inside the recorded region.** Given the region's size in pixels,
  the centre and the diameter are such that the whole circle lies between the region's
  edges. This is enforced whenever a placement is made from a gesture *and* whenever a
  placement is read against a region that may have changed size (`fitted`).

### Operations

Geometry is asked in **pixels of the rectangle the caller holds** — the preview's region
rectangle, or the recording canvas — so a fraction never leaves the object.

| operation | result | rule it carries |
|---|---|---|
| `WebcamBubble.of(cx, cy, size)` | a placement | validates finiteness and the size bounds |
| `WebcamBubble.default(width, height)` | the default placement for a region | the bottom-right corner at the default diameter (today's drawing) |
| `withCentre(cx, cy, width, height)` | a moved placement | clamps the centre so the circle stays inside |
| `withSize(size, width, height)` | a resized placement | clamps the diameter to `MIN_SIZE..MAX_SIZE` **and** to what still fits |
| `fitted(width, height)` | the placement for this region | returns `this`, clamped inside if the region changed size |
| `geometry(width, height)` | `{ cx, cy, r }` in pixels | the centre and radius the drawing uses |
| `contains(x, y, width, height, tolerance)` | `boolean` | whether a point in pixels is on the circle; `tolerance` grows it into the rim handle |
| `equals(other)` | `boolean` | value equality, as `CropRegion.equals` |

`width`/`height` are plain numbers — no browser, no DOM — so the whole class runs in node.

## The placement's home in the view (state with a lifetime)

**File**: `src/ui/recording/webcam.ts` (the module that already owns the webcam and draws
the bubble).

| piece | type | meaning | lifetime |
|---|---|---|---|
| `bubble` | `WebcamBubble \| null` | the sitting's placement; `null` means *no placement chosen yet*, so the default is drawn | the sitting — ends at New, cleared at a reload |
| the drag | `BubbleDrag` (a small class) | the gesture in flight: the point it began at, which kind it is (move or resize), and the placement it is proposing | the gesture — begun on `pointerdown`, ended on `pointerup`, cancelled at New |

### State transitions

```
no webcam, or no screen        →  nothing is drawn; a press on the canvas is a crop (or nothing)
webcam + screen, bubble null   →  the default is drawn (bottom-right corner)
pointerdown in the circle's middle →  a move drag begins (the default is materialised if null), keeping the point taken hold of
pointerdown on its edge (inside or out) →  a resize drag begins
pointermove                    →  the placement follows via withCentre / withSize (clamped)
pointerup                      →  the proposed placement is committed; the drag ends
session cleared (New)          →  bubble := null, drag cancelled  →  the default again
reload                         →  a fresh page  →  the default again
```

## Existing entities this feature reads (unchanged)

- **Crop region (`CropRegion`)** — the rectangle of the source being recorded; the region
  the bubble is placed inside. The preview hands the bubble its region rectangle; the
  recorder hands it the whole canvas (which *is* the crop).
- **Source set (`SourceSet`)** — decides whether a bubble exists at all: it exists only
  with `screen && webcam`.
- **Phase (`state.ts`)** — the placement gesture is available only in `live`; a drag during
  a take or in review changes nothing, the same guard the crop already uses.
- **The record use case (`RecordTake`)** and **the compositor** — unchanged; they still get
  the bubble's drawing injected, and that drawing now reads the placement.

## What is deliberately *not* modelled

- No persistence record, no snapshot field, no clip property. The placement is not kept,
  so there is nothing to write down.
- No second webcam track and no per-take placement: a take's bubble is its pixels.
