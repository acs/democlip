# Contract — export resolution

The seam this feature defines: the rule that turns a chosen resolution into the picture a file is
written at, the clip property that carries the choice, and the three places that hand it to the
encoder. The rules are the domain's; this names the shapes so the four layers can be written against
them without meeting in the middle.

## 1. `ExportResolution` — the domain value (pure)

`src/domain/clip/ExportResolution.ts` *(new)*

```ts
export const EXPORT_RESOLUTION_ID = 'exportResolution';

export class ExportResolution {
  /** The levels the app offers, the number the clip's shorter edge is written at. */
  static readonly LEVELS: readonly [2160, 1440, 1080, 720, 480];
  /** '' is the clip size; a level is one of LEVELS; anything else is null. */
  static of(value: string): ExportResolution | null;

  /** '' or a level, as a string ('1080'). */
  readonly value: string;

  /** The clip size, or the clip size scaled so its shorter edge is this level (even edges, aspect kept). */
  picture(clipSize: ClipSize): ClipSize | null;

  /** 'Clip size' or '1080p' — what a list row reads. */
  label(): string;
}

/** Whether a string is '' or one of LEVELS — the descriptor's `with` uses this. */
export function isExportResolution(value: string): boolean;

/** The picture a clip's file is written at: the export resolution, or the clip size. Null when the clip has no size. */
export function exportPicture(properties: ClipProperties, clipSize: ClipSize | null): ClipSize | null;
```

**Guarantees**

- no DOM, no storage, no random source: `src/domain/` may not have one; it is arithmetic over a
  width and a height, like `ClipSize` and `SoundBoost`;
- **the aspect ratio is kept**: both edges move by one factor, so the picture is the clip size with
  nothing cropped, stretched or letterboxed (FR-004);
- both edges are **even**, built through `ClipSize.of`, whose rounding is the one rule for that;
- a value the app does not offer is **`null`** from `of`, and `exportPicture` treats an unknown
  stored value as **the clip size** rather than throwing — a hand-edited record or a later version's
  value cannot leave an export without a picture (FR-016);
- `picture` answers `null` only past `ClipSize.MAX_EDGE`; the caller keeps the clip size.

## 2. The clip property

`src/ui/clip/clip-properties.ts`

```ts
registerClipProperty({
  id: EXPORT_RESOLUTION_ID,
  label: 'Export resolution',
  control: 'choice',
  seedable: true,
  choices: [{ value: '', label: 'Clip size' }, /* '2160'…'480' → '2160p'…'480p' */],
  value: properties => properties.get(EXPORT_RESOLUTION_ID),
  with: (properties, value) => (isExportResolution(value) ? properties.with(EXPORT_RESOLUTION_ID, value) : null),
  blocked: /* a sound-only clip: no picture to write */,
});
```

**Guarantees**

- `''` **is the clip size** — the default FR-002 asks for — because `ClipProperties.with(id, '')`
  drops the value, so unset has one representation;
- `with` refuses a value not one of `LEVELS`, so neither a person, a written profile nor an agent can
  leave a clip on a resolution the app cannot write (FR-017);
- declaring it here is the **whole** of teaching all three surfaces about it (the panel, a profile's
  sheet, the automation surface) — the same as `addToExport` and `logo`;
- a **profile** may fix it by declaring the item; applying it goes through `Clip.applyProperty`
  (announced, not undoable), so the undo never puts back a value a profile holds (FR-013, FR-019).

## 3. Where the picture is applied

`src/ui/exporting/export-flow.ts` · `src/ui/publishing/publish-flow.ts` · `src/ui/publishing/youtube-flow.ts`

```ts
// each of the three:
const picture = exportPicture(session.clip.properties, session.clip.size())
  ?? { width: el.cv.width || 1280, height: el.cv.height || 720 };
```

**Guarantees**

- the picture handed to the file-writing code is the **export resolution**, not the clip size — and
  it is the one value used for the encoder's canvas, the byte budget (`fitsBudget`) and, for a
  publish, the post's **aspect ratio**, so no two of them can disagree (FR-007, FR-021);
- the review and the clip size are **not** touched: `clip.size()` still draws the preview, the
  watermark and the timeline (FR-004, FR-005);
- `EncoderAdapter` needs **no change**: its canvas already is the picture it is handed, each take is
  `fitIn` it, and the annotations and the card are drawn from `context.canvas.width/height` in
  fractions — so a smaller picture fits every take and draws everything to scale (FR-006, FR-011);
- the encoder's **bitrate follows the canvas**, so a smaller resolution writes a smaller file
  (FR-008) — no quality or bitrate control is added;
- and it follows it **all the way down**: `videoBitrate` (`src/infra/export-target.ts`) no longer
  clamps the rate up to a flat 4 Mbps, which sat above the app's own bits-per-pixel rule for every
  picture under about 1.1 megapixels and made 720p, 480p and 360p all the same size. The least it
  writes is a **share** (a quarter) of what the picture asks, so the file really does shrink with
  the resolution. A destination budget may lower the rate to that share, and a file that cannot fit
  at it is **refused** rather than written below the picture — the same refusal as before;
- the clip's **export size** (`src/ui/clip/timeline-ui.ts`, through `src/ui/clip/size-estimate.ts`)
  is a bare figure under the **Export button** (`#t-size` in `web/index.html`), computed at the
  export picture — the same `videoBitrate` the encoder is configured from — so the number the
  person reads is the file they will get, and it moves with the resolution. The button above it
  says what the figure means, so it carries no label of its own; it is on screen with the button,
  in the review, and the **review canvas** itself stays the clip size.

## 4. The surfaces (what a person and an agent see)

| Surface | Where | Contract |
|---|---|---|
| the clip's settings | `src/ui/clip/properties-panel.ts` | a `choice` row: a `<select>` of **Clip size**, 2160p…480p. A profile-fixed one reads as its label with the **lock** naming the profile. The row sits under **Clip size**, which is drawn read-only as today |
| a profile's sheet | `src/ui/profile/profile-rows.ts`, `profile-def.ts` | a `choice` item, listed with **Not fixed** above the levels — `declare(item, null)` is *the person's*, and is not the same as fixing it at **Clip size** |
| the automation surface | `src/ui/agent/describe.ts`, `surface.ts` | `describeClip` reports `{ id: 'exportResolution', control: 'choice', value, choices, readOnly }`; `setClipProperty` sets it, or refuses it (a bad value, or one a profile fixes, with the profile named) |

**Guarantees**

- no surface names the property's rule: all three read `clipProperties()` and draw what it declares,
  so a change to the levels is one line;
- the panel shows the value as the level (`1080p`) with the **clip size** drawn beside it, so the
  size the file will be is readable before an export (FR-009, US3);
- a **sound-only** clip draws the control disabled with the reason, rather than accepting a choice
  the sound file would ignore.

## 5. Out of scope this iteration

- **no change to the clip size**, the review, the takes' fit, the cuts or the annotations: the clip
  size is still derived and read-only (`008-clip-size` stands);
- **no separate quality or bitrate control**: the resolution is the one lever, and bitrate follows
  the picture;
- **no new MCP tool**: the export resolution is an ordinary clip property, reachable through the
  existing `describeClip` / `setClipProperty`, and a controlled one is refused by the existing seam;
- **no letterboxing**: a chosen resolution keeps the clip size's aspect, so the file never shows bars
  the review did not;
- the resolved **pixel size** (1920×1080) is not printed beside the level; the level and the clip
  size row are what the panel shows. Surfacing the exact pixels is a small follow-up if it is wanted.
