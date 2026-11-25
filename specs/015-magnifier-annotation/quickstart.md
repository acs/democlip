# Quickstart: Magnifier Annotation

How to see the feature work once it is built. The rules are unit-tested in node; the lens and the
dim — drawn, so a browser's business — are read back from the preview's pixels and from an
exported file in the end-to-end suite; and whether the effect **looks** right is a person's own
review, stated here rather than hidden.

## Prerequisites

```bash
npm install
```

Nothing else: a magnifier needs no new dependency, no file, no device and no network. It reads
the picture the app already draws.

## The rules, in node

```bash
npx vitest run src/domain/annotation/Magnifier.test.ts src/domain/annotation/kinds.test.ts
npx vitest run src/ui/annotating/annotation-layer.test.ts src/ui/annotating/annotation-plugin.test.ts
npx vitest run src/ui/agent/surface.test.ts src/ui/agent/edit.test.ts
npx vitest run mcp/src/tools.test.ts
```

Expected:

- `Magnifier.create(span, { x: 0.5, y: 0.5, radius: 0.2, zoom: 2 })` makes one; its geometry is
  the centre and radius as fractions, its zoom 2 and its colour the one given. A radius below
  `MIN_RADIUS`, a zoom outside 1.5–8, or a non-number is **null** and nothing is kept.
- A lens placed near an edge is **pulled inside** (the centre clamped, or the radius capped), and
  one moved past the edge stays wholly in the picture.
- On a **2:1 picture** the two grips sit on the rim at the lens's pixel radius over the picture's
  width, and the renderer draws that same pixel radius on both axes, so the lens is a **circle**,
  not an ellipse; `hitTest` is true inside the circle and false outside.
- Resizing from a grip changes the radius **around the same centre** and keeps the zoom; a resize
  below the smallest stops at the smallest.
- `withZoom('3')` is 3×; `withZoom('9')` and `withZoom('1')` are **null**; `withColour` changes
  the rim; `duplicated` is a new id with the same geometry; `stored()`/`restore()` round-trips
  `{ x, y, radius, zoom, colour }`.
- `kinds.annotationFrom` rebuilds a magnifier, and answers **null** for a geometry this build
  cannot use (the clip still opens).
- `annotation-layer.needsPicture` is true only when the shown set (or the draft) holds a renderer
  that reads the picture; `drawOrder` puts the readers **first**; `drawAnnotations` hands the
  picture it is given to every renderer, and draws the readers before the rest; the grips still
  follow `handles({ w, h })`. The copy itself is a DOM helper (`pictureFor`), so the drawing
  function stays testable with a fake picture; the browser check proves the copy.
- The property list is **Colour**, **Zoom** and the shared **Duration**, in that order; the
  number control's value is `'2'`, its step 0.5 and its range 1.5–8; the `with` refuses an
  out-of-range value.
- `describe()` reports a magnifier with its geometry (`x`, `y`, `radius`, `zoom`, `colour`); an
  agent's `annotate('magnifier', …)` makes one and `setProperty(id, 'zoom', '3')` changes it;
  MCP's `annotate` offers `"magnifier"` with `x`, `y`, `radius` and `zoom`.

Every `Arrow`, `ImageAnnotation`, `TextAnnotation`, `SoundAnnotation`, `AnnotationSet` and
`Clip` test passes **unmodified** — the regression proof that the family did not change.

## The lens and the dim, in a browser

```bash
npm run test:e2e -- e2e/checks/annotations.spec.ts --grep "magnifier"
npm run test:e2e -- e2e/checks/agent.spec.ts --grep "magnifier"
```

The first check walks the person's story. It seeds a take, selects a section, presses the
**Magnifier** row, drags from the detail outward, and then reads the real page:

1. **It is offered** — the annotate options hold five rows, the **Magnifier** among them.
2. **It is placed** — the lens appears on the lane, is picked with its two rim grips, and its
   settings control opens the preferences with **Zoom** at 2× and **Colour** at the clip's
   colour.
3. **The detail is enlarged** — the preview's white frame number inside the lens covers a larger
   share of the band than the same band does without the lens, and the band outside the lens is
   measurably darker: the lens and the spotlight are on the picture.
4. **The file carries it** — exporting with the lens and without it, then decoding the same
   moment of both, shows the lens band different and enlarged and the surrounding band darker;
   the takes are unchanged (the recording is never re-encoded), and the exported frame outside
   the lens's stretch carries no lens and no dim. A cut through the stretch leaves the frame
   without them.
5. **It is kept** — a reload brings the same circle, radius and zoom back.

The second check is the agent's story: `edit.annotate('magnifier', …)` places one, `describe()`
reads its geometry and zoom, `set_property` changes the zoom, `remove` and `undo` take it away
and back.

## In the app, by hand

```bash
npm run dev
```

Open the address Vite prints. Then:

1. Record or import a clip with a small detail — a code line, a button, a far-away word. In the
   review, select the stretch where it matters.
2. Press **Magnifier** in the annotate column; press at the centre of the detail and drag outward.
   The lens appears with the detail enlarged and the rest of the picture darker.
3. Pick it: the two grips are on the rim. Drag one to resize, drag the body to move it — it stays
   round and inside the picture at any clip shape.
4. Open its settings and change **Zoom** to 3× and its **Colour**; play across the stretch: the
   detail is larger, and the changes are in the review at once.
5. Copy it and paste at another moment, delete it, and take the deletion back with the one undo.
6. Cut a strip through its stretch: the lens and the dim are gone over the cut, and putting the
   cut back brings them back.
7. Export **WebM** and play the file: the same lens, rim and dim are there at the same moment,
   and the picture outside its stretch is exactly the recording.
8. Reload the page, or take the trip to publish sign-in: the same magnifier is back.
9. Place one on a clip whose picture is not 16:9: the circle is still a circle.

## What no check can do

- **The look** — whether the 55% dim is too heavy, whether the rim reads on a particular
  recording, whether 2× is the right starting zoom — is a person's judgement on their own
  picture. The checks prove the lens is there, that the detail is larger and the surround
  darker, and that the file matches; they do not judge taste.
- **A real screen share** — untouched by this feature, and still the person's to run, exactly as
  the app already states for the recorder.
- **A real publish** — the publish flow is checked with its service stood in for; a lens on a
  YouTube video or a Bluesky post is the same export path, and a real upload and playback is a
  person's session.
- **A very large picture on a slow machine** — the headless check's numbers are headless numbers.
  The one new per-frame cost is the picture copy while a lens shows; SC-005 (playback within one
  frame per second of the clip without it) is not something a headless run can judge, so it is
  stated as felt in the person's own recording rather than claimed by the suite.

## After the change

```bash
npm run lint && npm run typecheck && npx vitest run && npm run build
npm run test:e2e
```

The end-to-end suite is the final gate: the two magnifier checks pass, the existing annotation
checks pass with their kind-row count at five, and the export, publishing, profile, capture and
watermark checks still pass, since a clip with no magnifier is unchanged.