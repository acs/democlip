# Contract: Clip Size

The two seams the feature exposes: the `ClipSize` the app's own code calls, and the
clip property the panel and the agent surface both read.

## `ClipSize` (domain)

```ts
class ClipSize {
  static readonly MAX_EDGE: number;                       // 8192
  static of(width: number, height: number): ClipSize | null;
  static largest(pictures: readonly Picture[]): ClipSize | null;

  readonly width: number;                                 // even, ≥ 2
  readonly height: number;                                // even, ≥ 2

  toString(): string;                                     // "1920x1080"
  equals(other: ClipSize): boolean;
  frameFor(picture: Picture): { x: number; y: number; width: number; height: number };
}
```

- `of` rounds an odd edge up; returns `null` for a non-finite, non-positive, or
  beyond-`MAX_EDGE` edge.
- `largest` returns `null` only for an empty list, or one whose pictures have no usable
  size.
- `frameFor` never returns an empty rectangle for a positive `picture`; the rectangle
  is inside `0..width`/`0..height` and centred.

## The `size` clip property

Registered in `ui/clip/clip-properties.ts` like the title and the description, so the
panel, the agent surface and `introFor` all see it from the one register — but marked
**read-only**, because the size is derived from the takes and is not the person's.

| | |
|---|---|
| `id` | `size` |
| `label` | `Clip size` |
| `control` | `text` — the panel draws the value and offers no control, on `readOnly` |
| `readOnly` | `true` — the panel draws it as a value, and the surface refuses to set it |
| `value(properties, clip)` | the clip's size, `"WxH"`, derived from the takes; `""` when there are no takes |
| `with(properties, value)` | always `null`: there is no value that takes |

The descriptor's `value` takes the clip as an optional second argument, because the
derived size is the clip's answer and not in the `ClipProperties` map; a property that
needs only the map (title, description) ignores it. This is the one signature change,
and it is additive.

## The agent surface

`describeClip` reports every clip property with its value and whether it is the app's to
give: an agent reads `properties` and finds `size` with the current `"WxH"` and
`readOnly: true`. `setClipProperty('size', …)` is **refused**, with a reason, and the
size is unchanged — exactly as the panel offers no control.

No new tool, no new field, no new route.
