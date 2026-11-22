# Contract: Clip Size

The two seams the feature exposes: the `ClipSize` the app's own code calls, and the
clip property the panel and the agent surface both read.

## `ClipSize` (domain)

```ts
class ClipSize {
  static readonly MAX_EDGE: number;                       // 8192
  static of(width: number, height: number): ClipSize | null;
  static parse(text: string): ClipSize | null;
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
- `parse` accepts `"WxH"` and `"W×H"`, ignores surrounding space; `null` otherwise.
- `largest` returns `null` only for an empty list.
- `frameFor` never returns an empty rectangle for a positive `picture`; the rectangle
  is inside `0..width`/`0..height` and centred.

## The `size` clip property

Registered in `ui/clip/clip-properties.ts` like the title and the description, so the
panel, the agent surface and `introFor` all see it from the one register.

| | |
|---|---|
| `id` | `size` |
| `label` | `Clip size` |
| `control` | `size` (new) — the panel draws two number fields, `width` and `height` |
| `value(properties, clip)` | the clip's size: the person's if set, else the derived largest, as `"WxH"`; `""` when there are no takes |
| `with(properties, value)` | the same properties with `size` set to the canonical `"WxH"`; `null` when `parse` refuses |

The descriptor's `value` takes the clip as an optional second argument, because the
derived size is the clip's answer and not in the `ClipProperties` map; a property that
needs only the map (title, description) ignores it. This is the one signature change,
and it is additive.

## The agent surface

`describeClip` already reports every clip property with its value, so the clip size
arrives there with no new field: an agent reads `properties` and finds `size` with the
current `"WxH"`. It is set through the existing `setProperty(id, property, value)`
operation with `property: "size"`, exactly as a person edits it in the panel.

No new tool, no new field, no new route.
