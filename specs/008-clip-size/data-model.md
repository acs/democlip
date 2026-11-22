# Data Model: Clip Size

## `ClipSize` — new class, `src/domain/clip/ClipSize.ts`

The picture a clip is shown and written at. A value: two sizes are equal when their
edges are.

| field | type | rule |
|---|---|---|
| `width` | number | whole, even, ≥ 2, ≤ `MAX_EDGE` |
| `height` | number | whole, even, ≥ 2, ≤ `MAX_EDGE` |

**Construction**

- `ClipSize.of(width, height)` — returns a `ClipSize`, or `null` when an edge is not a
  finite positive number or is beyond `MAX_EDGE`. An odd edge is rounded **up** to the
  next even size (so `985` → `986`).
- `ClipSize.parse(text)` — `"WxH"` (either `x` or `×`) to a `ClipSize`, or `null`. The
  one parse the `size` clip property uses.
- `ClipSize.largest(pictures)` — the largest width and the largest height among a list
  of pictures, rolled up to even, or `null` for an empty list.

**Behaviour**

- `toString()` → `"1920x1080"`, the canonical form the property stores.
- `equals(other)`.
- `frameFor(picture)` → `{ x, y, width, height }`: `picture` scaled to fit inside this
  size (the smaller of the two scale factors), centred. The rule both the review and
  the export draw through.

**`MAX_EDGE`** is 8192 — the largest picture the app's AVC level table carries. A size
beyond it is refused by the property, with the reason said plainly; the browser's own
refusal at encode time is unchanged.

## `Picture` — the size of a take's own picture

```ts
export interface Picture { readonly width: number; readonly height: number }
```

Data with no rule; the same width/height pair the infra `Picture` already uses. A take
cannot be built with a picture of no size.

## `Take` — gains a picture

| field | type | rule |
|---|---|---|
| `id` | number | as today |
| `blob` | Blob | as today |
| `url` | string | as today |
| `duration` | number | as today; > 0 |
| `picture` | `Picture \| null` | **new**; width and height both > 0 when present |

`Take.of(id, blob, url, duration, picture?)` throws when the duration is not positive or
a picture is given with no size — the same "cannot be represented" style as the duration
today. The picture is optional at the seam: a recorded or imported take always carries
one (the probe and the inspector measure it), while a take whose picture has not been
measured is tolerated, and `Clip.size()` simply ignores it. That is what let the seam
grow without rewriting every caller and fake.

`TakeRepository.add(blob, duration, picture)` and `Clip.addTake(blob, duration, picture)`
carry the picture through.

## `Clip` — gains a size

- `size(): ClipSize | null` — the person's size when `properties.get('size')` parses,
  else the largest take picture rounded up to even, else `null` when there are no
  takes. **Derived, not stored** (except the person's size).
- No new stored field and no new event. The clip already announces `take-added` and
  `property-changed`; the size follows from the takes and the `size` property, so the
  view re-fits when either changes.

## `ClipProperties` — holds the person's size

No code change. The person's size is one more string in the existing map, under the id
`size`, in canonical `"WxH"` form. It is therefore written with the clip, read back
after a reload, and taken back by the one undo, with no new machinery.

## `ClipSnapshot` — the takes gain a picture

```ts
takes: ReadonlyArray<{ blob: Blob; duration: number; picture?: Picture }>;
```

Optional so a snapshot written before this feature still reads: `Clip.restore` takes a
missing picture as the clip having no size from that take. The store writes the picture
beside the blob; a stored take without one is measured from its blob on load.

## Where each fact lives

| fact | owner |
|---|---|
| the even rule, the largest rule, the fit rectangle | `ClipSize` |
| the size of one take's picture | `Take` |
| the clip's size (derived, or the person's) | `Clip.size()` |
| the person's size as written down | `ClipProperties` (`size`) |
| measuring a recorded take's picture | `TakeProbeAdapter` |
| measuring an imported file's picture | `TakeFileInspector` |
| drawing a take inside the size | the review's `drawFrame`/`dissolve` and the encoder |
