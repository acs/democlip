# Phase 1 — Data Model: Export Resolution

One new domain type, one descriptor added to the app's register, one value kept in the clip's own
properties, and one function the write paths call. The **clip size** and the **review** are not
touched: this feature adds a size beside them.

## 1. `ExportResolution` — the domain value (pure)

`src/domain/clip/ExportResolution.ts` *(new)*

| Field / member | Type | Meaning |
|---|---|---|
| `EXPORT_RESOLUTION_ID` | `'exportResolution'` | the clip property's id, in one place: the descriptor, the panel and the write paths share it |
| `LEVELS` | `readonly [2160, 1440, 1080, 720, 480]` | the levels the app offers — the number the clip's **shorter edge** is written at |
| `value` | `string` | `''` for **the clip size**, or one of `LEVELS` as a string (`'1080'`) |

**Rules**

- `ExportResolution.of(value)` — `''` answers the clip-size instance; a level in `LEVELS` answers
  that level; anything else answers **`null`** (the refusal, in the one place a value is read).
- `isExportResolution(value)` — whether a string is `''` or one of `LEVELS`; the descriptor's `with`
  uses it, so a value the app does not offer is refused rather than kept.
- `picture(clipSize)` — **the whole rule**, arithmetic with no browser:

  ```text
  ''            -> clipSize, unchanged
  level L       -> scale  = L / min(clipSize.width, clipSize.height)
                   longer = max(clipSize.width, clipSize.height) * scale
                   landscape: { width: longer, height: L }
                   portrait : { width: L, height: longer }
                   then ClipSize.of(...)  — each edge rounded up to even, null past MAX_EDGE
  ```

  It returns `null` only when the scaled picture runs past `ClipSize.MAX_EDGE`; the caller then
  keeps the clip size. The **aspect ratio is kept**: both edges move by the one factor, so the file
  is the same picture as the review with nothing cropped, stretched or letterboxed.
- `label()` — `'Clip size'` or `'1080p'`; what a list row reads.

**Invariants**: `value === ''` or `Number(value)` is one of `LEVELS`; a picture is even on both
edges and no smaller than 2×2; `picture()` never crops, stretches or pads.

**`exportPicture(properties, clipSize)`** — the free function the write paths call, mirroring
`boostsSound` in `src/domain/sound/SoundBoost.ts`:

```ts
/** The picture the clip's file is written at: the export resolution, or the clip size. Null when the clip has no size. */
export function exportPicture(properties: ClipProperties, clipSize: ClipSize | null): ClipSize | null;
```

An unknown stored value is treated as **the clip size** (never a throw), so a hand-edited record or
a profile from a later version cannot leave an export without a picture.

## 2. `ClipProperties` — how the value is kept (unchanged)

`src/domain/clip/ClipProperties.ts`

- the export resolution is an ordinary named string under `exportResolution`; `''` is not stored
  (`with(id, '')` drops it), so **unset is the one representation of the clip size** and the default
  the spec asks for;
- it travels in `ClipSnapshot.properties`, so it comes back after a reload through the existing
  IndexedDB clip store (`src/infra/clip-store.ts`), with no store change.

## 3. `ClipSize` — the picture built through (unchanged)

`src/domain/clip/ClipSize.ts` — `ClipSize.of(width, height)` rounds each edge **up to even** and
refuses a non-finite, tiny or past-`MAX_EDGE` size; `picture()` builds through it rather than
re-deriving its rules, so the export picture is held to the same even/ceiling rules a take is.

## 4. `ClipProperty` — one descriptor added

`src/ui/clip/clip-properties.ts`

| Part | Value |
|---|---|
| `id` | `EXPORT_RESOLUTION_ID` |
| `label` | `'Export resolution'` |
| `control` | `'choice'` — a list, like the **logo** |
| `seedable` | `true` — a **profile** may fix it |
| `choices` | `Clip size` (`''`) first, then `2160p … 480p` (`'2160' … '480'`) |
| `value` | `properties => properties.get(EXPORT_RESOLUTION_ID)` |
| `with` | `(properties, value) => isExportResolution(value) ? properties.with(EXPORT_RESOLUTION_ID, value) : null` |
| `blocked` | a clip with takes and **no picture** (sound-only): *"A sound-only clip has no picture to write — record a take with a picture"*; otherwise `null` |

Because it is declared here, three surfaces carry it with **no change to any of them**:

- the **properties panel** — a `choice` row is a `<select>` of `choices`; a profile-fixed one reads
  as its chosen label with the **lock** naming the profile (the read-only shape the clip size
  already uses);
- a **profile's sheet** — `seedableClipProperties()` puts it in the **Free / value** list, with
  **Not fixed** above the levels (`profile-rows.ts`, `profile-def.ts`);
- the **automation surface** — `describeClip` lists it with its `choices` and its value, and reports
  it `readOnly` when a profile fixes it; `setClipProperty` sets it or refuses it (`describe.ts`,
  `surface.ts`, `control.ts`).

## 5. The three write paths

| Path | Picture handed in |
|---|---|
| `src/ui/exporting/export-flow.ts` | `exportPicture(clip.properties, clip.size()) ?? preview` |
| `src/ui/publishing/publish-flow.ts` | the same value, four numbers |
| `src/ui/publishing/youtube-flow.ts` | the same value, four numbers |

- `ExportVideo.run` (`src/application/export-video.ts`) already takes `deps.picture()` for
  `fitsBudget` and passes its width/height to `encode` — so the **byte budget** a publish holds its
  file under is computed at the export resolution too, and a smaller resolution can make a clip that
  did not fit a publish fit;
- `EncoderAdapter.encode` (`src/infra/offline-encoder.ts`) makes its canvas `options.width ×
  options.height`, fits each take into it, and takes its **bitrate** from the canvas — so a smaller
  resolution writes a smaller file;
- `publish-flow.ts` derives the post's **aspect ratio** from the same picture
  (`AspectRatio.of(picture.width, picture.height).reduced()`), so the post and the file cannot
  disagree (FR-021) — and, the aspect being the clip's own, the ratio is unchanged from today.

## 6. How the pieces relate

```text
clip.properties['exportResolution']  ('', or '1080')
        │
        └─(ExportResolution.of / exportPicture)─> the picture the file is written at
                        │                                   │  (keep the clip size's aspect, even edges)
     clip.size() ───────┘                                   ▼
                                              export flow · publish flow · youtube flow
                                                          │
                            EncoderAdapter canvas = that picture  ·  AspectRatio for a post
                                                          │
                                     fitIn(canvas, take) · annotations & card by fractions
```

- the **review** reads `clip.size()` and never the export resolution: the picture a person works on
  does not move;
- a **profile** fixes it by declaring the item, exactly as it fixes the logo, and applying it puts
  the value on an empty clip through `Clip.applyProperty` (announced, not undoable) — no new seam;
- an item this build does not know is kept in a profile and never applied, as before.

## State transitions

**The value** (the person, or a profile on an empty clip)

```text
Clip size (unset) ──choose '1080'──> 1080p ──choose '720'──> 720p ──choose 'Clip size'──> unset
        ▲                                                                                  │
        └──────────────────────────────── undo (the person's own change) ◄──────────────────┘
```

**A profile fixes it**

```text
active profile declares exportResolution '1080'
        └─> the row reads 1080p with the lock naming the profile; the person and an agent are refused
            (the one undo never puts back a value a profile holds)
```

**A sound-only clip** — a clip with takes and no picture: the control is drawn disabled with the
reason; a value already there (set before the picture was cut, or fixed by a profile) is kept and
applies again the moment a picture is present, because the sound file simply does not use it.
