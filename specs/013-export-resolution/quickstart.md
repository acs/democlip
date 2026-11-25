# Quickstart: Export Resolution

How to see the feature work, once it is built. The rule is unit-tested in node; the one thing only
a browser can show — that the **file's own picture** is the export resolution — is driven in a real
browser by the end-to-end suite and read back from the downloaded bytes.

## Prerequisites

```bash
npm install
```

## The rule, in node

```bash
npx vitest run src/domain/clip/ExportResolution.test.ts
npx vitest run src/ui/agent/surface.test.ts src/ui/profile/profile-menu.test.ts
```

Expected:

- `ExportResolution.of('')` is the **clip size**: its `value` is `''` and
  `picture(ClipSize.of(3840, 2160))` is **3840×2160** — the default, unchanged export.
- `ExportResolution.of('1080')!.picture(ClipSize.of(3840, 2160))` is **1920×1080**: the clip size
  scaled, the **aspect kept** (16:9 in, 16:9 out).
- The same level on another shape keeps that shape: on `ClipSize.of(1080, 1920)` (portrait) `'1080'`
  is **1080×1920** and `'720'` is **720×1280**; on `ClipSize.of(1440, 1080)` (4:3) `'1080'` is
  **1440×1080**. The level names the **shorter** edge.
- Both edges are **even**: a clip size with an odd edge scales to the next even size, and no export
  ever asks a codec for an odd edge.
- A level **above** the clip size **enlarges** it — `'2160'` on `ClipSize.of(1280, 720)` is
  **3840×2160** — so a production's output is uniform whatever the source.
- `ExportResolution.of('999')` is **`null`** and `isExportResolution('999')` is **`false`**: a value
  the app does not offer is refused, not kept.
- `exportPicture(properties, size)` reads the clip's own property and answers the picture the file
  is written at; an unknown stored value answers the **clip size**, never a throw; a clip with no
  size answers `null`.
- The clip property is a **list**: `control` is `'choice'`, `seedable` is `true`, and its `choices`
  are **Clip size** first and then **2160p … 480p**. `with(properties, '999')` is `null`; `with(properties, '1080')`
  keeps `'1080'`; `with(properties, '')` returns the clip to the clip size.
- `describeClip` lists `exportResolution` with its `choices` and its value, and reports it
  `readOnly: false` — and `readOnly: true`, with the profile named, when a profile fixes it.
- A profile's sheet shows it as a **choice** row with **Not fixed** above the levels, and fixing it
  to a level is what a clip made under that profile is then written at.

## What a person sees, in a browser

```bash
npm run test:e2e -- e2e/checks/export-resolution.spec.ts
```

The check boots the app, seeds a clip with a take larger than 1080p, and reads back the exported
file's **own video track** (`probeFile`):

1. **Left alone, the file is the clip size** — with nothing set, the exported file's width and
   height are the clip size, exactly as before the feature.
2. **Chosen, the file is the resolution** — set **Export resolution** to **1080p** in the clip's
   settings and export: the file's picture is **1920×1080**, whatever the take's own size.
3. **Smaller is smaller** — the same clip exported at 720p is **1280×720** and a **smaller file** in
   bytes than the same clip at 1080p.
4. **The clip did not move** — the review still shows the clip size, and the preview canvas is
   unchanged; only the file's picture is the export resolution.
5. **The picture is whole** — every take is in the file, nothing cropped and nothing stretched: the
   frame's content at the edges is the take's own, and there are no bars.
6. **A profile fixes it** — under a profile that fixes 1080p the clip's settings show **1080p** with
   `set by …` and no control, the file is 1080p, and `setClipProperty` refuses the change, naming
   the profile.
7. **It comes back** — after a reload the clip's settings still show the export resolution it was
   set to, and the next export is written at it.

## What no check can do

The recorder's own flow — a real screen share begun with a press — is the user's to run:
`getDisplayMedia` needs a gesture and a picker no check can open. The check reaches "a clip with a
take" through the suite's own take fixture, as every export check does. Run a session by hand and
confirm the review is unchanged while the file comes out smaller.

## In the app, by hand

```bash
npm run dev
```

1. Record a screen, or **Import** a large video, so the clip has a take bigger than 1080p.
2. Open the **settings** control in the corner of the preview. **Clip size** reads the takes' own
   size (say **3840×2160**), and below it **Export resolution** is a list, on **Clip size**.
3. Choose **720p**. The row reads 720p; the review does not change.
4. Export. The file is **1280×720** — the same picture as the review, at fewer pixels, and a good
   deal smaller.
5. Choose **Clip size** again and export: the file is 3840×2160, exactly as it was before.
6. To make it a production's rule: press the profile pill, create **DemoClipTV**, open its sliders
   mark, and fix **Export resolution** to **1080p**. Make a new clip under it — the row shows 1080p
   with `set by DemoClipTV` and nothing to press, and every export is 1080p.
7. Press **New**, then export: the export resolution is still 1080p for the new clip under the same
   profile. Remove the profile and the row is yours again, holding 1080p.
